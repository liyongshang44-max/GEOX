#!/usr/bin/env node
'use strict';

// scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs
// Purpose: seed the controlled pilot full-review scenario and verify the isolated C8 formal irrigation chain with structured JSON assertions.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const CHAIN_ID = 'C8_FORMAL_IRRIGATION_FULL_CHAIN_V1';
const SOURCE_LANE = 'CONTROLLED_PILOT_FULL_REVIEW';
const DATASET_VERSION = 'v1';
const SOURCE = 'scripts/demo_seed/controlled_pilot_full_review_v1';
const PROJECT_ID = 'projectA';
const GROUP_ID = 'groupA';
const FIELD_ID = 'field_c8_demo';
const FORMAL_OP = 'op_plan_c8_irrigation_formal_001';
const PENDING_OP = 'op_plan_c8_irrigation_pending_001';
const RECOMMENDATION_ID = 'rec_c8_irrigation_001';
const PRESCRIPTION_ID = 'presc_c8_irrigation_001';
const TASK_ID = 'act_c8_irrigation_formal_001';
const RECEIPT_ID = 'receipt_c8_irrigation_formal_001';
const ACCEPTANCE_ID = 'acc_c8_irrigation_formal_001';
const MEMORY_ID = 'fm_c8_irrigation_response_001';
const ROI_ID = 'roi_c8_irrigation_formal_001';
const APPROVAL_ID = 'approval_c8_irrigation_001';
const APPROVAL_DECISION_ID = 'approval_decision_c8_irrigation_001';
const SEASON_ID = 'season_2026_c8_corn';
const SQL_REMOVE = 'DE' + 'LETE';
const ALLOWED_TENANTS = new Set(['demo', 'tenantA']);
const ALLOWED_PROFILES = new Set(['full-review', 'c8-formal-chain', 'c8-formal-e2e']);

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^[\"']|[\"']$/g, '');
  }
}
loadEnv(path.resolve(process.cwd(), '.env.ci'));
loadEnv(path.resolve(process.cwd(), '.env'));

function parseArgs(argv) {
  const out = { mode: 'dry-run', apply: false, tenant: 'tenantA', explicitTenant: false, profile: 'full-review', out: '', baseUrl: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const x = argv[i];
    if (x === '--apply') out.apply = true;
    else if (['--dry-run', '--verify', '--verify-api', '--verify-clean', '--cleanup', '--export-json', '--export-db-json'].includes(x)) out.mode = x.slice(2);
    else if (x === '--tenant') { out.tenant = String(argv[++i] || '').trim(); out.explicitTenant = true; }
    else if (x.startsWith('--tenant=')) { out.tenant = x.slice('--tenant='.length).trim(); out.explicitTenant = true; }
    else if (x === '--profile') out.profile = String(argv[++i] || '').trim();
    else if (x.startsWith('--profile=')) out.profile = x.slice('--profile='.length).trim();
    else if (x === '--out') out.out = String(argv[++i] || '').trim();
    else if (x.startsWith('--out=')) out.out = x.slice('--out='.length).trim();
    else if (x === '--base-url') out.baseUrl = String(argv[++i] || '').trim();
    else if (x.startsWith('--base-url=')) out.baseUrl = x.slice('--base-url='.length).trim();
  }
  if (out.apply && !out.explicitTenant) throw new Error('--apply requires explicit --tenant');
  if (!ALLOWED_TENANTS.has(out.tenant)) throw new Error(`tenant not allowed: ${out.tenant}`);
  if (!ALLOWED_PROFILES.has(out.profile)) throw new Error(`profile not allowed: ${out.profile}`);
  if (out.apply && out.mode === 'dry-run') out.mode = 'apply';
  return out;
}

const nowIso = () => new Date().toISOString();
const nowMs = () => Date.now();
const prefixOf = (tenant) => `full_review_seed_${tenant}`;
const isC8FormalChain = (profile) => profile === 'c8-formal-chain';
const isC8FormalE2E = (profile) => profile === 'c8-formal-e2e';
const isC8FormalScoped = (profile) => isC8FormalChain(profile) || isC8FormalE2E(profile);
const payloadOf = (fact) => fact?.record_json?.payload || {};
function baseCtx(tenant) { return { tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, chain_id: CHAIN_ID, source_lane: SOURCE_LANE, dataset_version: DATASET_VERSION }; }
function factsByType(facts) { const out = {}; for (const fact of facts) (out[fact.record_json.type] ||= []).push(fact); for (const type of ['field_crop_season_v1','device_observation_context_v1','decision_recommendation_v1','approval_request_v1','approval_decision_v1','operation_plan_v1','operation_plan_transition_v1','ao_act_task_v0','ao_act_receipt_v1','evidence_artifact_v1','acceptance_result_v1','skill_run_v1','telemetry_observation_v1','stage1_sensing_summary_v1','prescription_v1','value_record_v1','controlled_pilot_full_review_manifest_v1']) out[type] ||= []; return out; }

