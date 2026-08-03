#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '2e4db4006812965798df9b0d27beaa52bcf37b91';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_CLOSURE_FVO10_CORRECTED_RUN_A_AUTHORITY_CANDIDATE_RESULT.json');
const CANDIDATE = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CLOSURE-FVO10-CORRECTED-FORMAL-RUN-A-AUTHORITY-CANDIDATE-V1.json';
const OBJECTS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CLOSURE-FVO10-CORRECTED-RUN-A-AUTHORITY-OBJECT-SET-V1.json';
const BOUNDARY = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CLOSURE-FVO10-CORRECTED-RUN-A-AUTHORITY-BOUNDARY-V1.json';
const ISSUANCE = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CLOSURE-FVO10-CORRECTED-RUN-A-AUTHORITY-ISSUANCE-V1.json';
const WORKFLOW = '.github/workflows/mcft-cap-08-s6-closure-fvo10-corrected-run-a-authority-candidate.yml';
const VALIDATOR = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_CLOSURE_FVO10_CORRECTED_RUN_A_AUTHORITY_CANDIDATE_V1.cjs';
const CONSUMED = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-PHASE-ORDER-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json';
const CHANGED = [WORKFLOW, CANDIDATE, BOUNDARY, ISSUANCE, OBJECTS, VALIDATOR].sort();
const OP = 'MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-009';
const DBID = 'MCFT-CAP-08-S6-FORMAL-DB-A-20260802-REPLACEMENT-009';
const DBNAME = 'geox_mcft_cap08_s6_run_a_replacement_009_30790000009';
const FINAL_SOURCE = 'mcft_cap08_s6_final_formal_evidence_v1';
const COMPLETION_SOURCE = 'mcft_cap08_s3_completion_evidence_v1';

