// scripts/twin_kernel/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs
// Purpose: estimate soil moisture state from the P8-02 real evidence window.
// Boundary: reads P8-02 history evidence only and prints JSON; it writes no DB, facts, Field Memory, model state, execution object, route, or frontend state.

'use strict';

const { buildRealEvidenceWindow, stable, sha256, DEFAULT_CONFIG } = require('./P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs');

const OUTPUT_KIND = 'real_soil_moisture_state_estimate_v1';
const RUNTIME_REF = 'scripts/twin_kernel/P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1.cjs';
const CONTRACT_REF = 'docs/tasks/P8-04-Real-State-Estimate-Runtime-v1.md';
const METHOD_NAME = 'weighted_recent_mean_v1';

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedRecentMean(observations) {
  let weightedSum = 0;
  let weightSum = 0;
  const ordered = [...observations].sort((a, b) => a.ts_ms - b.ts_ms);
  for (let index = 0; index < ordered.length; index += 1) {
    const weight = index + 1;
    weightedSum += ordered[index].value * weight;
    weightSum += weight;
  }
  return weightSum > 0 ? weightedSum / weightSum : null;
}

function observationsByMetric(evidenceWindow) {
  const grouped = new Map();
  for (const point of evidenceWindow.evidence_points || []) {
    const values = point.metric_values || {};
    for (const metricRef of Object.keys(values)) {
      const value = Number(values[metricRef]);
      if (!Number.isFinite(value)) continue;
      if (!grouped.has(metricRef)) grouped.set(metricRef, []);
      grouped.get(metricRef).push({ ts_ms: Number(point.ts_ms), observed_at: point.observed_at, value });
    }
  }
  return grouped;
}

function estimateMetric(metricRef, observations) {
  const ordered = [...observations].sort((a, b) => a.ts_ms - b.ts_ms);
  const values = ordered.map((item) => item.value);
  const estimateValue = weightedRecentMean(ordered);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const latest = ordered[ordered.length - 1];
  const uncertaintyWidth = round(Math.max(0, maxValue - minValue));
  return { metric_ref: metricRef, estimate_value: round(estimateValue), observation_count: ordered.length, latest_observation_ts_ms: latest.ts_ms, latest_observation_at: latest.observed_at, latest_value: round(latest.value), min_observed_value: round(minValue), max_observed_value: round(maxValue), uncertainty_width: uncertaintyWidth };
}

function buildStateEstimate(evidenceWindow) {
  if (!evidenceWindow || evidenceWindow.output_kind !== 'real_evidence_window_v0') throw new Error('INVALID_INPUT_EVIDENCE_WINDOW');
  if (!Array.isArray(evidenceWindow.evidence_points) || evidenceWindow.evidence_points.length === 0) throw new Error('EMPTY_EVIDENCE_POINTS');
  if (!Array.isArray(evidenceWindow.evidence_refs) || evidenceWindow.evidence_refs.length === 0) throw new Error('EMPTY_EVIDENCE_REFS');

  const grouped = observationsByMetric(evidenceWindow);
  const estimateByMetric = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([metricRef, observations]) => estimateMetric(metricRef, observations));
  if (estimateByMetric.length === 0) throw new Error('NO_METRIC_ESTIMATES');

  const aggregateEstimate = mean(estimateByMetric.map((item) => item.estimate_value));
  const aggregateWidth = mean(estimateByMetric.map((item) => item.uncertainty_width));
  const confidence = Math.max(0, Math.min(1, Number(evidenceWindow.coverage_summary?.coverage_ratio || 0)));

  const baseOutput = {
    state_estimate_id: 'pending_hash',
    output_kind: OUTPUT_KIND,
    project_id: evidenceWindow.project_id,
    subject_ref: evidenceWindow.subject_ref,
    sensor_ref: evidenceWindow.sensor_ref,
    sensor_group_ref: evidenceWindow.sensor_group_ref,
    metric_kind: evidenceWindow.metric_kind,
    unit: evidenceWindow.unit || 'vwc_fraction',
    estimate_method: METHOD_NAME,
    estimate_value: round(aggregateEstimate),
    estimate_by_metric: estimateByMetric,
    uncertainty: { kind: 'observed_window_range_mean', value: round(aggregateWidth), unit: evidenceWindow.unit || 'vwc_fraction' },
    confidence: round(confidence),
    uncertainty_width: round(aggregateWidth),
    coverage_summary: evidenceWindow.coverage_summary,
    metric_refs: evidenceWindow.metric_refs,
    evidence_refs: evidenceWindow.evidence_refs,
    source_query_ref: evidenceWindow.source_query_ref,
    trace_refs: [{ kind: 'p8_02_real_evidence_window', ref_id: evidenceWindow.real_evidence_window_id }, { kind: 'p8_04_contract', ref_id: CONTRACT_REF }, { kind: 'p8_04_runtime', ref_id: RUNTIME_REF }],
    input_evidence_window_ref: { kind: 'real_evidence_window_v0', ref_id: evidenceWindow.real_evidence_window_id, determinism_hash: evidenceWindow.determinism_hash },
    read_only: true,
  };

  const determinismHash = sha256(baseOutput);
  return { ...baseOutput, state_estimate_id: `rse_${determinismHash.slice(0, 16)}`, determinism_hash: determinismHash };
}

async function buildRealStateEstimate(config = DEFAULT_CONFIG) {
  const evidenceWindow = await buildRealEvidenceWindow(config);
  return buildStateEstimate(evidenceWindow);
}

async function main() {
  const output = await buildRealStateEstimate(DEFAULT_CONFIG);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, acceptance: 'P8_04_REAL_STATE_ESTIMATE_RUNTIME_V1', error: error.message }, null, 2));
    process.exit(1);
  });
}

module.exports = { buildStateEstimate, buildRealStateEstimate, weightedRecentMean, DEFAULT_CONFIG, stable, sha256 };
