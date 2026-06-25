// apps/web/src/features/operator/evidenceTwin/evidenceTwinAdapter.ts
// Purpose: define the H52 Operator Evidence Twin P0 adapter contract and pure normalization helpers.
// Boundary: this module performs no network requests, no React rendering, no routing, and no write actions.
// H52.1-a guardrail: existing Operator Twin read surfaces are adapter inputs; they are not the final Evidence Twin contract.

import type {
  OperatorDataCoverageRow,
  OperatorEvidenceTraceItem,
  OperatorFieldTwinEvidenceQualityV1,
  OperatorFieldTwinForecastPanelV1,
  OperatorFieldTwinPostIrrigationVerificationV1,
  OperatorFieldTwinScenarioCompareV1,
  OperatorFieldTwinWorkspaceV1,
  OperatorQualitySummary,
  OperatorScenarioCompareOption,
  OperatorTwinBoundaryRule,
  OperatorTwinGap,
  OperatorTwinRequestScope,
  OperatorTwinSourceIndexInventoryRow,
  OperatorTwinSourceIndexInventoryV1,
} from "../../../api/operatorTwin";
import type {
  OperatorTwinClosureStageGroup,
  OperatorTwinH31H45ClosureV1,
} from "../../../api/operatorTwinClosure";

export type EvidenceTwinStatusV1 =
  | "AVAILABLE"
  | "LIMITED"
  | "MISSING"
  | "BLOCKING"
  | "NOT_APPLICABLE"
  | "UNKNOWN"
  | "NOT_VERIFIABLE"
  | string;

export type EvidenceTwinRefV1 = {
  kind:
    | "fact"
    | "index_row"
    | "observation"
    | "state"
    | "estimate"
    | "forecast"
    | "scenario"
    | "recommendation"
    | "approval"
    | "operation_plan"
    | "task"
    | "receipt"
    | "as_executed"
    | "artifact"
    | "acceptance"
    | "verification"
    | "external"
    | string;
  ref_id: string;
  schema_ref: string | null;
  label: string | null;
  href: string | null;
};

export type EvidenceTwinWritePolicyV1 = {
  write_ready: false;
  allowed_actions: [];
};

export type EvidenceTwinNodeV1 = {
  id: string;
  label: string;
  kind: string;
  schema_ref: string | null;
  status: EvidenceTwinStatusV1;
  time: {
    occurred_at: string | null;
    observed_at: string | null;
    computed_at: string | null;
    updated_at: string | null;
    latest_ts_ms: number | null;
  };
  quality: {
    status: "AVAILABLE" | "LIMITED" | "BLOCKING" | "UNKNOWN" | string;
    quality_flags: string[];
    blocking_reasons: string[];
    confidence_penalty: string | null;
  };
  confidence: {
    label: string | null;
    score: number | null;
    level: string | null;
  };
  source_refs: EvidenceTwinRefV1[];
  evidence_refs: EvidenceTwinRefV1[];
  expand_payload: Record<string, unknown> | null;
  ui_policy: {
    default_collapsed: boolean;
    show_raw_payload: boolean;
    show_internal_ids: boolean;
    show_customer_safe_label: boolean;
  };
  write_policy: EvidenceTwinWritePolicyV1;
};

export type EvidenceTwinGapV1 = {
  gap_code: string;
  label: string;
  severity: "INFO" | "WARNING" | "BLOCKING" | string;
  related_node_ids: string[];
  suggested_resolution: string | null;
};

export type EvidenceTwinBoundaryRuleV1 = {
  rule_code: string;
  label: string;
  severity: "INFO" | "WARNING" | "BLOCKING" | string;
  enforced: boolean;
};

export type EvidenceTwinFieldV1 = {
  field_id: string;
  field_name: string;
  crop_text: string | null;
  tenant_id: string | null;
  project_id: string | null;
  group_id: string | null;
  canonical_route: string;
  legacy_routes: string[];
};

export type EvidenceTwinCurrentStateV1 = {
  label: string;
  code: string | null;
  status: string;
  confidence: EvidenceTwinNodeV1["confidence"];
  quality: EvidenceTwinNodeV1["quality"];
  latest_update_time: string | null;
  state_refs: EvidenceTwinRefV1[];
  evidence_refs: EvidenceTwinRefV1[];
  summary_text: string;
};

export type EvidenceTwinLineageV1 = {
  raw_signals: EvidenceTwinNodeV1[];
  observations: EvidenceTwinNodeV1[];
  state_estimates: EvidenceTwinNodeV1[];
  evidence: EvidenceTwinNodeV1[];
  verifications: EvidenceTwinNodeV1[];
};

export type WaterStressLoopStepCodeV1 =
  | "RAW_SIGNAL"
  | "OBSERVATION"
  | "WATER_STRESS_STATE"
  | "FORECAST"
  | "SCENARIO"
  | "RECOMMENDATION"
  | "APPROVAL"
  | "OPERATION_PLAN"
  | "AO_ACT"
  | "AS_EXECUTED"
  | "EVIDENCE"
  | "ACCEPTANCE"
  | "VERIFICATION";

export type WaterStressLoopStepV1 = EvidenceTwinNodeV1 & {
  step_code: WaterStressLoopStepCodeV1;
  order: number;
  required_for_p0: boolean;
};

export type WaterStressScenarioOptionV1 = {
  option_id: string;
  label: string;
  irrigation_amount_mm: number | null;
  scheduled_day: string | null;
  risk_delta: string | null;
  confidence: EvidenceTwinNodeV1["confidence"];
  failure_conditions: string[];
  evidence_refs: EvidenceTwinRefV1[];
};

