// scripts/maintenance/POST_P8_13_PLAN_HISTORICAL_TASK_DOC_REFERENCE_UPDATE.cjs
// Purpose: convert POST-P8-11 and POST-P8-12 reports into a deterministic reference update plan.
// Boundary: writes a plan report only; does not move, delete, or change files.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const AUDIT = 'docs/legacy/POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT_REPORT.json';
const DECISION = 'docs/legacy/POST_P8_12_HISTORICAL_TASK_DOC_ARCHIVE_DECISION_REPORT.json';
const OUTPUT = 'docs/legacy/POST_P8_13_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PLAN.json';
const SELECTED_GROUP = 'historical_task_doc';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  if (!fs.existsSync(AUDIT)) throw new Error(`MISSING_AUDIT:${AUDIT}`);
  if (!fs.existsSync(DECISION)) throw new Error(`MISSING_DECISION:${DECISION}`);
  const audit = readJson(AUDIT);
  const decision = readJson(DECISION);
  if (audit.selected_group !== SELECTED_GROUP) throw new Error(`UNEXPECTED_AUDIT_GROUP:${audit.selected_group}`);
  if (decision.selected_group !== SELECTED_GROUP) throw new Error(`UNEXPECTED_DECISION_GROUP:${decision.selected_group}`);
  if (decision.archive_move_allowed !== false) throw new Error('UNEXPECTED_ARCHIVE_MOVE_ALLOWED');

  const decisionBySource = new Map((decision.decisions || []).map((item) => [item.source_file, item]));
  const filePlans = (audit.audited_items || []).map((item) => {
    const decisionItem = decisionBySource.get(item.source_file);
    const referencePlans = (item.references || [])
      .filter((ref) => ref.exact_reference_count > 0)
      .map((ref) => ({
        referencing_file: ref.file,
        old_reference: item.source_file,
        planned_reference: item.planned_destination,
        exact_reference_count: ref.exact_reference_count,
        update_apply_allowed: false,
      }))
      .sort((a, b) => a.referencing_file.localeCompare(b.referencing_file));
    return {
      source_file: item.source_file,
      planned_destination: item.planned_destination,
      decision: decisionItem ? decisionItem.decision : 'missing_decision',
      exact_reference_count: item.exact_reference_count,
      referencing_file_count: referencePlans.length,
      reference_plans: referencePlans,
      update_apply_allowed: false,
    };
  }).sort((a, b) => a.source_file.localeCompare(b.source_file));

  const referenceUpdateExactReferenceCount = filePlans.reduce((sum, item) => sum + item.exact_reference_count, 0);
  const referenceUpdatePlanItemCount = filePlans.reduce((sum, item) => sum + item.reference_plans.length, 0);
  const uniqueReferencingFiles = new Set();
  for (const filePlan of filePlans) {
    for (const refPlan of filePlan.reference_plans) uniqueReferencingFiles.add(refPlan.referencing_file);
  }

  const output = {
    generated_at: new Date().toISOString(),
    report: 'POST_P8_13_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_PLAN',
    input_audit_report: AUDIT,
    input_decision_report: DECISION,
    output_report: OUTPUT,
    selected_group: SELECTED_GROUP,
    audit_total_exact_reference_count: audit.total_exact_reference_count,
    decision_blocked_by_exact_reference_count: decision.blocked_by_exact_reference_count,
    reference_update_file_count: filePlans.length,
    reference_update_plan_item_count: referenceUpdatePlanItemCount,
    reference_update_exact_reference_count: referenceUpdateExactReferenceCount,
    affected_referencing_file_count: uniqueReferencingFiles.size,
    reference_update_apply_allowed: false,
    file_plans: filePlans,
    policy: {
      plan_report_only: true,
      no_file_move: true,
      no_delete: true,
      no_reference_change: true,
      requires_future_apply_gate: true,
    },
    next_step: 'POST_P8_14_HISTORICAL_TASK_DOC_REFERENCE_UPDATE_APPLY_GATE',
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
    reference_update_apply_allowed: output.reference_update_apply_allowed,
    next_step: output.next_step,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
