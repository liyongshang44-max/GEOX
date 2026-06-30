// scripts/maintenance/POST_P8_16_RECORD_HISTORICAL_TASK_DOC_OWNER_CONFIRMATION.cjs
// Purpose: record owner confirmation for the historical_task_doc governance sequence.
// Boundary: writes a report only; does not move, delete, or change source files.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PREVIEW = 'docs/legacy/POST_P8_15_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PREVIEW_REPORT.json';
const GATE = 'docs/legacy/POST_P8_14_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_APPLY_GATE_REPORT.json';
const OUTPUT = 'docs/legacy/POST_P8_16_HISTORICAL_TASK_DOC_OWNER_CONFIRMATION_REPORT.json';
const SELECTED_GROUP = 'historical_task_doc';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  if (!fs.existsSync(PREVIEW)) throw new Error(`MISSING_PREVIEW:${PREVIEW}`);
  if (!fs.existsSync(GATE)) throw new Error(`MISSING_GATE:${GATE}`);
  const preview = readJson(PREVIEW);
  const gate = readJson(GATE);
  if (preview.selected_group !== SELECTED_GROUP) throw new Error(`UNEXPECTED_PREVIEW_GROUP:${preview.selected_group}`);
  if (gate.selected_group !== SELECTED_GROUP) throw new Error(`UNEXPECTED_GATE_GROUP:${gate.selected_group}`);
  if (preview.apply_allowed !== false) throw new Error('UNEXPECTED_PREVIEW_APPLY_ALLOWED');
  if (gate.apply_gate_open !== false) throw new Error('UNEXPECTED_GATE_OPEN');

  const output = {
    generated_at: new Date().toISOString(),
    report: 'POST_P8_16_HISTORICAL_TASK_DOC_OWNER_CONFIRMATION_REPORT',
    input_preview_report: PREVIEW,
    input_gate_report: GATE,
    output_report: OUTPUT,
    selected_group: SELECTED_GROUP,
    owner_confirmation_recorded: true,
    owner_confirmation_scope: 'governance_progression_only',
    owner_confirmation_source: 'interactive_operator_instruction_next_step',
    source_file_count: preview.reference_update_file_count,
    plan_item_count: preview.reference_update_plan_item_count,
    exact_reference_count: preview.expected_exact_reference_count,
    observed_exact_reference_count: preview.observed_exact_reference_count,
    affected_referencing_file_count: preview.affected_referencing_file_count,
    preview_mismatch_count: preview.mismatch_count,
    apply_allowed: false,
    source_file_change_allowed: false,
    file_move_allowed: false,
    conditions: {
      owner_confirmation_recorded: true,
      preview_report_generated: true,
      preview_counts_matched: preview.mismatch_count === 0,
      apply_gate_open: false,
    },
    policy: {
      owner_record_only: true,
      no_source_file_write: true,
      no_file_move: true,
      no_delete: true,
      no_reference_change: true,
      future_apply_requires_gate_recheck: true,
    },
    next_step: 'POST_P8_17_HISTORICAL_TASK_DOC_APPLY_GATE_RECHECK',
  };
  writeJson(OUTPUT, output);
  console.log(JSON.stringify({
    ok: true,
    output_report: OUTPUT,
    selected_group: output.selected_group,
    owner_confirmation_recorded: output.owner_confirmation_recorded,
    source_file_count: output.source_file_count,
    plan_item_count: output.plan_item_count,
    exact_reference_count: output.exact_reference_count,
    observed_exact_reference_count: output.observed_exact_reference_count,
    affected_referencing_file_count: output.affected_referencing_file_count,
    preview_mismatch_count: output.preview_mismatch_count,
    apply_allowed: output.apply_allowed,
    next_step: output.next_step,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
