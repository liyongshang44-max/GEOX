#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SRC_ROOT = path.join(REPO_ROOT, 'apps', 'web', 'src');
const API_BASE = String(process.env.GEOX_FRONTEND_ACCEPTANCE_API_BASE || process.env.API_BASE || '').replace(/\/+$/, '');
const FIELD_ID = String(process.env.FIELD_ID || '').trim();
const OPERATION_ID = String(process.env.OPERATION_ID || '').trim();

const ROUTE_TARGETS = [
  { route: '/customer/dashboard', sources: ['apps/web/src/views/CustomerDashboardPage.tsx'] },
  { route: '/customer/fields/:field_id', sources: ['apps/web/src/views/FieldReportPage.tsx', 'apps/web/src/viewmodels/fieldReportVm.ts'] },
  { route: '/customer/operations', sources: ['apps/web/src/views/CustomerOperationsIndexPage.tsx', 'apps/web/src/viewmodels/customerOperationsIndexVm.ts'] },
  { route: '/customer/operations/:operation_id', sources: ['apps/web/src/views/OperationReportPage.tsx', 'apps/web/src/viewmodels/operationReportVm.ts'] },
  { route: '/customer/reports', sources: ['apps/web/src/views/CustomerReportsCenterPage.tsx', 'apps/web/src/viewmodels/customerReportsCenterVm.ts'] },
  { route: '/customer/fields/:field_id/export', sources: ['apps/web/src/views/FieldReportExportPage.tsx'] },
];

function join(...parts) { return parts.join(''); }
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function word(s) { return new RegExp('\\b' + esc(s) + '\\b'); }
function rx(s, flags) { return new RegExp(esc(s), flags || ''); }

const FORBIDDEN = [
  { token: join('???', '???'), pattern: /\?\?\?\?\?\?/ },
  { token: join('admin', '/', 'internal preview'), pattern: rx(join('admin', '/', 'internal preview'), 'i') },
  { token: join('P', '0'), pattern: word(join('P', '0')) },
  { token: join('P', '1-C'), pattern: word(join('P', '1-C')) },
  { token: join('P', '2.2'), pattern: word(join('P', '2.2')) },
  { token: join('OPERATOR ', 'DIAGNOSTIC ', 'ENHANCEMENT'), pattern: rx(join('OPERATOR ', 'DIAGNOSTIC ', 'ENHANCEMENT')) },
  { token: join('YIELD_', 'LIFT_', 'EXPECTED'), pattern: word(join('YIELD_', 'LIFT_', 'EXPECTED')) },
  { token: join('DEFAULT_', 'ASSUMPTION'), pattern: word(join('DEFAULT_', 'ASSUMPTION')) },
  { token: join('BASELINE_', 'MISSING'), pattern: word(join('BASELINE_', 'MISSING')) },
  { token: join('operation_', 'plan_v1'), pattern: word(join('operation_', 'plan_v1')) },
  { token: join('ao_', 'act_', 'task_v0'), pattern: word(join('ao_', 'act_', 'task_v0')) },
  { token: join('ao_', 'act_', 'receipt_v0'), pattern: word(join('ao_', 'act_', 'receipt_v0')) },
  { token: join('approval_', 'request_v1'), pattern: word(join('approval_', 'request_v1')) },
  { token: join('roi_', 'ledger_v1'), pattern: word(join('roi_', 'ledger_v1')) },
  { token: join('field_', 'memory_v1'), pattern: word(join('field_', 'memory_v1')) },
  { token: join('geometry ', '\u72b6\u6001'), pattern: /geometry\s*\u72b6\u6001/i },
  { token: join('mani', 'fest'), pattern: word(join('mani', 'fest')) },
  { token: join('sha', '256 checksum'), pattern: /sha256\s+checksum/i },
];

const ALLOW_PATH = [
  /(^|[/\\])scripts([/\\]|$)/,
  /(^|[/\\])test(s)?([/\\]|$)/,
  /(^|[/\\])__tests__([/\\]|$)/,
  /\.test\.[tj]sx?$/,
  /\.spec\.[tj]sx?$/,
  /(^|[/\\])api([/\\]|$)/,
  /customerSafeText\.ts$/,
  /customerStatusLabels\.ts$/,
  /customerLabels\.ts$/,
  /customerSemanticLabels\.ts$/,
  /operatorStatusLabels\.ts$/,
];

