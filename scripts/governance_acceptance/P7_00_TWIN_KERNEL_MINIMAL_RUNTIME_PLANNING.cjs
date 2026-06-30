// scripts/governance_acceptance/P7_00_TWIN_KERNEL_MINIMAL_RUNTIME_PLANNING.cjs
// Purpose: verify the P7-00 Twin Kernel Minimal Runtime Planning gate.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P7_00_TWIN_KERNEL_MINIMAL_RUNTIME_PLANNING';
const NEXT_STEP = 'P7_01_TWIN_EVIDENCE_WINDOW_CONTRACT';
const P6_COMPLETION_TAG = 'p6_execution_system_integration_completion';
const P6_COMPLETION_COMMIT = 'f7e8f88bc905b62f5f4a26ef2e049813763ac84d';
const P6_COMPLETION_DOC = 'docs/legacy/tasks/P6-07-Execution-Completion-Review.md';
const P6_COMPLETION_SCRIPT = 'scripts/governance_acceptance/P6_07_EXECUTION_COMPLETION_REVIEW.cjs';
const CURRENT_DOC = 'docs/legacy/tasks/P7-00-Twin-Kernel-Minimal-Runtime-Planning.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P7_00_TWIN_KERNEL_MINIMAL_RUNTIME_PLANNING.cjs';

const ALLOWED_CHANGED_FILES = [CURRENT_DOC, CURRENT_SCRIPT];
const FORBIDDEN_PREFIXES = ['apps/web/', 'apps/server/', 'apps/executor/', 'packages/twin-kernel/', 'packages/contracts/', 'packages/', 'db/', 'migrations/', 'scripts/twin_kernel/', 'scripts/demo_seed/', 'scripts/runtime/'];
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
  assert('p6_completion_doc_exists', exists(P6_COMPLETION_DOC), { P6_COMPLETION_DOC });
  assert('p6_completion_script_exists', exists(P6_COMPLETION_SCRIPT), { P6_COMPLETION_SCRIPT });
  assert('p6_completion_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P6_COMPLETION_COMMIT, 'HEAD']), { P6_COMPLETION_COMMIT });
  assert('p6_completion_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P6_COMPLETION_TAG}`]), { P6_COMPLETION_TAG });
  assert('p6_completion_tag_points_to_completion_commit', tryGit(['rev-list', '-n', '1', P6_COMPLETION_TAG]) === P6_COMPLETION_COMMIT, { P6_COMPLETION_TAG, P6_COMPLETION_COMMIT });
  const p6Doc = read(P6_COMPLETION_DOC);
  assert('p6_completion_doc_verified', p6Doc.includes('P6_COMPLETE_NO_NEXT_PHASE') && p6Doc.includes('p6_execution_system_integration_completion'), { P6_COMPLETION_DOC });
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_opens_p7_by_user_decision', doc.includes('p7_opened_by_user_decision: true') && doc.includes('p7_not_automatic_extension_of_p6: true'), { CURRENT_DOC });
  assert('current_doc_planning_only', doc.includes('P7-00 itself is planning-only') && doc.includes('does not implement a twin runtime'), { CURRENT_DOC });

  const taskSequence = section(doc, 'P7 task sequence');
  const capabilityTargets = section(doc, 'P7 capability targets');
  const dataScope = section(doc, 'P7 data scope');
  const runtimePrinciples = section(doc, 'P7 runtime boundary principles');
  const nonGoals = section(doc, 'P7 non-goals');
  const completionDefinition = section(doc, 'P7 completion definition');
  const proposedLocations = section(doc, 'Proposed P7 runtime location');
  const handoff = section(doc, 'P7-01 handoff');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P7-00');
  const forbiddenDirs = section(doc, 'Directories forbidden in P7-00');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('p7_task_sequence_count', taskSequence.length === 8, { taskSequence });
  assert('p7_capability_target_count', capabilityTargets.length === 6, { capabilityTargets });
  assert('p7_data_scope_count', dataScope.length === 7, { dataScope });
  assert('p7_runtime_boundary_principle_count', runtimePrinciples.length === 14, { runtimePrinciples });
  assert('p7_non_goal_count', nonGoals.length === 22, { nonGoals });
  assert('p7_completion_definition_count', completionDefinition.length === 12, { completionDefinition });
  assert('proposed_runtime_location_count', proposedLocations.length === 4, { proposedLocations });
  assert('p7_01_handoff_rule_count', handoff.length === 11, { handoff });
  assert('secondary_review_rules_verified', secondary.length === 5 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs });
  assert('boundary_blocks_runtime_db_frontend_execution', boundary.includes('p7_00_changes_frontend = false') && boundary.includes('p7_00_changes_runtime = false') && boundary.includes('p7_00_changes_db = false') && boundary.includes('p7_00_changes_execution = false'), { boundary });
  assert('boundary_blocks_twin_outputs_and_side_effects', boundary.includes('p7_00_creates_twin_kernel_package = false') && boundary.includes('p7_00_creates_state_estimator = false') && boundary.includes('p7_00_creates_prediction_run = false') && boundary.includes('p7_00_creates_field_memory_write = false') && boundary.includes('p7_00_creates_model_update = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { p7_task_sequence_count: taskSequence.length, p7_capability_target_count: capabilityTargets.length, p7_data_scope_count: dataScope.length, p7_runtime_boundary_principle_count: runtimePrinciples.length, p7_non_goal_count: nonGoals.length, p7_completion_definition_count: completionDefinition.length, proposed_runtime_location_count: proposedLocations.length, p7_01_handoff_rule_count: handoff.length, secondary_review_required: true };
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  assert('changed_file_count_verified', changedFiles.length === ALLOWED_CHANGED_FILES.length, { changedFiles });
  for (const file of ALLOWED_CHANGED_FILES) assert(`changed_file_present:${file}`, changedFiles.includes(file), { changedFiles });
  for (const file of changedFiles) assert(`changed_file_allowed:${file}`, ALLOWED_CHANGED_FILES.includes(file), { changedFiles });
  assert('no_frontend_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/web/')), { changedFiles });
  assert('no_runtime_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/server/') && !file.startsWith('apps/executor/') && !file.startsWith('packages/')), { changedFiles });
  assert('no_db_changed_by_this_task', changedFiles.every((file) => !file.startsWith('db/') && !file.startsWith('migrations/') && !file.includes('migration')), { changedFiles });
  assert('no_execution_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/executor/') && !file.startsWith('scripts/twin_kernel/') && !file.startsWith('scripts/runtime/') && !file.startsWith('scripts/demo_seed/')), { changedFiles });
  return changedFiles;
}

try {
  verifyEntry();
  const counts = verifyCurrentDoc();
  const changedFiles = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p6_completion_tag_verified: true, p7_opened_by_user_decision: true, ...counts, changed_file_count: changedFiles.length, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
