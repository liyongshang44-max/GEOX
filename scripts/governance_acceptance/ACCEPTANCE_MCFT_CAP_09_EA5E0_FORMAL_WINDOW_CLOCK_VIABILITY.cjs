#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const fail = (m) => { throw new Error(m); };
const eq = (a,e,c) => { if (a !== e) fail(`${c}: expected=${JSON.stringify(e)} actual=${JSON.stringify(a)}`); };
const yes = (v,c) => eq(v,true,c);
const no = (v,c) => eq(v,false,c);
const git = (...a) => execFileSync("git",a,{encoding:"utf8"}).trim();
const blob = (ref,p) => git("rev-parse",`${ref}:${p}`);
const json = (p) => JSON.parse(fs.readFileSync(p,"utf8"));

const base = process.env.MCFT_BASE_SHA;
eq(base,"4f672f8ee68ca3fe17805956ae845c31a34bd897","EA5E0_EXACT_BASE_REQUIRED");
const authorityPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E0-FORMAL-WINDOW-CLOCK-VIABILITY-REJECTION-V1.json";
const workflowPath = ".github/workflows/mcft-cap-09-ea5e0-formal-window-clock-viability-preflight.yml";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E0_FORMAL_WINDOW_CLOCK_VIABILITY.cjs";
const changed = git("diff","--name-only",`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed),JSON.stringify([authorityPath,workflowPath,gatePath].sort()),"EA5E0_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md":"39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md":"7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5D3-EA5D-CLOSURE-AUTHORITY-V1.json":"ad6708fb4fa884a2c61c3401338a7a3eb5cb34d0",
  "scripts/runtime_acceptance/RUN_MCFT_CAP_09_S6_FORMAL_24_HOUR_STAGE_1B_WINDOW.ts":"1f19fa1e65352eba58e7de79dd124844defc901f",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-24-HOUR-CONFIG-V1.json":"974518c42757e0f78241433194d81d3e4583bf1d"
};
for (const [p,s] of Object.entries(predecessorPins)) {
  eq(blob(base,p),s,`EA5E0_BASE_BLOB_PIN_MISMATCH:${p}`);
  eq(blob("HEAD",p),s,`EA5E0_PREDECESSOR_MUTATED:${p}`);
}
eq(blob("HEAD",authorityPath),"bc0a65a80c9b7e361eab07c27c1ed711a53a1f44","EA5E0_AUTHORITY_BLOB_REQUIRED");
eq(blob("HEAD",workflowPath),"662d6a3c5dd2af8a0e1c7f2c901a48a9250d72c9","EA5E0_WORKFLOW_BLOB_REQUIRED");

const taskbook = fs.readFileSync("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md","utf8");
for (const marker of [
  "actual UTC scheduler clock; no accelerated formal clock",
  "24 hourly slots O00–O23",
  "one missed slot backfilled oldest-first",
  "S6-EA5 fresh-scope Formal bootstrap and preflight",
  "→ actual UTC O00–O23"
]) if (!taskbook.includes(marker)) fail(`EA5E0_TASKBOOK_MARKER_MISSING:${marker}`);

const amendment = fs.readFileSync("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md","utf8");
for (const marker of [
  "each config `effective_logical_time` equals its slot logical time",
  "every ref and determinism hash is frozen before O00",
  "A collector/canonicalizer/ingress job must complete before a slot can consume fresh External Evidence",
  "Only after EA5E is effective may O00 be enabled."
]) if (!amendment.includes(marker)) fail(`EA5E0_AMENDMENT05_MARKER_MISSING:${marker}`);

const d3 = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5D3-EA5D-CLOSURE-AUTHORITY-V1.json");
yes(d3.success_effect_if_merged_to_protected_main.ea5d_complete,"EA5E0_EA5D_COMPLETE_REQUIRED");
yes(d3.success_effect_if_merged_to_protected_main.ea5e_authorized,"EA5E0_EA5E_AUTHORIZED_REQUIRED");
no(d3.success_effect_if_merged_to_protected_main.ea5e_complete,"EA5E0_EA5E_MUST_NOT_ALREADY_BE_COMPLETE");
no(d3.success_effect_if_merged_to_protected_main.formal_o00_start_authorized,"EA5E0_O00_MUST_NOT_ALREADY_BE_AUTHORIZED");
no(d3.success_effect_if_merged_to_protected_main.formal_window_started,"EA5E0_WINDOW_MUST_NOT_ALREADY_BE_STARTED");
eq(d3.next_legal_successor_if_effective,"S6-EA5E-POST-BOOTSTRAP-PREFLIGHT-MANIFEST-SCHEDULE-READINESS-AND-FORMAL-AUTHORITY-V3","EA5E0_EA5E_FRONTIER_REQUIRED");

const a = json(authorityPath);
eq(a.base_main_sha,base,"EA5E0_AUTHORITY_BASE_REQUIRED");
eq(a.frontier_id,"S6-EA5E0-FORMAL-WINDOW-CLOCK-VIABILITY-PREFLIGHT","EA5E0_FRONTIER_REQUIRED");
eq(a.record_status,"EA5E0_REJECTION_CANDIDATE_NOT_EFFECTIVE","EA5E0_RECORD_STATUS_REQUIRED");
eq(a.ea5d3_effectiveness_authority.pr_number,3026,"EA5E0_EA5D3_PR_REQUIRED");
eq(a.ea5d3_effectiveness_authority.merged_head_sha,"39f568a3501d71342d501c41c3f3ca730d22f5d1","EA5E0_EA5D3_HEAD_REQUIRED");
eq(a.ea5d3_effectiveness_authority.merge_commit_sha,base,"EA5E0_EA5D3_MERGE_SHA_REQUIRED");
eq(a.ea5d3_effectiveness_authority.merged_at_utc,"2026-08-10T03:04:23.000Z","EA5E0_EA5D3_EFFECTIVE_TIME_REQUIRED");
yes(a.ea5d3_effectiveness_authority.ea5e_authorized_only_after_this_effectiveness,"EA5E0_EA5E_EFFECTIVENESS_ORDER_REQUIRED");

const epoch = a.frozen_current_epoch;
eq(epoch.bootstrap_logical_time,"2026-08-09T21:00:00.000Z","EA5E0_A0_TIME_REQUIRED");
eq(epoch.o00_logical_time,"2026-08-09T22:00:00.000Z","EA5E0_O00_TIME_REQUIRED");
eq(epoch.o23_logical_time,"2026-08-10T21:00:00.000Z","EA5E0_O23_TIME_REQUIRED");
eq(epoch.runtime_config_count,25,"EA5E0_25_CONFIGS_REQUIRED");
eq(epoch.hourly_runtime_config_count,24,"EA5E0_24_HOURLY_CONFIGS_REQUIRED");
eq(epoch.scheduler_slot_count_before_preflight,0,"EA5E0_ZERO_SLOTS_REQUIRED");
eq(epoch.scheduler_cursor_count_before_preflight,0,"EA5E0_ZERO_CURSORS_REQUIRED");
eq(epoch.ea5d3_effectiveness_seconds_after_o00_boundary,18263,"EA5E0_EFFECTIVE_OFFSET_REQUIRED");
eq(JSON.stringify(epoch.expired_required_slot_boundaries_before_ea5e_authorization),JSON.stringify(["O00","O01","O02","O03","O04","O05"]),"EA5E0_EXPIRED_BOUNDARIES_REQUIRED");

const rules = a.controlling_rules;
yes(rules.ea5e_must_be_effective_before_o00_may_be_enabled,"EA5E0_EA5E_BEFORE_O00_REQUIRED");
yes(rules.logical_tick_is_actual_exact_hourly_utc_boundary,"EA5E0_ACTUAL_UTC_REQUIRED");
no(rules.accelerated_or_replay_formal_clock_allowed,"EA5E0_ACCELERATED_REPLAY_FORBIDDEN");
yes(rules.runtime_config_effective_logical_time_must_equal_slot_logical_time,"EA5E0_CONFIG_TIME_EQUAL_SLOT_REQUIRED");
yes(rules.all_24_slot_config_ref_hashes_must_be_frozen_before_o00,"EA5E0_24_PINS_BEFORE_O00_REQUIRED");
no(rules.initial_multi_slot_catchup_substitution_for_actual_hourly_window_allowed,"EA5E0_INITIAL_CATCHUP_FORBIDDEN");
eq(rules.only_governed_intentional_missed_slot,"O11","EA5E0_ONLY_O11_MISS_REQUIRED");

eq(a.expected_exact_head_preflight_decision,"REJECTED_AS_FORMAL_WINDOW_EPOCH_EXPIRED_BEFORE_EA5E_EFFECTIVENESS","EA5E0_EXACT_REJECTION_REQUIRED");
const effect = a.effect_if_exact_head_rejection_proof_passes_and_candidate_merges_to_protected_main;
yes(effect.ea5d_complete_remains_true,"EA5E0_EA5D_REMAINS_COMPLETE");
yes(effect.ea5e_authorized_remains_true,"EA5E0_EA5E_REMAINS_AUTHORIZED");
no(effect.ea5e_complete,"EA5E0_EA5E_COMPLETE_PREMATURE");
no(effect.current_persisted_24_config_epoch_eligible_for_formal_window_start,"EA5E0_CURRENT_EPOCH_MUST_BE_INELIGIBLE");
eq(effect.current_persisted_24_config_epoch_status,"SUPERSEDED_FOR_WINDOW_START_REQUIRED_BEFORE_ANY_FORMAL_SLOT_EXECUTION","EA5E0_SUPERSESSION_STATUS_REQUIRED");
no(effect.external_package_formal_eligible,"EA5E0_FORMAL_ELIGIBILITY_PREMATURE");
no(effect.formal_o00_start_authorized,"EA5E0_O00_PREMATURE");
no(effect.formal_window_started,"EA5E0_WINDOW_PREMATURE");
no(effect.database_cleanup_or_rewrite_authorized,"EA5E0_DB_REWRITE_FORBIDDEN");
no(effect.retroactive_slot_execution_authorized,"EA5E0_RETROACTIVE_SLOT_FORBIDDEN");
no(effect.multi_slot_initial_backfill_authorized,"EA5E0_MULTI_SLOT_BACKFILL_FORBIDDEN");
no(effect.mcft_cap09_completed,"EA5E0_CAP09_PREMATURE");
eq(a.required_correction_class,"SEPARATELY_ADJUDICATED_FORMAL_WINDOW_EPOCH_REBASE_WITH_APPEND_ONLY_AUDIT_PRESERVATION","EA5E0_CORRECTION_CLASS_REQUIRED");
eq(a.next_legal_successor_if_effective,"S6-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY","EA5E0_NEXT_FRONTIER_REQUIRED");

const workflow = fs.readFileSync(workflowPath,"utf8");
if (workflow.includes("pull_request_target")) fail("EA5E0_PULL_REQUEST_TARGET_FORBIDDEN");
for (const marker of [
  "FORMAL_WINDOW_ENABLED: ${{ vars.GEOX_MCFT_CAP09_S6_FORMAL_WINDOW_ENABLED }}",
  "EA5E0_FORMAL_WINDOW_ENABLEMENT_MUST_REMAIN_FALSE",
  "2026-08-10T03:04:23Z",
  "O00,O01,O02,O03,O04,O05",
  "BEGIN TRANSACTION READ ONLY",
  "REJECTED_AS_FORMAL_WINDOW_EPOCH_EXPIRED_BEFORE_EA5E_EFFECTIVENESS",
  "twin_shadow_online_scheduler_slot_v1",
  "twin_shadow_online_scheduler_cursor_v1",
  "EXPLICIT_REF_HASH_PIN_ONLY",
  "SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY",
  "retroactive_slot_execution_authorized: false",
  "initial_multi_slot_backfill_authorized: false"
]) if (!workflow.includes(marker)) fail(`EA5E0_WORKFLOW_MARKER_MISSING:${marker}`);
if (/\b(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE\s+|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i.test(workflow)) fail("EA5E0_DATABASE_WRITE_SQL_FORBIDDEN");
if (workflow.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID") || workflow.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY")) fail("EA5E0_RAW_STORE_CREDENTIALS_FORBIDDEN");

const out = {
  schema_version:"geox_mcft_cap09_ea5e0_formal_window_clock_viability_governance_result_v1",
  status:"PASS",
  base_main_sha:base,
  subject_head_sha:git("rev-parse","HEAD"),
  exact_changed_file_count:changed.length,
  predecessor_blobs_verified_unchanged:true,
  expected_decision:"REJECTED_AS_FORMAL_WINDOW_EPOCH_EXPIRED_BEFORE_EA5E_EFFECTIVENESS",
  expired_required_slot_boundary_count_before_ea5e_authorization:6,
  database_write_authorized:false,
  scheduler_write_authorized:false,
  retroactive_slot_execution_authorized:false,
  multi_slot_initial_backfill_authorized:false,
  ea5d_complete_remains_true:true,
  ea5e_authorized_remains_true:true,
  ea5e_complete:false,
  formal_o00_start_authorized:false,
  formal_window_started:false,
  external_package_formal_eligible:false,
  mcft_cap09_completed:false
};
fs.mkdirSync("acceptance-output",{recursive:true});
fs.writeFileSync("acceptance-output/MCFT_CAP_09_EA5E0_FORMAL_WINDOW_CLOCK_VIABILITY_GOVERNANCE_RESULT.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify(out,null,2));
