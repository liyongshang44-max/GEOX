// scripts/governance_acceptance/P3_07_OPERATOR_UX_COMPLETION_REVIEW_BEFORE_P4.cjs
// Purpose: verify that P3 Operator UX planning is complete before P4.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P3_07_OPERATOR_UX_COMPLETION_REVIEW_BEFORE_P4';
const NEXT_STAGE = 'P4';
const TAG = 'p3_operator_ux_completion_before_p4';
const DOC = 'docs/tasks/P3-07-Operator-UX-Completion-Review-Before-P4.md';

const FILES = {
  previousDoc: 'docs/tasks/P3-06-Operator-UX-Negative-Boundary-Matrix.md',
  previousAcceptance: 'scripts/governance_acceptance/P3_06_OPERATOR_UX_NEGATIVE_BOUNDARY_MATRIX.cjs',
  currentDoc: DOC,
};

const ALLOWED_CHANGED_FILES = [
  DOC,
  'scripts/governance_acceptance/P3_07_OPERATOR_UX_COMPLETION_REVIEW_BEFORE_P4.cjs',
];

const REQUIRED_ARTIFACTS = [
  'docs/tasks/P3-Operator-UX-Refinement-Planning.md',
  'scripts/governance_acceptance/P3_OPERATOR_UX_REFINEMENT_PLANNING.cjs',
  'docs/tasks/P3-01-Operator-Workflow-Surface-Inventory.md',
  'scripts/governance_acceptance/P3_01_OPERATOR_WORKFLOW_SURFACE_INVENTORY.cjs',
  'docs/tasks/P3-02-Operator-Preflight-Read-Model-Planning.md',
  'scripts/governance_acceptance/P3_02_OPERATOR_PREFLIGHT_READ_MODEL_PLANNING.cjs',
  'docs/tasks/P3-03-Operator-Gate-Read-Model-Planning.md',
  'scripts/governance_acceptance/P3_03_OPERATOR_GATE_READ_MODEL_PLANNING.cjs',
  'docs/tasks/P3-04-Dry-Run-Report-Read-Model-Planning.md',
  'scripts/governance_acceptance/P3_04_DRY_RUN_REPORT_READ_MODEL_PLANNING.cjs',
  'docs/tasks/P3-05-Operator-Audit-Trail-Planning.md',
  'scripts/governance_acceptance/P3_05_OPERATOR_AUDIT_TRAIL_PLANNING.cjs',
  'docs/tasks/P3-06-Operator-UX-Negative-Boundary-Matrix.md',
  'scripts/governance_acceptance/P3_06_OPERATOR_UX_NEGATIVE_BOUNDARY_MATRIX.cjs',
  DOC,
  'scripts/governance_acceptance/P3_07_OPERATOR_UX_COMPLETION_REVIEW_BEFORE_P4.cjs',
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

  for (const file of REQUIRED_ARTIFACTS) {
    assert(`required_artifact_exists:${file}`, exists(file), { file });
  }

  const previousDoc = read(FILES.previousDoc);
  const previousAcceptance = read(FILES.previousAcceptance);
  const doc = read(FILES.currentDoc);

  assert('p3_06_verified', containsAll(previousDoc, ['P3_06_OPERATOR_UX_NEGATIVE_BOUNDARY_MATRIX', ACCEPTANCE]) && containsAll(previousAcceptance, ['P3_06_OPERATOR_UX_NEGATIVE_BOUNDARY_MATRIX', ACCEPTANCE]), { files: [FILES.previousDoc, FILES.previousAcceptance] });

  assert('document_identity_verified', containsAll(doc, [ACCEPTANCE, 'Operator UX Completion Review Before P4', 'Completed P3 task ledger', 'Required P3 artifacts', 'P3 surface ledger', 'P3 read model ledger', 'P3 completion boundaries', 'Handoff to P4']), { file: DOC });

  const completedTasks = fencedSectionLines(doc, 'Completed P3 task ledger');
  const requiredArtifacts = fencedSectionLines(doc, 'Required P3 artifacts');
  const surfaces = fencedSectionLines(doc, 'P3 surface ledger');
  const readModels = fencedSectionLines(doc, 'P3 read model ledger');
  const boundaries = fencedSectionLines(doc, 'P3 completion boundaries');
  const handoff = fencedSectionLines(doc, 'Handoff to P4');

  assert('completed_task_count_verified', completedTasks.length === 8, { completedTasks });
  assert('required_artifact_count_verified', requiredArtifacts.length === REQUIRED_ARTIFACTS.length, { requiredArtifacts });
  assert('surface_count_verified', surfaces.length === 6, { surfaces });
  assert('read_model_count_verified', readModels.length === 4, { readModels });
  assert('completion_boundaries_verified', boundaries.includes('p3_completed_as_planning_only = true') && boundaries.includes('read_only_projection_boundary_preserved = true') && boundaries.includes('frontend_changed_by_p3_completion = false') && boundaries.includes('runtime_changed_by_p3_completion = false') && boundaries.includes('db_changed_by_p3_completion = false'), { boundaries });
  assert('handoff_verified', handoff.includes('p4_entry_allowed_after_p3_completion = true') && handoff.includes(`recommended_completion_tag: ${TAG}`) && handoff.includes(`next_stage: ${NEXT_STAGE}`), { handoff });

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
    p3_06_verified: true,
    p3_completion_verified: true,
    completed_task_count: completedTasks.length,
    required_artifact_count: requiredArtifacts.length,
    surface_count: surfaces.length,
    read_model_count: readModels.length,
    p3_07_started_as_planning_only: true,
    no_frontend_changed_by_this_task: true,
    no_runtime_changed_by_this_task: true,
    no_db_changed_by_this_task: true,
    changed_file_count: changedFiles.length,
    changed_files: changedFiles,
    ...assertionSummary(),
    next_stage: NEXT_STAGE,
    recommended_completion_tag: TAG,
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
