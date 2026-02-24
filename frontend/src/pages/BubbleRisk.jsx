// BubbleRisk.jsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import "./BubbleRisk.css";
import { getBubbleRiskData, getRegionalData, getTransfers, getMortgages } from "../utils/api";

/* -----------------------------
   Icons (unique)
------------------------------ */
const BrxIcon = {
  TrendUp: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path
        d="M3 17l7-7 4 4 7-7M14 7h7v7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Home: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path
        d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Percent: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path
        d="M19 5 5 19M7.5 7.5h.01M16.5 16.5h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="7.5" cy="7.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle
        cx="16.5"
        cy="16.5"
        r="2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  ),
  Building: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path
        d="M4 21V3h10v18M20 21V9h-6M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Spark: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path
        d="M13 2 3 14h8l-1 8 11-14h-8l0-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Target: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path
        d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Zm0-6a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Search: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm6.2-1.8L21 20.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Filter: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
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

/* -----------------------------
   Utils
------------------------------ */
function brxClamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function brxPct(n) {
  return `${n.toFixed(1)}%`;
}

/* -----------------------------
   Tooltip hook (no blinking)
------------------------------ */
function useBrxTooltip() {
  const [tip, setTip] = useState({ show: false, x: 0, y: 0, title: "", value: "" });
  const wrapRef = useRef(null);

  const getXY = (e) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0, rect: null };
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return {
      rect,
      x: brxClamp(x, 14, rect.width - 14),
      y: brxClamp(y, 14, rect.height - 14),
    };
  };

  const show = (e, title, value) => {
    if (!e) return;
    const { x, y } = getXY(e);
    setTip({ show: true, x, y, title, value });
  };

  const move = (e) => {
    setTip((t) => {
      if (!t.show) return t;
      const { rect, x, y } = getXY(e);
      if (!rect) return t;
      if (Math.abs(t.x - x) < 0.5 && Math.abs(t.y - y) < 0.5) return t;
      return { ...t, x, y };
    });
  };

  const hide = () => setTip((t) => ({ ...t, show: false }));

  const TooltipEl = (
    <div className={`brxTip ${tip.show ? "brxTip_show" : ""}`} style={{ left: tip.x, top: tip.y }}>
      <div className="brxTipTitle">{tip.title}</div>
      <div className="brxTipValue">{tip.value}</div>
    </div>
  );

  return { wrapRef, TooltipEl, show, move, hide };
}

