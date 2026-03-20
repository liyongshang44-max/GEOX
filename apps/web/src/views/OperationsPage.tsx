import React from "react";
import { fetchOperationStates, fetchPrograms, readStoredAoActToken, type OperationStateItemV1 } from "../lib/api";
import { mapStatusToText, resolveLocale, t, type Locale } from "../lib/i18n";

type StatusKey = "SUCCESS" | "FAILED" | "RUNNING" | "PENDING";

function fmtTs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  return new Date(ms).toLocaleTimeString();
}

function statusOf(item: OperationStateItemV1): StatusKey {
  const s = String(item.final_status ?? "").toUpperCase();
  if (s === "SUCCESS") return "SUCCESS";
  if (s === "FAILED") return "FAILED";
  if (s === "RUNNING") return "RUNNING";
  return "PENDING";
}

function statusColor(status: StatusKey): string {
  if (status === "SUCCESS") return "#16a34a";
  if (status === "FAILED") return "#dc2626";
  if (status === "RUNNING") return "#2563eb";
  return "#6b7280";
}

function actionLabel(value: string | null | undefined, locale: Locale): string {
  const raw = String(value ?? "").toLowerCase();
  if (raw.includes("irrig")) return locale === "zh" ? "灌溉" : "Irrigation";
  if (raw.includes("spray")) return locale === "zh" ? "喷洒" : "Spray";
  if (raw.includes("seed")) return locale === "zh" ? "播种" : "Seeding";
  return locale === "zh" ? "作业" : (raw ? raw.toUpperCase() : t(locale, "common.unknown"));
}

function timelineItemVisual(type: string): { icon: string; color: string } {
  if (type === "RECOMMENDATION_CREATED") return { icon: "🧠", color: "#6b7280" };
  if (type === "APPROVED") return { icon: "✅", color: "#16a34a" };
  if (type === "TASK_DISPATCHED") return { icon: "📤", color: "#2563eb" };
  if (type === "EXECUTING" || type === "DEVICE_ACK") return { icon: "⚙️", color: "#2563eb" };
  if (type === "SUCCEEDED") return { icon: "✅", color: "#16a34a" };
  if (type === "FAILED") return { icon: "❌", color: "#dc2626" };
  return { icon: "•", color: "#6b7280" };
}

