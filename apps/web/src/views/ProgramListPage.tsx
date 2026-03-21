import React from "react";
import { Link } from "react-router-dom";
import { fetchProgramPortfolio, readStoredAoActToken, type ProgramPortfolioItemV1 } from "../lib/api";

export default function ProgramListPage(): React.ReactElement {
  const [token] = React.useState(() => readStoredAoActToken());
  const [items, setItems] = React.useState<ProgramPortfolioItemV1[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [seasonFilter, setSeasonFilter] = React.useState<string>("ALL");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchProgramPortfolio(token, { limit: 300 }));
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
          <h2 style={{ margin: 0 }}>Program 列表</h2>
          <div className="muted">Program Portfolio（按 season 分组），支持跨 season 经营组合查看。</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select className="select" value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)}>
            <option value="ALL">全部 Season</option>
            {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn" onClick={() => void refresh()} disabled={loading}>刷新</button>
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
                <th align="left">Execution</th>
                <th align="left">Water</th>
                <th align="left">Pending</th>
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
                  <td>{String(x.execution_reliability ?? "-")}</td>
                  <td>{String(x.water_management ?? "-")}</td>
                  <td>{x.pending_operation_plan_id ? 1 : 0}</td>
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
