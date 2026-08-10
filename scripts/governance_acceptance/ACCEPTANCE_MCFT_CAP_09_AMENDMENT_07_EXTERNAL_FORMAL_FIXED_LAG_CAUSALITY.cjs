#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const fail = (message) => { throw new Error(message); };
const eq = (actual, expected, code) => {
  if (actual !== expected) fail(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
};
const yes = (value, code) => eq(value, true, code);
const no = (value, code) => eq(value, false, code);
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const blob = (ref, filePath) => git("rev-parse", `${ref}:${filePath}`);
const read = (filePath) => fs.readFileSync(filePath, "utf8");
const json = (filePath) => JSON.parse(read(filePath));
const contains = (text, marker, code) => {
  if (!text.includes(marker)) fail(`${code}:${marker}`);
};

const base = process.env.MCFT_BASE_SHA;
eq(base, "5facf874b8f11f8613ddd106a45d4033a6f44ae5", "AMENDMENT07_EXACT_BASE_REQUIRED");

const amendmentPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-07-EXTERNAL-FORMAL-FIXED-LAG-CAUSALITY-AUTHORITY.md";
const workflowPath = ".github/workflows/mcft-cap-09-amendment-07-external-formal-fixed-lag-causality.yml";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_07_EXTERNAL_FORMAL_FIXED_LAG_CAUSALITY.cjs";
const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(
  JSON.stringify(changed),
  JSON.stringify([amendmentPath, workflowPath, gatePath].sort()),
  "AMENDMENT07_EXACT_THREE_FILE_BOUNDARY_REQUIRED",
);

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md": "7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md": "e59e11e909bfd0a38c7298c5a6f909a6cd7afa49",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-LIVE-SOURCE-EXACT-HEAD-QUALIFICATION-V1.json": "791e3d24bdc862641c77ddd26778495cb8e6a7dd",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json": "1174940a6908e545e70d87cb65be5b3a41db33cf",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E1-POST-REBASE-FORMAL-DB-PREFLIGHT-AND-WINDOW-INPUT-MANIFEST-V1.json": "788d1f969aa335ee18db9186c5ec0578ee1a960a",
  "apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.ts": "964dd0c499f271527626677b1f9f2fa4f550645a",
  "apps/server/src/runtime/twin_runtime/assimilated_continuation_evidence_window_v2.ts": "72acf59ca58d805726ad8bdd1c08f13fc58af18b",
  "apps/server/src/runtime/twin_runtime/external_formal_cap04_input_authority_v1.ts": "b4b7448518628bcffe8eaf6a91d9967145f7647d",
  "apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.ts": "f627c89d59092621dd7a4523f09b2ce4ec78433b"
};
for (const [filePath, expectedSha] of Object.entries(predecessorPins)) {
  eq(blob(base, filePath), expectedSha, `AMENDMENT07_BASE_PIN:${filePath}`);
  eq(blob("HEAD", filePath), expectedSha, `AMENDMENT07_PREDECESSOR_MUTATED:${filePath}`);
}

eq(blob("HEAD", amendmentPath), "c5a98ca789027e1bf051ec56bf1b7e76b98a0891", "AMENDMENT07_AUTHORITY_BLOB_REQUIRED");
eq(blob("HEAD", workflowPath), "159c08dab2352343817441abffb770b83ac6d427", "AMENDMENT07_WORKFLOW_BLOB_REQUIRED");

const taskbook = read("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md");
for (const marker of [
  "actual UTC scheduler clock; no accelerated formal clock",
  "24 hourly slots O00–O23",
  "one missed slot backfilled oldest-first",
]) contains(taskbook, marker, "AMENDMENT07_TASKBOOK_MARKER_MISSING");

const amendment05 = read("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md");
for (const marker of [
  "A collector/canonicalizer/ingress job must complete before a slot can consume fresh External Evidence",
  "Only after EA5E is effective may O00 be enabled.",
  "same latest complete GFS cycle",
]) contains(amendment05, marker, "AMENDMENT07_AMENDMENT05_MARKER_MISSING");

const originalEa4 = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-LIVE-SOURCE-EXACT-HEAD-QUALIFICATION-V1.json");
eq(originalEa4.kbs.raw_hourly_latest_max_age_hours, 6, "AMENDMENT07_KBS_SIX_HOUR_FRESHNESS_AUTHORITY_REQUIRED");
eq(originalEa4.kbs.raw_hourly_csv, "https://lter.kbs.msu.edu/datatables/13.csv", "AMENDMENT07_KBS_RAW_HOURLY_SOURCE_REQUIRED");
no(originalEa4.gfs.future_file_waiting_forbidden === false, "AMENDMENT07_GFS_FUTURE_FILE_WAITING_MUST_REMAIN_FORBIDDEN");
no(originalEa4.gfs.cross_cycle_substitution_authorized, "AMENDMENT07_GFS_CROSS_CYCLE_SUBSTITUTION_FORBIDDEN");

