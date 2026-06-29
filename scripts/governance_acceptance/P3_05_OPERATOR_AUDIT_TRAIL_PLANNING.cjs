// scripts/governance_acceptance/P3_05_OPERATOR_AUDIT_TRAIL_PLANNING.cjs
// Purpose: verify that P3-05 defines a read-only operator audit trail planning contract.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P3_05_OPERATOR_AUDIT_TRAIL_PLANNING';
const NEXT_STEP = 'P3_06_OPERATOR_UX_NEGATIVE_BOUNDARY_MATRIX';
const DOC = 'docs/tasks/P3-05-Operator-Audit-Trail-Planning.md';

const FILES = {
  previousDoc: 'docs/tasks/P3-04-Dry-Run-Report-Read-Model-Planning.md',
  previousAcceptance: 'scripts/governance_acceptance/P3_04_DRY_RUN_REPORT_READ_MODEL_PLANNING.cjs',
  currentDoc: DOC,
};

const ALLOWED_CHANGED_FILES = [
  DOC,
  'scripts/governance_acceptance/P3_05_OPERATOR_AUDIT_TRAIL_PLANNING.cjs',
];

const assertions = [];

function abs(file) {
  return path.resolve(ROOT, file);
}

function read(file) {
  return fs.readFileSync(abs(file), 'utf8');
}

function exists(file) {
  return fs.existsSync(abs(file));
}

function containsAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function git(args) {
  return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function changedFilesFromMain() {
  try {
    return git(['diff', '--name-only', 'main...HEAD']).split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function fencedSectionLines(text, heading) {
  const marker = `## ${heading}`;
  const start = text.indexOf(marker);
  if (start < 0) return [];
  const open = text.indexOf('```text', start);
  if (open < 0) return [];
  const bodyStart = text.indexOf('\n', open) + 1;
  const close = text.indexOf('```', bodyStart);
  if (close < 0) return [];
  return text.slice(bodyStart, close).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function assert(name, condition, details = {}) {
  const passed = condition === true;
  assertions.push({ name, passed, details });
  if (!passed) {
    const error = new Error(`ASSERTION_FAILED:${name}`);
    error.details = details;
    throw error;
  }
}

function assertionSummary() {
  const failed = assertions.filter((item) => item.passed !== true);
  return {
    assertion_count: assertions.length,
    failed_assertion_count: failed.length,
    failed_assertions: failed.map((item) => item.name),
  };
}

function main() {
  for (const [name, file] of Object.entries(FILES)) {
    assert(`${name}_exists`, exists(file), { file });
  }

  const previousDoc = read(FILES.previousDoc);
  const previousAcceptance = read(FILES.previousAcceptance);
  const doc = read(FILES.currentDoc);

  assert('previous_step_verified', containsAll(previousDoc, ['P3_04_DRY_RUN_REPORT_READ_MODEL_PLANNING', ACCEPTANCE]) && containsAll(previousAcceptance, ['P3_04_DRY_RUN_REPORT_READ_MODEL_PLANNING', ACCEPTANCE]), { files: [FILES.previousDoc, FILES.previousAcceptance] });

  assert('document_identity_verified', containsAll(doc, [ACCEPTANCE, 'operator_audit_trail_read_model_v0', 'Input references', 'Required output fields', 'Allowed event vocabulary', 'Display order rule', 'Boundary ledger', NEXT_STEP]), { file: DOC });

  assert('read_model_identity_verified', containsAll(doc, ['read_model_id: operator_audit_trail_read_model_v0', 'read_model_kind: planning_contract', 'surface_ref: audit_trail_panel', 'mode: read_only', 'status: candidate']), { file: DOC });

  const inputRefs = fencedSectionLines(doc, 'Input references');
  const outputFields = fencedSectionLines(doc, 'Required output fields');
  const eventTypes = fencedSectionLines(doc, 'Allowed event vocabulary');
  const orderRule = fencedSectionLines(doc, 'Display order rule');
  const boundary = fencedSectionLines(doc, 'Boundary ledger');

  assert('input_ref_count_verified', inputRefs.length === 8, { inputRefs });
  assert('required_output_field_count_verified', outputFields.length === 17, { outputFields });
  assert('allowed_event_count_verified', eventTypes.length === 8, { eventTypes });
  assert('order_rule_verified', orderRule.includes('primary_order = occurred_at ascending') && orderRule.includes('secondary_order = event_ref ascending') && orderRule.includes('hidden_ordering_rule = false'), { orderRule });
  assert('boundary_count_verified', boundary.length >= 12, { boundary });
  assert('boundary_read_only_verified', boundary.includes('read_only_projection = true') && boundary.includes('operator_visible = true') && boundary.includes('chronological_only = true') && boundary.includes('starts_adapter = false') && boundary.includes('updates_model = false'), { boundary });

  const changedFiles = changedFilesFromMain();
  const changedSet = new Set(changedFiles);
  assert('changed_file_count_verified', changedFiles.length === ALLOWED_CHANGED_FILES.length, { changedFiles, allowed: ALLOWED_CHANGED_FILES });
  for (const file of ALLOWED_CHANGED_FILES) assert(`allowed_changed_file_present:${file}`, changedSet.has(file), { file, changedFiles });
  for (const file of changedFiles) assert(`changed_file_allowed:${file}`, ALLOWED_CHANGED_FILES.includes(file), { file, allowed: ALLOWED_CHANGED_FILES });

  assert('no_frontend_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/web/')), { changedFiles });
  assert('no_runtime_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/server/') && !file.startsWith('apps/executor/') && !file.startsWith('packages/contracts/')), { changedFiles });
  assert('no_db_changed_by_this_task', changedFiles.every((file) => !file.includes('/db/') && !file.includes('migration')), { changedFiles });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    p3_04_verified: true,
    operator_audit_trail_verified: true,
    input_ref_count: inputRefs.length,
    required_output_field_count: outputFields.length,
    allowed_event_count: eventTypes.length,
    p3_05_started_as_planning_only: true,
    no_frontend_changed_by_this_task: true,
    no_runtime_changed_by_this_task: true,
    no_db_changed_by_this_task: true,
    changed_file_count: changedFiles.length,
    changed_files: changedFiles,
    ...assertionSummary(),
    next_step: NEXT_STEP,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: ACCEPTANCE,
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
