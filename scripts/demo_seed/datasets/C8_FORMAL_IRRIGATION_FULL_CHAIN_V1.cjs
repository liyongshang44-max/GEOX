'use strict';

// C8 formal irrigation full-chain dataset builder.
// Pure builder: no env reads, SQL/HTTP calls, or wall-clock access.

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
const REQUIRED_DIAGNOSTIC_METRICS = ['soil_moisture_percent', 'forecast_rain_72h_mm', 'temperature_max_c', 'soil_moisture_after_percent'];

const C8_FORMAL_IRRIGATION_FULL_CHAIN_V1 = Object.freeze({
  chain_id: CHAIN_ID,
  source_lane: SOURCE_LANE,
  dataset_version: DATASET_VERSION,
  source: SOURCE,
  project_id: PROJECT_ID,
  group_id: GROUP_ID,
  field_id: FIELD_ID,
  formal_operation_id: FORMAL_OP,
  pending_operation_id: PENDING_OP,
  recommendation_id: RECOMMENDATION_ID,
  prescription_id: PRESCRIPTION_ID,
  task_id: TASK_ID,
  receipt_id: RECEIPT_ID,
  acceptance_id: ACCEPTANCE_ID,
  memory_id: MEMORY_ID,
  roi_id: ROI_ID,
  approval_id: APPROVAL_ID,
  approval_decision_id: APPROVAL_DECISION_ID,
  season_id: SEASON_ID,
  required_diagnostic_metrics: REQUIRED_DIAGNOSTIC_METRICS,
});

const prefixOf = (tenant) => `full_review_seed_${tenant}`;
const isC8FormalChain = (profile) => profile === 'c8-formal-chain';
const isC8FormalE2E = (profile) => profile === 'c8-formal-e2e';
const isC8FormalScoped = (profile) => isC8FormalChain(profile) || isC8FormalE2E(profile);
const payloadOf = (fact) => fact?.record_json?.payload || {};
function baseCtx(tenant) { return { tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, chain_id: CHAIN_ID, source_lane: SOURCE_LANE, dataset_version: DATASET_VERSION }; }
function factsByType(facts) { const out = {}; for (const fact of facts) (out[fact.record_json.type] ||= []).push(fact); for (const type of ['field_crop_season_v1','device_observation_context_v1','decision_recommendation_v1','approval_request_v1','approval_decision_v1','operation_plan_v1','operation_plan_transition_v1','ao_act_task_v0','ao_act_receipt_v1','evidence_artifact_v1','acceptance_result_v1','skill_run_v1','telemetry_observation_v1','weather_forecast_fact_v1','stage1_sensing_summary_v1','prescription_v1','value_record_v1','controlled_pilot_full_review_manifest_v1']) out[type] ||= []; return out; }

