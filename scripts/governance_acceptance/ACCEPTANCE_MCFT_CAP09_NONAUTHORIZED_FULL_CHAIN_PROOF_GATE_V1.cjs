"use strict";
// Pure non-authorizing signature/proof-gate tests. Fictitious fixtures only;
// no Provider, DB, S3, Permit, or external signer operations.
const assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const gate=require("./MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs");
const permit=require("../runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs");
const ROOT=path.resolve(__dirname,"../..");
const SUBJECT="f".repeat(40),RUN="abcdef012345",ATTEMPT="da9db7129607";
const now=Date.parse("2026-10-24T10:00:00.000Z");
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"cap09-physical-gate-"));
let checks=0;
function once(file,object){fs.writeFileSync(file,JSON.stringify(object,null,2)+"\n",{flag:"wx"});return permit.sha(fs.readFileSync(file));}
function reject(fn,re){
 let failed=false;try{fn();}catch(e){failed=true;assert.match(String(e.message),re);}assert(failed,"UNEXPECTED_PROOF_GATE_ACCEPT");
 checks++;
}
try{
 const kp=crypto.generateKeyPairSync("ed25519");
 const publicKey=kp.publicKey.export({type:"spki",format:"pem"}),issuer={
  issuer_id:"e2e_fictional_reviewer",key_id:"ephemeral_test_key",
  revoked:false,role:"ACCOUNTABLE_SINGLE_OPERATOR",
  not_before:"2026-10-23T00:00:00.000Z",not_after:"2026-10-25T00:00:00.000Z",
  public_key_pem:publicKey,spki_sha256:permit.sha(kp.publicKey.export({type:"spki",format:"der"})),
 };
 const trust={issuers:[issuer]};
 const sources=Object.fromEntries(gate.SOURCE_PATHS.map(p=>[p,permit.sha(fs.readFileSync(path.join(ROOT,p)))]));
 const original={
  schema_version:"geox_mcft_cap09_isolated_non_authorized_full_chain_contract_v1",
  status:"PASS",subject_sha:SUBJECT,test_run_id:RUN,
  authorization:"NON_AUTHORIZED_ISOLATED_ENGINEERING_TEST_ONLY",
  isolated_s3_bucket:"mcft-cap09-requal-"+RUN,
  pg_database:"mcft_cap09_requal_"+RUN+"_positive",
  source_files_sha256:sources,
  evidence_login_restricted:true,evidence_direct_fact_insert_allowed:false,
  evidence_fenced_writer_execute_allowed:true,
  real_postgres_fenced_promotion:true,real_postgres_formal_fact_present_count:3,
  private_raw_retention_real_s3_verified:true,candidate_manifest_private_readback:true,
  exact_three_facts_single_fenced_transaction:true,post_commit_physical_readback_verified:true,
  controller_attestation_after_promotion:true,cursor_advanced_only_after_attestation:true,
  capture_raw_object_count:2,candidate_semantic_record_count:3,promotion_provider_refetch_count:0,
  permit_signed:false,permit_consumed:false,production_authorized:false,
  production_owner_activation:false,formal_v5_armed:false,o00_started:false,stage_count:0,
 };
 function signReceipt(value,time=now){
  const receiptFile=path.join(tmp,"receipt-"+crypto.randomBytes(4).toString("hex")+".json");
  const receipt_sha256=once(receiptFile,value);
  const payload={
   schema_version:"geox_mcft_cap09_non_authorized_full_chain_attestation_v1",
   issuer_id:issuer.issuer_id,key_id:issuer.key_id,
   subject_sha:SUBJECT,test_run_id:value.test_run_id,
   receipt_file:receiptFile,receipt_sha256,signed_at:new Date(time).toISOString(),
   non_authorized:true,production_authorized:false,
  };
  const signature_base64=crypto.sign(null,Buffer.from(gate.DOMAIN+permit.canonical(payload)),kp.privateKey).toString("base64");
  const attestationFile=path.join(tmp,"attestation-"+crypto.randomBytes(4).toString("hex")+".json");
  const attestation_sha256=once(attestationFile,{payload,signature_base64});
  return {attestation_file:attestationFile,attestation_sha256};
 }
 const binding=signReceipt(original);
 const options={binding,trust,subjectSha:SUBJECT,attemptRunId:ATTEMPT,sourceRoot:ROOT,now};
 const valid=gate.verify(options);
 assert.equal(valid.status,"FULL_CHAIN_PHYSICAL_INTEGRATION_SIGNED_REVIEW_VERIFIED_NOT_PERMIT_AUTHORITY");
 assert.equal(valid.execution_authorized,false);checks++;
 reject(()=>gate.verify({...options,binding:null}),/SIGNED_NONAUTHORIZED_EVIDENCE_REQUIRED/);
 reject(()=>gate.verify({...options,subjectSha:"e".repeat(40)}),/SUBJECT_CHANGED/);
 reject(()=>gate.verify({...options,attemptRunId:RUN}),/TEST_MUST_NOT_REUSE_EXECUTION/);
 reject(()=>gate.verify({...options,now:now+8*86400000}),/OUTSIDE_REVIEW_WINDOW/);
 reject(()=>gate.verify({...options,trust:{issuers:[]}}),/AUTHORIZED_REVIEWER_REQUIRED/);
 reject(()=>gate.verify({...options,binding:{...binding,attestation_sha256:"0".repeat(64)}}),/ATTESTATION_BYTES_CHANGED/);
 const badRef=signReceipt({...original,isolated_s3_bucket:"geox-mcft-cap09-formal-raw-v1"});
 reject(()=>gate.verify({...options,binding:badRef}),/FULL_CHAIN_PHYSICAL_TEST_NOT_PASS|^Expected values to be strictly equal/);
 for(const [name,fields,pattern] of [
  ["uncommitted",{real_postgres_formal_fact_present_count:0},/EXACT_THREE_FORMAL_FACTS_REQUIRED/],
  ["no_readback",{post_commit_physical_readback_verified:false},/PHYSICAL_GAP/],
  ["no_storage",{private_raw_retention_real_s3_verified:false},/PHYSICAL_GAP/],
  ["unsafe_acl",{evidence_direct_fact_insert_allowed:true},/DIRECT_FACT_INSERT_FORBIDDEN/],
  ["fake_permit",{permit_consumed:true},/FORBIDDEN_AUTHORITY/],
  ["wrong_source",{source_files_sha256:{...sources,[gate.SOURCE_PATHS[0]]:"0".repeat(64)}},/TESTED_SOURCE_CHANGED/],
 ]){const forged=signReceipt({...original,...fields});reject(()=>gate.verify({...options,binding:forged}),pattern);}
 const modified=JSON.parse(fs.readFileSync(binding.attestation_file,"utf8"));
 modified.payload.subject_sha="a".repeat(40);
 const forgePath=path.join(tmp,"forged.json"),forgeSha=once(forgePath,modified);
 reject(()=>gate.verify({...options,binding:{attestation_file:forgePath,attestation_sha256:forgeSha}}),/SUBJECT_CHANGED/);
 console.log(JSON.stringify({status:"PASS",checks,real_s3:false,real_pg:false,
  uses_fictional_ephemeral_key:true,no_permit:true,execution_authorized:false}));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
