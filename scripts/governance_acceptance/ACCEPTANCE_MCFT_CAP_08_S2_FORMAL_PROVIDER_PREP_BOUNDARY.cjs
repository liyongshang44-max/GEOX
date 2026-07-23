#!/usr/bin/env node
'use strict';

// Purpose: enforce the exact non-candidate seven-file boundary for MCFT-CAP-08.S2 formal provider preparation.
// Boundary: this gate must preserve S2 status=false, independent review=false, the S1 phase-engine contract, and all later-Slice/production nonclaims.

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S2_FORMAL_PROVIDER_PREP_BOUNDARY_RESULT.json');
const EXPECTED_BASE = '65b0d8fc3f73c0b343146e5b616cb439ad972149';
const STATUS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-DELIVERY-STATUS-V1.json';
const PHASE_CONTRACT = 'apps/server/src/domain/twin_runtime/cap08_phase_engine_contracts_v1.ts';
const EXPECTED = [
  '.github/workflows/mcft-cap-08-s2-formal-provider-preparation.yml',
  'apps/server/src/domain/twin_runtime/cap08_s2_formal_provider_contracts_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s2_formal_provider_qualification_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s2_qualified_evidence_source_v1.ts',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S2_FORMAL_PROVIDER_PREP_BOUNDARY.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S2_FORMAL_PROVIDERS_DB.ts',
  'scripts/runtime_acceptance/mcft_cap08_s2_formal_provider_fixture_v1.ts',
].sort();

function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}
function readJson(relative) {
  return JSON.parse(read(relative));
}
function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}

try {
  const base = String(process.env.MCFT_BASE_SHA || '').trim();
  assert.match(base, /^[0-9a-f]{40}$/, 'MCFT_BASE_SHA_INVALID');
  assert.equal(base, EXPECTED_BASE, 'CAP08_S2_PREPARATION_BASE_DRIFT');
  assert.equal(git(['merge-base', base, 'HEAD']), base, 'CAP08_S2_PREPARATION_BASE_NOT_ANCESTOR');
  assert.equal(Number(git(['rev-list', '--count', `${base}..HEAD`])), 1, 'CAP08_S2_PREPARATION_ONE_COMMIT_REQUIRED');

  const raw = git(['diff', '--name-only', `${base}...HEAD`]);
  const actual = raw ? raw.split(/\r?\n/).filter(Boolean).sort() : [];
  assert.deepEqual(actual, EXPECTED, 'CAP08_S2_PREPARATION_EXACT_FILE_SET');

  const forbidden = actual.filter((file) => file.startsWith('apps/web/')
    || file.startsWith('apps/server/src/routes/')
    || file.startsWith('apps/server/db/migrations/')
    || file.startsWith('docker/postgres/init/')
    || file.includes('scheduler')
    || file.includes('model_activation'));
  assert.deepEqual(forbidden, [], 'CAP08_S2_PREPARATION_FORBIDDEN_SURFACE');

  const status = readJson(STATUS);
  assert.equal(status.slice_id, 'MCFT-CAP-08.S2');
  assert.equal(status.record_status, 'G3_COMPLETION_AUTHORITY_IMPLEMENTED_CANDIDATE');
  assert.equal(status.s2_candidate_implemented, false);
  assert.equal(status.independent_review_satisfied, false);
  assert.equal(status.independent_review_deferred, true);
  assert.equal(status.formal_candidate_creation_authorized, true);
  assert.equal(status.production_runtime_source_authorized, false);
  assert.equal(status.mcft_cap_09_authorized, false);

  assert.equal(git(['diff', '--name-only', `${base}...HEAD`, '--', STATUS]), '', 'CAP08_S2_STATUS_MUTATION_FORBIDDEN');
  assert.equal(git(['diff', '--name-only', `${base}...HEAD`, '--', PHASE_CONTRACT]), '', 'CAP08_PHASE_ENGINE_CONTRACT_MUTATION_FORBIDDEN');
  assert.equal(
    git(['show', `${base}:${PHASE_CONTRACT}`]),
    git(['show', `HEAD:${PHASE_CONTRACT}`]),
    'CAP08_PHASE_ENGINE_CONTRACT_BYTES_DRIFT',
  );

  const contract = read('apps/server/src/domain/twin_runtime/cap08_s2_formal_provider_contracts_v1.ts');
  assert.match(contract, /CAP08_S2_SELECTED_STATE_TICK_INDEXES_V1 = \[2, 3, 4, 10, 22\]/);
  assert.match(contract, /late_state_correction_owner: "MCFT-CAP-08\.S4"/);
  assert.match(contract, /residual_persistence_owner: "MCFT-CAP-08\.S5"/);
  assert.match(contract, /decision_action_feedback_owner: "MCFT-CAP-08\.S3"/);
  assert.match(contract, /production_runtime_source_authorized: false/);

  const evidence = read('apps/server/src/runtime/twin_runtime/cap08_s2_qualified_evidence_source_v1.ts');
  assert.match(evidence, /CAP08_S2_EVIDENCE_FUTURE_LEAKAGE/);
  assert.match(evidence, /quarantined_residual_only_ids/);
  assert.match(evidence, /quarantined_late_state_correction_ids/);
  assert.match(evidence, /observed_but_not_available_ids_confirmed_absent/);

  const qualification = read('apps/server/src/runtime/twin_runtime/cap08_s2_formal_provider_qualification_service_v1.ts');
  assert.match(qualification, /CAP08_S2_LATE_CORRECTION_APPLIED_BEFORE_S4/);
  assert.match(qualification, /CAP08_S2_PHASE_ENGINE_CONTRACT_DRIFT/);
  assert.match(qualification, /quarantinedResidualOnlyCount !== 17/);
  assert.match(qualification, /observedNotAvailableWitnessCount !== 15/);

  const workflow = read('.github/workflows/mcft-cap-08-s2-formal-provider-preparation.yml');
  assert.match(workflow, /^name: mcft-cap-08-s2-formal-provider-preparation/m);
  assert.doesNotMatch(workflow, /\n\s*workflow_dispatch\s*:/);
  assert.match(workflow, /ACCEPTANCE_MCFT_CAP_08_S2_FORMAL_PROVIDERS_DB\.ts/);
  assert.match(workflow, /MCFT_CAP08_S2_FORMAL_PROVIDER_DESTRUCTIVE_ACCEPTANCE: '1'/);

  const declarationMarker = ['MCFT', 'CANDIDATE', 'DECLARATION', 'V2'].join('_');
  for (const file of actual) {
    assert.equal(read(file).includes(declarationMarker), false, `CAP08_S2_PREPARATION_CANDIDATE_DECLARATION_FORBIDDEN:${file}`);
  }

  const result = {
    schema_version: 'geox_mcft_cap08_s2_formal_provider_prep_boundary_result_v1',
    status: 'PASS',
    base_sha: base,
    candidate_sha: git(['rev-parse', 'HEAD']),
    commit_count: 1,
    changed_file_count: actual.length,
    changed_files: actual,
    preparation_only: true,
    status_file_mutated: false,
    s2_candidate_implemented: false,
    independent_review_satisfied: false,
    formal_candidate_created: false,
    phase_engine_contract_preserved: true,
    production_runtime_source_authorized: false,
    s3_authorized: false,
  };
  write(result);
  console.log(JSON.stringify(result));
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap08_s2_formal_provider_prep_boundary_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;
}
