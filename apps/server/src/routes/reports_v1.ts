import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { enforceFieldScopeOrDeny, enforceOperationFieldScope, hasFieldAccess } from "../auth/route_role_authz.js";
import { projectOperationStateV1, type OperationStateV1 } from "../projections/operation_state_v1.js";
import {
  projectOperationReportV1,
  type OperationReportSingleResponseV1,
  type OperationReportV1,
} from "../projections/report_v1.js";
import { buildOperationEvidencePackSummaryV1 } from "../projections/operation_evidence_summary_v1.js";
import { buildGuardedOperationReportV1 } from "../projections/guarded_operation_report_projector_v1.js";
import { projectFieldReportDetailV1, type FieldReportDetailV1 } from "../projections/report_dashboard_v1.js";
import { normalizeReceiptEvidence } from "../services/receipt_evidence.js";
import { computeOperationCostV1 } from "../domain/cost_model.js";
import { toCustomerFacingActionLabel } from "../domain/controlplane/irrigation_action_mapping_v1.js";
import { listAlertOperationRelationV1ByOperation, listOperationWorkflowV1 } from "./alert_workflow_v1.js";
import { buildSamplingReportViewV1 } from "../services/sampling/sampling_projection_v1.js";
import { buildFertilizationReportProjectionV1 } from "../services/fertilization/fertilization_projection_v1.js";
import { buildPestDiseaseInspectionReportProjectionV1 } from "../services/inspection/pest_disease_inspection_projection_v1.js";
import { getLatestWeatherForecastIndexV1, type WeatherForecastIndexV1 } from "../projections/weather_forecast_v1.js";
import { getLatestIrrigationRequirementIndexV1, type IrrigationRequirementIndexV1 } from "../projections/irrigation_requirement_v1.js";
import { getIrrigationRequirementSkillInputIndexV1 } from "../projections/irrigation_requirement_skill_input_v1.js";
import { buildIrrigationDecisionReportV1 } from "../projections/irrigation_decision_report_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
type FactRow = { fact_id: string; occurred_at: string; record_json: any };

function toText(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t || null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function parseRecordJson(v: unknown): any {
  if (v && typeof v === "object") return v;
  if (typeof v !== "string" || !v.trim()) return null;
  try { return JSON.parse(v); } catch { return null; }
}

function tenantFromReq(req: any, auth: any): TenantTriple {
  const q = req.query ?? {};
  return {
    tenant_id: String(q.tenant_id ?? auth.tenant_id),
    project_id: String(q.project_id ?? auth.project_id),
    group_id: String(q.group_id ?? auth.group_id),
  };
}

function requireTenantMatchOr404(auth: TenantTriple, tenant: TenantTriple, reply: any): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

async function queryFactsForOperation(pool: Pool, tenant: TenantTriple, operationPlanId: string): Promise<FactRow[]> {
  const q = await pool.query(
    `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
       FROM facts
      WHERE (
          (record_json::jsonb#>>'{payload,tenant_id}') = $1
          OR (record_json::jsonb->>'tenant_id') = $1
        )
        AND (
          (record_json::jsonb#>>'{payload,project_id}') = $2
          OR (record_json::jsonb->>'project_id') = $2
        )
        AND (
          (record_json::jsonb#>>'{payload,group_id}') = $3
          OR (record_json::jsonb->>'group_id') = $3
        )
        AND (
          (record_json::jsonb#>>'{payload,operation_plan_id}') = $4
          OR (record_json::jsonb#>>'{payload,operation_id}') = $4
          OR (record_json::jsonb->>'operation_plan_id') = $4
          OR (record_json::jsonb->>'operation_id') = $4
          OR (record_json::jsonb->>'act_task_id') = $4
          OR (record_json::jsonb->>'receipt_id') = $4
        )
      ORDER BY occurred_at ASC, fact_id ASC`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, operationPlanId]
  ).catch(() => ({ rows: [] as any[] }));
  return (q.rows ?? []).map((row: any) => ({
    fact_id: String(row.fact_id ?? ""),
    occurred_at: String(row.occurred_at ?? ""),
    record_json: parseRecordJson(row.record_json) ?? row.record_json,
  }));
}

async function queryFactsByTypeAndPayloadKey(
  pool: Pool,
  tenant: TenantTriple,
  type: string,
  keyPath: string,
  keyValue: string,
): Promise<FactRow[]> {
  const q = await pool.query(
    `SELECT fact_id, occurred_at, record_json::jsonb AS record_json
       FROM facts
      WHERE (record_json::jsonb->>'type') = $1
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
        AND (record_json::jsonb#>>'{payload,project_id}') = $3
        AND (record_json::jsonb#>>'{payload,group_id}') = $4
        AND (record_json::jsonb#>>'{payload,${keyPath}}') = $5
      ORDER BY occurred_at ASC, fact_id ASC`,
    [type, tenant.tenant_id, tenant.project_id, tenant.group_id, keyValue],
  ).catch(() => ({ rows: [] as any[] }));
  return (q.rows ?? []).map((row: any) => ({
    fact_id: String(row.fact_id ?? ""),
    occurred_at: String(row.occurred_at ?? ""),
    record_json: parseRecordJson(row.record_json) ?? row.record_json,
  }));
}

function latestByType(facts: FactRow[], type: string): FactRow | null {
  return [...facts].reverse().find((item) => String(item.record_json?.type ?? "") === type) ?? null;
}

function latestEvidenceSummaryFact(facts: FactRow[]): FactRow | null {
  const types = new Set(["operation_evidence_summary_v1", "evidence_pack_summary_v1"]);
  return [...facts].reverse().find((item) => types.has(String(item.record_json?.type ?? ""))) ?? null;
}

function normalizeApprovalStatus(rawDecision: unknown, hasRequest: boolean): string {
  const decision = String(rawDecision ?? "").trim().toUpperCase();
  if (decision === "APPROVE" || decision === "APPROVED" || decision === "PASS") return "APPROVED";
  if (decision === "REJECT" || decision === "REJECTED" || decision === "FAIL") return "REJECTED";
  return hasRequest ? "PENDING" : "NOT_REQUIRED";
}

function deriveOperationTitle(actionType: unknown): string | null {
  const raw = String(actionType ?? "").trim();
  if (!raw) return null;
  const actionLabel = toCustomerFacingActionLabel(raw);
  return actionLabel === "执行" ? "田间作业" : `${actionLabel}作业`;
}

function ensureReportV1ExtendedFields(report: OperationReportV1): OperationReportV1 {
  return {
    ...report,
    approval: report.approval ?? { status: null, actor_id: null, actor_name: null, generated_at: null, approved_at: null, note: null },
    why: report.why ?? { explain_human: null, objective_text: null },
    diagnostic_inputs: (report as any).diagnostic_inputs ?? { field_id: report.identifiers.field_id ?? null, devices: [], observations: [], diagnosis: { human: report.why?.explain_human ?? null } },
    weather_summary: (report as any).weather_summary ?? buildWeatherSummaryForReportV1(report),
    irrigation_requirement_summary: (report as any).irrigation_requirement_summary ?? null,
    operation_title: report.operation_title ?? null,
    customer_title: report.customer_title ?? report.operation_title ?? null,
    as_executed: (report as any).as_executed ?? {
      operation_id: report.identifiers.operation_id,
      execution_mode: "HUMAN",
      started_at: null,
      finished_at: null,
      actual_params: {},
      receipt_id: report.identifiers.receipt_id ?? null,
      device_id: null,
      operator_id: null,
      deviation_summary: null,
    },
    as_applied: (report as any).as_applied ?? {
      operation_id: report.identifiers.operation_id,
      coverage_status: "MISSING",
      coverage_geojson: null,
      planned_geojson: null,
      applied_amount_summary: null,
      planned_vs_actual_deviation: null,
      evidence_ref: null,
    },
    field_memory: (report as any).field_memory ?? { field_response_memory: [], device_reliability_memory: [], skill_performance_memory: [] },
    roi_ledger: (report as any).roi_ledger ?? {
      summary: { total_items: 0, measured_items: 0, estimated_items: 0, assumption_based_items: 0, insufficient_items: 0, low_confidence_items: 0, has_customer_visible_value: false },
      items: [], water_saved: [], labor_saved: [], early_warning_lead_time: [], first_pass_acceptance_rate: [], low_confidence_items: [],
    },
  };
}

function toFiniteNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildFieldResponseSummaryText(row: any): string {
  const before = toFiniteNumberOrNull(row?.before_value);
  const after = toFiniteNumberOrNull(row?.after_value);
  const delta = toFiniteNumberOrNull(row?.delta_value) ?? (before != null && after != null ? Number((after - before).toFixed(2)) : null);
  if (before == null || after == null || delta == null) return String(row?.summary_text ?? "").trim() || "灌后响应已记录";
  const deltaText = `${delta >= 0 ? "+" : ""}${Number(delta.toFixed(2)).toString()}`;
  return `土壤湿度从 ${before}% 回升到 ${after}%，变化 ${deltaText} 个百分点`;
}

function normalizeFieldMemoryRow(row: any): any {
  const before = toFiniteNumberOrNull(row?.before_value);
  const after = toFiniteNumberOrNull(row?.after_value);
  const delta = toFiniteNumberOrNull(row?.delta_value) ?? (before != null && after != null ? Number((after - before).toFixed(2)) : null);
  return {
    ...row,
    before_value: before,
    after_value: after,
    delta_value: delta,
    summary_text: String(row?.summary_text ?? "").trim() || (row?.memory_type === "FIELD_RESPONSE_MEMORY" ? buildFieldResponseSummaryText(row) : "田间记忆已记录"),
    customer_text: row?.memory_type === "FIELD_RESPONSE_MEMORY" ? buildFieldResponseSummaryText({ ...row, delta_value: delta }) : undefined,
  };
}

