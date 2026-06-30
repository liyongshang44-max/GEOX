// scripts/governance_acceptance/P8_03_HOLDOUT_WINDOW_SPLIT_CONTRACT.cjs
// Purpose: verify the P8-03 Holdout Window Split Contract gate.
// Boundary: checks no-lookahead contract only; later P8 files may exist on the same branch.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P8_03_HOLDOUT_WINDOW_SPLIT_CONTRACT';
const NEXT_STEP = 'P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1';
const PREVIOUS_DOC = 'docs/tasks/P8-02-Real-Evidence-Window-Builder-v0.md';
const PREVIOUS_SCRIPT = 'scripts/governance_acceptance/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs';
const CURRENT_DOC = 'docs/tasks/P8-03-Holdout-Window-Split-Contract.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P8_03_HOLDOUT_WINDOW_SPLIT_CONTRACT.cjs';
const P8_03_FILES = [CURRENT_DOC, CURRENT_SCRIPT];
const assertions = [];

function abs(file) { return path.resolve(ROOT, file); }
function exists(file) { return fs.existsSync(abs(file)); }
function read(file) { return fs.readFileSync(abs(file), 'utf8'); }
function tryGit(args) { try { return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } }
function changedFilesFromMain() { return [...new Set(tryGit(['diff', '--name-only', 'main...HEAD']).split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].sort(); }
function section(text, heading) { const marker = `## ${heading}`; const start = text.indexOf(marker); if (start < 0) return []; const open = text.indexOf('```text', start); if (open < 0) return []; const bodyStart = text.indexOf('\n', open) + 1; const close = text.indexOf('```', bodyStart); if (close < 0) return []; return text.slice(bodyStart, close).split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function assert(name, condition, details = {}) { assertions.push({ name, passed: condition === true, details }); if (condition !== true) { const error = new Error(`ASSERTION_FAILED:${name}`); error.details = details; throw error; } }
function summary() { const failed = assertions.filter((item) => !item.passed); return { assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) }; }
function valueOf(lines, key) { const prefix = `${key} = `; const line = lines.find((item) => item.startsWith(prefix)); return line ? line.slice(prefix.length) : null; }

function verifyEntry() {
  for (const file of [PREVIOUS_DOC, PREVIOUS_SCRIPT, CURRENT_DOC, CURRENT_SCRIPT]) assert(`file_exists:${file}`, exists(file), { file });
  assert('p8_02_handoff_verified', read(PREVIOUS_DOC).includes(ACCEPTANCE), { PREVIOUS_DOC });
}

function verifyDoc() {
  const doc = read(CURRENT_DOC);
  assert('doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });

  const scope = section(doc, 'Fixed replay scope');
  const history = section(doc, 'History window');
  const prediction = section(doc, 'Prediction window');
  const actual = section(doc, 'Actual observation window');
  const noLookahead = section(doc, 'No-lookahead rules');
  const matrix = section(doc, 'Runtime phase access matrix');
  const strict = section(doc, 'Strict prohibitions');
  const changedAllowed = section(doc, 'Changed files allowed in P8-03');
  const next = section(doc, 'Next step');

  assert('fixed_scope_count', scope.length === 5, { scope });
  assert('history_window_defined', valueOf(history, 'window_name') === 'history_window', { history });
  assert('prediction_window_defined', valueOf(prediction, 'window_name') === 'prediction_window', { prediction });
  assert('actual_observation_window_defined', valueOf(actual, 'window_name') === 'actual_observation_window', { actual });
  assert('history_window_range_verified', valueOf(history, 'window_start_ts') === '2009-06-09T00:00:00.000Z' && valueOf(history, 'window_end_ts') === '2009-06-09T04:00:00.000Z', { history });
  assert('prediction_window_range_verified', valueOf(prediction, 'window_start_ts') === '2009-06-09T05:00:00.000Z' && valueOf(prediction, 'window_end_ts') === '2009-06-09T07:00:00.000Z', { prediction });
  assert('actual_window_range_verified', valueOf(actual, 'window_start_ts') === '2009-06-09T05:00:00.000Z' && valueOf(actual, 'window_end_ts') === '2009-06-09T07:00:00.000Z', { actual });
  assert('prediction_horizon_verified', valueOf(prediction, 'horizon_steps') === '3' && valueOf(prediction, 'step_ms') === '3600000', { prediction });
  assert('actual_window_not_read_by_state_estimate', valueOf(actual, 'readable_by_state_estimate_runtime') === 'false', { actual });
  assert('actual_window_not_read_by_prediction', valueOf(actual, 'readable_by_prediction_runtime') === 'false', { actual });
  assert('actual_window_read_by_backtest', valueOf(actual, 'readable_by_backtest_runtime') === 'true', { actual });
  assert('no_lookahead_rule_count', noLookahead.length === 8, { noLookahead });
  assert('actual_window_access_allowed_only_after_prediction', noLookahead.includes('actual_window_access_allowed_only_after_prediction'), { noLookahead });
  assert('runtime_phase_access_matrix_count', matrix.length === 6, { matrix });
  assert('strict_prohibition_count', strict.length === 16, { strict });
  assert('changed_files_allowed_count', changedAllowed.length === 2 && P8_03_FILES.every((file) => changedAllowed.includes(file)), { changedAllowed });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { history_window_defined: true, prediction_window_defined: true, actual_observation_window_defined: true, no_lookahead_rule_count: noLookahead.length, actual_window_access_allowed_only_after_prediction: true };
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  const scoped = changedFiles.filter((file) => P8_03_FILES.includes(file));
  if (changedFiles.length > 0) assert('p8_03_files_present', scoped.length === P8_03_FILES.length, { scoped, changedFiles });
  return { changedFiles, scoped };
}

try {
  verifyEntry();
  const result = verifyDoc();
  const changed = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p8_02_verified: true, ...result, changed_file_count: changed.scoped.length, branch_changed_file_count: changed.changedFiles.length, changed_files: changed.scoped, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
