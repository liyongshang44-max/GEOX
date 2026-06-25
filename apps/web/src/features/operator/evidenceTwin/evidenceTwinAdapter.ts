// apps/web/src/features/operator/evidenceTwin/evidenceTwinAdapter.ts
// Purpose: define H52 Operator Evidence Twin P0 adapter types and pure normalization helpers.
// Boundary: this module performs no network requests, no React rendering, no routing, and no write actions.
// H52.1-a guardrail: existing Operator Twin read surfaces are adapter inputs; they are not the final Evidence Twin contract.

import type { OperatorTwinRequestScope } from "../../../api/operatorTwin";

export type EvidenceTwinRefV1 = {
  kind: "fact" | "index_row" | "observation" | "state" | "estimate" | "forecast" | "scenario" | "recommendation" | "approval" | "operation_plan" | "task" | "receipt" | "as_executed" | "artifact" | "acceptance" | "verification" | "external" | string;
  ref_id: string;
  schema_ref: string | null;
  label: string | null;
  href: string | null;
};

export type EvidenceTwinWritePolicyV1 = { write_ready: false; allowed_actions: [] };

export type EvidenceTwinNodeV1 = {
  id: string;
  label: string;
  kind: string;
  schema_ref: string | null;
  status: "AVAILABLE" | "LIMITED" | "MISSING" | "BLOCKING" | "NOT_APPLICABLE" | "UNKNOWN" | "NOT_VERIFIABLE" | string;
  time: { occurred_at: string | null; observed_at: string | null; computed_at: string | null; updated_at: string | null; latest_ts_ms: number | null };
  quality: { status: "AVAILABLE" | "LIMITED" | "BLOCKING" | "UNKNOWN" | string; quality_flags: string[]; blocking_reasons: string[]; confidence_penalty: string | null };
  confidence: { label: string | null; score: number | null; level: string | null };
  source_refs: EvidenceTwinRefV1[];
  evidence_refs: EvidenceTwinRefV1[];
  expand_payload: Record<string, unknown> | null;
  ui_policy: { default_collapsed: boolean; show_raw_payload: boolean; show_internal_ids: boolean; show_customer_safe_label: boolean };
  write_policy: EvidenceTwinWritePolicyV1;
};

export type EvidenceTwinGapV1 = { gap_code: string; label: string; severity: "INFO" | "WARNING" | "BLOCKING" | string; related_node_ids: string[]; suggested_resolution: string | null };
export type EvidenceTwinBoundaryRuleV1 = { rule_code: string; label: string; severity: "INFO" | "WARNING" | "BLOCKING" | string; enforced: boolean };
export type EvidenceTwinFieldV1 = { field_id: string; field_name: string; crop_text: string | null; tenant_id: string | null; project_id: string | null; group_id: string | null; canonical_route: string; legacy_routes: string[] };
export type EvidenceTwinCurrentStateV1 = { label: string; code: string | null; status: string; confidence: EvidenceTwinNodeV1["confidence"]; quality: EvidenceTwinNodeV1["quality"]; latest_update_time: string | null; state_refs: EvidenceTwinRefV1[]; evidence_refs: EvidenceTwinRefV1[]; summary_text: string };
export type EvidenceTwinLineageV1 = { raw_signals: EvidenceTwinNodeV1[]; observations: EvidenceTwinNodeV1[]; state_estimates: EvidenceTwinNodeV1[]; evidence: EvidenceTwinNodeV1[]; verifications: EvidenceTwinNodeV1[] };
export type WaterStressLoopStepCodeV1 = "RAW_SIGNAL" | "OBSERVATION" | "WATER_STRESS_STATE" | "FORECAST" | "SCENARIO" | "RECOMMENDATION" | "APPROVAL" | "OPERATION_PLAN" | "AO_ACT" | "AS_EXECUTED" | "EVIDENCE" | "ACCEPTANCE" | "VERIFICATION";
export type WaterStressLoopStepV1 = EvidenceTwinNodeV1 & { step_code: WaterStressLoopStepCodeV1; order: number; required_for_p0: boolean };
export type WaterStressScenarioOptionV1 = { option_id: string; label: string; irrigation_amount_mm: number | null; scheduled_day: string | null; risk_delta: string | null; confidence: EvidenceTwinNodeV1["confidence"]; failure_conditions: string[]; evidence_refs: EvidenceTwinRefV1[] };

export type WaterStressLoopV1 = {
  loop_id: "water_stress_loop_v1";
  label: "水分压力闭环";
  subtitle: "猎鹰 1 号";
  inputs: { soil_moisture: EvidenceTwinNodeV1[]; canopy_temperature: EvidenceTwinNodeV1[]; weather_forecast: EvidenceTwinNodeV1[]; irrigation_event: EvidenceTwinNodeV1[] };
  water_stress_state: EvidenceTwinNodeV1;
  forecast: EvidenceTwinNodeV1;
  scenario: EvidenceTwinNodeV1 & { scenario_set_id: string | null; no_action_baseline_present: boolean; options: WaterStressScenarioOptionV1[]; unavailable_reason: string | null };
  recommendation: EvidenceTwinNodeV1 & { recommendation_id: string | null; selected_scenario_option_id: string | null; action_type: string | null; amount_mm: number | string | null; human_approval_required: true; no_direct_execution: true; approval_created: false; operation_plan_created: false; task_created: false; dispatch_created: false };
  approval: EvidenceTwinNodeV1;
  operation: EvidenceTwinNodeV1;
  ao_act: EvidenceTwinNodeV1;
  as_executed: EvidenceTwinNodeV1;
  evidence: EvidenceTwinNodeV1;
  acceptance: EvidenceTwinNodeV1;
  verification: EvidenceTwinNodeV1;
  steps: WaterStressLoopStepV1[];
};

