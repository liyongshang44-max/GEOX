#!/usr/bin/env node
const { Pool } = require('pg');

const SOURCE_LANE = 'CONTROLLED_PILOT_FULL_REVIEW';
const DATASET_VERSION = 'v1';
const SOURCE = 'scripts/demo_seed/controlled_pilot_full_review_v1';
const PROJECT_ID = 'projectA';
const GROUP_ID = 'groupA';
const ALLOWED_TENANTS = new Set(['demo', 'tenantA']);

function parseArgs(argv) {
  const out = { mode: 'dry-run', tenant: '', explicitTenant: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') out.apply = true;
    else if (arg === '--dry-run') out.mode = 'dry-run';
    else if (arg === '--verify') out.mode = 'verify';
    else if (arg === '--cleanup') out.mode = 'cleanup';
    else if (arg === '--tenant') { out.tenant = String(argv[++i] || '').trim(); out.explicitTenant = true; }
    else if (arg.startsWith('--tenant=')) { out.tenant = arg.slice('--tenant='.length).trim(); out.explicitTenant = true; }
  }
  if (!out.tenant) out.tenant = 'tenantA';
  if (out.apply && !out.explicitTenant) throw new Error('--apply requires explicit --tenant');
  if (!ALLOWED_TENANTS.has(out.tenant)) throw new Error(`tenant not allowed: ${out.tenant}`);
  return out;
}

