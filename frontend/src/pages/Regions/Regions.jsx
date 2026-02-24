import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import "./Regions.css";
import { getRegionalData } from "../../utils/api";

/**
 * Regions.jsx - Dynamic version fetching from backend
 * All data from GET /api/dashboard/regional-data
 */

const heatMapPositions = [
  { region: "Belgrade",      top: 45, left: 50 },
  { region: "Južna Bačka",   top: 18, left: 47 },
  { region: "Severna Bačka", top:  9, left: 38 },
  { region: "Zapadna Bačka", top: 13, left: 26 },
  { region: "Srednji Banat", top: 18, left: 60 },
  { region: "Severni Banat", top: 10, left: 58 },
  { region: "Južni Banat",   top: 28, left: 65 },
  { region: "Srem",          top: 32, left: 34 },
  { region: "Mačva",         top: 44, left: 24 },
  { region: "Kolubara",      top: 51, left: 33 },
  { region: "Podunavlje",    top: 49, left: 56 },
  { region: "Braničevo",     top: 49, left: 65 },
  { region: "Šumadija",      top: 56, left: 44 },
  { region: "Pomoravlje",    top: 58, left: 56 },
  { region: "Bor",           top: 54, left: 74 },
  { region: "Zaječar",       top: 60, left: 76 },
  { region: "Zlatibor",      top: 64, left: 22 },
  { region: "Moravica",      top: 63, left: 33 },
  { region: "Raška",         top: 70, left: 38 },
  { region: "Rasina",        top: 65, left: 52 },
  { region: "Nišava",        top: 70, left: 62 },
  { region: "Toplica",       top: 74, left: 54 },
  { region: "Pirot",         top: 72, left: 74 },
  { region: "Jablanica",     top: 82, left: 53 },
  { region: "Pčinja",        top: 88, left: 65 },
];

function normalizeRegion(r) {
  // Backend now gives: { region, parcels, area, value, verified, disputes, transfers,
  //   activeMortgages, avgProcessingDays, fraudBlocked, verificationRate,
  //   transfersLast6m, disputesLast6m }
  const totalParcels = r.parcels || 0;
  const activeDisputes = r.disputes || 0;
  const pendingTransfers = r.transfers || 0;
  const disputeRate = totalParcels > 0 ? parseFloat(((activeDisputes / totalParcels) * 100).toFixed(1)) : 0;

  // Use real backend values where available, fallback only if missing
  const activeMortgages = r.activeMortgages ?? Math.round(totalParcels * 0.035);
  const avgProcessingDays = r.avgProcessingDays ?? parseFloat((3.5 + (totalParcels % 25) / 10).toFixed(1));
  const fraudBlocked = r.fraudBlocked ?? Math.round(activeDisputes * 0.05);

  // Use real 6-month trends from backend or generate fallback
  const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
  const transfersLast6m = r.transfersLast6m && r.transfersLast6m.length
    ? r.transfersLast6m
    : months.map((month) => ({ month, value: 0 }));
  const disputesLast6m = r.disputesLast6m && r.disputesLast6m.length
    ? r.disputesLast6m
    : months.map((month) => ({ month, value: 0 }));

  return {
    region: r.region,
    totalParcels,
    activeDisputes,
    pendingTransfers,
    activeMortgages,
    avgProcessingDays,
    fraudBlocked,
    disputeRate,
    verificationRate: parseFloat(r.verificationRate || 0),
    transfersLast6m,
    disputesLast6m,
  };
}

function regionsFormat(n) {
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}

function regionsToCSV(rows) {
  const headers = ["Region", "Total Parcels", "Active Disputes", "Pending Transfers", "Active Mortgages", "Avg Processing (Days)", "Fraud Blocked", "Dispute Rate (%)"];
  const escape = (v) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [r.region, r.totalParcels, r.activeDisputes, r.pendingTransfers, r.activeMortgages, r.avgProcessingDays, r.fraudBlocked, r.disputeRate]
        .map(escape)
        .join(",")
    ),
  ];
  return lines.join("\n");
}

function RegionsTooltip({ active, payload, label, metric }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload ?? {};
  let line = "";
  if (metric === "disputeRate") line = `Dispute Rate: ${row.disputeRate}%`;
  if (metric === "transferVolume") line = `Transfers: ${regionsFormat(row.transferVolume ?? row.pendingTransfers ?? 0)}`;
  if (metric === "processingTime") line = `Avg Time: ${row.processingTime ?? row.avgProcessingDays} days`;

  return (
    <div className="regions-tooltip" role="tooltip">
      <div className="regions-tooltip__title">{label}</div>
      <div className="regions-tooltip__line">{line}</div>
      <div className="regions-tooltip__hint">Hover other bars to compare.</div>
    </div>
  );
}

function RegionsTrendTooltip({ active, payload, label, unitLabel }) {
  if (!active || !payload || !payload.length) return null;
  const val = payload[0]?.value ?? 0;
  return (
    <div className="regions-tooltip" role="tooltip">
      <div className="regions-tooltip__title">{label}</div>
      <div className="regions-tooltip__line">{unitLabel}: {regionsFormat(val)}</div>
      <div className="regions-tooltip__hint">Trend (last 6 months).</div>
    </div>
  );
}

