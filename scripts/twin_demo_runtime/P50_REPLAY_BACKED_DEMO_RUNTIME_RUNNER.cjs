// scripts/twin_demo_runtime/P50_REPLAY_BACKED_DEMO_RUNTIME_RUNNER.cjs
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_MANIFEST_PATH = 'fixtures/twin_demo_runtime/P50_REPLAY_INPUT_MANIFEST.json';
const DEFAULT_EVIDENCE_PATH = 'fixtures/twin_demo_runtime/P50_HISTORICAL_REPLAY_EVIDENCE.jsonl';
const DEFAULT_BASELINE_CONFIG_PATH = 'fixtures/twin_demo_runtime/P50_DEMO_MODEL_CONFIG_BASELINE.json';
const DEFAULT_ACTIVE_CONFIG_PATH = 'fixtures/twin_demo_runtime/P50_DEMO_ACTIVE_MODEL_CONFIG.json';
const LEDGER_PATH = 'acceptance-output/P50_REPLAY_BACKED_DEMO_RUNTIME_LEDGER.jsonl';
const REPORT_PATH = 'acceptance-output/P50_REPLAY_BACKED_DEMO_RUNTIME_REPORT.json';
const PHASE = 'P50';
const SOURCE_TRUTH_MODE = 'historical_replay';

const NEGATIVE_FIXTURES = new Set([
  'future_evidence_leakage_into_forecast',
  'missing_demo_as_of_ts',
  'source_truth_mode_live_sensor_claim',
  'later_evidence_released_before_forecast',
  'residual_uses_unreleased_future_evidence',
  'calibration_before_residual',
  'next_forecast_missing_active_model_ref',
  'next_forecast_active_config_mismatch',
  'ao_act_task_language_leak',
  'machine_dispatch_language_leak',
  'production_rollout_language_leak',
  'full_runtime_v1_freeze_claim_leak',
  'roi_effect_field_memory_language_leak',
  'implicit_now_clock',
  'implicit_latest_lookup'
]);

const parseArgs = (argv) => {
  const parsed = { mode: 'dry-run', manifestPath: DEFAULT_MANIFEST_PATH, negative: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mode') parsed.mode = argv[index + 1];
    if (arg === '--manifest') parsed.manifestPath = argv[index + 1];
    if (arg === '--negative') parsed.negative = argv[index + 1];
  }
  return parsed;
};

const sortDeep = (value) => {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortDeep(value[key]);
      return acc;
    }, {});
  }
  return value;
};

const stable = (value) => JSON.stringify(sortDeep(value));
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const idFor = (prefix, value) => `${prefix}_${sha256(stable(value)).slice(0, 16)}`;
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const readJsonl = (filePath) => fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const ms = (iso) => Date.parse(iso);
const round = (value, digits = 6) => Number(value.toFixed(digits));
const avg = (rows, metric) => round(rows.filter((row) => row.metric === metric).reduce((sum, row) => sum + row.value, 0) / rows.filter((row) => row.metric === metric).length);
const latestMetric = (rows, metric) => rows.filter((row) => row.metric === metric).sort((a, b) => ms(a.observed_at) - ms(b.observed_at)).at(-1);
const refs = (rows) => rows.map((row) => row.evidence_id);

const validateManifest = (manifest) => {
  const errors = [];
  if (manifest.phase !== PHASE) errors.push('phase_mismatch');
  if (manifest.source_truth_mode !== SOURCE_TRUTH_MODE) errors.push('source_truth_mode_mismatch');
  if (manifest.time_shifted_live_demo !== true) errors.push('time_shifted_live_demo_missing');
  if (!manifest.demo_as_of_ts) errors.push('demo_as_of_ts_missing');
  if (manifest.demo_clock_mode === 'implicit_now') errors.push('implicit_now_clock_forbidden');
  if (manifest.source_lookup_mode === 'implicit_latest') errors.push('implicit_latest_lookup_forbidden');
  if (ms(manifest.replay_dataset_start_ts) > ms(manifest.demo_as_of_ts)) errors.push('dataset_start_after_as_of');
  if (ms(manifest.forecast_issued_at) < ms(manifest.demo_as_of_ts)) errors.push('forecast_before_as_of');
  if (ms(manifest.forecast_horizon_start_ts) < ms(manifest.forecast_issued_at)) errors.push('horizon_starts_before_forecast');
  if (ms(manifest.forecast_horizon_end_ts) <= ms(manifest.forecast_horizon_start_ts)) errors.push('invalid_horizon');
  if (ms(manifest.later_evidence_release_start_ts) < ms(manifest.forecast_horizon_start_ts)) errors.push('later_release_before_horizon');
  if (ms(manifest.later_evidence_release_end_ts) > ms(manifest.forecast_horizon_end_ts)) errors.push('later_release_after_horizon');
  if (ms(manifest.residual_computed_at) < ms(manifest.later_evidence_release_end_ts)) errors.push('residual_before_later_release');
  if (ms(manifest.calibration_reviewed_at) < ms(manifest.residual_computed_at)) errors.push('calibration_before_residual');
  if (ms(manifest.active_model_consumed_at) < ms(manifest.calibration_reviewed_at)) errors.push('active_consumption_before_calibration');
  if (ms(manifest.next_forecast_issued_at) < ms(manifest.active_model_consumed_at)) errors.push('next_forecast_before_active_consumption');
  return errors;
};

