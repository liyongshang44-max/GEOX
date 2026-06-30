// scripts/maintenance/POST_P8_14_DEFINE_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_APPLY_GATE.cjs
// Purpose: define the gate required before a future reference update can be applied.
// Boundary: writes a gate report only; does not move, delete, or change files.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PLAN = 'docs/legacy/POST_P8_13_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PLAN.json';
const OUTPUT = 'docs/legacy/POST_P8_14_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_APPLY_GATE_REPORT.json';
const SELECTED_GROUP = 'historical_task_doc';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  if (!fs.existsSync(PLAN)) throw new Error(`MISSING_PLAN:${PLAN}`);
  const plan = readJson(PLAN);
  if (plan.selected_group !== SELECTED_GROUP) throw new Error(`UNEXPECTED_GROUP:${plan.selected_group}`);
  if (plan.reference_update_apply_allowed !== false) throw new Error('UNEXPECTED_PLAN_APPLY_ALLOWED');

  const conditions = [
    {
      key: 'plan_acceptance_passed',
      required: true,
      satisfied: true,
      evidence: PLAN,
    },
    {
      key: 'expected_exact_reference_count_matched',
      required: true,
      satisfied: plan.reference_update_exact_reference_count === 585,
      evidence: String(plan.reference_update_exact_reference_count),
    },
    {
      key: 'owner_confirmation_recorded',
      required: true,
      satisfied: false,
      evidence: null,
    },
    {
      key: 'dry_run_report_generated',
      required: true,
      satisfied: false,
      evidence: null,
    },
    {
      key: 'runtime_surface_diff_zero',
      required: true,
      satisfied: false,
      evidence: null,
    },
    {
      key: 'post_update_audit_would_be_zero',
      required: true,
      satisfied: false,
      evidence: null,
    },
    {
      key: 'archive_move_gate_separate',
      required: true,
      satisfied: false,
      evidence: null,
    },
  ];
  const unsatisfiedRequiredConditions = conditions.filter((item) => item.required && !item.satisfied);
  const output = {
    generated_at: new Date().toISOString(),
    report: 'POST_P8_14_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_APPLY_GATE_REPORT',
    input_plan_report: PLAN,
    output_report: OUTPUT,
    selected_group: SELECTED_GROUP,
    reference_update_file_count: plan.reference_update_file_count,
    reference_update_plan_item_count: plan.reference_update_plan_item_count,
    reference_update_exact_reference_count: plan.reference_update_exact_reference_count,
    affected_referencing_file_count: plan.affected_referencing_file_count,
    apply_gate_open: false,
    reference_update_apply_allowed: false,
    unsatisfied_required_condition_count: unsatisfiedRequiredConditions.length,
    unsatisfied_required_conditions: unsatisfiedRequiredConditions.map((item) => item.key),
    conditions,
    policy: {
      gate_report_only: true,
      no_file_move: true,
      no_delete: true,
      no_reference_change: true,
      future_apply_requires_all_conditions: true,
      archive_move_requires_separate_gate: true,
    },
    next_step: 'POST_P8_15_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_DRY_RUN',
  };
  writeJson(OUTPUT, output);
  console.log(JSON.stringify({
    ok: true,
    output_report: OUTPUT,
    selected_group: output.selected_group,
    reference_update_file_count: output.reference_update_file_count,
    reference_update_plan_item_count: output.reference_update_plan_item_count,
    reference_update_exact_reference_count: output.reference_update_exact_reference_count,
    affected_referencing_file_count: output.affected_referencing_file_count,
    apply_gate_open: output.apply_gate_open,
    reference_update_apply_allowed: output.reference_update_apply_allowed,
    unsatisfied_required_condition_count: output.unsatisfied_required_condition_count,
    next_step: output.next_step,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
