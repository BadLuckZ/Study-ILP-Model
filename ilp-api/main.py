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

PREF_SCORES = [400, 180, 80, 35, 15] # คะแนน preference (อันดับ 1-5)
SUB_PREF_SCORE = -2000  # คะแนน subPreference
TIME_LIMIT = 15

# -------------------- ENDPOINT solve_va --------------------
@app.post("/api/solve_va")
async def solve_va(request: Request):
    data = await request.json()
    groups = data["groups"]

    if isinstance(data["houses"], dict):
        houses = {k: v for k, v in data["houses"].items()}
    elif isinstance(data["houses"], list):
        houses = {h["id"]: h for h in data["houses"]}
    else:
        raise Exception("Invalid houses format")

    assigned = {}
    assigned_house_total = {hid: 0 for hid in houses}

    def can_assign(hid, group_size):
        return assigned_house_total[hid] + group_size <= houses[hid]["max"]

    # รอบ 1: เติมบ้านอันดับ 1 หากยังไม่เกิน min capacity
    unassigned = []
    for g in groups:
        gid = g["id"]
        prefs = [g.get(f"house_rank_{i+1}") for i in range(5) if g.get(f"house_rank_{i+1}") is not None]
        top = prefs[0] if prefs else None
        group_size = g.get("member_count", 1)
        if top is not None and top in houses and assigned_house_total[top] + group_size <= houses[top]["min"]:
            assigned[gid] = top
            assigned_house_total[top] += group_size
        else:
            unassigned.append(g)

    # รอบ 2: LP เพื่อ maximize คะแนน preference (เฉพาะ main preferences)
    if unassigned:
        prob = LpProblem("PreferenceAssignment", LpMaximize)
        x = {}
        
        for g in unassigned:
            gid = g["id"]
            prefs = [g.get(f"house_rank_{i+1}") for i in range(5) if g.get(f"house_rank_{i+1}") is not None]
            allowed = set(prefs)
            allowed = {h for h in allowed if h in houses}
            for h in allowed:
                x[(gid, h)] = LpVariable(f"x_{gid}_{h}", cat=LpBinary)

        if x:
            prob += lpSum(
                x[(gid, h)] * PREF_SCORES[prefs.index(h)]
                for g in unassigned
                for gid in [g["id"]]
                for prefs in [[g.get(f"house_rank_{i+1}") for i in range(5) if g.get(f"house_rank_{i+1}") is not None]]
                for h in set(prefs)
                if h in houses and (gid, h) in x
            ), "TotalPreferencePoints"

            # แต่ละกลุ่มได้บ้านเดียว
            for g in unassigned:
                gid = g["id"]
                prefs = [g.get(f"house_rank_{i+1}") for i in range(5) if g.get(f"house_rank_{i+1}") is not None]
                allowed = set(prefs)
                allowed = {h for h in allowed if h in houses}
                if allowed:
                    prob += lpSum(x[(gid, h)] for h in allowed if (gid, h) in x) == 1

            # ไม่เกิน max ของบ้าน
            for h in houses:
                prob += (
                    lpSum(x[(g["id"], h)] * g.get("member_count", 1) 
                         for g in unassigned if (g["id"], h) in x)
                    + assigned_house_total[h]
                    <= houses[h]["max"]
                )

            solver = PULP_CBC_CMD(msg=0, timeLimit=TIME_LIMIT)
            status = prob.solve(solver)

            if status in [LpStatusOptimal, LpStatusNotSolved]:
                still_unassigned = []
                for g in unassigned:
                    gid = g["id"]
                    assigned_house = None
                    prefs = [g.get(f"house_rank_{i+1}") for i in range(5) if g.get(f"house_rank_{i+1}") is not None]
                    allowed = set(prefs)
                    allowed = {h for h in allowed if h in houses}
                    for h in allowed:
                        if (gid, h) in x and x[(gid, h)].varValue is not None and x[(gid, h)].varValue > 0.5:
                            assigned[gid] = h
                            assigned_house_total[h] += g.get("member_count", 1)
                            assigned_house = h
                            break
                    if assigned_house is None:
                        still_unassigned.append(g)
                unassigned = still_unassigned

    # รอบ 3: พยายามจัด preference อื่นๆ ที่เหลือ (รวม sub preference)
    remaining_unassigned = []
    for g in unassigned:
        gid = g["id"]
        assigned_house = None
        group_size = g.get("member_count", 1)
        
        # ลองตามลำดับ preference ก่อน
        prefs = [g.get(f"house_rank_{i+1}") for i in range(5) if g.get(f"house_rank_{i+1}") is not None]
        for h in prefs:
            if h in houses and can_assign(h, group_size):
                assigned[gid] = h
                assigned_house_total[h] += group_size
                assigned_house = h
                break
        
        if assigned_house is None:
            remaining_unassigned.append(g)

    # รอบ 4: จัด sub preferences เท่านั้น
    final_unassigned = []
    for g in remaining_unassigned:
        gid = g["id"]
        assigned_house = None
        group_size = g.get("member_count", 1)
        
        # ลอง sub preference เท่านั้น
        subs = [g.get("house_sub")] if g.get("house_sub") is not None else []
        for h in subs:
            if h in houses and can_assign(h, group_size):
                assigned[gid] = h
                assigned_house_total[h] += group_size
                assigned_house = h
                break
        
        if assigned_house is None:
            final_unassigned.append(g)

    # รอบ 5: LP สำหรับกลุ่มที่ยังเหลือ - ใช้ทั้ง preferences และ sub preferences
    if final_unassigned:
        # ขยายความจุของบ้านชั่วคราวเพื่อให้ทุกกลุ่มได้บ้านที่เลือกไว้
        expanded_houses = {}
        for hid, house in houses.items():
            expanded_houses[hid] = {
                **house,
                "max": house["max"] + 1000  # ขยายความจุชั่วคราว
            }
        
        prob2 = LpProblem("FinalAssignment", LpMaximize)
        y = {}
        
        for g in final_unassigned:
            gid = g["id"]
            prefs = [g.get(f"house_rank_{i+1}") for i in range(5) if g.get(f"house_rank_{i+1}") is not None]
            subs = [g.get("house_sub")] if g.get("house_sub") is not None else []
            # ใช้เฉพาะ preferences และ sub preferences เท่านั้น
            allowed = set(prefs) | set(subs)
            allowed = {h for h in allowed if h in houses}
            
            for h in allowed:
                y[(gid, h)] = LpVariable(f"y_{gid}_{h}", cat=LpBinary)

        if y:
            prob2 += lpSum(
                y[(gid, h)] * (
                    PREF_SCORES[prefs.index(h)] if h in prefs else SUB_PREF_SCORE
                )
                for g in final_unassigned
                for gid in [g["id"]]
                for prefs in [[g.get(f"house_rank_{i+1}") for i in range(5) if g.get(f"house_rank_{i+1}") is not None]]
                for subs in [[g.get("house_sub")] if g.get("house_sub") is not None else []]
                for h in (set(prefs) | set(subs))
                if h in houses and (gid, h) in y
            ), "FinalPreferencePoints"

            for g in final_unassigned:
                gid = g["id"]
                prefs = [g.get(f"house_rank_{i+1}") for i in range(5) if g.get(f"house_rank_{i+1}") is not None]
                subs = [g.get("house_sub")] if g.get("house_sub") is not None else []
                allowed = set(prefs) | set(subs)
                allowed = {h for h in allowed if h in houses}
                if allowed:
                    prob2 += lpSum(y[(gid, h)] for h in allowed if (gid, h) in y) == 1

            # ใช้ความจุที่ขยายแล้ว
            for h in houses:
                prob2 += (
                    lpSum(y[(g["id"], h)] * g.get("member_count", 1) 
                         for g in final_unassigned if (g["id"], h) in y)
                    + assigned_house_total[h]
                    <= expanded_houses[h]["max"]
                )

            solver2 = PULP_CBC_CMD(msg=0, timeLimit=TIME_LIMIT)
            status2 = prob2.solve(solver2)

            if status2 in [LpStatusOptimal, LpStatusNotSolved]:
                still_final_unassigned = []
                for g in final_unassigned:
                    gid = g["id"]
                    assigned_house = None
                    prefs = [g.get(f"house_rank_{i+1}") for i in range(5) if g.get(f"house_rank_{i+1}") is not None]
                    subs = [g.get("house_sub")] if g.get("house_sub") is not None else []
                    allowed = set(prefs) | set(subs)
                    allowed = {h for h in allowed if h in houses}
                    for h in allowed:
                        if (gid, h) in y and y[(gid, h)].varValue is not None and y[(gid, h)].varValue > 0.5:
                            assigned[gid] = h
                            assigned_house_total[h] += g.get("member_count", 1)
                            assigned_house = h
                            break
                    if assigned_house is None:
                        still_final_unassigned.append(g)
                final_unassigned = still_final_unassigned

    # รอบ 6: Fallback - จัดบ้านใดก็ได้ที่ยังมีที่ว่าง
    for g in final_unassigned:
        gid = g["id"]
        assigned_house = None
        group_size = g.get("member_count", 1)
        
        # ลอง preferences ก่อน
        prefs = [g.get(f"house_rank_{i+1}") for i in range(5) if g.get(f"house_rank_{i+1}") is not None]
        for h in prefs:
            if h in houses:
                assigned[gid] = h
                assigned_house_total[h] += group_size
                assigned_house = h
                break
        
        # ถ้ายังไม่ได้ ลอง sub preference
        if assigned_house is None:
            subs = [g.get("house_sub")] if g.get("house_sub") is not None else []
            for h in subs:
                if h in houses:
                    assigned[gid] = h
                    assigned_house_total[h] += group_size
                    assigned_house = h
                    break
        
        # หากยังไม่ได้เลย ให้ assign เป็น None
        if assigned_house is None:
            assigned[gid] = None

    return JSONResponse(assigned)

