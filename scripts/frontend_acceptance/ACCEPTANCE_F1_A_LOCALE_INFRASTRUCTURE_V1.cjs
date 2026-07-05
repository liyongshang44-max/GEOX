// scripts/frontend_acceptance/ACCEPTANCE_F1_A_LOCALE_INFRASTRUCTURE_V1.cjs
'use strict';

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const files = {
  locale: 'apps/web/src/lib/locale.tsx',
  productCopy: 'apps/web/src/lib/productCopy.ts',
  productSurfaceLabels: 'apps/web/src/lib/productSurfaceLabels.ts',
  localeToggle: 'apps/web/src/components/common/LocaleToggle.tsx',
  doc: 'docs/frontend-productization/F1-A-LOCALE-INFRASTRUCTURE-HARDENING.md',
  acceptance: 'scripts/frontend_acceptance/ACCEPTANCE_F1_A_LOCALE_INFRASTRUCTURE_V1.cjs',
};

const allowedChangedFiles = new Set(Object.values(files));

const blockedExactFiles = new Set([
  'apps/web/src/app/App.tsx',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
]);

const blockedPrefixes = [
  'apps/web/src/app/routes/',
  'apps/web/src/layouts/',
  'apps/web/src/features/',
  'apps/web/src/views/',
  'apps/web/src/styles/',
  'apps/server/',
  'migrations/',
  'packages/contracts/',
  'fixtures/',
  '.github/',
];

const forbiddenDependencies = [
  'i18next',
  'react-i18next',
  'formatjs',
  'intl-messageformat',
];

const mojibakePatterns = [
  '鎬',
  '鍦',
  '浣',
  '璁',
  '杩',
  '閰',
  '绠',
  '瀵',
  '艰',
  '鍚',
  '彴',
  '潡',
  '惧',
  '悍',
  '嵁',
  '�',
];

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

function hasNone(text, tokens) {
  return tokens.every((token) => !text.includes(token));
}

