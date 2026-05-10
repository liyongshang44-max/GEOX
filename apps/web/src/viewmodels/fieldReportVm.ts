import type { FieldReportDetailV1 } from "../api/customerReports";
import { customerFieldMemoryLabel, customerRoiLabel, labelAcceptanceStatus, labelFinalStatus, labelOperationType, labelRiskLevel, sanitizeCustomerText } from "../lib/customerLabels";
import { getCustomerEmptyState } from "../lib/customerEmptyStates";

export type FieldMapMarkerVm = { device_id: string; lat: number; lon: number; ts_ms?: number | null };
export type FieldMapTrajectorySegmentVm = {
  id: string;
  status: "READY" | "DISPATCHED" | "SUCCEEDED" | "FAILED";
  color: string;
  coordinates: Array<[number, number]>;
  label?: string;
};
export type FieldMapAcceptancePointVm = { id: string; status: string; lat: number; lon: number };
export type FieldMapLayersVm = {
  plannedGeoJson: unknown | null;
  coverageGeoJson: unknown | null;
  trajectorySegments: FieldMapTrajectorySegmentVm[];
  acceptancePoints: FieldMapAcceptancePointVm[];
  deviceMarkers: FieldMapMarkerVm[];
  hasAnyOperationLayer: boolean;
  summaryText: string;
};

export type FieldReportPageVm = {
  generatedAtText: string;
  field: { fieldId: string; fieldName: string; cropText: string; stageText: string; updatedAtText: string };
  risk: { levelLabel: string; tone: "neutral" | "warning" | "danger"; reasons: string[] };
  diagnosis: { headline: string; evidenceLines: string[]; dataQualityText: string; latestObservationText: string };
  recommendations: Array<{ title: string; summary: string; href?: string }>;
  recentOperations: Array<{ operationId: string; title: string; statusText: string; acceptanceText: string; evidenceText: string; updatedAtText: string; href: string }>;
  roiSummary: ({ title: string; lines: string[] } | { title: string; description: string }) & { displayText: string };
  fieldMemory: ({ title: string; lines: string[] } | { title: string; description: string }) & { displayText: string };
  mapLayers: FieldMapLayersVm;
  exportHref: string;
  hero: {
    title: string;
    subtitle: string;
  };
  landOverview: Array<{ label: string; value: string }>;
  diagnosticCards: Array<{ title: string; value: string; detail: string }>;
  currentStatus: {
    summary: string;
    reasons: string[];
  };
  recentOperationsTop5: Array<{
    id: string;
    title: string;
    statusText: string;
    acceptanceText: string;
    generatedAtText: string;
    href: string;
  }>;
  prescriptionCards: Array<{ title: string; value: string; detail: string }>;
  deviceMonitoring: Array<{ label: string; value: string }>;
  header: { title: string; subtitle: string; fieldId: string };
  overview: { riskText: string; openAlertsText: string; pendingAcceptanceText: string; totalOperationsText: string; latestOperationText: string; estimatedCostText: string; actualCostText: string };
  explain: { human: string; topReasonsText: string[] };
  deviceSummary: { totalText: string; onlineText: string; offlineText: string; lastUpdateText: string };
  nextAction: { title: string; explainText: string; objectiveText: string; priorityText: string } | null;
};

function formatDateTime(value: string | null | undefined, fallback = "暂无更新时间"): string {
  if (!value) return fallback;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || ms <= 0) return fallback;
  const d = new Date(ms);
  if (d.getUTCFullYear() <= 1970) return fallback;
  return d.toLocaleString("zh-CN", { hour12: false });
}

function formatCurrency(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 }).format(Number.isFinite(num) ? num : 0);
}

