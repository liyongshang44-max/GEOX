// scripts/governance_acceptance/P2_02_ADAPTER_CAPABILITY_MANIFEST_AND_REGISTRY_AUDIT.cjs
// Purpose: verify P2-02 adapter capability manifest coverage against the executor registry and adapter source guards.
// Boundary: static governance acceptance only; this script does not call runtime routes, mutate DB state, connect devices, connect brokers, dispatch tasks, create receipts, create ROI, create Field Memory, or update models.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const ACCEPTANCE = 'P2_02_ADAPTER_CAPABILITY_MANIFEST_AND_REGISTRY_AUDIT';

const FILES = {
  p201Doc: 'docs/tasks/P2-01-Adapter-Contract-Reconciliation.md',
  p201Acceptance: 'scripts/governance_acceptance/P2_01_ADAPTER_CONTRACT_RECONCILIATION.cjs',
  p202Doc: 'docs/tasks/P2-02-Adapter-Capability-Manifest-and-Registry-Audit.md',
  manifest: 'docs/controlplane/GEOX-CP-ExecutorAdapterCapabilityManifest-v1.json',
  registry: 'apps/executor/src/adapters/registry.ts',
  dispatchOnce: 'apps/executor/src/run_dispatch_once.ts',
};

const EXPECTED_ADAPTER_TYPES = [
  'irrigation_real',
  'irrigation_simulator',
  'mqtt',
  'irrigation_http_v1',
];

