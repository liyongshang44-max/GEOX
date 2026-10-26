"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const gate=require("./MCFT_CAP09_STAGE3_NONAUTHORIZED_REAL_BODY_GATE_V1.cjs");
const ROOT=path.resolve(__dirname,"../..");
let count=0;
const c=gate.verifySource(ROOT);assert.equal(c.stages.length,6);count++;
assert.equal(c.six_stage_original_business_bodies_verified,false);count++;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"cap09-stage3-negative-"));
try{
 let result=gate.verifyReceipt(ROOT,dir);
 assert.equal(result.status,"HOLD_UNTIL_ALL_SIX_REAL_STAGE_BODIES_AND_INDEPENDENT_REVIEW");
 assert.equal(result.stage_count,0);count++;
 assert.throws(()=>gate.verifyReceipt(ROOT,dir,{runId:"da9db7129607"}),/HISTORICAL_OR_STAGE2_RUN_REUSE_FORBIDDEN/);count++;
 assert.throws(()=>gate.verifyReceipt(ROOT,dir,{runId:"af64cc3aa84e"}),/HISTORICAL_OR_STAGE2_RUN_REUSE_FORBIDDEN/);count++;
 const p=path.join(dir,"PRODUCER.stage3.json");
 const r={schema_version:"geox_mcft_cap09_stage3_nonauthorized_stage_entry_v1",
  id:"PRODUCER",run_id:"aabbccddeeff",source_sha:c.frozen_pr_3730_head_sha,
  entry_script:c.stages[0].original_entry_script,entry_git_blob_sha:c.stages[0].original_entry_git_blob_sha,
  real_body_executed:false,permit_consumed:false,production_authorized:false,
  body_file_sha256:"0".repeat(64),stage_receipt_predecessor_sha256:null,status:"PASS"};
 fs.writeFileSync(p,JSON.stringify(r));
 fs.writeFileSync(path.join(dir,c.stages[0].expected_artifact_name),JSON.stringify({schema_version:c.stages[0].expected_artifact_schema,status:"PASS",subject_sha:c.frozen_pr_3730_head_sha}));
 assert.throws(()=>gate.verifyReceipt(ROOT,dir),/STAGE3_SYNTHETIC_SIMULATION_REJECTED/);count++;
 fs.writeFileSync(p,JSON.stringify({...r,real_body_executed:true,entry_git_blob_sha:"a".repeat(40)}));
 assert.throws(()=>gate.verifyReceipt(ROOT,dir),/AssertionError|Expected values to be strictly equal/);count++;

 // The original DA9 six-check source binding is immutable. The revised Windows
 // interpreter-threading Composer must be independently constrained to the exact
 // three reviewed source edits, but this audit never promotes old signatures.
 const cp=require("node:child_process");
 const contract=JSON.parse(fs.readFileSync(path.join(ROOT,
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-FROZEN-SEMANTIC-SUCCESSOR-V1.json"),"utf8"));
 const composer="scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts";
 const legacyBlob="7e74b1df502e159dd49ceb21889cbfff86408e50";
 const threadedBlob="2d1f72d92c05093537774285bda5b7200845344d";
 assert.equal(contract.expected_unchanged_isolated_composer_git_blob_sha,legacyBlob,
  "HISTORICAL_DA9_COMPOSER_BINDING_MUTATED");
 const git=(...args)=>cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trimEnd();
 assert.equal(git("rev-parse","HEAD:"+composer),threadedBlob,"STAGE3_UNREVIEWED_COMPOSER_BLOB");
 assert.equal(git("hash-object","--",composer),threadedBlob,"STAGE3_COMPOSER_WORKTREE_DRIFT");
 const prior=cp.execFileSync("git",["show",legacyBlob],{cwd:ROOT,encoding:"utf8"});
 const current=fs.readFileSync(path.join(ROOT,composer),"utf8");
 const edits=[
  ["  fetch_impl?: typeof fetch;\n",
   "  fetch_impl?: typeof fetch;\n  python_executable?: string; // Test-only caller pins actual Python binary for Windows science\n"],
  ["{retention,clock,fetch_impl:input.fetch_impl});",
   "{retention,clock,fetch_impl:input.fetch_impl,python_executable:input.python_executable});"],
  ["    rehydration_decoder_factory:new ProductionExternalFormalCandidateRehydrationDecoderFactoryV1(),",
   `    // The GFS capture factory and Candidate raw-rehydration factory MUST use the
    // same pinned interpreter. Otherwise Windows capture succeeds but replay
    // silently falls back to unqualified "python3" on PATH (often ENOENT).
    // This is isolated-qualification-only wiring; production graph untouched.
    rehydration_decoder_factory:new ProductionExternalFormalCandidateRehydrationDecoderFactoryV1({
      python_executable:input.python_executable,
    }),`]
 ];
 function reviewExactPinnedPythonThreading(candidate){
  let expected=prior;
  for(const [previous,next] of edits){
   assert.equal(expected.split(previous).length,2,"STAGE3_INTERPRETER_PATCH_HISTORICAL_SCOPE_AMBIGUOUS");
   expected=expected.replace(previous,next);
  }
  assert.equal(candidate,expected,"STAGE3_INTERPRETER_PATCH_UNREVIEWED_SOURCE_DELTA");
  assert(candidate.includes("production_wrapper_composer_reused:false"),"STAGE3_WRAPPER_EQUIVALENCE_FALSIFIED");
  assert(candidate.includes('mode:"ISOLATED_QUALIFICATION_ONLY"'),"STAGE3_ISOLATION_MODE_MISSING");
  return true;
 }
 assert(reviewExactPinnedPythonThreading(current));
 count++;
 // Deliberately break the pinned capture interpreter, the replay interpreter
 // and the rest of the unchanged isolation source. Each must fail closed.
 assert.throws(()=>reviewExactPinnedPythonThreading(prior),/UNREVIEWED_SOURCE_DELTA/);count++;
 assert.throws(()=>reviewExactPinnedPythonThreading(current.replace(
  "fetch_impl:input.fetch_impl,python_executable:input.python_executable",
  "fetch_impl:input.fetch_impl")),/UNREVIEWED_SOURCE_DELTA/);count++;
 assert.throws(()=>reviewExactPinnedPythonThreading(current.replace(
  "python_executable:input.python_executable,\n    }),",
  "python_executable:\"python3\",\n    }),")),/UNREVIEWED_SOURCE_DELTA/);count++;
 assert.throws(()=>reviewExactPinnedPythonThreading(current.replace(
  "production_wrapper_composer_reused:false","production_wrapper_composer_reused:true")),
  /UNREVIEWED_SOURCE_DELTA/);count++;
 const fence=c.fenced_pg_admission_review_20261025;
 assert.equal(fence.status,"HOLD_NEW_ISOLATED_FENCED_PG_NOT_ADMITTED");
 assert.equal(fence.offline_no_provider_new_fenced_pg_positive_harness_implemented,false);
 assert.equal(fence.actual_windows_fenced_pg_three_facts_and_cursor_readback_observed,false);
 assert.equal(fence.governed_host_permit_authorized,false);
 count++;
 console.log(JSON.stringify({status:"PASS",checks:count,original_entry_bodies_executed:false,
  forbidden_historical_reuse:true,stage3_qualification:"HOLD",original_six_signed_evidence_still_unqualified:true,reviewed_interpreter_only_blob:"2d1f72d92c05093537774285bda5b7200845344d",new_fenced_pg:"HOLD",permit_issued:false,permit_consumed:false}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
