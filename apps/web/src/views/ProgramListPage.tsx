import React from "react";
import { Link } from "react-router-dom";
import { usePrograms } from "../hooks/usePrograms";
import type { Locale } from "../lib/i18n";
import { type BadgeTone } from "../viewmodels/programDashboardViewModel";
import { badgeStyle } from "./badgeStyle";

function metricBlockStyle(tone?: BadgeTone): React.CSSProperties {
  if (tone === "danger") return { border: "1px solid #fecaca", background: "#fff1f2" };
  if (tone === "warning") return { border: "1px solid #fde68a", background: "#fffbeb" };
  return { border: "1px solid #e5e7eb", background: "#f9fafb" };
}

export default function ProgramListPage(): React.ReactElement {
  const {
    locale,
    setLocale,
    seasonFilter,
    setSeasonFilter,
    riskFilter,
    setRiskFilter,
    sortBy,
    setSortBy,
    loading,
    refresh,
    tf,
    seasons,
    grouped,
    summary,
    resolveText,
    conflictText,
  } = usePrograms();

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <section className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>{tf("portfolio.title")}</h2>
          <div className="muted">{tf("portfolio.consoleDesc")}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className="select" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
          <select className="select" value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)}>
            <option value="ALL">{tf("portfolio.season")}</option>
            {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="select" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
            <option value="ALL">{tf("portfolio.riskLabel")}</option>
            <option value="HIGH">{tf("portfolio.riskHigh")}</option>
            <option value="MEDIUM">{tf("portfolio.riskMedium")}</option>
            <option value="LOW">{tf("portfolio.riskLow")}</option>
            <option value="INSUFFICIENT_DATA">{tf("portfolio.riskInsufficient")}</option>
          </select>
          <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="risk">{tf("portfolio.sortRisk")}</option>
            <option value="priority">{tf("portfolio.sortPriority")}</option>
            <option value="cost">{tf("portfolio.sortCost")}</option>
            <option value="sla">{tf("portfolio.sortSla")}</option>
            <option value="efficiency">{tf("portfolio.sortEfficiency")}</option>
          </select>
          <button className="btn" onClick={() => void refresh()} disabled={loading}>{tf("operation.actions.refresh")}</button>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        <div className="card" style={{ padding: 12 }}><div className="muted">{tf("portfolio.activePrograms")}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{summary.activePrograms}</div><div className="muted">{tf("portfolio.activeProgramsDesc")}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">{tf("portfolio.atRisk")}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{summary.atRiskPrograms}</div><div className="muted">{tf("portfolio.atRiskDesc")}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">{tf("portfolio.pendingActions")}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{summary.pendingActions}</div><div className="muted">{tf("portfolio.pendingActionsDesc")}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">{tf("portfolio.lowEfficiency")}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{summary.lowEfficiencyOrInsufficient}</div><div className="muted">{tf("portfolio.lowEfficiencyDesc")}</div></div>
      </section>

      {grouped.map(([seasonId, seasonCards]) => (
        <section key={seasonId} className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0 }}>{tf("portfolio.season")} {seasonId} ({seasonCards.length})</h3>
          {seasonCards.map((card) => (
            <article key={card.href} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{card.title}</div>
                  <div className="muted">{card.subtitleParts.field} · {card.subtitleParts.crop} · {card.subtitleParts.status}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span className="pill" style={badgeStyle(card.statusBadge.tone)}>{card.statusBadge.text}</span>
                  <span className="pill" style={badgeStyle(card.riskBadge.tone)}>{resolveText(card.riskBadge.text)}</span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div>
                  <div className="muted">{tf("portfolio.rowNextAction")}</div>
                  <div style={{ fontWeight: 700, color: "#101828" }}>{card.primaryActionText}</div>
                </div>
                <span className="pill" style={{ background: "#f2f4f7", color: "#344054" }}>{card.actionStatusTag}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                <div className="card" style={{ padding: 10 }}>
                  <div className="muted">{tf("portfolio.pendingPlan")}</div>
                  <div style={{ fontWeight: 600 }}>{card.pendingPlan}</div>
                </div>
                <div className="card" style={{ padding: 10 }}>
                  <div className="muted">{tf("portfolio.pendingTask")}</div>
                  <div style={{ fontWeight: 600 }}>{card.pendingTask}</div>
                </div>
              </div>


              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                <div className="card" style={{ padding: 10 }}>
                  <div className="muted">风险原因</div>
                  <div style={{ fontWeight: 600 }}>{resolveText(card.riskReason)}</div>
                </div>
                <div className="card" style={{ padding: 10 }}>
                  <div className="muted">最近更新时间</div>
                  <div style={{ fontWeight: 600 }}>{card.updatedAtText}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {card.metrics.map((metric) => (
                  <div key={metric.labelKey} style={{ borderRadius: 8, padding: 10, ...metricBlockStyle(metric.tone) }}>
                    <div className="muted">{tf(metric.labelKey)}</div>
                    <div style={{ fontWeight: 700 }}>{resolveText(metric.value)}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {card.conflictTags.map((k) => (
                    <span key={k} className="pill" style={{ background: "#fff4e5", color: "#b54708" }}>{conflictText(k)}</span>
                  ))}
                  {card.conflictTags.length === 0 ? <span className="muted">{tf("common.noRecord")}</span> : null}
                </div>
                <Link className="btn" to={card.href}>{tf("portfolio.viewDetail")}</Link>
              </div>
            </article>
          ))}
        </section>
      ))}

      {!grouped.length ? <section className="card" style={{ padding: 12 }}><div className="muted">{tf("common.noRecord")}</div></section> : null}
    </div>
  );
}
