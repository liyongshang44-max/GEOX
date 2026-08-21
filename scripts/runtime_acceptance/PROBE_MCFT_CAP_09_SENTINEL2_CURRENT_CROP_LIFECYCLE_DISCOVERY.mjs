#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_SENTINEL2_CURRENT_CROP_LIFECYCLE_DISCOVERY.json');
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const ACCESS_TOKEN = String(process.env.CDSE_SENTINEL_HUB_ACCESS_TOKEN || '').trim();
const DISCOVERY_START_UTC = '2026-07-01T00:00:00.000Z';
const DISCOVERY_END_UTC = String(process.env.MCFT_SENTINEL2_DISCOVERY_END_UTC || '').trim() || new Date().toISOString();

const KBS_GEOMETRY_URL = 'https://lter.kbs.msu.edu/datatables/829.csv';
const KBS_GEOMETRY_HOST = 'lter.kbs.msu.edu';
const KBS_GEOMETRY_PATH = '/datatables/829.csv';
const SH_CATALOG_URL = 'https://sh.dataspace.copernicus.eu/catalog/v1/search';
const SH_STATISTICS_URL = 'https://sh.dataspace.copernicus.eu/statistics/v1';
const SH_HOST = 'sh.dataspace.copernicus.eu';
const COLLECTION = 'sentinel-2-l2a';
const GEOMETRY_SOURCE_ID = 'KBS039-006.40';
const EXPECTED_T1R1_MAIN_GEOMETRY_SEMANTIC_SHA256 = 'sha256:c50671e0bad6dcfe13796d93f35cd4c7939c22c1635c09dd8c9182b0e29ff1ae';
const FORMAL_SITE_ID = 'KBS_MCSE_T1R1';
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
  const sourceValid = s.dataMask === 1;
  const clearAny = sourceValid && [2, 4, 5, 6, 7].includes(s.SCL) ? 1 : 0;
  const clearLand = sourceValid && [2, 4, 5, 7].includes(s.SCL) ? 1 : 0;
  const vegetation = sourceValid && s.SCL === 4 ? 1 : 0;
  const denominator = s.B08 + s.B04;
  const ndvi = clearLand && denominator > 0 ? (s.B08 - s.B04) / denominator : 0;
  return {
    metrics: [
      clearAny,
      clearLand,
      vegetation,
      ndvi * clearLand,
      sourceValid && s.SCL === 3 ? 1 : 0,
      sourceValid && s.SCL === 8 ? 1 : 0,
      sourceValid && s.SCL === 9 ? 1 : 0,
      sourceValid && s.SCL === 10 ? 1 : 0,
      sourceValid && s.SCL === 11 ? 1 : 0
    ],
    dataMask: [sourceValid ? 1 : 0]
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
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [REDACTED]');
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(value));
}
function canonicalIso(value, code) {
  const parsed = Date.parse(value);
  assert(Number.isFinite(parsed), code);
  return new Date(parsed).toISOString();
}
function approvedUrl(url, host, pathname, code) {
  const parsed = new URL(url);
  assert(parsed.protocol === 'https:', `${code}_HTTPS_REQUIRED`);
  assert(parsed.hostname === host, `${code}_HOST_FORBIDDEN`);
  if (pathname) assert(parsed.pathname === pathname, `${code}_PATH_FORBIDDEN`);
  return parsed;
}
async function responseBytes(response) {
  return Buffer.from(await response.arrayBuffer());
}
async function fetchRestrictedKbsGeometry() {
  approvedUrl(KBS_GEOMETRY_URL, KBS_GEOMETRY_HOST, KBS_GEOMETRY_PATH, 'SENTINEL2_KBS_GEOMETRY_SOURCE');
  const response = await fetch(KBS_GEOMETRY_URL, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'user-agent': 'GEOX-MCFT-CAP09-Sentinel2-Discovery/1.0' }
  });
  assert(response.ok, `SENTINEL2_KBS_GEOMETRY_HTTP_${response.status}`);
  approvedUrl(response.url, KBS_GEOMETRY_HOST, KBS_GEOMETRY_PATH, 'SENTINEL2_KBS_GEOMETRY_REDIRECT');
  const bytes = await responseBytes(response);
  const geometry = extractT1R1MainGeometry(bytes.toString('utf8'));
  return {
    ewkt: geometry,
    response_sha256: sha256(bytes),
    geometry_source_text_sha256: sha256(geometry),
    retrieved_at: new Date().toISOString()
  };
}
function parseCsvLine(line) {
  const out = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}
