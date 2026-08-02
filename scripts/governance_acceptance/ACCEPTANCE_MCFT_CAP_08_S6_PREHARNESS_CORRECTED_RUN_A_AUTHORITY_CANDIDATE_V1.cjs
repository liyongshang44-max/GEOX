#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '93eb19f74faed372908764e5e3d2410a2ff50b45';
const CORRECTION_CANDIDATE = '0742a9b79eb60b338a87cf00ff96a0526d334597';
const OLD_SUBJECT = '26d94d5c47ce640e80374124bb473d62003cc9a6';
const NEW_ID = 'MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-001';
const NEW_DB_ID = 'MCFT-CAP-08-S6-FORMAL-DB-A-20260802-REPLACEMENT-001';
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_PREHARNESS_CORRECTED_RUN_A_AUTHORITY_CANDIDATE_RESULT.json');

const P = {
  workflow: '.github/workflows/mcft-cap-08-s6-preharness-corrected-run-a-authority-candidate.yml',
  retiredRunB: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-RUN-B-EXECUTION-AUTHORITY-EFFECTIVE-V1.json',
  boundary: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PREHARNESS-CORRECTED-RUN-A-AUTHORITY-BOUNDARY-V1.json',
  candidate: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PREHARNESS-CORRECTED-FORMAL-RUN-A-AUTHORITY-CANDIDATE-V1.json',
  issuance: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PREHARNESS-CORRECTED-RUN-A-AUTHORITY-ISSUANCE-V1.json',
  manifest: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PREHARNESS-CORRECTED-RUN-A-AUTHORITY-OBJECT-SET-V1.json',
  validator: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_PREHARNESS_CORRECTED_RUN_A_AUTHORITY_CANDIDATE_V1.cjs',
  oldManifest: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FINAL-REPLACEMENT-FORMAL-EXECUTION-AUTHORITY-OBJECT-SET-V1.json',
  oldRunA: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json',
  gate: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs'
};
const FILES = [P.workflow, P.retiredRunB, P.boundary, P.candidate, P.issuance, P.manifest, P.validator].sort();

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
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
function write(result) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
}
function assertObjectSet(set, label) {
  for (const [rel, expectedBlob] of Object.entries(set)) {
    assert.equal(git('rev-parse', `HEAD:${rel}`), expectedBlob, `${label}:${rel}`);
    assert.equal(git('rev-parse', `${BASE}:${rel}`), expectedBlob, `${label}_BASE:${rel}`);
  }
}
function gateRejects(authority, label) {
  const { validateExecutionAuthorityV1 } = require(path.join(ROOT, P.gate));
  assert.throws(
    () => validateExecutionAuthorityV1(authority, {
      exactSubjectSha: authority.exact_subject_sha,
      runLabel: authority.authorized_run_label,
      operationalRunInstanceId: authority.operational_run_instance_id
    }),
    /record_status|Expected values to be strictly equal/,
    label
  );
}

