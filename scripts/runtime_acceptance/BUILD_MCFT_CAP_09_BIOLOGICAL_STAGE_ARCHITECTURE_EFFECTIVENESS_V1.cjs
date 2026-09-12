#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const cp=require("node:child_process");
const path=require("node:path");

const AUTHORITY_PATH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-EFFECTIVENESS-GRADUATION-V1.json";

function fail(code,detail){throw new Error(detail?code+":"+detail:code)}
function git(...args){return cp.execFileSync("git",args,{encoding:"utf8"}).trim()}
function canonicalIso(value,code){
  const text=String(value??"").trim();
  const t=Date.parse(text);
  if(!Number.isFinite(t)||new Date(t).toISOString()!==text)fail(code,text);
  return text;
}
function exactSha(value,code){
  const text=String(value??"").trim();
  if(!/^[0-9a-f]{40}$/.test(text))fail(code,text);
  return text;
}
function arg(name){
  const i=process.argv.indexOf(name);
  return i>=0?process.argv[i+1]:undefined;
}
function buildCertificate(input){
  return {
    schema_version:"geox_dt02_biological_stage_authority_effectiveness_v1",
    amendment_id:"DT02-AMENDMENT-03",
    status:"EFFECTIVE",
    effective:true,
    protected_main_sha:exactSha(input.protected_main_sha,"BIO_STAGE_EFFECT_PROTECTED_MAIN_SHA_INVALID"),
    amendment_path:input.amendment_path,
    amendment_blob_sha:input.amendment_blob_sha,
    decision_register_path:input.decision_register_path,
    decision_register_blob_sha:input.decision_register_blob_sha,
    graduation_authority_ref:AUTHORITY_PATH,
    graduation_authority_blob_sha:input.graduation_authority_blob_sha,
    issued_at:canonicalIso(input.issued_at,"BIO_STAGE_EFFECT_ISSUED_AT_INVALID"),
    authority_ceiling:"DT02_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_ONLY",
    runtime_start_authorized:false,
    production_owner_activation_authorized:false,
    formal_v5_authorized:false,
    a0_authorized:false,
    o00_o23_authorized:false
  };
}
function selftest(){
  const out=buildCertificate({
    protected_main_sha:"1".repeat(40),
    amendment_path:"docs/amendment.md",
    amendment_blob_sha:"2".repeat(40),
    decision_register_path:"docs/register.json",
    decision_register_blob_sha:"3".repeat(40),
    graduation_authority_blob_sha:"4".repeat(40),
    issued_at:"2026-09-03T05:00:00.000Z"
  });
  if(out.status!=="EFFECTIVE"||out.effective!==true||out.runtime_start_authorized!==false){
    fail("BIO_STAGE_EFFECT_SELFTEST_FAILED");
  }
  console.log(JSON.stringify({status:"PASS",selftest:true}));
}
function issue(){
  const protectedMain=exactSha(arg("--protected-main-sha"),"BIO_STAGE_EFFECT_PROTECTED_MAIN_SHA_REQUIRED");
  const issuedAt=canonicalIso(arg("--issued-at"),"BIO_STAGE_EFFECT_ISSUED_AT_REQUIRED");
  const outPath=String(arg("--out")??"").trim();
  if(!outPath)fail("BIO_STAGE_EFFECT_OUTPUT_REQUIRED");

  const remoteMain=exactSha(git("rev-parse","origin/main"),"BIO_STAGE_EFFECT_ORIGIN_MAIN_INVALID");
  if(remoteMain!==protectedMain){
    fail("BIO_STAGE_EFFECT_PROTECTED_MAIN_NOT_CURRENT",`expected=${protectedMain} actual=${remoteMain}`);
  }
  const authority=JSON.parse(fs.readFileSync(AUTHORITY_PATH,"utf8"));
  if(authority.record_status!=="CANDIDATE_NOT_EFFECTIVE_UNTIL_EXACT_HEAD_PROOF_AND_PROTECTED_MAIN_MERGE"){
    fail("BIO_STAGE_EFFECT_GRADUATION_STATUS_INVALID");
  }
  const a=authority.architecture_candidate;

  let graduationBlob;
  try{
    graduationBlob=git("rev-parse",`${protectedMain}:${AUTHORITY_PATH}`);
  }catch{
    fail("BIO_STAGE_EFFECT_GRADUATION_AUTHORITY_NOT_PRESENT_ON_PROTECTED_MAIN");
  }
  const workingGraduationBlob=git("hash-object",AUTHORITY_PATH);
  if(graduationBlob!==workingGraduationBlob){
    fail("BIO_STAGE_EFFECT_GRADUATION_AUTHORITY_BLOB_MISMATCH");
  }

  let amendmentBlob;
  try{
    amendmentBlob=git("rev-parse",`${protectedMain}:${a.amendment_path}`);
  }catch{
    fail("BIO_STAGE_EFFECT_AMENDMENT03_NOT_PRESENT_ON_PROTECTED_MAIN");
  }
  if(amendmentBlob!==a.amendment_blob_sha){
    fail("BIO_STAGE_EFFECT_AMENDMENT03_BLOB_MISMATCH",`expected=${a.amendment_blob_sha} actual=${amendmentBlob}`);
  }

  let registerBlob;
  try{
    registerBlob=git("rev-parse",`${protectedMain}:${a.decision_register_path}`);
  }catch{
    fail("BIO_STAGE_EFFECT_DECISION_REGISTER_NOT_PRESENT_ON_PROTECTED_MAIN");
  }
  if(registerBlob!==a.decision_register_blob_sha){
    fail("BIO_STAGE_EFFECT_DECISION_REGISTER_BLOB_MISMATCH",`expected=${a.decision_register_blob_sha} actual=${registerBlob}`);
  }

  const register=JSON.parse(git("show",`${protectedMain}:${a.decision_register_path}`));
  const amendment=(register.amendments||[]).find(x=>x.id==="DT02-AMENDMENT-03");
  const adr=(register.decisions||[]).find(x=>x.id==="DT02-ADR-017");
  if(!amendment||amendment.path!==a.amendment_path)fail("BIO_STAGE_EFFECT_REGISTER_AMENDMENT03_REQUIRED");
  if(!adr||(adr.amendment_refs||[]).includes("DT02-AMENDMENT-03")!==true)fail("BIO_STAGE_EFFECT_REGISTER_ADR017_REQUIRED");

  const cert=buildCertificate({
    protected_main_sha:protectedMain,
    amendment_path:a.amendment_path,
    amendment_blob_sha:amendmentBlob,
    decision_register_path:a.decision_register_path,
    decision_register_blob_sha:registerBlob,
    graduation_authority_blob_sha:graduationBlob,
    issued_at:issuedAt
  });
  fs.mkdirSync(path.dirname(outPath),{recursive:true});
  fs.writeFileSync(outPath,JSON.stringify(cert,null,2)+"\n");
  console.log(JSON.stringify(cert));
}
try{
  if(process.argv.includes("--selftest"))selftest();
  else issue();
}catch(error){
  console.error(error instanceof Error?error.message:String(error));
  process.exit(1);
}
