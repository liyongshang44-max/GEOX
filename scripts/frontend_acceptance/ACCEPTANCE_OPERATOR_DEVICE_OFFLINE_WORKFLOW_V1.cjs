#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
function read(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) throw new Error(`missing file: ${rel}`);
  return fs.readFileSync(file, 'utf8');
}
function must(text, pattern, label) {
  if (!pattern.test(text)) {
    console.error(`[operator-device-offline-workflow] missing: ${label}`);
    process.exitCode = 1;
  }
}
function mustNot(text, pattern, label) {
  if (pattern.test(text)) {
    console.error(`[operator-device-offline-workflow] forbidden: ${label}`);
    process.exitCode = 1;
  }
}
function stringLiterals(text) {
  const out = [];
  const re = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match;
  while ((match = re.exec(text))) out.push(match[2]);
  return out;
}
function mustNotVisibleLiteral(text, pattern, label) {
  for (const literal of stringLiterals(text)) {
    if (pattern.test(literal)) {
      console.error(`[operator-device-offline-workflow] forbidden visible literal ${label}: ${literal.slice(0, 180)}`);
      process.exitCode = 1;
    }
  }
}

const workbenchApi = read('apps/web/src/api/operatorWorkbench.ts');
const devicesApi = read('apps/web/src/api/operatorDevicesAlerts.ts');
const devicesVm = read('apps/web/src/viewmodels/operatorDevicesAlertsVm.ts');
const devicesPage = read('apps/web/src/views/operator/OperatorDevicesAlertsPage.tsx');
const handlingPanel = read('apps/web/src/components/operator/DeviceOfflineHandlingPanel.tsx');
const statusLabels = read('apps/web/src/lib/operatorStatusLabels.ts');
const operatorProductGate = read('scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_PRODUCT_LANGUAGE_V1.cjs');

