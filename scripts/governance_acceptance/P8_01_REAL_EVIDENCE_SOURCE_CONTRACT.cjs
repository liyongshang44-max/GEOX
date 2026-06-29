// scripts/governance_acceptance/P8_01_REAL_EVIDENCE_SOURCE_CONTRACT.cjs
// Purpose: verify the P8-01 Real Evidence Source Contract gate.
// Boundary: checks the evidence-source contract only; it creates no runtime and changes no product surface.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P8_01_REAL_EVIDENCE_SOURCE_CONTRACT';
const NEXT_STEP = 'P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0';
const PREVIOUS_DOC = 'docs/tasks/P8-00-Real-Evidence-Closed-Loop-Planning.md';
const PREVIOUS_SCRIPT = 'scripts/governance_acceptance/P8_00_REAL_EVIDENCE_CLOSED_LOOP_PLANNING.cjs';
const CURRENT_DOC = 'docs/tasks/P8-01-Real-Evidence-Source-Contract.md';
const CURRENT_SCRIPT = 'scripts/governance_acceptance/P8_01_REAL_EVIDENCE_SOURCE_CONTRACT.cjs';
const ALLOWED_CHANGED_FILES = [CURRENT_DOC, CURRENT_SCRIPT];
const BLOCKED_PREFIXES = ['apps/web/', 'apps/server/', 'apps/executor/', 'packages/', 'db/', 'migrations/', 'scripts/twin_kernel/', 'scripts/demo_seed/', 'scripts/runtime/'];
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
  assert('p8_00_doc_exists', exists(PREVIOUS_DOC), { PREVIOUS_DOC });
  assert('p8_00_script_exists', exists(PREVIOUS_SCRIPT), { PREVIOUS_SCRIPT });
  assert('current_doc_exists', exists(CURRENT_DOC), { CURRENT_DOC });
  assert('current_script_exists', exists(CURRENT_SCRIPT), { CURRENT_SCRIPT });
  assert('p8_00_handoff_verified', read(PREVIOUS_DOC).includes('P8_01_REAL_EVIDENCE_SOURCE_CONTRACT'), { PREVIOUS_DOC });
}

function verifyDoc() {
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });

  const sourcePriority = section(doc, 'Source priority');
  const sourceKinds = section(doc, 'Real evidence source kinds');
  const excludedSources = section(doc, 'Forbidden sources');
  const adapterFields = section(doc, 'Adapter output fields');
  const compatibility = section(doc, 'Adapter compatibility rules');
  const queryRules = section(doc, 'Read-only query rules');
  const traceability = section(doc, 'Source traceability rules');
  const rejection = section(doc, 'Synthetic and placeholder evidence rejection rules');
  const noSchemaSeed = section(doc, 'No schema or seed changes');
  const allowed = section(doc, 'Changed files allowed in P8-01');
  const blockedDirs = section(doc, 'Directories forbidden in P8-01');
  const next = section(doc, 'Next step');

  assert('source_priority_count', sourcePriority.length === 3, { sourcePriority });
  assert('primary_source_raw_samples', sourcePriority.includes('primary_source = raw_samples'), { sourcePriority });
  assert('real_evidence_source_kind_count', sourceKinds.length === 3, { sourceKinds });
  assert('forbidden_source_count', excludedSources.length === 4, { excludedSources });
  assert('required_field_count', adapterFields.length === 11, { adapterFields });
  for (const field of ['project_id', 'sensor_id', 'sensor_group_id', 'metric_ref', 'metric_kind', 'ts_ms', 'observed_at', 'value', 'unit', 'source_ref', 'raw_sample_ref']) assert(`required_field_present:${field}`, adapterFields.includes(field), { adapterFields });
  assert('adapter_compatibility_rule_count', compatibility.length === 8, { compatibility });
  assert('read_only_query_rule_count', queryRules.length === 10, { queryRules });
  assert('source_traceability_rule_count', traceability.length === 6, { traceability });
  assert('rejection_rule_count', rejection.length === 4, { rejection });
  assert('no_db_schema_change', noSchemaSeed.includes('no_db_schema_change = true'), { noSchemaSeed });
  assert('no_seed_change', noSchemaSeed.includes('no_seed_change = true'), { noSchemaSeed });
  assert('allowed_changed_files_documented', ALLOWED_CHANGED_FILES.every((file) => allowed.includes(file)), { allowed });
  assert('blocked_directories_documented', BLOCKED_PREFIXES.every((prefix) => blockedDirs.includes(prefix)), { blockedDirs });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });

  return { real_evidence_source_kind_count: sourceKinds.length, required_field_count: adapterFields.length, forbidden_source_count: excludedSources.length, read_only_query_rule_count: queryRules.length, source_traceability_rule_count: traceability.length, no_db_schema_change: true, no_seed_change: true };
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  if (changedFiles.length === 0) return { changedFiles, changed_file_mode: 'main_integrated_replay' };
  for (const file of ALLOWED_CHANGED_FILES) assert(`p8_01_file_present:${file}`, changedFiles.includes(file), { changedFiles });
  for (const file of changedFiles) assert(`p8_01_no_blocked_prefix:${file}`, !BLOCKED_PREFIXES.some((prefix) => file.startsWith(prefix)), { changedFiles });
  return { changedFiles, changed_file_mode: 'branch_diff_allows_later_p8_docs_and_acceptance' };
}

try {
  verifyEntry();
  const counts = verifyDoc();
  const changed = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p8_00_verified: true, ...counts, changed_file_count: changed.changedFiles.length, changed_file_mode: changed.changed_file_mode, changed_files: changed.changedFiles, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
