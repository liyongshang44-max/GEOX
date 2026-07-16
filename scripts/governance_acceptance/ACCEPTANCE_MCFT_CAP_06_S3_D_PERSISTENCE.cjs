#!/usr/bin/env node
// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_D_PERSISTENCE.cjs
// Purpose: fail closed unless S3 D persistence evidence, P-1 adjudication, one-migration boundary, support-state schema and candidate-phase SSOT agree exactly.
// Boundary: governance read-only validation; no database write, Candidate/Shadow compute, active Config, State, checkpoint, approval, route, scheduler, Model Activation or CAP-07 authority.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const S3 = 'MCFT-CAP-06.MCFT-03-12.D-GOVERNANCE-PERSISTENCE-RECOVERY-V1';
const S5 = 'MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1';
const EXPECTED_FILES = [
  'apps/server/db/migrations/2026_07_16_mcft_cap_06_calibration_governance_persistence.sql',
  'apps/server/src/persistence/twin_runtime/postgres_calibration_governance_persistence_repository_v1.ts',
  'apps/server/src/projections/twin_runtime/calibration_governance_projection_v1.ts',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S3-D-PERSISTENCE.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S3-STATUS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md',
  'scripts/acceptance/run_acceptance.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S1_CONTROLLED_DATA_CORRECTION.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S2_CONTRACTS_MATH.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_D_PERSISTENCE.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_D_PERSISTENCE_DB.ts',
  'scripts/runtime_acceptance/RUN_MCFT_CAP_06_S3_D_PERSISTENCE.cjs',
  'scripts/runtime_acceptance/mcft_cap_06_s3_persistence_fixture_v1.ts'
];
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const readText = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function main() {
  const result = readJson('acceptance-output/MCFT_CAP_06_S3_D_PERSISTENCE_RESULT.json');
  const pMinus1 = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-P-1-STATUS.json');
  const contract = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S3-D-PERSISTENCE.json');
  const status = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S3-STATUS.json');
  const current = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-STATE-RECONCILIATION.json');
  const delivery = readJson('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-DELIVERY-SLICE-STATUS.json');
  const matrix = readJson('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX.json');
  const task = readText('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-TASK.md');
  const runner = readText('scripts/acceptance/run_acceptance.cjs');
  const migration = readText('apps/server/db/migrations/2026_07_16_mcft_cap_06_calibration_governance_persistence.sql');
  const repository = readText('apps/server/src/persistence/twin_runtime/postgres_calibration_governance_persistence_repository_v1.ts');

  assert.equal(result.status, 'PASS');
  assert.equal(result.transaction_id, 'D_MODEL_GOVERNANCE_STEP_COMMIT');
  assert.equal(result.migration_count, 1);
  assert.equal(result.canonical_candidate_count, 2);
  assert.equal(result.canonical_evaluation_count, 2);
  assert.equal(result.canonical_object_count, 4);
  assert.equal(result.candidate_projection_count, 2);
  assert.equal(result.evaluation_projection_count, 2);
  assert.equal(result.candidate_evaluation_link_count, 2);
  assert.equal(result.evaluation_case_projection_count, 16);
  assert.equal(result.idempotency_guard_count, 4);
  assert.equal(result.candidate_to_evaluation_cardinality, 'ONE_TO_ZERO_OR_MANY');
  assert.equal(result.concurrent_same_hash_status, 'EXACTLY_ONE_CANONICAL_OBJECT_ALL_CALLERS_SAME_OBJECT');
  assert.equal(result.concurrent_different_hash_status, 'EXACTLY_ONE_WINNER_ONE_DETERMINISTIC_CONFLICT');
  assert.equal(result.response_loss_recovery, 'PASS');
  assert.equal(result.facts_based_rebuild, 'PASS');
  assert.equal(result.corrupt_projection_guard, 'PASS');
  assert.equal(result.canonical_divergence_guard, 'PASS');
  assert.equal(result.active_config_relation_delta, 0);
  assert.equal(result.model_activation_count, 0);
  assert.equal(result.state_count, 0);
  assert.equal(result.checkpoint_count, 0);

  assert.equal(pMinus1.persistence_adjudication.s3_migration_count, 1);
  assert.equal(pMinus1.persistence_adjudication.migration_kind, 'ADDITIVE_REBUILDABLE_PROJECTION_AND_IDEMPOTENCY_SUPPORT_ONLY');
  assert.equal(pMinus1.persistence_adjudication.public_facts_remains_sole_canonical_store, true);
  assert.equal(pMinus1.persistence_adjudication.active_config_index_creation_forbidden, true);
  assert.equal(pMinus1.transaction_adjudication.transaction_id, 'D_MODEL_GOVERNANCE_STEP_COMMIT');
  assert.equal(pMinus1.transaction_adjudication.exactly_one_object_type_per_transition, true);
  assert.equal(pMinus1.transaction_adjudication.active_config_cas_allowed, false);
  assert.equal(pMinus1.failed_attempt_persistence.mode, 'MODE_A_NO_PERSISTENT_ATTEMPT_OBJECT');
  assert.equal(pMinus1.candidate_to_evaluation_cardinality.cardinality, 'ONE_TO_ZERO_OR_MANY');

  assert.equal(contract.status, 'S3_D_PERSISTENCE_CANDIDATE');
  assert.equal(contract.effective, false);
  assert.equal(contract.migration.count, 1);
  assert.equal(contract.migration.active_config_relation_delta, 0);
  assert.equal(contract.transaction.public_facts_is_sole_canonical_store, true);
  assert.equal(contract.transaction.active_config_cas_allowed, false);
  assert.equal(contract.controlled_acceptance.workflow_run, 29518184366);
  assert.equal(contract.controlled_acceptance.status, 'PASS');

  assert.equal(status.delivery_slice_id, S3);
  assert.equal(status.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(status.s3_effective, false);
  assert.equal(status.s5_authorized, false);
  assert.equal(status.migration_count, 1);
  assert.equal(status.candidate_runtime_implemented, false);
  assert.equal(status.shadow_evaluation_runtime_implemented, false);
  assert.equal(status.candidate_validation.temporary_workflows_retained, false);
  assert.deepEqual(status.exact_changed_file_boundary, EXPECTED_FILES);
  assert.equal(status.candidate_validation.exact_changed_file_count, EXPECTED_FILES.length);

  assert.equal(current.current_state.active_delivery_slice_id, S3);
  assert.equal(current.current_state.s3, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(current.current_state.s3_authorized, true);
  assert.equal(current.current_state.s3_implementation_started, true);
  assert.equal(current.current_state.d_persistence_candidate_implemented, true);
  assert.equal(current.current_state.d_persistence_implemented, false);
  assert.equal(current.current_state.candidate_runtime_implemented, false);
  assert.equal(current.current_state.shadow_evaluation_runtime_implemented, false);

  assert.equal(delivery.active_delivery_slice_id, S3);
  assert.deepEqual(delivery.candidate_slices, [S3]);
  assert.deepEqual(delivery.authorized_not_started_slices, []);
  assert.equal(delivery.s3_authorized, true);
  assert.equal(delivery.s3_implementation_started, true);
  assert.equal(delivery.s3_candidate_implemented, true);
  assert.equal(delivery.s3_effective, false);
  assert.equal(delivery.blocked_slices.includes(S5), true);

  const lines = Array.isArray(matrix.capability_lines) ? matrix.capability_lines : matrix.capabilities;
  const line = lines.find((item) => item.capability_line_id === 'MCFT-CAP-06');
  assert.ok(line);
  assert.equal(line.active_delivery_slice_id, S3);
  assert.equal(line.implementation_status, 'S3_D_PERSISTENCE_CANDIDATE');
  assert.deepEqual(line.next_authorized_slice_ids, []);
  assert.equal(line.d_persistence_candidate_implemented, true);
  assert.equal(line.d_persistence_implemented, false);
  assert.equal(line.candidate_runtime_implemented, false);
  assert.equal(line.shadow_evaluation_runtime_implemented, false);
  const matrixS3 = line.delivery_slices.find((item) => item.delivery_slice_id === S3);
  assert.equal(matrixS3.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(matrixS3.implementation_started, true);
  assert.equal(matrixS3.effectiveness_condition_satisfied, false);
  assert.equal(matrix.latest_governance_update, 'MCFT-CAP-06.S3.D-PERSISTENCE-CANDIDATE-V1');

  assert.match(task, /S3_D_PERSISTENCE_CANDIDATE/);
  assert.match(task, /NO_S5_CALIBRATION_CANDIDATE_COMPUTE_SERVICE/);
  assert.match(runner, /MCFT_CAP_06_S3_D_PERSISTENCE/);
  assert.match(runner, /MCFT_CAP_06_S3_D_PERSISTENCE_GOVERNANCE/);
  assert.match(migration, /D_CALIBRATION_CANDIDATE/);
  assert.match(migration, /D_SHADOW_EVALUATION/);
  assert.doesNotMatch(migration, /CREATE TABLE[^;]*active[^;]*config/is);
  assert.match(repository, /pg_advisory_xact_lock/);
  assert.doesNotMatch(repository, /active_config/i);
  assert.doesNotMatch(repository, /twin_model_activation_v1/);

  for (const pathValue of [
    '.github/workflows/mcft-cap-06-s3-validation.yml',
    '.github/workflows/mcft-cap-06-s3-finalizer.yml'
  ]) {
    assert.equal(fs.existsSync(path.join(ROOT, pathValue)), false, `temporary S3 path retained: ${pathValue}`);
  }

  console.log('MCFT-CAP-06 S3 D persistence governance: PASS');
}

main();
