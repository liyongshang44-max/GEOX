// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_PERSISTENCE.cjs
// Purpose: fail closed unless the immutable MCFT-CAP-06 S3 implementation preserves the exact D-persistence, exact-ref, projection, recovery, canonicality and nonactivation boundaries, while allowing the mutable delivery frontier to advance after S3 effectiveness.
// Boundary: static repository and machine-readable governance validation only; no database mutation, calibration compute, canonical append, Runtime authority, State, checkpoint, route, scheduler, or Model Activation.

'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASELINE = 'ea198cc0cad063c7e70a59727171908f2f8c7e7d';
const S3 = 'MCFT-CAP-06.MCFT-03-12.D-GOVERNANCE-PERSISTENCE-RECOVERY-V1';
const S4 = 'MCFT-CAP-06.MCFT-02-03-04-05-09-11.PREDECESSOR-CONSUMPTION-STABILIZATION-V1';
const S5 = 'MCFT-CAP-06.MCFT-06-09-11-12.CALIBRATION-CANDIDATE-COMPUTE-COMMIT-V1';
const EXPECTED_PERMANENT_FILES = [
  '.github/workflows/mcft-cap-06-s3-focused-validation.yml',
  'apps/server/db/migrations/2026_07_17_mcft_cap_06_calibration_governance_persistence.sql',
  'apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.ts',
  'apps/server/src/persistence/calibration/postgres_exact_calibration_residual_repository_v1.ts',
  'apps/server/src/projections/calibration/calibration_governance_projection_v1.ts',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-BASELINE-RECONCILIATION-EFFECTIVENESS.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S3-ENTRY-CONTRACT.md',
  'docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S3-STATUS.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_PERSISTENCE.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_PERSISTENCE_DB.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_PROJECTION_CANONICALITY_DB.ts',
  'scripts/runtime_acceptance/RUN_MCFT_CAP_06_S3_PERSISTENCE.cjs',
  'scripts/runtime_acceptance/mcft_cap_06_controlled_compute_fixture_v1.ts',
];

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function json(relative) {
  return JSON.parse(read(relative));
}

