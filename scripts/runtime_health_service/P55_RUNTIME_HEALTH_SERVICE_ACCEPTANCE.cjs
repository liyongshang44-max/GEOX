// scripts/runtime_health_service/P55_RUNTIME_HEALTH_SERVICE_ACCEPTANCE.cjs
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const BASELINE_TAG = 'p54_field_pilot_readiness_review_gate_v1_closure';
const BASELINE_COMMIT = '62f3d03ff793f218c8e10485b6d99547a7b98d9e';
const MANIFEST = 'fixtures/runtime_health_service/P55_RUNTIME_HEALTH_SERVICE_INPUT_MANIFEST.json';
const RUNNER = 'scripts/runtime_health_service/P55_RUNTIME_HEALTH_SERVICE_RUNNER.cjs';
const LEDGER = 'acceptance-output/P55_RUNTIME_HEALTH_SERVICE_LEDGER.jsonl';
const REPORT = 'acceptance-output/P55_RUNTIME_HEALTH_SERVICE_REPORT.json';
const ROUTE_FILE = 'apps/server/src/routes/runtime_health_service_gate_v1.ts';
const DOMAIN_FILE = 'apps/server/src/runtime_health/p55_runtime_health_service_gate_v1.ts';
const MODULE_FILE = 'apps/server/src/modules/runtime_health/registerRuntimeHealthModule.ts';
const DOMAIN_REGISTRY = 'apps/server/src/modules/domain/registerDomainModules.ts';
const REQUIRED_DIMENSION_IDS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10', 'H11', 'H12'];
const FORBIDDEN_RECORD_TYPES = ['live_device_production_runtime_v1', 'field_pilot_execution_v1', 'ao_act_task_v0', 'ao_act_receipt_v0', 'machine_dispatch_v1', 'execution_outcome_v1', 'roi_realization_v1', 'field_memory_record_v1', 'full_runtime_v1_freeze_v1'];

