#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const {
  hash,
  canonicalGeometry,
  geometryValidationCodes,
  polygonAreaM2,
} = require(path.join(ROOT, 'scripts/governance_acceptance/mcft00/MCFT00_GEOMETRY_AND_HASH.cjs'));

const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-CDSE-20260809-STANDING-CROP-OBSERVATION-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_T3R1_CDSE_20260809_STANDING_CROP_RESULT.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const ACCESS_TOKEN = String(process.env.CDSE_SENTINEL_HUB_ACCESS_TOKEN || '').trim();
const CRS_URI = 'http://www.opengis.net/def/crs/EPSG/0/4326';

const EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "SCL", "dataMask"],
    output: [
      { id: "metrics", bands: 9, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  const valid = s.dataMask === 1;
  const clearLand = valid && [2, 4, 5, 7].includes(s.SCL) ? 1 : 0;
  const vegetation = valid && s.SCL === 4 ? 1 : 0;
  const denominator = s.B08 + s.B04;
  const ndvi = clearLand && denominator > 0 ? (s.B08 - s.B04) / denominator : 0;
  return {
    metrics: [
      clearLand,
      vegetation,
      ndvi * clearLand,
      valid && s.SCL === 3 ? 1 : 0,
      valid && s.SCL === 8 ? 1 : 0,
      valid && s.SCL === 9 ? 1 : 0,
      valid && s.SCL === 10 ? 1 : 0,
      valid && s.SCL === 11 ? 1 : 0,
      valid ? 1 : 0
    ],
    dataMask: [valid ? 1 : 0]
  };
}`;

function assert(condition, code) {
  if (!condition) throw new Error(code);
}
function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}
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
function normalize(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
function normalizeKey(value) {
  return normalize(value).replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function approvedUrl(url, host, pathName, code) {
  const parsed = new URL(url);
  assert(parsed.protocol === 'https:', `${code}_HTTPS_REQUIRED`);
  assert(parsed.hostname === host, `${code}_HOST_FORBIDDEN`);
  if (pathName) assert(parsed.pathname === pathName, `${code}_PATH_FORBIDDEN`);
  return parsed;
}
async function responseBytes(response) {
  return Buffer.from(await response.arrayBuffer());
}
async function getBytes(url, host, pathName, code) {
  approvedUrl(url, host, pathName, code);
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'user-agent': 'GEOX-MCFT-CAP09-T3R1-CDSE/1.0' },
  });
  assert(response.ok, `${code}_HTTP_${response.status}`);
  const finalUrl = approvedUrl(response.url, host, pathName, `${code}_REDIRECT`);
  assert(finalUrl.search === '', `${code}_REDIRECT_QUERY_FORBIDDEN`);
  const bytes = await responseBytes(response);
  return { bytes, retrieved_at: new Date().toISOString(), response_sha256: sha256(bytes) };
}
async function postJson(url, token, body, code) {
  const parsed = approvedUrl(url, CONFIG.provider_sources.cdse_catalog.allowed_host, new URL(url).pathname, code);
  assert(parsed.hostname === 'sh.dataspace.copernicus.eu', `${code}_HOST_MISMATCH`);
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  assert(response.ok, `${code}_HTTP_${response.status}`);
  const bytes = await responseBytes(response);
  return {
    payload: JSON.parse(bytes.toString('utf8')),
    response_sha256: sha256(bytes),
    retrieved_at: new Date().toISOString(),
  };
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
    } else value += char;
  }
  output.push(value);
  return output;
}
function parseTable(text, requiredColumns) {
  const lines = String(text).split(/\r?\n/);
  const delimiters = [',', '\t', ';', '|'];
  for (let index = 0, nonempty = 0; index < lines.length && nonempty < 40; index += 1) {
    if (!lines[index].trim()) continue;
    nonempty += 1;
    for (const delimiter of delimiters) {
      const headers = parseDelimitedLine(lines[index], delimiter).map(normalizeKey);
      if (!requiredColumns.every((column) => headers.includes(column))) continue;
      const rows = [];
      for (const line of lines.slice(index + 1)) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const cells = parseDelimitedLine(line, delimiter);
        if (cells.length < headers.length) continue;
        const row = {};
        headers.forEach((header, cellIndex) => { row[header] = cells[cellIndex] ?? ''; });
        rows.push(row);
      }
      assert(rows.length > 0, 'T3R1_CDSE_GEOMETRY_ROWS_REQUIRED');
      return rows;
    }
  }
  throw new Error('T3R1_CDSE_GEOMETRY_HEADER_REQUIRED');
}
function parseProviderQuadrilateral(raw, requiredSrid) {
  const match = String(raw || '').trim().match(/^SRID=(\d+);POLYGON\(\(([^()]+)\)\)$/i);
  assert(match, 'T3R1_CDSE_MAIN_GEOMETRY_SIMPLE_POLYGON_REQUIRED');
  assert(Number(match[1]) === requiredSrid, 'T3R1_CDSE_MAIN_GEOMETRY_SRID_MISMATCH');
  const ring = match[2].split(',').map((token) => token.trim().split(/\s+/).map(Number));
  assert(ring.length >= 5, 'T3R1_CDSE_MAIN_GEOMETRY_RING_TOO_SHORT');
  assert(ring.every((point) => point.length === 2 && point.every(Number.isFinite)), 'T3R1_CDSE_MAIN_GEOMETRY_NONFINITE');
  assert(ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1], 'T3R1_CDSE_MAIN_GEOMETRY_UNCLOSED');
  return ring.slice(0, -1);
}
function metersPerDegree(latitudeDeg) {
  const latitude = latitudeDeg * Math.PI / 180;
  return { x: 111320 * Math.cos(latitude), y: 110574 };
}
function distanceM(a, b) {
  const scale = metersPerDegree((a[1] + b[1]) / 2);
  return Math.hypot((b[0] - a[0]) * scale.x, (b[1] - a[1]) * scale.y);
}
function orientShortAxis(points) {
  const lengths = points.map((point, index) => distanceM(point, points[(index + 1) % points.length]));
  const pair01 = (lengths[0] + lengths[2]) / 2;
  const pair12 = (lengths[1] + lengths[3]) / 2;
  const rotated = pair01 <= pair12 ? [...points] : [points[1], points[2], points[3], points[0]];
  const rotatedLengths = rotated.map((point, index) => distanceM(point, rotated[(index + 1) % rotated.length]));
  return {
    points: rotated,
    short_edges_m: [rotatedLengths[0], rotatedLengths[2]],
    long_edges_m: [rotatedLengths[1], rotatedLengths[3]],
  };
}
function lerpPoint(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function bilinearPoint(points, u, v) {
  return lerpPoint(lerpPoint(points[0], points[1], u), lerpPoint(points[3], points[2], u), v);
}
function deriveCropOnlyGeometry(points) {
  const policy = CONFIG.conservative_crop_only_subzone_policy;
  const ring = [
    bilinearPoint(points, policy.short_axis_fraction_start, policy.long_axis_fraction_start),
    bilinearPoint(points, policy.short_axis_fraction_end, policy.long_axis_fraction_start),
    bilinearPoint(points, policy.short_axis_fraction_end, policy.long_axis_fraction_end),
    bilinearPoint(points, policy.short_axis_fraction_start, policy.long_axis_fraction_end),
  ];
  ring.push(ring[0]);
  const feature = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
  const validation = geometryValidationCodes(feature);
  assert(validation.length === 0, `T3R1_CDSE_DERIVED_GEOMETRY_INVALID:${validation.join(',')}`);
  const canonical = canonicalGeometry(feature);
  const semanticHash = hash(canonical);
  assert(semanticHash === policy.expected_geometry_semantic_hash, `T3R1_CDSE_DERIVED_GEOMETRY_HASH_MISMATCH:${semanticHash}`);
  return { feature, semanticHash, areaM2: polygonAreaM2(canonical) };
}
function ratio(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}
function statsBandMean(entry, index) {
  const value = entry?.outputs?.metrics?.bands?.[`B${index}`]?.stats?.mean;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

async function fetchCropOnlyGeometry() {
  const source = CONFIG.provider_sources.plot_geometry_csv;
  const fetched = await getBytes(source.url, source.allowed_host, '/datatables/829.csv', 'T3R1_CDSE_KBS_GEOMETRY');
  const text = fetched.bytes.toString('utf8');
  assert(!/^\s*<!doctype html|^\s*<html/i.test(text), 'T3R1_CDSE_GEOMETRY_CSV_HTML_FORBIDDEN');
  const rows = parseTable(text, ['treatment', 'replicate', 'subplot', 'geometry']);
  const selector = CONFIG.provider_geometry_selector;
  const matches = rows.filter((row) => normalize(row.treatment).toUpperCase() === selector.treatment
    && normalize(row.replicate).toUpperCase() === selector.replicate
    && normalize(row.subplot).toLowerCase() === selector.subplot);
  assert(matches.length === selector.expected_match_count, `T3R1_CDSE_GEOMETRY_MATCH_COUNT_${matches.length}`);
  const providerRaw = String(matches[0].geometry || '');
  const points = parseProviderQuadrilateral(providerRaw, selector.required_srid);
  assert(points.length === selector.required_distinct_vertex_count, 'T3R1_CDSE_GEOMETRY_VERTEX_COUNT_INVALID');
  const oriented = orientShortAxis(points);
  const shortMin = Math.min(...oriented.short_edges_m);
  const shortMax = Math.max(...oriented.short_edges_m);
  const longMin = Math.min(...oriented.long_edges_m);
  const policy = CONFIG.conservative_crop_only_subzone_policy;
  const outerMargin = policy.short_axis_fraction_start * shortMin;
  const stripNearEdge = (shortMin - 4.572) / 2;
  const stripClearance = stripNearEdge - policy.short_axis_fraction_end * shortMax;
  const endMargin = Math.min(policy.long_axis_fraction_start, 1 - policy.long_axis_fraction_end) * longMin;
  assert(outerMargin >= policy.minimum_outer_boundary_margin_m, 'T3R1_CDSE_OUTER_MARGIN_INSUFFICIENT');
  assert(stripClearance >= policy.minimum_center_prairie_strip_clearance_m, 'T3R1_CDSE_STRIP_CLEARANCE_INSUFFICIENT');
  assert(endMargin >= policy.minimum_end_boundary_margin_m, 'T3R1_CDSE_END_MARGIN_INSUFFICIENT');
  const derived = deriveCropOnlyGeometry(oriented.points);
  return {
    geometry: derived.feature.geometry,
    semantic_hash: derived.semanticHash,
    area_m2: derived.areaM2,
    provider_response_sha256: fetched.response_sha256,
    provider_retrieved_at: fetched.retrieved_at,
    provider_raw_geometry_sha256: sha256(providerRaw),
    minimum_outer_boundary_margin_m: Number(outerMargin.toFixed(3)),
    minimum_center_prairie_strip_clearance_m: Number(stripClearance.toFixed(3)),
    minimum_end_boundary_margin_m: Number(endMargin.toFixed(3)),
  };
}

async function verifyPlantingIdentity() {
  const source = CONFIG.provider_sources.planting_identity;
  const fetched = await getBytes(source.url, source.allowed_host, '/materials/392', 'T3R1_CDSE_PLANTING_IDENTITY');
  const text = normalize(fetched.bytes.toString('utf8')).toLowerCase();
  for (const marker of source.required_markers) {
    assert(text.includes(normalize(marker).toLowerCase()), `T3R1_CDSE_PLANTING_MARKER_MISSING:${marker}`);
  }
  return { response_sha256: fetched.response_sha256, retrieved_at: fetched.retrieved_at };
}

async function fetchCatalogScenes(geometry) {
  const source = CONFIG.provider_sources.cdse_catalog;
  const target = CONFIG.target_acquisition;
  const fetched = await postJson(source.url, ACCESS_TOKEN, {
    intersects: geometry,
    datetime: `${target.window_start_utc}/${target.window_end_utc}`,
    collections: [source.collection],
    limit: 100,
    fields: {
      include: ['id', 'properties.datetime', 'properties.eo:cloud_cover', 'properties.platform', 'properties.constellation'],
      exclude: ['geometry', 'bbox', 'assets', 'links'],
    },
  }, 'T3R1_CDSE_CATALOG');
  const features = Array.isArray(fetched.payload.features) ? fetched.payload.features : [];
  assert(features.length > 0, 'T3R1_CDSE_TARGET_DAY_SCENE_REQUIRED');
  assert(features.length < 100, 'T3R1_CDSE_CATALOG_PAGINATION_NOT_IMPLEMENTED');
  const scenes = features.map((feature) => {
    const id = String(feature?.id || '').trim();
    const sensingMs = Date.parse(String(feature?.properties?.datetime || ''));
    assert(id && Number.isFinite(sensingMs), 'T3R1_CDSE_SCENE_ID_AND_TIME_REQUIRED');
    return {
      scene_id: id,
      sensing_time_utc: new Date(sensingMs).toISOString(),
      scene_cloud_cover_percent: Number.isFinite(Number(feature?.properties?.['eo:cloud_cover']))
        ? Number(feature.properties['eo:cloud_cover']) : null,
      platform: String(feature?.properties?.platform || '').trim() || null,
      constellation: String(feature?.properties?.constellation || '').trim() || null,
    };
  }).sort((a, b) => a.sensing_time_utc.localeCompare(b.sensing_time_utc) || a.scene_id.localeCompare(b.scene_id));

  const times = scenes.map((scene) => Date.parse(scene.sensing_time_utc));
  const spreadSeconds = (Math.max(...times) - Math.min(...times)) / 1000;
  const platforms = [...new Set(scenes.map((scene) => scene.platform).filter(Boolean))];
  assert(spreadSeconds <= CONFIG.scene_binding_policy.maximum_sensing_time_spread_seconds,
    `T3R1_CDSE_SCENE_ACQUISITION_SPREAD_${spreadSeconds}`);
  assert(platforms.length === 1, `T3R1_CDSE_SCENE_PLATFORM_CARDINALITY_${platforms.length}`);
  return { ...fetched, scenes, spreadSeconds, platform: platforms[0] };
}

async function fetchPlotStatistics(geometry) {
  const source = CONFIG.provider_sources.cdse_statistics;
  const target = CONFIG.target_acquisition;
  const fetched = await postJson(source.url, ACCESS_TOKEN, {
    input: {
      bounds: { geometry, properties: { crs: CRS_URI } },
      data: [{
        type: CONFIG.provider_sources.cdse_catalog.collection,
        dataFilter: { mosaickingOrder: CONFIG.scene_binding_policy.daily_statistics_mosaicking_order },
        processing: { upsampling: 'NEAREST', downsampling: 'NEAREST' },
      }],
    },
    aggregation: {
      timeRange: { from: target.window_start_utc, to: target.window_end_utc },
      aggregationInterval: { of: 'P1D' },
      evalscript: EVALSCRIPT,
      resx: CONFIG.observation_rule.pixel_resolution_m,
      resy: CONFIG.observation_rule.pixel_resolution_m,
    },
  }, 'T3R1_CDSE_STATISTICS');
  const entry = Array.isArray(fetched.payload.data) ? fetched.payload.data[0] : null;
  assert(entry && entry.status !== 'NO_DATA', 'T3R1_CDSE_TARGET_DAY_STATISTICS_REQUIRED');
  const clearLand = statsBandMean(entry, 0);
  const vegetation = statsBandMean(entry, 1);
  const ndviWeighted = statsBandMean(entry, 2);
  const validFraction = statsBandMean(entry, 8);
  const vegetatedFractionOfClearLand = ratio(vegetation, clearLand);
  const meanNdviOverClearLand = ratio(ndviWeighted, clearLand);
  assert(Number.isFinite(clearLand), 'T3R1_CDSE_CLEAR_LAND_FRACTION_REQUIRED');
  assert(Number.isFinite(vegetatedFractionOfClearLand), 'T3R1_CDSE_VEGETATION_FRACTION_REQUIRED');
  assert(Number.isFinite(meanNdviOverClearLand), 'T3R1_CDSE_NDVI_REQUIRED');
  assert(clearLand >= CONFIG.observation_rule.minimum_plot_clear_land_fraction,
    `T3R1_CDSE_PLOT_CLEAR_LAND_BELOW_THRESHOLD:${clearLand}`);
  assert(vegetatedFractionOfClearLand >= CONFIG.observation_rule.minimum_vegetated_fraction_of_clear_land,
    `T3R1_CDSE_VEGETATION_BELOW_THRESHOLD:${vegetatedFractionOfClearLand}`);
  assert(meanNdviOverClearLand >= CONFIG.observation_rule.minimum_mean_ndvi_over_clear_land,
    `T3R1_CDSE_NDVI_BELOW_THRESHOLD:${meanNdviOverClearLand}`);
  return {
    response_sha256: fetched.response_sha256,
    retrieved_at: fetched.retrieved_at,
    stats_status: String(entry.status || 'OK'),
    plot_valid_fraction: validFraction,
    plot_clear_land_fraction: clearLand,
    plot_vegetated_fraction_of_all_valid: vegetation,
    plot_vegetated_fraction_of_clear_land: vegetatedFractionOfClearLand,
    plot_mean_ndvi_over_clear_land: meanNdviOverClearLand,
    scl_fraction_of_all_valid: {
      cloud_shadow: statsBandMean(entry, 3),
      cloud_medium_probability: statsBandMean(entry, 4),
      cloud_high_probability: statsBandMean(entry, 5),
      thin_cirrus: statsBandMean(entry, 6),
      snow_or_ice: statsBandMean(entry, 7),
    },
  };
}

async function main() {
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'T3R1_CDSE_EXACT_SUBJECT_REQUIRED');
  assert(CONFIG.exact_base_protected_main === '23f224c701dbe0b8bd56eceff3741cb1c3dc1f78', 'T3R1_CDSE_BASE_MISMATCH');
  assert(CONFIG.resolution_policy.current_management_season_lifecycle_authorized_by_this_probe === false,
    'T3R1_CDSE_PREMATURE_LIFECYCLE_AUTHORITY_FORBIDDEN');
  assert(CONFIG.resolution_policy.bounded_carry_forward_authorized_by_this_probe === false,
    'T3R1_CDSE_PREMATURE_CARRY_FORWARD_FORBIDDEN');
  assert(ACCESS_TOKEN.length > 40, 'T3R1_CDSE_EPHEMERAL_ACCESS_TOKEN_REQUIRED');

  const geometry = await fetchCropOnlyGeometry();
  const planting = await verifyPlantingIdentity();
  const catalog = await fetchCatalogScenes(geometry.geometry);
  const statistics = await fetchPlotStatistics(geometry.geometry);

  write({
    schema_version: 'geox_mcft_cap09_t3r1_cdse_20260809_standing_crop_result_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    authority_time_utc: new Date().toISOString(),
    frontier: CONFIG.frontier,
    represented_scope: {
      site_id: CONFIG.candidate_scope.site_id,
      treatment: CONFIG.candidate_scope.treatment,
      replicate: CONFIG.candidate_scope.replicate,
      crop: CONFIG.candidate_scope.crop,
      hybrid: CONFIG.candidate_scope.hybrid,
      planting_date: CONFIG.candidate_scope.planting_date,
    },
    crop_only_geometry_binding: {
      status: 'MATCHED_CONSERVATIVE_T3R1_CROP_ONLY_SUBZONE',
      geometry_semantic_hash: geometry.semantic_hash,
      derived_area_m2: geometry.area_m2,
      minimum_outer_boundary_margin_m: geometry.minimum_outer_boundary_margin_m,
      minimum_center_prairie_strip_clearance_m: geometry.minimum_center_prairie_strip_clearance_m,
      minimum_end_boundary_margin_m: geometry.minimum_end_boundary_margin_m,
      provider_response_sha256: geometry.provider_response_sha256,
      provider_retrieved_at: geometry.provider_retrieved_at,
      provider_raw_geometry_sha256: geometry.provider_raw_geometry_sha256,
      raw_or_derived_coordinates_emitted: false,
    },
    planting_identity_binding: {
      status: 'MATCHED_2026_T3_P0306Q_PLANTING_INCLUDING_R1',
      provider_response_sha256: planting.response_sha256,
      provider_retrieved_at: planting.retrieved_at,
    },
    cdse_catalog: {
      collection: CONFIG.provider_sources.cdse_catalog.collection,
      target_day_utc: CONFIG.target_acquisition.day_utc,
      response_sha256: catalog.response_sha256,
      retrieved_at: catalog.retrieved_at,
      scene_count: catalog.scenes.length,
      acquisition_event_sensing_time_utc: catalog.scenes[0].sensing_time_utc,
      acquisition_sensing_time_spread_seconds: catalog.spreadSeconds,
      platform: catalog.platform,
      scenes: catalog.scenes,
    },
    plot_observation: statistics,
    adjudication: {
      direct_standing_crop_observation_candidate_status: CONFIG.resolution_policy.pass_status,
      direct_standing_crop_observation_candidate_resolved: true,
      catalog_only_claim_used: false,
      scene_cloud_cover_used_as_plot_clear_fraction: false,
      ndvi_to_phenology_mapping_authorized: false,
      satellite_to_kc_mapping_authorized: false,
      current_management_season_lifecycle_resolved: false,
      bounded_carry_forward_authorized: false,
    },
    chronology: {
      sensing_time_is_observation_time: true,
      retrieval_time_is_availability_time: true,
      sensing_time_rewritten_as_retrieval_time: false,
      future_observation_consumed_for_earlier_as_of: false,
    },
    authority_effect: 'DIRECT_STANDING_CROP_OBSERVATION_CANDIDATE_ONLY',
    next_frontier: CONFIG.next_frontier_on_pass,
    runtime_write_count: 0,
    database_write_count: 0,
    scheduler_write_count: 0,
    formal_evidence_write_count: 0,
    ea5e2_operational_activation_qualified: false,
    formal_window_started: false,
    formal_execution_count: '0/24',
  });
}

main().catch((error) => {
  write({
    schema_version: 'geox_mcft_cap09_t3r1_cdse_20260809_standing_crop_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA || null,
    authority_effect: 'NONE',
    direct_standing_crop_observation_candidate_resolved: false,
    current_management_season_lifecycle_resolved: false,
    bounded_carry_forward_authorized: false,
    runtime_write_count: 0,
    database_write_count: 0,
    scheduler_write_count: 0,
    formal_evidence_write_count: 0,
    ea5e2_operational_activation_qualified: false,
    formal_window_started: false,
    formal_execution_count: '0/24',
    error: safeError(error),
  });
  process.exitCode = 1;
});
