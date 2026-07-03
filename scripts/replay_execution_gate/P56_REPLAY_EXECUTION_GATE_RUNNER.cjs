// scripts/replay_execution_gate/P56_REPLAY_EXECUTION_GATE_RUNNER.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_MANIFEST = 'fixtures/replay_execution_gate/P56_REPLAY_EXECUTION_GATE_INPUT_MANIFEST.json';
const DEFAULT_NEGATIVE_MANIFEST = 'fixtures/replay_execution_gate/P56_NEGATIVE_FIXTURE_MANIFEST.json';
const OUTPUT_LEDGER = 'acceptance-output/P56_REPLAY_EXECUTION_GATE_LEDGER.jsonl';
const OUTPUT_REPORT = 'acceptance-output/P56_REPLAY_EXECUTION_GATE_REPORT.json';
const REQUIRED_DIMENSION_IDS = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14'];
const FORBIDDEN_RECORD_TYPES = ['field_pilot_execution_v1', 'field_pilot_execution_start_v1', 'real_field_execution_v1', 'live_device_deployment_v1', 'production_gateway_rollout_v1', 'live_runtime_monitoring_v1', 'ao_act_task_v0', 'ao_act_receipt_v0', 'machine_dispatch_v1', 'execution_outcome_v1', 'roi_realization_v1', 'effect_attribution_v1', 'field_memory_record_v1', 'learning_signal_v1', 'training_run_v1', 'full_runtime_v1_freeze_v1', 'live_device_production_runtime_v1'];

function args(argv) {
  const out = { mode: 'controlled-gate-build', manifest: DEFAULT_MANIFEST, negativeManifest: DEFAULT_NEGATIVE_MANIFEST };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--mode') out.mode = argv[++i];
    if (argv[i] === '--manifest') out.manifest = argv[++i];
    if (argv[i] === '--negative-manifest') out.negativeManifest = argv[++i];
  }
  return out;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function hash(value) {
  return crypto.createHash('sha256').update(stable(value)).digest('hex');
}

function resolvePath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

function exists(filePath) {
  return fs.existsSync(resolvePath(filePath));
}

