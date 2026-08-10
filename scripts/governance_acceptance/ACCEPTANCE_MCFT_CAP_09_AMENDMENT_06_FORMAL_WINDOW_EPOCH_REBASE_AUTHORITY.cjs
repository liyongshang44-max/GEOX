#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const fail = (m) => { throw new Error(m); };
const eq = (a,e,c) => { if (a !== e) fail(`${c}: expected=${JSON.stringify(e)} actual=${JSON.stringify(a)}`); };
const git = (...a) => execFileSync("git", a, { encoding:"utf8" }).trim();
const blob = (ref,p) => git("rev-parse", `${ref}:${p}`);

const base = process.env.MCFT_BASE_SHA;
eq(base,"ec4b0c04b736ee55b8eb9367d24ec81acb22bf08","AMENDMENT06_EXACT_BASE_REQUIRED");
const amendmentPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md";
const workflowPath = ".github/workflows/mcft-cap-09-amendment-06-formal-window-epoch-rebase-authority.yml";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_AMENDMENT_06_FORMAL_WINDOW_EPOCH_REBASE_AUTHORITY.cjs";
const changed = git("diff","--name-only",`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed),JSON.stringify([amendmentPath,workflowPath,gatePath].sort()),"AMENDMENT06_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md":"39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md":"7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5D3-EA5D-CLOSURE-AUTHORITY-V1.json":"ad6708fb4fa884a2c61c3401338a7a3eb5cb34d0",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E0-FORMAL-WINDOW-CLOCK-VIABILITY-REJECTION-V1.json":"bc0a65a80c9b7e361eab07c27c1ed711a53a1f44",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json":"b5de9d29189cb654444b3f57d00df290eefe16d3"
};
for (const [p,s] of Object.entries(predecessorPins)) {
  eq(blob(base,p),s,`AMENDMENT06_BASE_BLOB_PIN_MISMATCH:${p}`);
  eq(blob("HEAD",p),s,`AMENDMENT06_PREDECESSOR_MUTATED:${p}`);
}
eq(blob("HEAD",amendmentPath),"e59e11e909bfd0a38c7298c5a6f909a6cd7afa49","AMENDMENT06_CANDIDATE_BLOB_MISMATCH");
eq(blob("HEAD",workflowPath),"a0aab06d5cbecfe52c8b21cf4958768a99700062","AMENDMENT06_WORKFLOW_BLOB_MISMATCH");

const taskbook = fs.readFileSync("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md","utf8");
for (const marker of ["actual UTC scheduler clock; no accelerated formal clock","24 hourly slots O00–O23","one missed slot backfilled oldest-first","→ actual UTC O00–O23"]) if (!taskbook.includes(marker)) fail(`AMENDMENT06_TASKBOOK_MARKER_MISSING:${marker}`);

const a5 = fs.readFileSync("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md","utf8");
for (const marker of ["External A0 bootstrap Runtime Config is the predecessor of O00 config","each config `effective_logical_time` equals its slot logical time","every ref and determinism hash is frozen before O00","implicit “latest config” lookup is forbidden","Only after EA5E is effective may O00 be enabled."]) if (!a5.includes(marker)) fail(`AMENDMENT06_AMENDMENT05_MARKER_MISSING:${marker}`);

const crop = fs.readFileSync("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json","utf8");
for (const marker of ["formal_startup_must_rederive_as_of_fresh_boundary","backward_stability_hours","forward_transition_guard_hours","EVERY_FROZEN_FAO_VARIANT_AND_EVERY_POSSIBLE_PLANTING_TIME_MUST_REMAIN_IN_ONE_IDENTICAL_STAGE_OVER_T_MINUS_6H_THROUGH_T_PLUS_30H"]) if (!crop.includes(marker)) fail(`AMENDMENT06_CROP_AUTHORITY_MARKER_MISSING:${marker}`);

const rejection = JSON.parse(fs.readFileSync("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E0-FORMAL-WINDOW-CLOCK-VIABILITY-REJECTION-V1.json","utf8"));
eq(rejection.expected_exact_head_preflight_decision,"REJECTED_AS_FORMAL_WINDOW_EPOCH_EXPIRED_BEFORE_EA5E_EFFECTIVENESS","AMENDMENT06_EA5E0_REJECTION_REQUIRED");
eq(rejection.required_correction_class,"SEPARATELY_ADJUDICATED_FORMAL_WINDOW_EPOCH_REBASE_WITH_APPEND_ONLY_AUDIT_PRESERVATION","AMENDMENT06_CORRECTION_CLASS_REQUIRED");
eq(rejection.next_legal_successor_if_effective,"S6-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY","AMENDMENT06_LEGAL_FRONTIER_REQUIRED");
eq(rejection.effect_if_exact_head_rejection_proof_passes_and_candidate_merges_to_protected_main.current_persisted_24_config_epoch_eligible_for_formal_window_start,false,"AMENDMENT06_EXPIRED_EPOCH_MUST_BE_INELIGIBLE");

const amendment = fs.readFileSync(amendmentPath,"utf8");
for (const marker of [
  "The existing External A0 canonical bootstrap remains the authoritative pre-window Runtime state.",
  "permanently **superseded for Formal-window start**",
  "no new A0 canonical state, lineage, checkpoint, forecast, health, or bootstrap record is created by the epoch rebase",
  "the existing External A0 bootstrap Runtime Config remains the exact parent authority of the rebased O00 config",
  "Amendment-06 effectiveness time + 36 hours",
  "EA5E Formal Authority V3 effective deadline = O00 - 12 hours",
  "every rebased slot carries a crop-water-use stage context freshly rederived for that slot",
  "every frozen FAO-56 maize variant and every possible planting time must agree on one identical allowed stage",
  "A successful single rebase persistence SHALL append exactly 24 new Runtime Config facts and no other canonical objects.",
  "= 49 Runtime Config facts total",
  "Idempotent exact-head re-verification must produce zero additional writes.",
  "exclude every expired original O00–O23 config ref/hash",
  "A missed readiness deadline is an epoch-selection failure, not a Runtime backfill case.",
  "S6-A06A-FUTURE-FORMAL-WINDOW-EPOCH-SELECTION-FREEZE"
]) if (!amendment.includes(marker)) fail(`AMENDMENT06_AUTHORITY_MARKER_MISSING:${marker}`);

for (const forbidden of ["accelerated Formal clock is permitted","retroactive O00 execution is permitted","delete expired configs","truncate the Formal database","new A0 bootstrap is authorized"]) if (amendment.includes(forbidden)) fail(`AMENDMENT06_FORBIDDEN_AUTHORITY_TEXT:${forbidden}`);

const workflow = fs.readFileSync(workflowPath,"utf8");
if (workflow.includes("pull_request_target")) fail("AMENDMENT06_PULL_REQUEST_TARGET_FORBIDDEN");
for (const marker of [
  "GEOX_MCFT_CAP09_S6_DATABASE_URL: ${{ secrets.GEOX_MCFT_CAP09_S6_DATABASE_URL }}",
  "FORMAL_WINDOW_ENABLED: ${{ vars.GEOX_MCFT_CAP09_S6_FORMAL_WINDOW_ENABLED }}",
  "AMENDMENT06_FORMAL_WINDOW_MUST_REMAIN_DISABLED",
  "BEGIN TRANSACTION READ ONLY",
  "external_formal_runtime_config_7284202e3b0bdae6d32f4814",
  "sha256:d6b721b0eb74b1fbd4168d0bc1d551c0c95bf60fef67c8fe4cd9b77ad60930f8",
  "2026-08-09T22:00:00.000Z",
  "2026-08-10T21:00:00.000Z",
  "twin_shadow_online_scheduler_slot_v1",
  "twin_shadow_online_scheduler_cursor_v1",
  "exact_runtime_config_count:25",
  "formal_window_started:false"
]) if (!workflow.includes(marker)) fail(`AMENDMENT06_WORKFLOW_MARKER_MISSING:${marker}`);
if (/\b(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE\s+|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i.test(workflow)) fail("AMENDMENT06_DATABASE_WRITE_SQL_FORBIDDEN");
if (workflow.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID") || workflow.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY")) fail("AMENDMENT06_RAW_STORE_CREDENTIALS_FORBIDDEN");

const out = {
  schema_version:"geox_mcft_cap09_amendment06_governance_result_v1",
  status:"PASS",
  base_main_sha:base,
  subject_head_sha:git("rev-parse","HEAD"),
  exact_changed_file_count:changed.length,
  predecessor_blobs_verified_unchanged:true,
  ea5e0_exact_rejection_consumed:true,
  ea2_crop_context_freshness_consumed:true,
  existing_a0_bootstrap_preserved:true,
  expired_original_epoch_preserved_append_only:true,
  minimum_future_epoch_lead_hours:36,
  whole_window_crop_context_viability_required:true,
  crop_context_backward_guard_hours:6,
  crop_context_forward_guard_hours:30,
  ea5e_v3_readiness_deadline_hours_before_o00:12,
  rebase_exact_new_runtime_config_write_count:24,
  rebase_new_a0_write_count:0,
  amendment_06_effective_after_merge:true,
  a06a_future_epoch_selection_authorized_after_merge:true,
  ea5d_complete_remains_true:true,
  ea5e_authorized_remains_true:true,
  ea5e_complete:false,
  formal_o00_start_authorized:false,
  formal_window_started:false,
  formal_execution_count:"0/24",
  mcft_cap09_completed:false
};
fs.mkdirSync("acceptance-output",{recursive:true});
fs.writeFileSync("acceptance-output/MCFT_CAP_09_AMENDMENT06_GOVERNANCE_RESULT.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify(out,null,2));
