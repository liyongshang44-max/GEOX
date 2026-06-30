// scripts/governance_acceptance/P8_01_REAL_EVIDENCE_SOURCE_CONTRACT.cjs
// Purpose: verify the P8-01 Real Evidence Source Contract gate.
// Boundary: checks the evidence-source contract only; later P8 files may exist on the same branch.

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
const P8_01_FILES = [CURRENT_DOC, CURRENT_SCRIPT];
const assertions = [];

function abs(file) { return path.resolve(ROOT, file); }
function exists(file) { return fs.existsSync(abs(file)); }
function read(file) { return fs.readFileSync(abs(file), 'utf8'); }
function tryGit(args) { try { return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } }
function changedFilesFromMain() { return [...new Set(tryGit(['diff', '--name-only', 'main...HEAD']).split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].sort(); }
function section(text, heading) { const marker = `## ${heading}`; const start = text.indexOf(marker); if (start < 0) return []; const open = text.indexOf('```text', start); if (open < 0) return []; const bodyStart = text.indexOf('\n', open) + 1; const close = text.indexOf('```', bodyStart); if (close < 0) return []; return text.slice(bodyStart, close).split(/\r?\n/).map((line) => line.trim()).filter(Boolean); }
function assert(name, condition, details = {}) { assertions.push({ name, passed: condition === true, details }); if (condition !== true) { const error = new Error(`ASSERTION_FAILED:${name}`); error.details = details; throw error; } }
function summary() { const failed = assertions.filter((item) => !item.passed); return { assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) }; }

function verifyDoc() {
  for (const file of [PREVIOUS_DOC, PREVIOUS_SCRIPT, CURRENT_DOC, CURRENT_SCRIPT]) assert(`file_exists:${file}`, exists(file), { file });
  assert('p8_00_handoff_verified', read(PREVIOUS_DOC).includes(ACCEPTANCE), { PREVIOUS_DOC });
  const doc = read(CURRENT_DOC);
  assert('current_doc_has_gate', doc.includes(ACCEPTANCE), { ACCEPTANCE });
  assert('current_doc_has_next_step', doc.includes(NEXT_STEP), { NEXT_STEP });
  const sourcePriority = section(doc, 'Source priority');
  const sourceKinds = section(doc, 'Real evidence source kinds');
  const excludedSources = section(doc, 'Forbidden sources');
  const adapterFields = section(doc, 'Adapter output fields');
  const queryRules = section(doc, 'Read-only query rules');
  const traceability = section(doc, 'Source traceability rules');
  const noSchemaSeed = section(doc, 'No schema or seed changes');
  const next = section(doc, 'Next step');
  assert('source_priority_count', sourcePriority.length === 3, { sourcePriority });
  assert('primary_source_raw_samples', sourcePriority.includes('primary_source = raw_samples'), { sourcePriority });
  assert('real_evidence_source_kind_count', sourceKinds.length === 3, { sourceKinds });
  assert('forbidden_source_count', excludedSources.length === 4, { excludedSources });
  assert('required_field_count', adapterFields.length === 11, { adapterFields });
  assert('read_only_query_rule_count', queryRules.length === 10, { queryRules });
  assert('source_traceability_rule_count', traceability.length === 6, { traceability });
  assert('no_db_schema_change', noSchemaSeed.includes('no_db_schema_change = true'), { noSchemaSeed });
  assert('no_seed_change', noSchemaSeed.includes('no_seed_change = true'), { noSchemaSeed });
  assert('next_step_verified', next.length === 1 && next[0] === NEXT_STEP, { next });
  return { real_evidence_source_kind_count: sourceKinds.length, required_field_count: adapterFields.length, forbidden_source_count: excludedSources.length, read_only_query_rule_count: queryRules.length, source_traceability_rule_count: traceability.length, no_db_schema_change: true, no_seed_change: true };
}

function verifyChangedFiles() {
  const changedFiles = changedFilesFromMain();
  const scoped = changedFiles.filter((file) => P8_01_FILES.includes(file));
  if (changedFiles.length > 0) assert('p8_01_files_present', scoped.length === P8_01_FILES.length, { scoped, changedFiles });
  return { changedFiles, scoped };
}

try {
  const counts = verifyDoc();
  const changed = verifyChangedFiles();
  console.log(JSON.stringify({ ok: true, acceptance: ACCEPTANCE, p8_00_verified: true, ...counts, changed_file_count: changed.scoped.length, branch_changed_file_count: changed.changedFiles.length, changed_files: changed.scoped, ...summary(), next_step: NEXT_STEP }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
