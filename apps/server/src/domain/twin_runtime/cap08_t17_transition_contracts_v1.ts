// Purpose: freeze the MCFT-CAP-08 S4 corrected-T16 -> T17 authority-bound dual-predecessor transition machine contract.
// Boundary: pure types, deterministic identity validation, formal-dataset A1 proof validation, replay classification, and retry policy only.
// No persistence implementation, SQL execution, projection mutation, lease acquisition, route, scheduler, qualification carrier, or execution authority.

import { semanticHashV1 } from "./canonical_identity_v1.js";

export const CAP08_S4_T17_TRANSITION_CONTRACT_ID_V1 =
  "MCFT-CAP-08.S4-T17-AUTHORITY-BOUND-DUAL-PREDECESSOR-A1-TRANSITION-V1" as const;
export const CAP08_S4_T17_TRANSITION_KIND_V1 =
  "S4_T17_AUTHORITY_BOUND_DUAL_PREDECESSOR_A1" as const;
export const CAP08_S4_T17_WITNESS_SCHEMA_VERSION_V1 =
  "geox_mcft_cap08_s4_t17_transition_witness_v1" as const;
export const CAP08_S4_T17_FORMAL_A1_PROOF_SCHEMA_VERSION_V1 =
  "geox_mcft_cap08_s4_t17_formal_a1_proof_v1" as const;
export const CAP08_S4_T17_FORMAL_OUTCOME_V1 = "A1_COMPLETED" as const;
export const CAP08_S4_T17_A2_SCOPE_STATUS_V1 =
  "OUT_OF_SCOPE_FOR_MCFT_CAP_08_S6_FORMAL_RUN" as const;

export const CAP08_S4_T17_SERIALIZATION_RETRY_POLICY_V1 = Object.freeze({
  retryable_sqlstate: "40001",
  max_attempts: 3,
  retry_delays_ms: [25, 100] as const,
  retry_scope: "FULL_TRANSACTION_FROM_BEGIN",
  reacquire_connection_each_attempt: true,
  reacquire_advisory_lock_each_attempt: true,
  replay_classification_each_attempt: true,
  reuse_transaction_state: false,
  jitter_allowed: false,
  exhaustion_error: "SERIALIZABLE_RETRY_EXHAUSTED",
} as const);

export type Cap08S4T17ScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
};

export type Cap08S4T17ObjectBindingV1 = {
  ref: string;
  hash: string;
};

export type Cap08S4T17ExpectedLatestBaseV1 = {
  state: Cap08S4T17ObjectBindingV1;
  checkpoint: Cap08S4T17ObjectBindingV1;
  forecast_result: Cap08S4T17ObjectBindingV1;
  successful_forecast: Cap08S4T17ObjectBindingV1;
};

export type Cap08S4T17CorrectedComputationPredecessorV1 = {
  state: Cap08S4T17ObjectBindingV1;
  checkpoint: Cap08S4T17ObjectBindingV1;
  forecast_result: Cap08S4T17ObjectBindingV1;
  successful_forecast: Cap08S4T17ObjectBindingV1;
  scenario_set: Cap08S4T17ObjectBindingV1;
  previous_tick_sequence: number;
};

export type Cap08S4T17CorrectionAuthorityBindingV1 = {
  authority_ref: string;
  authority_hash: string;
};

export type Cap08S4T17CommittedA1BindingsV1 = {
  record_set_id: string;
  aggregate_determinism_hash: string;
  state: Cap08S4T17ObjectBindingV1;
  checkpoint: Cap08S4T17ObjectBindingV1;
  forecast_result: Cap08S4T17ObjectBindingV1;
  successful_forecast: Cap08S4T17ObjectBindingV1;
};

export type Cap08S4T17TransitionUniquenessKeyV1 = {
  transition_kind: typeof CAP08_S4_T17_TRANSITION_KIND_V1;
  formal_run_id: string;
  scope: Cap08S4T17ScopeV1;
  lineage_id: string;
  revision_id: string;
  t17_logical_time: string;
};

export type Cap08S4T17TransitionWitnessInputV1 = {
  uniqueness_key: Cap08S4T17TransitionUniquenessKeyV1;
  correction_authority: Cap08S4T17CorrectionAuthorityBindingV1;
  expected_latest_base: Cap08S4T17ExpectedLatestBaseV1;
  corrected_computation_predecessor: Cap08S4T17CorrectedComputationPredecessorV1;
  committed_t17: Cap08S4T17CommittedA1BindingsV1;
};

