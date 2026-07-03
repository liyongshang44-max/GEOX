// scripts/twin_runtime_health/P52_TWIN_RUNTIME_HEALTH_RUNNER.cjs
'use strict';

// Purpose: evaluate the P52 artifact-level controlled Twin Runtime Health gate.
// Boundary: reads committed artifacts and writes only local P52 acceptance-output files in controlled-write mode.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_MANIFEST = 'fixtures/twin_runtime_health/P52_TWIN_RUNTIME_HEALTH_INPUT_MANIFEST.json';
const DEFAULT_NEGATIVE_MANIFEST = 'fixtures/twin_runtime_health/P52_NEGATIVE_FIXTURE_MANIFEST.json';
const OUTPUT_LEDGER = 'acceptance-output/P52_TWIN_RUNTIME_HEALTH_LEDGER.jsonl';
const OUTPUT_REPORT = 'acceptance-output/P52_TWIN_RUNTIME_HEALTH_REPORT.json';

const REQUIRED_P50_DEMO_REFS = [
  'runtime_cycle_ref',
  'state_estimate_ref',
  'forecast_ref',
  'residual_ref',
  'calibration_review_ref',
  'active_model_consumption_ref',
  'next_forecast_ref',
  'traceability_packet_ref',
];

const REQUIRED_P50_HASH_SLOTS = [
  'manifest_hash',
  'evidence_partition_hash',
  'runtime_cycle_hash',
  'state_estimate_hash',
  'forecast_hash',
  'residual_hash',
  'calibration_review_hash',
  'active_model_consumption_hash',
  'next_forecast_hash',
  'traceability_packet_hash',
  'determinism_hash',
];

