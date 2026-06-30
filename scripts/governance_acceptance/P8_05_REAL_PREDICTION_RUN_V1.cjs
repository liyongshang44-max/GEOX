// scripts/governance_acceptance/P8_05_REAL_PREDICTION_RUN_V1.cjs
// Purpose: verify the P8-05 Real Prediction Run v1 gate.
// Boundary: validates read-only prediction from P8-04/P8-02 history artifacts only; later P8 files may exist on the same branch.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P8_05_REAL_PREDICTION_RUN_V1';
const NEXT_STEP = 'P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0';
const PREVIOUS_DOC = 'docs/tasks/P8-04-Real-State-Estimate-Runtime-v1.md';
const PREVIOUS_SCRIPT = 'scripts/governance_acceptance/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs';
const CURRENT_DOC = 'docs/tasks/P8-05-Real-Prediction-Run-v1.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P8_05_REAL_PREDICTION_RUN_V1.cjs';
const RUNTIME_SCRIPT = 'scripts/twin_kernel/P8_05_REAL_PREDICTION_RUN_V1.cjs';
const P8_05_FILES = [CURRENT_DOC, CURRENT_SCRIPT, RUNTIME_SCRIPT];
const REQUIRED_FIELDS = ['prediction_run_id', 'output_kind', 'project_id', 'subject_ref', 'sensor_ref', 'sensor_group_ref', 'metric_kind', 'unit', 'prediction_method', 'generated_for_as_of_ts', 'prediction_window_start_ts', 'prediction_window_end_ts', 'horizon_steps', 'step_ms', 'input_state_estimate_ref', 'input_evidence_window_ref', 'starting_estimate_value', 'prediction_points', 'uncertainty_model', 'evidence_refs', 'source_query_ref', 'trace_refs', 'read_only', 'determinism_hash'];
const EXPECTED_TARGETS = ['2009-06-09T05:00:00.000Z', '2009-06-09T06:00:00.000Z', '2009-06-09T07:00:00.000Z'];
const assertions = [];

