import { useEffect, useState } from "react";
import { assignGroupsVa, assignGroupsVb } from "../lib/api";
import * as XLSX from "xlsx";

const FIXED_HOUSES = [
  { houseName: "บ้านว้อนท์", sizeName: "S", capacity: 32 * 3 }, // 96
  { houseName: "บ้านคุณหนู", sizeName: "S", capacity: 41 * 3 }, // 123
  { houseName: "บ้านโคะ", sizeName: "S", capacity: 41 * 3 }, // 123
  { houseName: "บ้านดัง", sizeName: "S", capacity: 30 * 3 }, // 90
  { houseName: "บ้านเดอะ", sizeName: "S", capacity: 38 * 3 }, // 114
  { houseName: "บ้านหลายใจ", sizeName: "S", capacity: 45 * 3 }, // 135
  { houseName: "บ้านอากาเป้", sizeName: "S", capacity: 32 * 3 }, // 96
  { houseName: "บ้านนอก", sizeName: "M", capacity: 61 * 3 }, // 183
  { houseName: "บ้านจิ๊จ๊ะ", sizeName: "M", capacity: 67 * 3 }, // 201
  { houseName: "บ้านเอช้วน", sizeName: "M", capacity: 83 * 3 }, // 249
  { houseName: "บ้านโจ๊ะเด๊ะฮือซา", sizeName: "M", capacity: 99 * 3 }, // 297
  { houseName: "บ้านโบ้", sizeName: "S", capacity: 43 * 3 }, // 129
  { houseName: "บ้านอะอึ๋ม", sizeName: "M", capacity: 84 * 3 }, // 252
  { houseName: "บ้านคิดส์", sizeName: "L", capacity: 70 * 3 }, // 210
  { houseName: "บ้านแจ๋ว", sizeName: "L", capacity: 119 * 3 }, // 357
  { houseName: "บ้านสด", sizeName: "L", capacity: 108 * 3 }, // 324
  { houseName: "บ้านเฮา", sizeName: "L", capacity: 119 * 3 }, // 357
  { houseName: "บ้านคุ้ม", sizeName: "XL", capacity: 133 * 4 }, // 532
  { houseName: "บ้านโจ๋", sizeName: "XL", capacity: 198 * 4 }, // 792
  { houseName: "บ้านโซ้ยตี๋หลีหมวย", sizeName: "XL", capacity: 196 * 4 }, // 784
  { houseName: "บ้านแรงส์", sizeName: "XXL", capacity: 312 * 4 }, // 1248
  { houseName: "บ้านยิ้ม", sizeName: "XXL", capacity: 201 * 4 }, // 804
];

const FIXED_GROUPS = [
  // {
  //   id: "1",
  //   head_id: 20001,
  //   member_id_1: 30001,
  //   member_id_2: 30002,
  //   member_count: 3,
  //   house_rank_1: 1,
  //   house_rank_2: null,
  //   house_rank_3: null,
  //   house_rank_4: null,
  //   house_rank_5: null,
  //   house_sub: null,
  // },
  // {
  //   id: "2",
  //   head_id: 20001,
  //   member_id_1: 30003,
  //   member_id_2: null,
  //   member_count: 2,
  //   house_rank_1: 1,
  //   house_rank_2: 2,
  //   house_rank_3: 18,
  //   house_rank_4: null,
  //   house_rank_5: null,
  //   house_sub: 20,
  // },
  // {
  //   id: "3",
  //   head_id: 20003,
  //   member_id_1: 30004,
  //   member_id_2: null,
  //   member_count: 2,
  //   house_rank_1: 3,
  //   house_rank_2: 1,
  //   house_rank_3: 20,
  //   house_rank_4: null,
  //   house_rank_5: null,
  //   house_sub: 21,
  // },
];

function weightedRandomPreference(maxPrefs) {
  const weights = { 1: 0.0125, 2: 0.0125, 3: 0.0125, 4: 0.0125, 5: 0.95 };
  const valid = Object.entries(weights).filter(
    ([rank]) => parseInt(rank) <= maxPrefs
  );
  const total = valid.reduce((sum, [_, w]) => sum + w, 0);
  let rnd = Math.random() * total,
    acc = 0;
  for (const [rankStr, w] of valid) {
    acc += w;
    if (rnd <= acc) return parseInt(rankStr);
  }
  return maxPrefs;
}

