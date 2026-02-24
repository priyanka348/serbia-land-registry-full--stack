import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translations } from "../i18n/translations";


const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "en");

  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang === "sr" ? "sr" : "en";
  }, [lang]);

  const value = useMemo(() => {
    const t = (key) => translations[lang]?.[key] ?? key;
    return { lang, setLang, t };
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside <LanguageProvider>");
  return ctx;
}