function abs(file) { return path.resolve(ROOT, file); }
function exists(file) { return fs.existsSync(abs(file)); }
function read(file) { return fs.readFileSync(abs(file), 'utf8'); }
function tryGit(args) { try { return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } }
function changedFilesFromMain() { return [...new Set(tryGit(['diff', '--name-only', 'main...HEAD']).split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].sort(); }
function section(text, heading) { const marker = `## ${heading}`; const start = text.indexOf(marker); if (start < 0) return []; const open = text.indexOf('```text', start); if (open < 0) return []; const bodyStart = text.indexOf('\n', open) + 1; const close = text.indexOf('```', bodyStart); if (close < 0) return []; return text.slice(bodyStart, close).split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function assert(name, condition, details = {}) { assertions.push({ name, passed: condition === true, details }); if (condition !== true) { const error = new Error(`ASSERTION_FAILED:${name}`); error.details = details; throw error; } }
function summary() { const failed = assertions.filter((item) => !item.passed); return { assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) }; }

function verifyDocs() {
  for (const file of [PREVIOUS_DOC, PREVIOUS_SCRIPT, CURRENT_DOC, CURRENT_SCRIPT, RUNTIME_SCRIPT]) assert(`file_exists:${file}`, exists(file), { file });
  assert('p8_04_handoff_verified', read(PREVIOUS_DOC).includes(ACCEPTANCE), { PREVIOUS_DOC });
  const doc = read(CURRENT_DOC);
  assert('doc_has_gate', doc.includes(ACCEPTANCE), { CURRENT_DOC });
  assert('doc_has_next_step', doc.includes(NEXT_STEP), { CURRENT_DOC });
  assert('runtime_file_count', section(doc, 'Runtime files created in P8-05').length === 3, { files: section(doc, 'Runtime files created in P8-05') });
  assert('prediction_window_contract_verified', section(doc, 'Prediction window contract').includes('horizon_steps = 3') && section(doc, 'Prediction window contract').includes('step_ms = 3600000'), { contract: section(doc, 'Prediction window contract') });
  assert('required_output_field_count', section(doc, 'Required output fields').length === REQUIRED_FIELDS.length, { fields: section(doc, 'Required output fields') });
  assert('no_lookahead_rule_count', section(doc, 'No-lookahead runtime rules').length === 7, { rules: section(doc, 'No-lookahead runtime rules') });
  assert('strict_prohibition_count', section(doc, 'Runtime strict prohibitions').length === 16, { rules: section(doc, 'Runtime strict prohibitions') });
}

function verifyRuntimeSource() {
  const runtime = read(RUNTIME_SCRIPT);
  assert('runtime_imports_p8_04_state_estimate', runtime.includes('P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs'), { RUNTIME_SCRIPT });
  assert('runtime_imports_p8_02_history_window', runtime.includes('P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs'), { RUNTIME_SCRIPT });
  assert('runtime_has_no_p8_06_dependency', !runtime.includes('P8_06'), { RUNTIME_SCRIPT });
  assert('runtime_has_no_p8_07_dependency', !runtime.includes('P8_07'), { RUNTIME_SCRIPT });
  assert('runtime_has_no_p8_08_dependency', !runtime.includes('P8_08'), { RUNTIME_SCRIPT });
  assert('runtime_has_no_db_mutation_text', !/insert\s+into|update\s+[^\n]+set|delete\s+from|create\s+table|alter\s+table/i.test(runtime), { RUNTIME_SCRIPT });
}

function runRuntimeJson() {
  const firstText = childProcess.execFileSync('node', [RUNTIME_SCRIPT], { cwd: ROOT, encoding: 'utf8', env: process.env });
  const secondText = childProcess.execFileSync('node', [RUNTIME_SCRIPT], { cwd: ROOT, encoding: 'utf8', env: process.env });
  const first = JSON.parse(firstText);
  const second = JSON.parse(secondText);
  assert('runtime_output_is_deterministic', JSON.stringify(first) === JSON.stringify(second), { first_hash: first.determinism_hash, second_hash: second.determinism_hash });
  return first;
}

function verifyRuntimeOutput(output) {
  for (const field of REQUIRED_FIELDS) assert(`runtime_output_field_present:${field}`, Object.prototype.hasOwnProperty.call(output, field), { output_keys: Object.keys(output) });
  assert('output_kind_verified', output.output_kind === 'real_soil_moisture_prediction_run_v1', { output_kind: output.output_kind });
  assert('scope_verified', output.project_id === 'P_DEFAULT' && output.sensor_group_ref?.ref_id === 'G_CAF' && output.sensor_ref?.ref_id === 'CAF009' && output.metric_kind === 'soil_moisture', { project_id: output.project_id, sensor_group_ref: output.sensor_group_ref, sensor_ref: output.sensor_ref, metric_kind: output.metric_kind });
  assert('reads_real_state_estimate_output', output.input_state_estimate_ref?.kind === 'real_soil_moisture_state_estimate_v1', { input_state_estimate_ref: output.input_state_estimate_ref });
  assert('reads_real_evidence_window_output', output.input_evidence_window_ref?.kind === 'real_evidence_window_v0', { input_evidence_window_ref: output.input_evidence_window_ref });
  assert('prediction_window_verified', output.prediction_window_start_ts === EXPECTED_TARGETS[0] && output.prediction_window_end_ts === EXPECTED_TARGETS[2], { start: output.prediction_window_start_ts, end: output.prediction_window_end_ts });
  assert('prediction_points_count', Array.isArray(output.prediction_points) && output.prediction_points.length === 3, { prediction_points: output.prediction_points });
  assert('prediction_target_timestamps_verified', output.prediction_points.map((point) => point.target_ts).join('|') === EXPECTED_TARGETS.join('|'), { targets: output.prediction_points.map((point) => point.target_ts) });
  assert('prediction_values_numeric', output.prediction_points.every((point) => Number.isFinite(point.predicted_value)), { prediction_points: output.prediction_points });
  assert('metric_level_predictions_present', output.prediction_points.every((point) => Array.isArray(point.prediction_by_metric) && point.prediction_by_metric.length > 0), { prediction_points: output.prediction_points });
  assert('uncertainty_present', output.prediction_points.every((point) => point.uncertainty && Number.isFinite(point.uncertainty.uncertainty_width)), { prediction_points: output.prediction_points });
  assert('evidence_refs_preserved', Array.isArray(output.evidence_refs) && output.evidence_refs.length > 0, { evidence_refs_length: output.evidence_refs?.length });
  assert('source_query_ref_preserved', output.source_query_ref?.kind === 'readonly_postgres_query_ref', { source_query_ref: output.source_query_ref });
  assert('trace_refs_present', Array.isArray(output.trace_refs) && output.trace_refs.length > 0, { trace_refs: output.trace_refs });
  assert('read_only_true', output.read_only === true, { read_only: output.read_only });
  assert('determinism_hash_sha256', /^[a-f0-9]{64}$/.test(output.determinism_hash), { determinism_hash: output.determinism_hash });
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  const scoped = changedFiles.filter((file) => P8_05_FILES.includes(file));
  if (changedFiles.length > 0) assert('p8_05_changed_file_count', scoped.length === 3, { scoped, changedFiles });
  return { changedFiles, scoped };
}

try {
  verifyDocs();
  verifyRuntimeSource();
  const output = runRuntimeJson();
  verifyRuntimeOutput(output);
  const changed = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p8_04_verified: true, reads_real_state_estimate_output: true, prediction_window_verified: true, does_not_query_actual_window: true, prediction_points_count: output.prediction_points.length, prediction_values_numeric: true, uncertainty_present: true, evidence_refs_preserved: true, source_query_ref_preserved: true, read_only: true, determinism_stable: true, changed_file_count: changed.scoped.length, branch_changed_file_count: changed.changedFiles.length, changed_files: changed.scoped, prediction_run_id: output.prediction_run_id, first_target_ts: output.prediction_points[0].target_ts, last_target_ts: output.prediction_points[output.prediction_points.length - 1].target_ts, determinism_hash: output.determinism_hash, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
