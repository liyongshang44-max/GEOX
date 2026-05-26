#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function has(src, needle) { return src.includes(needle); }
function re(src, pattern) { return pattern.test(src); }

const report = read('apps/server/src/projections/report_v1.ts');
const dashboard = read('apps/server/src/projections/report_dashboard_v1.ts');
const failSafeService = read('apps/server/src/services/fail_safe_service_v1.ts');
const failSafeRoutes = read('apps/server/src/routes/fail_safe_v1.ts');
const cards = read('apps/web/src/components/customer/FormalScenarioCards.tsx');

const checks = {
  device_offline_covered: has(failSafeService, 'DEVICE_OFFLINE') && has(failSafeService, 'last_heartbeat_ts_ms'),
  stale_telemetry_or_status_unknown_covered: has(failSafeService, 'DEVICE_STATUS_UNKNOWN') && has(failSafeService, 'GEOX_FAIL_SAFE_DEVICE_OFFLINE_AFTER_MS'),
  receipt_missing_required_evidence_covered: has(cards, '缺少证据') && (has(cards, 'RECEIPT') || has(cards, 'required') || has(cards, '设备回执')),
  dispatch_ack_missing_or_executor_not_acked_covered: has(cards, 'ACK') || has(cards, '派发确认'),
  fail_safe_routes_present: has(failSafeRoutes, '/api/v1/fail-safe/events') && has(failSafeRoutes, '/api/v1/manual-takeovers'),
  anomaly_not_wrapped_as_success: has(cards, '不展示') && has(cards, '执行成功'),
  report_has_device_anomaly_scenario_type: has(report, 'DEVICE_ANOMALY'),
  report_has_fail_safe_projection: has(report, 'fail_safe') && has(report, 'trigger') && has(report, 'severity'),
  report_has_manual_takeover_projection: has(report, 'manual_takeover') && has(report, 'takeover_id'),
  dashboard_recent_operations_has_fail_safe_status: has(dashboard, 'fail_safe_status') && has(dashboard, 'manual_takeover_status'),
  dashboard_recent_operations_has_review_gate: has(dashboard, 'needs_review') && has(dashboard, 'customer_visible_eligible'),
  anomaly_customer_shows_type: has(cards, '异常类型'),
  anomaly_customer_shows_impact_scope: has(cards, '影响范围'),
  anomaly_customer_shows_system_block_reason: has(cards, '系统阻断'),
  anomaly_customer_shows_missing_evidence: has(cards, '缺少证据'),
  anomaly_customer_shows_manual_takeover: has(cards, '人工接管'),
  anomaly_customer_shows_fail_safe: has(cards, 'Fail-safe'),
  anomaly_customer_shows_next_action: has(cards, '客户下一步'),
  anomaly_roi_hidden_until_acceptance: has(cards, '不展示 ROI') || has(cards, '不展示 ROI 价值结论'),
  anomaly_field_memory_hidden_until_acceptance: has(cards, '不生成对客 Field Memory'),
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks }, null, 2));
if (!ok) process.exit(1);
