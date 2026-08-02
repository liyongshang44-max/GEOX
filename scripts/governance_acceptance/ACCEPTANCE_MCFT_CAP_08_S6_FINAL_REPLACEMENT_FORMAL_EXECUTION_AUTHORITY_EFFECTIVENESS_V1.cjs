#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  validateExecutionAuthorityV1,
} = require('../runtime_acceptance/mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs');

const ROOT = path.resolve(__dirname, '../..');
const DOC = 'docs/digital_twin/mcft/cap_08';
const BASE = 'af608d3cd89e6621d1d9588bbf0ef754f62f2c89';
const SUBJECT = '26d94d5c47ce640e80374124bb473d62003cc9a6';
const CANDIDATE = '3e604416fcb31e20ea7102f07fdfe71b121550ba';
const MERGE = '208ad8ec34cde4e129e66805d47a994141303d24';

const P = {
  workflow: '.github/workflows/mcft-cap-08-s6-final-replacement-formal-execution-authority-effectiveness.yml',
  boundary: `${DOC}/GEOX-MCFT-CAP-08-S6-FINAL-AUTHORITY-EFFECTIVENESS-BOUNDARY-V1.json`,
  authority: `${DOC}/GEOX-MCFT-CAP-08-S6-FINAL-AUTHORITY-EFFECTIVENESS-V1.json`,
  runA: `${DOC}/GEOX-MCFT-CAP-08-S6-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json`,
  runB: `${DOC}/GEOX-MCFT-CAP-08-S6-FORMAL-RUN-B-EXECUTION-AUTHORITY-EFFECTIVE-V1.json`,
  validator: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_FINAL_REPLACEMENT_FORMAL_EXECUTION_AUTHORITY_EFFECTIVENESS_V1.cjs',
  candidateBoundary: `${DOC}/GEOX-MCFT-CAP-08-S6-FINAL-REPLACEMENT-FORMAL-EXECUTION-AUTHORITY-BOUNDARY-V1.json`,
  issuance: `${DOC}/GEOX-MCFT-CAP-08-S6-FINAL-REPLACEMENT-FORMAL-EXECUTION-AUTHORITY-ISSUANCE-V1.json`,
  objectSet: `${DOC}/GEOX-MCFT-CAP-08-S6-FINAL-REPLACEMENT-FORMAL-EXECUTION-AUTHORITY-OBJECT-SET-V1.json`,
  candidateRunA: `${DOC}/GEOX-MCFT-CAP-08-S6-FINAL-REPLACEMENT-FORMAL-RUN-A-AUTHORITY-V1.json`,
  candidateRunB: `${DOC}/GEOX-MCFT-CAP-08-S6-FINAL-REPLACEMENT-FORMAL-RUN-B-AUTHORITY-V1.json`,
  ctoBoundary: `${DOC}/GEOX-MCFT-CAP-08-S6-CTO-DUAL-ACCOUNT-VERIFICATION-DEFERRAL-BOUNDARY-V1.json`,
  ctoRuling: `${DOC}/GEOX-MCFT-CAP-08-S6-CTO-DUAL-ACCOUNT-VERIFICATION-DEFERRAL-V1.json`,
  reviewPolicy: `${DOC}/GEOX-MCFT-CAP-08-S6-REVIEW-POLICY-V1.json`,
};
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_FINAL_REPLACEMENT_FORMAL_EXECUTION_AUTHORITY_EFFECTIVENESS_RESULT.json');

const text = (pathname) => fs.readFileSync(path.join(ROOT, pathname), 'utf8');
const json = (pathname) => JSON.parse(text(pathname));
const git = (...args) => cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

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
function blobAt(ref, pathname) {
  return git('rev-parse', `${ref}:${pathname}`);
}
function assertPinned(ref, pathname, expected, label) {
  assert.match(expected, /^[0-9a-f]{40}$/, `${label}:SHA`);
  assert.equal(blobAt(ref, pathname), expected, `${label}:DRIFT`);
}
function resolveCandidate(base) {
  const parents = git('rev-list', '--parents', '-n', '1', 'HEAD').split(/\s+/);
  let head = 'HEAD';
  if (parents.length === 3) {
    assert.equal(parents[1], base, 'PR_MERGE_REF_BASE_PARENT');
    head = parents[2];
  } else {
    assert.equal(parents.length, 2, 'CANDIDATE_PARENT_CARDINALITY');
  }
  return git('rev-parse', head);
}

