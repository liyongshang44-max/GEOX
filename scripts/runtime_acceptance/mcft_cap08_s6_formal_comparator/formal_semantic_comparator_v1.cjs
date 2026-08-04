#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  semanticProjectionV1,
  semanticDifferencesV1,
  digestV1,
} = require('../mcft_cap08_s6_single_run_workflow/semantic_comparator_v1.cjs');

const FINAL_EVIDENCE = 'FINAL_FORMAL_EVIDENCE_ELIGIBLE_AFTER_TERMINAL_SUCCESS';

function assertFormalBundleV1(bundle, label) {
  assert.equal(bundle.schema_version, 'geox_mcft_cap08_s6_final_formal_run_artifact_bundle_v1', `${label}_SCHEMA`);
  assert.equal(bundle.classification, 'FINAL_FORMAL', `${label}_CLASSIFICATION`);
  assert.equal(bundle.execution_mode, 'FINAL_FORMAL', `${label}_EXECUTION_MODE`);
  assert.equal(bundle.evidence_class, FINAL_EVIDENCE, `${label}_EVIDENCE_CLASS`);
  assert.equal(bundle.hard_acceptance_eligible, true, `${label}_HARD_ACCEPTANCE`);
  assert.equal(bundle.fresh_database?.status, 'PASS', `${label}_DATABASE_STATUS`);
  assert.equal(bundle.fresh_database?.fresh, true, `${label}_DATABASE_FRESH`);
  assert.equal(bundle.receipt_manifest?.receipt_count, 153, `${label}_RECEIPT_COUNT`);
  assert.equal(bundle.materialization?.operational_events?.length, 224, `${label}_EVENT_COUNT`);
  assert.equal(bundle.spec?.phase_count, 28, `${label}_PHASE_COUNT`);
}

function assertAuthorityV1(authority, audit) {
  assert.equal(authority.schema_version, 'geox_mcft_cap08_s6_formal_cross_run_comparator_authority_v1');
  assert.equal(authority.record_status, 'FORMAL_CROSS_RUN_COMPARATOR_AUTHORIZED');
  assert.equal(authority.authority_effective, true, 'FORMAL_COMPARATOR_AUTHORITY_NOT_EFFECTIVE');
  assert.equal(authority.comparator_execution_authorized, true, 'FORMAL_COMPARATOR_EXECUTION_NOT_AUTHORIZED');
  assert.equal(authority.maximum_execution_count, 1);
  assert.equal(authority.required_execution_attempt, 1);
  assert.equal(authority.rerun_authorized, false);
  assert.equal(authority.exact_subject_sha, audit.exact_subject_sha);
  assert.equal(audit.status, 'PASS');
  for (const key of ['run_a', 'run_b']) {
    assert.equal(audit[key].workflow_run_id, authority.inputs[key].workflow_run_id);
    assert.equal(audit[key].workflow_run_attempt, 1);
    assert.equal(audit[key].artifact_id, authority.inputs[key].artifact_id);
    assert.equal(audit[key].artifact_digest, authority.inputs[key].artifact_digest);
  }
}

