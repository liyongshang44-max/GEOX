#!/usr/bin/env node
/*
 * GEOX operator UI semantics acceptance v1.
 *
 * Default mode: static source scan for operator main-view render surfaces.
 * Optional API mode: set GEOX_FRONTEND_ACCEPTANCE_API_BASE to scan route output.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SRC_ROOT = path.join(REPO_ROOT, 'apps', 'web', 'src');
const API_BASE = String(process.env.GEOX_FRONTEND_ACCEPTANCE_API_BASE || process.env.API_BASE || '').replace(/\/+$/, '');

const ROUTES = [
  '/operator/workbench',
  '/operator/approvals',
  '/operator/dispatch',
  '/operator/acceptance',
  '/operator/evidence',
  '/operator/devices-alerts',
  '/operator/roi-ledger',
  '/operator/field-memory',
];

const ROUTE_TARGETS = [
  { route: '/operator/workbench', sources: ['apps/web/src/views/operator/OperatorWorkbenchPage.tsx', 'apps/web/src/viewmodels/operatorWorkbenchVm.ts'] },
  { route: '/operator/approvals', sources: ['apps/web/src/views/operator/OperatorApprovalsPage.tsx', 'apps/web/src/viewmodels/operatorApprovalsVm.ts'] },
  { route: '/operator/dispatch', sources: ['apps/web/src/views/operator/OperatorDispatchPage.tsx', 'apps/web/src/viewmodels/operatorDispatchVm.ts'] },
  { route: '/operator/acceptance', sources: ['apps/web/src/views/operator/OperatorAcceptancePage.tsx', 'apps/web/src/viewmodels/operatorAcceptanceVm.ts'] },
  { route: '/operator/evidence', sources: ['apps/web/src/views/operator/OperatorEvidencePage.tsx', 'apps/web/src/viewmodels/operatorEvidenceVm.ts'] },
  { route: '/operator/devices-alerts', sources: ['apps/web/src/views/operator/OperatorDevicesAlertsPage.tsx', 'apps/web/src/viewmodels/operatorDevicesAlertsVm.ts'] },
  { route: '/operator/roi-ledger', sources: ['apps/web/src/views/operator/OperatorRoiLedgerPage.tsx', 'apps/web/src/viewmodels/operatorRoiLedgerVm.ts'] },
  { route: '/operator/field-memory', sources: ['apps/web/src/views/operator/OperatorFieldMemoryPage.tsx', 'apps/web/src/viewmodels/operatorFieldMemoryVm.ts'] },
];

const FORBIDDEN = [
  { token: 'P1-C', pattern: /\bP1-C\b/ },
  { token: 'OPERATOR DIAGNOSTIC ENHANCEMENT', pattern: /OPERATOR DIAGNOSTIC ENHANCEMENT/ },
  { token: 'IRRIGATE', pattern: /\bIRRIGATE\b/ },
  { token: 'PENDING_ACCEPTANCE', pattern: /\bPENDING_ACCEPTANCE\b/ },
  { token: 'operation_state', pattern: /\boperation_state\b/i },
  { token: 'AO-ACT', pattern: /\bAO-ACT\b/i },
  { token: 'Dispatch', pattern: /\bDispatch\b/ },
  { token: 'ACK', pattern: /\bACK\b/ },
  { token: 'Receipt', pattern: /\bReceipt\b/ },
  { token: 'manifest', pattern: /\bmanifest\b/i },
  { token: 'sha256 checksum', pattern: /sha256\s+checksum/i },
  { token: 'field_id', pattern: /\bfield_id\b/ },
  { token: 'operation_id', pattern: /\boperation_id\b/ },
  { token: 'memory_type', pattern: /\bmemory_type\b/ },
  { token: 'before', pattern: /(^|[^A-Za-z0-9_])before([^A-Za-z0-9_]|$)/ },
  { token: 'after', pattern: /(^|[^A-Za-z0-9_])after([^A-Za-z0-9_]|$)/ },
  { token: 'delta', pattern: /(^|[^A-Za-z0-9_])delta([^A-Za-z0-9_]|$)/ },
];

const ALLOW_PATH_PATTERNS = [
  /(^|[/\\])scripts([/\\]|$)/,
  /(^|[/\\])test(s)?([/\\]|$)/,
  /(^|[/\\])__tests__([/\\]|$)/,
  /\.test\.[tj]sx?$/,
  /\.spec\.[tj]sx?$/,
  /operatorStatusLabels\.ts$/,
  /operatorSafeText\.ts$/,
  /operatorTechnicalDisclosure\.ts$/,
  /operatorQueueVm\.ts$/,
  /api[/\\]/,
];

const ALLOW_LINE_PATTERNS = [
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
  /trace_ref/,
  /skill_id/,
  /skill_version/,
  /binding_scope/,
  /last_run_status/,
  /input_summary/,
  /output_summary/,
  /setSearchParams/,
  /searchParams\.get\(/,
  /next\.(field_id|operation_id|memory_type)\s*=/,
  /params\.set\(['"](field_id|operation_id|memory_type)['"]/,
  /new URLSearchParams/,
  /encodeURIComponent/,
  /permissionKey="ack"/,
  /permissionName: "operator_alert_ack_close"/,
  /canAck|ackBusy|onAck|ackDisabled|ackReason|ackCloseReady/,
  /\b(IRRIGATE|PENDING_ACCEPTANCE|ACK|Dispatch|Receipt)\b.*(===|!==|case\s|includes\(|map|label|status|kind|type)/,
  /(===|!==|case\s|includes\(|map|label|status|kind|type).*\b(IRRIGATE|PENDING_ACCEPTANCE|ACK|Dispatch|Receipt)\b/,
  /\b(field_id|operation_id|memory_type)\b.*(searchParams|URLSearchParams|query|params|filter|href|internal)/,
  /(searchParams|URLSearchParams|query|params|filter|href|internal).*\b(field_id|operation_id|memory_type)\b/,
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

function shouldScanOperatorPath(file) {
  const r = rel(file);
  if (!r.startsWith('apps/web/src/')) return false;
  if (ALLOW_PATH_PATTERNS.some((pattern) => pattern.test(r))) return false;
  if (ROUTE_TARGETS.some((target) => target.sources.includes(r))) return true;
  if (r.includes('/views/operator/')) return true;
  if (r.includes('/viewmodels/operator')) return true;
  if (r.includes('/components/operator/')) return true;
  if (r.includes('/layouts/OperatorLayout')) return true;
  return false;
}

function isAllowedLine(lines, index) {
  const context = [lines[index - 2], lines[index - 1], lines[index]].filter(Boolean).join(' ');
  return ALLOW_LINE_PATTERNS.some((pattern) => pattern.test(context));
}

function collectStaticFiles() {
  return walk(SRC_ROOT).filter(shouldScanOperatorPath);
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

async function scanApiOutput() {
  if (!API_BASE) return { skipped: true, findings: [], checked: [] };
  const findings = [];
  const checked = [];
  for (const route of ROUTES) {
    const url = `${API_BASE}${route}`;
    try {
      const response = await fetch(url, { headers: { accept: 'text/html,application/json,*/*' } });
      const body = await response.text();
      checked.push(`${route} -> HTTP ${response.status}`);
      findings.push(...scanText({ name: `api:${route}`, filePath: url, text: body }));
    } catch (error) {
      findings.push({ name: `api:${route}`, filePath: url, line: 0, token: 'API_FETCH_FAILED', snippet: String(error && error.message ? error.message : error) });
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

  console.log('[OPERATOR_UI_SEMANTICS_V1] routes:');
  for (const route of ROUTES) console.log(`- ${route}`);
  console.log(`[OPERATOR_UI_SEMANTICS_V1] static files scanned: ${staticFiles.length}`);
  if (apiResult.skipped) {
    console.log('[OPERATOR_UI_SEMANTICS_V1] API scan skipped. Set GEOX_FRONTEND_ACCEPTANCE_API_BASE to enable route-output checks.');
  } else {
    console.log('[OPERATOR_UI_SEMANTICS_V1] API checks:');
    for (const checked of apiResult.checked) console.log(`- ${checked}`);
  }

  if (staticResult.missingSources.length) {
    console.error('\n[OPERATOR_UI_SEMANTICS_V1] Missing expected source files:');
    for (const item of staticResult.missingSources) console.error(`- ${item}`);
  }
  printFindings('[OPERATOR_UI_SEMANTICS_V1] Forbidden operator main-view tokens found:', findings);

  if (staticResult.missingSources.length || findings.length) {
    console.error('\n[OPERATOR_UI_SEMANTICS_V1] FAILED');
    process.exit(1);
  }
  console.log('[OPERATOR_UI_SEMANTICS_V1] PASSED');
}

main().catch((error) => {
  console.error('[OPERATOR_UI_SEMANTICS_V1] UNHANDLED ERROR');
  console.error(error);
  process.exit(1);
});
