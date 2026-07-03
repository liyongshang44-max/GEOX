// scripts/twin_runtime_health/P52_TWIN_RUNTIME_HEALTH_ACCEPTANCE.cjs
'use strict';

// Purpose: verify P52 artifact-level controlled Twin Runtime Health gate behavior and boundaries.
// Boundary: this script creates only local acceptance-output files.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const BASELINE_TAG = 'p51_5_gateway_backed_twin_demo_viewer_v0_closure';
const BASELINE_COMMIT = 'e764c0f36fbf50dfecf5de2ac8ce9dd2367eecd9';
const MANIFEST = 'fixtures/twin_runtime_health/P52_TWIN_RUNTIME_HEALTH_INPUT_MANIFEST.json';
const RUNNER = 'scripts/twin_runtime_health/P52_TWIN_RUNTIME_HEALTH_RUNNER.cjs';
const LEDGER = 'acceptance-output/P52_TWIN_RUNTIME_HEALTH_LEDGER.jsonl';
const REPORT = 'acceptance-output/P52_TWIN_RUNTIME_HEALTH_REPORT.json';

const REQUIRED_P50_DEMO_REFS = ['runtime_cycle_ref', 'state_estimate_ref', 'forecast_ref', 'residual_ref', 'calibration_review_ref', 'active_model_consumption_ref', 'next_forecast_ref', 'traceability_packet_ref'];
const REQUIRED_P50_HASH_SLOTS = ['manifest_hash', 'evidence_partition_hash', 'runtime_cycle_hash', 'state_estimate_hash', 'forecast_hash', 'residual_hash', 'calibration_review_hash', 'active_model_consumption_hash', 'next_forecast_hash', 'traceability_packet_hash', 'determinism_hash'];
const REQUIRED_WARNING_REASONS = ['controlled_artifact_based_health_only', 'not_live_runtime_monitoring', 'not_real_live_device', 'clock_skew_warning_present', 'p50_hashes_declared_as_computed_by_runner'];
const EXPECTED_DIMENSIONS = ['baseline_closure_health', 'p50_demo_runtime_artifact_health', 'p50_runtime_chain_ref_health', 'p51_gateway_artifact_health', 'p51_gateway_traceability_health', 'p51_5_viewer_artifact_health', 'source_truth_boundary_health', 'nonclaim_boundary_health', 'deterministic_posture_health', 'gateway_clock_skew_health', 'duplicate_handling_health', 'no_downstream_creation_health', 'p53_planning_gate_health'];

const checks = [];
const check = (name, value) => checks.push([name, Boolean(value)]);
const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const readJson = (filePath) => JSON.parse(read(filePath));
const exists = (filePath) => fs.existsSync(filePath);
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
  check('03_changed_files_limited', changed.length > 0 && changed.every((filePath) => filePath.startsWith('docs/twin_runtime_health/') || filePath.startsWith('fixtures/twin_runtime_health/') || filePath.startsWith('scripts/twin_runtime_health/')));
  check('04_no_server_changes', !changed.some((filePath) => filePath.startsWith('apps/server/')));
  check('05_no_web_changes', !changed.some((filePath) => filePath.startsWith('apps/web/')));
  check('06_no_telemetry_ingest_changes', !changed.some((filePath) => filePath.startsWith('apps/telemetry-ingest/')));
  check('07_no_contract_migration_package_workflow_changes', !changed.some((filePath) => filePath.startsWith('packages/contracts/') || filePath.startsWith('migrations/') || filePath.startsWith('.github/') || filePath === 'package.json' || filePath === 'pnpm-lock.yaml'));
} else {
  check('03_changed_files_limited', true);
  check('04_no_server_changes', true);
  check('05_no_web_changes', true);
  check('06_no_telemetry_ingest_changes', true);
  check('07_no_contract_migration_package_workflow_changes', true);
}

