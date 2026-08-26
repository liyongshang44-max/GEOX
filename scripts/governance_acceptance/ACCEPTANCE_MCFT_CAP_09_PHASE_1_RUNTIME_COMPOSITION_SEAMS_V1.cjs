#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '26c1383f7f45abb76c99e28ec3d06714e85d1b2c';
const ARCHITECTURE_FREEZE_SHA = '2f7a065cc95e4a5a2c95411fb381fe5e4479d645';
const FROZEN_V13_SHA = '3bbf096ee5cb73e8e0e0251dc400733d6cab501f';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_PHASE_1_RUNTIME_COMPOSITION_SEAMS_V1_RESULT.json');

const PATHS = Object.freeze({
  service: 'apps/server/src/runtime/twin_runtime/cap08_s4_append_forward_service_v1.ts',
  resolver: 'apps/server/src/runtime/twin_runtime/cap08_s4_t17_corrected_predecessor_resolver_v1.ts',
  boundary: 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PHASE-1-CANONICAL-RUNTIME-COMPOSITION-BOUNDARY-V1.json',
  acceptance: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE_1_RUNTIME_COMPOSITION_SEAMS_V1.cjs',
  workflow: '.github/workflows/mcft-cap-09-phase-1-runtime-composition-seams-v1.yml',
});

const HISTORICAL_PATHS = Object.freeze([
  'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_loader_v1.cjs',
  'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_chain_v1.cjs',
  'scripts/runtime_acceptance/mcft_cap08_s6_run_a_qualification_ports_v2/qualification_product_chain_v2.cjs',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_QUALIFICATION_V2_RESOLVER_SEAM_CORRECTION.cjs',
  '.github/workflows/mcft-cap-08-s6-run-a-qualification-v2-resolver-seam-correction.yml',
]);

