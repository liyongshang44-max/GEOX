#!/usr/bin/env node
"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const cp=require("node:child_process");
const {Pool}=require("pg");
const {
 ROOT,HOUR,MEASUREMENT_LEAD_MS,AUTHORITY_MATERIALIZATION_MARGIN_MS,digestFile,safeRepoRef,selectA0,validateGfsPairRows,
}=require("./MCFT_CAP_09_AM22_GFS_BOOTSTRAP_V1.cjs");
const {SCOPE}=require("./MCFT_CAP_09_AM22_EVIDENCE_CLOCK_V2.cjs");

const OWNER_POLICY_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-OWNER-CUTOVER-AUTHORITY-V1.json";
const A0_POLICY_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRE-FORMAL-A0-PLANNING-AUTHORITY-V1.json";
const BOOTSTRAP_A0_POLICY_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-BOOTSTRAP-A0-PLANNING-AUTHORITY-V1.json";
const REGISTRY_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const STAGE_CERT_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json";
const BUDGET_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json";
const BUILDER_REL="scripts/runtime_acceptance/BUILD_MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_V1.cjs";
const VERIFY_REL="scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1.cjs";
const ATTEST_REL="acceptance-output/MCFT_CAP_09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_V1_RESULT.json";
const COMPOSE_REL="docker-compose.mcft-cap09-production-preformal.yml";
const OVERLAY_REL="docker-compose.mcft-cap09-am22-gfs-bootstrap-v1.yml";
const HOST_ID_FILE=path.join(os.homedir(),".geox","mcft-cap09","local-host-id-v1");
const EVIDENCE_SERVICE="geox-mcft-cap09-evidence-runtime-v1";
const TWIN_SERVICE="geox-mcft-cap09-twin-runtime-v1";
const READY_MARGIN_MS=MEASUREMENT_LEAD_MS;
const POLL_MS=15000,MAX_HOST_DB_CLOCK_SKEW_MS=60000;

