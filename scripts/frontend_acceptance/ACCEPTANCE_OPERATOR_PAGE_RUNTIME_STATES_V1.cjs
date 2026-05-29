#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const PAGES = [
  'apps/web/src/views/operator/OperatorWorkbenchPage.tsx',
  'apps/web/src/views/operator/OperatorApprovalsPage.tsx',
  'apps/web/src/views/operator/OperatorDispatchPage.tsx',
  'apps/web/src/views/operator/OperatorAcceptancePage.tsx',
  'apps/web/src/views/operator/OperatorEvidencePage.tsx',
  'apps/web/src/views/operator/OperatorDevicesAlertsPage.tsx',
  'apps/web/src/views/operator/OperatorRoiLedgerPage.tsx',
  'apps/web/src/views/operator/OperatorFieldMemoryPage.tsx',
];
const COMPONENT = 'apps/web/src/components/operator/OperatorPageState.tsx';
const EMPTY = 'apps/web/src/components/operator/OperatorEmptyState.tsx';

function read(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`missing file: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

function fail(message) {
  failures.push(message);
}

const failures = [];
const component = read(COMPONENT);
const empty = read(EMPTY);

for (const required of ['OperatorPageRuntimeState', 'OperatorPageStateView', 'sanitizeOperatorError', 'isPermissionDeniedError', 'withOperatorLoadTimeout']) {
  if (!component.includes(required)) fail(`OperatorPageState must export/use ${required}`);
}
for (const label of ['正在加载运营数据...', '暂无待处理事项', '运营数据加载失败', '当前账号权限不足']) {
  if (!component.includes(label)) fail(`OperatorPageState must render label: ${label}`);
}
if (!component.includes('10_000')) fail('OperatorPageState must enforce 10 second timeout default');
if (/token\|secret\|credential\|private\s\*key/i.test(component)) fail('OperatorPageState must avoid literal sensitive-token regex that can leak into output');
if (!/role\?:\s*React\.AriaRole/.test(empty)) fail('OperatorEmptyState must support aria role for explicit runtime states');

for (const page of PAGES) {
  const text = read(page);
  const name = path.basename(page);
  if (!text.includes('OperatorPageStateView')) fail(`${name} must render OperatorPageStateView`);
  if (!text.includes('OperatorPageRuntimeState')) fail(`${name} must use explicit OperatorPageRuntimeState`);
  if (!text.includes('withOperatorLoadTimeout')) fail(`${name} must wrap main data load with 10s timeout`);
  if (!text.includes('sanitizeOperatorError')) fail(`${name} must sanitize error summaries`);
  if (!text.includes('isPermissionDeniedError')) fail(`${name} must detect permission denied state`);
  if (!text.includes('pageState === "loading"')) fail(`${name} must render explicit loading state`);
  if (!text.includes('pageState === "error"')) fail(`${name} must render explicit error state`);
  if (!text.includes('pageState === "permission-denied"')) fail(`${name} must render explicit permission denied state`);
  if (!text.includes('setPageState(nextVm.totalCount === 0 ? "empty" : "data-ready"') && !text.includes('setPageState(nextVm.totalDevices === 0 && nextVm.totalAlerts === 0 ? "empty" : "data-ready"') && !text.includes('setPageState("data-ready")') && !text.includes('setPageState(nextVm.permissionDenied ? "permission-denied" : (nextVm.totalCount === 0 ? "empty" : "data-ready"))')) {
    fail(`${name} must explicitly enter empty or data-ready after successful main load`);
  }
  if (/\.catch\(\(\) => \{\s*if \(!alive\) return;\s*setVm\(null\);\s*\}\)/.test(text)) fail(`${name} must not swallow API error into blank vm=null`);
  if (/\{loading \? <div className="operatorEmptyState">/.test(text)) fail(`${name} must not use legacy loading-only div`);
}

if (failures.length) {
  console.error('ACCEPTANCE_OPERATOR_PAGE_RUNTIME_STATES_V1 failed');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('ACCEPTANCE_OPERATOR_PAGE_RUNTIME_STATES_V1 passed');
