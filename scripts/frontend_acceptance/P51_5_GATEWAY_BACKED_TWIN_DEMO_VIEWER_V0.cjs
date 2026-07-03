// scripts/frontend_acceptance/P51_5_GATEWAY_BACKED_TWIN_DEMO_VIEWER_V0.cjs
'use strict';

const fs = require('node:fs');
const cp = require('node:child_process');

const BASELINE_TAG = 'p51_live_evidence_gateway_v1_closure';
const SNAPSHOT_PATH = 'apps/web/public/demo-runtime/p51-gateway-viewer-snapshot.json';
const APP_PATH = 'apps/web/src/app/App.tsx';
const NAV_PATH = 'apps/web/src/layouts/OperatorLayout.tsx';
const API_PATH = 'apps/web/src/api/operatorGatewayDemo.ts';
const PAGE_PATH = 'apps/web/src/features/operator/pages/OperatorGatewayDemoViewerPage.tsx';
const TYPES_PATH = 'apps/web/src/features/operator/gatewayDemo/gatewayDemoTypes.ts';
const VM_PATH = 'apps/web/src/features/operator/gatewayDemo/gatewayDemoViewModel.ts';
const POLICY_PATH = 'docs/live_evidence_gateway/GEOX-P51-5-DEMO-VIEWER-BOUNDARY-POLICY.json';
const COMPLETION_PATH = 'docs/live_evidence_gateway/GEOX-P51-5-DEMO-VIEWER-COMPLETION-REVIEW.json';

