#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1B-BCSE-G1R1-LIVE-SOURCE-PROBE-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1B_BCSE_G1R1_LIVE_SOURCE_PROBE_RESULT.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const HOUR_MS = 3_600_000;

function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function safeError(error) {
  const text = error && error.message ? String(error.message) : String(error);
  return text.replace(/([?&](?:token|key|secret|signature|sig|auth)=[^&\s]+)/gi, '[REDACTED_QUERY]');
}
function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function parseCsvLine(line) {
  const output = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      output.push(value);
      value = '';
    } else value += char;
  }
  output.push(value);
  return output;
}
function parseProviderUtc(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\s*\+0000|Z)?$/);
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
  const millis = Date.parse(iso);
  return Number.isFinite(millis) ? millis : null;
}
function numberOrNull(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}
function sha256Hex(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function assertMarkers(text, markers, code) {
  const haystack = String(text).toLowerCase().replace(/\s+/g, ' ');
  for (const marker of markers) assert(haystack.includes(String(marker).toLowerCase()), `${code}:${normalizeKey(marker)}`);
}
async function fetchTextAuthority(source, label) {
  const response = await fetch(source.url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(config.live_thresholds.http_timeout_ms),
    headers: { 'user-agent': 'GEOX-MCFT-CAP09-EA1B-READ-ONLY-PROBE/1.0', accept: 'text/html,text/plain;q=0.9,*/*;q=0.5' },
  });
  assert(response.ok, `${label}_HTTP_STATUS_${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  assertMarkers(text, source.required_markers, `${label}_MARKER_MISSING`);
  return {
    status: 'PASS',
    final_url: response.url,
    response_sha256: `sha256:${sha256Hex(bytes)}`,
    response_bytes: bytes.byteLength,
    retrieved_at: new Date().toISOString(),
  };
}
async function fetchCropAuthority(source) {
  const candidates = [source.url, source.fallback_index_url].filter(Boolean);
  const failures = [];
  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(config.live_thresholds.http_timeout_ms),
        headers: { 'user-agent': 'GEOX-MCFT-CAP09-EA1B-READ-ONLY-PROBE/1.0', accept: 'text/html,text/plain;q=0.9,*/*;q=0.5' },
      });
      if (!response.ok) { failures.push(`HTTP_${response.status}`); continue; }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const text = new TextDecoder().decode(bytes);
      try { assertMarkers(text, source.required_markers, 'CROP_2026_MARKER_MISSING'); }
      catch (error) { failures.push(safeError(error)); continue; }
      return {
        status: 'PASS',
        source_url_used: url,
        final_url: response.url,
        response_sha256: `sha256:${sha256Hex(bytes)}`,
        response_bytes: bytes.byteLength,
        planting_date: '2026-05-14',
        crop: 'corn',
        treatment: 'G1',
        retrieved_at: new Date().toISOString(),
      };
    } catch (error) { failures.push(safeError(error)); }
  }
  throw new Error(`CROP_2026_AUTHORITY_UNAVAILABLE:${failures.join('|').slice(0, 400)}`);
}
async function streamCsv(url, onRow, label) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(config.live_thresholds.http_timeout_ms),
    headers: { 'user-agent': 'GEOX-MCFT-CAP09-EA1B-READ-ONLY-PROBE/1.0', accept: 'text/csv,text/plain;q=0.9,*/*;q=0.5' },
  });
  assert(response.ok, `${label}_HTTP_STATUS_${response.status}`);
  assert(response.body, `${label}_BODY_REQUIRED`);
  const hash = crypto.createHash('sha256');
  const decoder = new TextDecoder();
  let buffer = '';
  let headers = null;
  let bytes = 0;
  let rows = 0;

  const consume = (line) => {
    const trimmed = line.replace(/\r$/, '');
    if (!trimmed) return;
    const cells = parseCsvLine(trimmed);
    if (!headers) {
      headers = cells.map(normalizeKey);
      assert(headers.length >= 2, `${label}_CSV_HEADER_INVALID`);
      return;
    }
    const record = {};
    headers.forEach((key, index) => { record[key] = cells[index] ?? ''; });
    rows += 1;
    onRow(record, headers);
  };

  for await (const chunk of response.body) {
    const bytesChunk = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    bytes += bytesChunk.byteLength;
    hash.update(bytesChunk);
    buffer += decoder.decode(bytesChunk, { stream: true });
    while (true) {
      const index = buffer.indexOf('\n');
      if (index < 0) break;
      consume(buffer.slice(0, index));
      buffer = buffer.slice(index + 1);
    }
  }
  buffer += decoder.decode();
  if (buffer) consume(buffer);
  assert(headers, `${label}_CSV_HEADER_REQUIRED`);
  return {
    final_url: response.url,
    response_sha256: `sha256:${hash.digest('hex')}`,
    response_bytes: bytes,
    rows_scanned: rows,
    headers,
    retrieved_at: new Date().toISOString(),
  };
}
function recentCount(times, latest, windowHours) {
  const floor = latest - windowHours * HOUR_MS;
  return new Set(times.filter((time) => time >= floor && time <= latest).map((time) => Math.floor(time / HOUR_MS))).size;
}
function assertCurrent(latest, label) {
  assert(Number.isFinite(latest), `${label}_LATEST_TIMESTAMP_REQUIRED`);
  const now = Date.now();
  assert(latest <= now + 5 * 60_000, `${label}_FUTURE_TIMESTAMP_FORBIDDEN`);
  const ageHours = (now - latest) / HOUR_MS;
  assert(ageHours <= config.live_thresholds.source_max_age_hours, `${label}_SOURCE_TOO_OLD_${ageHours.toFixed(2)}H`);
  return ageHours;
}
async function probeSoil() {
  const source = config.sources.soil_csv;
  const byDepth = new Map(source.required_depth_cm.map((depth) => [Number(depth), []]));
  let latest = -Infinity;
  let matchingRows = 0;
  let invalidVwcRows = 0;
  let rows2026 = 0;
  const stream = await streamCsv(source.url, (record, headers) => {
    for (const key of ['plot', 'datetime', 'treatment', 'replicate', 'depth_cm', 'vwc']) assert(headers.includes(key), `SOIL_REQUIRED_COLUMN_MISSING:${key}`);
    if (String(record.plot).trim() !== source.plot) return;
    matchingRows += 1;
    const time = parseProviderUtc(record.datetime);
    const depth = numberOrNull(record.depth_cm);
    const vwc = numberOrNull(record.vwc);
    if (time === null || depth === null) return;
    if (new Date(time).getUTCFullYear() === 2026) rows2026 += 1;
    if (vwc === null || vwc < config.live_thresholds.soil_vwc_min || vwc > config.live_thresholds.soil_vwc_max) { invalidVwcRows += 1; return; }
    if (!byDepth.has(depth)) return;
    byDepth.get(depth).push(time);
    if (time > latest) latest = time;
  }, 'SOIL_CSV');
  assert(matchingRows > 0, 'SOIL_G1R1_ROWS_REQUIRED');
  assert(rows2026 > 0, 'SOIL_G1R1_2026_ROWS_REQUIRED');
  assert.equal(invalidVwcRows, 0, 'SOIL_G1R1_INVALID_VWC_FOR_REQUIRED_ROWS');
  const ageHours = assertCurrent(latest, 'SOIL');
  const continuity = {};
  for (const depth of source.required_depth_cm) {
    const count = recentCount(byDepth.get(Number(depth)) || [], latest, config.live_thresholds.continuity_window_hours);
    continuity[String(depth)] = count;
    assert(count >= config.live_thresholds.minimum_distinct_hourly_points, `SOIL_DEPTH_${depth}_CONTINUITY_INSUFFICIENT_${count}`);
  }
  return {
    status: 'PASS',
    source_url: source.url,
    final_url: stream.final_url,
    response_sha256: stream.response_sha256,
    response_bytes: stream.response_bytes,
    rows_scanned: stream.rows_scanned,
    matching_g1r1_rows: matchingRows,
    matching_2026_rows: rows2026,
    required_depth_cm: source.required_depth_cm,
    continuity_distinct_hours_by_depth: continuity,
    latest_observation_at: new Date(latest).toISOString(),
    source_age_hours: Number(ageHours.toFixed(3)),
    canonical_observation_depth_cm: source.canonical_observation_depth_cm,
    canonical_observation_depth_support: source.canonical_observation_depth_support,
    raw_values_in_result: false,
    retrieved_at: stream.retrieved_at,
  };
}
async function probeWeather() {
  const source = config.sources.weather_csv;
  const required = source.required_columns;
  const completeTimes = [];
  let latestComplete = -Infinity;
  let rows2026 = 0;
  let complete2026Rows = 0;
  const stream = await streamCsv(source.url, (record, headers) => {
    for (const key of required) assert(headers.includes(key), `WEATHER_REQUIRED_COLUMN_MISSING:${key}`);
    const time = parseProviderUtc(record.datetime_utc);
    if (time === null || new Date(time).getUTCFullYear() !== 2026) return;
    rows2026 += 1;
    const complete = required.filter((key) => key !== 'datetime_utc').every((key) => numberOrNull(record[key]) !== null);
    if (!complete) return;
    complete2026Rows += 1;
    completeTimes.push(time);
    if (time > latestComplete) latestComplete = time;
  }, 'WEATHER_CSV');
  assert(rows2026 > 0, 'WEATHER_2026_ROWS_REQUIRED');
  assert(complete2026Rows > 0, 'WEATHER_COMPLETE_2026_ROWS_REQUIRED');
  const ageHours = assertCurrent(latestComplete, 'WEATHER');
  const continuity = recentCount(completeTimes, latestComplete, config.live_thresholds.continuity_window_hours);
  assert(continuity >= config.live_thresholds.minimum_distinct_hourly_points, `WEATHER_CONTINUITY_INSUFFICIENT_${continuity}`);
  return {
    status: 'PASS',
    source_url: source.url,
    final_url: stream.final_url,
    response_sha256: stream.response_sha256,
    response_bytes: stream.response_bytes,
    rows_scanned: stream.rows_scanned,
    matching_2026_rows: rows2026,
    complete_2026_rows: complete2026Rows,
    latest_complete_observation_at: new Date(latestComplete).toISOString(),
    source_age_hours: Number(ageHours.toFixed(3)),
    continuity_distinct_complete_hours: continuity,
    required_columns: required,
    raw_values_in_result: false,
    retrieved_at: stream.retrieved_at,
  };
}

async function main() {
  assert.equal(config.probe_mode, 'READ_ONLY_EXTERNAL_HTTP_EXACT_HEAD');
  assert.equal(config.raw_payload_policy.provider_payload_may_be_committed, false);
  assert.equal(config.raw_payload_policy.provider_payload_may_be_uploaded_as_ci_artifact, false);
  assert.equal(config.raw_payload_policy.result_may_include_raw_values, false);

  const bcse = await fetchTextAuthority(config.sources.bcse_authority, 'BCSE_AUTHORITY');
  const crop = await fetchCropAuthority(config.sources.crop_2026_planting);
  const soilMetadata = await fetchTextAuthority(config.sources.soil_metadata, 'SOIL_METADATA');
  const weatherMetadata = await fetchTextAuthority(config.sources.weather_metadata, 'WEATHER_METADATA');
  const terms = await fetchTextAuthority(config.sources.glbrc_terms, 'GLBRC_TERMS');
  const soil = await probeSoil();
  const weather = await probeWeather();

  const result = {
    schema_version: 'geox_mcft_cap09_ea1b_bcse_g1r1_live_source_probe_result_v1',
    status: 'PASS',
    candidate_site_id: config.candidate_site_id,
    probe_mode: config.probe_mode,
    observed_at: new Date().toISOString(),
    authorities: {
      bcse,
      crop_2026_planting: crop,
      soil_metadata: soilMetadata,
      weather_metadata: weatherMetadata,
      glbrc_terms: terms,
    },
    live_sources: { soil, weather },
    qualification_findings: {
      exact_2026_crop_identity: 'PASS_CORN_G1',
      contemporaneous_observed_soil_moisture_machine_feed: 'PASS_LIVE_PROBE',
      soil_moisture_spatial_authority: 'PASS_WITHIN_BCSE_G1R1_PARTIAL_ROOT_ZONE_NOT_STATE_EQUIVALENT',
      observed_meteorology_machine_feed: 'PASS_LIVE_PROBE_NEAR_SITE_SUPPORT',
      observed_rainfall_machine_feed: 'PASS_LIVE_PROBE_NEAR_SITE_SUPPORT',
      raw_provider_payload_hash_chain: 'PASS_HASH_ONLY_NO_RAW_PUBLICATION',
      public_raw_payload_publication_allowed: false,
      formal_site_qualified_by_this_probe: false,
      formal_window_started: false,
    },
    raw_payloads_persisted_or_uploaded: false,
    database_writes: 0,
    formal_evidence_writes: 0,
    runtime_source_delta: 0,
  };
  write(result);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1b_bcse_g1r1_live_source_probe_result_v1',
    status: 'FAIL',
    candidate_site_id: config.candidate_site_id,
    error: safeError(error),
    observed_at: new Date().toISOString(),
    raw_payloads_persisted_or_uploaded: false,
    database_writes: 0,
    formal_evidence_writes: 0,
    formal_window_started: false,
  };
  write(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
});
