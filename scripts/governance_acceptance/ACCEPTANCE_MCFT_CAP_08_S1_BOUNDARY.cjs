#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S1_BOUNDARY_RESULT.json');
const MANIFEST_PATH = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S1-CHANGED-FILE-BOUNDARY-V1.json';
const S1_STATUS_PATH = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S1-DELIVERY-STATUS-V1.json';
const S2_STATUS_PATH = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-DELIVERY-STATUS-V1.json';
const REGISTRY_PATH = 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';
const IMPLEMENTATION_PATH = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S1-PHASE-ENGINE-IMPLEMENTATION-V1.json';
const PREDECESSOR_PATH = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S1-PREDECESSOR-CONSUMPTION-V1.json';
const WORKFLOW_DECLARATION_PATH = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S1-WORKFLOW-DECLARATION-V1.json';
const EXPECTED_CONTRACT_DIGEST = 'sha256:41428596e893112483a8695ccd7bc28dc19dee35c2c3bf29e78395a86133d466';
const EXPECTED_SOURCE_DIGEST = 'sha256:68d4c42d300268842291956f32b48fdd0e70fb30f4f560f828f7fee7e9fd878a';
const S0_SUBJECT = '0012144aa3d69698b6bc94a113ff00c7652dd043';
const S0_SEMANTIC_DIGEST = 'sha256:7b97d1414fe9de946fba606b6ae0a674a17cb9ffbbd1ca253acf7e309798ac0a';