function buildC8FormalIrrigationFullChainDataset(options) {
  const { tenant, profile = 'full-review', nowMs, nowIso } = options || {};
  if (!tenant) throw new Error('tenant is required');
  if (!Number.isFinite(nowMs)) throw new Error('nowMs must be a finite number');
  if (typeof nowIso !== 'string' || !nowIso) throw new Error('nowIso must be a non-empty ISO string');
  const formalScoped = isC8FormalScoped(profile);
  const formalE2E = isC8FormalE2E(profile);
  const pre = prefixOf(tenant);
  const ctx = baseCtx(tenant);
  const ts = nowMs;
  const iso = nowIso;
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
  const formalMemory = { memory_id: MEMORY_ID, tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, operation_id: FORMAL_OP, task_id: TASK_ID, recommendation_id: RECOMMENDATION_ID, prescription_id: PRESCRIPTION_ID, acceptance_id: ACCEPTANCE_ID, formal_acceptance_id: ACCEPTANCE_ID, memory_type: 'FIELD_RESPONSE_MEMORY', memory_lane: 'FORMAL_FIELD_MEMORY', trust_level: 'FORMAL_ACCEPTED', source_lane: 'FORMAL_OPERATION', customer_visible_memory: true, learning_eligible: true, compatibility_fallback: true, projection_support_only: true, not_authoritative_formal_result: true, formal_result_must_be_derived: true, static_seed_row_reason: 'Kept only as an optional compatibility projection fixture while customer-visible formal memory is derived through POST /api/v1/field-memory/from-acceptance.', before_value: 18.4, after_value: 24.8, delta_value: 6.4, metric_key: 'soil_moisture_response', confidence: 0.95, summary_text: 'C8 灌溉后 20cm 土层水分从 18.4% 回升到 24.8%，达到目标区间。', summary: 'C8 灌溉后 20cm 土层水分从 18.4% 回升到 24.8%，达到目标区间。', evidence_refs: ['ev_c8_irrigation_water_delivery_001', 'ev_c8_irrigation_metric_001'], trust_reasons: ['FORMAL_ACCEPTANCE_PASS', 'FORMAL_FIELD_OBSERVATION_PAIR_FOUND'], occurred_at: iso, created_at: iso, updated_at: iso };
  const technicalMemory = { memory_id: 'fm_c8_technical_skill_001', tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, operation_id: FORMAL_OP, memory_type: 'SKILL_PERFORMANCE_MEMORY', memory_lane: 'TECHNICAL_SKILL_MEMORY', trust_level: 'TECHNICAL_SIGNAL', source_lane: 'SKILL_TECHNICAL', customer_visible_memory: false, learning_eligible: false, compatibility_fallback: true, projection_support_only: true, summary_text: '内部技能调试记忆，不可客户可见。', occurred_at: iso, created_at: iso, updated_at: iso };
  const facts = [fact('field_crop_season_c8_001', 'field_crop_season_v1', { ...field, status: 'ACTIVE' }),
    fact('weather_forecast_c8_irrigation_001', 'weather_forecast_fact_v1', {
      forecast_id: 'wf_c8_irrigation_001',
      field_id: FIELD_ID,
      provider: 'MOCK',
      source_type: 'MOCK',
      source_id: 'c8_formal_irrigation_seed',
      latitude: 39.9025,
      longitude: 116.3825,
      generated_at: iso,
      valid_from: iso,
      valid_to: iso,
      horizon_hours: 72,
      rainfall_forecast_mm_72h: 2,
      temperature_max_c_72h: 31,
      et0_mm_72h: null,
      hourly: [],
      quality: {
        stale: false,
        missing_fields: ['et0_mm_72h'],
        provider_status: 'PARTIAL',
      },
      raw_payload: null,
    }), ...devices.map((d) => fact(`device_context_${d[0]}`, 'device_observation_context_v1', { device_id: d[0], field_id: d[2], display_name: d[1], display_kind_text: d[4], sensing_role_text: d[5], capability_text: d[6], field_role_text: d[7], online_status: d[0] === 'dev_gateway_offline_001' ? 'OFFLINE' : 'ONLINE' })), fact('rec_c8_irrigation_001', 'decision_recommendation_v1', recommendation), fact('stage1_c8_irrigation_sensing_001', 'stage1_sensing_summary_v1', { stage1_sensing_summary_id: 'stage1_c8_irrigation_sensing_001', recommendation_id: RECOMMENDATION_ID, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, field_id: FIELD_ID, source_lane: 'FORMAL_OPERATION', formal_trigger: true, formal_evidence_passed: true, passed: true, status: 'PASSED', is_simulated: false, metrics: { soil_moisture_percent: 18.4, forecast_rain_72h_mm: 2 } }), fact('presc_c8_irrigation_001', 'prescription_v1', { prescription_id: PRESCRIPTION_ID, recommendation_id: RECOMMENDATION_ID, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, field_id: FIELD_ID, season_id: SEASON_ID, operation_type: 'IRRIGATION', action_type: 'IRRIGATION', amount: 22, planned_amount: 22, unit: 'mm', status: 'AVAILABLE' }), fact('approval_c8_irrigation_001', 'approval_request_v1', { request_id: APPROVAL_ID, approval_request_id: APPROVAL_ID, recommendation_id: RECOMMENDATION_ID, operation_plan_id: FORMAL_OP, field_id: FIELD_ID, status: 'APPROVED' }), fact('approval_decision_c8_irrigation_001', 'approval_decision_v1', approvalDecision), fact(FORMAL_OP, 'operation_plan_v1', operationPlan), ...['CREATED','APPROVAL_REQUESTED','APPROVED','READY','DISPATCHED','ACKED','EXECUTED','ACCEPTANCE_REQUESTED','ACCEPTED'].map((status, i) => fact(`${FORMAL_OP}_transition_${i + 1}`, 'operation_plan_transition_v1', { operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, field_id: FIELD_ID, status, approval_request_id: APPROVAL_ID, act_task_id: TASK_ID })), fact(TASK_ID, 'ao_act_task_v0', task), fact(RECEIPT_ID, 'ao_act_receipt_v1', receipt), fact('ev_c8_irrigation_water_delivery_001', 'evidence_artifact_v1', { evidence_id: 'ev_c8_irrigation_water_delivery_001', operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, act_task_id: TASK_ID, field_id: FIELD_ID, kind: 'water_delivery_receipt', source_lane: 'FORMAL_OPERATION', formal_eligible: true, is_simulated: false, evidence_level: 'FORMAL' }), fact('ev_c8_irrigation_metric_001', 'evidence_artifact_v1', { evidence_id: 'ev_c8_irrigation_metric_001', operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, act_task_id: TASK_ID, field_id: FIELD_ID, kind: 'metric', source_lane: 'FORMAL_OPERATION', formal_eligible: true, is_simulated: false, evidence_level: 'FORMAL' }), fact(ACCEPTANCE_ID, 'acceptance_result_v1', acceptance), fact('value_c8_irrigation_formal_001', 'value_record_v1', { value_record_id: 'value_c8_irrigation_formal_001', operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, field_id: FIELD_ID, value_text: '灌溉后土壤水分回升，形成可信价值记录。', customer_visible_eligible: true })];
  if (!formalScoped) facts.push(fact('rec_c8_irrigation_pending_001', 'decision_recommendation_v1', { recommendation_id: 'rec_c8_irrigation_pending_001', field_id: FIELD_ID }), fact('approval_c8_irrigation_pending_001', 'approval_request_v1', { request_id: 'approval_c8_irrigation_pending_001', operation_plan_id: PENDING_OP, status: 'APPROVED' }), fact(PENDING_OP, 'operation_plan_v1', { operation_plan_id: PENDING_OP, operation_id: PENDING_OP, field_id: FIELD_ID, final_status: 'PENDING_ACCEPTANCE' }), fact('act_c8_irrigation_pending_001', 'ao_act_task_v0', { act_task_id: 'act_c8_irrigation_pending_001', operation_plan_id: PENDING_OP, field_id: FIELD_ID }), fact('receipt_c8_irrigation_pending_001', 'ao_act_receipt_v1', { receipt_id: 'receipt_c8_irrigation_pending_001', act_task_id: 'act_c8_irrigation_pending_001', operation_plan_id: PENDING_OP, status: 'executed' }), fact('acc_c8_irrigation_pending_001', 'acceptance_result_v1', { acceptance_id: 'acc_c8_irrigation_pending_001', operation_plan_id: PENDING_OP, verdict: 'PENDING', formal_acceptance: false }), fact('rec_c8_pest_inspection_pending_001', 'decision_recommendation_v1', { recommendation_id: 'rec_c8_pest_inspection_pending_001', field_id: FIELD_ID }), fact('approval_c8_pest_pending_001', 'approval_request_v1', { request_id: 'approval_c8_pest_pending_001', field_id: FIELD_ID, status: 'PENDING' }), fact('marker_aggregate_missing_location_001', 'controlled_pilot_full_review_marker_v1', { marker_id: 'aggregate_missing_location_001', scenario: 'D', source: 'aggregate', status: 'READ_ONLY' }));
  for (const observation of observations) facts.push(fact(observation.fact_id.replace(`${pre}_`, ''), 'telemetry_observation_v1', { device_id: observation.device_id, field_id: observation.field_id, metric: observation.metric, metric_label: observation.metric_label, metric_role: observation.metric_role, diagnostic_use: observation.diagnostic_use, threshold_ref: observation.threshold_ref, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, value_num: observation.value_num, unit: observation.unit, observed_at_ts_ms: observation.observed_at_ts_ms }));
  if (!formalE2E) for (const stage of ['before_recommendation','after_recommendation','before_dispatch','before_acceptance']) facts.push(fact(`skill_run_${stage}_001`, 'skill_run_v1', { skill_run_id: `skill_run_${stage}_001`, trigger_stage: stage, field_id: FIELD_ID, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, skill_id: 'agronomy_irrigation_v1', version: 'v1', result_status: 'SUCCESS', error_code: 'NONE' }));
  if (formalE2E) { for (let i = facts.length - 1; i >= 0; i -= 1) if (['stage1_sensing_summary_v1','value_record_v1'].includes(facts[i]?.record_json?.type)) facts.splice(i, 1); }
  const device_index_v1 = devices.map((d) => ({ tenant_id: tenant, device_id: d[0], display_name: d[1], display_kind_text: d[4], field_role_text: d[7], created_ts_ms: ts }));
  const device_binding_index_v1 = devices.map((d) => ({ tenant_id: tenant, device_id: d[0], field_id: d[2], bound_ts_ms: ts }));
  const device_status_index_v1 = devices.map((d) => ({ tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, device_id: d[0], last_telemetry_ts_ms: ts, last_heartbeat_ts_ms: ts, updated_ts_ms: ts }));
  const device_capability = devices.map((d) => ({ tenant_id: tenant, device_id: d[0], capabilities: d[3], display_kind_text: d[4], sensing_role_text: d[5], capability_text: d[6], field_role_text: d[7], updated_ts_ms: ts }));
  const prescription_contract_v1 = [{ prescription_id: PRESCRIPTION_ID, recommendation_id: RECOMMENDATION_ID, tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, season_id: SEASON_ID, crop_id: 'corn', zone_id: 'whole_field', operation_type: 'IRRIGATION', spatial_scope: { kind: 'field', field_id: FIELD_ID }, operation_amount: { amount: 22, value: 22, unit: 'mm', metadata: { trace_id: 'skill_trace_c8_irrigation_001' } }, device_requirements: { device_id: 'dev_valve_pump_c8_001' }, status: 'APPROVED', skill_trace_id: 'skill_trace_c8_irrigation_001', skill_trace: { skill_id: 'agronomy_irrigation_v1', skill_version: 'v1', trace_id: 'skill_trace_c8_irrigation_001' } }];
  const field_memory_v1_optional = [formalMemory, technicalMemory];
  const alert_event_index_v1 = formalScoped ? [] : [{ tenant_id: tenant, event_id: 'alert_dev_gateway_offline_001', rule_id: 'rule_device_offline_001', object_type: 'device', object_id: 'dev_gateway_offline_001', metric: 'heartbeat', status: 'OPEN', raised_ts_ms: ts }, { tenant_id: tenant, event_id: 'alert_aggregate_missing_location_001', rule_id: 'rule_aggregate_missing_location_001', object_type: 'aggregate', object_id: 'aggregate_missing_location_001', metric: 'location', status: 'READ_ONLY', raised_ts_ms: ts }];
  const operation_state_v1_optional = [{ tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, operation_id: FORMAL_OP, operation_plan_id: FORMAL_OP, field_id: FIELD_ID, task_id: TASK_ID, act_task_id: TASK_ID, receipt_id: RECEIPT_ID, recommendation_id: RECOMMENDATION_ID, prescription_id: PRESCRIPTION_ID, approval_request_id: APPROVAL_ID, final_status: 'SUCCESS', status: 'SUCCESS', action_type: 'IRRIGATION' }].concat(formalScoped ? [] : [{ tenant_id: tenant, operation_id: PENDING_OP, operation_plan_id: PENDING_OP, field_id: FIELD_ID, final_status: 'PENDING_ACCEPTANCE', status: 'PENDING_ACCEPTANCE' }]);
  const tables = { field_index_v1: fields, field_polygon_v1: polygons, device_index_v1, device_binding_index_v1, device_status_index_v1, device_capability, telemetry_index_v1: observations.map((o) => ({ tenant_id: tenant, device_id: o.device_id, metric: o.metric, ts: o.ts, value_num: o.value_num, fact_id: o.fact_id })), device_observation_index_v1: observations, alert_event_index_v1, prescription_contract_v1, field_memory_v1_optional, approval_requests_v1: formalScoped ? [] : [{ tenant_id: tenant, request_id: 'approval_c8_pest_pending_001', approval_request_id: 'approval_c8_pest_pending_001', field_id: FIELD_ID, status: 'PENDING' }], operation_state_v1_optional, roi_ledger_v1_optional: [] };
  const owned = { fields: ['field_c8_demo','field_1_demo','field_device_risk_demo'], devices: ['dev_soil_c8_001','dev_valve_pump_c8_001','dev_gateway_offline_001','dev_weather_station_c8_001'], operations: [FORMAL_OP, PENDING_OP], approval_requests: [APPROVAL_ID,'approval_c8_irrigation_pending_001','approval_c8_pest_pending_001'], field_memory_optional: [MEMORY_ID, 'fm_c8_technical_skill_001'], prescriptions: [PRESCRIPTION_ID], alerts: ['alert_dev_gateway_offline_001','alert_aggregate_missing_location_001'], roi_ledgers: [ROI_ID] };
  const manifest = { ...ctx, seed_owned_by: SOURCE_LANE, seed_owned_ids: owned, profile, formalized_by_seed: true, field_memory_written_by_seed: false, field_memory_flow: ['acceptance_result_v1','POST /api/v1/field-memory/from-acceptance','GET /api/v1/customer/fields/field_c8_demo/memory'], field_memory_contract: { optional_rows_table: 'field_memory_v1_optional', derived_table: 'field_memory_v1', derived_endpoint: 'POST /api/v1/field-memory/from-acceptance', customer_verification_endpoint: 'GET /api/v1/customer/fields/field_c8_demo/memory' }, governance_acceptance: { static_formal_memory_retained_reason: 'Optional compatibility/projection fixture retained for export and dry-run contract review only; apply skips *_optional tables.', static_formal_memory_is_only_pass_source: false, required_formal_memory_source: 'POST /api/v1/field-memory/from-acceptance', required_customer_memory_verification: 'GET /api/v1/customer/fields/field_c8_demo/memory' }, roi_flow: ['as_executed_record_v1','AS_EXECUTED_SIGNAL','FORMAL_ACCEPTANCE'], profile_scope: formalScoped ? { formal_chain_only: true, includes_pending_irrigation: false, includes_pest_pending: false, includes_offline_gateway: false, includes_aggregate_missing_location: false, includes_control_fields: false } : { formal_chain_only: false } };
  facts.push(fact('manifest_v1', 'controlled_pilot_full_review_manifest_v1', manifest));
  const fbt = factsByType(facts);
  const roi = { roi_ledger_id: ROI_ID, operation_id: FORMAL_OP, task_id: TASK_ID, prescription_id: PRESCRIPTION_ID, as_executed_id: '<actual_as_executed_id>', formal_acceptance_id: ACCEPTANCE_ID, source_lane: 'FORMAL_ACCEPTANCE', trust_level: 'FORMAL_ACCEPTED', formal_evidence_passed: true, chain_validation_passed: true, customer_visible_value: true, roi_type: 'SOIL_MOISTURE_RESPONSE', value_kind: 'MEASURED', before_value: 18.4, after_value: 24.8, actual_value: 21.6, delta_value: 6.4 };
  const formal_chain = { chain_id: CHAIN_ID, field, boundary: polygons[0], devices: devices.filter((d) => d[0] !== 'dev_gateway_offline_001').map((d) => ({ device_id: d[0], display_name: d[1], field_id: d[2], capabilities: d[3], display_kind_text: d[4], sensing_role_text: d[5], capability_text: d[6], field_role_text: d[7] })), observations, diagnosis: recommendation.diagnosis, recommendation, prescription: prescription_contract_v1[0], approval: { request: { request_id: APPROVAL_ID }, decision: approvalDecision }, operation_plan: operationPlan, ao_act_task: task, receipt, as_executed_expected: { derivation: '/api/v1/as-executed/from-receipt', planned_amount: 22, executed_amount: 21.6, unit: 'mm', status: 'CONFIRMED', task_id: TASK_ID, receipt_id: RECEIPT_ID, field_id: FIELD_ID }, as_applied_expected: { field_id: FIELD_ID, coverage_percent: 100 }, evidence: fbt.evidence_artifact_v1.map(payloadOf), acceptance, roi, field_memory: formalMemory, report_expectations: { operation_report: ['diagnostic_inputs','prescription','as_executed','as_applied','roi_ledger','field_memory'], field_report: ['field_context','sensing_summary','decision_summary','execution_summary','value_summary','learning_summary'] } };
  const derived_expectations = { customer_reports: ['OVERVIEW','FIELD','OPERATION','EVIDENCE_VALUE'], customer_fields: formalScoped ? ['C8 灌溉示范田'] : ['C8 灌溉示范田','设备影响示范田'], customer_operations: formalScoped ? [FORMAL_OP] : [FORMAL_OP, PENDING_OP], operator_workbench_queues: formalScoped ? [] : ['DEVICE_OFFLINE','APPROVAL_PENDING','ACCEPTANCE_PENDING'], operator_devices_alerts: formalScoped ? [] : ['dev_gateway_offline_001','aggregate_missing_location_001'], pages_to_review: ['/customer/reports','/customer/fields/field_c8_demo','/customer/operations/op_plan_c8_irrigation_formal_001'] };
  const system_domains = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter, i) => ({ id: `${letter}_${['tenant','fields','boundaries','crop','devices','bindings','status','capability','observations','weather','recommendations','approvals','operation_plans','transitions','tasks','receipts','evidence','acceptance','roi_flow','field_memory','alerts','queues','reports','operations','forbidden','negative'][i]}`, data: [{ ok: true }], write_target: 'table', consumer: derived_expectations.pages_to_review, constraints: ['controlled pilot review scope'], forbidden: [] }));
  const rows = tables;
  const metadata = {
    chain_id: CHAIN_ID,
    source_lane: SOURCE_LANE,
    source: SOURCE,
    prefix: pre,
    manifest,
    facts_by_type: factsByType(facts),
    formal_chain,
    derived_expectations,
    negative_cases: [{ id: 'formal_irrigation_without_field_binding', expected_error: 'NEEDS_FIELD_BINDING', applied: false }],
    forbidden_customer_dom_text: ['PENDING_ACCEPTANCE','PENDING_ACCEPTANCE_REQUIRES_FORMAL_REVIEW'],
    guards: ['allowed_tenants_demo_tenantA','apply_requires_explicit_tenant','single_transaction','advisory_lock','upsert_idempotent','manifest_owned_cleanup','no_static_formal_roi_without_as_executed'],
    system_domains,
    formal_operation_id: FORMAL_OP,
    pending_operation_id: PENDING_OP,
    field_id: FIELD_ID,
    recommendation_id: RECOMMENDATION_ID,
    prescription_id: PRESCRIPTION_ID,
    approval_id: APPROVAL_ID,
    task_id: TASK_ID,
    receipt_id: RECEIPT_ID,
    acceptance_id: ACCEPTANCE_ID,
  };
  const dataset = {
    dataset_id: CHAIN_ID,
    dataset_version: DATASET_VERSION,
    tenant_id: tenant,
    project_id: PROJECT_ID,
    group_id: GROUP_ID,
    profile,
    facts,
    rows,
    metadata,
  };
  return formalE2E ? applyC8FormalE2ESeedPolicy(dataset) : dataset;
}

function applyC8FormalE2ESeedPolicy(dataset) {
  const forbiddenTables = [
    'device_observation_index_v1',
    'operation_state_v1_optional',
    'field_memory_v1_optional',
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
  for (const tableName of forbiddenTables) dataset.rows[tableName] = [];
  const manifest = dataset.metadata.manifest;
  manifest.raw_to_report_e2e = true;
  manifest.formalized_by_seed = false;
  manifest.field_memory_written_by_seed = false;
  manifest.field_memory_flow = ['acceptance_result_v1', 'POST /api/v1/field-memory/from-acceptance', 'field_memory_v1', 'GET /api/v1/customer/fields/field_c8_demo/memory'];
  manifest.seed_forbidden_projection_tables = forbiddenTables;
  const manifestFact = dataset.facts.find((f) => f?.record_json?.type === 'controlled_pilot_full_review_manifest_v1');
  if (manifestFact) manifestFact.record_json.payload = { ...manifestFact.record_json.payload, ...manifest };
  dataset.metadata.facts_by_type = factsByType(dataset.facts);
  return dataset;
}

module.exports = {
  C8_FORMAL_IRRIGATION_FULL_CHAIN_V1,
  buildC8FormalIrrigationFullChainDataset,
};
