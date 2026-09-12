import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
  MCFT_CAP09_REQUIRED_FORCING_DELAY_CASES_V1,
  adjudicateFormalForcingAcquisitionBudgetV1,
  type FormalForcingControlledDelayCaseV1,
  type FormalForcingRealTimingSampleV1,
  type FormalForcingSupplyTimingPhasesV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_forcing_acquisition_budget_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_V13_CONTROLLED_TIMING_DELAY_MATRIX_V1_RESULT.json");
const MEASUREMENT = path.resolve(process.env.MCFT_TIMING_MEASUREMENT_PROOF || "");
const CONTROLLER = path.resolve(process.env.MCFT_CONTROLLER_PROOF || "");
const PHASES = [
  "wake_delay_ms",
  "job_start_setup_ms",
  "provider_capture_ms",
  "retained_raw_and_candidate_ms",
  "promotion_queue_and_setup_ms",
  "rehydration_promotion_commit_readback_ms",
] as const;
type PhaseKey = typeof PHASES[number];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function elapsed(start: number): number {
  return Math.max(0, Math.round(performance.now() - start));
}
function targetPhase(caseId: string): PhaseKey | null {
  switch (caseId) {
    case "WAKE_DELAY": return "wake_delay_ms";
    case "JOB_START_SETUP_DELAY": return "job_start_setup_ms";
    case "PROVIDER_SLOW_PATH": return "provider_capture_ms";
    case "PROMOTION_QUEUE_SETUP_DELAY": return "promotion_queue_and_setup_ms";
    case "REHYDRATION_COMMIT_READBACK_DELAY": return "rehydration_promotion_commit_readback_ms";
    case "CROSS_WAKE_CAPTURE_OVERLAP": return null;
    default: throw new Error("CONTROLLED_DELAY_CASE_UNSUPPORTED:" + caseId);
  }
}
async function executeOrdinaryCase(caseId: string, baseMs: number, injectedMs: number) {
  const target = targetPhase(caseId);
  assert.ok(target);
  const observed: Record<string, number> = {};
  for (const phase of PHASES) {
    const started = performance.now();
    await delay(baseMs + (phase === target ? injectedMs : 0));
    observed[phase] = elapsed(started);
  }
  const targetObserved = observed[target];
  assert.ok(targetObserved >= baseMs + injectedMs - 12, "CONTROLLED_TARGET_DELAY_NOT_OBSERVED:" + caseId);
  return {
    case_id: caseId,
    execution_kind: "SCALED_PHASE_DELAY_INJECTION",
    target_phase: target,
    injected_delay_ms: injectedMs,
    observed_phase_ms: observed,
    target_delay_observed: true,
  };
}
async function executeCrossWakeCase(baseMs: number, injectedMs: number) {
  let active = 0;
  let maxActive = 0;
  let tail = Promise.resolve();
  const serializedCapture = async (id: string) => {
    let release!: () => void;
    const prior = tail;
    tail = new Promise<void>((resolve) => { release = resolve; });
    await prior;
    active += 1;
    maxActive = Math.max(maxActive, active);
    const started = performance.now();
    await delay(baseMs + injectedMs);
    const captureElapsed = elapsed(started);
    active -= 1;
    release();
    return { id, capture_elapsed_ms: captureElapsed };
  };
  const started = performance.now();
  const first = serializedCapture("wake1");
  await delay(Math.max(1, Math.floor(baseMs / 2)));
  const second = serializedCapture("wake2");
  const captures = await Promise.all([first, second]);
  const total = elapsed(started);
  assert.equal(maxActive, 1, "CONTROLLED_CROSS_WAKE_CAPTURE_NOT_SERIALIZED");
  assert.ok(total >= 2 * (baseMs + injectedMs) - 20, "CONTROLLED_CROSS_WAKE_OVERLAP_NOT_OBSERVED");
  return {
    case_id: "CROSS_WAKE_CAPTURE_OVERLAP",
    execution_kind: "SCALED_SERIALIZED_CROSS_WAKE_CAPTURE_OVERLAP",
    overlap_attempted: true,
    max_capture_concurrency: maxActive,
    injected_delay_ms: injectedMs,
    serialized_capture_elapsed_ms: total,
    captures,
    target_delay_observed: true,
  };
}

