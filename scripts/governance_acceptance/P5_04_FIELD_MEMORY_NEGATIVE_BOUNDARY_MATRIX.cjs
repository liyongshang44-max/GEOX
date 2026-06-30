// scripts/governance_acceptance/P5_04_FIELD_MEMORY_NEGATIVE_BOUNDARY_MATRIX.cjs
// Purpose: verify the P5-04 Field Memory negative boundary matrix.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P5_04_FIELD_MEMORY_NEGATIVE_BOUNDARY_MATRIX';
const NEXT_STEP = 'P5_05_FIELD_MEMORY_COMPLETION_REVIEW_BEFORE_P6';
const P4_TAG = 'p4_policy_controlled_roi_completion_before_p5';
const P5_03_COMMIT = 'a4af4e348c47f72610bcb0b13f4b30bb87ce5b47';
const P5_03_DOC = 'docs/legacy/tasks/P5-03-Field-Memory-Formalization-Output-Contract.md';
const P5_03_SCRIPT = 'scripts/governance_acceptance/P5_03_FIELD_MEMORY_FORMALIZATION_OUTPUT_CONTRACT.cjs';
const CURRENT_DOC = 'docs/legacy/tasks/P5-04-Field-Memory-Negative-Boundary-Matrix.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P5_04_FIELD_MEMORY_NEGATIVE_BOUNDARY_MATRIX.cjs';

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
  assert('p5_03_doc_exists', exists(P5_03_DOC), { P5_03_DOC });
  assert('p5_03_script_exists', exists(P5_03_SCRIPT), { P5_03_SCRIPT });
  assert('p5_03_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P5_03_COMMIT, 'HEAD']), { P5_03_COMMIT });
  assert('p4_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P4_TAG}`]), { P4_TAG });
  const p503Doc = read(P5_03_DOC);
  assert('p5_03_doc_handoff_verified', p503Doc.includes('P5_04_FIELD_MEMORY_NEGATIVE_BOUNDARY_MATRIX') && p503Doc.includes('side_effect_denial_rule_count = 9'), { P5_03_DOC });
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_is_fail_closed', doc.includes('field_memory_negative_boundary_must_fail_closed = true') && doc.includes('=> BLOCK'), { CURRENT_DOC });
  assert('current_doc_blocks_write_model_learning_execution', doc.includes('field_memory_negative_boundary_must_not_create_memory_write = true') && doc.includes('field_memory_negative_boundary_must_not_create_model_update = true') && doc.includes('field_memory_negative_boundary_must_not_create_automatic_learning = true') && doc.includes('field_memory_negative_boundary_must_not_create_execution_trigger = true'), { CURRENT_DOC });

  const categories = section(doc, 'Required negative boundary categories');
  const formalizationCases = section(doc, 'Formalization state negative cases');
  const reviewCases = section(doc, 'Review payload negative cases');
  const blockedOutputCases = section(doc, 'Blocked output negative cases');
  const sideEffectCases = section(doc, 'Side-effect negative cases');
  const writeCases = section(doc, 'Field Memory write negative cases');
  const modelLearningCases = section(doc, 'Model and automatic learning negative cases');
  const executionCases = section(doc, 'Execution negative cases');
  const integrityCases = section(doc, 'Evidence trace scope negative cases');
  const blockFields = section(doc, 'Required block result fields');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P5-04');
  const forbiddenDirs = section(doc, 'Directories forbidden in P5-04');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('negative_boundary_category_count', categories.length === 8, { categories });
  assert('formalization_state_negative_case_count', formalizationCases.length === 7, { formalizationCases });
  assert('review_payload_negative_case_count', reviewCases.length === 8, { reviewCases });
  assert('blocked_output_negative_case_count', blockedOutputCases.length === 10, { blockedOutputCases });
  assert('side_effect_negative_case_count', sideEffectCases.length === 9, { sideEffectCases });
  assert('field_memory_write_negative_case_count', writeCases.length === 6, { writeCases });
  assert('model_learning_negative_case_count', modelLearningCases.length === 6, { modelLearningCases });
  assert('execution_negative_case_count', executionCases.length === 6, { executionCases });
  assert('evidence_trace_scope_negative_case_count', integrityCases.length === 7, { integrityCases });
  assert('block_result_field_count', blockFields.length === 10, { blockFields });
  assert('all_negative_cases_block', [...formalizationCases, ...reviewCases, ...blockedOutputCases, ...sideEffectCases, ...writeCases, ...modelLearningCases, ...executionCases, ...integrityCases].every((line) => line.endsWith('=> BLOCK')), {});
  assert('secondary_review_rules_verified', secondary.length === 5 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs });
  assert('boundary_blocks_runtime_db_frontend_execution', boundary.includes('p5_04_changes_frontend = false') && boundary.includes('p5_04_changes_runtime = false') && boundary.includes('p5_04_changes_db = false') && boundary.includes('p5_04_changes_execution = false'), { boundary });
  assert('boundary_blocks_memory_record_model_learning', boundary.includes('p5_04_creates_field_memory_record = false') && boundary.includes('p5_04_creates_model_update = false') && boundary.includes('p5_04_creates_automatic_learning = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { negative_boundary_category_count: categories.length, formalization_state_negative_case_count: formalizationCases.length, review_payload_negative_case_count: reviewCases.length, blocked_output_negative_case_count: blockedOutputCases.length, side_effect_negative_case_count: sideEffectCases.length, field_memory_write_negative_case_count: writeCases.length, model_learning_negative_case_count: modelLearningCases.length, execution_negative_case_count: executionCases.length, evidence_trace_scope_negative_case_count: integrityCases.length, block_result_field_count: blockFields.length, secondary_review_required: true };
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
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p5_03_verified: true, p4_completion_tag_verified: true, ...counts, changed_file_count: changedFiles.length, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
