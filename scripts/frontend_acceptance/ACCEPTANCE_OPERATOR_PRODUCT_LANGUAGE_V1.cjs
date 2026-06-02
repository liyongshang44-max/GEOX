#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const mainVisualFiles = [
  'apps/web/src/views/operator/OperatorWorkbenchPage.tsx',
  'apps/web/src/views/operator/OperatorDevicesAlertsPage.tsx',
  'apps/web/src/viewmodels/operatorDevicesAlertsVm.ts',
  'apps/web/src/components/operator/DeviceOfflineHandlingPanel.tsx',
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
  ['device_id=...', /device_id\s*=\s*\.\.\./i],
  ['field_id=...', /field_id\s*=\s*\.\.\./i],
  ['处理状态 FOLLOWUP_REQUIRED', /处理状态\s*FOLLOWUP_REQUIRED/],
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
const workbench = read('apps/web/src/views/operator/OperatorWorkbenchPage.tsx');
const vm = read('apps/web/src/viewmodels/operatorDevicesAlertsVm.ts');
const panel = read('apps/web/src/components/operator/DeviceOfflineHandlingPanel.tsx');
const labels = read('apps/web/src/lib/operatorStatusLabels.ts');
const operatorLayout = read('apps/web/src/layouts/OperatorLayout.tsx');
const operatorUsabilityCss = read('apps/web/src/styles/operatorUsability.css');
for (const required of [
  '当前显示有限设备状态摘要',
  '设备明细接口尚未返回完整列表，当前以统一统计口径展示',
  '当前可见设备',
  '台，其中',
  '台离线',
  '待处理',
  '已确认离线',
  '需人工核查',
  '已生成维护任务候选',
  '已关闭',
  '只读',
  '缺少设备定位信息',
]) {
  if (!(page.includes(required) || vm.includes(required) || panel.includes(required) || labels.includes(required))) {
    console.error(`[operator-product-language] missing required product language: ${required}`);
    failed = true;
  }
}

for (const required of [
  '处理原则',
  '先处理设备离线和执行异常，因为它们会影响证据可信度',
  '再处理待审批、待验收和证据不足',
  '所有处理动作只写审计记录，不自动生成正式验收或客户价值结论',
  '处理后果：进入该队列只建立审计和复核链路',
]) {
  if (!workbench.includes(required)) {
    console.error(`[operator-product-language] operator workbench missing handling principle: ${required}`);
    failed = true;
  }
}

for (const required of [
  '当前处理阶段：排查入口',
  '本页用于记录设备离线事实和后续处理建议',
  '它不会直接恢复设备，也不会自动生成正式作业成功、客户 ROI 或 Field Memory',
  '记录设备确认为离线，用于审计',
  '记录需要人工现场排查，不直接派单',
  '创建候选记录，等待人工确认后才可能转成正式任务',
]) {
  if (!panel.includes(required)) {
    console.error(`[operator-product-language] device offline handling panel missing action consequence: ${required}`);
    failed = true;
  }
}

if (!operatorLayout.includes('operatorUsability.css')) {
  console.error('[operator-product-language] operator usability stylesheet must be loaded by OperatorLayout');
  failed = true;
}
for (const required of ['operatorPrinciplesCard', 'operatorDevicesStageCard', 'operatorDeviceActionHelp', 'operatorQueuePrinciple']) {
  if (!operatorUsabilityCss.includes(required)) {
    console.error(`[operator-product-language] operator usability CSS missing class: ${required}`);
    failed = true;
  }
}

if (!/source: "aggregate"/.test(read('apps/web/src/api/operatorWorkbench.ts'))) {
  console.error('[operator-product-language] device offline aggregate workflow must preserve source=aggregate');
  failed = true;
}
if (!/labelOperatorOfflineHandlingStatus\("OPEN"\)/.test(vm) || !/labelOperatorOfflineHandlingStatus\(result\.status\)/.test(page) || !/labelOperatorOfflineHandlingStatus/.test(panel)) {
  console.error('[operator-product-language] offline handling status must use operator label helper across VM/page/panel');
  failed = true;
}
if (/return\s+["'](?:OPEN|READ_ONLY|FOLLOWUP_REQUIRED|TASK_CANDIDATE_CREATED|ACKED)["']/.test(vm)) {
  console.error('[operator-product-language] VM must not return raw device offline handling status');
  failed = true;
}
if (/handlingStatusText:\s*["'](?:OPEN|READ_ONLY|FOLLOWUP_REQUIRED|TASK_CANDIDATE_CREATED|ACKED)["']/.test(vm + panel + page)) {
  console.error('[operator-product-language] raw handling status must not be assigned to visible handlingStatusText');
  failed = true;
}
if (/状态：\$\{replaceOperatorTerms\(result\.status\)\}/.test(page)) {
  console.error('[operator-product-language] offline action success must not render result.status through generic replaceOperatorTerms');
  failed = true;
}
if (/<strong>\s*(?:FOLLOWUP_REQUIRED|TASK_CANDIDATE_CREATED|READ_ONLY|ACKED|OPEN)\s*<\/strong>/.test(panel + page)) {
  console.error('[operator-product-language] raw handling status must not be hardcoded in visible markup');
  failed = true;
}

if (!page.includes('<details className="operatorTechDetails">') || !page.includes('<summary>技术详情</summary>')) {
  console.error('[operator-product-language] operator technical details must be folded under operatorTechDetails');
  failed = true;
}

if (/fallback\s+数据只读|有限\s+fallback|报告聚合\s+fallback|设备接口\s+fallback|告警接口\s+fallback/i.test(vm + page)) {
  console.error('[operator-product-language] fallback implementation language must not appear in operator visible copy');
  failed = true;
}

for (const required of ['device_id=...', 'field_id=...', '处理状态 FOLLOWUP_REQUIRED', 'source=aggregate', '缺少设备定位信息', '需人工核查', '已确认离线']) {
  if (!__filename || !required) {
    console.error(`[operator-product-language] invalid required offline workflow marker: ${required}`);
    failed = true;
  }
}

if (failed) {
  console.error('[operator-product-language] FAIL');
  process.exit(1);
}
console.log('[operator-product-language] PASS');
