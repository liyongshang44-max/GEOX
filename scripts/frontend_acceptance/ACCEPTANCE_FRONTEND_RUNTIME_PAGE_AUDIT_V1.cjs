#!/usr/bin/env node
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const REPORT_PATH = path.join(ROOT, 'docs/audit/FRONTEND_RUNTIME_PAGE_AUDIT_REPORT.md');
const SCREENSHOT_DIR = path.join(ROOT, 'docs/audit/frontend-runtime-page-audit');
const WEB_BASE_URL = String(process.env.FRONTEND_AUDIT_WEB_BASE_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '');
const API_BASE_URL = String(process.env.API_BASE_URL || process.env.GEOX_WEB_PROXY_TARGET || 'http://127.0.0.1:3001').replace(/\/+$/, '');
const DEVTOOLS_DISABLED = !['1', 'true', 'yes', 'on'].includes(String(process.env.GEOX_DEVTOOLS_ENABLED || '').toLowerCase());
const ACCEPTANCE_TOKEN = String(process.env.GEOX_AO_ACT_TOKEN || process.env.GEOX_ACCEPTANCE_TOKEN || 'tenant_a_admin_token');
const INSTALL_TIMEOUT_MS = Number(process.env.FRONTEND_AUDIT_BROWSER_INSTALL_TIMEOUT_MS || 240000);
const ROUTE_TIMEOUT_MS = Number(process.env.FRONTEND_AUDIT_ROUTE_TIMEOUT_MS || 45000);
const AUDIT_TIMEOUT_MS = Number(process.env.FRONTEND_AUDIT_TOTAL_TIMEOUT_MS || 600000);

