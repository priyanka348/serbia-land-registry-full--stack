import React, { useState } from "react";
import "./SignIn.css";
import { useLang } from "../../context/LanguageContext";

import { useNavigate } from "react-router-dom";

export default function SignIn() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = (e) => {
    e.preventDefault();
    // Later: call Node/Express API here
    alert(`Sign In: ${email}`);
    navigate("/overview");
  };

  return (
    <div className="authWrap">
      <form className="authCard" onSubmit={onSubmit}>
        <h2 className="authTitle">{t("signIn")}</h2>

        <label className="authLabel">Email</label>
        <input className="authInput" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label className="authLabel">Password</label>
        <input
          className="authInput"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="authBtn" type="submit">
          {t("signIn")}
        </button>
      </form>
    </div>
  );
}
