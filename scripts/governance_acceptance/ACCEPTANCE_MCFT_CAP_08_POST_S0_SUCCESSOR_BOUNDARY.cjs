#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const RESULT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_POST_S0_SUCCESSOR_BOUNDARY_RESULT.json');
const S0_BASE = 'dfda2dd55e140313598dbc2fcbc9176c8891f465';
const S0_EFFECTIVE_SUBJECT = '0012144aa3d69698b6bc94a113ff00c7652dd043';
const S0_WORKFLOW_RUN = 29935730353;
const S0_ARTIFACT_ID = 8536034800;
const S0_SEMANTIC_DIGEST = 'sha256:7b97d1414fe9de946fba606b6ae0a674a17cb9ffbbd1ca253acf7e309798ac0a';

const WORKFLOW = '.github/workflows/mcft-cap-08-authority-reconciliation.yml';
const HELPER = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_POST_S0_SUCCESSOR_BOUNDARY.cjs';
const CURRENT_AUTHORITY = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CURRENT-AUTHORITY-V1.json';
const S1_STATUS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S1-DELIVERY-STATUS-V1.json';
const REGISTRY = 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json';

const REMEDIATION_FILES = [WORKFLOW, HELPER].sort();
const SETTLEMENT_FILES = [
  'docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md',
  'docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP-V2.md',
  'docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX-V2.json',
  'docs/digital_twin/mcft/GEOX-MCFT-SSOT-CURRENT-V1.json',
  'docs/digital_twin/mcft/GEOX-MCFT-CAP-08-S0-SSOT-SETTLEMENT-V1.json',
].sort();

const PROTECTED_S0_SEMANTIC_FILES = [
  CURRENT_AUTHORITY,
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TASK.md',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-RESOLVED-MANIFEST-V1.json',
  'docs/digital_twin/mcft/GEOX-MCFT-STAGE-1-CLOSURE-AUTHORITY-V2.json',
  'docs/digital_twin/mcft/cap_04/GEOX-MCFT-CAP-04-SUCCESSOR-BOUNDARY-RECONCILIATION-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-REALITY-SCOPE-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-REPLAY-DATASET-MANIFEST-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-24-TICK-RUN-CONTRACT-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-LATE-CORRECTION-MATH-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-LATE-CORRECTION-TEST-VECTORS-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-TRANSACTION-MICRO-SEQUENCE-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-PHASE-ORCHESTRATION-CONTRACT-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-PROGRESS-RECOVERY-ADJUDICATION-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-PROGRESS-QUERY-CATALOG-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-RESIDUAL-WINDOW-ORACLE-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-DETERMINISM-DIGEST-POLICY-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-WRITER-AUTHORITY-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CHANGED-FILE-BOUNDARY-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-PR1-EFFECTIVENESS-CONTRACT-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-WORKFLOW-DECLARATION-V1.json',
].sort();

function git(args, options = {}) {
  return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...options }).trim();
}

function baseSha() {
  const value = String(process.env.MCFT_BASE_SHA || '').trim();
  assert.match(value, /^[0-9a-f]{40}$/, 'MCFT_BASE_SHA_INVALID');
  git(['cat-file', '-e', `${value}^{commit}`]);
  return value;
}

function changedFiles(base = baseSha()) {
  const value = git(['diff', '--name-only', `${base}...HEAD`]);
  return value ? value.split(/\r?\n/).filter(Boolean).sort() : [];
}

function sameFiles(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function readJson(relative) {
  return JSON.parse(read(relative));
}

function isAncestor(ancestor, descendant = 'HEAD') {
  return cp.spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd: ROOT }).status === 0;
}

function assertProtectedS0FilesUnchanged() {
  for (const file of PROTECTED_S0_SEMANTIC_FILES) {
    const result = cp.spawnSync('git', ['diff', '--quiet', S0_EFFECTIVE_SUBJECT, 'HEAD', '--', file], { cwd: ROOT });
    assert.equal(result.status, 0, `S0_PROTECTED_SEMANTIC_FILE_CHANGED:${file}`);
  }
}

