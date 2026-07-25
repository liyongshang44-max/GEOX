// Purpose: build the deterministic MCFT-CAP-08.S4 corrected T16 State, Forecast, Scenario, Tick and Checkpoint plus immutable append-forward authority from the persisted dynamics-only T16 base.
// Boundary: pure canonical construction only; no database, persistence, projection mutation, lease, route, scheduler, wall clock, Residual commit, Calibration, Shadow, or production Runtime authority.

import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
} from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  CAP08_S4_AUTHORITY_KIND_V1,
  CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1,
  CAP08_S4_CONTRACT_ID_V1,
  CAP08_S4_CORRECTION_TICK_ID_V1,
  CAP08_S4_LAG_HOURS_V1,
  CAP08_S4_LATE_OBSERVATION_ID_V1,
  CAP08_S4_NEXT_TICK_ID_V1,
  CAP08_S4_OPERATION_VARIANT_V1,
  CAP08_S4_ORDINARY_DUE_OBSERVATION_ID_V1,
  CAP08_S4_RESIDUAL_OBLIGATIONS_V1,
  computeCap08S4AuthorityDeterminismHashV1,
  deriveCap08S4AppendForwardIdentityV1,
  validateCap08S4AppendForwardAuthorityV1,
  type Cap08S4AppendForwardAuthorityIdentityInputV1,
  type Cap08S4AppendForwardAuthorityV1,
  type Cap08S4CorrectedCanonicalSetV1,
  type Cap08S4HistoricalHashManifestV1,
} from "../../domain/twin_runtime/cap08_s4_append_forward_contracts_v1.js";
import type {
  Cap08S4LateCorrectionAppliedV1,
  Cap08S4LateCorrectionInputV1,
} from "../../domain/twin_runtime/cap08_s4_late_correction_math_v1.js";
import {
  validateCap04ForecastRunPayloadV1,
  type Cap04ForecastRunPayloadV1,
} from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import {
  validateCap04RuntimeConfigPayloadV1,
  type Cap04RuntimeConfigPayloadV1,
} from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import type { Cap04ForecastForcingWindowV1 } from "../../domain/twin_runtime/future_forcing_contracts_v1.js";
import {
  executeCap04Pure72hForecastMathV1,
  type Cap04Pure72hForecastMathInputV1,
} from "../../domain/twin_runtime/pure_72h_forecast_math_v1.js";
import { executeCap04PureThreeScenarioMathV1 } from "../../domain/twin_runtime/pure_three_scenario_math_v1.js";
import { buildCap04ScenarioSetRecordV1 } from "./scenario_set_record_builder_v1.js";

export type BuildCap08S4CorrectedCanonicalSetInputV1 = {
  identity_input: Cap08S4AppendForwardAuthorityIdentityInputV1;
  created_at: string;
  runtime_config: CanonicalObjectEnvelopeV1;
  execution_config_payload?: Cap04RuntimeConfigPayloadV1;
  base_t16_state: CanonicalObjectEnvelopeV1;
  base_t16_forecast: CanonicalObjectEnvelopeV1;
  base_t16_tick: CanonicalObjectEnvelopeV1;
  base_t16_checkpoint: CanonicalObjectEnvelopeV1;
  forcing_window: Cap04ForecastForcingWindowV1;
  math_input: Cap08S4LateCorrectionInputV1;
  math_result: Cap08S4LateCorrectionAppliedV1;
  historical_hash_manifest: Cap08S4HistoricalHashManifestV1;
};

