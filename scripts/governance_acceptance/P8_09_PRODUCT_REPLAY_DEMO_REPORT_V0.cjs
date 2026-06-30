// scripts/governance_acceptance/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs
// Purpose: verify the P8-09 Product Replay Demo Report v0 gate.
// Boundary: validates external-readable replay output without dashboard authority, recommendation, action authorization, model update, or Field Memory write.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0';
const NEXT_STEP = 'P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW';
const PREVIOUS_DOC = 'docs/tasks/P8-08-Real-Calibration-Report-v1.md';
const PREVIOUS_SCRIPT = 'scripts/governance_acceptance/P8_08_REAL_CALIBRATION_REPORT_V1.cjs';
const CURRENT_DOC = 'docs/tasks/P8-09-Product-Replay-Demo-Report-v0.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs';
const RUNTIME_SCRIPT = 'scripts/twin_kernel/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs';
const P8_09_FILES = [CURRENT_DOC, CURRENT_SCRIPT, RUNTIME_SCRIPT];
const REQUIRED_FIELDS = ['product_replay_demo_report_id', 'output_kind', 'project_id', 'subject_ref', 'sensor_ref', 'sensor_group_ref', 'metric_kind', 'unit', 'replay_method', 'generated_for_as_of_ts', 'demo_title', 'demo_summary', 'replay_timeline', 'artifact_chain', 'product_narrative', 'evidence_window_summary', 'state_estimate_summary', 'prediction_summary', 'actual_observation_summary', 'backtest_error_summary', 'calibration_summary', 'boundary_summary', 'acceptance_summary', 'evidence_refs', 'actual_refs', 'source_query_refs', 'trace_refs', 'read_only', 'determinism_hash'];
const EXPECTED_STAGES = ['P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0', 'P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1', 'P8_05_REAL_PREDICTION_RUN_V1', 'P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0', 'P8_07_REAL_BACKTEST_ERROR_REPORT_V1', 'P8_08_REAL_CALIBRATION_REPORT_V1'];
const EXPECTED_SECTIONS = ['past_evidence', 'state_estimate', 'prediction', 'actual_observations', 'error_and_calibration', 'boundary_statement'];
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
  assert('p8_08_handoff_verified', read(PREVIOUS_DOC).includes(ACCEPTANCE), { PREVIOUS_DOC });
  const doc = read(CURRENT_DOC);
  assert('doc_has_gate', doc.includes(ACCEPTANCE), { CURRENT_DOC });
  assert('doc_has_next_step', doc.includes(NEXT_STEP), { CURRENT_DOC });
  assert('runtime_file_count', section(doc, 'Runtime files created in P8-09').length === 3, { files: section(doc, 'Runtime files created in P8-09') });
  assert('input_artifact_chain_count', section(doc, 'Input artifact chain').length === 6, { chain: section(doc, 'Input artifact chain') });
  assert('required_output_field_count', section(doc, 'Required output fields').length === REQUIRED_FIELDS.length, { fields: section(doc, 'Required output fields') });
  assert('replay_narrative_section_count', section(doc, 'Replay narrative sections').length === EXPECTED_SECTIONS.length, { sections: section(doc, 'Replay narrative sections') });
  assert('product_demo_boundary_rule_count', section(doc, 'Product demo boundary rules').length === 9, { rules: section(doc, 'Product demo boundary rules') });
  assert('strict_prohibition_count', section(doc, 'Runtime strict prohibitions').length === 16, { rules: section(doc, 'Runtime strict prohibitions') });
}

