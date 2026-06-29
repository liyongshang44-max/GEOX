// scripts/governance_acceptance/P6_01_EXECUTION_SOURCE_BOUNDARY.cjs
// Purpose: verify the P6-01 Execution Source Boundary.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P6_01_EXECUTION_SOURCE_BOUNDARY';
const NEXT_STEP = 'P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT';
const P5_TAG = 'p5_policy_controlled_field_memory_governance_completion_before_p6';
const P6_00_COMMIT = '11c61eee14b7e84c9eea79ae2339ec5ff6bf17b8';
const P6_00_DOC = 'docs/tasks/P6-00-Execution-System-Integration-Planning.md';
const P6_00_SCRIPT = 'scripts/governance_acceptance/P6_00_EXECUTION_SYSTEM_INTEGRATION_PLANNING.cjs';
const CURRENT_DOC = 'docs/tasks/P6-01-Execution-Source-Boundary.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P6_01_EXECUTION_SOURCE_BOUNDARY.cjs';

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
  assert('p6_00_doc_exists', exists(P6_00_DOC), { P6_00_DOC });
  assert('p6_00_script_exists', exists(P6_00_SCRIPT), { P6_00_SCRIPT });
  assert('p6_00_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P6_00_COMMIT, 'HEAD']), { P6_00_COMMIT });
  assert('p5_completion_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P5_TAG}`]), { P5_TAG });
  const p600Doc = read(P6_00_DOC);
  assert('p6_00_doc_handoff_verified', p600Doc.includes('P6_01_EXECUTION_SOURCE_BOUNDARY') && p600Doc.includes('p6_task_sequence_count = 8'), { P6_00_DOC });
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_blocks_side_effects', doc.includes('execution_source_must_not_create_dispatch = true') && doc.includes('execution_source_must_not_create_ao_act_task = true') && doc.includes('execution_source_must_not_create_receipt = true') && doc.includes('execution_source_must_not_create_execution_audit_write = true'), { CURRENT_DOC });
  assert('current_doc_blocks_context_authority', doc.includes('field_memory_ref = context_only_not_execution_authorization') && doc.includes('formalization_output_ref = context_only_not_execution_authorization') && doc.includes('frontend_state_ref = context_only_not_authority'), { CURRENT_DOC });

  const allowedKinds = section(doc, 'Allowed execution source ref kinds');
  const conditions = section(doc, 'Allowed source conditions');
  const contextOnly = section(doc, 'Context-only refs');
  const deferred = section(doc, 'Deferred refs');
  const forbiddenKinds = section(doc, 'Forbidden execution source ref kinds');
  const forbiddenSemantics = section(doc, 'Forbidden execution source semantics');
  const record = section(doc, 'Execution source record contract');
  const handoff = section(doc, 'P6-02 handoff');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P6-01');
  const forbiddenDirs = section(doc, 'Directories forbidden in P6-01');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('allowed_execution_source_ref_kind_count', allowedKinds.length === 10, { allowedKinds });
  assert('allowed_source_condition_count', conditions.length === 20, { conditions });
  assert('context_only_ref_count', contextOnly.length === 7, { contextOnly });
  assert('deferred_ref_count', deferred.length === 4, { deferred });
  assert('forbidden_execution_source_ref_kind_count', forbiddenKinds.length === 21, { forbiddenKinds });
  assert('forbidden_execution_semantic_count', forbiddenSemantics.length === 19, { forbiddenSemantics });
  assert('execution_source_record_field_count', record.length === 13, { record });
  assert('p6_02_handoff_rule_count', handoff.length === 9, { handoff });
  assert('secondary_review_rules_verified', secondary.length === 5 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs });
  assert('boundary_blocks_runtime_db_frontend_execution', boundary.includes('p6_01_changes_frontend = false') && boundary.includes('p6_01_changes_runtime = false') && boundary.includes('p6_01_changes_db = false') && boundary.includes('p6_01_changes_execution = false'), { boundary });
  assert('boundary_blocks_dispatch_receipt_audit', boundary.includes('p6_01_creates_dispatch_adapter = false') && boundary.includes('p6_01_creates_ao_act_task = false') && boundary.includes('p6_01_creates_receipt = false') && boundary.includes('p6_01_creates_execution_audit_write = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { allowed_execution_source_ref_kind_count: allowedKinds.length, allowed_source_condition_count: conditions.length, context_only_ref_count: contextOnly.length, deferred_ref_count: deferred.length, forbidden_execution_source_ref_kind_count: forbiddenKinds.length, forbidden_execution_semantic_count: forbiddenSemantics.length, execution_source_record_field_count: record.length, p6_02_handoff_rule_count: handoff.length, secondary_review_required: true };
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
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p6_00_verified: true, p5_completion_tag_verified: true, ...counts, changed_file_count: changedFiles.length, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
