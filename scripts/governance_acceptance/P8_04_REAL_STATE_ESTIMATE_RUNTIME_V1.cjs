// scripts/governance_acceptance/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs
// Purpose: verify the P8-04 Real State Estimate Runtime v1 gate.
// Boundary: verifies read-only state estimation from P8-02 evidence only; later P8 files may exist on the same branch.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1';
const NEXT_STEP = 'P8_05_REAL_PREDICTION_RUN_V1';
const PREVIOUS_DOC = 'docs/tasks/P8-03-Holdout-Window-Split-Contract.md';
const PREVIOUS_SCRIPT = 'scripts/governance_acceptance/P8_03_HOLDOUT_WINDOW_SPLIT_CONTRACT.cjs';
const CURRENT_DOC = 'docs/tasks/P8-04-Real-State-Estimate-Runtime-v1.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs';
const RUNTIME_SCRIPT = 'scripts/twin_kernel/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs';
const P8_04_FILES = [CURRENT_DOC, CURRENT_SCRIPT, RUNTIME_SCRIPT];
const REQUIRED_FIELDS = ['state_estimate_id', 'output_kind', 'project_id', 'subject_ref', 'sensor_ref', 'sensor_group_ref', 'metric_kind', 'unit', 'estimate_method', 'estimate_value', 'estimate_by_metric', 'uncertainty', 'confidence', 'uncertainty_width', 'coverage_summary', 'metric_refs', 'evidence_refs', 'source_query_ref', 'trace_refs', 'input_evidence_window_ref', 'read_only', 'determinism_hash'];
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
  assert('p8_03_handoff_verified', read(PREVIOUS_DOC).includes(ACCEPTANCE), { PREVIOUS_DOC });
  const doc = read(CURRENT_DOC);
  assert('doc_has_gate', doc.includes(ACCEPTANCE), { CURRENT_DOC });
  assert('doc_has_next_step', doc.includes(NEXT_STEP), { CURRENT_DOC });
  assert('runtime_file_count', section(doc, 'Runtime files created in P8-04').length === 3, { files: section(doc, 'Runtime files created in P8-04') });
  assert('required_output_field_count', section(doc, 'Required output fields').length === REQUIRED_FIELDS.length, { fields: section(doc, 'Required output fields') });
  assert('no_lookahead_rule_count', section(doc, 'No-lookahead runtime rules').length === 6, { rules: section(doc, 'No-lookahead runtime rules') });
  assert('strict_prohibition_count', section(doc, 'Runtime strict prohibitions').length === 16, { rules: section(doc, 'Runtime strict prohibitions') });
}

function verifyRuntimeSource() {
  const runtime = read(RUNTIME_SCRIPT);
  assert('runtime_imports_p8_02_builder', runtime.includes('P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs'), { RUNTIME_SCRIPT });
  assert('runtime_has_no_actual_runtime_dependency', !runtime.includes('P8_06') && !runtime.includes('ACTUAL_OBSERVATION_WINDOW'), { RUNTIME_SCRIPT });
  assert('runtime_has_no_prediction_runtime_dependency', !runtime.includes('P8_05') && !runtime.includes('PREDICTION_RUN'), { RUNTIME_SCRIPT });
  assert('runtime_has_no_backtest_runtime_dependency', !runtime.includes('P8_07') && !runtime.includes('BACKTEST_ERROR_REPORT'), { RUNTIME_SCRIPT });
  assert('runtime_has_no_calibration_runtime_dependency', !runtime.includes('P8_08') && !runtime.includes('CALIBRATION_REPORT'), { RUNTIME_SCRIPT });
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
  assert('output_kind_verified', output.output_kind === 'real_soil_moisture_state_estimate_v1', { output_kind: output.output_kind });
  assert('scope_verified', output.project_id === 'P_DEFAULT' && output.sensor_group_ref?.ref_id === 'G_CAF' && output.sensor_ref?.ref_id === 'CAF009' && output.metric_kind === 'soil_moisture', { project_id: output.project_id, sensor_group_ref: output.sensor_group_ref, sensor_ref: output.sensor_ref, metric_kind: output.metric_kind });
  assert('reads_real_evidence_window_output', output.input_evidence_window_ref?.kind === 'real_evidence_window_v0', { input_evidence_window_ref: output.input_evidence_window_ref });
  assert('estimate_value_numeric', Number.isFinite(output.estimate_value), { estimate_value: output.estimate_value });
  assert('estimate_by_metric_non_empty', Array.isArray(output.estimate_by_metric) && output.estimate_by_metric.length > 0, { estimate_by_metric: output.estimate_by_metric });
  assert('uncertainty_present', output.uncertainty && Number.isFinite(output.uncertainty.value), { uncertainty: output.uncertainty });
  assert('confidence_numeric', Number.isFinite(output.confidence) && output.confidence >= 0 && output.confidence <= 1, { confidence: output.confidence });
  assert('uncertainty_width_numeric', Number.isFinite(output.uncertainty_width), { uncertainty_width: output.uncertainty_width });
  assert('evidence_refs_preserved', Array.isArray(output.evidence_refs) && output.evidence_refs.length > 0, { evidence_refs_length: output.evidence_refs?.length });
  assert('source_query_ref_preserved', output.source_query_ref?.kind === 'readonly_postgres_query_ref', { source_query_ref: output.source_query_ref });
  assert('trace_refs_present', Array.isArray(output.trace_refs) && output.trace_refs.length > 0, { trace_refs: output.trace_refs });
  assert('read_only_true', output.read_only === true, { read_only: output.read_only });
  assert('determinism_hash_sha256', /^[a-f0-9]{64}$/.test(output.determinism_hash), { determinism_hash: output.determinism_hash });
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  const scoped = changedFiles.filter((file) => P8_04_FILES.includes(file));
  if (changedFiles.length > 0) assert('p8_04_changed_file_count', scoped.length === 3, { scoped, changedFiles });
  return { changedFiles, scoped };
}

try {
  verifyDocs();
  verifyRuntimeSource();
  const output = runRuntimeJson();
  verifyRuntimeOutput(output);
  const changed = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p8_03_verified: true, reads_real_evidence_window_output: true, does_not_query_actual_window: true, estimate_value_numeric: true, uncertainty_present: true, evidence_refs_preserved: true, source_query_ref_preserved: true, read_only: true, determinism_stable: true, changed_file_count: changed.scoped.length, branch_changed_file_count: changed.changedFiles.length, changed_files: changed.scoped, state_estimate_id: output.state_estimate_id, estimate_value: output.estimate_value, uncertainty_width: output.uncertainty_width, determinism_hash: output.determinism_hash, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
