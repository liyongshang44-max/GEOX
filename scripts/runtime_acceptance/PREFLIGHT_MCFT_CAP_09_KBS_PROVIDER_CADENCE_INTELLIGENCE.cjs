#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { evaluateCadenceState, selftest } = require("./MCFT_CAP_09_KBS_PROVIDER_CADENCE_INTELLIGENCE_V1.cjs");

const CADENCE_STATE = process.env.KBS_CADENCE_STATE || "acceptance-output/PREVIOUS_KBS_PUBLICATION_CADENCE_STATE.json";
const CURRENT = process.env.KBS_CURRENT_FRESHNESS || "acceptance-output/KBS_CURRENT_FRESHNESS_METADATA.json";
const OUTPUT = process.env.KBS_CADENCE_INTELLIGENCE_OUTPUT || "acceptance-output/KBS_PROVIDER_CADENCE_INTELLIGENCE.json";

function readJson(file, code) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) { throw new Error(`${code}:${error.message}`); }
}

function write(proof) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof));
}

function main() {
  const test = selftest();
  if (test.status !== "PASS" || test.cases !== 4 || test.authority_changed !== false) {
    throw new Error("KBS_CADENCE_INTELLIGENCE_SELFTEST_FAILED");
  }

  const current = readJson(CURRENT, "KBS_CURRENT_FRESHNESS_METADATA_REQUIRED");
  if (current.schema_version !== "geox_mcft_cap09_kbs_current_freshness_metadata_v1" || current.authority_changed !== false || current.raw_values_emitted !== false) {
    throw new Error("KBS_CURRENT_FRESHNESS_METADATA_CONTRACT_DRIFT");
  }

  if (!fs.existsSync(CADENCE_STATE)) {
    write({
      schema_version: "geox_mcft_cap09_kbs_provider_cadence_intelligence_preflight_v1",
      status: "DEFER",
      decision: "DEFER",
      reason: "KBS_PROVIDER_CADENCE_STATE_UNAVAILABLE",
      evaluated_at: current.retrieved_at,
      latest_raw_hourly_timestamp: current.latest_raw_hourly_timestamp,
      current_age_hours: current.latest_age_hours,
      frozen_authority_max_age_hours: 6,
      frozen_authority_pass: current.within_frozen_6h_authority === true,
      scheduler_may_dispatch: current.within_frozen_6h_authority === true,
      cadence_intelligence_used_as_authority: false,
      authority_changed: false,
      formal_effect: false,
      database_write_count: 0,
      canonical_write_count: 0,
      raw_value_emission_count: 0,
    });
    return;
  }

  const state = readJson(CADENCE_STATE, "KBS_CADENCE_STATE_REQUIRED");
  const alignedState = {
    ...state,
    latest_event_time: current.latest_raw_hourly_timestamp,
  };
  const decision = evaluateCadenceState(alignedState, current.retrieved_at);
  const proof = {
    schema_version: "geox_mcft_cap09_kbs_provider_cadence_intelligence_preflight_v1",
    status: decision.decision,
    decision: decision.decision,
    reason: decision.reason,
    evaluated_at: current.retrieved_at,
    latest_raw_hourly_timestamp: current.latest_raw_hourly_timestamp,
    current_age_hours: Number(current.latest_age_hours),
    frozen_authority_max_age_hours: 6,
    frozen_authority_pass: decision.authority_pass,
    scheduler_may_dispatch: decision.scheduler_may_dispatch,
    cadence_state_polled_at: state.polled_at ?? null,
    cadence_state_subject_sha: state.subject_sha ?? null,
    cadence_diagnostic: decision.diagnostic,
    cadence_intelligence_used_as_authority: false,
    authority_changed: false,
    formal_effect: false,
    database_write_count: 0,
    canonical_write_count: 0,
    raw_value_emission_count: 0,
  };
  write(proof);
}

main();
