#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const DOC = 'docs/digital_twin/mcft/cap_08';
const BOUNDARY = `${DOC}/GEOX-MCFT-CAP-08-S6-FORMAL-AUTHORITY-CHAIN-RECOVERY-ADJUDICATION-BOUNDARY-V1.json`;
const DECISION = `${DOC}/GEOX-MCFT-CAP-08-S6-FORMAL-AUTHORITY-CHAIN-RECOVERY-ADJUDICATION-V1.json`;
const WORKFLOW = '.github/workflows/mcft-cap-08-s6-formal-authority-chain-recovery-adjudication.yml';
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_FORMAL_AUTHORITY_CHAIN_RECOVERY_ADJUDICATION_RESULT.json');

const readText = (pathname) => fs.readFileSync(path.join(ROOT, pathname), 'utf8');
const readJson = (pathname) => JSON.parse(readText(pathname));
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

try {
  const boundary = readJson(BOUNDARY);
  const decision = readJson(DECISION);
  assert.equal(boundary.semantic_digest, semanticDigest(boundary), 'BOUNDARY_SEMANTIC_DIGEST');
  assert.equal(decision.semantic_digest, semanticDigest(decision), 'DECISION_SEMANTIC_DIGEST');

  const base = String(process.env.MCFT_BASE_SHA || boundary.base_main_sha).trim();
  assert.equal(base, boundary.base_main_sha, 'BASE_MAIN_SHA');

  const parents = git('rev-list', '--parents', '-n', '1', 'HEAD').split(/\s+/);
  let exactCandidate = 'HEAD';
  if (parents.length === 3) {
    assert.equal(parents[1], base, 'PR_MERGE_REF_BASE_PARENT');
    exactCandidate = parents[2];
  } else {
    assert.equal(parents.length, 2, 'RECOVERY_CANDIDATE_PARENT_CARDINALITY');
  }
  exactCandidate = git('rev-parse', exactCandidate);

  assert.equal(git('merge-base', base, exactCandidate), base, 'BASE_NOT_ANCESTOR');
  assert.equal(git('rev-list', '--count', `${base}..${exactCandidate}`), '1', 'RECOVERY_COMMIT_COUNT');
  assert.equal(git('diff', '--check', `${base}...${exactCandidate}`), '', 'DIFF_CHECK');

  const changed = git('diff', '--name-only', `${base}...${exactCandidate}`)
    .split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, [...boundary.changed_files].sort(), 'CHANGED_FILE_BOUNDARY');
  assert.equal(changed.length, boundary.changed_file_count, 'CHANGED_FILE_COUNT');
  assert.equal(changed.length, 4, 'RECOVERY_BOUNDARY_MUST_BE_FOUR');

  assert.deepEqual(changed.filter((pathname) =>
    pathname.startsWith('apps/')
    || pathname.startsWith('packages/')
    || pathname.startsWith('db/')
    || pathname.startsWith('scripts/runtime_acceptance/')
    || pathname.includes('qualification_ports')
    || pathname.includes('EXECUTION-AUTHORITY')
    || /migration/i.test(pathname)
  ), [], 'PROTECTED_PRODUCT_OR_EXECUTION_BOUNDARY_CHANGED');

  for (const [key, expected] of Object.entries({
    append_forward_governance_only: true,
    protected_seed_mutation: false,
    runtime_source_file_count: 0,
    migration_file_count: 0,
    qualification_file_count: 0,
    database_execution_workflow_file_count: 0,
    execution_authority_file_count: 0,
    workflow_dispatch_present: false,
    database_execution_performed: false,
    formal_database_execution_authorized: false,
    authority_chain_recovery_adjudication_included: true,
    actual_execution_authority_included: false,
    replacement_authority_identifier_assigned: false,
    v10_authorized: false,
    formal_run_a_authorized: false,
    formal_run_b_authorized: false,
    cross_run_comparator_authorized: false,
    s6_candidate_implemented: false,
    stage_1a_end_to_end_closure_established: false,
  })) assert.equal(boundary[key], expected, `BOUNDARY:${key}`);
  assert.equal(boundary.next_action_after_merge, 'CREATE_ONE_FINAL_REPLACEMENT_FORMAL_EXECUTION_AUTHORITY_CANDIDATE');

  assert.equal(decision.repository_main_subject_sha, base);
  assert.equal(decision.record_status, 'FORMAL_AUTHORITY_CHAIN_RECOVERY_ADJUDICATED');
  assert.equal(decision.decision_authority, 'CTO_GOVERNANCE_AFTER_DEDICATED_T17_PRODUCT_EFFECTIVENESS');

  const freeze = decision.predecessor_freeze;
  assert.equal(git('rev-parse', `${base}:${freeze.path}`), freeze.blob_sha, 'FREEZE_BLOB_DRIFT');
  assert.equal(freeze.record_status, 'STAGE_1A_END_TO_END_CLOSURE_NOT_ESTABLISHED');
  assert.equal(freeze.formal_authority_chain_status, 'PAUSED');
  assert.equal(freeze.v10_immediate_issuance_authorized, false);

  const architecture = decision.architecture_adjudication;
  assert.equal(architecture.pull_request_number, 2742);
  assert.equal(git('merge-base', architecture.merge_commit_sha, base), architecture.merge_commit_sha);
  assert.equal(architecture.generic_cap04_modifications, 0);
  assert.equal(architecture.product_runtime_implementation, 0);

  const implementation = decision.product_implementation;
  assert.equal(implementation.pull_request_number, 2743);
  assert.equal(git('rev-parse', `${implementation.candidate_head_sha}^{tree}`), implementation.candidate_tree_sha);
  assert.equal(git('rev-parse', `${implementation.merge_commit_sha}^{tree}`), implementation.merge_tree_sha);
  assert.equal(implementation.candidate_tree_sha, implementation.merge_tree_sha);
  assert.equal(git('diff', '--name-only', implementation.candidate_head_sha, implementation.merge_commit_sha), '');
  assert.equal(implementation.candidate_to_merge_file_delta, 0);
  assert.equal(implementation.dedicated_t17_persistence_bridge_present, true);
  assert.equal(implementation.formal_evidence_carrier_integrated, true);

  const effectiveness = decision.merged_main_effectiveness;
  assert.equal(effectiveness.pull_request_number, 2745);
  assert.equal(effectiveness.merge_commit_sha, base);
  assert.equal(git('rev-parse', `${effectiveness.candidate_head_sha}^{tree}`), effectiveness.candidate_tree_sha);
  assert.equal(git('rev-parse', `${effectiveness.merge_commit_sha}^{tree}`), effectiveness.merge_tree_sha);
  assert.equal(effectiveness.candidate_tree_sha, effectiveness.merge_tree_sha);
  assert.equal(git('diff', '--name-only', effectiveness.candidate_head_sha, effectiveness.merge_commit_sha), '');
  assert.equal(effectiveness.candidate_to_merge_file_delta, 0);
  assert.equal(git('rev-parse', `${base}:${effectiveness.effectiveness_authority_path}`), effectiveness.effectiveness_authority_blob_sha, 'EFFECTIVENESS_AUTHORITY_BLOB_DRIFT');
  assert.equal(effectiveness.focused_workflow_run_id, 30728994802);
  assert.deepEqual(effectiveness.focused_static_artifact, {
    id: 8827324149,
    digest: 'sha256:f9715d023630d2e10ca266296c9e5c33c559620229a25d54c2ebf1d11bccdc83',
  });
  assert.deepEqual(effectiveness.focused_normal_artifact, {
    id: 8827329167,
    digest: 'sha256:d92566861bed8fab683375fd3861bd55c47bfdddf71ce979ceb2507cbf8d337b',
  });
  assert.deepEqual(effectiveness.focused_rollback_artifact, {
    id: 8827329322,
    digest: 'sha256:703f03baca983867734afb96f1a8416016a2b7ac7b11f7d8a4d638cefb8c5ccb',
  });
  assert.equal(effectiveness.standard_ci_run_id, 30728994780);
  assert.deepEqual(effectiveness.standard_ci_artifact, {
    id: 8827386754,
    digest: 'sha256:be210cebad9475c24d77983fd42ba4b41111c65a7932406f723ae2efb1c98ff8',
  });
  assert.deepEqual(effectiveness.fresh_postgresql_modes, ['normal', 'rollback']);
  assert.equal(effectiveness.database_cleanup_pass, true);

  const resolution = decision.resolved_contradiction;
  assert.equal(resolution.previous_failure_code, 'STATE_LATEST_CAS_CONFLICT');
  assert.equal(resolution.resolution, 'DEDICATED_T17_PERSISTENCE_BRIDGE_EFFECTIVE_ON_TRUSTED_MAIN');
  assert.equal(resolution.corrected_t16_latest_before_t17, false);
  assert.equal(resolution.t17_computation_predecessor, 'CORRECTED_T16');
  assert.equal(resolution.t17_persistence_cas_predecessor, 'BASE_T16');
  assert.equal(resolution.latest_after_success, 'T17');
  assert.equal(resolution.post_transition_projection_divergence, 'FAIL_CLOSED_NO_AUTOMATIC_REPAIR');
  assert.equal(resolution.generic_cap04_source_unchanged, true);
  assert.equal(resolution.historical_s4_source_unchanged, true);
  assert.equal(resolution.qualification_only_carrier_unchanged, true);

  const retired = decision.retired_execution_history;
  assert.equal(git('rev-parse', `${base}:${retired.v9_authority_path}`), retired.v9_authority_blob_sha, 'V9_AUTHORITY_BLOB_DRIFT');
  assert.equal(retired.v9_authority_class, 'DEVELOPMENT_QUALIFICATION_ONLY');
  assert.equal(retired.v9_identity_reusable, false);
  assert.equal(retired.v9_database_identity_reusable, false);
  assert.equal(retired.v1_through_v9_authority_identities_reusable, false);
  assert.equal(retired.qualification_v3_authorized, false);

  const adjudication = decision.adjudication;
  assert.equal(adjudication.formal_authority_chain_previous_status, 'PAUSED');
  assert.equal(adjudication.formal_authority_chain_status, 'REOPENED_FOR_ONE_FINAL_REPLACEMENT_AUTHORITY_CANDIDATE');
  assert.equal(adjudication.recovery_basis_satisfied, true);
  assert.equal(adjudication.one_final_replacement_authority_candidate_may_be_created, true);
  assert.equal(adjudication.replacement_authority_identifier_assigned, false);
  assert.equal(adjudication.v10_authorized, false);
  assert.equal(adjudication.actual_execution_authority_present, false);
  assert.equal(adjudication.execution_authority_effective, false);
  assert.equal(adjudication.formal_database_execution_authorized, false);
  assert.equal(adjudication.workflow_dispatch_authorized, false);
  assert.equal(adjudication.formal_run_a_authorized, false);
  assert.equal(adjudication.formal_run_b_authorized, false);
  assert.equal(adjudication.cross_run_comparator_authorized, false);
  assert.equal(adjudication.s6_candidate_implemented, false);
  assert.equal(adjudication.stage_1a_end_to_end_closure_established, false);
  assert.equal(adjudication.mcft_cap_08_complete, false);
  assert.equal(adjudication.mcft_cap_09_authorized, false);

  assert.deepEqual(decision.one_final_replacement_authority_candidate_requirements, [
    'EXACT_CURRENT_MAIN_SUBJECT_SHA',
    'EXACT_FORMAL_WORKFLOW_BLOB',
    'EXACT_PRODUCT_SOURCE_AND_PORT_BUNDLE_BLOBS',
    'UNIQUE_FRESH_RUN_A_AND_RUN_B_OPERATIONAL_IDENTITIES',
    'UNIQUE_FRESH_RUN_A_AND_RUN_B_DATABASE_IDENTITIES',
    'V1_THROUGH_V9_IDENTITIES_RETIRED_AND_NON_REUSABLE',
    'ONE_SHOT_CONSUMPTION',
    'EXPLICIT_EXPIRY',
    'NO_RERUN',
    'MAX_PARALLEL_ONE',
    'NO_DATABASE_EXECUTION_IN_AUTHORITY_PR',
    'SEPARATE_AUTHORITY_EFFECTIVENESS_BEFORE_DISPATCH',
  ]);
  assert.equal(decision.first_legal_next_action_after_merge, 'CREATE_ONE_FINAL_REPLACEMENT_FORMAL_EXECUTION_AUTHORITY_CANDIDATE');
  assert.deepEqual(decision.forbidden_actions, [
    'ISSUE_OR_LABEL_V10_WITHOUT_SEPARATE_AUTHORITY_CANDIDATE',
    'REUSE_ANY_V1_THROUGH_V9_OPERATIONAL_OR_DATABASE_IDENTITY',
    'ADD_QUALIFICATION_V3',
    'CHANGE_GENERIC_CAP04_PERSISTENCE_OR_CAS',
    'MAKE_CORRECTED_T16_LATEST_BEFORE_T17',
    'CHANGE_QUALIFICATION_ONLY_CARRIER',
    'DISPATCH_FORMAL_DATABASE_EXECUTION_FROM_THIS_PR',
    'CLAIM_FORMAL_RUN_A_OR_FORMAL_RUN_B',
    'CLAIM_S6_CANDIDATE',
    'CLAIM_STAGE_1A_CLOSURE',
    'CLAIM_MCFT_CAP_08_COMPLETE',
    'AUTHORIZE_MCFT_CAP_09',
  ]);
  assert.deepEqual(decision.nonclaims, [
    'NO_EXECUTION_AUTHORITY_IN_THIS_ADJUDICATION',
    'NO_FORMAL_DATABASE_EXECUTION',
    'NO_WORKFLOW_DISPATCH',
    'NO_FORMAL_RUN_A',
    'NO_FORMAL_RUN_B',
    'NO_CROSS_RUN_COMPARATOR',
    'NO_S6_CANDIDATE',
    'NO_STAGE_1A_CLOSURE',
    'NO_CAP08_COMPLETION',
    'NO_CAP09_AUTHORITY',
  ]);

  const workflow = readText(WORKFLOW);
  assert.match(workflow, /pull_request:/);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /postgres|psql|DATABASE_URL|workflow_call:/i);
  assert.match(workflow, /ACCEPTANCE_MCFT_CAP_08_S6_FORMAL_AUTHORITY_CHAIN_RECOVERY_ADJUDICATION_V1\.cjs/);

  const result = {
    schema_version: 'geox_mcft_cap08_s6_formal_authority_chain_recovery_adjudication_result_v1',
    status: 'PASS',
    base_main_sha: base,
    exact_head_sha: exactCandidate,
    changed_file_count: changed.length,
    product_contradiction_resolved: true,
    corrected_t16_remained_non_latest: true,
    generic_cap04_unchanged: true,
    qualification_v3_authorized: false,
    v1_through_v9_identities_reusable: false,
    formal_authority_chain_status: 'REOPENED_FOR_ONE_FINAL_REPLACEMENT_AUTHORITY_CANDIDATE',
    actual_execution_authority_present: false,
    formal_database_execution_authorized: false,
    workflow_dispatch_authorized: false,
    next_action_after_merge: 'CREATE_ONE_FINAL_REPLACEMENT_FORMAL_EXECUTION_AUTHORITY_CANDIDATE',
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap08_s6_formal_authority_chain_recovery_adjudication_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.stack || error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
