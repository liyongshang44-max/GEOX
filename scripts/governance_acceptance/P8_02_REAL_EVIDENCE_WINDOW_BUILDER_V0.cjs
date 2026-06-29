// scripts/governance_acceptance/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs
// Purpose: verify the P8-02 Real Evidence Window Builder v0 gate.
// Boundary: verifies a read-only DB evidence window runtime; it creates no product surface and stores no runtime output.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0';
const NEXT_STEP = 'P8_03_HOLDOUT_WINDOW_SPLIT_CONTRACT';
const PREVIOUS_DOC = 'docs/tasks/P8-01-Real-Evidence-Source-Contract.md';
const PREVIOUS_SCRIPT = 'scripts/governance_acceptance/P8_01_REAL_EVIDENCE_SOURCE_CONTRACT.cjs';
const CURRENT_DOC = 'docs/tasks/P8-02-Real-Evidence-Window-Builder-v0.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs';
const RUNTIME_SCRIPT = 'scripts/twin_kernel/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs';
const ALLOWED_CHANGED_FILES = [CURRENT_DOC, CURRENT_SCRIPT, RUNTIME_SCRIPT];
const BLOCKED_PREFIXES = ['apps/web/', 'apps/server/', 'apps/executor/', 'packages/', 'db/', 'migrations/', 'scripts/demo_seed/', 'scripts/runtime/'];
const REQUIRED_OUTPUT_FIELDS = ['real_evidence_window_id', 'output_kind', 'project_id', 'subject_ref', 'sensor_ref', 'sensor_group_ref', 'metric_kind', 'window_start_ts', 'window_end_ts', 'sample_count', 'metric_count', 'metric_refs', 'coverage_summary', 'evidence_points', 'evidence_refs', 'source_query_ref', 'trace_refs', 'provenance_ref', 'read_only', 'determinism_hash'];
const assertions = [];

function abs(file) { return path.resolve(ROOT, file); }
function exists(file) { return fs.existsSync(abs(file)); }
function read(file) { return fs.readFileSync(abs(file), 'utf8'); }
function tryGit(args) { try { return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } }
function changedFilesFromMain() { return [...new Set(tryGit(['diff', '--name-only', 'main...HEAD']).split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].sort(); }
function section(text, heading) { const marker = `## ${heading}`; const start = text.indexOf(marker); if (start < 0) return []; const open = text.indexOf('```text', start); if (open < 0) return []; const bodyStart = text.indexOf('\n', open) + 1; const close = text.indexOf('```', bodyStart); if (close < 0) return []; return text.slice(bodyStart, close).split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function assert(name, condition, details = {}) { assertions.push({ name, passed: condition === true, details }); if (condition !== true) { const error = new Error(`ASSERTION_FAILED:${name}`); error.details = details; throw error; } }
function summary() { const failed = assertions.filter((item) => !item.passed); return { assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) }; }

function verifyEntry() {
  assert('p8_01_doc_exists', exists(PREVIOUS_DOC), { PREVIOUS_DOC });
  assert('p8_01_script_exists', exists(PREVIOUS_SCRIPT), { PREVIOUS_SCRIPT });
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  assert('runtime_script_exists', exists(RUNTIME_SCRIPT), { RUNTIME_SCRIPT });
  assert('p8_01_handoff_verified', read(PREVIOUS_DOC).includes('P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0'), { PREVIOUS_DOC });
}

function verifyDoc() {
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  const runtimeFiles = section(doc, 'Runtime files created in P8-02');
  const scope = section(doc, 'Default replay scope');
  const requiredFields = section(doc, 'Required output fields');
  const sourceRules = section(doc, 'Source query requirements');
  const strictBoundary = section(doc, 'Runtime strict prohibitions');
  const determinism = section(doc, 'Determinism requirements');
  const next = section(doc, 'Next step');
  assert('runtime_file_count', runtimeFiles.length === 3, { runtimeFiles });
  assert('default_scope_line_count', scope.length === 7, { scope });
  assert('required_output_field_count', requiredFields.length === 20, { requiredFields });
  assert('source_query_requirement_count', sourceRules.length === 10, { sourceRules });
  assert('strict_boundary_count', strictBoundary.length === 12, { strictBoundary });
  assert('determinism_requirement_count', determinism.length === 5, { determinism });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });
  return { required_output_field_count: requiredFields.length, source_query_requirement_count: sourceRules.length, strict_boundary_count: strictBoundary.length };
}

function verifyRuntimeSource() {
  const runtime = read(RUNTIME_SCRIPT);
  assert('runtime_uses_pg_client', runtime.includes("require('pg')"), { RUNTIME_SCRIPT });
  assert('runtime_uses_read_only_transaction', runtime.includes("begin read only"), { RUNTIME_SCRIPT });
  assert('runtime_has_no_fixture_input_path', !runtime.includes('fixtures/P7_') && !runtime.includes('P7_02_EVIDENCE_WINDOW'), { RUNTIME_SCRIPT });
  assert('runtime_mentions_raw_samples', runtime.includes('raw_samples'), { RUNTIME_SCRIPT });
}