function args(argv) {
  const out = { mode: 'controlled-health-evaluate', manifest: DEFAULT_MANIFEST, negativeManifest: DEFAULT_NEGATIVE_MANIFEST };
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

function sha(value) {
  return crypto.createHash('sha256').update(stable(value)).digest('hex');
}

function resolvePath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

function readText(filePath) {
  return fs.readFileSync(resolvePath(filePath), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function exists(filePath) {
  return fs.existsSync(resolvePath(filePath));
}

function allPass(matrix) {
  return Array.isArray(matrix?.capabilities) && matrix.capabilities.length > 0 && matrix.capabilities.every((row) => row.status === 'PASS');
}

function loadSources(manifest) {
  const refs = { ...manifest.source_refs, ...(manifest.optional_source_refs || {}) };
  const present = Object.fromEntries(Object.entries(refs).map(([key, ref]) => [key, exists(ref)]));
  const source = { refs, hard_refs: manifest.source_refs, optional_refs: manifest.optional_source_refs || {}, present, flags: {} };
  for (const [key, ref] of Object.entries(refs)) {
    if (present[key] && ref.endsWith('.json')) source[key] = readJson(ref);
  }
  return source;
}

function mutate(source, fixture) {
  const next = JSON.parse(JSON.stringify(source));
  if (fixture.scenario === 'missing_p51_5_snapshot') {
    next.present.p51_5_snapshot = false;
    delete next.p51_5_snapshot;
  }
  if (fixture.scenario === 'wrong_source_truth_mode' && next.p51_5_snapshot) next.p51_5_snapshot.identity.source_truth_mode = fixture.source_truth_mode;
  if (fixture.scenario === 'missing_traceability' && next.p51_5_snapshot) next.p51_5_snapshot.traceability_readback = { trace_count: 0, rows: [] };
  if ((fixture.scenario === 'missing_nonclaims' || fixture.scenario === 'boundary_list_absent') && next.p51_5_snapshot) next.p51_5_snapshot.nonclaims = [];
  if (fixture.scenario === 'runtime_service_flag') next.flags.runtime_service = true;
  if (fixture.scenario === 'field_execution_flag') next.flags.field_execution = true;
  if (fixture.scenario === 'ao_act_flag') next.flags.ao_act = true;
  if (fixture.scenario === 'full_freeze_flag') next.flags.full_freeze = true;
  if (fixture.scenario === 'p50_review_only_path' || fixture.scenario === 'stale_p50_completion_only') {
    next.present.p50_evidence_packet = false;
    next.present.p50_capability_matrix = false;
    delete next.p50_evidence_packet;
    delete next.p50_capability_matrix;
  }
  return next;
}

function dim(id, name, state, reason, refs) {
  return { dimension_id: id, name, state, reason, evidence_refs: refs };
}

function hasRequiredDemoRefs(packet) {
  return REQUIRED_P50_DEMO_REFS.every((key) => typeof packet?.demo_record_refs?.[key] === 'string');
}

function hasComputedHashPosture(packet) {
  return REQUIRED_P50_HASH_SLOTS.every((key) => packet?.hashes?.[key] === 'computed_by_runner');
}

function evaluate(manifest, source) {
  const snapshot = source.p51_5_snapshot;
  const p50Packet = source.p50_evidence_packet;
  const p50Matrix = source.p50_capability_matrix;
  const p51Packet = source.p51_evidence_packet;
  const p51Matrix = source.p51_capability_matrix;
  const p515Matrix = source.p51_5_capability_matrix;
  const skewWarn = snapshot?.clock_skew_summary?.clock_skew_warn_count ?? null;
  const skewBlocked = snapshot?.clock_skew_summary?.clock_skew_blocked_count ?? null;
  const rows = [];

  rows.push(dim('H1', 'baseline_closure_health', manifest.baseline_tag === 'p51_5_gateway_backed_twin_demo_viewer_v0_closure' && manifest.baseline_commit === 'e764c0f36fbf50dfecf5de2ac8ce9dd2367eecd9' ? 'OK' : 'BLOCKED', 'P52 baseline must match the P51.5 closure tag and commit.', [manifest.baseline_tag]));
  rows.push(dim('H2', 'p50_demo_runtime_artifact_health', source.present.p50_evidence_packet && source.present.p50_capability_matrix && p50Packet?.source_truth_mode === 'historical_replay' && allPass(p50Matrix) ? 'OK' : 'BLOCKED', 'P50 evidence packet and capability matrix must be committed and coherent.', [source.refs.p50_evidence_packet, source.refs.p50_capability_matrix]));
  rows.push(dim('H3', 'p50_runtime_chain_ref_health', hasRequiredDemoRefs(p50Packet) ? 'OK' : 'BLOCKED', 'P50 evidence packet must carry required demo runtime chain refs.', [source.refs.p50_evidence_packet]));
  rows.push(dim('H4', 'p51_gateway_artifact_health', source.present.p51_evidence_packet && source.present.p51_capability_matrix && p51Packet?.source_truth_mode === 'device_path_simulation' && p51Packet?.capability_count === 21 && allPass(p51Matrix) ? 'OK' : 'BLOCKED', 'P51 gateway evidence and capability artifacts must remain coherent.', [source.refs.p51_evidence_packet, source.refs.p51_capability_matrix]));
  rows.push(dim('H5', 'p51_gateway_traceability_health', source.p51_closure?.acceptance?.assertion_count === 151 && source.p51_closure?.acceptance?.failed_assertion_count === 0 && Boolean(p51Packet?.output_refs?.snapshot) ? 'OK' : 'BLOCKED', 'P51 closure acceptance and output refs must remain available.', [source.refs.p51_closure, source.refs.p51_evidence_packet]));
  rows.push(dim('H6', 'p51_5_viewer_artifact_health', source.p51_5_closure?.acceptance?.assertion_count === 57 && source.p51_5_closure?.acceptance?.failed_assertion_count === 0 && source.present.p51_5_snapshot && snapshot?.gateway_summary?.accepted_observation_count === 21 && snapshot?.traceability_readback?.trace_count === 21 && allPass(p515Matrix) ? 'OK' : 'BLOCKED', 'P51.5 closure, capability matrix, checked-in viewer snapshot, and viewer traceability must be present.', [source.refs.p51_5_closure, source.refs.p51_5_capability_matrix, source.refs.p51_5_snapshot]));
  rows.push(dim('H7', 'source_truth_boundary_health', p50Packet?.source_truth_mode === 'historical_replay' && p51Packet?.source_truth_mode === 'device_path_simulation' && snapshot?.identity?.source_truth_mode === 'device_path_simulation' ? 'OK' : 'BLOCKED', 'P50 remains historical replay; P51/P51.5 remain device-path simulation.', [source.refs.p50_evidence_packet, source.refs.p51_evidence_packet, source.refs.p51_5_snapshot]));
  rows.push(dim('H8', 'nonclaim_boundary_health', p50Packet?.nonclaims?.not_runtime_health_service === true && p50Packet?.nonclaims?.not_full_runtime_v1_freeze === true && source.p51_closure?.nonclaims?.runtime_health_v1 === false && source.p51_5_closure?.nonclaims?.runtime_health_v1_implemented === false && Array.isArray(snapshot?.nonclaims) && snapshot.nonclaims.length >= 8 ? 'OK' : 'BLOCKED', 'P50/P51/P51.5 nonclaims must remain explicit.', [source.refs.p50_evidence_packet, source.refs.p51_closure, source.refs.p51_5_closure, source.refs.p51_5_snapshot]));
  rows.push(dim('H9', 'deterministic_posture_health', hasComputedHashPosture(p50Packet) && typeof source.p51_closure?.acceptance?.deterministic_hash === 'string' && snapshot?.hashes && Object.keys(snapshot.hashes).length >= 8 && manifest.p50_concrete_hash_recomputation_claimed === false ? 'OK' : 'BLOCKED', 'P52 verifies declared deterministic posture and does not recompute concrete P50 hashes.', [source.refs.p50_evidence_packet, source.refs.p51_closure, source.refs.p51_5_snapshot]));
  rows.push(dim('H10', 'gateway_clock_skew_health', skewBlocked > 0 ? 'BLOCKED' : (skewWarn > 0 ? 'WARN' : 'OK'), 'Gateway clock-skew warning is preserved as a planning limitation when blocked count is zero.', [source.refs.p51_5_snapshot]));
  rows.push(dim('H11', 'duplicate_handling_health', snapshot?.duplicate_summary?.duplicate_same_payload_deduped_count === 1 && snapshot?.duplicate_summary?.duplicate_conflict_blocked_count === 1 ? 'OK' : 'BLOCKED', 'Duplicate same-payload and conflict handling must remain visible.', [source.refs.p51_5_snapshot]));
  rows.push(dim('H12', 'no_downstream_creation_health', source.flags.runtime_service || source.flags.field_execution || source.flags.ao_act || source.flags.full_freeze || manifest.production_runtime_health_service_implemented !== false ? 'BLOCKED' : 'OK', 'P52 may only create P52-prefixed controlled health records.', ['docs/twin_runtime_health/GEOX-P52-TWIN-RUNTIME-HEALTH-BOUNDARY-POLICY.json']));
  rows.push(dim('H13', 'p53_planning_gate_health', rows.some((row) => row.state === 'BLOCKED') ? 'BLOCKED' : 'OK', 'P53 planning is allowed only when no BLOCKED dimension exists.', ['fixtures/twin_runtime_health/P52_EXPECTED_HEALTH_GATE.json']));

  const blocked = rows.filter((row) => row.state === 'BLOCKED').length;
  const warned = rows.filter((row) => row.state === 'WARN').length;
  const result = blocked > 0 ? 'BLOCKED' : 'READY_WITH_WARNINGS';
  const warningReasons = manifest.warning_reasons || [];
  const limitations = warningReasons.map((reason, index) => ({ limitation_id: `L${index + 1}`, severity: 'WARN', reason }));
  const gate = { record_type: 'p52_twin_runtime_health_gate_v1', p53_field_pilot_plan_allowed: blocked === 0, field_pilot_execution_allowed: false, production_runtime_monitoring_enabled: false, full_runtime_v1_freeze_allowed: false };
  const traceability = { record_type: 'p52_twin_runtime_health_traceability_readback_v1', hard_source_refs: source.hard_refs, optional_source_refs: source.optional_refs, p50_demo_record_refs: p50Packet?.demo_record_refs ?? null, p50_hash_posture: p50Packet?.hashes ?? null, p50_concrete_hash_recomputation_claimed: false, p51_acceptance: source.p51_closure?.acceptance ?? null, p51_5_acceptance: source.p51_5_closure?.acceptance ?? null, p51_5_trace_count: snapshot?.traceability_readback?.trace_count ?? 0 };
  const capability = { record_type: 'p52_twin_runtime_health_capability_matrix_v1', capability_count: 16, status: blocked === 0 ? 'PASS' : 'BLOCKED' };
  const core = { schema_version: 'geox_p52_twin_runtime_health_report_v1', phase: 'P52', task_line: 'P52 Controlled Twin Runtime Health Gate v1', health_scope: manifest.health_scope, baseline_tag: manifest.baseline_tag, baseline_commit: manifest.baseline_commit, runtime_health_result: result, warning_reasons: warningReasons, production_runtime_health_service_implemented: false, p50_concrete_hash_recomputation_claimed: false, dimensions: rows, blocked_dimension_count: blocked, warn_dimension_count: warned, limitation_register: limitations, p53_planning_gate: gate, traceability_readback: traceability, capability_matrix: capability, hash_probe_marker: manifest.hash_probe_marker || null };
  const deterministic = sha(core);
  const recordSeeds = [['p52_twin_runtime_health_input_manifest_v1', manifest], ['p52_twin_runtime_health_source_snapshot_v1', { present: source.present, hard_refs: source.hard_refs, optional_refs: source.optional_refs }], ...rows.map((row) => ['p52_twin_runtime_health_dimension_v1', row]), ['p52_twin_runtime_health_limitation_register_v1', limitations], ['p52_twin_runtime_health_gate_v1', gate], ['p52_twin_runtime_health_traceability_readback_v1', traceability], ['p52_twin_runtime_health_capability_matrix_v1', capability], ['p52_twin_runtime_health_report_v1', { ...core, deterministic_hash: deterministic }]];
  const records = recordSeeds.map(([record_type, payload]) => ({ record_type, payload, record_timestamp: manifest.as_of_ts, record_hash: sha({ record_type, payload }) }));
  return { ok: blocked === 0, report: { ...core, deterministic_hash: deterministic }, records };
}

function runNormal(manifestPath) {
  const manifest = readJson(manifestPath);
  return evaluate(manifest, loadSources(manifest));
}

function runNegative(manifestPath, negativeManifestPath) {
  const manifest = readJson(manifestPath);
  const source = loadSources(manifest);
  const negativeManifest = readJson(negativeManifestPath);
  const results = negativeManifest.negative_fixture_refs.map((ref) => {
    const fixture = readJson(ref);
    const result = evaluate(manifest, mutate(source, fixture));
    return { scenario_id: fixture.scenario_id, result_state: result.report.runtime_health_result, blocked: result.report.blocked_dimension_count > 0, target_records_created: 0, p53_field_pilot_plan_allowed: result.report.p53_planning_gate.p53_field_pilot_plan_allowed };
  });
  return { ok: results.every((row) => row.blocked && row.target_records_created === 0 && row.p53_field_pilot_plan_allowed === false), negative_result_count: results.length, blocked_count: results.filter((row) => row.blocked).length, results };
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
  if (parsed.mode === 'controlled-source-scan') {
    console.log(JSON.stringify(normal.report.traceability_readback, null, 2));
    return;
  }
  if (parsed.mode === 'controlled-gate') {
    console.log(JSON.stringify(normal.report.p53_planning_gate, null, 2));
    return;
  }
  if (parsed.mode === 'controlled-write') writeOutputs(normal);
  console.log(JSON.stringify({ ok: normal.ok, phase: 'P52', task_line: normal.report.task_line, health_scope: normal.report.health_scope, runtime_health_result: normal.report.runtime_health_result, blocked_dimension_count: normal.report.blocked_dimension_count, warn_dimension_count: normal.report.warn_dimension_count, deterministic_hash: normal.report.deterministic_hash, p53_field_pilot_plan_allowed: normal.report.p53_planning_gate.p53_field_pilot_plan_allowed, field_pilot_execution_allowed: normal.report.p53_planning_gate.field_pilot_execution_allowed, production_runtime_health_service_implemented: normal.report.production_runtime_health_service_implemented, p50_concrete_hash_recomputation_claimed: normal.report.p50_concrete_hash_recomputation_claimed }, null, 2));
}

main();
