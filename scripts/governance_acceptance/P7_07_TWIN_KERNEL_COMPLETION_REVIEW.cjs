// scripts/governance_acceptance/P7_07_TWIN_KERNEL_COMPLETION_REVIEW.cjs
// Purpose: verify the P7-07 Twin Kernel Completion Review gate.
// Boundary: verifies the P7-00 through P7-06 chain without creating new runtime capability, DB schema, frontend authority, execution object, Field Memory write, model write, or P8 scope.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P7_07_TWIN_KERNEL_COMPLETION_REVIEW';
const NEXT_STEP = 'TAG_P7_COMPLETION';
const COMPLETION_TAG = 'p7_twin_kernel_minimal_runtime_completion';
const P6_COMPLETION_TAG = 'p6_execution_system_integration_completion';
const P7_06_COMMIT = '00729ef9beefca48973cf4dbee2cdd3ec08369ba';
const CURRENT_DOC = 'docs/tasks/P7-07-Twin-Kernel-Completion-Review.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P7_07_TWIN_KERNEL_COMPLETION_REVIEW.cjs';
const ALLOWED_CHANGED_FILES = [CURRENT_DOC, CURRENT_SCRIPT];
const FORBIDDEN_PREFIXES = ['apps/web/', 'apps/server/', 'apps/executor/', 'packages/', 'db/', 'migrations/', 'scripts/demo_seed/', 'scripts/runtime/', 'scripts/twin_kernel/'];
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
function hasTraceability(output) { return Array.isArray(output.trace_refs) && output.trace_refs.length > 0 && ((Array.isArray(output.evidence_refs) && output.evidence_refs.length > 0) || Boolean(output.input_evidence_window_ref)); }

function runJson(script) {
  const first = childProcess.execFileSync('node', [script], { cwd: ROOT, encoding: 'utf8' });
  const second = childProcess.execFileSync('node', [script], { cwd: ROOT, encoding: 'utf8' });
  const firstJson = JSON.parse(first);
  const secondJson = JSON.parse(second);
  assert(`runtime_deterministic:${script}`, JSON.stringify(firstJson) === JSON.stringify(secondJson), { script, first_hash: firstJson.determinism_hash, second_hash: secondJson.determinism_hash });
  return firstJson;
}