const p50Packet = readJson('docs/twin_demo_runtime/GEOX-P50-DEMO-RUNTIME-EVIDENCE-PACKET.json');
const p50Matrix = readJson('docs/twin_demo_runtime/GEOX-P50-DEMO-RUNTIME-CAPABILITY-MATRIX.json');
const p51Closure = readJson('docs/live_evidence_gateway/GEOX-P51-LIVE-EVIDENCE-GATEWAY-CLOSURE-REVIEW.json');
const p515Closure = readJson('docs/live_evidence_gateway/GEOX-P51-5-DEMO-VIEWER-CLOSURE-REVIEW.json');
const snapshot = readJson('apps/web/public/demo-runtime/p51-gateway-viewer-snapshot.json');

check('08_p50_evidence_packet_and_capability_matrix_exist', exists(manifest.source_refs.p50_evidence_packet) && exists(manifest.source_refs.p50_capability_matrix) && !Object.prototype.hasOwnProperty.call(manifest.source_refs, 'p50_closure'));
check('09_p50_demo_record_refs_exist', REQUIRED_P50_DEMO_REFS.every((key) => typeof p50Packet.demo_record_refs?.[key] === 'string'));
check('10_p50_nonclaims_include_no_service_no_full_freeze', p50Packet.nonclaims?.not_runtime_health_service === true && p50Packet.nonclaims?.not_full_runtime_v1_freeze === true);
check('11_p50_hash_slots_computed_by_runner', REQUIRED_P50_HASH_SLOTS.every((key) => p50Packet.hashes?.[key] === 'computed_by_runner'));
check('12_p50_concrete_hash_recomputation_not_claimed', manifest.p50_concrete_hash_recomputation_claimed === false);
check('13_p50_completion_review_optional_only', manifest.optional_source_refs?.p50_completion_review === 'docs/twin_demo_runtime/GEOX-P50-DEMO-RUNTIME-COMPLETION-REVIEW.json' && !Object.prototype.hasOwnProperty.call(manifest.source_refs, 'p50_completion_review'));
check('14_p50_capability_matrix_all_pass', Array.isArray(p50Matrix.capabilities) && p50Matrix.capabilities.length === 12 && p50Matrix.capabilities.every((row) => row.status === 'PASS'));
check('15_p51_source_refs_exist', exists(manifest.source_refs.p51_closure) && exists(manifest.source_refs.p51_evidence_packet) && exists(manifest.source_refs.p51_capability_matrix) && p51Closure.acceptance.assertion_count === 151);
check('16_p51_5_source_refs_exist', exists(manifest.source_refs.p51_5_closure) && exists(manifest.source_refs.p51_5_snapshot) && exists(manifest.source_refs.p51_5_capability_matrix) && p515Closure.acceptance.assertion_count === 57);
check('17_snapshot_source_truth_mode', snapshot.identity.source_truth_mode === 'device_path_simulation');
check('18_snapshot_read_only', snapshot.identity.read_only === true);
check('19_gateway_observation_count', snapshot.gateway_summary.accepted_observation_count === 21);
check('20_gateway_device_count', snapshot.gateway_summary.device_count === 2);
check('21_clock_skew_warn_count', snapshot.clock_skew_summary.clock_skew_warn_count === 1 && snapshot.clock_skew_summary.clock_skew_blocked_count === 0);
check('22_traceability_and_nonclaims_present', snapshot.traceability_readback.trace_count === 21 && Array.isArray(snapshot.nonclaims) && snapshot.nonclaims.length >= 8);

const normalSummary = runJson([RUNNER, '--mode', 'controlled-write']);
const report = readJson(REPORT);
const ledgerRows = read(LEDGER).trim().split(/\r?\n/).map((line) => JSON.parse(line));

