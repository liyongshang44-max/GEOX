'use strict';

const assert = require('node:assert/strict');

function assertFormalMaterializerAuthorityV1(authority, spec) {
  assert.equal(
    authority?.record_status,
    'SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED',
    'DATABASE_EXECUTION_AUTHORITY_REQUIRED',
  );
  assert.equal(authority.authority_class, 'FINAL_FORMAL_RUN_ONLY');
  assert.equal(authority.exact_subject_sha, spec.exact_subject_sha, 'EXECUTION_AUTHORITY_SUBJECT');
  assert.equal(authority.authorized_run_label, spec.run_label, 'EXECUTION_AUTHORITY_RUN_LABEL');
  assert.equal(
    authority.operational_run_instance_id,
    spec.operational_run_instance_id,
    'EXECUTION_AUTHORITY_INSTANCE',
  );
}

function createDirectMaterializerV1({
  root,
  pool,
  adminPool,
  shared,
  authority,
  runProductChainV1 = null,
  buildMaterializationOutputV1 = null,
}) {
  return {
    async executeDirectFormalRun({ spec, plan }) {
      assertFormalMaterializerAuthorityV1(authority, spec);
      assert.ok(plan && typeof plan === 'object', 'FORMAL_MATERIALIZER_PLAN_REQUIRED');
      assert.equal(plan.strategy, 'DIRECT_PRODUCT_SERVICE_ASSEMBLY', 'FORMAL_MATERIALIZER_STRATEGY');
      assert.equal(plan.formal_run_id, spec.formal_run_id, 'FORMAL_MATERIALIZER_PLAN_RUN');
      assert.equal(spec.lineage_id, null, 'LINEAGE_MUST_BE_UNBOUND_BEFORE_MATERIALIZATION');
      assert.equal(spec.revision_id, null, 'REVISION_MUST_BE_UNBOUND_BEFORE_MATERIALIZATION');
      const run = runProductChainV1
        ?? require('./product_chain_v1.cjs').runProductChainV1;
      const build = buildMaterializationOutputV1
        ?? require('./materialization_output_v1.cjs').buildMaterializationOutputV1;
      const context = await run({ root, pool, spec });
      return build({ adminPool, shared, spec, context });
    },
  };
}

module.exports = {
  assertFormalMaterializerAuthorityV1,
  createDirectMaterializerV1,
};
