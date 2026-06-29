// scripts/twin_kernel/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs
// Purpose: build a deterministic read-only P8 real evidence window from local Postgres raw_samples.
// Boundary: reads DB evidence and prints JSON only; it creates no facts, model state, Field Memory, execution object, API route, or frontend state.

'use strict';

const crypto = require('node:crypto');
const { Client } = require('pg');

const OUTPUT_KIND = 'real_evidence_window_v0';
const WINDOW_VERSION = 'p8_02_real_evidence_window_builder_v0';
const RUNTIME_REF = 'scripts/twin_kernel/P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0.cjs';

function env(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === null || String(value).trim() === '' ? fallback : String(value).trim();
}

const DEFAULT_CONFIG = Object.freeze({
  database_url: env('DATABASE_URL', 'postgres://postgres:postgres@127.0.0.1:5432/geox'),
  project_id: env('P8_PROJECT_ID', 'P_DEFAULT'),
  sensor_group_id: env('P8_SENSOR_GROUP_ID', 'G_CAF'),
  sensor_id: env('P8_SENSOR_ID', 'CAF009'),
  metric_kind: env('P8_METRIC_KIND', 'soil_moisture'),
  window_start_ts: env('P8_WINDOW_START_TS', '2009-06-09T00:00:00.000Z'),
  window_end_ts: env('P8_WINDOW_END_TS', '2009-06-09T04:00:00.000Z'),
  expected_interval_ms: Number(env('P8_EXPECTED_INTERVAL_MS', '3600000')),
});

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

function round(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function quoteIdent(name) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error(`UNSAFE_IDENTIFIER:${name}`);
  return `"${name.replace(/"/g, '""')}"`;
}

function metricKindForMetric(metricRef) {
  const metric = String(metricRef || '');
  if (metric === 'soil_moisture' || metric.startsWith('soil_moisture_vwc_')) return 'soil_moisture';
  return 'unsupported';
}

function validateConfig(config) {
  for (const field of ['database_url', 'project_id', 'sensor_group_id', 'sensor_id', 'metric_kind', 'window_start_ts', 'window_end_ts']) {
    if (!config[field]) throw new Error(`MISSING_CONFIG:${field}`);
  }
  if (config.metric_kind !== 'soil_moisture') throw new Error('UNSUPPORTED_METRIC_KIND');
  if (!Number.isInteger(config.expected_interval_ms) || config.expected_interval_ms <= 0) throw new Error('INVALID_EXPECTED_INTERVAL_MS');
  const startMs = new Date(config.window_start_ts).getTime();
  const endMs = new Date(config.window_end_ts).getTime();
  if (!Number.isFinite(startMs)) throw new Error('INVALID_WINDOW_START_TS');
  if (!Number.isFinite(endMs)) throw new Error('INVALID_WINDOW_END_TS');
  if (startMs > endMs) throw new Error('INVALID_WINDOW_ORDER');
  return { startMs, endMs };
}

