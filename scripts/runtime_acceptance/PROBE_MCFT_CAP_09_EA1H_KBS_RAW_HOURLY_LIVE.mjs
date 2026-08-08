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

function sha256(input) {
  return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
}
function writeResult(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function normalizeKey(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function safeError(error) {
  return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]');
}
function parseDelimitedLine(line, delimiter) {
  const output = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      output.push(value);
      value = '';
    } else {
      value += char;
    }
  }
  output.push(value);
  return output;
}
function parseProviderUtc(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\s*(?:\+0000|UTC|Z))?$/i);
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || '00'}Z`;
  const millis = Date.parse(iso);
  return Number.isFinite(millis) ? millis : null;
}
function finiteNumber(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}
function withinRange(value, range) {
  return value !== null && value >= range.min && value <= range.max;
}
function distinctHours(times, floor, ceiling) {
  return new Set(times.filter((time) => time >= floor && time <= ceiling).map((time) => Math.floor(time / HOUR_MS))).size;
}
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
  let headerIndex = -1;
  let delimiter = null;
  let headers = null;

  for (let index = 0, nonempty = 0; index < lines.length && nonempty < CONFIG.transport_limits.max_preamble_nonempty_lines; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    nonempty += 1;
    for (const candidate of delimiters) {
      const cells = parseDelimitedLine(line, candidate).map(normalizeKey);
      if (requiredColumns.every((column) => cells.includes(column))) {
        headerIndex = index;
        delimiter = candidate;
        headers = cells;
        break;
      }
    }
    if (headers) break;
  }
  if (!headers) throw new Error('EA1H_REQUIRED_CSV_HEADER_NOT_FOUND');

  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) continue;
    const cells = parseDelimitedLine(line, delimiter);
    if (cells.length < headers.length) continue;
    const row = {};
    headers.forEach((header, index) => { row[header] = cells[index] ?? ''; });
    rows.push(row);
  }
  if (!rows.length) throw new Error('EA1H_CSV_ROWS_REQUIRED');
  return { headers, rows, delimiter: delimiter === '\t' ? 'TAB' : delimiter === ',' ? 'COMMA' : delimiter === ';' ? 'SEMICOLON' : 'PIPE', headerIndex };
}

let browser;
let pageEvidence = null;
let downloadEvidence = null;
try {
  if (!SUBJECT_SHA || !/^[0-9a-f]{40}$/.test(SUBJECT_SHA)) throw new Error('EA1H_EXACT_SUBJECT_SHA_REQUIRED');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'en-US', timezoneId: 'UTC' });
  const page = await context.newPage();

  const response = await page.goto(CONFIG.source.official_page, { waitUntil: 'domcontentloaded', timeout: CONFIG.transport_limits.page_timeout_ms });
  if (!response || response.status() < 200 || response.status() >= 400) throw new Error(`EA1H_SOURCE_PAGE_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);

  const renderedText = await page.locator('body').innerText();
  const renderedDom = await page.content();
  for (const marker of [CONFIG.source.dataset_label, 'Raw hourly observations', 'SolRad AVG', 'rain mm', CONFIG.source.download_locator.anchor_text]) {
    if (!renderedText.toLowerCase().includes(marker.toLowerCase())) throw new Error(`EA1H_SOURCE_PAGE_MARKER_MISSING:${normalizeKey(marker)}`);
  }
  pageEvidence = {
    status: response.status(),
    final_host: new URL(response.url()).hostname,
    rendered_document_sha256: sha256(renderedDom),
    rendered_text_sha256: sha256(renderedText),
    declared_data_availability_present: /Data available from:/i.test(renderedText),
    declared_last_updated_present: /Last Updated/i.test(renderedText),
    page_excerpt_not_used_as_live_authority: true,
  };

  const link = page.getByRole('link', { name: CONFIG.source.download_locator.anchor_text }).first();
  await link.waitFor({ state: 'attached', timeout: 15_000 });
  const href = await link.getAttribute('href');
  const downloadUrl = ensureOfficialDownload(href);

  const apiResponse = await context.request.get(downloadUrl.toString(), {
    timeout: CONFIG.transport_limits.download_timeout_ms,
    headers: { accept: 'text/csv,text/plain;q=0.9,*/*;q=0.5', 'user-agent': 'GEOX-MCFT-CAP09-EA1H-READ-ONLY/1.0' },
  });
  if (!apiResponse.ok()) throw new Error(`EA1H_DOWNLOAD_HTTP_${apiResponse.status()}`);
  const headers = apiResponse.headers();
  const contentLength = Number(headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > CONFIG.transport_limits.max_download_bytes) throw new Error(`EA1H_DOWNLOAD_CONTENT_LENGTH_TOO_LARGE:${contentLength}`);
  const body = await apiResponse.body();
  if (body.byteLength > CONFIG.transport_limits.max_download_bytes) throw new Error(`EA1H_DOWNLOAD_BODY_TOO_LARGE:${body.byteLength}`);
  const contentType = String(headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (contentType.includes('text/html')) throw new Error('EA1H_DOWNLOAD_HTML_RESPONSE_FORBIDDEN');

  downloadEvidence = {
    final_host: new URL(apiResponse.url()).hostname,
    path: new URL(apiResponse.url()).pathname,
    status: apiResponse.status(),
    content_type: contentType,
    response_body_sha256: sha256(body),
    response_bytes: body.byteLength,
    raw_body_persisted: false,
  };

  const parsed = parseCsvBody(new TextDecoder().decode(body));
  const columns = CONFIG.required_columns;
  const ranges = CONFIG.physical_sanity_ranges;
  const allTimes = [];
  const completeEt0Times = [];
  const observedRainTimes = [];
  let timestampRows = 0;
  let physicalInvalidRows = 0;
  let futureRows = 0;

  const now = Date.now();
  const futureCeiling = now + CONFIG.freshness_and_continuity.future_timestamp_tolerance_minutes * 60_000;

  for (const row of parsed.rows) {
    const time = parseProviderUtc(row[columns.timestamp]);
    if (time === null) continue;
    timestampRows += 1;
    if (time > futureCeiling) { futureRows += 1; continue; }
    allTimes.push(time);

    const solar = finiteNumber(row[columns.solar_radiation]);
    const wind = finiteNumber(row[columns.wind_speed]);
    const rh = finiteNumber(row[columns.relative_humidity]);
    const air = finiteNumber(row[columns.air_temperature]);
    const pressure = finiteNumber(row[columns.barometric_pressure]);
    const rain = finiteNumber(row[columns.rainfall]);

    const et0Values = [
      [solar, ranges[columns.solar_radiation]],
      [wind, ranges[columns.wind_speed]],
      [rh, ranges[columns.relative_humidity]],
      [air, ranges[columns.air_temperature]],
      [pressure, ranges[columns.barometric_pressure]],
    ];
    const et0Complete = et0Values.every(([value, range]) => withinRange(value, range));
    if (et0Complete) completeEt0Times.push(time);
    else if (et0Values.some(([value]) => value !== null)) physicalInvalidRows += et0Values.some(([value, range]) => value !== null && !withinRange(value, range)) ? 1 : 0;

    if (withinRange(rain, ranges[columns.rainfall])) observedRainTimes.push(time);
    else if (rain !== null) physicalInvalidRows += 1;
  }

  if (!allTimes.length) throw new Error('EA1H_TIMESTAMPED_ROWS_REQUIRED');
  if (futureRows > 0) throw new Error(`EA1H_FUTURE_TIMESTAMP_ROWS_FORBIDDEN:${futureRows}`);
  if (physicalInvalidRows > 0) throw new Error(`EA1H_PHYSICAL_SANITY_FAILURE_ROWS:${physicalInvalidRows}`);

  const latest = Math.max(...allTimes);
  const ageHours = (now - latest) / HOUR_MS;
  if (ageHours > CONFIG.freshness_and_continuity.latest_record_max_age_hours) throw new Error(`EA1H_SOURCE_TOO_OLD:${ageHours.toFixed(2)}H`);
  const floor = latest - CONFIG.freshness_and_continuity.recent_window_hours * HOUR_MS;
  const recentDistinct = distinctHours(allTimes, floor, latest);
  const recentEt0 = distinctHours(completeEt0Times, floor, latest);
  const recentRain = distinctHours(observedRainTimes, floor, latest);
  if (recentDistinct < CONFIG.freshness_and_continuity.minimum_recent_distinct_hours) throw new Error(`EA1H_RECENT_HOURLY_CONTINUITY_INSUFFICIENT:${recentDistinct}`);
  if (recentEt0 < CONFIG.freshness_and_continuity.minimum_recent_complete_et0_hours) throw new Error(`EA1H_RECENT_ET0_INPUT_CONTINUITY_INSUFFICIENT:${recentEt0}`);
  if (recentRain < CONFIG.freshness_and_continuity.minimum_recent_observed_rain_hours) throw new Error(`EA1H_RECENT_RAIN_CONTINUITY_INSUFFICIENT:${recentRain}`);

  const result = {
    schema_version: 'geox_mcft_cap09_ea1h_kbs_raw_hourly_live_probe_result_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    provider: CONFIG.source.provider,
    page: pageEvidence,
    download: downloadEvidence,
    tabular_structure: {
      delimiter: parsed.delimiter,
      preamble_nonempty_lines_skipped: parsed.headerIndex,
      header_field_names: parsed.headers,
      rows_scanned: parsed.rows.length,
      timestamped_rows: timestampRows,
      raw_numeric_values_emitted: false,
    },
    live_evidence: {
      latest_observation_at: new Date(latest).toISOString(),
      source_age_hours: Number(ageHours.toFixed(3)),
      recent_window_hours: CONFIG.freshness_and_continuity.recent_window_hours,
      recent_distinct_hours: recentDistinct,
      recent_complete_et0_input_hours: recentEt0,
      recent_observed_rain_hours: recentRain,
      future_timestamp_rows: futureRows,
      physical_sanity_failure_rows: physicalInvalidRows,
    },
    qualification_findings: {
      official_download_locator: 'PASS',
      transient_machine_access: 'PASS',
      current_raw_hourly_feed: 'PASS',
      observed_solar_role_continuity: 'PASS',
      observed_interval_rain_role_continuity: 'PASS',
      observed_et0_input_role_continuity: 'PASS',
      page_metadata_conflict_overridden_by_download_timestamp: false,
      formal_source_authority_created: false,
      qualified_formal_site: false,
      formal_window_started: false,
    },
    raw_provider_payload_persisted: false,
    raw_provider_payload_uploaded: false,
    public_raw_data_republication_right_claimed: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    runtime_product_source_delta: 0,
  };
  writeResult(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1h_kbs_raw_hourly_live_probe_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA,
    error: safeError(error),
    page_evidence: pageEvidence,
    download_evidence: downloadEvidence,
    raw_provider_payload_persisted: false,
    raw_provider_payload_uploaded: false,
    public_raw_data_republication_right_claimed: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    qualified_formal_site: false,
    formal_window_started: false,
  };
  writeResult(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
}
