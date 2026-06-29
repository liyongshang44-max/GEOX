// scripts/governance_acceptance/P5_02_FIELD_MEMORY_POLICY_GATE_CONTRACT.cjs
// Purpose: verify the P5-02 Field Memory policy gate contract.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P5_02_FIELD_MEMORY_POLICY_GATE_CONTRACT';
const NEXT_STEP = 'P5_03_FIELD_MEMORY_FORMALIZATION_OUTPUT_CONTRACT';
const P4_TAG = 'p4_policy_controlled_roi_completion_before_p5';
const P5_01_COMMIT = 'f04f8bde02545c3442410ef78353c4e573d95307';
const P5_01_DOC = 'docs/tasks/P5-01-Field-Memory-Eligibility-Source-Boundary.md';
const P5_01_SCRIPT = 'scripts/governance_acceptance/P5_01_FIELD_MEMORY_ELIGIBILITY_SOURCE_BOUNDARY.cjs';
const CURRENT_DOC = 'docs/tasks/P5-02-Field-Memory-Policy-Gate-Contract.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P5_02_FIELD_MEMORY_POLICY_GATE_CONTRACT.cjs';

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
  assert('p5_01_doc_exists', exists(P5_01_DOC), { P5_01_DOC });
  assert('p5_01_script_exists', exists(P5_01_SCRIPT), { P5_01_SCRIPT });
  assert('p5_01_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P5_01_COMMIT, 'HEAD']), { P5_01_COMMIT });
  assert('p4_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P4_TAG}`]), { P4_TAG });
  const p501Doc = read(P5_01_DOC);
  assert('p5_01_doc_handoff_verified', p501Doc.includes('P5_02_FIELD_MEMORY_POLICY_GATE_CONTRACT') && p501Doc.includes('forbidden_eligibility_source_ref_kind_count = 21'), { P5_01_DOC });
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_is_fail_closed', doc.includes('field_memory_policy_gate_must_fail_closed = true') && doc.includes('NOT_EVALUATED = treated_as_BLOCK') && doc.includes('UNKNOWN = treated_as_BLOCK'), { CURRENT_DOC });
  assert('current_doc_blocks_memory_write_learning_execution', doc.includes('FIELD_MEMORY_WRITE_PRESENT') && doc.includes('MODEL_UPDATE_PRESENT') && doc.includes('AUTOMATIC_LEARNING_PRESENT') && doc.includes('EXECUTION_TRIGGER_PRESENT'), { CURRENT_DOC });

  const gates = section(doc, 'Required Field Memory policy gates');
  const failCodes = section(doc, 'Gate fail codes');
  const vocab = section(doc, 'Policy result vocabulary');
  const aggregation = section(doc, 'Fail-closed aggregation rules');
  const input = section(doc, 'Policy input contract fields');
  const sourceRecord = section(doc, 'Eligibility source record fields');
  const output = section(doc, 'Policy output contract fields');
  const blocked = section(doc, 'Blocked Field Memory policy semantics');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P5-02');
  const forbiddenDirs = section(doc, 'Directories forbidden in P5-02');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('required_policy_gate_count', gates.length === 19, { gates });
  assert('fail_code_count', failCodes.length === 19, { failCodes });
  assert('policy_result_vocabulary_count', vocab.length === 4, { vocab });
  assert('aggregation_rule_count', aggregation.length === 5, { aggregation });
  assert('policy_input_contract_field_count', input.length === 8, { input });
  assert('eligibility_source_record_contract_field_count', sourceRecord.length === 12, { sourceRecord });
  assert('policy_output_contract_field_count', output.length === 9, { output });
  assert('blocked_semantic_count', blocked.length === 17, { blocked });
  assert('secondary_review_rules_verified', secondary.length === 5 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs });
  assert('boundary_blocks_runtime_db_frontend_execution', boundary.includes('p5_02_changes_frontend = false') && boundary.includes('p5_02_changes_runtime = false') && boundary.includes('p5_02_changes_db = false') && boundary.includes('p5_02_changes_execution = false'), { boundary });
  assert('boundary_blocks_memory_write_model_update_learning', boundary.includes('p5_02_creates_field_memory_write_path = false') && boundary.includes('p5_02_creates_model_update = false') && boundary.includes('p5_02_creates_automatic_learning = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { required_policy_gate_count: gates.length, fail_code_count: failCodes.length, policy_result_vocabulary_count: vocab.length, aggregation_rule_count: aggregation.length, policy_input_contract_field_count: input.length, eligibility_source_record_contract_field_count: sourceRecord.length, policy_output_contract_field_count: output.length, blocked_semantic_count: blocked.length, secondary_review_required: true };
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
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p5_01_verified: true, p4_completion_tag_verified: true, ...counts, changed_file_count: changedFiles.length, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
