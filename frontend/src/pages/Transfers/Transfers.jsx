// Transfers.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  ArrowLeft,
  Download,
  Printer,
  Filter,
  Search,
  ChevronDown,
  Eye,
  X,
  Calendar,
} from "lucide-react";
import "./Transfers.css";
import { getTransfers } from "../../utils/api";

/* ----------------------------- Constants ----------------------------- */
const REGIONS = ["All Regions","Belgrade","Južna Bačka","Severna Bačka","Zapadna Bačka","Srednji Banat","Severni Banat","Južni Banat","Srem","Mačva","Kolubara","Podunavlje","Braničevo","Šumadija","Pomoravlje","Bor","Zaječar","Zlatibor","Moravica","Raška","Rasina","Nišava","Toplica","Pirot","Jablanica","Pčinja"];
const STATUSES = ["All Statuses", "Pending", "Approved", "Completed", "Rejected"];
const TYPES = ["Sale", "Inheritance", "Subdivision", "Donation", "Gift", "Exchange", "Other"];

const TIME_RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "This year", days: 365 },
  { label: "All time", days: 99999 },
];

// Backend status values
const BACKEND_STATUS_MAP = {
  "All Statuses": "",
  Pending: "pending_approval",
  Approved: "approved",
  Completed: "completed",
  Rejected: "rejected",
};

// Normalize backend status to display label
const STATUS_LABEL_MAP = {
  initiated: "Pending",
  pending_approval: "Pending",
  approved: "Approved",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Rejected",
};

// Normalize backend transfer type to display label
const TYPE_LABEL_MAP = {
  sale: "Sale",
  gift: "Donation",
  inheritance: "Inheritance",
  exchange: "Exchange",
  expropriation: "Other",
  court_order: "Other",
  other: "Other",
};

function getOwnerName(owner) {
  if (!owner) return "—";
  if (typeof owner === "string") return owner;
  if (owner.personalInfo) {
    const { firstName, lastName } = owner.personalInfo;
    return [firstName, lastName].filter(Boolean).join(" ") || owner._id || "—";
  }
  if (owner.corporateInfo?.companyName) return owner.corporateInfo.companyName;
  return owner._id || "—";
}

function normalizeTransfer(t) {
  return {
    id: t.transferId || t._id,
    parcelId: t.parcel?.parcelId || t.parcel?._id || "—",
    region: t.region || t.parcel?.region || "—",
    type: TYPE_LABEL_MAP[t.transferType] || t.transferType || "Other",
    status: STATUS_LABEL_MAP[t.transferStatus] || t.transferStatus || "Pending",
    buyer: getOwnerName(t.buyer),
    seller: getOwnerName(t.seller),
    value: t.agreedPrice || t.registeredPrice || 0,
    currency: "EUR",
   processingDays: t.processingTime || Math.ceil((new Date() - new Date(t.applicationDate)) / (1000 * 60 * 60 * 24)),
    createdAt: t.applicationDate || t.createdAt || new Date().toISOString(),
    updatedAt: t.updatedAt || t.applicationDate || new Date().toISOString(),
    notes: t.notes || t.internalNotes || "",
  };
}

