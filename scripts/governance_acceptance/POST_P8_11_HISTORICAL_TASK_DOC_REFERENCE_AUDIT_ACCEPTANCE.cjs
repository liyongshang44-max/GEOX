// scripts/governance_acceptance/POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT_ACCEPTANCE.cjs
// Purpose: verify POST-P8 historical_task_doc reference audit report.
// Boundary: read-only verification; no move, delete, or rewrite.

'use strict';

const fs = require('node:fs');
const childProcess = require('node:child_process');

const ACCEPTANCE = 'POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT_ACCEPTANCE';
const PLAN = 'docs/legacy/POST_P8_10_HISTORICAL_TASK_DOC_CLEANUP_PLAN.json';
const REPORT = 'docs/legacy/POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT_REPORT.json';
const AUDITOR = 'scripts/maintenance/POST_P8_11_AUDIT_HISTORICAL_TASK_DOC_REFERENCES.cjs';
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
  assert('plan_exists', exists(PLAN));
  assert('auditor_exists', exists(AUDITOR));
  runNode(AUDITOR);
  assert('report_exists', exists(REPORT));

  const plan = readJson(PLAN);
  const report = readJson(REPORT);
  const plannedItems = Array.isArray(plan.planned_items) ? plan.planned_items : [];
  const auditedItems = Array.isArray(report.audited_items) ? report.audited_items : [];
  const plannedSources = new Set(plannedItems.map((item) => item.source_file));
  const auditedSources = new Set(auditedItems.map((item) => item.source_file));

  assert('report_name_valid', report.report === 'POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT_REPORT', { report: report.report });
  assert('selected_group_valid', report.selected_group === SELECTED_GROUP, { selected_group: report.selected_group });
  assert('planned_file_count_matches_plan', report.planned_file_count === plannedItems.length, { report: report.planned_file_count, plan: plannedItems.length });
  assert('audited_file_count_matches_plan', report.audited_file_count === plannedItems.length, { report: report.audited_file_count, plan: plannedItems.length });
  assert('audited_file_count_expected', report.audited_file_count === 48, { audited_file_count: report.audited_file_count });
  assert('all_planned_sources_audited', [...plannedSources].every((source) => auditedSources.has(source)), { planned_count: plannedSources.size, audited_count: auditedSources.size });
  assert('all_audited_sources_from_plan', [...auditedSources].every((source) => plannedSources.has(source)), { planned_count: plannedSources.size, audited_count: auditedSources.size });
  assert('move_now_disallowed', report.move_now_allowed === false, { move_now_allowed: report.move_now_allowed });
  assert('all_items_move_now_disallowed', auditedItems.every((item) => item.move_now_allowed === false), { bad: auditedItems.filter((item) => item.move_now_allowed !== false) });
  assert('reference_counts_are_numbers', auditedItems.every((item) => Number.isInteger(item.exact_reference_count) && Number.isInteger(item.basename_reference_count)), { bad: auditedItems.filter((item) => !Number.isInteger(item.exact_reference_count) || !Number.isInteger(item.basename_reference_count)) });
  assert('policy_audit_only', report.policy?.audit_report_only === true, { policy: report.policy });
  assert('policy_no_move', report.policy?.no_file_move === true, { policy: report.policy });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    selected_group: report.selected_group,
    planned_file_count: report.planned_file_count,
    audited_file_count: report.audited_file_count,
    files_with_exact_references: report.files_with_exact_references,
    total_exact_reference_count: report.total_exact_reference_count,
    move_candidate_after_audit_count: report.move_candidate_after_audit_count,
    move_now_allowed: report.move_now_allowed,
    ...summary(),
    next_step: report.next_step,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
