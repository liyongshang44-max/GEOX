#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../..');
function loadTsModule(rel) {
  const full = path.join(ROOT, rel);
  const src = fs.readFileSync(full, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const m = { exports: {} };
  new Function('require','module', 'exports', out.outputText)(require,m, m.exports);
  return m.exports;
}

const { buildDeviceAnomalyReportV1, inferDeviceAnomalyTypesV1, applyDeviceAnomalyReportGuardV1 } = loadTsModule('apps/server/src/projections/device_anomaly_report_v1.ts');

const fixture = {
  identifiers: { field_id: 'f1', operation_id: 'op1', act_task_id: 'task1' },
  as_executed: { device_id: 'dev1' },
  execution: { final_status: 'SUCCESS', invalid_reason: 'dispatch_ack_missing and executor_not_acked' },
  acceptance: { missing_items: ['receipt_missing_required_evidence'] },
  risk: { reasons: ['device_offline', 'sensor_drift', 'stale_telemetry'] },
  formal_scenario: { blocking_reasons: ['insufficient_evidence'] },
  fail_safe: { status: 'OPEN', trigger: 'DEVICE_OFFLINE' },
  manual_takeover: { status: 'REQUESTED', reason: 'EXECUTOR_NOT_ACKED' },
  roi_ledger: { summary: { has_customer_visible_value: true, trusted_value_items: 2 } },
  field_memory: {},
};
const inferred = inferDeviceAnomalyTypesV1(fixture);
const anomaly = buildDeviceAnomalyReportV1(fixture);
const guarded = applyDeviceAnomalyReportGuardV1(fixture);

const checks = {
  device_offline_covered: inferred.includes('DEVICE_OFFLINE'),
  stale_telemetry_covered: inferred.includes('STALE_TELEMETRY') || inferred.includes('SENSOR_DRIFT'),
  receipt_missing_required_evidence_covered: inferred.includes('RECEIPT_MISSING_REQUIRED_EVIDENCE'),
  dispatch_ack_missing_or_executor_not_acked_covered: inferred.includes('DISPATCH_ACK_MISSING') || inferred.includes('EXECUTOR_NOT_ACKED'),
  report_has_device_anomaly: Boolean(guarded.device_anomaly),
  report_shows_anomaly_types: Array.isArray(anomaly.anomaly_types) && anomaly.anomaly_types.length > 0,
  report_shows_impact_scope: Boolean(anomaly.impact_scope && anomaly.impact_scope.operation_id),
  report_shows_system_block_reason: Boolean(anomaly.system_block_reason),
  report_shows_missing_evidence: Array.isArray(anomaly.missing_evidence),
  report_shows_manual_takeover_required: typeof anomaly.manual_takeover_required === 'boolean',
  report_shows_fail_safe_status: Boolean(anomaly.fail_safe_status),
  report_shows_customer_next_action: Boolean(anomaly.customer_next_action),
  anomaly_not_operation_success: !['SUCCESS','SUCCEEDED','PASS'].includes(String(guarded.execution?.final_status || '').toUpperCase()),
  dashboard_recent_operations_has_fail_safe_status: fs.readFileSync(path.join(ROOT, 'apps/server/src/projections/report_dashboard_v1.ts'),'utf8').includes('fail_safe_status'),
  dashboard_recent_operations_has_manual_takeover_status: fs.readFileSync(path.join(ROOT, 'apps/server/src/projections/report_dashboard_v1.ts'),'utf8').includes('manual_takeover_status'),
  dashboard_recent_operations_needs_review: fs.readFileSync(path.join(ROOT, 'apps/server/src/projections/report_dashboard_v1.ts'),'utf8').includes('needs_review'),
  dashboard_recent_operations_not_customer_visible: fs.readFileSync(path.join(ROOT, 'apps/server/src/projections/report_dashboard_v1.ts'),'utf8').includes('customer_visible_eligible: ((report as any).device_anomaly'),
  roi_not_customer_visible_without_acceptance: guarded.roi_ledger?.summary?.has_customer_visible_value === false,
  field_memory_not_customer_visible_without_acceptance: guarded.field_memory?.hidden_by_guard === true,
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks }, null, 2));
if (!ok) process.exit(1);