function nowPlan(tenant) {
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const prefix = `full_review_seed_${tenant}`;
  const fields = [
    { field_id: 'field_c8_demo', field_name: 'C8 灌溉示范田', area_m2: 20000, area_ha: 2, status: 'ACTIVE' },
    { field_id: 'field_1_demo', field_name: '一号对照田', area_m2: 12000, area_ha: 1.2, status: 'ACTIVE' },
    { field_id: 'field_device_risk_demo', field_name: '设备影响示范田', area_m2: 8000, area_ha: 0.8, status: 'ACTIVE' },
  ];
  const polygons = fields.map((f, idx) => ({ ...f, polygon_geojson_json: { type: 'Polygon', coordinates: [[[116.38 + idx * 0.01, 39.90], [116.385 + idx * 0.01, 39.90], [116.385 + idx * 0.01, 39.905], [116.38 + idx * 0.01, 39.905], [116.38 + idx * 0.01, 39.90]]] } }));
  const devices = [
    { device_id: 'dev_soil_c8_001', display_name: 'C8 20cm 土壤水分传感器', capabilities: ['soil_moisture_sensor'], field_id: 'field_c8_demo', heartbeat: now - 2 * 60 * 1000, telemetry: now - 3 * 60 * 1000, battery: 86, rssi: -61 },
    { device_id: 'dev_valve_pump_c8_001', display_name: 'C8 阀门泵站控制器', capabilities: ['irrigation_valve', 'pump_control'], field_id: 'field_c8_demo', heartbeat: now - 4 * 60 * 1000, telemetry: now - 4 * 60 * 1000, battery: 91, rssi: -58 },
    { device_id: 'dev_gateway_offline_001', display_name: '设备影响田边缘网关', capabilities: ['edge_gateway'], field_id: 'field_device_risk_demo', heartbeat: now - 2 * 60 * 60 * 1000, telemetry: now - 130 * 60 * 1000, battery: 42, rssi: -88 },
    { device_id: 'dev_weather_station_c8_001', display_name: 'C8 微型气象站', capabilities: ['weather_station'], field_id: 'field_c8_demo', heartbeat: now - 3 * 60 * 1000, telemetry: now - 3 * 60 * 1000, battery: 79, rssi: -64 },
  ];
  const telemetry = [
    { device_id: 'dev_soil_c8_001', field_id: 'field_c8_demo', metric: 'soil_moisture_percent', value_num: 18.4, unit: '%', ts_ms: now - 70 * 60 * 1000, fact_id: `${prefix}_telemetry_soil_before_001` },
    { device_id: 'dev_soil_c8_001', field_id: 'field_c8_demo', metric: 'soil_moisture_after_percent', value_num: 24.8, unit: '%', ts_ms: now - 10 * 60 * 1000, fact_id: `${prefix}_telemetry_soil_after_001` },
    { device_id: 'dev_weather_station_c8_001', field_id: 'field_c8_demo', metric: 'forecast_rain_72h_mm', value_num: 2, unit: 'mm', ts_ms: now - 60 * 60 * 1000, fact_id: `${prefix}_telemetry_rain_001` },
    { device_id: 'dev_weather_station_c8_001', field_id: 'field_c8_demo', metric: 'temperature_max_c', value_num: 31, unit: 'c', ts_ms: now - 60 * 60 * 1000, fact_id: `${prefix}_telemetry_temp_001` },
  ];
  const factIds = [];
  function fact(suffix, type, payload) {
    const fact_id = `${prefix}_${suffix}`;
    factIds.push(fact_id);
    return { fact_id, occurred_at: iso, source: SOURCE, record_json: { type, payload: { tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, source_lane: SOURCE_LANE, dataset_version: DATASET_VERSION, ...payload } } };
  }
  const facts = [
    fact('rec_c8_irrigation_001', 'decision_recommendation_v1', { recommendation_id: 'rec_c8_irrigation_001', field_id: 'field_c8_demo', season_id: 'season_2026_c8_corn', crop_code: 'corn', crop_stage: '营养生长期', rule_id: 'irrigation_soil_moisture_threshold_v1', skill_id: 'agronomy_irrigation_v1', reason_codes: ['soil_moisture_below_threshold', 'no_rain_forecast'], suggested_action: { action_type: 'IRRIGATION', water_mm: 22 }, explain: { human: 'C8 灌溉示范田土壤水分偏低，近期降雨不足，建议补灌 22mm。' } }),
    fact('approval_c8_irrigation_001', 'approval_request_v1', { approval_request_id: 'approval_c8_irrigation_001', recommendation_id: 'rec_c8_irrigation_001', field_id: 'field_c8_demo', status: 'APPROVED' }),
    fact('approval_decision_c8_irrigation_001', 'approval_decision_v1', { decision_id: 'approval_decision_c8_irrigation_001', approval_request_id: 'approval_c8_irrigation_001', decision: 'APPROVED', decided_by: 'controlled_pilot_operator' }),
    fact('op_plan_c8_irrigation_formal_001', 'operation_plan_v1', { operation_plan_id: 'op_plan_c8_irrigation_formal_001', field_id: 'field_c8_demo', season_id: 'season_2026_c8_corn', operation_type: 'IRRIGATION', action_type: 'IRRIGATION', recommendation_id: 'rec_c8_irrigation_001', approval_request_id: 'approval_c8_irrigation_001', act_task_id: 'act_c8_irrigation_formal_001', spatial_scope: { kind: 'field', field_id: 'field_c8_demo', source: 'controlled_pilot_full_review' }, before_metrics: { soil_moisture: 18.4 }, after_metrics: { soil_moisture: 24.8 }, reason_codes: ['soil_moisture_below_threshold', 'no_rain_forecast'], final_status: 'SUCCESS' }),
    ...['CREATED','APPROVED','READY','DISPATCHED','SUCCEEDED'].map((state, i) => fact(`op_plan_c8_irrigation_formal_001_transition_${i+1}`, 'operation_plan_transition_v1', { operation_plan_id: 'op_plan_c8_irrigation_formal_001', field_id: 'field_c8_demo', transition: state, ts_ms: now - (50 - i * 8) * 60 * 1000 })),
    fact('act_c8_irrigation_formal_001', 'ao_act_task_v0', { act_task_id: 'act_c8_irrigation_formal_001', operation_plan_id: 'op_plan_c8_irrigation_formal_001', field_id: 'field_c8_demo', device_id: 'dev_valve_pump_c8_001', action_type: 'IRRIGATION', status: 'ACKED', meta: { device_id: 'dev_valve_pump_c8_001', field_id: 'field_c8_demo' } }),
    fact('receipt_c8_irrigation_formal_001', 'ao_act_receipt_v1', { receipt_id: 'receipt_c8_irrigation_formal_001', act_task_id: 'act_c8_irrigation_formal_001', operation_plan_id: 'op_plan_c8_irrigation_formal_001', status: 'SUCCEEDED', metrics: [{ kind: 'water_delivery_receipt', source_lane: 'FORMAL_OPERATION', formal_eligible: true, is_simulated: false, water_mm_actual: 21.6 }], logs_refs: [{ kind: 'valve_open_confirmation', source_lane: 'FORMAL_OPERATION', formal_eligible: true, is_simulated: false }] }),
    fact('ev_c8_irrigation_water_delivery_001', 'evidence_artifact_v1', { evidence_id: 'ev_c8_irrigation_water_delivery_001', operation_plan_id: 'op_plan_c8_irrigation_formal_001', act_task_id: 'act_c8_irrigation_formal_001', field_id: 'field_c8_demo', kind: 'water_delivery_receipt', source_lane: 'FORMAL_OPERATION', formal_eligible: true, is_simulated: false, evidence_level: 'FORMAL' }),
    fact('ev_c8_irrigation_metric_001', 'evidence_artifact_v1', { evidence_id: 'ev_c8_irrigation_metric_001', operation_plan_id: 'op_plan_c8_irrigation_formal_001', act_task_id: 'act_c8_irrigation_formal_001', field_id: 'field_c8_demo', kind: 'metric', source_lane: 'FORMAL_OPERATION', formal_eligible: true, is_simulated: false, evidence_level: 'FORMAL' }),
    fact('acc_c8_irrigation_formal_001', 'acceptance_result_v1', { acceptance_id: 'acc_c8_irrigation_formal_001', operation_plan_id: 'op_plan_c8_irrigation_formal_001', act_task_id: 'act_c8_irrigation_formal_001', field_id: 'field_c8_demo', verdict: 'PASS', formal_acceptance: true, formal_evidence_passed: true, source_lane: 'FORMAL_OPERATION', customer_visible_eligible: true, is_simulated: false, summary: '灌溉后土壤水分回升，达到预期。' }),
    fact('value_c8_irrigation_formal_001', 'value_record_v1', { value_record_id: 'value_c8_irrigation_formal_001', operation_plan_id: 'op_plan_c8_irrigation_formal_001', field_id: 'field_c8_demo', value_text: '灌溉后土壤水分回升，形成可信价值记录。', customer_visible_eligible: true }),
    fact('rec_c8_irrigation_pending_001', 'decision_recommendation_v1', { recommendation_id: 'rec_c8_irrigation_pending_001', field_id: 'field_c8_demo', season_id: 'season_2026_c8_corn', crop_code: 'corn', crop_stage: '营养生长期', rule_id: 'irrigation_followup_v1', skill_id: 'agronomy_irrigation_v1', reason_codes: ['soil_moisture_followup'], suggested_action: { action_type: 'IRRIGATION', water_mm: 12 }, explain: { human: 'C8 灌溉示范田局部区域仍需跟踪，建议小水量补灌后等待正式验收。' } }),
    fact('approval_c8_irrigation_pending_001', 'approval_request_v1', { approval_request_id: 'approval_c8_irrigation_pending_001', recommendation_id: 'rec_c8_irrigation_pending_001', field_id: 'field_c8_demo', status: 'APPROVED' }),
    fact('op_plan_c8_irrigation_pending_001', 'operation_plan_v1', { operation_plan_id: 'op_plan_c8_irrigation_pending_001', field_id: 'field_c8_demo', operation_type: 'IRRIGATION', action_type: 'IRRIGATION', recommendation_id: 'rec_c8_irrigation_pending_001', approval_request_id: 'approval_c8_irrigation_pending_001', spatial_scope: { kind: 'field', field_id: 'field_c8_demo', source: 'controlled_pilot_full_review' }, final_status: 'PENDING_ACCEPTANCE', acceptance: 'NEEDS_FORMAL_ACCEPTANCE' }),
    ...['CREATED','APPROVED','DISPATCHED','SUCCEEDED'].map((state, i) => fact(`op_plan_c8_irrigation_pending_001_transition_${i+1}`, 'operation_plan_transition_v1', { operation_plan_id: 'op_plan_c8_irrigation_pending_001', field_id: 'field_c8_demo', transition: state, ts_ms: now - (35 - i * 6) * 60 * 1000 })),
    fact('act_c8_irrigation_pending_001', 'ao_act_task_v0', { act_task_id: 'act_c8_irrigation_pending_001', operation_plan_id: 'op_plan_c8_irrigation_pending_001', field_id: 'field_c8_demo', device_id: 'dev_valve_pump_c8_001', action_type: 'IRRIGATION', status: 'DISPATCHED', meta: { device_id: 'dev_valve_pump_c8_001', field_id: 'field_c8_demo' } }),
    fact('receipt_c8_irrigation_pending_001', 'ao_act_receipt_v1', { receipt_id: 'receipt_c8_irrigation_pending_001', act_task_id: 'act_c8_irrigation_pending_001', operation_plan_id: 'op_plan_c8_irrigation_pending_001', status: 'SUCCEEDED', metrics: [{ kind: 'water_delivery_receipt', source_lane: 'FORMAL_OPERATION', formal_eligible: true, is_simulated: false, water_mm_actual: 11.8 }] }),
    fact('acc_c8_irrigation_pending_001', 'acceptance_result_v1', { acceptance_id: 'acc_c8_irrigation_pending_001', operation_plan_id: 'op_plan_c8_irrigation_pending_001', act_task_id: 'act_c8_irrigation_pending_001', field_id: 'field_c8_demo', verdict: 'PENDING', formal_acceptance: false, formal_evidence_passed: false, summary: '作业已完成，等待验收。' }),
    fact('rec_c8_pest_inspection_pending_001', 'decision_recommendation_v1', { recommendation_id: 'rec_c8_pest_inspection_pending_001', field_id: 'field_c8_demo', crop_code: 'corn', rule_id: 'pest_inspection_signal_v1', skill_id: 'agronomy_pest_inspection_v1', suggested_action: { action_type: 'PEST_INSPECTION' }, explain: { human: 'C8 灌溉示范田出现巡检线索，需要运营复核，不作为正式验收或收益结论。' } }),
    fact('approval_c8_pest_pending_001', 'approval_request_v1', { approval_request_id: 'approval_c8_pest_pending_001', recommendation_id: 'rec_c8_pest_inspection_pending_001', field_id: 'field_c8_demo', status: 'PENDING' }),
    ...['before_recommendation','after_recommendation','before_dispatch','before_acceptance'].map((stage) => fact(`skill_run_${stage}_001`, 'skill_run_v1', { skill_run_id: `skill_run_${stage}_001`, stage, field_id: 'field_c8_demo', operation_plan_id: 'op_plan_c8_irrigation_formal_001', result_status: 'SUCCESS' })),
    fact('marker_aggregate_missing_location_001', 'controlled_pilot_full_review_marker_v1', { marker_id: 'aggregate_missing_location_001', scenario: 'D', source: 'aggregate', device_id: null, field_id: null, status: 'READ_ONLY', customer_visible_eligible: false, message: '缺少设备定位信息；当前处理阶段：排查入口；只读；不会直接恢复设备；不会自动生成正式作业成功、客户价值结论或田块记忆。' }),
    fact('marker_negative_field_binding_001', 'controlled_pilot_full_review_marker_v1', { marker_id: 'negative_field_binding_001', scenario: 'F', negative_case_only: true, expected_error: 'NEEDS_FIELD_BINDING', applied: false }),
  ];
  for (const t of telemetry) facts.push(fact(t.fact_id.replace(`${prefix}_`, ''), 'telemetry_observation_v1', { device_id: t.device_id, field_id: t.field_id, metric: t.metric, value_num: t.value_num, unit: t.unit, observed_at_ts_ms: t.ts_ms }));
  const manifest = fact('manifest_v1', 'controlled_pilot_full_review_manifest_v1', { seed_owned_by: SOURCE_LANE, seed_owned_ids: { fields: fields.map(x => x.field_id), devices: devices.map(x => x.device_id), operations: ['op_plan_c8_irrigation_formal_001', 'op_plan_c8_irrigation_pending_001'], recommendations: ['rec_c8_irrigation_001', 'rec_c8_irrigation_pending_001', 'rec_c8_pest_inspection_pending_001'], approval_requests: ['approval_c8_irrigation_001', 'approval_c8_irrigation_pending_001', 'approval_c8_pest_pending_001'], act_tasks: ['act_c8_irrigation_formal_001', 'act_c8_irrigation_pending_001'], receipts: ['receipt_c8_irrigation_formal_001', 'receipt_c8_irrigation_pending_001'], evidence: ['ev_c8_irrigation_water_delivery_001', 'ev_c8_irrigation_metric_001'], acceptance: ['acc_c8_irrigation_formal_001', 'acc_c8_irrigation_pending_001'], field_memory: ['fm_c8_irrigation_response_001'], alerts: ['alert_dev_gateway_offline_001'] }, created_at: iso, updated_at: iso });
  facts.push(manifest);
  const fieldMemory = [{ memory_id: 'fm_c8_irrigation_response_001', field_id: 'field_c8_demo', operation_id: 'op_plan_c8_irrigation_formal_001', memory_type: 'FIELD_RESPONSE_MEMORY', summary_text: 'C8 地块灌溉后 20cm 土层水分回升明显，后续建议继续跟踪。', source_type: 'controlled_pilot_full_review', source_id: 'op_plan_c8_irrigation_formal_001', confidence: 0.86, acceptance_id: 'acc_c8_irrigation_formal_001', created_at: now }];
  const alerts = [{ event_id: 'alert_dev_gateway_offline_001', rule_id: 'device_heartbeat_timeout_v1', object_type: 'DEVICE', object_id: 'dev_gateway_offline_001', metric: 'heartbeat_timeout', status: 'OPEN', raised_ts_ms: now - 2 * 60 * 60 * 1000, last_value_json: { online_status: 'OFFLINE', field_id: 'field_device_risk_demo' } }];
  return { tenant, now, fields, polygons, devices, telemetry, facts, fieldMemory, alerts };
}

