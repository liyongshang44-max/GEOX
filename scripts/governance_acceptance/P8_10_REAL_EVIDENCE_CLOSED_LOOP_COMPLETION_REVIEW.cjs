// scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs
// Purpose: perform final completion review for P8 Real Evidence Closed-Loop Acceptance / Product Replay Demo.
// Boundary: reruns P8 acceptance gates and checks read-only/surface boundaries; creates no runtime, DB write, facts, Field Memory, model state, execution object, route, or frontend state.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW';
const COMPLETION_TAG = 'p8_real_evidence_closed_loop_demo_completion';
const CURRENT_DOC = 'docs/tasks/P8-10-Real-Evidence-Closed-Loop-Completion-Review.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs';
const P8_10_FILES = [CURRENT_DOC, CURRENT_SCRIPT];
const ACCEPTANCE_SCRIPTS = [
  ['P8_00_REAL_EVIDENCE_CLOSED_LOOP_PLANNING', 'scripts/governance_acceptance/P8_00_REAL_EVIDENCE_CLOSED_LOOP_PLANNING.cjs'],
  ['P8_01_REAL_EVIDENCE_SOURCE_CONTRACT', 'scripts/governance_acceptance/P8_01_REAL_EVIDENCE_SOURCE_CONTRACT.cjs'],
  ['P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0', 'scripts/governance_acceptance/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs'],
  ['P8_03_HOLDOUT_WINDOW_SPLIT_CONTRACT', 'scripts/governance_acceptance/P8_03_HOLDOUT_WINDOW_SPLIT_CONTRACT.cjs'],
  ['P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1', 'scripts/governance_acceptance/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs'],
  ['P8_05_REAL_PREDICTION_RUN_V1', 'scripts/governance_acceptance/P8_05_REAL_PREDICTION_RUN_V1.cjs'],
  ['P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0', 'scripts/governance_acceptance/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs'],
  ['P8_07_REAL_BACKTEST_ERROR_REPORT_V1', 'scripts/governance_acceptance/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs'],
  ['P8_08_REAL_CALIBRATION_REPORT_V1', 'scripts/governance_acceptance/P8_08_REAL_CALIBRATION_REPORT_V1.cjs'],
  ['P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0', 'scripts/governance_acceptance/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs']
];
const RUNTIME_FILES = [
  'scripts/twin_kernel/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs',
  'scripts/twin_kernel/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs',
  'scripts/twin_kernel/P8_05_REAL_PREDICTION_RUN_V1.cjs',
  'scripts/twin_kernel/P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0.cjs',
  'scripts/twin_kernel/P8_07_REAL_BACKTEST_ERROR_REPORT_V1.cjs',
  'scripts/twin_kernel/P8_08_REAL_CALIBRATION_REPORT_V1.cjs',
  'scripts/twin_kernel/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs'
];
const FORBIDDEN_CHANGED_PREFIXES = ['apps/web/', 'apps/server/', 'db/', 'prisma/', 'migrations/', 'seeds/'];
const assertions = [];

