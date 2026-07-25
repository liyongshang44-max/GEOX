// Purpose: define the deterministic MCFT-CAP-08.S4 T16 late-evidence append-forward identity, canonical bindings, historical immutability manifest, and T17 corrected-predecessor authority.
// Boundary: pure contracts and validation only; no database, persistence, projection mutation, clock, filesystem, environment, route, scheduler, Residual commit, Calibration, Shadow, or production Runtime authority.

import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
  semanticHashV1,
} from "./canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import type { Cap04ScenarioSetEnvelopeV1 } from "./forecast_scenario_contracts_v1.js";
import type {
  Cap08S4LateCorrectionAppliedV1,
  Cap08S4LateCorrectionInputV1,
} from "./cap08_s4_late_correction_math_v1.js";

export const CAP08_S4_CONTRACT_ID_V1 =
  "MCFT-CAP-08.S4-LATE-EVIDENCE-APPEND-FORWARD-V1" as const;
export const CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1 =
  "geox_mcft_cap08_s4_append_forward_authority_v1" as const;
export const CAP08_S4_AUTHORITY_KIND_V1 = "REALITY_BINDING" as const;
export const CAP08_S4_OPERATION_VARIANT_V1 = "A3_LATE_APPEND_FORWARD" as const;
export const CAP08_S4_LATE_OBSERVATION_ID_V1 = "FVO-01" as const;
export const CAP08_S4_ORDINARY_DUE_OBSERVATION_ID_V1 = "FVO-16" as const;
export const CAP08_S4_CORRECTION_TICK_ID_V1 = "T16" as const;
export const CAP08_S4_NEXT_TICK_ID_V1 = "T17" as const;
export const CAP08_S4_LAG_HOURS_V1 = 15 as const;
export const CAP08_S4_RESIDUAL_OBLIGATIONS_V1 = ["R-01", "R-16"] as const;

export type Cap08S4ScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
};

export type Cap08S4ObjectBindingV1 = {
  ref: string;
  hash: string;
};

export type Cap08S4HistoricalHashManifestV1 = {
  state_bindings: Cap08S4ObjectBindingV1[];
  forecast_bindings: Cap08S4ObjectBindingV1[];
  manifest_digest: string;
};

export type Cap08S4CorrectedCanonicalSetV1 = {
  state: CanonicalObjectEnvelopeV1;
  forecast: CanonicalObjectEnvelopeV1;
  scenario: Cap04ScenarioSetEnvelopeV1;
  tick: CanonicalObjectEnvelopeV1;
  checkpoint: CanonicalObjectEnvelopeV1;
};

export type Cap08S4T17CorrectedPredecessorV1 = {
  schema_version: "geox_mcft_cap08_s4_t17_corrected_predecessor_v1";
  scope: Cap08S4ScopeV1;
  lineage_id: string;
  revision_id: string;
  next_logical_tick_time: string;
  previous_tick_sequence: number;
  previous_posterior_ref: string;
  previous_posterior_hash: string;
  previous_checkpoint_ref: string;
  previous_checkpoint_hash: string;
  previous_forecast_result_ref: string;
  previous_forecast_result_hash: string;
  latest_successful_forecast_ref: string;
  latest_successful_forecast_hash: string;
  previous_scenario_set_ref: string;
  previous_scenario_set_hash: string;
  correction_authority_ref: string;
  correction_authority_hash: string;
};

export type Cap08S4AppendForwardAuthorityIdentityInputV1 = {
  formal_run_id: string;
  scope: Cap08S4ScopeV1;
  lineage_id: string;
  revision_id: string;
  correction_logical_time: string;
  next_logical_time: string;
  base_t16_state: Cap08S4ObjectBindingV1;
  base_t16_forecast: Cap08S4ObjectBindingV1;
  base_t16_tick: Cap08S4ObjectBindingV1;
  base_t16_checkpoint: Cap08S4ObjectBindingV1;
  source_t01_state: Cap08S4ObjectBindingV1;
  late_observation: Cap08S4ObjectBindingV1;
  ordinary_due_observation: Cap08S4ObjectBindingV1;
  historical_hash_manifest_digest: string;
  phase_engine_contract_digest: string;
  phase_engine_source_digest: string;
};

