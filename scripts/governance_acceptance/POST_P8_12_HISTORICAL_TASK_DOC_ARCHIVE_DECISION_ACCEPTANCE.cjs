// scripts/governance_acceptance/POST_P8_12_HISTORICAL_TASK_DOC_ARCHIVE_DECISION_ACCEPTANCE.cjs
// Purpose: verify POST-P8 historical_task_doc archive decision report.
// Boundary: read-only verification; no move, delete, or rewrite.

'use strict';

const fs = require('node:fs');
const childProcess = require('node:child_process');

const ACCEPTANCE = 'POST_P8_12_HISTORICAL_TASK_DOC_ARCHIVE_DECISION_ACCEPTANCE';
const AUDIT = 'docs/legacy/POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT_REPORT.json';
const REPORT = 'docs/legacy/POST_P8_12_HISTORICAL_TASK_DOC_ARCHIVE_DECISION_REPORT.json';
const GENERATOR = 'scripts/maintenance/POST_P8_12_DECIDE_HISTORICAL_TASK_DOC_ARCHIVE.cjs';
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
  assert('generator_exists', exists(GENERATOR));
  runNode(GENERATOR);
  assert('report_exists', exists(REPORT));

  const audit = readJson(AUDIT);
  const report = readJson(REPORT);
  const decisions = Array.isArray(report.decisions) ? report.decisions : [];

  assert('report_name_valid', report.report === 'POST_P8_12_HISTORICAL_TASK_DOC_ARCHIVE_DECISION_REPORT', { report: report.report });
  assert('selected_group_valid', report.selected_group === SELECTED_GROUP, { selected_group: report.selected_group });
  assert('decision_file_count_matches_audit', report.decision_file_count === audit.audited_file_count, { decision: report.decision_file_count, audit: audit.audited_file_count });
  assert('decision_file_count_expected', report.decision_file_count === 48, { decision_file_count: report.decision_file_count });
  assert('blocked_count_matches_exact_refs', report.blocked_by_exact_reference_count === audit.files_with_exact_references, { blocked: report.blocked_by_exact_reference_count, audit: audit.files_with_exact_references });
  assert('all_files_blocked', report.blocked_by_exact_reference_count === 48, { blocked: report.blocked_by_exact_reference_count });
  assert('no_move_candidates', report.candidate_requires_separate_move_gate_count === 0, { count: report.candidate_requires_separate_move_gate_count });
  assert('archive_move_disallowed', report.archive_move_allowed === false, { archive_move_allowed: report.archive_move_allowed });
  assert('all_decisions_disallow_move', decisions.every((item) => item.archive_move_allowed === false), { bad: decisions.filter((item) => item.archive_move_allowed !== false) });
  assert('all_decisions_blocked_by_exact_reference', decisions.every((item) => item.decision === 'blocked_by_exact_reference'), { bad: decisions.filter((item) => item.decision !== 'blocked_by_exact_reference') });
  assert('total_exact_reference_count_inherited', report.audit_total_exact_reference_count === audit.total_exact_reference_count, { report: report.audit_total_exact_reference_count, audit: audit.total_exact_reference_count });
  assert('policy_decision_only', report.policy?.decision_report_only === true, { policy: report.policy });
  assert('policy_no_move', report.policy?.no_file_move === true, { policy: report.policy });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    selected_group: report.selected_group,
    decision_file_count: report.decision_file_count,
    blocked_by_exact_reference_count: report.blocked_by_exact_reference_count,
    candidate_requires_separate_move_gate_count: report.candidate_requires_separate_move_gate_count,
    archive_move_allowed: report.archive_move_allowed,
    audit_total_exact_reference_count: report.audit_total_exact_reference_count,
    ...summary(),
    next_step: report.next_step,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