function extractT1R1MainGeometry(csvText) {
  const lines = String(csvText).split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() === 'treatment,replicate,subplot,geometry');
  assert(headerIndex >= 0, 'SENTINEL2_KBS_GEOMETRY_HEADER_REQUIRED');
  const matches = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const columns = parseCsvLine(line);
    if (columns.length < 4) continue;
    const [treatment, replicate, subplot, geometry] = columns;
    if (treatment === 'T1' && replicate === 'R1' && subplot === 'main' && geometry) matches.push(geometry.trim());
  }
  assert(matches.length === 1, `SENTINEL2_T1R1_MAIN_GEOMETRY_CARDINALITY_${matches.length}`);
  assert(/^SRID=4326;POLYGON\(\(.+\)\)$/.test(matches[0]), 'SENTINEL2_T1R1_MAIN_EWKT_REQUIRED');
  return matches[0];
}
function ewktToGeoJson(ewkt) {
  const match = ewkt.match(/^SRID=4326;POLYGON\(\((.+)\)\)$/);
  assert(match, 'SENTINEL2_T1R1_EWKT_PARSE_FAILED');
  const ring = match[1].split(',').map((pair) => {
    const parts = pair.trim().split(/\s+/).map(Number);
    assert(parts.length === 2 && parts.every(Number.isFinite), 'SENTINEL2_T1R1_COORDINATE_INVALID');
    const [lon, lat] = parts;
    assert(lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90, 'SENTINEL2_T1R1_COORDINATE_RANGE_INVALID');
    return [lon, lat];
  });
  assert(ring.length >= 4, 'SENTINEL2_T1R1_POLYGON_VERTEX_COUNT_INVALID');
  assert(ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1], 'SENTINEL2_T1R1_POLYGON_NOT_CLOSED');
  return { type: 'Polygon', coordinates: [ring] };
}
async function postJson(url, token, body, code) {
  const parsed = new URL(url);
  approvedUrl(url, SH_HOST, parsed.pathname, code);
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify(body)
  });
  assert(response.ok, `${code}_HTTP_${response.status}`);
  const bytes = await responseBytes(response);
  return {
    payload: JSON.parse(bytes.toString('utf8')),
    response_sha256: sha256(bytes),
    retrieved_at: new Date().toISOString()
  };
}
async function catalogScenes(token, geometry, endUtc) {
  const fetched = await postJson(SH_CATALOG_URL, token, {
    intersects: geometry,
    datetime: `${DISCOVERY_START_UTC}/${endUtc}`,
    collections: [COLLECTION],
    limit: 100,
    fields: {
      include: ['id', 'properties.datetime', 'properties.eo:cloud_cover', 'properties.platform', 'properties.constellation'],
      exclude: ['geometry', 'bbox', 'assets', 'links']
    }
  }, 'SENTINEL2_CATALOG');
  const features = Array.isArray(fetched.payload.features) ? fetched.payload.features : [];
  assert(features.length > 0, 'SENTINEL2_CATALOG_SCENES_REQUIRED');
  assert(features.length < 100, 'SENTINEL2_CATALOG_PAGINATION_NOT_IMPLEMENTED');
  const scenes = features.map((feature) => {
    const id = String(feature?.id || '').trim();
    const rawSensingTime = String(feature?.properties?.datetime || '').trim();
    assert(id, 'SENTINEL2_CATALOG_SCENE_ID_REQUIRED');
    const sensingTime = canonicalIso(rawSensingTime, 'SENTINEL2_CATALOG_SENSING_TIME_INVALID');
    const cloud = Number(feature?.properties?.['eo:cloud_cover']);
    return {
      scene_id: id,
      sensing_time_utc: sensingTime,
      scene_cloud_cover_percent: Number.isFinite(cloud) ? cloud : null,
      platform: String(feature?.properties?.platform || '').trim() || null,
      constellation: String(feature?.properties?.constellation || '').trim() || null
    };
  }).sort((a, b) => a.sensing_time_utc.localeCompare(b.sensing_time_utc) || a.scene_id.localeCompare(b.scene_id));
  return { ...fetched, scenes };
}
function nextUtcDay(day) {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10);
}
function statsBandMean(entry, index) {
  const value = entry?.outputs?.metrics?.bands?.[`B${index}`]?.stats?.mean;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}
