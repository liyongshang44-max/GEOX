// scripts/governance_acceptance/POST_P8_18_HISTORICAL_TASK_DOC_APPLY_BUNDLE_ACCEPTANCE.cjs
// Purpose: verify POST-P8-18 historical_task_doc apply bundle results.
// Boundary: read-only verification after the apply script has run.

'use strict';

const fs = require('node:fs');

const ACCEPTANCE = 'POST_P8_18_HISTORICAL_TASK_DOC_APPLY_BUNDLE_ACCEPTANCE';
const REPORT = 'docs/legacy/POST_P8_18_HISTORICAL_TASK_DOC_APPLY_BUNDLE_REPORT.json';
const assertions = [];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assert(name, ok) {
  assertions.push({ name, passed: ok === true });
  if (ok !== true) throw new Error(`ASSERTION_FAILED:${name}`);
}

function summary() {
  const failed = assertions.filter((item) => !item.passed);
  return {
    assertion_count: assertions.length,
    failed_assertion_count: failed.length,
    failed_assertions: failed.map((item) => item.name),
  };
}

try {
  assert('report_exists', fs.existsSync(REPORT));

  const report = readJson(REPORT);

  assert('report_name_valid', report.report === 'POST_P8_18_HISTORICAL_TASK_DOC_APPLY_BUNDLE_REPORT');
  assert('selected_group_valid', report.selected_group === 'historical_task_doc');
  assert('applied_true', report.applied === true);
  assert('apply_allowed_true', report.apply_allowed === true);
  assert('moved_file_count_expected', report.moved_file_count === 48);
  assert('source_file_count_expected', report.source_file_count === 48);
  assert('destination_file_count_expected', report.destination_file_count === 48);
  assert('affected_referencing_file_count_expected', report.affected_referencing_file_count === 75);
  assert('reference_update_plan_item_count_expected', report.reference_update_plan_item_count === 371);
  assert('replacement_count_expected', report.replacement_count === 585);
  assert('expected_replacement_count_expected', report.expected_replacement_count === 585);
  assert('old_exact_reference_count_after_zero', report.old_exact_reference_count_after === 0);
  assert('new_exact_reference_count_after_not_less_than_expected', report.new_exact_reference_count_after >= report.expected_replacement_count);
  assert('missing_destination_file_count_zero', report.missing_destination_file_count === 0);
  assert('remaining_source_file_count_zero', report.remaining_source_file_count === 0);
  assert('broken_reference_count_zero', report.broken_reference_count === 0);
  assert('runtime_surface_diff_count_zero', report.runtime_surface_diff_count === 0);
  assert('runtime_surface_files_empty', Array.isArray(report.runtime_surface_files) && report.runtime_surface_files.length === 0);
  assert('move_results_count_expected', Array.isArray(report.move_results) && report.move_results.length === 48);
  assert('reference_update_results_present', Array.isArray(report.reference_update_results) && report.reference_update_results.length > 0);

  for (const item of report.move_results) {
    assert(`source_missing:${item.source_file}`, fs.existsSync(item.source_file) === false);
    assert(`destination_exists:${item.planned_destination}`, fs.existsSync(item.planned_destination) === true);
  }

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    selected_group: report.selected_group,
    moved_file_count: report.moved_file_count,
    reference_update_plan_item_count: report.reference_update_plan_item_count,
    replacement_count: report.replacement_count,
    old_exact_reference_count_after: report.old_exact_reference_count_after,
    new_exact_reference_count_after: report.new_exact_reference_count_after,
    missing_destination_file_count: report.missing_destination_file_count,
    remaining_source_file_count: report.remaining_source_file_count,
    broken_reference_count: report.broken_reference_count,
    runtime_surface_diff_count: report.runtime_surface_diff_count,
    ...summary(),
    next_step: report.next_step,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: ACCEPTANCE,
    error: error.message,
    assertions,
  }, null, 2));
  process.exit(1);
}

