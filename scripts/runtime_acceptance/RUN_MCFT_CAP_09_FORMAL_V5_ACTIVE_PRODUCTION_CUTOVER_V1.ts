import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { Pool } from "pg";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_FORMAL_V5_ACTIVE_ACTIVATION_AUTHORITY_ID_V1,
  validateMcftCap09FormalV5ActiveActivationAuthorityV1,
} from "../../apps/server/src/runtime/mcft_cap09_formal_v5_active_activation_authority_v1.js";

const ROOT=fileURLToPath(new URL("../../",import.meta.url));
const BASE_DIR=path.join(os.homedir(),".geox","mcft-cap09","formal-v5");
const DEFAULT_OUT=path.join(BASE_DIR,"formal-v5-active-activation-authority-v1.json");
const DEFAULT_CUTOVER_OUT=path.join(BASE_DIR,"formal-v5-active-cutover-v1.json");
const ACTIVE_COMPOSE="docker-compose.mcft-cap09-formal-v5-active.yml";
const PREFORMAL_COMPOSE="docker-compose.mcft-cap09-production-preformal.yml";
const TWIN_SERVICE="geox-mcft-cap09-twin-runtime-v1";
const FORCING_SERVICE="geox-mcft-cap09-formal-v5-forcing-runtime-v1";
const FORMAL_DB="geox_mcft_cap09_s6_formal_t4r1_24h_v5";

