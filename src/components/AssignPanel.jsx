import { useEffect, useState } from "react";
import { assignGroupsVa, assignGroupsVb } from "../lib/api";
import * as XLSX from "xlsx";

function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const HOUSE_NAMES = [
  "บ้านอะอึ๋ม",
  "บ้านสด",
  "บ้านโจ๋",
  "บ้านโบ้",
  "บ้านดัง",
  "บ้านคุณหนู",
  "บ้านเดอะ",
  "บ้านจิ๊จ๊ะ",
  "บ้านคุ้ม",
  "บ้านนอก",
  "บ้านโจ๊ะเด๊ะ ฮือซา",
  "บ้านว้อนท์",
  "บ้านแจ๋ว",
  "บ้านแรงส์",
  "บ้านเฮา",
  "บ้านเอช้วน",
  "บ้านคิดส์",
  "บ้านอากาเป้",
  "บ้านโคะ",
  "บ้านโซ้ยตี๋หลีหมวย",
  "บ้านยิ้ม",
  "บ้านหลายใจ",
];

// ฟังก์ชันสุ่มชื่อโดยไม่ซ้ำ
function getRandomNames(num, nameList) {
  const arr = shuffle(nameList);
  return arr.slice(0, num);
}

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

function generateDivisibleRandomFast(min, max, divisor) {
  const start = Math.ceil(min / divisor);
  const end = Math.floor(max / divisor);
  const count = end - start + 1;
  if (count <= 0) return divisor;
  const rand = Math.floor(Math.random() * count);
  return (start + rand) * divisor;
}

// ฟังก์ชันสุ่มบ้าน
function generateRandomHouses(numHouses) {
  const sizeCategories = [
    { name: "S", range: [140, 160], divisor: 3 },
    { name: "M", range: [220, 260], divisor: 3 },
    { name: "L", range: [300, 360], divisor: 3 },
    { name: "XL", range: [500, 600], divisor: 3 },
    { name: "2XL", range: [900, 1100], divisor: 4 },
  ];

  const sizeDistribution = [
    ...Array(10).fill(sizeCategories.find((s) => s.name === "S")),
    ...Array(3).fill(sizeCategories.find((s) => s.name === "M")),
    ...Array(4).fill(sizeCategories.find((s) => s.name === "L")),
    ...Array(3).fill(sizeCategories.find((s) => s.name === "XL")),
    ...Array(2).fill(sizeCategories.find((s) => s.name === "2XL")),
  ];

  if (numHouses !== sizeDistribution.length) {
    throw new Error("จำนวนบ้านไม่ตรงกับการกระจายขนาดที่ระบุ");
  }

  const houseNames = getRandomNames(numHouses, HOUSE_NAMES);

  const rawHouseList = [];
  for (let i = 0; i < numHouses; i++) {
    const selected = sizeDistribution[i];
    const { range, divisor } = selected;
    // ใช้ capacity เดียว ไม่ต้อง min/max
    const capacity = generateDivisibleRandomFast(range[0], range[1], divisor);
    rawHouseList.push({
      houseName: houseNames[i],
      sizeName: selected.name,
      range: range,
      divisor,
      capacity,
    });
  }
  return rawHouseList;
}

// ฟังก์ชันสุ่มกลุ่ม
function generateRandomGroups(numGroups, numHouses, rawHouseList) {
  const numSubPreference = 1;
  const houseIds = Array.from({ length: numHouses }, (_, i) => i + 1);

  // สร้าง id ที่ไม่ซ้ำกัน
  const groupIds = shuffle(
    Array.from({ length: numGroups }, (_, i) => 10000 + i + 1)
  );
  const headIds = shuffle(
    Array.from({ length: numGroups }, (_, i) => 20000 + i + 1)
  );
  let memberIdCounter = 30000;

  const groups = [];
  for (let gid = 0; gid < numGroups; gid++) {
    const size = Math.floor(Math.random() * 3) + 1;
    const prefs = shuffle(houseIds).slice(0, weightedRandomPreference(5));
    const xl2xlHouses = rawHouseList
      .map((h, idx) => ({ id: idx + 1, sizeName: h.sizeName }))
      .filter((h) => h.sizeName === "XL" || h.sizeName === "2XL")
      .map((h) => h.id);
    const subPreference = shuffle(
      xl2xlHouses.filter((id) => !prefs.includes(id))
    ).slice(0, numSubPreference);

    // กลุ่มต้องมี head_id เสมอ, member_ids อาจมี 0, 1 หรือ 2 คน (สุ่ม)
    const numMembers = Math.floor(Math.random() * 3);
    const member_ids = [];
    for (let m = 0; m < numMembers; m++) {
      member_ids.push(memberIdCounter++);
    }

    groups.push({
      id: gid + 1,
      group_id: groupIds[gid],
      head_id: headIds[gid],
      member_ids,
      size,
      preference: prefs,
      subPreference,
    });
  }
  return groups;
}

