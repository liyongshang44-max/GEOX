// scripts/frontend_acceptance/AUDIT_PFA_2_RUNTIME_LOCALE_CONTRACT.cjs
'use strict';

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MATRIX = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/frontend-acceptance/PFA-2-ROUTE-LOCALE-MATRIX.json'), 'utf8'));
const PORT = String(process.env.PFA2_WEB_PORT || '5184');
const WEB = String(process.env.FRONTEND_AUDIT_WEB_BASE_URL || `http://127.0.0.1:${PORT}`).replace(/\/+$/, '');
const ORIGIN = new URL(WEB).origin;
const API = String(process.env.API_BASE_URL || process.env.GEOX_WEB_PROXY_TARGET || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const TOKEN = String(process.env.FRONTEND_AUDIT_TOKEN || process.env.GEOX_ACCEPTANCE_TOKEN || 'admin_token').trim();
const VIEWPORT = { width: 1440, height: 1100 };
const TIMEOUT = Number(process.env.PFA2_SESSION_TIMEOUT_MS || '12000');
const SESSION_KEYS = ['geox_ao_act_token', 'geox_tenant_context', 'geox_session_meta'];
const REPORT = path.join(ROOT, 'docs/audit/PFA_2_RUNTIME_LOCALE_AUDIT_REPORT.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const sameApi = (value, route) => { try { const url = new URL(value); return url.origin === ORIGIN && url.pathname === route; } catch { return false; } };

function httpReady(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => { response.resume(); resolve(Boolean(response.statusCode && response.statusCode < 500)); });
    request.on('error', () => resolve(false));
    request.setTimeout(1500, () => { request.destroy(); resolve(false); });
  });
}

async function waitForHttp(url, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await httpReady(url)) return true;
    await sleep(400);
  }
  return false;
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

async function preflight() {
  const login = await fetchJson(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: TOKEN }),
  });
  if (!login.tenant_id || !login.project_id || !login.group_id) throw new Error('auth preflight context missing');
  await fetchJson(`${API}/api/v1/auth/me`, {
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'x-tenant-id': login.tenant_id,
      'x-project-id': login.project_id,
      'x-group-id': login.group_id,
    },
  });
}

function ensureBrowser() {
  if (process.env.FRONTEND_AUDIT_SKIP_BROWSER_INSTALL === '1') return;
  const run = spawnSync('pnpm', ['exec', 'playwright', 'install', 'chromium'], { cwd: ROOT, stdio: 'inherit', timeout: 240000 });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`browser install failed: ${run.status}`);
}

