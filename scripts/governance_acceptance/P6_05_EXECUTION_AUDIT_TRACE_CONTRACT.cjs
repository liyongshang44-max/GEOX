// scripts/governance_acceptance/P6_05_EXECUTION_AUDIT_TRACE_CONTRACT.cjs
// Purpose: verify the P6-05 Execution Audit Trace Contract.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P6_05_EXECUTION_AUDIT_TRACE_CONTRACT';
const NEXT_STEP = 'P6_06_EXECUTION_NEGATIVE_BOUNDARY_MATRIX';
const P5_TAG = 'p5_policy_controlled_field_memory_governance_completion_before_p6';
const P6_04_COMMIT = '952480f5e532261abfedafe2ebe1b97cdd0129c0';
const P6_04_DOC = 'docs/legacy/tasks/P6-04-Execution-Receipt-Intake-Contract.md';
const P6_04_SCRIPT = 'scripts/governance_acceptance/P6_04_EXECUTION_RECEIPT_INTAKE_CONTRACT.cjs';
const CURRENT_DOC = 'docs/legacy/tasks/P6-05-Execution-Audit-Trace-Contract.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P6_05_EXECUTION_AUDIT_TRACE_CONTRACT.cjs';

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
  assert('p6_04_doc_exists', exists(P6_04_DOC), { P6_04_DOC });
  assert('p6_04_script_exists', exists(P6_04_SCRIPT), { P6_04_SCRIPT });
  assert('p6_04_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P6_04_COMMIT, 'HEAD']), { P6_04_COMMIT });
  assert('p5_completion_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P5_TAG}`]), { P5_TAG });
  const p604Doc = read(P6_04_DOC);
  assert('p6_04_doc_handoff_verified', p604Doc.includes('P6_05_EXECUTION_AUDIT_TRACE_CONTRACT') && p604Doc.includes('p6_05_handoff_rule_count = 12'), { P6_04_DOC });
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_blocks_audit_write', doc.includes('audit_trace_must_not_create_audit_write = true') && doc.includes('audit_trace_must_not_create_receipt_write = true') && doc.includes('audit_trace_must_not_create_dispatch_write = true'), { CURRENT_DOC });
  assert('current_doc_preserves_read_only_chain', doc.includes('audit_trace_must_be_read_only = true') && doc.includes('audit_chain_must_remain_read_only = true'), { CURRENT_DOC });

  const sourceKinds = section(doc, 'Allowed audit trace source ref kinds');
  const conditions = section(doc, 'Allowed audit trace source conditions');
  const gates = section(doc, 'Required audit trace validation gates');
  const failCodes = section(doc, 'Audit trace fail codes');
  const vocab = section(doc, 'Audit trace result vocabulary');
  const states = section(doc, 'Audit trace state vocabulary');
  const fields = section(doc, 'Audit trace contract fields');
  const chainRules = section(doc, 'Audit chain integrity rules');
  const prohibited = section(doc, 'Prohibited audit trace semantics');
  const handoff = section(doc, 'P6-06 handoff');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P6-05');
  const forbiddenDirs = section(doc, 'Directories forbidden in P6-05');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('allowed_audit_trace_source_ref_kind_count', sourceKinds.length === 10, { sourceKinds });
  assert('allowed_audit_trace_source_condition_count', conditions.length === 20, { conditions });
  assert('audit_trace_validation_gate_count', gates.length === 24, { gates });
  assert('audit_trace_fail_code_count', failCodes.length === 24, { failCodes });
  assert('audit_trace_result_vocabulary_count', vocab.length === 4, { vocab });
  assert('audit_trace_state_count', states.length === 8, { states });
  assert('audit_trace_contract_field_count', fields.length === 22, { fields });
  assert('audit_chain_integrity_rule_count', chainRules.length === 12, { chainRules });
  assert('prohibited_audit_trace_semantic_count', prohibited.length === 20, { prohibited });
  assert('p6_06_handoff_rule_count', handoff.length === 12, { handoff });
  assert('secondary_review_rules_verified', secondary.length === 5 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs });
  assert('boundary_blocks_runtime_db_frontend_execution', boundary.includes('p6_05_changes_frontend = false') && boundary.includes('p6_05_changes_runtime = false') && boundary.includes('p6_05_changes_db = false') && boundary.includes('p6_05_changes_execution = false'), { boundary });
  assert('boundary_blocks_audit_receipt_dispatch', boundary.includes('p6_05_creates_audit_record = false') && boundary.includes('p6_05_creates_execution_audit_write = false') && boundary.includes('p6_05_creates_receipt_write = false') && boundary.includes('p6_05_creates_dispatch_payload = false') && boundary.includes('p6_05_creates_ao_act_task = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { allowed_audit_trace_source_ref_kind_count: sourceKinds.length, allowed_audit_trace_source_condition_count: conditions.length, audit_trace_validation_gate_count: gates.length, audit_trace_fail_code_count: failCodes.length, audit_trace_result_vocabulary_count: vocab.length, audit_trace_state_count: states.length, audit_trace_contract_field_count: fields.length, audit_chain_integrity_rule_count: chainRules.length, prohibited_audit_trace_semantic_count: prohibited.length, p6_06_handoff_rule_count: handoff.length, secondary_review_required: true };
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
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p6_04_verified: true, p5_completion_tag_verified: true, ...counts, changed_file_count: changedFiles.length, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