function read(rel){return JSON.parse(fs.readFileSync(path.join(ROOT,rel),"utf8"));}
function fail(code,detail){throw new Error(detail===undefined?code:code+":"+String(detail));}
function reqEnv(name){const v=String(process.env[name]??"").trim();if(!v)fail("AM22_GFS_BOOTSTRAP_ENV_REQUIRED",name);return v;}
function arg(name){return process.argv.slice(2).find(x=>x.startsWith(name+"="))?.slice(name.length+1);}
function exec(file,args,options={}){
 return cp.execFileSync(file,args,{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"],env:options.env??process.env,timeout:options.timeoutMs}).trim();
}
function git(...args){return exec("git",args);}
function immutable(file,value){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify(value,null,2)+"\n",{flag:"wx",mode:0o600});
}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+"\n",{mode:0o600});}
function sleep(ms){cp.execFileSync(process.execPath,["-e",`setTimeout(()=>{},${ms})`],{stdio:"ignore"});}
function databaseName(url){return decodeURIComponent(new URL(url).pathname.slice(1));}
function readOnlyPool(url,expected){
 if(databaseName(url)!==expected)fail("AM22_GFS_BOOTSTRAP_DATABASE_NAME_MISMATCH",databaseName(url));
 return new Pool({connectionString:url,max:1,options:"-c default_transaction_read_only=on -c statement_timeout=15000",connectionTimeoutMillis:15000,query_timeout:20000});
}
async function databaseNow(pool){
 const row=(await pool.query("SELECT clock_timestamp() AS now,current_setting('default_transaction_read_only') AS ro")).rows[0];
 assert.equal(row.ro,"on","AM22_GFS_BOOTSTRAP_READ_ONLY_OBSERVER_REQUIRED");
 return new Date(row.now).toISOString();
}
function latestRegistryEntry(registry,sourceNow,o23){
 const eligible=registry.entries.filter(x=>
   Date.parse(x.authority_as_of)<=Date.parse(sourceNow)&&
   Date.parse(x.authority_valid_until)>=Date.parse(o23)&&
   ["EFFECTIVE_FOR_RUNTIME_CONSUMPTION","EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH"].includes(x.graduation_status)
 ).sort((a,b)=>Date.parse(b.authority_as_of)-Date.parse(a.authority_as_of));
 if(!eligible[0])fail("AM22_GFS_BOOTSTRAP_NO_EFFECTIVE_STAGE_COVERING_O23");
 return eligible[0];
}
async function gfsPairRows(pool,a0){
 const now=await databaseNow(pool);
 const rows=(await pool.query(`
SELECT fact_id,
       record_json->>'type' AS record_type,
       record_json#>>'{payload,source_payload,target_logical_time}' AS target_logical_time,
       record_json#>>'{payload,source_payload,selected_cycle}' AS selected_cycle,
       record_json#>>'{payload,quality,raw_source_sha256}' AS raw_source_sha256,
       record_json#>>'{payload,available_to_runtime_at}' AS available_to_runtime_at,
       record_json#>>'{payload,role_time,ingested_at}' AS ingested_at
FROM public.facts
WHERE source='mcft_cap09_external_formal_evidence_v1'
  AND record_json->>'type' IN ('future_weather_assumption_v1','future_et0_assumption_v1')
  AND record_json#>>'{payload,source_payload,target_logical_time}'=$1
ORDER BY record_json->>'type',fact_id
`,[a0])).rows;
 return rows.map(r=>({...r,observed_database_now:now}));
}
async function assertTwinStillPreFormal(pool){
 const tables=["twin_state_history_projection_v1","twin_state_latest_index_v1","twin_shadow_online_scheduler_cursor_v1","twin_shadow_online_scheduler_slot_v1"];
 const counts={};
 for(const table of tables){
   const n=Number((await pool.query(`SELECT count(*) AS n FROM public."${table}"`)).rows[0].n);
   assert.equal(n,0,"AM22_GFS_BOOTSTRAP_TWIN_STATE_MUTATION_FORBIDDEN:"+table);counts[table]=n;
 }
 return counts;
}
function requirePolicies(ownerPolicy,a0Policy,bootstrapA0Policy,budget){
 assert.equal(ownerPolicy.status,"AUTHORIZED_FOR_LOCAL_OPERATOR_MANAGED_DOCKER_CUTOVER","AM22_GFS_BOOTSTRAP_OWNER_POLICY_NOT_AUTHORIZED");
 assert.equal(ownerPolicy.cutover_contract?.dual_key_required,true);
 assert.equal(ownerPolicy.cutover_contract?.evidence_owner_activation_authorized,true);
 assert.equal(ownerPolicy.cutover_contract?.twin_owner_activation_authorized,true);
 assert.equal(ownerPolicy.cutover_contract?.rollback_both_services_on_owner_verification_failure,true);
 assert.equal(ownerPolicy.cutover_contract?.twin_mode,"PRE_FORMAL_OWNER_STANDBY");
 for(const key of ["formal_v5_arm_authorized","a0_execution_authorized","o00_authorized"])assert.equal(ownerPolicy.later_authority_ceiling?.[key],false,"AM22_GFS_BOOTSTRAP_OWNER_POLICY_CEILING_DRIFT:"+key);
 assert.equal(a0Policy.status,"AUTHORIZED_FOR_RUNTIME_EVIDENCE_TARGET_PLANNING_ONLY","AM22_GFS_BOOTSTRAP_A0_PLANNING_POLICY_NOT_AUTHORIZED");
 assert.equal(a0Policy.selection_policy?.clock_authority,"LOCAL_OPERATOR_HOST_UTC_AT_CUTOVER","AM22_GFS_BOOTSTRAP_BASE_CLOCK_AUTHORITY_CHANGED");
 assert.equal(a0Policy.authority_ceiling?.runtime_evidence_target_planning_authorized,true);
 for(const key of ["formal_v5_arm_authorized","a0_execution_authorized","o00_execution_authorized","mcft_cap09_completed"])assert.equal(a0Policy.authority_ceiling?.[key],false,"AM22_GFS_BOOTSTRAP_A0_POLICY_CEILING_DRIFT:"+key);
 const selected=Number(budget.qualified_budget?.selected_budget_ms);
 assert.ok(Number.isSafeInteger(selected)&&budget.timing_budget_qualified===true&&budget.timing_budget_frozen===true,"AM22_GFS_BOOTSTRAP_BUDGET_NOT_FROZEN");
 assert.equal(selected,Number(a0Policy.selection_policy?.selected_budget_ms),"AM22_GFS_BOOTSTRAP_BUDGET_POLICY_MISMATCH");
 assert.equal(bootstrapA0Policy.status,"AUTHORIZED_FOR_AM22_BOOTSTRAP_EVIDENCE_AND_MEASUREMENT_PLANNING_ONLY","AM22_GFS_BOOTSTRAP_COMBINED_A0_POLICY_NOT_AUTHORIZED");
 assert.equal(bootstrapA0Policy.authority_basis?.pre_formal_a0_planning_authority_ref,A0_POLICY_REL);
 assert.equal(bootstrapA0Policy.authority_basis?.forcing_acquisition_budget_ref,BUDGET_REL);
 assert.equal(Number(bootstrapA0Policy.selection_policy?.selected_acquisition_budget_ms),selected);
 assert.equal(Number(bootstrapA0Policy.selection_policy?.required_six_phase_measurement_lead_ms),MEASUREMENT_LEAD_MS);
 assert.equal(Number(bootstrapA0Policy.selection_policy?.required_authority_materialization_to_owner_start_margin_ms),AUTHORITY_MATERIALIZATION_MARGIN_MS);
 const combined=selected+MEASUREMENT_LEAD_MS+AUTHORITY_MATERIALIZATION_MARGIN_MS;
 assert.equal(Number(bootstrapA0Policy.selection_policy?.combined_minimum_lead_ms),combined,"AM22_GFS_BOOTSTRAP_COMBINED_LEAD_MISMATCH");
 assert.equal(bootstrapA0Policy.selection_policy?.image_build_and_artifact_attestation_must_complete_before_activation_fence,true);
 assert.equal(bootstrapA0Policy.authority_ceiling?.production_owner_cutover_authorized_by_this_authority,false);
 for(const key of ["formal_v5_arm_authorized","a0_execution_authorized","o00_execution_authorized","mcft_cap09_completed"])assert.equal(bootstrapA0Policy.authority_ceiling?.[key],false,"AM22_GFS_BOOTSTRAP_COMBINED_A0_POLICY_CEILING_DRIFT:"+key);
 return {selected_acquisition_budget_ms:selected,combined_minimum_lead_ms:combined,authority_materialization_margin_ms:AUTHORITY_MATERIALIZATION_MARGIN_MS};
}
function composeEnv({head,stageRef,runtimeAuthorityPath,ownerAuthorityPath,unusedHandoffPath,artifactAttestationPath}){
 const env={...process.env,
  GEOX_DEPLOYMENT_SUBJECT_COMMIT:head,
  GEOX_MCFT_CAP09_PREFORMAL_MODE:"OWNER_CUTOVER",
  GEOX_MCFT_CAP09_TENANT_ID:SCOPE.tenant_id,GEOX_MCFT_CAP09_PROJECT_ID:SCOPE.project_id,GEOX_MCFT_CAP09_GROUP_ID:SCOPE.group_id,
  GEOX_MCFT_CAP09_FIELD_ID:SCOPE.field_id,GEOX_MCFT_CAP09_SEASON_ID:SCOPE.season_id,GEOX_MCFT_CAP09_ZONE_ID:SCOPE.zone_id,
  GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_PATH:runtimeAuthorityPath,
  GEOX_MCFT_CAP09_PRODUCTION_OWNER_CUTOVER_AUTHORITY_PATH:ownerAuthorityPath,
  GEOX_MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_AUTHORITY_PATH:unusedHandoffPath,
  GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_PATH:artifactAttestationPath,
  GEOX_MCFT_CAP09_LOCAL_HOST_ID_PATH:HOST_ID_FILE,
  GEOX_MCFT_CAP09_RUNTIME_IMAGE_TAG:`geox-mcft-cap09-runtime:${head}`,
  GEOX_MCFT_CAP09_PRODUCTION_CURRENT_CROP_AUTHORITY_PATH:path.join(ROOT,stageRef),
  GEOX_MCFT_CAP09_PRODUCTION_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_PATH:path.join(ROOT,STAGE_CERT_REL),
 };
 for(const name of ["GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL","GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL","GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT","GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET","GEOX_MCFT_CAP09_EVIDENCE_S3_REGION","GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID","GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY","GEOX_MCFT_CAP09_DURABLE_LOG_ROOT"])env[name]=reqEnv(name);
 return env;
}

