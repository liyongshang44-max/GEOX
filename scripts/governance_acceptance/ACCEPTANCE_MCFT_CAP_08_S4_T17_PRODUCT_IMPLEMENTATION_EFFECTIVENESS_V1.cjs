#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const DOC = 'docs/digital_twin/mcft/cap_08';
const BOUNDARY = `${DOC}/GEOX-MCFT-CAP-08-S4-T17-PRODUCT-IMPLEMENTATION-EFFECTIVENESS-BOUNDARY-V1.json`;
const AUTHORITY = `${DOC}/GEOX-MCFT-CAP-08-S4-T17-PRODUCT-IMPLEMENTATION-EFFECTIVENESS-AUTHORITY-V1.json`;
const WORKFLOW = '.github/workflows/mcft-cap-08-s4-t17-product-implementation-effectiveness.yml';
const ORIGINAL_ACCEPTANCE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S4_T17_PRODUCT_IMPLEMENTATION_V1.cjs';
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S4_T17_PRODUCT_IMPLEMENTATION_EFFECTIVENESS_RESULT.json');

const readText = (pathname) => fs.readFileSync(path.join(ROOT, pathname), 'utf8');
const readJson = (pathname) => JSON.parse(readText(pathname));
const git = (cwd, ...args) => cp.execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function semanticDigest(value) {
  const copy = structuredClone(value);
  delete copy.semantic_digest;
  return `sha256:${crypto.createHash('sha256').update(canonical(copy)).digest('hex')}`;
}

function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}

