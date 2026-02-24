// Overview.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import "./Overview.css";
import { getDashboardStats, getRegionalData, getFraudStats } from "../../utils/api";

/** =========
 *  UNIQUE ROOT (do not change)
 *  ========= */
const ROOT_ID = "yro-registry-overview-v4";

/** =========
 *  CONSTANTS / REGIONS (Serbia)
 *  ========= */
const REGIONS = ["All Regions","Belgrade","Južna Bačka","Severna Bačka","Zapadna Bačka","Srednji Banat","Severni Banat","Južni Banat","Srem","Mačva","Kolubara","Podunavlje","Braničevo","Šumadija","Pomoravlje","Bor","Zaječar","Zlatibor","Moravica","Raška","Rasina","Nišava","Toplica","Pirot","Jablanica","Pčinja"];

const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];

const MAP_PINS = [
  { label: "Belgrade",      x: "50%", y: "45%", c: "BG" },
  { label: "Južna Bačka",   x: "47%", y: "18%", c: "JB" },
  { label: "Severna Bačka", x: "38%", y:  "9%", c: "SB" },
  { label: "Zapadna Bačka", x: "26%", y: "13%", c: "ZB" },
  { label: "Srednji Banat", x: "60%", y: "18%", c: "MB" },
  { label: "Severni Banat", x: "58%", y: "10%", c: "NB" },
  { label: "Južni Banat",   x: "65%", y: "28%", c: "SBa" },
  { label: "Srem",          x: "34%", y: "32%", c: "SR" },
  { label: "Mačva",         x: "24%", y: "44%", c: "MA" },
  { label: "Kolubara",      x: "33%", y: "51%", c: "KO" },
  { label: "Podunavlje",    x: "56%", y: "49%", c: "PO" },
  { label: "Braničevo",     x: "65%", y: "49%", c: "BR" },
  { label: "Šumadija",      x: "44%", y: "56%", c: "ŠU" },
  { label: "Pomoravlje",    x: "56%", y: "58%", c: "PM" },
  { label: "Bor",           x: "74%", y: "54%", c: "BO" },
  { label: "Zaječar",       x: "76%", y: "60%", c: "ZA" },
  { label: "Zlatibor",      x: "22%", y: "64%", c: "ZL" },
  { label: "Moravica",      x: "33%", y: "63%", c: "MO" },
  { label: "Raška",         x: "38%", y: "70%", c: "RA" },
  { label: "Rasina",        x: "52%", y: "65%", c: "RS" },
  { label: "Nišava",        x: "62%", y: "70%", c: "NI" },
  { label: "Toplica",       x: "54%", y: "74%", c: "TO" },
  { label: "Pirot",         x: "74%", y: "72%", c: "PI" },
  { label: "Jablanica",     x: "53%", y: "82%", c: "JA" },
  { label: "Pčinja",        x: "65%", y: "88%", c: "PČ" },
];

const TIME_RANGE_MAP = {
  "Last 7 days": "7days",
  "Last 30 days": "30days",
  "Last 90 days": "90days",
};

/** =========
 *  HELPERS
 *  ========= */
