// scripts/governance_acceptance/P3_OPERATOR_UX_REFINEMENT_PLANNING.cjs
// Purpose: verify that P3 starts as operator UX planning only.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P3_OPERATOR_UX_REFINEMENT_PLANNING';
const NEXT_STEP = 'P3_01_OPERATOR_WORKFLOW_SURFACE_INVENTORY';

const FILES = {
  p2ReviewDoc: 'docs/tasks/P2-Completion-Review-Before-P3.md',
  p2ReviewAcceptance: 'scripts/governance_acceptance/P2_COMPLETION_REVIEW_BEFORE_P3.cjs',
  p3PlanningDoc: 'docs/tasks/P3-Operator-UX-Refinement-Planning.md',
};

const ALLOWED_CHANGED_FILES = [
  'docs/tasks/P3-Operator-UX-Refinement-Planning.md',
  'scripts/governance_acceptance/P3_OPERATOR_UX_REFINEMENT_PLANNING.cjs',
];

const P3_TASKS = [
  'P3-00 Operator UX Refinement Planning',
  'P3-01 Operator Workflow Surface Inventory',
  'P3-02 Operator Preflight Read Model Planning',
  'P3-03 Operator Gate Read Model Planning',
  'P3-04 Dry Run Report Read Model Planning',
  'P3-05 Operator Audit Trail Planning',
  'P3-06 Operator UX Negative Boundary Matrix',
  'P3-07 Operator UX Completion Review Before P4',
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

function tagExists(tag) {
  try {
    childProcess.execFileSync('git', ['rev-parse', '--verify', `refs/tags/${tag}`], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function changedFilesFromMain() {
  try {
    return git(['diff', '--name-only', 'main...HEAD']).split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
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

  const p2ReviewDoc = read(FILES.p2ReviewDoc);
  const p2ReviewAcceptance = read(FILES.p2ReviewAcceptance);
  const p3Doc = read(FILES.p3PlanningDoc);

  assert('p2_completion_tag_exists', tagExists('p2_completion_review_before_p3'), { tag: 'p2_completion_review_before_p3' });
  assert('p2_completion_review_verified', containsAll(p2ReviewDoc, ['P2_COMPLETION_REVIEW_BEFORE_P3', 'P3_OPERATOR_UX_REFINEMENT_PLANNING']) && containsAll(p2ReviewAcceptance, ['P2_COMPLETION_REVIEW_BEFORE_P3', 'P3_OPERATOR_UX_REFINEMENT_PLANNING']), { files: [FILES.p2ReviewDoc, FILES.p2ReviewAcceptance] });

  assert('p3_planning_doc_identity_verified', containsAll(p3Doc, ['P3_OPERATOR_UX_REFINEMENT_PLANNING', 'P3 begins as Operator UX Refinement Planning', 'Planning problem', 'P3 task line', 'Planning boundary ledger', NEXT_STEP]), { file: FILES.p3PlanningDoc });

  for (const task of P3_TASKS) {
    assert(`p3_task_declared:${task}`, p3Doc.includes(task), { task });
  }

  assert('p3_invariants_verified', containsAll(p3Doc, ['read_only_first = true', 'evidence_refs_required = true', 'trace_pointers_required = true', 'operator_gate_visible = true', 'dry_run_report_visible = true', 'new_judgment_semantics = false']), { file: FILES.p3PlanningDoc });

  assert('p3_planning_boundary_verified', containsAll(p3Doc, ['frontend_changed_by_this_task = false', 'runtime_changed_by_this_task = false', 'route_changed_by_this_task = false', 'db_changed_by_this_task = false', 'scheduler_changed_by_this_task = false', 'model_changed_by_this_task = false', 'live_operation_authorized_by_this_task = false']), { file: FILES.p3PlanningDoc });

  const changedFiles = changedFilesFromMain();
  const changedSet = new Set(changedFiles);
  assert('changed_file_count_verified', changedFiles.length === ALLOWED_CHANGED_FILES.length, { changedFiles, allowed: ALLOWED_CHANGED_FILES });
  for (const file of ALLOWED_CHANGED_FILES) {
    assert(`allowed_changed_file_present:${file}`, changedSet.has(file), { file, changedFiles });
  }
  for (const file of changedFiles) {
    assert(`changed_file_allowed:${file}`, ALLOWED_CHANGED_FILES.includes(file), { file, allowed: ALLOWED_CHANGED_FILES });
  }

  assert('no_frontend_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/web/')), { changedFiles });
  assert('no_runtime_changed_by_this_task', changedFiles.every((file) => !file.startsWith('apps/server/') && !file.startsWith('apps/executor/') && !file.startsWith('packages/contracts/')), { changedFiles });
  assert('no_db_changed_by_this_task', changedFiles.every((file) => !file.includes('/db/') && !file.includes('migration')), { changedFiles });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    p2_completion_verified: true,
    p3_task_count: P3_TASKS.length,
    p3_started_as_planning_only: true,
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
