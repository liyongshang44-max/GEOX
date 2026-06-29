// scripts/governance_acceptance/P3_06_OPERATOR_UX_NEGATIVE_BOUNDARY_MATRIX.cjs
// Purpose: verify that P3-06 defines the operator UX negative boundary matrix as a planning-only artifact.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P3_06_OPERATOR_UX_NEGATIVE_BOUNDARY_MATRIX';
const NEXT_STEP = 'P3_07_OPERATOR_UX_COMPLETION_REVIEW_BEFORE_P4';
const DOC = 'docs/tasks/P3-06-Operator-UX-Negative-Boundary-Matrix.md';

const FILES = {
  previousDoc: 'docs/tasks/P3-05-Operator-Audit-Trail-Planning.md',
  previousAcceptance: 'scripts/governance_acceptance/P3_05_OPERATOR_AUDIT_TRAIL_PLANNING.cjs',
  currentDoc: DOC,
};

const ALLOWED_CHANGED_FILES = [
  DOC,
  'scripts/governance_acceptance/P3_06_OPERATOR_UX_NEGATIVE_BOUNDARY_MATRIX.cjs',
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

  assert('previous_step_verified', containsAll(previousDoc, ['P3_05_OPERATOR_AUDIT_TRAIL_PLANNING', ACCEPTANCE]) && containsAll(previousAcceptance, ['P3_05_OPERATOR_AUDIT_TRAIL_PLANNING', ACCEPTANCE]), { files: [FILES.previousDoc, FILES.previousAcceptance] });

  assert('document_identity_verified', containsAll(doc, [ACCEPTANCE, 'Operator UX Negative Boundary Matrix', 'Covered surfaces', 'Matrix entries', 'Surface-to-matrix coverage', 'Planning boundary ledger', NEXT_STEP]), { file: DOC });

  const surfaces = fencedSectionLines(doc, 'Covered surfaces');
  const matrixEntries = fencedSectionLines(doc, 'Matrix entries');
  const positiveBoundaries = fencedSectionLines(doc, 'Required positive boundaries');
  const coverageRows = fencedSectionLines(doc, 'Surface-to-matrix coverage');
  const ledger = fencedSectionLines(doc, 'Planning boundary ledger');

  assert('surface_count_verified', surfaces.length === 6, { surfaces });
  assert('matrix_entry_count_verified', matrixEntries.length === 12, { matrixEntries });
  assert('coverage_row_count_verified', coverageRows.length === 6, { coverageRows });
  assert('positive_boundaries_verified', positiveBoundaries.includes('read_only_projection_required = true') && positiveBoundaries.includes('evidence_refs_required = true') && positiveBoundaries.includes('trace_refs_required = true') && positiveBoundaries.includes('pointer_first_required = true'), { positiveBoundaries });
  assert('planning_boundary_verified', ledger.includes('frontend_changed_by_this_task = false') && ledger.includes('runtime_changed_by_this_task = false') && ledger.includes('route_changed_by_this_task = false') && ledger.includes('db_changed_by_this_task = false') && ledger.includes('live_operation_authorized_by_this_task = false'), { ledger });

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
    p3_05_verified: true,
    operator_ux_negative_matrix_verified: true,
    surface_count: surfaces.length,
    matrix_entry_count: matrixEntries.length,
    coverage_row_count: coverageRows.length,
    p3_06_started_as_planning_only: true,
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
