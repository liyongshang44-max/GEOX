// scripts/twin_kernel/P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0.cjs
// Purpose: produce a deterministic read-only soil moisture state estimate from a P7-01 evidence window fixture.
// Boundary: this script reads JSON input and prints JSON output only; it does not write DB, facts, Field Memory, models, execution objects, or frontend state.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_INPUT = 'scripts/twin_kernel/fixtures/P7_02_EVIDENCE_WINDOW_CAF009_SAMPLE.json';
const INPUT_PATH = process.argv[2] || DEFAULT_INPUT;
const OUTPUT_KIND = 'soil_moisture_state_estimate_v0';
const STATE_ESTIMATE_VERSION = 'p7_02_soil_moisture_state_estimate_v0';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8'));
}

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function requireField(object, field) {
  if (object[field] === undefined || object[field] === null || object[field] === '') {
    throw new Error(`MISSING_REQUIRED_FIELD:${field}`);
  }
}

function validateEvidenceWindow(window) {
  for (const field of ['evidence_window_id', 'project_id', 'subject_ref', 'metric_refs', 'metric_kind', 'unit', 'window_start_ts', 'window_end_ts', 'sample_count', 'expected_sample_count', 'coverage_ratio', 'evidence_refs', 'trace_refs', 'provenance_ref', 'samples']) requireField(window, field);
  if (window.metric_kind !== 'soil_moisture') throw new Error('UNSUPPORTED_METRIC_KIND');
  if (!Array.isArray(window.metric_refs) || window.metric_refs.length === 0) throw new Error('MISSING_METRIC_REFS');
  if (!window.metric_refs.every((metric) => String(metric).includes('soil_moisture'))) throw new Error('SOIL_MOISTURE_METRIC_MISSING');
  if (!Array.isArray(window.samples) || window.samples.length === 0) throw new Error('MISSING_SAMPLES');
  if (new Date(window.window_start_ts).getTime() > new Date(window.window_end_ts).getTime()) throw new Error('INVALID_WINDOW_ORDER');
}

function estimateByMetric(window) {
  return window.metric_refs.map((metricRef) => {
    const metricSamples = window.samples.map((sample) => ({ sample_ref: sample.sample_ref, ts: sample.ts, value: sample.metrics[metricRef] })).filter((sample) => Number.isFinite(sample.value)).sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime() || String(a.sample_ref).localeCompare(String(b.sample_ref)));
    if (metricSamples.length === 0) throw new Error(`MISSING_METRIC_VALUES:${metricRef}`);
    const values = metricSamples.map((sample) => sample.value);
    const latest = metricSamples[metricSamples.length - 1];
    return { metric_ref: metricRef, sample_count: metricSamples.length, latest_ts: latest.ts, latest_value: round(latest.value), mean_value: round(mean(values)), min_value: round(Math.min(...values)), max_value: round(Math.max(...values)), median_value: round(median(values)) };
  });
}

function confidenceLabel(coverageRatio, qualityFlags) {
  if (qualityFlags.length > 0) return 'limited_by_quality_flags';
  if (coverageRatio >= 0.95) return 'high_from_complete_window';
  if (coverageRatio >= 0.75) return 'medium_from_partial_window';
  return 'low_from_sparse_window';
}

function buildStateEstimate(window) {
  validateEvidenceWindow(window);
  const metricEstimates = estimateByMetric(window);
  const latestValues = metricEstimates.map((metric) => metric.latest_value);
  const allValues = metricEstimates.flatMap((metric) => [metric.min_value, metric.mean_value, metric.max_value]);
  const estimateValue = round(mean(latestValues));
  const dispersion = round(standardDeviation(allValues));
  const uncertaintyWidth = round(Math.max(0.001, dispersion * (1 + (1 - window.coverage_ratio))));
  const baseOutput = { state_estimate_version: STATE_ESTIMATE_VERSION, state_estimate_id: 'pending_hash', output_kind: OUTPUT_KIND, project_id: window.project_id, subject_ref: window.subject_ref, sensor_ref: window.sensor_ref || null, sensor_group_ref: window.sensor_group_ref || null, as_of_ts: window.window_end_ts, input_evidence_window_ref: { kind: 'twin_evidence_window_ref', ref_id: window.evidence_window_id }, metric_kind: window.metric_kind, unit: window.unit, estimate_method: 'latest_window_mean_by_metric_v0', estimate_value: estimateValue, estimate_by_metric: metricEstimates, sample_count: window.sample_count, coverage_ratio: window.coverage_ratio, coverage_quality_label: confidenceLabel(window.coverage_ratio, window.quality_flags || []), uncertainty: { method: 'coverage_and_window_dispersion_v0', standard_deviation: dispersion, uncertainty_width: uncertaintyWidth, lower_bound: round(Math.max(0, estimateValue - uncertaintyWidth)), upper_bound: round(estimateValue + uncertaintyWidth) }, confidence_basis: ['metric_refs_present', 'evidence_refs_present', 'trace_refs_present', 'coverage_ratio_present', 'deterministic_read_only_estimator'], quality_flags: window.quality_flags || [], evidence_refs: window.evidence_refs, trace_refs: [...window.trace_refs, { kind: 'p7_02_state_estimate_runtime', ref_id: 'scripts/twin_kernel/P7_02_SOIL_MOISTURE_STATE_ESTIMATE_V0.cjs' }], provenance_ref: window.provenance_ref, read_only: true };
  const determinismHash = sha256(baseOutput);
  return { ...baseOutput, state_estimate_id: `se_${determinismHash.slice(0, 16)}`, determinism_hash: determinismHash };
}

function main() {
  const input = readJson(INPUT_PATH);
  const output = buildStateEstimate(input);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = { buildStateEstimate, stable, sha256 };
