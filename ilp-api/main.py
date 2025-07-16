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

PREF_SCORES = [250, 120, 50, 20, 12] # คะแนน preference (อันดับ 1-5)
SUB_PREF_SCORE = -1000  # คะแนน subPreference
TIME_LIMIT = 10

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

    assigned = {}
    assigned_house_total = {hid: 0 for hid in houses}

    def can_assign(hid, group_size):
        return assigned_house_total[hid] + group_size <= houses[hid]["capacity"]

    unassigned = []
    for g in groups:
        gid = g["id"]
        # ดึง preference/subPreference จาก house_rank_1-5, house_sub
        prefs = [g.get(f"house_rank_{i+1}") for i in range(5) if g.get(f"house_rank_{i+1}") is not None]
        subs = [g.get("house_sub")] if g.get("house_sub") is not None else []
        top = prefs[0] if prefs else None
        group_size = g.get("member_count", 1)
        if top is not None and can_assign(top, group_size):
            assigned[gid] = top
            assigned_house_total[top] += group_size
        else:
            unassigned.append({
                "id": gid,
                "prefs": prefs,
                "subs": subs,
                "member_count": group_size
            })

    if unassigned:
        prob = LpProblem("FullPreferenceAssignment", LpMaximize)
        x = {}
        allowed_houses_for_group = {}
        group_size_map = {}
        preference_index_cache = {}

        for g in unassigned:
            gid = g["id"]
            prefs = g["prefs"]
            subs = g["subs"]
            allowed = set(prefs) | set(subs)
            allowed_houses_for_group[gid] = allowed
            group_size_map[gid] = g["member_count"]
            preference_index_cache[gid] = {h: i for i, h in enumerate(prefs)}
            for h in allowed:
                x[(gid, h)] = LpVariable(f"x_{gid}_{h}", cat=LpBinary)

        prob += lpSum(
            x[(gid, h)] * (
                PREF_SCORES[preference_index_cache[gid][h]] if h in preference_index_cache[gid]
                else SUB_PREF_SCORE
            )
            for gid in allowed_houses_for_group
            for h in allowed_houses_for_group[gid]
        ), "TotalPreferencePoints"

        for gid in allowed_houses_for_group:
            prob += lpSum(x[(gid, h)] for h in allowed_houses_for_group[gid]) == 1

        for h in houses:
            prob += (
                lpSum(
                    x[(gid, h)] * group_size_map[gid]
                    for gid in allowed_houses_for_group if (gid, h) in x
                ) + assigned_house_total[h]
                <= houses[h]["capacity"]
            )

        solver = PULP_CBC_CMD(msg=0, timeLimit=TIME_LIMIT)
        status = prob.solve(solver)
        
        if status in [LpStatusOptimal, LpStatusNotSolved]:
            still_unassigned = []
            for g in unassigned:
                gid = g["id"]
                assigned_house = None
                for h in allowed_houses_for_group[gid]:
                    if x[(gid, h)].varValue is not None and x[(gid, h)].varValue > 0.5:
                        assigned[gid] = h
                        assigned_house_total[h] += g["member_count"]
                        assigned_house = h
                        break
                if assigned_house is None:
                    still_unassigned.append(g)
            unassigned = still_unassigned
        else:
            # หากไม่สามารถหาผลลัพธ์ได้เลย ให้ทำการจัดสรรแบบเดิม
            pass
    else:
        unassigned = []

    for g in unassigned:
        gid = g["id"]
        assigned_house = None
        for h in g["subs"]:
            if can_assign(h, g["member_count"]):
                assigned[gid] = h
                assigned_house_total[h] += g["member_count"]
                assigned_house = h
                break
        if assigned_house is None:
            for h in houses:
                if can_assign(h, g["member_count"]):
                    assigned[gid] = h
                    assigned_house_total[h] += g["member_count"]
                    assigned_house = h
                    break
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
        prefs = [g.get(f"house_rank_{i+1}") for i in range(5) if g.get(f"house_rank_{i+1}") is not None]
        subs = [g.get("house_sub")] if g.get("house_sub") is not None else []
        allowed = set(prefs) | set(subs)
        group_size_map[gid] = g.get("member_count", 1)
        preference_index_cache[gid] = {h: i for i, h in enumerate(prefs)}
        for h in allowed:
            x[(gid, h)] = LpVariable(f"x_{gid}_{h}", cat=LpBinary)

    prob += lpSum(
        x[(gid, h)] * (
            PREF_SCORES[preference_index_cache[gid][h]] if h in preference_index_cache[gid]
            else SUB_PREF_SCORE
        )
        for (gid, h) in x
    ), "TotalPreferencePoints"

    for gid in group_size_map:
        prob += lpSum(x[(gid, h)] for (gidx, h) in x if gidx == gid) == 1

    for h in houses:
        prob += lpSum(
            x[(gid, h)] * group_size_map[gid]
            for (gid, hh) in x if hh == h
        ) <= houses[h]["capacity"]

    solver = PULP_CBC_CMD(msg=0, timeLimit=TIME_LIMIT)
    status = prob.solve(solver)

    if status in [LpStatusOptimal, LpStatusNotSolved]:
        for g in groups:
            gid = g["id"]
            assigned_house = None
            prefs = [g.get(f"house_rank_{i+1}") for i in range(5) if g.get(f"house_rank_{i+1}") is not None]
            subs = [g.get("house_sub")] if g.get("house_sub") is not None else []
            allowed_houses = set(prefs) | set(subs)
            for h in allowed_houses:
                if x.get((gid, h)) and x[(gid, h)].varValue == 1:
                    result[gid] = h
                    remaining_capacity[h] -= g.get("member_count", 1)
                    assigned_house = h
                    break
            if assigned_house is None:
                result[gid] = None
    else:
        for g in groups:
            result[g["id"]] = None

    return JSONResponse(result)