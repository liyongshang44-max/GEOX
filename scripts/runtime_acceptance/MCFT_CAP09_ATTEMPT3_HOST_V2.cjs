"use strict";
/*
 * Attempt-3 Windows Host V2: real six-stage dispatch. The only way into this
 * runner is a genuine signed adopted qualification and one-shot Permit V2,
 * independently rechecked by atomic.prepare(). Never share V1 permit weaksets.
 *
 * No automatic retries, no production activation, no CLI implicit execute.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto");
const c=require("../cap09_adoption_v1/contract.cjs");
const atomic=require("./MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs");
const stageCap=require("./MCFT_CAP09_STAGE_CAPABILITY_V2.cjs");
const child=require("./MCFT_CAP09_ATTEMPT3_CHILD_STAGE_V2.cjs");
const {dispatchConsumedStageV2}=require("./MCFT_CAP09_PARENT_STAGE_DISPATCH_V2.cjs");
const scheduler=require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
const {freshStageLaunch}=require("./MCFT_CAP09_STAGE_START_CLOCK_V1.cjs");
const current=require("./MCFT_CAP_09_CURRENT_BASELINE_EXECUTION_V1.cjs");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");

// Exact, read-only, authenticated PostgreSQL admission. This runs on the
// Windows operator host with precisely the URLs passed to every child.
// Signed resource facts alone are not equivalent to authenticating as the
// per-run Evidence roles or verifying the actual schema and fenced writer.
const scopedEvidence=require("./MCFT_CAP09_QUALIFICATION_EVIDENCE_IDENTITY_V1.cjs");
const FENCED_WRITER="public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb)";
const REQUIRED_PUBLIC_TABLES=Object.freeze([
 "facts",
 "twin_action_feedback_cycle_projection_v1",
 "twin_action_feedback_evidence_index_v1",
 "twin_action_feedback_projection_v1",
 "twin_active_lineage_index_v1",
 "twin_approved_plan_binding_projection_v1",
 "twin_decision_record_projection_v1",
 "twin_external_formal_forcing_base_cursor_v1",
 "twin_external_formal_forcing_base_target_v1",
 "twin_external_formal_forcing_controller_lease_v1",
 "twin_forecast_point_projection_v1",
 "twin_forecast_residual_projection_v1",
 "twin_forecast_result_latest_index_v1",
 "twin_forecast_run_projection_v1",
 "twin_forecast_success_latest_index_v1",
 "twin_object_idempotency_index_v1",
 "twin_runtime_authority_snapshot_v1",
 "twin_runtime_checkpoint_latest_index_v1",
 "twin_runtime_health_latest_index_v1",
 "twin_runtime_lease_v1",
 "twin_scenario_latest_index_v1",
 "twin_scenario_point_projection_v1",
 "twin_scenario_set_projection_v1",
 "twin_scenario_set_uniqueness_v1",
 "twin_shadow_online_scheduler_cursor_v1",
 "twin_shadow_online_scheduler_slot_v1",
 "twin_state_history_projection_v1",
 "twin_state_latest_index_v1",
 "twin_terminal_tick_uniqueness_v1"
]);
assert.equal(REQUIRED_PUBLIC_TABLES.length,29,"V2_PG_EXACT_29_TABLE_CONTRACT");

function scopedDbConnectionBindings(admission,environment){
 const owner=admission?.resourceEnvelope?.payload;
 const run=admission?.permitEnvelope?.payload?.run_id;
 assert(/^[0-9a-f]{12}$/.test(run||""),"V2_PG_RUN_ID_REQUIRED");
 assert(owner&&owner.run_id===run,"V2_PG_SIGNED_RESOURCE_RUN_MISMATCH");
 assert.equal(owner.database_host,"127.0.0.1","V2_PG_SIGNED_HOST_REQUIRED");
 assert(Number.isInteger(owner.database_port),"V2_PG_SIGNED_PORT_REQUIRED");
 const positive="mcft_cap09_requal_"+run+"_positive";
 const negative="mcft_cap09_requal_"+run+"_negative";
 assert.equal(owner.positive_database,positive,"V2_PG_SIGNED_POSITIVE_DATABASE");
 assert.equal(owner.negative_database,negative,"V2_PG_SIGNED_NEGATIVE_DATABASE");
 return [
  {side:"positive",database:positive,raw:environment?.DATABASE_URL},
  {side:"negative",database:negative,raw:environment?.BLOCKED_DATABASE_URL}
 ].map(row=>{
  assert(typeof row.raw==="string"&&row.raw.length>0,"V2_PG_URL_REQUIRED:"+row.side);
  let u;
  try{u=new URL(row.raw);}catch{throw new Error("V2_PG_URL_INVALID");}
  assert(["postgres:","postgresql:"].includes(u.protocol),"V2_PG_SCHEME_INVALID");
  assert.equal(u.hostname,owner.database_host,"V2_PG_ENDPOINT_HOST_MISMATCH");
  assert.equal(u.port,String(owner.database_port),"V2_PG_ENDPOINT_PORT_MISMATCH");
  assert(!u.search&&!u.hash,"V2_PG_URL_OVERRIDE_FORBIDDEN");
  assert(u.password.length>0,"V2_PG_EXPLICIT_PASSWORD_REQUIRED");
  const role=scopedEvidence.expectedEvidenceLogin({
   stage:"PRODUCER",positive,negative,database:row.database,connectionString:row.raw
  }); // Preserve SCOPED_EVIDENCE_URL_ROLE_MISMATCH (never weaken).
  return Object.freeze({side:row.side,database:row.database,role,url:row.raw});
 });
}

function assertPgCatalogContract(binding,facts){
 assert.equal(facts.session_user,binding.role,"V2_PG_SESSION_LOGIN_MISMATCH:"+binding.side);
 assert.equal(facts.current_user,binding.role,"V2_PG_EFFECTIVE_LOGIN_MISMATCH:"+binding.side);
 assert.equal(facts.database,binding.database,"V2_PG_AUTHENTICATED_DATABASE_MISMATCH:"+binding.side);
 assert.deepEqual(facts.tables,REQUIRED_PUBLIC_TABLES,"V2_PG_EXACT_29_TABLE_SCHEMA_MISMATCH:"+binding.side);
 assert.equal(facts.fenced_exists,true,"V2_PG_FENCED_WRITER_MISSING:"+binding.side);
 assert.equal(facts.direct_insert,false,"V2_PG_DIRECT_FACT_INSERT_FORBIDDEN:"+binding.side);
 assert.equal(facts.fenced_execute,true,"V2_PG_FENCED_WRITER_EXECUTE_REQUIRED:"+binding.side);
 assert.equal(facts.controller_acl,true,"V2_PG_CONTROLLER_TABLE_ACL_REQUIRED:"+binding.side);
}

// Do not accept a caller-supplied client, pretend a CI mock authenticated,
// or persist the connection string. The real pg client resolves from the
// signed installed release and connects with the unchanged child URLs.
async function probePreconsumePostgres({admission,releaseRoot,environment}){
 const bindings=scopedDbConnectionBindings(admission,environment);
 assert(path.isAbsolute(releaseRoot),"V2_PG_RELEASE_ROOT_REQUIRED");
 const pg=require(require.resolve("pg",{paths:[releaseRoot]}));
 assert(typeof pg.Pool==="function","V2_PG_CLIENT_MISSING");
 for(const binding of bindings){
  const pool=new pg.Pool({connectionString:binding.url,max:1,connectionTimeoutMillis:5000,
   query_timeout:5000,statement_timeout:5000});
  let client,transaction=false;
  try{
   client=await pool.connect();
   await client.query("BEGIN TRANSACTION READ ONLY");
   transaction=true;
   const id=(await client.query("SELECT session_user::text AS session_user,current_user::text AS current_user,current_database()::text AS database")).rows[0];
   const tables=(await client.query(
    "SELECT c.relname::text AS name FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname"
   )).rows.map(x=>x.name);
   const privileges=(await client.query(
    "SELECT to_regprocedure($1::text) IS NOT NULL AS fenced_exists, "+
    "has_table_privilege(current_user,'public.facts','INSERT') AS direct_insert",
    [FENCED_WRITER]
   )).rows[0];
   const fencedExecute=privileges.fenced_exists
    ?(await client.query("SELECT has_function_privilege(current_user,$1::text,'EXECUTE') AS allowed",[FENCED_WRITER])).rows[0]?.allowed
    :false;
   const controllerAcl=(await client.query(
    "SELECT bool_and("+
    "has_table_privilege(current_user,'public.'||name,'SELECT') AND "+
    "has_table_privilege(current_user,'public.'||name,'INSERT') AND "+
    "has_table_privilege(current_user,'public.'||name,'UPDATE')) AS allowed FROM (VALUES "+
    "('twin_external_formal_forcing_base_cursor_v1'),"+
    "('twin_external_formal_forcing_base_target_v1'),"+
    "('twin_external_formal_forcing_controller_lease_v1')) AS t(name)"
   )).rows[0]?.allowed;
   assertPgCatalogContract(binding,{...id,tables,...privileges,fenced_execute:fencedExecute,controller_acl:controllerAcl});
   await client.query("ROLLBACK");
   transaction=false;
  }catch(error){
   // Existing assertion codes are safe; never copy pg errors, URLs or passwords.
   if(error?.code==="ERR_ASSERTION"&&
      (/^(V2_PG_|SCOPED_EVIDENCE_)/).test(error.message||""))throw error;
   throw new Error("V2_PG_"+binding.side.toUpperCase()+"_READONLY_PROBE_FAILED");
  }finally{
   if(client){if(transaction){try{await client.query("ROLLBACK");}catch{}}
    client.release();}
   await pool.end();
  }
 }
 return Object.freeze({status:"EXACT_RUN_SCOPED_PG_ROLES_SCHEMA_FENCED_ACL_READONLY_VERIFIED",
  databases_verified:2,table_count_per_database:29,production_authorized:false});
}

const STAGES=Object.freeze([
 ["PRODUCER","MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2_RESULT.json"],
 ["TIMING_1","MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE1_V2_RESULT.json"],
 ["TIMING_2","MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE2_V2_RESULT.json"],
 ["TIMING_3","MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_SAMPLE3_V2_RESULT.json"],
 ["CONTROLLED_DELAY","MCFT_CAP09_REAL_CONTROLLED_DELAY_V1_RESULT.json"],
 ["AGGREGATE","MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2_RESULT.json"]
]);
function regular(file){const s=fs.lstatSync(file);assert(s.isFile()&&!s.isSymbolicLink(),"V2_HOST_STAGE_SOURCE_UNSAFE");return sha(fs.readFileSync(file));}
function boundStages({releaseRoot,material,plan,outputRoot,firstBase,runId,subjectSha,nonce,ledgerRoot,permitSha,observationsSha,observedFile,environment}){
 scheduler.validateStagePlan(plan);
 assert.deepEqual(STAGES.map(x=>x[0]),scheduler.STAGES,"V2_STAGE_PLAN_DIFFERS_FROM_REAL_SCHEDULER");
 assert(path.isAbsolute(releaseRoot)&&path.isAbsolute(outputRoot)&&path.isAbsolute(ledgerRoot));
 assert.equal(path.resolve(__dirname),path.join(releaseRoot,"scripts","runtime_acceptance"),"V2_HOST_MUST_RUN_INSIDE_INSTALLED_RELEASE");
 assert(typeof firstBase==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\.000Z$/.test(firstBase)&&
  Number.isFinite(Date.parse(firstBase))&&Date.parse(firstBase)>Date.now(),"V2_FIRST_BASE_NOT_FUTURE");
 assert(/^[a-f0-9]{12}$/.test(runId)&&/^[a-f0-9]{40}$/.test(subjectSha)&&/^[a-f0-9]{64}$/.test(nonce));
 c.hash(permitSha);c.hash(observationsSha);
 assert(typeof material==="object"&&Array.isArray(material.files),"V2_INSTALLED_MATERIAL_REQUIRED");
 const entries=new Map(material.files.map(x=>[x.path,x.sha256]));
 assert(entries.size===material.files.length,"V2_INSTALLED_FILE_IDENTITY_DUPLICATE");
 assert(path.relative(releaseRoot,outputRoot).startsWith(".."+path.sep),"V2_OUTPUT_MUST_NOT_BE_IN_RELEASE");
 assert(!fs.existsSync(outputRoot),"V2_OUTPUT_NOT_FRESH");
 const codeRoot=path.join(releaseRoot,"scripts","runtime_acceptance");
 const expectedFile=new Set(STAGES.map(x=>x[1]));
 assert(expectedFile.size===6,"V2_ARTIFACT_SET_CHANGED");
 const targets=current.isolatedTargets({isolated_run_id:runId,qualification_first_base:firstBase},
  {...environment,MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR:outputRoot,MCFT_QUALIFICATION_FIRST_BASE:firstBase});
 assert.equal(path.resolve(targets.out),path.resolve(outputRoot));
 const node=material.tools?.node?.path;
 assert.equal(fs.realpathSync(process.execPath),node,"V2_NODE_TOOL_NOT_BOUND");
 const tsx=require.resolve("tsx",{paths:[releaseRoot]});
 assert(regular(tsx),"V2_TSX_DEPENDENCY_REQUIRED");
 const envBase={...environment,MCFT_ATTEMPT3_V2_CHILD:"1",MCFT_SUBJECT_SHA:subjectSha,
  MCFT_GOVERNED_RETRY_RUN_ID:runId,
  MCFT_ATTEMPT3_V2_LEDGER_ROOT:ledgerRoot,MCFT_ATTEMPT3_V2_NONCE:nonce,
  MCFT_ATTEMPT3_V2_PERMIT_ENVELOPE_SHA256:permitSha,
  MCFT_ATTEMPT3_V2_OBSERVED_FILE:observedFile,
  MCFT_ATTEMPT3_V2_OBSERVATIONS_SHA256:observationsSha,
  MCFT_QUALIFICATION_FIRST_BASE:firstBase,
  MCFT_CURRENT_QUALIFICATION_OUTPUT_DIR:outputRoot,
  MCFT_CAP09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION:"1",
  MCFT_CAP09_V13_EXACT_HEAD_TIMING_SAMPLE:"1",
  MCFT_TIMING_SAMPLE_DIR:outputRoot,MCFT_TIMING_RUN_ID:String(parseInt(runId,16)),
  MCFT_TIMING_RUN_ATTEMPT:"1",MCFT_TIMING_WAKE_DELAY_MS:"0",
  MCFT_TIMING_JOB_START_SETUP_MS:"0",MCFT_TIMING_LOCAL_LAUNCH_AT_MS:String(Date.now()),
  MCFT_GOVERNED_RETRY_DELAY_TIMEOUT_MS:String(plan.stages[4].timeout_ms)};
 const steps=STAGES.map(([id,artifact],i)=>{
  const script=path.join(codeRoot,child.SCRIPT[id]);
  assert.equal(path.resolve(script),path.join(codeRoot,child.SCRIPT[id]));
  const sourceKey="scripts/runtime_acceptance/"+child.SCRIPT[id];
  const actualSha=regular(script);
  assert.equal(entries.get(sourceKey),actualSha,"V2_STAGE_SCRIPT_NOT_IN_SIGNED_RELEASE:"+id);
  const js=script.endsWith(".cjs");
  const args=js?[script]:["--import","tsx",script];
  const env={...envBase,MCFT_GOVERNED_RETRY_STAGE:id,
    ...(id.startsWith("TIMING_")?{
       MCFT_TIMING_SAMPLE_ID:"sample"+id.at(-1),
       MCFT_TIMING_BASE_TARGET:new Date(Date.parse(firstBase)+(i-1)*3600000).toISOString()
    }:{})};
  return {id,script,artifact:path.join(outputRoot,artifact),
   cwd:releaseRoot,executable:node,args,env};
 });
 assert(steps.length===6);
 return Object.freeze(steps);
}
function checkPreconsume({admission,plan,observed,outputRoot,firstBase,environment}){
 const {adoptionRequest,releaseRoot,permitEnvelope,context}=admission;
 assert(adoptionRequest&&permitEnvelope&&context,"V2_REAL_ADMISSION_REQUIRED");
 assert(permitEnvelope.payload?.scope==="ISOLATED_QUALIFICATION_SINGLE_ATTEMPT_TEST_ONLY","V2_SCOPE_WRONG");
 assert(permitEnvelope.payload?.production_authorized===false,"V2_PRODUCTION_FORBIDDEN");
 assert.equal(c.digest(plan),permitEnvelope.payload.plan_sha256,"V2_STAGE_PLAN_NOT_SIGNED");
 assert.equal(c.digest(observed),permitEnvelope.payload.observations_sha256,"V2_OBSERVATIONS_NOT_SIGNED");
 assert.equal(context.plan_sha256,permitEnvelope.payload.plan_sha256,"V2_CONTEXT_PLAN_NOT_SIGNED");
 assert.equal(context.observations_sha256,permitEnvelope.payload.observations_sha256);
 const root=admission.trust.ledger_root,runId=permitEnvelope.payload.run_id;
 const run=path.join(root,"run-"+runId),nonce=path.join(root,"nonce-"+permitEnvelope.payload.nonce);
 assert(!fs.existsSync(run)&&!fs.existsSync(nonce),"V2_LEDGER_ALREADY_CONSUMED");
 assert(Date.now()+plan.stages.reduce((n,x)=>n+x.timeout_ms,0)+60000 <
  Date.parse(permitEnvelope.payload.expires_at),"V2_SIGNED_PERMIT_INSUFFICIENT_REMAINING_BUDGET");
 assert(!fs.existsSync(outputRoot),"V2_OUTPUT_ALREADY_EXISTS");
 // Each child must run a fixed signed source; no caller-provided script list.
 return boundStages({releaseRoot,material:adoptionRequest.material,plan,outputRoot,firstBase,
  runId,subjectSha:permitEnvelope.payload.subject_sha,nonce:permitEnvelope.payload.nonce,
  ledgerRoot:root,permitSha:sha(require("../governance_acceptance/MCFT_CAP09_ADOPTION_V2_ATTEMPT3_ENGINEERING_GATE_V1.cjs").canonical(permitEnvelope)),
  observationsSha:permitEnvelope.payload.observations_sha256,
  observedFile:path.join(outputRoot,"SIGNED_OBSERVED_V2.json"),environment});
}
function persistOnce(file,obj){
 const fd=fs.openSync(file,"wx",0o600);
 try{fs.writeFileSync(fd,JSON.stringify(obj,null,2)+"\n");fs.fsyncSync(fd);}
 finally{fs.closeSync(fd);}
}

async function preflight({admission,plan,observed,outputRoot,firstBase,environment=process.env}){
 assert(process.platform==="win32"&&!environment.CI&&!environment.GITHUB_ACTIONS,"V2_HOST_WINDOWS_ONLY");
 assert(!environment.NODE_OPTIONS&&!environment.NODE_PATH,"V2_HOST_NODE_INJECTION_FORBIDDEN");
 const steps=checkPreconsume({admission,plan,observed,outputRoot,firstBase,environment});
 const prepared=atomic.prepare(admission);
 const database=await probePreconsumePostgres({admission,releaseRoot:admission.releaseRoot,environment});
 assert.equal(steps.length,6,"V2_STAGE_DISPATCH_NOT_COMPLETE");
 assert.equal(atomic.HOST_V2_STAGE_DISPATCH_ADOPTED,true,"V2_STAGE_ROUTE_NOT_ADOPTED");
 // Read-only preflight: Permit neither consumed nor reissued, no output/DB/S3 mutation.
 return Object.freeze({status:"ATTEMPT3_V2_SIX_STAGE_WINDOWS_PREFLIGHT_PASS_NOT_EXECUTED",
  run_id:prepared.run_id,subject_sha:prepared.subject_sha,
  fixed_stages:steps.map(s=>s.id),permit_consumed:false,original_six_stages_executed:0,
  host_v2_route_implemented:true,postgres_preconsume:database.status,production_authorized:false});
}

async function execute({admission,plan,observed,outputRoot,firstBase,environment=process.env}){
 assert(process.platform==="win32"&&!environment.CI&&!environment.GITHUB_ACTIONS,"V2_HOST_WINDOWS_ONLY");
 assert(!environment.NODE_OPTIONS&&!environment.NODE_PATH,"V2_HOST_NODE_INJECTION_FORBIDDEN");
 assert(!environment.MCFT_ATTEMPT3_V2_CHILD&&!environment.MCFT_GOVERNED_RETRY_TICKET,
  "V2_PARENT_CANNOT_BE_CHILD");
 // Everything that can be checked without effects MUST precede Permit burn.
 const steps=checkPreconsume({admission,plan,observed,outputRoot,firstBase,environment});
 const prepared=atomic.prepare(admission); // live main, qualified signatures, resource readback, PG/S3 full chain
 await probePreconsumePostgres({admission,releaseRoot:admission.releaseRoot,environment});
 const check=cp.spawnSync(environment.MCFT_PYTHON_EXECUTABLE||"python",[
  path.join(admission.releaseRoot,"apps/server/src/external_evidence/provider/python/mcft_cap09_gfs_scientific_core_v1.py"),"selftest"
 ],{cwd:admission.releaseRoot,timeout:60000,encoding:"utf8",maxBuffer:1024*1024});
 assert.equal(check.status,0,"V2_SCIENTIFIC_SELFTEST_FAILED:"+String(check.stderr||"").slice(-300));
 // Re-evaluate mutable slots and expiry immediately before the irreversible action.
 checkPreconsume({admission,plan,observed,outputRoot,firstBase,environment});
 await probePreconsumePostgres({admission,releaseRoot:admission.releaseRoot,environment});
 const consumed=atomic.consumeForQualifiedHost(prepared);
 const authority=stageCap.initializeStageAuthority(consumed,admission.permitEnvelope.payload,
  prepared.permit_envelope_sha256);
 fs.mkdirSync(outputRoot,{mode:0o700});
 persistOnce(path.join(outputRoot,"SIGNED_OBSERVED_V2.json"),observed);
 persistOnce(path.join(outputRoot,"STARTED_ATTEMPT3_V2.json"),{
  schema_version:"MCFT_CAP09_ATTEMPT3_V2_RUN_STARTED",run_id:prepared.run_id,
  subject_sha:prepared.subject_sha,started_at:new Date().toISOString(),
  stage_count:0,permit_consumed:true,production_authorized:false});
 // Six genuine child processes; any failure retains original receipts and stops.
 const result=await scheduler.executeSixStages({authority,plan,steps,
  dispatch:async(a,step)=>dispatchConsumedStageV2(a,freshStageLaunch(step)),
  assertConsumed:atomic.assertConsumed});
 assert.equal(result.stage_count,6,"V2_ACTUAL_SIX_STAGE_COUNT_REQUIRED");
 return {status:"ATTEMPT3_V2_SIX_STAGE_PHYSICAL_RECEIPTS_PRESERVED_NOT_PRODUCTION",
  run_id:prepared.run_id,stage_count:result.stage_count,
  final_receipt_sha256:result.final_receipt_sha256,
  output:outputRoot,production_authorized:false};
}
module.exports={STAGES,boundStages,checkPreconsume,preflight,execute,probePreconsumePostgres,scopedDbConnectionBindings,assertPgCatalogContract,REQUIRED_PUBLIC_TABLES};
