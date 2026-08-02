#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../..');
const BASE = '2c3e82480ff00e049796905a302c49b570650782';
const OUT = path.join(
  ROOT,
  'acceptance-output/MCFT_CAP_08_S6_MATERIALIZATION_PHASE_ORDER_CORRECTION_RESULT.json',
);
const P = {
  workflow: '.github/workflows/mcft-cap-08-s6-run-a-materialization-phase-order-correction.yml',
  executionSpec: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/execution_spec_v1.cjs',
  materializationOutput: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/materialization_output_v1.cjs',
  settlement: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-MATERIALIZATION-PHASE-ORDER-FAILURE-SETTLEMENT-V1.json',
  boundary: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-MATERIALIZATION-PHASE-ORDER-CORRECTION-BOUNDARY-V1.json',
  authority: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-T17-GUARD-ACL-CORRECTED-FORMAL-RUN-A-EXECUTION-AUTHORITY-EFFECTIVE-V1.json',
  validator: 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_MATERIALIZATION_PHASE_ORDER_CORRECTION_V1.cjs',
  s6Contract: 'docs/digital_twin/mcft/cap_08/GEOX-MCFT-CAP-08-S6-CONTRACT-V1.json',
  formalWorkflow: '.github/workflows/mcft-cap-08-s6-single-run-database-execution.yml',
  productChain: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_chain_v1.cjs',
  productLoader: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_loader_v1.cjs',
  directMaterializer: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/direct_materializer_v1.cjs',
  harness: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_db/harness_v1.cjs',
  portBundle: 'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/index_v1.cjs',
  migration: 'apps/server/db/migrations/2026_08_01_mcft_cap08_s4_t17_transition_persistence.sql',
};
const CHANGED = [
  P.workflow,
  P.executionSpec,
  P.materializationOutput,
  P.settlement,
  P.boundary,
  P.authority,
  P.validator,
].sort();
const PHASE_ORDER = ['resolve', 'E', 'H', 'A', 'B', 'G', 'C', 'barrier'];

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
    git('diff', '--name-only', `${base}...HEAD`)
      .split(/\r?\n/)
      .filter(Boolean)
      .sort(),
    CHANGED,
  );

  assert.equal(git('rev-parse', `HEAD:${P.s6Contract}`), '47ff4215d711b229604b29ce6c663e62b59efc39');
  assert.equal(git('rev-parse', `HEAD:${P.formalWorkflow}`), '2371b3797999f61f55c58551b85c59279eb2f0a2');
  assert.equal(git('rev-parse', `HEAD:${P.productChain}`), 'fe3472b1ac2e0f6e91800172315060d7a4456b0b');
  assert.equal(git('rev-parse', `HEAD:${P.productLoader}`), '9ede26f14b97677cfa926f67a18aa8b9bc1b5a29');
  assert.equal(git('rev-parse', `HEAD:${P.directMaterializer}`), '8369efaf8e8be1279f33196d1dcf743612b72852');
  assert.equal(git('rev-parse', `HEAD:${P.harness}`), '1833c793a10bba383f54200a35cb3f8912b60b94');
  assert.equal(git('rev-parse', `HEAD:${P.portBundle}`), '065b2da057a663ef0700003312e9f04a15d4a875');
  assert.equal(git('rev-parse', `HEAD:${P.migration}`), '323bd2fb81eaf73489345ac46f1a640866cffaed');

  process.env.MCFT_LOCAL_REPLAY = '1';
  const { loadSingleRunHarnessContractsV1 } = require(
    '../runtime_acceptance/mcft_cap08_s6_single_run_db/contract_loader_v1.cjs',
  );
  const {
    REQUIRED_PHASE_ORDER_V1,
    buildSingleRunExecutionSpecV1,
  } = require('../runtime_acceptance/mcft_cap08_s6_single_run_db/execution_spec_v1.cjs');
  const {
    REQUIRED_OPERATIONAL_PHASE_ORDER_V1,
    buildOperationalEventsV1,
  } = require('../runtime_acceptance/mcft_cap08_s6_single_run_ports/materialization_output_v1.cjs');

  const contracts = loadSingleRunHarnessContractsV1({ localReplay: true });
  assert.deepEqual(contracts.s6.required_phase_order, PHASE_ORDER);
  assert.deepEqual(REQUIRED_PHASE_ORDER_V1, PHASE_ORDER);
  assert.deepEqual(REQUIRED_OPERATIONAL_PHASE_ORDER_V1, PHASE_ORDER);

  const spec = buildSingleRunExecutionSpecV1({
    contracts,
    runLabel: 'RUN_A',
    operationalRunInstanceId: 'MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-007',
    exactSubjectSha: '923a794e0fa865a4a8493680b1b8ac2e98e57fbc',
  });
  assert.equal(spec.schema_version, 'geox_mcft_cap08_s6_single_run_execution_spec_v3');
  assert.equal(spec.phase_count, 28);
  assert.equal(spec.phases.length, 28);
  for (const phase of spec.phases) {
    assert.deepEqual(phase.phase_order, PHASE_ORDER);
    assert.equal(phase.phase_order.length, 8);
  }
  assert.match(spec.execution_spec_digest, /^sha256:[0-9a-f]{64}$/);

  const events = buildOperationalEventsV1({ spec });
  assert.equal(events.length, 224);
  for (let phaseIndex = 0; phaseIndex < spec.phases.length; phaseIndex += 1) {
    const slice = events.slice(phaseIndex * 8, phaseIndex * 8 + 8);
    assert.deepEqual(slice.map(event => event.phase), PHASE_ORDER);
    assert.deepEqual(slice.map(event => event.sequence), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.ok(slice.every(event => event.phase_id === spec.phases[phaseIndex].phase_id));
  }
  const t08 = events.filter(event => event.phase_id === 'T08');
  assert.equal(t08.length, 8);
  assert.deepEqual(t08.map(event => event.phase), PHASE_ORDER);

  assert.throws(
    () => buildOperationalEventsV1({
      spec: {
        ...spec,
        phases: spec.phases.map((phase, index) => (
          index === 0 ? { ...phase, phase_order: undefined } : phase
        )),
      },
    }),
    /OPERATIONAL_EVENT_PHASE_ORDER_REQUIRED:B00/,
  );

  const authority = json(P.authority);
  const settlement = json(P.settlement);
  const boundary = json(P.boundary);
  for (const value of [authority, settlement, boundary]) {
    assert.equal(value.semantic_digest, semantic(value));
  }

  assert.equal(
    authority.record_status,
    'SINGLE_FINAL_FORMAL_RUN_AUTHORITY_CONSUMED_MATERIALIZATION_PHASE_ORDER_FAILURE',
  );
  assert.equal(authority.authority_consumed, true);
  assert.equal(authority.single_use_contract.dispatch_count_consumed, 1);
  assert.equal(authority.single_use_contract.rerun_authorized, false);
  assert.equal(authority.single_use_contract.authority_reuse_authorized, false);
  assert.equal(authority.consumption_evidence.github_workflow_run_id, 30760836890);
  assert.equal(authority.consumption_evidence.authority_artifact_id, 8837388975);
  assert.equal(authority.consumption_evidence.failed_run_artifact_id, 8837403277);
  assert.equal(authority.consumption_evidence.database_dropped, true);
  assert.equal(authority.failure_classification.code, 'MATERIALIZATION_PHASE_ORDER_UNDEFINED');
  assert.equal(authority.failure_classification.formal_execution_spec_transport_defect, true);
  assert.equal(authority.replacement_authority_issued, false);
  assert.equal(authority.sequence_contract.run_b_remains_blocked, true);

  assert.equal(
    settlement.record_status,
    'RUN_A_MATERIALIZATION_PHASE_ORDER_FAILURE_SETTLED',
  );
  assert.equal(settlement.failed_dispatch.workflow_run_id, 30760836890);
  assert.deepEqual(settlement.root_cause.frozen_required_phase_order, PHASE_ORDER);
  assert.equal(settlement.correction.expected_operational_event_count, 224);
  assert.equal(settlement.correction.empty_event_fallback_authorized, false);
  assert.equal(
    settlement.next_legal_action_after_merge,
    'ISSUE_NEW_NON_EFFECTIVE_RUN_A_AUTHORITY_CANDIDATE',
  );

  assert.equal(boundary.base_main_sha, BASE);
  assert.equal(boundary.changed_file_count, 7);
  assert.deepEqual([...boundary.changed_files].sort(), CHANGED);
  assert.deepEqual(boundary.correction.phase_order, PHASE_ORDER);
  assert.equal(boundary.correction.operational_event_count, 224);
  assert.equal(boundary.replacement_authority_present, false);
  assert.equal(boundary.database_execution_performed, false);
  assert.equal(boundary.workflow_dispatch_performed, false);

  const workflow = text(P.workflow);
  assert.doesNotMatch(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /postgres:16/);
  assert.doesNotMatch(workflow, /workflow_entrypoint_v1\.ts/);
  assert.doesNotMatch(CHANGED.join('\n'), /AUTHORITY-CANDIDATE|AUTHORITY-EFFECTIVENESS/);
  assert.doesNotMatch(CHANGED.join('\n'), /single-run-database-execution\.yml/);

  const result = {
    schema_version: 'geox_mcft_cap08_s6_materialization_phase_order_correction_result_v1',
    status: 'PASS',
    base_main_sha: BASE,
    exact_head_sha: git('rev-parse', 'HEAD'),
    changed_file_count: 7,
    failed_workflow_run_id: 30760836890,
    consumed_operational_identity: 'MCFT-CAP-08-S6-FORMAL-RUN-A-20260802-REPLACEMENT-007',
    terminal_error: 'MATERIALIZATION_PHASE_ORDER_UNDEFINED',
    exact_phase_order: PHASE_ORDER,
    phase_count: spec.phase_count,
    events_per_phase: 8,
    operational_event_count: events.length,
    execution_spec_digest_bound_to_phase_order: true,
    missing_phase_order_rejected: true,
    product_runtime_changed: false,
    migration_changed: false,
    formal_database_workflow_changed: false,
    replacement_authority_present: false,
    database_execution_performed: false,
    workflow_dispatch_performed: false,
    run_b_dispatch_authorized: false,
  };
  save(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  save({
    schema_version: 'geox_mcft_cap08_s6_materialization_phase_order_correction_result_v1',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  });
  console.error(error);
  process.exitCode = 1;
}