function hash01(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function formatDots(num) {
  if (num === null || num === undefined || num === "—") return "—";
  const s = Math.round(Number(num)).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
function series(seed, n, min, max, wobble = 0.25) {
  const base = hash01(seed);
  const out = [];
  let prev = min + (max - min) * base;
  for (let i = 0; i < n; i++) {
    const r = hash01(`${seed}|${i}`);
    const drift = (r - 0.5) * (max - min) * wobble;
    prev = clamp(prev + drift, min, max);
    out.push(prev);
  }
  return out;
}
function pathFromSeries(xs, ys, baselineY) {
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 1; i < xs.length; i++) d += ` L${xs[i]},${ys[i]}`;
  d += ` L${xs[xs.length - 1]},${baselineY} L${xs[0]},${baselineY} Z`;
  return d;
}
function polarToXY(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function donutArcPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const p1 = polarToXY(cx, cy, rOuter, startAngle);
  const p2 = polarToXY(cx, cy, rOuter, endAngle);
  const p3 = polarToXY(cx, cy, rInner, endAngle);
  const p4 = polarToXY(cx, cy, rInner, startAngle);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

/** =========
 *  ICONS
 *  ========= */
function Icon({ name }) {
  switch (name) {
    case "filter":
      return (
        <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
          <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
          <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16.5 16.5 21 21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "chev":
      return (
        <svg viewBox="0 0 24 24" className="yro-ic yro-ic--sm" aria-hidden="true">
          <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "cal":
      return (
        <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
          <path d="M7 3v3M17 3v3M4 8h16M6 11h4M6 15h4M12 11h6M12 15h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "warn":
      return (
        <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
          <path d="M12 3l10 18H2L12 3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 9v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="17" r="1" fill="currentColor" />
        </svg>
      );
    case "swap":
      return (
        <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
          <path d="M7 7h12l-3-3M17 17H5l3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "doc":
      return (
        <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
          <path d="M7 3h7l3 3v15H7V3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M14 3v4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9 11h6M9 15h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "pin":
      return (
        <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
          <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      );
    case "pulse":
      return (
        <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
          <path d="M3 12h4l2-5 4 10 2-5h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
          <path d="M12 3l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "check":
      return (
        <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8.2 12.2l2.3 2.4 5.4-5.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

/** =========
 *  UI PARTS
 *  ========= */
function StatCard({ title, value, delta, deltaType = "down", icon, iconTone = "amber", sub }) {
  return (
    <div className="yro-card yro-stat" tabIndex={0}>
      <div className="yro-stat__head">
        <div className="yro-stat__title">{title}</div>
        <div className={`yro-badgeIcon yro-badgeIcon--${iconTone}`}>
          <Icon name={icon} />
        </div>
      </div>
      <div className="yro-stat__value">{value}</div>
      {delta ? (
        <div className={`yro-stat__delta yro-stat__delta--${deltaType}`}>
          <span className="yro-deltaArrow">{deltaType === "up" ? "↗" : "↘"}</span>
          {delta} <span className="yro-muted">vs last month</span>
        </div>
      ) : (
        <div className="yro-stat__sub yro-muted">{sub || "Registered in system"}</div>
      )}
    </div>
  );
}

function MiniCard({ value, label, icon, tone = "teal" }) {
  return (
    <div className="yro-card yro-mini" tabIndex={0}>
      <div className={`yro-mini__ic yro-mini__ic--${tone}`}>
        <Icon name={icon} />
      </div>
      <div className="yro-mini__meta">
        <div className="yro-mini__value">{value}</div>
        <div className="yro-mini__label yro-muted">{label}</div>
      </div>
    </div>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="yro-tabs" role="tablist" aria-label="Heatmap Tabs">
      {tabs.map((t) => (
        <button key={t} className={`yro-tab ${t === active ? "is-active" : ""}`} type="button" onClick={() => onChange(t)}>
          {t}
        </button>
      ))}
    </div>
  );
}

function Select({ value, options, onChange, leftIcon }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="yro-selectWrap">
      <button className={`yro-select ${open ? "is-open" : ""}`} type="button" onClick={() => setOpen((v) => !v)} onBlur={() => setOpen(false)}>
        {leftIcon ? <span className="yro-select__left">{leftIcon}</span> : null}
        <span className="yro-select__value" title={value}>
          {value}
        </span>
        <Icon name="chev" />
      </button>

      {open ? (
        <div className="yro-menu" role="listbox">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`yro-menuItem ${opt === value ? "is-active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** =========
 *  HEATMAP
 *  ========= */
function Heatmap({ activeRegion, mode, intensityByRegion }) {
  const isAll = activeRegion === "All Regions";
  const legendTitle = mode === "Disputes" ? "Dispute Rate" : mode === "Transfers" ? "Transfer Load" : "Processing Load";

  return (
    <div className="yro-heatmap">
      <div className="yro-mapStage">
        <div className="yro-mapOutline" />
        <div className="yro-mapMode">{mode}</div>

        {MAP_PINS.map((p) => {
          const active = activeRegion === p.label;
          const dim = !isAll && !active;
          const intensity = intensityByRegion[p.label] ?? 0.3;
          const level = intensity < 0.34 ? "low" : intensity < 0.67 ? "med" : "high";

          return (
            <button
              key={p.label}
              type="button"
              className={`yro-pin ${active ? "is-active" : ""} ${dim ? "is-dim" : ""}`}
              style={{ left: p.x, top: p.y }}
              title={`${p.label} • ${legendTitle}: ${Math.round(intensity * 100)}%`}
            >
              <span className={`yro-pin__dot yro-pin__dot--${level}`}>{p.c}</span>
              <span className="yro-pin__label">{p.label}</span>
            </button>
          );
        })}

        <div className="yro-mapLegend">
          <div className="yro-mapLegend__title yro-muted">{legendTitle}</div>
          <div className="yro-mapLegend__row">
            <span className="yro-pill" title="Low">
              <span className="yro-pillDot yro-pillDot--low" /> Low
            </span>
            <span className="yro-pill" title="Medium">
              <span className="yro-pillDot yro-pillDot--med" /> Med
            </span>
            <span className="yro-pill" title="High">
              <span className="yro-pillDot yro-pillDot--high" /> High
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** =========
 *  DONUT (FIXED hover)
 *  ========= */
function DonutInteractive({ data, onHover, onLeave }) {
  const segments = useMemo(() => {
    if (!data) return [];
    const entries = [
      { k: "Ownership", v: data.Ownership, cls: "a" },
      { k: "Boundary", v: data.Boundary, cls: "b" },
      { k: "Inheritance", v: data.Inheritance, cls: "c" },
      { k: "Encumbrance", v: data.Encumbrance, cls: "d" },
    ];
    let start = 0;
    return entries.map((e) => {
      const end = start + (e.v / 100) * 360;
      const seg = { ...e, start, end };
      start = end;
      return seg;
    });
  }, [data]);

  const cx = 110;
  const cy = 110;
  const rOuter = 78;
  const rInner = 52;

  if (!data) return <div className="yro-donutWrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Loading...</div>;

  return (
    <div className="yro-donutWrap">
      <svg viewBox="0 0 220 220" className="yro-donut2" aria-hidden="true" onMouseLeave={onLeave}>
        <circle className="yro-donut2__bg" cx={cx} cy={cy} r={(rOuter + rInner) / 2} />
        {segments.map((s) => {
          const midR = (rOuter + rInner) / 2;
          const hit = donutArcPath(cx, cy, midR + 18, midR - 18, s.start, s.end);
          const vis = donutArcPath(cx, cy, rOuter, rInner, s.start, s.end);
          return (
            <g key={s.k}>
              <path className="yro-donut2__hit" d={hit} onMouseMove={(e) => onHover?.(e, `${s.k}: ${s.v}%`)} onMouseEnter={(e) => onHover?.(e, `${s.k}: ${s.v}%`)} />
              <path className={`yro-donut2__seg yro-donut2__seg--${s.cls}`} d={vis} onMouseMove={(e) => onHover?.(e, `${s.k}: ${s.v}%`)} onMouseEnter={(e) => onHover?.(e, `${s.k}: ${s.v}%`)} />
            </g>
          );
        })}
      </svg>

      <div className="yro-donutLabels">
        <div className="yro-donutLabel yro-muted">Ownership: {data.Ownership}%</div>
        <div className="yro-donutLabel yro-muted">Boundary: {data.Boundary}%</div>
        <div className="yro-donutLabel yro-muted">Inheritance: {data.Inheritance}%</div>
        <div className="yro-donutLabel yro-muted">Encumbrance: {data.Encumbrance}%</div>
      </div>

      <div className="yro-legendRow">
        <div className="yro-leg" title="Ownership"><span className="yro-dot yro-dot--a" /> Ownership</div>
        <div className="yro-leg" title="Inheritance"><span className="yro-dot yro-dot--c" /> Inheritance</div>
        <div className="yro-leg" title="Boundary"><span className="yro-dot yro-dot--b" /> Boundary</div>
        <div className="yro-leg" title="Encumbrance"><span className="yro-dot yro-dot--d" /> Encumbrance</div>
      </div>
    </div>
  );
}

/** =========
 *  CHARTS
 *  ========= */
function AreaChart({ seedKey, onHover, onLeave }) {
  const top = series(`${seedKey}|top`, 8, 70, 160, 0.22);
  const mid = series(`${seedKey}|mid`, 8, 120, 190, 0.22);
  const low = series(`${seedKey}|low`, 8, 170, 205, 0.18);

  for (let i = 0; i < 8; i++) {
    const t = top[i];
    const m = Math.max(mid[i], t + 25);
    const l = Math.max(low[i], m + 18);
    top[i] = t;
    mid[i] = m;
    low[i] = l;
  }

  const xs = Array.from({ length: 8 }).map((_, i) => 50 + i * 80);
  const baseline = 210;
  const labelY = 244;
  const vbH = 260;

  return (
    <div className="yro-chartMock">
      <svg viewBox={`0 0 700 ${vbH}`} className="yro-svgChart" aria-hidden="true" onMouseLeave={onLeave}>
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={i} x1="50" y1={30 + i * 30} x2="670" y2={30 + i * 30} className="yro-grid" />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={i} x1={50 + i * 80} y1="30" x2={50 + i * 80} y2="200" className="yro-grid" />
        ))}
        <path className="yro-area yro-area--top" d={pathFromSeries(xs, top, baseline)} />
        <path className="yro-area yro-area--mid" d={pathFromSeries(xs, mid, baseline)} />
        <path className="yro-area yro-area--low" d={pathFromSeries(xs, low, baseline)} />
        {MONTHS.map((m, i) => (
          <text key={m} x={50 + i * 80} y={labelY} className="yro-axisText yro-axisText--hover" textAnchor="middle" onMouseMove={(e) => onHover?.(e, `Month: ${m}`)}>
            {m}
          </text>
        ))}
        {["3200", "2400", "1600", "800", "0"].map((v, i) => (
          <text key={v} x="12" y={38 + i * 40} className="yro-axisText yro-axisText--hover" onMouseMove={(e) => onHover?.(e, `Scale: ${v}`)}>
            {v}
          </text>
        ))}
      </svg>
    </div>
  );
}

function HBarChart({ data, onHover, onLeave }) {
  const labels = ["Sale", "Inheritance", "Subdivision", "Donation"];
  const rawVals = labels.map((l) => (data ? (data[l] ?? 0) : 0));
  const maxVal = Math.max(...rawVals, 1);
  const max = 80;

  const rows = labels.map((label, idx) => ({
    label,
    val: rawVals[idx],
    y: 55 + idx * 35,
    w: (rawVals[idx] / maxVal) * 360,
  }));

  return (
    <div className="yro-chartMock">
      <svg viewBox="0 0 520 220" className="yro-svgChart" aria-hidden="true" onMouseLeave={onLeave}>
        <line x1="70" y1="190" x2="500" y2="190" className="yro-axis" />
        <line x1="70" y1="30" x2="70" y2="190" className="yro-axis" />
        {[0, 20, 40, 60, 80].map((t, i) => (
          <g key={t}>
            <line x1={70 + i * 86} y1="190" x2={70 + i * 86} y2="196" className="yro-tick" />
            <text x={70 + i * 86} y="212" className="yro-axisText yro-axisText--hover" textAnchor="middle" onMouseMove={(e) => onHover?.(e, `X: ${t}`)}>
              {t}
            </text>
          </g>
        ))}
        {rows.map((b) => (
          <g key={b.label} className="yro-rowHover">
            <text x="20" y={b.y + 10} className="yro-axisText yro-axisText--hover" onMouseMove={(e) => onHover?.(e, `${b.label}: ${b.val}`)}>
              {b.label}
            </text>
            <rect x="70" y={b.y - 4} width="430" height="30" rx="8" className="yro-rowHit" onMouseMove={(e) => onHover?.(e, `${b.label}: ${b.val}`)} />
            <rect x="70" y={b.y} width={b.w} height="22" rx="6" className="yro-bar" onMouseMove={(e) => onHover?.(e, `${b.label}: ${b.val}`)} />
          </g>
        ))}
      </svg>
    </div>
  );
}

function VBarChart({ data, onHover, onLeave }) {
  const vals = MONTHS.map((m, i) => (data ? (data[m] ?? Math.round(2 + hash01(`vbar|${m}|${i}`) * 14)) : Math.round(2 + hash01(`vbar|${m}|${i}`) * 14)));
  const max = 16;

  return (
    <div className="yro-chartMock">
      <svg viewBox="0 0 520 220" className="yro-svgChart" aria-hidden="true" onMouseLeave={onLeave}>
        <line x1="60" y1="190" x2="500" y2="190" className="yro-axis" />
        <line x1="60" y1="30" x2="60" y2="190" className="yro-axis" />
        {[0, 4, 8, 12, 16].map((t, i) => (
          <g key={t}>
            <line x1="54" y1={190 - i * 40} x2="60" y2={190 - i * 40} className="yro-tick" />
            <text x="34" y={194 - i * 40} className="yro-axisText yro-axisText--hover" textAnchor="end" onMouseMove={(e) => onHover?.(e, `Y: ${t}`)}>
              {t}
            </text>
            <line x1="60" y1={190 - i * 40} x2="500" y2={190 - i * 40} className="yro-grid" />
          </g>
        ))}
        {MONTHS.map((m, i) => {
          const v = vals[i];
          const h = (v / max) * 150;
          return (
            <g key={m} className="yro-colHover">
              <rect x={78 + i * 48} y="30" width="42" height="160" rx="10" className="yro-colHit" onMouseMove={(e) => onHover?.(e, `${m}: ${v}`)} />
              <rect x={85 + i * 48} y={190 - h} width="28" height={h} rx="6" className="yro-bar" onMouseMove={(e) => onHover?.(e, `${m}: ${v}`)} />
              <text x={99 + i * 48} y="212" className="yro-axisText yro-axisText--hover" textAnchor="middle" onMouseMove={(e) => onHover?.(e, `${m}: ${v}`)}>
                {m}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** =========
 *  MAIN
 *  ========= */
export default function Overview() {
  const [region, setRegion] = useState("All Regions");
  const [range, setRange] = useState("Last 30 days");
  const [search, setSearch] = useState("");
  const [heatMode, setHeatMode] = useState("Disputes");

  // API data
  const [statsData, setStatsData] = useState(null);
  const [regionalData, setRegionalData] = useState([]);
  const [fraudData, setFraudData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tooltip
  const [tip, setTip] = useState({ show: false, x: 0, y: 0, text: "", panel: "" });
  const panelRefs = {
    donut: useRef(null),
    monthly: useRef(null),
    hbar: useRef(null),
    vbar: useRef(null),
  };

  const showTip = (panel) => (e, text) => {
    const rootEl = panelRefs[panel]?.current;
    const rect = rootEl ? rootEl.getBoundingClientRect() : (e.currentTarget.ownerSVGElement || e.currentTarget).getBoundingClientRect();
    setTip({ show: true, x: e.clientX - rect.left, y: e.clientY - rect.top, text, panel });
  };
  const hideTip = () => setTip((t) => ({ ...t, show: false }));

  // Fetch from backend
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const apiRegion = region === "All Regions" ? "" : region;
    const apiTimeRange = TIME_RANGE_MAP[range] || "30days";

    Promise.all([
      getDashboardStats(apiRegion, apiTimeRange).catch(() => null),
      getRegionalData().catch(() => null),
      getFraudStats(apiRegion).catch(() => null),
    ]).then(([stats, regional, fraud]) => {
      if (cancelled) return;
      if (stats?.success) setStatsData(stats.data);
      if (regional?.success) setRegionalData(regional.data || []);
      if (fraud?.success) setFraudData(fraud.data);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [region, range]);

  // Build intensity map from backend regional data
  const intensityByRegion = useMemo(() => {
    const out = {};
    if (!regionalData.length) {
      for (const r of REGIONS.filter((x) => x !== "All Regions")) {
        const seed = `${heatMode}|${range}|${r}`;
        const base = hash01(seed);
        const modeBoost = heatMode === "Disputes" ? 0.12 : heatMode === "Transfers" ? 0.18 : 0.22;
        out[r] = clamp(base * 0.9 + modeBoost, 0.05, 0.98);
      }
      return out;
    }
    const maxDisputes = Math.max(...regionalData.map((r) => r.disputes || 0), 1);
    const maxTransfers = Math.max(...regionalData.map((r) => r.transfers || 0), 1);
    const maxParcels = Math.max(...regionalData.map((r) => r.parcels || 0), 1);

    for (const r of REGIONS.filter((x) => x !== "All Regions")) {
      const rd = regionalData.find((x) => x.region === r);
      if (!rd) { out[r] = 0.3; continue; }
      if (heatMode === "Disputes") out[r] = clamp(rd.disputes / maxDisputes, 0.05, 0.98);
      else if (heatMode === "Transfers") out[r] = clamp(rd.transfers / maxTransfers, 0.05, 0.98);
      else out[r] = clamp(rd.parcels / maxParcels, 0.05, 0.98);
    }
    return out;
  }, [regionalData, heatMode, range]);

  // Compute KPI values from API data
  const computed = useMemo(() => {
    if (!statsData) {
      return { disputes: "—", transfers: "—", mortgages: "—", totalParcels: "—", transactionsToday: "—", avgValidation: "—", nodes: "—", uptime: "—" };
    }
    return {
      disputes: formatDots(statsData.disputes?.active ?? 0),
      transfers: formatDots(statsData.transfers?.pending ?? 0),
      mortgages: formatDots(statsData.mortgages?.active ?? 0),
      totalParcels: formatDots(statsData.parcels?.total ?? 0),
      transactionsToday: formatDots(statsData.transfers?.total ?? 0),
      avgValidation: "2.1s",
      nodes: "24",
      uptime: "99.97%",
    };
  }, [statsData]);

  // Donut data from dispute stats
  const donutData = useMemo(() => {
    if (!statsData) return null;
    const total = Math.max(statsData.disputes?.total || 1, 1);
    const active = statsData.disputes?.active || 0;
    const inCourt = statsData.disputes?.inCourt || 0;
    const ownership = Math.max(Math.round((active / total) * 100), 1);
    const boundary = Math.max(Math.round(((total - active - inCourt) / total) * 50), 1);
    const inheritance = Math.max(Math.round((inCourt / total) * 100), 1);
    const encumbrance = Math.max(100 - ownership - boundary - inheritance, 1);
    return { Ownership: ownership, Boundary: boundary, Inheritance: inheritance, Encumbrance: encumbrance };
  }, [statsData]);

  // HBar data from regional aggregation
  const hbarData = useMemo(() => {
    if (!regionalData.length) return null;
    const total = regionalData.reduce((s, r) => s + (r.transfers || 0), 0);
    return {
      Sale: Math.round(total * 0.55),
      Inheritance: Math.round(total * 0.22),
      Subdivision: Math.round(total * 0.14),
      Donation: Math.round(total * 0.09),
    };
  }, [regionalData]);

  // Filtered records for search count
  // Build searchable region records from real API data
  const records = useMemo(() => {
    if (!regionalData.length) return [];
    return regionalData.map((rd) => ({
      id: rd.region,
      name: rd.region,
      region: rd.region,
      parcels: rd.parcels || 0,
      disputes: rd.disputes || 0,
      transfers: rd.transfers || 0,
    }));
  }, [regionalData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((rec) => {
      if (region !== "All Regions" && rec.region !== region) return false;
      if (!q) return true;
      return (
        rec.region.toLowerCase().includes(q) ||
        String(rec.parcels).includes(q) ||
        String(rec.disputes).includes(q) ||
        String(rec.transfers).includes(q)
      );
    });
  }, [records, region, search]);

  // VBar fraud data from backend
  const vbarFraudData = useMemo(() => {
    if (!fraudData?.monthly) return null;
    const out = {};
    for (const item of fraudData.monthly) {
      out[item.month] = item.count;
    }
    return out;
  }, [fraudData]);

  const seedKey = `${region}|${range}|${search.trim().toLowerCase()}|${heatMode}`;

  return (
    <div id={ROOT_ID} className="yro-page">
      <div className="yro-shell">
        <header className="yro-header">
          <div>
            <h1 className="yro-title">Registry Overview</h1>
            <div className="yro-subtitle yro-muted">Real-time land registry system monitoring</div>
          </div>
          <div className="yro-status" title="System status">
            <span className="yro-statusDot" />
            {loading ? "Loading..." : "System Online"}
          </div>
        </header>

        <section className="yro-card yro-filters">
          <div className="yro-filters__top">
            <div className="yro-filters__label">
              <Icon name="filter" /> <span>Filters</span>
            </div>
          </div>

          <div className="yro-filters__row">
            <div className="yro-input" title="Search by ID, name, or region">
              <Icon name="search" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID or name..." />
            </div>
            <Select value={region} options={REGIONS} onChange={setRegion} />
            <Select value={range} options={["Last 7 days", "Last 30 days", "Last 90 days"]} onChange={setRange} leftIcon={<Icon name="cal" />} />
          </div>

          <div className="yro-filters__bottom">
            <button
              className="yro-reset"
              type="button"
              onClick={() => {
                setSearch("");
                setRegion("All Regions");
                setRange("Last 30 days");
                setHeatMode("Disputes");
              }}
            >
              ✕ <span>Reset filters</span>
            </button>
            <div className="yro-results" title="Matching records">
              Showing <b>{filtered.length}</b> records
            </div>
          </div>
        </section>

        <section className="yro-grid4">
          <StatCard title="Active Disputes" value={computed.disputes} icon="warn" iconTone="amber" sub="Open dispute cases" />
          <StatCard title="Pending Transfers" value={computed.transfers} icon="swap" iconTone="blue" sub="Awaiting approval" />
          <StatCard title="Active Mortgages" value={computed.mortgages} icon="doc" iconTone="purple" sub="Registered in system" />
          <StatCard title="Total Parcels" value={computed.totalParcels} icon="pin" iconTone="amber" sub={region === "All Regions" ? "Registered in system" : `Registered in ${region}`} />
        </section>

        <section className="yro-grid4 yro-grid4--mini">
          <MiniCard value={computed.transactionsToday} label="Transactions Today" icon="pulse" tone="amber" />
          <MiniCard value={computed.avgValidation} label="Avg Validation" icon="clock" tone="teal" />
          <MiniCard value={computed.nodes} label="Active Nodes" icon="shield" tone="blue" />
          <MiniCard value={computed.uptime} label="System Uptime" icon="check" tone="purple" />
        </section>

        <section className="yro-grid2">
          <div className="yro-card yro-panel">
            <div className="yro-panel__head">
              <h2 className="yro-h2">Regional Heat Map</h2>
              <Tabs tabs={["Disputes", "Transfers", "Processing"]} active={heatMode} onChange={setHeatMode} />
            </div>
            <Heatmap activeRegion={region} mode={heatMode} intensityByRegion={intensityByRegion} />
          </div>

          <div ref={panelRefs.donut} className="yro-card yro-panel yro-panel--rel">
            <div className="yro-panel__head yro-panel__head--tight">
              <h2 className="yro-h2">Disputes by Type</h2>
            </div>
            <div className="yro-tooltipLayer yro-tooltipLayer--donut">
              {tip.show && tip.panel === "donut" ? (
                <div className="yro-tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }}>{tip.text}</div>
              ) : null}
            </div>
            <DonutInteractive data={donutData} onHover={showTip("donut")} onLeave={hideTip} />
          </div>
        </section>

        <section ref={panelRefs.monthly} className="yro-card yro-panel yro-panel--rel">
          <div className="yro-panel__head yro-panel__head--tight">
            <h2 className="yro-h2">Monthly Activity Trends</h2>
          </div>
          <div className="yro-tooltipLayer">
            {tip.show && tip.panel === "monthly" ? (
              <div className="yro-tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }}>{tip.text}</div>
            ) : null}
          </div>
          <AreaChart seedKey={`${seedKey}|monthly`} onHover={showTip("monthly")} onLeave={hideTip} />
        </section>

        <section className="yro-grid2 yro-grid2--bottom">
          <div ref={panelRefs.hbar} className="yro-card yro-panel yro-panel--rel">
            <div className="yro-panel__head yro-panel__head--tight">
              <h2 className="yro-h2">Transfers by Type</h2>
            </div>
            <div className="yro-tooltipLayer">
              {tip.show && tip.panel === "hbar" ? (
                <div className="yro-tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }}>{tip.text}</div>
              ) : null}
            </div>
            <HBarChart data={hbarData} onHover={showTip("hbar")} onLeave={hideTip} />
          </div>

          <div ref={panelRefs.vbar} className="yro-card yro-panel yro-panel--rel">
            <div className="yro-panel__head yro-panel__head--tight">
              <h2 className="yro-h2">Fraud Prevention</h2>
            </div>
            <div className="yro-tooltipLayer">
              {tip.show && tip.panel === "vbar" ? (
                <div className="yro-tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }}>{tip.text}</div>
              ) : null}
            </div>
            <VBarChart data={vbarFraudData} onHover={showTip("vbar")} onLeave={hideTip} />
          </div>
        </section>
      </div>
    </div>
  );
}

// // Overview.jsx
// import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
// import "./Overview.css";
// import { getDashboardStats, getRegionalData, getFraudStats } from "../../utils/api";

// /** =========
//  *  UNIQUE ROOT (do not change)
//  *  ========= */
// const ROOT_ID = "yro-registry-overview-v4";

// /** =========
//  *  CONSTANTS / REGIONS (Serbia)
//  *  ========= */
// const REGIONS = [
//   "All Regions",
//   "Vojvodina",
//   "Belgrade",
//   "Braničevo",
//   "Podunavlje",
//   "Nišava",
//   "Jablanica",
//   "Pčinja",
//   "Šumadija",
//   "Kolubara",
//   "Zlatibor",
// ];

// const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];

// const MAP_PINS = [
//   { label: "Vojvodina", x: "48%", y: "22%", c: "V" },
//   { label: "Belgrade", x: "47%", y: "46%", c: "B" },
//   { label: "Braničevo", x: "69%", y: "47%", c: "B" },
//   { label: "Podunavlje", x: "58%", y: "52%", c: "P" },
//   { label: "Nišava", x: "66%", y: "69%", c: "N" },
//   { label: "Jablanica", x: "53%", y: "83%", c: "J" },
//   { label: "Pčinja", x: "76%", y: "86%", c: "P" },
//   { label: "Šumadija", x: "39%", y: "59%", c: "Š" },
//   { label: "Kolubara", x: "26%", y: "56%", c: "K" },
//   { label: "Zlatibor", x: "18%", y: "66%", c: "Z" },
// ];

// const TIME_RANGE_MAP = {
//   "Last 7 days": "7days",
//   "Last 30 days": "30days",
//   "Last 90 days": "90days",
// };

// /** =========
//  *  HELPERS
//  *  ========= */
// function hash01(seedStr) {
//   let h = 2166136261;
//   for (let i = 0; i < seedStr.length; i++) {
//     h ^= seedStr.charCodeAt(i);
//     h = Math.imul(h, 16777619);
//   }
//   return (h >>> 0) / 2 ** 32;
// }
// function clamp(n, a, b) {
//   return Math.max(a, Math.min(b, n));
// }
// function formatDots(num) {
//   if (num === null || num === undefined || num === "—") return "—";
//   const s = Math.round(Number(num)).toString();
//   return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
// }
// function series(seed, n, min, max, wobble = 0.25) {
//   const base = hash01(seed);
//   const out = [];
//   let prev = min + (max - min) * base;
//   for (let i = 0; i < n; i++) {
//     const r = hash01(`${seed}|${i}`);
//     const drift = (r - 0.5) * (max - min) * wobble;
//     prev = clamp(prev + drift, min, max);
//     out.push(prev);
//   }
//   return out;
// }
// function pathFromSeries(xs, ys, baselineY) {
//   let d = `M${xs[0]},${ys[0]}`;
//   for (let i = 1; i < xs.length; i++) d += ` L${xs[i]},${ys[i]}`;
//   d += ` L${xs[xs.length - 1]},${baselineY} L${xs[0]},${baselineY} Z`;
//   return d;
// }
// function polarToXY(cx, cy, r, angleDeg) {
//   const rad = ((angleDeg - 90) * Math.PI) / 180;
//   return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
// }
// function donutArcPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
//   const largeArc = endAngle - startAngle > 180 ? 1 : 0;
//   const p1 = polarToXY(cx, cy, rOuter, startAngle);
//   const p2 = polarToXY(cx, cy, rOuter, endAngle);
//   const p3 = polarToXY(cx, cy, rInner, endAngle);
//   const p4 = polarToXY(cx, cy, rInner, startAngle);
//   return [
//     `M ${p1.x} ${p1.y}`,
//     `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
//     `L ${p3.x} ${p3.y}`,
//     `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
//     "Z",
//   ].join(" ");
// }

// /** =========
//  *  ICONS
//  *  ========= */
// function Icon({ name }) {
//   switch (name) {
//     case "filter":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
//         </svg>
//       );
//     case "search":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" fill="none" stroke="currentColor" strokeWidth="1.8" />
//           <path d="M16.5 16.5 21 21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
//         </svg>
//       );
//     case "chev":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic yro-ic--sm" aria-hidden="true">
//           <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
//         </svg>
//       );
//     case "cal":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M7 3v3M17 3v3M4 8h16M6 11h4M6 15h4M12 11h6M12 15h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
//           <path d="M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" />
//         </svg>
//       );
//     case "warn":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M12 3l10 18H2L12 3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
//           <path d="M12 9v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
//           <circle cx="12" cy="17" r="1" fill="currentColor" />
//         </svg>
//       );
//     case "swap":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M7 7h12l-3-3M17 17H5l3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
//         </svg>
//       );
//     case "doc":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M7 3h7l3 3v15H7V3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
//           <path d="M14 3v4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
//           <path d="M9 11h6M9 15h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
//         </svg>
//       );
//     case "pin":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" fill="none" stroke="currentColor" strokeWidth="1.8" />
//           <circle cx="12" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
//         </svg>
//       );
//     case "pulse":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M3 12h4l2-5 4 10 2-5h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
//         </svg>
//       );
//     case "clock":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
//           <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
//         </svg>
//       );
//     case "shield":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M12 3l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
//         </svg>
//       );
//     case "check":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
//           <path d="M8.2 12.2l2.3 2.4 5.4-5.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
//         </svg>
//       );
//     default:
//       return null;
//   }
// }

// /** =========
//  *  UI PARTS
//  *  ========= */
// function StatCard({ title, value, delta, deltaType = "down", icon, iconTone = "amber", sub }) {
//   return (
//     <div className="yro-card yro-stat" tabIndex={0}>
//       <div className="yro-stat__head">
//         <div className="yro-stat__title">{title}</div>
//         <div className={`yro-badgeIcon yro-badgeIcon--${iconTone}`}>
//           <Icon name={icon} />
//         </div>
//       </div>
//       <div className="yro-stat__value">{value}</div>
//       {delta ? (
//         <div className={`yro-stat__delta yro-stat__delta--${deltaType}`}>
//           <span className="yro-deltaArrow">{deltaType === "up" ? "↗" : "↘"}</span>
//           {delta} <span className="yro-muted">vs last month</span>
//         </div>
//       ) : (
//         <div className="yro-stat__sub yro-muted">{sub || "Registered in system"}</div>
//       )}
//     </div>
//   );
// }

// function MiniCard({ value, label, icon, tone = "teal" }) {
//   return (
//     <div className="yro-card yro-mini" tabIndex={0}>
//       <div className={`yro-mini__ic yro-mini__ic--${tone}`}>
//         <Icon name={icon} />
//       </div>
//       <div className="yro-mini__meta">
//         <div className="yro-mini__value">{value}</div>
//         <div className="yro-mini__label yro-muted">{label}</div>
//       </div>
//     </div>
//   );
// }

// function Tabs({ tabs, active, onChange }) {
//   return (
//     <div className="yro-tabs" role="tablist" aria-label="Heatmap Tabs">
//       {tabs.map((t) => (
//         <button key={t} className={`yro-tab ${t === active ? "is-active" : ""}`} type="button" onClick={() => onChange(t)}>
//           {t}
//         </button>
//       ))}
//     </div>
//   );
// }

// function Select({ value, options, onChange, leftIcon }) {
//   const [open, setOpen] = useState(false);
//   return (
//     <div className="yro-selectWrap">
//       <button className={`yro-select ${open ? "is-open" : ""}`} type="button" onClick={() => setOpen((v) => !v)} onBlur={() => setOpen(false)}>
//         {leftIcon ? <span className="yro-select__left">{leftIcon}</span> : null}
//         <span className="yro-select__value" title={value}>
//           {value}
//         </span>
//         <Icon name="chev" />
//       </button>

//       {open ? (
//         <div className="yro-menu" role="listbox">
//           {options.map((opt) => (
//             <button
//               key={opt}
//               type="button"
//               className={`yro-menuItem ${opt === value ? "is-active" : ""}`}
//               onMouseDown={(e) => e.preventDefault()}
//               onClick={() => {
//                 onChange(opt);
//                 setOpen(false);
//               }}
//             >
//               {opt}
//             </button>
//           ))}
//         </div>
//       ) : null}
//     </div>
//   );
// }

// /** =========
//  *  HEATMAP
//  *  ========= */
// function Heatmap({ activeRegion, mode, intensityByRegion }) {
//   const isAll = activeRegion === "All Regions";
//   const legendTitle = mode === "Disputes" ? "Dispute Rate" : mode === "Transfers" ? "Transfer Load" : "Processing Load";

//   return (
//     <div className="yro-heatmap">
//       <div className="yro-mapStage">
//         <div className="yro-mapOutline" />
//         <div className="yro-mapMode">{mode}</div>

//         {MAP_PINS.map((p) => {
//           const active = activeRegion === p.label;
//           const dim = !isAll && !active;
//           const intensity = intensityByRegion[p.label] ?? 0.3;
//           const level = intensity < 0.34 ? "low" : intensity < 0.67 ? "med" : "high";

//           return (
//             <button
//               key={p.label}
//               type="button"
//               className={`yro-pin ${active ? "is-active" : ""} ${dim ? "is-dim" : ""}`}
//               style={{ left: p.x, top: p.y }}
//               title={`${p.label} • ${legendTitle}: ${Math.round(intensity * 100)}%`}
//             >
//               <span className={`yro-pin__dot yro-pin__dot--${level}`}>{p.c}</span>
//               <span className="yro-pin__label">{p.label}</span>
//             </button>
//           );
//         })}

//         <div className="yro-mapLegend">
//           <div className="yro-mapLegend__title yro-muted">{legendTitle}</div>
//           <div className="yro-mapLegend__row">
//             <span className="yro-pill" title="Low">
//               <span className="yro-pillDot yro-pillDot--low" /> Low
//             </span>
//             <span className="yro-pill" title="Medium">
//               <span className="yro-pillDot yro-pillDot--med" /> Med
//             </span>
//             <span className="yro-pill" title="High">
//               <span className="yro-pillDot yro-pillDot--high" /> High
//             </span>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// /** =========
//  *  DONUT (FIXED hover)
//  *  ========= */
// function DonutInteractive({ data, onHover, onLeave }) {
//   const segments = useMemo(() => {
//     if (!data) return [];
//     const entries = [
//       { k: "Ownership", v: data.Ownership, cls: "a" },
//       { k: "Boundary", v: data.Boundary, cls: "b" },
//       { k: "Inheritance", v: data.Inheritance, cls: "c" },
//       { k: "Encumbrance", v: data.Encumbrance, cls: "d" },
//     ];
//     let start = 0;
//     return entries.map((e) => {
//       const end = start + (e.v / 100) * 360;
//       const seg = { ...e, start, end };
//       start = end;
//       return seg;
//     });
//   }, [data]);

//   const cx = 110;
//   const cy = 110;
//   const rOuter = 78;
//   const rInner = 52;

//   if (!data) return <div className="yro-donutWrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>Loading...</div>;

//   return (
//     <div className="yro-donutWrap">
//       <svg viewBox="0 0 220 220" className="yro-donut2" aria-hidden="true" onMouseLeave={onLeave}>
//         <circle className="yro-donut2__bg" cx={cx} cy={cy} r={(rOuter + rInner) / 2} />
//         {segments.map((s) => {
//           const midR = (rOuter + rInner) / 2;
//           const hit = donutArcPath(cx, cy, midR + 18, midR - 18, s.start, s.end);
//           const vis = donutArcPath(cx, cy, rOuter, rInner, s.start, s.end);
//           return (
//             <g key={s.k}>
//               <path className="yro-donut2__hit" d={hit} onMouseMove={(e) => onHover?.(e, `${s.k}: ${s.v}%`)} onMouseEnter={(e) => onHover?.(e, `${s.k}: ${s.v}%`)} />
//               <path className={`yro-donut2__seg yro-donut2__seg--${s.cls}`} d={vis} onMouseMove={(e) => onHover?.(e, `${s.k}: ${s.v}%`)} onMouseEnter={(e) => onHover?.(e, `${s.k}: ${s.v}%`)} />
//             </g>
//           );
//         })}
//       </svg>

//       <div className="yro-donutLabels">
//         <div className="yro-donutLabel yro-muted">Ownership: {data.Ownership}%</div>
//         <div className="yro-donutLabel yro-muted">Boundary: {data.Boundary}%</div>
//         <div className="yro-donutLabel yro-muted">Inheritance: {data.Inheritance}%</div>
//         <div className="yro-donutLabel yro-muted">Encumbrance: {data.Encumbrance}%</div>
//       </div>

//       <div className="yro-legendRow">
//         <div className="yro-leg" title="Ownership"><span className="yro-dot yro-dot--a" /> Ownership</div>
//         <div className="yro-leg" title="Inheritance"><span className="yro-dot yro-dot--c" /> Inheritance</div>
//         <div className="yro-leg" title="Boundary"><span className="yro-dot yro-dot--b" /> Boundary</div>
//         <div className="yro-leg" title="Encumbrance"><span className="yro-dot yro-dot--d" /> Encumbrance</div>
//       </div>
//     </div>
//   );
// }

// /** =========
//  *  CHARTS
//  *  ========= */
// function AreaChart({ seedKey, onHover, onLeave }) {
//   const top = series(`${seedKey}|top`, 8, 70, 160, 0.22);
//   const mid = series(`${seedKey}|mid`, 8, 120, 190, 0.22);
//   const low = series(`${seedKey}|low`, 8, 170, 205, 0.18);

//   for (let i = 0; i < 8; i++) {
//     const t = top[i];
//     const m = Math.max(mid[i], t + 25);
//     const l = Math.max(low[i], m + 18);
//     top[i] = t;
//     mid[i] = m;
//     low[i] = l;
//   }

//   const xs = Array.from({ length: 8 }).map((_, i) => 50 + i * 80);
//   const baseline = 210;
//   const labelY = 244;
//   const vbH = 260;

//   return (
//     <div className="yro-chartMock">
//       <svg viewBox={`0 0 700 ${vbH}`} className="yro-svgChart" aria-hidden="true" onMouseLeave={onLeave}>
//         {Array.from({ length: 6 }).map((_, i) => (
//           <line key={i} x1="50" y1={30 + i * 30} x2="670" y2={30 + i * 30} className="yro-grid" />
//         ))}
//         {Array.from({ length: 8 }).map((_, i) => (
//           <line key={i} x1={50 + i * 80} y1="30" x2={50 + i * 80} y2="200" className="yro-grid" />
//         ))}
//         <path className="yro-area yro-area--top" d={pathFromSeries(xs, top, baseline)} />
//         <path className="yro-area yro-area--mid" d={pathFromSeries(xs, mid, baseline)} />
//         <path className="yro-area yro-area--low" d={pathFromSeries(xs, low, baseline)} />
//         {MONTHS.map((m, i) => (
//           <text key={m} x={50 + i * 80} y={labelY} className="yro-axisText yro-axisText--hover" textAnchor="middle" onMouseMove={(e) => onHover?.(e, `Month: ${m}`)}>
//             {m}
//           </text>
//         ))}
//         {["3200", "2400", "1600", "800", "0"].map((v, i) => (
//           <text key={v} x="12" y={38 + i * 40} className="yro-axisText yro-axisText--hover" onMouseMove={(e) => onHover?.(e, `Scale: ${v}`)}>
//             {v}
//           </text>
//         ))}
//       </svg>
//     </div>
//   );
// }

// function HBarChart({ data, onHover, onLeave }) {
//   const labels = ["Sale", "Inheritance", "Subdivision", "Donation"];
//   const rawVals = labels.map((l) => (data ? (data[l] ?? 0) : 0));
//   const maxVal = Math.max(...rawVals, 1);
//   const max = 80;

//   const rows = labels.map((label, idx) => ({
//     label,
//     val: rawVals[idx],
//     y: 55 + idx * 35,
//     w: (rawVals[idx] / maxVal) * 360,
//   }));

//   return (
//     <div className="yro-chartMock">
//       <svg viewBox="0 0 520 220" className="yro-svgChart" aria-hidden="true" onMouseLeave={onLeave}>
//         <line x1="70" y1="190" x2="500" y2="190" className="yro-axis" />
//         <line x1="70" y1="30" x2="70" y2="190" className="yro-axis" />
//         {[0, 20, 40, 60, 80].map((t, i) => (
//           <g key={t}>
//             <line x1={70 + i * 86} y1="190" x2={70 + i * 86} y2="196" className="yro-tick" />
//             <text x={70 + i * 86} y="212" className="yro-axisText yro-axisText--hover" textAnchor="middle" onMouseMove={(e) => onHover?.(e, `X: ${t}`)}>
//               {t}
//             </text>
//           </g>
//         ))}
//         {rows.map((b) => (
//           <g key={b.label} className="yro-rowHover">
//             <text x="20" y={b.y + 10} className="yro-axisText yro-axisText--hover" onMouseMove={(e) => onHover?.(e, `${b.label}: ${b.val}`)}>
//               {b.label}
//             </text>
//             <rect x="70" y={b.y - 4} width="430" height="30" rx="8" className="yro-rowHit" onMouseMove={(e) => onHover?.(e, `${b.label}: ${b.val}`)} />
//             <rect x="70" y={b.y} width={b.w} height="22" rx="6" className="yro-bar" onMouseMove={(e) => onHover?.(e, `${b.label}: ${b.val}`)} />
//           </g>
//         ))}
//       </svg>
//     </div>
//   );
// }

// function VBarChart({ data, onHover, onLeave }) {
//   const vals = MONTHS.map((m, i) => (data ? (data[m] ?? Math.round(2 + hash01(`vbar|${m}|${i}`) * 14)) : Math.round(2 + hash01(`vbar|${m}|${i}`) * 14)));
//   const max = 16;

//   return (
//     <div className="yro-chartMock">
//       <svg viewBox="0 0 520 220" className="yro-svgChart" aria-hidden="true" onMouseLeave={onLeave}>
//         <line x1="60" y1="190" x2="500" y2="190" className="yro-axis" />
//         <line x1="60" y1="30" x2="60" y2="190" className="yro-axis" />
//         {[0, 4, 8, 12, 16].map((t, i) => (
//           <g key={t}>
//             <line x1="54" y1={190 - i * 40} x2="60" y2={190 - i * 40} className="yro-tick" />
//             <text x="34" y={194 - i * 40} className="yro-axisText yro-axisText--hover" textAnchor="end" onMouseMove={(e) => onHover?.(e, `Y: ${t}`)}>
//               {t}
//             </text>
//             <line x1="60" y1={190 - i * 40} x2="500" y2={190 - i * 40} className="yro-grid" />
//           </g>
//         ))}
//         {MONTHS.map((m, i) => {
//           const v = vals[i];
//           const h = (v / max) * 150;
//           return (
//             <g key={m} className="yro-colHover">
//               <rect x={78 + i * 48} y="30" width="42" height="160" rx="10" className="yro-colHit" onMouseMove={(e) => onHover?.(e, `${m}: ${v}`)} />
//               <rect x={85 + i * 48} y={190 - h} width="28" height={h} rx="6" className="yro-bar" onMouseMove={(e) => onHover?.(e, `${m}: ${v}`)} />
//               <text x={99 + i * 48} y="212" className="yro-axisText yro-axisText--hover" textAnchor="middle" onMouseMove={(e) => onHover?.(e, `${m}: ${v}`)}>
//                 {m}
//               </text>
//             </g>
//           );
//         })}
//       </svg>
//     </div>
//   );
// }

// /** =========
//  *  MAIN
//  *  ========= */
// export default function Overview() {
//   const [region, setRegion] = useState("All Regions");
//   const [range, setRange] = useState("Last 30 days");
//   const [search, setSearch] = useState("");
//   const [heatMode, setHeatMode] = useState("Disputes");

//   // API data
//   const [statsData, setStatsData] = useState(null);
//   const [regionalData, setRegionalData] = useState([]);
//   const [fraudData, setFraudData] = useState(null);
//   const [loading, setLoading] = useState(true);

//   // Tooltip
//   const [tip, setTip] = useState({ show: false, x: 0, y: 0, text: "", panel: "" });
//   const panelRefs = {
//     donut: useRef(null),
//     monthly: useRef(null),
//     hbar: useRef(null),
//     vbar: useRef(null),
//   };

//   const showTip = (panel) => (e, text) => {
//     const rootEl = panelRefs[panel]?.current;
//     const rect = rootEl ? rootEl.getBoundingClientRect() : (e.currentTarget.ownerSVGElement || e.currentTarget).getBoundingClientRect();
//     setTip({ show: true, x: e.clientX - rect.left, y: e.clientY - rect.top, text, panel });
//   };
//   const hideTip = () => setTip((t) => ({ ...t, show: false }));

//   // Fetch from backend
//   useEffect(() => {
//     let cancelled = false;
//     setLoading(true);
//     const apiRegion = region === "All Regions" ? "" : region;
//     const apiTimeRange = TIME_RANGE_MAP[range] || "30days";

//     Promise.all([
//       getDashboardStats(apiRegion, apiTimeRange).catch(() => null),
//       getRegionalData().catch(() => null),
//       getFraudStats(apiRegion).catch(() => null),
//     ]).then(([stats, regional, fraud]) => {
//       if (cancelled) return;
//       if (stats?.success) setStatsData(stats.data);
//       if (regional?.success) setRegionalData(regional.data || []);
//       if (fraud?.success) setFraudData(fraud.data);
//       setLoading(false);
//     });

//     return () => { cancelled = true; };
//   }, [region, range]);

//   // Build intensity map from backend regional data
//   const intensityByRegion = useMemo(() => {
//     const out = {};
//     if (!regionalData.length) {
//       for (const r of REGIONS.filter((x) => x !== "All Regions")) {
//         const seed = `${heatMode}|${range}|${r}`;
//         const base = hash01(seed);
//         const modeBoost = heatMode === "Disputes" ? 0.12 : heatMode === "Transfers" ? 0.18 : 0.22;
//         out[r] = clamp(base * 0.9 + modeBoost, 0.05, 0.98);
//       }
//       return out;
//     }
//     const maxDisputes = Math.max(...regionalData.map((r) => r.disputes || 0), 1);
//     const maxTransfers = Math.max(...regionalData.map((r) => r.transfers || 0), 1);
//     const maxParcels = Math.max(...regionalData.map((r) => r.parcels || 0), 1);

//     for (const r of REGIONS.filter((x) => x !== "All Regions")) {
//       const rd = regionalData.find((x) => x.region === r);
//       if (!rd) { out[r] = 0.3; continue; }
//       if (heatMode === "Disputes") out[r] = clamp(rd.disputes / maxDisputes, 0.05, 0.98);
//       else if (heatMode === "Transfers") out[r] = clamp(rd.transfers / maxTransfers, 0.05, 0.98);
//       else out[r] = clamp(rd.parcels / maxParcels, 0.05, 0.98);
//     }
//     return out;
//   }, [regionalData, heatMode, range]);

//   // Compute KPI values from API data
//   const computed = useMemo(() => {
//     if (!statsData) {
//       return { disputes: "—", transfers: "—", mortgages: "—", totalParcels: "—", transactionsToday: "—", avgValidation: "—", nodes: "—", uptime: "—" };
//     }
//     return {
//       disputes: formatDots(statsData.disputes?.active ?? 0),
//       transfers: formatDots(statsData.transfers?.pending ?? 0),
//       mortgages: formatDots(statsData.mortgages?.active ?? 0),
//       totalParcels: formatDots(statsData.parcels?.total ?? 0),
//       transactionsToday: formatDots(statsData.transfers?.total ?? 0),
//       avgValidation: "2.1s",
//       nodes: "24",
//       uptime: "99.97%",
//     };
//   }, [statsData]);

//   // Donut data from dispute stats
//   const donutData = useMemo(() => {
//     if (!statsData) return null;
//     const total = Math.max(statsData.disputes?.total || 1, 1);
//     const active = statsData.disputes?.active || 0;
//     const inCourt = statsData.disputes?.inCourt || 0;
//     const ownership = Math.max(Math.round((active / total) * 100), 1);
//     const boundary = Math.max(Math.round(((total - active - inCourt) / total) * 50), 1);
//     const inheritance = Math.max(Math.round((inCourt / total) * 100), 1);
//     const encumbrance = Math.max(100 - ownership - boundary - inheritance, 1);
//     return { Ownership: ownership, Boundary: boundary, Inheritance: inheritance, Encumbrance: encumbrance };
//   }, [statsData]);

//   // HBar data from regional aggregation
//   const hbarData = useMemo(() => {
//     if (!regionalData.length) return null;
//     const total = regionalData.reduce((s, r) => s + (r.transfers || 0), 0);
//     return {
//       Sale: Math.round(total * 0.55),
//       Inheritance: Math.round(total * 0.22),
//       Subdivision: Math.round(total * 0.14),
//       Donation: Math.round(total * 0.09),
//     };
//   }, [regionalData]);

//   // Filtered records for search count
//   const records = useMemo(() => {
//     if (!regionalData.length) return [];
//     const all = [];
//     for (const rd of regionalData) {
//       const r = rd.region;
//       for (let i = 1; i <= Math.min(rd.parcels || 0, 15); i++) {
//         all.push({ id: `${r.slice(0, 2).toUpperCase()}-${String(1000 + i).slice(-4)}`, name: `${r} Parcel ${i}`, region: r });
//       }
//     }
//     return all;
//   }, [regionalData]);

//   const filtered = useMemo(() => {
//     const q = search.trim().toLowerCase();
//     return records.filter((rec) => {
//       if (region !== "All Regions" && rec.region !== region) return false;
//       if (!q) return true;
//       return rec.id.toLowerCase().includes(q) || rec.name.toLowerCase().includes(q) || rec.region.toLowerCase().includes(q);
//     });
//   }, [records, region, search]);

//   // VBar fraud data from backend
//   const vbarFraudData = useMemo(() => {
//     if (!fraudData?.monthly) return null;
//     const out = {};
//     for (const item of fraudData.monthly) {
//       out[item.month] = item.count;
//     }
//     return out;
//   }, [fraudData]);

//   const seedKey = `${region}|${range}|${search.trim().toLowerCase()}|${heatMode}`;

//   return (
//     <div id={ROOT_ID} className="yro-page">
//       <div className="yro-shell">
//         <header className="yro-header">
//           <div>
//             <h1 className="yro-title">Registry Overview</h1>
//             <div className="yro-subtitle yro-muted">Real-time land registry system monitoring</div>
//           </div>
//           <div className="yro-status" title="System status">
//             <span className="yro-statusDot" />
//             {loading ? "Loading..." : "System Online"}
//           </div>
//         </header>

//         <section className="yro-card yro-filters">
//           <div className="yro-filters__top">
//             <div className="yro-filters__label">
//               <Icon name="filter" /> <span>Filters</span>
//             </div>
//           </div>

//           <div className="yro-filters__row">
//             <div className="yro-input" title="Search by ID, name, or region">
//               <Icon name="search" />
//               <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID or name..." />
//             </div>
//             <Select value={region} options={REGIONS} onChange={setRegion} />
//             <Select value={range} options={["Last 7 days", "Last 30 days", "Last 90 days"]} onChange={setRange} leftIcon={<Icon name="cal" />} />
//           </div>

//           <div className="yro-filters__bottom">
//             <button
//               className="yro-reset"
//               type="button"
//               onClick={() => {
//                 setSearch("");
//                 setRegion("All Regions");
//                 setRange("Last 30 days");
//                 setHeatMode("Disputes");
//               }}
//             >
//               ✕ <span>Reset filters</span>
//             </button>
//             <div className="yro-results" title="Matching records">
//               Showing <b>{filtered.length}</b> records
//             </div>
//           </div>
//         </section>

//         <section className="yro-grid4">
//           <StatCard title="Active Disputes" value={computed.disputes} icon="warn" iconTone="amber" sub="Open dispute cases" />
//           <StatCard title="Pending Transfers" value={computed.transfers} icon="swap" iconTone="blue" sub="Awaiting approval" />
//           <StatCard title="Active Mortgages" value={computed.mortgages} icon="doc" iconTone="purple" sub="Registered in system" />
//           <StatCard title="Total Parcels" value={computed.totalParcels} icon="pin" iconTone="amber" sub={region === "All Regions" ? "Registered in system" : `Registered in ${region}`} />
//         </section>

//         <section className="yro-grid4 yro-grid4--mini">
//           <MiniCard value={computed.transactionsToday} label="Transactions Today" icon="pulse" tone="amber" />
//           <MiniCard value={computed.avgValidation} label="Avg Validation" icon="clock" tone="teal" />
//           <MiniCard value={computed.nodes} label="Active Nodes" icon="shield" tone="blue" />
//           <MiniCard value={computed.uptime} label="System Uptime" icon="check" tone="purple" />
//         </section>

//         <section className="yro-grid2">
//           <div className="yro-card yro-panel">
//             <div className="yro-panel__head">
//               <h2 className="yro-h2">Regional Heat Map</h2>
//               <Tabs tabs={["Disputes", "Transfers", "Processing"]} active={heatMode} onChange={setHeatMode} />
//             </div>
//             <Heatmap activeRegion={region} mode={heatMode} intensityByRegion={intensityByRegion} />
//           </div>

//           <div ref={panelRefs.donut} className="yro-card yro-panel yro-panel--rel">
//             <div className="yro-panel__head yro-panel__head--tight">
//               <h2 className="yro-h2">Disputes by Type</h2>
//             </div>
//             <div className="yro-tooltipLayer yro-tooltipLayer--donut">
//               {tip.show && tip.panel === "donut" ? (
//                 <div className="yro-tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }}>{tip.text}</div>
//               ) : null}
//             </div>
//             <DonutInteractive data={donutData} onHover={showTip("donut")} onLeave={hideTip} />
//           </div>
//         </section>

//         <section ref={panelRefs.monthly} className="yro-card yro-panel yro-panel--rel">
//           <div className="yro-panel__head yro-panel__head--tight">
//             <h2 className="yro-h2">Monthly Activity Trends</h2>
//           </div>
//           <div className="yro-tooltipLayer">
//             {tip.show && tip.panel === "monthly" ? (
//               <div className="yro-tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }}>{tip.text}</div>
//             ) : null}
//           </div>
//           <AreaChart seedKey={`${seedKey}|monthly`} onHover={showTip("monthly")} onLeave={hideTip} />
//         </section>

//         <section className="yro-grid2 yro-grid2--bottom">
//           <div ref={panelRefs.hbar} className="yro-card yro-panel yro-panel--rel">
//             <div className="yro-panel__head yro-panel__head--tight">
//               <h2 className="yro-h2">Transfers by Type</h2>
//             </div>
//             <div className="yro-tooltipLayer">
//               {tip.show && tip.panel === "hbar" ? (
//                 <div className="yro-tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }}>{tip.text}</div>
//               ) : null}
//             </div>
//             <HBarChart data={hbarData} onHover={showTip("hbar")} onLeave={hideTip} />
//           </div>

//           <div ref={panelRefs.vbar} className="yro-card yro-panel yro-panel--rel">
//             <div className="yro-panel__head yro-panel__head--tight">
//               <h2 className="yro-h2">Fraud Prevention</h2>
//             </div>
//             <div className="yro-tooltipLayer">
//               {tip.show && tip.panel === "vbar" ? (
//                 <div className="yro-tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }}>{tip.text}</div>
//               ) : null}
//             </div>
//             <VBarChart data={vbarFraudData} onHover={showTip("vbar")} onLeave={hideTip} />
//           </div>
//         </section>
//       </div>
//     </div>
//   );
// }

// // Overview.jsx
// import React, { useMemo, useRef, useState } from "react";
// import "./Overview.css";

// /** =========
//  *  UNIQUE ROOT (do not change)
//  *  ========= */
// const ROOT_ID = "yro-registry-overview-v4";

// /** =========
//  *  CONSTANTS / REGIONS (Serbia)
//  *  ========= */
// const REGIONS = [
//   "All Regions",
//   "Vojvodina",
//   "Belgrade",
//   "Braničevo",
//   "Podunavlje",
//   "Nišava",
//   "Jablanica",
//   "Pčinja",
//   "Šumadija",
//   "Kolubara",
//   "Zlatibor",
// ];

// const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];

// const MAP_PINS = [
//   { label: "Vojvodina", x: "48%", y: "22%", c: "V" },
//   { label: "Belgrade", x: "47%", y: "46%", c: "B" },
//   { label: "Braničevo", x: "69%", y: "47%", c: "B" },
//   { label: "Podunavlje", x: "58%", y: "52%", c: "P" },
//   { label: "Nišava", x: "66%", y: "69%", c: "N" },
//   { label: "Jablanica", x: "53%", y: "83%", c: "J" },
//   { label: "Pčinja", x: "76%", y: "86%", c: "P" },
//   { label: "Šumadija", x: "39%", y: "59%", c: "Š" },
//   { label: "Kolubara", x: "26%", y: "56%", c: "K" },
//   { label: "Zlatibor", x: "18%", y: "66%", c: "Z" },
// ];

// /** =========
//  *  HELPERS
//  *  ========= */
// function hash01(seedStr) {
//   let h = 2166136261;
//   for (let i = 0; i < seedStr.length; i++) {
//     h ^= seedStr.charCodeAt(i);
//     h = Math.imul(h, 16777619);
//   }
//   return (h >>> 0) / 2 ** 32;
// }
// function clamp(n, a, b) {
//   return Math.max(a, Math.min(b, n));
// }
// function formatDots(num) {
//   const s = Math.round(num).toString();
//   return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
// }
// function series(seed, n, min, max, wobble = 0.25) {
//   const base = hash01(seed);
//   const out = [];
//   let prev = min + (max - min) * base;
//   for (let i = 0; i < n; i++) {
//     const r = hash01(`${seed}|${i}`);
//     const drift = (r - 0.5) * (max - min) * wobble;
//     prev = clamp(prev + drift, min, max);
//     out.push(prev);
//   }
//   return out;
// }
// function pathFromSeries(xs, ys, baselineY) {
//   let d = `M${xs[0]},${ys[0]}`;
//   for (let i = 1; i < xs.length; i++) d += ` L${xs[i]},${ys[i]}`;
//   d += ` L${xs[xs.length - 1]},${baselineY} L${xs[0]},${baselineY} Z`;
//   return d;
// }
// function polarToXY(cx, cy, r, angleDeg) {
//   const rad = ((angleDeg - 90) * Math.PI) / 180;
//   return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
// }
// function donutArcPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
//   const largeArc = endAngle - startAngle > 180 ? 1 : 0;
//   const p1 = polarToXY(cx, cy, rOuter, startAngle);
//   const p2 = polarToXY(cx, cy, rOuter, endAngle);
//   const p3 = polarToXY(cx, cy, rInner, endAngle);
//   const p4 = polarToXY(cx, cy, rInner, startAngle);
//   return [
//     `M ${p1.x} ${p1.y}`,
//     `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
//     `L ${p3.x} ${p3.y}`,
//     `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
//     "Z",
//   ].join(" ");
// }

// /** =========
//  *  ICONS
//  *  ========= */
// function Icon({ name }) {
//   switch (name) {
//     case "filter":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
//         </svg>
//       );
//     case "search":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" fill="none" stroke="currentColor" strokeWidth="1.8" />
//           <path d="M16.5 16.5 21 21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
//         </svg>
//       );
//     case "chev":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic yro-ic--sm" aria-hidden="true">
//           <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
//         </svg>
//       );
//     case "cal":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M7 3v3M17 3v3M4 8h16M6 11h4M6 15h4M12 11h6M12 15h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
//           <path d="M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" />
//         </svg>
//       );
//     case "warn":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M12 3l10 18H2L12 3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
//           <path d="M12 9v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
//           <circle cx="12" cy="17" r="1" fill="currentColor" />
//         </svg>
//       );
//     case "swap":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M7 7h12l-3-3M17 17H5l3 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
//         </svg>
//       );
//     case "doc":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M7 3h7l3 3v15H7V3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
//           <path d="M14 3v4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
//           <path d="M9 11h6M9 15h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
//         </svg>
//       );
//     case "pin":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" fill="none" stroke="currentColor" strokeWidth="1.8" />
//           <circle cx="12" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
//         </svg>
//       );
//     case "pulse":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M3 12h4l2-5 4 10 2-5h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
//         </svg>
//       );
//     case "clock":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
//           <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
//         </svg>
//       );
//     case "shield":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <path d="M12 3l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
//         </svg>
//       );
//     case "check":
//       return (
//         <svg viewBox="0 0 24 24" className="yro-ic" aria-hidden="true">
//           <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
//           <path d="M8.2 12.2l2.3 2.4 5.4-5.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
//         </svg>
//       );
//     default:
//       return null;
//   }
// }

// /** =========
//  *  UI PARTS
//  *  ========= */
// function StatCard({ title, value, delta, deltaType = "down", icon, iconTone = "amber", sub }) {
//   return (
//     <div className="yro-card yro-stat" tabIndex={0}>
//       <div className="yro-stat__head">
//         <div className="yro-stat__title">{title}</div>
//         <div className={`yro-badgeIcon yro-badgeIcon--${iconTone}`}>
//           <Icon name={icon} />
//         </div>
//       </div>
//       <div className="yro-stat__value">{value}</div>
//       {delta ? (
//         <div className={`yro-stat__delta yro-stat__delta--${deltaType}`}>
//           <span className="yro-deltaArrow">{deltaType === "up" ? "↗" : "↘"}</span>
//           {delta} <span className="yro-muted">vs last month</span>
//         </div>
//       ) : (
//         <div className="yro-stat__sub yro-muted">{sub || "Registered in system"}</div>
//       )}
//     </div>
//   );
// }

// function MiniCard({ value, label, icon, tone = "teal" }) {
//   return (
//     <div className="yro-card yro-mini" tabIndex={0}>
//       <div className={`yro-mini__ic yro-mini__ic--${tone}`}>
//         <Icon name={icon} />
//       </div>
//       <div className="yro-mini__meta">
//         <div className="yro-mini__value">{value}</div>
//         <div className="yro-mini__label yro-muted">{label}</div>
//       </div>
//     </div>
//   );
// }

// function Tabs({ tabs, active, onChange }) {
//   return (
//     <div className="yro-tabs" role="tablist" aria-label="Heatmap Tabs">
//       {tabs.map((t) => (
//         <button key={t} className={`yro-tab ${t === active ? "is-active" : ""}`} type="button" onClick={() => onChange(t)}>
//           {t}
//         </button>
//       ))}
//     </div>
//   );
// }

// function Select({ value, options, onChange, leftIcon }) {
//   const [open, setOpen] = useState(false);
//   return (
//     <div className="yro-selectWrap">
//       <button className={`yro-select ${open ? "is-open" : ""}`} type="button" onClick={() => setOpen((v) => !v)} onBlur={() => setOpen(false)}>
//         {leftIcon ? <span className="yro-select__left">{leftIcon}</span> : null}
//         <span className="yro-select__value" title={value}>
//           {value}
//         </span>
//         <Icon name="chev" />
//       </button>

//       {open ? (
//         <div className="yro-menu" role="listbox">
//           {options.map((opt) => (
//             <button
//               key={opt}
//               type="button"
//               className={`yro-menuItem ${opt === value ? "is-active" : ""}`}
//               onMouseDown={(e) => e.preventDefault()}
//               onClick={() => {
//                 onChange(opt);
//                 setOpen(false);
//               }}
//             >
//               {opt}
//             </button>
//           ))}
//         </div>
//       ) : null}
//     </div>
//   );
// }

// /** =========
//  *  HEATMAP
//  *  ========= */
// function Heatmap({ activeRegion, mode, intensityByRegion }) {
//   const isAll = activeRegion === "All Regions";
//   const legendTitle = mode === "Disputes" ? "Dispute Rate" : mode === "Transfers" ? "Transfer Load" : "Processing Load";

//   return (
//     <div className="yro-heatmap">
//       <div className="yro-mapStage">
//         <div className="yro-mapOutline" />
//         <div className="yro-mapMode">{mode}</div>

//         {MAP_PINS.map((p) => {
//           const active = activeRegion === p.label;
//           const dim = !isAll && !active;

//           const intensity = intensityByRegion[p.label] ?? 0.3;
//           const level = intensity < 0.34 ? "low" : intensity < 0.67 ? "med" : "high";

//           return (
//             <button
//               key={p.label}
//               type="button"
//               className={`yro-pin ${active ? "is-active" : ""} ${dim ? "is-dim" : ""}`}
//               style={{ left: p.x, top: p.y }}
//               title={`${p.label} • ${legendTitle}: ${Math.round(intensity * 100)}%`}
//             >
//               <span className={`yro-pin__dot yro-pin__dot--${level}`}>{p.c}</span>
//               <span className="yro-pin__label">{p.label}</span>
//             </button>
//           );
//         })}

//         <div className="yro-mapLegend">
//           <div className="yro-mapLegend__title yro-muted">{legendTitle}</div>
//           <div className="yro-mapLegend__row">
//             <span className="yro-pill" title="Low">
//               <span className="yro-pillDot yro-pillDot--low" /> Low
//             </span>
//             <span className="yro-pill" title="Medium">
//               <span className="yro-pillDot yro-pillDot--med" /> Med
//             </span>
//             <span className="yro-pill" title="High">
//               <span className="yro-pillDot yro-pillDot--high" /> High
//             </span>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// /** =========
//  *  DONUT (FIXED hover)
//  *  - Uses a BIG invisible ring hit-area per segment, so hover always triggers.
//  *  - Tooltip uses wrapper ref so it positions correctly even with different layouts.
//  *  ========= */
// function DonutInteractive({ seedKey, onHover, onLeave }) {
//   const raw = useMemo(() => {
//     const a = 20 + Math.round(hash01(seedKey + "|own") * 30);
//     const b = 15 + Math.round(hash01(seedKey + "|bound") * 25);
//     const c = 10 + Math.round(hash01(seedKey + "|inh") * 22);
//     const d = 8 + Math.round(hash01(seedKey + "|enc") * 18);
//     const sum = a + b + c + d;
//     const own = Math.round((a / sum) * 100);
//     const bou = Math.round((b / sum) * 100);
//     const inh = Math.round((c / sum) * 100);
//     const enc = Math.max(1, 100 - (own + bou + inh));
//     return { Ownership: own, Boundary: bou, Inheritance: inh, Encumbrance: enc };
//   }, [seedKey]);

//   const segments = useMemo(() => {
//     const entries = [
//       { k: "Ownership", v: raw.Ownership, cls: "a" },
//       { k: "Boundary", v: raw.Boundary, cls: "b" },
//       { k: "Inheritance", v: raw.Inheritance, cls: "c" },
//       { k: "Encumbrance", v: raw.Encumbrance, cls: "d" },
//     ];
//     let start = 0;
//     return entries.map((e) => {
//       const end = start + (e.v / 100) * 360;
//       const seg = { ...e, start, end };
//       start = end;
//       return seg;
//     });
//   }, [raw]);

//   const cx = 110;
//   const cy = 110;
//   const rOuter = 78;
//   const rInner = 52;

//   return (
//     <div className="yro-donutWrap">
//       <svg viewBox="0 0 220 220" className="yro-donut2" aria-hidden="true" onMouseLeave={onLeave}>
//         {/* background ring */}
//         <circle className="yro-donut2__bg" cx={cx} cy={cy} r={(rOuter + rInner) / 2} />

//         {segments.map((s) => {
//           const midR = (rOuter + rInner) / 2;
//           const hit = donutArcPath(cx, cy, midR + 18, midR - 18, s.start, s.end); // larger hit area
//           const vis = donutArcPath(cx, cy, rOuter, rInner, s.start, s.end);
//           return (
//             <g key={s.k}>
//               {/* invisible hit zone (bigger) */}
//               <path
//                 className="yro-donut2__hit"
//                 d={hit}
//                 onMouseMove={(e) => onHover?.(e, `${s.k}: ${s.v}%`)}
//                 onMouseEnter={(e) => onHover?.(e, `${s.k}: ${s.v}%`)}
//               />
//               {/* visible segment */}
//               <path
//                 className={`yro-donut2__seg yro-donut2__seg--${s.cls}`}
//                 d={vis}
//                 onMouseMove={(e) => onHover?.(e, `${s.k}: ${s.v}%`)}
//                 onMouseEnter={(e) => onHover?.(e, `${s.k}: ${s.v}%`)}
//               />
//             </g>
//           );
//         })}
//       </svg>

//       <div className="yro-donutLabels">
//         <div className="yro-donutLabel yro-muted">Ownership: {raw.Ownership}%</div>
//         <div className="yro-donutLabel yro-muted">Boundary: {raw.Boundary}%</div>
//         <div className="yro-donutLabel yro-muted">Inheritance: {raw.Inheritance}%</div>
//         <div className="yro-donutLabel yro-muted">Encumbrance: {raw.Encumbrance}%</div>
//       </div>

//       <div className="yro-legendRow">
//         <div className="yro-leg" title="Ownership">
//           <span className="yro-dot yro-dot--a" /> Ownership
//         </div>
//         <div className="yro-leg" title="Inheritance">
//           <span className="yro-dot yro-dot--c" /> Inheritance
//         </div>
//         <div className="yro-leg" title="Boundary">
//           <span className="yro-dot yro-dot--b" /> Boundary
//         </div>
//         <div className="yro-leg" title="Encumbrance">
//           <span className="yro-dot yro-dot--d" /> Encumbrance
//         </div>
//       </div>
//     </div>
//   );
// }

// /** =========
//  *  CHARTS (FIX: month labels not overlapping)
//  *  - Added extra bottom padding by increasing viewBox height + placing labels lower.
//  *  ========= */
// function AreaChart({ seedKey, onHover, onLeave }) {
//   const top = series(`${seedKey}|top`, 8, 70, 160, 0.22);
//   const mid = series(`${seedKey}|mid`, 8, 120, 190, 0.22);
//   const low = series(`${seedKey}|low`, 8, 170, 205, 0.18);

//   for (let i = 0; i < 8; i++) {
//     const t = top[i];
//     const m = Math.max(mid[i], t + 25);
//     const l = Math.max(low[i], m + 18);
//     top[i] = t;
//     mid[i] = m;
//     low[i] = l;
//   }

//   const xs = Array.from({ length: 8 }).map((_, i) => 50 + i * 80);
//   const baseline = 210; // keep chart baseline
//   const labelY = 244; // move labels down
//   const vbH = 260; // more room so labels don't collide/clip

//   return (
//     <div className="yro-chartMock">
//       <svg viewBox={`0 0 700 ${vbH}`} className="yro-svgChart" aria-hidden="true" onMouseLeave={onLeave}>
//         {Array.from({ length: 6 }).map((_, i) => (
//           <line key={i} x1="50" y1={30 + i * 30} x2="670" y2={30 + i * 30} className="yro-grid" />
//         ))}
//         {Array.from({ length: 8 }).map((_, i) => (
//           <line key={i} x1={50 + i * 80} y1="30" x2={50 + i * 80} y2="200" className="yro-grid" />
//         ))}

//         <path className="yro-area yro-area--top" d={pathFromSeries(xs, top, baseline)} />
//         <path className="yro-area yro-area--mid" d={pathFromSeries(xs, mid, baseline)} />
//         <path className="yro-area yro-area--low" d={pathFromSeries(xs, low, baseline)} />

//         {MONTHS.map((m, i) => (
//           <text
//             key={m}
//             x={50 + i * 80}
//             y={labelY}
//             className="yro-axisText yro-axisText--hover"
//             textAnchor="middle"
//             onMouseMove={(e) => onHover?.(e, `Month: ${m}`)}
//           >
//             {m}
//           </text>
//         ))}
//         {["3200", "2400", "1600", "800", "0"].map((v, i) => (
//           <text
//             key={v}
//             x="12"
//             y={38 + i * 40}
//             className="yro-axisText yro-axisText--hover"
//             onMouseMove={(e) => onHover?.(e, `Scale: ${v}`)}
//           >
//             {v}
//           </text>
//         ))}
//       </svg>
//     </div>
//   );
// }

// function HBarChart({ seedKey, onHover, onLeave }) {
//   const labels = ["Sale", "Inheritance", "Subdivision", "Donation"];
//   const vals = labels.map((l, i) => Math.round(5 + hash01(`${seedKey}|hbar|${l}|${i}`) * 75));
//   vals[0] = Math.max(vals[0], vals[1] + 25, vals[2] + 35, vals[3] + 45);

//   const max = 80;
//   const rows = labels.map((label, idx) => ({
//     label,
//     val: vals[idx],
//     y: 55 + idx * 35,
//     w: (vals[idx] / max) * 360,
//   }));

//   return (
//     <div className="yro-chartMock">
//       <svg viewBox="0 0 520 220" className="yro-svgChart" aria-hidden="true" onMouseLeave={onLeave}>
//         <line x1="70" y1="190" x2="500" y2="190" className="yro-axis" />
//         <line x1="70" y1="30" x2="70" y2="190" className="yro-axis" />

//         {[0, 20, 40, 60, 80].map((t, i) => (
//           <g key={t}>
//             <line x1={70 + i * 86} y1="190" x2={70 + i * 86} y2="196" className="yro-tick" />
//             <text
//               x={70 + i * 86}
//               y="212"
//               className="yro-axisText yro-axisText--hover"
//               textAnchor="middle"
//               onMouseMove={(e) => onHover?.(e, `X: ${t}`)}
//             >
//               {t}
//             </text>
//           </g>
//         ))}

//         {rows.map((b) => (
//           <g key={b.label} className="yro-rowHover">
//             <text x="20" y={b.y + 10} className="yro-axisText yro-axisText--hover" onMouseMove={(e) => onHover?.(e, `${b.label}: ${b.val}`)}>
//               {b.label}
//             </text>

//             <rect
//               x="70"
//               y={b.y - 4}
//               width="430"
//               height="30"
//               rx="8"
//               className="yro-rowHit"
//               onMouseMove={(e) => onHover?.(e, `${b.label}: ${b.val}`)}
//             />

//             <rect x="70" y={b.y} width={b.w} height="22" rx="6" className="yro-bar" onMouseMove={(e) => onHover?.(e, `${b.label}: ${b.val}`)} />
//           </g>
//         ))}
//       </svg>
//     </div>
//   );
// }

// function VBarChart({ seedKey, onHover, onLeave }) {
//   const vals = MONTHS.map((m, i) => Math.round(2 + hash01(`${seedKey}|vbar|${m}|${i}`) * 14));
//   const max = 16;

//   return (
//     <div className="yro-chartMock">
//       <svg viewBox="0 0 520 220" className="yro-svgChart" aria-hidden="true" onMouseLeave={onLeave}>
//         <line x1="60" y1="190" x2="500" y2="190" className="yro-axis" />
//         <line x1="60" y1="30" x2="60" y2="190" className="yro-axis" />

//         {[0, 4, 8, 12, 16].map((t, i) => (
//           <g key={t}>
//             <line x1="54" y1={190 - i * 40} x2="60" y2={190 - i * 40} className="yro-tick" />
//             <text x="34" y={194 - i * 40} className="yro-axisText yro-axisText--hover" textAnchor="end" onMouseMove={(e) => onHover?.(e, `Y: ${t}`)}>
//               {t}
//             </text>
//             <line x1="60" y1={190 - i * 40} x2="500" y2={190 - i * 40} className="yro-grid" />
//           </g>
//         ))}

//         {MONTHS.map((m, i) => {
//           const v = vals[i];
//           const h = (v / max) * 150;
//           return (
//             <g key={m} className="yro-colHover">
//               <rect x={78 + i * 48} y="30" width="42" height="160" rx="10" className="yro-colHit" onMouseMove={(e) => onHover?.(e, `${m}: ${v}`)} />
//               <rect x={85 + i * 48} y={190 - h} width="28" height={h} rx="6" className="yro-bar" onMouseMove={(e) => onHover?.(e, `${m}: ${v}`)} />
//               <text x={99 + i * 48} y="212" className="yro-axisText yro-axisText--hover" textAnchor="middle" onMouseMove={(e) => onHover?.(e, `${m}: ${v}`)}>
//                 {m}
//               </text>
//             </g>
//           );
//         })}
//       </svg>
//     </div>
//   );
// }

// /** =========
//  *  MAIN
//  *  ========= */
// export default function Overview() {
//   const [region, setRegion] = useState("All Regions");
//   const [range, setRange] = useState("Last 30 days");
//   const [search, setSearch] = useState("");
//   const [heatMode, setHeatMode] = useState("Disputes");

//   // Tooltip (panel-scoped): FIXED positioning by using panel ref
//   const [tip, setTip] = useState({ show: false, x: 0, y: 0, text: "", panel: "" });
//   const panelRefs = {
//     donut: useRef(null),
//     monthly: useRef(null),
//     hbar: useRef(null),
//     vbar: useRef(null),
//   };

//   const showTip = (panel) => (e, text) => {
//     const rootEl = panelRefs[panel]?.current;
//     const rect = rootEl ? rootEl.getBoundingClientRect() : (e.currentTarget.ownerSVGElement || e.currentTarget).getBoundingClientRect();
//     setTip({ show: true, x: e.clientX - rect.left, y: e.clientY - rect.top, text, panel });
//   };
//   const hideTip = () => setTip((t) => ({ ...t, show: false }));

//   // Records for search
//   const records = useMemo(() => {
//     const all = [];
//     for (const r of REGIONS.filter((x) => x !== "All Regions")) {
//       const base = hash01(r);
//       const count = 14 + Math.floor(base * 20);
//       for (let i = 1; i <= count; i++) {
//         const n = hash01(`${r}-${i}`);
//         const id = `${r.slice(0, 2).toUpperCase()}-${String(1000 + i).slice(-4)}`;
//         const name = `${r} Parcel ${i}`;
//         all.push({
//           id,
//           name,
//           region: r,
//           dispute: n > 0.78,
//           transfer: n > 0.60 && n <= 0.78,
//           mortgage: n > 0.22 && n <= 0.60,
//         });
//       }
//     }
//     return all;
//   }, []);

//   const filtered = useMemo(() => {
//     const q = search.trim().toLowerCase();
//     return records.filter((rec) => {
//       if (region !== "All Regions" && rec.region !== region) return false;
//       if (!q) return true;
//       return rec.id.toLowerCase().includes(q) || rec.name.toLowerCase().includes(q) || rec.region.toLowerCase().includes(q);
//     });
//   }, [records, region, search]);

//   const intensityByRegion = useMemo(() => {
//     const out = {};
//     for (const r of REGIONS.filter((x) => x !== "All Regions")) {
//       const seed = `${heatMode}|${range}|${search.trim().toLowerCase()}|${r}`;
//       const base = hash01(seed);
//       const modeBoost = heatMode === "Disputes" ? 0.12 : heatMode === "Transfers" ? 0.18 : 0.22;
//       out[r] = clamp(base * 0.9 + modeBoost, 0.05, 0.98);
//     }
//     return out;
//   }, [heatMode, range, search]);

//   const computed = useMemo(() => {
//     const seedKey = `${region}|${range}|${search.trim().toLowerCase()}|${heatMode}`;
//     const s = hash01(seedKey);

//     const disputes = filtered.filter((x) => x.dispute).length + Math.round(s * 6);
//     const transfers = filtered.filter((x) => x.transfer).length + Math.round(hash01(seedKey + "|t") * 7);
//     const mortgages = filtered.filter((x) => x.mortgage).length + Math.round(hash01(seedKey + "|m") * 10);

//     const totalParcelsBase = 1758000;
//     const regionFactor = region === "All Regions" ? 1 : clamp(0.07 + hash01(region) * 0.23, 0.08, 0.30);
//     const totalParcels = region === "All Regions" ? totalParcelsBase : Math.round(totalParcelsBase * regionFactor);

//     const transactionsToday = Math.round(clamp(filtered.length * (10 + s * 28), 220, 3200));
//     const avgValidation = (1.7 + s * 2.2).toFixed(1) + "s";
//     const nodes = region === "All Regions" ? 24 : Math.round(6 + hash01(region + "|nodes") * 12);
//     const uptime = (99.90 + s * 0.09).toFixed(2) + "%";

//     const deltaDisputes = (3.5 + hash01(seedKey + "|d") * 10).toFixed(1) + "%";
//     const deltaTransfers = (4.0 + hash01(seedKey + "|tr") * 14).toFixed(1) + "%";
//     const deltaMort = (2.0 + hash01(seedKey + "|mo") * 8).toFixed(1) + "%";

//     return {
//       disputes,
//       transfers,
//       mortgages,
//       totalParcels,
//       transactionsToday,
//       avgValidation,
//       nodes,
//       uptime,
//       deltaDisputes,
//       deltaTransfers,
//       deltaMort,
//       seedKey,
//     };
//   }, [filtered, region, range, search, heatMode]);

//   const seedMonthly = `${computed.seedKey}|monthly`;
//   const seedTransfersType = `${computed.seedKey}|transferTypes`;
//   const seedFraud = `${computed.seedKey}|fraud`;
//   const seedDonut = `${computed.seedKey}|donut`;

//   return (
//     <div id={ROOT_ID} className="yro-page">
//       <div className="yro-shell">
//         <header className="yro-header">
//           <div>
//             <h1 className="yro-title">Registry Overview</h1>
//             <div className="yro-subtitle yro-muted">Real-time land registry system monitoring</div>
//           </div>
//           <div className="yro-status" title="System status">
//             <span className="yro-statusDot" />
//             System Online
//           </div>
//         </header>

//         <section className="yro-card yro-filters">
//           <div className="yro-filters__top">
//             <div className="yro-filters__label">
//               <Icon name="filter" /> <span>Filters</span>
//             </div>
//           </div>

//           <div className="yro-filters__row">
//             <div className="yro-input" title="Search by ID, name, or region">
//               <Icon name="search" />
//               <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID or name..." />
//             </div>

//             <Select value={region} options={REGIONS} onChange={setRegion} />
//             <Select value={range} options={["Last 7 days", "Last 30 days", "Last 90 days"]} onChange={setRange} leftIcon={<Icon name="cal" />} />
//           </div>

//           <div className="yro-filters__bottom">
//             <button
//               className="yro-reset"
//               type="button"
//               onClick={() => {
//                 setSearch("");
//                 setRegion("All Regions");
//                 setRange("Last 30 days");
//                 setHeatMode("Disputes");
//               }}
//             >
//               ✕ <span>Reset filters</span>
//             </button>

//             <div className="yro-results" title="Matching records">
//               Showing <b>{filtered.length}</b> records
//             </div>
//           </div>
//         </section>

//         <section className="yro-grid4">
//           <StatCard title="Active Disputes" value={formatDots(computed.disputes)} delta={computed.deltaDisputes} deltaType="down" icon="warn" iconTone="amber" />
//           <StatCard title="Pending Transfers" value={formatDots(computed.transfers)} delta={computed.deltaTransfers} deltaType="up" icon="swap" iconTone="blue" />
//           <StatCard title="Active Mortgages" value={formatDots(computed.mortgages)} delta={computed.deltaMort} deltaType="up" icon="doc" iconTone="purple" />
//           <StatCard title="Total Parcels" value={formatDots(computed.totalParcels)} icon="pin" iconTone="amber" sub={region === "All Regions" ? "Registered in system" : `Registered in ${region}`} />
//         </section>

//         <section className="yro-grid4 yro-grid4--mini">
//           <MiniCard value={formatDots(computed.transactionsToday)} label="Transactions Today" icon="pulse" tone="amber" />
//           <MiniCard value={computed.avgValidation} label="Avg Validation" icon="clock" tone="teal" />
//           <MiniCard value={String(computed.nodes)} label="Active Nodes" icon="shield" tone="blue" />
//           <MiniCard value={computed.uptime} label="System Uptime" icon="check" tone="purple" />
//         </section>

//         <section className="yro-grid2">
//           <div className="yro-card yro-panel">
//             <div className="yro-panel__head">
//               <h2 className="yro-h2">Regional Heat Map</h2>
//               <Tabs tabs={["Disputes", "Transfers", "Processing"]} active={heatMode} onChange={setHeatMode} />
//             </div>
//             <Heatmap activeRegion={region} mode={heatMode} intensityByRegion={intensityByRegion} />
//           </div>

//           <div ref={panelRefs.donut} className="yro-card yro-panel yro-panel--rel">
//             <div className="yro-panel__head yro-panel__head--tight">
//               <h2 className="yro-h2">Disputes by Type</h2>
//             </div>

//             <div className="yro-tooltipLayer yro-tooltipLayer--donut">
//               {tip.show && tip.panel === "donut" ? (
//                 <div className="yro-tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }}>
//                   {tip.text}
//                 </div>
//               ) : null}
//             </div>

//             <DonutInteractive seedKey={seedDonut} onHover={showTip("donut")} onLeave={hideTip} />
//           </div>
//         </section>

//         <section ref={panelRefs.monthly} className="yro-card yro-panel yro-panel--rel">
//           <div className="yro-panel__head yro-panel__head--tight">
//             <h2 className="yro-h2">Monthly Activity Trends</h2>
//           </div>

//           <div className="yro-tooltipLayer">
//             {tip.show && tip.panel === "monthly" ? (
//               <div className="yro-tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }}>
//                 {tip.text}
//               </div>
//             ) : null}
//           </div>

//           <AreaChart seedKey={seedMonthly} onHover={showTip("monthly")} onLeave={hideTip} />
//         </section>

//         <section className="yro-grid2 yro-grid2--bottom">
//           <div ref={panelRefs.hbar} className="yro-card yro-panel yro-panel--rel">
//             <div className="yro-panel__head yro-panel__head--tight">
//               <h2 className="yro-h2">Transfers by Type</h2>
//             </div>

//             <div className="yro-tooltipLayer">
//               {tip.show && tip.panel === "hbar" ? (
//                 <div className="yro-tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }}>
//                   {tip.text}
//                 </div>
//               ) : null}
//             </div>

//             <HBarChart seedKey={seedTransfersType} onHover={showTip("hbar")} onLeave={hideTip} />
//           </div>

//           <div ref={panelRefs.vbar} className="yro-card yro-panel yro-panel--rel">
//             <div className="yro-panel__head yro-panel__head--tight">
//               <h2 className="yro-h2">Fraud Prevention</h2>
//             </div>

//             <div className="yro-tooltipLayer">
//               {tip.show && tip.panel === "vbar" ? (
//                 <div className="yro-tooltip" style={{ left: tip.x + 12, top: tip.y + 12 }}>
//                   {tip.text}
//                 </div>
//               ) : null}
//             </div>

//             <VBarChart seedKey={seedFraud} onHover={showTip("vbar")} onLeave={hideTip} />
//           </div>
//         </section>
//       </div>
//     </div>
//   );
// }
