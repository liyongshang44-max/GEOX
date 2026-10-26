#!/usr/bin/env node
"use strict";
// Exact PR #3735 postmerge continuation of the completed owner-PR #3734.
// Never replays #3734's GitHub event, produces material, or confers Permit.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const ROOT = path.resolve(__dirname, "../..");
const MAIN = "b2e846d4b10a5d124d6060998ef1c9a2895391e4";
const SOURCE = "6d8fb108655d9ada4b44cc7e4709a1c2ac5832b0";
const GOV = "bc367f2ead25b9f28dfd61b1aed394fd864d73b2";
const MERGE = "876cdcff39fe9c252b591236afd3b9bcdf27a4f4";
const QCP = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const BIND = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-TWO-PARENT-SOURCE-BINDING-V1.json";
const BUNDLE = "docs/digital_twin/mcft/cap_09/evidence/MCFT-CAP09-DA9-SIGNED-V2-SIX-OPERATOR-REVIEW-20261025.json";
const REVIEW = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-PHASE3-FROZEN-V13-GOVERNANCE-REVIEW-V1.json";
const OWNER = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-OWNER-DIRECTED-SOURCE-ADMISSION-V1.json";
const COMPOSER = "scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts";
const CHECK = "DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING";
const RESOLVER = "DA9_POSTMERGE_WINDOWS_READONLY_EXACT_PATHS_V1";
const SCRIPT = "scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_POSTMERGE_INTEGRATION_PRESERVATION_V1.cjs";
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const git = (...args) => cp.execFileSync("git", args, {cwd: ROOT, encoding:"utf8", timeout:30000, maxBuffer:16*1024*1024}).trim();
const blob = (ref,p) => git("rev-parse", ref+":"+p);
const ancestor = (base,ref) => cp.spawnSync("git",["merge-base","--is-ancestor",base,ref],{cwd:ROOT,stdio:"ignore"}).status===0;
const equal = (a,b,reason) => assert.deepEqual(a,b,reason);
function main() {
  assert.equal(process.env.GITHUB_ACTIONS,"true","HOLD_REAL_GITHUB_ACTIONS_EVENT_REQUIRED");
  assert.equal(process.env.GITHUB_EVENT_NAME,"pull_request","HOLD_REAL_PR_EVENT_REQUIRED");
  assert.equal(process.env.GITHUB_REPOSITORY,"liyongshang44-max/GEOX");
  const eventPath=process.env.GITHUB_EVENT_PATH;
  assert(eventPath,"HOLD_GITHUB_EVENT_PATH_REQUIRED");
  const e=JSON.parse(fs.readFileSync(eventPath,"utf8"));
  assert.equal(e.repository?.full_name,"liyongshang44-max/GEOX");
  assert.equal(e.pull_request?.number,3735,"HOLD_ONLY_PR_3735_POSTMERGE_REVIEW_SCOPE");
  assert.equal(e.pull_request?.user?.login,"liyongshang44-max");
  assert.equal(e.pull_request?.head?.repo?.full_name,"liyongshang44-max/GEOX");
  assert.equal(e.pull_request?.base?.repo?.full_name,"liyongshang44-max/GEOX");
  assert.equal(e.pull_request?.base?.sha,MAIN,"HOLD_POSTMERGE_BASE_CHANGED");
  assert.equal(e.pull_request?.base?.ref,"main","HOLD_BASE_NOT_MAIN");
  const head=git("rev-parse","HEAD");
  assert.equal(head,e.pull_request.head.sha,"HOLD_WRONG_EXACT_EVENT_HEAD");
  assert(ancestor(MAIN,head)&&ancestor(MERGE,MAIN),"HOLD_POSTMERGE_LINEAGE");
  assert(ancestor(SOURCE,MAIN)&&ancestor(GOV,MAIN),"HOLD_ORIGINAL_PARENTS_ABSENT");
  const parents=git("rev-list","--parents","-n","1",MERGE).split(/\s+/);
  equal(parents,[MERGE,SOURCE,GOV],"HOLD_ORIGINAL_MERGE_PARENT_DRIFT");
  const preserved=[
    BIND,OWNER,REVIEW,BUNDLE,COMPOSER,
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-QCP-TECHNICAL-ENROLLMENT-V1.json",
    "scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_TWO_PARENT_SOURCE_BINDING_V1.cjs",
    "scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json"
  ];
  for(const p of preserved)assert.equal(blob(head,p),blob(MAIN,p),"HOLD_ORIGINAL_PRESERVED_BLOB_DRIFT:"+p);
  assert.equal(blob(SOURCE,COMPOSER),blob(MAIN,COMPOSER),"HOLD_OPERATOR_SIGNED_COMPOSER_DRIFT");
  const sha=crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT,BUNDLE))).digest("hex");
  assert.equal(sha,"a98f40c3ed017b017a8459d02655b9f206f6716d1402abcc0e579487c63901df");
  const original=JSON.parse(git("show",MAIN+":"+QCP)),now=read(QCP);
  assert.equal(original.checks.length,58);
  assert.equal(now.checks.length,59);
  equal(now.checks.slice(0,58),original.checks,"HOLD_ORIGINAL_58_CHECKS_CHANGED");
  const oldResolvers=Object.keys(original.dependency_resolvers);
  assert.equal(oldResolvers.length,58);
  assert.equal(Object.keys(now.dependency_resolvers).length,59);
  for(const id of oldResolvers)equal(now.dependency_resolvers[id],original.dependency_resolvers[id],"HOLD_ORIGINAL_QCP_RESOLVER_DRIFT:"+id);
  const extraCheck=now.checks[58];
  assert.equal(extraCheck.check_id,"DA9_POSTMERGE_WINDOWS_PHYSICAL_READONLY_PRE_ADMISSION_V1");
  assert.equal(extraCheck.execution_workflow_status,"ONLY_NONAUTHORIZING_STATIC_WINDOWS_CONTRACT_SELFTEST_NO_PHYSICAL_HOST_CLAIM");
  assert.equal(extraCheck.carry_forward_evidence_id,null);
  assert.equal(now.checks.find(x=>x.check_id===CHECK).diagnostic_command,
    "node scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_TWO_PARENT_SOURCE_BINDING_V1.cjs");
  const newer=Object.keys(now.dependency_resolvers).filter(x=>!oldResolvers.includes(x));
  equal(newer,[RESOLVER],"HOLD_UNREVIEWED_NEW_QCP_RESOLVER");
  equal(now.dependency_resolvers[RESOLVER].paths,[
    ".github/workflows/mcft-cap09-postmerge-windows-physical-readonly-gate-v1.yml",
    "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-POSTMERGE-WINDOWS-PHYSICAL-READONLY-GATE-V1.json",
    "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP09_POSTMERGE_WINDOWS_PHYSICAL_READONLY_GATE_V1.cjs",
    SCRIPT
  ],"HOLD_POSTMERGE_EXACT_NEW_PATH_SCOPE");
  const changed=git("diff","--name-only",MAIN+"..."+head).split(/\r?\n/).filter(Boolean).sort();
  const allowed=[
    ...now.dependency_resolvers[RESOLVER].paths,
    QCP,
    "scripts/governance_acceptance/PREFLIGHT_MCFT_CAP_09_ALL_BLOCKERS_V1.cjs",
    "scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_V2_QCP_SIGNED_SIX_EVIDENCE_V1.cjs"
  ].sort();
  equal(changed,allowed,"HOLD_UNREVIEWED_POSTMERGE_CHANGED_PATH");
  const d=read("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-POSTMERGE-WINDOWS-PHYSICAL-READONLY-GATE-V1.json");
  assert.equal(d.source_main_sha,MAIN);
  assert.equal(d.status,"HOLD_PENDING_FRESH_WINDOWS_PHYSICAL_READBACK_NOT_EXECUTION_AUTHORITY");
  assert.equal(d.authorization.production_authorized,false);
  assert.equal(d.authorization.permit_eligible,false);
  const signed=require("./VERIFY_MCFT_CAP09_DA9_V2_QCP_SIGNED_SIX_EVIDENCE_V1.cjs");
  const reviews=read(REVIEW).evidence_entries;
  assert.equal(reviews.length,6);
  for(const proof of reviews){
    const v=signed.verifyRegisteredEvidence({
      decision:{check_id:proof.check_id,dependency_digest:proof.reviewed_dependency_digest},
      stage:"SUCCESSOR_SUBJECT_PRE_MERGE",head,base:MAIN
    });
    assert(v&&v.status==="PASS"&&v.signature_verification==="ED25519_VALID_ORIGINAL_SOURCE_ONLY",
      "HOLD_ORIGINAL_SIGNED_PROOF_INVALID:"+proof.check_id);
    assert.equal(v.permit_authorized,false);
    assert.equal(v.frozen_v13_historical_zero_drift_claim,false);
  }
  console.log(JSON.stringify({
    status:"PASS_POSTMERGE_HISTORIC_TWO_PARENT_INTEGRATION_REVALIDATED",
    event_pr:3735,source_main_sha:MAIN,subject_sha:head,
    original_checks_preserved:58,original_resolvers_preserved:58,
    original_six_ed25519_verified:6,original_pr3734_event_replayed:false,
    original_frozen_zero_drift_waived:false,
    physical_pg_readback:false,physical_minio_readback:false,
    provider_source_at_use:false,permit:false,production:false
  }));
}
try{main()}catch(error){console.error("HOLD_POSTMERGE_INTEGRATION_PRESERVATION:"+String(error.stack||error));process.exitCode=1;}