try {
  const boundary = json(P.boundary);
  const effectiveness = json(P.authority);
  const runA = json(P.runA);
  const runB = json(P.runB);
  const candidateBoundary = json(P.candidateBoundary);
  const issuance = json(P.issuance);
  const objectSet = json(P.objectSet);
  const candidateRunA = json(P.candidateRunA);
  const candidateRunB = json(P.candidateRunB);
  const ctoBoundary = json(P.ctoBoundary);
  const ctoRuling = json(P.ctoRuling);
  const reviewPolicy = json(P.reviewPolicy);
  const base = String(process.env.MCFT_BASE_SHA || boundary.base_main_sha).trim();

  assert.equal(base, BASE, 'BASE_MAIN_SHA');
  assert.equal(boundary.base_main_sha, BASE);
  assert.equal(boundary.semantic_digest, semanticDigest(boundary), 'BOUNDARY_SEMANTIC_DIGEST');
  assert.equal(effectiveness.semantic_digest, semanticDigest(effectiveness), 'EFFECTIVENESS_SEMANTIC_DIGEST');
  assert.equal(runA.semantic_digest, semanticDigest(runA), 'RUN_A_SEMANTIC_DIGEST');
  assert.equal(runB.semantic_digest, semanticDigest(runB), 'RUN_B_SEMANTIC_DIGEST');

  const exactCandidate = resolveCandidate(base);
  assert.equal(git('merge-base', base, exactCandidate), base, 'BASE_NOT_ANCESTOR');
  assert.equal(git('diff', '--check', `${base}...${exactCandidate}`), '', 'DIFF_CHECK');
  const changed = git('diff', '--name-only', `${base}...${exactCandidate}`).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, [...boundary.changed_files].sort(), 'CHANGED_FILE_BOUNDARY');
  assert.equal(changed.length, 6, 'CHANGED_FILE_COUNT');
  assert.equal(changed.some((pathname) =>
    pathname.startsWith('apps/')
    || pathname.startsWith('packages/')
    || pathname.startsWith('db/')
    || pathname.startsWith('scripts/runtime_acceptance/')
  ), false, 'RUNTIME_OR_PRODUCT_CHANGE_FORBIDDEN');

  assert.equal(boundary.runtime_source_file_count, 0);
  assert.equal(boundary.runtime_acceptance_file_count, 0);
  assert.equal(boundary.migration_file_count, 0);
  assert.equal(boundary.database_execution_workflow_file_count, 0);
  assert.equal(boundary.database_execution_performed, false);
  assert.equal(boundary.workflow_dispatch_present, false);
  assert.equal(boundary.effective_run_authority_record_count, 2);
  assert.equal(boundary.runtime_gate_eligible_authority_record_count, 2);
  assert.equal(boundary.max_parallel, 1);
  assert.equal(boundary.rerun_authorized, false);
  assert.equal(boundary.cross_run_comparator_authorized, false);
  assert.equal(boundary.next_action_after_merge, 'DISPATCH_EXACT_FORMAL_RUN_A_ONCE');

  assert.equal(git('merge-base', MERGE, base), MERGE, 'AUTHORITY_MERGE_NOT_ANCESTOR_OF_BASE');
  assert.equal(git('rev-parse', `${CANDIDATE}^{tree}`), git('rev-parse', `${MERGE}^{tree}`), 'CANDIDATE_MERGE_TREE_MISMATCH');
  assert.equal(git('diff', '--name-only', CANDIDATE, MERGE), '', 'CANDIDATE_MERGE_FILE_DELTA');

  assert.equal(candidateBoundary.semantic_digest, semanticDigest(candidateBoundary), 'CANDIDATE_BOUNDARY_DIGEST');
  assert.equal(candidateBoundary.changed_file_count, 9);
  for (const pathname of candidateBoundary.changed_files) {
    assert.equal(blobAt(MERGE, pathname), blobAt(base, pathname), `CANDIDATE_FILE_DRIFT:${pathname}`);
  }
  assertPinned(base, P.candidateBoundary, '826408d12473da3fd1e0cef7af941b7a4f91599d', 'CANDIDATE_BOUNDARY');
  assertPinned(base, P.issuance, '9231c5de34ca1c2017121eef2490d7371bf40a05', 'ISSUANCE');
  assertPinned(base, P.objectSet, 'c60356b8669a96c75365645846b75178b9502e97', 'OBJECT_SET');
  assertPinned(base, P.candidateRunA, 'a4d153692f55a53813528bcbe5b9b6dd439a56a2', 'CANDIDATE_RUN_A');
  assertPinned(base, P.candidateRunB, 'c3b04c98380dffa16ede3bb3a8e916b2d745209b', 'CANDIDATE_RUN_B');

  assert.equal(issuance.semantic_digest, 'sha256:b85dd8dcdd5e06aeb8b45e6d18c2413a0a8bdb4cb97577f885a84216ae4c038f');
  assert.equal(issuance.record_status, 'FINAL_REPLACEMENT_FORMAL_EXECUTION_AUTHORITY_CANDIDATE_ISSUED_NOT_EFFECTIVE');
  assert.equal(issuance.exact_subject_sha, SUBJECT);
  assert.equal(issuance.authority_effective, false);
  assert.equal(issuance.executable_authority_record_count, 0);
  assert.equal(issuance.first_legal_next_action_after_merge, 'ESTABLISH_FINAL_REPLACEMENT_FORMAL_EXECUTION_AUTHORITY_EFFECTIVENESS');
  assert.equal(candidateRunA.semantic_digest, 'sha256:c2307ed32dec9e394f0cc3498dbe5a75653c3abd1cbfcbac8f039efd5363b6b8');
  assert.equal(candidateRunB.semantic_digest, 'sha256:c40ca792e99eaafeeaa0a7dd5b410d8c29dfdcc391581fc2246a3af6ed1d618c');
  assert.equal(candidateRunA.activation_contract.candidate_record_is_runtime_gate_eligible, false);
  assert.equal(candidateRunB.activation_contract.candidate_record_is_runtime_gate_eligible, false);

  assert.equal(ctoBoundary.base_main_sha, MERGE);
  const overlayChanged = git('diff', '--name-only', `${MERGE}..${base}`).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(overlayChanged, [...ctoBoundary.changed_files].sort(), 'CURRENT_MAIN_OVERLAY_BOUNDARY');
  assert.equal(ctoBoundary.changed_file_count, 9);
  assert.equal(ctoBoundary.runtime_source_file_count, 0);
  assert.equal(ctoBoundary.runtime_acceptance_file_count, 0);
  assert.equal(ctoBoundary.migration_file_count, 0);
  assert.equal(ctoBoundary.database_execution_workflow_file_count, 0);
  assertPinned(base, P.ctoRuling, 'c33979169fca3d635795183db7066680c58d1edc', 'CTO_RULING');
  assertPinned(base, P.reviewPolicy, '1dd0de600ca00a6f328b3bacfdf67784a8a38a0f', 'REVIEW_POLICY');
  assert.equal(ctoRuling.ruling_text_zh, 'CTO裁决：搁置双账户的验证。');
  assert.equal(ctoRuling.effect.independent_review_requirement_state, 'SUSPENDED_BY_CTO_RULING');
  assert.equal(ctoRuling.technical_gate_relaxation, false);
  assert.equal(reviewPolicy.independent_review_requirement_state, 'SUSPENDED_BY_CTO_RULING');
  assert.equal(reviewPolicy.verified_second_github_account_required, false);
  assert.equal(reviewPolicy.technical_gate_relaxation, false);

  assert.equal(objectSet.semantic_digest, 'sha256:ae9a0f1129307803433676dfc11c9cc4132e739d33d550c43a38f8ceb213f8c5');
  assert.equal(objectSet.record_status, 'FINAL_REPLACEMENT_FORMAL_EXECUTION_AUTHORITY_OBJECT_SET_FROZEN');
  assert.equal(objectSet.exact_subject_sha, SUBJECT);
  const objectGroups = [
    objectSet.exact_control_plane_object_set,
    objectSet.exact_product_object_set,
    objectSet.exact_port_bundle_object_set,
    objectSet.protected_invariant_object_set,
  ];
  let pinnedObjectCount = 0;
  for (const group of objectGroups) {
    for (const [pathname, blobSha] of Object.entries(group)) {
      assertPinned(SUBJECT, pathname, blobSha, `SUBJECT_OBJECT:${pathname}`);
      assertPinned(base, pathname, blobSha, `CURRENT_MAIN_OBJECT:${pathname}`);
      pinnedObjectCount += 1;
    }
  }
  assert.equal(pinnedObjectCount, 36, 'PINNED_OBJECT_COUNT');

  for (const [run, candidateRecord, effectiveRecord] of [
    ['RUN_A', candidateRunA, runA],
    ['RUN_B', candidateRunB, runB],
  ]) {
    assert.equal(effectiveRecord.record_status, 'SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED');
    assert.equal(effectiveRecord.exact_subject_sha, SUBJECT);
    assert.equal(effectiveRecord.authorized_run_label, run);
    assert.equal(effectiveRecord.candidate_merge_sha, MERGE);
    assert.equal(effectiveRecord.effectiveness_base_main_sha, base);
    assert.equal(effectiveRecord.candidate_authority_ref.preserved_semantic_digest, candidateRecord.semantic_digest);
    assert.equal(effectiveRecord.candidate_authority_ref.required_record_status, candidateRecord.record_status);
    assert.equal(effectiveRecord.object_set_manifest_ref.semantic_digest, objectSet.semantic_digest);
    assert.equal(effectiveRecord.review_governance_overlay.independent_review_requirement_state, 'SUSPENDED_BY_CTO_RULING');
    assert.equal(effectiveRecord.review_governance_overlay.technical_gate_relaxation, false);
    assert.equal(effectiveRecord.single_use_contract.max_dispatch_count, 1);
    assert.equal(effectiveRecord.single_use_contract.rerun_authorized, false);
    assert.equal(effectiveRecord.single_use_contract.duplicate_dispatch_authorized, false);
    assert.equal(effectiveRecord.sequence_contract.max_parallel, 1);
    assert.equal(effectiveRecord.sequence_contract.parallel_run_a_and_run_b_authorized, false);
    assert.equal(effectiveRecord.database_execution_performed, false);
    assert.equal(effectiveRecord.workflow_dispatch_performed, false);
    assert.equal(effectiveRecord.formal_run_executed, false);
    validateExecutionAuthorityV1(effectiveRecord, {
      exactSubjectSha: SUBJECT,
      runLabel: run,
      operationalRunInstanceId: effectiveRecord.operational_run_instance_id,
    });
  }
  assert.equal(runA.sequence_contract.dispatch_precondition, 'AUTHORITY_EFFECTIVENESS_MERGED');
  assert.equal(runB.sequence_contract.dispatch_precondition, 'RUN_A_TERMINAL_SUCCESS');
  assert.equal(runA.operational_run_instance_id, 'MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-001');
  assert.equal(runB.operational_run_instance_id, 'MCFT-CAP-08-S6-FORMAL-RUN-B-20260802-002');

  assert.equal(effectiveness.record_status, 'FINAL_REPLACEMENT_FORMAL_EXECUTION_AUTHORITY_EFFECTIVE');
  assert.equal(effectiveness.authority_candidate_subject.pull_request_number, 2747);
  assert.equal(effectiveness.authority_candidate_subject.candidate_head_sha, CANDIDATE);
  assert.equal(effectiveness.authority_candidate_subject.merge_commit_sha, MERGE);
  assert.equal(effectiveness.authority_candidate_subject.candidate_to_merge_file_delta, 0);
  assert.equal(effectiveness.authority_candidate_subject.candidate_to_merge_tree_equal, true);
  assert.equal(effectiveness.verified_result.candidate_nine_file_set_preserved_on_current_main, true);
  assert.equal(effectiveness.verified_result.frozen_execution_object_set_unchanged_on_current_main, true);
  assert.equal(effectiveness.verified_result.cto_governance_overlay_only, true);
  assert.equal(effectiveness.verified_result.technical_gate_relaxation, false);
  assert.equal(effectiveness.verified_result.runtime_gate_eligible_authority_record_count, 2);
  assert.equal(effectiveness.effect.authority_effective, true);
  assert.equal(effectiveness.effect.formal_database_execution_authorized, true);
  assert.equal(effectiveness.effect.workflow_dispatch_authorized, true);
  assert.equal(effectiveness.effect.formal_run_a_authorized, true);
  assert.equal(effectiveness.effect.formal_run_b_authorized, true);
  assert.equal(effectiveness.effect.formal_run_a_executed, false);
  assert.equal(effectiveness.effect.formal_run_b_executed, false);
  assert.equal(effectiveness.effect.cross_run_comparator_authorized, false);
  assert.equal(effectiveness.effect.s6_candidate_implemented, false);
  assert.equal(effectiveness.effect.stage_1a_end_to_end_closure_established, false);
  assert.equal(effectiveness.effect.mcft_cap_08_complete, false);
  assert.equal(effectiveness.effect.mcft_cap_09_authorized, false);
  assert.equal(effectiveness.first_legal_next_action_after_merge, 'DISPATCH_EXACT_FORMAL_RUN_A_ONCE');

  const workflow = text(P.workflow);
  assert.match(workflow, /pull_request:/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /postgres:16|DATABASE_URL|psql|workflow run/i);
  assert.match(workflow, /ACCEPTANCE_MCFT_CAP_08_S6_FINAL_REPLACEMENT_FORMAL_EXECUTION_AUTHORITY_EFFECTIVENESS_V1\.cjs/);

  const result = {
    schema_version: 'geox_mcft_cap08_s6_final_replacement_formal_execution_authority_effectiveness_result_v1',
    status: 'PASS',
    base_main_sha: base,
    exact_candidate_sha: exactCandidate,
    changed_file_count: changed.length,
    authority_candidate_head_sha: CANDIDATE,
    authority_candidate_merge_sha: MERGE,
    authority_candidate_to_merge_file_delta: 0,
    authority_candidate_to_merge_tree_equal: true,
    current_main_overlay_file_count: overlayChanged.length,
    frozen_execution_object_count: pinnedObjectCount,
    runtime_gate_eligible_authority_record_count: 2,
    run_a_dispatch_precondition: runA.sequence_contract.dispatch_precondition,
    run_b_dispatch_precondition: runB.sequence_contract.dispatch_precondition,
    max_parallel: 1,
    rerun_authorized: false,
    independent_review_requirement_state: 'SUSPENDED_BY_CTO_RULING',
    technical_gate_relaxation: false,
    database_execution_performed: false,
    workflow_dispatch_performed: false,
    formal_run_a_executed: false,
    formal_run_b_executed: false,
    cross_run_comparator_authorized: false,
    s6_candidate_implemented: false,
    stage_1a_end_to_end_closure_established: false,
    mcft_cap_08_complete: false,
    mcft_cap_09_authorized: false,
    next_action_after_merge: 'DISPATCH_EXACT_FORMAL_RUN_A_ONCE',
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap08_s6_final_replacement_formal_execution_authority_effectiveness_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.stack || error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