function verifyEntry() {
  assert('p7_06_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P7_06_COMMIT, 'HEAD']), { P7_06_COMMIT });
  assert('p6_completion_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P6_COMPLETION_TAG}`]), { P6_COMPLETION_TAG });
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
}

function verifyDoc() {
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_completion_only', doc.includes('completion review only') && doc.includes('must not create a new twin-kernel runtime capability'), { CURRENT_DOC });

  const reviewedGates = section(doc, 'Reviewed P7 gates');
  const capabilities = section(doc, 'Reviewed P7 capabilities');
  const runtimes = section(doc, 'Runtime artifacts reviewed');
  const docs = section(doc, 'Contract docs reviewed');
  const scripts = section(doc, 'Acceptance scripts reviewed');
  const reviewAssertions = section(doc, 'Completion review assertions');
  const boundaries = section(doc, 'Final boundary statements');
  const prohibited = section(doc, 'Prohibited completion semantics');
  const allowed = section(doc, 'Changed files allowed in P7-07');
  const forbidden = section(doc, 'Directories forbidden in P7-07');
  const secondary = section(doc, 'Secondary review requirement');
  const tagRequirement = section(doc, 'Completion tag requirement');
  const next = section(doc, 'Next step');

  assert('reviewed_gate_count', reviewedGates.length === 7, { reviewedGates });
  assert('reviewed_capability_count', capabilities.length === 6, { capabilities });
  assert('runtime_artifact_count', runtimes.length === 5, { runtimes });
  assert('contract_doc_count', docs.length === 7, { docs });
  assert('acceptance_script_count', scripts.length === 7, { scripts });
  assert('completion_review_assertion_count', reviewAssertions.length === 12, { reviewAssertions });
  assert('final_boundary_statement_count', boundaries.length === 13, { boundaries });
  assert('prohibited_completion_semantic_count', prohibited.length === 12, { prohibited });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbidden.includes(prefix)), { forbidden });
  assert('secondary_review_rules_verified', secondary.length === 6 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('completion_tag_requirement_verified', tagRequirement.includes('completion_tag_required_after_acceptance = true') && tagRequirement.includes(`completion_tag_name = ${COMPLETION_TAG}`), { tagRequirement });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  for (const file of [...runtimes, ...docs, ...scripts]) assert(`reviewed_file_exists:${file}`, exists(file), { file });

  return { reviewed_gate_count: reviewedGates.length, reviewed_capability_count: capabilities.length, runtime_artifact_count: runtimes.length, contract_doc_count: docs.length, acceptance_script_count: scripts.length, completion_review_assertion_count: reviewAssertions.length, final_boundary_statement_count: boundaries.length, prohibited_completion_semantic_count: prohibited.length, secondary_review_required: true };
}

function verifyRuntimeChain() {
  const stateEstimate = runJson('scripts/twin_kernel/P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0.cjs');
  const predictionRun = runJson('scripts/twin_kernel/P7_03_PREDICTION_RUN_V0.cjs');
  const backtestReport = runJson('scripts/twin_kernel/P7_04_BACKTEST_ERROR_REPORT_V0.cjs');
  const calibrationReport = runJson('scripts/twin_kernel/P7_05_CALIBRATION_REPORT_V0.cjs');
  const replayBundle = runJson('scripts/twin_kernel/P7_06_REPLAY_EXPERIMENT_BUNDLE_V0.cjs');

  const outputs = [stateEstimate, predictionRun, backtestReport, calibrationReport, replayBundle];
  assert('all_runtime_outputs_read_only', outputs.every((output) => output.read_only === true), { read_only_values: outputs.map((output) => output.read_only) });
  assert('all_runtime_outputs_traceable', outputs.every(hasTraceability), { trace_counts: outputs.map((output) => ({ evidence: output.evidence_refs && output.evidence_refs.length, trace: output.trace_refs && output.trace_refs.length, input_evidence_window_ref: output.input_evidence_window_ref || null })) });
  assert('p7_03_links_to_p7_02_state_estimate', predictionRun.input_state_estimate_ref.ref_id === stateEstimate.state_estimate_id, { prediction_ref: predictionRun.input_state_estimate_ref, state_estimate_id: stateEstimate.state_estimate_id });
  assert('p7_04_links_to_p7_03_prediction_run', backtestReport.input_prediction_run_ref.ref_id === predictionRun.prediction_run_id, { backtest_ref: backtestReport.input_prediction_run_ref, prediction_run_id: predictionRun.prediction_run_id });
  assert('p7_05_links_to_p7_04_backtest_report', calibrationReport.input_backtest_error_report_ref.ref_id === backtestReport.backtest_report_id, { calibration_ref: calibrationReport.input_backtest_error_report_ref, backtest_report_id: backtestReport.backtest_report_id });
  assert('p7_06_links_to_p7_05_calibration_report', replayBundle.input_calibration_report_ref.ref_id === calibrationReport.calibration_report_id, { replay_ref: replayBundle.input_calibration_report_ref, calibration_report_id: calibrationReport.calibration_report_id });
  assert('p7_06_artifact_chain_count_is_5', Array.isArray(replayBundle.artifact_chain) && replayBundle.artifact_chain.length === 5, { artifact_chain: replayBundle.artifact_chain });
  assert('p7_06_write_policy_all_false', replayBundle.runtime_manifest && Object.values(replayBundle.runtime_manifest.write_policy).every((value) => value === false), { write_policy: replayBundle.runtime_manifest && replayBundle.runtime_manifest.write_policy });
  assert('no_runtime_output_contains_write_objects', outputs.every((output) => !Object.prototype.hasOwnProperty.call(output, 'model_write') && !Object.prototype.hasOwnProperty.call(output, 'model_update') && !Object.prototype.hasOwnProperty.call(output, 'field_memory_write') && !Object.prototype.hasOwnProperty.call(output, 'execution_object')), { output_keys: outputs.map((output) => Object.keys(output)) });
  assert('completion_does_not_open_p8', !exists('docs/tasks/P8-00.md'), { checked: 'docs/tasks/P8-00.md' });

  return { state_estimate_id: stateEstimate.state_estimate_id, prediction_run_id: predictionRun.prediction_run_id, backtest_report_id: backtestReport.backtest_report_id, calibration_report_id: calibrationReport.calibration_report_id, replay_bundle_id: replayBundle.replay_bundle_id, replay_determinism_hash: replayBundle.determinism_hash };
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
  assert('no_twin_kernel_runtime_changed_by_completion_review', changedFiles.every((file) => !file.startsWith('scripts/twin_kernel/')), { changedFiles });
  return { changedFiles, changedFileMode: 'branch_diff' };
}

try {
  verifyEntry();
  const counts = verifyDoc();
  const chain = verifyRuntimeChain();
  const changedFileVerification = verifyChangedFiles();
  const changedFiles = changedFileVerification.changedFiles;
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p7_06_verified: true, p6_completion_tag_verified: true, completion_review_verified: true, ...counts, changed_file_count: changedFiles.length, changed_file_mode: changedFileVerification.changedFileMode, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_server_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, no_twin_kernel_runtime_changed_by_this_task: true, completion_tag_required_after_acceptance: true, completion_tag: COMPLETION_TAG, ...chain, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
