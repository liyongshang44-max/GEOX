// scripts/governance_acceptance/P5_01_FIELD_MEMORY_ELIGIBILITY_SOURCE_BOUNDARY.cjs
// Purpose: verify the P5-01 Field Memory eligibility source boundary.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P5_01_FIELD_MEMORY_ELIGIBILITY_SOURCE_BOUNDARY';
const NEXT_STEP = 'P5_02_FIELD_MEMORY_POLICY_GATE_CONTRACT';
const P4_TAG = 'p4_policy_controlled_roi_completion_before_p5';
const P5_00_COMMIT = '40ad9d333050b7aae874228c3af414de4a988317';
const P5_00_DOC = 'docs/tasks/P5-00-Policy-Controlled-Field-Memory-Governance-Planning.md';
const P5_00_SCRIPT = 'scripts/governance_acceptance/P5_00_POLICY_CONTROLLED_FIELD_MEMORY_GOVERNANCE_PLANNING.cjs';
const CURRENT_DOC = 'docs/tasks/P5-01-Field-Memory-Eligibility-Source-Boundary.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P5_01_FIELD_MEMORY_ELIGIBILITY_SOURCE_BOUNDARY.cjs';

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
  assert('p5_00_doc_exists', exists(P5_00_DOC), { P5_00_DOC });
  assert('p5_00_script_exists', exists(P5_00_SCRIPT), { P5_00_SCRIPT });
  assert('p5_00_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P5_00_COMMIT, 'HEAD']), { P5_00_COMMIT });
  assert('p4_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P4_TAG}`]), { P4_TAG });
  const p500Doc = read(P5_00_DOC);
  assert('p5_00_doc_handoff_verified', p500Doc.includes('P5_01_FIELD_MEMORY_ELIGIBILITY_SOURCE_BOUNDARY') && p500Doc.includes('non_goal_count = 18'), { P5_00_DOC });
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_blocks_memory_write_and_learning', doc.includes('field_memory_eligibility_source_must_not_create_memory_write = true') && doc.includes('automatic_learning_ref') && doc.includes('p5_01_creates_automatic_learning = false'), { CURRENT_DOC });

  const allowedKinds = section(doc, 'Allowed eligibility source ref kinds');
  const conditions = section(doc, 'Allowed source conditions');
  const systemRefs = section(doc, 'Allowed system-derived candidate refs');
  const contextOnly = section(doc, 'Context-only refs');
  const deferred = section(doc, 'Deferred refs');
  const forbiddenKinds = section(doc, 'Forbidden eligibility source ref kinds');
  const forbiddenSemantics = section(doc, 'Forbidden eligibility semantics');
  const matrix = section(doc, 'Eligibility source decision matrix');
  const record = section(doc, 'Eligibility source record contract');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P5-01');
  const forbiddenDirs = section(doc, 'Directories forbidden in P5-01');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('allowed_eligibility_source_ref_kind_count', allowedKinds.length === 9, { allowedKinds });
  assert('allowed_source_condition_count', conditions.length === 18, { conditions });
  assert('allowed_system_derived_candidate_ref_count', systemRefs.length === 11, { systemRefs });
  assert('context_only_ref_count', contextOnly.length === 6, { contextOnly });
  assert('deferred_ref_count', deferred.length === 5, { deferred });
  assert('forbidden_eligibility_source_ref_kind_count', forbiddenKinds.length === 21, { forbiddenKinds });
  assert('forbidden_eligibility_semantic_count', forbiddenSemantics.length === 17, { forbiddenSemantics });
  assert('decision_matrix_row_count', matrix.length === 24, { matrix });
  assert('eligibility_source_record_field_count', record.length === 12, { record });
  assert('secondary_review_rules_verified', secondary.length === 5 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs });
  assert('boundary_blocks_runtime_db_frontend_execution', boundary.includes('p5_01_changes_frontend = false') && boundary.includes('p5_01_changes_runtime = false') && boundary.includes('p5_01_changes_db = false') && boundary.includes('p5_01_changes_execution = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { allowed_eligibility_source_ref_kind_count: allowedKinds.length, allowed_source_condition_count: conditions.length, allowed_system_derived_candidate_ref_count: systemRefs.length, context_only_ref_count: contextOnly.length, deferred_ref_count: deferred.length, forbidden_eligibility_source_ref_kind_count: forbiddenKinds.length, forbidden_eligibility_semantic_count: forbiddenSemantics.length, decision_matrix_row_count: matrix.length, eligibility_source_record_field_count: record.length, secondary_review_required: true };
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
  verifyEntry();
  const counts = verifyCurrentDoc();
  const changedFiles = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p5_00_verified: true, p4_completion_tag_verified: true, ...counts, changed_file_count: changedFiles.length, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
