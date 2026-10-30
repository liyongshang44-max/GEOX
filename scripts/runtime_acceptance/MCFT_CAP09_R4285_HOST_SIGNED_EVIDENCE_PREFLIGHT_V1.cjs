"use strict";
/* R4285 successor Host FIRST BOUNDARY, preflight-only and nonauthorizing.
 * No legacy Attempt-3 Permit/ledger/child dispatch is imported or consumed.
 * Even valid Lineage+Full-chain is only a necessary prerequisite.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const gate=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs");
const RUN="4285c3ce342c";
const HOLD="HOLD_R4285_SUCCESSOR_HOST_ADOPTION_OWNER_PERMIT_LEDGER_AND_CHILD_CAPABILITY_NOT_IMPLEMENTED";
function parse(argv){
 assert(Array.isArray(argv),"R4285_ARGUMENTS_REQUIRED");
 assert.equal(argv.length,3,"R4285_HOST_PREFLIGHT_ONLY_EXACT_ARGUMENTS_REQUIRED");
 assert.equal(argv[0],"--preflight-only","R4285_HOST_EXECUTION_FORBIDDEN");
 assert.equal(argv[1],"--input","R4285_HOST_INPUT_FLAG_REQUIRED");
 assert(path.isAbsolute(argv[2]),"R4285_HOST_ABSOLUTE_INPUT_REQUIRED");
 return {input:argv[2]};
}
function readInput(file){
 assert(path.isAbsolute(file),"R4285_HOST_ABSOLUTE_INPUT_REQUIRED");
 const st=fs.lstatSync(file);
 assert(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<512*1024,"R4285_HOST_INPUT_UNSAFE");
 const input=JSON.parse(fs.readFileSync(file,"utf8").replace(/^\uFEFF/,""));
 assert(input&&Object.getPrototypeOf(input)===Object.prototype,"R4285_HOST_INPUT_OBJECT_REQUIRED");
 assert.deepEqual(Object.keys(input).sort(),["signed_evidence"],"R4285_HOST_INPUT_FIELDS");
 return input.signed_evidence;
}
function reviewSignedHostPrerequisite(input,{platform=process.platform,environment=process.env}={}){
 assert.equal(platform,"win32","R4285_SUCCESSOR_WINDOWS_HOST_ONLY");
 assert(!environment.CI&&!environment.GITHUB_ACTIONS,"R4285_SUCCESSOR_HOST_NOT_CI");
 assert(!environment.NODE_OPTIONS&&!environment.NODE_PATH,"R4285_HOST_INJECTED_RUNTIME_FORBIDDEN");
 assert(input&&typeof input==="object","R4285_SIGNED_EVIDENCE_REQUIRED");
 const proof=gate.review(input);
 assert.equal(proof.status,"R4285_SIGNED_LINEAGE_AND_HISTORIC_FULLCHAIN_VERIFIED_NOT_ADOPTION_OR_PERMIT");
 assert.equal(proof.run_id,RUN);
 assert.equal(proof.execution_authorized,false);
 assert.equal(proof.permit_issued,false);
 assert.equal(proof.permit_consumed,false);
 assert.equal(proof.stage_count,0);
 assert.equal(proof.production_authorized,false);
 return Object.freeze({
  schema_version:"MCFT_CAP09_R4285_HOST_SIGNED_EVIDENCE_PREFLIGHT_V1",
  status:HOLD,run_id:RUN,subject_sha:proof.subject_sha,
  signed_lineage_and_historical_fullchain:"VERIFIED_READ_ONLY_AT_CURRENT_SOURCE",
  original_evidence_review:proof.status,attempt_ordinal:proof.attempt_ordinal,
  admission_signed:false,resource_owner_fresh_signed:false,permit_signed:false,
  permit_consumed:false,successor_atomic_ledger_implemented:false,
  successor_child_capability_implemented:false,
  official_six_stage_host_preflight_pass:false,execute_authorized:false,
  stage_count:0,production_authorized:false
 });
}
function run(argv,opts){const parsed=parse(argv);return reviewSignedHostPrerequisite(readInput(parsed.input),opts);}
if(require.main===module){
 try{
  const result=run(process.argv.slice(2));
  console.log(JSON.stringify(result,null,2));
  process.exitCode=3; // Deliberately HOLD even after authentic evidence passes.
 }catch(e){
  console.error(JSON.stringify({status:"HOLD_R4285_HOST_SIGNED_EVIDENCE_NOT_ADMITTED",
   reason_code:String(e.message||e).slice(0,240),run_id:RUN,
   permit_signed:false,permit_consumed:false,stage_count:0,
   execute_authorized:false,production_authorized:false}));
  process.exitCode=1;
 }
}
module.exports={RUN,HOLD,parse,readInput,reviewSignedHostPrerequisite,run};
