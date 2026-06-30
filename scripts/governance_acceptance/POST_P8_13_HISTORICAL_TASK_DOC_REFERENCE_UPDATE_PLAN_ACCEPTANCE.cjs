// scripts/governance_acceptance/POST_P8_13_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PLAN_ACCEPTANCE.cjs
// Purpose: verify POST-P8 historical_task_doc reference update plan.
// Boundary: read-only verification; no move, delete, or file changes.

'use strict';

const fs = require('node:fs');
const childProcess = require('node:child_process');

const ACCEPTANCE = 'POST_P8_13_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PLAN_ACCEPTANCE';
const AUDIT = 'docs/legacy/POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT_REPORT.json';
const DECISION = 'docs/legacy/POST_P8_12_HISTORICAL_TASK_DOC_ARCHIVE_DECISION_REPORT.json';
const REPORT = 'docs/legacy/POST_P8_13_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PLAN.json';
const GENERATOR = 'scripts/maintenance/POST_P8_13_PLAN_HISTORICAL_TASK_DOC_REFERENCE_UPDATE.cjs';
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
  assert('audit_exists', exists(AUDIT));
  assert('decision_exists', exists(DECISION));
  assert('generator_exists', exists(GENERATOR));
  runNode(GENERATOR);
  assert('report_exists', exists(REPORT));

  const audit = readJson(AUDIT);
  const decision = readJson(DECISION);
  const report = readJson(REPORT);
  const filePlans = Array.isArray(report.file_plans) ? report.file_plans : [];
  const nestedExactCount = filePlans.reduce((sum, filePlan) => sum + (filePlan.reference_plans || []).reduce((innerSum, refPlan) => innerSum + refPlan.exact_reference_count, 0), 0);
  const nestedPlanItemCount = filePlans.reduce((sum, filePlan) => sum + (filePlan.reference_plans || []).length, 0);

  assert('report_name_valid', report.report === 'POST_P8_13_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PLAN', { report: report.report });
  assert('selected_group_valid', report.selected_group === SELECTED_GROUP, { selected_group: report.selected_group });
  assert('file_count_matches_audit', report.reference_update_file_count === audit.audited_file_count, { report: report.reference_update_file_count, audit: audit.audited_file_count });
  assert('file_count_expected', report.reference_update_file_count === 48, { count: report.reference_update_file_count });
  assert('exact_count_matches_audit', report.reference_update_exact_reference_count === audit.total_exact_reference_count, { report: report.reference_update_exact_reference_count, audit: audit.total_exact_reference_count });
  assert('exact_count_expected', report.reference_update_exact_reference_count === 585, { count: report.reference_update_exact_reference_count });
  assert('nested_exact_count_matches_report', nestedExactCount === report.reference_update_exact_reference_count, { nestedExactCount, report: report.reference_update_exact_reference_count });
  assert('nested_plan_item_count_matches_report', nestedPlanItemCount === report.reference_update_plan_item_count, { nestedPlanItemCount, report: report.reference_update_plan_item_count });
  assert('all_file_plans_blocked', filePlans.every((item) => item.decision === 'blocked_by_exact_reference'), { bad: filePlans.filter((item) => item.decision !== 'blocked_by_exact_reference') });
  assert('decision_blocked_count_inherited', report.decision_blocked_by_exact_reference_count === decision.blocked_by_exact_reference_count, { report: report.decision_blocked_by_exact_reference_count, decision: decision.blocked_by_exact_reference_count });
  assert('apply_disallowed', report.reference_update_apply_allowed === false, { allowed: report.reference_update_apply_allowed });
  assert('all_file_plans_disallow_apply', filePlans.every((item) => item.update_apply_allowed === false), { bad: filePlans.filter((item) => item.update_apply_allowed !== false) });
  assert('all_reference_plans_disallow_apply', filePlans.every((item) => (item.reference_plans || []).every((refPlan) => refPlan.update_apply_allowed === false)), { bad: filePlans.flatMap((item) => item.reference_plans || []).filter((refPlan) => refPlan.update_apply_allowed !== false) });
  assert('all_reference_plans_have_old_and_planned', filePlans.every((item) => (item.reference_plans || []).every((refPlan) => refPlan.old_reference === item.source_file && refPlan.planned_reference === item.planned_destination)), { bad: filePlans.flatMap((item) => (item.reference_plans || []).filter((refPlan) => refPlan.old_reference !== item.source_file || refPlan.planned_reference !== item.planned_destination)) });
  assert('policy_plan_only', report.policy?.plan_report_only === true, { policy: report.policy });
  assert('policy_no_reference_change', report.policy?.no_reference_change === true, { policy: report.policy });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    selected_group: report.selected_group,
    reference_update_file_count: report.reference_update_file_count,
    reference_update_plan_item_count: report.reference_update_plan_item_count,
    reference_update_exact_reference_count: report.reference_update_exact_reference_count,
    affected_referencing_file_count: report.affected_referencing_file_count,
    reference_update_apply_allowed: report.reference_update_apply_allowed,
    ...summary(),
    next_step: report.next_step,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
