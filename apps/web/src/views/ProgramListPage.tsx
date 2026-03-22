import React from "react";
import { Link } from "react-router-dom";
import { fetchProgramPortfolio, fetchSchedulingConflicts, fetchSchedulingHints, readStoredAoActToken } from "../lib/api";
import { resolveLocale, t, type Locale } from "../lib/i18n";
import { buildProgramListCards, riskSortRank, type BadgeTone } from "../viewmodels/programDashboardViewModel";
import { badgeStyle } from "./badgeStyle";

function resolveDisplayText(value: string, tf: (k: string) => string): string {
  if (value.startsWith("program.") || value.startsWith("portfolio.") || value.startsWith("common.")) return tf(value);
  return value;
}

function conflictLabel(kind: string, tf: (k: string) => string): string {
  const k = String(kind ?? "").toUpperCase();
  if (k === "DEVICE_CONFLICT") return tf("portfolio.deviceConflict");
  if (k === "FIELD_CONFLICT") return tf("portfolio.fieldConflict");
  if (k === "PROGRAM_INTENT_CONFLICT") return tf("portfolio.intentConflict");
  return k || tf("common.none");
}

function metricBlockStyle(tone?: BadgeTone): React.CSSProperties {
  if (tone === "danger") return { border: "1px solid #fecaca", background: "#fff1f2" };
  if (tone === "warning") return { border: "1px solid #fde68a", background: "#fffbeb" };
  return { border: "1px solid #e5e7eb", background: "#f9fafb" };
}

export default function ProgramListPage(): React.ReactElement {
  const [token] = React.useState(() => readStoredAoActToken());
  const [locale, setLocale] = React.useState<Locale>(() => resolveLocale());
  const tf = React.useCallback((key: string) => t(locale, key), [locale]);
  const [items, setItems] = React.useState<any[]>([]);
  const [conflictsByProgram, setConflictsByProgram] = React.useState<Map<string, string[]>>(new Map());
  const [priorityByProgram, setPriorityByProgram] = React.useState<Map<string, string>>(new Map());
  const [loading, setLoading] = React.useState(false);
  const [seasonFilter, setSeasonFilter] = React.useState<string>("ALL");
  const [riskFilter, setRiskFilter] = React.useState<string>("ALL");
  const [sortBy, setSortBy] = React.useState<string>("risk");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [portfolio, conflicts, hints] = await Promise.all([
        fetchProgramPortfolio(token, { limit: 300 }),
        fetchSchedulingConflicts(token).catch(() => []),
        fetchSchedulingHints(token).catch(() => []),
      ]);
      setItems(portfolio);

      const nextConflicts = new Map<string, string[]>();
      for (const c of conflicts) {
        const related = Array.isArray(c?.related_program_ids) ? c.related_program_ids : [];
        for (const pid of related) {
          const key = String(pid ?? "");
          if (!key) continue;
          const list = nextConflicts.get(key) ?? [];
          list.push(String(c.kind ?? ""));
          nextConflicts.set(key, Array.from(new Set(list)));
        }
      }
      setConflictsByProgram(nextConflicts);

      const nextPriority = new Map<string, string>();
      for (const h of hints) {
        const pid = String(h?.program_id ?? "");
        if (!pid) continue;
        nextPriority.set(pid, String(h?.priority ?? "LOW").toUpperCase());
      }
      setPriorityByProgram(nextPriority);
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const seasons = React.useMemo(() => Array.from(new Set(items.map((x) => String(x.season_id ?? "")).filter(Boolean))).sort(), [items]);

  const cards = React.useMemo(() => buildProgramListCards({
    items,
    conflictsByProgram,
    priorityByProgram,
    insufficientText: tf("common.insufficientData"),
    noRecordText: tf("common.noRecord"),
  }), [items, conflictsByProgram, priorityByProgram, tf]);

  const filtered = React.useMemo(() => {
    let next = cards.filter((x) => (seasonFilter === "ALL" ? true : x.seasonId === seasonFilter));
    next = next.filter((x) => {
      if (riskFilter === "ALL") return true;
      if (riskFilter === "INSUFFICIENT_DATA") return x.sortRiskRank === 3;
      return x.sortRiskRank === riskSortRank(riskFilter);
    });

    if (sortBy === "risk") {
      next = [...next].sort((a, b) => a.sortRiskRank - b.sortRiskRank);
    } else if (sortBy === "priority") {
      next = [...next].sort((a, b) => a.sortPriorityRank - b.sortPriorityRank);
    } else if (sortBy === "cost") {
      next = [...next].sort((a, b) => {
        if (a.sortCostValue == null && b.sortCostValue == null) return 0;
        if (a.sortCostValue == null) return 1;
        if (b.sortCostValue == null) return -1;
        return b.sortCostValue - a.sortCostValue;
      });
    } else if (sortBy === "sla") {
      next = [...next].sort((a, b) => a.sortSlaRank - b.sortSlaRank);
    } else if (sortBy === "efficiency") {
      next = [...next].sort((a, b) => {
        if (a.sortEfficiencyValue == null && b.sortEfficiencyValue == null) return 0;
        if (a.sortEfficiencyValue == null) return 1;
        if (b.sortEfficiencyValue == null) return -1;
        return b.sortEfficiencyValue - a.sortEfficiencyValue;
      });
    }
    return next;
  }, [cards, seasonFilter, riskFilter, sortBy]);

  const summary = React.useMemo(() => {
    const activePrograms = filtered.length;
    const atRiskPrograms = filtered.filter((x) => x.sortRiskRank <= 1).length;
    const pendingActions = filtered.filter((x) => resolveDisplayText(x.primaryActionKey, tf) !== tf("common.insufficientData")).length;
    const lowEfficiencyOrInsufficient = filtered.filter((x) => x.sortEfficiencyValue == null || x.sortEfficiencyValue < 0.6).length;
    return { activePrograms, atRiskPrograms, pendingActions, lowEfficiencyOrInsufficient };
  }, [filtered, tf]);

  const grouped = React.useMemo(() => {
    const bySeason = new Map<string, typeof filtered>();
    for (const card of filtered) {
      const list = bySeason.get(card.seasonId) ?? [];
      list.push(card);
      bySeason.set(card.seasonId, list);
    }
    return Array.from(bySeason.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

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
                  <span className="pill" style={badgeStyle(card.riskBadge.tone)}>{resolveDisplayText(card.riskBadge.text, tf)}</span>
                </div>
              </div>

              <div>
                <div className="muted">{tf("portfolio.rowNextAction")}</div>
                <div style={{ fontWeight: 600 }}>{resolveDisplayText(card.primaryActionKey, tf)}</div>
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

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {card.metrics.map((metric) => (
                  <div key={metric.labelKey} style={{ borderRadius: 8, padding: 10, ...metricBlockStyle(metric.tone) }}>
                    <div className="muted">{tf(metric.labelKey)}</div>
                    <div style={{ fontWeight: 700 }}>{resolveDisplayText(metric.value, tf)}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {card.conflictTags.map((k) => (
                    <span key={k} className="pill" style={{ background: "#fff4e5", color: "#b54708" }}>{conflictLabel(k, tf)}</span>
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
