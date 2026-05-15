#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

function fail(msg) {
  console.error(`[ACCEPTANCE_FALLBACK_RETIREMENT_ENFORCEMENT_V1] FAIL: ${msg}`);
  process.exit(1);
}
function assert(cond, msg) { if (!cond) fail(msg); }
function rel(file) { return path.relative(root, file).replace(/\\/g, '/'); }
function read(file) { return fs.readFileSync(file, 'utf8'); }
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/g, ''))
    .join('\n');
}
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', 'coverage', '.next'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|cjs|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = [
  ...walk(path.join(root, 'apps/server/src')),
  ...walk(path.join(root, 'apps/web/src')),
  ...walk(path.join(root, 'packages')),
];

function fallbackLines(file) {
  const lines = stripComments(read(file)).split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (/fallback/i.test(lines[i])) out.push({ index: i, line: lines[i], context: lines.slice(Math.max(0, i - 4), i + 5).join('\n') });
  }
  return out;
}
function isPayloadFallbackContext(ctx) {
  const lower = ctx.toLowerCase();
  return /fallback\s*[:=]/i.test(ctx)
    || /isfallback\s*[:=]/i.test(ctx)
    || /fallback_reason\s*[:=]/i.test(ctx)
    || /fallback_payload\s*[:=]/i.test(ctx)
    || /data_origin\s*[:=].*fallback/i.test(ctx)
    || /origin\s*[:=].*fallback/i.test(ctx)
    || /reply\.send\s*\(/i.test(ctx)
    || /return\s+\{[\s\S]*fallback/i.test(ctx)
    || lower.includes('fallback_limited');
}
function hasLimitedMarker(ctx) {
  const lower = ctx.toLowerCase();
  return lower.includes('limited') || lower.includes('limited_view') || lower.includes('fallback_limited') || lower.includes('degraded') || lower.includes('fallback_stale') || lower.includes('read_only');
}

const fallbackPayloadContexts = [];
for (const file of files) {
  for (const hit of fallbackLines(file)) {
    if (isPayloadFallbackContext(hit.context)) fallbackPayloadContexts.push({ file, context: hit.context });
  }
}

const fallbackOffenders = fallbackPayloadContexts
  .filter(({ context }) => !hasLimitedMarker(context))
  .map(({ file }) => `${rel(file)} fallback payload/path must be marked limited/degraded`);
assert(fallbackOffenders.length === 0, `fallback payload must be explicitly limited:\n${[...new Set(fallbackOffenders)].join('\n')}`);

const forbiddenTrustedFields = ['final_status', 'acceptance_pass', 'trusted_roi', 'formal_memory'];
const trustedFallbackOffenders = [];
for (const { file, context } of fallbackPayloadContexts) {
  const lower = context.toLowerCase();
  for (const field of forbiddenTrustedFields) {
    if (lower.includes(field)) trustedFallbackOffenders.push(`${rel(file)} fallback must not output ${field}`);
  }
}
assert(trustedFallbackOffenders.length === 0, `fallback must not output trusted/final fields:\n${[...new Set(trustedFallbackOffenders)].join('\n')}`);

const operatorFiles = files.filter((file) => /operator|workbench|dispatch|approval/i.test(rel(file)));
const writeButtonOffenders = [];
for (const file of operatorFiles) {
  const text = stripComments(read(file));
  const lower = text.toLowerCase();
  if (!lower.includes('fallback')) continue;
  const hasWriteButton = ['<button', 'type="button"', 'onclick', 'onclick=', 'submit', 'dispatch', 'approve', 'resolve', 'create'].some((term) => lower.includes(term.toLowerCase()));
  const hasDisabledGuard = ['disabled', 'readonly', 'read_only', 'write_disabled', 'limited', 'fallback_limited'].some((term) => lower.includes(term.toLowerCase()));
  if (hasWriteButton && !hasDisabledGuard) writeButtonOffenders.push(`${rel(file)} operator fallback must not enable write buttons`);
}
assert(writeButtonOffenders.length === 0, `operator fallback must not enable write buttons:\n${writeButtonOffenders.join('\n')}`);

const customerFiles = [
  ...walk(path.join(root, 'apps/web/src')),
  ...walk(path.join(root, 'apps/server/src/routes')),
  ...walk(path.join(root, 'apps/server/src/projections')),
];
const internalNavOffenders = [];
const internalTerms = ['/' + 'admin', '/' + 'debug', '/' + 'internal', 'admin' + '/debug', 'debug' + '/internal'];
for (const file of customerFiles) {
  const text = stripComments(read(file)).toLowerCase();
  const isCustomerSurface = text.includes('customer') || rel(file).includes('/views/') || rel(file).includes('/components/') || rel(file).includes('/routes/reports');
  if (!isCustomerSurface) continue;
  for (const term of internalTerms) {
    if (text.includes(term)) internalNavOffenders.push(`${rel(file)} contains internal navigation term ${term}`);
  }
}
assert(internalNavOffenders.length === 0, `admin/debug/internal must not enter customer navigation:\n${internalNavOffenders.join('\n')}`);

const reportApi = path.join(root, 'apps/web/src/api/reports.ts');
assert(fs.existsSync(reportApi), 'customer reports API client must exist');
const reportApiText = read(reportApi);
assert(reportApiText.includes('/api/v1/reports/customer-dashboard/aggregate'), 'Customer dashboard must use official customer aggregate API');
assert(reportApiText.includes('/api/v1/reports/field/'), 'Field report must use official customer field report API');
assert(reportApiText.includes('/api/v1/reports/operation/'), 'Operation report must use official customer operation report API');
for (const term of ['/api/' + 'admin', '/api/' + 'debug', '/api/' + 'internal']) {
  assert(!reportApiText.includes(term), 'customer report client must not call internal API');
}

console.log('[ACCEPTANCE_FALLBACK_RETIREMENT_ENFORCEMENT_V1] PASSED');
