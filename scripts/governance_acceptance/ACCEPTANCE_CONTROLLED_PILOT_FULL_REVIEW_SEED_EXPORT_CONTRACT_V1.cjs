#!/usr/bin/env node
'use strict';
const { spawnSync } = require('node:child_process');
const SEED = 'scripts/demo_seed/SEED_CONTROLLED_PILOT_FULL_REVIEW_V1.cjs';
const CHAIN = 'C8_FORMAL_IRRIGATION_FULL_CHAIN_V1';
const FORMAL_OP = 'op_plan_c8_irrigation_formal_001';
const PENDING_OP = 'op_plan_c8_irrigation_pending_001';
const FORMAL_REQUIREMENT = 'ireq_c8_irrigation_001';
const SENSING_WINDOW_ID = 'sw_c8_soil_moisture_001';
const SENSING_WINDOW_FAIL_ID = 'sw_c8_soil_moisture_fail_001';
const SENSING_WINDOW_LAST_OBSERVATION_REF = 'telemetry_soil_moisture_window_c8_006';
const FIXED_NOW_MS_ARGS = ['--now-ms', '1710000000000'];
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
function payloads(exported, type) { return Array.isArray(exported?.facts_by_type?.[type]) ? exported.facts_by_type[type].map((x) => x.record_json?.payload || {}) : []; }
function ids(list, key) { return (list || []).map((x) => String(x?.[key] || '')).filter(Boolean); }
function assertFormalChain(exported) {
  const c = exported.formal_chain || {};
  must(exported.ok === true && exported.chain_id === CHAIN && c.chain_id === CHAIN, 'chain id invalid', exported);
  for (const k of ['field','boundary','irrigation_requirement','devices','observations','diagnosis','recommendation','prescription','approval','operation_plan','ao_act_task','receipt','as_executed_expected','as_applied_expected','evidence','acceptance','roi','field_memory','production_evidence','report_expectations']) must(c[k] !== undefined, `formal_chain missing ${k}`);
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
  must(c.irrigation_requirement?.requirement_id === FORMAL_REQUIREMENT, 'irrigation requirement id invalid', c.irrigation_requirement);
  must(c.irrigation_requirement?.source_forecast_id === 'wf_c8_irrigation_001', 'irrigation requirement forecast binding invalid', c.irrigation_requirement);
  must(c.irrigation_requirement?.skill_id === 'irrigation_requirement_skill_v1', 'irrigation requirement skill invalid', c.irrigation_requirement);
  must(close(c.irrigation_requirement?.gross_irrigation_mm, 22), 'irrigation requirement gross amount invalid', c.irrigation_requirement);
  must(close(c.irrigation_requirement?.gross_irrigation_requirement_mm, 22), 'irrigation requirement gross requirement amount invalid', c.irrigation_requirement);
  must(c.irrigation_requirement?.unit === 'mm', 'irrigation requirement unit invalid', c.irrigation_requirement);
  must(c.irrigation_requirement_skill_input?.skill_input_id === 'iskill_input_c8_irrigation_001', 'irrigation skill input id invalid', c.irrigation_requirement_skill_input);
  must(c.irrigation_requirement_skill_input?.input_source === 'projected_fact_bindings_v1', 'irrigation skill input source invalid', c.irrigation_requirement_skill_input);
  must(c.irrigation_requirement_skill_input?.source_refs?.weather_forecast_id === 'wf_c8_irrigation_001', 'irrigation skill input weather binding invalid', c.irrigation_requirement_skill_input);
  must(c.irrigation_requirement_skill_input?.source_refs?.sensing_window_id === SENSING_WINDOW_ID, 'irrigation skill input sensing_window_id invalid', c.irrigation_requirement_skill_input);
  must(c.irrigation_requirement_skill_input?.source_refs?.sensing_window_quality_status === 'PASS', 'irrigation skill input sensing_window_quality_status invalid', c.irrigation_requirement_skill_input);
  must(c.irrigation_requirement_skill_input?.source_refs?.observation_refs?.soil_moisture_percent === SENSING_WINDOW_LAST_OBSERVATION_REF, 'irrigation skill input soil binding invalid', c.irrigation_requirement_skill_input);
  must(c.irrigation_requirement?.calculation_method === 'irrigation_requirement_skill_v1', 'irrigation requirement calculation_method invalid', c.irrigation_requirement);
  must(c.irrigation_requirement?.quality?.status === 'SKILL_CALCULATED', 'irrigation requirement quality status invalid', c.irrigation_requirement?.quality);
  must(c.irrigation_requirement?.calculation_trace?.formula_version === 'irrigation_requirement_skill_v1', 'irrigation requirement formula invalid', c.irrigation_requirement?.calculation_trace);
  must(c.irrigation_requirement?.calculation_inputs?.input_source === 'projected_fact_bindings_v1', 'irrigation requirement input_source invalid', c.irrigation_requirement?.calculation_inputs);
  must(c.irrigation_requirement?.calculation_inputs?.source_input_id === 'iskill_input_c8_irrigation_001', 'irrigation requirement source_input_id invalid', c.irrigation_requirement?.calculation_inputs);
  must(c.irrigation_requirement?.calculation_inputs?.source_refs?.weather_forecast_id === 'wf_c8_irrigation_001', 'irrigation requirement weather source binding invalid', c.irrigation_requirement?.calculation_inputs);
  must(c.irrigation_requirement?.calculation_inputs?.source_refs?.sensing_window_id === SENSING_WINDOW_ID, 'irrigation requirement sensing window source binding invalid', c.irrigation_requirement?.calculation_inputs);
  must(c.irrigation_requirement?.calculation_inputs?.source_refs?.sensing_window_quality_status === 'PASS', 'irrigation requirement sensing window status invalid', c.irrigation_requirement?.calculation_inputs);
  must(c.irrigation_requirement?.calculation_inputs?.source_refs?.observation_refs?.soil_moisture_percent === SENSING_WINDOW_LAST_OBSERVATION_REF, 'irrigation requirement soil source binding invalid', c.irrigation_requirement?.calculation_inputs);
  must(c.irrigation_requirement?.quality?.source_binding_status === 'BOUND_TO_PROJECTED_FACTS', 'irrigation requirement source binding status invalid', c.irrigation_requirement?.quality);
  must(c.irrigation_requirement?.quality?.derivation_status === 'DERIVED_FROM_FORMAL_SKILL_INPUT', 'irrigation requirement derivation status invalid', c.irrigation_requirement?.quality);
  must(c.irrigation_requirement?.derivation?.source_input_id === 'iskill_input_c8_irrigation_001', 'irrigation requirement derivation source_input_id invalid', c.irrigation_requirement?.derivation);
  must(c.irrigation_requirement?.derivation?.source_type === 'irrigation_requirement_skill_input_v1', 'irrigation requirement derivation source_type invalid', c.irrigation_requirement?.derivation);
  must(close(c.irrigation_requirement?.calculation_trace?.soil_water_deficit_mm, 16.8), 'irrigation requirement soil water deficit invalid', c.irrigation_requirement?.calculation_trace);
  must(close(c.irrigation_requirement?.calculation_trace?.et0_adjustment_mm, 3.9), 'irrigation requirement et0 adjustment invalid', c.irrigation_requirement?.calculation_trace);
  must(close(c.irrigation_requirement?.net_irrigation_mm, 18.7), 'irrigation requirement net amount invalid', c.irrigation_requirement);
  const requirementAmountMm = Number(c.irrigation_requirement?.gross_irrigation_requirement_mm);
  must(close(c.recommendation?.suggested_action?.water_mm, requirementAmountMm), 'recommendation amount must follow irrigation requirement', c.recommendation);
  must(close(c.recommendation?.suggested_action?.amount_mm, requirementAmountMm), 'recommendation amount_mm must follow irrigation requirement', c.recommendation);
  must(c.recommendation?.suggested_action?.amount_source?.requirement_id === FORMAL_REQUIREMENT, 'recommendation amount source invalid', c.recommendation?.suggested_action);
  must(c.prescription?.prescription_id === 'presc_c8_irrigation_001' && close(c.prescription?.operation_amount?.amount, requirementAmountMm) && c.prescription?.operation_amount?.unit === 'mm' && c.prescription?.operation_amount?.metadata?.requirement_id === FORMAL_REQUIREMENT, 'prescription invalid', c.prescription);
  must(c.operation_plan?.operation_plan_id === FORMAL_OP && c.operation_plan?.prescription_id === 'presc_c8_irrigation_001' && close(c.operation_plan?.planned_amount, requirementAmountMm) && c.operation_plan?.planned_amount_source?.requirement_id === FORMAL_REQUIREMENT && all(c.operation_plan?.expected_evidence, ['water_delivery_receipt','post_soil_moisture_metric']), 'operation plan invalid', c.operation_plan);
  must(c.ao_act_task?.act_task_id === 'act_c8_irrigation_formal_001' && close(c.ao_act_task?.parameters?.amount, requirementAmountMm) && close(c.ao_act_task?.parameters?.amount_mm, requirementAmountMm) && c.ao_act_task?.parameters?.amount_source?.requirement_id === FORMAL_REQUIREMENT && c.ao_act_task?.parameters?.target_soil_moisture_percent === 24 && all(c.ao_act_task?.evidence_requirements, ['water_delivery_receipt','post_soil_moisture_metric']), 'AO-ACT task invalid', c.ao_act_task);
  must(c.receipt?.receipt_id === 'receipt_c8_irrigation_formal_001' && c.receipt?.task_id === 'act_c8_irrigation_formal_001' && c.receipt?.status === 'executed' && close(c.receipt?.observed_parameters?.executed_amount, c.as_executed_expected?.executed_amount), 'receipt invalid', c.receipt);
  must(c.acceptance?.acceptance_id === 'acc_c8_irrigation_formal_001' && c.acceptance?.formal_acceptance === true && c.acceptance?.formal_evidence_passed === true && c.acceptance?.chain_validation_passed === true, 'acceptance invalid', c.acceptance);
  const pe = c.production_evidence || {};
  must(pe.production_evidence_id === 'prod_evidence_c8_irrigation_formal_001' && pe.operation_plan_id === FORMAL_OP && pe.act_task_id === 'act_c8_irrigation_formal_001' && pe.receipt_id === 'receipt_c8_irrigation_formal_001' && pe.acceptance_id === 'acc_c8_irrigation_formal_001', 'production evidence identity invalid', pe);
  must(all(pe.required_evidence_kinds, ['water_delivery_receipt','post_soil_moisture_metric']), 'production evidence required kinds invalid', pe);
  must(all(pe.observed_evidence_kinds, ['water_delivery_receipt','metric']), 'production evidence observed kinds invalid', pe);
  must(JSON.stringify(pe.evidence_artifact_ids || []) === JSON.stringify(c.receipt?.evidence_artifact_ids || []), 'production evidence artifact ids must follow receipt', pe);
  must(Array.isArray(pe.evidence_artifacts) && pe.evidence_artifacts.length === (c.evidence || []).length && pe.evidence_artifacts.every((x) => x.formal_eligible === true && x.is_simulated === false && x.source_lane === 'FORMAL_OPERATION'), 'production evidence artifacts must be formal non-simulated', pe.evidence_artifacts);
  must(pe.formal_evidence?.formal_eligible_count === (c.evidence || []).length && pe.formal_evidence?.simulated_count === 0 && pe.formal_evidence_passed === true, 'production evidence formal gate invalid', pe.formal_evidence);
  must(pe.acceptance?.acceptance_id === c.acceptance?.acceptance_id && pe.acceptance?.formal_acceptance === true && pe.acceptance?.formal_evidence_passed === true, 'production evidence acceptance mirror invalid', pe.acceptance);
  must(close(pe.as_executed_expected?.planned_amount, requirementAmountMm) && pe.as_executed_expected?.planned_amount_source?.requirement_id === FORMAL_REQUIREMENT && close(pe.as_executed_expected?.executed_amount, c.receipt?.observed_parameters?.executed_amount), 'production evidence as-executed mirror invalid', pe.as_executed_expected);
  must(c.as_executed_expected?.status === 'CONFIRMED' && close(c.as_executed_expected?.planned_amount, requirementAmountMm) && c.as_executed_expected?.planned_amount_source?.requirement_id === FORMAL_REQUIREMENT && close(c.as_executed_expected?.executed_amount, c.receipt?.observed_parameters?.executed_amount), 'as_executed expectation invalid', c.as_executed_expected);
  must(c.as_applied_expected?.field_id === 'field_c8_demo' && Number(c.as_applied_expected?.coverage_percent || 0) === 100, 'as_applied expectation invalid', c.as_applied_expected);
  must(c.roi?.source_lane === 'FORMAL_ACCEPTANCE' && c.roi?.trust_level === 'FORMAL_ACCEPTED' && c.roi?.customer_visible_value === true && c.roi?.formal_acceptance_id === 'acc_c8_irrigation_formal_001', 'formal ROI invalid', c.roi);
  must(c.field_memory?.memory_lane === 'FORMAL_FIELD_MEMORY' && c.field_memory?.trust_level === 'FORMAL_ACCEPTED' && c.field_memory?.customer_visible_memory === true && c.field_memory?.learning_eligible === true, 'formal field memory invalid', c.field_memory);
  must(all(c.report_expectations?.operation_report, ['diagnostic_inputs','prescription','as_executed','as_applied','production_evidence','roi_ledger','field_memory']), 'operation report expectations incomplete', c.report_expectations);
  must(all(c.report_expectations?.field_report, ['field_context','sensing_summary','decision_summary','execution_summary','value_summary','learning_summary']), 'field report expectations incomplete', c.report_expectations);
}

