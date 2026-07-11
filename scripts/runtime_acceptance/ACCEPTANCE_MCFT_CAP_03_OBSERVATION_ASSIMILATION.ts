// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_03_OBSERVATION_ASSIMILATION.ts
// Purpose: prove deterministic CAP-03 observation selection, duplicate handling, evidence traces, Gaussian update, quality downweighting, exact outlier boundary, clipping, and no-observation semantics.
// Boundary: pure in-memory acceptance only; no database, persistence, Runtime tick, route, scheduler, or production claim.

import { composeAssimilatedContinuationPosteriorV1 } from "../../apps/server/src/domain/soil_water/assimilated_continuation_posterior_v1.js";
import {
  buildAssimilatedContinuationEvidenceWindowV1,
  finalizeAssimilatedContinuationEvidenceWindowV1,
} from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v1.js";
import { buildContinuationEvidenceWindowV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";
import { selectAssimilatedContinuationObservationV1 } from "../../apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v1.js";
import { buildMcftCap03ObservationAssimilationFixtureV1 } from "./mcft_cap_03_observation_assimilation_fixture_v1.js";

let pass = 0;
let fail = 0;

function check(value: unknown, message: string): void {
  if (value) {
    pass += 1;
    console.log(`PASS ${message}`);
  } else {
    fail += 1;
    console.error(`FAIL ${message}`);
  }
}

function nearlyEqualV1(left: number | null, right: number, tolerance = 1e-12): boolean {
  return left !== null && Math.abs(left - right) <= tolerance;
}

async function mainV1(): Promise<void> {
  const fixture = await buildMcftCap03ObservationAssimilationFixtureV1();
  const logicalTime = fixture.cap02.evidenceFixture.logical_time;
  const commonMath = {
    prior_mean: 0.2,
    prior_variance: 0.01,
    saturation_fraction: 0.5,
    root_zone_depth_mm: 300,
    sensor_measurement_stddev_fraction: 0.02,
    point_to_zone_representativeness_stddev_fraction: 0.06,
    quality_weights: { PASS: 1, LIMITED: 0.5, FAIL: 0 } as const,
  };

  const older = fixture.makeObservation({
    source_record_id: "obs_older",
    observed_at: "2026-06-01T01:50:00.000Z",
    ingested_at: "2026-06-01T01:51:00.000Z",
    value: 0.22,
  });
  const duplicateEarlier = fixture.makeObservation({
    source_record_id: "obs_latest_duplicate_earlier",
    observed_at: "2026-06-01T01:55:00.000Z",
    ingested_at: "2026-06-01T01:56:00.000Z",
    value: 0.23,
  });
  const duplicateWinner = fixture.makeObservation({
    source_record_id: "obs_latest_duplicate_winner",
    observed_at: "2026-06-01T01:55:00.000Z",
    ingested_at: "2026-06-01T01:57:00.000Z",
    value: 0.23,
  });

  const selectionA = selectAssimilatedContinuationObservationV1({
    scope: fixture.cap02.scope,
    logical_time: logicalTime,
    saturation_fraction: 0.5,
    observation_records: [older, duplicateEarlier, duplicateWinner],
  });
  const selectionB = selectAssimilatedContinuationObservationV1({
    scope: fixture.cap02.scope,
    logical_time: logicalTime,
    saturation_fraction: 0.5,
    observation_records: [duplicateWinner, older, duplicateEarlier],
  });
  check(selectionA.semantic_digest === selectionB.semantic_digest, "candidate input order does not change selector semantic digest");
  check(selectionA.selected_observation_ref === "obs_latest_duplicate_winner", "latest identical duplicate winner follows ingested DESC then source_record_id ASC");
  check(selectionA.candidates.find((candidate) => candidate.source_record_id === "obs_latest_duplicate_earlier")?.candidate_assessment === "IDENTICAL_DUPLICATE_SUPPRESSED", "identical duplicate is suppressed with an explicit assessment");
  check(selectionA.candidates.find((candidate) => candidate.source_record_id === "obs_older")?.candidate_assessment === "NOT_SELECTED_OLDER_USABLE", "older usable observation remains traceable but is not selected");

  const passResult = composeAssimilatedContinuationPosteriorV1({
    ...commonMath,
    selected_observation: selectionA.selected_observation,
  });
  check(passResult.status === "APPLIED" && passResult.disposition === "ACCEPTED", "PASS observation produces APPLIED / ACCEPTED");
  check(passResult.innovation === passResult.residual && passResult.residual_kind === "STATE_OBSERVATION_INNOVATION", "innovation and residual remain numerically identical with the frozen residual kind");
  check(passResult.published_posterior_mean > 0.2 && passResult.published_posterior_mean < 0.23, "Gaussian posterior moves toward but does not equal the observation");
  check(passResult.published_posterior_variance < 0.01, "accepted observation reduces posterior variance");
  check(passResult.clipping.physical_clipping_reduces_latent_variance === false, "physical clipping policy never silently reduces latent posterior variance");
  check(!/[eE]/.test(passResult.canonical_decimal_basis.posterior_vwc_decimal.value), "canonical posterior decimals never use scientific notation");

  const limitedSelection = selectAssimilatedContinuationObservationV1({
    scope: fixture.cap02.scope,
    logical_time: logicalTime,
    saturation_fraction: 0.5,
    observation_records: [fixture.makeObservation({ source_record_id: "obs_limited", value: 0.23, quality_status: "LIMITED" })],
  });
  const limitedResult = composeAssimilatedContinuationPosteriorV1({
    ...commonMath,
    selected_observation: limitedSelection.selected_observation,
  });
  check(limitedResult.status === "APPLIED" && limitedResult.disposition === "DOWNWEIGHTED", "LIMITED observation produces APPLIED / DOWNWEIGHTED");
  check(nearlyEqualV1(limitedResult.observation_variance, 0.008), "LIMITED quality doubles effective observation variance from 0.004 to 0.008");
  check((limitedResult.applied_assimilation_gain ?? 0) < (passResult.applied_assimilation_gain ?? 0), "LIMITED quality has a smaller applied gain than the same PASS case");

  const boundarySelection = selectAssimilatedContinuationObservationV1({
    scope: fixture.cap02.scope,
    logical_time: logicalTime,
    saturation_fraction: 0.5,
    observation_records: [fixture.makeObservation({ source_record_id: "obs_threshold_boundary", value: 0.4 })],
  });
  const boundaryResult = composeAssimilatedContinuationPosteriorV1({
    ...commonMath,
    prior_mean: 0.1,
    prior_variance: 0.001625,
    selected_observation: boundarySelection.selected_observation,
  });
  check(boundaryResult.status === "APPLIED" && boundaryResult.disposition === "ACCEPTED", "direct innovation squared equal to 16 times innovation variance is accepted inclusively");
  check(nearlyEqualV1(boundaryResult.squared_normalized_innovation, 16, 1e-10), "reported squared normalized innovation remains an audit trace at the exact threshold");

  const outlierSelection = selectAssimilatedContinuationObservationV1({
    scope: fixture.cap02.scope,
    logical_time: logicalTime,
    saturation_fraction: 0.5,
    observation_records: [fixture.makeObservation({ source_record_id: "obs_outlier", value: 0.48 })],
  });
  const outlierResult = composeAssimilatedContinuationPosteriorV1({
    ...commonMath,
    prior_mean: 0.1,
    prior_variance: 0.0001,
    selected_observation: outlierSelection.selected_observation,
  });
  check(outlierResult.status === "NOT_APPLIED" && outlierResult.disposition === "REJECTED_OUTLIER", "squared innovation above 16 is rejected without applying a posterior candidate");
  check(outlierResult.candidate_assimilation_gain !== null && outlierResult.applied_assimilation_gain === null, "outlier retains candidate gain for audit but no applied gain");
  check(outlierResult.candidate_unclipped_posterior_mean === null && outlierResult.candidate_posterior_variance === null, "outlier gate runs before Gaussian posterior candidate publication");
  check(outlierResult.published_posterior_mean === 0.1 && outlierResult.state_correction_vwc === 0, "outlier publishes the unchanged propagated prior");

  const noObservation = composeAssimilatedContinuationPosteriorV1({
    ...commonMath,
    selected_observation: null,
  });
  check(noObservation.status === "NOT_APPLIED" && noObservation.disposition === "NO_USABLE_OBSERVATION", "missing usable observation is a legal NOT_APPLIED state update");
  check(noObservation.predicted_observation === null && noObservation.applied_observation_refs.length === 0, "no-observation case publishes no synthetic innovation or consumption trace");

  const baseRecords = [...fixture.cap02.evidenceFixture.candidate_records, older, duplicateEarlier, duplicateWinner];
  const baseWindow = buildContinuationEvidenceWindowV1({
    scope: fixture.cap02.scope,
    logical_time: logicalTime,
    candidate_records: baseRecords,
    crop_stage_context_ref: fixture.cap02.evidenceFixture.crop_stage_context_ref,
    crop_stage_context_hash: fixture.cap02.evidenceFixture.crop_stage_context_hash,
    crop_stage_context: fixture.cap02.cropStageContext,
  });
  const assimilatedWindow = buildAssimilatedContinuationEvidenceWindowV1({
    scope: fixture.cap02.scope,
    logical_time: logicalTime,
    candidate_records: baseRecords,
    observation_candidate_records: [older, duplicateEarlier, duplicateWinner],
    saturation_fraction: 0.5,
    crop_stage_context_ref: fixture.cap02.evidenceFixture.crop_stage_context_ref,
    crop_stage_context_hash: fixture.cap02.evidenceFixture.crop_stage_context_hash,
    crop_stage_context: fixture.cap02.cropStageContext,
  });
  check(assimilatedWindow.base_continuation_window.semantic_digest === baseWindow.semantic_digest, "CAP-03 wrapper preserves immutable CAP-02 Evidence Window output");
  const finalizedWindow = finalizeAssimilatedContinuationEvidenceWindowV1({ window: assimilatedWindow, assimilation: passResult });
  check(finalizedWindow.assimilation_applied_evidence_refs[0] === "obs_latest_duplicate_winner", "Evidence Window records the applied observation separately from dynamics Evidence");
  check(finalizedWindow.consumed_evidence_refs.includes("obs_latest_duplicate_winner"), "compatibility consumed refs are the unique union of dynamics and applied assimilation refs");

  console.log(`MCFT-CAP-03 observation-assimilation: ${pass} PASS, ${fail} FAIL`);
  if (fail) process.exitCode = 1;
}

void mainV1().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
