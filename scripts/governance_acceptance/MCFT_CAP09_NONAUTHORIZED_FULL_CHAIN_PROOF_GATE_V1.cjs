"use strict";
/**
 * Mandatory pre-Permit evidence gate for the *real physical* non-authorized
 * integration run. Signed CI status or a successful Composer constructor is
 * deliberately not sufficient. This module has NO network, mutation, key
 * generation, Permit signing, or execution functions.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const permit=require("../runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs");
const DOMAIN="GEOX_MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_ATTESTATION_V1\n";
const SHA=/^[a-f0-9]{64}$/;
const SOURCE_PATHS=Object.freeze([
  "apps/server/src/runtime/twin_runtime/external_formal_exact_base_fact_promotion_v1.ts",
  "apps/server/src/persistence/external_evidence/postgres_evidence_runtime_fenced_exact_base_fact_promotion_v1.ts",
  "scripts/runtime_acceptance/MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.ts",
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_DA9_ISOLATED_FULL_CHAIN_NONAUTHORIZED_V1.ts",
  "apps/server/src/external_evidence/mcft_cap09_phase7_private_candidate_capture_promotion_v1.ts",
  "apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.ts",
  "apps/server/db/migrations/2026_08_28_mcft_cap_09_v13_evidence_runtime_fenced_promotion_acl.sql",
]);
function regular(file){
  assert(typeof file==="string"&&path.isAbsolute(file),"FULL_CHAIN_EVIDENCE_ABSOLUTE_PATH_REQUIRED");
  const s=fs.lstatSync(file);
  assert(s.isFile()&&!s.isSymbolicLink()&&s.size>0&&s.size<1_048_576,"FULL_CHAIN_EVIDENCE_REGULAR_FILE_REQUIRED");
  return fs.readFileSync(file);
}
function exact(value,fields){
  assert(value&&typeof value==="object"&&!Array.isArray(value),"FULL_CHAIN_JSON_OBJECT_REQUIRED");
  assert.deepEqual(Object.keys(value).sort(),fields.slice().sort(),"FULL_CHAIN_EVIDENCE_SCHEMA_CHANGED");
}
function verify({binding,trust,subjectSha,attemptRunId,sourceRoot,now=Date.now()}){
  assert(binding,"FULL_CHAIN_SIGNED_NONAUTHORIZED_EVIDENCE_REQUIRED");
  exact(binding,["attestation_file","attestation_sha256"]);
  assert(SHA.test(binding.attestation_sha256),"FULL_CHAIN_ATTESTATION_DIGEST_REQUIRED");
  const attestationBytes=regular(binding.attestation_file);
  assert.equal(permit.sha(attestationBytes),binding.attestation_sha256,"FULL_CHAIN_ATTESTATION_BYTES_CHANGED");
  const envelope=JSON.parse(attestationBytes.toString("utf8"));
  exact(envelope,["payload","signature_base64"]);
  const a=envelope.payload;
  exact(a,["schema_version","issuer_id","key_id","subject_sha","test_run_id","receipt_file","receipt_sha256","signed_at","non_authorized","production_authorized"]);
  assert.equal(a.schema_version,"geox_mcft_cap09_non_authorized_full_chain_attestation_v1");
  assert.equal(a.subject_sha,subjectSha,"FULL_CHAIN_SUBJECT_CHANGED");
  assert(/^[a-f0-9]{12}$/.test(a.test_run_id)&&a.test_run_id!==attemptRunId
    &&!["da9db7129607","72dc0304a21a"].includes(a.test_run_id),"FULL_CHAIN_TEST_MUST_NOT_REUSE_EXECUTION");
  assert.equal(a.non_authorized,true,"FULL_CHAIN_NONAUTHORIZED_SCOPE_REQUIRED");
  assert.equal(a.production_authorized,false,"FULL_CHAIN_PRODUCTION_FORBIDDEN");
  const when=Date.parse(a.signed_at);
  assert(Number.isFinite(when)&&new Date(when).toISOString()===a.signed_at
    &&when<=now&&now-when<7*86400000,"FULL_CHAIN_ATTESTATION_OUTSIDE_REVIEW_WINDOW");
  assert(SHA.test(a.receipt_sha256),"FULL_CHAIN_RECEIPT_HASH_REQUIRED");
  const receiptBytes=regular(a.receipt_file);
  assert.equal(permit.sha(receiptBytes),a.receipt_sha256,"FULL_CHAIN_PHYSICAL_RECEIPT_CHANGED");
  const receipt=JSON.parse(receiptBytes.toString("utf8"));
  assert.equal(receipt.schema_version,"geox_mcft_cap09_isolated_non_authorized_full_chain_contract_v1");
  assert.equal(receipt.status,"PASS","FULL_CHAIN_PHYSICAL_TEST_NOT_PASS");
  assert.equal(receipt.subject_sha,subjectSha,"FULL_CHAIN_RECEIPT_SUBJECT_CHANGED");
  assert.equal(receipt.test_run_id,a.test_run_id,"FULL_CHAIN_RECEIPT_RUN_CHANGED");
  assert.equal(receipt.authorization,"NON_AUTHORIZED_ISOLATED_ENGINEERING_TEST_ONLY");
  assert.equal(receipt.isolated_s3_bucket,"mcft-cap09-requal-"+a.test_run_id);
  assert.equal(receipt.pg_database,"mcft_cap09_non_auth_e2e_"+a.test_run_id);
  for(const k of ["real_postgres_fenced_promotion","candidate_manifest_private_readback",
    "exact_three_facts_single_fenced_transaction","post_commit_physical_readback_verified",
    "controller_attestation_after_promotion","cursor_advanced_only_after_attestation",
    "private_raw_retention_real_s3_verified"]){
    assert.equal(receipt[k],true,"FULL_CHAIN_PHYSICAL_GAP:"+k);
  }
  for(const k of ["permit_signed","permit_consumed","production_authorized",
    "production_owner_activation","formal_v5_armed","o00_started"]){
    assert.equal(receipt[k],false,"FULL_CHAIN_FORBIDDEN_AUTHORITY:"+k);
  }
  assert.equal(receipt.evidence_login_restricted,true,"FULL_CHAIN_RESTRICTED_EVIDENCE_LOGIN_REQUIRED");
  assert.equal(receipt.evidence_direct_fact_insert_allowed,false,"FULL_CHAIN_DIRECT_FACT_INSERT_FORBIDDEN");
  assert.equal(receipt.evidence_fenced_writer_execute_allowed,true,"FULL_CHAIN_FENCED_WRITER_EXECUTE_REQUIRED");
  assert.equal(receipt.real_postgres_formal_fact_present_count,3,"FULL_CHAIN_EXACT_THREE_FORMAL_FACTS_REQUIRED");
  assert.equal(receipt.capture_raw_object_count,2,"FULL_CHAIN_TWO_REAL_S3_RAW_OBJECTS_REQUIRED");
  assert.equal(receipt.candidate_semantic_record_count,3,"FULL_CHAIN_THREE_CANONICAL_RECORDS_REQUIRED");
  assert.equal(receipt.promotion_provider_refetch_count,0,"FULL_CHAIN_PROVIDER_REPLAY_FORBIDDEN");
  assert.equal(receipt.stage_count,0,"FULL_CHAIN_TEST_MUST_NOT_EXECUTE_STAGES");
  exact(receipt.source_files_sha256,SOURCE_PATHS);
  for(const file of SOURCE_PATHS){
    const actual=permit.sha(regular(path.join(sourceRoot,file)));
    assert.equal(receipt.source_files_sha256[file],actual,"FULL_CHAIN_TESTED_SOURCE_CHANGED:"+file);
  }
  assert(trust&&Array.isArray(trust.issuers),"FULL_CHAIN_REVIEW_TRUST_REQUIRED");
  const issuers=trust.issuers.filter(i=>i.issuer_id===a.issuer_id&&i.key_id===a.key_id&&!i.revoked);
  assert.equal(issuers.length,1,"FULL_CHAIN_AUTHORIZED_REVIEWER_REQUIRED");
  const issuer=issuers[0];
  assert(["ACCOUNTABLE_SINGLE_OPERATOR","INDEPENDENT_RETRY_GOVERNANCE"].includes(issuer.role),"FULL_CHAIN_ISSUER_ROLE_INVALID");
  assert(Date.parse(issuer.not_before)<=when&&when<=Date.parse(issuer.not_after),"FULL_CHAIN_REVIEWER_KEY_EXPIRED");
  const publicKey=crypto.createPublicKey(issuer.public_key_pem);
  assert.equal(permit.sha(publicKey.export({type:"spki",format:"der"})),issuer.spki_sha256,"FULL_CHAIN_REVIEW_KEY_CHANGED");
  const sig=Buffer.from(envelope.signature_base64,"base64");
  assert(sig.length===64&&sig.toString("base64")===envelope.signature_base64,"FULL_CHAIN_SIGNATURE_FORMAT_INVALID");
  assert(crypto.verify(null,Buffer.from(DOMAIN+permit.canonical(a)),publicKey,sig),"FULL_CHAIN_OPERATOR_SIGNATURE_INVALID");
  return {status:"FULL_CHAIN_PHYSICAL_INTEGRATION_SIGNED_REVIEW_VERIFIED_NOT_PERMIT_AUTHORITY",
    subject_sha:subjectSha,source_byte_count:SOURCE_PATHS.length,production_authorized:false,execute_authorized:false};
}
module.exports={verify,SOURCE_PATHS,DOMAIN};