function ratio(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}
async function plotStatisticsForDay(token, geometry, day) {
  const fetched = await postJson(SH_STATISTICS_URL, token, {
    input: {
      bounds: { geometry, properties: { crs: CRS_URI } },
      data: [{
        type: COLLECTION,
        dataFilter: { mosaickingOrder: 'leastCC' },
        processing: { upsampling: 'NEAREST', downsampling: 'NEAREST' }
      }]
    },
    aggregation: {
      timeRange: { from: `${day}T00:00:00.000Z`, to: `${nextUtcDay(day)}T00:00:00.000Z` },
      aggregationInterval: { of: 'P1D' },
      evalscript: EVALSCRIPT,
      resx: 10,
      resy: 10
    }
  }, 'SENTINEL2_STATISTICS');
  const entry = Array.isArray(fetched.payload.data) ? fetched.payload.data[0] : null;
  if (!entry || entry.status === 'NO_DATA') {
    return { stats_status: 'NO_DATA', statistics_response_sha256: fetched.response_sha256, statistics_retrieved_at: fetched.retrieved_at };
  }
  const clearAny = statsBandMean(entry, 0);
  const clearLand = statsBandMean(entry, 1);
  const vegetation = statsBandMean(entry, 2);
  const ndviWeighted = statsBandMean(entry, 3);
  return {
    stats_status: String(entry.status || 'OK'),
    plot_clear_fraction: clearAny,
    plot_clear_land_fraction: clearLand,
    plot_vegetated_fraction_of_all_valid: vegetation,
    plot_vegetated_fraction_of_clear_land: ratio(vegetation, clearLand),
    plot_mean_ndvi_over_clear_land: ratio(ndviWeighted, clearLand),
    scl_fraction_of_all_valid: {
      cloud_shadow: statsBandMean(entry, 4),
      cloud_medium_probability: statsBandMean(entry, 5),
      cloud_high_probability: statsBandMean(entry, 6),
      thin_cirrus: statsBandMean(entry, 7),
      snow_or_ice: statsBandMean(entry, 8)
    },
    statistics_response_sha256: fetched.response_sha256,
    statistics_retrieved_at: fetched.retrieved_at
  };
}
function groupScenesByUtcDay(scenes) {
  const groups = new Map();
  for (const scene of scenes) {
    const day = scene.sensing_time_utc.slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(scene);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

async function main() {
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'SENTINEL2_DISCOVERY_EXACT_SUBJECT_REQUIRED');
  const endUtc = canonicalIso(DISCOVERY_END_UTC, 'SENTINEL2_DISCOVERY_END_INVALID');
  assert(Date.parse(endUtc) > Date.parse(DISCOVERY_START_UTC), 'SENTINEL2_DISCOVERY_WINDOW_INVALID');
  assert(Date.parse(endUtc) <= Date.now() + 300_000, 'SENTINEL2_DISCOVERY_FUTURE_END_FORBIDDEN');

  const kbs = await fetchRestrictedKbsGeometry();
  const geometry = ewktToGeoJson(kbs.ewkt);
  const geometrySemanticSha256 = sha256(JSON.stringify(geometry));
  assert(geometrySemanticSha256 === EXPECTED_T1R1_MAIN_GEOMETRY_SEMANTIC_SHA256, 'SENTINEL2_T1R1_GEOMETRY_SEMANTIC_DIGEST_MISMATCH');
  assert(ACCESS_TOKEN.length > 40, 'SENTINEL2_EPHEMERAL_ACCESS_TOKEN_REQUIRED');
  const catalog = await catalogScenes(ACCESS_TOKEN, geometry, endUtc);
  const acquisitionGroups = [];
  for (const [day, scenes] of groupScenesByUtcDay(catalog.scenes)) {
    const statistics = await plotStatisticsForDay(ACCESS_TOKEN, geometry, day);
    acquisitionGroups.push({ acquisition_day_utc: day, scene_binding_ambiguity: scenes.length !== 1, scenes, ...statistics });
  }

  const clearEnoughForInspection = acquisitionGroups.filter((group) =>
    group.stats_status !== 'NO_DATA' && Number.isFinite(group.plot_clear_land_fraction) && group.plot_clear_land_fraction >= 0.5
  );

  write({
    schema_version: 'geox_mcft_cap09_sentinel2_current_crop_lifecycle_discovery_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    discovery_frontier: 'CURRENT_CROP_ALTERNATIVE_SOURCE_AUTHORITY_DESIGN_REVIEW',
    source_class: 'COPERNICUS_SENTINEL_2_L2A_REMOTE_SENSING_DISCOVERY',
    represented_formal_site_id: FORMAL_SITE_ID,
    discovery_window: { from_utc: DISCOVERY_START_UTC, to_utc: endUtc },
    restricted_kbs_geometry_binding: {
      source_id: GEOMETRY_SOURCE_ID,
      source_response_sha256: kbs.response_sha256,
      source_retrieved_at: kbs.retrieved_at,
      geometry_source_text_sha256: kbs.geometry_source_text_sha256,
      geometry_semantic_sha256: geometrySemanticSha256,
      expected_geometry_semantic_sha256: EXPECTED_T1R1_MAIN_GEOMETRY_SEMANTIC_SHA256,
      geometry_digest_match: true,
      geometry_crs: 'EPSG:4326',
      polygon_vertex_count: geometry.coordinates[0].length,
      treatment: 'T1',
      replicate: 'R1',
      subplot: 'main',
      raw_geometry_emitted: false,
      geometry_coordinates_emitted: false
    },
    copernicus_auth: {
      credential_mode: 'EPHEMERAL_BEARER_TOKEN_INJECTED',
      long_lived_client_credentials_consumed_by_probe: false,
      access_token_emitted: false
    },
    catalog: {
      collection: COLLECTION,
      response_sha256: catalog.response_sha256,
      retrieved_at: catalog.retrieved_at,
      scene_count: catalog.scenes.length,
      acquisition_day_count: acquisitionGroups.length
    },
    acquisition_groups: acquisitionGroups,
    descriptive_screen: {
      clear_land_fraction_inspection_threshold: 0.5,
      clear_enough_acquisition_day_count: clearEnoughForInspection.length,
      clear_enough_acquisition_days_utc: clearEnoughForInspection.map((group) => group.acquisition_day_utc),
      threshold_is_authority_mapping: false
    },
    chronology: {
      sensing_time_is_observation_time: true,
      retrieval_time_is_availability_time: true,
      sensing_time_rewritten_as_retrieval_time: false,
      future_observation_consumed_for_earlier_as_of: false
    },
    interpretation: {
      lifecycle_state_adjudicated: false,
      biological_phenology_adjudicated: false,
      water_use_stage_adjudicated: false,
      kc_adjudicated: false,
      ndvi_to_stage_mapping_authorized: false,
      satellite_to_kc_mapping_authorized: false,
      current_season_lifecycle_authority_established: false,
      current_phenology_authority_established: false,
      current_crop_model_parameter_authority_established: false
    },
    authority_effect: 'NONE',
    runtime_write_count: 0,
    database_write_count: 0,
    scheduler_write_count: 0,
    formal_evidence_write_count: 0,
    ea5e2_operational_activation_qualified: false,
    formal_execution_count: '0/24',
    next_required_review: 'SATELLITE_SOURCE_SPATIAL_TIME_CROP_AND_MAPPING_ADJUDICATION'
  });
}

main().catch((error) => {
  write({
    schema_version: 'geox_mcft_cap09_sentinel2_current_crop_lifecycle_discovery_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA || null,
    authority_effect: 'NONE',
    runtime_write_count: 0,
    database_write_count: 0,
    scheduler_write_count: 0,
    formal_evidence_write_count: 0,
    ea5e2_operational_activation_qualified: false,
    formal_execution_count: '0/24',
    error: safeError(error)
  });
  process.exitCode = 1;
});
