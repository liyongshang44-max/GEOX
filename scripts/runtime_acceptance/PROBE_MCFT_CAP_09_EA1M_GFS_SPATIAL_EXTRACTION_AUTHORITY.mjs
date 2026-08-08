#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1M-GFS-SPATIAL-EXTRACTION-AUTHORITY-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1M_GFS_SPATIAL_EXTRACTION_AUTHORITY_RESULT.json');
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null;
const EARTH_RADIUS_M = 6371008.8;
const GRID = CONFIG.gfs_grid_authority.latitude_spacing_degrees;

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
      output.push(value); value = '';
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
        headers = cells; delimiter = candidate; headerIndex = index; break;
      }
    }
    if (headers) break;
  }
  if (!headers) throw new Error('EA1M_REQUIRED_CSV_HEADER_NOT_FOUND');
  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim()) continue;
    const cells = parseDelimitedLine(line, delimiter);
    if (cells.length < headers.length) continue;
    const row = {};
    headers.forEach((header, index) => { row[header] = cells[index] ?? ''; });
    rows.push(row);
  }
  if (!rows.length) throw new Error('EA1M_CSV_ROWS_REQUIRED');
  return { rows, headers, delimiter: delimiter === ',' ? 'COMMA' : delimiter === '\t' ? 'TAB' : delimiter === ';' ? 'SEMICOLON' : 'PIPE' };
}
function parseEwktPolygon(raw) {
  const value = String(raw || '').trim();
  const match = value.match(/^SRID=(\d+);POLYGON\(\(([^()]+)\)\)$/i);
  if (!match) throw new Error('EA1M_SIMPLE_EWKT_POLYGON_REQUIRED');
  const srid = Number(match[1]);
  if (srid !== CONFIG.site_geometry_source.required_srid) throw new Error(`EA1M_SRID_MISMATCH_${srid}`);
  const points = match[2].split(',').map((token) => {
    const parts = token.trim().split(/\s+/).map(Number);
    if (parts.length !== 2 || !parts.every(Number.isFinite)) throw new Error('EA1M_POLYGON_COORDINATE_INVALID');
    const [lon, lat] = parts;
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) throw new Error('EA1M_POLYGON_COORDINATE_OUT_OF_RANGE');
    return { lon, lat };
  });
  if (points.length < 4) throw new Error(`EA1M_POLYGON_VERTEX_COUNT_TOO_SMALL_${points.length}`);
  const first = points[0];
  const last = points.at(-1);
  if (Math.abs(first.lon - last.lon) > 1e-10 || Math.abs(first.lat - last.lat) > 1e-10) throw new Error('EA1M_POLYGON_MUST_BE_CLOSED');
  const unique = points.slice(0, -1);
  if (unique.length < 3) throw new Error('EA1M_POLYGON_UNIQUE_VERTICES_TOO_FEW');
  return { srid, closed: points, vertices: unique };
}
function polygonCentroid(vertices) {
  let twiceArea = 0;
  let cxNumerator = 0;
  let cyNumerator = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const a = vertices[index];
    const b = vertices[(index + 1) % vertices.length];
    const cross = a.lon * b.lat - b.lon * a.lat;
    twiceArea += cross;
    cxNumerator += (a.lon + b.lon) * cross;
    cyNumerator += (a.lat + b.lat) * cross;
  }
  if (Math.abs(twiceArea) < 1e-12) throw new Error('EA1M_POLYGON_AREA_DEGENERATE');
  return { lon: cxNumerator / (3 * twiceArea), lat: cyNumerator / (3 * twiceArea) };
}
function rad(value) { return value * Math.PI / 180; }
function haversineMeters(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const lat1 = rad(a.lat);
  const lat2 = rad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
function nativeLon(lon) {
  const normalized = ((lon % 360) + 360) % 360;
  return normalized >= 360 ? 0 : normalized;
}
function signedLon(lon360) {
  return lon360 > 180 ? lon360 - 360 : lon360;
}
function gridCandidates(point) {
  const lon360 = nativeLon(point.lon);
  const latFloor = Math.floor(point.lat / GRID) * GRID;
  const latCeil = Math.min(90, latFloor + GRID);
  const lonFloor = Math.floor(lon360 / GRID) * GRID;
  const lonCeil = (lonFloor + GRID) % 360;
  const lats = [...new Set([latFloor, latCeil].map((value) => Number(value.toFixed(10))))];
  const lons = [...new Set([lonFloor, lonCeil].map((value) => Number(value.toFixed(10))))];
  return lats.flatMap((lat) => lons.map((lon360Value) => ({ lat, lon360: lon360Value, lon: signedLon(lon360Value) })));
}
function nearestGridPoint(point) {
  const ranked = gridCandidates(point).map((candidate) => ({
    ...candidate,
    distanceM: haversineMeters(point, { lat: candidate.lat, lon: candidate.lon }),
  })).sort((a, b) => a.distanceM - b.distanceM || a.lat - b.lat || a.lon360 - b.lon360);
  if (!ranked.length) throw new Error('EA1M_GFS_GRID_CANDIDATE_REQUIRED');
  return { selected: ranked[0], second: ranked[1] ?? null };
}
function gridKey(point) {
  return `${point.lat.toFixed(6)}|${point.lon360.toFixed(6)}`;
}
function polygonDiameter(vertices) {
  let max = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    for (let j = i + 1; j < vertices.length; j += 1) max = Math.max(max, haversineMeters(vertices[i], vertices[j]));
  }
  return max;
}

