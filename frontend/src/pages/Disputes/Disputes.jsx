import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import "./Disputes.css";
import { getDisputes, fetchDisputeStats } from "../../utils/api";

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  Open: "#F59E0B",
  Investigation: "#A78BFA",
  Court: "#FB7185",
  Resolved: "#34D399",
};

const REGIONS  = ["All Regions","Belgrade","Južna Bačka","Severna Bačka","Zapadna Bačka","Srednji Banat","Severni Banat","Južni Banat","Srem","Mačva","Kolubara","Podunavlje","Braničevo","Šumadija","Pomoravlje","Bor","Zaječar","Zlatibor","Moravica","Raška","Rasina","Nišava","Toplica","Pirot","Jablanica","Pčinja"];
const STATUSES = ["All Statuses","Open","Investigation","Court","Resolved"];
const RANGES   = ["Last 7 days","Last 30 days","Last 90 days","This year"];
const RANGE_DAYS = { "Last 7 days": 7, "Last 30 days": 30, "Last 90 days": 90, "This year": 365 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatEuro(value) {
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
  } catch {
    return `${value} €`;
  }
}

function daysBetween(dateStr, now = new Date()) {
  const cleaned = dateStr.replace(/\s/g, "").replace(/\.$/, "");
  const [d, m, y] = cleaned.split(".").filter(Boolean).map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return Math.max(0, Math.floor((now - dt) / 86400000));
}

