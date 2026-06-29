// scripts/governance_acceptance/P2_COMPLETION_REVIEW_BEFORE_P3.cjs
// Purpose: verify that P2 is complete before P3 planning begins.
// Boundary: static governance acceptance only; this script reads repository files and local git tags.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'P2_COMPLETION_REVIEW_BEFORE_P3';

const REVIEW_DOC = 'docs/tasks/P2-Completion-Review-Before-P3.md';

const P2_TASKS = [
  {
    id: 'P2-00',
    name: 'Real Adapter Integration Planning and Boundary Inventory',
    tag: 'p2_real_adapter_integration_planning',
    doc: 'docs/tasks/P2-Real-Adapter-Integration-Planning.md',
    acceptance: 'scripts/governance_acceptance/P2_REAL_ADAPTER_INTEGRATION_PLANNING.cjs',
    acceptanceName: 'P2_REAL_ADAPTER_INTEGRATION_PLANNING',
    nextStep: 'P2_01_ADAPTER_CONTRACT_RECONCILIATION',
  },
  {
    id: 'P2-01',
    name: 'Adapter Contract Reconciliation',
    tag: 'p2_01_adapter_contract_reconciliation',
    doc: 'docs/tasks/P2-01-Adapter-Contract-Reconciliation.md',
    acceptance: 'scripts/governance_acceptance/P2_01_ADAPTER_CONTRACT_RECONCILIATION.cjs',
    acceptanceName: 'P2_01_ADAPTER_CONTRACT_RECONCILIATION',
    nextStep: 'P2_02_ADAPTER_CAPABILITY_MANIFEST_AND_REGISTRY_AUDIT',
  },
  {
    id: 'P2-02',
    name: 'Adapter Capability Manifest and Registry Audit',
    tag: 'p2_02_adapter_capability_manifest_registry_audit',
    doc: 'docs/tasks/P2-02-Adapter-Capability-Manifest-and-Registry-Audit.md',
    acceptance: 'scripts/governance_acceptance/P2_02_ADAPTER_CAPABILITY_MANIFEST_AND_REGISTRY_AUDIT.cjs',
    acceptanceName: 'P2_02_ADAPTER_CAPABILITY_MANIFEST_AND_REGISTRY_AUDIT',
    nextStep: 'P2_03_SAFE_REAL_ADAPTER_SANDBOX_HARNESS',
  },
  {
    id: 'P2-03',
    name: 'Safe Real Adapter Sandbox Harness',
    tag: 'p2_03_safe_real_adapter_sandbox_harness',
    doc: 'docs/tasks/P2-03-Safe-Real-Adapter-Sandbox-Harness.md',
    acceptance: 'scripts/governance_acceptance/P2_03_SAFE_REAL_ADAPTER_SANDBOX_HARNESS.cjs',
    acceptanceName: 'P2_03_SAFE_REAL_ADAPTER_SANDBOX_HARNESS',
    nextStep: 'P2_04_PRODUCTION_INGESTION_ADAPTER_BOUNDARY',
  },
  {
    id: 'P2-04',
    name: 'Production Ingestion Adapter Boundary',
    tag: 'p2_04_production_ingestion_adapter_boundary',
    doc: 'docs/tasks/P2-04-Production-Ingestion-Adapter-Boundary.md',
    acceptance: 'scripts/governance_acceptance/P2_04_PRODUCTION_INGESTION_ADAPTER_BOUNDARY.cjs',
    acceptanceName: 'P2_04_PRODUCTION_INGESTION_ADAPTER_BOUNDARY',
    nextStep: 'P2_05_REAL_ADAPTER_NEGATIVE_RUNTIME_MATRIX',
  },
  {
    id: 'P2-05',
    name: 'Real Adapter Negative Runtime Matrix',
    tag: 'p2_05_real_adapter_negative_runtime_matrix',
    doc: 'docs/tasks/P2-05-Real-Adapter-Negative-Runtime-Matrix.md',
    acceptance: 'scripts/governance_acceptance/P2_05_REAL_ADAPTER_NEGATIVE_RUNTIME_MATRIX.cjs',
    acceptanceName: 'P2_05_REAL_ADAPTER_NEGATIVE_RUNTIME_MATRIX',
    nextStep: 'P2_06_OPERATOR_CONTROLLED_PILOT_DRY_RUN',
  },
  {
    id: 'P2-06',
    name: 'Operator-Controlled Pilot Dry Run',
    tag: 'p2_06_operator_controlled_pilot_dry_run',
    doc: 'docs/tasks/P2-06-Operator-Controlled-Pilot-Dry-Run.md',
    acceptance: 'scripts/governance_acceptance/P2_06_OPERATOR_CONTROLLED_PILOT_DRY_RUN.cjs',
    acceptanceName: 'P2_06_OPERATOR_CONTROLLED_PILOT_DRY_RUN',
    nextStep: 'P2_COMPLETION_REVIEW_BEFORE_P3',
  },
];

