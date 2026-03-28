import { mapOperationTypeToLabel, type FieldLang } from "../lib/fieldViewModel";
import { mapReceiptToVm, type ReceiptEvidenceVm } from "./evidence";
import { resolveTimelineLabel } from "./timelineLabels";

export type FieldConsoleStatus = "ok" | "risk" | "error";

type TimelineType = "operation" | "alert" | "recommendation";

export type FieldViewModel = {
  fieldId: string;
  fieldName: string;
  status: FieldConsoleStatus;
  statusLabel: string;
  statusReason?: string;
  device?: string;
  currentTask: null | {
    action: string;
    deviceId: string;
    status: string;
    progress: number;
    startedAt: number | null;
    operationPlanId: string;
  };
  lastEvent: null | {
    action: string;
    happenedAt: number | null;
    relativeText: string;
  };
  kpis: Array<{ label: string; value: string }>;
  timeline: Array<{ id: string; ts: number; time: string; type: TimelineType; icon: string; label: string }>;
  evidence: Array<{ id: string; title: string; time: string; device: string }>;
  latestEvidence?: ReceiptEvidenceVm;
  map: {
    polygonGeoJson: any;
    heatGeoJson: any;
    markers: any[];
    trajectorySegments: any[];
    acceptancePoints: any[];
    hasTrajectory: boolean;
  };
};

function taskProgress(status: string): number {
  const s = String(status || "").toUpperCase();
  if (s.includes("SUCC") || s.includes("FAIL")) return 100;
  if (s.includes("RUN")) return 70;
  return 30;
}

