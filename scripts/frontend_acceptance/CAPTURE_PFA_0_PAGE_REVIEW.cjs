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
const WEB_ORIGIN = new URL(WEB_BASE_URL).origin;
const API_BASE_URL = String(process.env.API_BASE_URL || process.env.GEOX_WEB_PROXY_TARGET || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const CAPTURE_MODE = String(process.env.PFA0_CAPTURE_MODE || 'full').toLowerCase();
const SESSION_VALUE = String(process.env.FRONTEND_AUDIT_TOKEN || process.env.GEOX_ACCEPTANCE_TOKEN || 'admin_token').trim();
const AUTH_FAILURE_LIMIT = Number(process.env.PFA0_AUTH_FAILURE_LIMIT || '6');
const SESSION_GUARD_TIMEOUT_MS = Number(process.env.PFA0_SESSION_GUARD_TIMEOUT_MS || '12000');
const SESSION_KEY = ['geox', 'ao', 'act', 'token'].join('_');
const CONTEXT_KEY = ['geox', 'tenant', 'context'].join('_');
const META_KEY = ['geox', 'session', 'meta'].join('_');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function rel(file) { return path.relative(ROOT, file).replace(/\\/g, '/'); }
function routeSlug(value) { return value.replace(/^\//, '').replace(/[^a-z0-9_-]+/gi, '_') || 'root'; }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function isLoginUrl(value) { try { return new URL(value).pathname === '/login'; } catch { return String(value || '').includes('/login'); } }
function isApiPath(value, expectedPath) { try { return new URL(value).pathname === expectedPath; } catch { return false; } }
function isSameOriginApiUrl(value, expectedPath) { try { const url = new URL(value); return url.origin === WEB_ORIGIN && url.pathname === expectedPath; } catch { return false; } }
function containsAuthPlaceholder(text) { return /正在验证会话|validating session/i.test(String(text || '')); }
function isAuthCaptureFailure(result) { return result.status === 'FAIL' && /auth\/me|login redirect|session guard|authentication|authorization|api origin/i.test(result.notes.join(' ')); }

function requestOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(Boolean(res.statusCode && res.statusCode >= 200 && res.statusCode < 500)); });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

async function waitForHttp(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await requestOk(url)) return true;
    await sleep(500);
  }
  return false;
}

