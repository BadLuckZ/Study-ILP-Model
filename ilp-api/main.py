from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pulp import *
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4321"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ค่าคงที่ที่ใช้ร่วมกัน
BATCH_SIZE = 200

PREF_SCORES = [100, 50, 30, 15, 5]      # คะแนน preference อันดับ 1-5
SUB_PREF_SCORE = 3                      # คะแนน subPreference
OUT_PREF_PENALTY = -50                  # ค่าปรับบ้านที่ไม่อยู่ใน preference หรือ subPreference

OVERFLOW_PENALTY = 50                   # ค่าปรับ overflow ต่อคน (vb)
OVERFLOW_LIMIT_RATIO = 0                # ไม่อนุญาต overflow

@app.post("/api/solve_va")
async def solve_va(request: Request):
    data = await request.json()
    groups = data["groups"]
    houses = {int(h): v for h, v in data["houses"].items()}

    assigned = {}
    assigned_house_total = {hid: 0 for hid in houses}

    def can_assign(hid, group_size):
        return assigned_house_total[hid] + group_size <= houses[hid]["max"]

    def chunk(lst, n):
        for i in range(0, len(lst), n):
            yield lst[i : i + n]

    for batch_groups in chunk(groups, BATCH_SIZE):
        # รอบ 1: เติมบ้านอันดับ 1 หากยังไม่เกิน min capacity
        unassigned_in_batch = []
        for g in batch_groups:
            gid = g["id"]
            prefs = g.get("preference", [])
            top = prefs[0] if prefs else None
            if top is not None and assigned_house_total[top] + g["size"] <= houses[top]["min"]:
                assigned[gid] = top
                assigned_house_total[top] += g["size"]
            else:
                unassigned_in_batch.append(g)

        # รอบ 2: LP เพื่อ maximize คะแนน preference สำหรับอันดับ 2-5
        if unassigned_in_batch:
            prob = LpProblem("BatchPreferenceAssignment", LpMaximize)

            x = {(g["id"], h): LpVariable(f"x_{g['id']}_{h}", cat=LpBinary) for g in unassigned_in_batch for h in houses}

            prob += lpSum(
                x[(g["id"], h)] * (
                    PREF_SCORES[g["preference"].index(h)] if h in g["preference"] else OUT_PREF_PENALTY
                )
                for g in unassigned_in_batch for h in houses
            ), "TotalPreferencePoints"

            # แต่ละกลุ่มได้บ้านเดียว
            for g in unassigned_in_batch:
                prob += lpSum(x[(g["id"], h)] for h in houses) == 1

            # ไม่เกิน max capacity ของบ้าน
            for h in houses:
                prob += (
                    lpSum(x[(g["id"], h)] * g["size"] for g in unassigned_in_batch)
                    + assigned_house_total[h]
                    <= houses[h]["max"]
                )

            prob.solve()

            still_unassigned = []
            for g in unassigned_in_batch:
                gid = g["id"]
                assigned_house = None
                for h in houses:
                    var_val = x[(gid, h)].varValue
                    if var_val is not None and var_val > 0.5:
                        assigned[gid] = h
                        assigned_house_total[h] += g["size"]
                        assigned_house = h
                        break
                if assigned_house is None:
                    still_unassigned.append(g)

            unassigned_in_batch = still_unassigned
        else:
            unassigned_in_batch = []

        # รอบ 3: กรณียังไม่ถูกจัด assign จาก subPreference หรือบ้านที่ว่าง
        for g in unassigned_in_batch:
            gid = g["id"]
            assigned_house = None

            for h in g.get("subPreference", []):
                if can_assign(h, g["size"]):
                    assigned[gid] = h
                    assigned_house_total[h] += g["size"]
                    assigned_house = h
                    break

            if assigned_house is None:
                for h in houses:
                    if can_assign(h, g["size"]):
                        assigned[gid] = h
                        assigned_house_total[h] += g["size"]
                        assigned_house = h
                        break

            if assigned_house is None:
                assigned[gid] = None

    return JSONResponse(assigned)


@app.post("/api/solve_vb")
async def solve_vb(request: Request):
    data = await request.json()
    groups = data["groups"]
    houses = {int(k): v for k, v in data["houses"].items()}

    remaining_capacity = {h: houses[h]["max"] for h in houses}
    result = {}

    max_overflow = {
        h: int(OVERFLOW_LIMIT_RATIO * houses[h]["max"])
        for h in houses
    }

    for batch_start in range(0, len(groups), BATCH_SIZE):
        batch = groups[batch_start: batch_start + BATCH_SIZE]

        prob = LpProblem("GroupAssignmentBatch", LpMaximize)
        x = {}
        overflow = {
            h: LpVariable(f"overflow_{h}_batch", lowBound=0, cat=LpInteger)
            for h in houses
        }

        for g in batch:
            gid = g["id"]
            for h in houses:
                x[(gid, h)] = LpVariable(f"x_{gid}_{h}_batch", cat=LpBinary)

        # objective maximize คะแนน preference + subPreference - ค่าปรับ overflow
        prob += (
            lpSum(
                x[(g["id"], h)] * (
                    PREF_SCORES[g["preference"].index(h)] if h in g["preference"] and g["preference"].index(h) < len(PREF_SCORES)
                    else SUB_PREF_SCORE if h in g.get("subPreference", [])
                    else OUT_PREF_PENALTY
                )
                for g in batch for h in houses
            )
            - lpSum(overflow[h] * OVERFLOW_PENALTY for h in houses)
        )

        # กลุ่มได้บ้านเดียว
        for g in batch:
            prob += lpSum(x[(g["id"], h)] for h in houses) == 1

        # ไม่เกิน max capacity + overflow
        for h in houses:
            prob += (
                lpSum(x[(g["id"], h)] * g["size"] for g in batch)
                <= remaining_capacity[h] + overflow[h]
            )
            prob += overflow[h] <= max_overflow[h]

        prob.solve()

        for g in batch:
            gid = g["id"]
            for h in houses:
                if x[(gid, h)].varValue == 1:
                    result[gid] = h
                    remaining_capacity[h] -= g["size"]
                    if remaining_capacity[h] < 0:
                        remaining_capacity[h] = 0
                    break

    return JSONResponse(result)
