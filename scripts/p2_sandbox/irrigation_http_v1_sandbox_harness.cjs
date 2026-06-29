// scripts/p2_sandbox/irrigation_http_v1_sandbox_harness.cjs
// Purpose: run a local-only sandbox harness for the irrigation_http_v1 adapter request shape.
// Boundary: this script binds only to 127.0.0.1, does not connect to real devices, does not connect to brokers, does not call GEOX server routes, does not mutate DB state, and does not create receipts, ROI, Field Memory, or model updates.

'use strict';

const http = require('node:http');
const crypto = require('node:crypto');

const HOST = '127.0.0.1';
const SANDBOX_TOKEN = 'sandbox-token';
const HARNESS_SCHEMA = 'safe_real_adapter_sandbox_harness_v1';

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('error', reject);
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text.trim()) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(new Error(`MALFORMED_JSON:${String(error.message ?? error)}`));
      }
    });
  });
}

function writeJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function normalizePathname(url) {
  try {
    return new URL(url, `http://${HOST}`).pathname;
  } catch {
    return '/';
  }
}

function extractDeviceId(pathname) {
  const match = pathname.match(/^\/device\/([^/]+)\/irrigate$/);
  return match ? decodeURIComponent(match[1]) : '';
}

function assertSandboxRequestShape(deviceId, body) {
  const missing = [];
  if (!deviceId) missing.push('device_id');
  if (!String(body?.command_id ?? '').trim()) missing.push('command_id');
  if (!String(body?.task_id ?? '').trim()) missing.push('task_id');
  if (!String(body?.operation_plan_id ?? '').trim()) missing.push('operation_plan_id');
  if (!body?.parameters || typeof body.parameters !== 'object' || Array.isArray(body.parameters)) missing.push('parameters');
  if (!body?.context || typeof body.context !== 'object' || Array.isArray(body.context)) missing.push('context');
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, missing: [] };
}

function createSandboxServer() {
  const capturedRequests = [];
  const server = http.createServer(async (req, res) => {
    const pathname = normalizePathname(req.url);
    const deviceId = extractDeviceId(pathname);
    const requestId = `sandbox_req_${capturedRequests.length + 1}`;

    if (req.method !== 'POST' || !deviceId) {
      writeJson(res, 404, { status: 'FAIL', code: 'SANDBOX_ROUTE_NOT_FOUND', request_id: requestId });
      return;
    }

    const auth = String(req.headers.authorization ?? '').trim();
    if (auth !== `Bearer ${SANDBOX_TOKEN}`) {
      writeJson(res, 401, { status: 'FAIL', code: 'SANDBOX_AUTH_REQUIRED', request_id: requestId });
      return;
    }

    let body;
    try {
      body = await readRequestBody(req);
    } catch (error) {
      writeJson(res, 400, { status: 'FAIL', code: 'SANDBOX_MALFORMED_JSON', message: String(error.message ?? error), request_id: requestId });
      return;
    }

    const shape = assertSandboxRequestShape(deviceId, body);
    capturedRequests.push({ request_id: requestId, device_id: deviceId, body });
    if (!shape.ok) {
      writeJson(res, 400, { status: 'FAIL', code: 'SANDBOX_REQUEST_SHAPE_INVALID', missing: shape.missing, request_id: requestId });
      return;
    }

    if (deviceId === 'reject-device') {
      writeJson(res, 200, { status: 'FAIL', code: 'DEVICE_REJECT', message: 'sandbox device rejected command', request_id: requestId });
      return;
    }

    writeJson(res, 200, {
      status: 'ACK',
      code: 'SANDBOX_ACK',
      message: 'sandbox accepted command',
      request_id: requestId,
      accepted_device_id: deviceId,
    });
  });

  return { server, capturedRequests };
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('SANDBOX_LISTEN_ADDRESS_INVALID'));
      resolve({ host: HOST, port: address.port, baseUrl: `http://${HOST}:${address.port}` });
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function validateSandboxTask(task) {
  if (!String(task?.device_id ?? task?.meta?.device_id ?? '').trim()) return { ok: false, reason: 'MISSING_DEVICE_ID' };
  if (!String(task?.operation_plan_id ?? task?.meta?.operation_plan_id ?? '').trim()) return { ok: false, reason: 'MISSING_OPERATION_PLAN_ID' };
  return { ok: true };
}

async function postJson(url, token, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { _non_json: text };
  }
  if (!response.ok) throw new Error(`http ${response.status}: ${text}`);
  return json;
}

