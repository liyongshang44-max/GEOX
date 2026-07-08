// scripts/frontend_acceptance/AUDIT_PFA_2_RUNTIME_LOCALE_MAIN.cjs
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  ROOT,
  MATRIX,
  WEB,
  VIEWPORT,
  TIMEOUT,
  REPORT,
  clean,
  sameApi,
  waitForHttp,
  preflight,
  ensureBrowser,
  startWeb,
  stopWeb,
  loginState,
  verifyToggle,
  snapshot,
  capability,
} = require('./AUDIT_PFA_2_RUNTIME_LOCALE_SUPPORT.cjs');

const NAVIGATION_TIMEOUT = Number(process.env.PFA2_NAVIGATION_TIMEOUT_MS || '60000');
const EXTERNAL_REPORT = process.env.PFA2_RUNTIME_EVIDENCE_PATH
  ? path.resolve(process.env.PFA2_RUNTIME_EVIDENCE_PATH)
  : path.join(os.tmpdir(), 'PFA_2_RUNTIME_LOCALE_AUDIT_REPORT.json');

async function auditOne(browser, states, record, locale, index, total) {
  const loginRoute = record.concreteAuditPath === '/login';
  const context = await browser.newContext({
    viewport: VIEWPORT,
    ...(loginRoute ? {} : { storageState: states[locale] }),
  });
  await context.addInitScript((value) => localStorage.setItem('geox.locale', value), locale);
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);
  const result = {
    route: record.route,
    path: record.concreteAuditPath,
    locale,
    status: 'PASS',
    notes: [],
    snapshot: null,
  };
  console.log(`[pfa-2-locale] ${index}/${total} ${record.concreteAuditPath} ${locale}`);

  try {
    const mePromise = loginRoute
      ? null
      : page.waitForResponse((response) => sameApi(response.url(), '/api/v1/auth/me'), { timeout: TIMEOUT });

    await page.goto(`${WEB}${record.concreteAuditPath}`, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT,
    });

    if (mePromise) {
      const me = await mePromise;
      if (!me.ok() || !me.request().headers().authorization) throw new Error('auth/me proof failed');
    }

    await page.waitForFunction((expectedPath) => {
      const bodyText = document.body?.innerText || '';
      const bodyReady = bodyText.trim().length >= 10
        && !/正在验证会话|validating session/i.test(bodyText);
      return location.pathname === '/login'
        || (location.pathname === expectedPath && bodyReady);
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

function requiredCapabilityKeys(record) {
  if (record.surface === 'operator') {
    return ['readOnly', 'noExecution', 'noDispatch', 'liveDeviceOff', 'gatewayOff', 'pilotOff'];
  }
  if (record.surface === 'admin' && record.route === '/admin/devices') {
    return ['readOnly', 'liveDeviceOff', 'gatewayOff'];
  }
  if (record.surface === 'admin') return ['readOnly'];
  return [];
}

function auditPairs(records, results) {
  return records.map((record) => {
    const zh = results.find((item) => item.route === record.route && item.locale === 'zh-CN');
    const en = results.find((item) => item.route === record.route && item.locale === 'en-US');
    const renderPassed = Boolean(
      zh?.snapshot
      && en?.snapshot
      && zh.status === 'PASS'
      && en.status === 'PASS',
    );
    const pathnameEquivalent = Boolean(renderPassed && zh.snapshot.pathname === en.snapshot.pathname);
    const localeDifferentiated = Boolean(
      renderPassed && clean(zh.snapshot.governedText) !== clean(en.snapshot.governedText),
    );
    const zhCapabilities = renderPassed
      ? capability(`${zh.snapshot.governedText} ${zh.snapshot.bodyText}`)
      : {};
    const enCapabilities = renderPassed
      ? capability(`${en.snapshot.governedText} ${en.snapshot.bodyText}`)
      : {};
    const requiredCapabilities = requiredCapabilityKeys(record);
    const missingRequiredCapabilities = requiredCapabilities.filter(
      (key) => !zhCapabilities[key] || !enCapabilities[key],
    );
    const roleBoundaryEquivalent = Boolean(
      renderPassed
      && JSON.stringify(zhCapabilities) === JSON.stringify(enCapabilities)
      && missingRequiredCapabilities.length === 0,
    );
    const notes = [];

    if (!renderPassed) notes.push('route-locale render failed');
    else {
      if (!pathnameEquivalent) notes.push('pathname differs');
      if (!localeDifferentiated) notes.push('governed copy is identical');
      if (JSON.stringify(zhCapabilities) !== JSON.stringify(enCapabilities)) notes.push('role boundary differs');
      if (missingRequiredCapabilities.length) notes.push(`required role boundary missing: ${missingRequiredCapabilities.join(', ')}`);
    }

    return {
      route: record.route,
      status: notes.length ? 'FAIL' : 'PASS',
      renderPassed,
      pathnameEquivalent,
      localeDifferentiated,
      roleBoundaryEquivalent,
      requiredCapabilities,
      missingRequiredCapabilities,
      zhCapabilities,
      enCapabilities,
      notes,
    };
  });
}

function writeReport(target, payload) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(payload, null, 2) + '\n');
}

