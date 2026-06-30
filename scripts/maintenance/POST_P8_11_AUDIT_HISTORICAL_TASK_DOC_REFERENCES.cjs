// scripts/maintenance/POST_P8_11_AUDIT_HISTORICAL_TASK_DOC_REFERENCES.cjs
// Purpose: audit exact repository references to planned historical_task_doc files.
// Boundary: writes an audit report only; does not move, delete, or rewrite files.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const PLAN = 'docs/legacy/POST_P8_10_HISTORICAL_TASK_DOC_CLEANUP_PLAN.json';
const OUTPUT = 'docs/legacy/POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT_REPORT.json';
const SELECTED_GROUP = 'historical_task_doc';
const TEXT_FILE_LIMIT_BYTES = 1024 * 1024;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function gitFiles() {
  const output = childProcess.execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim();
  if (!output) return [];
  return output.split(/\r?\n/).filter(Boolean).sort();
}

function isReadableText(file) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile()) return false;
    if (stat.size > TEXT_FILE_LIMIT_BYTES) return false;
    const probe = fs.readFileSync(file, { encoding: null });
    return !probe.includes(0);
  } catch {
    return false;
  }
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = text.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}

function scanRefs(repoFiles, sourceFile) {
  const refs = [];
  const base = path.basename(sourceFile);
  for (const file of repoFiles) {
    if (file === sourceFile) continue;
    if (!isReadableText(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const exact = countOccurrences(text, sourceFile);
    const basename = countOccurrences(text, base);
    if (exact > 0 || basename > 0) {
      refs.push({ file, exact_reference_count: exact, basename_reference_count: basename });
    }
  }
  return refs.sort((a, b) => a.file.localeCompare(b.file));
}

function main() {
  if (!fs.existsSync(PLAN)) throw new Error(`MISSING_PLAN:${PLAN}`);
  const plan = readJson(PLAN);
  if (plan.selected_group !== SELECTED_GROUP) throw new Error(`UNEXPECTED_GROUP:${plan.selected_group}`);
  const plannedItems = Array.isArray(plan.planned_items) ? plan.planned_items : [];
  const repoFiles = gitFiles();
  const auditedItems = plannedItems.map((item) => {
    const sourceFile = item.source_file;
    const refs = scanRefs(repoFiles, sourceFile);
    const exactTotal = refs.reduce((sum, ref) => sum + ref.exact_reference_count, 0);
    const basenameTotal = refs.reduce((sum, ref) => sum + ref.basename_reference_count, 0);
    return {
      source_file: sourceFile,
      planned_destination: item.planned_destination,
      exact_reference_count: exactTotal,
      basename_reference_count: basenameTotal,
      referencing_file_count: refs.length,
      references: refs,
      move_candidate_after_audit: exactTotal === 0,
      move_now_allowed: false,
    };
  }).sort((a, b) => a.source_file.localeCompare(b.source_file));
  const output = {
    generated_at: new Date().toISOString(),
    report: 'POST_P8_11_HISTORICAL_TASK_DOC_REFERENCE_AUDIT_REPORT',
    input_plan_report: PLAN,
    output_report: OUTPUT,
    selected_group: SELECTED_GROUP,
    planned_file_count: plannedItems.length,
    audited_file_count: auditedItems.length,
    files_with_exact_references: auditedItems.filter((item) => item.exact_reference_count > 0).length,
    files_with_basename_references: auditedItems.filter((item) => item.basename_reference_count > 0).length,
    total_exact_reference_count: auditedItems.reduce((sum, item) => sum + item.exact_reference_count, 0),
    total_basename_reference_count: auditedItems.reduce((sum, item) => sum + item.basename_reference_count, 0),
    move_candidate_after_audit_count: auditedItems.filter((item) => item.move_candidate_after_audit).length,
    move_now_allowed: false,
    audited_items: auditedItems,
    policy: {
      audit_report_only: true,
      no_file_move: true,
      no_delete: true,
      no_reference_rewrite: true,
      requires_later_move_plan: true,
    },
    next_step: 'POST_P8_12_HISTORICAL_TASK_DOC_ARCHIVE_DECISION',
  };
  writeJson(OUTPUT, output);
  console.log(JSON.stringify({
    ok: true,
    output_report: OUTPUT,
    selected_group: output.selected_group,
    planned_file_count: output.planned_file_count,
    audited_file_count: output.audited_file_count,
    files_with_exact_references: output.files_with_exact_references,
    total_exact_reference_count: output.total_exact_reference_count,
    move_candidate_after_audit_count: output.move_candidate_after_audit_count,
    move_now_allowed: output.move_now_allowed,
    next_step: output.next_step,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