function assert(name, passed, details = {}) {
  assertions.push({ name, passed: passed === true, details });
  if (passed !== true) {
    const error = new Error('ASSERTION_FAILED:' + name);
    error.details = details;
    throw error;
  }
  console.log('[f1-a-locale-infrastructure] ok:', name);
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

function isBlockedFile(file) {
  return blockedExactFiles.has(file) || blockedPrefixes.some((prefix) => file.startsWith(prefix));
}

function containsMojibake(text) {
  return mojibakePatterns.some((pattern) => text.includes(pattern));
}

function forbiddenPositiveClaims(text) {
  const rules = [
    { phrase: 'live device connected', allowed: ['not live device connected', 'does not claim live device connection', 'not connected'] },
    { phrase: 'production gateway online', allowed: ['not production gateway online', 'does not claim production gateway online', 'not online'] },
    { phrase: 'field pilot started', allowed: ['not field pilot started', 'not started'] },
    { phrase: 'AO-ACT dispatch enabled', allowed: ['not AO-ACT dispatch enabled', 'does not enable AO-ACT dispatch'] },
    { phrase: 'ROI computed', allowed: ['not ROI computed', 'does not compute ROI'] },
    { phrase: 'Field Memory learned', allowed: ['not Field Memory learned', 'does not write Field Memory'] },
  ];

  const violations = [];

  for (const rule of rules) {
    text
      .split(/\r?\n/)
      .map((line, index) => ({ line: index + 1, text: line }))
      .filter((entry) => entry.text.includes(rule.phrase))
      .filter((entry) => !rule.allowed.some((allowed) => entry.text.includes(allowed)))
      .forEach((entry) => violations.push({ phrase: rule.phrase, line: entry.line, text: entry.text }));
  }

  return violations;
}

try {
  Object.values(files).forEach((file) => assert('exists:' + file, exists(file), { file }));

  const diff = changedFiles();
  const routeTopologyChanged = diff.includes('apps/web/src/app/App.tsx') || diff.some((file) => file.startsWith('apps/web/src/app/routes/'));
  const shellIntegrationChanged = diff.some((file) => file.startsWith('apps/web/src/layouts/'));

  assert('changed_files_allowlist', diff.every((file) => allowedChangedFiles.has(file)), { diff });
  assert('blocked_files_unchanged', diff.every((file) => !isBlockedFile(file)), { diff });
  assert('no_package_dependency_changes', diff.every((file) => !['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(file)), { diff });
  assert('route_topology_unchanged', routeTopologyChanged === false, { diff });
  assert('shell_integration_unchanged', shellIntegrationChanged === false, { diff });

  const locale = read(files.locale);
  const productCopy = read(files.productCopy);
  const productSurfaceLabels = read(files.productSurfaceLabels);
  const localeToggle = read(files.localeToggle);
  const doc = read(files.doc);

  assert('locale_contract_present', hasAll(locale, [
    'LocaleCode',
    'zh-CN',
    'en-US',
    'LocaleProvider',
    'useLocale',
    'setLocale',
    'geox.locale',
    'text:',
    'LocalizedCopy',
    'LOCALE_STORAGE_KEY',
    'SUPPORTED_LOCALES',
    'isLocaleCode',
    'normalizeLocale',
    'localizedText',
  ]), { file: files.locale });

  assert('locale_toggle_contract_present', hasAll(localeToggle, [
    'useLocale',
    'setLocale',
    'zh-CN',
    'en-US',
    'aria-label',
    'button',
  ]), { file: files.localeToggle });

  assert('locale_toggle_has_no_backend_or_navigation_calls', hasNone(localeToggle, [
    'fetch',
    'XMLHttpRequest',
    'axios',
    '/api/',
    'window.location.reload',
    'window.location.href',
    'history.pushState',
  ]), { file: files.localeToggle });

  assert('product_copy_registry_present', hasAll(productCopy, [
    'PRODUCT_COPY',
    'operator',
    'customer',
    'admin',
    'shell',
    'nav',
    'nonclaims',
    'zh',
    'en',
  ]), { file: files.productCopy });

  assert('product_copy_registry_boundary', hasNone(productCopy, [
    'raw_payload',
    'fact_id',
    'evidence_ref',
    'text(',
  ]), { file: files.productCopy });

  assert('product_surface_labels_present', hasAll(productSurfaceLabels, [
    'PRODUCT_SURFACE_LABELS',
    'ProductSurfaceId',
    'operator-runtime-console',
    'customer-portal',
    'admin-console',
    'field-runtime',
    'replay-backed-gateway-demo',
    'pilot-readiness',
    'zh',
    'en',
  ]), { file: files.productSurfaceLabels });

  assert('product_surface_labels_boundary', hasNone(productSurfaceLabels, [
    'Route',
    'path:',
    'permission',
    'dispatch',
    'text(',
  ]), { file: files.productSurfaceLabels });

  assert('doc_required_sections_present', hasAll(doc, [
    'Phase',
    'Purpose',
    'Allowed files',
    'Forbidden files',
    'Existing locale skeleton',
    'New infrastructure',
    'LocaleToggle contract',
    'Product copy registry contract',
    'Product surface labels registry contract',
    'Translation boundary',
    'Nonclaims',
    'Acceptance',
    'Next phase',
    'F1-A does not wire LocaleToggle into CustomerLayout, OperatorLayout, or AdminLayout.',
    'F1-A prepares F1-B Shell / Navigation Bilingual Integration.',
  ]), { file: files.doc });

  assert('no_i18n_dependency_strings', [locale, productCopy, productSurfaceLabels, localeToggle, doc].every((text) => hasNone(text, forbiddenDependencies)), { forbiddenDependencies });

  const mojibakeFiles = [files.locale, files.productCopy, files.productSurfaceLabels, files.localeToggle, files.doc];
  const mojibakeHits = mojibakeFiles
    .map((file) => ({ file, hasMojibake: containsMojibake(read(file)) }))
    .filter((entry) => entry.hasMojibake);
  assert('no_mojibake_in_f1a_files', mojibakeHits.length === 0, { mojibakeHits });

  const productionClaimViolations = forbiddenPositiveClaims([productCopy, productSurfaceLabels, localeToggle, doc].join('\n'));
  assert('forbidden_positive_production_claims_absent', productionClaimViolations.length === 0, { violations: productionClaimViolations });

  const result = {
    ok: true,
    acceptance: 'ACCEPTANCE_F1_A_LOCALE_INFRASTRUCTURE_V1',
    phase: 'F1-A Locale Infrastructure Hardening',
    locale: {
      provider: 'present',
      storage_key: 'geox.locale',
      supported: ['zh-CN', 'en-US'],
      toggle: 'present',
    },
    copy_registry: 'present',
    surface_labels: 'present',
    route_topology_changed: false,
    shell_integration_changed: false,
    next: 'F1-B Shell / Navigation Bilingual Integration',
    changed_files_checked: diff,
    assertions,
  };

  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    acceptance: 'ACCEPTANCE_F1_A_LOCALE_INFRASTRUCTURE_V1',
    error: error.message,
    details: error.details || null,
    assertions,
  }, null, 2));
  process.exit(1);
}
