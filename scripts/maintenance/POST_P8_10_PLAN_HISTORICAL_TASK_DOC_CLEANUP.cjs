// scripts/maintenance/POST_P8_10_PLAN_HISTORICAL_TASK_DOC_CLEANUP.cjs
// Purpose: build a deterministic plan for the historical_task_doc group only.
// Boundary: writes a plan report only; does not move, delete, or rewrite files.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CLASSIFICATION = 'docs/legacy/POST_P8_MANUAL_REVIEW_CLASSIFICATION_REPORT.json';
const DECISION = 'docs/legacy/POST_P8_MANUAL_REVIEW_GROUP_DECISION_REPORT.json';
const OUTPUT = 'docs/legacy/POST_P8_10_HISTORICAL_TASK_DOC_CLEANUP_PLAN.json';
const SELECTED_GROUP = 'historical_task_doc';
const TARGET_ROOT = 'docs/legacy/tasks';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function destinationFor(file) {
  return `${TARGET_ROOT}/${path.basename(file)}`;
}

function main() {
  if (!fs.existsSync(CLASSIFICATION)) throw new Error(`MISSING_CLASSIFICATION:${CLASSIFICATION}`);
  if (!fs.existsSync(DECISION)) throw new Error(`MISSING_DECISION:${DECISION}`);
  const classification = readJson(CLASSIFICATION);
  const decision = readJson(DECISION);
  const decisionItem = (decision.decisions || []).find((item) => item.group === SELECTED_GROUP);
  if (!decisionItem) throw new Error(`MISSING_GROUP_DECISION:${SELECTED_GROUP}`);
  const items = (classification.items || [])
    .filter((item) => item.manual_review_group === SELECTED_GROUP)
    .map((item) => ({
      source_file: item.normalized_file || item.file,
      planned_destination: destinationFor(item.normalized_file || item.file),
      plan_action: 'candidate_after_reference_audit',
      apply_now_allowed: false,
      exact_reference_count: item.exact_reference_count || 0,
      strong_reference_count: item.strong_reference_count || 0,
      required_before_apply: [
        'exact_reference_audit',
        'destination_collision_check',
        'protected_anchor_recheck',
        'runtime_surface_diff_check',
      ],
    }))
    .sort((a, b) => a.source_file.localeCompare(b.source_file));
  const output = {
    generated_at: new Date().toISOString(),
    report: 'POST_P8_10_HISTORICAL_TASK_DOC_CLEANUP_PLAN',
    selected_group: SELECTED_GROUP,
    input_classification_report: CLASSIFICATION,
    input_decision_report: DECISION,
    output_report: OUTPUT,
    group_decision: decisionItem.decision,
    group_file_count: decisionItem.file_count,
    planned_file_count: items.length,
    apply_now_allowed: false,
    planned_target_root: TARGET_ROOT,
    planned_items: items,
    policy: {
      plan_only: true,
      no_file_move: true,
      no_delete: true,
      no_reference_rewrite: true,
      requires_next_reference_audit: true,
    },
    next_step: 'POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT',
  };
  writeJson(OUTPUT, output);
  console.log(JSON.stringify({
    ok: true,
    output_report: OUTPUT,
    selected_group: output.selected_group,
    group_decision: output.group_decision,
    group_file_count: output.group_file_count,
    planned_file_count: output.planned_file_count,
    apply_now_allowed: output.apply_now_allowed,
    planned_target_root: output.planned_target_root,
    next_step: output.next_step,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