const recovery = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-RECOVERY-AUTHORITY-V1.json");
yes(recovery.recovery_proof.same_source_identity, "AMENDMENT07_EA4_SAME_SOURCE_REQUIRED");
no(recovery.recovery_proof.source_substitution_performed, "AMENDMENT07_EA4_SOURCE_SUBSTITUTION_FORBIDDEN");
no(recovery.recovery_proof.freshness_threshold_changed, "AMENDMENT07_EA4_FRESHNESS_THRESHOLD_CHANGE_FORBIDDEN");
eq(recovery.recovery_proof.attempts[0].probe_started_at_utc, "2026-08-09T05:47:28.938254Z", "AMENDMENT07_EA4_PROBE_TIME_REQUIRED");
eq(recovery.recovered_kbs_facts.latest_record_utc, "2026-08-09T04:00:00Z", "AMENDMENT07_EA4_LATEST_HOURLY_TIME_REQUIRED");
eq(recovery.recovered_future_facts.source_cycle_utc, "2026-08-09T00:00:00Z", "AMENDMENT07_EA4_GFS_CYCLE_REQUIRED");
yes(recovery.current_authority_effect_if_merged.live_source_qualified, "AMENDMENT07_EA4_LIVE_SOURCE_QUALIFIED_REQUIRED");

const continuation = read("apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.ts");
for (const marker of [
  "if (availableAt > input.logical_time || ingestedAt > input.logical_time)",
  "interval.interval_start !== input.window_start || interval.interval_end !== input.logical_time",
  "MISSING_EXACT_HOURLY_RAINFALL_INTERVAL",
  "MISSING_EXACT_HOURLY_ET0_INTERVAL",
]) contains(continuation, marker, "AMENDMENT07_CONTINUATION_CAUSALITY_MARKER_MISSING");

const externalInput = read("apps/server/src/runtime/twin_runtime/external_formal_cap04_input_authority_v1.ts");
for (const marker of [
  "EXTERNAL_CAP04_REQUIRED_EVIDENCE_FAMILY_MISSING",
  "soil_moisture_observation_v1",
  "observed_rainfall_v1",
  "historical_et0_estimate_v1",
  "future_weather_assumption_v1",
  "future_et0_assumption_v1",
]) contains(externalInput, marker, "AMENDMENT07_EXACT_FIVE_FAMILY_MARKER_MISSING");

const externalCandidate = read("apps/server/src/runtime/twin_runtime/external_formal_cap04_candidate_execution_service_v1.ts");
for (const marker of [
  "selectCap04FutureForcingOutcomeV1",
  "executeCap04Pure72hForecastMathV1",
  "buildAssimilatedContinuationEvidenceWindowV2",
]) contains(externalCandidate, marker, "AMENDMENT07_EXTERNAL_CAP04_PATH_MARKER_MISSING");

const futureSelector = read("apps/server/src/runtime/twin_runtime/future_forcing_selector_v1.ts");
for (const marker of [
  "if (issuedAt > logicalTime)",
  "if (availableAt > logicalTime)",
  "validFrom !== logicalTime",
  "CAP04_FUTURE_FORCING_POINT_COUNT_V1",
]) contains(futureSelector, marker, "AMENDMENT07_FUTURE_CAUSALITY_MARKER_MISSING");

const ea5e1 = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E1-POST-REBASE-FORMAL-DB-PREFLIGHT-AND-WINDOW-INPUT-MANIFEST-V1.json");
yes(ea5e1.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.ea5e1_post_rebase_formal_db_preflight_effective, "AMENDMENT07_EA5E1_EFFECT_REQUIRED");
yes(ea5e1.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.formal_window_input_manifest_frozen, "AMENDMENT07_EA5E1_MANIFEST_FROZEN_REQUIRED");
no(ea5e1.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.formal_o00_start_authorized, "AMENDMENT07_EA5E1_O00_MUST_REMAIN_UNAUTHORIZED");
eq(ea5e1.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.formal_execution_count, "0/24", "AMENDMENT07_EA5E1_ZERO_EXECUTION_REQUIRED");

