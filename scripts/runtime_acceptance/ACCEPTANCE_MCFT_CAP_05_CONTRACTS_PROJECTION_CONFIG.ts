// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_CONTRACTS_PROJECTION_CONFIG.ts
// Purpose: exercise the MCFT-CAP-05 S2 pure Decision, Action Feedback, adapter, Forecast projection/residual, feedback-cycle projection and Runtime Config-chain contracts.
// Boundary: deterministic in-process acceptance only; no database, migration, canonical append, route, web, scheduler, clock, environment-derived semantics, or network.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { aggregateExecutedIrrigationV1 } from "../../apps/server/src/domain/soil_water/executed_irrigation_input_v1.js";
import {
  adaptCap05ActionFeedbackToExecutedIrrigationV1,
  requireSingleEligibleCap05ExecutionEventV1,
} from "../../apps/server/src/domain/twin_runtime/action_feedback_to_executed_irrigation_v1.js";
import { adjudicateCap05DecisionSecondWriteV1 } from "../../apps/server/src/domain/twin_runtime/decision_second_write_policy_v1.js";
import {
  buildCap05ActionFeedbackV1,
  buildCap05DecisionV1,
  buildCap05ScenarioOptionMemberRefV1,
  resolveCap05ScenarioOptionMemberV1,
} from "../../apps/server/src/domain/twin_runtime/feedback_canonical_contracts_v1.js";
import { buildCap05FeedbackCycleProjectionV1 } from "../../apps/server/src/domain/twin_runtime/feedback_cycle_projection_v1.js";
import {
  CAP05_CONFIG_CHAIN_LENGTH_V1,
  CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1,
  CAP05_RUNTIME_CONFIG_PURPOSE_V1,
  compileCap05RuntimeConfigChainV1,
  validateCap05RuntimeConfigPayloadV1,
  type Cap05RuntimeConfigPayloadV1,
} from "../../apps/server/src/domain/twin_runtime/feedback_runtime_config_v1.js";
import {
  buildCap05ForecastResidualV1,
  projectCap05ForecastPointToObservationV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_observation_residual_v1.js";
import type {
  Cap04ForecastPointV1,
  Cap04ScenarioOptionIdV1,
  Cap04ScenarioSetEnvelopeV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LOCK = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-PREDECESSOR-LOCK.json"), "utf8"));
const S1_ROOT = path.join(ROOT, "fixtures/mcft/water_state/feedback_v1");
let pass = 0;

function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}

function readOne(file: string): any {
  return JSON.parse(fs.readFileSync(path.join(S1_ROOT, file), "utf8").trim());
}

function scenarioOptionStub(optionId: Cap04ScenarioOptionIdV1, requestedIrrigation: string): Record<string, unknown> {
  return {
    option_id: optionId,
    option_kind: optionId === "NO_ACTION" ? "NO_ACTION" : "IMMEDIATE_IRRIGATION",
    source_forecast_ref: LOCK.canonical_identity.latest_successful_forecast_ref,
    source_forecast_hash: LOCK.canonical_identity.latest_successful_forecast_hash,
    source_posterior_ref: LOCK.canonical_identity.latest_posterior_state_ref,
    source_posterior_hash: LOCK.canonical_identity.latest_posterior_state_hash,
    runtime_config_ref: LOCK.canonical_identity.predecessor_state_runtime_config_ref,
    runtime_config_hash: LOCK.canonical_identity.predecessor_state_runtime_config_hash,
    requested_irrigation_mm: requestedIrrigation,
    application_efficiency_fraction: "1.000000",
    effective_irrigation_mm: requestedIrrigation,
    application_horizon: optionId === "NO_ACTION" ? null : 1,
    application_interval: optionId === "NO_ACTION" ? null : { interval_start: "2026-06-04T01:00:00.000Z", interval_end: "2026-06-04T02:00:00.000Z" },
    epistemic_status: "ASSUMED",
    execution_status: "NOT_EXECUTED",
    trajectory_points: [],
    minimum_available_water_fraction: "0.500000",
    first_stress_target_time: null,
    stress_hour_count: 0,
    final_storage_mm: "66.000000",
    total_precipitation_mm: "0.000000",
    total_crop_et_mm: "0.000000",
    total_irrigation_mm: requestedIrrigation,
    total_runoff_mm: "0.000000",
    total_drainage_mm: "0.000000",
    total_overflow_mm: "0.000000",
    difference_from_no_action: {
      final_storage_delta_mm: requestedIrrigation,
      minimum_awf_delta: "0.000000",
      stress_hour_count_delta: 0,
      total_irrigation_delta_mm: requestedIrrigation,
      total_drainage_delta_mm: "0.000000",
      total_overflow_delta_mm: "0.000000",
    },
    uncertainty_basis: {},
    assumption_basis: {
      source_forecast_ref: LOCK.canonical_identity.latest_successful_forecast_ref,
      source_forecast_hash: LOCK.canonical_identity.latest_successful_forecast_hash,
      runtime_config_ref: LOCK.canonical_identity.predecessor_state_runtime_config_ref,
      runtime_config_hash: LOCK.canonical_identity.predecessor_state_runtime_config_hash,
      scenario_policy_id: "THREE_OPTION_IRRIGATION_SCENARIO_POLICY_V1",
      option_id: optionId,
    },
    limitations: ["CONTROLLED_REPLAY_ONLY"],
  };
}

function scenarioSetFixture(): Cap04ScenarioSetEnvelopeV1 {
  const scope = LOCK.expected_scope;
  return {
    object_id: LOCK.canonical_identity.latest_scenario_set_ref,
    object_type: "twin_scenario_set_v1",
    schema_version: "v1",
    ...scope,
    logical_time: "2026-06-04T01:00:00.000Z",
    as_of: "2026-06-04T01:00:00.000Z",
    source_refs: [LOCK.canonical_identity.latest_successful_forecast_ref],
    evidence_refs: [],
    runtime_config_ref: LOCK.canonical_identity.predecessor_state_runtime_config_ref,
    runtime_config_hash: LOCK.canonical_identity.predecessor_state_runtime_config_hash,
    idempotency_key: "scenario_set_fixture_key",
    determinism_hash: LOCK.canonical_identity.latest_scenario_set_hash,
    limitations: ["CONTROLLED_REPLAY_ONLY"],
    created_at: "2026-06-04T01:00:00.000Z",
    lineage_id: LOCK.canonical_identity.lineage_id,
    revision_id: LOCK.canonical_identity.revision_id,
    payload: {
      record_set_contract_id: "MCFT_CAP_04_THREE_SCENARIO_SET_V1",
      transaction_variant: "B_SCENARIO_COMMIT",
      source_forecast_ref: LOCK.canonical_identity.latest_successful_forecast_ref,
      source_forecast_hash: LOCK.canonical_identity.latest_successful_forecast_hash,
      source_posterior_ref: LOCK.canonical_identity.latest_posterior_state_ref,
      source_posterior_hash: LOCK.canonical_identity.latest_posterior_state_hash,
      scenario_policy_id: "THREE_OPTION_IRRIGATION_SCENARIO_POLICY_V1",
      runtime_config_ref: LOCK.canonical_identity.predecessor_state_runtime_config_ref,
      runtime_config_hash: LOCK.canonical_identity.predecessor_state_runtime_config_hash,
      options: [
        scenarioOptionStub("NO_ACTION", "0.000000"),
        scenarioOptionStub("IRRIGATE_NOW_15MM", "15.000000"),
        scenarioOptionStub("IRRIGATE_NOW_25MM", "25.000000"),
      ] as any,
      limitations: ["CONTROLLED_REPLAY_ONLY"],
    },
  } as Cap04ScenarioSetEnvelopeV1;
}

function forecastPointFixture(): Cap04ForecastPointV1 {
  return {
    horizon_hour: 2,
    interval_start: "2026-06-04T02:00:00.000Z",
    interval_end: "2026-06-04T03:00:00.000Z",
    target_time: "2026-06-04T03:00:00.000Z",
    previous_storage_mm: "66.000000",
    gross_precipitation_assumption_mm: "0.000000",
    surface_runoff_mm: "0.000000",
    effective_precipitation_mm: "0.000000",
    assumed_irrigation_mm: "0.000000",
    reference_et0_mm: "0.110000",
    crop_stage_code: "CONTROLLED_STAGE",
    kc: "1.000000",
    requested_crop_et_mm: "0.110000",
    actual_crop_et_mm: "0.000000",
    unmet_crop_et_mm: "0.110000",
    drainage_mm: "0.000000",
    saturation_overflow_mm: "0.000000",
    storage_mean_mm: "66.000000",
    storage_variance_mm2: "0.090000",
    storage_interval_unclipped_lower_mm: "65.412000",
    storage_interval_unclipped_upper_mm: "66.588000",
    storage_interval_emitted_lower_mm: "65.412000",
    storage_interval_emitted_upper_mm: "66.588000",
    available_water_fraction: "0.500000",
    depletion_from_field_capacity_mm: "0.000000",
    mass_balance_error_mm: "0.000000",
    determinism_hash: "sha256:forecast-point-h2-controlled",
  };
}

function main(): void {
  assert.equal(LOCK.status, "COMPLETE");
  const scope = LOCK.expected_scope;
  const chainA = compileCap05RuntimeConfigChainV1({
    scope,
    first_effective_logical_time: "2026-06-04T02:00:00.000Z",
    parent_runtime_config_ref: LOCK.canonical_identity.predecessor_state_runtime_config_ref,
    parent_runtime_config_hash: LOCK.canonical_identity.predecessor_state_runtime_config_hash,
    reality_binding_ref: LOCK.canonical_identity.reality_binding_ref,
    reality_binding_hash: LOCK.canonical_identity.reality_binding_hash,
    source_matrix_hash: "sha256:source-matrix-cap05-s2",
    configuration_matrix_hash: "sha256:configuration-matrix-cap05-s2",
    geometry_semantic_hash: "sha256:geometry-cap05-s2",
  });
  const chainB = compileCap05RuntimeConfigChainV1({
    scope,
    first_effective_logical_time: "2026-06-04T02:00:00.000Z",
    parent_runtime_config_ref: LOCK.canonical_identity.predecessor_state_runtime_config_ref,
    parent_runtime_config_hash: LOCK.canonical_identity.predecessor_state_runtime_config_hash,
    reality_binding_ref: LOCK.canonical_identity.reality_binding_ref,
    reality_binding_hash: LOCK.canonical_identity.reality_binding_hash,
    source_matrix_hash: "sha256:source-matrix-cap05-s2",
    configuration_matrix_hash: "sha256:configuration-matrix-cap05-s2",
    geometry_semantic_hash: "sha256:geometry-cap05-s2",
  });
  assert.equal(chainA.length, CAP05_CONFIG_CHAIN_LENGTH_V1);
  assert.deepEqual(chainA, chainB);
  chainA.forEach((config, index) => {
    validateCap05RuntimeConfigPayloadV1(config.payload as unknown as Cap05RuntimeConfigPayloadV1);
    assert.equal((config.payload as any).config_purpose, CAP05_RUNTIME_CONFIG_PURPOSE_V1);
    if (index === 0) {
      assert.equal((config.payload as any).parent_runtime_config_ref, LOCK.canonical_identity.predecessor_state_runtime_config_ref);
      assert.equal((config.payload as any).parent_runtime_config_hash, LOCK.canonical_identity.predecessor_state_runtime_config_hash);
    } else {
      assert.equal((config.payload as any).parent_runtime_config_ref, chainA[index - 1].object_id);
      assert.equal((config.payload as any).parent_runtime_config_hash, chainA[index - 1].determinism_hash);
    }
  });
  ok("eight immutable CAP-05 Runtime Configs are deterministic and predecessor-chained");

  const scenarioSet = scenarioSetFixture();
  const decisionRequest = readOne("decision_requests.jsonl");
  const approval = readOne("approval_assertions.jsonl");
  const plan = readOne("approved_plans.jsonl");
  const dispatch = readOne("external_dispatch.jsonl");
  const receipt = readOne("execution_receipts.jsonl");
  const observation = readOne("soil_observations.jsonl");

  const selectedMemberRef = buildCap05ScenarioOptionMemberRefV1(scenarioSet.object_id, "IRRIGATE_NOW_15MM");
  const selectedMember = resolveCap05ScenarioOptionMemberV1(scenarioSet, selectedMemberRef);
  assert.equal(selectedMember.option_id, "IRRIGATE_NOW_15MM");
  assert.throws(() => resolveCap05ScenarioOptionMemberV1(scenarioSet, `${selectedMemberRef}-forged`), /CAP05_SCENARIO_MEMBER_CARDINALITY|CAP05_SCENARIO_MEMBER_REF_INVALID/);
  ok("GEOX semantic Scenario member reference resolves by exact option_id");

  const decision = buildCap05DecisionV1({
    scope,
    scenario_set: scenarioSet,
    selected_option_id: "IRRIGATE_NOW_15MM",
    decision_request_evidence_ref: decisionRequest.source_record_id,
    decision_request_evidence_hash: decisionRequest.source_record_hash,
    actor_ref: decisionRequest.canonical_payload.actor_ref,
    decided_at: "2026-06-04T01:10:00.000Z",
    context_lineage_ref: LOCK.canonical_identity.active_lineage_ref,
    context_revision_ref: LOCK.canonical_identity.revision_id,
    created_at: "2026-06-04T01:10:00.000Z",
  });
  const decisionAgain = buildCap05DecisionV1({
    scope,
    scenario_set: scenarioSet,
    selected_option_id: "IRRIGATE_NOW_15MM",
    decision_request_evidence_ref: decisionRequest.source_record_id,
    decision_request_evidence_hash: decisionRequest.source_record_hash,
    actor_ref: decisionRequest.canonical_payload.actor_ref,
    decided_at: "2026-06-04T01:10:00.000Z",
    context_lineage_ref: LOCK.canonical_identity.active_lineage_ref,
    context_revision_ref: LOCK.canonical_identity.revision_id,
    created_at: "2026-06-04T01:10:00.000Z",
  });
  assert.equal(adjudicateCap05DecisionSecondWriteV1(null, decision), "INSERT");
  assert.equal(adjudicateCap05DecisionSecondWriteV1(decision, decisionAgain), "EXISTING_IDENTICAL");
  const conflictingDecision = buildCap05DecisionV1({
    scope,
    scenario_set: scenarioSet,
    selected_option_id: "IRRIGATE_NOW_25MM",
    decision_request_evidence_ref: decisionRequest.source_record_id,
    decision_request_evidence_hash: decisionRequest.source_record_hash,
    actor_ref: decisionRequest.canonical_payload.actor_ref,
    decided_at: "2026-06-04T01:10:00.000Z",
    context_lineage_ref: LOCK.canonical_identity.active_lineage_ref,
    context_revision_ref: LOCK.canonical_identity.revision_id,
    created_at: "2026-06-04T01:10:00.000Z",
  });
  assert.throws(() => adjudicateCap05DecisionSecondWriteV1(decision, conflictingDecision), /CAP05_DECISION_IMMUTABLE_CONFLICT/);
  ok("Human Decision builder and immutable second-write policy are deterministic");

  const actionFeedback = buildCap05ActionFeedbackV1({
    scope,
    decision_ref: decision.object_id,
    decision_hash: decision.determinism_hash,
    approved_plan_evidence_ref: plan.source_record_id,
    approved_plan_evidence_hash: plan.source_record_hash,
    origin_kind: "EXTERNAL_EVIDENCE",
    receipt_ref: receipt.source_record_id,
    dispatch_disposition: dispatch.canonical_payload.dispatch_disposition,
    event_id: receipt.canonical_payload.event_id,
    source_record_id: receipt.source_record_id,
    binding_id: receipt.binding_id,
    origin_source_id: receipt.origin_source_id,
    execution_status: receipt.canonical_payload.execution_status,
    validation_status: "VALIDATED_WITH_LIMITATIONS",
    source_quality: receipt.canonical_payload.source_quality,
    eligible_for_state_input: receipt.canonical_payload.eligible_for_state_input,
    actual_amount_mm: "13.600000",
    spatial_coverage_fraction: "0.910000",
    execution_start: receipt.role_time.execution_start,
    execution_end: receipt.role_time.execution_end,
    ingested_at: receipt.role_time.ingested_at,
    available_to_runtime_at: receipt.available_to_runtime_at,
    runtime_config_ref: chainA[0].object_id,
    runtime_config_hash: chainA[0].determinism_hash,
    context_lineage_ref: LOCK.canonical_identity.active_lineage_ref,
    context_revision_ref: LOCK.canonical_identity.revision_id,
    created_at: receipt.available_to_runtime_at,
  });
  assert.equal(actionFeedback.payload.target_scope_equivalent_irrigation_mm, "12.376000");
  const adapted = adaptCap05ActionFeedbackToExecutedIrrigationV1(actionFeedback);
  assert.equal(adapted.candidate.source_quality, "USABLE");
  assert.equal(adapted.trace.source_execution_status, "PARTIALLY_EXECUTED");
  assert.equal(adapted.trace.normalized_execution_status, "EXECUTED");
  assert.equal(requireSingleEligibleCap05ExecutionEventV1([adapted]), adapted);
  assert.throws(() => requireSingleEligibleCap05ExecutionEventV1([adapted, adapted]), /CAP05_MULTIPLE_EXECUTION_EVENTS_FORBIDDEN_V1/);
  const aggregation = aggregateExecutedIrrigationV1({
    candidates: [adapted.candidate],
    interval_start_exclusive: "2026-06-04T01:00:00.000Z",
    interval_end_inclusive: "2026-06-04T02:00:00.000Z",
  });
  assert.equal(aggregation.effective_irrigation_mm, "12.376000");
  ok("Action Feedback adapter preserves source trace and reuses existing irrigation aggregation");

  const forecastPoint = forecastPointFixture();
  const projection = projectCap05ForecastPointToObservationV1({
    forecast_run_ref: LOCK.canonical_identity.latest_successful_forecast_ref,
    forecast_run_hash: LOCK.canonical_identity.latest_successful_forecast_hash,
    forecast_point_ref: `${LOCK.canonical_identity.latest_successful_forecast_ref}#/points/by-horizon/2`,
    forecast_point: forecastPoint,
    root_zone_depth_mm: "300.000000",
    actual_observation_ref: observation.source_record_id,
    actual_observation_hash: observation.source_record_hash,
    actual_observation_value: "0.224000",
    actual_observation_variance: "0.000004000000",
    representativeness_variance: "0.000004000000",
  });
  assert.equal(projection.projection_method_id, CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1);
  assert.equal(projection.predicted_observation_value, "0.220000");
  assert.equal(projection.predicted_observation_variance, "0.000001000000");
  assert.equal(projection.residual_value, "0.004000");
  assert.equal(projection.total_residual_variance, "0.000009000000");
  assert.equal(projection.normalized_residual, "1.333333");
  ok("H=1 root-zone-mean Forecast projection and normalized residual math are exact");

  const residual = buildCap05ForecastResidualV1({
    scope,
    forecast_run_ref: LOCK.canonical_identity.latest_successful_forecast_ref,
    forecast_run_hash: LOCK.canonical_identity.latest_successful_forecast_hash,
    forecast_point_ref: `${LOCK.canonical_identity.latest_successful_forecast_ref}#/points/by-horizon/2`,
    forecast_point: forecastPoint,
    root_zone_depth_mm: "300.000000",
    actual_observation_ref: observation.source_record_id,
    actual_observation_hash: observation.source_record_hash,
    actual_observation_value: "0.224000",
    actual_observation_variance: "0.000004000000",
    representativeness_variance: "0.000004000000",
    runtime_config_ref: chainA[1].object_id,
    runtime_config_hash: chainA[1].determinism_hash,
    context_lineage_ref: LOCK.canonical_identity.active_lineage_ref,
    context_revision_ref: LOCK.canonical_identity.revision_id,
    observation_available_to_runtime_at: observation.available_to_runtime_at,
    assimilation_update_ref: "twin_assimilation_update_cap05_s2_fixture",
    assimilation_update_hash: "sha256:assimilation-update-cap05-s2-fixture",
    created_at: observation.available_to_runtime_at,
  });
  assert.equal(residual.payload.equivalence_claimed, false);
  assert.equal("assimilation_gain" in residual.payload, false);
  assert.equal("posterior_state_ref" in residual.payload, false);
  ok("Forecast Residual remains distinct from Assimilation Innovation and owns no posterior authority");

  const cycle = buildCap05FeedbackCycleProjectionV1({
    decision,
    approval_assertion_ref: approval.source_record_id,
    approval_assertion_hash: approval.source_record_hash,
    approved_plan_ref: plan.source_record_id,
    approved_plan_hash: plan.source_record_hash,
    dispatch_disposition: "EXTERNALLY_RECORDED",
    dispatch_evidence_ref: dispatch.source_record_id,
    dispatch_evidence_hash: dispatch.source_record_hash,
    action_feedback: actionFeedback,
    outcome_observation_ref: observation.source_record_id,
    outcome_observation_hash: observation.source_record_hash,
    forecast_residual: residual,
    assimilation_update_ref: residual.payload.assimilation_update_ref!,
    assimilation_update_hash: residual.payload.assimilation_update_hash!,
    updated_state_ref: "twin_state_estimate_cap05_s2_fixture",
    updated_state_hash: "sha256:updated-state-cap05-s2-fixture",
  });
  assert.equal(cycle.dispatch.disposition, "EXTERNALLY_RECORDED");
  assert.equal(cycle.execution.target_scope_equivalent_irrigation_mm, "12.376000");
  assert.ok(cycle.limitations.includes("NOT_CANONICAL_TRUTH"));
  ok("feedback-cycle projection exposes every required phase and remains rebuildable-only");

  const mutatedConfig = structuredClone(chainA[0].payload) as unknown as Cap05RuntimeConfigPayloadV1;
  (mutatedConfig as any).forecast_observation_projection_method_id = "ROOT_ZONE_STORAGE_TO_POINT_200MM_VWC_V1";
  assert.throws(() => validateCap05RuntimeConfigPayloadV1(mutatedConfig), /CAP05_PROJECTION_POLICY_MISMATCH/);
  assert.throws(() => buildCap05ActionFeedbackV1({
    scope,
    decision_ref: decision.object_id,
    decision_hash: decision.determinism_hash,
    approved_plan_evidence_ref: plan.source_record_id,
    approved_plan_evidence_hash: plan.source_record_hash,
    origin_kind: "EXTERNAL_EVIDENCE",
    receipt_ref: receipt.source_record_id,
    dispatch_disposition: "EXTERNALLY_RECORDED",
    event_id: receipt.canonical_payload.event_id,
    source_record_id: receipt.source_record_id,
    binding_id: receipt.binding_id,
    origin_source_id: receipt.origin_source_id,
    execution_status: "NOT_EXECUTED",
    validation_status: "VALIDATED",
    source_quality: "PASS",
    eligible_for_state_input: true,
    actual_amount_mm: "13.600000",
    spatial_coverage_fraction: "0.910000",
    execution_start: receipt.role_time.execution_start,
    execution_end: receipt.role_time.execution_end,
    ingested_at: receipt.role_time.ingested_at,
    available_to_runtime_at: receipt.available_to_runtime_at,
    runtime_config_ref: chainA[0].object_id,
    runtime_config_hash: chainA[0].determinism_hash,
    context_lineage_ref: LOCK.canonical_identity.active_lineage_ref,
    context_revision_ref: LOCK.canonical_identity.revision_id,
    created_at: receipt.available_to_runtime_at,
  }), /CAP05_ACTION_NON_EXECUTED_NOT_ELIGIBLE/);
  ok("withdrawn 200 mm point projection and ineligible execution semantics fail closed");

  console.log(`MCFT-CAP-05 S2 pure contracts: ${pass} PASS, 0 FAIL`);
}

main();
