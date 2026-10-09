#!/usr/bin/env node
"use strict";
// AM22 recovery qualification only: no Docker mutation, no provider calls, no Formal effects.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),os=require("node:os"),cp=require("node:child_process");
const {Pool}=require("pg");
const {ROOT,safeRepoRef,digestFile,selectA0}=require("./MCFT_CAP_09_AM22_GFS_BOOTSTRAP_V1.cjs");
const {SCOPE}=require("./MCFT_CAP_09_AM22_EVIDENCE_CLOCK_V2.cjs");
const REGISTRY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const PROOF="acceptance-output/MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1_RESULT.json";
const VERIFIER="scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1.cjs";
const SERVICES=["geox-mcft-cap09-production-v1-geox-mcft-cap09-evidence-runtime-v1-1","geox-mcft-cap09-production-v1-geox-mcft-cap09-twin-runtime-v1-1"];
const AUTH_REL="runtime/owner-cutover-authority.json";
const IMAGE=/^sha256:[a-f0-9]{64}$/;
function required(value,code){assert.ok(value,code);return value;}
function arg(key){return process.argv.slice(2).find(x=>x.startsWith(key+"="))?.slice(key.length+1);}
function load(file){return JSON.parse(fs.readFileSync(file,"utf8"));}
function native(cmd,args){return cp.execFileSync(cmd,args,{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"],env:process.env,timeout:900000}).trim();}
function checkpoint(out,status,extra){fs.mkdirSync(out,{recursive:true});const name=status==="PASS"?"recovery-readiness.json":"recovery-blocked.json";fs.writeFileSync(path.join(out,name),JSON.stringify({schema_version:"geox_mcft_cap09_am22_post_cutover_recovery_v1",status,...extra,formal_v5_arm:false,a0_execution:false,o00_started:false,production_owner_activation:false,production_container_recreation:false,provider_request_count:0,formal_write_count:0},null,2)+"\n",{flag:"wx",mode:0o600});}
function adjudicate({failed,proof,containers,head,image,stageEntry,a0,twinCounts}){
 assert.equal(failed.status,"FAIL","RECOVERY_REQUIRES_FAILED_BOOTSTRAP");
 assert.equal(failed.phase,"GFS_PAIR_WAIT","RECOVERY_REQUIRES_POST_OWNER_FAILURE");
 assert.equal(failed.owner_verified,true,"RECOVERY_REQUIRES_PRIOR_OWNER_PROOF");
 assert.equal(failed.operator_reconciliation_required,true,"RECOVERY_REQUIRES_RECONCILIATION");
 assert.equal(failed.formal_v5_arm,false);assert.equal(failed.a0_execution,false);assert.equal(failed.o00_started,false);
 assert.equal(failed.image_id,image,"RECOVERY_FAILED_IMAGE_CHANGED");
 assert.equal(proof.status,"PASS","RECOVERY_LIVE_OWNER_PROOF_REQUIRED");
 assert.equal(proof.adjudication,"EXACT_ONE_EFFECTIVE_OWNER_PER_RUNTIME_ROLE_WITH_CONTAINER_IMAGE_HOST_AND_RENEWAL_PROVEN");
 assert.equal(proof.subject_main_sha,head,"RECOVERY_MAIN_MISMATCH");
 assert.equal(proof.authorized_image_id,image,"RECOVERY_IMAGE_MISMATCH");
 assert.equal(proof.host_identity_contract_status,"PASS");
 assert.equal(proof.artifact_attestation_status,"PASS_EXACT_CLEAN_SUBJECT_TO_IMMUTABLE_LOCAL_IMAGE_ID");
 assert.deepEqual(proof.blockers,[],"RECOVERY_OWNER_BLOCKERS");
 for(const [index,role] of ["evidence_runtime","twin_runtime_scheduler"].entries()){
  const p=proof[role],c=containers[index];
  assert.equal(p.t1.status,"PASS");assert.equal(p.t2.status,"PASS");assert.equal(p.renewal.status,"PASS");
  assert.equal(p.renewal.same_effective_owner,true);
  assert.equal(p.renewal.same_container_instance,true);
  assert.equal(p.renewal.heartbeat_advanced,true);
  assert.equal(p.renewal.expiry_advanced,true);
  assert.equal(p.t2.container_id,c.Id,"RECOVERY_OWNER_CONTAINER_CHANGED");
  assert.equal(c.State.Running,true,"RECOVERY_CONTAINER_NOT_RUNNING");
  assert.equal(c.Image,image,"RECOVERY_RUNNING_IMAGE_MISMATCH");
  assert.equal(c.Config.Image,"geox-mcft-cap09-runtime:"+head,"RECOVERY_IMAGE_TAG_MISMATCH");
  assert.equal(p.t2.lease_owner,p.t1.lease_owner,"RECOVERY_OWNER_INSTANCE_CHANGED");
 }
 assert.equal(stageEntry.authority_valid_until>=Date.parse(a0)+24*3600000,true,"RECOVERY_STAGE_WINDOW_NOT_COVERED");
 for(const [table,n] of Object.entries(twinCounts))assert.equal(n,0,"RECOVERY_TWIN_NONZERO:"+table);
 return {owner_status:"PASS",twin_zero_status:"PASS",source_gfs_pair_status:"NOT_EVALUATED",six_phase_status:"NOT_EXECUTED"};
}
async function main(){
 const failedArg=required(arg("--failed"),"RECOVERY_FAILED_RECEIPT_REQUIRED");
 const stageArg=required(arg("--stage-ref"),"RECOVERY_STAGE_REF_REQUIRED");
 const a0=required(arg("--a0"),"RECOVERY_FUTURE_A0_REQUIRED");
 const out=path.resolve(required(arg("--out"),"RECOVERY_OUTPUT_REQUIRED"));
 assert.ok(process.argv.includes("--operator-authorized"),"RECOVERY_OPERATOR_AUTHORIZED_REQUIRED");
 assert.ok(!process.env.CI&&!process.env.GITHUB_ACTIONS,"RECOVERY_LOCAL_WINDOWS_HOST_ONLY");
 assert.ok(!fs.existsSync(out),"RECOVERY_IMMUTABLE_OUTPUT_MUST_BE_NEW");
 assert.ok(path.relative(ROOT,out).startsWith(".."+path.sep),"RECOVERY_OUTPUT_OUTSIDE_REPO_REQUIRED");
 const receipt=path.resolve(failedArg),failed=load(receipt);
 let phase="RECONCILIATION_PRECHECK",head=null,image=null;
 try{
  head=native("git",["rev-parse","HEAD"]);
  const remote=native("git",["ls-remote","origin","refs/heads/main"]).split(/\s+/)[0];
  assert.equal(head,remote,"RECOVERY_EXACT_PROTECTED_MAIN_REQUIRED");
  assert.equal(native("git",["status","--porcelain"]),"","RECOVERY_CLEAN_CHECKOUT_REQUIRED");
  assert.equal(failed.status,"FAIL");assert.equal(failed.owner_verified,true);
  image=required(failed.image_id,"RECOVERY_IMAGE_REQUIRED");assert.match(image,IMAGE);
  const stage=safeRepoRef(stageArg);
  const registry=load(path.join(ROOT,REGISTRY));
  const entry=registry.entries.find(x=>x.authority_ref===stage.ref&&x.authority_sha256===digestFile(stage.resolved)&&["EFFECTIVE_FOR_RUNTIME_CONSUMPTION","EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH"].includes(x.graduation_status));
  assert.ok(entry,"RECOVERY_ADOPTED_STAGE_REQUIRED");
  assert.match(a0,/^\d{4}-\d\d-\d\dT\d\d:00:00\.000Z$/);
  const sourceNow=new Date().toISOString();
  assert.ok(Date.parse(a0)>Date.parse(sourceNow),"RECOVERY_A0_MUST_BE_FUTURE");
  const coverage=selectA0({source_now:sourceNow,budget_ms:0+2801804,stage:load(stage.resolved)});
  assert.ok(Date.parse(a0)>=Date.parse(coverage.a0),"RECOVERY_MINIMUM_LEAD_REQUIRED");
  assert.ok(Date.parse(entry.authority_as_of)<=Date.parse(sourceNow)&&Date.parse(entry.authority_valid_until)>=Date.parse(a0)+24*3600000,"RECOVERY_FULL_25_CONTEXTS_REQUIRED");
  const attestation=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_V1_RESULT.json");
  const env=process.env;
  env.GEOX_DEPLOYMENT_SUBJECT_COMMIT=head;
  env.GEOX_MCFT_CAP09_RUNTIME_IMAGE_TAG="geox-mcft-cap09-runtime:"+head;
  env.GEOX_MCFT_CAP09_LOCAL_HOST_ID_PATH=path.join(os.homedir(),".geox","mcft-cap09","local-host-id-v1");
  env.GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_PATH=attestation;
  required(env.GEOX_MCFT_CAP09_DURABLE_LOG_ROOT,"RECOVERY_DURABLE_LOG_REQUIRED");
  required(env.GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL,"RECOVERY_EVIDENCE_DB_REQUIRED");
  required(env.GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL,"RECOVERY_TWIN_DB_REQUIRED");
  env.EVIDENCE_RUNTIME_DATABASE_URL_SECRET=env.GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL;
  env.TWIN_RUNTIME_DATABASE_URL_SECRET=env.GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL;
  const att=load(attestation);
  assert.equal(att.authorized_image_id,image,"RECOVERY_ATTESTATION_IMAGE_MISMATCH");
  assert.equal(att.subject_main_sha,head,"RECOVERY_ATTESTATION_MAIN_MISMATCH");
  phase="LIVE_OWNER_REVALIDATION";
  native(process.execPath,[VERIFIER,"--live"]);
  const proof=load(path.join(ROOT,PROOF));
  phase="TWIN_ZERO_STATE";
  const containers=JSON.parse(native("docker",["inspect",...SERVICES]));
  const pool=new Pool({connectionString:env.GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL,max:1,options:"-c default_transaction_read_only=on -c statement_timeout=15000",connectionTimeoutMillis:15000,query_timeout:20000});
  const tables=["twin_state_history_projection_v1","twin_state_latest_index_v1","twin_shadow_online_scheduler_cursor_v1","twin_shadow_online_scheduler_slot_v1"];
  const twinCounts={};
  try{
   for(const table of tables)twinCounts[table]=Number((await pool.query('SELECT count(*) AS n FROM public."'+table+'"')).rows[0].n);
  }finally{await pool.end();}
  const status=adjudicate({failed,proof,containers,head,image,stageEntry:{...entry,authority_valid_until:Date.parse(entry.authority_valid_until)},a0,twinCounts});
  checkpoint(out,"PASS",{phase:"POST_CUTOVER_RECOVERY_READINESS",subject_sha:head,host_id:proof.actual_host_id,image_id:image,stage_ref:stage.ref,stage_sha256:digestFile(stage.resolved),a0,source_failed_receipt:receipt,source_failed_receipt_sha256:digestFile(receipt),owner_proof_ref:PROOF,twin_counts:twinCounts,...status,measurement_only:true});
  process.stdout.write(fs.readFileSync(path.join(out,"recovery-readiness.json"),"utf8"));
 }catch(e){
  checkpoint(out,"BLOCKED",{phase,reason:String(e?.message??e),subject_sha:head,image_id:image,source_failed_receipt:receipt});
  process.stderr.write(String(e?.stack??e)+"\n");process.exitCode=1;
 }
}
if(require.main===module)main().catch(e=>{process.stderr.write(String(e?.stack??e));process.exitCode=1;});
module.exports={adjudicate};
