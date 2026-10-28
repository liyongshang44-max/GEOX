// Genuine ProductionEvidenceWorkItemFactory acquisition and one physical
// fenced PostgreSQL/MinIO Controller run. Strictly test-only; not governed V13 Host.
import assert from "node:assert/strict";
import {createStage3TestOnlyDualHeartbeatV1} from "./MCFT_CAP09_STAGE3_TEST_ONLY_DUAL_HEARTBEAT_V1.cjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {Pool} from "pg";
import {composeIsolatedMcftCap09V13ProducerCoreV1} from "./MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.js";
import {MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {PostgresExternalFormalForcingBaseContinuityRepositoryV1} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_base_continuity_repository_v1.js";
import {PostgresExternalFormalForcingControllerLifecycleV1} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_controller_lifecycle_v1.js";
const need=(name:string)=>{const val=process.env[name];if(!val)throw Error("STAGE3_REAL_PG_ENV_MISSING:"+name);return val;};
function boundedFailure(e:unknown){return String(e instanceof Error?e.message:e).replace(/[\r\n]/g," ").slice(0,270)}
const NEW=/^[a-f0-9]{12}$/;
async function main(){
 assert.equal(process.platform,"win32","STAGE3_WINDOWS_NATIVE_ONLY");
 assert.equal(process.version,"v24.19.0","STAGE3_WINDOWS_NODE24_REQUIRED");
 assert(!process.env.CI&&!process.env.GITHUB_ACTIONS,"STAGE3_WINDOWS_CI_SPOOFING_FORBIDDEN");
 assert.equal(fs.realpathSync.native(process.execPath).toLowerCase(),
  fs.realpathSync.native(need("MCFT_CAP09_WINDOWS_PINNED_NODE")).toLowerCase(),
  "STAGE3_WINDOWS_EFFECTIVE_NODE_BINARY_MISMATCH");
 const pinnedPython=need("MCFT_CAP09_WINDOWS_PINNED_PYTHON");
 assert(path.isAbsolute(pinnedPython)&&fs.existsSync(pinnedPython),"STAGE3_WINDOWS_PYTHON_EXECUTABLE_REQUIRED");
 assert.equal(need("MCFT_CAP09_WINDOWS_REAL_CHAIN_TEST_ONLY"),"1");
 assert.equal(need("MCFT_CAP09_STAGE3_DUAL_HEARTBEAT_TEST_ONLY"),"1");
 const id=need("MCFT_CAP09_STAGE3_NEW_RUN_ID");
 assert(NEW.test(id)&&!["da9db7129607","af64cc3aa84e","df091a71aafc","618ba5c477d1",
  "ce94f97c2cf1","b06f28c950ce","c8b2ea29c9f1","971899e1c236","73b04afb4249"].includes(id),
  "STAGE3_HEARTBEAT_NEVER_REUSE_RETAINED_RUN");
 for(const k of ["MCFT_GOVERNED_RETRY_STAGE","MCFT_GOVERNED_RETRY_TICKET",
  "MCFT_GOVERNED_RETRY_BUNDLE","MCFT_CAP09_ADOPTION_REQUEST",
  "MCFT_CAP09_FORMAL_RAW_BUCKET","BLOCKED_DATABASE_URL"]){
  assert(!process.env[k],"STAGE3_REAL_PG_FORMAL_ENV_FORBIDDEN:"+k);
 }
 const url=new URL(need("DATABASE_URL")),endpoint=new URL(need("PHASE7_PRIVATE_S3_ENDPOINT"));
 assert(["127.0.0.1","localhost","[::1]"].includes(url.hostname));
 assert.equal(decodeURIComponent(url.pathname.slice(1)),"mcft_cap09_requal_"+id+"_positive");
 assert.equal(url.username,"cap09_non_auth_e2e_"+id);
 assert(["127.0.0.1","localhost","[::1]"].includes(endpoint.hostname));
 assert(!url.search&&!url.hash&&!endpoint.search&&!endpoint.hash);
 const bucket=need("PHASE7_PRIVATE_S3_BUCKET");
 assert.equal(bucket,"mcft-cap09-requal-"+id);
 const subject=need("CAP09_E2E_SUBJECT_SHA");
 assert(/^[a-f0-9]{40}$/.test(subject));
 const output=need("MCFT_CAP09_STAGE3_PHYSICAL_RECEIPT_DIR");
 assert(path.isAbsolute(output)&&path.relative(process.cwd(),output).startsWith(".."+path.sep)&&!fs.existsSync(output));
 fs.mkdirSync(output,{recursive:false,mode:0o700});
 const start=Date.now(),base=new Date(Math.ceil((start+10*3600_000)/3600_000)*3600_000).toISOString();
 const receipt:Record<string,unknown>={
  schema_version:"geox_mcft_cap09_stage3_full_real_provider_one_base_dual_heartbeat_test_only_v1",
  status:"HOLD",run_id:id,subject_sha:subject,base_target_t:base,
  real_provider_transport_required:true,fixture_used:false,
  original_v13_producer_entry_executed:false,original_v13_timing_v2_executed:false,
  original_aggregate_executed:false,formal_timing_qualified:false,
  raw_values_publicly_emitted:false,permit_signed:false,permit_consumed:false,
  production_authorized:false,qualified:false};
 const phase:Record<string,unknown>={};
 let step="NEW_RESTRICTED_PG_ACL",realGets=0,rawMs=0,manifestMs=0;
 let s3PutInitiated=false,s3PutInFlight=0;
 let heartbeat:any=null;
 let heartbeatJournalFd:number|null=null;
 const pool=new Pool({connectionString:url.toString(),max:6});
 try{
  const acl=(await pool.query("SELECT current_user AS who,has_table_privilege(current_user,'public.facts','INSERT') AS can_insert,has_function_privilege(current_user,'public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb)','EXECUTE') AS can_execute")).rows[0];
  assert.equal(acl?.who,url.username);assert.equal(acl?.can_insert,false);assert.equal(acl?.can_execute,true);
  const n=Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0]?.n??-1);
  assert.equal(n,0,"STAGE3_REAL_PG_PREEXISTING_FACTS_FORBIDDEN");
  const realFetch:typeof fetch=async(input,init)=>{
   heartbeat?.assertLive();
   const u=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
   assert(u.protocol==="https:"&&["lter.kbs.msu.edu","nomads.ncep.noaa.gov"].includes(u.hostname),"STAGE3_REAL_GFS_KBS_ONLY");
   realGets++;assert(realGets<=260,"STAGE3_REAL_PROVIDER_HTTP_REQUEST_BUDGET");
   const sourceSignal=input instanceof Request?input.signal:undefined;
   const signals=[init?.signal,sourceSignal,heartbeat?.signal].filter((v):v is AbortSignal=>!!v);
   const signal=signals.length?AbortSignal.any(signals):undefined;
   const started=Date.now();try{return await fetch(input,{...init,signal});}finally{
    phase.real_provider_https_elapsed_ms=Number(phase.real_provider_https_elapsed_ms??0)+Date.now()-started;
   }
  };
  const epoch="cap09-stage3-full-real-"+id;
  const core=composeIsolatedMcftCap09V13ProducerCoreV1({
   pool,epoch_id:epoch,subject_sha:subject,isolated_run_id:id,
   private_store:{endpoint:endpoint.toString(),bucket,region:need("PHASE7_PRIVATE_S3_REGION"),
    access_key_id:need("PHASE7_PRIVATE_S3_ACCESS_KEY_ID"),
    secret_access_key:need("PHASE7_PRIVATE_S3_SECRET_ACCESS_KEY"),
    allow_insecure_http_for_test:true},fetch_impl:realFetch,python_executable:pinnedPython});
  assert.equal(core.production_wrapper_composer_reused,false);
  const raw=core.retention;
  const r1=raw.retainRawEvidence.bind(raw),r2=raw.retainRawEvidenceFile.bind(raw);
  raw.retainRawEvidence=async input=>{
   const t=Date.now();try{heartbeat?.assertLive();s3PutInitiated=true;s3PutInFlight++;try{const result=await r1(input);heartbeat?.assertLive();return result;}finally{s3PutInFlight--;}}finally{rawMs+=Date.now()-t;}};
  raw.retainRawEvidenceFile=async input=>{
   const t=Date.now();try{heartbeat?.assertLive();s3PutInitiated=true;s3PutInFlight++;try{const result=await r2(input);heartbeat?.assertLive();return result;}finally{s3PutInFlight--;}}finally{rawMs+=Date.now()-t;}};
  const candidate=core.candidate_store,c1=candidate.writeCandidateManifest.bind(candidate);
  candidate.writeCandidateManifest=async input=>{
   const t=Date.now();try{heartbeat?.assertLive();s3PutInitiated=true;s3PutInFlight++;try{const result=await c1(input);heartbeat?.assertLive();return result;}finally{s3PutInFlight--;}}finally{manifestMs+=Date.now()-t;}};
  const continuity=new PostgresExternalFormalForcingBaseContinuityRepositoryV1(pool,{
   scope:MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,epoch_id:epoch,subject_sha:subject,
   first_required_base:base,last_required_base:base});
  const lifecycle=new PostgresExternalFormalForcingControllerLifecycleV1(pool,{
   scope:MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,epoch_id:epoch,subject_sha:subject});
  const started=Date.now();
  await continuity.initializeCursor();
  const c=await lifecycle.acquireOrRenew({lease_owner:"cap09-full-"+id,lease_duration_seconds:1800});
  assert.equal(c.status,"ACQUIRED");
  const x=await continuity.claimNextMissingBase({lease_owner:"cap09-full-claim-"+id,lease_duration_seconds:1800});
  assert.equal(x.status,"CLAIMED");assert.equal(x.claim.base_target_t,base);
  await continuity.advanceClaimPhaseUnderController({controller_lease:c.lease,claim:x.claim,phase:"ACQUIRING"});
  phase.claim_and_controller_ms=Date.now()-started;
  heartbeatJournalFd=fs.openSync(path.join(output,"STAGE3_HEARTBEAT_EVENTS_TEST_ONLY.jsonl"),"wx",0o600);
  heartbeat=createStage3TestOnlyDualHeartbeatV1({
    lifecycle,continuity,initial_controller_lease:c.lease,initial_producer_claim:x.claim,
    lease_duration_seconds:1800,heartbeat_interval_ms:60000,
     run_start_ms:start,
    on_event:(event:Record<string,unknown>)=>{
      if(heartbeatJournalFd===null)throw Error("STAGE3_HEARTBEAT_JOURNAL_NOT_OPEN");
      const line=Buffer.from(JSON.stringify(event)+"\n","utf8");
      fs.writeSync(heartbeatJournalFd,line,0,line.length);
      fs.fsyncSync(heartbeatJournalFd);
    }
  });
  step="ORIGINAL_REAL_KBS_AND_FULL_GFS_72H_CAPTURE";
  const captureStart=Date.now();
  receipt.actual_windows_node_sha256="sha256:"+crypto.createHash("sha256").update(fs.readFileSync(process.execPath)).digest("hex");
  receipt.actual_python_executable=pinnedPython;
  receipt.real_provider_network_capture_required=true;
  const captured=await heartbeat.run(({assertLive}:any)=>{assertLive();return core.capture_promotion.captureExactBase({
    base_target_t:base,subject_sha:subject,idempotency_key:x.claim.idempotency_key
  });});
  phase.capture_full_ms=Date.now()-captureStart;
  phase.raw_s3_retain_ms=rawMs;
  phase.candidate_s3_ms=manifestMs;
  phase.provider_decode_controller_ms=Number(phase.capture_full_ms)-rawMs-manifestMs;
  assert(Number(phase.provider_decode_controller_ms)>=0);
  assert.equal(captured.formal_database_write_count,0);
  assert.equal(captured.raw_values_emitted,false);
  step="REAL_FENCED_PG_COMMIT";
  const {committed,attested}=await heartbeat.run(async({assertLive}:any)=>{
    assertLive();
    // Re-read current lease snapshots at every boundary. Fencing tokens must
    // never be reacquired/taken over; heartbeats keep the same owner's leases.
    let leases=heartbeat.snapshot();
    phase.promotion_intent_at=new Date().toISOString();
    await continuity.advanceClaimPhaseUnderController({
      controller_lease:leases.controller_lease,claim:leases.producer_claim,phase:"READY_TO_FINALIZE"
    });
    leases=heartbeat.snapshot();
    await continuity.advanceClaimPhaseUnderController({
      controller_lease:leases.controller_lease,claim:leases.producer_claim,phase:"PROMOTING"
    });
    const promoteStart=Date.now();
    leases=heartbeat.snapshot();
    assertLive();
    phase.promotion_in_flight_at=new Date().toISOString();
    receipt.physical_commit_state="UNKNOWN_POST_PROMOTION_ENTRY";
    const promoted=await core.capture_promotion.promoteExactBase({
      base_target_t:base,subject_sha:subject,idempotency_key:leases.producer_claim.idempotency_key,
      capture:captured,controller_lease:leases.controller_lease,producer_claim:leases.producer_claim
    });
    phase.fenced_promotion_ms=Date.now()-promoteStart;
    receipt.physical_commit_state=promoted.database_fence_commit_succeeded===true?"REPORTED_COMMITTED_PENDING_READBACK":"UNKNOWN";
    phase.promotion_returned_at=new Date().toISOString();
    assert.equal(promoted.database_fence_commit_succeeded,true);
    assert.equal(promoted.formal_fact_present_count,3);
    step="CONTROLLER_POST_COMMIT_READBACK";
    const readStart=Date.now();
    leases=heartbeat.snapshot();
    assertLive();
    const visible=await continuity.attestFormalPhysicalVisibilityUnderController({
      controller_lease:leases.controller_lease,claim:leases.producer_claim,facts:promoted.facts,
      producer_run_id:captured.producer_run_id,promotion_run_id:promoted.promotion_run_id,
      candidate_artifact_digest:captured.candidate_artifact_digest
    });
    phase.physical_readback_ms=Date.now()-readStart;
    assert.equal(visible.status,"PASS");assert.equal(visible.cursor_advanced,true);
    receipt.physical_commit_state="COMMITTED_AND_ATTESTED";
    phase.attested_at=new Date().toISOString();
    return {committed:promoted,attested:visible};
  });
  const facts=Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0]?.n??-1);
  assert.equal(facts,3);
  receipt.status="PASS_WINDOWS_ONE_FULL_REAL_GFS72_KBS_S3_PG_BASE_HEARTBEAT_TEST_ONLY_NOT_ORIGINAL_V13";
  receipt.gfs_72h_complete_with_actual_scientific_decoder=true;
  receipt.kbs_continuity_actual_scientific_decoder=true;
  receipt.physical_fenced_fact_count=facts;
  receipt.controller_cursor_advanced=true;
  receipt.candidate_digest=captured.candidate_artifact_digest;
 }catch(e){receipt.status="HOLD_REAL_FULL_PROVIDER_OR_PHYSICAL_CHAIN";
   receipt.physical_commit_state=receipt.physical_commit_state??"NOT_ENTERED_PROMOTION";
  receipt.reason_code=boundedFailure(e);receipt.failure_stage=step;}
 finally{
  await pool.end();
  if(heartbeatJournalFd!==null){fs.fsyncSync(heartbeatJournalFd);fs.closeSync(heartbeatJournalFd);heartbeatJournalFd=null;}
  receipt.lease_heartbeats_test_only=heartbeat?heartbeat.evidence():null;
  receipt.s3_object_write_attempted_test_only=s3PutInitiated;
  receipt.s3_inflight_at_finalization=s3PutInFlight;
  receipt.requires_independent_readonly_s3_reconciliation=receipt.status==="HOLD_REAL_FULL_PROVIDER_OR_PHYSICAL_CHAIN"&&s3PutInitiated;
  receipt.s3_write_cancellation_limitation="IN_FLIGHT_HTTP_PUT_MAY_FINISH_AFTER_ABORT_REQUIRE_READONLY_RECONCILIATION";
  receipt.requires_independent_readonly_pg_reconciliation=["UNKNOWN_POST_PROMOTION_ENTRY","REPORTED_COMMITTED_PENDING_READBACK","UNKNOWN"].includes(String(receipt.physical_commit_state));
  receipt.real_provider_get_count=realGets;receipt.timing_phases_test_only=phase;
  receipt.total_elapsed_ms=Date.now()-start;
  receipt.qualified=false;receipt.permit_signed=false;receipt.permit_consumed=false;
  receipt.windows_native_execution=true;receipt.ci_execution=false;receipt.real_original_six_stage_count=0;
  const dest=path.join(output,"STAGE3_FULL_REAL_KBS_GFS_S3_PG_ONE_BASE_HEARTBEAT_RESULT.json");
  fs.writeFileSync(dest,JSON.stringify(receipt,null,2)+"\n",{flag:"wx"});
  console.log(JSON.stringify({status:receipt.status,reason_code:receipt.reason_code??null,
   real_gets:realGets,elapsed_ms:receipt.total_elapsed_ms,receipt:dest,permit:false}));
 }
 if(receipt.status!=="PASS_WINDOWS_ONE_FULL_REAL_GFS72_KBS_S3_PG_BASE_HEARTBEAT_TEST_ONLY_NOT_ORIGINAL_V13")process.exitCode=3;
}
main().catch(e=>{console.error("STAGE3_FULL_REAL_PG_HOLD:"+boundedFailure(e));process.exitCode=1;});
