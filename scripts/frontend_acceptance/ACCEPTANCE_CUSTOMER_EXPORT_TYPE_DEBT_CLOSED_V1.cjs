#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const exportBlocksPath = path.join(root, 'apps/web/src/components/customer/CustomerExportBlocks.tsx');

function read(file) {
  assert.equal(fs.existsSync(file), true, `missing required file: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

function assertAll(text, required, label) {
  const missing = required.filter((entry) => !text.includes(entry));
  assert.deepEqual(missing, [], `${label} missing required entries: ${missing.join(', ')}`);
}

function assertNone(text, blocked, label) {
  const found = blocked.filter((entry) => text.includes(entry));
  assert.deepEqual(found, [], `${label} contains blocked entries: ${found.join(', ')}`);
}

(function main() {
  const exportBlocks = read(exportBlocksPath);

  assertNone(exportBlocks, [
    '@ts-nocheck',
    'as any',
    ': any',
    'deviceSummary',
  ], 'CustomerExportBlocks closed type-debt guard');

  assertAll(exportBlocks, [
    'CustomerDashboardPageVm',
    'OperationReportWithPdi',
    'reportField',
    'deviceHealth',
    '病虫害巡检观察证据',
    '图片/媒体证据',
    '采集位置',
    '采集设备',
    '现场备注',
    '巡检证据通过 ≠ 已执行喷药',
    '巡检证据通过 ≠ 防治闭环已结束',
    '不生成正式价值结论或客户可见田块记忆',
  ], 'CustomerExportBlocks customer export type debt closure contract');

  console.log('PASS acceptance customer export type debt closed v1', { exportBlocks: exportBlocksPath });
})();