function formatTimelineTime(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return "--:--";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatRelative(ts: number | null): string {
  if (!ts || !Number.isFinite(ts)) return "--";
  const deltaMs = Math.max(0, Date.now() - ts);
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

function computeStatus(data: { hasAlert: boolean; hasFailedTask: boolean }): FieldConsoleStatus {
  if (data.hasFailedTask) return "error";
  if (data.hasAlert) return "risk";
  return "ok";
}

function mapStatusLabel(status: FieldConsoleStatus): string {
  if (status === "error") return "异常";
  if (status === "risk") return "风险";
  return "正常";
}

function timelineItemFromOperation(x: any, lang: FieldLang) {
  const ts = Number(x.last_event_ts ?? 0);
  const action = mapOperationTypeToLabel(x.action_type, lang);
  const stageLabel = resolveTimelineLabel({ operationPlanStatus: x.final_status, dispatchState: x.dispatch_status, factType: x.fact_type });
  return {
    key: `op:${String(x.action_type || "op").toLowerCase()}`,
    id: String(x.operation_plan_id || x.id || `${x.action_type}_${x.last_event_ts ?? 0}`),
    ts,
    time: formatTimelineTime(ts),
    type: "operation" as const,
    icon: "🌱",
    label: `${action}${stageLabel}`,
  };
}

function timelineItemFromRecommendation(x: any) {
  const ts = Number(Date.parse(String(x.occurred_at ?? ""))) || 0;
  const raw = `${x?.recommendation_type || ""} ${x?.type || ""}`.toLowerCase();
  const isAlert = raw.includes("alert") || raw.includes("risk") || raw.includes("health");
  return {
    key: isAlert ? "alert:health" : "rec:watch",
    id: String(x.recommendation_id || `${raw}_${ts}`),
    ts,
    time: formatTimelineTime(ts),
    type: (isAlert ? "alert" : "recommendation") as TimelineType,
    icon: isAlert ? "⚠️" : "💡",
    label: isAlert ? "作物健康风险" : "系统建议：关注田块",
  };
}

function buildTimeline(allOperations: any[], recentRecommendations: any[], lang: FieldLang): FieldViewModel["timeline"] {
  const raw = [
    ...allOperations.slice(0, 12).map((x) => timelineItemFromOperation(x, lang)),
    ...recentRecommendations.slice(0, 12).map((x) => timelineItemFromRecommendation(x)),
  ]
    .filter((x) => x.ts > 0)
    .sort((a, b) => b.ts - a.ts);

  const deduped = raw.filter((item, idx, arr) => arr.findIndex((candidate) => candidate.key === item.key) === idx);

  return deduped.slice(0, 8).map((item) => ({
    id: item.id,
    ts: item.ts,
    time: item.time,
    type: item.type,
    icon: item.icon,
    label: item.label,
  }));
}

export function buildFieldViewModel(params: {
  fieldId: string;
  lang: FieldLang;
  detail: any;
  activeOperations: any[];
  allOperations: any[];
  currentProgram: any;
  recentRecommendations: any[];
}): FieldViewModel {
  const { fieldId, lang, detail, activeOperations, allOperations, recentRecommendations } = params;
  const latestAlert = (Array.isArray(detail?.recent_alerts) ? detail.recent_alerts : [])[0] ?? null;

  const hasAlert = Number(detail?.recent_alerts?.length ?? 0) > 0 || recentRecommendations.some((x: any) => {
    const raw = `${x?.recommendation_type || ""} ${x?.type || ""}`.toLowerCase();
    return raw.includes("alert") || raw.includes("risk") || raw.includes("health");
  });
  const hasFailedTask = allOperations.some((x: any) => String(x?.final_status || "").toUpperCase().includes("FAIL"));
  const status = computeStatus({ hasAlert, hasFailedTask });

  let statusReason = "运行稳定";
  if (status === "error") statusReason = "存在失败作业（最新执行异常）";
  if (status === "risk") {
    const metric = String(latestAlert?.metric || latestAlert?.title || "").toLowerCase();
    statusReason = metric.includes("health") ? "作物健康风险（最新告警）" : "存在风险提示（最新告警）";
  }

  const currentOperation = activeOperations[0] ?? null;
  const currentTask = currentOperation
    ? {
      action: mapOperationTypeToLabel(currentOperation.action_type, lang),
      deviceId: String(currentOperation.device_id || "dev_onboard_accept_001"),
      status: String(currentOperation.final_status || "执行中"),
      progress: taskProgress(String(currentOperation.final_status || "")),
      startedAt: Number(currentOperation.last_event_ts ?? 0) || null,
      operationPlanId: String(currentOperation.operation_plan_id || ""),
    }
    : null;

  const latestOperation = (allOperations[0] ?? null) as any;
  const latestTs = Number(latestOperation?.last_event_ts ?? 0) || null;
  const lastEvent = latestOperation
    ? {
      action: `${mapOperationTypeToLabel(latestOperation?.action_type, lang)}完成`,
      happenedAt: latestTs,
      relativeText: `${formatRelative(latestTs)} ${mapOperationTypeToLabel(latestOperation?.action_type, lang)}完成`,
    }
    : null;

  const timeline = buildTimeline(allOperations, recentRecommendations, lang);

  const evidence = allOperations
    .filter((x: any) => {
      const s = String(x.final_status || "").toUpperCase();
      return s.includes("SUCC") || s.includes("FAIL") || s.includes("SUCCESS");
    })
    .slice(0, 4)
    .map((x: any) => {
      const s = String(x.final_status || "").toUpperCase();
      const ts = Number(x.last_event_ts ?? 0);
      const action = mapOperationTypeToLabel(x.action_type, lang);
      return {
        id: String(x.operation_plan_id || x.id || `${x.action_type}_${x.last_event_ts ?? 0}`),
        title: `${action}${s.includes("SUCC") || s.includes("SUCCESS") ? "完成（符合约束）" : "完成（需复核）"}`,
        time: formatTimelineTime(ts),
        device: String(x.device_id || currentTask?.deviceId || "dev_onboard_accept_001"),
      };
    });
  const latestEvidence = detail?.latestEvidence ? mapReceiptToVm(detail.latestEvidence) : undefined;

  const trajectories = Array.isArray(detail?.map_layers?.trajectories) ? detail.map_layers.trajectories : [];
  const trajectorySegments = trajectories
    .map((t: any, idx: number) => {
      const points = Array.isArray(t?.points) ? t.points : [];
      const coordinates = points
        .map((p: any) => [Number(p?.lon), Number(p?.lat)] as [number, number])
        .filter((x) => Number.isFinite(x[0]) && Number.isFinite(x[1]));
      return {
        id: String(t?.operation_plan_id || t?.task_id || `track_${idx}`),
        status: "DISPATCHED",
        color: "#2563eb",
        coordinates,
        label: String(t?.device_id || `track_${idx + 1}`),
      };
    })
    .filter((x) => x.coordinates.length > 1);

  const markers = Array.isArray(detail?.map_layers?.markers) ? detail.map_layers.markers : [];

  return {
    fieldId,
    fieldName: String(detail?.field?.name || "field_c8_demo"),
    status,
    statusLabel: mapStatusLabel(status),
    statusReason,
    device: String(currentTask?.deviceId || "dev_onboard_accept_001"),
    currentTask,
    lastEvent,
    kpis: [
      { label: "面积", value: detail?.field?.area_ha ? `${detail.field.area_ha} ha` : "--" },
      { label: "当前作物", value: String(detail?.latest_season?.crop || detail?.season?.crop || "苹果") },
      { label: "当前季节", value: String(detail?.latest_season?.name || detail?.latest_season?.season_id || "春季") },
      { label: "设备数", value: String(detail?.summary?.device_count ?? 0) },
      { label: "最近作业", value: lastEvent?.action || "--" },
    ],
    timeline,
    evidence,
    latestEvidence,
    map: {
      polygonGeoJson: detail?.geometry || detail?.polygon?.geojson_json || null,
      heatGeoJson: detail?.map_layers?.alert_heat_geojson || { type: "FeatureCollection", features: [] },
      markers,
      trajectorySegments,
      acceptancePoints: [],
      hasTrajectory: trajectorySegments.length > 0,
    },
  };
}
