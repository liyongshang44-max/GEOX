// Purpose: compose one explicit CAP-05 receipt-consuming hourly tick by adapting canonical H Action Feedback into the existing CAP-04 A1 Dynamics input path, then reusing unchanged State, Assimilation, 72-hour Forecast, Scenario and persistence orchestration.
// Boundary: one requested tick only; no range loop, restart/backfill, route, scheduler, wall clock, approval, dispatch, Recommendation, AO-ACT, calibration, model activation, migration or CAP-06 authority.

import type { Cap05ActionFeedbackEnvelopeV1 } from "../../domain/twin_runtime/feedback_canonical_contracts_v1.js";
import type { Cap04ExecutionConfigResolverPortV1 } from "../../domain/twin_runtime/runtime_config_execution_view_v1.js";
import {
  CAP05_ACTION_FEEDBACK_LATE_POLICY_ID_V1,
  selectCap05ActionFeedbackForTickV1,
  type Cap05ActionFeedbackLatePolicyIdV1,
  type Cap05ActionFeedbackTickSelectionTraceV1,
} from "./action_feedback_tick_selector_v1.js";
import {
  Cap04ForecastScenarioSingleTickServiceV1,
  type Cap04SingleTickPersistencePortV1,
  type ExecuteCap04SingleTickInputV1,
  type ExecuteCap04SingleTickResultV1,
} from "./forecast_scenario_single_tick_service_v1.js";
import { Cap05InheritedCap04ExecutionConfigResolverV1 } from "./cap05_inherited_cap04_execution_config_resolver_v1.js";
import { PrepareNextTickInputServiceV1 } from "./next_tick_input_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  RuntimeConfigRepositoryPortV1,
  TwinScopeKeyV1,
} from "./ports.js";

export const CAP05_ACTION_FEEDBACK_REPLAY_ADAPTER_ID_V1 = "CANONICAL_H_TO_DYNAMICS_EXECUTION_RECORD_V1" as const;

export type Cap05ActionFeedbackSourcePortV1 = {
  loadActionFeedbackCandidates(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
  }): Promise<readonly Cap05ActionFeedbackEnvelopeV1[]>;
};

export type ExecuteCap05ReceiptConsumingTickResultV1 = ExecuteCap04SingleTickResultV1 & {
  action_feedback_selection: Cap05ActionFeedbackTickSelectionTraceV1 | null;
};

function qualityForAdapterRecordV1(
  feedback: Cap05ActionFeedbackEnvelopeV1,
  disposition: string,
): "PASS" | "LIMITED" | "FAIL" {
  if (disposition === "EXCLUDED_INELIGIBLE") return "FAIL";
  return feedback.payload.source_quality;
}

function actionFeedbackReplayRecordV1(input: {
  feedback: Cap05ActionFeedbackEnvelopeV1;
  selection: Cap05ActionFeedbackTickSelectionTraceV1;
}): CanonicalReplayEvidenceRecordV1 {
  const feedback = input.feedback;
  const payload = feedback.payload;
  const entry = input.selection.entries.find((candidate) => candidate.action_feedback_ref === feedback.object_id);
  if (!entry) throw new Error("CAP05_RECEIPT_TICK_SELECTION_TRACE_ENTRY_MISSING");
  const canonicalPayload = {
    event_id: payload.event_id,
    executed_amount_mm: Number(payload.actual_amount_mm),
    coverage_fraction: Number(payload.spatial_coverage_fraction),
    target_scope_equivalent_irrigation_mm: Number(payload.target_scope_equivalent_irrigation_mm),
    unit: "mm",
    source_object_type: "twin_action_feedback_v1",
    execution_status: payload.execution_status,
    validation_status: payload.validation_status,
    source_quality: payload.source_quality,
    eligible_for_state_input: payload.eligible_for_state_input,
    evidence_cutoff_time: input.selection.evidence_cutoff_time,
    selector_id: input.selection.selector_id,
    adapter_id: CAP05_ACTION_FEEDBACK_REPLAY_ADAPTER_ID_V1,
  };
  return {
    tenant_id: feedback.tenant_id,
    project_id: feedback.project_id,
    group_id: feedback.group_id,
    field_id: feedback.field_id,
    season_id: feedback.season_id,
    zone_id: feedback.zone_id,
    dataset_id: "canonical_action_feedback_runtime_adapter_v1",
    source_record_id: feedback.object_id,
    source_record_hash: feedback.determinism_hash,
    record_type: "irrigation_execution_evidence_v1",
    binding_id: payload.binding_id,
    origin_source_kind: "CANONICAL_TWIN_ACTION_FEEDBACK",
    origin_source_id: payload.origin_source_id,
    epistemic_class: "OBSERVED",
    available_to_runtime_at: payload.available_to_runtime_at,
    role_time: {
      executed_at: payload.execution_end,
      execution_start: payload.execution_start,
      execution_end: payload.execution_end,
      ingested_at: payload.ingested_at,
      available_to_runtime_at: payload.available_to_runtime_at,
    },
    quality: {
      status: qualityForAdapterRecordV1(feedback, entry.disposition),
      action_feedback_selection_disposition: entry.disposition,
      action_feedback_selection_reason_code: entry.reason_code,
    },
    source_payload: structuredClone(canonicalPayload),
    canonical_payload: structuredClone(canonicalPayload),
    source_unit: "mm",
    canonical_unit: "mm",
    conversion_rule: {
      id: CAP05_ACTION_FEEDBACK_REPLAY_ADAPTER_ID_V1,
      version: "1",
      coverage_applied_by_adapter: false,
      volume_conversion_performed: false,
    },
    limitations: [
      "CANONICAL_H_ACTION_FEEDBACK_ADAPTER",
      "NO_SPATIAL_EXECUTION_OVERLAP_DEDUPLICATION",
      entry.disposition,
      ...(entry.reason_code ? [entry.reason_code] : []),
    ],
  };
}

