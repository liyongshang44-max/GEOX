// scripts/governance_acceptance/mcft00/MCFT00_GEOMETRY_AND_HASH.cjs
// Private MCFT-00 acceptance helpers for deterministic JSON, geometry, hashing, and fixture mutation.
'use strict';
const crypto = require('node:crypto');

function sha256Bytes(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function sha256Text(value) { return sha256Bytes(Buffer.from(value, 'utf8')); }
function hash(value) { return `sha256:${sha256Text(stableStringify(value))}`; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }
function arrayNonEmpty(value) { return Array.isArray(value) && value.length > 0; }
function approx(a, b, tolerance = 1e-6) { return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance; }
function field(text, key) { return (text.match(new RegExp(`^${key}:\\s*(.+)$`, 'm')) || [])[1]?.trim(); }

function stableStringify(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('NON_FINITE_NUMBER');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  throw new Error(`UNSUPPORTED_JSON_TYPE:${typeof value}`);
}

function round7(value) {
  const rounded = Math.round(Number(value) * 1e7) / 1e7;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function coordinateKey(point) {
  return `${point[0].toFixed(7)},${point[1].toFixed(7)}`;
}

function signedPlanarArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
}

function normalizeRing(rawRing, outer) {
  let ring = rawRing.map((point) => [round7(point[0]), round7(point[1])]);
  while (ring.length > 1 && coordinateKey(ring[ring.length - 1]) === coordinateKey(ring[ring.length - 2])) ring.pop();
  if (coordinateKey(ring[0]) === coordinateKey(ring[ring.length - 1])) ring.pop();
  const deduped = [];
  for (const point of ring) {
    if (!deduped.length || coordinateKey(deduped[deduped.length - 1]) !== coordinateKey(point)) deduped.push(point);
  }
  ring = deduped;
  const closed = [...ring, ring[0]];
  const shouldBePositive = outer;
  const positive = signedPlanarArea(closed) > 0;
  if (positive !== shouldBePositive) ring.reverse();
  let minIndex = 0;
  for (let i = 1; i < ring.length; i += 1) {
    if (coordinateKey(ring[i]) < coordinateKey(ring[minIndex])) minIndex = i;
  }
  ring = [...ring.slice(minIndex), ...ring.slice(0, minIndex)];
  return [...ring, ring[0]];
}

function geometryValidationCodes(feature) {
  const codes = [];
  const geometry = feature?.geometry;
  if (!geometry || !Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    codes.push('GEOMETRY_EMPTY');
    return codes;
  }
  if (geometry.type !== 'Polygon') codes.push('GEOMETRY_TYPE_NOT_POLYGON');
  for (const ring of geometry.coordinates || []) {
    if (!Array.isArray(ring) || ring.length < 4) {
      codes.push('GEOMETRY_RING_TOO_SHORT');
      continue;
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (!Array.isArray(first) || !Array.isArray(last) || first[0] !== last[0] || first[1] !== last[1]) {
      codes.push('GEOMETRY_RING_UNCLOSED');
    }
    for (const point of ring) {
      if (!Array.isArray(point) || point.length < 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
        codes.push('GEOMETRY_COORDINATE_NON_FINITE');
      } else if (point[0] < -180 || point[0] > 180 || point[1] < -90 || point[1] > 90) {
        codes.push('GEOMETRY_COORDINATE_OUT_OF_RANGE');
      }
    }
  }
  return [...new Set(codes)];
}

function canonicalGeometry(feature) {
  const validation = geometryValidationCodes(feature);
  if (validation.length) throw new Error(validation[0]);
  const rings = feature.geometry.coordinates.map((ring, index) => normalizeRing(ring, index === 0));
  const outer = rings[0];
  const inners = rings.slice(1).sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
  return { type: 'Polygon', coordinates: [outer, ...inners] };
}

function sphericalRingArea(ring) {
  const radius = 6371007.1809;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const lon1 = ring[i][0] * Math.PI / 180;
    const lat1 = ring[i][1] * Math.PI / 180;
    const lon2 = ring[i + 1][0] * Math.PI / 180;
    const lat2 = ring[i + 1][1] * Math.PI / 180;
    let deltaLon = lon2 - lon1;
    if (deltaLon > Math.PI) deltaLon -= 2 * Math.PI;
    if (deltaLon < -Math.PI) deltaLon += 2 * Math.PI;
    sum += deltaLon * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs(sum) * radius * radius / 2;
}

function polygonAreaM2(canonical) {
  const rings = canonical.coordinates;
  const area = sphericalRingArea(rings[0]) - rings.slice(1).reduce((sum, ring) => sum + sphericalRingArea(ring), 0);
  return Math.round(area * 1e6) / 1e6;
}

function getPath(target, dotted, create = false) {
  const parts = dotted.split('.');
  let cursor = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const raw = parts[i];
    const key = /^\d+$/.test(raw) ? Number(raw) : raw;
    if (cursor[key] === undefined && create) cursor[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cursor = cursor[key];
  }
  const rawLast = parts[parts.length - 1];
  return { parent: cursor, key: /^\d+$/.test(rawLast) ? Number(rawLast) : rawLast };
}

function applyMutations(pkg, mutations) {
  for (const mutation of mutations || []) {
    const ref = getPath(pkg, mutation.path, mutation.op !== 'delete');
    if (mutation.op === 'set') ref.parent[ref.key] = clone(mutation.value);
    else if (mutation.op === 'delete') delete ref.parent[ref.key];
    else if (mutation.op === 'append') {
      if (!Array.isArray(ref.parent[ref.key])) ref.parent[ref.key] = [];
      ref.parent[ref.key].push(clone(mutation.value));
    } else throw new Error(`UNKNOWN_MUTATION_OP:${mutation.op}`);
  }
}

function scanForbiddenHashInputs(value, pathParts = [], out = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenHashInputs(item, [...pathParts, String(index)], out));
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  for (const [key, child] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (lower === 'created_at') out.push('FORBIDDEN_HASH_INPUT_CREATED_AT');
    if (['persisted_at', 'fact_id', 'worker_id', 'process_id', 'random_uuid', 'git_branch'].includes(lower)) out.push(`FORBIDDEN_HASH_INPUT_${lower.toUpperCase()}`);
    if (lower.includes('absolute_path') || lower === 'source_path' || lower === 'checkout_path') out.push('FORBIDDEN_HASH_INPUT_ABSOLUTE_PATH');
    scanForbiddenHashInputs(child, [...pathParts, key], out);
  }
  return out;
}

module.exports = { sha256Bytes, sha256Text, hash, clone, nonEmpty, arrayNonEmpty, approx, field, stableStringify, round7, coordinateKey, signedPlanarArea, normalizeRing, geometryValidationCodes, canonicalGeometry, sphericalRingArea, polygonAreaM2, getPath, applyMutations, scanForbiddenHashInputs };
