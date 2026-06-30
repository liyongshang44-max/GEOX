// scripts/maintenance/POST_P8_06_APPLY_REPO_WIDE_CLEANUP_PLAN.cjs
// Purpose: apply archive moves from the repository-wide cleanup plan and rewrite safe text references.
// Boundary: moves only safe archive/archive_rewrite files; never moves runtime, frontend, database, package, CI, current P8, current POST-P8, or governance acceptance anchors.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const PLAN_PATH = 'docs/legacy/POST_P8_REPO_WIDE_CLEANUP_PLAN.json';
const APPLY = process.argv.includes('--apply');
const LIMIT_ARG = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : Infinity;
const FORBIDDEN_PREFIXES = [
  '.github/',
  'apps/',
  'packages/',
  'db/',
  'prisma/',
  'migrations/',
  'seeds/',
  'docker/',
  'docs/tasks/P8-',
  'docs/tasks/POST-P8-',
  'scripts/twin_kernel/P8_',
  'scripts/governance_acceptance/',
  'scripts/maintenance/POST_P8_',
];
const FORBIDDEN_FILES = new Set([
  'README.md',
  'README_MIGRATION.md',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'docs/SSOT.md',
  'docs/REPOSITORY_HANDOFF_MAP.md',
  'docs/twin_kernel/README.md',
  'scripts/README.md',
  'scripts/twin_kernel/README.md',
]);
const REWRITE_FORBIDDEN_PREFIXES = [
  '.github/',
  'apps/',
  'packages/',
  'db/',
  'prisma/',
  'migrations/',
  'seeds/',
  'docker/',
  'scripts/acceptance/',
  'scripts/governance_acceptance/',
  'docs/tasks/P8-',
  'docs/tasks/POST-P8-',
];
const REWRITE_FORBIDDEN_FILES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'docs/SSOT.md',
  'docs/REPOSITORY_HANDOFF_MAP.md',
  'docs/twin_kernel/README.md',
  'scripts/README.md',
  'scripts/twin_kernel/README.md',
]);

function abs(file) {
  return path.resolve(ROOT, file);
}

function exists(file) {
  return fs.existsSync(abs(file));
}

function mkdirFor(file) {
  fs.mkdirSync(path.dirname(abs(file)), { recursive: true });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(abs(file), 'utf8'));
}

function isForbidden(file) {
  return FORBIDDEN_FILES.has(file) || FORBIDDEN_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function isRewriteForbidden(file) {
  return REWRITE_FORBIDDEN_FILES.has(file) || REWRITE_FORBIDDEN_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function isSafeCandidate(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.action !== 'archive' && item.action !== 'archive_rewrite') return false;
  if (isForbidden(String(item.file || ''))) return false;
  const rewriteReferences = Array.isArray(item.rewrite_references) ? item.rewrite_references : [];
  return !rewriteReferences.some((ref) => isRewriteForbidden(String(ref || '')));
}

function rewriteReferences(item) {
  const source = item.file;
  const destination = item.destination;
  const references = Array.isArray(item.rewrite_references) ? item.rewrite_references : [];
  const rewritten = [];
  for (const ref of references) {
    if (isRewriteForbidden(ref)) throw new Error(`FORBIDDEN_REWRITE_REFERENCE:${ref}`);
    if (!exists(ref)) continue;
    const current = fs.readFileSync(abs(ref), 'utf8');
    if (!current.includes(source)) continue;
    const next = current.split(source).join(destination);
    if (APPLY) fs.writeFileSync(abs(ref), next, 'utf8');
    rewritten.push(ref);
  }
  return rewritten;
}

function moveOne(item) {
  const source = item.file;
  const destination = item.destination;
  if (!destination) throw new Error(`MISSING_DESTINATION:${source}`);
  if (isForbidden(source)) throw new Error(`FORBIDDEN_ARCHIVE_SOURCE:${source}`);

  const rewritten = item.action === 'archive_rewrite' ? rewriteReferences(item) : [];
  const sourceExists = exists(source);
  const destinationExists = exists(destination);
  if (!sourceExists && destinationExists) return { source, destination, rewritten, status: 'already_migrated' };
  if (!sourceExists && !destinationExists) throw new Error(`MISSING_SOURCE_AND_DESTINATION:${source}`);
  if (sourceExists && destinationExists) {
    const sourceContent = fs.readFileSync(abs(source), 'utf8');
    const destinationContent = fs.readFileSync(abs(destination), 'utf8');
    if (sourceContent !== destinationContent) throw new Error(`DESTINATION_CONFLICT:${destination}`);
    if (APPLY) fs.unlinkSync(abs(source));
    return { source, destination, rewritten, status: APPLY ? 'removed_duplicate_source' : 'would_remove_duplicate_source' };
  }
  if (APPLY) {
    mkdirFor(destination);
    fs.renameSync(abs(source), abs(destination));
  }
  return { source, destination, rewritten, status: APPLY ? 'migrated' : 'would_migrate' };
}

try {
  if (!exists(PLAN_PATH)) throw new Error(`MISSING_PLAN:${PLAN_PATH}`);
  const plan = readJson(PLAN_PATH);
  const allCandidates = (Array.isArray(plan.items) ? plan.items : [])
    .filter((item) => item.action === 'archive' || item.action === 'archive_rewrite')
    .filter((item) => !isForbidden(String(item.file || '')));
  const skippedUnsafeCandidates = allCandidates.filter((item) => !isSafeCandidate(item));
  const candidates = allCandidates
    .filter(isSafeCandidate)
    .slice(0, Number.isFinite(LIMIT) ? LIMIT : undefined);
  const results = [];
  for (const item of candidates) results.push(moveOne(item));

  console.log(JSON.stringify({
    ok: true,
    action: 'POST_P8_06_APPLY_REPO_WIDE_CLEANUP_PLAN',
    apply: APPLY,
    plan: PLAN_PATH,
    candidate_count: candidates.length,
    skipped_unsafe_candidate_count: skippedUnsafeCandidates.length,
    migrated_count: results.filter((item) => item.status === 'migrated').length,
    already_migrated_count: results.filter((item) => item.status === 'already_migrated').length,
    would_migrate_count: results.filter((item) => item.status === 'would_migrate').length,
    rewritten_reference_file_count: [...new Set(results.flatMap((item) => item.rewritten || []))].length,
    results,
    skipped_unsafe_candidates: skippedUnsafeCandidates.map((item) => ({
      file: item.file,
      action: item.action,
      destination: item.destination,
      forbidden_rewrite_references: (Array.isArray(item.rewrite_references) ? item.rewrite_references : []).filter((ref) => isRewriteForbidden(String(ref || ''))),
    })).slice(0, 100),
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, action: 'POST_P8_06_APPLY_REPO_WIDE_CLEANUP_PLAN', error: error.message }, null, 2));
  process.exit(1);
}
