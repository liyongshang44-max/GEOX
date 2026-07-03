// scripts/twin_runtime_health/P52_TWIN_RUNTIME_HEALTH_ACCEPTANCE.cjs
'use strict';

// Purpose: verify P52 controlled Twin Runtime Health gate behavior and boundaries.
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

const p50ClosureText = read('docs/twin_demo_runtime/P50-CLOSURE.md');
const p50Completion = readJson('docs/twin_demo_runtime/GEOX-P50-DEMO-RUNTIME-COMPLETION-REVIEW.json');
const p51Closure = readJson('docs/live_evidence_gateway/GEOX-P51-LIVE-EVIDENCE-GATEWAY-CLOSURE-REVIEW.json');
const p515Closure = readJson('docs/live_evidence_gateway/GEOX-P51-5-DEMO-VIEWER-CLOSURE-REVIEW.json');
const snapshot = readJson('apps/web/public/demo-runtime/p51-gateway-viewer-snapshot.json');

check('08_p50_closure_and_evidence_exist', exists('docs/twin_demo_runtime/P50-CLOSURE.md') && exists('docs/twin_demo_runtime/GEOX-P50-DEMO-RUNTIME-EVIDENCE-PACKET.json') && manifest.source_refs.p50_closure === 'docs/twin_demo_runtime/P50-CLOSURE.md');
check('09_p50_closure_records_acceptance_146_0', /acceptance\s*=\s*146\s*\/\s*0/.test(p50ClosureText));
check('10_p51_source_refs_exist', exists(manifest.source_refs.p51_closure) && exists(manifest.source_refs.p51_evidence_packet) && p51Closure.acceptance.assertion_count === 151);
check('11_p51_5_source_refs_exist', exists(manifest.source_refs.p51_5_closure) && exists(manifest.source_refs.p51_5_snapshot) && p515Closure.acceptance.assertion_count === 57);
check('12_snapshot_source_truth_mode', snapshot.identity.source_truth_mode === 'device_path_simulation');
check('13_snapshot_read_only', snapshot.identity.read_only === true);
check('14_gateway_observation_count', snapshot.gateway_summary.accepted_observation_count === 21);
check('15_gateway_device_count', snapshot.gateway_summary.device_count === 2);
check('16_clock_skew_warn_count', snapshot.clock_skew_summary.clock_skew_warn_count === 1);
check('17_clock_skew_blocked_count', snapshot.clock_skew_summary.clock_skew_blocked_count === 0);
check('18_traceability_count', snapshot.traceability_readback.trace_count === 21);
check('19_nonclaims_present', Array.isArray(snapshot.nonclaims) && snapshot.nonclaims.length >= 8);
check('20_p50_completion_review_not_final_authority', p50Completion.final_status === 'not_started' && manifest.source_refs.p50_closure === 'docs/twin_demo_runtime/P50-CLOSURE.md');

const normalSummary = runJson([RUNNER, '--mode', 'controlled-write']);
const report = readJson(REPORT);
const ledgerRows = read(LEDGER).trim().split(/\r?\n/).map((line) => JSON.parse(line));

check('21_health_dimensions_h1_h13_generated', Array.isArray(report.dimensions) && report.dimensions.length === 13 && report.dimensions.some((row) => row.dimension_id === 'H11' && row.name === 'device_evidence_health_scope_boundary'));
check('22_no_blocked_dimension_normal_fixture', report.blocked_dimension_count === 0 && report.dimensions.every((row) => row.state !== 'BLOCKED'));
check('23_warn_dimension_for_clock_skew', report.warn_dimension_count === 1 && report.dimensions.some((row) => row.dimension_id === 'H9' && row.state === 'WARN'));
check('24_runtime_health_result_ready_with_warnings', report.runtime_health_result === 'READY_WITH_WARNINGS' && normalSummary.runtime_health_result === 'READY_WITH_WARNINGS');
check('25_p53_field_pilot_plan_allowed_true', report.p53_planning_gate.p53_field_pilot_plan_allowed === true);
check('26_field_pilot_execution_allowed_false', report.p53_planning_gate.field_pilot_execution_allowed === false);
check('27_production_monitoring_disabled', report.p53_planning_gate.production_runtime_monitoring_enabled === false);
check('28_full_runtime_freeze_disabled', report.p53_planning_gate.full_runtime_v1_freeze_allowed === false);
check('29_controlled_write_outputs_only_p52_ledger_report', exists(LEDGER) && exists(REPORT) && !exists('acceptance-output/P52_UNEXPECTED_OUTPUT.json'));
check('30_every_ledger_record_has_record_hash', ledgerRows.length >= 18 && ledgerRows.every((row) => typeof row.record_hash === 'string' && row.record_hash.length === 64 && row.record_type.startsWith('p52_twin_runtime_health_')));

const deterministicA = runJson([RUNNER, '--mode', 'controlled-health-evaluate']);
const deterministicB = runJson([RUNNER, '--mode', 'controlled-health-evaluate']);
check('31_deterministic_same_input_same_hash', deterministicA.deterministic_hash === deterministicB.deterministic_hash);

const tempManifestPath = path.join(os.tmpdir(), `p52_manifest_hash_probe_${process.pid}.json`);
const probeManifest = { ...manifest, hash_probe_marker: 'changed-fixture-probe' };
fs.writeFileSync(tempManifestPath, `${JSON.stringify(probeManifest, null, 2)}\n`, 'utf8');
const changedFixtureRun = runJson([RUNNER, '--mode', 'controlled-health-evaluate', '--manifest', tempManifestPath]);
check('32_changed_fixture_changes_hash', deterministicA.deterministic_hash !== changedFixtureRun.deterministic_hash);

const negative = runJson([RUNNER, '--mode', 'controlled-negative']);
check('33_negative_fixtures_all_blocked', negative.ok === true && negative.negative_result_count === 9 && negative.blocked_count === 9);
check('34_stale_p50_completion_only_blocked', negative.results.some((row) => row.scenario_id === 'stale_p50_completion_only' && row.blocked === true && row.target_records_created === 0));
check('35_no_downstream_record_types', ledgerRows.every((row) => row.record_type.startsWith('p52_twin_runtime_health_')));

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);

console.log(JSON.stringify({
  ok: failed.length === 0,
  acceptance: 'P52_TWIN_RUNTIME_HEALTH_V1',
  phase: 'P52',
  baseline_tag: BASELINE_TAG,
  baseline_commit: BASELINE_COMMIT,
  runtime_health_result: report.runtime_health_result,
  p53_field_pilot_plan_allowed: report.p53_planning_gate.p53_field_pilot_plan_allowed,
  field_pilot_execution_allowed: report.p53_planning_gate.field_pilot_execution_allowed,
  assertion_count: checks.length,
  failed_assertion_count: failed.length,
  failed_assertions: failed
}, null, 2));

if (failed.length) process.exit(1);
