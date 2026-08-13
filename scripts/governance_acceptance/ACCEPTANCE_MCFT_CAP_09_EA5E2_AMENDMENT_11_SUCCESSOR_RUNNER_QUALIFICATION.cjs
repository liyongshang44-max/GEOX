#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const OUT="acceptance-output/MCFT_CAP_09_EA5E2_AMENDMENT_11_SUCCESSOR_RUNNER_QUALIFICATION.json";
const PREFLIGHT="acceptance-output/MCFT_CAP_09_EA5E2_AMENDMENT_11_SUCCESSOR_PREFLIGHT.json";
const DEP="acceptance-output/MCFT_CAP_09_EA5E2_RUNTIME_DEPENDENCY_GRAPH.json";
const HIST_AUTH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-OPERATIONAL-ACTIVATION-RUNNER-QUALIFICATION-V1.json";
const HIST_GATE="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_OPERATIONAL_ACTIVATION_RUNNER_QUALIFICATION.cjs";
const A11="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AMENDMENT-11-PROVIDER-AVAILABILITY-WATERMARK-AUTHORITY.md";
const DB="apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.ts";
const PRE_GATE="scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA5E2_AMENDMENT_11_SUCCESSOR_PREFLIGHT.cjs";
const ROLLING_PROOF="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ROLLING-PREBOUNDARY-LIVE-PROOF-V1.json";
const WORKFLOW=".github/workflows/mcft-cap-09-ea5e2-successor-runner-qualification.yml";
const CRITICAL=[A11,DB,PRE_GATE,ROLLING_PROOF,WORKFLOW,HIST_AUTH,HIST_GATE].sort();
function git(...args){return execFileSync("git",args,{encoding:"utf8"}).trim();}
function write(value){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(value,null,2)}\n`);console.log(JSON.stringify(value));}

try {
  const head=git("rev-parse","HEAD");
  assert.equal(git("rev-parse",`HEAD:${HIST_AUTH}`),"4f0df5f9fe896bf26eda3d673e3153941f59c2e7","HISTORICAL_AUTHORITY_MUTATED");
  assert.equal(git("rev-parse",`HEAD:${HIST_GATE}`),"af6d0fbc208ad37f7fd00084ac4636fd2c08fac6","HISTORICAL_GATE_MUTATED");
  const pre=JSON.parse(fs.readFileSync(PREFLIGHT,"utf8"));
  assert.equal(pre.status,"PASS","AMENDMENT11_SUCCESSOR_STATIC_PREFLIGHT_REQUIRED");
  assert.equal(pre.subject_sha,head,"AMENDMENT11_SUCCESSOR_PREFLIGHT_EXACT_HEAD_REQUIRED");
  assert.equal(pre.active_temporal_authority,"PROVIDER_AVAILABILITY_WATERMARK_V1");
  assert.equal(pre.kbs_provider_publication_cadence,"daily_batch");
  assert.equal(pre.kbs_le_6h_delayed_admission_authority,false);
  assert.equal(pre.fixed_t_plus_432_authority,false);
  assert.equal(pre.fixed_7h_scheduler_authority,false);
  assert.equal(pre.crop_authority_effect,"NONE");
  assert.equal(pre.activation_readiness,"BLOCKED","SUCCESSOR_MUST_NOT_PREMATURELY_AUTHORIZE_LIVE");

  const rolling=pre.rolling_preboundary_capture;
  assert(rolling && typeof rolling==="object","ROLLING_CAPTURE_PROFILE_REQUIRED");
  assert.equal(rolling.present,true,"ROLLING_CAPTURE_IMMUTABLE_PROOF_REQUIRED");
  assert.equal(rolling.qualified,true,"ROLLING_CAPTURE_IMMUTABLE_PROOF_MUST_QUALIFY");
  assert.match(String(rolling.producer_subject_sha||""),/^[0-9a-f]{40}$/,"ROLLING_CAPTURE_PRODUCER_SHA_REQUIRED");
  assert(Number.isInteger(rolling.workflow_run_id) && rolling.workflow_run_id>0,"ROLLING_CAPTURE_RUN_ID_REQUIRED");
  assert(Number.isInteger(rolling.artifact_id) && rolling.artifact_id>0,"ROLLING_CAPTURE_ARTIFACT_ID_REQUIRED");
  assert.equal(rolling.raw_ref_count,2,"ROLLING_CAPTURE_TWO_PRIVATE_RAW_REFS_REQUIRED");

  const blockerCodes=pre.readiness_blockers.map((x)=>x.code);
  assert(!blockerCodes.includes("ROLLING_PREBOUNDARY_QUALIFICATION_CAPTURE_NOT_IMPLEMENTED"),"STALE_ROLLING_NOT_IMPLEMENTED_BLOCKER_FORBIDDEN");
  assert(!blockerCodes.includes("ROLLING_PREBOUNDARY_QUALIFICATION_CAPTURE_NOT_PROVEN"),"QUALIFIED_ROLLING_PROOF_MUST_CLOSE_CAPTURE_BLOCKER");
  assert(blockerCodes.includes("CURRENT_CROP_AUTHORITY_HAS_NO_FUTURE_LEGAL_TARGET"),"CROP_AUTHORITY_BLOCKER_MUST_REMAIN_INDEPENDENT");
  assert(blockerCodes.includes("EVIDENCE_SNAPSHOT_CALLSITE_MIGRATION_NOT_COMPLETE"),"EVIDENCE_SNAPSHOT_CALLSITE_BLOCKER_MUST_REMAIN_UNTIL_MIGRATED");

  const dep=JSON.parse(fs.readFileSync(DEP,"utf8"));
  assert.equal(dep.status,"PASS","RUNTIME_DEPENDENCY_GRAPH_REQUIRED");
  const blobs=Object.fromEntries(CRITICAL.map((file)=>[file,git("rev-parse",`HEAD:${file}`)]));
  const digest=`sha256:${crypto.createHash("sha256").update(JSON.stringify(blobs)).digest("hex")}`;
  write({
    schema_version:"geox_mcft_cap09_ea5e2_amendment_11_successor_runner_qualification_v2",
    status:"PASS",subject_sha:head,qualification_reexecuted:true,
    active_temporal_authority:"PROVIDER_AVAILABILITY_WATERMARK_V1",
    historical_fixed_lag_proof_preserved:true,
    amendment_11_static_conformance:true,
    rolling_preboundary_capture_proven:true,
    rolling_preboundary_producer_subject_sha:rolling.producer_subject_sha,
    rolling_preboundary_workflow_run_id:rolling.workflow_run_id,
    rolling_preboundary_artifact_id:rolling.artifact_id,
    activation_readiness:"BLOCKED",
    readiness_blockers:pre.readiness_blockers,
    runtime_dependency_graph_sha256:dep.expected_dependency_graph_sha256,
    runtime_dependency_graph_count:dep.runtime_dependency_graph_count,
    exact_head_critical_blob_digest:digest,
    exact_head_critical_blobs:blobs,
    protected_main_live_dispatch_authorized:false,
    database_write_count:0,provider_request_count:0,formal_window_started:false,
    formal_execution_count:"0/24",ea5e2_operational_activation_qualified:false
  });
} catch(error){
  write({schema_version:"geox_mcft_cap09_ea5e2_amendment_11_successor_runner_qualification_v2",status:"FAIL",error:String(error?.message||error),protected_main_live_dispatch_authorized:false,database_write_count:0,formal_window_started:false});process.exitCode=1;
}