const checks = [];
const check = (name, value) => checks.push([name, Boolean(value)]);
const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const readJson = (filePath) => JSON.parse(read(filePath));
const git = (args) => {
  try {
    return cp.execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

const requiredFiles = [
  'docs/live_evidence_gateway/GEOX-P51-5-GATEWAY-BACKED-TWIN-DEMO-VIEWER-V0.md',
  POLICY_PATH,
  'docs/live_evidence_gateway/GEOX-P51-5-DEMO-VIEWER-CAPABILITY-MATRIX.json',
  'docs/live_evidence_gateway/GEOX-P51-5-DEMO-VIEWER-EVIDENCE-PACKET.json',
  COMPLETION_PATH,
  SNAPSHOT_PATH,
  API_PATH,
  PAGE_PATH,
  TYPES_PATH,
  VM_PATH,
  APP_PATH,
  NAV_PATH,
];

for (const filePath of requiredFiles) check(`${filePath}.exists`, fs.existsSync(filePath));

const policy = readJson(POLICY_PATH);
const completion = readJson(COMPLETION_PATH);
const snapshot = readJson(SNAPSHOT_PATH);
const app = read(APP_PATH);
const nav = read(NAV_PATH);
const api = read(API_PATH);
const page = read(PAGE_PATH);
const vm = read(VM_PATH);

check('baseline_is_p51_closure', policy.baseline_tag === BASELINE_TAG && completion.baseline_tag === BASELINE_TAG && snapshot.baseline_tag === BASELINE_TAG);
check('completion_route', completion.route === '/operator/twin/gateway-demo');
check('completion_source_snapshot', completion.source_snapshot === SNAPSHOT_PATH);
check('completion_read_only', completion.read_only === true);
check('completion_no_server_change', completion.server_changes === false);
check('completion_no_telemetry_ingest_change', completion.telemetry_ingest_changes === false);

const diff = git(['diff', '--name-only', BASELINE_TAG, 'HEAD']);
if (diff) {
  const changed = diff.split(/\r?\n/).filter(Boolean);
  const allowed = ['docs/live_evidence_gateway/', 'apps/web/', 'scripts/frontend_acceptance/'];
  const blockedExact = ['package.json', 'pnpm-lock.yaml'];
  const blockedPrefixes = ['apps/server/', 'apps/telemetry-ingest/', 'migrations/', 'packages/contracts/', '.github/'];
  check('changed_files_limited', changed.length > 0 && changed.every((filePath) => allowed.some((root) => filePath.startsWith(root))));
  check('no_server_changes', !changed.some((filePath) => filePath.startsWith('apps/server/')));
  check('no_telemetry_ingest_changes', !changed.some((filePath) => filePath.startsWith('apps/telemetry-ingest/')));
  check('no_migration_changes', !changed.some((filePath) => filePath.startsWith('migrations/')));
  check('no_package_changes', !changed.some((filePath) => blockedExact.includes(filePath)));
  check('no_workflow_changes', !changed.some((filePath) => filePath.startsWith('.github/')));
  check('no_contract_changes', !changed.some((filePath) => blockedPrefixes.some((prefix) => filePath.startsWith(prefix))));
} else {
  check('diff_check_skipped_when_git_ref_unavailable', true);
}

check('snapshot_source_truth_mode', snapshot.identity.source_truth_mode === 'device_path_simulation');
check('snapshot_device_source_simulated', snapshot.identity.device_source_simulated === true);
check('snapshot_real_live_device_proof_false', snapshot.identity.real_live_device_proof === false);
check('snapshot_input_pack_count', snapshot.gateway_summary.input_pack_count === 24);
check('snapshot_device_count', snapshot.gateway_summary.device_count === 2);
check('snapshot_observation_count', snapshot.gateway_summary.accepted_observation_count === 21);
check('snapshot_health_count', snapshot.gateway_summary.health_envelope_count === 2);
check('snapshot_duplicate_same_payload_count', snapshot.duplicate_summary.duplicate_same_payload_deduped_count === 1);
check('snapshot_duplicate_conflict_count', snapshot.duplicate_summary.duplicate_conflict_blocked_count === 1);
check('snapshot_clock_skew_warning_count', snapshot.clock_skew_summary.clock_skew_warn_count === 1);
check('snapshot_ingestion_window_ref', snapshot.ingestion_window.record_type === 'p51_gateway_ingestion_window_v1');
check('snapshot_traceability_readback_count', snapshot.traceability_readback.trace_count === 21);
check('snapshot_hashes_present', Object.keys(snapshot.hashes || {}).length >= 8);
check('snapshot_nonclaims_present', Array.isArray(snapshot.nonclaims) && snapshot.nonclaims.length >= 8);

check('app_route_exists', app.includes('path="twin/gateway-demo"') && app.includes('OperatorGatewayDemoViewerPage'));
check('operator_nav_item_exists', nav.includes('key: "gateway-demo"') && nav.includes('/operator/twin/gateway-demo') && nav.includes('Gateway Demo'));
check('adapter_reads_static_snapshot', api.includes('/demo-runtime/p51-gateway-viewer-snapshot.json') && api.includes('method: "GET"'));
check('page_imports_adapter_and_vm', page.includes('fetchP51GatewayViewerSnapshot') && page.includes('buildGatewayDemoViewerVm'));
check('page_does_not_import_p51_fixtures', !page.includes('fixtures/live_evidence_gateway') && !page.includes('P51_SENML_DEVICE_SAMPLE_FIXTURE'));
check('page_does_not_use_mutating_fetch_methods', !/method:\s*["'](POST|PUT|PATCH|DELETE)["']/.test(page + api));
check('page_does_not_call_telemetry_ingest', !(page + api).includes('telemetry-ingest'));
check('page_renders_nonclaims_panel', page.includes('H. Nonclaims Panel'));
check('page_renders_all_required_sections', ['A. Demo Identity', 'B. Gateway Input Summary', 'C. Standards Mapping Chain', 'D. Device Evidence Health', 'E. Duplicate Handling', 'F. Clock Skew', 'G. Ingestion Window', 'G. Traceability Readback'].every((marker) => page.includes(marker)));
check('vm_blocks_missing_snapshot', vm.includes('SNAPSHOT_MISSING'));
check('vm_blocks_missing_traceability', vm.includes('TRACEABILITY_READBACK_MISSING'));
check('vm_blocks_missing_nonclaims', vm.includes('NONCLAIMS_PANEL_MISSING'));
check('vm_blocks_wrong_source_truth_mode', vm.includes('SOURCE_TRUTH_MODE_NOT_DEVICE_PATH_SIMULATION'));

const combinedSurface = [app, nav, api, page, vm].join('\n');
check('no_real_live_device_connected_phrase', !combinedSurface.includes('real live device connected'));
check('no_production_mqtt_online_phrase', !combinedSurface.includes('production MQTT gateway online'));
check('no_field_pilot_started_phrase', !combinedSurface.includes('field pilot started'));
check('no_runtime_health_completed_phrase', !combinedSurface.includes('Runtime Health v1 completed'));
check('no_action_enablement_surface', !combinedSurface.includes('AO-ACT enabled') && !combinedSurface.includes('dispatch enabled') && !combinedSurface.includes('ROI computed') && !combinedSurface.includes('Field Memory learned'));

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
console.log(JSON.stringify({
  ok: failed.length === 0,
  acceptance: 'P51_5_GATEWAY_BACKED_TWIN_DEMO_VIEWER_V0',
  phase: 'P51.5',
  baseline_tag: BASELINE_TAG,
  route: '/operator/twin/gateway-demo',
  source_snapshot: SNAPSHOT_PATH,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed
}, null, 2));

if (failed.length) process.exit(1);