async function fetchJson(url, init, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status} ${url} ${text.slice(0, 220)}`);
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
  if (!login.tenant_id || !login.project_id || !login.group_id) throw new Error('auth preflight did not return tenant context');
  const me = await fetchJson(`${API_BASE_URL}/api/v1/auth/me`, {
    headers: {
      authorization: `Bearer ${SESSION_VALUE}`,
      'x-tenant-id': login.tenant_id,
      'x-project-id': login.project_id,
      'x-group-id': login.group_id,
    },
  });
  console.log(`[pfa-0-review] auth preflight ok: ${me.tenant_id}/${me.project_id}/${me.group_id} role=${me.role}`);
}

async function preflightProxyAuth() {
  const url = `${WEB_BASE_URL}/api/v1/auth/login`;
  console.log(`[pfa-0-review] proxy auth preflight: ${url}`);
  const login = await fetchJson(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-contract-version': '2026-04-06',
      origin: WEB_ORIGIN,
      referer: `${WEB_BASE_URL}/login`,
    },
    body: JSON.stringify({ token: SESSION_VALUE }),
  });
  if (!login.tenant_id || !login.project_id || !login.group_id) throw new Error('proxy auth preflight did not return tenant context');
  console.log(`[pfa-0-review] proxy auth preflight ok: ${login.tenant_id}/${login.project_id}/${login.group_id} role=${login.role}`);
}

function ensureBrowser() {
  if (process.env.FRONTEND_AUDIT_SKIP_BROWSER_INSTALL === '1') return;
  const result = spawnSync('pnpm', ['exec', 'playwright', 'install', 'chromium'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    timeout: 240000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`browser install failed with exit=${result.status}`);
}

async function startWeb() {
  if (process.env.FRONTEND_AUDIT_SKIP_WEB_SERVER === '1') return null;
  if (await waitForHttp(WEB_BASE_URL, 1000)) {
    console.log(`[pfa-0-review] using existing web runtime at ${WEB_BASE_URL}`);
    return null;
  }
  const port = new URL(WEB_BASE_URL).port || DEFAULT_WEB_PORT;
  const child = spawn('pnpm', [
    '--filter', '@geox/web', 'exec', 'vite', '--config', 'vite.config.ts',
    '--host', '127.0.0.1', '--port', port, '--strictPort', '--force',
  ], {
    cwd: ROOT,
    env: {
      ...process.env,
      GEOX_WEB_PROXY_TARGET: API_BASE_URL,
      VITE_API_BASE_URL: '',
      VITE_API_BASE: '',
      BROWSER: 'none',
    },
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
  let result = route;
  for (const [token, value] of Object.entries(bindings || {})) result = result.replaceAll(token, value);
  return result;
}

function inventoryRoutes(manifest, inventory) {
  const records = ['customer', 'operator', 'admin', 'supporting']
    .flatMap((group) => (Array.isArray(inventory[group]) ? inventory[group] : []));
  return records
    .map((record) => ({ ...record, capturePath: concreteRoute(record.route, manifest.concreteRouteBindings) }))
    .filter((record) => typeof record.capturePath === 'string' && record.capturePath.startsWith('/'));
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

function observeResponse(page, predicate, timeoutMs, label) {
  return page.waitForResponse(predicate, { timeout: timeoutMs })
    .then((response) => ({ response, error: null }))
    .catch((error) => ({ response: null, error: `${label}: ${String(error && (error.message || error))}` }));
}

async function responseBody(response) {
  try { return (await response.text()).replace(/\s+/g, ' ').slice(0, 260); }
  catch { return ''; }
}

function submittedTokenFromResponse(response) {
  try {
    const parsed = JSON.parse(response.request().postData() || '{}');
    return typeof parsed.token === 'string' ? parsed.token : '';
  } catch {
    return '';
  }
}

function storageStateHasSession(state) {
  const origin = Array.isArray(state.origins) ? state.origins.find((item) => item.origin === WEB_ORIGIN) : null;
  const keys = new Set((origin?.localStorage || []).map((item) => item.name));
  return keys.has(SESSION_KEY) && keys.has(CONTEXT_KEY) && keys.has(META_KEY);
}

async function browserLoginProbe(page, locale) {
  const result = await page.evaluate(async ({ token }) => {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-contract-version': '2026-04-06',
      },
      body: JSON.stringify({ token }),
    });
    return { status: response.status, body: await response.text(), url: response.url };
  }, { token: SESSION_VALUE });
  console.log(`[pfa-0-review] browser proxy probe locale=${locale} status=${result.status} url=${result.url}`);
  if (result.status < 200 || result.status >= 300) throw new Error(`browser proxy probe failed status=${result.status} url=${result.url} body=${result.body.slice(0, 220)}`);
  if (!isSameOriginApiUrl(result.url, '/api/v1/auth/login')) throw new Error(`browser proxy probe api origin mismatch url=${result.url} expectedOrigin=${WEB_ORIGIN}`);
}

async function createAuthenticatedStorageState(browser, locale, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript((localeValue) => {
    window.localStorage.setItem('geox.locale', localeValue);
    window.sessionStorage.setItem('geox.locale', localeValue);
  }, locale);
  const page = await context.newPage();
  try {
    page.on('request', (request) => {
      if (isApiPath(request.url(), '/api/v1/auth/login')) console.log(`[pfa-0-review] observed browser auth/login request url=${request.url()}`);
    });
    await page.goto(`${WEB_BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await browserLoginProbe(page, locale);

    const tokenInput = page.locator('#token-input');
    await tokenInput.fill(SESSION_VALUE);
    await page.waitForFunction((expectedToken) => {
      const element = document.querySelector('#token-input');
      return element instanceof HTMLTextAreaElement && element.value === expectedToken;
    }, SESSION_VALUE, { timeout: 5000 });
    await tokenInput.press('Tab');
    await page.waitForTimeout(150);

    const loginResponsePromise = observeResponse(
      page,
      (response) => isApiPath(response.url(), '/api/v1/auth/login'),
      SESSION_GUARD_TIMEOUT_MS,
      'browser auth/login response wait failed',
    );
    await page.locator('form button[type="submit"]').click();
    const observed = await loginResponsePromise;
    if (!observed.response) throw new Error(observed.error || 'browser auth/login response not observed');

    const response = observed.response;
    const requestHeaders = response.request().headers();
    const submittedToken = submittedTokenFromResponse(response);
    const tokenMatches = submittedToken === SESSION_VALUE;
    const originMatches = isSameOriginApiUrl(response.url(), '/api/v1/auth/login');
    console.log(`[pfa-0-review] browser auth/login request locale=${locale} url=${response.url()} originMatch=${originMatches} expectedLength=${SESSION_VALUE.length} submittedLength=${submittedToken.length} tokenMatch=${tokenMatches} contract=${requestHeaders['x-api-contract-version'] || 'missing'} authorization=${requestHeaders.authorization ? 'present' : 'missing'}`);
    if (!originMatches) throw new Error(`browser auth/login api origin mismatch url=${response.url()} expectedOrigin=${WEB_ORIGIN}`);
    if (!tokenMatches) throw new Error(`browser auth/login submitted token mismatch expectedLength=${SESSION_VALUE.length} submittedLength=${submittedToken.length}`);

    const body = await responseBody(response);
    console.log(`[pfa-0-review] browser auth/login locale=${locale} status=${response.status()}`);
    if (!response.ok()) throw new Error(`browser auth/login failed status=${response.status()} body=${body}`);

    await page.waitForFunction(({ tokenKey, contextKey, metaKey, expectedToken }) => (
      window.localStorage.getItem(tokenKey) === expectedToken
      && Boolean(window.localStorage.getItem(contextKey))
      && Boolean(window.localStorage.getItem(metaKey))
    ), {
      tokenKey: SESSION_KEY,
      contextKey: CONTEXT_KEY,
      metaKey: META_KEY,
      expectedToken: SESSION_VALUE,
    }, { timeout: SESSION_GUARD_TIMEOUT_MS });

    await page.evaluate((localeValue) => {
      window.localStorage.setItem('geox.locale', localeValue);
      window.sessionStorage.setItem('geox.locale', localeValue);
    }, locale);
    const state = await context.storageState();
    if (!storageStateHasSession(state)) throw new Error(`browser login storage state is incomplete for locale=${locale}`);
    console.log(`[pfa-0-review] browser login state saved: locale=${locale} url=${page.url()}`);
    return state;
  } finally {
    await context.close().catch(() => undefined);
  }
}