export type EvidenceTwinSourceInventoryV1 = { index_tables: Array<{ table_name: string; label: string; available: boolean; row_count: number; latest_ts_ms: number | null; latest_evidence_refs: EvidenceTwinRefV1[]; scope_columns_present: string[]; missing_reason: string | null }>; summary: { table_count: number; available_table_count: number; total_row_count: number } };
export type EvidenceTwinQualityV1 = { status: "AVAILABLE" | "LIMITED" | "BLOCKING" | "UNKNOWN" | string; blocking_reason: string | null; low_quality_reasons: Array<{ source_table: string; reason: string; evidence_refs: EvidenceTwinRefV1[]; missing_windows: string[] }>; simulation_data_present: boolean; official_data_qualified: boolean };
export type EvidenceTwinLegacyConflictPolicyV1 = { canonical_routes: string[]; legacy_routes: string[]; legacy_visible_by_url_only: boolean; delete_old_pages_first: false; route_governance_required: boolean };

export type OperatorEvidenceTwinV1 = {
  version: "v1";
  surface: "OPERATOR";
  report_kind: "OPERATOR_EVIDENCE_TWIN";
  request_scope: OperatorTwinRequestScope & { fieldId?: string | null; field_id?: string | null };
  scope_policy: Record<string, unknown> | null;
  field: EvidenceTwinFieldV1;
  current_state: EvidenceTwinCurrentStateV1;
  lineage: EvidenceTwinLineageV1;
  water_stress_loop: WaterStressLoopV1;
  source_inventory: EvidenceTwinSourceInventoryV1;
  quality: EvidenceTwinQualityV1;
  gaps: EvidenceTwinGapV1[];
  boundary_rules: EvidenceTwinBoundaryRuleV1[];
  legacy_conflict_policy: EvidenceTwinLegacyConflictPolicyV1;
};

export type OperatorEvidenceTwinEnvelopeV1 = { ok: true; source: "operator_evidence_twin_adapter"; dataScope: "OFFICIAL_OPERATOR_TWIN_API"; surface: "OPERATOR"; version: "v1"; generated_at: string; writeReady: false; dispatchReady: false; approvalReady: false; taskCreationReady: false; memoryWriteReady: false; roiWriteReady: false; operator_evidence_twin_v1: OperatorEvidenceTwinV1 };
export type OperatorEvidenceTwinAdapterInput = { fieldId: string; generatedAt?: string | null; scope?: OperatorTwinRequestScope | null; sourceIndexInventory?: Record<string, unknown> | null; workspace?: Record<string, unknown> | null; forecastPanel?: Record<string, unknown> | null; scenarioCompare?: Record<string, unknown> | null; evidenceQuality?: Record<string, unknown> | null; postIrrigationVerification?: Record<string, unknown> | null; h31H45Closure?: Record<string, unknown> | null };

export const H52_P0_WRITE_FLAGS = { writeReady: false, dispatchReady: false, approvalReady: false, taskCreationReady: false, memoryWriteReady: false, roiWriteReady: false } as const;

const REQUIRED_BOUNDARY_RULES: EvidenceTwinBoundaryRuleV1[] = [
  { rule_code: "NO_AO_ACT_TASK_CREATION", label: "P0 页面不创建 AO-ACT task。", severity: "BLOCKING", enforced: true },
  { rule_code: "NO_DISPATCH", label: "P0 页面不派单。", severity: "BLOCKING", enforced: true },
  { rule_code: "NO_APPROVAL_BYPASS", label: "P0 页面不绕过人工审批。", severity: "BLOCKING", enforced: true },
  { rule_code: "FORECAST_IS_NOT_FACT", label: "预测不是事实。", severity: "INFO", enforced: true },
  { rule_code: "SCENARIO_IS_NOT_TASK", label: "情景不是任务。", severity: "BLOCKING", enforced: true },
  { rule_code: "NO_ACTION_BASELINE_REQUIRED", label: "Scenario 节点必须显式展示 no-action baseline 状态。", severity: "WARNING", enforced: true },
  { rule_code: "NO_FIELD_MEMORY_WRITE", label: "P0 页面不写 Field Memory。", severity: "BLOCKING", enforced: true },
  { rule_code: "NO_ROI_WRITE", label: "P0 页面不写 ROI。", severity: "BLOCKING", enforced: true },
  { rule_code: "NO_CUSTOMER_REPORT_GENERATION", label: "P0 页面不生成 customer report。", severity: "BLOCKING", enforced: true },
  { rule_code: "NO_SCENARIO_RECOMMENDATION_SUBMISSION_IN_P0", label: "P0 页面不提交情景生成建议候选。", severity: "BLOCKING", enforced: true },
];

