#!/usr/bin/env node
"use strict";

const cp=require("node:child_process");
const crypto=require("node:crypto");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {Pool}=require("pg");

const ROOT=path.resolve(__dirname,"../..");
const COMPOSE_REL="docker-compose.mcft-cap09-formal-v5.yml";
const HOST_BINDING_REL="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1.json";
const DEFAULT_ATTESTATION=path.join(ROOT,"acceptance-output","MCFT_CAP_09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_V1_RESULT.json");
const DEFAULT_OUT=path.join(os.homedir(),".geox","mcft-cap09","formal-v5","o00-twin-cutover-v1.json");
const PREFORMAL_PROJECT="geox-mcft-cap09-production-v1";
const PREFORMAL_TWIN_SERVICE="geox-mcft-cap09-twin-runtime-v1";
const PREFORMAL_EVIDENCE_SERVICE="geox-mcft-cap09-evidence-runtime-v1";
const FORMAL_SERVICE="geox-mcft-cap09-formal-v5-twin-runtime-v1";
const FORMAL_DB="geox_mcft_cap09_s6_formal_t4r1_24h_v5";
const HOUR=3_600_000;

function fail(code,detail){throw new Error(detail===undefined?code:code+":"+String(detail));}
function req(ok,code,detail){if(!ok)fail(code,detail);}
function arg(name){const row=process.argv.slice(2).find(v=>v.startsWith(name+"="));return row?row.slice(name.length+1):null;}
function has(name){return process.argv.includes(name);}
function requiredEnv(name){const v=String(process.env[name]??"").trim();if(!v)fail("FORMAL_V5_TWIN_CUTOVER_ENV_REQUIRED",name);return v;}
function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();}
function exec(command,args,options={}){return cp.execFileSync(command,args,{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"],env:options.env??process.env,timeout:options.timeoutMs??120000}).trim();}
function json(file,code){req(fs.existsSync(file),code,file);return JSON.parse(fs.readFileSync(file,"utf8"));}
function iso(value,code){const v=String(value??"").trim(),t=Date.parse(v);req(Number.isFinite(t)&&new Date(t).toISOString()===v,code,v);return v;}
function digest(file){return "sha256:"+crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");}
function dbName(urlText){const u=new URL(urlText);return decodeURIComponent(u.pathname.replace(/^\//,""));}
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+"\n");}
function dockerRows(project,service){
  const out=exec("docker",[
    "ps",
    "--filter","label=com.docker.compose.project="+project,
    "--filter","label=com.docker.compose.service="+service,
    "--format","{{.ID}}|{{.Image}}|{{.Names}}"
  ]);
  if(!out)return [];
  return out.split(/\r?\n/).filter(Boolean).map(line=>{
    const [id,image,name]=line.split("|");
    return {id,image,name};
  });
}
function selftest(){
  const sequence=[
    "REQUIRE_A0_BOOTSTRAP_PASS",
    "REQUIRE_DATABASE_NOW_AT_OR_AFTER_O00",
    "RECORD_EXACT_ONE_EVIDENCE_OWNER",
    "STOP_PREFORMAL_TWIN",
    "REQUIRE_PRODUCTION_TWIN_LIVE_OWNER_ZERO",
    "REQUIRE_FORMAL_BOOTSTRAP_LEASE_EXPIRED",
    "START_FORMAL_V5_TWIN_FROM_ARM_SUBJECT_IMAGE",
    "REQUIRE_FORMAL_EXACT_ONE_TWIN_OWNER",
    "REQUIRE_FENCING_TOKEN_GREATER_THAN_A0_BOOTSTRAP",
    "REQUIRE_EVIDENCE_OWNER_UNCHANGED",
  ];
  process.stdout.write(JSON.stringify({
    schema_version:"geox_mcft_cap09_formal_v5_twin_cutover_selftest_v1",
    status:"PASS",
    sequence,
    double_owner_window_allowed:false,
    evidence_owner_mutation_allowed:false,
    preformal_auto_restart_on_failure:false,
    github_execution_allowed:false,
    o00_execution_from_selftest:false,
  },null,2)+"\n");
}

async function main(){
  if(has("--selftest"))return selftest();
  if(process.env.GITHUB_ACTIONS||process.env.CI)fail("FORMAL_V5_TWIN_CUTOVER_LOCAL_NON_GITHUB_HOST_ONLY");
  if(!has("--operator-authorized"))fail("FORMAL_V5_TWIN_CUTOVER_OPERATOR_AUTHORIZATION_REQUIRED");

  git("fetch","--no-tags","origin","main");
  const head=git("rev-parse","HEAD"),origin=git("rev-parse","origin/main");
  req(head===origin,"FORMAL_V5_TWIN_CUTOVER_HEAD_MUST_EQUAL_CURRENT_MAIN",head+":"+origin);
  req(git("status","--porcelain")==="","FORMAL_V5_TWIN_CUTOVER_WORKTREE_MUST_BE_CLEAN");

  const bootstrapPath=path.resolve(arg("--a0-bootstrap")||requiredEnv("GEOX_MCFT_CAP09_FORMAL_V5_A0_BOOTSTRAP_PROOF_PATH"));
  const attestationPath=path.resolve(arg("--artifact-attestation")||String(process.env.GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_ARTIFACT_ATTESTATION_PATH||DEFAULT_ATTESTATION));
  const out=path.resolve(arg("--out")||DEFAULT_OUT);
  const bootstrap=json(bootstrapPath,"FORMAL_V5_TWIN_CUTOVER_A0_BOOTSTRAP_REQUIRED");
  req(
    bootstrap.schema_version==="geox_mcft_cap09_formal_v5_a0_bootstrap_result_v1"
      &&bootstrap.status==="PASS"
      &&bootstrap.formal_a0_bootstrapped===true
      &&bootstrap.formal_o00_started===false
      &&bootstrap.final_actual_24h_still_required===true
      &&bootstrap.store_reuse_authorized_after_success===true,
    "FORMAL_V5_TWIN_CUTOVER_A0_BOOTSTRAP_PASS_REQUIRED"
  );
  const armSubject=String(bootstrap.arm_runtime_semantic_subject_sha||"");
  req(/^[0-9a-f]{40}$/.test(armSubject),"FORMAL_V5_TWIN_CUTOVER_ARM_SUBJECT_INVALID",armSubject);
  req(String(bootstrap.authority_continuity_head_sha||"")===head,"FORMAL_V5_TWIN_CUTOVER_CONTINUITY_HEAD_MISMATCH");
  try{cp.execFileSync("git",["merge-base","--is-ancestor",armSubject,head],{cwd:ROOT,stdio:"ignore"});}catch{fail("FORMAL_V5_TWIN_CUTOVER_ARM_SUBJECT_NOT_ANCESTOR",armSubject+"->"+head);}

  const o00=iso(bootstrap.o00,"FORMAL_V5_TWIN_CUTOVER_O00_INVALID");
  const o23=iso(bootstrap.o23,"FORMAL_V5_TWIN_CUTOVER_O23_INVALID");
  req(Date.parse(o23)-Date.parse(o00)===23*HOUR,"FORMAL_V5_TWIN_CUTOVER_O00_O23_SPAN_INVALID");

  const manifestPath=path.resolve(String(bootstrap.manifest_path||""));
  req(fs.existsSync(manifestPath),"FORMAL_V5_TWIN_CUTOVER_MANIFEST_REQUIRED",manifestPath);
  const manifest=json(manifestPath,"FORMAL_V5_TWIN_CUTOVER_MANIFEST_INVALID");
  req(
    manifest.manifest_ref===bootstrap.manifest_ref
      &&manifest.manifest_hash===bootstrap.manifest_hash
      &&manifest.epoch_id===bootstrap.epoch_id
      &&manifest.o00_logical_time===o00
      &&manifest.database_name===FORMAL_DB,
    "FORMAL_V5_TWIN_CUTOVER_MANIFEST_BOOTSTRAP_MISMATCH"
  );

  const currentCropRef=String(bootstrap.current_crop_authority_ref||"").trim();
  req(currentCropRef.startsWith("docs/digital_twin/mcft/cap_09/"),"FORMAL_V5_TWIN_CUTOVER_CURRENT_CROP_REF_INVALID");
  const currentCropPath=path.join(ROOT,currentCropRef);
  req(fs.existsSync(currentCropPath),"FORMAL_V5_TWIN_CUTOVER_CURRENT_CROP_MISSING",currentCropRef);
  req(digest(currentCropPath)===bootstrap.current_crop_authority_sha256,"FORMAL_V5_TWIN_CUTOVER_CURRENT_CROP_DIGEST_MISMATCH");

  const attestation=json(attestationPath,"FORMAL_V5_TWIN_CUTOVER_IMAGE_ATTESTATION_REQUIRED");
  req(attestation.schema_version==="geox_mcft_cap09_production_runtime_artifact_attestation_v1"&&attestation.status==="PASS","FORMAL_V5_TWIN_CUTOVER_IMAGE_ATTESTATION_INVALID");
  req(attestation.subject_main_sha===armSubject,"FORMAL_V5_TWIN_CUTOVER_IMAGE_ATTESTATION_SUBJECT_MISMATCH");

  const imageTag="geox-mcft-cap09-runtime:"+armSubject;
  const inspectedImage=exec("docker",["image","inspect",imageTag,"--format","{{.Id}}"]);
  req(inspectedImage===attestation.authorized_image_id,"FORMAL_V5_TWIN_CUTOVER_IMAGE_ID_MISMATCH",inspectedImage+":"+attestation.authorized_image_id);

  const hostBinding=json(path.join(ROOT,HOST_BINDING_REL),"FORMAL_V5_TWIN_CUTOVER_HOST_BINDING_REQUIRED");
  const stableTwinServiceId=String(hostBinding?.host_identity_contract?.twin_runtime?.service_identity?.service_id||"").trim();
  req(stableTwinServiceId.length>0,"FORMAL_V5_TWIN_CUTOVER_STABLE_TWIN_SERVICE_ID_REQUIRED");

  const prodTwinUrl=requiredEnv("GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL");
  const prodEvidenceUrl=requiredEnv("GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL");
  const formalUrl=requiredEnv("GEOX_MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_DATABASE_URL");
  req(dbName(formalUrl)===FORMAL_DB,"FORMAL_V5_TWIN_CUTOVER_FORMAL_DATABASE_URL_MISMATCH");

  const twinPool=new Pool({connectionString:prodTwinUrl,max:1,application_name:"mcft-cap09-formal-v5-cutover-prod-twin-read"});
  const evidencePool=new Pool({connectionString:prodEvidenceUrl,max:1,application_name:"mcft-cap09-formal-v5-cutover-evidence-read"});
  const formalPool=new Pool({connectionString:formalUrl,max:1,application_name:"mcft-cap09-formal-v5-cutover-formal-read"});

  let preformalStopped=false;
  try{
    const formalClock=(await formalPool.query("SELECT transaction_timestamp() AS now")).rows[0];
    const databaseNow=iso(new Date(formalClock.now).toISOString(),"FORMAL_V5_TWIN_CUTOVER_DATABASE_NOW_INVALID");
    req(Date.parse(databaseNow)>=Date.parse(o00),"FORMAL_V5_TWIN_CUTOVER_BEFORE_O00_FORBIDDEN",databaseNow+":"+o00);
    req(Date.parse(databaseNow)<Date.parse(o00)+HOUR,"FORMAL_V5_TWIN_CUTOVER_O00_START_WINDOW_MISSED",databaseNow+":"+o00);

    const evidenceBefore=(await evidencePool.query(
      "SELECT lease_owner,fencing_token,heartbeat_at,expires_at FROM external_evidence_producer_lease_v1 WHERE expires_at>transaction_timestamp() ORDER BY acquired_at DESC"
    )).rows;
    req(evidenceBefore.length===1,"FORMAL_V5_TWIN_CUTOVER_EXACT_ONE_EVIDENCE_OWNER_REQUIRED",evidenceBefore.length);
    const evidenceOwnerBefore=String(evidenceBefore[0].lease_owner);
    const evidenceFenceBefore=String(evidenceBefore[0].fencing_token);

    const preformalTwin=dockerRows(PREFORMAL_PROJECT,PREFORMAL_TWIN_SERVICE);
    const preformalEvidence=dockerRows(PREFORMAL_PROJECT,PREFORMAL_EVIDENCE_SERVICE);
    req(preformalTwin.length===1,"FORMAL_V5_TWIN_CUTOVER_EXACT_ONE_PREFORMAL_TWIN_CONTAINER_REQUIRED",preformalTwin.length);
    req(preformalEvidence.length===1,"FORMAL_V5_TWIN_CUTOVER_EXACT_ONE_EVIDENCE_CONTAINER_REQUIRED",preformalEvidence.length);
    req(preformalTwin[0].image===imageTag,"FORMAL_V5_TWIN_CUTOVER_PREFORMAL_TWIN_IMAGE_MISMATCH",preformalTwin[0].image);
    req(preformalEvidence[0].image===imageTag,"FORMAL_V5_TWIN_CUTOVER_EVIDENCE_IMAGE_MISMATCH",preformalEvidence[0].image);

    const prodTwinBefore=(await twinPool.query(
      "SELECT lease_owner,fencing_token,heartbeat_at,expires_at FROM twin_runtime_lease_v1 WHERE expires_at>transaction_timestamp()"
    )).rows;
    req(prodTwinBefore.length===1,"FORMAL_V5_TWIN_CUTOVER_EXACT_ONE_PREFORMAL_TWIN_OWNER_REQUIRED",prodTwinBefore.length);

    const formalBefore=(await formalPool.query(
      "SELECT lease_owner,fencing_token,heartbeat_at,expires_at FROM twin_runtime_lease_v1 WHERE expires_at>transaction_timestamp()"
    )).rows;
    req(formalBefore.length===0,"FORMAL_V5_TWIN_CUTOVER_FORMAL_LIVE_OWNER_MUST_BE_ZERO_BEFORE_START",formalBefore.length);

    const bootstrapFence=BigInt(String(bootstrap.lease_fencing_token||"0"));
    req(bootstrapFence>0n,"FORMAL_V5_TWIN_CUTOVER_BOOTSTRAP_FENCE_REQUIRED");
    const formalLeaseRow=(await formalPool.query(
      "SELECT lease_owner,fencing_token,expires_at FROM twin_runtime_lease_v1 ORDER BY acquired_at DESC LIMIT 1"
    )).rows[0];
    req(formalLeaseRow!==undefined,"FORMAL_V5_TWIN_CUTOVER_BOOTSTRAP_LEASE_ROW_REQUIRED");
    req(BigInt(String(formalLeaseRow.fencing_token))===bootstrapFence,"FORMAL_V5_TWIN_CUTOVER_BOOTSTRAP_FENCE_DRIFT");
    req(Date.parse(new Date(formalLeaseRow.expires_at).toISOString())<=Date.parse(databaseNow),"FORMAL_V5_TWIN_CUTOVER_BOOTSTRAP_LEASE_STILL_LIVE");

    exec("docker",["stop","--time","30",preformalTwin[0].id],{timeoutMs:45000});
    preformalStopped=true;

    let released=false;
    const releaseDeadline=Date.now()+30000;
    while(Date.now()<releaseDeadline){
      const rows=(await twinPool.query(
        "SELECT lease_owner,fencing_token,expires_at FROM twin_runtime_lease_v1 WHERE expires_at>transaction_timestamp()"
      )).rows;
      if(rows.length===0){released=true;break;}
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    req(released,"FORMAL_V5_TWIN_CUTOVER_PREFORMAL_TWIN_LEASE_NOT_RELEASED");

    const evidenceAfterStop=(await evidencePool.query(
      "SELECT lease_owner,fencing_token,heartbeat_at,expires_at FROM external_evidence_producer_lease_v1 WHERE expires_at>transaction_timestamp()"
    )).rows;
    req(evidenceAfterStop.length===1,"FORMAL_V5_TWIN_CUTOVER_EVIDENCE_OWNER_LOST_AFTER_TWIN_STOP",evidenceAfterStop.length);
    req(String(evidenceAfterStop[0].lease_owner)===evidenceOwnerBefore,"FORMAL_V5_TWIN_CUTOVER_EVIDENCE_OWNER_CHANGED_AFTER_TWIN_STOP");

    const durableLogRoot=requiredEnv("GEOX_MCFT_CAP09_DURABLE_LOG_ROOT");
    fs.mkdirSync(path.join(durableLogRoot,"formal-v5-twin"),{recursive:true});
    const composeEnv={...process.env,
      GEOX_DEPLOYMENT_SUBJECT_COMMIT:armSubject,
      GEOX_MCFT_CAP09_FORMAL_V5_TWIN_SERVICE_ID:stableTwinServiceId,
      GEOX_MCFT_CAP09_FORMAL_V5_A0_BOOTSTRAP_PROOF_PATH:bootstrapPath,
      GEOX_MCFT_CAP09_FORMAL_V5_MANIFEST_PATH:manifestPath,
      GEOX_MCFT_CAP09_FORMAL_V5_CURRENT_CROP_AUTHORITY_PATH:currentCropPath,
      GEOX_MCFT_CAP09_FORMAL_V5_CURRENT_CROP_AUTHORITY_REF:currentCropRef,
    };

    exec("docker",["compose","-f",COMPOSE_REL,"up","-d","--no-build",FORMAL_SERVICE],{env:composeEnv,timeoutMs:120000});

    let formalOwner=null;
    const ownerDeadline=Date.now()+120000;
    while(Date.now()<ownerDeadline){
      const rows=(await formalPool.query(
        "SELECT lease_owner,fencing_token,acquired_at,heartbeat_at,expires_at FROM twin_runtime_lease_v1 WHERE expires_at>transaction_timestamp()"
      )).rows;
      if(rows.length===1){
        formalOwner=rows[0];
        break;
      }
      req(rows.length===0,"FORMAL_V5_TWIN_CUTOVER_MULTIPLE_FORMAL_OWNERS",rows.length);
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    req(formalOwner!==null,"FORMAL_V5_TWIN_CUTOVER_FORMAL_OWNER_TIMEOUT");
    req(String(formalOwner.lease_owner).startsWith(stableTwinServiceId+"#instance:"),"FORMAL_V5_TWIN_CUTOVER_FORMAL_OWNER_IDENTITY_MISMATCH",formalOwner.lease_owner);
    req(BigInt(String(formalOwner.fencing_token))>bootstrapFence,"FORMAL_V5_TWIN_CUTOVER_FENCE_NOT_ADVANCED",formalOwner.fencing_token);

    const prodTwinAfter=(await twinPool.query(
      "SELECT lease_owner,fencing_token FROM twin_runtime_lease_v1 WHERE expires_at>transaction_timestamp()"
    )).rows;
    req(prodTwinAfter.length===0,"FORMAL_V5_TWIN_CUTOVER_DOUBLE_OWNER_WINDOW_DETECTED",prodTwinAfter.length);

    const evidenceAfter=(await evidencePool.query(
      "SELECT lease_owner,fencing_token,heartbeat_at,expires_at FROM external_evidence_producer_lease_v1 WHERE expires_at>transaction_timestamp()"
    )).rows;
    req(evidenceAfter.length===1,"FORMAL_V5_TWIN_CUTOVER_EVIDENCE_OWNER_LOST",evidenceAfter.length);
    req(String(evidenceAfter[0].lease_owner)===evidenceOwnerBefore,"FORMAL_V5_TWIN_CUTOVER_EVIDENCE_OWNER_CHANGED");
    req(String(evidenceAfter[0].fencing_token)===evidenceFenceBefore,"FORMAL_V5_TWIN_CUTOVER_EVIDENCE_FENCE_CHANGED");

    const formalContainers=dockerRows("geox-mcft-cap09-formal-v5-v1",FORMAL_SERVICE);
    req(formalContainers.length===1,"FORMAL_V5_TWIN_CUTOVER_EXACT_ONE_FORMAL_CONTAINER_REQUIRED",formalContainers.length);
    req(formalContainers[0].image===imageTag,"FORMAL_V5_TWIN_CUTOVER_FORMAL_IMAGE_MISMATCH",formalContainers[0].image);

    const proof={
      schema_version:"geox_mcft_cap09_formal_v5_twin_cutover_result_v1",
      status:"PASS",
      arm_runtime_semantic_subject_sha:armSubject,
      authority_continuity_head_sha:head,
      image_tag:imageTag,
      authorized_image_id:inspectedImage,
      o00,
      o23,
      cutover_database_now:databaseNow,
      preformal_twin_container_id:preformalTwin[0].id,
      preformal_twin_stopped:true,
      production_twin_live_owner_after_stop:0,
      formal_bootstrap_fencing_token:bootstrapFence.toString(),
      formal_twin_owner:String(formalOwner.lease_owner),
      formal_twin_fencing_token:String(formalOwner.fencing_token),
      formal_twin_fence_advanced:true,
      formal_exact_one_twin_owner:true,
      double_owner_window_observed:false,
      evidence_owner:String(evidenceAfter[0].lease_owner),
      evidence_fencing_token:String(evidenceAfter[0].fencing_token),
      evidence_owner_unchanged:true,
      formal_v5_active:true,
      o00_runtime_started:true,
      provider_request_count_from_cutover_runner:0,
      github_execution:false,
      mcft_cap09_completed:false,
    };
    write(out,proof);
    process.stdout.write(JSON.stringify(proof,null,2)+"\n");
  }catch(error){
    if(preformalStopped){
      process.stderr.write("FORMAL_V5_TWIN_CUTOVER_PREFORMAL_STOPPED_NO_AUTOMATIC_RESTART\n");
    }
    throw error;
  }finally{
    await Promise.allSettled([twinPool.end(),evidencePool.end(),formalPool.end()]);
  }
}

main().catch(error=>{
  process.stderr.write((error instanceof Error?error.stack||error.message:String(error))+"\n");
  process.exitCode=1;
});
