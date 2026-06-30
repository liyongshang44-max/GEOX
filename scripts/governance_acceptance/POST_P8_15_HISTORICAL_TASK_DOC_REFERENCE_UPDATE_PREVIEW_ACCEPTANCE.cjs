// scripts/governance_acceptance/POST_P8_15_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PREVIEW_ACCEPTANCE.cjs
// Purpose: verify POST-P8-15 report.

'use strict';

const fs = require('node:fs');
const childProcess = require('node:child_process');

const ACCEPTANCE = 'POST_P8_15_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PREVIEW_ACCEPTANCE';
const REPORT = 'docs/legacy/POST_P8_15_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PREVIEW_REPORT.json';
const GENERATOR = 'scripts/maintenance/POST_P8_15_PREVIEW_HISTORICAL_TASK_DOC_REFERENCE_UPDATE.cjs';
const assertions = [];

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function assert(name, ok) {
  assertions.push({ name, passed: ok === true });
  if (ok !== true) throw new Error(`ASSERTION_FAILED:${name}`);
}
function summary() {
  const failed = assertions.filter((item) => !item.passed);
  return { assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) };
}

try {
  assert('generator_exists', fs.existsSync(GENERATOR));
  childProcess.execFileSync(process.execPath, [GENERATOR], { encoding: 'utf8' });
  assert('report_exists', fs.existsSync(REPORT));
  const report = readJson(REPORT);
  const checks = Array.isArray(report.checks) ? report.checks : [];

  assert('report_name_valid', report.report === 'POST_P8_15_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PREVIEW_REPORT');
  assert('selected_group_valid', report.selected_group === 'historical_task_doc');
  assert('file_count_expected', report.reference_update_file_count === 48);
  assert('plan_item_count_expected', report.reference_update_plan_item_count === 371);
  assert('expected_exact_count_expected', report.expected_exact_reference_count === 585);
  assert('observed_exact_count_expected', report.observed_exact_reference_count === 585);
  assert('affected_file_count_expected', report.affected_referencing_file_count === 75);
  assert('mismatch_count_zero', report.mismatch_count === 0);
  assert('apply_disallowed', report.apply_allowed === false);
  assert('checks_count_matches', checks.length === 371);
  assert('all_checks_matched', checks.every((item) => item.count_matched === true));
  assert('policy_preview_only', report.policy?.preview_report_only === true);

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    selected_group: report.selected_group,
    reference_update_file_count: report.reference_update_file_count,
    reference_update_plan_item_count: report.reference_update_plan_item_count,
    expected_exact_reference_count: report.expected_exact_reference_count,
    observed_exact_reference_count: report.observed_exact_reference_count,
    affected_referencing_file_count: report.affected_referencing_file_count,
    mismatch_count: report.mismatch_count,
    apply_allowed: report.apply_allowed,
    ...summary(),
    next_step: report.next_step,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, assertions }, null, 2));
  process.exit(1);
}
