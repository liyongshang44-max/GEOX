#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASE_SHA = 'af56ee8efa432bdf88fb00173707cbb2157add55';
const DIR = 'docs/digital_twin/mcft/cap_08/';
const PATHS = Object.freeze({
  ledger: `${DIR}GEOX-MCFT-CAP-08-HARD-ACCEPTANCE-LEDGER-V1.json`,
  contract: `${DIR}GEOX-MCFT-CAP-08-S6-CONTRACT-V1.json`,
  classification: `${DIR}GEOX-MCFT-CAP-08-RUN-CLASSIFICATION-V1.json`,
  taskbook: `${DIR}GEOX-MCFT-CAP-08-TASK.md`,
  mapping: `${DIR}GEOX-MCFT-CAP-08-S6-HA-WITNESS-MAPPING-V1.json`,
  lifecycle: `${DIR}GEOX-MCFT-CAP-08-S6-WITNESS-LIFECYCLE-V1.json`,
  boundary: `${DIR}GEOX-MCFT-CAP-08-S6-HA-MAPPING-BOUNDARY-V1.json`,
});
const OUTPUT = path.join(
  ROOT,
  'acceptance-output/MCFT_CAP_08_S6_LEDGER_COVERAGE_RESULT.json',
);

function git(...args) {
  return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function readJson(repoPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, repoPath), 'utf8'));
}
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
function duplicates(values) {
  const seen = new Set();
  const duplicate = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate].sort();
}
function writeResult(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}
function listFiles(dirPath) {
  const absolute = path.join(ROOT, dirPath);
  if (!fs.existsSync(absolute)) return [];
  const output = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(dirPath, entry.name);
    if (entry.isDirectory()) output.push(...listFiles(child));
    else output.push(child.replaceAll('\\', '/'));
  }
  return output;
}