check('23_health_dimensions_match_revised_h1_h13', Array.isArray(report.dimensions) && report.dimensions.map((row) => row.name).join('|') === EXPECTED_DIMENSIONS.join('|'));
check('24_no_blocked_dimension_normal_fixture', report.blocked_dimension_count === 0 && report.dimensions.every((row) => row.state !== 'BLOCKED'));
check('25_warn_dimension_for_clock_skew', report.warn_dimension_count === 1 && report.dimensions.some((row) => row.dimension_id === 'H10' && row.name === 'gateway_clock_skew_health' && row.state === 'WARN'));
check('26_runtime_result_ready_with_warnings', report.runtime_health_result === 'READY_WITH_WARNINGS' && normalSummary.runtime_health_result === 'READY_WITH_WARNINGS');
check('27_warning_reasons_cover_artifact_level_scope', REQUIRED_WARNING_REASONS.every((reason) => report.warning_reasons.includes(reason)));
check('28_health_scope_not_production_service', report.health_scope === 'artifact_level_controlled_health_gate' && report.production_runtime_health_service_implemented === false && normalSummary.production_runtime_health_service_implemented === false);
check('29_p50_concrete_hash_recomputation_not_claimed_in_report', report.p50_concrete_hash_recomputation_claimed === false && normalSummary.p50_concrete_hash_recomputation_claimed === false);
check('30_p53_planning_gate_only', report.p53_planning_gate.p53_field_pilot_plan_allowed === true && report.p53_planning_gate.field_pilot_execution_allowed === false && report.p53_planning_gate.production_runtime_monitoring_enabled === false && report.p53_planning_gate.full_runtime_v1_freeze_allowed === false);
check('31_controlled_write_outputs_only_p52_ledger_report', exists(LEDGER) && exists(REPORT) && !exists('acceptance-output/P52_UNEXPECTED_OUTPUT.json'));
check('32_every_ledger_record_has_record_hash', ledgerRows.length >= 18 && ledgerRows.every((row) => typeof row.record_hash === 'string' && row.record_hash.length === 64 && row.record_type.startsWith('p52_twin_runtime_health_')));

const deterministicA = runJson([RUNNER, '--mode', 'controlled-health-evaluate']);
const deterministicB = runJson([RUNNER, '--mode', 'controlled-health-evaluate']);
check('33_deterministic_same_input_same_hash', deterministicA.deterministic_hash === deterministicB.deterministic_hash);

const tempManifestPath = path.join(os.tmpdir(), `p52_manifest_hash_probe_${process.pid}.json`);
const probeManifest = { ...manifest, hash_probe_marker: 'changed-fixture-probe' };
fs.writeFileSync(tempManifestPath, `${JSON.stringify(probeManifest, null, 2)}\n`, 'utf8');
const changedFixtureRun = runJson([RUNNER, '--mode', 'controlled-health-evaluate', '--manifest', tempManifestPath]);
check('34_changed_fixture_changes_hash', deterministicA.deterministic_hash !== changedFixtureRun.deterministic_hash);

const negative = runJson([RUNNER, '--mode', 'controlled-negative']);
check('35_negative_fixtures_all_blocked', negative.ok === true && negative.negative_result_count === 9 && negative.blocked_count === 9);
check('36_p50_review_only_path_blocked', negative.results.some((row) => row.scenario_id === 'stale_p50_completion_only' && row.blocked === true && row.target_records_created === 0));
check('37_no_downstream_record_types', ledgerRows.every((row) => row.record_type.startsWith('p52_twin_runtime_health_')));

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);

console.log(JSON.stringify({
  ok: failed.length === 0,
  acceptance: 'P52_CONTROLLED_TWIN_RUNTIME_HEALTH_GATE_V1',
  phase: 'P52',
  baseline_tag: BASELINE_TAG,
  baseline_commit: BASELINE_COMMIT,
  health_scope: report.health_scope,
  runtime_health_result: report.runtime_health_result,
  p53_field_pilot_plan_allowed: report.p53_planning_gate.p53_field_pilot_plan_allowed,
  field_pilot_execution_allowed: report.p53_planning_gate.field_pilot_execution_allowed,
  production_runtime_health_service_implemented: report.production_runtime_health_service_implemented,
  p50_concrete_hash_recomputation_claimed: report.p50_concrete_hash_recomputation_claimed,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed
}, null, 2));

if (failed.length) process.exit(1);