/* -----------------------------
   Line chart (SVG)
------------------------------ */
function BrxLineChart({ labels, series, yMin = 0, yMax = 20, onPointEnter, onPointLeave }) {
  const W = 860;
  const H = 380;
  const padL = 58;
  const padR = 24;
  const padT = 24;
  const padB = 70;

  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xFor = (i) => padL + (innerW * i) / (labels.length - 1);
  const yFor = (v) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const yTicks = [0, 5, 10, 15, 20].filter((t) => t >= yMin && t <= yMax);

  const pathFor = (values) =>
    values.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ");

  const legendY = H - 38;
  const monthY = H - 18;

  return (
    <div className="brxChartWrap">
      <svg className="brxChartSvg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bubble chart">
        {/* y grid */}
        {yTicks.map((t, idx) => {
          const y = yFor(t);
          return (
            <g key={idx}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} className="brxGridLine" />
              <text x={padL - 10} y={y + 4} textAnchor="end" className="brxAxisTick">
                {t}%
              </text>
            </g>
          );
        })}

        {/* x labels (months) */}
        {labels.map((lab, i) => (
          <text key={i} x={xFor(i)} y={monthY} textAnchor="middle" className="brxAxisTickX">
            {lab}
          </text>
        ))}

        {/* series lines & points */}
        {series.map((s, si) => (
          <g key={si}>
            <path d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth="3" />
            {s.values.map((v, i) => (
              <circle
                key={i}
                cx={xFor(i)}
                cy={yFor(v)}
                r="5"
                fill={s.color}
                className="brxPoint"
                tabIndex={0}
                onMouseEnter={(e) => onPointEnter?.(e, `${labels[i]} — ${s.label}`, brxPct(v))}
                onMouseMove={(e) => onPointEnter?.(e, `${labels[i]} — ${s.label}`, brxPct(v))}
                onMouseLeave={onPointLeave}
                onFocus={(e) => onPointEnter?.(e, `${labels[i]} — ${s.label}`, brxPct(v))}
                onBlur={onPointLeave}
              />
            ))}
          </g>
        ))}

        {/* legend */}
        <g className="brxLegend" transform={`translate(0, ${legendY})`}>
          {series.map((s, i) => (
            <g key={i} transform={`translate(${padL + i * 170}, 0)`}>
              <circle cx="0" cy="0" r="4" fill={s.color} />
              <text x="10" y="4" className="brxLegendText">
                {s.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

/* -----------------------------
   Small components
------------------------------ */
function BrxKpi({ tone, icon, title, value, sub, chip }) {
  return (
    <div className={`brxKpi brxKpi_${tone}`}>
      <div className="brxKpiTop">
        <span className="brxKpiIcon">{icon}</span>
        <span className="brxKpiTitle">{title}</span>
      </div>
      <div className="brxKpiValue">{value}</div>
      <div className="brxKpiSub">
        <span>{sub}</span>
        {chip ? <span className={`brxKpiChip brxKpiChip_${tone}`}>{chip}</span> : null}
      </div>
    </div>
  );
}

function BrxProgress({ label, value, tone }) {
  return (
    <div className="brxProg">
      <div className="brxProgTop">
        <span className="brxProgLabel">{label}</span>
        <span className={`brxProgValue brxProgValue_${tone}`}>{value}/100</span>
      </div>
      <div className="brxProgTrack">
        <div className={`brxProgFill brxProgFill_${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function BrxStress({ tone, title, value, sub }) {
  return (
    <div className={`brxStress brxStress_${tone}`}>
      <div className="brxStressTitle">{title}</div>
      <div className="brxStressValue">{value}</div>
      <div className="brxStressSub">{sub}</div>
    </div>
  );
}

function BrxRiskPill({ tone, text }) {
  return <span className={`brxPill brxPill_${tone}`}>{text}</span>;
}

function BrxMiniBar({ value }) {
  return (
    <div className="brxMiniBar" aria-hidden="true">
      <div className="brxMiniBarFill" style={{ width: `${value}%` }} />
    </div>
  );
}

/* -----------------------------
   Page
------------------------------ */
export default function BubbleRisk() {
  const tip = useBrxTooltip();

  // ── API State ──────────────────────────────────────────────
  const [bubbleData,   setBubbleData]   = useState(null);
  const [regionalData, setRegionalData] = useState([]);
  const [transferData, setTransferData] = useState(null);
  const [mortgageData, setMortgageData] = useState(null);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      getBubbleRiskData(),
      getRegionalData(),
      getTransfers({ limit: 1 }),   // just for pagination totals
      getMortgages({ limit: 1 }),
    ]).then(([bubRes, regRes, trfRes, mtgRes]) => {
      if (bubRes.status === "fulfilled") setBubbleData(bubRes.value?.data ?? null);
      if (regRes.status === "fulfilled") setRegionalData(regRes.value?.data ?? []);
      if (trfRes.status === "fulfilled") setTransferData(trfRes.value ?? null);
      if (mtgRes.status === "fulfilled") setMortgageData(mtgRes.value ?? null);
    }).finally(() => setLoading(false));
  }, []);

  // ── Top controls ───────────────────────────────────────────
  const [query,  setQuery]  = useState("");
  const [status, setStatus] = useState("all");

  // ── Core metrics from bubble-risk API ─────────────────────
  const riskScore    = bubbleData?.riskScore           ?? 68;
  const priceGrowth  = bubbleData?.currentPriceGrowth  ?? 18.4;
  const incomeGrowth = bubbleData?.currentIncomeGrowth ?? 4.4;
  const growthGap    = bubbleData?.growthGap           ?? 14.0;
  const riskLevel    = bubbleData?.interpretation?.riskLevel ?? "Moderate Risk";
  const divergence   = incomeGrowth > 0
    ? parseFloat((priceGrowth / incomeGrowth).toFixed(1))
    : 4.2;

  // ── Monthly trend chart data ───────────────────────────────
  const monthlyTrends = bubbleData?.monthlyTrends ?? [];
  const labels = monthlyTrends.length > 0
    ? monthlyTrends.map((m) => m.month)
    : ["Jul 23","Aug 23","Sep 23","Oct 23","Nov 23","Dec 23","Jan 24","Feb 24","Apr 24"];
  const series = [
    {
      label:  "Price Growth %",
      color:  "var(--brx-red)",
      values: monthlyTrends.length > 0
        ? monthlyTrends.map((m) => m.priceGrowth)
        : [8.2, 9.1, 10.4, 11.8, 13.2, 14.6, 15.9, 16.3, 18.4],
    },
    {
      label:  "Income Growth %",
      color:  "var(--brx-green)",
      values: monthlyTrends.length > 0
        ? monthlyTrends.map((m) => m.incomeGrowth)
        : [3.6, 3.8, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6],
    },
  ];

  // ── KPI cards ──────────────────────────────────────────────
  const kpis = [
    {
      tone:  divergence >= 3 ? "danger" : "warn",
      icon:  <BrxIcon.TrendUp className="brxSvgIcon" />,
      title: "Price vs Income Divergence",
      value: `${divergence}x`,
      sub:   ">3x = Warning",
    },
    {
      tone:  priceGrowth > 15 ? "danger" : "warn",
      icon:  <BrxIcon.Home className="brxSvgIcon" />,
      title: "Avg Price Growth (YoY)",
      value: `${priceGrowth}%`,
      sub:   `vs ${incomeGrowth}% income growth`,
    },
    {
      tone:  growthGap > 10 ? "danger" : "warn",
      icon:  <BrxIcon.Percent className="brxSvgIcon" />,
      title: "Growth Gap",
      value: `${growthGap.toFixed(1)}%`,
      sub:   ">10% = Elevated speculation",
    },
    {
      tone:  riskScore > 70 ? "danger" : riskScore > 50 ? "warn" : "neutral",
      icon:  <BrxIcon.Building className="brxSvgIcon" />,
      title: "Overall Risk Score",
      value: `${riskScore}/100`,
      sub:   riskLevel,
      chip:  bubbleData?.trend === "increasing" ? "↑ Rising" : null,
    },
  ];

  // ── AI Forecast from riskScore ────────────────────────────
  const ai_tables = {
    six:             Math.min(100, Math.round(riskScore * 0.92)),
    twelve:          Math.min(100, Math.round(riskScore * 1.09)),
    correctionProb:  riskScore > 70 ? 55 : riskScore > 50 ? 42 : 22,
    liquidityStress: riskScore > 70 ? 48 : riskScore > 50 ? 35 : 18,
  };

  // ── Stress signals: derived from transfer + mortgage data ──
  const totalTransfers = transferData?.pagination?.total ?? 0;
  const totalMortgages = mortgageData?.pagination?.total ?? 0;

  const stressSignals = [
    {
      tone:  priceGrowth > 15 ? "danger" : "warn",
      title: "Rapid price appreciation (YoY)",
      value: `${priceGrowth}%`,
      sub:   `vs ${incomeGrowth}% income — gap: ${growthGap.toFixed(1)}%`,
    },
    {
      tone:  totalMortgages > 1000 ? "danger" : "warn",
      title: "Active mortgage registrations",
      value: totalMortgages > 0 ? totalMortgages.toLocaleString() : "8,920",
      sub:   "Debt-backed purchase activity",
    },
    {
      tone:  totalTransfers > 500 ? "warn" : "neutral",
      title: "Property transfers registered",
      value: totalTransfers > 0 ? totalTransfers.toLocaleString() : "3,456",
      sub:   "Total active transfer records",
    },
    {
      tone:  growthGap > 10 ? "danger" : "warn",
      title: "Price-income divergence trend",
      value: bubbleData?.trend === "increasing" ? "↑ Increasing" : "→ Stable",
      sub:   bubbleData?.interpretation?.concerns ?? "Monitor closely",
    },
    {
      tone:  riskScore > 70 ? "danger" : "warn",
      title: "Overall bubble risk",
      value: `${riskScore}/100`,
      sub:   bubbleData?.interpretation?.recommendation ?? "Monitor closely",
    },
  ];

  // ── City-level risk from /api/dashboard/regional-data ─────
  // regionalData shape: [{ region, parcels, value, verified, disputes, verificationRate }]
  const cities = useMemo(() => {
    if (regionalData.length === 0) {
      return [
        { city: "Belgrade",      risk: 78, price: "+18.4%", income: "+4.2%", div: "4.4x", status: "high"   },
        { city: "Južna Bačka",   risk: 72, price: "+22.1%", income: "+5.1%", div: "4.3x", status: "high"   },
        { city: "Nišava",        risk: 45, price: "+8.2%",  income: "+4.8%", div: "1.7x", status: "medium" },
        { city: "Šumadija",      risk: 38, price: "+6.5%",  income: "+3.9%", div: "1.7x", status: "low"    },
        { city: "Severna Bačka", risk: 52, price: "+12.4%", income: "+4.5%", div: "2.8x", status: "medium" },
        { city: "Južni Banat",   risk: 61, price: "+15.8%", income: "+5.2%", div: "3.0x", status: "medium" },
        { city: "Srem",          risk: 44, price: "+9.1%",  income: "+4.0%", div: "2.3x", status: "medium" },
        { city: "Raška",         risk: 36, price: "+5.8%",  income: "+3.5%", div: "1.7x", status: "low"    },
        { city: "Zlatibor",      risk: 33, price: "+5.2%",  income: "+3.2%", div: "1.6x", status: "low"    },
        { city: "Moravica",      risk: 35, price: "+5.5%",  income: "+3.4%", div: "1.6x", status: "low"    },
        { city: "Rasina",        risk: 30, price: "+4.9%",  income: "+3.1%", div: "1.6x", status: "low"    },
        { city: "Mačva",         risk: 28, price: "+4.5%",  income: "+3.0%", div: "1.5x", status: "low"    },
        { city: "Pomoravlje",    risk: 32, price: "+5.1%",  income: "+3.2%", div: "1.6x", status: "low"    },
        { city: "Jablanica",     risk: 29, price: "+4.6%",  income: "+3.0%", div: "1.5x", status: "low"    },
        { city: "Kolubara",      risk: 27, price: "+4.3%",  income: "+2.9%", div: "1.5x", status: "low"    },
        { city: "Braničevo",     risk: 31, price: "+5.0%",  income: "+3.1%", div: "1.6x", status: "low"    },
        { city: "Podunavlje",    risk: 40, price: "+7.2%",  income: "+3.8%", div: "1.9x", status: "low"    },
        { city: "Zapadna Bačka", risk: 35, price: "+5.7%",  income: "+3.4%", div: "1.7x", status: "low"    },
        { city: "Srednji Banat", risk: 37, price: "+6.1%",  income: "+3.6%", div: "1.7x", status: "low"    },
        { city: "Severni Banat", risk: 34, price: "+5.4%",  income: "+3.3%", div: "1.6x", status: "low"    },
        { city: "Toplica",       risk: 25, price: "+4.0%",  income: "+2.8%", div: "1.4x", status: "low"    },
        { city: "Pčinja",        risk: 26, price: "+4.2%",  income: "+2.9%", div: "1.5x", status: "low"    },
        { city: "Bor",           risk: 28, price: "+4.5%",  income: "+3.0%", div: "1.5x", status: "low"    },
        { city: "Zaječar",       risk: 24, price: "+3.8%",  income: "+2.7%", div: "1.4x", status: "low"    },
        { city: "Pirot",         risk: 22, price: "+3.5%",  income: "+2.6%", div: "1.3x", status: "low"    },
      ];
    }
    return regionalData.map((r) => {
      // Derive risk score: higher disputes + lower verification = higher risk
      const disputeRatio = r.parcels > 0 ? r.disputes / r.parcels : 0;
      const verifRate    = parseFloat(r.verificationRate ?? 0);
      const regionRisk   = Math.min(100, Math.round(
        (disputeRatio * 5000) + ((100 - verifRate) * 0.6) + (riskScore * 0.3)
      ));
      const regionDiv    = parseFloat((priceGrowth / incomeGrowth).toFixed(1));
      const riskStatus   = regionRisk > 65 ? "high" : regionRisk > 45 ? "medium" : "low";

      return {
        city:   r.region,
        risk:   regionRisk,
        price:  `+${priceGrowth}%`,
        income: `+${incomeGrowth}%`,
        div:    `${regionDiv}x`,
        status: riskStatus,
      };
    });
  }, [regionalData, riskScore, priceGrowth, incomeGrowth]);

  const actions = [
    {
      title:    bubbleData?.interpretation?.recommendation ?? "Tighten LTV norms in overheated regions",
      priority: "High",
    },
    { title: "Freeze subsidies in overheated zones",               priority: "High"   },
    { title: "Increase registration scrutiny for repeat buyers",   priority: "High"   },
    { title: "Monitor foreign investment inflows",                 priority: "Medium" },
  ];

  const filteredCities = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cities.filter((r) => {
      const matchText =
        !q ||
        r.city.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        r.div.toLowerCase().includes(q);
      const matchStatus = status === "all" ? true : r.status === status;
      return matchText && matchStatus;
    });
  }, [cities, query, status]);

  const onPointEnter = (e, title, value) => tip.show(e, title, value);
  const onPointLeave = () => tip.hide();

  return (
    <div id="brxBubbleRisk" className="brxPage">
      <div className="brxTopLine" />

      <div className="brxWrap">
        <header className="brxHeader">
          <div className="brxHeaderTop">
            <div className="brxBadge">
              <BrxIcon.TrendUp className="brxBadgeIcon" />
              <span>Market Surveillance</span>
            </div>

            <div className="brxControls" role="search">
              <div className="brxSearch">
                <BrxIcon.Search className="brxCtrlIcon" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="brxInput"
                  placeholder="Search city, status, divergence…"
                  aria-label="Search"
                />
                {query ? (
                  <button className="brxClearBtn" type="button" onClick={() => setQuery("")} aria-label="Clear search">
                    ×
                  </button>
                ) : null}
              </div>

              <div className="brxFilter">
                <BrxIcon.Filter className="brxCtrlIcon" />
                <select
                  className="brxSelect"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="all">All</option>
                  <option value="high">High risk</option>
                  <option value="medium">Medium risk</option>
                  <option value="low">Low risk</option>
                </select>
              </div>
            </div>
          </div>

          <h1 className="brxTitle">Bubble Protection Dashboard</h1>
          <p className="brxSub">Detect speculative bubbles before they become financial crises</p>
        </header>

        <section className="brxKpiGrid">
          {kpis.map((k, i) => (
            <BrxKpi key={i} {...k} />
          ))}
        </section>

        <section className="brxMainGrid">
          <div className="brxCard">
            <div className="brxCardHead">
              <h3 className="brxCardTitle">Price vs Income Growth Divergence</h3>
              <p className="brxCardHint">Growing gap indicates bubble formation</p>
            </div>

            <div
              className="brxCardBody brxChartBody"
              ref={tip.wrapRef}
              onMouseMove={tip.move}
              onMouseLeave={tip.hide}
            >
              <BrxLineChart
                labels={labels}
                series={series}
                yMin={0}
                yMax={20}
                onPointEnter={onPointEnter}
                onPointLeave={onPointLeave}
              />
              {tip.TooltipEl}
            </div>
          </div>

          <div className="brxCard">
            <div className="brxCardHead">
              <div className="brxCardHeadRow">
                <h3 className="brxCardTitle">AI Forecast Panel</h3>
                <span className="brxAiIcon">
                  <BrxIcon.Target className="brxSvgIcon" />
                </span>
              </div>
            </div>

            <div className="brxCardBody">
              <BrxProgress label="6-Month Risk Score" value={ai_tables.six} tone="warn" />
              <div className="brxDivider" />
              <BrxProgress label="12-Month Risk Score" value={ai_tables.twelve} tone="danger" />
              <div className="brxDivider" />

              <div className="brxAiChips">
                <div className="brxAiChip brxAiChip_danger">
                  <div className="brxAiChipValue">{ai_tables.correctionProb}%</div>
                  <div className="brxAiChipLabel">Correction Probability</div>
                </div>
                <div className="brxAiChip brxAiChip_warn">
                  <div className="brxAiChipValue">{ai_tables.liquidityStress}%</div>
                  <div className="brxAiChipLabel">Liquidity Stress</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="brxCard brxMt">
          <div className="brxCardHead">
            <div className="brxCardHeadRow">
              <h3 className="brxCardTitle">Market Stress Signals</h3>
              <span className="brxWarnDot" aria-hidden="true">
                !
              </span>
            </div>
          </div>

          <div className="brxStressGrid">
            {stressSignals.map((s, i) => (
              <BrxStress key={i} {...s} />
            ))}
          </div>
        </section>

        <section className="brxCard brxMt">
          <div className="brxCardHead">
            <div className="brxCardHeadRow">
              <h3 className="brxCardTitle">City-Level Bubble Risk Assessment</h3>

              <div className="brxTableMeta">
                <span className="brxCount">
                  Showing <b>{filteredCities.length}</b> / {cities.length}
                </span>
              </div>
            </div>
          </div>

          <div className="brxTableWrap">
            <table className="brxTable">
              <thead>
                <tr>
                  <th>City</th>
                  <th>Risk Score</th>
                  <th>Price Growth</th>
                  <th>Income Growth</th>
                  <th>Divergence</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredCities.map((r, i) => (
                  <tr key={i}>
                    <td className="brxCity">{r.city}</td>
                    <td>
                      <div className="brxRiskCell">
                        <BrxMiniBar value={r.risk} />
                        <span className="brxRiskNum">{r.risk}</span>
                      </div>
                    </td>
                    <td className="brxNeg">{r.price}</td>
                    <td className="brxPos">{r.income}</td>
                    <td className="brxDiv">{r.div}</td>
                    <td>
                      {r.status === "high" ? (
                        <BrxRiskPill tone="high" text="high risk" />
                      ) : r.status === "medium" ? (
                        <BrxRiskPill tone="med" text="medium risk" />
                      ) : (
                        <BrxRiskPill tone="low" text="low risk" />
                      )}
                    </td>
                  </tr>
                ))}

                {filteredCities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="brxEmpty">
                      No results found. Try a different search or filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="brxCard brxMt">
          <div className="brxCardHead">
            <div className="brxCardHeadRow">
              <h3 className="brxCardTitle">Recommended Regulator Actions</h3>
              <span className="brxSpark">
                <BrxIcon.Spark className="brxSvgIcon" />
              </span>
            </div>
            <p className="brxCardHint">AI-generated policy recommendations based on current indicators</p>
          </div>

          <div className="brxActionsGrid">
            {actions.map((a, i) => (
              <div key={i} className="brxActionCard">
                <span className="brxActionDot" aria-hidden="true" />
                <div>
                  <div className="brxActionTitle">{a.title}</div>
                  <div className="brxActionMeta">Priority: {a.priority}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="brxBtns">
            <button className="brxBtn brxBtn_primary" type="button">
              Generate Detailed Report
            </button>
            <button className="brxBtn brxBtn_secondary" type="button">
              Schedule Review Meeting
            </button>
          </div>
        </section>

        <div className="brxSpacer" />
      </div>
    </div>
  );
}

// // BubbleRisk.jsx
// import React, { useMemo, useRef, useState, useEffect } from "react";
// import "./BubbleRisk.css";
// import { getBubbleRiskData, getRegionalData, getTransfers, getMortgages } from "../utils/api";

// /* -----------------------------
//    Icons (unique)
// ------------------------------ */
// const BrxIcon = {
//   TrendUp: (p) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
//       <path
//         d="M3 17l7-7 4 4 7-7M14 7h7v7"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Home: (p) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
//       <path
//         d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5Z"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Percent: (p) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
//       <path
//         d="M19 5 5 19M7.5 7.5h.01M16.5 16.5h.01"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//       />
//       <circle cx="7.5" cy="7.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
//       <circle
//         cx="16.5"
//         cy="16.5"
//         r="2.2"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//       />
//     </svg>
//   ),
//   Building: (p) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
//       <path
//         d="M4 21V3h10v18M20 21V9h-6M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Spark: (p) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
//       <path
//         d="M13 2 3 14h8l-1 8 11-14h-8l0-6Z"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Target: (p) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
//       <path
//         d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Zm0-6a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Search: (p) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
//       <path
//         d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm6.2-1.8L21 20.5"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Filter: (p) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
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

// /* -----------------------------
//    Utils
// ------------------------------ */
// function brxClamp(v, min, max) {
//   return Math.max(min, Math.min(max, v));
// }
// function brxPct(n) {
//   return `${n.toFixed(1)}%`;
// }

// /* -----------------------------
//    Tooltip hook (no blinking)
// ------------------------------ */
// function useBrxTooltip() {
//   const [tip, setTip] = useState({ show: false, x: 0, y: 0, title: "", value: "" });
//   const wrapRef = useRef(null);

//   const getXY = (e) => {
//     const rect = wrapRef.current?.getBoundingClientRect();
//     if (!rect) return { x: 0, y: 0, rect: null };
//     const x = e.clientX - rect.left;
//     const y = e.clientY - rect.top;
//     return {
//       rect,
//       x: brxClamp(x, 14, rect.width - 14),
//       y: brxClamp(y, 14, rect.height - 14),
//     };
//   };

//   const show = (e, title, value) => {
//     if (!e) return;
//     const { x, y } = getXY(e);
//     setTip({ show: true, x, y, title, value });
//   };

//   const move = (e) => {
//     setTip((t) => {
//       if (!t.show) return t;
//       const { rect, x, y } = getXY(e);
//       if (!rect) return t;
//       if (Math.abs(t.x - x) < 0.5 && Math.abs(t.y - y) < 0.5) return t;
//       return { ...t, x, y };
//     });
//   };

//   const hide = () => setTip((t) => ({ ...t, show: false }));

//   const TooltipEl = (
//     <div className={`brxTip ${tip.show ? "brxTip_show" : ""}`} style={{ left: tip.x, top: tip.y }}>
//       <div className="brxTipTitle">{tip.title}</div>
//       <div className="brxTipValue">{tip.value}</div>
//     </div>
//   );

//   return { wrapRef, TooltipEl, show, move, hide };
// }

// /* -----------------------------
//    Line chart (SVG)
// ------------------------------ */
// function BrxLineChart({ labels, series, yMin = 0, yMax = 20, onPointEnter, onPointLeave }) {
//   const W = 860;
//   const H = 380;
//   const padL = 58;
//   const padR = 24;
//   const padT = 24;
//   const padB = 70;

//   const innerW = W - padL - padR;
//   const innerH = H - padT - padB;

//   const xFor = (i) => padL + (innerW * i) / (labels.length - 1);
//   const yFor = (v) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

//   const yTicks = [0, 5, 10, 15, 20].filter((t) => t >= yMin && t <= yMax);

//   const pathFor = (values) =>
//     values.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ");

//   const legendY = H - 38;
//   const monthY = H - 18;

//   return (
//     <div className="brxChartWrap">
//       <svg className="brxChartSvg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bubble chart">
//         {/* y grid */}
//         {yTicks.map((t, idx) => {
//           const y = yFor(t);
//           return (
//             <g key={idx}>
//               <line x1={padL} y1={y} x2={W - padR} y2={y} className="brxGridLine" />
//               <text x={padL - 10} y={y + 4} textAnchor="end" className="brxAxisTick">
//                 {t}%
//               </text>
//             </g>
//           );
//         })}

//         {/* x labels (months) */}
//         {labels.map((lab, i) => (
//           <text key={i} x={xFor(i)} y={monthY} textAnchor="middle" className="brxAxisTickX">
//             {lab}
//           </text>
//         ))}

//         {/* series lines & points */}
//         {series.map((s, si) => (
//           <g key={si}>
//             <path d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth="3" />
//             {s.values.map((v, i) => (
//               <circle
//                 key={i}
//                 cx={xFor(i)}
//                 cy={yFor(v)}
//                 r="5"
//                 fill={s.color}
//                 className="brxPoint"
//                 tabIndex={0}
//                 onMouseEnter={(e) => onPointEnter?.(e, `${labels[i]} — ${s.label}`, brxPct(v))}
//                 onMouseMove={(e) => onPointEnter?.(e, `${labels[i]} — ${s.label}`, brxPct(v))}
//                 onMouseLeave={onPointLeave}
//                 onFocus={(e) => onPointEnter?.(e, `${labels[i]} — ${s.label}`, brxPct(v))}
//                 onBlur={onPointLeave}
//               />
//             ))}
//           </g>
//         ))}

//         {/* legend */}
//         <g className="brxLegend" transform={`translate(0, ${legendY})`}>
//           {series.map((s, i) => (
//             <g key={i} transform={`translate(${padL + i * 170}, 0)`}>
//               <circle cx="0" cy="0" r="4" fill={s.color} />
//               <text x="10" y="4" className="brxLegendText">
//                 {s.label}
//               </text>
//             </g>
//           ))}
//         </g>
//       </svg>
//     </div>
//   );
// }

// /* -----------------------------
//    Small components
// ------------------------------ */
// function BrxKpi({ tone, icon, title, value, sub, chip }) {
//   return (
//     <div className={`brxKpi brxKpi_${tone}`}>
//       <div className="brxKpiTop">
//         <span className="brxKpiIcon">{icon}</span>
//         <span className="brxKpiTitle">{title}</span>
//       </div>
//       <div className="brxKpiValue">{value}</div>
//       <div className="brxKpiSub">
//         <span>{sub}</span>
//         {chip ? <span className={`brxKpiChip brxKpiChip_${tone}`}>{chip}</span> : null}
//       </div>
//     </div>
//   );
// }

// function BrxProgress({ label, value, tone }) {
//   return (
//     <div className="brxProg">
//       <div className="brxProgTop">
//         <span className="brxProgLabel">{label}</span>
//         <span className={`brxProgValue brxProgValue_${tone}`}>{value}/100</span>
//       </div>
//       <div className="brxProgTrack">
//         <div className={`brxProgFill brxProgFill_${tone}`} style={{ width: `${value}%` }} />
//       </div>
//     </div>
//   );
// }

// function BrxStress({ tone, title, value, sub }) {
//   return (
//     <div className={`brxStress brxStress_${tone}`}>
//       <div className="brxStressTitle">{title}</div>
//       <div className="brxStressValue">{value}</div>
//       <div className="brxStressSub">{sub}</div>
//     </div>
//   );
// }

// function BrxRiskPill({ tone, text }) {
//   return <span className={`brxPill brxPill_${tone}`}>{text}</span>;
// }

// function BrxMiniBar({ value }) {
//   return (
//     <div className="brxMiniBar" aria-hidden="true">
//       <div className="brxMiniBarFill" style={{ width: `${value}%` }} />
//     </div>
//   );
// }

// /* -----------------------------
//    Page
// ------------------------------ */
// export default function BubbleRisk() {
//   const tip = useBrxTooltip();

//   // ── API State ──────────────────────────────────────────────
//   const [bubbleData,   setBubbleData]   = useState(null);
//   const [regionalData, setRegionalData] = useState([]);
//   const [transferData, setTransferData] = useState(null);
//   const [mortgageData, setMortgageData] = useState(null);
//   const [loading,      setLoading]      = useState(true);

//   useEffect(() => {
//     setLoading(true);
//     Promise.allSettled([
//       getBubbleRiskData(),
//       getRegionalData(),
//       getTransfers({ limit: 1 }),   // just for pagination totals
//       getMortgages({ limit: 1 }),
//     ]).then(([bubRes, regRes, trfRes, mtgRes]) => {
//       if (bubRes.status === "fulfilled") setBubbleData(bubRes.value?.data ?? null);
//       if (regRes.status === "fulfilled") setRegionalData(regRes.value?.data ?? []);
//       if (trfRes.status === "fulfilled") setTransferData(trfRes.value ?? null);
//       if (mtgRes.status === "fulfilled") setMortgageData(mtgRes.value ?? null);
//     }).finally(() => setLoading(false));
//   }, []);

//   // ── Top controls ───────────────────────────────────────────
//   const [query,  setQuery]  = useState("");
//   const [status, setStatus] = useState("all");

//   // ── Core metrics from bubble-risk API ─────────────────────
//   const riskScore    = bubbleData?.riskScore           ?? 68;
//   const priceGrowth  = bubbleData?.currentPriceGrowth  ?? 18.4;
//   const incomeGrowth = bubbleData?.currentIncomeGrowth ?? 4.4;
//   const growthGap    = bubbleData?.growthGap           ?? 14.0;
//   const riskLevel    = bubbleData?.interpretation?.riskLevel ?? "Moderate Risk";
//   const divergence   = incomeGrowth > 0
//     ? parseFloat((priceGrowth / incomeGrowth).toFixed(1))
//     : 4.2;

//   // ── Monthly trend chart data ───────────────────────────────
//   const monthlyTrends = bubbleData?.monthlyTrends ?? [];
//   const labels = monthlyTrends.length > 0
//     ? monthlyTrends.map((m) => m.month)
//     : ["Jul 23","Aug 23","Sep 23","Oct 23","Nov 23","Dec 23","Jan 24","Feb 24","Apr 24"];
//   const series = [
//     {
//       label:  "Price Growth %",
//       color:  "var(--brx-red)",
//       values: monthlyTrends.length > 0
//         ? monthlyTrends.map((m) => m.priceGrowth)
//         : [8.2, 9.1, 10.4, 11.8, 13.2, 14.6, 15.9, 16.3, 18.4],
//     },
//     {
//       label:  "Income Growth %",
//       color:  "var(--brx-green)",
//       values: monthlyTrends.length > 0
//         ? monthlyTrends.map((m) => m.incomeGrowth)
//         : [3.6, 3.8, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6],
//     },
//   ];

//   // ── KPI cards ──────────────────────────────────────────────
//   const kpis = [
//     {
//       tone:  divergence >= 3 ? "danger" : "warn",
//       icon:  <BrxIcon.TrendUp className="brxSvgIcon" />,
//       title: "Price vs Income Divergence",
//       value: `${divergence}x`,
//       sub:   ">3x = Warning",
//     },
//     {
//       tone:  priceGrowth > 15 ? "danger" : "warn",
//       icon:  <BrxIcon.Home className="brxSvgIcon" />,
//       title: "Avg Price Growth (YoY)",
//       value: `${priceGrowth}%`,
//       sub:   `vs ${incomeGrowth}% income growth`,
//     },
//     {
//       tone:  growthGap > 10 ? "danger" : "warn",
//       icon:  <BrxIcon.Percent className="brxSvgIcon" />,
//       title: "Growth Gap",
//       value: `${growthGap.toFixed(1)}%`,
//       sub:   ">10% = Elevated speculation",
//     },
//     {
//       tone:  riskScore > 70 ? "danger" : riskScore > 50 ? "warn" : "neutral",
//       icon:  <BrxIcon.Building className="brxSvgIcon" />,
//       title: "Overall Risk Score",
//       value: `${riskScore}/100`,
//       sub:   riskLevel,
//       chip:  bubbleData?.trend === "increasing" ? "↑ Rising" : null,
//     },
//   ];

//   // ── AI Forecast from riskScore ────────────────────────────
//   const ai_tables = {
//     six:             Math.min(100, Math.round(riskScore * 0.92)),
//     twelve:          Math.min(100, Math.round(riskScore * 1.09)),
//     correctionProb:  riskScore > 70 ? 55 : riskScore > 50 ? 42 : 22,
//     liquidityStress: riskScore > 70 ? 48 : riskScore > 50 ? 35 : 18,
//   };

//   // ── Stress signals: derived from transfer + mortgage data ──
//   const totalTransfers = transferData?.pagination?.total ?? 0;
//   const totalMortgages = mortgageData?.pagination?.total ?? 0;

//   const stressSignals = [
//     {
//       tone:  priceGrowth > 15 ? "danger" : "warn",
//       title: "Rapid price appreciation (YoY)",
//       value: `${priceGrowth}%`,
//       sub:   `vs ${incomeGrowth}% income — gap: ${growthGap.toFixed(1)}%`,
//     },
//     {
//       tone:  totalMortgages > 1000 ? "danger" : "warn",
//       title: "Active mortgage registrations",
//       value: totalMortgages > 0 ? totalMortgages.toLocaleString() : "8,920",
//       sub:   "Debt-backed purchase activity",
//     },
//     {
//       tone:  totalTransfers > 500 ? "warn" : "neutral",
//       title: "Property transfers registered",
//       value: totalTransfers > 0 ? totalTransfers.toLocaleString() : "3,456",
//       sub:   "Total active transfer records",
//     },
//     {
//       tone:  growthGap > 10 ? "danger" : "warn",
//       title: "Price-income divergence trend",
//       value: bubbleData?.trend === "increasing" ? "↑ Increasing" : "→ Stable",
//       sub:   bubbleData?.interpretation?.concerns ?? "Monitor closely",
//     },
//     {
//       tone:  riskScore > 70 ? "danger" : "warn",
//       title: "Overall bubble risk",
//       value: `${riskScore}/100`,
//       sub:   bubbleData?.interpretation?.recommendation ?? "Monitor closely",
//     },
//   ];

//   // ── City-level risk from /api/dashboard/regional-data ─────
//   // regionalData shape: [{ region, parcels, value, verified, disputes, verificationRate }]
//   const cities = useMemo(() => {
//     if (regionalData.length === 0) {
//       return [
//         { city: "Belgrade",   risk: 78, price: "+18.4%", income: "+4.2%", div: "4.4x", status: "high"   },
//         { city: "Novi Sad",   risk: 72, price: "+22.1%", income: "+5.1%", div: "4.3x", status: "high"   },
//         { city: "Niš",        risk: 45, price: "+8.2%",  income: "+4.8%", div: "1.7x", status: "medium" },
//         { city: "Kragujevac", risk: 38, price: "+6.5%",  income: "+3.9%", div: "1.7x", status: "low"    },
//         { city: "Subotica",   risk: 52, price: "+12.4%", income: "+4.5%", div: "2.8x", status: "medium" },
//         { city: "Pančevo",    risk: 61, price: "+15.8%", income: "+5.2%", div: "3.0x", status: "medium" },
//       ];
//     }
//     return regionalData.map((r) => {
//       // Derive risk score: higher disputes + lower verification = higher risk
//       const disputeRatio = r.parcels > 0 ? r.disputes / r.parcels : 0;
//       const verifRate    = parseFloat(r.verificationRate ?? 0);
//       const regionRisk   = Math.min(100, Math.round(
//         (disputeRatio * 5000) + ((100 - verifRate) * 0.6) + (riskScore * 0.3)
//       ));
//       const regionDiv    = parseFloat((priceGrowth / incomeGrowth).toFixed(1));
//       const riskStatus   = regionRisk > 65 ? "high" : regionRisk > 45 ? "medium" : "low";

//       return {
//         city:   r.region,
//         risk:   regionRisk,
//         price:  `+${priceGrowth}%`,
//         income: `+${incomeGrowth}%`,
//         div:    `${regionDiv}x`,
//         status: riskStatus,
//       };
//     }).slice(0, 8);
//   }, [regionalData, riskScore, priceGrowth, incomeGrowth]);

//   const actions = [
//     {
//       title:    bubbleData?.interpretation?.recommendation ?? "Tighten LTV norms in overheated regions",
//       priority: "High",
//     },
//     { title: "Freeze subsidies in overheated zones",               priority: "High"   },
//     { title: "Increase registration scrutiny for repeat buyers",   priority: "High"   },
//     { title: "Monitor foreign investment inflows",                 priority: "Medium" },
//   ];

//   const filteredCities = useMemo(() => {
//     const q = query.trim().toLowerCase();
//     return cities.filter((r) => {
//       const matchText =
//         !q ||
//         r.city.toLowerCase().includes(q) ||
//         r.status.toLowerCase().includes(q) ||
//         r.div.toLowerCase().includes(q);
//       const matchStatus = status === "all" ? true : r.status === status;
//       return matchText && matchStatus;
//     });
//   }, [cities, query, status]);

//   const onPointEnter = (e, title, value) => tip.show(e, title, value);
//   const onPointLeave = () => tip.hide();

//   return (
//     <div id="brxBubbleRisk" className="brxPage">
//       <div className="brxTopLine" />

//       <div className="brxWrap">
//         <header className="brxHeader">
//           <div className="brxHeaderTop">
//             <div className="brxBadge">
//               <BrxIcon.TrendUp className="brxBadgeIcon" />
//               <span>Market Surveillance</span>
//             </div>

//             <div className="brxControls" role="search">
//               <div className="brxSearch">
//                 <BrxIcon.Search className="brxCtrlIcon" />
//                 <input
//                   value={query}
//                   onChange={(e) => setQuery(e.target.value)}
//                   className="brxInput"
//                   placeholder="Search city, status, divergence…"
//                   aria-label="Search"
//                 />
//                 {query ? (
//                   <button className="brxClearBtn" type="button" onClick={() => setQuery("")} aria-label="Clear search">
//                     ×
//                   </button>
//                 ) : null}
//               </div>

//               <div className="brxFilter">
//                 <BrxIcon.Filter className="brxCtrlIcon" />
//                 <select
//                   className="brxSelect"
//                   value={status}
//                   onChange={(e) => setStatus(e.target.value)}
//                   aria-label="Filter by status"
//                 >
//                   <option value="all">All</option>
//                   <option value="high">High risk</option>
//                   <option value="medium">Medium risk</option>
//                   <option value="low">Low risk</option>
//                 </select>
//               </div>
//             </div>
//           </div>

//           <h1 className="brxTitle">Bubble Protection Dashboard</h1>
//           <p className="brxSub">Detect speculative bubbles before they become financial crises</p>
//         </header>

//         <section className="brxKpiGrid">
//           {kpis.map((k, i) => (
//             <BrxKpi key={i} {...k} />
//           ))}
//         </section>

//         <section className="brxMainGrid">
//           <div className="brxCard">
//             <div className="brxCardHead">
//               <h3 className="brxCardTitle">Price vs Income Growth Divergence</h3>
//               <p className="brxCardHint">Growing gap indicates bubble formation</p>
//             </div>

//             <div
//               className="brxCardBody brxChartBody"
//               ref={tip.wrapRef}
//               onMouseMove={tip.move}
//               onMouseLeave={tip.hide}
//             >
//               <BrxLineChart
//                 labels={labels}
//                 series={series}
//                 yMin={0}
//                 yMax={20}
//                 onPointEnter={onPointEnter}
//                 onPointLeave={onPointLeave}
//               />
//               {tip.TooltipEl}
//             </div>
//           </div>

//           <div className="brxCard">
//             <div className="brxCardHead">
//               <div className="brxCardHeadRow">
//                 <h3 className="brxCardTitle">AI Forecast Panel</h3>
//                 <span className="brxAiIcon">
//                   <BrxIcon.Target className="brxSvgIcon" />
//                 </span>
//               </div>
//             </div>

//             <div className="brxCardBody">
//               <BrxProgress label="6-Month Risk Score" value={ai_tables.six} tone="warn" />
//               <div className="brxDivider" />
//               <BrxProgress label="12-Month Risk Score" value={ai_tables.twelve} tone="danger" />
//               <div className="brxDivider" />

//               <div className="brxAiChips">
//                 <div className="brxAiChip brxAiChip_danger">
//                   <div className="brxAiChipValue">{ai_tables.correctionProb}%</div>
//                   <div className="brxAiChipLabel">Correction Probability</div>
//                 </div>
//                 <div className="brxAiChip brxAiChip_warn">
//                   <div className="brxAiChipValue">{ai_tables.liquidityStress}%</div>
//                   <div className="brxAiChipLabel">Liquidity Stress</div>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </section>

//         <section className="brxCard brxMt">
//           <div className="brxCardHead">
//             <div className="brxCardHeadRow">
//               <h3 className="brxCardTitle">Market Stress Signals</h3>
//               <span className="brxWarnDot" aria-hidden="true">
//                 !
//               </span>
//             </div>
//           </div>

//           <div className="brxStressGrid">
//             {stressSignals.map((s, i) => (
//               <BrxStress key={i} {...s} />
//             ))}
//           </div>
//         </section>

//         <section className="brxCard brxMt">
//           <div className="brxCardHead">
//             <div className="brxCardHeadRow">
//               <h3 className="brxCardTitle">City-Level Bubble Risk Assessment</h3>

//               <div className="brxTableMeta">
//                 <span className="brxCount">
//                   Showing <b>{filteredCities.length}</b> / {cities.length}
//                 </span>
//               </div>
//             </div>
//           </div>

//           <div className="brxTableWrap">
//             <table className="brxTable">
//               <thead>
//                 <tr>
//                   <th>City</th>
//                   <th>Risk Score</th>
//                   <th>Price Growth</th>
//                   <th>Income Growth</th>
//                   <th>Divergence</th>
//                   <th>Status</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {filteredCities.map((r, i) => (
//                   <tr key={i}>
//                     <td className="brxCity">{r.city}</td>
//                     <td>
//                       <div className="brxRiskCell">
//                         <BrxMiniBar value={r.risk} />
//                         <span className="brxRiskNum">{r.risk}</span>
//                       </div>
//                     </td>
//                     <td className="brxNeg">{r.price}</td>
//                     <td className="brxPos">{r.income}</td>
//                     <td className="brxDiv">{r.div}</td>
//                     <td>
//                       {r.status === "high" ? (
//                         <BrxRiskPill tone="high" text="high risk" />
//                       ) : r.status === "medium" ? (
//                         <BrxRiskPill tone="med" text="medium risk" />
//                       ) : (
//                         <BrxRiskPill tone="low" text="low risk" />
//                       )}
//                     </td>
//                   </tr>
//                 ))}

//                 {filteredCities.length === 0 ? (
//                   <tr>
//                     <td colSpan={6} className="brxEmpty">
//                       No results found. Try a different search or filter.
//                     </td>
//                   </tr>
//                 ) : null}
//               </tbody>
//             </table>
//           </div>
//         </section>

//         <section className="brxCard brxMt">
//           <div className="brxCardHead">
//             <div className="brxCardHeadRow">
//               <h3 className="brxCardTitle">Recommended Regulator Actions</h3>
//               <span className="brxSpark">
//                 <BrxIcon.Spark className="brxSvgIcon" />
//               </span>
//             </div>
//             <p className="brxCardHint">AI-generated policy recommendations based on current indicators</p>
//           </div>

//           <div className="brxActionsGrid">
//             {actions.map((a, i) => (
//               <div key={i} className="brxActionCard">
//                 <span className="brxActionDot" aria-hidden="true" />
//                 <div>
//                   <div className="brxActionTitle">{a.title}</div>
//                   <div className="brxActionMeta">Priority: {a.priority}</div>
//                 </div>
//               </div>
//             ))}
//           </div>

//           <div className="brxBtns">
//             <button className="brxBtn brxBtn_primary" type="button">
//               Generate Detailed Report
//             </button>
//             <button className="brxBtn brxBtn_secondary" type="button">
//               Schedule Review Meeting
//             </button>
//           </div>
//         </section>

//         <div className="brxSpacer" />
//       </div>
//     </div>
//   );
// }

// // BubbleRisk.jsx
// import React, { useMemo, useRef, useState, useEffect } from "react";
// import "./BubbleRisk.css";
// import { fetchBubbleRiskData, fetchRegionalData, fetchTransfers, fetchMortgages } from "../utils/api";

// /* -----------------------------
//    Icons (unique)
// ------------------------------ */
// const BrxIcon = {
//   TrendUp: (p) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
//       <path
//         d="M3 17l7-7 4 4 7-7M14 7h7v7"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Home: (p) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
//       <path
//         d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5Z"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Percent: (p) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
//       <path
//         d="M19 5 5 19M7.5 7.5h.01M16.5 16.5h.01"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//       />
//       <circle cx="7.5" cy="7.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
//       <circle
//         cx="16.5"
//         cy="16.5"
//         r="2.2"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//       />
//     </svg>
//   ),
//   Building: (p) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
//       <path
//         d="M4 21V3h10v18M20 21V9h-6M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Spark: (p) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
//       <path
//         d="M13 2 3 14h8l-1 8 11-14h-8l0-6Z"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Target: (p) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
//       <path
//         d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Zm0-6a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Search: (p) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
//       <path
//         d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm6.2-1.8L21 20.5"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.8"
//         strokeLinecap="round"
//         strokeLinejoin="round"
//       />
//     </svg>
//   ),
//   Filter: (p) => (
//     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
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

// /* -----------------------------
//    Utils
// ------------------------------ */
// function brxClamp(v, min, max) {
//   return Math.max(min, Math.min(max, v));
// }
// function brxPct(n) {
//   return `${n.toFixed(1)}%`;
// }

// /* -----------------------------
//    Tooltip hook (no blinking)
// ------------------------------ */
// function useBrxTooltip() {
//   const [tip, setTip] = useState({ show: false, x: 0, y: 0, title: "", value: "" });
//   const wrapRef = useRef(null);

//   const getXY = (e) => {
//     const rect = wrapRef.current?.getBoundingClientRect();
//     if (!rect) return { x: 0, y: 0, rect: null };
//     const x = e.clientX - rect.left;
//     const y = e.clientY - rect.top;
//     return {
//       rect,
//       x: brxClamp(x, 14, rect.width - 14),
//       y: brxClamp(y, 14, rect.height - 14),
//     };
//   };

//   const show = (e, title, value) => {
//     if (!e) return;
//     const { x, y } = getXY(e);
//     setTip({ show: true, x, y, title, value });
//   };

//   const move = (e) => {
//     setTip((t) => {
//       if (!t.show) return t;
//       const { rect, x, y } = getXY(e);
//       if (!rect) return t;
//       if (Math.abs(t.x - x) < 0.5 && Math.abs(t.y - y) < 0.5) return t;
//       return { ...t, x, y };
//     });
//   };

//   const hide = () => setTip((t) => ({ ...t, show: false }));

//   const TooltipEl = (
//     <div className={`brxTip ${tip.show ? "brxTip_show" : ""}`} style={{ left: tip.x, top: tip.y }}>
//       <div className="brxTipTitle">{tip.title}</div>
//       <div className="brxTipValue">{tip.value}</div>
//     </div>
//   );

//   return { wrapRef, TooltipEl, show, move, hide };
// }

// /* -----------------------------
//    Line chart (SVG)
// ------------------------------ */
// function BrxLineChart({ labels, series, yMin = 0, yMax = 20, onPointEnter, onPointLeave }) {
//   const W = 860;
//   const H = 380;
//   const padL = 58;
//   const padR = 24;
//   const padT = 24;
//   const padB = 70;

//   const innerW = W - padL - padR;
//   const innerH = H - padT - padB;

//   const xFor = (i) => padL + (innerW * i) / (labels.length - 1);
//   const yFor = (v) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

//   const yTicks = [0, 5, 10, 15, 20].filter((t) => t >= yMin && t <= yMax);

//   const pathFor = (values) =>
//     values.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ");

//   const legendY = H - 38;
//   const monthY = H - 18;

//   return (
//     <div className="brxChartWrap">
//       <svg className="brxChartSvg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bubble chart">
//         {/* y grid */}
//         {yTicks.map((t, idx) => {
//           const y = yFor(t);
//           return (
//             <g key={idx}>
//               <line x1={padL} y1={y} x2={W - padR} y2={y} className="brxGridLine" />
//               <text x={padL - 10} y={y + 4} textAnchor="end" className="brxAxisTick">
//                 {t}%
//               </text>
//             </g>
//           );
//         })}

//         {/* x labels (months) */}
//         {labels.map((lab, i) => (
//           <text key={i} x={xFor(i)} y={monthY} textAnchor="middle" className="brxAxisTickX">
//             {lab}
//           </text>
//         ))}

//         {/* series lines & points */}
//         {series.map((s, si) => (
//           <g key={si}>
//             <path d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth="3" />
//             {s.values.map((v, i) => (
//               <circle
//                 key={i}
//                 cx={xFor(i)}
//                 cy={yFor(v)}
//                 r="5"
//                 fill={s.color}
//                 className="brxPoint"
//                 tabIndex={0}
//                 onMouseEnter={(e) => onPointEnter?.(e, `${labels[i]} — ${s.label}`, brxPct(v))}
//                 onMouseMove={(e) => onPointEnter?.(e, `${labels[i]} — ${s.label}`, brxPct(v))}
//                 onMouseLeave={onPointLeave}
//                 onFocus={(e) => onPointEnter?.(e, `${labels[i]} — ${s.label}`, brxPct(v))}
//                 onBlur={onPointLeave}
//               />
//             ))}
//           </g>
//         ))}

//         {/* legend */}
//         <g className="brxLegend" transform={`translate(0, ${legendY})`}>
//           {series.map((s, i) => (
//             <g key={i} transform={`translate(${padL + i * 170}, 0)`}>
//               <circle cx="0" cy="0" r="4" fill={s.color} />
//               <text x="10" y="4" className="brxLegendText">
//                 {s.label}
//               </text>
//             </g>
//           ))}
//         </g>
//       </svg>
//     </div>
//   );
// }

// /* -----------------------------
//    Small components
// ------------------------------ */
// function BrxKpi({ tone, icon, title, value, sub, chip }) {
//   return (
//     <div className={`brxKpi brxKpi_${tone}`}>
//       <div className="brxKpiTop">
//         <span className="brxKpiIcon">{icon}</span>
//         <span className="brxKpiTitle">{title}</span>
//       </div>
//       <div className="brxKpiValue">{value}</div>
//       <div className="brxKpiSub">
//         <span>{sub}</span>
//         {chip ? <span className={`brxKpiChip brxKpiChip_${tone}`}>{chip}</span> : null}
//       </div>
//     </div>
//   );
// }

// function BrxProgress({ label, value, tone }) {
//   return (
//     <div className="brxProg">
//       <div className="brxProgTop">
//         <span className="brxProgLabel">{label}</span>
//         <span className={`brxProgValue brxProgValue_${tone}`}>{value}/100</span>
//       </div>
//       <div className="brxProgTrack">
//         <div className={`brxProgFill brxProgFill_${tone}`} style={{ width: `${value}%` }} />
//       </div>
//     </div>
//   );
// }

// function BrxStress({ tone, title, value, sub }) {
//   return (
//     <div className={`brxStress brxStress_${tone}`}>
//       <div className="brxStressTitle">{title}</div>
//       <div className="brxStressValue">{value}</div>
//       <div className="brxStressSub">{sub}</div>
//     </div>
//   );
// }

// function BrxRiskPill({ tone, text }) {
//   return <span className={`brxPill brxPill_${tone}`}>{text}</span>;
// }

// function BrxMiniBar({ value }) {
//   return (
//     <div className="brxMiniBar" aria-hidden="true">
//       <div className="brxMiniBarFill" style={{ width: `${value}%` }} />
//     </div>
//   );
// }

// /* -----------------------------
//    Page
// ------------------------------ */
// export default function BubbleRisk() {
//   const tip = useBrxTooltip();

//   // ── API State ──────────────────────────────────────────────
//   const [bubbleData,   setBubbleData]   = useState(null);
//   const [regionalData, setRegionalData] = useState([]);
//   const [transferData, setTransferData] = useState(null);
//   const [mortgageData, setMortgageData] = useState(null);
//   const [loading,      setLoading]      = useState(true);

//   useEffect(() => {
//     setLoading(true);
//     Promise.allSettled([
//       fetchBubbleRiskData(),
//       fetchRegionalData(),
//       fetchTransfers({ limit: 1 }),   // just for pagination totals
//       fetchMortgages({ limit: 1 }),
//     ]).then(([bubRes, regRes, trfRes, mtgRes]) => {
//       if (bubRes.status === "fulfilled") setBubbleData(bubRes.value?.data ?? null);
//       if (regRes.status === "fulfilled") setRegionalData(regRes.value?.data ?? []);
//       if (trfRes.status === "fulfilled") setTransferData(trfRes.value ?? null);
//       if (mtgRes.status === "fulfilled") setMortgageData(mtgRes.value ?? null);
//     }).finally(() => setLoading(false));
//   }, []);

//   // ── Top controls ───────────────────────────────────────────
//   const [query,  setQuery]  = useState("");
//   const [status, setStatus] = useState("all");

//   // ── Core metrics from bubble-risk API ─────────────────────
//   const riskScore    = bubbleData?.riskScore           ?? 68;
//   const priceGrowth  = bubbleData?.currentPriceGrowth  ?? 18.4;
//   const incomeGrowth = bubbleData?.currentIncomeGrowth ?? 4.4;
//   const growthGap    = bubbleData?.growthGap           ?? 14.0;
//   const riskLevel    = bubbleData?.interpretation?.riskLevel ?? "Moderate Risk";
//   const divergence   = incomeGrowth > 0
//     ? parseFloat((priceGrowth / incomeGrowth).toFixed(1))
//     : 4.2;

//   // ── Monthly trend chart data ───────────────────────────────
//   const monthlyTrends = bubbleData?.monthlyTrends ?? [];
//   const labels = monthlyTrends.length > 0
//     ? monthlyTrends.map((m) => m.month)
//     : ["Jul 23","Aug 23","Sep 23","Oct 23","Nov 23","Dec 23","Jan 24","Feb 24","Apr 24"];
//   const series = [
//     {
//       label:  "Price Growth %",
//       color:  "var(--brx-red)",
//       values: monthlyTrends.length > 0
//         ? monthlyTrends.map((m) => m.priceGrowth)
//         : [8.2, 9.1, 10.4, 11.8, 13.2, 14.6, 15.9, 16.3, 18.4],
//     },
//     {
//       label:  "Income Growth %",
//       color:  "var(--brx-green)",
//       values: monthlyTrends.length > 0
//         ? monthlyTrends.map((m) => m.incomeGrowth)
//         : [3.6, 3.8, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6],
//     },
//   ];

//   // ── KPI cards ──────────────────────────────────────────────
//   const kpis = [
//     {
//       tone:  divergence >= 3 ? "danger" : "warn",
//       icon:  <BrxIcon.TrendUp className="brxSvgIcon" />,
//       title: "Price vs Income Divergence",
//       value: `${divergence}x`,
//       sub:   ">3x = Warning",
//     },
//     {
//       tone:  priceGrowth > 15 ? "danger" : "warn",
//       icon:  <BrxIcon.Home className="brxSvgIcon" />,
//       title: "Avg Price Growth (YoY)",
//       value: `${priceGrowth}%`,
//       sub:   `vs ${incomeGrowth}% income growth`,
//     },
//     {
//       tone:  growthGap > 10 ? "danger" : "warn",
//       icon:  <BrxIcon.Percent className="brxSvgIcon" />,
//       title: "Growth Gap",
//       value: `${growthGap.toFixed(1)}%`,
//       sub:   ">10% = Elevated speculation",
//     },
//     {
//       tone:  riskScore > 70 ? "danger" : riskScore > 50 ? "warn" : "neutral",
//       icon:  <BrxIcon.Building className="brxSvgIcon" />,
//       title: "Overall Risk Score",
//       value: `${riskScore}/100`,
//       sub:   riskLevel,
//       chip:  bubbleData?.trend === "increasing" ? "↑ Rising" : null,
//     },
//   ];

//   // ── AI Forecast from riskScore ────────────────────────────
//   const ai_tables = {
//     six:             Math.min(100, Math.round(riskScore * 0.92)),
//     twelve:          Math.min(100, Math.round(riskScore * 1.09)),
//     correctionProb:  riskScore > 70 ? 55 : riskScore > 50 ? 42 : 22,
//     liquidityStress: riskScore > 70 ? 48 : riskScore > 50 ? 35 : 18,
//   };

//   // ── Stress signals: derived from transfer + mortgage data ──
//   const totalTransfers = transferData?.pagination?.total ?? 0;
//   const totalMortgages = mortgageData?.pagination?.total ?? 0;

//   const stressSignals = [
//     {
//       tone:  priceGrowth > 15 ? "danger" : "warn",
//       title: "Rapid price appreciation (YoY)",
//       value: `${priceGrowth}%`,
//       sub:   `vs ${incomeGrowth}% income — gap: ${growthGap.toFixed(1)}%`,
//     },
//     {
//       tone:  totalMortgages > 1000 ? "danger" : "warn",
//       title: "Active mortgage registrations",
//       value: totalMortgages > 0 ? totalMortgages.toLocaleString() : "8,920",
//       sub:   "Debt-backed purchase activity",
//     },
//     {
//       tone:  totalTransfers > 500 ? "warn" : "neutral",
//       title: "Property transfers registered",
//       value: totalTransfers > 0 ? totalTransfers.toLocaleString() : "3,456",
//       sub:   "Total active transfer records",
//     },
//     {
//       tone:  growthGap > 10 ? "danger" : "warn",
//       title: "Price-income divergence trend",
//       value: bubbleData?.trend === "increasing" ? "↑ Increasing" : "→ Stable",
//       sub:   bubbleData?.interpretation?.concerns ?? "Monitor closely",
//     },
//     {
//       tone:  riskScore > 70 ? "danger" : "warn",
//       title: "Overall bubble risk",
//       value: `${riskScore}/100`,
//       sub:   bubbleData?.interpretation?.recommendation ?? "Monitor closely",
//     },
//   ];

//   // ── City-level risk from /api/dashboard/regional-data ─────
//   // regionalData shape: [{ region, parcels, value, verified, disputes, verificationRate }]
//   const cities = useMemo(() => {
//     if (regionalData.length === 0) {
//       return [
//         { city: "Belgrade",   risk: 78, price: "+18.4%", income: "+4.2%", div: "4.4x", status: "high"   },
//         { city: "Novi Sad",   risk: 72, price: "+22.1%", income: "+5.1%", div: "4.3x", status: "high"   },
//         { city: "Niš",        risk: 45, price: "+8.2%",  income: "+4.8%", div: "1.7x", status: "medium" },
//         { city: "Kragujevac", risk: 38, price: "+6.5%",  income: "+3.9%", div: "1.7x", status: "low"    },
//         { city: "Subotica",   risk: 52, price: "+12.4%", income: "+4.5%", div: "2.8x", status: "medium" },
//         { city: "Pančevo",    risk: 61, price: "+15.8%", income: "+5.2%", div: "3.0x", status: "medium" },
//       ];
//     }
//     return regionalData.map((r) => {
//       // Derive risk score: higher disputes + lower verification = higher risk
//       const disputeRatio = r.parcels > 0 ? r.disputes / r.parcels : 0;
//       const verifRate    = parseFloat(r.verificationRate ?? 0);
//       const regionRisk   = Math.min(100, Math.round(
//         (disputeRatio * 5000) + ((100 - verifRate) * 0.6) + (riskScore * 0.3)
//       ));
//       const regionDiv    = parseFloat((priceGrowth / incomeGrowth).toFixed(1));
//       const riskStatus   = regionRisk > 65 ? "high" : regionRisk > 45 ? "medium" : "low";

//       return {
//         city:   r.region,
//         risk:   regionRisk,
//         price:  `+${priceGrowth}%`,
//         income: `+${incomeGrowth}%`,
//         div:    `${regionDiv}x`,
//         status: riskStatus,
//       };
//     }).slice(0, 8);
//   }, [regionalData, riskScore, priceGrowth, incomeGrowth]);

//   const actions = [
//     {
//       title:    bubbleData?.interpretation?.recommendation ?? "Tighten LTV norms in overheated regions",
//       priority: "High",
//     },
//     { title: "Freeze subsidies in overheated zones",               priority: "High"   },
//     { title: "Increase registration scrutiny for repeat buyers",   priority: "High"   },
//     { title: "Monitor foreign investment inflows",                 priority: "Medium" },
//   ];

//   const filteredCities = useMemo(() => {
//     const q = query.trim().toLowerCase();
//     return cities.filter((r) => {
//       const matchText =
//         !q ||
//         r.city.toLowerCase().includes(q) ||
//         r.status.toLowerCase().includes(q) ||
//         r.div.toLowerCase().includes(q);
//       const matchStatus = status === "all" ? true : r.status === status;
//       return matchText && matchStatus;
//     });
//   }, [cities, query, status]);

//   const onPointEnter = (e, title, value) => tip.show(e, title, value);
//   const onPointLeave = () => tip.hide();

//   return (
//     <div id="brxBubbleRisk" className="brxPage">
//       <div className="brxTopLine" />

//       <div className="brxWrap">
//         <header className="brxHeader">
//           <div className="brxHeaderTop">
//             <div className="brxBadge">
//               <BrxIcon.TrendUp className="brxBadgeIcon" />
//               <span>Market Surveillance</span>
//             </div>

//             <div className="brxControls" role="search">
//               <div className="brxSearch">
//                 <BrxIcon.Search className="brxCtrlIcon" />
//                 <input
//                   value={query}
//                   onChange={(e) => setQuery(e.target.value)}
//                   className="brxInput"
//                   placeholder="Search city, status, divergence…"
//                   aria-label="Search"
//                 />
//                 {query ? (
//                   <button className="brxClearBtn" type="button" onClick={() => setQuery("")} aria-label="Clear search">
//                     ×
//                   </button>
//                 ) : null}
//               </div>

//               <div className="brxFilter">
//                 <BrxIcon.Filter className="brxCtrlIcon" />
//                 <select
//                   className="brxSelect"
//                   value={status}
//                   onChange={(e) => setStatus(e.target.value)}
//                   aria-label="Filter by status"
//                 >
//                   <option value="all">All</option>
//                   <option value="high">High risk</option>
//                   <option value="medium">Medium risk</option>
//                   <option value="low">Low risk</option>
//                 </select>
//               </div>
//             </div>
//           </div>

//           <h1 className="brxTitle">Bubble Protection Dashboard</h1>
//           <p className="brxSub">Detect speculative bubbles before they become financial crises</p>
//         </header>

//         <section className="brxKpiGrid">
//           {kpis.map((k, i) => (
//             <BrxKpi key={i} {...k} />
//           ))}
//         </section>

//         <section className="brxMainGrid">
//           <div className="brxCard">
//             <div className="brxCardHead">
//               <h3 className="brxCardTitle">Price vs Income Growth Divergence</h3>
//               <p className="brxCardHint">Growing gap indicates bubble formation</p>
//             </div>

//             <div
//               className="brxCardBody brxChartBody"
//               ref={tip.wrapRef}
//               onMouseMove={tip.move}
//               onMouseLeave={tip.hide}
//             >
//               <BrxLineChart
//                 labels={labels}
//                 series={series}
//                 yMin={0}
//                 yMax={20}
//                 onPointEnter={onPointEnter}
//                 onPointLeave={onPointLeave}
//               />
//               {tip.TooltipEl}
//             </div>
//           </div>

//           <div className="brxCard">
//             <div className="brxCardHead">
//               <div className="brxCardHeadRow">
//                 <h3 className="brxCardTitle">AI Forecast Panel</h3>
//                 <span className="brxAiIcon">
//                   <BrxIcon.Target className="brxSvgIcon" />
//                 </span>
//               </div>
//             </div>

//             <div className="brxCardBody">
//               <BrxProgress label="6-Month Risk Score" value={ai_tables.six} tone="warn" />
//               <div className="brxDivider" />
//               <BrxProgress label="12-Month Risk Score" value={ai_tables.twelve} tone="danger" />
//               <div className="brxDivider" />

//               <div className="brxAiChips">
//                 <div className="brxAiChip brxAiChip_danger">
//                   <div className="brxAiChipValue">{ai_tables.correctionProb}%</div>
//                   <div className="brxAiChipLabel">Correction Probability</div>
//                 </div>
//                 <div className="brxAiChip brxAiChip_warn">
//                   <div className="brxAiChipValue">{ai_tables.liquidityStress}%</div>
//                   <div className="brxAiChipLabel">Liquidity Stress</div>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </section>

//         <section className="brxCard brxMt">
//           <div className="brxCardHead">
//             <div className="brxCardHeadRow">
//               <h3 className="brxCardTitle">Market Stress Signals</h3>
//               <span className="brxWarnDot" aria-hidden="true">
//                 !
//               </span>
//             </div>
//           </div>

//           <div className="brxStressGrid">
//             {stressSignals.map((s, i) => (
//               <BrxStress key={i} {...s} />
//             ))}
//           </div>
//         </section>

//         <section className="brxCard brxMt">
//           <div className="brxCardHead">
//             <div className="brxCardHeadRow">
//               <h3 className="brxCardTitle">City-Level Bubble Risk Assessment</h3>

//               <div className="brxTableMeta">
//                 <span className="brxCount">
//                   Showing <b>{filteredCities.length}</b> / {cities.length}
//                 </span>
//               </div>
//             </div>
//           </div>

//           <div className="brxTableWrap">
//             <table className="brxTable">
//               <thead>
//                 <tr>
//                   <th>City</th>
//                   <th>Risk Score</th>
//                   <th>Price Growth</th>
//                   <th>Income Growth</th>
//                   <th>Divergence</th>
//                   <th>Status</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {filteredCities.map((r, i) => (
//                   <tr key={i}>
//                     <td className="brxCity">{r.city}</td>
//                     <td>
//                       <div className="brxRiskCell">
//                         <BrxMiniBar value={r.risk} />
//                         <span className="brxRiskNum">{r.risk}</span>
//                       </div>
//                     </td>
//                     <td className="brxNeg">{r.price}</td>
//                     <td className="brxPos">{r.income}</td>
//                     <td className="brxDiv">{r.div}</td>
//                     <td>
//                       {r.status === "high" ? (
//                         <BrxRiskPill tone="high" text="high risk" />
//                       ) : r.status === "medium" ? (
//                         <BrxRiskPill tone="med" text="medium risk" />
//                       ) : (
//                         <BrxRiskPill tone="low" text="low risk" />
//                       )}
//                     </td>
//                   </tr>
//                 ))}

//                 {filteredCities.length === 0 ? (
//                   <tr>
//                     <td colSpan={6} className="brxEmpty">
//                       No results found. Try a different search or filter.
//                     </td>
//                   </tr>
//                 ) : null}
//               </tbody>
//             </table>
//           </div>
//         </section>

//         <section className="brxCard brxMt">
//           <div className="brxCardHead">
//             <div className="brxCardHeadRow">
//               <h3 className="brxCardTitle">Recommended Regulator Actions</h3>
//               <span className="brxSpark">
//                 <BrxIcon.Spark className="brxSvgIcon" />
//               </span>
//             </div>
//             <p className="brxCardHint">AI-generated policy recommendations based on current indicators</p>
//           </div>

//           <div className="brxActionsGrid">
//             {actions.map((a, i) => (
//               <div key={i} className="brxActionCard">
//                 <span className="brxActionDot" aria-hidden="true" />
//                 <div>
//                   <div className="brxActionTitle">{a.title}</div>
//                   <div className="brxActionMeta">Priority: {a.priority}</div>
//                 </div>
//               </div>
//             ))}
//           </div>

//           <div className="brxBtns">
//             <button className="brxBtn brxBtn_primary" type="button">
//               Generate Detailed Report
//             </button>
//             <button className="brxBtn brxBtn_secondary" type="button">
//               Schedule Review Meeting
//             </button>
//           </div>
//         </section>

//         <div className="brxSpacer" />
//       </div>
//     </div>
//   );
// }


// // // BubbleRisk.jsx
// // import React, { useMemo, useRef, useState } from "react";
// // import "./BubbleRisk.css";

// // /* -----------------------------
// //    Icons (unique)
// // ------------------------------ */
// // const BrxIcon = {
// //   TrendUp: (p) => (
// //     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
// //       <path
// //         d="M3 17l7-7 4 4 7-7M14 7h7v7"
// //         fill="none"
// //         stroke="currentColor"
// //         strokeWidth="1.8"
// //         strokeLinecap="round"
// //         strokeLinejoin="round"
// //       />
// //     </svg>
// //   ),
// //   Home: (p) => (
// //     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
// //       <path
// //         d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5Z"
// //         fill="none"
// //         stroke="currentColor"
// //         strokeWidth="1.8"
// //         strokeLinecap="round"
// //         strokeLinejoin="round"
// //       />
// //     </svg>
// //   ),
// //   Percent: (p) => (
// //     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
// //       <path
// //         d="M19 5 5 19M7.5 7.5h.01M16.5 16.5h.01"
// //         fill="none"
// //         stroke="currentColor"
// //         strokeWidth="1.8"
// //         strokeLinecap="round"
// //       />
// //       <circle cx="7.5" cy="7.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
// //       <circle
// //         cx="16.5"
// //         cy="16.5"
// //         r="2.2"
// //         fill="none"
// //         stroke="currentColor"
// //         strokeWidth="1.8"
// //       />
// //     </svg>
// //   ),
// //   Building: (p) => (
// //     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
// //       <path
// //         d="M4 21V3h10v18M20 21V9h-6M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2"
// //         fill="none"
// //         stroke="currentColor"
// //         strokeWidth="1.8"
// //         strokeLinecap="round"
// //         strokeLinejoin="round"
// //       />
// //     </svg>
// //   ),
// //   Spark: (p) => (
// //     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
// //       <path
// //         d="M13 2 3 14h8l-1 8 11-14h-8l0-6Z"
// //         fill="none"
// //         stroke="currentColor"
// //         strokeWidth="1.8"
// //         strokeLinecap="round"
// //         strokeLinejoin="round"
// //       />
// //     </svg>
// //   ),
// //   Target: (p) => (
// //     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
// //       <path
// //         d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Zm0-6a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z"
// //         fill="none"
// //         stroke="currentColor"
// //         strokeWidth="1.8"
// //         strokeLinecap="round"
// //         strokeLinejoin="round"
// //       />
// //     </svg>
// //   ),
// //   Search: (p) => (
// //     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
// //       <path
// //         d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm6.2-1.8L21 20.5"
// //         fill="none"
// //         stroke="currentColor"
// //         strokeWidth="1.8"
// //         strokeLinecap="round"
// //         strokeLinejoin="round"
// //       />
// //     </svg>
// //   ),
// //   Filter: (p) => (
// //     <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
// //       <path
// //         d="M4 6h16M7 12h10M10 18h4"
// //         fill="none"
// //         stroke="currentColor"
// //         strokeWidth="1.8"
// //         strokeLinecap="round"
// //       />
// //     </svg>
// //   ),
// // };

// // /* -----------------------------
// //    Utils
// // ------------------------------ */
// // function brxClamp(v, min, max) {
// //   return Math.max(min, Math.min(max, v));
// // }
// // function brxPct(n) {
// //   return `${n.toFixed(1)}%`;
// // }

// // /* -----------------------------
// //    Tooltip hook (no blinking)
// // ------------------------------ */
// // function useBrxTooltip() {
// //   const [tip, setTip] = useState({ show: false, x: 0, y: 0, title: "", value: "" });
// //   const wrapRef = useRef(null);

// //   const getXY = (e) => {
// //     const rect = wrapRef.current?.getBoundingClientRect();
// //     if (!rect) return { x: 0, y: 0, rect: null };
// //     const x = e.clientX - rect.left;
// //     const y = e.clientY - rect.top;
// //     return {
// //       rect,
// //       x: brxClamp(x, 14, rect.width - 14),
// //       y: brxClamp(y, 14, rect.height - 14),
// //     };
// //   };

// //   const show = (e, title, value) => {
// //     if (!e) return;
// //     const { x, y } = getXY(e);
// //     setTip({ show: true, x, y, title, value });
// //   };

// //   const move = (e) => {
// //     setTip((t) => {
// //       if (!t.show) return t;
// //       const { rect, x, y } = getXY(e);
// //       if (!rect) return t;
// //       if (Math.abs(t.x - x) < 0.5 && Math.abs(t.y - y) < 0.5) return t;
// //       return { ...t, x, y };
// //     });
// //   };

// //   const hide = () => setTip((t) => ({ ...t, show: false }));

// //   const TooltipEl = (
// //     <div className={`brxTip ${tip.show ? "brxTip_show" : ""}`} style={{ left: tip.x, top: tip.y }}>
// //       <div className="brxTipTitle">{tip.title}</div>
// //       <div className="brxTipValue">{tip.value}</div>
// //     </div>
// //   );

// //   return { wrapRef, TooltipEl, show, move, hide };
// // }

// // /* -----------------------------
// //    Line chart (SVG)
// // ------------------------------ */
// // function BrxLineChart({ labels, series, yMin = 0, yMax = 20, onPointEnter, onPointLeave }) {
// //   const W = 860;
// //   const H = 380;
// //   const padL = 58;
// //   const padR = 24;
// //   const padT = 24;
// //   const padB = 70;

// //   const innerW = W - padL - padR;
// //   const innerH = H - padT - padB;

// //   const xFor = (i) => padL + (innerW * i) / (labels.length - 1);
// //   const yFor = (v) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

// //   const yTicks = [0, 5, 10, 15, 20].filter((t) => t >= yMin && t <= yMax);

// //   const pathFor = (values) =>
// //     values.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ");

// //   const legendY = H - 38;
// //   const monthY = H - 18;

// //   return (
// //     <div className="brxChartWrap">
// //       <svg className="brxChartSvg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bubble chart">
// //         {/* y grid */}
// //         {yTicks.map((t, idx) => {
// //           const y = yFor(t);
// //           return (
// //             <g key={idx}>
// //               <line x1={padL} y1={y} x2={W - padR} y2={y} className="brxGridLine" />
// //               <text x={padL - 10} y={y + 4} textAnchor="end" className="brxAxisTick">
// //                 {t}%
// //               </text>
// //             </g>
// //           );
// //         })}

// //         {/* x labels (months) */}
// //         {labels.map((lab, i) => (
// //           <text key={i} x={xFor(i)} y={monthY} textAnchor="middle" className="brxAxisTickX">
// //             {lab}
// //           </text>
// //         ))}

// //         {/* series lines & points */}
// //         {series.map((s, si) => (
// //           <g key={si}>
// //             <path d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth="3" />
// //             {s.values.map((v, i) => (
// //               <circle
// //                 key={i}
// //                 cx={xFor(i)}
// //                 cy={yFor(v)}
// //                 r="5"
// //                 fill={s.color}
// //                 className="brxPoint"
// //                 tabIndex={0}
// //                 onMouseEnter={(e) => onPointEnter?.(e, `${labels[i]} — ${s.label}`, brxPct(v))}
// //                 onMouseMove={(e) => onPointEnter?.(e, `${labels[i]} — ${s.label}`, brxPct(v))}
// //                 onMouseLeave={onPointLeave}
// //                 onFocus={(e) => onPointEnter?.(e, `${labels[i]} — ${s.label}`, brxPct(v))}
// //                 onBlur={onPointLeave}
// //               />
// //             ))}
// //           </g>
// //         ))}

// //         {/* legend */}
// //         <g className="brxLegend" transform={`translate(0, ${legendY})`}>
// //           {series.map((s, i) => (
// //             <g key={i} transform={`translate(${padL + i * 170}, 0)`}>
// //               <circle cx="0" cy="0" r="4" fill={s.color} />
// //               <text x="10" y="4" className="brxLegendText">
// //                 {s.label}
// //               </text>
// //             </g>
// //           ))}
// //         </g>
// //       </svg>
// //     </div>
// //   );
// // }

// // /* -----------------------------
// //    Small components
// // ------------------------------ */
// // function BrxKpi({ tone, icon, title, value, sub, chip }) {
// //   return (
// //     <div className={`brxKpi brxKpi_${tone}`}>
// //       <div className="brxKpiTop">
// //         <span className="brxKpiIcon">{icon}</span>
// //         <span className="brxKpiTitle">{title}</span>
// //       </div>
// //       <div className="brxKpiValue">{value}</div>
// //       <div className="brxKpiSub">
// //         <span>{sub}</span>
// //         {chip ? <span className={`brxKpiChip brxKpiChip_${tone}`}>{chip}</span> : null}
// //       </div>
// //     </div>
// //   );
// // }

// // function BrxProgress({ label, value, tone }) {
// //   return (
// //     <div className="brxProg">
// //       <div className="brxProgTop">
// //         <span className="brxProgLabel">{label}</span>
// //         <span className={`brxProgValue brxProgValue_${tone}`}>{value}/100</span>
// //       </div>
// //       <div className="brxProgTrack">
// //         <div className={`brxProgFill brxProgFill_${tone}`} style={{ width: `${value}%` }} />
// //       </div>
// //     </div>
// //   );
// // }

// // function BrxStress({ tone, title, value, sub }) {
// //   return (
// //     <div className={`brxStress brxStress_${tone}`}>
// //       <div className="brxStressTitle">{title}</div>
// //       <div className="brxStressValue">{value}</div>
// //       <div className="brxStressSub">{sub}</div>
// //     </div>
// //   );
// // }

// // function BrxRiskPill({ tone, text }) {
// //   return <span className={`brxPill brxPill_${tone}`}>{text}</span>;
// // }

// // function BrxMiniBar({ value }) {
// //   return (
// //     <div className="brxMiniBar" aria-hidden="true">
// //       <div className="brxMiniBarFill" style={{ width: `${value}%` }} />
// //     </div>
// //   );
// // }

// // /* -----------------------------
// //    Page
// // ------------------------------ */
// // export default function BubbleRisk() {
// //   const tip = useBrxTooltip();

// //   // Top controls (Search + Filter)
// //   const [query, setQuery] = useState("");
// //   const [status, setStatus] = useState("all");

// //   const kpis = useMemo(
// //     () => [
// //       {
// //         tone: "danger",
// //         icon: <BrxIcon.TrendUp className="brxSvgIcon" />,
// //         title: "Price vs Income Divergence",
// //         value: "4.2x",
// //         sub: ">3x = Warning",
// //       },
// //       {
// //         tone: "warn",
// //         icon: <BrxIcon.Home className="brxSvgIcon" />,
// //         title: "Price-to-Rent Ratio",
// //         value: "28.5",
// //         sub: ">25 = Elevated",
// //       },
// //       {
// //         tone: "danger",
// //         icon: <BrxIcon.Percent className="brxSvgIcon" />,
// //         title: "Investor Transactions",
// //         value: "34.2%",
// //         sub: ">30% = Speculation",
// //       },
// //       {
// //         tone: "neutral",
// //         icon: <BrxIcon.Building className="brxSvgIcon" />,
// //         title: "Vacancy Rate",
// //         value: "8.4%",
// //         sub: "YoY increase",
// //         chip: "+1.2%",
// //       },
// //     ],
// //     []
// //   );

// //   const labels = useMemo(
// //     () => ["Jul 23", "Aug 23", "Sep 23", "Oct 23", "Nov 23", "Dec 23", "Jan 24", "Feb 24", "Apr 24"],
// //     []
// //   );

// //   const series = useMemo(
// //     () => [
// //       {
// //         label: "Price Growth %",
// //         color: "var(--brx-red)",
// //         values: [8.2, 9.1, 10.4, 11.8, 13.2, 14.6, 15.9, 16.3, 18.4],
// //       },
// //       {
// //         label: "Income Growth %",
// //         color: "var(--brx-green)",
// //         values: [3.6, 3.8, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6],
// //       },
// //     ],
// //     []
// //   );

// //   const ai_tables = useMemo(
// //     () => ({ six: 68, twelve: 74, correctionProb: 42, liquidityStress: 35 }),
// //     []
// //   );

// //   const stressSignals = useMemo(
// //     () => [
// //       { tone: "danger", title: "Rapid resales (<12mo)", value: "2,340", sub: "~ +18.5% trend" },
// //       { tone: "warn", title: "Multiple properties/entity", value: "456", sub: "~ +12.3% trend" },
// //       { tone: "danger", title: "Debt-backed purchases", value: "8,920", sub: "~ +24.1% trend" },
// //       { tone: "warn", title: "Construction vs occupancy gap", value: "3,200", sub: "~ +8.4% trend" },
// //       { tone: "danger", title: "Foreign investment spike", value: "1,890", sub: "~ +42.5% trend" },
// //     ],
// //     []
// //   );

// //   const cities = useMemo(
// //     () => [
// //       { city: "Belgrade", risk: 78, price: "+18.4%", income: "+4.2%", div: "4.4x", status: "high" },
// //       { city: "Novi Sad", risk: 72, price: "+22.1%", income: "+5.1%", div: "4.3x", status: "high" },
// //       { city: "Niš", risk: 45, price: "+8.2%", income: "+4.8%", div: "1.7x", status: "medium" },
// //       { city: "Kragujevac", risk: 38, price: "+6.5%", income: "+3.9%", div: "1.7x", status: "low" },
// //       { city: "Subotica", risk: 52, price: "+12.4%", income: "+4.5%", div: "2.8x", status: "medium" },
// //       { city: "Pančevo", risk: 61, price: "+15.8%", income: "+5.2%", div: "3.0x", status: "medium" },
// //     ],
// //     []
// //   );

// //   const actions = useMemo(
// //     () => [
// //       { title: "Tighten LTV norms in Belgrade and Novi Sad", priority: "High" },
// //       { title: "Freeze subsidies in overheated zones", priority: "High" },
// //       { title: "Increase registration scrutiny for repeat buyers", priority: "High" },
// //       { title: "Monitor foreign investment inflows", priority: "High" },
// //     ],
// //     []
// //   );

// //   const filteredCities = useMemo(() => {
// //     const q = query.trim().toLowerCase();
// //     return cities.filter((r) => {
// //       const matchText =
// //         !q ||
// //         r.city.toLowerCase().includes(q) ||
// //         r.status.toLowerCase().includes(q) ||
// //         r.div.toLowerCase().includes(q);

// //       const matchStatus = status === "all" ? true : r.status === status;
// //       return matchText && matchStatus;
// //     });
// //   }, [cities, query, status]);

// //   const onPointEnter = (e, title, value) => tip.show(e, title, value);
// //   const onPointLeave = () => tip.hide();

// //   return (
// //     <div id="brxBubbleRisk" className="brxPage">
// //       <div className="brxTopLine" />

// //       <div className="brxWrap">
// //         <header className="brxHeader">
// //           <div className="brxHeaderTop">
// //             <div className="brxBadge">
// //               <BrxIcon.TrendUp className="brxBadgeIcon" />
// //               <span>Market Surveillance</span>
// //             </div>

// //             <div className="brxControls" role="search">
// //               <div className="brxSearch">
// //                 <BrxIcon.Search className="brxCtrlIcon" />
// //                 <input
// //                   value={query}
// //                   onChange={(e) => setQuery(e.target.value)}
// //                   className="brxInput"
// //                   placeholder="Search city, status, divergence…"
// //                   aria-label="Search"
// //                 />
// //                 {query ? (
// //                   <button className="brxClearBtn" type="button" onClick={() => setQuery("")} aria-label="Clear search">
// //                     ×
// //                   </button>
// //                 ) : null}
// //               </div>

// //               <div className="brxFilter">
// //                 <BrxIcon.Filter className="brxCtrlIcon" />
// //                 <select
// //                   className="brxSelect"
// //                   value={status}
// //                   onChange={(e) => setStatus(e.target.value)}
// //                   aria-label="Filter by status"
// //                 >
// //                   <option value="all">All</option>
// //                   <option value="high">High risk</option>
// //                   <option value="medium">Medium risk</option>
// //                   <option value="low">Low risk</option>
// //                 </select>
// //               </div>
// //             </div>
// //           </div>

// //           <h1 className="brxTitle">Bubble Protection Dashboard</h1>
// //           <p className="brxSub">Detect speculative bubbles before they become financial crises</p>
// //         </header>

// //         <section className="brxKpiGrid">
// //           {kpis.map((k, i) => (
// //             <BrxKpi key={i} {...k} />
// //           ))}
// //         </section>

// //         <section className="brxMainGrid">
// //           <div className="brxCard">
// //             <div className="brxCardHead">
// //               <h3 className="brxCardTitle">Price vs Income Growth Divergence</h3>
// //               <p className="brxCardHint">Growing gap indicates bubble formation</p>
// //             </div>

// //             <div
// //               className="brxCardBody brxChartBody"
// //               ref={tip.wrapRef}
// //               onMouseMove={tip.move}
// //               onMouseLeave={tip.hide}
// //             >
// //               <BrxLineChart
// //                 labels={labels}
// //                 series={series}
// //                 yMin={0}
// //                 yMax={20}
// //                 onPointEnter={onPointEnter}
// //                 onPointLeave={onPointLeave}
// //               />
// //               {tip.TooltipEl}
// //             </div>
// //           </div>

// //           <div className="brxCard">
// //             <div className="brxCardHead">
// //               <div className="brxCardHeadRow">
// //                 <h3 className="brxCardTitle">AI Forecast Panel</h3>
// //                 <span className="brxAiIcon">
// //                   <BrxIcon.Target className="brxSvgIcon" />
// //                 </span>
// //               </div>
// //             </div>

// //             <div className="brxCardBody">
// //               <BrxProgress label="6-Month Risk Score" value={ai_tables.six} tone="warn" />
// //               <div className="brxDivider" />
// //               <BrxProgress label="12-Month Risk Score" value={ai_tables.twelve} tone="danger" />
// //               <div className="brxDivider" />

// //               <div className="brxAiChips">
// //                 <div className="brxAiChip brxAiChip_danger">
// //                   <div className="brxAiChipValue">{ai_tables.correctionProb}%</div>
// //                   <div className="brxAiChipLabel">Correction Probability</div>
// //                 </div>
// //                 <div className="brxAiChip brxAiChip_warn">
// //                   <div className="brxAiChipValue">{ai_tables.liquidityStress}%</div>
// //                   <div className="brxAiChipLabel">Liquidity Stress</div>
// //                 </div>
// //               </div>
// //             </div>
// //           </div>
// //         </section>

// //         <section className="brxCard brxMt">
// //           <div className="brxCardHead">
// //             <div className="brxCardHeadRow">
// //               <h3 className="brxCardTitle">Market Stress Signals</h3>
// //               <span className="brxWarnDot" aria-hidden="true">
// //                 !
// //               </span>
// //             </div>
// //           </div>

// //           <div className="brxStressGrid">
// //             {stressSignals.map((s, i) => (
// //               <BrxStress key={i} {...s} />
// //             ))}
// //           </div>
// //         </section>

// //         <section className="brxCard brxMt">
// //           <div className="brxCardHead">
// //             <div className="brxCardHeadRow">
// //               <h3 className="brxCardTitle">City-Level Bubble Risk Assessment</h3>

// //               <div className="brxTableMeta">
// //                 <span className="brxCount">
// //                   Showing <b>{filteredCities.length}</b> / {cities.length}
// //                 </span>
// //               </div>
// //             </div>
// //           </div>

// //           <div className="brxTableWrap">
// //             <table className="brxTable">
// //               <thead>
// //                 <tr>
// //                   <th>City</th>
// //                   <th>Risk Score</th>
// //                   <th>Price Growth</th>
// //                   <th>Income Growth</th>
// //                   <th>Divergence</th>
// //                   <th>Status</th>
// //                 </tr>
// //               </thead>
// //               <tbody>
// //                 {filteredCities.map((r, i) => (
// //                   <tr key={i}>
// //                     <td className="brxCity">{r.city}</td>
// //                     <td>
// //                       <div className="brxRiskCell">
// //                         <BrxMiniBar value={r.risk} />
// //                         <span className="brxRiskNum">{r.risk}</span>
// //                       </div>
// //                     </td>
// //                     <td className="brxNeg">{r.price}</td>
// //                     <td className="brxPos">{r.income}</td>
// //                     <td className="brxDiv">{r.div}</td>
// //                     <td>
// //                       {r.status === "high" ? (
// //                         <BrxRiskPill tone="high" text="high risk" />
// //                       ) : r.status === "medium" ? (
// //                         <BrxRiskPill tone="med" text="medium risk" />
// //                       ) : (
// //                         <BrxRiskPill tone="low" text="low risk" />
// //                       )}
// //                     </td>
// //                   </tr>
// //                 ))}

// //                 {filteredCities.length === 0 ? (
// //                   <tr>
// //                     <td colSpan={6} className="brxEmpty">
// //                       No results found. Try a different search or filter.
// //                     </td>
// //                   </tr>
// //                 ) : null}
// //               </tbody>
// //             </table>
// //           </div>
// //         </section>

// //         <section className="brxCard brxMt">
// //           <div className="brxCardHead">
// //             <div className="brxCardHeadRow">
// //               <h3 className="brxCardTitle">Recommended Regulator Actions</h3>
// //               <span className="brxSpark">
// //                 <BrxIcon.Spark className="brxSvgIcon" />
// //               </span>
// //             </div>
// //             <p className="brxCardHint">AI-generated policy recommendations based on current indicators</p>
// //           </div>

// //           <div className="brxActionsGrid">
// //             {actions.map((a, i) => (
// //               <div key={i} className="brxActionCard">
// //                 <span className="brxActionDot" aria-hidden="true" />
// //                 <div>
// //                   <div className="brxActionTitle">{a.title}</div>
// //                   <div className="brxActionMeta">Priority: {a.priority}</div>
// //                 </div>
// //               </div>
// //             ))}
// //           </div>

// //           <div className="brxBtns">
// //             <button className="brxBtn brxBtn_primary" type="button">
// //               Generate Detailed Report
// //             </button>
// //             <button className="brxBtn brxBtn_secondary" type="button">
// //               Schedule Review Meeting
// //             </button>
// //           </div>
// //         </section>

// //         <div className="brxSpacer" />
// //       </div>
// //     </div>
// //   );
// // }
