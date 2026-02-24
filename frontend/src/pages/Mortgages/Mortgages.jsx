// Mortgages.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./mortgages.css";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const YM_MORT_PAGE_ID = "ym-mortgages-page";

const STATUS_META = {
  Active: { pillClass: "ym-mort-pill ym-mort-pill--active" },
  Paid: { pillClass: "ym-mort-pill ym-mort-pill--paid" },
  Defaulted: { pillClass: "ym-mort-pill ym-mort-pill--defaulted" },
  Foreclosure: { pillClass: "ym-mort-pill ym-mort-pill--foreclosure" },
};

const PIE_COLORS = ["#111827", "#6B7280", "#EF4444", "#F97316"];

const formatEUR = (value) => {
  const n = Number(value || 0);
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
};

const parseDmy = (dmy) => {
  if (!dmy) return null;
  const cleaned = String(dmy).replace(/\s/g, "").replace(/\.$/, "");
  const parts = cleaned.split(".");
  if (parts.length < 3) return null;
  const dd = Number(parts[0]);
  const mm = Number(parts[1]) - 1;
  const yy = Number(parts[2]);
  const dt = new Date(yy, mm, dd);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const withinRange = (dateObj, daysBack) => {
  if (!dateObj) return false;
  const now = new Date();
  const from = new Date();
  from.setDate(now.getDate() - daysBack);
  return dateObj >= from && dateObj <= now;
};

const downloadTextFile = (filename, text, mime = "text/plain;charset=utf-8") => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const toCsv = (rows) => {
  const headers = [
    "Mortgage ID",
    "Parcel ID",
    "Region",
    "Bank",
    "Status",
    "Original Amount",
    "Remaining",
    "Monthly",
    "Start Date",
  ];
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.mortgageId,
        r.parcelId,
        r.region,
        r.bank,
        r.status,
        r.originalAmount,
        r.remaining,
        r.monthly ?? "",
        r.startDate,
      ]
        .map(esc)
        .join(",")
    ),
  ].join("\n");
};

const YmMortTooltipBox = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  const name = payload[0]?.name || payload[0]?.dataKey || "Value";
  return (
    <div className="ym-mort-tooltip" role="tooltip">
      <div className="ym-mort-tooltip__title">{label}</div>
      <div className="ym-mort-tooltip__row">
        <span className="ym-mort-tooltip__dot" />
        <span className="ym-mort-tooltip__kv">
          {name}: <strong>{v}</strong>
        </span>
      </div>
    </div>
  );
};

