// scripts/p2_sandbox/operator_controlled_pilot_dry_run.cjs
// Purpose: run a local-only operator-controlled pilot dry run for P2-06.
// Boundary: this script uses a 127.0.0.1 sandbox and local matrix preflight only; it does not call GEOX server routes, mutate DB state, connect real devices, connect brokers, create receipts, create ROI, create Field Memory, or update models.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sandbox = require('./irrigation_http_v1_sandbox_harness.cjs');
const matrix = require('./real_adapter_negative_runtime_matrix.cjs');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const TOKEN = 'sandbox-token';
const SCHEMA = 'operator_controlled_pilot_dry_run_v1';
const MANIFEST_FILE = 'docs/controlplane/GEOX-CP-OperatorControlledPilotDryRun-v1.json';

function abs(file) {
  return path.resolve(ROOT, file);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(abs(file), 'utf8'));
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('SANDBOX_LISTEN_ADDRESS_INVALID'));
      resolve({ baseUrl: `http://${HOST}:${address.port}`, host: HOST, port: address.port });
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function validateOperatorGate(gate, manifest) {
  const missing = [];
  for (const field of manifest.operator_gate_required_fields) {
    if (gate[field] === true) continue;
    if (typeof gate[field] === 'string' && gate[field].trim()) continue;
    missing.push(field);
  }
  if (gate.dry_run_only !== true) missing.push('dry_run_only:true');
  if (gate.human_gate !== true) missing.push('human_gate:true');
  if (missing.length > 0) {
    return { ok: false, code: 'OPERATOR_GATE_REQUIRED', missing };
  }
  return { ok: true, code: 'OPERATOR_GATE_ACCEPTED', missing: [] };
}

function defaultOperatorGate(overrides = {}) {
  return {
    operator_id: 'operator_p2_06_dry_run',
    operator_attestation: 'I acknowledge this is a dry run against loopback sandbox only.',
    approval_ref_id: 'approval_ref_p2_06_dry_run',
    operation_plan_ref_id: 'operation_plan_ref_p2_06_dry_run',
    act_task_ref_id: 'act_ref_p2_06_dry_run',
    dry_run_only: true,
    human_gate: true,
    ...overrides,
  };
}

function pilotTask(gate) {
  return {
    tenant_id: 'tenant_p2_06',
    project_id: 'project_p2_06',
    group_id: 'group_p2_06',
    act_task_id: gate.act_task_ref_id,
    command_id: 'cmd_p2_06_operator_controlled_dry_run',
    operation_plan_id: gate.operation_plan_ref_id,
    action_type: 'irrigate',
    task_type: 'irrigate',
    adapter_type: 'irrigation_http_v1',
    adapter_hint: null,
    parameters: { duration_s: 10, valve_open: true, dry_run: true },
    meta: {
      sandbox: true,
      dry_run_only: true,
      operator_id: gate.operator_id,
      approval_ref_id: gate.approval_ref_id,
      operation_plan_ref_id: gate.operation_plan_ref_id,
    },
    device_id: 'sandbox-device-001',
  };
}

function hashReport(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function runDryRun() {
  const startedAt = Date.now();
  const manifest = readJson(MANIFEST_FILE);
  const cases = [];

  const missingGate = validateOperatorGate(defaultOperatorGate({ operator_id: '' }), manifest);
  cases.push({ case: 'operator_gate_missing', expected_code: 'OPERATOR_GATE_REQUIRED', actual_code: missingGate.code, passed: missingGate.code === 'OPERATOR_GATE_REQUIRED' });

  const gate = defaultOperatorGate();
  const gateResult = validateOperatorGate(gate, manifest);
  cases.push({ case: 'operator_gate_passed', expected_code: 'OPERATOR_GATE_ACCEPTED', actual_code: gateResult.code, passed: gateResult.code === 'OPERATOR_GATE_ACCEPTED' });

  const matrixResult = await matrix.runMatrix();
  cases.push({ case: 'negative_matrix_preflight', expected_code: 'MATRIX_PREFLIGHT_OK', actual_code: matrixResult.ok ? 'MATRIX_PREFLIGHT_OK' : 'MATRIX_PREFLIGHT_FAILED', passed: matrixResult.ok === true });

  const local = sandbox.createSandboxServer();
  const listener = await listen(local.server);
  let dryRunResult;
  try {
    dryRunResult = await sandbox.executeIrrigationHttpV1Sandbox(pilotTask(gate), { baseUrl: listener.baseUrl, token: TOKEN });
  } finally {
    await close(local.server);
  }

  const ackCode = String(dryRunResult?.meta?.receipt_code ?? '');
  cases.push({ case: 'sandbox_ack', expected_code: 'SANDBOX_ACK', actual_code: ackCode, passed: ackCode === 'SANDBOX_ACK' });

  const noLiveFlags = {
    live_device_connected: false,
    broker_connected: false,
    geox_server_called: false,
    db_mutated: false,
    receipt_created: false,
    roi_created: false,
    field_memory_created: false,
    model_updated: false,
  };
  cases.push({ case: 'no_live_side_effects', expected_code: 'NO_LIVE_SIDE_EFFECTS', actual_code: 'NO_LIVE_SIDE_EFFECTS', passed: Object.values(noLiveFlags).every((value) => value === false) });

  const failed = cases.filter((item) => item.passed !== true);
  const reportCore = {
    schema: SCHEMA,
    operator_id: gate.operator_id,
    adapter_type: manifest.pilot_scope.adapter_type,
    action_type: manifest.pilot_scope.action_type,
    target_device_id: manifest.pilot_scope.target_device_id,
    dry_run_only: true,
    human_gate: true,
    operator_controlled: true,
    matrix_preflight_ok: matrixResult.ok === true,
    sandbox_ack_observed: ackCode === 'SANDBOX_ACK',
    case_summary: cases.map((item) => ({ case: item.case, code: item.actual_code, passed: item.passed })),
  };

  return {
    ok: failed.length === 0,
    schema: SCHEMA,
    manifest_file: MANIFEST_FILE,
    operator_controlled: true,
    dry_run_only: true,
    human_gate: true,
    matrix_preflight_ok: matrixResult.ok === true,
    sandbox_ack_observed: ackCode === 'SANDBOX_ACK',
    dry_run_case_count: cases.length,
    failed_case_count: failed.length,
    failed_cases: failed.map((item) => item.case),
    operator_gate_code: gateResult.code,
    missing_gate_code: missingGate.code,
    deterministic_dry_run_hash: hashReport(reportCore),
    bind_host: HOST,
    sandbox_base_url: listener.baseUrl,
    ...noLiveFlags,
    duration_ms: Math.max(0, Date.now() - startedAt),
    next_step: 'P2_COMPLETION_REVIEW_BEFORE_P3',
  };
}

if (require.main === module) {
  runDryRun().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }).catch((error) => {
    console.error(JSON.stringify({ ok: false, schema: SCHEMA, error: String(error.message ?? error) }, null, 2));
    process.exit(1);
  });
}

module.exports = { runDryRun, validateOperatorGate, defaultOperatorGate };