export type BuildCap08S4CorrectedCanonicalSetResultV1 = {
  corrected_set: Cap08S4CorrectedCanonicalSetV1;
  authority: Cap08S4AppendForwardAuthorityV1;
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

function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function exactScopeV1(actual: ScopeLikeV1, expected: ScopeLikeV1, code: string): void {
  for (const field of [
    "tenant_id",
    "project_id",
    "group_id",
    "field_id",
    "season_id",
    "zone_id",
  ] as const) {
    if (actual[field] !== expected[field]) throw new Error(`${code}:${field}`);
  }
}

function recordPayloadV1(object: CanonicalObjectEnvelopeV1, code: string): Record<string, unknown> {
  if (!object.payload || typeof object.payload !== "object" || Array.isArray(object.payload)) {
    throw new Error(code);
  }
  return structuredClone(object.payload);
}

function exactObjectV1(input: {
  object: CanonicalObjectEnvelopeV1;
  expected_type: CanonicalObjectEnvelopeV1["object_type"];
  expected_ref: string;
  expected_hash: string;
  expected_time: string;
  expected_scope: ScopeLikeV1;
  expected_lineage: string;
  expected_revision: string;
  code: string;
}): void {
  if (input.object.object_type !== input.expected_type
    || input.object.object_id !== input.expected_ref
    || input.object.determinism_hash !== input.expected_hash
    || input.object.logical_time !== input.expected_time
    || input.object.as_of !== input.expected_time
    || input.object.lineage_id !== input.expected_lineage
    || input.object.revision_id !== input.expected_revision) {
    throw new Error(`${input.code}_IDENTITY_MISMATCH`);
  }
  exactScopeV1(input.object, input.expected_scope, `${input.code}_SCOPE_MISMATCH`);
  if (computeMemberDeterminismHashV1(
    input.object as unknown as Record<string, unknown>,
  ) !== input.object.determinism_hash) {
    throw new Error(`${input.code}_HASH_MISMATCH`);
  }
}

function finiteV1(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(code);
  return value;
}

function decimalTextV1(value: number, scale: number): string {
  if (!Number.isFinite(value)) throw new Error("CAP08_S4_DECIMAL_NON_FINITE");
  const normalized = Object.is(value, -0) ? 0 : value;
  return normalized.toFixed(scale);
}

function replaceDecimalValueV1(existing: unknown, value: number, scale: number): unknown {
  const text = decimalTextV1(value, scale);
  if (typeof existing === "string") return text;
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    return { ...(existing as Record<string, unknown>), value: text };
  }
  return { value: text, scale, rounding_rule: "DECIMAL_HALF_AWAY_FROM_ZERO_V1" };
}

function uniqueSortedV1(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))]
    .sort((left, right) => left.localeCompare(right));
}

function bindingV1(object: { object_id: string; determinism_hash: string }) {
  return { ref: object.object_id, hash: object.determinism_hash };
}

function buildEnvelopeV1(input: {
  object_id: string;
  object_type: CanonicalObjectEnvelopeV1["object_type"];
  scope: BuildCap08S4CorrectedCanonicalSetInputV1["identity_input"]["scope"];
  logical_time: string;
  created_at: string;
  source_refs: readonly string[];
  evidence_refs: readonly string[];
  runtime_config_ref: string;
  runtime_config_hash: string;
  lineage_id: string;
  revision_id: string;
  payload: Record<string, unknown>;
  limitations: readonly string[];
  authority_ref: string;
}): CanonicalObjectEnvelopeV1 {
  const object: CanonicalObjectEnvelopeV1 = {
    object_id: input.object_id,
    object_type: input.object_type,
    schema_version: "v1",
    ...input.scope,
    logical_time: input.logical_time,
    as_of: input.logical_time,
    source_refs: uniqueSortedV1(input.source_refs),
    evidence_refs: uniqueSortedV1(input.evidence_refs),
    runtime_config_ref: input.runtime_config_ref,
    runtime_config_hash: input.runtime_config_hash,
    idempotency_key: deriveSemanticObjectIdV1("cap08_s4_member_key", {
      authority_ref: input.authority_ref,
      object_type: input.object_type,
    }),
    determinism_hash: "",
    limitations: uniqueSortedV1(input.limitations),
    created_at: input.created_at,
    lineage_id: input.lineage_id,
    revision_id: input.revision_id,
    payload: input.payload,
  };
  object.determinism_hash = computeMemberDeterminismHashV1(
    object as unknown as Record<string, unknown>,
  );
  return object;
}

