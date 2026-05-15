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
function stripComments(text) { return text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((line) => line.replace(/\/\/.*$/g, '')).join('\n'); }
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
function existing(paths) { return paths.map((p) => path.join(root, p)).filter((p) => fs.existsSync(p)); }

const customerSurfaceFiles = existing([
  'apps/web/src/api/reports.ts',
  'apps/web/src/views/CustomerDashboardPage.tsx',
  'apps/web/src/views/FieldReportPage.tsx',
  'apps/web/src/views/OperationReportPage.tsx',
  'apps/web/src/viewmodels/fieldReportVm.ts',
  'apps/web/src/viewmodels/operationReportVm.ts',
  'apps/web/src/viewmodels/customerReportsCenterVm.ts',
  'apps/web/src/viewmodels/customerFieldsIndexVm.ts',
  'apps/web/src/viewmodels/customerOperationsIndexVm.ts',
  'apps/web/src/viewmodels/customerRoiLedgerVm.ts',
  'apps/web/src/viewmodels/customerFieldMemoryVm.ts',
  'apps/web/src/lib/dataOrigin.ts',
  'apps/web/src/lib/customerStatusLabels.ts',
  'apps/web/src/lib/customerSemanticLabels.ts',
  'apps/server/src/routes/reports_v1.ts',
  'apps/server/src/routes/reports_dashboard_v1.ts',
  'apps/server/src/projections/report_v1.ts',
  'apps/server/src/projections/report_dashboard_v1.ts',
]);
const operatorSurfaceFiles = [
  ...walk(path.join(root, 'apps/web/src/views/operator')),
  ...walk(path.join(root, 'apps/web/src/api')).filter((f) => /operator|workbench|dispatch|approval|acceptance|evidence|devices/i.test(rel(f))),
  ...walk(path.join(root, 'apps/web/src/viewmodels')).filter((f) => /operator|workbench|dispatch|approval|acceptance|evidence|devices/i.test(rel(f))),
];
const files = [...new Set([...customerSurfaceFiles, ...operatorSurfaceFiles])];

function fallbackPayloadContexts(file) {
  const text = stripComments(read(file));
  const contexts = [];
  const patterns = [
    /\bfallback_payload\b\s*[:=][^\n,}]*/gi,
    /\bfallback_reason\b\s*[:=][^\n,}]*/gi,
    /\bisFallback\b\s*[:=]\s*true/gi,
    /\bfallback_limited\b\s*[:=][^\n,}]*/gi,
    /\bdata_origin\b\s*[:=]\s*["']fallback["']/gi,
    /\borigin\b\s*[:=]\s*["']fallback["']/gi,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      contexts.push({ file, context: text.slice(Math.max(0, match.index - 300), match.index + 500) });
    }
  }
  return contexts;
}
function hasLimitedMarker(ctx) {
  const lower = ctx.toLowerCase();
  return lower.includes('limited') || lower.includes('limited_view') || lower.includes('fallback_limited') || lower.includes('degraded') || lower.includes('fallback_stale') || lower.includes('read_only');
}

const payloadContexts = files.flatMap(fallbackPayloadContexts);
const fallbackOffenders = payloadContexts.filter(({ context }) => !hasLimitedMarker(context)).map(({ file }) => `${rel(file)} fallback payload/path must be marked limited/degraded`);
assert(fallbackOffenders.length === 0, `fallback payload must be explicitly limited:\n${[...new Set(fallbackOffenders)].join('\n')}`);

const forbiddenTrustedFields = ['final_status', 'acceptance_pass', 'trusted_roi', 'formal_memory'];
const trustedFallbackOffenders = [];
for (const { file, context } of payloadContexts) {
  const lower = context.toLowerCase();
  for (const field of forbiddenTrustedFields) if (lower.includes(field)) trustedFallbackOffenders.push(`${rel(file)} fallback must not output ${field}`);
}
assert(trustedFallbackOffenders.length === 0, `fallback must not output trusted/final fields:\n${[...new Set(trustedFallbackOffenders)].join('\n')}`);

const writeButtonOffenders = [];
for (const file of operatorSurfaceFiles) {
  const text = stripComments(read(file));
  const lower = text.toLowerCase();
  const hasFallbackPayload = fallbackPayloadContexts(file).length > 0;
  if (!hasFallbackPayload) continue;
  const hasWriteButton = ['<button', 'type="button"', 'onclick', 'onclick=', 'submit', 'dispatch', 'approve', 'resolve', 'create'].some((term) => lower.includes(term.toLowerCase()));
  const hasDisabledGuard = ['disabled', 'readonly', 'read_only', 'write_disabled', 'limited', 'fallback_limited'].some((term) => lower.includes(term.toLowerCase()));
  if (hasWriteButton && !hasDisabledGuard) writeButtonOffenders.push(`${rel(file)} operator fallback must not enable write buttons`);
}
assert(writeButtonOffenders.length === 0, `operator fallback must not enable write buttons:\n${writeButtonOffenders.join('\n')}`);

const internalTerms = ['/' + 'admin', '/' + 'debug', '/' + 'internal', 'admin' + '/debug', 'debug' + '/internal'];
const internalNavOffenders = [];
for (const file of customerSurfaceFiles) {
  const text = stripComments(read(file)).toLowerCase();
  for (const term of internalTerms) if (text.includes(term)) internalNavOffenders.push(`${rel(file)} contains internal navigation term ${term}`);
}
assert(internalNavOffenders.length === 0, `admin/debug/internal must not enter customer navigation:\n${internalNavOffenders.join('\n')}`);

const reportApi = path.join(root, 'apps/web/src/api/reports.ts');
assert(fs.existsSync(reportApi), 'customer reports API client must exist');
const reportApiText = read(reportApi);
assert(reportApiText.includes('/api/v1/reports/customer-dashboard/aggregate'), 'Customer dashboard must use official customer aggregate API');
assert(reportApiText.includes('/api/v1/reports/field/'), 'Field report must use official customer field report API');
assert(reportApiText.includes('/api/v1/reports/operation/'), 'Operation report must use official customer operation report API');
for (const term of ['/api/' + 'admin', '/api/' + 'debug', '/api/' + 'internal']) assert(!reportApiText.includes(term), 'customer report client must not call internal API');

console.log('[ACCEPTANCE_FALLBACK_RETIREMENT_ENFORCEMENT_V1] PASSED');
