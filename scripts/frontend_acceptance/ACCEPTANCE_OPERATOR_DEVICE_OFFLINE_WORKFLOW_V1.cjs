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

const workbenchApi = read('apps/web/src/api/operatorWorkbench.ts');
const devicesApi = read('apps/web/src/api/operatorDevicesAlerts.ts');
const devicesVm = read('apps/web/src/viewmodels/operatorDevicesAlertsVm.ts');
const devicesPage = read('apps/web/src/views/operator/OperatorDevicesAlertsPage.tsx');
const handlingPanel = read('apps/web/src/components/operator/DeviceOfflineHandlingPanel.tsx');

must(workbenchApi, /device_id: deviceId, field_id: fieldId, online_status: "OFFLINE"/, 'workbench located device URL');
must(workbenchApi, /source: "aggregate", field_id: fieldId/, 'workbench aggregate URL');
mustNot(workbenchApi, /field-device-/, 'no synthetic aggregate device id');
mustNot(workbenchApi, /DEVICE_OFFLINE[\s\S]{0,120}\/operator\/workbench/, 'offline todo must not fallback to workbench');

must(devicesApi, /source\?: "aggregate" \| string/, 'source query support');
must(devicesApi, /device_id: query\?\.deviceId/, 'device_id query passthrough');
must(devicesApi, /field_id: query\?\.fieldId/, 'field_id query passthrough');
must(devicesApi, /online_status: query\?\.onlineStatus/, 'online_status query passthrough');
must(devicesApi, /if \(!deviceId\) return \[\]/, 'aggregate fallback does not invent device detail');
must(devicesApi, /export async function ackDeviceOffline\(deviceId: string\)/, 'ackDeviceOffline export');
must(devicesApi, /export async function markDeviceOfflineFollowup\(deviceId: string\)/, 'markDeviceOfflineFollowup export');
must(devicesApi, /export async function createOfflineInspectionTaskCandidate\(deviceId: string\)/, 'createOfflineInspectionTaskCandidate export');
must(devicesApi, /postOfflineDeviceAction\(deviceId, "ack"\)/, 'ack maps to backend action');
must(devicesApi, /postOfflineDeviceAction\(deviceId, "followup"\)/, 'followup maps to backend action');
must(devicesApi, /postOfflineDeviceAction\(deviceId, "inspection-task-candidate"\)/, 'task candidate maps to backend action');
must(devicesApi, /\/api\/v1\/operator\/devices\/\$\{safeDeviceId\}\/offline\/\$\{action\}/, 'backend offline route family');

must(devicesVm, /OperatorDeviceOfflineFocusMode = "IDLE" \| "DEVICE_MATCHED" \| "AGGREGATE_ONLY" \| "MISSING_LOCATION" \| "DEVICE_NOT_FOUND"/, 'focus modes');
must(devicesVm, /matchedDevice \? "DEVICE_MATCHED"/, 'matched device mode');
must(devicesVm, /source === "aggregate" && !deviceId \? "AGGREGATE_ONLY"/, 'aggregate-only mode');
must(devicesVm, /!deviceId \? "MISSING_LOCATION"/, 'missing location mode');
must(devicesVm, /highlighted: isTargetDevice/, 'target highlight');

must(devicesPage, /DeviceOfflineHandlingPanel/, 'handling panel rendered');
must(devicesPage, /submitOfflineDeviceAction\(ackDeviceOffline\)/, 'confirm handler calls ackDeviceOffline');
must(devicesPage, /submitOfflineDeviceAction\(markDeviceOfflineFollowup\)/, 'manual review handler calls markDeviceOfflineFollowup');
must(devicesPage, /submitOfflineDeviceAction\(createOfflineInspectionTaskCandidate\)/, 'task candidate handler calls backend API');
must(devicesPage, /await reload\(\)/, 'successful action reloads data');
mustNot(devicesPage, /window\.setTimeout\(/, 'no local simulated success');
mustNot(devicesPage, /offline-\$\{deviceId\}|manual-review/, 'no local audit id');

must(handlingPanel, /正在提交处理结果\.\.\./, 'submitting state');
must(handlingPanel, /已记录设备离线确认，审计编号：/, 'success fallback state');
must(handlingPanel, /动作未开放。当前只能记录需人工核查，不能直接创建任务/, 'disabled fallback state');

if (process.exitCode) {
  console.error('[operator-device-offline-workflow] FAIL');
  process.exit(process.exitCode);
}
console.log('[operator-device-offline-workflow] PASS');