/* ----------------------------- Helpers ----------------------------- */
function formatEUR(value) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value || 0);
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}
function safeAvg(nums) {
  const arr = nums.filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function toCSV(rows) {
  const header = ["Transfer ID", "Parcel ID", "Region", "Type", "Status", "Buyer", "Seller", "Value (EUR)", "Processing", "Created At"];
  const lines = [header.join(",")];
  rows.forEach((r) => {
    const processing = r.processingDays == null ? "In progress" : `${r.processingDays} days`;
    const cols = [r.id, r.parcelId, r.region, r.type, r.status, r.buyer, r.seller, r.value ?? "", processing, fmtDate(r.createdAt)]
      .map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`);
    lines.push(cols.join(","));
  });
  return lines.join("\n");
}
function downloadTextFile(filename, content, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ----------------------------- Chart Colors ----------------------------- */
const STATUS_COLORS = {
  Pending: "#2F7AF8",
  Approved: "#15B77E",
  Completed: "#18A86B",
  Rejected: "#F35B5B",
};
const TYPE_COLORS = {
  Sale: "#111827",
  Inheritance: "#374151",
  Subdivision: "#6B7280",
  Donation: "#9CA3AF",
  Exchange: "#4B5563",
  Other: "#D1D5DB",
};

/* ----------------------------- Main Component ----------------------------- */
export default function Transfers() {
  const navigate = useNavigate();

  // Raw data from backend
  const [allTransfers, setAllTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters (client-side after fetch)
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("All Regions");
  const [timeRange, setTimeRange] = useState(TIME_RANGES[4]);
  const [status, setStatus] = useState("All Statuses");

  // View modal
  const [selected, setSelected] = useState(null);

  // Print support
  const printRef = useRef(null);
  const [printMode, setPrintMode] = useState(false);

  // Fetch transfers from backend
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = { limit: 1000 };
    if (region !== "All Regions") params.region = region;
    const backendStatus = BACKEND_STATUS_MAP[status];
    if (backendStatus) params.status = backendStatus;

    getTransfers(params)
      .then((res) => {
        if (cancelled) return;
        if (res?.success) {
          setAllTransfers((res.data || []).map(normalizeTransfer));
        } else {
          setError("Failed to load transfers");
        }
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [region, status]);

  const filtered = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - timeRange.days);

    return allTransfers.filter((t) => {
      const matchesSearch =
        !search.trim() ||
        String(t.id).toLowerCase().includes(search.toLowerCase()) ||
        String(t.parcelId).toLowerCase().includes(search.toLowerCase()) ||
        String(t.buyer).toLowerCase().includes(search.toLowerCase()) ||
        String(t.seller).toLowerCase().includes(search.toLowerCase());

      const matchesRegion = region === "All Regions" || t.region === region;
      const matchesStatus = status === "All Statuses" || t.status === status;
      const createdAt = new Date(t.createdAt);
      const matchesTime = isNaN(createdAt.getTime()) ? true : createdAt >= cutoff;

      return matchesSearch && matchesRegion && matchesStatus && matchesTime;
    });
  }, [allTransfers, search, region, status, timeRange]);

  const kpis = useMemo(() => {
    const pending = filtered.filter((t) => t.status === "Pending").length;
    const completedToday = filtered.filter((t) => {
      if (t.status !== "Completed") return false;
      const d = new Date(t.updatedAt);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    const avgProcessing = safeAvg(filtered.map((t) => t.processingDays)).toFixed(0);
    const totalValue = filtered.reduce((sum, t) => sum + (t.value || 0), 0);

    return { pending, completedToday, avgProcessing: Number(avgProcessing), totalValue };
  }, [filtered]);

  const byStatus = useMemo(() => {
    const map = new Map();
    ["Pending", "Approved", "Completed", "Rejected"].forEach((s) => map.set(s, 0));
    filtered.forEach((t) => map.set(t.status, (map.get(t.status) || 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] }));
  }, [filtered]);

  const byType = useMemo(() => {
    const map = new Map();
    TYPES.forEach((s) => map.set(s, 0));
    filtered.forEach((t) => map.set(t.type, (map.get(t.type) || 0) + 1));
    return Array.from(map.entries())
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value, color: TYPE_COLORS[name] || "#9CA3AF" }));
  }, [filtered]);

  const barDaily = useMemo(() => {
    const days = 7;
    const labels = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push({ key: d.toDateString(), label: d.toLocaleDateString(undefined, { weekday: "short" }), date: d, count: 0, value: 0 });
    }
    const idx = new Map(labels.map((x) => [x.key, x]));
    filtered.forEach((t) => {
      const d = new Date(t.createdAt);
      const key = d.toDateString();
      if (!idx.has(key)) return;
      const bucket = idx.get(key);
      bucket.count += 1;
      bucket.value += t.value || 0;
    });
    return labels;
  }, [filtered]);

  function resetFilters() {
    setSearch("");
    setRegion("All Regions");
    setTimeRange(TIME_RANGES[4]);
    setStatus("All Statuses");
  }

  function onExport() {
    const csv = toCSV(filtered);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`transfers_${stamp}.csv`, csv, "text/csv;charset=utf-8");
  }

  function onPrint() {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintMode(false), 200);
    }, 50);
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div id="trfx-page" className={`trfx-root ${printMode ? "trfx-printMode" : ""}`}>
      {/* Top breadcrumb + back */}
      <div className="trfx-topbar">
        <div className="trfx-breadcrumb">
          <span className="trfx-muted">Dashboard</span>
          <span className="trfx-muted">›</span>
          <span className="trfx-active">Transfers</span>
        </div>
        <button className="trfx-backBtn" onClick={() => navigate("/dashboard")} title="Back to dashboard">
          <ArrowLeft size={16} />
          Back
        </button>
      </div>

      <div className="trfx-header">
        <div>
          <h1 className="trfx-h1">Transfers Dashboard</h1>
          <p className="trfx-muted">Monitor property transfers and mutations</p>
        </div>
        <div className="trfx-headerActions">
          <button className="trfx-btn trfx-btnGhost" onClick={onPrint} title="Print">
            <Printer size={16} /> Print
          </button>
          <button className="trfx-btn trfx-btnPrimary" onClick={onExport} title="Export CSV">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="trfx-kpis">
        <KpiCard title="Pending Transfers" value={loading ? "…" : String(kpis.pending)} hint="↗ 8% vs last week" icon={<span className="trfx-kpiIcon trfx-kpiIconBlue">⇄</span>} />
        <KpiCard title="Completed Today" value={loading ? "…" : String(kpis.completedToday)} hint="↗ 15% vs yesterday" icon={<span className="trfx-kpiIcon trfx-kpiIconGreen">✓</span>} />
        <KpiCard title="Avg. Processing" value={loading ? "…" : `${kpis.avgProcessing || 0} days`} hint="↘ 20% improvement" icon={<span className="trfx-kpiIcon trfx-kpiIconPurple">⏱</span>} />
        <KpiCard title="Total Value" value={loading ? "…" : formatEUR(kpis.totalValue)} hint="This period" icon={<span className="trfx-kpiIcon trfx-kpiIconAmber">€</span>} />
      </div>

      {/* Charts */}
      <div className="trfx-charts">
        <div className="trfx-card">
          <div className="trfx-cardHeader">
            <h3 className="trfx-h3">Transfers by Status</h3>
          </div>
          <div className="trfx-cardBody trfx-chartBody">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={70} outerRadius={95} paddingAngle={2}>
                  {byStatus.map((entry) => (<Cell key={entry.name} fill={entry.color} />))}
                </Pie>
                <ReTooltip formatter={(v, n) => [`${v}`, n]} contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }} />
                <Legend verticalAlign="middle" align="right" layout="vertical" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="trfx-card">
          <div className="trfx-cardHeader">
            <h3 className="trfx-h3">Transfers by Type</h3>
          </div>
          <div className="trfx-cardBody trfx-chartBody">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byType} dataKey="value" nameKey="name" innerRadius={70} outerRadius={95} paddingAngle={2}>
                  {byType.map((entry) => (<Cell key={entry.name} fill={entry.color} />))}
                </Pie>
                <ReTooltip formatter={(v, n) => [`${v}`, n]} contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }} />
                <Legend verticalAlign="middle" align="right" layout="vertical" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="trfx-card trfx-wideCard">
        <div className="trfx-cardHeader trfx-cardHeaderRow">
          <h3 className="trfx-h3">Transfers in the last 7 days</h3>
          <span className="trfx-muted trfx-small">Hover bars to see count + value</span>
        </div>
        <div className="trfx-cardBody">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barDaily} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <ReTooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }}
                formatter={(v, name) => {
                  if (name === "count") return [`${v} transfers`, "Transfers"];
                  if (name === "value") return [formatEUR(v), "Total value"];
                  return [v, name];
                }}
                labelFormatter={(label) => `Day: ${label}`}
              />
              <Legend />
              <Bar dataKey="count" name="count" radius={[8, 8, 0, 0]} fill="var(--trfx-barA)" />
              <Bar dataKey="value" name="value" radius={[8, 8, 0, 0]} fill="var(--trfx-barB)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters + Table */}
      <div className="trfx-card trfx-wideCard">
        <div className="trfx-filtersHeader">
          <div className="trfx-filtersTitle">
            <Filter size={16} />
            <span>Filters</span>
          </div>
          <div className="trfx-filtersActions">
            <button className="trfx-btn trfx-btnGhost" onClick={resetFilters}>
              <X size={16} /> Reset filters
            </button>
            <button className="trfx-btn trfx-btnPrimary" onClick={onExport}>
              <Download size={16} /> Export
            </button>
          </div>
        </div>

        <div className="trfx-filtersRow">
          <div className="trfx-inputWrap">
            <Search size={16} className="trfx-inputIcon" />
            <input className="trfx-input" placeholder="Search by ID or name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={region} onChange={setRegion} options={REGIONS} leftIcon={<ChevronDown size={16} />} />
          <Select value={timeRange.label} onChange={(lbl) => setTimeRange(TIME_RANGES.find((x) => x.label === lbl) || TIME_RANGES[1])} options={TIME_RANGES.map((x) => x.label)} leftIcon={<Calendar size={16} />} />
          <Select value={status} onChange={setStatus} options={STATUSES} leftIcon={<ChevronDown size={16} />} />
        </div>

        <div className="trfx-tableWrap" ref={printRef}>
          <div className="trfx-tableTitleRow">
            <div className="trfx-tableTitle">
              <span className="trfx-docIcon">📄</span>
              <h3 className="trfx-h3">Transfer Records</h3>
            </div>
            <div className="trfx-muted trfx-small">
              Showing <b>{filtered.length}</b> records
            </div>
          </div>

          <div className="trfx-table">
            <div className="trfx-thead">
              <div>Transfer ID</div>
              <div>Parcel ID</div>
              <div>Region</div>
              <div>Type</div>
              <div>Status</div>
              <div>Buyer</div>
              <div>Seller</div>
              <div>Value</div>
              <div>Processing</div>
              <div className="trfx-center">Action</div>
            </div>

            {loading ? (
              <div className="trfx-empty"><div className="trfx-emptyBox"><div className="trfx-emptyTitle">Loading transfers...</div></div></div>
            ) : error ? (
              <div className="trfx-empty"><div className="trfx-emptyBox"><div className="trfx-emptyTitle">Error: {error}</div></div></div>
            ) : filtered.length ? (
              filtered.map((t) => (
                <div className="trfx-trow" key={t.id}>
                  <div className="trfx-mono">{t.id}</div>
                  <div className="trfx-mono">{t.parcelId}</div>
                  <div>{t.region}</div>
                  <div>{t.type}</div>
                  <div><StatusPill status={t.status} /></div>
                  <div className="trfx-truncate" title={t.buyer}>{t.buyer}</div>
                  <div className="trfx-truncate" title={t.seller}>{t.seller}</div>
                  <div className="trfx-mono">{formatEUR(t.value)}</div>
                  <div>{t.processingDays == null ? "In progress" : `${t.processingDays} days`}</div>
                  <div className="trfx-center">
                    <button className="trfx-linkBtn" onClick={() => setSelected(t)} title="View">
                      <Eye size={16} />
                      View
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="trfx-empty">
                <div className="trfx-emptyBox">
                  <div className="trfx-emptyTitle">No results</div>
                  <div className="trfx-muted">Try adjusting filters or search terms.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Modal */}
      {selected && (
        <div className="trfx-modalOverlay" role="dialog" aria-modal="true" aria-label="Transfer details">
          <div className="trfx-modal">
            <div className="trfx-modalHeader">
              <div>
                <div className="trfx-modalTitle">Transfer Details</div>
                <div className="trfx-muted trfx-small">{selected.id}</div>
              </div>
              <button className="trfx-iconBtn" onClick={() => setSelected(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="trfx-modalBody">
              <div className="trfx-detailGrid">
                <DetailItem label="Parcel ID" value={selected.parcelId} mono />
                <DetailItem label="Region" value={selected.region} />
                <DetailItem label="Type" value={selected.type} />
                <DetailItem label="Status" value={<StatusPill status={selected.status} />} />
                <DetailItem label="Buyer" value={selected.buyer} />
                <DetailItem label="Seller" value={selected.seller} />
                <DetailItem label="Value" value={formatEUR(selected.value)} mono />
                <DetailItem label="Processing" value={selected.processingDays == null ? "In progress" : `${selected.processingDays} days`} />
                <DetailItem label="Created" value={fmtDate(selected.createdAt)} />
                <DetailItem label="Last update" value={fmtDate(selected.updatedAt)} />
              </div>

              <div className="trfx-notes">
                <div className="trfx-notesTitle">Notes</div>
                <div className="trfx-notesBody">{selected.notes || "—"}</div>
              </div>
            </div>

            <div className="trfx-modalFooter">
              <button className="trfx-btn trfx-btnGhost" onClick={() => { const csv = toCSV([selected]); downloadTextFile(`${selected.id}.csv`, csv, "text/csv;charset=utf-8"); }}>
                <Download size={16} /> Download
              </button>
              <button className="trfx-btn trfx-btnGhost" onClick={() => { setPrintMode(true); setTimeout(() => { window.print(); setTimeout(() => setPrintMode(false), 200); }, 50); }}>
                <Printer size={16} /> Print
              </button>
              <button className="trfx-btn trfx-btnPrimary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Small UI Components ----------------------------- */
function KpiCard({ title, value, hint, icon }) {
  return (
    <div className="trfx-kpiCard">
      <div className="trfx-kpiTop">
        <div className="trfx-kpiTitle">{title}</div>
        <div className="trfx-kpiIconWrap">{icon}</div>
      </div>
      <div className="trfx-kpiValue">{value}</div>
      <div className="trfx-kpiHint">{hint}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const cls = status === "Completed" ? "ok" : status === "Approved" ? "approved" : status === "Pending" ? "pending" : "rejected";
  return <span className={`trfx-pill ${cls}`}>{status}</span>;
}

function DetailItem({ label, value, mono }) {
  return (
    <div className="trfx-detailItem">
      <div className="trfx-detailLabel">{label}</div>
      <div className={`trfx-detailValue ${mono ? "trfx-mono" : ""}`}>{value}</div>
    </div>
  );
}

function Select({ value, onChange, options, leftIcon }) {
  return (
    <div className="trfx-selectWrap">
      <div className="trfx-selectLeftIcon">{leftIcon}</div>
      <select className="trfx-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
      </select>
    </div>
  );
}
// // Transfers.jsx
// import React, { useEffect, useMemo, useRef, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import {
//   ResponsiveContainer,
//   PieChart,
//   Pie,
//   Cell,
//   Tooltip as ReTooltip,
//   Legend,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
// } from "recharts";
// import {
//   ArrowLeft,
//   Download,
//   Printer,
//   Filter,
//   Search,
//   ChevronDown,
//   Eye,
//   X,
//   Calendar,
// } from "lucide-react";
// import "./Transfers.css";
// import { getTransfers } from "../../utils/api";

// /* ----------------------------- Constants ----------------------------- */
// const REGIONS = ["All Regions", "Belgrade", "Vojvodina", "Šumadija", "Nišava", "Zlatibor", "Kolubara", "Braničevo", "Podunavlje", "Jablanica", "Pčinja"];
// const STATUSES = ["All Statuses", "Pending", "Approved", "Completed", "Rejected"];
// const TYPES = ["Sale", "Inheritance", "Subdivision", "Donation", "Gift", "Exchange", "Other"];

// const TIME_RANGES = [
//   { label: "Last 7 days", days: 7 },
//   { label: "Last 30 days", days: 30 },
//   { label: "Last 90 days", days: 90 },
//   { label: "This year", days: 365 },
// ];

// // Backend status values
// const BACKEND_STATUS_MAP = {
//   "All Statuses": "",
//   Pending: "pending_approval",
//   Approved: "approved",
//   Completed: "completed",
//   Rejected: "rejected",
// };

// // Normalize backend status to display label
// const STATUS_LABEL_MAP = {
//   initiated: "Pending",
//   pending_approval: "Pending",
//   approved: "Approved",
//   completed: "Completed",
//   rejected: "Rejected",
//   cancelled: "Rejected",
// };

// // Normalize backend transfer type to display label
// const TYPE_LABEL_MAP = {
//   sale: "Sale",
//   gift: "Donation",
//   inheritance: "Inheritance",
//   exchange: "Exchange",
//   expropriation: "Other",
//   court_order: "Other",
//   other: "Other",
// };

// function getOwnerName(owner) {
//   if (!owner) return "—";
//   if (typeof owner === "string") return owner;
//   if (owner.personalInfo) {
//     const { firstName, lastName } = owner.personalInfo;
//     return [firstName, lastName].filter(Boolean).join(" ") || owner._id || "—";
//   }
//   if (owner.corporateInfo?.companyName) return owner.corporateInfo.companyName;
//   return owner._id || "—";
// }

// function normalizeTransfer(t) {
//   return {
//     id: t.transferId || t._id,
//     parcelId: t.parcel?.parcelId || t.parcel?._id || "—",
//     region: t.region || t.parcel?.region || "—",
//     type: TYPE_LABEL_MAP[t.transferType] || t.transferType || "Other",
//     status: STATUS_LABEL_MAP[t.transferStatus] || t.transferStatus || "Pending",
//     buyer: getOwnerName(t.buyer),
//     seller: getOwnerName(t.seller),
//     value: t.agreedPrice || t.registeredPrice || 0,
//     currency: "EUR",
//     processingDays: t.processingTime ?? t.processingDays ?? null,
//     createdAt: t.applicationDate || t.createdAt || new Date().toISOString(),
//     updatedAt: t.updatedAt || t.applicationDate || new Date().toISOString(),
//     notes: t.notes || t.internalNotes || "",
//   };
// }

// /* ----------------------------- Helpers ----------------------------- */
// function formatEUR(value) {
//   return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value || 0);
// }
// function fmtDate(iso) {
//   if (!iso) return "—";
//   const d = new Date(iso);
//   if (isNaN(d.getTime())) return "—";
//   return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
// }
// function safeAvg(nums) {
//   const arr = nums.filter((n) => typeof n === "number" && !Number.isNaN(n));
//   if (!arr.length) return 0;
//   return arr.reduce((a, b) => a + b, 0) / arr.length;
// }
// function toCSV(rows) {
//   const header = ["Transfer ID", "Parcel ID", "Region", "Type", "Status", "Buyer", "Seller", "Value (EUR)", "Processing", "Created At"];
//   const lines = [header.join(",")];
//   rows.forEach((r) => {
//     const processing = r.processingDays == null ? "In progress" : `${r.processingDays} days`;
//     const cols = [r.id, r.parcelId, r.region, r.type, r.status, r.buyer, r.seller, r.value ?? "", processing, fmtDate(r.createdAt)]
//       .map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`);
//     lines.push(cols.join(","));
//   });
//   return lines.join("\n");
// }
// function downloadTextFile(filename, content, mime = "text/plain") {
//   const blob = new Blob([content], { type: mime });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement("a");
//   a.href = url;
//   a.download = filename;
//   document.body.appendChild(a);
//   a.click();
//   a.remove();
//   URL.revokeObjectURL(url);
// }

// /* ----------------------------- Chart Colors ----------------------------- */
// const STATUS_COLORS = {
//   Pending: "#2F7AF8",
//   Approved: "#15B77E",
//   Completed: "#18A86B",
//   Rejected: "#F35B5B",
// };
// const TYPE_COLORS = {
//   Sale: "#111827",
//   Inheritance: "#374151",
//   Subdivision: "#6B7280",
//   Donation: "#9CA3AF",
//   Exchange: "#4B5563",
//   Other: "#D1D5DB",
// };

// /* ----------------------------- Main Component ----------------------------- */
// export default function Transfers() {
//   const navigate = useNavigate();

//   // Raw data from backend
//   const [allTransfers, setAllTransfers] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   // Filters (client-side after fetch)
//   const [search, setSearch] = useState("");
//   const [region, setRegion] = useState("All Regions");
//   const [timeRange, setTimeRange] = useState(TIME_RANGES[1]);
//   const [status, setStatus] = useState("All Statuses");

//   // View modal
//   const [selected, setSelected] = useState(null);

//   // Print support
//   const printRef = useRef(null);
//   const [printMode, setPrintMode] = useState(false);

//   // Fetch transfers from backend
//   useEffect(() => {
//     let cancelled = false;
//     setLoading(true);
//     setError(null);

//     const params = { limit: 500 };
//     if (region !== "All Regions") params.region = region;
//     const backendStatus = BACKEND_STATUS_MAP[status];
//     if (backendStatus) params.status = backendStatus;

//     getTransfers(params)
//       .then((res) => {
//         if (cancelled) return;
//         if (res?.success) {
//           setAllTransfers((res.data || []).map(normalizeTransfer));
//         } else {
//           setError("Failed to load transfers");
//         }
//         setLoading(false);
//       })
//       .catch((err) => {
//         if (cancelled) return;
//         setError(err.message);
//         setLoading(false);
//       });

//     return () => { cancelled = true; };
//   }, [region, status]);

//   const filtered = useMemo(() => {
//     const now = new Date();
//     const cutoff = new Date(now);
//     cutoff.setDate(cutoff.getDate() - timeRange.days);

//     return allTransfers.filter((t) => {
//       const matchesSearch =
//         !search.trim() ||
//         String(t.id).toLowerCase().includes(search.toLowerCase()) ||
//         String(t.parcelId).toLowerCase().includes(search.toLowerCase()) ||
//         String(t.buyer).toLowerCase().includes(search.toLowerCase()) ||
//         String(t.seller).toLowerCase().includes(search.toLowerCase());

//       const matchesRegion = region === "All Regions" || t.region === region;
//       const matchesStatus = status === "All Statuses" || t.status === status;
//       const createdAt = new Date(t.createdAt);
//       const matchesTime = isNaN(createdAt.getTime()) ? true : createdAt >= cutoff;

//       return matchesSearch && matchesRegion && matchesStatus && matchesTime;
//     });
//   }, [allTransfers, search, region, status, timeRange]);

//   const kpis = useMemo(() => {
//     const pending = filtered.filter((t) => t.status === "Pending").length;
//     const completedToday = filtered.filter((t) => {
//       if (t.status !== "Completed") return false;
//       const d = new Date(t.updatedAt);
//       const now = new Date();
//       return d.toDateString() === now.toDateString();
//     }).length;
//     const avgProcessing = safeAvg(filtered.map((t) => t.processingDays)).toFixed(0);
//     const totalValue = filtered.reduce((sum, t) => sum + (t.value || 0), 0);

//     return { pending, completedToday, avgProcessing: Number(avgProcessing), totalValue };
//   }, [filtered]);

//   const byStatus = useMemo(() => {
//     const map = new Map();
//     ["Pending", "Approved", "Completed", "Rejected"].forEach((s) => map.set(s, 0));
//     filtered.forEach((t) => map.set(t.status, (map.get(t.status) || 0) + 1));
//     return Array.from(map.entries()).map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] }));
//   }, [filtered]);

//   const byType = useMemo(() => {
//     const map = new Map();
//     TYPES.forEach((s) => map.set(s, 0));
//     filtered.forEach((t) => map.set(t.type, (map.get(t.type) || 0) + 1));
//     return Array.from(map.entries())
//       .filter(([, value]) => value > 0)
//       .map(([name, value]) => ({ name, value, color: TYPE_COLORS[name] || "#9CA3AF" }));
//   }, [filtered]);

//   const barDaily = useMemo(() => {
//     const days = 7;
//     const labels = [];
//     for (let i = days - 1; i >= 0; i--) {
//       const d = new Date();
//       d.setDate(d.getDate() - i);
//       labels.push({ key: d.toDateString(), label: d.toLocaleDateString(undefined, { weekday: "short" }), date: d, count: 0, value: 0 });
//     }
//     const idx = new Map(labels.map((x) => [x.key, x]));
//     filtered.forEach((t) => {
//       const d = new Date(t.createdAt);
//       const key = d.toDateString();
//       if (!idx.has(key)) return;
//       const bucket = idx.get(key);
//       bucket.count += 1;
//       bucket.value += t.value || 0;
//     });
//     return labels;
//   }, [filtered]);

//   function resetFilters() {
//     setSearch("");
//     setRegion("All Regions");
//     setTimeRange(TIME_RANGES[1]);
//     setStatus("All Statuses");
//   }

//   function onExport() {
//     const csv = toCSV(filtered);
//     const stamp = new Date().toISOString().slice(0, 10);
//     downloadTextFile(`transfers_${stamp}.csv`, csv, "text/csv;charset=utf-8");
//   }

//   function onPrint() {
//     setPrintMode(true);
//     setTimeout(() => {
//       window.print();
//       setTimeout(() => setPrintMode(false), 200);
//     }, 50);
//   }

//   useEffect(() => {
//     const onKey = (e) => { if (e.key === "Escape") setSelected(null); };
//     window.addEventListener("keydown", onKey);
//     return () => window.removeEventListener("keydown", onKey);
//   }, []);

//   return (
//     <div id="trfx-page" className={`trfx-root ${printMode ? "trfx-printMode" : ""}`}>
//       {/* Top breadcrumb + back */}
//       <div className="trfx-topbar">
//         <div className="trfx-breadcrumb">
//           <span className="trfx-muted">Dashboard</span>
//           <span className="trfx-muted">›</span>
//           <span className="trfx-active">Transfers</span>
//         </div>
//         <button className="trfx-backBtn" onClick={() => navigate("/dashboard")} title="Back to dashboard">
//           <ArrowLeft size={16} />
//           Back
//         </button>
//       </div>

//       <div className="trfx-header">
//         <div>
//           <h1 className="trfx-h1">Transfers Dashboard</h1>
//           <p className="trfx-muted">Monitor property transfers and mutations</p>
//         </div>
//         <div className="trfx-headerActions">
//           <button className="trfx-btn trfx-btnGhost" onClick={onPrint} title="Print">
//             <Printer size={16} /> Print
//           </button>
//           <button className="trfx-btn trfx-btnPrimary" onClick={onExport} title="Export CSV">
//             <Download size={16} /> Export
//           </button>
//         </div>
//       </div>

//       {/* KPI cards */}
//       <div className="trfx-kpis">
//         <KpiCard title="Pending Transfers" value={loading ? "…" : String(kpis.pending)} hint="↗ 8% vs last week" icon={<span className="trfx-kpiIcon trfx-kpiIconBlue">⇄</span>} />
//         <KpiCard title="Completed Today" value={loading ? "…" : String(kpis.completedToday)} hint="↗ 15% vs yesterday" icon={<span className="trfx-kpiIcon trfx-kpiIconGreen">✓</span>} />
//         <KpiCard title="Avg. Processing" value={loading ? "…" : `${kpis.avgProcessing || 0} days`} hint="↘ 20% improvement" icon={<span className="trfx-kpiIcon trfx-kpiIconPurple">⏱</span>} />
//         <KpiCard title="Total Value" value={loading ? "…" : formatEUR(kpis.totalValue)} hint="This period" icon={<span className="trfx-kpiIcon trfx-kpiIconAmber">€</span>} />
//       </div>

//       {/* Charts */}
//       <div className="trfx-charts">
//         <div className="trfx-card">
//           <div className="trfx-cardHeader">
//             <h3 className="trfx-h3">Transfers by Status</h3>
//           </div>
//           <div className="trfx-cardBody trfx-chartBody">
//             <ResponsiveContainer width="100%" height={240}>
//               <PieChart>
//                 <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={70} outerRadius={95} paddingAngle={2}>
//                   {byStatus.map((entry) => (<Cell key={entry.name} fill={entry.color} />))}
//                 </Pie>
//                 <ReTooltip formatter={(v, n) => [`${v}`, n]} contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }} />
//                 <Legend verticalAlign="middle" align="right" layout="vertical" />
//               </PieChart>
//             </ResponsiveContainer>
//           </div>
//         </div>

//         <div className="trfx-card">
//           <div className="trfx-cardHeader">
//             <h3 className="trfx-h3">Transfers by Type</h3>
//           </div>
//           <div className="trfx-cardBody trfx-chartBody">
//             <ResponsiveContainer width="100%" height={240}>
//               <PieChart>
//                 <Pie data={byType} dataKey="value" nameKey="name" innerRadius={70} outerRadius={95} paddingAngle={2}>
//                   {byType.map((entry) => (<Cell key={entry.name} fill={entry.color} />))}
//                 </Pie>
//                 <ReTooltip formatter={(v, n) => [`${v}`, n]} contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }} />
//                 <Legend verticalAlign="middle" align="right" layout="vertical" />
//               </PieChart>
//             </ResponsiveContainer>
//           </div>
//         </div>
//       </div>

//       {/* Bar chart */}
//       <div className="trfx-card trfx-wideCard">
//         <div className="trfx-cardHeader trfx-cardHeaderRow">
//           <h3 className="trfx-h3">Transfers in the last 7 days</h3>
//           <span className="trfx-muted trfx-small">Hover bars to see count + value</span>
//         </div>
//         <div className="trfx-cardBody">
//           <ResponsiveContainer width="100%" height={260}>
//             <BarChart data={barDaily} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
//               <CartesianGrid strokeDasharray="3 3" />
//               <XAxis dataKey="label" />
//               <YAxis allowDecimals={false} />
//               <ReTooltip
//                 contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }}
//                 formatter={(v, name) => {
//                   if (name === "count") return [`${v} transfers`, "Transfers"];
//                   if (name === "value") return [formatEUR(v), "Total value"];
//                   return [v, name];
//                 }}
//                 labelFormatter={(label) => `Day: ${label}`}
//               />
//               <Legend />
//               <Bar dataKey="count" name="count" radius={[8, 8, 0, 0]} fill="var(--trfx-barA)" />
//               <Bar dataKey="value" name="value" radius={[8, 8, 0, 0]} fill="var(--trfx-barB)" />
//             </BarChart>
//           </ResponsiveContainer>
//         </div>
//       </div>

//       {/* Filters + Table */}
//       <div className="trfx-card trfx-wideCard">
//         <div className="trfx-filtersHeader">
//           <div className="trfx-filtersTitle">
//             <Filter size={16} />
//             <span>Filters</span>
//           </div>
//           <div className="trfx-filtersActions">
//             <button className="trfx-btn trfx-btnGhost" onClick={resetFilters}>
//               <X size={16} /> Reset filters
//             </button>
//             <button className="trfx-btn trfx-btnPrimary" onClick={onExport}>
//               <Download size={16} /> Export
//             </button>
//           </div>
//         </div>

//         <div className="trfx-filtersRow">
//           <div className="trfx-inputWrap">
//             <Search size={16} className="trfx-inputIcon" />
//             <input className="trfx-input" placeholder="Search by ID or name..." value={search} onChange={(e) => setSearch(e.target.value)} />
//           </div>
//           <Select value={region} onChange={setRegion} options={REGIONS} leftIcon={<ChevronDown size={16} />} />
//           <Select value={timeRange.label} onChange={(lbl) => setTimeRange(TIME_RANGES.find((x) => x.label === lbl) || TIME_RANGES[1])} options={TIME_RANGES.map((x) => x.label)} leftIcon={<Calendar size={16} />} />
//           <Select value={status} onChange={setStatus} options={STATUSES} leftIcon={<ChevronDown size={16} />} />
//         </div>

//         <div className="trfx-tableWrap" ref={printRef}>
//           <div className="trfx-tableTitleRow">
//             <div className="trfx-tableTitle">
//               <span className="trfx-docIcon">📄</span>
//               <h3 className="trfx-h3">Transfer Records</h3>
//             </div>
//             <div className="trfx-muted trfx-small">
//               Showing <b>{filtered.length}</b> records
//             </div>
//           </div>

//           <div className="trfx-table">
//             <div className="trfx-thead">
//               <div>Transfer ID</div>
//               <div>Parcel ID</div>
//               <div>Region</div>
//               <div>Type</div>
//               <div>Status</div>
//               <div>Buyer</div>
//               <div>Seller</div>
//               <div>Value</div>
//               <div>Processing</div>
//               <div className="trfx-center">Action</div>
//             </div>

//             {loading ? (
//               <div className="trfx-empty"><div className="trfx-emptyBox"><div className="trfx-emptyTitle">Loading transfers...</div></div></div>
//             ) : error ? (
//               <div className="trfx-empty"><div className="trfx-emptyBox"><div className="trfx-emptyTitle">Error: {error}</div></div></div>
//             ) : filtered.length ? (
//               filtered.map((t) => (
//                 <div className="trfx-trow" key={t.id}>
//                   <div className="trfx-mono">{t.id}</div>
//                   <div className="trfx-mono">{t.parcelId}</div>
//                   <div>{t.region}</div>
//                   <div>{t.type}</div>
//                   <div><StatusPill status={t.status} /></div>
//                   <div className="trfx-truncate" title={t.buyer}>{t.buyer}</div>
//                   <div className="trfx-truncate" title={t.seller}>{t.seller}</div>
//                   <div className="trfx-mono">{formatEUR(t.value)}</div>
//                   <div>{t.processingDays == null ? "In progress" : `${t.processingDays} days`}</div>
//                   <div className="trfx-center">
//                     <button className="trfx-linkBtn" onClick={() => setSelected(t)} title="View">
//                       <Eye size={16} />
//                       View
//                     </button>
//                   </div>
//                 </div>
//               ))
//             ) : (
//               <div className="trfx-empty">
//                 <div className="trfx-emptyBox">
//                   <div className="trfx-emptyTitle">No results</div>
//                   <div className="trfx-muted">Try adjusting filters or search terms.</div>
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* View Modal */}
//       {selected && (
//         <div className="trfx-modalOverlay" role="dialog" aria-modal="true" aria-label="Transfer details">
//           <div className="trfx-modal">
//             <div className="trfx-modalHeader">
//               <div>
//                 <div className="trfx-modalTitle">Transfer Details</div>
//                 <div className="trfx-muted trfx-small">{selected.id}</div>
//               </div>
//               <button className="trfx-iconBtn" onClick={() => setSelected(null)} aria-label="Close">
//                 <X size={18} />
//               </button>
//             </div>

//             <div className="trfx-modalBody">
//               <div className="trfx-detailGrid">
//                 <DetailItem label="Parcel ID" value={selected.parcelId} mono />
//                 <DetailItem label="Region" value={selected.region} />
//                 <DetailItem label="Type" value={selected.type} />
//                 <DetailItem label="Status" value={<StatusPill status={selected.status} />} />
//                 <DetailItem label="Buyer" value={selected.buyer} />
//                 <DetailItem label="Seller" value={selected.seller} />
//                 <DetailItem label="Value" value={formatEUR(selected.value)} mono />
//                 <DetailItem label="Processing" value={selected.processingDays == null ? "In progress" : `${selected.processingDays} days`} />
//                 <DetailItem label="Created" value={fmtDate(selected.createdAt)} />
//                 <DetailItem label="Last update" value={fmtDate(selected.updatedAt)} />
//               </div>

//               <div className="trfx-notes">
//                 <div className="trfx-notesTitle">Notes</div>
//                 <div className="trfx-notesBody">{selected.notes || "—"}</div>
//               </div>
//             </div>

//             <div className="trfx-modalFooter">
//               <button className="trfx-btn trfx-btnGhost" onClick={() => { const csv = toCSV([selected]); downloadTextFile(`${selected.id}.csv`, csv, "text/csv;charset=utf-8"); }}>
//                 <Download size={16} /> Download
//               </button>
//               <button className="trfx-btn trfx-btnGhost" onClick={() => { setPrintMode(true); setTimeout(() => { window.print(); setTimeout(() => setPrintMode(false), 200); }, 50); }}>
//                 <Printer size={16} /> Print
//               </button>
//               <button className="trfx-btn trfx-btnPrimary" onClick={() => setSelected(null)}>Close</button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// /* ----------------------------- Small UI Components ----------------------------- */
// function KpiCard({ title, value, hint, icon }) {
//   return (
//     <div className="trfx-kpiCard">
//       <div className="trfx-kpiTop">
//         <div className="trfx-kpiTitle">{title}</div>
//         <div className="trfx-kpiIconWrap">{icon}</div>
//       </div>
//       <div className="trfx-kpiValue">{value}</div>
//       <div className="trfx-kpiHint">{hint}</div>
//     </div>
//   );
// }

// function StatusPill({ status }) {
//   const cls = status === "Completed" ? "ok" : status === "Approved" ? "approved" : status === "Pending" ? "pending" : "rejected";
//   return <span className={`trfx-pill ${cls}`}>{status}</span>;
// }

// function DetailItem({ label, value, mono }) {
//   return (
//     <div className="trfx-detailItem">
//       <div className="trfx-detailLabel">{label}</div>
//       <div className={`trfx-detailValue ${mono ? "trfx-mono" : ""}`}>{value}</div>
//     </div>
//   );
// }

// function Select({ value, onChange, options, leftIcon }) {
//   return (
//     <div className="trfx-selectWrap">
//       <div className="trfx-selectLeftIcon">{leftIcon}</div>
//       <select className="trfx-select" value={value} onChange={(e) => onChange(e.target.value)}>
//         {options.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
//       </select>
//     </div>
//   );
// }
// // Transfers.jsx
// import React, { useEffect, useMemo, useRef, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import {
//   ResponsiveContainer,
//   PieChart,
//   Pie,
//   Cell,
//   Tooltip as ReTooltip,
//   Legend,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
// } from "recharts";
// import {
//   ArrowLeft,
//   Download,
//   Printer,
//   Filter,
//   Search,
//   ChevronDown,
//   Eye,
//   X,
//   Calendar,
// } from "lucide-react";
// import "./Transfers.css";

// /**
//  * Transfers Dashboard (UI + interactions)
//  * - Back button to main dashboard
//  * - Hover tooltips on charts (bar + donut)
//  * - Filters (search, region, time range, status) + reset
//  * - Table with View action -> opens modal (like disputes)
//  * - Export (CSV) + Print (real window.print)
//  */

// /* ----------------------------- Mock Data ----------------------------- */
// const REGIONS = ["All Regions", "Belgrade", "Vojvodina", "Šumadija", "Nišava", "Zlatibor", "Kolubara", "Braničevo"];
// const STATUSES = ["All Statuses", "Pending", "Approved", "Completed", "Rejected"];
// const TYPES = ["Sale", "Inheritance", "Subdivision", "Donation"];

// const TIME_RANGES = [
//   { label: "Last 7 days", days: 7 },
//   { label: "Last 30 days", days: 30 },
//   { label: "Last 90 days", days: 90 },
//   { label: "This year", days: 365 },
// ];

// function daysAgo(n) {
//   const d = new Date();
//   d.setDate(d.getDate() - n);
//   return d;
// }

// const MOCK_TRANSFERS = [
//   {
//     id: "TRF-2024-001",
//     parcelId: "BEL-45678",
//     region: "Belgrade",
//     type: "Sale",
//     status: "Completed",
//     buyer: "Stanković M.",
//     seller: "Petrović J.",
//     value: 185000,
//     currency: "EUR",
//     processingDays: 3,
//     createdAt: daysAgo(2).toISOString(),
//     updatedAt: daysAgo(0).toISOString(),
//     notes: "All documents verified. Payment settled.",
//   },
//   {
//     id: "TRF-2024-002",
//     parcelId: "VOJ-78901",
//     region: "Vojvodina",
//     type: "Inheritance",
//     status: "Pending",
//     buyer: "Nikolić Family Trust",
//     seller: "Estate of Nikolić",
//     value: 120000,
//     currency: "EUR",
//     processingDays: null,
//     createdAt: daysAgo(10).toISOString(),
//     updatedAt: daysAgo(1).toISOString(),
//     notes: "Awaiting probate confirmation.",
//   },
//   {
//     id: "TRF-2024-003",
//     parcelId: "BEL-23456",
//     region: "Belgrade",
//     type: "Sale",
//     status: "Approved",
//     buyer: "Investment LLC",
//     seller: "Jovanović D.",
//     value: 340000,
//     currency: "EUR",
//     processingDays: 2,
//     createdAt: daysAgo(6).toISOString(),
//     updatedAt: daysAgo(2).toISOString(),
//     notes: "Approved by registrar. Pending completion stamp.",
//   },
//   {
//     id: "TRF-2024-004",
//     parcelId: "SUM-56789",
//     region: "Šumadija",
//     type: "Subdivision",
//     status: "Pending",
//     buyer: "Marković Bros.",
//     seller: "Marković Estate",
//     value: 95000,
//     currency: "EUR",
//     processingDays: null,
//     createdAt: daysAgo(14).toISOString(),
//     updatedAt: daysAgo(3).toISOString(),
//     notes: "Survey report requested.",
//   },
//   {
//     id: "TRF-2024-005",
//     parcelId: "NIS-12345",
//     region: "Nišava",
//     type: "Sale",
//     status: "Completed",
//     buyer: "Ilić R.",
//     seller: "Pavlović S.",
//     value: 67000,
//     currency: "EUR",
//     processingDays: 4,
//     createdAt: daysAgo(20).toISOString(),
//     updatedAt: daysAgo(18).toISOString(),
//     notes: "Completed and archived.",
//   },
//   {
//     id: "TRF-2024-006",
//     parcelId: "ZLA-67890",
//     region: "Zlatibor",
//     type: "Donation",
//     status: "Completed",
//     buyer: "Popović A. (Family)",
//     seller: "Popović P.",
//     value: 0,
//     currency: "EUR",
//     processingDays: 5,
//     createdAt: daysAgo(25).toISOString(),
//     updatedAt: daysAgo(22).toISOString(),
//     notes: "Donation deed recorded.",
//   },
//   {
//     id: "TRF-2024-007",
//     parcelId: "VOJ-34567",
//     region: "Vojvodina",
//     type: "Sale",
//     status: "Rejected",
//     buyer: "Foreign Investment Co.",
//     seller: "Agricultural Coop",
//     value: 890000,
//     currency: "EUR",
//     processingDays: 2,
//     createdAt: daysAgo(8).toISOString(),
//     updatedAt: daysAgo(7).toISOString(),
//     notes: "Rejected due to incomplete KYC documentation.",
//   },
//   {
//     id: "TRF-2024-008",
//     parcelId: "BEL-89012",
//     region: "Belgrade",
//     type: "Sale",
//     status: "Pending",
//     buyer: "Tech Holdings",
//     seller: "Manufacturing Ltd.",
//     value: 520000,
//     currency: "EUR",
//     processingDays: null,
//     createdAt: daysAgo(4).toISOString(),
//     updatedAt: daysAgo(1).toISOString(),
//     notes: "Waiting for tax clearance certificate.",
//   },
//   {
//     id: "TRF-2024-009",
//     parcelId: "KOL-45678",
//     region: "Kolubara",
//     type: "Inheritance",
//     status: "Approved",
//     buyer: "Janković Heirs",
//     seller: "Estate of Janković",
//     value: 78000,
//     currency: "EUR",
//     processingDays: 8,
//     createdAt: daysAgo(40).toISOString(),
//     updatedAt: daysAgo(35).toISOString(),
//     notes: "Approved. Final registration pending.",
//   },
//   {
//     id: "TRF-2024-010",
//     parcelId: "BRA-90123",
//     region: "Braničevo",
//     type: "Sale",
//     status: "Completed",
//     buyer: "Todorović M.",
//     seller: "Simić J.",
//     value: 45000,
//     currency: "EUR",
//     processingDays: 3,
//     createdAt: daysAgo(12).toISOString(),
//     updatedAt: daysAgo(9).toISOString(),
//     notes: "Completed. Deed stored.",
//   },
// ];

// /* ----------------------------- Helpers ----------------------------- */
// function formatEUR(value) {
//   // keep simple and consistent
//   return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value || 0);
// }
// function fmtDate(iso) {
//   const d = new Date(iso);
//   return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
// }
// function safeAvg(nums) {
//   const arr = nums.filter((n) => typeof n === "number" && !Number.isNaN(n));
//   if (!arr.length) return 0;
//   return arr.reduce((a, b) => a + b, 0) / arr.length;
// }
// function toCSV(rows) {
//   const header = ["Transfer ID", "Parcel ID", "Region", "Type", "Status", "Buyer", "Seller", "Value (EUR)", "Processing", "Created At"];
//   const lines = [header.join(",")];

//   rows.forEach((r) => {
//     const processing = r.processingDays == null ? "In progress" : `${r.processingDays} days`;
//     const value = r.value == null ? "" : r.value;
//     const cols = [
//       r.id,
//       r.parcelId,
//       r.region,
//       r.type,
//       r.status,
//       r.buyer,
//       r.seller,
//       value,
//       processing,
//       fmtDate(r.createdAt),
//     ].map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`);
//     lines.push(cols.join(","));
//   });

//   return lines.join("\n");
// }
// function downloadTextFile(filename, content, mime = "text/plain") {
//   const blob = new Blob([content], { type: mime });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement("a");
//   a.href = url;
//   a.download = filename;
//   document.body.appendChild(a);
//   a.click();
//   a.remove();
//   URL.revokeObjectURL(url);
// }

// /* ----------------------------- Chart Colors ----------------------------- */
// const STATUS_COLORS = {
//   Pending: "#2F7AF8",
//   Approved: "#15B77E",
//   Completed: "#18A86B",
//   Rejected: "#F35B5B",
// };
// const TYPE_COLORS = {
//   Sale: "#111827",
//   Inheritance: "#374151",
//   Subdivision: "#6B7280",
//   Donation: "#9CA3AF",
// };

// /* ----------------------------- Main Component ----------------------------- */
// export default function Transfers() {
//   const navigate = useNavigate();

//   // Filters
//   const [search, setSearch] = useState("");
//   const [region, setRegion] = useState("All Regions");
//   const [timeRange, setTimeRange] = useState(TIME_RANGES[1]); // last 30
//   const [status, setStatus] = useState("All Statuses");

//   // View modal
//   const [selected, setSelected] = useState(null);

//   // Print support
//   const printRef = useRef(null);
//   const [printMode, setPrintMode] = useState(false);

//   const filtered = useMemo(() => {
//     const now = new Date();
//     const cutoff = new Date(now);
//     cutoff.setDate(cutoff.getDate() - timeRange.days);

//     return MOCK_TRANSFERS.filter((t) => {
//       const matchesSearch =
//         !search.trim() ||
//         t.id.toLowerCase().includes(search.toLowerCase()) ||
//         t.parcelId.toLowerCase().includes(search.toLowerCase()) ||
//         t.buyer.toLowerCase().includes(search.toLowerCase()) ||
//         t.seller.toLowerCase().includes(search.toLowerCase());

//       const matchesRegion = region === "All Regions" || t.region === region;
//       const matchesStatus = status === "All Statuses" || t.status === status;

//       const createdAt = new Date(t.createdAt);
//       const matchesTime = createdAt >= cutoff;

//       return matchesSearch && matchesRegion && matchesStatus && matchesTime;
//     });
//   }, [search, region, status, timeRange]);

//   const kpis = useMemo(() => {
//     const pending = filtered.filter((t) => t.status === "Pending").length;
//     const completedToday = filtered.filter((t) => {
//       if (t.status !== "Completed") return false;
//       const d = new Date(t.updatedAt);
//       const now = new Date();
//       return d.toDateString() === now.toDateString();
//     }).length;

//     const avgProcessing = safeAvg(filtered.map((t) => t.processingDays)).toFixed(0);
//     const totalValue = filtered.reduce((sum, t) => sum + (t.value || 0), 0);

//     return {
//       pending,
//       completedToday,
//       avgProcessing: Number(avgProcessing),
//       totalValue,
//     };
//   }, [filtered]);

//   const byStatus = useMemo(() => {
//     const map = new Map();
//     ["Pending", "Approved", "Completed", "Rejected"].forEach((s) => map.set(s, 0));
//     filtered.forEach((t) => map.set(t.status, (map.get(t.status) || 0) + 1));
//     return Array.from(map.entries()).map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] }));
//   }, [filtered]);

//   const byType = useMemo(() => {
//     const map = new Map();
//     TYPES.forEach((s) => map.set(s, 0));
//     filtered.forEach((t) => map.set(t.type, (map.get(t.type) || 0) + 1));
//     return Array.from(map.entries()).map(([name, value]) => ({ name, value, color: TYPE_COLORS[name] }));
//   }, [filtered]);

//   const barDaily = useMemo(() => {
//     // simple buckets for last 7 days regardless of selected range (dashboard-y)
//     const days = 7;
//     const labels = [];
//     for (let i = days - 1; i >= 0; i--) {
//       const d = new Date();
//       d.setDate(d.getDate() - i);
//       labels.push({
//         key: d.toDateString(),
//         label: d.toLocaleDateString(undefined, { weekday: "short" }),
//         date: d,
//         count: 0,
//         value: 0,
//       });
//     }
//     const idx = new Map(labels.map((x) => [x.key, x]));
//     filtered.forEach((t) => {
//       const d = new Date(t.createdAt);
//       const key = d.toDateString();
//       if (!idx.has(key)) return;
//       const bucket = idx.get(key);
//       bucket.count += 1;
//       bucket.value += t.value || 0;
//     });
//     return labels;
//   }, [filtered]);

//   function resetFilters() {
//     setSearch("");
//     setRegion("All Regions");
//     setTimeRange(TIME_RANGES[1]);
//     setStatus("All Statuses");
//   }

//   function onExport() {
//     const csv = toCSV(filtered);
//     const stamp = new Date().toISOString().slice(0, 10);
//     downloadTextFile(`transfers_${stamp}.csv`, csv, "text/csv;charset=utf-8");
//   }

//   function onPrint() {
//     // Print only the table area (and optionally modal details if open)
//     setPrintMode(true);
//     setTimeout(() => {
//       window.print();
//       setTimeout(() => setPrintMode(false), 200);
//     }, 50);
//   }

//   // Close modal on ESC
//   useEffect(() => {
//     const onKey = (e) => {
//       if (e.key === "Escape") setSelected(null);
//     };
//     window.addEventListener("keydown", onKey);
//     return () => window.removeEventListener("keydown", onKey);
//   }, []);

//   return (
//     <div id="trfx-page" className={`trfx-root ${printMode ? "trfx-printMode" : ""}`}>
//       {/* Top breadcrumb + back */}
//       <div className="trfx-topbar">
//         <div className="trfx-breadcrumb">
//           <span className="trfx-muted">Dashboard</span>
//           <span className="trfx-muted">›</span>
//           <span className="trfx-active">Transfers</span>
//         </div>

//         <button className="trfx-backBtn" onClick={() => navigate("/dashboard")} title="Back to dashboard">
//           <ArrowLeft size={16} />
//           Back
//         </button>
//       </div>

//       <div className="trfx-header">
//         <div>
//           <h1 className="trfx-h1">Transfers Dashboard</h1>
//           <p className="trfx-muted">Monitor property transfers and mutations</p>
//         </div>

//         <div className="trfx-headerActions">
//           <button className="trfx-btn trfx-btnGhost" onClick={onPrint} title="Print">
//             <Printer size={16} /> Print
//           </button>
//           <button className="trfx-btn trfx-btnPrimary" onClick={onExport} title="Export CSV">
//             <Download size={16} /> Export
//           </button>
//         </div>
//       </div>

//       {/* KPI cards */}
//       <div className="trfx-kpis">
//         <KpiCard
//           title="Pending Transfers"
//           value={String(kpis.pending)}
//           hint="↗ 8% vs last week"
//           icon={<span className="trfx-kpiIcon trfx-kpiIconBlue">⇄</span>}
//         />
//         <KpiCard
//           title="Completed Today"
//           value={String(kpis.completedToday)}
//           hint="↗ 15% vs yesterday"
//           icon={<span className="trfx-kpiIcon trfx-kpiIconGreen">✓</span>}
//         />
//         <KpiCard
//           title="Avg. Processing"
//           value={`${kpis.avgProcessing || 0} days`}
//           hint="↘ 20% improvement"
//           icon={<span className="trfx-kpiIcon trfx-kpiIconPurple">⏱</span>}
//         />
//         <KpiCard
//           title="Total Value"
//           value={formatEUR(kpis.totalValue)}
//           hint="This period"
//           icon={<span className="trfx-kpiIcon trfx-kpiIconAmber">€</span>}
//         />
//       </div>

//       {/* Charts */}
//       <div className="trfx-charts">
//         <div className="trfx-card">
//           <div className="trfx-cardHeader">
//             <h3 className="trfx-h3">Transfers by Status</h3>
//           </div>
//           <div className="trfx-cardBody trfx-chartBody">
//             <ResponsiveContainer width="100%" height={240}>
//               <PieChart>
//                 <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={70} outerRadius={95} paddingAngle={2}>
//                   {byStatus.map((entry) => (
//                     <Cell key={entry.name} fill={entry.color} />
//                   ))}
//                 </Pie>
//                 <ReTooltip formatter={(v, n) => [`${v}`, n]} contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }} />
//                 <Legend verticalAlign="middle" align="right" layout="vertical" />
//               </PieChart>
//             </ResponsiveContainer>
//           </div>
//         </div>

//         <div className="trfx-card">
//           <div className="trfx-cardHeader">
//             <h3 className="trfx-h3">Transfers by Type</h3>
//           </div>
//           <div className="trfx-cardBody trfx-chartBody">
//             <ResponsiveContainer width="100%" height={240}>
//               <PieChart>
//                 <Pie data={byType} dataKey="value" nameKey="name" innerRadius={70} outerRadius={95} paddingAngle={2}>
//                   {byType.map((entry) => (
//                     <Cell key={entry.name} fill={entry.color} />
//                   ))}
//                 </Pie>
//                 <ReTooltip formatter={(v, n) => [`${v}`, n]} contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }} />
//                 <Legend verticalAlign="middle" align="right" layout="vertical" />
//               </PieChart>
//             </ResponsiveContainer>
//           </div>
//         </div>
//       </div>

//       {/* Bar chart (hover required) */}
//       <div className="trfx-card trfx-wideCard">
//         <div className="trfx-cardHeader trfx-cardHeaderRow">
//           <h3 className="trfx-h3">Transfers in the last 7 days</h3>
//           <span className="trfx-muted trfx-small">Hover bars to see count + value</span>
//         </div>
//         <div className="trfx-cardBody">
//           <ResponsiveContainer width="100%" height={260}>
//             <BarChart data={barDaily} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
//               <CartesianGrid strokeDasharray="3 3" />
//               <XAxis dataKey="label" />
//               <YAxis allowDecimals={false} />
//               <ReTooltip
//                 contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }}
//                 formatter={(v, name) => {
//                   if (name === "count") return [`${v} transfers`, "Transfers"];
//                   if (name === "value") return [formatEUR(v), "Total value"];
//                   return [v, name];
//                 }}
//                 labelFormatter={(label) => `Day: ${label}`}
//               />
//               <Legend />
//               <Bar dataKey="count" name="count" radius={[8, 8, 0, 0]} fill="var(--trfx-barA)" />
//               <Bar dataKey="value" name="value" radius={[8, 8, 0, 0]} fill="var(--trfx-barB)" />
//             </BarChart>
//           </ResponsiveContainer>
//         </div>
//       </div>

//       {/* Filters + Table */}
//       <div className="trfx-card trfx-wideCard">
//         <div className="trfx-filtersHeader">
//           <div className="trfx-filtersTitle">
//             <Filter size={16} />
//             <span>Filters</span>
//           </div>

//           <div className="trfx-filtersActions">
//             <button className="trfx-btn trfx-btnGhost" onClick={resetFilters}>
//               <X size={16} /> Reset filters
//             </button>
//             <button className="trfx-btn trfx-btnPrimary" onClick={onExport}>
//               <Download size={16} /> Export
//             </button>
//           </div>
//         </div>

//         <div className="trfx-filtersRow">
//           <div className="trfx-inputWrap">
//             <Search size={16} className="trfx-inputIcon" />
//             <input
//               className="trfx-input"
//               placeholder="Search by ID or name..."
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//             />
//           </div>

//           <Select value={region} onChange={setRegion} options={REGIONS} leftIcon={<ChevronDown size={16} />} />
//           <Select
//             value={timeRange.label}
//             onChange={(lbl) => setTimeRange(TIME_RANGES.find((x) => x.label === lbl) || TIME_RANGES[1])}
//             options={TIME_RANGES.map((x) => x.label)}
//             leftIcon={<Calendar size={16} />}
//           />
//           <Select value={status} onChange={setStatus} options={STATUSES} leftIcon={<ChevronDown size={16} />} />
//         </div>

//         <div className="trfx-tableWrap" ref={printRef}>
//           <div className="trfx-tableTitleRow">
//             <div className="trfx-tableTitle">
//               <span className="trfx-docIcon">📄</span>
//               <h3 className="trfx-h3">Transfer Records</h3>
//             </div>
//             <div className="trfx-muted trfx-small">
//               Showing <b>{filtered.length}</b> records
//             </div>
//           </div>

//           <div className="trfx-table">
//             <div className="trfx-thead">
//               <div>Transfer ID</div>
//               <div>Parcel ID</div>
//               <div>Region</div>
//               <div>Type</div>
//               <div>Status</div>
//               <div>Buyer</div>
//               <div>Seller</div>
//               <div>Value</div>
//               <div>Processing</div>
//               <div className="trfx-center">Action</div>
//             </div>

//             {filtered.map((t) => (
//               <div className="trfx-trow" key={t.id}>
//                 <div className="trfx-mono">{t.id}</div>
//                 <div className="trfx-mono">{t.parcelId}</div>
//                 <div>{t.region}</div>
//                 <div>{t.type}</div>
//                 <div>
//                   <StatusPill status={t.status} />
//                 </div>
//                 <div className="trfx-truncate" title={t.buyer}>
//                   {t.buyer}
//                 </div>
//                 <div className="trfx-truncate" title={t.seller}>
//                   {t.seller}
//                 </div>
//                 <div className="trfx-mono">{formatEUR(t.value)}</div>
//                 <div>{t.processingDays == null ? "In progress" : `${t.processingDays} days`}</div>
//                 <div className="trfx-center">
//                   <button className="trfx-linkBtn" onClick={() => setSelected(t)} title="View">
//                     <Eye size={16} />
//                     View
//                   </button>
//                 </div>
//               </div>
//             ))}

//             {!filtered.length && (
//               <div className="trfx-empty">
//                 <div className="trfx-emptyBox">
//                   <div className="trfx-emptyTitle">No results</div>
//                   <div className="trfx-muted">Try adjusting filters or search terms.</div>
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* View Modal (like disputes) */}
//       {selected && (
//         <div className="trfx-modalOverlay" role="dialog" aria-modal="true" aria-label="Transfer details">
//           <div className="trfx-modal">
//             <div className="trfx-modalHeader">
//               <div>
//                 <div className="trfx-modalTitle">Transfer Details</div>
//                 <div className="trfx-muted trfx-small">{selected.id}</div>
//               </div>
//               <button className="trfx-iconBtn" onClick={() => setSelected(null)} aria-label="Close">
//                 <X size={18} />
//               </button>
//             </div>

//             <div className="trfx-modalBody">
//               <div className="trfx-detailGrid">
//                 <DetailItem label="Parcel ID" value={selected.parcelId} mono />
//                 <DetailItem label="Region" value={selected.region} />
//                 <DetailItem label="Type" value={selected.type} />
//                 <DetailItem label="Status" value={<StatusPill status={selected.status} />} />
//                 <DetailItem label="Buyer" value={selected.buyer} />
//                 <DetailItem label="Seller" value={selected.seller} />
//                 <DetailItem label="Value" value={formatEUR(selected.value)} mono />
//                 <DetailItem label="Processing" value={selected.processingDays == null ? "In progress" : `${selected.processingDays} days`} />
//                 <DetailItem label="Created" value={fmtDate(selected.createdAt)} />
//                 <DetailItem label="Last update" value={fmtDate(selected.updatedAt)} />
//               </div>

//               <div className="trfx-notes">
//                 <div className="trfx-notesTitle">Notes</div>
//                 <div className="trfx-notesBody">{selected.notes || "—"}</div>
//               </div>
//             </div>

//             <div className="trfx-modalFooter">
//               <button
//                 className="trfx-btn trfx-btnGhost"
//                 onClick={() => {
//                   const csv = toCSV([selected]);
//                   downloadTextFile(`${selected.id}.csv`, csv, "text/csv;charset=utf-8");
//                 }}
//               >
//                 <Download size={16} /> Download
//               </button>
//               <button
//                 className="trfx-btn trfx-btnGhost"
//                 onClick={() => {
//                   // Print details: temporarily mark body for print styles
//                   setPrintMode(true);
//                   setTimeout(() => {
//                     window.print();
//                     setTimeout(() => setPrintMode(false), 200);
//                   }, 50);
//                 }}
//               >
//                 <Printer size={16} /> Print
//               </button>
//               <button className="trfx-btn trfx-btnPrimary" onClick={() => setSelected(null)}>
//                 Close
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// /* ----------------------------- Small UI Components ----------------------------- */

// function KpiCard({ title, value, hint, icon }) {
//   return (
//     <div className="trfx-kpiCard">
//       <div className="trfx-kpiTop">
//         <div className="trfx-kpiTitle">{title}</div>
//         <div className="trfx-kpiIconWrap">{icon}</div>
//       </div>
//       <div className="trfx-kpiValue">{value}</div>
//       <div className="trfx-kpiHint">{hint}</div>
//     </div>
//   );
// }

// function StatusPill({ status }) {
//   const cls =
//     status === "Completed"
//       ? "ok"
//       : status === "Approved"
//       ? "approved"
//       : status === "Pending"
//       ? "pending"
//       : "rejected";
//   return <span className={`trfx-pill ${cls}`}>{status}</span>;
// }

// function DetailItem({ label, value, mono }) {
//   return (
//     <div className="trfx-detailItem">
//       <div className="trfx-detailLabel">{label}</div>
//       <div className={`trfx-detailValue ${mono ? "trfx-mono" : ""}`}>{value}</div>
//     </div>
//   );
// }

// function Select({ value, onChange, options, leftIcon }) {
//   return (
//     <div className="trfx-selectWrap">
//       <div className="trfx-selectLeftIcon">{leftIcon}</div>
//       <select className="trfx-select" value={value} onChange={(e) => onChange(e.target.value)}>
//         {options.map((opt) => (
//           <option key={opt} value={opt}>
//             {opt}
//           </option>
//         ))}
//       </select>
//     </div>
//   );
// }
