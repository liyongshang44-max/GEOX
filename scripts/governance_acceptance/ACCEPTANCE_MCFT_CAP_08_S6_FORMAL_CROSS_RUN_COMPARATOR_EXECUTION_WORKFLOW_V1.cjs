#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = 'da06d17670ff3ddfa261cb77bc3e765854edf176';
const SUBJECT = 'ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59';
const WORKFLOW = '.github/workflows/mcft-cap-08-s6-formal-cross-run-comparator-execution.yml';
const CONTROL = 'scripts/runtime_acceptance/mcft_cap08_s6_formal_comparator/formal_comparator_execution_control_v1.cjs';
const CONTRACT = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-EXECUTION-WORKFLOW-V1.json';
const BOUNDARY = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-EXECUTION-WORKFLOW-BOUNDARY-V1.json';
const VALIDATOR = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_FORMAL_CROSS_RUN_COMPARATOR_EXECUTION_WORKFLOW_V1.cjs';
const FAILURE = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-001-FAILURE-SETTLEMENT-V1.json';
const CONSUMPTION = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-001-AUTHORITY-CONSUMPTION-V1.json';
const OLD_AUTHORITY = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-001-EXECUTION-AUTHORITY-EFFECTIVE-V1.json';
const CHANGED = [WORKFLOW, CONTROL, CONTRACT, BOUNDARY, VALIDATOR].sort();
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_FORMAL_CROSS_RUN_COMPARATOR_EXECUTION_WORKFLOW_RESULT.json');

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const readJson = (file) => JSON.parse(read(file));
const canonical = (value) => Array.isArray(value)
  ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value);

function semanticDigest(value) {
  const copy = structuredClone(value);
  delete copy.semantic_digest;
  return `sha256:${crypto.createHash('sha256').update(canonical(copy)).digest('hex')}`;
}

function save(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}

function exactHead() {
  const ref = String(process.env.GITHUB_HEAD_REF || '').trim();
  return ref ? git('rev-parse', `origin/${ref}`) : git('rev-parse', 'HEAD');
}

function authorityInput(spec) {
  return {
    workflow_run_id: spec.run_id,
    workflow_run_attempt: spec.run_attempt,
    artifact_id: spec.artifact_id,
    artifact_digest: spec.artifact_digest,
  };
}

