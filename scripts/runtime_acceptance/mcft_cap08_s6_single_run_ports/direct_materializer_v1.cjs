'use strict';

const assert = require('node:assert/strict');
const {
  FORMAL_MODE_V1,
  validateExactPathAuthorityV1,
} = require('../mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs');

function assertExactPathMaterializerAuthorityV1(authority, spec) {
  return validateExactPathAuthorityV1(authority, {
    exactSubjectSha: spec.exact_subject_sha,
    runLabel: spec.run_label,
    operationalRunInstanceId: spec.operational_run_instance_id,
  });
}

function assertFormalMaterializerAuthorityV1(authority, spec) {
  const validated = assertExactPathMaterializerAuthorityV1(authority, spec);
  assert.equal(validated.execution_mode, FORMAL_MODE_V1, 'FORMAL_MATERIALIZER_AUTHORITY_REQUIRED');
  return validated;
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
      assertExactPathMaterializerAuthorityV1(authority, spec);
      assert.ok(plan && typeof plan === 'object', 'FORMAL_MATERIALIZER_PLAN_REQUIRED');
      assert.equal(plan.strategy, 'DIRECT_PRODUCT_SERVICE_ASSEMBLY', 'FORMAL_MATERIALIZER_STRATEGY');
      assert.equal(plan.formal_run_id, spec.formal_run_id, 'FORMAL_MATERIALIZER_PLAN_RUN');
      assert.equal(spec.lineage_id, null, 'LINEAGE_MUST_BE_UNBOUND_BEFORE_MATERIALIZATION');
      assert.equal(spec.revision_id, null, 'REVISION_MUST_BE_UNBOUND_BEFORE_MATERIALIZATION');
      const run = runProductChainV1 ?? require('./product_chain_v1.cjs').runProductChainV1;
      const build = buildMaterializationOutputV1 ?? require('./materialization_output_v1.cjs').buildMaterializationOutputV1;
      const context = await run({ root, pool, spec });
      return build({ adminPool, shared, spec, context });
    },
  };
}

module.exports = {
  assertExactPathMaterializerAuthorityV1,
  assertFormalMaterializerAuthorityV1,
  createDirectMaterializerV1,
};