export type Cap08S4T17TransitionWitnessV1 = {
  schema_version: typeof CAP08_S4_T17_WITNESS_SCHEMA_VERSION_V1;
  contract_id: typeof CAP08_S4_T17_TRANSITION_CONTRACT_ID_V1;
  transition_id: string;
  idempotency_key: string;
  uniqueness_key_hash: string;
  uniqueness_key: Cap08S4T17TransitionUniquenessKeyV1;
  correction_authority: Cap08S4T17CorrectionAuthorityBindingV1;
  expected_latest_base: Cap08S4T17ExpectedLatestBaseV1;
  corrected_computation_predecessor: Cap08S4T17CorrectedComputationPredecessorV1;
  committed_t17: Cap08S4T17CommittedA1BindingsV1;
  transition_semantics: {
    latest_before: "BASE_T16";
    computation_from: "CORRECTED_T16";
    persistence_cas_from: "BASE_T16";
    latest_after: "T17";
    outcome: typeof CAP08_S4_T17_FORMAL_OUTCOME_V1;
  };
  determinism_hash: string;
};

export type Cap08S4T17FormalA1ProofV1 = {
  schema_version: typeof CAP08_S4_T17_FORMAL_A1_PROOF_SCHEMA_VERSION_V1;
  dataset_id: "mcft_cap08_stage1a_replay_v2";
  profile_id: "MULTI_REGIME_RAINFALL_PLUS_FORECAST_DERIVED_HIDDEN_0034_FVO_V1";
  outcome_profile_id: "FVO10_FROZEN_BUSINESS_OUTCOME_ANCHOR_V1";
  t17_logical_time: string;
  authorized_binding_ids: readonly ["binding_et0", "binding_weather"];
  forcing_relevant_record_hashes: string[];
  runtime_config: Cap08S4T17ObjectBindingV1;
  crop_stage_context: {
    ref: string;
    hash: string;
    crop_stage_code: string;
    kc: number;
  };
  selector_status: "SELECTED";
  selected_window_hash: string;
  selection_trace_hash: string;
  formal_outcome: typeof CAP08_S4_T17_FORMAL_OUTCOME_V1;
  a2_scope_status: typeof CAP08_S4_T17_A2_SCOPE_STATUS_V1;
  determinism_hash: string;
};

export type Cap08S4T17ExistingTransitionClassificationV1 =
  | "NO_EXISTING_TRANSITION"
  | "EXISTING_IDEMPOTENT_SUCCESS"
  | "POST_TRANSITION_PROJECTION_DIVERGENCE"
  | "PARTIAL_TRANSITION_CORRUPTION"
  | "IDEMPOTENCY_CONFLICT";

const HASH_PATTERN_V1 = /^sha256:[0-9a-f]{64}$/;
const REF_PATTERN_V1 = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalHourV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)
    || new Date(parsed).toISOString() !== text
    || !text.endsWith(":00:00.000Z")) {
    throw new Error(code);
  }
  return text;
}

function bindingV1(value: Cap08S4T17ObjectBindingV1, code: string): Cap08S4T17ObjectBindingV1 {
  const ref = requiredStringV1(value?.ref, `${code}_REF_REQUIRED`);
  const hash = requiredStringV1(value?.hash, `${code}_HASH_REQUIRED`);
  if (!REF_PATTERN_V1.test(ref)) throw new Error(`${code}_REF_INVALID`);
  if (!HASH_PATTERN_V1.test(hash)) throw new Error(`${code}_HASH_INVALID`);
  return { ref, hash };
}

function exactScopeV1(value: Cap08S4T17ScopeV1): Cap08S4T17ScopeV1 {
  return {
    tenant_id: requiredStringV1(value?.tenant_id, "CAP08_S4_T17_SCOPE_TENANT_REQUIRED"),
    project_id: requiredStringV1(value?.project_id, "CAP08_S4_T17_SCOPE_PROJECT_REQUIRED"),
    group_id: requiredStringV1(value?.group_id, "CAP08_S4_T17_SCOPE_GROUP_REQUIRED"),
    field_id: requiredStringV1(value?.field_id, "CAP08_S4_T17_SCOPE_FIELD_REQUIRED"),
    season_id: requiredStringV1(value?.season_id, "CAP08_S4_T17_SCOPE_SEASON_REQUIRED"),
    zone_id: requiredStringV1(value?.zone_id, "CAP08_S4_T17_SCOPE_ZONE_REQUIRED"),
  };
}

export function normalizeCap08S4T17UniquenessKeyV1(
  value: Cap08S4T17TransitionUniquenessKeyV1,
): Cap08S4T17TransitionUniquenessKeyV1 {
  if (value?.transition_kind !== CAP08_S4_T17_TRANSITION_KIND_V1) {
    throw new Error("CAP08_S4_T17_TRANSITION_KIND_MISMATCH");
  }
  return {
    transition_kind: CAP08_S4_T17_TRANSITION_KIND_V1,
    formal_run_id: requiredStringV1(value.formal_run_id, "CAP08_S4_T17_FORMAL_RUN_ID_REQUIRED"),
    scope: exactScopeV1(value.scope),
    lineage_id: requiredStringV1(value.lineage_id, "CAP08_S4_T17_LINEAGE_ID_REQUIRED"),
    revision_id: requiredStringV1(value.revision_id, "CAP08_S4_T17_REVISION_ID_REQUIRED"),
    t17_logical_time: canonicalHourV1(value.t17_logical_time, "CAP08_S4_T17_LOGICAL_TIME_INVALID"),
  };
}

