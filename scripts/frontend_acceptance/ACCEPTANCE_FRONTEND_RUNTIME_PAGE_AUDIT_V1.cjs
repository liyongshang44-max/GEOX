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
const INSTALL_TIMEOUT_MS = Number(process.env.FRONTEND_AUDIT_BROWSER_INSTALL_TIMEOUT_MS || 240_000);
const ROUTE_TIMEOUT_MS = Number(process.env.FRONTEND_AUDIT_ROUTE_TIMEOUT_MS || 45_000);
const AUDIT_TIMEOUT_MS = Number(process.env.FRONTEND_AUDIT_TOTAL_TIMEOUT_MS || 600_000);

const DEFAULT_ROUTES = [
  '/customer/dashboard',
  '/customer/export',
  '/operator/workbench',
  '/operator/approvals',
  '/operator/dispatch',
  '/operator/acceptance',
  '/operator/evidence',
  '/operator/devices-alerts',
  '/operator/roi-ledger',
  '/operator/field-memory',
  '/dev/flight-table',
];

function parseAuditRoutes() {
  const raw = String(process.env.FRONTEND_AUDIT_ROUTES || '').trim();
  if (!raw) return DEFAULT_ROUTES;
  const routes = raw.split(',').map((item) => item.trim()).filter(Boolean).map((item) => (item.startsWith('/') ? item : `/${item}`));
  if (routes.length === 0) throw new Error('FRONTEND_AUDIT_ROUTES was set but no routes were parsed');
  return [...new Set(routes)];
}

const ROUTES = parseAuditRoutes();
const OPERATOR_ROUTES = new Set(ROUTES.filter((route) => route.startsWith('/operator/')));
const EXPLICIT_OPERATOR_STATE = /正在加载运营数据|暂无待处理事项|运营数据加载失败|当前账号权限不足|数据范围|更新时间|总数|待处理|正式运营|证据中心|田块记忆|ROI|派发|验收|告警|审批/;
const ROUTE_ERROR_RE = /RouteErrorBoundary|页面发生错误|Something went wrong|Cannot read properties|Minified React error/i;
const DUPLICATE_KEY_RE = /Encountered two children with the same key|same key|duplicate key/i;
const LOADING_RE = /页面加载中|正在加载运营数据|加载中\.\.\.|审批中心加载中|运营数据加载中/i;
const VISIBLE_TEXT_MIN_LENGTH = 24;
const DASHBOARD_LAYOUT_SELECTORS = ['.customerDashboardPage', '.customerSummaryGrid', '.cockpitKpiGrid', '.customerActionGrid', '.cockpitGrid', '.customerDashboardSection'];

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function withTimeout(promise, label, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function requestOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 500); });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

async function waitForHttp(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await requestOk(url)) return true;
    await sleep(500);
  }
  return false;
}

function ensurePlaywrightChromiumInstalled() {
  if (process.env.FRONTEND_AUDIT_SKIP_BROWSER_INSTALL === '1') return;
  console.log('[frontend-runtime-audit] ensuring Playwright Chromium is installed');
  const ret = spawnSync('pnpm', ['exec', 'playwright', 'install', 'chromium'], { cwd: ROOT, env: process.env, stdio: 'inherit', timeout: INSTALL_TIMEOUT_MS });
  if (ret.error) throw new Error(`playwright chromium install failed: ${ret.error.message || ret.error}`);
  if (ret.signal) throw new Error(`playwright chromium install terminated by signal=${ret.signal}`);
  if (ret.status !== 0) throw new Error(`playwright chromium install failed with exit=${ret.status}`);
}

