#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '1bda1926c0ee89ee8e5367413412db97577202f0';
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_RUN_A_HARNESS_PORT_VALIDATOR_SYMBOL_CORRECTION_RESULT.json');
const FILES = [
  ".github/workflows/mcft-cap-08-s6-run-a-harness-port-validator-symbol-correction.yml",
  "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PREHARNESS-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json",
  "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-RUN-A-HARNESS-PORT-VALIDATOR-SYMBOL-CORRECTION-BOUNDARY-V1.json",
  "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-RUN-A-HARNESS-PORT-VALIDATOR-FAILURE-SETTLEMENT-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_HARNESS_PORT_VALIDATOR_SYMBOL_CORRECTION_V1.cjs",
  "scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/harness_v1.cjs"
];
const P = {
  workflow: FILES[0],
  authority: FILES[1],
  boundary: FILES[2],
  settlement: FILES[3],
  validator: FILES[4],
  harness: FILES[5],
  gate: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs',
  portContract: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/port_contract_v1.cjs',
  portBundle: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/index_v1.cjs',
  entrypoint: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/workflow_entrypoint_v1.ts',
  runB: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-RUN-B-EXECUTION-AUTHORITY-EFFECTIVE-V1.json',
  workflowRuntime: '.github/workflows/mcft-cap-08-s6-single-run-database-execution.yml'
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
function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}
function write(result) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
}