async function waitForRouteReady(page, routePath) {
  if (routePath === '/login') return;
  const settled = await page.waitForFunction(() => {
    const text = document.body?.innerText || '';
    const root = document.querySelector('#root');
    return window.location.pathname === '/login'
      || (!/正在验证会话|validating session/i.test(text) && Boolean(root?.childElementCount) && text.trim().length >= 10);
  }, undefined, { timeout: SESSION_GUARD_TIMEOUT_MS }).then(() => true).catch(() => false);
  if (!settled) throw new Error(`session guard did not settle within ${SESSION_GUARD_TIMEOUT_MS}ms for ${routePath}`);
}

async function requireAuthMeResponse(observed, label) {
  if (!observed.response) throw new Error(observed.error || `${label} response not observed`);
  const response = observed.response;
  const headers = response.request().headers();
  const authorizationPresent = Boolean(headers.authorization);
  const originMatches = isSameOriginApiUrl(response.url(), '/api/v1/auth/me');
  const body = await responseBody(response);
  console.log(`[pfa-0-review] ${label} status=${response.status()} url=${response.url()} originMatch=${originMatches} authorization=${authorizationPresent ? 'present' : 'missing'}`);
  if (!originMatches) throw new Error(`${label} api origin mismatch url=${response.url()} expectedOrigin=${WEB_ORIGIN}`);
  if (!response.ok()) throw new Error(`${label} failed status=${response.status()} authorization=${authorizationPresent ? 'present' : 'missing'} body=${body}`);
  if (!authorizationPresent) throw new Error(`${label} Authorization missing`);
}

