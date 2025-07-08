from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pulp import *

app = FastAPI()

# ตั้งค่า CORS Update
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4321", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ค่าคะแนนของ preference (อันดับ 1-5)
PREF_SCORES = [100, 50, 30, 15, 5]
SUB_PREF_SCORE = 3  # คะแนน subPreference

# -------------------- ปลายทาง solve_va --------------------
@app.post("/api/solve_va")
async def solve_va(request: Request):
    data = await request.json()
    groups = data["groups"]
    
    if isinstance(data["houses"], dict):
        houses = {int(k): v for k, v in data["houses"].items()}
    elif isinstance(data["houses"], list):
        houses = {i: h for i, h in enumerate(data["houses"])}
    else:
        raise Exception("Invalid houses format")

    assigned = {}  # เก็บผลลัพธ์การจัดกลุ่ม
    assigned_house_total = {hid: 0 for hid in houses}  # บ้านแต่ละหลังมีคนเท่าไร

    # ฟังก์ชันช่วยเช็คว่าบ้านยังรับได้หรือไม่
    def can_assign(hid, group_size):
        return assigned_house_total[hid] + group_size <= houses[hid]["capacity"]

    # รอบที่ 1: พยายามยัดบ้านอันดับ 1 ที่ยังไม่เต็ม
    unassigned = []
    for g in groups:
        gid = g["id"]
        prefs = g.get("preference", [])
        top = prefs[0] if prefs else None
        if top is not None and can_assign(top, g["size"]):
            assigned[gid] = top
            assigned_house_total[top] += g["size"]
        else:
            unassigned.append(g)

    # รอบที่ 2: ใช้ LP จัดให้คะแนนรวมสูงสุด (เฉพาะกลุ่มที่ยังไม่ลงบ้าน)
    if unassigned:
        prob = LpProblem("FullPreferenceAssignment", LpMaximize)

        x = {}
        allowed_houses_for_group = {}
        group_size_map = {}
        preference_index_cache = {}

        for g in unassigned:
            gid = g["id"]
            prefs = g.get("preference", [])[:5]
            subs = g.get("subPreference", [])
            allowed = set(prefs) | set(subs)

            allowed_houses_for_group[gid] = allowed
            group_size_map[gid] = g["size"]
            preference_index_cache[gid] = {h: i for i, h in enumerate(prefs)}

            for h in allowed:
                x[(gid, h)] = LpVariable(f"x_{gid}_{h}", cat=LpBinary)

        # Objective Function: รวมคะแนน preference/subPreference
        prob += lpSum(
            x[(gid, h)] * (
                PREF_SCORES[preference_index_cache[gid][h]] if h in preference_index_cache[gid]
                else SUB_PREF_SCORE
            )
            for gid in allowed_houses_for_group
            for h in allowed_houses_for_group[gid]
        ), "TotalPreferencePoints"

        # constraint: ทุกกลุ่มต้องได้บ้าน 1 หลัง
        for gid in allowed_houses_for_group:
            prob += lpSum(x[(gid, h)] for h in allowed_houses_for_group[gid]) == 1

        # constraint: ความจุบ้านห้ามเกิน capacity
        for h in houses:
            prob += (
                lpSum(
                    x[(gid, h)] * group_size_map[gid]
                    for gid in allowed_houses_for_group if (gid, h) in x
                ) + assigned_house_total[h]
                <= houses[h]["capacity"]
            )

        prob.solve(PULP_CBC_CMD(msg=0))  # ปิด log

        # เก็บผลลัพธ์จาก LP
        still_unassigned = []
        for g in unassigned:
            gid = g["id"]
            assigned_house = None
            for h in allowed_houses_for_group[gid]:
                if x[(gid, h)].varValue is not None and x[(gid, h)].varValue > 0.5:
                    assigned[gid] = h
                    assigned_house_total[h] += g["size"]
                    assigned_house = h
                    break
            if assigned_house is None:
                still_unassigned.append(g)

        unassigned = still_unassigned
    else:
        unassigned = []

    # รอบที่ 3: เหลือกลุ่มไหนยังไม่ลงบ้าน ให้พยายามยัด subPreference หรือบ้านว่าง
    for g in unassigned:
        gid = g["id"]
        assigned_house = None

        # พยายามยัดบ้าน subPreference ก่อน
        for h in g.get("subPreference", []):
            if can_assign(h, g["size"]):
                assigned[gid] = h
                assigned_house_total[h] += g["size"]
                assigned_house = h
                break

        # ถ้ายังไม่ได้ ให้หาบ้านที่ยังว่าง
        if assigned_house is None:
            for h in houses:
                if can_assign(h, g["size"]):
                    assigned[gid] = h
                    assigned_house_total[h] += g["size"]
                    assigned_house = h
                    break

        # ถ้ายังไม่ได้จริงๆ ให้ None
        if assigned_house is None:
            assigned[gid] = None

    return JSONResponse(assigned)

# -------------------- ปลายทาง solve_vb --------------------
@app.post("/api/solve_vb")
async def solve_vb(request: Request):
    data = await request.json()
    groups = data["groups"]
    
    if isinstance(data["houses"], dict):
        houses = {int(k): v for k, v in data["houses"].items()}
    elif isinstance(data["houses"], list):
        houses = {i: h for i, h in enumerate(data["houses"])}
    else:
        raise Exception("Invalid houses format")

    remaining_capacity = {h: houses[h]["capacity"] for h in houses}
    result = {}

    prob = LpProblem("FullGroupAssignment", LpMaximize)
    x = {}

    group_size_map = {}
    preference_index_cache = {}

    for g in groups:
        gid = g["id"]
        prefs = g.get("preference", [])[:5]
        subs = g.get("subPreference", [])
        allowed = set(prefs) | set(subs)
        group_size_map[gid] = g["size"]
        preference_index_cache[gid] = {h: i for i, h in enumerate(prefs)}

        for h in allowed:
            x[(gid, h)] = LpVariable(f"x_{gid}_{h}", cat=LpBinary)

    # objective function: รวมคะแนน preference/subPreference
    prob += lpSum(
        x[(gid, h)] * (
            PREF_SCORES[preference_index_cache[gid][h]] if h in preference_index_cache[gid]
            else SUB_PREF_SCORE
        )
        for (gid, h) in x
    ), "TotalPreferencePoints"

    # constraint: กลุ่มต้องได้บ้านเดียว
    for gid in group_size_map:
        prob += lpSum(x[(gid, h)] for (gidx, h) in x if gidx == gid) == 1

    # constraint: ความจุบ้านห้ามเกิน capacity
    for h in houses:
        prob += lpSum(
            x[(gid, h)] * group_size_map[gid]
            for (gid, hh) in x if hh == h
        ) <= houses[h]["capacity"]

    prob.solve(PULP_CBC_CMD(msg=0))

    # ตีความผลลัพธ์
    for g in groups:
        gid = g["id"]
        assigned_house = None
        allowed_houses = set(g.get("preference", [])[:5]) | set(g.get("subPreference", []))
        for h in allowed_houses:
            if x.get((gid, h)) and x[(gid, h)].varValue == 1:
                result[gid] = h
                remaining_capacity[h] -= g["size"]
                assigned_house = h
                break
        if assigned_house is None:
            result[gid] = None

    return JSONResponse(result)