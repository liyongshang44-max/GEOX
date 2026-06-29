// scripts/governance_acceptance/P2_03_SAFE_REAL_ADAPTER_SANDBOX_HARNESS.cjs
// Purpose: verify the P2-03 safe real adapter sandbox harness and execute its local-only runtime check.
// Boundary: this acceptance runs only a local 127.0.0.1 sandbox harness; it does not call GEOX server routes, mutate DB state, connect real devices, connect brokers, dispatch real tasks, create receipts, create ROI, create Field Memory, or update models.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P2_03_SAFE_REAL_ADAPTER_SANDBOX_HARNESS';

const FILES = {
  p202Doc: 'docs/tasks/P2-02-Adapter-Capability-Manifest-and-Registry-Audit.md',
  p202Acceptance: 'scripts/governance_acceptance/P2_02_ADAPTER_CAPABILITY_MANIFEST_AND_REGISTRY_AUDIT.cjs',
  p203Doc: 'docs/tasks/P2-03-Safe-Real-Adapter-Sandbox-Harness.md',
  manifest: 'docs/controlplane/GEOX-CP-ExecutorAdapterCapabilityManifest-v1.json',
  sourceAdapter: 'apps/executor/src/adapters/irrigation_http_v1.ts',
  harness: 'scripts/p2_sandbox/irrigation_http_v1_sandbox_harness.cjs',
};

const EXPECTED_CASES = [
  'accepted_command',
  'device_reject',
  'missing_device_id',
  'missing_operation_plan_id',
  'http_error',
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

function runHarnessProcess() {
  const output = childProcess.execFileSync(process.execPath, [FILES.harness], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 15000,
    env: {
      ...process.env,
      GEOX_P2_SANDBOX_ACCEPTANCE: 'true',
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

  const p202Doc = read(FILES.p202Doc);
  const p202Acceptance = read(FILES.p202Acceptance);
  const p203Doc = read(FILES.p203Doc);
  const manifest = readJson(FILES.manifest);
  const sourceAdapter = read(FILES.sourceAdapter);
  const harness = read(FILES.harness);

  assert('p202_completion_entry_verified', containsAll(p202Doc, ['P2-02 Adapter Capability Manifest and Registry Audit', 'next_step = P2_03_SAFE_REAL_ADAPTER_SANDBOX_HARNESS']) && containsAll(p202Acceptance, ['P2_02_ADAPTER_CAPABILITY_MANIFEST_AND_REGISTRY_AUDIT', 'P2_03_SAFE_REAL_ADAPTER_SANDBOX_HARNESS']), { files: [FILES.p202Doc, FILES.p202Acceptance] });
  assert('p203_doc_records_scope_and_boundary', containsAll(p203Doc, ['P2-03 Safe Real Adapter Sandbox Harness', 'scripts/p2_sandbox/irrigation_http_v1_sandbox_harness.cjs', 'No live device integration.', 'No broker connection.', 'No GEOX server route call.', 'No DB mutation.', 'No model update.']), { file: FILES.p203Doc });
  assert('manifest_authorizes_irrigation_http_sandbox_next_step', manifest.next_step === 'P2_03_SAFE_REAL_ADAPTER_SANDBOX_HARNESS' && manifest.adapters.some((adapter) => adapter.adapter_type === 'irrigation_http_v1' && adapter.live_effect_boundary.includes('P2-03 sandbox harness acceptance')), { file: FILES.manifest });
  assert('source_adapter_target_verified', containsAll(sourceAdapter, ['adapter_type: "irrigation_http_v1"', 'GEOX_IRRIGATION_HTTP_MOCK_URL', 'MISSING_DEVICE_ID', 'MISSING_OPERATION_PLAN_ID', 'HTTP_ERROR']), { file: FILES.sourceAdapter });

  assert('sandbox_harness_static_verified', containsAll(harness, ['safe_real_adapter_sandbox_harness_v1', "const HOST = '127.0.0.1';", 'createSandboxServer', 'executeIrrigationHttpV1Sandbox', 'live_device_connected: false', 'broker_connected: false', 'db_mutated: false', 'receipt_created: false', 'model_updated: false']), { file: FILES.harness });
  for (const caseName of EXPECTED_CASES) {
    assert(`sandbox_harness_case_declared:${caseName}`, harness.includes(caseName), { caseName, file: FILES.harness });
  }

  const harnessResult = runHarnessProcess();
  assert('sandbox_harness_runtime_ok', harnessResult.ok === true, { harnessResult });
  assert('sandbox_harness_schema_verified', harnessResult.schema === 'safe_real_adapter_sandbox_harness_v1', { harnessResult });
  assert('sandbox_harness_runtime_verified', harnessResult.case_count === EXPECTED_CASES.length && harnessResult.failed_case_count === 0 && harnessResult.captured_request_count >= 2, { harnessResult });
  assert('sandbox_harness_bound_to_loopback', harnessResult.bind_host === '127.0.0.1' && String(harnessResult.base_url ?? '').startsWith('http://127.0.0.1:'), { harnessResult });
  assert('sandbox_harness_no_live_side_effects', harnessResult.live_device_connected === false && harnessResult.broker_connected === false && harnessResult.geox_server_called === false && harnessResult.db_mutated === false && harnessResult.receipt_created === false && harnessResult.roi_created === false && harnessResult.field_memory_created === false && harnessResult.model_updated === false, { harnessResult });
  assert('sandbox_harness_next_step_verified', harnessResult.next_step === 'P2_04_PRODUCTION_INGESTION_ADAPTER_BOUNDARY', { harnessResult });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    sandbox_harness_static_verified: true,
    sandbox_harness_runtime_verified: true,
    sandbox_case_count: harnessResult.case_count,
    captured_request_count: harnessResult.captured_request_count,
    deterministic_case_hash: harnessResult.deterministic_case_hash,
    live_device_connected: harnessResult.live_device_connected,
    broker_connected: harnessResult.broker_connected,
    geox_server_called: harnessResult.geox_server_called,
    db_mutated: harnessResult.db_mutated,
    no_live_adapter_started: true,
    ...assertionSummary(),
    next_step: 'P2_04_PRODUCTION_INGESTION_ADAPTER_BOUNDARY',
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
