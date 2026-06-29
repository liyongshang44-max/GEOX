// scripts/governance_acceptance/P6_07_EXECUTION_COMPLETION_REVIEW.cjs
// Purpose: verify the P6-07 Execution Completion Review.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P6_07_EXECUTION_COMPLETION_REVIEW';
const NEXT_STEP = 'P6_COMPLETE_NO_NEXT_PHASE';
const P5_TAG = 'p5_policy_controlled_field_memory_governance_completion_before_p6';
const P6_COMPLETION_TAG = 'p6_execution_system_integration_completion';
const P6_06_COMMIT = '0117a4913a757af0e117c8e4f41f9c3504a55746';

const PRIOR_TASKS = [
  {
    gate: 'P6_00_EXECUTION_SYSTEM_INTEGRATION_PLANNING',
    doc: 'docs/tasks/P6-00-Execution-System-Integration-Planning.md',
    script: 'scripts/governance_acceptance/P6_00_EXECUTION_SYSTEM_INTEGRATION_PLANNING.cjs',
  },
  {
    gate: 'P6_01_EXECUTION_SOURCE_BOUNDARY',
    doc: 'docs/tasks/P6-01-Execution-Source-Boundary.md',
    script: 'scripts/governance_acceptance/P6_01_EXECUTION_SOURCE_BOUNDARY.cjs',
  },
  {
    gate: 'P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT',
    doc: 'docs/tasks/P6-02-Execution-Authorization-Gate-Contract.md',
    script: 'scripts/governance_acceptance/P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT.cjs',
  },
  {
    gate: 'P6_03_EXECUTION_DISPATCH_OUTPUT_CONTRACT',
    doc: 'docs/tasks/P6-03-Execution-Dispatch-Output-Contract.md',
    script: 'scripts/governance_acceptance/P6_03_EXECUTION_DISPATCH_OUTPUT_CONTRACT.cjs',
  },
  {
    gate: 'P6_04_EXECUTION_RECEIPT_INTAKE_CONTRACT',
    doc: 'docs/tasks/P6-04-Execution-Receipt-Intake-Contract.md',
    script: 'scripts/governance_acceptance/P6_04_EXECUTION_RECEIPT_INTAKE_CONTRACT.cjs',
  },
  {
    gate: 'P6_05_EXECUTION_AUDIT_TRACE_CONTRACT',
    doc: 'docs/tasks/P6-05-Execution-Audit-Trace-Contract.md',
    script: 'scripts/governance_acceptance/P6_05_EXECUTION_AUDIT_TRACE_CONTRACT.cjs',
  },
  {
    gate: 'P6_06_EXECUTION_NEGATIVE_BOUNDARY_MATRIX',
    doc: 'docs/tasks/P6-06-Execution-Negative-Boundary-Matrix.md',
    script: 'scripts/governance_acceptance/P6_06_EXECUTION_NEGATIVE_BOUNDARY_MATRIX.cjs',
  },
];

const CURRENT_DOC = 'docs/tasks/P6-07-Execution-Completion-Review.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P6_07_EXECUTION_COMPLETION_REVIEW.cjs';
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
function section(text, heading) { const marker = `## ${heading}`; const start = text.indexOf(marker); if (start < 0) return []; const open = text.indexOf('```text', start); if (open < 0) return []; const bodyStart = text.indexOf('\n', open) + 1; const close = text.indexOf('```', bodyStart); if (close < 0) return []; return text.slice(bodyStart, close).split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function assert(name, condition, details = {}) { assertions.push({ name, passed: condition === true, details }); if (condition !== true) { const error = new Error(`ASSERTION_FAILED:${name}`); error.details = details; throw error; } }
function summary() { const failed = assertions.filter((item) => !item.passed); return { assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) }; }

