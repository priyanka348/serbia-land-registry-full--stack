import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Affordability from "./pages/Affordability";
import LegalCleanliness from "./pages/LegalCleanliness";
import Subsidy from "./pages/Subsidy";
import BubbleRisk from "./pages/BubbleRisk";

/* 🔹 navbar item imports (added only) */
import Overview from "./pages/Overview/Overview";
import Disputes from "./pages/Disputes/Disputes";
import Transfers from "./pages/Transfers/Transfers";
import Mortgages from "./pages/Mortgages/Mortgages";
import Regions from "./pages/Regions/Regions";

/* 🔹 NEW auth page imports (added only) */
import SignIn from "./pages/signPage/SignIn";
import SignUp from "./pages/signPage/SignUp";

export default function App() {
  return (
    <Routes>
      {/* existing routes – untouched */}
      <Route path="/" element={<Dashboard />} />
      <Route path="/affordability" element={<Affordability />} />
      <Route path="/legal-cleanliness" element={<LegalCleanliness />} />
      <Route path="/subsidy" element={<Subsidy />} />
      <Route path="/bubble-risk" element={<BubbleRisk />} />

      {/* 🔹 navbar routes added */}
      <Route path="/overview" element={<Overview />} />
      <Route path="/disputes" element={<Disputes />} />
      <Route path="/transfers" element={<Transfers />} />
      <Route path="/mortgages" element={<Mortgages />} />
      <Route path="/regions" element={<Regions />} />

      {/* 🔹 NEW auth routes added */}
      <Route path="/auth/signin" element={<SignIn />} />
      <Route path="/auth/signup" element={<SignUp />} />

      {/* existing fallback – untouched */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
