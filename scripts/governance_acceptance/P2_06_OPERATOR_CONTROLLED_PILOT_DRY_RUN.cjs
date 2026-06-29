// scripts/governance_acceptance/P2_06_OPERATOR_CONTROLLED_PILOT_DRY_RUN.cjs
// Purpose: verify and run the P2-06 operator-controlled pilot dry run.
// Boundary: this acceptance uses local repository checks and a 127.0.0.1 sandbox dry run only.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P2_06_OPERATOR_CONTROLLED_PILOT_DRY_RUN';

const FILES = {
  p205Doc: 'docs/tasks/P2-05-Real-Adapter-Negative-Runtime-Matrix.md',
  p205Acceptance: 'scripts/governance_acceptance/P2_05_REAL_ADAPTER_NEGATIVE_RUNTIME_MATRIX.cjs',
  p206Doc: 'docs/tasks/P2-06-Operator-Controlled-Pilot-Dry-Run.md',
  manifest: 'docs/controlplane/GEOX-CP-OperatorControlledPilotDryRun-v1.json',
  dryRunHarness: 'scripts/p2_sandbox/operator_controlled_pilot_dry_run.cjs',
  matrixRunner: 'scripts/p2_sandbox/real_adapter_negative_runtime_matrix.cjs',
  sandboxHarness: 'scripts/p2_sandbox/irrigation_http_v1_sandbox_harness.cjs',
};

const EXPECTED_GATE_FIELDS = [
  'operator_id',
  'operator_attestation',
  'approval_ref_id',
  'operation_plan_ref_id',
  'act_task_ref_id',
  'dry_run_only',
  'human_gate',
];

const EXPECTED_CASES = [
  'operator_gate_missing',
  'operator_gate_passed',
  'negative_matrix_preflight',
  'sandbox_ack',
  'no_live_side_effects',
];

const assertions = [];

function abs(file) {
  return path.resolve(ROOT, file);
}

function read(file) {
  return fs.readFileSync(abs(file), 'utf8');
}

function readJson(file) {
  return JSON.parse(read(file));
}

function assert(name, condition, details = {}) {
  const passed = condition === true;
  assertions.push({ name, passed, details });
  if (!passed) {
    const error = new Error(`ASSERTION_FAILED:${name}`);
    error.details = details;
    throw error;
  }
}

function containsAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function runDryRunProcess() {
  const output = childProcess.execFileSync(process.execPath, [FILES.dryRunHarness], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 20000,
    env: {
      ...process.env,
      GEOX_P2_DRY_RUN_ACCEPTANCE: 'true',
    },
  });
  return JSON.parse(output);
}

function assertionSummary() {
  const failed = assertions.filter((item) => item.passed !== true);
  return {
    assertion_count: assertions.length,
    failed_assertion_count: failed.length,
    failed_assertions: failed.map((item) => item.name),
  };
}

