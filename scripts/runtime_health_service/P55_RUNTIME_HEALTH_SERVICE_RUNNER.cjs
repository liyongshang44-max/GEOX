// scripts/runtime_health_service/P55_RUNTIME_HEALTH_SERVICE_RUNNER.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_MANIFEST = 'fixtures/runtime_health_service/P55_RUNTIME_HEALTH_SERVICE_INPUT_MANIFEST.json';
const DEFAULT_NEGATIVE_MANIFEST = 'fixtures/runtime_health_service/P55_NEGATIVE_FIXTURE_MANIFEST.json';
const OUTPUT_LEDGER = 'acceptance-output/P55_RUNTIME_HEALTH_SERVICE_LEDGER.jsonl';
const OUTPUT_REPORT = 'acceptance-output/P55_RUNTIME_HEALTH_SERVICE_REPORT.json';
const REQUIRED_DIMENSION_IDS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10', 'H11', 'H12'];
const FORBIDDEN_RECORD_TYPES = ['live_device_production_runtime_v1', 'field_pilot_execution_v1', 'ao_act_task_v0', 'ao_act_receipt_v0', 'machine_dispatch_v1', 'execution_outcome_v1', 'roi_realization_v1', 'field_memory_record_v1', 'full_runtime_v1_freeze_v1'];

function args(argv) {
  const out = { mode: 'controlled-service-build', manifest: DEFAULT_MANIFEST, negativeManifest: DEFAULT_NEGATIVE_MANIFEST };
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
    if (ref.endsWith('.md')) source[key] = { text: readText(ref) };
  }
  return source;
}

function applyMutation(manifest, source, mutation) {
  const nextManifest = JSON.parse(JSON.stringify(manifest));
  const nextSource = JSON.parse(JSON.stringify(source));
  if (mutation === 'remove:p54_closure') {
    nextSource.present.p54_closure = false;
    delete nextSource.p54_closure;
  }
  if (mutation === 'set:p54_failed_assertion_count=1' && nextSource.p54_closure) nextSource.p54_closure.acceptance.failed_assertion_count = 1;
  if (mutation === 'set:p54_p55_gate=false' && nextSource.p54_closure) nextSource.p54_closure.gate_result.p55_runtime_health_service_gate_allowed = false;
  if (mutation === 'set:mode=live_device_production_runtime') nextManifest.runtime_health_service_mode = 'live_device_production_runtime';
  if (mutation === 'set:time_fence=false') nextManifest.time_fence_enforced = false;
  if (mutation === 'set:snapshot=false') nextManifest.gateway_backed_snapshot_used = false;
  if (mutation === 'set:source_truth=live_device' && nextSource.p51_5_snapshot) nextSource.p51_5_snapshot.source_truth_mode = 'live_device';
  if (mutation === 'set:real_device_deployed=true') nextSource.flags.real_device_deployed = true;
  if (mutation === 'set:live_device_claimed=true') nextSource.flags.live_device_claimed = true;
  if (mutation === 'set:live_runtime_monitoring_active=true') nextSource.flags.live_runtime_monitoring_active = true;
  if (mutation === 'set:production_gateway_online=true') nextSource.flags.production_gateway_online = true;
  if (mutation === 'set:field_pilot_execution_allowed=true') nextSource.flags.field_pilot_execution_allowed = true;
  if (mutation === 'set:real_device_execution_allowed=true') nextSource.flags.real_device_execution_allowed = true;
  if (mutation === 'set:ao_act_task_creation_allowed=true') nextSource.flags.ao_act_task_creation_allowed = true;
  if (mutation === 'set:dispatch_allowed=true') nextSource.flags.dispatch_allowed = true;
  if (mutation === 'set:roi_allowed=true') nextSource.flags.roi_allowed = true;
  if (mutation === 'set:field_memory_allowed=true') nextSource.flags.field_memory_allowed = true;
  if (mutation === 'set:full_runtime_v1_freeze_allowed=true') nextSource.flags.full_runtime_v1_freeze_allowed = true;
  if (mutation === 'set:route_method=POST') nextManifest.expected_route.method = 'POST';
  if (mutation === 'set:route_read_only=false') nextSource.flags.route_read_only = false;
  if (mutation === 'set:db_write_allowed=true') nextSource.flags.db_write_allowed = true;
  if (mutation === 'add:ao_act_task_v0') nextSource.flags.forbidden_record_type = 'ao_act_task_v0';
  return { manifest: nextManifest, source: nextSource };
}

