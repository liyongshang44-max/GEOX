#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASE_SHA = 'af56ee8efa432bdf88fb00173707cbb2157add55';
const WORKFLOW = '.github/workflows/mcft-cap-08-s6-pre-candidate-governance.yml';
const RECORD = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PRE-CANDIDATE-TRIGGER-RECONCILIATION-V1.json';
const SCRIPT = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_PRE_CANDIDATE_TRIGGER_RECONCILIATION.cjs';
const HISTORICAL_ACCEPTANCE = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_PRE_CANDIDATE_GOVERNANCE.cjs';
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_PRE_CANDIDATE_TRIGGER_RECONCILIATION_RESULT.json');

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

try {
  const baseSha = String(process.env.MCFT_BASE_SHA || BASE_SHA).trim();
  assert.equal(baseSha, BASE_SHA, 'RECONCILIATION_BASE_SHA_DRIFT');
  assert.equal(git('merge-base', baseSha, 'HEAD'), baseSha, 'BASE_NOT_ANCESTOR');
  assert.equal(git('diff', '--check', `${baseSha}...HEAD`), '', 'DIFF_CHECK_FAILED');

  const record = readJson(RECORD);
  const changedFiles = git('diff', '--name-only', `${baseSha}...HEAD`)
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  assert.deepEqual(changedFiles, [...record.changed_files].sort());
  assert.equal(changedFiles.length, 3);
  assert.equal(record.changed_file_count, 3);
  assert.equal(record.base_main_sha, baseSha);
  assert.equal(record.record_status, 'NON_CANDIDATE_WORKFLOW_TRIGGER_RECONCILIATION');
  assert.equal(record.semantic_digest, semanticDigest(record));

  assert.equal(git('rev-parse', `${baseSha}:${WORKFLOW}`), record.historical_workflow_blob);
  assert.equal(git('rev-parse', `HEAD:${HISTORICAL_ACCEPTANCE}`), record.historical_acceptance_blob);
  assert.equal(git('rev-parse', `${baseSha}:${HISTORICAL_ACCEPTANCE}`), record.historical_acceptance_blob);

  const workflow = fs.readFileSync(path.join(ROOT, WORKFLOW), 'utf8');
  assert.equal(workflow.includes("'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-*'"), false);
  assert.equal(workflow.includes('Determine validation mode'), true);
  assert.equal(workflow.includes('mode=reconciliation'), true);
  assert.equal(workflow.includes('mode=historical'), true);
  assert.equal(workflow.includes('ACCEPTANCE_MCFT_CAP_08_S6_PRE_CANDIDATE_TRIGGER_RECONCILIATION.cjs'), true);
  assert.equal(workflow.includes('ACCEPTANCE_MCFT_CAP_08_S6_PRE_CANDIDATE_GOVERNANCE.cjs'), true);
  assert.equal(workflow.includes('MCFT_BASE_SHA: 19f75275a223caa5196982344be57c871e7755d2'), true);

  for (const repoPath of record.historical_package_paths) {
    assert.equal(workflow.includes(`'${repoPath}'`), true, `HISTORICAL_PATH_NOT_ENUMERATED:${repoPath}`);
  }
  assert.equal(workflow.includes(`'${RECORD}'`), true);
  assert.equal(workflow.includes(`'${SCRIPT}'`), true);

  assert.equal(record.defect.trigger_path, 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-*');
  assert.equal(record.defect.validation_boundary, 'EXACT_HISTORICAL_NINE_FILE_PRE_CANDIDATE_PACKAGE');
  assert.equal(record.defect.product_defect, false);
  assert.equal(record.defect.mapping_defect, false);
  assert.equal(record.resolution.wildcard_removed, true);
  assert.equal(record.resolution.historical_package_paths_enumerated_exactly, true);
  assert.equal(record.resolution.historical_acceptance_semantics_preserved, true);
  assert.equal(record.resolution.historical_base_sha_preserved, true);
  assert.equal(record.resolution.successor_mapping_files_trigger_historical_gate, false);

  assert.equal(record.runtime_source_file_count, 0);
  assert.equal(record.runtime_acceptance_file_count, 0);
  assert.equal(record.database_migration_file_count, 0);
  assert.equal(record.candidate_declaration_present, false);
  assert.equal(record.s6_candidate_implemented, false);
  assert.equal(record.mapping_frozen, false);
  assert.equal(record.witness_implementation_authorized, false);
  assert.equal(record.dual_run_ci_authorized, false);
  assert.equal(record.mcft_cap_08_complete, false);
  assert.equal(record.mcft_cap_09_authorized, false);
  assert.equal(changedFiles.some((repoPath) => repoPath.startsWith('apps/server/')), false);
  assert.equal(changedFiles.some((repoPath) => repoPath.startsWith('scripts/runtime_acceptance/')), false);

  const result = {
    schema_version: 'geox_mcft_cap08_s6_pre_candidate_trigger_reconciliation_result_v1',
    status: 'PASS',
    base_sha: baseSha,
    subject_sha: git('rev-parse', 'HEAD'),
    changed_file_count: changedFiles.length,
    wildcard_removed: true,
    historical_package_paths_enumerated_exactly: true,
    historical_acceptance_blob_preserved: true,
    historical_base_sha_preserved: true,
    successor_mapping_files_trigger_historical_gate: false,
    runtime_source_delta: 0,
    runtime_acceptance_delta: 0,
    candidate_declaration_present: false,
    s6_candidate_implemented: false,
    mapping_frozen: false,
    witness_implementation_authorized: false,
    dual_run_ci_authorized: false,
  };
  writeResult(result);
  console.log(JSON.stringify(result));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap08_s6_pre_candidate_trigger_reconciliation_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  writeResult(result);
  throw error;
}
