#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '7614fa49a0e79bca582ecee4e240b8bbba0aa8d8';
const CANDIDATE_HEAD = 'c732a139d101d7850e6400892b8c4ed044440ef8';
const SUBJECT = 'ce9d6b4df8c708c0d4a99bb24846e1bc44b3cf59';
const EXECUTION_ID = 'MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-20260804-REPLACEMENT-002';

const EFFECTIVE = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-EXECUTION-AUTHORITY-EFFECTIVE-V1.json';
const EFFECTIVENESS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-AUTHORITY-EFFECTIVENESS-V1.json';
const BOUNDARY = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-AUTHORITY-EFFECTIVENESS-BOUNDARY-V1.json';
const WORKFLOW = '.github/workflows/mcft-cap-08-s6-formal-cross-run-comparator-replacement-002-authority-effectiveness.yml';
const VALIDATOR = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_FORMAL_CROSS_RUN_COMPARATOR_REPLACEMENT_002_AUTHORITY_EFFECTIVENESS_V1.cjs';

const CANDIDATE = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-AUTHORITY-CANDIDATE-V1.json';
const OBJECTS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-AUTHORITY-OBJECT-SET-V1.json';
const SUPERSESSION = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-AUTHORITY-SUPERSESSION-V1.json';
const FAILURE = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-001-FAILURE-SETTLEMENT-V1.json';
const CONSUMPTION = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-001-AUTHORITY-CONSUMPTION-V1.json';
const OLD_EFFECTIVE = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-001-EXECUTION-AUTHORITY-EFFECTIVE-V1.json';
const CONTROL = 'scripts/runtime_acceptance/mcft_cap08_s6_formal_comparator/formal_comparator_execution_control_v1.cjs';
const EXEC_WORKFLOW = '.github/workflows/mcft-cap-08-s6-formal-cross-run-comparator-execution.yml';

const CHANGED = [WORKFLOW, EFFECTIVE, EFFECTIVENESS, BOUNDARY, VALIDATOR].sort();
const AUDIT = process.env.MCFT_COMPARATOR_REPLACEMENT_EFFECTIVENESS_AUDIT || path.join(ROOT, 'acceptance-input/FORMAL_COMPARATOR_REPLACEMENT_002_EFFECTIVENESS_INPUT_AUDIT.json');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_FORMAL_COMPARATOR_REPLACEMENT_002_AUTHORITY_EFFECTIVENESS_RESULT.json');

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

