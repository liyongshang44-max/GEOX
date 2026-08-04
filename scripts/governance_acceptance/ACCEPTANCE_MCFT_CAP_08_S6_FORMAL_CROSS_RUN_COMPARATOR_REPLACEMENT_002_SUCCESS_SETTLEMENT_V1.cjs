#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '5f8fa47f9ba0f6421fee9ff2eb5fa62ca4e4f642';
const SUBJECT = 'ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59';
const SEMANTIC_DIGEST = 'sha256:32c93d4f5ecd1fc50ff94418407767b48b057d77c81bf93dfe3fccf58f0df2f8';
const AUTHORITY = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-EXECUTION-AUTHORITY-EFFECTIVE-V1.json';
const CONSUMPTION = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-AUTHORITY-CONSUMPTION-V1.json';
const SETTLEMENT = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-SUCCESS-SETTLEMENT-V1.json';
const BOUNDARY = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-SUCCESS-SETTLEMENT-BOUNDARY-V1.json';
const WORKFLOW = '.github/workflows/mcft-cap-08-s6-formal-comparator-replacement-002-success-settlement.yml';
const VALIDATOR = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_FORMAL_CROSS_RUN_COMPARATOR_REPLACEMENT_002_SUCCESS_SETTLEMENT_V1.cjs';
const EXECUTION_WORKFLOW = '.github/workflows/mcft-cap-08-s6-formal-cross-run-comparator-execution.yml';
const BROKER_WORKFLOW = '.github/workflows/mcft-cap-08-s6-formal-comparator-replacement-002-one-shot-dispatch-broker.yml';
const CHANGED = [WORKFLOW, CONSUMPTION, SETTLEMENT, BOUNDARY, VALIDATOR].sort();
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_FORMAL_COMPARATOR_REPLACEMENT_002_SUCCESS_SETTLEMENT_RESULT.json');

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const readJson = (file) => JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
const readExternal = (name) => {
  const value = String(process.env[name] || '').trim();
  assert.ok(value, `${name}_REQUIRED`);
  return JSON.parse(fs.readFileSync(path.resolve(value), 'utf8'));
};

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function semanticDigest(record) {
  const copy = structuredClone(record);
  delete copy.semantic_digest;
  return `sha256:${crypto.createHash('sha256').update(canonical(copy)).digest('hex')}`;
}

function save(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}

function artifactById(items, id, label) {
  const item = items.find((candidate) => candidate.id === id);
  assert.ok(item, `${label}_ARTIFACT_REQUIRED`);
  return item;
}

