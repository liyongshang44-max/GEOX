// scripts/governance_acceptance/POST_P8_14_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_APPLY_GATE_ACCEPTANCE.cjs
// Purpose: verify POST-P8-14 gate report.
// Boundary: read-only verification.

'use strict';

const fs = require('node:fs');
const childProcess = require('node:child_process');

const ACCEPTANCE = 'POST_P8_14_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_APPLY_GATE_ACCEPTANCE';
const PLAN = 'docs/legacy/POST_P8_13_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PLAN.json';
const REPORT = 'docs/legacy/POST_P8_14_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_APPLY_GATE_REPORT.json';
const GENERATOR = 'scripts/maintenance/POST_P8_14_DEFINE_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_APPLY_GATE.cjs';
const assertions = [];

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function assert(name, ok, details = {}) {
  assertions.push({ name, passed: ok === true, details });
  if (ok !== true) throw new Error(`ASSERTION_FAILED:${name}`);
}
function summary() {
  const failed = assertions.filter((item) => !item.passed);
  return { assertion_count: assertions.length, failed_assertion_count: failed.length, failed_assertions: failed.map((item) => item.name) };
}

try {
  assert('plan_exists', fs.existsSync(PLAN));
  assert('generator_exists', fs.existsSync(GENERATOR));
  childProcess.execFileSync(process.execPath, [GENERATOR], { encoding: 'utf8' });
  assert('report_exists', fs.existsSync(REPORT));

  const plan = readJson(PLAN);
  const report = readJson(REPORT);
  const conditions = Array.isArray(report.conditions) ? report.conditions : [];

  assert('report_name_valid', report.report === 'POST_P8_14_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_APPLY_GATE_REPORT');
  assert('selected_group_valid', report.selected_group === 'historical_task_doc');
  assert('file_count_matches', report.reference_update_file_count === plan.reference_update_file_count);
  assert('item_count_matches', report.reference_update_plan_item_count === plan.reference_update_plan_item_count);
  assert('exact_count_matches', report.reference_update_exact_reference_count === plan.reference_update_exact_reference_count);
  assert('expected_file_count', report.reference_update_file_count === 48);
  assert('expected_item_count', report.reference_update_plan_item_count === 371);
  assert('expected_exact_count', report.reference_update_exact_reference_count === 585);
  assert('gate_closed', report.apply_gate_open === false);
  assert('not_allowed', report.reference_update_apply_allowed === false);
  assert('has_unsatisfied_required_conditions', report.unsatisfied_required_condition_count > 0);
  assert('has_conditions', conditions.length >= 5);
  assert('some_required_condition_false', conditions.some((item) => item.required === true && item.satisfied === false));
  assert('policy_gate_only', report.policy?.gate_report_only === true);
  assert('policy_no_reference_change', report.policy?.no_reference_change === true);

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    selected_group: report.selected_group,
    reference_update_file_count: report.reference_update_file_count,
    reference_update_plan_item_count: report.reference_update_plan_item_count,
    reference_update_exact_reference_count: report.reference_update_exact_reference_count,
    affected_referencing_file_count: report.affected_referencing_file_count,
    apply_gate_open: report.apply_gate_open,
    reference_update_apply_allowed: report.reference_update_apply_allowed,
    unsatisfied_required_condition_count: report.unsatisfied_required_condition_count,
    ...summary(),
    next_step: report.next_step,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, assertions }, null, 2));
  process.exit(1);
}
