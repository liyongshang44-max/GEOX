// apps/server/src/runtime/twin_runtime/assimilated_continuation_record_set_builder_v1.ts
// Purpose: compose one deterministic MCFT-CAP-03 A2 eight-object candidate from a persisted handoff, finalized CAP-03 Evidence Window, propagated prior, and pure assimilation result.
// Boundary: pure canonical construction and validation only; no database, lease, persistence, filesystem, environment, wall clock, range execution, Forecast success, Scenario, Recommendation, or action.

import type { HourlyWaterBalanceResultV1 } from "../../domain/soil_water/hourly_water_balance_v1.js";
import type { AssimilatedContinuationPosteriorV1 } from "../../domain/soil_water/assimilated_continuation_posterior_v1.js";
import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
} from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1,
  type AssimilatedContinuationUpdatePayloadV1,
} from "../../domain/twin_runtime/assimilated_continuation_contracts_v1.js";
import {
  buildAssimilatedContinuationRecordSetIdentityV1,
  type AssimilatedContinuationRecordSetV1,
} from "../../domain/twin_runtime/assimilated_continuation_record_set_identity_v1.js";
import {
  ASSIMILATED_CONTINUATION_METHOD_ID_V1,
  ASSIMILATED_CONTINUATION_OBSERVATION_SELECTOR_ID_V1,
  validateAssimilatedContinuationRuntimeConfigPayloadV1,
  type AssimilatedContinuationRuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/assimilated_continuation_runtime_config_v1.js";
import {
  CONTINUATION_DYNAMICS_MODEL_ID_V1,
  CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1,
  CONTINUATION_PROCESS_UNCERTAINTY_POLICY_ID_V1,
} from "../../domain/twin_runtime/continuation_runtime_config_v1.js";
import {
  CONTINUATION_OPERATION_VARIANT_V1,
  deriveContinuationOperationIdentityV1,
  type ContinuationMemberObjectTypeV1,
  type ContinuationOperationKeyV1,
} from "../../domain/twin_runtime/continuation_operation_identity_v1.js";
import { roundDecimalHalfAwayFromZeroV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import { validateAssimilatedContinuationCrossReferencesV1 } from "../../domain/twin_runtime/assimilated_continuation_cross_ref_validator_v1.js";
import type { AssimilatedContinuationEvidenceWindowV1 } from "./assimilated_continuation_evidence_window_v1.js";
import type { PreparedNextTickInputV1, TwinScopeKeyV1 } from "./ports.js";

export type BuildAssimilatedContinuationRecordSetInputV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
  created_at: string;
  handoff: PreparedNextTickInputV1;
  previous_forecast_result_hash: string;
  runtime_config: CanonicalObjectEnvelopeV1;
  evidence_window: AssimilatedContinuationEvidenceWindowV1;
  dynamics: HourlyWaterBalanceResultV1;
  assimilation: AssimilatedContinuationPosteriorV1;
};

type ScopeLikeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string | null;
  field_id: string;
  season_id: string | null;
  zone_id: string | null;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function requiredCanonicalIsoV1(value: string, code: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function exactScopeV1(actual: ScopeLikeV1, expected: TwinScopeKeyV1, code: string): void {
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[key] !== expected[key]) throw new Error(`${code}:${key}`);
  }
}

function addOneHourIsoV1(value: string): string {
  return new Date(
    Date.parse(requiredCanonicalIsoV1(value, "ASSIMILATED_BUILDER_LOGICAL_TIME_INVALID"))
      + 60 * 60 * 1000,
  ).toISOString();
}

function finiteV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function decimalNumberV1(value: string, code: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}

function canonicalNumberV1(value: number, scale: number): number {
  const rounded = roundDecimalHalfAwayFromZeroV1(value, scale);
  return Object.is(rounded, -0) ? 0 : rounded;
}

function canonicalTextV1(value: number, scale: number): string {
  return canonicalNumberV1(value, scale).toFixed(scale);
}

function nullableCanonicalNumberV1(value: number | null, scale: number): number | null {
  return value === null ? null : canonicalNumberV1(value, scale);
}

function canonicalSquaredTraceV1(
  value: number | null,
  disposition: AssimilatedContinuationPosteriorV1["disposition"],
): number | null {
  if (value === null) return null;
  const canonical = canonicalNumberV1(value, 12);
  if (disposition === "ACCEPTED" || disposition === "DOWNWEIGHTED") {
    return canonical > 16 ? 16 : canonical;
  }
  if (disposition === "REJECTED_OUTLIER") {
    return canonical <= 16 ? 16.000000000001 : canonical;
  }
  return canonical;
}

