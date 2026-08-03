#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '191e363e1fd9fa4c77c8b5135fb9673c3a9286d1';
const SUBJECT = 'ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59';
const OP = 'MCFT-CAP-08-S6-FORMAL-RUN-A-20260804-REPLACEMENT-011';
const DB = 'MCFT-CAP-08-S6-FORMAL-DB-A-20260804-REPLACEMENT-011';
const SUCCESS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-REPLACEMENT-011-FORMAL-RUN-A-SUCCESS-V1.json';
const CONSUMPTION = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-REPLACEMENT-011-RUN-A-AUTHORITY-CONSUMPTION-V1.json';
const BOUNDARY = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-REPLACEMENT-011-RUN-A-SUCCESS-SETTLEMENT-BOUNDARY-V1.json';
const VALIDATOR = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_REPLACEMENT_011_RUN_A_SUCCESS_SETTLEMENT_V1.cjs';
const WORKFLOW = '.github/workflows/mcft-cap-08-s6-replacement-011-run-a-success-settlement.yml';
const AUTHORITY = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-MERGED-MAIN-QUALIFIED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json';
const FORMAL_WORKFLOW = '.github/workflows/mcft-cap-08-s6-single-run-database-execution.yml';
const BROKER = '.github/workflows/mcft-cap-08-s6-replacement-011-one-shot-dispatch-broker.yml';
const CHANGED = [SUCCESS, CONSUMPTION, BOUNDARY, VALIDATOR, WORKFLOW].sort();
const INPUT = process.env.MCFT_RUN_A_ARTIFACT_DIR || path.join(ROOT, 'acceptance-input/formal-run-a');
const AUDIT = process.env.MCFT_GITHUB_AUDIT_PATH || path.join(ROOT, 'acceptance-input/GITHUB_RUN_A_AUDIT.json');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_REPLACEMENT_011_RUN_A_SUCCESS_SETTLEMENT_RESULT.json');

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const text = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = file => JSON.parse(text(file));
const inputJson = file => JSON.parse(fs.readFileSync(path.join(INPUT, file), 'utf8'));
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function semanticDigest(value) {
  const clone = structuredClone(value);
  delete clone.semantic_digest;
  return `sha256:${crypto.createHash('sha256').update(canonical(clone)).digest('hex')}`;
}
function save(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}
function step(job, name, conclusion) {
  const found = job.steps.find(item => item.name === name);
  assert.ok(found, `MISSING_STEP:${job.name}:${name}`);
  assert.equal(found.conclusion, conclusion, `STEP_CONCLUSION:${job.name}:${name}`);
}