async function executeIrrigationHttpV1Sandbox(task, ctx) {
  const validation = validateSandboxTask(task);
  if (!validation.ok) {
    return {
      status: 'FAILED',
      meta: {
        receipt_status: 'FAILED',
        receipt_code: validation.reason,
        receipt_message: validation.reason,
        adapter_payload: { fault_flags: [validation.reason] },
      },
    };
  }

  const deviceId = String(task.device_id ?? task.meta?.device_id ?? '').trim();
  const dispatchUrl = `${ctx.baseUrl}/device/${encodeURIComponent(deviceId)}/irrigate`;
  try {
    const sentAt = Date.now();
    const out = await postJson(dispatchUrl, ctx.token, {
      command_id: task.command_id,
      task_id: task.act_task_id,
      operation_plan_id: task.operation_plan_id,
      parameters: task.parameters,
      attempt_index: 0,
      context: {
        tenant_id: task.tenant_id,
        project_id: task.project_id,
        group_id: task.group_id,
        recommendation_id: String(task.meta?.recommendation_id ?? '') || null,
        approval_request_id: String(task.meta?.approval_request_id ?? '') || null,
      },
    });

    if (String(out?.status ?? 'ACK').toUpperCase() === 'FAIL') {
      return {
        status: 'FAILED',
        meta: {
          receipt_status: 'FAILED',
          receipt_code: String(out?.code ?? 'DEVICE_REJECT'),
          receipt_message: String(out?.message ?? 'device rejected'),
          adapter_payload: { ...out, dispatch_url: dispatchUrl, dispatched_at_ts: sentAt, last_receipt_ts: sentAt, fault_flags: ['DEVICE_REJECT'] },
        },
      };
    }

    return {
      status: 'SUCCEEDED',
      meta: {
        receipt_status: 'ACKED',
        receipt_code: String(out?.code ?? 'ACK'),
        receipt_message: String(out?.message ?? 'accepted'),
        adapter_payload: { ...out, dispatch_url: dispatchUrl, dispatched_at_ts: sentAt, last_receipt_ts: sentAt, fault_flags: [] },
      },
    };
  } catch (error) {
    return {
      status: 'FAILED',
      meta: {
        receipt_status: 'FAILED',
        receipt_code: 'HTTP_ERROR',
        receipt_message: String(error.message ?? error),
        adapter_payload: { dispatch_url: dispatchUrl, fault_flags: ['HTTP_ERROR'] },
      },
    };
  }
}

function baseTask(overrides = {}) {
  return {
    tenant_id: 'tenant_sandbox',
    project_id: 'project_sandbox',
    group_id: 'group_sandbox',
    act_task_id: 'act_sandbox_irrigation_http_001',
    command_id: 'cmd_sandbox_irrigation_http_001',
    operation_plan_id: 'op_sandbox_irrigation_http_001',
    action_type: 'irrigate',
    task_type: 'irrigate',
    adapter_type: 'irrigation_http_v1',
    adapter_hint: null,
    parameters: { duration_s: 10, valve_open: true },
    meta: { recommendation_id: null, approval_request_id: null, sandbox: true },
    device_id: 'sandbox-device-001',
    ...overrides,
  };
}

async function runHarness() {
  const sandbox = createSandboxServer();
  const listener = await listen(sandbox.server);
  const ctx = { baseUrl: listener.baseUrl, token: SANDBOX_TOKEN };
  const startedAt = Date.now();

  try {
    const accepted = await executeIrrigationHttpV1Sandbox(baseTask(), ctx);
    const rejected = await executeIrrigationHttpV1Sandbox(baseTask({ device_id: 'reject-device', act_task_id: 'act_sandbox_reject', command_id: 'cmd_sandbox_reject' }), ctx);
    const missingDevice = await executeIrrigationHttpV1Sandbox(baseTask({ device_id: '', act_task_id: 'act_sandbox_missing_device', command_id: 'cmd_sandbox_missing_device' }), ctx);
    const missingOperationPlan = await executeIrrigationHttpV1Sandbox(baseTask({ operation_plan_id: '', act_task_id: 'act_sandbox_missing_plan', command_id: 'cmd_sandbox_missing_plan' }), ctx);
    const httpError = await executeIrrigationHttpV1Sandbox(baseTask({ act_task_id: 'act_sandbox_http_error', command_id: 'cmd_sandbox_http_error' }), { baseUrl: `${listener.baseUrl}/wrong`, token: SANDBOX_TOKEN });

    const cases = [
      { name: 'accepted_command', expected_status: 'SUCCEEDED', result: accepted },
      { name: 'device_reject', expected_code: 'DEVICE_REJECT', result: rejected },
      { name: 'missing_device_id', expected_code: 'MISSING_DEVICE_ID', result: missingDevice },
      { name: 'missing_operation_plan_id', expected_code: 'MISSING_OPERATION_PLAN_ID', result: missingOperationPlan },
      { name: 'http_error', expected_code: 'HTTP_ERROR', result: httpError },
    ];

    const failed = cases.filter((item) => {
      if (item.expected_status) return item.result.status !== item.expected_status;
      return String(item.result?.meta?.receipt_code ?? '') !== item.expected_code;
    });

    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(cases.map((item) => ({ name: item.name, status: item.result.status, code: item.result.meta?.receipt_code })))).digest('hex');

    return {
      ok: failed.length === 0,
      schema: HARNESS_SCHEMA,
      harness: 'irrigation_http_v1_sandbox_harness',
      bind_host: HOST,
      base_url: listener.baseUrl,
      live_device_connected: false,
      broker_connected: false,
      geox_server_called: false,
      db_mutated: false,
      receipt_created: false,
      roi_created: false,
      field_memory_created: false,
      model_updated: false,
      case_count: cases.length,
      failed_case_count: failed.length,
      failed_cases: failed.map((item) => item.name),
      captured_request_count: sandbox.capturedRequests.length,
      deterministic_case_hash: payloadHash,
      duration_ms: Math.max(0, Date.now() - startedAt),
      next_step: 'P2_04_PRODUCTION_INGESTION_ADAPTER_BOUNDARY',
    };
  } finally {
    await close(sandbox.server);
  }
}

if (require.main === module) {
  runHarness().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  }).catch((error) => {
    console.error(JSON.stringify({ ok: false, schema: HARNESS_SCHEMA, error: String(error.message ?? error) }, null, 2));
    process.exit(1);
  });
}

module.exports = {
  createSandboxServer,
  executeIrrigationHttpV1Sandbox,
  runHarness,
  validateSandboxTask,
};
