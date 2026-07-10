// apps/server/src/runtime/twin_runtime/continuation_record_set_builder_v1.ts
// Purpose: compose one deterministic MCFT-CAP-02 A2 eight-object continuation candidate from a persisted handoff, frozen Evidence Window, pinned Runtime Config, and pure hourly Dynamics result.
// Boundary: pure canonical construction and validation only; no database, lease, filesystem, environment, wall clock, range, restart, Forecast success, Scenario, Recommendation, or action.

import type { HourlyWaterBalanceResultV1 } from "../../domain/soil_water/hourly_water_balance_v1.js";
import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
} from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  CONTINUATION_ASSIMILATION_REASON_CODES_V1,
  CONTINUATION_FORECAST_REASON_CODES_V1,
  CONTINUATION_HEALTH_LIMITATION_REASON_CODES_V1,
  CONTINUATION_TICK_LIMITATIONS_V1,
} from "../../domain/twin_runtime/continuation_contracts_v1.js";
import { validateContinuationRecordSetV1 } from "../../domain/twin_runtime/continuation_cross_ref_validator_v1.js";
import {
  CONTINUATION_OPERATION_VARIANT_V1,
  deriveContinuationOperationIdentityV1,
  type ContinuationMemberObjectTypeV1,
  type ContinuationOperationKeyV1,
} from "../../domain/twin_runtime/continuation_operation_identity_v1.js";
import {
  buildContinuationRecordSetIdentityV1,
  type ContinuationRecordSetV1,
} from "../../domain/twin_runtime/continuation_record_set_identity_v1.js";
import {
  CONTINUATION_DYNAMICS_MODEL_ID_V1,
  CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1,
  CONTINUATION_NO_OBSERVATION_POLICY_ID_V1,
  CONTINUATION_PROCESS_UNCERTAINTY_POLICY_ID_V1,
  validateContinuationRuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/continuation_runtime_config_v1.js";
import type { ContinuationEvidenceWindowV1 } from "./continuation_evidence_window_service_v1.js";
import type { PreparedNextTickInputV1, TwinScopeKeyV1 } from "./ports.js";

export type BuildContinuationRecordSetInputV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
  created_at: string;
  handoff: PreparedNextTickInputV1;
  runtime_config: CanonicalObjectEnvelopeV1;
  evidence_window: ContinuationEvidenceWindowV1;
  dynamics: HourlyWaterBalanceResultV1;
};

function requiredCanonicalIsoV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function exactScopeV1(actual: TwinScopeKeyV1, expected: TwinScopeKeyV1, code: string): void {
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[key] !== expected[key]) throw new Error(`${code}:${key}`);
  }
}

function addOneHourIsoV1(value: string): string {
  return new Date(Date.parse(requiredCanonicalIsoV1(value, "CONTINUATION_LOGICAL_TIME_INVALID")) + 60 * 60 * 1000).toISOString();
}

function decimalNumberV1(value: string, code: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}