function verifyEntry() {
  assert('p5_completion_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P5_TAG}`]), { P5_TAG });
  assert('p6_06_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P6_06_COMMIT, 'HEAD']), { P6_06_COMMIT });
  for (const task of PRIOR_TASKS) {
    assert(`prior_doc_exists:${task.gate}`, exists(task.doc), { doc: task.doc });
    assert(`prior_script_exists:${task.gate}`, exists(task.script), { script: task.script });
    const doc = read(task.doc);
    assert(`prior_doc_has_gate:${task.gate}`, doc.includes(task.gate), { doc: task.doc });
  }
  const p606Doc = read('docs/tasks/P6-06-Execution-Negative-Boundary-Matrix.md');
  assert('p6_06_doc_handoff_verified', p606Doc.includes('P6_07_EXECUTION_COMPLETION_REVIEW') && p606Doc.includes('p6_07_handoff_rule_count = 10'), { doc: 'docs/tasks/P6-06-Execution-Negative-Boundary-Matrix.md' });
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_has_completion_tag', doc.includes(`completion_tag: ${P6_COMPLETION_TAG}`), { P6_COMPLETION_TAG });
  assert('current_doc_tag_after_acceptance_only', doc.includes('tag_required_before_acceptance: false') && doc.includes('tag_required_after_acceptance: true'), { CURRENT_DOC });

  const priorTasks = section(doc, 'Verified P6 task chain');
  const capabilities = section(doc, 'Verified P6 governance capabilities');
  const excluded = section(doc, 'Excluded capabilities');
  const boundaryFields = section(doc, 'P6 completion boundary fields');
  const rules = section(doc, 'P6 completion rules');
  const states = section(doc, 'Completion state vocabulary');
  const finalBoundary = section(doc, 'P6 final boundary statement');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P6-07');
  const forbiddenDirs = section(doc, 'Directories forbidden in P6-07');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('verified_prior_task_count', priorTasks.length === 7, { priorTasks });
  assert('completed_governance_capability_count', capabilities.length === 7, { capabilities });
  assert('excluded_capability_count', excluded.length === 24, { excluded });
  assert('completion_boundary_field_count', boundaryFields.length === 16, { boundaryFields });
  assert('p6_completion_rule_count', rules.length === 9, { rules });
  assert('completion_state_count', states.length === 5, { states });
  assert('final_boundary_statement_count', finalBoundary.length === 13, { finalBoundary });
  assert('secondary_review_rules_verified', secondary.length === 5 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs });
  assert('boundary_blocks_runtime_db_frontend_execution', boundary.includes('p6_07_changes_frontend = false') && boundary.includes('p6_07_changes_runtime = false') && boundary.includes('p6_07_changes_db = false') && boundary.includes('p6_07_changes_execution = false'), { boundary });
  assert('boundary_blocks_execution_side_effects', boundary.includes('p6_07_creates_execution_audit_write = false') && boundary.includes('p6_07_creates_receipt_write = false') && boundary.includes('p6_07_creates_ao_act_task = false') && boundary.includes('p6_07_creates_model_update = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return {
    verified_prior_task_count: priorTasks.length,
    completed_governance_capability_count: capabilities.length,
    excluded_capability_count: excluded.length,
    completion_boundary_field_count: boundaryFields.length,
    p6_completion_rule_count: rules.length,
    completion_state_count: states.length,
    final_boundary_statement_count: finalBoundary.length,
    completion_tag: P6_COMPLETION_TAG,
    tag_required_before_acceptance: false,
    tag_required_after_acceptance: true,
    secondary_review_required: true,
  };
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  assert('changed_file_count_verified', changedFiles.length === ALLOWED_CHANGED_FILES.length, { changedFiles });
  for (const file of ALLOWED_CHANGED_FILES) assert(`changed_file_present:${file}`, changedFiles.includes(file), { changedFiles });
  for (const file of changedFiles) assert(`changed_file_allowed:${file}`, ALLOWED_CHANGED_FILES.includes(file), { changedFiles });
  assert('no_frontend_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/web/')), { changedFiles });
  assert('no_runtime_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/server/') && !file.startsWith('apps/executor/') && !file.startsWith('packages/contracts/')), { changedFiles });
  assert('no_db_changed_by_this_task', changedFiles.every((file) => !file.startsWith('db/') && !file.startsWith('migrations/') && !file.includes('migration')), { changedFiles });
  assert('no_execution_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/executor/') && !file.startsWith('scripts/runtime/') && !file.startsWith('scripts/demo_seed/')), { changedFiles });
  return changedFiles;
}

try {
  verifyEntry();
  const counts = verifyCurrentDoc();
  const changedFiles = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p6_06_verified: true, p5_completion_tag_verified: true, ...counts, changed_file_count: changedFiles.length, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