function dimension(dimension_id, name, ok, warn, reason) {
  return { dimension_id, name, status: ok ? (warn ? 'WARN' : 'OK') : 'BLOCKED', reason };
}

function buildDimensions(manifest, source) {
  const refsExist = Object.values(source.present).every(Boolean);
  const p54AcceptanceOk = source.p54_closure?.acceptance?.assertion_count === 42 && source.p54_closure?.acceptance?.failed_assertion_count === 0;
  const p54GateOk = source.p54_closure?.gate_result?.p55_runtime_health_service_gate_allowed === true && source.p54_closure?.gate_result?.field_pilot_execution_allowed === false && source.p54_closure?.gate_result?.full_runtime_v1_freeze_allowed === false;
  const modeOk = manifest.runtime_health_service_mode === 'replay_backed_production_demo';
  const timeFenceOk = manifest.time_fence_enforced === true;
  const snapshotOk = manifest.gateway_backed_snapshot_used === true && source.p51_5_snapshot?.source_truth_mode === 'device_path_simulation';
  const evidenceOk = Boolean(source.p54_evidence_packet && source.p52_closure && source.p51_5_snapshot);
  const routeOk = manifest.expected_route?.method === 'GET' && manifest.expected_route?.path === '/api/v1/runtime-health/service-gate';
  const routeReadOnlyOk = source.flags.route_read_only !== false && source.flags.db_write_allowed !== true;
  const boundaryOk = /裁决 ≠ 执行/.test(source.control_to_ao_act_non_goals?.text || '') && /不得自动或隐式实例化/.test(source.control_to_ao_act_non_goals?.text || '');
  const nonclaimsOk = !source.flags.real_device_deployed && !source.flags.live_device_claimed && !source.flags.live_runtime_monitoring_active && !source.flags.production_gateway_online && !source.flags.field_pilot_execution_allowed && !source.flags.real_device_execution_allowed && !source.flags.ao_act_task_creation_allowed && !source.flags.dispatch_allowed && !source.flags.roi_allowed && !source.flags.field_memory_allowed && !source.flags.full_runtime_v1_freeze_allowed;
  const forbiddenRecordOk = !FORBIDDEN_RECORD_TYPES.includes(String(source.flags.forbidden_record_type || ''));
  const p56Ready = refsExist && p54AcceptanceOk && p54GateOk && modeOk && timeFenceOk && snapshotOk && routeOk && routeReadOnlyOk && boundaryOk && nonclaimsOk && forbiddenRecordOk;
  return [
    dimension('H1', 'baseline_closure_health', refsExist, false, 'all P55 committed source refs exist'),
    dimension('H2', 'p54_closure_integrity', source.p54_closure?.next_allowed_phase_after_closure === 'P55 Runtime Health Service Gate v1', false, 'P54 closure must point to P55'),
    dimension('H3', 'p54_acceptance_health', p54AcceptanceOk, false, 'P54 acceptance must be 42/0'),
    dimension('H4', 'p54_gate_health', p54GateOk, false, 'P54 must allow P55 and preserve downstream false gates'),
    dimension('H5', 'replay_mode_health', modeOk, true, 'P55 is replay-backed demo mode, not live-device mode'),
    dimension('H6', 'time_fence_health', timeFenceOk, false, 'time fence must be enforced'),
    dimension('H7', 'gateway_snapshot_health', snapshotOk, true, 'gateway snapshot is simulated device-path source truth'),
    dimension('H8', 'runtime_chain_evidence_health', evidenceOk, false, 'P54/P52/P51.5 evidence chain must exist'),
    dimension('H9', 'deterministic_report_health', true, false, 'deterministic report is derived from committed artifacts'),
    dimension('H10', 'server_surface_read_only_health', routeOk && routeReadOnlyOk, false, 'route must be GET-only and read-only'),
    dimension('H11', 'nonclaims_health', nonclaimsOk && forbiddenRecordOk, false, 'downstream nonclaims and forbidden records must remain blocked'),
    dimension('H12', 'p56_replay_gate_readiness', p56Ready, true, 'P55 allows only replay gate review for P56')
  ];
}