class Cap05ReceiptConsumingEvidenceSourceV1 implements ReplayEvidenceSourcePortV1 {
  private lastSelectionValue: Cap05ActionFeedbackTickSelectionTraceV1 | null = null;

  constructor(
    private readonly baseEvidenceSource: ReplayEvidenceSourcePortV1,
    private readonly actionFeedbackSource: Cap05ActionFeedbackSourcePortV1,
    private readonly latePolicyId: Cap05ActionFeedbackLatePolicyIdV1,
  ) {}

  resetSelection(): void {
    this.lastSelectionValue = null;
  }

  lastSelection(): Cap05ActionFeedbackTickSelectionTraceV1 | null {
    return this.lastSelectionValue ? structuredClone(this.lastSelectionValue) : null;
  }

  async loadCandidateRecords(input: {
    scope: TwinScopeKeyV1;
    logical_time: string;
  }): Promise<readonly CanonicalReplayEvidenceRecordV1[]> {
    const baseRecords = await this.baseEvidenceSource.loadCandidateRecords(input);
    if (baseRecords.some((record) => record.record_type === "irrigation_execution_evidence_v1")) {
      throw new Error("CAP05_RECEIPT_TICK_LEGACY_AND_ACTION_FEEDBACK_CONFLICT");
    }
    const feedbackObjects = await this.actionFeedbackSource.loadActionFeedbackCandidates(input);
    const selection = selectCap05ActionFeedbackForTickV1({
      scope: input.scope,
      logical_time: input.logical_time,
      feedback_objects: feedbackObjects,
      late_policy_id: this.latePolicyId,
    });
    this.lastSelectionValue = structuredClone(selection.trace);
    if (!selection.candidate || !selection.selected_feedback) {
      throw new Error("CAP05_RECEIPT_TICK_ACTION_FEEDBACK_REQUIRED");
    }
    const adaptedRecords = feedbackObjects.map((feedback) => actionFeedbackReplayRecordV1({
      feedback,
      selection: selection.trace,
    }));
    return [...structuredClone(baseRecords), ...adaptedRecords];
  }
}

export class Cap05ReceiptConsumingForecastScenarioTickServiceV1 {
  private readonly evidenceSource: Cap05ReceiptConsumingEvidenceSourceV1;
  private readonly inner: Cap04ForecastScenarioSingleTickServiceV1;

  constructor(
    handoffService: PrepareNextTickInputServiceV1,
    baseEvidenceSource: ReplayEvidenceSourcePortV1,
    actionFeedbackSource: Cap05ActionFeedbackSourcePortV1,
    runtimeConfigRepository: RuntimeConfigRepositoryPortV1,
    persistence: Cap04SingleTickPersistencePortV1,
    executionConfigResolver: Cap04ExecutionConfigResolverPortV1 = new Cap05InheritedCap04ExecutionConfigResolverV1(),
    latePolicyId: Cap05ActionFeedbackLatePolicyIdV1 = CAP05_ACTION_FEEDBACK_LATE_POLICY_ID_V1,
  ) {
    this.evidenceSource = new Cap05ReceiptConsumingEvidenceSourceV1(baseEvidenceSource, actionFeedbackSource, latePolicyId);
    this.inner = new Cap04ForecastScenarioSingleTickServiceV1(
      handoffService,
      this.evidenceSource,
      runtimeConfigRepository,
      persistence,
      executionConfigResolver,
    );
  }

  async executeOneTick(input: ExecuteCap04SingleTickInputV1): Promise<ExecuteCap05ReceiptConsumingTickResultV1> {
    this.evidenceSource.resetSelection();
    const result = await this.inner.executeOneTick(input);
    return {
      ...result,
      action_feedback_selection: this.evidenceSource.lastSelection(),
    };
  }
}
