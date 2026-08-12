#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const BASE = "e1d9b6a160e7d8c897c010cfb6efe420119cbb87";
const RUNNER = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_PHASE_PRIVATE_TRANSIENT_R2.ts";
const SELECTOR = "apps/server/src/runtime/twin_runtime/assimilated_continuation_observation_selector_v2.ts";
const AUTHORITY = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-OPERATIONAL-ACTIVATION-RUNNER-QUALIFICATION-V1.json";
const GATE = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_SOIL_WINDOW_CONFORMANCE.cjs";
const WORKFLOW = ".github/workflows/mcft-cap-09-ea5e2-soil-window-conformance.yml";

function git(...args) { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function read(path) { return fs.readFileSync(path, "utf8"); }
function has(text, marker, code) { if (!text.includes(marker)) throw new Error(`${code}:${marker}`); }
function lacks(text, marker, code) { if (text.includes(marker)) throw new Error(`${code}:${marker}`); }
function eq(actual, expected, code) { if (actual !== expected) throw new Error(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`); }

function main() {
  const subject = git("rev-parse", "HEAD");
  const changed = git("diff", "--name-only", `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  eq(JSON.stringify(changed), JSON.stringify([RUNNER, GATE, WORKFLOW].sort()), "EA5E2_SOIL_WINDOW_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

  const runner = read(RUNNER);
  const selector = read(SELECTOR);
  const authority = JSON.parse(read(AUTHORITY));

  has(selector, 'ASSIMILATED_OBSERVATION_SELECTOR_ID_V2 =\n  "LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V2"', "EA5E2_SOIL_WINDOW_SELECTOR_ID_FROZEN");
  has(selector, "ASSIMILATED_OBSERVATION_MAX_AGE_MILLISECONDS_V2 = 900_000", "EA5E2_SOIL_WINDOW_15M_MAX_AGE_FROZEN");
  has(selector, "ageMilliseconds > ASSIMILATED_OBSERVATION_MAX_AGE_MILLISECONDS_V2", "EA5E2_SOIL_WINDOW_EXACT_15M_MUST_REMAIN_USABLE");

  eq(authority.provider_and_clock_contract.minimum_ingestion_margin_minutes, 5, "EA5E2_SOIL_WINDOW_INGESTION_MARGIN_FROZEN");
  eq(authority.provider_and_clock_contract.pre_boundary_collector_offset_minutes, -30, "EA5E2_SOIL_WINDOW_PRE_BOUNDARY_OFFSET_FROZEN");
  eq(authority.provider_and_clock_contract.kbs_raw_hourly_max_age_hours, 6, "EA5E2_SOIL_WINDOW_KBS_RAW_HOURLY_FRESHNESS_FROZEN");
  eq(authority.provider_and_clock_contract.source_substitution_authorized, false, "EA5E2_SOIL_WINDOW_SOURCE_SUBSTITUTION_FORBIDDEN");
  eq(authority.provider_and_clock_contract.time_relabeling_authorized, false, "EA5E2_SOIL_WINDOW_TIME_RELABELING_FORBIDDEN");

  has(runner, "const MIN_INGRESS_MARGIN_MINUTES = 5;", "EA5E2_SOIL_WINDOW_RUNNER_MARGIN_REQUIRED");
  has(runner, "const SOIL_WINDOW_MINUTES = 15;", "EA5E2_SOIL_WINDOW_RUNNER_15M_REQUIRED");
  has(runner, "const SOIL_FIRST_FETCH_BEFORE_T_MINUTES = 15;", "EA5E2_SOIL_WINDOW_POLL_FROM_WINDOW_OPEN_REQUIRED");
  has(runner, "await sleepUntil(addMinutes(target, -SOIL_FIRST_FETCH_BEFORE_T_MINUTES));", "EA5E2_SOIL_WINDOW_POLL_CLOCK_REQUIRED");
  has(runner, "const soilWindowStart = Date.parse(addMinutes(target, -SOIL_WINDOW_MINUTES));", "EA5E2_SOIL_WINDOW_LOWER_BOUND_REQUIRED");
  has(runner, "const latestIngressStartMs = Date.parse(addMinutes(target, -MIN_INGRESS_MARGIN_MINUTES));", "EA5E2_SOIL_WINDOW_MARGIN_BOUND_REQUIRED");
  has(runner, "observedAt >= soilWindowStart && observedAt <= Date.parse(target)", "EA5E2_SOIL_WINDOW_INCLUSIVE_LOWER_BOUND_REQUIRED");
  lacks(runner, "observedAt > soilWindowStart && observedAt <= Date.parse(target)", "EA5E2_SOIL_WINDOW_STRICT_LOWER_BOUND_FORBIDDEN");

  // This hotfix must not touch the Runtime selector or any authority document.
  eq(git("rev-parse", `${BASE}:${SELECTOR}`), git("rev-parse", `HEAD:${SELECTOR}`), "EA5E2_SOIL_WINDOW_RUNTIME_SELECTOR_MUTATION_FORBIDDEN");
  eq(git("rev-parse", `${BASE}:${AUTHORITY}`), git("rev-parse", `HEAD:${AUTHORITY}`), "EA5E2_SOIL_WINDOW_AUTHORITY_MUTATION_FORBIDDEN");

  console.log(JSON.stringify({
    status: "PASS",
    subject_sha: subject,
    base_sha: BASE,
    selector_id: "LATEST_USABLE_AUTHORIZED_OBSERVATION_WITHIN_15M_BEFORE_TICK_V2",
    selector_max_age_ms: 900000,
    lower_bound_inclusive: true,
    polling_begins_at_window_open_minutes_before_t: 15,
    minimum_ingestion_margin_minutes: 5,
    authority_changed: false,
    runtime_selector_changed: false,
  }));
}

main();