let browser;
try {
  if (!SUBJECT_SHA || !/^[0-9a-f]{40}$/.test(SUBJECT_SHA)) throw new Error('EA1M_EXACT_SUBJECT_SHA_REQUIRED');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const response = await page.goto(CONFIG.site_geometry_source.official_page, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (!response?.ok()) throw new Error(`EA1M_KBS_PAGE_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  const pageText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  const pageLower = pageText.toLowerCase();
  for (const marker of ['MCSE Plot polygons', 'submeter accuracy GPS', 'KBS039-006.40', 'may not be published without written permission']) {
    if (!pageLower.includes(marker.toLowerCase())) throw new Error(`EA1M_KBS_PAGE_MARKER_MISSING_${normalizeKey(marker)}`);
  }
  const pageBytes = await response.body();
  const anchor = page.getByRole('link', { name: /Download complete data table/i }).first();
  if (await anchor.count() !== 1) throw new Error('EA1M_DOWNLOAD_ANCHOR_REQUIRED');
  const href = await anchor.getAttribute('href');
  if (!href) throw new Error('EA1M_DOWNLOAD_HREF_REQUIRED');
  const resolved = new URL(href, CONFIG.site_geometry_source.official_page);
  if (resolved.protocol !== 'https:' || resolved.hostname !== CONFIG.site_geometry_source.official_host || resolved.pathname !== CONFIG.site_geometry_source.download_path || resolved.search) {
    throw new Error('EA1M_DOWNLOAD_LOCATOR_MISMATCH');
  }
  const csvResponse = await context.request.get(resolved.href, { timeout: 120_000, headers: { accept: 'text/csv,text/plain;q=0.9,*/*;q=0.5' } });
  if (!csvResponse.ok()) throw new Error(`EA1M_CSV_HTTP_${csvResponse.status()}`);
  const csvBytes = await csvResponse.body();
  if (csvBytes.byteLength > 20 * 1024 * 1024) throw new Error(`EA1M_CSV_TOO_LARGE_${csvBytes.byteLength}`);
  const csvText = csvBytes.toString('utf8');
  if (/^\s*<!doctype html|^\s*<html/i.test(csvText)) throw new Error('EA1M_CSV_HTML_FORBIDDEN');
  const parsed = parseTable(csvText, ['treatment','replicate','subplot','geometry']);
  const target = CONFIG.site_geometry_source.selected_row;
  const matches = parsed.rows.filter((row) => String(row.treatment).trim().toUpperCase() === target.treatment
    && String(row.replicate).trim().toUpperCase() === target.replicate
    && String(row.subplot).trim().toLowerCase() === target.subplot);
  if (matches.length !== target.expected_match_count) throw new Error(`EA1M_TARGET_ROW_MATCH_COUNT_${matches.length}`);
  const selectedRow = matches[0];
  const polygon = parseEwktPolygon(selectedRow.geometry);
  const centroid = polygonCentroid(polygon.vertices);
  const diameterM = polygonDiameter(polygon.vertices);
  if (diameterM > CONFIG.selection_algorithm.maximum_polygon_diameter_m) throw new Error(`EA1M_POLYGON_DIAMETER_TOO_LARGE_${diameterM.toFixed(3)}M`);

  const centroidNearest = nearestGridPoint(centroid);
  const vertexSelections = polygon.vertices.map((vertex) => nearestGridPoint(vertex));
  const selectedKey = gridKey(centroidNearest.selected);
  const allSame = vertexSelections.every((entry) => gridKey(entry.selected) === selectedKey);
  if (!allSame) throw new Error('EA1M_POLYGON_FOOTPRINT_CROSSES_NEAREST_GFS_GRIDPOINT_PARTITION');
  const centroidDistanceM = centroidNearest.selected.distanceM;
  const vertexDistances = polygon.vertices.map((vertex) => haversineMeters(vertex, { lat: centroidNearest.selected.lat, lon: centroidNearest.selected.lon }));
  const maxVertexDistanceM = Math.max(...vertexDistances);
  if (centroidDistanceM > CONFIG.selection_algorithm.maximum_centroid_to_selected_gridpoint_distance_m) {
    throw new Error(`EA1M_CENTROID_TO_GRIDPOINT_DISTANCE_TOO_LARGE_${centroidDistanceM.toFixed(3)}M`);
  }
  if (maxVertexDistanceM > CONFIG.selection_algorithm.maximum_any_vertex_to_selected_gridpoint_distance_m) {
    throw new Error(`EA1M_VERTEX_TO_GRIDPOINT_DISTANCE_TOO_LARGE_${maxVertexDistanceM.toFixed(3)}M`);
  }

  const safeRowIdentity = `${String(selectedRow.treatment).trim()}|${String(selectedRow.replicate).trim()}|${String(selectedRow.subplot).trim()}|${String(selectedRow.geometry).trim()}`;
  const result = {
    schema_version: 'geox_mcft_cap09_ea1m_gfs_spatial_extraction_authority_result_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    observed_at: new Date().toISOString(),
    site_source_evidence: {
      provider: CONFIG.site_geometry_source.provider,
      datatable_id: CONFIG.site_geometry_source.datatable_id,
      official_page_sha256: sha256(pageBytes),
      csv_sha256: sha256(csvBytes),
      csv_bytes: csvBytes.byteLength,
      selected_row_sha256: sha256(safeRowIdentity),
      selected_identity: { treatment: target.treatment, replicate: target.replicate, subplot: target.subplot },
      selected_row_match_count: matches.length,
      polygon_srid: polygon.srid,
      polygon_unique_vertex_count: polygon.vertices.length,
      polygon_diameter_m: Number(diameterM.toFixed(3)),
      raw_polygon_emitted: false,
      centroid_coordinate_emitted: false,
      raw_kbs_row_emitted: false,
    },
    selected_gfs_spatial_support: {
      grid: CONFIG.gfs_grid_authority.grid,
      interpolation_method: CONFIG.gfs_grid_authority.interpolation_method,
      selected_grid_latitude: centroidNearest.selected.lat,
      selected_grid_native_longitude: centroidNearest.selected.lon360,
      selected_grid_signed_longitude: centroidNearest.selected.lon,
      centroid_to_selected_gridpoint_distance_m: Number(centroidDistanceM.toFixed(3)),
      maximum_vertex_to_selected_gridpoint_distance_m: Number(maxVertexDistanceM.toFixed(3)),
      centroid_and_all_vertices_same_nearest_gridpoint: true,
      same_grid_point_for_all_required_gfs_variables: true,
      direct_field_equivalence: false,
      field_scale_forecast_truth_claimed: false,
      subgrid_variability_resolved: false,
    },
    source_use_boundary: {
      formal_runtime_use_right_established: false,
      formal_runtime_use_right_status: CONFIG.data_use_boundary.formal_runtime_use_right_status,
      public_raw_geometry_republication_right_claimed: false,
    },
    qualification_findings: {
      current_plot_geometry_machine_access: 'PASS_TRANSIENT',
      deterministic_single_gfs_gridpoint_spatial_authority_candidate: 'PASS',
      forecast_value_canonicalization_implemented: false,
      formal_future_weather_source_authority_created: false,
      formal_future_et0_source_authority_created: false,
      formal_window_started: false,
    },
    forecast_values_emitted: false,
    raw_provider_geometry_persisted_or_uploaded: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    runtime_product_source_delta: 0,
  };
  writeResult(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1m_gfs_spatial_extraction_authority_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA,
    error: safeError(error),
    observed_at: new Date().toISOString(),
    forecast_values_emitted: false,
    raw_provider_geometry_persisted_or_uploaded: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    formal_window_started: false,
  };
  writeResult(result);
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
}