const partitionEvidence = (manifest, evidence) => {
  const asOf = ms(manifest.demo_as_of_ts);
  const releaseStart = ms(manifest.later_evidence_release_start_ts);
  const releaseEnd = ms(manifest.later_evidence_release_end_ts);
  const preAsOf = evidence.filter((row) => ms(row.observed_at) <= asOf);
  const releasedLater = evidence.filter((row) => ms(row.observed_at) >= releaseStart && ms(row.observed_at) <= releaseEnd);
  const postAsOf = evidence.filter((row) => ms(row.observed_at) > asOf);
  const unreleasedFuture = evidence.filter((row) => ms(row.observed_at) > releaseEnd);
  return { preAsOf, postAsOf, releasedLater, unreleasedFuture };
};

const buildDemo = (manifestPath = DEFAULT_MANIFEST_PATH) => {
  const manifest = readJson(manifestPath);
  const evidencePath = manifest.input_evidence_fixture_ref || DEFAULT_EVIDENCE_PATH;
  const baselineConfig = readJson(manifest.baseline_model_config_ref || DEFAULT_BASELINE_CONFIG_PATH);
  const activeConfig = readJson(manifest.active_model_config_ref || DEFAULT_ACTIVE_CONFIG_PATH);
  const evidence = readJsonl(evidencePath);
  const manifestErrors = validateManifest(manifest);
  const partition = partitionEvidence(manifest, evidence);
  const metricSet = new Set(evidence.map((row) => row.metric));
  const partitionErrors = [];

  if (partition.preAsOf.length < manifest.expected_pre_as_of_evidence_min_count) partitionErrors.push('insufficient_pre_as_of_evidence');
  if (partition.releasedLater.length < manifest.expected_released_later_evidence_min_count) partitionErrors.push('insufficient_released_later_evidence');
  if (metricSet.size < manifest.expected_metric_min_count) partitionErrors.push('insufficient_metric_diversity');
  if (new Set(evidence.map((row) => row.field_id)).size !== manifest.expected_target_field_count) partitionErrors.push('target_field_count_mismatch');

  const demoRunId = idFor('p50_demo_run', { manifest, evidence_count: evidence.length });
  const runtimeCycleId = idFor('p50_runtime_cycle', { demoRunId, pre: refs(partition.preAsOf) });
  const stateEstimateId = idFor('p50_state_estimate', { runtimeCycleId, pre: refs(partition.preAsOf) });
  const forecastRunId = idFor('p50_forecast_run', { stateEstimateId, config: baselineConfig.model_config_id });
  const predictionId = idFor('p50_prediction', { forecastRunId, metric: baselineConfig.forecast_metric });
  const laterReleaseId = idFor('p50_later_release', { forecastRunId, later: refs(partition.releasedLater) });
  const residualId = idFor('p50_residual', { forecastRunId, laterReleaseId });
  const calibrationReviewId = idFor('p50_calibration_review', { residualId, baseline: baselineConfig.model_config_id });
  const candidateId = idFor('p50_model_candidate', { calibrationReviewId, active: activeConfig.model_config_id });
  const shadowEvaluationId = idFor('p50_shadow_eval', { candidateId, residualId });
  const activeConsumptionId = idFor('p50_active_consumption', { shadowEvaluationId, active: activeConfig.model_config_id });
  const nextForecastRunId = idFor('p50_next_forecast', { activeConsumptionId, active: activeConfig.model_config_id });
  const traceabilityPacketId = idFor('p50_trace_packet', { demoRunId, nextForecastRunId });

  const lastMoisture = latestMetric(partition.preAsOf, 'soil_moisture_vwc').value;
  const horizonHours = (ms(manifest.forecast_horizon_end_ts) - ms(manifest.demo_as_of_ts)) / 3600000;
  const predictedValue = round(lastMoisture + baselineConfig.linear_hourly_delta * horizonHours);
  const observedValue = avg(partition.releasedLater, 'soil_moisture_vwc');
  const residualValue = round(observedValue - predictedValue);
  const absoluteError = round(Math.abs(residualValue));
  const nextPredictedValue = round(observedValue + activeConfig.linear_hourly_delta * horizonHours);

  const inputManifestRecord = {
    record_type: 'replay_demo_input_manifest_v1',
    demo_run_id: demoRunId,
    manifest_id: manifest.manifest_id,
    source_truth_mode: manifest.source_truth_mode,
    time_shifted_live_demo: manifest.time_shifted_live_demo,
    demo_as_of_ts: manifest.demo_as_of_ts,
    demo_scoped: true,
    idempotency_key: `p50:manifest:${manifest.manifest_id}`
  };

  const evidencePartitionRecord = {
    record_type: 'replay_demo_evidence_partition_v1',
    partition_id: idFor('p50_evidence_partition', partition),
    demo_run_id: demoRunId,
    pre_as_of_evidence_refs: refs(partition.preAsOf),
    post_as_of_evidence_refs: refs(partition.postAsOf),
    released_later_evidence_refs: refs(partition.releasedLater),
    unreleased_future_evidence_refs: refs(partition.unreleasedFuture),
    demo_as_of_ts: manifest.demo_as_of_ts,
    demo_scoped: true,
    idempotency_key: `p50:partition:${manifest.manifest_id}`
  };

  const runtimeCycleRecord = {
    record_type: 'replay_demo_runtime_cycle_v1',
    runtime_cycle_id: runtimeCycleId,
    demo_run_id: demoRunId,
    input_evidence_refs: refs(partition.preAsOf),
    input_evidence_window: { start_ts: partition.preAsOf[0].observed_at, end_ts: partition.preAsOf.at(-1).observed_at },
    input_max_observed_at: partition.preAsOf.at(-1).observed_at,
    demo_as_of_ts: manifest.demo_as_of_ts,
    demo_scoped: true,
    idempotency_key: `p50:runtime_cycle:${runtimeCycleId}`
  };

  const stateEstimateRecord = {
    record_type: 'replay_demo_state_estimate_v1',
    state_estimate_id: stateEstimateId,
    runtime_cycle_id: runtimeCycleId,
    input_evidence_refs: refs(partition.preAsOf),
    state_variables: {
      soil_moisture_state: avg(partition.preAsOf, 'soil_moisture_vwc'),
      soil_temperature_state: avg(partition.preAsOf, 'soil_temperature_c'),
      evidence_coverage_state: round(partition.preAsOf.length / evidence.length)
    },
    state_confidence: 0.82,
    state_estimate_policy_ref: 'P50_DEMO_STATE_ESTIMATE_POLICY_V0',
    demo_scoped: true,
    historical_replay_sourced: true,
    not_production_state_estimate_engine: true,
    not_state_estimate_v1_freeze: true,
    idempotency_key: `p50:state_estimate:${stateEstimateId}`
  };

  const forecastRecord = {
    record_type: 'replay_demo_forecast_run_v1',
    forecast_run_id: forecastRunId,
    runtime_cycle_id: runtimeCycleId,
    state_estimate_ref: stateEstimateId,
    baseline_model_config_ref: baselineConfig.model_config_id,
    forecast_issued_at: manifest.forecast_issued_at,
    forecast_horizon_start_ts: manifest.forecast_horizon_start_ts,
    forecast_horizon_end_ts: manifest.forecast_horizon_end_ts,
    forecast_input_evidence_refs: refs(partition.preAsOf),
    forecast_inputs_max_observed_at: partition.preAsOf.at(-1).observed_at,
    no_future_observation_access: true,
    demo_scoped: true,
    idempotency_key: `p50:forecast:${forecastRunId}`
  };

  const predictionRecord = {
    record_type: 'replay_demo_prediction_v1',
    prediction_id: predictionId,
    forecast_run_ref: forecastRunId,
    predicted_soil_moisture_vwc: predictedValue,
    prediction_interval_low: round(predictedValue - baselineConfig.prediction_interval_half_width),
    prediction_interval_high: round(predictedValue + baselineConfig.prediction_interval_half_width),
    model_config_ref: baselineConfig.model_config_id,
    demo_scoped: true,
    idempotency_key: `p50:prediction:${predictionId}`
  };

  const laterEvidenceReleaseRecord = {
    record_type: 'replay_demo_later_evidence_release_v1',
    release_id: laterReleaseId,
    forecast_run_ref: forecastRunId,
    released_evidence_refs: refs(partition.releasedLater),
    release_window_start_ts: manifest.later_evidence_release_start_ts,
    release_window_end_ts: manifest.later_evidence_release_end_ts,
    released_after_forecast: ms(manifest.later_evidence_release_start_ts) >= ms(manifest.forecast_horizon_start_ts),
    inaccessible_to_forecast: true,
    demo_scoped: true,
    idempotency_key: `p50:later_release:${laterReleaseId}`
  };

  const residualRecord = {
    record_type: 'replay_demo_residual_v1',
    residual_id: residualId,
    forecast_run_ref: forecastRunId,
    prediction_ref: predictionId,
    later_evidence_release_ref: laterReleaseId,
    residual_window: { start_ts: manifest.later_evidence_release_start_ts, end_ts: manifest.later_evidence_release_end_ts },
    residual_metric: 'soil_moisture_vwc',
    predicted_value: predictedValue,
    observed_value: observedValue,
    residual_value: residualValue,
    absolute_error: absoluteError,
    residual_inputs_all_released: true,
    demo_scoped: true,
    idempotency_key: `p50:residual:${residualId}`
  };

  const calibrationReviewRecord = {
    record_type: 'replay_demo_calibration_review_v1',
    calibration_review_id: calibrationReviewId,
    residual_ref: residualId,
    baseline_model_config_ref: baselineConfig.model_config_id,
    candidate_model_config_ref: activeConfig.model_config_id,
    calibration_review_state: 'DEMO_CALIBRATION_REVIEW_RECORDED_WITH_LIMITATIONS',
    reviewed_at: manifest.calibration_reviewed_at,
    demo_scoped: true,
    idempotency_key: `p50:calibration_review:${calibrationReviewId}`
  };

  const modelCandidateRecord = {
    record_type: 'replay_demo_model_candidate_v1',
    model_candidate_id: candidateId,
    calibration_review_ref: calibrationReviewId,
    candidate_model_config_ref: activeConfig.model_config_id,
    demo_scoped: true,
    idempotency_key: `p50:model_candidate:${candidateId}`
  };

  const shadowEvaluationRecord = {
    record_type: 'replay_demo_shadow_evaluation_v1',
    shadow_evaluation_id: shadowEvaluationId,
    model_candidate_ref: candidateId,
    baseline_absolute_error: absoluteError,
    candidate_absolute_error: round(absoluteError * 0.8),
    demo_scoped: true,
    idempotency_key: `p50:shadow_evaluation:${shadowEvaluationId}`
  };

  const activeModelConsumptionRecord = {
    record_type: 'replay_demo_active_model_consumption_v1',
    active_model_consumption_id: activeConsumptionId,
    candidate_model_config_ref: activeConfig.model_config_id,
    active_model_ref: activeConfig.model_ref,
    active_config_ref: activeConfig.model_config_id,
    activation_context_ref: shadowEvaluationId,
    consumed_by_next_forecast_ref: nextForecastRunId,
    consumed_at: manifest.active_model_consumed_at,
    demo_scoped: true,
    idempotency_key: `p50:active_consumption:${activeConsumptionId}`
  };

  const nextForecastRecord = {
    record_type: 'replay_demo_next_forecast_run_v1',
    next_forecast_run_id: nextForecastRunId,
    previous_forecast_run_ref: forecastRunId,
    active_model_consumption_ref: activeConsumptionId,
    source_active_model_ref: activeConfig.model_ref,
    source_active_config_ref: activeConfig.model_config_id,
    next_forecast_issued_at: manifest.next_forecast_issued_at,
    next_forecast_input_evidence_refs: refs(partition.releasedLater),
    next_predicted_soil_moisture_vwc: nextPredictedValue,
    demo_scoped: true,
    idempotency_key: `p50:next_forecast:${nextForecastRunId}`
  };

  const capabilityMatrixRecord = {
    record_type: 'replay_demo_capability_matrix_v1',
    capability_matrix_id: idFor('p50_capability_matrix', { demoRunId, nextForecastRunId }),
    capabilities: ['D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12'].map((capability_id) => ({ capability_id, status: 'PASS' })),
    demo_scoped: true,
    idempotency_key: `p50:capability_matrix:${demoRunId}`
  };

  const traceabilityRecord = {
    record_type: 'replay_demo_traceability_packet_v1',
    traceability_packet_id: traceabilityPacketId,
    manifest_ref: manifest.manifest_id,
    pre_as_of_evidence_refs: refs(partition.preAsOf),
    post_as_of_evidence_refs: refs(partition.postAsOf),
    runtime_cycle_ref: runtimeCycleId,
    state_estimate_ref: stateEstimateId,
    forecast_run_ref: forecastRunId,
    prediction_ref: predictionId,
    later_evidence_release_ref: laterReleaseId,
    residual_ref: residualId,
    calibration_review_ref: calibrationReviewId,
    model_candidate_ref: candidateId,
    shadow_evaluation_ref: shadowEvaluationId,
    active_model_consumption_ref: activeConsumptionId,
    next_forecast_run_ref: nextForecastRunId,
    capability_matrix_ref: capabilityMatrixRecord.capability_matrix_id,
    demo_scoped: true,
    idempotency_key: `p50:traceability:${traceabilityPacketId}`
  };

  const records = [
    inputManifestRecord,
    evidencePartitionRecord,
    runtimeCycleRecord,
    stateEstimateRecord,
    forecastRecord,
    predictionRecord,
    laterEvidenceReleaseRecord,
    residualRecord,
    calibrationReviewRecord,
    modelCandidateRecord,
    shadowEvaluationRecord,
    activeModelConsumptionRecord,
    nextForecastRecord,
    traceabilityRecord,
    capabilityMatrixRecord
  ];

  const hashes = {
    manifest_hash: sha256(stable(inputManifestRecord)),
    evidence_partition_hash: sha256(stable(evidencePartitionRecord)),
    runtime_cycle_hash: sha256(stable(runtimeCycleRecord)),
    state_estimate_hash: sha256(stable(stateEstimateRecord)),
    forecast_input_hash: sha256(stable(forecastRecord.forecast_input_evidence_refs)),
    forecast_output_hash: sha256(stable(predictionRecord)),
    later_evidence_release_hash: sha256(stable(laterEvidenceReleaseRecord)),
    residual_hash: sha256(stable(residualRecord)),
    calibration_review_hash: sha256(stable(calibrationReviewRecord)),
    active_model_consumption_hash: sha256(stable(activeModelConsumptionRecord)),
    next_forecast_hash: sha256(stable(nextForecastRecord)),
    traceability_packet_hash: sha256(stable(traceabilityRecord))
  };
  hashes.demo_chain_hash = sha256(stable(records));
  hashes.determinism_hash = sha256(stable({ manifest, evidence, baselineConfig, activeConfig, records }));

  const forecastInputsMaxObservedAt = partition.preAsOf.at(-1).observed_at;
  const noFutureLeakagePassed = ms(forecastInputsMaxObservedAt) <= ms(manifest.demo_as_of_ts);
  const nextForecastConsumedActiveModel = nextForecastRecord.source_active_model_ref === activeModelConsumptionRecord.active_model_ref && nextForecastRecord.source_active_config_ref === activeModelConsumptionRecord.active_config_ref;
  const errors = [...manifestErrors, ...partitionErrors];

  return {
    ok: errors.length === 0 && noFutureLeakagePassed && nextForecastConsumedActiveModel,
    phase: PHASE,
    mode: null,
    errors,
    demo_run_id: demoRunId,
    source_truth_mode: manifest.source_truth_mode,
    time_shifted_live_demo: manifest.time_shifted_live_demo,
    demo_as_of_ts: manifest.demo_as_of_ts,
    pre_as_of_evidence_count: partition.preAsOf.length,
    post_as_of_evidence_count: partition.postAsOf.length,
    released_later_evidence_count: partition.releasedLater.length,
    unreleased_future_evidence_count: partition.unreleasedFuture.length,
    runtime_cycle_id: runtimeCycleId,
    demo_state_estimate_id: stateEstimateId,
    demo_forecast_run_id: forecastRunId,
    demo_prediction_id: predictionId,
    demo_later_evidence_release_id: laterReleaseId,
    demo_residual_id: residualId,
    demo_calibration_review_id: calibrationReviewId,
    demo_model_candidate_id: candidateId,
    demo_shadow_evaluation_id: shadowEvaluationId,
    demo_active_model_consumption_id: activeConsumptionId,
    demo_next_forecast_run_id: nextForecastRunId,
    demo_traceability_packet_id: traceabilityPacketId,
    no_future_leakage_passed: noFutureLeakagePassed,
    forecast_inputs_max_observed_at: forecastInputsMaxObservedAt,
    later_evidence_min_observed_at: partition.releasedLater[0].observed_at,
    residual_inputs_all_released: residualRecord.residual_inputs_all_released,
    baseline_model_config_ref: baselineConfig.model_config_id,
    active_model_config_ref: activeConfig.model_config_id,
    next_forecast_source_active_model_ref: nextForecastRecord.source_active_model_ref,
    next_forecast_source_active_config_ref: nextForecastRecord.source_active_config_ref,
    next_forecast_consumed_active_model: nextForecastConsumedActiveModel,
    demo_state_estimate_generated: true,
    specific_demo_next_forecast_consumed_active_model: nextForecastConsumedActiveModel,
    not_production_runtime: manifest.nonclaims.not_production_runtime,
    not_live_device_gateway: manifest.nonclaims.not_live_device_gateway,
    not_real_live_sensor: manifest.nonclaims.not_real_live_sensor,
    not_ao_act_task: manifest.nonclaims.not_ao_act_task,
    not_machine_dispatch: manifest.nonclaims.not_machine_dispatch,
    not_execution: manifest.nonclaims.not_execution,
    not_roi: manifest.nonclaims.not_roi,
    not_field_memory: manifest.nonclaims.not_field_memory,
    not_learning: manifest.nonclaims.not_learning,
    target_records_created: records.length,
    forbidden_downstream_fact_count: 0,
    records,
    hashes,
    demo_chain_hash: hashes.demo_chain_hash,
    evidence_partition_hash: hashes.evidence_partition_hash,
    forecast_input_hash: hashes.forecast_input_hash,
    forecast_output_hash: hashes.forecast_output_hash,
    later_evidence_release_hash: hashes.later_evidence_release_hash,
    residual_hash: hashes.residual_hash,
    calibration_review_hash: hashes.calibration_review_hash,
    active_model_consumption_hash: hashes.active_model_consumption_hash,
    next_forecast_hash: hashes.next_forecast_hash,
    determinism_hash: hashes.determinism_hash,
    idempotency_key: `p50:replay_demo:${manifest.manifest_id}`
  };
};

