// scripts/governance_acceptance/P1_COMPLETION_REVIEW_BEFORE_P2.cjs
// Purpose: verify the P1 Production Hardening completion-review ledger before P2 begins.
// Boundary: static governance acceptance only; this script does not call runtime routes, mutate DB state, create domain objects, dispatch tasks, create ROI, create Field Memory, or update models.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const ACCEPTANCE = 'P1_COMPLETION_REVIEW_BEFORE_P2';

const P1_TASKS = [
  {
    id: 'POSTV1-01',
    title: 'Production Hardening Baseline',
    doc: 'docs/tasks/POSTV1-01-Production-Hardening-Baseline.md',
    acceptance: 'scripts/governance_acceptance/POSTV1_01_PRODUCTION_HARDENING_BASELINE.cjs',
    requiredDocTokens: ['POSTV1-01', 'production hardening baseline', 'does not add runtime behavior'],
  },
  {
    id: 'POSTV1-02',
    title: 'Strong Multi-Scope Fixture Pack',
    doc: 'docs/tasks/POSTV1-02-Strong-Multi-Scope-Fixture-Pack.md',
    acceptance: 'scripts/governance_acceptance/POSTV1_02_STRONG_MULTI_SCOPE_FIXTURE_PACK.cjs',
    requiredDocTokens: ['POSTV1-02', 'strong multi-scope fixture coverage', 'at least six runtime cases'],
  },
  {
    id: 'POSTV1-03',
    title: 'Ingestion Idempotency & Error Taxonomy',
    doc: 'docs/tasks/POSTV1-03-Ingestion-Idempotency-Error-Taxonomy.md',
    acceptance: 'scripts/governance_acceptance/POSTV1_03_INGESTION_IDEMPOTENCY_ERROR_TAXONOMY.cjs',
    requiredDocTokens: ['POSTV1-03', 'idempotency', 'structured error'],
  },
  {
    id: 'POSTV1-04',
    title: 'Route Negative Runtime Matrix',
    doc: 'docs/tasks/POSTV1-04-Route-Negative-Runtime-Matrix.md',
    acceptance: 'scripts/governance_acceptance/POSTV1_04_ROUTE_NEGATIVE_RUNTIME_MATRIX.cjs',
    requiredDocTokens: ['POSTV1-04', 'Route Negative Runtime Matrix', 'No new route'],
  },
  {
    id: 'POSTV1-05',
    title: 'DB Index / Query Cost Audit',
    doc: 'docs/tasks/POSTV1-05-DB-Index-Query-Cost-Audit.md',
    acceptance: 'scripts/governance_acceptance/POSTV1_05_DB_INDEX_QUERY_COST_AUDIT.cjs',
    requiredDocTokens: ['POSTV1-05', 'decision_cycle_v1_operator_queue_idx', 'basic EXPLAIN'],
  },
  {
    id: 'POSTV1-06',
    title: 'Docker Startup / Migration Runner Baseline',
    doc: 'docs/tasks/POSTV1-06-Docker-Startup-Migration-Runner-Baseline.md',
    acceptance: 'scripts/governance_acceptance/POSTV1_06_DOCKER_STARTUP_MIGRATION_RUNNER_BASELINE.cjs',
    requiredDocTokens: ['POSTV1-06', 'sql_migrations_completed', 'p1_completed = true'],
  },
];

const REVIEW_DOC = 'docs/tasks/P1-Completion-Review-Before-P2.md';
const TASK_LINE = 'docs/tasks/POST-TWIN-KERNEL-V1-TASK-LINE.md';

const assertions = [];

function abs(file) {
  return path.resolve(ROOT, file);
}

function read(file) {
  return fs.readFileSync(abs(file), 'utf8');
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

function containsAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
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
  assert('task_line_exists', fs.existsSync(abs(TASK_LINE)), { file: TASK_LINE });
  assert('review_doc_exists', fs.existsSync(abs(REVIEW_DOC)), { file: REVIEW_DOC });

  const taskLine = read(TASK_LINE);
  const reviewDoc = read(REVIEW_DOC);

  assert('task_line_contains_all_p1_tasks', containsAll(taskLine, P1_TASKS.map((task) => `${task.id} — ${task.title}`)), { file: TASK_LINE });
  assert('task_line_contains_next_phase_placeholders', containsAll(taskLine, ['P2 Real Adapter Integration', 'P3 Operator UX Refinement', 'P4 Policy-Controlled ROI', 'P5 Policy-Controlled Field Memory Governance', 'P6 Execution System Integration', 'These should not begin until P1 has a completion review']), { file: TASK_LINE });
  assert('review_doc_records_phase_gate', containsAll(reviewDoc, ['P1_COMPLETION_REVIEW_BEFORE_P2', 'P2 may begin only after this review is merged and tagged']), { file: REVIEW_DOC });
  assert('review_doc_records_no_runtime_boundary', containsAll(reviewDoc, ['No new runtime domain semantics', 'No route is added by this review', 'No UI is added by this review', 'No table redesign is added by this review', 'No model update is added by this review']), { file: REVIEW_DOC });

  let docCount = 0;
  let acceptanceCount = 0;
  for (const task of P1_TASKS) {
    assert(`${task.id}_doc_exists`, fs.existsSync(abs(task.doc)), { file: task.doc });
    assert(`${task.id}_acceptance_exists`, fs.existsSync(abs(task.acceptance)), { file: task.acceptance });
    const docText = read(task.doc);
    const acceptanceText = read(task.acceptance);
    assert(`${task.id}_doc_records_required_tokens`, containsAll(docText, task.requiredDocTokens), { file: task.doc, requiredDocTokens: task.requiredDocTokens });
    assert(`${task.id}_acceptance_names_task`, acceptanceText.includes(task.id.replace('-', '_')) || acceptanceText.includes(task.id), { file: task.acceptance });
    assert(`review_doc_records_${task.id}`, containsAll(reviewDoc, [task.id, task.doc, task.acceptance]), { file: REVIEW_DOC });
    docCount += 1;
    acceptanceCount += 1;
  }

  assert('review_doc_records_next_phases_but_does_not_authorize_them', containsAll(reviewDoc, ['P2 Real Adapter Integration', 'P3 Operator UX Refinement', 'P4 Policy-Controlled ROI', 'P5 Policy-Controlled Field Memory Governance', 'P6 Execution System Integration', 'These phases are not authorized by this review']), { file: REVIEW_DOC });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    p1_task_count: P1_TASKS.length,
    p1_task_doc_count: docCount,
    p1_acceptance_script_count: acceptanceCount,
    p1_completed: true,
    p2_authorized_after_review: true,
    p2_not_started_by_this_review: true,
    ...assertionSummary(),
    next_step: 'P2_REAL_ADAPTER_INTEGRATION_PLANNING',
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