function printFailures(payload) {
  const failedRenders = payload.results
    .filter((item) => item.status !== 'PASS')
    .map((item) => ({
      route: item.route,
      path: item.path,
      locale: item.locale,
      notes: item.notes,
      pathname: item.snapshot?.pathname || null,
      htmlLang: item.snapshot?.htmlLang || null,
    }));
  const failedPairs = payload.pairs.filter((item) => item.status !== 'PASS');
  console.log('[pfa-2-locale] FAILED_ROUTE_RENDERS');
  console.log(JSON.stringify(failedRenders, null, 2));
  console.log('[pfa-2-locale] FAILED_LOCALE_PAIRS');
  console.log(JSON.stringify(failedPairs, null, 2));
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

    const jobs = MATRIX.records.flatMap((record) => (
      MATRIX.supportedLocales.map((locale) => ({ record, locale }))
    ));
    const results = [];
    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index];
      results.push(await auditOne(browser, states, job.record, job.locale, index + 1, jobs.length));
    }

    const pairs = auditPairs(MATRIX.records, results);
    const payload = {
      ok: results.every((item) => item.status === 'PASS')
        && pairs.every((item) => item.status === 'PASS'),
      audit: 'AUDIT_PFA_2_RUNTIME_LOCALE_CONTRACT',
      actualRoutes: MATRIX.records.length,
      locales: MATRIX.supportedLocales.length,
      routeRenders: results.length,
      routeHealthPass: results.filter((item) => item.status === 'PASS').length,
      htmlLangPass: results.filter((item) => item.snapshot?.htmlLang === item.locale).length,
      localePairPass: pairs.filter((item) => item.status === 'PASS').length,
      localePairDifferentiationPass: pairs.filter((item) => item.localeDifferentiated).length,
      roleBoundaryEquivalencePass: pairs.filter((item) => item.roleBoundaryEquivalent).length,
      pathnameEquivalencePass: pairs.filter((item) => item.pathnameEquivalent).length,
      runtimeTextGuardDependency: results.some((item) => item.snapshot?.guard) ? 1 : 0,
      results,
      pairs,
    };

    writeReport(REPORT, payload);
    writeReport(EXTERNAL_REPORT, payload);
    console.log(JSON.stringify({
      ok: payload.ok,
      audit: payload.audit,
      actualRoutes: payload.actualRoutes,
      locales: payload.locales,
      routeRenders: payload.routeRenders,
      routeHealth: `${payload.routeHealthPass}/${payload.routeRenders}`,
      htmlLang: `${payload.htmlLangPass}/${payload.routeRenders}`,
      localePairs: `${payload.localePairPass}/${payload.actualRoutes}`,
      localePairDifferentiation: `${payload.localePairDifferentiationPass}/${payload.actualRoutes}`,
      roleBoundaryEquivalence: `${payload.roleBoundaryEquivalencePass}/${payload.actualRoutes}`,
      pathnameEquivalence: `${payload.pathnameEquivalencePass}/${payload.actualRoutes}`,
      runtimeTextGuardDependency: payload.runtimeTextGuardDependency,
      report: path.relative(ROOT, REPORT).replace(/\\/g, '/'),
      externalReport: EXTERNAL_REPORT,
    }, null, 2));
    printFailures(payload);

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
