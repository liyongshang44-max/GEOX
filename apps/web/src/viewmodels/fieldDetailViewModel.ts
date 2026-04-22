import {
  formatRiskStatus,
  mapAlertTypeToLabel,
  mapOperationTypeToLabel,
  type FieldLang,
} from "../lib/fieldViewModel";
import { mapOperationFinalStatusLabel, normalizeOperationFinalStatus } from "../lib/operationLabels";
import { formatSourceMeta, resolveSourceMeta } from "../lib/dataOrigin";

function fmtTs(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms)) return "-";
  return new Date(ms).toLocaleString();
}

function fmtIso(ts: string | null | undefined): string {
  if (!ts) return "-";
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? new Date(ms).toLocaleString() : ts;
}

type ExecutionStatus = "PENDING" | "RUNNING" | "PENDING_ACCEPTANCE" | "SUCCEEDED" | "FAILED" | "INVALID_EXECUTION";

function executionColor(status: ExecutionStatus): string {
  if (status === "PENDING") return "#2563eb";
  if (status === "RUNNING" || status === "PENDING_ACCEPTANCE") return "#f79009";
  if (status === "SUCCEEDED") return "#12b76a";
  if (status === "INVALID_EXECUTION") return "#b42318";
  return "#f04438";
}

export function buildFieldDetailViewModel(params: {
  detail: any;
  labels: any;
  lang: FieldLang;
  activeOperations: any[];
  allOperations: any[];
  recentRecommendations: any[];
  currentProgram: any;
  programsBySeason: Array<{ season_id: string; count: number; programs: any[] }>;
  playbackTs: number;
}) {
  const { detail, labels, lang, activeOperations, allOperations, recentRecommendations, currentProgram, programsBySeason, playbackTs } = params;

  const operationItems = (Array.isArray(detail?.map_layers?.job_history) ? detail.map_layers.job_history : []).map((item: any) => {
    const sourceMeta = resolveSourceMeta(
      {
        source_kind: item?.source_kind,
        source_type: item?.source_type ?? item?.timing_source,
        data_origin: item?.data_origin,
      },
      { source_kind: "derived_state", source_type: "derived_state", data_origin: "derived_state" },
    );
    const statusLabel = mapOperationFinalStatusLabel(item?.final_status ?? item?.status ?? null, lang === "en" ? "en" : "zh");
    const window = item.trajectory_window_start_ts_ms
      ? `${fmtTs(item.trajectory_window_start_ts_ms)} ~ ${fmtTs(item.trajectory_window_end_ts_ms)}`
      : "-";
    return {
      id: String(item.id ?? `${item.task_type}_${item.ts_ms || 0}`),
      actTaskId: String(item.act_task_id ?? ""),
      type: mapOperationTypeToLabel(item.task_type, lang),
      time: fmtTs(item.ts_ms),
      timeMs: Number(item.ts_ms ?? 0),
      source: formatSourceMeta(sourceMeta),
      source_kind: sourceMeta.source_kind,
      source_type: sourceMeta.source_type,
      data_origin: sourceMeta.data_origin,
      status: statusLabel,
      device: item.device_id || "-",
      window,
      raw: item,
    };
  });

  const alertItems = (Array.isArray(detail?.recent_alerts) ? detail.recent_alerts : []).map((event: any) => {
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

  const timelineEvents = [
    ...(detail?.map_layers?.markers || []).map((m: any) => ({ ts: Number(m.ts_ms ?? 0), type: "telemetry", label: `${labels.devicePosition} ${m.device_id}` })),
    ...(detail?.recent_receipts || []).map((r: any) => ({ ts: Number(Date.parse(String(r.occurred_at ?? ""))) || 0, type: "receipt", label: `${labels.source}: ${labels.alerts}` })),
    ...operationItems.map((op) => ({ ts: Number(op.timeMs || 0), type: "plan_transition", label: `${labels.operations}: ${op.type}` })),
  ]
    .filter((x) => Number.isFinite(x.ts) && x.ts > 0)
    .sort((a, b) => a.ts - b.ts);

  const trajectories = Array.isArray(detail?.map_layers?.trajectories) ? detail.map_layers.trajectories : [];
  const trajectorySegments = operationItems.map((op) => {
    const traj = trajectories.find((t: any) => String(t.device_id ?? "") === String(op.raw?.device_id ?? ""));
    const points = Array.isArray(traj?.points) ? traj.points : [];
    const start = Number(op.raw?.start_ts_ms ?? 0);
    const end = Number(op.raw?.end_ts_ms ?? Number.MAX_SAFE_INTEGER);
    const clipped = points
      .filter((p: any) => Number(p.ts_ms) >= start && Number(p.ts_ms) <= end && Number(p.ts_ms) <= playbackTs)
      .map((p: any) => [Number(p.lon), Number(p.lat)] as [number, number]);
    const normalized = normalizeOperationFinalStatus(op.raw?.final_status ?? op.raw?.status);
    let statusCode: ExecutionStatus = "PENDING";
    if (normalized === "SUCCESS") statusCode = "SUCCEEDED";
    else if (normalized === "FAILED") statusCode = "FAILED";
    else if (normalized === "INVALID_EXECUTION") statusCode = "INVALID_EXECUTION";
    else if (normalized === "PENDING_ACCEPTANCE") statusCode = "PENDING_ACCEPTANCE";
    else if (normalized === "RUNNING") statusCode = "RUNNING";
    return {
      id: op.id,
      status: statusCode,
      color: executionColor(statusCode),
      coordinates: clipped,
      label: op.type,
    };
  }).filter((s) => s.coordinates.length > 1);

  const rawMarkers = Array.isArray(detail?.map_layers?.markers) ? detail.map_layers.markers : [];
  const playbackMarkers = rawMarkers.filter((m: any) => Number(m.ts_ms ?? 0) <= playbackTs);
  const acceptancePoints = operationItems
    .filter((x) => x.raw?.location)
    .map((x) => ({ id: x.id, status: x.status, lat: Number(x.raw.location.lat), lon: Number(x.raw.location.lon) }));

  const lastOp = operationItems[0];
  const summaryCards = [
    { label: labels.area, value: detail?.field?.area_ha ? `${detail.field.area_ha} ha` : "-" },
    { label: labels.crop, value: detail?.latest_season?.crop || detail?.season?.crop || "-" },
    { label: labels.season, value: detail?.latest_season?.name || detail?.latest_season?.season_id || "-" },
    { label: labels.devices, value: String(detail?.summary?.device_count ?? 0) },
    { label: labels.lastOperation, value: lastOp?.type || "-" },
    { label: labels.riskStatus, value: formatRiskStatus(detail, lang) },
  ];

  const seasonOptions = programsBySeason.map((x) => String(x.season_id)).filter(Boolean).sort();

  const currentOperation = activeOperations[0] ?? null;
  const currentProgress = currentOperation
    ? String(currentOperation.final_status) === "SUCCESS" ? 100
      : String(currentOperation.final_status) === "RUNNING" ? 70
        : String(currentOperation.final_status) === "FAILED" ? 100
          : 30
    : 0;

  const toActionLabel = (action: string | null | undefined): string => {
    const raw = String(action || "").toUpperCase();
    if (raw.includes("IRRIGATE")) return "灌溉";
    return "作业";
  };

  const recentTimeline = [
    ...allOperations.slice(0, 6).map((x: any) => {
      const statusRaw = String(x.final_status ?? "").toUpperCase();
      const verb = statusRaw.includes("SUCC") || statusRaw.includes("FAIL") ? "完成" : "开始";
      return { ts: Number(x.last_event_ts ?? 0), text: `${verb}${toActionLabel(x.action_type)}` };
    }),
    ...recentRecommendations.slice(0, 6).map((x: any) => {
      const recType = String(x.recommendation_type || x.type || "").toLowerCase();
      const prefix = recType.includes("alert") ? "风险提示" : "系统建议";
      const content = recType.includes("health") ? "作物健康风险" : "田块风险关注";
      return { ts: Number(Date.parse(String(x.occurred_at ?? ""))) || 0, text: `${prefix}：${content}` };
    }),
  ]
    .filter((x) => Number.isFinite(x.ts) && x.ts > 0)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8);

  const recentEvidence = allOperations
    .filter((x: any) => {
      const status = String(x.final_status ?? "").toUpperCase();
      return status.includes("SUCC") || status.includes("FAIL");
    })
    .slice(0, 6)
    .map((x: any) => {
      const status = String(x.final_status ?? "").toUpperCase();
      return {
        id: String(x.operation_plan_id ?? x.id ?? `${x.action_type}_${x.last_event_ts ?? 0}`),
        text: `${toActionLabel(x.action_type)}完成（${status.includes("SUCC") ? "符合约束" : "未达标"}）`,
      };
    });

  const battleSections = {
    header: { key: "header", title: "田块头部" },
    initChecklist: { key: "init_checklist", title: "初始化检查区" },
    currentStatus: { key: "current_status", title: "当前状态区" },
    riskAndRecommendation: { key: "risk_recommendation", title: "当前风险与建议区" },
    recentOperation: { key: "recent_operation", title: "最近作业与验收区" },
    gis: { key: "gis", title: "GIS 与轨迹区" },
    relatedAssets: { key: "related_assets", title: "相关方案与设备区" },
  } as const;

  return {
    detail,
    summaryCards,
    operationItems,
    alertItems,
    timelineEvents,
    currentOperation,
    currentProgress,
    recentTimeline,
    recentEvidence,
    currentProgram,
    programsBySeason,
    seasonOptions,
    recentRecommendations,
    battleSections,
    mapInput: {
      polygonGeoJson: detail?.geometry || detail?.polygon?.geojson_json,
      heatGeoJson: detail?.map_layers?.alert_heat_geojson || { type: "FeatureCollection", features: [] },
      rawMarkers,
      playbackMarkers,
      trajectorySegments,
      acceptancePoints,
    },
  };
}
