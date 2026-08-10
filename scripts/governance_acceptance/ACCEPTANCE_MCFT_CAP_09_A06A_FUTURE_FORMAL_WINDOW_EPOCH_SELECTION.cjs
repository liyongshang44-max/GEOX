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
eq(base,"0481d2e0d77a7818c16a2c3baf102d2d265e8957","A06A_EXACT_BASE_REQUIRED");
const authorityPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A06A-FUTURE-FORMAL-WINDOW-EPOCH-SELECTION-V1.json";
const workflowPath = ".github/workflows/mcft-cap-09-a06a-future-formal-window-epoch-selection.yml";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_A06A_FUTURE_FORMAL_WINDOW_EPOCH_SELECTION.cjs";
const changed = git("diff","--name-only",`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed),JSON.stringify([authorityPath,workflowPath,gatePath].sort()),"A06A_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

const predecessorPins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md":"39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md":"7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V1.json":"b5de9d29189cb654444b3f57d00df290eefe16d3",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E0-FORMAL-WINDOW-CLOCK-VIABILITY-REJECTION-V1.json":"bc0a65a80c9b7e361eab07c27c1ed711a53a1f44",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md":"e59e11e909bfd0a38c7298c5a6f909a6cd7afa49"
};
for (const [p,s] of Object.entries(predecessorPins)) {
  eq(blob(base,p),s,`A06A_BASE_BLOB_PIN_MISMATCH:${p}`);
  eq(blob("HEAD",p),s,`A06A_PREDECESSOR_MUTATED:${p}`);
}
eq(blob("HEAD",authorityPath),"c7788d525c56ab83117afbeeec85f2b9f990534f","A06A_AUTHORITY_BLOB_REQUIRED");
eq(blob("HEAD",workflowPath),"c7fb32f72788e3876eb6e004c12e35f2fcbd5ef1","A06A_WORKFLOW_BLOB_REQUIRED");

const amendment = fs.readFileSync("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-06-FORMAL-WINDOW-EPOCH-REBASE-AUTHORITY.md","utf8");
for (const m of [
  "candidate O00 = first exact UTC hourly boundary at or after",
  "Amendment-06 effectiveness time + 36 hours",
  "EA5E Formal Authority V3 effective deadline = O00 - 12 hours",
  "A06A — Future Epoch Selection Freeze",
  "S6-A06A-FUTURE-FORMAL-WINDOW-EPOCH-SELECTION-FREEZE"
]) if (!amendment.includes(m)) fail(`A06A_AMENDMENT06_MARKER_MISSING:${m}`);

const a = json(authorityPath);
eq(a.base_main_sha,base,"A06A_AUTHORITY_BASE_REQUIRED");
eq(a.frontier_id,"S6-A06A-FUTURE-FORMAL-WINDOW-EPOCH-SELECTION-FREEZE","A06A_FRONTIER_REQUIRED");
eq(a.record_status,"A06A_EPOCH_SELECTION_CANDIDATE_NOT_EFFECTIVE","A06A_RECORD_STATUS_REQUIRED");
eq(a.amendment_06_effectiveness.pr_number,3028,"A06A_AMENDMENT06_PR_REQUIRED");
eq(a.amendment_06_effectiveness.merged_head_sha,"72e5a86ca3b52f214537e762456d9e59bf8401ba","A06A_AMENDMENT06_HEAD_REQUIRED");
eq(a.amendment_06_effectiveness.merge_commit_sha,base,"A06A_AMENDMENT06_MERGE_REQUIRED");
eq(a.amendment_06_effectiveness.merged_at_utc,"2026-08-10T04:51:14.000Z","A06A_AMENDMENT06_TIME_REQUIRED");
eq(a.amendment_06_effectiveness.focused_workflow_run_id,31356234656,"A06A_AMENDMENT06_RUN_REQUIRED");
eq(a.amendment_06_effectiveness.focused_artifact_id,9050722266,"A06A_AMENDMENT06_ARTIFACT_REQUIRED");

const s = a.selection_rule;
eq(s.minimum_lead_hours,36,"A06A_MIN_LEAD_REQUIRED");
eq(s.candidate_rule,"FIRST_EXACT_UTC_HOUR_AT_OR_AFTER_AMENDMENT06_EFFECTIVENESS_PLUS_36H","A06A_SELECTION_RULE_REQUIRED");
eq(s.amendment_06_effectiveness_plus_36h,"2026-08-11T16:51:14.000Z","A06A_PLUS36_REQUIRED");
eq(s.selected_o00,"2026-08-11T17:00:00.000Z","A06A_O00_REQUIRED");
eq(s.selected_o23,"2026-08-12T16:00:00.000Z","A06A_O23_REQUIRED");
eq(s.actual_lead_seconds,130126,"A06A_ACTUAL_LEAD_REQUIRED");
eq(s.ea5e_v3_readiness_deadline,"2026-08-11T05:00:00.000Z","A06A_READINESS_DEADLINE_REQUIRED");
eq(s.seconds_from_amendment06_effectiveness_to_readiness_deadline,86926,"A06A_DEADLINE_LEAD_REQUIRED");
eq(s.selected_epoch_id,"mcft_cap09_external_formal_window_epoch_20260811t170000z_v1","A06A_EPOCH_ID_REQUIRED");
no(s.overlaps_expired_original_epoch,"A06A_EXPIRED_EPOCH_OVERLAP_FORBIDDEN");

const anchor = a.existing_a0_parent_anchor;
eq(anchor.logical_time,"2026-08-09T21:00:00.000Z","A06A_A0_TIME_REQUIRED");
eq(anchor.runtime_config_ref,"external_formal_runtime_config_7284202e3b0bdae6d32f4814","A06A_A0_REF_REQUIRED");
eq(anchor.runtime_config_hash,"sha256:d6b721b0eb74b1fbd4168d0bc1d551c0c95bf60fef67c8fe4cd9b77ad60930f8","A06A_A0_HASH_REQUIRED");
yes(anchor.remains_current_prewindow_state_authority,"A06A_A0_STATE_AUTHORITY_REQUIRED");

const crop = a.crop_context_derivation;
eq(crop.backward_stability_hours,6,"A06A_BACKWARD_GUARD_REQUIRED");
eq(crop.forward_transition_guard_hours,30,"A06A_FORWARD_GUARD_REQUIRED");
yes(crop.all_24_slots_conservative_consensus,"A06A_24_SLOT_CONSENSUS_REQUIRED");
eq(crop.all_24_slots_stage_code,"MID","A06A_ALL_MID_REQUIRED");
eq(crop.minimum_forward_guard_clearance_hours_across_window,6,"A06A_MIN_CLEARANCE_REQUIRED");
no(crop.future_observations_used,"A06A_FUTURE_OBSERVATIONS_FORBIDDEN");
no(crop.future_phenocam_observations_used,"A06A_FUTURE_PHENOCAM_FORBIDDEN");
no(crop.single_region_best_fit_used,"A06A_SINGLE_REGION_FIT_FORBIDDEN");
no(crop.cap08_synthetic_stage_dates_used,"A06A_CAP08_STAGE_DATES_FORBIDDEN");

if (!Array.isArray(a.slot_contexts) || a.slot_contexts.length!==24) fail("A06A_EXACT_24_SLOT_CONTEXTS_REQUIRED");
const hashes = new Set();
for (let i=0;i<24;i+=1) {
  const item=a.slot_contexts[i];
  const id=`O${String(i).padStart(2,"0")}`;
  const time=new Date(Date.parse("2026-08-11T17:00:00.000Z")+i*3600000).toISOString();
  eq(item.slot_id,id,`A06A_SLOT_ID:${i}`);
  eq(item.logical_time,time,`A06A_SLOT_TIME:${i}`);
  eq(item.crop_stage_code,"MID",`A06A_SLOT_STAGE:${i}`);
  if (!/^sha256:[0-9a-f]{64}$/.test(item.crop_stage_context_hash)) fail(`A06A_SLOT_CONTEXT_HASH_INVALID:${i}`);
  eq(item.minimum_hours_to_next_stage_after_forward_guard,29-i,`A06A_SLOT_CLEARANCE:${i}`);
  hashes.add(item.crop_stage_context_hash);
}
eq(hashes.size,24,"A06A_SLOT_CONTEXT_HASHES_MUST_BE_DISTINCT");

for (const [k,v] of Object.entries(a.selection_side_effect_boundary)) eq(v,0,`A06A_SELECTION_SIDE_EFFECT_ZERO_REQUIRED:${k}`);
const effect=a.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main;
yes(effect.a06a_future_formal_window_epoch_selection_effective,"A06A_EFFECT_REQUIRED");
eq(effect.selected_epoch_id,s.selected_epoch_id,"A06A_EFFECT_EPOCH_REQUIRED");
eq(effect.selected_o00,s.selected_o00,"A06A_EFFECT_O00_REQUIRED");
eq(effect.selected_o23,s.selected_o23,"A06A_EFFECT_O23_REQUIRED");
eq(effect.ea5e_v3_readiness_deadline,s.ea5e_v3_readiness_deadline,"A06A_EFFECT_DEADLINE_REQUIRED");
yes(effect.a06b_rebased_config_builder_qualification_authorized,"A06A_A06B_AUTH_REQUIRED");
yes(effect.ea5d_complete_remains_true,"A06A_EA5D_REQUIRED");
yes(effect.ea5e_authorized_remains_true,"A06A_EA5E_AUTH_REQUIRED");
no(effect.ea5e_complete,"A06A_EA5E_COMPLETE_PREMATURE");
no(effect.external_package_formal_eligible,"A06A_FORMAL_ELIGIBILITY_PREMATURE");
no(effect.formal_o00_start_authorized,"A06A_O00_PREMATURE");
no(effect.formal_window_started,"A06A_WINDOW_PREMATURE");
eq(effect.formal_execution_count,"0/24","A06A_FORMAL_EXECUTION_COUNT_REQUIRED");
no(effect.mcft_cap09_completed,"A06A_CAP09_PREMATURE");
eq(a.next_legal_successor_if_effective,"S6-A06B-REBASED-CONFIG-BUILDER-QUALIFICATION","A06A_NEXT_FRONTIER_REQUIRED");

const w=fs.readFileSync(workflowPath,"utf8");
if (w.includes("pull_request_target")) fail("A06A_PULL_REQUEST_TARGET_FORBIDDEN");
for (const m of [
  "A06A_FORMAL_WINDOW_MUST_REMAIN_DISABLED",
  "2026-08-10T04:51:14Z",
  "31356234656",
  "9050722266",
  "2026-08-11T17:00:00.000Z",
  "2026-08-12T16:00:00.000Z",
  "2026-08-11T05:00:00.000Z",
  "A06A_STAGE_TRANSITION_RISK",
  "A06A_CROP_STAGE_NO_CONSERVATIVE_CONSENSUS",
  "minimumClearance!==6",
  "BEGIN TRANSACTION READ ONLY",
  "twin_shadow_online_scheduler_slot_v1",
  "twin_shadow_online_scheduler_cursor_v1"
]) if (!w.includes(m)) fail(`A06A_WORKFLOW_MARKER_MISSING:${m}`);
if (/\b(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|TRUNCATE\s+|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i.test(w)) fail("A06A_DATABASE_WRITE_SQL_FORBIDDEN");
if (w.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID") || w.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY")) fail("A06A_RAW_CREDENTIALS_FORBIDDEN");

const out={schema_version:"geox_mcft_cap09_a06a_governance_result_v1",status:"PASS",base_main_sha:base,subject_head_sha:git("rev-parse","HEAD"),exact_changed_file_count:changed.length,predecessor_blobs_verified_unchanged:true,selected_epoch_id:s.selected_epoch_id,selected_o00:s.selected_o00,selected_o23:s.selected_o23,readiness_deadline:s.ea5e_v3_readiness_deadline,slot_context_count:24,whole_window_crop_context_viability_required:true,a06a_effective_after_merge:true,a06b_authorized_after_merge:true,ea5e_complete:false,formal_o00_start_authorized:false,formal_window_started:false,formal_execution_count:"0/24",mcft_cap09_completed:false};
fs.mkdirSync("acceptance-output",{recursive:true});
fs.writeFileSync("acceptance-output/MCFT_CAP_09_A06A_GOVERNANCE_RESULT.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify(out,null,2));