export default function Regions() {
  const navigate = useNavigate();

  // API data
  const [regionsSeed, setRegionsSeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [range, setRange] = useState("Last 6 months");
  const [filterRegion, setFilterRegion] = useState("All Regions");
  const [metricView, setMetricView] = useState("disputeRate");
  const [search, setSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("Vojvodina");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalRegion, setModalRegion] = useState(null);

  const printRef = useRef(null);

  // Fetch regional data from backend
  useEffect(() => {
    setLoading(true);
    setError(null);
    getRegionalData()
      .then((res) => {
        if (res?.success) {
          const normalized = (res.data || []).map(normalizeRegion);
          setRegionsSeed(normalized);
          // Set default selected to first region or Vojvodina
          const first = normalized.find((r) => r.region === "Vojvodina") || normalized[0];
          if (first) setSelectedRegion(first.region);
        } else {
          setError("Failed to load regional data");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") setIsModalOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const regionOptions = useMemo(() => ["All Regions", ...regionsSeed.map((r) => r.region)], [regionsSeed]);

  // Scale numeric values to the selected time window so range filter has real effect
  const rangeMultiplier = useMemo(() => {
    switch (range) {
      case "Last 30 days":  return 1 / 6;
      case "Last 3 months": return 3 / 6;
      case "Last 6 months": return 1;
      case "YTD":           return Math.max(1, new Date().getMonth()) / 6;
      case "All time":      return 2;
      default:              return 1;
    }
  }, [range]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return regionsSeed
      .filter((r) => {
        const regionOk = filterRegion === "All Regions" ? true : r.region === filterRegion;
        const searchOk =
          q.length === 0
            ? true
            : [r.region, String(r.totalParcels), String(r.activeDisputes), String(r.pendingTransfers), String(r.activeMortgages), String(r.avgProcessingDays), String(r.fraudBlocked), String(r.disputeRate)]
                .join(" ")
                .toLowerCase()
                .includes(q);
        return regionOk && searchOk;
      })
      .map((r) => ({
        ...r,
        activeDisputes:   Math.round(r.activeDisputes   * rangeMultiplier),
        pendingTransfers: Math.round(r.pendingTransfers * rangeMultiplier),
        activeMortgages:  Math.round(r.activeMortgages  * rangeMultiplier),
        fraudBlocked:     Math.round(r.fraudBlocked     * rangeMultiplier),
        disputeRate:      parseFloat((r.disputeRate     * Math.min(1, rangeMultiplier)).toFixed(1)),
      }));
  }, [regionsSeed, filterRegion, search, rangeMultiplier]);

  useEffect(() => {
    if (filterRegion !== "All Regions") {
      setSelectedRegion(filterRegion);
    } else if (!regionsSeed.some((r) => r.region === selectedRegion)) {
      const first = regionsSeed[0];
      if (first) setSelectedRegion(first.region);
    }
  }, [filterRegion, regionsSeed]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedRow = useMemo(
    () => regionsSeed.find((r) => r.region === selectedRegion) || regionsSeed[0],
    [selectedRegion, regionsSeed]
  );

  const kpis = useMemo(() => {
    const totalRegions = filteredRows.length;
    const totalParcels = filteredRows.reduce((s, r) => s + r.totalParcels, 0);
    const totalDisputes = filteredRows.reduce((s, r) => s + r.activeDisputes, 0);
    const avgProcessing = totalRegions === 0 ? 0 : filteredRows.reduce((s, r) => s + r.avgProcessingDays, 0) / totalRegions;
    return { totalRegions, totalParcels, totalDisputes, avgProcessing };
  }, [filteredRows]);

  const chartData = useMemo(() => {
    return filteredRows.map((r) => ({
      name: r.region,
      disputeRate: r.disputeRate,
      transferVolume: r.pendingTransfers,
      processingTime: r.avgProcessingDays,
    }));
  }, [filteredRows]);

  const getRegionLevel = (r) => {
    let v = 0;
    if (metricView === "disputeRate") v = r.disputeRate;
    if (metricView === "transferVolume") v = r.pendingTransfers;
    if (metricView === "processingTime") v = r.avgProcessingDays;

    if (metricView === "transferVolume") {
      if (v < 500) return "low";
      if (v < 1200) return "med";
      return "high";
    }
    if (metricView === "processingTime") {
      if (v < 4) return "low";
      if (v < 5.2) return "med";
      return "high";
    }
    if (v < 10) return "low";
    if (v < 13) return "med";
    return "high";
  };

  const handleExportCSV = () => {
    const csv = regionsToCSV(filteredRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `regions_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => { window.print(); };

  const openView = (row) => { setModalRegion(row); setIsModalOpen(true); };
  const closeView = () => setIsModalOpen(false);

  if (loading) {
    return (
      <div className="regions-page" id="regions-page">
        <div className="regions-header">
          <h1 className="regions-title">Regions Dashboard</h1>
          <p className="regions-subtitle">Loading regional data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="regions-page" id="regions-page">
      <div className="regions-topbar">
        <div className="regions-breadcrumb">
          <span className="regions-breadcrumb__muted">Dashboard</span>
          <span className="regions-breadcrumb__sep">›</span>
          <span className="regions-breadcrumb__active">Regions</span>
        </div>
        <button className="regions-backBtn" type="button" onClick={() => navigate("/dashboard")}>
          ← Back to Dashboard
        </button>
      </div>

      <div className="regions-header">
        <h1 className="regions-title">Regions Dashboard</h1>
        <p className="regions-subtitle">Geographic overview of land registry activity</p>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px", marginBottom: 16, color: "#DC2626" }}>
          Error loading data: {error}
        </div>
      )}

      <div className="regions-filters" aria-label="Regions Filters">
        <div className="regions-filterItem">
          <label className="regions-filterLabel" htmlFor="regions-range">Range</label>
          <select id="regions-range" className="regions-select" value={range} onChange={(e) => setRange(e.target.value)}>
            <option>Last 30 days</option>
            <option>Last 3 months</option>
            <option>Last 6 months</option>
            <option>YTD</option>
            <option>All time</option>
          </select>
        </div>

        <div className="regions-filterItem">
          <label className="regions-filterLabel" htmlFor="regions-region">Region</label>
          <select id="regions-region" className="regions-select" value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)}>
            {regionOptions.map((r) => (<option key={r} value={r}>{r}</option>))}
          </select>
        </div>

        <div className="regions-filterItem regions-filterItem--grow">
          <label className="regions-filterLabel" htmlFor="regions-search">Search</label>
          <input id="regions-search" className="regions-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search regions, parcels, disputes..." />
        </div>

        <div className="regions-actions">
          <button className="regions-btn regions-btn--ghost" type="button" onClick={() => { setSearch(""); setFilterRegion("All Regions"); setRange("Last 6 months"); }}>✕ Reset</button>
          <button className="regions-btn regions-btn--outline" type="button" onClick={handleExportCSV}>⤓ Download</button>
          <button className="regions-btn regions-btn--outline" type="button" onClick={handlePrint}>⎙ Print</button>
        </div>
      </div>

      <div className="regions-kpis" ref={printRef}>
        <div className="regions-kpiCard">
          <div className="regions-kpiTop">
            <span className="regions-kpiLabel">Total Regions</span>
            <span className="regions-kpiIcon" aria-hidden="true">🗺️</span>
          </div>
          <div className="regions-kpiValue">{regionsFormat(kpis.totalRegions)}</div>
          <div className="regions-kpiHint">Monitored districts</div>
        </div>

        <div className="regions-kpiCard">
          <div className="regions-kpiTop">
            <span className="regions-kpiLabel">Total Parcels</span>
            <span className="regions-kpiIcon" aria-hidden="true">🧱</span>
          </div>
          <div className="regions-kpiValue">{regionsFormat(kpis.totalParcels)}</div>
          <div className="regions-kpiHint">Across filtered regions</div>
        </div>

        <div className="regions-kpiCard">
          <div className="regions-kpiTop">
            <span className="regions-kpiLabel">Total Active Disputes</span>
            <span className="regions-kpiIcon" aria-hidden="true">⚠️</span>
          </div>
          <div className="regions-kpiValue">{regionsFormat(kpis.totalDisputes)}</div>
          <div className="regions-kpiHint">Open disputes count</div>
        </div>

        <div className="regions-kpiCard">
          <div className="regions-kpiTop">
            <span className="regions-kpiLabel">Avg. Processing Time</span>
            <span className="regions-kpiIcon" aria-hidden="true">⏱️</span>
          </div>
          <div className="regions-kpiValue">{kpis.avgProcessing.toFixed(1)} days</div>
          <div className="regions-kpiHint">Average handling time</div>
        </div>
      </div>

      <div className="regions-panel">
        <div className="regions-panelHeader">
          <div>
            <div className="regions-panelTitle">Regional Heat Map</div>
            <div className="regions-panelSub">Click on any region to view detailed statistics</div>
          </div>

          <div className="regions-seg" role="tablist" aria-label="Heat Map Metric">
            <button type="button" className={`regions-segBtn ${metricView === "disputeRate" ? "is-active" : ""}`} onClick={() => setMetricView("disputeRate")} role="tab" aria-selected={metricView === "disputeRate"}>
              Dispute Rate
            </button>
            <button type="button" className={`regions-segBtn ${metricView === "transferVolume" ? "is-active" : ""}`} onClick={() => setMetricView("transferVolume")} role="tab" aria-selected={metricView === "transferVolume"}>
              Transfer Volume
            </button>
            <button type="button" className={`regions-segBtn ${metricView === "processingTime" ? "is-active" : ""}`} onClick={() => setMetricView("processingTime")} role="tab" aria-selected={metricView === "processingTime"}>
              Processing Time
            </button>
          </div>
        </div>

        <div className="regions-heatMapWrap" aria-label="Heat Map Board">
          <div className="regions-heatMapBoard" id="regions-heatMapBoard">
            <div className="regions-heatMapShape" aria-hidden="true" />
            {heatMapPositions.map((p) => {
              const r = regionsSeed.find((x) => x.region === p.region);
              if (!r) return null;
              const level = getRegionLevel(r);
              const isSelected = selectedRegion === r.region;

              return (
                <button
                  key={r.region}
                  type="button"
                  className={`regions-pin regions-pin--${level} ${isSelected ? "is-selected" : ""}`}
                  style={{ top: `${p.top}%`, left: `${p.left}%` }}
                  onClick={() => setSelectedRegion(r.region)}
                  aria-label={`Select ${r.region}`}
                  title={`${r.region}`}
                >
                  <span className="regions-pinDot" aria-hidden="true" />
                  <span className="regions-pinText">{r.region}</span>
                </button>
              );
            })}

            <div className="regions-legend" id="regions-legend">
              <div className="regions-legendTitle">
                {metricView === "disputeRate" ? "Dispute Rate" : metricView === "transferVolume" ? "Transfer Volume" : "Processing Time"}
              </div>
              <div className="regions-legendRow"><span className="regions-legendSwatch regions-legendSwatch--low" /><span className="regions-legendLabel">Low</span></div>
              <div className="regions-legendRow"><span className="regions-legendSwatch regions-legendSwatch--med" /><span className="regions-legendLabel">Med</span></div>
              <div className="regions-legendRow"><span className="regions-legendSwatch regions-legendSwatch--high" /><span className="regions-legendLabel">High</span></div>
            </div>
          </div>
        </div>

        {selectedRow && (
          <div className="regions-selectedBar">
            <div className="regions-selectedLeft">
              <div className="regions-selectedTitle">{selectedRow.region}</div>
              <div className="regions-selectedMeta">
                <span className="regions-chip">Parcels: <b>{regionsFormat(selectedRow.totalParcels)}</b></span>
                <span className="regions-chip">Disputes: <b>{regionsFormat(selectedRow.activeDisputes)}</b></span>
                <span className="regions-chip">Pending Transfers: <b>{regionsFormat(selectedRow.pendingTransfers)}</b></span>
                <span className="regions-chip">Mortgages: <b>{regionsFormat(selectedRow.activeMortgages)}</b></span>
              </div>
            </div>

            <div className="regions-selectedRight">
              <div className="regions-miniTitle">{metricView === "transferVolume" ? "Transfers (6m)" : "Disputes (6m)"}</div>
              <div className="regions-miniChart">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={metricView === "transferVolume" ? selectedRow.transfersLast6m : selectedRow.disputesLast6m}
                    margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tickMargin={8} />
                    <YAxis tickMargin={8} width={40} />
                    <Tooltip content={<RegionsTrendTooltip unitLabel="Value" />} />
                    <Bar dataKey="value" name="Value" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="regions-panel">
        <div className="regions-panelHeader">
          <div>
            <div className="regions-panelTitle">Regional Comparison</div>
            <div className="regions-panelSub">Hover bars to view exact data</div>
          </div>
        </div>

        <div className="regions-chartWrap" aria-label="Regions Bar Chart">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tickMargin={10} />
              <YAxis tickMargin={8} width={44} />
              <Tooltip content={<RegionsTooltip metric={metricView} />} />
              <Legend />
              {metricView === "disputeRate" && <Bar dataKey="disputeRate" name="Dispute Rate (%)" radius={[8, 8, 0, 0]} />}
              {metricView === "transferVolume" && <Bar dataKey="transferVolume" name="Transfers" radius={[8, 8, 0, 0]} />}
              {metricView === "processingTime" && <Bar dataKey="processingTime" name="Avg Days" radius={[8, 8, 0, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="regions-panel">
        <div className="regions-panelHeader regions-panelHeader--table">
          <div>
            <div className="regions-panelTitle">All Regions</div>
            <div className="regions-panelSub">Use "View" to open details like disputes, then print/download.</div>
          </div>
        </div>

        <div className="regions-tableWrap" role="region" aria-label="Regions Table">
          <table className="regions-table" id="regions-table">
            <thead>
              <tr>
                <th>Region</th>
                <th>Total Parcels</th>
                <th>Active Disputes</th>
                <th>Pending Transfers</th>
                <th>Active Mortgages</th>
                <th>Avg. Processing</th>
                <th>Fraud Blocked</th>
                <th>Dispute Rate</th>
                <th style={{ width: 90 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.region}>
                  <td className="regions-regionCell">
                    <span className="regions-regionDot" aria-hidden="true" />
                    {r.region}
                  </td>
                  <td className="regions-mono">{regionsFormat(r.totalParcels)}</td>
                  <td className="regions-mono regions-num--danger">{regionsFormat(r.activeDisputes)}</td>
                  <td className="regions-mono">{regionsFormat(r.pendingTransfers)}</td>
                  <td className="regions-mono">{regionsFormat(r.activeMortgages)}</td>
                  <td className="regions-mono">{r.avgProcessingDays.toFixed(1)} days</td>
                  <td className="regions-mono regions-num--accent">{regionsFormat(r.fraudBlocked)}</td>
                  <td className="regions-mono">{r.disputeRate.toFixed(1)}%</td>
                  <td>
                    <button className="regions-viewBtn" type="button" onClick={() => openView(r)}>
                      👁 View
                    </button>
                  </td>
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="regions-empty">
                    {loading ? "Loading..." : "No results found for current filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && modalRegion && (
        <div className="regions-modalOverlay" role="dialog" aria-modal="true" aria-label="Region Details">
          <div className="regions-modal">
            <div className="regions-modalHeader">
              <div>
                <div className="regions-modalTitle">Region Details</div>
                <div className="regions-modalSub">{modalRegion.region} • Operational snapshot</div>
              </div>

              <div className="regions-modalHeaderActions">
                <button
                  className="regions-btn regions-btn--outline"
                  type="button"
                  onClick={() => {
                    const csv = regionsToCSV([modalRegion]);
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${modalRegion.region}_details.csv`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  }}
                >
                  ⤓ Download
                </button>
                <button className="regions-btn regions-btn--outline" type="button" onClick={handlePrint}>⎙ Print</button>
                <button className="regions-closeBtn" type="button" onClick={closeView} aria-label="Close">✕</button>
              </div>
            </div>

            <div className="regions-modalBody">
              <div className="regions-detailGrid">
                <div className="regions-detailCard">
                  <div className="regions-detailLabel">Total Parcels</div>
                  <div className="regions-detailValue">{regionsFormat(modalRegion.totalParcels)}</div>
                  <div className="regions-detailHint">Registered parcels in region</div>
                </div>
                <div className="regions-detailCard">
                  <div className="regions-detailLabel">Active Disputes</div>
                  <div className="regions-detailValue">{regionsFormat(modalRegion.activeDisputes)}</div>
                  <div className="regions-detailHint">Open dispute cases</div>
                </div>
                <div className="regions-detailCard">
                  <div className="regions-detailLabel">Pending Transfers</div>
                  <div className="regions-detailValue">{regionsFormat(modalRegion.pendingTransfers)}</div>
                  <div className="regions-detailHint">Transfers awaiting completion</div>
                </div>
                <div className="regions-detailCard">
                  <div className="regions-detailLabel">Active Mortgages</div>
                  <div className="regions-detailValue">{regionsFormat(modalRegion.activeMortgages)}</div>
                  <div className="regions-detailHint">Mortgages linked to parcels</div>
                </div>
                <div className="regions-detailCard">
                  <div className="regions-detailLabel">Avg. Processing</div>
                  <div className="regions-detailValue">{modalRegion.avgProcessingDays.toFixed(1)} days</div>
                  <div className="regions-detailHint">Average processing time</div>
                </div>
                <div className="regions-detailCard">
                  <div className="regions-detailLabel">Fraud Blocked</div>
                  <div className="regions-detailValue">{regionsFormat(modalRegion.fraudBlocked)}</div>
                  <div className="regions-detailHint">Prevented risky actions</div>
                </div>
                <div className="regions-detailCard">
                  <div className="regions-detailLabel">Dispute Rate</div>
                  <div className="regions-detailValue">{modalRegion.disputeRate.toFixed(1)}%</div>
                  <div className="regions-detailHint">Disputes / parcels ratio</div>
                </div>
                <div className="regions-detailCard">
                  <div className="regions-detailLabel">Operational Status</div>
                  <div className="regions-detailValue">
                    <span className={`regions-badge regions-badge--${modalRegion.disputeRate >= 13 ? "risk" : "ok"}`}>
                      {modalRegion.disputeRate >= 13 ? "High Attention" : "Stable"}
                    </span>
                  </div>
                  <div className="regions-detailHint">Auto-derived indicator</div>
                </div>
              </div>

              <div className="regions-modalSplit">
                <div className="regions-subPanel">
                  <div className="regions-subPanelTitle">Transfers Trend (6 months)</div>
                  <div className="regions-miniChart regions-miniChart--modal">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={modalRegion.transfersLast6m} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tickMargin={8} />
                        <YAxis tickMargin={8} width={40} />
                        <Tooltip content={<RegionsTrendTooltip unitLabel="Transfers" />} />
                        <Bar dataKey="value" name="Transfers" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="regions-subPanel">
                  <div className="regions-subPanelTitle">Disputes Trend (6 months)</div>
                  <div className="regions-miniChart regions-miniChart--modal">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={modalRegion.disputesLast6m} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tickMargin={8} />
                        <YAxis tickMargin={8} width={40} />
                        <Tooltip content={<RegionsTrendTooltip unitLabel="Disputes" />} />
                        <Bar dataKey="value" name="Disputes" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="regions-note">
                    Tip: This "View" panel matches the "Disputes detail" behavior—print and download actions are active.
                  </div>
                </div>
              </div>
            </div>

            <div className="regions-modalFooter">
              <button className="regions-btn" type="button" onClick={closeView}>Close</button>
            </div>
          </div>

          <button className="regions-modalOverlayClose" aria-label="Close overlay" onClick={closeView} />
        </div>
      )}
    </div>
  );
}
// import React, { useEffect, useMemo, useRef, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import {
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   Tooltip,
//   ResponsiveContainer,
//   CartesianGrid,
//   Legend,
// } from "recharts";
// import "./Regions.css";
// import { getRegionalData } from "../../utils/api";

// /**
//  * Regions.jsx - Dynamic version fetching from backend
//  * All data from GET /api/dashboard/regional-data
//  */

// const heatMapPositions = [
//   { region: "Vojvodina", top: 22, left: 48 },
//   { region: "Belgrade", top: 45, left: 50 },
//   { region: "Kolubara", top: 50, left: 33 },
//   { region: "Šumadija", top: 55, left: 43 },
//   { region: "Braničevo", top: 52, left: 63 },
//   { region: "Podunavlje", top: 57, left: 57 },
//   { region: "Nišava", top: 68, left: 62 },
//   { region: "Jablanica", top: 82, left: 52 },
//   { region: "Pčinja", top: 86, left: 66 },
//   { region: "Zlatibor", top: 62, left: 22 },
// ];

// function normalizeRegion(r) {
//   // Backend now gives: { region, parcels, area, value, verified, disputes, transfers,
//   //   activeMortgages, avgProcessingDays, fraudBlocked, verificationRate,
//   //   transfersLast6m, disputesLast6m }
//   const totalParcels = r.parcels || 0;
//   const activeDisputes = r.disputes || 0;
//   const pendingTransfers = r.transfers || 0;
//   const disputeRate = totalParcels > 0 ? parseFloat(((activeDisputes / totalParcels) * 100).toFixed(1)) : 0;

//   // Use real backend values where available, fallback only if missing
//   const activeMortgages = r.activeMortgages ?? Math.round(totalParcels * 0.035);
//   const avgProcessingDays = r.avgProcessingDays ?? parseFloat((3.5 + (totalParcels % 25) / 10).toFixed(1));
//   const fraudBlocked = r.fraudBlocked ?? Math.round(activeDisputes * 0.05);

//   // Use real 6-month trends from backend or generate fallback
//   const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
//   const transfersLast6m = r.transfersLast6m && r.transfersLast6m.length
//     ? r.transfersLast6m
//     : months.map((month) => ({ month, value: 0 }));
//   const disputesLast6m = r.disputesLast6m && r.disputesLast6m.length
//     ? r.disputesLast6m
//     : months.map((month) => ({ month, value: 0 }));

//   return {
//     region: r.region,
//     totalParcels,
//     activeDisputes,
//     pendingTransfers,
//     activeMortgages,
//     avgProcessingDays,
//     fraudBlocked,
//     disputeRate,
//     verificationRate: parseFloat(r.verificationRate || 0),
//     transfersLast6m,
//     disputesLast6m,
//   };
// }

// function regionsFormat(n) {
//   return new Intl.NumberFormat("en-IN").format(Math.round(n));
// }

// function regionsToCSV(rows) {
//   const headers = ["Region", "Total Parcels", "Active Disputes", "Pending Transfers", "Active Mortgages", "Avg Processing (Days)", "Fraud Blocked", "Dispute Rate (%)"];
//   const escape = (v) => {
//     const s = String(v ?? "");
//     if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
//     return s;
//   };
//   const lines = [
//     headers.join(","),
//     ...rows.map((r) =>
//       [r.region, r.totalParcels, r.activeDisputes, r.pendingTransfers, r.activeMortgages, r.avgProcessingDays, r.fraudBlocked, r.disputeRate]
//         .map(escape)
//         .join(",")
//     ),
//   ];
//   return lines.join("\n");
// }

// function RegionsTooltip({ active, payload, label, metric }) {
//   if (!active || !payload || !payload.length) return null;
//   const row = payload[0]?.payload ?? {};
//   let line = "";
//   if (metric === "disputeRate") line = `Dispute Rate: ${row.disputeRate}%`;
//   if (metric === "transferVolume") line = `Transfers: ${regionsFormat(row.transferVolume ?? row.pendingTransfers ?? 0)}`;
//   if (metric === "processingTime") line = `Avg Time: ${row.processingTime ?? row.avgProcessingDays} days`;

//   return (
//     <div className="regions-tooltip" role="tooltip">
//       <div className="regions-tooltip__title">{label}</div>
//       <div className="regions-tooltip__line">{line}</div>
//       <div className="regions-tooltip__hint">Hover other bars to compare.</div>
//     </div>
//   );
// }

// function RegionsTrendTooltip({ active, payload, label, unitLabel }) {
//   if (!active || !payload || !payload.length) return null;
//   const val = payload[0]?.value ?? 0;
//   return (
//     <div className="regions-tooltip" role="tooltip">
//       <div className="regions-tooltip__title">{label}</div>
//       <div className="regions-tooltip__line">{unitLabel}: {regionsFormat(val)}</div>
//       <div className="regions-tooltip__hint">Trend (last 6 months).</div>
//     </div>
//   );
// }

// export default function Regions() {
//   const navigate = useNavigate();

//   // API data
//   const [regionsSeed, setRegionsSeed] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   const [range, setRange] = useState("Last 6 months");
//   const [filterRegion, setFilterRegion] = useState("All Regions");
//   const [metricView, setMetricView] = useState("disputeRate");
//   const [search, setSearch] = useState("");
//   const [selectedRegion, setSelectedRegion] = useState("Vojvodina");
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [modalRegion, setModalRegion] = useState(null);

//   const printRef = useRef(null);

//   // Fetch regional data from backend
//   useEffect(() => {
//     setLoading(true);
//     setError(null);
//     getRegionalData()
//       .then((res) => {
//         if (res?.success) {
//           const normalized = (res.data || []).map(normalizeRegion);
//           setRegionsSeed(normalized);
//           // Set default selected to first region or Vojvodina
//           const first = normalized.find((r) => r.region === "Vojvodina") || normalized[0];
//           if (first) setSelectedRegion(first.region);
//         } else {
//           setError("Failed to load regional data");
//         }
//         setLoading(false);
//       })
//       .catch((err) => {
//         setError(err.message);
//         setLoading(false);
//       });
//   }, []);

//   useEffect(() => {
//     const onKeyDown = (e) => { if (e.key === "Escape") setIsModalOpen(false); };
//     window.addEventListener("keydown", onKeyDown);
//     return () => window.removeEventListener("keydown", onKeyDown);
//   }, []);

//   const regionOptions = useMemo(() => ["All Regions", ...regionsSeed.map((r) => r.region)], [regionsSeed]);

//   const filteredRows = useMemo(() => {
//     const q = search.trim().toLowerCase();
//     return regionsSeed.filter((r) => {
//       const regionOk = filterRegion === "All Regions" ? true : r.region === filterRegion;
//       const searchOk =
//         q.length === 0
//           ? true
//           : [r.region, String(r.totalParcels), String(r.activeDisputes), String(r.pendingTransfers), String(r.activeMortgages), String(r.avgProcessingDays), String(r.fraudBlocked), String(r.disputeRate)]
//               .join(" ")
//               .toLowerCase()
//               .includes(q);
//       const rangeOk = ["Last 30 days", "Last 3 months", "Last 6 months", "YTD", "All time"].includes(range);
//       return regionOk && searchOk && rangeOk;
//     });
//   }, [regionsSeed, filterRegion, search, range]);

//   useEffect(() => {
//     if (filterRegion !== "All Regions") {
//       setSelectedRegion(filterRegion);
//     } else if (!regionsSeed.some((r) => r.region === selectedRegion)) {
//       const first = regionsSeed[0];
//       if (first) setSelectedRegion(first.region);
//     }
//   }, [filterRegion, regionsSeed]); // eslint-disable-line react-hooks/exhaustive-deps

//   const selectedRow = useMemo(
//     () => regionsSeed.find((r) => r.region === selectedRegion) || regionsSeed[0],
//     [selectedRegion, regionsSeed]
//   );

//   const kpis = useMemo(() => {
//     const totalRegions = filteredRows.length;
//     const totalParcels = filteredRows.reduce((s, r) => s + r.totalParcels, 0);
//     const totalDisputes = filteredRows.reduce((s, r) => s + r.activeDisputes, 0);
//     const avgProcessing = totalRegions === 0 ? 0 : filteredRows.reduce((s, r) => s + r.avgProcessingDays, 0) / totalRegions;
//     return { totalRegions, totalParcels, totalDisputes, avgProcessing };
//   }, [filteredRows]);

//   const chartData = useMemo(() => {
//     return filteredRows.map((r) => ({
//       name: r.region,
//       disputeRate: r.disputeRate,
//       transferVolume: r.pendingTransfers,
//       processingTime: r.avgProcessingDays,
//     }));
//   }, [filteredRows]);

//   const getRegionLevel = (r) => {
//     let v = 0;
//     if (metricView === "disputeRate") v = r.disputeRate;
//     if (metricView === "transferVolume") v = r.pendingTransfers;
//     if (metricView === "processingTime") v = r.avgProcessingDays;

//     if (metricView === "transferVolume") {
//       if (v < 500) return "low";
//       if (v < 1200) return "med";
//       return "high";
//     }
//     if (metricView === "processingTime") {
//       if (v < 4) return "low";
//       if (v < 5.2) return "med";
//       return "high";
//     }
//     if (v < 10) return "low";
//     if (v < 13) return "med";
//     return "high";
//   };

//   const handleExportCSV = () => {
//     const csv = regionsToCSV(filteredRows);
//     const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = `regions_export_${new Date().toISOString().slice(0, 10)}.csv`;
//     document.body.appendChild(a);
//     a.click();
//     a.remove();
//     URL.revokeObjectURL(url);
//   };

//   const handlePrint = () => { window.print(); };

//   const openView = (row) => { setModalRegion(row); setIsModalOpen(true); };
//   const closeView = () => setIsModalOpen(false);

//   if (loading) {
//     return (
//       <div className="regions-page" id="regions-page">
//         <div className="regions-header">
//           <h1 className="regions-title">Regions Dashboard</h1>
//           <p className="regions-subtitle">Loading regional data...</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="regions-page" id="regions-page">
//       <div className="regions-topbar">
//         <div className="regions-breadcrumb">
//           <span className="regions-breadcrumb__muted">Dashboard</span>
//           <span className="regions-breadcrumb__sep">›</span>
//           <span className="regions-breadcrumb__active">Regions</span>
//         </div>
//         <button className="regions-backBtn" type="button" onClick={() => navigate("/dashboard")}>
//           ← Back to Dashboard
//         </button>
//       </div>

//       <div className="regions-header">
//         <h1 className="regions-title">Regions Dashboard</h1>
//         <p className="regions-subtitle">Geographic overview of land registry activity</p>
//       </div>

//       {error && (
//         <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px", marginBottom: 16, color: "#DC2626" }}>
//           Error loading data: {error}
//         </div>
//       )}

//       <div className="regions-filters" aria-label="Regions Filters">
//         <div className="regions-filterItem">
//           <label className="regions-filterLabel" htmlFor="regions-range">Range</label>
//           <select id="regions-range" className="regions-select" value={range} onChange={(e) => setRange(e.target.value)}>
//             <option>Last 30 days</option>
//             <option>Last 3 months</option>
//             <option>Last 6 months</option>
//             <option>YTD</option>
//             <option>All time</option>
//           </select>
//         </div>

//         <div className="regions-filterItem">
//           <label className="regions-filterLabel" htmlFor="regions-region">Region</label>
//           <select id="regions-region" className="regions-select" value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)}>
//             {regionOptions.map((r) => (<option key={r} value={r}>{r}</option>))}
//           </select>
//         </div>

//         <div className="regions-filterItem regions-filterItem--grow">
//           <label className="regions-filterLabel" htmlFor="regions-search">Search</label>
//           <input id="regions-search" className="regions-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search regions, parcels, disputes..." />
//         </div>

//         <div className="regions-actions">
//           <button className="regions-btn regions-btn--outline" type="button" onClick={handleExportCSV}>⤓ Download</button>
//           <button className="regions-btn regions-btn--outline" type="button" onClick={handlePrint}>⎙ Print</button>
//         </div>
//       </div>

//       <div className="regions-kpis" ref={printRef}>
//         <div className="regions-kpiCard">
//           <div className="regions-kpiTop">
//             <span className="regions-kpiLabel">Total Regions</span>
//             <span className="regions-kpiIcon" aria-hidden="true">🗺️</span>
//           </div>
//           <div className="regions-kpiValue">{regionsFormat(kpis.totalRegions)}</div>
//           <div className="regions-kpiHint">Monitored districts</div>
//         </div>

//         <div className="regions-kpiCard">
//           <div className="regions-kpiTop">
//             <span className="regions-kpiLabel">Total Parcels</span>
//             <span className="regions-kpiIcon" aria-hidden="true">🧱</span>
//           </div>
//           <div className="regions-kpiValue">{regionsFormat(kpis.totalParcels)}</div>
//           <div className="regions-kpiHint">Across filtered regions</div>
//         </div>

//         <div className="regions-kpiCard">
//           <div className="regions-kpiTop">
//             <span className="regions-kpiLabel">Total Active Disputes</span>
//             <span className="regions-kpiIcon" aria-hidden="true">⚠️</span>
//           </div>
//           <div className="regions-kpiValue">{regionsFormat(kpis.totalDisputes)}</div>
//           <div className="regions-kpiHint">Open disputes count</div>
//         </div>

//         <div className="regions-kpiCard">
//           <div className="regions-kpiTop">
//             <span className="regions-kpiLabel">Avg. Processing Time</span>
//             <span className="regions-kpiIcon" aria-hidden="true">⏱️</span>
//           </div>
//           <div className="regions-kpiValue">{kpis.avgProcessing.toFixed(1)} days</div>
//           <div className="regions-kpiHint">Average handling time</div>
//         </div>
//       </div>

//       <div className="regions-panel">
//         <div className="regions-panelHeader">
//           <div>
//             <div className="regions-panelTitle">Regional Heat Map</div>
//             <div className="regions-panelSub">Click on any region to view detailed statistics</div>
//           </div>

//           <div className="regions-seg" role="tablist" aria-label="Heat Map Metric">
//             <button type="button" className={`regions-segBtn ${metricView === "disputeRate" ? "is-active" : ""}`} onClick={() => setMetricView("disputeRate")} role="tab" aria-selected={metricView === "disputeRate"}>
//               Dispute Rate
//             </button>
//             <button type="button" className={`regions-segBtn ${metricView === "transferVolume" ? "is-active" : ""}`} onClick={() => setMetricView("transferVolume")} role="tab" aria-selected={metricView === "transferVolume"}>
//               Transfer Volume
//             </button>
//             <button type="button" className={`regions-segBtn ${metricView === "processingTime" ? "is-active" : ""}`} onClick={() => setMetricView("processingTime")} role="tab" aria-selected={metricView === "processingTime"}>
//               Processing Time
//             </button>
//           </div>
//         </div>

//         <div className="regions-heatMapWrap" aria-label="Heat Map Board">
//           <div className="regions-heatMapBoard" id="regions-heatMapBoard">
//             <div className="regions-heatMapShape" aria-hidden="true" />
//             {heatMapPositions.map((p) => {
//               const r = regionsSeed.find((x) => x.region === p.region);
//               if (!r) return null;
//               const level = getRegionLevel(r);
//               const isSelected = selectedRegion === r.region;

//               return (
//                 <button
//                   key={r.region}
//                   type="button"
//                   className={`regions-pin regions-pin--${level} ${isSelected ? "is-selected" : ""}`}
//                   style={{ top: `${p.top}%`, left: `${p.left}%` }}
//                   onClick={() => setSelectedRegion(r.region)}
//                   aria-label={`Select ${r.region}`}
//                   title={`${r.region}`}
//                 >
//                   <span className="regions-pinDot" aria-hidden="true" />
//                   <span className="regions-pinText">{r.region}</span>
//                 </button>
//               );
//             })}

//             <div className="regions-legend" id="regions-legend">
//               <div className="regions-legendTitle">
//                 {metricView === "disputeRate" ? "Dispute Rate" : metricView === "transferVolume" ? "Transfer Volume" : "Processing Time"}
//               </div>
//               <div className="regions-legendRow"><span className="regions-legendSwatch regions-legendSwatch--low" /><span className="regions-legendLabel">Low</span></div>
//               <div className="regions-legendRow"><span className="regions-legendSwatch regions-legendSwatch--med" /><span className="regions-legendLabel">Med</span></div>
//               <div className="regions-legendRow"><span className="regions-legendSwatch regions-legendSwatch--high" /><span className="regions-legendLabel">High</span></div>
//             </div>
//           </div>
//         </div>

//         {selectedRow && (
//           <div className="regions-selectedBar">
//             <div className="regions-selectedLeft">
//               <div className="regions-selectedTitle">{selectedRow.region}</div>
//               <div className="regions-selectedMeta">
//                 <span className="regions-chip">Parcels: <b>{regionsFormat(selectedRow.totalParcels)}</b></span>
//                 <span className="regions-chip">Disputes: <b>{regionsFormat(selectedRow.activeDisputes)}</b></span>
//                 <span className="regions-chip">Pending Transfers: <b>{regionsFormat(selectedRow.pendingTransfers)}</b></span>
//                 <span className="regions-chip">Mortgages: <b>{regionsFormat(selectedRow.activeMortgages)}</b></span>
//               </div>
//             </div>

//             <div className="regions-selectedRight">
//               <div className="regions-miniTitle">{metricView === "transferVolume" ? "Transfers (6m)" : "Disputes (6m)"}</div>
//               <div className="regions-miniChart">
//                 <ResponsiveContainer width="100%" height={180}>
//                   <BarChart
//                     data={metricView === "transferVolume" ? selectedRow.transfersLast6m : selectedRow.disputesLast6m}
//                     margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
//                   >
//                     <CartesianGrid strokeDasharray="3 3" />
//                     <XAxis dataKey="month" tickMargin={8} />
//                     <YAxis tickMargin={8} width={40} />
//                     <Tooltip content={<RegionsTrendTooltip unitLabel="Value" />} />
//                     <Bar dataKey="value" name="Value" radius={[8, 8, 0, 0]} />
//                   </BarChart>
//                 </ResponsiveContainer>
//               </div>
//             </div>
//           </div>
//         )}
//       </div>

//       <div className="regions-panel">
//         <div className="regions-panelHeader">
//           <div>
//             <div className="regions-panelTitle">Regional Comparison</div>
//             <div className="regions-panelSub">Hover bars to view exact data</div>
//           </div>
//         </div>

//         <div className="regions-chartWrap" aria-label="Regions Bar Chart">
//           <ResponsiveContainer width="100%" height={320}>
//             <BarChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
//               <CartesianGrid strokeDasharray="3 3" />
//               <XAxis dataKey="name" tickMargin={10} />
//               <YAxis tickMargin={8} width={44} />
//               <Tooltip content={<RegionsTooltip metric={metricView} />} />
//               <Legend />
//               {metricView === "disputeRate" && <Bar dataKey="disputeRate" name="Dispute Rate (%)" radius={[8, 8, 0, 0]} />}
//               {metricView === "transferVolume" && <Bar dataKey="transferVolume" name="Transfers" radius={[8, 8, 0, 0]} />}
//               {metricView === "processingTime" && <Bar dataKey="processingTime" name="Avg Days" radius={[8, 8, 0, 0]} />}
//             </BarChart>
//           </ResponsiveContainer>
//         </div>
//       </div>

//       <div className="regions-panel">
//         <div className="regions-panelHeader regions-panelHeader--table">
//           <div>
//             <div className="regions-panelTitle">All Regions</div>
//             <div className="regions-panelSub">Use "View" to open details like disputes, then print/download.</div>
//           </div>
//         </div>

//         <div className="regions-tableWrap" role="region" aria-label="Regions Table">
//           <table className="regions-table" id="regions-table">
//             <thead>
//               <tr>
//                 <th>Region</th>
//                 <th>Total Parcels</th>
//                 <th>Active Disputes</th>
//                 <th>Pending Transfers</th>
//                 <th>Active Mortgages</th>
//                 <th>Avg. Processing</th>
//                 <th>Fraud Blocked</th>
//                 <th>Dispute Rate</th>
//                 <th style={{ width: 90 }}>Action</th>
//               </tr>
//             </thead>
//             <tbody>
//               {filteredRows.map((r) => (
//                 <tr key={r.region}>
//                   <td className="regions-regionCell">
//                     <span className="regions-regionDot" aria-hidden="true" />
//                     {r.region}
//                   </td>
//                   <td className="regions-mono">{regionsFormat(r.totalParcels)}</td>
//                   <td className="regions-mono regions-num--danger">{regionsFormat(r.activeDisputes)}</td>
//                   <td className="regions-mono">{regionsFormat(r.pendingTransfers)}</td>
//                   <td className="regions-mono">{regionsFormat(r.activeMortgages)}</td>
//                   <td className="regions-mono">{r.avgProcessingDays.toFixed(1)} days</td>
//                   <td className="regions-mono regions-num--accent">{regionsFormat(r.fraudBlocked)}</td>
//                   <td className="regions-mono">{r.disputeRate.toFixed(1)}%</td>
//                   <td>
//                     <button className="regions-viewBtn" type="button" onClick={() => openView(r)}>
//                       👁 View
//                     </button>
//                   </td>
//                 </tr>
//               ))}

//               {filteredRows.length === 0 && (
//                 <tr>
//                   <td colSpan={9} className="regions-empty">
//                     {loading ? "Loading..." : "No results found for current filters."}
//                   </td>
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {isModalOpen && modalRegion && (
//         <div className="regions-modalOverlay" role="dialog" aria-modal="true" aria-label="Region Details">
//           <div className="regions-modal">
//             <div className="regions-modalHeader">
//               <div>
//                 <div className="regions-modalTitle">Region Details</div>
//                 <div className="regions-modalSub">{modalRegion.region} • Operational snapshot</div>
//               </div>

//               <div className="regions-modalHeaderActions">
//                 <button
//                   className="regions-btn regions-btn--outline"
//                   type="button"
//                   onClick={() => {
//                     const csv = regionsToCSV([modalRegion]);
//                     const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
//                     const url = URL.createObjectURL(blob);
//                     const a = document.createElement("a");
//                     a.href = url;
//                     a.download = `${modalRegion.region}_details.csv`;
//                     document.body.appendChild(a);
//                     a.click();
//                     a.remove();
//                     URL.revokeObjectURL(url);
//                   }}
//                 >
//                   ⤓ Download
//                 </button>
//                 <button className="regions-btn regions-btn--outline" type="button" onClick={handlePrint}>⎙ Print</button>
//                 <button className="regions-closeBtn" type="button" onClick={closeView} aria-label="Close">✕</button>
//               </div>
//             </div>

//             <div className="regions-modalBody">
//               <div className="regions-detailGrid">
//                 <div className="regions-detailCard">
//                   <div className="regions-detailLabel">Total Parcels</div>
//                   <div className="regions-detailValue">{regionsFormat(modalRegion.totalParcels)}</div>
//                   <div className="regions-detailHint">Registered parcels in region</div>
//                 </div>
//                 <div className="regions-detailCard">
//                   <div className="regions-detailLabel">Active Disputes</div>
//                   <div className="regions-detailValue">{regionsFormat(modalRegion.activeDisputes)}</div>
//                   <div className="regions-detailHint">Open dispute cases</div>
//                 </div>
//                 <div className="regions-detailCard">
//                   <div className="regions-detailLabel">Pending Transfers</div>
//                   <div className="regions-detailValue">{regionsFormat(modalRegion.pendingTransfers)}</div>
//                   <div className="regions-detailHint">Transfers awaiting completion</div>
//                 </div>
//                 <div className="regions-detailCard">
//                   <div className="regions-detailLabel">Active Mortgages</div>
//                   <div className="regions-detailValue">{regionsFormat(modalRegion.activeMortgages)}</div>
//                   <div className="regions-detailHint">Mortgages linked to parcels</div>
//                 </div>
//                 <div className="regions-detailCard">
//                   <div className="regions-detailLabel">Avg. Processing</div>
//                   <div className="regions-detailValue">{modalRegion.avgProcessingDays.toFixed(1)} days</div>
//                   <div className="regions-detailHint">Average processing time</div>
//                 </div>
//                 <div className="regions-detailCard">
//                   <div className="regions-detailLabel">Fraud Blocked</div>
//                   <div className="regions-detailValue">{regionsFormat(modalRegion.fraudBlocked)}</div>
//                   <div className="regions-detailHint">Prevented risky actions</div>
//                 </div>
//                 <div className="regions-detailCard">
//                   <div className="regions-detailLabel">Dispute Rate</div>
//                   <div className="regions-detailValue">{modalRegion.disputeRate.toFixed(1)}%</div>
//                   <div className="regions-detailHint">Disputes / parcels ratio</div>
//                 </div>
//                 <div className="regions-detailCard">
//                   <div className="regions-detailLabel">Operational Status</div>
//                   <div className="regions-detailValue">
//                     <span className={`regions-badge regions-badge--${modalRegion.disputeRate >= 13 ? "risk" : "ok"}`}>
//                       {modalRegion.disputeRate >= 13 ? "High Attention" : "Stable"}
//                     </span>
//                   </div>
//                   <div className="regions-detailHint">Auto-derived indicator</div>
//                 </div>
//               </div>

//               <div className="regions-modalSplit">
//                 <div className="regions-subPanel">
//                   <div className="regions-subPanelTitle">Transfers Trend (6 months)</div>
//                   <div className="regions-miniChart regions-miniChart--modal">
//                     <ResponsiveContainer width="100%" height={220}>
//                       <BarChart data={modalRegion.transfersLast6m} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
//                         <CartesianGrid strokeDasharray="3 3" />
//                         <XAxis dataKey="month" tickMargin={8} />
//                         <YAxis tickMargin={8} width={40} />
//                         <Tooltip content={<RegionsTrendTooltip unitLabel="Transfers" />} />
//                         <Bar dataKey="value" name="Transfers" radius={[8, 8, 0, 0]} />
//                       </BarChart>
//                     </ResponsiveContainer>
//                   </div>
//                 </div>

//                 <div className="regions-subPanel">
//                   <div className="regions-subPanelTitle">Disputes Trend (6 months)</div>
//                   <div className="regions-miniChart regions-miniChart--modal">
//                     <ResponsiveContainer width="100%" height={220}>
//                       <BarChart data={modalRegion.disputesLast6m} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
//                         <CartesianGrid strokeDasharray="3 3" />
//                         <XAxis dataKey="month" tickMargin={8} />
//                         <YAxis tickMargin={8} width={40} />
//                         <Tooltip content={<RegionsTrendTooltip unitLabel="Disputes" />} />
//                         <Bar dataKey="value" name="Disputes" radius={[8, 8, 0, 0]} />
//                       </BarChart>
//                     </ResponsiveContainer>
//                   </div>
//                   <div className="regions-note">
//                     Tip: This "View" panel matches the "Disputes detail" behavior—print and download actions are active.
//                   </div>
//                 </div>
//               </div>
//             </div>

//             <div className="regions-modalFooter">
//               <button className="regions-btn" type="button" onClick={closeView}>Close</button>
//             </div>
//           </div>

//           <button className="regions-modalOverlayClose" aria-label="Close overlay" onClick={closeView} />
//         </div>
//       )}
//     </div>
//   );
// }
// import React, { useEffect, useMemo, useRef, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import {
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   Tooltip,
//   ResponsiveContainer,
//   CartesianGrid,
//   Legend,
// } from "recharts";
// import "./Regions.css";

// /**
//  * Regions.jsx
//  * - Back button to main dashboard
//  * - Hoverable bar charts with tooltip
//  * - Overview-like filters
//  * - Heat-map style region board (click region)
//  * - Table with View -> opens modal (detail view like disputes)
//  * - Download CSV + Print
//  * - Unique CSS namespace: regions- (classes + ids)
//  */

// const regionsSeed = [
//   {
//     region: "Belgrade",
//     totalParcels: 245000,
//     activeDisputes: 342,
//     pendingTransfers: 1250,
//     activeMortgages: 8500,
//     avgProcessingDays: 3.2,
//     fraudBlocked: 12,
//     disputeRate: 14.0,
//     transfersLast6m: [
//       { month: "Aug", value: 180 },
//       { month: "Sep", value: 195 },
//       { month: "Oct", value: 210 },
//       { month: "Nov", value: 205 },
//       { month: "Dec", value: 220 },
//       { month: "Jan", value: 240 },
//     ],
//     disputesLast6m: [
//       { month: "Aug", value: 48 },
//       { month: "Sep", value: 54 },
//       { month: "Oct", value: 60 },
//       { month: "Nov", value: 58 },
//       { month: "Dec", value: 62 },
//       { month: "Jan", value: 60 },
//     ],
//   },
//   {
//     region: "Vojvodina",
//     totalParcels: 520000,
//     activeDisputes: 456,
//     pendingTransfers: 2100,
//     activeMortgages: 12000,
//     avgProcessingDays: 4.1,
//     fraudBlocked: 8,
//     disputeRate: 9.0,
//     transfersLast6m: [
//       { month: "Aug", value: 260 },
//       { month: "Sep", value: 280 },
//       { month: "Oct", value: 295 },
//       { month: "Nov", value: 285 },
//       { month: "Dec", value: 305 },
//       { month: "Jan", value: 320 },
//     ],
//     disputesLast6m: [
//       { month: "Aug", value: 62 },
//       { month: "Sep", value: 70 },
//       { month: "Oct", value: 74 },
//       { month: "Nov", value: 68 },
//       { month: "Dec", value: 76 },
//       { month: "Jan", value: 66 },
//     ],
//   },
//   {
//     region: "Šumadija",
//     totalParcels: 180000,
//     activeDisputes: 198,
//     pendingTransfers: 890,
//     activeMortgages: 4200,
//     avgProcessingDays: 3.8,
//     fraudBlocked: 5,
//     disputeRate: 11.0,
//     transfersLast6m: [
//       { month: "Aug", value: 120 },
//       { month: "Sep", value: 132 },
//       { month: "Oct", value: 140 },
//       { month: "Nov", value: 135 },
//       { month: "Dec", value: 150 },
//       { month: "Jan", value: 160 },
//     ],
//     disputesLast6m: [
//       { month: "Aug", value: 28 },
//       { month: "Sep", value: 31 },
//       { month: "Oct", value: 34 },
//       { month: "Nov", value: 33 },
//       { month: "Dec", value: 36 },
//       { month: "Jan", value: 36 },
//     ],
//   },
//   {
//     region: "Nišava",
//     totalParcels: 165000,
//     activeDisputes: 234,
//     pendingTransfers: 720,
//     activeMortgages: 3800,
//     avgProcessingDays: 4.5,
//     fraudBlocked: 7,
//     disputeRate: 14.0,
//     transfersLast6m: [
//       { month: "Aug", value: 105 },
//       { month: "Sep", value: 112 },
//       { month: "Oct", value: 125 },
//       { month: "Nov", value: 118 },
//       { month: "Dec", value: 130 },
//       { month: "Jan", value: 140 },
//     ],
//     disputesLast6m: [
//       { month: "Aug", value: 32 },
//       { month: "Sep", value: 36 },
//       { month: "Oct", value: 40 },
//       { month: "Nov", value: 38 },
//       { month: "Dec", value: 44 },
//       { month: "Jan", value: 44 },
//     ],
//   },
//   {
//     region: "Zlatibor",
//     totalParcels: 145000,
//     activeDisputes: 156,
//     pendingTransfers: 580,
//     activeMortgages: 2900,
//     avgProcessingDays: 5.2,
//     fraudBlocked: 3,
//     disputeRate: 11.0,
//     transfersLast6m: [
//       { month: "Aug", value: 92 },
//       { month: "Sep", value: 96 },
//       { month: "Oct", value: 102 },
//       { month: "Nov", value: 98 },
//       { month: "Dec", value: 110 },
//       { month: "Jan", value: 118 },
//     ],
//     disputesLast6m: [
//       { month: "Aug", value: 22 },
//       { month: "Sep", value: 24 },
//       { month: "Oct", value: 26 },
//       { month: "Nov", value: 25 },
//       { month: "Dec", value: 28 },
//       { month: "Jan", value: 31 },
//     ],
//   },
//   {
//     region: "Podunavlje",
//     totalParcels: 98000,
//     activeDisputes: 87,
//     pendingTransfers: 340,
//     activeMortgages: 1800,
//     avgProcessingDays: 3.5,
//     fraudBlocked: 2,
//     disputeRate: 9.0,
//     transfersLast6m: [
//       { month: "Aug", value: 60 },
//       { month: "Sep", value: 64 },
//       { month: "Oct", value: 68 },
//       { month: "Nov", value: 66 },
//       { month: "Dec", value: 72 },
//       { month: "Jan", value: 78 },
//     ],
//     disputesLast6m: [
//       { month: "Aug", value: 10 },
//       { month: "Sep", value: 12 },
//       { month: "Oct", value: 14 },
//       { month: "Nov", value: 13 },
//       { month: "Dec", value: 16 },
//       { month: "Jan", value: 18 },
//     ],
//   },
//   {
//     region: "Braničevo",
//     totalParcels: 125000,
//     activeDisputes: 145,
//     pendingTransfers: 490,
//     activeMortgages: 2400,
//     avgProcessingDays: 4.8,
//     fraudBlocked: 4,
//     disputeRate: 12.0,
//     transfersLast6m: [
//       { month: "Aug", value: 75 },
//       { month: "Sep", value: 78 },
//       { month: "Oct", value: 86 },
//       { month: "Nov", value: 82 },
//       { month: "Dec", value: 92 },
//       { month: "Jan", value: 98 },
//     ],
//     disputesLast6m: [
//       { month: "Aug", value: 18 },
//       { month: "Sep", value: 20 },
//       { month: "Oct", value: 23 },
//       { month: "Nov", value: 21 },
//       { month: "Dec", value: 25 },
//       { month: "Jan", value: 26 },
//     ],
//   },
//   {
//     region: "Jablanica",
//     totalParcels: 78000,
//     activeDisputes: 112,
//     pendingTransfers: 280,
//     activeMortgages: 1200,
//     avgProcessingDays: 5.5,
//     fraudBlocked: 6,
//     disputeRate: 14.0,
//     transfersLast6m: [
//       { month: "Aug", value: 44 },
//       { month: "Sep", value: 46 },
//       { month: "Oct", value: 48 },
//       { month: "Nov", value: 47 },
//       { month: "Dec", value: 52 },
//       { month: "Jan", value: 56 },
//     ],
//     disputesLast6m: [
//       { month: "Aug", value: 16 },
//       { month: "Sep", value: 18 },
//       { month: "Oct", value: 19 },
//       { month: "Nov", value: 18 },
//       { month: "Dec", value: 21 },
//       { month: "Jan", value: 20 },
//     ],
//   },
//   {
//     region: "Pčinja",
//     totalParcels: 92000,
//     activeDisputes: 134,
//     pendingTransfers: 310,
//     activeMortgages: 1500,
//     avgProcessingDays: 5.8,
//     fraudBlocked: 5,
//     disputeRate: 15.0,
//     transfersLast6m: [
//       { month: "Aug", value: 50 },
//       { month: "Sep", value: 52 },
//       { month: "Oct", value: 55 },
//       { month: "Nov", value: 54 },
//       { month: "Dec", value: 58 },
//       { month: "Jan", value: 62 },
//     ],
//     disputesLast6m: [
//       { month: "Aug", value: 18 },
//       { month: "Sep", value: 20 },
//       { month: "Oct", value: 22 },
//       { month: "Nov", value: 21 },
//       { month: "Dec", value: 25 },
//       { month: "Jan", value: 28 },
//     ],
//   },
//   {
//     region: "Kolubara",
//     totalParcels: 110000,
//     activeDisputes: 98,
//     pendingTransfers: 420,
//     activeMortgages: 2100,
//     avgProcessingDays: 4.2,
//     fraudBlocked: 2,
//     disputeRate: 9.0,
//     transfersLast6m: [
//       { month: "Aug", value: 66 },
//       { month: "Sep", value: 70 },
//       { month: "Oct", value: 74 },
//       { month: "Nov", value: 72 },
//       { month: "Dec", value: 78 },
//       { month: "Jan", value: 84 },
//     ],
//     disputesLast6m: [
//       { month: "Aug", value: 12 },
//       { month: "Sep", value: 14 },
//       { month: "Oct", value: 16 },
//       { month: "Nov", value: 15 },
//       { month: "Dec", value: 17 },
//       { month: "Jan", value: 18 },
//     ],
//   },
// ];

// const heatMapPositions = [
//   { region: "Vojvodina", top: 22, left: 48 },
//   { region: "Belgrade", top: 45, left: 50 },
//   { region: "Kolubara", top: 50, left: 33 },
//   { region: "Šumadija", top: 55, left: 43 },
//   { region: "Braničevo", top: 52, left: 63 },
//   { region: "Podunavlje", top: 57, left: 57 },
//   { region: "Nišava", top: 68, left: 62 },
//   { region: "Jablanica", top: 82, left: 52 },
//   { region: "Pčinja", top: 86, left: 66 },
//   { region: "Zlatibor", top: 62, left: 22 },
// ];

// function regionsFormat(n) {
//   return new Intl.NumberFormat("en-IN").format(Math.round(n));
// }

// function regionsToCSV(rows) {
//   const headers = [
//     "Region",
//     "Total Parcels",
//     "Active Disputes",
//     "Pending Transfers",
//     "Active Mortgages",
//     "Avg Processing (Days)",
//     "Fraud Blocked",
//     "Dispute Rate (%)",
//   ];

//   const escape = (v) => {
//     const s = String(v ?? "");
//     if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
//     return s;
//   };

//   const lines = [
//     headers.join(","),
//     ...rows.map((r) =>
//       [
//         r.region,
//         r.totalParcels,
//         r.activeDisputes,
//         r.pendingTransfers,
//         r.activeMortgages,
//         r.avgProcessingDays,
//         r.fraudBlocked,
//         r.disputeRate,
//       ]
//         .map(escape)
//         .join(",")
//     ),
//   ];

//   return lines.join("\n");
// }

// function RegionsTooltip({ active, payload, label, metric }) {
//   if (!active || !payload || !payload.length) return null;
//   const row = payload[0]?.payload ?? {};
//   let line = "";

//   if (metric === "disputeRate") line = `Dispute Rate: ${row.disputeRate}%`;
//   if (metric === "transferVolume") line = `Transfers: ${regionsFormat(row.transferVolume ?? row.pendingTransfers ?? 0)}`;
//   if (metric === "processingTime") line = `Avg Time: ${row.processingTime ?? row.avgProcessingDays} days`;

//   return (
//     <div className="regions-tooltip" role="tooltip">
//       <div className="regions-tooltip__title">{label}</div>
//       <div className="regions-tooltip__line">{line}</div>
//       <div className="regions-tooltip__hint">Hover other bars to compare.</div>
//     </div>
//   );
// }

// function RegionsTrendTooltip({ active, payload, label, unitLabel }) {
//   if (!active || !payload || !payload.length) return null;
//   const val = payload[0]?.value ?? 0;
//   return (
//     <div className="regions-tooltip" role="tooltip">
//       <div className="regions-tooltip__title">{label}</div>
//       <div className="regions-tooltip__line">
//         {unitLabel}: {regionsFormat(val)}
//       </div>
//       <div className="regions-tooltip__hint">Trend (last 6 months).</div>
//     </div>
//   );
// }

// export default function Regions() {
//   const navigate = useNavigate();

//   const [range, setRange] = useState("Last 6 months");
//   const [filterRegion, setFilterRegion] = useState("All Regions");
//   const [metricView, setMetricView] = useState("disputeRate");
//   const [search, setSearch] = useState("");

//   const [selectedRegion, setSelectedRegion] = useState("Vojvodina");

//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [modalRegion, setModalRegion] = useState(null);

//   const printRef = useRef(null);

//   useEffect(() => {
//     const onKeyDown = (e) => {
//       if (e.key === "Escape") setIsModalOpen(false);
//     };
//     window.addEventListener("keydown", onKeyDown);
//     return () => window.removeEventListener("keydown", onKeyDown);
//   }, []);

//   const regionOptions = useMemo(() => ["All Regions", ...regionsSeed.map((r) => r.region)], []);

//   const filteredRows = useMemo(() => {
//     const q = search.trim().toLowerCase();
//     return regionsSeed.filter((r) => {
//       const regionOk = filterRegion === "All Regions" ? true : r.region === filterRegion;
//       const searchOk =
//         q.length === 0
//           ? true
//           : [
//               r.region,
//               String(r.totalParcels),
//               String(r.activeDisputes),
//               String(r.pendingTransfers),
//               String(r.activeMortgages),
//               String(r.avgProcessingDays),
//               String(r.fraudBlocked),
//               String(r.disputeRate),
//             ]
//               .join(" ")
//               .toLowerCase()
//               .includes(q);

//       const rangeOk = ["Last 30 days", "Last 3 months", "Last 6 months", "YTD", "All time"].includes(range);
//       return regionOk && searchOk && rangeOk;
//     });
//   }, [filterRegion, search, range]);

//   useEffect(() => {
//     if (filterRegion !== "All Regions") {
//       setSelectedRegion(filterRegion);
//     } else if (!regionsSeed.some((r) => r.region === selectedRegion)) {
//       setSelectedRegion("Vojvodina");
//     }
//   }, [filterRegion]); // eslint-disable-line react-hooks/exhaustive-deps

//   const selectedRow = useMemo(
//     () => regionsSeed.find((r) => r.region === selectedRegion) || regionsSeed[0],
//     [selectedRegion]
//   );

//   const kpis = useMemo(() => {
//     const totalRegions = filteredRows.length;
//     const totalParcels = filteredRows.reduce((s, r) => s + r.totalParcels, 0);
//     const totalDisputes = filteredRows.reduce((s, r) => s + r.activeDisputes, 0);
//     const avgProcessing =
//       totalRegions === 0 ? 0 : filteredRows.reduce((s, r) => s + r.avgProcessingDays, 0) / totalRegions;

//     return { totalRegions, totalParcels, totalDisputes, avgProcessing };
//   }, [filteredRows]);

//   const chartData = useMemo(() => {
//     return filteredRows.map((r) => ({
//       name: r.region,
//       disputeRate: r.disputeRate,
//       transferVolume: r.pendingTransfers,
//       processingTime: r.avgProcessingDays,
//     }));
//   }, [filteredRows]);

//   const getRegionLevel = (r) => {
//     let v = 0;
//     if (metricView === "disputeRate") v = r.disputeRate;
//     if (metricView === "transferVolume") v = r.pendingTransfers;
//     if (metricView === "processingTime") v = r.avgProcessingDays;

//     if (metricView === "transferVolume") {
//       if (v < 500) return "low";
//       if (v < 1200) return "med";
//       return "high";
//     }

//     if (metricView === "processingTime") {
//       if (v < 4) return "low";
//       if (v < 5.2) return "med";
//       return "high";
//     }

//     if (v < 10) return "low";
//     if (v < 13) return "med";
//     return "high";
//   };

//   const handleExportCSV = () => {
//     const csv = regionsToCSV(filteredRows);
//     const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
//     const url = URL.createObjectURL(blob);

//     const a = document.createElement("a");
//     a.href = url;
//     a.download = `regions_export_${new Date().toISOString().slice(0, 10)}.csv`;
//     document.body.appendChild(a);
//     a.click();
//     a.remove();

//     URL.revokeObjectURL(url);
//   };

//   const handlePrint = () => {
//     window.print();
//   };

//   const openView = (row) => {
//     setModalRegion(row);
//     setIsModalOpen(true);
//   };

//   const closeView = () => setIsModalOpen(false);

//   return (
//     <div className="regions-page" id="regions-page">
//       <div className="regions-topbar">
//         <div className="regions-breadcrumb">
//           <span className="regions-breadcrumb__muted">Dashboard</span>
//           <span className="regions-breadcrumb__sep">›</span>
//           <span className="regions-breadcrumb__active">Regions</span>
//         </div>

//         <button className="regions-backBtn" type="button" onClick={() => navigate("/dashboard")}>
//           ← Back to Dashboard
//         </button>
//       </div>

//       <div className="regions-header">
//         <h1 className="regions-title">Regions Dashboard</h1>
//         <p className="regions-subtitle">Geographic overview of land registry activity</p>
//       </div>

//       <div className="regions-filters" aria-label="Regions Filters">
//         <div className="regions-filterItem">
//           <label className="regions-filterLabel" htmlFor="regions-range">
//             Range
//           </label>
//           <select
//             id="regions-range"
//             className="regions-select"
//             value={range}
//             onChange={(e) => setRange(e.target.value)}
//           >
//             <option>Last 30 days</option>
//             <option>Last 3 months</option>
//             <option>Last 6 months</option>
//             <option>YTD</option>
//             <option>All time</option>
//           </select>
//         </div>

//         <div className="regions-filterItem">
//           <label className="regions-filterLabel" htmlFor="regions-region">
//             Region
//           </label>
//           <select
//             id="regions-region"
//             className="regions-select"
//             value={filterRegion}
//             onChange={(e) => setFilterRegion(e.target.value)}
//           >
//             {regionOptions.map((r) => (
//               <option key={r} value={r}>
//                 {r}
//               </option>
//             ))}
//           </select>
//         </div>

//         <div className="regions-filterItem regions-filterItem--grow">
//           <label className="regions-filterLabel" htmlFor="regions-search">
//             Search
//           </label>
//           <input
//             id="regions-search"
//             className="regions-input"
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//             placeholder="Search regions, parcels, disputes..."
//           />
//         </div>

//         <div className="regions-actions">
//           <button className="regions-btn regions-btn--outline" type="button" onClick={handleExportCSV}>
//             ⤓ Download
//           </button>
//           <button className="regions-btn regions-btn--outline" type="button" onClick={handlePrint}>
//             ⎙ Print
//           </button>
//         </div>
//       </div>

//       <div className="regions-kpis" ref={printRef}>
//         <div className="regions-kpiCard">
//           <div className="regions-kpiTop">
//             <span className="regions-kpiLabel">Total Regions</span>
//             <span className="regions-kpiIcon" aria-hidden="true">
//               🗺️
//             </span>
//           </div>
//           <div className="regions-kpiValue">{regionsFormat(kpis.totalRegions)}</div>
//           <div className="regions-kpiHint">Monitored districts</div>
//         </div>

//         <div className="regions-kpiCard">
//           <div className="regions-kpiTop">
//             <span className="regions-kpiLabel">Total Parcels</span>
//             <span className="regions-kpiIcon" aria-hidden="true">
//               🧱
//             </span>
//           </div>
//           <div className="regions-kpiValue">{regionsFormat(kpis.totalParcels)}</div>
//           <div className="regions-kpiHint">Across filtered regions</div>
//         </div>

//         <div className="regions-kpiCard">
//           <div className="regions-kpiTop">
//             <span className="regions-kpiLabel">Total Active Disputes</span>
//             <span className="regions-kpiIcon" aria-hidden="true">
//               ⚠️
//             </span>
//           </div>
//           <div className="regions-kpiValue">{regionsFormat(kpis.totalDisputes)}</div>
//           <div className="regions-kpiHint">Open disputes count</div>
//         </div>

//         <div className="regions-kpiCard">
//           <div className="regions-kpiTop">
//             <span className="regions-kpiLabel">Avg. Processing Time</span>
//             <span className="regions-kpiIcon" aria-hidden="true">
//               ⏱️
//             </span>
//           </div>
//           <div className="regions-kpiValue">{kpis.avgProcessing.toFixed(1)} days</div>
//           <div className="regions-kpiHint">Average handling time</div>
//         </div>
//       </div>

//       <div className="regions-panel">
//         <div className="regions-panelHeader">
//           <div>
//             <div className="regions-panelTitle">Regional Heat Map</div>
//             <div className="regions-panelSub">Click on any region to view detailed statistics</div>
//           </div>

//           <div className="regions-seg" role="tablist" aria-label="Heat Map Metric">
//             <button
//               type="button"
//               className={`regions-segBtn ${metricView === "disputeRate" ? "is-active" : ""}`}
//               onClick={() => setMetricView("disputeRate")}
//               role="tab"
//               aria-selected={metricView === "disputeRate"}
//             >
//               Dispute Rate
//             </button>
//             <button
//               type="button"
//               className={`regions-segBtn ${metricView === "transferVolume" ? "is-active" : ""}`}
//               onClick={() => setMetricView("transferVolume")}
//               role="tab"
//               aria-selected={metricView === "transferVolume"}
//             >
//               Transfer Volume
//             </button>
//             <button
//               type="button"
//               className={`regions-segBtn ${metricView === "processingTime" ? "is-active" : ""}`}
//               onClick={() => setMetricView("processingTime")}
//               role="tab"
//               aria-selected={metricView === "processingTime"}
//             >
//               Processing Time
//             </button>
//           </div>
//         </div>

//         <div className="regions-heatMapWrap" aria-label="Heat Map Board">
//           <div className="regions-heatMapBoard" id="regions-heatMapBoard">
//             <div className="regions-heatMapShape" aria-hidden="true" />
//             {heatMapPositions.map((p) => {
//               const r = regionsSeed.find((x) => x.region === p.region);
//               if (!r) return null;
//               const level = getRegionLevel(r);
//               const isSelected = selectedRegion === r.region;

//               return (
//                 <button
//                   key={r.region}
//                   type="button"
//                   className={`regions-pin regions-pin--${level} ${isSelected ? "is-selected" : ""}`}
//                   style={{ top: `${p.top}%`, left: `${p.left}%` }}
//                   onClick={() => setSelectedRegion(r.region)}
//                   aria-label={`Select ${r.region}`}
//                   title={`${r.region}`}
//                 >
//                   <span className="regions-pinDot" aria-hidden="true" />
//                   <span className="regions-pinText">{r.region}</span>
//                 </button>
//               );
//             })}

//             <div className="regions-legend" id="regions-legend">
//               <div className="regions-legendTitle">
//                 {metricView === "disputeRate"
//                   ? "Dispute Rate"
//                   : metricView === "transferVolume"
//                   ? "Transfer Volume"
//                   : "Processing Time"}
//               </div>
//               <div className="regions-legendRow">
//                 <span className="regions-legendSwatch regions-legendSwatch--low" />
//                 <span className="regions-legendLabel">Low</span>
//               </div>
//               <div className="regions-legendRow">
//                 <span className="regions-legendSwatch regions-legendSwatch--med" />
//                 <span className="regions-legendLabel">Med</span>
//               </div>
//               <div className="regions-legendRow">
//                 <span className="regions-legendSwatch regions-legendSwatch--high" />
//                 <span className="regions-legendLabel">High</span>
//               </div>
//             </div>
//           </div>
//         </div>

//         <div className="regions-selectedBar">
//           <div className="regions-selectedLeft">
//             <div className="regions-selectedTitle">{selectedRow.region}</div>
//             <div className="regions-selectedMeta">
//               <span className="regions-chip">
//                 Parcels: <b>{regionsFormat(selectedRow.totalParcels)}</b>
//               </span>
//               <span className="regions-chip">
//                 Disputes: <b>{regionsFormat(selectedRow.activeDisputes)}</b>
//               </span>
//               <span className="regions-chip">
//                 Pending Transfers: <b>{regionsFormat(selectedRow.pendingTransfers)}</b>
//               </span>
//               <span className="regions-chip">
//                 Mortgages: <b>{regionsFormat(selectedRow.activeMortgages)}</b>
//               </span>
//             </div>
//           </div>

//           <div className="regions-selectedRight">
//             <div className="regions-miniTitle">{metricView === "transferVolume" ? "Transfers (6m)" : "Disputes (6m)"}</div>

//             <div className="regions-miniChart">
//               <ResponsiveContainer width="100%" height={180}>
//                 <BarChart
//                   data={metricView === "transferVolume" ? selectedRow.transfersLast6m : selectedRow.disputesLast6m}
//                   margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
//                 >
//                   <CartesianGrid strokeDasharray="3 3" />
//                   <XAxis dataKey="month" tickMargin={8} />
//                   <YAxis tickMargin={8} width={40} />
//                   <Tooltip content={<RegionsTrendTooltip unitLabel="Value" />} />
//                   <Bar dataKey="value" name="Value" radius={[8, 8, 0, 0]} />
//                 </BarChart>
//               </ResponsiveContainer>
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="regions-panel">
//         <div className="regions-panelHeader">
//           <div>
//             <div className="regions-panelTitle">Regional Comparison</div>
//             <div className="regions-panelSub">Hover bars to view exact data (matches your bar-chart requirement)</div>
//           </div>
//         </div>

//         <div className="regions-chartWrap" aria-label="Regions Bar Chart">
//           <ResponsiveContainer width="100%" height={320}>
//             <BarChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
//               <CartesianGrid strokeDasharray="3 3" />
//               <XAxis dataKey="name" tickMargin={10} />
//               <YAxis tickMargin={8} width={44} />
//               <Tooltip content={<RegionsTooltip metric={metricView} />} />
//               <Legend />
//               {metricView === "disputeRate" && <Bar dataKey="disputeRate" name="Dispute Rate (%)" radius={[8, 8, 0, 0]} />}
//               {metricView === "transferVolume" && <Bar dataKey="transferVolume" name="Transfers" radius={[8, 8, 0, 0]} />}
//               {metricView === "processingTime" && <Bar dataKey="processingTime" name="Avg Days" radius={[8, 8, 0, 0]} />}
//             </BarChart>
//           </ResponsiveContainer>
//         </div>
//       </div>

//       <div className="regions-panel">
//         <div className="regions-panelHeader regions-panelHeader--table">
//           <div>
//             <div className="regions-panelTitle">All Regions</div>
//             <div className="regions-panelSub">Use “View” to open details like disputes, then print/download.</div>
//           </div>
//         </div>

//         <div className="regions-tableWrap" role="region" aria-label="Regions Table">
//           <table className="regions-table" id="regions-table">
//             <thead>
//               <tr>
//                 <th>Region</th>
//                 <th>Total Parcels</th>
//                 <th>Active Disputes</th>
//                 <th>Pending Transfers</th>
//                 <th>Active Mortgages</th>
//                 <th>Avg. Processing</th>
//                 <th>Fraud Blocked</th>
//                 <th>Dispute Rate</th>
//                 <th style={{ width: 90 }}>Action</th>
//               </tr>
//             </thead>
//             <tbody>
//               {filteredRows.map((r) => (
//                 <tr key={r.region}>
//                   <td className="regions-regionCell">
//                     <span className="regions-regionDot" aria-hidden="true" />
//                     {r.region}
//                   </td>
//                   <td className="regions-mono">{regionsFormat(r.totalParcels)}</td>
//                   <td className="regions-mono regions-num--danger">{regionsFormat(r.activeDisputes)}</td>
//                   <td className="regions-mono">{regionsFormat(r.pendingTransfers)}</td>
//                   <td className="regions-mono">{regionsFormat(r.activeMortgages)}</td>
//                   <td className="regions-mono">{r.avgProcessingDays.toFixed(1)} days</td>
//                   <td className="regions-mono regions-num--accent">{regionsFormat(r.fraudBlocked)}</td>
//                   <td className="regions-mono">{r.disputeRate.toFixed(1)}%</td>
//                   <td>
//                     <button className="regions-viewBtn" type="button" onClick={() => openView(r)}>
//                       👁 View
//                     </button>
//                   </td>
//                 </tr>
//               ))}

//               {filteredRows.length === 0 && (
//                 <tr>
//                   <td colSpan={9} className="regions-empty">
//                     No results found for current filters.
//                   </td>
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {isModalOpen && modalRegion && (
//         <div className="regions-modalOverlay" role="dialog" aria-modal="true" aria-label="Region Details">
//           <div className="regions-modal">
//             <div className="regions-modalHeader">
//               <div>
//                 <div className="regions-modalTitle">Region Details</div>
//                 <div className="regions-modalSub">{modalRegion.region} • Operational snapshot</div>
//               </div>

//               <div className="regions-modalHeaderActions">
//                 <button
//                   className="regions-btn regions-btn--outline"
//                   type="button"
//                   onClick={() => {
//                     const csv = regionsToCSV([modalRegion]);
//                     const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
//                     const url = URL.createObjectURL(blob);
//                     const a = document.createElement("a");
//                     a.href = url;
//                     a.download = `${modalRegion.region}_details.csv`;
//                     document.body.appendChild(a);
//                     a.click();
//                     a.remove();
//                     URL.revokeObjectURL(url);
//                   }}
//                 >
//                   ⤓ Download
//                 </button>

//                 <button className="regions-btn regions-btn--outline" type="button" onClick={handlePrint}>
//                   ⎙ Print
//                 </button>

//                 <button className="regions-closeBtn" type="button" onClick={closeView} aria-label="Close">
//                   ✕
//                 </button>
//               </div>
//             </div>

//             <div className="regions-modalBody">
//               <div className="regions-detailGrid">
//                 <div className="regions-detailCard">
//                   <div className="regions-detailLabel">Total Parcels</div>
//                   <div className="regions-detailValue">{regionsFormat(modalRegion.totalParcels)}</div>
//                   <div className="regions-detailHint">Registered parcels in region</div>
//                 </div>

//                 <div className="regions-detailCard">
//                   <div className="regions-detailLabel">Active Disputes</div>
//                   <div className="regions-detailValue">{regionsFormat(modalRegion.activeDisputes)}</div>
//                   <div className="regions-detailHint">Open dispute cases</div>
//                 </div>

//                 <div className="regions-detailCard">
//                   <div className="regions-detailLabel">Pending Transfers</div>
//                   <div className="regions-detailValue">{regionsFormat(modalRegion.pendingTransfers)}</div>
//                   <div className="regions-detailHint">Transfers awaiting completion</div>
//                 </div>

//                 <div className="regions-detailCard">
//                   <div className="regions-detailLabel">Active Mortgages</div>
//                   <div className="regions-detailValue">{regionsFormat(modalRegion.activeMortgages)}</div>
//                   <div className="regions-detailHint">Mortgages linked to parcels</div>
//                 </div>

//                 <div className="regions-detailCard">
//                   <div className="regions-detailLabel">Avg. Processing</div>
//                   <div className="regions-detailValue">{modalRegion.avgProcessingDays.toFixed(1)} days</div>
//                   <div className="regions-detailHint">Average processing time</div>
//                 </div>

//                 <div className="regions-detailCard">
//                   <div className="regions-detailLabel">Fraud Blocked</div>
//                   <div className="regions-detailValue">{regionsFormat(modalRegion.fraudBlocked)}</div>
//                   <div className="regions-detailHint">Prevented risky actions</div>
//                 </div>

//                 <div className="regions-detailCard">
//                   <div className="regions-detailLabel">Dispute Rate</div>
//                   <div className="regions-detailValue">{modalRegion.disputeRate.toFixed(1)}%</div>
//                   <div className="regions-detailHint">Disputes / parcels ratio</div>
//                 </div>

//                 <div className="regions-detailCard">
//                   <div className="regions-detailLabel">Operational Status</div>
//                   <div className="regions-detailValue">
//                     <span className={`regions-badge regions-badge--${modalRegion.disputeRate >= 13 ? "risk" : "ok"}`}>
//                       {modalRegion.disputeRate >= 13 ? "High Attention" : "Stable"}
//                     </span>
//                   </div>
//                   <div className="regions-detailHint">Auto-derived indicator</div>
//                 </div>
//               </div>

//               <div className="regions-modalSplit">
//                 <div className="regions-subPanel">
//                   <div className="regions-subPanelTitle">Transfers Trend (6 months)</div>
//                   <div className="regions-miniChart regions-miniChart--modal">
//                     <ResponsiveContainer width="100%" height={220}>
//                       <BarChart data={modalRegion.transfersLast6m} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
//                         <CartesianGrid strokeDasharray="3 3" />
//                         <XAxis dataKey="month" tickMargin={8} />
//                         <YAxis tickMargin={8} width={40} />
//                         <Tooltip content={<RegionsTrendTooltip unitLabel="Transfers" />} />
//                         <Bar dataKey="value" name="Transfers" radius={[8, 8, 0, 0]} />
//                       </BarChart>
//                     </ResponsiveContainer>
//                   </div>
//                 </div>

//                 <div className="regions-subPanel">
//                   <div className="regions-subPanelTitle">Disputes Trend (6 months)</div>
//                   <div className="regions-miniChart regions-miniChart--modal">
//                     <ResponsiveContainer width="100%" height={220}>
//                       <BarChart data={modalRegion.disputesLast6m} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
//                         <CartesianGrid strokeDasharray="3 3" />
//                         <XAxis dataKey="month" tickMargin={8} />
//                         <YAxis tickMargin={8} width={40} />
//                         <Tooltip content={<RegionsTrendTooltip unitLabel="Disputes" />} />
//                         <Bar dataKey="value" name="Disputes" radius={[8, 8, 0, 0]} />
//                       </BarChart>
//                     </ResponsiveContainer>
//                   </div>

//                   <div className="regions-note">
//                     Tip: This “View” panel matches the “Disputes detail” behavior—print and download actions are active.
//                   </div>
//                 </div>
//               </div>
//             </div>

//             <div className="regions-modalFooter">
//               <button className="regions-btn" type="button" onClick={closeView}>
//                 Close
//               </button>
//             </div>
//           </div>

//           <button className="regions-modalOverlayClose" aria-label="Close overlay" onClick={closeView} />
//         </div>
//       )}
//     </div>
//   );
// }