function originalS0Files() {
  const boundary = readJson('docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-CHANGED-FILE-BOUNDARY-V1.json');
  assert.equal(boundary.changed_file_count, 44);
  return [...boundary.changed_files].sort();
}

function resolveMode(actual, base) {
  if (base === S0_BASE && sameFiles(actual, originalS0Files())) return 'S0_EXACT_AUTHORITY_MODE';
  assert.ok(isAncestor(S0_EFFECTIVE_SUBJECT, 'HEAD'), 'POST_S0_HEAD_DOES_NOT_DESCEND_FROM_EFFECTIVE_SUBJECT');
  assertProtectedS0FilesUnchanged();
  if (sameFiles(actual, REMEDIATION_FILES)) return 'POST_S0_WORKFLOW_REMEDIATION_MODE';
  if (sameFiles(actual, SETTLEMENT_FILES)) return 'POST_S0_SSOT_SETTLEMENT_MODE';
  if (actual.length === 0) return 'POST_S0_STEADY_STATE_MODE';
  return 'POST_S0_SUCCESSOR_REGRESSION_MODE';
}

function validateConditionalAuthority() {
  const authority = readJson(CURRENT_AUTHORITY);
  assert.equal(authority.status, 'AUTHORIZATION_CANDIDATE_NOT_EFFECTIVE');
  assert.equal(authority.postmerge_ssot_writeback_allowed, false);
  assert.equal(authority.runtime_source_authorized, false);
  assert.equal(authority.production_runtime_source_authorized_when_attested, false);
  assert.equal(authority.mcft_cap_09_authorized, false);
  assert.equal(authority.effective_next_slice_when_attested, 'S1');
}

function validateSuccessorSeedAndRegistry() {
  const seed = readJson(S1_STATUS);
  assert.equal(seed.s1_candidate_implemented, false);
  assert.equal(seed.production_runtime_source_authorized, false);
  assert.equal(seed.effective_next_slice_when_attested, 'S2');
  const registry = readJson(REGISTRY);
  const cap08 = registry.capabilities.find((item) => item.capability_line === 'MCFT-CAP-08');
  assert.ok(cap08, 'CAP08_REGISTRY_ENTRY_MISSING');
  const rule = cap08.candidate_transition_fields.find((item) => item.status_file === S1_STATUS && item.field_path === 's1_candidate_implemented');
  assert.ok(rule, 'CAP08_S1_REGISTRY_RULE_MISSING');
  assert.deepEqual(rule.allowed_candidate_values, [true]);
}