try {
  const base = String(process.env.MCFT_BASE_SHA || BASE).trim();
  assert.equal(base, BASE, 'EXACT_BASE_MAIN_SHA');
  assert.equal(git('merge-base', base, 'HEAD'), base, 'BASE_MUST_BE_ANCESTOR');
  assert.equal(git('diff', '--check', `${base}...HEAD`), '', 'DIFF_CHECK');

  const changed = git('diff', '--name-only', `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
  assert.deepEqual(changed, [...FILES].sort(), 'EXACT_CHANGED_FILE_BOUNDARY');

  const boundary = readJson(P.boundary);
  const settlement = readJson(P.settlement);
  const authority = readJson(P.authority);
  const runB = readJson(P.runB);
  const harness = fs.readFileSync(path.join(ROOT, P.harness), 'utf8');
  const workflow = fs.readFileSync(path.join(ROOT, P.workflow), 'utf8');

  assert.equal(boundary.base_main_sha, BASE);
  assert.equal(boundary.changed_file_count, 6);
  assert.deepEqual([...boundary.changed_files].sort(), [...FILES].sort());
  assert.equal(boundary.harness_source.previous_blob_sha, '0009facd64cc81c946351c901ba26a257548f29a');
  assert.equal(boundary.harness_source.corrected_source_sha256, sha256Text(harness));
  assert.equal(boundary.protected_objects.port_contract_blob_sha, '1f7b4a8aaac0a2db2e9ec6826672dd1a3a341681');
  assert.equal(boundary.protected_objects.port_bundle_blob_sha, '2f574588ba3010a94e64f965bb17fc97b3b33c72');
  assert.equal(boundary.semantic_digest, digest(boundary));
  assert.equal(boundary.database_execution_performed_in_candidate, false);
  assert.equal(boundary.workflow_dispatch_performed_in_candidate, false);
  assert.equal(boundary.replacement_authority_present, false);
  assert.equal(boundary.run_b_dispatch_authorized, false);

  assert.equal(settlement.failed_dispatch.github_workflow_run_id, 30738876293);
  assert.equal(settlement.failed_dispatch.github_run_attempt, 1);
  assert.equal(settlement.failed_dispatch.authority_artifact_id, 8830579159);
  assert.equal(settlement.failed_dispatch.authority_artifact_digest, 'sha256:f960d6375e1f21b45b9975b246680e6ee039ed8ca37a76f75250f8ba9aeb0072');
  assert.equal(settlement.failed_dispatch.failed_run_artifact_id, 8830586081);
  assert.equal(settlement.failed_dispatch.failed_run_artifact_digest, 'sha256:7b914c98ab0f8c55277ac6858e1abee3962971ccc4194e4c02edd13f550667c2');
  assert.equal(settlement.database_evidence.bootstrap_status, 'PASS');
  assert.equal(settlement.database_evidence.legacy_migration_applied_count, 71);
  assert.equal(settlement.database_evidence.relation_count, 30);
  assert.equal(settlement.database_evidence.database_dropped, true);
  assert.equal(settlement.failure_classification.stage, 'HARNESS_PORT_VALIDATION_BINDING');
  assert.equal(settlement.failure_classification.code, 'HARNESS_PORT_VALIDATOR_EXPORT_NAME_MISMATCH');
  assert.equal(settlement.failure_classification.formal_harness_entered, true);
  assert.equal(settlement.failure_classification.materializer_entered, false);
  assert.equal(settlement.failure_classification.product_semantics_evaluated, false);
  assert.equal(settlement.failure_classification.formal_result_emitted, false);
  assert.equal(settlement.source_evidence.failed_harness_blob_sha, '0009facd64cc81c946351c901ba26a257548f29a');
  assert.equal(settlement.source_evidence.port_contract_blob_sha, '1f7b4a8aaac0a2db2e9ec6826672dd1a3a341681');
  assert.equal(settlement.authority_disposition.authority_consumed, true);
  assert.equal(settlement.authority_disposition.rerun_authorized, false);
  assert.equal(settlement.authority_disposition.replacement_authority_present_in_this_candidate, false);
  assert.equal(settlement.run_b_state.authority_blob_sha, '8cbb319aa24c919cddb5a82f62c3fcdcb41e050f');
  assert.equal(settlement.run_b_state.dispatch_authorized_now, false);
  assert.equal(settlement.semantic_digest, digest(settlement));

  assert.equal(authority.record_status, 'SINGLE_FINAL_FORMAL_RUN_AUTHORITY_CONSUMED_HARNESS_PORT_VALIDATOR_FAILURE');
  assert.equal(authority.authority_consumed, true);
  assert.equal(authority.workflow_dispatch_performed, true);
  assert.equal(authority.database_execution_performed, true);
  assert.equal(authority.formal_harness_entered, true);
  assert.equal(authority.materializer_entered, false);
  assert.equal(authority.formal_run_executed, false);
  assert.equal(authority.formal_run_result_status, 'ABSENT_HARNESS_PORT_VALIDATION_FAILURE');
  assert.equal(authority.single_use_contract.dispatch_count_consumed, 1);
  assert.equal(authority.single_use_contract.rerun_authorized, false);
  assert.equal(authority.single_use_contract.authority_reuse_authorized, false);
  assert.equal(authority.single_run_database_execution_authorized, false);
  assert.equal(authority.database_execution_workflow_authorized, false);
  assert.equal(authority.workflow_dispatch_execution_authorized, false);
  assert.equal(authority.final_formal_run_execution_authorized, false);
  assert.equal(authority.replacement_authority_issued, false);
  assert.equal(authority.consumption_evidence.github_workflow_run_id, 30738876293);
  assert.equal(authority.consumption_evidence.failed_run_artifact_digest, 'sha256:7b914c98ab0f8c55277ac6858e1abee3962971ccc4194e4c02edd13f550667c2');
  assert.equal(authority.semantic_digest, digest(authority));

  const { validateExecutionAuthorityV1 } = require(path.join(ROOT, P.gate));
  assert.throws(
    () => validateExecutionAuthorityV1(authority, {
      exactSubjectSha: authority.exact_subject_sha,
      runLabel: authority.authorized_run_label,
      operationalRunInstanceId: authority.operational_run_instance_id
    }),
    /record_status|Expected values to be strictly equal/,
    'CONSUMED_AUTHORITY_MUST_BE_REJECTED'
  );

  assert.equal(git('rev-parse', `HEAD:${P.portContract}`), '1f7b4a8aaac0a2db2e9ec6826672dd1a3a341681', 'PORT_CONTRACT_MUST_REMAIN_UNCHANGED');
  assert.equal(git('rev-parse', `HEAD:${P.portBundle}`), '2f574588ba3010a94e64f965bb17fc97b3b33c72', 'PORT_BUNDLE_MUST_REMAIN_UNCHANGED');
  assert.equal(git('rev-parse', `HEAD:${P.entrypoint}`), '4b68df5cb74b445301e4554ef3fe160ed9c14500', 'ENTRYPOINT_MUST_REMAIN_UNCHANGED');
  assert.equal(git('rev-parse', `HEAD:${P.workflowRuntime}`), '47b5f7748c917a099dc92219f1cbd4055bfb4862', 'DATABASE_WORKFLOW_MUST_REMAIN_UNCHANGED');
  assert.equal(git('rev-parse', `HEAD:${P.runB}`), '8cbb319aa24c919cddb5a82f62c3fcdcb41e050f', 'RETIRED_RUN_B_AUTHORITY_MUST_REMAIN_UNCHANGED');
  assert.notEqual(git('rev-parse', `HEAD:${P.harness}`), '0009facd64cc81c946351c901ba26a257548f29a', 'HARNESS_BLOB_MUST_CHANGE');

  assert.match(harness, /const \{validateHarnessPortsV1\}=require\('\.\/port_contract_v1\.cjs'\);/);
  assert.match(harness, /validateHarnessPortsV1\(ports\)/);
  assert.doesNotMatch(harness, /validatePortBundleV1/);

  const probe = [
    "const {executeSingleRunDatabaseHarnessV1}=require('./scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/harness_v1.cjs');",
    "executeSingleRunDatabaseHarnessV1({input:{},ports:{},executionAuthority:{}})",
    ".then(()=>{console.error('UNEXPECTED_SUCCESS');process.exit(2);})",
    ".catch((error)=>{const message=String(error&&error.message||error);console.error(message);process.exit(message.includes('HARNESS_PORT_REQUIRED:freshDatabase')?0:3);});"
  ].join('');
  const preflight = spawnSync(process.execPath, ['-e', probe], { cwd: ROOT, encoding: 'utf8' });
  const combined = `${preflight.stdout || ''}\n${preflight.stderr || ''}`;
  assert.equal(preflight.status, 0, 'HARNESS_PORT_VALIDATOR_PREFLIGHT');
  assert.match(combined, /HARNESS_PORT_REQUIRED:freshDatabase/);
  assert.doesNotMatch(combined, /validatePortBundleV1 is not a function/);

  assert.equal(runB.record_status, 'SINGLE_FINAL_FORMAL_RUN_AUTHORITY_RETIRED_OBSOLETE_SUBJECT');
  assert.doesNotMatch(workflow, /workflow_dispatch:|postgres|psql|DATABASE_URL/i);
  assert.equal(changed.some((rel) => rel.startsWith('apps/server/') || rel.startsWith('apps/web/') || /migration/i.test(rel)), false);
  assert.equal(changed.some((rel) => /AUTHORITY-CANDIDATE|AUTHORITY-EFFECTIVENESS/i.test(rel)), false);

  const result = {
    schema_version: 'geox_mcft_cap08_s6_run_a_harness_port_validator_symbol_correction_result_v1',
    status: 'PASS',
    base_main_sha: base,
    exact_head_sha: git('rev-parse', 'HEAD'),
    failed_workflow_run_id: 30738876293,
    authority_consumed: true,
    consumed_authority_gate_rejected: true,
    database_bootstrap_status: 'PASS',
    formal_harness_entered: true,
    materializer_entered: false,
    formal_result_emitted: false,
    harness_symbol_preflight: 'PASS',
    imported_validator_symbol: 'validateHarnessPortsV1',
    port_contract_changed: false,
    port_bundle_changed: false,
    entrypoint_changed: false,
    database_workflow_changed: false,
    replacement_authority_present: false,
    run_b_dispatch_authorized: false,
    database_execution_performed_in_candidate: false,
    workflow_dispatch_performed_in_candidate: false,
    s6_candidate_implemented: false,
    mcft_cap_08_complete: false,
    mcft_cap_09_authorized: false
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap08_s6_run_a_harness_port_validator_symbol_correction_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error)
  });
  throw error;
}
