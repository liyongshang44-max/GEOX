#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const CAP = 'docs/digital_twin/mcft/cap_08';
const BOUNDARY = `${CAP}/GEOX-MCFT-CAP-08-S6-HA-MAPPING-FREEZE-BOUNDARY-V1.json`;
const FREEZE = `${CAP}/GEOX-MCFT-CAP-08-S6-HA-MAPPING-FREEZE-AUTHORITY-V1.json`;
const WITNESS = `${CAP}/GEOX-MCFT-CAP-08-S6-WITNESS-IMPLEMENTATION-AUTHORITY-V1.json`;
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_HA_MAPPING_FREEZE_RESULT.json');
const { validateMapping } = require('./mcft_cap08_s6_ha_mapping_validation.cjs');
const { validateWitnessContracts } = require('./mcft_cap08_s6_witness_contract_validation.cjs');
const { materialize } = require('./mcft_cap08_s6_materialize_ha_mapping_review.cjs');
function readJson(repoPath) { return JSON.parse(fs.readFileSync(path.join(ROOT, repoPath), 'utf8')); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function semanticDigest(value) {
  const copy = structuredClone(value);
  delete copy.semantic_digest;
  return `sha256:${crypto.createHash('sha256').update(canonical(copy)).digest('hex')}`;
}
function git(...args) { return cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function gitBlob(repoPath, ref = 'HEAD') { return git('rev-parse', `${ref}:${repoPath}`); }
function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}
try {
  const boundary = readJson(BOUNDARY);
  const freeze = readJson(FREEZE);
  const witness = readJson(WITNESS);
  const base = String(process.env.MCFT_BASE_SHA || boundary.base_main_sha).trim();
  assert.equal(base, boundary.base_main_sha, 'BASE_SHA_DRIFT');
  assert.equal(git('merge-base', base, 'HEAD'), base, 'BASE_NOT_ANCESTOR');
  assert.equal(git('diff', '--check', `${base}...HEAD`), '', 'DIFF_CHECK_FAILED');
  const changed = git('diff', '--name-only', `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, [...boundary.changed_files].sort(), 'CHANGED_FILE_BOUNDARY');
  assert.equal(boundary.changed_file_count, 5);
  for (const prefix of ['apps/', 'packages/', 'db/', 'migrations/', 'scripts/runtime_acceptance/']) {
    assert.equal(changed.some((file) => file.startsWith(prefix)), false, `FORBIDDEN_PREFIX:${prefix}`);
  }
  assert.equal(boundary.semantic_digest, semanticDigest(boundary), 'BOUNDARY_SEMANTIC_DIGEST');
  assert.equal(freeze.semantic_digest, semanticDigest(freeze), 'FREEZE_SEMANTIC_DIGEST');
  assert.equal(witness.semantic_digest, semanticDigest(witness), 'WITNESS_AUTHORITY_SEMANTIC_DIGEST');
  assert.equal(freeze.record_status, 'HA_MAPPING_FROZEN');
  assert.equal(freeze.human_disposition.observed_value, 'APPROVED_FOR_FREEZE');
  assert.equal(freeze.review_subject.pull_request_number, 2695);
  assert.equal(freeze.review_subject.exact_head_sha, '4c9ac5f6d35c686fc810fe58b41fcb74629542ab');
  assert.equal(freeze.review_subject.exact_tree_sha, '11057edc4c46bd947354d2abbf45f56b87273bd9');
  assert.equal(freeze.review_subject.merge_commit_sha, boundary.base_main_sha);
  assert.equal(git('rev-parse', `${freeze.review_subject.merge_commit_sha}^{tree}`), freeze.review_subject.exact_tree_sha, 'MERGE_TREE_NOT_REVIEW_TREE');
  assert.equal(git('diff', '--name-only', freeze.review_subject.exact_head_sha, freeze.review_subject.merge_commit_sha), '', 'CANDIDATE_TO_MERGE_FILE_DELTA');
  assert.equal(freeze.focused_evidence.artifact_digest, 'sha256:8df60aeab0dac170f0d96fae7d56fb93bff545ffd34b2fd74da315b218c4ed9c');
  assert.equal(freeze.focused_evidence.materialized_mapping_review_json_digest, 'sha256:114d5ed884b71bbeac389e55625a5de88c778d02bfc18e1e8a1ebe9a6aaefd14');
  assert.equal(freeze.focused_evidence.materialized_mapping_review_markdown_digest, 'sha256:0895f79261b556935e6b7eed37829e629370437058ea3a41ae34b2d16eb636e4');
  assert.equal(freeze.frozen_package.file_count, 16);
  for (const file of freeze.frozen_package.files) assert.equal(gitBlob(file.path), file.blob_sha, `FROZEN_PACKAGE_BLOB_DRIFT:${file.path}`);
  assert.equal(witness.record_status, 'WITNESS_IMPLEMENTATION_AUTHORIZED');
  assert.equal(witness.mapping_freeze_authority.blob_sha, gitBlob(FREEZE), 'FREEZE_AUTHORITY_BLOB_BINDING');
  assert.equal(witness.authority_scope.witness_implementation_authorized, true);
  assert.equal(witness.forbidden_scope.dual_run_ci_authorized, false);
  assert.equal(witness.forbidden_scope.final_formal_closure_run_authorized, false);
  assert.equal(witness.forbidden_scope.runtime_product_source_change_authorized, false);
  const proposal = readJson(`${CAP}/GEOX-MCFT-CAP-08-S6-HA-WITNESS-MAPPING-V1.json`);
  const lifecycle = readJson(`${CAP}/GEOX-MCFT-CAP-08-S6-WITNESS-LIFECYCLE-V1.json`);
  assert.equal(proposal.record_status, 'PROPOSED_FOR_HUMAN_REVIEW', 'PROPOSAL_BLOB_MUTATED');
  assert.equal(proposal.nonclaims.mapping_frozen, false, 'PROPOSAL_SELF_FREEZE_FORBIDDEN');
  assert.equal(lifecycle.mapping_frozen, false, 'LIFECYCLE_SELF_FREEZE_FORBIDDEN');
  const mapping = validateMapping({ strictAuthorityBlobs: true });
  const contracts = validateWitnessContracts({ strictAuthorityBlobs: true });
  const review = materialize({ strictAuthorityBlobs: true });
  assert.equal(review.item_count, 24);
  assert.equal(mapping.rule_count, 24);
  assert.equal(mapping.proof_contract_count, 25);
  assert.equal(contracts.expected_phase_witness_instance_count, 47);
  const identityText = fs.readFileSync(path.join(ROOT, FREEZE), 'utf8') + fs.readFileSync(path.join(ROOT, WITNESS), 'utf8');
  assert.equal((identityText.match(/"item_id"\s*:/g) || []).length, 0, 'HANDWRITTEN_ITEM_ID');
  assert.equal((identityText.match(/"requirement"\s*:/g) || []).length, 0, 'HANDWRITTEN_REQUIREMENT');
  const reviewJsonPath = process.env.MCFT_OWNER_REVIEW_JSON;
  assert.ok(reviewJsonPath, 'OWNER_REVIEW_JSON_REQUIRED');
  const ownerReview = JSON.parse(fs.readFileSync(reviewJsonPath, 'utf8'));
  assert.equal(Number(ownerReview.id), freeze.human_disposition.github_review_id, 'OWNER_REVIEW_ID');
  assert.equal(ownerReview.commit_id, freeze.human_disposition.github_review_commit_sha, 'OWNER_REVIEW_COMMIT');
  assert.equal(ownerReview.state, freeze.human_disposition.github_review_state, 'OWNER_REVIEW_STATE');
  assert.ok(String(ownerReview.body).includes('OWNER DISPOSITION: APPROVED_FOR_FREEZE'), 'OWNER_DISPOSITION_BODY');
  assert.ok(String(ownerReview.body).includes(freeze.review_subject.exact_head_sha), 'OWNER_DISPOSITION_HEAD');
  assert.ok(String(ownerReview.body).includes(freeze.focused_evidence.artifact_digest), 'OWNER_DISPOSITION_ARTIFACT');
  for (const [repoPath, expectedBlob] of Object.entries(boundary.file_blobs)) assert.equal(gitBlob(repoPath), expectedBlob, `FREEZE_BOUNDARY_BLOB:${repoPath}`);
  const result = {
    schema_version: 'geox_mcft_cap08_s6_ha_mapping_freeze_result_v1',
    status: 'PASS',
    subject_sha: git('rev-parse', 'HEAD'),
    base_main_sha: base,
    reviewed_head_sha: freeze.review_subject.exact_head_sha,
    reviewed_tree_sha: freeze.review_subject.exact_tree_sha,
    merge_commit_sha: freeze.review_subject.merge_commit_sha,
    owner_review_id: freeze.human_disposition.github_review_id,
    frozen_package_file_count: freeze.frozen_package.file_count,
    ledger_item_count: review.item_count,
    mapping_rule_count: mapping.rule_count,
    proof_contract_count: mapping.proof_contract_count,
    expected_phase_witness_instance_count: contracts.expected_phase_witness_instance_count,
    mapping_human_review_complete: true,
    mapping_frozen: true,
    witness_implementation_authorized: true,
    dual_run_ci_authorized: false,
    final_formal_closure_run_authorized: false,
    s6_candidate_implemented: false,
    mcft_cap_08_complete: false,
    mcft_cap_09_authorized: false
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  write({ schema_version: 'geox_mcft_cap08_s6_ha_mapping_freeze_result_v1', status: 'FAIL', error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exitCode = 1;
}