function writeResultV1(outputPath, result) {
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`);
}

function main() {
  const aPath = String(process.env.MCFT_CAP08_FORMAL_RUN_A_BUNDLE || '').trim();
  const bPath = String(process.env.MCFT_CAP08_FORMAL_RUN_B_BUNDLE || '').trim();
  const authorityPath = String(process.env.MCFT_CAP08_FORMAL_COMPARATOR_AUTHORITY || '').trim();
  const auditPath = String(process.env.MCFT_CAP08_FORMAL_COMPARATOR_INPUT_AUDIT || '').trim();
  const outputPath = String(process.env.MCFT_CAP08_FORMAL_COMPARATOR_OUTPUT || '').trim();
  assert.ok(aPath && bPath && authorityPath && auditPath && outputPath, 'FORMAL_COMPARATOR_PATHS_REQUIRED');
  const authority = JSON.parse(fs.readFileSync(path.resolve(authorityPath), 'utf8'));
  const audit = JSON.parse(fs.readFileSync(path.resolve(auditPath), 'utf8'));
  assertAuthorityV1(authority, audit);
  const a = JSON.parse(fs.readFileSync(path.resolve(aPath), 'utf8'));
  const b = JSON.parse(fs.readFileSync(path.resolve(bPath), 'utf8'));
  assertFormalBundleV1(a, 'RUN_A');
  assertFormalBundleV1(b, 'RUN_B');
  assert.equal(a.spec.run_label, 'RUN_A');
  assert.equal(b.spec.run_label, 'RUN_B');
  assert.equal(a.spec.exact_subject_sha, authority.exact_subject_sha);
  assert.equal(b.spec.exact_subject_sha, authority.exact_subject_sha);
  assert.equal(a.artifact_digest, authority.inputs.run_a.formal_artifact_digest);
  assert.equal(b.artifact_digest, authority.inputs.run_b.formal_artifact_digest);
  assert.notEqual(a.spec.operational_run_instance_id, b.spec.operational_run_instance_id, 'INDEPENDENT_OPERATIONAL_IDENTITIES_REQUIRED');
  assert.notEqual(a.fresh_database.database_name, b.fresh_database.database_name, 'INDEPENDENT_DATABASE_NAMES_REQUIRED');
  assert.notEqual(a.fresh_database.logical_database_identity, b.fresh_database.logical_database_identity, 'INDEPENDENT_LOGICAL_DATABASE_IDENTITIES_REQUIRED');
  assert.notEqual(a.materialization.database_instance_digest, b.materialization.database_instance_digest, 'INDEPENDENT_DATABASE_INSTANCE_DIGESTS_REQUIRED');

  const projectionA = semanticProjectionV1(a);
  const projectionB = semanticProjectionV1(b);
  const digestA = digestV1(projectionA);
  const digestB = digestV1(projectionB);
  const differences = semanticDifferencesV1(projectionA, projectionB);
  const common = {
    schema_version: 'geox_mcft_cap08_s6_formal_cross_run_semantic_comparator_v1',
    evidence_class: 'FINAL_FORMAL_CROSS_RUN_COMPARATOR_EVIDENCE',
    authority_id: authority.authority_id,
    exact_subject_sha: authority.exact_subject_sha,
    comparator_execution_attempt: Number(process.env.GITHUB_RUN_ATTEMPT || '1'),
    run_a: {
      workflow_run_id: authority.inputs.run_a.workflow_run_id,
      artifact_id: authority.inputs.run_a.artifact_id,
      operational_run_instance_id: a.spec.operational_run_instance_id,
      logical_database_identity: a.fresh_database.logical_database_identity,
      physical_database_name: a.fresh_database.database_name,
      formal_artifact_digest: a.artifact_digest,
    },
    run_b: {
      workflow_run_id: authority.inputs.run_b.workflow_run_id,
      artifact_id: authority.inputs.run_b.artifact_id,
      operational_run_instance_id: b.spec.operational_run_instance_id,
      logical_database_identity: b.fresh_database.logical_database_identity,
      physical_database_name: b.fresh_database.database_name,
      formal_artifact_digest: b.artifact_digest,
    },
    semantic_digest_a: digestA,
    semantic_digest_b: digestB,
    independent_database_instances: true,
    normalization_contract: {
      signed_cursor_token: 'PRESENCE_ONLY',
      response_transport_timestamp_and_hash: 'EXCLUDED',
      recovery_event_ref: 'PRESENCE_ONLY',
      canonical_objects: 'FULL_VALUE',
      canonical_receipts: 'FULL_VALUE',
      operational_events: 'FULL_VALUE',
    },
    execution_count_consumed: 1,
    maximum_execution_count: 1,
    rerun_authorized: false,
  };
  if (digestA !== digestB || differences.difference_count !== 0) {
    const failure = { ...common, status: 'FAIL', semantic_equivalence: false, difference_count: differences.difference_count, difference_samples: differences.samples, hard_acceptance_eligible: false, s6_candidate_authorized: false };
    writeResultV1(outputPath, failure);
    console.error(JSON.stringify(failure, null, 2));
    process.exitCode = 1;
    return;
  }
  const result = { ...common, status: 'PASS', semantic_equivalence: true, difference_count: 0, hard_acceptance_eligible: true, s6_candidate_authorized: false };
  writeResultV1(outputPath, result);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();
module.exports = { assertFormalBundleV1, assertAuthorityV1, semanticProjectionV1, semanticDifferencesV1, digestV1, main };
