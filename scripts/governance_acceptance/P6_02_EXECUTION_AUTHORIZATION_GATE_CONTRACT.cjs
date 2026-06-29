// scripts/governance_acceptance/P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT.cjs
// Purpose: verify the P6-02 Execution Authorization Gate Contract.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT';
const NEXT_STEP = 'P6_03_EXECUTION_DISPATCH_OUTPUT_CONTRACT';
const P5_TAG = 'p5_policy_controlled_field_memory_governance_completion_before_p6';
const P6_01_COMMIT = '415110413fb7836bc9a36ec189f9760d091aae64';
const P6_01_DOC = 'docs/tasks/P6-01-Execution-Source-Boundary.md';
const P6_01_SCRIPT = 'scripts/governance_acceptance/P6_01_EXECUTION_SOURCE_BOUNDARY.cjs';
const CURRENT_DOC = 'docs/tasks/P6-02-Execution-Authorization-Gate-Contract.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT.cjs';

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
  assert('p6_01_doc_exists', exists(P6_01_DOC), { P6_01_DOC });
  assert('p6_01_script_exists', exists(P6_01_SCRIPT), { P6_01_SCRIPT });
  assert('p6_01_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P6_01_COMMIT, 'HEAD']), { P6_01_COMMIT });
  assert('p5_completion_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P5_TAG}`]), { P5_TAG });
  const p601Doc = read(P6_01_DOC);
  assert('p6_01_doc_handoff_verified', p601Doc.includes('P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT') && p601Doc.includes('p6_02_handoff_rule_count = 10'), { P6_01_DOC });
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_is_fail_closed', doc.includes('execution_authorization_gate_must_fail_closed = true') && doc.includes('NOT_EVALUATED = treated_as_BLOCK') && doc.includes('UNKNOWN = treated_as_BLOCK'), { CURRENT_DOC });
  assert('current_doc_blocks_side_effects', doc.includes('execution_authorization_gate_must_not_create_dispatch = true') && doc.includes('execution_authorization_gate_must_not_create_ao_act_task = true') && doc.includes('execution_authorization_gate_must_not_create_receipt = true') && doc.includes('execution_authorization_gate_must_not_create_execution_audit_write = true'), { CURRENT_DOC });

  const gates = section(doc, 'Required execution authorization gates');
  const failCodes = section(doc, 'Authorization fail codes');
  const vocab = section(doc, 'Authorization result vocabulary');
  const aggregation = section(doc, 'Fail-closed aggregation rules');
  const input = section(doc, 'Authorization input contract fields');
  const output = section(doc, 'Authorization output contract fields');
  const states = section(doc, 'Authorization state vocabulary');
  const blocked = section(doc, 'Blocked authorization semantics');
  const handoff = section(doc, 'P6-03 handoff');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P6-02');
  const forbiddenDirs = section(doc, 'Directories forbidden in P6-02');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('required_authorization_gate_count', gates.length === 26, { gates });
  assert('authorization_fail_code_count', failCodes.length === 26, { failCodes });
  assert('authorization_result_vocabulary_count', vocab.length === 4, { vocab });
  assert('aggregation_rule_count', aggregation.length === 5, { aggregation });
  assert('authorization_input_contract_field_count', input.length === 12, { input });
  assert('authorization_output_contract_field_count', output.length === 12, { output });
  assert('authorization_state_count', states.length === 7, { states });
  assert('blocked_authorization_semantic_count', blocked.length === 22, { blocked });
  assert('p6_03_handoff_rule_count', handoff.length === 11, { handoff });
  assert('secondary_review_rules_verified', secondary.length === 5 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs });
  assert('boundary_blocks_runtime_db_frontend_execution', boundary.includes('p6_02_changes_frontend = false') && boundary.includes('p6_02_changes_runtime = false') && boundary.includes('p6_02_changes_db = false') && boundary.includes('p6_02_changes_execution = false'), { boundary });
  assert('boundary_blocks_dispatch_receipt_audit', boundary.includes('p6_02_creates_dispatch_payload = false') && boundary.includes('p6_02_creates_ao_act_task = false') && boundary.includes('p6_02_creates_receipt = false') && boundary.includes('p6_02_creates_execution_audit_write = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { required_authorization_gate_count: gates.length, authorization_fail_code_count: failCodes.length, authorization_result_vocabulary_count: vocab.length, aggregation_rule_count: aggregation.length, authorization_input_contract_field_count: input.length, authorization_output_contract_field_count: output.length, authorization_state_count: states.length, blocked_authorization_semantic_count: blocked.length, p6_03_handoff_rule_count: handoff.length, secondary_review_required: true };
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
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p6_01_verified: true, p5_completion_tag_verified: true, ...counts, changed_file_count: changedFiles.length, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
