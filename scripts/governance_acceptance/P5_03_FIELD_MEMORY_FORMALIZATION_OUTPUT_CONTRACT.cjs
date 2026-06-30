// scripts/governance_acceptance/P5_03_FIELD_MEMORY_FORMALIZATION_OUTPUT_CONTRACT.cjs
// Purpose: verify the P5-03 Field Memory formalization output contract.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P5_03_FIELD_MEMORY_FORMALIZATION_OUTPUT_CONTRACT';
const NEXT_STEP = 'P5_04_FIELD_MEMORY_NEGATIVE_BOUNDARY_MATRIX';
const P4_TAG = 'p4_policy_controlled_roi_completion_before_p5';
const P5_02_COMMIT = 'bf28e642e7aab7f2ca29714363d3919a65a3f26e';
const P5_02_DOC = 'docs/legacy/tasks/P5-02-Field-Memory-Policy-Gate-Contract.md';
const P5_02_SCRIPT = 'scripts/governance_acceptance/P5_02_FIELD_MEMORY_POLICY_GATE_CONTRACT.cjs';
const CURRENT_DOC = 'docs/legacy/tasks/P5-03-Field-Memory-Formalization-Output-Contract.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P5_03_FIELD_MEMORY_FORMALIZATION_OUTPUT_CONTRACT.cjs';

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
  assert('p5_02_doc_exists', exists(P5_02_DOC), { P5_02_DOC });
  assert('p5_02_script_exists', exists(P5_02_SCRIPT), { P5_02_SCRIPT });
  assert('p5_02_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P5_02_COMMIT, 'HEAD']), { P5_02_COMMIT });
  assert('p4_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P4_TAG}`]), { P4_TAG });
  const p502Doc = read(P5_02_DOC);
  assert('p5_02_doc_handoff_verified', p502Doc.includes('P5_03_FIELD_MEMORY_FORMALIZATION_OUTPUT_CONTRACT') && p502Doc.includes('required_policy_gate_count = 19'), { P5_02_DOC });
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_preserves_blocked_policy_results', doc.includes('NOT_EVALUATED') && doc.includes('UNKNOWN') && doc.includes('BLOCKED_NOT_MEMORY'), { CURRENT_DOC });
  assert('current_doc_blocks_memory_model_learning_execution', doc.includes('cannot_write_field_memory = true') && doc.includes('cannot_update_model = true') && doc.includes('cannot_train_model = true') && doc.includes('cannot_create_execution_trigger = true'), { CURRENT_DOC });

  const passthrough = section(doc, 'Policy result passthrough');
  const outputFields = section(doc, 'Formalization output fields');
  const states = section(doc, 'Formalization state vocabulary');
  const mapping = section(doc, 'Policy result mapping');
  const reviewFields = section(doc, 'Allowed review payload fields');
  const blockedRules = section(doc, 'Blocked output rules');
  const sideEffects = section(doc, 'Side-effect denial rules');
  const blocked = section(doc, 'Blocked formalization semantics');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P5-03');
  const forbiddenDirs = section(doc, 'Directories forbidden in P5-03');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('policy_result_passthrough_count', passthrough.length === 4, { passthrough });
  assert('formalization_output_field_count', outputFields.length === 20, { outputFields });
  assert('formalization_state_count', states.length === 5, { states });
  assert('policy_result_mapping_count', mapping.length === 4, { mapping });
  assert('allowed_review_payload_field_count', reviewFields.length === 10, { reviewFields });
  assert('blocked_output_rule_count', blockedRules.length === 10, { blockedRules });
  assert('side_effect_denial_rule_count', sideEffects.length === 9, { sideEffects });
  assert('blocked_semantic_count', blocked.length === 17, { blocked });
  assert('secondary_review_rules_verified', secondary.length === 5 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs });
  assert('boundary_blocks_runtime_db_frontend_execution', boundary.includes('p5_03_changes_frontend = false') && boundary.includes('p5_03_changes_runtime = false') && boundary.includes('p5_03_changes_db = false') && boundary.includes('p5_03_changes_execution = false'), { boundary });
  assert('boundary_blocks_memory_record_model_learning', boundary.includes('p5_03_creates_field_memory_record = false') && boundary.includes('p5_03_creates_model_update = false') && boundary.includes('p5_03_creates_automatic_learning = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { policy_result_passthrough_count: passthrough.length, formalization_output_field_count: outputFields.length, formalization_state_count: states.length, policy_result_mapping_count: mapping.length, allowed_review_payload_field_count: reviewFields.length, blocked_output_rule_count: blockedRules.length, side_effect_denial_rule_count: sideEffects.length, blocked_semantic_count: blocked.length, secondary_review_required: true };
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
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p5_02_verified: true, p4_completion_tag_verified: true, ...counts, changed_file_count: changedFiles.length, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
