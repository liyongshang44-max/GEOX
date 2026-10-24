#!/usr/bin/env node
"use strict";
// Offline, accountable reviewer attestation of a genuine external physical
// S3/PG receipt. Never creates a Permit or executes a stage. Refuses CI.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const crypto=require("node:crypto"),readline=require("node:readline/promises");
const permit=require("../runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs");
const gate=require("./MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs");
const ROOT=path.resolve(__dirname,"../..");
const trustPath=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json");
async function main(args){
 assert(process.platform==="win32"&&!process.env.CI&&!process.env.GITHUB_ACTIONS,"FULL_CHAIN_ATTESTATION_LOCAL_WINDOWS_OPERATOR_ONLY");
 assert.equal(args.length,6,"USAGE: node SIGN_...cjs RECEIPT_FILE PRIVATE_ED25519_PEM ISSUER_ID KEY_ID SUBJECT_SHA NEW_OUTPUT_FILE");
 const [receiptFile,privateKeyFile,issuerId,keyId,subjectSha,outputFile]=args;
 for(const file of [receiptFile,privateKeyFile,outputFile])assert(path.isAbsolute(file),"FULL_CHAIN_REVIEW_PATH_MUST_BE_ABSOLUTE");
 assert(!fs.existsSync(outputFile),"FULL_CHAIN_ATTESTATION_OUTPUT_MUST_BE_NEW");
 assert(/^[a-f0-9]{40}$/.test(subjectSha),"FULL_CHAIN_REVIEW_SUBJECT_INVALID");
 const receiptBytes=fs.readFileSync(receiptFile);
 const receipt=JSON.parse(receiptBytes.toString("utf8"));
 assert.equal(receipt.schema_version,"geox_mcft_cap09_isolated_non_authorized_full_chain_contract_v1");
 assert.equal(receipt.status,"PASS","FULL_CHAIN_PHYSICAL_RECEIPT_NOT_PASS");
 assert.equal(receipt.subject_sha,subjectSha,"FULL_CHAIN_SOURCE_SUBJECT_MISMATCH");
 assert.equal(receipt.authorization,"NON_AUTHORIZED_ISOLATED_ENGINEERING_TEST_ONLY");
 assert.equal(receipt.permit_signed,false);assert.equal(receipt.permit_consumed,false);
 assert.equal(receipt.production_authorized,false);assert.equal(receipt.stage_count,0);
 assert.equal(receipt.evidence_login_restricted,true);
 assert.equal(receipt.evidence_direct_fact_insert_allowed,false);
 assert.equal(receipt.evidence_fenced_writer_execute_allowed,true);
 assert.equal(receipt.real_postgres_fenced_promotion,true);
 assert.equal(receipt.real_postgres_formal_fact_present_count,3);
 assert.equal(receipt.private_raw_retention_real_s3_verified,true);
 assert.equal(receipt.candidate_manifest_private_readback,true);
 assert.equal(receipt.exact_three_facts_single_fenced_transaction,true);
 assert.equal(receipt.post_commit_physical_readback_verified,true);
 assert.equal(receipt.controller_attestation_after_promotion,true);
 assert.deepEqual(Object.keys(receipt.source_files_sha256).sort(),[...gate.SOURCE_PATHS].sort(),"FULL_CHAIN_SOURCE_SET_CHANGED");
 for(const file of gate.SOURCE_PATHS){
  const bytes=fs.readFileSync(path.join(ROOT,file));
  assert.equal(receipt.source_files_sha256[file],permit.sha(bytes),"FULL_CHAIN_REVIEW_SOURCE_MISMATCH:"+file);
 }
 const trust=JSON.parse(fs.readFileSync(trustPath,"utf8"));
 const issuer=trust.issuers.filter(x=>x.issuer_id===issuerId&&x.key_id===keyId&&!x.revoked);
 assert.equal(issuer.length,1,"FULL_CHAIN_REVIEW_REGISTERED_KEY_REQUIRED");
 assert(["ACCOUNTABLE_SINGLE_OPERATOR","INDEPENDENT_RETRY_GOVERNANCE"].includes(issuer[0].role));
 const key=crypto.createPrivateKey(fs.readFileSync(privateKeyFile));
 assert.equal(key.asymmetricKeyType,"ed25519");
 assert.equal(permit.sha(crypto.createPublicKey(key).export({type:"spki",format:"der"})),issuer[0].spki_sha256,"FULL_CHAIN_PRIVATE_KEY_FINGERPRINT_MISMATCH");
 const prompt=readline.createInterface({input:process.stdin,output:process.stdout});
 const approval="SIGN_NONAUTHORIZED_PHYSICAL_S3_PG_REVIEW_NOT_PERMIT";
 let actual;
 try{
  actual=await prompt.question(`Review full S3+PG physical receipt without permitting any execution; type ${approval}: `);
 }finally{prompt.close();}
 assert.equal(actual,approval,"FULL_CHAIN_REVIEWER_DECLINED_NO_SIGNATURE");
 const payload={
  schema_version:"geox_mcft_cap09_non_authorized_full_chain_attestation_v1",
  issuer_id:issuerId,key_id:keyId,subject_sha:subjectSha,
  test_run_id:receipt.test_run_id,
  receipt_file:receiptFile,receipt_sha256:permit.sha(receiptBytes),
  signed_at:new Date().toISOString(),non_authorized:true,production_authorized:false,
 };
 const signature_base64=crypto.sign(null,Buffer.from(gate.DOMAIN+permit.canonical(payload)),key).toString("base64");
 const bytes=Buffer.from(JSON.stringify({payload,signature_base64},null,2)+"\n");
 const fd=fs.openSync(outputFile,"wx",0o600);
 try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 const verified=gate.verify({
  binding:{attestation_file:outputFile,attestation_sha256:permit.sha(bytes)},
  trust,subjectSha,attemptRunId:"da9db7129607",sourceRoot:ROOT,
 });
 console.log(JSON.stringify({
  status:verified.status,attestation_file:outputFile,
  attestation_sha256:permit.sha(bytes),permit_signed:false,permit_consumed:false,
  production_authorized:false,execution_authorized:false,
 }));
}
main(process.argv.slice(2)).catch(error=>{
 console.error("FULL_CHAIN_ATTESTATION_HOLD:"+String(error.message||error).slice(0,240));
 process.exitCode=1;
});
