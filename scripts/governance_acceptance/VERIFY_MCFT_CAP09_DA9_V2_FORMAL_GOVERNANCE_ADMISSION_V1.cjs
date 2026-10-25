#!/usr/bin/env node
"use strict";
// Formal-governance admission boundary for new source qualification.
// Current status: HOLD. Never invent an independent actor or issue a Permit.
const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process");
const assert=require("node:assert/strict"),crypto=require("node:crypto");
const ROOT=path.resolve(__dirname,"../..");
const REQ="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-FORMAL-GOVERNANCE-ADMISSION-REQUEST-V1.json";
const TECH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP09-DA9-SIGNED-V2-QCP-TECHNICAL-ENROLLMENT-V1.json";
const TRUST="scripts/runtime_acceptance/MCFT_CAP09_RETRY_TRUST_V1.json";
const QCP="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json";
const RES="DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_REQUEST_EXACT_SCOPE_V1";
const CHECK="DA9_SIGNED_V2_FORMAL_GOVERNANCE_ADMISSION_PENDING";
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),"utf8"));
function holdRequest(d,t,trust,q){
  assert.equal(d.schema_version,"geox_mcft_cap09_da9_signed_v2_formal_governance_admission_request_v1");
  assert.equal(d.request_id,"DA9_SIGNED_V2_PHASE3_FROZEN_TWO_BLOB_FORMAL_GOVERNANCE_V1");
  assert.equal(d.request_status,"HOLD_PURPOSE_SPECIFIC_DELEGATION_AND_INDEPENDENT_APPROVAL_REQUIRED");
  assert.equal(d.type,"SOURCE_QUALIFICATION_SUCCESSOR_NOT_PRODUCTION_OR_RETRY_PERMIT");
  assert.equal(d.source_head_sha,t.basis_source_sha);
  assert.equal(d.source_base_sha,t.basis_base_sha);
  assert.equal(d.native_six_run_id,t.basis_original_six_native_workflow_run);
  assert.equal(d.native_six_signed_bundle_sha256,t.basis_signed_bundle_sha256);
  assert.equal(d.native_six_independent_crypto_review_sha256,t.basis_independent_signature_audit_sha256);
  assert.equal(d.technical_registration_path,TECH);
  assert.equal(d.technical_governance_ci_run_id,40196258357);
  assert.equal(d.technical_registration_negative_cases,10);
  assert.equal(t.registration_status,"REGISTERED_TWO_NEW_SUBJECT_TECHNICAL_DECISIONS_WITH_EXECUTION_HOLD");
  assert.equal(t.qcp_formal_requalification_approved,false);
  assert.equal(t.independent_retry_governance_approval,false);
  assert.equal(d.review_decisions.length,2);
  assert.deepEqual(d.review_decisions.map(x=>x.check_id),["PHASE3_EVIDENCE_RUNTIME_FOUNDATION","FROZEN_V13_TWO_BLOB_SEMANTIC_SUCCESSOR"]);
  assert.equal(d.review_decisions[0].new_source_digest,t.adjudications[0].registered_new_dependency_digest);
  assert.equal(d.review_decisions[0].historical_digest,t.adjudications[0].legacy_digest);
  assert.equal(d.review_decisions[0].legacy_carryforward_allowed,false);
  assert.equal(d.review_decisions[1].new_runtime_digest,t.adjudications[1].new_runtime_digest);
  assert.equal(d.review_decisions[1].old_runtime_digest,t.adjudications[1].old_runtime_digest);
  assert.equal(d.review_decisions[1].changed_path_count,2);
  assert.equal(d.review_decisions[1].historical_zero_delta_assertion,false);
  assert.equal(d.registered_operator_issuer,trust.operator_id);
  const operator=trust.issuers.filter(x=>x.issuer_id===trust.operator_id);
  const independent=trust.issuers.filter(x=>x.issuer_id===d.independent_review_issuer_candidate);
  assert.equal(operator.length,1);assert.equal(independent.length,1);
  assert.equal(operator[0].role,"ACCOUNTABLE_SINGLE_OPERATOR");
  assert.equal(independent[0].role,"INDEPENDENT_RETRY_GOVERNANCE");
  assert.notEqual(independent[0].issuer_id,operator[0].issuer_id);
  assert.notEqual(independent[0].spki_sha256,operator[0].spki_sha256);
  assert.equal(d.independent_review_public_key_spki_sha256,independent[0].spki_sha256);
  assert.equal(d.registered_operator_spki_sha256,operator[0].spki_sha256);
  assert.equal(independent[0].revoked,false);
  const spki=crypto.createPublicKey(independent[0].public_key_pem).export({format:"der",type:"spki"});
  assert.equal(crypto.createHash("sha256").update(spki).digest("hex"),independent[0].spki_sha256);
  assert.equal(trust.adopted,false);
  assert.equal(trust.execution_enabled,false);
  for(const k of ["independent_issuer_existing_role_grants_formal_source_successor_approval",
    "independent_issuer_private_key_possession_verified","operator_private_key_may_impersonate_independent_issuer",
    "independent_formal_approval_signature_received","central_qcp_formal_qualified",
    "adoption_qualified","production_authorized","fenced_pg_admitted","permit_issued"])assert.equal(d[k],false,"AUTHORIZATION_FALSE_REQUIRED:"+k);
  for(const k of ["independent_formal_approval_record_sha256","approved_purpose_delegation_record_sha256",
    "approved_purpose_delegation_authority_provenance"])assert.equal(d[k],null,"UNVERIFIED_AUTHORITY_REFERENCE:"+k);
  assert.equal(d.legacy_da9_frozen_contract_unchanged,true);
  assert.equal(d.historical_frozen_v13_zero_delta_still_fail,true);
  assert.equal(d.signed_v2_operator_evidence_not_resigned,true);
  assert.equal(t.fenced_pg_admitted,false);
  assert.equal(t.production_authorized,false);
  const c=q.checks.find(x=>x.check_id===CHECK);
  assert(c&&c.carry_forward_evidence_id===null);
  assert.equal(c.execution_workflow_status,"FORMAL_GOVERNANCE_HOLD_DISTINCT_AUTHORIZED_SIGNATURE_NOT_PRESENT");
  assert.equal(c.carry_forward_policy,"NONE_NO_PREDECESSOR_FROZEN_ZERO_DELTA_CARRY_FORWARD");
  assert.deepEqual(c.resolver_ids,[RES]);
  assert.deepEqual(c.authority_refs,[REQ]);
  const own=q.dependency_resolvers[RES];
  assert(own&&own.kind==="EXACT_PATH_SET");
  assert.deepEqual(own.paths,[
    ".github/workflows/mcft-cap09-da9-signed-v2-governance-readonly-v1.yml",
    REQ,"scripts/governance_acceptance/VERIFY_MCFT_CAP09_DA9_V2_FORMAL_GOVERNANCE_ADMISSION_V1.cjs"
  ].sort());
  return {
    status:"PASS_EXPECTED_HOLD_FORMAL_V2_GOVERNANCE_NOT_ADMITTED",
    subject:d.source_head_sha,
    phase3_technical_accepted:true,
    frozen_two_blob_technical_accepted:true,
    independent_governance_signer_registered_for_retry_only:true,
    purpose_specific_delegation_verified:false,
    independent_formal_approval_verified:false,
    central_qcp_formal_qualified:false,
    original_frozen_zero_delta_pass:false,
    permit:false,production:false,fenced_pg:false
  };
}
function negative(d,t,trust,q){
  let passed=0;
  function bad(fn){const x=structuredClone(d);fn(x);assert.throws(()=>holdRequest(x,t,trust,q));passed++;}
  bad(x=>x.request_status="APPROVED");
  bad(x=>x.independent_formal_approval_signature_received=true);
  bad(x=>x.independent_issuer_existing_role_grants_formal_source_successor_approval=true);
  bad(x=>x.approved_purpose_delegation_record_sha256="sha256:"+"0".repeat(64));
  bad(x=>x.independent_formal_approval_record_sha256="sha256:"+"0".repeat(64));
  bad(x=>x.source_head_sha="0".repeat(40));
  bad(x=>x.native_six_signed_bundle_sha256="sha256:"+"0".repeat(64));
  bad(x=>x.review_decisions[0].new_source_digest=x.review_decisions[0].historical_digest);
  bad(x=>x.review_decisions[1].changed_path_count=3);
  bad(x=>x.review_decisions[1].historical_zero_delta_assertion=true);
  bad(x=>x.permit_issued=true);
  bad(x=>x.production_authorized=true);
  bad(x=>x.fenced_pg_admitted=true);
  bad(x=>x.operator_private_key_may_impersonate_independent_issuer=true);
  return passed;
}
function main(){
  const d=read(REQ),t=read(TECH),trust=read(TRUST),q=read(QCP);
  const result=holdRequest(d,t,trust,q),count=negative(d,t,trust,q);
  assert.equal(count,14);
  if(process.argv.includes("--require-approved"))throw Error(
    "HOLD_FORMAL_GOVERNANCE_NO_PURPOSE_DELEGATION_NO_SEPARATE_INDEPENDENT_SIGNATURE");
  console.log(JSON.stringify({...result,negative_tests_pass:count}));
}
try{main()}catch(e){console.error("HOLD_FORMAL_GOVERNANCE:"+String(e.stack||e));process.exitCode=1;}
