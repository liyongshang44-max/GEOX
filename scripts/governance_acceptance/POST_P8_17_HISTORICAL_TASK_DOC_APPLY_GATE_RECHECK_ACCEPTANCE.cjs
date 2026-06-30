// scripts/governance_acceptance/POST_P8_17_HISTORICAL_TASK_DOC_APPLY_GATE_RECHECK_ACCEPTANCE.cjs
// Purpose: verify POST-P8-17 apply gate recheck report.
// Boundary: read-only verification.

'use strict';

const fs = require('node:fs');
const childProcess = require('node:child_process');

const ACCEPTANCE = 'POST_P8_17_HISTORICAL_TASK_DOC_APPLY_GATE_RECHECK_ACCEPTANCE';
const REPORT = 'docs/legacy/POST_P8_17_HISTORICAL_TASK_DOC_APPLY_GATE_RECHECK_REPORT.json';
const GENERATOR = 'scripts/maintenance/POST_P8_17_RECHECK_HISTORICAL_TASK_DOC_APPLY_GATE.cjs';
const assertions = [];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assert(name, ok) {
  assertions.push({ name, passed: ok === true });
  if (ok !== true) throw new Error('ASSERTION_FAILED:' + name);
}

function summary() {
  const failed = assertions.filter((item) => !item.passed);
  return {
    assertion_count: assertions.length,
    failed_assertion_count: failed.length,
    failed_assertions: failed.map((item) => item.name)
  };
}

try {
  assert('generator_exists', fs.existsSync(GENERATOR));

  childProcess.execFileSync(process.execPath, [GENERATOR], { encoding: 'utf8' });

  assert('report_exists', fs.existsSync(REPORT));

  const report = readJson(REPORT);

  assert('report_name_valid', report.report === 'POST_P8_17_HISTORICAL_TASK_DOC_APPLY_GATE_RECHECK_REPORT');
  assert('selected_group_valid', report.selected_group === 'historical_task_doc');
  assert('source_file_count_expected', report.source_file_count === 48);
  assert('plan_item_count_expected', report.plan_item_count === 371);
  assert('exact_count_expected', report.exact_reference_count === 585);
  assert('observed_exact_count_expected', report.observed_exact_reference_count === 585);
  assert('affected_file_count_expected', report.affected_referencing_file_count === 75);
  assert('preview_mismatch_zero', report.preview_mismatch_count === 0);
  assert('owner_confirmation_recorded', report.owner_confirmation_recorded === true);
  assert('preview_counts_matched', report.preview_counts_matched === true);
  assert('runtime_surface_diff_zero_false', report.runtime_surface_diff_zero === false);
  assert('post_update_audit_would_be_zero_false', report.post_update_audit_would_be_zero === false);
  assert('archive_move_gate_separate_false', report.archive_move_gate_separate === false);
  assert('apply_gate_closed', report.apply_gate_open === false);
  assert('apply_disallowed', report.apply_allowed === false);
  assert('unsatisfied_required_condition_count_expected', report.unsatisfied_required_condition_count === 3);
  assert('policy_recheck_only', report.policy && report.policy.recheck_report_only === true);
  assert('policy_no_reference_change', report.policy && report.policy.no_reference_change === true);

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    selected_group: report.selected_group,
    owner_confirmation_recorded: report.owner_confirmation_recorded,
    preview_counts_matched: report.preview_counts_matched,
    runtime_surface_diff_zero: report.runtime_surface_diff_zero,
    post_update_audit_would_be_zero: report.post_update_audit_would_be_zero,
    archive_move_gate_separate: report.archive_move_gate_separate,
    apply_gate_open: report.apply_gate_open,
    apply_allowed: report.apply_allowed,
    unsatisfied_required_condition_count: report.unsatisfied_required_condition_count,
    ...summary(),
    next_step: report.next_step
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: ACCEPTANCE,
    error: error.message,
    assertions
  }, null, 2));
  process.exit(1);
}
