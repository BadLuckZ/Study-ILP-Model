import { useEffect, useState } from "react";
import { assignGroupsVa, assignGroupsVb } from "../lib/api";

// shuffle array
function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

function generateData(numGroups, numHouses) {
  const numSubPreference = 1;
  const houses = {};

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

  const rawHouseList = [];
  for (let i = 0; i < numHouses; i++) {
    const selected = sizeDistribution[i];
    const { range, divisor } = selected;
    const minCap = generateDivisibleRandomFast(range[0], range[1], divisor);
    const maxCap = generateDivisibleRandomFast(minCap, range[1], divisor);
    rawHouseList.push({
      sizeName: selected.name,
      range: range,
      divisor,
      min: minCap,
      max: maxCap,
    });
  }

  const houseIds = Array.from({ length: numHouses }, (_, i) => i + 1);
  const groups = [];
  for (let gid = 1; gid <= numGroups; gid++) {
    const size = Math.floor(Math.random() * 3) + 1;

    const prefs = shuffle(houseIds).slice(0, weightedRandomPreference(5));

    const xl2xlHouses = rawHouseList
      .map((h, idx) => ({ id: idx + 1, sizeName: h.sizeName }))
      .filter((h) => h.sizeName === "XL" || h.sizeName === "2XL")
      .map((h) => h.id);

    const subPreference = shuffle(
      xl2xlHouses.filter((id) => !prefs.includes(id))
    ).slice(0, numSubPreference);

    groups.push({ id: gid, size, preference: prefs, subPreference });
  }

  const totalMembers = groups.reduce((sum, g) => sum + g.size, 0);

  let totalMax = rawHouseList.reduce((sum, h) => sum + h.max, 0);
  let iteration = 0;
  const maxIterations = rawHouseList.length * 20;

  while (totalMax < totalMembers && iteration < maxIterations) {
    const h = rawHouseList[iteration % rawHouseList.length];
    const newMax = h.max + h.divisor;
    if (newMax <= h.range[1]) {
      totalMax += h.divisor;
      h.max = newMax;
      if (h.min > h.max) h.min = h.max - h.divisor;
    }
    iteration++;
  }

  rawHouseList.forEach((h, idx) => {
    houses[idx + 1] = { min: h.min, max: h.max, sizeName: h.sizeName };
  });

  return { groups, houses };
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
  const totalHouseMinCapacity = Object.values(data.houses).reduce(
    (sum, h) => sum + h.min,
    0
  );
  const totalHouseMaxCapacity = Object.values(data.houses).reduce(
    (sum, h) => sum + h.max,
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

  const summaryVa = calculateSummary(resultVa);
  const summaryVb = calculateSummary(resultVb);

  const houseSizeCount = {};
  Object.values(data.houses).forEach((house) => {
    houseSizeCount[house.sizeName] = (houseSizeCount[house.sizeName] || 0) + 1;
  });

  const calculatePercentage = (num, total) =>
    total ? ((num / total) * 100).toFixed(2) : "0.00";

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", padding: "1rem" }}>
      <h2>Group Assignment - Va vs Vb Comparison</h2>
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
      </div>

      <p>Total Group Members: {totalGroupSize}</p>
      <p>Total House Min Capacity: {totalHouseMinCapacity}</p>
      <p>Total House Max Capacity: {totalHouseMaxCapacity}</p>

      {(resultVa || resultVb) && (
        <>
          <h3>Summary Comparison</h3>
          <table style={tableStyle}>
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
                const VaCount = summaryVa[key] || 0;
                const VbCount = summaryVb[key] || 0;
                const diff = VbCount - VaCount;
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
                      {resultVa
                        ? `${calculatePercentage(VaCount, numGroups)}%`
                        : "-"}
                    </td>
                    <td style={thTdStyle}>{resultVb ? VbCount : "-"}</td>
                    <td style={thTdStyle}>
                      {resultVb
                        ? `${calculatePercentage(VbCount, numGroups)}%`
                        : "-"}
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
        </>
      )}

      <h3>House Size Distribution</h3>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerStyle}>Size</th>
            <th style={headerStyle}>Count</th>
          </tr>
        </thead>
        <tbody>
          {["S", "M", "L", "XL", "2XL"].map((size) => (
            <tr key={size}>
              <td style={thTdStyle}>{size}</td>
              <td style={thTdStyle}>{houseSizeCount[size] || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Houses Comparison</h3>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerStyle}>ID</th>
            <th style={headerStyle}>Size</th>
            <th style={headerStyle}>Min</th>
            <th style={headerStyle}>Max</th>
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
              <td style={thTdStyle}>{h.sizeName}</td>
              <td style={thTdStyle}>{h.min}</td>
              <td style={thTdStyle}>{h.max}</td>
              <td style={thTdStyle}>
                {resultVa ? houseTotalsVa[hid] ?? 0 : "-"}
              </td>
              <td style={thTdStyle}>
                {resultVa
                  ? `${calculatePercentage(houseTotalsVa[hid] ?? 0, h.max)}%`
                  : "-"}
              </td>
              <td style={thTdStyle}>
                {resultVb ? houseTotalsVb[hid] ?? 0 : "-"}
              </td>
              <td style={thTdStyle}>
                {resultVb
                  ? `${calculatePercentage(houseTotalsVb[hid] ?? 0, h.max)}%`
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Groups Assignment Results</h3>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={headerStyle}>ID</th>
            <th style={headerStyle}>Size</th>
            <th style={headerStyle}>Prefs</th>
            <th style={headerStyle}>Sub Pref</th>
            <th style={headerStyle}>Va Assigned</th>
            <th style={headerStyle}>Vb Assigned</th>
          </tr>
        </thead>
        <tbody>
          {data.groups.map((g) => {
            // Show first 50 groups for performance
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

            return (
              <tr key={g.id}>
                <td style={thTdStyle}>{g.id}</td>
                <td style={thTdStyle}>{g.size}</td>
                <td style={thTdStyle}>{g.preference.join(", ")}</td>
                <td style={thTdStyle}>{g.subPreference.join(", ")}</td>
                <td
                  style={
                    assignedVa ? getCellStyle(indexVa, isSubPrefVa) : thTdStyle
                  }
                >
                  {assignedVa
                    ? `House ${assignedVa} ${
                        indexVa >= 0
                          ? `(อันดับ ${indexVa + 1})`
                          : isSubPrefVa
                          ? `(Sub)`
                          : "(นอกลำดับ)"
                      }`
                    : "-"}
                </td>
                <td
                  style={
                    assignedVb ? getCellStyle(indexVb, isSubPrefVb) : thTdStyle
                  }
                >
                  {assignedVb
                    ? `House ${assignedVb} ${
                        indexVb >= 0
                          ? `(อันดับ ${indexVb + 1})`
                          : isSubPrefVb
                          ? `(Sub)`
                          : "(นอกลำดับ)"
                      }`
                    : "-"}
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