function abs(file) { return path.resolve(ROOT, file); }
function exists(file) { return fs.existsSync(abs(file)); }
function read(file) { return fs.readFileSync(abs(file), 'utf8'); }
function tryGit(args) { try { return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } }
function changedFilesFromMain() { return [...new Set(tryGit(['diff', '--name-only', 'main...HEAD']).split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].sort(); }
function section(text, heading) { const marker = `## ${heading}`; const start = text.indexOf(marker); if (start < 0) return []; const open = text.indexOf('```text', start); if (open < 0) return []; const bodyStart = text.indexOf('\n', open) + 1; const close = text.indexOf('```', bodyStart); if (close < 0) return []; return text.slice(bodyStart, close).split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function assert(name, condition, details = {}) { assertions.push({ name, passed: condition === true, details }); if (condition !== true) { const error = new Error(`ASSERTION_FAILED:${name}`); error.details = details; throw error; } }
function summary() { const failed = assertions.filter((item) => !item.passed); return { assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) }; }
function runAcceptance(scriptPath) { const output = childProcess.execFileSync('node', [scriptPath], { cwd: ROOT, encoding: 'utf8', env: process.env }); return JSON.parse(output); }

function verifyDocs() {
  assert('p8_10_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('p8_10_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('doc_has_gate', doc.includes(ACCEPTANCE), { CURRENT_DOC });
  assert('doc_has_completion_tag', doc.includes(COMPLETION_TAG), { COMPLETION_TAG });
  assert('completed_gate_count', section(doc, 'Completed P8 gates').length === 10, { gates: section(doc, 'Completed P8 gates') });
  assert('final_artifact_chain_count', section(doc, 'Final artifact chain').length === 7, { chain: section(doc, 'Final artifact chain') });
  assert('completion_target_count', section(doc, 'Completion verification targets').length === 12, { targets: section(doc, 'Completion verification targets') });
  assert('runtime_surface_prohibition_count', section(doc, 'Runtime and surface prohibitions').length === 17, { prohibitions: section(doc, 'Runtime and surface prohibitions') });
  assert('p8_09_handoff_verified', read('docs/tasks/P8-09-Product-Replay-Demo-Report-v0.md').includes(ACCEPTANCE), {});
}

function verifyAcceptanceChain() {
  const results = [];
  for (const [gate, scriptPath] of ACCEPTANCE_SCRIPTS) {
    assert(`acceptance_script_exists:${gate}`, exists(scriptPath), { scriptPath });
    const result = runAcceptance(scriptPath);
    assert(`acceptance_passed:${gate}`, result.ok === true && result.acceptance === gate, { result });
    results.push({ gate, scriptPath, result });
  }
  return results;
}

function verifyRuntimeReadOnly() {
  for (const file of RUNTIME_FILES) {
    assert(`runtime_file_exists:${file}`, exists(file), { file });
    const text = read(file);
    assert(`runtime_no_mutation_sql:${file}`, !/\b(insert\s+into|update\s+[^\n]+set|delete\s+from|create\s+table|alter\s+table|drop\s+table)\b/i.test(text), { file });
  }
  const p802 = read('scripts/twin_kernel/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs');
  assert('p8_02_uses_read_only_transaction', p802.includes("begin read only") || p802.includes("'begin read only'"), {});
}

function verifyChangedFileBoundary() {
  const changedFiles = changedFilesFromMain();
  const forbidden = changedFiles.filter((file) => FORBIDDEN_CHANGED_PREFIXES.some((prefix) => file.startsWith(prefix)));
  const p8Scoped = changedFiles.filter((file) => file.startsWith('docs/tasks/P8-') || file.startsWith('scripts/governance_acceptance/P8_') || file.startsWith('scripts/twin_kernel/P8_'));
  const scopedCurrent = changedFiles.filter((file) => P8_10_FILES.includes(file));
  assert('no_forbidden_surface_files_changed', forbidden.length === 0, { forbidden, changedFiles });
  assert('all_changed_files_are_p8_scoped', p8Scoped.length === changedFiles.length, { changedFiles, p8Scoped });
  assert('p8_10_changed_files_present', scopedCurrent.length === P8_10_FILES.length, { scopedCurrent });
  return { changedFiles, scopedCurrent };
}

try {
  verifyDocs();
  const chain = verifyAcceptanceChain();
  verifyRuntimeReadOnly();
  const changed = verifyChangedFileBoundary();
  const p802 = chain.find((item) => item.gate === 'P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0').result;
  const p804 = chain.find((item) => item.gate === 'P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1').result;
  const p805 = chain.find((item) => item.gate === 'P8_05_REAL_PREDICTION_RUN_V1').result;
  const p806 = chain.find((item) => item.gate === 'P8_06_REAL_ACTUAL_OBSERVATION_WINDOW_V0').result;
  const p807 = chain.find((item) => item.gate === 'P8_07_REAL_BACKTEST_ERROR_REPORT_V1').result;
  const p808 = chain.find((item) => item.gate === 'P8_08_REAL_CALIBRATION_REPORT_V1').result;
  const p809 = chain.find((item) => item.gate === 'P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0').result;

  assert('real_evidence_window_verified', p802.real_evidence_window_verified === true, { p802 });
  assert('state_estimate_verified', p804.estimate_value_numeric === true, { p804 });
  assert('prediction_run_verified', p805.prediction_window_verified === true, { p805 });
  assert('actual_observation_window_verified', p806.actual_window_verified === true, { p806 });
  assert('backtest_error_report_verified', p807.prediction_vs_actual_verified === true && p807.error_summary_present === true, { p807 });
  assert('calibration_report_verified', p808.calibration_parameters_present === true && p808.applied_to_model_false === true, { p808 });
  assert('product_replay_demo_verified', p809.product_replay_demo_verified === true && p809.artifact_chain_complete === true, { p809 });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    real_evidence_window_verified: true,
    state_estimate_verified: true,
    prediction_run_verified: true,
    actual_observation_window_verified: true,
    backtest_error_report_verified: true,
    calibration_report_verified: true,
    product_replay_demo_verified: true,
    db_read_only_verified: true,
    field_memory_write_absent: true,
    model_write_absent: true,
    execution_object_absent: true,
    frontend_authority_absent: true,
    changed_file_count: changed.scopedCurrent.length,
    branch_changed_file_count: changed.changedFiles.length,
    changed_files: changed.scopedCurrent,
    verified_gate_count: chain.length,
    real_evidence_window_id: p802.real_evidence_window_id,
    state_estimate_id: p804.state_estimate_id,
    prediction_run_id: p805.prediction_run_id,
    actual_observation_window_id: p806.actual_observation_window_id,
    backtest_error_report_id: p807.backtest_error_report_id,
    calibration_report_id: p808.calibration_report_id,
    product_replay_demo_report_id: p809.product_replay_demo_report_id,
    completion_tag: COMPLETION_TAG,
    ...summary()
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
