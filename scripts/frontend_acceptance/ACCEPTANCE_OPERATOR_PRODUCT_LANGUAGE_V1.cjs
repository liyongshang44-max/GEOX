#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const mainVisualFiles = [
  'apps/web/src/views/operator/OperatorDevicesAlertsPage.tsx',
  'apps/web/src/viewmodels/operatorDevicesAlertsVm.ts',
  'apps/web/src/components/operator/OperatorEmptyState.tsx',
  'apps/web/src/components/operator/OperatorPageState.tsx',
];

const forbiddenMainVisual = [
  ['global_devices_count', /global_devices_count/i],
  ['visible_devices_count', /visible_devices_count/i],
  ['field_devices_count', /field_devices_count/i],
  ['offline_devices_count', /offline_devices_count/i],
  ['alert_events_count', /alert_events_count/i],
  ['operator devices-alerts 未接入', /operator\s+devices-alerts\s+未接入/i],
  ['customer dashboard aggregate', /customer\s+dashboard\s+aggregate/i],
  ['fallback 设备告警数据', /fallback\s+设备告警数据/i],
  ['reports_aggregate fallback', /reports_aggregate\s+fallback/i],
  ['approvals_api fallback', /approvals_api\s+fallback/i],
  ['alerts_api fallback', /alerts_api\s+fallback/i],
];

let failed = false;

function read(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[operator-product-language] missing file: ${rel}`);
    failed = true;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

function stringLiterals(text) {
  const out = [];
  const re = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match;
  while ((match = re.exec(text))) out.push(match[2]);
  return out;
}

for (const rel of mainVisualFiles) {
  const text = read(rel);
  for (const literal of stringLiterals(text)) {
    for (const [label, pattern] of forbiddenMainVisual) {
      if (pattern.test(literal)) {
        console.error(`[operator-product-language] main visual leaked ${label} in ${rel}: ${literal.slice(0, 160)}`);
        failed = true;
      }
    }
  }
}

const page = read('apps/web/src/views/operator/OperatorDevicesAlertsPage.tsx');
const vm = read('apps/web/src/viewmodels/operatorDevicesAlertsVm.ts');
for (const required of [
  '当前显示有限设备状态摘要',
  '设备明细接口尚未返回完整列表，当前以统一统计口径展示',
  '当前可见设备',
  '台，其中',
  '台离线',
]) {
  if (!(page.includes(required) || vm.includes(required))) {
    console.error(`[operator-product-language] missing required product language: ${required}`);
    failed = true;
  }
}

if (!page.includes('<details className="operatorTechDetails">') || !page.includes('<summary>技术详情</summary>')) {
  console.error('[operator-product-language] operator technical details must be folded under operatorTechDetails');
  failed = true;
}

if (/fallback\s+数据只读|有限\s+fallback|报告聚合\s+fallback|设备接口\s+fallback|告警接口\s+fallback/i.test(vm + page)) {
  console.error('[operator-product-language] fallback implementation language must not appear in operator visible copy');
  failed = true;
}

if (failed) {
  console.error('[operator-product-language] FAIL');
  process.exit(1);
}
console.log('[operator-product-language] PASS');