function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateRandomGroups(numGroups, numHouses, housesObj) {
  const houseIds = Array.from({ length: numHouses }, (_, i) => i + 1);

  const headIds = shuffle(
    Array.from({ length: numGroups }, (_, i) => 20000 + i + 1)
  );

  const usedMemberIds = new Set();
  const groups = [];
  let nextMemberId = 30001;

  for (let gid = 0; gid < numGroups; gid++) {
    const member_count = Math.floor(Math.random() * 3) + 1;
    const head_id = headIds[gid];

    // Generate up to 2 unique member IDs, not equal to head_id and not used elsewhere
    let member_id_1 = null,
      member_id_2 = null;
    if (member_count > 1) {
      while (usedMemberIds.has(nextMemberId) || nextMemberId === head_id)
        nextMemberId++;
      member_id_1 = nextMemberId;
      usedMemberIds.add(member_id_1);
      nextMemberId++;
    }
    if (member_count > 2) {
      while (
        usedMemberIds.has(nextMemberId) ||
        nextMemberId === head_id ||
        nextMemberId === member_id_1
      )
        nextMemberId++;
      member_id_2 = nextMemberId;
      usedMemberIds.add(member_id_2);
      nextMemberId++;
    }

    const prefs = shuffle(houseIds).slice(0, weightedRandomPreference(5));
    const xl2xlHouses = Object.entries(housesObj)
      .filter(([id, h]) => h.sizeName === "XL" || h.sizeName === "XXL")
      .map(([id]) => parseInt(id));
    const subPreference = shuffle(
      xl2xlHouses.filter((id) => !prefs.includes(id))
    ).slice(0, Math.random() < 0.7 ? 1 : 0);

    groups.push({
      id: gid + 1,
      head_id,
      member_id_1,
      member_id_2,
      member_count,
      house_rank_1: prefs[0] ?? null,
      house_rank_2: prefs[1] ?? null,
      house_rank_3: prefs[2] ?? null,
      house_rank_4: prefs[3] ?? null,
      house_rank_5: prefs[4] ?? null,
      house_sub: subPreference[0] ?? null,
    });
  }
  return groups;
}

function generateData(numGroups) {
  const housesArr = FIXED_HOUSES;
  const houses = {};
  for (let i = 0; i < housesArr.length; i++) {
    houses[i + 1] = housesArr[i];
  }
  const numHouses = Object.keys(houses).length;
  const groups = generateRandomGroups(numGroups, numHouses, houses);
  return { groups, houses };
}

