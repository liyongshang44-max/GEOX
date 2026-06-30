// scripts/governance_acceptance/P6_03_EXECUTION_DISPATCH_OUTPUT_CONTRACT.cjs
// Purpose: verify the P6-03 Execution Dispatch Output Contract.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P6_03_EXECUTION_DISPATCH_OUTPUT_CONTRACT';
const NEXT_STEP = 'P6_04_EXECUTION_RECEIPT_INTAKE_CONTRACT';
const P5_TAG = 'p5_policy_controlled_field_memory_governance_completion_before_p6';
const P6_02_COMMIT = '17b71da756bec86f8e39beb3c9363c7c49271bc3';
const P6_02_DOC = 'docs/legacy/tasks/P6-02-Execution-Authorization-Gate-Contract.md';
const P6_02_SCRIPT = 'scripts/governance_acceptance/P6_02_EXECUTION_AUTHORIZATION_GATE_CONTRACT.cjs';
const CURRENT_DOC = 'docs/legacy/tasks/P6-03-Execution-Dispatch-Output-Contract.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P6_03_EXECUTION_DISPATCH_OUTPUT_CONTRACT.cjs';

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
  assert('p6_02_doc_exists', exists(P6_02_DOC), { P6_02_DOC });
  assert('p6_02_script_exists', exists(P6_02_SCRIPT), { P6_02_SCRIPT });
  assert('p6_02_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P6_02_COMMIT, 'HEAD']), { P6_02_COMMIT });
  assert('p5_completion_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P5_TAG}`]), { P5_TAG });
  const p602Doc = read(P6_02_DOC);
  assert('p6_02_doc_handoff_verified', p602Doc.includes('P6_03_EXECUTION_DISPATCH_OUTPUT_CONTRACT') && p602Doc.includes('p6_03_handoff_rule_count = 11'), { P6_02_DOC });
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_preserves_pass_not_dispatched', doc.includes('PASS') && doc.includes('READY_NOT_DISPATCHED') && doc.includes('`PASS` does not dispatch'), { CURRENT_DOC });
  assert('current_doc_blocks_side_effects', doc.includes('dispatch_output_must_not_create_dispatch_adapter = true') && doc.includes('dispatch_output_must_not_create_ao_act_task = true') && doc.includes('dispatch_output_must_not_create_receipt = true') && doc.includes('dispatch_output_must_not_create_execution_audit_write = true'), { CURRENT_DOC });

  const passthrough = section(doc, 'Authorization result passthrough');
  const outputStates = section(doc, 'Dispatch output state vocabulary');
  const intentStates = section(doc, 'Dispatch intent state vocabulary');
  const mapping = section(doc, 'Authorization result mapping');
  const fields = section(doc, 'Dispatch output fields');
  const readyRules = section(doc, 'Ready output rules');
  const blockedRules = section(doc, 'Blocked output rules');
  const prohibitedPayloads = section(doc, 'Prohibited dispatch output payloads');
  const handoff = section(doc, 'P6-04 handoff');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P6-03');
  const forbiddenDirs = section(doc, 'Directories forbidden in P6-03');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('authorization_result_passthrough_count', passthrough.length === 4, { passthrough });
  assert('dispatch_output_state_count', outputStates.length === 8, { outputStates });
  assert('dispatch_intent_state_count', intentStates.length === 4, { intentStates });
  assert('authorization_result_mapping_count', mapping.length === 4, { mapping });
  assert('dispatch_output_field_count', fields.length === 20, { fields });
  assert('ready_output_rule_count', readyRules.length === 12, { readyRules });
  assert('blocked_output_rule_count', blockedRules.length === 12, { blockedRules });
  assert('prohibited_dispatch_output_payload_count', prohibitedPayloads.length === 20, { prohibitedPayloads });
  assert('p6_04_handoff_rule_count', handoff.length === 11, { handoff });
  assert('secondary_review_rules_verified', secondary.length === 5 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs });
  assert('boundary_blocks_runtime_db_frontend_execution', boundary.includes('p6_03_changes_frontend = false') && boundary.includes('p6_03_changes_runtime = false') && boundary.includes('p6_03_changes_db = false') && boundary.includes('p6_03_changes_execution = false'), { boundary });
  assert('boundary_blocks_dispatch_receipt_audit', boundary.includes('p6_03_creates_dispatch_payload = false') && boundary.includes('p6_03_creates_adapter_request = false') && boundary.includes('p6_03_creates_ao_act_task = false') && boundary.includes('p6_03_creates_receipt = false') && boundary.includes('p6_03_creates_execution_audit_write = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { authorization_result_passthrough_count: passthrough.length, dispatch_output_state_count: outputStates.length, dispatch_intent_state_count: intentStates.length, authorization_result_mapping_count: mapping.length, dispatch_output_field_count: fields.length, ready_output_rule_count: readyRules.length, blocked_output_rule_count: blockedRules.length, prohibited_dispatch_output_payload_count: prohibitedPayloads.length, p6_04_handoff_rule_count: handoff.length, secondary_review_required: true };
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
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p6_02_verified: true, p5_completion_tag_verified: true, ...counts, changed_file_count: changedFiles.length, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
