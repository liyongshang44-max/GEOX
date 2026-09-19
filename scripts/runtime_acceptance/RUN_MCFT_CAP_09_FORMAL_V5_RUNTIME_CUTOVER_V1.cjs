#!/usr/bin/env node
"use strict";

const cp=require("node:child_process");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"../..");
const PROJECT="geox-mcft-cap09-production-v1";
const PREFORMAL_COMPOSE="docker-compose.mcft-cap09-production-preformal.yml";
const FORMAL_COMPOSE="docker-compose.mcft-cap09-production-formal-v5.yml";
const CONTINUITY="scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_FORMAL_V5_POST_ARM_AUTHORITY_CONTINUITY_V1.cjs";
const FORMAL_DB="geox_mcft_cap09_s6_formal_t4r1_24h_v5";
const EVIDENCE_SERVICE="geox-mcft-cap09-evidence-runtime-v1";
const TWIN_SERVICE="geox-mcft-cap09-twin-runtime-v1";
const EVIDENCE_SERVICE_ID="local-docker://fae5f756-ef25-40d5-9777-5b2c3d4837a1/geox-mcft-cap09-evidence-runtime-v1";
const TWIN_SERVICE_ID="local-docker://fae5f756-ef25-40d5-9777-5b2c3d4837a1/geox-mcft-cap09-twin-runtime-v1";
const BASE_DIR=path.join(os.homedir(),".geox","mcft-cap09","formal-v5");
const DEFAULT_ARM=path.join(BASE_DIR,"arm-v1.json");
const DEFAULT_A0=path.join(BASE_DIR,"a0-bootstrap-v1.json");
const DEFAULT_MANIFEST=path.join(BASE_DIR,"formal-window-manifest-v1.json");
const DEFAULT_CONTINUITY=path.join(BASE_DIR,"post-arm-authority-continuity-cutover-v1.json");
const DEFAULT_OUT=path.join(BASE_DIR,"runtime-cutover-v1.json");
const DEFAULT_LOG_ROOT=path.join(os.homedir(),".geox","mcft-cap09","logs");

