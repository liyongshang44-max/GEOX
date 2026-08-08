#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1H-KBS-RAW-HOURLY-LIVE-PROBE-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1H_KBS_RAW_HOURLY_LIVE_PROBE_RESULT.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null;
const HOUR_MS = 3_600_000;

function sha256(input) { return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`; }
function writeResult(value) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function normalizeKey(value) { return String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }
function safeError(error) { return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]'); }
function parseDelimitedLine(line, delimiter) {
  const output = []; let value = ''; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { output.push(value); value = ''; }
    else value += char;
  }
  output.push(value); return output;
}
function utcMillis(year, month, day, hour, minute, second) {
  const values = [year, month, day, hour, minute, second].map(Number);
  if (!values.every(Number.isInteger)) return null;
  const [y, m, d, h, min, s] = values;
  if (y < 1980 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31 || h < 0 || h > 23 || min < 0 || min > 59 || s < 0 || s > 60) return null;
  const millis = Date.UTC(y, m - 1, d, h, min, Math.min(s, 59));
  const check = new Date(millis);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d || check.getUTCHours() !== h || check.getUTCMinutes() !== min) return null;
  return millis;
}
function parseProviderUtc(value) {
  const raw = String(value || '').replace(/\u00a0/g, ' ').trim();
  if (!raw) return null;
  const cleaned = raw.replace(/\s+(?:UTC|GMT)$/i, '').replace(/\s+(?:\+0000|\+00:00|\+00)$/i, '').replace(/Z$/i, '').trim();
  let match = cleaned.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?$/);
  if (match) return utcMillis(match[1], match[2], match[3], match[4], match[5], match[6] || 0);
  match = cleaned.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?$/);
  if (match) return utcMillis(match[3], match[1], match[2], match[4], match[5], match[6] || 0);
  const explicitUtc = /(?:Z|UTC|GMT|\+0000|\+00:00|\+00)\s*$/i.test(raw);
  if (explicitUtc) { const parsed = Date.parse(raw); if (Number.isFinite(parsed)) return parsed; }
  return null;
}
function finiteNumber(value) { const raw = String(value ?? '').trim(); if (!raw) return null; const number = Number(raw); return Number.isFinite(number) ? number : null; }
function withinRange(value, range) { return value !== null && value >= range.min && value <= range.max; }
function distinctHours(times, floor, ceiling) { return new Set(times.filter((time) => time >= floor && time <= ceiling).map((time) => Math.floor(time / HOUR_MS))).size; }
function ensureOfficialDownload(rawHref) {
  if (!rawHref) throw new Error('EA1H_DOWNLOAD_HREF_REQUIRED');
  const resolved = new URL(rawHref, CONFIG.source.official_page);
  if (resolved.protocol !== 'https:') throw new Error('EA1H_DOWNLOAD_HTTPS_REQUIRED');
  if (CONFIG.source.download_locator.same_official_host_required && resolved.hostname !== CONFIG.source.official_host) throw new Error('EA1H_DOWNLOAD_OFFICIAL_HOST_REQUIRED');
  if (resolved.pathname !== CONFIG.source.download_locator.required_resolved_path) throw new Error(`EA1H_DOWNLOAD_PATH_MISMATCH:${resolved.pathname}`);
  if (CONFIG.source.download_locator.query_string_forbidden && resolved.search) throw new Error('EA1H_DOWNLOAD_QUERY_FORBIDDEN');
  return resolved;
}
function parseCsvBody(text) {
  const lines = String(text).split(/\r?\n/);
  const requiredColumns = Object.values(CONFIG.required_columns);
  const delimiters = [',', '\t', ';', '|'];
  let headerIndex = -1; let delimiter = null; let headers = null;
  for (let index = 0, nonempty = 0; index < lines.length && nonempty < CONFIG.transport_limits.max_preamble_nonempty_lines; index += 1) {
    const line = lines[index]; if (!line.trim()) continue; nonempty += 1;
    for (const candidate of delimiters) {
      const cells = parseDelimitedLine(line, candidate).map(normalizeKey);
      if (requiredColumns.every((column) => cells.includes(column))) { headerIndex = index; delimiter = candidate; headers = cells; break; }
    }
    if (headers) break;
  }
  if (!headers) throw new Error('EA1H_REQUIRED_CSV_HEADER_NOT_FOUND');
  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) continue;
    const cells = parseDelimitedLine(line, delimiter); if (cells.length < headers.length) continue;
    const row = {}; headers.forEach((header, index) => { row[header] = cells[index] ?? ''; }); rows.push(row);
  }
  if (!rows.length) throw new Error('EA1H_CSV_ROWS_REQUIRED');
  return { headers, rows, delimiter: delimiter === '\t' ? 'TAB' : delimiter === ',' ? 'COMMA' : delimiter === ';' ? 'SEMICOLON' : 'PIPE', headerIndex };
}

let browser; let pageEvidence = null; let downloadEvidence = null;
try {
  if (!SUBJECT_SHA || !/^[0-9a-f]{40}$/.test(SUBJECT_SHA)) throw new Error('EA1H_EXACT_SUBJECT_SHA_REQUIRED');
  if (CONFIG.et0_readiness.ea1h_may_claim_complete_et0_input_bundle !== false) throw new Error('EA1H_COMPLETE_ET0_CLAIM_FORBIDDEN');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'en-US', timezoneId: 'UTC' });
  const page = await context.newPage();
  const response = await page.goto(CONFIG.source.official_page, { waitUntil: 'domcontentloaded', timeout: CONFIG.transport_limits.page_timeout_ms });
  if (!response || response.status() < 200 || response.status() >= 400) throw new Error(`EA1H_SOURCE_PAGE_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  const renderedText = await page.locator('body').innerText(); const renderedDom = await page.content();
  for (const marker of [CONFIG.source.dataset_label, 'Raw hourly observations', 'SolRad AVG', 'rain mm', CONFIG.source.download_locator.anchor_text]) if (!renderedText.toLowerCase().includes(marker.toLowerCase())) throw new Error(`EA1H_SOURCE_PAGE_MARKER_MISSING:${normalizeKey(marker)}`);
  pageEvidence = { status: response.status(), final_host: new URL(response.url()).hostname, rendered_document_sha256: sha256(renderedDom), rendered_text_sha256: sha256(renderedText), declared_data_availability_present: /Data available from:/i.test(renderedText), declared_last_updated_present: /Last Updated/i.test(renderedText), page_excerpt_not_used_as_live_authority: true };
  const link = page.getByRole('link', { name: CONFIG.source.download_locator.anchor_text }).first(); await link.waitFor({ state: 'attached', timeout: 15_000 });
  const downloadUrl = ensureOfficialDownload(await link.getAttribute('href'));
  const apiResponse = await context.request.get(downloadUrl.toString(), { timeout: CONFIG.transport_limits.download_timeout_ms, headers: { accept: 'text/csv,text/plain;q=0.9,*/*;q=0.5', 'user-agent': 'GEOX-MCFT-CAP09-EA1H-READ-ONLY/2.0' } });
  if (!apiResponse.ok()) throw new Error(`EA1H_DOWNLOAD_HTTP_${apiResponse.status()}`);
  const responseHeaders = apiResponse.headers(); const contentLength = Number(responseHeaders['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > CONFIG.transport_limits.max_download_bytes) throw new Error(`EA1H_DOWNLOAD_CONTENT_LENGTH_TOO_LARGE:${contentLength}`);
  const body = await apiResponse.body(); if (body.byteLength > CONFIG.transport_limits.max_download_bytes) throw new Error(`EA1H_DOWNLOAD_BODY_TOO_LARGE:${body.byteLength}`);
  const contentType = String(responseHeaders['content-type'] || '').split(';')[0].trim().toLowerCase(); if (contentType.includes('text/html')) throw new Error('EA1H_DOWNLOAD_HTML_RESPONSE_FORBIDDEN');
  downloadEvidence = { final_host: new URL(apiResponse.url()).hostname, path: new URL(apiResponse.url()).pathname, status: apiResponse.status(), content_type: contentType, response_body_sha256: sha256(body), response_bytes: body.byteLength, raw_body_persisted: false };

  const parsed = parseCsvBody(new TextDecoder().decode(body)); const columns = CONFIG.required_columns; const ranges = CONFIG.diagnostic_sanity_ranges;
  const records = []; let unparsedTimestampRows = 0; let futureRows = 0; const now = Date.now(); const futureCeiling = now + CONFIG.freshness_and_continuity.future_timestamp_tolerance_minutes * 60_000;
  for (const row of parsed.rows) {
    const rawTimestamp = row[columns.timestamp]; const time = parseProviderUtc(rawTimestamp);
    if (time === null) { if (String(rawTimestamp || '').trim()) unparsedTimestampRows += 1; continue; }
    if (time > futureCeiling) { futureRows += 1; continue; }
    records.push({
      time,
      solar: finiteNumber(row[columns.solar_radiation]),
      wind: finiteNumber(row[columns.wind_speed]),
      rh: finiteNumber(row[columns.relative_humidity]),
      ah: finiteNumber(row[columns.absolute_humidity_or_partial_pressure]),
      air: finiteNumber(row[columns.air_temperature]),
      pressure: finiteNumber(row[columns.barometric_pressure]),
      rain: finiteNumber(row[columns.rainfall]),
    });
  }
  if (!records.length) throw new Error(`EA1H_TIMESTAMPED_ROWS_REQUIRED:UNPARSED_NONEMPTY_${unparsedTimestampRows}`);
  if (futureRows > 0) throw new Error(`EA1H_FUTURE_TIMESTAMP_ROWS_FORBIDDEN:${futureRows}`);
  const latest = records.reduce((maximum, record) => record.time > maximum ? record.time : maximum, Number.NEGATIVE_INFINITY);
  const ageHours = (now - latest) / HOUR_MS; if (ageHours > CONFIG.freshness_and_continuity.latest_record_max_age_hours) throw new Error(`EA1H_SOURCE_TOO_OLD:${ageHours.toFixed(2)}H:LATEST_${new Date(latest).toISOString()}`);
  const floor = latest - CONFIG.freshness_and_continuity.recent_window_hours * HOUR_MS;
  const recent = records.filter((record) => record.time >= floor && record.time <= latest);
  const recentDistinct = distinctHours(recent.map((record) => record.time), floor, latest);
  const roleTimes = {
    rain: recent.filter((record) => withinRange(record.rain, ranges.rain_mm)).map((record) => record.time),
    solar: recent.filter((record) => record.solar !== null).map((record) => record.time),
    wind: recent.filter((record) => record.wind !== null).map((record) => record.time),
    air: recent.filter((record) => withinRange(record.air, ranges.airtmp_107_avg)).map((record) => record.time),
    rh_valid: recent.filter((record) => withinRange(record.rh, ranges.rh)).map((record) => record.time),
    rh_invalid: recent.filter((record) => record.rh !== null && !withinRange(record.rh, ranges.rh)).map((record) => record.time),
    ah_numeric: recent.filter((record) => record.ah !== null).map((record) => record.time),
    pressure_numeric: recent.filter((record) => record.pressure !== null).map((record) => record.time),
  };
  const counts = Object.fromEntries(Object.entries(roleTimes).map(([key, times]) => [key, distinctHours(times, floor, latest)]));
  if (recentDistinct < CONFIG.freshness_and_continuity.minimum_recent_distinct_hours) throw new Error(`EA1H_RECENT_HOURLY_CONTINUITY_INSUFFICIENT:${recentDistinct}`);
  if (counts.rain < CONFIG.freshness_and_continuity.minimum_recent_numeric_rain_hours) throw new Error(`EA1H_RECENT_RAIN_CONTINUITY_INSUFFICIENT:${counts.rain}`);
  if (counts.solar < CONFIG.freshness_and_continuity.minimum_recent_numeric_solar_hours) throw new Error(`EA1H_RECENT_SOLAR_ROLE_CONTINUITY_INSUFFICIENT:${counts.solar}`);
  if (counts.wind < CONFIG.freshness_and_continuity.minimum_recent_numeric_wind_hours) throw new Error(`EA1H_RECENT_WIND_ROLE_CONTINUITY_INSUFFICIENT:${counts.wind}`);
  if (counts.air < CONFIG.freshness_and_continuity.minimum_recent_numeric_air_temperature_hours) throw new Error(`EA1H_RECENT_AIR_ROLE_CONTINUITY_INSUFFICIENT:${counts.air}`);

  const result = {
    schema_version: 'geox_mcft_cap09_ea1h_kbs_raw_hourly_live_probe_result_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    provider: CONFIG.source.provider,
    page: pageEvidence,
    download: downloadEvidence,
    tabular_structure: { delimiter: parsed.delimiter, preamble_nonempty_lines_skipped: parsed.headerIndex, header_field_names: parsed.headers, rows_scanned: parsed.rows.length, timestamped_rows: records.length, unparsed_nonempty_timestamp_rows: unparsedTimestampRows, raw_numeric_values_emitted: false },
    live_evidence: { latest_observation_at: new Date(latest).toISOString(), source_age_hours: Number(ageHours.toFixed(3)), recent_window_hours: CONFIG.freshness_and_continuity.recent_window_hours, recent_distinct_hours: recentDistinct, future_timestamp_rows: futureRows },
    role_continuity: {
      interval_rain_numeric_distinct_hours: counts.rain,
      solar_radiation_numeric_distinct_hours: counts.solar,
      wind_numeric_distinct_hours: counts.wind,
      air_temperature_valid_distinct_hours: counts.air,
      relative_humidity_valid_distinct_hours: counts.rh_valid,
      relative_humidity_invalid_distinct_hours: counts.rh_invalid,
      ah_numeric_distinct_hours: counts.ah_numeric,
      barometer_numeric_distinct_hours: counts.pressure_numeric,
      raw_values_emitted: false,
    },
    qualification_findings: {
      official_download_locator: 'PASS',
      transient_machine_access: 'PASS',
      current_raw_hourly_feed: 'PASS',
      interval_rain_machine_role: 'PASS',
      solar_radiation_machine_role: 'PASS_UNIT_AUTHORITY_PENDING',
      wind_machine_role: 'PASS_HEIGHT_ADJUSTMENT_AUTHORITY_PENDING',
      air_temperature_machine_role: 'PASS',
      complete_et0_input_bundle: 'INCOMPLETE_PENDING_EA1I_HUMIDITY_AND_PRESSURE_OR_ELEVATION_AUTHORITY',
      rh_invalid_values_clipped_or_imputed: false,
      ah_relabelled_as_vapor_pressure: false,
      barometer_unit_guessed: false,
      formal_source_authority_created: false,
      qualified_formal_site: false,
      formal_window_started: false
    },
    raw_provider_payload_persisted: false,
    raw_provider_payload_uploaded: false,
    public_raw_data_republication_right_claimed: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    runtime_product_source_delta: 0
  };
  writeResult(result); console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = { schema_version: 'geox_mcft_cap09_ea1h_kbs_raw_hourly_live_probe_result_v1', status: 'FAIL', subject_sha: SUBJECT_SHA, error: safeError(error), page_evidence: pageEvidence, download_evidence: downloadEvidence, raw_provider_payload_persisted: false, raw_provider_payload_uploaded: false, public_raw_data_republication_right_claimed: false, database_write_count: 0, formal_evidence_write_count: 0, qualified_formal_site: false, formal_window_started: false };
  writeResult(result); console.error(JSON.stringify(result, null, 2)); process.exitCode = 1;
} finally { await browser?.close(); }
