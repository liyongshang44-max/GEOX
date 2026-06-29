// scripts/governance_acceptance/P2_REAL_ADAPTER_INTEGRATION_PLANNING.cjs
// Purpose: verify P2 Real Adapter Integration planning and boundary inventory before any live adapter work begins.
// Boundary: static governance acceptance only; this script does not call runtime routes, mutate DB state, connect to devices, connect to brokers, dispatch tasks, create receipts, create ROI, create Field Memory, or update models.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const ACCEPTANCE = 'P2_REAL_ADAPTER_INTEGRATION_PLANNING';

const FILES = {
  taskLine: 'docs/tasks/POST-TWIN-KERNEL-V1-TASK-LINE.md',
  p1ReviewDoc: 'docs/tasks/P1-Completion-Review-Before-P2.md',
  p1ReviewAcceptance: 'scripts/governance_acceptance/P1_COMPLETION_REVIEW_BEFORE_P2.cjs',
  p2PlanningDoc: 'docs/tasks/P2-Real-Adapter-Integration-Planning.md',
  executorContract: 'packages/contracts/src/schema/executor_adapter_v1.ts',
  executorAdapterIndex: 'apps/executor/src/adapters/index.ts',
  executorAdapterRegistry: 'apps/executor/src/adapters/registry.ts',
  irrigationRealAdapter: 'apps/executor/src/adapters/irrigation_real_adapter.ts',
  mqttAdapter: 'apps/executor/src/adapters/mqtt.ts',
  executorRuntimeLoop: 'apps/executor/src/runtime_loop.ts',
  executorDispatchOnce: 'apps/executor/src/run_dispatch_once.ts',
  executorClaim: 'apps/executor/src/lib/claim.ts',
  executorDoc: 'docs/controlplane/GEOX-CP-AO-ACT-ExecutorAdapter-v0.md',
  productionIngestionRoute: 'apps/server/src/routes/v1/twin_kernel_production_ingestion.ts',
};

const P2_TASKS = [
  'P2-00 Real Adapter Integration Planning and Boundary Inventory',
  'P2-01 Adapter Contract Reconciliation',
  'P2-02 Adapter Capability Manifest and Registry Audit',
  'P2-03 Safe Real Adapter Sandbox Harness',
  'P2-04 Production Ingestion Adapter Boundary',
  'P2-05 Real Adapter Negative Runtime Matrix',
  'P2-06 Operator-Controlled Pilot Dry Run',
];

const ADAPTER_ASSETS = [
  'packages/contracts/src/schema/executor_adapter_v1.ts',
  'apps/executor/src/adapters/index.ts',
  'apps/executor/src/adapters/registry.ts',
  'apps/executor/src/adapters/irrigation_real_adapter.ts',
  'apps/executor/src/adapters/mqtt.ts',
  'apps/executor/src/runtime_loop.ts',
  'apps/executor/src/run_dispatch_once.ts',
  'apps/executor/src/lib/claim.ts',
  'docs/controlplane/GEOX-CP-AO-ACT-ExecutorAdapter-v0.md',
  'apps/server/src/routes/v1/twin_kernel_production_ingestion.ts',
];

const assertions = [];

function abs(file) {
  return path.resolve(ROOT, file);
}

