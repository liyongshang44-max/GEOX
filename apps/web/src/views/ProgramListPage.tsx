import React from "react";
import { Link } from "react-router-dom";
import { fetchProgramPortfolio, fetchSchedulingConflicts, fetchSchedulingHints, readStoredAoActToken } from "../lib/api";
import { resolveLocale, t, type Locale } from "../lib/i18n";
import { buildProgramListRows } from "../viewmodels/programDashboardViewModel";

function conflictLabel(kind: string, tf: (k: string) => string): string {
  const k = String(kind ?? "").toUpperCase();
  if (k === "DEVICE_CONFLICT") return tf("portfolio.deviceConflict");
  if (k === "FIELD_CONFLICT") return tf("portfolio.fieldConflict");
  if (k === "PROGRAM_INTENT_CONFLICT") return tf("portfolio.intentConflict");
  return k || tf("common.none");
}

function priorityWeight(v: string): number {
  const s = String(v ?? "").toUpperCase();
  if (s === "HIGH") return 3;
  if (s === "MEDIUM") return 2;
  return 1;
}

function isAtRisk(risk: string): boolean {
  const r = String(risk ?? "").toUpperCase();
  return r === "HIGH" || r === "MEDIUM";
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
  const [sortBy, setSortBy] = React.useState<string>("risk_desc");

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
        const prev = nextPriority.get(pid);
        const incoming = String(h?.priority ?? "LOW").toUpperCase();
        if (!prev || priorityWeight(incoming) > priorityWeight(prev)) nextPriority.set(pid, incoming);
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

  const rows = React.useMemo(
    () => buildProgramListRows({ items, conflictsByProgram, priorityByProgram }),
    [items, conflictsByProgram, priorityByProgram],
  );

  const filteredRows = React.useMemo(() => {
    let next = rows.filter((x) => (seasonFilter === "ALL" ? true : x.seasonId === seasonFilter));
    next = next.filter((x) => (riskFilter === "ALL" ? true : x.risk.toUpperCase() === riskFilter));
    if (sortBy === "risk_desc") next = [...next].sort((a, b) => b.risk.localeCompare(a.risk));
    if (sortBy === "cost_desc") next = [...next].sort((a, b) => b.costSummary.localeCompare(a.costSummary));
    if (sortBy === "sla_desc") next = [...next].sort((a, b) => b.slaSummary.localeCompare(a.slaSummary));
    return next;
  }, [rows, seasonFilter, riskFilter, sortBy]);

  const summary = React.useMemo(() => {
    const activePrograms = filteredRows.length;
    const atRiskPrograms = filteredRows.filter((x) => isAtRisk(x.risk)).length;
    const pendingActions = filteredRows.filter((x) => x.nextAction !== tf("common.insufficientData")).length;
    const lowEfficiencyOrInsufficient = filteredRows.filter((x) => {
      if (x.efficiencySummary === tf("common.insufficientData")) return true;
      const score = Number(x.efficiencySummary);
      return Number.isFinite(score) && score < 0.6;
    }).length;
    return { activePrograms, atRiskPrograms, pendingActions, lowEfficiencyOrInsufficient };
  }, [filteredRows, tf]);

  const grouped = React.useMemo(() => {
    const bySeason = new Map<string, typeof filteredRows>();
    for (const row of filteredRows) {
      const list = bySeason.get(row.seasonId) ?? [];
      list.push(row);
      bySeason.set(row.seasonId, list);
    }
    return Array.from(bySeason.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredRows]);

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
            <option value="ALL">{tf("portfolio.allSeasons")}</option>
            {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="select" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
            <option value="ALL">{tf("portfolio.allRisk")}</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
          <select className="select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="risk_desc">{tf("portfolio.sortRisk")}</option>
            <option value="cost_desc">{tf("portfolio.sortCost")}</option>
            <option value="sla_desc">{tf("portfolio.sortSla")}</option>
          </select>
          <button className="btn" onClick={() => void refresh()} disabled={loading}>{tf("operation.actions.refresh")}</button>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        <div className="card" style={{ padding: 12 }}><div className="muted">{tf("portfolio.activePrograms")}</div><div style={{ fontSize: 24, fontWeight: 600 }}>{summary.activePrograms}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">{tf("portfolio.atRisk")}</div><div style={{ fontSize: 24, fontWeight: 600 }}>{summary.atRiskPrograms}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">{tf("portfolio.pendingActions")}</div><div style={{ fontSize: 24, fontWeight: 600 }}>{summary.pendingActions}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">{tf("portfolio.lowEfficiency")}</div><div style={{ fontSize: 24, fontWeight: 600 }}>{summary.lowEfficiencyOrInsufficient}</div></div>
      </section>

      {grouped.map(([seasonId, seasonRows]) => (
        <section key={seasonId} className="card" style={{ padding: 12, display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0 }}>{tf("portfolio.combinedView")} · {seasonId}（{seasonRows.length}）</h3>
          {seasonRows.map((x) => (
            <article key={x.programId} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 600 }}>{x.programId || tf("common.noRecord")}</div>
                <span className="pill" style={{ background: "#fff4e5", color: "#b54708" }}>{tf("portfolio.risk")}: {x.risk}</span>
              </div>
              <div className="muted">{tf("portfolio.rowFieldCropStatus")}: {x.fieldId} / {x.cropCode} / {x.status}</div>
              <div>{tf("portfolio.rowNextAction")}: {x.nextAction}</div>
              <div>{tf("portfolio.rowPending")}: {x.pendingPlan} / {x.pendingTask}</div>
              <div>{tf("portfolio.rowCostSlaEfficiency")}: {x.costSummary} / {x.slaSummary} / {x.efficiencySummary}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {x.conflictKinds.map((k) => (
                    <span key={k} className="pill" style={{ background: "#fff4e5", color: "#b54708" }}>{conflictLabel(k, tf)}</span>
                  ))}
                  {x.conflictKinds.length === 0 ? <span className="muted">{tf("common.noRecord")}</span> : null}
                </div>
                <Link className="btn" to={`/programs/${encodeURIComponent(x.programId)}`}>{tf("portfolio.viewDetail")}</Link>
              </div>
            </article>
          ))}
        </section>
      ))}

      {!grouped.length ? <section className="card" style={{ padding: 12 }}><div className="muted">{tf("common.noRecord")}</div></section> : null}
    </div>
  );
}