export function normalizeCap08S4T17WitnessInputV1(
  value: Cap08S4T17TransitionWitnessInputV1,
): Cap08S4T17TransitionWitnessInputV1 {
  const expected = value.expected_latest_base;
  const corrected = value.corrected_computation_predecessor;
  const committed = value.committed_t17;
  if (!Number.isInteger(corrected.previous_tick_sequence) || corrected.previous_tick_sequence < 0) {
    throw new Error("CAP08_S4_T17_PREVIOUS_TICK_SEQUENCE_INVALID");
  }
  const normalized: Cap08S4T17TransitionWitnessInputV1 = {
    uniqueness_key: normalizeCap08S4T17UniquenessKeyV1(value.uniqueness_key),
    correction_authority: {
      authority_ref: requiredStringV1(
        value.correction_authority?.authority_ref,
        "CAP08_S4_T17_AUTHORITY_REF_REQUIRED",
      ),
      authority_hash: bindingV1(
        { ref: value.correction_authority?.authority_ref, hash: value.correction_authority?.authority_hash },
        "CAP08_S4_T17_AUTHORITY",
      ).hash,
    },
    expected_latest_base: {
      state: bindingV1(expected?.state, "CAP08_S4_T17_BASE_STATE"),
      checkpoint: bindingV1(expected?.checkpoint, "CAP08_S4_T17_BASE_CHECKPOINT"),
      forecast_result: bindingV1(expected?.forecast_result, "CAP08_S4_T17_BASE_FORECAST_RESULT"),
      successful_forecast: bindingV1(
        expected?.successful_forecast,
        "CAP08_S4_T17_BASE_SUCCESSFUL_FORECAST",
      ),
    },
    corrected_computation_predecessor: {
      state: bindingV1(corrected?.state, "CAP08_S4_T17_CORRECTED_STATE"),
      checkpoint: bindingV1(corrected?.checkpoint, "CAP08_S4_T17_CORRECTED_CHECKPOINT"),
      forecast_result: bindingV1(
        corrected?.forecast_result,
        "CAP08_S4_T17_CORRECTED_FORECAST_RESULT",
      ),
      successful_forecast: bindingV1(
        corrected?.successful_forecast,
        "CAP08_S4_T17_CORRECTED_SUCCESSFUL_FORECAST",
      ),
      scenario_set: bindingV1(corrected?.scenario_set, "CAP08_S4_T17_CORRECTED_SCENARIO_SET"),
      previous_tick_sequence: corrected.previous_tick_sequence,
    },
    committed_t17: {
      record_set_id: requiredStringV1(committed?.record_set_id, "CAP08_S4_T17_RECORD_SET_ID_REQUIRED"),
      aggregate_determinism_hash: bindingV1(
        { ref: committed?.record_set_id, hash: committed?.aggregate_determinism_hash },
        "CAP08_S4_T17_RECORD_SET",
      ).hash,
      state: bindingV1(committed?.state, "CAP08_S4_T17_COMMITTED_STATE"),
      checkpoint: bindingV1(committed?.checkpoint, "CAP08_S4_T17_COMMITTED_CHECKPOINT"),
      forecast_result: bindingV1(
        committed?.forecast_result,
        "CAP08_S4_T17_COMMITTED_FORECAST_RESULT",
      ),
      successful_forecast: bindingV1(
        committed?.successful_forecast,
        "CAP08_S4_T17_COMMITTED_SUCCESSFUL_FORECAST",
      ),
    },
  };
  if (normalized.corrected_computation_predecessor.forecast_result.ref
    !== normalized.corrected_computation_predecessor.successful_forecast.ref
    || normalized.corrected_computation_predecessor.forecast_result.hash
      !== normalized.corrected_computation_predecessor.successful_forecast.hash) {
    throw new Error("CAP08_S4_T17_A1_CORRECTED_SUCCESSFUL_FORECAST_MISMATCH");
  }
  if (normalized.committed_t17.forecast_result.ref
    !== normalized.committed_t17.successful_forecast.ref
    || normalized.committed_t17.forecast_result.hash
      !== normalized.committed_t17.successful_forecast.hash) {
    throw new Error("CAP08_S4_T17_A1_COMMITTED_SUCCESSFUL_FORECAST_MISMATCH");
  }
  return normalized;
}

