// Affordability.jsx - 100% DYNAMIC from backend API
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Affordability.css";
import "leaflet/dist/leaflet.css";

import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";

import { getAffordabilityData } from "../utils/api";

/* =========================
   Helpers
   ========================= */

function calcMonthlyEMI(priceEUR, annualRate = 0.06, years = 25) {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return priceEUR / n;
  const pow = Math.pow(1 + r, n);
  return (priceEUR * r * pow) / (pow - 1);
}

function calcMetrics({ priceK, incomeK }, { maxRatio, maxEmiPct }) {
  const price = priceK * 1000;
  const incomeAnnual = incomeK * 1000;
  const incomeMonthly = incomeAnnual / 12;

  const ratio = incomeAnnual > 0 ? price / incomeAnnual : 999;

  const emiMonthly = calcMonthlyEMI(price, 0.06, 25);
  const emiPct = incomeMonthly > 0 ? (emiMonthly / incomeMonthly) * 100 : 999;

  const affordableByRatio = ratio <= maxRatio;
  const affordableByEmi = emiPct <= maxEmiPct;

  let status = "critical";
  if (affordableByRatio && affordableByEmi) status = "affordable";
  else if (affordableByRatio || affordableByEmi) status = "stressed";

  return { ratio, emiPct, status };
}

function statusLabel(status) {
  if (status === "affordable") return "Affordable";
  if (status === "stressed") return "Stressed";
  return "Critical";
}

function statusColor(status) {
  if (status === "affordable") return "#12b76a";
  if (status === "stressed") return "#f79009";
  return "#d92d20";
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/* =========================
   Region coordinates map for leaflet
   ========================= */
const REGION_COORDS = {
  // Belgrade City
  "Belgrade":      { lat: 44.8176, lng: 20.4633 },
  // Vojvodina districts (district capitals)
  "Južna Bačka":   { lat: 45.2671, lng: 19.8335 }, // Novi Sad
  "Severna Bačka": { lat: 46.1006, lng: 19.6653 }, // Subotica
  "Zapadna Bačka": { lat: 45.7720, lng: 19.1122 }, // Sombor
  "Srednji Banat": { lat: 45.3814, lng: 20.3861 }, // Zrenjanin
  "Severni Banat": { lat: 45.8680, lng: 20.4680 }, // Kikinda
  "Južni Banat":   { lat: 44.8705, lng: 20.6403 }, // Pančevo
  "Srem":          { lat: 44.9730, lng: 19.6100 }, // Sremska Mitrovica
  // Central Serbia districts (district capitals)
  "Mačva":         { lat: 44.7530, lng: 19.7080 }, // Šabac
  "Kolubara":      { lat: 44.2748, lng: 19.8905 }, // Valjevo
  "Podunavlje":    { lat: 44.6649, lng: 20.9280 }, // Smederevo
  "Braničevo":     { lat: 44.6200, lng: 21.1870 }, // Požarevac
  "Šumadija":      { lat: 44.0128, lng: 20.9114 }, // Kragujevac
  "Pomoravlje":    { lat: 43.9780, lng: 21.2610 }, // Jagodina
  "Bor":           { lat: 44.0710, lng: 22.0960 }, // Bor
  "Zaječar":       { lat: 43.9070, lng: 22.2740 }, // Zaječar
  "Zlatibor":      { lat: 43.8520, lng: 19.8480 }, // Užice
  "Moravica":      { lat: 43.8914, lng: 20.3497 }, // Čačak
  "Raška":         { lat: 43.7246, lng: 20.6870 }, // Kraljevo
  "Rasina":        { lat: 43.5810, lng: 21.3330 }, // Kruševac
  "Nišava":        { lat: 43.3209, lng: 21.8958 }, // Niš
  "Toplica":       { lat: 43.2320, lng: 21.5870 }, // Prokuplje
  "Pirot":         { lat: 43.1520, lng: 22.5860 }, // Pirot
  "Jablanica":     { lat: 42.9981, lng: 21.9465 }, // Leskovac
  "Pčinja":        { lat: 42.5498, lng: 21.8998 }, // Vranje
};

function getCoords(region) {
  if (REGION_COORDS[region]) return REGION_COORDS[region];
  // fuzzy match
  const key = Object.keys(REGION_COORDS).find(k => region?.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(region?.toLowerCase()));
  if (key) return REGION_COORDS[key];
  return { lat: 44.0 + Math.random() * 2 - 1, lng: 20.5 + Math.random() * 2 - 1 };
}

/* =========================
   Chart tooltip
   ========================= */

function ChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;

  return (
    <div className="srAff_tip">
      <div className="srAff_tipTitle">{p.label}</div>
      <div>Income: <b>€{p.x}K/yr</b></div>
      <div>Price: <b>€{p.y}K</b></div>
      <div>P/I Ratio: <b>{round1(p.ratio)}x</b></div>
      <div>EMI %: <b>{round1(p.emiPct)}%</b></div>
      <div>Status: <b>{statusLabel(p.status)}</b></div>
    </div>
  );
}

/* =========================
   Small UI icons
   ========================= */

function LogoMark() {
  return (
    <div className="srAff_logo">
      <span className="srAff_logoMark" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M4 12.2C6.2 7.2 10 4 12.5 4c3.4 0 6.5 3.6 7.5 8.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M20 11.8C17.8 16.8 14 20 11.5 20 8.1 20 5 16.4 4 11.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
        </svg>
      </span>
      <div className="srAff_logoText">
        <div className="srAff_logoTop">PolicyLens</div>
        <div className="srAff_logoSub">Affordability</div>
      </div>
    </div>
  );
}

function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22Z" fill="currentColor" opacity="0.9"/>
      <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M4 20c1.6-3.8 5-6 8-6s6.4 2.2 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2"/>
      <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconFilter() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconBack() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* =========================
   Map component
   ========================= */

