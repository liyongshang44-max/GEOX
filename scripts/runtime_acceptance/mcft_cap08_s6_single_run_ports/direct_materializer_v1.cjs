'use strict';
const assert=require('node:assert/strict');
const {runProductChainV1}=require('./product_chain_v1.cjs');
const {buildMaterializationOutputV1}=require('./materialization_output_v1.cjs');
function createDirectMaterializerV1({root,pool,adminPool,shared}){
  return{
    async executeDirectFormalRun(spec,executionAuthority){
      assert.equal(executionAuthority?.record_status,'SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED','DATABASE_EXECUTION_AUTHORITY_REQUIRED');
      assert.equal(executionAuthority.exact_subject_sha,spec.exact_subject_sha,'EXECUTION_AUTHORITY_SUBJECT');
      assert.equal(spec.lineage_id,null,'LINEAGE_MUST_BE_UNBOUND_BEFORE_MATERIALIZATION');
      assert.equal(spec.revision_id,null,'REVISION_MUST_BE_UNBOUND_BEFORE_MATERIALIZATION');
      const context=await runProductChainV1({root,pool,spec});
      return buildMaterializationOutputV1({adminPool,shared,spec,context});
    },
  };
}
module.exports={createDirectMaterializerV1};
