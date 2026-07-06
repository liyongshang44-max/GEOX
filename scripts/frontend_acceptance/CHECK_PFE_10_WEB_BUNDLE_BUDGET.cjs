// scripts/frontend_acceptance/CHECK_PFE_10_WEB_BUNDLE_BUDGET.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const root = process.cwd();
const budgetPath = path.join(root, 'docs/frontend-productization/PFE-10-BUNDLE-BUDGET.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    if (entry.isFile()) out.push(full);
  }
  return out;
}

function gzipSize(file) {
  return zlib.gzipSync(fs.readFileSync(file)).length;
}

function assetRecord(file) {
  const rawBytes = fs.statSync(file).size;
  return {
    path: rel(file),
    rawBytes,
    gzipBytes: gzipSize(file),
  };
}

function sum(records, key) {
  return records.reduce((total, record) => total + record[key], 0);
}

function largest(records, key) {
  if (!records.length) return { path: '', rawBytes: 0, gzipBytes: 0 };
  return records.slice().sort((a, b) => b[key] - a[key])[0];
}

function assertBudget(name, value, budget, failures) {
  if (value > budget) failures.push(`${name}=${value} exceeds budget=${budget}`);
}

function writeReport(config, metrics, topAssets, failures) {
  const reportPath = path.join(root, config.reportPath || 'docs/audit/PFE_10_BUNDLE_BUDGET_REPORT.md');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const lines = [];
  lines.push('# PFE-10 Bundle Budget Report', '', `Generated at: ${new Date().toISOString()}`, `Dist: ${config.buildOutputDir}`, `Mode: ${config.mode}`, '', '| metric | value | budget | status |', '| --- | ---: | ---: | --- |');
  for (const row of metrics.rows) lines.push(`| ${row.name} | ${row.value} | ${row.budget} | ${row.value <= row.budget ? 'PASS' : 'FAIL'} |`);
  lines.push('', '## Top assets', '', '| asset | raw bytes | gzip bytes |', '| --- | ---: | ---: |');
  for (const asset of topAssets) lines.push(`| \`${asset.path}\` | ${asset.rawBytes} | ${asset.gzipBytes} |`);
  lines.push('', '## Failures', '', failures.length ? failures.map((failure) => `- ${failure}`).join('\n') : '- none', '');
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
  return rel(reportPath);
}

function main() {
  if (!fs.existsSync(budgetPath)) throw new Error('PFE-10 bundle budget config not found');
  const config = readJson(budgetPath);
  const budgets = config.budgets || {};
  const distDir = path.join(root, config.buildOutputDir || 'apps/web/dist');
  if (!fs.existsSync(distDir)) throw new Error(`${config.buildOutputDir || 'apps/web/dist'} not found. Run pnpm run build:web first.`);

  const assets = walk(distDir).map(assetRecord);
  const jsAssets = assets.filter((asset) => asset.path.endsWith('.js'));
  const cssAssets = assets.filter((asset) => asset.path.endsWith('.css'));
  const largestJsRaw = largest(jsAssets, 'rawBytes');
  const largestJsGzip = largest(jsAssets, 'gzipBytes');
  const largestCssRaw = largest(cssAssets, 'rawBytes');
  const largestCssGzip = largest(cssAssets, 'gzipBytes');

  const values = {
    totalJsRawBytes: sum(jsAssets, 'rawBytes'),
    totalJsGzipBytes: sum(jsAssets, 'gzipBytes'),
    largestJsRawBytes: largestJsRaw.rawBytes,
    largestJsGzipBytes: largestJsGzip.gzipBytes,
    totalCssRawBytes: sum(cssAssets, 'rawBytes'),
    totalCssGzipBytes: sum(cssAssets, 'gzipBytes'),
    largestCssRawBytes: largestCssRaw.rawBytes,
    largestCssGzipBytes: largestCssGzip.gzipBytes,
    maxJsAssetCount: jsAssets.length,
    maxCssAssetCount: cssAssets.length,
    maxTotalAssetCount: assets.length,
  };

  const failures = [];
  for (const [name, value] of Object.entries(values)) assertBudget(name, value, budgets[name], failures);

  const rows = Object.keys(values).map((name) => ({ name, value: values[name], budget: budgets[name] }));
  const topAssets = assets.slice().sort((a, b) => b.rawBytes - a.rawBytes).slice(0, 10);
  const report = writeReport(config, { rows }, topAssets, failures);
  const result = {
    ok: failures.length === 0,
    check: 'CHECK_PFE_10_WEB_BUNDLE_BUDGET',
    dist: config.buildOutputDir,
    metrics: values,
    largestAssets: {
      jsRaw: largestJsRaw.path,
      jsGzip: largestJsGzip.path,
      cssRaw: largestCssRaw.path,
      cssGzip: largestCssGzip.path,
    },
    report,
    failures,
  };
  console.log(JSON.stringify(result, null, 2));
  if (failures.length) process.exit(1);
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ ok: false, check: 'CHECK_PFE_10_WEB_BUNDLE_BUDGET', error: error.message }, null, 2));
  process.exit(1);
}
