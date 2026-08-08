#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1I-KBS-ET0-INPUT-AUTHORITY-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1I_KBS_ET0_INPUT_AUTHORITY_RESULT.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null;
const HOUR_MS = 3_600_000;
const LOCAL_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit' });

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
function finite(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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
      output.push(value); value = '';
    } else value += char;
  }
  output.push(value);
  return output;
}
function parseTabular(text, requiredColumns, label) {
  const lines = String(text).split(/\r?\n/);
  const delimiters = [',', '\t', ';', '|'];
  let headerIndex = -1;
  let delimiter = null;
  let headers = null;
  for (let index = 0, nonempty = 0; index < lines.length && nonempty < 50; index += 1) {
    if (!lines[index].trim()) continue;
    nonempty += 1;
    for (const candidate of delimiters) {
      const cells = parseDelimitedLine(lines[index], candidate).map(normalizeKey);
      if (requiredColumns.every((column) => cells.includes(normalizeKey(column)))) {
        headerIndex = index; delimiter = candidate; headers = cells; break;
      }
    }
    if (headers) break;
  }
  if (!headers) throw new Error(`${label}_REQUIRED_HEADER_NOT_FOUND`);
  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) continue;
    const cells = parseDelimitedLine(line, delimiter);
    if (cells.length < headers.length) continue;
    const row = {};
    headers.forEach((header, index) => { row[header] = cells[index] ?? ''; });
    rows.push(row);
  }
  if (!rows.length) throw new Error(`${label}_ROWS_REQUIRED`);
  return { headers, rows, delimiter: delimiter === ',' ? 'COMMA' : delimiter === '\t' ? 'TAB' : delimiter === ';' ? 'SEMICOLON' : 'PIPE', headerIndex };
}
function parseUtc(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?\s*(?:\+00:?00|\+0000|UTC|Z)?$/i);
  if (!match) return null;
  const timestamp = Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || '00'}Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}
function localDateKey(timestamp) {
  const parts = LOCAL_DATE.formatToParts(new Date(timestamp));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}