async function tableColumns(client, tableName) {
  const result = await client.query(
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position asc`,
    [tableName]
  );
  return new Set((result.rows || []).map((row) => String(row.column_name)));
}

function pickColumn(columns, candidates) {
  return candidates.find((candidate) => columns.has(candidate)) || null;
}

function requireColumns(tableName, columns, required) {
  for (const column of required) if (!columns.has(column)) throw new Error(`MISSING_COLUMN:${tableName}.${column}`);
}

async function readRawRows(client, config, startMs, endMs) {
  const columns = await tableColumns(client, 'raw_samples');
  requireColumns('raw_samples', columns, ['sensor_id', 'ts_ms', 'metric', 'value']);
  const sampleRefColumn = pickColumn(columns, ['sample_id', 'fact_id', 'raw_sample_id']);
  if (!sampleRefColumn) throw new Error('MISSING_RAW_SAMPLE_REF_COLUMN');
  const sourceExpr = columns.has('source') ? `rs.${quoteIdent('source')}` : `'raw_samples'`;
  const qualityColumn = pickColumn(columns, ['qc_quality', 'quality']);
  const qualityExpr = qualityColumn ? `rs.${quoteIdent(qualityColumn)}` : `'unknown'`;
  const sql = `select cast(rs.${quoteIdent(sampleRefColumn)} as text) as raw_sample_ref,
                      cast(rs.${quoteIdent('sensor_id')} as text) as sensor_id,
                      cast(rs.${quoteIdent('ts_ms')} as bigint) as ts_ms,
                      cast(rs.${quoteIdent('metric')} as text) as metric_ref,
                      cast(rs.${quoteIdent('value')} as double precision) as value,
                      cast(${sourceExpr} as text) as source_kind,
                      cast(${qualityExpr} as text) as quality,
                      cast(sgm.group_id as text) as sensor_group_id,
                      cast(sg.project_id as text) as project_id
                 from raw_samples rs
                 join sensor_group_members sgm on sgm.sensor_id = rs.${quoteIdent('sensor_id')} and sgm.group_id = $2
                 join sensor_groups sg on sg.group_id = sgm.group_id and sg.project_id = $1
                where rs.${quoteIdent('sensor_id')} = $3
                  and rs.${quoteIdent('ts_ms')} >= $4
                  and rs.${quoteIdent('ts_ms')} <= $5
                  and $6 = 'soil_moisture'
                  and (rs.${quoteIdent('metric')} = 'soil_moisture' or rs.${quoteIdent('metric')} like 'soil_moisture_vwc_%')
                  and rs.${quoteIdent('value')} is not null
                order by rs.${quoteIdent('ts_ms')} asc, rs.${quoteIdent('metric')} asc, cast(rs.${quoteIdent(sampleRefColumn)} as text) asc`;
  const result = await client.query(sql, [config.project_id, config.sensor_group_id, config.sensor_id, startMs, endMs, config.metric_kind]);
  return { rows: result.rows || [], adapter_columns: { sample_ref_column: sampleRefColumn, quality_column: qualityColumn || null } };
}

function buildEvidencePoints(rows) {
  const byTs = new Map();
  for (const row of rows) {
    const tsMs = Number(row.ts_ms);
    const observedAt = new Date(tsMs).toISOString();
    if (!byTs.has(tsMs)) byTs.set(tsMs, { ts_ms: tsMs, ts: observedAt, observed_at: observedAt, metric_values: {}, metric_refs: [], raw_sample_refs: [], source_refs: [] });
    const point = byTs.get(tsMs);
    const metricRef = String(row.metric_ref);
    point.metric_values[metricRef] = round(Number(row.value));
    point.metric_refs.push(metricRef);
    point.raw_sample_refs.push(String(row.raw_sample_ref));
    point.source_refs.push({ kind: 'raw_sample_ref', ref_id: String(row.raw_sample_ref), metric_ref: metricRef, ts_ms: tsMs });
  }
  return [...byTs.values()].sort((a, b) => a.ts_ms - b.ts_ms).map((point) => {
    const metricRefs = [...new Set(point.metric_refs)].sort();
    const rawSampleRefs = [...new Set(point.raw_sample_refs)].sort();
    return { point_ref: `ep_${sha256({ ts_ms: point.ts_ms, metric_refs: metricRefs, raw_sample_refs: rawSampleRefs }).slice(0, 16)}`, ts: point.ts, ts_ms: point.ts_ms, observed_at: point.observed_at, metric_values: stable(point.metric_values), metric_refs: metricRefs, raw_sample_refs: rawSampleRefs, source_refs: point.source_refs.sort((a, b) => String(a.metric_ref).localeCompare(String(b.metric_ref)) || String(a.ref_id).localeCompare(String(b.ref_id))) };
  });
}

function buildCoverage(config, startMs, endMs, evidencePoints, rowCount, metricRefs) {
  const expectedCount = Math.floor((endMs - startMs) / config.expected_interval_ms) + 1;
  const timestamps = evidencePoints.map((point) => point.ts_ms);
  const intervals = [];
  for (let index = 1; index < timestamps.length; index += 1) intervals.push(timestamps[index] - timestamps[index - 1]);
  const sorted = intervals.sort((a, b) => a - b);
  const median = sorted.length === 0 ? null : (sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2);
  return { window_start_ts_ms: startMs, window_end_ts_ms: endMs, expected_interval_ms: config.expected_interval_ms, expected_sample_count: expectedCount, observed_timestamp_count: evidencePoints.length, sample_count: evidencePoints.length, raw_sample_row_count: rowCount, metric_count: metricRefs.length, coverage_ratio: expectedCount > 0 ? round(evidencePoints.length / expectedCount) : 0, missing_sample_count: Math.max(0, expectedCount - evidencePoints.length), observed_interval_min_ms: sorted[0] || null, observed_interval_max_ms: sorted[sorted.length - 1] || null, observed_interval_median_ms: median };
}

function buildWindowObject(config, rows, adapterColumns, startMs, endMs) {
  const normalizedRows = rows.map((row) => ({ raw_sample_ref: String(row.raw_sample_ref), sensor_id: String(row.sensor_id), sensor_group_id: String(row.sensor_group_id), project_id: String(row.project_id), ts_ms: Number(row.ts_ms), metric_ref: String(row.metric_ref), metric_kind: metricKindForMetric(row.metric_ref), value: round(Number(row.value)), unit: 'vwc_fraction', source_kind: String(row.source_kind || 'raw_samples'), quality: String(row.quality || 'unknown') })).filter((row) => row.metric_kind === config.metric_kind);
  if (normalizedRows.length === 0) throw new Error('NO_REAL_EVIDENCE_POINTS');
  if (!normalizedRows.every((row) => row.project_id === config.project_id)) throw new Error('PROJECT_ID_MISMATCH');
  if (!normalizedRows.every((row) => row.sensor_group_id === config.sensor_group_id)) throw new Error('SENSOR_GROUP_ID_MISMATCH');
  if (!normalizedRows.every((row) => row.sensor_id === config.sensor_id)) throw new Error('SENSOR_ID_MISMATCH');

  const evidencePoints = buildEvidencePoints(normalizedRows);
  const metricRefs = [...new Set(normalizedRows.map((row) => row.metric_ref))].sort();
  const sourceQueryMaterial = { table: 'raw_samples', project_id: config.project_id, sensor_group_id: config.sensor_group_id, sensor_id: config.sensor_id, metric_kind: config.metric_kind, window_start_ts: config.window_start_ts, window_end_ts: config.window_end_ts, adapter_columns: adapterColumns };
  const sourceQueryId = `sq_${sha256(sourceQueryMaterial).slice(0, 16)}`;
  const evidenceRefs = normalizedRows.sort((a, b) => a.ts_ms - b.ts_ms || a.metric_ref.localeCompare(b.metric_ref) || a.raw_sample_ref.localeCompare(b.raw_sample_ref)).map((row) => ({ kind: 'raw_sample_ref', ref_id: row.raw_sample_ref, metric_ref: row.metric_ref, ts_ms: row.ts_ms }));
  const baseOutput = { real_evidence_window_version: WINDOW_VERSION, real_evidence_window_id: 'pending_hash', output_kind: OUTPUT_KIND, project_id: config.project_id, subject_ref: { kind: 'sensor_group', ref_id: config.sensor_group_id }, sensor_ref: { kind: 'sensor', ref_id: config.sensor_id }, sensor_group_ref: { kind: 'sensor_group', ref_id: config.sensor_group_id }, metric_kind: config.metric_kind, unit: 'vwc_fraction', window_start_ts: config.window_start_ts, window_end_ts: config.window_end_ts, expected_interval_ms: config.expected_interval_ms, sample_count: evidencePoints.length, metric_count: metricRefs.length, metric_refs: metricRefs, coverage_summary: buildCoverage(config, startMs, endMs, evidencePoints, normalizedRows.length, metricRefs), evidence_points: evidencePoints, evidence_refs: evidenceRefs, source_query_ref: { kind: 'readonly_postgres_query_ref', ref_id: sourceQueryId, source_table: 'raw_samples', source_group_table: 'sensor_groups', source_membership_table: 'sensor_group_members', filter_ref: sourceQueryMaterial }, trace_refs: [{ kind: 'p8_01_real_evidence_source_contract', ref_id: 'docs/tasks/P8-01-Real-Evidence-Source-Contract.md' }, { kind: 'p8_02_real_evidence_window_runtime', ref_id: RUNTIME_REF }], provenance_ref: { kind: 'postgres_raw_samples_readonly_query', ref_id: sourceQueryId }, read_only: true };
  const determinismHash = sha256(baseOutput);
  return { ...baseOutput, real_evidence_window_id: `rew_${determinismHash.slice(0, 16)}`, determinism_hash: determinismHash };
}

async function buildRealEvidenceWindow(config = DEFAULT_CONFIG) {
  const { startMs, endMs } = validateConfig(config);
  const client = new Client({ connectionString: config.database_url });
  await client.connect();
  try {
    await client.query('begin read only');
    const { rows, adapter_columns } = await readRawRows(client, config, startMs, endMs);
    const output = buildWindowObject(config, rows, adapter_columns, startMs, endMs);
    await client.query('rollback');
    return output;
  } catch (error) {
    try { await client.query('rollback'); } catch {}
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const output = await buildRealEvidenceWindow(DEFAULT_CONFIG);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, acceptance: 'P8_02_REAL_EVIDENCE_WINDOW_BUILDER_V0', error: error.message }, null, 2));
    process.exit(1);
  });
}

module.exports = { buildRealEvidenceWindow, buildWindowObject, stable, sha256, DEFAULT_CONFIG };