try {
  const base = String(process.env.MCFT_BASE_SHA || BASE).trim();
  assert.equal(base, BASE, 'EXACT_BASE_MAIN_SHA');
  assert.equal(git('merge-base', base, 'HEAD'), base, 'BASE_MUST_BE_ANCESTOR');
  assert.equal(git('diff', '--check', `${base}...HEAD`), '', 'DIFF_CHECK');
  assert.equal(git('diff', '--name-only', `${CORRECTION_CANDIDATE}...${BASE}`), '', 'CORRECTION_CANDIDATE_TO_MERGE_FILE_DELTA');

  const changed = git('diff', '--name-only', `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, FILES, 'EXACT_SEVEN_FILE_BOUNDARY');

  const boundary = readJson(P.boundary);
  const candidate = readJson(P.candidate);
  const issuance = readJson(P.issuance);
  const manifest = readJson(P.manifest);
  const oldManifest = readJson(P.oldManifest);
  const retiredRunB = readJson(P.retiredRunB);
  const workflow = fs.readFileSync(path.join(ROOT, P.workflow), 'utf8');

  assert.equal(boundary.base_main_sha, BASE);
  assert.equal(boundary.changed_file_count, 7);
  assert.deepEqual([...boundary.changed_files].sort(), FILES);
  assert.equal(boundary.modified_existing_file.previous_blob_sha, '5fd46c4bbe1fbd816412bde47de3230c2764bff6');
  assert.equal(boundary.candidate_runtime_gate_eligible, false);
  assert.equal(boundary.old_run_b_dispatch_authorized, false);
  assert.equal(boundary.database_execution_performed, false);
  assert.equal(boundary.workflow_dispatch_performed, false);
  assert.equal(boundary.semantic_digest, semanticDigest(boundary));

  assert.equal(manifest.base_main_sha, BASE);
  assert.equal(manifest.exact_subject_sha, BASE);
  assert.equal(manifest.correction_provenance.failed_workflow_run_id, 30736728638);
  assert.equal(manifest.correction_provenance.correction_merge_sha, BASE);
  assert.equal(manifest.correction_provenance.candidate_to_merge_file_delta, 0);
  assert.equal(manifest.correction_provenance.corrected_entrypoint_blob_sha, '4b68df5cb74b445301e4554ef3fe160ed9c14500');
  assert.equal(manifest.correction_provenance.previous_entrypoint_blob_sha, '43a6cdea691c906868a5c9a9d961378be585d121');
  assert.equal(manifest.semantic_digest, semanticDigest(manifest));

  const oldControl = structuredClone(manifest.exact_control_plane_object_set);
  oldControl['scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/workflow_entrypoint_v1.ts'] =
    '43a6cdea691c906868a5c9a9d961378be585d121';
  assert.deepEqual(oldControl, oldManifest.exact_control_plane_object_set, 'ONLY_ENTRYPOINT_CONTROL_PLANE_DELTA');
  assert.deepEqual(manifest.exact_product_object_set, oldManifest.exact_product_object_set, 'PRODUCT_OBJECT_SET_UNCHANGED');
  assert.deepEqual(manifest.exact_port_bundle_object_set, oldManifest.exact_port_bundle_object_set, 'PORT_OBJECT_SET_UNCHANGED');
  assert.deepEqual(manifest.protected_invariant_object_set, oldManifest.protected_invariant_object_set, 'PROTECTED_OBJECT_SET_UNCHANGED');

  assertObjectSet(manifest.exact_control_plane_object_set, 'CONTROL_PLANE');
  assertObjectSet(manifest.exact_product_object_set, 'PRODUCT');
  assertObjectSet(manifest.exact_port_bundle_object_set, 'PORT_BUNDLE');
  assertObjectSet(manifest.protected_invariant_object_set, 'PROTECTED');
  const objectEntryCount =
    Object.keys(manifest.exact_control_plane_object_set).length +
    Object.keys(manifest.exact_product_object_set).length +
    Object.keys(manifest.exact_port_bundle_object_set).length +
    Object.keys(manifest.protected_invariant_object_set).length;
  assert.equal(objectEntryCount, 36);

  assert.equal(candidate.record_status, 'FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORITY_CANDIDATE_NOT_EFFECTIVE');
  assert.equal(candidate.exact_subject_sha, BASE);
  assert.equal(candidate.authorized_run_label, 'RUN_A');
  assert.equal(candidate.operational_run_instance_id, NEW_ID);
  assert.equal(candidate.logical_database_identity.identity_id, NEW_DB_ID);
  assert.equal(candidate.replaces_consumed_authority.blob_sha, '712fc4b59c870f9b7e243c21b29c2eac24d8b9e3');
  assert.equal(candidate.replaces_consumed_authority.failed_workflow_run_id, 30736728638);
  assert.equal(candidate.replaces_consumed_authority.reusable, false);
  assert.equal(candidate.object_set_manifest_ref.semantic_digest, manifest.semantic_digest);
  assert.equal(candidate.activation_contract.separate_effectiveness_required, true);
  assert.equal(candidate.activation_contract.candidate_record_is_runtime_gate_eligible, false);
  assert.equal(candidate.authorization_state.authority_effective, false);
  assert.equal(candidate.authorization_state.database_execution_performed, false);
  assert.equal(candidate.authorization_state.workflow_dispatch_performed, false);
  assert.equal(candidate.semantic_digest, semanticDigest(candidate));
  assert.notEqual(candidate.operational_run_instance_id, 'MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-001');
  assert.notEqual(candidate.operational_run_instance_id, 'MCFT-CAP-08-S6-FORMAL-RUN-B-20260802-002');
  assert.doesNotMatch(candidate.operational_run_instance_id, /QUAL|V10/i);
  const identitySearch = spawnSync('git', ['grep', '-F', NEW_ID, BASE, '--'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(identitySearch.status, 1, 'NEW_OPERATIONAL_ID_MUST_NOT_EXIST_ON_BASE');
  gateRejects(candidate, 'CANDIDATE_MUST_BE_REJECTED_BY_PRODUCTION_GATE');

  assert.equal(retiredRunB.record_status, 'SINGLE_FINAL_FORMAL_RUN_AUTHORITY_RETIRED_OBSOLETE_SUBJECT');
  assert.equal(retiredRunB.exact_subject_sha, OLD_SUBJECT);
  assert.equal(retiredRunB.operational_run_instance_id, 'MCFT-CAP-08-S6-FORMAL-RUN-B-20260802-002');
  assert.equal(retiredRunB.retirement_evidence.failed_run_a_workflow_run_id, 30736728638);
  assert.equal(retiredRunB.retirement_evidence.correction_merge_sha, BASE);
  assert.equal(retiredRunB.single_run_database_execution_authorized, false);
  assert.equal(retiredRunB.database_execution_workflow_authorized, false);
  assert.equal(retiredRunB.workflow_dispatch_execution_authorized, false);
  assert.equal(retiredRunB.final_formal_run_execution_authorized, false);
  assert.equal(retiredRunB.dispatch_inputs, null);
  assert.equal(retiredRunB.replacement_run_b_authority_issued, false);
  assert.equal(retiredRunB.semantic_digest, semanticDigest(retiredRunB));
  gateRejects(retiredRunB, 'OBSOLETE_RUN_B_AUTHORITY_MUST_BE_REJECTED');
  assert.equal(git('rev-parse', `${BASE}:${P.retiredRunB}`), '5fd46c4bbe1fbd816412bde47de3230c2764bff6');
  assert.notEqual(git('rev-parse', `HEAD:${P.retiredRunB}`), '5fd46c4bbe1fbd816412bde47de3230c2764bff6');
  assert.equal(git('rev-parse', `HEAD:${P.oldRunA}`), '712fc4b59c870f9b7e243c21b29c2eac24d8b9e3', 'CONSUMED_RUN_A_RECORD_PRESERVED');

  assert.equal(issuance.base_main_sha, BASE);
  assert.equal(issuance.new_run_a_authority_candidate.runtime_gate_eligible, false);
  assert.equal(issuance.new_run_a_authority_candidate.operational_run_instance_id, NEW_ID);
  assert.equal(issuance.obsolete_run_b_authority_retirement.dispatch_authorized, false);
  assert.equal(issuance.identity_policy.old_run_a_operational_id_reused, false);
  assert.equal(issuance.identity_policy.old_run_b_operational_id_reused, false);
  assert.equal(issuance.identity_policy.old_database_identity_reused, false);
  assert.equal(issuance.activation_contract.separate_effectiveness_required, true);
  assert.equal(issuance.activation_contract.database_execution_in_candidate_pr, false);
  assert.equal(issuance.semantic_digest, semanticDigest(issuance));

  assert.doesNotMatch(workflow, /workflow_dispatch:|postgres|psql|DATABASE_URL/i);
  assert.equal(changed.some((rel) => rel.startsWith('apps/server/') || rel.startsWith('apps/web/') || /migration/i.test(rel)), false);
  assert.equal(changed.some((rel) => rel.startsWith('scripts/runtime_acceptance/')), false);

  const result = {
    schema_version: 'geox_mcft_cap08_s6_preharness_corrected_run_a_authority_candidate_result_v1',
    status: 'PASS',
    base_main_sha: base,
    exact_head_sha: git('rev-parse', 'HEAD'),
    correction_candidate_to_merge_file_delta: 0,
    corrected_subject_sha: BASE,
    frozen_object_entry_count: objectEntryCount,
    corrected_entrypoint_blob_sha: manifest.correction_provenance.corrected_entrypoint_blob_sha,
    new_operational_run_instance_id: NEW_ID,
    new_logical_database_identity: NEW_DB_ID,
    identity_reuse: false,
    candidate_runtime_gate_eligible: false,
    candidate_gate_rejected: true,
    obsolete_run_b_gate_rejected: true,
    old_run_b_dispatch_authorized: false,
    replacement_run_b_authority_present: false,
    database_execution_performed: false,
    workflow_dispatch_performed: false,
    formal_run_result_present: false,
    cross_run_comparator_authorized: false,
    s6_candidate_implemented: false,
    mcft_cap_08_complete: false,
    mcft_cap_09_authorized: false
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap08_s6_preharness_corrected_run_a_authority_candidate_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error)
  });
  throw error;
}