function verifyRuntimeSource() {
  const runtime = read(RUNTIME_SCRIPT);
  for (const token of ['P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs', 'P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs', 'P8_05_REAL_PREDICTION_RUN_V1.cjs', 'P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs', 'P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs', 'P8_08_REAL_CALIBRATION_REPORT_V1.cjs']) assert(`runtime_imports:${token}`, runtime.includes(token), { RUNTIME_SCRIPT });
  assert('runtime_has_no_completion_review_dependency', !runtime.includes('P8_10'), { RUNTIME_SCRIPT });
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
  assert('output_kind_verified', output.output_kind === 'product_replay_demo_report_v0', { output_kind: output.output_kind });
  assert('scope_verified', output.project_id === 'P_DEFAULT' && output.sensor_group_ref?.ref_id === 'G_CAF' && output.sensor_ref?.ref_id === 'CAF009' && output.metric_kind === 'soil_moisture', { project_id: output.project_id, sensor_group_ref: output.sensor_group_ref, sensor_ref: output.sensor_ref, metric_kind: output.metric_kind });
  assert('artifact_chain_complete', Array.isArray(output.artifact_chain) && output.artifact_chain.map((item) => item.stage).join('|') === EXPECTED_STAGES.join('|'), { artifact_chain: output.artifact_chain });
  assert('narrative_sections_complete', Array.isArray(output.product_narrative) && output.product_narrative.map((item) => item.section).join('|') === EXPECTED_SECTIONS.join('|'), { product_narrative: output.product_narrative });
  assert('replay_timeline_complete', Array.isArray(output.replay_timeline) && output.replay_timeline.length === 6, { replay_timeline: output.replay_timeline });
  assert('product_replay_demo_verified', output.demo_summary?.problem === 'soil_moisture_state_estimation' && Number.isFinite(output.demo_summary?.point_mae) && Number.isFinite(output.demo_summary?.metric_mae), { demo_summary: output.demo_summary });
  assert('boundary_summary_present', output.boundary_summary && output.boundary_summary.read_only === true, { boundary_summary: output.boundary_summary });
  assert('calibration_not_applied', output.boundary_summary.calibration_applied === false && output.calibration_summary.calibration_parameters.applied_to_model === false, { boundary_summary: output.boundary_summary, calibration_summary: output.calibration_summary });
  assert('no_dashboard_authority', output.boundary_summary.dashboard_authority === false, { boundary_summary: output.boundary_summary });
  assert('no_action_authorization', output.boundary_summary.action_authorization === false, { boundary_summary: output.boundary_summary });
  assert('model_not_updated', output.boundary_summary.model_updated === false, { boundary_summary: output.boundary_summary });
  assert('field_memory_not_written', output.boundary_summary.field_memory_written === false, { boundary_summary: output.boundary_summary });
  assert('execution_object_not_created', output.boundary_summary.execution_object_created === false, { boundary_summary: output.boundary_summary });
  assert('evidence_refs_preserved', Array.isArray(output.evidence_refs) && output.evidence_refs.length > 0, { evidence_refs_length: output.evidence_refs?.length });
  assert('actual_refs_preserved', Array.isArray(output.actual_refs) && output.actual_refs.length > 0, { actual_refs_length: output.actual_refs?.length });
  assert('source_query_refs_preserved', Array.isArray(output.source_query_refs) && output.source_query_refs.length >= 2, { source_query_refs: output.source_query_refs });
  assert('read_only_true', output.read_only === true, { read_only: output.read_only });
  assert('determinism_hash_sha256', /^[a-f0-9]{64}$/.test(output.determinism_hash), { determinism_hash: output.determinism_hash });
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  const scoped = changedFiles.filter((file) => P8_09_FILES.includes(file));
  if (changedFiles.length > 0) assert('p8_09_changed_file_count', scoped.length === 3, { scoped, changedFiles });
  return { changedFiles, scoped };
}

try {
  verifyDocs();
  verifyRuntimeSource();
  const output = runRuntimeJson();
  verifyRuntimeOutput(output);
  const changed = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p8_08_verified: true, product_replay_demo_verified: true, artifact_chain_complete: true, narrative_sections_complete: true, boundary_summary_present: true, calibration_not_applied: true, evidence_refs_preserved: true, actual_refs_preserved: true, source_query_refs_preserved: true, read_only: true, determinism_stable: true, changed_file_count: changed.scoped.length, branch_changed_file_count: changed.changedFiles.length, changed_files: changed.scoped, product_replay_demo_report_id: output.product_replay_demo_report_id, artifact_chain_count: output.artifact_chain.length, narrative_section_count: output.product_narrative.length, point_mae: output.demo_summary.point_mae, metric_mae: output.demo_summary.metric_mae, determinism_hash: output.determinism_hash, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
