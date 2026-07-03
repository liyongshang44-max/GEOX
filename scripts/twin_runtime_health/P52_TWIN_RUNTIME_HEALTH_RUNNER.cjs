// scripts/twin_runtime_health/P52_TWIN_RUNTIME_HEALTH_RUNNER.cjs
'use strict';

// Purpose: evaluate the controlled P52 Twin Runtime Health gate from closed P50/P51/P51.5 evidence.
// Boundary: this script writes only local P52 acceptance-output files in controlled-write mode.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_MANIFEST = 'fixtures/twin_runtime_health/P52_TWIN_RUNTIME_HEALTH_INPUT_MANIFEST.json';
const DEFAULT_NEGATIVE_MANIFEST = 'fixtures/twin_runtime_health/P52_NEGATIVE_FIXTURE_MANIFEST.json';
const OUTPUT_LEDGER = 'acceptance-output/P52_TWIN_RUNTIME_HEALTH_LEDGER.jsonl';
const OUTPUT_REPORT = 'acceptance-output/P52_TWIN_RUNTIME_HEALTH_REPORT.json';

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

function parseP50Closure(text) {
  const acc = text.match(/acceptance\s*=\s*(\d+)\s*\/\s*(\d+)/);
  const deterministic = text.match(/deterministic_hash\s*=\s*([a-f0-9]+)/);
  return {
    assertion_count: acc ? Number(acc[1]) : null,
    failed_assertion_count: acc ? Number(acc[2]) : null,
    deterministic_hash: deterministic ? deterministic[1] : null,
  };
}

function loadSources(manifest) {
  const refs = manifest.source_refs;
  const present = Object.fromEntries(Object.entries(refs).map(([key, ref]) => [key, exists(ref)]));
  const source = { refs, present, flags: {} };
  if (present.p50_closure) source.p50_closure = parseP50Closure(readText(refs.p50_closure));
  if (present.p50_completion_review) source.p50_completion_review = readJson(refs.p50_completion_review);
  if (present.p50_evidence_packet) source.p50_evidence_packet = readJson(refs.p50_evidence_packet);
  if (present.p51_closure) source.p51_closure = readJson(refs.p51_closure);
  if (present.p51_evidence_packet) source.p51_evidence_packet = readJson(refs.p51_evidence_packet);
  if (present.p51_5_closure) source.p51_5_closure = readJson(refs.p51_5_closure);
  if (present.p51_5_snapshot) source.p51_5_snapshot = readJson(refs.p51_5_snapshot);
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
    next.present.p50_closure = false;
    delete next.p50_closure;
  }
  return next;
}

function dim(id, name, state, reason, refs) {
  return { dimension_id: id, name, state, reason, evidence_refs: refs };
}

