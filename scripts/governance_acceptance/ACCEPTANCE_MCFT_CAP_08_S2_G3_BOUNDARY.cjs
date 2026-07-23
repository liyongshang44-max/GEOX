#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASE = String(process.env.MCFT_BASE_SHA || '').trim();
const STATUS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-DELIVERY-STATUS-V1.json';
const GATES = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S2-PRE-CANDIDATE-ENTRY-GATES-V1.json';
const WORKFLOW = '.github/workflows/mcft-cap-08-s2-g3-completion-authority.yml';
const EXPECTED = [
  WORKFLOW,
  'apps/server/src/domain/twin_runtime/cap08_completion_authority_contracts_v1.ts',
  'apps/server/src/persistence/twin_runtime/postgres_completion_authority_repository_v1.ts',
  'apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_completion_authority_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s1_base_range_service_v1.ts',
  'apps/server/src/runtime/twin_runtime/cap08_s1_base_runtime_service_v1.ts',
  GATES,
  STATUS,
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S2_G3_BOUNDARY.cjs',
  'scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S2_COMPLETION_AUTHORITY_NEGATIVE_DB.ts',
  'scripts/runtime_acceptance/mcft_cap08_s2_g3_acceptance_support_v1.ts',
  'scripts/runtime_acceptance/mcft_cap08_s2_g3_negative_cases_v1.ts',
].sort();

function git(args) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}
function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

assert.match(BASE, /^[0-9a-f]{40}$/, 'MCFT_BASE_SHA_REQUIRED');
const head = git(['rev-parse', 'HEAD']);
assert.equal(git(['merge-base', BASE, head]), BASE, 'G3_BASE_NOT_ANCESTOR');
assert.equal(Number(git(['rev-list', '--count', `${BASE}..${head}`])), 1, 'G3_CANDIDATE_COMMIT_COUNT_MUST_BE_ONE');
const changedRaw = git(['diff', '--name-only', `${BASE}...${head}`]);
const changed = changedRaw ? changedRaw.split(/\r?\n/).filter(Boolean).sort() : [];
assert.deepEqual(changed, EXPECTED, 'G3_CHANGED_FILE_BOUNDARY_MISMATCH');
assert.equal(git(['diff', '--check', `${BASE}...${head}`]), '', 'G3_DIFF_CHECK_FAILED');

for (const file of changed) {
  assert.ok(!file.startsWith('docker/postgres/'), `G3_BUSINESS_DDL_FORBIDDEN:${file}`);
  assert.ok(!file.includes('/routes/'), `G3_ROUTE_CHANGE_FORBIDDEN:${file}`);
  assert.ok(!file.includes('/web/'), `G3_WEB_CHANGE_FORBIDDEN:${file}`);
  assert.ok(!file.includes('scheduler'), `G3_SCHEDULER_CHANGE_FORBIDDEN:${file}`);
}

const status = readJson(STATUS);
assert.equal(status.s2_candidate_implemented, false);
assert.equal(status.record_status, 'G3_COMPLETION_AUTHORITY_IMPLEMENTED_CANDIDATE');
assert.equal(status.g1_state, 'PASS_PRESENT_ON_MAIN');
assert.equal(status.g2_state, 'PASS_PRESENT_ON_MAIN');
assert.equal(status.g3_implementation_state, 'IMPLEMENTED');
assert.equal(status.g3_database_acceptance_state, 'PASS_REQUIRED_ON_EXACT_HEAD');
assert.equal(status.g3_negative_database_matrix, 'N1_N14');
assert.equal(status.formal_candidate_creation_authorized, true);
assert.equal(status.independent_review_satisfied, false);
assert.equal(status.independent_review_deferred, true);
assert.equal(status.independent_review_required_before_formal_s2_candidate, true);
assert.equal(status.candidate_transition_forbidden_until_independent_review_satisfied, true);
assert.equal(status.bounded_canonical_transaction_authorized, false);
assert.equal(status.production_runtime_source_authorized, false);
assert.equal(status.decision_action_feedback_authorized, false);
assert.equal(status.mcft_cap_09_authorized, false);