export default function Mortgages() {
  // ✅ Demo data MUST show in table and charts
  const [ymMortData] = useState([
    {
      mortgageId: "MTG-2024-001",
      parcelId: "BEL-11111",
      region: "Belgrade",
      bank: "Banca Intesa",
      status: "Active",
      originalAmount: 150000,
      remaining: 125000,
      monthly: 1250,
      startDate: "15. 3. 2022.",
    },
    {
      mortgageId: "MTG-2024-002",
      parcelId: "VOJ-22222",
      region: "Vojvodina",
      bank: "Erste Bank",
      status: "Active",
      originalAmount: 85000,
      remaining: 62000,
      monthly: 780,
      startDate: "20. 6. 2021.",
    },
    {
      mortgageId: "MTG-2024-003",
      parcelId: "BEL-33333",
      region: "Belgrade",
      bank: "UniCredit",
      status: "Active",
      originalAmount: 320000,
      remaining: 305000,
      monthly: 2800,
      startDate: "10. 1. 2023.",
    },
    {
      mortgageId: "MTG-2024-004",
      parcelId: "SUM-44444",
      region: "Šumadija",
      bank: "Komercijalna Banka",
      status: "Paid",
      originalAmount: 95000,
      remaining: 0,
      monthly: null,
      startDate: "12. 5. 2018.",
    },
    {
      mortgageId: "MTG-2024-005",
      parcelId: "NIS-55555",
      region: "Nišava",
      bank: "AIK Banka",
      status: "Defaulted",
      originalAmount: 45000,
      remaining: 38000,
      monthly: 520,
      startDate: "1. 9. 2020.",
    },
    {
      mortgageId: "MTG-2024-006",
      parcelId: "ZLA-66666",
      region: "Zlatibor",
      bank: "Raiffeisen",
      status: "Active",
      originalAmount: 180000,
      remaining: 165000,
      monthly: 1650,
      startDate: "20. 11. 2022.",
    },
    {
      mortgageId: "MTG-2024-007",
      parcelId: "VOJ-77777",
      region: "Vojvodina",
      bank: "OTP Banka",
      status: "Active",
      originalAmount: 220000,
      remaining: 215000,
      monthly: 1980,
      startDate: "5. 4. 2023.",
    },
    {
      mortgageId: "MTG-2024-008",
      parcelId: "BEL-88888",
      region: "Belgrade",
      bank: "Banca Intesa",
      status: "Foreclosure",
      originalAmount: 450000,
      remaining: 380000,
      monthly: 4200,
      startDate: "15. 8. 2019.",
    },
    {
      mortgageId: "MTG-2024-009",
      parcelId: "POD-99999",
      region: "Podunavlje",
      bank: "Erste Bank",
      status: "Active",
      originalAmount: 65000,
      remaining: 52000,
      monthly: 680,
      startDate: "1. 7. 2022.",
    },
    {
      mortgageId: "MTG-2024-010",
      parcelId: "KOL-10101",
      region: "Kolubara",
      bank: "UniCredit",
      status: "Active",
      originalAmount: 110000,
      remaining: 85000,
      monthly: 1100,
      startDate: "10. 12. 2021.",
    },
  ]);

  const [ymMortSearch, setYmMortSearch] = useState("");
  const [ymMortRegion, setYmMortRegion] = useState("All Regions");
  const [ymMortStatus, setYmMortStatus] = useState("All Statuses");
  // ✅ IMPORTANT: default is All time so data is visible immediately
  const [ymMortDateRange, setYmMortDateRange] = useState("All time");
  const [ymMortSelectedRow, setYmMortSelectedRow] = useState(null);

  const ymMortRegions = useMemo(() => {
    const set = new Set(ymMortData.map((d) => d.region));
    return ["All Regions", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [ymMortData]);

  const ymMortStatuses = useMemo(() => ["All Statuses", ...Object.keys(STATUS_META)], []);

  const ymMortDateRanges = useMemo(
    () => [
      { label: "Last 30 days", days: 30 },
      { label: "Last 90 days", days: 90 },
      { label: "Last 365 days", days: 365 },
      { label: "All time", days: null },
    ],
    []
  );

  const ymMortFiltered = useMemo(() => {
    const q = ymMortSearch.trim().toLowerCase();
    const rangeObj = ymMortDateRanges.find((d) => d.label === ymMortDateRange) || ymMortDateRanges[3];

    return ymMortData.filter((r) => {
      const matchesSearch =
        !q ||
        r.mortgageId.toLowerCase().includes(q) ||
        r.parcelId.toLowerCase().includes(q) ||
        r.bank.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q);

      const matchesRegion = ymMortRegion === "All Regions" || r.region === ymMortRegion;
      const matchesStatus = ymMortStatus === "All Statuses" || r.status === ymMortStatus;

      const dt = parseDmy(r.startDate);
      const matchesDate = rangeObj.days == null ? true : withinRange(dt, rangeObj.days);

      return matchesSearch && matchesRegion && matchesStatus && matchesDate;
    });
  }, [ymMortData, ymMortSearch, ymMortRegion, ymMortStatus, ymMortDateRange, ymMortDateRanges]);

  const ymMortKpis = useMemo(() => {
    const active = ymMortFiltered.filter((r) => r.status === "Active");
    const atRisk = ymMortFiltered.filter((r) => r.status === "Defaulted" || r.status === "Foreclosure");
    const totalRegistered = ymMortFiltered.reduce((s, r) => s + (r.originalAmount || 0), 0);
    const outstandingActive = active.reduce((s, r) => s + (r.remaining || 0), 0);

    return {
      activeCount: active.length,
      atRiskCount: atRisk.length,
      totalRegistered,
      outstandingActive,
      trendPct: 3.5,
    };
  }, [ymMortFiltered]);

  const ymMortStatusChart = useMemo(() => {
    const counts = { Active: 0, Paid: 0, Defaulted: 0, Foreclosure: 0 };
    for (const r of ymMortFiltered) counts[r.status] = (counts[r.status] || 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [ymMortFiltered]);

  const ymMortBankChart = useMemo(() => {
    const map = new Map();
    for (const r of ymMortFiltered) map.set(r.bank, (map.get(r.bank) || 0) + 1);
    return Array.from(map.entries())
      .map(([bank, count]) => ({ bank, count }))
      .sort((a, b) => b.count - a.count);
  }, [ymMortFiltered]);

  const ymMortResetFilters = () => {
    setYmMortSearch("");
    setYmMortRegion("All Regions");
    setYmMortStatus("All Statuses");
    setYmMortDateRange("All time");
  };

  const ymMortExportCsv = () => {
    downloadTextFile("mortgages_export.csv", toCsv(ymMortFiltered), "text/csv;charset=utf-8");
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setYmMortSelectedRow(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div id={YM_MORT_PAGE_ID} className="ym-mort-page">
      <div className="ym-mort-topbar">
        <div className="ym-mort-topbar__crumbs">
          <span className="ym-mort-crumb">Dashboard</span>
          <span className="ym-mort-crumb-sep">›</span>
          <span className="ym-mort-crumb ym-mort-crumb--active">Mortgages</span>
        </div>
      </div>

      <div className="ym-mort-wrap">
        <div className="ym-mort-header">
          <h1 className="ym-mort-title">Mortgages Dashboard</h1>
          <div className="ym-mort-subtitle">Monitor registered mortgages and encumbrances</div>
        </div>

        {/* KPIs */}
        <div className="ym-mort-kpis">
          <div className="ym-mort-kpi">
            <div className="ym-mort-kpi__row">
              <div className="ym-mort-kpi__label">Active Mortgages</div>
              <div className="ym-mort-kpi__icon ym-mort-kpi__icon--doc">▦</div>
            </div>
            <div className="ym-mort-kpi__value">{ymMortKpis.activeCount}</div>
            <div className="ym-mort-kpi__hint">
              <span className="ym-mort-trend ym-mort-trend--up">~ {ymMortKpis.trendPct}%</span>{" "}
              <span className="ym-mort-muted">vs last month</span>
            </div>
          </div>

          <div className="ym-mort-kpi">
            <div className="ym-mort-kpi__row">
              <div className="ym-mort-kpi__label">At Risk</div>
              <div className="ym-mort-kpi__icon ym-mort-kpi__icon--alert">⚠</div>
            </div>
            <div className="ym-mort-kpi__value">{ymMortKpis.atRiskCount}</div>
            <div className="ym-mort-kpi__hint ym-mort-muted">Defaulted or foreclosure</div>
          </div>

          <div className="ym-mort-kpi">
            <div className="ym-mort-kpi__row">
              <div className="ym-mort-kpi__label">Total Registered</div>
              <div className="ym-mort-kpi__icon ym-mort-kpi__icon--eur">€</div>
            </div>
            <div className="ym-mort-kpi__value">{formatEUR(ymMortKpis.totalRegistered)}</div>
            <div className="ym-mort-kpi__hint ym-mort-muted">Original mortgage value</div>
          </div>

          <div className="ym-mort-kpi">
            <div className="ym-mort-kpi__row">
              <div className="ym-mort-kpi__label">Outstanding Balance</div>
              <div className="ym-mort-kpi__icon ym-mort-kpi__icon--money">💳</div>
            </div>
            <div className="ym-mort-kpi__value">{formatEUR(ymMortKpis.outstandingActive)}</div>
            <div className="ym-mort-kpi__hint ym-mort-muted">Active mortgages</div>
          </div>
        </div>

        {/* Charts */}
        <div className="ym-mort-charts">
          <div className="ym-mort-card">
            <div className="ym-mort-card__title">Mortgages by Status</div>
            <div className="ym-mort-card__body ym-mort-card__body--chart">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={ymMortStatusChart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={2}
                    stroke="transparent"
                  >
                    {ymMortStatusChart.map((entry, idx) => (
                      <Cell key={`ym-mort-pie-${entry.name}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip
                    content={({ active, payload, label }) => (
                      <YmMortTooltipBox active={active} payload={payload} label={label} />
                    )}
                  />
                  <Legend verticalAlign="bottom" height={40} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="ym-mort-card">
            <div className="ym-mort-card__title">Mortgages by Bank</div>
            <div className="ym-mort-card__body ym-mort-card__body--chart">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={ymMortBankChart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bank" tick={{ fontSize: 12 }} interval={0} height={60} angle={-18} textAnchor="end" />
                  <YAxis allowDecimals={false} />
                  <ReTooltip
                    content={({ active, payload, label }) => (
                      <YmMortTooltipBox active={active} payload={payload} label={label} />
                    )}
                  />
                  <Bar dataKey="count" name="Mortgages" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="ym-mort-filters ym-mort-card">
          <div className="ym-mort-filters__head">
            <div className="ym-mort-filters__title">Filters</div>
            <button type="button" className="ym-mort-btn ym-mort-btn--ghost" onClick={ymMortResetFilters}>
              ✕ <span className="ym-mort-btn__txt">Reset filters</span>
            </button>
          </div>

          <div className="ym-mort-filters__grid">
            <div className="ym-mort-field ym-mort-field--search">
              <label className="ym-mort-label" htmlFor="ym-mort-search">Search</label>
              <div className="ym-mort-inputwrap">
                <span className="ym-mort-inputicon">🔎</span>
                <input
                  id="ym-mort-search"
                  className="ym-mort-input"
                  placeholder="Search by ID or name..."
                  value={ymMortSearch}
                  onChange={(e) => setYmMortSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="ym-mort-field">
              <label className="ym-mort-label" htmlFor="ym-mort-region">Region</label>
              <select id="ym-mort-region" className="ym-mort-select" value={ymMortRegion} onChange={(e) => setYmMortRegion(e.target.value)}>
                {ymMortRegions.map((r) => (
                  <option key={`ym-mort-region-${r}`} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="ym-mort-field">
              <label className="ym-mort-label" htmlFor="ym-mort-range">Date range</label>
              <select id="ym-mort-range" className="ym-mort-select" value={ymMortDateRange} onChange={(e) => setYmMortDateRange(e.target.value)}>
                {ymMortDateRanges.map((r) => (
                  <option key={`ym-mort-range-${r.label}`} value={r.label}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="ym-mort-field">
              <label className="ym-mort-label" htmlFor="ym-mort-status">Status</label>
              <select id="ym-mort-status" className="ym-mort-select" value={ymMortStatus} onChange={(e) => setYmMortStatus(e.target.value)}>
                {ymMortStatuses.map((s) => (
                  <option key={`ym-mort-status-${s}`} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="ym-mort-field ym-mort-field--export">
              <label className="ym-mort-label ym-mort-label--hidden">Export</label>
              <button type="button" className="ym-mort-btn ym-mort-btn--primary" onClick={ymMortExportCsv}>
                ⬇ <span className="ym-mort-btn__txt">Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="ym-mort-card ym-mort-tablecard">
          <div className="ym-mort-card__title ym-mort-tabletitle">
            <span className="ym-mort-tabletitle__icon">📄</span>
            Mortgage Records
            <span className="ym-mort-tabletitle__count">{ymMortFiltered.length}</span>
          </div>

          <div className="ym-mort-tablewrap">
            <table className="ym-mort-table">
              <thead>
                <tr>
                  <th>Mortgage ID</th>
                  <th>Parcel ID</th>
                  <th>Region</th>
                  <th>Bank</th>
                  <th>Status</th>
                  <th className="ym-mort-th--num">Original Amount</th>
                  <th className="ym-mort-th--num">Remaining</th>
                  <th className="ym-mort-th--num">Monthly</th>
                  <th>Start Date</th>
                  <th className="ym-mort-th--action">Action</th>
                </tr>
              </thead>
              <tbody>
                {ymMortFiltered.map((r) => (
                  <tr key={`ym-mort-row-${r.mortgageId}`}>
                    <td className="ym-mort-mono">{r.mortgageId}</td>
                    <td className="ym-mort-mono">{r.parcelId}</td>
                    <td>{r.region}</td>
                    <td>{r.bank}</td>
                    <td><span className={STATUS_META[r.status]?.pillClass || "ym-mort-pill"}>{r.status}</span></td>
                    <td className="ym-mort-td--num">{formatEUR(r.originalAmount)}</td>
                    <td className="ym-mort-td--num">{formatEUR(r.remaining)}</td>
                    <td className="ym-mort-td--num">{r.monthly ? formatEUR(r.monthly) : "N/A"}</td>
                    <td>{r.startDate}</td>
                    <td className="ym-mort-td--action">
                      <button className="ym-mort-linkbtn" onClick={() => setYmMortSelectedRow(r)}>
                        👁 <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {!ymMortFiltered.length && (
                  <tr>
                    <td colSpan={10} className="ym-mort-empty">
                      No records match your filters. (Try “All time”.)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Drawer */}
      <div className={`ym-mort-drawer ${ymMortSelectedRow ? "ym-mort-drawer--open" : ""}`}>
        <div className="ym-mort-drawer__backdrop" onClick={() => setYmMortSelectedRow(null)} />
        <div className="ym-mort-drawer__panel" role="dialog" aria-modal="true">
          <div className="ym-mort-drawer__head">
            <div className="ym-mort-drawer__title">Mortgage Details</div>
            <button className="ym-mort-btn ym-mort-btn--ghost" onClick={() => setYmMortSelectedRow(null)}>✕</button>
          </div>
          <div className="ym-mort-drawer__body">
            {ymMortSelectedRow ? (
              <div className="ym-mort-detailgrid">
                {[
                  ["Mortgage ID", ymMortSelectedRow.mortgageId],
                  ["Parcel ID", ymMortSelectedRow.parcelId],
                  ["Region", ymMortSelectedRow.region],
                  ["Bank", ymMortSelectedRow.bank],
                  ["Status", ymMortSelectedRow.status],
                  ["Start Date", ymMortSelectedRow.startDate],
                  ["Original Amount", formatEUR(ymMortSelectedRow.originalAmount)],
                  ["Remaining", formatEUR(ymMortSelectedRow.remaining)],
                  ["Monthly", ymMortSelectedRow.monthly ? formatEUR(ymMortSelectedRow.monthly) : "N/A"],
                ].map(([k, v]) => (
                  <div className="ym-mort-detail" key={`ym-mort-detail-${k}`}>
                    <div className="ym-mort-detail__k">{k}</div>
                    <div className="ym-mort-detail__v">{v}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ym-mort-muted">Select a row to view details.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
