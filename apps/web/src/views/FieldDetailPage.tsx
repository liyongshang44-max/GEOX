import React from "react";
import { Link, useParams } from "react-router-dom";
import FieldGisMap from "../components/FieldGisMap";
import { fetchAgronomyRecommendations, fetchFieldCurrentProgram, fetchFieldDetail, fetchFieldGeometry, fetchOperationStates, type AgronomyRecommendationItemV1, type OperationStateItemV1 } from "../lib/api";
import FieldSummaryCards from "../components/field/FieldSummaryCards";
import FieldOperationList from "../components/field/FieldOperationList";
import FieldAlertList from "../components/field/FieldAlertList";
import FieldLegend from "../components/field/FieldLegend";
import FieldSeasonPanel from "../components/field/FieldSeasonPanel";
import { FIELD_TEXT, formatRiskStatus, getRiskColor, mapAlertTypeToLabel, mapFieldStatusToLabel, mapOperationTypeToLabel, mapSourceFieldToLabel, riskKey, shortId, type FieldLang } from "../lib/fieldViewModel";
import { mapStatusToText, t } from "../lib/i18n";

function fmtTs(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms)) return "-";
  return new Date(ms).toLocaleString();
}
function fmtIso(ts: string | null | undefined): string {
  if (!ts) return "-";
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? new Date(ms).toLocaleString() : ts;
}

type FieldTab = "overview" | "map" | "operations" | "alerts";
type ExecutionStatus = "READY" | "DISPATCHED" | "SUCCEEDED" | "FAILED";

function executionColor(status: ExecutionStatus): string {
  if (status === "READY") return "#2563eb";
  if (status === "DISPATCHED") return "#f79009";
  if (status === "SUCCEEDED") return "#12b76a";
  return "#f04438";
}

