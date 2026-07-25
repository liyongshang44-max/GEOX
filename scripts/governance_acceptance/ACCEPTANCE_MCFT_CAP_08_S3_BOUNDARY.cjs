#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '3343eb65d1d7dab55166f199bb8670b683a83847';
const p = (name) => `docs/digital_twin/mcft/cap_08/${name}`;
const FILE = {
  taskbook: p('GEOX-MCFT-CAP-08-TASK.md'),
  status: p('GEOX-MCFT-CAP-08-S3-DELIVERY-STATUS-V1.json'),
  implementation: p('GEOX-MCFT-CAP-08-S3-IMPLEMENTATION-V1.json'),
  boundary: p('GEOX-MCFT-CAP-08-S3-CANDIDATE-CHANGED-FILE-BOUNDARY-V1.json'),
  contract: p('GEOX-MCFT-CAP-08-S3-CONTRACT-V1.json'),
  review: p('GEOX-MCFT-CAP-08-S3-REVIEW-POLICY-V1.json'),
  waiver: p('GEOX-MCFT-CAP-08-INTERIM-OWNER-REVIEW-WAIVER-V1.json'),
  predecessor: p('GEOX-MCFT-CAP-08-S3-PREDECESSOR-CONSUMPTION-V1.json'),
  s4Status: p('GEOX-MCFT-CAP-08-S4-DELIVERY-STATUS-V1.json'),
  s4Contract: p('GEOX-MCFT-CAP-08-S4-CONTRACT-V1.json'),
  registry: 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json',
  focused: '.github/workflows/mcft-cap-08-s3-decision-action-feedback.yml',
  exact: '.github/workflows/mcft-cap-08-s3-exact-sha-attestation.yml',
};
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S3_BOUNDARY_RESULT.json');
const FROZEN = [
  'apps/server/src/domain/twin_runtime/canonical_identity_v1.ts',
  'scripts/runtime_acceptance/mcft_cap08_s2_g3_acceptance_support_v1.ts',
];
const DEVELOPMENT_ONLY = [
  '.github/workflows/mcft-cap-08-s3-development-preflight.yml',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S3_DEVELOPMENT_BOUNDARY.cjs',
  'scripts/governance_acceptance/mcft_cap08_s3_preflight_finalize.cjs',
  'scripts/runtime_acceptance/MCFT_CAP_08_S3_PREFLIGHT.ps1',
];

const git = (...args) => cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const json = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const text = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}
function commit(value, code) {
  const sha = String(value || '').trim();
  assert.match(sha, /^[0-9a-f]{40}$/, code);
  return git('rev-parse', `${sha}^{commit}`);
}
function changed(base) {
  const raw = git('diff', '--name-only', `${base}...HEAD`);
  return raw ? raw.split(/\r?\n/).filter(Boolean).sort() : [];
}