function toCSV(rows, headers) {
  const escape = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  return [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
}

function downloadFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// ─── Map raw API dispute → flat shape the UI expects ─────────────────────────
// Backend fields (from Dispute.js model):
//   disputeId, parcel{parcelId,region}, claimant{personalInfo,corporateInfo},
//   defendant{...}, disputeType, claimedAmount, status, priority,
//   filingDate, resolutionDate, region, updates[], resolution{}
function normalizeDispute(d) {
  const now    = new Date();
  const status = d.status ?? "Open";

  // Format ISO date → "d. m. yyyy."
  const filingDate = d.filingDate
    ? (() => { const dt = new Date(d.filingDate); return `${dt.getDate()}. ${dt.getMonth()+1}. ${dt.getFullYear()}.`; })()
    : "—";

  // claimedAmount is the model field name (NOT claimedValue)
  const estValue = d.claimedAmount ?? d.estimatedCost ?? 0;

  const parcel   = d.parcel ?? {};
  const parcelId = parcel.parcelId ?? "—";
  const region   = d.region ?? parcel.region ?? "—";

  // disputeType comes as snake_case from enum e.g. "ownership_claim"
  // Pretty-print: "ownership_claim" → "Ownership Claim"
  const rawType    = d.disputeType ?? "other";
  const disputeType = rawType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const disputeId = d.disputeId ?? (d._id ? `DSP-${String(d._id).slice(-6).toUpperCase()}` : "—");

  let daysOpen;
  if (status === "Resolved") {
    daysOpen = "Resolved";
  } else if (d.filingDate) {
    const ms = now - new Date(d.filingDate);
    daysOpen = `${Math.max(0, Math.floor(ms / 86400000))} days`;
  } else {
    daysOpen = `${daysBetween(filingDate, now)} days`;
  }

  return {
    // UI-facing keys (same as original component used)
    "Dispute ID":  disputeId,
    "Parcel ID":   parcelId,
    Region:        region,
    Type:          disputeType,
    Status:        status,
    "Filed Date":  filingDate,
    "Est. Value":  estValue,
    "Days Open":   daysOpen,
    // Full raw record for detail panel
    _raw: d,
  };
}

// Helper: get owner display name from populated Owner doc
function ownerName(owner) {
  if (!owner) return "—";
  if (owner.personalInfo?.firstName) return `${owner.personalInfo.firstName} ${owner.personalInfo.lastName}`;
  if (owner.corporateInfo?.companyName) return owner.corporateInfo.companyName;
  return "—";
}

// ─── Icon ─────────────────────────────────────────────────────────────────────
function Icon({ name }) {
  if (name === "alert") return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 1 21h22L12 2Zm0 6c.55 0 1 .45 1 1v5a1 1 0 1 1-2 0V9c0-.55.45-1 1-1Zm0 10a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 12 18Z"/></svg>;
  if (name === "scale") return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 5 5v2h14V5l-7-3Zm7 6H5v2h14V8Zm-2 4h-2v9h-6v-9H7l-3 7h8l-3-7h2v7h2v-7h2l-3 7h8l-3-7Z"/></svg>;
  if (name === "clock") return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm1 10.4 3.2 1.9-.8 1.4L11 13V7h2v5.4Z"/></svg>;
  if (name === "euro")  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 5.5c1.2 0 2.3.3 3.2 1l-1 1.8c-.7-.5-1.5-.7-2.4-.7-1.9 0-3.5 1.1-4.2 2.9H16v2h-5.3c0 .2 0 .4 0 .5s0 .3 0 .5H16v2h-4.9c.7 1.8 2.3 2.9 4.4 2.9.9 0 1.7-.2 2.4-.7l1 1.8c-1 .7-2.1 1-3.4 1-3.2 0-5.8-1.8-6.7-5H7v-2h1.5c0-.2 0-.4 0-.5s0-.3 0-.5H7v-2h1.8c.9-3.2 3.5-5 6.7-5Z"/></svg>;
  if (name === "search")    return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 2a8 8 0 1 0 4.9 14.3l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12a6 6 0 0 1 0-12Z"/></svg>;
  if (name === "download")  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3v10l3-3 1.4 1.4L12 16.8 7.6 11.4 9 10l3 3V3h0ZM5 19h14v2H5v-2Z"/></svg>;
  if (name === "printer")   return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 7V3h10v4H7Zm10 10v-3H7v3H3v-7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7h-4Zm-2 4H9v-5h6v5Z"/></svg>;
  if (name === "eye")       return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5c5 0 9.3 3.1 11 7-1.7 3.9-6 7-11 7S2.7 15.9 1 12c1.7-3.9 6-7 11-7Zm0 3a4 4 0 1 0 0 8a4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4a2 2 0 0 1 0-4Z"/></svg>;
  if (name === "arrowLeft") return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.7 6.7 13.3 5.3 6.6 12l6.7 6.7 1.4-1.4L9.4 12l5.3-5.3Z"/></svg>;
  if (name === "close")     return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z"/></svg>;
  if (name === "logo")      return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l8.7 5v10L12 22l-8.7-5V7L12 2Zm0 2.3L5.3 8v8L12 19.7 18.7 16V8L12 4.3Zm0 3.2a4.5 4.5 0 1 1 0 9a4.5 4.5 0 0 1 0-9Zm0 2a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5Z"/></svg>;
  return null;
}

// ─── Sub-components (identical structure to original) ─────────────────────────
function SummaryCard({ title, value, sub, icon, badge }) {
  return (
    <div className="dspx-card">
      <div className="dspx-card__head">
        <div>
          <div className="dspx-card__title">{title}</div>
          <div className="dspx-card__value">{value}</div>
          {sub ? <div className={`dspx-card__sub ${badge?.tone ? `dspx-tone-${badge.tone}` : ""}`}>{sub}</div> : null}
        </div>
        <div className={`dspx-card__icon ${badge?.tone ? `dspx-tone-${badge.tone}` : ""}`} title={title} aria-hidden="true">
          <Icon name={icon} />
        </div>
      </div>
    </div>
  );
}

function Pill({ status }) {
  const color = STATUS_COLORS[status] || "#CBD5E1";
  return <span className="dspx-pill" style={{ borderColor: color, color, background: `${color}22` }}>{status}</span>;
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="dspx-tabs" role="tablist" aria-label="Details Tabs">
      {tabs.map(t => (
        <button key={t} className={`dspx-tab ${active === t ? "dspx-isActive" : ""}`}
          onClick={() => onChange(t)} role="tab" aria-selected={active === t} type="button">{t}</button>
      ))}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="dspx-infoRow">
      <div className="dspx-infoRow__label">{label}</div>
      <div className="dspx-infoRow__value">{value}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Disputes() {
  const navigate = useNavigate();
  const printRef = useRef(null);

  // ── 1. API STATE ─────────────────────────────────────────────────────────────
  // allDisputes  → normalized rows fetched from GET /api/disputes
  // statsData    → from GET /api/disputes/stats/summary  (powers KPI cards + pie chart)
  // loading      → shows spinner while fetching
  // totalCount   → total records (from pagination meta)
  const [allDisputes, setAllDisputes] = useState([]);
  const [statsData,   setStatsData]   = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [totalCount,  setTotalCount]  = useState(0);

  // ── 2. FILTER STATE ───────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("All Regions");
  const [range,  setRange]  = useState("Last 30 days");
  const [status, setStatus] = useState("All Statuses");

  // ── 3. TABLE STATE ────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // ── 4. DETAIL-VIEW STATE ──────────────────────────────────────────────────────
  const [selected,  setSelected]  = useState(null);
  const [activeTab, setActiveTab] = useState("Details");

  // ── 5. DATA FETCH ─────────────────────────────────────────────────────────────
  // Runs when region or status filter changes (server-side filtering).
  // Search and date-range are done client-side on the fetched batch.
  useEffect(() => {
    setLoading(true);

    const params = { page: 1, limit: 1000 }; // fetch full batch for client-side search+range
    if (region !== "All Regions")  params.region = region;
    if (status !== "All Statuses") params.status = status;

    Promise.allSettled([
      getDisputes(params),
      fetchDisputeStats(region !== "All Regions" ? region : ""),
    ]).then(([dispRes, statsRes]) => {
      if (dispRes.status === "fulfilled") {
        const raw = dispRes.value?.data ?? [];
        setAllDisputes(Array.isArray(raw) ? raw.map(normalizeDispute) : []);
        setTotalCount(dispRes.value?.pagination?.total ?? raw.length);
      } else {
        console.error("Disputes fetch failed:", dispRes.reason);
        setAllDisputes([]);
      }
      if (statsRes.status === "fulfilled") {
        setStatsData(statsRes.value?.data ?? null);
      }
    }).finally(() => setLoading(false));
  }, [region, status]); // re-fetch only when server-side filters change

  // ── 6. CLIENT-SIDE FILTERING (search + date range on fetched data) ────────────
  const filtered = useMemo(() => {
    const q      = search.trim().toLowerCase();
    const days   = RANGE_DAYS[range] ?? 30;
    const cutoff = new Date(Date.now() - days * 86400000);

    return allDisputes.filter(d => {
      // Text search across Dispute ID, Parcel ID, Region, Type
      const matchQ =
        !q ||
        d["Dispute ID"].toLowerCase().includes(q) ||
        d["Parcel ID"].toLowerCase().includes(q) ||
        d.Region.toLowerCase().includes(q) ||
        d.Type.toLowerCase().includes(q);

      // Date-range filter using raw ISO date from _raw
      const rawDate   = d._raw?.filingDate;
      const matchDate = !rawDate || new Date(rawDate) >= cutoff;

      return matchQ && matchDate;
    });
  }, [allDisputes, search, range]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => { setPage(1); }, [search, region, status, range]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  // ── 7. KPI CARDS ─────────────────────────────────────────────────────────────
  // Prefer statsData (real DB aggregation) → fall back to counting filtered rows
  const kpis = useMemo(() => {
    const open = (statsData?.byStatus ?? []).find(s => s._id === "Open")?.count
      ?? filtered.filter(d => d.Status === "Open").length;

    const inCourt = (statsData?.byStatus ?? []).find(s => s._id === "Court")?.count
      ?? filtered.filter(d => d.Status === "Court").length;

    // Avg days from non-resolved rows in current filtered set
    const dayNums = filtered
      .filter(d => d["Days Open"] !== "Resolved")
      .map(d => parseInt(String(d["Days Open"]).replace(/\D/g, ""), 10))
      .filter(n => Number.isFinite(n));
    const avg = dayNums.length
      ? Math.round(dayNums.reduce((a, b) => a + b, 0) / dayNums.length)
      : Math.round(statsData?.avgResolutionDays ?? 0) || 0;

    const totalValue = filtered.reduce((sum, d) => sum + (Number(d["Est. Value"]) || 0), 0);

    return { open, inCourt, avg, totalValue };
  }, [filtered, statsData]);

  // ── 8. PIE CHART — updates whenever filters change ───────────────────────────
  // Counts Status across the currently filtered rows, NOT from static mock
  const disputesByStatus = useMemo(() => {
    const counts = { Open: 0, Investigation: 0, Court: 0, Resolved: 0 };
    for (const d of filtered) counts[d.Status] = (counts[d.Status] || 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // ── 9. BAR CHART — updates whenever filters change ───────────────────────────
  const topRegions = useMemo(() => {
    const map = new Map();
    for (const d of filtered) map.set(d.Region, (map.get(d.Region) || 0) + 1);
    const arr = Array.from(map.entries()).map(([name, count]) => ({ name, count, score: count * 120 + 30 }));
    arr.sort((a, b) => b.score - a.score);
    return arr.slice(0, 6);
  }, [filtered]);

  // ── 10. ACTIONS ───────────────────────────────────────────────────────────────
  function resetFilters() {
    setSearch(""); setRegion("All Regions"); setRange("Last 30 days"); setStatus("All Statuses");
  }

  function handleExportCurrent() {
    const rows = filtered.map(d => ({
      DisputeID:   d["Dispute ID"],
      ParcelID:    d["Parcel ID"],
      Region:      d.Region,
      Type:        d.Type,
      Status:      d.Status,
      FiledDate:   d["Filed Date"],
      EstValueEUR: d["Est. Value"],
      DaysOpen:    d["Days Open"],
    }));
    const csv = toCSV(rows, Object.keys(rows[0] || { DisputeID: "" }));
    downloadFile(`disputes_export_${Date.now()}.csv`, csv, "text/csv;charset=utf-8");
  }

  function handleExportSelected() {
    if (!selected) return;
    downloadFile(
      `dispute_${selected["Dispute ID"]}.json`,
      JSON.stringify({ dispute: selected._raw, exportedAt: new Date().toISOString() }, null, 2),
      "application/json;charset=utf-8"
    );
  }

  function handlePrintSelected() {
    if (!selected) return;
    document.body.classList.add("dspx-print-detail-only");
    requestAnimationFrame(() => { window.print(); document.body.classList.remove("dspx-print-detail-only"); });
  }

  function openDetails(row) { setSelected(row); setActiveTab("Details"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function closeDetails()   { setSelected(null); setActiveTab("Details"); }

  // Detail panel header values
  const detailHeader = useMemo(() => {
    if (!selected) return null;
    return {
      val:            formatEuro(selected["Est. Value"]),
      processingTime: selected["Days Open"] === "Resolved" ? "Completed" : selected["Days Open"],
      regionName:     selected.Region,
    };
  }, [selected]);

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div id="dspx-page" className="dspx-page">
      {/* Top row: breadcrumb + back */}
      <div className="dspx-topbar">
        <div className="dspx-topbarLeft">
          <div className="dspx-brand" role="button" tabIndex={0}
            onClick={() => navigate("/dashboard")} onKeyDown={e => e.key === "Enter" && navigate("/dashboard")}>
            <span className="dspx-brandMark" aria-hidden="true"><Icon name="logo" /></span>
            <div className="dspx-brandText">
              <div className="dspx-brandName">Land Registry</div>
              <div className="dspx-brandSub">Disputes Module</div>
            </div>
          </div>
          <div className="dspx-crumbs">
            <span className="dspx-crumb">Dashboard</span>
            <span className="dspx-crumbSep">›</span>
            <span className="dspx-crumb dspx-isActive">Disputes</span>
          </div>
        </div>
        <button className="dspx-btn dspx-btn--ghost" type="button" onClick={() => navigate("/dashboard")}>
          <Icon name="arrowLeft" /> Back to Dashboard
        </button>
      </div>

      {/* Title */}
      <div className="dspx-pagehead">
        <div>
          <h1 className="dspx-h1">Disputes Dashboard</h1>
          <div className="dspx-muted">
            Monitor and manage land ownership disputes
            {totalCount > 0 && ` · ${totalCount.toLocaleString()} total records`}
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6B7280" }}>
          Loading disputes…
        </div>
      )}

      {/* Detail view */}
      {selected ? (
        <div className="dspx-detailWrap" ref={printRef}>
          <div className="dspx-detailTop">
            <div className="dspx-detailTitleRow">
              <button className="dspx-btn dspx-btn--ghost" type="button" onClick={closeDetails}>
                <Icon name="arrowLeft" /> Back
              </button>
              <div className="dspx-detailTitle">
                <div className="dspx-detailId">{selected["Dispute ID"]}</div>
                <span className={`dspx-badge dspx-badge--${selected.Status === "Resolved" ? "green" : "amber"}`}>
                  {selected.Status}
                </span>
                <div className="dspx-detailSub">{selected.Type}</div>
              </div>
              <div className="dspx-detailActions">
                <button className="dspx-btn dspx-btn--secondary" type="button" onClick={handlePrintSelected}>
                  <Icon name="printer" /> Print
                </button>
                <button className="dspx-btn dspx-btn--primary" type="button" onClick={handleExportSelected}>
                  <Icon name="download" /> Export
                </button>
                <button className="dspx-btn dspx-btn--icon" type="button" onClick={closeDetails} aria-label="Close details">
                  <Icon name="close" />
                </button>
              </div>
            </div>

            <div className="dspx-kpiRow">
              <div className="dspx-kpiBox">
                <div className="dspx-kpiIcon dspx-tone-gold"><Icon name="euro" /></div>
                <div>
                  <div className="dspx-kpiValue">{detailHeader?.val}</div>
                  <div className="dspx-kpiLabel">Claimed Value</div>
                </div>
              </div>
              <div className="dspx-kpiBox">
                <div className="dspx-kpiIcon dspx-tone-blue"><Icon name="clock" /></div>
                <div>
                  <div className="dspx-kpiValue">{detailHeader?.processingTime}</div>
                  <div className="dspx-kpiLabel">Processing Time</div>
                </div>
              </div>
              <div className="dspx-kpiBox">
                <div className="dspx-kpiIcon dspx-tone-green"><Icon name="scale" /></div>
                <div>
                  <div className="dspx-kpiValue">{selected.Type}</div>
                  <div className="dspx-kpiLabel">Dispute Type</div>
                </div>
              </div>
              <div className="dspx-kpiBox">
                <div className="dspx-kpiIcon dspx-tone-purple"><Icon name="alert" /></div>
                <div>
                  <div className="dspx-kpiValue">{detailHeader?.regionName}</div>
                  <div className="dspx-kpiLabel">Region</div>
                </div>
              </div>
            </div>

            <Tabs tabs={["Details", "Parties", "Timeline", "Validation"]} active={activeTab} onChange={setActiveTab} />
          </div>

          <div className="dspx-detailGrid">
            <div className="dspx-panel">
              <div className="dspx-panelHead"><div className="dspx-panelTitle">Dispute Information</div></div>
              <div className="dspx-panelBody">
                <InfoRow label="Dispute ID"   value={selected["Dispute ID"]} />
                <InfoRow label="Parcel ID"    value={selected["Parcel ID"]} />
                <InfoRow label="Type"         value={selected.Type} />
                <InfoRow label="Filed Date"   value={selected["Filed Date"]} />
                <InfoRow label="Status"       value={selected.Status} />
                <InfoRow label="Priority"     value={selected._raw?.priority ?? "—"} />
              </div>
            </div>

            <div className="dspx-panel">
              <div className="dspx-panelHead"><div className="dspx-panelTitle">Property Details</div></div>
              <div className="dspx-panelBody">
                <InfoRow label="Region"   value={selected.Region} />
                <InfoRow label="Parcel ID" value={selected["Parcel ID"]} />
                <div className="dspx-hashBox">
                  <div className="dspx-hashLabel">Transaction Hash</div>
                  <div className="dspx-hashValue">
                    {selected._raw?.parcel?.blockchainHash
                      ?? `0x${selected["Parcel ID"].toLowerCase().replace(/[^a-z0-9]/g, "")}cd34e5f6...`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tab content panel */}
          <div className="dspx-panel dspx-mt16">
            <div className="dspx-panelHead"><div className="dspx-panelTitle">{activeTab}</div></div>
            <div className="dspx-panelBody">
              {activeTab === "Details" && (
                <div className="dspx-grid2">
                  <InfoRow label="Dispute ID"     value={selected["Dispute ID"]} />
                  <InfoRow label="Status"         value={selected.Status} />
                  <InfoRow label="Estimated Value" value={formatEuro(selected["Est. Value"])} />
                  <InfoRow label="Days Open"      value={selected["Days Open"]} />
                  <InfoRow label="Region"         value={selected.Region} />
                  <InfoRow label="Dispute Type"   value={selected.Type} />
                </div>
              )}

              {activeTab === "Parties" && (
                <div className="dspx-stack">
                  <div className="dspx-grid2">
                    <InfoRow label="Claimant"      value={ownerName(selected._raw?.claimant)} />
                    <InfoRow label="Defendant"     value={ownerName(selected._raw?.defendant)} />
                    <InfoRow label="Assigned Officer" value={
                      selected._raw?.assignedTo
                        ? `${selected._raw.assignedTo.firstName ?? ""} ${selected._raw.assignedTo.lastName ?? ""}`.trim()
                        : "—"
                    } />
                    <InfoRow label="Legal Counsel" value="—" />
                  </div>
                </div>
              )}

              {activeTab === "Timeline" && (
                <div className="dspx-timeline">
                  <div className="dspx-tItem">
                    <div className="dspx-tDot" />
                    <div><div className="dspx-tTitle">Filed</div><div className="dspx-tMeta">{selected["Filed Date"]}</div></div>
                  </div>
                  {selected._raw?.investigationStartDate && (
                    <div className="dspx-tItem">
                      <div className="dspx-tDot" />
                      <div>
                        <div className="dspx-tTitle">Investigation Started</div>
                        <div className="dspx-tMeta">{new Date(selected._raw.investigationStartDate).toLocaleDateString()}</div>
                      </div>
                    </div>
                  )}
                  {selected._raw?.courtFilingDate && (
                    <div className="dspx-tItem">
                      <div className="dspx-tDot" />
                      <div>
                        <div className="dspx-tTitle">Court Filing</div>
                        <div className="dspx-tMeta">{new Date(selected._raw.courtFilingDate).toLocaleDateString()}</div>
                      </div>
                    </div>
                  )}
                  <div className="dspx-tItem">
                    <div className="dspx-tDot" />
                    <div><div className="dspx-tTitle">Current Status</div><div className="dspx-tMeta">{selected.Status}</div></div>
                  </div>
                  {selected._raw?.resolutionDate && (
                    <div className="dspx-tItem">
                      <div className="dspx-tDot" />
                      <div>
                        <div className="dspx-tTitle">Resolved</div>
                        <div className="dspx-tMeta">{new Date(selected._raw.resolutionDate).toLocaleDateString()}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "Validation" && (
                <div className="dspx-stack">
                  <ul className="dspx-checkList">
                    <li>Parcel identifier verified</li>
                    <li>Ownership record checked</li>
                    <li>Encumbrance scan completed</li>
                    <li>Dispute type classified: {selected.Type}</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="dspx-footer">
            <div className="dspx-footerInner">
              <div className="dspx-footerLeft"><span className="dspx-footerDot" /><span>Secure Registry • Disputes</span></div>
              <div className="dspx-footerRight">© {new Date().getFullYear()} Land Registry</div>
            </div>
          </div>
        </div>

      ) : (
        <>
          {/* Summary cards */}
          <div className="dspx-grid4">
            <SummaryCard title="Open Disputes"      value={kpis.open}    sub="↘ 12% vs last month"  icon="alert" badge={{ tone: "gold"   }} />
            <SummaryCard title="In Court"           value={kpis.inCourt} sub="Active litigation"     icon="scale" badge={{ tone: "red"    }} />
            <SummaryCard title="Avg. Days Open"     value={`${kpis.avg} days`} sub="↘ 15% improvement" icon="clock" badge={{ tone: "blue"   }} />
            <SummaryCard title="Total Value at Stake" value={formatEuro(kpis.totalValue)} sub="Across all disputes" icon="euro" badge={{ tone: "purple" }} />
          </div>

          {/* Charts row */}
          <div className="dspx-grid2 dspx-mt16">
            <div className="dspx-panel">
              <div className="dspx-panelHead"><div className="dspx-panelTitle">Disputes by Status</div></div>
              <div className="dspx-panelBody">
                <div className="dspx-chartWrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={disputesByStatus} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100} paddingAngle={2}>
                        {disputesByStatus.map(entry => (
                          <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#94A3B8"} />
                        ))}
                      </Pie>
                      <ReTooltip formatter={(value, name) => [`${value}`, name]} contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="dspx-legend">
                    {disputesByStatus.map(s => (
                      <div className="dspx-legendItem" key={s.name}>
                        <span className="dspx-legendDot" style={{ background: STATUS_COLORS[s.name] || "#94A3B8" }} />
                        <span className="dspx-legendText">{s.name}: <b>{s.value}</b></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="dspx-panel">
              <div className="dspx-panelHead"><div className="dspx-panelTitle">Top Regions by Disputes</div></div>
              <div className="dspx-panelBody">
                <div className="dspx-chartWrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={topRegions} margin={{ left: 8, right: 12, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <ReTooltip
                        formatter={(value, name, props) => {
                          if (name === "score") return [`${props?.payload?.count ?? ""} disputes`, "Disputes"];
                          return [value, name];
                        }}
                        contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }}
                      />
                      <Bar dataKey="score" radius={[10, 10, 10, 10]} fill="var(--dspx-brand-500)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Filters + table */}
          <div className="dspx-panel dspx-mt16">
            <div className="dspx-panelHead">
              <div className="dspx-panelTitle">Filters</div>
              <div className="dspx-panelActions">
                <button className="dspx-btn dspx-btn--secondary" type="button" onClick={resetFilters}>Reset filters</button>
                <button className="dspx-btn dspx-btn--primary"   type="button" onClick={handleExportCurrent}><Icon name="download" /> Export</button>
              </div>
            </div>

            <div className="dspx-filters">
              <div className="dspx-field dspx-field--search">
                <span className="dspx-fieldIcon"><Icon name="search" /></span>
                <input className="dspx-input" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by ID or name..." aria-label="Search by ID or name" />
              </div>
              <div className="dspx-field">
                <select className="dspx-select" value={region} onChange={e => setRegion(e.target.value)} aria-label="Region filter">
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="dspx-field">
                <select className="dspx-select" value={range} onChange={e => setRange(e.target.value)} aria-label="Date range filter">
                  {RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="dspx-field">
                <select className="dspx-select" value={status} onChange={e => setStatus(e.target.value)} aria-label="Status filter">
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="dspx-panelBody">
              <div className="dspx-tableHead">
                <div className="dspx-panelTitleSmall">Dispute Records</div>
              </div>
              <div className="dspx-tableWrap">
                <table className="dspx-table" role="table" aria-label="Dispute Records">
                  <thead>
                    <tr>
                      <th>Dispute ID</th><th>Parcel ID</th><th>Region</th><th>Type</th>
                      <th>Status</th><th>Filed Date</th><th>Est. Value</th><th>Days Open</th>
                      <th className="dspx-thRight">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map(r => (
                      <tr key={r["Dispute ID"]}>
                        <td className="dspx-mono">{r["Dispute ID"]}</td>
                        <td className="dspx-mono">{r["Parcel ID"]}</td>
                        <td>{r.Region}</td>
                        <td>{r.Type}</td>
                        <td><Pill status={r.Status} /></td>
                        <td>{r["Filed Date"]}</td>
                        <td>{formatEuro(r["Est. Value"])}</td>
                        <td>{r["Days Open"]}</td>
                        <td className="dspx-tdRight">
                          <button className="dspx-btn dspx-btn--link" type="button" onClick={() => openDetails(r)}>
                            <Icon name="eye" /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                    {pageRows.length === 0 && !loading && (
                      <tr><td colSpan={9} className="dspx-empty">No results found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="dspx-pager">
                <div className="dspx-pagerLeft">
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} entries
                </div>
                <div className="dspx-pagerRight">
                  <button className="dspx-btn dspx-btn--secondary" type="button"
                    onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
                  <div className="dspx-pagerText">Page <b>{page}</b> of <b>{totalPages}</b></div>
                  <button className="dspx-btn dspx-btn--secondary" type="button"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
                </div>
              </div>
            </div>
          </div>

          <div className="dspx-footer">
            <div className="dspx-footerInner">
              <div className="dspx-footerLeft"><span className="dspx-footerDot" /><span>Secure Registry • Disputes</span></div>
              <div className="dspx-footerRight">© {new Date().getFullYear()} Land Registry</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
// import React, { useEffect, useMemo, useRef, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import {
//   ResponsiveContainer,
//   PieChart,
//   Pie,
//   Cell,
//   Tooltip as ReTooltip,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
// } from "recharts";
// import "./Disputes.css";
// import { getDisputes, fetchDisputeStats } from "../../utils/api";

// // ─── Constants ────────────────────────────────────────────────────────────────
// const STATUS_COLORS = {
//   Open: "#F59E0B",
//   Investigation: "#A78BFA",
//   Court: "#FB7185",
//   Resolved: "#34D399",
// };

// const REGIONS  = ["All Regions","Vojvodina","Belgrade","Nišava","Šumadija","Zlatibor","Braničevo","Podunavlje","Kolubara",'Jablanica',"Pčinja"];
// const STATUSES = ["All Statuses","Open","Investigation","Court","Resolved"];
// const RANGES   = ["Last 7 days","Last 30 days","Last 90 days","This year"];
// const RANGE_DAYS = { "Last 7 days": 7, "Last 30 days": 30, "Last 90 days": 90, "This year": 365 };

// // ─── Helpers ──────────────────────────────────────────────────────────────────
// function formatEuro(value) {
//   try {
//     return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
//   } catch {
//     return `${value} €`;
//   }
// }

// function daysBetween(dateStr, now = new Date()) {
//   const cleaned = dateStr.replace(/\s/g, "").replace(/\.$/, "");
//   const [d, m, y] = cleaned.split(".").filter(Boolean).map(Number);
//   const dt = new Date(y, (m || 1) - 1, d || 1);
//   return Math.max(0, Math.floor((now - dt) / 86400000));
// }

// function toCSV(rows, headers) {
//   const escape = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
//   return [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
// }

// function downloadFile(filename, content, mime = "text/plain;charset=utf-8") {
//   const blob = new Blob([content], { type: mime });
//   const url  = URL.createObjectURL(blob);
//   const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
//   document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
// }

// // ─── Map raw API dispute → flat shape the UI expects ─────────────────────────
// // Backend fields (from Dispute.js model):
// //   disputeId, parcel{parcelId,region}, claimant{personalInfo,corporateInfo},
// //   defendant{...}, disputeType, claimedAmount, status, priority,
// //   filingDate, resolutionDate, region, updates[], resolution{}
// function normalizeDispute(d) {
//   const now    = new Date();
//   const status = d.status ?? "Open";

//   // Format ISO date → "d. m. yyyy."
//   const filingDate = d.filingDate
//     ? (() => { const dt = new Date(d.filingDate); return `${dt.getDate()}. ${dt.getMonth()+1}. ${dt.getFullYear()}.`; })()
//     : "—";

//   // claimedAmount is the model field name (NOT claimedValue)
//   const estValue = d.claimedAmount ?? d.estimatedCost ?? 0;

//   const parcel   = d.parcel ?? {};
//   const parcelId = parcel.parcelId ?? "—";
//   const region   = d.region ?? parcel.region ?? "—";

//   // disputeType comes as snake_case from enum e.g. "ownership_claim"
//   // Pretty-print: "ownership_claim" → "Ownership Claim"
//   const rawType    = d.disputeType ?? "other";
//   const disputeType = rawType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

//   const disputeId = d.disputeId ?? (d._id ? `DSP-${String(d._id).slice(-6).toUpperCase()}` : "—");

//   let daysOpen;
//   if (status === "Resolved") {
//     daysOpen = "Resolved";
//   } else if (d.filingDate) {
//     const ms = now - new Date(d.filingDate);
//     daysOpen = `${Math.max(0, Math.floor(ms / 86400000))} days`;
//   } else {
//     daysOpen = `${daysBetween(filingDate, now)} days`;
//   }

//   return {
//     // UI-facing keys (same as original component used)
//     "Dispute ID":  disputeId,
//     "Parcel ID":   parcelId,
//     Region:        region,
//     Type:          disputeType,
//     Status:        status,
//     "Filed Date":  filingDate,
//     "Est. Value":  estValue,
//     "Days Open":   daysOpen,
//     // Full raw record for detail panel
//     _raw: d,
//   };
// }

// // Helper: get owner display name from populated Owner doc
// function ownerName(owner) {
//   if (!owner) return "—";
//   if (owner.personalInfo?.firstName) return `${owner.personalInfo.firstName} ${owner.personalInfo.lastName}`;
//   if (owner.corporateInfo?.companyName) return owner.corporateInfo.companyName;
//   return "—";
// }

// // ─── Icon ─────────────────────────────────────────────────────────────────────
// function Icon({ name }) {
//   if (name === "alert") return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 1 21h22L12 2Zm0 6c.55 0 1 .45 1 1v5a1 1 0 1 1-2 0V9c0-.55.45-1 1-1Zm0 10a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 12 18Z"/></svg>;
//   if (name === "scale") return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 5 5v2h14V5l-7-3Zm7 6H5v2h14V8Zm-2 4h-2v9h-6v-9H7l-3 7h8l-3-7h2v7h2v-7h2l-3 7h8l-3-7Z"/></svg>;
//   if (name === "clock") return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm1 10.4 3.2 1.9-.8 1.4L11 13V7h2v5.4Z"/></svg>;
//   if (name === "euro")  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.5 5.5c1.2 0 2.3.3 3.2 1l-1 1.8c-.7-.5-1.5-.7-2.4-.7-1.9 0-3.5 1.1-4.2 2.9H16v2h-5.3c0 .2 0 .4 0 .5s0 .3 0 .5H16v2h-4.9c.7 1.8 2.3 2.9 4.4 2.9.9 0 1.7-.2 2.4-.7l1 1.8c-1 .7-2.1 1-3.4 1-3.2 0-5.8-1.8-6.7-5H7v-2h1.5c0-.2 0-.4 0-.5s0-.3 0-.5H7v-2h1.8c.9-3.2 3.5-5 6.7-5Z"/></svg>;
//   if (name === "search")    return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 2a8 8 0 1 0 4.9 14.3l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12a6 6 0 0 1 0-12Z"/></svg>;
//   if (name === "download")  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3v10l3-3 1.4 1.4L12 16.8 7.6 11.4 9 10l3 3V3h0ZM5 19h14v2H5v-2Z"/></svg>;
//   if (name === "printer")   return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 7V3h10v4H7Zm10 10v-3H7v3H3v-7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7h-4Zm-2 4H9v-5h6v5Z"/></svg>;
//   if (name === "eye")       return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5c5 0 9.3 3.1 11 7-1.7 3.9-6 7-11 7S2.7 15.9 1 12c1.7-3.9 6-7 11-7Zm0 3a4 4 0 1 0 0 8a4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4a2 2 0 0 1 0-4Z"/></svg>;
//   if (name === "arrowLeft") return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.7 6.7 13.3 5.3 6.6 12l6.7 6.7 1.4-1.4L9.4 12l5.3-5.3Z"/></svg>;
//   if (name === "close")     return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z"/></svg>;
//   if (name === "logo")      return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l8.7 5v10L12 22l-8.7-5V7L12 2Zm0 2.3L5.3 8v8L12 19.7 18.7 16V8L12 4.3Zm0 3.2a4.5 4.5 0 1 1 0 9a4.5 4.5 0 0 1 0-9Zm0 2a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5Z"/></svg>;
//   return null;
// }

// // ─── Sub-components (identical structure to original) ─────────────────────────
// function SummaryCard({ title, value, sub, icon, badge }) {
//   return (
//     <div className="dspx-card">
//       <div className="dspx-card__head">
//         <div>
//           <div className="dspx-card__title">{title}</div>
//           <div className="dspx-card__value">{value}</div>
//           {sub ? <div className={`dspx-card__sub ${badge?.tone ? `dspx-tone-${badge.tone}` : ""}`}>{sub}</div> : null}
//         </div>
//         <div className={`dspx-card__icon ${badge?.tone ? `dspx-tone-${badge.tone}` : ""}`} title={title} aria-hidden="true">
//           <Icon name={icon} />
//         </div>
//       </div>
//     </div>
//   );
// }

// function Pill({ status }) {
//   const color = STATUS_COLORS[status] || "#CBD5E1";
//   return <span className="dspx-pill" style={{ borderColor: color, color, background: `${color}22` }}>{status}</span>;
// }

// function Tabs({ tabs, active, onChange }) {
//   return (
//     <div className="dspx-tabs" role="tablist" aria-label="Details Tabs">
//       {tabs.map(t => (
//         <button key={t} className={`dspx-tab ${active === t ? "dspx-isActive" : ""}`}
//           onClick={() => onChange(t)} role="tab" aria-selected={active === t} type="button">{t}</button>
//       ))}
//     </div>
//   );
// }

// function InfoRow({ label, value }) {
//   return (
//     <div className="dspx-infoRow">
//       <div className="dspx-infoRow__label">{label}</div>
//       <div className="dspx-infoRow__value">{value}</div>
//     </div>
//   );
// }

// // ─── Main Component ───────────────────────────────────────────────────────────
// export default function Disputes() {
//   const navigate = useNavigate();
//   const printRef = useRef(null);

//   // ── 1. API STATE ─────────────────────────────────────────────────────────────
//   // allDisputes  → normalized rows fetched from GET /api/disputes
//   // statsData    → from GET /api/disputes/stats/summary  (powers KPI cards + pie chart)
//   // loading      → shows spinner while fetching
//   // totalCount   → total records (from pagination meta)
//   const [allDisputes, setAllDisputes] = useState([]);
//   const [statsData,   setStatsData]   = useState(null);
//   const [loading,     setLoading]     = useState(true);
//   const [totalCount,  setTotalCount]  = useState(0);

//   // ── 2. FILTER STATE ───────────────────────────────────────────────────────────
//   const [search, setSearch] = useState("");
//   const [region, setRegion] = useState("All Regions");
//   const [range,  setRange]  = useState("Last 30 days");
//   const [status, setStatus] = useState("All Statuses");

//   // ── 3. TABLE STATE ────────────────────────────────────────────────────────────
//   const [page, setPage] = useState(1);
//   const pageSize = 10;

//   // ── 4. DETAIL-VIEW STATE ──────────────────────────────────────────────────────
//   const [selected,  setSelected]  = useState(null);
//   const [activeTab, setActiveTab] = useState("Details");

//   // ── 5. DATA FETCH ─────────────────────────────────────────────────────────────
//   // Runs when region or status filter changes (server-side filtering).
//   // Search and date-range are done client-side on the fetched batch.
//   useEffect(() => {
//     setLoading(true);

//     const params = { page: 1, limit: 200 }; // fetch a large batch for client-side search+range
//     if (region !== "All Regions")  params.region = region;
//     if (status !== "All Statuses") params.status = status;

//     Promise.allSettled([
//       getDisputes(params),
//       fetchDisputeStats(region !== "All Regions" ? region : ""),
//     ]).then(([dispRes, statsRes]) => {
//       if (dispRes.status === "fulfilled") {
//         const raw = dispRes.value?.data ?? [];
//         setAllDisputes(Array.isArray(raw) ? raw.map(normalizeDispute) : []);
//         setTotalCount(dispRes.value?.pagination?.total ?? raw.length);
//       } else {
//         console.error("Disputes fetch failed:", dispRes.reason);
//         setAllDisputes([]);
//       }
//       if (statsRes.status === "fulfilled") {
//         setStatsData(statsRes.value?.data ?? null);
//       }
//     }).finally(() => setLoading(false));
//   }, [region, status]); // re-fetch only when server-side filters change

//   // ── 6. CLIENT-SIDE FILTERING (search + date range on fetched data) ────────────
//   const filtered = useMemo(() => {
//     const q      = search.trim().toLowerCase();
//     const days   = RANGE_DAYS[range] ?? 30;
//     const cutoff = new Date(Date.now() - days * 86400000);

//     return allDisputes.filter(d => {
//       // Text search across Dispute ID, Parcel ID, Region, Type
//       const matchQ =
//         !q ||
//         d["Dispute ID"].toLowerCase().includes(q) ||
//         d["Parcel ID"].toLowerCase().includes(q) ||
//         d.Region.toLowerCase().includes(q) ||
//         d.Type.toLowerCase().includes(q);

//       // Date-range filter using raw ISO date from _raw
//       const rawDate   = d._raw?.filingDate;
//       const matchDate = !rawDate || new Date(rawDate) >= cutoff;

//       return matchQ && matchDate;
//     });
//   }, [allDisputes, search, range]);

//   const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

//   useEffect(() => { setPage(1); }, [search, region, status, range]);

//   const pageRows = useMemo(() => {
//     const start = (page - 1) * pageSize;
//     return filtered.slice(start, start + pageSize);
//   }, [filtered, page]);

//   // ── 7. KPI CARDS ─────────────────────────────────────────────────────────────
//   // Prefer statsData (real DB aggregation) → fall back to counting filtered rows
//   const kpis = useMemo(() => {
//     const open = (statsData?.byStatus ?? []).find(s => s._id === "Open")?.count
//       ?? filtered.filter(d => d.Status === "Open").length;

//     const inCourt = (statsData?.byStatus ?? []).find(s => s._id === "Court")?.count
//       ?? filtered.filter(d => d.Status === "Court").length;

//     // Avg days from non-resolved rows in current filtered set
//     const dayNums = filtered
//       .filter(d => d["Days Open"] !== "Resolved")
//       .map(d => parseInt(String(d["Days Open"]).replace(/\D/g, ""), 10))
//       .filter(n => Number.isFinite(n));
//     const avg = dayNums.length
//       ? Math.round(dayNums.reduce((a, b) => a + b, 0) / dayNums.length)
//       : Math.round(statsData?.avgResolutionDays ?? 0) || 0;

//     const totalValue = filtered.reduce((sum, d) => sum + (Number(d["Est. Value"]) || 0), 0);

//     return { open, inCourt, avg, totalValue };
//   }, [filtered, statsData]);

//   // ── 8. PIE CHART — updates whenever filters change ───────────────────────────
//   // Counts Status across the currently filtered rows, NOT from static mock
//   const disputesByStatus = useMemo(() => {
//     const counts = { Open: 0, Investigation: 0, Court: 0, Resolved: 0 };
//     for (const d of filtered) counts[d.Status] = (counts[d.Status] || 0) + 1;
//     return Object.entries(counts).map(([name, value]) => ({ name, value }));
//   }, [filtered]);

//   // ── 9. BAR CHART — updates whenever filters change ───────────────────────────
//   const topRegions = useMemo(() => {
//     const map = new Map();
//     for (const d of filtered) map.set(d.Region, (map.get(d.Region) || 0) + 1);
//     const arr = Array.from(map.entries()).map(([name, count]) => ({ name, count, score: count * 120 + 30 }));
//     arr.sort((a, b) => b.score - a.score);
//     return arr.slice(0, 6);
//   }, [filtered]);

//   // ── 10. ACTIONS ───────────────────────────────────────────────────────────────
//   function resetFilters() {
//     setSearch(""); setRegion("All Regions"); setRange("Last 30 days"); setStatus("All Statuses");
//   }

//   function handleExportCurrent() {
//     const rows = filtered.map(d => ({
//       DisputeID:   d["Dispute ID"],
//       ParcelID:    d["Parcel ID"],
//       Region:      d.Region,
//       Type:        d.Type,
//       Status:      d.Status,
//       FiledDate:   d["Filed Date"],
//       EstValueEUR: d["Est. Value"],
//       DaysOpen:    d["Days Open"],
//     }));
//     const csv = toCSV(rows, Object.keys(rows[0] || { DisputeID: "" }));
//     downloadFile(`disputes_export_${Date.now()}.csv`, csv, "text/csv;charset=utf-8");
//   }

//   function handleExportSelected() {
//     if (!selected) return;
//     downloadFile(
//       `dispute_${selected["Dispute ID"]}.json`,
//       JSON.stringify({ dispute: selected._raw, exportedAt: new Date().toISOString() }, null, 2),
//       "application/json;charset=utf-8"
//     );
//   }

//   function handlePrintSelected() {
//     if (!selected) return;
//     document.body.classList.add("dspx-print-detail-only");
//     requestAnimationFrame(() => { window.print(); document.body.classList.remove("dspx-print-detail-only"); });
//   }

//   function openDetails(row) { setSelected(row); setActiveTab("Details"); window.scrollTo({ top: 0, behavior: "smooth" }); }
//   function closeDetails()   { setSelected(null); setActiveTab("Details"); }

//   // Detail panel header values
//   const detailHeader = useMemo(() => {
//     if (!selected) return null;
//     return {
//       val:            formatEuro(selected["Est. Value"]),
//       processingTime: selected["Days Open"] === "Resolved" ? "Completed" : selected["Days Open"],
//       regionName:     selected.Region,
//     };
//   }, [selected]);

//   // ── RENDER ────────────────────────────────────────────────────────────────────
//   return (
//     <div id="dspx-page" className="dspx-page">
//       {/* Top row: breadcrumb + back */}
//       <div className="dspx-topbar">
//         <div className="dspx-topbarLeft">
//           <div className="dspx-brand" role="button" tabIndex={0}
//             onClick={() => navigate("/dashboard")} onKeyDown={e => e.key === "Enter" && navigate("/dashboard")}>
//             <span className="dspx-brandMark" aria-hidden="true"><Icon name="logo" /></span>
//             <div className="dspx-brandText">
//               <div className="dspx-brandName">Land Registry</div>
//               <div className="dspx-brandSub">Disputes Module</div>
//             </div>
//           </div>
//           <div className="dspx-crumbs">
//             <span className="dspx-crumb">Dashboard</span>
//             <span className="dspx-crumbSep">›</span>
//             <span className="dspx-crumb dspx-isActive">Disputes</span>
//           </div>
//         </div>
//         <button className="dspx-btn dspx-btn--ghost" type="button" onClick={() => navigate("/dashboard")}>
//           <Icon name="arrowLeft" /> Back to Dashboard
//         </button>
//       </div>

//       {/* Title */}
//       <div className="dspx-pagehead">
//         <div>
//           <h1 className="dspx-h1">Disputes Dashboard</h1>
//           <div className="dspx-muted">
//             Monitor and manage land ownership disputes
//             {totalCount > 0 && ` · ${totalCount.toLocaleString()} total records`}
//           </div>
//         </div>
//       </div>

//       {/* Loading indicator */}
//       {loading && (
//         <div style={{ textAlign: "center", padding: "3rem", color: "#6B7280" }}>
//           Loading disputes…
//         </div>
//       )}

//       {/* Detail view */}
//       {selected ? (
//         <div className="dspx-detailWrap" ref={printRef}>
//           <div className="dspx-detailTop">
//             <div className="dspx-detailTitleRow">
//               <button className="dspx-btn dspx-btn--ghost" type="button" onClick={closeDetails}>
//                 <Icon name="arrowLeft" /> Back
//               </button>
//               <div className="dspx-detailTitle">
//                 <div className="dspx-detailId">{selected["Dispute ID"]}</div>
//                 <span className={`dspx-badge dspx-badge--${selected.Status === "Resolved" ? "green" : "amber"}`}>
//                   {selected.Status}
//                 </span>
//                 <div className="dspx-detailSub">{selected.Type}</div>
//               </div>
//               <div className="dspx-detailActions">
//                 <button className="dspx-btn dspx-btn--secondary" type="button" onClick={handlePrintSelected}>
//                   <Icon name="printer" /> Print
//                 </button>
//                 <button className="dspx-btn dspx-btn--primary" type="button" onClick={handleExportSelected}>
//                   <Icon name="download" /> Export
//                 </button>
//                 <button className="dspx-btn dspx-btn--icon" type="button" onClick={closeDetails} aria-label="Close details">
//                   <Icon name="close" />
//                 </button>
//               </div>
//             </div>

//             <div className="dspx-kpiRow">
//               <div className="dspx-kpiBox">
//                 <div className="dspx-kpiIcon dspx-tone-gold"><Icon name="euro" /></div>
//                 <div>
//                   <div className="dspx-kpiValue">{detailHeader?.val}</div>
//                   <div className="dspx-kpiLabel">Claimed Value</div>
//                 </div>
//               </div>
//               <div className="dspx-kpiBox">
//                 <div className="dspx-kpiIcon dspx-tone-blue"><Icon name="clock" /></div>
//                 <div>
//                   <div className="dspx-kpiValue">{detailHeader?.processingTime}</div>
//                   <div className="dspx-kpiLabel">Processing Time</div>
//                 </div>
//               </div>
//               <div className="dspx-kpiBox">
//                 <div className="dspx-kpiIcon dspx-tone-green"><Icon name="scale" /></div>
//                 <div>
//                   <div className="dspx-kpiValue">{selected.Type}</div>
//                   <div className="dspx-kpiLabel">Dispute Type</div>
//                 </div>
//               </div>
//               <div className="dspx-kpiBox">
//                 <div className="dspx-kpiIcon dspx-tone-purple"><Icon name="alert" /></div>
//                 <div>
//                   <div className="dspx-kpiValue">{detailHeader?.regionName}</div>
//                   <div className="dspx-kpiLabel">Region</div>
//                 </div>
//               </div>
//             </div>

//             <Tabs tabs={["Details", "Parties", "Timeline", "Validation"]} active={activeTab} onChange={setActiveTab} />
//           </div>

//           <div className="dspx-detailGrid">
//             <div className="dspx-panel">
//               <div className="dspx-panelHead"><div className="dspx-panelTitle">Dispute Information</div></div>
//               <div className="dspx-panelBody">
//                 <InfoRow label="Dispute ID"   value={selected["Dispute ID"]} />
//                 <InfoRow label="Parcel ID"    value={selected["Parcel ID"]} />
//                 <InfoRow label="Type"         value={selected.Type} />
//                 <InfoRow label="Filed Date"   value={selected["Filed Date"]} />
//                 <InfoRow label="Status"       value={selected.Status} />
//                 <InfoRow label="Priority"     value={selected._raw?.priority ?? "—"} />
//               </div>
//             </div>

//             <div className="dspx-panel">
//               <div className="dspx-panelHead"><div className="dspx-panelTitle">Property Details</div></div>
//               <div className="dspx-panelBody">
//                 <InfoRow label="Region"   value={selected.Region} />
//                 <InfoRow label="Parcel ID" value={selected["Parcel ID"]} />
//                 <div className="dspx-hashBox">
//                   <div className="dspx-hashLabel">Transaction Hash</div>
//                   <div className="dspx-hashValue">
//                     {selected._raw?.parcel?.blockchainHash
//                       ?? `0x${selected["Parcel ID"].toLowerCase().replace(/[^a-z0-9]/g, "")}cd34e5f6...`}
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Tab content panel */}
//           <div className="dspx-panel dspx-mt16">
//             <div className="dspx-panelHead"><div className="dspx-panelTitle">{activeTab}</div></div>
//             <div className="dspx-panelBody">
//               {activeTab === "Details" && (
//                 <div className="dspx-grid2">
//                   <InfoRow label="Dispute ID"     value={selected["Dispute ID"]} />
//                   <InfoRow label="Status"         value={selected.Status} />
//                   <InfoRow label="Estimated Value" value={formatEuro(selected["Est. Value"])} />
//                   <InfoRow label="Days Open"      value={selected["Days Open"]} />
//                   <InfoRow label="Region"         value={selected.Region} />
//                   <InfoRow label="Dispute Type"   value={selected.Type} />
//                 </div>
//               )}

//               {activeTab === "Parties" && (
//                 <div className="dspx-stack">
//                   <div className="dspx-grid2">
//                     <InfoRow label="Claimant"      value={ownerName(selected._raw?.claimant)} />
//                     <InfoRow label="Defendant"     value={ownerName(selected._raw?.defendant)} />
//                     <InfoRow label="Assigned Officer" value={
//                       selected._raw?.assignedTo
//                         ? `${selected._raw.assignedTo.firstName ?? ""} ${selected._raw.assignedTo.lastName ?? ""}`.trim()
//                         : "—"
//                     } />
//                     <InfoRow label="Legal Counsel" value="—" />
//                   </div>
//                 </div>
//               )}

//               {activeTab === "Timeline" && (
//                 <div className="dspx-timeline">
//                   <div className="dspx-tItem">
//                     <div className="dspx-tDot" />
//                     <div><div className="dspx-tTitle">Filed</div><div className="dspx-tMeta">{selected["Filed Date"]}</div></div>
//                   </div>
//                   {selected._raw?.investigationStartDate && (
//                     <div className="dspx-tItem">
//                       <div className="dspx-tDot" />
//                       <div>
//                         <div className="dspx-tTitle">Investigation Started</div>
//                         <div className="dspx-tMeta">{new Date(selected._raw.investigationStartDate).toLocaleDateString()}</div>
//                       </div>
//                     </div>
//                   )}
//                   {selected._raw?.courtFilingDate && (
//                     <div className="dspx-tItem">
//                       <div className="dspx-tDot" />
//                       <div>
//                         <div className="dspx-tTitle">Court Filing</div>
//                         <div className="dspx-tMeta">{new Date(selected._raw.courtFilingDate).toLocaleDateString()}</div>
//                       </div>
//                     </div>
//                   )}
//                   <div className="dspx-tItem">
//                     <div className="dspx-tDot" />
//                     <div><div className="dspx-tTitle">Current Status</div><div className="dspx-tMeta">{selected.Status}</div></div>
//                   </div>
//                   {selected._raw?.resolutionDate && (
//                     <div className="dspx-tItem">
//                       <div className="dspx-tDot" />
//                       <div>
//                         <div className="dspx-tTitle">Resolved</div>
//                         <div className="dspx-tMeta">{new Date(selected._raw.resolutionDate).toLocaleDateString()}</div>
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               )}

//               {activeTab === "Validation" && (
//                 <div className="dspx-stack">
//                   <ul className="dspx-checkList">
//                     <li>Parcel identifier verified</li>
//                     <li>Ownership record checked</li>
//                     <li>Encumbrance scan completed</li>
//                     <li>Dispute type classified: {selected.Type}</li>
//                   </ul>
//                 </div>
//               )}
//             </div>
//           </div>

//           <div className="dspx-footer">
//             <div className="dspx-footerInner">
//               <div className="dspx-footerLeft"><span className="dspx-footerDot" /><span>Secure Registry • Disputes</span></div>
//               <div className="dspx-footerRight">© {new Date().getFullYear()} Land Registry</div>
//             </div>
//           </div>
//         </div>

//       ) : (
//         <>
//           {/* Summary cards */}
//           <div className="dspx-grid4">
//             <SummaryCard title="Open Disputes"      value={kpis.open}    sub="↘ 12% vs last month"  icon="alert" badge={{ tone: "gold"   }} />
//             <SummaryCard title="In Court"           value={kpis.inCourt} sub="Active litigation"     icon="scale" badge={{ tone: "red"    }} />
//             <SummaryCard title="Avg. Days Open"     value={`${kpis.avg} days`} sub="↘ 15% improvement" icon="clock" badge={{ tone: "blue"   }} />
//             <SummaryCard title="Total Value at Stake" value={formatEuro(kpis.totalValue)} sub="Across all disputes" icon="euro" badge={{ tone: "purple" }} />
//           </div>

//           {/* Charts row */}
//           <div className="dspx-grid2 dspx-mt16">
//             <div className="dspx-panel">
//               <div className="dspx-panelHead"><div className="dspx-panelTitle">Disputes by Status</div></div>
//               <div className="dspx-panelBody">
//                 <div className="dspx-chartWrap">
//                   <ResponsiveContainer width="100%" height={260}>
//                     <PieChart>
//                       <Pie data={disputesByStatus} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100} paddingAngle={2}>
//                         {disputesByStatus.map(entry => (
//                           <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#94A3B8"} />
//                         ))}
//                       </Pie>
//                       <ReTooltip formatter={(value, name) => [`${value}`, name]} contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }} />
//                     </PieChart>
//                   </ResponsiveContainer>
//                   <div className="dspx-legend">
//                     {disputesByStatus.map(s => (
//                       <div className="dspx-legendItem" key={s.name}>
//                         <span className="dspx-legendDot" style={{ background: STATUS_COLORS[s.name] || "#94A3B8" }} />
//                         <span className="dspx-legendText">{s.name}: <b>{s.value}</b></span>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//             </div>

//             <div className="dspx-panel">
//               <div className="dspx-panelHead"><div className="dspx-panelTitle">Top Regions by Disputes</div></div>
//               <div className="dspx-panelBody">
//                 <div className="dspx-chartWrap">
//                   <ResponsiveContainer width="100%" height={260}>
//                     <BarChart data={topRegions} margin={{ left: 8, right: 12, top: 8, bottom: 8 }}>
//                       <CartesianGrid strokeDasharray="3 3" vertical={false} />
//                       <XAxis dataKey="name" tickLine={false} axisLine={false} />
//                       <YAxis tickLine={false} axisLine={false} />
//                       <ReTooltip
//                         formatter={(value, name, props) => {
//                           if (name === "score") return [`${props?.payload?.count ?? ""} disputes`, "Disputes"];
//                           return [value, name];
//                         }}
//                         contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }}
//                       />
//                       <Bar dataKey="score" radius={[10, 10, 10, 10]} fill="var(--dspx-brand-500)" />
//                     </BarChart>
//                   </ResponsiveContainer>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Filters + table */}
//           <div className="dspx-panel dspx-mt16">
//             <div className="dspx-panelHead">
//               <div className="dspx-panelTitle">Filters</div>
//               <div className="dspx-panelActions">
//                 <button className="dspx-btn dspx-btn--secondary" type="button" onClick={resetFilters}>Reset filters</button>
//                 <button className="dspx-btn dspx-btn--primary"   type="button" onClick={handleExportCurrent}><Icon name="download" /> Export</button>
//               </div>
//             </div>

//             <div className="dspx-filters">
//               <div className="dspx-field dspx-field--search">
//                 <span className="dspx-fieldIcon"><Icon name="search" /></span>
//                 <input className="dspx-input" value={search} onChange={e => setSearch(e.target.value)}
//                   placeholder="Search by ID or name..." aria-label="Search by ID or name" />
//               </div>
//               <div className="dspx-field">
//                 <select className="dspx-select" value={region} onChange={e => setRegion(e.target.value)} aria-label="Region filter">
//                   {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
//                 </select>
//               </div>
//               <div className="dspx-field">
//                 <select className="dspx-select" value={range} onChange={e => setRange(e.target.value)} aria-label="Date range filter">
//                   {RANGES.map(r => <option key={r} value={r}>{r}</option>)}
//                 </select>
//               </div>
//               <div className="dspx-field">
//                 <select className="dspx-select" value={status} onChange={e => setStatus(e.target.value)} aria-label="Status filter">
//                   {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
//                 </select>
//               </div>
//             </div>

//             <div className="dspx-panelBody">
//               <div className="dspx-tableHead">
//                 <div className="dspx-panelTitleSmall">Dispute Records</div>
//               </div>
//               <div className="dspx-tableWrap">
//                 <table className="dspx-table" role="table" aria-label="Dispute Records">
//                   <thead>
//                     <tr>
//                       <th>Dispute ID</th><th>Parcel ID</th><th>Region</th><th>Type</th>
//                       <th>Status</th><th>Filed Date</th><th>Est. Value</th><th>Days Open</th>
//                       <th className="dspx-thRight">Action</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {pageRows.map(r => (
//                       <tr key={r["Dispute ID"]}>
//                         <td className="dspx-mono">{r["Dispute ID"]}</td>
//                         <td className="dspx-mono">{r["Parcel ID"]}</td>
//                         <td>{r.Region}</td>
//                         <td>{r.Type}</td>
//                         <td><Pill status={r.Status} /></td>
//                         <td>{r["Filed Date"]}</td>
//                         <td>{formatEuro(r["Est. Value"])}</td>
//                         <td>{r["Days Open"]}</td>
//                         <td className="dspx-tdRight">
//                           <button className="dspx-btn dspx-btn--link" type="button" onClick={() => openDetails(r)}>
//                             <Icon name="eye" /> View
//                           </button>
//                         </td>
//                       </tr>
//                     ))}
//                     {pageRows.length === 0 && !loading && (
//                       <tr><td colSpan={9} className="dspx-empty">No results found.</td></tr>
//                     )}
//                   </tbody>
//                 </table>
//               </div>

//               <div className="dspx-pager">
//                 <div className="dspx-pagerLeft">
//                   Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} entries
//                 </div>
//                 <div className="dspx-pagerRight">
//                   <button className="dspx-btn dspx-btn--secondary" type="button"
//                     onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
//                   <div className="dspx-pagerText">Page <b>{page}</b> of <b>{totalPages}</b></div>
//                   <button className="dspx-btn dspx-btn--secondary" type="button"
//                     onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
//                 </div>
//               </div>
//             </div>
//           </div>

//           <div className="dspx-footer">
//             <div className="dspx-footerInner">
//               <div className="dspx-footerLeft"><span className="dspx-footerDot" /><span>Secure Registry • Disputes</span></div>
//               <div className="dspx-footerRight">© {new Date().getFullYear()} Land Registry</div>
//             </div>
//           </div>
//         </>
//       )}
//     </div>
//   );
// }

// // Disputes.jsx
// import React, { useEffect, useMemo, useRef, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import {
//   ResponsiveContainer,
//   PieChart,
//   Pie,
//   Cell,
//   Tooltip as ReTooltip,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
// } from "recharts";
// import "./Disputes.css";

// const STATUS_COLORS = {
//   Open: "#F59E0B",
//   Investigation: "#A78BFA",
//   Court: "#FB7185",
//   Resolved: "#34D399",
// };

// const REGIONS = ["All Regions", "Vojvodina", "Belgrade", "Nišava", "Šumadija", "Zlatibor", "Braničevo", "Podunavlje"];
// const STATUSES = ["All Statuses", "Open", "Investigation", "Court", "Resolved"];
// const RANGES = ["Last 7 days", "Last 30 days", "Last 90 days", "This year"];

// function formatEuro(value) {
//   try {
//     // matches your screenshots style (e.g., 2.187.000,00 €)
//     return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
//   } catch {
//     return `${value} €`;
//   }
// }

// function daysBetween(dateStr, now = new Date()) {
//   // dateStr like "15. 1. 2024."
//   const cleaned = dateStr.replace(/\s/g, "").replace(/\.$/, ""); // "15.1.2024"
//   const [d, m, y] = cleaned.split(".").filter(Boolean).map(Number);
//   const dt = new Date(y, (m || 1) - 1, d || 1);
//   const ms = now.getTime() - dt.getTime();
//   return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
// }

// function toCSV(rows, headers) {
//   const escape = (v) => {
//     const s = String(v ?? "");
//     if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
//     return s;
//   };

//   const head = headers.join(",");
//   const body = rows.map((r) => headers.map((h) => escape(r[h])).join(",")).join("\n");
//   return `${head}\n${body}`;
// }

// function downloadFile(filename, content, mime = "text/plain;charset=utf-8") {
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

// function Icon({ name }) {
//   // lightweight inline “icons”
//   if (name === "alert") {
//     return (
//       <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
//         <path
//           fill="currentColor"
//           d="M12 2 1 21h22L12 2Zm0 6c.55 0 1 .45 1 1v5a1 1 0 1 1-2 0V9c0-.55.45-1 1-1Zm0 10a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 12 18Z"
//         />
//       </svg>
//     );
//   }
//   if (name === "scale") {
//     return (
//       <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
//         <path
//           fill="currentColor"
//           d="M12 2 5 5v2h14V5l-7-3Zm7 6H5v2h14V8Zm-2 4h-2v9h-6v-9H7l-3 7h8l-3-7h2v7h2v-7h2l-3 7h8l-3-7Z"
//         />
//       </svg>
//     );
//   }
//   if (name === "clock") {
//     return (
//       <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
//         <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm1 10.4 3.2 1.9-.8 1.4L11 13V7h2v5.4Z" />
//       </svg>
//     );
//   }
//   if (name === "euro") {
//     return (
//       <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
//         <path
//           fill="currentColor"
//           d="M15.5 5.5c1.2 0 2.3.3 3.2 1l-1 1.8c-.7-.5-1.5-.7-2.4-.7-1.9 0-3.5 1.1-4.2 2.9H16v2h-5.3c0 .2 0 .4 0 .5s0 .3 0 .5H16v2h-4.9c.7 1.8 2.3 2.9 4.4 2.9.9 0 1.7-.2 2.4-.7l1 1.8c-1 .7-2.1 1-3.4 1-3.2 0-5.8-1.8-6.7-5H7v-2h1.5c0-.2 0-.4 0-.5s0-.3 0-.5H7v-2h1.8c.9-3.2 3.5-5 6.7-5Z"
//         />
//       </svg>
//     );
//   }
//   if (name === "search") {
//     return (
//       <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
//         <path
//           fill="currentColor"
//           d="M10 2a8 8 0 1 0 4.9 14.3l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12a6 6 0 0 1 0-12Z"
//         />
//       </svg>
//     );
//   }
//   if (name === "download") {
//     return (
//       <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
//         <path fill="currentColor" d="M12 3v10l3-3 1.4 1.4L12 16.8 7.6 11.4 9 10l3 3V3h0ZM5 19h14v2H5v-2Z" />
//       </svg>
//     );
//   }
//   if (name === "printer") {
//     return (
//       <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
//         <path
//           fill="currentColor"
//           d="M7 7V3h10v4H7Zm10 10v-3H7v3H3v-7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7h-4Zm-2 4H9v-5h6v5Z"
//         />
//       </svg>
//     );
//   }
//   if (name === "eye") {
//     return (
//       <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
//         <path
//           fill="currentColor"
//           d="M12 5c5 0 9.3 3.1 11 7-1.7 3.9-6 7-11 7S2.7 15.9 1 12c1.7-3.9 6-7 11-7Zm0 3a4 4 0 1 0 0 8a4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4a2 2 0 0 1 0-4Z"
//         />
//       </svg>
//     );
//   }
//   if (name === "arrowLeft") {
//     return (
//       <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
//         <path fill="currentColor" d="M14.7 6.7 13.3 5.3 6.6 12l6.7 6.7 1.4-1.4L9.4 12l5.3-5.3Z" />
//       </svg>
//     );
//   }
//   if (name === "close") {
//     return (
//       <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
//         <path fill="currentColor" d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z" />
//       </svg>
//     );
//   }
//   if (name === "logo") {
//     return (
//       <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
//         <path
//           fill="currentColor"
//           d="M12 2l8.7 5v10L12 22l-8.7-5V7L12 2Zm0 2.3L5.3 8v8L12 19.7 18.7 16V8L12 4.3Zm0 3.2a4.5 4.5 0 1 1 0 9a4.5 4.5 0 0 1 0-9Zm0 2a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5Z"
//         />
//       </svg>
//     );
//   }
//   return null;
// }

// const MOCK_DISPUTES = [
//   { "Dispute ID": "DSP-2024-001", "Parcel ID": "BEL-45892", Region: "Belgrade", Type: "Ownership", Status: "Open", "Filed Date": "15. 1. 2024.", "Est. Value": 125000, "Days Open": null },
//   { "Dispute ID": "DSP-2024-002", "Parcel ID": "VOJ-12456", Region: "Vojvodina", Type: "Boundary", Status: "Investigation", "Filed Date": "20. 1. 2024.", "Est. Value": 45000, "Days Open": null },
//   { "Dispute ID": "DSP-2024-003", "Parcel ID": "BEL-78234", Region: "Belgrade", Type: "Inheritance", Status: "Court", "Filed Date": "8. 11. 2023.", "Est. Value": 320000, "Days Open": null },
//   { "Dispute ID": "DSP-2024-004", "Parcel ID": "SUM-34521", Region: "Šumadija", Type: "Encumbrance", Status: "Open", "Filed Date": "1. 2. 2024.", "Est. Value": 89000, "Days Open": null },
//   { "Dispute ID": "DSP-2024-005", "Parcel ID": "NIS-67890", Region: "Nišava", Type: "Ownership", Status: "Resolved", "Filed Date": "15. 10. 2023.", "Est. Value": 156000, "Days Open": "Resolved" },
//   { "Dispute ID": "DSP-2024-006", "Parcel ID": "ZLA-23456", Region: "Zlatibor", Type: "Boundary", Status: "Investigation", "Filed Date": "28. 1. 2024.", "Est. Value": 67000, "Days Open": null },
//   { "Dispute ID": "DSP-2024-007", "Parcel ID": "VOJ-89012", Region: "Vojvodina", Type: "Inheritance", Status: "Open", "Filed Date": "5. 2. 2024.", "Est. Value": 210000, "Days Open": null },
//   { "Dispute ID": "DSP-2024-008", "Parcel ID": "BEL-34567", Region: "Belgrade", Type: "Ownership", Status: "Court", "Filed Date": "20. 9. 2023.", "Est. Value": 890000, "Days Open": null },
//   { "Dispute ID": "DSP-2024-009", "Parcel ID": "POD-11223", Region: "Podunavlje", Type: "Encumbrance", Status: "Resolved", "Filed Date": "10. 12. 2023.", "Est. Value": 34000, "Days Open": "Resolved" },
//   { "Dispute ID": "DSP-2024-010", "Parcel ID": "BRA-45556", Region: "Braničevo", Type: "Boundary", Status: "Open", "Filed Date": "10. 2. 2024.", "Est. Value": 28000, "Days Open": null },
//   { "Dispute ID": "DSP-2024-011", "Parcel ID": "VOJ-22001", Region: "Vojvodina", Type: "Ownership", Status: "Investigation", "Filed Date": "25. 1. 2024.", "Est. Value": 52000, "Days Open": null },
//   { "Dispute ID": "DSP-2024-012", "Parcel ID": "BEL-90010", Region: "Belgrade", Type: "Inheritance", Status: "Open", "Filed Date": "12. 1. 2024.", "Est. Value": 41000, "Days Open": null },
// ];

// function normalizeDisputes(data) {
//   const now = new Date();
//   return data.map((d) => {
//     let daysOpen;
//     if (d["Days Open"] === "Resolved") daysOpen = "Resolved";
//     else daysOpen = `${daysBetween(d["Filed Date"], now)} days`;
//     return { ...d, "Days Open": daysOpen };
//   });
// }

// function SummaryCard({ title, value, sub, icon, badge }) {
//   return (
//     <div className="dspx-card">
//       <div className="dspx-card__head">
//         <div>
//           <div className="dspx-card__title">{title}</div>
//           <div className="dspx-card__value">{value}</div>
//           {sub ? <div className={`dspx-card__sub ${badge?.tone ? `dspx-tone-${badge.tone}` : ""}`}>{sub}</div> : null}
//         </div>
//         <div className={`dspx-card__icon ${badge?.tone ? `dspx-tone-${badge.tone}` : ""}`} title={title} aria-hidden="true">
//           <Icon name={icon} />
//         </div>
//       </div>
//     </div>
//   );
// }

// function Pill({ status }) {
//   const color = STATUS_COLORS[status] || "#CBD5E1";
//   return (
//     <span className="dspx-pill" style={{ borderColor: color, color: color, background: `${color}22` }}>
//       {status}
//     </span>
//   );
// }

// function Tabs({ tabs, active, onChange }) {
//   return (
//     <div className="dspx-tabs" role="tablist" aria-label="Details Tabs">
//       {tabs.map((t) => (
//         <button
//           key={t}
//           className={`dspx-tab ${active === t ? "dspx-isActive" : ""}`}
//           onClick={() => onChange(t)}
//           role="tab"
//           aria-selected={active === t}
//           type="button"
//         >
//           {t}
//         </button>
//       ))}
//     </div>
//   );
// }

// function InfoRow({ label, value }) {
//   return (
//     <div className="dspx-infoRow">
//       <div className="dspx-infoRow__label">{label}</div>
//       <div className="dspx-infoRow__value">{value}</div>
//     </div>
//   );
// }

// export default function Disputes() {
//   const navigate = useNavigate();
//   const printRef = useRef(null);

//   const [allDisputes] = useState(() => normalizeDisputes(MOCK_DISPUTES));

//   // filters (top row like overview)
//   const [search, setSearch] = useState("");
//   const [region, setRegion] = useState("All Regions");
//   const [range, setRange] = useState("Last 30 days");
//   const [status, setStatus] = useState("All Statuses");

//   // table
//   const [page, setPage] = useState(1);
//   const pageSize = 10;

//   // “View” details
//   const [selected, setSelected] = useState(null);
//   const [activeTab, setActiveTab] = useState("Details");

//   // derived filtered disputes
//   const filtered = useMemo(() => {
//     const q = search.trim().toLowerCase();

//     // NOTE: range filter is mocked (since we don't have real timestamps); keep UI consistent.
//     // If you have real dates, filter by actual date window here.
//     return allDisputes.filter((d) => {
//       const matchesQ =
//         !q ||
//         d["Dispute ID"].toLowerCase().includes(q) ||
//         d["Parcel ID"].toLowerCase().includes(q) ||
//         d.Region.toLowerCase().includes(q) ||
//         d.Type.toLowerCase().includes(q);

//       const matchesRegion = region === "All Regions" || d.Region === region;
//       const matchesStatus = status === "All Statuses" || d.Status === status;

//       return matchesQ && matchesRegion && matchesStatus;
//     });
//   }, [allDisputes, region, search, status]);

//   const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

//   useEffect(() => {
//     setPage(1);
//   }, [search, region, status, range]);

//   const pageRows = useMemo(() => {
//     const start = (page - 1) * pageSize;
//     return filtered.slice(start, start + pageSize);
//   }, [filtered, page]);

//   // KPIs (from filtered set to “feel real”)
//   const kpis = useMemo(() => {
//     const open = filtered.filter((d) => d.Status === "Open").length;
//     const inCourt = filtered.filter((d) => d.Status === "Court").length;

//     // avg days open among non-resolved
//     const dayNums = filtered
//       .filter((d) => d["Days Open"] !== "Resolved")
//       .map((d) => parseInt(String(d["Days Open"]).replace(/\D/g, ""), 10))
//       .filter((n) => Number.isFinite(n));
//     const avg = dayNums.length ? Math.round(dayNums.reduce((a, b) => a + b, 0) / dayNums.length) : 0;

//     const totalValue = filtered.reduce((sum, d) => sum + (Number(d["Est. Value"]) || 0), 0);

//     return { open, inCourt, avg, totalValue };
//   }, [filtered]);

//   // chart data
//   const disputesByStatus = useMemo(() => {
//     const counts = { Open: 0, Investigation: 0, Court: 0, Resolved: 0 };
//     for (const d of filtered) counts[d.Status] = (counts[d.Status] || 0) + 1;
//     return Object.entries(counts).map(([name, value]) => ({ name, value }));
//   }, [filtered]);

//   const topRegions = useMemo(() => {
//     const map = new Map();
//     for (const d of filtered) map.set(d.Region, (map.get(d.Region) || 0) + 1);

//     // scale to look like the screenshot bars (counts → “score”)
//     const arr = Array.from(map.entries()).map(([name, count]) => ({ name, count, score: count * 120 + 30 }));
//     arr.sort((a, b) => b.score - a.score);
//     return arr.slice(0, 6);
//   }, [filtered]);

//   function resetFilters() {
//     setSearch("");
//     setRegion("All Regions");
//     setRange("Last 30 days");
//     setStatus("All Statuses");
//   }

//   function handleExportCurrent() {
//     const rows = filtered.map((d) => ({
//       DisputeID: d["Dispute ID"],
//       ParcelID: d["Parcel ID"],
//       Region: d.Region,
//       Type: d.Type,
//       Status: d.Status,
//       FiledDate: d["Filed Date"],
//       EstValueEUR: d["Est. Value"],
//       DaysOpen: d["Days Open"],
//     }));

//     const csv = toCSV(rows, Object.keys(rows[0] || { DisputeID: "" }));
//     downloadFile(`disputes_export_${Date.now()}.csv`, csv, "text/csv;charset=utf-8");
//   }

//   function handleExportSelected() {
//     if (!selected) return;
//     const payload = {
//       dispute: selected,
//       exportedAt: new Date().toISOString(),
//     };
//     downloadFile(`dispute_${selected["Dispute ID"]}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
//   }

//   function handlePrintSelected() {
//     if (!selected) return;

//     // Print only the detail panel section (clean)
//     // We temporarily add a class that print CSS uses to hide the rest.
//     document.body.classList.add("dspx-print-detail-only");
//     // ensure next paint includes class before print
//     requestAnimationFrame(() => {
//       window.print();
//       document.body.classList.remove("dspx-print-detail-only");
//     });
//   }

//   function openDetails(row) {
//     setSelected(row);
//     setActiveTab("Details");
//     // Optional: scroll to top for “page” feel
//     window.scrollTo({ top: 0, behavior: "smooth" });
//   }

//   function closeDetails() {
//     setSelected(null);
//     setActiveTab("Details");
//   }

//   // Simple “detail” mock like your 4th screen (transfer-like)
//   const detailHeader = useMemo(() => {
//     if (!selected) return null;
//     const val = formatEuro(selected["Est. Value"]);
//     const processingTime = selected["Days Open"] === "Resolved" ? "Completed" : selected["Days Open"];
//     const regionName = selected.Region;
//     return { val, processingTime, regionName };
//   }, [selected]);

//   return (
//     <div id="dspx-page" className="dspx-page">
//       {/* Top row: breadcrumb + back */}
//       <div className="dspx-topbar">
//         <div className="dspx-topbarLeft">
//           <div
//             className="dspx-brand"
//             role="button"
//             tabIndex={0}
//             onClick={() => navigate("/dashboard")}
//             onKeyDown={(e) => e.key === "Enter" && navigate("/dashboard")}
//           >
//             <span className="dspx-brandMark" aria-hidden="true">
//               <Icon name="logo" />
//             </span>
//             <div className="dspx-brandText">
//               <div className="dspx-brandName">Land Registry</div>
//               <div className="dspx-brandSub">Disputes Module</div>
//             </div>
//           </div>

//           <div className="dspx-crumbs">
//             <span className="dspx-crumb">Dashboard</span>
//             <span className="dspx-crumbSep">›</span>
//             <span className="dspx-crumb dspx-isActive">Disputes</span>
//           </div>
//         </div>

//         <button className="dspx-btn dspx-btn--ghost" type="button" onClick={() => navigate("/dashboard")}>
//           <Icon name="arrowLeft" /> Back to Dashboard
//         </button>
//       </div>

//       {/* Title */}
//       <div className="dspx-pagehead">
//         <div>
//           <h1 className="dspx-h1">Disputes Dashboard</h1>
//           <div className="dspx-muted">Monitor and manage land ownership disputes</div>
//         </div>
//       </div>

//       {/* If a dispute is selected, show the “details screen” like your 4th image */}
//       {selected ? (
//         <div className="dspx-detailWrap" ref={printRef}>
//           <div className="dspx-detailTop">
//             <div className="dspx-detailTitleRow">
//               <button className="dspx-btn dspx-btn--ghost" type="button" onClick={closeDetails}>
//                 <Icon name="arrowLeft" /> Back
//               </button>

//               <div className="dspx-detailTitle">
//                 <div className="dspx-detailId">{selected["Dispute ID"]}</div>
//                 <span className="dspx-badge dspx-badge--green">Completed</span>
//                 <div className="dspx-detailSub">Sale Transfer</div>
//               </div>

//               <div className="dspx-detailActions">
//                 <button className="dspx-btn dspx-btn--secondary" type="button" onClick={handlePrintSelected}>
//                   <Icon name="printer" /> Print
//                 </button>
//                 <button className="dspx-btn dspx-btn--primary" type="button" onClick={handleExportSelected}>
//                   <Icon name="download" /> Export
//                 </button>
//                 <button className="dspx-btn dspx-btn--icon" type="button" onClick={closeDetails} aria-label="Close details">
//                   <Icon name="close" />
//                 </button>
//               </div>
//             </div>

//             <div className="dspx-kpiRow">
//               <div className="dspx-kpiBox">
//                 <div className="dspx-kpiIcon dspx-tone-gold">
//                   <Icon name="euro" />
//                 </div>
//                 <div>
//                   <div className="dspx-kpiValue">{detailHeader?.val}</div>
//                   <div className="dspx-kpiLabel">Transaction Value</div>
//                 </div>
//               </div>

//               <div className="dspx-kpiBox">
//                 <div className="dspx-kpiIcon dspx-tone-blue">
//                   <Icon name="clock" />
//                 </div>
//                 <div>
//                   <div className="dspx-kpiValue">{detailHeader?.processingTime}</div>
//                   <div className="dspx-kpiLabel">Processing Time</div>
//                 </div>
//               </div>

//               <div className="dspx-kpiBox">
//                 <div className="dspx-kpiIcon dspx-tone-green">
//                   <Icon name="scale" />
//                 </div>
//                 <div>
//                   <div className="dspx-kpiValue">Sale</div>
//                   <div className="dspx-kpiLabel">Transfer Type</div>
//                 </div>
//               </div>

//               <div className="dspx-kpiBox">
//                 <div className="dspx-kpiIcon dspx-tone-purple">
//                   <Icon name="alert" />
//                 </div>
//                 <div>
//                   <div className="dspx-kpiValue">{detailHeader?.regionName}</div>
//                   <div className="dspx-kpiLabel">Region</div>
//                 </div>
//               </div>
//             </div>

//             <Tabs tabs={["Details", "Parties", "Timeline", "Validation"]} active={activeTab} onChange={setActiveTab} />
//           </div>

//           <div className="dspx-detailGrid">
//             <div className="dspx-panel">
//               <div className="dspx-panelHead">
//                 <div className="dspx-panelTitle">Transfer Information</div>
//               </div>

//               <div className="dspx-panelBody">
//                 <InfoRow label="Transfer ID" value={selected["Dispute ID"].replace("DSP", "TRF")} />
//                 <InfoRow label="Parcel ID" value={selected["Parcel ID"]} />
//                 <InfoRow label="Type" value="Sale" />
//                 <InfoRow label="Submitted Date" value={selected["Filed Date"]} />
//                 <InfoRow label="Completed Date" value={selected.Status === "Resolved" ? selected["Filed Date"] : "13. 1. 2024."} />
//               </div>
//             </div>

//             <div className="dspx-panel">
//               <div className="dspx-panelHead">
//                 <div className="dspx-panelTitle">Property Details</div>
//               </div>

//               <div className="dspx-panelBody">
//                 <InfoRow label="Region" value={selected.Region} />
//                 <InfoRow label="Parcel ID" value={selected["Parcel ID"]} />
//                 <div className="dspx-hashBox">
//                   <div className="dspx-hashLabel">Transaction Hash</div>
//                   <div className="dspx-hashValue">
//                     {`0x${selected["Parcel ID"].toLowerCase().replace(/[^a-z0-9]/g, "")}cd34e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6`}
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Tab content (simple placeholders, but structured) */}
//           <div className="dspx-panel dspx-mt16">
//             <div className="dspx-panelHead">
//               <div className="dspx-panelTitle">{activeTab}</div>
//             </div>
//             <div className="dspx-panelBody">
//               {activeTab === "Details" && (
//                 <div className="dspx-grid2">
//                   <InfoRow label="Dispute ID" value={selected["Dispute ID"]} />
//                   <InfoRow label="Status" value={selected.Status} />
//                   <InfoRow label="Estimated Value" value={formatEuro(selected["Est. Value"])} />
//                   <InfoRow label="Days Open" value={selected["Days Open"]} />
//                   <InfoRow label="Region" value={selected.Region} />
//                   <InfoRow label="Dispute Type" value={selected.Type} />
//                 </div>
//               )}

//               {activeTab === "Parties" && (
//                 <div className="dspx-stack">
//                   <div className="dspx-noteBox">Mock parties data. Replace with real parties (Owner, Claimant, Representative, etc.).</div>
//                   <div className="dspx-grid2">
//                     <InfoRow label="Party A" value="Primary Owner" />
//                     <InfoRow label="Party B" value="Opposing Claimant" />
//                     <InfoRow label="Assigned Officer" value="—" />
//                     <InfoRow label="Legal Counsel" value="—" />
//                   </div>
//                 </div>
//               )}

//               {activeTab === "Timeline" && (
//                 <div className="dspx-timeline">
//                   <div className="dspx-tItem">
//                     <div className="dspx-tDot" />
//                     <div>
//                       <div className="dspx-tTitle">Filed</div>
//                       <div className="dspx-tMeta">{selected["Filed Date"]}</div>
//                     </div>
//                   </div>
//                   <div className="dspx-tItem">
//                     <div className="dspx-tDot" />
//                     <div>
//                       <div className="dspx-tTitle">Assigned for review</div>
//                       <div className="dspx-tMeta">+2 days</div>
//                     </div>
//                   </div>
//                   <div className="dspx-tItem">
//                     <div className="dspx-tDot" />
//                     <div>
//                       <div className="dspx-tTitle">Current status</div>
//                       <div className="dspx-tMeta">{selected.Status}</div>
//                     </div>
//                   </div>
//                 </div>
//               )}

//               {activeTab === "Validation" && (
//                 <div className="dspx-stack">
//                   <div className="dspx-noteBox">
//                     Mock validation checks. Replace with real validations (documents verified, boundary check, ownership chain, court filings).
//                   </div>
//                   <ul className="dspx-checkList">
//                     <li>Parcel identifier verified</li>
//                     <li>Ownership record checked</li>
//                     <li>Encumbrance scan completed</li>
//                     <li>Export/print audit log saved</li>
//                   </ul>
//                 </div>
//               )}
//             </div>
//           </div>

//           <div className="dspx-footer">
//             <div className="dspx-footerInner">
//               <div className="dspx-footerLeft">
//                 <span className="dspx-footerDot" />
//                 <span>Secure Registry • Disputes</span>
//               </div>
//               <div className="dspx-footerRight">© {new Date().getFullYear()} Land Registry</div>
//             </div>
//           </div>
//         </div>
//       ) : (
//         <>
//           {/* Summary cards row */}
//           <div className="dspx-grid4">
//             <SummaryCard title="Open Disputes" value={kpis.open} sub="↘ 12% vs last month" icon="alert" badge={{ tone: "gold" }} />
//             <SummaryCard title="In Court" value={kpis.inCourt} sub="Active litigation" icon="scale" badge={{ tone: "red" }} />
//             <SummaryCard title="Avg. Days Open" value={`${kpis.avg} days`} sub="↘ 15% improvement" icon="clock" badge={{ tone: "blue" }} />
//             <SummaryCard title="Total Value at Stake" value={formatEuro(kpis.totalValue)} sub="Across all disputes" icon="euro" badge={{ tone: "purple" }} />
//           </div>

//           {/* Charts row */}
//           <div className="dspx-grid2 dspx-mt16">
//             <div className="dspx-panel">
//               <div className="dspx-panelHead">
//                 <div className="dspx-panelTitle">Disputes by Status</div>
//               </div>
//               <div className="dspx-panelBody">
//                 <div className="dspx-chartWrap">
//                   <ResponsiveContainer width="100%" height={260}>
//                     <PieChart>
//                       <Pie data={disputesByStatus} dataKey="value" nameKey="name" innerRadius={70} outerRadius={100} paddingAngle={2}>
//                         {disputesByStatus.map((entry) => (
//                           <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#94A3B8"} />
//                         ))}
//                       </Pie>

//                       {/* Hover tooltip shows related data */}
//                       <ReTooltip formatter={(value, name) => [`${value}`, name]} contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }} />
//                     </PieChart>
//                   </ResponsiveContainer>

//                   <div className="dspx-legend">
//                     {disputesByStatus.map((s) => (
//                       <div className="dspx-legendItem" key={s.name}>
//                         <span className="dspx-legendDot" style={{ background: STATUS_COLORS[s.name] || "#94A3B8" }} />
//                         <span className="dspx-legendText">
//                           {s.name}: <b>{s.value}</b>
//                         </span>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//             </div>

//             <div className="dspx-panel">
//               <div className="dspx-panelHead">
//                 <div className="dspx-panelTitle">Top Regions by Disputes</div>
//               </div>
//               <div className="dspx-panelBody">
//                 <div className="dspx-chartWrap">
//                   <ResponsiveContainer width="100%" height={260}>
//                     <BarChart data={topRegions} margin={{ left: 8, right: 12, top: 8, bottom: 8 }}>
//                       <CartesianGrid strokeDasharray="3 3" vertical={false} />
//                       <XAxis dataKey="name" tickLine={false} axisLine={false} />
//                       <YAxis tickLine={false} axisLine={false} />
//                       <ReTooltip
//                         formatter={(value, name, props) => {
//                           if (name === "score") return [`${props?.payload?.count ?? ""} disputes`, "Disputes"];
//                           return [value, name];
//                         }}
//                         contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB" }}
//                       />
//                       <Bar dataKey="score" radius={[10, 10, 10, 10]} fill="var(--dspx-brand-500)" />
//                     </BarChart>
//                   </ResponsiveContainer>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Filters + table */}
//           <div className="dspx-panel dspx-mt16">
//             <div className="dspx-panelHead">
//               <div className="dspx-panelTitle">Filters</div>
//               <div className="dspx-panelActions">
//                 <button className="dspx-btn dspx-btn--secondary" type="button" onClick={resetFilters}>
//                   Reset filters
//                 </button>
//                 <button className="dspx-btn dspx-btn--primary" type="button" onClick={handleExportCurrent}>
//                   <Icon name="download" /> Export
//                 </button>
//               </div>
//             </div>

//             <div className="dspx-filters">
//               <div className="dspx-field dspx-field--search">
//                 <span className="dspx-fieldIcon">
//                   <Icon name="search" />
//                 </span>
//                 <input
//                   className="dspx-input"
//                   value={search}
//                   onChange={(e) => setSearch(e.target.value)}
//                   placeholder="Search by ID or name..."
//                   aria-label="Search by ID or name"
//                 />
//               </div>

//               <div className="dspx-field">
//                 <select className="dspx-select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region filter">
//                   {REGIONS.map((r) => (
//                     <option key={r} value={r}>
//                       {r}
//                     </option>
//                   ))}
//                 </select>
//               </div>

//               <div className="dspx-field">
//                 <select className="dspx-select" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range filter">
//                   {RANGES.map((r) => (
//                     <option key={r} value={r}>
//                       {r}
//                     </option>
//                   ))}
//                 </select>
//               </div>

//               <div className="dspx-field">
//                 <select className="dspx-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
//                   {STATUSES.map((s) => (
//                     <option key={s} value={s}>
//                       {s}
//                     </option>
//                   ))}
//                 </select>
//               </div>
//             </div>

//             <div className="dspx-panelBody">
//               <div className="dspx-tableHead">
//                 <div className="dspx-panelTitleSmall">Dispute Records</div>
//               </div>

//               <div className="dspx-tableWrap">
//                 <table className="dspx-table" role="table" aria-label="Dispute Records">
//                   <thead>
//                     <tr>
//                       <th>Dispute ID</th>
//                       <th>Parcel ID</th>
//                       <th>Region</th>
//                       <th>Type</th>
//                       <th>Status</th>
//                       <th>Filed Date</th>
//                       <th>Est. Value</th>
//                       <th>Days Open</th>
//                       <th className="dspx-thRight">Action</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {pageRows.map((r) => (
//                       <tr key={r["Dispute ID"]}>
//                         <td className="dspx-mono">{r["Dispute ID"]}</td>
//                         <td className="dspx-mono">{r["Parcel ID"]}</td>
//                         <td>{r.Region}</td>
//                         <td>{r.Type}</td>
//                         <td>
//                           <Pill status={r.Status} />
//                         </td>
//                         <td>{r["Filed Date"]}</td>
//                         <td>{formatEuro(r["Est. Value"])}</td>
//                         <td>{r["Days Open"]}</td>
//                         <td className="dspx-tdRight">
//                           <button className="dspx-btn dspx-btn--link" type="button" onClick={() => openDetails(r)}>
//                             <Icon name="eye" /> View
//                           </button>
//                         </td>
//                       </tr>
//                     ))}

//                     {pageRows.length === 0 && (
//                       <tr>
//                         <td colSpan={9} className="dspx-empty">
//                           No results found.
//                         </td>
//                       </tr>
//                     )}
//                   </tbody>
//                 </table>
//               </div>

//               <div className="dspx-pager">
//                 <div className="dspx-pagerLeft">
//                   Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)} of {filtered.length} entries
//                 </div>

//                 <div className="dspx-pagerRight">
//                   <button className="dspx-btn dspx-btn--secondary" type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
//                     ‹
//                   </button>
//                   <div className="dspx-pagerText">
//                     Page <b>{page}</b> of <b>{totalPages}</b>
//                   </div>
//                   <button
//                     className="dspx-btn dspx-btn--secondary"
//                     type="button"
//                     onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
//                     disabled={page === totalPages}
//                   >
//                     ›
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>

//           <div className="dspx-footer">
//             <div className="dspx-footerInner">
//               <div className="dspx-footerLeft">
//                 <span className="dspx-footerDot" />
//                 <span>Secure Registry • Disputes</span>
//               </div>
//               <div className="dspx-footerRight">© {new Date().getFullYear()} Land Registry</div>
//             </div>
//           </div>
//         </>
//       )}
//     </div>
//   );
// }
