import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
  adjudicateFormalForcingAcquisitionBudgetV1,
  totalFormalForcingSupplyTimingMsV1,
  type FormalForcingRealTimingSampleV1,
  type FormalForcingControlledDelayCaseV1,
  type FormalForcingSupplyTimingPhasesV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_forcing_acquisition_budget_v1.js";

const SAMPLE_DIR = path.resolve(process.env.MCFT_TIMING_SAMPLE_DIR || "timing-samples");
const OUT = path.resolve("acceptance-output/MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V1_RESULT.json");
const PHASE_KEYS = [
  "wake_delay_ms",
  "job_start_setup_ms",
  "provider_capture_ms",
  "retained_raw_and_candidate_ms",
  "promotion_queue_and_setup_ms",
  "rehydration_promotion_commit_readback_ms",
] as const;

function required(name: string): string {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error("V13_TIMING_AGGREGATE_ENV_REQUIRED:" + name);
  return value;
}
function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 3_600_000).toISOString();
}
function clonePhases(value: FormalForcingSupplyTimingPhasesV1): FormalForcingSupplyTimingPhasesV1 {
  return { ...value };
}
function addPhase(
  value: FormalForcingSupplyTimingPhasesV1,
  key: keyof FormalForcingSupplyTimingPhasesV1,
  amount: number,
): FormalForcingSupplyTimingPhasesV1 {
  const next = clonePhases(value);
  next[key] += amount;
  return next;
}