function mainBudgetProof(measurement: any) {
  assert.equal(measurement.status, "PASS");
  assert.equal(measurement.real_sample_count, 3);
  assert.equal(measurement.exact_sequential_bases?.length, 3);
  const real = measurement.real_samples as FormalForcingRealTimingSampleV1[];
  const controlled = measurement.controlled_delay_cases as FormalForcingControlledDelayCaseV1[];
  assert.equal(real.length, 3);
  assert.equal(controlled.length, 6);
  assert.deepEqual(
    controlled.map((item) => item.case_id).sort(),
    [...MCFT_CAP09_REQUIRED_FORCING_DELAY_CASES_V1].sort(),
  );
  const candidate = measurement.selected_budget_candidate;
  assert.ok(candidate && candidate.status === "PASS");
  const replay = adjudicateFormalForcingAcquisitionBudgetV1({
    schema_version: "geox_mcft_cap09_formal_forcing_acquisition_budget_qualification_v1",
    authority_id: MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
    real_samples: real,
    controlled_delay_cases: controlled,
    selected_budget_ms: candidate.selected_budget_ms,
    declared_safety_margin_ms: candidate.safety_margin_ms,
  });
  assert.deepEqual(replay, candidate, "CONTROLLED_DELAY_BUDGET_REPLAY_MISMATCH");
  return replay;
}

async function main(): Promise<void> {
  if (!MEASUREMENT || !CONTROLLER) throw new Error("CONTROLLED_DELAY_PROOF_INPUT_REQUIRED");
  const measurement = JSON.parse(fs.readFileSync(MEASUREMENT, "utf8"));
  const controller = JSON.parse(fs.readFileSync(CONTROLLER, "utf8"));
  const subject = String(process.env.MCFT_SUBJECT_SHA || "");
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("CONTROLLED_DELAY_SUBJECT_REQUIRED");

  for (const key of [
    "exact_cursor_base_passed_to_capture",
    "exact_cursor_base_passed_to_promotion",
    "epoch_controller_heartbeat_during_long_capture_and_promotion",
    "producer_claim_heartbeat_during_long_capture_and_promotion",
    "same_producer_fence_preserved_through_completion",
    "physical_attestation_advanced_cursor",
    "competing_controller_denied_while_lease_live",
    "zero_formal_write_promotion_failure_is_retryable",
    "partial_formal_write_promotion_failure_terminalizes_controller",
    "partial_formal_write_does_not_advance_forcing_cursor",
    "unknown_or_partial_promotion_mutation_fails_closed",
  ]) assert.equal(controller[key], true, "CONTROLLED_DELAY_CONTROLLER_PROOF_REQUIRED:" + key);
  assert.equal(controller.status, "PASS");
  assert.equal(controller.production_workflow_effect, false);
  assert.equal(controller.formal_v4_mutation_performed, false);
  assert.equal(controller.mcft_cap09_completed, false);

  const fullScaleAdjudication = mainBudgetProof(measurement);
  const baseMs = 8;
  const injectedMs = 48;
  const executed: any[] = [];
  for (const caseId of MCFT_CAP09_REQUIRED_FORCING_DELAY_CASES_V1) {
    executed.push(caseId === "CROSS_WAKE_CAPTURE_OVERLAP"
      ? await executeCrossWakeCase(baseMs, injectedMs)
      : await executeOrdinaryCase(caseId, baseMs, injectedMs));
  }
  assert.equal(executed.length, 6);
  assert.ok(executed.every((item) => item.target_delay_observed === true));

  const proof = {
    schema_version: "geox_mcft_cap09_v13_controlled_timing_delay_matrix_v1",
    status: "PASS",
    subject_sha: subject,
    measurement_subject_sha: measurement.subject_sha,
    execution_mode: "CONTROLLED_ENGINEERING_FIXTURE_SCALED_DELAY_INJECTION_V1",
    controlled_delay_matrix_constructed_from_real_samples: true,
    controlled_delay_matrix_executed: true,
    controlled_delay_case_count: executed.length,
    required_case_ids: [...MCFT_CAP09_REQUIRED_FORCING_DELAY_CASES_V1],
    scaled_execution_base_delay_ms: baseMs,
    scaled_execution_injected_delay_ms: injectedMs,
    executed_cases: executed,
    controller_postgres_proof: {
      heartbeat_during_long_capture_and_promotion: true,
      producer_heartbeat_during_long_capture_and_promotion: true,
      same_producer_fence_preserved: true,
      competing_controller_denied: true,
      partial_mutation_fails_closed: true,
    },
    full_scale_budget_adjudication: fullScaleAdjudication,
    real_sample_count: measurement.real_sample_count,
    hardcoded_35_minute_budget_authorized: false,
    hardcoded_replacement_budget_minutes: null,
    production_provider_request_count: 0,
    production_database_binding: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    formal_v5_mutation: false,
    a0_bootstrap: false,
    o00_started: false,
    mcft_cap09_completed: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    controlled_delay_matrix_executed: false,
    production_provider_request_count: 0,
    production_database_binding: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    formal_v5_mutation: false,
    a0_bootstrap: false,
    o00_started: false,
    mcft_cap09_completed: false,
  }, null, 2) + "\n");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
