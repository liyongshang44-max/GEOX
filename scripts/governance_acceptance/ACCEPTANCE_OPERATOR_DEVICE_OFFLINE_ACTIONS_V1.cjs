#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const actionsPath = path.join(root, 'apps/server/src/routes/v1/operator_device_offline_actions.ts');
const operatorPath = path.join(root, 'apps/server/src/routes/v1/operator.ts');
const modulePath = path.join(root, 'apps/server/src/modules/operator/registerOperatorModule.ts');
const packagePath = path.join(root, 'package.json');

function read(file) {
  assert.equal(fs.existsSync(file), true, `missing file: ${path.relative(root, file)}`);
  return fs.readFileSync(file, 'utf8');
}
function must(text, needle, label) {
  assert.equal(text.includes(needle), true, `${label}: ${needle}`);
}
function mustNot(text, needle, label) {
  assert.equal(text.includes(needle), false, `${label}: ${needle}`);
}

const actions = read(actionsPath);
const operator = read(operatorPath);
const moduleFile = read(modulePath);
const pkg = read(packagePath);

must(actions, '/api/v1/operator/devices/:device_id/offline/ack', 'ack route exists');
must(actions, '/api/v1/operator/devices/:device_id/offline/followup', 'followup route exists');
must(actions, '/api/v1/operator/devices/:device_id/offline/inspection-task-candidate', 'task candidate route exists');
must(actions, 'ACK_DEVICE_OFFLINE', 'ack action exists');
must(actions, 'MARK_DEVICE_OFFLINE_FOLLOWUP', 'followup action exists');
must(actions, 'CREATE_OFFLINE_INSPECTION_TASK_CANDIDATE', 'candidate action exists');
must(actions, 'operator.device_offline.write', 'operator permission is required');
must(actions, 'requireAoActAnyScopeV0', 'auth guard is required');
must(actions, 'writeAuditFact', 'audit write is required');
must(actions, 'operator_device_offline_action_audit_v1', 'audit fact type is required');
must(actions, 'NO_FORMAL_ACCEPTANCE_NO_FIELD_MEMORY_NO_ROI_NO_AO_ACT', 'audit policy is required');
must(actions, 'DEVICE_NOT_FOUND', 'missing concrete device is explicit');
must(actions, 'AUDIT_WRITE_FAILED', 'audit failure is explicit');
must(actions, '不会自动生成 AO-ACT', 'candidate does not auto-create task');
must(moduleFile, 'registerOperatorDeviceOfflineActionRoutes', 'module registers route');
must(moduleFile, 'operator_device_offline_actions.js', 'module imports route');
must(operator, 'device_id', 'operator facade exposes device id');
must(operator, 'online_status', 'operator facade exposes online status');
must(pkg, 'ci:governance:operator-device-offline-actions', 'package script is registered');

for (const token of [
  'acceptance_result_v1',
  'formal_field_memory_lane',
  'customer_visible_roi',
  'roi_ledger_v1',
  'field_memory_v1',
  'operation_acceptance',
  'acceptance_v1',
  'INSERT INTO operation_plan',
  'INSERT INTO act_task',
  "status='ACKED'",
  'source=aggregate',
]) {
  mustNot(actions, token, 'offline action must not cross formal/customer boundary');
}

assert.equal(/findDevice\(pool, deviceId\)/.test(actions), true, 'route must require concrete device lookup');
assert.equal(/if \(!device\)/.test(actions), true, 'route must reject unresolved device');
console.log('PASS operator device offline action boundary governance v1');