const DEFAULT_ROUTES = [
  '/customer/dashboard',
  '/customer/reports',
  '/customer/export',
  '/customer/fields',
  '/customer/fields/field_c8_demo',
  '/customer/operations',
  '/customer/operations/op_plan_c8_irrigation_formal_001',
  '/customer/operations/op_plan_c8_irrigation_pending_001',
  '/operator/workbench',
  '/operator/approvals',
  '/operator/dispatch',
  '/operator/acceptance',
  '/operator/evidence',
  '/operator/devices-alerts',
  '/operator/devices-alerts?focus=device_offline&device_id=dev_gateway_offline_001&field_id=field_device_risk_demo&online_status=OFFLINE',
  '/operator/devices-alerts?focus=device_offline&source=aggregate',
  '/operator/roi-ledger',
  '/operator/field-memory',
  '/dev/flight-table',
];
function parseAuditRoutes() {
  const raw = String(process.env.FRONTEND_AUDIT_ROUTES || '').trim();
  if (!raw) return DEFAULT_ROUTES;

  const routes = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.startsWith('/') ? item : `/${item}`));

  if (routes.length === 0) {
    throw new Error('FRONTEND_AUDIT_ROUTES was set but no routes were parsed');
  }

  const merged = [...routes];
  for (const route of DEFAULT_ROUTES) {
    if (!merged.includes(route)) merged.push(route);
  }
  return [...new Set(merged)];
}
const ROUTES = parseAuditRoutes();
const CUSTOMER_RAW_TEXT_ROUTES = new Set(ROUTES.filter((route) => route.startsWith('/customer/')));
const OPERATOR_ROUTES = new Set(ROUTES.filter((route) => route.startsWith('/operator/')));
const CUSTOMER_VISIBLE_RAW_PATTERNS = [
  ['LIMITED', /\bLIMITED\b/],
  ['AVAILABLE', /\bAVAILABLE\b/],
  ['PENDING', /\bPENDING\b/],
  ['UNAVAILABLE', /\bUNAVAILABLE\b/],
  ['admin/internal preview', /admin\/internal\s+preview/i],
  ['STATE_FALLBACK_LIMITED', /STATE_FALLBACK_LIMITED/],
  ['OFFICIAL_CUSTOMER_API', /OFFICIAL_CUSTOMER_API/],
  ['PENDING_ACCEPTANCE_REQUIRES_FORMAL_REVIEW', /PENDING_ACCEPTANCE_REQUIRES_FORMAL_REVIEW/],
  ['PENDING_ACCEPTANCE', /\bPENDING_ACCEPTANCE\b/],
  ['soil_moisture_below_threshold', /soil_moisture_below_threshold/],
  ['no_rain_forecast', /no_rain_forecast/],
  ['BLOCKED', /\bBLOCKED\b/],
  ['raw true table value', /(?:^|[\s：:，,；;|])true(?:$|[\s。！!？?，,；;|])/],
  ['raw false table value', /(?:^|[\s：:，,；;|])false(?:$|[\s。！!？?，,；;|])/],
  ['ROI', /\bROI\b/],
  ['Field Memory', /Field\s+Memory/],
  ['field.geometry', /field\.geometry/i],
  ['geometry_id', /geometry_id/i],
];
const EXPLICIT_OPERATOR_STATE = /正在加载运营数据|暂无待处理事项|运营数据加载失败|当前账号权限不足|数据范围|更新时间|总数|待处理|正式运营|证据中心|田块记忆|ROI|派发|验收|告警|审批|需人工核查|已确认离线|维护任务候选|缺少设备定位信息|只读/;
const ROUTE_ERROR_RE = /RouteErrorBoundary|页面发生错误|Something went wrong|Cannot read properties|Minified React error/i;
const DUPLICATE_KEY_RE = /Encountered two children with the same key|same key|duplicate key/i;
const LOADING_RE = /页面加载中|正在加载运营数据|加载中\.\.\.|审批中心加载中|运营数据加载中/i;
const VISIBLE_TEXT_MIN_LENGTH = 24;

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function withTimeout(promise, label, timeoutMs) { let timer; const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs); }); return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)); }
function requestOk(url) { return new Promise((resolve) => { const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 500); }); req.on('error', () => resolve(false)); req.setTimeout(1500, () => { req.destroy(); resolve(false); }); }); }
async function waitForHttp(url, timeoutMs) { const start = Date.now(); while (Date.now() - start < timeoutMs) { if (await requestOk(url)) return true; await sleep(500); } return false; }
function ensurePlaywrightChromiumInstalled() { if (process.env.FRONTEND_AUDIT_SKIP_BROWSER_INSTALL === '1') return; const ret = spawnSync('pnpm', ['exec', 'playwright', 'install', 'chromium'], { cwd: ROOT, env: process.env, stdio: 'inherit', timeout: INSTALL_TIMEOUT_MS }); if (ret.error) throw new Error(`playwright chromium install failed: ${ret.error.message || ret.error}`); if (ret.status !== 0) throw new Error(`playwright chromium install failed with exit=${ret.status}`); }
function startWebServerIfNeeded() { if (process.env.FRONTEND_AUDIT_SKIP_WEB_SERVER === '1') return null; const child = spawn('pnpm', ['--filter', '@geox/web', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], { cwd: ROOT, env: { ...process.env, GEOX_WEB_PROXY_TARGET: API_BASE_URL, VITE_API_BASE_URL: '', VITE_API_BASE: '', BROWSER: 'none' }, stdio: ['ignore', 'pipe', 'pipe'] }); child.stdout.on('data', (chunk) => process.stdout.write(`[frontend-audit:web] ${chunk}`)); child.stderr.on('data', (chunk) => process.stderr.write(`[frontend-audit:web] ${chunk}`)); return child; }
function safeText(value, max = 500) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function routeSlug(route) { return route.replace(/^\//, '').replace(/[^a-z0-9_-]+/gi, '_') || 'root'; }
function addFailure(result, message) { result.failures.push(message); }
function assertNoCustomerRawVisibleText(bodyText, result) { if (!CUSTOMER_RAW_TEXT_ROUTES.has(result.route)) return; for (const [label, pattern] of CUSTOMER_VISIBLE_RAW_PATTERNS) if (pattern.test(bodyText)) addFailure(result, `customer visible raw code leaked: ${label}`); }
async function auditDashboard1366Layout(page, result) {
  if (result.route !== '/customer/dashboard') return;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.waitForTimeout(250);
  const layout = await page.evaluate(() => {
    const viewportWidth = 1366;
    const rectOf = (el) => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        selector: el.className || el.tagName,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        visible: style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0,
      };
    };
    const rail = document.querySelector('.customerDashboardRightRail');
    const cardSelectors = ['.customerDashboardKpiRow > *', '.customerStructuredCard', '.customerUsagePathCard'];
    const cards = cardSelectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)).map((el) => ({ selector, ...rectOf(el) })));
    const railCards = Array.from(document.querySelectorAll('.customerDashboardRightRail > *')).map((el) => rectOf(el)).filter((x) => x && x.visible);
    return {
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth,
      rail: rectOf(rail),
      cards,
      railCards,
    };
  });
  const railWidth = Math.round(layout.rail?.width || 0);
  result.layoutDiagnosis = `dashboard 1366 layout: scrollWidth=${layout.scrollWidth}, viewportWidth=${layout.viewportWidth}, railWidth=${railWidth}`;
  if (layout.scrollWidth > layout.viewportWidth) addFailure(result, `${result.layoutDiagnosis}; document scrollWidth exceeds viewport`);
  if (!layout.rail || !layout.rail.visible) addFailure(result, `${result.layoutDiagnosis}; .customerDashboardRightRail missing or not visible`);
  if ((layout.rail?.width || 0) < 320) addFailure(result, `${result.layoutDiagnosis}; .customerDashboardRightRail width < 320`);
  for (const card of layout.cards || []) {
    if (!card.visible) continue;
    if (card.left < -1 || card.right > layout.viewportWidth + 1) addFailure(result, `${result.layoutDiagnosis}; ${card.selector} overflows viewport (${Math.round(card.left)}..${Math.round(card.right)})`);
  }
  for (const card of layout.railCards || []) {
    if (card.width < 260) addFailure(result, `${result.layoutDiagnosis}; right rail visible card width < 260 (${Math.round(card.width)})`);
  }
}
async function auditRoute(browser, route) { return withTimeout(auditRouteUnsafe(browser, route), `audit route ${route}`, ROUTE_TIMEOUT_MS); }
async function auditRouteUnsafe(browser, route) {
  const result = { route, pass: true, visibleTextSample: '', consoleErrors: [], consoleWarnings: [], networkErrors: [], warnings: [], screenshotPath: '', diagnosis: [], layoutDiagnosis: '', failures: [] };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(({ token }) => { const tenantContext = { tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA' }; const meta = { role: 'admin', actor_id: 'frontend-runtime-audit', token_id: 'frontend-runtime-audit', scopes: ['operator.read', 'operator.write', 'customer.read', 'security.admin', 'ao_act.task.write', 'ao_act.receipt.write'] }; window.localStorage.setItem('geox_ao_act_token', token); window.sessionStorage.setItem('geox_ao_act_token', token); window.localStorage.setItem('geox_tenant_context', JSON.stringify(tenantContext)); window.sessionStorage.setItem('geox_tenant_context', JSON.stringify(tenantContext)); window.localStorage.setItem('geox_session_meta', JSON.stringify(meta)); window.sessionStorage.setItem('geox_session_meta', JSON.stringify(meta)); }, { token: ACCEPTANCE_TOKEN });
  const page = await context.newPage();
  page.on('console', (msg) => { const text = safeText(msg.text(), 800); if (msg.type() === 'error') result.consoleErrors.push(text); if (msg.type() === 'warning') { result.consoleWarnings.push(text); if (DUPLICATE_KEY_RE.test(text)) addFailure(result, `React duplicate key warning: ${text}`); } });
  page.on('pageerror', (err) => result.consoleErrors.push(safeText(err.stack || err.message || err, 800)));
  page.on('response', (res) => { const url = res.url(); const status = res.status(); if (url.includes('/api/') && (status === 404 || status >= 500)) result.networkErrors.push(`${status} ${url}`); if (DEVTOOLS_DISABLED && route === '/dev/flight-table' && url.includes('/api/v1/dev/flight-table/')) addFailure(result, `devtools disabled but flight table dev API was requested: ${url}`); });
  try {
    await page.goto(`${WEB_BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    await auditDashboard1366Layout(page, result);
    const loadingStillVisible = await page.locator('body').evaluate((body, pattern) => new RegExp(pattern, 'i').test(body.innerText || ''), LOADING_RE.source).catch(() => true);
    if (loadingStillVisible) await page.waitForTimeout(10000);
    const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
    const text = safeText(bodyText, 2000);
    result.visibleTextSample = safeText(text, 600);
    assertNoCustomerRawVisibleText(bodyText, result);
    if (!text || text.length < VISIBLE_TEXT_MIN_LENGTH) addFailure(result, `body text is empty or too short (${text.length})`);
    if (ROUTE_ERROR_RE.test(text)) addFailure(result, 'route runtime error text detected');
    if (LOADING_RE.test(text)) addFailure(result, 'loading text still visible after 10 seconds');
    if (OPERATOR_ROUTES.has(route) && !EXPLICIT_OPERATOR_STATE.test(text)) addFailure(result, 'operator page does not expose explicit main content state');
    for (const error of result.consoleErrors) addFailure(result, `console.error/pageerror: ${error}`);
    for (const networkError of result.networkErrors) addFailure(result, `/api 404/5xx response: ${networkError}`);
  } catch (error) { addFailure(result, `navigation/audit exception: ${safeText(error && (error.stack || error.message || error), 900)}`); }
  finally { fs.mkdirSync(SCREENSHOT_DIR, { recursive: true }); const screenshotRel = `docs/audit/frontend-runtime-page-audit/${routeSlug(route)}.png`; result.screenshotPath = screenshotRel; await page.screenshot({ path: path.join(ROOT, screenshotRel), fullPage: true }).catch((error) => { result.warnings.push(`screenshot failed: ${safeText(error.message || error)}`); }); await context.close().catch(() => undefined); }
  result.pass = result.failures.length === 0;
  result.diagnosis = result.pass ? ['runtime page audit passed'] : result.failures;
  if (result.layoutDiagnosis) result.diagnosis.unshift(result.layoutDiagnosis);
  return result;
}
function writeReport(results) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const lines = [];
  lines.push('# Frontend Runtime Page Audit Report', '', `Generated at: ${new Date().toISOString()}`, `Web base URL: ${WEB_BASE_URL}`, `API proxy target: ${API_BASE_URL}`, `Devtools disabled: ${DEVTOOLS_DISABLED ? 'yes' : 'no'}`, `Routes audited: ${ROUTES.length}`, '', '| route | status | screenshot | diagnosis |', '| --- | --- | --- | --- |');
  for (const r of results) lines.push(`| \`${r.route}\` | ${r.pass ? 'PASS' : 'FAIL'} | \`${r.screenshotPath}\` | ${safeText(r.diagnosis.join('; '), 180).replace(/\|/g, '/')} |`);
  lines.push('');
  for (const r of results) lines.push(`## ${r.route}`, '', `- pass/fail: ${r.pass ? 'PASS' : 'FAIL'}`, `- screenshot path: \`${r.screenshotPath}\``, `- visible text sample: ${r.visibleTextSample ? `\`${r.visibleTextSample.replace(/`/g, "'")}\`` : '_empty_'}`, r.layoutDiagnosis ? `- layout diagnosis: ${r.layoutDiagnosis}` : '- layout diagnosis: n/a', `- failures:\n${r.failures.length ? r.failures.map((x) => `  - ${safeText(x, 350)}`).join('\n') : '  - none'}`, '');
  fs.writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`);
}
async function main() { let web = null; try { ensurePlaywrightChromiumInstalled(); web = startWebServerIfNeeded(); if (!(await waitForHttp(WEB_BASE_URL, 60000))) throw new Error(`web not reachable: ${WEB_BASE_URL}`); const { chromium } = require('playwright'); const browser = await chromium.launch({ headless: true }); const results = []; for (const route of ROUTES) results.push(await auditRoute(browser, route)); await browser.close(); writeReport(results); if (results.some((x) => !x.pass)) process.exit(1); console.log('[frontend-runtime-audit] PASS'); } finally { if (web) web.kill('SIGTERM'); } }
withTimeout(main(), 'frontend runtime audit', AUDIT_TIMEOUT_MS).catch((error) => { console.error('[frontend-runtime-audit] FAIL'); console.error(error); process.exit(1); });