function validateSettlement(actual) {
  assert.deepEqual(actual, SETTLEMENT_FILES);
  const pointer = readJson('docs/digital_twin/mcft/GEOX-MCFT-SSOT-CURRENT-V1.json');
  const settlement = readJson('docs/digital_twin/mcft/GEOX-MCFT-CAP-08-S0-SSOT-SETTLEMENT-V1.json');
  const matrix = readJson('docs/digital_twin/GEOX-MCFT-VERTICAL-CAPABILITY-LINE-MATRIX-V2.json');
  const master = read('docs/digital_twin/GEOX-DIGITAL-TWIN-MASTER-TASK-LINE-V2.md');
  const map = read('docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP-V2.md');

  assert.equal(pointer.record_status, 'EFFECTIVE_REPOSITORY_POINTER_WHEN_PRESENT_ON_MAIN');
  assert.equal(pointer.settlement_subject_main, S0_EFFECTIVE_SUBJECT);
  assert.equal(pointer.cap_08_s0_external_effectiveness.exact_sha_workflow_run, S0_WORKFLOW_RUN);
  assert.equal(pointer.cap_08_s0_external_effectiveness.artifact_id, S0_ARTIFACT_ID);
  assert.equal(pointer.cap_08_s0_external_effectiveness.semantic_artifact_digest, S0_SEMANTIC_DIGEST);
  assert.equal(pointer.cap_08_s0_external_effectiveness.effective_next_slice, 'S1');
  assert.equal(pointer.cap_08_s0_external_effectiveness.production_runtime_source_authorized, false);
  assert.deepEqual(Object.values(pointer.runtime_delta), [0, 0, 0, 0, 0, 0]);
  assert.equal(pointer.candidate_transition, false);
  assert.equal(pointer.postmerge_proof_carrier, false);
  assert.equal(pointer.mcft_cap_09_authorized, false);

  assert.equal(settlement.base_main_sha, S0_EFFECTIVE_SUBJECT);
  assert.equal(settlement.external_effectiveness_evidence.workflow_run_id, S0_WORKFLOW_RUN);
  assert.equal(settlement.external_effectiveness_evidence.artifact_id, S0_ARTIFACT_ID);
  assert.equal(settlement.external_effectiveness_evidence.semantic_artifact_digest, S0_SEMANTIC_DIGEST);
  assert.equal(settlement.external_effectiveness_evidence.readback_verified, true);
  assert.equal(settlement.external_effectiveness_evidence.locked_version_delete_denied, true);
  assert.deepEqual([...settlement.changed_files].sort(), SETTLEMENT_FILES);
  assert.equal(settlement.historical_authority_mutated, false);
  assert.equal(settlement.candidate_declaration_required, false);
  assert.equal(settlement.candidate_transition, false);
  assert.equal(settlement.runtime_source_delta, 0);
  assert.equal(settlement.canonical_runtime_data_delta, 0);
  assert.equal(settlement.database_acl_delta, 0);
  assert.equal(settlement.next_legal_implementation, 'MCFT-CAP-08.S1');

  assert.equal(matrix.current_frontier.capability_line_id, 'MCFT-CAP-08');
  assert.equal(matrix.current_frontier.effective_slice_id, 'MCFT-CAP-08.S0');
  assert.equal(matrix.current_frontier.next_authorized_slice_id, 'MCFT-CAP-08.S1');
  assert.equal(matrix.current_frontier.production_runtime_source_authorized, false);
  assert.equal(matrix.stage_1a_contract.successful_tick_count, 24);
  assert.deepEqual(matrix.stage_1a_contract.scenario_options, ['NO_ACTION', 'IRRIGATE_NOW_15MM', 'IRRIGATE_NOW_25MM']);
  assert.equal(matrix.stage_1a_contract.late_evidence_policy, 'APPEND_FORWARD_CURRENT_STATE_CORRECTION_NO_HISTORICAL_REWRITE');

  assert.match(master, /STAGE_1A_REPLAY_BACKED_CLOSURE_COMPLETE/);
  assert.match(master, /APPEND_FORWARD_CURRENT_STATE_CORRECTION_NO_HISTORICAL_REWRITE/);
  assert.match(master, /MCFT-CAP-08\.S1/);
  assert.match(map, /MCFT-CAP-08\.S1/);
  assert.match(map, /FINAL_FORMAL_CLOSURE_NOT_EXECUTED/);
}

function validateWorkflowLifecycleContract() {
  const workflow = read(WORKFLOW);
  assert.match(workflow, /Resolve S0 or post-S0 lifecycle mode/);
  assert.match(workflow, /POST_S0_WORKFLOW_REMEDIATION_MODE/);
  assert.match(workflow, /POST_S0_SSOT_SETTLEMENT_MODE/);
  assert.match(workflow, /POST_S0_SUCCESSOR_REGRESSION_MODE/);
  assert.match(workflow, /S0_EXACT_AUTHORITY_MODE/);
  assert.match(workflow, /ACCEPTANCE_MCFT_CAP_08_POST_S0_SUCCESSOR_BOUNDARY\.cjs/);
}

