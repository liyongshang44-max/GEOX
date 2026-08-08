#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1C-KBS-JSON-SOURCE-MAP-PROBE-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1C_KBS_JSON_SOURCE_MAP_PROBE_RESULT.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null;
const MAX_SCHEMA_PATHS = 160;
const MAX_ARRAY_SHAPES = 80;
const MAX_METADATA_TOKENS = 40;

function sha256(input) {
  return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
}
function writeResult(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function safeError(error) {
  return error instanceof Error ? error.message : String(error);
}
function parseEndpointId(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname !== config.official_host) return null;
    const match = parsed.pathname.match(/^\/weather\/variates\/(\d+)\/?$/);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}
function canonicalEndpointUrl(id) {
  return `https://${config.official_host}${config.endpoint_path_prefix}${id}`;
}
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function maybeTimestamp(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 80) return null;
    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed) && parsed >= Date.UTC(2000, 0, 1) && parsed <= Date.now() + 86_400_000) return parsed;
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const candidates = [value, value * 1000];
    for (const parsed of candidates) {
      if (parsed >= Date.UTC(2000, 0, 1) && parsed <= Date.now() + 86_400_000) return parsed;
    }
  }
  return null;
}
function schemaSummary(json) {
  const keyPaths = new Set();
  const arrayShapes = new Set();
  const metadataTokens = new Set();
  const timestamps = [];
  const primitiveCounts = { string: 0, number: 0, boolean: 0, null: 0 };
  const lexicon = config.allowed_metadata_lexicon.map((entry) => normalizeText(entry));

  function scan(value, pathParts, parentKey = '') {
    const pathText = pathParts.join('.') || '$';
    if (value === null) {
      primitiveCounts.null += 1;
      return;
    }
    if (Array.isArray(value)) {
      const first = value[0];
      const itemKind = Array.isArray(first) ? `array:${first.length}` : first === null ? 'null' : typeof first;
      if (arrayShapes.size < MAX_ARRAY_SHAPES) arrayShapes.add(`${pathText}|len=${value.length}|item=${itemKind}`);
      if (value.length > 0 && value.every((item) => Array.isArray(item) && item.length >= 2)) {
        for (const tuple of value) {
          const timestamp = maybeTimestamp(tuple[0]);
          if (timestamp !== null) timestamps.push(timestamp);
        }
      }
      const sampleCount = Math.min(value.length, 40);
      for (let index = 0; index < sampleCount; index += 1) scan(value[index], [...pathParts, '[]'], parentKey);
      return;
    }
    if (isPlainObject(value)) {
      const entries = Object.entries(value);
      for (const [key, child] of entries) {
        const nextPath = [...pathParts, key];
        if (keyPaths.size < MAX_SCHEMA_PATHS) keyPaths.add(nextPath.join('.'));
        scan(child, nextPath, key);
      }
      return;
    }
    if (typeof value === 'string') {
      primitiveCounts.string += 1;
      const normalized = normalizeText(value);
      for (const token of lexicon) {
        if (normalized === token || normalized.includes(token)) metadataTokens.add(token);
      }
      if (/time|date|updated|observed|timestamp/i.test(parentKey)) {
        const timestamp = maybeTimestamp(value);
        if (timestamp !== null) timestamps.push(timestamp);
      }
      return;
    }
    if (typeof value === 'number') {
      primitiveCounts.number += 1;
      if (/time|date|updated|observed|timestamp/i.test(parentKey)) {
        const timestamp = maybeTimestamp(value);
        if (timestamp !== null) timestamps.push(timestamp);
      }
      return;
    }
    if (typeof value === 'boolean') primitiveCounts.boolean += 1;
  }

  scan(json, []);
  const uniqueTimestamps = [...new Set(timestamps)].sort((a, b) => a - b);
  return {
    root_kind: Array.isArray(json) ? 'array' : json === null ? 'null' : typeof json,
    schema_key_paths: [...keyPaths].sort().slice(0, MAX_SCHEMA_PATHS),
    array_shapes: [...arrayShapes].sort().slice(0, MAX_ARRAY_SHAPES),
    primitive_counts: primitiveCounts,
    approved_metadata_tokens: [...metadataTokens].sort().slice(0, MAX_METADATA_TOKENS),
    timestamp_count_detected: uniqueTimestamps.length,
    earliest_timestamp_detected: uniqueTimestamps.length ? new Date(uniqueTimestamps[0]).toISOString() : null,
    latest_timestamp_detected: uniqueTimestamps.length ? new Date(uniqueTimestamps.at(-1)).toISOString() : null,
    raw_numeric_values_emitted: false,
    raw_unfiltered_strings_emitted: false,
  };
}

