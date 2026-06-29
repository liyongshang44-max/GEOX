// scripts/governance_acceptance/P2_04_PRODUCTION_INGESTION_ADAPTER_BOUNDARY.cjs
// Purpose: verify the P2-04 boundary between production ingestion and executor adapter integration.
// Boundary: static governance acceptance only; this script does not call runtime routes, mutate DB state, connect devices, connect brokers, dispatch tasks, create receipts, create ROI, create Field Memory, or update models.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const ACCEPTANCE = 'P2_04_PRODUCTION_INGESTION_ADAPTER_BOUNDARY';

const FILES = {
  p203Doc: 'docs/tasks/P2-03-Safe-Real-Adapter-Sandbox-Harness.md',
  p203Acceptance: 'scripts/governance_acceptance/P2_03_SAFE_REAL_ADAPTER_SANDBOX_HARNESS.cjs',
  p204Doc: 'docs/tasks/P2-04-Production-Ingestion-Adapter-Boundary.md',
  boundaryManifest: 'docs/controlplane/GEOX-CP-ProductionIngestionAdapterBoundary-v1.json',
  route: 'apps/server/src/routes/v1/twin_kernel_production_ingestion.ts',
};

const EXPECTED_ALLOWED_WRITES = [
  'production_ingestion_event_v0',
  'decision_cycle_v1',
];

const EXPECTED_POINTER_REFS = [
  'recommendation_id',
  'approval_id',
  'operation_plan_id',
  'act_task_id',
  'receipt_id',
  'as_executed_id',
  'acceptance_id',
  'post_irrigation_verification_id',
];

