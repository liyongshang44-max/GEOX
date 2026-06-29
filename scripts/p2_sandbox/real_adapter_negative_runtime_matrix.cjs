// scripts/p2_sandbox/real_adapter_negative_runtime_matrix.cjs
// Purpose: execute the P2-05 negative runtime matrix for real-adapter preparation using local-only checks.
// Boundary: this script uses repository text and a 127.0.0.1 sandbox only; it does not call GEOX server routes, mutate DB state, connect real devices, connect brokers, create receipts, create ROI, create Field Memory, or update models.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sandbox = require('./irrigation_http_v1_sandbox_harness.cjs');

const ROOT = process.cwd();
const MATRIX_SCHEMA = 'real_adapter_negative_runtime_matrix_v1';
const MANIFEST_FILE = 'docs/controlplane/GEOX-CP-RealAdapterNegativeRuntimeMatrix-v1.json';
const HOST = '127.0.0.1';
const TOKEN = 'sandbox-token';

function abs(file) {
  return path.resolve(ROOT, file);
}

function read(file) {
  return fs.readFileSync(abs(file), 'utf8');
}

function readJson(file) {
  return JSON.parse(read(file));
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

function baseTask(overrides = {}) {
  return {
    tenant_id: 'tenant_matrix',
    project_id: 'project_matrix',
    group_id: 'group_matrix',
    act_task_id: 'act_matrix_base',
    command_id: 'cmd_matrix_base',
    operation_plan_id: 'op_matrix_base',
    action_type: 'irrigate',
    task_type: 'irrigate',
    adapter_type: 'irrigation_http_v1',
    adapter_hint: null,
    parameters: { duration_s: 10, valve_open: true },
    meta: { sandbox: true },
    device_id: 'sandbox-device-001',
    ...overrides,
  };
}

function codeOf(result) {
  return String(result?.meta?.receipt_code ?? result?.meta?.reason ?? result?.status ?? '').trim();
}

async function runtimeCases() {
  const local = sandbox.createSandboxServer();
  const listener = await listen(local.server);
  const ctx = { baseUrl: listener.baseUrl, token: TOKEN };
  try {
    const rows = [];
    const cases = [
      {
        name: 'irrigation_http_missing_device',
        expected_code: 'MISSING_DEVICE_ID',
        run: () => sandbox.executeIrrigationHttpV1Sandbox(baseTask({ device_id: '', act_task_id: 'act_matrix_missing_device', command_id: 'cmd_matrix_missing_device' }), ctx),
      },
      {
        name: 'irrigation_http_missing_operation_plan',
        expected_code: 'MISSING_OPERATION_PLAN_ID',
        run: () => sandbox.executeIrrigationHttpV1Sandbox(baseTask({ operation_plan_id: '', act_task_id: 'act_matrix_missing_plan', command_id: 'cmd_matrix_missing_plan' }), ctx),
      },
      {
        name: 'irrigation_http_device_reject',
        expected_code: 'DEVICE_REJECT',
        run: () => sandbox.executeIrrigationHttpV1Sandbox(baseTask({ device_id: 'reject-device', act_task_id: 'act_matrix_reject', command_id: 'cmd_matrix_reject' }), ctx),
      },
      {
        name: 'irrigation_http_transport_error',
        expected_code: 'HTTP_ERROR',
        run: () => sandbox.executeIrrigationHttpV1Sandbox(baseTask({ act_task_id: 'act_matrix_http_error', command_id: 'cmd_matrix_http_error' }), { baseUrl: `${listener.baseUrl}/wrong`, token: TOKEN }),
      },
    ];

    for (const item of cases) {
      const result = await item.run();
      const actualCode = codeOf(result);
      rows.push({
        case: item.name,
        kind: 'runtime_sandbox_case',
        expected_code: item.expected_code,
        actual_code: actualCode,
        passed: actualCode === item.expected_code,
      });
    }

    return { rows, captured_request_count: local.capturedRequests.length, base_url: listener.baseUrl };
  } finally {
    await close(local.server);
  }
}

function staticRows(manifest) {
  const rows = [];
  for (const item of manifest.matrix_cases) {
    if (item.kind === 'runtime_sandbox_case') continue;
    const file = manifest.source_files[item.source_file_key];
    const text = read(file);
    const token = String(item.token ?? '');
    rows.push({
      case: item.case,
      kind: item.kind,
      source_file: file,
      token,
      passed: token ? text.includes(token) : false,
    });
  }
  return rows;
}

async function runMatrix() {
  const startedAt = Date.now();
  const manifest = readJson(MANIFEST_FILE);
  const staticMatrixRows = staticRows(manifest);
  const runtimeMatrix = await runtimeCases();
  const rows = [...staticMatrixRows, ...runtimeMatrix.rows];
  const failed = rows.filter((row) => row.passed !== true);
  const matrixHash = crypto.createHash('sha256').update(JSON.stringify(rows.map((row) => ({ case: row.case, kind: row.kind, passed: row.passed, code: row.actual_code ?? row.token ?? null })))).digest('hex');

  return {
    ok: failed.length === 0,
    schema: MATRIX_SCHEMA,
    manifest_file: MANIFEST_FILE,
    matrix_case_count: rows.length,
    runtime_case_count: runtimeMatrix.rows.length,
    static_case_count: staticMatrixRows.length,
    failed_case_count: failed.length,
    failed_cases: failed.map((row) => row.case),
    captured_request_count: runtimeMatrix.captured_request_count,
    bind_host: HOST,
    sandbox_base_url: runtimeMatrix.base_url,
    deterministic_matrix_hash: matrixHash,
    live_device_connected: false,
    broker_connected: false,
    geox_server_called: false,
    db_mutated: false,
    receipt_created: false,
    roi_created: false,
    field_memory_created: false,
    model_updated: false,
    duration_ms: Math.max(0, Date.now() - startedAt),
    next_step: 'P2_06_OPERATOR_CONTROLLED_PILOT_DRY_RUN',
  };
}

if (require.main === module) {
  runMatrix().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }).catch((error) => {
    console.error(JSON.stringify({ ok: false, schema: MATRIX_SCHEMA, error: String(error.message ?? error) }, null, 2));
    process.exit(1);
  });
}

module.exports = { runMatrix };