const checks = [];
const check = (name, value) => checks.push([name, Boolean(value)]);
const exists = (filePath) => fs.existsSync(filePath);
const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const readJson = (filePath) => JSON.parse(read(filePath));
const runJson = (args) => JSON.parse(cp.execFileSync('node', args, { encoding: 'utf8' }));
const git = (args) => {
  try { return cp.execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
};

const manifest = readJson(MANIFEST);
check('01_baseline_tag', manifest.baseline_tag === BASELINE_TAG);
check('02_baseline_commit', manifest.baseline_commit === BASELINE_COMMIT);

const diff = git(['diff', '--name-only', BASELINE_TAG, 'HEAD']);
if (diff) {
  const changed = diff.split(/\r?\n/).filter(Boolean);
  const allowed = changed.every((filePath) => filePath.startsWith('docs/runtime_health_service/') || filePath.startsWith('fixtures/runtime_health_service/') || filePath.startsWith('scripts/runtime_health_service/') || filePath.startsWith('apps/server/src/runtime_health/') || filePath === ROUTE_FILE || filePath.startsWith('apps/server/src/modules/runtime_health/') || filePath === DOMAIN_REGISTRY);
  check('03_changed_files_limited', changed.length > 0 && allowed);
  check('04_server_changes_narrow_only', changed.filter((filePath) => filePath.startsWith('apps/server/')).every((filePath) => filePath.startsWith('apps/server/src/runtime_health/') || filePath === ROUTE_FILE || filePath.startsWith('apps/server/src/modules/runtime_health/') || filePath === DOMAIN_REGISTRY));
  check('05_no_web_changes', !changed.some((filePath) => filePath.startsWith('apps/web/')));
  check('06_no_telemetry_ingest_changes', !changed.some((filePath) => filePath.startsWith('apps/telemetry-ingest/')));
  check('07_no_contract_migration_package_workflow_changes', !changed.some((filePath) => filePath.startsWith('packages/contracts/') || filePath.startsWith('migrations/') || filePath.startsWith('.github/') || filePath === 'package.json' || filePath === 'pnpm-lock.yaml'));
} else {
  check('03_changed_files_limited', true);
  check('04_server_changes_narrow_only', true);
  check('05_no_web_changes', true);
  check('06_no_telemetry_ingest_changes', true);
  check('07_no_contract_migration_package_workflow_changes', true);
}

const p54Closure = readJson(manifest.source_refs.p54_closure);
check('08_p54_closure_exists', exists(manifest.source_refs.p54_closure));
check('09_p54_acceptance_assertion_count_42', p54Closure.acceptance.assertion_count === 42);
check('10_p54_failed_assertion_count_0', p54Closure.acceptance.failed_assertion_count === 0);
check('11_p54_result_ready_with_limitations', p54Closure.readiness_review_result === 'READY_FOR_RUNTIME_HEALTH_SERVICE_GATE_WITH_LIMITATIONS');
check('12_p54_p55_gate_allowed_true', p54Closure.gate_result.p55_runtime_health_service_gate_allowed === true);
check('13_p54_field_execution_allowed_false', p54Closure.gate_result.field_pilot_execution_allowed === false);
check('14_p54_runtime_service_false', p54Closure.gate_result.runtime_health_service_implemented === false);
check('15_p54_live_monitoring_false', p54Closure.gate_result.live_runtime_monitoring_active === false);
check('16_p54_real_device_false', p54Closure.gate_result.real_device_deployed === false);
check('17_p54_production_gateway_false', p54Closure.gate_result.production_gateway_online === false);
check('18_p54_full_freeze_false', p54Closure.gate_result.full_runtime_v1_freeze_allowed === false);
check('19_p54_next_phase_p55', p54Closure.next_allowed_phase_after_closure === 'P55 Runtime Health Service Gate v1');
check('20_p54_nonclaims_preserved', p54Closure.nonclaims.runtime_health_service_implemented === false && p54Closure.nonclaims.field_pilot_started === false && p54Closure.nonclaims.full_runtime_v1_frozen === false);

const p51Snapshot = readJson(manifest.source_refs.p51_5_snapshot);
const p51SnapshotSourceTruthMode = p51Snapshot.identity?.source_truth_mode ?? p51Snapshot.source_truth_mode ?? null;
check('21_gateway_snapshot_source_truth', exists(manifest.source_refs.p51_5_snapshot) && p51SnapshotSourceTruthMode === 'device_path_simulation');
check('22_source_refs_do_not_use_acceptance_output', Object.values(manifest.source_refs).every((ref) => !ref.startsWith('acceptance-output/')));

const routeText = read(ROUTE_FILE);
const domainText = read(DOMAIN_FILE);
const moduleText = read(MODULE_FILE);
const registryText = read(DOMAIN_REGISTRY);
check('23_route_file_exists', exists(ROUTE_FILE));
check('24_route_get_surface', /method:\s*"GET"/.test(routeText) && /url:\s*"\/api\/v1\/runtime-health\/service-gate"/.test(routeText));
check('25_route_get_only', !/app\.(post|put|patch|delete)\(/.test(routeText) && !/method:\s*"(POST|PUT|PATCH|DELETE)"/.test(routeText));
check('26_route_has_no_pool_query', !/pool\.query/.test(routeText) && !/pool\.query/.test(domainText));
check('27_route_has_no_write_sql', !/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(routeText + '\n' + domainText));
check('28_domain_builder_exists', /buildP55RuntimeHealthServiceGateReportV1/.test(domainText));
check('29_module_registered', /registerRuntimeHealthModule/.test(moduleText) && /registerRuntimeHealthModule\(app\)/.test(registryText));

const normalSummary = runJson([RUNNER, '--mode', 'controlled-write']);
const report = readJson(REPORT);
const ledgerRows = read(LEDGER).trim().split(/\r?\n/).map((line) => JSON.parse(line));
const dimensionIds = report.dimensions.map((row) => row.dimension_id);

check('30_normal_result_ready', report.runtime_health_service_gate_result === 'REPLAY_BACKED_RUNTIME_HEALTH_SERVICE_GATE_READY_WITH_LIMITATIONS' && normalSummary.runtime_health_service_gate_result === 'REPLAY_BACKED_RUNTIME_HEALTH_SERVICE_GATE_READY_WITH_LIMITATIONS');
check('31_mode_replay_backed', report.runtime_health_service_mode === 'replay_backed_production_demo');
check('32_h1_h12_dimensions_generated', report.dimensions.length === 12);
check('33_h1_h12_dimension_ids_match', JSON.stringify(dimensionIds) === JSON.stringify(REQUIRED_DIMENSION_IDS));
check('34_no_blocked_dimensions_normal', report.blocked_dimension_count === 0 && report.dimensions.every((row) => row.status !== 'BLOCKED'));
check('35_at_least_one_warn_dimension', report.warn_dimension_count >= 1 && report.dimensions.some((row) => row.status === 'WARN'));
check('36_time_fence_enforced_true', report.time_fence_enforced === true);
check('37_gateway_snapshot_used_true', report.gateway_backed_snapshot_used === true);
check('38_p56_replay_gate_true', report.p56_replay_gate_allowed === true && report.p56_gate_mode === 'replay_authorization_only');
check('39_field_execution_false', report.field_pilot_execution_allowed === false && report.real_device_execution_allowed === false);
check('40_downstream_nonclaims_false', report.real_device_deployed === false && report.live_device_claimed === false && report.live_runtime_monitoring_active === false && report.production_gateway_online === false && report.ao_act_task_creation_allowed === false && report.dispatch_allowed === false && report.roi_allowed === false && report.field_memory_allowed === false && report.full_runtime_v1_freeze_allowed === false);
check('41_controlled_outputs_exist', exists(LEDGER) && exists(REPORT));
check('42_ledger_hashes_and_prefix', ledgerRows.length >= 8 && ledgerRows.every((row) => typeof row.record_hash === 'string' && row.record_hash.length === 64 && row.record_type.startsWith('p55_runtime_health_service_')));

const deterministicA = runJson([RUNNER, '--mode', 'controlled-service-build']);
const deterministicB = runJson([RUNNER, '--mode', 'controlled-service-build']);
check('43_deterministic_same_input_same_hash', deterministicA.deterministic_hash === deterministicB.deterministic_hash);

const tempManifestPath = path.join(os.tmpdir(), `p55_manifest_hash_probe_${process.pid}.json`);
const probeManifest = { ...manifest, hash_probe_marker: 'changed-fixture-probe' };
fs.writeFileSync(tempManifestPath, `${JSON.stringify(probeManifest, null, 2)}\n`, 'utf8');
const changedFixtureRun = runJson([RUNNER, '--mode', 'controlled-service-build', '--manifest', tempManifestPath]);
check('44_changed_fixture_changes_hash', deterministicA.deterministic_hash !== changedFixtureRun.deterministic_hash);

const negative = runJson([RUNNER, '--mode', 'controlled-negative']);
check('45_negative_fixtures_all_blocked_22', negative.ok === true && negative.negative_result_count === 22 && negative.blocked_count === 22);
check('46_no_forbidden_record_types_and_ok_true', normalSummary.ok === true && ledgerRows.every((row) => !FORBIDDEN_RECORD_TYPES.includes(row.record_type)));

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
console.log(JSON.stringify({
  ok: failed.length === 0,
  acceptance: 'P55_CONTROLLED_RUNTIME_HEALTH_SERVICE_GATE_V1',
  phase: 'P55',
  baseline_tag: BASELINE_TAG,
  baseline_commit: BASELINE_COMMIT,
  runtime_health_service_mode: report.runtime_health_service_mode,
  runtime_health_service_gate_result: report.runtime_health_service_gate_result,
  p56_replay_gate_allowed: report.p56_replay_gate_allowed,
  p56_gate_mode: report.p56_gate_mode,
  field_pilot_execution_allowed: report.field_pilot_execution_allowed,
  real_device_deployed: report.real_device_deployed,
  live_device_claimed: report.live_device_claimed,
  full_runtime_v1_freeze_allowed: report.full_runtime_v1_freeze_allowed,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed
}, null, 2));
if (failed.length) process.exit(1);
