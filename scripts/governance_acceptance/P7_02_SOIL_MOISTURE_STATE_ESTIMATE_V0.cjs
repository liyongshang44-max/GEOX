// scripts/governance_acceptance/P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0.cjs
// Purpose: verify the P7-02 Soil Moisture State Estimate v0 gate.
// Boundary: verifies a read-only local twin-kernel CLI and static contract files without DB, frontend, API, execution, Field Memory, or model writes.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0';
const NEXT_STEP = 'P7_03_PREDICTION_RUN_V0';
const P6_COMPLETION_TAG = 'p6_execution_system_integration_completion';
const P7_01_COMMIT = '71389510e1c10ca71c2ddaefa5548bc91879bfd5';
const P7_01_DOC = 'docs/tasks/P7-01-Twin-Evidence-Window-Contract.md';
const P7_01_SCRIPT = 'scripts/governance_acceptance/P7_01_TWIN_EVIDENCE_WINDOW_CONTRACT.cjs';
const CURRENT_DOC = 'docs/tasks/P7-02-Soil-Moisture-State-Estimate-v0.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0.cjs';
const RUNTIME_SCRIPT = 'scripts/twin_kernel/P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0.cjs';
const FIXTURE_FILE = 'scripts/twin_kernel/fixtures/P7_02_EVIDENCE_WINDOW_CAF009_SAMPLE.json';

const ALLOWED_CHANGED_FILES = [CURRENT_DOC, CURRENT_SCRIPT, RUNTIME_SCRIPT, FIXTURE_FILE];
const FORBIDDEN_PREFIXES = ['apps/web/', 'apps/server/', 'apps/executor/', 'packages/twin-kernel/', 'packages/contracts/', 'packages/', 'db/', 'migrations/', 'scripts/demo_seed/', 'scripts/runtime/'];
const REQUIRED_OUTPUT_FIELDS = ['state_estimate_version', 'state_estimate_id', 'output_kind', 'project_id', 'subject_ref', 'sensor_ref', 'sensor_group_ref', 'as_of_ts', 'input_evidence_window_ref', 'metric_kind', 'unit', 'estimate_method', 'estimate_value', 'estimate_by_metric', 'sample_count', 'coverage_ratio', 'coverage_quality_label', 'uncertainty', 'confidence_basis', 'quality_flags', 'evidence_refs', 'trace_refs', 'provenance_ref', 'read_only', 'determinism_hash'];
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

function runStateEstimate() {
  const first = childProcess.execFileSync('node', [RUNTIME_SCRIPT], { cwd: ROOT, encoding: 'utf8' });
  const second = childProcess.execFileSync('node', [RUNTIME_SCRIPT], { cwd: ROOT, encoding: 'utf8' });
  const firstJson = JSON.parse(first);
  const secondJson = JSON.parse(second);
  assert('runtime_output_is_deterministic', JSON.stringify(firstJson) === JSON.stringify(secondJson), { first_hash: firstJson.determinism_hash, second_hash: secondJson.determinism_hash });
  return firstJson;
}

