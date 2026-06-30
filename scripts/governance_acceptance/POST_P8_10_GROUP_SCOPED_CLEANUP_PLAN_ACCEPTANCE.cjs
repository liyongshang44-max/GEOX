// scripts/governance_acceptance/POST_P8_10_GROUP_SCOPED_CLEANUP_PLAN_ACCEPTANCE.cjs
// Purpose: verify POST-P8 group-scoped cleanup plan for historical_task_doc.
// Boundary: read-only verification; no move, delete, or rewrite.

'use strict';

const fs = require('node:fs');
const childProcess = require('node:child_process');

const ACCEPTANCE = 'POST_P8_10_GROUP_SCOPED_CLEANUP_PLAN_ACCEPTANCE';
const CLASSIFICATION = 'docs/legacy/POST_P8_MANUAL_REVIEW_CLASSIFICATION_REPORT.json';
const DECISION = 'docs/legacy/POST_P8_MANUAL_REVIEW_GROUP_DECISION_REPORT.json';
const PLAN = 'docs/legacy/POST_P8_10_HISTORICAL_TASK_DOC_CLEANUP_PLAN.json';
const GENERATOR = 'scripts/maintenance/POST_P8_10_PLAN_HISTORICAL_TASK_DOC_CLEANUP.cjs';
const SELECTED_GROUP = 'historical_task_doc';
const assertions = [];

function exists(file) { return fs.existsSync(file); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function runNode(file) { return childProcess.execFileSync(process.execPath, [file], { encoding: 'utf8' }).trim(); }
function assert(name, condition, details = {}) {
  assertions.push({ name, passed: condition === true, details });
  if (condition !== true) {
    const error = new Error(`ASSERTION_FAILED:${name}`);
    error.details = details;
    throw error;
  }
}
function summary() {
  const failed = assertions.filter((item) => !item.passed);
  return { assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) };
}

try {
  assert('classification_exists', exists(CLASSIFICATION));
  assert('decision_exists', exists(DECISION));
  assert('generator_exists', exists(GENERATOR));
  runNode(GENERATOR);
  assert('plan_exists', exists(PLAN));

  const classification = readJson(CLASSIFICATION);
  const decision = readJson(DECISION);
  const plan = readJson(PLAN);
  const sourceItems = (classification.items || []).filter((item) => item.manual_review_group === SELECTED_GROUP);
  const decisionItem = (decision.decisions || []).find((item) => item.group === SELECTED_GROUP);
  const plannedItems = plan.planned_items || [];

  assert('report_name_valid', plan.report === 'POST_P8_10_HISTORICAL_TASK_DOC_CLEANUP_PLAN', { report: plan.report });
  assert('selected_group_valid', plan.selected_group === SELECTED_GROUP, { selected_group: plan.selected_group });
  assert('decision_is_deferred_candidate', decisionItem?.decision === 'archive_candidate_after_reference_audit', { decisionItem });
  assert('group_file_count_matches_decision', plan.group_file_count === decisionItem.file_count, { plan: plan.group_file_count, decision: decisionItem.file_count });
  assert('planned_file_count_matches_source', plan.planned_file_count === sourceItems.length, { plan: plan.planned_file_count, source: sourceItems.length });
  assert('planned_file_count_expected', plan.planned_file_count === 48, { planned_file_count: plan.planned_file_count });
  assert('apply_now_disallowed', plan.apply_now_allowed === false, { apply_now_allowed: plan.apply_now_allowed });
  assert('all_items_disallow_apply_now', plannedItems.every((item) => item.apply_now_allowed === false), { bad: plannedItems.filter((item) => item.apply_now_allowed !== false) });
  assert('all_sources_under_docs_tasks', plannedItems.every((item) => String(item.source_file).startsWith('docs/tasks/')), { bad: plannedItems.filter((item) => !String(item.source_file).startsWith('docs/tasks/')) });
  assert('all_destinations_under_legacy_tasks', plannedItems.every((item) => String(item.planned_destination).startsWith('docs/legacy/tasks/')), { bad: plannedItems.filter((item) => !String(item.planned_destination).startsWith('docs/legacy/tasks/')) });
  assert('policy_plan_only', plan.policy?.plan_only === true, { policy: plan.policy });
  assert('policy_no_move', plan.policy?.no_file_move === true, { policy: plan.policy });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    selected_group: plan.selected_group,
    group_decision: plan.group_decision,
    group_file_count: plan.group_file_count,
    planned_file_count: plan.planned_file_count,
    apply_now_allowed: plan.apply_now_allowed,
    planned_target_root: plan.planned_target_root,
    ...summary(),
    next_step: plan.next_step,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