function read(file) {
  return fs.readFileSync(abs(file), 'utf8');
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

  const taskLine = read(FILES.taskLine);
  const p1ReviewDoc = read(FILES.p1ReviewDoc);
  const p1ReviewAcceptance = read(FILES.p1ReviewAcceptance);
  const p2Doc = read(FILES.p2PlanningDoc);
  const contract = read(FILES.executorContract);
  const adapterIndex = read(FILES.executorAdapterIndex);
  const registry = read(FILES.executorAdapterRegistry);
  const irrigationReal = read(FILES.irrigationRealAdapter);
  const mqtt = read(FILES.mqttAdapter);
  const runtimeLoop = read(FILES.executorRuntimeLoop);
  const dispatchOnce = read(FILES.executorDispatchOnce);
  const claim = read(FILES.executorClaim);
  const executorDoc = read(FILES.executorDoc);
  const productionIngestion = read(FILES.productionIngestionRoute);

  assert('p1_review_verified', containsAll(p1ReviewDoc, ['P1_COMPLETION_REVIEW_BEFORE_P2', 'P2 may begin only after this review is merged and tagged']) && containsAll(p1ReviewAcceptance, ['P1_COMPLETION_REVIEW_BEFORE_P2', 'p1_completed: true']), { files: [FILES.p1ReviewDoc, FILES.p1ReviewAcceptance] });
  assert('task_line_records_p2_placeholder', containsAll(taskLine, ['P2 Real Adapter Integration', 'These should not begin until P1 has a completion review']), { file: FILES.taskLine });
  assert('p2_planning_doc_records_all_p2_tasks', containsAll(p2Doc, P2_TASKS), { file: FILES.p2PlanningDoc });
  assert('p2_planning_doc_records_entry_gate', containsAll(p2Doc, ['P1 Production Hardening is complete.', 'tag: p1_completion_review_before_p2', 'P2_REAL_ADAPTER_INTEGRATION_PLANNING']), { file: FILES.p2PlanningDoc });
  assert('p2_planning_doc_records_hard_boundaries', containsAll(p2Doc, ['No live device integration.', 'No real broker credential.', 'No scheduler.', 'No autonomous execution.', 'No automatic receipt creation.', 'No automatic ROI creation.', 'No automatic Field Memory creation.', 'No model update.']), { file: FILES.p2PlanningDoc });

  for (const asset of ADAPTER_ASSETS) assert(`adapter_asset_present:${asset}`, fs.existsSync(abs(asset)), { asset });

  assert('contract_package_shape_recorded', containsAll(contract, ['export type ExecutorAdapterV1', 'dispatch:', 'pollReceipt?', 'adapter_type', 'supports:', 'validate:']), { file: FILES.executorContract });
  assert('runtime_adapter_shape_recorded', containsAll(adapterIndex, ['export type ExecutorAdapterV1', 'execute(task', 'adapter_type', 'supports?', 'validate?']), { file: FILES.executorAdapterIndex });
  assert('contract_mismatch_recorded', containsAll(p2Doc, ['There are two adapter contract shapes', 'dispatch(task, ctx)', 'execute(task)', 'P2-01 Adapter Contract Reconciliation']), { file: FILES.p2PlanningDoc });
  assert('registry_records_current_adapters', containsAll(registry, ['createIrrigationRealAdapter', 'createIrrigationSimulatorAdapter', 'createMqttAdapter', 'createIrrigationHttpV1Adapter']), { file: FILES.executorAdapterRegistry });
  assert('irrigation_real_has_safety_validation', containsAll(irrigationReal, ['MISSING_OUTBOX_FACT_ID', 'MISSING_DEVICE_ID', 'DEVICE_CAPABILITY_MISSING_IRRIGATION', 'adapter_runtime: "irrigation_real_adapter_v1"']), { file: FILES.irrigationRealAdapter });
  assert('mqtt_adapter_has_publish_and_downlink_record', containsAll(mqtt, ['GEOX_MQTT_URL', 'PUBLISH_FAILED', 'publishDownlink', 'command_payload_sha256']), { file: FILES.mqttAdapter });
  assert('runtime_loop_records_supervised_loop', containsAll(runtimeLoop, ['executor runtime loop started', 'heartbeatOnce', 'runDispatchOnce', 'recordWorkerRuntimeHeartbeat']), { file: FILES.executorRuntimeLoop });
  assert('dispatch_once_records_claim_and_adapter_dispatch', containsAll(dispatchOnce, ['claimDispatchTasks', 'createAdapterRegistry', 'findAdapterByType', 'auto_evaluate=true requested, but executor keeps acceptance decoupled']), { file: FILES.executorDispatchOnce });
  assert('claim_records_dispatch_claim_endpoint', containsAll(claim, ['/api/v1/ao-act/dispatches/claim', 'lease_seconds', 'CLAIM_RETURNED_UNEXPECTED_TASK']), { file: FILES.executorClaim });
  assert('old_executor_doc_records_implementation_only_boundary', containsAll(executorDoc, ['Implementation-only', 'No scheduler', 'No server-side autostart', 'No new action types, no new schema fields, no contract edits']), { file: FILES.executorDoc });
  assert('production_ingestion_boundary_preserved', containsAll(productionIngestion, ['production_ingestion_only: true', 'automatic_recommendation_created: false', 'automatic_approval_created: false', 'automatic_task_created: false', 'automatic_receipt_created: false', 'automatic_acceptance_created: false', 'automatic_roi_created: false', 'automatic_field_memory_created: false', 'model_updated: false']), { file: FILES.productionIngestionRoute });
  assert('no_live_adapter_started_by_planning', !p2Doc.includes('live device credentials') && !p2Doc.includes('production broker password'), { file: FILES.p2PlanningDoc });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    p1_review_verified: true,
    p2_task_count: P2_TASKS.length,
    adapter_asset_count: ADAPTER_ASSETS.length,
    contract_mismatch_recorded: true,
    no_live_adapter_started: true,
    p2_started_as_planning_only: true,
    ...assertionSummary(),
    next_step: 'P2_01_ADAPTER_CONTRACT_RECONCILIATION',
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