export function buildCap08S4CorrectedCanonicalSetV1(
  input: BuildCap08S4CorrectedCanonicalSetInputV1,
): BuildCap08S4CorrectedCanonicalSetResultV1 {
  const identity = deriveCap08S4AppendForwardIdentityV1(input.identity_input);
  const time = identity.identity_input.correction_logical_time;
  const createdAt = canonicalIsoV1(input.created_at, "CAP08_S4_CREATED_AT_INVALID");
  const scope = identity.identity_input.scope;
  const lineage = identity.identity_input.lineage_id;
  const revision = identity.identity_input.revision_id;

  exactObjectV1({
    object: input.base_t16_state,
    expected_type: "twin_state_estimate_v1",
    expected_ref: identity.identity_input.base_t16_state.ref,
    expected_hash: identity.identity_input.base_t16_state.hash,
    expected_time: time,
    expected_scope: scope,
    expected_lineage: lineage,
    expected_revision: revision,
    code: "CAP08_S4_BASE_STATE",
  });
  exactObjectV1({
    object: input.base_t16_forecast,
    expected_type: "twin_forecast_run_v1",
    expected_ref: identity.identity_input.base_t16_forecast.ref,
    expected_hash: identity.identity_input.base_t16_forecast.hash,
    expected_time: time,
    expected_scope: scope,
    expected_lineage: lineage,
    expected_revision: revision,
    code: "CAP08_S4_BASE_FORECAST",
  });
  exactObjectV1({
    object: input.base_t16_tick,
    expected_type: "twin_runtime_tick_v1",
    expected_ref: identity.identity_input.base_t16_tick.ref,
    expected_hash: identity.identity_input.base_t16_tick.hash,
    expected_time: time,
    expected_scope: scope,
    expected_lineage: lineage,
    expected_revision: revision,
    code: "CAP08_S4_BASE_TICK",
  });
  exactObjectV1({
    object: input.base_t16_checkpoint,
    expected_type: "twin_runtime_checkpoint_v1",
    expected_ref: identity.identity_input.base_t16_checkpoint.ref,
    expected_hash: identity.identity_input.base_t16_checkpoint.hash,
    expected_time: time,
    expected_scope: scope,
    expected_lineage: lineage,
    expected_revision: revision,
    code: "CAP08_S4_BASE_CHECKPOINT",
  });
  if (input.math_result.disposition !== "APPLIED"
    || input.math_input.lag_hours !== CAP08_S4_LAG_HOURS_V1) {
    throw new Error("CAP08_S4_APPLIED_FORMAL_MATH_REQUIRED");
  }
  if (input.historical_hash_manifest.manifest_digest
    !== identity.identity_input.historical_hash_manifest_digest) {
    throw new Error("CAP08_S4_HISTORY_MANIFEST_DIGEST_MISMATCH");
  }

  if (input.runtime_config.object_type !== "twin_runtime_config_v1"
    || input.runtime_config.object_id !== input.base_t16_state.runtime_config_ref
    || input.runtime_config.determinism_hash !== input.base_t16_state.runtime_config_hash) {
    throw new Error("CAP08_S4_RUNTIME_CONFIG_BINDING_MISMATCH");
  }
  exactScopeV1(input.runtime_config, scope, "CAP08_S4_RUNTIME_CONFIG_SCOPE_MISMATCH");
  const configPayload = structuredClone(
    input.execution_config_payload ?? input.runtime_config.payload,
  ) as unknown as Cap04RuntimeConfigPayloadV1;
  validateCap04RuntimeConfigPayloadV1(configPayload);
  if (configPayload.effective_logical_time !== time) {
    throw new Error("CAP08_S4_RUNTIME_CONFIG_TIME_MISMATCH");
  }

  const baseStatePayload = recordPayloadV1(input.base_t16_state, "CAP08_S4_BASE_STATE_PAYLOAD_REQUIRED");
  const baseComputation = baseStatePayload.computation_basis;
  if (!baseComputation || typeof baseComputation !== "object" || Array.isArray(baseComputation)) {
    throw new Error("CAP08_S4_BASE_STATE_COMPUTATION_BASIS_REQUIRED");
  }
  const baseStorage = baseStatePayload.root_zone_storage_mm;
  const baseVwc = baseStatePayload.root_zone_vwc_fraction;
  if (!baseStorage || typeof baseStorage !== "object" || Array.isArray(baseStorage)
    || !baseVwc || typeof baseVwc !== "object" || Array.isArray(baseVwc)) {
    throw new Error("CAP08_S4_BASE_STATE_MOMENTS_REQUIRED");
  }

  const rootZoneDepth = finiteV1(
    configPayload.soil_hydraulic_snapshot.root_zone_depth_mm,
    "CAP08_S4_ROOT_ZONE_DEPTH_INVALID",
  );
  const correctedMean = finiteV1(input.math_result.mean, "CAP08_S4_CORRECTED_MEAN_INVALID");
  const correctedVariance = finiteV1(
    input.math_result.variance,
    "CAP08_S4_CORRECTED_VARIANCE_INVALID",
  );
  if (rootZoneDepth <= 0 || correctedVariance < 0) {
    throw new Error("CAP08_S4_CORRECTED_MOMENTS_INVALID");
  }
  const correctedStorage = correctedMean * rootZoneDepth;
  const correctedStorageVariance = correctedVariance * rootZoneDepth * rootZoneDepth;
  const wiltingStorage = configPayload.soil_hydraulic_snapshot.wilting_point_storage_mm;
  const fieldCapacityStorage = configPayload.soil_hydraulic_snapshot.field_capacity_storage_mm;
  const availableWaterFraction = Math.max(0, Math.min(
    1,
    (correctedStorage - wiltingStorage) / (fieldCapacityStorage - wiltingStorage),
  ));
  const depletion = Math.max(0, fieldCapacityStorage - correctedStorage);

  const correctionTrace = {
    contract_id: CAP08_S4_CONTRACT_ID_V1,
    operation_variant: CAP08_S4_OPERATION_VARIANT_V1,
    authority_ref: identity.authority_ref,
    base_t16_state: identity.identity_input.base_t16_state,
    source_t01_state: identity.identity_input.source_t01_state,
    late_observation: identity.identity_input.late_observation,
    ordinary_due_observation: identity.identity_input.ordinary_due_observation,
    math_input: structuredClone(input.math_input),
    math_result: structuredClone(input.math_result),
  };
  const computation = structuredClone(baseComputation as Record<string, unknown>);
  computation.basis_origin = "CAP08_S4_LATE_APPEND_FORWARD_CORRECTED_POSTERIOR";
  computation.base_t16_posterior_ref = input.base_t16_state.object_id;
  computation.base_t16_posterior_hash = input.base_t16_state.determinism_hash;
  computation.source_t01_state_ref = identity.identity_input.source_t01_state.ref;
  computation.source_t01_state_hash = identity.identity_input.source_t01_state.hash;
  computation.late_observation_ref = identity.identity_input.late_observation.ref;
  computation.late_observation_hash = identity.identity_input.late_observation.hash;
  computation.storage_mean_mm_decimal = replaceDecimalValueV1(
    computation.storage_mean_mm_decimal,
    correctedStorage,
    6,
  );
  computation.storage_variance_mm2_decimal = replaceDecimalValueV1(
    computation.storage_variance_mm2_decimal,
    correctedStorageVariance,
    6,
  );
  computation.posterior_vwc_decimal = replaceDecimalValueV1(
    computation.posterior_vwc_decimal,
    correctedMean,
    12,
  );
  computation.posterior_vwc_variance_decimal = replaceDecimalValueV1(
    computation.posterior_vwc_variance_decimal,
    correctedVariance,
    12,
  );
  computation.state_correction_vwc = input.math_result.current_delta;
  computation.state_correction_storage_mm = input.math_result.current_delta * rootZoneDepth;
  computation.late_append_forward_trace = correctionTrace;

  const baseTickPayload = recordPayloadV1(input.base_t16_tick, "CAP08_S4_BASE_TICK_PAYLOAD_REQUIRED");
  const baseCheckpointPayload = recordPayloadV1(
    input.base_t16_checkpoint,
    "CAP08_S4_BASE_CHECKPOINT_PAYLOAD_REQUIRED",
  );
  const checkpointSequence = baseCheckpointPayload.tick_sequence;
  if (!Number.isInteger(checkpointSequence) || Number(checkpointSequence) < 1) {
    throw new Error("CAP08_S4_BASE_CHECKPOINT_SEQUENCE_INVALID");
  }
  const previousCheckpointRef = requiredStringV1(
    baseCheckpointPayload.previous_checkpoint_ref,
    "CAP08_S4_BASE_PREVIOUS_CHECKPOINT_REQUIRED",
  );
  const nextTime = identity.identity_input.next_logical_time;
  const commonLimitations = [
    "CONTROLLED_REPLAY",
    "NOT_FIELD_CALIBRATED",
    "S4_SLICE_ACCEPTANCE_ONLY",
    "LATE_APPEND_FORWARD",
    "HISTORICAL_REWRITE_FORBIDDEN",
    "HISTORICAL_REVISION_CREATION_FORBIDDEN",
    "LATEST_POINTER_REGRESSION_FORBIDDEN",
    "FVO16_RESIDUAL_ONLY",
    "NO_RECOMMENDATION",
    "NO_AO_ACT",
    "NO_DISPATCH",
    "NO_MODEL_ACTIVATION",
  ];
  const evidenceRefs = uniqueSortedV1([
    ...input.base_t16_state.evidence_refs,
    identity.identity_input.late_observation.ref,
    identity.identity_input.ordinary_due_observation.ref,
  ]);
  const sourceRefs = uniqueSortedV1([
    ...input.base_t16_state.source_refs,
    input.base_t16_state.object_id,
    identity.authority_ref,
  ]);

  const statePayload = {
    ...baseStatePayload,
    state_kind: "POSTERIOR_LATE_APPEND_FORWARD",
    previous_posterior_ref: input.base_t16_state.object_id,
    base_t16_posterior_ref: input.base_t16_state.object_id,
    base_t16_posterior_hash: input.base_t16_state.determinism_hash,
    late_correction_authority_ref: identity.authority_ref,
    late_observation_ref: identity.identity_input.late_observation.ref,
    late_observation_hash: identity.identity_input.late_observation.hash,
    ordinary_due_observation_ref: identity.identity_input.ordinary_due_observation.ref,
    ordinary_due_observation_hash: identity.identity_input.ordinary_due_observation.hash,
    ordinary_due_observation_assimilated: false,
    root_zone_storage_mm: {
      ...(baseStorage as Record<string, unknown>),
      mean: correctedStorage,
      variance: correctedStorageVariance,
      stddev: Math.sqrt(correctedStorageVariance),
    },
    root_zone_vwc_fraction: {
      ...(baseVwc as Record<string, unknown>),
      mean: correctedMean,
      variance: correctedVariance,
      stddev: Math.sqrt(correctedVariance),
    },
    computation_basis: computation,
    available_water_fraction: Number(availableWaterFraction.toFixed(6)),
    depletion_from_field_capacity_mm: Number(depletion.toFixed(6)),
    use_eligibility: {
      state_valid: true,
      posterior_chain_eligible: true,
      forecast_source_eligible: true,
      recommendation_input_eligible: false,
      action_input_eligible: false,
    },
  };
  const state = buildEnvelopeV1({
    object_id: identity.corrected_object_ids.state,
    object_type: "twin_state_estimate_v1",
    scope,
    logical_time: time,
    created_at: createdAt,
    source_refs: sourceRefs,
    evidence_refs: evidenceRefs,
    runtime_config_ref: input.runtime_config.object_id,
    runtime_config_hash: input.runtime_config.determinism_hash,
    lineage_id: lineage,
    revision_id: revision,
    payload: statePayload,
    limitations: [...input.base_t16_state.limitations, ...commonLimitations],
    authority_ref: identity.authority_ref,
  });

  const forecastInput: Cap04Pure72hForecastMathInputV1 = {
    source_posterior: {
      ref: state.object_id,
      hash: state.determinism_hash,
      logical_time: time,
      computation_basis: {
        storage_mean_mm_decimal: decimalTextV1(correctedStorage, 6),
        storage_variance_mm2_decimal: decimalTextV1(correctedStorageVariance, 6),
      },
    },
    runtime_config: {
      ref: input.runtime_config.object_id,
      hash: input.runtime_config.determinism_hash,
      payload: configPayload,
    },
    forcing_window: structuredClone(input.forcing_window),
  };
  const forecastMath = executeCap04Pure72hForecastMathV1(forecastInput);
  const forecastPayload = structuredClone(
    forecastMath.forecast_payload,
  ) as unknown as Cap04ForecastRunPayloadV1;
  forecastPayload.source_posterior_ref = state.object_id;
  forecastPayload.source_posterior_hash = state.determinism_hash;
  validateCap04ForecastRunPayloadV1(forecastPayload);
  if (forecastPayload.status !== "COMPLETED") {
    throw new Error("CAP08_S4_CORRECTED_FORECAST_MUST_COMPLETE");
  }
  const forecast = buildEnvelopeV1({
    object_id: identity.corrected_object_ids.forecast,
    object_type: "twin_forecast_run_v1",
    scope,
    logical_time: time,
    created_at: createdAt,
    source_refs: [state.object_id, input.runtime_config.object_id, identity.authority_ref],
    evidence_refs: uniqueSortedV1([
      ...input.base_t16_forecast.evidence_refs,
      identity.identity_input.late_observation.ref,
    ]),
    runtime_config_ref: input.runtime_config.object_id,
    runtime_config_hash: input.runtime_config.determinism_hash,
    lineage_id: lineage,
    revision_id: revision,
    payload: forecastPayload as unknown as Record<string, unknown>,
    limitations: [...forecastPayload.limitations, ...commonLimitations],
    authority_ref: identity.authority_ref,
  });

  const scenarioMath = executeCap04PureThreeScenarioMathV1({
    source_forecast: {
      ref: forecast.object_id,
      hash: forecast.determinism_hash,
      math_result: forecastMath,
    },
    runtime_config: {
      ref: input.runtime_config.object_id,
      hash: input.runtime_config.determinism_hash,
      payload: configPayload,
    },
    forcing_window: structuredClone(input.forcing_window),
  });
  const scenarioRecord = buildCap04ScenarioSetRecordV1({
    source_forecast: forecast,
    scenario_math_result: scenarioMath,
    created_at: createdAt,
  });
  const scenario = scenarioRecord.scenario_set;

  const checkpointId = identity.corrected_object_ids.checkpoint;
  const tickPayload = {
    transaction_family: "A_STATE_TICK_COMMIT",
    operation_variant: CAP08_S4_OPERATION_VARIANT_V1,
    record_set_contract_id: CAP08_S4_CONTRACT_ID_V1,
    status: "COMPLETED",
    transition_kind: "LATE_APPEND_FORWARD",
    correction_tick_id: CAP08_S4_CORRECTION_TICK_ID_V1,
    supersedes_tick_ref: input.base_t16_tick.object_id,
    supersedes_tick_hash: input.base_t16_tick.determinism_hash,
    base_t16_posterior_ref: input.base_t16_state.object_id,
    base_t16_posterior_hash: input.base_t16_state.determinism_hash,
    evidence_window_ref: baseTickPayload.evidence_window_ref,
    state_transition_ref: baseTickPayload.state_transition_ref,
    assimilation_update_ref: baseTickPayload.assimilation_update_ref,
    posterior_state_ref: state.object_id,
    forecast_result_ref: forecast.object_id,
    scenario_set_ref: scenario.object_id,
    checkpoint_ref: checkpointId,
    late_correction_authority_ref: identity.authority_ref,
    residual_obligations: [...CAP08_S4_RESIDUAL_OBLIGATIONS_V1],
    residual_commit_status: "PENDING_S5_C_PROVIDER",
    next_tick_logical_time: nextTime,
    latest_pointer_regression_authorized: false,
  };
  const tick = buildEnvelopeV1({
    object_id: identity.corrected_object_ids.tick,
    object_type: "twin_runtime_tick_v1",
    scope,
    logical_time: time,
    created_at: createdAt,
    source_refs: [input.base_t16_tick.object_id, state.object_id, forecast.object_id, scenario.object_id, identity.authority_ref],
    evidence_refs: evidenceRefs,
    runtime_config_ref: input.runtime_config.object_id,
    runtime_config_hash: input.runtime_config.determinism_hash,
    lineage_id: lineage,
    revision_id: revision,
    payload: tickPayload,
    limitations: commonLimitations,
    authority_ref: identity.authority_ref,
  });
  const checkpoint = buildEnvelopeV1({
    object_id: checkpointId,
    object_type: "twin_runtime_checkpoint_v1",
    scope,
    logical_time: time,
    created_at: createdAt,
    source_refs: [input.base_t16_checkpoint.object_id, tick.object_id, state.object_id, forecast.object_id, scenario.object_id, identity.authority_ref],
    evidence_refs: evidenceRefs,
    runtime_config_ref: input.runtime_config.object_id,
    runtime_config_hash: input.runtime_config.determinism_hash,
    lineage_id: lineage,
    revision_id: revision,
    payload: {
      checkpoint_kind: "LATE_APPEND_FORWARD",
      previous_checkpoint_ref: previousCheckpointRef,
      supersedes_checkpoint_ref: input.base_t16_checkpoint.object_id,
      supersedes_checkpoint_hash: input.base_t16_checkpoint.determinism_hash,
      last_completed_tick_ref: tick.object_id,
      last_posterior_state_ref: state.object_id,
      forecast_result_ref: forecast.object_id,
      successful_forecast_ref: forecast.object_id,
      scenario_set_ref: scenario.object_id,
      late_correction_authority_ref: identity.authority_ref,
      residual_obligations: [...CAP08_S4_RESIDUAL_OBLIGATIONS_V1],
      residual_commit_status: "PENDING_S5_C_PROVIDER",
      next_tick_logical_time: nextTime,
      tick_sequence: Number(checkpointSequence),
      latest_pointer_regression_authorized: false,
    },
    limitations: commonLimitations,
    authority_ref: identity.authority_ref,
  });

  const correctedSet: Cap08S4CorrectedCanonicalSetV1 = {
    state,
    forecast,
    scenario,
    tick,
    checkpoint,
  };
  const authorityWithoutHash: Omit<Cap08S4AppendForwardAuthorityV1, "determinism_hash"> = {
    schema_version: CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1,
    contract_id: CAP08_S4_CONTRACT_ID_V1,
    authority_kind: CAP08_S4_AUTHORITY_KIND_V1,
    authority_ref: identity.authority_ref,
    idempotency_key: identity.idempotency_key,
    formal_run_id: identity.identity_input.formal_run_id,
    scope,
    lineage_id: lineage,
    revision_id: revision,
    correction_tick_id: CAP08_S4_CORRECTION_TICK_ID_V1,
    correction_logical_time: time,
    next_tick_id: CAP08_S4_NEXT_TICK_ID_V1,
    next_logical_time: nextTime,
    operation_variant: CAP08_S4_OPERATION_VARIANT_V1,
    late_observation_id: CAP08_S4_LATE_OBSERVATION_ID_V1,
    ordinary_due_observation_id: CAP08_S4_ORDINARY_DUE_OBSERVATION_ID_V1,
    lag_hours: CAP08_S4_LAG_HOURS_V1,
    identity_input: identity.identity_input,
    math_input: structuredClone(input.math_input),
    math_result: structuredClone(input.math_result),
    corrected_objects: {
      state: bindingV1(state),
      forecast: bindingV1(forecast),
      scenario: bindingV1(scenario),
      tick: bindingV1(tick),
      checkpoint: bindingV1(checkpoint),
    },
    historical_hash_manifest: structuredClone(input.historical_hash_manifest),
    historical_rewrite: false,
    historical_revision_created: false,
    latest_pointer_regression_authorized: false,
    ordinary_state_assimilation_for_fvo16: false,
    residual_obligations: [...CAP08_S4_RESIDUAL_OBLIGATIONS_V1],
    residual_commit_status: "PENDING_S5_C_PROVIDER",
    t17_predecessor: {
      schema_version: "geox_mcft_cap08_s4_t17_corrected_predecessor_v1",
      scope,
      lineage_id: lineage,
      revision_id: revision,
      next_logical_tick_time: nextTime,
      previous_tick_sequence: Number(checkpointSequence),
      previous_posterior_ref: state.object_id,
      previous_posterior_hash: state.determinism_hash,
      previous_checkpoint_ref: checkpoint.object_id,
      previous_checkpoint_hash: checkpoint.determinism_hash,
      previous_forecast_result_ref: forecast.object_id,
      previous_forecast_result_hash: forecast.determinism_hash,
      latest_successful_forecast_ref: forecast.object_id,
      latest_successful_forecast_hash: forecast.determinism_hash,
      previous_scenario_set_ref: scenario.object_id,
      previous_scenario_set_hash: scenario.determinism_hash,
      correction_authority_ref: identity.authority_ref,
    },
    phase_engine_contract_digest: identity.identity_input.phase_engine_contract_digest,
    phase_engine_source_digest: identity.identity_input.phase_engine_source_digest,
    slice_acceptance_only: true,
    final_formal_run_id: null,
    production_runtime_source_authorized: false,
    s5_authorized: false,
    mcft_cap_09_authorized: false,
  };
  const authority: Cap08S4AppendForwardAuthorityV1 = {
    ...authorityWithoutHash,
    determinism_hash: computeCap08S4AuthorityDeterminismHashV1(authorityWithoutHash),
  };
  validateCap08S4AppendForwardAuthorityV1({
    authority,
    corrected_set: correctedSet,
  });
  return { corrected_set: correctedSet, authority };
}
