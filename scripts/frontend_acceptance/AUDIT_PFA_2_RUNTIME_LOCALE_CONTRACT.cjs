// scripts/frontend_acceptance/AUDIT_PFA_2_RUNTIME_LOCALE_CONTRACT.cjs
// Purpose: wire the public PFA-2 runtime audit to corrected browser-local support functions.

'use strict';

const support = require('./AUDIT_PFA_2_RUNTIME_LOCALE_SUPPORT.cjs');

support.snapshot = require('./AUDIT_PFA_2_RUNTIME_LOCALE_SNAPSHOT.cjs').snapshot;

support.loginState = async function loginState(browser, locale) {
  const token = String(process.env.FRONTEND_AUDIT_TOKEN || process.env.GEOX_ACCEPTANCE_TOKEN || '').trim();
  const sessionKeys = ['geox_ao_act_token', 'geox_tenant_context', 'geox_session_meta'];
  const context = await browser.newContext({ viewport: support.VIEWPORT });
  await context.addInitScript((value) => localStorage.setItem('geox.locale', value), locale);
  const page = await context.newPage();

  try {
    await page.goto(`${support.WEB}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
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

require('./AUDIT_PFA_2_RUNTIME_LOCALE_MAIN.cjs');