must(workbenchApi, /export function isPlaceholderId\(value: unknown\): boolean/, 'workbench exports placeholder id guard');
must(workbenchApi, /PLACEHOLDER_ID_VALUES = new Set\(\["\.\.\.", "…", "--", "undefined", "null", "待确认", "未定位到设备", "地块待确认"\]\)/, 'workbench placeholder values include required tokens');
must(workbenchApi, /function idText\(value: unknown\): string \{\s*return isPlaceholderId\(value\) \? ""/, 'workbench idText uses placeholder guard');
must(workbenchApi, /key\.endsWith\("_id"\) \? idText\(value\) : text\(value\)/, 'appendQuery filters *_id params');
must(workbenchApi, /if \(deviceId\) return appendQuery\(QUEUE_HREF\.DEVICE_OFFLINE, \{ device_id: deviceId, field_id: fieldId, online_status: "OFFLINE" \}\)/, 'workbench located device URL');
must(workbenchApi, /source: "aggregate", field_id: fieldId/, 'workbench aggregate URL includes source=aggregate');
must(workbenchApi, /const safeActionHref = queue === "DEVICE_OFFLINE" \? defaultActionHref\(queue, row\) : text\(row\.action_href, defaultActionHref\(queue, row\)\)/, 'device offline ignores unsafe external action_href');
mustNot(workbenchApi, /field-device-/, 'no synthetic aggregate device id');
mustNot(workbenchApi, /DEVICE_OFFLINE[\s\S]{0,120}\/operator\/workbench/, 'offline todo must not fallback to workbench');
mustNot(workbenchApi, /device_id:\s*text\(/, 'device_id must not use generic text filter');
mustNot(workbenchApi, /field_id:\s*text\(/, 'field_id must not use generic text filter');

must(devicesApi, /source\?: "aggregate" \| string/, 'source query support');
must(devicesApi, /function idText\(value: unknown\): string \{ return isPlaceholderId\(value\) \? ""/, 'devices api idText uses placeholder guard');
must(devicesApi, /device_id: idText\(query\?\.deviceId\)/, 'device_id query guarded');
must(devicesApi, /field_id: idText\(query\?\.fieldId\)/, 'field_id query guarded');
must(devicesApi, /online_status: text\(query\?\.onlineStatus\)/, 'online_status query passthrough');
must(devicesApi, /if \(!deviceId\) return \[\]/, 'aggregate fallback does not invent device detail');
must(devicesApi, /export async function ackDeviceOffline\(deviceId: string\)/, 'ackDeviceOffline export');
must(devicesApi, /export async function markDeviceOfflineFollowup\(deviceId: string\)/, 'markDeviceOfflineFollowup export');
must(devicesApi, /export async function createOfflineInspectionTaskCandidate\(deviceId: string\)/, 'createOfflineInspectionTaskCandidate export');
must(devicesApi, /postOfflineDeviceAction\(deviceId, "ack"\)/, 'ack maps to backend action');
must(devicesApi, /postOfflineDeviceAction\(deviceId, "followup"\)/, 'followup maps to backend action');
must(devicesApi, /postOfflineDeviceAction\(deviceId, "inspection-task-candidate"\)/, 'task candidate maps to backend action');
must(devicesApi, /\/api\/v1\/operator\/devices\/\$\{safeDeviceId\}\/offline\/\$\{action\}/, 'backend offline route family');

must(statusLabels, /export function labelOperatorOfflineHandlingStatus\(value: unknown/, 'offline handling status label helper');
for (const phrase of ['待处理', '已确认离线', '需人工核查', '已生成维护任务候选', '已关闭', '只读']) {
  if (!statusLabels.includes(phrase)) {
    console.error(`[operator-device-offline-workflow] missing handling phrase: ${phrase}`);
    process.exitCode = 1;
  }
}

must(devicesVm, /OperatorDeviceOfflineFocusMode = "IDLE" \| "DEVICE_MATCHED" \| "AGGREGATE_ONLY" \| "MISSING_LOCATION" \| "DEVICE_NOT_FOUND"/, 'focus modes');
must(devicesVm, /matchedDevice \? "DEVICE_MATCHED"/, 'matched device mode');
must(devicesVm, /source === "aggregate" && !deviceId \? "AGGREGATE_ONLY"/, 'aggregate-only mode');
must(devicesVm, /!deviceId \? "MISSING_LOCATION"/, 'missing location mode');
must(devicesVm, /highlighted: isTargetDevice/, 'target highlight');
must(devicesVm, /labelOperatorOfflineHandlingStatus\("OPEN"\)/, 'vm maps OPEN handling status');
must(devicesVm, /labelOperatorOfflineHandlingStatus\("READ_ONLY"\)/, 'vm maps READ_ONLY handling status');
must(devicesVm, /labelOperatorOfflineHandlingStatus\("FOLLOWUP_REQUIRED"\)/, 'vm maps FOLLOWUP_REQUIRED handling status internally');
mustNot(devicesVm, /return "OPEN"|return "READ_ONLY"|return "FOLLOWUP_REQUIRED"|return "TASK_CANDIDATE_CREATED"/, 'vm must not return raw handling status');
mustNotVisibleLiteral(devicesVm + devicesPage + handlingPanel, /device_id\s*=/i, 'device_id=');
mustNotVisibleLiteral(devicesVm + devicesPage + handlingPanel, /field_id\s*=/i, 'field_id=');
mustNotVisibleLiteral(devicesVm + devicesPage + handlingPanel, /FOLLOWUP_REQUIRED/, 'FOLLOWUP_REQUIRED');

must(devicesVm + devicesPage + handlingPanel + workbenchApi, /source[=:]"aggregate"|source: "aggregate"|source=aggregate/, 'source=aggregate aggregate provenance');
must(devicesVm + devicesPage + handlingPanel, /缺少设备定位信息/, 'missing device location text');
must(devicesVm + devicesPage + handlingPanel + statusLabels, /需人工核查/, 'manual review text');
must(devicesVm + devicesPage + handlingPanel + statusLabels, /已确认离线/, 'confirmed offline text');

must(devicesPage, /DeviceOfflineHandlingPanel/, 'handling panel rendered');
must(devicesPage, /labelOperatorOfflineHandlingStatus\(result\.status\)/, 'offline action success status uses handling labels');
must(devicesPage, /submitOfflineDeviceAction\(ackDeviceOffline\)/, 'confirm handler calls ackDeviceOffline');
must(devicesPage, /submitOfflineDeviceAction\(markDeviceOfflineFollowup\)/, 'manual review handler calls markDeviceOfflineFollowup');
must(devicesPage, /submitOfflineDeviceAction\(createOfflineInspectionTaskCandidate\)/, 'task candidate handler calls backend API');
must(devicesPage, /await reload\(\)/, 'successful action reloads data');
mustNot(devicesPage, /window\.setTimeout\(/, 'no local simulated success');
mustNot(devicesPage, /offline-\$\{deviceId\}|manual-review/, 'no local audit id');

must(handlingPanel, /labelOperatorOfflineHandlingStatus/, 'handling panel applies status label helper');
must(handlingPanel, /正在提交处理结果\.\.\./, 'submitting state');
must(handlingPanel, /已记录设备离线确认，审计编号：/, 'success fallback state');
must(handlingPanel, /动作未开放。当前只能记录需人工核查，不能直接创建任务/, 'disabled fallback state');
for (const required of ['device_id=...', 'field_id=...', '处理状态 FOLLOWUP_REQUIRED', 'source=aggregate', '缺少设备定位信息', '需人工核查', '已确认离线']) {
  if (!operatorProductGate.includes(required)) {
    console.error(`[operator-device-offline-workflow] operator product language gate must document/check: ${required}`);
    process.exitCode = 1;
  }
}

if (process.exitCode) {
  console.error('[operator-device-offline-workflow] FAIL');
  process.exit(process.exitCode);
}
console.log('[operator-device-offline-workflow] PASS');
