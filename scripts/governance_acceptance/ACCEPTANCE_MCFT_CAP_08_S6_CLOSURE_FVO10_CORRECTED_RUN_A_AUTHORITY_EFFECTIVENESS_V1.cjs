#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = 'c022bfea62d4bb831cacb00e2463b68f7d50a245';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_CLOSURE_FVO10_CORRECTED_RUN_A_AUTHORITY_EFFECTIVENESS_RESULT.json');
const CANDIDATE = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CLOSURE-FVO10-CORRECTED-FORMAL-RUN-A-AUTHORITY-CANDIDATE-V1.json';
const EFFECTIVE = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CLOSURE-FVO10-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json';
const OBJECTS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CLOSURE-FVO10-CORRECTED-RUN-A-AUTHORITY-OBJECT-SET-V1.json';
const SETTLEMENT = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CLOSURE-FVO10-CORRECTED-RUN-A-AUTHORITY-EFFECTIVENESS-V1.json';
const BOUNDARY = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CLOSURE-FVO10-CORRECTED-RUN-A-AUTHORITY-EFFECTIVENESS-BOUNDARY-V1.json';
const WORKFLOW = '.github/workflows/mcft-cap-08-s6-closure-fvo10-corrected-run-a-authority-effectiveness.yml';
const VALIDATOR = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_CLOSURE_FVO10_CORRECTED_RUN_A_AUTHORITY_EFFECTIVENESS_V1.cjs';
const CHANGED = [WORKFLOW, EFFECTIVE, SETTLEMENT, BOUNDARY, VALIDATOR].sort();
const SUBJECT = '2e4db4006812965798df9b0d27beaa52bcf37b91';
const OP = 'MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-009';
const DBID = 'MCFT-CAP-08-S6-FORMAL-DB-A-20260802-REPLACEMENT-009';
const FINAL_SOURCE = 'mcft_cap08_s6_final_formal_evidence_v1';
const COMPLETION_SOURCE = 'mcft_cap08_s3_completion_evidence_v1';

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}
function text(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}
function json(file) {
  return JSON.parse(text(file));
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(
      key => `${JSON.stringify(key)}:${canonical(value[key])}`,
    ).join(',')}}`;
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

try {
  const base = String(process.env.MCFT_BASE_SHA || BASE).trim();
  assert.equal(base, BASE);
  assert.equal(git('merge-base', base, 'HEAD'), base);
  assert.equal(git('rev-list', '--count', `${base}..HEAD`), '1');
  assert.equal(git('diff', '--check', `${base}...HEAD`), '');
  assert.deepEqual(
    git('diff', '--name-only', `${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort(),
    CHANGED,
  );

  const candidate = json(CANDIDATE);
  const effective = json(EFFECTIVE);
  const objects = json(OBJECTS);
  const settlement = json(SETTLEMENT);
  const boundary = json(BOUNDARY);
  for (const value of [candidate, effective, objects, settlement, boundary]) {
    assert.equal(value.semantic_digest, semantic(value));
  }

  assert.equal(git('rev-parse', `HEAD:${CANDIDATE}`), 'a5ead14e052657aaf5cd6f19f1250ce07b27d828');
  assert.equal(git('rev-parse', `HEAD:${OBJECTS}`), '4aa37e53b395ffc9e757f591c801a98eb9a64981');
  assert.equal(git('rev-parse', `HEAD:${EFFECTIVE}`), '2c874123256dc2fcf26cdaed2c1d5322b06df5a0');

  assert.equal(candidate.record_status, 'FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORITY_CANDIDATE_NOT_EFFECTIVE');
  assert.equal(candidate.exact_subject_sha, SUBJECT);
  assert.equal(candidate.operational_run_instance_id, OP);

  assert.equal(effective.record_status, 'SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED');
  assert.equal(effective.exact_subject_sha, SUBJECT);
  assert.equal(effective.operational_run_instance_id, OP);
  assert.equal(effective.logical_database_identity.identity_id, DBID);
  assert.equal(effective.candidate_head_sha, '3167a46b84413f68af73cc33cd3a1ac5d706fb99');
  assert.equal(effective.candidate_merge_sha, BASE);
  assert.equal(effective.candidate_authority_ref.blob_sha, 'a5ead14e052657aaf5cd6f19f1250ce07b27d828');
  assert.equal(effective.candidate_authority_ref.preserved_semantic_digest, candidate.semantic_digest);
  assert.equal(effective.object_set_manifest_ref.blob_sha, '4aa37e53b395ffc9e757f591c801a98eb9a64981');
  assert.equal(effective.single_use_contract.max_dispatch_count, 1);
  assert.equal(effective.single_use_contract.rerun_authorized, false);
  assert.equal(effective.sequence_contract.run_b_remains_blocked, true);
  assert.equal(effective.correction_provenance.canonical_receipt_count, 153);
  assert.equal(effective.correction_provenance.operational_event_count, 224);
  assert.deepEqual(effective.correction_provenance.fvo10_exact_alias_sources, [FINAL_SOURCE, COMPLETION_SOURCE]);

  assert.equal(objects.object_count, 54);
  const sets = [
    objects.exact_control_plane_object_set,
    objects.exact_database_bootstrap_object_set,
    objects.exact_product_object_set,
    objects.exact_port_bundle_object_set,
    objects.exact_harness_object_set,
    objects.protected_invariant_object_set,
  ];
  assert.equal(sets.reduce((count, set) => count + Object.keys(set).length, 0), 54);
  for (const set of sets) {
    for (const [file, sha] of Object.entries(set)) {
      assert.equal(git('rev-parse', `HEAD:${file}`), sha, `OBJECT_BLOB:${file}`);
    }
  }

  const closure = require(path.join(
    ROOT,
    'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/closure_reader_v1.cjs',
  ));
  const canonicalObject = {
    object_id: 'FVO-10',
    object_type: 'soil_moisture_observation_v1',
    determinism_hash: `sha256:${'a'.repeat(64)}`,
    logical_time: '2026-06-01T10:00:00.000Z',
    as_of: '2026-06-01T10:00:00.000Z',
  };
  const existing = {
    object: { ...canonicalObject, closure_evidence_class: 'FORECAST_VERIFICATION_OBSERVATION' },
    source: FINAL_SOURCE,
    sources: new Set([FINAL_SOURCE]),
  };
  assert.equal(
    closure.canCoalesceFvo10CanonicalAliasV1(existing, { source: COMPLETION_SOURCE }, canonicalObject),
    true,
  );
  assert.equal(
    closure.canCoalesceFvo10CanonicalAliasV1(
      existing,
      { source: COMPLETION_SOURCE },
      { ...canonicalObject, determinism_hash: `sha256:${'b'.repeat(64)}` },
    ),
    false,
  );

  process.env.MCFT_LOCAL_REPLAY = '1';
  const {
    loadSingleRunHarnessContractsV1,
  } = require(path.join(
    ROOT,
    'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/contract_loader_v1.cjs',
  ));
  const {
    buildSingleRunExecutionSpecV1,
  } = require(path.join(
    ROOT,
    'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/execution_spec_v1.cjs',
  ));
  const {
    buildOperationalEventsV1,
  } = require(path.join(
    ROOT,
    'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/materialization_output_v1.cjs',
  ));
  const spec = buildSingleRunExecutionSpecV1({
    contracts: loadSingleRunHarnessContractsV1({ localReplay: true }),
    runLabel: 'RUN_A',
    operationalRunInstanceId: OP,
    exactSubjectSha: SUBJECT,
  });
  assert.equal(spec.phase_count, 28);
  assert.equal(buildOperationalEventsV1({ spec }).length, 224);

  const gate = require(path.join(
    ROOT,
    'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/execution_authority_gate_v1.cjs',
  ));
  assert.throws(() => gate.validateExecutionAuthorityV1(candidate, {
    exactSubjectSha: SUBJECT,
    runLabel: 'RUN_A',
    operationalRunInstanceId: OP,
  }));
  gate.validateExecutionAuthorityV1(effective, {
    exactSubjectSha: SUBJECT,
    runLabel: 'RUN_A',
    operationalRunInstanceId: OP,
  });

  const identity = require(path.join(
    ROOT,
    'scripts/runtime_acceptance/mcft_cap08_s6_single_run_workflow/database_identity_v1.cjs',
  ));
  assert.equal(
    identity.materializePhysicalDatabaseNameV1(effective, '30790000009'),
    'geox_mcft_cap08_s6_run_a_replacement_009_30790000009',
  );

  assert.equal(
    settlement.next_legal_action_after_merge,
    'DISPATCH_CLOSURE_FVO10_CORRECTED_FORMAL_RUN_A_ONCE',
  );
  assert.equal(settlement.closure_contract.canonical_receipt_count, 153);
  assert.equal(boundary.changed_file_count, 5);
  assert.deepEqual([...boundary.changed_files].sort(), CHANGED);
  assert.equal(boundary.closure_fvo10_canonical_alias_object_frozen, true);
  assert.equal(boundary.database_execution_performed, false);
  assert.equal(boundary.workflow_dispatch_performed, false);
  assert.doesNotMatch(text(WORKFLOW), /workflow_dispatch:|postgres:|psql|DATABASE_URL/i);

  const result = {
    schema_version: 'geox_mcft_cap08_s6_closure_fvo10_corrected_run_a_authority_effectiveness_result_v1',
    status: 'PASS',
    base_main_sha: BASE,
    exact_head_sha: git('rev-parse', 'HEAD'),
    candidate_to_merge_file_delta: 0,
    object_count: 54,
    operational_run_instance_id: OP,
    logical_database_identity: DBID,
    production_gate_eligible: true,
    fvo10_canonical_alias_preflight: 'PASS',
    conflicting_alias_preflight: 'PASS_REJECTED',
    canonical_receipt_count: 153,
    operational_event_count: 224,
    database_execution_performed: false,
    workflow_dispatch_performed: false,
    run_b_dispatch_authorized: false,
  };
  save(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  save({
    schema_version: 'geox_mcft_cap08_s6_closure_fvo10_corrected_run_a_authority_effectiveness_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