const EXPECTED_FACTORIES = [
  'createIrrigationRealAdapter',
  'createIrrigationSimulatorAdapter',
  'createMqttAdapter',
  'createIrrigationHttpV1Adapter',
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

function unique(values) {
  return [...new Set(values)];
}

function sameSet(a, b) {
  const aa = unique(a).sort();
  const bb = unique(b).sort();
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

  const p201Doc = read(FILES.p201Doc);
  const p201Acceptance = read(FILES.p201Acceptance);
  const p202Doc = read(FILES.p202Doc);
  const manifest = readJson(FILES.manifest);
  const registry = read(FILES.registry);
  const dispatchOnce = read(FILES.dispatchOnce);

  assert('p201_completion_entry_verified', containsAll(p201Doc, ['P2-01 Adapter Contract Reconciliation', 'next_step = P2_02_ADAPTER_CAPABILITY_MANIFEST_AND_REGISTRY_AUDIT']) && containsAll(p201Acceptance, ['P2_01_ADAPTER_CONTRACT_RECONCILIATION', 'P2_02_ADAPTER_CAPABILITY_MANIFEST_AND_REGISTRY_AUDIT']), { files: [FILES.p201Doc, FILES.p201Acceptance] });
  assert('p202_doc_records_scope_and_boundary', containsAll(p202Doc, ['P2-02 Adapter Capability Manifest and Registry Audit', 'docs/controlplane/GEOX-CP-ExecutorAdapterCapabilityManifest-v1.json', 'No live device integration.', 'No broker connection is attempted by this task.', 'No model update.']), { file: FILES.p202Doc });

  assert('manifest_schema_verified', manifest.schema === 'executor_adapter_capability_manifest_v1' && manifest.version === '1.0.0' && manifest.task === 'P2-02 Adapter Capability Manifest and Registry Audit', { file: FILES.manifest });
  assert('manifest_boundary_verified', manifest.boundary?.no_live_device_integration === true && manifest.boundary?.no_broker_connection_attempted_by_manifest === true && manifest.boundary?.no_production_credential === true && manifest.boundary?.no_model_update === true, { file: FILES.manifest });

  const manifestAdapterTypes = Array.isArray(manifest.adapters) ? manifest.adapters.map((item) => item.adapter_type) : [];
  const manifestFactories = Array.isArray(manifest.adapters) ? manifest.adapters.map((item) => item.factory) : [];
  assert('manifest_adapter_type_set_verified', sameSet(manifestAdapterTypes, EXPECTED_ADAPTER_TYPES), { manifestAdapterTypes, expected: EXPECTED_ADAPTER_TYPES });
  assert('manifest_factory_set_verified', sameSet(manifestFactories, EXPECTED_FACTORIES), { manifestFactories, expected: EXPECTED_FACTORIES });
  assert('registry_manifest_expected_adapter_types_verified', sameSet(manifest.registry?.expected_adapter_types ?? [], EXPECTED_ADAPTER_TYPES), { registry: manifest.registry });
  assert('registry_manifest_expected_factories_verified', sameSet(manifest.registry?.expected_factories ?? [], EXPECTED_FACTORIES), { registry: manifest.registry });

  for (const factory of EXPECTED_FACTORIES) {
    assert(`registry_contains_factory:${factory}`, registry.includes(factory), { factory, file: FILES.registry });
  }
  assert('registry_negative_checks_verified', containsAll(registry, ['ADAPTER_TYPE_REQUIRED', 'ADAPTER_ALREADY_REGISTERED', 'ADAPTER_NOT_FOUND']), { file: FILES.registry });
  assert('runtime_dispatch_guard_verified', containsAll(dispatchOnce, ['ADAPTER_UNSUPPORTED_ACTION', 'ADAPTER_VALIDATE_FAILED', 'findAdapterByType', 'adapter.execute({']), { file: FILES.dispatchOnce });

  for (const adapter of manifest.adapters) {
    assert(`adapter_source_exists:${adapter.adapter_type}`, typeof adapter.source_file === 'string' && fs.existsSync(abs(adapter.source_file)), { adapter_type: adapter.adapter_type, source_file: adapter.source_file });
    const source = read(adapter.source_file);
    assert(`adapter_source_declares_adapter_type:${adapter.adapter_type}`, source.includes(`adapter_type: "${adapter.adapter_type}"`), { adapter_type: adapter.adapter_type, source_file: adapter.source_file });
    assert(`adapter_source_declares_factory:${adapter.adapter_type}`, source.includes(`function ${adapter.factory}`), { adapter_type: adapter.adapter_type, factory: adapter.factory, source_file: adapter.source_file });
    assert(`adapter_source_has_support_input:${adapter.adapter_type}`, source.includes('supports(input: AdapterSupportInput): boolean'), { adapter_type: adapter.adapter_type, source_file: adapter.source_file });
    assert(`adapter_manifest_has_capabilities:${adapter.adapter_type}`, Array.isArray(adapter.capabilities) && adapter.capabilities.length >= 1, { adapter_type: adapter.adapter_type });
    assert(`adapter_manifest_has_supported_actions:${adapter.adapter_type}`, Array.isArray(adapter.supported_action_types) && adapter.supported_action_types.length >= 1, { adapter_type: adapter.adapter_type });
    assert(`adapter_manifest_has_required_fields:${adapter.adapter_type}`, Array.isArray(adapter.required_task_fields) && adapter.required_task_fields.length >= 1, { adapter_type: adapter.adapter_type });
    assert(`adapter_manifest_has_negative_checks:${adapter.adapter_type}`, Array.isArray(adapter.negative_checks) && adapter.negative_checks.length >= 2, { adapter_type: adapter.adapter_type });
    for (const check of adapter.negative_checks) {
      assert(`adapter_negative_check_token:${adapter.adapter_type}:${check.case}`, typeof check.source_token === 'string' && source.includes(check.source_token), { adapter_type: adapter.adapter_type, check, source_file: adapter.source_file });
    }
  }

  const allManifestNegativeCases = manifest.adapters.flatMap((adapter) => adapter.negative_checks.map((check) => check.case));
  assert('required_negative_case_families_verified', containsAll(allManifestNegativeCases.join('\n'), ['missing_outbox_fact_id', 'missing_device_id', 'missing_topic', 'missing_operation_plan_id', 'publish_failed', 'http_error', 'unsupported_action_type']), { cases: allManifestNegativeCases });
  assert('no_live_adapter_started_by_p202', !p202Doc.includes('production broker password') && !p202Doc.includes('live credential value'), { file: FILES.p202Doc });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    manifest_schema_verified: true,
    registry_manifest_coverage_verified: true,
    adapter_source_negative_checks_verified: true,
    runtime_dispatch_guard_verified: true,
    adapter_type_count: manifestAdapterTypes.length,
    registry_negative_check_count: manifest.registry.negative_checks.length,
    no_live_adapter_started: true,
    ...assertionSummary(),
    next_step: 'P2_03_SAFE_REAL_ADAPTER_SANDBOX_HARNESS',
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
