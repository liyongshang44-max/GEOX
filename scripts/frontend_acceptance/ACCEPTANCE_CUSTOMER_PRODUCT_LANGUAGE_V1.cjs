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
  ['field.geometry', /field\.geometry/i],
  ['geometry_id', /geometry_id/i],
  ['device scope', /设备\s*scope/i],
  ['device equals copy', /(?:离线设备|告警事件|可见授权设备|当前地块设备)\s*=/],
  ['ROI trust lane', /ROI\s+trust\s+lane/i],
  ['Field Memory trust lane', /Field\s+Memory\s+trust\s+lane/i],
  ['closure chain', /closure\s+chain/i],
  ['Fail-safe', /Fail-safe/i],
];

const dashboardVmVisibleBanned = [
  ['global_devices_count', /global_devices_count/i],
  ['visible_devices_count', /visible_devices_count/i],
  ['field_devices_count', /field_devices_count/i],
  ['offline_devices_count', /offline_devices_count/i],
  ['alert_events_count', /alert_events_count/i],
  ['field.geometry', /field\.geometry/i],
  ['geometry_id', /geometry_id/i],
  ['device scope', /设备\s*scope/i],
  ['device equals copy', /(?:离线设备|告警事件|可见授权设备|当前地块设备)\s*=/],
];

const customerRawLeakBanned = [
  ['PENDING_ACCEPTANCE', /\bPENDING_ACCEPTANCE(?:\b|_)/],
  ['soil_moisture_below_threshold', /soil_moisture_below_threshold/],
  ['no_rain_forecast', /no_rain_forecast/],
  ['BLOCKED', /\bBLOCKED\b/],
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

function reportSection(report, route) {
  const start = report.indexOf(`## ${route}`);
  if (start < 0) return '';
  const next = report.indexOf('\n## ', start + 1);
  return next < 0 ? report.slice(start) : report.slice(start, next);
}

function stringLiterals(text) {
  const out = [];
  const re = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match;
  while ((match = re.exec(text))) out.push(match[2]);
  return out;
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

const exportBlocks = read('apps/web/src/components/customer/CustomerExportBlocks.tsx');
for (const [label, pattern] of customerRawLeakBanned) {
  if (pattern.test(exportBlocks)) {
    console.error(`[customer-product-language] customer export raw enum/reason leaked in source: ${label}`);
    failed = true;
  }
}
for (const helper of ['customerReasonText', 'customerOperationStateText', 'customerNeedsReviewText', 'customerEvidenceStateText']) {
  if (!new RegExp(`\\b${helper}\\b`).test(exportBlocks)) {
    console.error(`[customer-product-language] customer export must use ${helper}`);
    failed = true;
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
for (const [label, pattern] of dashboardVmVisibleBanned) {
  const visibleLiterals = stringLiterals(dashboardVm).filter((literal) => !/^客户看板统一摘要中的/.test(literal));
  if (visibleLiterals.some((literal) => pattern.test(literal))) {
    console.error(`[customer-product-language] dashboard VM leaked customer visible technical language: ${label}`);
    failed = true;
  }
}
for (const required of [
  '当前可见授权设备共',
  '当前未发现告警事件',
  '当前页仅展示客户可见授权设备，不推断未授权设备或当前地块设备',
  '地块边界：已接入',
  '地块边界：暂未接入',
]) {
  if (!dashboardVm.includes(required)) {
    console.error(`[customer-product-language] dashboard VM missing required natural customer wording: ${required}`);
    failed = true;
  }
}
for (const [label, pattern] of [
  ['raw scenario type passthrough', /scenarioTypeText:\s*formalVm\.rawScenarioType/],
  ['raw formal chain status passthrough', /formalChainStatusText:\s*formalVm\.formalChainStatus/],
  ['raw evidence status passthrough', /evidenceStatusText:\s*formalVm\.rawEvidenceStatus/],
  ['raw boolean review passthrough', /needsReviewText:\s*formalVm\.needsReview\s*\?\s*["']true["']\s*:\s*["']false["']/],
]) {
  if (pattern.test(dashboardVm)) {
    console.error(`[customer-product-language] dashboard VM leaks customer raw status: ${label}`);
    failed = true;
  }
}
for (const helper of ['customerFormalChainText', 'customerEvidenceStateText', 'customerNeedsReviewText']) {
  if (!new RegExp(`\\b${helper}\\b`).test(dashboardVm)) {
    console.error(`[customer-product-language] dashboard VM must use ${helper}`);
    failed = true;
  }
}

const dashboardPage = read('apps/web/src/views/CustomerDashboardPage.tsx');
if (!/customerDashboardScopeText/.test(dashboardPage)) {
  console.error('[customer-product-language] dashboard scope explanation must be rendered in full-width dashboard area');
  failed = true;
}

const dashboardCss = read('apps/web/src/styles/customerDashboard.css');
if (!/max-width:\s*1500px[\s\S]*customerDashboardRightRail[\s\S]*grid-column:\s*1\s*\/\s*-1/.test(dashboardCss)) {
  console.error('[customer-product-language] dashboard CSS must expand right rail to full width below 1500px');
  failed = true;
}
if (!/customerDashboardKpiRow[\s\S]*repeat\(3,\s*minmax\(220px,\s*1fr\)\)/.test(dashboardCss)) {
  console.error('[customer-product-language] dashboard KPI row must cap to 3 columns around 1366px');
  failed = true;
}

const safeText = read('apps/web/src/lib/customerSafeText.ts');
for (const required of ['等待正式验收', '需正式验收后确认', '土壤水分偏低', '近期无降雨预报', '暂不形成正式结论', '需要人工复核', '暂不需要人工复核', '链路待校验', '链路已通过', '有限记录', '证据待补充', '证据已通过']) {
  if (!safeText.includes(required)) {
    console.error(`[customer-product-language] customerSafeText missing required customer wording: ${required}`);
    failed = true;
  }
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
  const customerReportText = `${reportSection(report, '/customer/dashboard')}\n${reportSection(report, '/customer/export')}`;
  for (const [label, pattern] of customerRawLeakBanned) {
    if (pattern.test(customerReportText)) {
      console.error(`[customer-product-language] runtime customer pages leaked raw enum/reason: ${label}`);
      failed = true;
    }
  }
  for (const [label, pattern] of dashboardVmVisibleBanned) {
    if (pattern.test(customerReportText)) {
      console.error(`[customer-product-language] runtime customer pages leaked dashboard technical language: ${label}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error('[customer-product-language] FAIL');
  process.exit(1);
}

console.log('[customer-product-language] PASS');
