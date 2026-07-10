// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_02_CONTRACTS_CONFIG_NEGATIVE.ts
// Purpose: prove high-risk MCFT-CAP-02 contracts/config violations fail before persistence or A2 execution.
// Boundary: pure in-memory negative acceptance only; no filesystem, PostgreSQL, Dynamics execution, Evidence selection, routes, scheduler, or canonical writes.

import assert from "node:assert/strict";
import { computeMemberDeterminismHashV1, semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  CONTINUATION_ASSIMILATION_REASON_CODES_V1,
  CONTINUATION_FORECAST_REASON_CODES_V1,
  validateContinuationMemberV1,
} from "../../apps/server/src/domain/twin_runtime/continuation_contracts_v1.js";
import { deriveContinuationOperationIdentityV1 } from "../../apps/server/src/domain/twin_runtime/continuation_operation_identity_v1.js";
import {
  CONTINUATION_DYNAMICS_MODEL_ID_V1,
  CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1,
  CONTINUATION_NO_OBSERVATION_POLICY_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/continuation_runtime_config_v1.js";

const scope = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "field_c8_demo",
  season_id: "season_2026_c8_corn",
  zone_id: "zone_mcft_c8_water_001",
};
const logicalTime = "2026-06-01T02:00:00.000Z";
const operation = deriveContinuationOperationIdentityV1({
  scope,
  lineage_id: "lineage_da76d015085f0d37bf2ed478",
  revision_id: "revision_e0c62f99ac3db66f60a87e2b",
  logical_time: logicalTime,
  operation_variant: "A2_BLOCKED_FORECAST",
});

function memberV1(
  objectType: CanonicalObjectEnvelopeV1["object_type"],
  payload: Record<string, unknown>,
): CanonicalObjectEnvelopeV1 {
  const object: CanonicalObjectEnvelopeV1 = {
    object_id: operation.member_object_ids[objectType as keyof typeof operation.member_object_ids],
    object_type: objectType,
    schema_version: "v1",
    ...scope,
    logical_time: logicalTime,
    as_of: logicalTime,
    source_refs: ["mcft_rb_bf1da664164a4fedda249bcb"],
    evidence_refs: [],
    runtime_config_ref: "twin_runtime_config_continuation_fixture",
    runtime_config_hash: `sha256:${"1".repeat(64)}`,
    idempotency_key: `fixture_${objectType}`,
    determinism_hash: "",
    limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED"],
    created_at: logicalTime,
    lineage_id: operation.continuation_operation_key.lineage_id,
    revision_id: operation.continuation_operation_key.revision_id,
    payload,
  };
  object.determinism_hash = computeMemberDeterminismHashV1(object as unknown as Record<string, unknown>);
  return object;
}

function transitionPayloadV1(trace: Record<string, unknown>): Record<string, unknown> {
  return {
    transition_kind: "CONTINUATION",
    previous_posterior_ref: "previous_state_ref",
    previous_posterior_hash: `sha256:${"2".repeat(64)}`,
    process_model_status: "APPLIED",
    process_model_id: CONTINUATION_DYNAMICS_MODEL_ID_V1,
    process_model_version: 1,
    propagation_start: "2026-06-01T01:00:00.000Z",
    propagation_end: logicalTime,
    previous_state_runtime_config_ref: "parent_config_ref",
    current_runtime_config_ref: "twin_runtime_config_continuation_fixture",
    mass_balance_trace: trace,
    mass_balance_trace_hash: semanticHashV1(trace),
    evidence_window_ref: "evidence_ref",
    assimilation_update_ref: "assimilation_ref",
    posterior_state_ref: "state_ref",
  };
}

function statePayloadV1(computationBasis: Record<string, unknown>): Record<string, unknown> {
  return {
    state_kind: "POSTERIOR",
    previous_posterior_ref: "previous_state_ref",
    transition_ref: "transition_ref",
    assimilation_update_ref: "assimilation_ref",
    evidence_window_ref: "evidence_ref",
    reality_binding_ref: "mcft_rb_bf1da664164a4fedda249bcb",
    reality_binding_hash: `sha256:${"3".repeat(64)}`,
    root_zone_storage_mm: { mean: 57.753012, variance: 241.270014630625 },
    root_zone_vwc_fraction: { mean: 0.19251, variance: 0.002681, stddev: 0.051776 },
    uncertainty: { policy_id: "CONTROLLED_ADDITIVE_PROCESS_UNCERTAINTY_BUDGET_V1" },
    computation_basis: computationBasis,
    available_water_fraction: 0.402834,
    depletion_from_field_capacity_mm: 32.246988,
    mass_balance_trace_hash: `sha256:${"4".repeat(64)}`,
    confidence: { status: "NOT_ESTABLISHED", reason_code: "NO_CALIBRATED_CONFIDENCE_MODEL" },
    use_eligibility: {
      state_valid: true,
      posterior_chain_eligible: true,
      forecast_source_eligible: true,
      recommendation_input_eligible: false,
      action_input_eligible: false,
    },
  };
}

let pass = 0;
function rejects(object: CanonicalObjectEnvelopeV1, pattern: RegExp, message: string): void {
  assert.throws(() => validateContinuationMemberV1(object), pattern);
  pass += 1;
  console.log(`PASS ${message}`);
}