function startWebServerIfNeeded() {
  if (process.env.FRONTEND_AUDIT_SKIP_WEB_SERVER === '1') return null;
  const child = spawn('pnpm', ['--filter', '@geox/web', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
    cwd: ROOT,
    env: { ...process.env, GEOX_WEB_PROXY_TARGET: API_BASE_URL, VITE_API_BASE_URL: '', VITE_API_BASE: '', BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(`[frontend-audit:web] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[frontend-audit:web] ${chunk}`));
  return child;
}

function safeText(value, max = 500) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max); }
function routeSlug(route) { return route.replace(/^\//, '').replace(/[^a-z0-9_-]+/gi, '_') || 'root'; }
function mdList(items) { return items.length ? items.map((item) => `- ${safeText(item, 350)}`).join('\n') : '- none'; }
function addFailure(result, message) { result.failures.push(message); }

async function assertDashboard1366Layout(page, result) {
  if (result.route !== '/customer/dashboard') return;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.waitForTimeout(250);
  const layout = await page.evaluate((selectors) => {
    const doc = document.documentElement;
    const body = document.body;
    const viewportWidth = window.innerWidth;
    const scrollWidth = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
    const cards = Array.from(document.querySelectorAll(selectors.join(','))).map((node) => {
      const rect = node.getBoundingClientRect();
      const label = node.getAttribute('class') || node.tagName.toLowerCase();
      return { label, left: rect.left, right: rect.right, width: rect.width };
    });
    return { viewportWidth, scrollWidth, cards };
  }, DASHBOARD_LAYOUT_SELECTORS);
  result.layout1366 = layout;
  if (layout.scrollWidth > layout.viewportWidth) addFailure(result, `dashboard 1366 overflow: scrollWidth=${layout.scrollWidth} clientWidth=${layout.viewportWidth}`);
  for (const card of layout.cards) {
    if (card.left < -1 || card.right > layout.viewportWidth + 1) addFailure(result, `dashboard card outside viewport: ${card.label} left=${Math.round(card.left)} right=${Math.round(card.right)} viewport=${layout.viewportWidth}`);
  }
}

async function auditRoute(browser, route) { return withTimeout(auditRouteUnsafe(browser, route), `audit route ${route}`, ROUTE_TIMEOUT_MS); }

async function auditRouteUnsafe(browser, route) {
  const result = { route, pass: true, visibleTextSample: '', consoleErrors: [], consoleWarnings: [], networkErrors: [], warnings: [], screenshotPath: '', diagnosis: [], failures: [], layout1366: null };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addInitScript(({ token }) => {
    const tenantContext = { tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA' };
    const meta = { role: 'admin', actor_id: 'frontend-runtime-audit', token_id: 'frontend-runtime-audit', scopes: ['operator.read', 'operator.write', 'customer.read', 'security.admin', 'ao_act.task.write', 'ao_act.receipt.write'] };
    window.localStorage.setItem('geox_ao_act_token', token);
    window.sessionStorage.setItem('geox_ao_act_token', token);
    window.localStorage.setItem('geox_tenant_context', JSON.stringify(tenantContext));
    window.sessionStorage.setItem('geox_tenant_context', JSON.stringify(tenantContext));
    window.localStorage.setItem('geox_session_meta', JSON.stringify(meta));
    window.sessionStorage.setItem('geox_session_meta', JSON.stringify(meta));
  }, { token: ACCEPTANCE_TOKEN });

  const page = await context.newPage();
  page.on('console', (msg) => {
    const text = safeText(msg.text(), 800);
    if (msg.type() === 'error') result.consoleErrors.push(text);
    if (msg.type() === 'warning') { result.consoleWarnings.push(text); if (DUPLICATE_KEY_RE.test(text)) addFailure(result, `React duplicate key warning: ${text}`); }
  });
  page.on('pageerror', (err) => result.consoleErrors.push(safeText(err.stack || err.message || err, 800)));
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (/favicon\.ico$/i.test(url)) { result.warnings.push(`favicon request failed: ${url}`); return; }
    if (!url.includes('/api/')) result.warnings.push(`non-api request failed: ${url} ${req.failure()?.errorText || ''}`);
  });
  page.on('response', (res) => {
    const url = res.url();
    const status = res.status();
    if (url.includes('/api/') && (status === 404 || status >= 500)) result.networkErrors.push(`${status} ${url}`);
    else if (url.includes('/api/') && status >= 400) result.warnings.push(`api auth/permission ${status}: ${url}`);
    else if (status >= 400 && /favicon\.ico$/i.test(url)) result.warnings.push(`favicon ${status}: ${url}`);
    else if (status >= 400) result.warnings.push(`non-api ${status}: ${url}`);
    if (DEVTOOLS_DISABLED && route === '/dev/flight-table' && url.includes('/api/v1/dev/flight-table/')) addFailure(result, `devtools disabled but flight table dev API was requested: ${url}`);
  });

  try {
    await page.goto(`${WEB_BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    const loadingStillVisible = await page.locator('body').evaluate((body, pattern) => new RegExp(pattern, 'i').test(body.innerText || ''), LOADING_RE.source).catch(() => true);
    if (loadingStillVisible) await page.waitForTimeout(10_000);
    const bodyText = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
    const text = safeText(bodyText, 2000);
    result.visibleTextSample = safeText(text, 600);
    if (!text || text.length < VISIBLE_TEXT_MIN_LENGTH) addFailure(result, `body text is empty or too short (${text.length})`);
    if (ROUTE_ERROR_RE.test(text)) addFailure(result, 'RouteErrorBoundary or route runtime error text detected');
    if (LOADING_RE.test(text)) addFailure(result, 'loading text still visible after 10 seconds');
    if (OPERATOR_ROUTES.has(route) && !EXPLICIT_OPERATOR_STATE.test(text)) addFailure(result, 'operator page does not expose explicit main content state');
    await assertDashboard1366Layout(page, result);
    for (const error of result.consoleErrors) addFailure(result, `console.error/pageerror: ${error}`);
    for (const networkError of result.networkErrors) addFailure(result, `/api 404/5xx response: ${networkError}`);
  } catch (error) {
    addFailure(result, `navigation/audit exception: ${safeText(error && (error.stack || error.message || error), 900)}`);
  } finally {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const screenshotRel = `docs/audit/frontend-runtime-page-audit/${routeSlug(route)}.png`;
    result.screenshotPath = screenshotRel;
    await page.screenshot({ path: path.join(ROOT, screenshotRel), fullPage: true }).catch((error) => { result.warnings.push(`screenshot failed: ${safeText(error.message || error)}`); });
    await context.close().catch(() => undefined);
  }
  result.pass = result.failures.length === 0;
  result.diagnosis = result.pass ? ['runtime page audit passed'] : result.failures;
  return result;
}

function writeReport(results) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const lines = [];
  lines.push('# Frontend Runtime Page Audit Report', '', `Generated at: ${new Date().toISOString()}`, `Web base URL: ${WEB_BASE_URL}`, `API proxy target: ${API_BASE_URL}`, `Devtools disabled: ${DEVTOOLS_DISABLED ? 'yes' : 'no'}`, `Routes audited: ${ROUTES.length}`);
  if (process.env.FRONTEND_AUDIT_ROUTES) lines.push(`Route source: FRONTEND_AUDIT_ROUTES`);
  lines.push('', '| route | status | screenshot | diagnosis |', '| --- | --- | --- | --- |');
  for (const result of results) lines.push(`| \`${result.route}\` | ${result.pass ? 'PASS' : 'FAIL'} | \`${result.screenshotPath}\` | ${safeText(result.diagnosis.join('; '), 180).replace(/\|/g, '/')} |`);
  lines.push('');
  for (const result of results) {
    lines.push(`## ${result.route}`, '', `- pass/fail: ${result.pass ? 'PASS' : 'FAIL'}`, `- screenshot path: \`${result.screenshotPath}\``, `- visible text sample: ${result.visibleTextSample ? `\`${result.visibleTextSample.replace(/`/g, "'")}\`` : '_empty_'}`);
    if (result.layout1366) lines.push(`- layout 1366: \`scrollWidth=${result.layout1366.scrollWidth}; clientWidth=${result.layout1366.viewportWidth}; checked=${result.layout1366.cards.length}\``);
    lines.push('- console errors:', mdList(result.consoleErrors), '- console warnings:', mdList(result.consoleWarnings), '- network 4xx/5xx:', mdList(result.networkErrors), '- warnings:', mdList(result.warnings), '- diagnosis:', mdList(result.diagnosis), '');
  }
  fs.writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`);
}

async function runAudit() {
  let chromium;
  try { ({ chromium } = require('@playwright/test')); } catch (error) { throw new Error(`@playwright/test is required for browser runtime audit: ${error.message || error}`); }
  console.log('[frontend-runtime-audit] route_count', ROUTES.length);
  console.log('[frontend-runtime-audit] routes', ROUTES.join(', '));
  console.log('[frontend-runtime-audit] route_timeout_ms', ROUTE_TIMEOUT_MS);
  console.log('[frontend-runtime-audit] total_timeout_ms', AUDIT_TIMEOUT_MS);
  ensurePlaywrightChromiumInstalled();
  let webProcess = null;
  const alreadyReady = await waitForHttp(WEB_BASE_URL, 1500);
  if (!alreadyReady) {
    webProcess = startWebServerIfNeeded();
    const ready = await waitForHttp(WEB_BASE_URL, 45_000);
    if (!ready) throw new Error(`frontend web server not ready: ${WEB_BASE_URL}`);
  }
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const route of ROUTES) {
      console.log(`[frontend-runtime-audit] auditing ${route}`);
      results.push(await auditRoute(browser, route));
    }
  } finally {
    await browser.close().catch(() => undefined);
    if (webProcess) { webProcess.kill('SIGTERM'); setTimeout(() => webProcess.kill('SIGKILL'), 3000).unref(); }
  }
  writeReport(results);
  const failed = results.filter((result) => !result.pass);
  if (failed.length) {
    console.error(`[frontend-runtime-audit] failed routes: ${failed.map((item) => item.route).join(', ')}`);
    console.error(`[frontend-runtime-audit] report: ${REPORT_PATH}`);
    process.exit(1);
  }
  console.log(`[frontend-runtime-audit] passed ${results.length} routes`);
  console.log(`[frontend-runtime-audit] report: ${REPORT_PATH}`);
}

withTimeout(runAudit(), 'frontend runtime page audit', AUDIT_TIMEOUT_MS).catch((error) => {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `# Frontend Runtime Page Audit Report\n\nFAIL: ${safeText(error && (error.stack || error.message || error), 1500)}\n`);
  console.error(error);
  process.exit(1);
});
