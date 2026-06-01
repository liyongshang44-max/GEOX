#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

const checkedFiles = [
  'apps/web/src/views/CustomerDashboardPage.tsx',
  'apps/web/src/views/FieldReportPage.tsx',
  'apps/web/src/views/OperationReportPage.tsx',
  'apps/web/src/components/customer/CustomerExportBlocks.tsx',
  'apps/web/src/components/customer/FormalScenarioCards.tsx',
  'apps/web/src/components/customer/FieldMemoryPanel.tsx',
  'apps/web/src/viewmodels/customerFieldMemoryVm.ts',
  'apps/web/src/components/cockpit/RecentOperationsSection.tsx',
  'apps/web/src/components/cockpit/CockpitKpiCard.tsx',
  'apps/web/src/components/cockpit/CockpitActionCard.tsx',
  'apps/web/src/components/cockpit/DeviceHealthCard.tsx',
  'apps/web/src/components/cockpit/ValueResultPanel.tsx',
];

const requiredProductLanguageUsages = [
  'apps/web/src/components/customer/FormalScenarioCards.tsx',
  'apps/web/src/components/cockpit/RecentOperationsSection.tsx',
  'apps/web/src/views/FieldReportPage.tsx',
  'apps/web/src/components/cockpit/CockpitKpiCard.tsx',
  'apps/web/src/components/cockpit/CockpitActionCard.tsx',
  'apps/web/src/components/cockpit/DeviceHealthCard.tsx',
  'apps/web/src/components/cockpit/ValueResultPanel.tsx',
];

const banned = [
  ['guarded payload', /guarded\s+payload/i],
  ['scenario_type=', /scenario_type\s*=/i],
  ['formal_chain_status=', /formal_chain_status\s*=/i],
  ['evidence_status=', /evidence_status\s*=/i],
  ['needs_review=', /needs_review\s*=/i],
  ['Skill run', /Skill\s+run/i],
  ['SKIPPED', /\bSKIPPED\b/],
  ['TECHNICAL_SKILL_MEMORY', /\bTECHNICAL_SKILL_MEMORY\b/],
  ['TECHNICAL_EXECUTION_MEMORY', /\bTECHNICAL_EXECUTION_MEMORY\b/],
  ['SIMULATED_DEV_MEMORY', /\bSIMULATED_DEV_MEMORY\b/],
  ['admin/internal preview', /admin\/internal\s+preview/i],
  ['global_devices_count', /global_devices_count/i],
  ['visible_devices_count', /visible_devices_count/i],
  ['field_devices_count', /field_devices_count/i],
  ['offline_devices_count', /offline_devices_count/i],
  ['alert_events_count', /alert_events_count/i],
  ['ROI trust lane', /ROI\s+trust\s+lane/i],
  ['Field Memory trust lane', /Field\s+Memory\s+trust\s+lane/i],
  ['closure chain', /closure\s+chain/i],
  ['Fail-safe', /Fail-safe/i],
];

let failed = false;

function read(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.error(`[customer-product-language] missing checked file: ${rel}`);
    failed = true;
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

for (const rel of checkedFiles) {
  const text = read(rel);
  for (const [label, pattern] of banned) {
    if (pattern.test(text)) {
      console.error(`[customer-product-language] customer-facing technical language leaked: ${label} in ${rel}`);
      failed = true;
    }
  }
}

for (const rel of requiredProductLanguageUsages) {
  const text = read(rel);
  if (!/customerProductText|customerReviewStateText|customerClosureStepLabel/.test(text)) {
    console.error(`[customer-product-language] missing product-language adapter usage in ${rel}`);
    failed = true;
  }
}

const dashboardVm = read('apps/web/src/viewmodels/customerDashboardVm.ts');
if (/设备中心暂未开放/.test(dashboardVm)) {
  console.error('[customer-product-language] forbidden dead customer action: 设备中心暂未开放');
  failed = true;
}
if (!/查看受影响地块/.test(dashboardVm) || !/离线设备需由运营人员复核最近心跳、遥测和绑定地块/.test(dashboardVm)) {
  console.error('[customer-product-language] customer offline device action must be actionable and explain operator follow-up');
  failed = true;
}
if (!/未完成复核前不展示执行成功或价值结论/.test(dashboardVm)) {
  console.error('[customer-product-language] customer offline device action must preserve no-fake-success/no-value boundary');
  failed = true;
}

const memoryPanel = read('apps/web/src/components/customer/FieldMemoryPanel.tsx');
const memoryVm = read('apps/web/src/viewmodels/customerFieldMemoryVm.ts');
if (!/暂无正式田块记忆/.test(memoryPanel + memoryVm) || !/正式验收通过后形成客户可见的田块学习结论/.test(memoryPanel + memoryVm)) {
  console.error('[customer-product-language] Field Memory must expose formal-memory-only empty copy');
  failed = true;
}
if (!/isCustomerVisibleFormalMemory/.test(memoryVm)) {
  console.error('[customer-product-language] Field Memory VM must filter customer-visible formal memory');
  failed = true;
}

const reportPath = path.join(ROOT, 'docs/audit/FRONTEND_RUNTIME_PAGE_AUDIT_REPORT.md');
if (fs.existsSync(reportPath)) {
  const report = fs.readFileSync(reportPath, 'utf8');
  for (const [label, pattern] of banned) {
    if (pattern.test(report)) {
      console.error(`[customer-product-language] runtime audit report leaked customer technical language: ${label}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error('[customer-product-language] FAIL');
  process.exit(1);
}

console.log('[customer-product-language] PASS');