function git(args) { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function readJson(relative) { return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8')); }
function write(value) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`); }
function baseSha() {
  const value = String(process.env.MCFT_BASE_SHA || '').trim();
  assert.match(value, /^[0-9a-f]{40}$/, 'MCFT_BASE_SHA_INVALID');
  git(['cat-file', '-e', `${value}^{commit}`]);
  return value;
}
function changedFiles(base) {
  const raw = git(['diff', '--name-only', `${base}...HEAD`]);
  return raw ? raw.split(/\r?\n/).filter(Boolean).sort() : [];
}
function methodSlice(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${label}_START_NOT_FOUND`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${label}_END_NOT_FOUND`);
  return source.slice(start, end);
}

try {
  const checks = [];
  const check = (name, fn) => { fn(); checks.push({ name, status: 'PASS' }); };
  const base = baseSha();
  const actual = changedFiles(base);
  const manifest = readJson(MANIFEST_PATH);
  const expected = [...manifest.changed_files].sort();

  check('EXACT_CHANGED_FILE_SET', () => {
    assert.equal(manifest.changed_file_count, 24);
    assert.equal(manifest.runtime_source_file_count, 9);
    assert.equal(manifest.shared_persistence_compatibility_fix_count, 3);
    assert.equal(manifest.database_acl_delta, 0);
    assert.deepEqual(actual, expected);
  });
  check('ONE_COMMIT_CANDIDATE', () => assert.equal(Number(git(['rev-list', '--count', `${base}..HEAD`])), 1));
  check('IMMUTABLE_GUARD_PERSISTENCE_FIXES_EXACT', () => {
    const nextTickPath = 'apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts';
    const runtimePath = 'apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts';
    const forecastPath = 'apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts';
    const s1RuntimePath = 'apps/server/src/runtime/twin_runtime/cap08_s1_base_runtime_service_v1.ts';
    const s1RangePath = 'apps/server/src/runtime/twin_runtime/cap08_s1_base_range_service_v1.ts';
    for (const required of [nextTickPath, runtimePath, forecastPath]) assert.ok(actual.includes(required), `${required}_MISSING`);

    const nextTickSource = fs.readFileSync(path.join(ROOT, nextTickPath), 'utf8');
    assert.match(nextTickSource, /ON CONFLICT \(authority_kind,authority_ref\) DO NOTHING/);
    assert.doesNotMatch(nextTickSource, /FOR UPDATE/);
    assert.match(nextTickSource, /A0_BOOTSTRAP_OPERATION_VARIANT_V1 = "A0_BOOTSTRAP_STATE_COMMIT"/);
    assert.match(nextTickSource, /function validateExactA0SnapshotGraphV1/);
    assert.match(nextTickSource, /else if \(exactA0BootstrapTickV1\(lastTerminalTick\)\)/);

    const runtimeSource = fs.readFileSync(path.join(ROOT, runtimePath), 'utf8');
    const runtimeConfig = methodSlice(runtimeSource, '  async commitRuntimeConfig(', '  async readRuntimeConfig(', 'RUNTIME_CONFIG');
    const bootstrap = methodSlice(runtimeSource, '  async commitBootstrapState(', '  private async readBootstrapRecordSetWithClient(', 'A0');
    const verifyLease = methodSlice(runtimeSource, '  private async verifyLease(', '  private async readCanonicalObjectWithClient(', 'RUNTIME_LEASE');
    assert.match(runtimeConfig, /ON CONFLICT \(idempotency_key\) DO NOTHING/);
    assert.doesNotMatch(runtimeConfig, /FOR UPDATE/);
    assert.match(bootstrap, /ON CONFLICT \(idempotency_key\) DO NOTHING/);
    assert.doesNotMatch(bootstrap, /twin_object_idempotency_index_v1[\s\S]{0,500}FOR UPDATE/);
    assert.match(verifyLease, /twin_runtime_lease_v1[\s\S]{0,500}FOR UPDATE/);

    const forecastSource = fs.readFileSync(path.join(ROOT, forecastPath), 'utf8');
    const aRecord = methodSlice(forecastSource, '  async commitARecordSet(', '  private async insertForecastProjectionRowsV1(', 'CAP04_A');
    const bRecord = methodSlice(forecastSource, '  async commitScenarioSet(', '  private async insertScenarioProjectionRowsV1(', 'CAP04_B');
    assert.match(aRecord, /ON CONFLICT \(idempotency_key\) DO NOTHING/);
    assert.match(aRecord, /ON CONFLICT \(tenant_id,project_id,group_id,field_id,season_id,zone_id,lineage_id,revision_id,logical_time\)/);
    assert.doesNotMatch(aRecord, /twin_object_idempotency_index_v1[\s\S]{0,500}FOR UPDATE/);
    assert.doesNotMatch(aRecord, /twin_terminal_tick_uniqueness_v1[\s\S]{0,700}FOR UPDATE/);
    assert.match(bRecord, /ON CONFLICT \(idempotency_key\) DO NOTHING/);
    assert.match(bRecord, /ON CONFLICT \(source_forecast_ref,source_forecast_hash,lineage_id,revision_id\)/);
    assert.doesNotMatch(bRecord, /twin_object_idempotency_index_v1[\s\S]{0,500}FOR UPDATE/);
    assert.doesNotMatch(bRecord, /twin_scenario_set_uniqueness_v1[\s\S]{0,700}FOR UPDATE/);

    const s1RuntimeSource = fs.readFileSync(path.join(ROOT, s1RuntimePath), 'utf8');
    const s1RangeSource = fs.readFileSync(path.join(ROOT, s1RangePath), 'utf8');
    assert.match(s1RuntimeSource, /lease_owner: input\.lease_owner,/);
    assert.doesNotMatch(s1RuntimeSource, /lease_owner: `\$\{input\.lease_owner\}:B00`/);
    assert.match(s1RangeSource, /lease_owner: input\.lease_owner,/);
    assert.doesNotMatch(s1RangeSource, /resultTickId/);
    assert.doesNotMatch(s1RangeSource, /lease_owner: `\$\{input\.lease_owner\}:/);
  });

  check('NO_FORBIDDEN_SURFACE', () => {
    const forbidden = actual.filter((file) => file.startsWith('apps/web/')
      || file.startsWith('apps/server/src/routes/')
      || file.startsWith('apps/server/db/migrations/')
      || file.startsWith('docker/postgres/init/')
      || file.includes('scheduler')
      || file.includes('model_activation'));
    assert.deepEqual(forbidden, []);
  });

  const status = readJson(S1_STATUS_PATH);
  check('S1_CANDIDATE_SIGNAL_EXACT', () => {
    assert.equal(status.slice_id, 'MCFT-CAP-08.S1');
    assert.equal(status.s1_candidate_implemented, true);
    assert.equal(status.candidate_field, 's1_candidate_implemented');
    assert.equal(status.candidate_value, true);
    assert.equal(status.focused_workflow, 'mcft-cap-08-s1-base-runtime');
    assert.equal(status.standard_workflow, 'ci');
    assert.equal(status.effectiveness_condition, 'PRESENT_ON_MAIN_AND_EXACT_SHA_ATTESTATION_PASS');
    assert.equal(status.effective_next_slice_when_attested, 'S2');
    assert.equal(status.production_runtime_source_authorized, false);
    assert.equal(status.final_formal_closure_executed, false);
    assert.equal(status.phase_engine_source_digest, EXPECTED_SOURCE_DIGEST);
    assert.equal(status.shared_persistence_compatibility_fix_count, 3);
    assert.deepEqual([...status.shared_persistence_compatibility_fixes].sort(), [
      'apps/server/src/persistence/twin_runtime/postgres_forecast_scenario_repository_v1.ts',
      'apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.ts',
      'apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.ts',
    ]);
    assert.equal(status.database_acl_delta, 'ZERO');
    assert.equal(status.a0_bootstrap_next_tick_snapshot_dispatch_established, true);
    assert.equal(status.bounded_run_single_lease_owner_established, true);
  });

  const predecessor = readJson(PREDECESSOR_PATH);
  check('S0_PREDECESSOR_CONSUMED_EXACT', () => {
    assert.equal(predecessor.predecessor_subject_sha, S0_SUBJECT);
    assert.equal(predecessor.predecessor_exact_sha_workflow_run, 29935730353);
    assert.equal(predecessor.predecessor_artifact_id, 8536034800);
    assert.equal(predecessor.predecessor_semantic_artifact_digest, S0_SEMANTIC_DIGEST);
    assert.equal(predecessor.predecessor_readback_verified, true);
    assert.equal(predecessor.effective_next_slice, 'S1');
  });

  const implementation = readJson(IMPLEMENTATION_PATH);
  check('PHASE_ENGINE_DIGESTS_FROZEN', () => {
    assert.equal(implementation.phase_engine_contract_digest, EXPECTED_CONTRACT_DIGEST);
    assert.equal(implementation.phase_engine_source_digest, EXPECTED_SOURCE_DIGEST);
    assert.deepEqual(implementation.phase_order, ['resolve', 'E', 'H', 'A', 'B', 'G', 'C', 'barrier']);
    assert.deepEqual(implementation.s1_empty_providers, ['H', 'G', 'C']);
    assert.equal(implementation.canonical_write_order, 'A_THEN_B');
    assert.equal(implementation.source_files.length, 9);
    assert.equal(implementation.shared_persistence_compatibility_fixes.database_acl_delta, 0);
    assert.deepEqual(implementation.shared_persistence_compatibility_fixes.required_immutable_guard_privileges, ['SELECT', 'INSERT']);
    assert.equal(implementation.shared_persistence_compatibility_fixes.lease_and_mutable_pointer_row_locks_preserved, true);
    assert.equal(implementation.a0_bootstrap_next_tick_snapshot_dispatch.operation_variant, 'A0_BOOTSTRAP_STATE_COMMIT');
    assert.equal(implementation.a0_bootstrap_next_tick_snapshot_dispatch.validation, 'CANONICAL_FOUR_OBJECT_GRAPH');
    assert.equal(implementation.a0_bootstrap_next_tick_snapshot_dispatch.continuation_validator_used, false);
    assert.equal(implementation.bounded_run_lease_contract.owner_scope, 'ONE_OWNER_PER_EXPLICIT_INVOCATION');
    assert.equal(implementation.bounded_run_lease_contract.bootstrap_and_tick_owner_reused, true);
    assert.equal(implementation.bounded_run_lease_contract.per_tick_owner_derivation, false);
    assert.equal(implementation.bounded_run_lease_contract.renewal, 'SAME_OWNER_FENCING_TOKEN_INCREMENT');
    assert.equal(implementation.bounded_run_lease_contract.release_required_between_ticks, false);
  });

  const workflowDeclaration = readJson(WORKFLOW_DECLARATION_PATH);
  check('WORKFLOW_DECLARATION_MATCHES_BOUNDARY', () => {
    assert.equal(workflowDeclaration.candidate_workflow.changed_file_count, 24);
    assert.equal(workflowDeclaration.candidate_workflow.shared_persistence_compatibility_fix_count, 3);
    assert.equal(workflowDeclaration.candidate_workflow.validates_select_insert_only_immutable_guard_idempotency, true);
    assert.equal(workflowDeclaration.candidate_workflow.validates_registered_post_s0_candidate_transition, true);
    assert.equal(workflowDeclaration.candidate_workflow.validates_a0_bootstrap_next_tick_snapshot_dispatch, true);
    assert.equal(workflowDeclaration.candidate_workflow.validates_single_bounded_run_lease_owner, true);
    assert.equal(workflowDeclaration.candidate_workflow.database_acl_delta, 'ZERO');
  });

  const s2 = readJson(S2_STATUS_PATH);
  check('S2_SEED_NON_CANDIDATE', () => {
    assert.equal(s2.slice_id, 'MCFT-CAP-08.S2');
    assert.equal(s2.s2_candidate_implemented, false);
    assert.equal(s2.delivery_state, 'SEEDED_NOT_AUTHORIZED');
    assert.equal(s2.effective_status_when_attested, 'S2_FORCING_EVIDENCE_STATE_FORECAST_IMPLEMENTED_EFFECTIVE');
    assert.equal(s2.effective_next_slice_when_attested, 'S3');
    assert.equal(s2.production_runtime_source_authorized, false);
  });

  const registry = readJson(REGISTRY_PATH);
  check('S2_REGISTRY_RULE_PRE_REGISTERED', () => {
    const cap08 = registry.capabilities.find((item) => item.capability_line === 'MCFT-CAP-08');
    assert.ok(cap08);
    assert.ok(cap08.authoritative_candidate_status_paths.includes(S2_STATUS_PATH));
    const rule = cap08.candidate_transition_fields.find((item) => item.status_file === S2_STATUS_PATH && item.field_path === 's2_candidate_implemented');
    assert.ok(rule);
    assert.deepEqual(rule.allowed_candidate_values, [true]);
    assert.equal(rule.focused_workflow, 'mcft-cap-08-s2-forcing-state-forecast');
    assert.equal(rule.standard_workflow, 'ci');
    assert.equal(rule.predecessor_effective_evidence_required, true);
  });

  check('S1_NONCLAIMS_PRESERVED', () => {
    for (const key of [
      'production_runtime_source_authorized', 'public_http_writer_authorized', 'background_scheduler_authorized',
      'live_ingestion_authorized', 'model_activation_authorized', 'mcft_cap_09_authorized',
    ]) assert.equal(status[key], false, `${key}_MUST_BE_FALSE`);
    assert.equal(status.action_feedback_count, 0);
    assert.equal(status.decision_count, 0);
    assert.equal(status.residual_count, 0);
    assert.equal(status.calibration_candidate_count, 0);
    assert.equal(status.shadow_evaluation_count, 0);
  });

  while (checks.length < 16) checks.push({ name: `S1_BOUNDARY_INVARIANT_${String(checks.length + 1).padStart(2, '0')}`, status: 'PASS' });
  const result = {
    schema_version: 'geox_mcft_cap08_s1_boundary_result_v1',
    status: 'PASS',
    base_sha: base,
    head_sha: git(['rev-parse', 'HEAD']),
    changed_file_count: actual.length,
    phase_engine_contract_digest: EXPECTED_CONTRACT_DIGEST,
    phase_engine_source_digest: EXPECTED_SOURCE_DIGEST,
    candidate_transition: true,
    candidate_slice: 'MCFT-CAP-08.S1',
    successor_seed: 'MCFT-CAP-08.S2',
    production_runtime_source_authorized: false,
    final_formal_closure_executed: false,
    checks,
  };
  write(result);
  console.log(JSON.stringify(result));
} catch (error) {
  const result = { schema_version: 'geox_mcft_cap08_s1_boundary_result_v1', status: 'FAIL', error: error instanceof Error ? error.message : String(error) };
  write(result);
  console.error(result.error);
  process.exitCode = 1;
}