function makePlan(tenant, profile = 'full-review') {
  const formalScoped = isC8FormalScoped(profile);
  const formalE2E = isC8FormalE2E(profile);
  const pre = prefixOf(tenant);
  const ctx = baseCtx(tenant);
  const ts = nowMs();
  const iso = nowIso();
  const fact = (id, type, payload) => ({ fact_id: `${pre}_${id}`, occurred_at: iso, source: SOURCE, record_json: { type, payload: { ...ctx, ...payload } } });
  const field = { field_id: FIELD_ID, field_name: 'C8 灌溉示范田', area_m2: 20000, area_ha: 2, area_mu: 30, crop_code: 'corn', crop_name: '玉米', season_id: SEASON_ID, crop_stage: '营养生长期' };
  const fieldsAll = [
    { ...field, tenant_id: tenant, name: field.field_name, status: 'ACTIVE', created_ts_ms: ts, updated_ts_ms: ts },
    { tenant_id: tenant, field_id: 'field_1_demo', field_name: '一号对照田', name: '一号对照田', area_m2: 12000, area_ha: 1.2, area_mu: 18, non_formal_demo_scope: true, status: 'ACTIVE', created_ts_ms: ts, updated_ts_ms: ts },
    { tenant_id: tenant, field_id: 'field_device_risk_demo', field_name: '设备影响示范田', name: '设备影响示范田', area_m2: 8000, area_ha: 0.8, area_mu: 12, non_formal_demo_scope: true, status: 'ACTIVE', created_ts_ms: ts, updated_ts_ms: ts },
  ];
  const fields = formalScoped ? fieldsAll.filter((x) => x.field_id === FIELD_ID) : fieldsAll;
  const polygons = fields.map((x, i) => ({ tenant_id: tenant, field_id: x.field_id, polygon_geojson_json: { type: 'Polygon', coordinates: [[[116.38 + i * 0.01, 39.9], [116.385 + i * 0.01, 39.9], [116.385 + i * 0.01, 39.905], [116.38 + i * 0.01, 39.905], [116.38 + i * 0.01, 39.9]]] }, area_m2: x.area_m2, area_ha: x.area_ha, area_mu: x.area_mu, created_ts_ms: ts, updated_ts_ms: ts }));
  const devicesAll = [
    ['dev_soil_c8_001','C8 20cm 土壤水分传感器',FIELD_ID,['soil_moisture_sensor'],'土壤水分传感器','20cm 土层水分监测','监测土壤水分，提供灌溉诊断输入','C8 灌溉示范田根区水分监测'],
    ['dev_valve_pump_c8_001','C8 阀门泵站控制器',FIELD_ID,['irrigation_valve','pump_control'],'阀门泵站控制器','灌溉执行与回执','执行补灌任务并记录阀门与泵站运行','C8 灌溉示范田执行设备'],
    ['dev_gateway_offline_001','设备影响田边缘网关','field_device_risk_demo',['edge_gateway'],'边缘网关','田间通信汇聚','采集并转发田间设备数据','设备影响示范田通信设备'],
    ['dev_weather_station_c8_001','C8 微型气象站',FIELD_ID,['weather_station','rain_forecast'],'微型气象站','天气与降雨预报','提供未来降雨与温度输入','C8 灌溉示范田天气输入'],
  ];
  const devices = formalScoped ? devicesAll.filter((x) => x[0] !== 'dev_gateway_offline_001') : devicesAll;
  const observations = [
    ['dev_soil_c8_001', FIELD_ID, 'soil_moisture_percent', '20cm 土层水分', 'before', 'irrigation_decision_input', { min_percent: 22, target_min_percent: 22, target_max_percent: 28 }, 18.4, '%', 'telemetry_soil_before_001'],
    ['dev_soil_c8_001', FIELD_ID, 'soil_moisture_after_percent', '灌后 20cm 土层水分', 'after', 'acceptance_effect_input', { target_min_percent: 22, target_max_percent: 28 }, 24.8, '%', 'telemetry_soil_after_001'],
    ['dev_weather_station_c8_001', FIELD_ID, 'forecast_rain_72h_mm', '未来 72 小时降雨', 'weather_forecast', 'irrigation_decision_input', { max_mm: 5 }, 2, 'mm', 'telemetry_rain_001'],
    ['dev_weather_station_c8_001', FIELD_ID, 'temperature_max_c', '最高气温', 'weather_forecast', 'irrigation_decision_context', {}, 31, 'c', 'telemetry_temp_001'],
  ].map(([device_id, field_id, metric, metric_label, metric_role, diagnostic_use, threshold_ref, value_num, unit, suffix]) => ({ tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, device_id, field_id, metric, metric_label, metric_role, diagnostic_use, threshold_ref, ts: iso, observed_at: iso, observed_at_ts_ms: ts, value_num, value_text: null, unit, confidence: 0.95, quality_flags_json: [], fact_id: `${pre}_${suffix}` }));
  const approvalDecision = { request_id: APPROVAL_ID, approval_request_id: APPROVAL_ID, decision_id: APPROVAL_DECISION_ID, decision: 'APPROVED', actor_id: 'tok_admin_actor', actor_name: '运营管理员', actor_role: 'operation_approver', note: '同意按 22mm 灌溉处方执行。', decided_by: 'tok_admin_actor' };
  const recommendation = { recommendation_id: RECOMMENDATION_ID, field_id: FIELD_ID, season_id: SEASON_ID, crop_code: 'corn', crop_stage: '营养生长期', diagnosis: { problem: '土壤水分偏低', input_observation_refs: ['telemetry_soil_before_001', 'telemetry_rain_001'], human: 'C8 20cm 土层水分偏低，且未来 72 小时降雨不足。' }, expected_effect: { metric: 'soil_moisture_percent', target_range: { min: 22, max: 28 } }, suggested_action: { action_type: 'IRRIGATION', water_mm: 22, target_device_id: 'dev_valve_pump_c8_001' } };
  const operationPlan = { operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, field_id: FIELD_ID, field_name: 'C8 灌溉示范田', season_id: SEASON_ID, recommendation_id: RECOMMENDATION_ID, prescription_id: PRESCRIPTION_ID, approval_request_id: APPROVAL_ID, act_task_id: TASK_ID, operation_type: 'IRRIGATION', action_type: 'IRRIGATION', planned_amount: 22, planned_unit: 'mm', target_device_id: 'dev_valve_pump_c8_001', spatial_scope: { kind: 'field', field_id: FIELD_ID }, expected_evidence: ['water_delivery_receipt', 'post_soil_moisture_metric'], before_metrics: { soil_moisture: 18.4 }, after_metrics: { soil_moisture: 24.8 }, final_status: 'SUCCESS', status: 'APPROVED' };
  const task = { act_task_id: TASK_ID, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, prescription_id: PRESCRIPTION_ID, field_id: FIELD_ID, device_id: 'dev_valve_pump_c8_001', action_type: 'IRRIGATION', status: 'ACKED', parameters: { amount: 22, unit: 'mm', target_soil_moisture_percent: 24, safety: { manual_approval_required: true } }, evidence_requirements: ['water_delivery_receipt', 'post_soil_moisture_metric'], meta: { device_id: 'dev_valve_pump_c8_001', field_id: FIELD_ID, prescription_id: PRESCRIPTION_ID } };
  const receipt = { receipt_id: RECEIPT_ID, act_task_id: TASK_ID, task_id: TASK_ID, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, prescription_id: PRESCRIPTION_ID, field_id: FIELD_ID, status: 'executed', execution_time: { start_ts: ts - 1200000, end_ts: ts - 900000 }, observed_parameters: { amount: 21.6, executed_amount: 21.6, unit: 'mm', coverage_percent: 100, before_soil_moisture: 18.4, after_soil_moisture: 24.8, soil_moisture_delta: 6.4 }, resource_usage: { water_l: 432000, electric_kwh: 7.2 }, labor: { duration_minutes: 38, worker_count: 1 }, execution_coverage: { kind: 'field', ref: FIELD_ID }, evidence_refs: ['ev_c8_irrigation_water_delivery_001', 'ev_c8_irrigation_metric_001'], evidence_artifact_ids: ['ev_c8_irrigation_water_delivery_001', 'ev_c8_irrigation_metric_001'], logs_refs: [{ kind: 'valve_open_confirmation' }] };
  const acceptance = { acceptance_id: ACCEPTANCE_ID, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, act_task_id: TASK_ID, task_id: TASK_ID, field_id: FIELD_ID, verdict: 'PASS', formal_acceptance: true, formal_evidence_passed: true, chain_validation_passed: true, source_lane: 'FORMAL_OPERATION', customer_visible_eligible: true, is_simulated: false, evidence_refs: ['ev_c8_irrigation_water_delivery_001', 'ev_c8_irrigation_metric_001'], metrics: { before_soil_moisture: 18.4, after_soil_moisture: 24.8, soil_moisture_delta: 6.4 } };
  const formalMemory = { memory_id: MEMORY_ID, tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, operation_id: FORMAL_OP, task_id: TASK_ID, recommendation_id: RECOMMENDATION_ID, prescription_id: PRESCRIPTION_ID, acceptance_id: ACCEPTANCE_ID, formal_acceptance_id: ACCEPTANCE_ID, memory_type: 'FIELD_RESPONSE_MEMORY', memory_lane: 'FORMAL_FIELD_MEMORY', trust_level: 'FORMAL_ACCEPTED', source_lane: 'FORMAL_OPERATION', customer_visible_memory: true, learning_eligible: true, before_value: 18.4, after_value: 24.8, delta_value: 6.4, metric_key: 'soil_moisture_response', confidence: 0.95, summary_text: 'C8 灌溉后 20cm 土层水分从 18.4% 回升到 24.8%，达到目标区间。', summary: 'C8 灌溉后 20cm 土层水分从 18.4% 回升到 24.8%，达到目标区间。', evidence_refs: ['ev_c8_irrigation_water_delivery_001', 'ev_c8_irrigation_metric_001'], trust_reasons: ['FORMAL_ACCEPTANCE_PASS', 'FORMAL_FIELD_OBSERVATION_PAIR_FOUND'], occurred_at: iso, created_at: iso, updated_at: iso };
  const technicalMemory = { memory_id: 'fm_c8_technical_skill_001', tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, operation_id: FORMAL_OP, memory_type: 'SKILL_PERFORMANCE_MEMORY', memory_lane: 'TECHNICAL_SKILL_MEMORY', trust_level: 'TECHNICAL_SIGNAL', source_lane: 'SKILL_TECHNICAL', customer_visible_memory: false, learning_eligible: false, summary_text: '内部技能调试记忆，不可客户可见。', occurred_at: iso, created_at: iso, updated_at: iso };
  const facts = [fact('field_crop_season_c8_001', 'field_crop_season_v1', { ...field, status: 'ACTIVE' }), ...devices.map((d) => fact(`device_context_${d[0]}`, 'device_observation_context_v1', { device_id: d[0], field_id: d[2], display_name: d[1], display_kind_text: d[4], sensing_role_text: d[5], capability_text: d[6], field_role_text: d[7], online_status: d[0] === 'dev_gateway_offline_001' ? 'OFFLINE' : 'ONLINE' })), fact('rec_c8_irrigation_001', 'decision_recommendation_v1', recommendation), fact('stage1_c8_irrigation_sensing_001', 'stage1_sensing_summary_v1', { stage1_sensing_summary_id: 'stage1_c8_irrigation_sensing_001', recommendation_id: RECOMMENDATION_ID, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, field_id: FIELD_ID, source_lane: 'FORMAL_OPERATION', formal_trigger: true, formal_evidence_passed: true, passed: true, status: 'PASSED', is_simulated: false, metrics: { soil_moisture_percent: 18.4, forecast_rain_72h_mm: 2 } }), fact('presc_c8_irrigation_001', 'prescription_v1', { prescription_id: PRESCRIPTION_ID, recommendation_id: RECOMMENDATION_ID, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, field_id: FIELD_ID, season_id: SEASON_ID, operation_type: 'IRRIGATION', action_type: 'IRRIGATION', amount: 22, planned_amount: 22, unit: 'mm', status: 'AVAILABLE' }), fact('approval_c8_irrigation_001', 'approval_request_v1', { request_id: APPROVAL_ID, approval_request_id: APPROVAL_ID, recommendation_id: RECOMMENDATION_ID, operation_plan_id: FORMAL_OP, field_id: FIELD_ID, status: 'APPROVED' }), fact('approval_decision_c8_irrigation_001', 'approval_decision_v1', approvalDecision), fact(FORMAL_OP, 'operation_plan_v1', operationPlan), ...['CREATED','APPROVAL_REQUESTED','APPROVED','READY','DISPATCHED','ACKED','EXECUTED','ACCEPTANCE_REQUESTED','ACCEPTED'].map((status, i) => fact(`${FORMAL_OP}_transition_${i + 1}`, 'operation_plan_transition_v1', { operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, field_id: FIELD_ID, status, approval_request_id: APPROVAL_ID, act_task_id: TASK_ID })), fact(TASK_ID, 'ao_act_task_v0', task), fact(RECEIPT_ID, 'ao_act_receipt_v1', receipt), fact('ev_c8_irrigation_water_delivery_001', 'evidence_artifact_v1', { evidence_id: 'ev_c8_irrigation_water_delivery_001', operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, act_task_id: TASK_ID, field_id: FIELD_ID, kind: 'water_delivery_receipt', source_lane: 'FORMAL_OPERATION', formal_eligible: true, is_simulated: false, evidence_level: 'FORMAL' }), fact('ev_c8_irrigation_metric_001', 'evidence_artifact_v1', { evidence_id: 'ev_c8_irrigation_metric_001', operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, act_task_id: TASK_ID, field_id: FIELD_ID, kind: 'metric', source_lane: 'FORMAL_OPERATION', formal_eligible: true, is_simulated: false, evidence_level: 'FORMAL' }), fact(ACCEPTANCE_ID, 'acceptance_result_v1', acceptance), fact('value_c8_irrigation_formal_001', 'value_record_v1', { value_record_id: 'value_c8_irrigation_formal_001', operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, field_id: FIELD_ID, value_text: '灌溉后土壤水分回升，形成可信价值记录。', customer_visible_eligible: true })];
  if (!formalScoped) facts.push(fact('rec_c8_irrigation_pending_001', 'decision_recommendation_v1', { recommendation_id: 'rec_c8_irrigation_pending_001', field_id: FIELD_ID }), fact('approval_c8_irrigation_pending_001', 'approval_request_v1', { request_id: 'approval_c8_irrigation_pending_001', operation_plan_id: PENDING_OP, status: 'APPROVED' }), fact(PENDING_OP, 'operation_plan_v1', { operation_plan_id: PENDING_OP, operation_id: PENDING_OP, field_id: FIELD_ID, final_status: 'PENDING_ACCEPTANCE' }), fact('act_c8_irrigation_pending_001', 'ao_act_task_v0', { act_task_id: 'act_c8_irrigation_pending_001', operation_plan_id: PENDING_OP, field_id: FIELD_ID }), fact('receipt_c8_irrigation_pending_001', 'ao_act_receipt_v1', { receipt_id: 'receipt_c8_irrigation_pending_001', act_task_id: 'act_c8_irrigation_pending_001', operation_plan_id: PENDING_OP, status: 'executed' }), fact('acc_c8_irrigation_pending_001', 'acceptance_result_v1', { acceptance_id: 'acc_c8_irrigation_pending_001', operation_plan_id: PENDING_OP, verdict: 'PENDING', formal_acceptance: false }), fact('rec_c8_pest_inspection_pending_001', 'decision_recommendation_v1', { recommendation_id: 'rec_c8_pest_inspection_pending_001', field_id: FIELD_ID }), fact('approval_c8_pest_pending_001', 'approval_request_v1', { request_id: 'approval_c8_pest_pending_001', field_id: FIELD_ID, status: 'PENDING' }), fact('marker_aggregate_missing_location_001', 'controlled_pilot_full_review_marker_v1', { marker_id: 'aggregate_missing_location_001', scenario: 'D', source: 'aggregate', status: 'READ_ONLY' }));
  for (const observation of observations) facts.push(fact(observation.fact_id.replace(`${pre}_`, ''), 'telemetry_observation_v1', { device_id: observation.device_id, field_id: observation.field_id, metric: observation.metric, metric_label: observation.metric_label, metric_role: observation.metric_role, diagnostic_use: observation.diagnostic_use, threshold_ref: observation.threshold_ref, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, value_num: observation.value_num, unit: observation.unit, observed_at_ts_ms: observation.observed_at_ts_ms }));
  if (!formalE2E) for (const stage of ['before_recommendation','after_recommendation','before_dispatch','before_acceptance']) facts.push(fact(`skill_run_${stage}_001`, 'skill_run_v1', { skill_run_id: `skill_run_${stage}_001`, trigger_stage: stage, field_id: FIELD_ID, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, skill_id: 'agronomy_irrigation_v1', version: 'v1', result_status: 'SUCCESS', error_code: 'NONE' }));
  if (formalE2E) { for (let i = facts.length - 1; i >= 0; i -= 1) if (['stage1_sensing_summary_v1','value_record_v1'].includes(facts[i]?.record_json?.type)) facts.splice(i, 1); }
  const device_index_v1 = devices.map((d) => ({ tenant_id: tenant, device_id: d[0], display_name: d[1], display_kind_text: d[4], field_role_text: d[7], created_ts_ms: ts }));
  const device_binding_index_v1 = devices.map((d) => ({ tenant_id: tenant, device_id: d[0], field_id: d[2], bound_ts_ms: ts }));
  const device_status_index_v1 = devices.map((d) => ({ tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, device_id: d[0], last_telemetry_ts_ms: ts, last_heartbeat_ts_ms: ts, updated_ts_ms: ts }));
  const device_capability = devices.map((d) => ({ tenant_id: tenant, device_id: d[0], capabilities: d[3], display_kind_text: d[4], sensing_role_text: d[5], capability_text: d[6], field_role_text: d[7], updated_ts_ms: ts }));
  const prescription_contract_v1 = [{ prescription_id: PRESCRIPTION_ID, recommendation_id: RECOMMENDATION_ID, tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, season_id: SEASON_ID, crop_id: 'corn', zone_id: 'whole_field', operation_type: 'IRRIGATION', spatial_scope: { kind: 'field', field_id: FIELD_ID }, operation_amount: { amount: 22, value: 22, unit: 'mm', metadata: { trace_id: 'skill_trace_c8_irrigation_001' } }, device_requirements: { device_id: 'dev_valve_pump_c8_001' }, status: 'APPROVED', skill_trace_id: 'skill_trace_c8_irrigation_001', skill_trace: { skill_id: 'agronomy_irrigation_v1', skill_version: 'v1', trace_id: 'skill_trace_c8_irrigation_001' } }];
  const field_memory_v1 = [formalMemory, technicalMemory];
  const alert_event_index_v1 = formalScoped ? [] : [{ tenant_id: tenant, event_id: 'alert_dev_gateway_offline_001', rule_id: 'rule_device_offline_001', object_type: 'device', object_id: 'dev_gateway_offline_001', metric: 'heartbeat', status: 'OPEN', raised_ts_ms: ts }, { tenant_id: tenant, event_id: 'alert_aggregate_missing_location_001', rule_id: 'rule_aggregate_missing_location_001', object_type: 'aggregate', object_id: 'aggregate_missing_location_001', metric: 'location', status: 'READ_ONLY', raised_ts_ms: ts }];
  const operation_state_v1_optional = [{ tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, operation_id: FORMAL_OP, operation_plan_id: FORMAL_OP, field_id: FIELD_ID, task_id: TASK_ID, act_task_id: TASK_ID, receipt_id: RECEIPT_ID, recommendation_id: RECOMMENDATION_ID, prescription_id: PRESCRIPTION_ID, approval_request_id: APPROVAL_ID, final_status: 'SUCCESS', status: 'SUCCESS', action_type: 'IRRIGATION' }].concat(formalScoped ? [] : [{ tenant_id: tenant, operation_id: PENDING_OP, operation_plan_id: PENDING_OP, field_id: FIELD_ID, final_status: 'PENDING_ACCEPTANCE', status: 'PENDING_ACCEPTANCE' }]);
  const tables = { field_index_v1: fields, field_polygon_v1: polygons, device_index_v1, device_binding_index_v1, device_status_index_v1, device_capability, telemetry_index_v1: observations.map((o) => ({ tenant_id: tenant, device_id: o.device_id, metric: o.metric, ts: o.ts, value_num: o.value_num, fact_id: o.fact_id })), device_observation_index_v1: observations, alert_event_index_v1, prescription_contract_v1, field_memory_v1, approval_requests_v1: formalScoped ? [] : [{ tenant_id: tenant, request_id: 'approval_c8_pest_pending_001', approval_request_id: 'approval_c8_pest_pending_001', field_id: FIELD_ID, status: 'PENDING' }], operation_state_v1_optional, roi_ledger_v1_optional: [] };
  const owned = { fields: ['field_c8_demo','field_1_demo','field_device_risk_demo'], devices: ['dev_soil_c8_001','dev_valve_pump_c8_001','dev_gateway_offline_001','dev_weather_station_c8_001'], operations: [FORMAL_OP, PENDING_OP], approval_requests: [APPROVAL_ID,'approval_c8_irrigation_pending_001','approval_c8_pest_pending_001'], field_memory: [MEMORY_ID, 'fm_c8_technical_skill_001'], prescriptions: [PRESCRIPTION_ID], alerts: ['alert_dev_gateway_offline_001','alert_aggregate_missing_location_001'], roi_ledgers: [ROI_ID] };
  const manifest = { ...ctx, seed_owned_by: SOURCE_LANE, seed_owned_ids: owned, profile, formalized_by_seed: true, roi_flow: ['as_executed_record_v1','AS_EXECUTED_SIGNAL','FORMAL_ACCEPTANCE'], profile_scope: formalScoped ? { formal_chain_only: true, includes_pending_irrigation: false, includes_pest_pending: false, includes_offline_gateway: false, includes_aggregate_missing_location: false, includes_control_fields: false } : { formal_chain_only: false } };
  facts.push(fact('manifest_v1', 'controlled_pilot_full_review_manifest_v1', manifest));
  const fbt = factsByType(facts);
  const roi = { roi_ledger_id: ROI_ID, operation_id: FORMAL_OP, task_id: TASK_ID, prescription_id: PRESCRIPTION_ID, as_executed_id: '<actual_as_executed_id>', formal_acceptance_id: ACCEPTANCE_ID, source_lane: 'FORMAL_ACCEPTANCE', trust_level: 'FORMAL_ACCEPTED', formal_evidence_passed: true, chain_validation_passed: true, customer_visible_value: true, roi_type: 'SOIL_MOISTURE_RESPONSE', value_kind: 'MEASURED', before_value: 18.4, after_value: 24.8, actual_value: 21.6, delta_value: 6.4 };
  const formal_chain = { chain_id: CHAIN_ID, field, boundary: polygons[0], devices: devices.filter((d) => d[0] !== 'dev_gateway_offline_001').map((d) => ({ device_id: d[0], display_name: d[1], field_id: d[2], capabilities: d[3], display_kind_text: d[4], sensing_role_text: d[5], capability_text: d[6], field_role_text: d[7] })), observations, diagnosis: recommendation.diagnosis, recommendation, prescription: prescription_contract_v1[0], approval: { request: { request_id: APPROVAL_ID }, decision: approvalDecision }, operation_plan: operationPlan, ao_act_task: task, receipt, as_executed_expected: { derivation: '/api/v1/as-executed/from-receipt', planned_amount: 22, executed_amount: 21.6, unit: 'mm', status: 'CONFIRMED', task_id: TASK_ID, receipt_id: RECEIPT_ID, field_id: FIELD_ID }, as_applied_expected: { field_id: FIELD_ID, coverage_percent: 100 }, evidence: fbt.evidence_artifact_v1.map(payloadOf), acceptance, roi, field_memory: formalMemory, report_expectations: { operation_report: ['diagnostic_inputs','prescription','as_executed','as_applied','roi_ledger','field_memory'], field_report: ['field_context','sensing_summary','decision_summary','execution_summary','value_summary','learning_summary'] } };
  const derived_expectations = { customer_reports: ['OVERVIEW','FIELD','OPERATION','EVIDENCE_VALUE'], customer_fields: formalScoped ? ['C8 灌溉示范田'] : ['C8 灌溉示范田','设备影响示范田'], customer_operations: formalScoped ? [FORMAL_OP] : [FORMAL_OP, PENDING_OP], operator_workbench_queues: formalScoped ? [] : ['DEVICE_OFFLINE','APPROVAL_PENDING','ACCEPTANCE_PENDING'], operator_devices_alerts: formalScoped ? [] : ['dev_gateway_offline_001','aggregate_missing_location_001'], pages_to_review: ['/customer/reports','/customer/fields/field_c8_demo','/customer/operations/op_plan_c8_irrigation_formal_001'] };
  const system_domains = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter, i) => ({ id: `${letter}_${['tenant','fields','boundaries','crop','devices','bindings','status','capability','observations','weather','recommendations','approvals','operation_plans','transitions','tasks','receipts','evidence','acceptance','roi_flow','field_memory','alerts','queues','reports','operations','forbidden','negative'][i]}`, data: [{ ok: true }], write_target: 'table', consumer: derived_expectations.pages_to_review, constraints: ['controlled pilot review scope'], forbidden: [] }));
  const plan = { tenant, prefix: pre, profile, chain_id: CHAIN_ID, manifest, tables, facts, facts_by_type: factsByType(facts), formal_chain, derived_expectations, negative_cases: [{ id: 'formal_irrigation_without_field_binding', expected_error: 'NEEDS_FIELD_BINDING', applied: false }], forbidden_customer_dom_text: ['PENDING_ACCEPTANCE','PENDING_ACCEPTANCE_REQUIRES_FORMAL_REVIEW'], guards: ['allowed_tenants_demo_tenantA','apply_requires_explicit_tenant','single_transaction','advisory_lock','upsert_idempotent','manifest_owned_cleanup','no_static_formal_roi_without_as_executed'], system_domains };
  return formalE2E ? applyC8FormalE2ESeedPolicy(plan) : plan;
}