function arg(name:string):string|null{
  const row=process.argv.slice(2).find((value)=>value.startsWith(name+"="));
  return row?row.slice(name.length+1):null;
}
function has(name:string):boolean{return process.argv.includes(name);}
function readJson(file:string):any{return JSON.parse(fs.readFileSync(file,"utf8"));}
function sha256File(file:string):string{
  return "sha256:"+crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function git(...args:string[]):string{
  return execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();
}
function docker(args:string[],env:NodeJS.ProcessEnv=process.env):string{
  return execFileSync("docker",args,{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"],env}).trim();
}
function reqEnv(name:string):string{
  const value=String(process.env[name]??"").trim();
  if(!value)throw new Error("FORMAL_V5_ACTIVE_CUTOVER_ENV_REQUIRED:"+name);
  return value;
}
function writeImmutableOrMatch(file:string,value:unknown):void{
  const text=JSON.stringify(value,null,2)+"\n";
  fs.mkdirSync(path.dirname(file),{recursive:true});
  if(fs.existsSync(file)){
    if(fs.readFileSync(file,"utf8")!==text)throw new Error("FORMAL_V5_ACTIVE_CUTOVER_OUTPUT_CONFLICT:"+file);
    return;
  }
  fs.writeFileSync(file,text);
}
function scopeValues(scope:any):string[]{
  return [scope.tenant_id,scope.project_id,scope.group_id,scope.field_id,scope.season_id,scope.zone_id];
}
async function readLiveTwinLease(pool:Pool,scope:any){
  const result=await pool.query<{
    lease_owner:string;fencing_token:string|number|bigint;
    heartbeat_at:Date;expires_at:Date;database_now:Date;
  }>(
    `SELECT lease_owner,fencing_token,heartbeat_at,expires_at,transaction_timestamp() AS database_now
       FROM public.twin_runtime_lease_v1
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
        AND field_id=$4 AND season_id=$5 AND zone_id=$6
        AND expires_at>transaction_timestamp()`,
    scopeValues(scope),
  );
  return result.rows;
}
async function waitNoLiveTwinLease(pool:Pool,scope:any,timeoutMs:number):Promise<void>{
  const deadline=Date.now()+timeoutMs;
  while(Date.now()<deadline){
    if((await readLiveTwinLease(pool,scope)).length===0)return;
    await new Promise((resolve)=>setTimeout(resolve,1000));
  }
  throw new Error("FORMAL_V5_ACTIVE_CUTOVER_PREVIOUS_TWIN_LEASE_NOT_RELEASED");
}
async function waitNewTwinLease(pool:Pool,scope:any,previousFence:bigint,timeoutMs:number){
  const deadline=Date.now()+timeoutMs;
  while(Date.now()<deadline){
    const rows=await readLiveTwinLease(pool,scope);
    if(rows.length===1&&BigInt(rows[0].fencing_token)>previousFence)return rows[0];
    if(rows.length>1)throw new Error("FORMAL_V5_ACTIVE_CUTOVER_DOUBLE_TWIN_OWNER");
    await new Promise((resolve)=>setTimeout(resolve,1000));
  }
  throw new Error("FORMAL_V5_ACTIVE_CUTOVER_NEW_TWIN_OWNER_NOT_OBSERVED");
}

async function main():Promise<void>{
  if(process.env.GITHUB_ACTIONS||process.env.CI)throw new Error("FORMAL_V5_ACTIVE_CUTOVER_LOCAL_HOST_ONLY");
  if(!has("--operator-authorized"))throw new Error("FORMAL_V5_ACTIVE_CUTOVER_OPERATOR_AUTHORIZATION_REQUIRED");

  // Reject retired identities before network access, SQL, object writes, or service changes.
  execFileSync(process.execPath,[path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_FORMAL_ARM_RETIREMENT_GUARD_V1.cjs"),"--arm="+path.resolve(arg("--arm")??"")],{cwd:ROOT,stdio:"inherit"});

  git("fetch","--no-tags","origin","main");
  const head=git("rev-parse","HEAD");
  const origin=git("rev-parse","origin/main");
  assert.equal(head,origin,"FORMAL_V5_ACTIVE_CUTOVER_HEAD_MUST_EQUAL_CURRENT_MAIN");
  assert.equal(git("status","--porcelain"),"","FORMAL_V5_ACTIVE_CUTOVER_WORKTREE_MUST_BE_CLEAN");

  const armPath=path.resolve(arg("--arm")??"");
  const bootstrapPath=path.resolve(arg("--bootstrap")??"");
  if(!fs.existsSync(armPath))throw new Error("FORMAL_V5_ACTIVE_CUTOVER_ARM_REQUIRED");
  if(!fs.existsSync(bootstrapPath))throw new Error("FORMAL_V5_ACTIVE_CUTOVER_BOOTSTRAP_REQUIRED");
  const arm=readJson(armPath);
  const bootstrap=readJson(bootstrapPath);

  assert.equal(arm.schema_version,"geox_mcft_cap09_formal_v5_arm_v1");
  assert.equal(arm.status,"PASS");
  assert.equal(arm.formal_v5_arm,true);
  assert.equal(bootstrap.schema_version,"geox_mcft_cap09_formal_v5_a0_bootstrap_result_v1");
  assert.equal(bootstrap.status,"PASS");
  assert.equal(bootstrap.formal_a0_bootstrapped,true);
  assert.equal(bootstrap.formal_o00_started,false);
  assert.equal(bootstrap.arm_runtime_semantic_subject_sha,arm.subject_sha);
  assert.equal(bootstrap.epoch_id,arm.epoch_id);
  assert.equal(bootstrap.a0,arm.a0);
  assert.equal(bootstrap.o00,arm.o00);
  assert.equal(bootstrap.o23,arm.o23);
  assert.equal(bootstrap.authority_continuity_head_sha,head);
  execFileSync("git",["merge-base","--is-ancestor",arm.subject_sha,head],{cwd:ROOT,stdio:"ignore"});

  const operationalTwinUrl=reqEnv("GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL");
  const formalTwinUrl=reqEnv("GEOX_MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_DATABASE_URL");
  const formalEvidenceUrl=reqEnv("GEOX_MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_DATABASE_URL");
  const pool=new Pool({connectionString:operationalTwinUrl,max:1,application_name:"mcft-cap09-formal-v5-active-cutover-operational"});
  const formalPool=new Pool({connectionString:formalTwinUrl,max:1,application_name:"mcft-cap09-formal-v5-active-cutover-formal"});
  const evidencePool=new Pool({connectionString:formalEvidenceUrl,max:1,application_name:"mcft-cap09-formal-v5-active-cutover-evidence"});
  try{
    const twinIdentity=(await formalPool.query<{db:string;u:string}>("SELECT current_database()::text AS db,current_user::text AS u")).rows[0];
    const evidenceIdentity=(await evidencePool.query<{db:string;u:string}>("SELECT current_database()::text AS db,current_user::text AS u")).rows[0];
    assert.deepEqual(twinIdentity,{db:FORMAL_DB,u:"geox_mcft_cap09_twin_runtime_login_v1"});
    assert.deepEqual(evidenceIdentity,{db:FORMAL_DB,u:"geox_mcft_cap09_evidence_runtime_login_v1"});
    const before=await readLiveTwinLease(pool,MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1);
    if(before.length!==1)throw new Error("FORMAL_V5_ACTIVE_CUTOVER_EXACT_ONE_PREFORMAL_TWIN_OWNER_REQUIRED");
    const prior=before[0];
    const bootstrapFence=BigInt(bootstrap.lease_fencing_token);

    const activation=validateMcftCap09FormalV5ActiveActivationAuthorityV1({
      schema_version:"geox_mcft_cap09_formal_v5_active_activation_authority_v1",
      authority_id:MCFT_CAP09_FORMAL_V5_ACTIVE_ACTIVATION_AUTHORITY_ID_V1,
      status:"PASS",
      runtime_mode:"FORMAL_V5_ACTIVE",
      subject_sha:arm.subject_sha,
      authority_continuity_head_sha:head,
      epoch_id:arm.epoch_id,
      scope:{...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1},
      a0:arm.a0,
      o00:arm.o00,
      o23:arm.o23,
      manifest_ref:bootstrap.manifest_ref,
      manifest_hash:bootstrap.manifest_hash,
      bootstrap_result_sha256:sha256File(bootstrapPath),
      current_crop_authority_ref:bootstrap.current_crop_authority_ref,
      current_crop_authority_sha256:bootstrap.current_crop_authority_sha256,
      preformal_twin_lease_owner:prior.lease_owner,
      a0_bootstrap_twin_lease_owner:bootstrap.lease_owner,
      a0_bootstrap_twin_fencing_token:String(bootstrap.lease_fencing_token),
      twin_activation_authorized:true,
      forcing_activation_authorized:true,
      provider_semantics_rewritten:false,
      scheduler_semantics_rewritten:false,
      persistent_tick_semantics_rewritten:false,
      crop_stage_semantics_rewritten:false,
      revision_semantics_rewritten:false,
      database_schema_changed:false,
    });

    const activationOut=path.resolve(arg("--out")||DEFAULT_OUT);
    writeImmutableOrMatch(activationOut,activation);

    const currentCropPath=path.resolve(ROOT,bootstrap.current_crop_authority_ref);
    assert.equal(sha256File(currentCropPath),bootstrap.current_crop_authority_sha256,"FORMAL_V5_ACTIVE_CUTOVER_CURRENT_CROP_DIGEST_MISMATCH");

    const childEnv:NodeJS.ProcessEnv={
      ...process.env,
      GEOX_DEPLOYMENT_SUBJECT_COMMIT:arm.subject_sha,
      GEOX_MCFT_CAP09_FORMAL_V5_ACTIVE_ACTIVATION_AUTHORITY_PATH:activationOut,
      GEOX_MCFT_CAP09_FORMAL_V5_A0_BOOTSTRAP_PROOF_PATH:bootstrapPath,
      GEOX_MCFT_CAP09_FORMAL_V5_CURRENT_CROP_AUTHORITY_PATH:currentCropPath,
      GEOX_MCFT_CAP09_PRODUCTION_FORMAL_WINDOW_MANIFEST_PATH:path.resolve(bootstrap.manifest_path),
    };

    docker(["compose","-f",ACTIVE_COMPOSE,"up","-d","--no-build",FORCING_SERVICE],childEnv);
    const forcingId=docker(["compose","-f",ACTIVE_COMPOSE,"ps","-q",FORCING_SERVICE],childEnv);
    if(!forcingId)throw new Error("FORMAL_V5_ACTIVE_CUTOVER_FORCING_CONTAINER_REQUIRED");

    await waitNoLiveTwinLease(formalPool,MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,600_000);

    docker(["compose","-f",PREFORMAL_COMPOSE,"stop",TWIN_SERVICE],childEnv);
    await waitNoLiveTwinLease(pool,MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,60_000);

    docker(["compose","-f",ACTIVE_COMPOSE,"up","-d","--no-build",TWIN_SERVICE],childEnv);
    const after=await waitNewTwinLease(formalPool,MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,bootstrapFence,60_000);
    if((await readLiveTwinLease(pool,MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1)).length!==0){
      throw new Error("FORMAL_V5_ACTIVE_CUTOVER_OPERATIONAL_TWIN_OWNER_REAPPEARED");
    }

    const twinId=docker(["compose","-f",ACTIVE_COMPOSE,"ps","-q",TWIN_SERVICE],childEnv);
    if(!twinId)throw new Error("FORMAL_V5_ACTIVE_CUTOVER_TWIN_CONTAINER_REQUIRED");
    const twinImage=docker(["inspect",twinId,"--format","{{.Image}}"],childEnv);
    const forcingImage=docker(["inspect",forcingId,"--format","{{.Image}}"],childEnv);
    const expectedImage=docker(["image","inspect",`geox-mcft-cap09-runtime:${arm.subject_sha}`,"--format","{{.Id}}"],childEnv);
    assert.equal(twinImage,expectedImage,"FORMAL_V5_ACTIVE_CUTOVER_TWIN_IMAGE_MISMATCH");
    assert.equal(forcingImage,expectedImage,"FORMAL_V5_ACTIVE_CUTOVER_FORCING_IMAGE_MISMATCH");

    const proof={
      schema_version:"geox_mcft_cap09_formal_v5_active_cutover_result_v1",
      status:"PASS",
      subject_sha:arm.subject_sha,
      authority_continuity_head_sha:head,
      epoch_id:arm.epoch_id,
      activation_authority_path:activationOut,
      activation_authority_sha256:sha256File(activationOut),
      a0_bootstrap_sha256:sha256File(bootstrapPath),
      preformal_twin_lease_owner:prior.lease_owner,
      formal_a0_bootstrap_lease_owner:bootstrap.lease_owner,
      formal_a0_bootstrap_fencing_token:String(bootstrap.lease_fencing_token),
      no_live_twin_owner_observed_between_stop_and_start:true,
      new_twin_lease_owner:after.lease_owner,
      new_twin_fencing_token:BigInt(after.fencing_token).toString(),
      new_fencing_token_strictly_greater_than_a0_bootstrap:true,
      operational_preformal_owner_released:true,
      operational_live_twin_owner_after_cutover:0,
      formal_a0_bootstrap_lease_expired_before_active_claim:true,
      no_cross_store_double_twin_owner_window:true,
      twin_container_id:twinId,
      forcing_container_id:forcingId,
      exact_runtime_image_id:expectedImage,
      formal_database_name:FORMAL_DB,
      twin_formal_database_principal:twinIdentity?.u,
      evidence_formal_database_principal:evidenceIdentity?.u,
      formal_v5_active:true,
      v13_forcing_process_active:true,
      scheduler_semantics_rewritten:false,
      persistent_tick_semantics_rewritten:false,
      crop_stage_semantics_rewritten:false,
      provider_semantics_rewritten:false,
      database_schema_changed:false,
      o00_started:false,
      mcft_cap09_completed:false,
    };
    writeImmutableOrMatch(path.resolve(arg("--cutover-out")||DEFAULT_CUTOVER_OUT),proof);
    console.log(JSON.stringify(proof,null,2));
  }finally{
    await Promise.allSettled([pool.end(),formalPool.end(),evidencePool.end()]);
  }
}

main().catch((error)=>{
  console.error(error instanceof Error?error.stack??error.message:String(error));
  process.exitCode=1;
});
