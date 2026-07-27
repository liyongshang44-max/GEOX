#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.env.MCFT_REPO_ROOT
  ? path.resolve(process.env.MCFT_REPO_ROOT)
  : path.resolve(__dirname, '../..');
const BASE_SHA = '50e46a320a33800f2eb68f25e1ac6e25e20ea279';
const CAP08 = 'docs/digital_twin/mcft/cap_08/';
const PATHS = Object.freeze({
  ledger: `${CAP08}GEOX-MCFT-CAP-08-HARD-ACCEPTANCE-LEDGER-V1.json`,
  contract: `${CAP08}GEOX-MCFT-CAP-08-S6-CONTRACT-V1.json`,
  classification: `${CAP08}GEOX-MCFT-CAP-08-RUN-CLASSIFICATION-V1.json`,
  taskbook: `${CAP08}GEOX-MCFT-CAP-08-TASK.md`,
  retained: `${CAP08}GEOX-MCFT-CAP-08-TASK-v0.3.5-HISTORICAL-FULL.md`,
  mapping: `${CAP08}GEOX-MCFT-CAP-08-S6-HA-WITNESS-MAPPING-V1.json`,
  proofShard00: `${CAP08}GEOX-MCFT-CAP-08-S6-HA-PROOF-CONTRACTS-00-08-V1.json`,
  proofShard09: `${CAP08}GEOX-MCFT-CAP-08-S6-HA-PROOF-CONTRACTS-09-16-V1.json`,
  proofShard17: `${CAP08}GEOX-MCFT-CAP-08-S6-HA-PROOF-CONTRACTS-17-23-V1.json`,
  lifecycle: `${CAP08}GEOX-MCFT-CAP-08-S6-WITNESS-LIFECYCLE-V1.json`,
  manifest: `${CAP08}GEOX-MCFT-CAP-08-S6-CLOSURE-MEMBER-MANIFEST-CONTRACT-V1.json`,
  closureMapping: `${CAP08}GEOX-MCFT-CAP-08-S6-CLOSURE-CONTRACT-WITNESS-MAPPING-V1.json`,
  boundary: `${CAP08}GEOX-MCFT-CAP-08-S6-HA-MAPPING-BOUNDARY-V1.json`,
  generator: 'scripts/governance_acceptance/mcft_cap08_s6_materialize_ha_mapping_review.cjs',
  mappingValidation: 'scripts/governance_acceptance/mcft_cap08_s6_ha_mapping_validation.cjs',
  witnessValidation: 'scripts/governance_acceptance/mcft_cap08_s6_witness_contract_validation.cjs',
  coverage: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_LEDGER_COVERAGE.cjs',
  workflow: '.github/workflows/mcft-cap-08-s6-ha-mapping-governance.yml',
});
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_LEDGER_COVERAGE_RESULT.json');
const {
  materialize, writeReview, loadProofContracts, resolveProof,
} = require('./mcft_cap08_s6_materialize_ha_mapping_review.cjs');
const {
  duplicates, validateHaMapping,
} = require('./mcft_cap08_s6_ha_mapping_validation.cjs');
const {
  validateWitnessContracts,
} = require('./mcft_cap08_s6_witness_contract_validation.cjs');

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
  const proofShards = [
    readJson(PATHS.proofShard00),
    readJson(PATHS.proofShard09),
    readJson(PATHS.proofShard17),
  ];
  const lifecycle = readJson(PATHS.lifecycle);
  const manifest = readJson(PATHS.manifest);
  const closureMapping = readJson(PATHS.closureMapping);
  const boundary = readJson(PATHS.boundary);
  const materialized = materialize();
  const actualBlobs = Object.fromEntries(
    Object.entries(PATHS).map(([key, repoPath]) => [key, git('rev-parse', `HEAD:${repoPath}`)]),
  );

  const authorityBlobs = {
    ledger: 'd6e0000e1d0e5c88d927b94aaadc4bada07f6bd1',
    contract: '9cecc1aa6bd4063b770304f2539bc68a1ed2390c',
    classification: '86482874b1b557ca8bfa8b6812daa9666f49b128',
    taskbook: 'a24114ff629560345b3bd3cda6b4024b9f3d61e4',
    retained: 'ab4f4e7d9d3978ac3be979583cda4ccdc94a2fb6',
  };
  for (const [key, blobSha] of Object.entries(authorityBlobs)) {
    assert.equal(actualBlobs[key], blobSha, `AUTHORITY_BLOB_DRIFT:${key}`);
  }

  assert.equal(boundary.schema_version, 'geox_mcft_cap08_s6_ha_mapping_boundary_v3');
  assert.equal(boundary.record_status, 'PROPOSED_MAPPING_HUMAN_REVIEW_BOUNDARY');
  assert.equal(boundary.base_main_sha, baseSha);
  assert.equal(boundary.semantic_digest, semanticDigest(boundary));
  assert.equal(actualBlobs.mapping, boundary.mapping_blob_sha);
  assert.equal(actualBlobs.proofShard00, boundary.proof_contract_shard_blobs['00-08']);
  assert.equal(actualBlobs.proofShard09, boundary.proof_contract_shard_blobs['09-16']);
  assert.equal(actualBlobs.proofShard17, boundary.proof_contract_shard_blobs['17-23']);
  assert.equal(actualBlobs.lifecycle, boundary.lifecycle_blob_sha);
  assert.equal(actualBlobs.manifest, boundary.closure_member_manifest_contract_blob_sha);
  assert.equal(actualBlobs.closureMapping, boundary.closure_contract_mapping_blob_sha);
  assert.equal(actualBlobs.generator, boundary.review_generator_blob_sha);
  assert.equal(actualBlobs.mappingValidation, boundary.mapping_validation_blob_sha);
  assert.equal(actualBlobs.witnessValidation, boundary.witness_contract_validation_blob_sha);
  assert.equal(actualBlobs.coverage, boundary.coverage_gate_blob_sha);
  assert.equal(actualBlobs.workflow, boundary.workflow_blob_sha);

  const mappingResult = validateHaMapping({
    root: ROOT, paths: PATHS, baseSha, ledger, mapping, lifecycle, proofShards,
    materialized, actualBlobs, readJson, semanticDigest, loadProofContracts, resolveProof,
  });
  validateWitnessContracts({
    baseSha, contract, classification, lifecycle, manifest, closureMapping,
    semanticDigest, duplicates,
  });

  const changedFiles = git('diff', '--name-only', `${baseSha}...HEAD`)
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  assert.deepEqual(changedFiles, [...boundary.changed_files].sort());
  assert.equal(boundary.changed_file_count, changedFiles.length);
  for (const key of [
    'runtime_source_file_count', 'runtime_acceptance_file_count',
    'database_migration_file_count', 'route_file_count', 'web_file_count',
    'witness_producer_file_count', 'dual_run_workflow_file_count',
  ]) assert.equal(boundary[key], 0, `BOUNDARY_NONZERO:${key}`);
  assert.equal(boundary.candidate_declaration_present, false);
  assert.equal(boundary.mapping_human_review_complete, false);
  assert.equal(boundary.mapping_frozen, false);
  assert.equal(boundary.witness_implementation_authorized, false);
  assert.equal(boundary.dual_run_ci_authorized, false);

  const s6AcceptanceFiles = [
    ...listFiles('scripts/runtime_acceptance'),
    ...listFiles('scripts/governance_acceptance'),
  ].filter((repoPath) => /mcft.*cap.*08.*s6/i.test(repoPath));
  const forbiddenLiteralFiles = [];
  for (const repoPath of s6AcceptanceFiles) {
    const source = fs.readFileSync(path.join(ROOT, repoPath), 'utf8');
    for (const ledgerItem of ledger.items) {
      if (source.includes(ledgerItem.item_id) || source.includes(ledgerItem.requirement)) {
        forbiddenLiteralFiles.push(repoPath);
      }
    }
  }
  assert.deepEqual([...new Set(forbiddenLiteralFiles)].sort(), []);

  for (const value of [mapping, lifecycle]) {
    assert.equal(value.nonclaims.mapping_human_review_complete, false);
    assert.equal(value.nonclaims.mapping_frozen, false);
    assert.equal(value.nonclaims.witness_implementation_authorized, false);
    assert.equal(value.nonclaims.dual_run_ci_authorized, false);
  }

  writeReview(materialized);
  const result = {
    schema_version: 'geox_mcft_cap08_s6_ledger_coverage_result_v3',
    status: 'PASS',
    base_sha: baseSha,
    subject_sha: git('rev-parse', 'HEAD'),
    ledger_item_count: mappingResult.ledgerItemCount,
    mapping_rule_count: mapping.rules.length,
    proof_contract_count: mappingResult.proofRequirementCount,
    materialized_mapping_item_count: materialized.items.length,
    item_id_exact_set_equality: true,
    requirement_exact_equality: true,
    static_item_id_literal_count: 0,
    static_requirement_literal_count: 0,
    duplicate_item_id_count: 0,
    unknown_item_id_count: 0,
    missing_item_id_count: 0,
    proof_phase_compatible: true,
    per_run_ledger_item_count: mappingResult.perRunRuleCount,
    per_run_witness_instance_count: mappingResult.perRunWitnessInstances,
    total_ha_phase_witness_instance_count:
      mappingResult.perRunWitnessInstances + mappingResult.crossRunWitnessInstances
      + mappingResult.mergeWitnessInstances + mappingResult.retentionWitnessInstances,
    merge_and_retention_producers_separate: true,
    canonical_operational_identity_separated: true,
    closure_member_manifest_contract_present: true,
    non_ledger_closure_contract_mapping_present: true,
    pass_without_eligible_phase_forbidden: true,
    pass_without_artifact_or_witness_forbidden: true,
    mapping_blob_sha: actualBlobs.mapping,
    proof_contract_shard_blobs: boundary.proof_contract_shard_blobs,
    lifecycle_blob_sha: actualBlobs.lifecycle,
    closure_member_manifest_contract_blob_sha: actualBlobs.manifest,
    closure_contract_mapping_blob_sha: actualBlobs.closureMapping,
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
    schema_version: 'geox_mcft_cap08_s6_ledger_coverage_result_v3',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  writeResult(result);
  throw error;
}