function git(args) {
  return cp.execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function changedFilesThrough(implementationRef) {
  git(['cat-file', '-e', `${implementationRef}^{commit}`]);
  const output = git(['diff', '--name-only', `${BASELINE}...${implementationRef}`]);
  return output ? output.split(/\r?\n/).filter(Boolean).sort() : [];
}

function assertNoPattern(text, pattern, code) {
  assert.equal(pattern.test(text), false, code);
}

function assertCandidateFrontier(delivery, status) {
  assert.equal(delivery.active_delivery_slice_id, S3);
  assert.deepEqual(delivery.candidate_slices, [S3]);
  assert.deepEqual(delivery.authorized_not_started_slices, []);
  assert.equal(delivery.blocked_slices.includes(S5), true);
  assert.equal(delivery.s3.authorized, true);
  assert.equal(delivery.s3.implementation_started, true);
  assert.equal(delivery.s3.candidate_implemented, true);
  assert.equal(delivery.s3.effective, false);
  assert.equal(status.status, 'CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(status.s3_effective, false);
  assert.equal(status.s5_authorized, false);
}

function assertEffectiveFrontier(delivery, status) {
  assert.equal(delivery.s3.authorized, true);
  assert.equal(delivery.s3.implementation_started, true);
  assert.equal(delivery.s3.candidate_implemented, true);
  assert.equal(delivery.s3.effective, true);
  assert.equal(status.status, 'MERGED_EFFECTIVE');
  assert.equal(status.s3_effective, true);
  assert.equal(status.effectiveness_evidence.merge_commit, '36efb93963222b2768b8d2bf384f748c86ce525a');
  assert.equal(status.effectiveness_evidence.head_to_merge_file_delta_count, 0);
  assert.equal(status.effectiveness_evidence.head_to_merge_tree_equivalence, 'PASS');
  assert.equal(status.effectiveness_evidence.postmerge_workflow_run, 29520979042);
  assert.equal(status.s4_authorized, true);

  const s4Effective = delivery.s4?.effective === true;
  if (!s4Effective) {
    assert.equal(delivery.active_delivery_slice_id, S4);
    assert.equal(delivery.blocked_slices.includes(S5), true);
    assert.equal(status.s5_authorized, false);
  }
}

function main() {
  const baseline = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-BASELINE-RECONCILIATION-EFFECTIVENESS.json');
  const delivery = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-CURRENT-DELIVERY-STATE.json');
  const status = json('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S3-STATUS.json');
  const s3Effective = status.s3_effective === true;
  const implementationRef = s3Effective
    ? status.effectiveness_evidence?.merge_commit
    : 'HEAD';
  assert.equal(typeof implementationRef, 'string');
  assert.equal(Boolean(implementationRef), true);

  const changed = changedFilesThrough(implementationRef);
  assert.deepEqual(changed, [...EXPECTED_PERMANENT_FILES].sort());
  assert.equal(changed.filter((relative) => relative.startsWith('apps/server/db/migrations/')).length, 1);
  assert.equal(changed.some((relative) => relative.startsWith('apps/web/')), false);
  assert.equal(changed.some((relative) => /route|routes|controller|openapi/i.test(relative)), false);
  assert.equal(changed.some((relative) => relative.startsWith('apps/server/src/domain/calibration/')), false);

  assert.equal(baseline.record_kind, 'IMMUTABLE_PREDECESSOR_EFFECTIVENESS_EVIDENCE');
  assert.equal(baseline.effective, true);
  assert.equal(baseline.effective_slices.s2.status, 'MERGED_EFFECTIVE');
  assert.equal(baseline.effective_slices.s2.effectiveness_merge_commit, BASELINE);
  assert.equal(baseline.effective_slices.s2.effectiveness_postmerge_workflow_run, 29517085242);
  assert.equal(baseline.immutable_facts.s2_is_sole_deterministic_domain_engine_authority, true);
  assert.equal(baseline.immutable_facts.s2_canonical_write_count, 0);
  assert.equal(baseline.immutable_facts.s2_projection_write_count, 0);
  assert.equal(baseline.immutable_facts.s2_migration_count, 0);
  assert.equal(baseline.immutable_facts.s2_model_activation_count, 0);

  assert.equal(delivery.record_kind, 'MUTABLE_DELIVERY_FRONTIER');
  assert.equal(delivery.s3.migration_count, 1);
  assert.equal(delivery.s3.exact_ref_postgresql_adapter_implemented, true);
  assert.equal(delivery.s3.facts_based_rebuild_implemented, true);
  assert.equal(delivery.s3.projection_canonicality_triggers_implemented, true);

  assert.equal(status.delivery_slice_id, S3);
  assert.equal(status.authorization.s2_merged_effective, true);
  assert.equal(status.authorization.s3_authorized, true);
  assert.equal(status.implementation.additive_migration_count, 1);
  assert.equal(status.implementation.canonical_store, 'public.facts');
  assert.deepEqual(status.implementation.d_transaction_object_types, [
    'twin_calibration_candidate_v1',
    'twin_shadow_evaluation_v1',
  ]);
  assert.equal(status.implementation.candidate_ref_alone_unique, false);
  assert.equal(status.implementation.failed_attempt_persistence_mode, 'MODE_A_NO_PERSISTENT_ATTEMPT_OBJECT');

  if (s3Effective) assertEffectiveFrontier(delivery, status);
  else assertCandidateFrontier(delivery, status);

  const entry = read('docs/digital_twin/mcft/cap_06/GEOX-MCFT-CAP-06-S3-ENTRY-CONTRACT.md');
  assert.match(entry, /S2 remains the sole mathematical authority/);
  assert.match(entry, /S5 and S6 are forbidden from creating a second calibration or shadow mathematics authority/);
  assert.match(entry, /S3 owns the PostgreSQL implementation and SQL-shape proof/);
  assert.match(entry, /mcft-cap-06-s3-focused-validation\.yml/);
  assert.match(entry, /NO_MODEL_ACTIVATION/);
  assert.match(entry, /NO_ACTIVE_CONFIG_SWITCH/);

  const workflow = read('.github/workflows/mcft-cap-06-s3-focused-validation.yml');
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /RUN_MCFT_CAP_06_S3_PERSISTENCE\.cjs/);
  assert.match(workflow, /ACCEPTANCE_MCFT_CAP_06_S3_PERSISTENCE\.cjs/);
  assertNoPattern(workflow, /github\.head_ref\s*==/, 'S3_FOCUSED_REGRESSION_BRANCH_LOCK_FORBIDDEN');

  const migration = read('apps/server/db/migrations/2026_07_17_mcft_cap_06_calibration_governance_persistence.sql');
  for (const token of [
    'D_CALIBRATION_CANDIDATE',
    'D_SHADOW_EVALUATION',
    'twin_calibration_candidate_projection_v1',
    'twin_shadow_evaluation_projection_v1',
    'twin_candidate_evaluation_index_v1',
    'twin_shadow_evaluation_case_projection_v1',
    'enforce_mcft_cap06_projection_canonicality_v1',
    'trg_twin_calibration_candidate_projection_canonicality_v1',
    'trg_twin_shadow_evaluation_projection_canonicality_v1',
    'trg_twin_candidate_evaluation_index_canonicality_v1',
    'trg_twin_shadow_evaluation_case_projection_canonicality_v1',
    'public.facts remains the sole canonical store',
  ]) assert.match(migration, new RegExp(token));
  assert.match(migration, /PRIMARY KEY \(candidate_ref, evaluation_object_id\)/);
  assert.match(migration, /UNIQUE \(\s*candidate_ref,\s*evaluation_dataset_hash,\s*evaluation_policy_hash,\s*shadow_replay_engine_id,\s*calibration_metric_numeric_policy_hash\s*\)/s);
  assertNoPattern(migration, /UNIQUE\s*\(\s*candidate_ref\s*\)/i, 'S3_CANDIDATE_REF_ALONE_UNIQUE_FORBIDDEN');
  assertNoPattern(migration, /CREATE\s+TABLE[^;]*active[_-]?config/is, 'S3_ACTIVE_CONFIG_TABLE_FORBIDDEN');
  assertNoPattern(migration, /twin_model_activation_v1/i, 'S3_MODEL_ACTIVATION_SCHEMA_FORBIDDEN');

  const adapter = read('apps/server/src/persistence/calibration/postgres_exact_calibration_residual_repository_v1.ts');
  assert.match(adapter, /loadExactCalibrationResiduals/);
  assert.match(adapter, /record_json->'payload'->>'object_id'=ANY\(\$1::text\[\]\)/);
  assert.match(adapter, /record_json->>'type'='twin_forecast_residual_v1'/);
  for (const forbidden of [
    /listResiduals/,
    /searchResiduals/,
    /latestResiduals/,
    /loadResidualsAfter/,
    /query by time range/i,
    /query by scope range/i,
  ]) assertNoPattern(adapter.replace(/\/\/ Boundary:[^\n]*/g, ''), forbidden, `S3_EXACT_ADAPTER_FORBIDDEN_SURFACE:${forbidden}`);
  assertNoPattern(adapter, /WHERE[^;]*(occurred_at|logical_time|as_of)\s*(>|<|BETWEEN)/is, 'S3_EXACT_ADAPTER_RANGE_SQL_FORBIDDEN');

  const repository = read('apps/server/src/persistence/calibration/postgres_calibration_governance_repository_v1.ts');
  for (const token of [
    'D_CALIBRATION_CANDIDATE',
    'D_SHADOW_EVALUATION',
    'pg_advisory_xact_lock',
    'INSERT INTO facts',
    'EXISTING_IDEMPOTENT_SUCCESS',
    'EXISTING_RECOVERED',
    'CAP06_IDEMPOTENCY_CONFLICT',
    'CAP06_CANDIDATE_PROJECTION_DIVERGENCE',
    'CAP06_EVALUATION_PROJECTION_DIVERGENCE',
    'rebuildFromFacts',
  ]) assert.match(repository, new RegExp(token));
  assertNoPattern(repository, /twin_model_activation_v1/, 'S3_MODEL_ACTIVATION_SOURCE_FORBIDDEN');
  assertNoPattern(repository, /(INSERT|UPDATE|DELETE)[^;]*active[_-]?config/is, 'S3_ACTIVE_CONFIG_MUTATION_FORBIDDEN');
  assertNoPattern(repository, /INSERT INTO[^;]*(twin_state|checkpoint)/is, 'S3_STATE_CHECKPOINT_MUTATION_FORBIDDEN');

  const runtimeAcceptance = read('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_PERSISTENCE_DB.ts');
  for (const token of [
    'PostgresExactCalibrationResidualRepositoryV1',
    'PostgresCalibrationGovernanceRepositoryV1',
    'concurrent same-key same-hash Candidate',
    'one Candidate indexes zero-to-many Evaluations',
    'guard loss recovers',
    'projection loss is repaired',
    'surviving corrupt Candidate projection fails closed',
    'facts-based rebuild restores',
    'canonical object-id divergence fails closed',
  ]) assert.match(runtimeAcceptance, new RegExp(token));

  const canonicalityAcceptance = read('scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S3_PROJECTION_CANONICALITY_DB.ts');
  for (const token of [
    'all four CAP-06 canonicality triggers are installed',
    'direct Candidate semantic projection mutation is rejected',
    'direct Evaluation semantic projection mutation is rejected',
    'direct Candidate-to-Evaluation index mutation is rejected',
    'direct embedded-case projection mutation is rejected',
    'MCFT_CAP_06_S3_PROJECTION_CANONICALITY_DB:PASS',
  ]) assert.match(canonicalityAcceptance, new RegExp(token));

  const runner = read('scripts/runtime_acceptance/RUN_MCFT_CAP_06_S3_PERSISTENCE.cjs');
  assert.match(runner, /mcft_cap06_s3_persistence_ci/);
  assert.match(runner, /MCFT_CAP_06_S3_DESTRUCTIVE_ACCEPTANCE/);
  assert.match(runner, /ACCEPTANCE_MCFT_CAP_06_S3_PERSISTENCE_DB\.ts/);
  assert.match(runner, /ACCEPTANCE_MCFT_CAP_06_S3_PROJECTION_CANONICALITY_DB\.ts/);
  assert.match(runner, /DROP DATABASE IF EXISTS/);

  console.log(`PASS MCFT-CAP-06 S3 governance gate; implementation_ref=${implementationRef}; changed_files=${changed.length}; phase=${s3Effective ? 'EFFECTIVE' : 'CANDIDATE'}`);
}

main();