export type WaterStressLoopV1 = {
  loop_id: "water_stress_loop_v1";
  label: "水分压力闭环";
  subtitle: "猎鹰 1 号";
  inputs: {
    soil_moisture: EvidenceTwinNodeV1[];
    canopy_temperature: EvidenceTwinNodeV1[];
    weather_forecast: EvidenceTwinNodeV1[];
    irrigation_event: EvidenceTwinNodeV1[];
  };
  water_stress_state: EvidenceTwinNodeV1;
  forecast: EvidenceTwinNodeV1;
  scenario: EvidenceTwinNodeV1 & {
    scenario_set_id: string | null;
    no_action_baseline_present: boolean;
    options: WaterStressScenarioOptionV1[];
    unavailable_reason: string | null;
  };
  recommendation: EvidenceTwinNodeV1 & {
    recommendation_id: string | null;
    selected_scenario_option_id: string | null;
    action_type: string | null;
    amount_mm: number | string | null;
    human_approval_required: true;
    no_direct_execution: true;
    approval_created: false;
    operation_plan_created: false;
    task_created: false;
    dispatch_created: false;
  };
  approval: EvidenceTwinNodeV1;
  operation: EvidenceTwinNodeV1;
  ao_act: EvidenceTwinNodeV1;
  as_executed: EvidenceTwinNodeV1;
  evidence: EvidenceTwinNodeV1;
  acceptance: EvidenceTwinNodeV1;
  verification: EvidenceTwinNodeV1;
  steps: WaterStressLoopStepV1[];
};

export type EvidenceTwinSourceInventoryV1 = {
  index_tables: Array<{
    table_name: string;
    label: string;
    available: boolean;
    row_count: number;
    latest_ts_ms: number | null;
    latest_evidence_refs: EvidenceTwinRefV1[];
    scope_columns_present: string[];
    missing_reason: string | null;
  }>;
  summary: {
    table_count: number;
    available_table_count: number;
    total_row_count: number;
  };
};

export type EvidenceTwinQualityV1 = {
  status: "AVAILABLE" | "LIMITED" | "BLOCKING" | "UNKNOWN" | string;
  blocking_reason: string | null;
  low_quality_reasons: Array<{
    source_table: string;
    reason: string;
    evidence_refs: EvidenceTwinRefV1[];
    missing_windows: string[];
  }>;
  simulation_data_present: boolean;
  official_data_qualified: boolean;
};

export type EvidenceTwinLegacyConflictPolicyV1 = {
  canonical_routes: string[];
  legacy_routes: string[];
  legacy_visible_by_url_only: boolean;
  delete_old_pages_first: false;
  route_governance_required: boolean;
};

export type OperatorEvidenceTwinV1 = {
  version: "v1";
  surface: "OPERATOR";
  report_kind: "OPERATOR_EVIDENCE_TWIN";
  request_scope: OperatorTwinRequestScope & {
    fieldId?: string | null;
    field_id?: string | null;
  };
  scope_policy: OperatorFieldTwinWorkspaceV1["scope_policy"] | null;
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

export type OperatorEvidenceTwinEnvelopeV1 = {
  ok: true;
  source: "operator_evidence_twin_adapter";
  dataScope: "OFFICIAL_OPERATOR_TWIN_API";
  surface: "OPERATOR";
  version: "v1";
  generated_at: string;
  writeReady: false;
  dispatchReady: false;
  approvalReady: false;
  taskCreationReady: false;
  memoryWriteReady: false;
  roiWriteReady: false;
  operator_evidence_twin_v1: OperatorEvidenceTwinV1;
};

export type OperatorEvidenceTwinAdapterInput = {
  fieldId: string;
  generatedAt?: string | null;
  scope?: OperatorTwinRequestScope | null;
  sourceIndexInventory?: OperatorTwinSourceIndexInventoryV1 | null;
  workspace?: OperatorFieldTwinWorkspaceV1 | null;
  forecastPanel?: OperatorFieldTwinForecastPanelV1 | null;
  scenarioCompare?: OperatorFieldTwinScenarioCompareV1 | null;
  evidenceQuality?: OperatorFieldTwinEvidenceQualityV1 | null;
  postIrrigationVerification?: OperatorFieldTwinPostIrrigationVerificationV1 | null;
  h31H45Closure?: OperatorTwinH31H45ClosureV1 | null;
};

export const H52_P0_WRITE_FLAGS = {
  writeReady: false,
  dispatchReady: false,
  approvalReady: false,
  taskCreationReady: false,
  memoryWriteReady: false,
  roiWriteReady: false,
} as const;

const EMPTY_WRITE_POLICY: EvidenceTwinWritePolicyV1 = {
  write_ready: false,
  allowed_actions: [],
};

const DEFAULT_UI_POLICY: EvidenceTwinNodeV1["ui_policy"] = {
  default_collapsed: true,
  show_raw_payload: false,
  show_internal_ids: true,
  show_customer_safe_label: false,
};

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

const WATER_STRESS_STEP_DEFINITIONS: Array<{
  step_code: WaterStressLoopStepCodeV1;
  order: number;
  label: string;
  kind: string;
  required_for_p0: boolean;
}> = [
  { step_code: "RAW_SIGNAL", order: 1, label: "原始信号", kind: "raw_signal", required_for_p0: true },
  { step_code: "OBSERVATION", order: 2, label: "标准化观测", kind: "observation", required_for_p0: true },
  { step_code: "WATER_STRESS_STATE", order: 3, label: "水分压力状态", kind: "state_estimate", required_for_p0: true },
  { step_code: "FORECAST", order: 4, label: "水分预测", kind: "forecast", required_for_p0: true },
  { step_code: "SCENARIO", order: 5, label: "灌溉情景", kind: "scenario", required_for_p0: true },
  { step_code: "RECOMMENDATION", order: 6, label: "建议候选", kind: "recommendation", required_for_p0: true },
  { step_code: "APPROVAL", order: 7, label: "人工审批", kind: "approval", required_for_p0: true },
  { step_code: "OPERATION_PLAN", order: 8, label: "作业计划", kind: "operation_plan", required_for_p0: true },
  { step_code: "AO_ACT", order: 9, label: "AO-ACT", kind: "task", required_for_p0: true },
  { step_code: "AS_EXECUTED", order: 10, label: "实执记录", kind: "as_executed", required_for_p0: true },
  { step_code: "EVIDENCE", order: 11, label: "执行证据", kind: "evidence", required_for_p0: true },
  { step_code: "ACCEPTANCE", order: 12, label: "执行验收", kind: "acceptance", required_for_p0: true },
  { step_code: "VERIFICATION", order: 13, label: "灌后水分响应验证", kind: "verification", required_for_p0: true },
];

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  const raw = cleanText(value);
  return raw ? raw : null;
}