const REQUIRED_FALSE_RESPONSE_FLAGS = [
  'downstream_write_ready: false',
  'automatic_business_decision_created: false',
  'automatic_recommendation_created: false',
  'automatic_approval_created: false',
  'automatic_task_created: false',
  'automatic_receipt_created: false',
  'automatic_acceptance_created: false',
  'automatic_roi_created: false',
  'automatic_field_memory_created: false',
  'model_update_created: false',
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

function tableSetFromInsertStatements(text) {
  const out = [];
  const re = /INSERT\s+INTO\s+([a-zA-Z0-9_]+)/gi;
  let match;
  while ((match = re.exec(text)) !== null) out.push(match[1]);
  return [...new Set(out)].sort();
}

function sameSet(a, b) {
  const aa = [...new Set(a)].sort();
  const bb = [...new Set(b)].sort();
  return aa.length === bb.length && aa.every((value, index) => value === bb[index]);
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

  const p203Doc = read(FILES.p203Doc);
  const p203Acceptance = read(FILES.p203Acceptance);
  const p204Doc = read(FILES.p204Doc);
  const manifest = readJson(FILES.boundaryManifest);
  const route = read(FILES.route);

  assert('p203_completion_entry_verified', containsAll(p203Doc, ['P2-03 Safe Real Adapter Sandbox Harness', 'next_step = P2_04_PRODUCTION_INGESTION_ADAPTER_BOUNDARY']) && containsAll(p203Acceptance, ['P2_03_SAFE_REAL_ADAPTER_SANDBOX_HARNESS', 'P2_04_PRODUCTION_INGESTION_ADAPTER_BOUNDARY']), { files: [FILES.p203Doc, FILES.p203Acceptance] });
  assert('p204_doc_records_scope_and_boundary', containsAll(p204Doc, ['P2-04 Production Ingestion Adapter Boundary', 'GEOX-CP-ProductionIngestionAdapterBoundary-v1.json', 'P2-04 does not change the route implementation.', 'No adapter invocation.', 'No model update.']), { file: FILES.p204Doc });

  assert('production_ingestion_boundary_manifest_verified', manifest.schema === 'production_ingestion_adapter_boundary_v1' && manifest.version === '1.0.0' && manifest.task === 'P2-04 Production Ingestion Adapter Boundary' && manifest.next_step === 'P2_05_REAL_ADAPTER_NEGATIVE_RUNTIME_MATRIX', { file: FILES.boundaryManifest });
  assert('route_identity_verified', manifest.route?.source_file === FILES.route && manifest.route?.method === 'POST' && manifest.route?.path === '/api/v1/twin-kernel/production-ingestion/source-refs', { route: manifest.route });
  assert('manifest_boundary_flags_verified', manifest.boundary?.no_adapter_invocation === true && manifest.boundary?.no_live_device_integration === true && manifest.boundary?.no_broker_connection === true && manifest.boundary?.no_executor_runtime_start === true && manifest.boundary?.no_model_update === true, { boundary: manifest.boundary });

  const allowedWrites = (manifest.allowed_writes ?? []).map((item) => item.table);
  assert('manifest_allowed_write_surface_verified', sameSet(allowedWrites, EXPECTED_ALLOWED_WRITES), { allowedWrites, expected: EXPECTED_ALLOWED_WRITES });
  const routeInsertTables = tableSetFromInsertStatements(route);
  assert('route_insert_surface_verified', sameSet(routeInsertTables, EXPECTED_ALLOWED_WRITES), { routeInsertTables, expected: EXPECTED_ALLOWED_WRITES });
  assert('route_boundary_comment_verified', containsAll(route, ['Boundary: this route stores source refs and creates only a decision-cycle mapping object', 'does not create recommendations, approvals, operation plans, AO-ACT tasks, receipts, acceptance records, ROI entries, Field Memory entries, automatic downstream actions, production policy, or model updates']), { file: FILES.route });

  for (const pointerRef of EXPECTED_POINTER_REFS) {
    assert(`pointer_only_ref_verified:${pointerRef}`, route.includes(pointerRef) && String(JSON.stringify(manifest.pointer_only_semantics)).includes(pointerRef), { pointerRef });
  }
  assert('roi_and_field_memory_forced_null', containsAll(route, ['roi_entry_id: null', 'field_memory_id: null']) && manifest.pointer_only_semantics?.roi_entry_id?.includes('forced null') && manifest.pointer_only_semantics?.field_memory_id?.includes('forced null'), { file: FILES.route });

  assert('required_response_flags_verified', containsAll(route, REQUIRED_FALSE_RESPONSE_FLAGS), { flags: REQUIRED_FALSE_RESPONSE_FLAGS });
  assert('required_boundary_flags_json_verified', containsAll(route, ['production_ingestion_only: true', 'automatic_recommendation_created: false', 'automatic_approval_created: false', 'automatic_task_created: false', 'automatic_receipt_created: false', 'automatic_acceptance_created: false', 'automatic_roi_created: false', 'automatic_field_memory_created: false', 'model_updated: false']), { file: FILES.route });

  for (const forbiddenToken of manifest.forbidden_runtime_import_tokens ?? []) {
    assert(`forbidden_runtime_coupling_absent:${forbiddenToken}`, !route.includes(forbiddenToken), { forbiddenToken, file: FILES.route });
  }
  for (const forbiddenWriteToken of manifest.forbidden_write_tokens ?? []) {
    assert(`forbidden_write_absent:${forbiddenWriteToken}`, !route.toLowerCase().includes(String(forbiddenWriteToken).toLowerCase()), { forbiddenWriteToken, file: FILES.route });
  }

  assert('no_adapter_execution_surface_introduced', !containsAll(route, ['adapter.execute', 'publishMqtt', 'connectMqtt', 'runDispatchOnce']), { file: FILES.route });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    production_ingestion_boundary_manifest_verified: true,
    allowed_write_surface_verified: true,
    pointer_only_refs_verified: true,
    forbidden_adapter_coupling_absent: true,
    route_insert_table_count: routeInsertTables.length,
    no_live_adapter_started: true,
    ...assertionSummary(),
    next_step: 'P2_05_REAL_ADAPTER_NEGATIVE_RUNTIME_MATRIX',
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