function assertSoilMoistureSensingWindowFixture(label, fixture, expectedStatus) {
  must(fixture?.window_id === (expectedStatus === 'PASS' ? SENSING_WINDOW_ID : SENSING_WINDOW_FAIL_ID), `${label} window_id invalid`, fixture);
  if (expectedStatus === 'PASS') {
    must(fixture.field_id === 'field_c8_demo', `${label} field_id invalid`, fixture);
    must(fixture.device_id === 'dev_soil_c8_001', `${label} device_id invalid`, fixture);
    must(fixture.metric === 'soil_moisture_percent', `${label} metric invalid`, fixture);
    must(Number(fixture.actual_points) >= 5, `${label} actual_points too low`, fixture);
    must(Number(fixture.coverage_ratio) >= 0.2, `${label} coverage_ratio too low`, fixture);
    must(Number(fixture.max_gap_ms) <= 900000, `${label} max_gap_ms too high`, fixture);
    must(fixture.quality_status === 'PASS', `${label} quality_status invalid`, fixture);
    must(fixture.confidence?.level === 'HIGH', `${label} confidence level invalid`, fixture?.confidence);
    must(close(fixture.summary?.last_value, 18.4), `${label} summary.last_value invalid`, fixture?.summary);
    must(Array.isArray(fixture.source_fact_ids) && fixture.source_fact_ids.length >= 5, `${label} source_fact_ids too short`, fixture?.source_fact_ids);
    must(Array.isArray(fixture.source_observation_ids) && fixture.source_observation_ids.length >= 5, `${label} source_observation_ids too short`, fixture?.source_observation_ids);
    return;
  }
  must(Number(fixture.actual_points) === 1, `${label} actual_points invalid`, fixture);
  must(Number(fixture.coverage_ratio) < 0.2, `${label} coverage_ratio must be below 0.2`, fixture);
  must(fixture.quality_status === 'FAIL', `${label} quality_status invalid`, fixture);
  must(fixture.confidence?.level === 'LOW', `${label} confidence level invalid`, fixture?.confidence);
}