export default function FieldDetailPage(): React.ReactElement {
  const params = useParams();
  const fieldId = decodeURIComponent(params.fieldId || "");
  const focusTaskId = React.useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("focusTask") || "";
  }, []);
  const [token, setToken] = React.useState<string>(() => localStorage.getItem("geox_ao_act_token") || "");
  const [detail, setDetail] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<FieldTab>("overview");
  const [lang, setLang] = React.useState<FieldLang>(() => (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en"));
  const [selectedObject, setSelectedObject] = React.useState<any>(null);
  const [activeOperations, setActiveOperations] = React.useState<OperationStateItemV1[]>([]);
  const [recentRecommendations, setRecentRecommendations] = React.useState<AgronomyRecommendationItemV1[]>([]);
  const [timelineIndex, setTimelineIndex] = React.useState<number>(0);
  const [playing, setPlaying] = React.useState<boolean>(false);
  const [currentProgram, setCurrentProgram] = React.useState<any>(null);
  const [showTrajectoryLayer, setShowTrajectoryLayer] = React.useState(true);
  const [showAlertLayer, setShowAlertLayer] = React.useState(true);
  const [showAcceptanceLayer, setShowAcceptanceLayer] = React.useState(true);

  const labels = FIELD_TEXT[lang];
  const tt = (key: string) => t(lang, key);
  const isDev = Boolean(import.meta.env.DEV);

  const persistToken = (v: string) => {
    setToken(v);
    localStorage.setItem("geox_ao_act_token", v);
  };

  const refresh = React.useCallback(async () => {
    if (!fieldId || !token) return;
    setBusy(true);
    setStatus(lang === "zh" ? "加载中..." : "Loading...");
    try {
      const [next, ops, recs, prg] = await Promise.all([
        fetchFieldDetail(token, fieldId),
        fetchOperationStates(token, { field_id: fieldId, limit: 20 }),
        fetchAgronomyRecommendations({ limit: 30, token }),
        fetchFieldCurrentProgram(token, fieldId).catch(() => null),
      ]);
      const geometryRes = await fetchFieldGeometry(token, fieldId).catch(() => null);
      const stableGeometry = geometryRes?.geometry ?? next?.geometry ?? null;
      setDetail({ ...next, geometry: stableGeometry });
      setActiveOperations((ops.items ?? []).filter((x) => !["SUCCESS", "FAILED"].includes(String(x.final_status))));
      setRecentRecommendations((recs.items ?? []).filter((x) => String(x.field_id ?? "") === fieldId).slice(0, 8));
      setCurrentProgram(prg);
      setStatus(lang === "zh" ? "加载成功" : "Loaded");
    } catch (e: any) {
      setStatus(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [fieldId, token, lang]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const operationItems = React.useMemo(() => {
    const list = Array.isArray(detail?.map_layers?.job_history) ? detail.map_layers.job_history : [];
    return list.map((item: any) => {
      const sourceRaw = String(item?.timing_source ?? "");
      const source = mapSourceFieldToLabel(sourceRaw, lang);
      const statusLabel = sourceRaw.includes("receipt") ? labels.opCompleted : labels.opPlanned;
      const window = item.trajectory_window_start_ts_ms
        ? `${fmtTs(item.trajectory_window_start_ts_ms)} ~ ${fmtTs(item.trajectory_window_end_ts_ms)}`
        : "-";
      return {
        id: String(item.id ?? `${item.task_type}_${item.ts_ms || 0}`),
        actTaskId: String(item.act_task_id ?? ""),
        type: mapOperationTypeToLabel(item.task_type, lang),
        time: fmtTs(item.ts_ms),
        timeMs: Number(item.ts_ms ?? 0),
        source,
        status: statusLabel,
        device: item.device_id || "-",
        window,
        raw: item,
      };
    });
  }, [detail, labels, lang]);

  const alertItems = React.useMemo(() => {
    const list = Array.isArray(detail?.recent_alerts) ? detail.recent_alerts : [];
    return list.map((event: any) => {
      const s = String(event.status ?? "").toUpperCase();
      const statusLabel = s === "OPEN" ? labels.alertOpen : s === "ACKED" ? labels.alertAck : s === "CLOSED" ? labels.alertClosed : labels.unknown;
      return {
        id: String(event.event_id ?? `${event.metric}_${event.raised_ts_ms || 0}`),
        type: mapAlertTypeToLabel(event.metric, lang),
        status: statusLabel,
        target: event.object_id || "-",
        time: fmtIso(event.raised_at) !== "-" ? fmtIso(event.raised_at) : fmtTs(event.raised_ts_ms),
        timeMs: Number(event.raised_ts_ms ?? Date.parse(event.raised_at ?? "") ?? 0),
        suggestion: event.suggested_action || event.suggestion || null,
        severity: event.severity || null,
        raw: event,
      };
    });
  }, [detail, labels, lang]);

  const timelineEvents = React.useMemo(() => {
    const telemetryEvents = (detail?.map_layers?.markers || []).map((m: any) => ({
      ts: Number(m.ts_ms ?? 0),
      type: "telemetry",
      label: `${labels.devicePosition} ${m.device_id}`,
    }));
    const receiptEvents = (detail?.recent_receipts || []).map((r: any) => ({
      ts: Number(Date.parse(String(r.occurred_at ?? ""))) || 0,
      type: "receipt",
      label: `${labels.source}: ${labels.alerts}`,
    }));
    const transitionEvents = operationItems.map((op) => ({
      ts: Number(op.timeMs || 0),
      type: "plan_transition",
      label: `${labels.operations}: ${op.type}`,
    }));
    return [...telemetryEvents, ...receiptEvents, ...transitionEvents]
      .filter((x) => Number.isFinite(x.ts) && x.ts > 0)
      .sort((a, b) => a.ts - b.ts);
  }, [detail, operationItems, labels]);

  React.useEffect(() => {
    if (!playing || timelineEvents.length < 2) return;
    const timer = window.setInterval(() => {
      setTimelineIndex((prev) => (prev + 1 < timelineEvents.length ? prev + 1 : prev));
    }, 900);
    return () => window.clearInterval(timer);
  }, [playing, timelineEvents.length]);

  React.useEffect(() => {
    if (timelineIndex >= timelineEvents.length) setTimelineIndex(Math.max(0, timelineEvents.length - 1));
  }, [timelineEvents.length, timelineIndex]);

  React.useEffect(() => {
    if (!focusTaskId || !operationItems.length) return;
    const target = operationItems.find((item) => String(item.actTaskId) === focusTaskId);
    if (!target) return;
    setActiveTab("map");
    setSelectedObject({ kind: labels.operations, name: target.type, time: target.time, status: target.status, id: target.id });
  }, [focusTaskId, operationItems, labels.operations]);

  const playbackTs = timelineEvents[timelineIndex]?.ts ?? Number.MAX_SAFE_INTEGER;

  const trajectorySegments = React.useMemo(() => {
    const trajectories = Array.isArray(detail?.map_layers?.trajectories) ? detail.map_layers.trajectories : [];
    const receiptByTask = new Map<string, any>();
    for (const receipt of detail?.recent_receipts || []) {
      const actTaskId = String(receipt?.receipt?.payload?.act_task_id ?? "").trim();
      if (actTaskId) receiptByTask.set(actTaskId, receipt);
    }

    return operationItems.map((op) => {
      const traj = trajectories.find((t: any) => String(t.device_id ?? "") === String(op.raw?.device_id ?? ""));
      const points = Array.isArray(traj?.points) ? traj.points : [];
      const start = Number(op.raw?.start_ts_ms ?? 0);
      const end = Number(op.raw?.end_ts_ms ?? Number.MAX_SAFE_INTEGER);
      const clipped = points
        .filter((p: any) => Number(p.ts_ms) >= start && Number(p.ts_ms) <= end && Number(p.ts_ms) <= playbackTs)
        .map((p: any) => [Number(p.lon), Number(p.lat)] as [number, number]);
      const receipt = op.actTaskId ? receiptByTask.get(op.actTaskId) : null;
      const receiptStatus = String(receipt?.receipt?.payload?.status ?? "").toUpperCase();
      let statusCode: ExecutionStatus = "READY";
      if (receiptStatus.includes("FAIL")) statusCode = "FAILED";
      else if (receiptStatus.includes("SUCCESS") || receiptStatus.includes("SUCC") || op.source === labels.fromReceipt) statusCode = "SUCCEEDED";
      else if (op.source === labels.fromSchedule) statusCode = "DISPATCHED";
      return {
        id: op.id,
        status: statusCode,
        color: executionColor(statusCode),
        coordinates: clipped,
        label: op.type,
      };
    }).filter((s) => s.coordinates.length > 1);
  }, [detail, operationItems, playbackTs, labels]);

  const playbackMarkers = React.useMemo(
    () => (detail?.map_layers?.markers || []).filter((m: any) => Number(m.ts_ms ?? 0) <= playbackTs),
    [detail, playbackTs],
  );

  const risk = riskKey(detail);

  const summaryCards = React.useMemo(() => {
    const lastOp = operationItems[0];
    return [
      { label: labels.area, value: detail?.field?.area_ha ? `${detail.field.area_ha} ha` : "-" },
      { label: labels.crop, value: detail?.latest_season?.crop || detail?.season?.crop || "-" },
      { label: labels.season, value: detail?.latest_season?.name || detail?.latest_season?.season_id || "-" },
      { label: labels.devices, value: String(detail?.summary?.device_count ?? 0) },
      { label: labels.lastOperation, value: lastOp?.type || "-" },
      { label: labels.riskStatus, value: formatRiskStatus(detail, lang) },
    ];
  }, [detail, labels, lang, operationItems]);

  const currentOperation = activeOperations[0] ?? null;
  const currentProgress = currentOperation
    ? String(currentOperation.final_status) === "SUCCESS" ? 100
      : String(currentOperation.final_status) === "RUNNING" ? 70
        : String(currentOperation.final_status) === "FAILED" ? 100
          : 30
    : 0;

  const recentTimeline = React.useMemo(() => {
    const opEvents = activeOperations.slice(0, 4).map((x) => ({
      ts: x.last_event_ts,
      text: `${x.action_type || tt("operation.title")} ${mapStatusToText(String(x.final_status ?? ""), tt)}`,
    }));
    const recEvents = recentRecommendations.slice(0, 4).map((x) => ({
      ts: Number(Date.parse(String(x.occurred_at ?? ""))) || 0,
      text: `${x.recommendation_type || tt("field.recentTimeline")} ${x.latest_status || x.status || ""}`.trim(),
    }));
    const alertTimeline = alertItems.slice(0, 4).map((x) => ({
      ts: Number(x.timeMs ?? 0),
      text: `${x.type} ${x.status}`,
    }));
    return [...opEvents, ...recEvents, ...alertTimeline]
      .filter((x) => Number.isFinite(x.ts) && x.ts > 0)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 8);
  }, [activeOperations, recentRecommendations, alertItems, lang]);

  const tabs: Array<{ key: FieldTab; label: string }> = [
    { key: "overview", label: labels.overview },
    { key: "map", label: labels.map },
    { key: "operations", label: labels.operations },
    { key: "alerts", label: labels.alerts },
  ];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>{labels.title}</h2>
            <div className="muted" style={{ marginTop: 4 }}>{labels.desc}</div>
            <div className="muted" style={{ marginTop: 4 }}>field_id: <span className="mono">{shortId(fieldId)}</span></div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select className="select" value={lang} onChange={(e) => setLang(e.target.value as FieldLang)}><option value="zh">中文</option><option value="en">English</option></select>
            <Link className="btn" to="/fields">{labels.back}</Link>
            <button className="btn" onClick={() => void refresh()} disabled={busy}>{labels.refresh}</button>
          </div>
        </div>
      </section>

      <FieldSummaryCards items={summaryCards} />

      <section className="card" style={{ padding: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tabs.map((t) => <button key={t.key} className={`btn ${activeTab === t.key ? "primary" : ""}`} onClick={() => setActiveTab(t.key)}>{t.label}</button>)}
          <span className="muted">{status}</span>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14 }}>
        <div className="card" style={{ padding: 14 }}>
          {activeTab === "overview" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div><b>{labels.fieldName}：</b>{detail?.field?.name || "-"}</div>
              <div><b>{labels.area}：</b>{detail?.field?.area_ha ? `${detail.field.area_ha} ha` : "-"}</div>
              <div><b>{labels.currentSeason}：</b>{detail?.latest_season?.name || detail?.latest_season?.season_id || "-"}</div>
              {detail?.latest_season?.crop ? <div><b>{labels.crop}：</b>{detail.latest_season.crop}</div> : null}
              {detail?.latest_season?.stage ? <div><b>{labels.currentStage}：</b>{detail.latest_season.stage}</div> : null}
              <div><b>当前 active program：</b>{String(currentProgram?.program_id ?? "-")}</div>
              <div><b>program 目标：</b>{currentProgram?.goal_profile ? JSON.stringify(currentProgram.goal_profile) : "-"}</div>
              <div><b>当前生育/阶段状态：</b>{String(currentProgram?.current_stage ?? "-")}</div>
              <div><b>当前偏差：</b>{Array.isArray(currentProgram?.current_risk_summary?.signals) ? currentProgram.current_risk_summary.signals.join(", ") : "-"}</div>
              <div><b>当前待审批动作：</b>{String(currentProgram?.pending_operation_plan?.approval_request_id ?? "-")}</div>
              <div><b>{labels.currentStatus}：</b>{mapFieldStatusToLabel(detail?.field?.status, lang)}</div>
              <div><b>{tt("field.gisCenter")}：</b>{tt("field.layerControl")}</div>
              <div><b>{labels.devices}：</b>{detail?.summary?.device_count ?? 0}</div>
              <div><b>{labels.lastOperation}：</b>{operationItems[0]?.type || "-"}</div>
              <div><b>{labels.activeAlerts}：</b>{alertItems.length}</div>
              <div><b>{tt("field.currentOperation")}：</b>{activeOperations.length}</div>
              <div><b>{labels.riskStatus}：</b><span style={{ color: getRiskColor(risk), fontWeight: 700 }}>{formatRiskStatus(detail, lang)}</span></div>
              <div style={{ marginTop: 8 }}><b>{tt("field.recentTimeline")}：</b></div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {recentRecommendations.map((r) => (
                  <li key={r.recommendation_id} className="muted">
                    {r.recommendation_type || "-"} · {r.latest_status || r.status || "-"}
                  </li>
                ))}
                {!recentRecommendations.length ? <li className="muted">-</li> : null}
              </ul>

              <div style={{ marginTop: 12 }}><b>{tt("field.currentOperation")}</b></div>
              <div className="card" style={{ padding: 10 }}>
                <div>{tt("operation.labels.action")}：{currentOperation?.action_type || tt("common.none")}</div>
                <div>{tt("operation.labels.device")}：{currentOperation?.device_id || tt("common.none")}</div>
                <div>{tt("operation.filters.status")}：{currentOperation ? mapStatusToText(String(currentOperation.final_status), tt) : tt("common.none")}</div>
                <div>{tt("field.progress")}：{currentProgress}%</div>
              </div>

              <div style={{ marginTop: 12 }}><b>{tt("field.recentTimeline")}</b></div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {recentTimeline.map((x, idx) => (
                  <li key={`${x.ts}_${idx}`}>[{new Date(x.ts).toLocaleTimeString()}] {x.text}</li>
                ))}
                {!recentTimeline.length ? <li className="muted">-</li> : null}
              </ul>

              <div style={{ marginTop: 12 }}><b>{tt("field.riskAlerts")}</b></div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {alertItems.slice(0, 3).map((x) => <li key={x.id}>⚠ {x.type}</li>)}
                {!alertItems.length ? <li className="muted">{tt("field.noRisk")}</li> : null}
              </ul>
            </div>
          ) : null}

          {activeTab === "map" ? (
            <div style={{ display: "grid", gap: 10 }}>
              <FieldLegend labels={labels} />
              {!detail?.geometry ? <div className="card" style={{ padding: 10, color: "#b42318" }}>Geometry unavailable for this field.</div> : null}
              <div className="card" style={{ padding: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{tt("field.layerControl")}</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <label><input type="checkbox" checked={showTrajectoryLayer} onChange={(e) => setShowTrajectoryLayer(e.target.checked)} /> {tt("field.layerTrajectory")}</label>
                  <label><input type="checkbox" checked={showAlertLayer} onChange={(e) => setShowAlertLayer(e.target.checked)} /> {tt("field.layerAlerts")}</label>
                  <label><input type="checkbox" checked={showAcceptanceLayer} onChange={(e) => setShowAcceptanceLayer(e.target.checked)} /> {tt("field.layerAcceptance")}</label>
                </div>
              </div>
              {!detail?.geometry ? <div className="card" style={{ padding: 10, color: "#b42318" }}>{tt("field.geometryUnavailable")}</div> : null}
              <div className="card" style={{ padding: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{tt("field.layerControl")}</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <label><input type="checkbox" checked={showTrajectoryLayer} onChange={(e) => setShowTrajectoryLayer(e.target.checked)} /> {tt("field.layerTrajectory")}</label>
                  <label><input type="checkbox" checked={showAlertLayer} onChange={(e) => setShowAlertLayer(e.target.checked)} /> {tt("field.layerAlerts")}</label>
                  <label><input type="checkbox" checked={showAcceptanceLayer} onChange={(e) => setShowAcceptanceLayer(e.target.checked)} /> {tt("field.layerAcceptance")}</label>
                </div>
              </div>
              {!detail?.geometry ? <div className="card" style={{ padding: 10, color: "#b42318" }}>{tt("field.geometryUnavailable")}</div> : null}
              <div className="card" style={{ padding: 10 }}>
                <div className="muted">Timeline</div>
                <input type="range" min={0} max={Math.max(0, timelineEvents.length - 1)} value={timelineIndex} onChange={(e) => setTimelineIndex(Number(e.target.value))} style={{ width: "100%" }} />
                <div className="muted" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{timelineEvents[timelineIndex]?.label || "-"}</span>
                  <button className="btn" onClick={() => setPlaying((v) => !v)}>{playing ? "Pause" : "Play"}</button>
                </div>
              </div>
              <FieldGisMap
                polygonGeoJson={detail?.geometry || detail?.polygon?.geojson_json}
                heatGeoJson={showAlertLayer ? (detail?.map_layers?.alert_heat_geojson || { type: "FeatureCollection", features: [] }) : { type: "FeatureCollection", features: [] }}
                markers={playbackMarkers}
                trajectorySegments={showTrajectoryLayer ? trajectorySegments : []}
                acceptancePoints={showAcceptanceLayer ? (operationItems.filter((x) => x.raw?.location).map((x) => ({ id: x.id, status: x.status, lat: Number(x.raw.location.lat), lon: Number(x.raw.location.lon) }))) : []}
                activeSegmentId={selectedObject?.id}
                labels={labels}
                onSelectObject={setSelectedObject}
              />
              <div className="card" style={{ padding: 10 }}>
                <div style={{ fontWeight: 700 }}>{tt("field.acceptanceSummary")}</div>
                <div className="muted">{tt("operation.gis.trajectory_points")}: {trajectorySegments.reduce((acc, s) => acc + s.coordinates.length, 0)}</div>
                <div className="muted">{tt("operation.gis.in_field_ratio")}: {(detail?.latest_acceptance_result?.metrics?.in_field_ratio != null) ? Number(detail.latest_acceptance_result.metrics.in_field_ratio).toFixed(3) : "-"}</div>
              </div>
            </div>
          ) : null}

          {activeTab === "operations" ? <FieldOperationList labels={labels} items={operationItems} onSelect={(item) => setSelectedObject({ kind: labels.operations, name: item.type, time: item.time, status: item.status, related: item.source, id: item.id })} /> : null}
          {activeTab === "alerts" ? <FieldAlertList labels={labels} items={alertItems} onSelect={(item) => setSelectedObject({ kind: labels.alerts, name: item.type, time: item.time, status: item.status, related: item.target, id: item.id })} /> : null}

          {isDev ? (
            <details style={{ marginTop: 12 }}>
              <summary className="muted">{labels.devDebug}</summary>
              <label className="field"><span>AO-ACT Token</span><input className="input" value={token} onChange={(e) => persistToken(e.target.value)} placeholder="token" /></label>
              <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify({ timelineEvents, trajectorySegments, detail }, null, 2)}</pre>
            </details>
          ) : null}
        </div>

        <FieldSeasonPanel labels={labels} selectedMapObject={selectedObject} />
      </section>
    </div>
  );
}
