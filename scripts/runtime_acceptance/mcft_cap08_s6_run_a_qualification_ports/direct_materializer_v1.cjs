'use strict';
const assert=require('node:assert/strict');
const {runProductChainV1}=require('../mcft_cap08_s6_single_run_ports/product_chain_v1.cjs');
const {buildMaterializationOutputV1}=require('../mcft_cap08_s6_single_run_ports/materialization_output_v1.cjs');
function assertQualificationAuthorityV1(authority,spec){
 assert.equal(authority?.record_status,'SINGLE_DEVELOPMENT_QUALIFICATION_RUN_DATABASE_EXECUTION_AUTHORIZED','QUALIFICATION_DATABASE_EXECUTION_AUTHORITY_REQUIRED');
 assert.equal(authority.authority_class,'DEVELOPMENT_QUALIFICATION_ONLY');
 assert.equal(authority.evidence_class,'DEVELOPMENT_QUALIFICATION_ONLY');
 assert.equal(authority.final_formal_run_execution_authorized,false);
 assert.equal(authority.final_closure_eligible,false);
 assert.equal(authority.hard_acceptance_eligible,false);
 assert.equal(authority.exact_subject_sha,spec.exact_subject_sha,'QUALIFICATION_EXECUTION_AUTHORITY_SUBJECT');
 assert.equal(authority.authorized_run_label,spec.run_label,'QUALIFICATION_EXECUTION_AUTHORITY_RUN_LABEL');
 assert.equal(authority.operational_run_instance_id,spec.operational_run_instance_id,'QUALIFICATION_EXECUTION_AUTHORITY_INSTANCE');
}
function createDirectQualificationMaterializerV1({root,pool,adminPool,shared}){
 return{async executeDirectFormalRun(spec,executionAuthority){
  assertQualificationAuthorityV1(executionAuthority,spec);
  assert.equal(spec.lineage_id,null,'LINEAGE_MUST_BE_UNBOUND_BEFORE_MATERIALIZATION');
  assert.equal(spec.revision_id,null,'REVISION_MUST_BE_UNBOUND_BEFORE_MATERIALIZATION');
  const context=await runProductChainV1({root,pool,spec});
  return buildMaterializationOutputV1({adminPool,shared,spec,context});
 }};
}
module.exports={assertQualificationAuthorityV1,createDirectQualificationMaterializerV1};
