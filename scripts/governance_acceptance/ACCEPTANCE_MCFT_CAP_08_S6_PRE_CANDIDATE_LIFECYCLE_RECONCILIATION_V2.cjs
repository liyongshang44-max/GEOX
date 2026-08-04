#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const BASE_SHA = '417de6690f4b525f1d4dac8a3d284a4197f1d8e0';
const WORKFLOW = '.github/workflows/mcft-cap-08-s6-pre-candidate-governance.yml';
const RECORD = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PRE-CANDIDATE-LIFECYCLE-RECONCILIATION-V2.json';
const SCRIPT = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_PRE_CANDIDATE_LIFECYCLE_RECONCILIATION_V2.cjs';
const STATUS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-DELIVERY-STATUS-V1.json';
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_PRE_CANDIDATE_LIFECYCLE_RECONCILIATION_RESULT.json');

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
  assert.equal(baseSha, BASE_SHA, 'LIFECYCLE_RECONCILIATION_BASE_SHA_DRIFT');
  assert.equal(git('merge-base', baseSha, 'HEAD'), baseSha, 'BASE_NOT_ANCESTOR');
  assert.equal(git('diff', '--check', `${baseSha}...HEAD`), '', 'LIFECYCLE_DELTA_DIFF_CHECK_FAILED');

  const record = readJson(RECORD);
  const changedFiles = git('diff', '--name-only', `${baseSha}...HEAD`)
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
  assert.deepEqual(changedFiles, [...record.changed_files].sort());
  assert.equal(changedFiles.length, 3);
  assert.equal(record.changed_file_count, 3);
  assert.equal(record.base_main_sha, baseSha);
  assert.equal(record.record_status, 'PRE_CANDIDATE_WORKFLOW_LIFECYCLE_RECONCILED_FOR_FORMAL_CANDIDATE');
  assert.equal(record.semantic_digest, semanticDigest(record));

  assert.equal(git('rev-parse', `${baseSha}:${WORKFLOW}`), record.defect.workflow_blob_sha);
  assert.equal(record.discovered_by_pr, 2812);
  assert.equal(record.failed_workflow_run, 30904373573);
  assert.equal(record.failed_job_id, 91975888328);
  assert.equal(record.failed_focused_workflow_run, 30904373536);
  assert.equal(record.failed_focused_workflow_conclusion, 'success');
  assert.equal(record.defect.classification_fallback, 'historical');
  assert.equal(record.defect.historical_base_sha, '19f75275a223caa5196982344be57c871e7755d2');
  assert.equal(record.defect.candidate_logic_defect, false);
  assert.equal(record.defect.formal_evidence_defect, false);
  assert.equal(record.defect.hard_acceptance_mapping_defect, false);
  assert.equal(record.defect.product_runtime_defect, false);

  const status = readJson(STATUS);
  assert.equal(status.s6_candidate_implemented, false);
  assert.equal(status.mcft_cap_08_complete, false);
  assert.equal(status.mcft_cap_09_authorized, false);
  assert.equal(record.s6_candidate_implemented, false);
  assert.equal(record.mcft_cap_08_complete, false);
  assert.equal(record.mcft_cap_09_authorized, false);

  const workflow = fs.readFileSync(path.join(ROOT, WORKFLOW), 'utf8');
  assert.equal(workflow.includes('mode=candidate-signal'), true);
  assert.equal(workflow.includes('mode=inactive'), true);
  assert.equal(workflow.includes('mode=lifecycle-v2'), true);
  assert.equal(workflow.includes('mode=historical-package'), true);
  assert.equal(workflow.includes("mode=historical\" >>"), false);
  assert.equal(workflow.includes("steps.validation-mode.outputs.mode == 'historical-package'"), true);
  assert.equal(workflow.includes("steps.validation-mode.outputs.mode == 'candidate-signal'"), true);
  assert.equal(workflow.includes("steps.validation-mode.outputs.mode == 'inactive'"), true);
  assert.equal(workflow.includes('formal_candidate_transition_detected_from_status_false_to_true'), false);
  assert.equal(workflow.includes('s6_candidate_implemented'), true);
  assert.equal(workflow.includes('base_candidate'), true);
  assert.equal(workflow.includes('head_candidate'), true);
  assert.equal(workflow.includes('MCFT_BASE_SHA: 19f75275a223caa5196982344be57c871e7755d2'), true);
  assert.equal(workflow.includes(`'${RECORD}'`), true);
  assert.equal(workflow.includes(`'${SCRIPT}'`), true);
  assert.equal(workflow.includes('ACCEPTANCE_MCFT_CAP_08_S6_PRE_CANDIDATE_LIFECYCLE_RECONCILIATION_V2.cjs'), true);
  assert.equal(workflow.includes('pre_candidate_historical_validator_executed: false'), true);
  assert.equal(workflow.includes('candidate_validation_delegated_to_registered_focused_workflow'), true);

  assert.equal(record.resolution.formal_candidate_transition_detected_from_status_false_to_true, true);
  assert.equal(record.resolution.candidate_signal_mode_added, true);
  assert.equal(record.resolution.inactive_mode_added, true);
  assert.equal(record.resolution.historical_validator_runs_only_for_exact_historical_package, true);
  assert.equal(record.resolution.stale_fixed_base_not_used_for_formal_candidate, true);
  assert.equal(record.resolution.candidate_head_mutation_allowed, false);
  assert.equal(record.resolution.failed_candidate_pr_closed_unmerged, true);
  assert.equal(record.resolution.candidate_rebuild_required_after_reconciliation_merge, true);
  assert.equal(record.resolution.technical_gate_relaxation, false);
  assert.equal(record.resolution.focused_candidate_workflow_preserved, true);
  assert.equal(record.resolution.standard_ci_preserved, true);
  assert.equal(record.resolution.merge_group_support_preserved, true);

  assert.equal(record.runtime_source_file_count, 0);
  assert.equal(record.runtime_acceptance_file_count, 0);
  assert.equal(record.database_migration_file_count, 0);
  assert.equal(record.formal_database_execution, false);
  assert.equal(record.formal_comparator_execution, false);
  assert.equal(record.candidate_declaration_present, false);
  assert.equal(changedFiles.some((repoPath) => repoPath.startsWith('apps/')), false);
  assert.equal(changedFiles.some((repoPath) => repoPath.startsWith('scripts/runtime_acceptance/')), false);

  const result = {
    schema_version: 'geox_mcft_cap08_s6_pre_candidate_lifecycle_reconciliation_result_v2',
    status: 'PASS',
    base_sha: baseSha,
    subject_sha: git('rev-parse', 'HEAD'),
    changed_file_count: changedFiles.length,
    formal_candidate_transition_detection_added: true,
    candidate_signal_delegates_to_registered_focused_workflow: true,
    historical_validator_confined_to_exact_historical_package: true,
    stale_historical_base_not_used_for_candidate: true,
    failed_candidate_pr_closed_unmerged: true,
    candidate_rebuild_required: true,
    runtime_source_delta: 0,
    runtime_acceptance_delta: 0,
    database_migration_delta: 0,
    technical_gate_relaxation: false,
  };
  writeResult(result);
  console.log(JSON.stringify(result));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap08_s6_pre_candidate_lifecycle_reconciliation_result_v2',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  writeResult(result);
  throw error;
}
