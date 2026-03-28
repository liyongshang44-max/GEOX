import { mapOperationTypeToLabel, type FieldLang } from "../lib/fieldViewModel";

export type FieldConsoleStatus = "ok" | "risk" | "error";

export type FieldViewModel = {
  fieldId: string;
  fieldName: string;
  status: FieldConsoleStatus;
  statusLabel: string;
  statusDot: string;
  statusReason?: string;
  deviceCount: number;
  kpis: Array<{ label: string; value: string }>;
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
  program: null | {
    programId: string;
    title: string;
    objective: string;
    status: string;
    expectedYield: string;
    expectedCost: string;
  };
  timeline: Array<{ ts: number; timeLabel: string; text: string }>;
  evidence: Array<{ id: string; text: string; timeLabel: string; deviceId: string }>;
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

function resolveStatus(args: { hasAlert: boolean; hasFailedTask: boolean }): { code: FieldConsoleStatus; label: string; dot: string } {
  if (args.hasFailedTask) return { code: "error", label: "异常", dot: "🔴" };
  if (args.hasAlert) return { code: "risk", label: "风险", dot: "⚠" };
  return { code: "ok", label: "正常", dot: "●" };
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
  const { fieldId, lang, detail, activeOperations, allOperations, currentProgram, recentRecommendations } = params;
  const latestAlert = (Array.isArray(detail?.recent_alerts) ? detail.recent_alerts : [])[0] ?? null;
  const hasAlert = Number(detail?.recent_alerts?.length ?? 0) > 0 || recentRecommendations.some((x: any) => {
    const raw = `${x?.recommendation_type || ""} ${x?.type || ""}`.toLowerCase();
    return raw.includes("alert") || raw.includes("risk") || raw.includes("health");
  });
  const hasFailedTask = allOperations.some((x: any) => String(x?.final_status || "").toUpperCase().includes("FAIL"));
  const status = resolveStatus({ hasAlert, hasFailedTask });

  let statusReason = "运行稳定";
  if (hasFailedTask) statusReason = "存在失败作业（最新执行异常）";
  else if (hasAlert) {
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

  const program = currentProgram
    ? {
      programId: String(currentProgram?.program_id || ""),
      title: String(currentProgram?.title || currentProgram?.program_name || currentProgram?.program_id || "经营方案"),
      objective: String(currentProgram?.target || currentProgram?.goal || "无农药 / 高品质"),
      status: String(currentProgram?.status || "运行中"),
      expectedYield: String(currentProgram?.expected_yield ?? currentProgram?.yield_target ?? "--"),
      expectedCost: String(currentProgram?.expected_cost ?? currentProgram?.budget_cost ?? "--"),
    }
    : null;

  const timeline = [
    ...allOperations.slice(0, 8).map((x: any) => {
      const ts = Number(x.last_event_ts ?? 0);
      const action = mapOperationTypeToLabel(x.action_type, lang);
      return { ts, timeLabel: formatTimelineTime(ts), text: `${action}完成` };
    }),
    ...recentRecommendations.slice(0, 8).map((x: any) => {
      const ts = Number(Date.parse(String(x.occurred_at ?? ""))) || 0;
      const raw = `${x?.recommendation_type || ""} ${x?.type || ""}`.toLowerCase();
      const text = raw.includes("health") ? "风险提示：作物健康" : "系统建议：关注田块";
      return { ts, timeLabel: formatTimelineTime(ts), text };
    }),
  ]
    .filter((x) => x.ts > 0)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8);

  const evidenceFromOps = allOperations
    .filter((x: any) => {
      const s = String(x.final_status || "").toUpperCase();
      return s.includes("SUCC") || s.includes("FAIL");
    })
    .slice(0, 4)
    .map((x: any) => {
      const s = String(x.final_status || "").toUpperCase();
      const ts = Number(x.last_event_ts ?? 0);
      return {
        id: String(x.operation_plan_id || x.id || `${x.action_type}_${x.last_event_ts ?? 0}`),
        text: `${mapOperationTypeToLabel(x.action_type, lang)}${s.includes("SUCC") ? "完成（符合约束）" : "失败（需复核）"}`,
        timeLabel: formatTimelineTime(ts),
        deviceId: String(x.device_id || currentTask?.deviceId || "dev_onboard_accept_001"),
      };
    });

  const defaultEvidence = detail?.latest_evidence
    ? [{ id: String(detail.latest_evidence?.evidence_id || "latest"), text: "无农药检测通过", timeLabel: "--:--", deviceId: String(currentTask?.deviceId || "dev_onboard_accept_001") }]
    : [];

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
    status: status.code,
    statusLabel: status.label,
    statusDot: status.dot,
    statusReason,
    deviceCount: Number(detail?.summary?.device_count ?? 0),
    kpis: [
      { label: "面积", value: detail?.field?.area_ha ? `${detail.field.area_ha} ha` : "--" },
      { label: "作物", value: String(detail?.latest_season?.crop || detail?.season?.crop || "苹果") },
      { label: "季节", value: String(detail?.latest_season?.name || detail?.latest_season?.season_id || "春季") },
      { label: "风险", value: status.label },
      { label: "设备", value: String(detail?.summary?.device_count ?? 0) },
    ],
    currentTask,
    lastEvent,
    program,
    timeline,
    evidence: evidenceFromOps.length ? evidenceFromOps : defaultEvidence,
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