function planned(plan) {
  return { ok: true, apply: false, tenant: plan.tenant, project_id: PROJECT_ID, group_id: GROUP_ID, source_lane: SOURCE_LANE, dataset_version: DATASET_VERSION, planned: { facts: 0, tables: { field_index_v1: plan.fields.length, field_polygon_v1: plan.polygons.length, device_index_v1: plan.devices.length, device_binding_index_v1: plan.devices.length, device_status_index_v1: plan.devices.length, device_capability: plan.devices.length, telemetry_index_v1: plan.telemetry.length, device_observation_index_v1: plan.telemetry.length, alert_event_index_v1: plan.alerts.length, field_memory_v1: plan.fieldMemory.length }, scenarios: ['A_FORMAL_IRRIGATION_PASS', 'B_IRRIGATION_PENDING_ACCEPTANCE', 'C_BOUND_DEVICE_OFFLINE', 'D_AGGREGATE_MISSING_LOCATION_READ_ONLY', 'E_PEST_INSPECTION_PENDING_APPROVAL', 'F_NEGATIVE_FIELD_BINDING_VERIFY_ONLY', 'G_CUSTOMER_REPORTS_CENTER'] }, planned_counts: { fields: plan.fields.length, devices: plan.devices.length, formal_operations: 1, pending_operations: 1, recommendations: 3, approval_requests: 3, receipts: 2, formal_evidence: 2, acceptance_results: 2, field_memory: 1, device_offline_cases: 2, negative_cases: 1 }, warnings: [] };
}