function exportAllTablesToExcelTH(filename, data, resultVa, resultVb) {
  const wb = XLSX.utils.book_new();

  // Comparison Table
  const comparisonTable = document.getElementById("comparison-table");
  if (comparisonTable) {
    const ws1 = XLSX.utils.table_to_sheet(comparisonTable);
    XLSX.utils.book_append_sheet(wb, ws1, "ข้อมูลเปรียบเทียบ 2 Model");
  }

  // House Preference Table
  const housePrefTable = document.getElementById("house-pref-table");
  if (housePrefTable) {
    const ws2 = XLSX.utils.table_to_sheet(housePrefTable);
    XLSX.utils.book_append_sheet(wb, ws2, "ข้อมูลบ้านที่ได้");
  }

  // Houses Table
  const housesTable = document.getElementById("houses-table");
  if (housesTable) {
    const ws3 = XLSX.utils.table_to_sheet(housesTable);
    XLSX.utils.book_append_sheet(wb, ws3, "ข้อมูลบ้าน");
  }

  // Groups Table
  const groupsTable = document.getElementById("groups-table");
  if (groupsTable) {
    const ws4 = XLSX.utils.table_to_sheet(groupsTable);
    XLSX.utils.book_append_sheet(wb, ws4, "ข้อมูลกลุ่ม");
  }

  // House Picked Table
  const housePickedTable = document.getElementById("house-picked-table");
  if (housePickedTable) {
    const ws5 = XLSX.utils.table_to_sheet(housePickedTable);
    XLSX.utils.book_append_sheet(wb, ws5, "ข้อมูลบ้านที่เลือก");
  }

  // House Members Tables
  if (data && resultVa && resultVb) {
    const houseMembersVa = {};
    const houseMembersVb = {};
    for (const g of data.groups) {
      const va = resultVa[g.id];
      const vb = resultVb[g.id];
      if (va) {
        if (!houseMembersVa[va]) houseMembersVa[va] = [];
        houseMembersVa[va].push(g.head_id);
        if (g.member_id_1 != null) houseMembersVa[va].push(g.member_id_1);
        if (g.member_id_2 != null) houseMembersVa[va].push(g.member_id_2);
      }
      if (vb) {
        if (!houseMembersVb[vb]) houseMembersVb[vb] = [];
        houseMembersVb[vb].push(g.head_id);
        if (g.member_id_1 != null) houseMembersVb[vb].push(g.member_id_1);
        if (g.member_id_2 != null) houseMembersVb[vb].push(g.member_id_2);
      }
    }
    Object.entries(data.houses).forEach(([hid, h]) => {
      // Va
      const vaMembers = houseMembersVa[hid] || [];
      const vaRows = [["รหัส"]];
      vaMembers.forEach((mid) => vaRows.push([mid]));
      const vaSheet = XLSX.utils.aoa_to_sheet(vaRows);
      XLSX.utils.book_append_sheet(wb, vaSheet, `ข้อมูล${h.houseName}(Va)`);

      // Vb
      const vbMembers = houseMembersVb[hid] || [];
      const vbRows = [["รหัส"]];
      vbMembers.forEach((mid) => vbRows.push([mid]));
      const vbSheet = XLSX.utils.aoa_to_sheet(vbRows);
      XLSX.utils.book_append_sheet(wb, vbSheet, `ข้อมูล${h.houseName} (Vb)`);
    });
  }

  XLSX.writeFile(wb, filename);
}

