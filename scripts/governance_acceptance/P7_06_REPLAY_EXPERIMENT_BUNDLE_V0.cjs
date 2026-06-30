// scripts/governance_acceptance/P7_06_REPLAY_EXPERIMENT_BUNDLE_V0.cjs
// Purpose: verify the P7-06 Replay Experiment Bundle v0 gate.
// Boundary: verifies a read-only local twin-kernel replay CLI and static contract files without DB, frontend, API, execution, Field Memory, model write, or runtime state mutation.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P7_06_REPLAY_EXPERIMENT_BUNDLE_V0';
const NEXT_STEP = 'P7_07_TWIN_KERNEL_COMPLETION_REVIEW';
const P6_COMPLETION_TAG = 'p6_execution_system_integration_completion';
const P7_05_COMMIT = '9df61364cc5ef526da47b3a8f166116c93cc5afe';
const P7_05_DOC = 'docs/legacy/tasks/P7-05-Calibration-Report-v0.md';
const P7_05_SCRIPT = 'scripts/governance_acceptance/P7_05_CALIBRATION_REPORT_V0.cjs';
const P7_05_RUNTIME = 'scripts/twin_kernel/P7_05_CALIBRATION_REPORT_V0.cjs';
const CURRENT_DOC = 'docs/legacy/tasks/P7-06-Replay-Experiment-Bundle-v0.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P7_06_REPLAY_EXPERIMENT_BUNDLE_V0.cjs';
const RUNTIME_SCRIPT = 'scripts/twin_kernel/P7_06_REPLAY_EXPERIMENT_BUNDLE_V0.cjs';

const ALLOWED_CHANGED_FILES = [CURRENT_DOC, CURRENT_SCRIPT, RUNTIME_SCRIPT];
const FORBIDDEN_PREFIXES = ['apps/web/', 'apps/server/', 'apps/executor/', 'packages/', 'db/', 'migrations/', 'scripts/demo_seed/', 'scripts/runtime/'];
const REQUIRED_OUTPUT_FIELDS = ['replay_bundle_version', 'replay_bundle_id', 'output_kind', 'project_id', 'subject_ref', 'sensor_ref', 'sensor_group_ref', 'input_calibration_report_ref', 'input_backtest_error_report_ref', 'input_prediction_run_ref', 'input_state_estimate_ref', 'input_evidence_window_ref', 'metric_kind', 'unit', 'replay_method', 'generated_for_as_of_ts', 'artifact_chain', 'runtime_manifest', 'input_fixture_refs', 'calibration_applied', 'evidence_refs', 'trace_refs', 'provenance_ref', 'read_only', 'determinism_hash'];
const assertions = [];

function abs(file) { return path.resolve(ROOT, file); }
function exists(file) { return fs.existsSync(abs(file)); }
function read(file) { return fs.readFileSync(abs(file), 'utf8'); }
function git(args) { return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); }
function tryGit(args) { try { return git(args); } catch { return ''; } }
function gitSucceeds(args) { try { childProcess.execFileSync('git', args, { cwd: ROOT, stdio: 'ignore' }); return true; } catch { return false; } }
function changedFilesFromMain() { const lists = [['diff', '--name-only', 'main...HEAD'], ['diff', '--name-only'], ['diff', '--cached', '--name-only']]; return [...new Set(lists.flatMap((args) => tryGit(args).split(/\r?\n/).map((line) => line.trim()).filter(Boolean)))].sort(); }
function section(text, heading) { const marker = `## ${heading}`; const start = text.indexOf(marker); if (start < 0) return []; const open = text.indexOf('```text', start); if (open < 0) return []; const bodyStart = text.indexOf('\n', open) + 1; const close = text.indexOf('```', bodyStart); if (close < 0) return []; return text.slice(bodyStart, close).split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function assert(name, condition, details = {}) { assertions.push({ name, passed: condition === true, details }); if (condition !== true) { const error = new Error(`ASSERTION_FAILED:${name}`); error.details = details; throw error; } }
function summary() { const failed = assertions.filter((item) => !item.passed); return { assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) }; }

function runReplayBundle() {
  const first = childProcess.execFileSync('node', [RUNTIME_SCRIPT], { cwd: ROOT, encoding: 'utf8' });
  const second = childProcess.execFileSync('node', [RUNTIME_SCRIPT], { cwd: ROOT, encoding: 'utf8' });
  const firstJson = JSON.parse(first);
  const secondJson = JSON.parse(second);
  assert('replay_output_is_deterministic', JSON.stringify(firstJson) === JSON.stringify(secondJson), { first_hash: firstJson.determinism_hash, second_hash: secondJson.determinism_hash });
  return firstJson;
}