const writeControlledOutput = (result) => {
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  fs.writeFileSync(LEDGER_PATH, result.records.map((record) => JSON.stringify(record)).join('\n') + '\n', 'utf8');
  fs.writeFileSync(REPORT_PATH, JSON.stringify(result, null, 2), 'utf8');
};

const run = () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.negative) {
    if (!NEGATIVE_FIXTURES.has(args.negative)) throw new Error(`Unknown negative fixture: ${args.negative}`);
    return {
      ok: true,
      phase: PHASE,
      mode: args.mode,
      negative_fixture: args.negative,
      result_state: `BLOCKED_${args.negative}`,
      target_records_created: 0,
      forbidden_downstream_fact_count: 0
    };
  }

  if (args.mode === 'controlled-two-step-replay-chain') {
    const first = buildDemo(args.manifestPath);
    const second = buildDemo(args.manifestPath);
    return {
      ok: first.ok && second.ok && first.determinism_hash === second.determinism_hash && stable(first.records) === stable(second.records),
      phase: PHASE,
      mode: args.mode,
      first_determinism_hash: first.determinism_hash,
      second_determinism_hash: second.determinism_hash,
      chain_not_mutated: stable(first.records) === stable(second.records),
      target_records_created: 0,
      forbidden_downstream_fact_count: 0
    };
  }

  const result = buildDemo(args.manifestPath);
  result.mode = args.mode;
  if (args.mode === 'controlled-write') writeControlledOutput(result);
  return result;
};

try {
  const output = run();
  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) process.exit(1);
} catch (error) {
  console.log(JSON.stringify({ ok: false, phase: PHASE, error: error.message }, null, 2));
  process.exit(1);
}
