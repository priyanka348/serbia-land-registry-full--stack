// Navbar.jsx
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import "./Navbar.css";

export default function Navbar() {
  const location = useLocation();

  const rememberPrev = () => {
    sessionStorage.setItem("prev_path", location.pathname + location.search);
  };

  return (
    <nav className="nav" aria-label="Primary">
      <div className="navInner">
        <NavLink
          to="/overview"
          onClick={rememberPrev}
          className={({ isActive }) => "navItem " + (isActive ? "active" : "")}
        >
          Overview
        </NavLink>

        <NavLink
          to="/disputes"
          onClick={rememberPrev}
          className={({ isActive }) => "navItem " + (isActive ? "active" : "")}
        >
          Disputes
        </NavLink>

        <NavLink
          to="/transfers"
          onClick={rememberPrev}
          className={({ isActive }) => "navItem " + (isActive ? "active" : "")}
        >
          Transfers
        </NavLink>

        <NavLink
          to="/mortgages"
          onClick={rememberPrev}
          className={({ isActive }) => "navItem " + (isActive ? "active" : "")}
        >
          Mortgages
        </NavLink>

        <NavLink
          to="/regions"
          onClick={rememberPrev}
          className={({ isActive }) => "navItem " + (isActive ? "active" : "")}
        >
          Regions
        </NavLink>
      </div>
    </nav>
  );
}
