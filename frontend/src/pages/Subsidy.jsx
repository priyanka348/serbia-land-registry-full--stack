// src/pages/Subsidy.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Subsidy.css";
import Header from "../components/Header";
import Navbar from "../components/Navbar";
import { fetchSubsidyData, fetchDashboardStats } from "../utils/api";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const Currency = ({ value }) => {
  if (value === null || value === undefined) return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `€${num.toFixed(1)}M`;
};

const Percent = ({ value, decimals = 1 }) => {
  if (value === null || value === undefined) return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `${num.toFixed(decimals)}%`;
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// ── Static label structures ─────────────────────────────────
// Labels (bracket names, city names) NEVER change.
// Only the financial values get scaled from the API totals.

const INCOME_BRACKETS = [
  { bracket: "< €5,000",          defaultAllocated: 28.5, defaultUtilized: 24.8 },
  { bracket: "€5,000 – €10,000",  defaultAllocated: 35.2, defaultUtilized: 28.1 },
  { bracket: "€10,000 – €15,000", defaultAllocated: 22.8, defaultUtilized: 16.2 },
  { bracket: "€15,000 – €20,000", defaultAllocated:  8.5, defaultUtilized:  5.1 },
  { bracket: "> €20,000",          defaultAllocated:  3.5, defaultUtilized:  2.0 },
];

const CITY_LABELS = [
  { city: "Belgrade",      defaultBudget: 45.0, defaultUtilized: 38.0 },
  { city: "Južna Bačka",   defaultBudget: 18.0, defaultUtilized: 14.5 },
  { city: "Nišava",        defaultBudget: 12.0, defaultUtilized:  9.0 },
  { city: "Šumadija",      defaultBudget:  9.0, defaultUtilized:  6.8 },
  { city: "Severna Bačka", defaultBudget:  8.5, defaultUtilized:  6.5 },
  { city: "Raška",         defaultBudget:  7.5, defaultUtilized:  5.5 },
  { city: "Zlatibor",      defaultBudget:  6.5, defaultUtilized:  4.8 },
  { city: "Srem",          defaultBudget:  6.0, defaultUtilized:  4.5 },
  { city: "Mačva",         defaultBudget:  5.5, defaultUtilized:  4.0 },
  { city: "Rasina",        defaultBudget:  5.0, defaultUtilized:  3.6 },
  { city: "Pomoravlje",    defaultBudget:  4.5, defaultUtilized:  3.2 },
  { city: "Zapadna Bačka", defaultBudget:  4.0, defaultUtilized:  2.9 },
  { city: "Braničevo",     defaultBudget:  3.8, defaultUtilized:  2.6 },
  { city: "Jablanica",     defaultBudget:  3.5, defaultUtilized:  2.4 },
  { city: "Moravica",      defaultBudget:  3.2, defaultUtilized:  2.2 },
  { city: "Kolubara",      defaultBudget:  3.0, defaultUtilized:  2.0 },
  { city: "Južni Banat",   defaultBudget:  2.8, defaultUtilized:  1.9 },
  { city: "Srednji Banat", defaultBudget:  2.6, defaultUtilized:  1.7 },
  { city: "Podunavlje",    defaultBudget:  2.4, defaultUtilized:  1.6 },
  { city: "Severni Banat", defaultBudget:  2.2, defaultUtilized:  1.5 },
  { city: "Toplica",       defaultBudget:  2.0, defaultUtilized:  1.3 },
  { city: "Pčinja",        defaultBudget:  1.9, defaultUtilized:  1.2 },
  { city: "Bor",           defaultBudget:  1.8, defaultUtilized:  1.1 },
  { city: "Zaječar",       defaultBudget:  1.7, defaultUtilized:  1.0 },
  { city: "Pirot",         defaultBudget:  1.5, defaultUtilized:  0.9 },
];

const ELIGIBILITY_DEFAULTS = [
  { bracket: "< €5,000",          allocated: 28.5, utilized: 24.8, beneficiaries: 4850, utilizationPct: 87, leakagePct: 1.8 },
  { bracket: "€5,000 – €10,000",  allocated: 35.2, utilized: 28.1, beneficiaries: 4200, utilizationPct: 80, leakagePct: 2.4 },
  { bracket: "€10,000 – €15,000", allocated: 22.8, utilized: 16.2, beneficiaries: 2400, utilizationPct: 71, leakagePct: 4.2 },
  { bracket: "€15,000 – €20,000", allocated:  8.5, utilized:  5.1, beneficiaries:  780, utilizationPct: 60, leakagePct: 5.8 },
  { bracket: "> €20,000",          allocated:  3.5, utilized:  2.0, beneficiaries:  220, utilizationPct: 57, leakagePct: 8.1 },
];

export default function Subsidy() {
  const navigate = useNavigate();

  // ── API State ──────────────────────────────────────────────
  const [subsidyData, setSubsidyData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      fetchSubsidyData(),
      fetchDashboardStats(),
    ]).then(([subRes]) => {
      if (subRes.status === "fulfilled") setSubsidyData(subRes.value?.data ?? null);
    }).finally(() => setLoading(false));
  }, []);

  const goBack = () => {
    const prev = sessionStorage.getItem("prev_path");
    if (prev) navigate(prev);
    else navigate("/overview");
  };

  // ── Core KPIs ─────────────────────────────────────────────
  const totalAllocatedRaw = subsidyData?.totalAllocated ?? 125000000;
  const totalDisbursedRaw = subsidyData?.totalDisbursed  ?? 76200000;
  const leakageRate       = subsidyData?.leakageRate     ?? 3.2;
  const fraudCount        = subsidyData?.fraudulentCases ?? 80;
  const totalApplications = subsidyData?.totalApplications ?? 12450;
  const completedApps     = subsidyData?.completedApplications ?? 8920;

  // Convert raw EUR → millions for display
  const totalBudgetM = parseFloat((totalAllocatedRaw / 1_000_000).toFixed(1));
  const allocatedM   = parseFloat((totalAllocatedRaw / 1_000_000).toFixed(1));
  const utilizedM    = parseFloat((totalDisbursedRaw  / 1_000_000).toFixed(1));
  const allocatedPct = totalBudgetM > 0 ? (allocatedM / totalBudgetM) * 100 : 0;
  const utilizedPct  = allocatedM   > 0 ? (utilizedM  / allocatedM)   * 100 : 0;

  const kpis = useMemo(() => ({
    totalBudget: totalBudgetM,
    allocated:   allocatedM,
    utilized:    utilizedM,
    leakagePct:  leakageRate,
  }), [totalBudgetM, allocatedM, utilizedM, leakageRate]);

  // ── byProgram aggregate totals for scaling ────────────────
  const byProgram = subsidyData?.byProgram ?? [];
  const apiTotalAllocated = byProgram.reduce((s, p) => s + (p.allocated || 0), 0);
  const apiTotalDisbursed = byProgram.reduce((s, p) => s + (p.disbursed  || 0), 0);
  const hasApiData = byProgram.length > 0 && apiTotalAllocated > 0;

  // ── Income Bracket Chart ──────────────────────────────────
  // Always keeps "< €5,000", "€5,000 – €10,000", etc. as X-axis labels.
  // When API data arrives, scale the bar values proportionally.
  const incomeData = useMemo(() => {
    if (hasApiData) {
      const defaultTotalAlloc = INCOME_BRACKETS.reduce((s, b) => s + b.defaultAllocated, 0);
      const defaultTotalUtil  = INCOME_BRACKETS.reduce((s, b) => s + b.defaultUtilized,  0);
      const allocRatio = (apiTotalAllocated / 1_000_000) / defaultTotalAlloc;
      const utilRatio  = (apiTotalDisbursed  / 1_000_000) / defaultTotalUtil;
      return INCOME_BRACKETS.map((b) => ({
        bracket:   b.bracket,
        allocated: parseFloat((b.defaultAllocated * allocRatio).toFixed(1)),
        utilized:  parseFloat((b.defaultUtilized  * utilRatio).toFixed(1)),
      }));
    }
    return INCOME_BRACKETS.map((b) => ({
      bracket:   b.bracket,
      allocated: b.defaultAllocated,
      utilized:  b.defaultUtilized,
    }));
  }, [hasApiData, apiTotalAllocated, apiTotalDisbursed]);

  // ── City Chart ────────────────────────────────────────────
  // Always keeps Belgrade, Novi Sad, Niš, Kragujevac, Other as Y-axis labels.
  // When API data arrives, scale the bar values proportionally.
  const cityData = useMemo(() => {
    if (hasApiData) {
      const defaultTotalBudget = CITY_LABELS.reduce((s, c) => s + c.defaultBudget,   0);
      const defaultTotalUtil   = CITY_LABELS.reduce((s, c) => s + c.defaultUtilized, 0);
      const budgetRatio = (apiTotalAllocated / 1_000_000) / defaultTotalBudget;
      const utilRatio   = (apiTotalDisbursed  / 1_000_000) / defaultTotalUtil;
      return CITY_LABELS.map((c) => ({
        city:     c.city,
        budget:   parseFloat((c.defaultBudget   * budgetRatio).toFixed(1)),
        utilized: parseFloat((c.defaultUtilized * utilRatio).toFixed(1)),
      }));
    }
    return CITY_LABELS.map((c) => ({
      city:     c.city,
      budget:   c.defaultBudget,
      utilized: c.defaultUtilized,
    }));
  }, [hasApiData, apiTotalAllocated, apiTotalDisbursed]);

  // ── Red Flags ─────────────────────────────────────────────
  const fraudBase = fraudCount > 0 ? fraudCount : 80;
  const redFlags = useMemo(() => [
    {
      title:  "Premium property subsidy",
      cases:  Math.round(fraudBase * 0.56),
      amount: `€${Math.round(fraudBase * 0.56 * 19.8)}K`,
    },
    {
      title:  "Repeated beneficiary",
      cases:  Math.round(fraudBase * 0.29),
      amount: `€${Math.round(fraudBase * 0.29 * 19.8)}K`,
    },
    {
      title:  "False documentation",
      cases:  Math.round(fraudBase * 0.15),
      amount: `€${Math.round(fraudBase * 0.15 * 28.3)}K`,
    },
  ], [fraudBase]);

  // ── Outcome Tracking ──────────────────────────────────────
  const deliveredUnits  = completedApps    || 8920;
  const subsidizedTotal = totalApplications || 12450;
  const deliveryRateVal = subsidizedTotal > 0
    ? parseFloat(((deliveredUnits / subsidizedTotal) * 100).toFixed(1))
    : 71.6;

  const outcome = useMemo(() => ({
    unitsDelivered:  deliveredUnits,
    totalSubsidized: subsidizedTotal,
    deliveryRate:    deliveryRateVal,
    deliveryDelta:   2.4,
    satisfaction:    7.8,
  }), [deliveredUnits, subsidizedTotal, deliveryRateVal]);

  // ── Eligibility Matrix ────────────────────────────────────
  // Always uses income bracket labels in column 1.
  // Financial values scaled from API totals when available.
  const eligibilityRows = useMemo(() => {
    if (hasApiData) {
      const defaultTotalAlloc = ELIGIBILITY_DEFAULTS.reduce((s, r) => s + r.allocated, 0);
      const defaultTotalUtil  = ELIGIBILITY_DEFAULTS.reduce((s, r) => s + r.utilized,  0);
      const defaultTotalBene  = ELIGIBILITY_DEFAULTS.reduce((s, r) => s + r.beneficiaries, 0);
      const allocRatio = (apiTotalAllocated / 1_000_000) / defaultTotalAlloc;
      const utilRatio  = (apiTotalDisbursed  / 1_000_000) / defaultTotalUtil;
      const beneRatio  = totalApplications > 0 ? totalApplications / defaultTotalBene : 1;
      const apiLeakage = parseFloat(leakageRate);

      return ELIGIBILITY_DEFAULTS.map((r) => ({
        bracket:        r.bracket,
        allocated:      parseFloat((r.allocated    * allocRatio).toFixed(1)),
        utilized:       parseFloat((r.utilized     * utilRatio).toFixed(1)),
        beneficiaries:  Math.round(r.beneficiaries * beneRatio),
        utilizationPct: Math.min(100, Math.round(r.utilizationPct * (utilRatio / Math.max(allocRatio, 0.01)))) || r.utilizationPct,
        leakagePct:     parseFloat((apiLeakage * (r.leakagePct / 3.2)).toFixed(1)) || r.leakagePct,
      }));
    }
    return ELIGIBILITY_DEFAULTS;
  }, [hasApiData, apiTotalAllocated, apiTotalDisbursed, totalApplications, leakageRate]);

  const leakageTone = (pct) => {
    if (pct <= 2.5) return "good";
    if (pct <= 5)   return "warn";
    return "bad";
  };

  return (
    <>
      <Header />
      <Navbar />

      <div className="subsidyPage">
        <div className="subsidyWrap">
          {/* Breadcrumb */}
          <div className="crumbRow">
            <button className="crumbBackBtn" onClick={goBack} type="button" aria-label="Back">
              ←
            </button>
            <span className="crumbText">Policy Dashboard</span>
            <span className="crumbSep">/</span>
            <span className="crumbText strong">Subsidy Allocation</span>
          </div>

          {/* Hero */}
          <div className="hero">
            <div className="heroBadge">
              <span className="heroBadgeIcon">▦</span>
              <span>Subsidy Management</span>
            </div>

            <h1 className="heroTitle">Subsidy Allocation Dashboard</h1>
            <p className="heroSub">
              Precise, targeted, leak-proof, and politically defensible subsidies
            </p>
          </div>

          {/* KPI Cards */}
          <div className="kpiGrid">
            <div className="card kpiCard">
              <div className="kpiTop">
                <div className="kpiLabel">
                  <span className="kpiDot neutral">□</span>
                  <span>Total Budget</span>
                </div>
              </div>
              <div className="kpiValue">
                <Currency value={kpis.totalBudget} />
              </div>
              <div className="kpiMeta">FY {new Date().getFullYear()} Allocation</div>
            </div>

            <div className="card kpiCard tintBlue">
              <div className="kpiTop">
                <div className="kpiLabel">
                  <span className="kpiDot blue">◎</span>
                  <span>Allocated</span>
                </div>
              </div>
              <div className="kpiValue">
                <Currency value={kpis.allocated} />
              </div>
              <div className="kpiProgress">
                <div className="barTrack">
                  <div
                    className="barFill blueFill"
                    style={{ width: `${clamp(allocatedPct, 0, 100)}%` }}
                  />
                </div>
                <div className="kpiFoot">
                  <span>
                    <Percent value={allocatedPct} /> of budget
                  </span>
                </div>
              </div>
            </div>

            <div className="card kpiCard tintGreen">
              <div className="kpiTop">
                <div className="kpiLabel">
                  <span className="kpiDot green">✓</span>
                  <span>Utilized</span>
                </div>
              </div>
              <div className="kpiValue">
                <Currency value={kpis.utilized} />
              </div>
              <div className="kpiProgress">
                <div className="barTrack">
                  <div
                    className="barFill greenFill"
                    style={{ width: `${clamp(utilizedPct, 0, 100)}%` }}
                  />
                </div>
                <div className="kpiFoot">
                  <span>
                    <Percent value={utilizedPct} /> utilization rate
                  </span>
                </div>
              </div>
            </div>

            <div className="card kpiCard tintRed">
              <div className="kpiTop">
                <div className="kpiLabel">
                  <span className="kpiDot red">▲</span>
                  <span>Leakage</span>
                </div>
              </div>
              <div className="kpiValue">
                <Percent value={kpis.leakagePct} />
              </div>
              <div className="kpiMeta">
                {subsidyData?.interpretation?.leakageLevel ?? "Mismatch / fraud detected"}
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="twoCol">
            <div className="card sectionCard">
              <div className="sectionHead">
                <h3>Allocation by Income Bracket</h3>
                <p>Budget vs utilization across income levels (€M)</p>
              </div>

              <div className="chartBox">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={incomeData} barCategoryGap={16}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="bracket" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => [`€${Number(v).toFixed(1)}M`, ""]} />
                    <Legend />
                    <Bar dataKey="allocated" name="Allocated" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="utilized"  name="Utilized"  fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card sectionCard">
              <div className="sectionHead">
                <h3>Allocation by City</h3>
                <p>Geographic distribution of subsidies (€M)</p>
              </div>

              <div className="chartBox">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={cityData} layout="vertical" barCategoryGap={14}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="city" tick={{ fontSize: 12 }} width={90} />
                    <Tooltip formatter={(v) => [`€${Number(v).toFixed(1)}M`, ""]} />
                    <Legend />
                    <Bar dataKey="budget"   name="Budget"   fill="#2563eb" radius={[0, 8, 8, 0]} />
                    <Bar dataKey="utilized" name="Utilized" fill="#10b981" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Red Flags */}
          <div className="card sectionCard">
            <div className="sectionHead">
              <div className="titleWithIcon">
                <span className="alertIcon">⚠</span>
                <div>
                  <h3>Subsidy Red Flags</h3>
                  <p>Anomalies and potential fraud indicators</p>
                </div>
              </div>
            </div>

            <div className="flagGrid">
              {redFlags.map((f) => (
                <div className="flagCard" key={f.title}>
                  <div className="flagTitle">{f.title}</div>
                  <div className="flagRow">
                    <div className="flagCases">
                      <span className="flagNum">{f.cases}</span>{" "}
                      <span className="flagSmall">cases</span>
                    </div>
                    <div className="flagAmt">{f.amount}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Outcome Tracking */}
          <div className="card sectionCard">
            <div className="sectionHead">
              <h3>Outcome Tracking</h3>
              <p>Measuring subsidy effectiveness and impact</p>
            </div>

            {/* Merged: Units Delivered + Delivery Rate into ONE card */}
            <div className="outcomeGrid">
              <div className="miniCard mergedOutcome">
                <div className="mergedTop">
                  <div className="miniIcon green">◎</div>
                  <div className="mergedPct">{outcome.deliveryRate.toFixed(1)}%</div>
                </div>

                <div className="mergedLabel">Delivery Rate</div>
                <div className="mergedDelta">↗ +{outcome.deliveryDelta.toFixed(1)}% vs last year</div>

                <div className="mergedNums">
                  <div className="mergedNumItem">
                    <div className="mergedNum">{outcome.unitsDelivered.toLocaleString()}</div>
                    <div className="mergedSub">Delivered</div>
                  </div>

                  <div className="mergedDivider" />

                  <div className="mergedNumItem">
                    <div className="mergedNum">{outcome.totalSubsidized.toLocaleString()}</div>
                    <div className="mergedSub">Subsidized</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="satisfaction">
              <div className="satLeft">
                <span className="star">☆</span>
                <div className="satTitle">Beneficiary Satisfaction Score</div>
              </div>

              <div className="satRight">
                <div className="satScore">{outcome.satisfaction.toFixed(1)}/10</div>
                <div className="satBar">
                  <div className="satTrack">
                    <div
                      className="satFill"
                      style={{
                        width: `${clamp((outcome.satisfaction / 10) * 100, 0, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Eligibility Matrix */}
          <div className="card sectionCard">
            <div className="sectionHead">
              <h3>Eligibility Matrix</h3>
              <p>Cross-filter: Income × Property Size × Location × First-time buyer</p>
            </div>

            <div className="tableWrap">
              <table className="matrix">
                <thead>
                  <tr>
                    <th>Income Bracket</th>
                    <th>Allocated</th>
                    <th>Utilized</th>
                    <th>Beneficiaries</th>
                    <th>Utilization %</th>
                    <th>Leakage %</th>
                  </tr>
                </thead>

                <tbody>
                  {eligibilityRows.map((r) => (
                    <tr key={r.bracket}>
                      <td className="tdStrong">{r.bracket}</td>
                      <td>
                        <Currency value={r.allocated} />
                      </td>
                      <td>
                        <Currency value={r.utilized} />
                      </td>
                      <td>{r.beneficiaries.toLocaleString()}</td>
                      <td>
                        <div className="utilCell">
                          <div className="utilTrack">
                            <div
                              className="utilFill"
                              style={{ width: `${clamp(r.utilizationPct, 0, 100)}%` }}
                            />
                          </div>
                          <div className="utilPct">{r.utilizationPct}%</div>
                        </div>
                      </td>
                      <td>
                        <span className={`pill ${leakageTone(r.leakagePct)}`}>
                          {r.leakagePct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pageFooterPad" />
        </div>
      </div>
    </>
  );
}

// // src/pages/Subsidy.jsx
// import React, { useMemo, useState, useEffect } from "react";
// import { useNavigate } from "react-router-dom";
// import "./Subsidy.css";
// import Header from "../components/Header";
// import Navbar from "../components/Navbar";
// import { fetchSubsidyData, fetchDashboardStats } from "../utils/api";

// import {
//   ResponsiveContainer,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   Legend,
// } from "recharts";

// const Currency = ({ value }) => {
//   if (value === null || value === undefined) return "-";
//   const num = Number(value);
//   if (Number.isNaN(num)) return String(value);
//   return `€${num.toFixed(1)}M`;
// };

// const Percent = ({ value, decimals = 1 }) => {
//   if (value === null || value === undefined) return "-";
//   const num = Number(value);
//   if (Number.isNaN(num)) return String(value);
//   return `${num.toFixed(decimals)}%`;
// };

// const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// // ── Static label structures ─────────────────────────────────
// // Labels (bracket names, city names) NEVER change.
// // Only the financial values get scaled from the API totals.

// const INCOME_BRACKETS = [
//   { bracket: "< €5,000",          defaultAllocated: 28.5, defaultUtilized: 24.8 },
//   { bracket: "€5,000 – €10,000",  defaultAllocated: 35.2, defaultUtilized: 28.1 },
//   { bracket: "€10,000 – €15,000", defaultAllocated: 22.8, defaultUtilized: 16.2 },
//   { bracket: "€15,000 – €20,000", defaultAllocated:  8.5, defaultUtilized:  5.1 },
//   { bracket: "> €20,000",          defaultAllocated:  3.5, defaultUtilized:  2.0 },
// ];

// const CITY_LABELS = [
//   { city: "Belgrade",   defaultBudget: 45.0, defaultUtilized: 38.0 },
//   { city: "Novi Sad",   defaultBudget: 24.0, defaultUtilized: 19.5 },
//   { city: "Niš",        defaultBudget: 16.0, defaultUtilized: 12.0 },
//   { city: "Kragujevac", defaultBudget: 10.0, defaultUtilized:  7.2 },
//   { city: "Other",      defaultBudget: 12.0, defaultUtilized:  3.4 },
// ];

// const ELIGIBILITY_DEFAULTS = [
//   { bracket: "< €5,000",          allocated: 28.5, utilized: 24.8, beneficiaries: 4850, utilizationPct: 87, leakagePct: 1.8 },
//   { bracket: "€5,000 – €10,000",  allocated: 35.2, utilized: 28.1, beneficiaries: 4200, utilizationPct: 80, leakagePct: 2.4 },
//   { bracket: "€10,000 – €15,000", allocated: 22.8, utilized: 16.2, beneficiaries: 2400, utilizationPct: 71, leakagePct: 4.2 },
//   { bracket: "€15,000 – €20,000", allocated:  8.5, utilized:  5.1, beneficiaries:  780, utilizationPct: 60, leakagePct: 5.8 },
//   { bracket: "> €20,000",          allocated:  3.5, utilized:  2.0, beneficiaries:  220, utilizationPct: 57, leakagePct: 8.1 },
// ];

// export default function Subsidy() {
//   const navigate = useNavigate();

//   // ── API State ──────────────────────────────────────────────
//   const [subsidyData, setSubsidyData] = useState(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     setLoading(true);
//     Promise.allSettled([
//       fetchSubsidyData(),
//       fetchDashboardStats(),
//     ]).then(([subRes]) => {
//       if (subRes.status === "fulfilled") setSubsidyData(subRes.value?.data ?? null);
//     }).finally(() => setLoading(false));
//   }, []);

//   const goBack = () => {
//     const prev = sessionStorage.getItem("prev_path");
//     if (prev) navigate(prev);
//     else navigate("/overview");
//   };

//   // ── Core KPIs ─────────────────────────────────────────────
//   const totalAllocatedRaw = subsidyData?.totalAllocated ?? 125000000;
//   const totalDisbursedRaw = subsidyData?.totalDisbursed  ?? 76200000;
//   const leakageRate       = subsidyData?.leakageRate     ?? 3.2;
//   const fraudCount        = subsidyData?.fraudulentCases ?? 80;
//   const totalApplications = subsidyData?.totalApplications ?? 12450;
//   const completedApps     = subsidyData?.completedApplications ?? 8920;

//   // Convert raw EUR → millions for display
//   const totalBudgetM = parseFloat((totalAllocatedRaw / 1_000_000).toFixed(1));
//   const allocatedM   = parseFloat((totalAllocatedRaw / 1_000_000).toFixed(1));
//   const utilizedM    = parseFloat((totalDisbursedRaw  / 1_000_000).toFixed(1));
//   const allocatedPct = totalBudgetM > 0 ? (allocatedM / totalBudgetM) * 100 : 0;
//   const utilizedPct  = allocatedM   > 0 ? (utilizedM  / allocatedM)   * 100 : 0;

//   const kpis = useMemo(() => ({
//     totalBudget: totalBudgetM,
//     allocated:   allocatedM,
//     utilized:    utilizedM,
//     leakagePct:  leakageRate,
//   }), [totalBudgetM, allocatedM, utilizedM, leakageRate]);

//   // ── byProgram aggregate totals for scaling ────────────────
//   const byProgram = subsidyData?.byProgram ?? [];
//   const apiTotalAllocated = byProgram.reduce((s, p) => s + (p.allocated || 0), 0);
//   const apiTotalDisbursed = byProgram.reduce((s, p) => s + (p.disbursed  || 0), 0);
//   const hasApiData = byProgram.length > 0 && apiTotalAllocated > 0;

//   // ── Income Bracket Chart ──────────────────────────────────
//   // Always keeps "< €5,000", "€5,000 – €10,000", etc. as X-axis labels.
//   // When API data arrives, scale the bar values proportionally.
//   const incomeData = useMemo(() => {
//     if (hasApiData) {
//       const defaultTotalAlloc = INCOME_BRACKETS.reduce((s, b) => s + b.defaultAllocated, 0);
//       const defaultTotalUtil  = INCOME_BRACKETS.reduce((s, b) => s + b.defaultUtilized,  0);
//       const allocRatio = (apiTotalAllocated / 1_000_000) / defaultTotalAlloc;
//       const utilRatio  = (apiTotalDisbursed  / 1_000_000) / defaultTotalUtil;
//       return INCOME_BRACKETS.map((b) => ({
//         bracket:   b.bracket,
//         allocated: parseFloat((b.defaultAllocated * allocRatio).toFixed(1)),
//         utilized:  parseFloat((b.defaultUtilized  * utilRatio).toFixed(1)),
//       }));
//     }
//     return INCOME_BRACKETS.map((b) => ({
//       bracket:   b.bracket,
//       allocated: b.defaultAllocated,
//       utilized:  b.defaultUtilized,
//     }));
//   }, [hasApiData, apiTotalAllocated, apiTotalDisbursed]);

//   // ── City Chart ────────────────────────────────────────────
//   // Always keeps Belgrade, Novi Sad, Niš, Kragujevac, Other as Y-axis labels.
//   // When API data arrives, scale the bar values proportionally.
//   const cityData = useMemo(() => {
//     if (hasApiData) {
//       const defaultTotalBudget = CITY_LABELS.reduce((s, c) => s + c.defaultBudget,   0);
//       const defaultTotalUtil   = CITY_LABELS.reduce((s, c) => s + c.defaultUtilized, 0);
//       const budgetRatio = (apiTotalAllocated / 1_000_000) / defaultTotalBudget;
//       const utilRatio   = (apiTotalDisbursed  / 1_000_000) / defaultTotalUtil;
//       return CITY_LABELS.map((c) => ({
//         city:     c.city,
//         budget:   parseFloat((c.defaultBudget   * budgetRatio).toFixed(1)),
//         utilized: parseFloat((c.defaultUtilized * utilRatio).toFixed(1)),
//       }));
//     }
//     return CITY_LABELS.map((c) => ({
//       city:     c.city,
//       budget:   c.defaultBudget,
//       utilized: c.defaultUtilized,
//     }));
//   }, [hasApiData, apiTotalAllocated, apiTotalDisbursed]);

//   // ── Red Flags ─────────────────────────────────────────────
//   const fraudBase = fraudCount > 0 ? fraudCount : 80;
//   const redFlags = useMemo(() => [
//     {
//       title:  "Premium property subsidy",
//       cases:  Math.round(fraudBase * 0.56),
//       amount: `€${Math.round(fraudBase * 0.56 * 19.8)}K`,
//     },
//     {
//       title:  "Repeated beneficiary",
//       cases:  Math.round(fraudBase * 0.29),
//       amount: `€${Math.round(fraudBase * 0.29 * 19.8)}K`,
//     },
//     {
//       title:  "False documentation",
//       cases:  Math.round(fraudBase * 0.15),
//       amount: `€${Math.round(fraudBase * 0.15 * 28.3)}K`,
//     },
//   ], [fraudBase]);

//   // ── Outcome Tracking ──────────────────────────────────────
//   const deliveredUnits  = completedApps    || 8920;
//   const subsidizedTotal = totalApplications || 12450;
//   const deliveryRateVal = subsidizedTotal > 0
//     ? parseFloat(((deliveredUnits / subsidizedTotal) * 100).toFixed(1))
//     : 71.6;

//   const outcome = useMemo(() => ({
//     unitsDelivered:  deliveredUnits,
//     totalSubsidized: subsidizedTotal,
//     deliveryRate:    deliveryRateVal,
//     deliveryDelta:   2.4,
//     satisfaction:    7.8,
//   }), [deliveredUnits, subsidizedTotal, deliveryRateVal]);

//   // ── Eligibility Matrix ────────────────────────────────────
//   // Always uses income bracket labels in column 1.
//   // Financial values scaled from API totals when available.
//   const eligibilityRows = useMemo(() => {
//     if (hasApiData) {
//       const defaultTotalAlloc = ELIGIBILITY_DEFAULTS.reduce((s, r) => s + r.allocated, 0);
//       const defaultTotalUtil  = ELIGIBILITY_DEFAULTS.reduce((s, r) => s + r.utilized,  0);
//       const defaultTotalBene  = ELIGIBILITY_DEFAULTS.reduce((s, r) => s + r.beneficiaries, 0);
//       const allocRatio = (apiTotalAllocated / 1_000_000) / defaultTotalAlloc;
//       const utilRatio  = (apiTotalDisbursed  / 1_000_000) / defaultTotalUtil;
//       const beneRatio  = totalApplications > 0 ? totalApplications / defaultTotalBene : 1;
//       const apiLeakage = parseFloat(leakageRate);

//       return ELIGIBILITY_DEFAULTS.map((r) => ({
//         bracket:        r.bracket,
//         allocated:      parseFloat((r.allocated    * allocRatio).toFixed(1)),
//         utilized:       parseFloat((r.utilized     * utilRatio).toFixed(1)),
//         beneficiaries:  Math.round(r.beneficiaries * beneRatio),
//         utilizationPct: Math.min(100, Math.round(r.utilizationPct * (utilRatio / Math.max(allocRatio, 0.01)))) || r.utilizationPct,
//         leakagePct:     parseFloat((apiLeakage * (r.leakagePct / 3.2)).toFixed(1)) || r.leakagePct,
//       }));
//     }
//     return ELIGIBILITY_DEFAULTS;
//   }, [hasApiData, apiTotalAllocated, apiTotalDisbursed, totalApplications, leakageRate]);

//   const leakageTone = (pct) => {
//     if (pct <= 2.5) return "good";
//     if (pct <= 5)   return "warn";
//     return "bad";
//   };

//   return (
//     <>
//       <Header />
//       <Navbar />

//       <div className="subsidyPage">
//         <div className="subsidyWrap">
//           {/* Breadcrumb */}
//           <div className="crumbRow">
//             <button className="crumbBackBtn" onClick={goBack} type="button" aria-label="Back">
//               ←
//             </button>
//             <span className="crumbText">Policy Dashboard</span>
//             <span className="crumbSep">/</span>
//             <span className="crumbText strong">Subsidy Allocation</span>
//           </div>

//           {/* Hero */}
//           <div className="hero">
//             <div className="heroBadge">
//               <span className="heroBadgeIcon">▦</span>
//               <span>Subsidy Management</span>
//             </div>

//             <h1 className="heroTitle">Subsidy Allocation Dashboard</h1>
//             <p className="heroSub">
//               Precise, targeted, leak-proof, and politically defensible subsidies
//             </p>
//           </div>

//           {/* KPI Cards */}
//           <div className="kpiGrid">
//             <div className="card kpiCard">
//               <div className="kpiTop">
//                 <div className="kpiLabel">
//                   <span className="kpiDot neutral">□</span>
//                   <span>Total Budget</span>
//                 </div>
//               </div>
//               <div className="kpiValue">
//                 <Currency value={kpis.totalBudget} />
//               </div>
//               <div className="kpiMeta">FY {new Date().getFullYear()} Allocation</div>
//             </div>

//             <div className="card kpiCard tintBlue">
//               <div className="kpiTop">
//                 <div className="kpiLabel">
//                   <span className="kpiDot blue">◎</span>
//                   <span>Allocated</span>
//                 </div>
//               </div>
//               <div className="kpiValue">
//                 <Currency value={kpis.allocated} />
//               </div>
//               <div className="kpiProgress">
//                 <div className="barTrack">
//                   <div
//                     className="barFill blueFill"
//                     style={{ width: `${clamp(allocatedPct, 0, 100)}%` }}
//                   />
//                 </div>
//                 <div className="kpiFoot">
//                   <span>
//                     <Percent value={allocatedPct} /> of budget
//                   </span>
//                 </div>
//               </div>
//             </div>

//             <div className="card kpiCard tintGreen">
//               <div className="kpiTop">
//                 <div className="kpiLabel">
//                   <span className="kpiDot green">✓</span>
//                   <span>Utilized</span>
//                 </div>
//               </div>
//               <div className="kpiValue">
//                 <Currency value={kpis.utilized} />
//               </div>
//               <div className="kpiProgress">
//                 <div className="barTrack">
//                   <div
//                     className="barFill greenFill"
//                     style={{ width: `${clamp(utilizedPct, 0, 100)}%` }}
//                   />
//                 </div>
//                 <div className="kpiFoot">
//                   <span>
//                     <Percent value={utilizedPct} /> utilization rate
//                   </span>
//                 </div>
//               </div>
//             </div>

//             <div className="card kpiCard tintRed">
//               <div className="kpiTop">
//                 <div className="kpiLabel">
//                   <span className="kpiDot red">▲</span>
//                   <span>Leakage</span>
//                 </div>
//               </div>
//               <div className="kpiValue">
//                 <Percent value={kpis.leakagePct} />
//               </div>
//               <div className="kpiMeta">
//                 {subsidyData?.interpretation?.leakageLevel ?? "Mismatch / fraud detected"}
//               </div>
//             </div>
//           </div>

//           {/* Charts */}
//           <div className="twoCol">
//             <div className="card sectionCard">
//               <div className="sectionHead">
//                 <h3>Allocation by Income Bracket</h3>
//                 <p>Budget vs utilization across income levels (€M)</p>
//               </div>

//               <div className="chartBox">
//                 <ResponsiveContainer width="100%" height={280}>
//                   <BarChart data={incomeData} barCategoryGap={16}>
//                     <CartesianGrid vertical={false} strokeDasharray="3 3" />
//                     <XAxis dataKey="bracket" tick={{ fontSize: 12 }} />
//                     <YAxis tick={{ fontSize: 12 }} />
//                     <Tooltip formatter={(v) => [`€${Number(v).toFixed(1)}M`, ""]} />
//                     <Legend />
//                     <Bar dataKey="allocated" name="Allocated" fill="#2563eb" radius={[6, 6, 0, 0]} />
//                     <Bar dataKey="utilized"  name="Utilized"  fill="#10b981" radius={[6, 6, 0, 0]} />
//                   </BarChart>
//                 </ResponsiveContainer>
//               </div>
//             </div>

//             <div className="card sectionCard">
//               <div className="sectionHead">
//                 <h3>Allocation by City</h3>
//                 <p>Geographic distribution of subsidies (€M)</p>
//               </div>

//               <div className="chartBox">
//                 <ResponsiveContainer width="100%" height={280}>
//                   <BarChart data={cityData} layout="vertical" barCategoryGap={14}>
//                     <CartesianGrid horizontal={false} strokeDasharray="3 3" />
//                     <XAxis type="number" tick={{ fontSize: 12 }} />
//                     <YAxis type="category" dataKey="city" tick={{ fontSize: 12 }} width={90} />
//                     <Tooltip formatter={(v) => [`€${Number(v).toFixed(1)}M`, ""]} />
//                     <Legend />
//                     <Bar dataKey="budget"   name="Budget"   fill="#2563eb" radius={[0, 8, 8, 0]} />
//                     <Bar dataKey="utilized" name="Utilized" fill="#10b981" radius={[0, 8, 8, 0]} />
//                   </BarChart>
//                 </ResponsiveContainer>
//               </div>
//             </div>
//           </div>

//           {/* Red Flags */}
//           <div className="card sectionCard">
//             <div className="sectionHead">
//               <div className="titleWithIcon">
//                 <span className="alertIcon">⚠</span>
//                 <div>
//                   <h3>Subsidy Red Flags</h3>
//                   <p>Anomalies and potential fraud indicators</p>
//                 </div>
//               </div>
//             </div>

//             <div className="flagGrid">
//               {redFlags.map((f) => (
//                 <div className="flagCard" key={f.title}>
//                   <div className="flagTitle">{f.title}</div>
//                   <div className="flagRow">
//                     <div className="flagCases">
//                       <span className="flagNum">{f.cases}</span>{" "}
//                       <span className="flagSmall">cases</span>
//                     </div>
//                     <div className="flagAmt">{f.amount}</div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>

//           {/* Outcome Tracking */}
//           <div className="card sectionCard">
//             <div className="sectionHead">
//               <h3>Outcome Tracking</h3>
//               <p>Measuring subsidy effectiveness and impact</p>
//             </div>

//             {/* Merged: Units Delivered + Delivery Rate into ONE card */}
//             <div className="outcomeGrid">
//               <div className="miniCard mergedOutcome">
//                 <div className="mergedTop">
//                   <div className="miniIcon green">◎</div>
//                   <div className="mergedPct">{outcome.deliveryRate.toFixed(1)}%</div>
//                 </div>

//                 <div className="mergedLabel">Delivery Rate</div>
//                 <div className="mergedDelta">↗ +{outcome.deliveryDelta.toFixed(1)}% vs last year</div>

//                 <div className="mergedNums">
//                   <div className="mergedNumItem">
//                     <div className="mergedNum">{outcome.unitsDelivered.toLocaleString()}</div>
//                     <div className="mergedSub">Delivered</div>
//                   </div>

//                   <div className="mergedDivider" />

//                   <div className="mergedNumItem">
//                     <div className="mergedNum">{outcome.totalSubsidized.toLocaleString()}</div>
//                     <div className="mergedSub">Subsidized</div>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             <div className="satisfaction">
//               <div className="satLeft">
//                 <span className="star">☆</span>
//                 <div className="satTitle">Beneficiary Satisfaction Score</div>
//               </div>

//               <div className="satRight">
//                 <div className="satScore">{outcome.satisfaction.toFixed(1)}/10</div>
//                 <div className="satBar">
//                   <div className="satTrack">
//                     <div
//                       className="satFill"
//                       style={{
//                         width: `${clamp((outcome.satisfaction / 10) * 100, 0, 100)}%`,
//                       }}
//                     />
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Eligibility Matrix */}
//           <div className="card sectionCard">
//             <div className="sectionHead">
//               <h3>Eligibility Matrix</h3>
//               <p>Cross-filter: Income × Property Size × Location × First-time buyer</p>
//             </div>

//             <div className="tableWrap">
//               <table className="matrix">
//                 <thead>
//                   <tr>
//                     <th>Income Bracket</th>
//                     <th>Allocated</th>
//                     <th>Utilized</th>
//                     <th>Beneficiaries</th>
//                     <th>Utilization %</th>
//                     <th>Leakage %</th>
//                   </tr>
//                 </thead>

//                 <tbody>
//                   {eligibilityRows.map((r) => (
//                     <tr key={r.bracket}>
//                       <td className="tdStrong">{r.bracket}</td>
//                       <td>
//                         <Currency value={r.allocated} />
//                       </td>
//                       <td>
//                         <Currency value={r.utilized} />
//                       </td>
//                       <td>{r.beneficiaries.toLocaleString()}</td>
//                       <td>
//                         <div className="utilCell">
//                           <div className="utilTrack">
//                             <div
//                               className="utilFill"
//                               style={{ width: `${clamp(r.utilizationPct, 0, 100)}%` }}
//                             />
//                           </div>
//                           <div className="utilPct">{r.utilizationPct}%</div>
//                         </div>
//                       </td>
//                       <td>
//                         <span className={`pill ${leakageTone(r.leakagePct)}`}>
//                           {r.leakagePct.toFixed(1)}%
//                         </span>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </div>

//           <div className="pageFooterPad" />
//         </div>
//       </div>
//     </>
//   );
// }

// // src/pages/Subsidy.jsx
// import React, { useMemo, useState, useEffect } from "react";
// import { useNavigate } from "react-router-dom";
// import "./Subsidy.css";
// import Header from "../components/Header";
// import Navbar from "../components/Navbar";
// import { fetchSubsidyData, fetchDashboardStats } from "../utils/api";

// import {
//   ResponsiveContainer,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   Legend,
// } from "recharts";

// const Currency = ({ value }) => {
//   if (value === null || value === undefined) return "-";
//   const num = Number(value);
//   if (Number.isNaN(num)) return String(value);
//   return `€${num.toFixed(1)}M`;
// };

// const Percent = ({ value, decimals = 1 }) => {
//   if (value === null || value === undefined) return "-";
//   const num = Number(value);
//   if (Number.isNaN(num)) return String(value);
//   return `${num.toFixed(decimals)}%`;
// };

// const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// export default function Subsidy() {
//   const navigate = useNavigate();

//   // ── API State ──────────────────────────────────────────────
//   const [subsidyData, setSubsidyData] = useState(null);
//   const [statsData,   setStatsData]   = useState(null);
//   const [loading,     setLoading]     = useState(true);

//   useEffect(() => {
//     setLoading(true);
//     Promise.allSettled([
//       fetchSubsidyData(),
//       fetchDashboardStats(),
//     ]).then(([subRes, statsRes]) => {
//       if (subRes.status   === "fulfilled") setSubsidyData(subRes.value?.data   ?? null);
//       if (statsRes.status === "fulfilled") setStatsData(statsRes.value?.data   ?? null);
//     }).finally(() => setLoading(false));
//   }, []);

//   const goBack = () => {
//     const prev = sessionStorage.getItem("prev_path");
//     if (prev) navigate(prev);
//     else navigate("/overview");
//   };

//   // ── Core KPIs from /api/dashboard/subsidy ─────────────────
//   const totalAllocatedRaw = subsidyData?.totalAllocated ?? 98500000;
//   const totalDisbursedRaw = subsidyData?.totalDisbursed ?? 72900000;
//   const utilizationRate   = subsidyData?.utilizationRate ?? 73.5;
//   const leakageRate       = subsidyData?.leakageRate     ?? 3.2;
//   const fraudCount        = subsidyData?.fraudulentCases ?? 80;
//   const totalApplications = subsidyData?.totalApplications ?? 0;
//   const approvedApps      = subsidyData?.approvedApplications ?? 0;
//   const completedApps     = subsidyData?.completedApplications ?? 0;

//   // Convert raw EUR to millions for display
//   const totalBudgetM    = parseFloat((totalAllocatedRaw / 1_000_000).toFixed(1));
//   const allocatedM      = parseFloat((totalAllocatedRaw / 1_000_000).toFixed(1));
//   const utilizedM       = parseFloat((totalDisbursedRaw / 1_000_000).toFixed(1));
//   const allocatedPct    = totalBudgetM > 0 ? (allocatedM / totalBudgetM) * 100 : 0;
//   const utilizedPct     = allocatedM   > 0 ? (utilizedM  / allocatedM)   * 100 : 0;

//   // ── byProgram from API → used for charts ──────────────────
//   // Shape: [{ programName, allocated, disbursed, utilizationRate, beneficiaries, completionRate }]
//   const byProgram = subsidyData?.byProgram ?? [];

//   // City data: built from byProgram (programs often map to regions/cities)
//   // If byProgram has data, use it; otherwise fallback
//   const cityData = byProgram.length > 0
//     ? byProgram.slice(0, 5).map((p) => ({
//         city: p.programName,
//         budget:   parseFloat((p.allocated  / 1_000_000).toFixed(1)),
//         utilized: parseFloat((p.disbursed  / 1_000_000).toFixed(1)),
//       }))
//     : [
//         { city: "Belgrade",    budget: 45.0, utilized: 38.0 },
//         { city: "Novi Sad",    budget: 24.0, utilized: 19.5 },
//         { city: "Niš",         budget: 16.0, utilized: 12.0 },
//         { city: "Kragujevac",  budget: 10.0, utilized:  7.2 },
//         { city: "Other",       budget: 12.0, utilized:  3.4 },
//       ];

//   // Income bracket data: derived from byProgram utilization rates
//   // Map program names to income brackets where possible
//   const incomeData = byProgram.length > 0
//     ? byProgram.map((p) => ({
//         bracket:  p.programName,
//         allocated: parseFloat((p.allocated / 1_000_000).toFixed(1)),
//         utilized:  parseFloat((p.disbursed  / 1_000_000).toFixed(1)),
//       }))
//     : [
//         { bracket: "< €5,000",         allocated: 28.5, utilized: 24.8 },
//         { bracket: "€5,000 – €10,000", allocated: 35.2, utilized: 28.1 },
//         { bracket: "€10,000 – €15,000",allocated: 22.8, utilized: 16.2 },
//         { bracket: "€15,000 – €20,000",allocated:  8.5, utilized:  5.1 },
//         { bracket: "> €20,000",         allocated:  3.5, utilized:  2.0 },
//       ];

//   // ── Red Flags: derived from subsidyData fraud fields ──────
//   // Subsidy model has fraudFlags with flagType enum
//   // fraudulentCases count + leakageRate → compute case breakdown
//   const fraudBase = fraudCount > 0 ? fraudCount : 80;
//   const redFlags = [
//     {
//       title:  "Premium property subsidy",
//       cases:  Math.round(fraudBase * 0.56),
//       amount: `€${Math.round(fraudBase * 0.56 * 19.8)}K`,
//     },
//     {
//       title:  "Repeated beneficiary",
//       cases:  Math.round(fraudBase * 0.29),
//       amount: `€${Math.round(fraudBase * 0.29 * 19.8)}K`,
//     },
//     {
//       title:  "False documentation",
//       cases:  Math.round(fraudBase * 0.15),
//       amount: `€${Math.round(fraudBase * 0.15 * 28.3)}K`,
//     },
//   ];

//   // ── Outcome tracking: from approved/completed counts ───────
//   const deliveredUnits  = completedApps || 8920;
//   const subsidizedTotal = totalApplications || 12450;
//   const deliveryRate    = subsidizedTotal > 0
//     ? parseFloat(((deliveredUnits / subsidizedTotal) * 100).toFixed(1))
//     : utilizationRate;

//   const outcome = {
//     unitsDelivered:  deliveredUnits,
//     totalSubsidized: subsidizedTotal,
//     deliveryRate,
//     deliveryDelta:   2.4,   // would need historical data
//     satisfaction:    7.8,   // would need survey data
//   };

//   // ── Eligibility Matrix: from byProgram with utilization ───
//   const eligibilityRows = byProgram.length > 0
//     ? byProgram.map((p) => ({
//         bracket:        p.programName,
//         allocated:      parseFloat((p.allocated / 1_000_000).toFixed(1)),
//         utilized:       parseFloat((p.disbursed  / 1_000_000).toFixed(1)),
//         beneficiaries:  p.beneficiaries,
//         utilizationPct: parseFloat(p.utilizationRate),
//         leakagePct:     p.allocated > 0
//           ? parseFloat(((fraudBase / (totalApplications || 1)) * 100).toFixed(1))
//           : 3.2,
//       }))
//     : [
//         { bracket: "< €5,000",          allocated: 28.5, utilized: 24.8, beneficiaries: 4850, utilizationPct: 87, leakagePct: 1.8 },
//         { bracket: "€5,000 – €10,000",  allocated: 35.2, utilized: 28.1, beneficiaries: 4200, utilizationPct: 80, leakagePct: 2.4 },
//         { bracket: "€10,000 – €15,000", allocated: 22.8, utilized: 16.2, beneficiaries: 2400, utilizationPct: 71, leakagePct: 4.2 },
//         { bracket: "€15,000 – €20,000", allocated:  8.5, utilized:  5.1, beneficiaries:  780, utilizationPct: 60, leakagePct: 5.8 },
//         { bracket: "> €20,000",          allocated:  3.5, utilized:  2.0, beneficiaries:  220, utilizationPct: 57, leakagePct: 8.1 },
//       ];

//   const leakageTone = (pct) => {
//     if (pct <= 2.5) return "good";
//     if (pct <= 5)   return "warn";
//     return "bad";
//   };

//   return (
//     <>
//       <Header />
//       <Navbar />

//       <div className="subsidyPage">
//         <div className="subsidyWrap">
//           {/* Breadcrumb */}
//           <div className="crumbRow">
//             <button className="crumbBackBtn" onClick={goBack} type="button" aria-label="Back">
//               ←
//             </button>
//             <span className="crumbText">Policy Dashboard</span>
//             <span className="crumbSep">/</span>
//             <span className="crumbText strong">Subsidy Allocation</span>
//           </div>

//           {/* Hero */}
//           <div className="hero">
//             <div className="heroBadge">
//               <span className="heroBadgeIcon">▦</span>
//               <span>Subsidy Management</span>
//             </div>

//             <h1 className="heroTitle">Subsidy Allocation Dashboard</h1>
//             <p className="heroSub">
//               Precise, targeted, leak-proof, and politically defensible subsidies
//             </p>
//           </div>

//           {/* KPI Cards */}
//           <div className="kpiGrid">
//             <div className="card kpiCard">
//               <div className="kpiTop">
//                 <div className="kpiLabel">
//                   <span className="kpiDot neutral">□</span>
//                   <span>Total Budget</span>
//                 </div>
//               </div>
//               <div className="kpiValue">
//                 <Currency value={totalBudgetM} />
//               </div>
//               <div className="kpiMeta">FY {new Date().getFullYear()} Allocation</div>
//             </div>

//             <div className="card kpiCard tintBlue">
//               <div className="kpiTop">
//                 <div className="kpiLabel">
//                   <span className="kpiDot blue">◎</span>
//                   <span>Allocated</span>
//                 </div>
//               </div>
//               <div className="kpiValue">
//                 <Currency value={allocatedM} />
//               </div>
//               <div className="kpiProgress">
//                 <div className="barTrack">
//                   <div
//                     className="barFill blueFill"
//                     style={{ width: `${clamp(allocatedPct, 0, 100)}%` }}
//                   />
//                 </div>
//                 <div className="kpiFoot">
//                   <span>
//                     <Percent value={allocatedPct} /> of budget
//                   </span>
//                 </div>
//               </div>
//             </div>

//             <div className="card kpiCard tintGreen">
//               <div className="kpiTop">
//                 <div className="kpiLabel">
//                   <span className="kpiDot green">✓</span>
//                   <span>Utilized</span>
//                 </div>
//               </div>
//               <div className="kpiValue">
//                 <Currency value={utilizedM} />
//               </div>
//               <div className="kpiProgress">
//                 <div className="barTrack">
//                   <div
//                     className="barFill greenFill"
//                     style={{ width: `${clamp(utilizedPct, 0, 100)}%` }}
//                   />
//                 </div>
//                 <div className="kpiFoot">
//                   <span>
//                     <Percent value={utilizedPct} /> utilization rate
//                   </span>
//                 </div>
//               </div>
//             </div>

//             <div className="card kpiCard tintRed">
//               <div className="kpiTop">
//                 <div className="kpiLabel">
//                   <span className="kpiDot red">▲</span>
//                   <span>Leakage</span>
//                 </div>
//               </div>
//               <div className="kpiValue">
//                 <Percent value={leakageRate} />
//               </div>
//               <div className="kpiMeta">
//                 {subsidyData?.interpretation?.leakageLevel ?? "Mismatch / fraud detected"}
//               </div>
//             </div>
//           </div>

//           {/* Charts */}
//           <div className="twoCol">
//             <div className="card sectionCard">
//               <div className="sectionHead">
//                 <h3>Allocation by Income Bracket</h3>
//                 <p>Budget vs utilization across income levels (€M)</p>
//               </div>

//               <div className="chartBox">
//                 <ResponsiveContainer width="100%" height={280}>
//                   <BarChart data={incomeData} barCategoryGap={16}>
//                     <CartesianGrid vertical={false} strokeDasharray="3 3" />
//                     <XAxis dataKey="bracket" tick={{ fontSize: 12 }} />
//                     <YAxis tick={{ fontSize: 12 }} />
//                     <Tooltip formatter={(v) => [`€${Number(v).toFixed(1)}M`, ""]} />
//                     <Legend />
//                     <Bar dataKey="allocated" name="Allocated" fill="#2563eb" radius={[6, 6, 0, 0]} />
//                     <Bar dataKey="utilized" name="Utilized" fill="#10b981" radius={[6, 6, 0, 0]} />
//                   </BarChart>
//                 </ResponsiveContainer>
//               </div>
//             </div>

//             <div className="card sectionCard">
//               <div className="sectionHead">
//                 <h3>Allocation by City</h3>
//                 <p>Geographic distribution of subsidies (€M)</p>
//               </div>

//               <div className="chartBox">
//                 <ResponsiveContainer width="100%" height={280}>
//                   <BarChart data={cityData} layout="vertical" barCategoryGap={14}>
//                     <CartesianGrid horizontal={false} strokeDasharray="3 3" />
//                     <XAxis type="number" tick={{ fontSize: 12 }} />
//                     <YAxis type="category" dataKey="city" tick={{ fontSize: 12 }} width={90} />
//                     <Tooltip formatter={(v) => [`€${Number(v).toFixed(1)}M`, ""]} />
//                     <Legend />
//                     <Bar dataKey="budget" name="Budget" fill="#2563eb" radius={[0, 8, 8, 0]} />
//                     <Bar dataKey="utilized" name="Utilized" fill="#10b981" radius={[0, 8, 8, 0]} />
//                   </BarChart>
//                 </ResponsiveContainer>
//               </div>
//             </div>
//           </div>

//           {/* Red Flags */}
//           <div className="card sectionCard">
//             <div className="sectionHead">
//               <div className="titleWithIcon">
//                 <span className="alertIcon">⚠</span>
//                 <div>
//                   <h3>Subsidy Red Flags</h3>
//                   <p>Anomalies and potential fraud indicators</p>
//                 </div>
//               </div>
//             </div>

//             <div className="flagGrid">
//               {redFlags.map((f) => (
//                 <div className="flagCard" key={f.title}>
//                   <div className="flagTitle">{f.title}</div>
//                   <div className="flagRow">
//                     <div className="flagCases">
//                       <span className="flagNum">{f.cases}</span>{" "}
//                       <span className="flagSmall">cases</span>
//                     </div>
//                     <div className="flagAmt">{f.amount}</div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>

//           {/* Outcome Tracking */}
//           <div className="card sectionCard">
//             <div className="sectionHead">
//               <h3>Outcome Tracking</h3>
//               <p>Measuring subsidy effectiveness and impact</p>
//             </div>

//             {/* ✅ Merged: Units Delivered + Delivery Rate into ONE card */}
//             <div className="outcomeGrid">
//               <div className="miniCard mergedOutcome">
//                 <div className="mergedTop">
//                   <div className="miniIcon green">◎</div>
//                   <div className="mergedPct">{outcome.deliveryRate.toFixed(1)}%</div>
//                 </div>

//                 <div className="mergedLabel">Delivery Rate</div>
//                 <div className="mergedDelta">↗ +{outcome.deliveryDelta.toFixed(1)}% vs last year</div>

//                 <div className="mergedNums">
//                   <div className="mergedNumItem">
//                     <div className="mergedNum">{outcome.unitsDelivered.toLocaleString()}</div>
//                     <div className="mergedSub">Delivered</div>
//                   </div>

//                   <div className="mergedDivider" />

//                   <div className="mergedNumItem">
//                     <div className="mergedNum">{outcome.totalSubsidized.toLocaleString()}</div>
//                     <div className="mergedSub">Subsidized</div>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             <div className="satisfaction">
//               <div className="satLeft">
//                 <span className="star">☆</span>
//                 <div className="satTitle">Beneficiary Satisfaction Score</div>
//               </div>

//               <div className="satRight">
//                 <div className="satScore">{outcome.satisfaction.toFixed(1)}/10</div>
//                 <div className="satBar">
//                   <div className="satTrack">
//                     <div
//                       className="satFill"
//                       style={{
//                         width: `${clamp((outcome.satisfaction / 10) * 100, 0, 100)}%`,
//                       }}
//                     />
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Eligibility Matrix */}
//           <div className="card sectionCard">
//             <div className="sectionHead">
//               <h3>Eligibility Matrix</h3>
//               <p>Cross-filter: Income × Property Size × Location × First-time buyer</p>
//             </div>

//             <div className="tableWrap">
//               <table className="matrix">
//                 <thead>
//                   <tr>
//                     <th>Income Bracket</th>
//                     <th>Allocated</th>
//                     <th>Utilized</th>
//                     <th>Beneficiaries</th>
//                     <th>Utilization %</th>
//                     <th>Leakage %</th>
//                   </tr>
//                 </thead>

//                 <tbody>
//                   {eligibilityRows.map((r) => (
//                     <tr key={r.bracket}>
//                       <td className="tdStrong">{r.bracket}</td>
//                       <td>
//                         <Currency value={r.allocated} />
//                       </td>
//                       <td>
//                         <Currency value={r.utilized} />
//                       </td>
//                       <td>{r.beneficiaries.toLocaleString()}</td>
//                       <td>
//                         <div className="utilCell">
//                           <div className="utilTrack">
//                             <div
//                               className="utilFill"
//                               style={{ width: `${clamp(r.utilizationPct, 0, 100)}%` }}
//                             />
//                           </div>
//                           <div className="utilPct">{r.utilizationPct}%</div>
//                         </div>
//                       </td>
//                       <td>
//                         <span className={`pill ${leakageTone(r.leakagePct)}`}>
//                           {r.leakagePct.toFixed(1)}%
//                         </span>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </div>

//           <div className="pageFooterPad" />
//         </div>
//       </div>
//     </>
//   );
// }

// src/pages/Subsidy.jsx
// import React, { useMemo, useState, useEffect } from "react";
// import { useNavigate } from "react-router-dom";
// import "./Subsidy.css";
// import Header from "../components/Header";
// import Navbar from "../components/Navbar";
// import { fetchSubsidyData, fetchDashboardStats } from "../utils/api";

// import {
//   ResponsiveContainer,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   Legend,
// } from "recharts";

// const Currency = ({ value }) => {
//   if (value === null || value === undefined) return "-";
//   const num = Number(value);
//   if (Number.isNaN(num)) return String(value);
//   return `€${num.toFixed(1)}M`;
// };

// const Percent = ({ value, decimals = 1 }) => {
//   if (value === null || value === undefined) return "-";
//   const num = Number(value);
//   if (Number.isNaN(num)) return String(value);
//   return `${num.toFixed(decimals)}%`;
// };

// const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// export default function Subsidy() {
//   const navigate = useNavigate();

//   // ── API State ──────────────────────────────────────────────
//   const [subsidyData, setSubsidyData] = useState(null);
//   const [statsData,   setStatsData]   = useState(null);
//   const [loading,     setLoading]     = useState(true);

//   useEffect(() => {
//     setLoading(true);
//     Promise.allSettled([
//       fetchSubsidyData(),
//       fetchDashboardStats(),
//     ]).then(([subRes, statsRes]) => {
//       if (subRes.status   === "fulfilled") setSubsidyData(subRes.value?.data   ?? null);
//       if (statsRes.status === "fulfilled") setStatsData(statsRes.value?.data   ?? null);
//     }).finally(() => setLoading(false));
//   }, []);

//   const goBack = () => {
//     const prev = sessionStorage.getItem("prev_path");
//     if (prev) navigate(prev);
//     else navigate("/overview");
//   };

//   // ── Core KPIs from /api/dashboard/subsidy ─────────────────
//   const totalAllocatedRaw = subsidyData?.totalAllocated ?? 98500000;
//   const totalDisbursedRaw = subsidyData?.totalDisbursed ?? 72900000;
//   const utilizationRate   = subsidyData?.utilizationRate ?? 73.5;
//   const leakageRate       = subsidyData?.leakageRate     ?? 3.2;
//   const fraudCount        = subsidyData?.fraudulentCases ?? 80;
//   const totalApplications = subsidyData?.totalApplications ?? 0;
//   const approvedApps      = subsidyData?.approvedApplications ?? 0;
//   const completedApps     = subsidyData?.completedApplications ?? 0;

//   // Convert raw EUR to millions for display
//   const totalBudgetM    = parseFloat((totalAllocatedRaw / 1_000_000).toFixed(1));
//   const allocatedM      = parseFloat((totalAllocatedRaw / 1_000_000).toFixed(1));
//   const utilizedM       = parseFloat((totalDisbursedRaw / 1_000_000).toFixed(1));
//   const allocatedPct    = totalBudgetM > 0 ? (allocatedM / totalBudgetM) * 100 : 0;
//   const utilizedPct     = allocatedM   > 0 ? (utilizedM  / allocatedM)   * 100 : 0;

//   // ── byProgram from API → used for charts ──────────────────
//   // Shape: [{ programName, allocated, disbursed, utilizationRate, beneficiaries, completionRate }]
//   const byProgram = subsidyData?.byProgram ?? [];

//   // City data: built from byProgram (programs often map to regions/cities)
//   // If byProgram has data, use it; otherwise fallback
//   const cityData = byProgram.length > 0
//     ? byProgram.slice(0, 5).map((p) => ({
//         city: p.programName,
//         budget:   parseFloat((p.allocated  / 1_000_000).toFixed(1)),
//         utilized: parseFloat((p.disbursed  / 1_000_000).toFixed(1)),
//       }))
//     : [
//         { city: "Belgrade",    budget: 45.0, utilized: 38.0 },
//         { city: "Novi Sad",    budget: 24.0, utilized: 19.5 },
//         { city: "Niš",         budget: 16.0, utilized: 12.0 },
//         { city: "Kragujevac",  budget: 10.0, utilized:  7.2 },
//         { city: "Other",       budget: 12.0, utilized:  3.4 },
//       ];

//   // Income bracket data: derived from byProgram utilization rates
//   // Map program names to income brackets where possible
//   const incomeData = byProgram.length > 0
//     ? byProgram.map((p) => ({
//         bracket:  p.programName,
//         allocated: parseFloat((p.allocated / 1_000_000).toFixed(1)),
//         utilized:  parseFloat((p.disbursed  / 1_000_000).toFixed(1)),
//       }))
//     : [
//         { bracket: "< €5,000",         allocated: 28.5, utilized: 24.8 },
//         { bracket: "€5,000 – €10,000", allocated: 35.2, utilized: 28.1 },
//         { bracket: "€10,000 – €15,000",allocated: 22.8, utilized: 16.2 },
//         { bracket: "€15,000 – €20,000",allocated:  8.5, utilized:  5.1 },
//         { bracket: "> €20,000",         allocated:  3.5, utilized:  2.0 },
//       ];

//   // ── Red Flags: derived from subsidyData fraud fields ──────
//   // Subsidy model has fraudFlags with flagType enum
//   // fraudulentCases count + leakageRate → compute case breakdown
//   const fraudBase = fraudCount > 0 ? fraudCount : 80;
//   const redFlags = [
//     {
//       title:  "Premium property subsidy",
//       cases:  Math.round(fraudBase * 0.56),
//       amount: `€${Math.round(fraudBase * 0.56 * 19.8)}K`,
//     },
//     {
//       title:  "Repeated beneficiary",
//       cases:  Math.round(fraudBase * 0.29),
//       amount: `€${Math.round(fraudBase * 0.29 * 19.8)}K`,
//     },
//     {
//       title:  "False documentation",
//       cases:  Math.round(fraudBase * 0.15),
//       amount: `€${Math.round(fraudBase * 0.15 * 28.3)}K`,
//     },
//   ];

//   // ── Outcome tracking: from approved/completed counts ───────
//   const deliveredUnits  = completedApps || 8920;
//   const subsidizedTotal = totalApplications || 12450;
//   const deliveryRate    = subsidizedTotal > 0
//     ? parseFloat(((deliveredUnits / subsidizedTotal) * 100).toFixed(1))
//     : utilizationRate;

//   const outcome = {
//     unitsDelivered:  deliveredUnits,
//     totalSubsidized: subsidizedTotal,
//     deliveryRate,
//     deliveryDelta:   2.4,   // would need historical data
//     satisfaction:    7.8,   // would need survey data
//   };

//   // ── Eligibility Matrix: from byProgram with utilization ───
//   const eligibilityRows = byProgram.length > 0
//     ? byProgram.map((p) => ({
//         bracket:        p.programName,
//         allocated:      parseFloat((p.allocated / 1_000_000).toFixed(1)),
//         utilized:       parseFloat((p.disbursed  / 1_000_000).toFixed(1)),
//         beneficiaries:  p.beneficiaries,
//         utilizationPct: parseFloat(p.utilizationRate),
//         leakagePct:     p.allocated > 0
//           ? parseFloat(((fraudBase / (totalApplications || 1)) * 100).toFixed(1))
//           : 3.2,
//       }))
//     : [
//         { bracket: "< €5,000",          allocated: 28.5, utilized: 24.8, beneficiaries: 4850, utilizationPct: 87, leakagePct: 1.8 },
//         { bracket: "€5,000 – €10,000",  allocated: 35.2, utilized: 28.1, beneficiaries: 4200, utilizationPct: 80, leakagePct: 2.4 },
//         { bracket: "€10,000 – €15,000", allocated: 22.8, utilized: 16.2, beneficiaries: 2400, utilizationPct: 71, leakagePct: 4.2 },
//         { bracket: "€15,000 – €20,000", allocated:  8.5, utilized:  5.1, beneficiaries:  780, utilizationPct: 60, leakagePct: 5.8 },
//         { bracket: "> €20,000",          allocated:  3.5, utilized:  2.0, beneficiaries:  220, utilizationPct: 57, leakagePct: 8.1 },
//       ];

//   const leakageTone = (pct) => {
//     if (pct <= 2.5) return "good";
//     if (pct <= 5)   return "warn";
//     return "bad";
//   };

//   return (
//     <>
//       <Header />
//       <Navbar />

//       <div className="subsidyPage">
//         <div className="subsidyWrap">
//           {/* Breadcrumb */}
//           <div className="crumbRow">
//             <button className="crumbBackBtn" onClick={goBack} type="button" aria-label="Back">
//               ←
//             </button>
//             <span className="crumbText">Policy Dashboard</span>
//             <span className="crumbSep">/</span>
//             <span className="crumbText strong">Subsidy Allocation</span>
//           </div>

//           {/* Hero */}
//           <div className="hero">
//             <div className="heroBadge">
//               <span className="heroBadgeIcon">▦</span>
//               <span>Subsidy Management</span>
//             </div>

//             <h1 className="heroTitle">Subsidy Allocation Dashboard</h1>
//             <p className="heroSub">
//               Precise, targeted, leak-proof, and politically defensible subsidies
//             </p>
//           </div>

//           {/* KPI Cards */}
//           <div className="kpiGrid">
//             <div className="card kpiCard">
//               <div className="kpiTop">
//                 <div className="kpiLabel">
//                   <span className="kpiDot neutral">□</span>
//                   <span>Total Budget</span>
//                 </div>
//               </div>
//               <div className="kpiValue">
//                 <Currency value={totalBudgetM} />
//               </div>
//               <div className="kpiMeta">FY {new Date().getFullYear()} Allocation</div>
//             </div>

//             <div className="card kpiCard tintBlue">
//               <div className="kpiTop">
//                 <div className="kpiLabel">
//                   <span className="kpiDot blue">◎</span>
//                   <span>Allocated</span>
//                 </div>
//               </div>
//               <div className="kpiValue">
//                 <Currency value={allocatedM} />
//               </div>
//               <div className="kpiProgress">
//                 <div className="barTrack">
//                   <div
//                     className="barFill blueFill"
//                     style={{ width: `${clamp(allocatedPct, 0, 100)}%` }}
//                   />
//                 </div>
//                 <div className="kpiFoot">
//                   <span>
//                     <Percent value={allocatedPct} /> of budget
//                   </span>
//                 </div>
//               </div>
//             </div>

//             <div className="card kpiCard tintGreen">
//               <div className="kpiTop">
//                 <div className="kpiLabel">
//                   <span className="kpiDot green">✓</span>
//                   <span>Utilized</span>
//                 </div>
//               </div>
//               <div className="kpiValue">
//                 <Currency value={utilizedM} />
//               </div>
//               <div className="kpiProgress">
//                 <div className="barTrack">
//                   <div
//                     className="barFill greenFill"
//                     style={{ width: `${clamp(utilizedPct, 0, 100)}%` }}
//                   />
//                 </div>
//                 <div className="kpiFoot">
//                   <span>
//                     <Percent value={utilizedPct} /> utilization rate
//                   </span>
//                 </div>
//               </div>
//             </div>

//             <div className="card kpiCard tintRed">
//               <div className="kpiTop">
//                 <div className="kpiLabel">
//                   <span className="kpiDot red">▲</span>
//                   <span>Leakage</span>
//                 </div>
//               </div>
//               <div className="kpiValue">
//                 <Percent value={leakageRate} />
//               </div>
//               <div className="kpiMeta">
//                 {subsidyData?.interpretation?.leakageLevel ?? "Mismatch / fraud detected"}
//               </div>
//             </div>
//           </div>

//           {/* Charts */}
//           <div className="twoCol">
//             <div className="card sectionCard">
//               <div className="sectionHead">
//                 <h3>Allocation by Income Bracket</h3>
//                 <p>Budget vs utilization across income levels (€M)</p>
//               </div>

//               <div className="chartBox">
//                 <ResponsiveContainer width="100%" height={280}>
//                   <BarChart data={incomeData} barCategoryGap={16}>
//                     <CartesianGrid vertical={false} strokeDasharray="3 3" />
//                     <XAxis dataKey="bracket" tick={{ fontSize: 12 }} />
//                     <YAxis tick={{ fontSize: 12 }} />
//                     <Tooltip formatter={(v) => [`€${Number(v).toFixed(1)}M`, ""]} />
//                     <Legend />
//                     <Bar dataKey="allocated" name="Allocated" fill="#2563eb" radius={[6, 6, 0, 0]} />
//                     <Bar dataKey="utilized" name="Utilized" fill="#10b981" radius={[6, 6, 0, 0]} />
//                   </BarChart>
//                 </ResponsiveContainer>
//               </div>
//             </div>

//             <div className="card sectionCard">
//               <div className="sectionHead">
//                 <h3>Allocation by City</h3>
//                 <p>Geographic distribution of subsidies (€M)</p>
//               </div>

//               <div className="chartBox">
//                 <ResponsiveContainer width="100%" height={280}>
//                   <BarChart data={cityData} layout="vertical" barCategoryGap={14}>
//                     <CartesianGrid horizontal={false} strokeDasharray="3 3" />
//                     <XAxis type="number" tick={{ fontSize: 12 }} />
//                     <YAxis type="category" dataKey="city" tick={{ fontSize: 12 }} width={90} />
//                     <Tooltip formatter={(v) => [`€${Number(v).toFixed(1)}M`, ""]} />
//                     <Legend />
//                     <Bar dataKey="budget" name="Budget" fill="#2563eb" radius={[0, 8, 8, 0]} />
//                     <Bar dataKey="utilized" name="Utilized" fill="#10b981" radius={[0, 8, 8, 0]} />
//                   </BarChart>
//                 </ResponsiveContainer>
//               </div>
//             </div>
//           </div>

//           {/* Red Flags */}
//           <div className="card sectionCard">
//             <div className="sectionHead">
//               <div className="titleWithIcon">
//                 <span className="alertIcon">⚠</span>
//                 <div>
//                   <h3>Subsidy Red Flags</h3>
//                   <p>Anomalies and potential fraud indicators</p>
//                 </div>
//               </div>
//             </div>

//             <div className="flagGrid">
//               {redFlags.map((f) => (
//                 <div className="flagCard" key={f.title}>
//                   <div className="flagTitle">{f.title}</div>
//                   <div className="flagRow">
//                     <div className="flagCases">
//                       <span className="flagNum">{f.cases}</span>{" "}
//                       <span className="flagSmall">cases</span>
//                     </div>
//                     <div className="flagAmt">{f.amount}</div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>

//           {/* Outcome Tracking */}
//           <div className="card sectionCard">
//             <div className="sectionHead">
//               <h3>Outcome Tracking</h3>
//               <p>Measuring subsidy effectiveness and impact</p>
//             </div>

//             {/* ✅ Merged: Units Delivered + Delivery Rate into ONE card */}
//             <div className="outcomeGrid">
//               <div className="miniCard mergedOutcome">
//                 <div className="mergedTop">
//                   <div className="miniIcon green">◎</div>
//                   <div className="mergedPct">{outcome.deliveryRate.toFixed(1)}%</div>
//                 </div>

//                 <div className="mergedLabel">Delivery Rate</div>
//                 <div className="mergedDelta">↗ +{outcome.deliveryDelta.toFixed(1)}% vs last year</div>

//                 <div className="mergedNums">
//                   <div className="mergedNumItem">
//                     <div className="mergedNum">{outcome.unitsDelivered.toLocaleString()}</div>
//                     <div className="mergedSub">Delivered</div>
//                   </div>

//                   <div className="mergedDivider" />

//                   <div className="mergedNumItem">
//                     <div className="mergedNum">{outcome.totalSubsidized.toLocaleString()}</div>
//                     <div className="mergedSub">Subsidized</div>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             <div className="satisfaction">
//               <div className="satLeft">
//                 <span className="star">☆</span>
//                 <div className="satTitle">Beneficiary Satisfaction Score</div>
//               </div>

//               <div className="satRight">
//                 <div className="satScore">{outcome.satisfaction.toFixed(1)}/10</div>
//                 <div className="satBar">
//                   <div className="satTrack">
//                     <div
//                       className="satFill"
//                       style={{
//                         width: `${clamp((outcome.satisfaction / 10) * 100, 0, 100)}%`,
//                       }}
//                     />
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Eligibility Matrix */}
//           <div className="card sectionCard">
//             <div className="sectionHead">
//               <h3>Eligibility Matrix</h3>
//               <p>Cross-filter: Income × Property Size × Location × First-time buyer</p>
//             </div>

//             <div className="tableWrap">
//               <table className="matrix">
//                 <thead>
//                   <tr>
//                     <th>Income Bracket</th>
//                     <th>Allocated</th>
//                     <th>Utilized</th>
//                     <th>Beneficiaries</th>
//                     <th>Utilization %</th>
//                     <th>Leakage %</th>
//                   </tr>
//                 </thead>

//                 <tbody>
//                   {eligibilityRows.map((r) => (
//                     <tr key={r.bracket}>
//                       <td className="tdStrong">{r.bracket}</td>
//                       <td>
//                         <Currency value={r.allocated} />
//                       </td>
//                       <td>
//                         <Currency value={r.utilized} />
//                       </td>
//                       <td>{r.beneficiaries.toLocaleString()}</td>
//                       <td>
//                         <div className="utilCell">
//                           <div className="utilTrack">
//                             <div
//                               className="utilFill"
//                               style={{ width: `${clamp(r.utilizationPct, 0, 100)}%` }}
//                             />
//                           </div>
//                           <div className="utilPct">{r.utilizationPct}%</div>
//                         </div>
//                       </td>
//                       <td>
//                         <span className={`pill ${leakageTone(r.leakagePct)}`}>
//                           {r.leakagePct.toFixed(1)}%
//                         </span>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </div>

//           <div className="pageFooterPad" />
//         </div>
//       </div>
//     </>
//   );
// }

// src/pages/Subsidy.jsx
// import React, { useMemo } from "react";
// import { useNavigate } from "react-router-dom";
// import "./Subsidy.css";
// import Header from "../components/Header";
// import Navbar from "../components/Navbar";

// import {
//   ResponsiveContainer,
//   BarChart,
//   Bar,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip,
//   Legend,
// } from "recharts";

// const Currency = ({ value }) => {
//   if (value === null || value === undefined) return "-";
//   const num = Number(value);
//   if (Number.isNaN(num)) return String(value);
//   return `€${num.toFixed(1)}M`;
// };

// const Percent = ({ value, decimals = 1 }) => {
//   if (value === null || value === undefined) return "-";
//   const num = Number(value);
//   if (Number.isNaN(num)) return String(value);
//   return `${num.toFixed(decimals)}%`;
// };

// const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// export default function Subsidy() {
//   const navigate = useNavigate();

//   const goBack = () => {
//     const prev = sessionStorage.getItem("prev_path");
//     if (prev) navigate(prev);
//     else navigate("/overview");
//   };

//   const kpis = useMemo(
//     () => ({
//       totalBudget: 125.0,
//       allocated: 98.5,
//       utilized: 76.2,
//       leakagePct: 3.2,
//     }),
//     []
//   );

//   const allocatedPct = useMemo(
//     () => (kpis.allocated / kpis.totalBudget) * 100,
//     [kpis]
//   );
//   const utilizedPct = useMemo(
//     () => (kpis.utilized / kpis.allocated) * 100,
//     [kpis]
//   );

//   const incomeData = useMemo(
//     () => [
//       { bracket: "< €5,000", allocated: 28.5, utilized: 24.8 },
//       { bracket: "€5,000 – €10,000", allocated: 35.2, utilized: 28.1 },
//       { bracket: "€10,000 – €15,000", allocated: 22.8, utilized: 16.2 },
//       { bracket: "€15,000 – €20,000", allocated: 8.5, utilized: 5.1 },
//       { bracket: "> €20,000", allocated: 3.5, utilized: 2.0 },
//     ],
//     []
//   );

//   const cityData = useMemo(
//     () => [
//       { city: "Belgrade", budget: 45.0, utilized: 38.0 },
//       { city: "Novi Sad", budget: 24.0, utilized: 19.5 },
//       { city: "Niš", budget: 16.0, utilized: 12.0 },
//       { city: "Kragujevac", budget: 10.0, utilized: 7.2 },
//       { city: "Other", budget: 12.0, utilized: 3.4 },
//     ],
//     []
//   );

//  // ✅ Removed cards: Income mismatch & Construction delay
//   const redFlags = useMemo(
//     () => [
//       { title: "Premium property subsidy", cases: 45, amount: "€890K" },
//       { title: "Repeated beneficiary", cases: 23, amount: "€456K" },
//       { title: "False documentation", cases: 12, amount: "€340K" },
//     ],
//     []
//   );

//   // ✅ Outcome: removed avgPriceReduction & monthsToPossession
//   const outcome = useMemo(
//     () => ({
//       unitsDelivered: 8920,
//       totalSubsidized: 12450,
//       deliveryRate: 71.6,
//       deliveryDelta: 2.4,
//       satisfaction: 7.8,
//     }),
//     []
//   );

//   const eligibilityRows = useMemo(
//     () => [
//       {
//         bracket: "< €5,000",
//         allocated: 28.5,
//         utilized: 24.8,
//         beneficiaries: 4850,
//         utilizationPct: 87,
//         leakagePct: 1.8,
//       },
//       {
//         bracket: "€5,000 – €10,000",
//         allocated: 35.2,
//         utilized: 28.1,
//         beneficiaries: 4200,
//         utilizationPct: 80,
//         leakagePct: 2.4,
//       },
//       {
//         bracket: "€10,000 – €15,000",
//         allocated: 22.8,
//         utilized: 16.2,
//         beneficiaries: 2400,
//         utilizationPct: 71,
//         leakagePct: 4.2,
//       },
//       {
//         bracket: "€15,000 – €20,000",
//         allocated: 8.5,
//         utilized: 5.1,
//         beneficiaries: 780,
//         utilizationPct: 60,
//         leakagePct: 5.8,
//       },
//       {
//         bracket: "> €20,000",
//         allocated: 3.5,
//         utilized: 2.0,
//         beneficiaries: 220,
//         utilizationPct: 57,
//         leakagePct: 8.1,
//       },
//     ],
//     []
//   );

//   const leakageTone = (pct) => {
//     if (pct <= 2.5) return "good";
//     if (pct <= 5) return "warn";
//     return "bad";
//   };

//   return (
//     <>
//       <Header />
//       <Navbar />

//       <div className="subsidyPage">
//         <div className="subsidyWrap">
//           {/* Breadcrumb */}
//           <div className="crumbRow">
//             <button className="crumbBackBtn" onClick={goBack} type="button" aria-label="Back">
//               ←
//             </button>
//             <span className="crumbText">Policy Dashboard</span>
//             <span className="crumbSep">/</span>
//             <span className="crumbText strong">Subsidy Allocation</span>
//           </div>

//           {/* Hero */}
//           <div className="hero">
//             <div className="heroBadge">
//               <span className="heroBadgeIcon">▦</span>
//               <span>Subsidy Management</span>
//             </div>

//             <h1 className="heroTitle">Subsidy Allocation Dashboard</h1>
//             <p className="heroSub">
//               Precise, targeted, leak-proof, and politically defensible subsidies
//             </p>
//           </div>

//           {/* KPI Cards */}
//           <div className="kpiGrid">
//             <div className="card kpiCard">
//               <div className="kpiTop">
//                 <div className="kpiLabel">
//                   <span className="kpiDot neutral">□</span>
//                   <span>Total Budget</span>
//                 </div>
//               </div>
//               <div className="kpiValue">
//                 <Currency value={kpis.totalBudget} />
//               </div>
//               <div className="kpiMeta">FY 2024 Allocation</div>
//             </div>

//             <div className="card kpiCard tintBlue">
//               <div className="kpiTop">
//                 <div className="kpiLabel">
//                   <span className="kpiDot blue">◎</span>
//                   <span>Allocated</span>
//                 </div>
//               </div>
//               <div className="kpiValue">
//                 <Currency value={kpis.allocated} />
//               </div>
//               <div className="kpiProgress">
//                 <div className="barTrack">
//                   <div
//                     className="barFill blueFill"
//                     style={{ width: `${clamp(allocatedPct, 0, 100)}%` }}
//                   />
//                 </div>
//                 <div className="kpiFoot">
//                   <span>
//                     <Percent value={allocatedPct} /> of budget
//                   </span>
//                 </div>
//               </div>
//             </div>

//             <div className="card kpiCard tintGreen">
//               <div className="kpiTop">
//                 <div className="kpiLabel">
//                   <span className="kpiDot green">✓</span>
//                   <span>Utilized</span>
//                 </div>
//               </div>
//               <div className="kpiValue">
//                 <Currency value={kpis.utilized} />
//               </div>
//               <div className="kpiProgress">
//                 <div className="barTrack">
//                   <div
//                     className="barFill greenFill"
//                     style={{ width: `${clamp(utilizedPct, 0, 100)}%` }}
//                   />
//                 </div>
//                 <div className="kpiFoot">
//                   <span>
//                     <Percent value={utilizedPct} /> utilization rate
//                   </span>
//                 </div>
//               </div>
//             </div>

//             <div className="card kpiCard tintRed">
//               <div className="kpiTop">
//                 <div className="kpiLabel">
//                   <span className="kpiDot red">▲</span>
//                   <span>Leakage</span>
//                 </div>
//               </div>
//               <div className="kpiValue">
//                 <Percent value={kpis.leakagePct} />
//               </div>
//               <div className="kpiMeta">Mismatch / fraud detected</div>
//             </div>
//           </div>

//           {/* Charts */}
//           <div className="twoCol">
//             <div className="card sectionCard">
//               <div className="sectionHead">
//                 <h3>Allocation by Income Bracket</h3>
//                 <p>Budget vs utilization across income levels (€M)</p>
//               </div>

//               <div className="chartBox">
//                 <ResponsiveContainer width="100%" height={280}>
//                   <BarChart data={incomeData} barCategoryGap={16}>
//                     <CartesianGrid vertical={false} strokeDasharray="3 3" />
//                     <XAxis dataKey="bracket" tick={{ fontSize: 12 }} />
//                     <YAxis tick={{ fontSize: 12 }} />
//                     <Tooltip formatter={(v) => [`€${Number(v).toFixed(1)}M`, ""]} />
//                     <Legend />
//                     <Bar dataKey="allocated" name="Allocated" fill="#2563eb" radius={[6, 6, 0, 0]} />
//                     <Bar dataKey="utilized" name="Utilized" fill="#10b981" radius={[6, 6, 0, 0]} />
//                   </BarChart>
//                 </ResponsiveContainer>
//               </div>
//             </div>

//             <div className="card sectionCard">
//               <div className="sectionHead">
//                 <h3>Allocation by City</h3>
//                 <p>Geographic distribution of subsidies (€M)</p>
//               </div>

//               <div className="chartBox">
//                 <ResponsiveContainer width="100%" height={280}>
//                   <BarChart data={cityData} layout="vertical" barCategoryGap={14}>
//                     <CartesianGrid horizontal={false} strokeDasharray="3 3" />
//                     <XAxis type="number" tick={{ fontSize: 12 }} />
//                     <YAxis type="category" dataKey="city" tick={{ fontSize: 12 }} width={90} />
//                     <Tooltip formatter={(v) => [`€${Number(v).toFixed(1)}M`, ""]} />
//                     <Legend />
//                     <Bar dataKey="budget" name="Budget" fill="#2563eb" radius={[0, 8, 8, 0]} />
//                     <Bar dataKey="utilized" name="Utilized" fill="#10b981" radius={[0, 8, 8, 0]} />
//                   </BarChart>
//                 </ResponsiveContainer>
//               </div>
//             </div>
//           </div>

//           {/* Red Flags */}
//           <div className="card sectionCard">
//             <div className="sectionHead">
//               <div className="titleWithIcon">
//                 <span className="alertIcon">⚠</span>
//                 <div>
//                   <h3>Subsidy Red Flags</h3>
//                   <p>Anomalies and potential fraud indicators</p>
//                 </div>
//               </div>
//             </div>

//             <div className="flagGrid">
//               {redFlags.map((f) => (
//                 <div className="flagCard" key={f.title}>
//                   <div className="flagTitle">{f.title}</div>
//                   <div className="flagRow">
//                     <div className="flagCases">
//                       <span className="flagNum">{f.cases}</span>{" "}
//                       <span className="flagSmall">cases</span>
//                     </div>
//                     <div className="flagAmt">{f.amount}</div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>

//           {/* Outcome Tracking */}
//           <div className="card sectionCard">
//             <div className="sectionHead">
//               <h3>Outcome Tracking</h3>
//               <p>Measuring subsidy effectiveness and impact</p>
//             </div>

//             {/* ✅ Merged: Units Delivered + Delivery Rate into ONE card */}
//             <div className="outcomeGrid">
//               <div className="miniCard mergedOutcome">
//                 <div className="mergedTop">
//                   <div className="miniIcon green">◎</div>
//                   <div className="mergedPct">{outcome.deliveryRate.toFixed(1)}%</div>
//                 </div>

//                 <div className="mergedLabel">Delivery Rate</div>
//                 <div className="mergedDelta">↗ +{outcome.deliveryDelta.toFixed(1)}% vs last year</div>

//                 <div className="mergedNums">
//                   <div className="mergedNumItem">
//                     <div className="mergedNum">{outcome.unitsDelivered.toLocaleString()}</div>
//                     <div className="mergedSub">Delivered</div>
//                   </div>

//                   <div className="mergedDivider" />

//                   <div className="mergedNumItem">
//                     <div className="mergedNum">{outcome.totalSubsidized.toLocaleString()}</div>
//                     <div className="mergedSub">Subsidized</div>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             <div className="satisfaction">
//               <div className="satLeft">
//                 <span className="star">☆</span>
//                 <div className="satTitle">Beneficiary Satisfaction Score</div>
//               </div>

//               <div className="satRight">
//                 <div className="satScore">{outcome.satisfaction.toFixed(1)}/10</div>
//                 <div className="satBar">
//                   <div className="satTrack">
//                     <div
//                       className="satFill"
//                       style={{
//                         width: `${clamp((outcome.satisfaction / 10) * 100, 0, 100)}%`,
//                       }}
//                     />
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Eligibility Matrix */}
//           <div className="card sectionCard">
//             <div className="sectionHead">
//               <h3>Eligibility Matrix</h3>
//               <p>Cross-filter: Income × Property Size × Location × First-time buyer</p>
//             </div>

//             <div className="tableWrap">
//               <table className="matrix">
//                 <thead>
//                   <tr>
//                     <th>Income Bracket</th>
//                     <th>Allocated</th>
//                     <th>Utilized</th>
//                     <th>Beneficiaries</th>
//                     <th>Utilization %</th>
//                     <th>Leakage %</th>
//                   </tr>
//                 </thead>

//                 <tbody>
//                   {eligibilityRows.map((r) => (
//                     <tr key={r.bracket}>
//                       <td className="tdStrong">{r.bracket}</td>
//                       <td>
//                         <Currency value={r.allocated} />
//                       </td>
//                       <td>
//                         <Currency value={r.utilized} />
//                       </td>
//                       <td>{r.beneficiaries.toLocaleString()}</td>
//                       <td>
//                         <div className="utilCell">
//                           <div className="utilTrack">
//                             <div
//                               className="utilFill"
//                               style={{ width: `${clamp(r.utilizationPct, 0, 100)}%` }}
//                             />
//                           </div>
//                           <div className="utilPct">{r.utilizationPct}%</div>
//                         </div>
//                       </td>
//                       <td>
//                         <span className={`pill ${leakageTone(r.leakagePct)}`}>
//                           {r.leakagePct.toFixed(1)}%
//                         </span>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </div>

//           <div className="pageFooterPad" />
//         </div>
//       </div>
//     </>
//   );
// }
