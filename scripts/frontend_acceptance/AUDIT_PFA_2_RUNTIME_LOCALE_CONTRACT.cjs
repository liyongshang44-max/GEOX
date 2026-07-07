// scripts/frontend_acceptance/AUDIT_PFA_2_RUNTIME_LOCALE_CONTRACT.cjs
// Purpose: wire the public PFA-2 runtime audit to corrected browser-local support functions.

'use strict';

const { spawnSync } = require('node:child_process');
const support = require('./AUDIT_PFA_2_RUNTIME_LOCALE_SUPPORT.cjs');

const NAVIGATION_TIMEOUT = Number(process.env.PFA2_NAVIGATION_TIMEOUT_MS || '60000');

support.snapshot = require('./AUDIT_PFA_2_RUNTIME_LOCALE_SNAPSHOT.cjs').snapshot;

support.stopWeb = function stopWeb(child) {
  if (!child) return;
  try {
    if (process.platform === 'win32' && child.pid) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      return;
    }
    child.kill('SIGTERM');
  } catch {}
};

support.loginState = async function loginState(browser, locale) {
  const token = String(process.env.FRONTEND_AUDIT_TOKEN || process.env.GEOX_ACCEPTANCE_TOKEN || '').trim();
  const sessionKeys = ['geox_ao_act_token', 'geox_tenant_context', 'geox_session_meta'];
  const context = await browser.newContext({ viewport: support.VIEWPORT });
  await context.addInitScript((value) => localStorage.setItem('geox.locale', value), locale);
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);

  try {
    await page.goto(`${support.WEB}/login`, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT,
    });
    const responsePromise = page.waitForResponse(
      (response) => support.sameApi(response.url(), '/api/v1/auth/login'),
      { timeout: support.TIMEOUT },
    );
    await page.locator('#token-input').fill(token);
    await page.locator('form button[type="submit"]').click();
    const response = await responsePromise;
    if (!response.ok()) throw new Error(`browser login failed locale=${locale} status=${response.status()}`);
    await page.waitForFunction(({ keys, expectedToken }) => (
      localStorage.getItem(keys[0]) === expectedToken
      && keys.slice(1).every((key) => Boolean(localStorage.getItem(key)))
    ), { keys: sessionKeys, expectedToken: token }, { timeout: support.TIMEOUT });
    await page.evaluate((value) => localStorage.setItem('geox.locale', value), locale);
    const state = await context.storageState();
    return state;
  } finally {
    await context.close();
  }
};

support.verifyToggle = async function verifyToggle(browser) {
  const context = await browser.newContext({ viewport: support.VIEWPORT });
  await context.addInitScript(() => {
    if (!localStorage.getItem('geox.locale')) localStorage.setItem('geox.locale', 'zh-CN');
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);

  try {
    await page.goto(`${support.WEB}/login?probe=1#locale`, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT,
    });
    const before = await page.evaluate(() => `${location.pathname}${location.search}${location.hash}`);
    await page.locator('[data-locale-option="en-US"]').click();
    await page.waitForFunction(
      () => document.documentElement.lang === 'en-US' && localStorage.getItem('geox.locale') === 'en-US',
      undefined,
      { timeout: support.TIMEOUT },
    );
    const after = await page.evaluate(() => `${location.pathname}${location.search}${location.hash}`);
    if (before !== after) throw new Error(`LocaleToggle changed route: ${before} -> ${after}`);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT });
    const persisted = await page.evaluate(() => `${document.documentElement.lang}/${localStorage.getItem('geox.locale')}`);
    if (persisted !== 'en-US/en-US') throw new Error(`locale persistence failed: ${persisted}`);
  } finally {
    await context.close();
  }
};

require('./AUDIT_PFA_2_RUNTIME_LOCALE_MAIN.cjs');
