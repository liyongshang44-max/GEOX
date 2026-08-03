#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  validateDevelopmentRehearsalAuthorityV1,
} = require('./execution_authority_gate_v1.cjs');

const ROOT = path.resolve(__dirname, '../../..');
const MANIFEST_PATH = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-EXACT-PATH-DEVELOPMENT-REHEARSAL-OBJECT-SET-V1.json';
const OUTPUT_DIR = path.join(ROOT, 'acceptance-output/development-rehearsal-authority');
const EXPECTED_OBJECT_COUNT = 56;

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function loadManifestV1() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, MANIFEST_PATH), 'utf8'));
  assert.equal(manifest.record_status, 'EXACT_PATH_DEVELOPMENT_REHEARSAL_OBJECT_SET_FROZEN');
  assert.equal(manifest.object_count, EXPECTED_OBJECT_COUNT);
  const sets = [
    manifest.exact_control_plane_object_set,
    manifest.exact_database_bootstrap_object_set,
    manifest.exact_product_object_set,
    manifest.exact_port_bundle_object_set,
    manifest.exact_harness_object_set,
    manifest.protected_invariant_object_set,
  ];
  assert.equal(
    sets.reduce((count, set) => count + Object.keys(set).length, 0),
    EXPECTED_OBJECT_COUNT,
  );
  for (const set of sets) {
    for (const [file, sha] of Object.entries(set)) {
      assert.equal(git('rev-parse', `HEAD:${file}`), sha, `REHEARSAL_OBJECT_BLOB:${file}`);
    }
  }
  assert.equal(git('rev-parse', `HEAD:${manifest.workflow_path}`), manifest.workflow_blob_sha);
  assert.equal(git('rev-parse', `HEAD:${manifest.port_bundle_path}`), manifest.port_bundle_blob_sha);
  return manifest;
}

function buildAuthorityV1({ manifest, exactSubjectSha, githubRunId, slot }) {
  const isA = slot === 'A';
  assert.ok(isA || slot === 'B', 'REHEARSAL_SLOT');
  const runLabel = isA ? 'RUN_A' : 'RUN_B';
  const rehearsalRunLabel = isA ? 'RUN_DEV_A' : 'RUN_DEV_B';
  const op = `MCFT-CAP-08-S6-${rehearsalRunLabel}-${githubRunId}`;
  const dbIdentity = `MCFT-CAP-08-S6-DB-${rehearsalRunLabel}-${githubRunId}`;
  const now = Date.now();
  return {
    schema_version: 'geox_mcft_cap08_s6_development_rehearsal_execution_authority_v1',
    authority_id: `GEOX-MCFT-CAP-08-S6-${rehearsalRunLabel}-DEVELOPMENT-REHEARSAL-AUTHORITY-V1`,
    record_status: 'DEVELOPMENT_REHEARSAL_DATABASE_EXECUTION_AUTHORIZED',
    authority_class: 'DEVELOPMENT_REHEARSAL',
    evidence_class: 'NON_FORMAL',
    capability_line_id: 'MCFT-CAP-08',
    slice_id: 'MCFT-CAP-08.S6',
    exact_subject_sha: exactSubjectSha,
    authorized_run_label: runLabel,
    rehearsal_run_label: rehearsalRunLabel,
    operational_run_instance_id: op,
    logical_database_identity: {
      identity_id: dbIdentity,
      physical_name_template: `geox_mcft_cap08_s6_rehearsal_${slot.toLowerCase()}_<github_run_id>`,
      fresh_disposable_required: true,
      drop_after_run_required: true,
      identity_frozen: true,
      reusable: false,
    },
    issued_at: new Date(now).toISOString(),
    expires_at: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    single_run_database_execution_authorized: true,
    database_execution_workflow_authorized: true,
    workflow_dispatch_execution_authorized: false,
    development_rehearsal_workflow_authorized: true,
    development_double_run_authorized: true,
    development_semantic_comparator_authorized: true,
    final_formal_run_execution_authorized: false,
    hard_acceptance_eligible: false,
    s6_candidate_evidence_eligible: false,
    cross_run_comparison_eligible: false,
    ledger_settlement_eligible: false,
    dual_run_ci_authorized: false,
    cross_run_comparator_authorized: false,
    final_ledger_settlement_authorized: false,
    object_set_manifest_ref: {
      path: MANIFEST_PATH,
      blob_sha: git('rev-parse', `HEAD:${MANIFEST_PATH}`),
      object_count: manifest.object_count,
    },
    port_bundle_path: manifest.port_bundle_path,
    port_bundle_blob_sha: manifest.port_bundle_blob_sha,
    workflow_path: manifest.workflow_path,
    workflow_blob_sha: manifest.workflow_blob_sha,
    database_execution_performed: false,
    formal_run_executed: false,
    nonclaims: [
      'NON_FORMAL_EVIDENCE_ONLY',
      'NO_FORMAL_AUTHORITY_EFFECTIVENESS',
      'NO_FORMAL_WORKFLOW_DISPATCH',
      'NO_HARD_ACCEPTANCE',
      'NO_FORMAL_RUN_RESULT',
      'NO_RUN_B_FORMAL_AUTHORITY',
      'NO_CROSS_RUN_FORMAL_COMPARATOR',
      'NO_S6_CANDIDATE',
      'NO_LEDGER_SETTLEMENT',
    ],
  };
}

function main() {
  const exactSubjectSha = git('rev-parse', 'HEAD');
  const githubRunId = String(process.env.GITHUB_RUN_ID || '').trim();
  assert.match(githubRunId, /^[1-9][0-9]*$/, 'GITHUB_RUN_ID_REQUIRED');
  const manifest = loadManifestV1();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const results = {};
  for (const slot of ['A', 'B']) {
    const authority = buildAuthorityV1({ manifest, exactSubjectSha, githubRunId, slot });
    const validated = validateDevelopmentRehearsalAuthorityV1(authority, {
      exactSubjectSha,
      runLabel: authority.authorized_run_label,
      operationalRunInstanceId: authority.operational_run_instance_id,
    });
    const file = path.join(OUTPUT_DIR, `MCFT_CAP_08_S6_RUN_DEV_${slot}_AUTHORITY.json`);
    fs.writeFileSync(file, `${JSON.stringify(authority, null, 2)}\n`);
    results[slot] = {
      authority_path: file,
      run_label: authority.authorized_run_label,
      rehearsal_run_label: authority.rehearsal_run_label,
      operational_run_instance_id: authority.operational_run_instance_id,
      logical_database_identity: authority.logical_database_identity.identity_id,
      authority_digest: validated.authority_digest,
    };
  }
  const result = {
    schema_version: 'geox_mcft_cap08_s6_development_rehearsal_authority_preparation_result_v1',
    status: 'PASS',
    exact_subject_sha: exactSubjectSha,
    object_count: manifest.object_count,
    manifest_path: MANIFEST_PATH,
    authorities: results,
    formal_authority_created: false,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'PREPARE_RESULT.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = { MANIFEST_PATH, EXPECTED_OBJECT_COUNT, loadManifestV1, buildAuthorityV1 };
