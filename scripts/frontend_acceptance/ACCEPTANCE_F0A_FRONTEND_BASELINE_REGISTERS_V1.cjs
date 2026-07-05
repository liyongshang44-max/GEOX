// scripts/frontend_acceptance/ACCEPTANCE_F0A_FRONTEND_BASELINE_REGISTERS_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const files = {
  main: 'docs/frontend-productization/F0-A-FRONTEND-BASELINE-REGISTERS.md',
  pageGap: 'docs/frontend-productization/F0-A-PAGE-GAP-REGISTER.md',
  locale: 'docs/frontend-productization/F0-A-LOCALE-READINESS-REGISTER.md',
  quality: 'docs/frontend-productization/F0-A-QUALITY-BASELINE-REGISTER.md',
  runtime: 'docs/frontend-productization/F0-A-RUNTIME-TRANSITION-REGISTER.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_F0A_FRONTEND_BASELINE_REGISTERS_V1.cjs',
  h67Readiness: 'docs/frontend-productization/H67-FRONTEND-RELEASE-READINESS.md',
  h67Manifest: 'docs/frontend-productization/H67-FRONTEND-ROUTE-SURFACE-MANIFEST.md',
  h67Checklist: 'docs/frontend-productization/H67-FRONTEND-RELEASE-CHECKLIST.md',
  h67Acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_H67_FRONTEND_RELEASE_READINESS_V1.cjs',
  app: 'apps/web/src/app/App.tsx',
  localeSource: 'apps/web/src/lib/locale.tsx',
  operatorLayout: 'apps/web/src/layouts/OperatorLayout.tsx',
  fieldRuntimeViewModel: 'apps/web/src/features/operator/fieldRuntime/fieldRuntimeViewModel.ts',
};

const allowedChangedFiles = new Set([
  'docs/frontend-productization/F0-A-FRONTEND-BASELINE-REGISTERS.md',
  'docs/frontend-productization/F0-A-PAGE-GAP-REGISTER.md',
  'docs/frontend-productization/F0-A-LOCALE-READINESS-REGISTER.md',
  'docs/frontend-productization/F0-A-QUALITY-BASELINE-REGISTER.md',
  'docs/frontend-productization/F0-A-RUNTIME-TRANSITION-REGISTER.md',
  'scripts/frontend_acceptance/ACCEPTANCE_F0A_FRONTEND_BASELINE_REGISTERS_V1.cjs',
  'docs/frontend-productization/README.md',
]);

const blockedPrefixes = [
  'apps/web/src/',
  'apps/server/',
  'migrations/',
  'packages/contracts/',
  'fixtures/',
  '.github/',
];

const blockedExactFiles = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
]);

const assertions = [];

function repoPath(file) {
  return path.join(root, file);
}

function exists(file) {
  return fs.existsSync(repoPath(file));
}

function read(file) {
  return fs.readFileSync(repoPath(file), 'utf8');
}

function hasAll(text, tokens) {
  return tokens.every((token) => text.includes(token));
}

function isBlockedChangedFile(file) {
  return blockedExactFiles.has(file) || blockedPrefixes.some((prefix) => file.startsWith(prefix));
}

function assert(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (passed !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[f0a-frontend-baseline-registers] ok:', name);
}

function changedFiles() {
  const candidateArgs = [
    ['diff', '--name-only', 'origin/main...HEAD'],
    ['diff', '--name-only', 'main...HEAD'],
  ];

  for (const args of candidateArgs) {
    try {
      return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    } catch (_error) {
      // Continue to the next diff base. Static file checks still work outside a normal git checkout.
    }
  }

  return [];
}

function linesWithForbiddenPositiveClaims(text, phrase, allowedNegatives) {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, text: line }))
    .filter((entry) => entry.text.includes(phrase))
    .filter((entry) => !allowedNegatives.some((allowed) => entry.text.includes(allowed)));
}