function evaluate(manifest, source) {
  const snapshot = source.p51_5_snapshot;
  const skewWarn = snapshot?.clock_skew_summary?.clock_skew_warn_count ?? null;
  const skewBlocked = snapshot?.clock_skew_summary?.clock_skew_blocked_count ?? null;
  const rows = [];
  rows.push(dim('H1', 'baseline_integrity_health', manifest.baseline_tag === 'p51_5_gateway_backed_twin_demo_viewer_v0_closure' && manifest.baseline_commit === 'e764c0f36fbf50dfecf5de2ac8ce9dd2367eecd9' ? 'OK' : 'BLOCKED', 'P52 baseline must match the P51.5 closure tag and commit.', [manifest.baseline_tag]));
  rows.push(dim('H2', 'p50_runtime_chain_health', source.present.p50_closure && source.p50_closure?.assertion_count === 146 && source.p50_closure?.failed_assertion_count === 0 && source.present.p50_evidence_packet ? 'OK' : 'BLOCKED', 'P50 requires P50-CLOSURE.md with acceptance 146/0; completion review alone is insufficient.', [source.refs.p50_closure, source.refs.p50_completion_review, source.refs.p50_evidence_packet]));
  rows.push(dim('H3', 'p51_gateway_path_health', source.p51_closure?.acceptance?.assertion_count === 151 && source.p51_closure?.acceptance?.failed_assertion_count === 0 ? 'OK' : 'BLOCKED', 'P51 closure must preserve acceptance 151/0.', [source.refs.p51_closure, source.refs.p51_evidence_packet]));
  rows.push(dim('H4', 'p51_5_viewer_snapshot_health', source.p51_5_closure?.acceptance?.assertion_count === 57 && source.p51_5_closure?.acceptance?.failed_assertion_count === 0 && source.present.p51_5_snapshot && Array.isArray(snapshot?.nonclaims) && snapshot.nonclaims.length >= 8 ? 'OK' : 'BLOCKED', 'P51.5 closure and checked-in snapshot must be present.', [source.refs.p51_5_closure, source.refs.p51_5_snapshot]));
  rows.push(dim('H5', 'source_truth_boundary_health', snapshot?.identity?.source_truth_mode === 'device_path_simulation' && source.p50_evidence_packet?.source_truth_mode === 'historical_replay' ? 'OK' : 'BLOCKED', 'P50 remains historical replay and P51.5 remains device-path simulation.', [source.refs.p50_evidence_packet, source.refs.p51_5_snapshot]));
  rows.push(dim('H6', 'traceability_health', snapshot?.traceability_readback?.trace_count === 21 ? 'OK' : 'BLOCKED', 'Traceability readback must preserve 21 accepted gateway traces.', [source.refs.p51_5_snapshot]));
  rows.push(dim('H7', 'deterministic_hash_health', Boolean(source.p50_closure?.deterministic_hash && source.p51_closure?.acceptance?.deterministic_hash && snapshot?.hashes && Object.keys(snapshot.hashes).length >= 8) ? 'OK' : 'BLOCKED', 'P50, P51, and P51.5 hashes must remain available.', [source.refs.p50_closure, source.refs.p51_closure, source.refs.p51_5_snapshot]));
  rows.push(dim('H8', 'timing_order_health', source.present.p50_evidence_packet && source.present.p51_closure && source.present.p51_5_closure ? 'OK' : 'BLOCKED', 'P50, P51, and P51.5 stages must exist before P52.', [source.refs.p50_evidence_packet, source.refs.p51_closure, source.refs.p51_5_closure]));
  rows.push(dim('H9', 'gateway_clock_skew_health', skewBlocked > 0 ? 'BLOCKED' : (skewWarn > 0 ? 'WARN' : 'OK'), 'Gateway clock-skew warning is preserved as a planning limitation when blocked count is zero.', [source.refs.p51_5_snapshot]));
  rows.push(dim('H10', 'duplicate_handling_health', snapshot?.duplicate_summary?.duplicate_same_payload_deduped_count === 1 && snapshot?.duplicate_summary?.duplicate_conflict_blocked_count === 1 ? 'OK' : 'BLOCKED', 'Duplicate same-payload and conflict handling must remain visible.', [source.refs.p51_5_snapshot]));
  rows.push(dim('H11', 'device_evidence_health_scope_boundary', Array.isArray(snapshot?.device_health) && snapshot.device_health.every((row) => row.health_scope === 'device_evidence_health_only') ? 'OK' : 'BLOCKED', 'Device health fields remain evidence-scope only.', [source.refs.p51_5_snapshot]));
  rows.push(dim('H12', 'no_downstream_creation_health', source.flags.runtime_service || source.flags.field_execution || source.flags.ao_act || source.flags.full_freeze ? 'BLOCKED' : 'OK', 'P52 may only create P52-prefixed controlled health records.', ['docs/twin_runtime_health/GEOX-P52-TWIN-RUNTIME-HEALTH-BOUNDARY-POLICY.json']));
  rows.push(dim('H13', 'p53_planning_readiness_health', rows.some((row) => row.state === 'BLOCKED') ? 'BLOCKED' : 'OK', 'P53 planning is allowed only when no BLOCKED dimension exists.', ['fixtures/twin_runtime_health/P52_EXPECTED_HEALTH_GATE.json']));
  const blocked = rows.filter((row) => row.state === 'BLOCKED').length;
  const warned = rows.filter((row) => row.state === 'WARN').length;
  const result = blocked > 0 ? 'BLOCKED' : (warned > 0 ? 'READY_WITH_WARNINGS' : 'READY');
  const limitations = skewWarn > 0 && skewBlocked === 0 ? [{ limitation_id: 'L1', severity: 'WARN', source_dimension_id: 'H9', summary: 'One gateway clock-skew warning is preserved from P51/P51.5 evidence.' }] : [];
  const gate = { record_type: 'p52_twin_runtime_health_gate_v1', p53_field_pilot_plan_allowed: blocked === 0, field_pilot_execution_allowed: false, production_runtime_monitoring_enabled: false, full_runtime_v1_freeze_allowed: false };
  const traceability = { record_type: 'p52_twin_runtime_health_traceability_readback_v1', source_refs: source.refs, p50_acceptance: source.p50_closure, p51_acceptance: source.p51_closure?.acceptance ?? null, p51_5_acceptance: source.p51_5_closure?.acceptance ?? null, p51_5_trace_count: snapshot?.traceability_readback?.trace_count ?? 0 };
  const capability = { record_type: 'p52_twin_runtime_health_capability_matrix_v1', capability_count: 16, status: blocked === 0 ? 'PASS' : 'BLOCKED' };
  const core = { schema_version: 'geox_p52_twin_runtime_health_report_v1', phase: 'P52', baseline_tag: manifest.baseline_tag, baseline_commit: manifest.baseline_commit, runtime_health_result: result, dimensions: rows, blocked_dimension_count: blocked, warn_dimension_count: warned, limitation_register: limitations, p53_planning_gate: gate, traceability_readback: traceability, capability_matrix: capability, hash_probe_marker: manifest.hash_probe_marker || null };
  const deterministic = sha(core);
  const recordSeeds = [['p52_twin_runtime_health_input_manifest_v1', manifest], ['p52_twin_runtime_health_source_snapshot_v1', { present: source.present, refs: source.refs }], ...rows.map((row) => ['p52_twin_runtime_health_dimension_v1', row]), ['p52_twin_runtime_health_limitation_register_v1', limitations], ['p52_twin_runtime_health_gate_v1', gate], ['p52_twin_runtime_health_traceability_readback_v1', traceability], ['p52_twin_runtime_health_capability_matrix_v1', capability], ['p52_twin_runtime_health_report_v1', { ...core, deterministic_hash: deterministic }]];
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
  console.log(JSON.stringify({ ok: normal.ok, phase: 'P52', runtime_health_result: normal.report.runtime_health_result, blocked_dimension_count: normal.report.blocked_dimension_count, warn_dimension_count: normal.report.warn_dimension_count, deterministic_hash: normal.report.deterministic_hash, p53_field_pilot_plan_allowed: normal.report.p53_planning_gate.p53_field_pilot_plan_allowed, field_pilot_execution_allowed: normal.report.p53_planning_gate.field_pilot_execution_allowed }, null, 2));
}

main();