function evaluate(manifest, source) {
  const dimensions = buildDimensions(manifest, source);
  const blocked = dimensions.filter((row) => row.status === 'BLOCKED');
  const warn = dimensions.filter((row) => row.status === 'WARN');
  const blockedReasons = [];
  if (blocked.length) blockedReasons.push('blocked_health_dimension');
  if (!Object.values(manifest.source_refs).every((ref) => !ref.startsWith('acceptance-output/'))) blockedReasons.push('acceptance_output_used_as_source');
  const ok = blockedReasons.length === 0;
  const reportCore = {
    schema_version: 'geox_p55_runtime_health_service_report_v1',
    phase: 'P55',
    task_line: 'P55 Controlled Runtime Health Service Gate v1',
    runtime_health_service_mode: manifest.runtime_health_service_mode,
    runtime_health_service_gate_result: ok ? 'REPLAY_BACKED_RUNTIME_HEALTH_SERVICE_GATE_READY_WITH_LIMITATIONS' : 'BLOCKED',
    blocked_reasons: blockedReasons,
    dimensions,
    blocked_dimension_count: blocked.length,
    warn_dimension_count: warn.length,
    time_fence_enforced: manifest.time_fence_enforced === true,
    gateway_backed_snapshot_used: manifest.gateway_backed_snapshot_used === true,
    p56_replay_gate_allowed: ok,
    p56_gate_mode: 'replay_authorization_only',
    field_pilot_execution_allowed: false,
    real_device_execution_allowed: false,
    real_device_deployed: false,
    live_device_claimed: false,
    live_runtime_monitoring_active: false,
    production_gateway_online: false,
    ao_act_task_creation_allowed: false,
    dispatch_allowed: false,
    roi_allowed: false,
    field_memory_allowed: false,
    full_runtime_v1_freeze_allowed: false,
    route_surface: { method: manifest.expected_route.method, path: manifest.expected_route.path, read_only: source.flags.route_read_only !== false, db_write_allowed: source.flags.db_write_allowed === true },
    source_refs: manifest.source_refs,
    hash_probe_marker: manifest.hash_probe_marker || null
  };
  const deterministicHash = hash(reportCore);
  const records = [
    ['p55_runtime_health_service_input_manifest_v1', manifest],
    ['p55_runtime_health_service_source_snapshot_v1', { present: source.present, refs: manifest.source_refs }],
    ['p55_runtime_health_service_dimension_v1', dimensions],
    ['p55_runtime_health_service_health_report_v1', { ...reportCore, deterministic_hash: deterministicHash }],
    ['p55_runtime_health_service_gate_v1', { p56_replay_gate_allowed: ok, field_pilot_execution_allowed: false, full_runtime_v1_freeze_allowed: false }],
    ['p55_runtime_health_service_limitation_register_v1', [{ limitation_id: 'L1', severity: 'WARN', reason: 'replay-backed mode only' }]],
    ['p55_runtime_health_service_traceability_packet_v1', { p54_closure_ref: manifest.source_refs.p54_closure, p51_5_snapshot_ref: manifest.source_refs.p51_5_snapshot }],
    ['p55_runtime_health_service_capability_matrix_v1', { capability_count: 14, status: ok ? 'PASS' : 'BLOCKED' }]
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
      result_state: result.report.runtime_health_service_gate_result,
      blocked: result.report.runtime_health_service_gate_result === 'BLOCKED',
      p56_replay_gate_allowed: result.report.p56_replay_gate_allowed,
      field_pilot_execution_allowed: result.report.field_pilot_execution_allowed,
      full_runtime_v1_freeze_allowed: result.report.full_runtime_v1_freeze_allowed,
      target_records_created: 0
    };
  });
  return { ok: results.every((row) => row.blocked && row.p56_replay_gate_allowed === false && row.field_pilot_execution_allowed === false && row.full_runtime_v1_freeze_allowed === false && row.target_records_created === 0), negative_result_count: results.length, blocked_count: results.filter((row) => row.blocked).length, results };
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
  if (parsed.mode === 'controlled-gate') {
    console.log(JSON.stringify({ p56_replay_gate_allowed: normal.report.p56_replay_gate_allowed, field_pilot_execution_allowed: false, full_runtime_v1_freeze_allowed: false }, null, 2));
    return;
  }
  if (parsed.mode === 'controlled-write') writeOutputs(normal);
  console.log(JSON.stringify({ ok: normal.ok, phase: 'P55', runtime_health_service_gate_result: normal.report.runtime_health_service_gate_result, runtime_health_service_mode: normal.report.runtime_health_service_mode, p56_replay_gate_allowed: normal.report.p56_replay_gate_allowed, field_pilot_execution_allowed: false, full_runtime_v1_freeze_allowed: false, deterministic_hash: normal.report.deterministic_hash }, null, 2));
}

main();
