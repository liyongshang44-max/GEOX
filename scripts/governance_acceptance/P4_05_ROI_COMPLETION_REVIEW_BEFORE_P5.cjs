// scripts/governance_acceptance/P4_05_ROI_COMPLETION_REVIEW_BEFORE_P5.cjs
// Purpose: verify the P4 completion review before P5 may begin.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P4_05_ROI_COMPLETION_REVIEW_BEFORE_P5';
const NEXT_STEP = 'P5_POLICY_CONTROLLED_FIELD_MEMORY_GOVERNANCE';
const COMPLETION_TAG = 'p4_policy_controlled_roi_completion_before_p5';
const CURRENT_DOC = 'docs/legacy/tasks/P4-05-ROI-Completion-Review-Before-P5.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P4_05_ROI_COMPLETION_REVIEW_BEFORE_P5.cjs';

const PRIOR_TASKS = [
  ['P4_00', 'P4_POLICY_CONTROLLED_ROI_PLANNING', 'docs/legacy/tasks/P4-Policy-Controlled-ROI-Planning.md', 'scripts/governance_acceptance/P4_POLICY_CONTROLLED_ROI_PLANNING.cjs', '7fb55a690cfff90ef81a9f62e45809552cd38cba'],
  ['P4_01', 'P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION', 'docs/tasks/P4-01-ROI-Source-Boundary-Reconciliation.md', 'scripts/governance_acceptance/P4_01_ROI_SOURCE_BOUNDARY_RECONCILIATION.cjs', 'f6bdd572685403a87faa268a70cc86c027f348b2'],
  ['P4_02', 'P4_02_ROI_POLICY_GATE_CONTRACT', 'docs/tasks/P4-02-ROI-Policy-Gate-Contract.md', 'scripts/governance_acceptance/P4_02_ROI_POLICY_GATE_CONTRACT.cjs', 'b8341272a990494ebba483ff644bb3837b89ec34'],
  ['P4_03', 'P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT', 'docs/tasks/P4-03-ROI-Read-Model-Output-Contract.md', 'scripts/governance_acceptance/P4_03_ROI_READ_MODEL_OUTPUT_CONTRACT.cjs', 'c6077ab5c9505cdacb07c823397a3d5584a3d328'],
  ['P4_04', 'P4_04_ROI_NEGATIVE_BOUNDARY_MATRIX', 'docs/legacy/tasks/P4-04-ROI-Negative-Boundary-Matrix.md', 'scripts/governance_acceptance/P4_04_ROI_NEGATIVE_BOUNDARY_MATRIX.cjs', '89a0f62ea5c15c0df3fe01ab478d6098b64ada95'],
];

const ALLOWED_CHANGED_FILES = [CURRENT_DOC, CURRENT_SCRIPT];
const FORBIDDEN_PREFIXES = ['apps/web/', 'apps/server/', 'apps/executor/', 'packages/contracts/', 'packages/', 'db/', 'migrations/', 'scripts/demo_seed/', 'scripts/runtime/'];
const assertions = [];

function abs(file) { return path.resolve(ROOT, file); }
function exists(file) { return fs.existsSync(abs(file)); }
function read(file) { return fs.readFileSync(abs(file), 'utf8'); }
function git(args) { return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function tryGit(args) { try { return git(args); } catch { return ''; } }
function gitSucceeds(args) { try { childProcess.execFileSync('git', args, { cwd: ROOT, stdio: 'ignore' }); return true; } catch { return false; } }
function changedFilesFromMain() { return tryGit(['diff', '--name-only', 'main...HEAD']).split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function assert(name, condition, details = {}) { assertions.push({ name, passed: condition === true, details }); if (condition !== true) { const error = new Error(`ASSERTION_FAILED:${name}`); error.details = details; throw error; } }
function section(text, heading) { const marker = `## ${heading}`; const start = text.indexOf(marker); if (start < 0) return []; const open = text.indexOf('```text', start); if (open < 0) return []; const bodyStart = text.indexOf('\n', open) + 1; const close = text.indexOf('```', bodyStart); if (close < 0) return []; return text.slice(bodyStart, close).split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function summary() { const failed = assertions.filter((item) => !item.passed); return { assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) }; }

function verifyPriorTasks() {
  for (const [key, gate, docPath, scriptPath, commit] of PRIOR_TASKS) {
    assert(`${key}_doc_exists`, exists(docPath), { docPath });
    assert(`${key}_script_exists`, exists(scriptPath), { scriptPath });
    assert(`${key}_doc_has_gate`, read(docPath).includes(gate), { gate, docPath });
    assert(`${key}_script_has_gate`, read(scriptPath).includes(gate), { gate, scriptPath });
    assert(`${key}_commit_is_ancestor`, gitSucceeds(['merge-base', '--is-ancestor', commit, 'HEAD']), { commit });
  }
  return PRIOR_TASKS.length;
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_tag', doc.includes(COMPLETION_TAG), { COMPLETION_TAG });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });

  const completed = section(doc, 'P4 completed governance capabilities');
  const excluded = section(doc, 'P4 excluded capabilities');
  const boundary = section(doc, 'Completion boundary result');
  const p5Rules = section(doc, 'P5 entry rule');
  const tagRules = section(doc, 'Completion tag');
  const allowed = section(doc, 'Changed files allowed in P4-05');
  const forbidden = section(doc, 'Directories forbidden in P4-05');
  const next = section(doc, 'Next step');

  assert('completed_capability_count', completed.length === 5, { completed });
  assert('excluded_capability_count', excluded.length === 17, { excluded });
  assert('completion_boundary_count', boundary.length === 12, { boundary });
  assert('p5_entry_rule_count', p5Rules.length === 5, { p5Rules });
  assert('completion_tag_rule_count', tagRules.length === 4 && tagRules[0] === `required_completion_tag: ${COMPLETION_TAG}`, { tagRules });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbidden.includes(prefix)), { forbidden });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { completed_governance_capability_count: completed.length, excluded_capability_count: excluded.length, completion_boundary_field_count: boundary.length, p5_entry_rule_count: p5Rules.length };
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  assert('changed_file_count_verified', changedFiles.length === ALLOWED_CHANGED_FILES.length, { changedFiles });
  for (const file of ALLOWED_CHANGED_FILES) assert(`changed_file_present:${file}`, changedFiles.includes(file), { changedFiles });
  for (const file of changedFiles) assert(`changed_file_allowed:${file}`, ALLOWED_CHANGED_FILES.includes(file), { changedFiles });
  assert('no_frontend_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/web/')), { changedFiles });
  assert('no_runtime_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/server/') && !file.startsWith('apps/executor/') && !file.startsWith('packages/contracts/')), { changedFiles });
  assert('no_db_changed_by_this_task', changedFiles.every((file) => !file.startsWith('db/') && !file.startsWith('migrations/') && !file.includes('migration')), { changedFiles });
  assert('no_execution_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/executor/') && !file.includes('ao_act') && !file.includes('receipt')), { changedFiles });
  return changedFiles;
}

try {
  const verifiedPriorTaskCount = verifyPriorTasks();
  const counts = verifyCurrentDoc();
  const changedFiles = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, verified_prior_task_count: verifiedPriorTaskCount, ...counts, completion_tag: COMPLETION_TAG, tag_required_before_p5: true, tag_required_before_acceptance: false, changed_file_count: changedFiles.length, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
