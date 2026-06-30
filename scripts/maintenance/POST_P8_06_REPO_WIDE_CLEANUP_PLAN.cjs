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

function abs(file) {
  return path.resolve(ROOT, file);
}

function exists(file) {
  return fs.existsSync(abs(file));
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

function classify(file, exactRefs, strongRefs) {
  if (isProtected(file)) return { action: 'keep', reason: 'protected_current_or_runtime_surface' };
  if (strongRefs.length > 0) return { action: 'manual_review', reason: 'referenced_by_strong_entrypoint' };
  if (exactRefs.some((ref) => !ref.startsWith('docs/legacy/') && !ref.startsWith('scripts/legacy/'))) {
    return { action: 'manual_review', reason: 'referenced_by_current_non_legacy_file' };
  }
  if (/^docs\/tasks\//.test(file)) return { action: 'archive', reason: 'historical_task_doc_unreferenced' };
  if (/^scripts\/twin_kernel\/P[0-7]_/.test(file)) return { action: 'archive', reason: 'historical_replay_script_unreferenced' };
  if (/^scripts\/governance_acceptance\//.test(file) && !file.includes('P8_') && !file.includes('POST_P8_')) {
    return { action: 'archive', reason: 'historical_governance_acceptance_unreferenced' };
  }
  if (/^scripts\/DELIVERY\//.test(file)) return { action: 'archive', reason: 'historical_delivery_script_unreferenced' };
  if (/^scripts\/[^/]+\.ps1$/i.test(file)) return { action: 'archive', reason: 'historical_powershell_script_unreferenced' };
  if (/^(dist|build|coverage|\.turbo|\.next|tmp|temp|out)\//.test(file)) return { action: 'delete', reason: 'tracked_generated_artifact_unreferenced' };
  return { action: 'manual_review', reason: 'unknown_or_domain_specific' };
}

function main() {
  const files = trackedFiles();
  const textSources = files.filter(isTextFile).map((file) => ({ file, text: readText(file) }));
  const strongTextSources = textSources.filter((source) => isStrongEntrypoint(source.file));

  const items = files.map((file) => {
    const exactRefs = isTextFile(file) ? exactReferenceSources(file, textSources) : [];
    const strongRefs = isTextFile(file) ? exactReferenceSources(file, strongTextSources) : [];
    const classification = classify(file, exactRefs, strongRefs);
    return {
      file,
      action: classification.action,
      reason: classification.reason,
      destination: classification.action === 'archive' ? destinationFor(file) : null,
      exact_reference_count: exactRefs.length,
      exact_references: exactRefs.slice(0, 50),
      strong_reference_count: strongRefs.length,
      strong_references: strongRefs,
    };
  });

  const summary = {
    keep_count: items.filter((item) => item.action === 'keep').length,
    archive_candidate_count: items.filter((item) => item.action === 'archive').length,
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
      archive_requires_no_strong_reference: true,
      archive_requires_no_current_exact_reference: true,
      delete_requires_generated_artifact_policy: true,
      current_runtime_surfaces_are_protected: true,
    },
    ...summary,
    items,
  };

  fs.mkdirSync(path.dirname(abs(OUTPUT_PLAN)), { recursive: true });
  fs.writeFileSync(abs(OUTPUT_PLAN), `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, output_plan: OUTPUT_PLAN, ...summary, tracked_file_count: files.length, text_file_count: textSources.length }, null, 2));
}

main();
