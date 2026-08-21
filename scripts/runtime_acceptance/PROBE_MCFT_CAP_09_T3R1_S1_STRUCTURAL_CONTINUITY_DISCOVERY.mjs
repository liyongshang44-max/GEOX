#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { hash, canonicalGeometry, geometryValidationCodes } = require(path.join(ROOT, 'scripts/governance_acceptance/mcft00/MCFT00_GEOMETRY_AND_HASH.cjs'));
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-S1-STRUCTURAL-CONTINUITY-DISCOVERY-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_T3R1_S1_STRUCTURAL_CONTINUITY_DISCOVERY.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const ACCESS_TOKEN = String(process.env.CDSE_SENTINEL_HUB_ACCESS_TOKEN || '').trim();
const CRS_URI = 'http://www.opengis.net/def/crs/EPSG/0/4326';

const EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: ["VV", "VH", "dataMask"],
    output: [
      { id: "metrics", bands: 4, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  const valid = s.dataMask === 1 && s.VV > 0 && s.VH > 0;
  const vvDb = valid ? 10 * Math.log10(s.VV) : 0;
  const vhDb = valid ? 10 * Math.log10(s.VH) : 0;
  const ratio = valid ? s.VH / s.VV : 0;
  return {
    metrics: [valid ? 1 : 0, vvDb * (valid ? 1 : 0), vhDb * (valid ? 1 : 0), ratio * (valid ? 1 : 0)],
    dataMask: [1]
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
  const response = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'GEOX-MCFT-CAP09-T3R1-S1-DISCOVERY/1.0' } });
  assert(response.ok, `${code}_HTTP_${response.status}`);
  approvedUrl(response.url, host, pathname, `${code}_REDIRECT`);
  const bytes = await responseBytes(response);
  return { bytes, retrieved_at: new Date().toISOString(), response_sha256: sha256(bytes) };
}
async function postJson(url, token, body, code) {
  const host = CONFIG.provider_sources.cdse_catalog.allowed_host;
  approvedUrl(url, host, new URL(url).pathname, code);
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
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
  throw new Error('T3R1_S1_DISCOVERY_GEOMETRY_HEADER_REQUIRED');
}
function parseProviderQuadrilateral(raw) {
  const match = String(raw || '').trim().match(/^SRID=(\d+);POLYGON\(\(([^()]+)\)\)$/i);
  assert(match && Number(match[1]) === CONFIG.provider_geometry_selector.required_srid, 'T3R1_S1_DISCOVERY_MAIN_GEOMETRY_REQUIRED');
  const ring = match[2].split(',').map((token) => token.trim().split(/\s+/).map(Number));
  assert(ring.length >= 5 && ring.every((p) => p.length === 2 && p.every(Number.isFinite)), 'T3R1_S1_DISCOVERY_MAIN_GEOMETRY_INVALID');
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
  const ring = [
    bilinear(points, p.short_axis_fraction_start, p.long_axis_fraction_start),
    bilinear(points, p.short_axis_fraction_end, p.long_axis_fraction_start),
    bilinear(points, p.short_axis_fraction_end, p.long_axis_fraction_end),
    bilinear(points, p.short_axis_fraction_start, p.long_axis_fraction_end),
  ];
  ring.push(ring[0]);
  const feature = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
  assert(geometryValidationCodes(feature).length === 0, 'T3R1_S1_DISCOVERY_DERIVED_GEOMETRY_INVALID');
  const semanticHash = hash(canonicalGeometry(feature));
  assert(semanticHash === p.expected_geometry_semantic_hash, `T3R1_S1_DISCOVERY_GEOMETRY_HASH_MISMATCH:${semanticHash}`);
  return { geometry: feature.geometry, semantic_hash: semanticHash };
}
async function fetchGeometry() {
  const source = CONFIG.provider_sources.plot_geometry_csv;
  const fetched = await getBytes(source.url, source.allowed_host, '/datatables/829.csv', 'T3R1_S1_DISCOVERY_KBS_GEOMETRY');
  const rows = parseTable(fetched.bytes.toString('utf8'), ['treatment', 'replicate', 'subplot', 'geometry']);
  const s = CONFIG.provider_geometry_selector;
  const matches = rows.filter((r) => normalize(r.treatment).toUpperCase() === s.treatment && normalize(r.replicate).toUpperCase() === s.replicate && normalize(r.subplot).toLowerCase() === s.subplot);
  assert(matches.length === s.expected_match_count, `T3R1_S1_DISCOVERY_GEOMETRY_MATCH_COUNT_${matches.length}`);
  return { ...deriveCropOnlyGeometry(orientShortAxis(parseProviderQuadrilateral(matches[0].geometry))), provider_response_sha256: fetched.response_sha256, provider_retrieved_at: fetched.retrieved_at };
}
function parseS1ItemId(id) {
  const parts = String(id || '').replace(/\.SAFE$/i, '').split('_');
  assert(parts.length >= 9, `T3R1_S1_DISCOVERY_SCENE_ID_PARSE_REQUIRED:${String(id || '').slice(0, 96)}`);
  const [mission, mode, product, levelPol, start, end, absoluteOrbit, datatake] = parts;
  assert(/^S1[CD]$/.test(mission), `T3R1_S1_DISCOVERY_MISSION_INVALID:${mission}`);
  assert(mode === CONFIG.s1_policy.required_acquisition_mode, `T3R1_S1_DISCOVERY_MODE_INVALID:${mode}`);
  assert(/^GRD/.test(product), `T3R1_S1_DISCOVERY_PRODUCT_INVALID:${product}`);
  assert(levelPol.endsWith(CONFIG.s1_policy.required_polarization), `T3R1_S1_DISCOVERY_POLARIZATION_INVALID:${levelPol}`);
  assert(/^\d{8}T\d{6}$/.test(start) && /^\d{8}T\d{6}$/.test(end), 'T3R1_S1_DISCOVERY_SENSING_TIME_INVALID');
  assert(/^\d+$/.test(absoluteOrbit) && /^[0-9A-F]+$/i.test(datatake), 'T3R1_S1_DISCOVERY_ORBIT_ID_INVALID');
  return { mission, mode, product, polarization_code: levelPol.slice(-2), sensing_start_compact: start, sensing_end_compact: end, absolute_orbit: absoluteOrbit, datatake_id: datatake, acquisition_key: `${mission}|${mode}|${start}|${absoluteOrbit}|${datatake}` };
}
async function fetchCatalog(geometry) {
  const source = CONFIG.provider_sources.cdse_catalog;
  const w = CONFIG.discovery_window;
  const fetched = await postJson(source.url, ACCESS_TOKEN, {
    intersects: geometry,
    datetime: `${w.start_utc}/${w.end_utc}`,
    collections: [source.collection],
    limit: 100,
    fields: { include: ['id', 'properties.datetime', 'properties.sar:instrument_mode', 'properties.sat:orbit_state', 'properties.s1:polarization', 'properties.s1:resolution'], exclude: ['geometry', 'bbox', 'assets', 'links'] },
  }, 'T3R1_S1_DISCOVERY_CATALOG');
  const features = Array.isArray(fetched.payload.features) ? fetched.payload.features : [];
  assert(features.length > 0 && features.length < 100, `T3R1_S1_DISCOVERY_CATALOG_SCENE_COUNT_${features.length}`);
  const scenes = features.map((f) => {
    const parsed = parseS1ItemId(f.id);
    const sensingMs = Date.parse(String(f?.properties?.datetime || ''));
    assert(Number.isFinite(sensingMs), 'T3R1_S1_DISCOVERY_CATALOG_DATETIME_REQUIRED');
    return {
      scene_id: String(f.id), sensing_time_utc: new Date(sensingMs).toISOString(),
      orbit_state: String(f?.properties?.['sat:orbit_state'] || '').trim().toUpperCase() || null,
      catalog_instrument_mode: String(f?.properties?.['sar:instrument_mode'] || '').trim() || null,
      catalog_polarization: Array.isArray(f?.properties?.['s1:polarization']) ? f.properties['s1:polarization'] : null,
      catalog_resolution: String(f?.properties?.['s1:resolution'] || '').trim() || null,
      ...parsed,
    };
  }).filter((s) => s.mode === CONFIG.s1_policy.required_acquisition_mode && s.polarization_code === CONFIG.s1_policy.required_polarization)
    .sort((a, b) => a.sensing_time_utc.localeCompare(b.sensing_time_utc) || a.scene_id.localeCompare(b.scene_id));
  assert(scenes.length > 0, 'T3R1_S1_DISCOVERY_IW_DV_SCENES_REQUIRED');
  return { ...fetched, scenes };
}
function groupByDay(scenes) {
  const m = new Map();
  for (const scene of scenes) {
    const day = scene.sensing_time_utc.slice(0, 10);
    if (!m.has(day)) m.set(day, []);
    m.get(day).push(scene);
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
}
function nextDay(day) { return new Date(Date.parse(`${day}T00:00:00.000Z`) + 86400000).toISOString().slice(0, 10); }
function statsBandMean(entry, index) { const v = entry?.outputs?.metrics?.bands?.[`B${index}`]?.stats?.mean; return Number.isFinite(Number(v)) ? Number(v) : null; }
function divide(n, d) { return Number.isFinite(n) && Number.isFinite(d) && d > 0 ? n / d : null; }
async function statsForDay(geometry, day, orbitDirection) {
  const fetched = await postJson(CONFIG.provider_sources.cdse_statistics.url, ACCESS_TOKEN, {
    input: {
      bounds: { geometry, properties: { crs: CRS_URI } },
      data: [{
        type: CONFIG.s1_policy.collection,
        dataFilter: {
          acquisitionMode: CONFIG.s1_policy.required_acquisition_mode,
          polarization: CONFIG.s1_policy.required_polarization,
          resolution: CONFIG.s1_policy.required_resolution,
          orbitDirection,
          mosaickingOrder: 'mostRecent'
        },
        processing: { orthorectify: true, backCoeff: CONFIG.s1_policy.backscatter_coefficient }
      }]
    },
    aggregation: {
      timeRange: { from: `${day}T00:00:00.000Z`, to: `${nextDay(day)}T00:00:00.000Z` },
      aggregationInterval: { of: 'P1D' }, evalscript: EVALSCRIPT,
      resx: CONFIG.s1_policy.pixel_spacing_m, resy: CONFIG.s1_policy.pixel_spacing_m
    }
  }, 'T3R1_S1_DISCOVERY_STATISTICS');
  const entry = Array.isArray(fetched.payload.data) ? fetched.payload.data[0] : null;
  if (!entry || entry.status === 'NO_DATA') return { stats_status: 'NO_DATA', response_sha256: fetched.response_sha256, retrieved_at: fetched.retrieved_at, plot_valid_fraction: 0 };
  const valid = statsBandMean(entry, 0);
  const vvWeighted = statsBandMean(entry, 1);
  const vhWeighted = statsBandMean(entry, 2);
  const ratioWeighted = statsBandMean(entry, 3);
  return {
    stats_status: String(entry.status || 'OK'), response_sha256: fetched.response_sha256, retrieved_at: fetched.retrieved_at,
    plot_valid_fraction: valid,
    mean_vv_db_over_valid: divide(vvWeighted, valid),
    mean_vh_db_over_valid: divide(vhWeighted, valid),
    mean_vh_vv_linear_ratio_over_valid: divide(ratioWeighted, valid),
    meets_minimum_spatial_coverage: Number.isFinite(valid) && valid >= CONFIG.s1_policy.minimum_plot_valid_fraction,
  };
}

async function main() {
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'T3R1_S1_DISCOVERY_EXACT_SUBJECT_REQUIRED');
  assert(ACCESS_TOKEN.length > 40, 'T3R1_S1_DISCOVERY_EPHEMERAL_ACCESS_TOKEN_REQUIRED');
  const geometry = await fetchGeometry();
  const catalog = await fetchCatalog(geometry.geometry);
  const acquisitionDays = [];
  for (const [day, scenes] of groupByDay(catalog.scenes)) {
    const keys = [...new Set(scenes.map((s) => s.acquisition_key))];
    const orbitStates = [...new Set(scenes.map((s) => s.orbit_state).filter(Boolean))];
    const ambiguous = keys.length !== 1 || orbitStates.length !== 1;
    let statistics = { stats_status: 'SKIPPED_AMBIGUOUS', plot_valid_fraction: null, meets_minimum_spatial_coverage: false };
    if (!ambiguous) statistics = await statsForDay(geometry.geometry, day, orbitStates[0]);
    acquisitionDays.push({ acquisition_day_utc: day, scene_count: scenes.length, acquisition_keys: keys, orbit_states: orbitStates, acquisition_ambiguous: ambiguous, scenes, statistics });
  }
  const validDays = acquisitionDays.filter((x) => !x.acquisition_ambiguous && x.statistics.meets_minimum_spatial_coverage === true);
  const latest = validDays.length ? validDays.at(-1) : null;
  write({
    schema_version: CONFIG.schema_version,
    status: 'PASS', subject_sha: SUBJECT_SHA, authority_effect: 'NONE_DISCOVERY_ONLY',
    discovery_window: CONFIG.discovery_window,
    represented_scope: CONFIG.represented_scope,
    crop_only_geometry_binding: { status: 'MATCHED_CONSERVATIVE_T3R1_CROP_ONLY_SUBZONE', geometry_semantic_hash: geometry.semantic_hash, provider_response_sha256: geometry.provider_response_sha256, provider_retrieved_at: geometry.provider_retrieved_at, raw_or_derived_coordinates_emitted: false },
    catalog: { collection: CONFIG.s1_policy.collection, response_sha256: catalog.response_sha256, retrieved_at: catalog.retrieved_at, scene_count: catalog.scenes.length, acquisition_day_count: acquisitionDays.length },
    processing_contract: { acquisition_mode: CONFIG.s1_policy.required_acquisition_mode, polarization: CONFIG.s1_policy.required_polarization, resolution: CONFIG.s1_policy.required_resolution, pixel_spacing_m: CONFIG.s1_policy.pixel_spacing_m, orthorectify: true, backscatter_coefficient: CONFIG.s1_policy.backscatter_coefficient },
    acquisition_days: acquisitionDays,
    latest_valid_sar_observation: latest ? { acquisition_day_utc: latest.acquisition_day_utc, acquisition_key: latest.acquisition_keys[0], orbit_state: latest.orbit_states[0], statistics: latest.statistics } : null,
    interpretation: { structural_signal_candidate_only: true, sar_to_crop_presence_mapping_authorized: false, sar_to_lifecycle_mapping_authorized: false, sar_to_phenology_mapping_authorized: false, sar_to_kc_mapping_authorized: false },
    current_management_season_lifecycle_resolved: false,
    bounded_carry_forward_authorized: false,
    runtime_write_count: 0, database_write_count: 0, scheduler_write_count: 0, formal_evidence_write_count: 0,
    ea5e2_operational_activation_qualified: false, formal_window_started: false, formal_execution_count: '0/24',
    next_frontier: latest ? CONFIG.next_frontier_on_recent_valid_sar : 'T3R1_ALTERNATIVE_CURRENT_POSITIVE_SOURCE_REQUIRED'
  });
}

main().catch((error) => {
  write({ schema_version: CONFIG.schema_version, status: 'FAIL', subject_sha: SUBJECT_SHA || null, authority_effect: 'NONE', current_management_season_lifecycle_resolved: false, bounded_carry_forward_authorized: false, runtime_write_count: 0, database_write_count: 0, scheduler_write_count: 0, formal_evidence_write_count: 0, ea5e2_operational_activation_qualified: false, formal_window_started: false, formal_execution_count: '0/24', error: safeError(error) });
  process.exitCode = 1;
});
