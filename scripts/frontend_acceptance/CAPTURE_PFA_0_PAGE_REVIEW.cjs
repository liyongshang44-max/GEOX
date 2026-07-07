// scripts/frontend_acceptance/CAPTURE_PFA_0_PAGE_REVIEW.cjs
'use strict';

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'docs/frontend-acceptance/PFA-0-REVIEW-MANIFEST.json');
const INVENTORY_PATH = path.join(ROOT, 'docs/frontend-productization/PFE-13-ROUTE-INVENTORY.json');
const DEFAULT_WEB_PORT = String(process.env.PFA0_WEB_PORT || '5177');
const WEB_BASE_URL = String(process.env.FRONTEND_AUDIT_WEB_BASE_URL || `http://127.0.0.1:${DEFAULT_WEB_PORT}`).replace(/\/+$/, '');
const API_BASE_URL = String(process.env.API_BASE_URL || process.env.GEOX_WEB_PROXY_TARGET || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const CAPTURE_MODE = String(process.env.PFA0_CAPTURE_MODE || 'full').toLowerCase();
const SESSION_VALUE = String(process.env.FRONTEND_AUDIT_TOKEN || process.env.GEOX_ACCEPTANCE_TOKEN || 'admin_token');
const AUTH_FAILURE_LIMIT = Number(process.env.PFA0_AUTH_FAILURE_LIMIT || '6');
const SESSION_GUARD_TIMEOUT_MS = Number(process.env.PFA0_SESSION_GUARD_TIMEOUT_MS || '10000');
const SESSION_KEY = ['geox', 'ao', 'act', 'token'].join('_');
const CONTEXT_KEY = ['geox', 'tenant', 'context'].join('_');
const META_KEY = ['geox', 'session', 'meta'].join('_');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function rel(file) { return path.relative(ROOT, file).replace(/\\/g, '/'); }
function routeSlug(value) { return value.replace(/^\//, '').replace(/[^a-z0-9_-]+/gi, '_') || 'root'; }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function isLoginUrl(value) { try { return new URL(value).pathname === '/login'; } catch { return String(value || '').includes('/login'); } }
function containsAuthPlaceholder(text) { return /正在验证会话|validating session/i.test(String(text || '')); }
function containsPageShell(text) { return /GEOX|Customer|Operator|Admin|客户|操作员|后台|报告|地块|作业|运行|治理/i.test(String(text || '')); }
function isAuthCaptureFailure(result) { return result.status === 'FAIL' && /unexpected login redirect|auth validation placeholder|session guard did not settle|page shell text not detected/i.test(result.notes.join(' ')); }

function requestOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 500)); });
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

async function fetchJson(url, init, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timer);
  }
}

