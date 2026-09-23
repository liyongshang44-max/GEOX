#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { hash, canonicalGeometry, geometryValidationCodes } = require(path.join(ROOT, 'scripts/governance_acceptance/mcft00/MCFT00_GEOMETRY_AND_HASH.cjs'));
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-CDSE-RECENT-CLEAN-HISTORY-DISCOVERY-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_T3R1_CDSE_RECENT_CLEAN_HISTORY_DISCOVERY.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const ACCESS_TOKEN = String(process.env.CDSE_SENTINEL_HUB_ACCESS_TOKEN || '').trim();
const CRS_URI = 'http://www.opengis.net/def/crs/EPSG/0/4326';

const EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "SCL", "dataMask"],
    output: [
      { id: "metrics", bands: 11, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  const valid = s.dataMask === 1;
  const clearLand = valid && [4, 5].includes(s.SCL) ? 1 : 0;
  const vegetation = valid && s.SCL === 4 ? 1 : 0;
  const d = s.B08 + s.B04;
  const ndvi = clearLand && d > 0 ? (s.B08 - s.B04) / d : 0;
  return {
    metrics: [
      clearLand,
      vegetation,
      ndvi * clearLand,
      valid && s.SCL === 3 ? 1 : 0,
      valid && s.SCL === 6 ? 1 : 0,
      valid && s.SCL === 7 ? 1 : 0,
      valid && s.SCL === 8 ? 1 : 0,
      valid && s.SCL === 9 ? 1 : 0,
      valid && s.SCL === 10 ? 1 : 0,
      valid && s.SCL === 11 ? 1 : 0,
      valid ? 1 : 0
    ],
    dataMask: [valid ? 1 : 0]
  };
}`;

function assert(condition, code) { if (!condition) throw new Error(code); }
function sha256(value) { return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`; }
function safeError(error) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]')
    .replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]');
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(value));
}
function normalize(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function normalizeKey(value) { return normalize(value).replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }
function approvedUrl(url, host, pathname, code) {
  const parsed = new URL(url);
  assert(parsed.protocol === 'https:', `${code}_HTTPS_REQUIRED`);
  assert(parsed.hostname === host, `${code}_HOST_FORBIDDEN`);
  if (pathname) assert(parsed.pathname === pathname, `${code}_PATH_FORBIDDEN`);
  return parsed;
}
async function responseBytes(response) { return Buffer.from(await response.arrayBuffer()); }
async function getBytes(url, host, pathname, code) {
  approvedUrl(url, host, pathname, code);
  const response = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'GEOX-MCFT-CAP09-T3R1-CDSE-DISCOVERY/1.0' } });
  assert(response.ok, `${code}_HTTP_${response.status}`);
  approvedUrl(response.url, host, pathname, `${code}_REDIRECT`);
  const bytes = await responseBytes(response);
  return { bytes, retrieved_at: new Date().toISOString(), response_sha256: sha256(bytes) };
}
async function postJson(url, token, body, code) {
  const host = CONFIG.provider_sources.cdse_catalog.allowed_host;
  approvedUrl(url, host, new URL(url).pathname, code);
  const response = await fetch(url, {
    method: 'POST', redirect: 'error',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert(response.ok, `${code}_HTTP_${response.status}`);
  const bytes = await responseBytes(response);
  return { payload: JSON.parse(bytes.toString('utf8')), response_sha256: sha256(bytes), retrieved_at: new Date().toISOString() };
}
function parseDelimitedLine(line, delimiter) {
  const out = []; let value = ''; let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') { if (quoted && line[i + 1] === '"') { value += '"'; i += 1; } else quoted = !quoted; }
    else if (ch === delimiter && !quoted) { out.push(value); value = ''; }
    else value += ch;
  }
  out.push(value); return out;
}
function parseTable(text, requiredColumns) {
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < Math.min(lines.length, 40); i += 1) {
    if (!lines[i].trim()) continue;
    for (const delimiter of [',', '\t', ';', '|']) {
      const headers = parseDelimitedLine(lines[i], delimiter).map(normalizeKey);
      if (!requiredColumns.every((c) => headers.includes(c))) continue;
      const rows = [];
      for (const line of lines.slice(i + 1)) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const cells = parseDelimitedLine(line, delimiter);
        if (cells.length < headers.length) continue;
        const row = {}; headers.forEach((h, j) => { row[h] = cells[j] ?? ''; }); rows.push(row);
      }
      return rows;
    }
  }
  throw new Error('T3R1_CDSE_DISCOVERY_GEOMETRY_HEADER_REQUIRED');
}
function parseProviderQuadrilateral(raw) {
  const match = String(raw || '').trim().match(/^SRID=(\d+);POLYGON\(\(([^()]+)\)\)$/i);
  assert(match && Number(match[1]) === CONFIG.provider_geometry_selector.required_srid, 'T3R1_CDSE_DISCOVERY_MAIN_GEOMETRY_REQUIRED');
  const ring = match[2].split(',').map((token) => token.trim().split(/\s+/).map(Number));
  assert(ring.length >= 5 && ring.every((p) => p.length === 2 && p.every(Number.isFinite)), 'T3R1_CDSE_DISCOVERY_MAIN_GEOMETRY_INVALID');
  return ring.slice(0, -1);
}
function metersPerDegree(lat) { return { x: 111320 * Math.cos(lat * Math.PI / 180), y: 110574 }; }
function distanceM(a, b) { const s = metersPerDegree((a[1] + b[1]) / 2); return Math.hypot((b[0] - a[0]) * s.x, (b[1] - a[1]) * s.y); }
function orientShortAxis(points) {
  const lengths = points.map((p, i) => distanceM(p, points[(i + 1) % points.length]));
  return (lengths[0] + lengths[2]) <= (lengths[1] + lengths[3]) ? [...points] : [points[1], points[2], points[3], points[0]];
}
function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
function bilinear(p, u, v) { return lerp(lerp(p[0], p[1], u), lerp(p[3], p[2], u), v); }
function deriveCropOnlyGeometry(points) {
  const p = CONFIG.conservative_crop_only_subzone_policy;
  const ring = [bilinear(points, p.short_axis_fraction_start, p.long_axis_fraction_start), bilinear(points, p.short_axis_fraction_end, p.long_axis_fraction_start), bilinear(points, p.short_axis_fraction_end, p.long_axis_fraction_end), bilinear(points, p.short_axis_fraction_start, p.long_axis_fraction_end)];
  ring.push(ring[0]);
  const feature = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
  assert(geometryValidationCodes(feature).length === 0, 'T3R1_CDSE_DISCOVERY_DERIVED_GEOMETRY_INVALID');
  const semanticHash = hash(canonicalGeometry(feature));
  assert(semanticHash === p.expected_geometry_semantic_hash, `T3R1_CDSE_DISCOVERY_GEOMETRY_HASH_MISMATCH:${semanticHash}`);
  return { geometry: feature.geometry, semantic_hash: semanticHash };
}
async function fetchGeometry() {
  const source = CONFIG.provider_sources.plot_geometry_csv;
  const fetched = await getBytes(source.url, source.allowed_host, '/datatables/829.csv', 'T3R1_CDSE_DISCOVERY_KBS_GEOMETRY');
  const rows = parseTable(fetched.bytes.toString('utf8'), ['treatment', 'replicate', 'subplot', 'geometry']);
  const s = CONFIG.provider_geometry_selector;
  const matches = rows.filter((r) => normalize(r.treatment).toUpperCase() === s.treatment && normalize(r.replicate).toUpperCase() === s.replicate && normalize(r.subplot).toLowerCase() === s.subplot);
  assert(matches.length === s.expected_match_count, `T3R1_CDSE_DISCOVERY_GEOMETRY_MATCH_COUNT_${matches.length}`);
  return { ...deriveCropOnlyGeometry(orientShortAxis(parseProviderQuadrilateral(matches[0].geometry))), provider_response_sha256: fetched.response_sha256, provider_retrieved_at: fetched.retrieved_at };
}
function compactTimestampToIso(value) {
  const m = String(value).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  assert(m, `T3R1_CDSE_DISCOVERY_DATATAKE_TIMESTAMP_INVALID:${value}`);
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`;
}
function parseCompactId(id) {
  const m = String(id || '').trim().match(/^(S2[ABC])_MSIL2A_(\d{8}T\d{6})_N\d{4}_R(\d{3})_T([0-9A-Z]{5})_(\d{8}T\d{6})(?:\.SAFE)?$/);
  assert(m, `T3R1_CDSE_DISCOVERY_SCENE_ID_PARSE_REQUIRED:${String(id || '').slice(0, 96)}`);
  const start = compactTimestampToIso(m[2]);
  return { mission: m[1], datatake_start_utc: start, relative_orbit: `R${m[3]}`, tile_code: m[4], datatake_key: `${m[1]}|${start}|R${m[3]}` };
}
async function fetchCatalog(geometry) {
  const source = CONFIG.provider_sources.cdse_catalog;
  const w = CONFIG.discovery_window;
  const fetched = await postJson(source.url, ACCESS_TOKEN, {
    intersects: geometry,
    datetime: `${w.start_utc}/${w.end_utc}`,
    collections: [source.collection], limit: 100,
    fields: { include: ['id', 'properties.datetime', 'properties.eo:cloud_cover', 'properties.platform'], exclude: ['geometry', 'bbox', 'assets', 'links'] },
  }, 'T3R1_CDSE_DISCOVERY_CATALOG');
  const features = Array.isArray(fetched.payload.features) ? fetched.payload.features : [];
  assert(features.length > 0 && features.length < 100, `T3R1_CDSE_DISCOVERY_CATALOG_SCENE_COUNT_${features.length}`);
  const scenes = features.map((f) => {
    const compact = parseCompactId(f.id);
    const sensingMs = Date.parse(String(f?.properties?.datetime || ''));
    assert(Number.isFinite(sensingMs), 'T3R1_CDSE_DISCOVERY_SCENE_DATETIME_REQUIRED');
    return { scene_id: String(f.id), sensing_time_utc: new Date(sensingMs).toISOString(), scene_cloud_cover_percent: Number.isFinite(Number(f?.properties?.['eo:cloud_cover'])) ? Number(f.properties['eo:cloud_cover']) : null, platform: String(f?.properties?.platform || '').trim() || null, ...compact };
  }).sort((a, b) => a.datatake_start_utc.localeCompare(b.datatake_start_utc) || a.scene_id.localeCompare(b.scene_id));
  return { ...fetched, scenes };
}
function nextDay(day) { return new Date(Date.parse(`${day}T00:00:00.000Z`) + 86400000).toISOString().slice(0, 10); }
function statsBandMean(entry, index) { const v = entry?.outputs?.metrics?.bands?.[`B${index}`]?.stats?.mean; return Number.isFinite(Number(v)) ? Number(v) : null; }
function ratio(n, d) { return Number.isFinite(n) && Number.isFinite(d) && d > 0 ? n / d : null; }
async function statisticsForDay(geometry, day) {
  const source = CONFIG.provider_sources.cdse_statistics;
  const fetched = await postJson(source.url, ACCESS_TOKEN, {
    input: { bounds: { geometry, properties: { crs: CRS_URI } }, data: [{ type: CONFIG.provider_sources.cdse_catalog.collection, dataFilter: { mosaickingOrder: CONFIG.scene_binding_policy.daily_statistics_mosaicking_order }, processing: { upsampling: 'NEAREST', downsampling: 'NEAREST' } }] },
    aggregation: { timeRange: { from: `${day}T00:00:00.000Z`, to: `${nextDay(day)}T00:00:00.000Z` }, aggregationInterval: { of: 'P1D' }, evalscript: EVALSCRIPT, resx: CONFIG.observation_rule.pixel_resolution_m, resy: CONFIG.observation_rule.pixel_resolution_m },
  }, 'T3R1_CDSE_DISCOVERY_STATISTICS');
  const entry = Array.isArray(fetched.payload.data) ? fetched.payload.data[0] : null;
  if (!entry || entry.status === 'NO_DATA') return { stats_status: 'NO_DATA', response_sha256: fetched.response_sha256, retrieved_at: fetched.retrieved_at, passes_strict_standing_crop_screen: false };
  const clearLand = statsBandMean(entry, 0);
  const vegetation = statsBandMean(entry, 1);
  const ndviWeighted = statsBandMean(entry, 2);
  const vegetationOfClear = ratio(vegetation, clearLand);
  const meanNdvi = ratio(ndviWeighted, clearLand);
  const r = CONFIG.observation_rule;
  const pass = Number.isFinite(clearLand) && clearLand >= r.minimum_plot_clear_land_fraction && Number.isFinite(vegetationOfClear) && vegetationOfClear >= r.minimum_vegetated_fraction_of_clear_land && Number.isFinite(meanNdvi) && meanNdvi >= r.minimum_mean_ndvi_over_clear_land;
  return {
    stats_status: String(entry.status || 'OK'), response_sha256: fetched.response_sha256, retrieved_at: fetched.retrieved_at,
    plot_clear_land_fraction: clearLand,
    plot_vegetated_fraction_of_all_valid: vegetation,
    plot_vegetated_fraction_of_clear_land: vegetationOfClear,
    plot_mean_ndvi_over_clear_land: meanNdvi,
    scl_fraction_of_all_valid: { cloud_shadow: statsBandMean(entry, 3), water: statsBandMean(entry, 4), low_probability_cloud_or_unclassified: statsBandMean(entry, 5), cloud_medium_probability: statsBandMean(entry, 6), cloud_high_probability: statsBandMean(entry, 7), thin_cirrus: statsBandMean(entry, 8), snow_or_ice: statsBandMean(entry, 9) },
    plot_valid_fraction: statsBandMean(entry, 10), passes_strict_standing_crop_screen: pass,
  };
}
function groupCatalogByDay(scenes) {
  const map = new Map();
  for (const scene of scenes) {
    const day = scene.datatake_start_utc.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day).push(scene);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

async function main() {
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'T3R1_CDSE_DISCOVERY_EXACT_SUBJECT_REQUIRED');
  assert(CONFIG.exact_base_protected_main === '23f224c701dbe0b8bd56eceff3741cb1c3dc1f78', 'T3R1_CDSE_DISCOVERY_BASE_MISMATCH');
  assert(ACCESS_TOKEN.length > 40, 'T3R1_CDSE_DISCOVERY_EPHEMERAL_ACCESS_TOKEN_REQUIRED');
  assert(Date.parse(CONFIG.discovery_window.end_utc) <= Date.now() + 300000, 'T3R1_CDSE_DISCOVERY_FUTURE_WINDOW_FORBIDDEN');
  assert(JSON.stringify(CONFIG.observation_rule.scl_clear_land_classes) === JSON.stringify([4, 5]), 'T3R1_CDSE_DISCOVERY_STRICT_SCL_REQUIRED');

  const geometry = await fetchGeometry();
  const catalog = await fetchCatalog(geometry.geometry);
  const acquisition_days = [];
  for (const [day, scenes] of groupCatalogByDay(catalog.scenes)) {
    const datatakeKeys = [...new Set(scenes.map((s) => s.datatake_key))];
    const times = scenes.map((s) => Date.parse(s.sensing_time_utc));
    const binding = { acquisition_day_utc: day, scene_count: scenes.length, datatake_keys: datatakeKeys, datatake_ambiguous: datatakeKeys.length !== 1, tile_datetime_spread_seconds: times.length ? (Math.max(...times) - Math.min(...times)) / 1000 : null, scenes };
    if (datatakeKeys.length !== 1) { acquisition_days.push({ ...binding, statistics: null, passes_strict_standing_crop_screen: false }); continue; }
    const statistics = await statisticsForDay(geometry.geometry, day);
    acquisition_days.push({ ...binding, statistics, passes_strict_standing_crop_screen: statistics.passes_strict_standing_crop_screen === true });
  }
  const passing = acquisition_days.filter((x) => x.passes_strict_standing_crop_screen).sort((a, b) => b.acquisition_day_utc.localeCompare(a.acquisition_day_utc));
  const latest = passing[0] || null;

  write({
    schema_version: CONFIG.schema_version,
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    authority_effect: 'NONE_DISCOVERY_ONLY',
    discovery_window: CONFIG.discovery_window,
    represented_scope: CONFIG.candidate_scope,
    crop_only_geometry_binding: { status: 'MATCHED_CONSERVATIVE_T3R1_CROP_ONLY_SUBZONE', geometry_semantic_hash: geometry.semantic_hash, provider_response_sha256: geometry.provider_response_sha256, provider_retrieved_at: geometry.provider_retrieved_at, raw_or_derived_coordinates_emitted: false },
    catalog: { collection: CONFIG.provider_sources.cdse_catalog.collection, response_sha256: catalog.response_sha256, retrieved_at: catalog.retrieved_at, scene_count: catalog.scenes.length, acquisition_day_count: acquisition_days.length },
    strict_screen: { scl_clear_land_classes: [4, 5], minimum_plot_clear_land_fraction: CONFIG.observation_rule.minimum_plot_clear_land_fraction, minimum_vegetated_fraction_of_clear_land: CONFIG.observation_rule.minimum_vegetated_fraction_of_clear_land, minimum_mean_ndvi_over_clear_land: CONFIG.observation_rule.minimum_mean_ndvi_over_clear_land },
    acquisition_days,
    passing_acquisition_days_utc: passing.map((x) => x.acquisition_day_utc),
    latest_passing_observation: latest ? { acquisition_day_utc: latest.acquisition_day_utc, datatake_key: latest.datatake_keys[0], tile_datetime_spread_seconds: latest.tile_datetime_spread_seconds, statistics: latest.statistics } : null,
    current_management_season_lifecycle_resolved: false,
    bounded_carry_forward_authorized: false,
    runtime_write_count: 0, database_write_count: 0, scheduler_write_count: 0, formal_evidence_write_count: 0,
    ea5e2_operational_activation_qualified: false, formal_window_started: false, formal_execution_count: '0/24',
    next_frontier: latest ? 'T3R1_LATEST_CLEAN_OBSERVATION_CARRY_FORWARD_ADJUDICATION' : 'NO_RECENT_STRICT_CLEAN_SENTINEL2_ANCHOR',
  });
}

main().catch((error) => {
  write({ schema_version: CONFIG.schema_version, status: 'FAIL', subject_sha: SUBJECT_SHA || null, authority_effect: 'NONE', current_management_season_lifecycle_resolved: false, bounded_carry_forward_authorized: false, runtime_write_count: 0, database_write_count: 0, scheduler_write_count: 0, formal_evidence_write_count: 0, ea5e2_operational_activation_qualified: false, formal_window_started: false, formal_execution_count: '0/24', error: safeError(error) });
  process.exitCode = 1;
});
