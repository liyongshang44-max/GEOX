// scripts/maintenance/POST_P8_17_RECHECK_HISTORICAL_TASK_DOC_APPLY_GATE.cjs
// Purpose: recheck the historical_task_doc apply gate after owner confirmation.
// Boundary: writes one report only; does not move, delete, or change source files.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const GATE = 'docs/legacy/POST_P8_14_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_APPLY_GATE_REPORT.json';
const PREVIEW = 'docs/legacy/POST_P8_15_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PREVIEW_REPORT.json';
const OWNER = 'docs/legacy/POST_P8_16_HISTORICAL_TASK_DOC_OWNER_CONFIRMATION_REPORT.json';
const OUTPUT = 'docs/legacy/POST_P8_17_HISTORICAL_TASK_DOC_APPLY_GATE_RECHECK_REPORT.json';
const SELECTED_GROUP = 'historical_task_doc';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function main() {
  if (!fs.existsSync(GATE)) throw new Error('MISSING_GATE:' + GATE);
  if (!fs.existsSync(PREVIEW)) throw new Error('MISSING_PREVIEW:' + PREVIEW);
  if (!fs.existsSync(OWNER)) throw new Error('MISSING_OWNER:' + OWNER);

  const gate = readJson(GATE);
  const preview = readJson(PREVIEW);
  const owner = readJson(OWNER);

  if (gate.selected_group !== SELECTED_GROUP) throw new Error('UNEXPECTED_GATE_GROUP:' + gate.selected_group);
  if (preview.selected_group !== SELECTED_GROUP) throw new Error('UNEXPECTED_PREVIEW_GROUP:' + preview.selected_group);
  if (owner.selected_group !== SELECTED_GROUP) throw new Error('UNEXPECTED_OWNER_GROUP:' + owner.selected_group);

  const conditions = [
    {
      key: 'owner_confirmation_recorded',
      required: true,
      satisfied: owner.owner_confirmation_recorded === true,
      evidence: OWNER
    },
    {
      key: 'preview_counts_matched',
      required: true,
      satisfied: preview.mismatch_count === 0 && preview.expected_exact_reference_count === preview.observed_exact_reference_count,
      evidence: PREVIEW
    },
    {
      key: 'runtime_surface_diff_zero',
      required: true,
      satisfied: false,
      evidence: null
    },
    {
      key: 'post_update_audit_would_be_zero',
      required: true,
      satisfied: false,
      evidence: null
    },
    {
      key: 'archive_move_gate_separate',
      required: true,
      satisfied: false,
      evidence: null
    }
  ];

  const unsatisfiedRequiredConditions = conditions.filter((item) => item.required && !item.satisfied);

  const output = {
    generated_at: new Date().toISOString(),
    report: 'POST_P8_17_HISTORICAL_TASK_DOC_APPLY_GATE_RECHECK_REPORT',
    input_gate_report: GATE,
    input_preview_report: PREVIEW,
    input_owner_report: OWNER,
    output_report: OUTPUT,
    selected_group: SELECTED_GROUP,
    source_file_count: preview.reference_update_file_count,
    plan_item_count: preview.reference_update_plan_item_count,
    exact_reference_count: preview.expected_exact_reference_count,
    observed_exact_reference_count: preview.observed_exact_reference_count,
    affected_referencing_file_count: preview.affected_referencing_file_count,
    preview_mismatch_count: preview.mismatch_count,
    owner_confirmation_recorded: owner.owner_confirmation_recorded === true,
    preview_counts_matched: preview.mismatch_count === 0,
    runtime_surface_diff_zero: false,
    post_update_audit_would_be_zero: false,
    archive_move_gate_separate: false,
    apply_gate_open: false,
    apply_allowed: false,
    unsatisfied_required_condition_count: unsatisfiedRequiredConditions.length,
    unsatisfied_required_conditions: unsatisfiedRequiredConditions.map((item) => item.key),
    conditions,
    policy: {
      recheck_report_only: true,
      no_source_file_write: true,
      no_file_move: true,
      no_delete: true,
      no_reference_change: true,
      future_apply_requires_all_conditions: true
    },
    next_step: 'POST_P8_18_HISTORICAL_TASK_DOC_RUNTIME_SURFACE_DIFF_CHECK'
  };

  writeJson(OUTPUT, output);

  console.log(JSON.stringify({
    ok: true,
    output_report: OUTPUT,
    selected_group: output.selected_group,
    owner_confirmation_recorded: output.owner_confirmation_recorded,
    preview_counts_matched: output.preview_counts_matched,
    runtime_surface_diff_zero: output.runtime_surface_diff_zero,
    post_update_audit_would_be_zero: output.post_update_audit_would_be_zero,
    archive_move_gate_separate: output.archive_move_gate_separate,
    apply_gate_open: output.apply_gate_open,
    apply_allowed: output.apply_allowed,
    unsatisfied_required_condition_count: output.unsatisfied_required_condition_count,
    next_step: output.next_step
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
