#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const fail = (m) => { throw new Error(m); };
const eq = (a,e,c) => { if (a !== e) fail(`${c}: expected=${JSON.stringify(e)} actual=${JSON.stringify(a)}`); };
const yes = (v,c) => eq(v,true,c);
const no = (v,c) => eq(v,false,c);
const git = (...a) => execFileSync("git", a, { encoding:"utf8" }).trim();
const blob = (ref,p) => git("rev-parse", `${ref}:${p}`);
const json = (p) => JSON.parse(fs.readFileSync(p,"utf8"));

const base = process.env.MCFT_BASE_SHA;
eq(base,"92f22f74304443ca3a16417e76581e4605252a7f","EA5D3_EXACT_BASE_REQUIRED");
const authorityPath = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5D3-EA5D-CLOSURE-AUTHORITY-V1.json";
const workflowPath = ".github/workflows/mcft-cap-09-ea5d3-ea5d-closure.yml";
const gatePath = "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5D3_EA5D_CLOSURE.cjs";
const changed = git("diff","--name-only",`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
eq(JSON.stringify(changed),JSON.stringify([authorityPath,workflowPath,gatePath].sort()),"EA5D3_EXACT_THREE_FILE_BOUNDARY_REQUIRED");

const pins = {
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-TASK.md":"39f6a09273c30088a7ea264cfa94ff930ea5518e",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-05-EXTERNAL-FORMAL-RUNTIME-AUTHORITY-PROFILE.md":"7a92c17f7ba32aae52667de9c21db62bfd2ba70b",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5C3-EA5C-CLOSURE-AUTHORITY-V1.json":"f795a295dc241f565a595589eb94706d096f26ca",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5D1-EXTERNAL-BOOTSTRAP-PERSISTENCE-QUALIFICATION-V1.json":"8bf52b4a18874f9201340528b727d7f74742b638",
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5D2-FORMAL-BOOTSTRAP-LIVE-PERSISTENCE-V1.json":"53136ebc4d884f3e20de033bd0ae0ae413e9be2b",
  "apps/server/src/domain/twin_runtime/external_formal_bootstrap_authority_bundle_v1.ts":"1671b13df81cba53f966a6f06765198d160601d7",
  "apps/server/src/runtime/twin_runtime/external_formal_bootstrap_persistence_service_v1.ts":"6c94bef139f260ef61c87f751a2c627b83e58977"
};
for (const [p,s] of Object.entries(pins)) { eq(blob(base,p),s,`EA5D3_BASE_PIN:${p}`); eq(blob("HEAD",p),s,`EA5D3_PREDECESSOR_MUTATED:${p}`); }
eq(blob("HEAD",authorityPath),"ad6708fb4fa884a2c61c3401338a7a3eb5cb34d0","EA5D3_AUTHORITY_BLOB_REQUIRED");

const d2 = json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5D2-FORMAL-BOOTSTRAP-LIVE-PERSISTENCE-V1.json");
yes(d2.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.ea5d2_formal_bootstrap_live_persistence_effective,"EA5D3_EA5D2_EFFECT_REQUIRED");
yes(d2.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.formal_neon_bootstrap_persisted,"EA5D3_BOOTSTRAP_REQUIRED");
yes(d2.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.formal_24_config_chain_persisted,"EA5D3_CHAIN_REQUIRED");
no(d2.effect_if_exact_head_proof_passes_and_candidate_merges_to_protected_main.ea5d_complete,"EA5D3_CLOSURE_REQUIRED");
eq(d2.next_legal_successor_if_effective,"S6-EA5D3-EA5D-CLOSURE-AND-EA5E-AUTHORIZATION","EA5D3_FRONTIER_AUTHORITY_REQUIRED");

const a = json(authorityPath);
eq(a.base_main_sha,base,"EA5D3_AUTHORITY_BASE_REQUIRED");
eq(a.frontier_id,"S6-EA5D3-EA5D-CLOSURE-AND-EA5E-AUTHORIZATION","EA5D3_FRONTIER_REQUIRED");
eq(a.ea5d2_merge_authority.pr_number,3025,"EA5D3_PR_REQUIRED");
eq(a.ea5d2_merge_authority.merged_head_sha,"214c1ff2b3f5f8b2dccc1073a87add477632a542","EA5D3_MERGED_HEAD_REQUIRED");
eq(a.ea5d2_merge_authority.merge_commit_sha,base,"EA5D3_MERGE_REQUIRED");
const first = a.formal_proof_chain.first_live_bootstrap_write;
eq(first.workflow_run_id,31334304326,"EA5D3_FIRST_RUN_REQUIRED");
eq(first.artifact_id,9044245246,"EA5D3_FIRST_ARTIFACT_REQUIRED");
eq(first.required_execution_mode,"FIRST_FORMAL_BOOTSTRAP_AFTER_FRESH_COLLECTION","EA5D3_FIRST_MODE_REQUIRED");
eq(first.required_fresh_external_evidence_write_count,1,"EA5D3_FIRST_EVIDENCE_WRITE_REQUIRED");
eq(first.required_canonical_bootstrap_write_count,34,"EA5D3_FIRST_BOOTSTRAP_WRITE_REQUIRED");
const final = a.formal_proof_chain.final_exact_head_reverification;
eq(final.workflow_run_id,31350361419,"EA5D3_FINAL_RUN_REQUIRED");
eq(final.workflow_head_sha,"214c1ff2b3f5f8b2dccc1073a87add477632a542","EA5D3_FINAL_HEAD_REQUIRED");
eq(final.artifact_id,9048721860,"EA5D3_FINAL_ARTIFACT_REQUIRED");
eq(final.required_execution_mode,"EXISTING_FORMAL_BOOTSTRAP_REVERIFIED","EA5D3_FINAL_MODE_REQUIRED");
eq(final.required_fresh_external_evidence_write_count,0,"EA5D3_FINAL_EVIDENCE_ZERO_WRITE_REQUIRED");
eq(final.required_canonical_bootstrap_write_count,0,"EA5D3_FINAL_BOOTSTRAP_ZERO_WRITE_REQUIRED");

const i = a.formal_database_closure_invariants;
eq(i.exact_scope_fact_count,36,"EA5D3_SCOPE_FACT_COUNT_REQUIRED");
eq(i.exact_external_soil_evidence_fact_count,2,"EA5D3_SOIL_FACT_COUNT_REQUIRED");
eq(i.exact_canonical_twin_fact_count,34,"EA5D3_CANONICAL_COUNT_REQUIRED");
eq(i.exact_runtime_config_count,25,"EA5D3_RUNTIME_CONFIG_COUNT_REQUIRED");
eq(i.exact_hourly_runtime_config_count,24,"EA5D3_HOURLY_CONFIG_COUNT_REQUIRED");
eq(i.scheduler_slot_count,0,"EA5D3_ZERO_SLOTS_REQUIRED");
eq(i.scheduler_cursor_count,0,"EA5D3_ZERO_CURSOR_REQUIRED");
eq(i.config_selection_mode,"EXPLICIT_REF_HASH_PIN_ONLY","EA5D3_PIN_MODE_REQUIRED");
eq(i.runtime_mode,"SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY","EA5D3_RUNTIME_MODE_REQUIRED");

const e = a.success_effect_if_merged_to_protected_main;
yes(e.ea5d_complete,"EA5D3_EA5D_COMPLETE_REQUIRED");
yes(e.ea5e_authorized,"EA5D3_EA5E_AUTH_REQUIRED");
yes(e.ea5e_post_bootstrap_preflight_candidate_authorized,"EA5D3_PREFLIGHT_AUTH_REQUIRED");
yes(e.ea5e_formal_window_input_manifest_candidate_authorized,"EA5D3_MANIFEST_AUTH_REQUIRED");
yes(e.ea5e_collector_runtime_schedule_readiness_candidate_authorized,"EA5D3_SCHEDULE_AUTH_REQUIRED");
yes(e.ea5e_formal_authority_v3_candidate_authorized,"EA5D3_V3_AUTH_REQUIRED");
no(e.ea5e_complete,"EA5D3_EA5E_COMPLETE_PREMATURE");
no(e.external_package_formal_eligible,"EA5D3_FORMAL_ELIGIBILITY_PREMATURE");
no(e.formal_o00_start_authorized,"EA5D3_O00_PREMATURE");
no(e.formal_window_started,"EA5D3_WINDOW_PREMATURE");
no(e.mcft_cap09_completed,"EA5D3_CAP09_PREMATURE");
for (const [k,v] of Object.entries(a.closure_side_effect_boundary)) eq(v,0,`EA5D3_SIDE_EFFECT_ZERO_REQUIRED:${k}`);
eq(a.next_legal_successor_if_effective,"S6-EA5E-POST-BOOTSTRAP-PREFLIGHT-MANIFEST-SCHEDULE-READINESS-AND-FORMAL-AUTHORITY-V3","EA5D3_NEXT_FRONTIER_REQUIRED");

const w = fs.readFileSync(workflowPath,"utf8");
if (w.includes("pull_request_target")) fail("EA5D3_PULL_REQUEST_TARGET_FORBIDDEN");
for (const m of ["GEOX_MCFT_CAP09_S6_DATABASE_URL: ${{ secrets.GEOX_MCFT_CAP09_S6_DATABASE_URL }}","31334304326","9044245246","31350361419","9048721860","FIRST_FORMAL_BOOTSTRAP_AFTER_FRESH_COLLECTION","EXISTING_FORMAL_BOOTSTRAP_REVERIFIED","twin_shadow_online_scheduler_slot_v1","twin_shadow_online_scheduler_cursor_v1","EXPLICIT_REF_HASH_PIN_ONLY","SHADOW_ONLINE_FORMAL_QUALIFICATION_ONLY","formal_o00_start_authorized !== false"]) if (!w.includes(m)) fail(`EA5D3_WORKFLOW_MARKER_MISSING:${m}`);
if (/\b(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i.test(w)) fail("EA5D3_DATABASE_WRITE_SQL_FORBIDDEN");
if (w.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID") || w.includes("GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY")) fail("EA5D3_RAW_CREDENTIALS_FORBIDDEN");

const out = {schema_version:"geox_mcft_cap09_ea5d3_ea5d_closure_governance_result_v1",status:"PASS",base_main_sha:base,subject_head_sha:git("rev-parse","HEAD"),exact_changed_file_count:changed.length,predecessor_blobs_verified_unchanged:true,ea5d2_merge_and_proof_chain_pinned:true,closure_database_write_count:0,closure_raw_object_write_count:0,closure_provider_request_count:0,ea5d_complete_after_effectiveness:true,ea5e_authorized_after_effectiveness:true,ea5e_complete:false,external_package_formal_eligible:false,formal_o00_start_authorized:false,formal_window_started:false,mcft_cap09_completed:false};
fs.mkdirSync("acceptance-output",{recursive:true});
fs.writeFileSync("acceptance-output/MCFT_CAP_09_EA5D3_EA5D_CLOSURE_GOVERNANCE_RESULT.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify(out,null,2));