export default function AssignPanel() {
  const [numGroups, setNumGroups] = useState(2000);
  const [data, setData] = useState(null);
  const [resultVa, setResultVa] = useState(null);
  const [resultVb, setResultVb] = useState(null);
  const [loadingVa, setLoadingVa] = useState(false);
  const [loadingVb, setLoadingVb] = useState(false);

  useEffect(() => {
    if (
      FIXED_GROUPS &&
      Array.isArray(FIXED_GROUPS) &&
      FIXED_GROUPS.length > 0
    ) {
      const housesArr = FIXED_HOUSES;
      const houses = {};
      for (let i = 0; i < housesArr.length; i++) {
        houses[i + 1] = housesArr[i];
      }
      // Map fixed groups to use member_id_1, member_id_2 directly
      const groups = FIXED_GROUPS.map((g, idx) => ({
        id: g.id ?? idx + 1,
        head_id: g.head_id,
        member_id_1: g.member_id_1 ?? null,
        member_id_2: g.member_id_2 ?? null,
        member_count: g.member_count,
        house_rank_1: g.house_rank_1,
        house_rank_2: g.house_rank_2,
        house_rank_3: g.house_rank_3,
        house_rank_4: g.house_rank_4,
        house_rank_5: g.house_rank_5,
        house_sub: g.house_sub,
      }));
      setData({ groups, houses });
    } else {
      setData(generateData(numGroups));
    }
    setResultVa(null);
    setResultVb(null);
  }, [numGroups]);

  if (!data) return <p>Loading...</p>;

  const totalGroupSize = data.groups.reduce(
    (sum, g) => sum + g.member_count,
    0
  );

  const totalHouseCapacity = Object.values(data.houses).reduce(
    (sum, h) => sum + h.capacity,
    0
  );

  const handleAssignVa = async () => {
    setLoadingVa(true);
    try {
      const res = await assignGroupsVa(data.groups, data.houses);
      setResultVa(res);
    } catch (error) {
      console.error("Va Assignment failed:", error);
      alert("Va Assignment failed. Please check the console for details.");
    } finally {
      setLoadingVa(false);
    }
  };

  const handleAssignVb = async () => {
    setLoadingVb(true);
    try {
      const res = await assignGroupsVb(data.groups, data.houses);
      setResultVb(res);
    } catch (error) {
      console.error("Vb Assignment failed:", error);
      alert("Vb Assignment failed. Please check the console for details.");
    } finally {
      setLoadingVb(false);
    }
  };

  const calculateHouseTotals = (result) => {
    const houseTotals = {};
    if (result) {
      for (const gid in result) {
        const hid = result[gid];
        const group = data.groups.find((g) => g.id === parseInt(gid));
        houseTotals[hid] = (houseTotals[hid] || 0) + (group?.member_count ?? 0);
      }
    }
    return houseTotals;
  };

  const houseTotalsVa = calculateHouseTotals(resultVa);
  const houseTotalsVb = calculateHouseTotals(resultVb);

  const houseSizeCount = {};
  Object.values(data.houses).forEach((house) => {
    houseSizeCount[house.sizeName] = (houseSizeCount[house.sizeName] || 0) + 1;
  });

  const calculatePercentage = (num, total) =>
    total ? ((num / total) * 100).toFixed(2) : "0.00%";

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", padding: "1rem" }}>
      <h2>Group Assignment Demo</h2>
      {FIXED_GROUPS.length == 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ marginRight: "1rem" }}>
            Number of Groups:
            <input
              type="number"
              min={1}
              max={4000}
              value={numGroups}
              onChange={(e) => setNumGroups(+e.target.value)}
            />
          </label>
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <button
          onClick={handleAssignVa}
          disabled={loadingVa}
          style={loadingVa ? secondaryButtonStyle : buttonStyle}
        >
          {loadingVa ? "Assigning Va..." : "Assign Groups Va"}
        </button>
        <button
          onClick={handleAssignVb}
          disabled={loadingVb}
          style={loadingVb ? secondaryButtonStyle : buttonStyle}
        >
          {loadingVb ? "Assigning Vb..." : "Assign Groups Vb"}
        </button>
        {FIXED_GROUPS.length == 0 && (
          <button
            onClick={() => {
              setData(generateData(numGroups));
              setResultVa(null);
              setResultVb(null);
            }}
            disabled={loadingVa || loadingVb}
            style={
              loadingVa || loadingVb
                ? secondaryButtonStyle
                : { ...buttonStyle, backgroundColor: "#6c757d" }
            }
          >
            Regenerate Data
          </button>
        )}
        {resultVa && resultVb && (
          <>
            <button
              style={{ ...buttonStyle, backgroundColor: "#28a745" }}
              onClick={() =>
                exportAllTablesToExcelTH(
                  "RPKM68-Result.xlsx",
                  data,
                  resultVa,
                  resultVb
                )
              }
            >
              Export All Tables
            </button>
          </>
        )}
      </div>

      <p>Total Group Members: {totalGroupSize}</p>
      <p>Total House Capacity: {totalHouseCapacity}</p>

      {(resultVa || resultVb) && (
        <>
          <h3>เปรียบเทียบสรุปผล</h3>
          <table style={tableStyle} id="comparison-table">
            <thead>
              <tr>
                <th style={headerStyle}>ลำดับที่ได้</th>
                <th style={headerStyle}>จำนวน (Va)</th>
                <th style={headerStyle}>เปอร์เซ็นต์ (Va)</th>
                <th style={headerStyle}>จำนวน (Vb)</th>
                <th style={headerStyle}>เปอร์เซ็นต์ (Vb)</th>
                <th style={headerStyle}>ผลต่าง</th>
              </tr>
            </thead>
            <tbody>
              {[
                "rank1",
                "rank2",
                "rank3",
                "rank4",
                "rank5",
                "subPref",
                "unranked",
              ].map((key, i) => {
                const countPeople = (result, rankKey) => {
                  let count = 0;
                  for (const group of data.groups) {
                    const assigned = result?.[group.id];
                    if (!assigned) continue;
                    if (rankKey === "rank1" && group.house_rank_1 === assigned)
                      count += group.member_count;
                    else if (
                      rankKey === "rank2" &&
                      group.house_rank_2 === assigned
                    )
                      count += group.member_count;
                    else if (
                      rankKey === "rank3" &&
                      group.house_rank_3 === assigned
                    )
                      count += group.member_count;
                    else if (
                      rankKey === "rank4" &&
                      group.house_rank_4 === assigned
                    )
                      count += group.member_count;
                    else if (
                      rankKey === "rank5" &&
                      group.house_rank_5 === assigned
                    )
                      count += group.member_count;
                    else if (
                      rankKey === "subPref" &&
                      group.house_sub === assigned &&
                      ![
                        group.house_rank_1,
                        group.house_rank_2,
                        group.house_rank_3,
                        group.house_rank_4,
                        group.house_rank_5,
                      ].includes(assigned)
                    )
                      count += group.member_count;
                    else if (
                      rankKey === "unranked" &&
                      ![
                        group.house_rank_1,
                        group.house_rank_2,
                        group.house_rank_3,
                        group.house_rank_4,
                        group.house_rank_5,
                        group.house_sub,
                      ].includes(assigned)
                    )
                      count += group.member_count;
                  }
                  return count;
                };
                const totalMembers = data.groups.reduce(
                  (sum, g) => sum + g.member_count,
                  0
                );
                const VaCount = resultVa ? countPeople(resultVa, key) : 0;
                const VbCount = resultVb ? countPeople(resultVb, key) : 0;
                const diff = VbCount - VaCount;
                const percent = (n) =>
                  totalMembers > 0
                    ? `${((n / totalMembers) * 100).toFixed(2)}%`
                    : "0.00%";
                return (
                  <tr key={key}>
                    <td style={thTdStyle}>
                      {key === "unranked"
                        ? "นอกลำดับ"
                        : key === "subPref"
                        ? "Sub Preference"
                        : `อันดับ ${i + 1}`}
                    </td>
                    <td style={thTdStyle}>{resultVa ? VaCount : "-"}</td>
                    <td style={thTdStyle}>
                      {resultVa ? percent(VaCount) : "-"}
                    </td>
                    <td style={thTdStyle}>{resultVb ? VbCount : "-"}</td>
                    <td style={thTdStyle}>
                      {resultVb ? percent(VbCount) : "-"}
                    </td>
                    <td
                      style={{
                        ...thTdStyle,
                        backgroundColor:
                          resultVa && resultVb
                            ? diff > 0
                              ? "#d4edda"
                              : diff < 0
                              ? "#f8d7da"
                              : "#fff3cd"
                            : "transparent",
                        fontWeight: diff !== 0 ? "bold" : "normal",
                      }}
                    >
                      {resultVa && resultVb
                        ? diff >= 0
                          ? `+${diff}`
                          : `${diff}`
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h3>สถิติการเลือกบ้าน (จำนวนน้องที่ได้บ้านในแต่ละอันดับ)</h3>
          <table style={tableStyle} id="house-pref-table">
            <thead>
              <tr>
                <th style={headerStyle}>ลำดับ</th>
                <th style={headerStyle}>ชื่อบ้าน</th>
                <th style={headerStyle}>ไซส์</th>
                <th style={headerStyle}>ความจุ</th>
                <th style={headerStyle}>Va อันดับ 1</th>
                <th style={headerStyle}>Va อันดับ 2</th>
                <th style={headerStyle}>Va อันดับ 3</th>
                <th style={headerStyle}>Va อันดับ 4</th>
                <th style={headerStyle}>Va อันดับ 5</th>
                <th style={headerStyle}>Va สำรอง</th>
                <th style={headerStyle}>Vb อันดับ 1</th>
                <th style={headerStyle}>Vb อันดับ 2</th>
                <th style={headerStyle}>Vb อันดับ 3</th>
                <th style={headerStyle}>Vb อันดับ 4</th>
                <th style={headerStyle}>Vb อันดับ 5</th>
                <th style={headerStyle}>Vb สำรอง</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.houses).map(([hid, h], idx) => {
                const countRank = (result, rank) => {
                  let count = 0;
                  for (const group of data.groups) {
                    const assigned = result?.[group.id];
                    if (parseInt(assigned) === parseInt(hid)) {
                      if (rank === "sub") {
                        if (
                          group.house_sub === assigned &&
                          ![
                            group.house_rank_1,
                            group.house_rank_2,
                            group.house_rank_3,
                            group.house_rank_4,
                            group.house_rank_5,
                          ].includes(assigned)
                        )
                          count += group.member_count;
                      } else {
                        const ranks = [
                          group.house_rank_1,
                          group.house_rank_2,
                          group.house_rank_3,
                          group.house_rank_4,
                          group.house_rank_5,
                        ];
                        if (ranks[rank] === assigned)
                          count += group.member_count;
                      }
                    }
                  }
                  return count;
                };

                const percentByCap = (n) =>
                  h.capacity > 0
                    ? ` (${((n / h.capacity) * 100).toFixed(2)}%)`
                    : "";

                // Va
                const vaRank1 = countRank(resultVa, 0);
                const vaRank2 = countRank(resultVa, 1);
                const vaRank3 = countRank(resultVa, 2);
                const vaRank4 = countRank(resultVa, 3);
                const vaRank5 = countRank(resultVa, 4);
                const vaSub = countRank(resultVa, "sub");
                // Vb
                const vbRank1 = countRank(resultVb, 0);
                const vbRank2 = countRank(resultVb, 1);
                const vbRank3 = countRank(resultVb, 2);
                const vbRank4 = countRank(resultVb, 3);
                const vbRank5 = countRank(resultVb, 4);
                const vbSub = countRank(resultVb, "sub");

                return (
                  <tr key={hid}>
                    <td style={thTdStyle}>{idx + 1}</td>
                    <td style={thTdStyle}>{h.houseName}</td>
                    <td style={thTdStyle}>{h.sizeName}</td>
                    <td style={thTdStyle}>{h.capacity}</td>
                    <td style={thTdStyle}>
                      {vaRank1}
                      {percentByCap(vaRank1)}
                    </td>
                    <td style={thTdStyle}>
                      {vaRank2}
                      {percentByCap(vaRank2)}
                    </td>
                    <td style={thTdStyle}>
                      {vaRank3}
                      {percentByCap(vaRank3)}
                    </td>
                    <td style={thTdStyle}>
                      {vaRank4}
                      {percentByCap(vaRank4)}
                    </td>
                    <td style={thTdStyle}>
                      {vaRank5}
                      {percentByCap(vaRank5)}
                    </td>
                    <td style={thTdStyle}>
                      {vaSub}
                      {percentByCap(vaSub)}
                    </td>
                    <td style={thTdStyle}>
                      {vbRank1}
                      {percentByCap(vbRank1)}
                    </td>
                    <td style={thTdStyle}>
                      {vbRank2}
                      {percentByCap(vbRank2)}
                    </td>
                    <td style={thTdStyle}>
                      {vbRank3}
                      {percentByCap(vbRank3)}
                    </td>
                    <td style={thTdStyle}>
                      {vbRank4}
                      {percentByCap(vbRank4)}
                    </td>
                    <td style={thTdStyle}>
                      {vbRank5}
                      {percentByCap(vbRank5)}
                    </td>
                    <td style={thTdStyle}>
                      {vbSub}
                      {percentByCap(vbSub)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <h3>สถิติการเลือกบ้าน (จำนวนน้องที่เลือกแต่ละบ้านในแต่ละอันดับ)</h3>
      <table style={tableStyle} id="house-picked-table">
        <thead>
          <tr>
            <th style={headerStyle}>ลำดับ</th>
            <th style={headerStyle}>ชื่อบ้าน</th>
            <th style={headerStyle}>เลือกอันดับ 1</th>
            <th style={headerStyle}>เลือกอันดับ 2</th>
            <th style={headerStyle}>เลือกอันดับ 3</th>
            <th style={headerStyle}>เลือกอันดับ 4</th>
            <th style={headerStyle}>เลือกอันดับ 5</th>
            <th style={headerStyle}>เลือกสำรอง</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.houses).map(([hid, h], idx) => {
            const pickedRank = (rank) =>
              data.groups.reduce(
                (sum, g) =>
                  g[`house_rank_${rank}`] &&
                  parseInt(g[`house_rank_${rank}`]) === parseInt(hid)
                    ? sum + (g.member_count || 0)
                    : sum,
                0
              );
            const pickedSub = data.groups.reduce(
              (sum, g) =>
                g.house_sub && parseInt(g.house_sub) === parseInt(hid)
                  ? sum + (g.member_count || 0)
                  : sum,
              0
            );
            return (
              <tr key={hid}>
                <td style={thTdStyle}>{idx + 1}</td>
                <td style={thTdStyle}>{h.houseName}</td>
                <td style={thTdStyle}>{pickedRank(1)}</td>
                <td style={thTdStyle}>{pickedRank(2)}</td>
                <td style={thTdStyle}>{pickedRank(3)}</td>
                <td style={thTdStyle}>{pickedRank(4)}</td>
                <td style={thTdStyle}>{pickedRank(5)}</td>
                <td style={thTdStyle}>{pickedSub}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3>เปรียบเทียบบ้าน</h3>
      <table style={tableStyle} id="houses-table">
        <thead>
          <tr>
            <th style={headerStyle}>รหัสบ้าน</th>
            <th style={headerStyle}>ชื่อบ้าน</th>
            <th style={headerStyle}>ไซส์</th>
            <th style={headerStyle}>ความจุ</th>
            <th style={headerStyle}>Va ได้รับ</th>
            <th style={headerStyle}>เปอร์เซ็นต์ (Va)</th>
            <th style={headerStyle}>Vb ได้รับ</th>
            <th style={headerStyle}>เปอร์เซ็นต์ (Vb)</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.houses).map(([hid, h], idx) => (
            <tr key={hid}>
              <td style={thTdStyle}>{hid}</td>
              <td style={thTdStyle}>{h.houseName}</td>
              <td style={thTdStyle}>{h.sizeName}</td>
              <td style={thTdStyle}>{h.capacity}</td>
              <td style={thTdStyle}>
                {resultVa ? houseTotalsVa[hid] ?? 0 : "-"}
              </td>
              <td style={thTdStyle}>
                {resultVa
                  ? `${calculatePercentage(
                      houseTotalsVa[hid] ?? 0,
                      h.capacity
                    )}%`
                  : "-"}
              </td>
              <td style={thTdStyle}>
                {resultVb ? houseTotalsVb[hid] ?? 0 : "-"}
              </td>
              <td style={thTdStyle}>
                {resultVb
                  ? `${calculatePercentage(
                      houseTotalsVb[hid] ?? 0,
                      h.capacity
                    )}%`
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>ผลการจัดกลุ่ม</h3>
      <table style={tableStyle} id="groups-table">
        <thead>
          <tr>
            <th style={headerStyle}>รหัสกลุ่ม</th>
            <th style={headerStyle}>รหัสหัวหน้า</th>
            <th style={headerStyle}>รหัสสมาชิก 1</th>
            <th style={headerStyle}>รหัสสมาชิก 2</th>
            <th style={headerStyle}>จำนวน (คน)</th>
            <th style={headerStyle}>อันดับ 1</th>
            <th style={headerStyle}>อันดับ 2</th>
            <th style={headerStyle}>อันดับ 3</th>
            <th style={headerStyle}>อันดับ 4</th>
            <th style={headerStyle}>อันดับ 5</th>
            <th style={headerStyle}>สำรอง</th>
            <th style={headerStyle}>รหัสบ้าน (Va)</th>
            <th style={headerStyle}>ชื่อบ้าน (Va)</th>
            <th style={headerStyle}>ลำดับที่ได้ (Va)</th>
            <th style={headerStyle}>รหัสบ้าน (Vb)</th>
            <th style={headerStyle}>ชื่อบ้าน (Vb)</th>
            <th style={headerStyle}>ลำดับที่ได้ (Vb)</th>
          </tr>
        </thead>
        <tbody>
          {data.groups.map((g) => {
            const assignedVa = resultVa?.[g.id];
            const assignedVb = resultVb?.[g.id];
            const ranks = [
              g.house_rank_1,
              g.house_rank_2,
              g.house_rank_3,
              g.house_rank_4,
              g.house_rank_5,
            ];
            const indexVa = assignedVa ? ranks.indexOf(assignedVa) : -1;
            const indexVb = assignedVb ? ranks.indexOf(assignedVb) : -1;
            const isSubPrefVa =
              assignedVa &&
              g.house_sub === assignedVa &&
              !ranks.includes(assignedVa);
            const isSubPrefVb =
              assignedVb &&
              g.house_sub === assignedVb &&
              !ranks.includes(assignedVb);

            const getCellStyle = (index, isSubPref) => ({
              textAlign: "center",
              backgroundColor:
                index >= 0 ? "#d4edda" : isSubPref ? "#fff3cd" : "#f8d7da",
            });

            const getHouseDisplay = (assigned, index, isSubPref) => {
              if (!assigned) return "-";
              const houseName = data.houses[assigned]?.houseName || assigned;
              return houseName;
            };

            const getRankDisplay = (index, isSubPref, assigned) => {
              if (!assigned) return "-";
              if (index >= 0) return `${index + 1}`;
              if (isSubPref) return "Sub";
              return "นอกลำดับ";
            };

            return (
              <tr key={g.id}>
                <td style={thTdStyle}>{g.id}</td>
                <td style={thTdStyle}>{g.head_id}</td>
                <td style={thTdStyle}>{g.member_id_1 ?? "-"}</td>
                <td style={thTdStyle}>{g.member_id_2 ?? "-"}</td>
                <td style={thTdStyle}>{g.member_count}</td>
                <td style={thTdStyle}>{g.house_rank_1 ?? "-"}</td>
                <td style={thTdStyle}>{g.house_rank_2 ?? "-"}</td>
                <td style={thTdStyle}>{g.house_rank_3 ?? "-"}</td>
                <td style={thTdStyle}>{g.house_rank_4 ?? "-"}</td>
                <td style={thTdStyle}>{g.house_rank_5 ?? "-"}</td>
                <td style={thTdStyle}>{g.house_sub ?? "-"}</td>
                <td
                  style={
                    assignedVa ? getCellStyle(indexVa, isSubPrefVa) : thTdStyle
                  }
                >
                  {assignedVa ?? "-"}
                </td>
                <td
                  style={
                    assignedVa ? getCellStyle(indexVa, isSubPrefVa) : thTdStyle
                  }
                >
                  {getHouseDisplay(assignedVa, indexVa, isSubPrefVa)}
                </td>
                <td
                  style={
                    assignedVa ? getCellStyle(indexVa, isSubPrefVa) : thTdStyle
                  }
                >
                  {getRankDisplay(indexVa, isSubPrefVa, assignedVa)}
                </td>
                <td
                  style={
                    assignedVb ? getCellStyle(indexVb, isSubPrefVb) : thTdStyle
                  }
                >
                  {assignedVb ?? "-"}
                </td>
                <td
                  style={
                    assignedVb ? getCellStyle(indexVb, isSubPrefVb) : thTdStyle
                  }
                >
                  {getHouseDisplay(assignedVb, indexVb, isSubPrefVb)}
                </td>
                <td
                  style={
                    assignedVb ? getCellStyle(indexVb, isSubPrefVb) : thTdStyle
                  }
                >
                  {getRankDisplay(indexVb, isSubPrefVb, assignedVb)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  marginBottom: "2rem",
  fontSize: "14px",
  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
  borderRadius: "8px",
  overflow: "hidden",
  backgroundColor: "#ffffff",
};

const thTdStyle = {
  padding: "12px 16px",
  borderBottom: "1px solid #e0e0e0",
  textAlign: "center",
  color: "#444",
};

const headerStyle = {
  ...thTdStyle,
  backgroundColor: "#f5f5f5",
  fontWeight: "600",
  color: "#222",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const buttonStyle = {
  padding: "8px 16px",
  backgroundColor: "#007bff",
  color: "#fff",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "500",
  marginRight: "0.5rem",
};

const secondaryButtonStyle = {
  ...buttonStyle,
  backgroundColor: "#6c757d",
  cursor: "default",
};
