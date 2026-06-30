// scripts/governance_acceptance/POST_P8_08_MANUAL_REVIEW_CLASSIFICATION_ACCEPTANCE_SAFE.cjs
// Purpose: verify POST-P8 manual-review classification report.
// Boundary: read-only verification.

'use strict';

const fs = require('node:fs');
const childProcess = require('node:child_process');

const ACCEPTANCE = 'POST_P8_08_MANUAL_REVIEW_CLASSIFICATION_ACCEPTANCE_SAFE';
const PLAN = 'docs/legacy/POST_P8_REPO_WIDE_CLEANUP_PLAN.json';
const REPORT = 'docs/legacy/POST_P8_MANUAL_REVIEW_CLASSIFICATION_REPORT.json';
const CLASSIFIER = 'scripts/maintenance/POST_P8_08_CLASSIFY_MANUAL_REVIEW_SET.cjs';
const REQUIRED_GROUPS = [
  'current_p8_or_twin_anchor',
  'historical_governance_acceptance',
  'historical_task_doc',
  'domain_reference_doc',
];
const ALLOWED_GROUPS = new Set([
  ...REQUIRED_GROUPS,
  'root_repo_config',
  'environment_example_config',
  'environment_config',
  'acceptance_fixture_or_case',
  'dataset_or_fixture',
  'generated_or_legacy_evidence',
  'ops_or_maintenance_script',
  'root_ops_script',
  'top_level_legacy_doc_or_manifest',
  'data_or_manifest_artifact',
  'unknown_manual_review',
]);
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
  assert('classifier_exists', exists(CLASSIFIER));
  runNode(CLASSIFIER);
  assert('report_exists', exists(REPORT));

  const plan = readJson(PLAN);
  const report = readJson(REPORT);
  const groupNames = new Set((report.groups || []).map((item) => item.group));
  const unexpected = [...groupNames].filter((group) => !ALLOWED_GROUPS.has(group));
  const unknown = (report.items || []).filter((item) => item.manual_review_group === 'unknown_manual_review');

  assert('report_name_valid', report.report === 'POST_P8_MANUAL_REVIEW_CLASSIFICATION_REPORT', { report: report.report });
  assert('manual_count_matches_plan', report.manual_review_count === plan.manual_review_count, { report: report.manual_review_count, plan: plan.manual_review_count });
  assert('classified_count_matches_manual_count', report.classified_manual_review_count === report.manual_review_count, { classified: report.classified_manual_review_count, manual: report.manual_review_count });
  for (const group of REQUIRED_GROUPS) assert(`required_group:${group}`, groupNames.has(group), { groupNames: [...groupNames] });
  assert('no_unexpected_group', unexpected.length === 0, { unexpected, groupNames: [...groupNames] });
  assert('unknown_bounded', unknown.length <= Math.max(25, Math.floor(report.manual_review_count * 0.1)), { unknown_count: unknown.length, manual_review_count: report.manual_review_count });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    manual_review_report_generated: true,
    manual_review_count: report.manual_review_count,
    classified_manual_review_count: report.classified_manual_review_count,
    unknown_manual_review_count: unknown.length,
    group_count: report.group_count,
    groups: report.groups,
    ...summary(),
    next_step: 'POST_P8_09_MANUAL_REVIEW_GROUP_DECISION'
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, details: error.details || null, assertions }, null, 2));
  process.exit(1);
}
