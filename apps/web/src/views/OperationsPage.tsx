import React from "react";
import { fetchOperationStates, readStoredAoActToken, type OperationStateItemV1 } from "../lib/api";

function fmtTs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  return new Date(ms).toLocaleString();
}

export default function OperationsPage(): React.ReactElement {
  const [token] = React.useState<string>(() => readStoredAoActToken());
  const [items, setItems] = React.useState<OperationStateItemV1[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState("");

  const selected = React.useMemo(() => items.find((x) => x.operation_id === selectedId) ?? items[0] ?? null, [items, selectedId]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchOperationStates(token, { limit: 120 });
      setItems(Array.isArray(res.items) ? res.items : []);
      setSelectedId((prev) => prev || (res.items?.[0]?.operation_id ?? ""));
      setStatus(`Loaded ${res.count} operations`);
    } catch (e: any) {
      setStatus(e?.bodyText || e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>Operations</h2>
          <div className="muted">Unified operation state from recommendation to execution.</div>
        </div>
        <button className="btn" onClick={() => void refresh()} disabled={loading}>Refresh</button>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="card" style={{ padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Operation List</h3>
          <div style={{ display: "grid", gap: 8, maxHeight: 540, overflow: "auto" }}>
            {items.map((item) => (
              <button
                key={item.operation_id}
                className="btn"
                style={{ textAlign: "left", borderColor: selected?.operation_id === item.operation_id ? "#111" : undefined }}
                onClick={() => setSelectedId(item.operation_id)}
              >
                <div><b>{item.operation_id}</b></div>
                <div className="muted">{item.field_id || "-"} · {item.device_id || "-"}</div>
                <div className="muted">{item.final_status} · {fmtTs(item.last_event_ts)}</div>
              </button>
            ))}
            {!items.length ? <div className="muted">No operations.</div> : null}
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Operation Detail</h3>
          {selected ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div><b>operation_id:</b> <span className="mono">{selected.operation_id}</span></div>
              <div><b>recommendation_id:</b> <span className="mono">{selected.recommendation_id || "-"}</span></div>
              <div><b>approval_request_id:</b> <span className="mono">{selected.approval_request_id || "-"}</span></div>
              <div><b>task_id:</b> <span className="mono">{selected.task_id || "-"}</span></div>
              <div><b>dispatch:</b> {selected.dispatch_status} | <b>receipt:</b> {selected.receipt_status} | <b>final:</b> {selected.final_status}</div>
              <div style={{ marginTop: 8 }}><b>Timeline</b></div>
              <div style={{ display: "grid", gap: 4 }}>
                {selected.timeline.map((t, idx) => (
                  <div key={`${t.event}_${idx}`} className="muted">[{t.label}] {new Date(t.ts).toLocaleString()}</div>
                ))}
                {!selected.timeline.length ? <div className="muted">-</div> : null}
              </div>
            </div>
          ) : <div className="muted">Select an operation.</div>}
        </div>
      </section>

      <section className="card" style={{ padding: 12 }}>
        <div className="muted">{status || "-"}</div>
      </section>
    </div>
  );
}