function git(...args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function text(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function json(file) { return JSON.parse(text(file)); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function semantic(value) {
  const clone = structuredClone(value);
  delete clone.semantic_digest;
  return `sha256:${crypto.createHash('sha256').update(canonical(clone)).digest('hex')}`;
}
function save(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);
}
function effective(candidate) {
  const authority = structuredClone(candidate);
  authority.record_status = 'SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED';
  authority.evidence_class = 'FINAL_FORMAL_EVIDENCE_ELIGIBLE_AFTER_TERMINAL_SUCCESS';
  authority.expires_at = '2099-08-06T02:35:00.000Z';
  for (const key of ['authority_effective', 'single_run_database_execution_authorized', 'database_execution_workflow_authorized', 'workflow_dispatch_execution_authorized', 'final_formal_run_execution_authorized', 'hard_acceptance_eligible', 's6_candidate_evidence_eligible']) authority.authorization_state[key] = true;
  Object.assign(authority, {
    single_run_database_execution_authorized: true,
    database_execution_workflow_authorized: true,
    workflow_dispatch_execution_authorized: true,
    final_formal_run_execution_authorized: true,
    dual_run_ci_authorized: false,
    cross_run_comparator_authorized: false,
    final_ledger_settlement_authorized: false,
  });
  return authority;
}

try {
  const base = String(process.env.MCFT_BASE_SHA || BASE).trim();
  assert.equal(base, BASE);
  assert.equal(git('merge-base', base, 'HEAD'), base);
  assert.equal(git('rev-list', '--count', `${base}..HEAD`), '1');
  assert.equal(git('diff', '--check', `${base}...HEAD`), '');
  assert.deepEqual(git('diff', '--name-only', `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort(), CHANGED);

  const candidate = json(CANDIDATE);
  const objects = json(OBJECTS);
  const boundary = json(BOUNDARY);
  const issuance = json(ISSUANCE);
  const consumed = json(CONSUMED);
  for (const value of [candidate, objects, boundary, issuance]) assert.equal(value.semantic_digest, semantic(value));

  assert.equal(git('rev-parse', `HEAD:${CANDIDATE}`), 'a5ead14e052657aaf5cd6f19f1250ce07b27d828');
  assert.equal(git('rev-parse', `HEAD:${OBJECTS}`), '4aa37e53b395ffc9e757f591c801a98eb9a64981');
  assert.equal(git('rev-parse', `HEAD:${CONSUMED}`), 'b1573d7e944436b4a8b045b94d8e06a4419aa1db');

  assert.equal(consumed.authority_consumed, true);
  assert.equal(consumed.operational_run_instance_id, 'MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-008');
  assert.equal(consumed.formal_run_result_status, 'ABSENT_CLOSURE_FVO10_ALIAS_FAILURE');
  assert.equal(consumed.consumption_evidence.github_workflow_run_id, 30778431135);
  assert.equal(consumed.single_use_contract.rerun_authorized, false);

  assert.equal(candidate.record_status, 'FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORITY_CANDIDATE_NOT_EFFECTIVE');
  assert.equal(candidate.exact_subject_sha, BASE);
  assert.equal(candidate.operational_run_instance_id, OP);
  assert.equal(candidate.logical_database_identity.identity_id, DBID);
  assert.equal(candidate.logical_database_identity.physical_name_template, 'geox_mcft_cap08_s6_run_a_replacement_009_<github_run_id>');
  assert.ok(Object.values(candidate.authorization_state).every(value => value === false));
  assert.equal(candidate.sequence_contract.run_b_remains_blocked, true);
  assert.equal(candidate.replaces_consumed_authority.failed_workflow_run_id, 30778431135);

  assert.equal(objects.object_count, 54);
  assert.equal(objects.exact_subject_sha, BASE);
  assert.equal(objects.exact_port_bundle_object_set['scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/closure_reader_v1.cjs'], 'cdee98e8b7bbd4a1d5ba45361978d5803873b610');
  const sets = [objects.exact_control_plane_object_set, objects.exact_database_bootstrap_object_set, objects.exact_product_object_set, objects.exact_port_bundle_object_set, objects.exact_harness_object_set, objects.protected_invariant_object_set];
  assert.equal(sets.reduce((count, set) => count + Object.keys(set).length, 0), 54);
  for (const set of sets) for (const [file, sha] of Object.entries(set)) assert.equal(git('rev-parse', `HEAD:${file}`), sha, `OBJECT_BLOB:${file}`);

  const closure = require(path.join(ROOT, 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/closure_reader_v1.cjs'));
  const canonicalObject = {
    object_id: 'FVO-10',
    object_type: 'soil_moisture_observation_v1',
    determinism_hash: `sha256:${'a'.repeat(64)}`,
    logical_time: '2026-06-01T10:00:00.000Z',
    as_of: '2026-06-01T10:00:00.000Z',
  };
  const annotated = { ...canonicalObject, closure_evidence_class: 'FORECAST_VERIFICATION_OBSERVATION' };
  const existing = { object: annotated, source: FINAL_SOURCE, sources: new Set([FINAL_SOURCE]) };
  assert.equal(closure.canCoalesceFvo10CanonicalAliasV1(existing, { source: COMPLETION_SOURCE }, canonicalObject), true);
  assert.equal(closure.canCoalesceFvo10CanonicalAliasV1(existing, { source: COMPLETION_SOURCE }, { ...canonicalObject, determinism_hash: `sha256:${'b'.repeat(64)}` }), false);
  assert.equal(closure.canCoalesceFvo10CanonicalAliasV1(existing, { source: FINAL_SOURCE }, canonicalObject), false);
  assert.equal(closure.canCoalesceFvo10CanonicalAliasV1(existing, { source: COMPLETION_SOURCE }, { ...canonicalObject, object_id: 'FVO-09' }), false);

  assert.equal(boundary.base_main_sha, BASE);
  assert.equal(boundary.changed_file_count, 6);
  assert.deepEqual([...boundary.changed_files].sort(), CHANGED);
  assert.equal(boundary.object_set_count, 54);
  assert.equal(boundary.closure_fvo10_canonical_alias_object_frozen, true);
  assert.equal(issuance.activation.database_execution_authorized, false);
  assert.equal(issuance.identity.operational_run_instance_id, OP);

  const gate = require(path.join(ROOT, 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs'));
  assert.throws(() => gate.validateExecutionAuthorityV1(candidate, { exactSubjectSha: BASE, runLabel: 'RUN_A', operationalRunInstanceId: OP }));
  gate.validateExecutionAuthorityV1(effective(candidate), { exactSubjectSha: BASE, runLabel: 'RUN_A', operationalRunInstanceId: OP });

  const identity = require(path.join(ROOT, 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/database_identity_v1.cjs'));
  assert.equal(identity.materializePhysicalDatabaseNameV1(effective(candidate), '30790000009'), DBNAME);

  const workflow = text(WORKFLOW);
  assert.doesNotMatch(workflow, /workflow_dispatch:|postgres:|psql|DATABASE_URL/i);
  assert.match(workflow, /54-object set/);

  const result = {
    schema_version: 'geox_mcft_cap08_s6_closure_fvo10_corrected_run_a_authority_candidate_result_v1',
    status: 'PASS',
    base_main_sha: BASE,
    exact_head_sha: git('rev-parse', 'HEAD'),
    object_count: 54,
    operational_run_instance_id: OP,
    logical_database_identity: DBID,
    candidate_runtime_gate_eligible: false,
    closure_reader_blob_sha: 'cdee98e8b7bbd4a1d5ba45361978d5803873b610',
    fvo10_canonical_alias_preflight: 'PASS',
    conflicting_alias_preflight: 'PASS_REJECTED',
    authority_bound_database_identity_preflight: 'PASS',
    database_execution_performed: false,
    workflow_dispatch_performed: false,
    run_b_dispatch_authorized: false,
  };
  save(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  save({ schema_version: 'geox_mcft_cap08_s6_closure_fvo10_corrected_run_a_authority_candidate_result_v1', status: 'FAIL', error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exitCode = 1;
}
