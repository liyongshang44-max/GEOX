#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '1475b326994e15e9e0ce6a393dde825825763ff6';
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_08_S6_FVO17_FORECAST_BINDING_CORRECTED_RUN_A_AUTHORITY_EFFECTIVENESS_RESULT.json');
const CANDIDATE = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FVO17-FORECAST-BINDING-CORRECTED-FORMAL-RUN-A-AUTHORITY-CANDIDATE-V1.json';
const EFFECTIVE = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FVO17-FORECAST-BINDING-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json';
const OBJECTS = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FVO17-FORECAST-BINDING-CORRECTED-RUN-A-AUTHORITY-OBJECT-SET-V1.json';
const SETTLEMENT = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FVO17-FORECAST-BINDING-CORRECTED-RUN-A-AUTHORITY-EFFECTIVENESS-V1.json';
const BOUNDARY = 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-FVO17-FORECAST-BINDING-CORRECTED-RUN-A-AUTHORITY-EFFECTIVENESS-BOUNDARY-V1.json';
const WORKFLOW = '.github/workflows/mcft-cap-08-s6-fvo17-forecast-binding-corrected-run-a-authority-effectiveness.yml';
const VALIDATOR = 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_FVO17_FORECAST_BINDING_CORRECTED_RUN_A_AUTHORITY_EFFECTIVENESS_V1.cjs';
const PRODUCT_CHAIN = 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_chain_v1.cjs';
const CHANGED = [WORKFLOW, EFFECTIVE, SETTLEMENT, BOUNDARY, VALIDATOR].sort();
const SUBJECT = '89517a1b3ff61a1a1ba3259ef4e04001d6e1fee8';
const OP = 'MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-010';
const DBID = 'MCFT-CAP-08-S6-FORMAL-DB-A-20260802-REPLACEMENT-010';

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

  assert.equal(git('rev-parse', `HEAD:${CANDIDATE}`), '3873a9c3b7a64a63287d24fec17e587d01a96eb5');
  assert.equal(git('rev-parse', `HEAD:${OBJECTS}`), 'cbeae03ad6118c8f8138df18b7260e5d20cdbb3e');
  assert.equal(git('rev-parse', `HEAD:${EFFECTIVE}`), 'af5de558058e0dd15d8d210b3c324a8155714792');
  assert.equal(git('rev-parse', `HEAD:${SETTLEMENT}`), 'e682ed2e0df50e9b4c9976a539790077a98572a6');
  assert.equal(git('rev-parse', `HEAD:${BOUNDARY}`), '6561286f2a25aca7fe8606f6e37c04c8b4f61c5f');

  assert.equal(candidate.record_status, 'FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORITY_CANDIDATE_NOT_EFFECTIVE');
  assert.equal(candidate.exact_subject_sha, SUBJECT);
  assert.equal(candidate.operational_run_instance_id, OP);
  assert.equal(candidate.semantic_digest, 'sha256:27bd5c0fe936e817c19491b0dc898d7f10adfb3d5fab556dedd0697115f74233');

  assert.equal(effective.record_status, 'SINGLE_FINAL_FORMAL_RUN_DATABASE_EXECUTION_AUTHORIZED');
  assert.equal(effective.exact_subject_sha, SUBJECT);
  assert.equal(effective.operational_run_instance_id, OP);
  assert.equal(effective.logical_database_identity.identity_id, DBID);
  assert.equal(effective.logical_database_identity.physical_name_template, 'geox_mcft_cap08_s6_run_a_replacement_010_<github_run_id>');
  assert.equal(effective.candidate_head_sha, '28cfc061a7b47b0fe405a7a07001512e915c2cd6');
  assert.equal(effective.candidate_merge_sha, BASE);
  assert.equal(effective.candidate_authority_ref.blob_sha, '3873a9c3b7a64a63287d24fec17e587d01a96eb5');
  assert.equal(effective.candidate_authority_ref.preserved_semantic_digest, candidate.semantic_digest);
  assert.equal(effective.object_set_manifest_ref.blob_sha, 'cbeae03ad6118c8f8138df18b7260e5d20cdbb3e');
  assert.equal(effective.single_use_contract.max_dispatch_count, 1);
  assert.equal(effective.single_use_contract.rerun_authorized, false);
  assert.equal(effective.sequence_contract.run_b_remains_blocked, true);
  assert.equal(effective.correction_provenance.canonical_receipt_count, 153);
  assert.equal(effective.correction_provenance.operational_event_count, 224);
  assert.equal(effective.correction_provenance.fvo17_observation_and_residual_share_corrected_forecast, true);
  assert.equal(effective.correction_provenance.other_23_order_bindings_preserved, true);

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

  const productChain = text(PRODUCT_CHAIN);
  assert.match(productChain, /const residualForecast=order===17\?s4\.corrected_set\.forecast:observationSourceForecast;/);
  assert.match(productChain, /forecast:residualForecast,/);
  assert.equal(git('rev-parse', `HEAD:${PRODUCT_CHAIN}`), 'de12666d4d5bebeac9b57f07d663a0f0f2dc4de1');

  process.env.MCFT_LOCAL_REPLAY = '1';
  const { loadSingleRunHarnessContractsV1 } = require(path.join(
    ROOT,
    'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/contract_loader_v1.cjs',
  ));
  const { buildSingleRunExecutionSpecV1 } = require(path.join(
    ROOT,
    'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/execution_spec_v1.cjs',
  ));
  const { buildOperationalEventsV1 } = require(path.join(
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
    identity.materializePhysicalDatabaseNameV1(effective, '30790000010'),
    'geox_mcft_cap08_s6_run_a_replacement_010_30790000010',
  );

  assert.equal(
    settlement.next_legal_action_after_merge,
    'DISPATCH_FVO17_FORECAST_BINDING_CORRECTED_FORMAL_RUN_A_ONCE',
  );
  assert.equal(settlement.closure_contract.canonical_receipt_count, 153);
  assert.equal(settlement.closure_contract.fvo17_observation_and_residual_share_corrected_forecast, true);
  assert.equal(boundary.changed_file_count, 5);
  assert.deepEqual([...boundary.changed_files].sort(), CHANGED);
  assert.equal(boundary.fvo17_corrected_forecast_binding_frozen, true);
  assert.equal(boundary.database_execution_performed, false);
  assert.equal(boundary.workflow_dispatch_performed, false);
  assert.doesNotMatch(text(WORKFLOW), /workflow_dispatch:|postgres:|psql|DATABASE_URL/i);

  const result = {
    schema_version: 'geox_mcft_cap08_s6_fvo17_forecast_binding_corrected_run_a_authority_effectiveness_result_v1',
    status: 'PASS',
    base_main_sha: BASE,
    exact_head_sha: git('rev-parse', 'HEAD'),
    candidate_to_merge_file_delta: 0,
    object_count: 54,
    operational_run_instance_id: OP,
    logical_database_identity: DBID,
    production_gate_eligible: true,
    fvo17_corrected_forecast_binding_preflight: 'PASS',
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
    schema_version: 'geox_mcft_cap08_s6_fvo17_forecast_binding_corrected_run_a_authority_effectiveness_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
