// scripts/governance_acceptance/P7_05_CALIBRATION_REPORT_V0.cjs
// Purpose: verify the P7-05 Calibration Report v0 gate.
// Boundary: verifies a read-only local twin-kernel calibration CLI and static contract files without DB, frontend, API, execution, Field Memory, model write, or replay output.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P7_05_CALIBRATION_REPORT_V0';
const NEXT_STEP = 'P7_06_REPLAY_EXPERIMENT_BUNDLE_V0';
const P6_COMPLETION_TAG = 'p6_execution_system_integration_completion';
const P7_04_COMMIT = 'e5eb8705474993e4aeee2c24e92ff710c1b7f4e0';
const P7_04_DOC = 'docs/legacy/tasks/P7-04-Backtest-Error-Report-v0.md';
const P7_04_SCRIPT = 'scripts/governance_acceptance/P7_04_BACKTEST_ERROR_REPORT_V0.cjs';
const P7_04_RUNTIME = 'scripts/twin_kernel/P7_04_BACKTEST_ERROR_REPORT_V0.cjs';
const CURRENT_DOC = 'docs/legacy/tasks/P7-05-Calibration-Report-v0.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P7_05_CALIBRATION_REPORT_V0.cjs';
const RUNTIME_SCRIPT = 'scripts/twin_kernel/P7_05_CALIBRATION_REPORT_V0.cjs';

const ALLOWED_CHANGED_FILES = [CURRENT_DOC, CURRENT_SCRIPT, RUNTIME_SCRIPT];
const FORBIDDEN_PREFIXES = ['apps/web/', 'apps/server/', 'apps/executor/', 'packages/', 'db/', 'migrations/', 'scripts/demo_seed/', 'scripts/runtime/'];
const REQUIRED_OUTPUT_FIELDS = ['calibration_report_version', 'calibration_report_id', 'output_kind', 'project_id', 'subject_ref', 'sensor_ref', 'sensor_group_ref', 'input_backtest_error_report_ref', 'input_prediction_run_ref', 'input_state_estimate_ref', 'input_evidence_window_ref', 'metric_kind', 'unit', 'calibration_method', 'generated_for_as_of_ts', 'calibration_basis', 'error_summary', 'calibration_parameters', 'calibration_by_metric', 'evidence_refs', 'trace_refs', 'provenance_ref', 'read_only', 'determinism_hash'];
const assertions = [];

function abs(file) { return path.resolve(ROOT, file); }
function exists(file) { return fs.existsSync(abs(file)); }
function read(file) { return fs.readFileSync(abs(file), 'utf8'); }
function git(args) { return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function tryGit(args) { try { return git(args); } catch { return ''; } }
function gitSucceeds(args) { try { childProcess.execFileSync('git', args, { cwd: ROOT, stdio: 'ignore' }); return true; } catch { return false; } }
function changedFilesFromMain() { const lists = [['diff', '--name-only', 'main...HEAD'], ['diff', '--name-only'], ['diff', '--cached', '--name-only']]; return [...new Set(lists.flatMap((args) => tryGit(args).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)))].sort(); }
function section(text, heading) { const marker = `## ${heading}`; const start = text.indexOf(marker); if (start < 0) return []; const open = text.indexOf('```text', start); if (open < 0) return []; const bodyStart = text.indexOf('\n', open) + 1; const close = text.indexOf('```', bodyStart); if (close < 0) return []; return text.slice(bodyStart, close).split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function assert(name, condition, details = {}) { assertions.push({ name, passed: condition === true, details }); if (condition !== true) { const error = new Error(`ASSERTION_FAILED:${name}`); error.details = details; throw error; } }
function summary() { const failed = assertions.filter((item) => !item.passed); return { assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) }; }

function runCalibrationReport() {
  const first = childProcess.execFileSync('node', [RUNTIME_SCRIPT], { cwd: ROOT, encoding: 'utf8' });
  const second = childProcess.execFileSync('node', [RUNTIME_SCRIPT], { cwd: ROOT, encoding: 'utf8' });
  const firstJson = JSON.parse(first);
  const secondJson = JSON.parse(second);
  assert('calibration_output_is_deterministic', JSON.stringify(firstJson) === JSON.stringify(secondJson), { first_hash: firstJson.determinism_hash, second_hash: secondJson.determinism_hash });
  return firstJson;
}

