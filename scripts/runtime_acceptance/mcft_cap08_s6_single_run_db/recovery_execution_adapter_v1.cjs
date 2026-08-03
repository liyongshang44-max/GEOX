'use strict';

const assert = require('node:assert/strict');
const { validateExactPathAuthorityV1 } = require('../mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs');

const VECTOR_IDS = [
  'FRESH_PROCESS_RESTART',
  'T11_PRECOMMIT_ROLLBACK',
  'T12_POSTCOMMIT_RESPONSE_LOSS',
  'CONCURRENCY_FENCING',
  'EXTREME_POINTER_LOSS_REBUILD',
  'PROJECTION_LOSS_REBUILD',
  'RESPONSE_AND_POINTER_LOSS',
];

function buildRecoveryExecutionPlanV1(spec) {
  return {
    schema_version: 'geox_mcft_cap08_s6_recovery_execution_plan_v1',
    formal_run_id: spec.formal_run_id,
    run_label: spec.run_label,
    silent_repair_forbidden: true,
    vectors: VECTOR_IDS.map((vector_id, index) => ({
      vector_id,
      index,
      independent_entrypoint_required: true,
      before_snapshot_required: true,
      after_snapshot_required: true,
      canonical_write_delta_rule: vector_id === 'T11_PRECOMMIT_ROLLBACK'
        ? 'ZERO_FAILED_ATTEMPT'
        : vector_id.includes('REBUILD')
          ? 'ZERO_CANONICAL_WRITE'
          : 'NO_DUPLICATE_CANONICAL_WRITE',
      execution_authorized: false,
    })),
  };
}

async function executeRecoveryVectorsV1(port, spec, authority) {
  validateExactPathAuthorityV1(authority, {
    exactSubjectSha: spec.exact_subject_sha,
    runLabel: spec.run_label,
    operationalRunInstanceId: spec.operational_run_instance_id,
  });
  const plan = buildRecoveryExecutionPlanV1(spec);
  const results = [];
  for (const vector of plan.vectors) {
    const result = await port.executeVector({ spec, vector });
    assert.equal(result.vector_id, vector.vector_id);
    assert.equal(result.status, 'PASS');
    assert.equal(result.silent_repair_used, false);
    results.push(result);
  }
  return { plan, results };
}

module.exports = { VECTOR_IDS, buildRecoveryExecutionPlanV1, executeRecoveryVectorsV1 };