async function preflightAuth() {
  console.log(`[pfa-0-review] auth preflight: ${API_BASE_URL}/api/v1/auth/login`);
  const login = await fetchJson(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: SESSION_VALUE }),
  });
  const tenant = { tenant_id: login.tenant_id, project_id: login.project_id, group_id: login.group_id };
  if (!tenant.tenant_id || !tenant.project_id || !tenant.group_id) throw new Error('auth preflight did not return tenant context');
  const me = await fetchJson(`${API_BASE_URL}/api/v1/auth/me`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${SESSION_VALUE}`,
      'x-tenant-id': tenant.tenant_id,
      'x-project-id': tenant.project_id,
      'x-group-id': tenant.group_id,
    },
  });
  console.log(`[pfa-0-review] auth preflight ok: ${me.tenant_id}/${me.project_id}/${me.group_id} role=${me.role}`);
  return me;
}

function ensureBrowser() {
  if (process.env.FRONTEND_AUDIT_SKIP_BROWSER_INSTALL === '1') return;
  const ret = spawnSync('pnpm', ['exec', 'playwright', 'install', 'chromium'], { cwd: ROOT, stdio: 'inherit', env: process.env, timeout: 240000 });
  if (ret.error) throw ret.error;
  if (ret.status !== 0) throw new Error(`browser install failed with exit=${ret.status}`);
}

async function startWeb() {
  if (process.env.FRONTEND_AUDIT_SKIP_WEB_SERVER === '1') return null;
  if (await waitForHttp(WEB_BASE_URL, 1000)) {
    console.log(`[pfa-0-review] using existing web runtime at ${WEB_BASE_URL}`);
    return null;
  }
  const port = new URL(WEB_BASE_URL).port || DEFAULT_WEB_PORT;
  const child = spawn('pnpm', ['--filter', '@geox/web', 'exec', 'vite', '--config', 'vite.config.ts', '--host', '127.0.0.1', '--port', port, '--strictPort'], {
    cwd: ROOT,
    env: { ...process.env, GEOX_WEB_PROXY_TARGET: API_BASE_URL, VITE_API_BASE_URL: '', VITE_API_BASE: '', BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write('[pfa-0-review:web] ' + String(chunk)));
  child.stderr.on('data', (chunk) => process.stderr.write('[pfa-0-review:web] ' + String(chunk)));
  return child;
}

function stopWeb(child) {
  if (!child) return;
  try {
    if (process.platform === 'win32' && child.pid) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      return;
    }
    child.kill('SIGTERM');
  } catch {}
}

function concreteRoute(route, bindings) {
  let next = route;
  for (const [token, value] of Object.entries(bindings || {})) next = next.replaceAll(token, value);
  return next;
}

function inventoryRoutes(manifest, inventory) {
  const raw = ['customer', 'operator', 'admin', 'supporting'].flatMap((group) => (Array.isArray(inventory[group]) ? inventory[group] : []));
  return raw.map((record) => ({ ...record, capturePath: concreteRoute(record.route, manifest.concreteRouteBindings) })).filter((record) => typeof record.capturePath === 'string' && record.capturePath.startsWith('/'));
}

function selectedRoutes(manifest, inventory) {
  const routes = inventoryRoutes(manifest, inventory);
  if (CAPTURE_MODE === 'full') return routes;
  const critical = new Set(manifest.demoCriticalRoutes || []);
  return routes.filter((record) => critical.has(record.capturePath));
}

function selectedViewports(manifest) {
  return CAPTURE_MODE === 'full' ? Object.keys(manifest.viewports || {}) : ['desktopReview'];
}

async function applyLocale(context, locale) {
  await context.addInitScript((localeValue) => {
    window.localStorage.setItem('geox.locale', localeValue);
  }, locale);
}

async function applySession(context, locale, auth) {
  await context.addInitScript(({ localeValue, token, keys, authPayload }) => {
    const tenantContext = { tenant_id: authPayload.tenant_id, project_id: authPayload.project_id, group_id: authPayload.group_id };
    const sessionMeta = { role: authPayload.role || 'admin', scopes: Array.isArray(authPayload.scopes) ? authPayload.scopes : [], actor_id: authPayload.actor_id || '', token_id: authPayload.token_id || '' };
    window.localStorage.setItem('geox.locale', localeValue);
    window.sessionStorage.setItem('geox.locale', localeValue);
    window.localStorage.setItem(keys.session, token);
    window.sessionStorage.setItem(keys.session, token);
    window.localStorage.setItem(keys.context, JSON.stringify(tenantContext));
    window.sessionStorage.setItem(keys.context, JSON.stringify(tenantContext));
    window.localStorage.setItem(keys.meta, JSON.stringify(sessionMeta));
    window.sessionStorage.setItem(keys.meta, JSON.stringify(sessionMeta));
  }, { localeValue: locale, token: SESSION_VALUE, keys: { session: SESSION_KEY, context: CONTEXT_KEY, meta: META_KEY }, authPayload: auth });
}

async function waitForSessionGuard(page, routePath) {
  if (routePath === '/login') return;
  const settled = await page.waitForFunction(() => {
    const text = document.body?.innerText || '';
    const isLogin = window.location.pathname === '/login';
    const isChecking = /正在验证会话|validating session/i.test(text);
    return isLogin || !isChecking;
  }, undefined, { timeout: SESSION_GUARD_TIMEOUT_MS }).then(() => true).catch(() => false);
  if (!settled) throw new Error(`session guard did not settle within ${SESSION_GUARD_TIMEOUT_MS}ms for ${routePath}`);
}

async function captureOne(browser, manifest, route, locale, viewportName, auth, index, total) {
  const viewport = manifest.viewports[viewportName];
  if (!viewport) throw new Error(`Unknown viewport: ${viewportName}`);
  console.log(`[pfa-0-review] capture ${index}/${total}: ${route.capturePath} locale=${locale} viewport=${viewportName}`);
  const context = await browser.newContext({ viewport });
  if (route.capturePath === '/login') await applyLocale(context, locale);
  else await applySession(context, locale, auth);
  const page = await context.newPage();
  const result = { route: route.route, capturePath: route.capturePath, surface: route.surface, locale, viewport: viewportName, status: 'PASS', screenshot: '', notes: [] };
  try {
    await page.goto(`${WEB_BASE_URL}${route.capturePath}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await waitForSessionGuard(page, route.capturePath);
    await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => undefined);
    await page.waitForTimeout(250);
    const finalUrl = page.url();
    if (route.capturePath !== '/login' && isLoginUrl(finalUrl)) {
      throw new Error(`unexpected login redirect for ${route.capturePath}; check FRONTEND_AUDIT_TOKEN/API server`);
    }
    const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    if (route.capturePath !== '/login' && containsAuthPlaceholder(bodyText)) {
      throw new Error(`auth validation placeholder still visible for ${route.capturePath}`);
    }
    if (!containsPageShell(bodyText)) {
      throw new Error(`page shell text not detected for ${route.capturePath}`);
    }
    const outputDir = path.join(ROOT, manifest.artifactPolicy.screenshotDirectory, route.surface, locale, viewportName);
    fs.mkdirSync(outputDir, { recursive: true });
    const screenshot = path.join(outputDir, `${routeSlug(route.capturePath)}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    result.screenshot = rel(screenshot);
  } catch (error) {
    result.status = 'FAIL';
    result.notes.push(String(error && (error.message || error)).slice(0, 240));
  } finally {
    await context.close().catch(() => undefined);
  }
  console.log(`[pfa-0-review] ${result.status}: ${route.capturePath} locale=${locale} viewport=${viewportName}`);
  return result;
}

function writeReport(manifest, results) {
  const reportPath = path.join(ROOT, manifest.artifactPolicy.reportPath);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const lines = ['# PFA-0 Page Review Report', '', `Generated at: ${new Date().toISOString()}`, `Mode: ${CAPTURE_MODE}`, `Source inventory: ${manifest.sourceInventory}`, '', '| surface | route | capture path | locale | viewport | status | screenshot | notes |', '| --- | --- | --- | --- | --- | --- | --- | --- |'];
  for (const result of results) lines.push(`| ${result.surface} | \`${result.route}\` | \`${result.capturePath}\` | ${result.locale} | ${result.viewport} | ${result.status} | \`${result.screenshot || 'n/a'}\` | ${result.notes.join('; ') || 'review'} |`);
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
}