function assertNoPlaceholders(plan) {
  const text = JSON.stringify(plan);
  if (/field_id=\.\.\.|device_id=\.\.\.|"\.\.\."/.test(text)) throw new Error('placeholder id detected');
  if (/flight-table|flight_table|sim_trace|dev_source/i.test(text)) throw new Error('forbidden dev evidence marker detected');
}

function pool() { return new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgres://postgres:postgres@127.0.0.1:5432/geox' }); }
async function q(client, text, params = []) { return client.query(text, params); }
async function tableExists(client, table) { const r = await q(client, `SELECT to_regclass($1) AS name`, [table]); return Boolean(r.rows[0]?.name); }
async function requiredTables(client) { const tables = ['facts','field_index_v1','field_polygon_v1','device_index_v1','device_binding_index_v1','device_status_index_v1','device_capability','telemetry_index_v1','device_observation_index_v1','alert_event_index_v1','field_memory_v1']; const missing = []; for (const t of tables) if (!(await tableExists(client, t))) missing.push(t); return missing; }

async function upsertAll(client, plan) {
  const t = plan.tenant;
  for (const f of plan.fields) await q(client, `INSERT INTO field_index_v1 (tenant_id, field_id, field_name, name, area_m2, area_ha, status, created_ts_ms, updated_ts_ms) VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$7) ON CONFLICT (tenant_id, field_id) DO UPDATE SET field_name=EXCLUDED.field_name, name=EXCLUDED.name, area_m2=EXCLUDED.area_m2, area_ha=EXCLUDED.area_ha, status=EXCLUDED.status, updated_ts_ms=EXCLUDED.updated_ts_ms`, [t, f.field_id, f.field_name, f.area_m2, f.area_ha, f.status, plan.now]);
  for (const p of plan.polygons) await q(client, `INSERT INTO field_polygon_v1 (tenant_id, field_id, polygon_geojson_json, area_m2, created_ts_ms, updated_ts_ms) VALUES ($1,$2,$3,$4,$5,$5) ON CONFLICT (tenant_id, field_id) DO UPDATE SET polygon_geojson_json=EXCLUDED.polygon_geojson_json, area_m2=EXCLUDED.area_m2, updated_ts_ms=EXCLUDED.updated_ts_ms`, [t, p.field_id, JSON.stringify(p.polygon_geojson_json), p.area_m2, plan.now]);
  for (const d of plan.devices) {
    await q(client, `INSERT INTO device_index_v1 (tenant_id, device_id, display_name, created_ts_ms, last_credential_status) VALUES ($1,$2,$3,$4,'ACTIVE') ON CONFLICT (tenant_id, device_id) DO UPDATE SET display_name=EXCLUDED.display_name, last_credential_status=EXCLUDED.last_credential_status`, [t, d.device_id, d.display_name, plan.now]);
    await q(client, `INSERT INTO device_binding_index_v1 (tenant_id, device_id, field_id, bound_ts_ms) VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id, device_id, field_id) DO UPDATE SET bound_ts_ms=EXCLUDED.bound_ts_ms`, [t, d.device_id, d.field_id, plan.now]);
    await q(client, `INSERT INTO device_status_index_v1 (tenant_id, project_id, group_id, device_id, last_telemetry_ts_ms, last_heartbeat_ts_ms, battery_percent, rssi_dbm, fw_ver, updated_ts_ms) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'seed-v1',$9) ON CONFLICT (tenant_id, device_id) DO UPDATE SET project_id=EXCLUDED.project_id, group_id=EXCLUDED.group_id, last_telemetry_ts_ms=EXCLUDED.last_telemetry_ts_ms, last_heartbeat_ts_ms=EXCLUDED.last_heartbeat_ts_ms, battery_percent=EXCLUDED.battery_percent, rssi_dbm=EXCLUDED.rssi_dbm, fw_ver=EXCLUDED.fw_ver, updated_ts_ms=EXCLUDED.updated_ts_ms`, [t, PROJECT_ID, GROUP_ID, d.device_id, d.telemetry, d.heartbeat, d.battery, d.rssi, plan.now]);
    await q(client, `INSERT INTO device_capability (tenant_id, device_id, capabilities, updated_ts_ms) VALUES ($1,$2,$3::jsonb,$4) ON CONFLICT (tenant_id, device_id) DO UPDATE SET capabilities=EXCLUDED.capabilities, updated_ts_ms=EXCLUDED.updated_ts_ms`, [t, d.device_id, JSON.stringify(d.capabilities), plan.now]);
  }
  for (const x of plan.telemetry) {
    const ts = new Date(x.ts_ms).toISOString();
    await q(client, `INSERT INTO telemetry_index_v1 (tenant_id, device_id, metric, ts, value_num, value_text, fact_id) VALUES ($1,$2,$3,$4,$5,NULL,$6) ON CONFLICT (tenant_id, device_id, metric, ts) DO UPDATE SET value_num=EXCLUDED.value_num, fact_id=EXCLUDED.fact_id`, [t, x.device_id, x.metric, ts, x.value_num, x.fact_id]);
    await q(client, `INSERT INTO device_observation_index_v1 (tenant_id, project_id, group_id, device_id, field_id, metric, observed_at, observed_at_ts_ms, value_num, value_text, unit, confidence, quality_flags_json, fact_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,$10,0.95,'[]'::jsonb,$11) ON CONFLICT (tenant_id, device_id, metric, observed_at_ts_ms) DO UPDATE SET field_id=EXCLUDED.field_id, value_num=EXCLUDED.value_num, unit=EXCLUDED.unit, confidence=EXCLUDED.confidence, quality_flags_json=EXCLUDED.quality_flags_json, fact_id=EXCLUDED.fact_id`, [t, PROJECT_ID, GROUP_ID, x.device_id, x.field_id, x.metric, ts, x.ts_ms, x.value_num, x.unit, x.fact_id]);
  }
  for (const a of plan.alerts) await q(client, `INSERT INTO alert_event_index_v1 (tenant_id, event_id, rule_id, object_type, object_id, metric, status, raised_ts_ms, acked_ts_ms, closed_ts_ms, last_value_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,NULL,$9) ON CONFLICT (tenant_id, event_id) DO UPDATE SET status=EXCLUDED.status, raised_ts_ms=EXCLUDED.raised_ts_ms, last_value_json=EXCLUDED.last_value_json`, [t, a.event_id, a.rule_id, a.object_type, a.object_id, a.metric, a.status, a.raised_ts_ms, JSON.stringify(a.last_value_json)]);
  for (const m of plan.fieldMemory) await q(client, `INSERT INTO field_memory_v1 (memory_id, tenant_id, project_id, group_id, field_id, operation_id, recommendation_id, memory_type, summary, summary_text, metrics, skill_refs, evidence_refs, created_at, confidence, source_type, source_id, acceptance_id, occurred_at) VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8,$8,'{}'::jsonb,'[]'::jsonb,'[]'::jsonb,$9,$10,$11,$12,$13,now()) ON CONFLICT (memory_id) DO UPDATE SET summary_text=EXCLUDED.summary_text, confidence=EXCLUDED.confidence, source_type=EXCLUDED.source_type, source_id=EXCLUDED.source_id, acceptance_id=EXCLUDED.acceptance_id`, [m.memory_id, t, PROJECT_ID, GROUP_ID, m.field_id, m.operation_id, m.memory_type, m.summary_text, m.created_at, m.confidence, m.source_type, m.source_id, m.acceptance_id]);
  for (const f of plan.facts) await q(client, `INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT (fact_id) DO UPDATE SET occurred_at=EXCLUDED.occurred_at, source=EXCLUDED.source, record_json=EXCLUDED.record_json`, [f.fact_id, f.occurred_at, f.source, JSON.stringify(f.record_json)]);
}

async function withClient(fn) { const p = pool(); const c = await p.connect(); try { return await fn(c); } finally { c.release(); await p.end(); } }
async function apply(plan) { return withClient(async (client) => { const missing = await requiredTables(client); if (missing.length) throw new Error(`missing tables: ${missing.join(',')}`); let locked = false; await q(client, `SELECT pg_advisory_lock(hashtext('CONTROLLED_PILOT_FULL_REVIEW_V1:' || $1::text))`, [plan.tenant]); locked = true; try { await q(client, 'BEGIN'); await upsertAll(client, plan); await q(client, 'COMMIT'); return { ok: true, apply: true, tenant: plan.tenant, source_lane: SOURCE_LANE, dataset_version: DATASET_VERSION, written: { facts: plan.facts.length, fields: plan.fields.length, devices: plan.devices.length, field_memory: plan.fieldMemory.length, alerts: plan.alerts.length }, warnings: [] }; } catch (e) { await q(client, 'ROLLBACK').catch(() => undefined); throw e; } finally { if (locked) await q(client, `SELECT pg_advisory_unlock(hashtext('CONTROLLED_PILOT_FULL_REVIEW_V1:' || $1::text))`, [plan.tenant]).catch(() => undefined); } }); }
async function verify(plan) { return withClient(async (client) => { const missing = await requiredTables(client); if (missing.length) throw new Error(`missing tables: ${missing.join(',')}`); const checks = {}; const one = async (name, sql, params) => { const r = await q(client, sql, params); checks[name] = Number(r.rows[0]?.count || 0); if (checks[name] < 1) throw new Error(`verify failed: ${name}`); };
  await one('manifest', `SELECT count(*) FROM facts WHERE fact_id=$1 AND record_json->>'type'='controlled_pilot_full_review_manifest_v1'`, [`full_review_seed_${plan.tenant}_manifest_v1`]);
  await one('c8_field', `SELECT count(*) FROM field_index_v1 WHERE tenant_id=$1 AND field_id='field_c8_demo' AND COALESCE(field_name,name)='C8 灌溉示范田'`, [plan.tenant]);
  await one('c8_polygon', `SELECT count(*) FROM field_polygon_v1 WHERE tenant_id=$1 AND field_id='field_c8_demo' AND polygon_geojson_json IS NOT NULL`, [plan.tenant]);
  await one('offline_device', `SELECT count(*) FROM device_status_index_v1 WHERE tenant_id=$1 AND device_id='dev_gateway_offline_001' AND last_heartbeat_ts_ms <= $2`, [plan.tenant, Date.now() - 90 * 60 * 1000]);
  await one('offline_binding', `SELECT count(*) FROM device_binding_index_v1 WHERE tenant_id=$1 AND device_id='dev_gateway_offline_001' AND field_id='field_device_risk_demo'`, [plan.tenant]);
  await one('formal_operation_fact', `SELECT count(*) FROM facts WHERE fact_id LIKE $1 AND record_json->'payload'->>'operation_plan_id'='op_plan_c8_irrigation_formal_001'`, [`full_review_seed_${plan.tenant}_%`]);
  await one('formal_evidence', `SELECT count(*) FROM facts WHERE fact_id LIKE $1 AND record_json->>'type'='evidence_artifact_v1' AND record_json->'payload'->>'source_lane'='FORMAL_OPERATION'`, [`full_review_seed_${plan.tenant}_%`]);
  await one('formal_acceptance', `SELECT count(*) FROM facts WHERE fact_id LIKE $1 AND record_json->>'type'='acceptance_result_v1' AND record_json->'payload'->>'acceptance_id'='acc_c8_irrigation_formal_001' AND record_json->'payload'->>'formal_acceptance'='true'`, [`full_review_seed_${plan.tenant}_%`]);
  await one('field_memory', `SELECT count(*) FROM field_memory_v1 WHERE tenant_id=$1 AND memory_id='fm_c8_irrigation_response_001'`, [plan.tenant]);
  return { ok: true, apply: false, verify: true, tenant: plan.tenant, checks, warnings: [] };
}); }

async function cleanup(plan, doApply) { return withClient(async (client) => { const manifestId = `full_review_seed_${plan.tenant}_manifest_v1`; const r = await q(client, `SELECT record_json FROM facts WHERE fact_id=$1`, [manifestId]); const owned = r.rows[0]?.record_json?.payload?.seed_owned_ids || {}; if (!doApply) return { ok: true, cleanup: true, apply: false, tenant: plan.tenant, seed_owned_ids: owned, warnings: ['cleanup dry-run only; pass --cleanup --apply --tenant to delete seed-owned rows'] }; let locked = false; await q(client, `SELECT pg_advisory_lock(hashtext('CONTROLLED_PILOT_FULL_REVIEW_V1:' || $1::text))`, [plan.tenant]); locked = true; try { await q(client, 'BEGIN'); await q(client, `DELETE FROM field_memory_v1 WHERE tenant_id=$1 AND memory_id = ANY($2::text[])`, [plan.tenant, owned.field_memory || []]); await q(client, `DELETE FROM alert_event_index_v1 WHERE tenant_id=$1 AND event_id = ANY($2::text[])`, [plan.tenant, owned.alerts || []]); await q(client, `DELETE FROM device_observation_index_v1 WHERE tenant_id=$1 AND fact_id LIKE $2`, [plan.tenant, `full_review_seed_${plan.tenant}_%`]); await q(client, `DELETE FROM telemetry_index_v1 WHERE tenant_id=$1 AND fact_id LIKE $2`, [plan.tenant, `full_review_seed_${plan.tenant}_%`]); await q(client, `DELETE FROM device_capability WHERE tenant_id=$1 AND device_id = ANY($2::text[])`, [plan.tenant, owned.devices || []]); await q(client, `DELETE FROM device_status_index_v1 WHERE tenant_id=$1 AND device_id = ANY($2::text[])`, [plan.tenant, owned.devices || []]); await q(client, `DELETE FROM device_binding_index_v1 WHERE tenant_id=$1 AND device_id = ANY($2::text[])`, [plan.tenant, owned.devices || []]); await q(client, `DELETE FROM device_index_v1 WHERE tenant_id=$1 AND device_id = ANY($2::text[])`, [plan.tenant, owned.devices || []]); await q(client, `DELETE FROM field_polygon_v1 WHERE tenant_id=$1 AND field_id = ANY($2::text[])`, [plan.tenant, owned.fields || []]); await q(client, `DELETE FROM field_index_v1 WHERE tenant_id=$1 AND field_id = ANY($2::text[])`, [plan.tenant, owned.fields || []]); await q(client, `DELETE FROM facts WHERE fact_id LIKE $1`, [`full_review_seed_${plan.tenant}_%`]); await q(client, 'COMMIT'); return { ok: true, cleanup: true, apply: true, tenant: plan.tenant, warnings: [] }; } catch (e) { await q(client, 'ROLLBACK').catch(() => undefined); throw e; } finally { if (locked) await q(client, `SELECT pg_advisory_unlock(hashtext('CONTROLLED_PILOT_FULL_REVIEW_V1:' || $1::text))`, [plan.tenant]).catch(() => undefined); } }); }

async function main() {
  const args = parseArgs(process.argv);
  const plan = nowPlan(args.tenant);
  assertNoPlaceholders(plan);
  if (args.mode === 'dry-run') return console.log(JSON.stringify(planned(plan), null, 2));
  if (args.mode === 'verify') return console.log(JSON.stringify(await verify(plan), null, 2));
  if (args.mode === 'cleanup') return console.log(JSON.stringify(await cleanup(plan, Boolean(args.apply)), null, 2));
  if (args.apply) return console.log(JSON.stringify(await apply(plan), null, 2));
  return console.log(JSON.stringify(planned(plan), null, 2));
}

main().catch((err) => { console.error(JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) }, null, 2)); process.exit(1); });