const amendment = read(amendmentPath);
for (const marker of [
  "scheduler_eligibility_lag_hours = 7",
  "runtime_observer_minute_utc     = 17",
  "minimum_ingestion_margin_minutes = 5",
  "pre-boundary causal collector target     = T - 00:30",
  "late exact-hour collector scheduled      = T + 06:30",
  "late exact-hour evidence cutoff          = T + 07:12",
  "runtime observer nominal time            = T + 07:17",
  "fixed-lag shadow-online qualification",
  "exact_interval_availability_cutoff_time = T + 07:12",
  "observed_rainfall_v1",
  "historical_et0_estimate_v1",
  "future_forcing_post_logical_time_availability_authorized = false",
  "time_relabeling_authorized = false",
  "source_substitution_authorized = false",
  "eligible_logical_hour <= floor(actual_utc_now_to_hour) - 7h",
  "S6-EA5E2-COLLECTOR-RUNTIME-SCHEDULE-READINESS-UNDER-AMENDMENT-07",
]) contains(amendment, marker, "AMENDMENT07_AUTHORITY_MARKER_MISSING");

for (const marker of [
  "event_time <= T",
  "interval must still be exactly (T-1h, T]",
  "available_to_runtime_at <= T + 07:12",
  "ingested_at <= T + 07:12",
  "issued_at <= T",
  "available_to_runtime_at <= T",
  "valid_from == T",
  "valid_to == T + 72h",
  "exactly 72 hourly points",
  "same latest complete GFS cycle for weather and ET0",
]) contains(amendment, marker, "AMENDMENT07_CAUSAL_RULE_MARKER_MISSING");

for (const forbiddenClaim of [
  "source substitution is authorized",
  "time relabeling is authorized",
  "accelerated formal clock is authorized",
  "formal_o00_start_authorized = true",
  "formal_window_started = true",
  "EA5E2 completion = true",
  "MCFT-CAP-09 completed = true",
]) {
  if (amendment.includes(forbiddenClaim)) fail(`AMENDMENT07_PREMATURE_OR_FORBIDDEN_CLAIM:${forbiddenClaim}`);
}

const lagHours = 7;
const delayedCollectorMinute = 30;
const cutoffMinute = 12;
const observerMinute = 17;
eq(lagHours, originalEa4.kbs.raw_hourly_latest_max_age_hours + 1, "AMENDMENT07_LAG_MUST_EXCEED_FROZEN_KBS_MAX_AGE_BY_ONE_HOUR");
if (observerMinute - cutoffMinute < 5) fail("AMENDMENT07_MINIMUM_INGESTION_MARGIN_NOT_MET");
if (delayedCollectorMinute <= 0 || delayedCollectorMinute >= 60) fail("AMENDMENT07_DELAYED_COLLECTOR_MINUTE_INVALID");

const workflow = read(workflowPath);
if (workflow.includes("pull_request_target")) fail("AMENDMENT07_PULL_REQUEST_TARGET_FORBIDDEN");
for (const marker of [
  "Resolve exact Amendment-07 base",
  "ACCEPTANCE_MCFT_CAP_09_AMENDMENT_07_EXTERNAL_FORMAL_FIXED_LAG_CAUSALITY.cjs",
  "Upload immutable Amendment-07 proof artifact",
]) contains(workflow, marker, "AMENDMENT07_WORKFLOW_MARKER_MISSING");
for (const forbidden of [
  "GEOX_MCFT_CAP09_S6_DATABASE_URL",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY",
  "workflow_dispatch:",
  "schedule:",
]) {
  if (workflow.includes(forbidden)) fail(`AMENDMENT07_WORKFLOW_SIDE_EFFECT_OR_RUNTIME_TRIGGER_FORBIDDEN:${forbidden}`);
}

fs.mkdirSync("acceptance-output", { recursive: true });
const result = {
  schema_version: "geox_mcft_cap09_amendment_07_external_formal_fixed_lag_causality_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  predecessor_blobs_verified_unchanged: true,
  source_substitution_performed: false,
  generic_replay_semantics_mutated: false,
  future_forcing_post_logical_time_availability_authorized: false,
  scheduler_eligibility_lag_hours: 7,
  runtime_observer_minute_utc: 17,
  delayed_exact_hour_collector_offset_minutes: 390,
  delayed_exact_hour_availability_cutoff_offset_minutes: 432,
  minimum_ingestion_margin_minutes: 5,
  late_cutoff_types: ["observed_rainfall_v1", "historical_et0_estimate_v1"],
  exact_interval_time_relabeling_authorized: false,
  formal_database_write_authorized: false,
  formal_raw_object_write_authorized: false,
  scheduler_write_authorized: false,
  formal_o00_start_authorized: false,
  formal_window_started: false,
  formal_execution_count: "0/24",
  ea5e2_complete: false,
  ea5e3_effective: false,
  ea5e_complete: false,
  mcft_cap09_completed: false,
  next_legal_successor: "S6-EA5E2-COLLECTOR-RUNTIME-SCHEDULE-READINESS-UNDER-AMENDMENT-07",
};
fs.writeFileSync(
  "acceptance-output/MCFT_CAP_09_AMENDMENT_07_EXTERNAL_FORMAL_FIXED_LAG_CAUSALITY_GOVERNANCE_RESULT.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