function verifyEntry() {
  assert('p7_01_doc_exists', exists(P7_01_DOC), { P7_01_DOC });
  assert('p7_01_script_exists', exists(P7_01_SCRIPT), { P7_01_SCRIPT });
  assert('p7_01_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P7_01_COMMIT, 'HEAD']), { P7_01_COMMIT });
  assert('p6_completion_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P6_COMPLETION_TAG}`]), { P6_COMPLETION_TAG });
  const p701Doc = read(P7_01_DOC);
  assert('p7_01_doc_handoff_verified', p701Doc.includes('P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0') && p701Doc.includes('p7_02_handoff_rule_count = 13'), { P7_01_DOC });
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  assert('runtime_script_exists', exists(RUNTIME_SCRIPT), { RUNTIME_SCRIPT });
  assert('fixture_file_exists', exists(FIXTURE_FILE), { FIXTURE_FILE });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_allows_state_estimate_only', doc.includes('allowed to output `state_estimate`') && doc.includes('not allowed to output a prediction run'), { CURRENT_DOC });

  const runtimeFiles = section(doc, 'Runtime files created in P7-02');
  const outputFields = section(doc, 'State estimate output fields');
  const methodRules = section(doc, 'State estimate method rules');
  const gates = section(doc, 'Required state estimate validation gates');
  const failCodes = section(doc, 'State estimate fail codes');
  const vocab = section(doc, 'State estimate result vocabulary');
  const states = section(doc, 'State estimate state vocabulary');
  const allowedSideEffects = section(doc, 'Allowed runtime side effects');
  const prohibited = section(doc, 'Prohibited state estimate semantics');
  const handoff = section(doc, 'P7-03 handoff');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P7-02');
  const forbiddenDirs = section(doc, 'Directories forbidden in P7-02');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('runtime_file_count', runtimeFiles.length === 2, { runtimeFiles });
  assert('state_estimate_output_field_count', outputFields.length === 25, { outputFields });
  assert('state_estimate_method_rule_count', methodRules.length === 12, { methodRules });
  assert('state_estimate_validation_gate_count', gates.length === 23, { gates });
  assert('state_estimate_fail_code_count', failCodes.length === 23, { failCodes });
  assert('state_estimate_result_vocabulary_count', vocab.length === 4, { vocab });
  assert('state_estimate_state_count', states.length === 8, { states });
  assert('allowed_runtime_side_effect_count', allowedSideEffects.length === 6, { allowedSideEffects });
  assert('prohibited_state_estimate_semantic_count', prohibited.length === 20, { prohibited });
  assert('p7_03_handoff_rule_count', handoff.length === 12, { handoff });
  assert('secondary_review_rules_verified', secondary.length === 6 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs });
  assert('boundary_allows_state_runtime', boundary.includes('p7_02_creates_state_estimate_runtime = true') && boundary.includes('p7_02_creates_fixture_input = true'), { boundary });
  assert('boundary_blocks_db_frontend_execution_and_next_outputs', boundary.includes('p7_02_changes_frontend = false') && boundary.includes('p7_02_changes_db = false') && boundary.includes('p7_02_changes_execution = false') && boundary.includes('p7_02_creates_prediction_run = false') && boundary.includes('p7_02_creates_field_memory_write = false') && boundary.includes('p7_02_creates_model_update = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { state_estimate_output_field_count: outputFields.length, state_estimate_method_rule_count: methodRules.length, state_estimate_validation_gate_count: gates.length, state_estimate_fail_code_count: failCodes.length, state_estimate_result_vocabulary_count: vocab.length, state_estimate_state_count: states.length, allowed_runtime_side_effect_count: allowedSideEffects.length, prohibited_state_estimate_semantic_count: prohibited.length, p7_03_handoff_rule_count: handoff.length, secondary_review_required: true };
}

function verifyRuntimeOutput(output) {
  for (const field of REQUIRED_OUTPUT_FIELDS) assert(`runtime_output_field_present:${field}`, Object.prototype.hasOwnProperty.call(output, field), { output_keys: Object.keys(output) });
  assert('runtime_output_field_count', Object.keys(output).length === REQUIRED_OUTPUT_FIELDS.length, { output_keys: Object.keys(output) });
  assert('runtime_output_kind_verified', output.output_kind === 'soil_moisture_state_estimate_v0', { output_kind: output.output_kind });
  assert('runtime_output_read_only', output.read_only === true, { read_only: output.read_only });
  assert('runtime_output_metric_kind_soil_moisture', output.metric_kind === 'soil_moisture', { metric_kind: output.metric_kind });
  assert('runtime_output_estimate_numeric', Number.isFinite(output.estimate_value), { estimate_value: output.estimate_value });
  assert('runtime_output_estimate_by_metric_non_empty', Array.isArray(output.estimate_by_metric) && output.estimate_by_metric.length === 3, { estimate_by_metric: output.estimate_by_metric });
  assert('runtime_output_uncertainty_present', output.uncertainty && Number.isFinite(output.uncertainty.lower_bound) && Number.isFinite(output.uncertainty.upper_bound), { uncertainty: output.uncertainty });
  assert('runtime_output_traceable', Array.isArray(output.evidence_refs) && output.evidence_refs.length > 0 && Array.isArray(output.trace_refs) && output.trace_refs.length > 0, { evidence_refs: output.evidence_refs, trace_refs: output.trace_refs });
  assert('runtime_output_hash_sha256', /^[a-f0-9]{64}$/.test(output.determinism_hash), { determinism_hash: output.determinism_hash });
  assert('runtime_output_has_no_prediction', !Object.prototype.hasOwnProperty.call(output, 'prediction_run_id') && !Object.prototype.hasOwnProperty.call(output, 'prediction_points'), { output_keys: Object.keys(output) });
  assert('runtime_output_has_no_execution_or_learning_write', !Object.prototype.hasOwnProperty.call(output, 'field_memory_write') && !Object.prototype.hasOwnProperty.call(output, 'model_update') && !Object.prototype.hasOwnProperty.call(output, 'execution_object'), { output_keys: Object.keys(output) });
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  assert('changed_file_count_verified', changedFiles.length === ALLOWED_CHANGED_FILES.length, { changedFiles });
  for (const file of ALLOWED_CHANGED_FILES) assert(`changed_file_present:${file}`, changedFiles.includes(file), { changedFiles });
  for (const file of changedFiles) assert(`changed_file_allowed:${file}`, ALLOWED_CHANGED_FILES.includes(file), { changedFiles });
  assert('no_frontend_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/web/')), { changedFiles });
  assert('no_server_runtime_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/server/') && !file.startsWith('apps/executor/') && !file.startsWith('packages/')), { changedFiles });
  assert('no_db_changed_by_this_task', changedFiles.every((file) => !file.startsWith('db/') && !file.startsWith('migrations/') && !file.includes('migration')), { changedFiles });
  assert('no_execution_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/executor/') && !file.startsWith('scripts/runtime/') && !file.startsWith('scripts/demo_seed/')), { changedFiles });
  return changedFiles;
}

try {
  verifyEntry();
  const counts = verifyCurrentDoc();
  const output = runStateEstimate();
  verifyRuntimeOutput(output);
  const changedFiles = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p7_01_verified: true, p6_completion_tag_verified: true, state_estimate_runtime_verified: true, fixture_verified: true, ...counts, changed_file_count: changedFiles.length, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_server_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, sample_state_estimate_id: output.state_estimate_id, sample_determinism_hash: output.determinism_hash, sample_estimate_value: output.estimate_value, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
