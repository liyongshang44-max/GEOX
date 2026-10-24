"use strict";
// Stage3 physical business-PRIMITIVE launch, not original governed stage-entry
// authority. Never claim original Producer/Timing entrypoints executed.
// Executes the real isolated Composer/S3/Candidate/PG/Controller body in a
// new stage-scoped dedicated PG+MinIO namespace, and records process evidence.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const crypto=require("node:crypto"),cp=require("node:child_process");
const stageReceipts=require("./MCFT_CAP09_STAGE_RECEIPTS_V1.cjs");
const ROOT=path.resolve(__dirname,"../..");
const SUBJECT="12dcbba6750879f0349c5730f477cb04cd23b560";
const SOURCE="scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_DA9_ISOLATED_FULL_CHAIN_NONAUTHORIZED_V1.ts";
const BODY="acceptance-output/MCFT_CAP09_DA9_ISOLATED_NONAUTHORIZED_FULL_CHAIN_V1_RESULT.json";
const IDS=["PRODUCER","TIMING_1","TIMING_2","TIMING_3"];
const SHA=/^[a-f0-9]{64}$/,ID=/^[a-f0-9]{12}$/;
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const read=f=>JSON.parse(fs.readFileSync(f,"utf8"));
function safeFile(f){const s=fs.lstatSync(f);assert(s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<2*1024*1024,"STAGE3_FILE_INVALID");return fs.readFileSync(f);}
function safeRoot(output){
 assert(path.isAbsolute(output)&&path.relative(ROOT,output).startsWith(".."+path.sep),"STAGE3_OUTPUT_OUTSIDE_CHECKOUT_REQUIRED");
 assert(!/da9db7129607|af64cc3aa84e|72dc0304a21a/i.test(output),"STAGE3_REUSED_HISTORICAL_STORAGE_FORBIDDEN");
}
function validateEnv(id,runId){
 assert(IDS.includes(id),"STAGE3_PHYSICAL_STAGE_INVALID");
 assert(ID.test(runId)&&!["da9db7129607","72dc0304a21a","af64cc3aa84e","abcdef012345"].includes(runId),"STAGE3_UNIQUE_RUN_REQUIRED");
 for(const k of ["MCFT_GOVERNED_RETRY_STAGE","MCFT_GOVERNED_RETRY_TICKET","MCFT_GOVERNED_RETRY_BUNDLE","MCFT_CAP09_ADOPTION_REQUEST",
 "MCFT_CAP09_FORMAL_V5_ARM","GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL"]){
  assert(!process.env[k],"STAGE3_PRODUCTION_OR_PERMIT_ENV_FORBIDDEN:"+k);
 }
 assert.equal(process.env.CAP09_NONAUTHORIZED_E2E_EXCLUSIVE_DESTRUCTIVE_TEST,"1");
 assert.equal(process.env.CAP09_NONAUTHORIZED_E2E_RUN_ID,runId);
 assert.equal(process.env.CAP09_E2E_SUBJECT_SHA,SUBJECT);
 assert.equal(process.env.PHASE7_PRIVATE_S3_BUCKET,"mcft-cap09-requal-"+runId);
 assert.equal(new URL(process.env.DATABASE_URL).pathname,
 "/mcft_cap09_requal_"+runId+"_positive");
 for(const ep of [new URL(process.env.DATABASE_URL),new URL(process.env.PHASE7_PRIVATE_S3_ENDPOINT)]){
  assert(["127.0.0.1","localhost","[::1]"].includes(ep.hostname),"STAGE3_ENDPOINT_MUST_BE_LOCAL_LOOPBACK");
  assert(!ep.search&&!ep.hash,"STAGE3_ENDPOINT_OVERRIDE_FORBIDDEN");
 }
 assert.equal(process.env.CI,"true","STAGE3_EXPLICIT_DISPOSABLE_TEST_CONTEXT_REQUIRED");
}
function verifyPhysical(r,id,runId){
 assert.equal(r.schema_version,"geox_mcft_cap09_isolated_non_authorized_full_chain_contract_v1");
 assert.equal(r.status,"PASS");assert.equal(r.subject_sha,SUBJECT);assert.equal(r.test_run_id,runId);
 assert.equal(r.isolated_s3_bucket,"mcft-cap09-requal-"+runId);
 assert.equal(r.pg_database,"mcft_cap09_requal_"+runId+"_positive");
 for(const k of ["private_raw_retention_real_s3_verified","actual_isolated_composer_exercised","post_commit_physical_readback_verified",
 "candidate_manifest_private_readback","exact_three_facts_single_fenced_transaction",
 "real_postgres_fenced_promotion","controller_attestation_after_promotion","cursor_advanced_only_after_attestation"]){
  assert.equal(r[k],true,"STAGE3_REAL_BUSINESS_PRIMITIVE_NOT_OBSERVED:"+k);
 }
 for(const k of ["permit_signed","permit_consumed","production_authorized","production_owner_activation","formal_v5_armed","o00_started"]){
  assert.equal(r[k],false,"STAGE3_UNEXPECTED_AUTHORIZATION:"+k);
 }
 assert.equal(r.stage_count,0,"STAGE3_MUST_NOT_USE_AUTHORIZED_SCHEDULER");
 assert.equal(r.capture_raw_object_count,2);assert.equal(r.candidate_semantic_record_count,3);
 assert.equal(r.real_postgres_formal_fact_present_count,3);
 assert.equal(r.production_process_graph_wiring,false);
 assert.equal(r.promotion_provider_refetch_count,0);
 assert.equal(r.evidence_login_restricted,true);
 assert.equal(r.evidence_direct_fact_insert_allowed,false);
 assert.equal(r.evidence_fenced_writer_execute_allowed,true);
 assert(r.source_files_sha256&&typeof r.source_files_sha256==="object");
 const sourceSet=require("../governance_acceptance/MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs").SOURCE_PATHS;
 assert.deepEqual(Object.keys(r.source_files_sha256).sort(),[...sourceSet].sort(),
  "STAGE3_FULL_PHYSICAL_SOURCE_PROVENANCE_SET_INVALID");
 for(const src of sourceSet){
  assert(SHA.test(r.source_files_sha256[src]),"STAGE3_SOURCE_DIGEST_INVALID:"+src);
  assert.equal(r.source_files_sha256[src],sha(safeFile(path.join(ROOT,src))),
   "STAGE3_CURRENT_CANDIDATE_SOURCE_BYTES_DID_NOT_EXECUTE:"+src);
 }
 // Parent must not claim this is an original stage-entry execution.
 return {id,physical_primitives_verified:true,original_governed_stage_entry_executed:false,
   direct_source_identity:r.source_files_sha256[SOURCE]};
}
function verifySummary(rec,physicalBytes,recordBytes,id,runId){
 const r=readFromBytes(physicalBytes);
 const audit=readFromBytes(recordBytes);
 assert.equal(rec.schema_version,"geox_mcft_cap09_stage3_real_physical_primitive_process_receipt_v1");
 assert.equal(rec.stage_id,id);assert.equal(rec.test_run_id,runId);assert.equal(rec.subject_sha,SUBJECT);
 assert.equal(rec.stage2_reused_physical_body,true);
 assert.equal(rec.original_producer_timing_entrypoint_executed,false);
 assert.equal(rec.producer_or_timing_synthetic,false);
 assert.equal(rec.source_entry,SOURCE);
 assert.equal(rec.physical_body_sha256,sha(physicalBytes));
 assert.equal(rec.stage_process_completion_sha256,sha(recordBytes));
 assert.equal(audit.schema_version,"geox_mcft_cap09_stage_completed_v1");
 assert.equal(audit.id,id);assert.equal(audit.status,"PASS");
 assert.equal(audit.artifact_sha256,sha(physicalBytes));
 assert.equal(audit.claim_present,null);assert.equal(audit.claim_valid,null);
 assert.equal(audit.qualification_pass,false);
 assert(Number.isSafeInteger(audit.elapsed_ms)&&audit.elapsed_ms>=0);
 assert.equal(rec.wall_clock_business_elapsed_ms,audit.elapsed_ms);
 verifyPhysical(r,id,runId);
 return {status:"REAL_PHYSICAL_PRIMITIVES_VERIFIED_NOT_ORIGINAL_STAGE_BODIES",stage:id,
  run_id:runId,physical_body_sha256:rec.physical_body_sha256,real_elapsed_ms:audit.elapsed_ms,
  original_stage_executed:false,permit_signed:false,permit_consumed:false};
}
function readFromBytes(bytes){return JSON.parse(bytes.toString("utf8"));}
async function runStage(id,runId,dir){
 validateEnv(id,runId);safeRoot(dir);assert(!fs.existsSync(dir),"STAGE3_OUTPUT_MUST_BE_NEW");
 assert.equal(process.version.startsWith("v24.19.")||process.env.GITHUB_ACTIONS==="true",true,"STAGE3_WINDOWS_NODE24_REQUIRED");
 const current=cp.execFileSync("git",["rev-parse","HEAD"],{cwd:ROOT,encoding:"utf8"}).trim();
 const base=cp.execFileSync("git",["rev-parse","HEAD:"+SOURCE],{cwd:ROOT,encoding:"utf8"}).trim();
 const frozen=cp.execFileSync("git",["rev-parse",SUBJECT+":"+SOURCE],{cwd:ROOT,encoding:"utf8"}).trim();
 assert.equal(base,frozen,"STAGE3_PHYSICAL_BODY_CHANGED_FROM_FROZEN");
 assert.equal(cp.execFileSync("git",["hash-object",SOURCE],{cwd:ROOT,encoding:"utf8"}).trim(),frozen,"STAGE3_PHYSICAL_BODY_WORKTREE_CHANGED");
 assert.match(current,/^[a-f0-9]{40}$/);
 const actual=path.join(ROOT,BODY);
 assert(!fs.existsSync(actual),"STAGE3_STALE_PHYSICAL_BODY_RECEIPT_EXISTS");
 fs.mkdirSync(dir,{recursive:false,mode:0o700});
 const led=path.join(dir,"ledger");fs.mkdirSync(led);
 const prior=path.join(dir,"SEED.json");
 stageReceipts.writeOnce(prior,{schema_version:"geox_mcft_cap09_stage3_nonauthorized_process_seed_v1",
  stage_id:id,test_run_id:runId,subject_sha:SUBJECT,permit_consumed:false});
 const tick=stageReceipts.hashFile(prior);
 const tsScript=path.join(ROOT,SOURCE);
 const result=await stageReceipts.runRecordedStage({id,directory:led,cwd:ROOT,
  executable:process.execPath,args:["--import","tsx",tsScript],
  env:{...process.env,MCFT_GOVERNED_RETRY_STAGE:undefined,MCFT_GOVERNED_RETRY_TICKET:undefined,
   MCFT_GOVERNED_RETRY_BUNDLE:undefined,MCFT_CAP09_ADOPTION_REQUEST:undefined},
  timeout_ms:1200000,previous_sha256:tick,expected_artifact:actual});
 const physicalBytes=safeFile(actual),ph=sha(physicalBytes);
 assert.equal(result.record.artifact_sha256,ph);
 const bodyCopy=path.join(dir,"PHYSICAL_"+id+".json");
 fs.renameSync(actual,bodyCopy);
 const completed=path.join(led,id,"COMPLETED.json"),compBytes=safeFile(completed);
 const summary={schema_version:"geox_mcft_cap09_stage3_real_physical_primitive_process_receipt_v1",
  stage_id:id,test_run_id:runId,subject_sha:SUBJECT,current_test_code_head:current,
  source_entry:SOURCE,source_blob_sha:frozen,stage2_reused_physical_body:true,
  original_producer_timing_entrypoint_executed:false,producer_or_timing_synthetic:false,
  physical_body_sha256:ph,stage_process_completion_sha256:sha(compBytes),
  wall_clock_business_elapsed_ms:result.record.elapsed_ms,
  permit_signed:false,permit_consumed:false,production_authorized:false,
  formal_timing_qualified:false};
 const summaryFile=path.join(dir,"STAGE3_"+id+"_PUBLIC_RECEIPT.json");
 stageReceipts.writeOnce(summaryFile,summary);
 const proof=verifySummary(summary,physicalBytes,compBytes,id,runId);
 console.log(JSON.stringify({...proof,receipt_file:summaryFile,physical_file:bodyCopy,
   process_receipt_file:completed,elapsed_measurement_scope:"WHOLE_ISOLATED_INTEGRATION_SUBPROCESS_NOT_ORIGINAL_TIMING_V2"}));
}
function verify(dir,id,runId){
 safeRoot(dir);assert(IDS.includes(id));assert(ID.test(runId));
 const summary=read(path.join(dir,"STAGE3_"+id+"_PUBLIC_RECEIPT.json"));
 const ph=safeFile(path.join(dir,"PHYSICAL_"+id+".json"));
 const completed=safeFile(path.join(dir,"ledger",id,"COMPLETED.json"));
 return verifySummary(summary,ph,completed,id,runId);
}
const mode=process.argv[2],id=process.argv[3],runId=process.argv[4],dir=process.argv[5];
if(require.main===module){(async()=>{
 if(mode==="--run")await runStage(id,runId,path.resolve(dir));
 else if(mode==="--verify")console.log(JSON.stringify(verify(path.resolve(dir),id,runId)));
 else throw Error("STAGE3_USAGE: --run|--verify PRODUCER|TIMING_1..3 NEW_RUN_ID ABS_OUTPUT_DIR");
})().catch(e=>{console.error("STAGE3_REAL_BODY_HOLD:"+String(e.stack||e));process.exitCode=1;});}
module.exports={runStage,verify,verifyPhysical,validateEnv,IDS,SUBJECT,SOURCE};
