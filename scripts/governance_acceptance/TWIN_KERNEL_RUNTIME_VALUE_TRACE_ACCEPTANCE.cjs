// scripts/governance_acceptance/TWIN_KERNEL_RUNTIME_VALUE_TRACE_ACCEPTANCE.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const ACCEPTANCE = 'TWIN_KERNEL_RUNTIME_VALUE_TRACE_ACCEPTANCE';
const ROOT = process.cwd();

const TS_MODULES = {
  snapshot: 'apps/server/src/domain/twin_kernel/field_state_snapshot_v1.ts',
  forecast: 'apps/server/src/domain/twin_kernel/forecast_run_v1.ts',
  scenario: 'apps/server/src/domain/twin_kernel/scenario_set_v1.ts',
  calibration: 'apps/server/src/domain/twin_kernel/calibration_replay_v1.ts',
  learning: 'apps/server/src/domain/twin_kernel/field_learning_candidate_v1.ts',
  decision: 'apps/server/src/domain/twin_kernel/decision_cycle_v1.ts',
};

function fail(error, details) {
  console.error(JSON.stringify({ ok: false, acceptance: ACCEPTANCE, error, details: details || {} }, null, 2));
  process.exit(1);
}

function assertOk(condition, error, details) {
  if (!condition) fail(error, details);
}

function repoPath(file) {
  return path.resolve(ROOT, file);
}

function loadTypeScript() {
  try {
    return require('typescript');
  } catch (error) {
    fail('TYPESCRIPT_RUNTIME_MISSING', {
      reason: 'This acceptance loads existing TypeScript Twin Kernel builders at runtime.',
      command_hint: 'pnpm install',
    });
  }
}

const ts = loadTypeScript();
const tsModuleCache = new Map();

function requireTs(file) {
  const absolute = repoPath(file);
  assertOk(fs.existsSync(absolute), 'TS_BUILDER_FILE_MISSING', { file });
  if (tsModuleCache.has(absolute)) return tsModuleCache.get(absolute).exports;
  const source = fs.readFileSync(absolute, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
    },
    fileName: absolute,
  }).outputText;
  const mod = new Module(absolute, module);
  mod.filename = absolute;
  mod.paths = Module._nodeModulePaths(path.dirname(absolute));
  tsModuleCache.set(absolute, mod);
  mod._compile(transpiled, absolute);
  return mod.exports;
}

function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
    return out;
  }
  return value;
}

