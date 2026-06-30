// scripts/governance_acceptance/POST_P8_06_REPO_WIDE_CLEANUP_ENGINE_ACCEPTANCE.cjs
// Purpose: verify the repository-wide cleanup engine and generated plan.
// Boundary: verifies cleanup planning only; no runtime, frontend, database, package, or CI changes are required.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'POST_P8_06_REPO_WIDE_CLEANUP_ENGINE_ACCEPTANCE';
const PLAN_PATH = 'docs/legacy/POST_P8_REPO_WIDE_CLEANUP_PLAN.json';
const REQUIRED_FILES = [
  'docs/tasks/POST-P8-06-Cleanup-Batch-2-Archive-Remaining-Candidates.md',
  'scripts/maintenance/POST_P8_06_REPO_WIDE_CLEANUP_PLAN.cjs',
  'scripts/maintenance/POST_P8_06_APPLY_REPO_WIDE_CLEANUP_PLAN.cjs',
  'scripts/governance_acceptance/POST_P8_06_REPO_WIDE_CLEANUP_ENGINE_ACCEPTANCE.cjs',
];
const PROTECTED_CURRENT_FILES = [
  'README_MIGRATION.md',
  'docs/SSOT.md',
  'docs/REPOSITORY_HANDOFF_MAP.md',
  'docs/twin_kernel/README.md',
  'docs/tasks/P8-10-Real-Evidence-Closed-Loop-Completion-Review.md',
  'scripts/twin_kernel/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs',
  'scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs',
];
const FORBIDDEN_RUNTIME_PREFIXES = [
  'apps/server/',
  'apps/web/',
  'apps/executor/',
  'apps/telemetry-ingest/',
  'apps/jobs/',
  'packages/',
  'docker/',
  'db/',
  'prisma/',
  'migrations/',
  'seeds/',
  '.github/',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
];
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

function changedFilesFromMain() {
  const output = tryGit(['diff', '--name-only', 'main...HEAD']);
  return [...new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].sort();
}

function runNode(script) {
  return childProcess.execFileSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8' }).trim();
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

  runNode('scripts/maintenance/POST_P8_06_REPO_WIDE_CLEANUP_PLAN.cjs');
  assert('repo_wide_plan_generated', exists(PLAN_PATH), { plan: PLAN_PATH });

  const plan = readJson(PLAN_PATH);
  const archiveItems = plan.items.filter((item) => item.action === 'archive' || item.action === 'archive_rewrite');
  assert('plan_name_valid', plan.plan === 'POST_P8_REPO_WIDE_CLEANUP_PLAN', { plan: plan.plan });
  assert('tracked_file_count_positive', plan.tracked_file_count > 0, { tracked_file_count: plan.tracked_file_count });
  assert('archive_total_candidate_count_positive', archiveItems.length > 0, { archive_total_candidate_count: archiveItems.length });
  assert('archive_total_candidate_count_matches_summary', plan.archive_total_candidate_count === archiveItems.length, { archive_total_candidate_count: plan.archive_total_candidate_count, computed: archiveItems.length });
  assert('archive_rewrite_candidate_count_non_negative', plan.archive_rewrite_candidate_count >= 0, { archive_rewrite_candidate_count: plan.archive_rewrite_candidate_count });
  assert('manual_review_count_positive', plan.manual_review_count > 0, { manual_review_count: plan.manual_review_count });
  assert('delete_candidate_count_non_negative', plan.delete_candidate_count >= 0, { delete_candidate_count: plan.delete_candidate_count });

  for (const file of PROTECTED_CURRENT_FILES) {
    const item = plan.items.find((candidate) => candidate.file === file);
    assert(`protected_current_file_in_plan:${file}`, Boolean(item), { file });
    assert(`protected_current_file_kept:${file}`, item.action === 'keep', { file, action: item.action, reason: item.reason });
  }

  const forbiddenArchive = archiveItems.filter((item) => FORBIDDEN_RUNTIME_PREFIXES.some((prefix) => item.file.startsWith(prefix)));
  assert('no_runtime_surface_archive_candidates', forbiddenArchive.length === 0, { forbiddenArchive: forbiddenArchive.slice(0, 20) });

  const currentP8Archive = archiveItems.filter((item) => item.file.includes('/P8_') || item.file.includes('/P8-'));
  assert('no_current_p8_archive_candidates', currentP8Archive.length === 0, { currentP8Archive });

  const invalidRewrite = plan.items.filter((item) => item.action === 'archive_rewrite' && (!Array.isArray(item.rewrite_references) || item.rewrite_references.length === 0));
  assert('archive_rewrite_candidates_have_references', invalidRewrite.length === 0, { invalidRewrite: invalidRewrite.slice(0, 20) });

  const changed = changedFilesFromMain();
  const runtimeChanged = changed.filter((file) => FORBIDDEN_RUNTIME_PREFIXES.some((prefix) => file.startsWith(prefix)));
  assert('runtime_surface_unchanged', runtimeChanged.length === 0, { runtimeChanged, changed });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    repo_wide_plan_generated: true,
    tracked_file_count: plan.tracked_file_count,
    text_file_count: plan.text_file_count,
    archive_candidate_count: plan.archive_candidate_count,
    archive_rewrite_candidate_count: plan.archive_rewrite_candidate_count,
    archive_total_candidate_count: plan.archive_total_candidate_count,
    delete_candidate_count: plan.delete_candidate_count,
    manual_review_count: plan.manual_review_count,
    protected_current_material_verified: true,
    runtime_surface_unchanged: true,
    changed_file_count: changed.length,
    changed_files: changed,
    ...summary(),
    next_step: 'POST_P8_07_REPO_WIDE_CLEANUP_APPLICATION_REVIEW'
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