function buildResponseTimeMs(state: OperationStateV1, executionStartedAt: string | null): number | null {
  const dispatchedTs = state.timeline.find((item) => item.type === "TASK_CREATED")?.ts ?? null;
  const executionStartedTs = executionStartedAt ? Date.parse(executionStartedAt) : NaN;
  if (dispatchedTs == null || !Number.isFinite(executionStartedTs)) return null;
  return Math.max(0, executionStartedTs - dispatchedTs);
}

function toIsoFromEpochMs(v: unknown): string | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return new Date(n).toISOString();
}


type DiagnosticInputsForReportV1 = NonNullable<OperationReportV1["diagnostic_inputs"]>;

function parseJsonArrayMaybe(v: unknown): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v !== "string" || !v.trim()) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeDiagnosticMetric(metric: unknown): string | null {
  const raw = String(metric ?? "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (["soil_moisture", "soil_moisture_pct", "soil_moisture_vwc", "moisture_pct"].includes(lower)) return "soil_moisture_percent";
  if (["soil_moisture_after", "soil_moisture_after_pct", "after_soil_moisture", "after_soil_moisture_percent"].includes(lower)) return "soil_moisture_after_percent";
  if (lower === "forecast_rain_72h" || lower === "forecast_rain_72h_mm" || lower === "rain_forecast_72h_mm") return "forecast_rain_72h_mm";
  if (lower === "temperature_max" || lower === "temperature_max_c" || lower === "max_temperature_c") return "temperature_max_c";
  return raw;
}

function labelForDiagnosticMetric(metric: string): string {
  if (metric === "soil_moisture_percent") return "20cm 土层水分";
  if (metric === "forecast_rain_72h_mm") return "未来 72 小时降雨";
  if (metric === "temperature_max_c") return "\u6700\u9ad8\u6c14\u6e29";
  if (metric === "soil_moisture_after_percent") return "\u704c\u540e 20cm \u571f\u5c42\u6c34\u5206";
  return metric;
}

function capabilityForDiagnosticMetric(metric: string | null, capabilities: any[]): string | null {
  const normalizedCaps = capabilities.map((item) => String(item ?? "").trim()).filter(Boolean);
  if (metric === "soil_moisture_percent" || metric === "soil_moisture_after_percent") return normalizedCaps.find((cap) => cap.includes("soil_moisture")) ?? "soil_moisture_sensor";
  if (metric === "forecast_rain_72h_mm") return normalizedCaps.find((cap) => cap.includes("weather") || cap.includes("rain")) ?? "weather_sensor";
  if (metric === "temperature_max_c") return normalizedCaps.find((cap) => cap.includes("weather") || cap.includes("temperature")) ?? "weather_station";
  return normalizedCaps[0] ?? null;
}

function unitForDiagnosticMetric(metric: string, fallback: unknown): string | null {
  if (metric === "soil_moisture_percent") return "%";
  if (metric === "soil_moisture_after_percent") return "%";
  if (metric === "forecast_rain_72h_mm") return "mm";
  if (metric === "temperature_max_c") return "\u2103";
  return toText(fallback);
}

function pickRecommendationDiagnosticNumber(recommendationPayload: any, keys: string[]): number | null {
  const candidates = [
    recommendationPayload,
    recommendationPayload?.diagnostic_inputs,
    recommendationPayload?.diagnosis,
    recommendationPayload?.weather,
    recommendationPayload?.current_metrics,
    recommendationPayload?.inputs,
    recommendationPayload?.skill_trace?.inputs,
  ];
  for (const source of candidates) {
    for (const key of keys) {
      const value = toFiniteNumberOrNull(source?.[key]);
      if (value != null) return value;
    }
  }
  return null;
}

function roleForDiagnosticMetric(metric: string): DiagnosticInputsForReportV1["observations"][number]["role"] {
  if (metric === "temperature_max_c") return "agronomy_context";
  if (metric === "soil_moisture_after_percent") return "acceptance_input";
  return "diagnosis_input";
}

function diagnosticObservationNumber(report: OperationReportV1, metric: string): number | null {
  const observations = Array.isArray((report as any)?.diagnostic_inputs?.observations)
    ? (report as any).diagnostic_inputs.observations
    : [];
  for (const observation of observations) {
    if (String(observation?.metric ?? "").trim() !== metric) continue;
    const n = typeof observation?.value === "number" ? observation.value : Number(observation?.value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function buildWeatherSummaryFromValuesForReportV1(
  rainfallForecastMm: number | null,
  maxTemperatureC: number | null,
  source: {
    weather_forecast_id?: string | null;
    source_quality?: NonNullable<OperationReportV1["weather_summary"]>["source_quality"];
  } = {},
): OperationReportV1["weather_summary"] {
  if (rainfallForecastMm == null && maxTemperatureC == null) {
    return null;
  }

  const rainfallNarrative = rainfallForecastMm == null
    ? "未来72小时降雨数据暂未形成正式诊断输入。"
    : rainfallForecastMm <= 5
      ? `未来72小时预计降雨仅${rainfallForecastMm}mm，不足以恢复目标土壤水分，支持本次补灌判断。`
      : `未来72小时预计降雨${rainfallForecastMm}mm，需要结合现场土壤水分继续复核。`;

  const temperatureNarrative = maxTemperatureC == null
    ? null
    : maxTemperatureC >= 30
      ? `最高气温${maxTemperatureC}℃，蒸散压力偏高，需要纳入灌溉判断。`
      : `最高气温${maxTemperatureC}℃，天气背景已纳入灌溉判断。`;

  return {
    rainfall_forecast_mm: rainfallForecastMm,
    max_temperature_c: maxTemperatureC,
    narrative: [rainfallNarrative, temperatureNarrative].filter(Boolean).join(" "),
    weather_forecast_id: source.weather_forecast_id ?? null,
    source_quality: source.source_quality ?? null,
  };
}

function diagnosticInputObservationNumber(diagnosticInputs: DiagnosticInputsForReportV1 | undefined | null, metric: string): number | null {
  const observations = Array.isArray(diagnosticInputs?.observations)
    ? diagnosticInputs.observations
    : [];
  for (const observation of observations) {
    if (String(observation?.metric ?? "").trim() !== metric) continue;
    const n = typeof observation?.value === "number" ? observation.value : Number(observation?.value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function buildWeatherSummaryFromDiagnosticInputsForReportV1(diagnosticInputs: DiagnosticInputsForReportV1 | undefined | null): OperationReportV1["weather_summary"] {
  return buildWeatherSummaryFromValuesForReportV1(
    diagnosticInputObservationNumber(diagnosticInputs, "forecast_rain_72h_mm"),
    diagnosticInputObservationNumber(diagnosticInputs, "temperature_max_c"),
  );
}

function buildWeatherSummaryFromWeatherForecastIndexV1(forecast: WeatherForecastIndexV1 | null): OperationReportV1["weather_summary"] {
  if (!forecast) return null;
  const quality = forecast.quality && typeof forecast.quality === "object" ? forecast.quality as any : {};
  return buildWeatherSummaryFromValuesForReportV1(
    toFiniteNumberOrNull(forecast.rainfall_forecast_mm_72h),
    toFiniteNumberOrNull(forecast.temperature_max_c_72h),
    {
      weather_forecast_id: toText(forecast.forecast_id),
      source_quality: {
        provider: toText(forecast.provider),
        source_type: toText(forecast.source_type),
        provider_status: toText(quality.provider_status),
        stale: typeof quality.stale === "boolean" ? quality.stale : null,
        missing_fields: Array.isArray(quality.missing_fields) ? quality.missing_fields.map((x: unknown) => String(x)) : [],
      },
    },
  );
}


function buildIrrigationRequirementNarrative(requirement: IrrigationRequirementIndexV1): string | null {
  const gross = toFiniteNumberOrNull(requirement.gross_irrigation_requirement_mm ?? requirement.gross_irrigation_mm);
  const target = toFiniteNumberOrNull(requirement.target_soil_moisture_percent);
  const rootZone = toFiniteNumberOrNull(requirement.root_zone_soil_moisture_percent);
  if (gross == null) return null;
  const rootZoneText = rootZone == null ? "" : `???????${rootZone}%?`;
  const targetText = target == null ? "" : `?????${target}%?`;
  return `${rootZoneText}${targetText}???????${gross}mm?`;
}

function buildIrrigationRequirementSummaryFromIndexV1(
  requirement: IrrigationRequirementIndexV1 | null,
  reportFieldId: string | null,
  weatherForecastId: string | null,
): OperationReportV1["irrigation_requirement_summary"] {
  if (!requirement) return null;

  const quality = requirement.quality && typeof requirement.quality === "object" ? requirement.quality as any : {};
  const requirementForecastId = toText(requirement.source_forecast_id);
  const requirementFieldId = toText(requirement.field_id);
  const reportField = toText(reportFieldId);
  const forecast = toText(weatherForecastId);
  const requirementToForecast = Boolean(requirementForecastId && forecast && requirementForecastId === forecast);
  const requirementToField = Boolean(requirementFieldId && reportField && requirementFieldId === reportField);
  const reportBindingStatus = requirementToForecast || !forecast ? "BOUND" : "FORECAST_MISMATCH";

  return {
    requirement_id: toText(requirement.requirement_id),
    source_forecast_id: requirementForecastId,
    source_fact_id: toText(requirement.source_fact_id),
    source_observation_refs: Array.isArray(requirement.source_observation_refs) ? requirement.source_observation_refs.map(String).filter(Boolean) : [],
    skill_id: toText(requirement.skill_id),
    skill_version: toText(requirement.skill_version),
    skill_run_id: toText(requirement.skill_run_id),
    field_id: requirementFieldId,
    season_id: toText(requirement.season_id),
    crop_code: toText(requirement.crop_code),
    crop_stage: toText(requirement.crop_stage),
    root_zone_soil_moisture_percent: toFiniteNumberOrNull(requirement.root_zone_soil_moisture_percent),
    target_soil_moisture_percent: toFiniteNumberOrNull(requirement.target_soil_moisture_percent),
    target_min_soil_moisture_percent: toFiniteNumberOrNull(requirement.target_min_soil_moisture_percent),
    target_max_soil_moisture_percent: toFiniteNumberOrNull(requirement.target_max_soil_moisture_percent),
    rainfall_forecast_mm_72h: toFiniteNumberOrNull(requirement.rainfall_forecast_mm_72h),
    effective_rainfall_mm_72h: toFiniteNumberOrNull(requirement.effective_rainfall_mm_72h),
    temperature_max_c_72h: toFiniteNumberOrNull(requirement.temperature_max_c_72h),
    net_irrigation_mm: toFiniteNumberOrNull(requirement.net_irrigation_mm),
    gross_irrigation_mm: toFiniteNumberOrNull(requirement.gross_irrigation_mm),
    gross_irrigation_requirement_mm: toFiniteNumberOrNull(requirement.gross_irrigation_requirement_mm ?? requirement.gross_irrigation_mm),
    unit: toText(requirement.unit) ?? "mm",
    calculation_method: toText(requirement.calculation_method),
    calculation_inputs: requirement.calculation_inputs && typeof requirement.calculation_inputs === "object" ? requirement.calculation_inputs : {},
    derivation: requirement.derivation && typeof requirement.derivation === "object" ? requirement.derivation : {},
    source_quality: {
      status: toText(quality.status),
      source: toText(quality.source),
      deterministic: typeof quality.deterministic === "boolean" ? quality.deterministic : null,
      derivation_status: toText(quality.derivation_status),
      source_binding_status: toText(quality.source_binding_status),
      missing_fields: Array.isArray(quality.missing_fields) ? quality.missing_fields.map((x: unknown) => String(x)).filter(Boolean) : [],
    },
    binding: {
      requirement_to_forecast: requirementToForecast,
      requirement_to_field: requirementToField,
      report_binding_status: reportBindingStatus,
    },
    narrative: buildIrrigationRequirementNarrative(requirement),
  };
}

function buildWeatherSummaryForReportV1(report: OperationReportV1): OperationReportV1["weather_summary"] {
  return buildWeatherSummaryFromDiagnosticInputsForReportV1((report as any).diagnostic_inputs);
}

function hasDeviceCapability(capabilities: string[], token: string): boolean {
  return capabilities.some((cap) => cap.includes(token));
}

function displayKindTextForDiagnosticDevice(capabilities: string[]): string | null {
  if (hasDeviceCapability(capabilities, "soil_moisture")) return "\u571f\u58e4\u6c34\u5206\u4f20\u611f\u5668";
  if (hasDeviceCapability(capabilities, "weather") || hasDeviceCapability(capabilities, "rain")) return "\u5fae\u578b\u6c14\u8c61\u7ad9";
  if (hasDeviceCapability(capabilities, "pump") || hasDeviceCapability(capabilities, "valve")) return "\u9600\u95e8\u6cf5\u7ad9\u63a7\u5236\u5668";
  return null;
}

function sensingRoleTextForDiagnosticDevice(capabilities: string[]): string | null {
  if (hasDeviceCapability(capabilities, "soil_moisture")) return "20cm \u571f\u5c42\u6c34\u5206\u76d1\u6d4b";
  if (hasDeviceCapability(capabilities, "weather") || hasDeviceCapability(capabilities, "rain")) return "\u5929\u6c14\u4e0e\u964d\u96e8\u9884\u62a5";
  if (hasDeviceCapability(capabilities, "pump") || hasDeviceCapability(capabilities, "valve")) return "\u704c\u6e89\u6267\u884c\u4e0e\u56de\u6267";
  return null;
}

function capabilityTextForDiagnosticDevice(capabilities: string[]): string | null {
  if (hasDeviceCapability(capabilities, "soil_moisture")) return "\u76d1\u6d4b\u571f\u58e4\u6c34\u5206\uff0c\u63d0\u4f9b\u704c\u6e89\u8bca\u65ad\u8f93\u5165";
  if (hasDeviceCapability(capabilities, "weather") || hasDeviceCapability(capabilities, "rain")) return "\u63d0\u4f9b\u672a\u6765\u964d\u96e8\u4e0e\u6e29\u5ea6\u8f93\u5165";
  if (hasDeviceCapability(capabilities, "pump") || hasDeviceCapability(capabilities, "valve")) return "\u6267\u884c\u8865\u704c\u4efb\u52a1\u5e76\u8bb0\u5f55\u9600\u95e8\u4e0e\u6cf5\u7ad9\u8fd0\u884c";
  return null;
}

function contributedMetricsForDiagnosticDevice(capabilities: string[], metric: string | null): string[] {
  const out = new Set<string>();
  if (metric) out.add(metric);
  if (hasDeviceCapability(capabilities, "soil_moisture")) {
    out.add("soil_moisture_percent");
    out.add("soil_moisture_after_percent");
  }
  if (hasDeviceCapability(capabilities, "weather") || hasDeviceCapability(capabilities, "rain")) {
    out.add("forecast_rain_72h_mm");
    out.add("temperature_max_c");
  }
  return Array.from(out);
}

function fallbackDiagnosticObservationsFromRecommendation(recommendationPayload: any): DiagnosticInputsForReportV1["observations"] {
  const out: DiagnosticInputsForReportV1["observations"] = [];
  const soilMoisture = pickRecommendationDiagnosticNumber(recommendationPayload, ["soil_moisture_percent", "soil_moisture_pct", "soil_moisture", "moisture_pct"]);
  if (soilMoisture != null) {
    out.push({ metric: "soil_moisture_percent", label: labelForDiagnosticMetric("soil_moisture_percent"), value: soilMoisture, unit: "%", role: "diagnosis_input" });
  }
  const forecastRain = pickRecommendationDiagnosticNumber(recommendationPayload, ["forecast_rain_72h_mm", "forecast_rainfall_72h_mm", "rain_forecast_72h_mm"]);
  if (forecastRain != null) {
    out.push({ metric: "forecast_rain_72h_mm", label: labelForDiagnosticMetric("forecast_rain_72h_mm"), value: forecastRain, unit: "mm", role: "diagnosis_input" });
  }
  const temperatureMax = pickRecommendationDiagnosticNumber(recommendationPayload, ["temperature_max_c", "max_temperature_c", "temperature_max"]);
  if (temperatureMax != null) {
    out.push({ metric: "temperature_max_c", label: labelForDiagnosticMetric("temperature_max_c"), value: temperatureMax, unit: "\u2103", role: "agronomy_context" });
  }
  const soilMoistureAfter = pickRecommendationDiagnosticNumber(recommendationPayload, ["soil_moisture_after_percent", "soil_moisture_after_pct", "after_soil_moisture_percent"]);
  if (soilMoistureAfter != null) {
    out.push({ metric: "soil_moisture_after_percent", label: labelForDiagnosticMetric("soil_moisture_after_percent"), value: soilMoistureAfter, unit: "%", role: "acceptance_input" });
  }
  return out;
}

async function buildDiagnosticInputsForReportV1(params: {
  pool: Pool;
  tenant: TenantTriple;
  field_id: string | null;
  recommendation_payload: any;
  diagnosis_human: string | null;
}): Promise<DiagnosticInputsForReportV1> {
  const { pool, tenant, field_id, recommendation_payload, diagnosis_human } = params;
  const empty: DiagnosticInputsForReportV1 = { field_id, devices: [], observations: fallbackDiagnosticObservationsFromRecommendation(recommendation_payload), diagnosis: { human: diagnosis_human } };
  if (!field_id) return empty;

  const deviceQ = await pool.query(
    `SELECT b.device_id,
            COALESCE(d.display_name, b.device_id) AS display_name,
            c.capabilities::jsonb AS capabilities,
            o.metric,
            o.value_num,
            o.unit,
            COALESCE(
              NULLIF(UPPER(BTRIM(s.status)), ''),
              CASE
                WHEN GREATEST(COALESCE(s.last_heartbeat_ts_ms, 0), COALESCE(s.last_telemetry_ts_ms, 0)) > 0 THEN 'ONLINE'
                ELSE 'UNKNOWN'
              END
            ) AS online_status,
            s.last_heartbeat_ts_ms,
            s.last_telemetry_ts_ms
       FROM device_binding_index_v1 b
       LEFT JOIN device_index_v1 d ON d.tenant_id = b.tenant_id AND d.device_id = b.device_id
       LEFT JOIN device_status_index_v1 s ON s.tenant_id = b.tenant_id AND s.project_id = $2 AND s.group_id = $3 AND s.device_id = b.device_id
       LEFT JOIN device_capability c ON c.tenant_id = b.tenant_id AND c.device_id = b.device_id
       LEFT JOIN LATERAL (
         SELECT metric, value_num, unit
           FROM device_observation_index_v1
          WHERE tenant_id = b.tenant_id
            AND project_id = $2
            AND group_id = $3
            AND field_id = b.field_id
            AND device_id = b.device_id
            AND metric IN ('soil_moisture_percent','soil_moisture','soil_moisture_pct','soil_moisture_vwc','moisture_pct','soil_moisture_after_percent','soil_moisture_after','soil_moisture_after_pct','after_soil_moisture','after_soil_moisture_percent','forecast_rain_72h_mm','forecast_rain_72h','rain_forecast_72h_mm','temperature_max_c','temperature_max','max_temperature_c')
          ORDER BY observed_at_ts_ms DESC
          LIMIT 1
       ) o ON true
      WHERE b.tenant_id = $1 AND b.field_id = $4
      ORDER BY b.bound_ts_ms DESC NULLS LAST, b.device_id ASC
      LIMIT 20`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, field_id],
  ).catch(() => ({ rows: [] as any[] }));

  const observationQ = await pool.query(
    `SELECT DISTINCT ON (metric) metric, value_num, unit, observed_at_ts_ms, device_id, fact_id
       FROM device_observation_index_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND field_id = $4
        AND metric IN ('soil_moisture_percent','soil_moisture','soil_moisture_pct','soil_moisture_vwc','moisture_pct','soil_moisture_after_percent','soil_moisture_after','soil_moisture_after_pct','after_soil_moisture','after_soil_moisture_percent','forecast_rain_72h_mm','forecast_rain_72h','rain_forecast_72h_mm','temperature_max_c','temperature_max','max_temperature_c')
      ORDER BY metric, observed_at_ts_ms DESC`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, field_id],
  ).catch(() => ({ rows: [] as any[] }));

  const devices = (deviceQ.rows ?? []).map((row: any) => {
    const metric = normalizeDiagnosticMetric(row.metric);
    const capabilities = parseJsonArrayMaybe(row.capabilities).map((item) => String(item ?? "").trim()).filter(Boolean);
    return {
      device_id: String(row.device_id ?? ""),
      display_name: toText(row.display_name) ?? String(row.device_id ?? ""),
      capability: capabilityForDiagnosticMetric(metric, capabilities),
      metric,
      value: toFiniteNumberOrNull(row.value_num),
      unit: metric ? unitForDiagnosticMetric(metric, row.unit) : toText(row.unit),
      field_id,
      display_kind_text: displayKindTextForDiagnosticDevice(capabilities),
      sensing_role_text: sensingRoleTextForDiagnosticDevice(capabilities),
      capabilities,
      capability_text: capabilityTextForDiagnosticDevice(capabilities),
      online_status: toText((row as any).online_status) ?? "UNKNOWN",
      last_heartbeat_ts_ms: toFiniteNumberOrNull((row as any).last_heartbeat_ts_ms),
      last_telemetry_ts_ms: toFiniteNumberOrNull((row as any).last_telemetry_ts_ms),
      contributed_metrics: contributedMetricsForDiagnosticDevice(capabilities, metric),
      data_sources: ["device_observation_index_v1", "telemetry_observation_v1"],
    };
  }).filter((item: any) => item.device_id);

  const observationByMetric = new Map<string, DiagnosticInputsForReportV1["observations"][number]>();
  for (const fallback of empty.observations) {
    if (!observationByMetric.has(fallback.metric)) observationByMetric.set(fallback.metric, fallback);
  }
  for (const row of observationQ.rows ?? []) {
    const metric = normalizeDiagnosticMetric((row as any).metric);
    if (!metric) continue;
    observationByMetric.set(metric, {
      metric,
      label: labelForDiagnosticMetric(metric),
      value: toFiniteNumberOrNull((row as any).value_num),
      unit: unitForDiagnosticMetric(metric, (row as any).unit),
      role: roleForDiagnosticMetric(metric),
      observed_at_ts_ms: toFiniteNumberOrNull((row as any).observed_at_ts_ms),
      source_device_id: toText((row as any).device_id),
      source_fact_id: toText((row as any).fact_id),
    });
  }

  return {
    field_id,
    devices,
    observations: Array.from(observationByMetric.values()),
    diagnosis: { human: diagnosis_human },
  };
}

type FieldReportDetailResponseV1 = { ok: true; field_report_v1: FieldReportDetailV1 };
const FIELD_REPORT_OPERATION_LIMIT = 20;


function objectFromJsonColumn(value: unknown): any {
  return parseRecordJson(value) ?? (value && typeof value === "object" ? value : {});
}

function buildFormalAmountSourceForReportV1(metadata: any): any | null {
  if (!metadata || typeof metadata !== "object") return null;
  const requirementId = toText(metadata.requirement_id ?? metadata.source_requirement_id);
  const sourceRequirementId = toText(metadata.source_requirement_id ?? metadata.requirement_id);
  const sourceType = toText(metadata.source_type);
  const sourceField = toText(metadata.source_field);
  const sourceFactId = toText(metadata.source_fact_id);
  const sourceValueMm = toFiniteNumberOrNull(metadata.source_value_mm);
  const traceId = toText(metadata.trace_id);
  if (!requirementId && !sourceRequirementId && !sourceType && !sourceField && !sourceFactId && sourceValueMm == null && !traceId) return null;
  return {
    source_type: sourceType,
    requirement_id: requirementId,
    source_requirement_id: sourceRequirementId,
    source_field: sourceField,
    source_fact_id: sourceFactId,
    source_value_mm: sourceValueMm,
    trace_id: traceId,
  };
}

function buildFormalAmountSourceFromRequirementSummaryForReportV1(summary: OperationReportV1["irrigation_requirement_summary"]): any | null {
  if (!summary) return null;
  const requirementId = toText(summary.requirement_id);
  const sourceFactId = toText(summary.source_fact_id);
  const gross = toFiniteNumberOrNull(summary.gross_irrigation_requirement_mm ?? summary.gross_irrigation_mm);
  const skillRunId = toText(summary.skill_run_id);
  if (!requirementId && !sourceFactId && gross == null && !skillRunId) return null;
  return {
    source_type: "irrigation_requirement_v1",
    requirement_id: requirementId,
    source_requirement_id: requirementId,
    source_field: "gross_irrigation_requirement_mm",
    source_fact_id: sourceFactId,
    source_value_mm: gross,
    trace_id: skillRunId,
  };
}

async function queryPrescriptionForReport(pool: Pool, tenant: TenantTriple, s: OperationStateV1): Promise<any | null> {
  const prescriptionId = toText((s as any).prescription_id);
  const recommendationId = toText(s.recommendation_id);
  if (!prescriptionId && !recommendationId) return null;
  const q = await pool.query(
    `SELECT prescription_id, operation_amount::jsonb AS operation_amount, operation_type
       FROM prescription_contract_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND (($4::text IS NOT NULL AND prescription_id = $4) OR ($5::text IS NOT NULL AND recommendation_id = $5))
      ORDER BY updated_at DESC, created_at DESC, prescription_id DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, prescriptionId, recommendationId],
  ).catch(() => ({ rows: [] as any[] }));
  const row = q.rows?.[0] ?? null;
  if (!row) return null;
  const amount = objectFromJsonColumn(row.operation_amount);
  return {
    prescription_id: toText(row.prescription_id),
    amount: toFiniteNumberOrNull(amount?.amount ?? amount?.value),
    unit: toText(amount?.unit),
    operation_type: toText(row.operation_type),
    amount_source: buildFormalAmountSourceForReportV1(amount?.metadata),
  };
}

async function queryAsExecutedForReport(pool: Pool, tenant: TenantTriple, s: OperationStateV1): Promise<any | null> {
  const asExecutedId = toText((s as any).as_executed_id);
  const taskId = toText(s.task_id ?? s.act_task_id);
  const receiptId = toText(s.receipt_id);
  const prescriptionId = toText((s as any).prescription_id);
  if (!asExecutedId && !taskId && !receiptId && !prescriptionId) return null;
  const q = await pool.query(
    `SELECT as_executed_id, planned::jsonb AS planned, executed::jsonb AS executed, deviation::jsonb AS deviation
       FROM as_executed_record_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND (
          ($4::text IS NOT NULL AND as_executed_id = $4)
          OR ($5::text IS NOT NULL AND task_id = $5)
          OR ($6::text IS NOT NULL AND receipt_id = $6)
          OR ($7::text IS NOT NULL AND prescription_id = $7)
        )
      ORDER BY updated_at DESC, created_at DESC, as_executed_id DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, asExecutedId, taskId, receiptId, prescriptionId],
  ).catch(() => ({ rows: [] as any[] }));
  const row = q.rows?.[0] ?? null;
  if (!row) return null;
  const planned = objectFromJsonColumn(row.planned);
  const executed = objectFromJsonColumn(row.executed);
  const deviationObj = objectFromJsonColumn(row.deviation);
  const plannedAmount = toFiniteNumberOrNull(planned?.amount);
  const executedAmount = toFiniteNumberOrNull(executed?.amount ?? executed?.observed_parameters?.amount);
  return {
    as_executed_id: toText(row.as_executed_id),
    planned_amount: plannedAmount,
    planned_amount_source: buildFormalAmountSourceForReportV1(planned?.planned_amount_source ?? planned?.amount_source),
    executed_amount: executedAmount,
    unit: toText(executed?.unit ?? planned?.unit),
    deviation: toFiniteNumberOrNull(deviationObj?.amount_delta) ?? (plannedAmount != null && executedAmount != null ? Number((executedAmount - plannedAmount).toFixed(4)) : null),
    status: toText(executed?.status),
  };
}

async function queryAsAppliedForReport(pool: Pool, tenant: TenantTriple, s: OperationStateV1, asExecuted: any | null): Promise<any | null> {
  const asExecutedId = toText(asExecuted?.as_executed_id ?? (s as any).as_executed_id);
  const taskId = toText(s.task_id ?? s.act_task_id);
  const receiptId = toText(s.receipt_id);
  const prescriptionId = toText((s as any).prescription_id);
  if (!asExecutedId && !taskId && !receiptId && !prescriptionId) return null;
  const q = await pool.query(
    `SELECT field_id, coverage::jsonb AS coverage, application::jsonb AS application
       FROM as_applied_map_v1
      WHERE tenant_id = $1
        AND project_id = $2
        AND group_id = $3
        AND (
          ($4::text IS NOT NULL AND as_executed_id = $4)
          OR ($5::text IS NOT NULL AND task_id = $5)
          OR ($6::text IS NOT NULL AND receipt_id = $6)
          OR ($7::text IS NOT NULL AND prescription_id = $7)
        )
      ORDER BY updated_at DESC, created_at DESC, as_applied_id DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, asExecutedId, taskId, receiptId, prescriptionId],
  ).catch(() => ({ rows: [] as any[] }));
  const row = q.rows?.[0] ?? null;
  if (!row) return null;
  const coverage = objectFromJsonColumn(row.coverage);
  const application = objectFromJsonColumn(row.application);
  return {
    coverage_percent: toFiniteNumberOrNull(coverage?.coverage_percent ?? application?.avg_coverage_percent ?? application?.coverage_percent),
    field_id: toText(row.field_id),
  };
}

async function queryRoiLedgerForReport(pool: Pool, tenant: TenantTriple, s: OperationStateV1): Promise<any[]> {
  const q = await pool.query(
    `SELECT * FROM roi_ledger_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
        AND (operation_id=$4 OR task_id=$5 OR prescription_id=$6)
      ORDER BY created_at DESC`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, s.operation_id, s.task_id ?? s.act_task_id ?? null, (s as any).prescription_id ?? null]
  ).catch(() => ({ rows: [] as any[] }));
  return q.rows ?? [];
}

function mergeFertilizationIntoReport(
  report: OperationReportV1,
  fertilization: NonNullable<OperationReportV1["fertilization"]> | null,
): OperationReportV1 {
  if (!fertilization) return report;
  const scenario = report.formal_scenario ?? {
    scenario_type: "UNKNOWN",
    formal_chain_status: "LIMITED",
    evidence_status: "MISSING",
    customer_visible_eligible: false,
    needs_review: true,
    blocking_reasons: [],
  };
  const blockingReasons = Array.from(new Set([
    ...(Array.isArray(scenario.blocking_reasons) ? scenario.blocking_reasons : []),
    ...(Array.isArray(fertilization.blocking_reasons) ? fertilization.blocking_reasons : []),
  ].map((x) => String(x ?? "").trim()).filter(Boolean)));
  return {
    ...report,
    fertilization,
    formal_scenario: {
      scenario_type: "FORMAL_FERTILIZATION",
      formal_chain_status: fertilization.customer_visible_eligible ? "PASSED" : (fertilization.acceptance_status === "MISSING" ? "LIMITED" : "NEEDS_REVIEW"),
      evidence_status: fertilization.evidence_tier === "FORMAL" ? "FORMAL_PASSED" : (fertilization.evidence_tier === "WARNING" ? "TECHNICAL_ONLY" : "MISSING"),
      customer_visible_eligible: Boolean(fertilization.customer_visible_eligible),
      needs_review: !fertilization.customer_visible_eligible,
      blocking_reasons: blockingReasons,
    },
  };
}

function mergePestDiseaseInspectionIntoReport(
  report: OperationReportV1,
  pestDiseaseInspection: NonNullable<OperationReportV1["pest_disease_inspection"]> | null,
): OperationReportV1 {
  if (!pestDiseaseInspection) return report;

  const scenario = report.formal_scenario ?? {
    scenario_type: "UNKNOWN",
    formal_chain_status: "LIMITED",
    evidence_status: "MISSING",
    customer_visible_eligible: false,
    needs_review: true,
    blocking_reasons: [],
  };
  const blockingReasons = Array.from(new Set([
    ...(Array.isArray(scenario.blocking_reasons) ? scenario.blocking_reasons : []),
    ...(Array.isArray(pestDiseaseInspection.blocking_reasons) ? pestDiseaseInspection.blocking_reasons : []),
  ].map((x) => String(x ?? "").trim()).filter(Boolean)));

  return {
    ...report,
    pest_disease_inspection: pestDiseaseInspection,
    formal_scenario: {
      scenario_type: "FORMAL_PEST_DISEASE_INSPECTION",
      formal_chain_status: pestDiseaseInspection.customer_visible_eligible
        ? "PASSED"
        : (
          pestDiseaseInspection.acceptance_status === "MISSING"
            ? "LIMITED"
            : pestDiseaseInspection.acceptance_status === "INSUFFICIENT_EVIDENCE"
              ? "INSUFFICIENT_EVIDENCE"
              : "NEEDS_REVIEW"
        ),
      evidence_status: pestDiseaseInspection.acceptance_status === "PASS"
        ? "FORMAL_PASSED"
        : (
          pestDiseaseInspection.evidence_tier === "WARNING"
            || pestDiseaseInspection.evidence_tier === "TECHNICAL"
              ? "TECHNICAL_ONLY"
              : "MISSING"
        ),
      customer_visible_eligible: Boolean(pestDiseaseInspection.customer_visible_eligible),
      needs_review: !pestDiseaseInspection.customer_visible_eligible
        || (Boolean(pestDiseaseInspection.review_required) && !pestDiseaseInspection.reviewed_by_human),
      blocking_reasons: blockingReasons,
    },
  };
}

export async function projectReportV1(params: {
  pool: Pool;
  tenant: TenantTriple;
  operationState: OperationStateV1;
  operationWorkflow?: { owner_actor_id: string | null; owner_name: string | null; last_note: string | null; updated_at: number; updated_by: string; linked_alert_ids?: string[] } | null;
}): Promise<OperationReportV1> {
  const { pool, tenant, operationState, operationWorkflow } = params;
  const operationPlanId = operationState.operation_plan_id || operationState.operation_id;
  const facts = await queryFactsForOperation(pool, tenant, operationPlanId);
  const recommendationFacts = operationState.recommendation_id ? await queryFactsByTypeAndPayloadKey(pool, tenant, "decision_recommendation_v1", "recommendation_id", operationState.recommendation_id) : [];
  const approvalRequestFacts = operationState.approval_request_id ? await queryFactsByTypeAndPayloadKey(pool, tenant, "approval_request_v1", "request_id", operationState.approval_request_id) : [];
  const approvalDecisionFacts = operationState.approval_request_id ? await queryFactsByTypeAndPayloadKey(pool, tenant, "approval_decision_v1", "request_id", operationState.approval_request_id) : [];
  const allFacts = [...facts, ...recommendationFacts, ...approvalRequestFacts, ...approvalDecisionFacts];

  const acceptanceFact = latestByType(allFacts, "acceptance_result_v1");
  const receiptFact = [...allFacts].reverse().find((x) => ["ao_act_receipt_v0", "ao_act_receipt_v1"].includes(String(x.record_json?.type ?? ""))) ?? null;
  const recommendationFact = latestByType(allFacts, "decision_recommendation_v1");
  const approvalRequestFact = latestByType(allFacts, "approval_request_v1");
  const approvalDecisionFact = latestByType(allFacts, "approval_decision_v1");
  const evidenceSummaryFact = latestEvidenceSummaryFact(allFacts);
  const artifactFacts = allFacts.filter((x) => String(x.record_json?.type ?? "") === "evidence_artifact_v1");
  const normalizedReceipt = receiptFact ? normalizeReceiptEvidence(receiptFact, String(receiptFact.record_json?.type ?? "")) : null;
  const receiptPayload = receiptFact?.record_json?.payload ?? {};
  const logs = Array.isArray(receiptPayload?.logs_refs) ? receiptPayload.logs_refs : [];
  const metrics = Array.isArray(receiptPayload?.metrics) ? receiptPayload.metrics : [];
  const photos = Array.isArray(receiptPayload?.photo_refs) ? receiptPayload.photo_refs : [];
  const media = photos.map((ref: unknown) => ({ kind: "photo", ref }));
  const artifacts = artifactFacts.map((fact) => ({ kind: toText(fact.record_json?.payload?.kind) ?? "artifact", ref: toText(fact.record_json?.payload?.artifact_id ?? fact.fact_id) }));
  const evidenceBundle = { artifacts, logs, media, metrics };
  const relationQ = await pool.query(
    `SELECT evidence_export_job_id, status, manifest, sha256, download_url, failed_reason
       FROM operation_evidence_export_relation_v1
      WHERE tenant_id = $1 AND operation_id = $2
      ORDER BY created_at DESC
      LIMIT 1`,
    [tenant.tenant_id, operationPlanId]
  ).catch(() => ({ rows: [] as any[] }));
  const relation = relationQ.rows?.[0] ?? null;
  const estimatedCost = computeOperationCostV1(operationState.action_type, { water_l: normalizedReceipt?.water_l, chemical_ml: normalizedReceipt?.chemical_ml });
  const executionSuccess = ["SUCCESS", "SUCCEEDED"].includes(String(operationState.final_status ?? "").toUpperCase());
  const acceptancePass = String(acceptanceFact?.record_json?.payload?.verdict ?? "").toUpperCase().includes("PASS");
  const responseTimeMs = buildResponseTimeMs(operationState, normalizedReceipt?.execution_started_at ?? null);
  const recommendationPayload = recommendationFact?.record_json?.payload ?? {};
  const explainHuman = toText(recommendationPayload?.diagnosis?.human ?? recommendationPayload?.explain?.human ?? recommendationPayload?.explain_human ?? recommendationPayload?.summary ?? recommendationPayload?.action_summary ?? recommendationPayload?.reason);
  const objectiveText = toText(recommendationPayload?.objective_text ?? recommendationPayload?.expected_effect?.[0]?.description ?? recommendationPayload?.expected_effect?.[0]?.metric);
  const diagnosticInputs = await buildDiagnosticInputsForReportV1({
    pool,
    tenant,
    field_id: operationState.field_id ?? null,
    recommendation_payload: recommendationPayload,
    diagnosis_human: explainHuman,
  });
  const latestWeatherForecast = operationState.field_id
    ? await getLatestWeatherForecastIndexV1(pool, tenant, operationState.field_id).catch(() => null)
    : null;
  const weatherSummaryForReport =
    buildWeatherSummaryFromWeatherForecastIndexV1(latestWeatherForecast)
    ?? buildWeatherSummaryFromDiagnosticInputsForReportV1(diagnosticInputs);
  const latestIrrigationRequirement = operationState.field_id
    ? await getLatestIrrigationRequirementIndexV1(pool, tenant, {
      field_id: operationState.field_id,
      source_forecast_id: toText(latestWeatherForecast?.forecast_id),
    }).catch(() => null)
    : null;
  const irrigationRequirementSummaryForReport = buildIrrigationRequirementSummaryFromIndexV1(
    latestIrrigationRequirement,
    operationState.field_id ?? null,
    toText(latestWeatherForecast?.forecast_id),
  );
  const irrigationDecisionReportForReport = await buildIrrigationDecisionReportV1({
    pool,
    tenant,
    operation_id: operationState.operation_id ?? null,
    operation_plan_id: operationPlanId,
    field_id: operationState.field_id ?? null,
    recommendation_id: operationState.recommendation_id ?? null,
  });
  const approvalStatus = normalizeApprovalStatus(approvalDecisionFact?.record_json?.payload?.decision, Boolean(approvalRequestFact));
  const operationTitle = deriveOperationTitle(operationState.action_type ?? recommendationPayload?.suggested_action?.action_type);
  const operationStateAny: any = operationState as any;
  const fallbackSamplingPlanId = toText(operationStateAny?.sampling_plan_id ?? operationStateAny?.sampling?.plan_id);
  const samplingOperationIds = Array.from(new Set([toText(operationState.operation_id), toText(operationState.operation_plan_id), toText(operationPlanId)].filter(Boolean) as string[]));
  const samplingView = await buildSamplingReportViewV1(pool, {
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    field_id: operationState.field_id ?? null,
    operation_id: samplingOperationIds[0] ?? null,
    operation_ids: samplingOperationIds,
    plan_id: fallbackSamplingPlanId,
  });
  const fertilizationView = await buildFertilizationReportProjectionV1(pool, {
    tenant,
    operation_plan_id: operationPlanId,
    operation_id: operationState.operation_id,
    act_task_id: operationState.act_task_id ?? operationState.task_id ?? null,
    receipt_id: operationState.receipt_id ?? null,
    prescription_id: (operationState as any).prescription_id ?? null,
    recommendation_id: operationState.recommendation_id ?? null,
  });
  const pestDiseaseInspectionView = await buildPestDiseaseInspectionReportProjectionV1(pool, {
    tenant,
    operation_plan_id: operationPlanId,
    operation_id: operationState.operation_id,
    inspection_id: toText(
      (operationState as any)?.pest_disease_inspection_id
        ?? (operationState as any)?.inspection_id
        ?? (operationState as any)?.pest_disease_inspection?.inspection_id,
    ),
  });
  const acceptanceForReport = acceptanceFact ? {
    verdict: acceptanceFact.record_json?.payload?.verdict,
    missing_evidence: acceptanceFact.record_json?.payload?.missing_evidence,
    generated_at: acceptanceFact.record_json?.payload?.generated_at ?? acceptanceFact.occurred_at,
    status: operationState.acceptance?.status,
  } : null;
  const receiptForReport = normalizedReceipt ? { execution_started_at: normalizedReceipt.execution_started_at, execution_finished_at: normalizedReceipt.execution_finished_at } : null;
  const prescriptionForReport = await queryPrescriptionForReport(pool, tenant, operationState);
  const asExecutedForReport = await queryAsExecutedForReport(pool, tenant, operationState);
  const asAppliedForReport = await queryAsAppliedForReport(pool, tenant, operationState, asExecutedForReport);
  const requirementAmountSourceForReport = buildFormalAmountSourceFromRequirementSummaryForReportV1(irrigationRequirementSummaryForReport);

  const operationReport = projectOperationReportV1({
    tenant,
    operation_plan_id: operationPlanId,
    operation_state: operationState,
    evidence_bundle: evidenceBundle,
    acceptance: acceptanceForReport,
    receipt: receiptForReport,
    cost: {
      estimated_total: estimatedCost.estimated_total,
      estimated_water_cost: estimatedCost.estimated_water_cost,
      estimated_electric_cost: estimatedCost.estimated_electric_cost,
      estimated_chemical_cost: estimatedCost.estimated_chemical_cost,
    },
    sla: { execution_success: executionSuccess, acceptance_pass: acceptancePass, response_time_ms: responseTimeMs },
    operation_workflow: operationWorkflow ? { ...operationWorkflow, linked_alert_ids: operationWorkflow.linked_alert_ids ?? [] } : null,
    approval: {
      status: approvalStatus,
      actor_id: toText(approvalDecisionFact?.record_json?.payload?.actor_id ?? approvalDecisionFact?.record_json?.payload?.decider),
      actor_name: toText(approvalDecisionFact?.record_json?.payload?.actor_name ?? approvalDecisionFact?.record_json?.payload?.actor_label),
      generated_at: approvalRequestFact?.occurred_at ?? null,
      approved_at: approvalStatus === "APPROVED" ? (approvalDecisionFact?.occurred_at ?? null) : null,
      note: toText(approvalDecisionFact?.record_json?.payload?.note ?? approvalDecisionFact?.record_json?.payload?.reason),
    },
    roi_ledger: await queryRoiLedgerForReport(pool, tenant, operationState),
    sampling_view: samplingView,
    why: { explain_human: explainHuman, objective_text: objectiveText },
    diagnostic_inputs: diagnosticInputs,
    operation_title: operationTitle,
    customer_title: operationTitle,
  });
  const reportWithFertilization = mergeFertilizationIntoReport(operationReport, fertilizationView);
  const reportWithPestDiseaseInspection = mergePestDiseaseInspectionIntoReport(
    reportWithFertilization,
    pestDiseaseInspectionView,
  );
  const basePrescriptionForReport = (reportWithPestDiseaseInspection as any).prescription ?? null;
  const mergedPrescriptionForReport = prescriptionForReport
    ? {
      ...(basePrescriptionForReport ?? {}),
      ...prescriptionForReport,
      amount_source: prescriptionForReport.amount_source ?? basePrescriptionForReport?.amount_source ?? requirementAmountSourceForReport,
    }
    : (
      basePrescriptionForReport
        ? {
          ...basePrescriptionForReport,
          amount_source: basePrescriptionForReport.amount_source ?? requirementAmountSourceForReport,
        }
        : null
    );
  const baseAsExecutedForReport = (reportWithPestDiseaseInspection as any).as_executed ?? null;
  const mergedAsExecutedForReport = asExecutedForReport
    ? {
      ...(baseAsExecutedForReport ?? {}),
      ...asExecutedForReport,
      planned_amount_source: asExecutedForReport.planned_amount_source ?? baseAsExecutedForReport?.planned_amount_source ?? requirementAmountSourceForReport,
    }
    : (
      baseAsExecutedForReport
        ? {
          ...baseAsExecutedForReport,
          planned_amount_source: baseAsExecutedForReport.planned_amount_source ?? requirementAmountSourceForReport,
        }
        : baseAsExecutedForReport
    );

  const reportWithExecutionBlocks: OperationReportV1 = {
    ...reportWithPestDiseaseInspection,
    diagnostic_inputs: diagnosticInputs,
    weather_summary: weatherSummaryForReport,
    irrigation_requirement_summary: irrigationRequirementSummaryForReport,
    irrigation_decision_report_v1: irrigationDecisionReportForReport,
    prescription: mergedPrescriptionForReport,
    as_executed: mergedAsExecutedForReport,
    as_applied: asAppliedForReport
      ? { ...(reportWithPestDiseaseInspection as any).as_applied, ...asAppliedForReport }
      : (reportWithPestDiseaseInspection as any).as_applied,
    evidence_pack_summary: buildOperationEvidencePackSummaryV1({
      receipt: receiptFact ?? receiptForReport,
      evidence_bundle: evidenceBundle,
      evidence_summary: evidenceSummaryFact?.record_json?.payload ?? null,
      acceptance: acceptanceFact ?? acceptanceForReport,
      operation_state: operationState,
      evidence_export_job: relation ? {
        job_id: relation.evidence_export_job_id,
        status: relation.status,
        artifact_sha256: relation.sha256,
        error: relation.failed_reason,
        evidence_pack: {
          files: [{ name: relation.manifest, download_part: "manifest" }, { sha256: relation.sha256, download_part: "bundle" }],
          delivery: { object_store_download_url: relation.download_url },
        },
      } : null,
      now: new Date(operationReport.generated_at),
    }),
  };
  return reportWithExecutionBlocks;
}

export function registerReportsV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/reports/operation/:operation_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const operationId = toText((req.params as any)?.operation_id);
    if (!operationId) return reply.status(400).send({ ok: false, error: "MISSING_OPERATION_ID" });
    const states = await projectOperationStateV1(pool, tenant);
    const state = states.find((x) => x.operation_id === operationId || x.operation_plan_id === operationId) ?? null;
    if (!state) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    const scopedFieldId = await enforceOperationFieldScope(auth, operationId, reply, async (opId) => {
      const matched = states.find((x) => x.operation_id === opId || x.operation_plan_id === opId) ?? null;
      return matched ? String(matched.field_id ?? "").trim() || null : null;
    }, { asNotFound: true });
    if (!scopedFieldId) return;
    const workflowMap = await listOperationWorkflowV1(pool, { tenant_id: tenant.tenant_id, operation_ids: [state.operation_id, state.operation_plan_id].filter(Boolean) });
    const relationMapByOperation = await listAlertOperationRelationV1ByOperation(pool, { tenant_id: tenant.tenant_id, operation_ids: [state.operation_id, state.operation_plan_id].filter(Boolean) });
    const workflow = workflowMap.get(state.operation_id) ?? workflowMap.get(state.operation_plan_id) ?? null;
    const linkedAlerts = relationMapByOperation.get(state.operation_id) ?? relationMapByOperation.get(state.operation_plan_id) ?? [];
    const operation_report_v1 = await projectReportV1({
      pool,
      tenant,
      operationState: state,
      operationWorkflow: workflow ? { ...workflow, linked_alert_ids: linkedAlerts.map((row) => row.alert_id).filter(Boolean) } : (linkedAlerts.length > 0 ? {
        owner_actor_id: null,
        owner_name: null,
        last_note: null,
        updated_at: 0,
        updated_by: "",
        linked_alert_ids: linkedAlerts.map((row) => row.alert_id).filter(Boolean),
      } : null),
    });
    const candidateIds = Array.from(new Set([state.operation_id, state.operation_plan_id, state.recommendation_id, state.act_task_id, (state.acceptance as any)?.acceptance_id].map((x) => String(x ?? "").trim()).filter(Boolean)));
    const fm = await pool.query(
      `SELECT memory_id,memory_type,memory_lane,trust_level,formal_acceptance_id,source_lane,customer_visible_memory,learning_eligible,metric_key,before_value,after_value,delta_value,target_range,confidence,summary_text,evidence_refs,skill_id,skill_trace_ref,occurred_at
       FROM field_memory_v1
       WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3
         AND (operation_id = ANY($4::text[]) OR task_id = ANY($4::text[]) OR recommendation_id = ANY($4::text[]) OR prescription_id = ANY($4::text[]) OR acceptance_id = ANY($4::text[]))
       ORDER BY occurred_at DESC LIMIT 50`,
      [tenant.tenant_id, tenant.project_id, tenant.group_id, candidateIds],
    ).catch(() => ({ rows: [] as any[] }));
    const enrichedReport = ensureReportV1ExtendedFields(operation_report_v1);
    const normalizedMemoryRows = (fm.rows ?? []).map((x: any) => normalizeFieldMemoryRow(x));
    enrichedReport.field_memory = {
      field_response_memory: normalizedMemoryRows.filter((x:any)=>x.memory_type==="FIELD_RESPONSE_MEMORY"),
      device_reliability_memory: normalizedMemoryRows.filter((x:any)=>x.memory_type==="DEVICE_RELIABILITY_MEMORY"),
      skill_performance_memory: normalizedMemoryRows.filter((x:any)=>x.memory_type==="SKILL_PERFORMANCE_MEMORY"),
    };
    const roiRows = Array.isArray(enrichedReport.roi_ledger?.water_saved) ? [
      ...(enrichedReport.roi_ledger.water_saved ?? []),
      ...(enrichedReport.roi_ledger.labor_saved ?? []),
      ...(enrichedReport.roi_ledger.early_warning_lead_time ?? []),
      ...(enrichedReport.roi_ledger.first_pass_acceptance_rate ?? []),
      ...(enrichedReport.roi_ledger.low_confidence_items ?? []),
    ] : [];
    const skillTraceFromMemory = (fm.rows ?? []).map((x: any) => toText(x.skill_trace_ref)).find(Boolean) ?? null;
    const skillRunFromFacts = toText((state as any).skill_run_id);
    const asExecutedFromFacts = toText((state as any).as_executed_id);
    enrichedReport.identifiers = {
      ...enrichedReport.identifiers,
      prescription_id: enrichedReport.identifiers.prescription_id ?? toText((state as any).prescription_id),
      approval_id: enrichedReport.identifiers.approval_id ?? toText(state.approval_request_id),
      skill_trace_id: enrichedReport.identifiers.skill_trace_id ?? skillTraceFromMemory ?? toText((roiRows[0] as any)?.skill_trace_ref),
      skill_run_id: enrichedReport.identifiers.skill_run_id ?? skillRunFromFacts,
      as_executed_id: enrichedReport.identifiers.as_executed_id ?? asExecutedFromFacts,
    } as any;
    const asAppliedMapRows = await pool.query(
      `SELECT as_applied_id, geometry, coverage, application, evidence_refs
         FROM as_applied_map_v1
        WHERE tenant_id = $1
          AND project_id = $2
          AND group_id = $3
          AND (
            as_executed_id = $4
            OR task_id = $5
            OR receipt_id = $6
          )
        ORDER BY updated_at DESC
        LIMIT 1`,
      [
        tenant.tenant_id,
        tenant.project_id,
        tenant.group_id,
        enrichedReport.identifiers.as_executed_id ?? "",
        enrichedReport.identifiers.act_task_id ?? "",
        enrichedReport.identifiers.receipt_id ?? "",
      ],
    ).catch(() => ({ rows: [] as any[] }));

    const asAppliedGeometry = asAppliedMapRows.rows?.[0]?.geometry ?? {};
    const asAppliedGeometryType = String((asAppliedGeometry as any).type ?? "").trim();
    const asAppliedFieldRef = asAppliedGeometryType === "field_ref"
      ? String((asAppliedGeometry as any).field_ref ?? enrichedReport.identifiers.field_id ?? "").trim()
      : "";
    const asAppliedFieldPolygonRows = asAppliedFieldRef
      ? await pool.query(
        `SELECT polygon_geojson_json
           FROM field_polygon_v1
          WHERE tenant_id = $1
            AND field_id = $2
          LIMIT 1`,
        [tenant.tenant_id, asAppliedFieldRef],
      ).catch(() => ({ rows: [] as any[] }))
      : { rows: [] as any[] };

    const asAppliedEvidenceExportRows = await pool.query(
      `SELECT relation_id, download_url, artifact_ref, status
         FROM operation_evidence_export_relation_v1
        WHERE tenant_id = $1
          AND status = 'COMPLETED'
          AND download_url IS NOT NULL
          AND (
            operation_id = $2
            OR operation_id = $3
            OR artifact_ref = ANY($4::text[])
          )
        ORDER BY completed_at DESC NULLS LAST, created_at DESC
        LIMIT 1`,
      [
        tenant.tenant_id,
        enrichedReport.identifiers.operation_id ?? "",
        enrichedReport.identifiers.operation_plan_id ?? "",
        Array.from(new Set((asAppliedMapRows.rows?.[0]?.evidence_refs ?? [])
          .map((ref: any) => typeof ref === "string" ? ref : String(ref?.artifact_id ?? ref?.ref ?? "").trim())
          .filter(Boolean))),
      ],
    ).catch(() => ({ rows: [] as any[] }));

    const guardedOperationReport = await buildGuardedOperationReportV1({ pool, report: enrichedReport });
    const firstFieldMemoryForCustomerSummary = (enrichedReport as any).field_memory?.field_response_memory?.[0] ?? null;
    if (firstFieldMemoryForCustomerSummary && !(guardedOperationReport as any).customer_memory_summary) {
      (guardedOperationReport as any).customer_memory_summary = {
        title: "田块响应记忆",
        learned: (firstFieldMemoryForCustomerSummary as any).customer_text ?? (firstFieldMemoryForCustomerSummary as any).learned_text ?? (firstFieldMemoryForCustomerSummary as any).summary_text ?? null,
        confidence: (firstFieldMemoryForCustomerSummary as any).confidence ?? (firstFieldMemoryForCustomerSummary as any).confidence_score ?? (firstFieldMemoryForCustomerSummary as any).trust_level ?? null,
        before_value: (firstFieldMemoryForCustomerSummary as any).before_value ?? null,
        after_value: (firstFieldMemoryForCustomerSummary as any).after_value ?? null,
        delta_value: (firstFieldMemoryForCustomerSummary as any).delta_value ?? null,
      };
    }
    const firstAsAppliedMap = asAppliedMapRows.rows?.[0] ?? null;
    if (firstAsAppliedMap && !(guardedOperationReport as any).spatial_execution) {
      const coverage = firstAsAppliedMap.coverage ?? {};
      const application = firstAsAppliedMap.application ?? {};
      const geometry = firstAsAppliedMap.geometry ?? {};
      const geometryType = String((geometry as any).type ?? "").trim();
      const directRenderableGeometry = ["Polygon", "MultiPolygon", "Feature", "FeatureCollection"].includes(geometryType)
        ? geometry
        : null;
      const fieldRefPolygon = asAppliedFieldPolygonRows.rows?.[0]?.polygon_geojson_json ?? null;
      const resolvedCoverageGeojson = directRenderableGeometry ?? fieldRefPolygon;
      const resolvedGeometryType = String((resolvedCoverageGeojson as any)?.type ?? "").trim();
      const mapAvailable = ["Polygon", "MultiPolygon", "Feature", "FeatureCollection"].includes(resolvedGeometryType);

      (guardedOperationReport as any).spatial_execution = {
        available: true,
        coverage_pct: toFiniteNumberOrNull((coverage as any).coverage_percent ?? (coverage as any).coverage_pct ?? (application as any).coverage_percent),
        applied_mm: toFiniteNumberOrNull((application as any).applied_amount ?? (application as any).actual_amount),
        planned_mm: toFiniteNumberOrNull((application as any).planned_amount ?? (application as any).target_amount),
        map_available: mapAvailable,
        map_url: asAppliedEvidenceExportRows.rows?.[0]?.download_url ?? null,
        map_unavailable_reason: mapAvailable ? null : (geometryType === "field_ref" ? "AS_APPLIED_FIELD_POLYGON_MISSING" : "AS_APPLIED_RENDERABLE_GEOMETRY_MISSING"),
        coverage_geojson: mapAvailable ? resolvedCoverageGeojson : null,
        evidence_refs: Array.isArray(firstAsAppliedMap.evidence_refs) ? firstAsAppliedMap.evidence_refs : [],
      };
    }

    const customerMemoryForOutcome = (guardedOperationReport as any).customer_memory_summary ?? null;
    const beforeValueForOutcome = toFiniteNumberOrNull(customerMemoryForOutcome?.before_value);
    const afterValueForOutcome = toFiniteNumberOrNull(customerMemoryForOutcome?.after_value);
    const deltaValueForOutcome = toFiniteNumberOrNull(customerMemoryForOutcome?.delta_value);
    if (customerMemoryForOutcome && !(guardedOperationReport as any).operation_outcome_summary) {
      const acceptanceStatus = String((guardedOperationReport as any).acceptance?.status ?? "").trim() || null;
      const summary = beforeValueForOutcome != null && afterValueForOutcome != null && deltaValueForOutcome != null
        ? `soil_moisture_percent:${beforeValueForOutcome}->${afterValueForOutcome};delta_pp:${deltaValueForOutcome};acceptance:${acceptanceStatus ?? "UNKNOWN"}`
        : ((customerMemoryForOutcome as any).learned ?? null);

      (guardedOperationReport as any).operation_outcome_summary = {
        title: "OPERATION_OUTCOME_SUMMARY",
        summary,
        before_value: beforeValueForOutcome,
        after_value: afterValueForOutcome,
        delta_value: deltaValueForOutcome,
        acceptance_status: acceptanceStatus,
      };
    }

    const finalRequirementAmountSource = buildFormalAmountSourceFromRequirementSummaryForReportV1(
      ((guardedOperationReport as any).irrigation_requirement_summary ?? (enrichedReport as any).irrigation_requirement_summary ?? null) as any,
    );
    if (finalRequirementAmountSource) {
      (guardedOperationReport as any).prescription = {
        ...((guardedOperationReport as any).prescription ?? {}),
        amount_source: (guardedOperationReport as any).prescription?.amount_source ?? finalRequirementAmountSource,
      };
      (guardedOperationReport as any).as_executed = {
        ...((guardedOperationReport as any).as_executed ?? {}),
        planned_amount_source: (guardedOperationReport as any).as_executed?.planned_amount_source ?? finalRequirementAmountSource,
      };
    }

    const irrigationDecisionReportForFinalResponse = await buildIrrigationDecisionReportV1({
      pool,
      tenant,
      operation_id: state.operation_id ?? null,
      operation_plan_id: toText((state as any).operation_plan_id) ?? operationId,
      field_id: state.field_id ?? null,
      recommendation_id: state.recommendation_id ?? null,
    });

    (guardedOperationReport as any).irrigation_decision_report_v1 = irrigationDecisionReportForFinalResponse;

    const payload: OperationReportSingleResponseV1 = { ok: true, operation_report_v1: guardedOperationReport as OperationReportV1 };
    return reply.send(payload);
  });

  app.get("/api/v1/irrigation-requirement-skill-inputs/:skill_input_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const skillInputId = toText((req.params as any)?.skill_input_id);
    if (!skillInputId) return reply.status(400).send({ ok: false, error: "MISSING_SKILL_INPUT_ID" });

    const skillInput = await getIrrigationRequirementSkillInputIndexV1(pool, tenant, skillInputId);
    if (!skillInput) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    if (!enforceFieldScopeOrDeny(auth, skillInput.field_id, reply, { asNotFound: true })) return;

    return reply.send({ ok: true, irrigation_requirement_skill_input_v1: skillInput });
  });

  app.get("/api/v1/reports/field/:field_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const fieldId = toText((req.params as any)?.field_id);
    if (!fieldId) return reply.status(400).send({ ok: false, error: "MISSING_FIELD_ID" });
    const states = await projectOperationStateV1(pool, tenant);
    if (!enforceFieldScopeOrDeny(auth, fieldId, reply, { asNotFound: true })) return;
    const fieldStates = states
      .filter((x) => String(x.field_id ?? "") === fieldId)
      .filter((x) => hasFieldAccess(auth, String(x.field_id ?? "")))
      .sort((a, b) => Number(b.last_event_ts ?? 0) - Number(a.last_event_ts ?? 0))
      .slice(0, FIELD_REPORT_OPERATION_LIMIT);
    const pendingOperationCount = fieldStates.filter((state: any) => {
      const finalStatus = String(state.final_status ?? "").trim().toUpperCase();
      const status = String(state.status ?? "").trim().toUpperCase();
      const acceptanceStatus = String(state.acceptance?.status ?? state.acceptance_status ?? "").trim().toUpperCase();
      return [finalStatus, status, acceptanceStatus].some((x) => x === "PENDING" || x === "PENDING_ACCEPTANCE" || x === "RUNNING");
    }).length;
    const items = await Promise.all(fieldStates.map(async (state) => {
      const projected = ensureReportV1ExtendedFields(await projectReportV1({ pool, tenant, operationState: state }));
      const candidateIds = Array.from(new Set([state.operation_id, state.operation_plan_id, state.recommendation_id, state.act_task_id, (state.acceptance as any)?.acceptance_id].map((x) => String(x ?? "").trim()).filter(Boolean)));
      const fm = candidateIds.length > 0 ? await pool.query(
        `SELECT memory_id,memory_type,memory_lane,trust_level,formal_acceptance_id,source_lane,customer_visible_memory,learning_eligible,metric_key,before_value,after_value,delta_value,target_range,confidence,summary_text,evidence_refs,skill_id,skill_trace_ref,occurred_at
           FROM field_memory_v1
          WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3
            AND (operation_id = ANY($4::text[]) OR task_id = ANY($4::text[]) OR recommendation_id = ANY($4::text[]) OR prescription_id = ANY($4::text[]) OR acceptance_id = ANY($4::text[]))
          ORDER BY occurred_at DESC LIMIT 50`,
        [tenant.tenant_id, tenant.project_id, tenant.group_id, candidateIds],
      ).catch(() => ({ rows: [] as any[] })) : { rows: [] as any[] };
      const normalizedMemoryRows = (fm.rows ?? []).map((x: any) => normalizeFieldMemoryRow(x));
      projected.field_memory = {
        field_response_memory: normalizedMemoryRows.filter((x:any)=>x.memory_type==="FIELD_RESPONSE_MEMORY"),
        device_reliability_memory: normalizedMemoryRows.filter((x:any)=>x.memory_type==="DEVICE_RELIABILITY_MEMORY"),
        skill_performance_memory: normalizedMemoryRows.filter((x:any)=>x.memory_type==="SKILL_PERFORMANCE_MEMORY"),
      };
      return buildGuardedOperationReportV1({ pool, report: projected });
    }));
    const fieldNameQ = await pool.query(`SELECT name, area_ha FROM field_index_v1 WHERE tenant_id = $1 AND field_id = $2 LIMIT 1`, [tenant.tenant_id, fieldId]).catch(() => ({ rows: [] as any[] }));
    const fieldName = toText(fieldNameQ.rows?.[0]?.name);
    const fieldAreaHa = toFiniteNumberOrNull(fieldNameQ.rows?.[0]?.area_ha);
    const fieldAreaM2 = fieldAreaHa == null ? null : fieldAreaHa * 10000;
    const fieldAreaMu = fieldAreaHa == null ? null : fieldAreaHa * 15;
    const polygonQ = await pool.query(`SELECT polygon_geojson_json FROM field_polygon_v1 WHERE tenant_id = $1 AND field_id = $2 LIMIT 1`, [tenant.tenant_id, fieldId]).catch(() => ({ rows: [] as any[] }));
    const boundDevicesQ = await pool.query(
      `SELECT b.device_id, s.last_telemetry_ts_ms
         FROM device_binding_index_v1 b
         LEFT JOIN device_status_index_v1 s ON s.tenant_id = b.tenant_id AND s.device_id = b.device_id
        WHERE b.tenant_id = $1 AND b.field_id = $2`,
      [tenant.tenant_id, fieldId],
    ).catch(() => ({ rows: [] as any[] }));
    const boundDeviceIds = (boundDevicesQ.rows ?? []).map((row: any) => String(row.device_id ?? "")).filter(Boolean);
    const onlineThresholdMs = Date.now() - 15 * 60 * 1000;
    let onlineDevices = 0;
    let lastTelemetryMs: number | null = null;
    for (const row of boundDevicesQ.rows ?? []) {
      const lastTelemetryTsMs = typeof row.last_telemetry_ts_ms === "number" ? row.last_telemetry_ts_ms : Number(row.last_telemetry_ts_ms);
      if (Number.isFinite(lastTelemetryTsMs)) {
        if (lastTelemetryMs == null || lastTelemetryTsMs > lastTelemetryMs) lastTelemetryMs = lastTelemetryTsMs;
        if (lastTelemetryTsMs >= onlineThresholdMs) onlineDevices += 1;
      }
    }
    const alertQ = await pool.query(
      `SELECT COUNT(*)::bigint AS active_alerts
         FROM alert_event_index_v1
        WHERE tenant_id = $1 AND status IN ('OPEN', 'ACKED')
          AND ((object_type = 'FIELD' AND object_id = $2) OR (object_type = 'DEVICE' AND object_id = ANY($3::text[])))`,
      [tenant.tenant_id, fieldId, boundDeviceIds.length > 0 ? boundDeviceIds : ["__none__"]],
    ).catch(() => ({ rows: [] as any[] }));
    const openAlertsCount = Number(alertQ.rows?.[0]?.active_alerts ?? 0);
    const fieldReport = projectFieldReportDetailV1({
      field_id: fieldId,
      field_name: fieldName,
      reports: items,
      open_alerts_count: openAlertsCount,
      pending_operation_count: pendingOperationCount,
      device_summary: { total_devices: boundDeviceIds.length, online_devices: onlineDevices, offline_devices: Math.max(0, boundDeviceIds.length - onlineDevices), last_telemetry_at: toIsoFromEpochMs(lastTelemetryMs) },
      field_context: { area_m2: fieldAreaM2, area_ha: fieldAreaHa, area_mu: fieldAreaMu, boundary_status: polygonQ.rows?.[0]?.polygon_geojson_json ? "BOUNDARY_AVAILABLE" : "BOUNDARY_MISSING", boundary_geojson: polygonQ.rows?.[0]?.polygon_geojson_json ?? null, crop_code: "corn", crop_name: "玉米", season_id: "season_2026_c8_corn", crop_stage: "营养生长期" },
    });
    const payload: FieldReportDetailResponseV1 = { ok: true, field_report_v1: fieldReport };
    return reply.send(payload);
  });
}
