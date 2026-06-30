// scripts/maintenance/POST_P8_15_PREVIEW_HISTORICAL_TASK_DOC_REFERENCE_UPDATE.cjs
// Purpose: create a preview report from the POST-P8-13 plan and POST-P8-14 gate.
// Boundary: writes a report only; does not modify repository source files.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PLAN = 'docs/legacy/POST_P8_13_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PLAN.json';
const GATE = 'docs/legacy/POST_P8_14_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_APPLY_GATE_REPORT.json';
const OUTPUT = 'docs/legacy/POST_P8_15_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PREVIEW_REPORT.json';
const SELECTED_GROUP = 'historical_task_doc';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while (true) {
    const found = text.indexOf(needle, index);
    if (found === -1) return count;
    count += 1;
    index = found + needle.length;
  }
}

function main() {
  if (!fs.existsSync(PLAN)) throw new Error(`MISSING_PLAN:${PLAN}`);
  if (!fs.existsSync(GATE)) throw new Error(`MISSING_GATE:${GATE}`);
  const plan = readJson(PLAN);
  const gate = readJson(GATE);
  if (plan.selected_group !== SELECTED_GROUP) throw new Error(`UNEXPECTED_PLAN_GROUP:${plan.selected_group}`);
  if (gate.selected_group !== SELECTED_GROUP) throw new Error(`UNEXPECTED_GATE_GROUP:${gate.selected_group}`);
  if (gate.apply_gate_open !== false) throw new Error('UNEXPECTED_GATE_OPEN');
  if (gate.reference_update_apply_allowed !== false) throw new Error('UNEXPECTED_GATE_APPLY_ALLOWED');

  const checks = [];
  const byReferencingFile = new Map();
  for (const filePlan of plan.file_plans || []) {
    for (const refPlan of filePlan.reference_plans || []) {
      const referencingFile = refPlan.referencing_file;
      const exists = fs.existsSync(referencingFile);
      const content = exists ? fs.readFileSync(referencingFile, 'utf8') : '';
      const observed = exists ? countOccurrences(content, refPlan.old_reference) : 0;
      const matched = observed === refPlan.exact_reference_count;
      const item = {
        referencing_file: referencingFile,
        source_file: filePlan.source_file,
        planned_destination: filePlan.planned_destination,
        expected_exact_reference_count: refPlan.exact_reference_count,
        observed_exact_reference_count: observed,
        count_matched: matched,
        file_exists: exists,
        apply_allowed: false,
      };
      checks.push(item);
      if (!byReferencingFile.has(referencingFile)) {
        byReferencingFile.set(referencingFile, {
          referencing_file: referencingFile,
          expected_exact_reference_count: 0,
          observed_exact_reference_count: 0,
          plan_item_count: 0,
          all_counts_matched: true,
          apply_allowed: false,
        });
      }
      const summary = byReferencingFile.get(referencingFile);
      summary.expected_exact_reference_count += refPlan.exact_reference_count;
      summary.observed_exact_reference_count += observed;
      summary.plan_item_count += 1;
      summary.all_counts_matched = summary.all_counts_matched && matched;
    }
  }

  checks.sort((a, b) => `${a.referencing_file}\n${a.source_file}`.localeCompare(`${b.referencing_file}\n${b.source_file}`));
  const referencing_file_summaries = [...byReferencingFile.values()].sort((a, b) => a.referencing_file.localeCompare(b.referencing_file));
  const expectedExactReferenceCount = checks.reduce((sum, item) => sum + item.expected_exact_reference_count, 0);
  const observedExactReferenceCount = checks.reduce((sum, item) => sum + item.observed_exact_reference_count, 0);
  const mismatches = checks.filter((item) => !item.count_matched);

  const output = {
    generated_at: new Date().toISOString(),
    report: 'POST_P8_15_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PREVIEW_REPORT',
    input_plan_report: PLAN,
    input_gate_report: GATE,
    output_report: OUTPUT,
    selected_group: SELECTED_GROUP,
    reference_update_file_count: plan.reference_update_file_count,
    reference_update_plan_item_count: checks.length,
    expected_exact_reference_count: expectedExactReferenceCount,
    observed_exact_reference_count: observedExactReferenceCount,
    affected_referencing_file_count: referencing_file_summaries.length,
    mismatch_count: mismatches.length,
    apply_allowed: false,
    gate_open: false,
    referencing_file_summaries,
    checks,
    policy: {
      preview_report_only: true,
      no_source_file_write: true,
      no_file_move: true,
      no_delete: true,
      no_reference_change: true,
    },
    next_step: 'POST_P8_16_HISTORICAL_TASK_DOC_OWNER_APPROVAL_RECORD',
  };
  writeJson(OUTPUT, output);
  console.log(JSON.stringify({
    ok: true,
    output_report: OUTPUT,
    selected_group: output.selected_group,
    reference_update_file_count: output.reference_update_file_count,
    reference_update_plan_item_count: output.reference_update_plan_item_count,
    expected_exact_reference_count: output.expected_exact_reference_count,
    observed_exact_reference_count: output.observed_exact_reference_count,
    affected_referencing_file_count: output.affected_referencing_file_count,
    mismatch_count: output.mismatch_count,
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
