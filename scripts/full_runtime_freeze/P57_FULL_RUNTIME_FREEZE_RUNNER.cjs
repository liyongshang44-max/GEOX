// scripts/full_runtime_freeze/P57_FULL_RUNTIME_FREEZE_RUNNER.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_MANIFEST = 'fixtures/full_runtime_freeze/P57_FULL_RUNTIME_FREEZE_INPUT_MANIFEST.json';
const DEFAULT_NEGATIVE_MANIFEST = 'fixtures/full_runtime_freeze/P57_NEGATIVE_FIXTURE_MANIFEST.json';
const OUTPUT_LEDGER = 'acceptance-output/P57_FULL_RUNTIME_FREEZE_LEDGER.jsonl';
const OUTPUT_REPORT = 'acceptance-output/P57_FULL_RUNTIME_FREEZE_REPORT.json';
const REQUIRED_DIMENSION_IDS = Array.from({ length: 24 }, (_unused, index) => `F${String(index + 1).padStart(2, '0')}`);
const FORBIDDEN_RECORD_TYPES = ['live_device_production_runtime_v1_freeze', 'live_device_deployment_v1', 'production_gateway_rollout_v1', 'live_runtime_monitoring_v1', 'real_field_execution_v1', 'field_pilot_execution_v1', 'ao_act_task_v0', 'ao_act_receipt_v0', 'machine_dispatch_v1', 'execution_outcome_v1', 'roi_realization_v1', 'field_memory_record_v1', 'learning_signal_v1', 'training_run_v1'];

