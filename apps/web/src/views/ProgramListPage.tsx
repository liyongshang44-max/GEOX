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
            {seasons.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
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

      {grouped.map(([seasonId, seasonRows]) => (
        <section key={seasonId} className="card" style={{ padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>{tf("portfolio.combinedView")} · {seasonId}（{seasonRows.length}）</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Program</th>
                <th align="left">Field</th>
                <th align="left">Crop</th>
                <th align="left">Status</th>
                <th align="left">{tf("portfolio.risk")}</th>
                <th align="left">{tf("portfolio.nextAction")}</th>
                <th align="left">{tf("portfolio.pendingPlan")}</th>
                <th align="left">{tf("portfolio.pendingTask")}</th>
                <th align="left">{tf("portfolio.cost")}</th>
                <th align="left">{tf("portfolio.sla")}</th>
                <th align="left">{tf("portfolio.efficiency")}</th>
                <th align="left">{tf("portfolio.conflicts")}</th>
              </tr>
            </thead>
            <tbody>
              {seasonRows.map((x) => (
                <tr key={x.programId} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td><Link to={`/programs/${encodeURIComponent(x.programId)}`}>{x.programId || tf("common.noRecord")}</Link></td>
                  <td>{x.fieldId}</td>
                  <td>{x.cropCode}</td>
                  <td>{x.status}</td>
                  <td>{x.risk}</td>
                  <td>{x.nextAction}</td>
                  <td>{x.pendingPlan}</td>
                  <td>{x.pendingTask}</td>
                  <td>{x.costSummary}</td>
                  <td>{x.slaSummary}</td>
                  <td>{x.efficiencySummary}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {x.conflictKinds.map((k) => (
                        <span key={k} className="pill" style={{ background: "#fff4e5", color: "#b54708" }}>{conflictLabel(k, tf)}</span>
                      ))}
                      {x.conflictKinds.length === 0 ? tf("common.noRecord") : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {!grouped.length ? <section className="card" style={{ padding: 12 }}><div className="muted">{tf("common.noRecord")}</div></section> : null}
    </div>
  );
}
