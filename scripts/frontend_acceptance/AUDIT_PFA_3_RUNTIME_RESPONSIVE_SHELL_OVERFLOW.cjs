// scripts/frontend_acceptance/AUDIT_PFA_3_RUNTIME_RESPONSIVE_SHELL_OVERFLOW.cjs
'use strict';

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MATRIX_PATH = path.join(ROOT, 'docs/frontend-acceptance/PFA-3-ROUTE-VIEWPORT-MATRIX.json');
const MATRIX = JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8'));
const PORT = String(process.env.PFA3_WEB_PORT || '5185');
const WEB = String(process.env.FRONTEND_AUDIT_WEB_BASE_URL || `http://127.0.0.1:${PORT}`).replace(/\/+$/, '');
const ORIGIN = new URL(WEB).origin;
const API = String(process.env.API_BASE_URL || process.env.GEOX_WEB_PROXY_TARGET || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const TOKEN = String(process.env.FRONTEND_AUDIT_TOKEN || process.env.GEOX_ACCEPTANCE_TOKEN || '').trim();
const TIMEOUT = Number(process.env.PFA3_SESSION_TIMEOUT_MS || '15000');
const NAVIGATION_TIMEOUT = Number(process.env.PFA3_NAVIGATION_TIMEOUT_MS || '90000');
const SESSION_KEYS = ['geox_ao_act_token', 'geox_tenant_context', 'geox_session_meta'];
const REPORT = path.join(ROOT, 'docs/audit/PFA_3_RUNTIME_RESPONSIVE_SHELL_OVERFLOW_REPORT.json');
const EXTERNAL_REPORT = process.env.PFA3_RUNTIME_EVIDENCE_PATH
  ? path.resolve(process.env.PFA3_RUNTIME_EVIDENCE_PATH)
  : path.join(os.tmpdir(), 'PFA_3_RUNTIME_RESPONSIVE_SHELL_OVERFLOW_REPORT.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const resolveRecord = (record) => ({ ...MATRIX.resolvedRecordDefaults, ...record });
const records = MATRIX.records.map(resolveRecord);
const hardRecords = records.filter((record) => record.routeClass !== 'export-deferred');
const exportRecords = records.filter((record) => record.routeClass === 'export-deferred');

function sameApi(value, route) {
  try {
    const url = new URL(value);
    return url.origin === ORIGIN && url.pathname === route;
  } catch {
    return false;
  }
}

function httpReady(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(Boolean(response.statusCode && response.statusCode < 500));
    });
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
  if (!TOKEN) throw new Error('GEOX_ACCEPTANCE_TOKEN or FRONTEND_AUDIT_TOKEN is required');
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
  const run = spawnSync('pnpm', ['exec', 'playwright', 'install', 'chromium'], {
    cwd: ROOT,
    stdio: 'inherit',
    timeout: 240000,
  });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`browser install failed: ${run.status}`);
}

async function startWeb() {
  if (process.env.FRONTEND_AUDIT_SKIP_WEB_SERVER === '1') return null;
  if (await waitForHttp(WEB, 1000)) throw new Error(`web port already in use: ${WEB}`);
  const child = spawn('pnpm', [
    '--filter', '@geox/web', 'exec', 'vite', '--config', 'vite.config.ts',
    '--host', '127.0.0.1', '--port', PORT, '--strictPort', '--force',
  ], {
    cwd: ROOT,
    env: {
      ...process.env,
      GEOX_WEB_PROXY_TARGET: API,
      VITE_API_BASE_URL: WEB,
      VITE_API_BASE: WEB,
      BROWSER: 'none',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(`[pfa-3:web] ${String(chunk)}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[pfa-3:web] ${String(chunk)}`));
  return child;
}

function stopWeb(child) {
  if (!child) return;
  try { child.kill('SIGTERM'); } catch {}
}

async function loginState(browser, locale) {
  const context = await browser.newContext({ viewport: MATRIX.formalViewports.desktopReview });
  await context.addInitScript((value) => localStorage.setItem('geox.locale', value), locale);
  const page = await context.newPage();
  try {
    await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });
    const responsePromise = page.waitForResponse((response) => sameApi(response.url(), '/api/v1/auth/login'), { timeout: TIMEOUT });
    await page.locator('#token-input').fill(TOKEN);
    await page.locator('form button[type="submit"]').click();
    const response = await responsePromise;
    if (!response.ok()) throw new Error(`browser login failed locale=${locale} status=${response.status()}`);
    await page.waitForFunction(({ keys, token }) => (
      localStorage.getItem(keys[0]) === token && keys.slice(1).every((key) => Boolean(localStorage.getItem(key)))
    ), { keys: SESSION_KEYS, token: TOKEN }, { timeout: TIMEOUT });
    await page.evaluate((value) => localStorage.setItem('geox.locale', value), locale);
    return context.storageState();
  } finally {
    await context.close();
  }
}