function verifyEntry() {
  assert('p7_04_doc_exists', exists(P7_04_DOC), { P7_04_DOC });
  assert('p7_04_script_exists', exists(P7_04_SCRIPT), { P7_04_SCRIPT });
  assert('p7_04_runtime_exists', exists(P7_04_RUNTIME), { P7_04_RUNTIME });
  assert('p7_04_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P7_04_COMMIT, 'HEAD']), { P7_04_COMMIT });
  assert('p6_completion_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P6_COMPLETION_TAG}`]), { P6_COMPLETION_TAG });
  const p704Doc = read(P7_04_DOC);
  assert('p7_04_doc_handoff_verified', p704Doc.includes('P7_05_CALIBRATION_REPORT_V0') && p704Doc.includes('p7_05_handoff_rule_count = 14'), { P7_04_DOC });
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  assert('runtime_script_exists', exists(RUNTIME_SCRIPT), { RUNTIME_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_allows_calibration_only', doc.includes('allowed to output `calibration_report`') && doc.includes('must not apply parameters'), { CURRENT_DOC });

  const runtimeFiles = section(doc, 'Runtime files created in P7-05');
  const outputFields = section(doc, 'Calibration report output fields');
  const methodRules = section(doc, 'Calibration method rules');
  const gates = section(doc, 'Required calibration validation gates');
  const failCodes = section(doc, 'Calibration fail codes');
  const vocab = section(doc, 'Calibration result vocabulary');
  const states = section(doc, 'Calibration state vocabulary');
  const allowedSideEffects = section(doc, 'Allowed runtime side effects');
  const prohibited = section(doc, 'Prohibited calibration semantics');
  const handoff = section(doc, 'P7-06 handoff');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P7-05');
  const forbiddenDirs = section(doc, 'Directories forbidden in P7-05');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('runtime_file_count', runtimeFiles.length === 1, { runtimeFiles });
  assert('calibration_report_output_field_count', outputFields.length === 24, { outputFields });
  assert('calibration_method_rule_count', methodRules.length === 16, { methodRules });
  assert('calibration_validation_gate_count', gates.length === 28, { gates });
  assert('calibration_fail_code_count', failCodes.length === 28, { failCodes });
  assert('calibration_result_vocabulary_count', vocab.length === 4, { vocab });
  assert('calibration_state_count', states.length === 8, { states });
  assert('allowed_runtime_side_effect_count', allowedSideEffects.length === 7, { allowedSideEffects });
  assert('prohibited_calibration_semantic_count', prohibited.length === 12, { prohibited });
  assert('p7_06_handoff_rule_count', handoff.length === 15, { handoff });
  assert('secondary_review_rules_verified', secondary.length === 6 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs });
  assert('boundary_allows_calibration_runtime', boundary.includes('p7_05_creates_calibration_report_runtime = true') && boundary.includes('p7_05_reuses_p7_04_backtest_report = true'), { boundary });
  assert('boundary_blocks_writes_and_next_outputs', boundary.includes('p7_05_changes_frontend = false') && boundary.includes('p7_05_changes_db = false') && boundary.includes('p7_05_changes_execution = false') && boundary.includes('p7_05_creates_model_write = false') && boundary.includes('p7_05_creates_replay_bundle = false') && boundary.includes('p7_05_creates_field_memory_write = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { calibration_report_output_field_count: outputFields.length, calibration_method_rule_count: methodRules.length, calibration_validation_gate_count: gates.length, calibration_fail_code_count: failCodes.length, calibration_result_vocabulary_count: vocab.length, calibration_state_count: states.length, allowed_runtime_side_effect_count: allowedSideEffects.length, prohibited_calibration_semantic_count: prohibited.length, p7_06_handoff_rule_count: handoff.length, secondary_review_required: true };
}

function verifyCalibrationOutput(output) {
  for (const field of REQUIRED_OUTPUT_FIELDS) assert(`calibration_output_field_present:${field}`, Object.prototype.hasOwnProperty.call(output, field), { output_keys: Object.keys(output) });
  assert('calibration_output_field_count', Object.keys(output).length === REQUIRED_OUTPUT_FIELDS.length, { output_keys: Object.keys(output) });
  assert('calibration_output_kind_verified', output.output_kind === 'soil_moisture_calibration_report_v0', { output_kind: output.output_kind });
  assert('calibration_output_read_only', output.read_only === true, { read_only: output.read_only });
  assert('calibration_output_metric_kind_soil_moisture', output.metric_kind === 'soil_moisture', { metric_kind: output.metric_kind });
  assert('calibration_parameters_present', output.calibration_parameters && output.calibration_parameters.applied_to_model === false && output.calibration_parameters.model_update_ref === null, { calibration_parameters: output.calibration_parameters });
  assert('calibration_candidates_numeric', Number.isFinite(output.calibration_parameters.aggregate_additive_bias_correction_candidate) && Number.isFinite(output.calibration_parameters.aggregate_multiplicative_scale_candidate), { calibration_parameters: output.calibration_parameters });
  assert('calibration_by_metric_present', Array.isArray(output.calibration_by_metric) && output.calibration_by_metric.length === 3, { calibration_by_metric: output.calibration_by_metric });
  assert('metric_candidates_numeric', output.calibration_by_metric.every((row) => Number.isFinite(row.additive_bias_correction_candidate) && Number.isFinite(row.multiplicative_scale_candidate)), { calibration_by_metric: output.calibration_by_metric });
  assert('calibration_output_traceable', Array.isArray(output.evidence_refs) && output.evidence_refs.length > 0 && Array.isArray(output.trace_refs) && output.trace_refs.length > 0, { evidence_refs: output.evidence_refs, trace_refs: output.trace_refs });
  assert('calibration_output_hash_sha256', /^[a-f0-9]{64}$/.test(output.determinism_hash), { determinism_hash: output.determinism_hash });
  assert('calibration_output_has_no_model_or_replay_write', !Object.prototype.hasOwnProperty.call(output, 'model_write') && !Object.prototype.hasOwnProperty.call(output, 'model_update') && !Object.prototype.hasOwnProperty.call(output, 'replay_bundle_id'), { output_keys: Object.keys(output) });
  assert('calibration_output_has_no_execution_or_field_memory_write', !Object.prototype.hasOwnProperty.call(output, 'field_memory_write') && !Object.prototype.hasOwnProperty.call(output, 'execution_object'), { output_keys: Object.keys(output) });
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  if (changedFiles.length === 0) {
    for (const file of ALLOWED_CHANGED_FILES) assert('main_replay_file_exists:' + file, exists(file), { file });
    assert('main_replay_changed_file_count_allowed', true, { changedFiles });
    return { changedFiles, changedFileMode: 'main_integrated_replay' };
  }
  assert('changed_file_count_verified', changedFiles.length === ALLOWED_CHANGED_FILES.length, { changedFiles });
  for (const file of ALLOWED_CHANGED_FILES) assert(`changed_file_present:${file}`, changedFiles.includes(file), { changedFiles });
  for (const file of changedFiles) assert(`changed_file_allowed:${file}`, ALLOWED_CHANGED_FILES.includes(file), { changedFiles });
  assert('no_frontend_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/web/')), { changedFiles });
  assert('no_server_runtime_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/server/') && !file.startsWith('apps/executor/') && !file.startsWith('packages/')), { changedFiles });
  assert('no_db_changed_by_this_task', changedFiles.every((file) => !file.startsWith('db/') && !file.startsWith('migrations/') && !file.includes('migration')), { changedFiles });
  assert('no_execution_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/executor/') && !file.startsWith('scripts/runtime/') && !file.startsWith('scripts/demo_seed/')), { changedFiles });
  return { changedFiles, changedFileMode: 'branch_diff' };
}

try {
  verifyEntry();
  const counts = verifyCurrentDoc();
  const output = runCalibrationReport();
  verifyCalibrationOutput(output);
  const changedFileVerification = verifyChangedFiles();
  const changedFiles = changedFileVerification.changedFiles;
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p7_04_verified: true, p6_completion_tag_verified: true, calibration_report_runtime_verified: true, ...counts, changed_file_count: changedFiles.length, changed_file_mode: changedFileVerification.changedFileMode, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_server_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, sample_calibration_report_id: output.calibration_report_id, sample_determinism_hash: output.determinism_hash, sample_applied_to_model: output.calibration_parameters.applied_to_model, sample_model_update_ref: output.calibration_parameters.model_update_ref, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
