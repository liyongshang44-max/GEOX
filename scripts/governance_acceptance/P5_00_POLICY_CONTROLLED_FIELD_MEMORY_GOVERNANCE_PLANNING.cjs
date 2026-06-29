// scripts/governance_acceptance/P5_00_POLICY_CONTROLLED_FIELD_MEMORY_GOVERNANCE_PLANNING.cjs
// Purpose: verify the P5-00 Field Memory governance planning charter.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P5_00_POLICY_CONTROLLED_FIELD_MEMORY_GOVERNANCE_PLANNING';
const NEXT_STEP = 'P5_01_FIELD_MEMORY_ELIGIBILITY_SOURCE_BOUNDARY';
const P4_TAG = 'p4_policy_controlled_roi_completion_before_p5';
const P4_COMMIT = 'bc786fc672d604854ae0124cb4e52d6df9ce7868';
const P4_DOC = 'docs/tasks/P4-05-ROI-Completion-Review-Before-P5.md';
const P4_SCRIPT = 'scripts/governance_acceptance/P4_05_ROI_COMPLETION_REVIEW_BEFORE_P5.cjs';
const CURRENT_DOC = 'docs/tasks/P5-00-Policy-Controlled-Field-Memory-Governance-Planning.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P5_00_POLICY_CONTROLLED_FIELD_MEMORY_GOVERNANCE_PLANNING.cjs';

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

function verifyP4Entry() {
  assert('p4_doc_exists', exists(P4_DOC), { P4_DOC });
  assert('p4_script_exists', exists(P4_SCRIPT), { P4_SCRIPT });
  assert('p4_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P4_COMMIT, 'HEAD']), { P4_COMMIT });
  assert('p4_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P4_TAG}`]), { P4_TAG });
  const tagCommit = tryGit(['rev-list', '-n', '1', P4_TAG]);
  assert('p4_tag_points_to_completion_commit', tagCommit === P4_COMMIT, { tagCommit, expected: P4_COMMIT });
  const p4Doc = read(P4_DOC);
  assert('p4_doc_authorizes_p5', p4Doc.includes('P5_POLICY_CONTROLLED_FIELD_MEMORY_GOVERNANCE') && p4Doc.includes(P4_TAG), { P4_DOC });
}

function verifyP5Doc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_p4_tag', doc.includes(P4_TAG), { P4_TAG });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_blocks_automatic_learning', doc.includes('automatic_learning') && doc.includes('p5_00_creates_automatic_learning = false'), { CURRENT_DOC });

  const taskSeq = section(doc, 'P5 task sequence');
  const scope = section(doc, 'P5 governance scope');
  const nonGoals = section(doc, 'P5 non-goals');
  const principles = section(doc, 'P5 governance principles');
  const deferred = section(doc, 'P5 deferred-to-P6 boundary');
  const blocked = section(doc, 'P5 blocked semantics');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P5-00');
  const forbidden = section(doc, 'Directories forbidden in P5-00');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('p5_task_sequence_count', taskSeq.length === 6, { taskSeq });
  assert('governance_scope_count', scope.length === 7, { scope });
  assert('non_goal_count', nonGoals.length === 18, { nonGoals });
  assert('governance_principle_count', principles.length === 10, { principles });
  assert('deferred_to_p6_boundary_count', deferred.length === 5, { deferred });
  assert('blocked_semantic_count', blocked.length === 15, { blocked });
  assert('secondary_review_rules_verified', secondary.length === 5 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbidden.includes(prefix)), { forbidden });
  assert('boundary_blocks_runtime_db_frontend_execution', boundary.includes('p5_00_changes_frontend = false') && boundary.includes('p5_00_changes_runtime = false') && boundary.includes('p5_00_changes_db = false') && boundary.includes('p5_00_changes_execution = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { p5_task_sequence_count: taskSeq.length, governance_scope_count: scope.length, non_goal_count: nonGoals.length, governance_principle_count: principles.length, deferred_to_p6_boundary_count: deferred.length, blocked_semantic_count: blocked.length, secondary_review_required: true };
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
  verifyP4Entry();
  const counts = verifyP5Doc();
  const changedFiles = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p4_completion_verified: true, p4_completion_tag_verified: true, ...counts, changed_file_count: changedFiles.length, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
