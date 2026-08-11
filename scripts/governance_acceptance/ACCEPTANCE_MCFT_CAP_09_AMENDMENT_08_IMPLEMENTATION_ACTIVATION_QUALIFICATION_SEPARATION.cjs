#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");

const fail = (message) => { throw new Error(message); };
const eq = (actual, expected, code) => {
  if (actual !== expected) fail(`${code}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
};
const has = (text, marker, code) => {
  if (!text.includes(marker)) fail(`${code}:${marker}`);
};
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const blob = (ref, filePath) => git("rev-parse", `${ref}:${filePath}`);
const read = (filePath) => fs.readFileSync(filePath, "utf8");
const json = (filePath) => JSON.parse(read(filePath));

const base = process.env.MCFT_BASE_SHA;
eq(base, "4fc792398bcc25243af7c63734fe59beec9b0dcc", "AMENDMENT08_EXACT_BASE_REQUIRED");

const amendmentPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-08-IMPLEMENTATION-ACTIVATION-QUALIFICATION-SEPARATION-AUTHORITY.md";
const workflowPath = ".github/workflows/mcft-cap-09-amendment-08-implementation-activation-qualification-separation.yml";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_08_IMPLEMENTATION_ACTIVATION_QUALIFICATION_SEPARATION.cjs";

const changed = git("diff", "--name-only", `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(
  JSON.stringify(changed),
  JSON.stringify([amendmentPath, workflowPath, gatePath].sort()),
  "AMENDMENT08_EXACT_THREE_FILE_BOUNDARY_REQUIRED",
);

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md": "39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md": "7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md": "e59e11e909bfd0a38c7298c5a6f909a6cd7afa49",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-07-EXTERNAL-FORMAL-FIXED-LAG-CAUSALITY-AUTHORITY.md": "c5a98ca789027e1bf051ec56bf1b7e76b98a0891",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-LIVE-SOURCE-EXACT-HEAD-QUALIFICATION-V1.json": "791e3d24bdc862641c77ddd26778495cb8e6a7dd",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06A-FUTURE-FORMAL-WINDOW-EPOCH-SELECTION-V1.json": "c7788d525c56ab83117afbeeec85f2b9f990534f",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E1-POST-REBASE-FORMAL-DB-PREFLIGHT-AND-WINDOW-INPUT-MANIFEST-V1.json": "788d1f969aa335ee18db9186c5ec0578ee1a960a"
};
for (const [filePath, expectedSha] of Object.entries(predecessorPins)) {
  eq(blob(base, filePath), expectedSha, `AMENDMENT08_BASE_PIN:${filePath}`);
  eq(blob("HEAD", filePath), expectedSha, `AMENDMENT08_PREDECESSOR_MUTATED:${filePath}`);
}

const taskbook = read("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md");
for (const marker of [
  "actual UTC scheduler clock; no accelerated formal clock",
  "24 hourly slots O00–O23",
  "one missed slot backfilled oldest-first"
]) has(taskbook, marker, "AMENDMENT08_TASKBOOK_AUTHORITY_MISSING");

const amendment06 = read("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md");
for (const marker of [
  "candidate O00 = first exact UTC hourly boundary at or after",
  "Amendment-06 effectiveness time + 36 hours",
  "EA5E Formal Authority V3 effective deadline = O00 - 12 hours",
  "the selected epoch becomes automatically ineligible for Formal start",
  "no retroactive execution or initial multi-slot catch-up is permitted",
  "If no later candidate can satisfy the frozen EA2 crop-context consensus"
]) has(amendment06, marker, "AMENDMENT08_AMENDMENT06_RULE_MISSING");

const amendment07 = read("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-07-EXTERNAL-FORMAL-FIXED-LAG-CAUSALITY-AUTHORITY.md");
for (const marker of [
  "scheduler_eligibility_lag_hours = 7",
  "pre-boundary causal collector target     = T - 00:30",
  "late exact-hour collector scheduled      = T + 06:30",
  "late exact-hour evidence cutoff          = T + 07:12",
  "runtime observer nominal time            = T + 07:17",
  "minimum_ingestion_margin_minutes = 5",
  "source_substitution_authorized = false",
  "time_relabeling_authorized = false"
]) has(amendment07, marker, "AMENDMENT08_AMENDMENT07_RULE_MISSING");

const ea4 = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-LIVE-SOURCE-EXACT-HEAD-QUALIFICATION-V1.json");
eq(ea4.kbs.raw_hourly_latest_max_age_hours, 6, "AMENDMENT08_KBS_MAX_AGE_MUST_REMAIN_SIX_HOURS");
eq(ea4.kbs.raw_hourly_csv, "https://lter.kbs.msu.edu/datatables/13.csv", "AMENDMENT08_KBS_SOURCE_IDENTITY_DRIFT");
eq(ea4.gfs.future_file_waiting_forbidden, true, "AMENDMENT08_FUTURE_FILE_WAITING_FORBIDDEN");
eq(ea4.gfs.cross_cycle_substitution_authorized, false, "AMENDMENT08_CROSS_CYCLE_SUBSTITUTION_FORBIDDEN");

const a06a = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06A-FUTURE-FORMAL-WINDOW-EPOCH-SELECTION-V1.json");
eq(a06a.selection_rule.selected_o00, "2026-08-11T17:00:00.000Z", "AMENDMENT08_CURRENT_O00_REQUIRED");
eq(a06a.selection_rule.selected_o23, "2026-08-12T16:00:00.000Z", "AMENDMENT08_CURRENT_O23_REQUIRED");
eq(a06a.selection_rule.ea5e_v3_readiness_deadline, "2026-08-11T05:00:00.000Z", "AMENDMENT08_CURRENT_READINESS_DEADLINE_REQUIRED");
eq(a06a.crop_context_derivation.all_24_slots_conservative_consensus, true, "AMENDMENT08_CURRENT_CROP_CONSENSUS_REQUIRED");
eq(a06a.crop_context_derivation.all_24_slots_stage_code, "MID", "AMENDMENT08_CURRENT_STAGE_CODE_REQUIRED");
eq(a06a.crop_context_derivation.minimum_forward_guard_clearance_hours_across_window, 6, "AMENDMENT08_CURRENT_FORWARD_GUARD_CLEARANCE_REQUIRED");
eq(a06a.selection_side_effect_boundary.database_write_count, 0, "AMENDMENT08_A06A_DATABASE_WRITE_MUST_REMAIN_ZERO");

const ea5e1 = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E1-POST-REBASE-FORMAL-DB-PREFLIGHT-AND-WINDOW-INPUT-MANIFEST-V1.json");
const ea5e1Effect = ea5e1.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main;
eq(ea5e1Effect.formal_window_input_manifest_frozen, true, "AMENDMENT08_EA5E1_MANIFEST_MUST_REMAIN_FROZEN");
eq(ea5e1Effect.formal_o00_start_authorized, false, "AMENDMENT08_EA5E1_O00_MUST_REMAIN_UNAUTHORIZED");
eq(ea5e1Effect.formal_execution_count, "0/24", "AMENDMENT08_EA5E1_EXECUTION_MUST_REMAIN_ZERO");

const amendment = read(amendmentPath);
for (const marker of [
  "software implementation qualification",
  "operational activation qualification",
  "IMPLEMENTATION_QUALIFIED",
  "OPERATIONAL_ACTIVATION_QUALIFIED",
  "A provider outage may prevent the External Formal path from becoming operationally eligible",
  "A temporary external-provider freshness failure is not, by itself, an implementation defect",
  "Operational Activation Qualification is a protected-main, real-world qualification",
  "latest KBS Raw Hourly age <= 6 hours",
  "pre-boundary collector target     = T - 00:30",
  "late exact-hour collector         = T + 06:30",
  "scheduler eligibility             = T + 07:00",
  "late exact-hour evidence cutoff   = T + 07:12",
  "Runtime observer nominal          = T + 07:17",
  "minimum ingestion margin          = 5 minutes",
  "Implementation Qualification effective on protected main",
  "Operational Activation Qualification PASS on protected main",
  "whole-window crop-context viability scan",
  "the candidate's `O00 - 12h` EA5E3 readiness deadline is still in the future",
  "NO_CURRENT_SEASON_SUCCESSOR_EPOCH",
  "EA5E2_IMPLEMENTATION_QUALIFIED",
  "EA5E2_OPERATIONAL_ACTIVATION_QUALIFIED",
  "S6-EA5E2-IMPLEMENTATION-QUALIFICATION-REBASE-UNDER-AMENDMENT-08"
]) has(amendment, marker, "AMENDMENT08_REQUIRED_RULING_MISSING");

for (const forbidden of [
  "KBS freshness threshold > 6h is authorized",
  "source substitution is authorized",
  "time relabeling is authorized",
  "accelerated formal clock is authorized",
  "formal_o00_start_authorized = true",
  "formal_window_started = true",
  "EA5E3 effectiveness = true",
  "MCFT-CAP-09 completed = true"
]) {
  if (amendment.includes(forbidden)) fail(`AMENDMENT08_PREMATURE_OR_FORBIDDEN_CLAIM:${forbidden}`);
}

const workflow = read(workflowPath);
for (const marker of [
  "Resolve exact Amendment-08 base",
  "ACCEPTANCE_MCFT_CAP_09_AMENDMENT_08_IMPLEMENTATION_ACTIVATION_QUALIFICATION_SEPARATION.cjs",
  "Upload immutable Amendment-08 proof artifact"
]) has(workflow, marker, "AMENDMENT08_WORKFLOW_PROOF_STEP_MISSING");
for (const forbidden of [
  "pull_request_target",
  "workflow_dispatch:",
  "schedule:",
  "GEOX_MCFT_CAP09_S6_DATABASE_URL",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID",
  "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY"
]) {
  if (workflow.includes(forbidden)) fail(`AMENDMENT08_WORKFLOW_SIDE_EFFECT_CAPABILITY_FORBIDDEN:${forbidden}`);
}

fs.mkdirSync("acceptance-output", { recursive: true });
const result = {
  schema_version: "geox_mcft_cap09_amendment_08_implementation_activation_qualification_separation_governance_result_v1",
  status: "PASS",
  base_main_sha: base,
  subject_head_sha: git("rev-parse", "HEAD"),
  exact_changed_file_count: changed.length,
  predecessor_blobs_verified_unchanged: true,
  implementation_and_operational_activation_qualification_separated: true,
  implementation_qualification_may_authorize_merge: true,
  operational_activation_qualification_requires_protected_main: true,
  kbs_raw_hourly_max_age_hours: 6,
  scheduler_eligibility_lag_hours: 7,
  late_exact_interval_cutoff_offset_minutes: 432,
  runtime_observer_offset_minutes: 437,
  minimum_ingestion_margin_minutes: 5,
  source_substitution_authorized: false,
  time_relabeling_authorized: false,
  accelerated_formal_clock_authorized: false,
  current_selected_epoch_extended: false,
  current_selected_o00: a06a.selection_rule.selected_o00,
  current_selected_o23: a06a.selection_rule.selected_o23,
  current_readiness_deadline: a06a.selection_rule.ea5e_v3_readiness_deadline,
  current_crop_stage_code: a06a.crop_context_derivation.all_24_slots_stage_code,
  current_minimum_forward_guard_clearance_hours: a06a.crop_context_derivation.minimum_forward_guard_clearance_hours_across_window,
  formal_database_write_authorized: false,
  formal_raw_object_write_authorized: false,
  scheduler_write_authorized: false,
  formal_o00_start_authorized: false,
  formal_window_started: false,
  formal_execution_count: "0/24",
  ea5e3_effective: false,
  mcft_cap09_completed: false,
  next_legal_successor: "S6-EA5E2-IMPLEMENTATION-QUALIFICATION-REBASE-UNDER-AMENDMENT-08"
};
fs.writeFileSync(
  "acceptance-output/MCFT_CAP_09_AMENDMENT_08_IMPLEMENTATION_ACTIVATION_QUALIFICATION_SEPARATION_GOVERNANCE_RESULT.json",
  `${JSON.stringify(result, null, 2)}\n`,
);

console.log(JSON.stringify(result, null, 2));