function climdbDateKey(value) {
  const raw = String(value || '').trim();
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const dashed = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return dashed ? `${dashed[1]}-${dashed[2]}-${dashed[3]}` : null;
}
function esKpa(temperatureC) {
  return 0.6108 * Math.exp((17.27 * temperatureC) / (temperatureC + 237.3));
}
function relativeError(actual, reference) {
  return Math.abs(reference) > 1e-12 ? Math.abs(actual - reference) / Math.abs(reference) : null;
}
async function fetchPageAndOfficialCsv(context, source, requiredPageMarkers, requiredCsvColumns, label) {
  const page = await context.newPage();
  const response = await page.goto(source.official_page, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  if (!response?.ok()) throw new Error(`${label}_PAGE_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  const bodyText = await page.locator('body').innerText();
  const normalized = bodyText.toLowerCase().replace(/\s+/g, ' ');
  for (const marker of requiredPageMarkers) {
    if (!normalized.includes(marker.toLowerCase())) throw new Error(`${label}_PAGE_MARKER_MISSING:${normalizeKey(marker)}`);
  }
  const anchor = page.getByRole('link', { name: /Download complete data table/i }).first();
  if (await anchor.count() !== 1) throw new Error(`${label}_DOWNLOAD_ANCHOR_REQUIRED`);
  const href = await anchor.getAttribute('href');
  if (!href) throw new Error(`${label}_DOWNLOAD_HREF_REQUIRED`);
  const resolved = new URL(href, source.official_page);
  const expected = new URL(source.download_path, source.official_page);
  if (resolved.protocol !== 'https:' || resolved.hostname !== expected.hostname || resolved.pathname !== expected.pathname || resolved.search) {
    throw new Error(`${label}_DOWNLOAD_LOCATOR_MISMATCH`);
  }
  const pageFinalUrl = response.url();
  const pageBytes = await response.body();
  const downloadResponse = await context.request.get(resolved.href, { timeout: 120_000, headers: { accept: 'text/csv,text/plain;q=0.9,*/*;q=0.5' } });
  if (!downloadResponse.ok()) throw new Error(`${label}_CSV_HTTP_${downloadResponse.status()}`);
  const bytes = await downloadResponse.body();
  if (bytes.byteLength > 100 * 1024 * 1024) throw new Error(`${label}_CSV_TOO_LARGE`);
  const text = bytes.toString('utf8');
  if (/^\s*<!doctype html|^\s*<html/i.test(text)) throw new Error(`${label}_CSV_HTML_FORBIDDEN`);
  const parsed = parseTabular(text, requiredCsvColumns, label);
  await page.close();
  return {
    page: { final_url: pageFinalUrl, response_sha256: sha256(pageBytes), markers_verified: requiredPageMarkers.length },
    csv: { final_url: resolved.href, response_sha256: sha256(bytes), response_bytes: bytes.byteLength, delimiter: parsed.delimiter, rows_scanned: parsed.rows.length, header_field_names: parsed.headers },
    rows: parsed.rows,
  };
}

let browser;
try {
  if (!SUBJECT_SHA || !/^[0-9a-f]{40}$/.test(SUBJECT_SHA)) throw new Error('EA1I_EXACT_SUBJECT_SHA_REQUIRED');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const rawSource = CONFIG.kbs_sources.raw_hourly;
  const climdbSource = CONFIG.kbs_sources.daily_climdb;
  const raw = await fetchPageAndOfficialCsv(
    context,
    rawSource,
    ['Raw hourly observations', 'SolRad AVG', 'WIND SPEED', 'AH', 'AirTmp 107 avg'],
    rawSource.required_columns,
    'EA1I_RAW_HOURLY',
  );
  const climdb = await fetchPageAndOfficialCsv(
    context,
    climdbSource,
    ['Weather Data formatted for ClimDB', 'Daily_AtmPressure_Mean_kpa', 'Daily_GlobalRad_Total_mjm2', 'Daily_WindSp_Mean_msec'],
    ['lter_site', 'station', 'date', 'daily_globalrad_total_mjm2', 'daily_windsp_mean_msec'],
    'EA1I_CLIMDB',
  );

  const semanticPage = await context.newPage();
  const semanticResponse = await semanticPage.goto(CONFIG.kbs_sources.daily_all_variates.official_page, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  if (!semanticResponse?.ok()) throw new Error(`EA1I_DAILY_SEMANTIC_PAGE_HTTP_${semanticResponse?.status() ?? 'NO_RESPONSE'}`);
  const semanticText = (await semanticPage.locator('body').innerText()).toLowerCase().replace(/\s+/g, ' ');
  for (const marker of ['average daily absolute humidity, partial pressure', 'calculated at the datalogger from absolute humidity and temperature']) {
    if (!semanticText.includes(marker)) throw new Error(`EA1I_AH_SEMANTIC_MARKER_MISSING:${normalizeKey(marker)}`);
  }
  const semanticPageHash = sha256(await semanticResponse.body());
  await semanticPage.close();

  const elevationPage = await context.newPage();
  const elevationResponse = await elevationPage.goto(CONFIG.kbs_sources.survey_elevation.official_page, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  if (!elevationResponse?.ok()) throw new Error(`EA1I_ELEVATION_PAGE_HTTP_${elevationResponse?.status() ?? 'NO_RESPONSE'}`);
  const elevationText = (await elevationPage.locator('body').innerText()).toLowerCase().replace(/\s+/g, ' ');
  for (const marker of ['survey grade', '286.43', 'near kbs lter weather station', 'navd88']) {
    if (!elevationText.includes(marker)) throw new Error(`EA1I_ELEVATION_MARKER_MISSING:${normalizeKey(marker)}`);
  }
  const elevationPageHash = sha256(await elevationResponse.body());
  await elevationPage.close();

  const rawByTimestamp = new Map();
  for (const row of raw.rows) {
    const timestamp = parseUtc(row.datetime_utc);
    if (timestamp === null) continue;
    rawByTimestamp.set(timestamp, {
      timestamp,
      solar: finite(row.solrad_avg),
      wind: finite(row.wind_speed),
      rh: finite(row.rh),
      ah: finite(row.ah),
      temperature: finite(row.airtmp_107_avg),
    });
  }
  const rawRecords = [...rawByTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
  if (rawRecords.length < 1000) throw new Error(`EA1I_RAW_TIMESTAMPED_ROWS_INSUFFICIENT:${rawRecords.length}`);
  const latest = rawRecords.at(-1).timestamp;
  const sourceAgeHours = (Date.now() - latest) / HOUR_MS;
  if (sourceAgeHours > 6) throw new Error(`EA1I_RAW_SOURCE_TOO_OLD:${sourceAgeHours.toFixed(2)}H`);
  if (sourceAgeHours < -5 / 60) throw new Error('EA1I_FUTURE_LATEST_TIMESTAMP_FORBIDDEN');

  const grouped = new Map();
  for (const record of rawRecords) {
    const date = localDateKey(record.timestamp);
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date).push(record);
  }
  const climdbDays = new Map();
  for (const row of climdb.rows) {
    if (String(row.lter_site || '').trim().toUpperCase() !== 'KBS') continue;
    if (String(row.station || '').trim().toUpperCase() !== 'LTERWS') continue;
    const date = climdbDateKey(row.date);
    const solar = finite(row.daily_globalrad_total_mjm2);
    const wind = finite(row.daily_windsp_mean_msec);
    if (!date || solar === null || wind === null || solar < 0 || wind < 0) continue;
    climdbDays.set(date, { solar, wind });
  }

  const solarAbsErrors = [];
  const solarRelErrors = [];
  const windAbsErrors = [];
  const windRelErrors = [];
  let crossTableDays = 0;
  for (const [date, reference] of climdbDays) {
    const records = grouped.get(date);
    if (!records) continue;
    const uniqueHours = new Set(records.map((record) => Math.floor(record.timestamp / HOUR_MS)));
    if (uniqueHours.size !== 24) continue;
    const solarValues = records.map((record) => record.solar);
    const windValues = records.map((record) => record.wind);
    if (solarValues.some((value) => value === null || value < 0) || windValues.some((value) => value === null || value < 0)) continue;
    const solarDailyMj = solarValues.reduce((sum, value) => sum + value * 0.0036, 0);
    const windDailyMean = windValues.reduce((sum, value) => sum + value, 0) / windValues.length;
    const solarAbs = Math.abs(solarDailyMj - reference.solar);
    const solarRel = relativeError(solarDailyMj, reference.solar);
    const windAbs = Math.abs(windDailyMean - reference.wind);
    const windRel = relativeError(windDailyMean, reference.wind);
    if (solarRel === null || windRel === null) continue;
    solarAbsErrors.push(solarAbs); solarRelErrors.push(solarRel);
    windAbsErrors.push(windAbs); windRelErrors.push(windRel);
    crossTableDays += 1;
  }

  const solarGate = CONFIG.reconciliation_gates.solar_unit;
  const windGate = CONFIG.reconciliation_gates.wind_unit;
  const solarMedianAbs = median(solarAbsErrors);
  const solarMedianRel = median(solarRelErrors);
  const windMedianAbs = median(windAbsErrors);
  const windMedianRel = median(windRelErrors);
  if (solarAbsErrors.length < solarGate.minimum_matching_days) throw new Error(`EA1I_SOLAR_MATCHING_DAYS_INSUFFICIENT:${solarAbsErrors.length}`);
  if (solarMedianAbs > solarGate.maximum_median_absolute_error_mj_m2_day || solarMedianRel > solarGate.maximum_median_relative_error_fraction) {
    throw new Error(`EA1I_SOLAR_UNIT_RECONCILIATION_FAILED:MEDIAN_ABS_${solarMedianAbs.toFixed(4)}:MEDIAN_REL_${solarMedianRel.toFixed(4)}`);
  }
  if (windAbsErrors.length < windGate.minimum_matching_days) throw new Error(`EA1I_WIND_MATCHING_DAYS_INSUFFICIENT:${windAbsErrors.length}`);
  if (windMedianAbs > windGate.maximum_median_absolute_error_m_per_s || windMedianRel > windGate.maximum_median_relative_error_fraction) {
    throw new Error(`EA1I_WIND_UNIT_RECONCILIATION_FAILED:MEDIAN_ABS_${windMedianAbs.toFixed(4)}:MEDIAN_REL_${windMedianRel.toFixed(4)}`);
  }

  const ahGate = CONFIG.reconciliation_gates.ah_unit;
  const recentFloor = latest - 30 * HOUR_MS;
  const ahAbsErrors = [];
  const ahRelErrors = [];
  for (const record of rawRecords) {
    if (record.timestamp < recentFloor || record.timestamp > latest) continue;
    if (record.rh === null || record.rh < 0 || record.rh > 100 || record.temperature === null || record.ah === null || record.ah <= 0) continue;
    const expected = (record.rh / 100) * esKpa(record.temperature);
    const abs = Math.abs(record.ah - expected);
    const rel = relativeError(record.ah, expected);
    if (rel === null) continue;
    ahAbsErrors.push(abs); ahRelErrors.push(rel);
  }
  const ahMedianAbs = median(ahAbsErrors);
  const ahMedianRel = median(ahRelErrors);
  if (ahAbsErrors.length < ahGate.minimum_recent_valid_comparison_hours) throw new Error(`EA1I_AH_VALID_COMPARISON_HOURS_INSUFFICIENT:${ahAbsErrors.length}`);
  if (ahMedianAbs > ahGate.maximum_median_absolute_error_kpa || ahMedianRel > ahGate.maximum_median_relative_error_fraction) {
    throw new Error(`EA1I_AH_KPA_RECONCILIATION_FAILED:MEDIAN_ABS_${ahMedianAbs.toFixed(4)}:MEDIAN_REL_${ahMedianRel.toFixed(4)}`);
  }

  const elevationGate = CONFIG.reconciliation_gates.elevation;
  const elevationDifference = Math.abs(elevationGate.selected_elevation_m - elevationGate.independent_expected_elevation_m);
  if (elevationDifference > elevationGate.maximum_difference_to_independent_nearby_kbs_station_elevation_m) {
    throw new Error(`EA1I_ELEVATION_CORROBORATION_FAILED:${elevationDifference.toFixed(2)}M`);
  }
  const z = elevationGate.selected_elevation_m;
  const pressureKpa = 101.3 * Math.pow((293 - 0.0065 * z) / 293, 5.26);
  const windFactor10mTo2m = 4.87 / Math.log(67.8 * 10 - 5.42);

  const result = {
    schema_version: 'geox_mcft_cap09_ea1i_kbs_et0_input_authority_result_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    observed_at: new Date().toISOString(),
    source_freshness: {
      latest_raw_hourly_observation_at: new Date(latest).toISOString(),
      raw_hourly_source_age_hours: Number(sourceAgeHours.toFixed(3)),
    },
    source_evidence: {
      raw_hourly: raw.csv,
      climdb: climdb.csv,
      daily_all_variates_page_sha256: semanticPageHash,
      survey_elevation_page_sha256: elevationPageHash,
      raw_numeric_values_emitted: false,
    },
    reconciliation: {
      solar_unit: {
        status: 'PASS_W_PER_M2',
        matching_days: solarAbsErrors.length,
        median_absolute_error_mj_m2_day: Number(solarMedianAbs.toFixed(6)),
        median_relative_error_fraction: Number(solarMedianRel.toFixed(6)),
        canonical_hourly_conversion_factor_to_mj_m2_h: 0.0036,
      },
      wind_unit: {
        status: 'PASS_M_PER_S_AT_10M',
        matching_days: windAbsErrors.length,
        median_absolute_error_m_per_s: Number(windMedianAbs.toFixed(6)),
        median_relative_error_fraction: Number(windMedianRel.toFixed(6)),
        source_height_m: 10,
        target_height_m: 2,
        frozen_adjustment_factor_10m_to_2m: Number(windFactor10mTo2m.toFixed(9)),
      },
      ah_unit: {
        status: 'PASS_PARTIAL_PRESSURE_KPA',
        recent_valid_comparison_hours: ahAbsErrors.length,
        median_absolute_error_kpa: Number(ahMedianAbs.toFixed(6)),
        median_relative_error_fraction: Number(ahMedianRel.toFixed(6)),
        rh_clipped_or_imputed: false,
        raw_ah_values_emitted: false,
      },
      elevation_pressure_path: {
        status: 'PASS_ELEVATION_PATH',
        selected_site_elevation_m: z,
        independent_elevation_difference_m: Number(elevationDifference.toFixed(3)),
        derived_mean_atmospheric_pressure_kpa: Number(pressureKpa.toFixed(6)),
        raw_barometer_used: false,
      },
    },
    qualification_findings: {
      historical_et0_input_bundle_candidate_complete: true,
      solar_unit_authority_candidate: 'PASS',
      wind_unit_and_height_adjustment_authority_candidate: 'PASS',
      actual_vapor_pressure_authority_candidate: 'PASS',
      elevation_pressure_authority_candidate: 'PASS',
      formal_source_authority_created: false,
      historical_et0_derivation_implemented: false,
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
    schema_version: 'geox_mcft_cap09_ea1i_kbs_et0_input_authority_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA,
    error: safeError(error),
    observed_at: new Date().toISOString(),
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
