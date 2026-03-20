import React from "react";
import { Link } from "react-router-dom";
import { fetchPrograms, readStoredAoActToken, type ProgramStateItemV1 } from "../lib/api";

export default function ProgramListPage(): React.ReactElement {
  const [token] = React.useState(() => readStoredAoActToken());
  const [items, setItems] = React.useState<ProgramStateItemV1[]>([]);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchPrograms(token, { limit: 200 }));
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <section className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>Program 列表</h2>
          <div className="muted">按经营对象查看 field / season / crop / status / stage / risk / pending plans。</div>
        </div>
        <button className="btn" onClick={() => void refresh()} disabled={loading}>刷新</button>
      </section>

      <section className="card" style={{ padding: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Program</th>
              <th align="left">Field</th>
              <th align="left">Season</th>
              <th align="left">Crop</th>
              <th align="left">Status</th>
              <th align="left">Current Stage</th>
              <th align="left">Latest Risk</th>
              <th align="left">Pending Plans</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={String(x.program_id)} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td><Link to={`/programs/${encodeURIComponent(String(x.program_id))}`}>{String(x.program_id)}</Link></td>
                <td>{String(x.field_id ?? "-")}</td>
                <td>{String(x.season_id ?? "-")}</td>
                <td>{String(x.crop_code ?? "-")}</td>
                <td>{String(x.status ?? "-")}</td>
                <td>{String(x.current_stage ?? "-")}</td>
                <td>{String(x.current_risk_summary?.level ?? "-")}</td>
                <td>{x.pending_operation_plan ? 1 : 0}</td>
              </tr>
            ))}
            {!items.length ? <tr><td colSpan={8} className="muted" style={{ padding: 12 }}>暂无 program。</td></tr> : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