function SerbiaCityMap({ cities }) {
  const center = useMemo(() => [44.1, 20.8], []);
  const [hovered, setHovered] = useState(null);

  return (
    <section className="srAff_card">
      <header className="srAff_cardHeader">
        <h3 className="srAff_cardTitle">Serbia Affordability Map</h3>
        <p className="srAff_muted">Hover on points to see city affordability metrics</p>
      </header>

      <div className="srAff_mapWrap">
        <MapContainer center={center} zoom={7} scrollWheelZoom={true} style={{ height: 420, width: "100%" }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {cities.map((c) => {
            const color = statusColor(c.status);
            const radius = Math.min(14, Math.max(6, Math.round(c.ratio)));

            return (
              <CircleMarker
                key={c.city}
                center={[c.lat, c.lng]}
                radius={radius}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.75,
                  weight: hovered?.city === c.city ? 3 : 1,
                  opacity: 0.95,
                }}
                eventHandlers={{
                  mouseover: () => setHovered(c),
                  mouseout: () => setHovered(null),
                }}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={1} permanent={false}>
                  <div style={{ minWidth: 200 }}>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>{c.city}</div>
                    <div>Status: <b>{statusLabel(c.status)}</b></div>
                    <div>Price: <b>€{c.priceK}K</b></div>
                    <div>Income: <b>€{c.incomeK}K/yr</b></div>
                    <div>P/I Ratio: <b>{round1(c.ratio)}x</b></div>
                    <div>EMI %: <b>{round1(c.emiPct)}%</b></div>
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </section>
  );
}

/* =========================
   Main page
   ========================= */

export default function Affordability() {
  const navigate = useNavigate();
  const DASHBOARD_ROUTE = "/dashboard";

  // ── API State ──────────────────────────────────────────────
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getAffordabilityData()
      .then((res) => {
        setApiData(res.data ?? null);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // simulation sliders — live update
  const [sim, setSim] = useState({ maxRatio: 8, maxEmiPct: 35 });

  // search + city filter
  const [searchText, setSearchText] = useState("");
  const [cityFilter, setCityFilter] = useState("All Cities");

  // ── Build cities array from API data ──────────────────────
  // API returns avgPricesByRegion: [{ region, avgPrice, affordabilityRatio, count }]
  // API returns incomeCategories with different income levels
  // We map regions to cities using coords and derive incomeK from middle income
  const BASE_CITIES = useMemo(() => {
    if (!apiData) return [];

    const regions = apiData.avgPricesByRegion ?? [];
    // Middle income from Serbia: ~30000 EUR/yr, but adjust per region
    // Use affordabilityRatio (price / middle income) to back-calculate income
    // affordabilityRatio = avgPrice / 30000 (middle income)
    const middleIncome = apiData.incomeCategories?.["Middle Income"]?.avgIncome ?? 30000;

    return regions.map((r) => {
      const coords = getCoords(r.region);
      const priceK = Math.round(r.avgPrice / 1000);
      const incomeK = Math.round(middleIncome / 1000);
      // Derive eligible % from affordabilityRatio
      const eligible = Math.max(5, Math.round(100 - r.affordabilityRatio * 10));
      // Derive newUnits from count (scaled)
      const newUnits = r.count ? Math.round(r.count * 0.3) : 50;
      const deltaPct = parseFloat((((r.affordabilityRatio - 5) * -2)).toFixed(1));

      return {
        city: r.region,
        lat: coords.lat,
        lng: coords.lng,
        priceK,
        incomeK,
        eligible: Math.max(5, Math.min(95, eligible)),
        newUnits: Math.max(10, newUnits),
        deltaPct,
      };
    });
  }, [apiData]);

  // compute cities with simulation values
  const cities = useMemo(() => {
    return BASE_CITIES.map((c) => {
      const m = calcMetrics(c, sim);
      return { ...c, ...m };
    });
  }, [BASE_CITIES, sim]);

  // options for dropdown
  const cityOptions = useMemo(() => ["All Cities", ...BASE_CITIES.map((c) => c.city)], [BASE_CITIES]);

  // filtered view
  const filteredCities = useMemo(() => {
    let rows = cities;

    if (cityFilter !== "All Cities") {
      rows = rows.filter((c) => c.city === cityFilter);
    }

    const q = searchText.trim().toLowerCase();
    if (q) {
      rows = rows.filter((c) => c.city.toLowerCase().includes(q));
    }

    return rows;
  }, [cities, cityFilter, searchText]);

  // KPIs derived from API + simulation
  const kpis = useMemo(() => {
    if (!apiData) return [
      { title: "National HAI", value: "—", sub: "Price to Income Ratio", delta: "" },
      { title: "Eligible Households", value: "—", sub: "Can afford median home", delta: "" },
      { title: "Affordability Score", value: "—", sub: "Out of 100", delta: "" },
      { title: "Median Ratio", value: "—", sub: "Price / Annual Income", delta: "" },
    ];

    const overallScore = apiData.overallScore ?? 0;
    const avgRatio = apiData.averageRatio ?? 0;
    const trend = apiData.trend ?? 0;

    const ratios = cities.map((c) => c.ratio).sort((a, b) => a - b);
    const medianRatio = ratios.length ? ratios[Math.floor(ratios.length / 2)] : avgRatio;

    const affordableCount = cities.filter((c) => c.status === "affordable").length;
    const eligiblePct = cities.length ? Math.round((affordableCount / cities.length) * 100) : 0;

    const totalNewUnits = cities.reduce((sum, c) => sum + (c.newUnits || 0), 0);

    return [
      { title: "National HAI", value: round1(avgRatio).toString(), sub: "Avg Price to Income Ratio", delta: "" },
      { title: "Eligible Households", value: `${eligiblePct}%`, sub: "Can afford median home", delta: "" },
      { title: "Affordability Score", value: `${overallScore}`, sub: `Out of 100 — ${apiData.interpretation?.level ?? ""}`, delta: trend ? `${trend > 0 ? "+" : ""}${round1(trend)}%` : "" },
      { title: "Median Ratio", value: `${round1(medianRatio)}x`, sub: "Price / Annual Income", delta: "" },
    ];
  }, [apiData, cities]);

  // chart points
  const chartData = useMemo(() => {
    return filteredCities
      .map((c) => ({
        label: c.city,
        x: c.incomeK,
        y: c.priceK,
        ratio: c.ratio,
        emiPct: c.emiPct,
        status: c.status,
      }))
      .sort((a, b) => a.x - b.x);
  }, [filteredCities]);

  const chartGreen = useMemo(() => chartData.filter((d) => d.status === "affordable"), [chartData]);
  const chartAmber = useMemo(() => chartData.filter((d) => d.status === "stressed"), [chartData]);
  const chartRed = useMemo(() => chartData.filter((d) => d.status === "critical"), [chartData]);

  // bar data
  const barData = useMemo(() => {
    return filteredCities
      .map((c) => ({
        city: c.city,
        eligible: c.eligible,
        newUnits: c.newUnits,
        deltaPct: c.deltaPct,
        status: c.status,
      }))
      .sort((a, b) => b.newUnits - a.newUnits);
  }, [filteredCities]);

  // ── Loading / Error states ────────────────────────────────
  if (loading) {
    return (
      <div id="sr_afford_root_9182" className="srAff_page">
        <div className="srAff_container">
          <div style={{ textAlign: "center", padding: "4rem", color: "#666" }}>
            Loading affordability data...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="sr_afford_root_9182" className="srAff_page">
        <div className="srAff_container">
          <div style={{ textAlign: "center", padding: "4rem", color: "#d92d20" }}>
            <strong>Error:</strong> {error}
            <br />
            <button onClick={() => window.location.reload()} style={{ marginTop: "1rem", padding: "0.5rem 1rem" }}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="sr_afford_root_9182" className="srAff_page">
      <div className="srAff_container">
        {/* Top bar with BACK button */}
        <div className="srAff_appBar">
          <div className="srAff_leftZone">
            <button
              type="button"
              className="srAff_backBtn"
              onClick={() => navigate(DASHBOARD_ROUTE)}
              aria-label="Back to Dashboard"
              title="Back to Dashboard"
            >
              <IconBack />
              <span className="srAff_backText">Back</span>
            </button>
            <LogoMark />
          </div>

          <div className="srAff_appBarRight">
            <div className="srAff_search" role="search">
              <span className="srAff_searchIcon"><IconSearch /></span>
              <input
                className="srAff_searchInput"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search region…"
                aria-label="Search region"
              />
            </div>

            <div className="srAff_filter">
              <span className="srAff_filterIcon" aria-hidden="true"><IconFilter /></span>
              <select
                className="srAff_filterSelect"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                aria-label="Filter by city"
              >
                {cityOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {(searchText || cityFilter !== "All Cities") && (
              <button
                className="srAff_iconBtn"
                type="button"
                title="Reset filters"
                aria-label="Reset filters"
                onClick={() => { setSearchText(""); setCityFilter("All Cities"); }}
              >
                ✕
              </button>
            )}
            <button className="srAff_iconBtn" type="button" title="Notifications" aria-label="Notifications">
              <IconBell />
              <span className="srAff_dot" aria-hidden="true" />
            </button>
            <button className="srAff_iconBtn" type="button" title="Profile" aria-label="Profile">
              <IconUser />
            </button>
          </div>
        </div>

        <div className="srAff_topTitle">
          <div className="srAff_pill">Housing Policy</div>
          <h1 className="srAff_h1">Affordable Housing Dashboard</h1>
          <p className="srAff_muted">
            Housing affordability anchored to income reality — not headline prices
            {apiData?.interpretation?.recommendation ? ` · ${apiData.interpretation.recommendation}` : ""}
          </p>
        </div>

        <div className="srAff_kpiRow">
          {kpis.map((k) => (
            <div className="srAff_kpiCard" key={k.title}>
              <div className="srAff_kpiTitle">{k.title}</div>
              <div className="srAff_kpiValue">
                {k.value} {k.delta ? <span className="srAff_kpiDelta">{k.delta}</span> : null}
              </div>
              <div className="srAff_kpiSub">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Scatter Chart */}
        <div className="srAff_grid1">
          <section className="srAff_card srAff_chartCard">
            <header className="srAff_cardHeader">
              <h3 className="srAff_cardTitle">Income vs Price by Region</h3>
              <p className="srAff_muted srAff_chartMuted">Red zone = structurally unaffordable (ratio &gt; {sim.maxRatio}x)</p>
            </header>

            <div className="srAff_chartMock srAff_chartOffWhite" style={{ height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 10 }}>
                  <CartesianGrid strokeDasharray="4 6" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Income"
                    unit="K"
                    tickFormatter={(v) => `${v}K`}
                    label={{ value: "Household Income (€K/year)", position: "bottom", offset: 10 }}
                    tick={{ fill: "#0b1220" }}
                    axisLine={{ stroke: "rgba(0,0,0,0.25)" }}
                    tickLine={{ stroke: "rgba(0,0,0,0.25)" }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Price"
                    unit="K"
                    tickFormatter={(v) => `${v}K`}
                    label={{ value: "Median Price (€K)", angle: -90, position: "insideLeft" }}
                    tick={{ fill: "#0b1220" }}
                    axisLine={{ stroke: "rgba(0,0,0,0.25)" }}
                    tickLine={{ stroke: "rgba(0,0,0,0.25)" }}
                  />
                  <ReTooltip content={<ChartTooltip />} />
                  <Scatter data={chartGreen} fill="#12b76a" />
                  <Scatter data={chartAmber} fill="#f79009" />
                  <Scatter data={chartRed} fill="#d92d20" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* Bar chart */}
        <section className="srAff_card">
          <header className="srAff_cardHeader">
            <h3 className="srAff_cardTitle">Supply & Eligibility by Region</h3>
            <p className="srAff_muted">Compare pipeline (new units) with eligibility and recent change</p>
          </header>

          <div className="srAff_chartMock" style={{ height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 16, bottom: 18, left: 0 }}>
                <CartesianGrid strokeDasharray="4 6" />
                <XAxis dataKey="city" interval={0} angle={-18} textAnchor="end" height={70} />
                <YAxis />
                <ReTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const row = payload[0]?.payload;
                    if (!row) return null;
                    return (
                      <div className="srAff_tip">
                        <div className="srAff_tipTitle">{label}</div>
                        <div>Eligible: <b>{row.eligible}%</b></div>
                        <div>New Units: <b>{row.newUnits}</b></div>
                        <div>Δ Price: <b>{row.deltaPct}%</b></div>
                        <div>Status: <b>{statusLabel(row.status)}</b></div>
                      </div>
                    );
                  }}
                />
                <Legend />
                <Bar dataKey="newUnits" name="New Affordable Units" fill="#1d4ed8" radius={[10, 10, 0, 0]} />
                <Bar dataKey="eligible" name="Eligible (%)" fill="#60a5fa" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Map */}
        <SerbiaCityMap cities={filteredCities} />

        {/* Heatmap */}
        <section className="srAff_card">
          <header className="srAff_cardHeader">
            <h3 className="srAff_cardTitle">Region Affordability Heatmap</h3>
            <p className="srAff_muted">Green = affordable, Amber = stressed, Red = critical</p>
          </header>

          <div className="srAff_heatGrid">
            {filteredCities.slice(0, 10).map((c) => {
              const s = c.status;
              return (
                <div key={c.city} className={`srAff_heatCard srAff_heatCard_${s}`}>
                  <div className="srAff_heatCity">{c.city}</div>
                  <div className="srAff_heatScore">{round1(c.ratio)}x</div>
                  <div className="srAff_heatLabel">P/I Ratio</div>
                  <div className="srAff_heatStatus">
                    <span className={`srAff_status srAff_status_${s}`}>{statusLabel(s)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Income Category Breakdown from API */}
        {apiData?.incomeCategories && (
          <section className="srAff_card">
            <header className="srAff_cardHeader">
              <h3 className="srAff_cardTitle">Price-to-Income by Category</h3>
              <p className="srAff_muted">Affordability across income segments</p>
            </header>
            <div className="srAff_tableWrap">
              <table className="srAff_table">
                <thead>
                  <tr>
                    <th>Income Category</th>
                    <th>Avg Annual Income</th>
                    <th>Avg Property Price</th>
                    <th>P/I Ratio</th>
                    <th>Percentile</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(apiData.incomeCategories).map(([cat, d]) => (
                    <tr key={cat}>
                      <td>{cat}</td>
                      <td>€{(d.avgIncome / 1000).toFixed(0)}K/yr</td>
                      <td>€{(d.avgPropertyPrice / 1000).toFixed(0)}K</td>
                      <td>{d.priceToIncome}x</td>
                      <td>{d.percentile}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Detailed Region Table */}
        <section className="srAff_card">
          <header className="srAff_cardHeader">
            <h3 className="srAff_cardTitle">Detailed Region Analysis</h3>
          </header>

          <div className="srAff_tableWrap">
            <table className="srAff_table">
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Median Price</th>
                  <th>Median Income</th>
                  <th>P/I Ratio</th>
                  <th>EMI %</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredCities.map((c) => (
                  <tr key={c.city}>
                    <td>{c.city}</td>
                    <td>€{c.priceK}K</td>
                    <td>€{c.incomeK}K/yr</td>
                    <td>{round1(c.ratio)}x</td>
                    <td>{round1(c.emiPct)}%</td>
                    <td>
                      <span className={`srAff_status srAff_status_${c.status}`}>{statusLabel(c.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!filteredCities.length ? (
              <div className="srAff_emptyState">
                No regions match your search/filter.
              </div>
            ) : null}
          </div>
        </section>

        <footer className="srAff_footer">
          <div>© {new Date().getFullYear()} PolicyLens • Built for policy simulation & monitoring</div>
          <div className="srAff_footerRight">
            <span className="srAff_footerPill">v1.0</span>
            <span className="srAff_footerPill">Serbia Demo</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

// // Affordability.jsx - 100% DYNAMIC from backend API
// import React, { useMemo, useState, useEffect } from "react";
// import { useNavigate } from "react-router-dom";
// import "./Affordability.css";
// import "leaflet/dist/leaflet.css";

// import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";

// import {
//   ResponsiveContainer,
//   ScatterChart,
//   Scatter,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip as ReTooltip,
//   BarChart,
//   Bar,
//   Legend,
// } from "recharts";

// import { getAffordabilityData } from "../utils/api";

// /* =========================
//    Helpers
//    ========================= */

// function calcMonthlyEMI(priceEUR, annualRate = 0.06, years = 25) {
//   const r = annualRate / 12;
//   const n = years * 12;
//   if (r === 0) return priceEUR / n;
//   const pow = Math.pow(1 + r, n);
//   return (priceEUR * r * pow) / (pow - 1);
// }

// function calcMetrics({ priceK, incomeK }, { maxRatio, maxEmiPct }) {
//   const price = priceK * 1000;
//   const incomeAnnual = incomeK * 1000;
//   const incomeMonthly = incomeAnnual / 12;

//   const ratio = incomeAnnual > 0 ? price / incomeAnnual : 999;

//   const emiMonthly = calcMonthlyEMI(price, 0.06, 25);
//   const emiPct = incomeMonthly > 0 ? (emiMonthly / incomeMonthly) * 100 : 999;

//   const affordableByRatio = ratio <= maxRatio;
//   const affordableByEmi = emiPct <= maxEmiPct;

//   let status = "critical";
//   if (affordableByRatio && affordableByEmi) status = "affordable";
//   else if (affordableByRatio || affordableByEmi) status = "stressed";

//   return { ratio, emiPct, status };
// }

// function statusLabel(status) {
//   if (status === "affordable") return "Affordable";
//   if (status === "stressed") return "Stressed";
//   return "Critical";
// }

// function statusColor(status) {
//   if (status === "affordable") return "#12b76a";
//   if (status === "stressed") return "#f79009";
//   return "#d92d20";
// }

// function round1(n) {
//   return Math.round(n * 10) / 10;
// }

// /* =========================
//    Region coordinates map for leaflet
//    ========================= */
// const REGION_COORDS = {
//   "Belgrade":   { lat: 44.8176, lng: 20.4633 },
//   "Novi Sad":   { lat: 45.2671, lng: 19.8335 },
//   "Niš":        { lat: 43.3209, lng: 21.8958 },
//   "Kragujevac": { lat: 44.0128, lng: 20.9114 },
//   "Subotica":   { lat: 46.1006, lng: 19.6653 },
//   "Zrenjanin":  { lat: 45.3814, lng: 20.3861 },
//   "Pančevo":    { lat: 44.8705, lng: 20.6403 },
//   "Čačak":      { lat: 43.8914, lng: 20.3497 },
//   "Leskovac":   { lat: 42.9981, lng: 21.9465 },
//   "Kraljevo":   { lat: 43.7246, lng: 20.6870 },
//   "Šabac":      { lat: 44.7530, lng: 19.7080 },
//   "Smederevo":  { lat: 44.6649, lng: 20.9280 },
//   "Požarevac":  { lat: 44.6200, lng: 21.1870 },
//   "Zaječar":    { lat: 43.9070, lng: 22.2740 },
//   "Pirot":      { lat: 43.1520, lng: 22.5860 },
// };

// function getCoords(region) {
//   if (REGION_COORDS[region]) return REGION_COORDS[region];
//   // fuzzy match
//   const key = Object.keys(REGION_COORDS).find(k => region?.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(region?.toLowerCase()));
//   if (key) return REGION_COORDS[key];
//   return { lat: 44.0 + Math.random() * 2 - 1, lng: 20.5 + Math.random() * 2 - 1 };
// }

// /* =========================
//    Chart tooltip
//    ========================= */

// function ChartTooltip({ active, payload }) {
//   if (!active || !payload || !payload.length) return null;
//   const p = payload[0]?.payload;
//   if (!p) return null;

//   return (
//     <div className="srAff_tip">
//       <div className="srAff_tipTitle">{p.label}</div>
//       <div>Income: <b>€{p.x}K/yr</b></div>
//       <div>Price: <b>€{p.y}K</b></div>
//       <div>P/I Ratio: <b>{round1(p.ratio)}x</b></div>
//       <div>EMI %: <b>{round1(p.emiPct)}%</b></div>
//       <div>Status: <b>{statusLabel(p.status)}</b></div>
//     </div>
//   );
// }

// /* =========================
//    Small UI icons
//    ========================= */

// function LogoMark() {
//   return (
//     <div className="srAff_logo">
//       <span className="srAff_logoMark" aria-hidden="true">
//         <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
//           <path d="M4 12.2C6.2 7.2 10 4 12.5 4c3.4 0 6.5 3.6 7.5 8.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
//           <path d="M20 11.8C17.8 16.8 14 20 11.5 20 8.1 20 5 16.4 4 11.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
//         </svg>
//       </span>
//       <div className="srAff_logoText">
//         <div className="srAff_logoTop">PolicyLens</div>
//         <div className="srAff_logoSub">Affordability</div>
//       </div>
//     </div>
//   );
// }

// function IconBell() {
//   return (
//     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//       <path d="M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22Z" fill="currentColor" opacity="0.9"/>
//       <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
//     </svg>
//   );
// }

// function IconUser() {
//   return (
//     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//       <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="2"/>
//       <path d="M4 20c1.6-3.8 5-6 8-6s6.4 2.2 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
//     </svg>
//   );
// }

// function IconSearch() {
//   return (
//     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//       <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2"/>
//       <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
//     </svg>
//   );
// }

// function IconFilter() {
//   return (
//     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//       <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
//     </svg>
//   );
// }

// function IconBack() {
//   return (
//     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//       <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
//     </svg>
//   );
// }

// /* =========================
//    Map component
//    ========================= */

// function SerbiaCityMap({ cities }) {
//   const center = useMemo(() => [44.1, 20.8], []);
//   const [hovered, setHovered] = useState(null);

//   return (
//     <section className="srAff_card">
//       <header className="srAff_cardHeader">
//         <h3 className="srAff_cardTitle">Serbia Affordability Map</h3>
//         <p className="srAff_muted">Hover on points to see city affordability metrics</p>
//       </header>

//       <div className="srAff_mapWrap">
//         <MapContainer center={center} zoom={7} scrollWheelZoom={true} style={{ height: 420, width: "100%" }}>
//           <TileLayer
//             attribution='&copy; OpenStreetMap contributors'
//             url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//           />

//           {cities.map((c) => {
//             const color = statusColor(c.status);
//             const radius = Math.min(14, Math.max(6, Math.round(c.ratio)));

//             return (
//               <CircleMarker
//                 key={c.city}
//                 center={[c.lat, c.lng]}
//                 radius={radius}
//                 pathOptions={{
//                   color,
//                   fillColor: color,
//                   fillOpacity: 0.75,
//                   weight: hovered?.city === c.city ? 3 : 1,
//                   opacity: 0.95,
//                 }}
//                 eventHandlers={{
//                   mouseover: () => setHovered(c),
//                   mouseout: () => setHovered(null),
//                 }}
//               >
//                 <Tooltip direction="top" offset={[0, -6]} opacity={1} permanent={false}>
//                   <div style={{ minWidth: 200 }}>
//                     <div style={{ fontWeight: 900, marginBottom: 6 }}>{c.city}</div>
//                     <div>Status: <b>{statusLabel(c.status)}</b></div>
//                     <div>Price: <b>€{c.priceK}K</b></div>
//                     <div>Income: <b>€{c.incomeK}K/yr</b></div>
//                     <div>P/I Ratio: <b>{round1(c.ratio)}x</b></div>
//                     <div>EMI %: <b>{round1(c.emiPct)}%</b></div>
//                   </div>
//                 </Tooltip>
//               </CircleMarker>
//             );
//           })}
//         </MapContainer>
//       </div>
//     </section>
//   );
// }

// /* =========================
//    Main page
//    ========================= */

// export default function Affordability() {
//   const navigate = useNavigate();
//   const DASHBOARD_ROUTE = "/dashboard";

//   // ── API State ──────────────────────────────────────────────
//   const [apiData, setApiData] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     setLoading(true);
//     getAffordabilityData()
//       .then((res) => {
//         setApiData(res.data ?? null);
//         setLoading(false);
//       })
//       .catch((err) => {
//         setError(err.message);
//         setLoading(false);
//       });
//   }, []);

//   // sliders (live)
//   const [maxRatioUI, setMaxRatioUI] = useState(8);
//   const [maxEmiUI, setMaxEmiUI] = useState(35);

//   // applied simulation (only changes on Run)
//   const [sim, setSim] = useState({ maxRatio: 8, maxEmiPct: 35 });

//   // search + city filter
//   const [searchText, setSearchText] = useState("");
//   const [cityFilter, setCityFilter] = useState("All Cities");

//   // ── Build cities array from API data ──────────────────────
//   // API returns avgPricesByRegion: [{ region, avgPrice, affordabilityRatio, count }]
//   // API returns incomeCategories with different income levels
//   // We map regions to cities using coords and derive incomeK from middle income
//   const BASE_CITIES = useMemo(() => {
//     if (!apiData) return [];

//     const regions = apiData.avgPricesByRegion ?? [];
//     // Middle income from Serbia: ~30000 EUR/yr, but adjust per region
//     // Use affordabilityRatio (price / middle income) to back-calculate income
//     // affordabilityRatio = avgPrice / 30000 (middle income)
//     const middleIncome = apiData.incomeCategories?.["Middle Income"]?.avgIncome ?? 30000;

//     return regions.map((r) => {
//       const coords = getCoords(r.region);
//       const priceK = Math.round(r.avgPrice / 1000);
//       const incomeK = Math.round(middleIncome / 1000);
//       // Derive eligible % from affordabilityRatio
//       const eligible = Math.max(5, Math.round(100 - r.affordabilityRatio * 10));
//       // Derive newUnits from count (scaled)
//       const newUnits = r.count ? Math.round(r.count * 0.3) : 50;
//       const deltaPct = parseFloat((((r.affordabilityRatio - 5) * -2)).toFixed(1));

//       return {
//         city: r.region,
//         lat: coords.lat,
//         lng: coords.lng,
//         priceK,
//         incomeK,
//         eligible: Math.max(5, Math.min(95, eligible)),
//         newUnits: Math.max(10, newUnits),
//         deltaPct,
//       };
//     });
//   }, [apiData]);

//   // compute cities with simulation values
//   const cities = useMemo(() => {
//     return BASE_CITIES.map((c) => {
//       const m = calcMetrics(c, sim);
//       return { ...c, ...m };
//     });
//   }, [BASE_CITIES, sim]);

//   // options for dropdown
//   const cityOptions = useMemo(() => ["All Cities", ...BASE_CITIES.map((c) => c.city)], [BASE_CITIES]);

//   // filtered view
//   const filteredCities = useMemo(() => {
//     let rows = cities;

//     if (cityFilter !== "All Cities") {
//       rows = rows.filter((c) => c.city === cityFilter);
//     }

//     const q = searchText.trim().toLowerCase();
//     if (q) {
//       rows = rows.filter((c) => c.city.toLowerCase().includes(q));
//     }

//     return rows;
//   }, [cities, cityFilter, searchText]);

//   // KPIs derived from API + simulation
//   const kpis = useMemo(() => {
//     if (!apiData) return [
//       { title: "National HAI", value: "—", sub: "Price to Income Ratio", delta: "" },
//       { title: "Eligible Households", value: "—", sub: "Can afford median home", delta: "" },
//       { title: "Affordability Score", value: "—", sub: "Out of 100", delta: "" },
//       { title: "Median Ratio", value: "—", sub: "Price / Annual Income", delta: "" },
//     ];

//     const overallScore = apiData.overallScore ?? 0;
//     const avgRatio = apiData.averageRatio ?? 0;
//     const trend = apiData.trend ?? 0;

//     const ratios = cities.map((c) => c.ratio).sort((a, b) => a - b);
//     const medianRatio = ratios.length ? ratios[Math.floor(ratios.length / 2)] : avgRatio;

//     const affordableCount = cities.filter((c) => c.status === "affordable").length;
//     const eligiblePct = cities.length ? Math.round((affordableCount / cities.length) * 100) : 0;

//     const totalNewUnits = cities.reduce((sum, c) => sum + (c.newUnits || 0), 0);

//     return [
//       { title: "National HAI", value: round1(avgRatio).toString(), sub: "Avg Price to Income Ratio", delta: "" },
//       { title: "Eligible Households", value: `${eligiblePct}%`, sub: "Can afford median home", delta: "" },
//       { title: "Affordability Score", value: `${overallScore}`, sub: `Out of 100 — ${apiData.interpretation?.level ?? ""}`, delta: trend ? `${trend > 0 ? "+" : ""}${round1(trend)}%` : "" },
//       { title: "Median Ratio", value: `${round1(medianRatio)}x`, sub: "Price / Annual Income", delta: "" },
//     ];
//   }, [apiData, cities]);

//   // chart points
//   const chartData = useMemo(() => {
//     return filteredCities
//       .map((c) => ({
//         label: c.city,
//         x: c.incomeK,
//         y: c.priceK,
//         ratio: c.ratio,
//         emiPct: c.emiPct,
//         status: c.status,
//       }))
//       .sort((a, b) => a.x - b.x);
//   }, [filteredCities]);

//   const chartGreen = useMemo(() => chartData.filter((d) => d.status === "affordable"), [chartData]);
//   const chartAmber = useMemo(() => chartData.filter((d) => d.status === "stressed"), [chartData]);
//   const chartRed = useMemo(() => chartData.filter((d) => d.status === "critical"), [chartData]);

//   // bar data
//   const barData = useMemo(() => {
//     return filteredCities
//       .map((c) => ({
//         city: c.city,
//         eligible: c.eligible,
//         newUnits: c.newUnits,
//         deltaPct: c.deltaPct,
//         status: c.status,
//       }))
//       .sort((a, b) => b.newUnits - a.newUnits);
//   }, [filteredCities]);

//   function onRunSimulation() {
//     setSim({ maxRatio: Number(maxRatioUI), maxEmiPct: Number(maxEmiUI) });
//   }

//   // ── Loading / Error states ────────────────────────────────
//   if (loading) {
//     return (
//       <div id="sr_afford_root_9182" className="srAff_page">
//         <div className="srAff_container">
//           <div style={{ textAlign: "center", padding: "4rem", color: "#666" }}>
//             Loading affordability data...
//           </div>
//         </div>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div id="sr_afford_root_9182" className="srAff_page">
//         <div className="srAff_container">
//           <div style={{ textAlign: "center", padding: "4rem", color: "#d92d20" }}>
//             <strong>Error:</strong> {error}
//             <br />
//             <button onClick={() => window.location.reload()} style={{ marginTop: "1rem", padding: "0.5rem 1rem" }}>
//               Retry
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div id="sr_afford_root_9182" className="srAff_page">
//       <div className="srAff_container">
//         {/* Top bar with BACK button */}
//         <div className="srAff_appBar">
//           <div className="srAff_leftZone">
//             <button
//               type="button"
//               className="srAff_backBtn"
//               onClick={() => navigate(DASHBOARD_ROUTE)}
//               aria-label="Back to Dashboard"
//               title="Back to Dashboard"
//             >
//               <IconBack />
//               <span className="srAff_backText">Back</span>
//             </button>
//             <LogoMark />
//           </div>

//           <div className="srAff_appBarRight">
//             <div className="srAff_search" role="search">
//               <span className="srAff_searchIcon"><IconSearch /></span>
//               <input
//                 className="srAff_searchInput"
//                 value={searchText}
//                 onChange={(e) => setSearchText(e.target.value)}
//                 placeholder="Search region…"
//                 aria-label="Search region"
//               />
//             </div>

//             <div className="srAff_filter">
//               <span className="srAff_filterIcon" aria-hidden="true"><IconFilter /></span>
//               <select
//                 className="srAff_filterSelect"
//                 value={cityFilter}
//                 onChange={(e) => setCityFilter(e.target.value)}
//                 aria-label="Filter by city"
//               >
//                 {cityOptions.map((c) => (
//                   <option key={c} value={c}>{c}</option>
//                 ))}
//               </select>
//             </div>

//             <button className="srAff_iconBtn" type="button" title="Notifications" aria-label="Notifications">
//               <IconBell />
//               <span className="srAff_dot" aria-hidden="true" />
//             </button>
//             <button className="srAff_iconBtn" type="button" title="Profile" aria-label="Profile">
//               <IconUser />
//             </button>
//           </div>
//         </div>

//         <div className="srAff_topTitle">
//           <div className="srAff_pill">Housing Policy</div>
//           <h1 className="srAff_h1">Affordable Housing Dashboard</h1>
//           <p className="srAff_muted">
//             Housing affordability anchored to income reality — not headline prices
//             {apiData?.interpretation?.recommendation ? ` · ${apiData.interpretation.recommendation}` : ""}
//           </p>
//         </div>

//         <div className="srAff_kpiRow">
//           {kpis.map((k) => (
//             <div className="srAff_kpiCard" key={k.title}>
//               <div className="srAff_kpiTitle">{k.title}</div>
//               <div className="srAff_kpiValue">
//                 {k.value} {k.delta ? <span className="srAff_kpiDelta">{k.delta}</span> : null}
//               </div>
//               <div className="srAff_kpiSub">{k.sub}</div>
//             </div>
//           ))}
//         </div>

//         {/* Scatter Chart */}
//         <div className="srAff_grid1">
//           <section className="srAff_card srAff_chartCard">
//             <header className="srAff_cardHeader">
//               <h3 className="srAff_cardTitle">Income vs Price by Region</h3>
//               <p className="srAff_muted srAff_chartMuted">Red zone = structurally unaffordable (ratio &gt; {sim.maxRatio}x)</p>
//             </header>

//             <div className="srAff_chartMock srAff_chartOffWhite" style={{ height: 360 }}>
//               <ResponsiveContainer width="100%" height="100%">
//                 <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 10 }}>
//                   <CartesianGrid strokeDasharray="4 6" />
//                   <XAxis
//                     type="number"
//                     dataKey="x"
//                     name="Income"
//                     unit="K"
//                     tickFormatter={(v) => `${v}K`}
//                     label={{ value: "Household Income (€K/year)", position: "bottom", offset: 10 }}
//                     tick={{ fill: "#0b1220" }}
//                     axisLine={{ stroke: "rgba(0,0,0,0.25)" }}
//                     tickLine={{ stroke: "rgba(0,0,0,0.25)" }}
//                   />
//                   <YAxis
//                     type="number"
//                     dataKey="y"
//                     name="Price"
//                     unit="K"
//                     tickFormatter={(v) => `${v}K`}
//                     label={{ value: "Median Price (€K)", angle: -90, position: "insideLeft" }}
//                     tick={{ fill: "#0b1220" }}
//                     axisLine={{ stroke: "rgba(0,0,0,0.25)" }}
//                     tickLine={{ stroke: "rgba(0,0,0,0.25)" }}
//                   />
//                   <ReTooltip content={<ChartTooltip />} />
//                   <Scatter data={chartGreen} fill="#12b76a" />
//                   <Scatter data={chartAmber} fill="#f79009" />
//                   <Scatter data={chartRed} fill="#d92d20" />
//                 </ScatterChart>
//               </ResponsiveContainer>
//             </div>
//           </section>
//         </div>

//         {/* Bar chart */}
//         <section className="srAff_card">
//           <header className="srAff_cardHeader">
//             <h3 className="srAff_cardTitle">Supply & Eligibility by Region</h3>
//             <p className="srAff_muted">Compare pipeline (new units) with eligibility and recent change</p>
//           </header>

//           <div className="srAff_chartMock" style={{ height: 360 }}>
//             <ResponsiveContainer width="100%" height="100%">
//               <BarChart data={barData} margin={{ top: 10, right: 16, bottom: 18, left: 0 }}>
//                 <CartesianGrid strokeDasharray="4 6" />
//                 <XAxis dataKey="city" interval={0} angle={-18} textAnchor="end" height={70} />
//                 <YAxis />
//                 <ReTooltip
//                   content={({ active, payload, label }) => {
//                     if (!active || !payload || !payload.length) return null;
//                     const row = payload[0]?.payload;
//                     if (!row) return null;
//                     return (
//                       <div className="srAff_tip">
//                         <div className="srAff_tipTitle">{label}</div>
//                         <div>Eligible: <b>{row.eligible}%</b></div>
//                         <div>New Units: <b>{row.newUnits}</b></div>
//                         <div>Δ Price: <b>{row.deltaPct}%</b></div>
//                         <div>Status: <b>{statusLabel(row.status)}</b></div>
//                       </div>
//                     );
//                   }}
//                 />
//                 <Legend />
//                 <Bar dataKey="newUnits" name="New Affordable Units" fill="#1d4ed8" radius={[10, 10, 0, 0]} />
//                 <Bar dataKey="eligible" name="Eligible (%)" fill="#60a5fa" radius={[10, 10, 0, 0]} />
//               </BarChart>
//             </ResponsiveContainer>
//           </div>
//         </section>

//         {/* Map */}
//         <SerbiaCityMap cities={filteredCities} />

//         {/* Heatmap */}
//         <section className="srAff_card">
//           <header className="srAff_cardHeader">
//             <h3 className="srAff_cardTitle">Region Affordability Heatmap</h3>
//             <p className="srAff_muted">Green = affordable, Amber = stressed, Red = critical</p>
//           </header>

//           <div className="srAff_heatGrid">
//             {filteredCities.slice(0, 10).map((c) => {
//               const s = c.status;
//               return (
//                 <div key={c.city} className={`srAff_heatCard srAff_heatCard_${s}`}>
//                   <div className="srAff_heatCity">{c.city}</div>
//                   <div className="srAff_heatScore">{round1(c.ratio)}x</div>
//                   <div className="srAff_heatLabel">P/I Ratio</div>
//                   <div className="srAff_heatStatus">
//                     <span className={`srAff_status srAff_status_${s}`}>{statusLabel(s)}</span>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         </section>

//         {/* Income Category Breakdown from API */}
//         {apiData?.incomeCategories && (
//           <section className="srAff_card">
//             <header className="srAff_cardHeader">
//               <h3 className="srAff_cardTitle">Price-to-Income by Category</h3>
//               <p className="srAff_muted">Affordability across income segments</p>
//             </header>
//             <div className="srAff_tableWrap">
//               <table className="srAff_table">
//                 <thead>
//                   <tr>
//                     <th>Income Category</th>
//                     <th>Avg Annual Income</th>
//                     <th>Avg Property Price</th>
//                     <th>P/I Ratio</th>
//                     <th>Percentile</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {Object.entries(apiData.incomeCategories).map(([cat, d]) => (
//                     <tr key={cat}>
//                       <td>{cat}</td>
//                       <td>€{(d.avgIncome / 1000).toFixed(0)}K/yr</td>
//                       <td>€{(d.avgPropertyPrice / 1000).toFixed(0)}K</td>
//                       <td>{d.priceToIncome}x</td>
//                       <td>{d.percentile}</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </section>
//         )}

//         {/* Detailed Region Table */}
//         <section className="srAff_card">
//           <header className="srAff_cardHeader">
//             <h3 className="srAff_cardTitle">Detailed Region Analysis</h3>
//           </header>

//           <div className="srAff_tableWrap">
//             <table className="srAff_table">
//               <thead>
//                 <tr>
//                   <th>Region</th>
//                   <th>Median Price</th>
//                   <th>Median Income</th>
//                   <th>P/I Ratio</th>
//                   <th>EMI %</th>
//                   <th>Status</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {filteredCities.map((c) => (
//                   <tr key={c.city}>
//                     <td>{c.city}</td>
//                     <td>€{c.priceK}K</td>
//                     <td>€{c.incomeK}K/yr</td>
//                     <td>{round1(c.ratio)}x</td>
//                     <td>{round1(c.emiPct)}%</td>
//                     <td>
//                       <span className={`srAff_status srAff_status_${c.status}`}>{statusLabel(c.status)}</span>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>

//             {!filteredCities.length ? (
//               <div className="srAff_emptyState">
//                 No regions match your search/filter.
//               </div>
//             ) : null}
//           </div>
//         </section>

//         <footer className="srAff_footer">
//           <div>© {new Date().getFullYear()} PolicyLens • Built for policy simulation & monitoring</div>
//           <div className="srAff_footerRight">
//             <span className="srAff_footerPill">v1.0</span>
//             <span className="srAff_footerPill">Serbia Demo</span>
//           </div>
//         </footer>
//       </div>
//     </div>
//   );
// }

// // Affordability.jsx
// import React, { useMemo, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import "./Affordability.css";
// import "leaflet/dist/leaflet.css";

// import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";

// import {
//   ResponsiveContainer,
//   ScatterChart,
//   Scatter,
//   XAxis,
//   YAxis,
//   CartesianGrid,
//   Tooltip as ReTooltip,
//   BarChart,
//   Bar,
//   Legend,
// } from "recharts";

// /* =========================
//    Helpers
//    ========================= */

// // Mortgage EMI (monthly) using standard annuity formula
// function calcMonthlyEMI(priceEUR, annualRate = 0.06, years = 25) {
//   const r = annualRate / 12;
//   const n = years * 12;
//   if (r === 0) return priceEUR / n;
//   const pow = Math.pow(1 + r, n);
//   return (priceEUR * r * pow) / (pow - 1);
// }

// function calcMetrics({ priceK, incomeK }, { maxRatio, maxEmiPct }) {
//   const price = priceK * 1000;
//   const incomeAnnual = incomeK * 1000;
//   const incomeMonthly = incomeAnnual / 12;

//   const ratio = incomeAnnual > 0 ? price / incomeAnnual : 999;

//   const emiMonthly = calcMonthlyEMI(price, 0.06, 25);
//   const emiPct = incomeMonthly > 0 ? (emiMonthly / incomeMonthly) * 100 : 999;

//   const affordableByRatio = ratio <= maxRatio;
//   const affordableByEmi = emiPct <= maxEmiPct;

//   // status: green if passes both; amber if passes one; red if passes none
//   let status = "critical";
//   if (affordableByRatio && affordableByEmi) status = "affordable";
//   else if (affordableByRatio || affordableByEmi) status = "stressed";

//   return { ratio, emiPct, status };
// }

// function statusLabel(status) {
//   if (status === "affordable") return "Affordable";
//   if (status === "stressed") return "Stressed";
//   return "Critical";
// }

// function statusColor(status) {
//   if (status === "affordable") return "#12b76a";
//   if (status === "stressed") return "#f79009";
//   return "#d92d20";
// }

// function round1(n) {
//   return Math.round(n * 10) / 10;
// }

// /* =========================
//    Base data
//    ========================= */

// const SERBIA_CITIES = [
//   { city: "Belgrade", lat: 44.8176, lng: 20.4633, priceK: 185, incomeK: 15, eligible: 18, newUnits: 342, deltaPct: -5.2 },
//   { city: "Novi Sad", lat: 45.2671, lng: 19.8335, priceK: 145, incomeK: 14, eligible: 24, newUnits: 187, deltaPct: 8.4 },
//   { city: "Niš", lat: 43.3209, lng: 21.8958, priceK: 78, incomeK: 11, eligible: 38, newUnits: 124, deltaPct: 12.1 },
//   { city: "Kragujevac", lat: 44.0128, lng: 20.9114, priceK: 68, incomeK: 10, eligible: 42, newUnits: 98, deltaPct: 15.3 },
//   { city: "Subotica", lat: 46.1006, lng: 19.6653, priceK: 72, incomeK: 10, eligible: 40, newUnits: 76, deltaPct: 6.8 },
//   { city: "Zrenjanin", lat: 45.3814, lng: 20.3861, priceK: 55, incomeK: 9, eligible: 48, newUnits: 54, deltaPct: 9.2 },
//   { city: "Pančevo", lat: 44.8705, lng: 20.6403, priceK: 95, incomeK: 12, eligible: 35, newUnits: 67, deltaPct: -2.1 },
//   { city: "Čačak", lat: 43.8914, lng: 20.3497, priceK: 48, incomeK: 9, eligible: 52, newUnits: 43, deltaPct: 18.4 },
//   { city: "Leskovac", lat: 42.9981, lng: 21.9465, priceK: 42, incomeK: 8, eligible: 55, newUnits: 38, deltaPct: 22.6 },
//   { city: "Kraljevo", lat: 43.7246, lng: 20.687, priceK: 52, incomeK: 9, eligible: 50, newUnits: 45, deltaPct: 14.2 },
// ];

// /* =========================
//    Chart tooltip
//    ========================= */

// function ChartTooltip({ active, payload }) {
//   if (!active || !payload || !payload.length) return null;
//   const p = payload[0]?.payload;
//   if (!p) return null;

//   return (
//     <div className="srAff_tip">
//       <div className="srAff_tipTitle">{p.label}</div>
//       <div>Income: <b>€{p.x}K/yr</b></div>
//       <div>Price: <b>€{p.y}K</b></div>
//       <div>P/I Ratio: <b>{round1(p.ratio)}x</b></div>
//       <div>EMI %: <b>{round1(p.emiPct)}%</b></div>
//       <div>Status: <b>{statusLabel(p.status)}</b></div>
//     </div>
//   );
// }

// /* =========================
//    Small UI icons (no extra libs)
//    ========================= */

// function LogoMark() {
//   return (
//     <div className="srAff_logo">
//       <span className="srAff_logoMark" aria-hidden="true">
//         <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
//           <path d="M4 12.2C6.2 7.2 10 4 12.5 4c3.4 0 6.5 3.6 7.5 8.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
//           <path d="M20 11.8C17.8 16.8 14 20 11.5 20 8.1 20 5 16.4 4 11.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.8"/>
//         </svg>
//       </span>
//       <div className="srAff_logoText">
//         <div className="srAff_logoTop">PolicyLens</div>
//         <div className="srAff_logoSub">Affordability</div>
//       </div>
//     </div>
//   );
// }

// function IconBell() {
//   return (
//     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//       <path d="M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22Z" fill="currentColor" opacity="0.9"/>
//       <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
//     </svg>
//   );
// }

// function IconUser() {
//   return (
//     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//       <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="2"/>
//       <path d="M4 20c1.6-3.8 5-6 8-6s6.4 2.2 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
//     </svg>
//   );
// }

// function IconSearch() {
//   return (
//     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//       <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2"/>
//       <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
//     </svg>
//   );
// }

// function IconFilter() {
//   return (
//     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//       <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
//     </svg>
//   );
// }

// function IconBack() {
//   return (
//     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
//       <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
//     </svg>
//   );
// }

// /* =========================
//    Map component
//    ========================= */

// function SerbiaCityMap({ cities }) {
//   const center = useMemo(() => [44.1, 20.8], []);
//   const [hovered, setHovered] = useState(null);

//   return (
//     <section className="srAff_card">
//       <header className="srAff_cardHeader">
//         <h3 className="srAff_cardTitle">Serbia Affordability Map</h3>
//         <p className="srAff_muted">Hover on points to see city affordability metrics</p>
//       </header>

//       <div className="srAff_mapWrap">
//         <MapContainer center={center} zoom={7} scrollWheelZoom={true} style={{ height: 420, width: "100%" }}>
//           <TileLayer
//             attribution='&copy; OpenStreetMap contributors'
//             url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//           />

//           {cities.map((c) => {
//             const color = statusColor(c.status);
//             const radius = Math.min(14, Math.max(6, Math.round(c.ratio)));

//             return (
//               <CircleMarker
//                 key={c.city}
//                 center={[c.lat, c.lng]}
//                 radius={radius}
//                 pathOptions={{
//                   color,
//                   fillColor: color,
//                   fillOpacity: 0.75,
//                   weight: hovered?.city === c.city ? 3 : 1,
//                   opacity: 0.95,
//                 }}
//                 eventHandlers={{
//                   mouseover: () => setHovered(c),
//                   mouseout: () => setHovered(null),
//                 }}
//               >
//                 <Tooltip direction="top" offset={[0, -6]} opacity={1} permanent={false}>
//                   <div style={{ minWidth: 200 }}>
//                     <div style={{ fontWeight: 900, marginBottom: 6 }}>{c.city}</div>
//                     <div>Status: <b>{statusLabel(c.status)}</b></div>
//                     <div>Price: <b>€{c.priceK}K</b></div>
//                     <div>Income: <b>€{c.incomeK}K/yr</b></div>
//                     <div>P/I Ratio: <b>{round1(c.ratio)}x</b></div>
//                     <div>EMI %: <b>{round1(c.emiPct)}%</b></div>
//                   </div>
//                 </Tooltip>
//               </CircleMarker>
//             );
//           })}
//         </MapContainer>
//       </div>
//     </section>
//   );
// }

// /* =========================
//    Main page
//    ========================= */

// export default function Affordability() {
//   const navigate = useNavigate();
//   const DASHBOARD_ROUTE = "/dashboard"; // change to "/" if your dashboard route is home

//   // sliders (live)
//   const [maxRatioUI, setMaxRatioUI] = useState(8);
//   const [maxEmiUI, setMaxEmiUI] = useState(35);

//   // applied simulation (only changes on Run)
//   const [sim, setSim] = useState({ maxRatio: 8, maxEmiPct: 35 });

//   // NEW: search + city filter (does not change existing logic)
//   const [searchText, setSearchText] = useState("");
//   const [cityFilter, setCityFilter] = useState("All Cities");

//   // compute cities with simulation values (applied)
//   const cities = useMemo(() => {
//     return SERBIA_CITIES.map((c) => {
//       const m = calcMetrics(c, sim);
//       return { ...c, ...m };
//     });
//   }, [sim]);

//   // options for dropdown
//   const cityOptions = useMemo(() => ["All Cities", ...SERBIA_CITIES.map((c) => c.city)], []);

//   // NEW: filtered view used for charts/map/heat/table (no simulation logic change)
//   const filteredCities = useMemo(() => {
//     let rows = cities;

//     if (cityFilter !== "All Cities") {
//       rows = rows.filter((c) => c.city === cityFilter);
//     }

//     const q = searchText.trim().toLowerCase();
//     if (q) {
//       rows = rows.filter((c) => c.city.toLowerCase().includes(q));
//     }

//     return rows;
//   }, [cities, cityFilter, searchText]);

//   // KPIs derived from simulation (keep original logic using "cities")
//   const kpis = useMemo(() => {
//     const ratios = cities.map((c) => c.ratio).sort((a, b) => a - b);
//     const medianRatio = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 0;

//     const affordableCount = cities.filter((c) => c.status === "affordable").length;
//     const eligiblePct = cities.length ? Math.round((affordableCount / cities.length) * 100) : 0;

//     return [
//       { title: "National HAI", value: round1(medianRatio).toString(), sub: "Price to Income Ratio", delta: "" },
//       { title: "Eligible Households", value: `${eligiblePct}%`, sub: "Can afford median home", delta: "" },
//       { title: "New Affordable Units", value: "1,074", sub: "Min increase", delta: "+8.2%" },
//       { title: "Median Ratio", value: `${round1(medianRatio)}x`, sub: "Price / Annual Income", delta: "" },
//     ];
//   }, [cities]);

//   // chart points (use filteredCities)
//   const chartData = useMemo(() => {
//     return filteredCities
//       .map((c) => ({
//         label: c.city,
//         x: c.incomeK,
//         y: c.priceK,
//         ratio: c.ratio,
//         emiPct: c.emiPct,
//         status: c.status,
//       }))
//       .sort((a, b) => a.x - b.x);
//   }, [filteredCities]);

//   const chartGreen = useMemo(() => chartData.filter((d) => d.status === "affordable"), [chartData]);
//   const chartAmber = useMemo(() => chartData.filter((d) => d.status === "stressed"), [chartData]);
//   const chartRed = useMemo(() => chartData.filter((d) => d.status === "critical"), [chartData]);

//   // bar data (use filteredCities)
//   const barData = useMemo(() => {
//     return filteredCities
//       .map((c) => ({
//         city: c.city,
//         eligible: c.eligible,
//         newUnits: c.newUnits,
//         deltaPct: c.deltaPct,
//         status: c.status,
//       }))
//       .sort((a, b) => b.newUnits - a.newUnits);
//   }, [filteredCities]);

//   function onRunSimulation() {
//     setSim({ maxRatio: Number(maxRatioUI), maxEmiPct: Number(maxEmiUI) });
//   }

//   return (
//     <div id="sr_afford_root_9182" className="srAff_page">
//       <div className="srAff_container">
//         {/* Top bar with BACK button */}
//         <div className="srAff_appBar">
//           <div className="srAff_leftZone">
//             <button
//               type="button"
//               className="srAff_backBtn"
//               onClick={() => navigate(DASHBOARD_ROUTE)}
//               aria-label="Back to Dashboard"
//               title="Back to Dashboard"
//             >
//               <IconBack />
//               <span className="srAff_backText">Back</span>
//             </button>
//             <LogoMark />
//           </div>

//           {/* Search + Filter (Serbia cities) */}
//           <div className="srAff_appBarRight">
//             <div className="srAff_search" role="search">
//               <span className="srAff_searchIcon"><IconSearch /></span>
//               <input
//                 className="srAff_searchInput"
//                 value={searchText}
//                 onChange={(e) => setSearchText(e.target.value)}
//                 placeholder="Search Serbia city…"
//                 aria-label="Search Serbia city"
//               />
//             </div>

//             <div className="srAff_filter">
//               <span className="srAff_filterIcon" aria-hidden="true"><IconFilter /></span>
//               <select
//                 className="srAff_filterSelect"
//                 value={cityFilter}
//                 onChange={(e) => setCityFilter(e.target.value)}
//                 aria-label="Filter by city"
//               >
//                 {cityOptions.map((c) => (
//                   <option key={c} value={c}>{c}</option>
//                 ))}
//               </select>
//             </div>

//             <button className="srAff_iconBtn" type="button" title="Notifications" aria-label="Notifications">
//               <IconBell />
//               <span className="srAff_dot" aria-hidden="true" />
//             </button>
//             <button className="srAff_iconBtn" type="button" title="Profile" aria-label="Profile">
//               <IconUser />
//             </button>
//           </div>
//         </div>

//         <div className="srAff_topTitle">
//           <div className="srAff_pill">Housing Policy</div>
//           <h1 className="srAff_h1">Affordable Housing Dashboard</h1>
//           <p className="srAff_muted">Housing affordability anchored to income reality — not headline prices</p>
//         </div>

//         <div className="srAff_kpiRow">
//           {kpis.map((k) => (
//             <div className="srAff_kpiCard" key={k.title}>
//               <div className="srAff_kpiTitle">{k.title}</div>
//               <div className="srAff_kpiValue">
//                 {k.value} {k.delta ? <span className="srAff_kpiDelta">{k.delta}</span> : null}
//               </div>
//               <div className="srAff_kpiSub">{k.sub}</div>
//             </div>
//           ))}
//         </div>

//         {/* FULL ROW Scatter Chart (Policy Simulation removed) */}
//         <div className="srAff_grid1">
//           <section className="srAff_card srAff_chartCard">
//             <header className="srAff_cardHeader">
//               <h3 className="srAff_cardTitle">Income vs Price by Decile</h3>
//               <p className="srAff_muted srAff_chartMuted">Red zone = structurally unaffordable (ratio &gt; {sim.maxRatio}x)</p>
//             </header>

//             <div className="srAff_chartMock srAff_chartOffWhite" style={{ height: 360 }}>
//               <ResponsiveContainer width="100%" height="100%">
//                 <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 10 }}>
//                   <CartesianGrid strokeDasharray="4 6" />
//                   <XAxis
//                     type="number"
//                     dataKey="x"
//                     name="Income"
//                     unit="K"
//                     tickFormatter={(v) => `${v}K`}
//                     label={{ value: "Household Income (€K/year)", position: "bottom", offset: 10 }}
//                     tick={{ fill: "#0b1220" }}
//                     axisLine={{ stroke: "rgba(0,0,0,0.25)" }}
//                     tickLine={{ stroke: "rgba(0,0,0,0.25)" }}
//                   />
//                   <YAxis
//                     type="number"
//                     dataKey="y"
//                     name="Price"
//                     unit="K"
//                     tickFormatter={(v) => `${v}K`}
//                     label={{ value: "Median Price (€K)", angle: -90, position: "insideLeft" }}
//                     tick={{ fill: "#0b1220" }}
//                     axisLine={{ stroke: "rgba(0,0,0,0.25)" }}
//                     tickLine={{ stroke: "rgba(0,0,0,0.25)" }}
//                   />
//                   <ReTooltip content={<ChartTooltip />} />
//                   <Scatter data={chartGreen} fill="#12b76a" />
//                   <Scatter data={chartAmber} fill="#f79009" />
//                   <Scatter data={chartRed} fill="#d92d20" />
//                 </ScatterChart>
//               </ResponsiveContainer>
//             </div>
//           </section>
//         </div>

//         {/* Bar chart */}
//         <section className="srAff_card">
//           <header className="srAff_cardHeader">
//             <h3 className="srAff_cardTitle">Supply & Eligibility by City</h3>
//             <p className="srAff_muted">Compare pipeline (new units) with eligibility and recent change</p>
//           </header>

//           <div className="srAff_chartMock" style={{ height: 360 }}>
//             <ResponsiveContainer width="100%" height="100%">
//               <BarChart data={barData} margin={{ top: 10, right: 16, bottom: 18, left: 0 }}>
//                 <CartesianGrid strokeDasharray="4 6" />
//                 <XAxis dataKey="city" interval={0} angle={-18} textAnchor="end" height={70} />
//                 <YAxis />
//                 <ReTooltip
//                   content={({ active, payload, label }) => {
//                     if (!active || !payload || !payload.length) return null;
//                     const row = payload[0]?.payload;
//                     if (!row) return null;
//                     return (
//                       <div className="srAff_tip">
//                         <div className="srAff_tipTitle">{label}</div>
//                         <div>Eligible: <b>{row.eligible}%</b></div>
//                         <div>New Units: <b>{row.newUnits}</b></div>
//                         <div>Δ Price: <b>{row.deltaPct}%</b></div>
//                         <div>Status: <b>{statusLabel(row.status)}</b></div>
//                       </div>
//                     );
//                   }}
//                 />
//                 <Legend />
//                 <Bar dataKey="newUnits" name="New Affordable Units" fill="#1d4ed8" radius={[10, 10, 0, 0]} />
//                 <Bar dataKey="eligible" name="Eligible (%)" fill="#60a5fa" radius={[10, 10, 0, 0]} />
//               </BarChart>
//             </ResponsiveContainer>
//           </div>
//         </section>

//         {/* Map */}
//         <SerbiaCityMap cities={filteredCities} />

//         {/* Heatmap */}
//         <section className="srAff_card">
//           <header className="srAff_cardHeader">
//             <h3 className="srAff_cardTitle">City Affordability Heatmap</h3>
//             <p className="srAff_muted">Green = affordable, Amber = stressed, Red = critical</p>
//           </header>

//           <div className="srAff_heatGrid">
//             {filteredCities.slice(0, 10).map((c) => {
//               const s = c.status;
//               return (
//                 <div key={c.city} className={`srAff_heatCard srAff_heatCard_${s}`}>
//                   <div className="srAff_heatCity">{c.city}</div>
//                   <div className="srAff_heatScore">{round1(c.ratio)}x</div>
//                   <div className="srAff_heatLabel">P/I Ratio</div>
//                   <div className="srAff_heatStatus">
//                     <span className={`srAff_status srAff_status_${s}`}>{statusLabel(s)}</span>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         </section>

//         {/* Table */}
//         <section className="srAff_card">
//           <header className="srAff_cardHeader">
//             <h3 className="srAff_cardTitle">Detailed City Analysis</h3>
//           </header>

//           <div className="srAff_tableWrap">
//             <table className="srAff_table">
//               <thead>
//                 <tr>
//                   <th>City</th>
//                   <th>Median Price</th>
//                   <th>Median Income</th>
//                   <th>P/I Ratio</th>
//                   <th>EMI %</th>
//                   <th>Status</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {filteredCities.map((c) => (
//                   <tr key={c.city}>
//                     <td>{c.city}</td>
//                     <td>€{c.priceK}K</td>
//                     <td>€{c.incomeK}K/yr</td>
//                     <td>{round1(c.ratio)}x</td>
//                     <td>{round1(c.emiPct)}%</td>
//                     <td>
//                       <span className={`srAff_status srAff_status_${c.status}`}>{statusLabel(c.status)}</span>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>

//             {!filteredCities.length ? (
//               <div className="srAff_emptyState">
//                 No cities match your search/filter.
//               </div>
//             ) : null}
//           </div>
//         </section>

//         <footer className="srAff_footer">
//           <div>© {new Date().getFullYear()} PolicyLens • Built for policy simulation & monitoring</div>
//           <div className="srAff_footerRight">
//             <span className="srAff_footerPill">v1.0</span>
//             <span className="srAff_footerPill">Serbia Demo</span>
//           </div>
//         </footer>
//       </div>
//     </div>
//   );
// }
