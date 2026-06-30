// scripts/governance_acceptance/POST_P8_08_MANUAL_REVIEW_CLASSIFICATION_ACCEPTANCE.cjs
// Purpose: verify manual-review classification after repo-wide low-risk cleanup.
// Boundary: classification-only acceptance; no file move, delete, runtime, frontend, database, package, or CI changes.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'POST_P8_08_MANUAL_REVIEW_CLASSIFICATION_ACCEPTANCE';
const INPUT_PLAN = 'docs/legacy/POST_P8_REPO_WIDE_CLEANUP_PLAN.json';
const OUTPUT_REPORT = 'docs/legacy/POST_P8_MANUAL_REVIEW_CLASSIFICATION_REPORT.json';
const REQUIRED_FILES = [
  'docs/tasks/POST-P8-08-Manual-Review-Classification-Plan.md',
  'scripts/maintenance/POST_P8_08_CLASSIFY_MANUAL_REVIEW_SET.cjs',
  'scripts/governance_acceptance/POST_P8_08_MANUAL_REVIEW_CLASSIFICATION_ACCEPTANCE.cjs',
];
const REQUIRED_GROUPS = [
  'runtime_surface',
  'frontend_surface',
  'database_or_migration',
  'package_or_ci',
  'current_governance_acceptance',
  'current_p8_or_twin_anchor',
  'historical_governance_acceptance',
  'domain_reference_doc',
];
const FORBIDDEN_CHANGED_PREFIXES = [
  '.github/',
  'apps/',
  'packages/',
  'db/',
  'prisma/',
  'migrations/',
  'seeds/',
  'docker/',
];
const FORBIDDEN_CHANGED_FILES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'docs/SSOT.md',
  'docs/REPOSITORY_HANDOFF_MAP.md',
  'docs/twin_kernel/README.md',
]);
const assertions = [];

function abs(file) {
  return path.resolve(ROOT, file);
}

function exists(file) {
  return fs.existsSync(abs(file));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(abs(file), 'utf8'));
}

function tryGit(args) {
  try {
    return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function runNode(script) {
  return childProcess.execFileSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8' }).trim();
}

function changedFilesFromMain() {
  const output = tryGit(['diff', '--name-only', 'main...HEAD']);
  return [...new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].sort();
}

function assert(name, condition, details = {}) {
  assertions.push({ name, passed: condition === true, details });
  if (condition !== true) {
    const error = new Error(`ASSERTION_FAILED:${name}`);
    error.details = details;
    throw error;
  }
}

function summary() {
  const failed = assertions.filter((item) => !item.passed);
  return {
    assertion_count: assertions.length,
    failed_assertion_count: failed.length,
    failed_assertions: failed.map((item) => item.name),
  };
}

try {
  for (const file of REQUIRED_FILES) assert(`required_file_exists:${file}`, exists(file), { file });
  assert('input_plan_exists', exists(INPUT_PLAN), { INPUT_PLAN });

  runNode('scripts/maintenance/POST_P8_08_CLASSIFY_MANUAL_REVIEW_SET.cjs');
  assert('manual_review_report_generated', exists(OUTPUT_REPORT), { OUTPUT_REPORT });

  const plan = readJson(INPUT_PLAN);
  const report = readJson(OUTPUT_REPORT);
  assert('report_name_valid', report.report === 'POST_P8_MANUAL_REVIEW_CLASSIFICATION_REPORT', { report: report.report });
  assert('manual_review_count_positive', report.manual_review_count > 0, { manual_review_count: report.manual_review_count });
  assert('manual_review_count_matches_plan', report.manual_review_count === plan.manual_review_count, { report: report.manual_review_count, plan: plan.manual_review_count });
  assert('classified_count_matches_manual_review_count', report.classified_manual_review_count === report.manual_review_count, { classified: report.classified_manual_review_count, manual: report.manual_review_count });
  assert('group_count_positive', report.group_count > 0, { group_count: report.group_count });

  const groupNames = new Set((Array.isArray(report.groups) ? report.groups : []).map((group) => group.group));
  for (const group of REQUIRED_GROUPS) assert(`required_group_present:${group}`, groupNames.has(group), { group, groupNames: [...groupNames] });

  const unclassified = (Array.isArray(report.items) ? report.items : []).filter((item) => !item.manual_review_group || item.manual_review_group === 'unknown_manual_review');
  assert('unknown_manual_review_bounded', unclassified.length <= Math.max(25, Math.floor(report.manual_review_count * 0.1)), { unknown_count: unclassified.length, manual_review_count: report.manual_review_count, samples: unclassified.slice(0, 20) });

  const changed = changedFilesFromMain();
  const forbiddenChanged = changed.filter((file) => FORBIDDEN_CHANGED_FILES.has(file) || FORBIDDEN_CHANGED_PREFIXES.some((prefix) => file.startsWith(prefix)));
  assert('no_runtime_surface_changed', forbiddenChanged.length === 0, { forbiddenChanged, changed });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    manual_review_report_generated: true,
    manual_review_count: report.manual_review_count,
    classified_manual_review_count: report.classified_manual_review_count,
    group_count: report.group_count,
    groups: report.groups,
    runtime_surface_group_present: groupNames.has('runtime_surface'),
    current_anchor_group_present: groupNames.has('current_p8_or_twin_anchor'),
    historical_group_present: groupNames.has('historical_governance_acceptance') || groupNames.has('historical_task_doc'),
    no_runtime_surface_changed: true,
    changed_file_count: changed.length,
    changed_files: changed,
    ...summary(),
    next_step: 'POST_P8_09_MANUAL_REVIEW_GROUP_DECISION'
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: ACCEPTANCE,
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
