// scripts/governance_acceptance/POST_P8_09_GROUP_DECISION_ACCEPTANCE_SAFE.cjs
// Purpose: verify POST-P8 group decision report.
// Boundary: read-only verification.

'use strict';

const fs = require('node:fs');
const childProcess = require('node:child_process');

const ACCEPTANCE = 'POST_P8_09_GROUP_DECISION_ACCEPTANCE_SAFE';
const SOURCE = 'docs/legacy/POST_P8_MANUAL_REVIEW_CLASSIFICATION_REPORT.json';
const REPORT = 'docs/legacy/POST_P8_MANUAL_REVIEW_GROUP_DECISION_REPORT.json';
const GENERATOR = 'scripts/maintenance/POST_P8_09_DECIDE_MANUAL_REVIEW_GROUPS.cjs';
const assertions = [];

function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function exists(file) { return fs.existsSync(file); }
function run(file) { return childProcess.execFileSync(process.execPath, [file], { encoding: 'utf8' }).trim(); }
function assert(name, pass, details = {}) {
  assertions.push({ name, passed: pass === true, details });
  if (pass !== true) {
    const error = new Error(`ASSERTION_FAILED:${name}`);
    error.details = details;
    throw error;
  }
}
function finish(extra) {
  const failed = assertions.filter((item) => !item.passed);
  return { ...extra, assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) };
}

try {
  assert('source_exists', exists(SOURCE));
  assert('generator_exists', exists(GENERATOR));
  run(GENERATOR);
  assert('report_exists', exists(REPORT));

  const source = json(SOURCE);
  const report = json(REPORT);
  const decisions = Array.isArray(report.decisions) ? report.decisions : [];
  const byGroup = new Map(decisions.map((item) => [item.group, item]));

  assert('report_name_valid', report.report === 'POST_P8_MANUAL_REVIEW_GROUP_DECISION_REPORT', { report: report.report });
  assert('group_count_matches', report.decision_group_count === source.group_count, { decision: report.decision_group_count, source: source.group_count });
  assert('file_count_matches', report.decision_file_count === source.manual_review_count, { decision: report.decision_file_count, source: source.manual_review_count });
  assert('archive_now_zero', report.archive_now_count === 0, { archive_now_count: report.archive_now_count });
  assert('anchors_protected', byGroup.get('current_p8_or_twin_anchor')?.decision === 'protect_no_move', { item: byGroup.get('current_p8_or_twin_anchor') });
  assert('unknown_split', byGroup.get('unknown_manual_review')?.decision === 'split_required_before_action', { item: byGroup.get('unknown_manual_review') });
  assert('task_doc_deferred_archive', byGroup.get('historical_task_doc')?.decision === 'archive_candidate_after_reference_audit', { item: byGroup.get('historical_task_doc') });

  console.log(JSON.stringify(finish({
    ok: true,
    acceptance: ACCEPTANCE,
    decision_report_generated: true,
    source_manual_review_count: report.source_manual_review_count,
    source_group_count: report.source_group_count,
    decision_group_count: report.decision_group_count,
    decision_file_count: report.decision_file_count,
    decision_counts_by_file: report.decision_counts_by_file,
    archive_now_count: report.archive_now_count,
    next_step: 'POST_P8_10_GROUP_SCOPED_CLEANUP_PLAN'
  }), null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
