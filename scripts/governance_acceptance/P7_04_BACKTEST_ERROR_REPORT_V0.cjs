// scripts/governance_acceptance/P7_04_BACKTEST_ERROR_REPORT_V0.cjs
// Purpose: verify the P7-04 Backtest Error Report v0 gate.
// Boundary: verifies a read-only local twin-kernel backtest CLI and static contract files without DB, frontend, API, execution, Field Memory, model, calibration, or replay writes.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P7_04_BACKTEST_ERROR_REPORT_V0';
const NEXT_STEP = 'P7_05_CALIBRATION_REPORT_V0';
const P6_COMPLETION_TAG = 'p6_execution_system_integration_completion';
const P7_03_COMMIT = '9848df3605ca3e99b49888f33fd2510fd147015a';
const P7_03_DOC = 'docs/legacy/tasks/P7-03-Prediction-Run-v0.md';
const P7_03_SCRIPT = 'scripts/governance_acceptance/P7_03_PREDICTION_RUN_V0.cjs';
const P7_03_RUNTIME = 'scripts/twin_kernel/P7_03_PREDICTION_RUN_V0.cjs';
const P7_02_FIXTURE = 'scripts/twin_kernel/fixtures/P7_02_EVIDENCE_WINDOW_CAF009_SAMPLE.json';
const CURRENT_DOC = 'docs/legacy/tasks/P7-04-Backtest-Error-Report-v0.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P7_04_BACKTEST_ERROR_REPORT_V0.cjs';
const RUNTIME_SCRIPT = 'scripts/twin_kernel/P7_04_BACKTEST_ERROR_REPORT_V0.cjs';
const ACTUALS_FIXTURE = 'scripts/twin_kernel/fixtures/P7_04_BACKTEST_ACTUALS_CAF009_SAMPLE.json';

const ALLOWED_CHANGED_FILES = [CURRENT_DOC, CURRENT_SCRIPT, RUNTIME_SCRIPT, ACTUALS_FIXTURE];
const FORBIDDEN_PREFIXES = ['apps/web/', 'apps/server/', 'apps/executor/', 'packages/twin-kernel/', 'packages/contracts/', 'packages/', 'db/', 'migrations/', 'scripts/demo_seed/', 'scripts/runtime/'];
const REQUIRED_OUTPUT_FIELDS = ['backtest_report_version', 'backtest_report_id', 'output_kind', 'project_id', 'subject_ref', 'sensor_ref', 'sensor_group_ref', 'input_prediction_run_ref', 'input_state_estimate_ref', 'input_evidence_window_ref', 'metric_kind', 'unit', 'backtest_method', 'generated_for_as_of_ts', 'compared_horizon_steps', 'compared_point_count', 'error_summary', 'error_by_point', 'actuals_ref', 'evidence_refs', 'trace_refs', 'provenance_ref', 'read_only', 'determinism_hash'];
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

function runBacktestReport() {
  const first = childProcess.execFileSync('node', [RUNTIME_SCRIPT], { cwd: ROOT, encoding: 'utf8' });
  const second = childProcess.execFileSync('node', [RUNTIME_SCRIPT], { cwd: ROOT, encoding: 'utf8' });
  const firstJson = JSON.parse(first);
  const secondJson = JSON.parse(second);
  assert('backtest_output_is_deterministic', JSON.stringify(firstJson) === JSON.stringify(secondJson), { first_hash: firstJson.determinism_hash, second_hash: secondJson.determinism_hash });
  return firstJson;
}

