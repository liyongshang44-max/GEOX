#!/usr/bin/env node
"use strict";

const cp=require("node:child_process");
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"../..");
const REGISTRY="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EFFECTIVE-CURRENT-CROP-AUTHORITY-REGISTRY-V1.json";
const AUTHORITY_PREFIX="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY";
const DEFAULT_OUT=path.join(require("node:os").homedir(),".geox","mcft-cap09","formal-v5","post-arm-authority-continuity-v1.json");

function fail(code,detail){throw new Error(detail===undefined?code:code+":"+String(detail));}
function req(ok,code,detail){if(!ok)fail(code,detail);}
function git(...args){return cp.execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();}
function arg(name){const row=process.argv.slice(2).find(v=>v.startsWith(name+"="));return row?row.slice(name.length+1):null;}
function has(name){return process.argv.includes(name);}
function sha(value,code){const v=String(value||"").trim();req(/^[0-9a-f]{40}$/.test(v),code,v);return v;}
function iso(value,code){const v=String(value||"").trim(),t=Date.parse(v);req(Number.isFinite(t)&&new Date(t).toISOString()===v,code,v);return v;}
function digest(bytes){return "sha256:"+crypto.createHash("sha256").update(bytes).digest("hex");}
function jsonAt(ref,rel){return JSON.parse(git("show",ref+":"+rel));}
function bytesAt(ref,rel){return Buffer.from(git("show",ref+":"+rel)+"\n","utf8");}
function showText(ref,rel){return git("show",ref+":"+rel);}
function stable(v){return JSON.stringify(v);}
function authorityPath(rel){return rel.startsWith(AUTHORITY_PREFIX+"-")&&rel.endsWith(".json")&&!rel.includes("CANDIDATE");}
function falseCeilings(value,prefix){
  for(const key of [
    "runtime_config_write_authorized","database_write_authorized","scheduler_write_authorized",
    "formal_evidence_write_authorized","production_runtime_start_authorized",
    "production_owner_activation_authorized","formal_v5_authorized","a0_authorized",
    "o00_o23_authorized","mcft_cap09_completed",
  ]) req(value?.[key]===false,prefix+":"+key);
}
function validateRegistry(registry,code){
  req(registry?.schema_version==="geox_mcft_cap09_effective_current_crop_authority_registry_v1",code+"_SCHEMA");
  req(registry?.status==="ACTIVE",code+"_STATUS");
  req(registry?.selection_policy==="LATEST_EFFECTIVE_AUTHORITY_AS_OF_NOT_AFTER_LOGICAL_TIME_WITHIN_VALIDITY_WINDOW",code+"_SELECTION_POLICY");
  req(registry?.candidate_artifacts_admissible===false,code+"_CANDIDATE_ADMISSIBILITY");
  req(Array.isArray(registry?.entries),code+"_ENTRIES");
  for(const [key,value] of Object.entries(registry?.non_effects||{}))req(value===false,code+"_NON_EFFECT:"+key);
  let prior=-Infinity;
  for(const entry of registry.entries){
    req(authorityPath(String(entry?.authority_ref||"")),code+"_AUTHORITY_REF",entry?.authority_ref);
    req(/^sha256:[0-9a-f]{64}$/.test(String(entry?.authority_sha256||"")),code+"_AUTHORITY_DIGEST");
    const a=Date.parse(entry.authority_as_of),u=Date.parse(entry.authority_valid_until);
    req(Number.isFinite(a)&&Number.isFinite(u)&&a<u,code+"_AUTHORITY_WINDOW",entry.authority_ref);
    req(a>prior,code+"_AUTHORITY_ORDER",entry.authority_ref);
    prior=a;
  }
}
function validateAuthority(authority,ref){
  req(authority?.schema_version==="geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1","FORMAL_V5_CONTINUITY_AUTHORITY_SCHEMA",ref);
  req(authority?.status==="PASS"&&authority?.qualification_outcome==="CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED","FORMAL_V5_CONTINUITY_AUTHORITY_NOT_PASS",ref);
  req(authority?.architecture_effective===true&&authority?.runtime_consumption_authorized===true,"FORMAL_V5_CONTINUITY_AUTHORITY_NOT_RUNTIME_EFFECTIVE",ref);
  const life=authority.lifecycle||{};
  req(life.domain_state==="ACTIVE"&&life.authority_status==="RESOLVED"&&life.authority_validity==="VALID"&&life.authority_mode==="GOVERNED_PERSISTENT_STATE"&&life.active_consumable_candidate===true,"FORMAL_V5_CONTINUITY_AUTHORITY_LIFECYCLE_INVALID",ref);
  req(authority?.biological_stage?.observed_biological_stage_claimed===false,"FORMAL_V5_CONTINUITY_OBSERVED_STAGE_OVERCLAIM",ref);
  req(authority?.crop_model_parameter?.production_effective===false,"FORMAL_V5_CONTINUITY_CROP_PARAMETER_EFFECT_DRIFT",ref);
  req(authority?.graduation?.status==="EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH"||authority?.graduation?.status==="EFFECTIVE_FOR_RUNTIME_CONSUMPTION","FORMAL_V5_CONTINUITY_GRADUATION_INVALID",ref);
  falseCeilings(authority,"FORMAL_V5_CONTINUITY_AUTHORITY_CEILING");
  req(authority?.refresh?.running_preformal_mount_replaced!==true,"FORMAL_V5_CONTINUITY_RUNNING_MOUNT_REPLACEMENT_FORBIDDEN",ref);
  req(authority?.refresh?.production_runtime_restarted!==true,"FORMAL_V5_CONTINUITY_PRODUCTION_RESTART_FORBIDDEN",ref);
}
function parseDiff(parent,commit){
  const raw=git("diff","--name-status",parent,commit);
  if(!raw)return [];
  return raw.split(/\r?\n/).filter(Boolean).map(line=>{
    const parts=line.split("\t");
    return {status:parts[0],path:parts.at(-1)};
  });
}
function validateCommit(parent,commit){
  const changes=parseDiff(parent,commit);
  req(changes.length>=1&&changes.length<=2,"FORMAL_V5_CONTINUITY_COMMIT_FILE_COUNT",commit+":"+changes.length);
  const authorityAdds=changes.filter(x=>x.status==="A"&&authorityPath(x.path));
  const registryMods=changes.filter(x=>x.status==="M"&&x.path===REGISTRY);
  req(authorityAdds.length+registryMods.length===changes.length,"FORMAL_V5_CONTINUITY_NON_AUTHORITY_CHANGE",commit+":"+changes.map(x=>x.status+":"+x.path).join(","));
  req(authorityAdds.length<=1&&registryMods.length<=1,"FORMAL_V5_CONTINUITY_CHANGE_CARDINALITY",commit);

  if(authorityAdds.length===1){
    const rel=authorityAdds[0].path;
    const authority=JSON.parse(showText(commit,rel));
    validateAuthority(authority,rel);
  }
  if(registryMods.length===1){
    const before=jsonAt(parent,REGISTRY),after=jsonAt(commit,REGISTRY);
    validateRegistry(before,"FORMAL_V5_CONTINUITY_BASE_REGISTRY");
    validateRegistry(after,"FORMAL_V5_CONTINUITY_HEAD_REGISTRY");
    req(after.entries.length===before.entries.length+1,"FORMAL_V5_CONTINUITY_REGISTRY_EXACT_SINGLE_APPEND",commit);
    req(stable(after.entries.slice(0,-1))===stable(before.entries),"FORMAL_V5_CONTINUITY_REGISTRY_HISTORY_REWRITE",commit);
    const latest=after.entries.at(-1);
    const authorityText=showText(commit,latest.authority_ref);
    const authorityBytes=Buffer.from(authorityText+"\n","utf8");
    req(digest(authorityBytes)===latest.authority_sha256,"FORMAL_V5_CONTINUITY_REGISTRY_DIGEST_MISMATCH",latest.authority_ref);
    const authority=JSON.parse(authorityText);
    validateAuthority(authority,latest.authority_ref);
    req(authority.biological_stage?.authority_as_of===latest.authority_as_of,"FORMAL_V5_CONTINUITY_REGISTRY_AS_OF_MISMATCH");
    req(authority.biological_stage?.authority_valid_until===latest.authority_valid_until,"FORMAL_V5_CONTINUITY_REGISTRY_VALID_UNTIL_MISMATCH");
    req(authority.graduation?.status===latest.graduation_status,"FORMAL_V5_CONTINUITY_REGISTRY_GRADUATION_MISMATCH");
    const previous=before.entries.at(-1);
    if(previous){
      req(authority.graduation?.previous_effective_current_crop_authority_sha256===previous.authority_sha256,"FORMAL_V5_CONTINUITY_PREVIOUS_AUTHORITY_LINK_MISMATCH");
    }
  }
  return {commit,parent,changes};
}
function selectAt(registry,logicalTime){
  const t=Date.parse(iso(logicalTime,"FORMAL_V5_CONTINUITY_LOGICAL_TIME_INVALID"));
  const eligible=registry.entries.filter(row=>{
    const a=Date.parse(row.authority_as_of),u=Date.parse(row.authority_valid_until);
    return a<=t&&t<=u;
  }).sort((a,b)=>Date.parse(b.authority_as_of)-Date.parse(a.authority_as_of));
  req(eligible.length>0,"FORMAL_V5_CONTINUITY_NO_AUTHORITY_AT_LOGICAL_TIME",logicalTime);
  return eligible[0];
}
function selftest(){
  const prefix=AUTHORITY_PREFIX+"-2099-01-01T00Z-V1.json";
  const allowed1=[{status:"A",path:prefix}],allowed2=[{status:"M",path:REGISTRY}],bad=[{status:"M",path:"apps/server/src/runtime/evil.ts"}];
  req(allowed1.every(x=>(x.status==="A"&&authorityPath(x.path))||(x.status==="M"&&x.path===REGISTRY)),"SELFTEST_AUTHORITY_ADD");
  req(allowed2.every(x=>(x.status==="A"&&authorityPath(x.path))||(x.status==="M"&&x.path===REGISTRY)),"SELFTEST_REGISTRY_MOD");
  req(!bad.every(x=>(x.status==="A"&&authorityPath(x.path))||(x.status==="M"&&x.path===REGISTRY)),"SELFTEST_RUNTIME_DRIFT_REJECT");
  process.stdout.write(JSON.stringify({
    schema_version:"geox_mcft_cap09_formal_v5_post_arm_authority_continuity_selftest_v1",
    status:"PASS",
    authority_add_allowed:true,registry_append_allowed:true,runtime_change_rejected:true,
    formal_v5_arm:false,a0_authorized:false,database_write_count:0,
  },null,2)+"\n");
}
function main(){
  if(has("--selftest"))return selftest();
  const arm=sha(arg("--arm-subject"),"FORMAL_V5_CONTINUITY_ARM_SUBJECT_REQUIRED");
  const logical=iso(arg("--logical-time"),"FORMAL_V5_CONTINUITY_LOGICAL_TIME_REQUIRED");
  const out=path.resolve(arg("--out")||DEFAULT_OUT);
  git("fetch","--no-tags","origin","main");
  const head=git("rev-parse","HEAD"),origin=git("rev-parse","origin/main");
  req(head===origin,"FORMAL_V5_CONTINUITY_HEAD_NOT_CURRENT_MAIN",head+":"+origin);
  req(git("status","--porcelain")==="","FORMAL_V5_CONTINUITY_WORKTREE_MUST_BE_CLEAN");
  try{cp.execFileSync("git",["merge-base","--is-ancestor",arm,head],{cwd:ROOT,stdio:"ignore"});}catch{fail("FORMAL_V5_CONTINUITY_ARM_NOT_ANCESTOR",arm+"->"+head);}
  const commits=head===arm?[]:git("rev-list","--reverse","--first-parent",arm+".."+head).split(/\r?\n/).filter(Boolean);
  const audited=[];
  for(const commit of commits){
    const parent=git("rev-parse",commit+"^1");
    audited.push(validateCommit(parent,commit));
  }
  const registry=jsonAt(head,REGISTRY);
  validateRegistry(registry,"FORMAL_V5_CONTINUITY_FINAL_REGISTRY");
  const selected=selectAt(registry,logical);
  const authorityText=showText(head,selected.authority_ref);
  req(digest(Buffer.from(authorityText+"\n","utf8"))===selected.authority_sha256,"FORMAL_V5_CONTINUITY_SELECTED_DIGEST_MISMATCH");
  validateAuthority(JSON.parse(authorityText),selected.authority_ref);

  const result={
    schema_version:"geox_mcft_cap09_formal_v5_post_arm_authority_continuity_v1",
    status:"PASS",
    arm_runtime_semantic_subject_sha:arm,
    authority_continuity_head_sha:head,
    arm_subject_is_first_parent_ancestor:true,
    post_arm_first_parent_commit_count:audited.length,
    post_arm_commits:audited,
    allowed_change_surface:[
      AUTHORITY_PREFIX+"-*.json",
      REGISTRY,
    ],
    runtime_code_change_count:0,
    qcp_change_count:0,
    workflow_change_count:0,
    selected_logical_time:logical,
    selected_current_crop_authority_ref:selected.authority_ref,
    selected_current_crop_authority_sha256:selected.authority_sha256,
    selected_authority_as_of:selected.authority_as_of,
    selected_authority_valid_until:selected.authority_valid_until,
    formal_v5_arm_preserved:true,
    a0_authorized:false,
    formal_database_mutation:false,
    provider_request_count:0,
    mcft_cap09_completed:false,
  };
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(result,null,2)+"\n");
  process.stdout.write(JSON.stringify(result,null,2)+"\n");
}
try{main();}catch(error){console.error(error instanceof Error?error.stack||error.message:String(error));process.exitCode=1;}