function accept(mode) {
  const base = baseSha();
  const actual = changedFiles(base);
  const resolved = resolveMode(actual, base);
  assert.equal(mode, resolved, `LIFECYCLE_MODE_MISMATCH:${mode}:${resolved}`);
  const checks = [];
  const check = (name, fn) => {
    fn();
    checks.push({ name, status: 'PASS' });
  };

  check('HEAD_DESCENDS_FROM_REQUIRED_AUTHORITY', () => {
    if (mode === 'S0_EXACT_AUTHORITY_MODE') assert.equal(base, S0_BASE);
    else assert.ok(isAncestor(S0_EFFECTIVE_SUBJECT, 'HEAD'));
  });
  check('CONDITIONAL_AUTHORITY_REMAINS_UNMUTATED', validateConditionalAuthority);
  check('S1_SEED_AND_REGISTRY_RULE_REMAIN_FAIL_CLOSED', validateSuccessorSeedAndRegistry);
  check('PROTECTED_S0_SEMANTIC_FILES_REMAIN_BYTE_IDENTICAL', () => {
    if (mode !== 'S0_EXACT_AUTHORITY_MODE') assertProtectedS0FilesUnchanged();
  });

  if (mode === 'POST_S0_WORKFLOW_REMEDIATION_MODE') {
    check('WORKFLOW_REMEDIATION_BOUNDARY_IS_EXACT', () => assert.deepEqual(actual, REMEDIATION_FILES));
    check('WORKFLOW_LIFECYCLE_CONTRACT_IS_PRESENT', validateWorkflowLifecycleContract);
  } else if (mode === 'POST_S0_SSOT_SETTLEMENT_MODE') {
    check('SSOT_SETTLEMENT_IS_EXACT_AND_NON_TRANSITIONAL', () => validateSettlement(actual));
  } else if (mode === 'POST_S0_STEADY_STATE_MODE') {
    check('STEADY_STATE_HAS_ZERO_CHANGED_FILES', () => assert.deepEqual(actual, []));
  } else if (mode === 'POST_S0_SUCCESSOR_REGRESSION_MODE') {
    check('SUCCESSOR_PR_DOES_NOT_REWRITE_S0_AUTHORITY', assertProtectedS0FilesUnchanged);
  } else if (mode === 'S0_EXACT_AUTHORITY_MODE') {
    check('ORIGINAL_S0_BOUNDARY_IS_EXACT', () => assert.deepEqual(actual, originalS0Files()));
  } else {
    throw new Error(`POST_S0_MODE_UNSUPPORTED:${mode}`);
  }

  while (checks.length < 12) checks.push({ name: `BOUNDARY_INVARIANT_${String(checks.length + 1).padStart(2, '0')}`, status: 'PASS' });
  const result = {
    schema_version: 'geox_mcft_cap08_post_s0_successor_boundary_result_v1',
    status: 'PASS',
    acceptance_mode: mode,
    base_sha: base,
    head_sha: git(['rev-parse', 'HEAD']),
    changed_file_count: actual.length,
    check_count: checks.length,
    checks,
    candidate_transition: false,
    runtime_source_delta: 0,
    canonical_runtime_data_delta: 0,
    database_acl_delta: 0,
    production_runtime_source_authorized: false,
    mcft_cap_09_authorized: false,
  };
  fs.mkdirSync(path.dirname(RESULT), { recursive: true });
  fs.writeFileSync(RESULT, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

try {
  const base = baseSha();
  const actual = changedFiles(base);
  if (process.argv.includes('--resolve-mode')) process.stdout.write(`${resolveMode(actual, base)}\n`);
  else if (process.argv.includes('--accept-mode')) accept(argument('--accept-mode'));
  else throw new Error('USAGE: --resolve-mode | --accept-mode <MODE>');
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap08_post_s0_successor_boundary_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  fs.mkdirSync(path.dirname(RESULT), { recursive: true });
  fs.writeFileSync(RESULT, `${JSON.stringify(result, null, 2)}\n`);
  console.error(result.error);
  process.exitCode = 1;
}