export type Cap08S4AppendForwardIdentityV1 = {
  identity_input: Cap08S4AppendForwardAuthorityIdentityInputV1;
  identity_hash: string;
  authority_ref: string;
  idempotency_key: string;
  corrected_object_ids: {
    state: string;
    forecast: string;
    tick: string;
    checkpoint: string;
  };
};

export type Cap08S4AppendForwardAuthorityV1 = {
  schema_version: typeof CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1;
  contract_id: typeof CAP08_S4_CONTRACT_ID_V1;
  authority_kind: typeof CAP08_S4_AUTHORITY_KIND_V1;
  authority_ref: string;
  idempotency_key: string;
  formal_run_id: string;
  scope: Cap08S4ScopeV1;
  lineage_id: string;
  revision_id: string;
  correction_tick_id: typeof CAP08_S4_CORRECTION_TICK_ID_V1;
  correction_logical_time: string;
  next_tick_id: typeof CAP08_S4_NEXT_TICK_ID_V1;
  next_logical_time: string;
  operation_variant: typeof CAP08_S4_OPERATION_VARIANT_V1;
  late_observation_id: typeof CAP08_S4_LATE_OBSERVATION_ID_V1;
  ordinary_due_observation_id: typeof CAP08_S4_ORDINARY_DUE_OBSERVATION_ID_V1;
  lag_hours: typeof CAP08_S4_LAG_HOURS_V1;
  identity_input: Cap08S4AppendForwardAuthorityIdentityInputV1;
  math_input: Cap08S4LateCorrectionInputV1;
  math_result: Cap08S4LateCorrectionAppliedV1;
  corrected_objects: {
    state: Cap08S4ObjectBindingV1;
    forecast: Cap08S4ObjectBindingV1;
    scenario: Cap08S4ObjectBindingV1;
    tick: Cap08S4ObjectBindingV1;
    checkpoint: Cap08S4ObjectBindingV1;
  };
  historical_hash_manifest: Cap08S4HistoricalHashManifestV1;
  historical_rewrite: false;
  historical_revision_created: false;
  latest_pointer_regression_authorized: false;
  ordinary_state_assimilation_for_fvo16: false;
  residual_obligations: readonly ["R-01", "R-16"];
  residual_commit_status: "PENDING_S5_C_PROVIDER";
  t17_predecessor: Omit<
    Cap08S4T17CorrectedPredecessorV1,
    "correction_authority_hash"
  >;
  phase_engine_contract_digest: string;
  phase_engine_source_digest: string;
  slice_acceptance_only: true;
  final_formal_run_id: null;
  production_runtime_source_authorized: false;
  s5_authorized: false;
  mcft_cap_09_authorized: false;
  determinism_hash: string;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  if (!text.endsWith(":00:00.000Z")) throw new Error(code);
  return text;
}

function exactScopeV1(scope: Cap08S4ScopeV1): Cap08S4ScopeV1 {
  return {
    tenant_id: requiredStringV1(scope?.tenant_id, "CAP08_S4_SCOPE_TENANT_REQUIRED"),
    project_id: requiredStringV1(scope?.project_id, "CAP08_S4_SCOPE_PROJECT_REQUIRED"),
    group_id: requiredStringV1(scope?.group_id, "CAP08_S4_SCOPE_GROUP_REQUIRED"),
    field_id: requiredStringV1(scope?.field_id, "CAP08_S4_SCOPE_FIELD_REQUIRED"),
    season_id: requiredStringV1(scope?.season_id, "CAP08_S4_SCOPE_SEASON_REQUIRED"),
    zone_id: requiredStringV1(scope?.zone_id, "CAP08_S4_SCOPE_ZONE_REQUIRED"),
  };
}

function exactBindingV1(value: Cap08S4ObjectBindingV1, code: string): Cap08S4ObjectBindingV1 {
  return {
    ref: requiredStringV1(value?.ref, `${code}_REF_REQUIRED`),
    hash: requiredStringV1(value?.hash, `${code}_HASH_REQUIRED`),
  };
}

function addOneHourV1(value: string): string {
  return new Date(Date.parse(value) + 3_600_000).toISOString();
}

