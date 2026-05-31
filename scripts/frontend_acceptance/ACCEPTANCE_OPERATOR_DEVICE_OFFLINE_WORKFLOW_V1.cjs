#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const files = {
  workbenchApi: 'apps/web/src/api/operatorWorkbench.ts',
  devicesApi: 'apps/web/src/api/operatorDevicesAlerts.ts',
  devicesVm: 'apps/web/src/viewmodels/operatorDevicesAlertsVm.ts',
  devicesPage: 'apps/web/src/views/operator/OperatorDevicesAlertsPage.tsx',
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
const devicesApi = read(files.devicesApi);
const devicesVm = read(files.devicesVm);
const devicesPage = read(files.devicesPage);

assertContains(workbenchApi, /DEVICE_OFFLINE:\s*"\/operator\/devices-alerts\?focus=device_offline"/, 'DEVICE_OFFLINE routes to devices-alerts focus');
assertContains(workbenchApi, /deviceOfflineHref\(/, 'device offline href builder exists');
assertContains(workbenchApi, /online_status:\s*"OFFLINE"/, 'device offline href carries online_status=OFFLINE');
assertContains(workbenchApi, /device_id/, 'device offline href can carry device_id');
assertContains(workbenchApi, /field_id/, 'device offline href can carry field_id');
assertNotContains(workbenchApi, /DEVICE_OFFLINE[\s\S]{0,120}\/operator\/workbench/, 'DEVICE_OFFLINE must not fallback to workbench');

assertContains(devicesApi, /OperatorDevicesAlertsQuery/, 'devices alerts query type exists');
assertContains(devicesApi, /fetchOperatorDevicesAlerts\(query\?/, 'fetchOperatorDevicesAlerts accepts query');
assertContains(devicesApi, /device_id:\s*query\?\.deviceId/, 'official API receives device_id query');
assertContains(devicesApi, /field_id:\s*query\?\.fieldId/, 'official API receives field_id query');
assertContains(devicesApi, /online_status:\s*query\?\.onlineStatus/, 'official API receives online_status query');
assertContains(devicesApi, /matchesQueryDevice/, 'fallback device list is filtered by focus query');

assertContains(devicesVm, /OperatorDeviceOfflineFocusVm/, 'device offline focus VM exists');
assertContains(devicesVm, /buildFocusVm/, 'focus VM builder exists');
assertContains(devicesVm, /设备离线处理/, 'focus panel title is produced by VM');
assertContains(devicesVm, /不伪造 ACK、验收、ROI 或 Field Memory/, 'focus audit boundary forbids fake outcomes');
assertContains(devicesVm, /未完成复核前不得对客户展示执行成功/, 'focus next-step boundary forbids sales claims');

assertContains(devicesPage, /useSearchParams/, 'devices-alerts page reads URL query');
assertContains(devicesPage, /queryFromParams/, 'query parser exists');
assertContains(devicesPage, /fetchOperatorDevicesAlerts\(query\)/, 'page fetches devices-alerts with query');
assertContains(devicesPage, /buildOperatorDevicesAlertsVm\(response, query\)/, 'page builds VM with query');
assertContains(devicesPage, /DeviceOfflineFocusPanel/, 'device offline focus panel is rendered');
assertContains(devicesPage, /未完成现场复核前，不生成正式作业成功、客户 ROI 或 Field Memory/, 'page displays boundary against fake success');

if (process.exitCode) {
  console.error('[operator-device-offline-workflow] FAIL');
  process.exit(process.exitCode);
}
console.log('[operator-device-offline-workflow] PASS');