function assertSoilMoistureSensingWindowExportContract(exported) {
  const c = exported.formal_chain || {};
  must(c.soil_moisture_sensing_window, 'formal_chain.soil_moisture_sensing_window missing', c);
  must(c.soil_moisture_sensing_window_negative_fixture, 'formal_chain.soil_moisture_sensing_window_negative_fixture missing', c);
  assertSoilMoistureSensingWindowFixture('formal_chain.soil_moisture_sensing_window', c.soil_moisture_sensing_window, 'PASS');
  assertSoilMoistureSensingWindowFixture('formal_chain.soil_moisture_sensing_window_negative_fixture', c.soil_moisture_sensing_window_negative_fixture, 'FAIL');
  must(c.irrigation_requirement_skill_input?.source_refs?.sensing_window_id === SENSING_WINDOW_ID, 'formal_chain skill input sensing_window_id mismatch', c.irrigation_requirement_skill_input?.source_refs);

  const passFact = payloads(exported, 'soil_moisture_sensing_window_v1').find((x) => x.window_id === SENSING_WINDOW_ID);
  const failFact = payloads(exported, 'soil_moisture_sensing_window_v1').find((x) => x.window_id === SENSING_WINDOW_FAIL_ID);
  assertSoilMoistureSensingWindowFixture('soil_moisture_sensing_window_v1 PASS fact', passFact, 'PASS');
  assertSoilMoistureSensingWindowFixture('soil_moisture_sensing_window_v1 FAIL fact', failFact, 'FAIL');
}