const P3_NEXT_STEP = 'P3_OPERATOR_UX_REFINEMENT_PLANNING';
const P3_FILES_THAT_MUST_NOT_EXIST = [
  'docs/tasks/P3-Operator-UX-Refinement-Planning.md',
  'scripts/governance_acceptance/P3_OPERATOR_UX_REFINEMENT_PLANNING.cjs',
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

function tagExists(tag) {
  try {
    childProcess.execFileSync('git', ['rev-parse', '--verify', `refs/tags/${tag}`], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
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
  assert('review_doc_exists', exists(REVIEW_DOC), { file: REVIEW_DOC });
  const reviewDoc = read(REVIEW_DOC);

  assert('review_doc_declares_gate', containsAll(reviewDoc, [ACCEPTANCE, 'Completed P2 task line', 'Required P2 tags', 'Required P2 task documents', 'Required P2 acceptance scripts', P3_NEXT_STEP]), { file: REVIEW_DOC });
  assert('review_scope_limited', containsAll(reviewDoc, ['Review scope', REVIEW_DOC, 'scripts/governance_acceptance/P2_COMPLETION_REVIEW_BEFORE_P3.cjs', 'It does not change runtime behavior.']), { file: REVIEW_DOC });
  assert('review_boundary_ledger_present', containsAll(reviewDoc, ['preparation_phase_only = true', 'live_adapter_operation_authorized = false', 'broker_operation_authorized = false', 'runtime_route_change = false', 'db_schema_change = false', 'ui_change = false', 'autonomous_execution_authorized = false', 'model_update_authorized = false']), { file: REVIEW_DOC });

  for (const task of P2_TASKS) {
    assert(`p2_task_doc_exists:${task.id}`, exists(task.doc), { doc: task.doc });
    assert(`p2_acceptance_script_exists:${task.id}`, exists(task.acceptance), { acceptance: task.acceptance });
    assert(`p2_tag_exists:${task.id}`, tagExists(task.tag), { tag: task.tag });

    const doc = read(task.doc);
    const acceptance = read(task.acceptance);
    assert(`p2_doc_listed_in_review:${task.id}`, reviewDoc.includes(task.doc) && reviewDoc.includes(task.name), { doc: task.doc, name: task.name });
    assert(`p2_acceptance_listed_in_review:${task.id}`, reviewDoc.includes(task.acceptance), { acceptance: task.acceptance });
    assert(`p2_tag_listed_in_review:${task.id}`, reviewDoc.includes(task.tag), { tag: task.tag });
    assert(`p2_doc_identity_verified:${task.id}`, doc.includes(task.name) || doc.includes(task.id), { doc: task.doc });
    assert(`p2_acceptance_identity_verified:${task.id}`, acceptance.includes(task.acceptanceName) && acceptance.includes(task.nextStep), { acceptance: task.acceptance, expectedAcceptance: task.acceptanceName, expectedNextStep: task.nextStep });
  }

  for (const file of P3_FILES_THAT_MUST_NOT_EXIST) {
    assert(`p3_file_not_started:${file}`, !exists(file), { file });
  }

  assert('p2_review_next_step_verified', reviewDoc.includes('next_step = P3_OPERATOR_UX_REFINEMENT_PLANNING') && reviewDoc.includes('p3_authorized_after_review = true') && reviewDoc.includes('p3_not_started_by_this_review = true'), { file: REVIEW_DOC });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    p2_task_count: P2_TASKS.length,
    p2_task_doc_count: P2_TASKS.length,
    p2_acceptance_script_count: P2_TASKS.length,
    p2_tag_count: P2_TASKS.length,
    p2_completed: true,
    p3_authorized_after_review: true,
    p3_not_started_by_this_review: true,
    ...assertionSummary(),
    next_step: P3_NEXT_STEP,
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