async function main(){
 assert.ok(!process.env.CI&&!process.env.GITHUB_ACTIONS,"AM22_GFS_BOOTSTRAP_LOCAL_OPERATOR_HOST_REQUIRED");
 assert.ok(process.argv.includes("--operator-authorized"),"AM22_GFS_BOOTSTRAP_EXPLICIT_OPERATOR_AUTHORIZATION_REQUIRED");
 const stageArg=arg("--stage-ref"),outArg=arg("--out");
 assert.ok(stageArg&&outArg,"AM22_GFS_BOOTSTRAP_STAGE_AND_OUTPUT_REQUIRED");
 const stageRef=safeRepoRef(stageArg),out=path.resolve(outArg);
 const outRelative=path.relative(ROOT,out);
 assert.ok(outRelative.startsWith(".."+path.sep)||path.isAbsolute(outRelative),"AM22_GFS_BOOTSTRAP_OUTPUT_MUST_BE_OUTSIDE_REPOSITORY");
 assert.ok(!fs.existsSync(out),"AM22_GFS_BOOTSTRAP_DISTINCT_OUTPUT_REQUIRED");

 git("fetch","--no-tags","origin","main");
 const head=git("rev-parse","HEAD"),mainHead=git("rev-parse","origin/main");
 assert.equal(head,mainHead,"AM22_GFS_BOOTSTRAP_HEAD_MUST_EQUAL_CURRENT_PROTECTED_MAIN");
 assert.equal(git("status","--porcelain"),"","AM22_GFS_BOOTSTRAP_WORKTREE_MUST_BE_CLEAN");

 const ownerPolicy=read(OWNER_POLICY_REL),a0Policy=read(A0_POLICY_REL),bootstrapA0Policy=read(BOOTSTRAP_A0_POLICY_REL),registry=read(REGISTRY_REL),budget=read(BUDGET_REL);
 const timing=requirePolicies(ownerPolicy,a0Policy,bootstrapA0Policy,budget);
 const hostId=fs.readFileSync(HOST_ID_FILE,"utf8").trim().toLowerCase();
 assert.equal(hostId,String(ownerPolicy.execution_host?.exact_host_id??"").toLowerCase(),"AM22_GFS_BOOTSTRAP_HOST_ID_MISMATCH");
 const stage=JSON.parse(fs.readFileSync(stageRef.resolved,"utf8"));

 const evidenceUrl=reqEnv("GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL"),twinUrl=reqEnv("GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL");
 const source=readOnlyPool(evidenceUrl,"geox_mcft_cap09_production_runtime_v1"),twin=readOnlyPool(twinUrl,"geox_mcft_cap09_production_runtime_v1");
 let started=false,ownerVerified=false,rollbackAttempted=false,rollbackSucceeded=false,phase="PRECHECK",imageId="",cutoverElapsedMs=0,imageBuildElapsedMs=0;
 let hostNow=null,sourceNow=null,clockSkewMs=null,window=null,authorityMaterializationElapsedMs=null,remainingAcquisitionBudgetMsAtOwnerStart=null;
 try{
  fs.mkdirSync(out,{recursive:true});
  immutable(path.join(out,"started.json"),{
    schema_version:"geox_mcft_cap09_am22_gfs_bootstrap_cutover_started_v1",status:"STARTED",
    subject_sha:head,host_id:hostId,stage_ref:stageRef.ref,stage_sha256:digestFile(stageRef.resolved),
    image_build_and_attestation_before_a0_planning:true,a0_planning_pending:true,
    authority_basis:[OWNER_POLICY_REL,A0_POLICY_REL,BOOTSTRAP_A0_POLICY_REL],
    formal_v5_arm:false,a0_execution:false,o00_started:false,
  });

  const runtimeRoot=path.join(out,"runtime");
  const runtimeArmPath=path.join(runtimeRoot,"runtime-start-arm.json");
  const runtimeAuthorityPath=path.join(runtimeRoot,"runtime-start-authority.json");
  const ownerAuthorityPath=path.join(runtimeRoot,"owner-cutover-authority.json");
  const unusedHandoffPath=path.join(runtimeRoot,"unused-formal-handoff.json");
  const artifactAttestationPath=path.join(ROOT,ATTEST_REL);
  fs.mkdirSync(runtimeRoot,{recursive:true});
  const env=composeEnv({head,stageRef:stageRef.ref,runtimeAuthorityPath,ownerAuthorityPath,unusedHandoffPath,artifactAttestationPath});
  fs.mkdirSync(path.join(env.GEOX_MCFT_CAP09_DURABLE_LOG_ROOT,"evidence"),{recursive:true});
  fs.mkdirSync(path.join(env.GEOX_MCFT_CAP09_DURABLE_LOG_ROOT,"twin"),{recursive:true});

  phase="IMAGE_BUILD_AND_ATTESTATION";
  const imageStarted=Date.now();
  exec("docker",["compose","-f",COMPOSE_REL,"-f",OVERLAY_REL,"build",EVIDENCE_SERVICE],{env});
  imageBuildElapsedMs=Date.now()-imageStarted;
  imageId=exec("docker",["image","inspect","--format","{{.Id}}",`geox-mcft-cap09-runtime:${head}`],{env});
  assert.match(imageId,/^sha256:[a-f0-9]{64}$/,"AM22_GFS_BOOTSTRAP_IMAGE_ID_INVALID");
  try{fs.rmSync(artifactAttestationPath,{force:true});}catch{}
  exec(process.execPath,[VERIFY_REL,"--attest-image"],{env});

  phase="A0_PLANNING_AND_AUTHORITY_MATERIALIZATION";
  sourceNow=await databaseNow(source);hostNow=new Date().toISOString();
  clockSkewMs=Math.abs(Date.parse(hostNow)-Date.parse(sourceNow));
  assert.ok(clockSkewMs<=MAX_HOST_DB_CLOCK_SKEW_MS,"AM22_GFS_BOOTSTRAP_HOST_DATABASE_CLOCK_SKEW_EXCEEDED");
  window=selectA0({source_now:hostNow,budget_ms:timing.combined_minimum_lead_ms,stage});
  const latest=latestRegistryEntry(registry,hostNow,window.o23);
  assert.equal(latest.authority_ref,stageRef.ref,"AM22_GFS_BOOTSTRAP_LATEST_EFFECTIVE_STAGE_REQUIRED");
  assert.equal(latest.authority_sha256,digestFile(stageRef.resolved),"AM22_GFS_BOOTSTRAP_STAGE_DIGEST_MISMATCH");
  assert.equal(latest.authority_as_of,stage.biological_stage.authority_as_of);
  assert.equal(latest.authority_valid_until,stage.biological_stage.authority_valid_until);

  immutable(path.join(out,"planning.json"),{
    schema_version:"geox_mcft_cap09_am22_gfs_bootstrap_planning_v1",status:"PASS",
    host_utc_at_activation_fence:hostNow,source_database_utc_at_activation_fence:sourceNow,host_database_clock_skew_ms:clockSkewMs,
    ...window,selected_acquisition_budget_ms:timing.selected_acquisition_budget_ms,
    required_six_phase_measurement_lead_ms:MEASUREMENT_LEAD_MS,
    authority_materialization_margin_ms:timing.authority_materialization_margin_ms,
    combined_minimum_lead_ms:timing.combined_minimum_lead_ms,
    image_id:imageId,image_build_elapsed_ms:imageBuildElapsedMs,
    formal_v5_arm:false,a0_execution:false,o00_started:false,
  });

  const activationFence=hostNow;
  write(ownerAuthorityPath,{
    schema_version:"geox_mcft_cap09_production_owner_cutover_authority_instance_v1",
    authority_id:"GEOX-MCFT-CAP-09-PRODUCTION-OWNER-CUTOVER-AUTHORITY-INSTANCE-V1",
    status:"AUTHORIZED",armed:true,
    authority_ref:`local-operator://${hostId}/mcft-cap09/am22-gfs-bootstrap/owner-cutover/${head}/${window.a0}`,
    policy_ref:OWNER_POLICY_REL,policy_sha256:digestFile(path.join(ROOT,OWNER_POLICY_REL)),
    deployment_subject_sha:head,host_id:hostId,scope:SCOPE,
    selected_current_crop_authority_ref:stageRef.ref,
    selected_current_crop_authority_sha256:digestFile(stageRef.resolved),
    selected_current_crop_authority_as_of:latest.authority_as_of,
    selected_current_crop_authority_valid_until:latest.authority_valid_until,
    selected_current_crop_graduation_status:latest.graduation_status,
    evidence_owner_activation_authorized:true,twin_owner_activation_authorized:true,
    non_github_hosting_binding_authorized:true,production_login_provisioning_authorized:false,
    formal_v5_arm_authorized:false,a0_authorized:false,o00_authorized:false,
  });
  write(runtimeArmPath,{
    schema_version:"geox_mcft_cap09_production_runtime_start_arm_v1",armed:true,
    activation_step:"POST_EFFECTIVENESS_DUAL_KEY_LOCAL_OWNER_CUTOVER",runtime_mode:"OWNER_CUTOVER",
    exact_deployment_subject_sha:head,
    authority_ref:`local-operator://${hostId}/mcft-cap09/am22-gfs-bootstrap/runtime-start-arm/${head}/${window.a0}`,
    live_activation_authority_ref:OWNER_POLICY_REL,live_activation_authority_sha256:digestFile(path.join(ROOT,OWNER_POLICY_REL)),
    formal_a0_authority_ref:BOOTSTRAP_A0_POLICY_REL,formal_a0_authority_sha256:digestFile(path.join(ROOT,BOOTSTRAP_A0_POLICY_REL)),
    current_crop_authority_ref:stageRef.ref,current_crop_authority_sha256:digestFile(stageRef.resolved),
    biological_stage_architecture_effectiveness_ref:STAGE_CERT_REL,biological_stage_architecture_effectiveness_sha256:digestFile(path.join(ROOT,STAGE_CERT_REL)),
    scope:SCOPE,activation_fence_time:activationFence,formal_a0_logical_time:window.a0,
    runtime_process_start_authorized:true,evidence_runtime_start_authorized:true,twin_runtime_start_authorized:true,
    production_owner_activation_authorized:false,formal_v5_arm_authorized:false,a0_authorized:false,o00_authorized:false,
    execution_requested:true,current_status:"AM22_GFS_BOOTSTRAP_OWNER_CUTOVER_ARMED",
  });
  exec(process.execPath,[BUILDER_REL,"--arm",runtimeArmPath,"--out",runtimeAuthorityPath]);
  write(unusedHandoffPath,{
    schema_version:"geox_mcft_cap09_am22_gfs_bootstrap_unused_formal_handoff_v1",
    status:"NOT_CONSUMED_BY_AM22_GFS_BOOTSTRAP_EVIDENCE_OWNER",
    formal_v5_arm_authorized:false,a0_authorized:false,o00_authorized:false,
  });

  authorityMaterializationElapsedMs=Date.now()-Date.parse(activationFence);
  assert.ok(authorityMaterializationElapsedMs<=timing.authority_materialization_margin_ms,"AM22_GFS_BOOTSTRAP_AUTHORITY_MATERIALIZATION_MARGIN_EXCEEDED");
  remainingAcquisitionBudgetMsAtOwnerStart=Date.parse(window.a0)-MEASUREMENT_LEAD_MS-Date.now();
  assert.ok(remainingAcquisitionBudgetMsAtOwnerStart>=timing.selected_acquisition_budget_ms,"AM22_GFS_BOOTSTRAP_FULL_ACQUISITION_BUDGET_NOT_PRESERVED_AT_OWNER_START");

  phase="OWNER_CUTOVER";
  const cutoverStarted=Date.now();
  exec("docker",["compose","-f",COMPOSE_REL,"-f",OVERLAY_REL,"up","-d","--no-build","--pull","never","--force-recreate",EVIDENCE_SERVICE,TWIN_SERVICE],{env});
  started=true;
  const ownerDeadline=Date.now()+180000;
  let lastOwnerError="";
  while(Date.now()<ownerDeadline){
    try{
      exec(process.execPath,[VERIFY_REL,"--live"],{env,timeoutMs:Math.max(1000,ownerDeadline-Date.now())});
      lastOwnerError="";break;
    }catch(error){
      lastOwnerError=String(error?.stderr??error?.message??error);
      sleep(5000);
    }
  }
  if(lastOwnerError){
    rollbackAttempted=true;
    try{
      exec("docker",["compose","-f",COMPOSE_REL,"-f",OVERLAY_REL,"down"],{env,timeoutMs:120000});
      rollbackSucceeded=true;
    }catch(rollbackError){
      fail("AM22_GFS_BOOTSTRAP_OWNER_VERIFICATION_AND_REQUIRED_ROLLBACK_FAILED",String(rollbackError?.stderr??rollbackError?.message??rollbackError).slice(-1200));
    }
    fail("AM22_GFS_BOOTSTRAP_OWNER_VERIFICATION_TIMEOUT",lastOwnerError.slice(-1200));
  }
  ownerVerified=true;
  cutoverElapsedMs=Date.now()-cutoverStarted;

  phase="GFS_PAIR_WAIT";
  const pairWaitStarted=Date.now(),readinessDeadline=Date.parse(window.a0)-READY_MARGIN_MS;
  let pair=null,lastRows=[];
  while(Date.now()<readinessDeadline){
    lastRows=await gfsPairRows(source,window.a0);
    if(lastRows.length===2){
      try{pair=validateGfsPairRows(lastRows,window.a0);break;}catch{}
    }
    sleep(POLL_MS);
  }
  if(!pair)fail("AM22_GFS_BOOTSTRAP_EXACT_A0_GFS_PAIR_NOT_READY_BEFORE_MEASUREMENT_LEAD",JSON.stringify(lastRows));
  const gfsPairWaitElapsedMs=Date.now()-pairWaitStarted;
  const twinZero=await assertTwinStillPreFormal(twin);
  exec(process.execPath,[VERIFY_REL,"--live"],{env,timeoutMs:60000});

  const sixPhaseInput={a0_planning_time:window.a0,image_id:imageId,stage_ref:stageRef.ref,subject_sha:head};
  immutable(path.join(out,"six-phase-input.json"),sixPhaseInput);
  immutable(path.join(out,"result.json"),{
    schema_version:"geox_mcft_cap09_am22_gfs_bootstrap_cutover_result_v1",
    status:"PASS",subject_sha:head,host_id:hostId,image_id:imageId,stage_ref:stageRef.ref,stage_sha256:digestFile(stageRef.resolved),
    host_utc_at_activation_fence:hostNow,source_database_utc_at_activation_fence:sourceNow,host_database_clock_skew_ms:clockSkewMs,...window,
    image_build_elapsed_ms:imageBuildElapsedMs,authority_materialization_elapsed_ms:authorityMaterializationElapsedMs,
    remaining_acquisition_budget_ms_at_owner_start:remainingAcquisitionBudgetMsAtOwnerStart,
    owner_cutover_elapsed_ms:cutoverElapsedMs,gfs_pair_wait_elapsed_ms:gfsPairWaitElapsedMs,
    gfs_pair:{weather_fact_id:pair.weather.fact_id,et0_fact_id:pair.et0.fact_id,selected_cycle:pair.selected_cycle,raw_source_sha256:pair.raw_source_sha256},
    twin_preformal_zero_state:twinZero,six_phase_input_file:"six-phase-input.json",
    production_owner_cutover_observed:true,evidence_acquisition_observed:true,twin_mode:"PRE_FORMAL_OWNER_STANDBY",
    formal_database_credential_consumed:false,formal_database_mutation:false,formal_raw_write:false,
    formal_v5_arm:false,a0_execution:false,o00_started:false,mcft_cap09_completed:false,
  });
  process.stdout.write(fs.readFileSync(path.join(out,"result.json"),"utf8"));
 }catch(error){
  if(fs.existsSync(out)&&!fs.existsSync(path.join(out,"failed.json"))){
    try{immutable(path.join(out,"failed.json"),{
      schema_version:"geox_mcft_cap09_am22_gfs_bootstrap_cutover_failed_v1",status:"FAIL",phase,
      terminal_error:String(error instanceof Error?error.message:error).slice(0,4000),
      production_owners_may_have_changed:started,image_id:imageId||null,owner_verified:ownerVerified,
      host_utc_at_activation_fence:hostNow,source_database_utc_at_activation_fence:sourceNow,host_database_clock_skew_ms:clockSkewMs,
      planned_window:window,authority_materialization_elapsed_ms:authorityMaterializationElapsedMs,
      remaining_acquisition_budget_ms_at_owner_start:remainingAcquisitionBudgetMsAtOwnerStart,
      owner_cutover_elapsed_ms:cutoverElapsedMs||null,
      rollback_required_by_owner_policy:started&&!ownerVerified,rollback_attempted:rollbackAttempted,rollback_succeeded:rollbackSucceeded,
      automatic_compose_down_performed:rollbackSucceeded,operator_reconciliation_required:started,
      formal_v5_arm:false,a0_execution:false,o00_started:false,mcft_cap09_completed:false,
    });}catch{}
  }
  throw error;
 }finally{
  await Promise.allSettled([source.end(),twin.end()]);
 }
}

main().catch(error=>{
 process.stderr.write((error instanceof Error?error.stack??error.message:String(error))+"\n");
 process.exitCode=1;
});