function runRuntimeJson() {
  const firstText = childProcess.execFileSync('node', [RUNTIME_SCRIPT], { cwd: ROOT, encoding: 'utf8', env: process.env });
  const secondText = childProcess.execFileSync('node', [RUNTIME_SCRIPT], { cwd: ROOT, encoding: 'utf8', env: process.env });
  const first = JSON.parse(firstText);
  const second = JSON.parse(secondText);
  assert('runtime_output_is_deterministic', JSON.stringify(first) === JSON.stringify(second), { first_hash: first.determinism_hash, second_hash: second.determinism_hash });
  return first;
}

function verifyRuntimeOutput(output) {
  for (const field of REQUIRED_OUTPUT_FIELDS) assert(`runtime_output_field_present:${field}`, Object.prototype.hasOwnProperty.call(output, field), { output_keys: Object.keys(output) });
  assert('runtime_output_kind_verified', output.output_kind === 'real_evidence_window_v0', { output_kind: output.output_kind });
  assert('runtime_project_verified', output.project_id === 'P_DEFAULT', { project_id: output.project_id });
  assert('runtime_group_verified', output.sensor_group_ref?.ref_id === 'G_CAF', { sensor_group_ref: output.sensor_group_ref });
  assert('runtime_sensor_verified', output.sensor_ref?.ref_id === 'CAF009', { sensor_ref: output.sensor_ref });
  assert('runtime_metric_kind_verified', output.metric_kind === 'soil_moisture', { metric_kind: output.metric_kind });
  assert('sample_count_positive', Number.isFinite(output.sample_count) && output.sample_count > 0, { sample_count: output.sample_count });
  assert('metric_count_at_least_one', Number.isFinite(output.metric_count) && output.metric_count >= 1, { metric_count: output.metric_count });
  assert('metric_refs_non_empty', Array.isArray(output.metric_refs) && output.metric_refs.length >= 1, { metric_refs: output.metric_refs });
  assert('evidence_points_non_empty', Array.isArray(output.evidence_points) && output.evidence_points.length === output.sample_count, { evidence_points_length: output.evidence_points?.length, sample_count: output.sample_count });
  assert('evidence_refs_non_empty', Array.isArray(output.evidence_refs) && output.evidence_refs.length > 0, { evidence_refs: output.evidence_refs });
  assert('source_query_ref_present', output.source_query_ref && output.source_query_ref.kind === 'readonly_postgres_query_ref', { source_query_ref: output.source_query_ref });
  assert('trace_refs_present', Array.isArray(output.trace_refs) && output.trace_refs.length > 0, { trace_refs: output.trace_refs });
  assert('provenance_ref_present', output.provenance_ref && output.provenance_ref.kind === 'postgres_raw_samples_readonly_query', { provenance_ref: output.provenance_ref });
  assert('read_only_true', output.read_only === true, { read_only: output.read_only });
  assert('determinism_hash_sha256', /^[a-f0-9]{64}$/.test(output.determinism_hash), { determinism_hash: output.determinism_hash });
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  if (changedFiles.length === 0) return { changedFiles, p8_02_changed_files: [], changed_file_mode: 'main_integrated_replay' };
  const p802Files = changedFiles.filter((file) => ALLOWED_CHANGED_FILES.includes(file));
  assert('p8_02_changed_file_count', p802Files.length === ALLOWED_CHANGED_FILES.length, { p802Files, changedFiles });
  for (const file of ALLOWED_CHANGED_FILES) assert(`p8_02_file_present:${file}`, changedFiles.includes(file), { changedFiles });
  for (const file of changedFiles) assert(`p8_02_no_blocked_prefix:${file}`, !BLOCKED_PREFIXES.some((prefix) => file.startsWith(prefix)), { changedFiles });
  return { changedFiles, p8_02_changed_files: p802Files, changed_file_mode: 'branch_diff_scoped_to_p8_02_files' };
}

try {
  verifyEntry();
  const docCounts = verifyDoc();
  verifyRuntimeSource();
  const output = runRuntimeJson();
  verifyRuntimeOutput(output);
  const changed = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p8_01_verified: true, db_connected: true, raw_samples_target_window_verified: true, real_evidence_window_verified: true, sample_count_positive: true, metric_count_at_least_one: true, evidence_refs_non_empty: true, source_query_ref_present: true, determinism_stable: true, read_only: true, ...docCounts, changed_file_count: changed.p8_02_changed_files.length, branch_changed_file_count: changed.changedFiles.length, changed_file_mode: changed.changed_file_mode, changed_files: changed.p8_02_changed_files, real_evidence_window_id: output.real_evidence_window_id, sample_count: output.sample_count, metric_count: output.metric_count, determinism_hash: output.determinism_hash, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