function verifyEntry() {
  assert('p7_05_doc_exists', exists(P7_05_DOC), { P7_05_DOC });
  assert('p7_05_script_exists', exists(P7_05_SCRIPT), { P7_05_SCRIPT });
  assert('p7_05_runtime_exists', exists(P7_05_RUNTIME), { P7_05_RUNTIME });
  assert('p7_05_commit_is_ancestor', gitSucceeds(['merge-base', '--is-ancestor', P7_05_COMMIT, 'HEAD']), { P7_05_COMMIT });
  assert('p6_completion_tag_exists', gitSucceeds(['rev-parse', '--verify', `refs/tags/${P6_COMPLETION_TAG}`]), { P6_COMPLETION_TAG });
  const p705Doc = read(P7_05_DOC);
  assert('p7_05_doc_handoff_verified', p705Doc.includes('P7_06_REPLAY_EXPERIMENT_BUNDLE_V0') && p705Doc.includes('p7_06_handoff_rule_count = 15'), { P7_05_DOC });
}

function verifyCurrentDoc() {
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  assert('runtime_script_exists', exists(RUNTIME_SCRIPT), { RUNTIME_SCRIPT });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  assert('current_doc_allows_replay_only', doc.includes('allowed to output `replay_experiment_bundle`') && doc.includes('must not write model'), { CURRENT_DOC });

  const runtimeFiles = section(doc, 'Runtime files created in P7-06');
  const outputFields = section(doc, 'Replay bundle output fields');
  const methodRules = section(doc, 'Replay method rules');
  const gates = section(doc, 'Required replay validation gates');
  const failCodes = section(doc, 'Replay fail codes');
  const vocab = section(doc, 'Replay result vocabulary');
  const states = section(doc, 'Replay state vocabulary');
  const allowedSideEffects = section(doc, 'Allowed runtime side effects');
  const prohibited = section(doc, 'Prohibited replay semantics');
  const handoff = section(doc, 'P7-07 handoff');
  const secondary = section(doc, 'Secondary review requirement');
  const allowed = section(doc, 'Changed files allowed in P7-06');
  const forbiddenDirs = section(doc, 'Directories forbidden in P7-06');
  const boundary = section(doc, 'Boundary assertions');
  const next = section(doc, 'Next step');

  assert('runtime_file_count', runtimeFiles.length === 1, { runtimeFiles });
  assert('replay_bundle_output_field_count', outputFields.length === 25, { outputFields });
  assert('replay_method_rule_count', methodRules.length === 14, { methodRules });
  assert('replay_validation_gate_count', gates.length === 28, { gates });
  assert('replay_fail_code_count', failCodes.length === 28, { failCodes });
  assert('replay_result_vocabulary_count', vocab.length === 4, { vocab });
  assert('replay_state_count', states.length === 8, { states });
  assert('allowed_runtime_side_effect_count', allowedSideEffects.length === 7, { allowedSideEffects });
  assert('prohibited_replay_semantic_count', prohibited.length === 12, { prohibited });
  assert('p7_07_handoff_rule_count', handoff.length === 12, { handoff });
  assert('secondary_review_rules_verified', secondary.length === 6 && secondary.every((line) => line.endsWith('= true')), { secondary });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('forbidden_directories_documented', FORBIDDEN_PREFIXES.every((prefix) => forbiddenDirs.includes(prefix)), { forbiddenDirs });
  assert('boundary_allows_replay_runtime', boundary.includes('p7_06_creates_replay_experiment_bundle_runtime = true') && boundary.includes('p7_06_reuses_p7_05_calibration_report = true'), { boundary });
  assert('boundary_blocks_writes', boundary.includes('p7_06_changes_frontend = false') && boundary.includes('p7_06_changes_db = false') && boundary.includes('p7_06_changes_execution = false') && boundary.includes('p7_06_creates_model_write = false') && boundary.includes('p7_06_creates_field_memory_write = false'), { boundary });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { replay_bundle_output_field_count: outputFields.length, replay_method_rule_count: methodRules.length, replay_validation_gate_count: gates.length, replay_fail_code_count: failCodes.length, replay_result_vocabulary_count: vocab.length, replay_state_count: states.length, allowed_runtime_side_effect_count: allowedSideEffects.length, prohibited_replay_semantic_count: prohibited.length, p7_07_handoff_rule_count: handoff.length, secondary_review_required: true };
}

