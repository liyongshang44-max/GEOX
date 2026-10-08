"use strict";
const fs = require("node:fs");
const path = require("node:path");
const {measureEnvelope} = require("./MCFT_CAP_09_AM22_PREPARATION_ENVELOPE_V1.cjs");
const {selectClock} = require("./MCFT_CAP_09_AM22_EVIDENCE_CLOCK_V2.cjs");
const {LEGACY,validateReceipt,fileDigest,digest,assertArmNotRetired} = require("./MCFT_CAP_09_FORMAL_ARM_RETIREMENT_GUARD_V1.cjs");
const RECEIPT = "sha256:fcd39ed82ad8d471a4348b52451d12547a5d4d8a51e39b156e69567a67032167";
const required = (ok,code) => { if(!ok) throw new Error("AM22_CANDIDATE_"+code); };
function readBoundJson(file,expectedHash) {
  required(/^sha256:[a-f0-9]{64}$/.test(expectedHash||""),"PINNED_FILE_DIGEST_REQUIRED");
  required(fileDigest(file)===expectedHash,"FILE_DIGEST_MISMATCH");
  return JSON.parse(fs.readFileSync(file,"utf8"));
}
function verifyCandidateFiles(input) {
  // An envelope's own QUALIFIED label is insufficient: its bytes must be pinned
  // by the independently qualified, image-bound admission policy.
  const policy=input.policy;
  required(policy?.schema_version==="geox_mcft_cap09_am22_effective_start_authority_v2","POLICY_SCHEMA_INVALID");
  required(policy.complete_pre_a0_measurement_qualified===true,"COMPLETE_PREPARATION_NOT_QUALIFIED");
  const binding=input.binding;
  required(policy.qualified_subject_sha===binding.subject_sha && policy.qualified_host_id===binding.host_id && policy.qualified_image_id===binding.image_id,"QUALIFIED_EXECUTION_BINDING_MISMATCH");
  const receipt=validateReceipt(JSON.parse(fs.readFileSync(input.retirement_receipt_file,"utf8")));
  required(receipt.receipt_sha256===RECEIPT && policy.host_retirement_receipt_sha256===RECEIPT,"OBSERVED_RETIREMENT_RECEIPT_MISMATCH");
  required(fileDigest(input.original_arm_archive_file)===receipt.original_arm_file_sha256,"ORIGINAL_ARM_BYTES_NOT_PRESERVED");
  const oldArm=JSON.parse(fs.readFileSync(input.original_arm_archive_file,"utf8"));
  required(oldArm.arm_identity_hash===LEGACY.identity,"ORIGINAL_ARM_IDENTITY_MISMATCH");
  const envelope=readBoundJson(input.qualified_envelope_file,policy.qualified_envelope_sha256);
  const qualification=readBoundJson(input.independent_qualification_file,envelope.independent_qualification_sha256);
  required(qualification.schema_version==="geox_mcft_cap09_independent_complete_pre_a0_qualification_v1" && qualification.status==="PASS" && qualification.complete_workload_qualified===true && qualification.synthetic===false,"INDEPENDENT_COMPLETE_QUALIFICATION_REQUIRED");
  for(const key of ["subject_sha","host_id","image_id","preparation_profile_sha256"]) required(qualification[key]===binding[key],"INDEPENDENT_QUALIFICATION_BINDING_MISMATCH");
  required(qualification.measurement_trace_sha256===envelope.measurement_trace_sha256,"QUALIFICATION_TRACE_MISMATCH");
  const trace=readBoundJson(input.measurement_trace_file,envelope.measurement_trace_sha256);
  const measured=measureEnvelope(trace,{...binding,safety_margin_ms:envelope.safety_margin_ms});
  required(measured.observed_max_elapsed_ms===envelope.observed_max_elapsed_ms,"MEASURED_DURATION_MISMATCH");
  required(policy.approved_current_crop_authority_sha256===input.current_crop_authority_sha256,"QUALIFIED_STAGE_BYTES_REQUIRED");
  const stage=readBoundJson(input.current_crop_authority_file,input.current_crop_authority_sha256);
  const clock=selectClock({database_now_utc:input.database_now_utc,binding,preparation_envelope:envelope,current_crop_authority:stage});
  const identityBody={subject_sha:binding.subject_sha,host_id:binding.host_id,image_id:binding.image_id,clock,current_crop_authority_sha256:input.current_crop_authority_sha256,qualified_envelope_sha256:policy.qualified_envelope_sha256,retirement_receipt_sha256:RECEIPT};
  const candidate={schema_version:"geox_mcft_cap09_am22_formal_arm_candidate_v2",status:"CANDIDATE_NOT_ARMED",...identityBody,epoch_id:"mcft_cap09_am22_"+clock.o00.replace(/[^0-9]/g,"")+"_v2",arm_identity_hash:digest(identityBody),fresh_h5_required:true,fresh_schema_acl_required:true,fresh_causal_seed_required:true,fresh_prewrite_continuity_required:true,production_start_authorized:false,formal_v5_arm:false,a0_execution:false,o00_started:false,mcft_cap09_completed:false};
  assertArmNotRetired(candidate,input.retirement_directory);
  return candidate;
}
module.exports={RECEIPT,readBoundJson,verifyCandidateFiles};
if(require.main===module){
  try{
    required(!process.argv.includes("--execute"),"EXECUTION_NOT_IMPLEMENTED_OR_AUTHORIZED");
    const arg=process.argv.slice(2).find(x=>x.startsWith("--input="));
    required(Boolean(arg?.slice(8)),"INPUT_REQUIRED");
    const input=JSON.parse(fs.readFileSync(path.resolve(arg.slice(8)),"utf8"));
    // The CLI never accepts an operator-supplied effective policy.
    input.policy=JSON.parse(fs.readFileSync(path.join(__dirname,"../../docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-EFFECTIVE-START-AUTHORITY-V2.json"),"utf8"));
    console.log(JSON.stringify(verifyCandidateFiles(input),null,2));
  }catch(error){console.error(/^AM22_|^FORMAL_ARM_|^ARM_RETIREMENT_/.test(error.message)?error.message:"AM22_CANDIDATE_INPUT_READ_FAILED");process.exitCode=1;}
}
