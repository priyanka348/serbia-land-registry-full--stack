// LegalCleanliness.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import { fetchDashboardStats, getParcels } from "../utils/api";
import "./LegalCleanliness.css";

/* -----------------------------
   Small UI helpers / icons
------------------------------ */
const Icon = {
  Scale: (props) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M12 3v18M7 6h10M6 6l-3 6a4 4 0 0 0 8 0L8 6Zm10 0 3 6a4 4 0 0 1-8 0l3-6Zm-8 14h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  CheckCircle: (props) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M9 12.5l2 2.2 4.7-5.2M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Clock: (props) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Zm0-14v5l3 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  AlertTriangle: (props) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M12 3 1.8 20.2h20.4L12 3Zm0 6v5m0 4h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Info: (props) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Zm0-11v6m0-9h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Hash: (props) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M9 3 7 21M17 3l-2 18M5 8h16M4 16h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Shield: (props) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M12 2l8 4v6c0 5-3.4 9.3-8 10-4.6-.7-8-5-8-10V6l8-4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Dot: (props) => (
    <svg viewBox="0 0 10 10" aria-hidden="true" {...props}>
      <circle cx="5" cy="5" r="4" fill="currentColor" />
    </svg>
  ),
  Plus: (props) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),
  Search: (props) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm6.1-1.4L21 21"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),
  Filter: (props) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M4 6h16M7 12h10M10 18h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),
};

