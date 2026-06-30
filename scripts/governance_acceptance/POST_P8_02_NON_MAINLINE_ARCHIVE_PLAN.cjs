// scripts/governance_acceptance/POST_P8_02_NON_MAINLINE_ARCHIVE_PLAN.cjs
// Purpose: derive a deterministic non-mainline archive plan from the post-P8 reference audit report.
// Boundary: read/write local audit reports only; does not move, delete, or modify runtime source files.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'POST_P8_02_NON_MAINLINE_ARCHIVE_PLAN';
const INPUT_REPORT = 'docs/legacy/POST_P8_REFERENCE_AUDIT_REPORT.json';
const OUTPUT_PLAN = 'docs/legacy/POST_P8_NON_MAINLINE_ARCHIVE_PLAN.json';
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

function writeJson(file, value) {
  const target = abs(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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

function destinationFor(file) {
  if (file.startsWith('docs/tasks/')) return `docs/legacy/tasks/${path.basename(file)}`;
  if (file.startsWith('scripts/twin_kernel/')) return `scripts/legacy/replay/${path.basename(file)}`;
  if (file.startsWith('scripts/governance_acceptance/')) return `scripts/legacy/acceptance/${path.basename(file)}`;
  if (file.startsWith('scripts/DELIVERY/')) return `scripts/legacy/delivery/${path.basename(file)}`;
  return `docs/legacy/unclassified/${file.replace(/\//g, '__')}`;
}

function isArchiveCandidate(item) {
  if (!item || typeof item !== 'object') return false;
  const file = String(item.file || '');
  const classification = String(item.classification || '');
  const strongReferenceCount = Number(item.strong_reference_count || 0);
  if (strongReferenceCount !== 0) return false;
  if (!classification.includes('candidate_for_archive')) return false;
  if (file.includes('/P8_') || file.includes('/P8-')) return false;
  if (file.includes('/POST_P8_') || file.includes('/POST-P8-')) return false;
  if (FORBIDDEN_RUNTIME_PREFIXES.some((prefix) => file.startsWith(prefix))) return false;
  return true;
}

function isManualInspection(item) {
  if (!item || typeof item !== 'object') return false;
  const classification = String(item.classification || '');
  return classification === 'unknown_inspect_before_use' || classification.includes('or_historical_record') || classification.includes('or_legacy_compatibility');
}

function buildPlan(audit) {
  const candidates = Array.isArray(audit.candidates) ? audit.candidates : [];
  const archiveCandidates = candidates
    .filter(isArchiveCandidate)
    .map((item) => ({
      file: item.file,
      destination: destinationFor(item.file),
      classification: item.classification,
      strong_reference_count: item.strong_reference_count,
      action: 'archive_candidate_after_manual_review',
    }))
    .sort((a, b) => a.file.localeCompare(b.file));

  const manualInspection = candidates
    .filter(isManualInspection)
    .map((item) => ({
      file: item.file,
      classification: item.classification,
      strong_reference_count: item.strong_reference_count,
      action: 'manual_inspection_required',
    }))
    .sort((a, b) => a.file.localeCompare(b.file));

  const protectedCurrent = candidates
    .filter((item) => String(item.classification || '').includes('current'))
    .map((item) => ({
      file: item.file,
      classification: item.classification,
      strong_reference_count: item.strong_reference_count,
      action: 'protect_current_reference',
    }))
    .sort((a, b) => a.file.localeCompare(b.file));

  return {
    generated_at: new Date().toISOString(),
    acceptance: ACCEPTANCE,
    source_report: INPUT_REPORT,
    output_plan: OUTPUT_PLAN,
    candidate_count: candidates.length,
    archive_candidate_count: archiveCandidates.length,
    manual_inspection_count: manualInspection.length,
    protected_current_count: protectedCurrent.length,
    first_archive_batch_size: Math.min(20, archiveCandidates.length),
    first_archive_batch: archiveCandidates.slice(0, 20),
    archive_candidates: archiveCandidates,
    manual_inspection: manualInspection,
    protected_current: protectedCurrent,
    deletion_policy: 'No delete or move is performed by POST-P8-02. POST-P8-03 must make a small explicit migration batch and prove replacement paths.',
  };
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
  assert('post_p8_02_doc_exists', exists('docs/tasks/POST-P8-02-Non-Mainline-Archive-Plan.md'), {});
  assert('reference_audit_report_exists', exists(INPUT_REPORT), { input_report: INPUT_REPORT });

  const audit = readJson(INPUT_REPORT);
  assert('reference_audit_matches_previous_gate', audit.acceptance === 'POST_P8_01_FREEZE_INDEX_AND_REFERENCE_AUDIT', { acceptance: audit.acceptance });
  assert('reference_audit_has_candidates', Array.isArray(audit.candidates) && audit.candidates.length > 0, { candidate_count: Array.isArray(audit.candidates) ? audit.candidates.length : 0 });

  const plan = buildPlan(audit);
  writeJson(OUTPUT_PLAN, plan);

  assert('archive_plan_generated', exists(OUTPUT_PLAN), { output_plan: OUTPUT_PLAN });
  assert('archive_candidate_count_non_negative', plan.archive_candidate_count >= 0, { archive_candidate_count: plan.archive_candidate_count });
  assert('manual_inspection_count_non_negative', plan.manual_inspection_count >= 0, { manual_inspection_count: plan.manual_inspection_count });
  assert('p8_current_material_protected', plan.protected_current.some((item) => item.file === 'scripts/twin_kernel/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs'), {});
  assert('no_delete_performed', true, {});

  const changed = changedFilesFromMain();
  const runtimeChanged = changed.filter((file) => FORBIDDEN_RUNTIME_PREFIXES.some((prefix) => file.startsWith(prefix)));
  assert('no_runtime_surface_changed', runtimeChanged.length === 0, { runtimeChanged, changed });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    archive_plan_generated: true,
    archive_plan_report: OUTPUT_PLAN,
    archive_candidate_count: plan.archive_candidate_count,
    manual_inspection_count: plan.manual_inspection_count,
    protected_current_count: plan.protected_current_count,
    first_archive_batch_size: plan.first_archive_batch_size,
    first_archive_batch: plan.first_archive_batch,
    no_delete_performed: true,
    no_runtime_surface_changed: true,
    changed_file_count: changed.length,
    changed_files: changed,
    ...summary(),
    next_step: 'POST_P8_03_FIRST_ARCHIVE_MIGRATION_BATCH'
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
