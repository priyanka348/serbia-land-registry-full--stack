import React from "react";
import { useNavigate } from "react-router-dom";
import "./StatCard.css";

export default function StatCard({
  to,
  title,
  bigValue,
  subline,
  trendText,
  trendType, // "up" | "down" | "warn" | "neutral"
  chipLeft,
  chipRight,
  ctaText,
  theme // "mint" | "lav" | "gold" | "rose"
}) {
  const navigate = useNavigate();

  const onCardClick = () => {
    if (to) navigate(to); // SPA navigation (same tab, same app)
  };

  return (
    <button className={`card ${theme || ""}`} onClick={onCardClick} type="button">
      <div className="cardTop">
        <div className="cardTitle">
          <span className="cardIcon">◉</span>
          <span>{title}</span>
        </div>

        {trendType === "warn" && <span className="pill danger">Action Required</span>}
      </div>

      <div className="cardBody">
        <div className="cardLeftArt" aria-hidden="true">
          <div className="artBox">
            <div className="artShape" />
            <div className="artCoin">$</div>
            <div className="artCoin small">$</div>
          </div>
        </div>

        <div className="cardMain">
          <div className="big">
            <span className="bigNum">{bigValue}</span>
          </div>

          {subline && <div className="sub">{subline}</div>}

          {trendText && (
            <div className={`trend ${trendType || "neutral"}`}>
              {trendType === "up" ? "▲" : trendType === "down" ? "▼" : trendType === "warn" ? "⚠" : "•"}{" "}
              {trendText}
            </div>
          )}

          {(chipLeft || chipRight) && (
            <div className="chips">
              {chipLeft && <div className="chip">{chipLeft}</div>}
              {chipRight && <div className="chip">{chipRight}</div>}
            </div>
          )}
        </div>

        <div className="cardCTA">
          <span className="ctaBtn">{ctaText || "View"}</span>
        </div>
      </div>
    </button>
  );
}