try {
  const base = commit(process.env.MCFT_BASE_SHA, 'S3_FORMAL_BASE_SHA_INVALID');
  assert.equal(base, BASE, 'S3_FORMAL_BASE_MISMATCH');
  assert.equal(git('merge-base', base, 'HEAD'), base, 'S3_FORMAL_BASE_NOT_ANCESTOR');
  assert.equal(git('diff', '--check', `${base}...HEAD`), '', 'S3_FORMAL_DIFF_CHECK_FAILED');
  const taskbookBlob = git('rev-parse', `HEAD:${FILE.taskbook}`);
  assert.equal(taskbookBlob, git('rev-parse', `${base}:${FILE.taskbook}`), 'S3_FORMAL_TASKBOOK_BLOB_DRIFT');

  const status = json(FILE.status);
  const implementation = json(FILE.implementation);
  const boundary = json(FILE.boundary);
  const contract = json(FILE.contract);
  const review = json(FILE.review);
  const waiver = json(FILE.waiver);
  const predecessor = json(FILE.predecessor);
  const s4Status = json(FILE.s4Status);
  const s4Contract = json(FILE.s4Contract);
  const registry = json(FILE.registry);
  const actual = changed(base);

  assert.equal(status.record_status, 'FORMAL_S3_CANDIDATE_IMPLEMENTED_NOT_EFFECTIVE');
  assert.equal(status.s3_candidate_implemented, true);
  assert.equal(status.delivery_state, 'CANDIDATE_IMPLEMENTED_UNDER_OWNER_WAIVER_AWAITING_PROTECTED_MERGE_AND_EXACT_SHA_ATTESTATION');
  assert.equal(status.implementation_authorized, true);
  assert.equal(status.bounded_canonical_transaction_authorized, true);
  assert.equal(status.runtime_source_authorized, false);
  assert.equal(status.semantic_completion_authority_storage, 'twin_runtime_authority_snapshot_v1');
  assert.equal(status.semantic_completion_authority_kind, 'REALITY_BINDING');
  assert.equal(status.semantic_completion_authority_ref_namespace, 'cap08_s3_completion_tuple');
  assert.equal(status.canonical_completion_tuple_fact_authorized, false);
  assert.equal(status.normal_completed_rerun_repair_authorized, false);
  assert.equal(status.completed_rerun_corruption_case_count, 8);
  assert.equal(status.negative_case_count, 22);
  assert.equal(status.pointer_case_count, 6);
  for (const key of ['independent_review_required', 'independent_review_satisfied', 'independent_review_performed', 'technical_gate_relaxation', 'retroactive_exact_head_approval_claim_allowed']) assert.equal(status[key], false, `S3_STATUS_EXPECTED_FALSE:${key}`);
  assert.equal(status.independent_review_waived, true);
  assert.equal(status.final_s6_independent_review_required, true);
  assert.equal(status.s3_effective, false);
  assert.equal(status.s4_authorized, false);
  assert.equal(status.production_runtime_source_authorized, false);

  assert.equal(implementation.schema_version, 'geox_mcft_cap08_s3_implementation_v3');
  assert.equal(implementation.record_status, 'FORMAL_CANDIDATE_IMPLEMENTATION_PREPARED_NOT_EFFECTIVE');
  assert.equal(implementation.trusted_base_sha, base);
  assert.equal(implementation.taskbook_blob_sha, taskbookBlob);
  assert.equal(implementation.machine_contract_semantic_digest, contract.semantic_digest);
  assert.equal(implementation.formal_provider_contract_digest, status.formal_provider_contract_digest);
  assert.equal(implementation.source_manifest_file_count, 34);
  assert.equal(implementation.formal_run_cardinality.successful_tick_count, 24);
  assert.equal(implementation.completion_authority.generic_and_semantic_rows, 2);
  assert.equal(implementation.completion_authority.normal_runner_repair_authorized, false);
  assert.equal(implementation.completion_authority.canonical_completion_tuple_fact_authorized, false);
  assert.equal(implementation.negative_matrix.completed_rerun_corruption_case_count, 8);
  assert.equal(implementation.negative_matrix.case_count, 22);
  assert.equal(implementation.negative_matrix.pointer_case_count, 6);
  assert.equal(implementation.negative_matrix.visibility_metadata_mutation_count, 0);
  assert.equal(implementation.persistence_policy.migration_delta, 0);
  assert.equal(implementation.persistence_policy.business_schema_delta, 0);
  assert.equal(implementation.review_policy.mode, 'OWNER_WAIVED_DEFERRED_TO_S6');
  for (const key of ['independent_review_required', 'independent_review_satisfied', 'independent_review_performed', 'technical_gate_relaxation']) assert.equal(implementation.review_policy[key], false, `S3_IMPLEMENTATION_REVIEW_EXPECTED_FALSE:${key}`);
  assert.equal(implementation.review_policy.independent_review_waived, true);
  assert.equal(implementation.review_policy.final_s6_independent_review_required, true);
  assert.equal(implementation.successor_governance.s4_candidate_implemented, false);
  assert.equal(implementation.successor_governance.s4_implementation_authorized_before_s3_exact_sha, false);

  assert.equal(boundary.schema_version, 'geox_mcft_cap08_s3_candidate_changed_file_boundary_v3');
  assert.equal(boundary.record_status, 'FORMAL_S3_CANDIDATE_CHANGED_FILE_BOUNDARY_FROZEN');
  assert.equal(boundary.base_sha, base);
  assert.equal(boundary.taskbook_blob_sha, taskbookBlob);
  assert.equal(boundary.changed_file_count, 36);
  assert.equal(boundary.changed_file_count, boundary.changed_files.length);
  assert.deepEqual(actual, [...boundary.changed_files].sort(), 'S3_FORMAL_CHANGED_FILE_BOUNDARY_MISMATCH');
  assert.deepEqual({ workflows: boundary.workflow_file_count, runtime: boundary.runtime_source_file_count, ssot: boundary.candidate_ssot_file_count, governance: boundary.governance_acceptance_file_count, acceptance: boundary.runtime_acceptance_file_count }, { workflows: 2, runtime: 22, ssot: 3, governance: 3, acceptance: 6 });
  assert.equal(boundary.database_migration_file_count, 0);
  assert.equal(boundary.route_file_count, 0);
  assert.equal(boundary.web_file_count, 0);
  assert.equal(boundary.development_only_file_count, 0);
  assert.equal(boundary.review_mode, 'OWNER_WAIVED_DEFERRED_TO_S6');
  assert.equal(boundary.independent_review_required, false);
  assert.equal(boundary.independent_review_satisfied, false);
  assert.equal(boundary.independent_review_performed, false);
  assert.equal(boundary.independent_review_waived, true);
  assert.equal(boundary.technical_gate_relaxation, false);
  assert.equal(boundary.s4_successor_seed_required_on_base, true);
  assert.equal(boundary.s4_registry_rule_required_on_base, true);

  assert.equal(review.schema_version, 'geox_mcft_cap08_s3_review_policy_v2');
  assert.equal(review.independent_review_required, false);
  assert.equal(review.independent_review_satisfied, false);
  assert.equal(review.independent_review_performed, false);
  assert.equal(review.independent_review_waived, true);
  assert.equal(review.technical_gate_relaxation, false);
  assert.equal(review.final_closure_review.independent_review_required, true);
  assert.equal(waiver.policy_id, 'MCFT-CAP-08-S3-S5-INTERIM-OWNER-REVIEW-WAIVER-V1');
  assert.equal(waiver.final_closure_review_policy.independent_review_required, true);
  assert.equal(predecessor.predecessor_effective_status, 'S2_FORCING_EVIDENCE_STATE_FORECAST_IMPLEMENTED_EFFECTIVE');
  assert.equal(predecessor.effective_next_slice, 'S3');
  assert.equal(predecessor.readback_verified, true);

  assert.equal(s4Status.record_status, 'PRE_REGISTERED_SUCCESSOR_STATUS_SEED');
  assert.equal(s4Status.s4_candidate_implemented, false);
  assert.equal(s4Status.implementation_authorized, false);
  assert.equal(s4Status.s4_effective, false);
  assert.equal(s4Status.s5_authorized, false);
  assert.equal(s4Contract.record_status, 'FROZEN_PRE_CANDIDATE_MACHINE_CONTRACT');
  assert.equal(s4Contract.semantic_digest, 'sha256:03d1b613b135dbf04b02fd9d314ac517458642b0652522d5fa03973f1a538371');
  for (const file of [FILE.s4Status, FILE.s4Contract, FILE.registry]) assert.equal(git('rev-parse', `HEAD:${file}`), git('rev-parse', `${base}:${file}`), `S3_SUCCESSOR_GOVERNANCE_DRIFT:${file}`);
  const cap08 = registry.capabilities.find((entry) => entry.capability_line === 'MCFT-CAP-08');
  assert.ok(cap08, 'S3_CAP08_REGISTRY_ENTRY_MISSING');
  const s4Rules = cap08.candidate_transition_fields.filter((entry) => entry.status_file === FILE.s4Status && entry.field_path === 's4_candidate_implemented');
  assert.equal(s4Rules.length, 1, 'S3_S4_REGISTRY_RULE_CARDINALITY');
  assert.equal(s4Rules[0].focused_workflow, 'mcft-cap-08-s4-late-evidence-append-forward');

  for (const file of FROZEN) {
    assert.equal(git('rev-parse', `${base}:${file}`), git('rev-parse', `HEAD:${file}`), `S3_FORMAL_PREDECESSOR_BLOB_DRIFT:${file}`);
    assert.equal(actual.includes(file), false, `S3_FORMAL_PREDECESSOR_IN_CHANGESET:${file}`);
  }
  for (const file of DEVELOPMENT_ONLY) assert.equal(actual.includes(file), false, `S3_FORMAL_DEVELOPMENT_ONLY_FILE_FORBIDDEN:${file}`);
  for (const file of implementation.source_manifest_paths) assert.equal(fs.existsSync(path.join(ROOT, file)), true, `S3_FORMAL_SOURCE_MANIFEST_FILE_MISSING:${file}`);
  const forbidden = actual.filter((file) => file.startsWith('apps/server/db/migrations/') || file.startsWith('apps/server/src/routes/') || file.startsWith('apps/web/') || file.startsWith('docker/postgres/init/') || file.includes('scheduler') || file.includes('model_activation'));
  assert.deepEqual(forbidden, [], 'S3_FORMAL_FORBIDDEN_FILE_BOUNDARY');

  assert.equal(contract.semantic_digest, 'sha256:bc4355d20bea6ba127ffdaccc2bd19f2d950237d10bffb652479bb712739b8a5');
  const focused = text(FILE.focused);
  const exact = text(FILE.exact);
  for (const token of ['ACCEPTANCE_MCFT_CAP_08_S3_BOUNDARY.cjs', 'ACCEPTANCE_MCFT_CAP_08_S3_DECISION_ACTION_DB.ts', 'ACCEPTANCE_MCFT_CAP_08_S3_COMPLETED_RERUN_NEGATIVE_DB.ts', 'ACCEPTANCE_MCFT_CAP_08_S3_NEGATIVE_DB.ts', 'ACCEPTANCE_MCFT_CAP_08_S3_EDGE_SEMANTICS_DB.ts', 'mcft_cap08_s3_artifact_finalize.cjs']) assert.ok(focused.includes(token), `S3_FORMAL_FOCUSED_WORKFLOW_MISSING:${token}`);
  for (const token of ['ACCEPTANCE_MCFT_CAP_08_S3_EXACT_SHA_ATTESTATION.cjs', 'ACCEPTANCE_MCFT_CAP_08_S3_BOUNDARY.cjs', 'ACCEPTANCE_MCFT_CAP_08_S3_DECISION_ACTION_DB.ts', 'ACCEPTANCE_MCFT_CAP_08_S3_COMPLETED_RERUN_NEGATIVE_DB.ts', 'ACCEPTANCE_MCFT_CAP_08_S3_NEGATIVE_DB.ts', 'ACCEPTANCE_MCFT_CAP_08_S3_EDGE_SEMANTICS_DB.ts', 'mcft_cap08_s3_artifact_finalize.cjs', 'mcft_attestation_retention_store_v1.cjs']) assert.ok(exact.includes(token), `S3_FORMAL_EXACT_WORKFLOW_MISSING:${token}`);

  const result = {
    schema_version: 'geox_mcft_cap08_s3_boundary_result_v4', status: 'PASS', classification: 'FORMAL_S3_CANDIDATE_MODE',
    base_sha: base, candidate_sha: git('rev-parse', 'HEAD'), candidate_tree_sha: git('rev-parse', 'HEAD^{tree}'), taskbook_blob_sha: taskbookBlob,
    machine_contract_digest: contract.semantic_digest, provider_contract_digest: implementation.formal_provider_contract_digest,
    changed_file_count: actual.length, changed_files: actual, source_manifest_file_count: implementation.source_manifest_file_count,
    frozen_predecessor_file_count: FROZEN.length, review_mode: 'OWNER_WAIVED_DEFERRED_TO_S6', independent_review_required: false,
    independent_review_satisfied: false, independent_review_performed: false, independent_review_waived: true, technical_gate_relaxation: false,
    final_s6_independent_review_required: true, s3_candidate_implemented: true, s3_effective: false, s4_authorized: false,
    production_runtime_source_authorized: false,
  };
  write(result);
  console.log(JSON.stringify(result));
} catch (error) {
  const result = { schema_version: 'geox_mcft_cap08_s3_boundary_result_v4', status: 'FAIL', error: error instanceof Error ? error.message : String(error) };
  write(result);
  console.error(error);
  process.exitCode = 1;
}