function assertC8Profile(exported, dry) {
  must(dry.profile === 'c8-formal-chain' && dry.planned_counts?.fields === 1 && dry.planned_counts?.devices === 3 && dry.planned_counts?.pending_operations === 0 && dry.planned_counts?.device_offline_cases === 0, 'c8 dry-run profile counts invalid', dry);
  must(exported.profile === 'c8-formal-chain', 'c8 export profile invalid', exported.profile);
  must(exported.formal_chain?.operation_plan?.operation_plan_id === FORMAL_OP, 'c8 formal operation id invalid', exported.formal_chain?.operation_plan);
  const fieldIds = ids(exported.tables?.field_index_v1, 'field_id');
  must(fieldIds.length === 1 && fieldIds[0] === 'field_c8_demo', 'c8 field table must contain only field_c8_demo', fieldIds);
  const opIds = payloads(exported, 'operation_plan_v1').map((x) => String(x.operation_plan_id || x.operation_id || ''));
  must(opIds.includes(FORMAL_OP), 'c8 operation facts missing formal op', opIds);
  must(!opIds.includes(PENDING_OP), 'c8 operation facts include pending op', opIds);
  must(ids(exported.tables?.device_index_v1, 'device_id').every((x) => x !== 'dev_gateway_offline_001'), 'c8 device table includes offline gateway', exported.tables?.device_index_v1);
  must((exported.tables?.alert_event_index_v1 || []).length === 0, 'c8 alert table must be empty', exported.tables?.alert_event_index_v1);
  must((exported.tables?.approval_requests_v1 || []).length === 0, 'c8 approval_requests_v1 must not include pest pending queue', exported.tables?.approval_requests_v1);
  must(!payloads(exported, 'decision_recommendation_v1').some((x) => x.recommendation_id === 'rec_c8_pest_inspection_pending_001'), 'c8 recommendation facts include pest pending', payloads(exported, 'decision_recommendation_v1'));
  must(JSON.stringify(exported.derived_expectations?.customer_operations || []) === JSON.stringify([FORMAL_OP]), 'c8 customer operation expectation must be formal only', exported.derived_expectations?.customer_operations);
}
function assertIrrigationRequirementExport(exported) {
  const rows = payloads(exported, 'irrigation_requirement_v1');
  const requirement = rows.find((x) => x.requirement_id === FORMAL_REQUIREMENT);
  must(requirement?.field_id === 'field_c8_demo', 'irrigation requirement field mismatch', requirement);
  must(requirement?.source_forecast_id === 'wf_c8_irrigation_001', 'irrigation requirement forecast binding mismatch', requirement);
  must(requirement?.skill_id === 'irrigation_requirement_skill_v1', 'irrigation requirement skill mismatch', requirement);
  must(close(requirement?.gross_irrigation_mm, 22), 'irrigation requirement gross amount mismatch', requirement);
  must(close(requirement?.gross_irrigation_requirement_mm, 22), 'irrigation requirement gross requirement amount mismatch', requirement);
  must(requirement?.unit === 'mm', 'irrigation requirement unit mismatch', requirement);
  must(requirement?.calculation_method === 'irrigation_requirement_skill_v1', 'irrigation requirement calculation method mismatch', requirement);
  must(requirement?.quality?.status === 'SKILL_CALCULATED', 'irrigation requirement quality status mismatch', requirement?.quality);
  must(requirement?.calculation_trace?.formula_version === 'irrigation_requirement_skill_v1', 'irrigation requirement formula mismatch', requirement?.calculation_trace);
  must(exported.formal_chain?.irrigation_requirement_skill_input?.skill_input_id === 'iskill_input_c8_irrigation_001', 'exported formal_chain skill input id mismatch', exported.formal_chain?.irrigation_requirement_skill_input);
  must(exported.facts_by_type?.irrigation_requirement_skill_input_v1?.length === 1, 'exported facts_by_type missing irrigation_requirement_skill_input_v1', exported.facts_by_type?.irrigation_requirement_skill_input_v1);
  must(requirement?.calculation_inputs?.input_source === 'projected_fact_bindings_v1', 'irrigation requirement input_source mismatch', requirement?.calculation_inputs);
  must(requirement?.calculation_inputs?.source_input_id === 'iskill_input_c8_irrigation_001', 'irrigation requirement source_input_id mismatch', requirement?.calculation_inputs);
  must(requirement?.calculation_inputs?.source_refs?.weather_forecast_id === 'wf_c8_irrigation_001', 'irrigation requirement weather source binding mismatch', requirement?.calculation_inputs);
  must(requirement?.calculation_inputs?.source_refs?.observation_refs?.forecast_rain_72h_mm === 'telemetry_rain_001', 'irrigation requirement rain source binding mismatch', requirement?.calculation_inputs);
  must(requirement?.quality?.source_binding_status === 'BOUND_TO_PROJECTED_FACTS', 'irrigation requirement source binding status mismatch', requirement?.quality);
  must(requirement?.quality?.derivation_status === 'DERIVED_FROM_FORMAL_SKILL_INPUT', 'irrigation requirement derivation status mismatch', requirement?.quality);
  must(requirement?.derivation?.source_input_id === 'iskill_input_c8_irrigation_001', 'irrigation requirement derivation source_input_id mismatch', requirement?.derivation);
  must(close(requirement?.calculation_trace?.soil_water_deficit_mm, 16.8), 'irrigation requirement soil water deficit mismatch', requirement?.calculation_trace);
  must(close(requirement?.calculation_trace?.et0_adjustment_mm, 3.9), 'irrigation requirement et0 adjustment mismatch', requirement?.calculation_trace);
  must(close(requirement?.net_irrigation_mm, 18.7), 'irrigation requirement net amount mismatch', requirement);
}