function deterministicFingerprint(trace) {
  const chain = trace.twin_trace.system_derived;
  return JSON.stringify(canonical({
    snapshot_id: chain.field_state_snapshot_v1.snapshot_id,
    snapshot_hash: chain.field_state_snapshot_v1.determinism_hash,
    forecast_run_id: chain.forecast_run_v1.forecast_run_id,
    forecast_hash: chain.forecast_run_v1.determinism_hash,
    scenario_set_id: chain.scenario_set_v1.scenario_set_id,
    scenario_hash: chain.scenario_set_v1.determinism_hash,
    calibration_replay_id: chain.calibration_replay_v1.calibration_replay_id,
    calibration_hash: chain.calibration_replay_v1.determinism_hash,
    forecast_error_id: chain.forecast_error_v1.forecast_error_id,
    forecast_error_hash: chain.forecast_error_v1.determinism_hash,
    field_learning_candidate_id: chain.field_learning_candidate_v1.field_learning_candidate_id,
    learning_hash: chain.field_learning_candidate_v1.determinism_hash,
    decision_cycle_id: chain.decision_cycle_v1.decision_cycle_id,
    decision_hash: chain.decision_cycle_v1.determinism_hash,
  }));
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

const FIXTURE_SCOPE = {
  tenant_id: 'tenantA',
  project_id: 'P_DEFAULT',
  group_id: 'G_C8',
  field_id: 'field_c8_demo',
};

const FIXTURE = {
  scope: FIXTURE_SCOPE,
  season_id: 'season_2026_demo',
  as_of_ts: '2026-06-28T00:00:00.000Z',
  entered_collected: {
    field_row: {
      tenant_id: 'tenantA',
      project_id: 'P_DEFAULT',
      group_id: 'G_C8',
      field_id: 'field_c8_demo',
      field_name: 'C8 Demo Field',
      crop: 'rice',
      area_ha: 3.2,
      source_fact_id: 'fact_field_c8_demo',
      updated_at: '2026-06-27T23:50:00.000Z',
    },
    water_state_row: {
      field_id: 'field_c8_demo',
      water_state: 'LIGHT_DEFICIT',
      soil_moisture_percent: 21.5,
      source_fact_id: 'fact_water_state_c8_20260628',
      computed_at: '2026-06-27T23:55:00.000Z',
      evidence_refs_json: [{ kind: 'water_state_evidence', ref_id: 'ev_water_state_c8_001' }],
    },
    sensing_window_row: {
      field_id: 'field_c8_demo',
      window_id: 'sw_c8_20260628_0000',
      device_id: 'dev_c8_probe_001',
      metric: 'soil_moisture_percent',
      coverage_ratio: 0.92,
      quality_status: 'OK',
      source_fact_id: 'fact_sensing_window_c8_20260628',
      window_end: '2026-06-28T00:00:00.000Z',
    },
    weather_forecast_row: {
      field_id: 'field_c8_demo',
      forecast_id: 'wf_c8_20260628_0000',
      provider: 'fixture_weather_provider',
      forecast_horizon: '72h',
      rain_72h_mm: 2,
      source_fact_id: 'fact_weather_c8_20260628',
      generated_at: '2026-06-27T22:00:00.000Z',
    },
    observed_payload: {
      observed_at: '2026-06-29T12:00:00.000Z',
      post_soil_moisture_percent: 22.4,
      observed_water_state: 'LIGHT_DEFICIT',
      verification_ref_id: 'wrv_c8_irrigation_001',
      evidence_refs: [
        { kind: 'post_irrigation_verification', ref_id: 'wrv_c8_irrigation_001' },
        { kind: 'sensor_observation_pair', ref_id: 'obs_pair_c8_001' },
      ],
    },
  },
  human_confirmed: {
    formal_gate_refs: {
      acceptance_id: 'acc_c8_irrigation_001',
      post_irrigation_verification_id: 'wrv_c8_irrigation_001',
      formal_evidence_ref_id: 'formal_ev_c8_001',
      field_memory_gate_route: '/api/v1/field-memory/from-acceptance',
      evidence_refs: [{ kind: 'formal_gate_evidence', ref_id: 'formal_ev_c8_001' }],
    },
  },
  pointer_refs: {
    recommendation_id: 'rec_c8_candidate_001',
    approval_id: 'appr_c8_human_001',
    operation_plan_id: 'op_plan_c8_irrigation_001',
    act_task_id: 'act_c8_irrigation_001',
    receipt_id: 'receipt_c8_irrigation_001',
    as_executed_id: 'asexec_c8_irrigation_001',
    acceptance_id: 'acc_c8_irrigation_001',
    post_irrigation_verification_id: 'wrv_c8_irrigation_001',
  },
};

function buildTrace() {
  const { buildFieldStateSnapshotV1 } = requireTs(TS_MODULES.snapshot);
  const { buildForecastRunV1 } = requireTs(TS_MODULES.forecast);
  const { buildScenarioSetV1 } = requireTs(TS_MODULES.scenario);
  const { buildCalibrationReplayAndForecastErrorV1 } = requireTs(TS_MODULES.calibration);
  const { buildFieldLearningCandidateV1 } = requireTs(TS_MODULES.learning);
  const { buildDecisionCycleV1 } = requireTs(TS_MODULES.decision);

  const snapshot = buildFieldStateSnapshotV1({
    scope: FIXTURE.scope,
    season_id: FIXTURE.season_id,
    as_of_ts: FIXTURE.as_of_ts,
    sources: {
      field: FIXTURE.entered_collected.field_row,
      water: FIXTURE.entered_collected.water_state_row,
      sensing: FIXTURE.entered_collected.sensing_window_row,
      weather: FIXTURE.entered_collected.weather_forecast_row,
    },
  });

  const forecastRun = buildForecastRunV1({ snapshot });
  const scenarioSet = buildScenarioSetV1({ forecastRun });
  const selectedOption = scenarioSet.option_scenarios_json.find((option) => option.scenario_id === 'irrigation_20mm') || scenarioSet.option_scenarios_json[0];
  const selectedOptionId = selectedOption ? selectedOption.scenario_id : null;

  const { calibrationReplay, forecastError } = buildCalibrationReplayAndForecastErrorV1({
    scenarioSet,
    forecastRun,
    selected_option_id: selectedOptionId,
    observed: FIXTURE.entered_collected.observed_payload,
  });

  const learningCandidate = buildFieldLearningCandidateV1({
    calibrationReplay,
    forecastError,
    formal_gate_refs: FIXTURE.human_confirmed.formal_gate_refs,
  });

  const decisionCycle = buildDecisionCycleV1({
    forecastRun,
    scenarioSet,
    calibrationReplay,
    forecastError,
    fieldLearningCandidate: learningCandidate,
    external_refs: FIXTURE.pointer_refs,
  });

  return {
    ok: true,
    acceptance: ACCEPTANCE,
    twin_trace: {
      scope: FIXTURE.scope,
      as_of_ts: FIXTURE.as_of_ts,
      provenance_classes: {
        entered_collected: Object.keys(FIXTURE.entered_collected),
        system_derived: [
          'field_state_snapshot_v1',
          'forecast_run_v1',
          'scenario_set_v1',
          'calibration_replay_v1',
          'forecast_error_v1',
          'field_learning_candidate_v1',
          'decision_cycle_v1',
        ],
        human_confirmed: Object.keys(FIXTURE.human_confirmed),
        pointer_ref: Object.keys(FIXTURE.pointer_refs),
      },
      entered_collected: FIXTURE.entered_collected,
      human_confirmed: FIXTURE.human_confirmed,
      pointer_refs: FIXTURE.pointer_refs,
      system_derived: {
        field_state_snapshot_v1: snapshot,
        forecast_run_v1: forecastRun,
        scenario_set_v1: scenarioSet,
        calibration_replay_v1: calibrationReplay,
        forecast_error_v1: forecastError,
        field_learning_candidate_v1: learningCandidate,
        decision_cycle_v1: decisionCycle,
      },
      answers: {
        current_field_state: {
          source_object: 'field_state_snapshot_v1',
          water_state: snapshot.state_vector_json.soil_moisture.state,
          soil_moisture_percent: snapshot.state_vector_json.soil_moisture.value,
          confidence_level: snapshot.confidence_json.level,
          evidence_ref_count: snapshot.evidence_refs_json.length,
        },
        seven_day_forecast: {
          source_object: 'forecast_run_v1',
          horizon_days: forecastRun.horizon_days,
          point_count: forecastRun.forecast_points_json.length,
          first_point: forecastRun.forecast_points_json[0],
          last_point: forecastRun.forecast_points_json[forecastRun.forecast_points_json.length - 1],
        },
        scenario_comparison: {
          source_object: 'scenario_set_v1',
          no_action_baseline_present: scenarioSet.baseline_scenario_json.scenario_id === 'no_action',
          option_count: scenarioSet.option_scenarios_json.length,
          selected_option_id: selectedOptionId,
        },
        forecast_error: {
          source_objects: ['calibration_replay_v1', 'forecast_error_v1'],
          predicted_soil_moisture_percent: calibrationReplay.predicted_json.predicted_soil_moisture_percent,
          observed_soil_moisture_percent: calibrationReplay.observed_json.post_soil_moisture_percent,
          error_metric: forecastError.error_metric,
          error_value: forecastError.error_value,
          error_direction: forecastError.error_direction,
        },
        learning_candidate: {
          source_object: 'field_learning_candidate_v1',
          status: learningCandidate.candidate_status,
          candidate_only: learningCandidate.learning_statement_json.candidate_only,
          formal_field_memory_created: learningCandidate.learning_statement_json.formal_field_memory_created,
          model_updated: learningCandidate.learning_statement_json.model_updated,
          h58_bypass_allowed: learningCandidate.h58_gate_status_json.h58_bypass_allowed,
          candidate_can_enter_formal_gate: learningCandidate.h58_gate_status_json.candidate_can_enter_formal_gate,
        },
        decision_cycle: {
          source_object: 'decision_cycle_v1',
          status: decisionCycle.cycle_status,
          current_stage: decisionCycle.current_stage,
          human_gate: decisionCycle.human_gate_json,
          boundary_flags: decisionCycle.boundary_flags_json,
          roi_ref_present: Boolean(decisionCycle.external_refs_json.roi_entry_id),
          field_memory_ref_present: Boolean(decisionCycle.external_refs_json.field_memory_id),
        },
      },
    },
  };
}

function assertTrace(trace) {
  const chain = trace.twin_trace.system_derived;
  const answers = trace.twin_trace.answers;
  assertOk(chain.field_state_snapshot_v1.status === 'SNAPSHOT_READY', 'SNAPSHOT_NOT_READY', chain.field_state_snapshot_v1.blocking_reasons_json);
  assertOk(chain.forecast_run_v1.status === 'FORECAST_READY', 'FORECAST_NOT_READY', chain.forecast_run_v1.blocking_reasons_json);
  assertOk(chain.forecast_run_v1.horizon_days === 7, 'FORECAST_HORIZON_NOT_7D', { horizon_days: chain.forecast_run_v1.horizon_days });
  assertOk(chain.forecast_run_v1.forecast_points_json.length === 7, 'FORECAST_POINTS_NOT_7', { count: chain.forecast_run_v1.forecast_points_json.length });
  assertOk(chain.scenario_set_v1.status === 'SCENARIO_SET_READY', 'SCENARIO_SET_NOT_READY', chain.scenario_set_v1.blocking_reasons_json);
  assertOk(chain.scenario_set_v1.baseline_scenario_json.scenario_id === 'no_action', 'NO_ACTION_BASELINE_MISSING', {});
  assertOk(chain.scenario_set_v1.option_scenarios_json.length >= 1, 'OPTION_SCENARIOS_MISSING', {});
  assertOk(chain.calibration_replay_v1.status === 'CALIBRATION_REPLAY_READY', 'CALIBRATION_REPLAY_NOT_READY', chain.calibration_replay_v1.blocking_reasons_json);
  assertOk(typeof chain.forecast_error_v1.error_value === 'number', 'FORECAST_ERROR_VALUE_MISSING', {});
  assertOk(chain.forecast_error_v1.error_direction !== 'BLOCKED', 'FORECAST_ERROR_BLOCKED', {});
  assertOk(chain.field_learning_candidate_v1.candidate_status === 'LEARNING_CANDIDATE_READY', 'LEARNING_CANDIDATE_NOT_READY', chain.field_learning_candidate_v1.blocking_reasons_json);
  assertOk(chain.field_learning_candidate_v1.learning_statement_json.candidate_only === true, 'LEARNING_CANDIDATE_NOT_CANDIDATE_ONLY', {});
  assertOk(chain.field_learning_candidate_v1.learning_statement_json.formal_field_memory_created === false, 'FORMAL_FIELD_MEMORY_CREATED_BY_TK', {});
  assertOk(chain.field_learning_candidate_v1.learning_statement_json.model_updated === false, 'MODEL_UPDATED_BY_TK', {});
  assertOk(chain.decision_cycle_v1.cycle_status === 'DECISION_CYCLE_READY', 'DECISION_CYCLE_NOT_READY', chain.decision_cycle_v1.blocking_reasons_json);
  assertOk(chain.decision_cycle_v1.human_gate_json.human_approval_required_before_task === true, 'HUMAN_GATE_NOT_REQUIRED', {});
  const flags = chain.decision_cycle_v1.boundary_flags_json;
  for (const key of [
    'forecast_to_task_autojump_allowed',
    'scenario_to_task_autojump_allowed',
    'recommendation_to_task_autojump_allowed',
    'automatic_recommendation_created',
    'automatic_approval_created',
    'automatic_task_created',
    'automatic_receipt_created',
    'automatic_acceptance_created',
    'automatic_roi_created',
    'automatic_field_memory_created',
    'model_updated',
  ]) {
    assertOk(flags[key] === false, 'FORBIDDEN_AUTO_WRITE_FLAG_NOT_FALSE', { key, value: flags[key] });
  }
  assertOk(flags.human_approval_required_before_task === true, 'HUMAN_APPROVAL_BOUNDARY_NOT_TRUE', {});
  assertOk(chain.decision_cycle_v1.external_refs_json.roi_entry_id === null, 'ROI_REF_SHOULD_BE_ABSENT_IN_TRACE', {});
  assertOk(chain.decision_cycle_v1.external_refs_json.field_memory_id === null, 'FIELD_MEMORY_REF_SHOULD_BE_ABSENT_IN_TRACE', {});
  for (const objectName of Object.keys(chain)) {
    assertOk(nonEmptyString(chain[objectName].determinism_hash), 'DETERMINISM_HASH_MISSING', { objectName });
  }
  assertOk(answers.current_field_state.water_state === 'LIGHT_DEFICIT', 'CURRENT_STATE_ANSWER_INCORRECT', answers.current_field_state);
  assertOk(answers.current_field_state.confidence_level === 'MEDIUM', 'CURRENT_STATE_CONFIDENCE_INCORRECT', answers.current_field_state);
  assertOk(answers.seven_day_forecast.point_count === 7, 'FORECAST_ANSWER_POINT_COUNT_INCORRECT', answers.seven_day_forecast);
  assertOk(answers.scenario_comparison.no_action_baseline_present === true, 'SCENARIO_ANSWER_BASELINE_MISSING', answers.scenario_comparison);
  assertOk(typeof answers.forecast_error.error_value === 'number', 'FORECAST_ERROR_ANSWER_MISSING', answers.forecast_error);
  assertOk(answers.learning_candidate.formal_field_memory_created === false, 'LEARNING_ANSWER_CREATED_FORMAL_MEMORY', answers.learning_candidate);
  assertOk(answers.decision_cycle.roi_ref_present === false, 'DECISION_ANSWER_ROI_REF_PRESENT', answers.decision_cycle);
  assertOk(answers.decision_cycle.field_memory_ref_present === false, 'DECISION_ANSWER_FIELD_MEMORY_REF_PRESENT', answers.decision_cycle);
}

function main() {
  const first = buildTrace();
  const second = buildTrace();
  assertTrace(first);
  assertTrace(second);
  const firstFingerprint = deterministicFingerprint(first);
  const secondFingerprint = deterministicFingerprint(second);
  assertOk(firstFingerprint === secondFingerprint, 'DETERMINISM_NOT_STABLE', { firstFingerprint, secondFingerprint });
  const chain = first.twin_trace.system_derived;
  console.log(JSON.stringify({
    ok: true,
    acceptance: ACCEPTANCE,
    runtime_builders_invoked: true,
    complete_tk_chain_built: true,
    provenance_classes_present: true,
    system_derived_outputs_present: true,
    determinism_stable: true,
    forbidden_auto_writes_absent: true,
    tk_chain_ids: {
      snapshot_id: chain.field_state_snapshot_v1.snapshot_id,
      forecast_run_id: chain.forecast_run_v1.forecast_run_id,
      scenario_set_id: chain.scenario_set_v1.scenario_set_id,
      calibration_replay_id: chain.calibration_replay_v1.calibration_replay_id,
      forecast_error_id: chain.forecast_error_v1.forecast_error_id,
      field_learning_candidate_id: chain.field_learning_candidate_v1.field_learning_candidate_id,
      decision_cycle_id: chain.decision_cycle_v1.decision_cycle_id,
    },
    twin_trace: first.twin_trace,
    next_step: 'TWIN_KERNEL_TRACE_READ_MODEL_OR_API_READBACK',
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail(error && error.message ? error.message : String(error));
}