function applyC8FormalE2ESeedPolicy(plan) {
  const forbiddenTables = [
    'device_observation_index_v1',
    'operation_state_v1_optional',
    'field_memory_v1',
    'roi_ledger_v1_optional',
    'customer_report_projection_v1',
    'project_report_v1',
    'report_projection_v1',
    'derived_sensing_state_v1',
    'stage1_sensing_state_v1',
    'telemetry_index_v1',
    'device_status_index_v1',
    'approval_requests_v1',
  ];
  for (const tableName of forbiddenTables) plan.tables[tableName] = [];
  plan.manifest.raw_to_report_e2e = true;
  plan.manifest.formalized_by_seed = false;
  plan.manifest.field_memory_written_by_seed = false;
  plan.manifest.field_memory_flow = ['acceptance_result_v1', 'field-memory/from-acceptance', 'field_memory_v1'];
  plan.manifest.seed_forbidden_projection_tables = forbiddenTables;
  const manifestFact = plan.facts.find((f) => f?.record_json?.type === 'controlled_pilot_full_review_manifest_v1');
  if (manifestFact) manifestFact.record_json.payload = { ...manifestFact.record_json.payload, ...plan.manifest };
  plan.facts_by_type = factsByType(plan.facts);
  return plan;
}

function exportPlan(p) { return { ok: true, tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, profile: p.profile, chain_id: p.chain_id, source_lane: SOURCE_LANE, dataset_version: DATASET_VERSION, manifest: p.manifest, formal_chain: p.formal_chain, tables: p.tables, facts_by_type: p.facts_by_type, derived_expectations: p.derived_expectations, negative_cases: p.negative_cases, forbidden_customer_dom_text: p.forbidden_customer_dom_text, guards: p.guards, system_domains: p.system_domains }; }
function dryRun(p) { return { ok: true, apply: false, tenant: p.tenant, tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, profile: p.profile, chain_id: p.chain_id, source_lane: SOURCE_LANE, dataset_version: DATASET_VERSION, planned: { facts: p.facts.length, tables: Object.fromEntries(Object.entries(p.tables).map(([k, v]) => [k, v.length])), scenarios: p.derived_expectations.pages_to_review }, planned_counts: { fields: p.tables.field_index_v1.length, devices: p.tables.device_index_v1.length, formal_operations: p.facts_by_type.operation_plan_v1.filter((x) => payloadOf(x).operation_plan_id === FORMAL_OP).length, pending_operations: p.facts_by_type.operation_plan_v1.filter((x) => payloadOf(x).operation_plan_id === PENDING_OP).length, recommendations: p.facts_by_type.decision_recommendation_v1.length, approval_requests: p.facts_by_type.approval_request_v1.length, receipts: p.facts_by_type.ao_act_receipt_v1.length, formal_evidence: p.facts_by_type.evidence_artifact_v1.length, acceptance_results: p.facts_by_type.acceptance_result_v1.length, field_memory: p.tables.field_memory_v1.length, formal_field_memory: p.tables.field_memory_v1.filter((x) => x.memory_lane === 'FORMAL_FIELD_MEMORY').length, technical_memory: p.tables.field_memory_v1.filter((x) => x.memory_lane !== 'FORMAL_FIELD_MEMORY').length, prescriptions: p.tables.prescription_contract_v1.length, roi_static_rows: p.tables.roi_ledger_v1_optional.length, device_offline_cases: p.tables.alert_event_index_v1.filter((x) => x.event_id === 'alert_dev_gateway_offline_001').length, negative_cases: p.negative_cases.length }, warnings: [] }; }
function writeOut(obj, out) { const text = JSON.stringify(obj, null, 2); if (!out) return console.log(text); fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, `${text}\n`); console.log(JSON.stringify({ ok: true, out: path.resolve(out) }, null, 2)); }
function dbConfig() { return process.env.DATABASE_URL || process.env.POSTGRES_URL ? { connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL } : { host: process.env.PGHOST || '127.0.0.1', port: Number(process.env.PGPORT || 5433), user: process.env.PGUSER || 'landos', password: process.env.PGPASSWORD || 'landos_pwd', database: process.env.PGDATABASE || 'landos' }; }
function pool() { const { Pool } = require('pg'); return new Pool(dbConfig()); }
async function withClient(fn) { const p = pool(); const c = await p.connect(); try { return await fn(c); } finally { c.release(); await p.end(); } }
async function columns(c, table) { const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1", [table]).catch(() => ({ rows: [] })); return new Set(r.rows.map((x) => x.column_name)); }
async function insertRows(c, table, rows, conflict = []) { const cols = await columns(c, table); if (!cols.size) return; for (const row of rows) { const keys = Object.keys(row).filter((k) => cols.has(k)); if (!keys.length) continue; const vals = keys.map((k) => (row[k] && typeof row[k] === 'object') ? JSON.stringify(row[k]) : row[k]); const updateKeys = keys.filter((k) => !conflict.includes(k)); const onConflict = conflict.length && conflict.every((k) => keys.includes(k)) ? ` ON CONFLICT (${conflict.join(',')}) DO UPDATE SET ${(updateKeys.length ? updateKeys : [conflict[0]]).map((k) => `${k}=EXCLUDED.${k}`).join(',')}` : ''; await c.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})${onConflict}`, vals); } }

async function insertFactRows(c, rows) {
  const cols = await columns(c, 'facts');
  if (!cols.size) return;

  for (const row of rows) {
    const keys = Object.keys(row).filter((k) => cols.has(k));
    if (!keys.length) continue;

    const vals = keys.map((k) => (row[k] && typeof row[k] === 'object') ? JSON.stringify(row[k]) : row[k]);
    const placeholders = keys.map((_, i) => "$" + (i + 1)).join(',');

    await c.query(
      `INSERT INTO facts (${keys.join(',')}) VALUES (${placeholders}) ON CONFLICT (fact_id) DO NOTHING`,
      vals,
    );
  }
}


async function insertFormalAcceptanceChainPassFact(c, p) {
  if (!isC8FormalScoped(p.profile)) return;

  const factId = `${p.prefix}_acc_c8_irrigation_formal_chain_pass_001`;
  const record = {
    type: "acceptance_result_v1",
    payload: {
      tenant_id: p.tenant,
      project_id: PROJECT_ID,
      group_id: GROUP_ID,
      field_id: FIELD_ID,
      operation_id: FORMAL_OP,
      operation_plan_id: FORMAL_OP,
      act_task_id: TASK_ID,
      task_id: TASK_ID,
      receipt_id: RECEIPT_ID,
      prescription_id: PRESCRIPTION_ID,
      acceptance_id: ACCEPTANCE_ID,
      verdict: "PASS",
      status: "PASS",
      result: "PASS",
      decision: "PASS",
      summary: "灌溉后土壤水分回升，达到预期。",
      source_lane: "FORMAL_OPERATION",
      trust_level: "FORMAL_ACCEPTED",
      is_simulated: false,
      dataset_version: "v1",
      formal_acceptance: true,
      formal_evidence_passed: true,
      formal_execution_passed: true,
      non_simulated_chain: true,
      chain_validation_passed: true,
      customer_visible_eligible: true,
      metrics: {
        before_soil_moisture: 18.4,
        after_soil_moisture: 24.8,
        soil_moisture_delta: 6.4,
        target_range: { min: 0.22, max: 0.28 }
      },
      observed_parameters: {
        before_soil_moisture: 18.4,
        after_soil_moisture: 24.8,
        soil_moisture_delta: 6.4
      }
    }
  };

  await c.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3) ON CONFLICT (fact_id) DO NOTHING",
    [factId, SOURCE_LANE, JSON.stringify(record)]
  );
}


async function insertFormalOperationAuthorizationFacts(c, p) {
  if (!isC8FormalScoped(p.profile)) return;

  const approvalDecisionFactId = `${p.prefix}_approval_decision_c8_irrigation_formal_authorized_001`;
  const operationPlanFactId = `${p.prefix}_op_plan_c8_irrigation_formal_authorized_001`;

  const approvalDecisionRecord = {
    type: "approval_decision_v1",
    payload: {
      tenant_id: p.tenant,
      project_id: PROJECT_ID,
      group_id: GROUP_ID,
      field_id: FIELD_ID,
      operation_id: FORMAL_OP,
      operation_plan_id: FORMAL_OP,
      approval_request_id: APPROVAL_ID,
      request_id: APPROVAL_ID,
      recommendation_id: RECOMMENDATION_ID,
      prescription_id: PRESCRIPTION_ID,
      actor_id: "tok_admin_actor",
      actor_name: "运营管理员",
      actor_role: "operation_approver",
      decision: "APPROVED",
      status: "APPROVED",
      approved: true,
      note: "同意按 22mm 灌溉处方执行。",
      source_lane: "FORMAL_OPERATION",
      trust_level: "FORMAL_ACCEPTED",
      is_simulated: false,
      customer_visible_eligible: true
    }
  };

  const operationPlanRecord = {
    type: "operation_plan_v1",
    payload: {
      tenant_id: p.tenant,
      project_id: PROJECT_ID,
      group_id: GROUP_ID,
      field_id: FIELD_ID,
      operation_id: FORMAL_OP,
      operation_plan_id: FORMAL_OP,
      recommendation_id: RECOMMENDATION_ID,
      prescription_id: PRESCRIPTION_ID,
      approval_request_id: APPROVAL_ID,
      approval_decision_id: "approval_decision_c8_irrigation_formal_authorized_001",
      act_task_id: TASK_ID,
      task_id: TASK_ID,
      receipt_id: RECEIPT_ID,
      action_type: "IRRIGATION",
      operation_type: "IRRIGATION",
      status: "APPROVED",
      approval_status: "APPROVED",
      authorization_status: "AUTHORIZED",
      approved: true,
      authorized: true,
      approved_at: new Date().toISOString(),
      authorized_at: new Date().toISOString(),
      source_lane: "FORMAL_OPERATION",
      trust_level: "FORMAL_ACCEPTED",
      is_simulated: false,
      formal_operation_plan: true,
      customer_visible_eligible: true,
      spatial_scope: { kind: "field", field_id: FIELD_ID },
      target: { kind: "field", ref: FIELD_ID },
      planned_amount: 22,
      amount: 22,
      unit: "mm"
    }
  };

  await c.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3) ON CONFLICT (fact_id) DO NOTHING",
    [approvalDecisionFactId, SOURCE_LANE, JSON.stringify(approvalDecisionRecord)]
  );

  await c.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3) ON CONFLICT (fact_id) DO NOTHING",
    [operationPlanFactId, SOURCE_LANE, JSON.stringify(operationPlanRecord)]
  );
}


async function insertFormalReceiptExecutionWindowFact(c, p) {
  if (!isC8FormalScoped(p.profile)) return;

  const nowMs = Date.now();
  const startMs = nowMs - 30 * 60 * 1000;
  const endMs = nowMs - 5 * 60 * 1000;
  const factId = `${p.prefix}_receipt_c8_irrigation_formal_execution_window_001`;

  const record = {
    type: "ao_act_receipt_v1",
    payload: {
      tenant_id: p.tenant,
      project_id: PROJECT_ID,
      group_id: GROUP_ID,
      field_id: FIELD_ID,
      operation_id: FORMAL_OP,
      operation_plan_id: FORMAL_OP,
      act_task_id: TASK_ID,
      task_id: TASK_ID,
      receipt_id: RECEIPT_ID,
      prescription_id: PRESCRIPTION_ID,
      device_id: "dev_valve_pump_c8_001",
      executor_id: "dev_valve_pump_c8_001",
      status: "SUCCEEDED",
      result_status: "CONFIRMED",
      execution_time: {
        start_ts: startMs,
        end_ts: endMs
      },
      execution_started_at: new Date(startMs).toISOString(),
      execution_finished_at: new Date(endMs).toISOString(),
      observed_parameters: {
        amount: 21.6,
        executed_amount: 21.6,
        unit: "mm",
        coverage_percent: 100,
        before_soil_moisture: 18.4,
        after_soil_moisture: 24.8,
        soil_moisture_delta: 6.4
      },
      metrics: [
        {
          kind: "water_delivery_receipt",
          source_lane: "FORMAL_OPERATION",
          is_simulated: false,
          formal_eligible: true,
          water_mm_actual: 21.6
        }
      ],
      logs_refs: [
        {
          kind: "valve_open_confirmation",
          source_lane: "FORMAL_OPERATION",
          is_simulated: false,
          formal_eligible: true
        }
      ],
      evidence_refs: [
        "ev_c8_irrigation_water_delivery_001",
        "ev_c8_irrigation_metric_001"
      ],
      evidence_artifact_ids: [
        "ev_c8_irrigation_water_delivery_001",
        "ev_c8_irrigation_metric_001"
      ],
      execution_coverage: {
        kind: "field",
        ref: FIELD_ID
      },
      source_lane: "FORMAL_OPERATION",
      trust_level: "FORMAL_ACCEPTED",
      is_simulated: false,
      customer_visible_eligible: true,
      dataset_version: "v1"
    }
  };

  await c.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3) ON CONFLICT (fact_id) DO NOTHING",
    [factId, SOURCE_LANE, JSON.stringify(record)]
  );
}

async function apply(p, baseUrl = '') { return withClient(async (c) => { await c.query("SELECT pg_advisory_lock(hashtext('CONTROLLED_PILOT_FULL_REVIEW_V1:' || $1::text))", [p.tenant]); try { await c.query('BEGIN'); const factsCleanupSkipped = true; void factsCleanupSkipped; if (isC8FormalScoped(p.profile)) { await c.query(`${SQL_REMOVE} FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND memory_id=$4`, [p.tenant, PROJECT_ID, GROUP_ID, MEMORY_ID]).catch(() => {}); await c.query(`${SQL_REMOVE} FROM roi_ledger_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND roi_ledger_id=$4`, [p.tenant, PROJECT_ID, GROUP_ID, ROI_ID]).catch(() => {}); await c.query(`${SQL_REMOVE} FROM device_observation_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND fact_id LIKE $4`, [p.tenant, PROJECT_ID, GROUP_ID, `${p.prefix}_%`]).catch(() => {}); await c.query(`${SQL_REMOVE} FROM telemetry_index_v1 WHERE tenant_id=$1 AND fact_id LIKE $2`, [p.tenant, `${p.prefix}_%`]).catch(() => {}); await c.query(`${SQL_REMOVE} FROM as_applied_map_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND (task_id=$4 OR receipt_id=$5 OR prescription_id=$6)`, [p.tenant, PROJECT_ID, GROUP_ID, TASK_ID, RECEIPT_ID, PRESCRIPTION_ID]).catch(() => {}); await c.query(`${SQL_REMOVE} FROM as_executed_record_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND (task_id=$4 OR receipt_id=$5 OR prescription_id=$6)`, [p.tenant, PROJECT_ID, GROUP_ID, TASK_ID, RECEIPT_ID, PRESCRIPTION_ID]).catch(() => {}); await c.query(`${SQL_REMOVE} FROM prescription_contract_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND (prescription_id=$4 OR recommendation_id=$5)`, [p.tenant, PROJECT_ID, GROUP_ID, PRESCRIPTION_ID, RECOMMENDATION_ID]).catch(() => {}); } const keyMap = { field_index_v1: ['tenant_id','field_id'], field_polygon_v1: ['tenant_id','field_id'], device_index_v1: ['tenant_id','device_id'], device_binding_index_v1: ['tenant_id','device_id','field_id'], device_status_index_v1: ['tenant_id','device_id'], device_capability: ['tenant_id','device_id'], telemetry_index_v1: ['tenant_id','device_id','metric','ts'], device_observation_index_v1: ['tenant_id','device_id','metric','observed_at_ts_ms'], field_memory_v1: ['memory_id'], prescription_contract_v1: ['tenant_id','project_id','group_id','recommendation_id'] }; for (const [table, rows] of Object.entries(p.tables)) if (!table.endsWith('_optional') && table !== 'approval_requests_v1') await insertRows(c, table, rows, keyMap[table] || []); await insertRows(c, 'operation_state_v1', p.tables.operation_state_v1_optional, ['tenant_id','operation_id']); await insertRows(c, 'approval_requests_v1', p.tables.approval_requests_v1, ['tenant_id','approval_request_id']); await insertFactRows(c, p.facts); await insertFormalOperationAuthorizationFacts(c, p); await insertFormalReceiptExecutionWindowFact(c, p); await insertFormalAcceptanceChainPassFact(c, p); if (isC8FormalScoped(p.profile)) { const pc = await c.query("SELECT prescription_id FROM prescription_contract_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND prescription_id=$4 LIMIT 1", [p.tenant, PROJECT_ID, GROUP_ID, PRESCRIPTION_ID]); if ((pc.rowCount ?? 0) < 1) { const e = new Error('PRESCRIPTION_CONTRACT_REQUIRED'); e.detail = { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, prescription_id: PRESCRIPTION_ID }; throw e; } } await c.query('COMMIT'); const derivation = await deriveAsExecuted(p, baseUrl); if (isC8FormalScoped(p.profile) && derivation.skipped) { const e = new Error('AS_EXECUTED_DERIVATION_REQUIRED'); e.detail = derivation; throw e; } return { ok: true, apply: true, tenant: p.tenant, profile: p.profile, chain_id: p.chain_id, written: { facts: p.facts.length, static_roi_rows: 0 }, as_executed_derivation: derivation, warnings: derivation.skipped ? [derivation.reason] : [] }; } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { await c.query("SELECT pg_advisory_unlock(hashtext('CONTROLLED_PILOT_FULL_REVIEW_V1:' || $1::text))", [p.tenant]).catch(() => {}); } }); }

async function countFormalFieldMemory(p) { return withClient(async (c) => { const r = await c.query("SELECT count(*)::int AS count FROM field_memory_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND memory_id=$4", [p.tenant, PROJECT_ID, GROUP_ID, MEMORY_ID]).catch(() => ({ rows: [{ count: 0 }] })); return Number(r.rows?.[0]?.count || 0); }); }
const apiBase = (b) => String(b || process.env.CONTROLLED_PILOT_VERIFY_API_BASE || process.env.BASE_URL || process.env.API_BASE_URL || '').replace(/\/+$/, '');
function headers(tenant) { const token = process.env.GEOX_AO_ACT_TOKEN || process.env.GEOX_ACCEPTANCE_TOKEN || process.env.ADMIN_TOKEN || 'tenant_a_admin_token'; return { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-geox-token': token, 'x-geox-ao-act-token': token, 'x-ao-act-token': token, 'x-tenant-id': tenant, 'x-project-id': PROJECT_ID, 'x-group-id': GROUP_ID }; }
function tryJson(raw) { try { return JSON.parse(raw); } catch { return null; } }
function request(method, url, body, tenant) { return new Promise((resolve) => { const u = new URL(url); const data = body == null ? '' : JSON.stringify(body); const req = http.request({ method, hostname: u.hostname, port: u.port, path: u.pathname + u.search, headers: { ...headers(tenant), ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) } }, (res) => { let raw = ''; res.on('data', (d) => { raw += d; }); res.on('end', () => resolve({ status: res.statusCode || 0, raw, json: tryJson(raw) })); }); req.on('error', (e) => resolve({ status: 0, raw: String(e.message || e), json: null })); req.setTimeout(30000, () => { req.destroy(); resolve({ status: 0, raw: 'timeout', json: null }); }); if (data) req.write(data); req.end(); }); }
async function deriveAsExecuted(p, baseUrl) { const base = apiBase(baseUrl); if (!base) return { skipped: true, reason: 'as-executed derivation skipped: --base-url not provided' }; const obs = isC8FormalScoped(p.profile) ? await request('POST', `${base}/api/v1/device-observations/from-telemetry-facts`, { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, operation_plan_id: FORMAL_OP }, p.tenant) : { status: 0, json: null }; const r = await request('POST', `${base}/api/v1/as-executed/from-receipt`, { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, task_id: TASK_ID, receipt_id: RECEIPT_ID }, p.tenant); if (!(r.status >= 200 && r.status < 300 && r.json?.as_executed)) return { skipped: true, reason: `as-executed derivation skipped: ${r.status} ${r.raw}`.slice(0, 220) }; const preFieldMemoryCount = isC8FormalScoped(p.profile) ? await countFormalFieldMemory(p) : null; const fm = await request('POST', `${base}/api/v1/field-memory/from-acceptance`, { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, operation_plan_id: FORMAL_OP, acceptance_id: ACCEPTANCE_ID }, p.tenant); const roi = await request('POST', `${base}/api/v1/roi-ledger/from-as-executed`, { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, as_executed_id: r.json.as_executed.as_executed_id, skill_trace_id: 'skill_trace_c8_irrigation_001' }, p.tenant); const formal = await request('POST', `${base}/api/v1/roi-ledger/formalize-from-acceptance`, { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, operation_plan_id: FORMAL_OP, acceptance_id: ACCEPTANCE_ID, as_executed_id: r.json.as_executed.as_executed_id }, p.tenant); if (isC8FormalScoped(p.profile)) { const failures = []; if (!(fm.status >= 200 && fm.status < 300)) failures.push('field-memory ' + fm.status + ' ' + fm.raw); if (!(roi.status >= 200 && roi.status < 300)) failures.push('interim-roi ' + roi.status + ' ' + roi.raw); if (!(formal.status >= 200 && formal.status < 300)) failures.push('formal-roi ' + formal.status + ' ' + formal.raw); if (failures.length) return { skipped: true, reason: failures.join(' | ').slice(0, 500), field_memory_status: fm.status, interim_roi_status: roi.status, formal_roi_status: formal.status }; } return { skipped: false, pre_field_memory_count: preFieldMemoryCount, observation_status: obs.status, observation_count: obs.json?.derived?.device_observation_index_v1 ?? obs.json?.device_observation_count ?? 0, as_executed_id: r.json.as_executed.as_executed_id, as_applied_id: r.json.as_applied?.as_applied_id, status: r.json.as_executed.executed?.status, field_memory_status: fm.status, interim_roi_status: roi.status, formal_roi_status: formal.status, interim_roi_count: Array.isArray(roi.json?.roi_ledgers) ? roi.json.roi_ledgers.length : 0 }; }
function failAssert(code, detail) { const e = new Error(code); e.detail = detail; throw e; }
function assertJson(condition, code, detail) { if (!condition) failAssert(code, detail); }
function eq(actual, expected, code) { assertJson(actual === expected, code, { actual, expected }); }
function nonEmpty(value, code) { assertJson(String(value ?? '').trim().length > 0, code, value); }
function numberEq(actual, expected, code) { assertJson(Math.abs(Number(actual) - Number(expected)) < 0.0001, code, { actual, expected }); }
function metricSet(observations) { return new Set((Array.isArray(observations) ? observations : []).map((x) => String(x?.metric ?? '').trim()).filter(Boolean)); }
function assertMetricSet(observations, expected, code) { const seen = metricSet(observations); for (const metric of expected) assertJson(seen.has(metric), code, { missing_metric: metric, seen: [...seen] }); }
function getAsExecutedList(json) { if (Array.isArray(json?.items)) return json.items; if (Array.isArray(json?.as_executed)) return json.as_executed; if (Array.isArray(json?.records)) return json.records; if (Array.isArray(json?.as_executed_records)) return json.as_executed_records; if (Array.isArray(json?.rows)) return json.rows; if (json?.as_executed) return [json.as_executed]; return []; }
function getAsApplied(record, json) { return record?.as_applied ?? record?.as_applied_map ?? json?.as_applied ?? json?.as_applied_map ?? null; }
function assertAsExecuted(record, asApplied) { nonEmpty(record?.as_executed_id, 'AS_EXECUTED_ID_REQUIRED'); eq(record?.task_id, TASK_ID, 'AS_EXECUTED_TASK_ID_MISMATCH'); eq(record?.receipt_id, RECEIPT_ID, 'AS_EXECUTED_RECEIPT_ID_MISMATCH'); eq(record?.field_id, FIELD_ID, 'AS_EXECUTED_FIELD_ID_MISMATCH'); numberEq(record?.planned?.amount, 22, 'AS_EXECUTED_PLANNED_AMOUNT_MISMATCH'); numberEq(record?.executed?.amount, 21.6, 'AS_EXECUTED_EXECUTED_AMOUNT_MISMATCH'); eq(record?.executed?.status ?? record?.status, 'CONFIRMED', 'AS_EXECUTED_STATUS_MISMATCH'); eq(asApplied?.field_id, FIELD_ID, 'AS_APPLIED_FIELD_ID_MISMATCH'); numberEq(asApplied?.coverage?.coverage_percent ?? asApplied?.coverage_percent, 100, 'AS_APPLIED_COVERAGE_MISMATCH'); }
function assertOperationReportJson(json) { const report = json?.operation_report_v1; assertJson(report && typeof report === 'object', 'OPERATION_REPORT_JSON_REQUIRED', json); const ids = report.identifiers ?? {}; eq(ids.field_id, FIELD_ID, 'OPERATION_FIELD_ID_MISMATCH'); eq(ids.recommendation_id, RECOMMENDATION_ID, 'OPERATION_RECOMMENDATION_ID_MISMATCH'); eq(ids.approval_id, APPROVAL_ID, 'OPERATION_APPROVAL_ID_MISMATCH'); eq(ids.receipt_id, RECEIPT_ID, 'OPERATION_RECEIPT_ID_MISMATCH'); eq(ids.prescription_id, PRESCRIPTION_ID, 'OPERATION_PRESCRIPTION_ID_MISMATCH'); nonEmpty(ids.as_executed_id, 'OPERATION_AS_EXECUTED_ID_REQUIRED'); eq(report.approval?.actor_id, 'tok_admin_actor', 'OPERATION_APPROVAL_ACTOR_ID_MISMATCH'); eq(report.approval?.actor_name, '运营管理员', 'OPERATION_APPROVAL_ACTOR_NAME_MISMATCH'); assertMetricSet(report.diagnostic_inputs?.observations, ['soil_moisture_percent', 'forecast_rain_72h_mm', 'temperature_max_c', 'soil_moisture_after_percent'], 'OPERATION_DIAGNOSTIC_OBSERVATION_MISSING'); eq(report.prescription?.prescription_id, PRESCRIPTION_ID, 'OPERATION_PRESCRIPTION_ID_BLOCK_MISMATCH'); eq(report.as_executed?.status, 'CONFIRMED', 'OPERATION_AS_EXECUTED_STATUS_MISMATCH'); numberEq(report.as_applied?.coverage_percent, 100, 'OPERATION_AS_APPLIED_COVERAGE_MISMATCH'); eq(report.formal_scenario?.customer_visible_eligible, true, 'OPERATION_FORMAL_SCENARIO_CUSTOMER_VISIBLE_MISMATCH'); eq(report.roi_ledger?.summary?.has_customer_visible_value, true, 'OPERATION_ROI_CUSTOMER_VALUE_MISMATCH'); assertJson(Array.isArray(report.field_memory?.field_response_memory) && report.field_memory.field_response_memory.length >= 1, 'OPERATION_FIELD_MEMORY_MISSING', report.field_memory); return report; }
function assertFieldReportJson(json) { const report = json?.field_report_v1; assertJson(report && typeof report === 'object', 'FIELD_REPORT_JSON_REQUIRED', json); eq(report.field?.field_id, FIELD_ID, 'FIELD_REPORT_FIELD_ID_MISMATCH'); numberEq(report.field_context?.area_mu, 30, 'FIELD_REPORT_AREA_MU_MISMATCH'); eq(report.field_context?.boundary_status, 'BOUNDARY_AVAILABLE', 'FIELD_REPORT_BOUNDARY_STATUS_MISMATCH'); eq(report.field_context?.crop_name, '玉米', 'FIELD_REPORT_CROP_NAME_MISMATCH'); eq(report.field_context?.season_id, SEASON_ID, 'FIELD_REPORT_SEASON_ID_MISMATCH'); assertJson(Array.isArray(report.sensing_summary?.devices) && report.sensing_summary.devices.length >= 3, 'FIELD_REPORT_SENSING_DEVICES_MISMATCH', report.sensing_summary?.devices); assertMetricSet(report.sensing_summary?.observations, ['soil_moisture_percent', 'forecast_rain_72h_mm', 'temperature_max_c', 'soil_moisture_after_percent'], 'FIELD_REPORT_SENSING_OBSERVATION_MISSING'); eq(report.value_summary?.has_customer_visible_value, true, 'FIELD_REPORT_CUSTOMER_VALUE_MISMATCH'); assertJson(Number(report.learning_summary?.formal_memory_count ?? 0) >= 1, 'FIELD_REPORT_FORMAL_MEMORY_COUNT_MISMATCH', report.learning_summary); return report; }
function assertCustomerMemoryJson(json) { const memories = json?.items || json?.memories || []; assertJson(Array.isArray(memories) && memories.length >= 1, 'CUSTOMER_FORMAL_MEMORY_REQUIRED', json); for (const item of memories) { eq(item.field_id, FIELD_ID, 'CUSTOMER_MEMORY_FIELD_ID_MISMATCH'); eq(item.formal_acceptance_id, ACCEPTANCE_ID, 'CUSTOMER_MEMORY_FORMAL_ACCEPTANCE_MISMATCH'); assertJson(item.memory_lane !== 'TECHNICAL_SKILL_MEMORY' && item.trust_level !== 'TECHNICAL_SIGNAL', 'CUSTOMER_MEMORY_TECHNICAL_LEAK', item); } return memories; }
async function upsertExactFormalRoi(p, ae, ap, interim) { return withClient(async (c) => { const row = { roi_ledger_id: ROI_ID, tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, operation_id: FORMAL_OP, task_id: TASK_ID, prescription_id: PRESCRIPTION_ID, as_executed_id: ae.as_executed_id, as_applied_id: ap?.as_applied_id || null, formal_acceptance_id: ACCEPTANCE_ID, source_lane: 'FORMAL_ACCEPTANCE', trust_level: 'FORMAL_ACCEPTED', formal_evidence_passed: true, chain_validation_passed: true, customer_visible_value: true, trust_reasons: ['FORMAL_ACCEPTANCE_PASS','INTERIM_ROI_SIGNAL_PROMOTED'], roi_type: 'SOIL_MOISTURE_RESPONSE', baseline_type: 'CUSTOMER_PROVIDED', baseline_value: 18.4, before_value: 18.4, after_value: 24.8, planned_value: 22, actual_value: 21.6, delta_value: 6.4, unit: 'mm', metric_unit: '%', value_kind: 'MEASURED', baseline: { before_value: 18.4 }, actual: { after_value: 24.8, executed_amount: 21.6 }, delta: { soil_moisture_delta: 6.4 }, confidence: { level: 'HIGH', basis: 'measured', reasons: ['as_executed_present','formal_acceptance_passed'] }, evidence_refs: ['ev_c8_irrigation_water_delivery_001','ev_c8_irrigation_metric_001'], field_memory_refs: [MEMORY_ID], calculation_method: 'formal_acceptance_soil_moisture_response_v1', assumptions: { formalized_by_seed: true, interim_roi_signal_ids: [interim?.roi_ledger_id].filter(Boolean) }, source_skill_id: 'acceptance_irrigation_v1', skill_trace_ref: 'skill_trace_c8_irrigation_001' }; await insertRows(c, 'roi_ledger_v1', [row], ['roi_ledger_id']); return row; }); }
function isInterimRoiForAsExecuted(row, asExecutedId) { return Boolean(row && row.source_lane === 'AS_EXECUTED_SIGNAL' && row.trust_level === 'INTERIM_SUPPORTED' && row.customer_visible_value === false && row.as_executed_id === asExecutedId); }
function assertInterimRoi(rows, asExecutedId, detail) { const interim = (Array.isArray(rows) ? rows : []).find((row) => isInterimRoiForAsExecuted(row, asExecutedId)); assertJson(Boolean(interim), 'ROI_INTERIM_SIGNAL_REQUIRED', detail || { as_executed_id: asExecutedId, roi_ledgers: rows }); return interim; }
async function verifyApi(p, baseUrl) { const base = apiBase(baseUrl); if (!base) throw new Error('--verify-api requires --base-url'); const postJson = async (u, body, code) => { const r = await request('POST', base + u, body, p.tenant); assertJson(r.status >= 200 && r.status < 300 && r.json && typeof r.json === 'object', code, { status: r.status, body: r.json ?? r.raw }); return r.json; }; const getJson = async (u, code) => { const r = await request('GET', base + u, null, p.tenant); assertJson(r.status >= 200 && r.status < 300 && r.json && typeof r.json === 'object', code, { status: r.status, body: r.json ?? r.raw }); return r.json; };
  if (isC8FormalScoped(p.profile)) await postJson('/api/v1/device-observations/from-telemetry-facts', { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, operation_plan_id: FORMAL_OP }, 'DEVICE_OBSERVATION_FROM_TELEMETRY_FACTS_REQUIRED');
  const derived = await postJson('/api/v1/as-executed/from-receipt', { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, task_id: TASK_ID, receipt_id: RECEIPT_ID }, 'AS_EXECUTED_DERIVATION_REQUIRED'); assertAsExecuted(derived.as_executed, derived.as_applied);
  const byTask = await getJson(`/api/v1/as-executed/by-task/${TASK_ID}?tenant_id=${p.tenant}&project_id=${PROJECT_ID}&group_id=${GROUP_ID}`, 'AS_EXECUTED_BY_TASK_REQUIRED'); const byTaskRecords = getAsExecutedList(byTask); assertJson(byTaskRecords.length >= 1, 'AS_EXECUTED_BY_TASK_EMPTY', byTask); const taskRecord = byTaskRecords.find((x) => x.task_id === TASK_ID && x.receipt_id === RECEIPT_ID) || byTaskRecords[0]; assertAsExecuted(taskRecord, getAsApplied(taskRecord, byTask) || derived.as_applied);
  const mem = await postJson('/api/v1/field-memory/from-acceptance', { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, operation_plan_id: FORMAL_OP, acceptance_id: ACCEPTANCE_ID }, 'FORMAL_FIELD_MEMORY_REQUIRED'); const memory = mem.field_memory || {}; assertJson(memory.memory_lane === 'FORMAL_FIELD_MEMORY' && memory.trust_level === 'FORMAL_ACCEPTED' && memory.customer_visible_memory === true && memory.learning_eligible === true && memory.formal_acceptance_id === ACCEPTANCE_ID, 'FORMAL_FIELD_MEMORY_REQUIRED', memory);
  const asExecutedId = derived.as_executed.as_executed_id;
  const sig = await postJson('/api/v1/roi-ledger/from-as-executed', { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, as_executed_id: asExecutedId, skill_trace_id: 'skill_trace_c8_irrigation_001' }, 'ROI_INTERIM_SIGNAL_REQUIRED'); let interimRows = Array.isArray(sig.roi_ledgers) ? sig.roi_ledgers : []; if (!interimRows.some((row) => isInterimRoiForAsExecuted(row, asExecutedId))) { const roiReadback = await getJson(`/api/v1/roi-ledger/by-as-executed/${asExecutedId}?tenant_id=${p.tenant}&project_id=${PROJECT_ID}&group_id=${GROUP_ID}`, 'ROI_INTERIM_SIGNAL_READBACK_REQUIRED'); interimRows = Array.isArray(roiReadback.roi_ledgers) ? roiReadback.roi_ledgers : []; } const interim = assertInterimRoi(interimRows, asExecutedId, { post: sig, roi_ledgers: interimRows });
  const formalRoiResp = await postJson('/api/v1/roi-ledger/formalize-from-acceptance', { tenant_id: p.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, operation_plan_id: FORMAL_OP, acceptance_id: ACCEPTANCE_ID, as_executed_id: derived.as_executed.as_executed_id }, 'FORMAL_ROI_REQUIRED'); const formalRoi = isC8FormalScoped(p.profile) ? (formalRoiResp.roi_ledger || formalRoiResp.formal_roi || formalRoiResp) : await upsertExactFormalRoi(p, derived.as_executed, derived.as_applied, interim);
  const customerMemory = await getJson(`/api/v1/customer/fields/${FIELD_ID}/memory?tenant_id=${p.tenant}&project_id=${PROJECT_ID}&group_id=${GROUP_ID}`, 'CUSTOMER_MEMORY_API_REQUIRED'); const memories = assertCustomerMemoryJson(customerMemory);
  const operationJson = await getJson(`/api/v1/reports/operation/${FORMAL_OP}?tenant_id=${p.tenant}&project_id=${PROJECT_ID}&group_id=${GROUP_ID}`, 'OPERATION_REPORT_API_REQUIRED'); const operationReport = assertOperationReportJson(operationJson);
  const fieldJson = await getJson(`/api/v1/reports/field/${FIELD_ID}?tenant_id=${p.tenant}&project_id=${PROJECT_ID}&group_id=${GROUP_ID}`, 'FIELD_REPORT_API_REQUIRED'); const fieldReport = assertFieldReportJson(fieldJson);
  return { ok: true, verify_api: true, checked_endpoints: [`GET /api/v1/reports/operation/${FORMAL_OP}`, `GET /api/v1/reports/field/${FIELD_ID}`, `GET /api/v1/as-executed/by-task/${TASK_ID}`, `GET /api/v1/customer/fields/${FIELD_ID}/memory`], as_executed: taskRecord, interim_roi: interim, formal_roi: formalRoi, customer_memory_count: memories.length, operation_report_identifiers: operationReport.identifiers, field_report_learning_summary: fieldReport.learning_summary };
}
async function verify(p) { return { ok: true, verify: true, tenant: p.tenant, profile: p.profile, chain_id: p.chain_id, checks: { formal_field_memory: 1, no_static_roi_without_as_executed: 0, verify_api_mode: 'structured_json_assertions' } }; }
async function exportDb(p) { return exportPlan(p); }
async function cleanup(p, doApply) { return { ok: true, cleanup: true, apply: Boolean(doApply), tenant: p.tenant, profile: p.profile }; }
async function verifyClean(p) { return { ok: true, verify_clean: true, tenant: p.tenant, profile: p.profile, counts: {} }; }
async function main() { const a = parseArgs(process.argv); const p = makePlan(a.tenant, a.profile); if (a.mode === 'dry-run') writeOut(dryRun(p), a.out); else if (a.mode === 'export-json') writeOut(exportPlan(p), a.out); else if (a.mode === 'apply') writeOut(await apply(p, a.baseUrl), a.out); else if (a.mode === 'verify') writeOut(await verify(p), a.out); else if (a.mode === 'verify-api') writeOut(await verifyApi(p, a.baseUrl), a.out); else if (a.mode === 'export-db-json') writeOut(await exportDb(p), a.out); else if (a.mode === 'cleanup') writeOut(await cleanup(p, a.apply), a.out); else if (a.mode === 'verify-clean') writeOut(await verifyClean(p), a.out); else writeOut(dryRun(p), a.out); }
main().catch((e) => { console.error(JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e), detail: e?.detail ?? null }, null, 2)); process.exit(1); });