const nestedSelfHashTrace = {
  previous_storage_mm: "57.778512",
  execution_events: [{ source_record_id: "execution_1", self_hash: "forbidden" }],
};
rejects(
  memberV1("twin_state_transition_v1", transitionPayloadV1(nestedSelfHashTrace)),
  /CONTINUATION_MASS_BALANCE_TRACE_SELF_HASH_FORBIDDEN/,
  "nested mass-balance trace self-hash rejected",
);

const wrongMeanScale = {
  basis_origin: "DERIVED_FROM_MCFT_CAP_01_POSTERIOR_V1",
  source_posterior_ref: "previous_state_ref",
  source_vwc_variance: "0.002678",
  root_zone_depth_mm: "300.000000",
  storage_mean_mm_decimal: { value: "57.7530120", scale: 7 },
  storage_variance_mm2_decimal: { value: "241.270014630625", scale: 12 },
};
rejects(
  memberV1("twin_state_estimate_v1", statePayloadV1(wrongMeanScale)),
  /CONTINUATION_STORAGE_MEAN_DECIMAL_(FORMAT_INVALID|SCALE_MISMATCH)/,
  "storage mean computation basis rejects non-six scale",
);

const wrongVarianceScale = {
  basis_origin: "DERIVED_FROM_MCFT_CAP_01_POSTERIOR_V1",
  source_posterior_ref: "previous_state_ref",
  source_vwc_variance: "0.002678",
  root_zone_depth_mm: "300.000000",
  storage_mean_mm_decimal: { value: "57.753012", scale: 6 },
  storage_variance_mm2_decimal: { value: "241.27001463062", scale: 11 },
};
rejects(
  memberV1("twin_state_estimate_v1", statePayloadV1(wrongVarianceScale)),
  /CONTINUATION_STORAGE_VARIANCE_DECIMAL_(FORMAT_INVALID|SCALE_MISMATCH)/,
  "storage variance computation basis rejects non-twelve scale",
);

const dynamicRootDepth = {
  basis_origin: "DERIVED_FROM_MCFT_CAP_01_POSTERIOR_V1",
  source_posterior_ref: "previous_state_ref",
  source_vwc_variance: "0.002678",
  root_zone_depth_mm: "150.000000",
  storage_mean_mm_decimal: { value: "57.753012", scale: 6 },
  storage_variance_mm2_decimal: { value: "241.270014630625", scale: 12 },
};
rejects(
  memberV1("twin_state_estimate_v1", statePayloadV1(dynamicRootDepth)),
  /CONTINUATION_FIRST_BRIDGE_DEPTH_MISMATCH/,
  "dynamic crop root depth cannot replace governed 300 mm State coordinate",
);

const scenarioEligibleState = statePayloadV1({
  basis_origin: "DERIVED_FROM_MCFT_CAP_01_POSTERIOR_V1",
  source_posterior_ref: "previous_state_ref",
  source_vwc_variance: "0.002678",
  root_zone_depth_mm: "300.000000",
  storage_mean_mm_decimal: { value: "57.753012", scale: 6 },
  storage_variance_mm2_decimal: { value: "241.270014630625", scale: 12 },
});
(scenarioEligibleState.use_eligibility as Record<string, unknown>).scenario_input_eligible = true;
rejects(
  memberV1("twin_state_estimate_v1", scenarioEligibleState),
  /CONTINUATION_STATE_SCENARIO_INPUT_ELIGIBILITY_FORBIDDEN/,
  "State scenario_input_eligible is rejected",
);

rejects(
  memberV1("twin_assimilation_update_v1", {
    status: "NOT_APPLIED",
    disposition: "DEFERRED_TO_MCFT_CAP_03",
    candidate_observation_refs: [],
    consumed_observation_refs: [],
    predicted_observation: null,
    innovation: null,
    residual: null,
    assimilation_gain: 0.5,
    prior_mean: 0.2,
    posterior_mean: 0.2,
    prior_variance: 0.01,
    posterior_variance: 0.01,
    reason_codes: [...CONTINUATION_ASSIMILATION_REASON_CODES_V1],
    policy_id: CONTINUATION_NO_OBSERVATION_POLICY_ID_V1,
    state_transition_ref: "transition_ref",
    posterior_state_ref: "state_ref",
  }),
  /CONTINUATION_ASSIMILATION_ASSIMILATION_GAIN_MUST_BE_NULL/,
  "NOT_APPLIED assimilation rejects gain",
);

rejects(
  memberV1("twin_forecast_run_v1", {
    status: "BLOCKED",
    points: [{ logical_time: logicalTime, mean: 1 }],
    scenario_eligible: false,
    source_posterior_ref: "state_ref",
    successful_forecast_ref: null,
    reason_codes: [...CONTINUATION_FORECAST_REASON_CODES_V1],
    policy_id: CONTINUATION_FORECAST_BLOCK_POLICY_ID_V1,
  }),
  /CONTINUATION_FORECAST_POINTS_MUST_BE_EMPTY/,
  "BLOCKED Forecast rejects points",
);

console.log(`MCFT-CAP-02 contracts-config negative: ${pass} PASS, 0 FAIL`);