function numericOrNull(value: unknown): number | null {
  const raw = cleanText(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function stableId(prefix: string, value: unknown): string {
  const raw = cleanText(value);
  return raw ? prefix + ":" + raw : "missing:" + prefix;
}

function uniqueRefs(refs: EvidenceTwinRefV1[]): EvidenceTwinRefV1[] {
  const seen = new Set<string>();
  const out: EvidenceTwinRefV1[] = [];
  for (const ref of refs) {
    const key = ref.kind + ":" + ref.ref_id + ":" + String(ref.schema_ref ?? "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

export function inferEvidenceTwinRefKind(refId: string): EvidenceTwinRefV1["kind"] {
  const raw = cleanText(refId).toLowerCase();
  if (raw.startsWith("fact_")) return "fact";
  if (raw.startsWith("task_") || raw.startsWith("act_")) return "task";
  if (raw.includes("receipt")) return "receipt";
  if (raw.includes("as_executed")) return "as_executed";
  if (raw.includes("acceptance")) return "acceptance";
  if (raw.includes("verification") || raw.startsWith("wrv_")) return "verification";
  if (raw.includes("scenario")) return "scenario";
  if (raw.includes("recommendation") || raw.startsWith("rec_")) return "recommendation";
  return "external";
}

export function normalizeEvidenceTwinRef(
  value: unknown,
  fallbackKind: EvidenceTwinRefV1["kind"] = "external",
  schemaRef: string | null = null,
): EvidenceTwinRefV1 | null {
  if (typeof value === "string" || typeof value === "number") {
    const refId = cleanText(value);
    if (!refId) return null;
    const inferredKind = fallbackKind === "external" ? inferEvidenceTwinRefKind(refId) : fallbackKind;
    return { kind: inferredKind, ref_id: refId, schema_ref: schemaRef, label: refId, href: null };
  }

  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const refId = cleanText(record.ref_id ?? record.id ?? record.fact_id ?? record.source_fact_id);
  if (!refId) return null;

  return {
    kind: cleanText(record.kind) || fallbackKind,
    ref_id: refId,
    schema_ref: nullableText(record.schema_ref ?? schemaRef),
    label: nullableText(record.label ?? refId),
    href: nullableText(record.href),
  };
}

export function normalizeEvidenceTwinRefs(
  values: unknown,
  fallbackKind: EvidenceTwinRefV1["kind"] = "external",
  schemaRef: string | null = null,
): EvidenceTwinRefV1[] {
  const rawValues = Array.isArray(values) ? values : values === undefined || values === null ? [] : [values];
  return uniqueRefs(rawValues.map((value) => normalizeEvidenceTwinRef(value, fallbackKind, schemaRef)).filter((ref): ref is EvidenceTwinRefV1 => Boolean(ref)));
}

function createEvidenceTwinNode(args: {
  id: string;
  label: string;
  kind: string;
  schema_ref?: string | null;
  status?: EvidenceTwinStatusV1;
  latest_ts_ms?: number | null;
  quality_status?: string | null;
  quality_flags?: string[];
  blocking_reasons?: string[];
  confidence_label?: string | null;
  source_refs?: EvidenceTwinRefV1[];
  evidence_refs?: EvidenceTwinRefV1[];
  expand_payload?: Record<string, unknown> | null;
}): EvidenceTwinNodeV1 {
  return {
    id: args.id,
    label: args.label,
    kind: args.kind,
    schema_ref: args.schema_ref ?? null,
    status: args.status ?? "UNKNOWN",
    time: {
      occurred_at: null,
      observed_at: null,
      computed_at: null,
      updated_at: null,
      latest_ts_ms: args.latest_ts_ms ?? null,
    },
    quality: {
      status: args.quality_status ?? "UNKNOWN",
      quality_flags: args.quality_flags ?? [],
      blocking_reasons: args.blocking_reasons ?? [],
      confidence_penalty: null,
    },
    confidence: {
      label: args.confidence_label ?? null,
      score: null,
      level: args.confidence_label ?? null,
    },
    source_refs: args.source_refs ?? [],
    evidence_refs: args.evidence_refs ?? [],
    expand_payload: args.expand_payload ?? null,
    ui_policy: DEFAULT_UI_POLICY,
    write_policy: EMPTY_WRITE_POLICY,
  };
}

function createMissingNode(id: string, label: string, kind: string, schemaRef: string | null, reason: string): EvidenceTwinNodeV1 {
  return createEvidenceTwinNode({
    id,
    label,
    kind,
    schema_ref: schemaRef,
    status: "MISSING",
    quality_status: "BLOCKING",
    blocking_reasons: [reason],
    expand_payload: { gap_code: reason },
  });
}

function mapOperatorGap(gap: OperatorTwinGap, relatedNodeIds: string[] = []): EvidenceTwinGapV1 {
  return {
    gap_code: gap.gap_code,
    label: gap.label,
    severity: gap.severity,
    related_node_ids: relatedNodeIds,
    suggested_resolution: null,
  };
}

function createGap(gapCode: string, label: string, severity: "INFO" | "WARNING" | "BLOCKING", relatedNodeIds: string[] = []): EvidenceTwinGapV1 {
  return {
    gap_code: gapCode,
    label,
    severity,
    related_node_ids: relatedNodeIds,
    suggested_resolution: null,
  };
}

function mapBoundaryRule(rule: OperatorTwinBoundaryRule): EvidenceTwinBoundaryRuleV1 {
  return {
    rule_code: rule.rule_code,
    label: rule.label,
    severity: "INFO",
    enforced: true,
  };
}

function mergeBoundaryRules(...groups: Array<Array<EvidenceTwinBoundaryRuleV1 | OperatorTwinBoundaryRule> | null | undefined>): EvidenceTwinBoundaryRuleV1[] {
  const rows: EvidenceTwinBoundaryRuleV1[] = [];
  for (const group of groups) {
    for (const row of group ?? []) {
      if ("enforced" in row) rows.push(row);
      else rows.push(mapBoundaryRule(row));
    }
  }

  const merged = [...REQUIRED_BOUNDARY_RULES, ...rows];
  const seen = new Set<string>();
  return merged.filter((rule) => {
    if (seen.has(rule.rule_code)) return false;
    seen.add(rule.rule_code);
    return true;
  });
}

function mapSourceInventory(sourceIndexInventory: OperatorTwinSourceIndexInventoryV1 | null | undefined): EvidenceTwinSourceInventoryV1 {
  const rows = sourceIndexInventory?.source_indexes ?? [];
  return {
    index_tables: rows.map((row: OperatorTwinSourceIndexInventoryRow) => ({
      table_name: row.table_name,
      label: row.label,
      available: row.available,
      row_count: row.row_count,
      latest_ts_ms: row.latest_ts_ms,
      latest_evidence_refs: normalizeEvidenceTwinRefs(row.latest_evidence_refs, "index_row", row.table_name),
      scope_columns_present: row.scope_columns_present,
      missing_reason: row.missing_reason,
    })),
    summary: {
      table_count: sourceIndexInventory?.summary?.table_count ?? rows.length,
      available_table_count: sourceIndexInventory?.summary?.available_table_count ?? rows.filter((row) => row.available).length,
      total_row_count: sourceIndexInventory?.summary?.total_row_count ?? rows.reduce((sum, row) => sum + row.row_count, 0),
    },
  };
}

function mapInventoryRowsToRawSignalNodes(sourceIndexInventory: OperatorTwinSourceIndexInventoryV1 | null | undefined): EvidenceTwinNodeV1[] {
  return (sourceIndexInventory?.source_indexes ?? []).map((row) =>
    createEvidenceTwinNode({
      id: stableId("raw_signal_source_index", row.table_name),
      label: row.label || row.table_name,
      kind: "raw_signal",
      schema_ref: row.table_name,
      status: row.available ? "LIMITED" : "MISSING",
      latest_ts_ms: row.latest_ts_ms,
      quality_status: row.available ? "LIMITED" : "BLOCKING",
      blocking_reasons: row.missing_reason ? [row.missing_reason] : [],
      evidence_refs: normalizeEvidenceTwinRefs(row.latest_evidence_refs, "index_row", row.table_name),
      expand_payload: {
        table_name: row.table_name,
        row_count: row.row_count,
        raw_detail_exposed: false,
      },
    }),
  );
}

function mapDataCoverageRowsToObservationNodes(evidenceQuality: OperatorFieldTwinEvidenceQualityV1 | null | undefined): EvidenceTwinNodeV1[] {
  return (evidenceQuality?.data_coverage_matrix_v1?.rows ?? []).map((row: OperatorDataCoverageRow) =>
    createEvidenceTwinNode({
      id: stableId("observation", row.source_table || row.metric),
      label: row.metric || row.source_table,
      kind: "observation",
      schema_ref: row.source_table,
      status: row.available ? "AVAILABLE" : "MISSING",
      latest_ts_ms: row.latest_ts_ms,
      quality_status: row.available ? row.quality_status ?? "AVAILABLE" : "BLOCKING",
      quality_flags: row.quality_flags,
      blocking_reasons: row.missing_windows,
      confidence_label: row.confidence,
      evidence_refs: normalizeEvidenceTwinRefs(row.evidence_refs, "index_row", row.source_table),
      expand_payload: {
        row_count: row.row_count,
        coverage_ratio: row.coverage_ratio,
        max_gap_ms: row.max_gap_ms,
        actual_points: row.actual_points,
        expected_points: row.expected_points,
        raw_observation_detail_exposed: false,
      },
    }),
  );
}

function mapEvidenceTraceToEvidenceNodes(evidenceQuality: OperatorFieldTwinEvidenceQualityV1 | null | undefined): EvidenceTwinNodeV1[] {
  return (evidenceQuality?.evidence_trace_v1?.trace_items ?? []).map((item: OperatorEvidenceTraceItem) =>
    createEvidenceTwinNode({
      id: stableId("evidence_trace", item.source_table || item.label),
      label: item.label || item.source_table,
      kind: "evidence",
      schema_ref: item.source_table,
      status: item.available ? "AVAILABLE" : "MISSING",
      latest_ts_ms: item.latest_ts_ms,
      quality_status: item.available ? "AVAILABLE" : "BLOCKING",
      quality_flags: item.quality_flags,
      evidence_refs: normalizeEvidenceTwinRefs(item.evidence_refs, "index_row", item.source_table),
      expand_payload: { stage: item.stage, source_table: item.source_table },
    }),
  );
}

function mapQualitySummary(qualitySummary: OperatorQualitySummary | null | undefined): EvidenceTwinQualityV1 {
  return {
    status: qualitySummary?.status ?? "UNKNOWN",
    blocking_reason: qualitySummary?.blocking_reason ?? null,
    low_quality_reasons: (qualitySummary?.low_quality_reasons ?? []).map((reason) => ({
      source_table: reason.source_table,
      reason: reason.reason,
      evidence_refs: normalizeEvidenceTwinRefs(reason.evidence_refs, "index_row", reason.source_table),
      missing_windows: reason.missing_windows,
    })),
    simulation_data_present: Boolean(qualitySummary?.simulation_data_present),
    official_data_qualified: Boolean(qualitySummary?.official_data_qualified),
  };
}

function mapWorkspaceCurrentState(workspace: OperatorFieldTwinWorkspaceV1 | null | undefined): EvidenceTwinCurrentStateV1 {
  const currentState = workspace?.current_state;
  return {
    label: "水分状态",
    code: nullableText(currentState?.state_text),
    status: currentState?.low_confidence ? "LIMITED" : currentState ? "AVAILABLE" : "MISSING",
    confidence: {
      label: currentState?.confidence_text ?? null,
      score: null,
      level: currentState?.confidence_text ?? null,
    },
    quality: {
      status: currentState?.low_confidence ? "LIMITED" : currentState ? "AVAILABLE" : "BLOCKING",
      quality_flags: currentState?.low_confidence ? ["LOW_CONFIDENCE"] : [],
      blocking_reasons: currentState ? [] : ["WATER_STRESS_STATE_VIEW_MISSING"],
      confidence_penalty: currentState?.low_confidence ? "LOW_CONFIDENCE" : null,
    },
    latest_update_time: null,
    state_refs: currentState ? normalizeEvidenceTwinRefs(currentState.evidence_refs, "estimate", "water_state_estimate_index_v1") : [],
    evidence_refs: currentState ? normalizeEvidenceTwinRefs(currentState.evidence_refs, "estimate", "water_state_estimate_index_v1") : [],
    summary_text: currentState?.risk_text ?? currentState?.state_text ?? "水分状态缺失",
  };
}

function mapWorkspaceStateEstimateNodes(workspace: OperatorFieldTwinWorkspaceV1 | null | undefined): EvidenceTwinNodeV1[] {
  const currentState = workspace?.current_state;
  const nodes = workspace?.layers
    ?.filter((layer) => layer.layer === "Estimate")
    .map((layer) =>
      createEvidenceTwinNode({
        id: stableId("state_estimate_layer", layer.title),
        label: layer.title,
        kind: "state_estimate",
        schema_ref: "operator_field_twin_workspace_v1.layers",
        status: layer.status === "AVAILABLE" ? "AVAILABLE" : "LIMITED",
        quality_status: layer.status,
        evidence_refs: normalizeEvidenceTwinRefs(layer.evidence_refs, "estimate", "operator_field_twin_workspace_v1"),
        expand_payload: { body: layer.body, layer: layer.layer },
      }),
    ) ?? [];

  if (!currentState) return nodes;

  return [
    createEvidenceTwinNode({
      id: "current_state:water_state_estimate",
      label: "当前水分状态估计",
      kind: "state_estimate",
      schema_ref: "water_state_estimate_index_v1",
      status: currentState.low_confidence ? "LIMITED" : "AVAILABLE",
      quality_status: currentState.low_confidence ? "LIMITED" : "AVAILABLE",
      quality_flags: currentState.low_confidence ? ["LOW_CONFIDENCE"] : [],
      confidence_label: currentState.confidence_text,
      evidence_refs: normalizeEvidenceTwinRefs(currentState.evidence_refs, "estimate", "water_state_estimate_index_v1"),
      expand_payload: {
        state_text: currentState.state_text,
        risk_text: currentState.risk_text,
        classification: currentState.classification,
      },
    }),
    ...nodes,
  ];
}

function mapScenarioOption(option: OperatorScenarioCompareOption, evidenceRefs: EvidenceTwinRefV1[]): WaterStressScenarioOptionV1 {
  return {
    option_id: option.option_id,
    label: option.label,
    irrigation_amount_mm: null,
    scheduled_day: null,
    risk_delta: option.risk_delta,
    confidence: {
      label: option.confidence_text,
      score: null,
      level: option.confidence_text,
    },
    failure_conditions: option.failure_conditions,
    evidence_refs: evidenceRefs,
  };
}

function mapScenarioNode(
  workspace: OperatorFieldTwinWorkspaceV1 | null | undefined,
  scenarioCompare: OperatorFieldTwinScenarioCompareV1 | null | undefined,
): WaterStressLoopV1["scenario"] {
  const scenario = scenarioCompare?.scenario_compare_v1 ?? workspace?.scenario_comparison ?? null;
  const evidenceRefs = normalizeEvidenceTwinRefs(scenario?.evidence_refs, "scenario", "irrigation_scenario_set_index_v1");
  const options = (scenario?.options ?? []).map((option) => mapScenarioOption(option, evidenceRefs));
  const noActionBaselinePresent = Boolean(scenario?.no_action_baseline_present);
  const unavailableReason = scenario?.unavailable_reason ?? (options.length === 0 ? "SCENARIO_OPTIONS_MISSING" : null);
  const status = !scenario ? "MISSING" : options.length === 0 || !noActionBaselinePresent ? "LIMITED" : scenario.status;

  return {
    ...createEvidenceTwinNode({
      id: stableId("scenario", scenario?.scenario_set_id ?? "irrigation_scenario_set"),
      label: "灌溉情景",
      kind: "scenario",
      schema_ref: "irrigation_scenario_set_index_v1",
      status,
      quality_status: status === "AVAILABLE" ? "AVAILABLE" : "LIMITED",
      blocking_reasons: [unavailableReason].filter((item): item is string => Boolean(item)),
      evidence_refs: evidenceRefs,
      expand_payload: {
        scenario_set_id: scenario?.scenario_set_id ?? null,
        no_action_baseline_present: noActionBaselinePresent,
        options_count: options.length,
        unavailable_reason: unavailableReason,
      },
    }),
    scenario_set_id: scenario?.scenario_set_id ?? null,
    no_action_baseline_present: noActionBaselinePresent,
    options,
    unavailable_reason: unavailableReason,
  };
}

function mapRecommendationNode(workspace: OperatorFieldTwinWorkspaceV1 | null | undefined): WaterStressLoopV1["recommendation"] {
  const recommendation = workspace?.recommendation_candidate ?? null;
  const evidenceRefs = normalizeEvidenceTwinRefs(recommendation?.evidence_refs, "recommendation", "decision_recommendation_index_v1");
  return {
    ...createEvidenceTwinNode({
      id: stableId("recommendation", recommendation?.recommendation_id ?? "candidate"),
      label: "建议候选",
      kind: "recommendation",
      schema_ref: "decision_recommendation_index_v1",
      status: recommendation?.recommendation_id ? "AVAILABLE" : "MISSING",
      quality_status: recommendation?.recommendation_id ? "AVAILABLE" : "LIMITED",
      evidence_refs: evidenceRefs,
      expand_payload: {
        recommendation_id: recommendation?.recommendation_id ?? null,
        action_type: recommendation?.action_type ?? null,
        amount_mm: recommendation?.amount_mm ?? null,
        human_approval_required: true,
        no_direct_execution: true,
      },
    }),
    recommendation_id: recommendation?.recommendation_id ?? null,
    selected_scenario_option_id: null,
    action_type: recommendation?.action_type ?? null,
    amount_mm: recommendation?.amount_mm ?? null,
    human_approval_required: true,
    no_direct_execution: true,
    approval_created: false,
    operation_plan_created: false,
    task_created: false,
    dispatch_created: false,
  };
}

function closureStageByCode(closure: OperatorTwinH31H45ClosureV1 | null | undefined, code: string): OperatorTwinClosureStageGroup | null {
  return closure?.stage_groups?.find((stage) => stage.code === code) ?? null;
}

function mapClosureStageNode(
  closure: OperatorTwinH31H45ClosureV1 | null | undefined,
  code: string,
  label: string,
  kind: string,
  schemaRef: string | null,
): EvidenceTwinNodeV1 {
  const stage = closureStageByCode(closure, code);
  return createEvidenceTwinNode({
    id: stableId("closure_stage", code),
    label,
    kind,
    schema_ref: schemaRef,
    status: stage?.status === "AVAILABLE" ? "AVAILABLE" : "MISSING",
    quality_status: stage?.status === "AVAILABLE" ? "AVAILABLE" : "LIMITED",
    blocking_reasons: stage?.status === "AVAILABLE" ? [] : [code + "_MISSING"],
    evidence_refs: normalizeEvidenceTwinRefs(stage?.evidence_refs, "external", schemaRef),
    expand_payload: stage ? { code: stage.code, summary_text: stage.summary_text } : null,
  });
}

function mapPostIrrigationVerificationNode(
  postIrrigation: OperatorFieldTwinPostIrrigationVerificationV1 | null | undefined,
  closure: OperatorTwinH31H45ClosureV1 | null | undefined,
): EvidenceTwinNodeV1 {
  const summary = postIrrigation?.verification_summary;
  const responseSummary = closure?.response_summary;
  const evidenceRefs = normalizeEvidenceTwinRefs(
    postIrrigation?.execution_evidence_v1?.evidence_refs ?? closureStageByCode(closure, "H45")?.evidence_refs,
    "verification",
    "water_response_verification_v1",
  );
  const verificationId = postIrrigation?.operation_context?.acceptance_result_id ?? responseSummary?.verification_id ?? closure?.execution_tail?.water_response_verification_id;
  const status = summary?.status ?? responseSummary?.status ?? (verificationId ? "AVAILABLE" : "NOT_VERIFIABLE");

  return createEvidenceTwinNode({
    id: stableId("verification", verificationId ?? "water_response"),
    label: "灌后水分响应验证",
    kind: "verification",
    schema_ref: "water_response_verification_v1",
    status: verificationId ? status : "MISSING",
    quality_status: verificationId ? "AVAILABLE" : "LIMITED",
    blocking_reasons: postIrrigation?.verification_gaps?.map((gap) => gap.gap_code) ?? (verificationId ? [] : ["WATER_RESPONSE_VERIFICATION_MISSING"]),
    evidence_refs: evidenceRefs,
    expand_payload: {
      operation_context: postIrrigation?.operation_context ?? closure?.execution_tail ?? null,
      response_delta_v1: postIrrigation?.response_delta_v1 ?? null,
      response_summary: responseSummary ?? null,
      verification_summary: summary ?? null,
    },
  });
}

function mapForecastNode(
  workspace: OperatorFieldTwinWorkspaceV1 | null | undefined,
  forecastPanel: OperatorFieldTwinForecastPanelV1 | null | undefined,
): EvidenceTwinNodeV1 {
  const forecast = forecastPanel?.forecast_window_v1;
  const workspaceForecast = workspace?.forecast_window;
  const evidenceRefs = normalizeEvidenceTwinRefs(forecast?.evidence_refs, "forecast", "root_zone_soil_water_forecast_v1");
  const hasForecast = Boolean(forecast || workspaceForecast);
  return createEvidenceTwinNode({
    id: "forecast:water_stress",
    label: "水分预测",
    kind: "forecast",
    schema_ref: forecast ? "operator_field_twin_forecast_panel_v1" : "operator_field_twin_workspace_v1.forecast_window",
    status: hasForecast ? (forecast?.forecast_horizon_limited ?? workspaceForecast?.forecast_horizon_limited ? "LIMITED" : "AVAILABLE") : "MISSING",
    quality_status: hasForecast ? "LIMITED" : "BLOCKING",
    blocking_reasons: hasForecast ? [forecast?.reason ?? workspaceForecast?.reason].filter((item): item is string => Boolean(item)) : ["ROOT_ZONE_SOIL_WATER_FORECAST_MISSING"],
    evidence_refs: evidenceRefs,
    expand_payload: {
      available_horizon: forecast?.available_horizon ?? workspaceForecast?.available_horizon ?? null,
      unavailable_horizons: forecast?.unavailable_horizons ?? workspaceForecast?.unavailable_horizons ?? [],
      reason: forecast?.reason ?? workspaceForecast?.reason ?? "ROOT_ZONE_SOIL_WATER_FORECAST_MISSING",
    },
  });
}

function buildWaterStressSteps(nodes: {
  rawSignal: EvidenceTwinNodeV1;
  observation: EvidenceTwinNodeV1;
  waterStressState: EvidenceTwinNodeV1;
  forecast: EvidenceTwinNodeV1;
  scenario: EvidenceTwinNodeV1;
  recommendation: EvidenceTwinNodeV1;
  approval: EvidenceTwinNodeV1;
  operation: EvidenceTwinNodeV1;
  aoAct: EvidenceTwinNodeV1;
  asExecuted: EvidenceTwinNodeV1;
  evidence: EvidenceTwinNodeV1;
  acceptance: EvidenceTwinNodeV1;
  verification: EvidenceTwinNodeV1;
}): WaterStressLoopStepV1[] {
  const byCode: Record<WaterStressLoopStepCodeV1, EvidenceTwinNodeV1> = {
    RAW_SIGNAL: nodes.rawSignal,
    OBSERVATION: nodes.observation,
    WATER_STRESS_STATE: nodes.waterStressState,
    FORECAST: nodes.forecast,
    SCENARIO: nodes.scenario,
    RECOMMENDATION: nodes.recommendation,
    APPROVAL: nodes.approval,
    OPERATION_PLAN: nodes.operation,
    AO_ACT: nodes.aoAct,
    AS_EXECUTED: nodes.asExecuted,
    EVIDENCE: nodes.evidence,
    ACCEPTANCE: nodes.acceptance,
    VERIFICATION: nodes.verification,
  };

  return WATER_STRESS_STEP_DEFINITIONS.map((step) => ({
    ...byCode[step.step_code],
    label: step.label,
    kind: step.kind,
    step_code: step.step_code,
    order: step.order,
    required_for_p0: step.required_for_p0,
  }));
}

function buildGaps(input: OperatorEvidenceTwinAdapterInput, lineage: EvidenceTwinLineageV1, scenario: WaterStressLoopV1["scenario"], verification: EvidenceTwinNodeV1): EvidenceTwinGapV1[] {
  const gaps: EvidenceTwinGapV1[] = [];

  gaps.push(...(input.workspace?.data_gaps ?? []).map((gap) => mapOperatorGap(gap)));
  gaps.push(...(input.forecastPanel?.data_gaps ?? []).map((gap) => mapOperatorGap(gap, ["forecast:water_stress"])));
  gaps.push(...(input.scenarioCompare?.data_gaps ?? []).map((gap) => mapOperatorGap(gap, [scenario.id])));
  gaps.push(...(input.evidenceQuality?.data_gaps ?? []).map((gap) => mapOperatorGap(gap)));
  gaps.push(...(input.postIrrigationVerification?.verification_gaps ?? []).map((gap) => mapOperatorGap(gap, [verification.id])));

  if (lineage.raw_signals.length === 0 || lineage.raw_signals.every((node) => node.expand_payload?.raw_detail_exposed === false)) {
    gaps.push(createGap("RAW_SIGNAL_SOURCE_NOT_EXPOSED", "当前 read surface 未暴露完整 RawSignal 详情。", "WARNING", lineage.raw_signals.map((node) => node.id)));
  }

  if (lineage.observations.length === 0 || lineage.observations.every((node) => node.expand_payload?.raw_observation_detail_exposed === false)) {
    gaps.push(createGap("OBSERVATION_SOURCE_NOT_EXPOSED", "当前 read surface 未暴露完整 Observation 详情。", "WARNING", lineage.observations.map((node) => node.id)));
  }

  if (scenario.options.length === 0) {
    gaps.push(createGap("SCENARIO_OPTIONS_MISSING", "Scenario options 为空，前端不得生成默认情景。", "BLOCKING", [scenario.id]));
  }

  if (!scenario.no_action_baseline_present) {
    gaps.push(createGap("NO_ACTION_BASELINE_OR_OPTIONS_NOT_AVAILABLE", "Scenario 缺少 no-action baseline 或可用情景选项。", "BLOCKING", [scenario.id]));
  }

  if (verification.status === "MISSING" || verification.status === "NOT_VERIFIABLE") {
    gaps.push(createGap("WATER_RESPONSE_VERIFICATION_MISSING", "缺少灌后水分响应验证，闭环不可标记为完成。", "BLOCKING", [verification.id]));
  }

  const seen = new Set<string>();
  return gaps.filter((gap) => {
    const key = gap.gap_code + ":" + gap.related_node_ids.join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildField(input: OperatorEvidenceTwinAdapterInput): EvidenceTwinFieldV1 {
  const fieldId = cleanText(input.fieldId) || cleanText(input.workspace?.field_context?.field_id) || "field_c8_demo";
  return {
    field_id: fieldId,
    field_name: input.workspace?.field_context?.field_name ?? input.forecastPanel?.field_context?.field_name ?? input.scenarioCompare?.field_context?.field_name ?? input.evidenceQuality?.field_context?.field_name ?? input.postIrrigationVerification?.field_context?.field_name ?? fieldId,
    crop_text: input.workspace?.field_context?.crop_text ?? input.forecastPanel?.field_context?.crop_text ?? input.scenarioCompare?.field_context?.crop_text ?? input.evidenceQuality?.field_context?.crop_text ?? input.postIrrigationVerification?.field_context?.crop_text ?? null,
    tenant_id: input.scope?.tenant_id ?? null,
    project_id: input.scope?.project_id ?? null,
    group_id: input.scope?.group_id ?? null,
    canonical_route: "/app/operator/fields/" + encodeURIComponent(fieldId) + "/evidence-twin",
    legacy_routes: ["/operator/twin/fields/" + encodeURIComponent(fieldId)],
  };
}

function buildLegacyConflictPolicy(fieldId: string): EvidenceTwinLegacyConflictPolicyV1 {
  const encodedFieldId = encodeURIComponent(fieldId);
  return {
    canonical_routes: [
      "/app/operator/fields/" + encodedFieldId + "/evidence-twin",
      "/app/operator/fields/" + encodedFieldId + "/evidence-twin/water-stress",
    ],
    legacy_routes: [
      "/operator/twin/fields/" + encodedFieldId,
      "/operator/twin/fields/" + encodedFieldId + "/forecast",
      "/operator/twin/fields/" + encodedFieldId + "/scenarios",
      "/operator/twin/fields/" + encodedFieldId + "/evidence",
      "/operator/twin/fields/" + encodedFieldId + "/post-irrigation",
    ],
    legacy_visible_by_url_only: true,
    delete_old_pages_first: false,
    route_governance_required: true,
  };
}

export function buildOperatorEvidenceTwinViewModel(input: OperatorEvidenceTwinAdapterInput): OperatorEvidenceTwinV1 {
  const field = buildField(input);
  const sourceInventory = mapSourceInventory(input.sourceIndexInventory ?? input.evidenceQuality?.source_index_inventory);
  const rawSignals = mapInventoryRowsToRawSignalNodes(input.sourceIndexInventory ?? input.evidenceQuality?.source_index_inventory);
  const observations = mapDataCoverageRowsToObservationNodes(input.evidenceQuality);
  const stateEstimates = mapWorkspaceStateEstimateNodes(input.workspace);
  const evidenceNodes = mapEvidenceTraceToEvidenceNodes(input.evidenceQuality);
  const verification = mapPostIrrigationVerificationNode(input.postIrrigationVerification, input.h31H45Closure);
  const forecast = mapForecastNode(input.workspace, input.forecastPanel);
  const scenario = mapScenarioNode(input.workspace, input.scenarioCompare);
  const recommendation = mapRecommendationNode(input.workspace);
  const waterStressState = stateEstimates[0] ?? createMissingNode("missing:water_stress_state", "水分压力状态", "state_estimate", "water_state_estimate_index_v1", "WATER_STRESS_STATE_VIEW_MISSING");
  const rawSignalStep = rawSignals[0] ?? createMissingNode("missing:raw_signal", "原始信号", "raw_signal", null, "RAW_SIGNAL_SOURCE_NOT_EXPOSED");
  const observationStep = observations[0] ?? createMissingNode("missing:observation", "标准化观测", "observation", null, "OBSERVATION_SOURCE_NOT_EXPOSED");
  const approval = mapClosureStageNode(input.h31H45Closure, "H36-H39", "人工审批", "approval", "approval_request_v1");
  const operation = mapClosureStageNode(input.h31H45Closure, "H36-H39", "作业计划", "operation_plan", "operation_plan_v1");
  const aoAct = mapClosureStageNode(input.h31H45Closure, "H40-H42", "AO-ACT", "task", "ao_act_task_v0");
  const asExecuted = mapClosureStageNode(input.h31H45Closure, "H40-H42", "实执记录", "as_executed", "as_executed_record_v1");
  const executionEvidence = mapClosureStageNode(input.h31H45Closure, "H43-H44", "执行证据", "evidence", "evidence_artifact_v1");
  const acceptance = mapClosureStageNode(input.h31H45Closure, "H43-H44", "执行验收", "acceptance", "acceptance_result_v1");
  const lineage: EvidenceTwinLineageV1 = {
    raw_signals: rawSignals,
    observations,
    state_estimates: stateEstimates,
    evidence: evidenceNodes,
    verifications: [verification],
  };
  const gaps = buildGaps(input, lineage, scenario, verification);
  const boundaryRules = mergeBoundaryRules(
    input.workspace?.boundary_rules,
    input.forecastPanel?.boundary_rules,
    input.scenarioCompare?.boundary_rules,
    input.evidenceQuality?.boundary_rules,
    input.postIrrigationVerification?.boundary_rules,
    input.h31H45Closure?.boundary_rules,
  );

  return {
    version: "v1",
    surface: "OPERATOR",
    report_kind: "OPERATOR_EVIDENCE_TWIN",
    request_scope: {
      ...(input.scope ?? {}),
      fieldId: field.field_id,
      field_id: field.field_id,
    },
    scope_policy: input.workspace?.scope_policy ?? input.forecastPanel?.scope_policy ?? input.scenarioCompare?.scope_policy ?? input.evidenceQuality?.scope_policy ?? input.postIrrigationVerification?.scope_policy ?? null,
    field,
    current_state: mapWorkspaceCurrentState(input.workspace),
    lineage,
    water_stress_loop: {
      loop_id: "water_stress_loop_v1",
      label: "水分压力闭环",
      subtitle: "猎鹰 1 号",
      inputs: {
        soil_moisture: observations.filter((node) => node.id.includes("soil") || node.schema_ref?.includes("soil")),
        canopy_temperature: [createMissingNode("missing:canopy_temperature", "冠层温度辅助信号", "observation", "canopy_temperature_state", "CANOPY_TEMPERATURE_NOT_IN_MAIN_LOOP")],
        weather_forecast: rawSignals.filter((node) => node.schema_ref?.includes("weather")),
        irrigation_event: [],
      },
      water_stress_state: waterStressState,
      forecast,
      scenario,
      recommendation,
      approval,
      operation,
      ao_act: aoAct,
      as_executed: asExecuted,
      evidence: executionEvidence,
      acceptance,
      verification,
      steps: buildWaterStressSteps({
        rawSignal: rawSignalStep,
        observation: observationStep,
        waterStressState,
        forecast,
        scenario,
        recommendation,
        approval,
        operation,
        aoAct,
        asExecuted,
        evidence: executionEvidence,
        acceptance,
        verification,
      }),
    },
    source_inventory: sourceInventory,
    quality: mapQualitySummary(input.evidenceQuality?.quality_summary),
    gaps,
    boundary_rules: boundaryRules,
    legacy_conflict_policy: buildLegacyConflictPolicy(field.field_id),
  };
}

export function buildOperatorEvidenceTwinEnvelope(input: OperatorEvidenceTwinAdapterInput): OperatorEvidenceTwinEnvelopeV1 {
  return {
    ok: true,
    source: "operator_evidence_twin_adapter",
    dataScope: "OFFICIAL_OPERATOR_TWIN_API",
    surface: "OPERATOR",
    version: "v1",
    generated_at: input.generatedAt ?? new Date().toISOString(),
    ...H52_P0_WRITE_FLAGS,
    operator_evidence_twin_v1: buildOperatorEvidenceTwinViewModel(input),
  };
}