async function verifyAuthenticatedStorageState(browser, storageState, locale, viewport) {
  const context = await browser.newContext({ viewport, storageState });
  await context.addInitScript((localeValue) => {
    window.localStorage.setItem('geox.locale', localeValue);
    window.sessionStorage.setItem('geox.locale', localeValue);
  }, locale);
  const page = await context.newPage();
  try {
    const mePromise = observeResponse(
      page,
      (response) => isApiPath(response.url(), '/api/v1/auth/me'),
      SESSION_GUARD_TIMEOUT_MS,
      `browser auth/me verification wait failed for locale=${locale}`,
    );
    await page.goto(`${WEB_BASE_URL}/customer/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await requireAuthMeResponse(await mePromise, `browser auth/me verify locale=${locale}`);
    await waitForRouteReady(page, '/customer/dashboard');
    if (isLoginUrl(page.url())) throw new Error(`browser auth verification redirected to ${page.url()}`);
    const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    if (containsAuthPlaceholder(bodyText)) throw new Error(`browser auth verification remained on session placeholder for locale=${locale}`);
    console.log(`[pfa-0-review] browser session verified: locale=${locale} url=${page.url()}`);
  } finally {
    await context.close().catch(() => undefined);
  }
}

async function captureOne(browser, authStates, manifest, route, locale, viewportName, index, total) {
  const viewport = manifest.viewports[viewportName];
  if (!viewport) throw new Error(`Unknown viewport: ${viewportName}`);
  console.log(`[pfa-0-review] capture ${index}/${total}: ${route.capturePath} locale=${locale} viewport=${viewportName}`);
  const loginRoute = route.capturePath === '/login';
  const context = await browser.newContext({ viewport, ...(loginRoute ? {} : { storageState: authStates[locale] }) });
  await context.addInitScript((localeValue) => {
    window.localStorage.setItem('geox.locale', localeValue);
    window.sessionStorage.setItem('geox.locale', localeValue);
  }, locale);
  const page = await context.newPage();
  const result = { route: route.route, capturePath: route.capturePath, surface: route.surface, locale, viewport: viewportName, status: 'PASS', screenshot: '', notes: [] };
  try {
    const mePromise = loginRoute ? null : observeResponse(
      page,
      (response) => isApiPath(response.url(), '/api/v1/auth/me'),
      SESSION_GUARD_TIMEOUT_MS,
      `browser auth/me response wait failed for ${route.capturePath}`,
    );
    await page.goto(`${WEB_BASE_URL}${route.capturePath}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (mePromise) await requireAuthMeResponse(await mePromise, `browser auth/me route=${route.capturePath}`);
    await waitForRouteReady(page, route.capturePath);
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(350);

    if (!loginRoute && isLoginUrl(page.url())) throw new Error(`unexpected login redirect for ${route.capturePath}: ${page.url()}`);
    const bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    if (!loginRoute && containsAuthPlaceholder(bodyText)) throw new Error(`auth validation placeholder still visible for ${route.capturePath}`);
    if (bodyText.trim().length < 10) throw new Error(`page body is empty for ${route.capturePath}`);

    const outputDir = path.join(ROOT, manifest.artifactPolicy.screenshotDirectory, route.surface, locale, viewportName);
    fs.mkdirSync(outputDir, { recursive: true });
    const screenshot = path.join(outputDir, `${routeSlug(route.capturePath)}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    result.screenshot = rel(screenshot);
  } catch (error) {
    result.status = 'FAIL';
    result.notes.push(String(error && (error.message || error)).slice(0, 420));
  } finally {
    await context.close().catch(() => undefined);
  }
  const note = result.notes.length ? ` note=${result.notes.join('; ')}` : '';
  console.log(`[pfa-0-review] ${result.status}: ${route.capturePath} locale=${locale} viewport=${viewportName}${note}`);
  return result;
}

function writeReport(manifest, results) {
  const reportPath = path.join(ROOT, manifest.artifactPolicy.reportPath);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const lines = [
    '# PFA-0 Page Review Report',
    '',
    `Generated at: ${new Date().toISOString()}`,
    `Mode: ${CAPTURE_MODE}`,
    `Source inventory: ${manifest.sourceInventory}`,
    '',
    '| surface | route | capture path | locale | viewport | status | screenshot | notes |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
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
    await preflightAuth();
    web = await startWeb();
    if (!(await waitForHttp(WEB_BASE_URL, 60000))) throw new Error(`web not reachable: ${WEB_BASE_URL}`);
    await preflightProxyAuth();

    const { chromium } = require('@playwright/test');
    browser = await chromium.launch({ headless: true });
    const bootstrapViewport = manifest.viewports.desktopReview || { width: 1440, height: 1100 };
    const authStates = {};
    for (const locale of manifest.locales) {
      authStates[locale] = await createAuthenticatedStorageState(browser, locale, bootstrapViewport);
      await verifyAuthenticatedStorageState(browser, authStates[locale], locale, bootstrapViewport);
    }

    const jobs = [];
    for (const route of selectedRoutes(manifest, inventory)) {
      for (const locale of manifest.locales) {
        for (const viewportName of selectedViewports(manifest)) jobs.push({ route, locale, viewportName });
      }
    }
    console.log(`[pfa-0-review] capture plan: mode=${CAPTURE_MODE} jobs=${jobs.length} web=${WEB_BASE_URL}`);
    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index];
      const result = await captureOne(browser, authStates, manifest, job.route, job.locale, job.viewportName, index + 1, jobs.length);
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