export function buildContinuationRecordSetV1(input: BuildContinuationRecordSetInputV1): ContinuationRecordSetV1 {
  exactScopeV1(input.handoff, input.scope, "CONTINUATION_HANDOFF_SCOPE_MISMATCH");
  const logicalTime = requiredCanonicalIsoV1(input.logical_time, "CONTINUATION_LOGICAL_TIME_INVALID");
  requiredCanonicalIsoV1(input.created_at, "CONTINUATION_CREATED_AT_INVALID");
  if (input.handoff.next_logical_tick_time !== logicalTime) throw new Error("CONTINUATION_HANDOFF_LOGICAL_TIME_MISMATCH");
  if (input.evidence_window.logical_time !== logicalTime) throw new Error("CONTINUATION_EVIDENCE_LOGICAL_TIME_MISMATCH");
  if (input.dynamics.mass_balance_trace.mass_balance_error_mm !== "0.000000") throw new Error("CONTINUATION_MASS_BALANCE_NOT_CLOSED");
  if (input.runtime_config.object_type !== "twin_runtime_config_v1") throw new Error("CONTINUATION_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  exactScopeV1(input.runtime_config, input.scope, "CONTINUATION_RUNTIME_CONFIG_SCOPE_MISMATCH");
  validateContinuationRuntimeConfigPayloadV1(input.runtime_config.payload);

  const operationKey: ContinuationOperationKeyV1 = {
    scope: structuredClone(input.scope),
    lineage_id: input.handoff.lineage_id,
    revision_id: input.handoff.revision_id,
    logical_time: logicalTime,
    operation_variant: CONTINUATION_OPERATION_VARIANT_V1,
  };
  const operationIdentity = deriveContinuationOperationIdentityV1(operationKey);
  const ids = operationIdentity.member_object_ids;
  const nextTickLogicalTime = addOneHourIsoV1(logicalTime);
  const evidenceRefs = [...input.evidence_window.selected_evidence_refs].sort();
  const sourceRefs = [input.handoff.reality_binding_ref];
  const limitations = [
    "CONTROLLED_SYNTHETIC",
    "NOT_FIELD_CALIBRATED",
    "NO_OBSERVATION_UPDATE_APPLIED",
    "NO_SUCCESSFUL_FORECAST",
  ];

  const buildMember = (
    objectType: ContinuationMemberObjectTypeV1,
    payload: Record<string, unknown>,
    memberEvidenceRefs: string[] = evidenceRefs,
  ): CanonicalObjectEnvelopeV1 => {
    const member: CanonicalObjectEnvelopeV1 = {
      object_id: ids[objectType],
      object_type: objectType,
      schema_version: "v1",
      ...input.scope,
      logical_time: logicalTime,
      as_of: logicalTime,
      source_refs: [...sourceRefs],
      evidence_refs: [...memberEvidenceRefs].sort(),
      runtime_config_ref: input.runtime_config.object_id,
      runtime_config_hash: input.runtime_config.determinism_hash,
      idempotency_key: deriveSemanticObjectIdV1("a2_member_key", {
        continuation_operation_key_hash: operationIdentity.continuation_operation_key_hash,
        object_type: objectType,
      }),
      determinism_hash: "",
      limitations: [...limitations],
      created_at: input.created_at,
      lineage_id: operationKey.lineage_id,
      revision_id: operationKey.revision_id,
      payload,
    };
    member.determinism_hash = computeMemberDeterminismHashV1(member as unknown as Record<string, unknown>);
    return member;
  };

  const published = input.dynamics.published_state;
  const basis = input.dynamics.computation_basis;
  const candidateObservationRefs = input.evidence_window.soil_moisture_records
    .map((record) => record.source_record_id)
    .sort();
  const stateMean = decimalNumberV1(published.root_zone_vwc_fraction.mean, "CONTINUATION_STATE_MEAN_INVALID");
  const stateVariance = decimalNumberV1(published.root_zone_vwc_fraction.variance, "CONTINUATION_STATE_VARIANCE_INVALID");

  const members: CanonicalObjectEnvelopeV1[] = [
    buildMember("twin_evidence_window_v1", {
      window_rule_id: input.evidence_window.window_rule_id,
      exact_hour_interval_policy_id: input.evidence_window.exact_hour_interval_policy_id,
      identical_duplicate_winner_policy_id: input.evidence_window.identical_duplicate_winner_policy_id,
      window_start_exclusive: input.evidence_window.window_start_exclusive,
      window_end_inclusive: input.evidence_window.window_end_inclusive,
      frozen: true,
      entries: input.evidence_window.selected_records,
      selected_records: input.evidence_window.selected_records,
      excluded_records: input.evidence_window.excluded_records,
      deduplicated_records: input.evidence_window.deduplicated_records,
      selected_evidence_refs: evidenceRefs,
      consumed_evidence_refs: input.evidence_window.consumed_evidence_refs,
      context_only_evidence_refs: input.evidence_window.context_only_evidence_refs,
      crop_stage_context: input.evidence_window.crop_stage_context,
      coverage: input.evidence_window.coverage,
      exclusion_counts: input.evidence_window.exclusion_counts,
      semantic_digest: input.evidence_window.semantic_digest,
    }),
    buildMember("twin_state_transition_v1", {
      transition_kind: "CONTINUATION",
      previous_posterior_ref: input.handoff.previous_posterior_ref,
      previous_posterior_hash: input.handoff.previous_posterior_hash,
      process_model_status: "APPLIED",
      process_model_id: CONTINUATION_DYNAMICS_MODEL_ID_V1,
      process_model_version: 1,
      propagation_start: input.evidence_window.window_start_exclusive,
      propagation_end: logicalTime,
      previous_state_runtime_config_ref: input.handoff.previous_state_runtime_config_ref,
      current_runtime_config_ref: input.runtime_config.object_id,
      mass_balance_trace: input.dynamics.mass_balance_trace,
      mass_balance_trace_hash: input.dynamics.mass_balance_trace_hash,
      evidence_window_ref: ids.twin_evidence_window_v1,
      assimilation_update_ref: ids.twin_assimilation_update_v1,
      posterior_state_ref: ids.twin_state_estimate_v1,
    }),
    buildMember("twin_assimilation_update_v1", {
      status: "NOT_APPLIED",
      disposition: "DEFERRED_TO_MCFT_CAP_03",
      candidate_observation_refs: candidateObservationRefs,
      consumed_observation_refs: [],
      predicted_observation: null,
      innovation: null,
      residual: null,
      assimilation_gain: null,
      prior_mean: stateMean,
      posterior_mean: stateMean,
      prior_variance: stateVariance,
      posterior_variance: stateVariance,
      reason_codes: [...CONTINUATION_ASSIMILATION_REASON_CODES_V1],
      policy_id: CONTINUATION_NO_OBSERVATION_POLICY_ID_V1,
      state_transition_ref: ids.twin_state_transition_v1,
      posterior_state_ref: ids.twin_state_estimate_v1,
    }),
    buildMember("twin_state_estimate_v1", {
      state_kind: "POSTERIOR",
      previous_posterior_ref: input.handoff.previous_posterior_ref,
      transition_ref: ids.twin_state_transition_v1,
      assimilation_update_ref: ids.twin_assimilation_update_v1,
      evidence_window_ref: ids.twin_evidence_window_v1,
      reality_binding_ref: input.handoff.reality_binding_ref,
      reality_binding_hash: input.handoff.reality_binding_hash,
      root_zone_storage_mm: {
        mean: decimalNumberV1(published.root_zone_storage_mm.mean, "CONTINUATION_STORAGE_MEAN_INVALID"),
        variance: decimalNumberV1(basis.storage_variance_mm2_decimal.value, "CONTINUATION_STORAGE_VARIANCE_INVALID"),
        stddev: decimalNumberV1(published.root_zone_storage_mm.stddev, "CONTINUATION_STORAGE_STDDEV_INVALID"),
      },
      root_zone_vwc_fraction: {
        mean: stateMean,
        variance: stateVariance,
        stddev: decimalNumberV1(published.root_zone_vwc_fraction.stddev, "CONTINUATION_STATE_STDDEV_INVALID"),
      },
      uncertainty: {
        policy_id: CONTINUATION_PROCESS_UNCERTAINTY_POLICY_ID_V1,
        policy_version: 1,
        budget: input.dynamics.uncertainty_budget,
        interval: input.dynamics.uncertainty_budget.interval,
      },
      computation_basis: basis,
      available_water_fraction: decimalNumberV1(published.available_water_fraction, "CONTINUATION_AWF_INVALID"),
      available_water_fraction_trace: published.available_water_fraction_trace,
      depletion_from_field_capacity_mm: decimalNumberV1(published.depletion_from_field_capacity_mm, "CONTINUATION_DEPLETION_INVALID"),
      mass_balance_trace_hash: input.dynamics.mass_balance_trace_hash,
      confidence: {
        status: "NOT_ESTABLISHED",
        reason_code: "NO_CALIBRATED_CONFIDENCE_MODEL",
      },
      use_eligibility: {
        state_valid: true,
        posterior_chain_eligible: true,
        forecast_source_eligible: true,
        recommendation_input_eligible: false,
        action_input_eligible: false,
      },
    }),
    buildMember("twin_forecast_run_v1", {
      status: "BLOCKED",
      points: [],
      scenario_eligible: false,
      source_posterior_ref: ids.twin_state_estimate_v1,
      successful_forecast_ref: null,
      reason_codes: [...CONTINUATION_FORECAST_REASON_CODES_V1],
      policy_id: CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1,
    }),
    buildMember("twin_runtime_tick_v1", {
      transaction_family: "A_STATE_TICK_COMMIT",
      operation_variant: CONTINUATION_OPERATION_VARIANT_V1,
      status: "COMPLETED_WITH_LIMITATIONS",
      transition_kind: "CONTINUATION",
      limitations: [...CONTINUATION_TICK_LIMITATIONS_V1],
      evidence_window_ref: ids.twin_evidence_window_v1,
      state_transition_ref: ids.twin_state_transition_v1,
      assimilation_update_ref: ids.twin_assimilation_update_v1,
      posterior_state_ref: ids.twin_state_estimate_v1,
      forecast_result_ref: ids.twin_forecast_run_v1,
      checkpoint_ref: ids.twin_runtime_checkpoint_v1,
      next_tick_logical_time: nextTickLogicalTime,
    }),
    buildMember("twin_runtime_checkpoint_v1", {
      checkpoint_kind: "CONTINUATION",
      previous_checkpoint_ref: input.handoff.previous_checkpoint_ref,
      last_completed_tick_ref: ids.twin_runtime_tick_v1,
      last_posterior_state_ref: ids.twin_state_estimate_v1,
      forecast_result_ref: ids.twin_forecast_run_v1,
      successful_forecast_ref: null,
      next_tick_logical_time: nextTickLogicalTime,
      tick_sequence: input.handoff.previous_tick_sequence + 1,
    }),
    buildMember("twin_runtime_health_v1", {
      operation_status: "CONTINUATION_STATE_COMMITTED_WITH_BLOCKED_FORECAST",
      runtime_mode: "REPLAY",
      active_lineage_ref: input.handoff.active_lineage_ref,
      lineage_id: input.handoff.lineage_id,
      revision_id: input.handoff.revision_id,
      tick_ref: ids.twin_runtime_tick_v1,
      checkpoint_ref: ids.twin_runtime_checkpoint_v1,
      state_ref: ids.twin_state_estimate_v1,
      forecast_result_ref: ids.twin_forecast_run_v1,
      successful_forecast_ref: null,
      limitation_reason_codes: [...CONTINUATION_HEALTH_LIMITATION_REASON_CODES_V1],
    }),
  ];

  const memberHashes = Object.fromEntries(
    members.map((member) => [member.object_type, member.determinism_hash]),
  ) as Record<ContinuationMemberObjectTypeV1, string>;
  const identity = buildContinuationRecordSetIdentityV1({
    continuation_operation_key: operationKey,
    aggregate_identity_input: {
      previous_posterior_ref: input.handoff.previous_posterior_ref,
      previous_posterior_hash: input.handoff.previous_posterior_hash,
      previous_checkpoint_ref: input.handoff.previous_checkpoint_ref,
      previous_checkpoint_hash: input.handoff.previous_checkpoint_hash,
      runtime_config_ref: input.runtime_config.object_id,
      runtime_config_hash: input.runtime_config.determinism_hash,
      reality_binding_ref: input.handoff.reality_binding_ref,
      reality_binding_hash: input.handoff.reality_binding_hash,
      evidence_window_semantic_digest: input.evidence_window.semantic_digest,
      crop_stage_context_ref: input.evidence_window.crop_stage_context.context_ref,
      crop_stage_context_hash: input.evidence_window.crop_stage_context.context_hash,
      dynamics_model_version: "ROOT_ZONE_HOURLY_WATER_BALANCE_V1:1",
      uncertainty_policy_version: "CONTROLLED_ADDITIVE_PROCESS_UNCERTAINTY_BUDGET_V1:1",
      no_observation_update_policy_version: "DEFER_OBSERVATION_ASSIMILATION_TO_MCFT_CAP_03_V1:1",
      forecast_block_policy_version: "MCFT_CAP_02_PINNED_CONFIG_NO_FORECAST_COMPONENT_V1:1",
      member_determinism_hashes: memberHashes,
    },
  });
  const recordSet: ContinuationRecordSetV1 = { ...identity, members };
  validateContinuationRecordSetV1(recordSet);
  return recordSet;
}