async function main() {
  const manifest = readJson(MANIFEST_PATH);
  const inventory = readJson(INVENTORY_PATH);
  let web = null;
  let browser = null;
  const results = [];
  let consecutiveAuthFailures = 0;
  try {
    ensureBrowser();
    const auth = await preflightAuth();
    web = await startWeb();
    if (!(await waitForHttp(WEB_BASE_URL, 60000))) throw new Error(`web not reachable: ${WEB_BASE_URL}`);
    const { chromium } = require('@playwright/test');
    browser = await chromium.launch({ headless: true });
    const jobs = [];
    for (const route of selectedRoutes(manifest, inventory)) for (const locale of manifest.locales) for (const viewportName of selectedViewports(manifest)) jobs.push({ route, locale, viewportName });
    console.log(`[pfa-0-review] capture plan: mode=${CAPTURE_MODE} jobs=${jobs.length} web=${WEB_BASE_URL}`);
    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      const result = await captureOne(browser, manifest, job.route, job.locale, job.viewportName, auth, i + 1, jobs.length);
      results.push(result);
      if (job.route.capturePath !== '/login' && isAuthCaptureFailure(result)) consecutiveAuthFailures += 1;
      else consecutiveAuthFailures = 0;
      if (consecutiveAuthFailures >= AUTH_FAILURE_LIMIT) {
        console.error(`[pfa-0-review] auth-wide capture failure: ${consecutiveAuthFailures} consecutive authenticated routes failed; stopping early`);
        break;
      }
    }
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (results.length) writeReport(manifest, results);
    if (web) stopWeb(web);
  }
  if (results.some((result) => result.status !== 'PASS')) process.exit(1);
  console.log(JSON.stringify({ ok: true, capture: 'PFA_0_PAGE_REVIEW', mode: CAPTURE_MODE, screenshots: results.length, report: manifest.artifactPolicy.reportPath, webBaseUrl: WEB_BASE_URL }, null, 2));
}

main().catch((error) => {
  console.error('[pfa-0-review] FAIL');
  console.error(error);
  process.exit(1);
});
