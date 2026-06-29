// scripts/governance_acceptance/P2_05_REAL_ADAPTER_NEGATIVE_RUNTIME_MATRIX.cjs
// Purpose: verify and run the P2-05 real adapter negative runtime matrix.
// Boundary: this acceptance runs only local repository checks and a 127.0.0.1 sandbox; it does not call GEOX server routes, mutate DB state, connect real devices, connect brokers, create receipts, create ROI, create Field Memory, or update models.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P2_05_REAL_ADAPTER_NEGATIVE_RUNTIME_MATRIX';

const FILES = {
  p204Doc: 'docs/tasks/P2-04-Production-Ingestion-Adapter-Boundary.md',
  p204Acceptance: 'scripts/governance_acceptance/P2_04_PRODUCTION_INGESTION_ADAPTER_BOUNDARY.cjs',
  p205Doc: 'docs/tasks/P2-05-Real-Adapter-Negative-Runtime-Matrix.md',
  manifest: 'docs/controlplane/GEOX-CP-RealAdapterNegativeRuntimeMatrix-v1.json',
  matrixRunner: 'scripts/p2_sandbox/real_adapter_negative_runtime_matrix.cjs',
  sandboxHarness: 'scripts/p2_sandbox/irrigation_http_v1_sandbox_harness.cjs',
};

const EXPECTED_CASES = [
  'registry_missing_adapter_type',
  'registry_duplicate_adapter_type',
  'registry_unknown_adapter_type',
  'dispatch_unsupported_action',
  'dispatch_adapter_validate_failed',
  'irrigation_real_missing_outbox_fact',
  'irrigation_real_missing_device',
  'irrigation_real_capability_missing',
  'mqtt_missing_outbox_fact',
  'mqtt_missing_topic',
  'mqtt_publish_failed',
  'irrigation_http_missing_device',
  'irrigation_http_missing_operation_plan',
  'irrigation_http_device_reject',
  'irrigation_http_transport_error',
  'production_ingestion_has_no_adapter_coupling',
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

function runMatrixProcess() {
  const output = childProcess.execFileSync(process.execPath, [FILES.matrixRunner], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 15000,
    env: {
      ...process.env,
      GEOX_P2_MATRIX_ACCEPTANCE: 'true',
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

  const p204Doc = read(FILES.p204Doc);
  const p204Acceptance = read(FILES.p204Acceptance);
  const p205Doc = read(FILES.p205Doc);
  const manifest = readJson(FILES.manifest);
  const matrixRunner = read(FILES.matrixRunner);

  assert('p204_completion_entry_verified', containsAll(p204Doc, ['P2-04 Production Ingestion Adapter Boundary', 'next_step = P2_05_REAL_ADAPTER_NEGATIVE_RUNTIME_MATRIX']) && containsAll(p204Acceptance, ['P2_04_PRODUCTION_INGESTION_ADAPTER_BOUNDARY', 'P2_05_REAL_ADAPTER_NEGATIVE_RUNTIME_MATRIX']), { files: [FILES.p204Doc, FILES.p204Acceptance] });
  assert('p205_doc_records_scope_and_boundary', containsAll(p205Doc, ['P2-05 Real Adapter Negative Runtime Matrix', 'real_adapter_negative_runtime_matrix.cjs', 'No live device integration.', 'No broker connection.', 'No DB mutation.', 'No model update.']), { file: FILES.p205Doc });
  assert('matrix_manifest_verified', manifest.schema === 'real_adapter_negative_runtime_matrix_v1' && manifest.version === '1.0.0' && manifest.task === 'P2-05 Real Adapter Negative Runtime Matrix' && manifest.next_step === 'P2_06_OPERATOR_CONTROLLED_PILOT_DRY_RUN', { file: FILES.manifest });
  assert('matrix_boundary_verified', manifest.boundary?.loopback_only === true && manifest.boundary?.no_live_device_integration === true && manifest.boundary?.no_broker_connection === true && manifest.boundary?.no_geox_server_route_call === true && manifest.boundary?.no_db_mutation === true && manifest.boundary?.no_model_update === true, { boundary: manifest.boundary });
  assert('matrix_case_count_declared', Array.isArray(manifest.matrix_cases) && manifest.matrix_cases.length === EXPECTED_CASES.length, { declared: manifest.matrix_cases?.length, expected: EXPECTED_CASES.length });

  for (const caseName of EXPECTED_CASES) {
    assert(`matrix_case_declared:${caseName}`, manifest.matrix_cases.some((item) => item.case === caseName) && p205Doc.includes(caseName), { caseName });
  }

  for (const [key, file] of Object.entries(manifest.source_files)) {
    assert(`matrix_source_file_exists:${key}`, fs.existsSync(abs(file)), { key, file });
  }

  assert('matrix_runner_static_verified', containsAll(matrixRunner, ['real_adapter_negative_runtime_matrix_v1', 'runMatrix', 'runtimeCases', 'staticRows', '127.0.0.1', 'live_device_connected: false', 'broker_connected: false', 'geox_server_called: false', 'db_mutated: false', 'model_updated: false']), { file: FILES.matrixRunner });

  const matrixResult = runMatrixProcess();
  assert('matrix_runtime_ok', matrixResult.ok === true, { matrixResult });
  assert('matrix_runtime_verified', matrixResult.schema === 'real_adapter_negative_runtime_matrix_v1' && matrixResult.matrix_case_count === EXPECTED_CASES.length && matrixResult.runtime_case_count === 4 && matrixResult.failed_case_count === 0, { matrixResult });
  assert('matrix_runtime_loopback_verified', matrixResult.bind_host === '127.0.0.1' && String(matrixResult.sandbox_base_url ?? '').startsWith('http://127.0.0.1:'), { matrixResult });
  assert('matrix_no_live_side_effects', matrixResult.live_device_connected === false && matrixResult.broker_connected === false && matrixResult.geox_server_called === false && matrixResult.db_mutated === false && matrixResult.receipt_created === false && matrixResult.roi_created === false && matrixResult.field_memory_created === false && matrixResult.model_updated === false, { matrixResult });
  assert('matrix_next_step_verified', matrixResult.next_step === 'P2_06_OPERATOR_CONTROLLED_PILOT_DRY_RUN', { matrixResult });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    matrix_manifest_verified: true,
    matrix_runtime_verified: true,
    matrix_case_count: matrixResult.matrix_case_count,
    runtime_case_count: matrixResult.runtime_case_count,
    static_case_count: matrixResult.static_case_count,
    failed_case_count: matrixResult.failed_case_count,
    deterministic_matrix_hash: matrixResult.deterministic_matrix_hash,
    live_device_connected: matrixResult.live_device_connected,
    broker_connected: matrixResult.broker_connected,
    geox_server_called: matrixResult.geox_server_called,
    db_mutated: matrixResult.db_mutated,
    no_live_adapter_started: true,
    ...assertionSummary(),
    next_step: 'P2_06_OPERATOR_CONTROLLED_PILOT_DRY_RUN',
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