function git(...args) {
  return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function baseText(relative) {
  return childProcess.execFileSync('git', ['show', `${BASE}:${relative}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function bodyFrom(source, marker, code) {
  const index = source.indexOf(marker);
  assert.notEqual(index, -1, code);
  return source.slice(index);
}

function write(result) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
}

try {
  assert.equal(git('merge-base', BASE, 'HEAD'), BASE, 'PHASE1_BASE_MUST_BE_ANCESTOR');
  assert.equal(git('diff', '--check', `${BASE}...HEAD`), '', 'PHASE1_DIFF_CHECK');

  const changed = git('diff', '--name-only', `${BASE}...HEAD`)
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  const expectedChanged = Object.values(PATHS).sort();
  assert.deepEqual(changed, expectedChanged, 'PHASE1_FIRST_STEP_CHANGED_PATH_SET');

  const boundary = JSON.parse(read(PATHS.boundary));
  assert.equal(boundary.schema_version, 'geox_mcft_cap09_phase_1_canonical_runtime_composition_boundary_v1');
  assert.equal(boundary.record_status, 'PHASE_1_IN_PROGRESS');
  assert.equal(boundary.protected_main_baseline, BASE);
  assert.equal(boundary.production_hosting_architecture_freeze.commit_sha, ARCHITECTURE_FREEZE_SHA);
  assert.equal(boundary.frozen_v13_predecessor.exact_head_sha, FROZEN_V13_SHA);
  assert.equal(boundary.historical_authorities_reopened, false);
  assert.equal(boundary.phase_1_complete, false);
  assert.equal(boundary.phase_2_authorized, false);
  for (const key of [
    'runtime_activation',
    'production_workflow_activation',
    'provider_request',
    'formal_database_mutation',
    'formal_v5_armed',
    'formal_o00_started',
    'graduation_effect',
    'mcft_cap09_completed',
  ]) assert.equal(boundary[key], false, `PHASE1_NON_EFFECT:${key}`);

  for (const historicalPath of HISTORICAL_PATHS) {
    assert.equal(
      git('rev-parse', `HEAD:${historicalPath}`),
      git('rev-parse', `${BASE}:${historicalPath}`),
      `HISTORICAL_CAP08_BLOB_MUST_REMAIN_FROZEN:${historicalPath}`,
    );
  }

  const currentService = read(PATHS.service);
  const baselineService = baseText(PATHS.service);
  const currentResolver = read(PATHS.resolver);
  const baselineResolver = baseText(PATHS.resolver);

  assert.equal(
    bodyFrom(currentService, '  async execute(', 'CURRENT_S4_EXECUTE_BODY_REQUIRED'),
    bodyFrom(baselineService, '  async execute(', 'BASE_S4_EXECUTE_BODY_REQUIRED'),
    'CAP08_S4_EXECUTE_BODY_MUST_BE_BYTE_IDENTICAL_TO_BASELINE',
  );
  assert.equal(
    bodyFrom(currentResolver, '  async resolve(', 'CURRENT_T17_RESOLVE_BODY_REQUIRED'),
    bodyFrom(baselineResolver, '  async resolve(', 'BASE_T17_RESOLVE_BODY_REQUIRED'),
    'CAP08_T17_RESOLVE_BODY_MUST_BE_BYTE_IDENTICAL_TO_BASELINE',
  );

  for (const token of [
    'export type Cap08S4AppendForwardDependenciesV1',
    'dependencies: Cap08S4AppendForwardDependenciesV1 = {}',
    'dependencies.chain_reader ?? new Cap08S4PersistedChainReaderV1(pool)',
    'dependencies.repository || dependencies.resolver',
    'new Cap08S4T17CorrectedPredecessorResolverV1(pool, this.repository)',
    'new Cap08S4T17CorrectedPredecessorResolverV1(pool);',
  ]) assert.ok(currentService.includes(token), `SERVICE_COMPOSITION_TOKEN:${token}`);

  for (const token of [
    'export type Cap08S4AppendForwardInspectRepositoryPortV1',
    'repository?: Cap08S4AppendForwardInspectRepositoryPortV1',
    'repository ?? new PostgresCap08S4AppendForwardRepositoryV1(pool)',
  ]) assert.ok(currentResolver.includes(token), `RESOLVER_COMPOSITION_TOKEN:${token}`);

  assert.ok(
    baselineService.includes('constructor(\n    pool: Pool,\n    private readonly evidenceSource: ReplayEvidenceSourcePortV1,\n  )'),
    'BASELINE_TWO_ARGUMENT_SERVICE_CONSTRUCTOR_REQUIRED',
  );
  assert.ok(
    currentService.includes('// Preserve the historical two-argument composition exactly.'),
    'HISTORICAL_DEFAULT_TOPOLOGY_GUARD_REQUIRED',
  );

  const result = {
    schema_version: 'geox_mcft_cap09_phase_1_runtime_composition_seams_result_v1',
    status: 'PASS',
    subject_sha: git('rev-parse', 'HEAD'),
    base_sha: BASE,
    architecture_freeze_sha: ARCHITECTURE_FREEZE_SHA,
    frozen_v13_sha: FROZEN_V13_SHA,
    changed_file_count: changed.length,
    historical_cap08_blob_count_verified: HISTORICAL_PATHS.length,
    cap08_s4_execute_body_byte_identical: true,
    cap08_t17_resolve_body_byte_identical: true,
    explicit_chain_reader_injection_available: true,
    explicit_repository_injection_available: true,
    explicit_resolver_injection_available: true,
    historical_two_argument_composition_preserved: true,
    phase_1_complete: false,
    phase_2_authorized: false,
    runtime_activation: false,
    production_workflow_activation: false,
    provider_request: false,
    formal_database_mutation: false,
    formal_v5_armed: false,
    formal_o00_started: false,
    graduation_effect: false,
    mcft_cap09_completed: false,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_phase_1_runtime_composition_seams_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.stack || error.message : String(error),
  };
  write(result);
  console.error(error);
  process.exitCode = 1;
}
