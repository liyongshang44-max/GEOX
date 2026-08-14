#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const {
  hash,
  canonicalGeometry,
  geometryValidationCodes,
  polygonAreaM2,
} = require(path.join(ROOT, 'scripts/governance_acceptance/mcft00/MCFT00_GEOMETRY_AND_HASH.cjs'));

const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-CROP-ONLY-GEOMETRY-AUTHORITY-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_T3R1_CROP_ONLY_GEOMETRY_RESULT.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();

function assert(condition, code) {
  if (!condition) throw new Error(code);
}
function sha256(bytes) {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}
function safeError(error) {
  return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]');
}
function normalize(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
function normalizeKey(value) {
  return normalize(value).replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function write(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(value));
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
  let headers = null;
  let delimiter = null;
  let headerIndex = -1;
  for (let index = 0, nonempty = 0; index < lines.length && nonempty < 40; index += 1) {
    if (!lines[index].trim()) continue;
    nonempty += 1;
    for (const candidate of delimiters) {
      const cells = parseDelimitedLine(lines[index], candidate).map(normalizeKey);
      if (requiredColumns.every((column) => cells.includes(column))) {
        headers = cells;
        delimiter = candidate;
        headerIndex = index;
        break;
      }
    }
    if (headers) break;
  }
  assert(headers && delimiter, 'T3R1_GEOMETRY_REQUIRED_CSV_HEADER_NOT_FOUND');
  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) continue;
    const cells = parseDelimitedLine(line, delimiter);
    if (cells.length < headers.length) continue;
    const row = {};
    headers.forEach((header, index) => { row[header] = cells[index] ?? ''; });
    rows.push(row);
  }
  assert(rows.length > 0, 'T3R1_GEOMETRY_CSV_ROWS_REQUIRED');
  return rows;
}
function parseProviderQuadrilateral(raw, requiredSrid) {
  const value = String(raw || '').trim();
  const match = value.match(/^SRID=(\d+);POLYGON\(\(([^()]+)\)\)$/i);
  assert(match, 'T3R1_MAIN_PROVIDER_GEOMETRY_SIMPLE_POLYGON_REQUIRED');
  assert(Number(match[1]) === requiredSrid, 'T3R1_MAIN_PROVIDER_GEOMETRY_SRID_MISMATCH');
  const ring = match[2].split(',').map((token) => token.trim().split(/\s+/).map(Number));
  assert(ring.length >= 5, 'T3R1_MAIN_PROVIDER_GEOMETRY_RING_TOO_SHORT');
  assert(ring.every((point) => point.length === 2 && point.every(Number.isFinite)), 'T3R1_MAIN_PROVIDER_GEOMETRY_NONFINITE');
  assert(ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1], 'T3R1_MAIN_PROVIDER_GEOMETRY_UNCLOSED');
  const points = ring.slice(0, -1);
  assert(points.length === CONFIG.provider_geometry_selector.required_distinct_vertex_count, 'T3R1_MAIN_PROVIDER_GEOMETRY_NOT_QUADRILATERAL');
  return points;
}
function metersPerDegree(latitudeDeg) {
  const latitude = latitudeDeg * Math.PI / 180;
  return {
    x: 111320 * Math.cos(latitude),
    y: 110574,
  };
}
function localize(points) {
  const meanLat = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  const meanLon = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const scale = metersPerDegree(meanLat);
  return points.map(([lon, lat]) => [(lon - meanLon) * scale.x, (lat - meanLat) * scale.y]);
}
function distanceM(a, b) {
  const meanLat = (a[1] + b[1]) / 2;
  const scale = metersPerDegree(meanLat);
  return Math.hypot((b[0] - a[0]) * scale.x, (b[1] - a[1]) * scale.y);
}
function isConvex(points) {
  const local = localize(points);
  const signs = [];
  for (let index = 0; index < local.length; index += 1) {
    const a = local[index];
    const b = local[(index + 1) % local.length];
    const c = local[(index + 2) % local.length];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    assert(Math.abs(cross) > 1e-6, 'T3R1_MAIN_PROVIDER_GEOMETRY_COLLINEAR_VERTEX');
    signs.push(Math.sign(cross));
  }
  return signs.every((sign) => sign === signs[0]);
}
function orientShortAxis(points) {
  const edge = points.map((point, index) => distanceM(point, points[(index + 1) % points.length]));
  const pair01 = (edge[0] + edge[2]) / 2;
  const pair12 = (edge[1] + edge[3]) / 2;
  const rotated = pair01 <= pair12
    ? [...points]
    : [points[1], points[2], points[3], points[0]];
  const lengths = rotated.map((point, index) => distanceM(point, rotated[(index + 1) % rotated.length]));
  return {
    points: rotated,
    short_edges_m: [lengths[0], lengths[2]],
    long_edges_m: [lengths[1], lengths[3]],
    short_dimension_m: (lengths[0] + lengths[2]) / 2,
    long_dimension_m: (lengths[1] + lengths[3]) / 2,
  };
}
function lerpPoint(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function bilinearPoint(points, u, v) {
  const bottom = lerpPoint(points[0], points[1], u);
  const top = lerpPoint(points[3], points[2], u);
  return lerpPoint(bottom, top, v);
}
function deriveSubzone(points) {
  const policy = CONFIG.conservative_subzone_policy;
  const ring = [
    bilinearPoint(points, policy.short_axis_fraction_start, policy.long_axis_fraction_start),
    bilinearPoint(points, policy.short_axis_fraction_end, policy.long_axis_fraction_start),
    bilinearPoint(points, policy.short_axis_fraction_end, policy.long_axis_fraction_end),
    bilinearPoint(points, policy.short_axis_fraction_start, policy.long_axis_fraction_end),
  ];
  ring.push(ring[0]);
  const feature = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
  const validation = geometryValidationCodes(feature);
  assert(validation.length === 0, `T3R1_DERIVED_SUBZONE_GEOMETRY_INVALID:${validation.join(',')}`);
  const canonical = canonicalGeometry(feature);
  return {
    canonical,
    semantic_hash: hash(canonical),
    area_m2: polygonAreaM2(canonical),
  };
}
async function digestPage(page, source) {
  const requested = new URL(source.url || source.page_url);
  assert(requested.protocol === 'https:' && requested.hostname === source.allowed_host, 'T3R1_GEOMETRY_UNAPPROVED_SOURCE_HOST');
  const response = await page.goto(requested.href, { waitUntil: 'domcontentloaded', timeout: 75_000 });
  assert(response?.ok(), `T3R1_GEOMETRY_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  const finalUrl = new URL(response.url());
  assert(finalUrl.protocol === 'https:' && finalUrl.hostname === source.allowed_host, 'T3R1_GEOMETRY_REDIRECT_HOST_FORBIDDEN');
  const bytes = await response.body();
  const text = normalize(await page.locator('body').innerText());
  for (const marker of source.required_markers || []) {
    assert(text.toLowerCase().includes(normalize(marker).toLowerCase()), `T3R1_GEOMETRY_PROVIDER_MARKER_MISSING:${marker}`);
  }
  return {
    response_sha256: sha256(bytes),
    response_bytes: bytes.byteLength,
    retrieved_at: new Date().toISOString(),
    provider_body_emitted: false,
  };
}

async function main() {
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'T3R1_GEOMETRY_EXACT_SUBJECT_REQUIRED');
  assert(CONFIG.frontier === 'T3R1_CROP_ONLY_GEOMETRY_AUTHORITY', 'T3R1_GEOMETRY_FRONTIER_MISMATCH');
  assert(CONFIG.prairie_strip_guard.strip_geometry_wkt_required === false, 'T3R1_STRIP_WKT_REQUIREMENT_MUST_BE_FALSE');
  assert(CONFIG.prairie_strip_guard.strip_geometry_may_not_be_invented === true, 'T3R1_STRIP_WKT_INVENTION_MUST_BE_FORBIDDEN');
  assert(CONFIG.resolution_policy.formal_rebind_authorized_by_this_probe === false, 'T3R1_GEOMETRY_PREMATURE_REBIND_FORBIDDEN');
  assert(CONFIG.resolution_policy.current_lifecycle_authorized_by_this_probe === false, 'T3R1_GEOMETRY_PREMATURE_LIFECYCLE_FORBIDDEN');

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: 'GEOX-MCFT-CAP09-T3R1-Crop-Geometry/1.0' });
    const page = await context.newPage();

    const structureProof = await digestPage(page, CONFIG.provider_sources.mcse_structure);
    const yieldProof = await digestPage(page, CONFIG.provider_sources.annual_crop_yield);
    const areaProof = await digestPage(page, CONFIG.provider_sources.aglog_areas);
    const geometryPageProof = await digestPage(page, CONFIG.provider_sources.plot_geometry);

    const geometrySource = CONFIG.provider_sources.plot_geometry;
    const downloadAnchor = page.getByRole('link', { name: /Download complete data table/i }).first();
    assert(await downloadAnchor.count() === 1, 'T3R1_GEOMETRY_DOWNLOAD_ANCHOR_REQUIRED');
    const href = await downloadAnchor.getAttribute('href');
    assert(href, 'T3R1_GEOMETRY_DOWNLOAD_HREF_REQUIRED');
    const resolved = new URL(href, geometrySource.page_url);
    assert(resolved.protocol === 'https:'
      && resolved.hostname === geometrySource.allowed_host
      && resolved.pathname === geometrySource.download_path
      && !resolved.search, 'T3R1_GEOMETRY_DOWNLOAD_LOCATOR_MISMATCH');

    const csvResponse = await context.request.get(resolved.href, {
      timeout: 120_000,
      headers: { accept: 'text/csv,text/plain;q=0.9,*/*;q=0.5' },
    });
    assert(csvResponse.ok(), `T3R1_GEOMETRY_CSV_HTTP_${csvResponse.status()}`);
    const csvBytes = await csvResponse.body();
    assert(csvBytes.byteLength <= 20 * 1024 * 1024, 'T3R1_GEOMETRY_CSV_TOO_LARGE');
    const csvText = csvBytes.toString('utf8');
    assert(!/^\s*<!doctype html|^\s*<html/i.test(csvText), 'T3R1_GEOMETRY_CSV_HTML_FORBIDDEN');
    const rows = parseTable(csvText, ['treatment', 'replicate', 'subplot', 'geometry']);
    const selector = CONFIG.provider_geometry_selector;
    const matches = rows.filter((row) => normalize(row.treatment).toUpperCase() === selector.treatment
      && normalize(row.replicate).toUpperCase() === selector.replicate
      && normalize(row.subplot).toLowerCase() === selector.subplot);
    assert(matches.length === selector.expected_match_count, `T3R1_GEOMETRY_MAIN_MATCH_COUNT_${matches.length}`);

    const providerRawGeometry = String(matches[0].geometry || '');
    const providerRawGeometrySha256 = sha256(providerRawGeometry);
    const points = parseProviderQuadrilateral(providerRawGeometry, selector.required_srid);
    assert(!selector.require_convex_quadrilateral || isConvex(points), 'T3R1_MAIN_PROVIDER_GEOMETRY_NOT_CONVEX');
    const oriented = orientShortAxis(points);

    const dimension = CONFIG.provider_dimension_guard;
    assert(oriented.short_dimension_m >= dimension.measured_short_dimension_min_m
      && oriented.short_dimension_m <= dimension.measured_short_dimension_max_m,
    `T3R1_SHORT_DIMENSION_OUT_OF_RANGE:${oriented.short_dimension_m}`);
    assert(oriented.long_dimension_m >= dimension.measured_long_dimension_min_m
      && oriented.long_dimension_m <= dimension.measured_long_dimension_max_m,
    `T3R1_LONG_DIMENSION_OUT_OF_RANGE:${oriented.long_dimension_m}`);
    assert(CONFIG.prairie_strip_guard.length_m > dimension.declared_plot_short_dimension_m,
      'T3R1_STRIP_LENGTH_DOES_NOT_FORCE_LONG_AXIS');
    assert(CONFIG.prairie_strip_guard.length_m < dimension.declared_plot_long_dimension_m,
      'T3R1_STRIP_LENGTH_EXCEEDS_DECLARED_LONG_AXIS');

    const policy = CONFIG.conservative_subzone_policy;
    const shortMin = Math.min(...oriented.short_edges_m);
    const shortMax = Math.max(...oriented.short_edges_m);
    const longMin = Math.min(...oriented.long_edges_m);
    const outerBoundaryMarginM = policy.short_axis_fraction_start * shortMin;
    const farEdgeFromOuterM = policy.short_axis_fraction_end * shortMax;
    const centerStripNearEdgeM = (shortMin - CONFIG.prairie_strip_guard.width_m) / 2;
    const centerStripClearanceM = centerStripNearEdgeM - farEdgeFromOuterM;
    const endBoundaryMarginM = Math.min(policy.long_axis_fraction_start, 1 - policy.long_axis_fraction_end) * longMin;
    assert(outerBoundaryMarginM >= policy.minimum_outer_boundary_margin_m,
      `T3R1_OUTER_BOUNDARY_MARGIN_INSUFFICIENT:${outerBoundaryMarginM}`);
    assert(centerStripClearanceM >= policy.minimum_center_strip_clearance_m,
      `T3R1_CENTER_STRIP_CLEARANCE_INSUFFICIENT:${centerStripClearanceM}`);
    assert(endBoundaryMarginM >= policy.minimum_end_boundary_margin_m,
      `T3R1_END_BOUNDARY_MARGIN_INSUFFICIENT:${endBoundaryMarginM}`);

    const derived = deriveSubzone(oriented.points);
    assert(derived.area_m2 >= policy.minimum_derived_area_m2 && derived.area_m2 <= policy.maximum_derived_area_m2,
      `T3R1_DERIVED_AREA_OUT_OF_RANGE:${derived.area_m2}`);

    const result = {
      schema_version: 'geox_mcft_cap09_t3r1_crop_only_geometry_result_v1',
      status: 'PASS',
      subject_sha: SUBJECT_SHA,
      authority_time_utc: new Date().toISOString(),
      frontier: CONFIG.frontier,
      candidate_scope: CONFIG.candidate_scope,
      provider_authority_proofs: {
        mcse_structure: structureProof,
        annual_crop_yield: yieldProof,
        aglog_areas: areaProof,
        plot_geometry_page: geometryPageProof,
        geometry_csv_sha256: sha256(csvBytes),
        geometry_csv_bytes: csvBytes.byteLength,
        provider_raw_payload_persisted_or_uploaded: false,
      },
      provider_main_geometry: {
        status: 'RESOLVED_PROVIDER_MAIN_POLYGON',
        match_count: matches.length,
        srid: selector.required_srid,
        distinct_vertex_count: points.length,
        convex_quadrilateral: true,
        provider_raw_geometry_sha256: providerRawGeometrySha256,
        provider_raw_geometry_emitted: false,
        provider_raw_geometry_persisted_or_uploaded: false,
        measured_short_dimension_m: Number(oriented.short_dimension_m.toFixed(3)),
        measured_long_dimension_m: Number(oriented.long_dimension_m.toFixed(3)),
        measured_short_edge_min_m: Number(shortMin.toFixed(3)),
        measured_short_edge_max_m: Number(shortMax.toFixed(3)),
        measured_long_edge_min_m: Number(longMin.toFixed(3)),
      },
      prairie_strip_authority: {
        status: 'RESOLVED_STRUCTURAL_EXCLUSION_AUTHORITY',
        width_m: CONFIG.prairie_strip_guard.width_m,
        length_m: CONFIG.prairie_strip_guard.length_m,
        position: CONFIG.prairie_strip_guard.position,
        long_axis_forced_by_declared_dimensions: true,
        strip_wkt_required: false,
        strip_wkt_invented: false,
        prairie_strip_relabelled_corn: false,
      },
      conservative_crop_only_subzone_authority_candidate: {
        status: CONFIG.resolution_policy.resolved_status,
        construction: policy.construction,
        canonicalization_id: policy.canonicalization_id,
        geometry_type: 'Polygon',
        crs: 'EPSG:4326',
        geometry_semantic_hash: derived.semantic_hash,
        derived_area_m2: derived.area_m2,
        minimum_outer_boundary_margin_m: Number(outerBoundaryMarginM.toFixed(3)),
        minimum_center_strip_clearance_m: Number(centerStripClearanceM.toFixed(3)),
        minimum_end_boundary_margin_m: Number(endBoundaryMarginM.toFixed(3)),
        raw_or_derived_coordinates_emitted: false,
        raw_or_derived_coordinates_committed: false,
        whole_t3r1_plot_assumed_crop_only: false,
        strip_geometry_invented: false,
      },
      authority_effect: {
        crop_only_geometry_candidate_resolved: true,
        current_lifecycle_resolved: false,
        formal_site_rebind_authorized: false,
        runtime_config_write_authorized: false,
        ea5e2_operational_activation_authorized: false,
      },
      next_frontier: 'T3R1_CURRENT_LIFECYCLE_AUTHORITY',
      database_write_count: 0,
      formal_evidence_write_count: 0,
      raw_object_write_count: 0,
      runtime_config_write_count: 0,
      scheduler_write_count: 0,
      canonical_runtime_write_count: 0,
      formal_window_started: false,
      formal_execution_count: '0/24',
    };
    write(result);
  } finally {
    await browser.close();
  }
}

try {
  await main();
} catch (error) {
  write({
    schema_version: 'geox_mcft_cap09_t3r1_crop_only_geometry_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA || null,
    error: safeError(error),
    crop_only_geometry_candidate_resolved: false,
    current_lifecycle_resolved: false,
    formal_site_rebind_authorized: false,
    ea5e2_operational_activation_authorized: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    raw_object_write_count: 0,
    runtime_config_write_count: 0,
    scheduler_write_count: 0,
    canonical_runtime_write_count: 0,
    formal_window_started: false,
    formal_execution_count: '0/24',
  });
  process.exitCode = 1;
}