function main(): void {
  const subject = required("MCFT_SUBJECT_SHA");
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("V13_TIMING_AGGREGATE_SUBJECT_INVALID");
  const files = fs.readdirSync(SAMPLE_DIR)
    .filter((name) => /^MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE[123]_V1_RESULT\.json$/.test(name))
    .sort();
  assert.equal(files.length, 3, "V13_TIMING_AGGREGATE_EXACT_THREE_SAMPLE_FILES_REQUIRED");

  const rows = files.map((name) => JSON.parse(fs.readFileSync(path.join(SAMPLE_DIR, name), "utf8")));
  const ids = rows.map((row) => row.sample_id).sort();
  assert.deepEqual(ids, ["sample1", "sample2", "sample3"], "V13_TIMING_AGGREGATE_SAMPLE_ID_SET_MISMATCH");
  for (const row of rows) {
    assert.equal(row.status, "PASS", "V13_TIMING_AGGREGATE_SAMPLE_PASS_REQUIRED");
    assert.equal(row.subject_sha, subject, "V13_TIMING_AGGREGATE_EXACT_HEAD_REQUIRED");
    assert.equal(row.measurement_only, true, "V13_TIMING_AGGREGATE_MEASUREMENT_ONLY_REQUIRED");
    assert.equal(row.timing_budget_qualified, false, "V13_TIMING_AGGREGATE_PRE_FREEZE_REQUIRED");
    assert.equal(row.timing_budget_frozen, false, "V13_TIMING_AGGREGATE_PRE_FREEZE_REQUIRED");
    assert.equal(row.production_canonical_modules_reused, true, "V13_TIMING_AGGREGATE_PRODUCTION_MODULE_REUSE_REQUIRED");
    assert.equal(row.provider_refetch_during_promotion, 0, "V13_TIMING_AGGREGATE_PROMOTION_REFETCH_FORBIDDEN");
    assert.equal(row.formal_fact_present_count, 3, "V13_TIMING_AGGREGATE_EXACT_THREE_FACTS_REQUIRED");
    for (const key of ["production_owner_activation","formal_v5_arm","a0_bootstrap","o00_started","mcft_cap09_completed"]) {
      assert.equal(row[key], false, "V13_TIMING_AGGREGATE_LATER_STAGE_EFFECT_FORBIDDEN:" + key);
    }
  }

  const byId = new Map(rows.map((row) => [row.sample_id, row]));
  const bases = ["sample1","sample2","sample3"].map((id) => String(byId.get(id)?.base_target_t ?? ""));
  assert.equal(bases[1], addHours(bases[0]!, 1), "V13_TIMING_AGGREGATE_BASE2_NOT_SEQUENTIAL");
  assert.equal(bases[2], addHours(bases[0]!, 2), "V13_TIMING_AGGREGATE_BASE3_NOT_SEQUENTIAL");

  const realSamples: FormalForcingRealTimingSampleV1[] = ["sample1","sample2","sample3"].map((id) => {
    const phases = byId.get(id)?.timing_phases as FormalForcingSupplyTimingPhasesV1;
    return { sample_id: id, ...phases };
  });
  const baseline = Object.fromEntries(PHASE_KEYS.map((key) => [
    key,
    Math.max(...realSamples.map((sample) => sample[key])),
  ])) as FormalForcingSupplyTimingPhasesV1;

  const controlledCases: FormalForcingControlledDelayCaseV1[] = [
    { case_id: "WAKE_DELAY", ...addPhase(baseline, "wake_delay_ms", baseline.wake_delay_ms) },
    { case_id: "JOB_START_SETUP_DELAY", ...addPhase(baseline, "job_start_setup_ms", baseline.job_start_setup_ms) },
    { case_id: "PROVIDER_SLOW_PATH", ...addPhase(baseline, "provider_capture_ms", baseline.provider_capture_ms) },
    { case_id: "PROMOTION_QUEUE_SETUP_DELAY", ...addPhase(baseline, "promotion_queue_and_setup_ms", baseline.promotion_queue_and_setup_ms) },
    { case_id: "REHYDRATION_COMMIT_READBACK_DELAY", ...addPhase(baseline, "rehydration_promotion_commit_readback_ms", baseline.rehydration_promotion_commit_readback_ms) },
    {
      case_id: "CROSS_WAKE_CAPTURE_OVERLAP",
      ...addPhase(
        addPhase(baseline, "provider_capture_ms", baseline.provider_capture_ms),
        "retained_raw_and_candidate_ms",
        baseline.retained_raw_and_candidate_ms,
      ),
    },
  ];

  const realTotals = realSamples.map(totalFormalForcingSupplyTimingMsV1);
  const controlledTotals = controlledCases.map(totalFormalForcingSupplyTimingMsV1);
  const maximumReal = Math.max(...realTotals);
  const minimumReal = Math.min(...realTotals);
  const maximumControlled = Math.max(...controlledTotals);
  const envelope = Math.max(maximumReal, maximumControlled);
  const observedSpread = maximumReal - minimumReal;
  const platformWakeSetupReserve = baseline.wake_delay_ms + baseline.job_start_setup_ms;
  const safetyMargin = Math.max(observedSpread, platformWakeSetupReserve);
  if (!Number.isSafeInteger(safetyMargin) || safetyMargin <= 0) {
    throw new Error("V13_TIMING_AGGREGATE_POSITIVE_MEASURED_SAFETY_MARGIN_REQUIRED");
  }
  const selectedBudget = envelope + safetyMargin;

  const adjudication = adjudicateFormalForcingAcquisitionBudgetV1({
    schema_version: "geox_mcft_cap09_formal_forcing_acquisition_budget_qualification_v1",
    authority_id: MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
    real_samples: realSamples,
    controlled_delay_cases: controlledCases,
    selected_budget_ms: selectedBudget,
    declared_safety_margin_ms: safetyMargin,
  });
  assert.equal(adjudication.status, "PASS");

  const proof = {
    schema_version: "geox_mcft_cap09_v13_exact_head_timing_measurement_v1",
    status: "PASS",
    subject_sha: subject,
    measurement_stage: "EXACT_HEAD_REAL_TIMING_MEASUREMENT",
    timing_budget_qualified: false,
    timing_budget_frozen: false,
    authority_freeze_requires_separate_successor_commit: true,
    real_sample_count: realSamples.length,
    exact_sequential_bases: bases,
    real_samples: realSamples,
    componentwise_real_maxima: baseline,
    controlled_delay_matrix_constructed: true,\n    controlled_delay_matrix_executed: false,
    controlled_delay_policy_id: "OBSERVED_COMPONENT_MAX_PLUS_ONE_EXTRA_OBSERVED_TARGET_PHASE_V1",
    cross_wake_capture_overlap_model: "ONE_ADDITIONAL_FULL_CAPTURE_WORKLOAD_SERIALIZED_ON_COMPONENTWISE_REAL_MAXIMA",
    controlled_delay_cases: controlledCases,
    safety_margin_policy_id: "MAX_REAL_END_TO_END_SPREAD_OR_COMPONENTWISE_WAKE_PLUS_SETUP_V1",
    observed_real_end_to_end_spread_ms: observedSpread,
    componentwise_wake_plus_setup_reserve_ms: platformWakeSetupReserve,
    selected_budget_candidate: adjudication,
    hardcoded_35_minute_budget_authorized: false,
    hardcoded_replacement_budget_minutes: null,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
    mcft_cap09_completed: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
}

try {
  main();
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    timing_budget_qualified: false,
    timing_budget_frozen: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
    mcft_cap09_completed: false,
  }, null, 2) + "\n");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
}