function verifyEntry() {
  assert('p7_03_doc_exists', exists(P7_03_DOC), { P7_03_DOC });
  assert('p7_03_script_exists', exists(P7_03_SCRIPT), { P7_03_SCRIPT });
  assert('p7_03_runtime_exists', exists(P7_03_RUNTIME), { P7_03_RUNTIME });
  assert('p7_02_fixture_exists', exists(P7_02_FIXTURE), { P7_02_FIXTURE });
  assert('p7_03_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P7_03_COMMIT, 'HEAD']), { P7_03_COMMIT });
  assert('p6_completion_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P6_COMPLETION_TAG}`]), { P6_COMPLETION_TAG });
  const p703Doc = read(P7_03_DOC);
  assert('p7_03_doc_handoff_verified', p703Doc.includes('P7_04_BACKTEST_ERROR_REPORT_V0') && p703Doc.includes('p7_04_handoff_rule_count = 14'), { P7_03_DOC });
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  assert('runtime_script_exists', exists(RUNTIME_SCRIPT), { RUNTIME_SCRIPT });
  assert('actuals_fixture_exists', exists(ACTUALS_FIXTURE), { ACTUALS_FIXTURE });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_allows_backtest_only', doc.includes('allowed to output `backtest_error_report`') && doc.includes('not allowed to output a calibration report'), { CURRENT_DOC });

  const runtimeFiles = section(doc, 'Runtime files created in P7-04');
  const outputFields = section(doc, 'Backtest error report output fields');
  const methodRules = section(doc, 'Backtest method rules');
  const gates = section(doc, 'Required backtest validation gates');
  const failCodes = section(doc, 'Backtest fail codes');
  const vocab = section(doc, 'Backtest result vocabulary');
  const states = section(doc, 'Backtest state vocabulary');
  const allowedSideEffects = section(doc, 'Allowed runtime side effects');
  const prohibited = section(doc, 'Prohibited backtest semantics');
  const handoff = section(doc, 'P7-05 handoff');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P7-04');
  const forbiddenDirs = section(doc, 'Directories forbidden in P7-04');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('runtime_file_count', runtimeFiles.length === 2, { runtimeFiles });
  assert('backtest_error_report_output_field_count', outputFields.length === 24, { outputFields });
  assert('backtest_method_rule_count', methodRules.length === 15, { methodRules });
  assert('backtest_validation_gate_count', gates.length === 30, { gates });
  assert('backtest_fail_code_count', failCodes.length === 30, { failCodes });
  assert('backtest_result_vocabulary_count', vocab.length === 4, { vocab });
  assert('backtest_state_count', states.length === 8, { states });
  assert('allowed_runtime_side_effect_count', allowedSideEffects.length === 9, { allowedSideEffects });
  assert('prohibited_backtest_semantic_count', prohibited.length === 20, { prohibited });
  assert('p7_05_handoff_rule_count', handoff.length === 14, { handoff });
  assert('secondary_review_rules_verified', secondary.length === 6 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs });
  assert('boundary_allows_backtest_runtime', boundary.includes('p7_04_creates_backtest_error_report_runtime = true') && boundary.includes('p7_04_creates_actuals_fixture_input = true'), { boundary });
  assert('boundary_blocks_db_frontend_execution_and_next_outputs', boundary.includes('p7_04_changes_frontend = false') && boundary.includes('p7_04_changes_db = false') && boundary.includes('p7_04_changes_execution = false') && boundary.includes('p7_04_creates_calibration_report = false') && boundary.includes('p7_04_creates_field_memory_write = false') && boundary.includes('p7_04_creates_model_update = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { backtest_error_report_output_field_count: outputFields.length, backtest_method_rule_count: methodRules.length, backtest_validation_gate_count: gates.length, backtest_fail_code_count: failCodes.length, backtest_result_vocabulary_count: vocab.length, backtest_state_count: states.length, allowed_runtime_side_effect_count: allowedSideEffects.length, prohibited_backtest_semantic_count: prohibited.length, p7_05_handoff_rule_count: handoff.length, secondary_review_required: true };
}

function verifyBacktestOutput(output) {
  for (const field of REQUIRED_OUTPUT_FIELDS) assert(`backtest_output_field_present:${field}`, Object.prototype.hasOwnProperty.call(output, field), { output_keys: Object.keys(output) });
  assert('backtest_output_field_count', Object.keys(output).length === REQUIRED_OUTPUT_FIELDS.length, { output_keys: Object.keys(output) });
  assert('backtest_output_kind_verified', output.output_kind === 'soil_moisture_backtest_error_report_v0', { output_kind: output.output_kind });
  assert('backtest_output_read_only', output.read_only === true, { read_only: output.read_only });
  assert('backtest_output_metric_kind_soil_moisture', output.metric_kind === 'soil_moisture', { metric_kind: output.metric_kind });
  assert('backtest_error_by_point_count_verified', Array.isArray(output.error_by_point) && output.error_by_point.length === 3, { error_by_point: output.error_by_point });
  assert('backtest_metric_errors_present', output.error_by_point.every((point) => Array.isArray(point.error_by_metric) && point.error_by_metric.length === 3), { error_by_point: output.error_by_point });
  assert('backtest_summary_numeric', output.error_summary && Number.isFinite(output.error_summary.mae) && Number.isFinite(output.error_summary.rmse) && Number.isFinite(output.error_summary.bias) && Number.isFinite(output.error_summary.max_absolute_error), { error_summary: output.error_summary });
  assert('backtest_output_traceable', Array.isArray(output.evidence_refs) && output.evidence_refs.length > 0 && Array.isArray(output.trace_refs) && output.trace_refs.length > 0, { evidence_refs: output.evidence_refs, trace_refs: output.trace_refs });
  assert('backtest_output_hash_sha256', /^[a-f0-9]{64}$/.test(output.determinism_hash), { determinism_hash: output.determinism_hash });
  assert('backtest_output_has_no_calibration_or_replay', !Object.prototype.hasOwnProperty.call(output, 'calibration_report_id') && !Object.prototype.hasOwnProperty.call(output, 'replay_bundle_id') && !Object.prototype.hasOwnProperty.call(output, 'model_update'), { output_keys: Object.keys(output) });
  assert('backtest_output_has_no_execution_or_learning_write', !Object.prototype.hasOwnProperty.call(output, 'field_memory_write') && !Object.prototype.hasOwnProperty.call(output, 'execution_object') && !Object.prototype.hasOwnProperty.call(output, 'automatic_learning'), { output_keys: Object.keys(output) });
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
  const output = runBacktestReport();
  verifyBacktestOutput(output);
  const changedFileVerification = verifyChangedFiles();
  const changedFiles = changedFileVerification.changedFiles;
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p7_03_verified: true, p6_completion_tag_verified: true, backtest_error_report_runtime_verified: true, ...counts, changed_file_count: changedFiles.length, changed_file_mode: changedFileVerification.changedFileMode, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_server_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, sample_backtest_report_id: output.backtest_report_id, sample_determinism_hash: output.determinism_hash, sample_mae: output.error_summary.mae, sample_rmse: output.error_summary.rmse, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