const gates = readJson(GATES);
assert.equal(gates.entry_gate_policy.independent_review_satisfied, false);
assert.equal(gates.entry_gate_policy.independent_review_deferred, true);
assert.equal(gates.entry_gate_policy.independent_review_required_before_formal_s2_candidate, true);
assert.equal(gates.formal_candidate_creation_authorized, true);
assert.equal(gates.s2_candidate_transition_authorized, false);
assert.equal(gates.production_runtime_source_authorized, false);
assert.equal(gates.mcft_cap_09_authorized, false);
assert.equal(gates.completion_authority_contract.implementation_state, 'IMPLEMENTED');
assert.equal(gates.completion_authority_contract.database_acceptance_state, 'PASS_REQUIRED_ON_EXACT_HEAD');
assert.equal(gates.completion_authority_contract.formal_candidate_creation_authorized, true);
assert.deepEqual(gates.completion_authority_contract.digest_error_precedence, [
  'CAP08_COMPLETION_CONTRACT_DIGEST_MISMATCH',
  'CAP08_COMPLETION_SOURCE_DIGEST_MISMATCH',
]);
const matrix = gates.completion_authority_contract.negative_database_matrix;
assert.equal(matrix.length, 14);
assert.deepEqual(matrix.map((entry) => entry.case_id), Array.from({ length: 14 }, (_, index) => `N${index + 1}`));
assert.equal(matrix.find((entry) => entry.case_id === 'N8').expected_error, 'CAP08_COMPLETION_CONTRACT_DIGEST_MISMATCH');
assert.equal(matrix.find((entry) => entry.case_id === 'N9').expected_error, 'CAP08_COMPLETION_SOURCE_DIGEST_MISMATCH');
assert.equal(matrix.find((entry) => entry.case_id === 'N10').expected_error, 'CAP08_COMPLETION_CONTRACT_DIGEST_MISMATCH');
const gateStates = Object.fromEntries(gates.gates.map((gate) => [gate.gate_id, gate.state]));
assert.equal(gateStates['S2-G1-SYNTHETIC-MERGE-ATTESTATION'], 'PASS_FOUNDATION_PRESENT_ON_MAIN');
assert.equal(gateStates['S2-G2-REGISTRY-DRIVEN-LIFECYCLE'], 'PASS_FOUNDATION_PRESENT_ON_MAIN');
assert.equal(gateStates['S2-G3-COMPLETION-AUTHORITY-NEGATIVE-DB'], 'IMPLEMENTED_N1_N14_EXACT_HEAD_ACCEPTANCE_REQUIRED');

const contractSource = read('apps/server/src/domain/twin_runtime/cap08_completion_authority_contracts_v1.ts');
const repositorySource = read('apps/server/src/persistence/twin_runtime/postgres_completion_authority_repository_v1.ts');
const bootstrapSource = read('apps/server/src/runtime/twin_runtime/a0_bootstrap_runtime_service_v1.ts');
const serviceSource = read('apps/server/src/runtime/twin_runtime/cap08_completion_authority_service_v1.ts');
const rangeSource = read('apps/server/src/runtime/twin_runtime/cap08_s1_base_range_service_v1.ts');
const runtimeSource = read('apps/server/src/runtime/twin_runtime/cap08_s1_base_runtime_service_v1.ts');
assert.match(contractSource, /cap08CompletionAuthorityStorageRefV1/);
assert.match(repositorySource, /twin_runtime_authority_snapshot_v1/);
assert.match(repositorySource, /ON CONFLICT \(authority_kind,authority_ref\) DO NOTHING/);
assert.match(bootstrapSource, /async readExisting/);
assert.match(serviceSource, /CAP08_COMPLETION_FOREIGN_RUN/);
assert.match(serviceSource, /CAP08_COMPLETION_CONTRACT_DIGEST_MISMATCH[\s\S]*CAP08_COMPLETION_SOURCE_DIGEST_MISMATCH/);
assert.match(rangeSource, /CAP08_COMPLETION_AUTHORITY_SERVICE_REQUIRED/);
assert.match(rangeSource, /completionAuthorityService\.inspect/);
assert.match(rangeSource, /completionAuthorityService\.establish/);
assert.match(rangeSource, /async inspectCompletion/);
assert.match(runtimeSource, /rangeService\.inspectCompletion/);
assert.match(runtimeSource, /bootstrapService\.readExisting/);

const workflow = read(WORKFLOW);
assert.ok(!/^\s*workflow_dispatch\s*:/m.test(workflow), 'G3_WORKFLOW_DISPATCH_FORBIDDEN');
assert.match(workflow, /postgres:16/);
assert.match(workflow, /ACCEPTANCE_MCFT_CAP_08_S2_G3_BOUNDARY\.cjs/);
assert.match(workflow, /ACCEPTANCE_MCFT_CAP_08_S2_COMPLETION_AUTHORITY_NEGATIVE_DB\.ts/);
assert.match(workflow, /mcft_cap08_s2_g3_acceptance_support_v1\.ts/);
assert.match(workflow, /mcft_cap08_s2_g3_negative_cases_v1\.ts/);
assert.match(workflow, /MCFT_CAP08_S2_G3_DESTRUCTIVE_ACCEPTANCE/);

const result = {
  schema_version: 'geox_mcft_cap08_s2_g3_boundary_result_v1',
  status: 'PASS',
  base_sha: BASE,
  candidate_sha: head,
  changed_file_count: changed.length,
  changed_files: changed,
  g1_state: 'PASS_PRESENT_ON_MAIN',
  g2_state: 'PASS_PRESENT_ON_MAIN',
  g3_implementation_state: 'IMPLEMENTED',
  g3_database_acceptance_state: 'PASS_REQUIRED_ON_EXACT_HEAD',
  negative_matrix: 'N1_N14',
  formal_candidate_creation_authorized: true,
  s2_candidate_implemented: false,
  independent_review_satisfied: false,
  independent_review_deferred: true,
  independent_review_required_before_formal_s2_candidate: true,
  s3_authorized: false,
};
fs.mkdirSync(path.join(ROOT, 'acceptance-output'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S2_G3_BOUNDARY_RESULT.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