const STEP_DEFINITIONS: Array<{ code: WaterStressLoopStepCodeV1; order: number; label: string; kind: string }> = [
  { code: "RAW_SIGNAL", order: 1, label: "原始信号", kind: "raw_signal" },
  { code: "OBSERVATION", order: 2, label: "标准化观测", kind: "observation" },
  { code: "WATER_STRESS_STATE", order: 3, label: "水分压力状态", kind: "state_estimate" },
  { code: "FORECAST", order: 4, label: "水分预测", kind: "forecast" },
  { code: "SCENARIO", order: 5, label: "灌溉情景", kind: "scenario" },
  { code: "RECOMMENDATION", order: 6, label: "建议候选", kind: "recommendation" },
  { code: "APPROVAL", order: 7, label: "人工审批", kind: "approval" },
  { code: "OPERATION_PLAN", order: 8, label: "作业计划", kind: "operation_plan" },
  { code: "AO_ACT", order: 9, label: "AO-ACT", kind: "task" },
  { code: "AS_EXECUTED", order: 10, label: "实执记录", kind: "as_executed" },
  { code: "EVIDENCE", order: 11, label: "执行证据", kind: "evidence" },
  { code: "ACCEPTANCE", order: 12, label: "执行验收", kind: "acceptance" },
  { code: "VERIFICATION", order: 13, label: "灌后水分响应验证", kind: "verification" },
];

