// scripts/maintenance/POST_P8_12_DECIDE_HISTORICAL_TASK_DOC_ARCHIVE.cjs
// Purpose: convert POST-P8-11 reference audit into a deterministic archive decision.
// Boundary: writes a decision report only; does not move, delete, or rewrite files.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const AUDIT = 'docs/legacy/POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT_REPORT.json';
const OUTPUT = 'docs/legacy/POST_P8_12_HISTORICAL_TASK_DOC_ARCHIVE_DECISION_REPORT.json';
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
  const audit = readJson(AUDIT);
  if (audit.selected_group !== SELECTED_GROUP) throw new Error(`UNEXPECTED_GROUP:${audit.selected_group}`);
  const auditedItems = Array.isArray(audit.audited_items) ? audit.audited_items : [];
  const decisions = auditedItems.map((item) => {
    const blockedByExactReference = item.exact_reference_count > 0;
    return {
      source_file: item.source_file,
      planned_destination: item.planned_destination,
      exact_reference_count: item.exact_reference_count,
      basename_reference_count: item.basename_reference_count,
      referencing_file_count: item.referencing_file_count,
      decision: blockedByExactReference ? 'blocked_by_exact_reference' : 'candidate_requires_separate_move_gate',
      archive_move_allowed: false,
      required_next_gate: blockedByExactReference
        ? 'reference_rewrite_plan'
        : 'separate_move_plan_after_owner_review',
    };
  }).sort((a, b) => a.source_file.localeCompare(b.source_file));
  const blockedCount = decisions.filter((item) => item.decision === 'blocked_by_exact_reference').length;
  const candidateCount = decisions.filter((item) => item.decision === 'candidate_requires_separate_move_gate').length;
  const output = {
    generated_at: new Date().toISOString(),
    report: 'POST_P8_12_HISTORICAL_TASK_DOC_ARCHIVE_DECISION_REPORT',
    input_audit_report: AUDIT,
    output_report: OUTPUT,
    selected_group: SELECTED_GROUP,
    audit_planned_file_count: audit.planned_file_count,
    audit_audited_file_count: audit.audited_file_count,
    audit_files_with_exact_references: audit.files_with_exact_references,
    audit_total_exact_reference_count: audit.total_exact_reference_count,
    decision_file_count: decisions.length,
    blocked_by_exact_reference_count: blockedCount,
    candidate_requires_separate_move_gate_count: candidateCount,
    archive_move_allowed: false,
    decisions,
    policy: {
      decision_report_only: true,
      no_file_move: true,
      no_delete: true,
      no_reference_rewrite: true,
      archive_requires_future_apply_gate: true,
      rewrite_requires_future_apply_gate: true,
    },
    next_step: 'POST_P8_13_HISTORICAL_TASK_DOC_REFERENCE_REWRITE_PLAN',
  };
  writeJson(OUTPUT, output);
  console.log(JSON.stringify({
    ok: true,
    output_report: OUTPUT,
    selected_group: output.selected_group,
    decision_file_count: output.decision_file_count,
    blocked_by_exact_reference_count: output.blocked_by_exact_reference_count,
    candidate_requires_separate_move_gate_count: output.candidate_requires_separate_move_gate_count,
    archive_move_allowed: output.archive_move_allowed,
    next_step: output.next_step,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