try {
  const baseSha = String(process.env.MCFT_BASE_SHA || BASE_SHA).trim();
  assert.equal(baseSha, BASE_SHA, 'MAPPING_BASE_SHA_DRIFT');
  assert.equal(git('merge-base', baseSha, 'HEAD'), baseSha, 'BASE_NOT_ANCESTOR');
  assert.equal(git('diff', '--check', `${baseSha}...HEAD`), '', 'DIFF_CHECK_FAILED');

  const ledger = readJson(PATHS.ledger);
  const contract = readJson(PATHS.contract);
  const classification = readJson(PATHS.classification);
  const mapping = readJson(PATHS.mapping);
  const lifecycle = readJson(PATHS.lifecycle);
  const boundary = readJson(PATHS.boundary);

  const actualBlobs = Object.fromEntries(
    Object.entries(PATHS).map(([key, repoPath]) => [key, git('rev-parse', `HEAD:${repoPath}`)]),
  );

  assert.equal(actualBlobs.ledger, 'd6e0000e1d0e5c88d927b94aaadc4bada07f6bd1');
  assert.equal(actualBlobs.contract, '9cecc1aa6bd4063b770304f2539bc68a1ed2390c');
  assert.equal(actualBlobs.classification, '86482874b1b557ca8bfa8b6812daa9666f49b128');
  assert.equal(actualBlobs.taskbook, 'a24114ff629560345b3bd3cda6b4024b9f3d61e4');
  assert.equal(actualBlobs.mapping, boundary.mapping_blob_sha);
  assert.equal(actualBlobs.lifecycle, boundary.lifecycle_blob_sha);

  assert.equal(ledger.schema_version, 'geox_mcft_cap08_hard_acceptance_ledger_v1');
  assert.equal(ledger.record_status, 'FROZEN_S0_CONTRACT');
  assert.equal(ledger.item_count, 24);
  assert.equal(ledger.items.length, 24);

  assert.equal(contract.hard_acceptance_contract.ledger_item_count, 24);
  assert.equal(contract.formal_run_contract.run_count, 2);
  assert.deepEqual(contract.formal_run_contract.run_ids, ['RUN_A', 'RUN_B']);
  assert.equal(contract.formal_run_contract.slice_acceptance_object_reuse_forbidden, true);
  assert.equal(contract.formal_run_contract.cross_run_stitching_forbidden, true);
  assert.equal(classification.classes.FINAL_FORMAL_CLOSURE_RUN.eligible_for_closure, true);
  assert.equal(classification.classes.SLICE_ACCEPTANCE_RUN.eligible_for_closure, false);

  assert.equal(mapping.schema_version, 'geox_mcft_cap08_s6_ha_witness_mapping_v1');
  assert.equal(mapping.record_status, 'PROPOSED_FOR_HUMAN_REVIEW');
  assert.equal(mapping.source_ledger.blob_sha, actualBlobs.ledger);
  assert.equal(mapping.source_ledger.item_count, ledger.item_count);
  assert.equal(mapping.mapping_item_count, 24);
  assert.equal(mapping.items.length, 24);
  assert.equal(mapping.semantic_digest, semanticDigest(mapping));

  assert.equal(lifecycle.schema_version, 'geox_mcft_cap08_s6_witness_lifecycle_v1');
  assert.equal(lifecycle.record_status, 'PROPOSED_FOR_HUMAN_REVIEW');
  assert.equal(lifecycle.semantic_digest, semanticDigest(lifecycle));

  const ledgerIds = ledger.items.map((item) => item.item_id);
  const mappingIds = mapping.items.map((item) => item.item_id);
  const ledgerRequirements = ledger.items.map((item) => item.requirement);
  const mappingRequirements = mapping.items.map((item) => item.requirement);
  const duplicateLedgerIds = duplicates(ledgerIds);
  const duplicateMappingIds = duplicates(mappingIds);
  const unknownIds = mappingIds.filter((itemId) => !ledgerIds.includes(itemId)).sort();
  const missingIds = ledgerIds.filter((itemId) => !mappingIds.includes(itemId)).sort();

  assert.deepEqual(duplicateLedgerIds, []);
  assert.deepEqual(duplicateMappingIds, []);
  assert.deepEqual(unknownIds, []);
  assert.deepEqual(missingIds, []);
  assert.deepEqual([...mappingIds].sort(), [...ledgerIds].sort());
  assert.deepEqual([...mappingRequirements].sort(), [...ledgerRequirements].sort());

  const allowedPhases = new Set(lifecycle.allowed_proof_phases);
  assert.deepEqual(mapping.allowed_proof_phases, lifecycle.allowed_proof_phases);
  assert.deepEqual(lifecycle.allowed_witness_statuses, ['PENDING', 'NOT_YET_ELIGIBLE', 'PASS', 'FAIL']);

  for (const [index, mapped] of mapping.items.entries()) {
    const source = ledger.items[index];
    assert.equal(mapped.ledger_index, index, `LEDGER_INDEX_MISMATCH:${index}`);
    assert.equal(mapped.identity_source, 'MATERIALIZED_FROM_FROZEN_LEDGER_INDEX');
    assert.equal(mapped.item_id, source.item_id, `ITEM_ID_MISMATCH:${index}`);
    assert.equal(mapped.requirement, source.requirement, `REQUIREMENT_MISMATCH:${index}`);
    assert.equal(mapped.finalization_phase, 'FINAL_SETTLEMENT');
    assert.ok(Array.isArray(mapped.required_proof_phases) && mapped.required_proof_phases.length > 0);
    for (const phase of mapped.required_proof_phases) assert.equal(allowedPhases.has(phase), true);
    assert.equal(typeof mapped.counting_domain, 'string');
    assert.notEqual(mapped.counting_domain.length, 0);
    assert.equal(typeof mapped.selector_id, 'string');
    assert.notEqual(mapped.selector_id.length, 0);
    assert.equal(mapped.selector_contract.global_type_count_forbidden, true);
    assert.equal(typeof mapped.expected_contract, 'object');
    assert.equal(typeof mapped.witness_producer, 'string');
    assert.notEqual(mapped.witness_producer.length, 0);
    assert.equal(typeof mapped.artifact_contract.artifact_name, 'string');
    assert.equal(mapped.artifact_contract.exact_subject_sha_required, true);
    assert.equal(mapped.artifact_contract.artifact_digest_required, true);
    assert.equal(mapped.artifact_contract.object_set_ref_required, true);
    assert.equal(mapped.artifact_contract.selector_observed_required, true);
    assert.equal(mapped.finalization_rule.not_yet_eligible_outside_required_phase, true);
    assert.equal(mapped.finalization_rule.pass_without_witness_forbidden, true);
    assert.equal(mapped.finalization_rule.slice_acceptance_reuse_forbidden, true);
    assert.equal(mapped.finalization_rule.cross_run_stitching_forbidden, true);
    assert.equal(Object.hasOwn(mapped, 'status'), false, `MAPPING_MUST_NOT_PREDECLARE_STATUS:${index}`);

    const ledgerAuthority = mapped.authority_refs.find((ref) => ref.role === 'ITEM_ID_AND_REQUIREMENT_SSOT');
    assert.ok(ledgerAuthority);
    assert.equal(ledgerAuthority.path, PATHS.ledger);
    assert.equal(ledgerAuthority.blob_sha, actualBlobs.ledger);
  }

  const phaseShapes = mapping.items.map((item) => item.required_proof_phases.join('+'));
  assert.equal(phaseShapes.filter((shape) => shape === 'CROSS_RUN').length, 1);
  assert.equal(phaseShapes.filter((shape) => shape === 'PER_RUN').length, 22);
  assert.equal(phaseShapes.filter((shape) => shape === 'MERGE_SHA+RETENTION_ATTESTATION').length, 1);

  const finalizers = lifecycle.producer_separation.filter((producer) => producer.may_finalize_ledger);
  assert.equal(finalizers.length, 1);
  assert.equal(finalizers[0].phase, 'FINAL_SETTLEMENT');
  assert.equal(lifecycle.eligibility_rules.phase_mismatch_status, 'NOT_YET_ELIGIBLE');
  assert.equal(lifecycle.eligibility_rules.pass_outside_required_phase_forbidden, true);
  assert.equal(lifecycle.eligibility_rules.pass_without_artifact_forbidden, true);
  assert.equal(lifecycle.eligibility_rules.pass_without_witness_forbidden, true);
  assert.equal(lifecycle.eligibility_rules.formal_closure_class_required, 'FINAL_FORMAL_CLOSURE_RUN');
  assert.equal(lifecycle.final_settlement.ledger_item_count, 24);
  assert.equal(lifecycle.final_settlement.all_items_pass_required, true);
  assert.equal(lifecycle.merge_binding.full_run_rerun_at_merge_sha_required, false);
  assert.equal(lifecycle.merge_binding.candidate_merge_tree_equality_required, true);
  assert.equal(lifecycle.retention_binding.level, 'R2');
  assert.equal(lifecycle.retention_binding.days, 730);

  assert.equal(mapping.nonclaims.mapping_human_review_complete, false);
  assert.equal(mapping.nonclaims.mapping_frozen, false);
  assert.equal(mapping.nonclaims.witness_implementation_authorized, false);
  assert.equal(mapping.nonclaims.dual_run_ci_authorized, false);
  assert.equal(lifecycle.nonclaims.mapping_human_review_complete, false);
  assert.equal(lifecycle.nonclaims.mapping_frozen, false);
  assert.equal(lifecycle.nonclaims.witness_implementation_authorized, false);
  assert.equal(lifecycle.nonclaims.dual_run_ci_authorized, false);

  const changedFiles = git('diff', '--name-only', `${baseSha}...HEAD`)
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  assert.deepEqual(changedFiles, [...boundary.changed_files].sort());
  assert.equal(boundary.changed_file_count, changedFiles.length);
  assert.equal(boundary.runtime_source_file_count, 0);
  assert.equal(boundary.runtime_acceptance_file_count, 0);
  assert.equal(boundary.database_migration_file_count, 0);
  assert.equal(boundary.route_file_count, 0);
  assert.equal(boundary.web_file_count, 0);
  assert.equal(boundary.witness_implementation_authorized, false);
  assert.equal(boundary.dual_run_ci_authorized, false);

  const witnessCandidateFiles = [
    ...listFiles('scripts/runtime_acceptance'),
    ...listFiles('scripts/governance_acceptance'),
  ].filter((repoPath) => /mcft.*cap.*08.*s6/i.test(repoPath) && /witness/i.test(repoPath));
  const forbiddenLiteralFiles = [];
  const ledgerRequirementSet = new Set(ledgerRequirements);
  for (const repoPath of witnessCandidateFiles) {
    if (repoPath === PATHS.mapping || repoPath === PATHS.lifecycle) continue;
    const source = fs.readFileSync(path.join(ROOT, repoPath), 'utf8');
    if (/\bHA-\d{2}\b/.test(source)) forbiddenLiteralFiles.push(repoPath);
    for (const requirement of ledgerRequirementSet) {
      if (source.includes(requirement)) forbiddenLiteralFiles.push(repoPath);
    }
  }
  assert.deepEqual([...new Set(forbiddenLiteralFiles)].sort(), []);

  const result = {
    schema_version: 'geox_mcft_cap08_s6_ledger_coverage_result_v1',
    status: 'PASS',
    base_sha: baseSha,
    subject_sha: git('rev-parse', 'HEAD'),
    ledger_item_count: ledger.items.length,
    witness_mapping_item_count: mapping.items.length,
    item_id_exact_set_equality: true,
    requirement_exact_equality: true,
    duplicate_item_id_count: 0,
    unknown_item_id_count: 0,
    missing_item_id_count: 0,
    proof_phase_compatible: true,
    pass_without_eligible_phase_forbidden: true,
    pass_without_artifact_or_witness_forbidden: true,
    mapping_blob_sha: actualBlobs.mapping,
    lifecycle_blob_sha: actualBlobs.lifecycle,
    mapping_record_status: mapping.record_status,
    mapping_human_review_complete: false,
    mapping_frozen: false,
    witness_implementation_authorized: false,
    dual_run_ci_authorized: false,
  };
  writeResult(result);
  console.log(JSON.stringify(result));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap08_s6_ledger_coverage_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  writeResult(result);
  throw error;
}
