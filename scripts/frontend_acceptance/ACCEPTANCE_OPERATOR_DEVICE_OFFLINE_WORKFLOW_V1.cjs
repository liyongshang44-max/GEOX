#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const files = {
  workbenchApi: 'apps/web/src/api/operatorWorkbench.ts',
  workbenchVm: 'apps/web/src/viewmodels/operatorWorkbenchVm.ts',
  devicesApi: 'apps/web/src/api/operatorDevicesAlerts.ts',
  devicesVm: 'apps/web/src/viewmodels/operatorDevicesAlertsVm.ts',
  devicesPage: 'apps/web/src/views/operator/OperatorDevicesAlertsPage.tsx',
  handlingPanel: 'apps/web/src/components/operator/DeviceOfflineHandlingPanel.tsx',
};

function read(rel) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) throw new Error(`missing file: ${rel}`);
  return fs.readFileSync(file, 'utf8');
}

function assertContains(text, pattern, label) {
  if (!pattern.test(text)) {
    console.error(`[operator-device-offline-workflow] missing: ${label}`);
    process.exitCode = 1;
  }
}

function assertNotContains(text, pattern, label) {
  if (pattern.test(text)) {
    console.error(`[operator-device-offline-workflow] forbidden: ${label}`);
    process.exitCode = 1;
  }
}

const workbenchApi = read(files.workbenchApi);
const workbenchVm = read(files.workbenchVm);
const devicesApi = read(files.devicesApi);
const devicesVm = read(files.devicesVm);
const devicesPage = read(files.devicesPage);
const handlingPanel = read(files.handlingPanel);
const joined = [workbenchApi, workbenchVm, devicesApi, devicesVm, devicesPage, handlingPanel].join('\n');

assertContains(workbenchApi, /deviceId\?: string \| null/, 'OperatorWorkbenchItem carries deviceId');
assertContains(workbenchApi, /fieldId\?: string \| null/, 'OperatorWorkbenchItem carries fieldId');
assertContains(workbenchApi, /alertId\?: string \| null/, 'OperatorWorkbenchItem carries alertId');
assertContains(workbenchApi, /sourceId\?: string \| null/, 'OperatorWorkbenchItem carries sourceId');
assertContains(workbenchApi, /queueId\?: string \| null/, 'OperatorWorkbenchItem carries queueId');
assertContains(workbenchApi, /handlingStatus\?: OperatorWorkbenchHandlingStatus/, 'OperatorWorkbenchItem carries handlingStatus');
assertContains(workbenchApi, /"OPEN" \| "ACKED" \| "FOLLOWUP_REQUIRED" \| "TASK_CANDIDATE_CREATED" \| "CLOSED" \| "READ_ONLY"/, 'handling status enum is explicit');
assertContains(workbenchApi, /device_id: deviceId, field_id: fieldId, online_status: "OFFLINE"/, 'device_id URL carries device_id, field_id, online_status');
assertContains(workbenchApi, /source: "aggregate", field_id: fieldId/, 'aggregate URL carries source=aggregate and field_id');
assertNotContains(workbenchApi, /field-device-/, 'workbench must not synthesize fake device ids for aggregate offline todos');
assertNotContains(workbenchApi, /DEVICE_OFFLINE[\s\S]{0,120}\/operator\/workbench/, 'DEVICE_OFFLINE must not fallback to workbench');

assertContains(workbenchVm, /handlingStatusText/, 'workbench VM exposes handling status text');
assertContains(workbenchVm, /deviceId: item\.deviceId/, 'workbench VM passes deviceId');
assertContains(workbenchVm, /fieldId: item\.fieldId/, 'workbench VM passes fieldId');
assertContains(workbenchVm, /queueId: item\.queueId/, 'workbench VM passes queueId');

