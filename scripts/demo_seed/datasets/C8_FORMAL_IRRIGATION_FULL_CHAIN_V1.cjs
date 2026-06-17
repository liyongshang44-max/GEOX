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
const RECOMMENDATION_UNKNOWN_ID = 'rec_c8_irrigation_unknown_001';
const REQUIREMENT_ID = 'ireq_c8_irrigation_001';
const WATER_STATE_ESTIMATE_ID = 'wstate_c8_irrigation_001';
const SCENARIO_SET_ID = 'iscen_c8_irrigation_001';
const SKILL_INPUT_ID = 'iskill_input_c8_irrigation_001';
const PRESCRIPTION_ID = 'presc_c8_irrigation_001';
const TASK_ID = 'act_c8_irrigation_formal_001';
const RECEIPT_ID = 'receipt_c8_irrigation_formal_001';
const ACCEPTANCE_ID = 'acc_c8_irrigation_formal_001';
const PRODUCTION_EVIDENCE_ID = 'prod_evidence_c8_irrigation_formal_001';
const MEMORY_ID = 'fm_c8_irrigation_response_001';
const ROI_ID = 'roi_c8_irrigation_formal_001';
const APPROVAL_ID = 'approval_c8_irrigation_001';
const APPROVAL_DECISION_ID = 'approval_decision_c8_irrigation_001';
const SEASON_ID = 'season_2026_c8_corn';
const REQUIRED_DIAGNOSTIC_METRICS = ['soil_moisture_percent', 'forecast_rain_72h_mm', 'temperature_max_c', 'soil_moisture_after_percent'];
const FIELD_AREA_M2 = 20000;
const IRRIGATION_REQUIREMENT_ROOT_ZONE_DEPTH_MM = 300;
const IRRIGATION_REQUIREMENT_ET0_MM_72H = 3.9;
const IRRIGATION_APPLICATION_EFFICIENCY = 0.85;
const IRRIGATION_EXECUTION_RATIO = 0.9818181818181818;
const IRRIGATION_TARGET_SOIL_MOISTURE_PERCENT = 24;

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
  recommendation_unknown_id: RECOMMENDATION_UNKNOWN_ID,
  requirement_id: REQUIREMENT_ID,
  water_state_estimate_id: WATER_STATE_ESTIMATE_ID,
  irrigation_scenario_set_id: SCENARIO_SET_ID,
  skill_input_id: SKILL_INPUT_ID,
  prescription_id: PRESCRIPTION_ID,
  task_id: TASK_ID,
  receipt_id: RECEIPT_ID,
  acceptance_id: ACCEPTANCE_ID,
  production_evidence_id: PRODUCTION_EVIDENCE_ID,
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
function factsByType(facts) { const out = {}; for (const fact of facts) (out[fact.record_json.type] ||= []).push(fact); for (const type of ['field_crop_season_v1','device_observation_context_v1','decision_recommendation_v1','approval_request_v1','approval_decision_v1','operation_plan_v1','operation_plan_transition_v1','ao_act_task_v0','ao_act_receipt_v1','evidence_artifact_v1','acceptance_result_v1','skill_run_v1','telemetry_observation_v1','weather_forecast_fact_v1','irrigation_requirement_skill_input_v1','irrigation_requirement_v1','water_state_estimate_v1','irrigation_scenario_set_v1','stage1_sensing_summary_v1','prescription_v1','value_record_v1','controlled_pilot_full_review_manifest_v1','soil_moisture_sensing_window_v1','soil_moisture_sensing_window_index_v1']) out[type] ||= []; return out; }



function c8PadNumber(value, size) {
  return String(value).padStart(size, '0');
}

function c8IsoFromEpochMs(ms) {
  const totalMs = Math.trunc(Number(ms));
  const totalSeconds = Math.floor(totalMs / 1000);
  const millisecond = ((totalMs % 1000) + 1000) % 1000;
  const day = Math.floor(totalSeconds / 86400);
  const secondOfDay = ((totalSeconds % 86400) + 86400) % 86400;
  const hour = Math.floor(secondOfDay / 3600);
  const minute = Math.floor((secondOfDay % 3600) / 60);
  const second = secondOfDay % 60;
  const z = day + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  let year = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const date = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  if (month <= 2) year += 1;
  return `${c8PadNumber(year, 4)}-${c8PadNumber(month, 2)}-${c8PadNumber(date, 2)}T${c8PadNumber(hour, 2)}:${c8PadNumber(minute, 2)}:${c8PadNumber(second, 2)}.${c8PadNumber(millisecond, 3)}Z`;
}

