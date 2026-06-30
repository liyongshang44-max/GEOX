// scripts/maintenance/POST_P8_08_CLASSIFY_MANUAL_REVIEW_SET.cjs
// Purpose: classify the remaining manual-review cleanup set into deterministic groups.
// Boundary: writes a classification report only; does not move, delete, or rewrite files.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const INPUT_PLAN = 'docs/legacy/POST_P8_REPO_WIDE_CLEANUP_PLAN.json';
const OUTPUT_REPORT = 'docs/legacy/POST_P8_MANUAL_REVIEW_CLASSIFICATION_REPORT.json';

function abs(file) {
  return path.resolve(ROOT, file);
}

function exists(file) {
  return fs.existsSync(abs(file));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(abs(file), 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(abs(file)), { recursive: true });
  fs.writeFileSync(abs(file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function tryGit(args) {
  try {
    return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function classifyManualReviewFile(file) {
  if (file.startsWith('.github/')) return 'package_or_ci';
  if (file === 'package.json' || file === 'pnpm-lock.yaml' || file === 'pnpm-workspace.yaml') return 'package_or_ci';
  if (file.startsWith('apps/server/') || file.startsWith('apps/executor/') || file.startsWith('apps/telemetry-ingest/') || file.startsWith('apps/jobs/')) return 'runtime_surface';
  if (file.startsWith('apps/web/')) return 'frontend_surface';
  if (file.startsWith('db/') || file.startsWith('prisma/') || file.startsWith('migrations/') || file.startsWith('seeds/')) return 'database_or_migration';
  if (file === 'docs/SSOT.md' || file === 'docs/REPOSITORY_HANDOFF_MAP.md' || file === 'docs/twin_kernel/README.md') return 'current_p8_or_twin_anchor';
  if (/^docs\/tasks\/P8-/.test(file) || /^docs\/tasks\/TK/.test(file) || /^docs\/tasks\/TWIN-KERNEL/.test(file)) return 'current_p8_or_twin_anchor';
  if (/^scripts\/twin_kernel\/P8_/.test(file)) return 'current_p8_or_twin_anchor';
  if (/^scripts\/governance_acceptance\/P8_/.test(file) || /^scripts\/governance_acceptance\/POST_P8_/.test(file)) return 'current_governance_acceptance';
  if (/^scripts\/governance_acceptance\//.test(file)) return 'historical_governance_acceptance';
  if (/^docs\/tasks\//.test(file)) return 'historical_task_doc';
  if (/^docs\/legacy\//.test(file) || /^scripts\/legacy\//.test(file)) return 'generated_or_legacy_evidence';
  if (/^docs\/controlplane\//.test(file) || /^docs\/commercial\//.test(file) || /^docs\/delivery\//.test(file)) return 'domain_reference_doc';
  if (/^docs\//.test(file)) return 'domain_reference_doc';
  return 'unknown_manual_review';
}

function summarizeGroups(items) {
  const groups = new Map();
  for (const item of items) {
    const group = item.manual_review_group;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(item.file);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([group, files]) => ({
    group,
    count: files.length,
    sample_files: files.slice(0, 30),
  }));
}

function main() {
  if (!exists(INPUT_PLAN)) throw new Error(`MISSING_INPUT_PLAN:${INPUT_PLAN}`);
  const plan = readJson(INPUT_PLAN);
  const manualReviewItems = (Array.isArray(plan.items) ? plan.items : []).filter((item) => item.action === 'manual_review');
  const classifiedItems = manualReviewItems.map((item) => ({
    file: item.file,
    manual_review_group: classifyManualReviewFile(String(item.file || '')),
    reason: item.reason || null,
    exact_reference_count: item.exact_reference_count || 0,
    strong_reference_count: item.strong_reference_count || 0,
    exact_references: Array.isArray(item.exact_references) ? item.exact_references.slice(0, 50) : [],
    strong_references: Array.isArray(item.strong_references) ? item.strong_references : [],
  }));
  const groupSummary = summarizeGroups(classifiedItems);
  const output = {
    generated_at: new Date().toISOString(),
    report: 'POST_P8_MANUAL_REVIEW_CLASSIFICATION_REPORT',
    input_plan: INPUT_PLAN,
    output_report: OUTPUT_REPORT,
    source_plan_tracked_file_count: plan.tracked_file_count,
    source_plan_manual_review_count: plan.manual_review_count,
    manual_review_count: manualReviewItems.length,
    classified_manual_review_count: classifiedItems.length,
    group_count: groupSummary.length,
    groups: groupSummary,
    items: classifiedItems,
    policy: {
      classification_only: true,
      no_file_move: true,
      no_delete: true,
      no_runtime_change: true,
      next_step_requires_group_decision: true,
    },
    git_head: tryGit(['rev-parse', 'HEAD']),
  };
  writeJson(OUTPUT_REPORT, output);
  console.log(JSON.stringify({
    ok: true,
    output_report: OUTPUT_REPORT,
    manual_review_count: output.manual_review_count,
    classified_manual_review_count: output.classified_manual_review_count,
    group_count: output.group_count,
    groups: output.groups,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
}