export default function OperationsPage(): React.ReactElement {
  const [token] = React.useState<string>(() => readStoredAoActToken());
  const [locale] = React.useState<Locale>(() => resolveLocale());
  const tt = React.useCallback((key: string) => t(locale, key), [locale]);
  const [items, setItems] = React.useState<OperationStateItemV1[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  const [fieldFilter, setFieldFilter] = React.useState<string>("");
  const [deviceFilter, setDeviceFilter] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [programFilter, setProgramFilter] = React.useState<string>("");
  const [programIds, setProgramIds] = React.useState<string[]>([]);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [res, programs] = await Promise.all([
        fetchOperationStates(token, {
          limit: 200,
          field_id: fieldFilter || undefined,
          device_id: deviceFilter || undefined,
          final_status: statusFilter || undefined,
        }),
        fetchPrograms(token, { limit: 200 }),
      ]);
      let next = Array.isArray(res.items) ? res.items : [];
      if (programFilter) next = next.filter((x) => String(x.program_id ?? "") === programFilter);
      setProgramIds(Array.from(new Set((programs ?? []).map((p: any) => String(p.program_id ?? "")).filter(Boolean))));
      setItems(next);
      setSelectedId((prev) => (prev && next.some((x) => x.operation_id === prev) ? prev : (next[0]?.operation_id ?? "")));
    } finally {
      setLoading(false);
    }
  }, [token, fieldFilter, deviceFilter, statusFilter, programFilter]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const selected = React.useMemo(() => items.find((x) => x.operation_id === selectedId) ?? null, [items, selectedId]);

  const fieldOptions = React.useMemo(() => Array.from(new Set(items.map((x) => String(x.field_id ?? "")).filter(Boolean))), [items]);
  const deviceOptions = React.useMemo(() => Array.from(new Set(items.map((x) => String(x.device_id ?? "")).filter(Boolean))), [items]);

  const todayKey = new Date().toDateString();
  const todayItems = items.filter((x) => new Date(x.last_event_ts).toDateString() === todayKey);
  const successCount = todayItems.filter((x) => statusOf(x) === "SUCCESS").length;
  const failedCount = todayItems.filter((x) => statusOf(x) === "FAILED").length;
  const runningCount = todayItems.filter((x) => statusOf(x) === "RUNNING").length;
  const successRate = todayItems.length ? `${Math.round((successCount / todayItems.length) * 100)}%` : "0%";

  const startTs = selected?.timeline?.[0]?.ts ?? selected?.last_event_ts ?? 0;
  const endTs = selected?.timeline?.[selected.timeline.length - 1]?.ts ?? selected?.last_event_ts ?? 0;
  const failedReason = statusOf(selected ?? ({} as any)) === "FAILED" ? String(selected?.receipt_status ?? tt("common.none")) : "";
  const durationSec = Math.max(0, Math.round((endTs - startTs) / 1000));
  const durationText = `${Math.floor(durationSec / 60)}分${durationSec % 60}秒`;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>{tt("operation.title")}</h2>
          <div className="muted">{tt("operation.desc")}</div>
        </div>
        <button className="btn" onClick={() => void refresh()} disabled={loading}>{tt("operation.actions.refresh")}</button>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
        <div className="card" style={{ padding: 12 }}><div className="muted">{tt("operation.kpi_today")}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{todayItems.length}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">{tt("operation.kpi_success_rate")}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{successRate}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">{tt("operation.kpi_running")}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{runningCount}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">{tt("operation.kpi_failed")}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{failedCount}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">Program 聚合</div><div style={{ fontSize: 24, fontWeight: 700 }}>{new Set(items.map((x) => String(x.program_id ?? "")).filter(Boolean)).size}</div></div>
      </section>

      <section className="card" style={{ padding: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select className="select" value={fieldFilter} onChange={(e) => setFieldFilter(e.target.value)}>
          <option value="">{tt("operation.filters.all_fields")}</option>
          {fieldOptions.map((v) => <option value={v} key={v}>{v}</option>)}
        </select>
        <select className="select" value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)}>
          <option value="">{tt("operation.filters.all_devices")}</option>
          {deviceOptions.map((v) => <option value={v} key={v}>{v}</option>)}
        </select>
        <select className="select" value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
          <option value="">全部 Program</option>
          {programIds.map((v) => <option value={v} key={v}>{v}</option>)}
        </select>
        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{tt("operation.filters.all_status")}</option>
          <option value="SUCCESS">{mapStatusToText("SUCCESS", tt)}</option>
          <option value="FAILED">{mapStatusToText("FAILED", tt)}</option>
          <option value="RUNNING">{mapStatusToText("RUNNING", tt)}</option>
          <option value="PENDING">{mapStatusToText("PENDING", tt)}</option>
        </select>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="card" style={{ padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>{tt("operation.list")}</h3>
          <div style={{ display: "grid", gap: 8, maxHeight: 560, overflow: "auto" }}>
            {items.map((item) => {
              const status = statusOf(item);
              const color = statusColor(status);
              return (
                <button key={item.operation_id} className="btn" onClick={() => setSelectedId(item.operation_id)} style={{ textAlign: "left", borderColor: selectedId === item.operation_id ? "#111" : undefined }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: color, display: "inline-block" }} />
                    <span><b>{actionLabel(item.action_type, locale)}</b> · {item.field_id || tt("common.none")}</span>
                  </div>
                  <div className="muted">{tt("operation.labels.device")}：{item.device_id || tt("common.none")} · {fmtTs(item.timeline?.[0]?.ts ?? item.last_event_ts)}</div>
                  <div className="muted">{tt("operation.filters.status")}：{mapStatusToText(status, tt)}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>{tt("operation.detail")}</h3>
          {selected ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div><b>{tt("operation.labels.action")}：</b>{actionLabel(selected.action_type, locale)}</div>
              <div><b>{tt("operation.labels.field")}：</b>{selected.field_id || tt("common.none")}</div>
              <div><b>{tt("operation.labels.device")}：</b>{selected.device_id || tt("common.none")}</div>
              <div><b>{tt("operation.filters.status")}：</b><span style={{ color: statusColor(statusOf(selected)) }}>{statusOf(selected) === "SUCCESS" ? "✅" : statusOf(selected) === "FAILED" ? "❌" : "⏳"} {mapStatusToText(statusOf(selected), tt)}</span></div>
              <div><b>{tt("operation.labels.duration")}：</b>{durationText}</div>

              <details>
                <summary className="muted">{tt("common.ids")}</summary>
                <div className="mono" style={{ fontSize: 12 }}>
                  <div>operation_id: {selected.operation_id}</div>
                  <div>recommendation_id: {selected.recommendation_id || tt("common.none")}</div>
                  <div>task_id: {selected.task_id || tt("common.none")}</div>
                </div>
              </details>

              {failedReason ? <div><b>{tt("operation.labels.failure_reason")}：</b>{failedReason}</div> : null}

              <div style={{ marginTop: 8, fontWeight: 700 }}>{tt("operation.timeline")}</div>
              <ul style={{ display: "grid", gap: 4, margin: 0, paddingLeft: 16 }}>
                {(selected.timeline ?? []).map((x, idx) => {
                  const v = timelineItemVisual(x.type);
                  return <li key={`${x.type}_${idx}`} style={{ color: v.color, display: "flex", justifyContent: "space-between" }}><span>{v.icon} {tt(`operation.timelineLabel.${x.type}`)}</span><span className="muted">{fmtTs(x.ts)}</span></li>;
                })}
                {!selected.timeline?.length ? <li className="muted">{tt("common.none")}</li> : null}
              </ul>
            </div>
          ) : <div className="muted">{tt("common.none")}</div>}
        </div>
      </section>
    </div>
  );
}
