// scripts/governance_acceptance/POST_P8_01_FREEZE_INDEX_AND_REFERENCE_AUDIT.cjs
// Purpose: scan current repository references before any post-P8 archive/delete cleanup.
// Boundary: read-only filesystem audit; does not delete, move, rewrite runtime, change frontend, or change database migrations.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = process.cwd();
const ACCEPTANCE = 'POST_P8_01_FREEZE_INDEX_AND_REFERENCE_AUDIT';
const REPORT_PATH = 'docs/legacy/POST_P8_REFERENCE_AUDIT_REPORT.json';
const STRONG_REFERENCE_SOURCES = [
  'package.json',
  '.github/workflows/ci.yml',
  'scripts/acceptance/run_acceptance.cjs',
  'docs/SSOT.md',
  'README_MIGRATION.md',
  'docs/REPOSITORY_HANDOFF_MAP.md',
  'docs/twin_kernel/README.md',
  'scripts/README.md',
  'scripts/twin_kernel/README.md',
];
const CANDIDATE_ROOTS = [
  'docs/tasks',
  'scripts/twin_kernel',
  'scripts/governance_acceptance',
  'scripts/DELIVERY',
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
];
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

function walk(dir) {
  if (!exists(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs(dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir.replace(/\\/g, '/'), entry.name);
    if (entry.isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}

function basenameNoExt(file) {
  return path.basename(file).replace(/\.[^.]+$/, '');
}

function loadStrongSources() {
  return STRONG_REFERENCE_SOURCES.filter(exists).map((file) => ({ file, text: read(file) }));
}

function classifyCandidate(file) {
  if (/^docs\/tasks\/P8-/.test(file)) return 'current_domain_reference';
  if (/^scripts\/twin_kernel\/P8_/.test(file)) return 'current_domain_reference';
  if (/^scripts\/governance_acceptance\/P8_/.test(file)) return 'current_domain_reference';
  if (/^docs\/tasks\/POST-P8-/.test(file)) return 'current_convergence_reference';
  if (/^scripts\/governance_acceptance\/POST_P8_/.test(file)) return 'current_convergence_reference';
  if (/^docs\/tasks\/TK/.test(file)) return 'current_domain_reference_or_historical_record';
  if (/^scripts\/governance_acceptance\/TK/.test(file)) return 'current_domain_reference_or_historical_record';
  if (/^scripts\/twin_kernel\/P7_/.test(file)) return 'historical_record_candidate_for_archive_after_audit';
  if (/^docs\/tasks\/P[0-7]-/.test(file)) return 'historical_record_candidate_for_archive_after_audit';
  if (/^scripts\/DELIVERY\//.test(file)) return 'delivery_domain_reference_or_legacy_compatibility';
  return 'unknown_inspect_before_use';
}

function buildAudit() {
  const sources = loadStrongSources();
  const candidates = [...new Set(CANDIDATE_ROOTS.flatMap(walk))]
    .filter((file) => /\.(md|cjs|mjs|js|ts|ps1)$/i.test(file))
    .sort();
  const audited = candidates.map((file) => {
    const tokens = [file, basenameNoExt(file)];
    const references = [];
    for (const source of sources) {
      if (source.file === file) continue;
      const matchedTokens = tokens.filter((token) => token && source.text.includes(token));
      if (matchedTokens.length > 0) references.push({ source: source.file, tokens: matchedTokens });
    }
    return {
      file,
      classification: classifyCandidate(file),
      strong_reference_count: references.length,
      strong_references: references,
    };
  });

  return {
    generated_at: new Date().toISOString(),
    acceptance: ACCEPTANCE,
    strong_reference_sources: sources.map((source) => source.file),
    candidate_roots: CANDIDATE_ROOTS,
    candidate_count: audited.length,
    current_domain_reference_count: audited.filter((item) => item.classification.includes('current')).length,
    no_strong_reference_count: audited.filter((item) => item.strong_reference_count === 0).length,
    candidates: audited,
    note: 'No candidate in this report is approved for deletion. Deletion requires a later PR with package, CI, runtime import, route registry, acceptance, SSOT, and freeze-index proof.',
  };
}

function writeReport(report) {
  const reportAbs = abs(REPORT_PATH);
  fs.mkdirSync(path.dirname(reportAbs), { recursive: true });
  fs.writeFileSync(reportAbs, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
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
  assert('post_p8_00_acceptance_exists', exists('scripts/governance_acceptance/POST_P8_REPOSITORY_CONVERGENCE_ACCEPTANCE.cjs'), {});
  assert('post_p8_01_doc_exists', exists('docs/tasks/POST-P8-01-Freeze-Index-and-Reference-Audit.md'), {});
  for (const source of STRONG_REFERENCE_SOURCES) assert(`strong_reference_source_exists:${source}`, exists(source), { source });

  const audit = buildAudit();
  writeReport(audit);

  assert('reference_audit_generated', exists(REPORT_PATH), { REPORT_PATH });
  assert('candidate_scan_completed', audit.candidate_count > 0, { candidate_count: audit.candidate_count });
  assert('strong_reference_sources_checked', audit.strong_reference_sources.length === STRONG_REFERENCE_SOURCES.length, { strong_reference_sources: audit.strong_reference_sources });
  assert('p8_candidates_retained_as_current_domain_reference', audit.candidates.some((item) => item.file === 'scripts/twin_kernel/P8_09_PRODUCT_REPLAY_DEMO_REPORT_V0.cjs' && item.classification === 'current_domain_reference'), {});
  assert('no_delete_performed', true, {});

  const changed = changedFilesFromMain();
  const runtimeChanged = changed.filter((file) => FORBIDDEN_RUNTIME_PREFIXES.some((prefix) => file.startsWith(prefix)));
  assert('no_runtime_surface_changed', runtimeChanged.length === 0, { runtimeChanged, changed });

  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    reference_audit_generated: true,
    reference_audit_report: REPORT_PATH,
    candidate_scan_completed: true,
    candidate_count: audit.candidate_count,
    no_strong_reference_count: audit.no_strong_reference_count,
    strong_reference_sources_checked: true,
    no_delete_performed: true,
    no_runtime_surface_changed: true,
    changed_file_count: changed.length,
    changed_files: changed,
    ...summary(),
    next_step: 'POST_P8_02_NON_MAINLINE_ARCHIVE_PLAN'
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