export function buildCap08S4HistoricalHashManifestV1(input: {
  state_bindings: readonly Cap08S4ObjectBindingV1[];
  forecast_bindings: readonly Cap08S4ObjectBindingV1[];
}): Cap08S4HistoricalHashManifestV1 {
  const stateBindings = input.state_bindings.map((value, index) =>
    exactBindingV1(value, `CAP08_S4_HISTORY_STATE_${index}`));
  const forecastBindings = input.forecast_bindings.map((value, index) =>
    exactBindingV1(value, `CAP08_S4_HISTORY_FORECAST_${index}`));
  if (stateBindings.length !== 17 || forecastBindings.length !== 17) {
    throw new Error("CAP08_S4_HISTORICAL_HASH_MANIFEST_CARDINALITY");
  }
  if (new Set(stateBindings.map((value) => value.ref)).size !== 17
    || new Set(forecastBindings.map((value) => value.ref)).size !== 17) {
    throw new Error("CAP08_S4_HISTORICAL_HASH_MANIFEST_DUPLICATE_REF");
  }
  const basis = {
    state_bindings: stateBindings,
    forecast_bindings: forecastBindings,
  };
  return {
    ...basis,
    manifest_digest: semanticHashV1(basis),
  };
}

export function deriveCap08S4AppendForwardIdentityV1(
  raw: Cap08S4AppendForwardAuthorityIdentityInputV1,
): Cap08S4AppendForwardIdentityV1 {
  const correctionTime = canonicalHourV1(
    raw.correction_logical_time,
    "CAP08_S4_CORRECTION_LOGICAL_TIME_INVALID",
  );
  const nextTime = canonicalHourV1(raw.next_logical_time, "CAP08_S4_NEXT_LOGICAL_TIME_INVALID");
  if (nextTime !== addOneHourV1(correctionTime)) {
    throw new Error("CAP08_S4_NEXT_LOGICAL_TIME_MISMATCH");
  }
  const identityInput: Cap08S4AppendForwardAuthorityIdentityInputV1 = {
    formal_run_id: requiredStringV1(raw.formal_run_id, "CAP08_S4_FORMAL_RUN_ID_REQUIRED"),
    scope: exactScopeV1(raw.scope),
    lineage_id: requiredStringV1(raw.lineage_id, "CAP08_S4_LINEAGE_ID_REQUIRED"),
    revision_id: requiredStringV1(raw.revision_id, "CAP08_S4_REVISION_ID_REQUIRED"),
    correction_logical_time: correctionTime,
    next_logical_time: nextTime,
    base_t16_state: exactBindingV1(raw.base_t16_state, "CAP08_S4_BASE_T16_STATE"),
    base_t16_forecast: exactBindingV1(raw.base_t16_forecast, "CAP08_S4_BASE_T16_FORECAST"),
    base_t16_tick: exactBindingV1(raw.base_t16_tick, "CAP08_S4_BASE_T16_TICK"),
    base_t16_checkpoint: exactBindingV1(raw.base_t16_checkpoint, "CAP08_S4_BASE_T16_CHECKPOINT"),
    source_t01_state: exactBindingV1(raw.source_t01_state, "CAP08_S4_SOURCE_T01_STATE"),
    late_observation: exactBindingV1(raw.late_observation, "CAP08_S4_LATE_OBSERVATION"),
    ordinary_due_observation: exactBindingV1(
      raw.ordinary_due_observation,
      "CAP08_S4_ORDINARY_DUE_OBSERVATION",
    ),
    historical_hash_manifest_digest: requiredStringV1(
      raw.historical_hash_manifest_digest,
      "CAP08_S4_HISTORY_MANIFEST_DIGEST_REQUIRED",
    ),
    phase_engine_contract_digest: requiredStringV1(
      raw.phase_engine_contract_digest,
      "CAP08_S4_PHASE_CONTRACT_DIGEST_REQUIRED",
    ),
    phase_engine_source_digest: requiredStringV1(
      raw.phase_engine_source_digest,
      "CAP08_S4_PHASE_SOURCE_DIGEST_REQUIRED",
    ),
  };
  const identityHash = semanticHashV1(identityInput);
  const authorityRef = deriveSemanticObjectIdV1("cap08_s4_late_authority", {
    identity_hash: identityHash,
  });
  return {
    identity_input: identityInput,
    identity_hash: identityHash,
    authority_ref: authorityRef,
    idempotency_key: deriveSemanticObjectIdV1("cap08_s4_late_key", {
      identity_hash: identityHash,
    }),
    corrected_object_ids: {
      state: deriveSemanticObjectIdV1("cap08_s4_state", { authority_ref: authorityRef }),
      forecast: deriveSemanticObjectIdV1("cap08_s4_forecast", { authority_ref: authorityRef }),
      tick: deriveSemanticObjectIdV1("cap08_s4_tick", { authority_ref: authorityRef }),
      checkpoint: deriveSemanticObjectIdV1("cap08_s4_checkpoint", { authority_ref: authorityRef }),
    },
  };
}

