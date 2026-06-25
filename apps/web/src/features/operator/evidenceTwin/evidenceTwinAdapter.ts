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

function cleanText(value: unknown): string { return String(value ?? "").trim(); }
function nullableText(value: unknown): string | null { const raw = cleanText(value); return raw ? raw : null; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function writePolicy(): EvidenceTwinWritePolicyV1 { return { write_ready: false, allowed_actions: [] }; }

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
  return array(values === undefined || values === null ? [] : Array.isArray(values) ? values : [values]).map((value) => normalizeEvidenceTwinRef(value, fallbackKind, schemaRef)).filter((ref): ref is EvidenceTwinRefV1 => Boolean(ref)).filter((ref) => { const key = ref.kind + ":" + ref.ref_id + ":" + String(ref.schema_ref ?? ""); if (seen.has(key)) return false; seen.add(key); return true; });
}

function node(id: string, label: string, kind: string, schemaRef: string | null, status: EvidenceTwinNodeV1["status"], evidenceRefs: EvidenceTwinRefV1[] = [], expandPayload: Record<string, unknown> | null = null): EvidenceTwinNodeV1 {
  return { id, label, kind, schema_ref: schemaRef, status, time: { occurred_at: null, observed_at: null, computed_at: null, updated_at: null, latest_ts_ms: null }, quality: { status: status === "MISSING" ? "BLOCKING" : "LIMITED", quality_flags: [], blocking_reasons: status === "MISSING" ? [id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")] : [], confidence_penalty: null }, confidence: { label: null, score: null, level: null }, source_refs: [], evidence_refs: evidenceRefs, expand_payload: expandPayload, ui_policy: { default_collapsed: true, show_raw_payload: false, show_internal_ids: true, show_customer_safe_label: false }, write_policy: writePolicy() };
}

function gap(gapCode: string, label: string, severity: "INFO" | "WARNING" | "BLOCKING", relatedNodeIds: string[] = []): EvidenceTwinGapV1 { return { gap_code: gapCode, label, severity, related_node_ids: relatedNodeIds, suggested_resolution: null }; }
function boundary(row: unknown): EvidenceTwinBoundaryRuleV1 | null { const value = record(row); const ruleCode = cleanText(value.rule_code); return ruleCode ? { rule_code: ruleCode, label: cleanText(value.label), severity: "INFO", enforced: true } : null; }

function field(input: OperatorEvidenceTwinAdapterInput): EvidenceTwinFieldV1 {
  const fieldId = cleanText(input.fieldId) || "field_c8_demo";
  return { field_id: fieldId, field_name: fieldId, crop_text: null, tenant_id: input.scope?.tenant_id ?? null, project_id: input.scope?.project_id ?? null, group_id: input.scope?.group_id ?? null, canonical_route: "/app/operator/fields/" + encodeURIComponent(fieldId) + "/evidence-twin", legacy_routes: ["/operator/twin/fields/" + encodeURIComponent(fieldId)] };
}

function legacyPolicy(fieldId: string): EvidenceTwinLegacyConflictPolicyV1 {
  const safeFieldId = encodeURIComponent(fieldId);
  return { canonical_routes: ["/app/operator/fields/" + safeFieldId + "/evidence-twin", "/app/operator/fields/" + safeFieldId + "/evidence-twin/water-stress"], legacy_routes: ["/operator/twin/fields/" + safeFieldId, "/operator/twin/fields/" + safeFieldId + "/forecast", "/operator/twin/fields/" + safeFieldId + "/scenarios", "/operator/twin/fields/" + safeFieldId + "/evidence", "/operator/twin/fields/" + safeFieldId + "/post-irrigation"], legacy_visible_by_url_only: true, delete_old_pages_first: false, route_governance_required: true };
}

function scenario(input: OperatorEvidenceTwinAdapterInput): WaterStressLoopV1["scenario"] {
  const scenarioPayload = record(record(input.scenarioCompare).scenario_compare_v1 ?? record(input.workspace).scenario_comparison);
  const evidenceRefs = normalizeEvidenceTwinRefs(scenarioPayload.evidence_refs, "scenario", "irrigation_scenario_set_index_v1");
  const options = array(scenarioPayload.options).map((item): WaterStressScenarioOptionV1 => { const option = record(item); const confidenceText = nullableText(option.confidence_text); return { option_id: cleanText(option.option_id), label: cleanText(option.label ?? option.option_id), irrigation_amount_mm: null, scheduled_day: null, risk_delta: nullableText(option.risk_delta), confidence: { label: confidenceText, score: null, level: confidenceText }, failure_conditions: array(option.failure_conditions).map(cleanText).filter(Boolean), evidence_refs: evidenceRefs }; });
  const noAction = Boolean(scenarioPayload.no_action_baseline_present);
  const unavailableReason = nullableText(scenarioPayload.unavailable_reason) ?? (options.length === 0 ? "SCENARIO_OPTIONS_MISSING" : null);
  return { ...node("scenario:" + (nullableText(scenarioPayload.scenario_set_id) ?? "irrigation_scenario_set"), "灌溉情景", "scenario", "irrigation_scenario_set_index_v1", options.length === 0 || !noAction ? "LIMITED" : "AVAILABLE", evidenceRefs, { no_action_baseline_present: noAction, options_count: options.length, unavailable_reason: unavailableReason }), scenario_set_id: nullableText(scenarioPayload.scenario_set_id), no_action_baseline_present: noAction, options, unavailable_reason: unavailableReason };
}

function recommendation(input: OperatorEvidenceTwinAdapterInput): WaterStressLoopV1["recommendation"] {
  const source = record(record(input.workspace).recommendation_candidate);
  const recommendationId = nullableText(source.recommendation_id);
  return { ...node("recommendation:" + (recommendationId ?? "candidate"), "建议候选", "recommendation", "decision_recommendation_index_v1", recommendationId ? "AVAILABLE" : "MISSING", normalizeEvidenceTwinRefs(source.evidence_refs, "recommendation", "decision_recommendation_index_v1"), { human_approval_required: true, no_direct_execution: true }), recommendation_id: recommendationId, selected_scenario_option_id: null, action_type: nullableText(source.action_type), amount_mm: nullableText(source.amount_mm), human_approval_required: true, no_direct_execution: true, approval_created: false, operation_plan_created: false, task_created: false, dispatch_created: false };
}

function sourceInventory(input: OperatorEvidenceTwinAdapterInput): EvidenceTwinSourceInventoryV1 {
  const inventory = record(input.sourceIndexInventory ?? record(input.evidenceQuality).source_index_inventory);
  const rows = array(inventory.source_indexes).map(record);
  return { index_tables: rows.map((row) => ({ table_name: cleanText(row.table_name), label: cleanText(row.label ?? row.table_name), available: Boolean(row.available), row_count: Number(row.row_count ?? 0), latest_ts_ms: typeof row.latest_ts_ms === "number" ? row.latest_ts_ms : null, latest_evidence_refs: normalizeEvidenceTwinRefs(row.latest_evidence_refs, "index_row", cleanText(row.table_name)), scope_columns_present: array(row.scope_columns_present).map(cleanText).filter(Boolean), missing_reason: nullableText(row.missing_reason) })), summary: { table_count: rows.length, available_table_count: rows.filter((row) => Boolean(row.available)).length, total_row_count: rows.reduce((sum, row) => sum + Number(row.row_count ?? 0), 0) } };
}

function boundaries(input: OperatorEvidenceTwinAdapterInput): EvidenceTwinBoundaryRuleV1[] {
  const rows = [record(input.workspace).boundary_rules, record(input.forecastPanel).boundary_rules, record(input.scenarioCompare).boundary_rules, record(input.evidenceQuality).boundary_rules, record(input.postIrrigationVerification).boundary_rules, record(input.h31H45Closure).boundary_rules].flatMap(array).map(boundary).filter((row): row is EvidenceTwinBoundaryRuleV1 => Boolean(row));
  const seen = new Set<string>();
  return [...REQUIRED_BOUNDARY_RULES, ...rows].filter((row) => { if (seen.has(row.rule_code)) return false; seen.add(row.rule_code); return true; });
}

function steps(stepNodes: Record<WaterStressLoopStepCodeV1, EvidenceTwinNodeV1>): WaterStressLoopStepV1[] {
  const order: WaterStressLoopStepCodeV1[] = ["RAW_SIGNAL", "OBSERVATION", "WATER_STRESS_STATE", "FORECAST", "SCENARIO", "RECOMMENDATION", "APPROVAL", "OPERATION_PLAN", "AO_ACT", "AS_EXECUTED", "EVIDENCE", "ACCEPTANCE", "VERIFICATION"];
  return order.map((stepCode, index) => ({ ...stepNodes[stepCode], step_code: stepCode, order: index + 1, required_for_p0: true }));
}

export function buildOperatorEvidenceTwinViewModel(input: OperatorEvidenceTwinAdapterInput): OperatorEvidenceTwinV1 {
  const fieldModel = field(input);
  const rawSignal = node("missing:raw_signal", "原始信号", "raw_signal", null, "MISSING", [], { gap_code: "RAW_SIGNAL_SOURCE_NOT_EXPOSED" });
  const observation = node("missing:observation", "标准化观测", "observation", null, "MISSING", [], { gap_code: "OBSERVATION_SOURCE_NOT_EXPOSED" });
  const waterState = node("missing:water_stress_state", "水分压力状态", "state_estimate", "water_state_estimate_index_v1", "MISSING", [], { gap_code: "WATER_STRESS_STATE_VIEW_MISSING" });
  const forecast = node("forecast:water_stress", "水分预测", "forecast", "root_zone_soil_water_forecast_v1", "MISSING", [], { gap_code: "ROOT_ZONE_SOIL_WATER_FORECAST_MISSING" });
  const scenarioNode = scenario(input);
  const recommendationNode = recommendation(input);
  const approval = node("closure_stage:H36-H39:approval", "人工审批", "approval", "approval_request_v1", "MISSING");
  const operation = node("closure_stage:H36-H39:operation", "作业计划", "operation_plan", "operation_plan_v1", "MISSING");
  const aoAct = node("closure_stage:H40-H42:ao_act", "AO-ACT", "task", "ao_act_task_v0", "MISSING");
  const asExecuted = node("closure_stage:H40-H42:as_executed", "实执记录", "as_executed", "as_executed_record_v1", "MISSING");
  const evidence = node("closure_stage:H43-H44:evidence", "执行证据", "evidence", "evidence_artifact_v1", "MISSING");
  const acceptance = node("closure_stage:H43-H44:acceptance", "执行验收", "acceptance", "acceptance_result_v1", "MISSING");
  const verification = node("verification:water_response", "灌后水分响应验证", "verification", "water_response_verification_v1", "MISSING", [], { gap_code: "WATER_RESPONSE_VERIFICATION_MISSING" });
  const gaps = [gap("RAW_SIGNAL_SOURCE_NOT_EXPOSED", "当前 read surface 未暴露完整 RawSignal 详情。", "WARNING", [rawSignal.id]), gap("OBSERVATION_SOURCE_NOT_EXPOSED", "当前 read surface 未暴露完整 Observation 详情。", "WARNING", [observation.id]), gap("CANOPY_TEMPERATURE_NOT_IN_MAIN_LOOP", "冠层温度尚未进入 P0 主闭环，作为辅助信号缺口显示。", "WARNING", ["missing:canopy_temperature"]), ...(scenarioNode.options.length === 0 ? [gap("SCENARIO_OPTIONS_MISSING", "Scenario options 为空，前端不得生成默认情景。", "BLOCKING", [scenarioNode.id])] : []), ...(!scenarioNode.no_action_baseline_present ? [gap("NO_ACTION_BASELINE_OR_OPTIONS_NOT_AVAILABLE", "Scenario 缺少 no-action baseline 或可用情景选项。", "BLOCKING", [scenarioNode.id])] : []), gap("WATER_RESPONSE_VERIFICATION_MISSING", "缺少灌后水分响应验证，闭环不可标记为完成。", "BLOCKING", [verification.id])];
  return { version: "v1", surface: "OPERATOR", report_kind: "OPERATOR_EVIDENCE_TWIN", request_scope: { ...(input.scope ?? {}), fieldId: fieldModel.field_id, field_id: fieldModel.field_id }, scope_policy: null, field: fieldModel, current_state: { label: "水分状态", code: null, status: "MISSING", confidence: { label: null, score: null, level: null }, quality: { status: "BLOCKING", quality_flags: [], blocking_reasons: ["WATER_STRESS_STATE_VIEW_MISSING"], confidence_penalty: null }, latest_update_time: null, state_refs: [], evidence_refs: [], summary_text: "水分状态缺失" }, lineage: { raw_signals: [rawSignal], observations: [observation], state_estimates: [waterState], evidence: [evidence], verifications: [verification] }, water_stress_loop: { loop_id: "water_stress_loop_v1", label: "水分压力闭环", subtitle: "猎鹰 1 号", inputs: { soil_moisture: [observation], canopy_temperature: [node("missing:canopy_temperature", "冠层温度辅助信号", "observation", "canopy_temperature_state", "MISSING", [], { gap_code: "CANOPY_TEMPERATURE_NOT_IN_MAIN_LOOP" })], weather_forecast: [], irrigation_event: [] }, water_stress_state: waterState, forecast, scenario: scenarioNode, recommendation: recommendationNode, approval, operation, ao_act: aoAct, as_executed: asExecuted, evidence, acceptance, verification, steps: steps({ RAW_SIGNAL: rawSignal, OBSERVATION: observation, WATER_STRESS_STATE: waterState, FORECAST: forecast, SCENARIO: scenarioNode, RECOMMENDATION: recommendationNode, APPROVAL: approval, OPERATION_PLAN: operation, AO_ACT: aoAct, AS_EXECUTED: asExecuted, EVIDENCE: evidence, ACCEPTANCE: acceptance, VERIFICATION: verification }) }, source_inventory: sourceInventory(input), quality: { status: "UNKNOWN", blocking_reason: null, low_quality_reasons: [], simulation_data_present: false, official_data_qualified: false }, gaps, boundary_rules: boundaries(input), legacy_conflict_policy: legacyPolicy(fieldModel.field_id) };
}

export function buildOperatorEvidenceTwinEnvelope(input: OperatorEvidenceTwinAdapterInput): OperatorEvidenceTwinEnvelopeV1 {
  return { ok: true, source: "operator_evidence_twin_adapter", dataScope: "OFFICIAL_OPERATOR_TWIN_API", surface: "OPERATOR", version: "v1", generated_at: input.generatedAt ?? new Date().toISOString(), writeReady: false, dispatchReady: false, approvalReady: false, taskCreationReady: false, memoryWriteReady: false, roiWriteReady: false, operator_evidence_twin_v1: buildOperatorEvidenceTwinViewModel(input) };
}
