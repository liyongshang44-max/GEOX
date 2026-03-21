import React from "react";
import { Link } from "react-router-dom";
import { fetchProgramPortfolio, fetchSchedulingConflicts, fetchSchedulingHints, readStoredAoActToken, type ProgramPortfolioItemV1 } from "../lib/api";
import { resolveLocale, t, type Locale } from "../lib/i18n";

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
  const [items, setItems] = React.useState<ProgramPortfolioItemV1[]>([]);
  const [conflictsByProgram, setConflictsByProgram] = React.useState<Map<string, string[]>>(new Map());
  const [priorityByProgram, setPriorityByProgram] = React.useState<Map<string, string>>(new Map());
  const [loading, setLoading] = React.useState(false);
  const [seasonFilter, setSeasonFilter] = React.useState<string>("ALL");
  const allSeasonLabel = locale === "zh" ? "全部 Season" : "All Seasons";
  const refreshLabel = locale === "zh" ? "刷新" : "Refresh";

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

  React.useEffect(() => { void refresh(); }, [refresh]);

  const seasons = React.useMemo(() => Array.from(new Set(items.map((x) => String(x.season_id ?? "")).filter(Boolean))).sort(), [items]);
  const grouped = React.useMemo(() => {
    const bySeason = new Map<string, ProgramPortfolioItemV1[]>();
    for (const item of items) {
      const seasonId = String(item.season_id ?? "UNKNOWN");
      if (seasonFilter !== "ALL" && seasonId !== seasonFilter) continue;
      const list = bySeason.get(seasonId) ?? [];
      list.push(item);
      bySeason.set(seasonId, list);
    }
    return Array.from(bySeason.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [items, seasonFilter]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <section className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>{tf("portfolio.title")}</h2>
          <div className="muted">Program Portfolio for scheduling overview.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select className="select" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
          <select className="select" value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)}>
            <option value="ALL">{allSeasonLabel}</option>
            {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn" onClick={() => void refresh()} disabled={loading}>{refreshLabel}</button>
        </div>
      </section>

      {grouped.map(([seasonId, seasonItems]) => (
        <section key={seasonId} className="card" style={{ padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Season: {seasonId}（{seasonItems.length}）</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Program</th>
                <th align="left">Field</th>
                <th align="left">Crop</th>
                <th align="left">Status</th>
                <th align="left">Current Stage</th>
                <th align="left">Latest Acceptance</th>
                <th align="left">{tf("portfolio.executionReliability")}</th>
                <th align="left">{tf("portfolio.nextAction")}</th>
                <th align="left">{tf("portfolio.pendingPlan")}</th>
                <th align="left">{tf("portfolio.pendingTask")}</th>
                <th align="left">{tf("portfolio.conflicts")}</th>
                <th align="left">{tf("portfolio.priority")}</th>
              </tr>
            </thead>
            <tbody>
              {seasonItems.map((x) => (
                <tr key={String(x.program_id)} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td><Link to={`/programs/${encodeURIComponent(String(x.program_id))}`}>{String(x.program_id)}</Link></td>
                  <td>{String(x.field_id ?? "-")}</td>
                  <td>{String(x.crop_code ?? "-")}</td>
                  <td>{String(x.status ?? "-")}</td>
                  <td>{String(x.current_stage ?? "-")}</td>
                  <td>{String(x.latest_acceptance_result ?? "-")}</td>
                  <td>{String(x.execution_reliability ?? "-")}</td>
                  <td>{x.next_action_hint?.kind ? `${x.next_action_hint.kind}` : "-"}</td>
                  <td>{String(x.pending_operation_plan_id ?? "-")}</td>
                  <td>{String(x.pending_act_task_id ?? "-")}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(conflictsByProgram.get(String(x.program_id)) ?? []).map((k) => (
                        <span key={k} className="pill" style={{ background: "#fff4e5", color: "#b54708" }}>{conflictLabel(k, tf)}</span>
                      ))}
                      {(conflictsByProgram.get(String(x.program_id)) ?? []).length === 0 ? "-" : null}
                    </div>
                  </td>
                  <td>
                    {priorityByProgram.get(String(x.program_id)) ?? (x.next_action_hint?.priority || "-")}
                    {(priorityByProgram.get(String(x.program_id)) ?? "").toUpperCase() === "LOW" ? <span className="muted" style={{ marginLeft: 6 }}>({tf("portfolio.defer")})</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {!grouped.length ? <section className="card" style={{ padding: 12 }}><div className="muted">暂无 program。</div></section> : null}
    </div>
  );
}
