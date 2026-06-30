// scripts/governance_acceptance/POST_P8_16_HISTORICAL_TASK_DOC_OWNER_CONFIRMATION_ACCEPTANCE.cjs
// Purpose: verify POST-P8-16 owner confirmation report.
// Boundary: read-only verification.

'use strict';

const fs = require('node:fs');
const childProcess = require('node:child_process');

const ACCEPTANCE = 'POST_P8_16_HISTORICAL_TASK_DOC_OWNER_CONFIRMATION_ACCEPTANCE';
const REPORT = 'docs/legacy/POST_P8_16_HISTORICAL_TASK_DOC_OWNER_CONFIRMATION_REPORT.json';
const GENERATOR = 'scripts/maintenance/POST_P8_16_RECORD_HISTORICAL_TASK_DOC_OWNER_CONFIRMATION.cjs';
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

  assert('report_name_valid', report.report === 'POST_P8_16_HISTORICAL_TASK_DOC_OWNER_CONFIRMATION_REPORT');
  assert('selected_group_valid', report.selected_group === 'historical_task_doc');
  assert('owner_confirmation_recorded', report.owner_confirmation_recorded === true);
  assert('scope_valid', report.owner_confirmation_scope === 'governance_progression_only');
  assert('source_file_count_expected', report.source_file_count === 48);
  assert('plan_item_count_expected', report.plan_item_count === 371);
  assert('exact_count_expected', report.exact_reference_count === 585);
  assert('observed_exact_count_expected', report.observed_exact_reference_count === 585);
  assert('affected_file_count_expected', report.affected_referencing_file_count === 75);
  assert('preview_mismatch_zero', report.preview_mismatch_count === 0);
  assert('apply_disallowed', report.apply_allowed === false);
  assert('source_write_disallowed', report.source_file_change_allowed === false);
  assert('file_move_disallowed', report.file_move_allowed === false);
  assert('policy_owner_record_only', report.policy?.owner_record_only === true);
  assert('policy_no_reference_change', report.policy?.no_reference_change === true);

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    selected_group: report.selected_group,
    owner_confirmation_recorded: report.owner_confirmation_recorded,
    source_file_count: report.source_file_count,
    plan_item_count: report.plan_item_count,
    exact_reference_count: report.exact_reference_count,
    observed_exact_reference_count: report.observed_exact_reference_count,
    affected_referencing_file_count: report.affected_referencing_file_count,
    preview_mismatch_count: report.preview_mismatch_count,
    apply_allowed: report.apply_allowed,
    ...summary(),
    next_step: report.next_step,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error: error.message, assertions }, null, 2));
  process.exit(1);
}
