// Header.jsx
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import "./Header.css";
import flag from "../assets/serbia-flag.svg";
import { useLang } from "../context/LanguageContext";

export default function Header() {
  const navigate = useNavigate();
  const { lang, setLang, t } = useLang();

  // 🔹 Keyboard accessibility for logo click
  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      navigate("/overview");
    }
  };

  return (
    <header className="hdr">
      <div
        className="hdrLeft"
        onClick={() => navigate("/overview")}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Go to Overview"
        title="Go to Overview"
      >
        <img className="hdrFlag" src={flag} alt="Serbia Flag" />
        <div className="hdrTitle">{t("appTitle")}</div>
      </div>

      <div className="hdrRight">
        {/* ✅ Language Switcher (Whole Website) */}
        <div className="hdrLang">
          <span className="hdrLangLabel">{t("language ")}:</span>

          <button
            className={"hdrLangBtn " + (lang === "en" ? "active" : "")}
            onClick={() => setLang("en")}
            aria-pressed={lang === "en"}
            aria-label="Switch to English"
            type="button"
          >
            EN
          </button>

          <button
            className={"hdrLangBtn " + (lang === "sr" ? "active" : "")}
            onClick={() => setLang("sr")}
            aria-pressed={lang === "sr"}
            aria-label="Промени на српски"
            type="button"
          >
            SR
          </button>
        </div>

        {/* 🔐 Auth Links */}
        <NavLink to="/auth/signin" className="hdrBtnLink">
          <span className="hdrBtn">
            <span className="hdrBtnIcon" aria-hidden="true">
              🔒
            </span>
            {t("signIn")}
          </span>
        </NavLink>

        <NavLink to="/auth/signup" className="hdrBtnLink">
          <span className="hdrBtn hdrBtnOutline">
            <span className="hdrBtnIcon" aria-hidden="true">
              ✨
            </span>
            {t("signUp")}
          </span>
        </NavLink>

        <button
          className="hdrBell"
          aria-label={t("notifications")}
          type="button"
        >
          🔔
        </button>
      </div>
    </header>
  );
}
