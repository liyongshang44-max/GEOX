// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_FORECAST_RESIDUAL_OUTCOME_TICK.ts
// Purpose: prove one real T+1 CAP-04 outcome tick matches the exact observation to the historical post-receipt Forecast, commits one idempotent C Forecast Residual, and preserves separation from Assimilation Innovation and causal-effect claims.
// Boundary: in-memory acceptance only; no production database, route, scheduler, range, restart/backfill, Recommendation, AO-ACT, calibration, model activation or CAP-06 authority.

import assert from "node:assert/strict";
import {
  CAP05_FORECAST_POINT_MEMBER_REF_POLICY_ID_V1,
  CAP05_FORECAST_RESIDUAL_NORMALIZATION_BASIS_V1,
  validateCap05ForecastResidualV1,
} from "../../apps/server/src/domain/twin_runtime/forecast_observation_residual_v1.js";
import {
  selectHistoricalForecastForResidualV1,
  type Cap05HistoricalForecastResidualCandidateV1,
} from "../../apps/server/src/runtime/twin_runtime/historical_forecast_residual_selector_v1.js";
import { Cap05ForecastResidualOutcomeTickServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_residual_outcome_tick_service_v1.js";
import {
  CAP05_S8_OUTCOME_TIME_V1,
  InMemoryForecastResidualPersistenceV1,
  InMemoryHistoricalForecastSourceV1,
  buildCap05S8ForecastResidualFixtureV1,
  memberFromCap05S8TickV1,
} from "./mcft_cap_05_s8_forecast_residual_fixture_v1.js";

let pass = 0;
function ok(label: string): void {
  pass += 1;
  console.log(`PASS ${label}`);
}

async function main(): Promise<void> {
  const fixture = await buildCap05S8ForecastResidualFixtureV1();
  const first = await fixture.service.executeOneTickAndCommitResidual(fixture.input);
  validateCap05ForecastResidualV1(first.residual);
  const outcomeState = memberFromCap05S8TickV1(first.tick, "twin_state_estimate_v1");
  const outcomeAssimilation = memberFromCap05S8TickV1(first.tick, "twin_assimilation_update_v1");
  const outcomeForecast = memberFromCap05S8TickV1(first.tick, "twin_forecast_run_v1");

  assert.equal(first.tick.status, "INSERTED");
  assert.ok(first.tick.b_record);
  assert.equal(outcomeForecast.payload.status, "COMPLETED");
  assert.equal((outcomeForecast.payload.points as unknown[]).length, 72);
  ok("outcome path reuses the existing CAP-04 A1/B tick and emits a fresh 72-hour Forecast");

  assert.equal(first.residual_status, "INSERTED");
  assert.equal(first.residual.object_type, "twin_forecast_residual_v1");
  assert.equal(first.residual.payload.transaction_variant, "C_FORECAST_RESIDUAL_COMMIT");
  assert.equal(first.residual.payload.match_status, "MATCHED");
  ok("one independent C_FORECAST_RESIDUAL_COMMIT is appended after the successful outcome tick");

  assert.equal(first.residual.payload.forecast_run_ref, fixture.historical_forecast.object_id);
  assert.equal(first.residual.payload.forecast_run_hash, fixture.historical_forecast.determinism_hash);
  assert.equal(first.residual.payload.forecast_horizon_hour, 1);
  assert.equal(first.residual.payload.forecast_point_ref, `${fixture.historical_forecast.object_id}#/points/1`);
  assert.equal(first.residual.payload.forecast_point_member_ref_policy_id, CAP05_FORECAST_POINT_MEMBER_REF_POLICY_ID_V1);
  assert.equal(first.residual.payload.forecast_target_time, CAP05_S8_OUTCOME_TIME_V1);
  ok("historical source is exactly the post-receipt Forecast horizon-1 semantic member targeting the observation time");

  assert.deepEqual(first.forecast_selection_trace.source_posterior_action_feedback_refs, [fixture.action_feedback.object_id]);
  assert.equal(first.forecast_selection_trace.selected_forecast_ref, fixture.historical_forecast.object_id);
  assert.equal(first.forecast_selection_trace.observation_target_time, CAP05_S8_OUTCOME_TIME_V1);
  ok("selection trace proves the source posterior consumed canonical H Action Feedback");

  assert.equal(first.residual.payload.actual_observation_ref, fixture.observation_record.source_record_id);
  assert.equal(first.residual.payload.actual_observation_hash, fixture.observation_record.source_record_hash);
  assert.equal(first.residual.payload.actual_observation_observed_at, CAP05_S8_OUTCOME_TIME_V1);
  assert.equal(first.residual.payload.assimilation_update_ref, outcomeAssimilation.object_id);
  assert.equal(first.residual.payload.assimilation_update_hash, outcomeAssimilation.determinism_hash);
  ok("Residual and Assimilation share the exact selected observation and canonical Assimilation ref/hash");

  assert.equal(first.residual.payload.normalization_basis, CAP05_FORECAST_RESIDUAL_NORMALIZATION_BASIS_V1);
  assert.match(first.residual.payload.projection_input_hash, /^sha256:/);
  assert.match(first.residual.payload.projection_trace_hash, /^sha256:/);
  assert.ok(Number(first.residual.payload.total_residual_variance) > 0);
  assert.ok(Number.isFinite(Number(first.residual.payload.normalized_residual)));
  ok("projection hashes and positive Forecast-plus-observation variance normalization are canonical and finite");

  assert.equal(first.relation_trace.shared_observation, true);
  assert.equal(first.relation_trace.equivalence_claimed, false);
  assert.equal(first.relation_trace.causal_effect_claimed, false);
  assert.equal(first.residual.payload.equivalence_claimed, false);
  assert.ok(first.residual.limitations.includes("FORECAST_ERROR_NOT_ASSIMILATION_INNOVATION"));
  assert.ok(first.residual.limitations.includes("FORECAST_ERROR_NOT_CAUSAL_EFFECT"));
  ok("Forecast Residual remains explicitly distinct from Assimilation Innovation and causal effect");

  assert.equal(first.relation_trace.predictions_equal, false);
  assert.equal(first.relation_trace.residual_and_innovation_equal, false);
  assert.notEqual(first.relation_trace.historical_forecast_prediction, first.relation_trace.current_tick_propagated_prior_prediction);
  assert.notEqual(first.relation_trace.historical_forecast_residual, first.relation_trace.current_tick_assimilation_innovation);
  ok("controlled actual forcing makes historical Forecast error numerically distinct from current-tick innovation");

  assert.equal(outcomeState.logical_time, CAP05_S8_OUTCOME_TIME_V1);
  assert.equal(first.residual.logical_time, CAP05_S8_OUTCOME_TIME_V1);
  assert.equal(first.residual.context_lineage_ref, outcomeState.lineage_id);
  assert.equal(first.residual.context_revision_ref, outcomeState.revision_id);
  assert.equal(first.residual.runtime_config_ref, fixture.outcome_config.object_id);
  assert.equal(first.residual.runtime_config_hash, fixture.outcome_config.determinism_hash);
  ok("Residual scope, context, logical time and explicitly pinned Runtime Config match the outcome State");

  const factId = first.residual_fact_id;
  const replay = await fixture.service.executeOneTickAndCommitResidual(fixture.input);
  assert.equal(replay.tick.status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(replay.residual_status, "EXISTING_IDEMPOTENT_SUCCESS");
  assert.equal(replay.residual.object_id, first.residual.object_id);
  assert.equal(replay.residual.determinism_hash, first.residual.determinism_hash);
  assert.equal(replay.residual_fact_id, factId);
  assert.equal(fixture.residual_persistence.commit_count, 1);
  ok("completed A1/B plus C replay returns the exact existing residual with zero duplicate C write");

  const canonicalObservationValue = first.residual.payload.actual_observation_value;
  assert.equal(canonicalObservationValue, first.relation_trace.observation_value);
  assert.equal(canonicalObservationValue, Number(outcomeAssimilation.payload.actual_observation).toFixed(6));
  ok("actual observation value is identical across Residual, relation trace and Assimilation authority");

  const emptyHistoricalSource = new InMemoryHistoricalForecastSourceV1([]);
  const emptyService = new Cap05ForecastResidualOutcomeTickServiceV1(
    fixture.outcome_tick_service,
    fixture.runtime,
    emptyHistoricalSource,
    new InMemoryForecastResidualPersistenceV1(),
  );
  await assert.rejects(
    emptyService.executeOneTickAndCommitResidual(fixture.input),
    /CAP05_RESIDUAL_HISTORICAL_FORECAST_MATCH_NOT_FOUND/,
  );
  ok("missing historical Forecast match fails closed after idempotent outcome-tick readback");

  const noFeedbackCandidate: Cap05HistoricalForecastResidualCandidateV1 = {
    forecast: structuredClone(fixture.historical_forecast),
    source_posterior_action_feedback_refs: [],
  };
  const noFeedbackSource = new InMemoryHistoricalForecastSourceV1([noFeedbackCandidate]);
  const noFeedbackService = new Cap05ForecastResidualOutcomeTickServiceV1(
    fixture.outcome_tick_service,
    fixture.runtime,
    noFeedbackSource,
    new InMemoryForecastResidualPersistenceV1(),
  );
  await assert.rejects(
    noFeedbackService.executeOneTickAndCommitResidual(fixture.input),
    /CAP05_RESIDUAL_HISTORICAL_FORECAST_MATCH_NOT_FOUND/,
  );
  ok("Forecast whose source posterior lacks canonical H consumption is ineligible and fails closed");

  const equivalent = structuredClone(fixture.historical_forecast);
  equivalent.object_id = `${fixture.historical_forecast.object_id}_equivalent_tie`;
  equivalent.determinism_hash = "sha256:cap05-s8-equivalent-tie";
  const equivalentSelection = selectHistoricalForecastForResidualV1({
    scope: fixture.scope,
    lineage_id: String(fixture.historical_forecast.lineage_id),
    revision_id: String(fixture.historical_forecast.revision_id),
    observation_target_time: CAP05_S8_OUTCOME_TIME_V1,
    observation_available_to_runtime_at: CAP05_S8_OUTCOME_TIME_V1,
    candidates: [
      {
        forecast: equivalent,
        source_posterior_action_feedback_refs: [fixture.action_feedback.object_id],
      },
      {
        forecast: fixture.historical_forecast,
        source_posterior_action_feedback_refs: [fixture.action_feedback.object_id],
      },
    ],
  });
  assert.equal(
    equivalentSelection.forecast.object_id,
    [equivalent.object_id, fixture.historical_forecast.object_id].sort((left, right) => left.localeCompare(right))[0],
  );
  assert.equal(equivalentSelection.trace.tie_equivalent, true);
  ok("semantically equivalent latest-issued ties resolve by deterministic object_id order");

  const conflicting = structuredClone(fixture.historical_forecast);
  conflicting.object_id = `${fixture.historical_forecast.object_id}_conflicting_tie`;
  conflicting.determinism_hash = "sha256:cap05-s8-conflicting-tie";
  conflicting.runtime_config_ref = "runtime_config_conflicting_tie";
  assert.throws(() => selectHistoricalForecastForResidualV1({
    scope: fixture.scope,
    lineage_id: String(fixture.historical_forecast.lineage_id),
    revision_id: String(fixture.historical_forecast.revision_id),
    observation_target_time: CAP05_S8_OUTCOME_TIME_V1,
    observation_available_to_runtime_at: CAP05_S8_OUTCOME_TIME_V1,
    candidates: [
      {
        forecast: conflicting,
        source_posterior_action_feedback_refs: [fixture.action_feedback.object_id],
      },
      {
        forecast: fixture.historical_forecast,
        source_posterior_action_feedback_refs: [fixture.action_feedback.object_id],
      },
    ],
  }), /CAP05_RESIDUAL_LATEST_FORECAST_TIE_NOT_SEMANTICALLY_EQUIVALENT/);
  ok("non-equivalent latest-issued Forecast tie fails closed rather than selecting implicitly");

  assert.equal(pass, 13);
  console.log(`MCFT-CAP-05 S8 Forecast Residual outcome tick: ${pass} PASS / 0 FAIL`);
}

main();
