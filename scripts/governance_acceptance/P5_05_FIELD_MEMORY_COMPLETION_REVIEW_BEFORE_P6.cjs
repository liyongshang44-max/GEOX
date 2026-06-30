// scripts/governance_acceptance/P5_05_FIELD_MEMORY_COMPLETION_REVIEW_BEFORE_P6.cjs
// Purpose: verify the P5 Field Memory governance completion review before P6 may begin.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P5_05_FIELD_MEMORY_COMPLETION_REVIEW_BEFORE_P6';
const NEXT_STEP = 'P6_EXECUTION_SYSTEM_INTEGRATION';
const P4_TAG = 'p4_policy_controlled_roi_completion_before_p5';
const COMPLETION_TAG = 'p5_policy_controlled_field_memory_governance_completion_before_p6';
const CURRENT_DOC = 'docs/legacy/tasks/P5-05-Field-Memory-Completion-Review-Before-P6.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P5_05_FIELD_MEMORY_COMPLETION_REVIEW_BEFORE_P6.cjs';

const PRIOR_TASKS = [
  ['P5_00', 'P5_00_POLICY_CONTROLLED_FIELD_MEMORY_GOVERNANCE_PLANNING', 'docs/legacy/tasks/P5-00-Policy-Controlled-Field-Memory-Governance-Planning.md', 'scripts/governance_acceptance/P5_00_POLICY_CONTROLLED_FIELD_MEMORY_GOVERNANCE_PLANNING.cjs', '40ad9d333050b7aae874228c3af414de4a988317'],
  ['P5_01', 'P5_01_FIELD_MEMORY_ELIGIBILITY_SOURCE_BOUNDARY', 'docs/legacy/tasks/P5-01-Field-Memory-Eligibility-Source-Boundary.md', 'scripts/governance_acceptance/P5_01_FIELD_MEMORY_ELIGIBILITY_SOURCE_BOUNDARY.cjs', 'f04f8bde02545c3442410ef78353c4e573d95307'],
  ['P5_02', 'P5_02_FIELD_MEMORY_POLICY_GATE_CONTRACT', 'docs/legacy/tasks/P5-02-Field-Memory-Policy-Gate-Contract.md', 'scripts/governance_acceptance/P5_02_FIELD_MEMORY_POLICY_GATE_CONTRACT.cjs', 'bf28e642e7aab7f2ca29714363d3919a65a3f26e'],
  ['P5_03', 'P5_03_FIELD_MEMORY_FORMALIZATION_OUTPUT_CONTRACT', 'docs/legacy/tasks/P5-03-Field-Memory-Formalization-Output-Contract.md', 'scripts/governance_acceptance/P5_03_FIELD_MEMORY_FORMALIZATION_OUTPUT_CONTRACT.cjs', 'a4af4e348c47f72610bcb0b13f4b30bb87ce5b47'],
  ['P5_04', 'P5_04_FIELD_MEMORY_NEGATIVE_BOUNDARY_MATRIX', 'docs/legacy/tasks/P5-04-Field-Memory-Negative-Boundary-Matrix.md', 'scripts/governance_acceptance/P5_04_FIELD_MEMORY_NEGATIVE_BOUNDARY_MATRIX.cjs', '2dd775097d3da316eb7ed4e4f57af72419ad9b9c'],
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
function section(text, heading) { const marker = `## ${heading}`; const start = text.indexOf(marker); if (start < 0) return []; const open = text.indexOf('```text', start); if (open < 0) return []; const bodyStart = text.indexOf('\n', open) + 1; const close = text.indexOf('```', bodyStart); if (close < 0) return []; return text.slice(bodyStart, close).split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function assert(name, condition, details = {}) { assertions.push({ name, passed: condition === true, details }); if (condition !== true) { const error = new Error(`ASSERTION_FAILED:${name}`); error.details = details; throw error; } }
function summary() { const failed = assertions.filter((item) => !item.passed); return { assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) }; }

function verifyPriorTasks() {
  assert('p4_completion_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P4_TAG}`]), { P4_TAG });
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
  assert('current_doc_has_completion_tag', doc.includes(COMPLETION_TAG), { COMPLETION_TAG });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_tag_not_required_before_acceptance', doc.includes('tag_is_not_required_before_running_P5_05_acceptance = true'), { CURRENT_DOC });

  const capabilities = section(doc, 'P5 completed governance capabilities');
  const excluded = section(doc, 'P5 excluded capabilities');
  const boundary = section(doc, 'Completion boundary result');
  const p6Rules = section(doc, 'P6 entry rule');
  const tagRules = section(doc, 'Completion tag');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P5-05');
  const forbiddenDirs = section(doc, 'Directories forbidden in P5-05');
  const assertionsBlock = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('completed_governance_capability_count', capabilities.length === 5, { capabilities });
  assert('excluded_capability_count', excluded.length === 19, { excluded });
  assert('completion_boundary_field_count', boundary.length === 14, { boundary });
  assert('p6_entry_rule_count', p6Rules.length === 6, { p6Rules });
  assert('completion_tag_rules_verified', tagRules.length === 4 && tagRules[0] === `required_completion_tag: ${COMPLETION_TAG}`, { tagRules });
  assert('secondary_review_rules_verified', secondary.length === 5 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs });
  assert('boundary_blocks_runtime_db_frontend_execution', assertionsBlock.includes('p5_05_changes_frontend = false') && assertionsBlock.includes('p5_05_changes_runtime = false') && assertionsBlock.includes('p5_05_changes_db = false') && assertionsBlock.includes('p5_05_changes_execution = false'), { assertionsBlock });
  assert('boundary_blocks_memory_model_learning', assertionsBlock.includes('p5_05_creates_field_memory_record = false') && assertionsBlock.includes('p5_05_creates_model_update = false') && assertionsBlock.includes('p5_05_creates_automatic_learning = false'), { assertionsBlock });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { completed_governance_capability_count: capabilities.length, excluded_capability_count: excluded.length, completion_boundary_field_count: boundary.length, p6_entry_rule_count: p6Rules.length, secondary_review_required: true };
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
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, verified_prior_task_count: verifiedPriorTaskCount, p4_completion_tag_verified: true, ...counts, completion_tag: COMPLETION_TAG, tag_required_before_p6: true, tag_required_before_acceptance: false, changed_file_count: changedFiles.length, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
