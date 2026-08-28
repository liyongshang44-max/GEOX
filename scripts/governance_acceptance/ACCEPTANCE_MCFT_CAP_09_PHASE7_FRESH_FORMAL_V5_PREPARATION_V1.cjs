#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const cp=require("node:child_process");

const AUTHORITY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PHASE7-FRESH-FORMAL-V5-PREPARATION-AUTHORITY-V1.json";
const WORKFLOW=".github/workflows/mcft-cap-09-t4r1-formal-store-provision.yml";
const PHASE6="48ceafe7c6e7d3d57a1dc17411fb4bf673486333";

function req(ok,code,detail){if(!ok)throw new Error(detail===undefined?code:code+":"+JSON.stringify(detail));}
function git(args){return cp.execFileSync("git",args,{encoding:"utf8"}).trim();}
function obj(v,code){req(v&&typeof v==="object"&&!Array.isArray(v),code);return v;}

const a=JSON.parse(fs.readFileSync(AUTHORITY,"utf8"));
req(a.schema_version==="geox_mcft_cap09_phase7_fresh_formal_v5_preparation_authority_v1","PHASE7_PREP_SCHEMA");
req(a.status==="PHASE7_PREPARATION_CANDIDATE_PHASE6_ACCEPTED_PRODUCTION_EFFECT_FORBIDDEN","PHASE7_PREP_STATUS");

const p=obj(a.exact_phase6_predecessor,"PHASE7_PREP_PHASE6_REQUIRED");
req(p.head_sha===PHASE6,"PHASE7_PREP_PHASE6_HEAD");
req(p.phase6_runtime_independence?.run_id===33146391000,"PHASE7_PREP_PHASE6_RUNTIME_RUN");
req(p.phase6_runtime_independence?.artifact_id===9676455831,"PHASE7_PREP_PHASE6_RUNTIME_ARTIFACT");
req(p.phase6_runtime_independence?.artifact_digest==="sha256:9a3a22b8b844fc1538d4a6986a9d3477b895208b1e88cdf13106f0f0dbf463d7","PHASE7_PREP_PHASE6_RUNTIME_DIGEST");
req(p.phase6_runtime_independence?.current_head_full_live_24t_claimed===false,"PHASE7_PREP_NO_FALSE_FULL_LIVE");
req(p.phase6_runtime_independence?.live_evidence_ingress_fresh===true,"PHASE7_PREP_FRESH_EVIDENCE_REQUIRED");
req(p.phase6_runtime_independence?.github_artifact_rehydration_count===0,"PHASE7_PREP_NO_RUNTIME_ARTIFACT_REHYDRATION");
req(p.phase6_owner_retirement?.active_retired_owner_or_trigger_count===0&&p.phase6_owner_retirement?.retired_actions_write_count===0,"PHASE7_PREP_OWNER_RETIREMENT");
req(Array.isArray(p.phase6_owner_retirement?.violations)&&p.phase6_owner_retirement.violations.length===0,"PHASE7_PREP_OWNER_VIOLATIONS");
req(p.central_control_plane?.blocker_count===0&&Array.isArray(p.central_control_plane?.blockers)&&p.central_control_plane.blockers.length===0,"PHASE7_PREP_BLOCKERS");
req(p.exact_head_workflow_summary?.total===24&&p.exact_head_workflow_summary?.success===24&&p.exact_head_workflow_summary?.failure===0,"PHASE7_PREP_EXACT_HEAD_WORKFLOWS");

const v=obj(a.immutable_v13_schema_anchor,"PHASE7_PREP_V13_ANCHOR");
req(v.subject_sha==="3bbf096ee5cb73e8e0e0251dc400733d6cab501f","PHASE7_PREP_V13_SUBJECT");
req(v.run_id===32881283336&&v.artifact_id===9575878791,"PHASE7_PREP_V13_ARTIFACT");
req(v.artifact_digest==="sha256:04630f1f869ba99e9be40d55e24967e6e26671e80d3459fb9b28ce0694aaeb40","PHASE7_PREP_V13_DIGEST");
req(v.predecessor_public_table_count===26&&v.v13_public_table_count===29,"PHASE7_PREP_V13_TABLE_COUNT");
req(v.fingerprints?.column_md5==="c61154d4439a82efc256bed461386781","PHASE7_PREP_COLUMN_FP");
req(v.fingerprints?.constraint_md5==="67a588bc5b8c3d213b03aa1dbfa4ff2b","PHASE7_PREP_CONSTRAINT_FP");
req(v.fingerprints?.index_md5==="306e26a56d419c4e08fac0912ccfdda8","PHASE7_PREP_INDEX_FP");

