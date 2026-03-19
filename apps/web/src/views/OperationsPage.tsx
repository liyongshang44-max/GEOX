import React from "react";
import { fetchOperationStates, readStoredAoActToken, type OperationStateItemV1 } from "../lib/api";
import { resolveLocale, t, type Locale } from "../lib/i18n";

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
  return raw ? raw.toUpperCase() : t(locale, "common.unknown");
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
  const [items, setItems] = React.useState<OperationStateItemV1[]>([]);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  const [fieldFilter, setFieldFilter] = React.useState<string>("");
  const [deviceFilter, setDeviceFilter] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchOperationStates(token, {
        limit: 200,
        field_id: fieldFilter || undefined,
        device_id: deviceFilter || undefined,
        final_status: statusFilter || undefined,
      });
      const next = Array.isArray(res.items) ? res.items : [];
      setItems(next);
      setSelectedId((prev) => (prev && next.some((x) => x.operation_id === prev) ? prev : (next[0]?.operation_id ?? "")));
    } finally {
      setLoading(false);
    }
  }, [token, fieldFilter, deviceFilter, statusFilter]);

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
  const failedReason = statusOf(selected ?? ({} as any)) === "FAILED" ? String(selected?.receipt_status ?? "-") : "";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>{t(locale, "operation.title")}</h2>
          <div className="muted">{t(locale, "operation.desc")}</div>
        </div>
        <button className="btn" onClick={() => void refresh()} disabled={loading}>{t(locale, "operation.actions.refresh")}</button>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
        <div className="card" style={{ padding: 12 }}><div className="muted">{t(locale, "operation.kpi_today")}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{todayItems.length}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">{t(locale, "operation.kpi_success_rate")}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{successRate}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">{t(locale, "operation.kpi_failed")}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{failedCount}</div></div>
        <div className="card" style={{ padding: 12 }}><div className="muted">{t(locale, "operation.kpi_running")}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{runningCount}</div></div>
      </section>

      <section className="card" style={{ padding: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select className="select" value={fieldFilter} onChange={(e) => setFieldFilter(e.target.value)}>
          <option value="">{t(locale, "operation.filters.all_fields")}</option>
          {fieldOptions.map((v) => <option value={v} key={v}>{v}</option>)}
        </select>
        <select className="select" value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)}>
          <option value="">{t(locale, "operation.filters.all_devices")}</option>
          {deviceOptions.map((v) => <option value={v} key={v}>{v}</option>)}
        </select>
        <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{t(locale, "operation.filters.all_status")}</option>
          <option value="SUCCESS">{t(locale, "operation.status.SUCCESS")}</option>
          <option value="FAILED">{t(locale, "operation.status.FAILED")}</option>
          <option value="RUNNING">{t(locale, "operation.status.RUNNING")}</option>
          <option value="PENDING">{t(locale, "operation.status.PENDING")}</option>
        </select>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="card" style={{ padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>{t(locale, "operation.list")}</h3>
          <div style={{ display: "grid", gap: 8, maxHeight: 560, overflow: "auto" }}>
            {items.map((item) => {
              const status = statusOf(item);
              const color = statusColor(status);
              return (
                <button key={item.operation_id} className="btn" onClick={() => setSelectedId(item.operation_id)} style={{ textAlign: "left", borderColor: selectedId === item.operation_id ? "#111" : undefined }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: color, display: "inline-block" }} />
                    <span><b>{actionLabel(item.action_type, locale)}</b> · {item.field_id || t(locale, "common.none")}</span>
                  </div>
                  <div className="muted">{t(locale, "operation.labels.device")}：{item.device_id || t(locale, "common.none")}</div>
                  <div className="muted">{t(locale, "operation.labels.start")}：{fmtTs(item.timeline?.[0]?.ts ?? item.last_event_ts)}</div>
                  <div className="muted">{t(locale, "operation.filters.status")}：{t(locale, `operation.status.${status}`)}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>{t(locale, "operation.detail")}</h3>
          {selected ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div><b>{t(locale, "operation.labels.action")}：</b>{actionLabel(selected.action_type, locale)}</div>
              <div><b>{t(locale, "operation.labels.field")}：</b>{selected.field_id || t(locale, "common.none")}</div>
              <div><b>{t(locale, "operation.labels.device")}：</b>{selected.device_id || t(locale, "common.none")}</div>
              <div><b>{t(locale, "operation.filters.status")}：</b><span style={{ color: statusColor(statusOf(selected)) }}>{statusOf(selected) === "SUCCESS" ? "✅" : statusOf(selected) === "FAILED" ? "❌" : "⏳"} {t(locale, `operation.status.${statusOf(selected)}`)}</span></div>
              <div><b>{t(locale, "operation.labels.start")}：</b>{fmtTs(startTs)}</div>
              <div><b>{t(locale, "operation.labels.end")}：</b>{fmtTs(endTs)}</div>
              {failedReason ? <div><b>{t(locale, "operation.labels.failure_reason")}：</b>{failedReason}</div> : null}

              <div style={{ marginTop: 8, fontWeight: 700 }}>{t(locale, "operation.timeline.title")}</div>
              <div style={{ display: "grid", gap: 4 }}>
                {(selected.timeline ?? []).map((x, idx) => {
                  const v = timelineItemVisual(x.type);
                  return <div key={`${x.type}_${idx}`} style={{ color: v.color }}>{v.icon} {x.label}</div>;
                })}
                {!selected.timeline?.length ? <div className="muted">{t(locale, "operation.timeline.empty")}</div> : null}
              </div>
            </div>
          ) : <div className="muted">{t(locale, "operation.timeline.empty")}</div>}
        </div>
      </section>
    </div>
  );
}