function objectHashExactV1(
  object: CanonicalObjectEnvelopeV1 | Cap04ScenarioSetEnvelopeV1,
  expected: Cap08S4ObjectBindingV1,
  code: string,
): void {
  if (object.object_id !== expected.ref || object.determinism_hash !== expected.hash) {
    throw new Error(code);
  }
  const computed = computeMemberDeterminismHashV1(
    object as unknown as Record<string, unknown>,
  );
  if (computed !== object.determinism_hash) throw new Error(`${code}_SEMANTIC_HASH`);
}

export function computeCap08S4AuthorityDeterminismHashV1(
  authority: Omit<Cap08S4AppendForwardAuthorityV1, "determinism_hash">,
): string {
  return semanticHashV1(authority);
}

export function validateCap08S4AppendForwardAuthorityV1(input: {
  authority: Cap08S4AppendForwardAuthorityV1;
  corrected_set: Cap08S4CorrectedCanonicalSetV1;
}): void {
  const authority = input.authority;
  if (authority.schema_version !== CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1
    || authority.contract_id !== CAP08_S4_CONTRACT_ID_V1
    || authority.authority_kind !== CAP08_S4_AUTHORITY_KIND_V1
    || authority.operation_variant !== CAP08_S4_OPERATION_VARIANT_V1) {
    throw new Error("CAP08_S4_AUTHORITY_HEADER_MISMATCH");
  }
  const identity = deriveCap08S4AppendForwardIdentityV1(authority.identity_input);
  if (authority.authority_ref !== identity.authority_ref
    || authority.idempotency_key !== identity.idempotency_key) {
    throw new Error("CAP08_S4_AUTHORITY_IDENTITY_MISMATCH");
  }
  if (authority.formal_run_id !== identity.identity_input.formal_run_id
    || authority.lineage_id !== identity.identity_input.lineage_id
    || authority.revision_id !== identity.identity_input.revision_id
    || authority.correction_logical_time !== identity.identity_input.correction_logical_time
    || authority.next_logical_time !== identity.identity_input.next_logical_time) {
    throw new Error("CAP08_S4_AUTHORITY_IDENTITY_FIELD_MISMATCH");
  }
  if (authority.correction_tick_id !== CAP08_S4_CORRECTION_TICK_ID_V1
    || authority.next_tick_id !== CAP08_S4_NEXT_TICK_ID_V1
    || authority.late_observation_id !== CAP08_S4_LATE_OBSERVATION_ID_V1
    || authority.ordinary_due_observation_id !== CAP08_S4_ORDINARY_DUE_OBSERVATION_ID_V1
    || authority.lag_hours !== CAP08_S4_LAG_HOURS_V1) {
    throw new Error("CAP08_S4_AUTHORITY_FORMAL_DATASET_MISMATCH");
  }
  if (authority.math_result.disposition !== "APPLIED") {
    throw new Error("CAP08_S4_AUTHORITY_APPLIED_MATH_REQUIRED");
  }
  if (authority.historical_hash_manifest.manifest_digest
    !== identity.identity_input.historical_hash_manifest_digest) {
    throw new Error("CAP08_S4_AUTHORITY_HISTORY_MANIFEST_MISMATCH");
  }
  const rebuiltManifest = buildCap08S4HistoricalHashManifestV1(
    authority.historical_hash_manifest,
  );
  if (rebuiltManifest.manifest_digest !== authority.historical_hash_manifest.manifest_digest) {
    throw new Error("CAP08_S4_AUTHORITY_HISTORY_MANIFEST_HASH_MISMATCH");
  }
  objectHashExactV1(input.corrected_set.state, authority.corrected_objects.state, "CAP08_S4_STATE_BINDING_MISMATCH");
  objectHashExactV1(input.corrected_set.forecast, authority.corrected_objects.forecast, "CAP08_S4_FORECAST_BINDING_MISMATCH");
  objectHashExactV1(input.corrected_set.scenario, authority.corrected_objects.scenario, "CAP08_S4_SCENARIO_BINDING_MISMATCH");
  objectHashExactV1(input.corrected_set.tick, authority.corrected_objects.tick, "CAP08_S4_TICK_BINDING_MISMATCH");
  objectHashExactV1(input.corrected_set.checkpoint, authority.corrected_objects.checkpoint, "CAP08_S4_CHECKPOINT_BINDING_MISMATCH");
  if (input.corrected_set.state.object_id !== identity.corrected_object_ids.state
    || input.corrected_set.forecast.object_id !== identity.corrected_object_ids.forecast
    || input.corrected_set.tick.object_id !== identity.corrected_object_ids.tick
    || input.corrected_set.checkpoint.object_id !== identity.corrected_object_ids.checkpoint) {
    throw new Error("CAP08_S4_CORRECTED_OBJECT_ID_MISMATCH");
  }
  if (authority.historical_rewrite !== false
    || authority.historical_revision_created !== false
    || authority.latest_pointer_regression_authorized !== false
    || authority.ordinary_state_assimilation_for_fvo16 !== false
    || authority.residual_commit_status !== "PENDING_S5_C_PROVIDER"
    || JSON.stringify(authority.residual_obligations)
      !== JSON.stringify(CAP08_S4_RESIDUAL_OBLIGATIONS_V1)) {
    throw new Error("CAP08_S4_AUTHORITY_BOUNDARY_MISMATCH");
  }
  const predecessor = authority.t17_predecessor;
  if (predecessor.schema_version !== "geox_mcft_cap08_s4_t17_corrected_predecessor_v1"
    || predecessor.next_logical_tick_time !== authority.next_logical_time
    || predecessor.previous_tick_sequence !== input.corrected_set.checkpoint.payload.tick_sequence
    || predecessor.previous_posterior_ref !== input.corrected_set.state.object_id
    || predecessor.previous_posterior_hash !== input.corrected_set.state.determinism_hash
    || predecessor.previous_checkpoint_ref !== input.corrected_set.checkpoint.object_id
    || predecessor.previous_checkpoint_hash !== input.corrected_set.checkpoint.determinism_hash
    || predecessor.previous_forecast_result_ref !== input.corrected_set.forecast.object_id
    || predecessor.previous_forecast_result_hash !== input.corrected_set.forecast.determinism_hash
    || predecessor.latest_successful_forecast_ref !== input.corrected_set.forecast.object_id
    || predecessor.latest_successful_forecast_hash !== input.corrected_set.forecast.determinism_hash
    || predecessor.previous_scenario_set_ref !== input.corrected_set.scenario.object_id
    || predecessor.previous_scenario_set_hash !== input.corrected_set.scenario.determinism_hash
    || predecessor.correction_authority_ref !== authority.authority_ref) {
    throw new Error("CAP08_S4_T17_PREDECESSOR_MISMATCH");
  }
  if (authority.phase_engine_contract_digest !== identity.identity_input.phase_engine_contract_digest
    || authority.phase_engine_source_digest !== identity.identity_input.phase_engine_source_digest
    || authority.slice_acceptance_only !== true
    || authority.final_formal_run_id !== null
    || authority.production_runtime_source_authorized !== false
    || authority.s5_authorized !== false
    || authority.mcft_cap_09_authorized !== false) {
    throw new Error("CAP08_S4_AUTHORITY_NONCLAIM_MISMATCH");
  }
  const { determinism_hash: _ignored, ...basis } = authority;
  if (computeCap08S4AuthorityDeterminismHashV1(basis)
    !== authority.determinism_hash) {
    throw new Error("CAP08_S4_AUTHORITY_DETERMINISM_HASH_MISMATCH");
  }
}