const responseTasks = [];
const endpointEvidence = new Map();
let browser;
const retrievedAt = new Date().toISOString();

try {
  if (!SUBJECT_SHA || !/^[0-9a-f]{40}$/.test(SUBJECT_SHA)) throw new Error('EA1C_EXACT_SUBJECT_SHA_REQUIRED');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'en-US', timezoneId: 'UTC' });
  const page = await context.newPage();

  page.on('response', (response) => {
    const endpointId = parseEndpointId(response.url());
    if (endpointId === null) return;
    const task = (async () => {
      const status = response.status();
      const headers = await response.allHeaders();
      if (status < 200 || status >= 300) {
        endpointEvidence.set(endpointId, {
          endpoint_id: endpointId,
          endpoint_url: canonicalEndpointUrl(endpointId),
          status,
          content_type: headers['content-type'] ?? null,
          response_body_sha256: null,
          response_bytes: null,
          parse_status: 'HTTP_NON_2XX',
        });
        return;
      }
      const body = await response.body();
      let json;
      try {
        json = JSON.parse(body.toString('utf8'));
      } catch {
        endpointEvidence.set(endpointId, {
          endpoint_id: endpointId,
          endpoint_url: canonicalEndpointUrl(endpointId),
          status,
          content_type: headers['content-type'] ?? null,
          response_body_sha256: sha256(body),
          response_bytes: body.byteLength,
          parse_status: 'NON_JSON_BODY',
        });
        return;
      }
      endpointEvidence.set(endpointId, {
        endpoint_id: endpointId,
        endpoint_url: canonicalEndpointUrl(endpointId),
        status,
        content_type: headers['content-type'] ?? null,
        response_body_sha256: sha256(body),
        response_bytes: body.byteLength,
        parse_status: 'JSON_PARSED',
        schema: schemaSummary(json),
      });
    })();
    responseTasks.push(task);
  });

  const response = await page.goto(config.source_url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  if (!response || response.status() < 200 || response.status() >= 400) throw new Error(`EA1C_SOURCE_DOCUMENT_FAILED:${response?.status() ?? 'NO_RESPONSE'}`);
  await page.waitForFunction(() => /Soil\s+Moisture\s*\(10\s*cm/i.test(document.body?.innerText ?? ''), undefined, { timeout: 45_000 });
  await page.waitForTimeout(5_000);
  await Promise.allSettled(responseTasks);

  const requiredIds = [...config.previously_observed_endpoint_ids].sort((a, b) => a - b);
  const observedIds = [...endpointEvidence.keys()].sort((a, b) => a - b);
  const missingIds = requiredIds.filter((id) => !endpointEvidence.has(id));
  if (missingIds.length) throw new Error(`EA1C_PREVIOUSLY_OBSERVED_ENDPOINTS_MISSING:${missingIds.join(',')}`);
  const nonJson = requiredIds.filter((id) => endpointEvidence.get(id)?.parse_status !== 'JSON_PARSED');
  if (nonJson.length) throw new Error(`EA1C_REQUIRED_ENDPOINTS_NOT_JSON:${nonJson.join(',')}`);

  const endpoints = requiredIds.map((id) => endpointEvidence.get(id));
  const result = {
    schema_version: 'geox_mcft_cap09_ea1c_kbs_json_source_map_probe_result_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    source_url: config.source_url,
    retrieved_at: retrievedAt,
    observed_endpoint_ids: observedIds,
    required_endpoint_ids: requiredIds,
    all_required_endpoints_observed: true,
    endpoints,
    mapping_status: 'SCHEMA_AND_APPROVED_METADATA_CAPTURED_MAPPING_NOT_YET_FORMAL_AUTHORITY',
    raw_json_body_persisted: false,
    raw_numeric_sensor_values_emitted: false,
    rendered_dom_persisted: false,
    database_connection_opened: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    qualified_formal_site: false,
    formal_window_started: false,
  };
  writeResult(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_ea1c_kbs_json_source_map_probe_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA,
    source_url: config.source_url,
    retrieved_at: retrievedAt,
    error: safeError(error),
    observed_endpoint_ids: [...endpointEvidence.keys()].sort((a, b) => a - b),
    raw_json_body_persisted: false,
    raw_numeric_sensor_values_emitted: false,
    rendered_dom_persisted: false,
    database_connection_opened: false,
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
