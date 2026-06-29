// scripts/governance_acceptance/P3_02_OPERATOR_PREFLIGHT_READ_MODEL_PLANNING.cjs
// Purpose: verify that P3-02 defines a read-only operator preflight read model planning contract.
// Boundary: static governance acceptance only; this script reads repository files and local git diff metadata.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P3_02_OPERATOR_PREFLIGHT_READ_MODEL_PLANNING';
const NEXT_STEP = 'P3_03_OPERATOR_GATE_READ_MODEL_PLANNING';

const FILES = {
  p301Doc: 'docs/tasks/P3-01-Operator-Workflow-Surface-Inventory.md',
  p301Acceptance: 'scripts/governance_acceptance/P3_01_OPERATOR_WORKFLOW_SURFACE_INVENTORY.cjs',
  p302Doc: 'docs/tasks/P3-02-Operator-Preflight-Read-Model-Planning.md',
};

const ALLOWED_CHANGED_FILES = [
  'docs/tasks/P3-02-Operator-Preflight-Read-Model-Planning.md',
  'scripts/governance_acceptance/P3_02_OPERATOR_PREFLIGHT_READ_MODEL_PLANNING.cjs',
];

const INPUT_REFS = [
  'adapter_capability_manifest_ref',
  'adapter_registry_audit_ref',
  'negative_runtime_matrix_ref',
  'sandbox_harness_ref',
  'operator_gate_schema_ref',
  'dry_run_harness_ref',
  'operation_plan_ref',
  'act_task_ref',
];

const REQUIRED_OUTPUT_FIELDS = [
  'preflight_ref',
  'scope_ref',
  'adapter_type',
  'action_type',
  'operator_gate_required',
  'matrix_preflight_required',
  'sandbox_ack_required',
  'input_refs',
  'evidence_refs',
  'trace_refs',
  'checked_at',
  'read_model_version',
];

const ALLOWED_STATES = [
  'NOT_EVALUATED',
  'READY_FOR_OPERATOR_REVIEW',
  'BLOCKED_MISSING_REFERENCE',
  'BLOCKED_SCHEMA_MISMATCH',
  'BLOCKED_MATRIX_FAILURE',
  'BLOCKED_SANDBOX_FAILURE',
];

const EXCLUDED_SEMANTICS = [
  'risk_score',
  'priority_score',
  'recommendation',
  'prescription',
  'approval_default',
  'auto_submit',
  'auto_dispatch',
  'success_prediction',
  'profit_prediction',
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

  const p301Doc = read(FILES.p301Doc);
  const p301Acceptance = read(FILES.p301Acceptance);
  const p302Doc = read(FILES.p302Doc);

  assert('p3_01_verified', containsAll(p301Doc, ['P3_01_OPERATOR_WORKFLOW_SURFACE_INVENTORY', 'P3_02_OPERATOR_PREFLIGHT_READ_MODEL_PLANNING']) && containsAll(p301Acceptance, ['P3_01_OPERATOR_WORKFLOW_SURFACE_INVENTORY', 'P3_02_OPERATOR_PREFLIGHT_READ_MODEL_PLANNING']), { files: [FILES.p301Doc, FILES.p301Acceptance] });

  assert('p302_doc_identity_verified', containsAll(p302Doc, [ACCEPTANCE, 'operator_preflight_read_model_v0', 'Input references', 'Required output fields', 'Allowed state vocabulary', 'Boundary ledger', NEXT_STEP]), { file: FILES.p302Doc });

  assert('read_model_identity_verified', containsAll(p302Doc, ['read_model_id: operator_preflight_read_model_v0', 'read_model_kind: planning_contract', 'surface_ref: preflight_status_panel', 'mode: read_only', 'status: candidate']), { file: FILES.p302Doc });

  for (const ref of INPUT_REFS) {
    assert(`input_ref_declared:${ref}`, p302Doc.includes(ref), { ref });
  }

  for (const field of REQUIRED_OUTPUT_FIELDS) {
    assert(`required_output_field_declared:${field}`, p302Doc.includes(field), { field });
  }

  for (const state of ALLOWED_STATES) {
    assert(`allowed_state_declared:${state}`, p302Doc.includes(state), { state });
  }

  for (const token of EXCLUDED_SEMANTICS) {
    assert(`excluded_semantic_recorded:${token}`, p302Doc.includes(token), { token });
  }

  assert('preflight_read_model_verified', INPUT_REFS.every((token) => p302Doc.includes(token)) && REQUIRED_OUTPUT_FIELDS.every((token) => p302Doc.includes(token)) && ALLOWED_STATES.every((token) => p302Doc.includes(token)), { file: FILES.p302Doc });

  assert('boundary_ledger_verified', containsAll(p302Doc, ['read_only_projection = true', 'operator_visible = true', 'evidence_refs_required = true', 'trace_refs_required = true', 'creates_fact = false', 'creates_task = false', 'creates_receipt = false', 'creates_acceptance = false', 'creates_roi = false', 'creates_field_memory = false', 'starts_adapter = false', 'updates_model = false']), { file: FILES.p302Doc });

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
    p3_01_verified: true,
    preflight_read_model_verified: true,
    input_ref_count: INPUT_REFS.length,
    required_output_field_count: REQUIRED_OUTPUT_FIELDS.length,
    allowed_state_count: ALLOWED_STATES.length,
    p3_02_started_as_planning_only: true,
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
