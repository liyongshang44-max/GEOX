// scripts/governance_acceptance/P6_00_EXECUTION_SYSTEM_INTEGRATION_PLANNING.cjs
// Purpose: verify the P6-00 Execution System Integration planning charter.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P6_00_EXECUTION_SYSTEM_INTEGRATION_PLANNING';
const NEXT_STEP = 'P6_01_EXECUTION_SOURCE_BOUNDARY';
const P5_TAG = 'p5_policy_controlled_field_memory_governance_completion_before_p6';
const P5_COMMIT = 'bdcffe967c83442cee4798d6c550f64c3aca082d';
const P5_DOC = 'docs/tasks/P5-05-Field-Memory-Completion-Review-Before-P6.md';
const P5_SCRIPT = 'scripts/governance_acceptance/P5_05_FIELD_MEMORY_COMPLETION_REVIEW_BEFORE_P6.cjs';
const CURRENT_DOC = 'docs/tasks/P6-00-Execution-System-Integration-Planning.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P6_00_EXECUTION_SYSTEM_INTEGRATION_PLANNING.cjs';

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

function verifyP5Entry() {
  assert('p5_completion_doc_exists', exists(P5_DOC), { P5_DOC });
  assert('p5_completion_script_exists', exists(P5_SCRIPT), { P5_SCRIPT });
  assert('p5_completion_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P5_COMMIT, 'HEAD']), { P5_COMMIT });
  assert('p5_completion_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P5_TAG}`]), { P5_TAG });
  const tagCommit = tryGit(['rev-list', '-n', '1', P5_TAG]);
  assert('p5_completion_tag_points_to_completion_commit', tagCommit === P5_COMMIT, { tagCommit, expected: P5_COMMIT });
  const p5Doc = read(P5_DOC);
  assert('p5_doc_authorizes_p6', p5Doc.includes('P6_EXECUTION_SYSTEM_INTEGRATION') && p5Doc.includes(P5_TAG), { P5_DOC });
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_p5_tag', doc.includes(P5_TAG), { P5_TAG });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_blocks_automatic_dispatch', doc.includes('P6 is not unrestricted dispatch') && doc.includes('automatic_dispatch') && doc.includes('p6_00_creates_dispatch_adapter = false'), { CURRENT_DOC });

  const taskSeq = section(doc, 'P6 task sequence');
  const scope = section(doc, 'P6 integration scope');
  const nonGoals = section(doc, 'P6 non-goals');
  const principles = section(doc, 'P6 planning principles');
  const objects = section(doc, 'P6 allowed planning objects');
  const blocked = section(doc, 'P6 blocked planning semantics');
  const constraints = section(doc, 'P6 phase constraints');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P6-00');
  const forbidden = section(doc, 'Directories forbidden in P6-00');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('p6_task_sequence_count', taskSeq.length === 8, { taskSeq });
  assert('integration_scope_count', scope.length === 8, { scope });
  assert('non_goal_count', nonGoals.length === 20, { nonGoals });
  assert('planning_principle_count', principles.length === 12, { principles });
  assert('allowed_planning_object_count', objects.length === 8, { objects });
  assert('blocked_planning_semantic_count', blocked.length === 17, { blocked });
  assert('phase_constraint_count', constraints.length === 8, { constraints });
  assert('secondary_review_rules_verified', secondary.length === 5 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbidden.includes(prefix)), { forbidden });
  assert('boundary_blocks_runtime_db_frontend_execution', boundary.includes('p6_00_changes_frontend = false') && boundary.includes('p6_00_changes_runtime = false') && boundary.includes('p6_00_changes_db = false') && boundary.includes('p6_00_changes_execution = false'), { boundary });
  assert('boundary_blocks_dispatch_receipt_audit', boundary.includes('p6_00_creates_dispatch_adapter = false') && boundary.includes('p6_00_creates_ao_act_task = false') && boundary.includes('p6_00_creates_receipt = false') && boundary.includes('p6_00_creates_execution_audit_write = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { p6_task_sequence_count: taskSeq.length, integration_scope_count: scope.length, non_goal_count: nonGoals.length, planning_principle_count: principles.length, allowed_planning_object_count: objects.length, blocked_planning_semantic_count: blocked.length, phase_constraint_count: constraints.length, secondary_review_required: true };
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
  verifyP5Entry();
  const counts = verifyCurrentDoc();
  const changedFiles = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p5_completion_verified: true, p5_completion_tag_verified: true, ...counts, changed_file_count: changedFiles.length, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
