// scripts/governance_acceptance/P8_00_REAL_EVIDENCE_CLOSED_LOOP_PLANNING.cjs
// Purpose: verify the P8-00 Real Evidence Closed-Loop Planning gate.
// Boundary: checks planning and governance text only; later P8 files may exist on the same branch.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P8_00_REAL_EVIDENCE_CLOSED_LOOP_PLANNING';
const NEXT_STEP = 'P8_01_REAL_EVIDENCE_SOURCE_CONTRACT';
const P7_COMPLETION_TAG = 'p7_twin_kernel_minimal_runtime_completion';
const CURRENT_DOC = 'docs/tasks/P8-00-Real-Evidence-Closed-Loop-Planning.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P8_00_REAL_EVIDENCE_CLOSED_LOOP_PLANNING.cjs';
const P8_00_FILES = [CURRENT_DOC, CURRENT_SCRIPT];
const assertions = [];

function abs(file) { return path.resolve(ROOT, file); }
function exists(file) { return fs.existsSync(abs(file)); }
function read(file) { return fs.readFileSync(abs(file), 'utf8'); }
function tryGit(args) { try { return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } }
function gitOk(args) { try { childProcess.execFileSync('git', args, { cwd: ROOT, stdio: 'ignore' }); return true; } catch { return false; } }
function changedFilesFromMain() { return [...new Set(tryGit(['diff', '--name-only', 'main...HEAD']).split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].sort(); }
function section(text, heading) { const marker = `## ${heading}`; const start = text.indexOf(marker); if (start < 0) return []; const open = text.indexOf('```text', start); if (open < 0) return []; const bodyStart = text.indexOf('\n', open) + 1; const close = text.indexOf('```', bodyStart); if (close < 0) return []; return text.slice(bodyStart, close).split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function assert(name, condition, details = {}) { assertions.push({ name, passed: condition === true, details }); if (condition !== true) { const error = new Error(`ASSERTION_FAILED:${name}`); error.details = details; throw error; } }
function summary() { const failed = assertions.filter((item) => !item.passed); return { assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) }; }

function verifyDoc() {
  assert('p7_completion_tag_exists', gitOk(['rev-parse', '--verify', `refs/tags/${P7_COMPLETION_TAG}`]), { P7_COMPLETION_TAG });
  assert('p7_completion_tag_is_ancestor', gitOk(['merge-base', '--is-ancestor', P7_COMPLETION_TAG, 'HEAD']), { P7_COMPLETION_TAG });
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  const scope = section(doc, 'Fixed replay scope');
  const windows = section(doc, 'Window concepts frozen in P8-00');
  const rules = section(doc, 'Read-only and no-write rules');
  const outOfScope = section(doc, 'P8 out of scope');
  const next = section(doc, 'Next step');
  assert('one_problem_only', scope.includes('problem = soil_moisture_state_estimation'), { scope });
  assert('one_project_only', scope.includes('project_id = P_DEFAULT'), { scope });
  assert('one_group_only', scope.includes('sensor_group_id = G_CAF'), { scope });
  assert('one_sensor_only', scope.includes('sensor_id = CAF009'), { scope });
  assert('one_metric_kind_only', scope.includes('metric_kind = soil_moisture'), { scope });
  assert('window_concept_count', windows.length === 3, { windows });
  assert('read_only_rule_count', rules.length === 14, { rules });
  assert('out_of_scope_count', outOfScope.length === 12, { outOfScope });
  assert('next_step_is_p8_01', next.length === 1 && next[0] === NEXT_STEP, { next });
  return { fixed_scope_verified: true, window_concept_count: windows.length, read_only_rule_count: rules.length, out_of_scope_count: outOfScope.length };
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  const scoped = changedFiles.filter((file) => P8_00_FILES.includes(file));
  if (changedFiles.length > 0) assert('p8_00_files_present', scoped.length === P8_00_FILES.length, { scoped, changedFiles });
  return { changedFiles, scoped };
}

try {
  const counts = verifyDoc();
  const changed = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p7_completion_tag_verified: true, ...counts, changed_file_count: changed.scoped.length, branch_changed_file_count: changed.changedFiles.length, changed_files: changed.scoped, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
