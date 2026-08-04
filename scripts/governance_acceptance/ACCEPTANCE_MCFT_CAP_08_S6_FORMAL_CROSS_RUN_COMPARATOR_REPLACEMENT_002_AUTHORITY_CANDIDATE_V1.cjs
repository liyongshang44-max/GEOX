#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = 'aa58176ae061ff42eaa64069c10f88901669a671';
const SUBJECT = 'ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59';
const EXECUTION_ID = 'MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-20260804-REPLACEMENT-002';

const CANDIDATE = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-AUTHORITY-CANDIDATE-V1.json';
const OBJECTS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-AUTHORITY-OBJECT-SET-V1.json';
const ISSUANCE = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-AUTHORITY-ISSUANCE-V1.json';
const SUPERSESSION = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-AUTHORITY-SUPERSESSION-V1.json';
const BOUNDARY = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-AUTHORITY-BOUNDARY-V1.json';
const WORKFLOW = '.github/workflows/mcft-cap-08-s6-formal-cross-run-comparator-replacement-002-authority-candidate.yml';
const VALIDATOR = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_FORMAL_CROSS_RUN_COMPARATOR_REPLACEMENT_002_AUTHORITY_CANDIDATE_V1.cjs';

const WRAPPER = 'scripts/runtime_acceptance/mcft_cap08_s6_formal_comparator/formal_semantic_comparator_v1.cjs';
const CONTROL = 'scripts/runtime_acceptance/mcft_cap08_s6_formal_comparator/formal_comparator_execution_control_v1.cjs';
const FAILURE = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-001-FAILURE-SETTLEMENT-V1.json';
const CONSUMPTION = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-001-AUTHORITY-CONSUMPTION-V1.json';
const OLD_CANDIDATE = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-001-AUTHORITY-CANDIDATE-V1.json';
const OLD_EFFECTIVE = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-001-EXECUTION-AUTHORITY-EFFECTIVE-V1.json';

