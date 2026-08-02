#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = 'a2dfc3ee1e5d132059379a0a67be2f033388e8b5';
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_RUN_A_PREHARNESS_ENTRYPOINT_CORRECTION_RESULT.json');
const FILES = [
  ".github/workflows/mcft-cap-08-s6-run-a-preharness-entrypoint-correction.yml",
  "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json",
  "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-RUN-A-ENTRYPOINT-CORRECTION-BOUNDARY-V1.json",
  "docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-RUN-A-PREHARNESS-FAILURE-SETTLEMENT-V1.json",
  "scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_PREHARNESS_ENTRYPOINT_CORRECTION_V1.cjs",
  "scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/workflow_entrypoint_v1.ts"
];
const P = {
  workflow: FILES[0],
  authority: FILES[1],
  boundary: FILES[2],
  settlement: FILES[3],
  validator: FILES[4],
  entrypoint: FILES[5],
  runB: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FORMAL-RUN-B-EXECUTION-AUTHORITY-EFFECTIVE-V1.json',
  gate: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs',
  portBundle: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/index_v1.cjs',
  harness: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/harness_v1.cjs',
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
  const source = fs.readFileSync(path.join(ROOT, P.entrypoint), 'utf8');
  const workflow = fs.readFileSync(path.join(ROOT, P.workflow), 'utf8');

  assert.equal(boundary.base_main_sha, BASE);
  assert.equal(boundary.changed_file_count, 6);
  assert.deepEqual([...boundary.changed_files].sort(), [...FILES].sort());
  assert.equal(boundary.entrypoint_source.previous_blob_sha, '43a6cdea691c906868a5c9a9d961378be585d121');
  assert.equal(boundary.entrypoint_source.corrected_source_sha256, sha256Text(source));
  assert.equal(boundary.semantic_digest, digest(boundary));
  assert.equal(boundary.database_execution_performed_in_candidate, false);
  assert.equal(boundary.workflow_dispatch_performed_in_candidate, false);
  assert.equal(boundary.replacement_authority_present, false);
  assert.equal(boundary.run_b_dispatch_authorized, false);

  assert.equal(settlement.failed_dispatch.github_workflow_run_id, 30736728638);
  assert.equal(settlement.failed_dispatch.github_run_attempt, 1);
  assert.equal(settlement.failed_dispatch.authority_artifact_id, 8829819756);
  assert.equal(settlement.failed_dispatch.authority_artifact_digest, 'sha256:503e6c050dd0dbefb117cb8882844a32bf3efde3d8169db36a5591727d12e091');
  assert.equal(settlement.failed_dispatch.failed_run_artifact_id, 8829827601);
  assert.equal(settlement.failed_dispatch.failed_run_artifact_digest, 'sha256:d04da801a0168ede375327ecf2dfbf34865e11e5902fc1d26e34934302117ae7');
  assert.equal(settlement.database_evidence.bootstrap_status, 'PASS');
  assert.equal(settlement.database_evidence.database_dropped, true);
  assert.equal(settlement.failure_classification.stage, 'PREHARNESS_ENTRYPOINT_TRANSFORM');
  assert.equal(settlement.failure_classification.code, 'TOP_LEVEL_AWAIT_CJS_TRANSFORM_UNSUPPORTED');
  assert.equal(settlement.failure_classification.formal_harness_entered, false);
  assert.equal(settlement.failure_classification.product_semantics_evaluated, false);
  assert.equal(settlement.failure_classification.formal_result_emitted, false);
  assert.equal(settlement.authority_disposition.authority_consumed, true);
  assert.equal(settlement.authority_disposition.rerun_authorized, false);
  assert.equal(settlement.authority_disposition.replacement_authority_present_in_this_candidate, false);
  assert.equal(settlement.run_b_state.authority_blob_sha, '5fd46c4bbe1fbd816412bde47de3230c2764bff6');
  assert.equal(settlement.run_b_state.dispatch_authorized_now, false);
  assert.equal(settlement.semantic_digest, digest(settlement));

  assert.equal(authority.record_status, 'SINGLE_FINAL_FORMAL_RUN_AUTHORITY_CONSUMED_PREHARNESS_FAILURE');
  assert.equal(authority.authority_consumed, true);
  assert.equal(authority.workflow_dispatch_performed, true);
  assert.equal(authority.database_execution_performed, true);
  assert.equal(authority.formal_run_executed, false);
  assert.equal(authority.formal_run_result_status, 'ABSENT_PREHARNESS_FAILURE');
  assert.equal(authority.single_use_contract.rerun_authorized, false);
  assert.equal(authority.single_use_contract.authority_reuse_authorized, false);
  assert.equal(authority.single_run_database_execution_authorized, false);
  assert.equal(authority.database_execution_workflow_authorized, false);
  assert.equal(authority.workflow_dispatch_execution_authorized, false);
  assert.equal(authority.final_formal_run_execution_authorized, false);
  assert.equal(authority.replacement_authority_issued, false);
  assert.equal(authority.consumption_evidence.github_workflow_run_id, 30736728638);
  assert.equal(authority.consumption_evidence.failed_run_artifact_digest, 'sha256:d04da801a0168ede375327ecf2dfbf34865e11e5902fc1d26e34934302117ae7');
  assert.equal(authority.semantic_digest, digest(authority));

  const { validateExecutionAuthorityV1 } = require(path.join(ROOT, P.gate));
  assert.throws(
    () => validateExecutionAuthorityV1(authority, {
      exactSubjectSha: authority.exact_subject_sha,
      runLabel: authority.authorized_run_label,
      operationalRunInstanceId: authority.operational_run_instance_id
    }),
    /record_status|Expected values to be strictly equal/,
    'RETIRED_AUTHORITY_MUST_BE_REJECTED'
  );

  assert.equal(runB.sequence_contract.dispatch_precondition, 'RUN_A_TERMINAL_SUCCESS');
  assert.equal(git('rev-parse', `HEAD:${P.runB}`), '5fd46c4bbe1fbd816412bde47de3230c2764bff6', 'RUN_B_AUTHORITY_MUST_REMAIN_UNCHANGED');
  assert.equal(git('rev-parse', `HEAD:${P.portBundle}`), '2f574588ba3010a94e64f965bb17fc97b3b33c72', 'PORT_BUNDLE_MUST_REMAIN_UNCHANGED');
  assert.equal(git('rev-parse', `HEAD:${P.harness}`), git('rev-parse', `${BASE}:${P.harness}`), 'HARNESS_MUST_REMAIN_UNCHANGED');
  assert.equal(git('rev-parse', `HEAD:${P.workflowRuntime}`), '47b5f7748c917a099dc92219f1cbd4055bfb4862', 'DATABASE_WORKFLOW_MUST_REMAIN_UNCHANGED');
  assert.notEqual(git('rev-parse', `HEAD:${P.entrypoint}`), '43a6cdea691c906868a5c9a9d961378be585d121', 'ENTRYPOINT_BLOB_MUST_CHANGE');

  const beforeMain = source.slice(0, source.indexOf('async function main'));
  assert.equal(/\bawait\b/.test(beforeMain), false, 'NO_TOP_LEVEL_AWAIT_BEFORE_MAIN');
  assert.doesNotMatch(source, /import\.meta|fileURLToPath|pathToFileURL/);
  assert.match(source, /async function main\(\): Promise<void>/);
  assert.match(source, /const require = createRequire\(__filename\)/);
  assert.match(source, /const imported = require\(path\.join\(ROOT, validated\.module_path\)\)/);
  assert.match(source, /main\(\)\.catch/);

  const preflight = spawnSync('pnpm', ['-w', 'exec', 'tsx', P.entrypoint], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      MCFT_CAP08_EXACT_SUBJECT_SHA: '',
      MCFT_CAP08_RUN_LABEL: '',
      MCFT_CAP08_OPERATIONAL_RUN_INSTANCE_ID: '',
      MCFT_CAP08_NORMALIZED_EXECUTION_AUTHORITY: ''
    }
  });
  const combined = `${preflight.stdout || ''}\n${preflight.stderr || ''}`;
  assert.notEqual(preflight.status, 0, 'NEGATIVE_PREFLIGHT_MUST_FAIL_WITHOUT_AUTHORITY');
  assert.match(combined, /NORMALIZED_EXECUTION_AUTHORITY_REQUIRED/);
  assert.doesNotMatch(combined, /Top-level await|Transform failed|import\.meta/);

  assert.doesNotMatch(workflow, /workflow_dispatch:|postgres|psql|DATABASE_URL/i);
  assert.equal(changed.some((rel) => rel.startsWith('apps/server/') || rel.startsWith('apps/web/') || /migration/i.test(rel)), false);
  assert.equal(changed.some((rel) => /REPLACEMENT.*AUTHORITY/i.test(rel)), false);

  const result = {
    schema_version: 'geox_mcft_cap08_s6_run_a_preharness_entrypoint_correction_result_v1',
    status: 'PASS',
    base_main_sha: base,
    exact_head_sha: git('rev-parse', 'HEAD'),
    failed_workflow_run_id: 30736728638,
    authority_consumed: true,
    retired_authority_gate_rejected: true,
    database_bootstrap_status: 'PASS',
    formal_harness_entered: false,
    formal_result_emitted: false,
    entrypoint_transform_preflight: 'PASS',
    top_level_await_present: false,
    import_meta_dependency_present: false,
    port_bundle_changed: false,
    harness_changed: false,
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
    schema_version: 'geox_mcft_cap08_s6_run_a_preharness_entrypoint_correction_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error)
  });
  throw error;
}
