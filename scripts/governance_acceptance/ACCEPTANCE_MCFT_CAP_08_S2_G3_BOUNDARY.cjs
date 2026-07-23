#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S2_G3_BOUNDARY_RESULT.json');
const BASE = String(process.env.MCFT_BASE_SHA || '').trim();
const HISTORICAL_BASE = '2a04103febcc39036a34193b46a0feb879d686e4';
const G3_MERGE = '65b0d8fc3f73c0b343146e5b616cb439ad972149';
const STATUS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-DELIVERY-STATUS-V1.json';
const GATES = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-PRE-CANDIDATE-ENTRY-GATES-V1.json';
const WORKFLOW = '.github/workflows/mcft-cap-08-s2-g3-completion-authority.yml';
const BOUNDARY = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S2_G3_BOUNDARY.cjs';
const CORE = [
  'apps/server/src/domain/twin_runtime/cap08_completion_authority_contracts_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_completion_authority_repository_v1.ts',
  'apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_completion_authority_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s1_base_range_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s1_base_runtime_service_v1.ts',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S2_COMPLETION_AUTHORITY_NEGATIVE_DB.ts',
  'scripts/runtime_acceptance/mcft_cap08_s2_g3_acceptance_support_v1.ts',
  'scripts/runtime_acceptance/mcft_cap08_s2_g3_negative_cases_v1.ts',
].sort();
const EXPECTED = [WORKFLOW, BOUNDARY, STATUS, GATES, ...CORE].sort();

function git(args) { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function read(relative) { return fs.readFileSync(path.join(ROOT, relative), 'utf8'); }
function json(relative) { return JSON.parse(read(relative)); }
function files(base, head) {
  const raw = git(['diff', '--name-only', `${base}...${head}`]);
  return raw ? raw.split(/\r?\n/).filter(Boolean).sort() : [];
}
function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}
function validateContractState(status, gates) {
  assert.ok(['IMPLEMENTED', 'IMPLEMENTED_PRESENT_ON_MAIN'].includes(status.g3_implementation_state));
  assert.ok(['PASS_REQUIRED_ON_EXACT_HEAD', 'PASS_ON_EXACT_HEAD'].includes(status.g3_database_acceptance_state));
  assert.equal(status.g3_negative_database_matrix, 'N1_N14');
  assert.equal(status.production_runtime_source_authorized, false);
  assert.equal(status.decision_action_feedback_authorized, false);
  assert.equal(status.mcft_cap_09_authorized, false);
  assert.equal(gates.production_runtime_source_authorized, false);
  assert.equal(gates.mcft_cap_09_authorized, false);
  assert.equal(gates.completion_authority_contract.implementation_state, 'IMPLEMENTED');
  assert.equal(gates.completion_authority_contract.formal_candidate_creation_authorized, true);
  const matrix = gates.completion_authority_contract.negative_database_matrix;
  assert.equal(matrix.length, 14);
  assert.deepEqual(matrix.map((entry) => entry.case_id), Array.from({ length: 14 }, (_, index) => `N${index + 1}`));
  assert.equal(matrix.find((entry) => entry.case_id === 'N8').expected_error, 'CAP08_COMPLETION_CONTRACT_DIGEST_MISMATCH');
  assert.equal(matrix.find((entry) => entry.case_id === 'N9').expected_error, 'CAP08_COMPLETION_SOURCE_DIGEST_MISMATCH');
  assert.equal(matrix.find((entry) => entry.case_id === 'N10').expected_error, 'CAP08_COMPLETION_CONTRACT_DIGEST_MISMATCH');
}

try {
  assert.match(BASE, /^[0-9a-f]{40}$/, 'MCFT_BASE_SHA_REQUIRED');
  const head = git(['rev-parse', 'HEAD']);
  assert.equal(git(['merge-base', BASE, head]), BASE, 'G3_BASE_NOT_ANCESTOR');
  assert.equal(git(['diff', '--check', `${BASE}...${head}`]), '', 'G3_DIFF_CHECK_FAILED');
  const changed = files(BASE, head);
  const status = json(STATUS);
  const gates = json(GATES);
  validateContractState(status, gates);

  let classification;
  let runDestructiveDb;
  let frozenCore = [];
  if (BASE === HISTORICAL_BASE) {
    assert.equal(Number(git(['rev-list', '--count', `${BASE}..${head}`])), 1, 'G3_CANDIDATE_COMMIT_COUNT_MUST_BE_ONE');
    assert.deepEqual(changed, EXPECTED, 'G3_CHANGED_FILE_BOUNDARY_MISMATCH');
    assert.equal(status.s2_candidate_implemented, false);
    assert.equal(status.independent_review_satisfied, false);
    classification = 'EXACT_G3_CANDIDATE';
    runDestructiveDb = true;
  } else {
    git(['merge-base', '--is-ancestor', G3_MERGE, BASE]);
    git(['merge-base', '--is-ancestor', G3_MERGE, head]);
    frozenCore = CORE.map((file) => ({
      file,
      merge_blob: git(['rev-parse', `${G3_MERGE}:${file}`]),
      head_blob: git(['rev-parse', `HEAD:${file}`]),
    }));
    assert.deepEqual(frozenCore.filter((entry) => entry.merge_blob !== entry.head_blob), [], 'G3_CORE_REGRESSION');
    assert.equal(changed.some((file) => CORE.includes(file)), false, 'G3_CORE_CHANGE_REQUIRES_NEW_EXACT_GATE');
    classification = 'SUCCESSOR_REGRESSION_MODE';
    runDestructiveDb = false;
  }

  const workflow = read(WORKFLOW);
  assert.doesNotMatch(workflow, /^\s*workflow_dispatch\s*:/m);
  assert.match(workflow, /id:\s*classify/);
  assert.match(workflow, /run_destructive_db/);
  assert.match(workflow, /steps\.classify\.outputs\.run_destructive_db == 'true'/);
  assert.match(workflow, /ACCEPTANCE_MCFT_CAP_08_S2_G3_BOUNDARY\.cjs/);
  assert.match(workflow, /ACCEPTANCE_MCFT_CAP_08_S2_COMPLETION_AUTHORITY_NEGATIVE_DB\.ts/);

  const result = {
    schema_version: 'geox_mcft_cap08_s2_g3_boundary_result_v2',
    status: 'PASS',
    classification,
    run_destructive_db: runDestructiveDb,
    base_sha: BASE,
    candidate_sha: head,
    changed_file_count: changed.length,
    changed_files: changed,
    g3_merge: G3_MERGE,
    frozen_core_file_count: frozenCore.length,
    frozen_core_mismatches: frozenCore.filter((entry) => entry.merge_blob !== entry.head_blob),
    g3_implementation_state: status.g3_implementation_state,
    g3_database_acceptance_state: status.g3_database_acceptance_state,
    negative_matrix: 'N1_N14',
    s2_candidate_implemented: status.s2_candidate_implemented,
    production_runtime_source_authorized: false,
    s3_authorized: false,
  };
  write(result);
  console.log(JSON.stringify(result));
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap08_s2_g3_boundary_result_v2',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
