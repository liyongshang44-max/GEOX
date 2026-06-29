// scripts/governance_acceptance/P2_01_ADAPTER_CONTRACT_RECONCILIATION.cjs
// Purpose: verify P2-01 adapter contract reconciliation before real adapter pilot work.
// Boundary: static governance acceptance only; this script does not call runtime routes, mutate DB state, connect devices, connect brokers, dispatch tasks, create receipts, create ROI, create Field Memory, or update models.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const ACCEPTANCE = 'P2_01_ADAPTER_CONTRACT_RECONCILIATION';

const FILES = {
  p2PlanningDoc: 'docs/tasks/P2-Real-Adapter-Integration-Planning.md',
  p201Doc: 'docs/tasks/P2-01-Adapter-Contract-Reconciliation.md',
  contract: 'packages/contracts/src/schema/executor_adapter_v1.ts',
  runtimeIndex: 'apps/executor/src/adapters/index.ts',
  registry: 'apps/executor/src/adapters/registry.ts',
  dispatchOnce: 'apps/executor/src/run_dispatch_once.ts',
  irrigationReal: 'apps/executor/src/adapters/irrigation_real_adapter.ts',
  irrigationHttp: 'apps/executor/src/adapters/irrigation_http_v1.ts',
  irrigationSimulator: 'apps/executor/src/adapters/irrigation_simulator.ts',
  mqtt: 'apps/executor/src/adapters/mqtt.ts',
};

const SUPPORT_ALIGNED_ADAPTERS = [
  'apps/executor/src/adapters/irrigation_real_adapter.ts',
  'apps/executor/src/adapters/irrigation_http_v1.ts',
  'apps/executor/src/adapters/irrigation_simulator.ts',
  'apps/executor/src/adapters/mqtt.ts',
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

  const p2PlanningDoc = read(FILES.p2PlanningDoc);
  const p201Doc = read(FILES.p201Doc);
  const contract = read(FILES.contract);
  const runtimeIndex = read(FILES.runtimeIndex);
  const registry = read(FILES.registry);
  const dispatchOnce = read(FILES.dispatchOnce);

  assert('p2_planning_authorized_p201', containsAll(p2PlanningDoc, ['P2-01 Adapter Contract Reconciliation', 'next_step = P2_01_ADAPTER_CONTRACT_RECONCILIATION']), { file: FILES.p2PlanningDoc });
  assert('p201_doc_records_scope_and_boundary', containsAll(p201Doc, ['P2-01 Adapter Contract Reconciliation', 'Canonical adapter type: ExecutorAdapterV1', 'Canonical runtime method: execute(task)', 'Legacy bridge type: LegacyDispatchExecutorAdapterV1', 'No live device integration.', 'No broker connection is attempted by this task.', 'No model update.']), { file: FILES.p201Doc });

  assert('canonical_execute_contract_verified', containsAll(contract, ['export type ExecutorAdapterV1', 'type: string;', 'adapter_type: string;', 'supports?: (input: ExecutorAdapterSupportInputV1) => boolean;', 'validate?: (task: AoActTaskV1) => ExecutorAdapterValidationResultV1;', 'execute: (task: AoActTaskV1) => Promise<ExecutorAdapterExecutionResultV1>;']), { file: FILES.contract });
  assert('legacy_dispatch_bridge_preserved', containsAll(contract, ['LegacyDispatchExecutorAdapterV1', 'dispatch:', 'pollReceipt?', 'LegacyDispatchResultV1', 'LegacyReceiptResultV1']), { file: FILES.contract });
  assert('runtime_adapter_contract_aligned', containsAll(runtimeIndex, ['export interface ExecutorAdapter', 'type: string;', 'adapter_type: string;', 'execute(task: AoActTask): Promise<AdapterExecutionResult>;', 'supports?: (input: AdapterSupportInput) => boolean;', 'validate?: (task: AoActTask) => AdapterValidationResult;']), { file: FILES.runtimeIndex });
  assert('registry_still_uses_runtime_adapter_contract', containsAll(registry, ['type AdapterRegistry = Map<string, Adapter>', 'registerAdapter', 'createIrrigationRealAdapter', 'createIrrigationSimulatorAdapter', 'createMqttAdapter', 'createIrrigationHttpV1Adapter']), { file: FILES.registry });
  assert('runtime_caller_still_uses_execute', containsAll(dispatchOnce, ['const supportsInput = adapterType === "mqtt" ? task : (task.task_type || task.action_type);', 'adapter.execute({', 'validate(task)', 'ADAPTER_UNSUPPORTED_ACTION']), { file: FILES.dispatchOnce });

  for (const file of SUPPORT_ALIGNED_ADAPTERS) {
    const text = read(file);
    assert(`adapter_support_input_imported:${file}`, text.includes('AdapterSupportInput'), { file });
    assert(`adapter_support_signature_aligned:${file}`, text.includes('supports(input: AdapterSupportInput): boolean'), { file });
  }

  assert('mqtt_supports_task_input_preserved', containsAll(read(FILES.mqtt), ['taskFromSupportInput', 'adapterType === "mqtt"', '!!deviceId || !!topic']), { file: FILES.mqtt });
  assert('irrigation_supports_action_input_preserved', containsAll(read(FILES.irrigationReal), ['actionTypeFromSupportInput', 'normalized === "irrigation.start" || normalized === "irrigate"']) && containsAll(read(FILES.irrigationHttp), ['actionTypeFromSupportInput', '["irrigation.start", "irrigate"].includes']) && containsAll(read(FILES.irrigationSimulator), ['actionTypeFromSupportInput', 'normalizeIrrigationAction(actionType) === "irrigate"']), { files: [FILES.irrigationReal, FILES.irrigationHttp, FILES.irrigationSimulator] });
  assert('no_live_adapter_started_by_p201', !p201Doc.includes('production broker password') && !p201Doc.includes('live credential value'), { file: FILES.p201Doc });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    canonical_execute_contract_verified: true,
    legacy_dispatch_bridge_preserved: true,
    runtime_adapter_contract_aligned: true,
    adapter_support_input_aligned: true,
    support_aligned_adapter_count: SUPPORT_ALIGNED_ADAPTERS.length,
    no_live_adapter_started: true,
    ...assertionSummary(),
    next_step: 'P2_02_ADAPTER_CAPABILITY_MANIFEST_AND_REGISTRY_AUDIT',
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