try {
  const base = String(process.env.MCFT_BASE_SHA || BASE).trim();
  assert.equal(base, BASE, 'BASE_MAIN_SHA');
  assert.equal(git('merge-base', BASE, 'HEAD'), BASE, 'BASE_NOT_ANCESTOR');
  assert.equal(git('rev-list', '--count', `${BASE}..HEAD`), '1', 'SETTLEMENT_COMMIT_COUNT');
  assert.equal(git('diff', '--check', `${BASE}...HEAD`), '', 'DIFF_CHECK');
  assert.deepEqual(git('diff', '--name-only', `${BASE}...HEAD`).split(/\r?\n/).filter(Boolean).sort(), CHANGED, 'SETTLEMENT_BOUNDARY');

  const success = json(SUCCESS);
  const consumption = json(CONSUMPTION);
  const boundary = json(BOUNDARY);
  for (const record of [success, consumption, boundary]) assert.equal(record.semantic_digest, semanticDigest(record), `SEMANTIC_DIGEST:${record.schema_version}`);
  assert.equal(git('rev-parse', `HEAD:${SUCCESS}`), 'aec6a5d6ad91687c7f404f1638eecb0600c25df4');
  assert.equal(git('rev-parse', `HEAD:${CONSUMPTION}`), '13480ddf62fafc9b408988d89c4f8038c7f16eff');
  assert.equal(git('rev-parse', `HEAD:${BOUNDARY}`), '297ea8b888de31a96b03bcbf80fd5e64f13b920c');
  for (const ref of [BASE, 'HEAD']) {
    assert.equal(git('rev-parse', `${ref}:${AUTHORITY}`), 'fe55502277682e8a3e5cbf87ba97feb3f94988b0');
    assert.equal(git('rev-parse', `${ref}:${FORMAL_WORKFLOW}`), '2371b3797999f61f55c58551b85c59279eb2f0a2');
    assert.equal(git('rev-parse', `${ref}:${BROKER}`), 'c369f28403c2fec1ba4edd235c1ac47333509e05');
  }

  assert.equal(success.record_status, 'FORMAL_RUN_A_TERMINAL_SUCCESS_ESTABLISHED');
  assert.equal(success.exact_subject_sha, SUBJECT);
  assert.equal(success.run_label, 'RUN_A');
  assert.equal(success.formal_workflow.workflow_run_id, 30845476698);
  assert.equal(success.formal_workflow.workflow_run_attempt, 1);
  assert.equal(success.formal_workflow.conclusion, 'success');
  assert.equal(success.formal_identity.operational_run_instance_id, OP);
  assert.equal(success.formal_identity.logical_database_identity, DB);
  assert.equal(success.execution_evidence.one_run_artifact_id, 8868535301);
  assert.equal(success.execution_evidence.one_run_artifact_digest, 'sha256:4d59d3aa0373bee0c9eb33ab78dd427eb324d4d259e0786aa9c4dea9effdaf2f');
  assert.equal(success.terminal_invariants.canonical_receipt_count, 153);
  assert.equal(success.terminal_invariants.operational_event_count, 224);
  assert.equal(success.terminal_invariants.per_run_witness_pass_count, 22);
  assert.equal(success.terminal_invariants.database_drop_completed, true);
  assert.equal(success.authority_consumed, true);
  assert.equal(success.dispatch_count_consumed, 1);
  assert.equal(success.rerun_authorized, false);
  assert.equal(success.run_b_authorized, false);

  assert.equal(consumption.record_status, 'SINGLE_FINAL_FORMAL_RUN_A_AUTHORITY_CONSUMED_TERMINAL_SUCCESS');
  assert.equal(consumption.dispatch_broker.workflow_run_id, 30845461481);
  assert.equal(consumption.dispatch_broker.workflow_run_attempt, 1);
  assert.equal(consumption.dispatch_broker.authority_gate_passed, true);
  assert.equal(consumption.dispatch_broker.dispatch_api_accepted, true);
  assert.equal(consumption.dispatch_broker.dispatch_http_status, 204);
  assert.equal(consumption.dispatch_broker.dispatch_failure, false);
  assert.equal(consumption.consumed_execution.formal_workflow_run_id, 30845476698);
  assert.equal(consumption.consumed_execution.terminal_success, true);
  assert.equal(consumption.dispatch_count_consumed, 1);
  assert.equal(consumption.maximum_dispatch_count, 1);
  assert.equal(consumption.workflow_dispatch_authorized_after_consumption, false);
  assert.equal(consumption.run_b_dispatch_authorized, false);

  assert.equal(boundary.changed_file_count, 5);
  assert.deepEqual([...boundary.changed_files].sort(), CHANGED);
  assert.equal(boundary.database_execution_in_pr, false);
  assert.equal(boundary.workflow_dispatch_in_pr, false);
  assert.equal(boundary.formal_run_a_terminal_success, true);
  assert.equal(boundary.run_b_authority_created, false);

  const audit = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
  assert.equal(audit.status, 'PASS');
  assert.equal(audit.formal_run.id, 30845476698);
  assert.equal(audit.formal_run.event, 'workflow_dispatch');
  assert.equal(audit.formal_run.head_sha, BASE);
  assert.equal(audit.formal_run.run_attempt, 1);
  assert.equal(audit.formal_run.conclusion, 'success');
  assert.equal(audit.matching_formal_run_count, 1);
  assert.equal(audit.duplicate_formal_run_detected, false);
  assert.equal(audit.broker_run.id, 30845461481);
  assert.equal(audit.broker_run.run_attempt, 1);
  assert.equal(audit.broker_run.conclusion, 'failure');
  assert.equal(audit.artifacts.one_run.id, 8868535301);
  assert.equal(audit.artifacts.one_run.digest, 'sha256:4d59d3aa0373bee0c9eb33ab78dd427eb324d4d259e0786aa9c4dea9effdaf2f');
  assert.equal(audit.artifacts.authority.id, 8868490523);
  assert.equal(audit.artifacts.authority.digest, 'sha256:1226a5d0e3328c33af7058fd9e3185eb28553df123f769632d377d27740ed97f');
  const authJob = audit.formal_jobs.find(job => job.name === 'authorize-before-database');
  const executeJob = audit.formal_jobs.find(job => job.name === 'execute-one-fresh-database');
  assert.equal(authJob.conclusion, 'success');
  assert.equal(executeJob.conclusion, 'success');
  step(authJob, 'Gate exact execution authority before PostgreSQL scheduling', 'success');
  step(executeJob, 'Bootstrap one fresh disposable PostgreSQL database', 'success');
  step(executeJob, 'Execute merged single-run harness through exact port bundle', 'success');
  step(executeJob, 'Upload one-run artifact only', 'success');
  step(executeJob, 'Drop disposable database', 'success');
  const brokerJob = audit.broker_jobs.find(job => job.name === 'dispatch-once');
  step(brokerJob, 'Verify frozen authority, workflow and production gate', 'success');
  step(brokerJob, 'Dispatch Formal RUN_A exactly once', 'success');
  step(brokerJob, 'Resolve dispatched workflow run and publish receipt', 'failure');

  const result = inputJson('MCFT_CAP_08_S6_RUN_A_DATABASE_EXECUTION_RESULT.json');
  assert.equal(result.status, 'PASS');
  assert.equal(result.execution_mode, 'FINAL_FORMAL');
  assert.equal(result.evidence_class, 'FINAL_FORMAL_EVIDENCE_ELIGIBLE_AFTER_TERMINAL_SUCCESS');
  assert.equal(result.exact_subject_sha, SUBJECT);
  assert.equal(result.run_label, 'RUN_A');
  assert.equal(result.operational_run_instance_id, OP);
  assert.equal(result.logical_database_identity, DB);
  assert.equal(result.physical_database_name, 'geox_mcft_cap08_s6_run_a_replacement_011_30845476698');
  assert.equal(result.phase_count, 28);
  assert.equal(result.canonical_receipt_count, 153);
  assert.equal(result.operational_event_count, 224);
  assert.equal(result.recovery_vector_count, 7);
  assert.equal(result.cap07_surface_count, 10);
  assert.equal(result.cap07_request_variant_count, 11);
  assert.equal(result.per_run_witness_count, 22);
  assert.equal(result.exact_witness_producer_path_executed, true);
  assert.equal(result.synthetic_witness_producer_used, false);
  assert.equal(result.artifact_digest, 'sha256:e592f00fb0b6c3234985f57e8d20955afc6246964d04aca7a56f9eea9b79e696');
  assert.equal(result.artifact_transport_digest, 'sha256:bb1c71bc5fadbe09e4df12ad4618e566782e40f138bd6ac3e51c200d594bbb2f');
  assert.equal(result.hard_acceptance_eligible, true);
  assert.equal(result.formal_evidence_eligible, true);

  const witness = inputJson('run-a/WITNESS_EVALUATION_RESULT.json');
  assert.equal(witness.status, 'PASS');
  assert.equal(witness.authority_class, 'FINAL_FORMAL_RUN_ONLY');
  assert.equal(witness.formal_run_id, result.formal_run_id);
  assert.equal(witness.operational_run_instance_id, OP);
  assert.equal(witness.witness_count, 22);
  assert.equal(witness.object_set_count, 22);
  assert.equal(witness.status_counts.PASS, 22);
  assert.equal(witness.semantic_failure_count, 0);
  assert.equal(witness.eligibility_failure_count, 0);
  assert.ok(witness.evaluations.every(item => item.status === 'PASS' && item.hard_acceptance_eligible === true));

  const bootstrap = inputJson('MCFT_CAP_08_PLATFORM_SECURITY_BOOTSTRAP_DB_RESULT.json');
  assert.equal(bootstrap.status, 'PASS');
  assert.equal(bootstrap.database_name, result.physical_database_name);
  assert.equal(bootstrap.subject_commit, SUBJECT);
  assert.equal(bootstrap.relation_count, 31);
  assert.equal(bootstrap.business_schema_structure_digest_before, bootstrap.business_schema_structure_digest_after);

  const final = {
    schema_version: 'geox_mcft_cap08_s6_replacement_011_run_a_success_settlement_result_v1',
    status: 'PASS',
    base_main_sha: BASE,
    exact_head_sha: git('rev-parse', 'HEAD'),
    exact_subject_sha: SUBJECT,
    formal_workflow_run_id: 30845476698,
    formal_workflow_run_attempt: 1,
    formal_run_id: result.formal_run_id,
    operational_run_instance_id: OP,
    physical_database_name: result.physical_database_name,
    formal_artifact_digest: result.artifact_digest,
    witness_pass_count: 22,
    canonical_receipt_count: 153,
    operational_event_count: 224,
    database_drop_completed: true,
    authority_consumed: true,
    rerun_authorized: false,
    run_b_authorized: false,
    next_legal_action: 'ISSUE_FRESH_NON_EFFECTIVE_FORMAL_RUN_B_AUTHORITY_CANDIDATE',
  };
  save(final);
  console.log(JSON.stringify(final, null, 2));
} catch (error) {
  save({ schema_version: 'geox_mcft_cap08_s6_replacement_011_run_a_success_settlement_result_v1', status: 'FAIL', error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exitCode = 1;
}
