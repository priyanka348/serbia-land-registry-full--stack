import React, { useState } from "react";
import "./SignUp.css";
import { useLang } from "../../context/LanguageContext";

import { useNavigate } from "react-router-dom";

export default function SignUp() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const onSubmit = (e) => {
    e.preventDefault();
    // Later: call Node/Express API here
    alert(`Sign Up: ${name} (${email})`);
    navigate("/auth/signin");
  };

  return (
    <div className="authWrap">
      <form className="authCard" onSubmit={onSubmit}>
        <h2 className="authTitle">{t("signUp")}</h2>

        <label className="authLabel">Full Name</label>
        <input className="authInput" value={name} onChange={(e) => setName(e.target.value)} />

        <label className="authLabel">Email</label>
        <input className="authInput" value={email} onChange={(e) => setEmail(e.target.value)} />

        <button className="authBtn" type="submit">
          {t("signUp")}
        </button>
      </form>
    </div>
  );
}