function formatCount(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? String(num) : "0";
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function isGeoJsonLike(value: unknown): boolean {
  if (!isObject(value)) return false;
  const type = String(value.type ?? "");
  if (type === "FeatureCollection") return Array.isArray(value.features) && value.features.length > 0;
  if (type === "Feature") return isGeoJsonLike(value.geometry);
  if (["Polygon", "MultiPolygon", "LineString", "MultiLineString", "Point", "MultiPoint"].includes(type)) return Array.isArray(value.coordinates);
  return false;
}

function toFeature(value: unknown): Record<string, any> | null {
  if (!isGeoJsonLike(value)) return null;
  const obj = value as Record<string, any>;
  if (obj.type === "Feature") return obj;
  return { type: "Feature", properties: {}, geometry: obj };
}

function collectFeatures(values: unknown[]): Record<string, any>[] {
  const features: Record<string, any>[] = [];
  for (const value of values) {
    for (const item of asArray(value)) {
      if (!isGeoJsonLike(item)) continue;
      const obj = item as Record<string, any>;
      if (obj.type === "FeatureCollection") {
        for (const feature of asArray(obj.features)) {
          const normalized = toFeature(feature);
          if (normalized) features.push(normalized);
        }
      } else {
        const normalized = toFeature(item);
        if (normalized) features.push(normalized);
      }
    }
  }
  return features;
}

function combineGeoJson(values: unknown[]): unknown | null {
  const features = collectFeatures(values);
  if (!features.length) return null;
  if (features.length === 1) return features[0];
  return { type: "FeatureCollection", features };
}

function collectCoordinatePairs(raw: unknown, out: Array<[number, number]>): void {
  if (!Array.isArray(raw)) return;
  if (raw.length >= 2 && Number.isFinite(Number(raw[0])) && Number.isFinite(Number(raw[1]))) {
    out.push([Number(raw[0]), Number(raw[1])]);
    return;
  }
  for (const item of raw) collectCoordinatePairs(item, out);
}

function lineStringsFromGeoJson(value: unknown): Array<Array<[number, number]>> {
  if (!isObject(value)) return [];
  const type = String(value.type ?? "");
  if (type === "Feature") return lineStringsFromGeoJson(value.geometry);
  if (type === "FeatureCollection") return asArray(value.features).flatMap((feature) => lineStringsFromGeoJson(feature));
  if (type === "LineString") {
    const coordinates: Array<[number, number]> = [];
    collectCoordinatePairs(value.coordinates, coordinates);
    return coordinates.length >= 2 ? [coordinates] : [];
  }
  if (type === "MultiLineString") {
    return asArray(value.coordinates).flatMap((line) => {
      const coordinates: Array<[number, number]> = [];
      collectCoordinatePairs(line, coordinates);
      return coordinates.length >= 2 ? [coordinates] : [];
    });
  }
  return [];
}

function trajectorySegmentsFrom(value: unknown, prefix: string): FieldMapTrajectorySegmentVm[] {
  if (!value) return [];
  if (isGeoJsonLike(value)) {
    return lineStringsFromGeoJson(value).map((coordinates, index) => ({
      id: `${prefix}_${index + 1}`,
      status: "SUCCEEDED" as const,
      color: "#2563eb",
      coordinates,
      label: `执行轨迹 ${index + 1}`,
    }));
  }
  return asArray(value).flatMap((item, index) => {
    if (isGeoJsonLike(item)) return trajectorySegmentsFrom(item, `${prefix}_${index + 1}`);
    if (!isObject(item)) {
      const coordinates: Array<[number, number]> = [];
      collectCoordinatePairs(item, coordinates);
      return coordinates.length >= 2 ? [{ id: `${prefix}_${index + 1}`, status: "SUCCEEDED" as const, color: "#2563eb", coordinates, label: `执行轨迹 ${index + 1}` }] : [];
    }
    const coordinates: Array<[number, number]> = [];
    collectCoordinatePairs(item.coordinates ?? item.points ?? item.path, coordinates);
    if (coordinates.length < 2) return [];
    const statusRaw = String(item.status ?? item.final_status ?? "SUCCEEDED").toUpperCase();
    return [{
      id: String(item.id ?? item.segment_id ?? `${prefix}_${index + 1}`),
      status: statusRaw.includes("FAIL") ? "FAILED" as const : "SUCCEEDED" as const,
      color: "#2563eb",
      coordinates,
      label: sanitizeCustomerText(item.label ?? item.name ?? `执行轨迹 ${index + 1}`),
    }];
  });
}

function markerFrom(value: unknown, index: number): FieldMapMarkerVm | null {
  if (!isObject(value)) return null;
  const lat = Number(value.lat ?? value.latitude ?? value.position?.lat ?? value.location?.lat);
  const lon = Number(value.lon ?? value.lng ?? value.longitude ?? value.position?.lon ?? value.position?.lng ?? value.location?.lon ?? value.location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const ts = Number(value.ts_ms ?? value.timestamp_ms ?? value.last_seen_ts_ms ?? value.last_telemetry_ts_ms);
  return {
    device_id: sanitizeCustomerText(value.device_id ?? value.deviceId ?? value.id ?? `device_${index + 1}`),
    lat,
    lon,
    ts_ms: Number.isFinite(ts) ? ts : null,
  };
}

function acceptancePointFrom(value: unknown, index: number): FieldMapAcceptancePointVm | null {
  if (!isObject(value)) return null;
  const lat = Number(value.lat ?? value.latitude ?? value.point?.lat ?? value.location?.lat);
  const lon = Number(value.lon ?? value.lng ?? value.longitude ?? value.point?.lon ?? value.point?.lng ?? value.location?.lon ?? value.location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    id: sanitizeCustomerText(value.id ?? value.acceptance_id ?? value.point_id ?? `acceptance_${index + 1}`),
    status: sanitizeCustomerText(value.status ?? value.verdict ?? value.result ?? "UNKNOWN"),
    lat,
    lon,
  };
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function buildFieldMapLayers(report: FieldReportDetailV1): FieldMapLayersVm {
  const reportAny = report as any;
  const mapLayers = reportAny.map_layers ?? reportAny.gis_layers ?? reportAny.spatial_layers ?? {};
  const operations = [
    ...asArray(mapLayers.operations),
    ...asArray(mapLayers.operation_layers),
    ...asArray(reportAny.operation_reports),
    ...asArray(reportAny.recent_operation_reports),
    ...asArray(reportAny.operations),
    ...asArray(reportAny.recent_operations),
  ].filter(isObject);

  const plannedSources: unknown[] = [mapLayers.planned_geojson, mapLayers.planned_layer, mapLayers.planned_layers, mapLayers.operation_planned_layer];
  const coverageSources: unknown[] = [mapLayers.coverage_geojson, mapLayers.coverage_layer, mapLayers.coverage_layers, mapLayers.as_applied_coverage_layer];
  const trajectorySources: unknown[] = [mapLayers.trajectory_geojson, mapLayers.trajectory_segments, mapLayers.trajectories];
  const markerSources: unknown[] = [mapLayers.device_markers, mapLayers.markers, reportAny.device_markers, reportAny.devices];
  const acceptanceSources: unknown[] = [mapLayers.acceptance_points, mapLayers.acceptance_layer, reportAny.acceptance_points];

  operations.forEach((op, index) => {
    const asApplied = op.as_applied ?? op.asApplied ?? {};
    const asExecuted = op.as_executed ?? op.asExecuted ?? {};
    const prescription = op.prescription ?? {};
    plannedSources.push(
      op.planned_geojson,
      op.plan_geojson,
      op.planned_layer,
      asApplied.planned_geojson,
      asApplied.plan_geojson,
      asApplied.planned_area_geojson,
      prescription.planned_geojson,
      prescription.plan_geojson,
      prescription.spatial_geojson,
    );
    coverageSources.push(
      op.coverage_geojson,
      op.actual_coverage_geojson,
      op.coverage_layer,
      asApplied.coverage_geojson,
      asApplied.actual_coverage_geojson,
      asApplied.as_applied_geojson,
      asApplied.applied_geojson,
    );
    trajectorySources.push(
      op.trajectory_geojson,
      op.trajectory_segments,
      asExecuted.trajectory_geojson,
      asExecuted.actual_trajectory_geojson,
      asExecuted.execution_trace_geojson,
      asExecuted.path_geojson,
      asExecuted.trajectory_segments,
      asApplied.trajectory_geojson,
    );
    markerSources.push(op.device_markers, op.markers, asExecuted.device_markers, asExecuted.markers, asExecuted.device_position);
    acceptanceSources.push(op.acceptance_points, op.acceptance?.points, op.acceptance?.spatial_points, op.acceptance?.acceptance_points);
    if (isGeoJsonLike(op.acceptance_geojson ?? op.acceptance?.geojson)) {
      acceptanceSources.push(asArray(op.acceptance_geojson ?? op.acceptance?.geojson).map((feature: any, featureIndex: number) => ({
        id: `${op.operation_id ?? op.operation_plan_id ?? index}_${featureIndex + 1}`,
        status: feature?.properties?.status ?? feature?.properties?.verdict ?? op.acceptance?.status ?? "UNKNOWN",
        lon: feature?.geometry?.coordinates?.[0],
        lat: feature?.geometry?.coordinates?.[1],
      })));
    }
  });

  const plannedGeoJson = combineGeoJson(plannedSources);
  const coverageGeoJson = combineGeoJson(coverageSources);
  const trajectorySegments = uniqueBy(
    trajectorySources.flatMap((source, index) => trajectorySegmentsFrom(source, `field_op_track_${index + 1}`)),
    (item) => `${item.id}:${item.coordinates.length}`,
  );
  const deviceMarkers = uniqueBy(
    markerSources.flatMap((source) => asArray(source)).map(markerFrom).filter((item): item is FieldMapMarkerVm => Boolean(item)),
    (item) => `${item.device_id}:${item.lat}:${item.lon}`,
  );
  const acceptancePoints = uniqueBy(
    acceptanceSources.flatMap((source) => asArray(source)).map(acceptancePointFrom).filter((item): item is FieldMapAcceptancePointVm => Boolean(item)),
    (item) => `${item.id}:${item.lat}:${item.lon}`,
  );
  const hasAnyOperationLayer = Boolean(plannedGeoJson || coverageGeoJson || trajectorySegments.length || acceptancePoints.length || deviceMarkers.length);
  const counts = [
    plannedGeoJson ? "计划区域" : "",
    coverageGeoJson ? "实际覆盖" : "",
    trajectorySegments.length ? `${trajectorySegments.length} 条轨迹` : "",
    acceptancePoints.length ? `${acceptancePoints.length} 个验收点` : "",
    deviceMarkers.length ? `${deviceMarkers.length} 个设备点` : "",
  ].filter(Boolean).join("、");
  return {
    plannedGeoJson,
    coverageGeoJson,
    trajectorySegments,
    acceptancePoints,
    deviceMarkers,
    hasAnyOperationLayer,
    summaryText: counts ? `已接入：${counts}` : "暂无作业空间图层。",
  };
}

export function buildFieldReportVm(report: FieldReportDetailV1): FieldReportPageVm {
  const fieldId = report.field.field_id;
  const fieldName = String(report.field.field_name ?? "").trim();
  const title = fieldName || "地块名称待补充";
  const mapLayers = buildFieldMapLayers(report);


  const overview = {
    riskText: labelRiskLevel(report.overview.current_risk_level),
    openAlertsText: formatCount(report.overview.open_alerts_count),
    pendingAcceptanceText: formatCount(report.overview.pending_acceptance_count),
    totalOperationsText: formatCount(report.overview.total_operations_count),
    latestOperationText: formatDateTime(report.overview.latest_operation_at),
    estimatedCostText: formatCurrency(report.overview.estimated_total_cost),
    actualCostText: formatCurrency(report.overview.actual_total_cost),
  };

  const explainSummaryRaw = String(report.explain.human || "");
  const hasInvalidExecution = explainSummaryRaw.toUpperCase().includes("INVALID_EXECUTION") || (report.explain.top_reasons ?? []).some((x) => String(x ?? "").toUpperCase().includes("INVALID_EXECUTION"));
  const explain = {
    human: hasInvalidExecution ? "该地块存在执行异常，建议复核作业证据。" : sanitizeCustomerText(report.explain.human || "暂无状态解释"),
    topReasonsText: hasInvalidExecution
      ? ["执行异常，建议复核作业证据"]
      : ((report.explain.top_reasons ?? []).length ? (report.explain.top_reasons ?? []).map((item) => sanitizeCustomerText(item)) : ["暂无主要依据"]),
  };
  const riskTone: "neutral" | "warning" | "danger" = overview.riskText.includes("高") ? "danger" : (overview.riskText.includes("中") ? "warning" : "neutral");
  const roiItems = Number(report.value_summary.total_roi_items ?? 0);
  const roiEmptyState = getCustomerEmptyState("NO_ROI");
  const fieldMemoryEmptyState = getCustomerEmptyState("NO_FIELD_MEMORY");
  const roiLines = [
    customerRoiLabel(report.value_summary.customer_value_text || `本地块已有 ${formatCount(report.value_summary.total_roi_items)} 条价值记录`),
    `节水 ${formatCount(report.value_summary.water_saved_items)} 条、节人工 ${formatCount(report.value_summary.labor_saved_items)} 条、预警 ${formatCount(report.value_summary.early_warning_items)} 条`,
    `可信度/假设：低置信 ${formatCount(report.value_summary.low_confidence_items)} 条，假设型 ${formatCount(report.value_summary.assumption_based_items)} 条`,
  ];
  const fieldMemorySummary = (report as any).field_memory_summary;
  const fieldMemoryAvailable = Boolean(
    fieldMemorySummary
    && (
      (Array.isArray(fieldMemorySummary.entries) && fieldMemorySummary.entries.length > 0)
      || (Array.isArray(fieldMemorySummary.items) && fieldMemorySummary.items.length > 0)
      || (typeof fieldMemorySummary.summary_text === "string" && fieldMemorySummary.summary_text.trim().length > 0)
      || fieldMemorySummary.available === true
    )
  );
  const fieldMemoryLines = fieldMemoryAvailable
    ? [
      ...(Array.isArray(fieldMemorySummary?.entries)
        ? fieldMemorySummary.entries.map((item: any) => sanitizeCustomerText(item?.summary_text ?? item?.text ?? item?.title ?? item?.label ?? ""))
        : []),
      ...(Array.isArray(fieldMemorySummary?.items)
        ? fieldMemorySummary.items.map((item: any) => sanitizeCustomerText(item?.summary_text ?? item?.text ?? item?.title ?? item?.label ?? ""))
        : []),
      ...(typeof fieldMemorySummary?.summary_text === "string" ? [sanitizeCustomerText(fieldMemorySummary.summary_text)] : []),
    ].filter((line) => line.length > 0)
    : [];

  const totalDevices = Number(report.device_summary.total_devices ?? 0);
  const onlineDevices = Number(report.device_summary.online_devices ?? 0);
  const offlineDevices = Number(report.device_summary.offline_devices ?? 0);
  const deviceSummary = {
    totalText: totalDevices > 0 ? formatCount(totalDevices) : "暂无设备状态摘要",
    onlineText: totalDevices > 0 ? formatCount(onlineDevices) : "暂无设备状态摘要",
    offlineText: totalDevices > 0 ? formatCount(offlineDevices) : "暂无设备状态摘要",
    lastUpdateText: formatDateTime(report.device_summary.last_telemetry_at),
  };

  const nextAction = report.next_action ? {
    title: labelOperationType(report.next_action.action_type || "建议执行下一步动作"),
    explainText: sanitizeCustomerText(report.next_action.explain_human || "暂无建议说明"),
    objectiveText: sanitizeCustomerText(report.next_action.objective_text || "暂无目标"),
    priorityText: sanitizeCustomerText(report.next_action.priority || "普通"),
  } : null;

  return {
    generatedAtText: formatDateTime(report.generated_at),
    field: {
      fieldId,
      fieldName: title,
      cropText: "暂无作物信息",
      stageText: "暂无阶段信息",
      updatedAtText: formatDateTime(report.device_summary.last_telemetry_at),
    },
    risk: { levelLabel: overview.riskText, tone: riskTone, reasons: explain.topReasonsText },
    diagnosis: {
      headline: explain.human,
      evidenceLines: explain.topReasonsText,
      dataQualityText: report.value_summary.low_confidence_items > 0 ? "数据质量需复核" : "数据质量可用",
      latestObservationText: report.overview.latest_operation_at
        ? `最近一次作业观测时间：${formatDateTime(report.overview.latest_operation_at)}`
        : `最近遥测更新时间：${formatDateTime(report.device_summary.last_telemetry_at)}`,
    },
    recommendations: nextAction
      ? [{ title: nextAction.title, summary: nextAction.explainText, href: `/customer/fields/${encodeURIComponent(fieldId)}` }]
      : [],
    recentOperations: report.recent_operations.slice(0, 5).map((item) => {
      // customer-boundary-allow: 兼容旧 operation_plan_id，确保历史数据可跳转
      const operationId = String(item.operation_plan_id || item.operation_id || "").trim();
      const finalStatusRaw = String(item.final_status || "").toUpperCase();
      const evidenceText = ["EVIDENCE_MISSING", "NOT_AVAILABLE"].includes(finalStatusRaw) ? "证据缺失" : "证据已回传";
      return {
        operationId,
        title: sanitizeCustomerText(item.customer_title || item.title || "作业"),
        statusText: labelFinalStatus(item.final_status),
        acceptanceText: labelAcceptanceStatus(item.acceptance_status),
        evidenceText,
        updatedAtText: formatDateTime(item.generated_at),
        href: operationId ? `/customer/operations/${encodeURIComponent(operationId)}` : "/customer/dashboard",
      };
    }),
    roiSummary: roiItems > 0
      ? {
        title: "价值记录摘要",
        lines: roiLines,
        displayText: roiLines.join("；"),
      }
      : { title: customerRoiLabel("ROI_UNAVAILABLE"), description: roiEmptyState.description, displayText: `${customerRoiLabel("ROI_UNAVAILABLE")}：${roiEmptyState.description}` },
    fieldMemory: fieldMemoryAvailable && fieldMemoryLines.length > 0
      ? {
        title: "田块记忆摘要",
        lines: fieldMemoryLines,
        displayText: fieldMemoryLines.join("；"),
      }
      : { title: customerFieldMemoryLabel("FIELD_MEMORY_UNAVAILABLE"), description: fieldMemoryEmptyState.description, displayText: `${customerFieldMemoryLabel("FIELD_MEMORY_UNAVAILABLE")}：${fieldMemoryEmptyState.description}` },
    mapLayers,
    exportHref: `/customer/fields/${encodeURIComponent(fieldId)}/export`,
    hero: {
      title,
      subtitle: "聚焦当前诊断、作业与下一步执行建议",
    },
    landOverview: [
      { label: "风险等级", value: overview.riskText },
      { label: "未关闭告警", value: formatCount(report.overview.open_alerts_count) },
      { label: "待验收作业", value: formatCount(report.overview.pending_acceptance_count) },
      { label: "作业总数", value: formatCount(report.overview.total_operations_count) },
      { label: "最近作业时间", value: formatDateTime(report.overview.latest_operation_at) },
      { label: "预计总成本", value: formatCurrency(report.overview.estimated_total_cost) },
      { label: "实际总成本", value: formatCurrency(report.overview.actual_total_cost) },
    ],
    diagnosticCards: [
      { title: "数据可信", value: report.value_summary.low_confidence_items > 0 ? "需复核" : "较可靠", detail: `低置信证据 ${formatCount(report.value_summary.low_confidence_items)} 条` },
      { title: "土壤水分", value: report.value_summary.water_saved_items > 0 ? "有节水证据" : "待补充", detail: `节水相关价值项 ${formatCount(report.value_summary.water_saved_items)} 条` },
      { title: "外部扰动", value: report.overview.open_alerts_count > 0 ? "存在待处理事项" : "暂无明显扰动", detail: `当前未关闭告警 ${formatCount(report.overview.open_alerts_count)} 条` },
      { title: "作物阶段", value: report.next_action?.objective_text ? "按目标推进" : "阶段信息不足", detail: String(report.next_action?.objective_text || "暂无作物阶段目标描述") },
      { title: "历史表现", value: report.overview.total_operations_count > 0 ? "有历史记录" : "暂无历史", detail: `累计作业 ${formatCount(report.overview.total_operations_count)} 次` },
    ],
    currentStatus: {
      summary: explain.human,
      reasons: explain.topReasonsText,
    },
    recentOperationsTop5: report.recent_operations.slice(0, 5).map((item) => {
      // customer-boundary-allow: 兼容旧 operation_plan_id，确保历史数据可跳转
      const operationId = String(item.operation_plan_id || item.operation_id || "").trim();
      return {
        id: operationId || "待生成",
        title: sanitizeCustomerText(item.customer_title || item.title || "未命名作业"),
        statusText: labelFinalStatus(item.final_status),
        acceptanceText: labelAcceptanceStatus(item.acceptance_status),
        generatedAtText: formatDateTime(item.generated_at),
        href: operationId ? `/customer/operations/${encodeURIComponent(operationId)}` : "/customer/dashboard",
      };
    }),
    prescriptionCards: [
      { title: "建议动作", value: labelOperationType(report.next_action?.action_type || "IRRIGATE"), detail: "建议优先执行关键风险处置动作" },
      { title: "建议剂量", value: "按当前处方执行", detail: "如有投入品请遵循作业报告中的剂量配置" },
      { title: "时间窗口", value: "24–72 小时内", detail: "建议在下一个可作业窗口完成" },
      { title: "审批要求", value: report.overview.pending_acceptance_count > 0 ? "需负责人确认" : "常规审批", detail: report.overview.pending_acceptance_count > 0 ? `需负责人确认 + 原因：当前待验收作业 ${formatCount(report.overview.pending_acceptance_count)} 项` : "按常规审批流程执行" },
      { title: "验收条件", value: "完成并回传证据", detail: "需提交执行记录、结果照片或监测数据" },
    ],
    deviceMonitoring: [
      { label: "设备总数", value: formatCount(report.device_summary.total_devices) },
      { label: "在线设备", value: formatCount(report.device_summary.online_devices) },
      { label: "离线设备", value: formatCount(report.device_summary.offline_devices) },
      { label: "最近更新", value: formatDateTime(report.device_summary.last_telemetry_at) },
    ],
    header: { title, subtitle: "地块病历摘要", fieldId },
    overview,
    explain,
    deviceSummary,
    nextAction,
  };
}