async function startWeb() {
  if (process.env.FRONTEND_AUDIT_SKIP_WEB_SERVER === '1') return null;
  if (await waitForHttp(WEB, 1000)) throw new Error(`web port already in use: ${WEB}`);
  const child = spawn('pnpm', ['--filter', '@geox/web', 'exec', 'vite', '--config', 'vite.config.ts', '--host', '127.0.0.1', '--port', PORT, '--strictPort', '--force'], {
    cwd: ROOT,
    env: { ...process.env, GEOX_WEB_PROXY_TARGET: API, VITE_API_BASE_URL: WEB, VITE_API_BASE: WEB, BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write('[pfa-2-locale:web] ' + String(chunk)));
  child.stderr.on('data', (chunk) => process.stderr.write('[pfa-2-locale:web] ' + String(chunk)));
  return child;
}

function stopWeb(child) {
  if (!child) return;
  if (process.platform === 'win32' && child.pid) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGTERM');
}

async function loginState(browser, locale) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  await context.addInitScript((value) => localStorage.setItem('geox.locale', value), locale);
  const page = await context.newPage();
  try {
    await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const responsePromise = page.waitForResponse((response) => sameApi(response.url(), '/api/v1/auth/login'), { timeout: TIMEOUT });
    await page.locator('#token-input').fill(TOKEN);
    await page.locator('form button[type="submit"]').click();
    const response = await responsePromise;
    if (!response.ok()) throw new Error(`browser login failed locale=${locale} status=${response.status()}`);
    await page.waitForFunction(({ keys, token }) => localStorage.getItem(keys[0]) === token && keys.slice(1).every((key) => Boolean(localStorage.getItem(key))), { keys: SESSION_KEYS, token: TOKEN }, { timeout: TIMEOUT });
    await page.evaluate((value) => localStorage.setItem('geox.locale', value), locale);
    return context.storageState();
  } finally {
    await context.close();
  }
}

async function verifyToggle(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  await context.addInitScript(() => localStorage.setItem('geox.locale', 'zh-CN'));
  const page = await context.newPage();
  try {
    await page.goto(`${WEB}/login?probe=1#locale`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const before = await page.evaluate(() => `${location.pathname}${location.search}${location.hash}`);
    await page.locator('[data-locale-option="en-US"]').click();
    await page.waitForFunction(() => document.documentElement.lang === 'en-US' && localStorage.getItem('geox.locale') === 'en-US');
    const after = await page.evaluate(() => `${location.pathname}${location.search}${location.hash}`);
    if (before !== after) throw new Error(`LocaleToggle changed route: ${before} -> ${after}`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const persisted = await page.evaluate(() => `${document.documentElement.lang}/${localStorage.getItem('geox.locale')}`);
    if (persisted !== 'en-US/en-US') throw new Error(`locale persistence failed: ${persisted}`);
  } finally {
    await context.close();
  }
}

async function snapshot(page) {
  return page.evaluate(() => {
    const selectors = 'nav,h1,h2,h3,table th,button,label,[aria-label],[title],[placeholder],[class*="boundary" i],[class*="status" i]';
    const governed = [...document.querySelectorAll(selectors)].flatMap((element) => {
      if (element.closest('code,pre,[data-locale-neutral="true"]')) return [];
      return [element.textContent, element.getAttribute('aria-label'), element.getAttribute('title'), element.getAttribute('placeholder')]
        .map((value) => String(value || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    });
    return {
      pathname: location.pathname,
      htmlLang: document.documentElement.lang,
      activeLocale: document.querySelector('[data-locale-active="true"]')?.getAttribute('data-locale-option') || '',
      governedText: [...new Set(governed)].join(' | '),
      bodyText: document.body?.innerText || '',
      guard: Boolean(document.querySelector('[data-runtime-text-guard]')),
    };
  });
}

function capability(text) {
  const value = clean(text).toLowerCase();
  return {
    readOnly: /(只读|read-only)/i.test(value),
    noExecution: /(不直接执行|不是田间执行|no direct execution|not field execution)/i.test(value),
    noDispatch: /(不下发|派发.*禁用|no dispatch|dispatch.*disabled)/i.test(value),
    liveDeviceOff: /(实时设备.*未连接|not a live device connection|live device.*not connected)/i.test(value),
    gatewayOff: /(生产网关.*未上线|production gateway.*not online)/i.test(value),
    pilotOff: /(田间试点.*未开始|试点未开始|field pilot.*not started)/i.test(value),
  };
}

async function auditOne(browser, states, record, locale, index, total) {
  const loginRoute = record.concreteAuditPath === '/login';
  const context = await browser.newContext({ viewport: VIEWPORT, ...(loginRoute ? {} : { storageState: states[locale] }) });
  await context.addInitScript((value) => localStorage.setItem('geox.locale', value), locale);
  const page = await context.newPage();
  const result = { route: record.route, path: record.concreteAuditPath, locale, status: 'PASS', notes: [], snapshot: null };
  console.log(`[pfa-2-locale] ${index}/${total} ${record.concreteAuditPath} ${locale}`);
  try {
    const mePromise = loginRoute ? null : page.waitForResponse((response) => sameApi(response.url(), '/api/v1/auth/me'), { timeout: TIMEOUT });
    await page.goto(`${WEB}${record.concreteAuditPath}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (mePromise) {
      const me = await mePromise;
      if (!me.ok() || !me.request().headers().authorization) throw new Error('auth/me proof failed');
    }
    await page.waitForFunction((expectedPath) => {
      const bodyText = document.body?.innerText || '';
      const bodyReady = bodyText.trim().length >= 10 && !/正在验证会话|validating session/i.test(bodyText);
      return location.pathname === '/login' || (location.pathname === expectedPath && bodyReady);
    }, record.concreteAuditPath, { timeout: TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => undefined);
    await page.waitForTimeout(250);
    const currentPathname = new URL(page.url()).pathname;
    if (!loginRoute && currentPathname === '/login') throw new Error('unexpected login redirect');
    const view = await snapshot(page);
    result.snapshot = view;
    const searchable = `${view.governedText} | ${view.bodyText}`;
    const required = locale === 'zh-CN' ? record.expectedZhMarkers : record.expectedEnMarkers;
    const forbidden = locale === 'zh-CN' ? record.zhForbiddenMarkers : record.enForbiddenMarkers;
    const missing = required.filter((marker) => !searchable.toLowerCase().includes(String(marker).toLowerCase()));
    const leaked = forbidden.filter((marker) => view.governedText.toLowerCase().includes(String(marker).toLowerCase()));
    const raw = view.governedText.match(/\b(?:AUTH_INVALID|AUTH_MISSING|AUTH_REVOKED|AUTH_SCOPE_DENIED|AUTH_ROLE_DENIED|INTERNAL_SERVER_ERROR|blocking_reason|source_evidence_refs)\b/g) || [];
    if (view.pathname !== record.concreteAuditPath) throw new Error(`pathname mismatch: ${view.pathname}`);
    if (view.htmlLang !== locale) throw new Error(`html lang mismatch: ${view.htmlLang}`);
    if (view.activeLocale !== locale) throw new Error(`active locale mismatch: ${view.activeLocale}`);
    if (view.guard) throw new Error('RuntimeTextGuard dependency detected');
    if (missing.length) throw new Error(`missing markers: ${missing.join(', ')}`);
    if (leaked.length) throw new Error(`forbidden markers: ${leaked.join(', ')}`);
    if (raw.length) throw new Error(`raw error codes: ${[...new Set(raw)].join(', ')}`);
  } catch (error) {
    result.status = 'FAIL';
    result.notes.push(String(error && (error.message || error)).slice(0, 420));
  } finally {
    await context.close();
  }
  return result;
}

function auditPairs(records, results) {
  return records.map((record) => {
    const zh = results.find((item) => item.route === record.route && item.locale === 'zh-CN');
    const en = results.find((item) => item.route === record.route && item.locale === 'en-US');
    const notes = [];
    if (!zh?.snapshot || !en?.snapshot || zh.status !== 'PASS' || en.status !== 'PASS') notes.push('route-locale render failed');
    else {
      if (zh.snapshot.pathname !== en.snapshot.pathname) notes.push('pathname differs');
      if (clean(zh.snapshot.governedText) === clean(en.snapshot.governedText)) notes.push('governed copy is identical');
      if (JSON.stringify(capability(`${zh.snapshot.governedText} ${zh.snapshot.bodyText}`)) !== JSON.stringify(capability(`${en.snapshot.governedText} ${en.snapshot.bodyText}`))) notes.push('role boundary differs');
    }
    return { route: record.route, status: notes.length ? 'FAIL' : 'PASS', notes };
  });
}

async function main() {
  if ((MATRIX.records || []).length !== 30) throw new Error('matrix must contain 30 routes');
  ensureBrowser();
  await preflight();
  let web = null;
  let browser = null;
  try {
    web = await startWeb();
    if (!(await waitForHttp(WEB, 60000))) throw new Error(`web not reachable: ${WEB}`);
    const { chromium } = require('@playwright/test');
    browser = await chromium.launch({ headless: true });
    await verifyToggle(browser);
    const states = {};
    for (const locale of MATRIX.supportedLocales) states[locale] = await loginState(browser, locale);
    const jobs = MATRIX.records.flatMap((record) => MATRIX.supportedLocales.map((locale) => ({ record, locale })));
    const results = [];
    for (let index = 0; index < jobs.length; index += 1) results.push(await auditOne(browser, states, jobs[index].record, jobs[index].locale, index + 1, jobs.length));
    const pairs = auditPairs(MATRIX.records, results);
    const payload = {
      ok: results.every((item) => item.status === 'PASS') && pairs.every((item) => item.status === 'PASS'),
      audit: 'AUDIT_PFA_2_RUNTIME_LOCALE_CONTRACT',
      actualRoutes: MATRIX.records.length,
      locales: MATRIX.supportedLocales.length,
      routeRenders: results.length,
      routeHealthPass: results.filter((item) => item.status === 'PASS').length,
      htmlLangPass: results.filter((item) => item.snapshot?.htmlLang === item.locale).length,
      localePairPass: pairs.filter((item) => item.status === 'PASS').length,
      runtimeTextGuardDependency: results.some((item) => item.snapshot?.guard) ? 1 : 0,
      results,
      pairs,
    };
    fs.mkdirSync(path.dirname(REPORT), { recursive: true });
    fs.writeFileSync(REPORT, JSON.stringify(payload, null, 2) + '\n');
    console.log(JSON.stringify({
      ok: payload.ok,
      audit: payload.audit,
      actualRoutes: payload.actualRoutes,
      locales: payload.locales,
      routeRenders: payload.routeRenders,
      routeHealth: `${payload.routeHealthPass}/${payload.routeRenders}`,
      htmlLang: `${payload.htmlLangPass}/${payload.routeRenders}`,
      localePairs: `${payload.localePairPass}/${payload.actualRoutes}`,
      runtimeTextGuardDependency: payload.runtimeTextGuardDependency,
      report: path.relative(ROOT, REPORT).replace(/\\/g, '/'),
    }, null, 2));
    if (!payload.ok) process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (web) stopWeb(web);
  }
}

main().catch((error) => {
  console.error('[pfa-2-locale] FAIL');
  console.error(error);
  process.exit(1);
});