function fail(code,detail){throw new Error(detail===undefined?code:code+":"+String(detail));}
function req(ok,code,detail){if(!ok)fail(code,detail);}
function text(value,code){const v=String(value??"").trim();req(v,code);return v;}
function sha(value,code){const v=text(value,code);req(/^[0-9a-f]{40}$/.test(v),code,v);return v;}
function sha256(value,code){const v=text(value,code);req(/^sha256:[0-9a-f]{64}$/.test(v),code,v);return v;}
function iso(value,code){const v=text(value,code),t=Date.parse(v);req(Number.isFinite(t)&&new Date(t).toISOString()===v,code,v);return v;}
function arg(name){const row=process.argv.slice(2).find(v=>v.startsWith(name+"="));return row?row.slice(name.length+1):null;}
function has(name){return process.argv.includes(name);}
function read(file,code){try{return JSON.parse(fs.readFileSync(file,"utf8"));}catch(error){fail(code,error instanceof Error?error.message:String(error));}}
function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();}
function exec(file,args,{env=process.env,timeoutMs=120000,stdio="pipe"}={}){
  try{
    return cp.execFileSync(file,args,{cwd:ROOT,env,encoding:"utf8",timeout:timeoutMs,stdio}).trim();
  }catch(error){
    const detail=String(error?.stderr??error?.stdout??error?.message??error);
    fail("FORMAL_V5_CUTOVER_COMMAND_FAILED",file+" "+args.join(" ")+" :: "+detail.slice(-2000));
  }
}
function sleep(ms){cp.execFileSync(process.execPath,["-e",`setTimeout(()=>{},${Math.max(1,ms)})`],{stdio:"ignore"});}
function requiredEnv(name){return text(process.env[name],"FORMAL_V5_CUTOVER_ENV_REQUIRED:"+name);}
function databaseName(urlText,code){
  let u;try{u=new URL(urlText);}catch{fail(code);}
  req(["postgres:","postgresql:"].includes(u.protocol),code);
  const name=decodeURIComponent(u.pathname.replace(/^\//,""));
  return text(name,code);
}
function deriveDatabaseUrl(source,target){
  let u;try{u=new URL(source);}catch{fail("FORMAL_V5_CUTOVER_SOURCE_DATABASE_URL_INVALID");}
  req(["postgres:","postgresql:"].includes(u.protocol),"FORMAL_V5_CUTOVER_SOURCE_DATABASE_URL_INVALID");
  u.pathname="/"+encodeURIComponent(target);
  return u.toString();
}
function psql(url,sql){
  return exec("psql",[url,"-X","-q","-AtF","|","-v","ON_ERROR_STOP=1","-c",sql],{timeoutMs:60000});
}
function queryLiveLease(url,table){
  const raw=psql(url,`WITH live AS (
    SELECT lease_owner,fencing_token,acquired_at,heartbeat_at,expires_at
      FROM public.${table}
     WHERE expires_at > transaction_timestamp()
  )
  SELECT current_user::text,
         current_database()::text,
         transaction_timestamp()::text,
         count(*)::int,
         count(DISTINCT lease_owner)::int,
         COALESCE(min(lease_owner),''),
         COALESCE(min(fencing_token)::text,''),
         COALESCE(min(acquired_at)::text,''),
         COALESCE(min(heartbeat_at)::text,''),
         COALESCE(min(expires_at)::text,'')
    FROM live;`);
  const f=raw.split("|");req(f.length===10,"FORMAL_V5_CUTOVER_LEASE_QUERY_SHAPE_INVALID",table);
  return {
    current_user:f[0],database_name:f[1],database_now:f[2],
    live_count:Number(f[3]),distinct_owner_count:Number(f[4]),
    lease_owner:f[5],fencing_token:f[6],acquired_at:f[7],heartbeat_at:f[8],expires_at:f[9],
  };
}
function inspectService(service){
  const ids=exec("docker",["ps","-aq","--filter",`label=com.docker.compose.project=${PROJECT}`,"--filter",`label=com.docker.compose.service=${service}`])
    .split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(ids.length!==1)return {count:ids.length,id:ids[0]??"",running:false,hostname:"",image_id:"",subject:"",service};
  const rows=JSON.parse(exec("docker",["inspect",ids[0]]));
  req(Array.isArray(rows)&&rows.length===1,"FORMAL_V5_CUTOVER_DOCKER_INSPECT_SHAPE_INVALID",service);
  const c=rows[0],env=Array.isArray(c.Config?.Env)?c.Config.Env:[];
  const subjectRow=env.find(x=>String(x).startsWith("GEOX_DEPLOYMENT_SUBJECT_COMMIT="));
  return {
    count:1,id:text(c.Id,"FORMAL_V5_CUTOVER_CONTAINER_ID_REQUIRED"),
    running:c.State?.Running===true,hostname:text(c.Config?.Hostname,"FORMAL_V5_CUTOVER_CONTAINER_HOSTNAME_REQUIRED"),
    image_id:text(c.Image,"FORMAL_V5_CUTOVER_CONTAINER_IMAGE_ID_REQUIRED"),
    subject:subjectRow?String(subjectRow).split("=",2)[1]:"",
    compose_project:String(c.Config?.Labels?.["com.docker.compose.project"]??""),
    compose_service:String(c.Config?.Labels?.["com.docker.compose.service"]??""),
    restart_count:Number(c.RestartCount??0),service,
  };
}
function tagImageId(subject){
  return text(exec("docker",["image","inspect",`geox-mcft-cap09-runtime:${subject}`,"--format","{{.Id}}"]),"FORMAL_V5_CUTOVER_TAG_IMAGE_ID_REQUIRED");
}
function readLatestEvent(logPath,predicate){
  if(!fs.existsSync(logPath))return null;
  const lines=fs.readFileSync(logPath,"utf8").split(/\r?\n/).filter(Boolean).slice(-1000);
  for(let i=lines.length-1;i>=0;i--){
    try{const event=JSON.parse(lines[i]);if(predicate(event))return event;}catch{}
  }
  return null;
}
function validateArm(arm){
  req(arm?.schema_version==="geox_mcft_cap09_formal_v5_arm_v1","FORMAL_V5_CUTOVER_ARM_SCHEMA_REQUIRED");
  req(arm.status==="PASS"&&arm.formal_v5_arm===true&&arm.formal_v5_epoch_selected===true,"FORMAL_V5_CUTOVER_ARM_PASS_REQUIRED");
  req(arm.formal_database_name===FORMAL_DB,"FORMAL_V5_CUTOVER_ARM_DATABASE_MISMATCH");
  req(arm.formal_database_mutation===false&&arm.a0_bootstrap===false&&arm.o00_started===false,"FORMAL_V5_CUTOVER_ARM_EFFECT_CEILING_DRIFT");
  sha(arm.subject_sha,"FORMAL_V5_CUTOVER_ARM_SUBJECT_INVALID");
  sha256(arm.arm_identity_hash,"FORMAL_V5_CUTOVER_ARM_IDENTITY_INVALID");
  iso(arm.a0,"FORMAL_V5_CUTOVER_ARM_A0_INVALID");iso(arm.o00,"FORMAL_V5_CUTOVER_ARM_O00_INVALID");iso(arm.o23,"FORMAL_V5_CUTOVER_ARM_O23_INVALID");
}
function validateBootstrap(a0,arm){
  req(a0?.schema_version==="geox_mcft_cap09_formal_v5_a0_bootstrap_result_v1"&&a0.status==="PASS","FORMAL_V5_CUTOVER_A0_BOOTSTRAP_PASS_REQUIRED");
  req(a0.arm_runtime_semantic_subject_sha===arm.subject_sha&&a0.arm_identity_hash===arm.arm_identity_hash&&a0.epoch_id===arm.epoch_id,"FORMAL_V5_CUTOVER_A0_ARM_IDENTITY_MISMATCH");
  req(a0.manifest_ref===arm.manifest_ref&&a0.formal_database_name===FORMAL_DB,"FORMAL_V5_CUTOVER_A0_MANIFEST_OR_DATABASE_MISMATCH");
  req(a0.a0===arm.a0&&a0.o00===arm.o00&&a0.o23===arm.o23&&a0.next_tick_logical_time===arm.o00,"FORMAL_V5_CUTOVER_A0_TIME_IDENTITY_MISMATCH");
  req(a0.hourly_runtime_config_count===24&&a0.scheduler_slot_count===0,"FORMAL_V5_CUTOVER_A0_BOOTSTRAP_SHAPE_INVALID");
  req(a0.formal_v5_arm===true&&a0.formal_a0_bootstrapped===true&&a0.formal_o00_started===false&&a0.store_reuse_authorized_after_success===true&&a0.human_override_used===false,"FORMAL_V5_CUTOVER_A0_BOOTSTRAP_EFFECT_BOUNDARY_INVALID");
  req(a0.provider_request_count===0,"FORMAL_V5_CUTOVER_A0_PROVIDER_REQUEST_FORBIDDEN");
  req(BigInt(text(a0.lease_fencing_token,"FORMAL_V5_CUTOVER_A0_FENCE_REQUIRED"))===1n,"FORMAL_V5_CUTOVER_A0_FIRST_FENCE_REQUIRED");
  req(Date.parse(iso(a0.lease_expires_at,"FORMAL_V5_CUTOVER_A0_LEASE_EXPIRY_INVALID"))<=Date.parse(arm.o00),"FORMAL_V5_CUTOVER_A0_LEASE_EXPIRES_AFTER_O00");
  sha256(a0.current_crop_authority_sha256,"FORMAL_V5_CUTOVER_A0_CURRENT_CROP_DIGEST_INVALID");
}
function validateManifest(manifest,arm,a0){
  req(manifest?.schema_version==="geox_mcft_cap09_amendment19_window_manifest_v1","FORMAL_V5_CUTOVER_MANIFEST_SCHEMA_REQUIRED");
  req(manifest.subject_sha===arm.subject_sha&&manifest.epoch_id===arm.epoch_id&&manifest.manifest_ref===arm.manifest_ref&&manifest.manifest_hash===a0.manifest_hash,"FORMAL_V5_CUTOVER_MANIFEST_IDENTITY_MISMATCH");
  req(manifest.database_name===FORMAL_DB&&manifest.o00_logical_time===arm.o00&&manifest.o23_logical_time===arm.o23,"FORMAL_V5_CUTOVER_MANIFEST_WINDOW_MISMATCH");
  req(Array.isArray(manifest.slots)&&manifest.slots.length===24,"FORMAL_V5_CUTOVER_MANIFEST_24_SLOTS_REQUIRED");
}
function verifyRuntimeDbPrivileges(evidenceUrl,twinUrl){
  const e=psql(evidenceUrl,`SELECT current_user,current_database(),
    has_table_privilege(current_user,'public.facts','INSERT'),
    has_table_privilege(current_user,'public.twin_external_formal_forcing_base_cursor_v1','SELECT'),
    has_table_privilege(current_user,'public.twin_external_formal_forcing_base_cursor_v1','INSERT'),
    has_table_privilege(current_user,'public.twin_external_formal_forcing_base_cursor_v1','UPDATE'),
    has_table_privilege(current_user,'public.twin_external_formal_forcing_base_target_v1','SELECT'),
    has_table_privilege(current_user,'public.twin_external_formal_forcing_base_target_v1','INSERT'),
    has_table_privilege(current_user,'public.twin_external_formal_forcing_base_target_v1','UPDATE'),
    COALESCE((SELECT bool_and(has_function_privilege(current_user,p.oid,'EXECUTE')) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1'),false);`).split("|");
  req(e.length===10,"FORMAL_V5_CUTOVER_EVIDENCE_PRIVILEGE_QUERY_SHAPE");
  req(e[0]==="geox_mcft_cap09_evidence_runtime_login_v1"&&e[1]===FORMAL_DB,"FORMAL_V5_CUTOVER_EVIDENCE_RUNTIME_IDENTITY_INVALID");
  req(e[2]==="f"&&e.slice(3,9).every(x=>x==="t")&&e[9]==="t","FORMAL_V5_CUTOVER_EVIDENCE_RUNTIME_PRIVILEGE_INVALID");

  const t=psql(twinUrl,`SELECT current_user,current_database(),
    has_table_privilege(current_user,'public.facts','INSERT'),
    has_table_privilege(current_user,'public.twin_runtime_lease_v1','SELECT'),
    has_table_privilege(current_user,'public.twin_runtime_lease_v1','INSERT'),
    has_table_privilege(current_user,'public.twin_runtime_lease_v1','UPDATE'),
    has_table_privilege(current_user,'public.twin_shadow_online_scheduler_cursor_v1','SELECT'),
    has_table_privilege(current_user,'public.twin_shadow_online_scheduler_cursor_v1','INSERT'),
    has_table_privilege(current_user,'public.twin_shadow_online_scheduler_cursor_v1','UPDATE'),
    has_table_privilege(current_user,'public.twin_shadow_online_scheduler_slot_v1','SELECT'),
    has_table_privilege(current_user,'public.twin_shadow_online_scheduler_slot_v1','INSERT'),
    has_table_privilege(current_user,'public.twin_shadow_online_scheduler_slot_v1','UPDATE'),
    COALESCE((SELECT bool_and(has_function_privilege(current_user,p.oid,'EXECUTE')) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='mcft_cap09_twin_runtime_append_fact_v1'),false);`).split("|");
  req(t.length===13,"FORMAL_V5_CUTOVER_TWIN_PRIVILEGE_QUERY_SHAPE");
  req(t[0]==="geox_mcft_cap09_twin_runtime_login_v1"&&t[1]===FORMAL_DB,"FORMAL_V5_CUTOVER_TWIN_RUNTIME_IDENTITY_INVALID");
  req(t[2]==="f"&&t.slice(3,12).every(x=>x==="t")&&t[12]==="t","FORMAL_V5_CUTOVER_TWIN_RUNTIME_PRIVILEGE_INVALID");
  return {evidence:true,twin:true};
}
function verifyFormalBootstrapState(twinUrl,arm,a0){
  const raw=psql(twinUrl,`SELECT transaction_timestamp()::text,
    (SELECT count(*)::int FROM public.twin_shadow_online_scheduler_slot_v1),
    COALESCE((SELECT next_slot_id FROM public.twin_shadow_online_scheduler_cursor_v1 LIMIT 1),''),
    COALESCE((SELECT next_logical_time::text FROM public.twin_shadow_online_scheduler_cursor_v1 LIMIT 1),''),
    (SELECT count(*)::int FROM public.twin_external_formal_forcing_base_cursor_v1);`);
  const f=raw.split("|");req(f.length===5,"FORMAL_V5_CUTOVER_BOOTSTRAP_STATE_QUERY_SHAPE");
  req(Number(f[1])===0&&f[2]==="O00"&&f[3]===arm.o00,"FORMAL_V5_CUTOVER_BOOTSTRAP_SCHEDULER_STATE_INVALID",raw);
  req(Number(f[4])===0,"FORMAL_V5_CUTOVER_FORCING_CURSOR_MUST_BE_UNINITIALIZED_BEFORE_ACTIVE_RUNTIME");
  req(Date.parse(f[0])<Date.parse(arm.o00),"FORMAL_V5_CUTOVER_O00_ALREADY_REACHED",f[0]);
  req(a0.next_tick_logical_time===arm.o00,"FORMAL_V5_CUTOVER_A0_NEXT_TICK_INVALID");
  return {database_now:f[0],scheduler_slot_count:0,next_slot_id:"O00",next_logical_time:f[3],forcing_cursor_count:0};
}
function assertPreformalContainers(armSubject){
  const evidence=inspectService(EVIDENCE_SERVICE),twin=inspectService(TWIN_SERVICE),image=tagImageId(armSubject);
  for(const c of [evidence,twin]){
    req(c.count===1&&c.running===true,"FORMAL_V5_CUTOVER_PREFORMAL_CONTAINER_RUNNING_REQUIRED",c.service);
    req(c.subject===armSubject,"FORMAL_V5_CUTOVER_PREFORMAL_CONTAINER_SUBJECT_MISMATCH",c.service+":"+c.subject);
    req(c.image_id===image,"FORMAL_V5_CUTOVER_PREFORMAL_CONTAINER_IMAGE_MISMATCH",c.service);
    req(c.compose_project===PROJECT&&c.compose_service===c.service,"FORMAL_V5_CUTOVER_PREFORMAL_CONTAINER_COMPOSE_IDENTITY_INVALID",c.service);
  }
  return {evidence,twin,image_id:image};
}
function assertLeaseOwner(lease,prefix,container,code){
  req(lease.live_count===1&&lease.distinct_owner_count===1,code+"_COUNT");
  req(lease.lease_owner.startsWith(prefix+"#instance:"),code+"_SERVICE_ID");
  const instance=lease.lease_owner.slice((prefix+"#instance:").length);
  req(instance===container.hostname,code+"_CONTAINER_HOSTNAME");
  req(BigInt(lease.fencing_token)>0n,code+"_FENCE");
}
function waitForZeroLeases(evidenceUrl,twinUrl,deadlineMs){
  let last=null;
  while(Date.now()<deadlineMs){
    const e=queryLiveLease(evidenceUrl,"external_evidence_producer_lease_v1");
    const t=queryLiveLease(twinUrl,"twin_runtime_lease_v1");
    last={evidence:e,twin:t};
    if(e.live_count===0&&t.live_count===0)return last;
    sleep(5000);
  }
  fail("FORMAL_V5_CUTOVER_OPERATIONAL_LEASES_DID_NOT_EXPIRE",JSON.stringify(last));
}
function waitForFormalOwners(input){
  let last=null;
  while(Date.now()<input.deadline_ms){
    const evidenceContainer=inspectService(EVIDENCE_SERVICE),twinContainer=inspectService(TWIN_SERVICE);
    const opEvidence=queryLiveLease(input.operational_evidence_url,"external_evidence_producer_lease_v1");
    const opTwin=queryLiveLease(input.operational_twin_url,"twin_runtime_lease_v1");
    const formalTwin=queryLiveLease(input.formal_twin_url,"twin_runtime_lease_v1");
    last={evidenceContainer,twinContainer,opEvidence,opTwin,formalTwin};
    const formalOwned=
      evidenceContainer.count===1&&evidenceContainer.running&&
      twinContainer.count===1&&twinContainer.running&&
      opEvidence.live_count===1&&opTwin.live_count===0&&
      formalTwin.live_count===1&&
      formalTwin.lease_owner.startsWith(TWIN_SERVICE_ID+"#instance:")&&
      BigInt(formalTwin.fencing_token)>input.bootstrap_fence&&
      formalTwin.lease_owner.slice((TWIN_SERVICE_ID+"#instance:").length)===twinContainer.hostname;
    if(formalOwned){
      assertLeaseOwner(opEvidence,EVIDENCE_SERVICE_ID,evidenceContainer,"FORMAL_V5_CUTOVER_OPERATIONAL_EVIDENCE_OWNER");
      return last;
    }
    if(Date.parse(formalTwin.database_now)>=Date.parse(input.o00))break;
    sleep(5000);
  }
  fail("FORMAL_V5_CUTOVER_FORMAL_OWNER_NOT_ESTABLISHED_BEFORE_O00",JSON.stringify(last));
}
function composeDown(env){
  try{exec("docker",["compose","-f",FORMAL_COMPOSE,"down","--remove-orphans"],{env,timeoutMs:120000});}catch{}
}
function selftest(){
  const derived=deriveDatabaseUrl("postgresql://u:p@example.test:5432/old?sslmode=require",FORMAL_DB);
  const u=new URL(derived);
  req(decodeURIComponent(u.pathname.replace(/^\//,""))===FORMAL_DB,"SELFTEST_FORMAL_DB_DERIVATION");
  req(u.username==="u"&&u.password==="p"&&u.searchParams.get("sslmode")==="require","SELFTEST_CREDENTIAL_QUERY_PRESERVATION");
  const arm={schema_version:"geox_mcft_cap09_formal_v5_arm_v1",status:"PASS",formal_database_name:FORMAL_DB,formal_v5_arm:true,formal_v5_epoch_selected:true,formal_database_mutation:false,a0_bootstrap:false,o00_started:false,subject_sha:"a".repeat(40),arm_identity_hash:"sha256:"+"b".repeat(64),a0:"2099-01-01T00:00:00.000Z",o00:"2099-01-01T01:00:00.000Z",o23:"2099-01-02T00:00:00.000Z"};
  validateArm(arm);
  process.stdout.write(JSON.stringify({
    schema_version:"geox_mcft_cap09_formal_v5_runtime_cutover_selftest_v1",
    status:"PASS",
    database_url_derivation_preserves_credentials_without_printing:true,
    exact_v5_database_binding:true,
    lease_mutation_count:0,
    docker_effect_count:0,
    formal_v5_arm:false,
    o00_started:false,
  },null,2)+"\n");
}
async function main(){
  if(has("--selftest"))return selftest();
  req(!process.env.GITHUB_ACTIONS&&process.env.CI!=="true","FORMAL_V5_CUTOVER_LOCAL_NON_GITHUB_HOST_ONLY");
  req(has("--operator-authorized"),"FORMAL_V5_CUTOVER_OPERATOR_AUTHORIZATION_REQUIRED");

  git("fetch","--no-tags","origin","main");
  const head=git("rev-parse","HEAD"),origin=git("rev-parse","origin/main");
  req(head===origin,"FORMAL_V5_CUTOVER_HEAD_NOT_CURRENT_MAIN",head+":"+origin);
  req(git("status","--porcelain")==="","FORMAL_V5_CUTOVER_WORKTREE_MUST_BE_CLEAN");

  const armPath=path.resolve(arg("--arm")||DEFAULT_ARM);
  const a0Path=path.resolve(arg("--a0-bootstrap")||DEFAULT_A0);
  const arm=read(armPath,"FORMAL_V5_CUTOVER_ARM_FILE_INVALID");
  const a0=read(a0Path,"FORMAL_V5_CUTOVER_A0_FILE_INVALID");
  validateArm(arm);validateBootstrap(a0,arm);
  const armSubject=sha(arm.subject_sha,"FORMAL_V5_CUTOVER_ARM_SUBJECT_INVALID");

  const manifestPath=path.resolve(arg("--manifest")||a0.manifest_path||DEFAULT_MANIFEST);
  const manifest=read(manifestPath,"FORMAL_V5_CUTOVER_MANIFEST_FILE_INVALID");
  validateManifest(manifest,arm,a0);

  const currentCropPath=path.join(ROOT,text(a0.current_crop_authority_ref,"FORMAL_V5_CUTOVER_CURRENT_CROP_REF_REQUIRED"));
  req(fs.existsSync(currentCropPath),"FORMAL_V5_CUTOVER_CURRENT_CROP_FILE_REQUIRED");
  const currentCropDigest="sha256:"+require("node:crypto").createHash("sha256").update(fs.readFileSync(currentCropPath)).digest("hex");
  req(currentCropDigest===a0.current_crop_authority_sha256,"FORMAL_V5_CUTOVER_CURRENT_CROP_DIGEST_MISMATCH");

  const continuityOut=path.resolve(arg("--continuity-out")||DEFAULT_CONTINUITY);
  exec(process.execPath,[CONTINUITY,`--arm-subject=${armSubject}`,`--logical-time=${arm.o23}`,`--out=${continuityOut}`],{timeoutMs:120000,stdio:"inherit"});
  const continuity=read(continuityOut,"FORMAL_V5_CUTOVER_CONTINUITY_RESULT_INVALID");
  req(continuity.status==="PASS"&&continuity.arm_runtime_semantic_subject_sha===armSubject&&continuity.runtime_code_change_count===0&&continuity.qcp_change_count===0&&continuity.workflow_change_count===0,"FORMAL_V5_CUTOVER_POST_ARM_CONTINUITY_REQUIRED");

  const operationalEvidenceUrl=requiredEnv("GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL");
  const operationalTwinUrl=requiredEnv("GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL");
  const formalEvidenceUrl=String(process.env.GEOX_MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_DATABASE_URL||"").trim()||deriveDatabaseUrl(operationalEvidenceUrl,FORMAL_DB);
  const formalTwinUrl=String(process.env.GEOX_MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_DATABASE_URL||"").trim()||deriveDatabaseUrl(operationalTwinUrl,FORMAL_DB);
  req(databaseName(formalEvidenceUrl,"FORMAL_V5_CUTOVER_FORMAL_EVIDENCE_URL_INVALID")===FORMAL_DB,"FORMAL_V5_CUTOVER_FORMAL_EVIDENCE_DB_MISMATCH");
  req(databaseName(formalTwinUrl,"FORMAL_V5_CUTOVER_FORMAL_TWIN_URL_INVALID")===FORMAL_DB,"FORMAL_V5_CUTOVER_FORMAL_TWIN_DB_MISMATCH");
  req(formalEvidenceUrl!==formalTwinUrl,"FORMAL_V5_CUTOVER_EVIDENCE_TWIN_CREDENTIALS_MUST_DIFFER");

  for(const name of [
    "GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT","GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET","GEOX_MCFT_CAP09_EVIDENCE_S3_REGION",
    "GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID","GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY",
    "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT","GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET","GEOX_MCFT_CAP09_FORMAL_RAW_S3_REGION",
    "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID","GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY",
  ]) requiredEnv(name);
  req(process.env.GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET==="geox-mcft-cap09-evidence-runtime-v1","FORMAL_V5_CUTOVER_OPERATIONAL_RAW_BUCKET_INVALID");
  req(process.env.GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET==="geox-mcft-cap09-formal-raw-v1","FORMAL_V5_CUTOVER_FORMAL_RAW_BUCKET_INVALID");
  req(process.env.GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET!==process.env.GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET,"FORMAL_V5_CUTOVER_RAW_BUCKET_IDENTITY_COLLAPSE_FORBIDDEN");

  verifyRuntimeDbPrivileges(formalEvidenceUrl,formalTwinUrl);
  const bootstrapState=verifyFormalBootstrapState(formalTwinUrl,arm,a0);

  const pre=assertPreformalContainers(armSubject);
  const opEvidenceBefore=queryLiveLease(operationalEvidenceUrl,"external_evidence_producer_lease_v1");
  const opTwinBefore=queryLiveLease(operationalTwinUrl,"twin_runtime_lease_v1");
  assertLeaseOwner(opEvidenceBefore,EVIDENCE_SERVICE_ID,pre.evidence,"FORMAL_V5_CUTOVER_PREFORMAL_EVIDENCE_OWNER");
  assertLeaseOwner(opTwinBefore,TWIN_SERVICE_ID,pre.twin,"FORMAL_V5_CUTOVER_PREFORMAL_TWIN_OWNER");

  const runtimeRoot=path.join(os.homedir(),".geox","mcft-cap09","runtime",armSubject);
  const runtimeAuthorityPath=String(process.env.GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_PATH||path.join(runtimeRoot,"runtime-start-authority.json"));
  const ownerAuthorityPath=String(process.env.GEOX_MCFT_CAP09_PRODUCTION_OWNER_CUTOVER_AUTHORITY_PATH||path.join(runtimeRoot,"owner-cutover-authority.json"));
  for(const fp of [runtimeAuthorityPath,ownerAuthorityPath,armPath,a0Path,manifestPath,currentCropPath])req(fs.existsSync(fp),"FORMAL_V5_CUTOVER_REQUIRED_AUTHORITY_FILE_MISSING",fp);

  const runtimeAuthority=read(runtimeAuthorityPath,"FORMAL_V5_CUTOVER_RUNTIME_AUTHORITY_INVALID");
  const scope=runtimeAuthority.scope;
  for(const key of ["tenant_id","project_id","group_id","field_id","season_id","zone_id"])req(scope&&scope[key],"FORMAL_V5_CUTOVER_SCOPE_REQUIRED:"+key);

  const logRoot=String(process.env.GEOX_MCFT_CAP09_DURABLE_LOG_ROOT||DEFAULT_LOG_ROOT);
  fs.mkdirSync(path.join(logRoot,"evidence"),{recursive:true});fs.mkdirSync(path.join(logRoot,"twin"),{recursive:true});
  const env={...process.env,
    GEOX_DEPLOYMENT_SUBJECT_COMMIT:armSubject,
    GEOX_MCFT_CAP09_DURABLE_LOG_ROOT:logRoot,
    GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_PATH:runtimeAuthorityPath,
    GEOX_MCFT_CAP09_PRODUCTION_OWNER_CUTOVER_AUTHORITY_PATH:ownerAuthorityPath,
    GEOX_MCFT_CAP09_FORMAL_V5_ARM_PATH:armPath,
    GEOX_MCFT_CAP09_FORMAL_V5_A0_BOOTSTRAP_PATH:a0Path,
    GEOX_MCFT_CAP09_FORMAL_V5_MANIFEST_PATH:manifestPath,
    GEOX_MCFT_CAP09_FORMAL_V5_CURRENT_CROP_AUTHORITY_PATH:currentCropPath,
    GEOX_MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_DATABASE_URL:formalEvidenceUrl,
    GEOX_MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_DATABASE_URL:formalTwinUrl,
    GEOX_MCFT_CAP09_TENANT_ID:scope.tenant_id,GEOX_MCFT_CAP09_PROJECT_ID:scope.project_id,GEOX_MCFT_CAP09_GROUP_ID:scope.group_id,
    GEOX_MCFT_CAP09_FIELD_ID:scope.field_id,GEOX_MCFT_CAP09_SEASON_ID:scope.season_id,GEOX_MCFT_CAP09_ZONE_ID:scope.zone_id,
  };

  // Render before the first Docker effect.
  exec("docker",["compose","-f",FORMAL_COMPOSE,"config","--quiet"],{env,timeoutMs:120000});
  const renderedServices=exec("docker",["compose","-f",FORMAL_COMPOSE,"config","--services"],{env}).split(/\r?\n/).filter(Boolean).sort();
  req(JSON.stringify(renderedServices)===JSON.stringify([EVIDENCE_SERVICE,TWIN_SERVICE].sort()),"FORMAL_V5_CUTOVER_EXACT_TWO_SERVICES_REQUIRED");

  let formalStarted=false;
  try{
    // Graceful stop only. No DB lease mutation and no volume deletion.
    exec("docker",["stop","--time","45",pre.evidence.id,pre.twin.id],{timeoutMs:120000});
    waitForZeroLeases(operationalEvidenceUrl,operationalTwinUrl,Date.now()+420000);
    exec("docker",["rm",pre.evidence.id,pre.twin.id],{timeoutMs:120000});

    exec("docker",["compose","-f",FORMAL_COMPOSE,"up","-d","--no-build",EVIDENCE_SERVICE,TWIN_SERVICE],{env,timeoutMs:120000});
    formalStarted=true;

    const after=waitForFormalOwners({
      operational_evidence_url:operationalEvidenceUrl,
      operational_twin_url:operationalTwinUrl,
      formal_twin_url:formalTwinUrl,
      bootstrap_fence:BigInt(a0.lease_fencing_token),
      o00:arm.o00,
      deadline_ms:Math.min(Date.now()+900000,Date.parse(arm.o00)+1000),
    });
    req(after.evidenceContainer.image_id===pre.image_id&&after.twinContainer.image_id===pre.image_id,"FORMAL_V5_CUTOVER_IMAGE_ID_CHANGED");
    req(after.evidenceContainer.subject===armSubject&&after.twinContainer.subject===armSubject,"FORMAL_V5_CUTOVER_ACTIVE_CONTAINER_SUBJECT_MISMATCH");
    req(after.opTwin.live_count===0,"FORMAL_V5_CUTOVER_OPERATIONAL_TWIN_OWNER_MUST_REMAIN_ZERO");

    const twinEvent=readLatestEvent(path.join(logRoot,"twin","runtime.log"),event=>
      event?.runtime_role==="TWIN_RUNTIME"&&event?.mode==="FORMAL_V5_ACTIVE"&&event?.deployment_subject_sha===armSubject&&event?.epoch_id===arm.epoch_id
    );
    req(twinEvent,"FORMAL_V5_CUTOVER_TWIN_FORMAL_ACTIVE_HEALTH_REQUIRED");

    const forcingEvent=readLatestEvent(path.join(logRoot,"evidence","runtime.log"),event=>
      event?.runtime_role==="EVIDENCE_RUNTIME"&&event?.subordinate_runtime==="MCFT_CAP09_FORMAL_V5_FORCING_RUNTIME_V1"&&event?.mode==="FORMAL_V5_ACTIVE"&&event?.deployment_subject_sha===armSubject&&event?.epoch_id===arm.epoch_id
    );
    req(forcingEvent,"FORMAL_V5_CUTOVER_FORMAL_FORCING_HEALTH_REQUIRED");

    const finalDbNow=queryLiveLease(formalTwinUrl,"twin_runtime_lease_v1").database_now;
    req(Date.parse(finalDbNow)<Date.parse(arm.o00),"FORMAL_V5_CUTOVER_VERIFICATION_CROSSED_O00");
    const slotCount=Number(psql(formalTwinUrl,"SELECT count(*)::int FROM public.twin_shadow_online_scheduler_slot_v1;"));
    req(slotCount===0,"FORMAL_V5_CUTOVER_MUST_NOT_START_O00");

    const result={
      schema_version:"geox_mcft_cap09_formal_v5_runtime_cutover_result_v1",
      status:"PASS",
      arm_runtime_semantic_subject_sha:armSubject,
      authority_continuity_head_sha:head,
      epoch_id:arm.epoch_id,
      formal_database_name:FORMAL_DB,
      image_id:pre.image_id,
      service_count:2,
      evidence_service:EVIDENCE_SERVICE,
      twin_service:TWIN_SERVICE,
      operational_evidence_owner_reacquired:true,
      operational_twin_owner_count:0,
      formal_twin_owner_acquired:true,
      formal_twin_fencing_token:after.formalTwin.fencing_token,
      formal_twin_fence_gt_a0_bootstrap_fence:BigInt(after.formalTwin.fencing_token)>BigInt(a0.lease_fencing_token),
      twin_mode:"FORMAL_V5_ACTIVE",
      subordinate_formal_forcing_observed:true,
      forcing_cursor_initialized_by_runtime_wrapper:true,
      provider_request_count_not_asserted_by_cutover:true,
      database_lease_manual_mutation_count:0,
      docker_service_count:2,
      automatic_preformal_rollback:false,
      formal_v5_arm:true,
      formal_a0_bootstrapped:true,
      formal_o00_started:false,
      scheduler_slot_count:0,
      mcft_cap09_completed:false,
      bootstrap_state:bootstrapState,
    };
    const out=path.resolve(arg("--out")||DEFAULT_OUT);
    fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+"\n");
    process.stdout.write(JSON.stringify(result,null,2)+"\n");
  }catch(error){
    if(formalStarted)composeDown(env);
    throw error;
  }
}
main().catch(error=>{
  process.stderr.write((error instanceof Error?error.stack??error.message:String(error))+"\n");
  process.exitCode=1;
});
