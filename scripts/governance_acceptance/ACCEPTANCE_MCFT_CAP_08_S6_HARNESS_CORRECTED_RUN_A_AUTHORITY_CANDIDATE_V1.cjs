#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '6c17cf1043081621609371b6a46c6ecbeb1ad706';
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_HARNESS_CORRECTED_RUN_A_AUTHORITY_CANDIDATE_RESULT.json');
const FILES = [
  '.github/workflows/mcft-cap-08-s6-harness-corrected-run-a-authority-candidate.yml',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-HARNESS-CORRECTED-FORMAL-RUN-A-AUTHORITY-CANDIDATE-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-HARNESS-CORRECTED-RUN-A-AUTHORITY-BOUNDARY-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-HARNESS-CORRECTED-RUN-A-AUTHORITY-ISSUANCE-V1.json',
  'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-HARNESS-CORRECTED-RUN-A-AUTHORITY-OBJECT-SET-V1.json',
  'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_HARNESS_CORRECTED_RUN_A_AUTHORITY_CANDIDATE_V1.cjs'
];
const P = {
  workflow: FILES[0],
  candidate: FILES[1],
  boundary: FILES[2],
  issuance: FILES[3],
  objectSet: FILES[4],
  gate: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs',
  harness: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/harness_v1.cjs',
  portContract: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/port_contract_v1.cjs',
  syntheticData: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/synthetic_data_acceptance_v1.cjs',
  consumedRunA: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PREHARNESS-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json',
  retiredRunB: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-RUN-B-EXECUTION-AUTHORITY-EFFECTIVE-V1.json',
  failureSettlement: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-RUN-A-HARNESS-PORT-VALIDATOR-FAILURE-SETTLEMENT-V1.json'
};

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
function digest(value) {
  const copy = structuredClone(value);
  delete copy.semantic_digest;
  return `sha256:${crypto.createHash('sha256').update(canonical(copy)).digest('hex')}`;
}
function write(result) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
}
function assertObjectSet(set) {
  for (const [rel, expected] of Object.entries(set)) {
    assert.equal(git('rev-parse', `HEAD:${rel}`), expected, `OBJECT_BLOB:${rel}`);
  }
}
function grepFiles(value) {
  try {
    return git('grep', '-l', '-F', value, '--', 'docs/digital_twin/mcft/cap_08').split(/\r?\n/).filter(Boolean);
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
}

async function main() {
  const base = String(process.env.MCFT_BASE_SHA || BASE).trim();
  assert.equal(base, BASE, 'EXACT_BASE_MAIN_SHA');
  assert.equal(git('merge-base', base, 'HEAD'), base, 'BASE_MUST_BE_ANCESTOR');
  assert.equal(git('diff', '--check', `${base}...HEAD`), '', 'DIFF_CHECK');
  const changed = git('diff', '--name-only', `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, [...FILES].sort(), 'EXACT_CHANGED_FILE_BOUNDARY');
  assert.equal(git('rev-list', '--count', `${base}..HEAD`), '1', 'SINGLE_COMMIT_CANDIDATE');

  const candidate = readJson(P.candidate);
  const boundary = readJson(P.boundary);
  const issuance = readJson(P.issuance);
  const objectSet = readJson(P.objectSet);
  const workflow = fs.readFileSync(path.join(ROOT, P.workflow), 'utf8');

  for (const value of [candidate, boundary, issuance, objectSet]) {
    assert.equal(value.semantic_digest, digest(value), `${value.schema_version}:SEMANTIC_DIGEST`);
  }

  assert.equal(git('rev-parse', `HEAD:${P.candidate}`), 'a3c7278a17f03569686badbd8c9b18811ecfeb12');
  assert.equal(git('rev-parse', `HEAD:${P.objectSet}`), 'aae0c94f3cfa9d2fb51f790655f56fcbdcc3bf84');
  assert.equal(candidate.record_status, 'FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORITY_CANDIDATE_NOT_EFFECTIVE');
  assert.equal(candidate.exact_subject_sha, BASE);
  assert.equal(candidate.authorized_run_label, 'RUN_A');
  assert.equal(candidate.operational_run_instance_id, 'MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-002');
  assert.equal(candidate.logical_database_identity.identity_id, 'MCFT-CAP-08-S6-FORMAL-DB-A-20260802-REPLACEMENT-002');
  assert.equal(candidate.replaces_consumed_authority.failed_workflow_run_id, 30738876293);
  assert.equal(candidate.replaces_consumed_authority.reusable, false);
  assert.equal(candidate.single_use_contract.max_dispatch_count, 1);
  assert.equal(candidate.single_use_contract.rerun_authorized, false);
  assert.equal(candidate.sequence_contract.run_b_remains_blocked, true);
  assert.equal(candidate.object_set_manifest_ref.blob_sha, 'aae0c94f3cfa9d2fb51f790655f56fcbdcc3bf84');
  assert.equal(candidate.object_set_manifest_ref.semantic_digest, objectSet.semantic_digest);
  assert.equal(candidate.activation_contract.separate_effectiveness_required, true);
  assert.equal(candidate.activation_contract.candidate_record_is_runtime_gate_eligible, false);
  assert.ok(Object.values(candidate.authorization_state).every((value) => value === false));
  assert.equal(candidate.port_bundle_blob_sha, '2f574588ba3010a94e64f965bb17fc97b3b33c72');
  assert.equal(candidate.workflow_blob_sha, '47b5f7748c917a099dc92219f1cbd4055bfb4862');

  assert.equal(boundary.base_main_sha, BASE);
  assert.equal(boundary.changed_file_count, 6);
  assert.deepEqual([...boundary.changed_files].sort(), [...FILES].sort());
  assert.equal(boundary.modified_file_count, 0);
  assert.equal(boundary.object_set_count, 50);
  assert.equal(boundary.full_harness_object_set_frozen, true);
  assert.equal(boundary.synthetic_data_preflight_required, true);
  assert.equal(boundary.database_execution_performed, false);
  assert.equal(boundary.workflow_dispatch_performed, false);
  assert.equal(boundary.candidate_runtime_gate_eligible, false);
  assert.equal(boundary.run_b_dispatch_authorized, false);

  assert.equal(issuance.base_main_sha, BASE);
  assert.equal(issuance.failed_dispatch_settlement.workflow_run_id, 30738876293);
  assert.equal(issuance.failed_dispatch_settlement.old_run_a_authority_consumed, true);
  assert.equal(issuance.new_run_a_authority_candidate.blob_sha, 'a3c7278a17f03569686badbd8c9b18811ecfeb12');
  assert.equal(issuance.new_run_a_authority_candidate.runtime_gate_eligible, false);
  assert.equal(issuance.corrected_object_set.blob_sha, 'aae0c94f3cfa9d2fb51f790655f56fcbdcc3bf84');
  assert.equal(issuance.corrected_object_set.object_count, 50);
  assert.equal(issuance.retired_authorities.run_b_dispatch_authorized, false);
  assert.equal(issuance.activation_contract.separate_effectiveness_required, true);
  assert.equal(issuance.next_legal_action_after_merge, 'ESTABLISH_HARNESS_CORRECTED_RUN_A_AUTHORITY_EFFECTIVENESS');

  const sets = [
    objectSet.exact_control_plane_object_set,
    objectSet.exact_product_object_set,
    objectSet.exact_port_bundle_object_set,
    objectSet.exact_harness_object_set,
    objectSet.protected_invariant_object_set
  ];
  assert.equal(sets.reduce((sum, set) => sum + Object.keys(set).length, 0), 50);
  for (const set of sets) assertObjectSet(set);
  assert.equal(objectSet.object_count, 50);
  assert.equal(objectSet.exact_subject_sha, BASE);
  assert.equal(objectSet.correction_provenance.failed_workflow_run_id, 30738876293);
  assert.equal(objectSet.correction_provenance.corrected_harness_blob_sha, '1833c793a10bba383f54200a35cb3f8912b60b94');

  assert.equal(git('rev-parse', `HEAD:${P.consumedRunA}`), '95b2f118cc0bc7b1c26bfff2c99410e312c587d9');
  assert.equal(git('rev-parse', `HEAD:${P.retiredRunB}`), '8cbb319aa24c919cddb5a82f62c3fcdcb41e050f');
  assert.equal(git('rev-parse', `HEAD:${P.failureSettlement}`), 'eedf5018db530db82af8a93d9759fae9aa32586a');

  const { validateExecutionAuthorityV1 } = require(path.join(ROOT, P.gate));
  assert.throws(
    () => validateExecutionAuthorityV1(candidate, {
      exactSubjectSha: candidate.exact_subject_sha,
      runLabel: candidate.authorized_run_label,
      operationalRunInstanceId: candidate.operational_run_instance_id
    }),
    /record_status|Expected values to be strictly equal/,
    'CANDIDATE_MUST_BE_REJECTED_BY_PRODUCTION_GATE'
  );

  const requiredExports = {
    './contract_loader_v1.cjs': ['loadSingleRunHarnessContractsV1'],
    './execution_spec_v1.cjs': ['buildSingleRunExecutionSpecV1'],
    './materializer_adapter_v1.cjs': ['invokeDirectMaterializerV1'],
    './receipt_manifest_v1.cjs': ['buildCanonicalReceiptManifestV1'],
    './closure_readback_adapter_v1.cjs': ['readExactReceiptObjectsV1'],
    './recovery_execution_adapter_v1.cjs': ['executeRecoveryVectorsV1'],
    './cap07_readback_execution_adapter_v1.cjs': ['executeCompleteCap07ReadbackV1'],
    './database_source_adapter_v1.cjs': ['buildFinalClosureDatabaseSourceV1'],
    './witness_execution_adapter_v1.cjs': ['producePerRunWitnessBundleV1'],
    './port_contract_v1.cjs': ['validateHarnessPortsV1']
  };
  const harnessDir = path.dirname(path.join(ROOT, P.harness));
  for (const [modulePath, names] of Object.entries(requiredExports)) {
    const moduleValue = require(path.join(harnessDir, modulePath));
    for (const name of names) assert.equal(typeof moduleValue[name], 'function', `HARNESS_EXPORT:${modulePath}:${name}`);
  }
  const harnessModule = require(path.join(ROOT, P.harness));
  assert.equal(typeof harnessModule.executeSingleRunDatabaseHarnessV1, 'function');

  await assert.rejects(
    () => harnessModule.executeSingleRunDatabaseHarnessV1({ input: {}, ports: {}, executionAuthority: candidate }),
    /HARNESS_PORT_REQUIRED:freshDatabase/
  );
  const calls = [];
  const stubPorts = {
    freshDatabase: { async assertFreshDisposable() { calls.push('freshDatabase'); } },
    materializer: { async executeDirectFormalRun() { calls.push('materializer'); } },
    closureReader: { async query() { calls.push('closureReader'); } },
    recovery: { async executeVector() { calls.push('recovery'); } },
    cap07Reader: { async request() { calls.push('cap07Reader'); } },
    artifactWriter: { async writeBundle() { calls.push('artifactWriter'); } }
  };
  await assert.rejects(
    () => harnessModule.executeSingleRunDatabaseHarnessV1({
      input: {
        runLabel: 'RUN_A',
        operationalRunInstanceId: candidate.operational_run_instance_id,
        exactSubjectSha: BASE
      },
      ports: stubPorts,
      executionAuthority: candidate
    }),
    /DATABASE_EXECUTION_AUTHORITY_REQUIRED/
  );
  assert.deepEqual(calls, [], 'CANDIDATE_MUST_BE_REJECTED_BEFORE_PORT_INVOCATION');

  const { runSyntheticDataAcceptanceV1 } = require(path.join(ROOT, P.syntheticData));
  const synthetic = await runSyntheticDataAcceptanceV1(BASE);
  assert.equal(synthetic.canonical_receipt_count, 153);
  assert.equal(synthetic.exact_ref_query_count, 1);
  assert.equal(synthetic.per_run_witness_count, 22);
  assert.equal(synthetic.proof_object_set_count, 22);
  assert.equal(synthetic.canonical_identity_binding, 'MATERIALIZER_BOUND_PRODUCT_A0_IDENTITY');

  assert.deepEqual(grepFiles(candidate.operational_run_instance_id).sort(), [P.candidate, P.issuance].sort());
  assert.deepEqual(grepFiles(candidate.logical_database_identity.identity_id).sort(), [P.candidate, P.issuance].sort());
  assert.doesNotMatch(workflow, /workflow_dispatch:|postgres|psql|DATABASE_URL/i);
  assert.equal(changed.some((rel) => rel.startsWith('apps/server/') || rel.startsWith('apps/web/') || /migration/i.test(rel)), false);

  const result = {
    schema_version: 'geox_mcft_cap08_s6_harness_corrected_run_a_authority_candidate_result_v1',
    status: 'PASS',
    base_main_sha: base,
    exact_head_sha: git('rev-parse', 'HEAD'),
    exact_subject_sha: candidate.exact_subject_sha,
    operational_run_instance_id: candidate.operational_run_instance_id,
    logical_database_identity: candidate.logical_database_identity.identity_id,
    object_count: 50,
    harness_object_count: Object.keys(objectSet.exact_harness_object_set).length,
    harness_module_linkage: 'PASS',
    synthetic_canonical_receipt_count: synthetic.canonical_receipt_count,
    synthetic_exact_ref_query_count: synthetic.exact_ref_query_count,
    synthetic_per_run_witness_count: synthetic.per_run_witness_count,
    candidate_runtime_gate_rejected: true,
    candidate_rejected_before_port_invocation: true,
    consumed_run_a_preserved: true,
    retired_run_b_preserved: true,
    database_execution_performed: false,
    workflow_dispatch_performed: false,
    run_b_dispatch_authorized: false,
    formal_run_result_present: false,
    s6_candidate_implemented: false,
    mcft_cap_08_complete: false,
    mcft_cap_09_authorized: false
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  write({
    schema_version: 'geox_mcft_cap08_s6_harness_corrected_run_a_authority_candidate_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error)
  });
  console.error(error);
  process.exitCode = 1;
});
