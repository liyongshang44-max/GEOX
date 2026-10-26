#!/usr/bin/env node
"use strict";
// Offline, explicitly acknowledged CE94 scope-only attestation; never Permit.
// Usage:
//   node SIGN_...V2.cjs build ORIGINAL_JSON READONLY_JSON SOURCE_ROOT NEW_EVIDENCE_JSON
//   node SIGN_...V2.cjs review ORIGINAL_JSON READONLY_JSON SOURCE_ROOT EVIDENCE_JSON TRUST_JSON PRIVATE_ED25519_PEM REVIEWER_ID KEY_ID NEW_SIGNATURE_JSON
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const crypto=require("node:crypto"),readline=require("node:readline/promises");
const v2=require("./MCFT_CAP09_REAL_STAGE3_PHYSICAL_EVIDENCE_V2.cjs");
function writeNew(file,obj){
  assert(path.isAbsolute(file)&&!fs.existsSync(file),"V2_REVIEW_OUTPUT_NEW_ABSOLUTE_FILE_REQUIRED");
  const fd=fs.openSync(file,"wx",0o600);
  try{fs.writeFileSync(fd,JSON.stringify(obj,null,2)+"\n");fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
async function main(args){
  assert(!process.env.CI&&!process.env.GITHUB_ACTIONS,"V2_OFFLINE_OPERATOR_ONLY");
  for(const name of ["MCFT_GOVERNED_RETRY_STAGE","MCFT_GOVERNED_RETRY_TICKET","MCFT_GOVERNED_RETRY_BUNDLE","MCFT_CAP09_ADOPTION_REQUEST","MCFT_CAP09_FORMAL_RAW_BUCKET","GEOX_MCFT_CAP09_FORMAL_V5_DATABASE_URL"])
    assert(!process.env[name],"V2_INHERITED_FORMAL_ENV_FORBIDDEN:"+name);
  const [mode,originalFile,readonlyFile,sourceRoot,...rest]=args;
  assert(["build","review"].includes(mode),"V2_BUILD_OR_REVIEW_ONLY");
  assert([originalFile,readonlyFile,sourceRoot].every(x=>typeof x==="string"&&path.isAbsolute(x)),"V2_INPUT_ABSOLUTE_REQUIRED");
  if(mode==="build"){
    assert.equal(rest.length,1,"V2_BUILD_ARGUMENTS_REQUIRED");
    const evidence=v2.build({originalFile,readonlyFile,sourceRoot});
    writeNew(rest[0],evidence);
    console.log(JSON.stringify({status:"PASS_CE94_EVIDENCE_BUILT_REVIEW_ONLY",evidence_sha256:v2.sha(fs.readFileSync(rest[0])),permit:false,host_admission:false}));
    return;
  }
  assert.equal(rest.length,6,"V2_REVIEW_ARGUMENTS_REQUIRED");
  const [evidenceFile,trustFile,privateKeyFile,reviewerId,keyId,signatureFile]=rest;
  assert([evidenceFile,trustFile,privateKeyFile,signatureFile].every(x=>path.isAbsolute(x)),"V2_REVIEW_ABSOLUTE_PATHS_REQUIRED");
  const checked=v2.verifyEvidence({evidenceFile,originalFile,readonlyFile,sourceRoot});
  const trust=JSON.parse(fs.readFileSync(trustFile,"utf8"));
  const list=Array.isArray(trust.reviewers)?trust.reviewers.filter(x=>x.reviewer_id===reviewerId&&x.key_id===keyId&&x.role==="CE94_EVIDENCE_REVIEW_ONLY"&&x.revoked===false):[];
  assert.equal(list.length,1,"V2_LOCAL_REVIEW_ONLY_KEY_NOT_REGISTERED");
  const key=crypto.createPrivateKey(fs.readFileSync(privateKeyFile));
  assert.equal(key.asymmetricKeyType,"ed25519");
  assert.equal(v2.sha(crypto.createPublicKey(key).export({format:"der",type:"spki"})),list[0].spki_sha256,"V2_REVIEW_SIGNING_KEY_MISMATCH");
  const io=readline.createInterface({input:process.stdin,output:process.stdout});
  const challenge="SIGN_CE94_OBSERVED_SCOPE_ONLY_UNKNOWN_REMAINS_UNKNOWN_NOT_PERMIT";
  let approved;
  try{approved=await io.question("CE94 is NOT original Producer/Timing, NOT Host/Permit. Type "+challenge+": ");}
  finally{io.close();}
  assert.equal(approved,challenge,"V2_REVIEW_NOT_APPROVED");
  const payload={schema_version:"geox_mcft_cap09_real_stage3_review_attestation_v2",
    reviewer_id:reviewerId,key_id:keyId,role:"CE94_EVIDENCE_REVIEW_ONLY",
    reviewed_run_id:v2.PROFILE.run_id,reviewed_subject_sha:v2.PROFILE.source_sha,
    evidence_sha256:checked.evidence_sha256,signed_at:new Date().toISOString(),
    scope:"CE94_PHYSICAL_OBSERVATIONS_ONLY_NOT_HOST_ADMISSION",
    permit_signed:false,execution_authorized:false,production_authorized:false};
  const signed={payload,signature_base64:crypto.sign(null,Buffer.from(v2.DOMAIN+v2.canon(payload)),key).toString("base64")};
  // Check in memory before writing. Fail closed on identity, clock, signature.
  const at=Date.parse(payload.signed_at),info=list[0];
  assert(Date.parse(info.not_before)<=at && at<=Date.parse(info.not_after),"V2_REVIEW_SIGNING_KEY_EXPIRED");
  assert(crypto.verify(null,Buffer.from(v2.DOMAIN+v2.canon(payload)),crypto.createPublicKey(info.public_key_pem),Buffer.from(signed.signature_base64,"base64")),"V2_REVIEW_IN_MEMORY_SIGNATURE_INVALID");
  writeNew(signatureFile,signed);
  const result=v2.verifyReview({attestationFile:signatureFile,evidenceFile,originalFile,readonlyFile,sourceRoot,trust});
  console.log(JSON.stringify(result));
}
main(process.argv.slice(2)).catch(e=>{console.error("CE94_V2_REVIEW_HOLD:"+String(e.message||e).slice(0,260));process.exitCode=1;});