const ALLOW_CONTEXT = [
  /no-raw-enum-customer-allow/,
  /customer-boundary-allow/,
  /frontend-acceptance-allow/,
  /technical/i,
  /operationTechDetails/,
  /<details\b/,
  /<summary\b/,
  /technicalRefs/,
  /sourceText/,
  /raw\s*enum/i,
  /mani\w*fest.*(test|sanitize|unsafe|safe|filter|replace)/i,
  /(test|sanitize|unsafe|safe|filter|replace).*mani\w*fest/i,
  /BASELINE_.*MISSING.*(===|!==|case\s|includes\(|map|label|status|kind|type)/,
  /(===|!==|case\s|includes\(|map|label|status|kind|type).*BASELINE_.*MISSING/,
  /(YIELD_|DEFAULT_).*(EXPECTED|ASSUMPTION).*(===|!==|case\s|includes\(|map|label|status|kind|type)/,
  /(operation_|ao_|approval_|roi_|field_).*(source|technical|audit|trace|ref)/i,
];

function rel(file) { return path.relative(REPO_ROOT, file).replace(/\\/g, '/'); }
function exists(relPath) { return fs.existsSync(path.join(REPO_ROOT, relPath)); }

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'build', '.git', 'coverage'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.[cm]?[tj]sx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function shouldScan(file) {
  const r = rel(file);
  if (!r.startsWith('apps/web/src/')) return false;
  if (r.includes('/views/operator/') || r.includes('/viewmodels/operator') || r.includes('/components/operator/')) return false;
  if (ALLOW_PATH.some((p) => p.test(r))) return false;
  if (ROUTE_TARGETS.some((target) => target.sources.includes(r))) return true;
  if (r.includes('/views/') && /Customer|FieldReport|OperationReport|CustomerReportsCenter|FieldReportExport/.test(path.basename(r))) return true;
  if (r.includes('/viewmodels/') && /customer|fieldReport|operationReport|reports/i.test(path.basename(r))) return true;
  if (r.includes('/components/customer/') || r.includes('/components/cockpit/')) return true;
  if (r.includes('/lib/') && /customer|operationViewModel|report/i.test(path.basename(r))) return true;
  return false;
}

function isAllowed(lines, index) {
  const context = [lines[index - 2], lines[index - 1], lines[index]].filter(Boolean).join(' ');
  return ALLOW_CONTEXT.some((p) => p.test(context));
}

function collectStaticFiles() { return walk(SRC_ROOT).filter(shouldScan); }

function scanText({ text, filePath }) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isAllowed(lines, i)) continue;
    for (const item of FORBIDDEN) {
      if (item.pattern.test(line)) findings.push({ filePath, line: i + 1, token: item.token, snippet: line.trim().slice(0, 220) });
    }
  }
  return findings;
}

function scanStaticSources() {
  const findings = [];
  const missingSources = [];
  for (const target of ROUTE_TARGETS) {
    for (const source of target.sources) if (!exists(source)) missingSources.push(`${target.route} -> ${source}`);
  }
  for (const file of collectStaticFiles()) findings.push(...scanText({ filePath: rel(file), text: fs.readFileSync(file, 'utf8') }));
  return { findings, missingSources };
}

function routeToApiChecks() {
  const checks = [
    { name: '/customer/dashboard', path: '/customer/dashboard' },
    { name: '/customer/operations', path: '/customer/operations' },
    { name: '/customer/reports', path: '/customer/reports' },
  ];
  if (FIELD_ID) {
    checks.push({ name: '/customer/fields/:field_id', path: `/customer/fields/${encodeURIComponent(FIELD_ID)}` });
    checks.push({ name: '/customer/fields/:field_id/export', path: `/customer/fields/${encodeURIComponent(FIELD_ID)}/export` });
  }
  if (OPERATION_ID) checks.push({ name: '/customer/operations/:operation_id', path: `/customer/operations/${encodeURIComponent(OPERATION_ID)}` });
  return checks;
}

async function scanApiOutput() {
  if (!API_BASE) return { skipped: true, findings: [], checked: [] };
  const findings = [];
  const checked = [];
  for (const check of routeToApiChecks()) {
    const url = `${API_BASE}${check.path}`;
    try {
      const response = await fetch(url, { headers: { accept: 'text/html,application/json,*/*' } });
      const body = await response.text();
      checked.push(`${check.name} -> HTTP ${response.status}`);
      findings.push(...scanText({ filePath: url, text: body }));
    } catch (error) {
      findings.push({ filePath: url, line: 0, token: 'API_FETCH_FAILED', snippet: String(error && error.message ? error.message : error) });
    }
  }
  return { skipped: false, findings, checked };
}

function printFindings(title, findings) {
  if (!findings.length) return;
  console.error(`\n${title}`);
  for (const f of findings) {
    console.error(`- [${f.token}] ${f.filePath}${f.line ? ':' + f.line : ''}`);
    if (f.snippet) console.error(`  ${f.snippet}`);
  }
}

async function main() {
  const staticFiles = collectStaticFiles();
  const staticResult = scanStaticSources();
  const apiResult = await scanApiOutput();
  const findings = [...staticResult.findings, ...apiResult.findings];

  console.log('[CUSTOMER_UI_SEMANTICS_V1] routes:');
  for (const target of ROUTE_TARGETS) console.log(`- ${target.route}`);
  console.log(`[CUSTOMER_UI_SEMANTICS_V1] static files scanned: ${staticFiles.length}`);
  if (apiResult.skipped) console.log('[CUSTOMER_UI_SEMANTICS_V1] API scan skipped. Set GEOX_FRONTEND_ACCEPTANCE_API_BASE to enable route-output checks.');
  else for (const checked of apiResult.checked) console.log(`- ${checked}`);

  if (staticResult.missingSources.length) {
    console.error('\n[CUSTOMER_UI_SEMANTICS_V1] Missing expected source files:');
    for (const item of staticResult.missingSources) console.error(`- ${item}`);
  }
  printFindings('[CUSTOMER_UI_SEMANTICS_V1] Forbidden customer-facing tokens found:', findings);
  if (staticResult.missingSources.length || findings.length) {
    console.error('\n[CUSTOMER_UI_SEMANTICS_V1] FAILED');
    process.exit(1);
  }
  console.log('[CUSTOMER_UI_SEMANTICS_V1] PASSED');
}

main().catch((error) => {
  console.error('[CUSTOMER_UI_SEMANTICS_V1] UNHANDLED ERROR');
  console.error(error);
  process.exit(1);
});