function c8Average(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function c8RoundQuality(value) {
  return Math.round(value * 1000000) / 1000000;
}

function buildC8SoilMoistureWindowPointsV1(ctx) {
  const values = [18.1, 18.2, 18.3, 18.5, 18.3, 18.4];
  const expectedIntervalMs = 60000;
  const windowStartMs = ctx.nowMs - (values.length - 1) * expectedIntervalMs;
  return values.map((value, index) => {
    const observedAtMs = windowStartMs + index * expectedIntervalMs;
    const observedAt = c8IsoFromEpochMs(observedAtMs);
    const sequence = String(index + 1).padStart(3, '0');
    return {
      fact_id: `${ctx.factPrefix}_telemetry_soil_moisture_window_c8_${sequence}`,
      observation_id: `obs_c8_soil_moisture_window_${sequence}`,
      tenant_id: ctx.tenant_id,
      project_id: ctx.project_id,
      group_id: ctx.group_id,
      field_id: FIELD_ID,
      device_id: 'dev_soil_c8_001',
      metric: 'soil_moisture_percent',
      value_num: value,
      unit: '%',
      ts: observedAt,
      observed_at: observedAt,
      observed_at_ts_ms: observedAtMs,
      confidence: 0.94,
      quality_flags_json: [],
    };
  });
}

function deriveC8SoilMoistureSensingWindowV1(ctx, points) {
  const sortedPoints = [...points].sort((a, b) => a.observed_at_ts_ms - b.observed_at_ts_ms);
  if (sortedPoints.length === 0) throw new Error('points are required');
  const expectedIntervalMs = ctx.expected_interval_ms || 60000;
  const windowStartMs = ctx.window_start_ms ?? sortedPoints[0].observed_at_ts_ms;
  const windowEndMs = ctx.window_end_ms ?? sortedPoints[sortedPoints.length - 1].observed_at_ts_ms;
  const expectedPoints = Math.floor((windowEndMs - windowStartMs) / expectedIntervalMs) + 1;
  const actualPoints = sortedPoints.length;
  const coverageRatio = actualPoints / expectedPoints;
  const gaps = sortedPoints.slice(1).map((point, index) => point.observed_at_ts_ms - sortedPoints[index].observed_at_ts_ms);
  const maxGapMs = gaps.length ? Math.max(...gaps) : 0;
  const gapCount = gaps.filter((gap) => gap > expectedIntervalMs).length;
  const minTotalSamplesRequired = 5;
  const minSamplesPerRequiredMetric = { soil_moisture_percent: 5 };
  const minCoverageRatio = 0.2;
  const maxAllowedGapMs = 900000;
  const qualityStatus = actualPoints >= minTotalSamplesRequired && coverageRatio >= minCoverageRatio && maxGapMs <= maxAllowedGapMs ? 'PASS' : 'FAIL';
  const confidenceLevel = qualityStatus === 'FAIL'
    ? 'LOW'
    : coverageRatio >= 0.8 && maxGapMs <= maxAllowedGapMs
      ? 'HIGH'
      : 'MEDIUM';
  const confidenceScore = confidenceLevel === 'HIGH'
    ? Math.min(0.99, 0.7 + coverageRatio * 0.25 - gapCount * 0.02)
    : confidenceLevel === 'MEDIUM'
      ? Math.min(0.79, 0.45 + coverageRatio * 0.25)
      : Math.max(0.05, Math.min(0.39, coverageRatio * 0.5));
  const values = sortedPoints.map((point) => Number(point.value_num));

  return {
    window_id: ctx.window_id,
    tenant_id: ctx.tenant_id,
    project_id: ctx.project_id,
    group_id: ctx.group_id,
    field_id: FIELD_ID,
    device_id: 'dev_soil_c8_001',
    metric: 'soil_moisture_percent',
    window_start: c8IsoFromEpochMs(windowStartMs),
    window_end: c8IsoFromEpochMs(windowEndMs),
    expected_interval_ms: expectedIntervalMs,
    expected_points: expectedPoints,
    actual_points: actualPoints,
    min_total_samples_required: minTotalSamplesRequired,
    min_samples_per_required_metric: minSamplesPerRequiredMetric,
    coverage_ratio: c8RoundQuality(coverageRatio),
    min_coverage_ratio: minCoverageRatio,
    max_gap_ms: maxGapMs,
    max_allowed_gap_ms: maxAllowedGapMs,
    gap_count: gapCount,
    quality_status: qualityStatus,
    confidence: {
      level: confidenceLevel,
      score: c8RoundQuality(confidenceScore),
      basis: 'soil_moisture_time_window_evidence_v1',
    },
    summary: {
      first_value: values[0],
      last_value: values[values.length - 1],
      min_value: Math.min(...values),
      max_value: Math.max(...values),
      avg_value: c8RoundQuality(c8Average(values)),
      unit: '%',
    },
    evidence_refs: sortedPoints.map((point) => point.observation_id),
    source_fact_ids: sortedPoints.map((point) => point.fact_id),
    source_observation_ids: sortedPoints.map((point) => point.observation_id),
    config_snapshot: {
      expected_interval_ms: expectedIntervalMs,
      min_total_samples_required: minTotalSamplesRequired,
      min_coverage_ratio: minCoverageRatio,
      max_allowed_gap_ms: maxAllowedGapMs,
    },
    model_version: 'soil_moisture_sensing_window_v1',
    created_at: ctx.nowIso,
  };
}

function c8Ratio(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n > 1 ? n / 100 : n;
}

function c8Number(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function c8RoundMm(value) {
  return Math.round(value * 1000) / 1000;
}

function runC8IrrigationRequirementSkillV1(input) {
  const soil = c8Ratio(input.soil_moisture);
  const target = c8Ratio(input.target_soil_moisture) ?? 0.22;
  const depth = c8Number(input.root_zone_depth_mm, 300);
  const rain = Math.max(0, c8Number(input.rain_forecast_mm_72h, 0));
  const et0 = Math.max(0, c8Number(input.et0_mm_72h, 0));
  const efficiency = c8Number(input.application_efficiency, 0.85);
  const soilWaterDeficitMm = soil == null ? 0 : c8RoundMm(Math.max(0, target - soil) * depth);
  const rainCreditMm = c8RoundMm(Math.min(rain, soilWaterDeficitMm));
  const et0AdjustmentMm = c8RoundMm(et0);
  const net = soil == null ? 0 : c8RoundMm(Math.max(0, soilWaterDeficitMm + et0AdjustmentMm - rainCreditMm));
  const gross = c8RoundMm(net / efficiency);

  return {
    requirement_detected: net > 0,
    net_irrigation_requirement_mm: net,
    gross_irrigation_requirement_mm: gross,
    unit: 'mm',
    rain_credit_mm: rainCreditMm,
    et0_adjustment_mm: et0AdjustmentMm,
    confidence: {
      level: 'HIGH',
      basis: 'measured',
      reasons: [
        'soil_moisture_available',
        'target_soil_moisture_provided',
        'root_zone_depth_provided',
        'rain_forecast_provided',
        'et0_provided',
        'application_efficiency_provided'
      ]
    },
    evidence_refs: Array.from(new Set((input.evidence_refs || []).map(String).filter(Boolean))),
    calculation_trace: {
      formula_version: 'irrigation_requirement_skill_v1',
      normalized_soil_moisture: soil,
      target_soil_moisture: target,
      root_zone_depth_mm: depth,
      soil_water_deficit_mm: soilWaterDeficitMm,
      rain_forecast_mm_72h: rain,
      rain_credit_mm: rainCreditMm,
      et0_mm_72h: et0,
      et0_adjustment_mm: et0AdjustmentMm,
      application_efficiency: efficiency
    }
  };
}

function deriveC8IrrigationRequirementFromFormalSkillInputV1(params) {
  const {
    tenant,
    projectId,
    groupId,
    fieldId,
    seasonId,
    requirementId,
    skillInputArtifact,
    skillInputFactId,
    fieldAreaM2,
    nowIso
  } = params || {};

  if (!skillInputArtifact || typeof skillInputArtifact !== 'object') throw new Error('skillInputArtifact is required');
  if (!skillInputArtifact.skill_input_id) throw new Error('skillInputArtifact.skill_input_id is required');

  const inputValues = skillInputArtifact.input_values || {};
  const skillInput = {
    tenant_id: tenant,
    project_id: projectId,
    group_id: groupId,
    field_id: fieldId,
    soil_moisture: inputValues.soil_moisture,
    target_soil_moisture: inputValues.target_soil_moisture,
    root_zone_depth_mm: inputValues.root_zone_depth_mm,
    rain_forecast_mm_72h: inputValues.rain_forecast_mm_72h,
    et0_mm_72h: inputValues.et0_mm_72h,
    application_efficiency: inputValues.application_efficiency,
    evidence_refs: [
      skillInputArtifact.source_refs?.observation_refs?.soil_moisture_percent,
      skillInputArtifact.source_refs?.observation_refs?.forecast_rain_72h_mm,
      skillInputArtifact.source_refs?.observation_refs?.temperature_max_c,
    ],
    source_refs: skillInputArtifact.source_refs,
  };

  const skillOutput = runC8IrrigationRequirementSkillV1(skillInput);

  return {
    skill_output: skillOutput,
    requirement: {
      requirement_id: requirementId,
      field_id: fieldId,
      season_id: seasonId,
      crop_code: skillInputArtifact.crop_code || 'corn',
      crop_stage: skillInputArtifact.crop_stage || '\u8425\u517b\u751f\u957f\u671f',
      source_input_id: skillInputArtifact.skill_input_id,
      source_input_fact_id: skillInputFactId,
      source_forecast_id: skillInputArtifact.source_forecast_id || skillInputArtifact.source_refs?.weather_forecast_id || null,
      source_observation_refs: skillOutput.evidence_refs,
      skill_id: skillInputArtifact.skill_id || 'irrigation_requirement_skill_v1',
      skill_version: skillInputArtifact.skill_version || 'v1',
      skill_run_id: skillInputArtifact.skill_run_id || null,
      root_zone_soil_moisture_percent: skillInput.soil_moisture,
      target_soil_moisture_percent: skillInput.target_soil_moisture,
      target_min_soil_moisture_percent: 22,
      target_max_soil_moisture_percent: 28,
      rainfall_forecast_mm_72h: skillOutput.calculation_trace.rain_forecast_mm_72h,
      effective_rainfall_mm_72h: skillOutput.rain_credit_mm,
      temperature_max_c_72h: 31,
      et0_mm_72h: skillOutput.calculation_trace.et0_mm_72h,
      net_irrigation_mm: skillOutput.net_irrigation_requirement_mm,
      gross_irrigation_mm: skillOutput.gross_irrigation_requirement_mm,
      gross_irrigation_requirement_mm: skillOutput.gross_irrigation_requirement_mm,
      unit: skillOutput.unit,
      calculation_method: 'irrigation_requirement_skill_v1',
      calculation_inputs: {
        ...skillInput,
        soil_moisture_percent: skillInput.soil_moisture,
        target_soil_moisture_percent: skillInput.target_soil_moisture,
        forecast_rain_72h_mm: skillInput.rain_forecast_mm_72h,
        et0_mm_72h: skillInput.et0_mm_72h,
        temperature_max_c: 31,
        field_area_m2: fieldAreaM2,
        input_source: skillInputArtifact.input_source || 'projected_fact_bindings_v1',
        source_input_id: skillInputArtifact.skill_input_id,
        source_input_fact_id: skillInputFactId,
        source_refs: skillInputArtifact.source_refs,
        source_values: {
          soil_moisture_percent: skillInput.soil_moisture,
          rainfall_forecast_mm_72h: skillInput.rain_forecast_mm_72h,
          et0_mm_72h: skillInput.et0_mm_72h,
        }
      },
      calculation_trace: skillOutput.calculation_trace,
      confidence: skillOutput.confidence,
      derivation: {
        derivation_type: 'irrigation_requirement_from_skill_input_v1',
        source_type: 'irrigation_requirement_skill_input_v1',
        source_input_id: skillInputArtifact.skill_input_id,
        source_input_fact_id: skillInputFactId,
        formula_version: skillOutput.calculation_trace.formula_version,
        deterministic: true,
      },
      quality: {
        deterministic: true,
        source: 'irrigation_requirement_skill_v1',
        status: 'SKILL_CALCULATED',
        source_binding_status: 'BOUND_TO_PROJECTED_FACTS',
        derivation_status: 'DERIVED_FROM_FORMAL_SKILL_INPUT',
        confidence_level: skillOutput.confidence.level,
        confidence_basis: skillOutput.confidence.basis
      },
      created_at: nowIso
    }
  };
}

function c8Round1(value) {
  return Math.round(Number(value) * 10) / 10;
}

function c8ScenarioRiskAfter(rangeMin, targetMin) {
  if (!Number.isFinite(Number(rangeMin)) || !Number.isFinite(Number(targetMin))) return 'UNKNOWN';
  if (Number(rangeMin) >= Number(targetMin)) return 'NORMAL';
  if (Number(rangeMin) >= 20) return 'LIGHT_DEFICIT';
  return 'MODERATE_DEFICIT';
}

function c8ScenarioRiskDelta(before, after) {
  const rank = { NORMAL: 0, LIGHT_DEFICIT: 1, MODERATE_DEFICIT: 2 };
  if (!(before in rank) || !(after in rank)) return 'UNKNOWN';
  if (rank[after] < rank[before]) return 'IMPROVED';
  if (rank[after] > rank[before]) return 'WORSENED';
  return 'UNCHANGED';
}

function c8ScenarioOptionConfidence(optionId, riskAfter) {
  const baseReasons = [
    'water_state_estimate_available',
    'versioned_weather_forecast_available',
    'formal_requirement_available',
  ];

  if (riskAfter === 'UNKNOWN') return { level: 'LOW', score: 0.2, basis: 'scenario_option_unknown_risk_v1', reasons: baseReasons };
  if (optionId === 'delay_3d') return { level: 'LOW', score: 0.45, basis: 'delay_option_higher_uncertainty_v1', reasons: [...baseReasons, 'delay_increases_uncertainty'] };
  if (optionId === 'no_action' || optionId === 'irrigate_10mm') return { level: 'MEDIUM', score: 0.68, basis: 'formal_scenario_delta_model_v1', reasons: baseReasons };
  return { level: 'HIGH', score: 0.82, basis: 'formal_scenario_delta_model_v1', reasons: baseReasons };
}

function c8ScenarioFailureConditions(optionId, riskAfter) {
  const out = [
    'rainfall_forecast_deviation_gt_5mm',
    'sensor_coverage_below_threshold',
    'weather_provider_status_not_ok',
  ];

  if (riskAfter !== 'NORMAL') out.push('PROJECTED_DEFICIT_REMAINS');
  if (optionId === 'no_action') out.push('NO_IRRIGATION_APPLIED');

  if (optionId.startsWith('irrigate_')) {
    out.push('EXECUTION_REQUIRED');
    out.push('actual_application_efficiency_lt_assumed');
    out.push('post_irrigation_soil_response_not_observed');
    out.push('irrigation_execution_not_completed');
  }

  if (optionId === 'delay_3d') {
    out.push('IRRIGATION_DELAY_EXPOSURE');
    out.push('soil_moisture_declines_faster_than_expected');
    out.push('forecast_window_changes_before_execution');
  }

  return Array.from(new Set(out));
}

function buildC8IrrigationScenarioOptionV1(input) {
  const rootZoneDepthMm = Number(input.root_zone_depth_mm);
  const applicationEfficiency = Number(input.application_efficiency);
  const rainfall = Number(input.rainfall_forecast_mm_72h);
  const et0 = Number(input.et0_mm_72h);
  const baseline = Number(input.baseline_soil_moisture_percent);
  const targetMin = Number(input.target_min_soil_moisture_percent);
  const effectiveIrrigation = Number(input.effective_irrigation_mm_within_72h);
  const weatherDeltaPercent = ((rainfall - et0) / rootZoneDepthMm) * 100;
  const irrigationDeltaPercent = ((effectiveIrrigation * applicationEfficiency) / rootZoneDepthMm) * 100;
  const projectedCenter = baseline + weatherDeltaPercent + irrigationDeltaPercent;
  const rangeMinRaw = projectedCenter - Number(input.uncertainty_margin_percent);
  const rangeMaxRaw = projectedCenter + Number(input.uncertainty_margin_percent);
  const riskAfter = c8ScenarioRiskAfter(rangeMinRaw, targetMin);

  return {
    option_id: input.option_id,
    action_type: input.action_type,
    assumed_irrigation_mm: Number(input.assumed_irrigation_mm),
    effective_irrigation_mm_within_72h: effectiveIrrigation,
    delay_days: Number(input.delay_days),
    projected_soil_moisture_range: {
      min: c8Round1(rangeMinRaw),
      max: c8Round1(rangeMaxRaw),
      unit: '%',
    },
    risk_before: input.risk_before,
    risk_after: riskAfter,
    risk_delta: c8ScenarioRiskDelta(input.risk_before, riskAfter),
    confidence: c8ScenarioOptionConfidence(input.option_id, riskAfter),
    failure_conditions: c8ScenarioFailureConditions(input.option_id, riskAfter),
    calculation_trace: {
      formula_version: 'formal_irrigation_scenario_delta_model_v1',
      baseline_soil_moisture_percent: baseline,
      rainfall_forecast_mm_72h: c8RoundQuality(rainfall),
      et0_mm_72h: c8RoundQuality(et0),
      root_zone_depth_mm: c8RoundQuality(rootZoneDepthMm),
      application_efficiency: c8RoundQuality(applicationEfficiency),
      weather_delta_percent: c8RoundQuality(weatherDeltaPercent),
      irrigation_delta_percent: c8RoundQuality(irrigationDeltaPercent),
      projected_center_percent: c8RoundQuality(projectedCenter),
      uncertainty_margin_percent: Number(input.uncertainty_margin_percent),
      rounding_policy: 'risk_before_rounding_range_min_max_rounded_1_decimal',
    },
  };
}

function deriveC8IrrigationScenarioSetV1(params) {
  const waterState = params.water_state_estimate || {};
  const requirement = params.irrigation_requirement || {};
  const weather = params.weather_forecast || {};
  const sensingWindow = params.sensing_window || {};
  const requirementInputs = requirement.calculation_inputs || {};
  const reasonCodes = [];
  const asOf = params.created_at;

  if (!waterState.estimate_id) reasonCodes.push('WATER_STATE_MISSING');
  if (waterState.state === 'UNKNOWN') reasonCodes.push('WATER_STATE_UNKNOWN');
  if (waterState.quality?.status !== 'ESTIMATED') reasonCodes.push('WATER_STATE_NOT_ESTIMATED');
  if (!requirement.requirement_id) reasonCodes.push('IRRIGATION_REQUIREMENT_MISSING');
  if (!weather.forecast_id) reasonCodes.push('WEATHER_FORECAST_MISSING');
  if (weather.quality?.provider_status !== 'OK') reasonCodes.push('WEATHER_PROVIDER_NOT_OK');
  if (weather.quality && weather.quality.stale === true) reasonCodes.push('WEATHER_FORECAST_STALE');

  const asOfMs = Date.parse(asOf);
  const validFromMs = Date.parse(weather.valid_from);
  const validToMs = Date.parse(weather.valid_to);
  if (!Number.isFinite(asOfMs) || !Number.isFinite(validFromMs) || !Number.isFinite(validToMs) || validFromMs > asOfMs || asOfMs > validToMs) {
    reasonCodes.push('WEATHER_FORECAST_NOT_VALID_FOR_AS_OF');
  }

  if (sensingWindow.quality_status && sensingWindow.quality_status !== 'PASS') reasonCodes.push('SENSING_WINDOW_NOT_PASS');

  const baseline = Number(waterState.root_zone_soil_moisture_percent);
  const targetMin = Number(waterState.target_min_soil_moisture_percent);
  const gross = Number(waterState.gross_irrigation_requirement_mm);
  const rainfall = Number(weather.rainfall_forecast_mm_72h);
  const et0 = Number(weather.et0_mm_72h);
  const rootZoneDepthMm = Number(requirementInputs.root_zone_depth_mm);
  const applicationEfficiency = Number(requirementInputs.application_efficiency);

  if (!Number.isFinite(baseline)) reasonCodes.push('BASELINE_SOIL_MOISTURE_NOT_FINITE');
  if (!Number.isFinite(targetMin)) reasonCodes.push('TARGET_MIN_NOT_FINITE');
  if (!Number.isFinite(gross)) reasonCodes.push('GROSS_IRRIGATION_NOT_FINITE');
  if (!Number.isFinite(rainfall)) reasonCodes.push('RAINFALL_NOT_FINITE');
  if (!Number.isFinite(et0)) reasonCodes.push('ET0_NOT_FINITE');
  if (!Number.isFinite(rootZoneDepthMm) || rootZoneDepthMm <= 0) reasonCodes.push('ROOT_ZONE_DEPTH_NOT_FINITE');
  if (!Number.isFinite(applicationEfficiency) || applicationEfficiency <= 0) reasonCodes.push('APPLICATION_EFFICIENCY_NOT_FINITE');

  const comparable = reasonCodes.length === 0;
  const common = {
    baseline_soil_moisture_percent: baseline,
    target_min_soil_moisture_percent: targetMin,
    rainfall_forecast_mm_72h: rainfall,
    et0_mm_72h: et0,
    root_zone_depth_mm: rootZoneDepthMm,
    application_efficiency: applicationEfficiency,
    risk_before: waterState.state || 'UNKNOWN',
  };

  const options = comparable ? [
    buildC8IrrigationScenarioOptionV1({
      option_id: 'no_action',
      action_type: 'NO_ACTION',
      assumed_irrigation_mm: 0,
      effective_irrigation_mm_within_72h: 0,
      delay_days: 0,
      uncertainty_margin_percent: 0.8,
      ...common,
    }),
    buildC8IrrigationScenarioOptionV1({
      option_id: 'irrigate_10mm',
      action_type: 'IRRIGATE',
      assumed_irrigation_mm: 10,
      effective_irrigation_mm_within_72h: 10,
      delay_days: 0,
      uncertainty_margin_percent: 0.8,
      ...common,
    }),
    buildC8IrrigationScenarioOptionV1({
      option_id: 'irrigate_20mm',
      action_type: 'IRRIGATE',
      assumed_irrigation_mm: 20,
      effective_irrigation_mm_within_72h: 20,
      delay_days: 0,
      uncertainty_margin_percent: 0.8,
      ...common,
    }),
    buildC8IrrigationScenarioOptionV1({
      option_id: 'irrigate_22mm',
      action_type: 'IRRIGATE',
      assumed_irrigation_mm: 22,
      effective_irrigation_mm_within_72h: 22,
      delay_days: 0,
      uncertainty_margin_percent: 0.8,
      ...common,
    }),
    buildC8IrrigationScenarioOptionV1({
      option_id: 'delay_3d',
      action_type: 'DELAY_IRRIGATION',
      assumed_irrigation_mm: 22,
      effective_irrigation_mm_within_72h: 0,
      delay_days: 3,
      uncertainty_margin_percent: 1.5,
      ...common,
    }),
  ] : [];

  return {
    scenario_set_id: params.scenario_set_id,
    field_id: FIELD_ID,
    season_id: SEASON_ID,
    source_water_state_estimate_id: waterState.estimate_id || null,
    source_requirement_id: requirement.requirement_id || null,
    source_forecast_id: weather.forecast_id || null,
    source_sensing_window_id: sensingWindow.window_id || waterState.source_sensing_window_id || null,
    baseline_water_state: waterState.state || null,
    baseline_soil_moisture_percent: Number.isFinite(baseline) ? baseline : null,
    target_min_soil_moisture_percent: waterState.target_min_soil_moisture_percent ?? requirement.target_min_soil_moisture_percent ?? null,
    target_max_soil_moisture_percent: waterState.target_max_soil_moisture_percent ?? requirement.target_max_soil_moisture_percent ?? null,
    net_irrigation_mm: waterState.net_irrigation_mm ?? requirement.net_irrigation_mm ?? null,
    gross_irrigation_requirement_mm: waterState.gross_irrigation_requirement_mm ?? requirement.gross_irrigation_requirement_mm ?? null,
    options,
    recommended_option_id: null,
    input_refs: {
      as_of: asOf,
      water_state_estimate_id: waterState.estimate_id || null,
      water_state_fact_id: params.water_state_fact_id || null,
      sensing_window_id: sensingWindow.window_id || waterState.source_sensing_window_id || null,
      sensing_window_fact_id: params.sensing_window_fact_id || waterState.source_sensing_window_fact_id || null,
      weather_forecast_id: weather.forecast_id || null,
      weather_fact_id: params.weather_fact_id || null,
      weather_forecast_version: weather.forecast_version || null,
      weather_provider_run_id: weather.provider_run_id || null,
      weather_external_forecast_id: weather.external_forecast_id || null,
      weather_valid_from: weather.valid_from || null,
      weather_valid_to: weather.valid_to || null,
      weather_provider_status: weather.quality?.provider_status || null,
      requirement_id: requirement.requirement_id || null,
      requirement_fact_id: params.requirement_fact_id || null,
      requirement_calculation_inputs: requirementInputs,
      root_zone_depth_mm: Number.isFinite(rootZoneDepthMm) ? rootZoneDepthMm : null,
      application_efficiency: Number.isFinite(applicationEfficiency) ? applicationEfficiency : null,
    },
    evidence_refs: [
      waterState.estimate_id,
      sensingWindow.window_id || waterState.source_sensing_window_id,
      weather.forecast_id,
      requirement.requirement_id,
      params.water_state_fact_id,
      params.sensing_window_fact_id || waterState.source_sensing_window_fact_id,
      params.weather_fact_id,
      params.requirement_fact_id,
    ].map(String).filter(Boolean),
    derivation: {
      derivation_type: 'formal_irrigation_scenario_set_from_h14_water_state_v1',
      deterministic: true,
      rule_version: 'formal_irrigation_scenario_delta_model_v1',
      comparison_only: true,
      no_recommendation: true,
      recommended_option_id: null,
      fixed_option_ids: ['no_action', 'irrigate_10mm', 'irrigate_20mm', 'irrigate_22mm', 'delay_3d'],
      reason_codes: reasonCodes,
      delay_3d_semantics: 'effective_irrigation_mm_within_72h_is_zero',
    },
    quality: {
      status: comparable ? 'COMPARABLE' : 'UNKNOWN',
      reason_codes: reasonCodes,
      deterministic: true,
    },
    confidence: comparable ? {
      level: 'HIGH',
      score: 0.86,
      basis: 'h14_water_state_high_confidence_v1',
    } : {
      level: 'LOW',
      score: 0.2,
      basis: 'scenario_set_not_comparable_when_water_state_unknown_v1',
    },
    created_at: params.created_at,
  };
}


function deriveC8DecisionRecommendationFromScenarioRequirementV1(params) {
  const scenarioSet = params.irrigation_scenario_set || {};
  const waterState = params.water_state_estimate || {};
  const requirement = params.irrigation_requirement || {};
  const selectedOptionId = params.selected_scenario_option_id || null;
  const options = Array.isArray(scenarioSet.options) ? scenarioSet.options : [];
  const selectedOption = selectedOptionId ? options.find((option) => option && option.option_id === selectedOptionId) : null;
  const reasonCodes = [];

  if (scenarioSet.quality?.status !== 'COMPARABLE') reasonCodes.push('SCENARIO_SET_NOT_COMPARABLE');
  if (waterState.state === 'UNKNOWN') reasonCodes.push('WATER_STATE_UNKNOWN');
  if (waterState.state && waterState.state !== 'MODERATE_DEFICIT') reasonCodes.push('WATER_STATE_NOT_MODERATE_DEFICIT');
  if (!requirement.requirement_id) reasonCodes.push('IRRIGATION_REQUIREMENT_MISSING');
  if (!selectedOption) reasonCodes.push('SELECTED_SCENARIO_OPTION_MISSING');
  if (selectedOption && selectedOption.risk_after !== 'NORMAL') reasonCodes.push('SELECTED_SCENARIO_OPTION_RISK_AFTER_NOT_NORMAL');
  if (selectedOption && selectedOption.risk_delta !== 'IMPROVED') reasonCodes.push('SELECTED_SCENARIO_OPTION_RISK_DELTA_NOT_IMPROVED');

  const grossRequirementMm = Number(requirement.gross_irrigation_requirement_mm);
  const selectedAmountMm = Number(selectedOption && selectedOption.assumed_irrigation_mm);

  if (!Number.isFinite(grossRequirementMm)) reasonCodes.push('GROSS_IRRIGATION_REQUIREMENT_NOT_FINITE');
  if (selectedOption && !Number.isFinite(selectedAmountMm)) reasonCodes.push('SELECTED_SCENARIO_AMOUNT_NOT_FINITE');
  if (selectedOption && Number.isFinite(grossRequirementMm) && Number.isFinite(selectedAmountMm) && Math.abs(grossRequirementMm - selectedAmountMm) > 0.000001) {
    reasonCodes.push('SELECTED_SCENARIO_AMOUNT_MISMATCH');
  }

  const usable = reasonCodes.length === 0;
  const amountMm = usable ? selectedAmountMm : null;
  const status = usable ? 'RECOMMENDED' : 'UNKNOWN';

  const sourceWaterStateId = waterState.estimate_id || null;
  const sourceScenarioSetId = scenarioSet.scenario_set_id || null;
  const sourceRequirementId = requirement.requirement_id || null;

  const suggestedAction = usable ? {
    action_type: 'IRRIGATION',
    water_mm: amountMm,
    amount_mm: amountMm,
    unit: 'mm',
    target_device_id: params.target_device_id || 'dev_valve_pump_c8_001',
    source_requirement_id: sourceRequirementId,
    source_scenario_set_id: sourceScenarioSetId,
    selected_scenario_option_id: selectedOption.option_id,
    amount_source: params.amount_source || null,
  } : null;

  return {
    recommendation_id: params.recommendation_id,
    field_id: FIELD_ID,
    season_id: SEASON_ID,
    crop_code: 'corn',
    crop_stage: '营养生长期',
    recommendation_status: status,
    decision_type: 'IRRIGATION',
    selected_scenario_option_id: usable ? selectedOption.option_id : null,
    source_water_state_estimate_id: sourceWaterStateId,
    source_scenario_set_id: sourceScenarioSetId,
    source_requirement_id: sourceRequirementId,
    diagnosis: {
      problem: usable ? '土壤水分偏低' : '灌溉建议输入不足',
      input_observation_refs: ['telemetry_soil_moisture_window_c8_006', 'telemetry_rain_001'],
      human: usable ? 'C8 20cm 土层水分偏低，且未来 72 小时降雨不足。' : '水分状态或情景比较不可用，不能形成灌溉建议。',
    },
    scenario_summary: usable ? {
      selected_option_id: selectedOption.option_id,
      risk_before: selectedOption.risk_before,
      risk_after: selectedOption.risk_after,
      risk_delta: selectedOption.risk_delta,
      assumed_irrigation_mm: selectedOption.assumed_irrigation_mm,
      projected_soil_moisture_range: selectedOption.projected_soil_moisture_range,
      confidence: selectedOption.confidence,
      failure_conditions: selectedOption.failure_conditions,
    } : null,
    expected_effect: usable ? {
      metric: 'soil_moisture_percent',
      target_range: { min: 22, max: 28 },
      source_scenario_option_id: selectedOption.option_id,
      projected_soil_moisture_range: selectedOption.projected_soil_moisture_range,
    } : null,
    suggested_action: suggestedAction,
    irrigation_requirement_id: sourceRequirementId,
    source_requirement_id: sourceRequirementId,
    amount_source: usable ? params.amount_source || null : null,
    human_approval_required: usable,
    input_refs: {
      water_state_estimate_id: sourceWaterStateId,
      scenario_set_id: sourceScenarioSetId,
      requirement_id: sourceRequirementId,
      selected_scenario_option_id: usable ? selectedOption.option_id : null,
      scenario_quality_status: scenarioSet.quality?.status || null,
      water_state: waterState.state || null,
      requirement_gross_irrigation_mm: Number.isFinite(grossRequirementMm) ? grossRequirementMm : null,
    },
    evidence_refs: [
      sourceWaterStateId,
      sourceScenarioSetId,
      sourceRequirementId,
      params.water_state_fact_id,
      params.scenario_set_fact_id,
      params.requirement_fact_id,
    ].filter(Boolean),
    derivation: {
      derivation_type: 'decision_recommendation_from_scenario_requirement_v1',
      deterministic: true,
      rule_version: 'decision_recommendation_v1_from_h15_scenario_set',
      selected_scenario_option_id: usable ? selectedOption.option_id : null,
      selection_rules: usable ? [
        'scenario_set_quality_comparable',
        'water_state_moderate_deficit',
        'option_risk_after_normal',
        'option_risk_delta_improved',
        'option_amount_matches_requirement',
      ] : [],
      no_direct_execution: true,
      requires_human_approval: usable,
      reason_codes: reasonCodes,
    },
    quality: {
      status: usable ? 'RECOMMENDABLE' : 'UNKNOWN',
      input_binding_status: usable ? 'INPUTS_BOUND' : 'INPUT_NOT_USABLE',
      reason_codes: reasonCodes,
      deterministic: true,
    },
    confidence: usable ? {
      level: 'HIGH',
      score: 0.84,
      basis: 'scenario_requirement_water_state_bound_v1',
      reasons: [
        'water_state_estimate_available',
        'formal_scenario_set_available',
        'formal_requirement_available',
        'selected_option_improves_risk',
      ],
    } : {
      level: 'LOW',
      score: 0.2,
      basis: 'recommendation_input_not_usable_v1',
      reasons: reasonCodes,
    },
    created_at: params.created_at,
  };
}


function buildC8FormalIrrigationFullChainDataset(options) {
  const { tenant, profile = 'full-review', nowMs, nowIso } = options || {};
  if (!tenant) throw new Error('tenant is required');
  if (!Number.isFinite(nowMs)) throw new Error('nowMs must be a finite number');
  if (typeof nowIso !== 'string' || !nowIso) throw new Error('nowIso must be a non-empty ISO string');
  const formalScoped = isC8FormalScoped(profile);
  const formalE2E = isC8FormalE2E(profile);
  const pre = prefixOf(tenant);
  const FACT_PREFIX = pre;
  const SENSING_WINDOW_ID = 'sw_c8_soil_moisture_001';
  const SENSING_WINDOW_FACT_ID = `${FACT_PREFIX}_soil_moisture_sensing_window_c8_001`;
  const SENSING_WINDOW_FAIL_ID = 'sw_c8_soil_moisture_fail_001';
  const SENSING_WINDOW_FAIL_FACT_ID = `${FACT_PREFIX}_soil_moisture_sensing_window_c8_fail_001`;
  const WATER_STATE_ESTIMATE_ID_SCOPED = `${FACT_PREFIX}_${WATER_STATE_ESTIMATE_ID}`;
  const WATER_STATE_UNKNOWN_ESTIMATE_ID = `${FACT_PREFIX}_wstate_c8_irrigation_unknown_001`;
  const IRRIGATION_SCENARIO_SET_ID_SCOPED = `${FACT_PREFIX}_${SCENARIO_SET_ID}`;
  const IRRIGATION_SCENARIO_UNKNOWN_SET_ID = `${FACT_PREFIX}_iscen_c8_irrigation_unknown_001`;
  const ctx = baseCtx(tenant);
  const ts = nowMs;
  const iso = nowIso;
  const fact = (id, type, payload) => ({ fact_id: `${pre}_${id}`, occurred_at: iso, source: SOURCE, record_json: { type, payload: { ...ctx, ...payload } } });
  const field = { field_id: FIELD_ID, field_name: 'C8 灌溉示范田', area_m2: FIELD_AREA_M2, area_ha: 2, area_mu: 30, crop_code: 'corn', crop_name: '玉米', season_id: SEASON_ID, crop_stage: '营养生长期' };
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
  const sensingWindowPoints = buildC8SoilMoistureWindowPointsV1({ ...ctx, factPrefix: pre, nowMs, nowIso, window_id: SENSING_WINDOW_ID });
  const sensingWindow = deriveC8SoilMoistureSensingWindowV1({ ...ctx, factPrefix: pre, nowMs, nowIso, window_id: SENSING_WINDOW_ID }, sensingWindowPoints);
  const sensingWindowFailPoints = [sensingWindowPoints[sensingWindowPoints.length - 1]];
  const sensingWindowFail = deriveC8SoilMoistureSensingWindowV1({ ...ctx, factPrefix: pre, nowMs, nowIso, window_id: SENSING_WINDOW_FAIL_ID, window_start_ms: nowMs - 5 * 60000, window_end_ms: nowMs }, sensingWindowFailPoints);
  const sensingWindowIndex = {
    tenant_id: tenant,
    project_id: PROJECT_ID,
    group_id: GROUP_ID,
    field_id: FIELD_ID,
    device_id: 'dev_soil_c8_001',
    metric: 'soil_moisture_percent',
    window_id: SENSING_WINDOW_ID,
    source_fact_id: SENSING_WINDOW_FACT_ID,
    window_start: sensingWindow.window_start,
    window_end: sensingWindow.window_end,
    actual_points: sensingWindow.actual_points,
    expected_points: sensingWindow.expected_points,
    coverage_ratio: sensingWindow.coverage_ratio,
    quality_status: sensingWindow.quality_status,
    confidence_level: sensingWindow.confidence.level,
    last_value: sensingWindow.summary.last_value,
    updated_ts_ms: ts,
  };
  const sensingWindowFailIndex = {
    ...sensingWindowIndex,
    window_id: SENSING_WINDOW_FAIL_ID,
    source_fact_id: SENSING_WINDOW_FAIL_FACT_ID,
    window_start: sensingWindowFail.window_start,
    window_end: sensingWindowFail.window_end,
    actual_points: sensingWindowFail.actual_points,
    expected_points: sensingWindowFail.expected_points,
    coverage_ratio: sensingWindowFail.coverage_ratio,
    quality_status: sensingWindowFail.quality_status,
    confidence_level: sensingWindowFail.confidence.level,
    last_value: sensingWindowFail.summary.last_value,
  };
  const observations = [
    ...sensingWindowPoints.map((point, index) => ['dev_soil_c8_001', FIELD_ID, 'soil_moisture_percent', '20cm 土层水分', 'before', 'irrigation_decision_input', { min_percent: 22, target_min_percent: 22, target_max_percent: 28 }, point.value_num, '%', point.fact_id.replace(`${pre}_`, ''), point.observation_id, point.observed_at, point.observed_at_ts_ms, point.confidence, point.quality_flags_json]),
    ['dev_soil_c8_001', FIELD_ID, 'soil_moisture_after_percent', '灌后 20cm 土层水分', 'after', 'acceptance_effect_input', { target_min_percent: 22, target_max_percent: 28 }, 24.8, '%', 'telemetry_soil_after_001'],
    ['dev_weather_station_c8_001', FIELD_ID, 'forecast_rain_72h_mm', '未来 72 小时降雨', 'weather_forecast', 'irrigation_decision_input', { max_mm: 5 }, 2, 'mm', 'telemetry_rain_001'],
    ['dev_weather_station_c8_001', FIELD_ID, 'temperature_max_c', '最高气温', 'weather_forecast', 'irrigation_decision_context', {}, 31, 'c', 'telemetry_temp_001'],
  ].map(([device_id, field_id, metric, metric_label, metric_role, diagnostic_use, threshold_ref, value_num, unit, suffix, observation_id, observedAt, observedAtTsMs, confidence, qualityFlags]) => ({ tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, device_id, field_id, metric, metric_label, metric_role, diagnostic_use, threshold_ref, ts: observedAt || iso, observed_at: observedAt || iso, observed_at_ts_ms: observedAtTsMs || ts, value_num, value_text: null, unit, confidence: confidence ?? 0.95, quality_flags_json: qualityFlags || [], fact_id: `${pre}_${suffix}`, observation_id: observation_id || suffix }));

  const observationByMetric = Object.fromEntries(observations.map((observation) => [observation.metric, observation]));
  const observationRefId = (observation) => String((observation && observation.fact_id) || '').replace(pre + '_', '');
  const soilBeforeObservation = observationByMetric.soil_moisture_percent;
  const rainForecastObservation = observationByMetric.forecast_rain_72h_mm;
  const temperatureForecastObservation = observationByMetric.temperature_max_c;
  const weatherForecast = {
    forecast_id: 'wf_c8_irrigation_001',
    field_id: FIELD_ID,
    provider: 'C8_EXTERNAL_WEATHER_SAMPLE',
    source_type: 'WEATHER_PROVIDER_API',
    source_id: 'c8_external_weather_provider_sample_001',
    provider_run_id: 'provider_run_c8_irrigation_001',
    external_forecast_id: 'external_forecast_c8_irrigation_001',
    forecast_version: 'c8_external_weather_provider_sample_001:' + iso + ':v1',
    issue_time: iso,
    latitude: 39.9025,
    longitude: 116.3825,
    generated_at: iso,
    valid_from: iso,
    valid_to: c8IsoFromEpochMs(nowMs + 72 * 60 * 60 * 1000),
    horizon_hours: 72,
    rainfall_forecast_mm_72h: Number(rainForecastObservation && rainForecastObservation.value_num),
    temperature_max_c_72h: Number(temperatureForecastObservation && temperatureForecastObservation.value_num),
    et0_mm_72h: IRRIGATION_REQUIREMENT_ET0_MM_72H,
    hourly: [],
    quality: {
      stale: false,
      missing_fields: [],
      provider_status: 'OK',
      version_status: 'VERSIONED',
      external_source: true,
    },
    version: {
      forecast_version: 'c8_external_weather_provider_sample_001:' + iso + ':v1',
      issue_time: iso,
      provider_run_id: 'provider_run_c8_irrigation_001',
      external_forecast_id: 'external_forecast_c8_irrigation_001',
      replayable: true,
    },
    raw_payload: {
      fixture: true,
      provider: 'C8_EXTERNAL_WEATHER_SAMPLE',
      source_type: 'WEATHER_PROVIDER_API',
      source_id: 'c8_external_weather_provider_sample_001',
      provider_run_id: 'provider_run_c8_irrigation_001',
      external_forecast_id: 'external_forecast_c8_irrigation_001',
      retrieved_at: iso,
      note: 'H13 provider payload fixture; no live external API call.',
    },
  };
  const staleWeatherForecast = {
    ...weatherForecast,
    forecast_id: 'wf_c8_irrigation_stale_001',
    provider_run_id: 'provider_run_c8_irrigation_stale_001',
    external_forecast_id: 'external_forecast_c8_irrigation_stale_001',
    forecast_version: 'c8_external_weather_provider_sample_001:' + c8IsoFromEpochMs(nowMs - 96 * 60 * 60 * 1000) + ':stale',
    issue_time: c8IsoFromEpochMs(nowMs - 96 * 60 * 60 * 1000),
    generated_at: c8IsoFromEpochMs(nowMs - 96 * 60 * 60 * 1000),
    valid_from: c8IsoFromEpochMs(nowMs - 96 * 60 * 60 * 1000),
    valid_to: c8IsoFromEpochMs(nowMs - 24 * 60 * 60 * 1000),
    quality: {
      stale: true,
      missing_fields: [],
      provider_status: 'OK',
      version_status: 'VERSIONED',
      external_source: true,
    },
    version: {
      forecast_version: 'c8_external_weather_provider_sample_001:' + c8IsoFromEpochMs(nowMs - 96 * 60 * 60 * 1000) + ':stale',
      issue_time: c8IsoFromEpochMs(nowMs - 96 * 60 * 60 * 1000),
      provider_run_id: 'provider_run_c8_irrigation_stale_001',
      external_forecast_id: 'external_forecast_c8_irrigation_stale_001',
      replayable: true,
    },
    raw_payload: {
      fixture: true,
      provider: 'C8_EXTERNAL_WEATHER_SAMPLE',
      source_type: 'WEATHER_PROVIDER_API',
      source_id: 'c8_external_weather_provider_sample_001',
      provider_run_id: 'provider_run_c8_irrigation_stale_001',
      external_forecast_id: 'external_forecast_c8_irrigation_stale_001',
      retrieved_at: c8IsoFromEpochMs(nowMs - 96 * 60 * 60 * 1000),
      stale_fixture: true,
      note: 'H13 stale forecast negative fixture; must not be selected by skill input.',
    },
  }
  const irrigationSkillInputSourceRefs = {
    input_source: 'projected_fact_bindings_v1',
    weather_forecast_id: weatherForecast.forecast_id,
    weather_fact_id: pre + '_weather_forecast_c8_irrigation_001',
    sensing_window_id: SENSING_WINDOW_ID,
    sensing_window_fact_id: SENSING_WINDOW_FACT_ID,
    sensing_window_quality_status: 'PASS',
    observation_refs: {
      soil_moisture_percent: observationRefId(soilBeforeObservation),
      forecast_rain_72h_mm: observationRefId(rainForecastObservation),
      temperature_max_c: observationRefId(temperatureForecastObservation),
    },
    telemetry_fact_ids: {
      soil_moisture_percent: soilBeforeObservation ? soilBeforeObservation.fact_id : null,
      forecast_rain_72h_mm: rainForecastObservation ? rainForecastObservation.fact_id : null,
      temperature_max_c: temperatureForecastObservation ? temperatureForecastObservation.fact_id : null,
    },
    device_ids: {
      soil_moisture_percent: soilBeforeObservation ? soilBeforeObservation.device_id : null,
      forecast_rain_72h_mm: rainForecastObservation ? rainForecastObservation.device_id : null,
      temperature_max_c: temperatureForecastObservation ? temperatureForecastObservation.device_id : null,
    },
  };

  Object.assign(irrigationSkillInputSourceRefs, {
    weather_forecast_quality_status: 'PASS',
    weather_forecast_valid_from: weatherForecast.valid_from,
    weather_forecast_valid_to: weatherForecast.valid_to,
    weather_forecast_provider_status: weatherForecast.quality.provider_status,
    weather_forecast_stale: weatherForecast.quality.stale,
    weather_forecast_version: weatherForecast.forecast_version,
    provider_run_id: weatherForecast.provider_run_id,
    external_forecast_id: weatherForecast.external_forecast_id,
    stale_weather_forecast_id: staleWeatherForecast.forecast_id,
    stale_weather_fact_id: pre + '_weather_forecast_c8_irrigation_stale_001',
  });
  const approvalDecision = { request_id: APPROVAL_ID, approval_request_id: APPROVAL_ID, decision_id: APPROVAL_DECISION_ID, decision: 'APPROVED', actor_id: 'tok_admin_actor', actor_name: '\u8fd0\u8425\u7ba1\u7406\u5458', actor_role: 'operation_approver', note: '\u540c\u610f\u6309\u6b63\u5f0f\u704c\u6e89\u9700\u6c42\u5904\u65b9 22mm \u6267\u884c\u3002', decided_by: 'tok_admin_actor' };
  const irrigationRequirementSkillInput = {
    tenant_id: tenant,
    project_id: PROJECT_ID,
    group_id: GROUP_ID,
    field_id: FIELD_ID,
    soil_moisture: Number(soilBeforeObservation && soilBeforeObservation.value_num),
    target_soil_moisture: IRRIGATION_TARGET_SOIL_MOISTURE_PERCENT,
    root_zone_depth_mm: IRRIGATION_REQUIREMENT_ROOT_ZONE_DEPTH_MM,
    rain_forecast_mm_72h: weatherForecast.rainfall_forecast_mm_72h,
    et0_mm_72h: weatherForecast.et0_mm_72h,
    application_efficiency: IRRIGATION_APPLICATION_EFFICIENCY,
    evidence_refs: [
      irrigationSkillInputSourceRefs.observation_refs.soil_moisture_percent,
      irrigationSkillInputSourceRefs.observation_refs.forecast_rain_72h_mm,
      irrigationSkillInputSourceRefs.observation_refs.temperature_max_c,
    ],
    source_refs: irrigationSkillInputSourceRefs,
  };
  const irrigationRequirementSkillInputArtifact = {
    skill_input_id: SKILL_INPUT_ID,
    requirement_id: REQUIREMENT_ID,
    field_id: FIELD_ID,
    season_id: SEASON_ID,
    crop_code: 'corn',
    crop_stage: '\u8425\u517b\u751f\u957f\u671f',
    source_input_id: SKILL_INPUT_ID,
    skill_id: 'irrigation_requirement_skill_v1',
    skill_version: 'v1',
    skill_run_id: 'skill_trace_c8_irrigation_001',
    input_source: 'projected_fact_bindings_v1',
    source_forecast_id: weatherForecast.forecast_id,
    source_refs: irrigationSkillInputSourceRefs,
    input_values: {
      soil_moisture: irrigationRequirementSkillInput.soil_moisture,
      target_soil_moisture: irrigationRequirementSkillInput.target_soil_moisture,
      root_zone_depth_mm: irrigationRequirementSkillInput.root_zone_depth_mm,
      rain_forecast_mm_72h: irrigationRequirementSkillInput.rain_forecast_mm_72h,
      et0_mm_72h: irrigationRequirementSkillInput.et0_mm_72h,
      application_efficiency: irrigationRequirementSkillInput.application_efficiency,
    },
    input_units: {
      soil_moisture: 'percent',
      target_soil_moisture: 'percent',
      root_zone_depth_mm: 'mm',
      rain_forecast_mm_72h: 'mm',
      et0_mm_72h: 'mm',
      application_efficiency: 'ratio',
    },
    created_at: iso
  };
  const irrigationRequirementDerivation = deriveC8IrrigationRequirementFromFormalSkillInputV1({
    tenant,
    projectId: PROJECT_ID,
    groupId: GROUP_ID,
    fieldId: FIELD_ID,
    seasonId: SEASON_ID,
    requirementId: REQUIREMENT_ID,
    skillInputArtifact: irrigationRequirementSkillInputArtifact,
    skillInputFactId: `${pre}_irrigation_requirement_skill_input_c8_001`,
    fieldAreaM2: FIELD_AREA_M2,
    nowIso: iso,
  });
  const irrigationRequirementSkillOutput = irrigationRequirementDerivation.skill_output;
  const irrigationRequirement = irrigationRequirementDerivation.requirement;
  const waterStateEstimate = {
    estimate_id: WATER_STATE_ESTIMATE_ID_SCOPED,
    field_id: FIELD_ID,
    season_id: SEASON_ID,
    state: 'MODERATE_DEFICIT',
    root_zone_soil_moisture_percent: sensingWindow.summary.last_value,
    target_min_soil_moisture_percent: irrigationRequirement.target_min_soil_moisture_percent,
    target_max_soil_moisture_percent: irrigationRequirement.target_max_soil_moisture_percent,
    net_irrigation_mm: irrigationRequirement.net_irrigation_mm,
    gross_irrigation_requirement_mm: irrigationRequirement.gross_irrigation_requirement_mm,
    source_sensing_window_id: sensingWindow.window_id,
    source_forecast_id: weatherForecast.forecast_id,
    source_requirement_id: irrigationRequirement.requirement_id,
    source_input_id: irrigationRequirement.source_input_id,
    source_sensing_window_fact_id: SENSING_WINDOW_FACT_ID,
    source_weather_fact_id: `${pre}_weather_forecast_c8_irrigation_001`,
    source_requirement_fact_id: `${pre}_irrigation_requirement_c8_001`,
    input_refs: {
      sensing_window_id: sensingWindow.window_id,
      sensing_window_fact_id: SENSING_WINDOW_FACT_ID,
      weather_forecast_id: weatherForecast.forecast_id,
      weather_fact_id: `${pre}_weather_forecast_c8_irrigation_001`,
      weather_issue_time: weatherForecast.issue_time,
      weather_forecast_version: weatherForecast.forecast_version,
      weather_provider_run_id: weatherForecast.provider_run_id,
      weather_external_forecast_id: weatherForecast.external_forecast_id,
      requirement_id: irrigationRequirement.requirement_id,
      requirement_fact_id: `${pre}_irrigation_requirement_c8_001`,
      source_input_id: irrigationRequirement.source_input_id,
    },
    evidence_refs: [
      sensingWindow.window_id,
      weatherForecast.forecast_id,
      irrigationRequirement.requirement_id,
      SENSING_WINDOW_FACT_ID,
      `${pre}_weather_forecast_c8_irrigation_001`,
      `${pre}_irrigation_requirement_c8_001`,
    ],
    calculation_inputs: {
      soil_moisture_percent: sensingWindow.summary.last_value,
      target_min_soil_moisture_percent: irrigationRequirement.target_min_soil_moisture_percent,
      target_max_soil_moisture_percent: irrigationRequirement.target_max_soil_moisture_percent,
      net_irrigation_mm: irrigationRequirement.net_irrigation_mm,
      gross_irrigation_requirement_mm: irrigationRequirement.gross_irrigation_requirement_mm,
      sensing_window_quality_status: sensingWindow.quality_status,
      weather_provider_status: weatherForecast.quality.provider_status,
      weather_stale: weatherForecast.quality.stale,
    },
    derivation: {
      derivation_type: 'water_state_estimate_from_sensing_weather_requirement_v1',
      deterministic: true,
      rule_version: 'water_state_estimate_v1',
      reason_codes: [],
    },
    quality: {
      status: 'ESTIMATED',
      reason_codes: [],
      deterministic: true,
    },
    confidence: {
      level: 'HIGH',
      score: 0.9,
      basis: 'sensing_window_weather_requirement_bound_v1',
    },
    created_at: iso,
  };
  const waterStateEstimateUnknown = {
    estimate_id: WATER_STATE_UNKNOWN_ESTIMATE_ID,
    field_id: FIELD_ID,
    season_id: SEASON_ID,
    state: 'UNKNOWN',
    root_zone_soil_moisture_percent: sensingWindowFail.summary.last_value,
    target_min_soil_moisture_percent: irrigationRequirement.target_min_soil_moisture_percent,
    target_max_soil_moisture_percent: irrigationRequirement.target_max_soil_moisture_percent,
    net_irrigation_mm: irrigationRequirement.net_irrigation_mm,
    gross_irrigation_requirement_mm: irrigationRequirement.gross_irrigation_requirement_mm,
    source_sensing_window_id: sensingWindowFail.window_id,
    source_forecast_id: weatherForecast.forecast_id,
    source_requirement_id: irrigationRequirement.requirement_id,
    source_input_id: irrigationRequirement.source_input_id,
    source_sensing_window_fact_id: SENSING_WINDOW_FAIL_FACT_ID,
    source_weather_fact_id: `${pre}_weather_forecast_c8_irrigation_001`,
    source_requirement_fact_id: `${pre}_irrigation_requirement_c8_001`,
    input_refs: {
      sensing_window_id: sensingWindowFail.window_id,
      sensing_window_fact_id: SENSING_WINDOW_FAIL_FACT_ID,
      sensing_window_quality_status: sensingWindowFail.quality_status,
      weather_forecast_id: weatherForecast.forecast_id,
      weather_fact_id: `${pre}_weather_forecast_c8_irrigation_001`,
      weather_issue_time: weatherForecast.issue_time,
      weather_forecast_version: weatherForecast.forecast_version,
      weather_provider_run_id: weatherForecast.provider_run_id,
      weather_external_forecast_id: weatherForecast.external_forecast_id,
      requirement_id: irrigationRequirement.requirement_id,
      requirement_fact_id: `${pre}_irrigation_requirement_c8_001`,
      source_input_id: irrigationRequirement.source_input_id,
    },
    evidence_refs: [
      sensingWindowFail.window_id,
      weatherForecast.forecast_id,
      irrigationRequirement.requirement_id,
      SENSING_WINDOW_FAIL_FACT_ID,
      `${pre}_weather_forecast_c8_irrigation_001`,
      `${pre}_irrigation_requirement_c8_001`,
    ],
    calculation_inputs: {
      soil_moisture_percent: sensingWindowFail.summary.last_value,
      target_min_soil_moisture_percent: irrigationRequirement.target_min_soil_moisture_percent,
      target_max_soil_moisture_percent: irrigationRequirement.target_max_soil_moisture_percent,
      net_irrigation_mm: irrigationRequirement.net_irrigation_mm,
      gross_irrigation_requirement_mm: irrigationRequirement.gross_irrigation_requirement_mm,
      sensing_window_quality_status: sensingWindowFail.quality_status,
      sensing_window_actual_points: sensingWindowFail.actual_points,
      sensing_window_coverage_ratio: sensingWindowFail.coverage_ratio,
      weather_provider_status: weatherForecast.quality.provider_status,
      weather_stale: weatherForecast.quality.stale,
    },
    derivation: {
      derivation_type: 'water_state_estimate_from_sensing_weather_requirement_v1',
      deterministic: true,
      rule_version: 'water_state_estimate_v1',
      reason_codes: ['SENSING_WINDOW_NOT_PASS'],
    },
    quality: {
      status: 'UNKNOWN',
      reason_codes: ['SENSING_WINDOW_NOT_PASS'],
      deterministic: true,
    },
    confidence: {
      level: 'LOW',
      score: 0.2,
      basis: 'insufficient_water_state_evidence_v1',
    },
    created_at: iso,
  };
  const irrigationScenarioSet = deriveC8IrrigationScenarioSetV1({
    scenario_set_id: IRRIGATION_SCENARIO_SET_ID_SCOPED,
    water_state_estimate: waterStateEstimate,
    irrigation_requirement: irrigationRequirement,
    weather_forecast: weatherForecast,
    sensing_window: sensingWindow,
    water_state_fact_id: `${pre}_water_state_estimate_c8_001`,
    sensing_window_fact_id: SENSING_WINDOW_FACT_ID,
    weather_fact_id: `${pre}_weather_forecast_c8_irrigation_001`,
    requirement_fact_id: `${pre}_irrigation_requirement_c8_001`,
    created_at: iso,
  });
  const irrigationScenarioSetUnknown = deriveC8IrrigationScenarioSetV1({
    scenario_set_id: IRRIGATION_SCENARIO_UNKNOWN_SET_ID,
    water_state_estimate: waterStateEstimateUnknown,
    irrigation_requirement: irrigationRequirement,
    weather_forecast: weatherForecast,
    sensing_window: sensingWindowFail,
    water_state_fact_id: `${pre}_water_state_estimate_c8_unknown_001`,
    sensing_window_fact_id: SENSING_WINDOW_FAIL_FACT_ID,
    weather_fact_id: `${pre}_weather_forecast_c8_irrigation_001`,
    requirement_fact_id: `${pre}_irrigation_requirement_c8_001`,
    created_at: iso,
  });
  const formalRequirementAmountSource = {
    source_type: 'irrigation_requirement_v1',
    requirement_id: REQUIREMENT_ID,
    source_field: 'gross_irrigation_requirement_mm',
    source_fact_id: `${pre}_irrigation_requirement_c8_001`,
    source_value_mm: irrigationRequirement.gross_irrigation_requirement_mm,
    source_forecast_id: irrigationRequirement.source_forecast_id,
    skill_id: irrigationRequirement.skill_id,
    skill_version: irrigationRequirement.skill_version,
    skill_run_id: irrigationRequirement.skill_run_id
  };
  const plannedIrrigationAmountMm = Number(irrigationRequirement.gross_irrigation_requirement_mm);
  const recommendation = deriveC8DecisionRecommendationFromScenarioRequirementV1({
    recommendation_id: RECOMMENDATION_ID,
    water_state_estimate: waterStateEstimate,
    irrigation_scenario_set: irrigationScenarioSet,
    irrigation_requirement: irrigationRequirement,
    selected_scenario_option_id: 'irrigate_22mm',
    target_device_id: 'dev_valve_pump_c8_001',
    amount_source: formalRequirementAmountSource,
    water_state_fact_id: `${pre}_water_state_estimate_c8_001`,
    scenario_set_fact_id: `${pre}_irrigation_scenario_set_c8_001`,
    requirement_fact_id: `${pre}_irrigation_requirement_c8_001`,
    created_at: iso,
  });
  const recommendationUnknown = deriveC8DecisionRecommendationFromScenarioRequirementV1({
    recommendation_id: RECOMMENDATION_UNKNOWN_ID,
    water_state_estimate: waterStateEstimateUnknown,
    irrigation_scenario_set: irrigationScenarioSetUnknown,
    irrigation_requirement: irrigationRequirement,
    selected_scenario_option_id: 'irrigate_22mm',
    target_device_id: 'dev_valve_pump_c8_001',
    amount_source: formalRequirementAmountSource,
    water_state_fact_id: `${pre}_water_state_estimate_c8_unknown_001`,
    scenario_set_fact_id: `${pre}_irrigation_scenario_set_c8_unknown_001`,
    requirement_fact_id: `${pre}_irrigation_requirement_c8_001`,
    created_at: iso,
  });
  const executedIrrigationAmountMm = Number((plannedIrrigationAmountMm * IRRIGATION_EXECUTION_RATIO).toFixed(3));
  const waterUsageLiters = Math.round(executedIrrigationAmountMm * FIELD_AREA_M2);
  const operationPlan = { operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, field_id: FIELD_ID, field_name: 'C8 灌溉示范田', season_id: SEASON_ID, recommendation_id: RECOMMENDATION_ID, requirement_id: REQUIREMENT_ID, source_requirement_id: REQUIREMENT_ID, prescription_id: PRESCRIPTION_ID, approval_request_id: APPROVAL_ID, act_task_id: TASK_ID, operation_type: 'IRRIGATION', action_type: 'IRRIGATION', planned_amount: plannedIrrigationAmountMm, planned_unit: 'mm', planned_amount_source: formalRequirementAmountSource, amount_source: formalRequirementAmountSource, target_device_id: 'dev_valve_pump_c8_001', spatial_scope: { kind: 'field', field_id: FIELD_ID }, expected_evidence: ['water_delivery_receipt', 'post_soil_moisture_metric'], before_metrics: { soil_moisture: 18.4 }, after_metrics: { soil_moisture: 24.8 }, final_status: 'SUCCESS', status: 'APPROVED' };
  const task = { act_task_id: TASK_ID, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, prescription_id: PRESCRIPTION_ID, requirement_id: REQUIREMENT_ID, source_requirement_id: REQUIREMENT_ID, field_id: FIELD_ID, device_id: 'dev_valve_pump_c8_001', action_type: 'IRRIGATION', status: 'ACKED', parameters: { amount: plannedIrrigationAmountMm, amount_mm: plannedIrrigationAmountMm, unit: 'mm', source_requirement_id: REQUIREMENT_ID, amount_source: formalRequirementAmountSource, target_soil_moisture_percent: IRRIGATION_TARGET_SOIL_MOISTURE_PERCENT, safety: { manual_approval_required: true } }, evidence_requirements: ['water_delivery_receipt', 'post_soil_moisture_metric'], meta: { device_id: 'dev_valve_pump_c8_001', field_id: FIELD_ID, prescription_id: PRESCRIPTION_ID, requirement_id: REQUIREMENT_ID, amount_source: formalRequirementAmountSource } };
  const receipt = { receipt_id: RECEIPT_ID, act_task_id: TASK_ID, task_id: TASK_ID, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, prescription_id: PRESCRIPTION_ID, requirement_id: REQUIREMENT_ID, source_requirement_id: REQUIREMENT_ID, field_id: FIELD_ID, status: 'executed', execution_time: { start_ts: ts - 1200000, end_ts: ts - 900000 }, observed_parameters: { amount: executedIrrigationAmountMm, executed_amount: executedIrrigationAmountMm, planned_amount: plannedIrrigationAmountMm, planned_amount_source: formalRequirementAmountSource, unit: 'mm', coverage_percent: 100, before_soil_moisture: 18.4, after_soil_moisture: 24.8, soil_moisture_delta: 6.4 }, resource_usage: { water_l: waterUsageLiters, electric_kwh: 7.2 }, labor: { duration_minutes: 38, worker_count: 1 }, execution_coverage: { kind: 'field', ref: FIELD_ID }, evidence_refs: ['ev_c8_irrigation_water_delivery_001', 'ev_c8_irrigation_metric_001'], evidence_artifact_ids: ['ev_c8_irrigation_water_delivery_001', 'ev_c8_irrigation_metric_001'], logs_refs: [{ kind: 'valve_open_confirmation' }] };
  const acceptance = { acceptance_id: ACCEPTANCE_ID, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, act_task_id: TASK_ID, task_id: TASK_ID, field_id: FIELD_ID, verdict: 'PASS', formal_acceptance: true, formal_evidence_passed: true, chain_validation_passed: true, source_lane: 'FORMAL_OPERATION', customer_visible_eligible: true, is_simulated: false, evidence_refs: ['ev_c8_irrigation_water_delivery_001', 'ev_c8_irrigation_metric_001'], metrics: { before_soil_moisture: 18.4, after_soil_moisture: 24.8, soil_moisture_delta: 6.4 } };
  const formalMemory = { memory_id: MEMORY_ID, tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, operation_id: FORMAL_OP, task_id: TASK_ID, recommendation_id: RECOMMENDATION_ID, prescription_id: PRESCRIPTION_ID, acceptance_id: ACCEPTANCE_ID, formal_acceptance_id: ACCEPTANCE_ID, memory_type: 'FIELD_RESPONSE_MEMORY', memory_lane: 'FORMAL_FIELD_MEMORY', trust_level: 'FORMAL_ACCEPTED', source_lane: 'FORMAL_OPERATION', customer_visible_memory: true, learning_eligible: true, compatibility_fallback: true, projection_support_only: true, not_authoritative_formal_result: true, formal_result_must_be_derived: true, static_seed_row_reason: 'Kept only as an optional compatibility projection fixture while customer-visible formal memory is derived through POST /api/v1/field-memory/from-acceptance.', before_value: 18.4, after_value: 24.8, delta_value: 6.4, metric_key: 'soil_moisture_response', confidence: 0.95, summary_text: 'C8 灌溉后 20cm 土层水分从 18.4% 回升到 24.8%，达到目标区间。', summary: 'C8 灌溉后 20cm 土层水分从 18.4% 回升到 24.8%，达到目标区间。', evidence_refs: ['ev_c8_irrigation_water_delivery_001', 'ev_c8_irrigation_metric_001'], trust_reasons: ['FORMAL_ACCEPTANCE_PASS', 'FORMAL_FIELD_OBSERVATION_PAIR_FOUND'], occurred_at: iso, created_at: iso, updated_at: iso };
  const technicalMemory = { memory_id: 'fm_c8_technical_skill_001', tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, operation_id: FORMAL_OP, memory_type: 'SKILL_PERFORMANCE_MEMORY', memory_lane: 'TECHNICAL_SKILL_MEMORY', trust_level: 'TECHNICAL_SIGNAL', source_lane: 'SKILL_TECHNICAL', customer_visible_memory: false, learning_eligible: false, compatibility_fallback: true, projection_support_only: true, summary_text: '内部技能调试记忆，不可客户可见。', occurred_at: iso, created_at: iso, updated_at: iso };
  const facts = [fact('field_crop_season_c8_001', 'field_crop_season_v1', { ...field, status: 'ACTIVE' }),
    { fact_id: SENSING_WINDOW_FACT_ID, occurred_at: iso, source: SOURCE, record_json: { type: 'soil_moisture_sensing_window_v1', payload: { ...ctx, ...sensingWindow } } },
    { fact_id: `${SENSING_WINDOW_FACT_ID}_index`, occurred_at: iso, source: SOURCE, record_json: { type: 'soil_moisture_sensing_window_index_v1', payload: { ...ctx, ...sensingWindowIndex } } },
    { fact_id: SENSING_WINDOW_FAIL_FACT_ID, occurred_at: iso, source: SOURCE, record_json: { type: 'soil_moisture_sensing_window_v1', payload: { ...ctx, ...sensingWindowFail } } },
    { fact_id: `${SENSING_WINDOW_FAIL_FACT_ID}_index`, occurred_at: iso, source: SOURCE, record_json: { type: 'soil_moisture_sensing_window_index_v1', payload: { ...ctx, ...sensingWindowFailIndex } } },
    fact('weather_forecast_c8_irrigation_001', 'weather_forecast_fact_v1', weatherForecast), fact('weather_forecast_c8_irrigation_stale_001', 'weather_forecast_fact_v1', staleWeatherForecast), fact('irrigation_requirement_skill_input_c8_001', 'irrigation_requirement_skill_input_v1', irrigationRequirementSkillInputArtifact), fact('irrigation_requirement_c8_001', 'irrigation_requirement_v1', irrigationRequirement), fact('water_state_estimate_c8_001', 'water_state_estimate_v1', waterStateEstimate), fact('water_state_estimate_c8_unknown_001', 'water_state_estimate_v1', waterStateEstimateUnknown), fact('irrigation_scenario_set_c8_001', 'irrigation_scenario_set_v1', irrigationScenarioSet), fact('irrigation_scenario_set_c8_unknown_001', 'irrigation_scenario_set_v1', irrigationScenarioSetUnknown), ...devices.map((d) => fact(`device_context_${d[0]}`, 'device_observation_context_v1', { device_id: d[0], field_id: d[2], display_name: d[1], display_kind_text: d[4], sensing_role_text: d[5], capability_text: d[6], field_role_text: d[7], online_status: d[0] === 'dev_gateway_offline_001' ? 'OFFLINE' : 'ONLINE' })), fact('rec_c8_irrigation_001', 'decision_recommendation_v1', recommendation), fact('rec_c8_irrigation_unknown_001', 'decision_recommendation_v1', recommendationUnknown), fact('stage1_c8_irrigation_sensing_001', 'stage1_sensing_summary_v1', { stage1_sensing_summary_id: 'stage1_c8_irrigation_sensing_001', recommendation_id: RECOMMENDATION_ID, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, field_id: FIELD_ID, source_lane: 'FORMAL_OPERATION', formal_trigger: true, formal_evidence_passed: true, passed: true, status: 'PASSED', is_simulated: false, metrics: { soil_moisture_percent: 18.4, forecast_rain_72h_mm: 2 } }), fact('presc_c8_irrigation_001', 'prescription_v1', { prescription_id: PRESCRIPTION_ID, recommendation_id: RECOMMENDATION_ID, requirement_id: REQUIREMENT_ID, source_requirement_id: REQUIREMENT_ID, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, field_id: FIELD_ID, season_id: SEASON_ID, operation_type: 'IRRIGATION', action_type: 'IRRIGATION', amount: plannedIrrigationAmountMm, planned_amount: plannedIrrigationAmountMm, unit: 'mm', amount_source: formalRequirementAmountSource, status: 'AVAILABLE' }), fact('approval_c8_irrigation_001', 'approval_request_v1', { request_id: APPROVAL_ID, approval_request_id: APPROVAL_ID, recommendation_id: RECOMMENDATION_ID, operation_plan_id: FORMAL_OP, field_id: FIELD_ID, status: 'APPROVED' }), fact('approval_decision_c8_irrigation_001', 'approval_decision_v1', approvalDecision), fact(FORMAL_OP, 'operation_plan_v1', operationPlan), ...['CREATED','APPROVAL_REQUESTED','APPROVED','READY','DISPATCHED','ACKED','EXECUTED','ACCEPTANCE_REQUESTED','ACCEPTED'].map((status, i) => fact(`${FORMAL_OP}_transition_${i + 1}`, 'operation_plan_transition_v1', { operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, field_id: FIELD_ID, status, approval_request_id: APPROVAL_ID, act_task_id: TASK_ID })), fact(TASK_ID, 'ao_act_task_v0', task), fact(RECEIPT_ID, 'ao_act_receipt_v1', receipt), fact('ev_c8_irrigation_water_delivery_001', 'evidence_artifact_v1', { evidence_id: 'ev_c8_irrigation_water_delivery_001', operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, act_task_id: TASK_ID, field_id: FIELD_ID, kind: 'water_delivery_receipt', source_lane: 'FORMAL_OPERATION', formal_eligible: true, is_simulated: false, evidence_level: 'FORMAL' }), fact('ev_c8_irrigation_metric_001', 'evidence_artifact_v1', { evidence_id: 'ev_c8_irrigation_metric_001', operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, act_task_id: TASK_ID, field_id: FIELD_ID, kind: 'metric', source_lane: 'FORMAL_OPERATION', formal_eligible: true, is_simulated: false, evidence_level: 'FORMAL' }), fact(ACCEPTANCE_ID, 'acceptance_result_v1', acceptance), fact('value_c8_irrigation_formal_001', 'value_record_v1', { value_record_id: 'value_c8_irrigation_formal_001', operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, field_id: FIELD_ID, value_text: '灌溉后土壤水分回升，形成可信价值记录。', customer_visible_eligible: true })];
  if (!formalScoped) facts.push(fact('rec_c8_irrigation_pending_001', 'decision_recommendation_v1', { recommendation_id: 'rec_c8_irrigation_pending_001', field_id: FIELD_ID }), fact('approval_c8_irrigation_pending_001', 'approval_request_v1', { request_id: 'approval_c8_irrigation_pending_001', operation_plan_id: PENDING_OP, status: 'APPROVED' }), fact(PENDING_OP, 'operation_plan_v1', { operation_plan_id: PENDING_OP, operation_id: PENDING_OP, field_id: FIELD_ID, final_status: 'PENDING_ACCEPTANCE' }), fact('act_c8_irrigation_pending_001', 'ao_act_task_v0', { act_task_id: 'act_c8_irrigation_pending_001', operation_plan_id: PENDING_OP, field_id: FIELD_ID }), fact('receipt_c8_irrigation_pending_001', 'ao_act_receipt_v1', { receipt_id: 'receipt_c8_irrigation_pending_001', act_task_id: 'act_c8_irrigation_pending_001', operation_plan_id: PENDING_OP, status: 'executed' }), fact('acc_c8_irrigation_pending_001', 'acceptance_result_v1', { acceptance_id: 'acc_c8_irrigation_pending_001', operation_plan_id: PENDING_OP, verdict: 'PENDING', formal_acceptance: false }), fact('rec_c8_pest_inspection_pending_001', 'decision_recommendation_v1', { recommendation_id: 'rec_c8_pest_inspection_pending_001', field_id: FIELD_ID }), fact('approval_c8_pest_pending_001', 'approval_request_v1', { request_id: 'approval_c8_pest_pending_001', field_id: FIELD_ID, status: 'PENDING' }), fact('marker_aggregate_missing_location_001', 'controlled_pilot_full_review_marker_v1', { marker_id: 'aggregate_missing_location_001', scenario: 'D', source: 'aggregate', status: 'READ_ONLY' }));
  for (const observation of observations) facts.push(fact(observation.fact_id.replace(`${pre}_`, ''), 'telemetry_observation_v1', { observation_id: observation.observation_id, device_id: observation.device_id, field_id: observation.field_id, metric: observation.metric, metric_label: observation.metric_label, metric_role: observation.metric_role, diagnostic_use: observation.diagnostic_use, threshold_ref: observation.threshold_ref, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, value_num: observation.value_num, unit: observation.unit, ts: observation.ts, observed_at: observation.observed_at, observed_at_ts_ms: observation.observed_at_ts_ms, confidence: observation.confidence, quality_flags_json: observation.quality_flags_json }));
  if (!formalE2E) for (const stage of ['before_recommendation','after_recommendation','before_dispatch','before_acceptance']) facts.push(fact(`skill_run_${stage}_001`, 'skill_run_v1', { skill_run_id: `skill_run_${stage}_001`, trigger_stage: stage, field_id: FIELD_ID, operation_plan_id: FORMAL_OP, operation_id: FORMAL_OP, skill_id: 'agronomy_irrigation_v1', version: 'v1', result_status: 'SUCCESS', error_code: 'NONE' }));
  if (formalE2E) { for (let i = facts.length - 1; i >= 0; i -= 1) if (['stage1_sensing_summary_v1','value_record_v1'].includes(facts[i]?.record_json?.type)) facts.splice(i, 1); }
  const device_index_v1 = devices.map((d) => ({ tenant_id: tenant, device_id: d[0], display_name: d[1], display_kind_text: d[4], field_role_text: d[7], created_ts_ms: ts }));
  const device_binding_index_v1 = devices.map((d) => ({ tenant_id: tenant, device_id: d[0], field_id: d[2], bound_ts_ms: ts }));
  const device_status_index_v1 = devices.map((d) => ({ tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, device_id: d[0], last_telemetry_ts_ms: ts, last_heartbeat_ts_ms: ts, updated_ts_ms: ts }));
  const device_capability = devices.map((d) => ({ tenant_id: tenant, device_id: d[0], capabilities: d[3], display_kind_text: d[4], sensing_role_text: d[5], capability_text: d[6], field_role_text: d[7], updated_ts_ms: ts }));
  const prescription_contract_v1 = [{ prescription_id: PRESCRIPTION_ID, recommendation_id: RECOMMENDATION_ID, tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, field_id: FIELD_ID, season_id: SEASON_ID, crop_id: 'corn', zone_id: 'whole_field', operation_type: 'IRRIGATION', spatial_scope: { kind: 'field', field_id: FIELD_ID }, operation_amount: { amount: plannedIrrigationAmountMm, value: plannedIrrigationAmountMm, unit: 'mm', metadata: { trace_id: 'skill_trace_c8_irrigation_001', requirement_id: REQUIREMENT_ID, source_requirement_id: REQUIREMENT_ID, source_type: 'irrigation_requirement_v1', source_field: 'gross_irrigation_requirement_mm', source_value_mm: plannedIrrigationAmountMm, source_fact_id: `${pre}_irrigation_requirement_c8_001` } }, device_requirements: { device_id: 'dev_valve_pump_c8_001' }, status: 'APPROVED', skill_trace_id: 'skill_trace_c8_irrigation_001', skill_trace: { skill_id: 'agronomy_irrigation_v1', skill_version: 'v1', trace_id: 'skill_trace_c8_irrigation_001' } }];
  const field_memory_v1_optional = [formalMemory, technicalMemory];
  const alert_event_index_v1 = formalScoped ? [] : [{ tenant_id: tenant, event_id: 'alert_dev_gateway_offline_001', rule_id: 'rule_device_offline_001', object_type: 'device', object_id: 'dev_gateway_offline_001', metric: 'heartbeat', status: 'OPEN', raised_ts_ms: ts }, { tenant_id: tenant, event_id: 'alert_aggregate_missing_location_001', rule_id: 'rule_aggregate_missing_location_001', object_type: 'aggregate', object_id: 'aggregate_missing_location_001', metric: 'location', status: 'READ_ONLY', raised_ts_ms: ts }];
  const operation_state_v1_optional = [{ tenant_id: tenant, project_id: PROJECT_ID, group_id: GROUP_ID, operation_id: FORMAL_OP, operation_plan_id: FORMAL_OP, field_id: FIELD_ID, task_id: TASK_ID, act_task_id: TASK_ID, receipt_id: RECEIPT_ID, recommendation_id: RECOMMENDATION_ID, requirement_id: REQUIREMENT_ID, prescription_id: PRESCRIPTION_ID, approval_request_id: APPROVAL_ID, planned_amount: plannedIrrigationAmountMm, planned_unit: 'mm', amount_source: formalRequirementAmountSource, final_status: 'SUCCESS', status: 'SUCCESS', action_type: 'IRRIGATION' }].concat(formalScoped ? [] : [{ tenant_id: tenant, operation_id: PENDING_OP, operation_plan_id: PENDING_OP, field_id: FIELD_ID, final_status: 'PENDING_ACCEPTANCE', status: 'PENDING_ACCEPTANCE' }]);
  const tables = { field_index_v1: fields, field_polygon_v1: polygons, device_index_v1, device_binding_index_v1, device_status_index_v1, device_capability, telemetry_index_v1: observations.map((o) => ({ tenant_id: tenant, device_id: o.device_id, metric: o.metric, ts: o.ts, value_num: o.value_num, fact_id: o.fact_id })), device_observation_index_v1: observations, soil_moisture_sensing_window_index_v1: [sensingWindowIndex, sensingWindowFailIndex], alert_event_index_v1, prescription_contract_v1, field_memory_v1_optional, approval_requests_v1: formalScoped ? [] : [{ tenant_id: tenant, request_id: 'approval_c8_pest_pending_001', approval_request_id: 'approval_c8_pest_pending_001', field_id: FIELD_ID, status: 'PENDING' }], operation_state_v1_optional, roi_ledger_v1_optional: [] };
  const owned = { fields: ['field_c8_demo','field_1_demo','field_device_risk_demo'], devices: ['dev_soil_c8_001','dev_valve_pump_c8_001','dev_gateway_offline_001','dev_weather_station_c8_001'], operations: [FORMAL_OP, PENDING_OP], approval_requests: [APPROVAL_ID,'approval_c8_irrigation_pending_001','approval_c8_pest_pending_001'], field_memory_optional: [MEMORY_ID, 'fm_c8_technical_skill_001'], prescriptions: [PRESCRIPTION_ID], alerts: ['alert_dev_gateway_offline_001','alert_aggregate_missing_location_001'], roi_ledgers: [ROI_ID], irrigation_requirements: [REQUIREMENT_ID], irrigation_scenario_sets: [IRRIGATION_SCENARIO_SET_ID_SCOPED, IRRIGATION_SCENARIO_UNKNOWN_SET_ID], decision_recommendations: [RECOMMENDATION_ID, RECOMMENDATION_UNKNOWN_ID] };
  const manifest = { ...ctx, seed_owned_by: SOURCE_LANE, seed_owned_ids: owned, profile, formalized_by_seed: true, field_memory_written_by_seed: false, field_memory_flow: ['acceptance_result_v1','POST /api/v1/field-memory/from-acceptance','GET /api/v1/customer/fields/field_c8_demo/memory'], field_memory_contract: { optional_rows_table: 'field_memory_v1_optional', derived_table: 'field_memory_v1', derived_endpoint: 'POST /api/v1/field-memory/from-acceptance', customer_verification_endpoint: 'GET /api/v1/customer/fields/field_c8_demo/memory' }, governance_acceptance: { static_formal_memory_retained_reason: 'Optional compatibility/projection fixture retained for export and dry-run contract review only; apply skips *_optional tables.', static_formal_memory_is_only_pass_source: false, required_formal_memory_source: 'POST /api/v1/field-memory/from-acceptance', required_customer_memory_verification: 'GET /api/v1/customer/fields/field_c8_demo/memory' }, roi_flow: ['as_executed_record_v1','AS_EXECUTED_SIGNAL','FORMAL_ACCEPTANCE'], irrigation_requirement_flow: ['telemetry_observation_v1','soil_moisture_sensing_window_v1','soil_moisture_sensing_window_index_v1','weather_forecast_fact_v1','telemetry_index_v1','device_observation_index_v1','irrigation_requirement_skill_input','irrigation_requirement_v1','irrigation_requirement_index_v1','water_state_estimate_v1','water_state_estimate_index_v1','irrigation_scenario_set_v1','irrigation_scenario_set_index_v1','decision_recommendation_v1','prescription_contract_v1','operation_plan_v1','ao_act_task_v0'], amount_source_chain: ['irrigation_requirement_v1.gross_irrigation_requirement_mm','decision_recommendation_v1.suggested_action.water_mm','prescription_contract_v1.operation_amount.amount','operation_plan_v1.planned_amount','ao_act_task_v0.parameters.amount_mm'], profile_scope: formalScoped ? { formal_chain_only: true, includes_pending_irrigation: false, includes_pest_pending: false, includes_offline_gateway: false, includes_aggregate_missing_location: false, includes_control_fields: false } : { formal_chain_only: false } };
  facts.push(fact('manifest_v1', 'controlled_pilot_full_review_manifest_v1', manifest));
  const fbt = factsByType(facts);
  const roi = { roi_ledger_id: ROI_ID, operation_id: FORMAL_OP, task_id: TASK_ID, prescription_id: PRESCRIPTION_ID, as_executed_id: '<actual_as_executed_id>', formal_acceptance_id: ACCEPTANCE_ID, source_lane: 'FORMAL_ACCEPTANCE', trust_level: 'FORMAL_ACCEPTED', formal_evidence_passed: true, chain_validation_passed: true, customer_visible_value: true, roi_type: 'SOIL_MOISTURE_RESPONSE', value_kind: 'MEASURED', before_value: 18.4, after_value: 24.8, actual_value: executedIrrigationAmountMm, delta_value: 6.4 };
  const evidenceArtifacts = fbt.evidence_artifact_v1.map(payloadOf);
  const production_evidence = {
    production_evidence_id: PRODUCTION_EVIDENCE_ID,
    operation_plan_id: FORMAL_OP,
    operation_id: FORMAL_OP,
    act_task_id: TASK_ID,
    task_id: TASK_ID,
    receipt_id: RECEIPT_ID,
    acceptance_id: ACCEPTANCE_ID,
    field_id: FIELD_ID,
    source_lane: 'FORMAL_OPERATION',
    formal_evidence_passed: acceptance.formal_evidence_passed === true,
    chain_validation_passed: acceptance.chain_validation_passed === true,
    is_simulated: false,
    required_evidence_kinds: task.evidence_requirements,
    observed_evidence_kinds: evidenceArtifacts.map((x) => x.kind).filter(Boolean),
    evidence_artifact_ids: receipt.evidence_artifact_ids,
    evidence_artifacts: evidenceArtifacts,
    formal_evidence: {
      source_lane: 'FORMAL_OPERATION',
      required_count: task.evidence_requirements.length,
      observed_count: evidenceArtifacts.length,
      formal_eligible_count: evidenceArtifacts.filter((x) => x.formal_eligible === true).length,
      simulated_count: evidenceArtifacts.filter((x) => x.is_simulated === true).length,
      evidence_levels: Array.from(new Set(evidenceArtifacts.map((x) => x.evidence_level).filter(Boolean)))
    },
    acceptance: {
      acceptance_id: acceptance.acceptance_id,
      verdict: acceptance.verdict,
      formal_acceptance: acceptance.formal_acceptance,
      formal_evidence_passed: acceptance.formal_evidence_passed,
      chain_validation_passed: acceptance.chain_validation_passed
    },
    as_executed_expected: {
      derivation: '/api/v1/as-executed/from-receipt',
      requirement_id: REQUIREMENT_ID,
      planned_amount: plannedIrrigationAmountMm,
      planned_amount_source: formalRequirementAmountSource,
      executed_amount: executedIrrigationAmountMm,
      unit: 'mm',
      status: 'CONFIRMED'
    }
  };
  const formal_chain = { chain_id: CHAIN_ID, field, weather_forecast_version: weatherForecast, weather_forecast_stale_negative_fixture: staleWeatherForecast, soil_moisture_sensing_window: sensingWindow, soil_moisture_sensing_window_fail_fixture: sensingWindowFail, soil_moisture_sensing_window_negative_fixture: sensingWindowFail, boundary: polygons[0], irrigation_requirement_skill_input: irrigationRequirementSkillInputArtifact, irrigation_requirement: irrigationRequirement, water_state_estimate: waterStateEstimate, water_state_estimate_unknown_fixture: waterStateEstimateUnknown, irrigation_scenario_set: irrigationScenarioSet, irrigation_scenario_set_unknown_fixture: irrigationScenarioSetUnknown, devices: devices.filter((d) => d[0] !== 'dev_gateway_offline_001').map((d) => ({ device_id: d[0], display_name: d[1], field_id: d[2], capabilities: d[3], display_kind_text: d[4], sensing_role_text: d[5], capability_text: d[6], field_role_text: d[7] })), observations, diagnosis: recommendation.diagnosis, recommendation, prescription: prescription_contract_v1[0], approval: { request: { request_id: APPROVAL_ID }, decision: approvalDecision }, operation_plan: operationPlan, ao_act_task: task, receipt, as_executed_expected: { derivation: '/api/v1/as-executed/from-receipt', requirement_id: REQUIREMENT_ID, planned_amount: plannedIrrigationAmountMm, planned_amount_source: formalRequirementAmountSource, executed_amount: executedIrrigationAmountMm, unit: 'mm', status: 'CONFIRMED', task_id: TASK_ID, receipt_id: RECEIPT_ID, field_id: FIELD_ID }, as_applied_expected: { field_id: FIELD_ID, coverage_percent: 100 }, evidence: evidenceArtifacts, production_evidence, acceptance, roi, field_memory: formalMemory, report_expectations: { operation_report: ['diagnostic_inputs','prescription','as_executed','as_applied','production_evidence','roi_ledger','field_memory'], field_report: ['field_context','sensing_summary','decision_summary','execution_summary','value_summary','learning_summary'] } };
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
    requirement_id: REQUIREMENT_ID,
    water_state_estimate_id: WATER_STATE_ESTIMATE_ID_SCOPED,
    water_state_estimate_unknown_id: WATER_STATE_UNKNOWN_ESTIMATE_ID,
    irrigation_scenario_set_id: IRRIGATION_SCENARIO_SET_ID_SCOPED,
    irrigation_scenario_set_unknown_id: IRRIGATION_SCENARIO_UNKNOWN_SET_ID,
    skill_input_id: SKILL_INPUT_ID,
    prescription_id: PRESCRIPTION_ID,
    approval_id: APPROVAL_ID,
    task_id: TASK_ID,
    receipt_id: RECEIPT_ID,
    acceptance_id: ACCEPTANCE_ID,
    production_evidence_id: PRODUCTION_EVIDENCE_ID,
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
    'soil_moisture_sensing_window_index_v1',
    'approval_requests_v1',
  ];
  for (const tableName of forbiddenTables) dataset.rows[tableName] = [];
  const forbiddenFactTypes = [
    'soil_moisture_sensing_window_v1',
    'soil_moisture_sensing_window_index_v1',
  ];
  dataset.facts = dataset.facts.filter((fact) => !forbiddenFactTypes.includes(String(fact?.record_json?.type || '')));
  const manifest = dataset.metadata.manifest;
  manifest.raw_to_report_e2e = true;
  manifest.formalized_by_seed = false;
  manifest.field_memory_written_by_seed = false;
  manifest.field_memory_flow = ['acceptance_result_v1', 'field-memory/from-acceptance', 'POST /api/v1/field-memory/from-acceptance', 'field_memory_v1', 'GET /api/v1/customer/fields/field_c8_demo/memory'];
  manifest.seed_forbidden_projection_tables = forbiddenTables;
  manifest.seed_forbidden_fact_types = forbiddenFactTypes;
  manifest.irrigation_requirement_flow = (manifest.irrigation_requirement_flow || []).filter((item) => !forbiddenFactTypes.includes(item) && !forbiddenTables.includes(item));
  if (dataset.metadata.formal_chain) {
    delete dataset.metadata.formal_chain.soil_moisture_sensing_window;
    delete dataset.metadata.formal_chain.soil_moisture_sensing_window_fail_fixture;
    delete dataset.metadata.formal_chain.soil_moisture_sensing_window_negative_fixture;
  }
  const manifestFact = dataset.facts.find((f) => f?.record_json?.type === 'controlled_pilot_full_review_manifest_v1');
  if (manifestFact) manifestFact.record_json.payload = { ...manifestFact.record_json.payload, ...manifest };
  dataset.metadata.facts_by_type = factsByType(dataset.facts);
  return dataset;
}

module.exports = {
  C8_FORMAL_IRRIGATION_FULL_CHAIN_V1,
  buildC8FormalIrrigationFullChainDataset,
  buildC8SoilMoistureWindowPointsV1,
  deriveC8SoilMoistureSensingWindowV1,
};