async function waitForRoute(page, expectedPath) {
  await page.waitForFunction((pathValue) => {
    const body = document.body?.innerText || '';
    return location.pathname === pathValue && body.trim().length >= 10 && !/正在验证会话|validating session/i.test(body);
  }, expectedPath, { timeout: TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => undefined);
  await page.waitForTimeout(250);
}

async function pageSnapshot(page, record, viewportName) {
  return page.evaluate(({ routeRecord, viewportKey }) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const visible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const selectorName = (element) => {
      if (!(element instanceof Element)) return '';
      if (element.id) return `#${element.id}`;
      const classes = [...element.classList].slice(0, 3).join('.');
      return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''}`;
    };
    const rectData = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const insideViewport = (element) => {
      if (!visible(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.left >= -1 && rect.right <= viewportWidth + 1 && rect.top < viewportHeight && rect.bottom > 0;
    };
    const validRegion = (region) => Boolean(
      region
      && region.getAttribute('role') === 'region'
      && clean(region.getAttribute('aria-label'))
      && region.tabIndex === 0
      && clean(region.getAttribute('data-overflow-owner'))
      && insideViewport(region)
    );

    const requiredFailures = [];
    for (const selector of routeRecord.requiredSelectors || []) {
      const element = document.querySelector(selector);
      if (!element) requiredFailures.push({ selector, reason: 'missing' });
      else if (!insideViewport(element)) requiredFailures.push({ selector, reason: 'outside-viewport', rect: rectData(element) });
    }

    if (routeRecord.h1Required && !document.querySelector('h1')) requiredFailures.push({ selector: 'h1', reason: 'missing-required-h1' });
    if (routeRecord.boundaryRequired) {
      const boundary = document.querySelector('.productBoundaryBanner,.operatorRuntimeModeBanner,.adminShellBoundary');
      if (!boundary) requiredFailures.push({ selector: 'boundary', reason: 'missing-required-boundary' });
      else if (!insideViewport(boundary)) requiredFailures.push({ selector: 'boundary', reason: 'outside-viewport', rect: rectData(boundary) });
    }
    if (routeRecord.primaryActionRequired) {
      const action = document.querySelector('.productPageHeader__actions a,.productPageHeader__actions button,form button[type="submit"]');
      if (!action) requiredFailures.push({ selector: 'primary-action', reason: 'missing-required-action' });
      else if (!insideViewport(action)) requiredFailures.push({ selector: 'primary-action', reason: 'outside-viewport', rect: rectData(action) });
    }

    const internalFailures = [];
    for (const selector of routeRecord.internalOverflowSelectors || []) {
      for (const element of document.querySelectorAll(selector)) {
        if (!visible(element)) continue;
        const region = element.closest('[data-horizontal-scroll-region="true"]');
        if (!validRegion(region)) {
          internalFailures.push({ selector, element: selectorName(element), region: region ? selectorName(region) : null, reason: 'invalid-or-missing-semantic-scroll-region' });
        }
      }
    }
    for (const region of document.querySelectorAll('[data-horizontal-scroll-region="true"]')) {
      if (!validRegion(region)) internalFailures.push({ selector: selectorName(region), reason: 'invalid-semantic-scroll-region' });
    }

    const maskingFailures = [];
    for (const element of [document.documentElement, document.body, document.querySelector('#root'), ...document.querySelectorAll('.productPageShell,.customerShell,.operatorShell,.adminShell')].filter(Boolean)) {
      const overflowX = getComputedStyle(element).overflowX;
      if (overflowX === 'hidden' || overflowX === 'clip') maskingFailures.push({ selector: selectorName(element), overflowX });
    }

    const offenders = [];
    for (const element of document.querySelectorAll('body *')) {
      if (!visible(element)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.right <= viewportWidth + 1 && rect.left >= -1) continue;
      const region = element.closest('[data-horizontal-scroll-region="true"]');
      if (region && validRegion(region)) continue;
      const style = getComputedStyle(element);
      if (style.position === 'fixed' || style.position === 'absolute') continue;
      offenders.push({
        selector: selectorName(element),
        tag: element.tagName.toLowerCase(),
        className: element.className && typeof element.className === 'string' ? element.className.slice(0, 180) : '',
        textPreview: clean(element.textContent).slice(0, 120),
        rect: rectData(element),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        closestOverflowRegion: region?.getAttribute('data-overflow-owner') || null,
      });
      if (offenders.length >= 20) break;
    }

    return {
      route: routeRecord.route,
      pathname: location.pathname,
      viewport: viewportKey,
      viewportWidth,
      viewportHeight,
      htmlLang: document.documentElement.lang,
      documentElementScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentContained: document.documentElement.scrollWidth <= viewportWidth + 1 && document.body.scrollWidth <= viewportWidth + 1,
      mainVisible: Boolean([...document.querySelectorAll('main,[data-landmark="page-owned-by-product-page-shell"]')].find(visible)),
      requiredFailures,
      internalFailures,
      maskingFailures,
      offenders,
    };
  }, { routeRecord: record, viewportKey: viewportName });
}

async function auditRoute(browser, states, record, locale, viewportName, viewport, index, total, category) {
  const loginRoute = record.concreteAuditPath === '/login';
  const context = await browser.newContext({ viewport, ...(loginRoute ? {} : { storageState: states[locale] }) });
  await context.addInitScript((value) => localStorage.setItem('geox.locale', value), locale);
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);
  const result = { category, route: record.route, path: record.concreteAuditPath, locale, viewport: viewportName, status: 'PASS', notes: [], snapshot: null };
  console.log(`[pfa-3] ${index}/${total} ${category} ${record.concreteAuditPath} ${locale} ${viewportName}`);
  try {
    const mePromise = loginRoute ? null : page.waitForResponse((response) => sameApi(response.url(), '/api/v1/auth/me'), { timeout: TIMEOUT });
    await page.goto(`${WEB}${record.concreteAuditPath}`, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });
    if (mePromise) {
      const me = await mePromise;
      if (!me.ok() || !me.request().headers().authorization) throw new Error('auth/me proof failed');
    }
    await waitForRoute(page, record.concreteAuditPath);
    const snapshot = await pageSnapshot(page, record, viewportName);
    result.snapshot = snapshot;
    if (snapshot.pathname !== record.concreteAuditPath) throw new Error(`pathname mismatch: ${snapshot.pathname}`);
    if (snapshot.htmlLang !== locale) throw new Error(`html lang mismatch: ${snapshot.htmlLang}`);
    if (!snapshot.mainVisible) throw new Error('main page not visible');
    if (!snapshot.documentContained) throw new Error(`document overflow: html=${snapshot.documentElementScrollWidth} body=${snapshot.bodyScrollWidth} viewport=${snapshot.viewportWidth}`);
    if (snapshot.requiredFailures.length) throw new Error(`required selector failures: ${JSON.stringify(snapshot.requiredFailures).slice(0, 600)}`);
    if (snapshot.internalFailures.length) throw new Error(`internal overflow failures: ${JSON.stringify(snapshot.internalFailures).slice(0, 600)}`);
    if (snapshot.maskingFailures.length) throw new Error(`root overflow masking: ${JSON.stringify(snapshot.maskingFailures)}`);
    if (snapshot.offenders.length) throw new Error(`unexpected overflow offenders: ${JSON.stringify(snapshot.offenders).slice(0, 1000)}`);
  } catch (error) {
    result.status = 'FAIL';
    result.notes.push(String(error?.message || error).slice(0, 1400));
  } finally {
    await context.close();
  }
  return result;
}

async function shellProbe(browser, states, surface, locale, probeName, viewport, expected, index, total) {
  const paths = { customer: '/customer/dashboard', operator: '/operator/twin', admin: '/admin/dashboard' };
  const context = await browser.newContext({ viewport, storageState: states[locale] });
  await context.addInitScript((value) => localStorage.setItem('geox.locale', value), locale);
  const page = await context.newPage();
  const result = { category: 'shell-probe', surface, locale, probe: probeName, expected, status: 'PASS', notes: [], details: null };
  console.log(`[pfa-3] ${index}/${total} shell ${surface} ${locale} ${probeName}`);
  try {
    await page.goto(`${WEB}${paths[surface]}`, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });
    await waitForRoute(page, paths[surface]);
    const trigger = page.locator('[data-mobile-navigation="true"] button[aria-controls]').first();
    const sidebar = page.locator('[data-desktop-sidebar="true"]').first();
    const details = {
      triggerVisible: await trigger.isVisible().catch(() => false),
      sidebarVisible: await sidebar.isVisible().catch(() => false),
      initialExpanded: await trigger.getAttribute('aria-expanded').catch(() => null),
      escapeClosed: null,
      focusReturned: null,
      routeClickClosed: null,
      activeStateRetained: null,
    };
    if (expected === 'desktop') {
      if (!details.sidebarVisible || details.triggerVisible) throw new Error(`desktop shell mismatch: ${JSON.stringify(details)}`);
    } else {
      if (details.sidebarVisible || !details.triggerVisible || details.initialExpanded !== 'false') throw new Error(`compact initial state mismatch: ${JSON.stringify(details)}`);
      await trigger.press('Enter');
      if ((await trigger.getAttribute('aria-expanded')) !== 'true') throw new Error('Enter did not open navigation');
      const panel = page.locator('[data-mobile-navigation-panel="true"]:visible').first();
      const links = panel.locator('a[href]');
      if (await links.count() < 1) throw new Error('compact navigation has no focusable links');
      await page.keyboard.press('Escape');
      details.escapeClosed = (await trigger.getAttribute('aria-expanded')) === 'false';
      details.focusReturned = await trigger.evaluate((element) => document.activeElement === element);
      if (!details.escapeClosed || !details.focusReturned) throw new Error(`Escape close failed: ${JSON.stringify(details)}`);
      await trigger.press('Enter');
      const currentPath = new URL(page.url()).pathname;
      const candidates = panel.locator('a[href]');
      let target = null;
      for (let i = 0; i < await candidates.count(); i += 1) {
        const href = await candidates.nth(i).getAttribute('href');
        if (href && href !== currentPath) { target = candidates.nth(i); break; }
      }
      if (!target) throw new Error('no alternate route link for route-change probe');
      await target.click();
      await page.waitForFunction((pathValue) => location.pathname !== pathValue, currentPath, { timeout: TIMEOUT });
      details.routeClickClosed = (await trigger.getAttribute('aria-expanded')) === 'false';
      details.activeStateRetained = await page.locator('[data-mobile-navigation-panel="true"] a.isActive,[data-mobile-navigation-panel="true"] a[aria-current="page"]').count() > 0;
      if (!details.routeClickClosed || !details.activeStateRetained) throw new Error(`route-change close/active failed: ${JSON.stringify(details)}`);
    }
    result.details = details;
  } catch (error) {
    result.status = 'FAIL';
    result.notes.push(String(error?.message || error).slice(0, 1200));
  } finally {
    await context.close();
  }
  return result;
}

function writeReport(target, payload) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
}

async function main() {
  ensureBrowser();
  await preflight();
  let web = null;
  let browser = null;
  try {
    web = await startWeb();
    if (!(await waitForHttp(WEB, 60000))) throw new Error(`web not reachable: ${WEB}`);
    const { chromium } = require('@playwright/test');
    browser = await chromium.launch({ headless: true });
    const states = {};
    for (const locale of MATRIX.supportedLocales) states[locale] = await loginState(browser, locale);

    const hardJobs = hardRecords.flatMap((record) => MATRIX.supportedLocales.flatMap((locale) => (
      Object.entries(MATRIX.formalViewports).map(([viewportName, viewport]) => ({ record, locale, viewportName, viewport, category: 'hard-route' }))
    )));
    const exportJobs = exportRecords.flatMap((record) => MATRIX.supportedLocales.map((locale) => ({
      record, locale, viewportName: 'desktopReview', viewport: MATRIX.formalViewports.desktopReview, category: 'export-smoke',
    })));
    const shellJobs = ['customer', 'operator', 'admin'].flatMap((surface) => MATRIX.supportedLocales.flatMap((locale) => (
      Object.entries(MATRIX.shellProbes).map(([probeName, probe]) => ({ surface, locale, probeName, viewport: { width: probe.width, height: probe.height }, expected: probe.expectation }))
    )));
    const total = hardJobs.length + exportJobs.length + shellJobs.length;
    const routeResults = [];
    let index = 0;
    for (const job of [...hardJobs, ...exportJobs]) {
      index += 1;
      routeResults.push(await auditRoute(browser, states, job.record, job.locale, job.viewportName, job.viewport, index, total, job.category));
    }
    const shellResults = [];
    for (const job of shellJobs) {
      index += 1;
      shellResults.push(await shellProbe(browser, states, job.surface, job.locale, job.probeName, job.viewport, job.expected, index, total));
    }

    const hardResults = routeResults.filter((item) => item.category === 'hard-route');
    const exportResults = routeResults.filter((item) => item.category === 'export-smoke');
    const payload = {
      ok: [...routeResults, ...shellResults].every((item) => item.status === 'PASS'),
      audit: 'AUDIT_PFA_3_RUNTIME_RESPONSIVE_SHELL_OVERFLOW',
      hardRoutes: hardRecords.length,
      exportRoutes: exportRecords.length,
      locales: MATRIX.supportedLocales.length,
      formalViewports: Object.keys(MATRIX.formalViewports).length,
      hardRouteRenders: hardResults.length,
      hardRouteHealthPass: hardResults.filter((item) => item.status === 'PASS').length,
      hardDocumentContainmentPass: hardResults.filter((item) => item.snapshot?.documentContained).length,
      hardHtmlLangPass: hardResults.filter((item) => item.snapshot?.htmlLang === item.locale).length,
      exportSmokeRenders: exportResults.length,
      exportSmokePass: exportResults.filter((item) => item.status === 'PASS').length,
      shellProbeRenders: shellResults.length,
      shellProbePass: shellResults.filter((item) => item.status === 'PASS').length,
      totalBrowserCases: routeResults.length + shellResults.length,
      rootOverflowMasking: routeResults.reduce((sum, item) => sum + (item.snapshot?.maskingFailures?.length || 0), 0),
      unexpectedOverflowOffenders: routeResults.reduce((sum, item) => sum + (item.snapshot?.offenders?.length || 0), 0),
      internalOverflowFailures: routeResults.reduce((sum, item) => sum + (item.snapshot?.internalFailures?.length || 0), 0),
      routeResults,
      shellResults,
    };
    writeReport(REPORT, payload);
    writeReport(EXTERNAL_REPORT, payload);
    console.log(JSON.stringify({
      ok: payload.ok,
      audit: payload.audit,
      hardRouteRenders: `${payload.hardRouteHealthPass}/${payload.hardRouteRenders}`,
      hardDocumentContainment: `${payload.hardDocumentContainmentPass}/${payload.hardRouteRenders}`,
      hardHtmlLang: `${payload.hardHtmlLangPass}/${payload.hardRouteRenders}`,
      exportSmoke: `${payload.exportSmokePass}/${payload.exportSmokeRenders}`,
      shellProbes: `${payload.shellProbePass}/${payload.shellProbeRenders}`,
      totalBrowserCases: payload.totalBrowserCases,
      rootOverflowMasking: payload.rootOverflowMasking,
      unexpectedOverflowOffenders: payload.unexpectedOverflowOffenders,
      internalOverflowFailures: payload.internalOverflowFailures,
      report: path.relative(ROOT, REPORT).replace(/\\/g, '/'),
      externalReport: EXTERNAL_REPORT,
    }, null, 2));
    if (!payload.ok) {
      console.log('[pfa-3] FAILED_ROUTE_CASES');
      console.log(JSON.stringify(routeResults.filter((item) => item.status !== 'PASS'), null, 2));
      console.log('[pfa-3] FAILED_SHELL_PROBES');
      console.log(JSON.stringify(shellResults.filter((item) => item.status !== 'PASS'), null, 2));
      process.exitCode = 1;
    }
  } finally {
    if (browser) await browser.close();
    stopWeb(web);
  }
}

main().catch((error) => {
  console.error('[pfa-3] fatal', error);
  process.exit(1);
});