# -------------------- Endpoint solve_vb --------------------
@app.post("/api/solve_vb")
async def solve_vb(request: Request):
    data = await request.json()
    groups = data["groups"]

    if isinstance(data["houses"], dict):
        houses = {k: v for k, v in data["houses"].items()}
    elif isinstance(data["houses"], list):
        houses = {h["id"]: h for h in data["houses"]}
    else:
        raise Exception("Invalid houses format")

    result = {}
    prob = LpProblem("FullGroupAssignment", LpMaximize)
    x = {}

    group_size_map = {}
    preference_index_cache = {} 
    groups_with_preferences = [] 

    for g in groups:
        gid = g["id"]
        prefs = [g.get(f"house_rank_{i+1}") for i in range(5) if g.get(f"house_rank_{i+1}") is not None]
        subs = [g.get("house_sub")] if g.get("house_sub") is not None else []
        
        allowed = set(prefs) | set(subs)
        
        # ตรวจสอบว่ามี preference อย่างน้อย 1 อัน
        if allowed:
            groups_with_preferences.append(g)
            group_size_map[gid] = g.get("member_count", 1)
            preference_index_cache[gid] = {h: i for i, h in enumerate(prefs)}
            
            for h in allowed:
                if h in houses:
                    x[(gid, h)] = LpVariable(f"x_{gid}_{h}", cat=LpBinary)

    if not x:
        for g in groups:
            result[g["id"]] = None
        return JSONResponse(result)

    # Goal Function
    prob += lpSum(
        x[(gid, h)] * (
            PREF_SCORES[preference_index_cache[gid][h]] if h in preference_index_cache[gid]
            else SUB_PREF_SCORE
        )
        for (gid, h) in x
    ), "TotalPreferencePoints"
    
    # Constraint 1: แต่ละกลุ่มได้บ้านเดียว
    for gid in group_size_map:
        group_vars = [x[(gid, h)] for (gid_check, h) in x if gid_check == gid]
        if group_vars:
            prob += lpSum(group_vars) == 1

    # Constraint 2: ไม่เกินความจุของบ้าน
    for h in houses:
        house_vars = [x[(gid, h)] * group_size_map[gid] for (gid, h_check) in x if h_check == h]
        if house_vars:
            prob += lpSum(house_vars) <= houses[h]["capacity"]

    # Solve
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
                if h in houses and (gid, h) in x:
                    if x[(gid, h)].varValue is not None and x[(gid, h)].varValue > 0.5:
                        result[gid] = h
                        assigned_house = h
                        break
            
            if assigned_house is None:
                result[gid] = None
        
        for g in groups:
            if g not in groups_with_preferences:
                result[g["id"]] = None
                
    else:
        for g in groups:
            result[g["id"]] = None

    return JSONResponse(result)