assertContains(devicesApi, /source\?: "aggregate" \| string/, 'devices alerts query supports source=aggregate');
assertContains(devicesApi, /source: query\?\.source/, 'official API receives source query');
assertContains(devicesApi, /fetchOperatorDevicesAlerts\(query\?/, 'fetchOperatorDevicesAlerts accepts query');
assertContains(devicesApi, /device_id: query\?\.deviceId/, 'official API receives device_id query');
assertContains(devicesApi, /field_id: query\?\.fieldId/, 'official API receives field_id query');
assertContains(devicesApi, /online_status: query\?\.onlineStatus/, 'official API receives online_status query');
assertContains(devicesApi, /if \(!deviceId\) return \[\]/, 'aggregate fallback does not invent device detail without device_id');

assertContains(devicesVm, /OperatorDeviceOfflineFocusMode = "IDLE" \| "DEVICE_MATCHED" \| "AGGREGATE_ONLY" \| "MISSING_LOCATION" \| "DEVICE_NOT_FOUND"/, 'offline focus modes exist');
assertContains(devicesVm, /matchedDevice \? "DEVICE_MATCHED"/, 'device_id match selects DEVICE_MATCHED');
assertContains(devicesVm, /source === "aggregate" && !deviceId \? "AGGREGATE_ONLY"/, 'source=aggregate selects aggregate-only state');
assertContains(devicesVm, /!deviceId \? "MISSING_LOCATION"/, 'missing device_id selects missing-location state');
assertContains(devicesVm, /"正在处理：设备离线"/, 'matched device title is exact');
assertContains(devicesVm, /"该待办来自聚合统计，当前没有设备明细。"/, 'aggregate-only copy is exact');
assertContains(devicesVm, /"缺少设备定位信息"/, 'missing-location copy is exact');
assertContains(devicesVm, /highlighted: isTargetDevice/, 'target device highlight exists');

assertContains(devicesPage, /useSearchParams/, 'devices-alerts page reads URL query');
assertContains(devicesPage, /source: params\.get\("source"\)/, 'query parser reads source');
assertContains(devicesPage, /fetchOperatorDevicesAlerts\(query\)/, 'page fetches devices-alerts with query');
assertContains(devicesPage, /buildOperatorDevicesAlertsVm\(response, query\)/, 'page builds VM with query');
assertContains(devicesPage, /DeviceOfflineHandlingPanel/, 'new DeviceOfflineHandlingPanel is rendered');
assertContains(devicesPage, /operatorDeviceCardFocused/, 'target device can be highlighted');
assertContains(devicesPage, /confirmOfflineHandling/, 'page wires offline confirmation handler');
assertContains(devicesPage, /markManualReview/, 'page wires manual review handler');
assertContains(devicesPage, /createTaskCandidate/, 'page wires feature-disabled task candidate handler');

assertContains(handlingPanel, /export default function DeviceOfflineHandlingPanel/, 'new standalone handling panel exists');
assertContains(handlingPanel, /正在处理：设备离线/, 'panel shows matched-device handling state');
assertContains(handlingPanel, /该待办来自聚合统计，当前没有设备明细。/, 'panel shows aggregate-only state');
assertContains(handlingPanel, /缺少设备定位信息/, 'panel shows missing-location state');
assertContains(handlingPanel, /查看地块报告/, 'aggregate state can link to field report');
assertContains(handlingPanel, /返回运营总队列/, 'missing-location state can return to workbench');
assertContains(handlingPanel, /正在提交处理结果\.\.\./, 'panel has submitting result state');
assertContains(handlingPanel, /已记录设备离线确认，审计编号：/, 'panel has success result state');
assertContains(handlingPanel, /操作未完成：缺少权限 \/ 后端接口未开放 \/ 设备不存在 \/ 设备明细不可用/, 'panel has failure result state');
assertContains(handlingPanel, /动作未开放。当前只能记录需人工核查，不能直接创建任务/, 'panel has not-open result state');

assertNotContains(joined, /点击后没有变化|可点击但无结果|直接生成 AO-ACT|直接写正式验收|直接写客户 ROI|直接写正式 Field Memory/, 'forbidden unsafe/no-op claims must not appear');

if (process.exitCode) {
  console.error('[operator-device-offline-workflow] FAIL');
  process.exit(process.exitCode);
}
console.log('[operator-device-offline-workflow] PASS');