function generateData(numGroups, numHouses) {
  // สุ่มบ้าน
  const rawHouseList = generateRandomHouses(numHouses);

  // สุ่มกลุ่ม
  const groups = generateRandomGroups(numGroups, numHouses, rawHouseList);

  // ปรับ max/min ของบ้านให้รองรับจำนวนสมาชิกกลุ่ม
  const totalMembers = groups.reduce((sum, g) => sum + g.size, 0);
  let totalMax = rawHouseList.reduce((sum, h) => sum + h.max, 0);
  let iteration = 0;
  const maxIterations = rawHouseList.length * 20;

  while (totalMax < totalMembers && iteration < maxIterations) {
    const h = rawHouseList[iteration % rawHouseList.length];
    const newMax = h.capacity + h.divisor;
    if (newMax <= h.range[1]) {
      totalMax += h.divisor;
      h.capacity = newMax;
    }
    iteration++;
  }

  const houses = {};
  rawHouseList.forEach((h, idx) => {
    houses[idx + 1] = {
      capacity: h.capacity,
      sizeName: h.sizeName,
      houseName: h.houseName,
    };
  });

  return { groups, houses };
}

// --- Export to Excel helper ---
function exportTableToExcel(tableId, tableName, filename) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const wb = XLSX.utils.table_to_book(table, { sheet: "Sheet1" });
  XLSX.writeFile(wb, filename);
}

