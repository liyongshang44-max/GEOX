#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

function assert(cond, msg) {
  if (!cond) {
    console.error(`[ACCEPTANCE_FALLBACK_RETIREMENT_ENFORCEMENT_V1] FAIL: ${msg}`);
    process.exit(1);
  }
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', 'coverage', '.next'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|cjs|mjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const files = [
  ...walk(path.join(root, 'apps/server/src')),
  ...walk(path.join(root, 'apps/web/src')),
  ...walk(path.join(root, 'packages')),
];

const fallbackFiles = files.filter((file) => /fallback/i.test(read(file)));
const fallbackOffenders = [];
for (const file of fallbackFiles) {
  const text = read(file);
  const lower = text.toLowerCase();
  const isCommentOnly = text.split('\n').every((line) => {
    if (!/fallback/i.test(line)) return true;
    const trimmed = line.trim();
    return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
  });
  if (isCommentOnly) continue;
  const hasLimitedMarker = lower.includes('limited') || lower.includes('limited_view') || lower.includes('fallback_limited') || lower.includes('degraded') || lower.includes('fallback_stale');
  if (!hasLimitedMarker) fallbackOffenders.push(`${rel(file)} fallback payload/path must be marked limited/degraded`);
}
assert(fallbackOffenders.length === 0, `fallback payload must be explicitly limited:\n${fallbackOffenders.join('\n')}`);

const forbiddenTrustedFields = [
  'final_status',
  'acceptance_pass',
  'trusted_roi',
  'formal_memory',
];
const trustedFallbackOffenders = [];
for (const file of fallbackFiles) {
  const text = read(file);
  const lower = text.toLowerCase();
  for (const field of forbiddenTrustedFields) {
    if (lower.includes(field)) trustedFallbackOffenders.push(`${rel(file)} fallback must not output ${field}`);
  }
}
assert(trustedFallbackOffenders.length === 0, `fallback must not output trusted/final fields:\n${trustedFallbackOffenders.join('\n')}`);

const operatorFiles = files.filter((file) => rel(file).includes('operator') || rel(file).includes('workbench') || rel(file).includes('dispatch') || rel(file).includes('approval'));
const writeButtonOffenders = [];
for (const file of operatorFiles) {
  const text = read(file);
  const lower = text.toLowerCase();
  if (!lower.includes('fallback')) continue;
  const hasWriteButton = ['<button', 'type="button"', 'onclick', 'onClick', 'submit', 'dispatch', 'approve', 'resolve', 'create'].some((term) => lower.includes(term.toLowerCase()));
  const hasDisabledGuard = ['disabled', 'readonly', 'read_only', 'write_disabled', 'limited'].some((term) => lower.includes(term.toLowerCase()));
  if (hasWriteButton && !hasDisabledGuard) writeButtonOffenders.push(`${rel(file)} operator fallback must not enable write buttons`);
}
assert(writeButtonOffenders.length === 0, `operator fallback must not enable write buttons:\n${writeButtonOffenders.join('\n')}`);

const customerFiles = [
  ...walk(path.join(root, 'apps/web/src')),
  ...walk(path.join(root, 'apps/server/src/routes')),
  ...walk(path.join(root, 'apps/server/src/projections')),
];
const internalNavOffenders = [];
for (const file of customerFiles) {
  const text = read(file);
  const lower = text.toLowerCase();
  const isCustomerSurface = lower.includes('customer') || rel(file).includes('/views/') || rel(file).includes('/components/') || rel(file).includes('/routes/reports');
  if (!isCustomerSurface) continue;
  for (const term of ['/admin', '/debug', '/internal', 'admin/debug', 'debug/internal']) {
    if (lower.includes(term)) internalNavOffenders.push(`${rel(file)} contains internal navigation term ${term}`);
  }
}
assert(internalNavOffenders.length === 0, `admin/debug/internal must not enter customer navigation:\n${internalNavOffenders.join('\n')}`);

const reportApi = path.join(root, 'apps/web/src/api/reports.ts');
assert(fs.existsSync(reportApi), 'customer reports API client must exist');
const reportApiText = read(reportApi);
assert(reportApiText.includes('/api/v1/reports/customer-dashboard/aggregate'), 'Customer dashboard must use official customer aggregate API');
assert(reportApiText.includes('/api/v1/reports/field/'), 'Field report must use official customer field report API');
assert(reportApiText.includes('/api/v1/reports/operation/'), 'Operation report must use official customer operation report API');
assert(!reportApiText.includes('/api/admin'), 'customer report client must not call admin API');
assert(!reportApiText.includes('/api/debug'), 'customer report client must not call debug API');
assert(!reportApiText.includes('/api/internal'), 'customer report client must not call internal API');

console.log('[ACCEPTANCE_FALLBACK_RETIREMENT_ENFORCEMENT_V1] PASSED');