function uniqueSortedV1(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function statusTraceV1(
  assimilation: AssimilatedContinuationPosteriorV1,
): {
  tick_limitation: string;
  health_status: string;
  health_limitations: string[];
} {
  if (assimilation.status === "APPLIED") {
    return {
      tick_limitation: "OBSERVATION_UPDATE_APPLIED",
      health_status: "CONTINUATION_STATE_ASSIMILATED_WITH_BLOCKED_FORECAST",
      health_limitations: [
        "OBSERVATION_UPDATE_APPLIED",
        "FORECAST_BLOCKED_BY_PINNED_CONFIG_AND_CAPABILITY_BOUNDARY",
        "NO_CALIBRATED_CONFIDENCE_MODEL",
      ],
    };
  }
  if (assimilation.disposition === "REJECTED_OUTLIER") {
    return {
      tick_limitation: "OBSERVATION_UPDATE_REJECTED_OUTLIER",
      health_status: "CONTINUATION_STATE_PROPAGATED_WITH_REJECTED_OUTLIER",
      health_limitations: [
        "OBSERVATION_UPDATE_REJECTED_OUTLIER",
        "FORECAST_BLOCKED_BY_PINNED_CONFIG_AND_CAPABILITY_BOUNDARY",
        "NO_CALIBRATED_CONFIDENCE_MODEL",
      ],
    };
  }
  return {
    tick_limitation: "OBSERVATION_UPDATE_NOT_APPLIED_NO_USABLE_OBSERVATION",
    health_status: "CONTINUATION_STATE_PROPAGATED_WITHOUT_USABLE_OBSERVATION",
    health_limitations: [
      "OBSERVATION_UPDATE_NOT_APPLIED_NO_USABLE_OBSERVATION",
      "FORECAST_BLOCKED_BY_PINNED_CONFIG_AND_CAPABILITY_BOUNDARY",
      "NO_CALIBRATED_CONFIDENCE_MODEL",
    ],
  };
}

function buildAssimilationUpdatePayloadV1(input: {
  assimilation: AssimilatedContinuationPosteriorV1;
  evidence_window: AssimilatedContinuationEvidenceWindowV1;
  runtime_config: CanonicalObjectEnvelopeV1;
  transition_ref: string;
  state_ref: string;
}): AssimilatedContinuationUpdatePayloadV1 {
  const result = input.assimilation;
  return {
    status: result.status,
    disposition: result.disposition,
    policy_id: "MCFT_CAP_03_OBSERVATION_ASSIMILATION_POLICY_V1",
    record_set_contract_id: ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1,
    assimilation_method_id: ASSIMILATED_CONTINUATION_METHOD_ID_V1,
    observation_selector_id: ASSIMILATED_CONTINUATION_OBSERVATION_SELECTOR_ID_V1,
    candidate_observations: structuredClone(input.evidence_window.observation_selection.candidates),
    selected_observation_ref: result.selected_observation_ref,
    evaluated_observation_refs: [...result.evaluated_observation_refs],
    applied_observation_refs: [...result.applied_observation_refs],
    consumed_observation_refs: [...result.consumed_observation_refs],
    observation_operator: structuredClone(result.observation_operator),
    predicted_observation: nullableCanonicalNumberV1(result.predicted_observation, 12),
    actual_observation: nullableCanonicalNumberV1(result.actual_observation, 12),
    innovation: nullableCanonicalNumberV1(result.innovation, 12),
    residual: nullableCanonicalNumberV1(result.residual, 12),
    residual_kind: result.residual_kind,
    innovation_variance: nullableCanonicalNumberV1(result.innovation_variance, 12),
    normalized_innovation: nullableCanonicalNumberV1(result.normalized_innovation, 12),
    squared_normalized_innovation: canonicalSquaredTraceV1(
      result.squared_normalized_innovation,
      result.disposition,
    ),
    threshold_decision_basis: result.threshold_decision_basis,
    prior_mean: Number(result.canonical_decimal_basis.propagated_prior_vwc_decimal.value),
    prior_variance: Number(
      result.canonical_decimal_basis.propagated_prior_vwc_variance_decimal.value,
    ),
    observation_variance: nullableCanonicalNumberV1(result.observation_variance, 12),
    candidate_assimilation_gain: nullableCanonicalNumberV1(
      result.candidate_assimilation_gain,
      12,
    ),
    applied_assimilation_gain: nullableCanonicalNumberV1(result.applied_assimilation_gain, 12),
    candidate_unclipped_posterior_mean: nullableCanonicalNumberV1(
      result.candidate_unclipped_posterior_mean,
      12,
    ),
    candidate_posterior_variance: nullableCanonicalNumberV1(
      result.candidate_posterior_variance,
      12,
    ),
    published_posterior_mean: Number(result.canonical_decimal_basis.posterior_vwc_decimal.value),
    published_posterior_variance: Number(
      result.canonical_decimal_basis.posterior_vwc_variance_decimal.value,
    ),
    state_correction_vwc: canonicalNumberV1(result.state_correction_vwc, 12),
    state_correction_storage_mm: canonicalNumberV1(result.state_correction_storage_mm, 6),
    clipping: {
      applied: result.clipping.applied,
      lower_bound: 0,
      upper_bound: canonicalNumberV1(result.clipping.upper_bound, 12),
      delta: canonicalNumberV1(result.clipping.delta, 12),
    },
    state_transition_ref: input.transition_ref,
    posterior_state_ref: input.state_ref,
    runtime_config_ref: input.runtime_config.object_id,
    runtime_config_hash: input.runtime_config.determinism_hash,
    model_parameter_change_applied: false,
    reason_codes: [...result.reason_codes],
  };
}

export function buildAssimilatedContinuationRecordSetV1(
  input: BuildAssimilatedContinuationRecordSetInputV1,
): AssimilatedContinuationRecordSetV1 {
  exactScopeV1(input.handoff, input.scope, "ASSIMILATED_BUILDER_HANDOFF_SCOPE_MISMATCH");
  const logicalTime = requiredCanonicalIsoV1(
    input.logical_time,
    "ASSIMILATED_BUILDER_LOGICAL_TIME_INVALID",
  );
  requiredCanonicalIsoV1(input.created_at, "ASSIMILATED_BUILDER_CREATED_AT_INVALID");
  requiredStringV1(
    input.previous_forecast_result_hash,
    "ASSIMILATED_BUILDER_PREVIOUS_FORECAST_HASH_REQUIRED",
  );
  if (input.handoff.next_logical_tick_time !== logicalTime) {
    throw new Error("ASSIMILATED_BUILDER_HANDOFF_LOGICAL_TIME_MISMATCH");
  }
  if (input.evidence_window.logical_time !== logicalTime) {
    throw new Error("ASSIMILATED_BUILDER_EVIDENCE_LOGICAL_TIME_MISMATCH");
  }
  if (input.dynamics.mass_balance_trace.mass_balance_error_mm !== "0.000000") {
    throw new Error("ASSIMILATED_BUILDER_MASS_BALANCE_NOT_CLOSED");
  }
  if (input.runtime_config.object_type !== "twin_runtime_config_v1") {
    throw new Error("ASSIMILATED_BUILDER_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
  }
  exactScopeV1(
    input.runtime_config,
    input.scope,
    "ASSIMILATED_BUILDER_RUNTIME_CONFIG_SCOPE_MISMATCH",
  );
  validateAssimilatedContinuationRuntimeConfigPayloadV1(input.runtime_config.payload);
  const config = input.runtime_config.payload
    as unknown as AssimilatedContinuationRuntimeConfigPayloadV1;
  if (config.record_set_contract_id !== ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1) {
    throw new Error("ASSIMILATED_BUILDER_RUNTIME_CONFIG_CONTRACT_MISMATCH");
  }
  if (
    config.reality_binding_ref !== input.handoff.reality_binding_ref
    || config.reality_binding_hash !== input.handoff.reality_binding_hash
  ) {
    throw new Error("ASSIMILATED_BUILDER_REALITY_BINDING_MISMATCH");
  }

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
  const consumedRefs = uniqueSortedV1(input.evidence_window.consumed_evidence_refs);
  const sourceRefs = [input.handoff.reality_binding_ref];
  const trace = statusTraceV1(input.assimilation);
  const limitations = uniqueSortedV1([
    "CONTROLLED_SYNTHETIC",
    "NOT_FIELD_CALIBRATED",
    trace.tick_limitation,
    "NO_SUCCESSFUL_FORECAST",
    "NO_PERSISTENCE_CHANGE",
  ]);

  const buildMember = (
    objectType: ContinuationMemberObjectTypeV1,
    payload: Record<string, unknown>,
    memberEvidenceRefs: string[] = consumedRefs,
  ): CanonicalObjectEnvelopeV1 => {
    const member: CanonicalObjectEnvelopeV1 = {
      object_id: ids[objectType],
      object_type: objectType,
      schema_version: "v1",
      ...input.scope,
      logical_time: logicalTime,
      as_of: logicalTime,
      source_refs: [...sourceRefs],
      evidence_refs: [...memberEvidenceRefs],
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
    member.determinism_hash = computeMemberDeterminismHashV1(
      member as unknown as Record<string, unknown>,
    );
    return member;
  };

  const assimilationPayload = buildAssimilationUpdatePayloadV1({
    assimilation: input.assimilation,
    evidence_window: input.evidence_window,
    runtime_config: input.runtime_config,
    transition_ref: ids.twin_state_transition_v1,
    state_ref: ids.twin_state_estimate_v1,
  });
  const rootDepth = config.soil_hydraulic_snapshot.root_zone_depth_mm;
  const wiltingStorage = config.soil_hydraulic_snapshot.wilting_point_storage_mm;
  const fieldCapacityStorage = config.soil_hydraulic_snapshot.field_capacity_storage_mm;
  const posteriorMean = finiteV1(
    assimilationPayload.published_posterior_mean,
    "ASSIMILATED_BUILDER_POSTERIOR_MEAN_INVALID",
  );
  const posteriorVariance = finiteV1(
    assimilationPayload.published_posterior_variance,
    "ASSIMILATED_BUILDER_POSTERIOR_VARIANCE_INVALID",
  );
  if (posteriorVariance < 0) throw new Error("ASSIMILATED_BUILDER_POSTERIOR_VARIANCE_NEGATIVE");
  const posteriorStorage = decimalNumberV1(
    input.assimilation.canonical_decimal_basis.storage_mean_mm_decimal.value,
    "ASSIMILATED_BUILDER_STORAGE_MEAN_INVALID",
  );
  const posteriorStorageVariance = decimalNumberV1(
    input.assimilation.canonical_decimal_basis.storage_variance_mm2_decimal.value,
    "ASSIMILATED_BUILDER_STORAGE_VARIANCE_INVALID",
  );
  const rawAvailableWater = (posteriorStorage - wiltingStorage)
    / (fieldCapacityStorage - wiltingStorage);
  const availableWater = Math.min(1, Math.max(0, rawAvailableWater));
  const depletion = Math.max(0, fieldCapacityStorage - posteriorStorage);
  const posteriorStddev = Math.sqrt(posteriorVariance);
  const posteriorStorageStddev = Math.sqrt(posteriorStorageVariance);
  const intervalLower = Math.max(0, posteriorMean - 1.96 * posteriorStddev);
  const intervalUpper = Math.min(
    config.soil_hydraulic_snapshot.saturation_fraction,
    posteriorMean + 1.96 * posteriorStddev,
  );
  const rawBasis = input.dynamics.computation_basis;
  const computationBasis = {
    basis_origin: "CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",
    previous_state_ref: input.handoff.previous_posterior_ref,
    previous_storage_mean_mm_decimal: structuredClone(
      rawBasis.previous_storage_mean_mm_decimal,
    ),
    previous_storage_variance_mm2_decimal: structuredClone(
      rawBasis.previous_storage_variance_mm2_decimal,
    ),
    propagated_prior_storage_mean_mm_decimal: structuredClone(rawBasis.storage_mean_mm_decimal),
    propagated_prior_storage_variance_mm2_decimal: structuredClone(
      rawBasis.storage_variance_mm2_decimal,
    ),
    propagated_prior_vwc_decimal: structuredClone(
      input.assimilation.canonical_decimal_basis.propagated_prior_vwc_decimal,
    ),
    propagated_prior_vwc_variance_decimal: structuredClone(
      input.assimilation.canonical_decimal_basis.propagated_prior_vwc_variance_decimal,
    ),
    storage_mean_mm_decimal: structuredClone(
      input.assimilation.canonical_decimal_basis.storage_mean_mm_decimal,
    ),
    storage_variance_mm2_decimal: structuredClone(
      input.assimilation.canonical_decimal_basis.storage_variance_mm2_decimal,
    ),
    posterior_vwc_decimal: structuredClone(
      input.assimilation.canonical_decimal_basis.posterior_vwc_decimal,
    ),
    posterior_vwc_variance_decimal: structuredClone(
      input.assimilation.canonical_decimal_basis.posterior_vwc_variance_decimal,
    ),
    state_correction_vwc: canonicalTextV1(input.assimilation.state_correction_vwc, 12),
    state_correction_storage_mm: canonicalTextV1(
      input.assimilation.state_correction_storage_mm,
      6,
    ),
    rounding_rule: "DECIMAL_HALF_AWAY_FROM_ZERO_V1",
  };

  const members: CanonicalObjectEnvelopeV1[] = [
    buildMember("twin_evidence_window_v1", {
      evidence_window_contract_id: input.evidence_window.evidence_window_contract_id,
      logical_time: input.evidence_window.logical_time,
      frozen: true,
      base_continuation_window: structuredClone(input.evidence_window.base_continuation_window),
      observation_selection: structuredClone(input.evidence_window.observation_selection),
      dynamics_consumed_evidence_refs: [
        ...input.evidence_window.dynamics_consumed_evidence_refs,
      ],
      assimilation_evaluated_evidence_refs: [
        ...input.evidence_window.assimilation_evaluated_evidence_refs,
      ],
      assimilation_applied_evidence_refs: [
        ...input.evidence_window.assimilation_applied_evidence_refs,
      ],
      context_only_evidence_refs: [...input.evidence_window.context_only_evidence_refs],
      rejected_evidence_refs: [...input.evidence_window.rejected_evidence_refs],
      consumed_evidence_refs: [...input.evidence_window.consumed_evidence_refs],
      semantic_digest: input.evidence_window.semantic_digest,
    }),
    buildMember("twin_state_transition_v1", {
      transition_kind: "CONTINUATION",
      previous_posterior_ref: input.handoff.previous_posterior_ref,
      previous_posterior_hash: input.handoff.previous_posterior_hash,
      process_model_status: "APPLIED",
      process_model_id: CONTINUATION_DYNAMICS_MODEL_ID_V1,
      process_model_version: 1,
      propagation_start: input.evidence_window.base_continuation_window.window_start_exclusive,
      propagation_end: logicalTime,
      previous_state_runtime_config_ref: input.handoff.previous_state_runtime_config_ref,
      current_runtime_config_ref: input.runtime_config.object_id,
      mass_balance_trace: structuredClone(input.dynamics.mass_balance_trace),
      mass_balance_trace_hash: input.dynamics.mass_balance_trace_hash,
      propagated_prior_storage_mean_mm_decimal: structuredClone(rawBasis.storage_mean_mm_decimal),
      propagated_prior_storage_variance_mm2_decimal: structuredClone(
        rawBasis.storage_variance_mm2_decimal,
      ),
      evidence_window_ref: ids.twin_evidence_window_v1,
      assimilation_update_ref: ids.twin_assimilation_update_v1,
      posterior_state_ref: ids.twin_state_estimate_v1,
    }),
    buildMember(
      "twin_assimilation_update_v1",
      assimilationPayload as unknown as Record<string, unknown>,
      uniqueSortedV1(input.evidence_window.assimilation_evaluated_evidence_refs),
    ),
    buildMember("twin_state_estimate_v1", {
      state_kind: "POSTERIOR",
      previous_posterior_ref: input.handoff.previous_posterior_ref,
      transition_ref: ids.twin_state_transition_v1,
      assimilation_update_ref: ids.twin_assimilation_update_v1,
      evidence_window_ref: ids.twin_evidence_window_v1,
      reality_binding_ref: input.handoff.reality_binding_ref,
      reality_binding_hash: input.handoff.reality_binding_hash,
      root_zone_storage_mm: {
        mean: posteriorStorage,
        variance: posteriorStorageVariance,
        stddev: canonicalNumberV1(posteriorStorageStddev, 12),
      },
      root_zone_vwc_fraction: {
        mean: posteriorMean,
        variance: posteriorVariance,
        stddev: canonicalNumberV1(posteriorStddev, 12),
      },
      uncertainty: {
        policy_id: CONTINUATION_PROCESS_UNCERTAINTY_POLICY_ID_V1,
        policy_version: 1,
        propagation_budget: structuredClone(input.dynamics.uncertainty_budget),
        posterior_interval: {
          lower: canonicalNumberV1(intervalLower, 12),
          upper: canonicalNumberV1(intervalUpper, 12),
          confidence_level: 0.95,
          clipped_to_physical_bounds: intervalLower === 0
            || intervalUpper === config.soil_hydraulic_snapshot.saturation_fraction,
        },
        assimilation_observation_variance: input.assimilation.observation_variance,
      },
      computation_basis: computationBasis,
      available_water_fraction: canonicalNumberV1(availableWater, 6),
      available_water_fraction_trace: {
        raw_value: canonicalTextV1(rawAvailableWater, 12),
        lower_bound: "0.000000",
        upper_bound: "1.000000",
        clipping_applied: rawAvailableWater !== availableWater,
        published_value: canonicalTextV1(availableWater, 6),
        rounding_rule: "DECIMAL_HALF_AWAY_FROM_ZERO_V1",
      },
      depletion_from_field_capacity_mm: canonicalNumberV1(depletion, 6),
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
      reason_codes: ["FORECAST_BLOCKED_BY_PINNED_CONFIG_AND_CAPABILITY_BOUNDARY"],
      policy_id: CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1,
    }),
    buildMember("twin_runtime_tick_v1", {
      transaction_family: "A_STATE_TICK_COMMIT",
      operation_variant: CONTINUATION_OPERATION_VARIANT_V1,
      record_set_contract_id: ASSIMILATED_CONTINUATION_RECORD_SET_CONTRACT_ID_V1,
      status: "COMPLETED_WITH_LIMITATIONS",
      transition_kind: "CONTINUATION",
      limitations: uniqueSortedV1([
        trace.tick_limitation,
        "FORECAST_BLOCKED_BY_PINNED_CONFIG_AND_CAPABILITY_BOUNDARY",
        "NO_CALIBRATED_CONFIDENCE_MODEL",
      ]),
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
      operation_status: trace.health_status,
      runtime_mode: "REPLAY",
      active_lineage_ref: input.handoff.active_lineage_ref,
      lineage_id: input.handoff.lineage_id,
      revision_id: input.handoff.revision_id,
      tick_ref: ids.twin_runtime_tick_v1,
      checkpoint_ref: ids.twin_runtime_checkpoint_v1,
      state_ref: ids.twin_state_estimate_v1,
      forecast_result_ref: ids.twin_forecast_run_v1,
      successful_forecast_ref: null,
      limitation_reason_codes: trace.health_limitations,
    }),
  ];

  const memberHashes = Object.fromEntries(
    members.map((member) => [member.object_type, member.determinism_hash]),
  ) as Record<ContinuationMemberObjectTypeV1, string>;
  const identity = buildAssimilatedContinuationRecordSetIdentityV1({
    continuation_operation_key: operationKey,
    aggregate_identity_input: {
      previous_posterior_ref: input.handoff.previous_posterior_ref,
      previous_posterior_hash: input.handoff.previous_posterior_hash,
      previous_checkpoint_ref: input.handoff.previous_checkpoint_ref,
      previous_checkpoint_hash: input.handoff.previous_checkpoint_hash,
      previous_forecast_result_ref: input.handoff.previous_forecast_result_ref,
      previous_forecast_result_hash: input.previous_forecast_result_hash,
      runtime_config_ref: input.runtime_config.object_id,
      runtime_config_hash: input.runtime_config.determinism_hash,
      reality_binding_ref: input.handoff.reality_binding_ref,
      reality_binding_hash: input.handoff.reality_binding_hash,
      evidence_window_semantic_digest: input.evidence_window.semantic_digest,
      crop_stage_context_ref: config.crop_stage_context.context_ref,
      crop_stage_context_hash: config.crop_stage_context.context_hash,
      dynamics_model_version: "ROOT_ZONE_HOURLY_WATER_BALANCE_V1:1",
      uncertainty_policy_version: "CONTROLLED_ADDITIVE_PROCESS_UNCERTAINTY_BUDGET_V1:1",
      observation_policy_version: `${ASSIMILATED_CONTINUATION_OBSERVATION_SELECTOR_ID_V1}:1`,
      assimilation_method_version: `${ASSIMILATED_CONTINUATION_METHOD_ID_V1}:1`,
      forecast_block_policy_version: "MCFT_CAP_02_PINNED_CONFIG_NO_FORECAST_COMPONENT_V1:1",
      member_determinism_hashes: memberHashes,
    },
  });
  const recordSet: AssimilatedContinuationRecordSetV1 = { ...identity, members };
  validateAssimilatedContinuationCrossReferencesV1(recordSet);
  return recordSet;
}