try {
  const base = String(process.env.MCFT_BASE_SHA || BASE).trim();
  const head = exactHead();
  assert.equal(base, BASE, 'BASE_MAIN_SHA');
  assert.equal(git('merge-base', BASE, head), BASE, 'BASE_NOT_ANCESTOR');
  assert.equal(git('rev-list', '--count', `${BASE}..${head}`), '5', 'COMMIT_COUNT');
  assert.equal(git('diff', '--check', `${BASE}...${head}`), '', 'DIFF_CHECK');
  assert.deepEqual(
    git('diff', '--name-only', `${BASE}...${head}`).split(/\r?\n/).filter(Boolean).sort(),
    CHANGED,
    'FIVE_FILE_BOUNDARY',
  );
  assert.equal(git('diff', '--name-only', `${CANDIDATE_HEAD}..${BASE}`), '', 'CANDIDATE_TO_MERGE_FILE_DELTA');

  const candidate = readJson(CANDIDATE);
  const objects = readJson(OBJECTS);
  const supersession = readJson(SUPERSESSION);
  const effective = readJson(EFFECTIVE);
  const effectiveness = readJson(EFFECTIVENESS);
  const boundary = readJson(BOUNDARY);
  const failure = readJson(FAILURE);
  const consumption = readJson(CONSUMPTION);
  const oldEffective = readJson(OLD_EFFECTIVE);

  for (const record of [effective, effectiveness, boundary]) {
    assert.equal(record.semantic_digest, semanticDigest(record), `SEMANTIC_DIGEST:${record.schema_version}`);
  }

  const blobs = {
    [WORKFLOW]: '456cc45b52e7a59fb1899a9d4e9794dc1dd6ed69',
    [EFFECTIVE]: '591ad3c6c188d19c9e6eff89382e147854f25b63',
    [EFFECTIVENESS]: '9f67f4f539e38b5639d53b37a1e582050f7f2f57',
    [BOUNDARY]: 'e434214907e0a1ddbf918c96a55b4c96b0a9dbd9',
  };
  for (const [file, blob] of Object.entries(blobs)) {
    assert.equal(git('rev-parse', `${head}:${file}`), blob, `BLOB:${file}`);
  }

  assert.equal(git('rev-parse', `${BASE}:${CANDIDATE}`), 'c9ddd552a1c9b7687639675ef7721e0e6ef5d067');
  assert.equal(git('rev-parse', `${BASE}:${OBJECTS}`), 'cde589b07a1ff96c3de1428ccf1f8b2281938dc2');
  assert.equal(git('rev-parse', `${BASE}:${SUPERSESSION}`), '35e6be91faf8ade40e33e5824e582b78894fbbe1');
  assert.equal(git('rev-parse', `${BASE}:${FAILURE}`), 'f1aa8da7c1f855e80069a08651eec014a82f00e5');
  assert.equal(git('rev-parse', `${BASE}:${CONSUMPTION}`), 'dc03eac0b384ee26a43e6299842864c8190e99ba');
  assert.equal(git('rev-parse', `${BASE}:${OLD_EFFECTIVE}`), 'c2df7c3da181ff231931a66c7f6c6b2312b7015a');

  assert.equal(candidate.record_status, 'FORMAL_CROSS_RUN_COMPARATOR_REPLACEMENT_002_AUTHORITY_CANDIDATE_NOT_EFFECTIVE');
  assert.equal(candidate.authority_effective, false);
  assert.equal(candidate.comparator_execution_authorized, false);
  assert.equal(candidate.comparator_execution_id, EXECUTION_ID);
  assert.equal(candidate.exact_subject_sha, SUBJECT);

  assert.equal(effective.record_status, 'FORMAL_CROSS_RUN_COMPARATOR_AUTHORIZED');
  assert.equal(effective.authority_id, 'GEOX-MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-REPLACEMENT-002-EXECUTION-AUTHORITY-EFFECTIVE-V1');
  assert.equal(effective.exact_subject_sha, SUBJECT);
  assert.equal(effective.comparator_execution_id, EXECUTION_ID);
  assert.equal(effective.base_effectiveness_main_sha, BASE);
  assert.equal(effective.candidate_head_sha, CANDIDATE_HEAD);
  assert.equal(effective.candidate_merge_sha, BASE);
  assert.equal(effective.candidate_to_merge_file_delta, 0);
  assert.equal(effective.candidate_to_merge_execution_object_delta, 0);
  assert.equal(effective.candidate_authority_ref.blob_sha, 'c9ddd552a1c9b7687639675ef7721e0e6ef5d067');
  assert.equal(effective.candidate_authority_ref.preserved_semantic_digest, 'sha256:931a4c474d4792cefae44ac314752342d38c87665225ff014bf9ebdab3beea03');
  assert.equal(effective.candidate_qualification.workflow_run_id, 30897919642);
  assert.equal(effective.candidate_qualification.artifact_id, 8887810823);
  assert.equal(effective.candidate_qualification.artifact_digest, 'sha256:2de540113b6ce1c548b97acbcaa73e9ecb2c55d3014dada087515b7967044d6a');
  assert.equal(effective.supersession_ref.predecessor_authority_consumed, true);
  assert.equal(effective.supersession_ref.predecessor_remaining_execution_count, 0);
  assert.equal(effective.supersession_ref.predecessor_rerun_authorized, false);
  assert.equal(effective.inputs.run_a.workflow_head_sha, '191e363e1fd9fa4c77c8b5135fb9673c3a9286d1');
  assert.equal(effective.inputs.run_b.workflow_head_sha, 'a5039a07455e8b325db23880dd8e8c460fc6aa0d');
  assert.notEqual(effective.inputs.run_a.workflow_head_sha, SUBJECT);
  assert.notEqual(effective.inputs.run_b.workflow_head_sha, SUBJECT);
  assert.equal(effective.provenance_identity_model.identities_are_distinct, true);
  assert.equal(effective.provenance_identity_model.workflow_head_must_equal_execution_subject, false);
  assert.equal(effective.execution_workflow.blob_sha, '247355dc2f0a3fcb782f1621503bd30713871a81');
  assert.equal(effective.execution_control.blob_sha, '2cdc4e903dacb00b87f175dea58d89d80c6f3108');
  assert.equal(effective.object_set_manifest_ref.blob_sha, 'cde589b07a1ff96c3de1428ccf1f8b2281938dc2');
  assert.equal(effective.authority_effective, true);
  assert.equal(effective.comparator_execution_authorized, true);
  assert.equal(effective.maximum_execution_count, 1);
  assert.equal(effective.required_execution_attempt, 1);
  assert.equal(effective.rerun_authorized, false);
  assert.equal(effective.duplicate_execution_authorized, false);
  assert.equal(effective.authority_reuse_authorized, false);
  assert.equal(effective.single_use_contract.same_execution_id_reuse_authorized, false);
  assert.equal(effective.workflow_dispatch_performed, false);
  assert.equal(effective.formal_comparator_executed, false);
  assert.equal(effective.formal_comparator_evidence_created, false);
  assert.equal(effective.explicit_one_shot_execution_approval_required, true);
  assert.ok(Date.parse(effective.expires_at) > Date.now(), 'AUTHORITY_EXPIRED');

  assert.equal(effectiveness.record_status, 'FORMAL_CROSS_RUN_COMPARATOR_REPLACEMENT_002_AUTHORITY_EFFECTIVENESS_ESTABLISHED');
  assert.equal(effectiveness.candidate_head_sha, CANDIDATE_HEAD);
  assert.equal(effectiveness.candidate_merge_sha, BASE);
  assert.equal(effectiveness.candidate_to_merge_file_delta, 0);
  assert.equal(effectiveness.candidate_to_merge_execution_object_delta, 0);
  assert.equal(effectiveness.effective_authority.blob_sha, '591ad3c6c188d19c9e6eff89382e147854f25b63');
  assert.equal(effectiveness.effective_authority.semantic_digest, 'sha256:6b6975a8f724ee27ed3141a919d28c215277c0580cd2e9487a091f743e5890f9');
  assert.equal(effectiveness.production_gate_eligible, true);
  assert.equal(effectiveness.workflow_dispatch_performed, false);
  assert.equal(effectiveness.formal_comparator_execution_performed, false);
  assert.equal(effectiveness.explicit_one_shot_execution_approval_required, true);

  assert.equal(boundary.new_file_count, 5);
  assert.equal(boundary.modified_file_count, 0);
  assert.deepEqual([...boundary.changed_files].sort(), CHANGED);
  assert.equal(boundary.runtime_source_file_count, 0);
  assert.equal(boundary.comparator_implementation_file_count, 0);
  assert.equal(boundary.execution_workflow_file_count, 0);
  assert.equal(boundary.execution_control_file_count, 0);
  assert.equal(boundary.workflow_dispatch_performed, false);
  assert.equal(boundary.formal_comparator_execution_performed, false);
  assert.equal(boundary.effective_authority_blob_sha, '591ad3c6c188d19c9e6eff89382e147854f25b63');
  assert.equal(boundary.effectiveness_record_blob_sha, '9f67f4f539e38b5639d53b37a1e582050f7f2f57');
  assert.equal(boundary.replacement_001_authority_consumed, true);
  assert.equal(boundary.replacement_001_remaining_execution_count, 0);

  assert.equal(objects.object_count, 12);
  for (const item of objects.objects) {
    assert.equal(git('rev-parse', `${CANDIDATE_HEAD}:${item.path}`), item.blob_sha, `CANDIDATE_OBJECT:${item.role}`);
    assert.equal(git('rev-parse', `${BASE}:${item.path}`), item.blob_sha, `MERGED_OBJECT:${item.role}`);
    assert.equal(git('rev-parse', `${head}:${item.path}`), item.blob_sha, `EFFECTIVENESS_OBJECT:${item.role}`);
  }

  assert.equal(supersession.predecessor.authority_consumed, true);
  assert.equal(supersession.predecessor.remaining_execution_count, 0);
  assert.equal(supersession.predecessor.rerun_authorized, false);
  assert.equal(failure.terminal_governance.authority_consumed, true);
  assert.equal(failure.terminal_governance.rerun_authorized, false);
  assert.equal(consumption.consumption_state.remaining_execution_count, 0);
  assert.equal(oldEffective.comparator_execution_id, 'MCFT-CAP-08-S6-FORMAL-CROSS-RUN-COMPARATOR-20260804-REPLACEMENT-001');
  assert.equal(oldEffective.authority_effective, true);
  assert.notEqual(oldEffective.comparator_execution_id, effective.comparator_execution_id);

  const audit = JSON.parse(fs.readFileSync(path.resolve(AUDIT), 'utf8'));
  assert.equal(audit.status, 'PASS');
  assert.deepEqual(
    [
      audit.candidate_qualification.workflow_run_id,
      audit.candidate_qualification.workflow_run_attempt,
      audit.candidate_qualification.event,
      audit.candidate_qualification.conclusion,
      audit.candidate_qualification.head_sha,
      audit.candidate_qualification.artifact_id,
      audit.candidate_qualification.artifact_digest,
    ],
    [
      30897919642,
      1,
      'pull_request',
      'success',
      CANDIDATE_HEAD,
      8887810823,
      'sha256:2de540113b6ce1c548b97acbcaa73e9ecb2c55d3014dada087515b7967044d6a',
    ],
  );

  const workflowSource = read(WORKFLOW);
  assert.equal(workflowSource.includes('workflow_dispatch'), false, 'NO_WORKFLOW_DISPATCH');
  assert.equal(workflowSource.includes('actions/download-artifact'), false, 'NO_ARTIFACT_DOWNLOAD');
  assert.equal(workflowSource.includes('formal_semantic_comparator_v1.cjs'), false, 'NO_COMPARATOR_EXECUTION');
  assert.equal(workflowSource.includes('docker'), false, 'NO_DATABASE_RUNTIME');
  assert.ok(workflowSource.includes('contents: read'));
  assert.ok(workflowSource.includes('actions: read'));

  const effectiveGate = spawnSync(process.execPath, [path.join(ROOT, CONTROL), 'gate'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_RUN_ATTEMPT: '1',
      MCFT_EXECUTION_AUTHORITY_PATH: path.join(ROOT, EFFECTIVE),
      MCFT_EXACT_SUBJECT_SHA: SUBJECT,
      MCFT_COMPARATOR_EXECUTION_ID: EXECUTION_ID,
    },
  });
  assert.equal(effectiveGate.status, 0, `EFFECTIVE_AUTHORITY_GATE:${effectiveGate.stderr}`);
  assert.ok(effectiveGate.stdout.includes(`MCFT_CAP08_FORMAL_COMPARATOR_AUTHORITY=${path.join(ROOT, EFFECTIVE)}`));

  const candidateGate = spawnSync(process.execPath, [path.join(ROOT, CONTROL), 'gate'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_RUN_ATTEMPT: '1',
      MCFT_EXECUTION_AUTHORITY_PATH: path.join(ROOT, CANDIDATE),
      MCFT_EXACT_SUBJECT_SHA: SUBJECT,
      MCFT_COMPARATOR_EXECUTION_ID: EXECUTION_ID,
    },
  });
  assert.notEqual(candidateGate.status, 0, 'CANDIDATE_MUST_REMAIN_REJECTED');

  const wrongAttemptGate = spawnSync(process.execPath, [path.join(ROOT, CONTROL), 'gate'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_RUN_ATTEMPT: '2',
      MCFT_EXECUTION_AUTHORITY_PATH: path.join(ROOT, EFFECTIVE),
      MCFT_EXACT_SUBJECT_SHA: SUBJECT,
      MCFT_COMPARATOR_EXECUTION_ID: EXECUTION_ID,
    },
  });
  assert.notEqual(wrongAttemptGate.status, 0, 'ATTEMPT_2_MUST_FAIL');

  assert.equal(git('rev-parse', `${BASE}:${EXEC_WORKFLOW}`), '247355dc2f0a3fcb782f1621503bd30713871a81');
  assert.equal(git('rev-parse', `${head}:${EXEC_WORKFLOW}`), '247355dc2f0a3fcb782f1621503bd30713871a81');
  assert.equal(git('rev-parse', `${BASE}:${CONTROL}`), '2cdc4e903dacb00b87f175dea58d89d80c6f3108');
  assert.equal(git('rev-parse', `${head}:${CONTROL}`), '2cdc4e903dacb00b87f175dea58d89d80c6f3108');

  const result = {
    schema_version: 'geox_mcft_cap08_s6_formal_comparator_replacement_002_authority_effectiveness_result_v1',
    status: 'PASS',
    evidence_class: 'STATIC_REPLACEMENT_002_AUTHORITY_EFFECTIVENESS_EVIDENCE',
    base_main_sha: BASE,
    exact_head_sha: head,
    candidate_head_sha: CANDIDATE_HEAD,
    candidate_merge_sha: BASE,
    candidate_to_merge_file_delta: 0,
    candidate_to_merge_execution_object_delta: 0,
    candidate_qualification_run_id: 30897919642,
    candidate_qualification_artifact_id: 8887810823,
    effective_authority_id: effective.authority_id,
    effective_authority_blob_sha: '591ad3c6c188d19c9e6eff89382e147854f25b63',
    effective_authority_semantic_digest: effective.semantic_digest,
    comparator_execution_id: EXECUTION_ID,
    exact_subject_sha: SUBJECT,
    object_count: 12,
    authority_effective: true,
    comparator_execution_authorized: true,
    maximum_execution_count: 1,
    required_execution_attempt: 1,
    rerun_authorized: false,
    duplicate_execution_authorized: false,
    authority_reuse_authorized: false,
    explicit_one_shot_execution_approval_required: true,
    workflow_dispatch_performed: false,
    formal_comparator_executed: false,
    formal_comparator_evidence_created: false,
    next_legal_action: 'REQUEST_EXPLICIT_ONE_SHOT_FORMAL_CROSS_RUN_COMPARATOR_EXECUTION_AUTHORIZATION',
  };
  save(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  save({
    schema_version: 'geox_mcft_cap08_s6_formal_comparator_replacement_002_authority_effectiveness_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