try {
  const base = String(process.env.MCFT_BASE_SHA || BASE).trim();
  const head = exactHead();
  assert.equal(base, BASE);
  assert.equal(git('merge-base', BASE, head), BASE);
  assert.equal(git('rev-list', '--count', `${BASE}..${head}`), '5');
  assert.equal(git('diff', '--check', `${BASE}...${head}`), '');
  assert.deepEqual(
    git('diff', '--name-only', `${BASE}...${head}`).split(/\r?\n/).filter(Boolean).sort(),
    CHANGED,
  );

  const contract = readJson(CONTRACT);
  const boundary = readJson(BOUNDARY);
  const failure = readJson(FAILURE);
  const consumption = readJson(CONSUMPTION);
  const workflow = read(WORKFLOW);
  const controlSource = read(CONTROL);

  assert.equal(contract.semantic_digest, semanticDigest(contract));
  assert.equal(boundary.semantic_digest, semanticDigest(boundary));
  assert.equal(contract.schema_version, 'geox_mcft_cap08_s6_formal_cross_run_comparator_execution_workflow_v2');
  assert.equal(contract.record_status, 'FORMAL_CROSS_RUN_COMPARATOR_PROVENANCE_BINDING_CORRECTED_QUALIFIED_NOT_AUTHORIZED');
  assert.equal(contract.supersedes.predecessor_workflow_blob_sha, 'b11d60820f35ee39ac2df2a4372cbce7df8cf876');
  assert.equal(contract.supersedes.predecessor_control_blob_sha, 'f6e1673681f734474340c1a1ffab79be60892a7a');
  assert.equal(contract.failure_settlement_precondition.replacement_001_authority_consumed, true);
  assert.equal(contract.failure_settlement_precondition.remaining_execution_count, 0);
  assert.equal(contract.failure_settlement_precondition.rerun_authorized, false);
  assert.equal(contract.provenance_identity_model.identities_are_distinct, true);
  assert.equal(contract.provenance_identity_model.workflow_head_must_equal_execution_subject, false);
  assert.equal(contract.formal_comparator_execution_performed, false);
  assert.equal(contract.replacement_002_authority_candidate_created, false);
  assert.equal(contract.fresh_execution_authorized, false);

  assert.equal(boundary.changed_file_count, 5);
  assert.deepEqual([...boundary.changed_files].sort(), CHANGED);
  assert.equal(boundary.correction_classification, 'CONTROL_PLANE_PROVENANCE_IDENTITY_SEPARATION');
  assert.equal(boundary.runtime_source_file_count, 0);
  assert.equal(boundary.database_execution_file_count, 0);
  assert.equal(boundary.formal_comparator_execution_performed, false);
  assert.equal(boundary.authority_created, false);
  assert.equal(boundary.authority_effective, false);
  assert.equal(boundary.replacement_001_authority_consumed, true);
  assert.equal(boundary.replacement_001_rerun_authorized, false);
  assert.equal(boundary.replacement_002_authority_candidate_created, false);

  assert.equal(git('rev-parse', `${head}:${WORKFLOW}`), '247355dc2f0a3fcb782f1621503bd30713871a81');
  assert.equal(git('rev-parse', `${head}:${CONTROL}`), '2cdc4e903dacb00b87f175dea58d89d80c6f3108');
  assert.equal(git('rev-parse', `${head}:${CONTRACT}`), '1004465d3f1c588a4a51c468c3bed0e1ce7dd527');
  assert.equal(git('rev-parse', `${head}:${BOUNDARY}`), '9ffd95cd4d02967636211c8c68622098fd567ab9');
  assert.equal(contract.workflow.blob_sha, '247355dc2f0a3fcb782f1621503bd30713871a81');
  assert.equal(contract.execution_control.blob_sha, '2cdc4e903dacb00b87f175dea58d89d80c6f3108');

  for (const ref of [BASE, head]) {
    assert.equal(git('rev-parse', `${ref}:${FAILURE}`), 'f1aa8da7c1f855e80069a08651eec014a82f00e5');
    assert.equal(git('rev-parse', `${ref}:${CONSUMPTION}`), 'dc03eac0b384ee26a43e6299842864c8190e99ba');
    assert.equal(git('rev-parse', `${ref}:${OLD_AUTHORITY}`), 'c2df7c3da181ff231931a66c7f6c6b2312b7015a');
  }
  assert.equal(failure.record_status, 'FORMAL_CROSS_RUN_COMPARATOR_TERMINAL_FAILURE_SETTLED');
  assert.equal(failure.failure_fingerprint.root_cause_classification, 'CONTROL_PLANE_PROVENANCE_IDENTITY_CONFLATION');
  assert.equal(failure.terminal_governance.authority_consumed, true);
  assert.equal(failure.terminal_governance.rerun_authorized, false);
  assert.equal(consumption.consumption_state.remaining_execution_count, 0);
  assert.equal(consumption.consumption_state.same_execution_id_reuse_authorized, false);

  for (const marker of [
    'workflow_dispatch:',
    'exact_subject_sha:',
    'comparator_execution_id:',
    'execution_authority_path:',
    "if: github.event_name == 'workflow_dispatch'",
    "if: github.event_name != 'workflow_dispatch'",
    'Gate effective single-use comparator authority before artifact transport',
    'Download exact settled Formal RUN_A artifact',
    'Download exact settled Formal RUN_B artifact',
    'Audit exact formal input runs and artifact digests',
    'Execute formal cross-run comparator exactly once',
    'Upload one formal comparator artifact only',
    'MCFT_EXECUTION_AUTHORITY_PATH: ${{ inputs.execution_authority_path }}',
    'retention-days: 365',
  ]) assert.ok(workflow.includes(marker), `MISSING_WORKFLOW_MARKER:${marker}`);
  assert.equal(workflow.includes('\n  push:'), false);
  const formalJob = workflow.slice(workflow.indexOf('  execute-formal-comparator-once:'));
  assert.ok(formalJob.indexOf('Gate effective single-use comparator authority before artifact transport') < formalJob.indexOf('Download exact settled Formal RUN_A artifact'));
  assert.ok(formalJob.indexOf('Audit exact formal input runs and artifact digests') < formalJob.indexOf('Execute formal cross-run comparator exactly once'));

  assert.equal(controlSource.includes('assert.equal(run.head_sha,SUBJECT)'), false);
  assert.ok(controlSource.includes("workflow_head_sha: '191e363e1fd9fa4c77c8b5135fb9673c3a9286d1'"));
  assert.ok(controlSource.includes("workflow_head_sha: 'a5039a07455e8b325db23880dd8e8c460fc6aa0d'"));
  assert.ok(controlSource.includes("assert.equal(run.head_sha, spec.workflow_head_sha"));
  assert.ok(controlSource.includes("assert.notEqual(run.head_sha, SUBJECT"));
  assert.ok(controlSource.includes("provenance_identity_model: 'DISTINCT_WORKFLOW_HEAD_AND_EXECUTION_SUBJECT'"));

  const control = require(path.join(ROOT, CONTROL));
  for (const [key, spec] of Object.entries(control.RUNS)) {
    const validRun = {
      id: spec.run_id,
      event: 'workflow_dispatch',
      conclusion: 'success',
      run_attempt: spec.run_attempt,
      head_sha: spec.workflow_head_sha,
    };
    const validArtifacts = [{ id: spec.artifact_id, digest: spec.artifact_digest }];
    const verified = control.verifyInput(key, spec, authorityInput(spec), validRun, validArtifacts);
    assert.equal(verified.workflow_head_sha, spec.workflow_head_sha);
    assert.equal(verified.exact_subject_sha, SUBJECT);
    assert.notEqual(verified.workflow_head_sha, verified.exact_subject_sha);

    assert.throws(
      () => control.verifyInput(key, spec, authorityInput(spec), { ...validRun, head_sha: SUBJECT }, validArtifacts),
      new RegExp(`${key}_WORKFLOW_HEAD_SHA`),
    );
    assert.throws(
      () => control.verifyInput(key, spec, authorityInput(spec), { ...validRun, run_attempt: 2 }, validArtifacts),
      new RegExp(`${key}_RUN_ATTEMPT`),
    );
    assert.throws(
      () => control.verifyInput(key, spec, authorityInput(spec), validRun, [{ id: spec.artifact_id, digest: 'sha256:wrong' }]),
      new RegExp(`${key}_ARTIFACT_DIGEST`),
    );
  }

  assert.equal(contract.formal_inputs.run_a.workflow_head_sha, control.RUNS.run_a.workflow_head_sha);
  assert.equal(contract.formal_inputs.run_b.workflow_head_sha, control.RUNS.run_b.workflow_head_sha);
  assert.equal(contract.formal_inputs.run_a.exact_subject_sha, SUBJECT);
  assert.equal(contract.formal_inputs.run_b.exact_subject_sha, SUBJECT);
  assert.notEqual(contract.formal_inputs.run_a.workflow_head_sha, SUBJECT);
  assert.notEqual(contract.formal_inputs.run_b.workflow_head_sha, SUBJECT);

  const result = {
    schema_version: 'geox_mcft_cap08_s6_formal_cross_run_comparator_execution_workflow_qualification_result_v2',
    status: 'PASS',
    evidence_class: 'NON_FORMAL_CONTROL_PLANE_CORRECTION_QUALIFICATION',
    base_main_sha: BASE,
    exact_head_sha: head,
    workflow_blob_sha: contract.workflow.blob_sha,
    execution_control_blob_sha: contract.execution_control.blob_sha,
    provenance_identity_model: 'DISTINCT_WORKFLOW_HEAD_AND_EXECUTION_SUBJECT',
    positive_vector_count: 2,
    negative_vector_count: 6,
    formal_comparator_execution_performed: false,
    replacement_001_authority_consumed: true,
    replacement_002_authority_candidate_created: false,
    fresh_execution_authorized: false,
    next_legal_action: 'ISSUE_REPLACEMENT_002_FORMAL_COMPARATOR_AUTHORITY_CANDIDATE',
  };
  save(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  save({
    schema_version: 'geox_mcft_cap08_s6_formal_cross_run_comparator_execution_workflow_qualification_result_v2',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
