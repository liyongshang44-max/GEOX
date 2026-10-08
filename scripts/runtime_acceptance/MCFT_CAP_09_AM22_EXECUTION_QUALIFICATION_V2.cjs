"use strict";
const crypto=require("node:crypto"),fs=require("node:fs");
const {canonical,LEGACY}=require("./MCFT_CAP_09_FORMAL_ARM_RETIREMENT_GUARD_V1.cjs");
const KEYS=Object.freeze(["qualified_subject_sha","qualified_host_id","qualified_image_id","qualified_envelope_sha256","approved_current_crop_authority_sha256"]);
const req=(ok,code)=>{if(!ok)throw new Error("AM22_EXECUTION_QUALIFICATION_"+code);};
function verifyExecutionQualification(root,certificate,now){
 req(root.execution_qualification_rule==="DETACHED_ED25519_EXACT_MAIN_HOST_IMAGE_EVIDENCE_V2","DETACHED_TRUST_RULE_REQUIRED");
 req(typeof root.execution_qualification_signing_public_key_pem==="string","GOVERNED_PUBLIC_KEY_REQUIRED");
 const {signature_base64,...body}=certificate||{};
 req(body.schema_version==="geox_mcft_cap09_am22_detached_execution_qualification_v2"&&body.status==="PASS"&&body.synthetic===false,"CERTIFICATE_SCHEMA_REQUIRED");
 let valid=false;
 try{const key=crypto.createPublicKey(root.execution_qualification_signing_public_key_pem);req(key.asymmetricKeyType==="ed25519","ED25519_KEY_REQUIRED");valid=crypto.verify(null,Buffer.from(canonical(body)),key,Buffer.from(signature_base64||"","base64"));}catch{throw new Error("AM22_EXECUTION_QUALIFICATION_SIGNATURE_INVALID");}
 req(valid,"SIGNATURE_INVALID");
 req(Date.parse(body.issued_at_database_utc)<=Date.parse(now)&&Date.parse(body.expires_at_database_utc)>Date.parse(now),"CERTIFICATE_FUTURE_OR_EXPIRED");
 req(body.complete_pre_a0_measurement_qualified===true&&body.new_handoff_arm_a0_chain_qualified===true,"COMPLETE_HOST_AND_CHAIN_QUALIFICATION_REQUIRED");
 req(/^[a-f0-9]{40}$/.test(body.qualified_subject_sha||"")&&body.qualified_host_id===LEGACY.host&&/^sha256:[a-f0-9]{64}$/.test(body.qualified_image_id||""),"EXECUTION_BINDING_REQUIRED");
 for(const key of ["qualified_envelope_sha256","approved_current_crop_authority_sha256"])req(/^sha256:[a-f0-9]{64}$/.test(body[key]||""),"EVIDENCE_DIGEST_REQUIRED");
 // Signed evidence binds an already-existing clean main/image; it never changes
 // root production flags or authorizes completion. This avoids a commit/image
 // hash self-reference in the checked-in policy.
 return {...root,...Object.fromEntries(KEYS.map(key=>[key,body[key]]))};
}
function loadExecutionQualification(root,input,now){
 req(typeof input.execution_qualification_file==="string","CERTIFICATE_FILE_REQUIRED");
 return verifyExecutionQualification(root,JSON.parse(fs.readFileSync(input.execution_qualification_file,"utf8")),now);
}
module.exports={KEYS,verifyExecutionQualification,loadExecutionQualification};