function readText(filePath) {
  return fs.readFileSync(resolvePath(filePath), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function loadSources(manifest) {
  const present = Object.fromEntries(Object.entries(manifest.source_refs).map(([key, ref]) => [key, exists(ref)]));
  const source = { present, flags: {}, refs: manifest.source_refs };
  for (const [key, ref] of Object.entries(manifest.source_refs)) {
    if (!present[key]) continue;
    if (ref.endsWith('.json')) source[key] = readJson(ref);
    if (ref.endsWith('.ts') || ref.endsWith('.md')) source[key] = { text: readText(ref) };
  }
  return source;
}

function getSnapshotSourceTruthMode(source) {
  return source.p51_5_snapshot?.identity?.source_truth_mode ?? source.p51_5_snapshot?.source_truth_mode ?? null;
}

function applyMutation(manifest, source, mutation) {
  const nextManifest = JSON.parse(JSON.stringify(manifest));
  const nextSource = JSON.parse(JSON.stringify(source));
  if (mutation === 'remove:p55_closure') {
    nextSource.present.p55_closure = false;
    delete nextSource.p55_closure;
  }
  if (mutation === 'set:p55_failed_assertion_count=1' && nextSource.p55_closure) nextSource.p55_closure.acceptance.failed_assertion_count = 1;
  if (mutation === 'set:p55_replay_gate=false' && nextSource.p55_closure) nextSource.p55_closure.gate_result.p56_replay_gate_allowed = false;
  if (mutation === 'set:p55_mode=live_device_production_runtime' && nextSource.p55_closure) nextSource.p55_closure.runtime_health_service_mode = 'live_device_production_runtime';
  if (mutation === 'set:p55_field_gate=true' && nextSource.p55_closure) nextSource.p55_closure.gate_result.field_pilot_execution_allowed = true;
  if (mutation === 'set:real_device_deployed=true') nextSource.flags.real_device_deployed = true;
  if (mutation === 'set:live_device_claimed=true') nextSource.flags.live_device_claimed = true;
  if (mutation === 'set:p55_full_freeze=true' && nextSource.p55_closure) nextSource.p55_closure.gate_result.full_runtime_v1_freeze_allowed = true;
  if (mutation === 'remove:p55_surface' && nextSource.p55_closure) delete nextSource.p55_closure.server_surface;
  if (mutation === 'set:time_fence=false') nextManifest.replay_window.time_fence_enforced = false;
  if (mutation === 'set:snapshot=false') nextSource.present.p51_5_snapshot = false;
  if (mutation === 'set:packet=false') nextManifest.replay_gate_packet.exists = false;
  if (mutation.startsWith('flag:')) nextSource.flags[mutation.slice(5)] = true;
  return { manifest: nextManifest, source: nextSource };
}

function dimension(dimension_id, name, ok, warn, reason) {
  return { dimension_id, name, status: ok ? (warn ? 'WARN' : 'OK') : 'BLOCKED', reason };
}

function boolFalse(value) {
  return value === false || value === undefined;
}

function buildDimensions(manifest, source) {
  const refsExist = Object.values(source.present).every(Boolean);
  const p55AcceptanceOk = source.p55_closure?.acceptance?.assertion_count === 46 && source.p55_closure?.acceptance?.failed_assertion_count === 0;
  const p55ModeOk = source.p55_closure?.runtime_health_service_mode === 'replay_backed_production_demo';
  const p55SurfaceOk = source.p55_closure?.server_surface?.route === 'GET /api/v1/runtime-health/service-gate' && source.p55_closure?.server_surface?.read_only === true && source.p55_closure?.server_surface?.db_write_allowed === false && source.p55_closure?.server_surface?.fact_write_allowed === false && /buildP55RuntimeHealthServiceGateReportV1/.test(source.p55_runtime_builder?.text || '') && /\/api\/v1\/runtime-health\/service-gate/.test(source.p55_runtime_route?.text || '');
  const p55GateOk = source.p55_closure?.gate_result?.p56_replay_gate_allowed === true && source.p55_closure?.gate_result?.p56_gate_mode === 'replay_authorization_only' && source.p55_closure?.gate_result?.field_pilot_execution_allowed === false && source.p55_closure?.gate_result?.full_runtime_v1_freeze_allowed === false;
  const timeFenceOk = manifest.replay_window?.exists === true && manifest.replay_window?.time_fence_enforced === true;
  const snapshotOk = getSnapshotSourceTruthMode(source) === 'device_path_simulation';
  const packetOk = manifest.replay_gate_packet?.exists === true && manifest.replay_gate_packet?.scope === 'replay_backed_freeze_preparation';
  const windowOk = manifest.replay_window?.exists === true && manifest.replay_window?.source_mode === 'replay_backed_production_demo';
  const humanBoundaryOk = manifest.replay_gate_packet?.human_boundary_preserved === true;
  const controlBoundaryOk = /裁决 ≠ 执行/.test(source.control_to_ao_act_non_goals?.text || '') && /不得自动或隐式实例化/.test(source.control_to_ao_act_non_goals?.text || '');
  const noRealWorldClaims = boolFalse(source.flags.field_pilot_execution_started) && boolFalse(source.flags.real_field_execution_claimed) && boolFalse(source.flags.real_device_deployed) && boolFalse(source.flags.live_device_claimed) && source.p55_closure?.gate_result?.field_pilot_execution_allowed === false;
  const noDownstreamCreation = boolFalse(source.flags.ao_act_task_creation_allowed) && boolFalse(source.flags.dispatch_allowed) && boolFalse(source.flags.execution_outcome_created) && boolFalse(source.flags.roi_allowed) && boolFalse(source.flags.field_memory_allowed) && boolFalse(source.flags.full_runtime_v1_freeze_allowed) && boolFalse(source.flags.live_device_production_freeze_allowed) && source.p55_closure?.gate_result?.full_runtime_v1_freeze_allowed === false;
  const p57Ready = refsExist && p55AcceptanceOk && p55ModeOk && p55SurfaceOk && p55GateOk && timeFenceOk && snapshotOk && packetOk && windowOk && humanBoundaryOk && controlBoundaryOk && noRealWorldClaims && noDownstreamCreation;
  return [
    dimension('E1', 'p55_closure_health', refsExist, false, 'all committed P55/P54/P53/P52/P51.5 refs exist'),
    dimension('E2', 'p55_acceptance_health', p55AcceptanceOk, false, 'P55 acceptance must be 46/0'),
    dimension('E3', 'p55_replay_mode_health', p55ModeOk, true, 'P55 mode is replay-backed only'),
    dimension('E4', 'p55_runtime_health_service_surface_health', p55SurfaceOk, false, 'P55 read-only service surface must exist'),
    dimension('E5', 'p55_p56_replay_gate_health', p55GateOk, false, 'P55 must allow only P56 replay gate'),
    dimension('E6', 'time_fence_health', timeFenceOk, false, 'P56 replay window must be time fenced'),
    dimension('E7', 'gateway_backed_snapshot_health', snapshotOk, true, 'P51.5 gateway source is simulated device-path evidence'),
    dimension('E8', 'replay_execution_authorization_packet_health', packetOk, false, 'P56 replay gate packet must exist'),
    dimension('E9', 'replay_execution_window_health', windowOk, false, 'P56 replay window must exist'),
    dimension('E10', 'human_authorization_boundary_health', humanBoundaryOk, false, 'human boundary must remain explicit'),
    dimension('E11', 'control_to_ao_act_non_instantiation_health', controlBoundaryOk, false, 'Control to AO-ACT non-instantiation must be preserved'),
    dimension('E12', 'no_real_field_execution_claim_health', noRealWorldClaims, false, 'real-world execution claims must remain false'),
    dimension('E13', 'no_downstream_creation_health', noDownstreamCreation, false, 'downstream creation claims must remain false'),
    dimension('E14', 'p57_replay_freeze_review_readiness', p57Ready, true, 'P56 allows only P57 replay-backed freeze review')
  ];
}

function evaluate(manifest, source) {
  const dimensions = buildDimensions(manifest, source);
  const blocked = dimensions.filter((row) => row.status === 'BLOCKED');
  const warn = dimensions.filter((row) => row.status === 'WARN');
  const sourceRefsOk = Object.values(manifest.source_refs).every((ref) => !ref.startsWith('acceptance-output/'));
  const ok = blocked.length === 0 && sourceRefsOk;
  const reportCore = {
    schema_version: 'geox_p56_replay_execution_gate_report_v1',
    phase: 'P56',
    task_line: 'P56 Controlled Replay Execution Authorization Gate v1',
    replay_execution_authorization_result: ok ? 'REPLAY_EXECUTION_AUTHORIZED_WITH_LIMITATIONS' : 'BLOCKED',
    replay_execution_authorized: ok,
    replay_execution_authorization_recorded: ok,
    replay_execution_started: false,
    field_pilot_execution_started: false,
    real_field_execution_claimed: false,
    real_device_deployed: false,
    live_device_claimed: false,
    production_gateway_online: false,
    live_runtime_monitoring_active: false,
    ao_act_task_creation_allowed: false,
    dispatch_allowed: false,
    execution_outcome_created: false,
    roi_allowed: false,
    field_memory_allowed: false,
    full_runtime_v1_freeze_allowed: false,
    p57_replay_backed_freeze_review_allowed: ok,
    real_field_execution_allowed: false,
    live_device_production_freeze_allowed: false,
    dimensions,
    blocked_dimension_count: blocked.length,
    warn_dimension_count: warn.length,
    source_refs: manifest.source_refs,
    hash_probe_marker: manifest.hash_probe_marker || null
  };
  const deterministicHash = hash(reportCore);
  const records = [
    ['p56_replay_execution_input_manifest_v1', manifest],
    ['p56_replay_execution_source_snapshot_v1', { present: source.present, refs: manifest.source_refs }],
    ['p56_replay_execution_authorization_packet_v1', { exists: manifest.replay_gate_packet.exists, scope: manifest.replay_gate_packet.scope }],
    ['p56_replay_execution_gate_v1', { p57_replay_backed_freeze_review_allowed: ok, real_field_execution_allowed: false, full_runtime_v1_freeze_allowed: false }],
    ['p56_replay_execution_window_v1', manifest.replay_window],
    ['p56_replay_execution_traceability_packet_v1', { p55_closure_ref: manifest.source_refs.p55_closure, p51_5_snapshot_ref: manifest.source_refs.p51_5_snapshot }],
    ['p56_replay_execution_limitation_register_v1', [{ limitation_id: 'L1', severity: 'WARN', reason: 'replay authorization only' }]],
    ['p56_replay_execution_report_v1', { ...reportCore, deterministic_hash: deterministicHash }],
    ['p56_replay_execution_capability_matrix_v1', { capability_count: 14, status: ok ? 'PASS' : 'BLOCKED' }]
  ].map(([record_type, payload]) => ({ record_type, payload, record_timestamp: manifest.as_of_ts, record_hash: hash({ record_type, payload }) }));
  return { ok, report: { ...reportCore, deterministic_hash: deterministicHash }, records };
}

function runNormal(manifestPath) {
  const manifest = readJson(manifestPath);
  return evaluate(manifest, loadSources(manifest));
}

function runNegative(manifestPath, negativeManifestPath) {
  const baseManifest = readJson(manifestPath);
  const baseSource = loadSources(baseManifest);
  const negativeManifest = readJson(negativeManifestPath);
  const results = negativeManifest.fixtures.map((fixture) => {
    const mutated = applyMutation(baseManifest, baseSource, fixture.mutation);
    const result = evaluate(mutated.manifest, mutated.source);
    return {
      scenario_id: fixture.scenario_id,
      result_state: result.report.replay_execution_authorization_result,
      blocked: result.report.replay_execution_authorization_result === 'BLOCKED',
      p57_replay_backed_freeze_review_allowed: result.report.p57_replay_backed_freeze_review_allowed,
      real_field_execution_allowed: result.report.real_field_execution_allowed,
      full_runtime_v1_freeze_allowed: result.report.full_runtime_v1_freeze_allowed,
      target_records_created: 0
    };
  });
  return { ok: results.every((row) => row.blocked && row.p57_replay_backed_freeze_review_allowed === false && row.real_field_execution_allowed === false && row.full_runtime_v1_freeze_allowed === false && row.target_records_created === 0), negative_result_count: results.length, blocked_count: results.filter((row) => row.blocked).length, results };
}

function writeOutputs(result) {
  fs.mkdirSync(path.dirname(OUTPUT_LEDGER), { recursive: true });
  fs.writeFileSync(OUTPUT_LEDGER, `${result.records.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_REPORT, `${JSON.stringify(result.report, null, 2)}\n`, 'utf8');
}

function main() {
  const parsed = args(process.argv);
  if (parsed.mode === 'controlled-negative') {
    console.log(JSON.stringify(runNegative(parsed.manifest, parsed.negativeManifest), null, 2));
    return;
  }
  const normal = runNormal(parsed.manifest);
  if (parsed.mode === 'controlled-write') writeOutputs(normal);
  console.log(JSON.stringify({ ok: normal.ok, phase: 'P56', replay_execution_authorization_result: normal.report.replay_execution_authorization_result, replay_execution_authorized: normal.report.replay_execution_authorized, replay_execution_authorization_recorded: normal.report.replay_execution_authorization_recorded, replay_execution_started: false, p57_replay_backed_freeze_review_allowed: normal.report.p57_replay_backed_freeze_review_allowed, real_field_execution_allowed: false, full_runtime_v1_freeze_allowed: false, deterministic_hash: normal.report.deterministic_hash }, null, 2));
}

main();
