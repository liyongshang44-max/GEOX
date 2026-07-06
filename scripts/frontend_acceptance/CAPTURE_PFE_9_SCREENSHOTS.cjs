// scripts/frontend_acceptance/CAPTURE_PFE_9_SCREENSHOTS.cjs
'use strict';

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'docs/frontend-productization/PFE-9-SCREENSHOT-MANIFEST.json');
const OUTPUT_DIR = path.join(ROOT, 'docs/audit/pfe-9-screenshots');
const REPORT_PATH = path.join(ROOT, 'docs/audit/PFE_9_VISUAL_REVIEW_REPORT.md');
const WEB_BASE_URL = String(process.env.FRONTEND_AUDIT_WEB_BASE_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '');
const API_BASE_URL = String(process.env.API_BASE_URL || process.env.GEOX_WEB_PROXY_TARGET || 'http://127.0.0.1:3001').replace(/\/+$/, '');
const CAPTURE_MODE = String(process.env.PFE9_CAPTURE_MODE || 'baseline').toLowerCase();
const SESSION_VALUE = String(process.env.FRONTEND_AUDIT_TOKEN || process.env.GEOX_ACCEPTANCE_TOKEN || 'tenant_a_admin_token');
const SESSION_KEY = ['geox', 'ao', 'act', 'token'].join('_');
const CONTEXT_KEY = ['geox', 'tenant', 'context'].join('_');
const META_KEY = ['geox', 'session', 'meta'].join('_');

function readManifest() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  if (!manifest || !manifest.viewports || !Array.isArray(manifest.routes)) throw new Error('Invalid PFE-9 screenshot manifest');
  return manifest;
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function routeSlug(route) { return route.replace(/^\//, '').replace(/[^a-z0-9_-]+/gi, '_') || 'root'; }
function rel(file) { return path.relative(ROOT, file).replace(/\\/g, '/'); }

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

function ensureBrowser() {
  if (process.env.FRONTEND_AUDIT_SKIP_BROWSER_INSTALL === '1') return;
  const ret = spawnSync('pnpm', ['exec', 'playwright', 'install', 'chromium'], { cwd: ROOT, stdio: 'inherit', env: process.env, timeout: 240000 });
  if (ret.error) throw ret.error;
  if (ret.status !== 0) throw new Error(`browser install failed with exit=${ret.status}`);
}

function startWeb() {
  if (process.env.FRONTEND_AUDIT_SKIP_WEB_SERVER === '1') return null;
  const child = spawn('pnpm', ['--filter', '@geox/web', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
    cwd: ROOT,
    env: { ...process.env, GEOX_WEB_PROXY_TARGET: API_BASE_URL, VITE_API_BASE_URL: '', VITE_API_BASE: '', BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write('[pfe-9-capture:web] ' + String(chunk)));
  child.stderr.on('data', (chunk) => process.stderr.write('[pfe-9-capture:web] ' + String(chunk)));
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

async function applySession(context) {
  await context.addInitScript(({ keys, value }) => {
    const tenantContext = { tenant_id: 'tenantA', project_id: 'projectA', group_id: 'groupA' };
    const sessionMeta = { role: 'admin', actor_id: 'pfe-9-visual-capture', token_id: 'pfe-9-visual-capture', scopes: ['operator.read', 'customer.read'] };
    window.localStorage.setItem(keys.session, value);
    window.sessionStorage.setItem(keys.session, value);
    window.localStorage.setItem(keys.context, JSON.stringify(tenantContext));
    window.sessionStorage.setItem(keys.context, JSON.stringify(tenantContext));
    window.localStorage.setItem(keys.meta, JSON.stringify(sessionMeta));
    window.sessionStorage.setItem(keys.meta, JSON.stringify(sessionMeta));
  }, { keys: { session: SESSION_KEY, context: CONTEXT_KEY, meta: META_KEY }, value: SESSION_VALUE });
}

function selectedRoutes(manifest) {
  return CAPTURE_MODE === 'full' ? manifest.routes : manifest.routes.filter((route) => route.baseline === true);
}

function selectedViewports(manifest, route) {
  return CAPTURE_MODE === 'full' ? route.viewports : manifest.baselineViewportSet;
}

async function captureOne(browser, manifest, route, viewportName) {
  const viewport = manifest.viewports[viewportName];
  if (!viewport) throw new Error(`Unknown viewport: ${viewportName}`);
  const context = await browser.newContext({ viewport });
  await applySession(context);
  const page = await context.newPage();
  const result = { route: route.route, surface: route.surface, viewport: viewportName, status: 'PASS', screenshot: '', notes: [] };
  try {
    await page.goto(`${WEB_BASE_URL}${route.capturePath}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    const dir = path.join(OUTPUT_DIR, route.surface, viewportName);
    fs.mkdirSync(dir, { recursive: true });
    const screenshot = path.join(dir, `${routeSlug(route.route)}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    result.screenshot = rel(screenshot);
  } catch (error) {
    result.status = 'FAIL';
    result.notes.push(String(error && (error.message || error)).slice(0, 200));
  } finally {
    await context.close().catch(() => undefined);
  }
  return result;
}

function writeReport(manifest, results) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const lines = ['# PFE-9 Visual Review Report', '', `Generated at: ${new Date().toISOString()}`, `Mode: ${CAPTURE_MODE}`, `Manifest version: ${manifest.version}`, '', '| route | surface | viewport | status | screenshot | notes |', '| --- | --- | --- | --- | --- | --- |'];
  for (const result of results) lines.push(`| \`${result.route}\` | ${result.surface} | ${result.viewport} | ${result.status} | \`${result.screenshot || 'n/a'}\` | ${result.notes.join('; ') || 'review'} |`);
  fs.writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`);
}

async function main() {
  const manifest = readManifest();
  let web = null;
  let browser = null;
  const results = [];
  try {
    ensureBrowser();
    web = startWeb();
    if (!(await waitForHttp(WEB_BASE_URL, 60000))) throw new Error(`web not reachable: ${WEB_BASE_URL}`);
    const { chromium } = require('@playwright/test');
    browser = await chromium.launch({ headless: true });
    for (const route of selectedRoutes(manifest)) for (const viewportName of selectedViewports(manifest, route)) results.push(await captureOne(browser, manifest, route, viewportName));
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    if (results.length) writeReport(manifest, results);
    if (web) stopWeb(web);
  }
  if (results.some((result) => result.status !== 'PASS')) process.exit(1);
  console.log(JSON.stringify({ ok: true, capture: 'PFE_9_SCREENSHOTS', mode: CAPTURE_MODE, screenshots: results.length, report: rel(REPORT_PATH) }, null, 2));
}

main().catch((error) => {
  console.error('[pfe-9-capture] FAIL');
  console.error(error);
  process.exit(1);
});