// --- Export all tables to a single Excel file ---
function exportAllTablesToExcel(filename, data, resultVa, resultVb) {
  const wb = XLSX.utils.book_new();

  // Summary Table
  const summaryTable = document.getElementById("summary-table");
  if (summaryTable) {
    const ws1 = XLSX.utils.table_to_sheet(summaryTable);
    XLSX.utils.book_append_sheet(wb, ws1, "Summary");
  }

  // House Preference Table
  const housePrefTable = document.getElementById("house-pref-table");
  if (housePrefTable) {
    const ws2 = XLSX.utils.table_to_sheet(housePrefTable);
    XLSX.utils.book_append_sheet(wb, ws2, "House Preference");
  }

  // Houses Table
  const housesTable = document.getElementById("houses-table");
  if (housesTable) {
    const ws3 = XLSX.utils.table_to_sheet(housesTable);
    XLSX.utils.book_append_sheet(wb, ws3, "Houses");
  }

  // Groups Table
  const groupsTable = document.getElementById("groups-table");
  if (groupsTable) {
    const ws4 = XLSX.utils.table_to_sheet(groupsTable);
    XLSX.utils.book_append_sheet(wb, ws4, "Groups");
  }

  // --- Add House Members Sheets
  if (data && resultVa && resultVb) {
    // Collect group IDs for each house for Va and Vb
    const houseMembersVa = {};
    const houseMembersVb = {};
    for (const g of data.groups) {
      const va = resultVa[g.id];
      const vb = resultVb[g.id];
      if (va) {
        if (!houseMembersVa[va]) houseMembersVa[va] = [];
        houseMembersVa[va].push(...[g.head_id, ...(g.member_ids || [])]);
      }
      if (vb) {
        if (!houseMembersVb[vb]) houseMembersVb[vb] = [];
        houseMembersVb[vb].push(...[g.head_id, ...(g.member_ids || [])]);
      }
    }
    // For each house, create a sheet for Va and Vb
    Object.entries(data.houses).forEach(([hid, h]) => {
      // Va
      const vaMembers = houseMembersVa[hid] || [];
      const vaRows = [["Member IDs"]];
      vaMembers.forEach((mid) => vaRows.push([mid]));
      const vaSheet = XLSX.utils.aoa_to_sheet(vaRows);
      XLSX.utils.book_append_sheet(wb, vaSheet, `${h.houseName} (Va)`);

      // Vb
      const vbMembers = houseMembersVb[hid] || [];
      const vbRows = [["Member IDs"]];
      vbMembers.forEach((mid) => vbRows.push([mid]));
      const vbSheet = XLSX.utils.aoa_to_sheet(vbRows);
      XLSX.utils.book_append_sheet(wb, vbSheet, `${h.houseName} (Vb)`);
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

  const numHouses = 22;

  useEffect(() => {
    setData(generateData(numGroups, numHouses));
    setResultVa(null);
    setResultVb(null);
  }, [numGroups, numHouses]);

  if (!data) return <p>Loading...</p>;

  const totalGroupSize = data.groups.reduce((sum, g) => sum + g.size, 0);

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
        houseTotals[hid] = (houseTotals[hid] || 0) + (group?.size ?? 0);
      }
    }
    return houseTotals;
  };

  const houseTotalsVa = calculateHouseTotals(resultVa);
  const houseTotalsVb = calculateHouseTotals(resultVb);

  const calculateSummary = (result) => {
    const summary = {
      rank1: 0,
      rank2: 0,
      rank3: 0,
      rank4: 0,
      rank5: 0,
      subPref: 0,
      unranked: 0,
    };

    if (result) {
      for (const group of data.groups) {
        const assigned = result[group.id];
        const index = group.preference.indexOf(assigned);
        if (index === 0) summary.rank1++;
        else if (index === 1) summary.rank2++;
        else if (index === 2) summary.rank3++;
        else if (index === 3) summary.rank4++;
        else if (index === 4) summary.rank5++;
        else if (group.subPreference.includes(assigned)) summary.subPref++;
        else summary.unranked++;
      }
    }
    return summary;
  };

  const houseSizeCount = {};
  Object.values(data.houses).forEach((house) => {
    houseSizeCount[house.sizeName] = (houseSizeCount[house.sizeName] || 0) + 1;
  });

  const calculatePercentage = (num, total) =>
    total ? ((num / total) * 100).toFixed(2) : "0.00";

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", padding: "1rem" }}>
      <h2>Group Assignment Demo</h2>
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
        <button
          onClick={() => {
            setData(generateData(numGroups, numHouses));
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
        {resultVa && resultVb && (
          <button
            style={buttonStyle}
            onClick={() =>
              exportAllTablesToExcel(
                "group-results.xlsx",
                data,
                resultVa,
                resultVb
              )
            }
          >
            Export All Tables (Excel)
          </button>
        )}
      </div>

      <p>Total Group Members: {totalGroupSize}</p>
      <p>Total House Capacity: {totalHouseCapacity}</p>

      {(resultVa || resultVb) && (
        <>
          <h3>Summary Comparison</h3>

          <table style={tableStyle} id="summary-table">
            <thead>
              <tr>
                <th style={headerStyle}>Rank</th>
                <th style={headerStyle}>Va Count</th>
                <th style={headerStyle}>Va %</th>
                <th style={headerStyle}>Vb Count</th>
                <th style={headerStyle}>Vb %</th>
                <th style={headerStyle}>Difference</th>
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
                // นับจำนวน "คน" ที่ได้แต่ละอันดับ
                const countPeople = (result, rankKey) => {
                  let count = 0;
                  for (const group of data.groups) {
                    const assigned = result?.[group.id];
                    if (!assigned) continue;
                    const idx = group.preference.indexOf(assigned);
                    if (rankKey === "rank1" && idx === 0) count += group.size;
                    else if (rankKey === "rank2" && idx === 1)
                      count += group.size;
                    else if (rankKey === "rank3" && idx === 2)
                      count += group.size;
                    else if (rankKey === "rank4" && idx === 3)
                      count += group.size;
                    else if (rankKey === "rank5" && idx === 4)
                      count += group.size;
                    else if (
                      rankKey === "subPref" &&
                      group.subPreference.includes(assigned) &&
                      !group.preference.includes(assigned)
                    )
                      count += group.size;
                    else if (
                      rankKey === "unranked" &&
                      idx === -1 &&
                      !group.subPreference.includes(assigned)
                    )
                      count += group.size;
                  }
                  return count;
                };
                const totalMembers = data.groups.reduce(
                  (sum, g) => sum + g.size,
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

          <h3>House Preference Ranking Distribution</h3>
          <table style={tableStyle} id="house-pref-table">
            <thead>
              <tr>
                <th style={headerStyle}>#</th>
                <th style={headerStyle}>House Name</th>
                <th style={headerStyle}>Va Rank 1</th>
                <th style={headerStyle}>Va Rank 2</th>
                <th style={headerStyle}>Va Rank 3</th>
                <th style={headerStyle}>Va Rank 4</th>
                <th style={headerStyle}>Va Rank 5</th>
                <th style={headerStyle}>Va Sub</th>
                <th style={headerStyle}>Vb Rank 1</th>
                <th style={headerStyle}>Vb Rank 2</th>
                <th style={headerStyle}>Vb Rank 3</th>
                <th style={headerStyle}>Vb Rank 4</th>
                <th style={headerStyle}>Vb Rank 5</th>
                <th style={headerStyle}>Vb Sub</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.houses).map(([hid, h], idx) => {
                const totalMembers = data.groups.reduce(
                  (sum, g) => sum + g.size,
                  0
                );
                // นับจำนวน "คน" ที่ได้รับบ้านนี้ในแต่ละอันดับ (จากผลลัพธ์ Va/Vb)
                const countRank = (result, rank) => {
                  let count = 0;
                  for (const group of data.groups) {
                    const assigned = result?.[group.id];
                    if (assigned === parseInt(hid)) {
                      if (rank === "sub") {
                        if (
                          group.subPreference.includes(assigned) &&
                          !group.preference.includes(assigned)
                        )
                          count += group.size;
                      } else {
                        const idx = group.preference.indexOf(assigned);
                        if (idx === rank) count += group.size;
                      }
                    }
                  }
                  return count;
                };
                const percent = (n) =>
                  totalMembers > 0
                    ? ` (${((n / totalMembers) * 100).toFixed(2)}%)`
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
                    <td style={thTdStyle}>
                      {vaRank1}
                      {percent(vaRank1)}
                    </td>
                    <td style={thTdStyle}>
                      {vaRank2}
                      {percent(vaRank2)}
                    </td>
                    <td style={thTdStyle}>
                      {vaRank3}
                      {percent(vaRank3)}
                    </td>
                    <td style={thTdStyle}>
                      {vaRank4}
                      {percent(vaRank4)}
                    </td>
                    <td style={thTdStyle}>
                      {vaRank5}
                      {percent(vaRank5)}
                    </td>
                    <td style={thTdStyle}>
                      {vaSub}
                      {percent(vaSub)}
                    </td>
                    <td style={thTdStyle}>
                      {vbRank1}
                      {percent(vbRank1)}
                    </td>
                    <td style={thTdStyle}>
                      {vbRank2}
                      {percent(vbRank2)}
                    </td>
                    <td style={thTdStyle}>
                      {vbRank3}
                      {percent(vbRank3)}
                    </td>
                    <td style={thTdStyle}>
                      {vbRank4}
                      {percent(vbRank4)}
                    </td>
                    <td style={thTdStyle}>
                      {vbRank5}
                      {percent(vbRank5)}
                    </td>
                    <td style={thTdStyle}>
                      {vbSub}
                      {percent(vbSub)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <h3>Houses Comparison</h3>
      <table style={tableStyle} id="houses-table">
        <thead>
          <tr>
            <th style={headerStyle}>ID</th>
            <th style={headerStyle}>Name</th>
            <th style={headerStyle}>Size</th>
            <th style={headerStyle}>Capacity</th>
            <th style={headerStyle}>Va Assigned</th>
            <th style={headerStyle}>Va Used %</th>
            <th style={headerStyle}>Vb Assigned</th>
            <th style={headerStyle}>Vb Used %</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.houses).map(([hid, h]) => (
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

      <h3>Groups Assignment Results</h3>
      <table style={tableStyle} id="groups-table">
        <thead>
          <tr>
            <th style={headerStyle}>ID</th>
            <th style={headerStyle}>Group ID</th>
            <th style={headerStyle}>Head ID</th>
            <th style={headerStyle}>Member 1 ID</th>
            <th style={headerStyle}>Member 2 ID</th>
            <th style={headerStyle}>Size</th>
            <th style={headerStyle}>Pref 1</th>
            <th style={headerStyle}>Pref 2</th>
            <th style={headerStyle}>Pref 3</th>
            <th style={headerStyle}>Pref 4</th>
            <th style={headerStyle}>Pref 5</th>
            <th style={headerStyle}>Sub Pref</th>
            <th style={headerStyle}>Va House ID</th>
            <th style={headerStyle}>Va Assigned</th>
            <th style={headerStyle}>Vb House ID</th>
            <th style={headerStyle}>Vb Assigned</th>
          </tr>
        </thead>
        <tbody>
          {data.groups.map((g) => {
            const assignedVa = resultVa?.[g.id];
            const assignedVb = resultVb?.[g.id];
            const indexVa = assignedVa ? g.preference.indexOf(assignedVa) : -1;
            const indexVb = assignedVb ? g.preference.indexOf(assignedVb) : -1;
            const isSubPrefVa = assignedVa
              ? g.subPreference.includes(assignedVa)
              : false;
            const isSubPrefVb = assignedVb
              ? g.subPreference.includes(assignedVb)
              : false;

            const getCellStyle = (index, isSubPref) => ({
              textAlign: "center",
              backgroundColor:
                index >= 0 ? "#d4edda" : isSubPref ? "#fff3cd" : "#f8d7da",
            });

            // แสดงชื่อบ้านที่ได้พร้อมอันดับที่ได้
            const getAssignedDisplay = (assigned, index, isSubPref) => {
              if (!assigned) return "-";
              const houseName = data.houses[assigned]?.houseName || assigned;
              if (index >= 0) return `${houseName} (อันดับ ${index + 1})`;
              if (isSubPref) return `${houseName} (Sub)`;
              return `${houseName} (นอกลำดับ)`;
            };

            // แยก Prefs เป็น 5 คอลัมน์
            const prefCols = [];
            for (let i = 0; i < 5; i++) {
              prefCols.push(
                <td style={thTdStyle} key={i}>
                  {g.preference[i] !== undefined ? g.preference[i] : "-"}
                </td>
              );
            }

            return (
              <tr key={g.id}>
                <td style={thTdStyle}>{g.id}</td>
                <td style={thTdStyle}>{g.group_id}</td>
                <td style={thTdStyle}>{g.head_id}</td>
                <td style={thTdStyle}>
                  {g.member_ids[0] !== undefined ? g.member_ids[0] : "-"}
                </td>
                <td style={thTdStyle}>
                  {g.member_ids[1] !== undefined ? g.member_ids[1] : "-"}
                </td>
                <td style={thTdStyle}>{g.size}</td>
                {prefCols}
                <td style={thTdStyle}>{g.subPreference.join(", ")}</td>
                <td style={thTdStyle}>{assignedVa ?? "-"}</td>
                <td
                  style={
                    assignedVa ? getCellStyle(indexVa, isSubPrefVa) : thTdStyle
                  }
                >
                  {getAssignedDisplay(assignedVa, indexVa, isSubPrefVa)}
                </td>
                <td style={thTdStyle}>{assignedVb ?? "-"}</td>
                <td
                  style={
                    assignedVb ? getCellStyle(indexVb, isSubPrefVb) : thTdStyle
                  }
                >
                  {getAssignedDisplay(assignedVb, indexVb, isSubPrefVb)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Styles
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
