// scripts/maintenance/POST_P8_06_REPO_WIDE_CLEANUP_PLAN.cjs
// Purpose: generate a repository-wide cleanup plan from tracked files and exact-path references.
// Boundary: writes cleanup plan JSON only; does not move, delete, or modify runtime files.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const OUTPUT_PLAN = 'docs/legacy/POST_P8_REPO_WIDE_CLEANUP_PLAN.json';
const TEXT_EXTENSIONS = new Set(['.md', '.txt', '.json', '.cjs', '.mjs', '.js', '.ts', '.tsx', '.jsx', '.yml', '.yaml', '.ps1', '.sql', '.html', '.css']);
const PROTECTED_PATHS = new Set([
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
const PROTECTED_PREFIXES = [
  '.github/',
  'apps/',
  'packages/',
  'db/',
  'prisma/',
  'migrations/',
  'seeds/',
  'docker/',
  'docs/legacy/',
  'docs/tasks/P8-',
  'docs/tasks/POST-P8-',
  'scripts/twin_kernel/P8_',
  'scripts/governance_acceptance/P8_',
  'scripts/governance_acceptance/POST_P8_',
  'scripts/maintenance/POST_P8_',
];
const STRONG_ENTRYPOINTS = [
  'package.json',
  'README.md',
  'README_MIGRATION.md',
  'docs/SSOT.md',
  'docs/REPOSITORY_HANDOFF_MAP.md',
  'docs/twin_kernel/README.md',
  'scripts/README.md',
  'scripts/twin_kernel/README.md',
  'scripts/acceptance/run_acceptance.cjs',
];
const STRONG_ENTRYPOINT_PREFIXES = ['.github/workflows/'];
const NON_REWRITE_REFERENCE_PREFIXES = [
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
const NON_REWRITE_REFERENCE_FILES = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'docs/SSOT.md',
  'docs/REPOSITORY_HANDOFF_MAP.md',
  'docs/twin_kernel/README.md',
  'scripts/README.md',
  'scripts/twin_kernel/README.md',
]);
const REWRITE_ALLOWED_PREFIXES = [
  'docs/',
  'scripts/',
  'README_MIGRATION.md',
  'README.md',
];

function abs(file) {
  return path.resolve(ROOT, file);
}

function execGit(args) {
  return childProcess.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function trackedFiles() {
  return execGit(['ls-files']).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).sort();
}

function isTextFile(file) {
  return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function readText(file) {
  try {
    return fs.readFileSync(abs(file), 'utf8');
  } catch {
    return '';
  }
}

function isProtected(file) {
  if (PROTECTED_PATHS.has(file)) return true;
  return PROTECTED_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function isStrongEntrypoint(file) {
  if (STRONG_ENTRYPOINTS.includes(file)) return true;
  return STRONG_ENTRYPOINT_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function isTwinBoundaryTaskDoc(file) {
  if (/^docs\/tasks\/TK/.test(file)) return true;
  if (/^docs\/tasks\/TWIN-KERNEL/.test(file)) return true;
  return false;
}

function destinationFor(file) {
  if (file.startsWith('docs/tasks/')) return `docs/legacy/tasks/${path.basename(file)}`;
  if (file.startsWith('scripts/twin_kernel/')) return `scripts/legacy/replay/${path.basename(file)}`;
  if (file.startsWith('scripts/governance_acceptance/')) return `scripts/legacy/acceptance/${path.basename(file)}`;
  if (file.startsWith('scripts/DELIVERY/')) return `scripts/legacy/delivery/${path.basename(file)}`;
  if (/^scripts\/[^/]+\.ps1$/i.test(file)) return `scripts/legacy/powershell/${path.basename(file)}`;
  if (file.startsWith('docs/')) return `docs/legacy/unclassified/${file.replace(/\//g, '__')}`;
  if (file.startsWith('scripts/')) return `scripts/legacy/unclassified/${file.replace(/\//g, '__')}`;
  return `docs/legacy/unclassified/${file.replace(/\//g, '__')}`;
}

function exactReferenceSources(file, textSources) {
  const references = [];
  for (const source of textSources) {
    if (source.file === file) continue;
    if (source.text.includes(file)) references.push(source.file);
  }
  return references.sort();
}

function isHistoricalArchivableShape(file) {
  if (isTwinBoundaryTaskDoc(file)) return false;
  if (/^docs\/tasks\//.test(file)) return true;
  if (/^scripts\/twin_kernel\/P[0-7]_/.test(file)) return true;
  if (/^scripts\/governance_acceptance\//.test(file) && !file.includes('P8_') && !file.includes('POST_P8_')) return true;
  if (/^scripts\/DELIVERY\//.test(file)) return true;
  if (/^scripts\/[^/]+\.ps1$/i.test(file)) return true;
  return false;
}

function isRewriteAllowedReferenceSource(ref) {
  if (NON_REWRITE_REFERENCE_FILES.has(ref)) return false;
  if (NON_REWRITE_REFERENCE_PREFIXES.some((prefix) => ref.startsWith(prefix))) return false;
  return REWRITE_ALLOWED_PREFIXES.some((prefix) => ref.startsWith(prefix));
}

function classify(file, exactRefs, strongRefs) {
  if (isProtected(file)) return { action: 'keep', reason: 'protected_current_or_runtime_surface' };
  if (isTwinBoundaryTaskDoc(file)) return { action: 'manual_review', reason: 'twin_boundary_task_doc_requires_manual_review' };
  if (isHistoricalArchivableShape(file)) {
    const nonRewriteRefs = exactRefs.filter((ref) => !isRewriteAllowedReferenceSource(ref));
    if (nonRewriteRefs.length === 0) {
      if (exactRefs.length === 0) return { action: 'archive', reason: 'historical_file_unreferenced' };
      return { action: 'archive_rewrite', reason: 'historical_file_referenced_only_by_rewrite_allowed_text', rewrite_reference_count: exactRefs.length };
    }
    return { action: 'manual_review', reason: 'historical_file_referenced_by_non_rewrite_source' };
  }
  if (strongRefs.length > 0) return { action: 'manual_review', reason: 'referenced_by_strong_entrypoint' };
  if (exactRefs.some((ref) => !ref.startsWith('docs/legacy/') && !ref.startsWith('scripts/legacy/'))) {
    return { action: 'manual_review', reason: 'referenced_by_current_non_legacy_file' };
  }
  if (/^(dist|build|coverage|\.turbo|\.next|tmp|temp|out)\//.test(file)) return { action: 'delete', reason: 'tracked_generated_artifact_unreferenced' };
  return { action: 'manual_review', reason: 'unknown_or_domain_specific' };
}

function main() {
  const files = trackedFiles();
  const textSources = files.filter(isTextFile).map((file) => ({ file, text: readText(file) }));
  const strongTextSources = textSources.filter((source) => isStrongEntrypoint(source.file));

  const items = files.map((file) => {
    const exactRefs = exactReferenceSources(file, textSources);
    const strongRefs = exactReferenceSources(file, strongTextSources);
    const classification = classify(file, exactRefs, strongRefs);
    const destination = classification.action === 'archive' || classification.action === 'archive_rewrite' ? destinationFor(file) : null;
    return {
      file,
      action: classification.action,
      reason: classification.reason,
      destination,
      exact_reference_count: exactRefs.length,
      exact_references: exactRefs.slice(0, 100),
      strong_reference_count: strongRefs.length,
      strong_references: strongRefs,
      rewrite_reference_count: classification.rewrite_reference_count || 0,
      rewrite_references: classification.action === 'archive_rewrite' ? exactRefs : [],
    };
  });

  const summary = {
    keep_count: items.filter((item) => item.action === 'keep').length,
    archive_candidate_count: items.filter((item) => item.action === 'archive').length,
    archive_rewrite_candidate_count: items.filter((item) => item.action === 'archive_rewrite').length,
    archive_total_candidate_count: items.filter((item) => item.action === 'archive' || item.action === 'archive_rewrite').length,
    delete_candidate_count: items.filter((item) => item.action === 'delete').length,
    manual_review_count: items.filter((item) => item.action === 'manual_review').length,
  };

  const plan = {
    generated_at: new Date().toISOString(),
    plan: 'POST_P8_REPO_WIDE_CLEANUP_PLAN',
    tracked_file_count: files.length,
    text_file_count: textSources.length,
    strong_entrypoint_count: strongTextSources.length,
    output_plan: OUTPUT_PLAN,
    policy: {
      archive_without_rewrite_requires_no_exact_reference: true,
      archive_rewrite_requires_only_rewrite_allowed_references: true,
      delete_requires_generated_artifact_policy: true,
      current_runtime_surfaces_are_protected: true,
      twin_boundary_task_docs_require_manual_review: true,
      non_rewrite_reference_prefixes: NON_REWRITE_REFERENCE_PREFIXES,
      rewrite_allowed_prefixes: REWRITE_ALLOWED_PREFIXES,
    },
    ...summary,
    items,
  };

  fs.mkdirSync(path.dirname(abs(OUTPUT_PLAN)), { recursive: true });
  fs.writeFileSync(abs(OUTPUT_PLAN), `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, output_plan: OUTPUT_PLAN, ...summary, tracked_file_count: files.length, text_file_count: textSources.length }, null, 2));
}

main();