let worktree = null;
try {
  const boundary = readJson(BOUNDARY);
  const authority = readJson(AUTHORITY);
  const base = String(process.env.MCFT_BASE_SHA || boundary.base_main_sha).trim();

  assert.equal(base, boundary.base_main_sha, 'BASE_MAIN_SHA');
  assert.equal(boundary.semantic_digest, semanticDigest(boundary), 'BOUNDARY_SEMANTIC_DIGEST');
  assert.equal(authority.semantic_digest, semanticDigest(authority), 'AUTHORITY_SEMANTIC_DIGEST');

  const parents = git(ROOT, 'rev-list', '--parents', '-n', '1', 'HEAD').split(/\s+/);
  let exactCandidate = 'HEAD';
  if (parents.length === 3) {
    assert.equal(parents[1], base, 'PR_MERGE_REF_BASE_PARENT');
    exactCandidate = parents[2];
  } else {
    assert.equal(parents.length, 2, 'EFFECTIVENESS_CANDIDATE_PARENT_CARDINALITY');
  }
  exactCandidate = git(ROOT, 'rev-parse', exactCandidate);

  assert.equal(git(ROOT, 'merge-base', base, exactCandidate), base, 'BASE_NOT_ANCESTOR');
  assert.equal(git(ROOT, 'rev-list', '--count', `${base}..${exactCandidate}`), '1', 'EFFECTIVENESS_COMMIT_COUNT');
  assert.equal(git(ROOT, 'diff', '--check', `${base}...${exactCandidate}`), '', 'DIFF_CHECK');
  const changed = git(ROOT, 'diff', '--name-only', `${base}...${exactCandidate}`).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, [...boundary.changed_files].sort(), 'CHANGED_FILE_BOUNDARY');
  assert.equal(changed.length, 4, 'CHANGED_FILE_COUNT');
  assert.equal(changed.some((pathname) =>
    pathname.startsWith('apps/')
    || pathname.startsWith('packages/')
    || pathname.startsWith('db/')
    || pathname.startsWith('scripts/runtime_acceptance/')
  ), false, 'PRODUCT_OR_RUNTIME_ACCEPTANCE_CHANGE_FORBIDDEN');

  assert.equal(boundary.runtime_source_file_count, 0);
  assert.equal(boundary.runtime_acceptance_file_count, 0);
  assert.equal(boundary.development_database_execution_in_pr_authorized, true);
  assert.equal(boundary.formal_database_execution_authorized, false);
  assert.equal(boundary.workflow_dispatch_present, false);
  assert.equal(boundary.authority_recovery_included, false);
  assert.equal(boundary.execution_authority_included, false);
  assert.equal(boundary.formal_authority_chain_status, 'PAUSED');
  assert.equal(boundary.v10_authorized, false);
  assert.equal(boundary.formal_run_a_authorized, false);
  assert.equal(boundary.formal_run_b_authorized, false);
  assert.equal(boundary.s6_candidate_implemented, false);
  assert.equal(boundary.stage_1a_end_to_end_closure_established, false);
  assert.equal(boundary.next_action_after_merge, 'INDEPENDENT_FORMAL_AUTHORITY_CHAIN_RECOVERY_ADJUDICATION');

  const subject = authority.implementation_subject;
  assert.equal(subject.pull_request_number, 2743);
  assert.equal(subject.candidate_head_sha, '07314c708fdb02478b0b6a14580ff553483b18cc');
  assert.equal(subject.merge_commit_sha, base);
  assert.equal(git(ROOT, 'rev-parse', `${subject.candidate_head_sha}^{tree}`), subject.candidate_tree_sha);
  assert.equal(git(ROOT, 'rev-parse', `${subject.merge_commit_sha}^{tree}`), subject.merge_tree_sha);
  assert.equal(subject.candidate_tree_sha, subject.merge_tree_sha);
  assert.equal(git(ROOT, 'diff', '--name-only', subject.candidate_head_sha, subject.merge_commit_sha), '');
  assert.equal(subject.candidate_to_merge_file_delta, 0);
  assert.equal(subject.candidate_to_merge_tree_equal, true);

  for (const [pathname, blobSha] of Object.entries(authority.implementation_object_set)) {
    assert.equal(git(ROOT, 'rev-parse', `${subject.merge_commit_sha}:${pathname}`), blobSha, `IMPLEMENTATION_BLOB_DRIFT:${pathname}`);
  }
  assert.equal(Object.keys(authority.implementation_object_set).length, 14, 'IMPLEMENTATION_OBJECT_COUNT');

  const evidence = authority.exact_head_evidence;
  assert.deepEqual(
    [evidence.focused_workflow_run_id, evidence.focused_static_artifact_id, evidence.focused_static_artifact_digest],
    [30728508703, 8827183622, 'sha256:27125af9961f7eb8036abe76b0e5856b7f4aa0b283658f135fd1c231fa34f135']
  );
  assert.deepEqual(
    [evidence.focused_normal_artifact_id, evidence.focused_normal_artifact_digest],
    [8827185968, 'sha256:1f5c9b6a615637e0e881d2437d09753de939119e7e7a44184f6f1d6afc31af6e']
  );
  assert.deepEqual(
    [evidence.focused_rollback_artifact_id, evidence.focused_rollback_artifact_digest],
    [8827185978, 'sha256:f419c0f9259d60e41fd8378473b54b1bc8184f83164a97c49dcb3862ab918564']
  );
  assert.deepEqual(
    [evidence.standard_ci_run_id, evidence.standard_ci_artifact_id, evidence.standard_ci_artifact_digest, evidence.standard_ci_status],
    [30728508644, 8827246240, 'sha256:225454f315c1ba4c700a8a96c1f26cc59663d01d21977c2fc66d0436c185f40f', 'PASS']
  );
  assert.deepEqual(
    [evidence.focused_job_count, evidence.focused_job_success_count, evidence.standard_required_job_count, evidence.standard_required_job_success_count],
    [3, 3, 2, 2]
  );

  for (const [key, expected] of Object.entries({
    static_boundary_pass: true,
    server_typecheck_pass: true,
    fresh_postgresql_normal_pass: true,
    fresh_postgresql_rollback_pass: true,
    normal_database_drop_pass: true,
    rollback_database_drop_pass: true,
    exact_replay_zero_write_pass: true,
    projection_divergence_fail_closed_no_repair_pass: true,
    controlled_40001_full_transaction_retry_pass: true,
    four_pointer_cas_pass: true,
    transition_witness_and_guard_pass: true,
    rollback_latest_remained_base_t16: true,
    candidate_to_merge_file_delta: 0,
    candidate_to_merge_tree_equal: true,
    detached_merge_static_replay_required: true,
  })) assert.equal(authority.verified_result[key], expected, `VERIFIED_RESULT:${key}`);
  assert.deepEqual(authority.verified_result.merged_main_fresh_postgresql_modes_required, ['normal', 'rollback']);

  const effect = authority.effect;
  assert.equal(effect.s4_t17_product_implementation_effective, true);
  assert.equal(effect.effective_product_source_sha, base);
  assert.equal(effect.generic_cap04_source_unchanged, true);
  assert.equal(effect.historical_s4_source_unchanged, true);
  assert.equal(effect.qualification_only_carrier_unchanged, true);
  assert.equal(effect.formal_single_run_evidence_carrier_integrated, true);
  assert.equal(effect.formal_authority_chain_status, 'PAUSED');
  assert.equal(effect.independent_authority_chain_recovery_adjudication_may_follow, true);
  assert.equal(effect.authority_chain_reopened, false);
  assert.equal(effect.actual_execution_authority_present, false);
  assert.equal(effect.formal_database_execution_authorized, false);
  assert.equal(effect.workflow_dispatch_authorized, false);
  assert.equal(effect.formal_run_a_executed, false);
  assert.equal(effect.formal_run_b_executed, false);
  assert.equal(effect.cross_run_comparator_completed, false);
  assert.equal(effect.s6_candidate_implemented, false);
  assert.equal(effect.stage_1a_end_to_end_closure_established, false);
  assert.equal(effect.mcft_cap_08_complete, false);
  assert.equal(effect.mcft_cap_09_authorized, false);
  assert.equal(authority.first_legal_next_action_after_merge, 'INDEPENDENT_FORMAL_AUTHORITY_CHAIN_RECOVERY_ADJUDICATION');

  const requiredNonclaims = [
    'NO_AUTHORITY_CHAIN_REOPENING_IN_EFFECTIVENESS_PR',
    'NO_EXECUTION_AUTHORITY',
    'NO_FORMAL_DATABASE_EXECUTION',
    'NO_WORKFLOW_DISPATCH',
    'NO_FORMAL_RUN_A',
    'NO_FORMAL_RUN_B',
    'NO_CROSS_RUN_COMPARATOR',
    'NO_S6_CANDIDATE',
    'NO_STAGE_1A_CLOSURE',
    'NO_CAP08_COMPLETION',
    'NO_CAP09_AUTHORITY',
  ];
  assert.deepEqual(authority.nonclaims, requiredNonclaims);

  const workflow = readText(WORKFLOW);
  assert.match(workflow, /pull_request:/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.match(workflow, /matrix:\s*\n\s*mode:\s*\[normal,\s*rollback\]/);
  assert.match(workflow, /image:\s*postgres:16/);
  assert.match(workflow, /ACCEPTANCE_MCFT_CAP_08_S4_T17_PRODUCT_IMPLEMENTATION_DB\.ts/);
  assert.match(workflow, /2026_08_01_mcft_cap08_s4_t17_transition_persistence\.sql/);
  assert.match(workflow, /DROP DATABASE IF EXISTS/);

  worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'mcft-cap08-s4-t17-effectiveness-'));
  cp.execFileSync('git', ['worktree', 'add', '--detach', worktree, subject.merge_commit_sha], { cwd: ROOT, stdio: 'pipe' });
  cp.execFileSync(process.execPath, [ORIGINAL_ACCEPTANCE], {
    cwd: worktree,
    env: { ...process.env, MCFT_BASE_SHA: 'a753af5cdda8144b4ac5e140af0f41473b451513' },
    stdio: 'pipe',
  });
  const replay = JSON.parse(fs.readFileSync(path.join(worktree, 'acceptance-output/MCFT_CAP_08_S4_T17_PRODUCT_IMPLEMENTATION_STATIC_RESULT.json'), 'utf8'));
  assert.equal(replay.status, 'PASS');
  assert.equal(replay.exact_head_sha, subject.candidate_head_sha);
  assert.equal(replay.changed_file_count, 14);
  assert.equal(replay.generic_cap04_source_unchanged, true);
  assert.equal(replay.historical_s4_source_unchanged, true);
  assert.equal(replay.projection_divergence_classifier_bound, true);
  assert.equal(replay.formal_authority_chain_status, 'PAUSED');

  const result = {
    schema_version: 'geox_mcft_cap08_s4_t17_product_implementation_effectiveness_result_v1',
    status: 'PASS',
    subject_sha: exactCandidate,
    base_sha: base,
    changed_file_count: changed.length,
    implementation_candidate_head: subject.candidate_head_sha,
    implementation_merge_commit: subject.merge_commit_sha,
    implementation_tree_sha: subject.merge_tree_sha,
    candidate_to_merge_file_delta: 0,
    candidate_to_merge_tree_equal: true,
    implementation_object_count: Object.keys(authority.implementation_object_set).length,
    detached_merge_static_replay_pass: true,
    merged_main_fresh_postgresql_modes_required: ['normal', 'rollback'],
    s4_t17_product_implementation_effective: true,
    formal_authority_chain_status: 'PAUSED',
    authority_chain_reopened: false,
    execution_authority_present: false,
    formal_database_execution_authorized: false,
    workflow_dispatch_authorized: false,
    formal_run_a_executed: false,
    formal_run_b_executed: false,
    s6_candidate_implemented: false,
    stage_1a_end_to_end_closure_established: false,
    mcft_cap_08_complete: false,
    mcft_cap_09_authorized: false,
    next_action_after_merge: 'INDEPENDENT_FORMAL_AUTHORITY_CHAIN_RECOVERY_ADJUDICATION',
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap08_s4_t17_product_implementation_effectiveness_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.stack || error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
} finally {
  if (worktree) {
    try { cp.execFileSync('git', ['worktree', 'remove', '--force', worktree], { cwd: ROOT, stdio: 'pipe' }); } catch {}
    try { fs.rmSync(worktree, { recursive: true, force: true }); } catch {}
  }
}