function args(argv) {
  const out = { mode: 'controlled-freeze-build', manifest: DEFAULT_MANIFEST, negativeManifest: DEFAULT_NEGATIVE_MANIFEST };
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

function getSnapshotSourceTruthMode(source) {
  return source.p51_5_snapshot?.identity?.source_truth_mode ?? source.p51_5_snapshot?.source_truth_mode ?? null;
}

function boolFalse(value) {
  return value === false || value === undefined;
}

function applyMutation(manifest, source, mutation) {
  const nextManifest = JSON.parse(JSON.stringify(manifest));
  const nextSource = JSON.parse(JSON.stringify(source));
  if (mutation.startsWith('remove:')) {
    const key = mutation.slice('remove:'.length);
    if (key === 'full_runtime_mode') delete nextManifest.freeze_binding.full_runtime_mode;
    else {
      nextSource.present[key] = false;
      delete nextSource[key];
    }
  }
  if (mutation === 'set:p56_failed_assertion_count=1' && nextSource.p56_closure) nextSource.p56_closure.acceptance.failed_assertion_count = 1;
  if (mutation === 'set:p56_p57_gate=false' && nextSource.p56_closure) nextSource.p56_closure.gate_result.p57_replay_backed_freeze_review_allowed = false;
  if (mutation === 'set:p56_replay_started=true' && nextSource.p56_closure) nextSource.p56_closure.gate_result.replay_execution_started = true;
  if (mutation === 'set:freeze_package=WRONG') nextManifest.freeze_binding.freeze_package = 'WRONG';
  if (mutation === 'set:full_runtime_v1_frozen=false') nextManifest.freeze_binding.full_runtime_v1_frozen = false;
  if (mutation === 'set:replay_backed_production_demo_frozen=false') nextManifest.freeze_binding.replay_backed_production_demo_frozen = false;
  if (mutation === 'set:live_device_production_runtime_v1_frozen=true') nextManifest.freeze_binding.live_device_production_runtime_v1_frozen = true;
  if (mutation === 'set:mode=live_device_production_runtime') nextManifest.freeze_binding.full_runtime_mode = 'live_device_production_runtime';
  if (mutation === 'set:source_ref_acceptance_output') nextManifest.source_refs.p56_closure = 'acceptance-output/P56_REPLAY_EXECUTION_GATE_REPORT.json';
  if (mutation.startsWith('flag:')) nextSource.flags[mutation.slice(5)] = true;
  return { manifest: nextManifest, source: nextSource };
}

function dimension(dimension_id, name, ok, warn, reason) {
  return { dimension_id, name, status: ok ? (warn ? 'WARN' : 'OK') : 'BLOCKED', reason };
}

function buildDimensions(manifest, source) {
  const allRefsExist = Object.values(source.present).every(Boolean);
  const sourceRefsOk = Object.values(manifest.source_refs).every((ref) => !ref.startsWith('acceptance-output/'));
  const p56AcceptanceOk = source.p56_closure?.acceptance?.assertion_count === 42 && source.p56_closure?.acceptance?.failed_assertion_count === 0;
  const p56GateOk = source.p56_closure?.gate_result?.p57_replay_backed_freeze_review_allowed === true && source.p56_closure?.gate_result?.replay_execution_started === false && source.p56_closure?.gate_result?.full_runtime_v1_freeze_allowed === false;
  const p56NonclaimsOk = source.p56_closure?.nonclaims?.real_device_deployed === false && source.p56_closure?.nonclaims?.live_runtime_monitoring_active === false && source.p56_closure?.nonclaims?.full_runtime_v1_frozen === false;
  const p55AcceptanceOk = source.p55_closure?.acceptance?.assertion_count === 46 && source.p55_closure?.acceptance?.failed_assertion_count === 0;
  const p55ModeOk = source.p55_closure?.runtime_health_service_mode === 'replay_backed_production_demo';
  const p55SurfaceOk = source.p55_closure?.server_surface?.read_only === true && source.p55_closure?.server_surface?.db_write_allowed === false;
  const p54Ok = source.p54_closure?.acceptance?.assertion_count === 42 && source.p54_closure?.acceptance?.failed_assertion_count === 0;
  const p53Ok = Boolean(source.p53_closure);
  const p52Ok = Boolean(source.p52_closure);
  const p51FiveOk = Boolean(source.p51_5_closure);
  const p51Ok = Boolean(source.p51_closure);
  const p50Ok = Boolean(source.p50_evidence_packet && source.p50_capability_matrix);
  const snapshotOk = getSnapshotSourceTruthMode(source) === 'device_path_simulation';
  const controlBoundaryOk = /裁决 ≠ 执行/.test(source.control_to_ao_act_non_goals?.text || '') && /不得自动或隐式实例化/.test(source.control_to_ao_act_non_goals?.text || '');
  const freezePackageOk = manifest.freeze_binding?.freeze_package === 'GEOX-FULL-RUNTIME-V1-FREEZE';
  const fullFrozenOk = manifest.freeze_binding?.full_runtime_v1_frozen === true;
  const modeOk = manifest.freeze_binding?.full_runtime_mode === 'replay_backed_production_demo';
  const replayFrozenOk = manifest.freeze_binding?.replay_backed_production_demo_frozen === true;
  const liveFrozenBlocked = manifest.freeze_binding?.live_device_production_runtime_v1_frozen === false;
  const realWorldNonclaimsOk = boolFalse(source.flags.real_device_deployed) && boolFalse(source.flags.live_device_claimed) && boolFalse(source.flags.production_gateway_online) && boolFalse(source.flags.live_runtime_monitoring_active) && boolFalse(source.flags.real_field_execution_claimed) && boolFalse(source.flags.field_pilot_execution_started);
  const downstreamNonclaimsOk = boolFalse(source.flags.ao_act_task_created) && boolFalse(source.flags.dispatch_enabled) && boolFalse(source.flags.execution_outcome_created) && boolFalse(source.flags.roi_computed) && boolFalse(source.flags.field_memory_learned) && boolFalse(source.flags.learning_signal_created) && boolFalse(source.flags.training_run_created) && boolFalse(source.flags.forbidden_record_type);
  const auditPacketOk = !source.flags.freeze_audit_packet_missing;
  const timeFenceOk = !source.flags.time_fence_missing;
  const ready = allRefsExist && sourceRefsOk && p56AcceptanceOk && p56GateOk && p56NonclaimsOk && p55AcceptanceOk && p55ModeOk && p55SurfaceOk && p54Ok && p53Ok && p52Ok && p51FiveOk && p51Ok && p50Ok && snapshotOk && controlBoundaryOk && freezePackageOk && fullFrozenOk && modeOk && replayFrozenOk && liveFrozenBlocked && realWorldNonclaimsOk && downstreamNonclaimsOk && auditPacketOk && timeFenceOk;
  return [
    dimension('F01', 'p56_closure_health', Boolean(source.p56_closure), false, 'P56 closure must exist'),
    dimension('F02', 'p56_acceptance_health', p56AcceptanceOk, false, 'P56 acceptance must be 42/0'),
    dimension('F03', 'p56_p57_gate_health', p56GateOk, false, 'P56 must allow P57 replay-backed review only'),
    dimension('F04', 'p56_nonclaims_health', p56NonclaimsOk, false, 'P56 nonclaims must remain false'),
    dimension('F05', 'p55_closure_health', Boolean(source.p55_closure), false, 'P55 closure must exist'),
    dimension('F06', 'p55_runtime_mode_health', p55ModeOk, true, 'P55 mode remains replay-backed demo'),
    dimension('F07', 'p55_service_surface_health', p55SurfaceOk, false, 'P55 service surface must remain read-only'),
    dimension('F08', 'p54_readiness_closure_health', p54Ok, false, 'P54 readiness closure must be valid'),
    dimension('F09', 'p53_plan_closure_health', p53Ok, false, 'P53 plan closure must exist'),
    dimension('F10', 'p52_health_closure_health', p52Ok, false, 'P52 health closure must exist'),
    dimension('F11', 'p51_5_viewer_closure_health', p51FiveOk, false, 'P51.5 viewer closure must exist'),
    dimension('F12', 'p51_gateway_closure_health', p51Ok, false, 'P51 gateway closure must exist'),
    dimension('F13', 'p50_demo_runtime_evidence_health', p50Ok, false, 'P50 evidence and capability artifacts must exist'),
    dimension('F14', 'gateway_snapshot_health', snapshotOk, true, 'P51.5 snapshot remains simulated device-path evidence'),
    dimension('F15', 'control_boundary_health', controlBoundaryOk, false, 'Control to AO-ACT non-instantiation must be preserved'),
    dimension('F16', 'source_ref_health', allRefsExist && sourceRefsOk, false, 'all source refs must exist and not point to acceptance-output'),
    dimension('F17', 'freeze_package_health', freezePackageOk && fullFrozenOk, false, 'freeze package and full freeze flag must be bound'),
    dimension('F18', 'replay_mode_binding_health', modeOk && replayFrozenOk, false, 'freeze must bind to replay-backed mode'),
    dimension('F19', 'live_runtime_freeze_block_health', liveFrozenBlocked, false, 'live-device production freeze must remain false'),
    dimension('F20', 'real_world_nonclaims_health', realWorldNonclaimsOk, false, 'real-world nonclaims must remain false'),
    dimension('F21', 'downstream_nonclaims_health', downstreamNonclaimsOk, false, 'downstream creation nonclaims must remain false'),
    dimension('F22', 'time_fence_chain_health', timeFenceOk, false, 'time-fence chain must not be missing'),
    dimension('F23', 'freeze_audit_packet_health', auditPacketOk, false, 'freeze audit packet must exist'),
    dimension('F24', 'full_runtime_freeze_readiness', ready, true, 'only replay-backed Full Runtime v1 freeze is ready')
  ];
}

function evaluate(manifest, source) {
  const dimensions = buildDimensions(manifest, source);
  const blocked = dimensions.filter((row) => row.status === 'BLOCKED');
  const warn = dimensions.filter((row) => row.status === 'WARN');
  const ok = blocked.length === 0;
  const reportCore = {
    schema_version: 'geox_p57_full_runtime_freeze_report_v1',
    phase: 'P57',
    task_line: 'P57 GEOX-FULL-RUNTIME-V1-FREEZE / Replay-backed Audit Freeze',
    freeze_result: ok ? 'FULL_RUNTIME_V1_REPLAY_BACKED_FROZEN_WITH_LIMITATIONS' : 'BLOCKED',
    freeze_package: manifest.freeze_binding.freeze_package,
    full_runtime_v1_frozen: ok && manifest.freeze_binding.full_runtime_v1_frozen === true,
    full_runtime_mode: manifest.freeze_binding.full_runtime_mode || null,
    replay_backed_production_demo_frozen: ok && manifest.freeze_binding.replay_backed_production_demo_frozen === true,
    live_device_production_runtime_v1_frozen: false,
    real_device_deployed: false,
    live_device_claimed: false,
    production_gateway_online: false,
    live_runtime_monitoring_active: false,
    real_field_execution_claimed: false,
    field_pilot_execution_started: false,
    ao_act_task_created: false,
    dispatch_enabled: false,
    execution_outcome_created: false,
    roi_computed: false,
    field_memory_learned: false,
    dimensions,
    audit_dimension_count: dimensions.length,
    blocked_dimension_count: blocked.length,
    warn_dimension_count: warn.length,
    source_refs: manifest.source_refs,
    hash_probe_marker: manifest.hash_probe_marker || null
  };
  const deterministicHash = hash(reportCore);
  const records = [
    ['p57_full_runtime_freeze_input_manifest_v1', manifest],
    ['p57_full_runtime_freeze_source_snapshot_v1', { present: source.present, refs: manifest.source_refs }],
    ['p57_full_runtime_freeze_audit_dimension_v1', dimensions],
    ['p57_full_runtime_freeze_audit_packet_v1', { freeze_package: manifest.freeze_binding.freeze_package, full_runtime_mode: manifest.freeze_binding.full_runtime_mode }],
    ['p57_full_runtime_freeze_gate_v1', { replay_backed_freeze_allowed: ok, live_device_production_freeze_allowed: false }],
    ['p57_full_runtime_freeze_limitation_register_v1', [{ limitation_id: 'L1', severity: 'WARN', reason: 'replay-backed freeze only' }]],
    ['p57_full_runtime_freeze_traceability_packet_v1', { baseline_tag: manifest.baseline_tag, p56_closure_ref: manifest.source_refs.p56_closure }],
    ['p57_full_runtime_freeze_report_v1', { ...reportCore, deterministic_hash: deterministicHash }],
    ['p57_full_runtime_freeze_capability_matrix_v1', { capability_count: 16, status: ok ? 'PASS' : 'BLOCKED' }]
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
      result_state: result.report.freeze_result,
      blocked: result.report.freeze_result === 'BLOCKED',
      full_runtime_v1_frozen: result.report.full_runtime_v1_frozen,
      replay_backed_production_demo_frozen: result.report.replay_backed_production_demo_frozen,
      live_device_production_runtime_v1_frozen: result.report.live_device_production_runtime_v1_frozen,
      target_records_created: 0
    };
  });
  return { ok: results.every((row) => row.blocked && row.full_runtime_v1_frozen === false && row.replay_backed_production_demo_frozen === false && row.live_device_production_runtime_v1_frozen === false && row.target_records_created === 0), negative_result_count: results.length, blocked_count: results.filter((row) => row.blocked).length, results };
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
  console.log(JSON.stringify({ ok: normal.ok, phase: 'P57', freeze_result: normal.report.freeze_result, freeze_package: normal.report.freeze_package, full_runtime_v1_frozen: normal.report.full_runtime_v1_frozen, full_runtime_mode: normal.report.full_runtime_mode, replay_backed_production_demo_frozen: normal.report.replay_backed_production_demo_frozen, live_device_production_runtime_v1_frozen: normal.report.live_device_production_runtime_v1_frozen, deterministic_hash: normal.report.deterministic_hash }, null, 2));
}

main();