try {
  const base = String(process.env.MCFT_BASE_SHA || BASE).trim();
  assert.equal(base, BASE, 'BASE_MAIN_SHA');
  assert.equal(git('merge-base', BASE, 'HEAD'), BASE, 'BASE_NOT_ANCESTOR');
  assert.equal(git('rev-list', '--count', `${BASE}..HEAD`), '5', 'COMMIT_COUNT');
  assert.equal(git('diff', '--check', `${BASE}...HEAD`), '', 'DIFF_CHECK');
  assert.deepEqual(
    git('diff', '--name-only', `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort(),
    CHANGED,
    'EXACT_FIVE_FILE_BOUNDARY',
  );

  const authority = JSON.parse(git('show', `${BASE}:${AUTHORITY}`));
  const consumption = readJson(CONSUMPTION);
  const settlement = readJson(SETTLEMENT);
  const boundary = readJson(BOUNDARY);
  for (const record of [consumption, settlement, boundary]) {
    assert.equal(record.semantic_digest, semanticDigest(record), `SEMANTIC_DIGEST:${record.schema_version}`);
  }

  assert.equal(git('rev-parse', `${BASE}:${AUTHORITY}`), '591ad3c6c188d19c9e6eff89382e147854f25b63');
  assert.equal(git('rev-parse', `HEAD:${AUTHORITY}`), '591ad3c6c188d19c9e6eff89382e147854f25b63');
  assert.equal(git('rev-parse', `${BASE}:${EXECUTION_WORKFLOW}`), '247355dc2f0a3fcb782f1621503bd30713871a81');
  assert.equal(git('rev-parse', `HEAD:${EXECUTION_WORKFLOW}`), '247355dc2f0a3fcb782f1621503bd30713871a81');
  assert.equal(git('rev-parse', `${BASE}:${BROKER_WORKFLOW}`), '9ee342492354b6f0f2bbeedb788c4fe011159284');
  assert.equal(git('rev-parse', `HEAD:${BROKER_WORKFLOW}`), '9ee342492354b6f0f2bbeedb788c4fe011159284');
  assert.equal(git('rev-parse', `HEAD:${CONSUMPTION}`), '59c07812c60eb47d4940d1102f235f03958c88e5');
  assert.equal(git('rev-parse', `HEAD:${SETTLEMENT}`), '4c91f0f325d65cf99f1d84f7b4ab5d509dc24374');
  assert.equal(git('rev-parse', `HEAD:${BOUNDARY}`), 'b3341bf62cd0afe973675847631615e787b68876');

  assert.equal(authority.authority_effective, true);
  assert.equal(authority.comparator_execution_authorized, true);
  assert.equal(authority.maximum_execution_count, 1);
  assert.equal(authority.required_execution_attempt, 1);
  assert.equal(authority.rerun_authorized, false);
  assert.equal(authority.exact_subject_sha, SUBJECT);
  assert.equal(authority.comparator_execution_id, 'MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-20260804-REPLACEMENT-002');

  assert.equal(consumption.record_status, 'SINGLE_FORMAL_CROSS_RUN_COMPARATOR_AUTHORITY_CONSUMED_TERMINAL_SUCCESS');
  assert.equal(consumption.exact_subject_sha, SUBJECT);
  assert.equal(consumption.effective_authority_ref.blob_sha, '591ad3c6c188d19c9e6eff89382e147854f25b63');
  assert.equal(consumption.dispatch_broker.workflow_run_id, 30900687468);
  assert.equal(consumption.dispatch_broker.workflow_run_attempt, 1);
  assert.equal(consumption.dispatch_broker.preexisting_post_effectiveness_dispatch_count, 0);
  assert.equal(consumption.dispatch_broker.dispatch_http_status, 204);
  assert.equal(consumption.dispatch_broker.target_workflow_run_id, 30900706086);
  assert.equal(consumption.consumed_execution.formal_workflow_run_attempt, 1);
  assert.equal(consumption.consumed_execution.conclusion, 'success');
  assert.equal(consumption.consumed_execution.result_status, 'PASS');
  assert.equal(consumption.consumed_execution.semantic_equivalence, true);
  assert.equal(consumption.consumed_execution.semantic_digest_a, SEMANTIC_DIGEST);
  assert.equal(consumption.consumed_execution.semantic_digest_b, SEMANTIC_DIGEST);
  assert.equal(consumption.consumed_execution.difference_count, 0);
  assert.equal(consumption.consumption_state.authority_consumed, true);
  assert.equal(consumption.consumption_state.execution_count_consumed, 1);
  assert.equal(consumption.consumption_state.remaining_execution_count, 0);
  assert.equal(consumption.consumption_state.workflow_dispatch_authorized_after_consumption, false);
  assert.equal(consumption.consumption_state.rerun_authorized, false);
  assert.equal(consumption.consumption_state.duplicate_execution_authorized, false);
  assert.equal(consumption.consumption_state.authority_reuse_authorized, false);
  assert.equal(consumption.consumption_state.same_execution_id_reuse_authorized, false);

  assert.equal(settlement.record_status, 'FORMAL_CROSS_RUN_COMPARATOR_TERMINAL_SUCCESS_SETTLED');
  assert.equal(settlement.formal_workflow.workflow_run_id, 30900706086);
  assert.equal(settlement.formal_workflow.workflow_run_attempt, 1);
  assert.equal(settlement.formal_workflow.conclusion, 'success');
  assert.equal(settlement.execution_evidence.formal_comparator_artifact_id, 8888940447);
  assert.equal(settlement.formal_result.status, 'PASS');
  assert.equal(settlement.formal_result.semantic_equivalence, true);
  assert.equal(settlement.formal_result.semantic_digest_a, SEMANTIC_DIGEST);
  assert.equal(settlement.formal_result.semantic_digest_b, SEMANTIC_DIGEST);
  assert.equal(settlement.formal_result.difference_count, 0);
  assert.equal(settlement.formal_result.independent_database_instances, true);
  assert.equal(settlement.formal_result.hard_acceptance_eligible, true);
  assert.notEqual(settlement.formal_inputs.run_a.operational_run_instance_id, settlement.formal_inputs.run_b.operational_run_instance_id);
  assert.notEqual(settlement.formal_inputs.run_a.logical_database_identity, settlement.formal_inputs.run_b.logical_database_identity);
  assert.notEqual(settlement.formal_inputs.run_a.physical_database_name, settlement.formal_inputs.run_b.physical_database_name);
  assert.equal(settlement.terminal_invariants.semantic_comparator_executed, true);
  assert.equal(settlement.terminal_invariants.formal_evidence_created, true);
  assert.equal(settlement.terminal_invariants.remaining_execution_count, 0);
  assert.equal(settlement.s6_candidate_freeze_eligible, true);
  assert.equal(settlement.s6_candidate_established, false);
  assert.equal(settlement.next_legal_action, 'FREEZE_S6_CANDIDATE_EXACT_HEAD');

  assert.equal(boundary.changed_file_count, 5);
  assert.deepEqual([...boundary.changed_files].sort(), CHANGED);
  assert.equal(boundary.authority_consumption_blob_sha, '59c07812c60eb47d4940d1102f235f03958c88e5');
  assert.equal(boundary.success_settlement_blob_sha, '4c91f0f325d65cf99f1d84f7b4ab5d509dc24374');
  assert.equal(boundary.runtime_source_changed, false);
  assert.equal(boundary.database_execution_in_pr, false);
  assert.equal(boundary.comparator_implementation_changed, false);
  assert.equal(boundary.execution_workflow_changed, false);
  assert.equal(boundary.execution_control_changed, false);
  assert.equal(boundary.workflow_dispatch_in_pr, false);
  assert.equal(boundary.workflow_rerun_in_pr, false);
  assert.equal(boundary.formal_comparator_execution_in_pr, false);
  assert.equal(boundary.replacement_002_authority_consumed, true);
  assert.equal(boundary.remaining_execution_count, 0);
  assert.equal(boundary.semantic_equivalence, true);
  assert.equal(boundary.difference_count, 0);
  assert.equal(boundary.s6_candidate_created, false);

  const githubAudit = readExternal('MCFT_FORMAL_COMPARATOR_SUCCESS_AUDIT');
  const brokerReceipt = readExternal('MCFT_FORMAL_COMPARATOR_BROKER_RECEIPT');
  const formalResult = readExternal('MCFT_FORMAL_COMPARATOR_RESULT');
  const inputAudit = readExternal('MCFT_FORMAL_COMPARATOR_INPUT_AUDIT');

  assert.equal(githubAudit.status, 'PASS');
  assert.equal(githubAudit.matching_broker_run_count, 1);
  assert.equal(githubAudit.matching_comparator_run_count, 1);
  assert.deepEqual(
    [githubAudit.broker.id, githubAudit.broker.run_attempt, githubAudit.broker.event, githubAudit.broker.head_sha, githubAudit.broker.conclusion],
    [30900687468, 1, 'push', BASE, 'success'],
  );
  assert.deepEqual(
    [githubAudit.comparator.id, githubAudit.comparator.run_attempt, githubAudit.comparator.event, githubAudit.comparator.head_sha, githubAudit.comparator.conclusion],
    [30900706086, 1, 'workflow_dispatch', BASE, 'success'],
  );
  const brokerArtifact = artifactById(githubAudit.broker_artifacts, 8888932516, 'BROKER');
  assert.equal(brokerArtifact.digest, 'sha256:ccf5fb13a23c7892177d9d5e30c0be6ffe21c46a20ee19795da7a913c192628f');
  const comparatorArtifact = artifactById(githubAudit.comparator_artifacts, 8888940447, 'COMPARATOR');
  assert.equal(comparatorArtifact.digest, 'sha256:b2d24f90faa2fdf2b35c691b4bf02af14d6bcca7f1309d1fd7adaea45d6a972b');
  const brokerJobs = Object.fromEntries(githubAudit.broker_jobs.map((job) => [job.name, job.conclusion]));
  const comparatorJobs = Object.fromEntries(githubAudit.comparator_jobs.map((job) => [job.name, job.conclusion]));
  assert.equal(brokerJobs['dispatch-once'], 'success');
  assert.equal(comparatorJobs['execute-formal-comparator-once'], 'success');
  assert.equal(comparatorJobs['static-qualification'], 'skipped');

  assert.equal(brokerReceipt.status, 'DISPATCH_ACCEPTED_HTTP_204_AND_UNIQUE_TARGET_RESOLVED');
  assert.equal(brokerReceipt.broker_run_id, 30900687468);
  assert.equal(brokerReceipt.broker_run_attempt, 1);
  assert.equal(brokerReceipt.authority_main_sha, BASE);
  assert.equal(brokerReceipt.preexisting_post_effectiveness_workflow_dispatch_count, 0);
  assert.equal(brokerReceipt.target_workflow_run_id, 30900706086);
  assert.equal(brokerReceipt.target_workflow_run_attempt, 1);
  assert.equal(brokerReceipt.target_head_sha, BASE);
  assert.equal(brokerReceipt.target_event, 'workflow_dispatch');
  assert.equal(brokerReceipt.rerun_authorized, false);
  assert.equal(brokerReceipt.duplicate_dispatch_authorized, false);
  assert.equal(brokerReceipt.same_execution_id_reuse_authorized, false);

  assert.equal(formalResult.schema_version, 'geox_mcft_cap08_s6_formal_cross_run_semantic_comparator_v1');
  assert.equal(formalResult.evidence_class, 'FINAL_FORMAL_CROSS_RUN_COMPARATOR_EVIDENCE');
  assert.equal(formalResult.exact_subject_sha, SUBJECT);
  assert.equal(formalResult.comparator_execution_attempt, 1);
  assert.equal(formalResult.status, 'PASS');
  assert.equal(formalResult.semantic_equivalence, true);
  assert.equal(formalResult.semantic_digest_a, SEMANTIC_DIGEST);
  assert.equal(formalResult.semantic_digest_b, SEMANTIC_DIGEST);
  assert.equal(formalResult.difference_count, 0);
  assert.equal(formalResult.independent_database_instances, true);
  assert.equal(formalResult.execution_count_consumed, 1);
  assert.equal(formalResult.maximum_execution_count, 1);
  assert.equal(formalResult.rerun_authorized, false);
  assert.equal(formalResult.hard_acceptance_eligible, true);
  assert.equal(formalResult.s6_candidate_authorized, false);

  assert.equal(inputAudit.schema_version, 'geox_mcft_cap08_s6_formal_cross_run_comparator_input_audit_v2');
  assert.equal(inputAudit.status, 'PASS');
  assert.equal(inputAudit.provenance_identity_model, 'DISTINCT_WORKFLOW_HEAD_AND_EXECUTION_SUBJECT');
  assert.equal(inputAudit.exact_subject_sha, SUBJECT);
  assert.equal(inputAudit.run_a.workflow_head_sha, '191e363e1fd9fa4c77c8b5135fb9673c3a9286d1');
  assert.equal(inputAudit.run_b.workflow_head_sha, 'a5039a07455e8b325db23880dd8e8c460fc6aa0d');
  assert.notEqual(inputAudit.run_a.workflow_head_sha, SUBJECT);
  assert.notEqual(inputAudit.run_b.workflow_head_sha, SUBJECT);
  assert.equal(inputAudit.run_a.artifact_id, 8868535301);
  assert.equal(inputAudit.run_b.artifact_id, 8880057024);

  const result = {
    schema_version: 'geox_mcft_cap08_s6_formal_comparator_replacement_002_success_settlement_result_v1',
    status: 'PASS',
    evidence_class: 'FORMAL_COMPARATOR_TERMINAL_SUCCESS_SETTLEMENT_QUALIFICATION',
    base_main_sha: BASE,
    exact_head_sha: git('rev-parse', 'HEAD'),
    broker_run_id: 30900687468,
    formal_comparator_run_id: 30900706086,
    formal_comparator_artifact_id: 8888940447,
    semantic_equivalence: true,
    semantic_digest_a: SEMANTIC_DIGEST,
    semantic_digest_b: SEMANTIC_DIGEST,
    difference_count: 0,
    authority_consumed: true,
    remaining_execution_count: 0,
    rerun_authorized: false,
    s6_candidate_freeze_eligible: true,
    s6_candidate_established: false,
    next_legal_action: 'FREEZE_S6_CANDIDATE_EXACT_HEAD',
  };
  save(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  save({
    schema_version: 'geox_mcft_cap08_s6_formal_comparator_replacement_002_success_settlement_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
