#!/usr/bin/env node
'use strict';
const { spawnSync } = require('node:child_process');
const SEED = 'scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs';
const CHAIN = 'C8_FORMAL_IRRIGATION_FULL_CHAIN_V1';
function run(args) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) { console.error(r.stdout); console.error(r.stderr); process.exit(r.status || 1); }
  return JSON.parse(r.stdout);
}
function must(ok, msg, detail) {
  if (!ok) { console.error(`[controlled-pilot-full-review-seed-export] ${msg}`); if (detail !== undefined) console.error(JSON.stringify(detail, null, 2)); process.exit(1); }
}
function all(list, values) { return values.every((x) => Array.isArray(list) && list.includes(x)); }
function close(a, b) { return Math.abs(Number(a) - Number(b)) < 0.0001; }
const dry = run([SEED, '--dry-run', '--tenant', 'tenantA']);
must(dry.ok === true && dry.chain_id === CHAIN && dry.apply === false, 'dry-run envelope invalid', dry);
for (const [key, min] of Object.entries({ fields: 3, devices: 4, formal_operations: 1, recommendations: 2, approval_requests: 2, receipts: 2, formal_evidence: 2, acceptance_results: 2, field_memory: 1, prescriptions: 1 })) must(Number(dry.planned_counts?.[key] || 0) >= min, `dry-run count too small: ${key}`, dry.planned_counts);
const exported = run([SEED, '--export-json', '--tenant', 'tenantA']);
const c = exported.formal_chain || {};
must(exported.ok === true && exported.chain_id === CHAIN && c.chain_id === CHAIN, 'chain id invalid', exported);
for (const k of ['field','boundary','devices','observations','diagnosis','recommendation','prescription','approval','operation_plan','ao_act_task','receipt','as_executed_expected','as_applied_expected','evidence','acceptance','roi','field_memory','report_expectations']) must(c[k] !== undefined, `formal_chain missing ${k}`);
must(c.field?.field_id === 'field_c8_demo' && c.field?.area_mu === 30 && c.field?.crop_name === '玉米' && c.field?.crop_stage === '营养生长期', 'field context invalid', c.field);
for (const id of ['dev_soil_c8_001','dev_valve_pump_c8_001','dev_weather_station_c8_001']) { const d = (c.devices || []).find((x) => x.device_id === id); must(d?.display_kind_text && d?.sensing_role_text && d?.capability_text && d?.field_role_text, `device context invalid: ${id}`, d); }
const before = (c.observations || []).find((x) => x.metric === 'soil_moisture_percent');
const after = (c.observations || []).find((x) => x.metric === 'soil_moisture_after_percent');
const rain = (c.observations || []).find((x) => x.metric === 'forecast_rain_72h_mm');
must(before?.metric_role === 'before' && before?.diagnostic_use === 'irrigation_decision_input' && before?.threshold_ref, 'before observation invalid', before);
must(after?.metric_role === 'after' && after?.diagnostic_use === 'acceptance_effect_input', 'after observation invalid', after);
must(rain?.metric_role === 'weather_forecast' && rain?.diagnostic_use === 'irrigation_decision_input', 'rain observation invalid', rain);
must(c.diagnosis?.input_observation_refs?.includes('telemetry_soil_before_001') && c.diagnosis?.input_observation_refs?.includes('telemetry_rain_001'), 'diagnosis refs missing', c.diagnosis);
must(c.recommendation?.expected_effect?.metric === 'soil_moisture_percent', 'recommendation expected effect missing', c.recommendation);
must(c.prescription?.prescription_id === 'presc_c8_irrigation_001' && close(c.prescription?.operation_amount?.amount, 22) && c.prescription?.operation_amount?.unit === 'mm', 'prescription invalid', c.prescription);
must(c.operation_plan?.operation_plan_id === 'op_plan_c8_irrigation_formal_001' && c.operation_plan?.prescription_id === 'presc_c8_irrigation_001' && all(c.operation_plan?.expected_evidence, ['water_delivery_receipt','post_soil_moisture_metric']), 'operation plan invalid', c.operation_plan);
must(c.ao_act_task?.act_task_id === 'act_c8_irrigation_formal_001' && c.ao_act_task?.parameters?.amount === 22 && c.ao_act_task?.parameters?.target_soil_moisture_percent === 24 && all(c.ao_act_task?.evidence_requirements, ['water_delivery_receipt','post_soil_moisture_metric']), 'AO-ACT task invalid', c.ao_act_task);
must(c.receipt?.receipt_id === 'receipt_c8_irrigation_formal_001' && c.receipt?.task_id === 'act_c8_irrigation_formal_001' && c.receipt?.status === 'executed' && close(c.receipt?.observed_parameters?.executed_amount, 21.6), 'receipt invalid', c.receipt);
must(c.acceptance?.acceptance_id === 'acc_c8_irrigation_formal_001' && c.acceptance?.formal_acceptance === true && c.acceptance?.formal_evidence_passed === true && c.acceptance?.chain_validation_passed === true, 'acceptance invalid', c.acceptance);
must(c.as_executed_expected?.status === 'CONFIRMED' && close(c.as_executed_expected?.planned_amount, 22) && close(c.as_executed_expected?.executed_amount, 21.6), 'as_executed expectation invalid', c.as_executed_expected);
must(c.as_applied_expected?.field_id === 'field_c8_demo' && Number(c.as_applied_expected?.coverage_percent || 0) === 100, 'as_applied expectation invalid', c.as_applied_expected);
must(c.roi?.source_lane === 'FORMAL_ACCEPTANCE' && c.roi?.trust_level === 'FORMAL_ACCEPTED' && c.roi?.customer_visible_value === true && c.roi?.formal_acceptance_id === 'acc_c8_irrigation_formal_001', 'formal ROI invalid', c.roi);
must(c.field_memory?.memory_lane === 'FORMAL_FIELD_MEMORY' && c.field_memory?.trust_level === 'FORMAL_ACCEPTED' && c.field_memory?.customer_visible_memory === true && c.field_memory?.learning_eligible === true, 'formal field memory invalid', c.field_memory);
must(all(c.report_expectations?.operation_report, ['diagnostic_inputs','prescription','as_executed','as_applied','roi_ledger','field_memory']), 'operation report expectations incomplete', c.report_expectations);
must(all(c.report_expectations?.field_report, ['field_context','sensing_summary','decision_summary','execution_summary','value_summary','learning_summary']), 'field report expectations incomplete', c.report_expectations);
console.log('[controlled-pilot-full-review-seed-export] PASS');