export function validateCap08S4T17FormalA1ProofV1(
  proof: Cap08S4T17FormalA1ProofV1,
): void {
  if (proof.schema_version !== CAP08_S4_T17_FORMAL_A1_PROOF_SCHEMA_VERSION_V1
    || proof.dataset_id !== "mcft_cap08_stage1a_replay_v2"
    || proof.profile_id
      !== "MULTI_REGIME_RAINFALL_PLUS_FORECAST_DERIVED_HIDDEN_0034_FVO_V1"
    || proof.outcome_profile_id !== "FVO10_FROZEN_BUSINESS_OUTCOME_ANCHOR_V1") {
    throw new Error("CAP08_S4_T17_FORMAL_DATASET_IDENTITY_MISMATCH");
  }
  canonicalHourV1(proof.t17_logical_time, "CAP08_S4_T17_FORMAL_T17_TIME_INVALID");
  if (JSON.stringify(proof.authorized_binding_ids)
    !== JSON.stringify(["binding_et0", "binding_weather"])) {
    throw new Error("CAP08_S4_T17_FORMAL_BINDING_SET_MISMATCH");
  }
  if (proof.selector_status !== "SELECTED"
    || proof.formal_outcome !== CAP08_S4_T17_FORMAL_OUTCOME_V1
    || proof.a2_scope_status !== CAP08_S4_T17_A2_SCOPE_STATUS_V1) {
    throw new Error("FORMAL_DATASET_INVARIANT_VIOLATION");
  }
  if (!Array.isArray(proof.forcing_relevant_record_hashes)
    || proof.forcing_relevant_record_hashes.length === 0
    || proof.forcing_relevant_record_hashes.some((hash) => !HASH_PATTERN_V1.test(hash))) {
    throw new Error("CAP08_S4_T17_FORMAL_FORCING_HASH_SET_INVALID");
  }
  bindingV1(proof.runtime_config, "CAP08_S4_T17_FORMAL_RUNTIME_CONFIG");
  requiredStringV1(proof.crop_stage_context?.ref, "CAP08_S4_T17_FORMAL_CROP_STAGE_REF_REQUIRED");
  if (!HASH_PATTERN_V1.test(proof.crop_stage_context?.hash)) {
    throw new Error("CAP08_S4_T17_FORMAL_CROP_STAGE_HASH_INVALID");
  }
  requiredStringV1(
    proof.crop_stage_context?.crop_stage_code,
    "CAP08_S4_T17_FORMAL_CROP_STAGE_CODE_REQUIRED",
  );
  if (typeof proof.crop_stage_context?.kc !== "number"
    || !Number.isFinite(proof.crop_stage_context.kc)) {
    throw new Error("CAP08_S4_T17_FORMAL_KC_INVALID");
  }
  if (!HASH_PATTERN_V1.test(proof.selected_window_hash)
    || !HASH_PATTERN_V1.test(proof.selection_trace_hash)) {
    throw new Error("CAP08_S4_T17_FORMAL_SELECTION_HASH_INVALID");
  }
  const { determinism_hash: ignored, ...basis } = proof;
  void ignored;
  if (semanticHashV1(basis) !== proof.determinism_hash) {
    throw new Error("CAP08_S4_T17_FORMAL_A1_PROOF_HASH_MISMATCH");
  }
}

export function assertCap08S4T17FormalA1OutcomeV1(
  selectorStatus: "SELECTED" | "BLOCKED" | "FAILED",
): void {
  if (selectorStatus !== "SELECTED") {
    throw new Error("FORMAL_DATASET_INVARIANT_VIOLATION");
  }
}

export function classifyCap08S4T17ExistingTransitionV1(input: {
  record_set_presence: "ABSENT" | "EXACT" | "CONFLICT";
  witness_presence: "ABSENT" | "EXACT" | "CONFLICT";
  transition_guard_presence: "ABSENT" | "EXACT" | "CONFLICT";
  latest_projection_state: "BASE_T16" | "EXACT_T17" | "OTHER";
}): Cap08S4T17ExistingTransitionClassificationV1 {
  const values = [
    input.record_set_presence,
    input.witness_presence,
    input.transition_guard_presence,
  ];
  if (values.some((value) => value === "CONFLICT")) return "IDEMPOTENCY_CONFLICT";
  const present = values.filter((value) => value === "EXACT").length;
  if (present === 0) return "NO_EXISTING_TRANSITION";
  if (present !== values.length) return "PARTIAL_TRANSITION_CORRUPTION";
  if (input.latest_projection_state !== "EXACT_T17") {
    return "POST_TRANSITION_PROJECTION_DIVERGENCE";
  }
  return "EXISTING_IDEMPOTENT_SUCCESS";
}