for(const d of a.bound_repository_dependencies||[]){
  req(typeof d.path==="string"&&/^[0-9a-f]{40}$/.test(String(d.blob_sha||"")),"PHASE7_PREP_DEPENDENCY_SHAPE",d);
  const actual=git(["rev-parse","HEAD:"+d.path]);
  req(actual===d.blob_sha,"PHASE7_PREP_DEPENDENCY_BLOB_DRIFT",{path:d.path,expected:d.blob_sha,actual});
}

const s=obj(a.future_store_plan,"PHASE7_PREP_STORE_PLAN");
req(s.creation_authorized_by_this_authority===false&&s.merge_required_before_remote_provision===true&&s.capacity_preflight_required_before_remote_provision===true,"PHASE7_PREP_REMOTE_PROVISION_BOUNDARY");
req(s.failed_v4_reuse_forbidden===true&&s.failed_v4_data_clone_forbidden===true&&s.previous_v12_qualification_reuse_forbidden===true,"PHASE7_PREP_FAILED_HISTORY_REUSE");
req(s.required_public_table_count===29&&s.canonical_facts_schema_mutation_authorized===false&&s.fingerprints_must_match_immutable_v13_anchor===true,"PHASE7_PREP_SCHEMA_PLAN");
const names=new Map((s.stores||[]).map(x=>[x.role,x.database_name]));
req(names.get("V13_QUALIFICATION")==="geox_mcft_cap09_s6_accel24t_am19_v13","PHASE7_PREP_V13_DB");
req(names.get("V13_BLOCKED_QUALIFICATION")==="geox_mcft_cap09_s6_accel24t_am19_blocked_v13","PHASE7_PREP_BLOCKED_DB");
req(names.get("FORMAL_V5")==="geox_mcft_cap09_s6_formal_t4r1_24h_v5","PHASE7_PREP_FORMAL_V5_DB");

const b=obj(a.activation_boundary,"PHASE7_PREP_BOUNDARY");
for(const k of ["phase7_remote_provision_authorized","post_merge_v13_qualification_executed","timing_budget_qualified","graduation_gate_open","formal_v5_store_provisioned","formal_v5_epoch_selected","formal_v5_armed","formal_v5_a0_bootstrapped","formal_v5_o00_started","real_wall_clock_o00_o23_started","mcft_cap09_completed"])req(b[k]===false,"PHASE7_PREP_NONCLAIM:"+k);
req(b.phase7_preparation_started===true,"PHASE7_PREP_STARTED");

const wf=fs.readFileSync(WORKFLOW,"utf8");
req(!/^\s*schedule:/m.test(wf),"PHASE7_PREP_SCHEDULE_FORBIDDEN");
req(!/^\s*workflow_run:/m.test(wf),"PHASE7_PREP_WORKFLOW_RUN_FORBIDDEN");
req(!/^\s*workflow_dispatch:/m.test(wf),"PHASE7_PREP_DISPATCH_FORBIDDEN");
req(!/secrets\./.test(wf),"PHASE7_PREP_SECRET_FORBIDDEN");
req(!/GEOX_MCFT_CAP09_T4R1_S6_DATABASE_URL/.test(wf),"PHASE7_PREP_REMOTE_DB_SECRET_FORBIDDEN");
req(!/FORMAL_RAW_S3_SECRET_ACCESS_KEY/.test(wf),"PHASE7_PREP_RAW_SECRET_FORBIDDEN");
req(!/actions:\s*write/.test(wf),"PHASE7_PREP_ACTIONS_WRITE_FORBIDDEN");

const result={
  schema_version:"geox_mcft_cap09_phase7_fresh_formal_v5_preparation_governance_v1",
  status:"PASS",
  subject_sha:git(["rev-parse","HEAD"]),
  phase6_predecessor_sha:PHASE6,
  bound_dependency_count:(a.bound_repository_dependencies||[]).length,
  v13_schema_anchor_verified:true,
  fresh_v5_store_plan_verified:true,
  remote_database_provision_count:0,
  provider_request_count:0,
  runtime_database_write_count:0,
  formal_v5_arm:false,
  formal_v5_o00_started:false,
  production_effect:false,
  mcft_cap09_completed:false
};
fs.mkdirSync("acceptance-output",{recursive:true});
fs.writeFileSync("acceptance-output/MCFT_CAP_09_PHASE7_FRESH_FORMAL_V5_PREPARATION_GOVERNANCE.json",JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result));
