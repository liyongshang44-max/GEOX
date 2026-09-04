#!/usr/bin/env node
"use strict";

const crypto=require("node:crypto");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const cp=require("node:child_process");

const ROOT=path.resolve(__dirname,"../..");
const POLICY_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-OWNER-CUTOVER-AUTHORITY-V1.json";
const A0_POLICY_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRE-FORMAL-A0-PLANNING-AUTHORITY-V1.json";
const CURRENT_CROP_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-V1.json";
const STAGE_CERT_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json";
const BUDGET_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json";
const BUILDER_REL="scripts/runtime_acceptance/BUILD_MCFT_CAP_09_PRODUCTION_RUNTIME_START_AUTHORITY_V1.cjs";
const VERIFY_REL="scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_PRODUCTION_OWNER_LIVE_FENCED_LEASES_V1.cjs";
const COMPOSE_REL="docker-compose.mcft-cap09-production-preformal.yml";
const HOST_ID_FILE=path.join(os.homedir(),".geox","mcft-cap09","local-host-id-v1");
const HOUR=3_600_000;

function fail(code,detail){throw new Error(detail?code+":"+detail:code);}
function read(rel){return JSON.parse(fs.readFileSync(path.join(ROOT,rel),"utf8"));}
function digestFile(file){return "sha256:"+crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");}
function digestRel(rel){return digestFile(path.join(ROOT,rel));}
function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();}
function exec(command,args,options={}){return cp.execFileSync(command,args,{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"],env:options.env??process.env});}
function requiredEnv(name){const v=String(process.env[name]??"").trim();if(!v)fail("CUTOVER_ENV_REQUIRED",name);return v;}
function exactIso(v,code){const ms=Date.parse(v);if(!Number.isFinite(ms)||new Date(ms).toISOString()!==v)fail(code);return v;}
function ceilHour(ms){return Math.ceil(ms/HOUR)*HOUR;}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+"\n");}

function composeDown(env){
  try{exec("docker",["compose","-f",COMPOSE_REL,"down","--remove-orphans"],{env});}catch{}
}

try{
  if(String(process.env.GITHUB_ACTIONS??"").toLowerCase()==="true") fail("CUTOVER_GITHUB_ACTIONS_FORBIDDEN");
  if(String(process.env.CI??"")==="true" && !process.env.MCFT_CAP09_ALLOW_LOCAL_CI_OVERRIDE) fail("CUTOVER_CI_HOST_FORBIDDEN");

  git("fetch","--no-tags","origin","main");
  const head=git("rev-parse","HEAD");
  const main=git("rev-parse","origin/main");
  if(head!==main) fail("CUTOVER_HEAD_MUST_EQUAL_CURRENT_PROTECTED_MAIN",head+"!="+main);
  if(git("status","--porcelain")) fail("CUTOVER_WORKTREE_MUST_BE_CLEAN");

  const policy=read(POLICY_REL);
  const a0Policy=read(A0_POLICY_REL);
  const crop=read(CURRENT_CROP_REL);
  const cert=read(STAGE_CERT_REL);
  const budget=read(BUDGET_REL);
  if(policy.status!=="AUTHORIZED_FOR_LOCAL_OPERATOR_MANAGED_DOCKER_CUTOVER") fail("CUTOVER_POLICY_NOT_AUTHORIZED");
  if(policy.deployment_subject_rule!=="EXACT_CURRENT_PROTECTED_MAIN_AT_LOCAL_CUTOVER") fail("CUTOVER_SUBJECT_RULE_INVALID");
  if(policy.execution_host?.github_actions_execution_forbidden!==true) fail("CUTOVER_GITHUB_FORBIDDEN_POLICY_REQUIRED");
  if(policy.cutover_contract?.dual_key_required!==true||policy.cutover_contract?.twin_mode!=="PRE_FORMAL_OWNER_STANDBY") fail("CUTOVER_DUAL_KEY_PREFORMAL_POLICY_REQUIRED");
  if(policy.later_authority_ceiling?.formal_v5_arm_authorized!==false||policy.later_authority_ceiling?.a0_execution_authorized!==false||policy.later_authority_ceiling?.o00_authorized!==false) fail("CUTOVER_POLICY_AUTHORITY_CEILING_DRIFT");

  const hostId=String(fs.readFileSync(HOST_ID_FILE,"utf8")).trim().toLowerCase();
  if(hostId!==String(policy.execution_host.exact_host_id).toLowerCase()) fail("CUTOVER_HOST_ID_MISMATCH",hostId);

  const currentDigest=digestRel(CURRENT_CROP_REL);
  const certDigest=digestRel(STAGE_CERT_REL);
  if(currentDigest!==policy.authority_inputs.current_crop_authority_sha256) fail("CUTOVER_CURRENT_CROP_DIGEST_MISMATCH",currentDigest);
  if(certDigest!==policy.authority_inputs.biological_stage_architecture_effectiveness_sha256) fail("CUTOVER_STAGE_CERT_DIGEST_MISMATCH",certDigest);
  if(crop.architecture_effective!==true||crop.runtime_consumption_authorized!==true) fail("CUTOVER_CURRENT_CROP_NOT_RUNTIME_CONSUMABLE");
  if(cert.status!=="EFFECTIVE"||cert.effective!==true) fail("CUTOVER_STAGE_ARCHITECTURE_NOT_EFFECTIVE");

  const selectedBudget=Number(budget.qualified_budget?.selected_budget_ms);
  if(!Number.isSafeInteger(selectedBudget)||selectedBudget<=0||budget.timing_budget_qualified!==true||budget.timing_budget_frozen!==true) fail("CUTOVER_TIMING_BUDGET_NOT_FROZEN");
  if(selectedBudget!==Number(a0Policy.selection_policy?.selected_budget_ms)) fail("CUTOVER_A0_POLICY_BUDGET_MISMATCH");

  const now=new Date();
  const activationFence=now.toISOString();
  const formalA0=new Date(ceilHour(now.getTime()+selectedBudget)).toISOString();
  const stageAsOf=Date.parse(exactIso(crop.biological_stage.authority_as_of,"CUTOVER_STAGE_AS_OF_INVALID"));
  const forwardHours=Number(crop.biological_stage.forward_stability_hours);
  const stageValidUntil=new Date(stageAsOf+forwardHours*HOUR).toISOString();
  if(Date.parse(formalA0)>Date.parse(stageValidUntil)) fail("CUTOVER_NO_VIABLE_A0_WITHIN_STAGE_STABILITY",formalA0+">"+stageValidUntil);
  if(Date.parse(formalA0)>Date.parse(crop.lifecycle.horizon_end_utc)) fail("CUTOVER_A0_EXCEEDS_LIFECYCLE_HORIZON");
  if(Date.parse(activationFence)>=Date.parse(formalA0)) fail("CUTOVER_ACTIVATION_FENCE_MUST_PRECEDE_A0");

  for(const name of [
    "GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL",
    "GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL",
    "GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT",
    "GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET",
    "GEOX_MCFT_CAP09_EVIDENCE_S3_REGION",
    "GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID",
    "GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY",
    "GEOX_MCFT_CAP09_DURABLE_LOG_ROOT"
  ]) requiredEnv(name);

  const runtimeRoot=path.join(os.homedir(),".geox","mcft-cap09","runtime",head);
  const runtimeAuthorityPath=path.join(runtimeRoot,"runtime-start-authority.json");
  const runtimeArmPath=path.join(runtimeRoot,"runtime-start-arm.json");
  const ownerAuthorityPath=path.join(runtimeRoot,"owner-cutover-authority.json");
  fs.mkdirSync(runtimeRoot,{recursive:true});

  const scope={
    tenant_id:crop.scope.tenant_id,project_id:crop.scope.project_id,group_id:crop.scope.group_id,
    field_id:crop.scope.field_id,season_id:crop.scope.season_id,zone_id:crop.scope.zone_id
  };
  const ownerAuthority={
    schema_version:"geox_mcft_cap09_production_owner_cutover_authority_instance_v1",
    authority_id:"GEOX-MCFT-CAP-09-PRODUCTION-OWNER-CUTOVER-AUTHORITY-INSTANCE-V1",
    status:"AUTHORIZED",armed:true,
    authority_ref:"local-operator://"+hostId+"/mcft-cap09/owner-cutover/"+head,
    policy_ref:POLICY_REL,policy_sha256:digestRel(POLICY_REL),
    deployment_subject_sha:head,host_id:hostId,scope,
    evidence_owner_activation_authorized:true,twin_owner_activation_authorized:true,
    non_github_hosting_binding_authorized:true,production_login_provisioning_authorized:false,
    formal_v5_arm_authorized:false,a0_authorized:false,o00_authorized:false
  };
  write(ownerAuthorityPath,ownerAuthority);

  const runtimeArm={
    schema_version:"geox_mcft_cap09_production_runtime_start_arm_v1",
    armed:true,activation_step:"POST_EFFECTIVENESS_DUAL_KEY_LOCAL_OWNER_CUTOVER",
    exact_deployment_subject_sha:head,
    authority_ref:"local-operator://"+hostId+"/mcft-cap09/runtime-start-arm/"+head,
    live_activation_authority_ref:POLICY_REL,live_activation_authority_sha256:digestRel(POLICY_REL),
    formal_a0_authority_ref:A0_POLICY_REL,formal_a0_authority_sha256:digestRel(A0_POLICY_REL),
    current_crop_authority_ref:CURRENT_CROP_REL,current_crop_authority_sha256:currentDigest,
    biological_stage_architecture_effectiveness_ref:STAGE_CERT_REL,biological_stage_architecture_effectiveness_sha256:certDigest,
    scope,activation_fence_time:activationFence,formal_a0_logical_time:formalA0,
    runtime_process_start_authorized:true,evidence_runtime_start_authorized:true,twin_runtime_start_authorized:true,
    production_owner_activation_authorized:false,formal_v5_arm_authorized:false,a0_authorized:false,o00_authorized:false,
    execution_requested:true,current_status:"LOCAL_DUAL_KEY_CUTOVER_ARMED"
  };
  write(runtimeArmPath,runtimeArm);
  exec(process.execPath,[BUILDER_REL,"--arm",runtimeArmPath,"--out",runtimeAuthorityPath]);

  const env={...process.env,
    GEOX_DEPLOYMENT_SUBJECT_COMMIT:head,
    GEOX_MCFT_CAP09_TENANT_ID:scope.tenant_id,GEOX_MCFT_CAP09_PROJECT_ID:scope.project_id,GEOX_MCFT_CAP09_GROUP_ID:scope.group_id,
    GEOX_MCFT_CAP09_FIELD_ID:scope.field_id,GEOX_MCFT_CAP09_SEASON_ID:scope.season_id,GEOX_MCFT_CAP09_ZONE_ID:scope.zone_id,
    GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_PATH:runtimeAuthorityPath,
    GEOX_MCFT_CAP09_PRODUCTION_OWNER_CUTOVER_AUTHORITY_PATH:ownerAuthorityPath,
    GEOX_MCFT_CAP09_PRODUCTION_CURRENT_CROP_AUTHORITY_PATH:path.join(ROOT,CURRENT_CROP_REL),
    GEOX_MCFT_CAP09_PRODUCTION_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_PATH:path.join(ROOT,STAGE_CERT_REL),
    EVIDENCE_RUNTIME_DATABASE_URL_SECRET:requiredEnv("GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL"),
    TWIN_RUNTIME_DATABASE_URL_SECRET:requiredEnv("GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL")
  };
  fs.mkdirSync(path.join(env.GEOX_MCFT_CAP09_DURABLE_LOG_ROOT,"evidence"),{recursive:true});
  fs.mkdirSync(path.join(env.GEOX_MCFT_CAP09_DURABLE_LOG_ROOT,"twin"),{recursive:true});

  let started=false;
  try{
    exec("docker",["compose","-f",COMPOSE_REL,"up","-d","--build","geox-mcft-cap09-evidence-runtime-v1","geox-mcft-cap09-twin-runtime-v1"],{env});
    started=true;
    const deadline=Date.now()+180_000;
    let lastError="";
    while(Date.now()<deadline){
      try{
        exec(process.execPath,[VERIFY_REL],{env});
        lastError="";
        break;
      }catch(error){
        lastError=String(error?.stderr??error?.message??error);
        cp.execFileSync(process.execPath,["-e","setTimeout(()=>{},5000)"],{stdio:"ignore"});
      }
    }
    if(lastError) fail("CUTOVER_EXACT_ONE_OWNER_VERIFICATION_TIMEOUT",lastError.slice(-1200));

    const result={
      schema_version:"geox_mcft_cap09_production_runtime_owner_cutover_result_v1",
      status:"PASS",deployment_subject_sha:head,host_id:hostId,
      activation_fence_time:activationFence,formal_a0_planning_time:formalA0,
      stage_authority_valid_until:stageValidUntil,
      runtime_processes_started:true,evidence_owner_activation_observed:true,twin_owner_activation_observed:true,
      twin_mode:"PRE_FORMAL_OWNER_STANDBY",
      formal_v5_arm:false,a0_execution:false,o00_started:false,mcft_cap09_completed:false,
      runtime_start_authority_path:runtimeAuthorityPath,owner_cutover_authority_path:ownerAuthorityPath
    };
    write(path.join(ROOT,"acceptance-output","MCFT_CAP_09_PRODUCTION_RUNTIME_OWNER_CUTOVER_V1_RESULT.json"),result);
    process.stdout.write(JSON.stringify(result,null,2)+"\n");
  }catch(error){
    if(started) composeDown(env);
    throw error;
  }
}catch(error){
  process.stderr.write((error instanceof Error?error.stack??error.message:String(error))+"\n");
  process.exitCode=1;
}
