// scripts/governance_acceptance/P6_06_EXECUTION_NEGATIVE_BOUNDARY_MATRIX.cjs
// Purpose: verify the P6-06 Execution Negative Boundary Matrix.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P6_06_EXECUTION_NEGATIVE_BOUNDARY_MATRIX';
const NEXT_STEP = 'P6_07_EXECUTION_COMPLETION_REVIEW';
const P5_TAG = 'p5_policy_controlled_field_memory_governance_completion_before_p6';
const P6_05_COMMIT = '213855b7811de56ca0949aa699ac5ea1fe9b2b4c';
const P6_05_DOC = 'docs/tasks/P6-05-Execution-Audit-Trace-Contract.md';
const P6_05_SCRIPT = 'scripts/governance_acceptance/P6_05_EXECUTION_AUDIT_TRACE_CONTRACT.cjs';
const CURRENT_DOC = 'docs/tasks/P6-06-Execution-Negative-Boundary-Matrix.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P6_06_EXECUTION_NEGATIVE_BOUNDARY_MATRIX.cjs';

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
  assert('p6_05_doc_exists', exists(P6_05_DOC), { P6_05_DOC });
  assert('p6_05_script_exists', exists(P6_05_SCRIPT), { P6_05_SCRIPT });
  assert('p6_05_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P6_05_COMMIT, 'HEAD']), { P6_05_COMMIT });
  assert('p5_completion_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P5_TAG}`]), { P5_TAG });
  const p605Doc = read(P6_05_DOC);
  assert('p6_05_doc_handoff_verified', p605Doc.includes('P6_06_EXECUTION_NEGATIVE_BOUNDARY_MATRIX') && p605Doc.includes('p6_06_handoff_rule_count = 12'), { P6_05_DOC });
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_is_fail_closed', doc.includes('NOT_EVALUATED = treated_as_BLOCK') && doc.includes('UNKNOWN = treated_as_BLOCK'), { CURRENT_DOC });
  assert('current_doc_blocks_write_side_effects', doc.includes('AUDIT_WRITE_ATTEMPT_PRESENT') && doc.includes('RECEIPT_WRITE_ATTEMPT_PRESENT') && doc.includes('DISPATCH_WRITE_ATTEMPT_PRESENT'), { CURRENT_DOC });

  const categories = section(doc, 'Negative boundary categories');
  const auditCases = section(doc, 'Audit chain negative cases');
  const writeCases = section(doc, 'Write side-effect negative cases');
  const executionCases = section(doc, 'Execution action negative cases');
  const modelCases = section(doc, 'Model learning negative cases');
  const evidenceCases = section(doc, 'Evidence trace negative cases');
  const authorityCases = section(doc, 'Authority bypass negative cases');
  const p7Cases = section(doc, 'P7 expansion negative cases');
  const failCodes = section(doc, 'Negative fail codes');
  const blockFields = section(doc, 'Block result fields');
  const vocab = section(doc, 'Fail-closed result vocabulary');
  const handoff = section(doc, 'P6-07 handoff');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P6-06');
  const forbiddenDirs = section(doc, 'Directories forbidden in P6-06');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('negative_boundary_category_count', categories.length === 10, { categories });
  assert('audit_chain_negative_case_count', auditCases.length === 8, { auditCases });
  assert('write_side_effect_negative_case_count', writeCases.length === 12, { writeCases });
  assert('execution_action_negative_case_count', executionCases.length === 10, { executionCases });
  assert('model_learning_negative_case_count', modelCases.length === 7, { modelCases });
  assert('evidence_trace_negative_case_count', evidenceCases.length === 8, { evidenceCases });
  assert('authority_bypass_negative_case_count', authorityCases.length === 8, { authorityCases });
  assert('p7_expansion_negative_case_count', p7Cases.length === 5, { p7Cases });
  assert('negative_fail_code_count', failCodes.length === 20, { failCodes });
  assert('block_result_field_count', blockFields.length === 12, { blockFields });
  assert('fail_closed_result_vocabulary_count', vocab.length === 4, { vocab });
  assert('p6_07_handoff_rule_count', handoff.length === 10, { handoff });
  assert('secondary_review_rules_verified', secondary.length === 5 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs });
  assert('boundary_blocks_runtime_db_frontend_execution', boundary.includes('p6_06_changes_frontend = false') && boundary.includes('p6_06_changes_runtime = false') && boundary.includes('p6_06_changes_db = false') && boundary.includes('p6_06_changes_execution = false'), { boundary });
  assert('boundary_blocks_write_and_model_side_effects', boundary.includes('p6_06_creates_execution_audit_write = false') && boundary.includes('p6_06_creates_receipt_write = false') && boundary.includes('p6_06_creates_ao_act_task = false') && boundary.includes('p6_06_creates_model_update = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { negative_boundary_category_count: categories.length, audit_chain_negative_case_count: auditCases.length, write_side_effect_negative_case_count: writeCases.length, execution_action_negative_case_count: executionCases.length, model_learning_negative_case_count: modelCases.length, evidence_trace_negative_case_count: evidenceCases.length, authority_bypass_negative_case_count: authorityCases.length, p7_expansion_negative_case_count: p7Cases.length, negative_fail_code_count: failCodes.length, block_result_field_count: blockFields.length, fail_closed_result_vocabulary_count: vocab.length, p6_07_handoff_rule_count: handoff.length, secondary_review_required: true };
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
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p6_05_verified: true, p5_completion_tag_verified: true, ...counts, changed_file_count: changedFiles.length, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