function verifyReplayOutput(output) {
  for (const field of REQUIRED_OUTPUT_FIELDS) assert(`replay_output_field_present:${field}`, Object.prototype.hasOwnProperty.call(output, field), { output_keys: Object.keys(output) });
  assert('replay_output_field_count', Object.keys(output).length === REQUIRED_OUTPUT_FIELDS.length, { output_keys: Object.keys(output) });
  assert('replay_output_kind_verified', output.output_kind === 'soil_moisture_replay_experiment_bundle_v0', { output_kind: output.output_kind });
  assert('replay_output_read_only', output.read_only === true, { read_only: output.read_only });
  assert('replay_output_metric_kind_soil_moisture', output.metric_kind === 'soil_moisture', { metric_kind: output.metric_kind });
  assert('replay_artifact_chain_verified', Array.isArray(output.artifact_chain) && output.artifact_chain.length === 5, { artifact_chain: output.artifact_chain });
  assert('replay_runtime_manifest_verified', output.runtime_manifest && Array.isArray(output.runtime_manifest.node_commands) && output.runtime_manifest.node_commands.length === 5 && Array.isArray(output.runtime_manifest.acceptance_commands) && output.runtime_manifest.acceptance_commands.length === 5, { runtime_manifest: output.runtime_manifest });
  assert('replay_write_policy_all_false', output.runtime_manifest && output.runtime_manifest.write_policy && Object.values(output.runtime_manifest.write_policy).every((value) => value === false), { write_policy: output.runtime_manifest && output.runtime_manifest.write_policy });
  assert('replay_input_fixture_refs_verified', Array.isArray(output.input_fixture_refs) && output.input_fixture_refs.length === 2, { input_fixture_refs: output.input_fixture_refs });
  assert('replay_calibration_not_applied', output.calibration_applied === false, { calibration_applied: output.calibration_applied });
  assert('replay_output_traceable', Array.isArray(output.evidence_refs) && output.evidence_refs.length > 0 && Array.isArray(output.trace_refs) && output.trace_refs.length > 0, { evidence_refs: output.evidence_refs, trace_refs: output.trace_refs });
  assert('replay_output_hash_sha256', /^[a-f0-9]{64}$/.test(output.determinism_hash), { determinism_hash: output.determinism_hash });
  assert('replay_output_has_no_model_or_field_memory_write', !Object.prototype.hasOwnProperty.call(output, 'model_write') && !Object.prototype.hasOwnProperty.call(output, 'model_update') && !Object.prototype.hasOwnProperty.call(output, 'field_memory_write'), { output_keys: Object.keys(output) });
  assert('replay_output_has_no_execution_write', !Object.prototype.hasOwnProperty.call(output, 'execution_object'), { output_keys: Object.keys(output) });
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  if (changedFiles.length === 0) {
    for (const file of ALLOWED_CHANGED_FILES) assert('main_replay_file_exists:' + file, exists(file), { file });
    assert('main_replay_changed_file_count_allowed', true, { changedFiles });
    return { changedFiles, changedFileMode: 'main_integrated_replay' };
  }
  assert('changed_file_count_verified', changedFiles.length === ALLOWED_CHANGED_FILES.length, { changedFiles });
  for (const file of ALLOWED_CHANGED_FILES) assert(`changed_file_present:${file}`, changedFiles.includes(file), { changedFiles });
  for (const file of changedFiles) assert(`changed_file_allowed:${file}`, ALLOWED_CHANGED_FILES.includes(file), { changedFiles });
  assert('no_frontend_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/web/')), { changedFiles });
  assert('no_server_runtime_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/server/') && !file.startsWith('apps/executor/') && !file.startsWith('packages/')), { changedFiles });
  assert('no_db_changed_by_this_task', changedFiles.every((file) => !file.startsWith('db/') && !file.startsWith('migrations/') && !file.includes('migration')), { changedFiles });
  assert('no_execution_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/executor/') && !file.startsWith('scripts/runtime/') && !file.startsWith('scripts/demo_seed/')), { changedFiles });
  return { changedFiles, changedFileMode: 'branch_diff' };
}

try {
  verifyEntry();
  const counts = verifyCurrentDoc();
  const output = runReplayBundle();
  verifyReplayOutput(output);
  const changedFileVerification = verifyChangedFiles();
  const changedFiles = changedFileVerification.changedFiles;
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p7_05_verified: true, p6_completion_tag_verified: true, replay_bundle_runtime_verified: true, ...counts, changed_file_count: changedFiles.length, changed_file_mode: changedFileVerification.changedFileMode, changed_files: changedFiles, no_frontend_changed_by_this_task: true, no_server_runtime_changed_by_this_task: true, no_db_changed_by_this_task: true, no_execution_changed_by_this_task: true, sample_replay_bundle_id: output.replay_bundle_id, sample_determinism_hash: output.determinism_hash, sample_artifact_chain_count: output.artifact_chain.length, sample_calibration_applied: output.calibration_applied, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
