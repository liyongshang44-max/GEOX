// Purpose: aggregate three exact-main real-path collector timings and three
// exact-main DB-only observer timings into one metadata-only qualification proof.
// This is engineering readiness evidence only and cannot change provider,
// crop, season, Formal, or activation authority.

import fs from "node:fs";

const OUTPUT_DIR = "acceptance-output";
const TRIAL_COUNT = 3;
const COLLECTOR_BUDGET_MS = 25 * 60_000;
const OBSERVER_BUDGET_MS = 5 * 60_000;
const SAFETY_FACTOR = 2;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function read(path: string): Record<string, unknown> {
  return record(JSON.parse(fs.readFileSync(path, "utf8")), `EA5E2_TIMING_QUALIFICATION_JSON_REQUIRED:${path}`);
}

function number(value: unknown, code: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(code);
  return parsed;
}

function nearestRank95(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1]!;
}

function assertExactMainDispatch(subject: string): void {
  if (!/^[0-9a-f]{40}$/.test(subject)
      || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch"
      || process.env.GITHUB_REF !== "refs/heads/main"
      || process.env.GITHUB_SHA !== subject) {
    throw new Error("EA5E2_TIMING_QUALIFICATION_EXACT_MAIN_WORKFLOW_DISPATCH_REQUIRED");
  }
}

function main(): void {
  const subject = required("MCFT_EA5E2_SUBJECT_SHA");
  assertExactMainDispatch(subject);
  const collector: Record<string, unknown>[] = [];
  const observer: Record<string, unknown>[] = [];
  for (let trial = 1; trial <= TRIAL_COUNT; trial += 1) {
    const late = read(`${OUTPUT_DIR}/MCFT_CAP_09_EA5E2_LATE_TIMING_TRIAL_${trial}.json`);
    const observed = read(`${OUTPUT_DIR}/MCFT_CAP_09_EA5E2_OBSERVER_TIMING_TRIAL_${trial}.json`);
    if (late.status !== "PASS" || late.subject_sha !== subject || late.trial !== trial
        || late.same_source_exact_t_required !== true || late.production_freshness_reproved_by_decoder !== true
        || late.canonical_record_count !== 2 || late.canonical_fact_write_count !== 2
        || late.transient_cleanup_confirmed !== true || late.formal_database_write_count !== 0
        || late.formal_r2_write_count !== 0 || late.authority_effect !== false
        || late.live_dispatch_authorized !== false || late.raw_values_emitted !== false) {
      throw new Error(`EA5E2_COLLECTOR_TIMING_TRIAL_CONTRACT_FAILED:${trial}`);
    }
    if (observed.status !== "PASS" || observed.subject_sha !== subject
        || observed.timing_qualification_only !== true
        || observed.scheduling_clock_bypassed_for_historical_fixture !== true
        || observed.db_only_runtime !== true || observed.provider_request_count !== 0
        || observed.selected_record_count !== 5 || observed.forecast_status !== "COMPLETED"
        || observed.forecast_point_count !== 72 || observed.formal_database_write_count !== 0
        || observed.scheduler_slot_count !== 0 || observed.scheduler_cursor_count !== 0
        || observed.authority_effect !== false || observed.live_dispatch_authorized !== false
        || observed.raw_values_emitted !== false) {
      throw new Error(`EA5E2_OBSERVER_TIMING_TRIAL_CONTRACT_FAILED:${trial}`);
    }
    collector.push(late);
    observer.push(observed);
  }
  const collectorElapsed = collector.map((item, index) => number(item.collection_to_ingress_completion_elapsed_ms, `EA5E2_COLLECTOR_TIMING_ELAPSED_INVALID:${index + 1}`));
  const observerElapsed = observer.map((item, index) => number(item.observer_execution_elapsed_ms, `EA5E2_OBSERVER_TIMING_ELAPSED_INVALID:${index + 1}`));
  const collectorMax = Math.max(...collectorElapsed);
  const observerMax = Math.max(...observerElapsed);
  const collectorP95 = nearestRank95(collectorElapsed);
  const observerP95 = nearestRank95(observerElapsed);
  if (collectorMax * SAFETY_FACTOR > COLLECTOR_BUDGET_MS || collectorP95 * SAFETY_FACTOR > COLLECTOR_BUDGET_MS) {
    throw new Error(`EA5E2_COLLECTOR_TIMING_BUDGET_NOT_QUALIFIED:${collectorMax}:${collectorP95}`);
  }
  if (observerMax * SAFETY_FACTOR > OBSERVER_BUDGET_MS || observerP95 * SAFETY_FACTOR > OBSERVER_BUDGET_MS) {
    throw new Error(`EA5E2_OBSERVER_TIMING_BUDGET_NOT_QUALIFIED:${observerMax}:${observerP95}`);
  }
  const proof = {
    schema_version: "geox_mcft_cap09_ea5e2_timing_budget_qualification_v1",
    status: "PASS",
    subject_sha: subject,
    exact_main_workflow_dispatch: true,
    trial_count: TRIAL_COUNT,
    safety_factor: SAFETY_FACTOR,
    collector: {
      path: "REAL_KBS_GET_PRIVATE_R2_RETAIN_DECODE_ET0_CANONICALIZE_ISOLATED_DB_INGRESS",
      elapsed_ms: collectorElapsed,
      p95_elapsed_ms: collectorP95,
      max_elapsed_ms: collectorMax,
      qualified_budget_ms: COLLECTOR_BUDGET_MS,
      safety_adjusted_max_elapsed_ms: collectorMax * SAFETY_FACTOR,
      status: "QUALIFIED",
    },
    observer: {
      path: "FORMAL_A0_READ_ONLY_PLUS_ISOLATED_DB_EXACT_FIVE_PLUS_REAL_EXTERNAL_CAP04_A1_72",
      elapsed_ms: observerElapsed,
      p95_elapsed_ms: observerP95,
      max_elapsed_ms: observerMax,
      qualified_budget_ms: OBSERVER_BUDGET_MS,
      safety_adjusted_max_elapsed_ms: observerMax * SAFETY_FACTOR,
      status: "QUALIFIED",
    },
    frozen_authority_changed: false,
    provider_authority_changed: false,
    crop_or_season_authority_changed: false,
    formal_database_write_count: 0,
    formal_r2_write_count: 0,
    scheduler_write_count: 0,
    live_dispatch_authorized: false,
    raw_values_emitted: false,
  };
  fs.writeFileSync(`${OUTPUT_DIR}/MCFT_CAP_09_EA5E2_TIMING_BUDGET_QUALIFICATION.json`, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof));
}

main();
