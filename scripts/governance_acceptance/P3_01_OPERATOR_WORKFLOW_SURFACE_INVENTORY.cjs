// scripts/governance_acceptance/P3_01_OPERATOR_WORKFLOW_SURFACE_INVENTORY.cjs
// Purpose: verify that P3-01 is an operator workflow surface inventory only.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P3_01_OPERATOR_WORKFLOW_SURFACE_INVENTORY';
const NEXT_STEP = 'P3_02_OPERATOR_PREFLIGHT_READ_MODEL_PLANNING';

const FILES = {
  p3PlanningDoc: 'docs/tasks/P3-Operator-UX-Refinement-Planning.md',
  p3PlanningAcceptance: 'scripts/governance_acceptance/P3_OPERATOR_UX_REFINEMENT_PLANNING.cjs',
  p301Doc: 'docs/tasks/P3-01-Operator-Workflow-Surface-Inventory.md',
};

const ALLOWED_CHANGED_FILES = [
  'docs/tasks/P3-01-Operator-Workflow-Surface-Inventory.md',
  'scripts/governance_acceptance/P3_01_OPERATOR_WORKFLOW_SURFACE_INVENTORY.cjs',
];

const SURFACES = [
  'operator_workflow_index',
  'preflight_status_panel',
  'operator_gate_panel',
  'dry_run_report_panel',
  'trace_pointer_panel',
  'audit_trail_panel',
];

const REQUIRED_SURFACE_TOKENS = [
  'surface_id:',
  'surface_kind:',
  'status: candidate',
  'primary_use:',
  'input_refs:',
  'output_shape:',
  'required_fields:',
  'boundary:',
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

function sectionForSurface(doc, surface) {
  const start = doc.indexOf(`surface_id: ${surface}`);
  if (start < 0) return '';
  const next = doc.indexOf('\n### ', start + surface.length);
  return next < 0 ? doc.slice(start) : doc.slice(start, next);
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

  const p3PlanningDoc = read(FILES.p3PlanningDoc);
  const p3PlanningAcceptance = read(FILES.p3PlanningAcceptance);
  const p301Doc = read(FILES.p301Doc);

  assert('p3_planning_verified', containsAll(p3PlanningDoc, ['P3_OPERATOR_UX_REFINEMENT_PLANNING', 'P3_01_OPERATOR_WORKFLOW_SURFACE_INVENTORY']) && containsAll(p3PlanningAcceptance, ['P3_OPERATOR_UX_REFINEMENT_PLANNING', 'P3_01_OPERATOR_WORKFLOW_SURFACE_INVENTORY']), { files: [FILES.p3PlanningDoc, FILES.p3PlanningAcceptance] });

  assert('p301_doc_identity_verified', containsAll(p301Doc, [ACCEPTANCE, 'P3-01 records the operator workflow surface inventory.', 'Candidate surfaces', 'Inventory invariants', 'Planning boundary ledger', NEXT_STEP]), { file: FILES.p301Doc });

  for (const surface of SURFACES) {
    const section = sectionForSurface(p301Doc, surface);
    assert(`surface_declared:${surface}`, section.length > 0, { surface });
    assert(`surface_tokens_verified:${surface}`, containsAll(section, REQUIRED_SURFACE_TOKENS), { surface, section });
    assert(`surface_requires_refs:${surface}`, section.includes('input_refs:') && section.includes('trace') && section.includes('boundary:'), { surface, section });
  }

  assert('surface_inventory_verified', SURFACES.every((surface) => p301Doc.includes(`surface_id: ${surface}`)), { surfaces: SURFACES });
  assert('inventory_invariants_verified', containsAll(p301Doc, ['surface_count = 6', 'read_only_inventory = true', 'evidence_refs_required = true', 'trace_refs_required = true', 'pointer_first = true', 'operator_gate_visible = true', 'dry_run_report_visible = true', 'new_judgment_semantics = false']), { file: FILES.p301Doc });
  assert('planning_boundary_verified', containsAll(p301Doc, ['frontend_changed_by_this_task = false', 'runtime_changed_by_this_task = false', 'route_changed_by_this_task = false', 'db_changed_by_this_task = false', 'scheduler_changed_by_this_task = false', 'model_changed_by_this_task = false', 'live_operation_authorized_by_this_task = false']), { file: FILES.p301Doc });

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
    p3_planning_verified: true,
    surface_inventory_verified: true,
    surface_count: SURFACES.length,
    p3_01_started_as_inventory_only: true,
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
