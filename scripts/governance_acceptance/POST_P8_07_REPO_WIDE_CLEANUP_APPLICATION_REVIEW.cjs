// scripts/governance_acceptance/POST_P8_07_REPO_WIDE_CLEANUP_APPLICATION_REVIEW.cjs
// Purpose: verify the applied repo-wide low-risk cleanup batch after POST-P8-06.
// Boundary: read-only verification; does not move, delete, or rewrite files.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'POST_P8_07_REPO_WIDE_CLEANUP_APPLICATION_REVIEW';
const PLAN_PATH = 'docs/legacy/POST_P8_REPO_WIDE_CLEANUP_PLAN.json';
const EXPECTED_SAFE_CANDIDATE_COUNT = 42;
const CURRENT_ANCHORS = [
  'README_MIGRATION.md',
  'docs/SSOT.md',
  'docs/REPOSITORY_HANDOFF_MAP.md',
  'docs/twin_kernel/README.md',
  'docs/tasks/P8-00-Real-Evidence-Closed-Loop-Planning.md',
  'docs/tasks/P8-10-Real-Evidence-Closed-Loop-Completion-Review.md',
  'scripts/twin_kernel/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs',
  'scripts/governance_acceptance/P8_10_REAL_EVIDENCE_CLOSED_LOOP_COMPLETION_REVIEW.cjs',
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
  'scripts/governance_acceptance/ACCEPTANCE_',
  'scripts/governance_acceptance/H',
  'scripts/governance_acceptance/P',
  'scripts/governance_acceptance/TK',
  'scripts/governance_acceptance/TWIN_',
];
const FORBIDDEN_CHANGED_FILES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'docs/SSOT.md',
  'docs/REPOSITORY_HANDOFF_MAP.md',
  'docs/twin_kernel/README.md',
  'docs/tasks/P8-00-Real-Evidence-Closed-Loop-Planning.md',
]);
const assertions = [];

function abs(file) {
  return path.resolve(ROOT, file);
}

function exists(file) {
  return fs.existsSync(abs(file));
}

function read(file) {
  return fs.readFileSync(abs(file), 'utf8');
}

function readJson(file) {
  return JSON.parse(read(file));
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

function isSafeCandidate(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.action !== 'archive' && item.action !== 'archive_rewrite') return false;
  if (!item.destination) return false;
  if (String(item.file || '').startsWith('scripts/governance_acceptance/')) return false;
  if (String(item.file || '').startsWith('docs/tasks/TK')) return false;
  if (String(item.file || '').startsWith('docs/tasks/TWIN-KERNEL')) return false;
  if (String(item.file || '').startsWith('docs/tasks/P8-')) return false;
  return true;
}

try {
  assert('post_p8_07_doc_exists', exists('docs/tasks/POST-P8-07-Repo-Wide-Cleanup-Application-Review.md'), {});
  assert('plan_exists', exists(PLAN_PATH), { PLAN_PATH });

  const plan = readJson(PLAN_PATH);
  assert('plan_name_valid', plan.plan === 'POST_P8_REPO_WIDE_CLEANUP_PLAN', { plan: plan.plan });

  const safeCandidates = plan.items.filter(isSafeCandidate);
  assert('safe_candidate_count_matches_expected', safeCandidates.length === EXPECTED_SAFE_CANDIDATE_COUNT, { safe_candidate_count: safeCandidates.length, expected: EXPECTED_SAFE_CANDIDATE_COUNT });

  for (const item of safeCandidates) {
    assert(`source_absent:${item.file}`, !exists(item.file), { source: item.file, destination: item.destination });
    assert(`destination_present:${item.destination}`, exists(item.destination), { source: item.file, destination: item.destination });
  }

  for (const anchor of CURRENT_ANCHORS) assert(`current_anchor_intact:${anchor}`, exists(anchor), { anchor });

  const changed = changedFilesFromMain();
  const forbiddenChanged = changed.filter((file) => FORBIDDEN_CHANGED_FILES.has(file) || FORBIDDEN_CHANGED_PREFIXES.some((prefix) => file.startsWith(prefix)));
  assert('runtime_surface_unchanged', forbiddenChanged.length === 0, { forbiddenChanged, changed });

  const readmeMigration = read('README_MIGRATION.md');
  assert('readme_migration_legacy_paths_recorded', readmeMigration.includes('scripts/legacy/powershell/ACCEPTANCE_AO_ACT_AUTHZ_V0.ps1'), {});
  assert('delivery_legacy_paths_recorded', readmeMigration.includes('scripts/legacy/delivery/ACCEPTANCE_DELIVERY_ENVELOPE_V0.ps1'), {});

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    applied_candidate_count: safeCandidates.length,
    sources_absent: true,
    destinations_present: true,
    current_anchors_intact: true,
    runtime_surface_unchanged: true,
    repo_wide_cleanup_application_verified: true,
    changed_file_count: changed.length,
    changed_files: changed,
    ...summary(),
    next_step: 'POST_P8_08_MANUAL_REVIEW_CLASSIFICATION_PLAN'
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