function formatNumber(n) {
  const s = String(n);
  const parts = [];
  let i = s.length;
  while (i > 3) {
    parts.unshift(s.slice(i - 3, i));
    i -= 3;
  }
  parts.unshift(s.slice(0, i));
  return parts.join(",");
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/* -----------------------------
   Tooltip hook
------------------------------ */
function useHoverTooltip() {
  const [tip, setTip] = useState({ show: false, x: 0, y: 0, title: "", value: "" });
  const containerRef = useRef(null);

  function show(e, title, value) {
    const rect = containerRef.current?.getBoundingClientRect();
    const clientX = e?.clientX ?? rect?.left ?? 0;
    const clientY = e?.clientY ?? rect?.top ?? 0;

    const x = rect ? clientX - rect.left : 0;
    const y = rect ? clientY - rect.top : 0;

    setTip({
      show: true,
      x: clamp(x, 12, (rect?.width ?? 0) - 12),
      y: clamp(y, 12, (rect?.height ?? 0) - 12),
      title,
      value,
    });
  }

  function move(e) {
    if (!tip.show) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setTip((t) => ({
      ...t,
      x: clamp(x, 12, rect.width - 12),
      y: clamp(y, 12, rect.height - 12),
    }));
  }

  function hide() {
    setTip((t) => ({ ...t, show: false }));
  }

  const TooltipEl = (
    <div
      className={`lcTip ${tip.show ? "lcTip_show" : ""}`}
      style={{ left: tip.x, top: tip.y }}
      role="status"
      aria-live="polite"
    >
      <div className="lcTipTitle">{tip.title}</div>
      <div className="lcTipValue">{tip.value}</div>
    </div>
  );

  return { containerRef, tip, TooltipEl, show, move, hide };
}

/* -----------------------------
   Donut chart (SVG)
------------------------------ */
function DonutChart({ data, centerLabel = "Legal Status", onHover }) {
  const size = 220;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const total = data.reduce((sum, d) => sum + d.value, 0);

  const segments = [];
  let offset = 0;

  data.forEach((d) => {
    const frac = total ? d.value / total : 0;
    const dash = frac * c;

    segments.push({
      ...d,
      dash,
      offset,
    });

    offset += dash;
  });

  const rotate = -90 + 18;

  return (
    <div className="lcDonut">
      <div className="lcDonutSvgWrap">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="lcDonutSvg"
          role="img"
          aria-label="Legal status overview donut chart"
        >
          <g transform={`rotate(${rotate} ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="var(--lc-border)"
              strokeWidth={stroke}
              fill="none"
            />
            {segments.map((s, idx) => (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={s.color}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${s.dash} ${c - s.dash}`}
                strokeDashoffset={-s.offset}
                strokeLinecap="butt"
                className="lcDonutSeg"
                tabIndex={0}
                onMouseEnter={(e) => onHover?.(e, s.label, `${s.value.toFixed(1)}%`)}
                onMouseMove={(e) => onHover?.(e, s.label, `${s.value.toFixed(1)}%`)}
                onMouseLeave={() => onHover?.(null, "", "")}
                onFocus={(e) => onHover?.(e, s.label, `${s.value.toFixed(1)}%`)}
                onBlur={() => onHover?.(null, "", "")}
              />
            ))}
          </g>

          <g className="lcDonutCenter">
            <text x="50%" y="47%" textAnchor="middle" className="lcDonutCenterTitle">
              {centerLabel}
            </text>
            <text x="50%" y="58%" textAnchor="middle" className="lcDonutCenterSub">
              Overview
            </text>
          </g>
        </svg>
      </div>

      <div className="lcLegend">
        {data.map((d, i) => (
          <div key={i} className="lcLegendItem">
            <span className="lcLegendDot" style={{ background: d.color }} />
            <span className="lcLegendText">
              {d.label}: <b>{d.value.toFixed(1)}%</b>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -----------------------------
   Horizontal bar chart (SVG)
------------------------------ */
function HorizontalBarChart({ items, maxX = 600, onHover }) {
  const height = 280;
  const leftPad = 180;
  const rightPad = 30;
  const topPad = 18;
  const rowH = 40;

  const width = 740;
  const chartW = width - leftPad - rightPad;

  const ticks = [0, 150, 300, 450, 600].filter((t) => t <= maxX);
  const scale = (v) => (maxX ? (v / maxX) * chartW : 0);

  return (
    <div className="lcBarChartWrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="lcBarSvg"
        role="img"
        aria-label="Risk flags distribution bar chart"
      >
        {ticks.map((t, idx) => {
          const x = leftPad + scale(t);
          return (
            <g key={idx}>
              <line x1={x} y1={topPad} x2={x} y2={height - 46} className="lcBarGrid" />
              <text x={x} y={height - 20} textAnchor="middle" className="lcBarTick">
                {t}
              </text>
            </g>
          );
        })}

        {items.map((it, i) => {
          const y = topPad + i * rowH + 10;
          const barH = 18;
          const w = scale(it.value);

          return (
            <g key={i} className="lcBarRow">
              <text x={leftPad - 10} y={y + 13} textAnchor="end" className="lcBarLabel">
                {it.label}
              </text>

              <rect
                x={leftPad}
                y={y}
                width={Math.max(2, w)}
                height={barH}
                rx="4"
                className="lcBar"
                style={{ fill: it.color }}
                tabIndex={0}
                onMouseEnter={(e) => onHover?.(e, it.label, `${it.value}`)}
                onMouseMove={(e) => onHover?.(e, it.label, `${it.value}`)}
                onMouseLeave={() => onHover?.(null, "", "")}
                onFocus={(e) => onHover?.(e, it.label, `${it.value}`)}
                onBlur={() => onHover?.(null, "", "")}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* -----------------------------
   Main Page
------------------------------ */
export default function LegalCleanliness() {
  const [apiStats, setApiStats] = useState(null);
  const [parcelRows, setParcelRows] = useState([]);

  useEffect(() => {
    fetchDashboardStats()
      .then((res) => setApiStats(res?.data ?? null))
      .catch((err) => console.error("LegalCleanliness stats error:", err));

    getParcels({ limit: 1000 })
      .then((res) => {
        const data = res?.data ?? [];
        setParcelRows(data.map((p) => {
          const legalKey = p.legalStatus ?? "pending";
          // map backend legalStatus to display status key
          const statusKey = legalKey === "clean" ? "verified" : legalKey;
          const restrictions = p.restrictions ?? [];
          const flags = restrictions.map((r) => {
            const t = r.type ?? "";
            if (t === "mortgage")     return "Active mortgage";
            if (t === "lien")         return "Lien registered";
            if (t === "easement")     return "Easement recorded";
            if (t === "zoning")       return "Zoning violation";
            if (t === "environmental") return "Environmental clearance missing";
            if (t === "legal")        return "Legal restriction";
            return r.description || t;
          });
          const hasActiveMortgage = p.hasMortgage;
          const mortgageKey = hasActiveMortgage ? "active" : "clear";
          return {
            parcel: p.parcelId ?? p._id,
            address: {
              line1: p.address?.street ?? p.address?.line1 ?? "—",
              line2: p.address?.city ?? p.region ?? "—",
            },
            status:   { key: statusKey,   text: statusKey },
            zoning:   restrictions.some((r) => r.type === "zoning") ? "bad" : "ok",
            environmental: restrictions.some((r) => r.type === "environmental") ? "warn" : "ok",
            occupancy: "ok",
            mortgage: { key: mortgageKey, text: mortgageKey },
            hash:     p.blockchainHash ?? "—",
            flags,
          };
        }));
      })
      .catch((err) => console.error("LegalCleanliness parcels error:", err));
  }, []);

  // Derive metrics from API when available, else use fallback values
  const verifiedPct = apiStats?.parcels?.verificationRate ?? 78.4;
  const pendingPct = apiStats?.parcels?.pendingRate ?? 14.2;
  const disputedPct = apiStats?.disputes?.activeRate ?? 5.8;
  const litigationPct = Math.max(0, 100 - verifiedPct - pendingPct - disputedPct).toFixed(1) * 1 || 1.6;
  const disputeCount = apiStats?.disputes?.total ?? 1217;
  const avgRegDays = apiStats?.parcels?.avgRegistrationDays ?? 4.2;

  const statusBreakdown = useMemo(
    () => [
      { key: "verified", label: "Verified", value: verifiedPct, color: "var(--lc-green)" },
      { key: "pending", label: "Pending", value: pendingPct, color: "var(--lc-orange)" },
      { key: "disputed", label: "Disputed", value: disputedPct, color: "var(--lc-red)" },
      { key: "litigation", label: "Litigation", value: litigationPct, color: "var(--lc-purple)" },
    ],
    [verifiedPct, pendingPct, disputedPct, litigationPct]
  );

  const riskFlags = useMemo(
    () => [
      { label: "Title Conflicts", value: 240, color: "var(--lc-redbar)" },
      { label: "Duplicate\nRegistrations", value: 90, color: "var(--lc-redbar)" },
      { label: "Zoning Violations", value: 160, color: "var(--lc-amberbar)" },
      { label: "Unregistered\nExtensions", value: 420, color: "var(--lc-steelbar)" },
      { label: "Missing Clearances", value: 320, color: "var(--lc-amberbar)" },
      { label: "Post-sale\nModifications", value: 150, color: "var(--lc-amberbar)" },
    ],
    []
  );

  const donutTip = useHoverTooltip();
  const barTip = useHoverTooltip();

  const kpis = useMemo(
    () => [
      {
        tone: "good",
        icon: <Icon.CheckCircle className="lcKpiIcon" />,
        label: "Fully Verified",
        value: `${verifiedPct.toFixed(1)}%`,
        sub: "Properties legally clean",
      },
      {
        tone: "warn",
        icon: <Icon.Clock className="lcKpiIcon" />,
        label: "Pending Checks",
        value: `${pendingPct.toFixed(1)}%`,
        sub: "Awaiting verification",
      },
      {
        tone: "bad",
        icon: <Icon.AlertTriangle className="lcKpiIcon" />,
        label: "Disputed",
        value: `${disputedPct.toFixed(1)}%`,
        sub: `${disputeCount.toLocaleString()} active disputes`,
      },
      {
        tone: "neutral",
        icon: <Icon.Info className="lcKpiIcon" />,
        label: "Avg Registration",
        value: `${avgRegDays} days`,
        delta: "(-18.5%)",
        sub: `Improved from ${(avgRegDays * 1.185).toFixed(1)} days`,
      },
    ],
    [verifiedPct, pendingPct, disputedPct, disputeCount, avgRegDays]
  );

  const rows = useMemo(() => {
    if (parcelRows.length > 0) return parcelRows;
    // Fallback mock rows shown while loading or if API returns nothing
    return [
      { parcel: "BG-2024-45892", address: { line1: "Knez Mihailova 22", line2: "Belgrade" },   status: { key: "verified",  text: "verified"  }, zoning: "ok",  environmental: "ok",   occupancy: "ok",   mortgage: { key: "clear",    text: "clear"    }, hash: "0x7a8b9c...3d4e5f", flags: [] },
      { parcel: "BG-2024-45893", address: { line1: "Terazije 15",       line2: "Belgrade" },   status: { key: "pending",   text: "pending"   }, zoning: "ok",  environmental: "warn", occupancy: "ok",   mortgage: { key: "active",   text: "active"   }, hash: "0x1f2e3d...6a7b8c", flags: ["Environmental clearance missing"] },
      { parcel: "NS-2024-12456", address: { line1: "Zmaj Jovina 8",     line2: "Novi Sad" },   status: { key: "disputed",  text: "disputed"  }, zoning: "ok",  environmental: "ok",   occupancy: "warn", mortgage: { key: "clear",    text: "clear"    }, hash: "0x9c8b7a...4e3d2c", flags: ["Title conflict", "Missing occupancy certificate"] },
      { parcel: "NI-2024-78234", address: { line1: "Obrenovićeva 42",   line2: "Niš" },        status: { key: "verified",  text: "verified"  }, zoning: "ok",  environmental: "ok",   occupancy: "ok",   mortgage: { key: "active",   text: "active"   }, hash: "0x5d6e7f...2a1b0c", flags: [] },
      { parcel: "KG-2024-34567", address: { line1: "Kralja Petra 18",   line2: "Kragujevac" }, status: { key: "litigation",text: "litigation"}, zoning: "bad", environmental: "ok",   occupancy: "warn", mortgage: { key: "defaulted",text: "defaulted"}, hash: "0x3c4d5e...8f9g0h", flags: ["Under court stay", "Zoning violation"] },
      { parcel: "SU-2024-56789", address: { line1: "Korzo 25",          line2: "Subotica" },   status: { key: "verified",  text: "verified"  }, zoning: "ok",  environmental: "ok",   occupancy: "ok",   mortgage: { key: "clear",    text: "clear"    }, hash: "0x2b3c4d...7e8f9g", flags: [] },
      { parcel: "ZR-2024-23456", address: { line1: "Glavna 12",         line2: "Zrenjanin" },  status: { key: "pending",   text: "pending"   }, zoning: "ok",  environmental: "ok",   occupancy: "warn", mortgage: { key: "active",   text: "active"   }, hash: "0x8e9f0g...3a4b5c", flags: ["Pending occupancy verification"] },
      { parcel: "PA-2024-67890", address: { line1: "Vojvode Radomira 5",line2: "Pančevo" },    status: { key: "verified",  text: "verified"  }, zoning: "ok",  environmental: "ok",   occupancy: "ok",   mortgage: { key: "clear",    text: "clear"    }, hash: "0x4d5e6f...9g0h1i", flags: [] },
    ];
  }, [parcelRows]);

  const chainStats = useMemo(
    () => ({
      totalProps: 1247832,
      totalPropsPct: 78,
      transfers: 3456789,
      tamper: 23,
    }),
    []
  );

  function handleDonutHover(e, title, value) {
    if (!title) return donutTip.hide();
    donutTip.show(e, title, value);
  }
  function handleBarHover(e, title, value) {
    if (!title) return barTip.hide();
    barTip.show(e, title, value);
  }

  function CellCheck({ state }) {
    if (state === "ok") {
      return (
        <span className="lcCellIcon lcCellIcon_ok" title="OK">
          ✓
        </span>
      );
    }
    if (state === "warn") {
      return (
        <span className="lcCellIcon lcCellIcon_warn" title="Warning">
          !
        </span>
      );
    }
    return (
      <span className="lcCellIcon lcCellIcon_bad" title="Issue">
        !
      </span>
    );
  }

  function StatusPill({ kind, text }) {
    return <span className={`lcPill lcPill_${kind}`}>{text}</span>;
  }

  /* -----------------------------
     Search + Filters (Table tools)
  ------------------------------ */
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mortgageFilter, setMortgageFilter] = useState("all");
  const [flagsFilter, setFlagsFilter] = useState("all"); // all | any | none

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((r) => {
      const matchesQuery =
        !q ||
        r.parcel.replace(/\s+/g, " ").toLowerCase().includes(q) ||
        r.address.line1.toLowerCase().includes(q) ||
        r.address.line2.toLowerCase().includes(q) ||
        r.hash.toLowerCase().includes(q) ||
        r.flags.join(" ").toLowerCase().includes(q);

      const matchesStatus = statusFilter === "all" || r.status.key === statusFilter;
      const matchesMortgage = mortgageFilter === "all" || r.mortgage.key === mortgageFilter;

      const hasFlags = r.flags.length > 0;
      const matchesFlags =
        flagsFilter === "all" ||
        (flagsFilter === "any" && hasFlags) ||
        (flagsFilter === "none" && !hasFlags);

      return matchesQuery && matchesStatus && matchesMortgage && matchesFlags;
    });
  }, [rows, query, statusFilter, mortgageFilter, flagsFilter]);

  const activeFiltersCount =
    (query.trim() ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (mortgageFilter !== "all" ? 1 : 0) +
    (flagsFilter !== "all" ? 1 : 0);

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setMortgageFilter("all");
    setFlagsFilter("all");
  }

  return (
    <div className="lcPage">
      <div className="lcTopBar" />

      <div className="lcWrap">
        {/* Header */}
        <header className="lcHeader">
          <div className="lcHeaderRow">
            <div className="lcBrand">
              <div className="lcLogoMark" aria-hidden="true">
                <Icon.Shield className="lcLogoIcon" />
              </div>
              <div className="lcBrandText">
                <div className="lcBrandName">RegistryGuard</div>
                <div className="lcBrandTag">Compliance &amp; Verification</div>
              </div>
            </div>

            <div className="lcBadge">
              <Icon.Scale className="lcBadgeIcon" />
              <span>Legal Verification</span>
            </div>
          </div>

          <h1 className="lcTitle">Legal Compliance Dashboard</h1>
          <p className="lcSubtitle">
            Every registered property — legally clean, verified, and enforceable
          </p>
        </header>

        {/* KPI cards */}
        <section className="lcKpiGrid">
          {kpis.map((k, i) => (
            <div key={i} className={`lcKpiCard lcKpiCard_${k.tone}`}>
              <div className="lcKpiTop">
                <div className="lcKpiTopLeft">
                  <span className={`lcKpiIconWrap lcKpiIconWrap_${k.tone}`}>{k.icon}</span>
                  <span className="lcKpiLabel">{k.label}</span>
                </div>
              </div>
              <div className="lcKpiValueRow">
                <div className="lcKpiValue">{k.value}</div>
                {k.delta ? <div className="lcKpiDelta">{k.delta}</div> : null}
              </div>
              <div className="lcKpiSub">{k.sub}</div>
            </div>
          ))}
        </section>

        {/* Charts row */}
        <section className="lcGrid2">
          <div className="lcCard">
            <div className="lcCardHeader">
              <h3 className="lcCardTitle">Legal Status Overview</h3>
            </div>

            <div
              className="lcCardBody lcChartBody"
              ref={donutTip.containerRef}
              onMouseMove={donutTip.move}
              onMouseLeave={donutTip.hide}
            >
              <DonutChart
                data={statusBreakdown}
                centerLabel="Legal Status"
                onHover={handleDonutHover}
              />
              {donutTip.TooltipEl}
            </div>
          </div>

          <div className="lcCard">
            <div className="lcCardHeader">
              <h3 className="lcCardTitle">Risk Flags Distribution</h3>
              <p className="lcCardHint">Auto-generated alerts requiring attention</p>
            </div>

            <div
              className="lcCardBody"
              ref={barTip.containerRef}
              onMouseMove={barTip.move}
              onMouseLeave={barTip.hide}
            >
              <HorizontalBarChart items={riskFlags} maxX={600} onHover={handleBarHover} />
              {barTip.TooltipEl}
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="lcCard lcTableCard">
          <div className="lcCardHeader lcCardHeader_tools">
            <div>
              <h3 className="lcCardTitle">Property Verification Status</h3>
              <p className="lcCardHint">Detailed lifecycle and compliance status per parcel</p>
            </div>

            {/* Search + Filter tools */}
            <div className="lcTools">
              <div className="lcSearch">
                <Icon.Search className="lcToolIcon" />
                <input
                  className="lcSearchInput"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search parcel, address, hash, flags..."
                  aria-label="Search rows"
                />
              </div>

              <div className="lcSelect">
                <Icon.Filter className="lcToolIcon" />
                <select
                  className="lcSelectEl"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="all">All Status</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending</option>
                  <option value="disputed">Disputed</option>
                  <option value="litigation">Litigation</option>
                </select>
              </div>

              <div className="lcSelect">
                <Icon.Filter className="lcToolIcon" />
                <select
                  className="lcSelectEl"
                  value={mortgageFilter}
                  onChange={(e) => setMortgageFilter(e.target.value)}
                  aria-label="Filter by mortgage"
                >
                  <option value="all">All Mortgage</option>
                  <option value="clear">Clear</option>
                  <option value="active">Active</option>
                  <option value="defaulted">Defaulted</option>
                </select>
              </div>

              <div className="lcSelect">
                <Icon.Filter className="lcToolIcon" />
                <select
                  className="lcSelectEl"
                  value={flagsFilter}
                  onChange={(e) => setFlagsFilter(e.target.value)}
                  aria-label="Filter by risk flags"
                >
                  <option value="all">All Flags</option>
                  <option value="any">Has Flags</option>
                  <option value="none">No Flags</option>
                </select>
              </div>

              <button
                type="button"
                className="lcBtn"
                onClick={clearFilters}
                disabled={activeFiltersCount === 0}
                title="Clear filters"
              >
                Clear
                {activeFiltersCount ? <span className="lcBtnBadge">{activeFiltersCount}</span> : null}
              </button>
            </div>
          </div>

          <div className="lcTableWrap">
            <table className="lcTable">
              <thead>
                <tr>
                  <th>Parcel ID</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Zoning</th>
                  <th>Environmental</th>
                  <th>Occupancy</th>
                  <th>Mortgage</th>
                  <th>Blockchain Hash</th>
                  <th>Risk Flags</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <div className="lcEmpty">
                        <div className="lcEmptyTitle">No results found</div>
                        <div className="lcEmptySub">
                          Try changing your search or filters.
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r, idx) => (
                    <tr key={idx}>
                      <td className="lcMono lcParcel">{r.parcel}</td>
                      <td>
                        <div className="lcAddr">
                          <div className="lcAddrLine1">{r.address.line1}</div>
                          <div className="lcAddrLine2">{r.address.line2}</div>
                        </div>
                      </td>
                      <td>
                        <StatusPill kind={r.status.key} text={r.status.text} />
                      </td>
                      <td className="lcCenter">
                        <CellCheck state={r.zoning} />
                      </td>
                      <td className="lcCenter">
                        <CellCheck state={r.environmental} />
                      </td>
                      <td className="lcCenter">
                        <CellCheck state={r.occupancy} />
                      </td>
                      <td>
                        <StatusPill kind={`mort_${r.mortgage.key}`} text={r.mortgage.text} />
                      </td>
                      <td className="lcMono lcHash">
                        <span className="lcHashRow">
                          <Icon.Hash className="lcHashIcon" />
                          {r.hash}
                        </span>
                      </td>
                      <td>
                        {r.flags.length === 0 ? (
                          <span className="lcMuted">None</span>
                        ) : (
                          <div className="lcFlags">
                            {r.flags.map((f, j) => (
                              <span
                                key={j}
                                className={`lcFlag ${f === "+1" ? "lcFlag_more" : "lcFlag_bad"}`}
                              >
                                {f === "+1" ? (
                                  <>
                                    <Icon.Plus className="lcPlusIcon" /> 1
                                  </>
                                ) : (
                                  f
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Blockchain Audit Trail */}
        <section className="lcCard">
          <div className="lcCardHeader">
            <div className="lcCardTitleRow">
              <h3 className="lcCardTitle">Blockchain Audit Trail</h3>
            </div>
          </div>

          <div className="lcAuditGrid">
            <div className="lcAuditCard">
              <div className="lcAuditLabel">Total Properties on Chain</div>
              <div className="lcAuditValue">{formatNumber(chainStats.totalProps)}</div>
              <div className="lcAuditHint">{chainStats.totalPropsPct}% of total registry</div>

              <div className="lcProgress">
                <div
                  className="lcProgressFill"
                  style={{ width: `${chainStats.totalPropsPct}%` }}
                />
              </div>
            </div>

            <div className="lcAuditCard">
              <div className="lcAuditLabel">Ownership Transfers Logged</div>
              <div className="lcAuditValue">{formatNumber(chainStats.transfers)}</div>
              <div className="lcAuditHint">Immutable audit trail</div>
            </div>

            <div className="lcAuditCard lcAuditCard_bad">
              <div className="lcAuditLabel lcAuditLabel_bad">Tamper Attempts Detected</div>
              <div className="lcAuditValue lcAuditValue_bad">{chainStats.tamper}</div>
              <div className="lcAuditHint">All blocked &amp; reported</div>
            </div>
          </div>
        </section>

        <div className="lcFooterSpace" />

        <footer className="lcFooter">
          <div className="lcFooterInner">
            <div className="lcFooterLeft">
              <span className="lcFooterDot" />
              <span className="lcFooterText">
                © {new Date().getFullYear()} RegistryGuard • Legal Compliance Dashboard
              </span>
            </div>
            <div className="lcFooterRight">
              <span className="lcFooterPill">
                <Icon.Shield className="lcFooterIcon" />
                Secured
              </span>
              <span className="lcFooterPill">
                <Icon.Scale className="lcFooterIcon" />
                Audited
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// // LegalCleanliness.jsx
// import React, { useMemo, useRef, useState, useEffect } from "react";
// import { fetchDashboardStats } from "../utils/api";
// import "./LegalCleanliness.css";

// /* -----------------------------
//    Small UI helpers / icons
// ------------------------------ */
// const Icon = {
//   Scale: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M12 3v18M7 6h10M6 6l-3 6a4 4 0 0 0 8 0L8 6Zm10 0 3 6a4 4 0 0 1-8 0l3-6Zm-8 14h8"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   CheckCircle: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M9 12.5l2 2.2 4.7-5.2M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Clock: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Zm0-14v5l3 2"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   AlertTriangle: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M12 3 1.8 20.2h20.4L12 3Zm0 6v5m0 4h.01"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Info: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Zm0-11v6m0-9h.01"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Hash: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M9 3 7 21M17 3l-2 18M5 8h16M4 16h16"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Shield: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M12 2l8 4v6c0 5-3.4 9.3-8 10-4.6-.7-8-5-8-10V6l8-4Z"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Dot: (props) => (
//     <svg viewBox="0 0 10 10" aria-hidden="true" {...props}>
//       <circle cx="5" cy="5" r="4" fill="currentColor" />
//     </svg>
//   ),
//   Plus: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M12 5v14M5 12h14"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//       />
//     </svg>
//   ),
//   Search: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm6.1-1.4L21 21"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//       />
//     </svg>
//   ),
//   Filter: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M4 6h16M7 12h10M10 18h4"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//       />
//     </svg>
//   ),
// };

// function formatNumber(n) {
//   const s = String(n);
//   const parts = [];
//   let i = s.length;
//   while (i > 3) {
//     parts.unshift(s.slice(i - 3, i));
//     i -= 3;
//   }
//   parts.unshift(s.slice(0, i));
//   return parts.join(",");
// }

// function clamp(v, min, max) {
//   return Math.max(min, Math.min(max, v));
// }

// /* -----------------------------
//    Tooltip hook
// ------------------------------ */
// function useHoverTooltip() {
//   const [tip, setTip] = useState({ show: false, x: 0, y: 0, title: "", value: "" });
//   const containerRef = useRef(null);

//   function show(e, title, value) {
//     const rect = containerRef.current?.getBoundingClientRect();
//     const clientX = e?.clientX ?? rect?.left ?? 0;
//     const clientY = e?.clientY ?? rect?.top ?? 0;

//     const x = rect ? clientX - rect.left : 0;
//     const y = rect ? clientY - rect.top : 0;

//     setTip({
//       show: true,
//       x: clamp(x, 12, (rect?.width ?? 0) - 12),
//       y: clamp(y, 12, (rect?.height ?? 0) - 12),
//       title,
//       value,
//     });
//   }

//   function move(e) {
//     if (!tip.show) return;
//     const rect = containerRef.current?.getBoundingClientRect();
//     if (!rect) return;

//     const x = e.clientX - rect.left;
//     const y = e.clientY - rect.top;

//     setTip((t) => ({
//       ...t,
//       x: clamp(x, 12, rect.width - 12),
//       y: clamp(y, 12, rect.height - 12),
//     }));
//   }

//   function hide() {
//     setTip((t) => ({ ...t, show: false }));
//   }

//   const TooltipEl = (
//     <div
//       className={`lcTip ${tip.show ? "lcTip_show" : ""}`}
//       style={{ left: tip.x, top: tip.y }}
//       role="status"
//       aria-live="polite"
//     >
//       <div className="lcTipTitle">{tip.title}</div>
//       <div className="lcTipValue">{tip.value}</div>
//     </div>
//   );

//   return { containerRef, tip, TooltipEl, show, move, hide };
// }

// /* -----------------------------
//    Donut chart (SVG)
// ------------------------------ */
// function DonutChart({ data, centerLabel = "Legal Status", onHover }) {
//   const size = 220;
//   const stroke = 26;
//   const r = (size - stroke) / 2;
//   const c = 2 * Math.PI * r;

//   const total = data.reduce((sum, d) => sum + d.value, 0);

//   const segments = [];
//   let offset = 0;

//   data.forEach((d) => {
//     const frac = total ? d.value / total : 0;
//     const dash = frac * c;

//     segments.push({
//       ...d,
//       dash,
//       offset,
//     });

//     offset += dash;
//   });

//   const rotate = -90 + 18;

//   return (
//     <div className="lcDonut">
//       <div className="lcDonutSvgWrap">
//         <svg
//           width={size}
//           height={size}
//           viewBox={`0 0 ${size} ${size}`}
//           className="lcDonutSvg"
//           role="img"
//           aria-label="Legal status overview donut chart"
//         >
//           <g transform={`rotate(${rotate} ${size / 2} ${size / 2})`}>
//             <circle
//               cx={size / 2}
//               cy={size / 2}
//               r={r}
//               stroke="var(--lc-border)"
//               strokeWidth={stroke}
//               fill="none"
//             />
//             {segments.map((s, idx) => (
//               <circle
//                 key={idx}
//                 cx={size / 2}
//                 cy={size / 2}
//                 r={r}
//                 stroke={s.color}
//                 strokeWidth={stroke}
//                 fill="none"
//                 strokeDasharray={`${s.dash} ${c - s.dash}`}
//                 strokeDashoffset={-s.offset}
//                 strokeLinecap="butt"
//                 className="lcDonutSeg"
//                 tabIndex={0}
//                 onMouseEnter={(e) => onHover?.(e, s.label, `${s.value.toFixed(1)}%`)}
//                 onMouseMove={(e) => onHover?.(e, s.label, `${s.value.toFixed(1)}%`)}
//                 onMouseLeave={() => onHover?.(null, "", "")}
//                 onFocus={(e) => onHover?.(e, s.label, `${s.value.toFixed(1)}%`)}
//                 onBlur={() => onHover?.(null, "", "")}
//               />
//             ))}
//           </g>

//           <g className="lcDonutCenter">
//             <text x="50%" y="47%" textAnchor="middle" className="lcDonutCenterTitle">
//               {centerLabel}
//             </text>
//             <text x="50%" y="58%" textAnchor="middle" className="lcDonutCenterSub">
//               Overview
//             </text>
//           </g>
//         </svg>
//       </div>

//       <div className="lcLegend">
//         {data.map((d, i) => (
//           <div key={i} className="lcLegendItem">
//             <span className="lcLegendDot" style={{ background: d.color }} />
//             <span className="lcLegendText">
//               {d.label}: <b>{d.value.toFixed(1)}%</b>
//             </span>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// /* -----------------------------
//    Horizontal bar chart (SVG)
// ------------------------------ */
// function HorizontalBarChart({ items, maxX = 600, onHover }) {
//   const height = 280;
//   const leftPad = 180;
//   const rightPad = 30;
//   const topPad = 18;
//   const rowH = 40;

//   const width = 740;
//   const chartW = width - leftPad - rightPad;

//   const ticks = [0, 150, 300, 450, 600].filter((t) => t <= maxX);
//   const scale = (v) => (maxX ? (v / maxX) * chartW : 0);

//   return (
//     <div className="lcBarChartWrap">
//       <svg
//         viewBox={`0 0 ${width} ${height}`}
//         className="lcBarSvg"
//         role="img"
//         aria-label="Risk flags distribution bar chart"
//       >
//         {ticks.map((t, idx) => {
//           const x = leftPad + scale(t);
//           return (
//             <g key={idx}>
//               <line x1={x} y1={topPad} x2={x} y2={height - 46} className="lcBarGrid" />
//               <text x={x} y={height - 20} textAnchor="middle" className="lcBarTick">
//                 {t}
//               </text>
//             </g>
//           );
//         })}

//         {items.map((it, i) => {
//           const y = topPad + i * rowH + 10;
//           const barH = 18;
//           const w = scale(it.value);

//           return (
//             <g key={i} className="lcBarRow">
//               <text x={leftPad - 10} y={y + 13} textAnchor="end" className="lcBarLabel">
//                 {it.label}
//               </text>

//               <rect
//                 x={leftPad}
//                 y={y}
//                 width={Math.max(2, w)}
//                 height={barH}
//                 rx="4"
//                 className="lcBar"
//                 style={{ fill: it.color }}
//                 tabIndex={0}
//                 onMouseEnter={(e) => onHover?.(e, it.label, `${it.value}`)}
//                 onMouseMove={(e) => onHover?.(e, it.label, `${it.value}`)}
//                 onMouseLeave={() => onHover?.(null, "", "")}
//                 onFocus={(e) => onHover?.(e, it.label, `${it.value}`)}
//                 onBlur={() => onHover?.(null, "", "")}
//               />
//             </g>
//           );
//         })}
//       </svg>
//     </div>
//   );
// }

// /* -----------------------------
//    Main Page
// ------------------------------ */
// export default function LegalCleanliness() {
//   const [apiStats, setApiStats] = useState(null);

//   useEffect(() => {
//     fetchDashboardStats()
//       .then((res) => setApiStats(res?.data ?? null))
//       .catch((err) => console.error("LegalCleanliness API error:", err));
//   }, []);

//   // Derive metrics from API when available, else use fallback values
//   const verifiedPct = apiStats?.parcels?.verificationRate ?? 78.4;
//   const pendingPct = apiStats?.parcels?.pendingRate ?? 14.2;
//   const disputedPct = apiStats?.disputes?.activeRate ?? 5.8;
//   const litigationPct = Math.max(0, 100 - verifiedPct - pendingPct - disputedPct).toFixed(1) * 1 || 1.6;
//   const disputeCount = apiStats?.disputes?.total ?? 1217;
//   const avgRegDays = apiStats?.parcels?.avgRegistrationDays ?? 4.2;

//   const statusBreakdown = useMemo(
//     () => [
//       { key: "verified", label: "Verified", value: verifiedPct, color: "var(--lc-green)" },
//       { key: "pending", label: "Pending", value: pendingPct, color: "var(--lc-orange)" },
//       { key: "disputed", label: "Disputed", value: disputedPct, color: "var(--lc-red)" },
//       { key: "litigation", label: "Litigation", value: litigationPct, color: "var(--lc-purple)" },
//     ],
//     [verifiedPct, pendingPct, disputedPct, litigationPct]
//   );

//   const riskFlags = useMemo(
//     () => [
//       { label: "Title Conflicts", value: 240, color: "var(--lc-redbar)" },
//       { label: "Duplicate\nRegistrations", value: 90, color: "var(--lc-redbar)" },
//       { label: "Zoning Violations", value: 160, color: "var(--lc-amberbar)" },
//       { label: "Unregistered\nExtensions", value: 420, color: "var(--lc-steelbar)" },
//       { label: "Missing Clearances", value: 320, color: "var(--lc-amberbar)" },
//       { label: "Post-sale\nModifications", value: 150, color: "var(--lc-amberbar)" },
//     ],
//     []
//   );

//   const donutTip = useHoverTooltip();
//   const barTip = useHoverTooltip();

//   const kpis = useMemo(
//     () => [
//       {
//         tone: "good",
//         icon: <Icon.CheckCircle className="lcKpiIcon" />,
//         label: "Fully Verified",
//         value: `${verifiedPct.toFixed(1)}%`,
//         sub: "Properties legally clean",
//       },
//       {
//         tone: "warn",
//         icon: <Icon.Clock className="lcKpiIcon" />,
//         label: "Pending Checks",
//         value: `${pendingPct.toFixed(1)}%`,
//         sub: "Awaiting verification",
//       },
//       {
//         tone: "bad",
//         icon: <Icon.AlertTriangle className="lcKpiIcon" />,
//         label: "Disputed",
//         value: `${disputedPct.toFixed(1)}%`,
//         sub: `${disputeCount.toLocaleString()} active disputes`,
//       },
//       {
//         tone: "neutral",
//         icon: <Icon.Info className="lcKpiIcon" />,
//         label: "Avg Registration",
//         value: `${avgRegDays} days`,
//         delta: "(-18.5%)",
//         sub: `Improved from ${(avgRegDays * 1.185).toFixed(1)} days`,
//       },
//     ],
//     [verifiedPct, pendingPct, disputedPct, disputeCount, avgRegDays]
//   );

//   const rows = useMemo(
//     () => [
//       {
//         parcel: "BG-2024-\n45892",
//         address: { line1: "Knez Mihailova 22", line2: "Belgrade" },
//         status: { key: "verified", text: "verified" },
//         zoning: "ok",
//         environmental: "ok",
//         occupancy: "ok",
//         mortgage: { key: "clear", text: "clear" },
//         hash: "0x7a8b9c...3d4e5f",
//         flags: [],
//       },
//       {
//         parcel: "BG-2024-\n45893",
//         address: { line1: "Terazije 15", line2: "Belgrade" },
//         status: { key: "pending", text: "pending" },
//         zoning: "ok",
//         environmental: "warn",
//         occupancy: "ok",
//         mortgage: { key: "active", text: "active" },
//         hash: "0x1f2e3d...6a7b8c",
//         flags: ["Environmental clearance missing"],
//       },
//       {
//         parcel: "NS-2024-\n12456",
//         address: { line1: "Zmaj Jovina 8", line2: "Novi Sad" },
//         status: { key: "disputed", text: "disputed" },
//         zoning: "ok",
//         environmental: "ok",
//         occupancy: "warn",
//         mortgage: { key: "clear", text: "clear" },
//         hash: "0x9c8b7a...4e3d2c",
//         flags: ["Title conflict", "Missing occupancy certificate"],
//       },
//       {
//         parcel: "NI-2024-\n78234",
//         address: { line1: "Obrenovićeva 42", line2: "Niš" },
//         status: { key: "verified", text: "verified" },
//         zoning: "ok",
//         environmental: "ok",
//         occupancy: "ok",
//         mortgage: { key: "active", text: "active" },
//         hash: "0x5d6e7f...2a1b0c",
//         flags: [],
//       },
//       {
//         parcel: "KG-2024-\n34567",
//         address: { line1: "Kralja Petra 18", line2: "Kragujevac" },
//         status: { key: "litigation", text: "litigation" },
//         zoning: "bad",
//         environmental: "ok",
//         occupancy: "warn",
//         mortgage: { key: "defaulted", text: "defaulted" },
//         hash: "0x3c4d5e...8f9g0h",
//         flags: ["Under court stay", "Zoning violation", "+1"],
//       },
//       {
//         parcel: "SU-2024-\n56789",
//         address: { line1: "Korzo 25", line2: "Subotica" },
//         status: { key: "verified", text: "verified" },
//         zoning: "ok",
//         environmental: "ok",
//         occupancy: "ok",
//         mortgage: { key: "clear", text: "clear" },
//         hash: "0x2b3c4d...7e8f9g",
//         flags: [],
//       },
//       {
//         parcel: "ZR-2024-\n23456",
//         address: { line1: "Glavna 12", line2: "Zrenjanin" },
//         status: { key: "pending", text: "pending" },
//         zoning: "ok",
//         environmental: "ok",
//         occupancy: "warn",
//         mortgage: { key: "active", text: "active" },
//         hash: "0x8e9f0g...3a4b5c",
//         flags: ["Pending occupancy verification"],
//       },
//       {
//         parcel: "PA-2024-\n67890",
//         address: { line1: "Vojvode Radomira 5", line2: "Pančevo" },
//         status: { key: "verified", text: "verified" },
//         zoning: "ok",
//         environmental: "ok",
//         occupancy: "ok",
//         mortgage: { key: "clear", text: "clear" },
//         hash: "0x4d5e6f...9g0h1i",
//         flags: [],
//       },
//     ],
//     []
//   );

//   const chainStats = useMemo(
//     () => ({
//       totalProps: 1247832,
//       totalPropsPct: 78,
//       transfers: 3456789,
//       tamper: 23,
//     }),
//     []
//   );

//   function handleDonutHover(e, title, value) {
//     if (!title) return donutTip.hide();
//     donutTip.show(e, title, value);
//   }
//   function handleBarHover(e, title, value) {
//     if (!title) return barTip.hide();
//     barTip.show(e, title, value);
//   }

//   function CellCheck({ state }) {
//     if (state === "ok") {
//       return (
//         <span className="lcCellIcon lcCellIcon_ok" title="OK">
//           ✓
//         </span>
//       );
//     }
//     if (state === "warn") {
//       return (
//         <span className="lcCellIcon lcCellIcon_warn" title="Warning">
//           !
//         </span>
//       );
//     }
//     return (
//       <span className="lcCellIcon lcCellIcon_bad" title="Issue">
//         !
//       </span>
//     );
//   }

//   function StatusPill({ kind, text }) {
//     return <span className={`lcPill lcPill_${kind}`}>{text}</span>;
//   }

//   /* -----------------------------
//      Search + Filters (Table tools)
//   ------------------------------ */
//   const [query, setQuery] = useState("");
//   const [statusFilter, setStatusFilter] = useState("all");
//   const [mortgageFilter, setMortgageFilter] = useState("all");
//   const [flagsFilter, setFlagsFilter] = useState("all"); // all | any | none

//   const filteredRows = useMemo(() => {
//     const q = query.trim().toLowerCase();

//     return rows.filter((r) => {
//       const matchesQuery =
//         !q ||
//         r.parcel.replace(/\s+/g, " ").toLowerCase().includes(q) ||
//         r.address.line1.toLowerCase().includes(q) ||
//         r.address.line2.toLowerCase().includes(q) ||
//         r.hash.toLowerCase().includes(q) ||
//         r.flags.join(" ").toLowerCase().includes(q);

//       const matchesStatus = statusFilter === "all" || r.status.key === statusFilter;
//       const matchesMortgage = mortgageFilter === "all" || r.mortgage.key === mortgageFilter;

//       const hasFlags = r.flags.length > 0;
//       const matchesFlags =
//         flagsFilter === "all" ||
//         (flagsFilter === "any" && hasFlags) ||
//         (flagsFilter === "none" && !hasFlags);

//       return matchesQuery && matchesStatus && matchesMortgage && matchesFlags;
//     });
//   }, [rows, query, statusFilter, mortgageFilter, flagsFilter]);

//   const activeFiltersCount =
//     (query.trim() ? 1 : 0) +
//     (statusFilter !== "all" ? 1 : 0) +
//     (mortgageFilter !== "all" ? 1 : 0) +
//     (flagsFilter !== "all" ? 1 : 0);

//   function clearFilters() {
//     setQuery("");
//     setStatusFilter("all");
//     setMortgageFilter("all");
//     setFlagsFilter("all");
//   }

//   return (
//     <div className="lcPage">
//       <div className="lcTopBar" />

//       <div className="lcWrap">
//         {/* Header */}
//         <header className="lcHeader">
//           <div className="lcHeaderRow">
//             <div className="lcBrand">
//               <div className="lcLogoMark" aria-hidden="true">
//                 <Icon.Shield className="lcLogoIcon" />
//               </div>
//               <div className="lcBrandText">
//                 <div className="lcBrandName">RegistryGuard</div>
//                 <div className="lcBrandTag">Compliance &amp; Verification</div>
//               </div>
//             </div>

//             <div className="lcBadge">
//               <Icon.Scale className="lcBadgeIcon" />
//               <span>Legal Verification</span>
//             </div>
//           </div>

//           <h1 className="lcTitle">Legal Compliance Dashboard</h1>
//           <p className="lcSubtitle">
//             Every registered property — legally clean, verified, and enforceable
//           </p>
//         </header>

//         {/* KPI cards */}
//         <section className="lcKpiGrid">
//           {kpis.map((k, i) => (
//             <div key={i} className={`lcKpiCard lcKpiCard_${k.tone}`}>
//               <div className="lcKpiTop">
//                 <div className="lcKpiTopLeft">
//                   <span className={`lcKpiIconWrap lcKpiIconWrap_${k.tone}`}>{k.icon}</span>
//                   <span className="lcKpiLabel">{k.label}</span>
//                 </div>
//               </div>
//               <div className="lcKpiValueRow">
//                 <div className="lcKpiValue">{k.value}</div>
//                 {k.delta ? <div className="lcKpiDelta">{k.delta}</div> : null}
//               </div>
//               <div className="lcKpiSub">{k.sub}</div>
//             </div>
//           ))}
//         </section>

//         {/* Charts row */}
//         <section className="lcGrid2">
//           <div className="lcCard">
//             <div className="lcCardHeader">
//               <h3 className="lcCardTitle">Legal Status Overview</h3>
//             </div>

//             <div
//               className="lcCardBody lcChartBody"
//               ref={donutTip.containerRef}
//               onMouseMove={donutTip.move}
//               onMouseLeave={donutTip.hide}
//             >
//               <DonutChart
//                 data={statusBreakdown}
//                 centerLabel="Legal Status"
//                 onHover={handleDonutHover}
//               />
//               {donutTip.TooltipEl}
//             </div>
//           </div>

//           <div className="lcCard">
//             <div className="lcCardHeader">
//               <h3 className="lcCardTitle">Risk Flags Distribution</h3>
//               <p className="lcCardHint">Auto-generated alerts requiring attention</p>
//             </div>

//             <div
//               className="lcCardBody"
//               ref={barTip.containerRef}
//               onMouseMove={barTip.move}
//               onMouseLeave={barTip.hide}
//             >
//               <HorizontalBarChart items={riskFlags} maxX={600} onHover={handleBarHover} />
//               {barTip.TooltipEl}
//             </div>
//           </div>
//         </section>

//         {/* Table */}
//         <section className="lcCard lcTableCard">
//           <div className="lcCardHeader lcCardHeader_tools">
//             <div>
//               <h3 className="lcCardTitle">Property Verification Status</h3>
//               <p className="lcCardHint">Detailed lifecycle and compliance status per parcel</p>
//             </div>

//             {/* Search + Filter tools */}
//             <div className="lcTools">
//               <div className="lcSearch">
//                 <Icon.Search className="lcToolIcon" />
//                 <input
//                   className="lcSearchInput"
//                   value={query}
//                   onChange={(e) => setQuery(e.target.value)}
//                   placeholder="Search parcel, address, hash, flags..."
//                   aria-label="Search rows"
//                 />
//               </div>

//               <div className="lcSelect">
//                 <Icon.Filter className="lcToolIcon" />
//                 <select
//                   className="lcSelectEl"
//                   value={statusFilter}
//                   onChange={(e) => setStatusFilter(e.target.value)}
//                   aria-label="Filter by status"
//                 >
//                   <option value="all">All Status</option>
//                   <option value="verified">Verified</option>
//                   <option value="pending">Pending</option>
//                   <option value="disputed">Disputed</option>
//                   <option value="litigation">Litigation</option>
//                 </select>
//               </div>

//               <div className="lcSelect">
//                 <Icon.Filter className="lcToolIcon" />
//                 <select
//                   className="lcSelectEl"
//                   value={mortgageFilter}
//                   onChange={(e) => setMortgageFilter(e.target.value)}
//                   aria-label="Filter by mortgage"
//                 >
//                   <option value="all">All Mortgage</option>
//                   <option value="clear">Clear</option>
//                   <option value="active">Active</option>
//                   <option value="defaulted">Defaulted</option>
//                 </select>
//               </div>

//               <div className="lcSelect">
//                 <Icon.Filter className="lcToolIcon" />
//                 <select
//                   className="lcSelectEl"
//                   value={flagsFilter}
//                   onChange={(e) => setFlagsFilter(e.target.value)}
//                   aria-label="Filter by risk flags"
//                 >
//                   <option value="all">All Flags</option>
//                   <option value="any">Has Flags</option>
//                   <option value="none">No Flags</option>
//                 </select>
//               </div>

//               <button
//                 type="button"
//                 className="lcBtn"
//                 onClick={clearFilters}
//                 disabled={activeFiltersCount === 0}
//                 title="Clear filters"
//               >
//                 Clear
//                 {activeFiltersCount ? <span className="lcBtnBadge">{activeFiltersCount}</span> : null}
//               </button>
//             </div>
//           </div>

//           <div className="lcTableWrap">
//             <table className="lcTable">
//               <thead>
//                 <tr>
//                   <th>Parcel ID</th>
//                   <th>Address</th>
//                   <th>Status</th>
//                   <th>Zoning</th>
//                   <th>Environmental</th>
//                   <th>Occupancy</th>
//                   <th>Mortgage</th>
//                   <th>Blockchain Hash</th>
//                   <th>Risk Flags</th>
//                 </tr>
//               </thead>

//               <tbody>
//                 {filteredRows.length === 0 ? (
//                   <tr>
//                     <td colSpan={9}>
//                       <div className="lcEmpty">
//                         <div className="lcEmptyTitle">No results found</div>
//                         <div className="lcEmptySub">
//                           Try changing your search or filters.
//                         </div>
//                       </div>
//                     </td>
//                   </tr>
//                 ) : (
//                   filteredRows.map((r, idx) => (
//                     <tr key={idx}>
//                       <td className="lcMono lcParcel">{r.parcel}</td>
//                       <td>
//                         <div className="lcAddr">
//                           <div className="lcAddrLine1">{r.address.line1}</div>
//                           <div className="lcAddrLine2">{r.address.line2}</div>
//                         </div>
//                       </td>
//                       <td>
//                         <StatusPill kind={r.status.key} text={r.status.text} />
//                       </td>
//                       <td className="lcCenter">
//                         <CellCheck state={r.zoning} />
//                       </td>
//                       <td className="lcCenter">
//                         <CellCheck state={r.environmental} />
//                       </td>
//                       <td className="lcCenter">
//                         <CellCheck state={r.occupancy} />
//                       </td>
//                       <td>
//                         <StatusPill kind={`mort_${r.mortgage.key}`} text={r.mortgage.text} />
//                       </td>
//                       <td className="lcMono lcHash">
//                         <span className="lcHashRow">
//                           <Icon.Hash className="lcHashIcon" />
//                           {r.hash}
//                         </span>
//                       </td>
//                       <td>
//                         {r.flags.length === 0 ? (
//                           <span className="lcMuted">None</span>
//                         ) : (
//                           <div className="lcFlags">
//                             {r.flags.map((f, j) => (
//                               <span
//                                 key={j}
//                                 className={`lcFlag ${f === "+1" ? "lcFlag_more" : "lcFlag_bad"}`}
//                               >
//                                 {f === "+1" ? (
//                                   <>
//                                     <Icon.Plus className="lcPlusIcon" /> 1
//                                   </>
//                                 ) : (
//                                   f
//                                 )}
//                               </span>
//                             ))}
//                           </div>
//                         )}
//                       </td>
//                     </tr>
//                   ))
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </section>

//         {/* Blockchain Audit Trail */}
//         <section className="lcCard">
//           <div className="lcCardHeader">
//             <div className="lcCardTitleRow">
//               <h3 className="lcCardTitle">Blockchain Audit Trail</h3>
//             </div>
//           </div>

//           <div className="lcAuditGrid">
//             <div className="lcAuditCard">
//               <div className="lcAuditLabel">Total Properties on Chain</div>
//               <div className="lcAuditValue">{formatNumber(chainStats.totalProps)}</div>
//               <div className="lcAuditHint">{chainStats.totalPropsPct}% of total registry</div>

//               <div className="lcProgress">
//                 <div
//                   className="lcProgressFill"
//                   style={{ width: `${chainStats.totalPropsPct}%` }}
//                 />
//               </div>
//             </div>

//             <div className="lcAuditCard">
//               <div className="lcAuditLabel">Ownership Transfers Logged</div>
//               <div className="lcAuditValue">{formatNumber(chainStats.transfers)}</div>
//               <div className="lcAuditHint">Immutable audit trail</div>
//             </div>

//             <div className="lcAuditCard lcAuditCard_bad">
//               <div className="lcAuditLabel lcAuditLabel_bad">Tamper Attempts Detected</div>
//               <div className="lcAuditValue lcAuditValue_bad">{chainStats.tamper}</div>
//               <div className="lcAuditHint">All blocked &amp; reported</div>
//             </div>
//           </div>
//         </section>

//         <div className="lcFooterSpace" />

//         <footer className="lcFooter">
//           <div className="lcFooterInner">
//             <div className="lcFooterLeft">
//               <span className="lcFooterDot" />
//               <span className="lcFooterText">
//                 © {new Date().getFullYear()} RegistryGuard • Legal Compliance Dashboard
//               </span>
//             </div>
//             <div className="lcFooterRight">
//               <span className="lcFooterPill">
//                 <Icon.Shield className="lcFooterIcon" />
//                 Secured
//               </span>
//               <span className="lcFooterPill">
//                 <Icon.Scale className="lcFooterIcon" />
//                 Audited
//               </span>
//             </div>
//           </div>
//         </footer>
//       </div>
//     </div>
//   );
// }


// // LegalCleanliness.jsx
// import React, { useMemo, useRef, useState } from "react";
// import "./LegalCleanliness.css";

// /* -----------------------------
//    Small UI helpers / icons
// ------------------------------ */
// const Icon = {
//   Scale: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M12 3v18M7 6h10M6 6l-3 6a4 4 0 0 0 8 0L8 6Zm10 0 3 6a4 4 0 0 1-8 0l3-6Zm-8 14h8"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   CheckCircle: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M9 12.5l2 2.2 4.7-5.2M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Clock: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Zm0-14v5l3 2"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   AlertTriangle: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M12 3 1.8 20.2h20.4L12 3Zm0 6v5m0 4h.01"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Info: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Zm0-11v6m0-9h.01"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Hash: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M9 3 7 21M17 3l-2 18M5 8h16M4 16h16"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Shield: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M12 2l8 4v6c0 5-3.4 9.3-8 10-4.6-.7-8-5-8-10V6l8-4Z"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Dot: (props) => (
//     <svg viewBox="0 0 10 10" aria-hidden="true" {...props}>
//       <circle cx="5" cy="5" r="4" fill="currentColor" />
//     </svg>
//   ),
//   Plus: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M12 5v14M5 12h14"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//       />
//     </svg>
//   ),
//   Search: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm6.1-1.4L21 21"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//       />
//     </svg>
//   ),
//   Filter: (props) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
//       <path
//         d="M4 6h16M7 12h10M10 18h4"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//       />
//     </svg>
//   ),
// };

// function formatNumber(n) {
//   const s = String(n);
//   const parts = [];
//   let i = s.length;
//   while (i > 3) {
//     parts.unshift(s.slice(i - 3, i));
//     i -= 3;
//   }
//   parts.unshift(s.slice(0, i));
//   return parts.join(",");
// }

// function clamp(v, min, max) {
//   return Math.max(min, Math.min(max, v));
// }

// /* -----------------------------
//    Tooltip hook
// ------------------------------ */
// function useHoverTooltip() {
//   const [tip, setTip] = useState({ show: false, x: 0, y: 0, title: "", value: "" });
//   const containerRef = useRef(null);

//   function show(e, title, value) {
//     const rect = containerRef.current?.getBoundingClientRect();
//     const clientX = e?.clientX ?? rect?.left ?? 0;
//     const clientY = e?.clientY ?? rect?.top ?? 0;

//     const x = rect ? clientX - rect.left : 0;
//     const y = rect ? clientY - rect.top : 0;

//     setTip({
//       show: true,
//       x: clamp(x, 12, (rect?.width ?? 0) - 12),
//       y: clamp(y, 12, (rect?.height ?? 0) - 12),
//       title,
//       value,
//     });
//   }

//   function move(e) {
//     if (!tip.show) return;
//     const rect = containerRef.current?.getBoundingClientRect();
//     if (!rect) return;

//     const x = e.clientX - rect.left;
//     const y = e.clientY - rect.top;

//     setTip((t) => ({
//       ...t,
//       x: clamp(x, 12, rect.width - 12),
//       y: clamp(y, 12, rect.height - 12),
//     }));
//   }

//   function hide() {
//     setTip((t) => ({ ...t, show: false }));
//   }

//   const TooltipEl = (
//     <div
//       className={`lcTip ${tip.show ? "lcTip_show" : ""}`}
//       style={{ left: tip.x, top: tip.y }}
//       role="status"
//       aria-live="polite"
//     >
//       <div className="lcTipTitle">{tip.title}</div>
//       <div className="lcTipValue">{tip.value}</div>
//     </div>
//   );

//   return { containerRef, tip, TooltipEl, show, move, hide };
// }

// /* -----------------------------
//    Donut chart (SVG)
// ------------------------------ */
// function DonutChart({ data, centerLabel = "Legal Status", onHover }) {
//   const size = 220;
//   const stroke = 26;
//   const r = (size - stroke) / 2;
//   const c = 2 * Math.PI * r;

//   const total = data.reduce((sum, d) => sum + d.value, 0);

//   const segments = [];
//   let offset = 0;

//   data.forEach((d) => {
//     const frac = total ? d.value / total : 0;
//     const dash = frac * c;

//     segments.push({
//       ...d,
//       dash,
//       offset,
//     });

//     offset += dash;
//   });

//   const rotate = -90 + 18;

//   return (
//     <div className="lcDonut">
//       <div className="lcDonutSvgWrap">
//         <svg
//           width={size}
//           height={size}
//           viewBox={`0 0 ${size} ${size}`}
//           className="lcDonutSvg"
//           role="img"
//           aria-label="Legal status overview donut chart"
//         >
//           <g transform={`rotate(${rotate} ${size / 2} ${size / 2})`}>
//             <circle
//               cx={size / 2}
//               cy={size / 2}
//               r={r}
//               stroke="var(--lc-border)"
//               strokeWidth={stroke}
//               fill="none"
//             />
//             {segments.map((s, idx) => (
//               <circle
//                 key={idx}
//                 cx={size / 2}
//                 cy={size / 2}
//                 r={r}
//                 stroke={s.color}
//                 strokeWidth={stroke}
//                 fill="none"
//                 strokeDasharray={`${s.dash} ${c - s.dash}`}
//                 strokeDashoffset={-s.offset}
//                 strokeLinecap="butt"
//                 className="lcDonutSeg"
//                 tabIndex={0}
//                 onMouseEnter={(e) => onHover?.(e, s.label, `${s.value.toFixed(1)}%`)}
//                 onMouseMove={(e) => onHover?.(e, s.label, `${s.value.toFixed(1)}%`)}
//                 onMouseLeave={() => onHover?.(null, "", "")}
//                 onFocus={(e) => onHover?.(e, s.label, `${s.value.toFixed(1)}%`)}
//                 onBlur={() => onHover?.(null, "", "")}
//               />
//             ))}
//           </g>

//           <g className="lcDonutCenter">
//             <text x="50%" y="47%" textAnchor="middle" className="lcDonutCenterTitle">
//               {centerLabel}
//             </text>
//             <text x="50%" y="58%" textAnchor="middle" className="lcDonutCenterSub">
//               Overview
//             </text>
//           </g>
//         </svg>
//       </div>

//       <div className="lcLegend">
//         {data.map((d, i) => (
//           <div key={i} className="lcLegendItem">
//             <span className="lcLegendDot" style={{ background: d.color }} />
//             <span className="lcLegendText">
//               {d.label}: <b>{d.value.toFixed(1)}%</b>
//             </span>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// /* -----------------------------
//    Horizontal bar chart (SVG)
// ------------------------------ */
// function HorizontalBarChart({ items, maxX = 600, onHover }) {
//   const height = 280;
//   const leftPad = 180;
//   const rightPad = 30;
//   const topPad = 18;
//   const rowH = 40;

//   const width = 740;
//   const chartW = width - leftPad - rightPad;

//   const ticks = [0, 150, 300, 450, 600].filter((t) => t <= maxX);
//   const scale = (v) => (maxX ? (v / maxX) * chartW : 0);

//   return (
//     <div className="lcBarChartWrap">
//       <svg
//         viewBox={`0 0 ${width} ${height}`}
//         className="lcBarSvg"
//         role="img"
//         aria-label="Risk flags distribution bar chart"
//       >
//         {ticks.map((t, idx) => {
//           const x = leftPad + scale(t);
//           return (
//             <g key={idx}>
//               <line x1={x} y1={topPad} x2={x} y2={height - 46} className="lcBarGrid" />
//               <text x={x} y={height - 20} textAnchor="middle" className="lcBarTick">
//                 {t}
//               </text>
//             </g>
//           );
//         })}

//         {items.map((it, i) => {
//           const y = topPad + i * rowH + 10;
//           const barH = 18;
//           const w = scale(it.value);

//           return (
//             <g key={i} className="lcBarRow">
//               <text x={leftPad - 10} y={y + 13} textAnchor="end" className="lcBarLabel">
//                 {it.label}
//               </text>

//               <rect
//                 x={leftPad}
//                 y={y}
//                 width={Math.max(2, w)}
//                 height={barH}
//                 rx="4"
//                 className="lcBar"
//                 style={{ fill: it.color }}
//                 tabIndex={0}
//                 onMouseEnter={(e) => onHover?.(e, it.label, `${it.value}`)}
//                 onMouseMove={(e) => onHover?.(e, it.label, `${it.value}`)}
//                 onMouseLeave={() => onHover?.(null, "", "")}
//                 onFocus={(e) => onHover?.(e, it.label, `${it.value}`)}
//                 onBlur={() => onHover?.(null, "", "")}
//               />
//             </g>
//           );
//         })}
//       </svg>
//     </div>
//   );
// }

// /* -----------------------------
//    Main Page
// ------------------------------ */
// export default function LegalCleanliness() {
//   const statusBreakdown = useMemo(
//     () => [
//       { key: "verified", label: "Verified", value: 78.4, color: "var(--lc-green)" },
//       { key: "pending", label: "Pending", value: 14.2, color: "var(--lc-orange)" },
//       { key: "disputed", label: "Disputed", value: 5.8, color: "var(--lc-red)" },
//       { key: "litigation", label: "Litigation", value: 1.6, color: "var(--lc-purple)" },
//     ],
//     []
//   );

//   const riskFlags = useMemo(
//     () => [
//       { label: "Title Conflicts", value: 240, color: "var(--lc-redbar)" },
//       { label: "Duplicate\nRegistrations", value: 90, color: "var(--lc-redbar)" },
//       { label: "Zoning Violations", value: 160, color: "var(--lc-amberbar)" },
//       { label: "Unregistered\nExtensions", value: 420, color: "var(--lc-steelbar)" },
//       { label: "Missing Clearances", value: 320, color: "var(--lc-amberbar)" },
//       { label: "Post-sale\nModifications", value: 150, color: "var(--lc-amberbar)" },
//     ],
//     []
//   );

//   const donutTip = useHoverTooltip();
//   const barTip = useHoverTooltip();

//   const kpis = useMemo(
//     () => [
//       {
//         tone: "good",
//         icon: <Icon.CheckCircle className="lcKpiIcon" />,
//         label: "Fully Verified",
//         value: "78.4%",
//         sub: "Properties legally clean",
//       },
//       {
//         tone: "warn",
//         icon: <Icon.Clock className="lcKpiIcon" />,
//         label: "Pending Checks",
//         value: "14.2%",
//         sub: "Awaiting verification",
//       },
//       {
//         tone: "bad",
//         icon: <Icon.AlertTriangle className="lcKpiIcon" />,
//         label: "Disputed",
//         value: "5.8%",
//         sub: "Active disputes",
//       },
//       {
//         tone: "neutral",
//         icon: <Icon.Info className="lcKpiIcon" />,
//         label: "Avg Registration",
//         value: "4.2 days",
//         delta: "(-18.5%)",
//         sub: "Improved from 5.2 days",
//       },
//     ],
//     []
//   );

//   const rows = useMemo(
//     () => [
//       {
//         parcel: "BG-2024-\n45892",
//         address: { line1: "Knez Mihailova 22", line2: "Belgrade" },
//         status: { key: "verified", text: "verified" },
//         zoning: "ok",
//         environmental: "ok",
//         occupancy: "ok",
//         mortgage: { key: "clear", text: "clear" },
//         hash: "0x7a8b9c...3d4e5f",
//         flags: [],
//       },
//       {
//         parcel: "BG-2024-\n45893",
//         address: { line1: "Terazije 15", line2: "Belgrade" },
//         status: { key: "pending", text: "pending" },
//         zoning: "ok",
//         environmental: "warn",
//         occupancy: "ok",
//         mortgage: { key: "active", text: "active" },
//         hash: "0x1f2e3d...6a7b8c",
//         flags: ["Environmental clearance missing"],
//       },
//       {
//         parcel: "NS-2024-\n12456",
//         address: { line1: "Zmaj Jovina 8", line2: "Novi Sad" },
//         status: { key: "disputed", text: "disputed" },
//         zoning: "ok",
//         environmental: "ok",
//         occupancy: "warn",
//         mortgage: { key: "clear", text: "clear" },
//         hash: "0x9c8b7a...4e3d2c",
//         flags: ["Title conflict", "Missing occupancy certificate"],
//       },
//       {
//         parcel: "NI-2024-\n78234",
//         address: { line1: "Obrenovićeva 42", line2: "Niš" },
//         status: { key: "verified", text: "verified" },
//         zoning: "ok",
//         environmental: "ok",
//         occupancy: "ok",
//         mortgage: { key: "active", text: "active" },
//         hash: "0x5d6e7f...2a1b0c",
//         flags: [],
//       },
//       {
//         parcel: "KG-2024-\n34567",
//         address: { line1: "Kralja Petra 18", line2: "Kragujevac" },
//         status: { key: "litigation", text: "litigation" },
//         zoning: "bad",
//         environmental: "ok",
//         occupancy: "warn",
//         mortgage: { key: "defaulted", text: "defaulted" },
//         hash: "0x3c4d5e...8f9g0h",
//         flags: ["Under court stay", "Zoning violation", "+1"],
//       },
//       {
//         parcel: "SU-2024-\n56789",
//         address: { line1: "Korzo 25", line2: "Subotica" },
//         status: { key: "verified", text: "verified" },
//         zoning: "ok",
//         environmental: "ok",
//         occupancy: "ok",
//         mortgage: { key: "clear", text: "clear" },
//         hash: "0x2b3c4d...7e8f9g",
//         flags: [],
//       },
//       {
//         parcel: "ZR-2024-\n23456",
//         address: { line1: "Glavna 12", line2: "Zrenjanin" },
//         status: { key: "pending", text: "pending" },
//         zoning: "ok",
//         environmental: "ok",
//         occupancy: "warn",
//         mortgage: { key: "active", text: "active" },
//         hash: "0x8e9f0g...3a4b5c",
//         flags: ["Pending occupancy verification"],
//       },
//       {
//         parcel: "PA-2024-\n67890",
//         address: { line1: "Vojvode Radomira 5", line2: "Pančevo" },
//         status: { key: "verified", text: "verified" },
//         zoning: "ok",
//         environmental: "ok",
//         occupancy: "ok",
//         mortgage: { key: "clear", text: "clear" },
//         hash: "0x4d5e6f...9g0h1i",
//         flags: [],
//       },
//     ],
//     []
//   );

//   const chainStats = useMemo(
//     () => ({
//       totalProps: 1247832,
//       totalPropsPct: 78,
//       transfers: 3456789,
//       tamper: 23,
//     }),
//     []
//   );

//   function handleDonutHover(e, title, value) {
//     if (!title) return donutTip.hide();
//     donutTip.show(e, title, value);
//   }
//   function handleBarHover(e, title, value) {
//     if (!title) return barTip.hide();
//     barTip.show(e, title, value);
//   }

//   function CellCheck({ state }) {
//     if (state === "ok") {
//       return (
//         <span className="lcCellIcon lcCellIcon_ok" title="OK">
//           ✓
//         </span>
//       );
//     }
//     if (state === "warn") {
//       return (
//         <span className="lcCellIcon lcCellIcon_warn" title="Warning">
//           !
//         </span>
//       );
//     }
//     return (
//       <span className="lcCellIcon lcCellIcon_bad" title="Issue">
//         !
//       </span>
//     );
//   }

//   function StatusPill({ kind, text }) {
//     return <span className={`lcPill lcPill_${kind}`}>{text}</span>;
//   }

//   /* -----------------------------
//      Search + Filters (Table tools)
//   ------------------------------ */
//   const [query, setQuery] = useState("");
//   const [statusFilter, setStatusFilter] = useState("all");
//   const [mortgageFilter, setMortgageFilter] = useState("all");
//   const [flagsFilter, setFlagsFilter] = useState("all"); // all | any | none

//   const filteredRows = useMemo(() => {
//     const q = query.trim().toLowerCase();

//     return rows.filter((r) => {
//       const matchesQuery =
//         !q ||
//         r.parcel.replace(/\s+/g, " ").toLowerCase().includes(q) ||
//         r.address.line1.toLowerCase().includes(q) ||
//         r.address.line2.toLowerCase().includes(q) ||
//         r.hash.toLowerCase().includes(q) ||
//         r.flags.join(" ").toLowerCase().includes(q);

//       const matchesStatus = statusFilter === "all" || r.status.key === statusFilter;
//       const matchesMortgage = mortgageFilter === "all" || r.mortgage.key === mortgageFilter;

//       const hasFlags = r.flags.length > 0;
//       const matchesFlags =
//         flagsFilter === "all" ||
//         (flagsFilter === "any" && hasFlags) ||
//         (flagsFilter === "none" && !hasFlags);

//       return matchesQuery && matchesStatus && matchesMortgage && matchesFlags;
//     });
//   }, [rows, query, statusFilter, mortgageFilter, flagsFilter]);

//   const activeFiltersCount =
//     (query.trim() ? 1 : 0) +
//     (statusFilter !== "all" ? 1 : 0) +
//     (mortgageFilter !== "all" ? 1 : 0) +
//     (flagsFilter !== "all" ? 1 : 0);

//   function clearFilters() {
//     setQuery("");
//     setStatusFilter("all");
//     setMortgageFilter("all");
//     setFlagsFilter("all");
//   }

//   return (
//     <div className="lcPage">
//       <div className="lcTopBar" />

//       <div className="lcWrap">
//         {/* Header */}
//         <header className="lcHeader">
//           <div className="lcHeaderRow">
//             <div className="lcBrand">
//               <div className="lcLogoMark" aria-hidden="true">
//                 <Icon.Shield className="lcLogoIcon" />
//               </div>
//               <div className="lcBrandText">
//                 <div className="lcBrandName">RegistryGuard</div>
//                 <div className="lcBrandTag">Compliance &amp; Verification</div>
//               </div>
//             </div>

//             <div className="lcBadge">
//               <Icon.Scale className="lcBadgeIcon" />
//               <span>Legal Verification</span>
//             </div>
//           </div>

//           <h1 className="lcTitle">Legal Compliance Dashboard</h1>
//           <p className="lcSubtitle">
//             Every registered property — legally clean, verified, and enforceable
//           </p>
//         </header>

//         {/* KPI cards */}
//         <section className="lcKpiGrid">
//           {kpis.map((k, i) => (
//             <div key={i} className={`lcKpiCard lcKpiCard_${k.tone}`}>
//               <div className="lcKpiTop">
//                 <div className="lcKpiTopLeft">
//                   <span className={`lcKpiIconWrap lcKpiIconWrap_${k.tone}`}>{k.icon}</span>
//                   <span className="lcKpiLabel">{k.label}</span>
//                 </div>
//               </div>
//               <div className="lcKpiValueRow">
//                 <div className="lcKpiValue">{k.value}</div>
//                 {k.delta ? <div className="lcKpiDelta">{k.delta}</div> : null}
//               </div>
//               <div className="lcKpiSub">{k.sub}</div>
//             </div>
//           ))}
//         </section>

//         {/* Charts row */}
//         <section className="lcGrid2">
//           <div className="lcCard">
//             <div className="lcCardHeader">
//               <h3 className="lcCardTitle">Legal Status Overview</h3>
//             </div>

//             <div
//               className="lcCardBody lcChartBody"
//               ref={donutTip.containerRef}
//               onMouseMove={donutTip.move}
//               onMouseLeave={donutTip.hide}
//             >
//               <DonutChart
//                 data={statusBreakdown}
//                 centerLabel="Legal Status"
//                 onHover={handleDonutHover}
//               />
//               {donutTip.TooltipEl}
//             </div>
//           </div>

//           <div className="lcCard">
//             <div className="lcCardHeader">
//               <h3 className="lcCardTitle">Risk Flags Distribution</h3>
//               <p className="lcCardHint">Auto-generated alerts requiring attention</p>
//             </div>

//             <div
//               className="lcCardBody"
//               ref={barTip.containerRef}
//               onMouseMove={barTip.move}
//               onMouseLeave={barTip.hide}
//             >
//               <HorizontalBarChart items={riskFlags} maxX={600} onHover={handleBarHover} />
//               {barTip.TooltipEl}
//             </div>
//           </div>
//         </section>

//         {/* Table */}
//         <section className="lcCard lcTableCard">
//           <div className="lcCardHeader lcCardHeader_tools">
//             <div>
//               <h3 className="lcCardTitle">Property Verification Status</h3>
//               <p className="lcCardHint">Detailed lifecycle and compliance status per parcel</p>
//             </div>

//             {/* Search + Filter tools */}
//             <div className="lcTools">
//               <div className="lcSearch">
//                 <Icon.Search className="lcToolIcon" />
//                 <input
//                   className="lcSearchInput"
//                   value={query}
//                   onChange={(e) => setQuery(e.target.value)}
//                   placeholder="Search parcel, address, hash, flags..."
//                   aria-label="Search rows"
//                 />
//               </div>

//               <div className="lcSelect">
//                 <Icon.Filter className="lcToolIcon" />
//                 <select
//                   className="lcSelectEl"
//                   value={statusFilter}
//                   onChange={(e) => setStatusFilter(e.target.value)}
//                   aria-label="Filter by status"
//                 >
//                   <option value="all">All Status</option>
//                   <option value="verified">Verified</option>
//                   <option value="pending">Pending</option>
//                   <option value="disputed">Disputed</option>
//                   <option value="litigation">Litigation</option>
//                 </select>
//               </div>

//               <div className="lcSelect">
//                 <Icon.Filter className="lcToolIcon" />
//                 <select
//                   className="lcSelectEl"
//                   value={mortgageFilter}
//                   onChange={(e) => setMortgageFilter(e.target.value)}
//                   aria-label="Filter by mortgage"
//                 >
//                   <option value="all">All Mortgage</option>
//                   <option value="clear">Clear</option>
//                   <option value="active">Active</option>
//                   <option value="defaulted">Defaulted</option>
//                 </select>
//               </div>

//               <div className="lcSelect">
//                 <Icon.Filter className="lcToolIcon" />
//                 <select
//                   className="lcSelectEl"
//                   value={flagsFilter}
//                   onChange={(e) => setFlagsFilter(e.target.value)}
//                   aria-label="Filter by risk flags"
//                 >
//                   <option value="all">All Flags</option>
//                   <option value="any">Has Flags</option>
//                   <option value="none">No Flags</option>
//                 </select>
//               </div>

//               <button
//                 type="button"
//                 className="lcBtn"
//                 onClick={clearFilters}
//                 disabled={activeFiltersCount === 0}
//                 title="Clear filters"
//               >
//                 Clear
//                 {activeFiltersCount ? <span className="lcBtnBadge">{activeFiltersCount}</span> : null}
//               </button>
//             </div>
//           </div>

//           <div className="lcTableWrap">
//             <table className="lcTable">
//               <thead>
//                 <tr>
//                   <th>Parcel ID</th>
//                   <th>Address</th>
//                   <th>Status</th>
//                   <th>Zoning</th>
//                   <th>Environmental</th>
//                   <th>Occupancy</th>
//                   <th>Mortgage</th>
//                   <th>Blockchain Hash</th>
//                   <th>Risk Flags</th>
//                 </tr>
//               </thead>

//               <tbody>
//                 {filteredRows.length === 0 ? (
//                   <tr>
//                     <td colSpan={9}>
//                       <div className="lcEmpty">
//                         <div className="lcEmptyTitle">No results found</div>
//                         <div className="lcEmptySub">
//                           Try changing your search or filters.
//                         </div>
//                       </div>
//                     </td>
//                   </tr>
//                 ) : (
//                   filteredRows.map((r, idx) => (
//                     <tr key={idx}>
//                       <td className="lcMono lcParcel">{r.parcel}</td>
//                       <td>
//                         <div className="lcAddr">
//                           <div className="lcAddrLine1">{r.address.line1}</div>
//                           <div className="lcAddrLine2">{r.address.line2}</div>
//                         </div>
//                       </td>
//                       <td>
//                         <StatusPill kind={r.status.key} text={r.status.text} />
//                       </td>
//                       <td className="lcCenter">
//                         <CellCheck state={r.zoning} />
//                       </td>
//                       <td className="lcCenter">
//                         <CellCheck state={r.environmental} />
//                       </td>
//                       <td className="lcCenter">
//                         <CellCheck state={r.occupancy} />
//                       </td>
//                       <td>
//                         <StatusPill kind={`mort_${r.mortgage.key}`} text={r.mortgage.text} />
//                       </td>
//                       <td className="lcMono lcHash">
//                         <span className="lcHashRow">
//                           <Icon.Hash className="lcHashIcon" />
//                           {r.hash}
//                         </span>
//                       </td>
//                       <td>
//                         {r.flags.length === 0 ? (
//                           <span className="lcMuted">None</span>
//                         ) : (
//                           <div className="lcFlags">
//                             {r.flags.map((f, j) => (
//                               <span
//                                 key={j}
//                                 className={`lcFlag ${f === "+1" ? "lcFlag_more" : "lcFlag_bad"}`}
//                               >
//                                 {f === "+1" ? (
//                                   <>
//                                     <Icon.Plus className="lcPlusIcon" /> 1
//                                   </>
//                                 ) : (
//                                   f
//                                 )}
//                               </span>
//                             ))}
//                           </div>
//                         )}
//                       </td>
//                     </tr>
//                   ))
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </section>

//         {/* Blockchain Audit Trail */}
//         <section className="lcCard">
//           <div className="lcCardHeader">
//             <div className="lcCardTitleRow">
//               <h3 className="lcCardTitle">Blockchain Audit Trail</h3>
//             </div>
//           </div>

//           <div className="lcAuditGrid">
//             <div className="lcAuditCard">
//               <div className="lcAuditLabel">Total Properties on Chain</div>
//               <div className="lcAuditValue">{formatNumber(chainStats.totalProps)}</div>
//               <div className="lcAuditHint">{chainStats.totalPropsPct}% of total registry</div>

//               <div className="lcProgress">
//                 <div
//                   className="lcProgressFill"
//                   style={{ width: `${chainStats.totalPropsPct}%` }}
//                 />
//               </div>
//             </div>

//             <div className="lcAuditCard">
//               <div className="lcAuditLabel">Ownership Transfers Logged</div>
//               <div className="lcAuditValue">{formatNumber(chainStats.transfers)}</div>
//               <div className="lcAuditHint">Immutable audit trail</div>
//             </div>

//             <div className="lcAuditCard lcAuditCard_bad">
//               <div className="lcAuditLabel lcAuditLabel_bad">Tamper Attempts Detected</div>
//               <div className="lcAuditValue lcAuditValue_bad">{chainStats.tamper}</div>
//               <div className="lcAuditHint">All blocked &amp; reported</div>
//             </div>
//           </div>
//         </section>

//         <div className="lcFooterSpace" />

//         <footer className="lcFooter">
//           <div className="lcFooterInner">
//             <div className="lcFooterLeft">
//               <span className="lcFooterDot" />
//               <span className="lcFooterText">
//                 © {new Date().getFullYear()} RegistryGuard • Legal Compliance Dashboard
//               </span>
//             </div>
//             <div className="lcFooterRight">
//               <span className="lcFooterPill">
//                 <Icon.Shield className="lcFooterIcon" />
//                 Secured
//               </span>
//               <span className="lcFooterPill">
//                 <Icon.Scale className="lcFooterIcon" />
//                 Audited
//               </span>
//             </div>
//           </div>
//         </footer>
//       </div>
//     </div>
//   );
// }