const dry = run([SEED, '--dry-run', '--tenant', 'tenantA', ...FIXED_NOW_MS_ARGS]);
must(dry.ok === true && dry.profile === 'full-review' && dry.chain_id === CHAIN && dry.apply === false, 'dry-run envelope invalid', dry);
for (const [key, min] of Object.entries({
  fields: 3,
  devices: 4,
  formal_operations: 1,
  irrigation_requirements: 1,
  recommendations: 2,
  approval_requests: 2,
  receipts: 2,
  formal_evidence: 2,
  acceptance_results: 2,
  field_memory_optional_compatibility_rows: 1,
  formal_field_memory_optional_compatibility_rows: 1,
  prescriptions: 1
})) {
  must(
    Number(dry.planned_counts?.[key] || 0) >= min,
    `dry-run count too small: ${key}`,
    dry.planned_counts
  );
}
must(
  Number(dry.planned_counts?.field_memory_derived_results ?? 0) === 0,
  'dry-run must not claim derived field memory results',
  dry.planned_counts
);
must(
  dry.field_memory_contract?.optional_rows_table === 'field_memory_v1_optional',
  'field memory optional contract missing',
  dry.field_memory_contract
);
must(
  dry.field_memory_contract?.derived_endpoint === 'POST /api/v1/field-memory/from-acceptance',
  'field memory derived endpoint contract missing',
  dry.field_memory_contract
);
const exported = run([SEED, '--export-json', '--tenant', 'tenantA', ...FIXED_NOW_MS_ARGS]);
assertFormalChain(exported);
assertIrrigationRequirementExport(exported);
must(
  Array.isArray(exported.tables?.field_memory_v1_optional)
    && exported.tables.field_memory_v1_optional.length >= 1,
  'export must expose field_memory_v1_optional rows',
  exported.tables?.field_memory_v1_optional
);
must(
  exported.tables?.field_memory_v1 === undefined
    || exported.tables.field_memory_v1.length === 0,
  'export must not expose authoritative field_memory_v1 static rows',
  exported.tables?.field_memory_v1
);
const optionalMemoryRows = exported.tables?.field_memory_v1_optional || [];
const formalOptionalMemory = optionalMemoryRows.find((x) => x.memory_lane === 'FORMAL_FIELD_MEMORY');
must(
  formalOptionalMemory?.compatibility_fallback === true
    && formalOptionalMemory?.projection_support_only === true
    && formalOptionalMemory?.not_authoritative_formal_result === true
    && formalOptionalMemory?.formal_result_must_be_derived === true
    && String(formalOptionalMemory?.static_seed_row_reason || '').length > 0,
  'formal optional field memory row must be marked compatibility-only',
  formalOptionalMemory
);
must(
  exported.manifest?.field_memory_contract?.optional_rows_table === 'field_memory_v1_optional',
  'manifest field memory contract missing optional table',
  exported.manifest?.field_memory_contract
);
must(
  exported.manifest?.governance_acceptance?.static_formal_memory_is_only_pass_source === false,
  'manifest must state static formal memory is not the only pass source',
  exported.manifest?.governance_acceptance
);
const c8Dry = run([SEED, '--dry-run', '--tenant', 'tenantA', '--profile', 'c8-formal-chain', ...FIXED_NOW_MS_ARGS]);
const c8Exported = run([SEED, '--export-json', '--tenant', 'tenantA', '--profile', 'c8-formal-chain', ...FIXED_NOW_MS_ARGS]);
assertFormalChain(c8Exported);
assertIrrigationRequirementExport(c8Exported);
assertSoilMoistureSensingWindowExportContract(c8Exported);
assertC8Profile(c8Exported, c8Dry);
console.log('[controlled-pilot-full-review-seed-export] PASS');
