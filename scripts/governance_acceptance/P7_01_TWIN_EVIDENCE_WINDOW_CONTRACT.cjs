// scripts/governance_acceptance/P7_01_TWIN_EVIDENCE_WINDOW_CONTRACT.cjs
// Purpose: verify the P7-01 Twin Evidence Window Contract gate.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P7_01_TWIN_EVIDENCE_WINDOW_CONTRACT';
const NEXT_STEP = 'P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0';
const P6_COMPLETION_TAG = 'p6_execution_system_integration_completion';
const P7_00_COMMIT = 'e3a50dfde49635f4f65a8841b839f691bf5fc710';
const P7_00_DOC = 'docs/tasks/P7-00-Twin-Kernel-Minimal-Runtime-Planning.md';
const P7_00_SCRIPT = 'scripts/governance_acceptance/P7_00_TWIN_KERNEL_MINIMAL_RUNTIME_PLANNING.cjs';
const CURRENT_DOC = 'docs/tasks/P7-01-Twin-Evidence-Window-Contract.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P7_01_TWIN_EVIDENCE_WINDOW_CONTRACT.cjs';

const ALLOWED_CHANGED_FILES = [CURRENT_DOC, CURRENT_SCRIPT];
const FORBIDDEN_PREFIXES = ['apps/web/', 'apps/server/', 'apps/executor/', 'packages/twin-kernel/', 'packages/contracts/', 'packages/', 'db/', 'migrations/', 'scripts/twin_kernel/', 'scripts/demo_seed/', 'scripts/runtime/'];
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
  assert('p7_00_doc_exists', exists(P7_00_DOC), { P7_00_DOC });
  assert('p7_00_script_exists', exists(P7_00_SCRIPT), { P7_00_SCRIPT });
  assert('p7_00_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P7_00_COMMIT, 'HEAD']), { P7_00_COMMIT });
  assert('p6_completion_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P6_COMPLETION_TAG}`]), { P6_COMPLETION_TAG });
  const p700Doc = read(P7_00_DOC);
  assert('p7_00_doc_handoff_verified', p700Doc.includes('P7_01_TWIN_EVIDENCE_WINDOW_CONTRACT') && p700Doc.includes('p7_01_handoff_rule_count = 11'), { P7_00_DOC });
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_blocks_state_and_prediction', doc.includes('evidence_window_must_not_create_state_estimate = true') && doc.includes('evidence_window_must_not_create_prediction_run = true'), { CURRENT_DOC });
  assert('current_doc_is_contract_only', doc.includes('These are contract fields') && doc.includes('does not create or modify runtime implementation paths'), { CURRENT_DOC });

  const principles = section(doc, 'Evidence window principles');
  const sourceKinds = section(doc, 'Allowed evidence source kinds');
  const fields = section(doc, 'Evidence window contract fields');
  const gates = section(doc, 'Required evidence window validation gates');
  const failCodes = section(doc, 'Evidence window fail codes');
  const coverageFields = section(doc, 'Coverage summary fields');
  const vocab = section(doc, 'Evidence window result vocabulary');
  const states = section(doc, 'Evidence window state vocabulary');
  const boundaryRules = section(doc, 'Boundary rules');
  const prohibited = section(doc, 'Prohibited evidence window semantics');
  const handoff = section(doc, 'P7-02 handoff');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P7-01');
  const forbiddenDirs = section(doc, 'Directories forbidden in P7-01');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('evidence_window_principle_count', principles.length === 15, { principles });
  assert('allowed_evidence_source_kind_count', sourceKinds.length === 8, { sourceKinds });
  assert('evidence_window_contract_field_count', fields.length === 24, { fields });
  assert('evidence_window_validation_gate_count', gates.length === 24, { gates });
  assert('evidence_window_fail_code_count', failCodes.length === 24, { failCodes });
  assert('coverage_summary_field_count', coverageFields.length === 10, { coverageFields });
  assert('evidence_window_result_vocabulary_count', vocab.length === 4, { vocab });
  assert('evidence_window_state_count', states.length === 8, { states });
  assert('boundary_rule_count', boundaryRules.length === 14, { boundaryRules });
  assert('prohibited_evidence_window_semantic_count', prohibited.length === 20, { prohibited });
  assert('p7_02_handoff_rule_count', handoff.length === 13, { handoff });
  assert('secondary_review_rules_verified', secondary.length === 5 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs });
  assert('boundary_blocks_runtime_db_frontend_execution', boundary.includes('p7_01_changes_frontend = false') && boundary.includes('p7_01_changes_runtime = false') && boundary.includes('p7_01_changes_db = false') && boundary.includes('p7_01_changes_execution = false'), { boundary });
  assert('boundary_blocks_state_prediction_outputs', boundary.includes('p7_01_creates_state_estimator = false') && boundary.includes('p7_01_creates_prediction_run = false') && boundary.includes('p7_01_creates_field_memory_write = false') && boundary.includes('p7_01_creates_model_update = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { evidence_window_principle_count: principles.length, allowed_evidence_source_kind_count: sourceKinds.length, evidence_window_contract_field_count: fields.length, evidence_window_validation_gate_count: gates.length, evidence_window_fail_code_count: failCodes.length, coverage_summary_field_count: coverageFields.length, evidence_window_result_vocabulary_count: vocab.length, evidence_window_state_count: states.length, boundary_rule_count: boundaryRules.length, prohibited_evidence_window_semantic_count: prohibited.length, p7_02_handoff_rule_count: handoff.length, secondary_review_required: true };
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  assert('changed_file_count_verified', changedFiles.length === ALLOWED_CHANGED_FILES.length, { changedFiles });
  for (const file of ALLOWED_CHANGED_FILES) assert(`changed_file_present:${file}`, changedFiles.includes(file), { changedFiles });
  for (const file of changedFiles) assert(`changed_file_allowed:${file}`, ALLOWED_CHANGED_FILES.includes(file), { changedFiles });
  assert('no_frontend_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/web/')), { changedFiles });
  assert('no_runtime_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/server/') && !file.startsWith('apps/executor/') && !file.startsWith('packages/')), { changedFiles });
  assert('no_db_changed_by_this_task', changedFiles.every((file) => !file.startsWith('db/') && !file.startsWith('migrations/') && !file.includes('migration')), { changedFiles });
  assert('no_execution_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/executor/') && !file.startsWith('scripts/twin_kernel/') && !file.startsWith('scripts/runtime/') && !file.startsWith('scripts/demo_seed/')), { changedFiles });
  return changedFiles;
}

try {
  verifyEntry();
  const counts = verifyCurrentDoc();
  const changedFiles = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p7_00_verified: true, p6_completion_tag_verified: true, ...counts, changed_file_count: changedFiles.length, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