function main() {
  for (const [name, file] of Object.entries(FILES)) {
    assert(`${name}_exists`, fs.existsSync(abs(file)), { file });
  }

  const p205Doc = read(FILES.p205Doc);
  const p205Acceptance = read(FILES.p205Acceptance);
  const p206Doc = read(FILES.p206Doc);
  const manifest = readJson(FILES.manifest);
  const dryRunHarness = read(FILES.dryRunHarness);

  assert('p205_completion_entry_verified', containsAll(p205Doc, ['P2-05 Real Adapter Negative Runtime Matrix', 'next_step = P2_06_OPERATOR_CONTROLLED_PILOT_DRY_RUN']) && containsAll(p205Acceptance, ['P2_05_REAL_ADAPTER_NEGATIVE_RUNTIME_MATRIX', 'P2_06_OPERATOR_CONTROLLED_PILOT_DRY_RUN']), { files: [FILES.p205Doc, FILES.p205Acceptance] });
  assert('p206_doc_records_scope_and_boundary', containsAll(p206Doc, ['P2-06 Operator-Controlled Pilot Dry Run', 'operator_controlled_pilot_dry_run.cjs', 'operator_gate_missing', 'sandbox_ack', 'next_step = P2_COMPLETION_REVIEW_BEFORE_P3']), { file: FILES.p206Doc });

  assert('pilot_manifest_verified', manifest.schema === 'operator_controlled_pilot_dry_run_v1' && manifest.version === '1.0.0' && manifest.task === 'P2-06 Operator-Controlled Pilot Dry Run' && manifest.next_step === 'P2_COMPLETION_REVIEW_BEFORE_P3', { file: FILES.manifest });
  assert('pilot_scope_verified', manifest.pilot_scope?.adapter_type === 'irrigation_http_v1' && manifest.pilot_scope?.action_type === 'irrigate' && manifest.pilot_scope?.runtime === 'local_loopback_sandbox' && manifest.pilot_scope?.effect === 'simulated_ack_only', { pilot_scope: manifest.pilot_scope });
  assert('pilot_boundary_verified', manifest.boundary?.dry_run_only === true && manifest.boundary?.loopback_only === true && manifest.boundary?.no_live_device_integration === true && manifest.boundary?.no_broker_connection === true && manifest.boundary?.no_geox_server_route_call === true && manifest.boundary?.no_db_mutation === true && manifest.boundary?.no_model_update === true, { boundary: manifest.boundary });

  for (const field of EXPECTED_GATE_FIELDS) {
    assert(`operator_gate_field_declared:${field}`, manifest.operator_gate_required_fields.includes(field) && p206Doc.includes(field), { field });
  }
  for (const caseName of EXPECTED_CASES) {
    assert(`dry_run_case_declared:${caseName}`, manifest.dry_run_cases.some((item) => item.case === caseName) && p206Doc.includes(caseName), { caseName });
  }

  assert('dry_run_harness_static_verified', containsAll(dryRunHarness, ['operator_controlled_pilot_dry_run_v1', 'validateOperatorGate', 'defaultOperatorGate', 'runDryRun', 'matrix.runMatrix', 'executeIrrigationHttpV1Sandbox', 'operator_controlled: true', 'dry_run_only: true', 'human_gate: true', 'live_device_connected: false', 'broker_connected: false', 'geox_server_called: false', 'db_mutated: false', 'model_updated: false']), { file: FILES.dryRunHarness });

  const dryRunResult = runDryRunProcess();
  assert('pilot_dry_run_ok', dryRunResult.ok === true, { dryRunResult });
  assert('pilot_dry_run_verified', dryRunResult.schema === 'operator_controlled_pilot_dry_run_v1' && dryRunResult.dry_run_case_count === EXPECTED_CASES.length && dryRunResult.failed_case_count === 0, { dryRunResult });
  assert('operator_gate_verified', dryRunResult.operator_gate_code === 'OPERATOR_GATE_ACCEPTED' && dryRunResult.missing_gate_code === 'OPERATOR_GATE_REQUIRED' && dryRunResult.operator_controlled === true && dryRunResult.dry_run_only === true && dryRunResult.human_gate === true, { dryRunResult });
  assert('pilot_preflight_and_ack_verified', dryRunResult.matrix_preflight_ok === true && dryRunResult.sandbox_ack_observed === true, { dryRunResult });
  assert('pilot_loopback_verified', dryRunResult.bind_host === '127.0.0.1' && String(dryRunResult.sandbox_base_url ?? '').startsWith('http://127.0.0.1:'), { dryRunResult });
  assert('pilot_no_live_side_effects', dryRunResult.live_device_connected === false && dryRunResult.broker_connected === false && dryRunResult.geox_server_called === false && dryRunResult.db_mutated === false && dryRunResult.receipt_created === false && dryRunResult.roi_created === false && dryRunResult.field_memory_created === false && dryRunResult.model_updated === false, { dryRunResult });
  assert('pilot_next_step_verified', dryRunResult.next_step === 'P2_COMPLETION_REVIEW_BEFORE_P3', { dryRunResult });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    pilot_manifest_verified: true,
    operator_gate_verified: true,
    pilot_dry_run_verified: true,
    dry_run_case_count: dryRunResult.dry_run_case_count,
    failed_case_count: dryRunResult.failed_case_count,
    deterministic_dry_run_hash: dryRunResult.deterministic_dry_run_hash,
    matrix_preflight_ok: dryRunResult.matrix_preflight_ok,
    sandbox_ack_observed: dryRunResult.sandbox_ack_observed,
    live_device_connected: dryRunResult.live_device_connected,
    broker_connected: dryRunResult.broker_connected,
    geox_server_called: dryRunResult.geox_server_called,
    db_mutated: dryRunResult.db_mutated,
    no_live_adapter_started: true,
    ...assertionSummary(),
    next_step: 'P2_COMPLETION_REVIEW_BEFORE_P3',
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: ACCEPTANCE,
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