function assertForbiddenPositiveClaims(docsText) {
  const rules = [
    { phrase: 'live device connected', allowed: ['not live device connected'] },
    { phrase: 'production gateway online', allowed: ['not production gateway online'] },
    { phrase: 'field pilot started', allowed: ['not field pilot started'] },
    { phrase: 'field pilot execution started', allowed: ['not field pilot execution started'] },
    { phrase: 'AO-ACT dispatch enabled', allowed: ['not AO-ACT dispatch enabled'] },
    { phrase: 'ROI computed', allowed: ['not ROI computed'] },
    { phrase: 'Field Memory learned', allowed: ['not Field Memory learned'] },
    { phrase: 'online state estimation active', allowed: ['not online state estimation active'] },
    { phrase: 'forecast calibration loop active', allowed: ['not forecast calibration loop active'] },
  ];

  const violations = [];

  for (const rule of rules) {
    linesWithForbiddenPositiveClaims(docsText, rule.phrase, rule.allowed)
      .forEach((hit) => violations.push({ phrase: rule.phrase, line: hit.line, text: hit.text }));
  }

  assert('forbidden_positive_claims_absent', violations.length === 0, { violations });
}

try {
  Object.values(files).forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  const runtimeSourceChanged = diff.some((file) => file.startsWith('apps/web/src/'));

  assert('changed_files_allowlist', diff.every((file) => allowedChangedFiles.has(file)), { diff });
  assert('blocked_files_unchanged', diff.every((file) => !isBlockedChangedFile(file)), { diff });
  assert('runtime_source_unchanged', runtimeSourceChanged === false, { diff });

  const main = read(files.main);
  const pageGap = read(files.pageGap);
  const locale = read(files.locale);
  const quality = read(files.quality);
  const runtime = read(files.runtime);
  const h67Readiness = read(files.h67Readiness);
  const h67Manifest = read(files.h67Manifest);
  const app = read(files.app);
  const localeSource = read(files.localeSource);
  const operatorLayout = read(files.operatorLayout);
  const fieldRuntimeViewModel = read(files.fieldRuntimeViewModel);

  assert('main_doc_records_phase_contract', hasAll(main, [
    'Phase',
    'Purpose',
    'Start baseline',
    'Output registers',
    'Non-goals',
    'Acceptance',
    'Next phase',
    'F0-A is register-only.',
    'F0-A does not modify runtime source.',
    'F0-A does not resolve page gaps.',
    'F0-A does not repair locale support.',
    'F0-A does not claim live runtime readiness.',
    'F0-A prepares F1, F2, F0-B, and R1-R5.',
    'F1 repairs bilingual / locale surfaces.',
    'F2 hardens frontend quality baseline.',
    'F0-B freezes frontend productization.',
    'R1 starts runtime readiness.',
    'F1-A Locale Infrastructure Hardening',
  ]), { file: files.main });

  assert('h67_baseline_files_still_record_release_readiness', hasAll(h67Readiness, [
    'H67 is the frontend release readiness gate',
    'H67 does not add product surfaces.',
    'H67 does not change route topology.',
    'H67 does not modify runtime source.',
  ]) && hasAll(h67Manifest, [
    'Operator Runtime Console',
    'Customer Portal',
    'Admin Console',
    '/operator/twin',
    '/customer/dashboard',
    '/admin/dashboard',
  ]), { files: [files.h67Readiness, files.h67Manifest] });

  assert('page_gap_register_required_sections', hasAll(pageGap, [
    'Release surfaces present',
    'Route exists but product page incomplete',
    'Future product-contract pages',
    'Do-not-build pages',
    'Operator Fields Index',
    'Operator Evidence Overview',
    'Operator Runtime Health Overview',
    'Operator Settings',
    'Operator Pilot explicit route ownership cleanup',
    'Customer Evidence Summary',
    'Admin Tenants',
    'Admin Imports',
    'Admin Audit',
    'Customer Dispatch',
    'Operator AO-ACT Control',
    'Admin Debug Formal Page',
  ]), { file: files.pageGap });

  assert('page_gap_register_surface_routes', hasAll(pageGap, [
    '/customer/dashboard',
    '/customer/fields/:fieldId/export',
    '/admin/healthz',
    '/admin/skills',
    '/operator/twin/gateway-demo',
    '/operator/pilot',
    '/operator/fields/:fieldId/health',
    '/operator/fields/:fieldId/audit',
  ]), { file: files.pageGap });

  assert('locale_register_required_content', hasAll(locale, [
    'LocaleProvider',
    'LocaleCode',
    'zh-CN',
    'en-US',
    'geox.locale',
    'useLocale',
    'text(zh, en)',
    'Language toggle is not established',
    'F1-A Locale Infrastructure Hardening',
    'F1-B Shell / Navigation Bilingual Integration',
    'F1-C Operator Formal Surface Bilingualization',
    'F1-D Customer / Admin Formal Surface Bilingualization',
    'Do translate',
    'Do not translate',
    'fact_id',
    'evidence_ref',
    'raw_payload',
    'determinism hash',
  ]), { file: files.locale });

  assert('quality_register_required_content', hasAll(quality, [
    'Accessibility baseline',
    'Responsive viewport smoke',
    'Keyboard / focus gate',
    'Empty / loading / error state coverage',
    'Visual screenshot checklist',
    'Performance budget',
    'F2-A Accessibility Baseline',
    'F2-B Responsive Viewport Smoke',
    'F2-C Keyboard / Focus Gate',
    'F2-D Empty / Loading / Error State Register',
    'F2-E Visual Screenshot Checklist',
    'F2-F Performance Budget',
  ]), { file: files.quality });

  assert('runtime_transition_register_required_content', hasAll(runtime, [
    'Frontend Productization is not Runtime Readiness',
    'not live production runtime',
    'not real device deployed',
    'not production gateway online',
    'not field pilot execution started',
    'not AO-ACT dispatch enabled',
    'not ROI computed',
    'not Field Memory learned',
    'R1 Runtime Evidence Stream Readiness',
    'R2 Online State Estimation Loop',
    'R3 Forecast Calibration & Residual Loop',
    'R4 Runtime Health Service Gate',
    'R5 Field Pilot Runtime Readiness',
  ]), { file: files.runtime });

  assertForbiddenPositiveClaims([main, pageGap, locale, quality, runtime].join('\n'));

  assert('locale_source_fact_still_true', hasAll(localeSource, [
    'export type LocaleCode = "zh-CN" | "en-US"',
    'const STORAGE_KEY = "geox.locale"',
    'export function LocaleProvider',
    'export function useLocale',
    'text: (zh: string, en: string) => string',
  ]), { file: files.localeSource });

  assert('app_root_locale_provider_still_present', app.includes('<LocaleProvider>') && app.includes('</LocaleProvider>'), { file: files.app });

  assert('operator_pilot_reachable_but_layout_owned', app.includes('path="twin/gateway-demo"') && !app.includes('path="pilot"') && operatorLayout.includes('location.pathname === "/operator/pilot"') && operatorLayout.includes('<OperatorPilotPage />'), { files: [files.app, files.operatorLayout] });

  assert('operator_fields_index_incomplete_fact_still_true', hasAll(fieldRuntimeViewModel, [
    'Field Runtime list route is not field-scoped yet.',
    'No field list data is loaded on this route.',
    'currentRoute = routeKey === "fields" ? "/operator/fields"',
  ]), { file: files.fieldRuntimeViewModel });

  const result = {
    ok: true,
    acceptance: 'ACCEPTANCE_F0A_FRONTEND_BASELINE_REGISTERS_V1',
    phase: 'F0-A Frontend Baseline Registers',
    registers: {
      page_gap: 'present',
      locale_readiness: 'present',
      quality_baseline: 'present',
      runtime_transition: 'present',
    },
    runtime_source_changed: false,
    next: 'F1-A Locale Infrastructure Hardening',
    changed_files_checked: diff,
    assertions,
  };

  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: 'ACCEPTANCE_F0A_FRONTEND_BASELINE_REGISTERS_V1',
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