function cleanText(value: unknown): string { return String(value ?? "").trim(); }
function nullableText(value: unknown): string | null { const raw = cleanText(value); return raw ? raw : null; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function writePolicy(): EvidenceTwinWritePolicyV1 { return { write_ready: false, allowed_actions: [] }; }
function numberOrNull(value: unknown): number | null { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function bool(value: unknown): boolean { return value === true || cleanText(value).toLowerCase() === "true"; }
function firstRecord(...values: unknown[]): Record<string, unknown> { return values.map(record).find((value) => Object.keys(value).length > 0) ?? {}; }
function containsAny(value: unknown, tokens: string[]): boolean { const raw = cleanText(value).toLowerCase(); return tokens.some((token) => raw.includes(token)); }

export function inferEvidenceTwinRefKind(refId: string): EvidenceTwinRefV1["kind"] {
  const raw = cleanText(refId).toLowerCase();
  if (raw.startsWith("fact_")) return "fact";
  if (raw.startsWith("act_") || raw.startsWith("task_")) return "task";
  if (raw.includes("receipt")) return "receipt";
  if (raw.includes("as_executed")) return "as_executed";
  if (raw.includes("acceptance")) return "acceptance";
  if (raw.includes("verification") || raw.startsWith("wrv_")) return "verification";
  if (raw.includes("scenario")) return "scenario";
  if (raw.includes("recommendation") || raw.startsWith("rec_")) return "recommendation";
  return "external";
}

export function normalizeEvidenceTwinRef(value: unknown, fallbackKind: EvidenceTwinRefV1["kind"] = "external", schemaRef: string | null = null): EvidenceTwinRefV1 | null {
  if (typeof value === "string" || typeof value === "number") {
    const refId = cleanText(value);
    if (!refId) return null;
    return { kind: fallbackKind === "external" ? inferEvidenceTwinRefKind(refId) : fallbackKind, ref_id: refId, schema_ref: schemaRef, label: refId, href: null };
  }
  const row = record(value);
  const refId = cleanText(row.ref_id ?? row.id ?? row.fact_id ?? row.source_fact_id);
  if (!refId) return null;
  return { kind: cleanText(row.kind) || fallbackKind, ref_id: refId, schema_ref: nullableText(row.schema_ref ?? schemaRef), label: nullableText(row.label ?? refId), href: nullableText(row.href) };
}

export function normalizeEvidenceTwinRefs(values: unknown, fallbackKind: EvidenceTwinRefV1["kind"] = "external", schemaRef: string | null = null): EvidenceTwinRefV1[] {
  const seen = new Set<string>();
  const rawValues = values === undefined || values === null ? [] : Array.isArray(values) ? values : [values];
  return rawValues.map((value) => normalizeEvidenceTwinRef(value, fallbackKind, schemaRef)).filter((ref): ref is EvidenceTwinRefV1 => Boolean(ref)).filter((ref) => { const key = ref.kind + ":" + ref.ref_id + ":" + String(ref.schema_ref ?? ""); if (seen.has(key)) return false; seen.add(key); return true; });
}

function node(args: { id: string; label: string; kind: string; schemaRef: string | null; status: EvidenceTwinNodeV1["status"]; evidenceRefs?: EvidenceTwinRefV1[]; sourceRefs?: EvidenceTwinRefV1[]; expandPayload?: Record<string, unknown> | null; latestTsMs?: number | null; qualityStatus?: string | null; qualityFlags?: string[]; blockingReasons?: string[]; confidenceLabel?: string | null; confidenceScore?: number | null; }): EvidenceTwinNodeV1 {
  const blockingReasons = args.blockingReasons ?? (args.status === "MISSING" ? [args.id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")] : []);
  return { id: args.id, label: args.label, kind: args.kind, schema_ref: args.schemaRef, status: args.status, time: { occurred_at: null, observed_at: null, computed_at: null, updated_at: null, latest_ts_ms: args.latestTsMs ?? null }, quality: { status: args.qualityStatus ?? (args.status === "MISSING" ? "BLOCKING" : "LIMITED"), quality_flags: args.qualityFlags ?? [], blocking_reasons: blockingReasons, confidence_penalty: null }, confidence: { label: args.confidenceLabel ?? null, score: args.confidenceScore ?? null, level: args.confidenceLabel ?? null }, source_refs: args.sourceRefs ?? [], evidence_refs: args.evidenceRefs ?? [], expand_payload: args.expandPayload ?? null, ui_policy: { default_collapsed: true, show_raw_payload: false, show_internal_ids: true, show_customer_safe_label: false }, write_policy: writePolicy() };
}

function missingNode(id: string, label: string, kind: string, schemaRef: string | null, gapCode: string): EvidenceTwinNodeV1 {
  return node({ id, label, kind, schemaRef, status: "MISSING", expandPayload: { gap_code: gapCode }, blockingReasons: [gapCode] });
}

function gap(gapCode: string, label: string, severity: "INFO" | "WARNING" | "BLOCKING", relatedNodeIds: string[] = []): EvidenceTwinGapV1 { return { gap_code: gapCode, label, severity, related_node_ids: relatedNodeIds, suggested_resolution: null }; }
function boundary(row: unknown): EvidenceTwinBoundaryRuleV1 | null { const value = record(row); const ruleCode = cleanText(value.rule_code); return ruleCode ? { rule_code: ruleCode, label: cleanText(value.label), severity: "INFO", enforced: true } : null; }

function fieldContext(input: OperatorEvidenceTwinAdapterInput): Record<string, unknown> {
  return firstRecord(record(input.workspace).field_context, record(input.forecastPanel).field_context, record(input.scenarioCompare).field_context, record(input.evidenceQuality).field_context, record(input.postIrrigationVerification).field_context);
}

function field(input: OperatorEvidenceTwinAdapterInput): EvidenceTwinFieldV1 {
  const context = fieldContext(input);
  const fieldId = cleanText(input.fieldId || context.field_id) || "field_c8_demo";
  return { field_id: fieldId, field_name: cleanText(context.field_name) || fieldId, crop_text: nullableText(context.crop_text), tenant_id: input.scope?.tenant_id ?? null, project_id: input.scope?.project_id ?? null, group_id: input.scope?.group_id ?? null, canonical_route: "/app/operator/fields/" + encodeURIComponent(fieldId) + "/evidence-twin", legacy_routes: ["/operator/twin/fields/" + encodeURIComponent(fieldId)] };
}

function legacyPolicy(fieldId: string): EvidenceTwinLegacyConflictPolicyV1 {
  const safeFieldId = encodeURIComponent(fieldId);
  return { canonical_routes: ["/app/operator/fields/" + safeFieldId + "/evidence-twin", "/app/operator/fields/" + safeFieldId + "/evidence-twin/water-stress"], legacy_routes: ["/operator/twin/fields/" + safeFieldId, "/operator/twin/fields/" + safeFieldId + "/forecast", "/operator/twin/fields/" + safeFieldId + "/scenarios", "/operator/twin/fields/" + safeFieldId + "/evidence", "/operator/twin/fields/" + safeFieldId + "/post-irrigation"], legacy_visible_by_url_only: true, delete_old_pages_first: false, route_governance_required: true };
}

function inventoryRows(input: OperatorEvidenceTwinAdapterInput): Record<string, unknown>[] {
  const inventory = record(input.sourceIndexInventory ?? record(input.evidenceQuality).source_index_inventory);
  return array(inventory.source_indexes).map(record);
}

function coverageRows(input: OperatorEvidenceTwinAdapterInput): Record<string, unknown>[] {
  const evidenceRows = array(record(record(input.evidenceQuality).data_coverage_matrix_v1).rows).map(record);
  const workspaceRows = array(record(input.workspace).data_coverage).map(record);
  return evidenceRows.length > 0 ? evidenceRows : workspaceRows;
}

function traceRows(input: OperatorEvidenceTwinAdapterInput): Record<string, unknown>[] {
  return array(record(record(input.evidenceQuality).evidence_trace_v1).trace_items).map(record);
}

function closureStages(input: OperatorEvidenceTwinAdapterInput): Record<string, unknown>[] {
  return array(record(input.h31H45Closure).stage_groups).map(record);
}

function closureStage(input: OperatorEvidenceTwinAdapterInput, code: string): Record<string, unknown> {
  return closureStages(input).find((stage) => cleanText(stage.code) === code) ?? {};
}

function sourceInventory(input: OperatorEvidenceTwinAdapterInput): EvidenceTwinSourceInventoryV1 {
  const rows = inventoryRows(input);
  return { index_tables: rows.map((row) => ({ table_name: cleanText(row.table_name), label: cleanText(row.label ?? row.table_name), available: bool(row.available), row_count: Number(row.row_count ?? 0), latest_ts_ms: numberOrNull(row.latest_ts_ms), latest_evidence_refs: normalizeEvidenceTwinRefs(row.latest_evidence_refs, "index_row", cleanText(row.table_name)), scope_columns_present: array(row.scope_columns_present).map(cleanText).filter(Boolean), missing_reason: nullableText(row.missing_reason) })), summary: { table_count: rows.length, available_table_count: rows.filter((row) => bool(row.available)).length, total_row_count: rows.reduce((sum, row) => sum + Number(row.row_count ?? 0), 0) } };
}

function rawSignalNodes(input: OperatorEvidenceTwinAdapterInput): EvidenceTwinNodeV1[] {
  const rows = inventoryRows(input);
  if (rows.length === 0) return [missingNode("missing:raw_signal", "原始信号", "raw_signal", null, "RAW_SIGNAL_SOURCE_NOT_EXPOSED")];
  return rows.map((row) => node({ id: "raw_signal_source_index:" + cleanText(row.table_name), label: cleanText(row.label ?? row.table_name), kind: "raw_signal", schemaRef: cleanText(row.table_name), status: bool(row.available) ? "LIMITED" : "MISSING", latestTsMs: numberOrNull(row.latest_ts_ms), evidenceRefs: normalizeEvidenceTwinRefs(row.latest_evidence_refs, "index_row", cleanText(row.table_name)), expandPayload: { table_name: cleanText(row.table_name), row_count: Number(row.row_count ?? 0), raw_detail_exposed: false, missing_reason: nullableText(row.missing_reason) }, blockingReasons: bool(row.available) ? [] : [nullableText(row.missing_reason) ?? "RAW_SIGNAL_SOURCE_NOT_EXPOSED"] }));
}

function observationNodes(input: OperatorEvidenceTwinAdapterInput): EvidenceTwinNodeV1[] {
  const rows = coverageRows(input);
  if (rows.length === 0) return [missingNode("missing:observation", "标准化观测", "observation", null, "OBSERVATION_SOURCE_NOT_EXPOSED")];
  return rows.map((row) => node({ id: "observation:" + (cleanText(row.source_table) || cleanText(row.metric) || "coverage"), label: cleanText(row.metric ?? row.label ?? row.source_table) || "标准化观测", kind: "observation", schemaRef: nullableText(row.source_table), status: bool(row.available) || cleanText(row.status) === "AVAILABLE" ? "AVAILABLE" : "MISSING", latestTsMs: numberOrNull(row.latest_ts_ms), qualityStatus: nullableText(row.quality_status), qualityFlags: array(row.quality_flags).map(cleanText).filter(Boolean), confidenceLabel: nullableText(row.confidence), evidenceRefs: normalizeEvidenceTwinRefs(row.evidence_refs, "index_row", nullableText(row.source_table)), expandPayload: { row_count: Number(row.row_count ?? 0), coverage_ratio: numberOrNull(row.coverage_ratio), max_gap_ms: numberOrNull(row.max_gap_ms), actual_points: numberOrNull(row.actual_points), expected_points: numberOrNull(row.expected_points), raw_observation_detail_exposed: false }, blockingReasons: bool(row.available) ? [] : array(row.missing_windows).map(cleanText).filter(Boolean) }));
}

function stateEstimateNodes(input: OperatorEvidenceTwinAdapterInput): EvidenceTwinNodeV1[] {
  const current = record(record(input.workspace).current_state);
  if (Object.keys(current).length === 0) return [missingNode("missing:water_stress_state", "水分压力状态", "state_estimate", "water_state_estimate_index_v1", "WATER_STRESS_STATE_VIEW_MISSING")];
  return [node({ id: "current_state:water_state_estimate", label: "当前水分状态估计", kind: "state_estimate", schemaRef: "water_state_estimate_index_v1", status: bool(current.low_confidence) ? "LIMITED" : "AVAILABLE", qualityStatus: bool(current.low_confidence) ? "LIMITED" : "AVAILABLE", qualityFlags: bool(current.low_confidence) ? ["LOW_CONFIDENCE"] : [], confidenceLabel: nullableText(current.confidence_text), evidenceRefs: normalizeEvidenceTwinRefs(current.evidence_refs, "estimate", "water_state_estimate_index_v1"), expandPayload: { state_text: nullableText(current.state_text), risk_text: nullableText(current.risk_text), classification: current.classification ?? null } })];
}

function evidenceNodes(input: OperatorEvidenceTwinAdapterInput): EvidenceTwinNodeV1[] {
  const traceNodes = traceRows(input).map((row) => node({ id: "evidence_trace:" + (cleanText(row.source_table) || cleanText(row.label) || "trace"), label: cleanText(row.label ?? row.source_table) || "证据", kind: "evidence", schemaRef: nullableText(row.source_table), status: bool(row.available) ? "AVAILABLE" : "MISSING", latestTsMs: numberOrNull(row.latest_ts_ms), qualityFlags: array(row.quality_flags).map(cleanText).filter(Boolean), evidenceRefs: normalizeEvidenceTwinRefs(row.evidence_refs, "index_row", nullableText(row.source_table)), expandPayload: { stage: nullableText(row.stage), source_table: nullableText(row.source_table) }, blockingReasons: bool(row.available) ? [] : ["EVIDENCE_TRACE_MISSING"] }));
  return traceNodes.length > 0 ? traceNodes : [missingNode("missing:evidence", "执行证据", "evidence", "evidence_artifact_v1", "EVIDENCE_ARTIFACT_MISSING")];
}

function forecastNode(input: OperatorEvidenceTwinAdapterInput): EvidenceTwinNodeV1 {
  const forecast = firstRecord(record(input.forecastPanel).forecast_window_v1, record(input.workspace).forecast_window);
  if (Object.keys(forecast).length === 0) return missingNode("forecast:water_stress", "水分预测", "forecast", "root_zone_soil_water_forecast_v1", "ROOT_ZONE_SOIL_WATER_FORECAST_MISSING");
  const horizonLimited = bool(forecast.forecast_horizon_limited);
  return node({ id: "forecast:water_stress", label: "水分预测", kind: "forecast", schemaRef: "root_zone_soil_water_forecast_v1", status: horizonLimited ? "LIMITED" : "AVAILABLE", evidenceRefs: normalizeEvidenceTwinRefs(forecast.evidence_refs, "forecast", "root_zone_soil_water_forecast_v1"), expandPayload: { available_horizon: forecast.available_horizon ?? null, unavailable_horizons: array(forecast.unavailable_horizons).map(cleanText).filter(Boolean), reason: nullableText(forecast.reason) }, blockingReasons: horizonLimited ? [nullableText(forecast.reason) ?? "FORECAST_HORIZON_LIMITED"] : [] });
}

function scenarioNode(input: OperatorEvidenceTwinAdapterInput): WaterStressLoopV1["scenario"] {
  const scenarioPayload = firstRecord(record(input.scenarioCompare).scenario_compare_v1, record(input.workspace).scenario_comparison);
  const evidenceRefs = normalizeEvidenceTwinRefs(scenarioPayload.evidence_refs, "scenario", "irrigation_scenario_set_index_v1");
  const options = array(scenarioPayload.options).map((item): WaterStressScenarioOptionV1 => { const option = record(item); const confidenceText = nullableText(option.confidence_text); return { option_id: cleanText(option.option_id), label: cleanText(option.label ?? option.option_id), irrigation_amount_mm: numberOrNull(option.irrigation_amount_mm), scheduled_day: nullableText(option.scheduled_day), risk_delta: nullableText(option.risk_delta), confidence: { label: confidenceText, score: numberOrNull(option.confidence_score), level: confidenceText }, failure_conditions: array(option.failure_conditions).map(cleanText).filter(Boolean), evidence_refs: evidenceRefs }; });
  const noAction = bool(scenarioPayload.no_action_baseline_present);
  const unavailableReason = nullableText(scenarioPayload.unavailable_reason) ?? (options.length === 0 ? "SCENARIO_OPTIONS_MISSING" : !noAction ? "NO_ACTION_BASELINE_OR_OPTIONS_NOT_AVAILABLE" : null);
  const status = Object.keys(scenarioPayload).length === 0 ? "MISSING" : options.length === 0 || !noAction ? "LIMITED" : "AVAILABLE";
  return { ...node({ id: "scenario:" + (nullableText(scenarioPayload.scenario_set_id) ?? "irrigation_scenario_set"), label: "灌溉情景", kind: "scenario", schemaRef: "irrigation_scenario_set_index_v1", status, evidenceRefs, expandPayload: { no_action_baseline_present: noAction, options_count: options.length, unavailable_reason: unavailableReason }, blockingReasons: unavailableReason ? [unavailableReason] : [] }), scenario_set_id: nullableText(scenarioPayload.scenario_set_id), no_action_baseline_present: noAction, options, unavailable_reason: unavailableReason };
}

function recommendationNode(input: OperatorEvidenceTwinAdapterInput): WaterStressLoopV1["recommendation"] {
  const source = record(record(input.workspace).recommendation_candidate);
  const recommendationId = nullableText(source.recommendation_id);
  return { ...node({ id: "recommendation:" + (recommendationId ?? "candidate"), label: "建议候选", kind: "recommendation", schemaRef: "decision_recommendation_index_v1", status: recommendationId ? "AVAILABLE" : "MISSING", evidenceRefs: normalizeEvidenceTwinRefs(source.evidence_refs, "recommendation", "decision_recommendation_index_v1"), expandPayload: { recommendation_id: recommendationId, action_type: nullableText(source.action_type), amount_mm: nullableText(source.amount_mm), human_approval_required: true, no_direct_execution: true }, blockingReasons: recommendationId ? [] : ["RECOMMENDATION_CANDIDATE_MISSING"] }), recommendation_id: recommendationId, selected_scenario_option_id: nullableText(source.selected_scenario_option_id), action_type: nullableText(source.action_type), amount_mm: nullableText(source.amount_mm), human_approval_required: true, no_direct_execution: true, approval_created: false, operation_plan_created: false, task_created: false, dispatch_created: false };
}

function closureNode(input: OperatorEvidenceTwinAdapterInput, code: string, label: string, kind: string, schemaRef: string, missingCode: string): EvidenceTwinNodeV1 {
  const stage = closureStage(input, code);
  if (Object.keys(stage).length === 0) return missingNode("closure_stage:" + code + ":" + kind, label, kind, schemaRef, missingCode);
  const status = cleanText(stage.status) === "AVAILABLE" ? "AVAILABLE" : "LIMITED";
  return node({ id: "closure_stage:" + code + ":" + kind, label, kind, schemaRef, status, evidenceRefs: normalizeEvidenceTwinRefs(stage.evidence_refs, "external", schemaRef), expandPayload: { code: cleanText(stage.code), summary_text: nullableText(stage.summary_text), raw_status: nullableText(stage.status) }, blockingReasons: status === "AVAILABLE" ? [] : [missingCode] });
}

function verificationNode(input: OperatorEvidenceTwinAdapterInput): EvidenceTwinNodeV1 {
  const summary = record(record(input.postIrrigationVerification).verification_summary);
  const response = record(record(input.h31H45Closure).response_summary);
  const operationContext = record(input.postIrrigationVerification).operation_context ?? record(input.h31H45Closure).execution_tail;
  const verificationId = nullableText(response.verification_id) ?? nullableText(record(input.h31H45Closure).execution_tail && record(record(input.h31H45Closure).execution_tail).water_response_verification_id) ?? nullableText(record(operationContext).water_response_verification_id) ?? nullableText(record(operationContext).acceptance_result_id);
  const evidenceRefs = normalizeEvidenceTwinRefs(record(input.postIrrigationVerification).execution_evidence_v1 ? record(record(input.postIrrigationVerification).execution_evidence_v1).evidence_refs : closureStage(input, "H45").evidence_refs, "verification", "water_response_verification_v1");
  if (!verificationId && Object.keys(summary).length === 0 && Object.keys(response).length === 0) return missingNode("verification:water_response", "灌后水分响应验证", "verification", "water_response_verification_v1", "WATER_RESPONSE_VERIFICATION_MISSING");
  return node({ id: "verification:" + (verificationId ?? "water_response"), label: "灌后水分响应验证", kind: "verification", schemaRef: "water_response_verification_v1", status: verificationId ? "AVAILABLE" : "LIMITED", evidenceRefs, expandPayload: { operation_context: operationContext ?? null, response_delta_v1: record(input.postIrrigationVerification).response_delta_v1 ?? null, response_summary: Object.keys(response).length > 0 ? response : null, verification_summary: Object.keys(summary).length > 0 ? summary : null }, blockingReasons: verificationId ? [] : ["WATER_RESPONSE_VERIFICATION_MISSING"] });
}

function currentState(input: OperatorEvidenceTwinAdapterInput, stateNode: EvidenceTwinNodeV1): EvidenceTwinCurrentStateV1 {
  const current = record(record(input.workspace).current_state);
  return { label: "水分状态", code: nullableText(current.state_text), status: stateNode.status, confidence: stateNode.confidence, quality: stateNode.quality, latest_update_time: null, state_refs: stateNode.evidence_refs, evidence_refs: stateNode.evidence_refs, summary_text: nullableText(current.risk_text) ?? nullableText(current.state_text) ?? "水分状态缺失" };
}

function quality(input: OperatorEvidenceTwinAdapterInput): EvidenceTwinQualityV1 {
  const source = record(record(input.evidenceQuality).quality_summary);
  return { status: nullableText(source.status) ?? "UNKNOWN", blocking_reason: nullableText(source.blocking_reason), low_quality_reasons: array(source.low_quality_reasons).map(record).map((row) => ({ source_table: cleanText(row.source_table), reason: cleanText(row.reason), evidence_refs: normalizeEvidenceTwinRefs(row.evidence_refs, "index_row", nullableText(row.source_table)), missing_windows: array(row.missing_windows).map(cleanText).filter(Boolean) })), simulation_data_present: bool(source.simulation_data_present), official_data_qualified: bool(source.official_data_qualified) };
}

function boundaries(input: OperatorEvidenceTwinAdapterInput): EvidenceTwinBoundaryRuleV1[] {
  const rows = [record(input.workspace).boundary_rules, record(input.forecastPanel).boundary_rules, record(input.scenarioCompare).boundary_rules, record(input.evidenceQuality).boundary_rules, record(input.postIrrigationVerification).boundary_rules, record(input.h31H45Closure).boundary_rules].flatMap(array).map(boundary).filter((row): row is EvidenceTwinBoundaryRuleV1 => Boolean(row));
  const seen = new Set<string>();
  return [...REQUIRED_BOUNDARY_RULES, ...rows].filter((row) => { if (seen.has(row.rule_code)) return false; seen.add(row.rule_code); return true; });
}

function collectGaps(input: OperatorEvidenceTwinAdapterInput, rawSignals: EvidenceTwinNodeV1[], observations: EvidenceTwinNodeV1[], forecast: EvidenceTwinNodeV1, scenario: WaterStressLoopV1["scenario"], verification: EvidenceTwinNodeV1): EvidenceTwinGapV1[] {
  const rawGaps = [record(input.workspace).data_gaps, record(input.forecastPanel).data_gaps, record(input.scenarioCompare).data_gaps, record(input.evidenceQuality).data_gaps, record(input.postIrrigationVerification).verification_gaps].flatMap(array).map(record).map((row) => gap(cleanText(row.gap_code), cleanText(row.label), cleanText(row.severity) === "BLOCKING" ? "BLOCKING" : cleanText(row.severity) === "INFO" ? "INFO" : "WARNING")).filter((row) => row.gap_code);
  const explicitGaps: EvidenceTwinGapV1[] = [
    gap("RAW_SIGNAL_SOURCE_NOT_EXPOSED", "当前 read surface 未暴露完整 RawSignal 详情。", "WARNING", rawSignals.map((item) => item.id)),
    gap("OBSERVATION_SOURCE_NOT_EXPOSED", "当前 read surface 未暴露完整 Observation 详情。", "WARNING", observations.map((item) => item.id)),
    gap("CANOPY_TEMPERATURE_NOT_IN_MAIN_LOOP", "冠层温度尚未进入 P0 主闭环，作为辅助信号缺口显示。", "WARNING", ["missing:canopy_temperature"]),
  ];
  if (forecast.status === "MISSING") explicitGaps.push(gap("ROOT_ZONE_SOIL_WATER_FORECAST_MISSING", "缺少根区水分预测，页面只能显示预测缺口。", "BLOCKING", [forecast.id]));
  if (scenario.options.length === 0) explicitGaps.push(gap("SCENARIO_OPTIONS_MISSING", "Scenario options 为空，前端不得生成默认情景。", "BLOCKING", [scenario.id]));
  if (!scenario.no_action_baseline_present) explicitGaps.push(gap("NO_ACTION_BASELINE_OR_OPTIONS_NOT_AVAILABLE", "Scenario 缺少 no-action baseline 或可用情景选项。", "BLOCKING", [scenario.id]));
  if (verification.status === "MISSING") explicitGaps.push(gap("WATER_RESPONSE_VERIFICATION_MISSING", "缺少灌后水分响应验证，闭环不可标记为完成。", "BLOCKING", [verification.id]));
  const seen = new Set<string>();
  return [...rawGaps, ...explicitGaps].filter((row) => { const key = row.gap_code + ":" + row.related_node_ids.join("|"); if (seen.has(key)) return false; seen.add(key); return true; });
}

function waterStressSteps(stepNodes: Record<WaterStressLoopStepCodeV1, EvidenceTwinNodeV1>): WaterStressLoopStepV1[] {
  return STEP_DEFINITIONS.map((step) => ({ ...stepNodes[step.code], label: step.label, kind: step.kind, step_code: step.code, order: step.order, required_for_p0: true }));
}

export function buildOperatorEvidenceTwinViewModel(input: OperatorEvidenceTwinAdapterInput): OperatorEvidenceTwinV1 {
  const fieldModel = field(input);
  const rawSignals = rawSignalNodes(input);
  const observations = observationNodes(input);
  const stateEstimates = stateEstimateNodes(input);
  const stateNode = stateEstimates[0];
  const forecast = forecastNode(input);
  const scenario = scenarioNode(input);
  const recommendation = recommendationNode(input);
  const approval = closureNode(input, "H36-H39", "人工审批", "approval", "approval_request_v1", "APPROVAL_CHAIN_MISSING");
  const operation = closureNode(input, "H36-H39", "作业计划", "operation_plan", "operation_plan_v1", "OPERATION_PLAN_MISSING");
  const aoAct = closureNode(input, "H40-H42", "AO-ACT", "task", "ao_act_task_v0", "AO_ACT_TASK_MISSING");
  const asExecuted = closureNode(input, "H40-H42", "实执记录", "as_executed", "as_executed_record_v1", "AS_EXECUTED_RECORD_MISSING");
  const executionEvidence = closureNode(input, "H43-H44", "执行证据", "evidence", "evidence_artifact_v1", "EVIDENCE_ARTIFACT_MISSING");
  const acceptance = closureNode(input, "H43-H44", "执行验收", "acceptance", "acceptance_result_v1", "ACCEPTANCE_RESULT_MISSING");
  const verification = verificationNode(input);
  const evidence = evidenceNodes(input);
  const gaps = collectGaps(input, rawSignals, observations, forecast, scenario, verification);
  return { version: "v1", surface: "OPERATOR", report_kind: "OPERATOR_EVIDENCE_TWIN", request_scope: { ...(input.scope ?? {}), fieldId: fieldModel.field_id, field_id: fieldModel.field_id }, scope_policy: record(input.workspace).scope_policy ? record(record(input.workspace).scope_policy) : null, field: fieldModel, current_state: currentState(input, stateNode), lineage: { raw_signals: rawSignals, observations, state_estimates: stateEstimates, evidence, verifications: [verification] }, water_stress_loop: { loop_id: "water_stress_loop_v1", label: "水分压力闭环", subtitle: "猎鹰 1 号", inputs: { soil_moisture: observations.filter((item) => containsAny(item.schema_ref ?? item.label, ["soil", "moisture", "vwc", "sensing"])), canopy_temperature: [missingNode("missing:canopy_temperature", "冠层温度辅助信号", "observation", "canopy_temperature_state", "CANOPY_TEMPERATURE_NOT_IN_MAIN_LOOP")], weather_forecast: rawSignals.filter((item) => containsAny(item.schema_ref ?? item.label, ["weather", "forecast"])), irrigation_event: rawSignals.filter((item) => containsAny(item.schema_ref ?? item.label, ["irrigation", "event"])) }, water_stress_state: stateNode, forecast, scenario, recommendation, approval, operation, ao_act: aoAct, as_executed: asExecuted, evidence: executionEvidence, acceptance, verification, steps: waterStressSteps({ RAW_SIGNAL: rawSignals[0], OBSERVATION: observations[0], WATER_STRESS_STATE: stateNode, FORECAST: forecast, SCENARIO: scenario, RECOMMENDATION: recommendation, APPROVAL: approval, OPERATION_PLAN: operation, AO_ACT: aoAct, AS_EXECUTED: asExecuted, EVIDENCE: executionEvidence, ACCEPTANCE: acceptance, VERIFICATION: verification }) }, source_inventory: sourceInventory(input), quality: quality(input), gaps, boundary_rules: boundaries(input), legacy_conflict_policy: legacyPolicy(fieldModel.field_id) };
}

export function buildOperatorEvidenceTwinEnvelope(input: OperatorEvidenceTwinAdapterInput): OperatorEvidenceTwinEnvelopeV1 {
  return { ok: true, source: "operator_evidence_twin_adapter", dataScope: "OFFICIAL_OPERATOR_TWIN_API", surface: "OPERATOR", version: "v1", generated_at: input.generatedAt ?? new Date().toISOString(), writeReady: false, dispatchReady: false, approvalReady: false, taskCreationReady: false, memoryWriteReady: false, roiWriteReady: false, operator_evidence_twin_v1: buildOperatorEvidenceTwinViewModel(input) };
}
