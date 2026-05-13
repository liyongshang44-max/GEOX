#!/usr/bin/env node
/*
 * GEOX customer UI semantics acceptance v1.
 *
 * Default mode: static source scan for customer-facing render surfaces.
 * Optional API mode: set GEOX_FRONTEND_ACCEPTANCE_API_BASE to scan route output.
 */

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
  { route: '/customer/operations', sources: ['apps/web/src/views/CustomerOperationsIndexPage.tsx', 'apps/web/src/viewmodels/customerOperationsVm.ts'] },
  { route: '/customer/operations/:operation_id', sources: ['apps/web/src/views/OperationReportPage.tsx', 'apps/web/src/viewmodels/operationReportVm.ts'] },
  { route: '/customer/reports', sources: ['apps/web/src/views/ReportsIndexPage.tsx'] },
  { route: '/customer/fields/:field_id/export', sources: ['apps/web/src/views/FieldReportExportPage.tsx'] },
];

const FORBIDDEN = [
  { token: '??????', pattern: /\?\?\?\?\?\?/ },
  { token: 'admin/internal preview', pattern: /admin\/internal preview/i },
  { token: 'P0', pattern: /\bP0\b/ },
  { token: 'P1-C', pattern: /\bP1-C\b/ },
  { token: 'P2.2', pattern: /\bP2\.2\b/ },
  { token: 'OPERATOR DIAGNOSTIC ENHANCEMENT', pattern: /OPERATOR DIAGNOSTIC ENHANCEMENT/ },
  { token: 'YIELD_LIFT_EXPECTED', pattern: /\bYIELD_LIFT_EXPECTED\b/ },
  { token: 'DEFAULT_ASSUMPTION', pattern: /\bDEFAULT_ASSUMPTION\b/ },
  { token: 'BASELINE_MISSING', pattern: /\bBASELINE_MISSING\b/ },
  { token: 'operation_plan_v1', pattern: /\boperation_plan_v1\b/ },
  { token: 'ao_act_task_v0', pattern: /\bao_act_task_v0\b/ },
  { token: 'ao_act_receipt_v0', pattern: /\bao_act_receipt_v0\b/ },
  { token: 'approval_request_v1', pattern: /\bapproval_request_v1\b/ },
  { token: 'roi_ledger_v1', pattern: /\broi_ledger_v1\b/ },
  { token: 'field_memory_v1', pattern: /\bfield_memory_v1\b/ },
  { token: 'geometry 状态', pattern: /geometry\s*状态/i },
  { token: 'manifest', pattern: /\bmanifest\b/i },
  { token: 'sha256 checksum', pattern: /sha256\s+checksum/i },
];

const ALLOW_PATH_PATTERNS = [
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

const ALLOW_LINE_PATTERNS = [
  /no-raw-enum-customer-allow/,
  /customer-boundary-allow/,
  /frontend-acceptance-allow/,
  /技术引用/,
  /审计/,
  /调试/,
  /debug/i,
  /technical/i,
  /operationTechDetails/,
  /<details\b/,
  /<summary\b/,
  /technicalRefs/,
  /sourceText/,
  /raw\s*enum/i,
  /\b(BASELINE_MISSING|YIELD_LIFT_EXPECTED|DEFAULT_ASSUMPTION)\b.*(===|!==|case\s|includes\(|map|label|status|kind|type)/,
  /(===|!==|case\s|includes\(|map|label|status|kind|type).*\b(BASELINE_MISSING|YIELD_LIFT_EXPECTED|DEFAULT_ASSUMPTION)\b/,
  /\b(operation_plan_v1|ao_act_task_v0|ao_act_receipt_v0|approval_request_v1|roi_ledger_v1|field_memory_v1)\b.*(source|technical|audit|trace|ref)/i,
];

function rel(file) {
  return path.relative(REPO_ROOT, file).replace(/\\/g, '/');
}

function exists(relPath) {
  return fs.existsSync(path.join(REPO_ROOT, relPath));
}

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

function shouldScanCustomerPath(file) {
  const r = rel(file);
  if (!r.startsWith('apps/web/src/')) return false;
  if (r.includes('/views/operator/') || r.includes('/viewmodels/operator') || r.includes('/components/operator/')) return false;
  if (ALLOW_PATH_PATTERNS.some((pattern) => pattern.test(r))) return false;
  if (ROUTE_TARGETS.some((target) => target.sources.includes(r))) return true;
  if (r.includes('/views/') && /Customer|FieldReport|OperationReport|ReportsIndex|FieldReportExport/.test(path.basename(r))) return true;
  if (r.includes('/viewmodels/') && /customer|fieldReport|operationReport|reports/i.test(path.basename(r))) return true;
  if (r.includes('/components/customer/') || r.includes('/components/cockpit/')) return true;
  if (r.includes('/lib/') && /customer|operationViewModel|report/i.test(path.basename(r))) return true;
  return false;
}

function isAllowedLine(lines, index) {
  const context = [lines[index - 2], lines[index - 1], lines[index]].filter(Boolean).join(' ');
  return ALLOW_LINE_PATTERNS.some((pattern) => pattern.test(context));
}

function collectStaticFiles() {
  return walk(SRC_ROOT).filter(shouldScanCustomerPath);
}

function scanText({ name, text, filePath = '' }) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isAllowedLine(lines, i)) continue;
    for (const item of FORBIDDEN) {
      if (!item.pattern.test(line)) continue;
      findings.push({ name, filePath, line: i + 1, token: item.token, snippet: line.trim().slice(0, 240) });
    }
  }
  return findings;
}

function scanStaticSources() {
  const findings = [];
  const missingSources = [];
  for (const target of ROUTE_TARGETS) {
    for (const source of target.sources) {
      if (!exists(source)) missingSources.push(`${target.route} -> ${source}`);
    }
  }
  for (const file of collectStaticFiles()) {
    findings.push(...scanText({ name: rel(file), filePath: rel(file), text: fs.readFileSync(file, 'utf8') }));
  }
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
      findings.push(...scanText({ name: `api:${check.name}`, filePath: url, text: body }));
    } catch (error) {
      findings.push({ name: `api:${check.name}`, filePath: url, line: 0, token: 'API_FETCH_FAILED', snippet: String(error && error.message ? error.message : error) });
    }
  }
  return { skipped: false, findings, checked };
}

function printFindings(title, findings) {
  if (!findings.length) return;
  console.error(`\n${title}`);
  for (const finding of findings) {
    const location = finding.line ? `${finding.filePath}:${finding.line}` : finding.filePath;
    console.error(`- [${finding.token}] ${location}`);
    if (finding.snippet) console.error(`  ${finding.snippet}`);
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
  if (apiResult.skipped) {
    console.log('[CUSTOMER_UI_SEMANTICS_V1] API scan skipped. Set GEOX_FRONTEND_ACCEPTANCE_API_BASE to enable route-output checks.');
  } else {
    console.log('[CUSTOMER_UI_SEMANTICS_V1] API checks:');
    for (const checked of apiResult.checked) console.log(`- ${checked}`);
    if (!FIELD_ID) console.log('[CUSTOMER_UI_SEMANTICS_V1] FIELD_ID not set; field detail/export API checks skipped.');
    if (!OPERATION_ID) console.log('[CUSTOMER_UI_SEMANTICS_V1] OPERATION_ID not set; operation detail API check skipped.');
  }

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