const CHANGED = [CANDIDATE, OBJECTS, ISSUANCE, SUPERSESSION, BOUNDARY, WORKFLOW, VALIDATOR].sort();
const A_DIR = process.env.MCFT_RUN_A_ARTIFACT_DIR || path.join(ROOT, 'acceptance-input/formal-run-a');
const B_DIR = process.env.MCFT_RUN_B_ARTIFACT_DIR || path.join(ROOT, 'acceptance-input/formal-run-b');
const AUDIT = process.env.MCFT_COMPARATOR_REPLACEMENT_INPUT_AUDIT || path.join(ROOT, 'acceptance-input/FORMAL_COMPARATOR_REPLACEMENT_002_CANDIDATE_INPUT_AUDIT.json');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_FORMAL_COMPARATOR_REPLACEMENT_002_AUTHORITY_CANDIDATE_RESULT.json');

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
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
  assert.equal(base, BASE, 'BASE_MAIN_SHA');
  assert.equal(git('merge-base', BASE, head), BASE, 'BASE_NOT_ANCESTOR');
  assert.equal(git('rev-list', '--count', `${BASE}..${head}`), '7', 'COMMIT_COUNT');
  assert.equal(git('diff', '--check', `${BASE}...${head}`), '', 'DIFF_CHECK');
  assert.deepEqual(
    git('diff', '--name-only', `${BASE}...${head}`).split(/\r?\n/).filter(Boolean).sort(),
    CHANGED,
    'BOUNDARY',
  );

  const candidate = readJson(CANDIDATE);
  const objects = readJson(OBJECTS);
  const issuance = readJson(ISSUANCE);
  const supersession = readJson(SUPERSESSION);
  const boundary = readJson(BOUNDARY);
  const failure = readJson(FAILURE);
  const consumption = readJson(CONSUMPTION);
  const oldCandidate = readJson(OLD_CANDIDATE);
  const oldEffective = readJson(OLD_EFFECTIVE);

  for (const record of [candidate, objects, issuance, supersession, boundary]) {
    assert.equal(record.semantic_digest, semanticDigest(record), `SEMANTIC_DIGEST:${record.schema_version}`);
  }

  const exactBlobs = {
    [WORKFLOW]: '4f46b854748cf3f1036f01aa03547b6885d59ebc',
    [OBJECTS]: 'cde589b07a1ff96c3de1428ccf1f8b2281938dc2',
    [CANDIDATE]: 'c9ddd552a1c9b7687639675ef7721e0e6ef5d067',
    [ISSUANCE]: 'dc7572214c5e6e1cebab4946a0f9323e44fa112d',
    [SUPERSESSION]: '35e6be91faf8ade40e33e5824e582b78894fbbe1',
    [BOUNDARY]: '4917a2982f4f6766bd87847750e5f14cea9f3187',
  };
  for (const [file, blob] of Object.entries(exactBlobs)) {
    assert.equal(git('rev-parse', `${head}:${file}`), blob, `BLOB:${file}`);
  }

  assert.equal(candidate.record_status, 'FORMAL_CROSS_RUN_COMPARATOR_REPLACEMENT_002_AUTHORITY_CANDIDATE_NOT_EFFECTIVE');
  assert.equal(candidate.authority_id, 'GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-AUTHORITY-CANDIDATE-V1');
  assert.equal(candidate.exact_subject_sha, SUBJECT);
  assert.equal(candidate.comparator_execution_id, EXECUTION_ID);
  assert.equal(candidate.authority_effective, false);
  assert.equal(candidate.comparator_execution_authorized, false);
  assert.equal(candidate.maximum_execution_count, 1);
  assert.equal(candidate.required_execution_attempt, 1);
  assert.equal(candidate.rerun_authorized, false);
  assert.equal(candidate.duplicate_execution_authorized, false);
  assert.equal(candidate.authority_reuse_authorized, false);
  assert.equal(candidate.activation_contract.separate_effectiveness_required, true);
  assert.equal(candidate.activation_contract.explicit_one_shot_execution_approval_required, true);
  assert.equal(candidate.activation_contract.fresh_execution_identity_required, true);
  assert.equal(candidate.formal_comparator_executed, false);
  assert.equal(candidate.formal_comparator_evidence_created, false);
  assert.equal(candidate.hard_acceptance_eligible, false);

  assert.equal(candidate.supersedes.predecessor_authority_consumed, true);
  assert.equal(candidate.supersedes.predecessor_remaining_execution_count, 0);
  assert.equal(candidate.supersedes.predecessor_rerun_authorized, false);
  assert.equal(candidate.supersedes.predecessor_same_execution_id_reuse_authorized, false);
  assert.equal(candidate.supersedes.failure_settlement_blob_sha, 'f1aa8da7c1f855e80069a08651eec014a82f00e5');
  assert.equal(candidate.supersedes.authority_consumption_blob_sha, 'dc03eac0b384ee26a43e6299842864c8190e99ba');

  assert.equal(candidate.inputs.run_a.workflow_head_sha, '191e363e1fd9fa4c77c8b5135fb9673c3a9286d1');
  assert.equal(candidate.inputs.run_b.workflow_head_sha, 'a5039a07455e8b325db23880dd8e8c460fc6aa0d');
  assert.notEqual(candidate.inputs.run_a.workflow_head_sha, SUBJECT);
  assert.notEqual(candidate.inputs.run_b.workflow_head_sha, SUBJECT);
  assert.equal(candidate.provenance_identity_model.identities_are_distinct, true);
  assert.equal(candidate.provenance_identity_model.workflow_head_must_equal_execution_subject, false);

  assert.equal(candidate.execution_workflow.blob_sha, '247355dc2f0a3fcb782f1621503bd30713871a81');
  assert.equal(candidate.execution_workflow.merge_sha, BASE);
  assert.equal(candidate.execution_workflow.qualification_workflow_run_id, 30896387338);
  assert.equal(candidate.execution_workflow.qualification_artifact_id, 8887189421);
  assert.equal(candidate.execution_workflow.qualification_artifact_digest, 'sha256:a0e363f9d2cfcffce664bc6ff36d62291cc7241ea6a67a1309354abef4c008f7');
  assert.equal(candidate.execution_workflow.formal_execution_job_conclusion, 'skipped');
  assert.equal(candidate.execution_control.blob_sha, '2cdc4e903dacb00b87f175dea58d89d80c6f3108');
  assert.equal(candidate.object_set_manifest_ref.blob_sha, 'cde589b07a1ff96c3de1428ccf1f8b2281938dc2');

  assert.equal(objects.object_count, 12);
  assert.equal(objects.corrected_execution_object_count, 4);
  for (const item of objects.objects) {
    assert.equal(git('rev-parse', `${BASE}:${item.path}`), item.blob_sha, `BASE_OBJECT:${item.role}`);
    assert.equal(git('rev-parse', `${head}:${item.path}`), item.blob_sha, `HEAD_OBJECT:${item.role}`);
  }
  const objectRoles = Object.fromEntries(objects.objects.map((item) => [item.role, item.blob_sha]));
  assert.equal(objectRoles.FORMAL_COMPARATOR_EXECUTION_WORKFLOW, '247355dc2f0a3fcb782f1621503bd30713871a81');
  assert.equal(objectRoles.FORMAL_COMPARATOR_EXECUTION_CONTROL, '2cdc4e903dacb00b87f175dea58d89d80c6f3108');
  assert.equal(objectRoles.FORMAL_COMPARATOR_EXECUTION_WORKFLOW_CONTRACT, '1004465d3f1c588a4a51c468c3bed0e1ce7dd527');
  assert.equal(objectRoles.FORMAL_COMPARATOR_EXECUTION_WORKFLOW_BOUNDARY, '9ffd95cd4d02967636211c8c68622098fd567ab9');
  assert.equal(objects.replacement_001_authority_reuse_authorized, false);

  assert.equal(issuance.candidate.blob_sha, 'c9ddd552a1c9b7687639675ef7721e0e6ef5d067');
  assert.equal(issuance.object_set.blob_sha, 'cde589b07a1ff96c3de1428ccf1f8b2281938dc2');
  assert.equal(issuance.corrected_execution_transport.workflow_blob_sha, '247355dc2f0a3fcb782f1621503bd30713871a81');
  assert.equal(issuance.corrected_execution_transport.control_blob_sha, '2cdc4e903dacb00b87f175dea58d89d80c6f3108');
  assert.equal(issuance.predecessor_terminal.authority_consumed, true);
  assert.equal(issuance.predecessor_terminal.remaining_execution_count, 0);
  assert.equal(issuance.activation.authority_effective, false);
  assert.equal(issuance.activation.comparator_execution_authorized, false);

  assert.equal(supersession.record_status, 'REPLACEMENT_001_COMPARATOR_AUTHORITY_CONSUMED_AND_SUPERSEDED_BY_REPLACEMENT_002_CANDIDATE');
  assert.equal(supersession.predecessor.authority_consumed, true);
  assert.equal(supersession.predecessor.remaining_execution_count, 0);
  assert.equal(supersession.predecessor.rerun_authorized, false);
  assert.equal(supersession.predecessor.authority_reuse_authorized, false);
  assert.equal(supersession.terminal_settlement.failure_class, 'CONTROL_PLANE_PROVENANCE_IDENTITY_CONFLATION');
  assert.equal(supersession.terminal_settlement.semantic_comparator_executed, false);
  assert.equal(supersession.replacement.candidate_blob_sha, 'c9ddd552a1c9b7687639675ef7721e0e6ef5d067');
  assert.equal(supersession.replacement.authority_effective, false);

  assert.equal(boundary.changed_file_count, 7);
  assert.deepEqual([...boundary.changed_files].sort(), CHANGED);
  assert.equal(boundary.runtime_source_file_count, 0);
  assert.equal(boundary.database_execution_file_count, 0);
  assert.equal(boundary.comparator_implementation_file_count, 0);
  assert.equal(boundary.execution_workflow_file_count, 0);
  assert.equal(boundary.execution_control_file_count, 0);
  assert.equal(boundary.workflow_dispatch_in_pr, false);
  assert.equal(boundary.formal_comparator_execution_performed, false);
  assert.equal(boundary.replacement_002_authority_effective, false);
  assert.equal(boundary.fresh_execution_authorized, false);

  for (const ref of [BASE, head]) {
    assert.equal(git('rev-parse', `${ref}:${FAILURE}`), 'f1aa8da7c1f855e80069a08651eec014a82f00e5');
    assert.equal(git('rev-parse', `${ref}:${CONSUMPTION}`), 'dc03eac0b384ee26a43e6299842864c8190e99ba');
    assert.equal(git('rev-parse', `${ref}:${OLD_CANDIDATE}`), 'dffb2a6df42c4a0860f461761f1cf3e2d360c8ac');
    assert.equal(git('rev-parse', `${ref}:${OLD_EFFECTIVE}`), 'c2df7c3da181ff231931a66c7f6c6b2312b7015a');
  }
  assert.equal(failure.record_status, 'FORMAL_CROSS_RUN_COMPARATOR_TERMINAL_FAILURE_SETTLED');
  assert.equal(failure.failure_fingerprint.root_cause_classification, 'CONTROL_PLANE_PROVENANCE_IDENTITY_CONFLATION');
  assert.equal(failure.terminal_governance.authority_consumed, true);
  assert.equal(failure.terminal_governance.rerun_authorized, false);
  assert.equal(consumption.consumption_state.remaining_execution_count, 0);
  assert.equal(consumption.consumption_state.same_execution_id_reuse_authorized, false);
  assert.equal(oldCandidate.authority_effective, false);
  assert.equal(oldEffective.authority_effective, true);
  assert.equal(oldEffective.comparator_execution_id, 'MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-20260804-REPLACEMENT-001');

  const audit = JSON.parse(fs.readFileSync(path.resolve(AUDIT), 'utf8'));
  assert.equal(audit.status, 'PASS');
  assert.equal(audit.exact_subject_sha, SUBJECT);
  assert.deepEqual(
    [audit.run_a.workflow_run_id, audit.run_a.workflow_run_attempt, audit.run_a.event, audit.run_a.conclusion, audit.run_a.head_sha, audit.run_a.artifact_id, audit.run_a.artifact_digest],
    [30845476698, 1, 'workflow_dispatch', 'success', '191e363e1fd9fa4c77c8b5135fb9673c3a9286d1', 8868535301, 'sha256:4d59d3aa0373bee0c9eb33ab78dd427eb324d4d259e0786aa9c4dea9effdaf2f'],
  );
  assert.deepEqual(
    [audit.run_b.workflow_run_id, audit.run_b.workflow_run_attempt, audit.run_b.event, audit.run_b.conclusion, audit.run_b.head_sha, audit.run_b.artifact_id, audit.run_b.artifact_digest],
    [30877450717, 1, 'workflow_dispatch', 'success', 'a5039a07455e8b325db23880dd8e8c460fc6aa0d', 8880057024, 'sha256:33e8b0333e1cd22bcd3002540ef5c12b72a8c545e58eb8ca185bf49edc6ae9cc'],
  );
  assert.deepEqual(
    [audit.implementation.workflow_run_id, audit.implementation.workflow_run_attempt, audit.implementation.event, audit.implementation.conclusion, audit.implementation.head_sha, audit.implementation.artifact_id, audit.implementation.artifact_digest],
    [30881117123, 1, 'pull_request', 'success', '7a38276fcc1e4beb455db51b6d31d5c022bac37c', 8881320548, 'sha256:1593ef3f5f7b7a1217f26fb3126899d31ff0cee1416306b43e48897b0480639a'],
  );
  assert.deepEqual(
    [audit.corrected_execution_workflow.workflow_run_id, audit.corrected_execution_workflow.workflow_run_attempt, audit.corrected_execution_workflow.event, audit.corrected_execution_workflow.conclusion, audit.corrected_execution_workflow.head_sha, audit.corrected_execution_workflow.artifact_id, audit.corrected_execution_workflow.artifact_digest],
    [30896387338, 1, 'pull_request', 'success', '43103e7243e825216f1211f973483db569109290', 8887189421, 'sha256:a0e363f9d2cfcffce664bc6ff36d62291cc7241ea6a67a1309354abef4c008f7'],
  );
  const jobMap = Object.fromEntries(audit.corrected_execution_workflow.jobs.map((item) => [item.name, item.conclusion]));
  assert.equal(jobMap['static-qualification'], 'success');
  assert.equal(jobMap['execute-formal-comparator-once'], 'skipped');
  assert.deepEqual(
    [audit.replacement_001_terminal.workflow_run_id, audit.replacement_001_terminal.workflow_run_attempt, audit.replacement_001_terminal.event, audit.replacement_001_terminal.conclusion, audit.replacement_001_terminal.head_sha, audit.replacement_001_terminal.artifact_count],
    [30893508924, 1, 'workflow_dispatch', 'failure', '54365415ffb25d8620b0aea0546e1fbd792425a5', 0],
  );

  const wrapper = require(path.join(ROOT, WRAPPER));
  const runA = JSON.parse(fs.readFileSync(path.join(A_DIR, candidate.inputs.run_a.bundle_file), 'utf8'));
  const runB = JSON.parse(fs.readFileSync(path.join(B_DIR, candidate.inputs.run_b.bundle_file), 'utf8'));
  wrapper.assertFormalBundleV1(runA, 'RUN_A');
  wrapper.assertFormalBundleV1(runB, 'RUN_B');
  assert.notEqual(runA.spec.operational_run_instance_id, runB.spec.operational_run_instance_id);
  assert.notEqual(runA.fresh_database.database_name, runB.fresh_database.database_name);
  const digestA = wrapper.digestV1(wrapper.semanticProjectionV1(runA));
  const digestB = wrapper.digestV1(wrapper.semanticProjectionV1(runB));
  const differences = wrapper.semanticDifferencesV1(wrapper.semanticProjectionV1(runA), wrapper.semanticProjectionV1(runB));
  assert.equal(digestA, 'sha256:32c93d4f5ecd1fc50ff94418407767b48b057d77c81bf93dfe3fccf58f0df2f8');
  assert.equal(digestB, digestA);
  assert.equal(differences.difference_count, 0);

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

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcft-comparator-replacement-002-'));
  const formalOutput = path.join(tempDir, 'formal-result.json');
  const wrapperRun = spawnSync(process.execPath, [path.join(ROOT, WRAPPER)], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MCFT_CAP08_FORMAL_RUN_A_BUNDLE: path.join(A_DIR, candidate.inputs.run_a.bundle_file),
      MCFT_CAP08_FORMAL_RUN_B_BUNDLE: path.join(B_DIR, candidate.inputs.run_b.bundle_file),
      MCFT_CAP08_FORMAL_COMPARATOR_AUTHORITY: path.join(ROOT, CANDIDATE),
      MCFT_CAP08_FORMAL_COMPARATOR_INPUT_AUDIT: path.resolve(AUDIT),
      MCFT_CAP08_FORMAL_COMPARATOR_OUTPUT: formalOutput,
    },
  });
  assert.notEqual(wrapperRun.status, 0, 'CANDIDATE_MUST_NOT_EXECUTE_WRAPPER');
  assert.equal(fs.existsSync(formalOutput), false, 'NO_FORMAL_OUTPUT');

  const gateRun = spawnSync(process.execPath, [path.join(ROOT, CONTROL), 'gate'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_RUN_ATTEMPT: '1',
      MCFT_EXECUTION_AUTHORITY_PATH: path.join(ROOT, CANDIDATE),
      MCFT_EXACT_SUBJECT_SHA: SUBJECT,
      MCFT_COMPARATOR_EXECUTION_ID: candidate.comparator_execution_id,
    },
  });
  assert.notEqual(gateRun.status, 0, 'CANDIDATE_MUST_NOT_PASS_EXECUTION_GATE');

  const result = {
    schema_version: 'geox_mcft_cap08_s6_formal_comparator_replacement_002_authority_candidate_result_v1',
    status: 'PASS',
    evidence_class: 'NON_EFFECTIVE_REPLACEMENT_AUTHORITY_CANDIDATE_EVIDENCE',
    base_main_sha: BASE,
    exact_head_sha: head,
    exact_subject_sha: SUBJECT,
    comparator_execution_id: EXECUTION_ID,
    authority_id: candidate.authority_id,
    object_count: 12,
    corrected_execution_object_count: 4,
    semantic_digest_a: digestA,
    semantic_digest_b: digestB,
    difference_count: 0,
    positive_provenance_vector_count: 2,
    negative_provenance_vector_count: 6,
    replacement_001_authority_consumed: true,
    replacement_001_remaining_execution_count: 0,
    replacement_001_rerun_authorized: false,
    replacement_002_authority_effective: false,
    comparator_execution_authorized: false,
    formal_comparator_executed: false,
    next_legal_action: 'ESTABLISH_REPLACEMENT_002_FORMAL_CROSS_RUN_COMPARATOR_AUTHORITY_EFFECTIVENESS',
  };
  save(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  save({
    schema_version: 'geox_mcft_cap08_s6_formal_comparator_replacement_002_authority_candidate_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
