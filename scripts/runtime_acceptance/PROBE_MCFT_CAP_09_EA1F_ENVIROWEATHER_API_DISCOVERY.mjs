#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1F-ENVIROWEATHER-API-DISCOVERY-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1F_ENVIROWEATHER_API_DISCOVERY_RESULT.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null;
const MAX_RESPONSES = 100;
const MAX_SCHEMA_PATHS = 180;
const MAX_ARRAY_SHAPES = 80;

function sha256(input) {
  return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
}
function writeResult(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function safeError(error) {
  return error instanceof Error ? error.message.replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]') : String(error);
}
function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9%/+.-]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function safeRequestIdentity(request) {
  const parsed = new URL(request.url());
  const queryKeys = [...new Set([...parsed.searchParams.keys()])].sort();
  return {
    host: parsed.hostname,
    path: parsed.pathname,
    method: request.method(),
    query_key_names: queryKeys,
    query_values_emitted: false,
    authorization_header_present: Object.keys(request.headers()).some((key) => key.toLowerCase() === 'authorization'),
    canonical_request_identity_sha256: sha256(`${request.method()} ${request.url()}`),
  };
}
function maybeTimestamp(value, parentKey) {
  if (!/(time|date|updated|observed|timestamp)/i.test(parentKey)) return null;
  if (typeof value === 'string') {
    const parsed = Date.parse(value.trim());
    if (Number.isFinite(parsed) && parsed >= Date.UTC(2000, 0, 1) && parsed <= Date.now() + 86_400_000) return parsed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    for (const parsed of [value, value * 1000]) {
      if (parsed >= Date.UTC(2000, 0, 1) && parsed <= Date.now() + 86_400_000) return parsed;
    }
  }
  return null;
}
function schemaSummary(json) {
  const paths = new Set();
  const shapes = new Set();
  const tokens = new Set();
  const timestamps = [];
  const lexicon = config.approved_metadata_lexicon.map(normalize);

  function scan(value, pathParts, parentKey = '') {
    const pathText = pathParts.join('.') || '$';
    if (Array.isArray(value)) {
      const first = value[0];
      const kind = Array.isArray(first) ? `array:${first.length}` : first === null ? 'null' : typeof first;
      if (shapes.size < MAX_ARRAY_SHAPES) shapes.add(`${pathText}|len=${value.length}|item=${kind}`);
      for (let index = 0; index < Math.min(value.length, 40); index += 1) scan(value[index], [...pathParts, '[]'], parentKey);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        const next = [...pathParts, key];
        if (paths.size < MAX_SCHEMA_PATHS) paths.add(next.join('.'));
        const normalizedKey = normalize(key);
        for (const token of lexicon) if (normalizedKey.includes(token)) tokens.add(token);
        scan(child, next, key);
      }
      return;
    }
    if (typeof value === 'string') {
      const normalizedValue = normalize(value);
      for (const token of lexicon) if (normalizedValue === token || normalizedValue.includes(token)) tokens.add(token);
    }
    const timestamp = maybeTimestamp(value, parentKey);
    if (timestamp !== null) timestamps.push(timestamp);
  }

  scan(json, []);
  const uniqueTimes = [...new Set(timestamps)].sort((a, b) => a - b);
  return {
    root_kind: Array.isArray(json) ? 'array' : json === null ? 'null' : typeof json,
    schema_key_paths: [...paths].sort(),
    array_shapes: [...shapes].sort(),
    approved_metadata_tokens: [...tokens].sort(),
    timestamp_count_detected: uniqueTimes.length,
    earliest_timestamp_detected: uniqueTimes.length ? new Date(uniqueTimes[0]).toISOString() : null,
    latest_timestamp_detected: uniqueTimes.length ? new Date(uniqueTimes.at(-1)).toISOString() : null,
    raw_numeric_observation_values_emitted: false,
    unfiltered_string_values_emitted: false,
  };
}
function capabilitySignals(responses) {
  const corpus = responses.flatMap((entry) => [
    entry.request.path,
    ...(entry.schema?.schema_key_paths || []),
    ...(entry.schema?.approved_metadata_tokens || []),
  ]).map(normalize).join(' ');
  const detect = (patterns) => patterns.some((pattern) => corpus.includes(normalize(pattern)));
  return {
    solar_radiation_signal_present: detect(config.capability_patterns.solar_radiation),
    rainfall_signal_present: detect(config.capability_patterns.rainfall),
    station_identity_signal_present: detect(config.capability_patterns.station_identity),
  };
}

let browser;
const responseTasks = [];
const evidence = new Map();
try {
  if (!SUBJECT_SHA || !/^[0-9a-f]{40}$/.test(SUBJECT_SHA)) throw new Error('EA1F_EXACT_SUBJECT_SHA_REQUIRED');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'en-US', timezoneId: 'UTC' });
  const page = await context.newPage();

  page.on('response', (response) => {
    const request = response.request();
    let parsed;
    try { parsed = new URL(response.url()); } catch { return; }
    if (!config.allowed_response_hosts.includes(parsed.hostname)) return;
    const contentType = String(response.headers()['content-type'] || '').toLowerCase();
    if (!contentType.includes('json')) return;

    const task = (async () => {
      const requestIdentity = safeRequestIdentity(request);
      const identityKey = `${requestIdentity.host}|${requestIdentity.path}|${requestIdentity.method}|${requestIdentity.query_key_names.join(',')}`;
      if (!evidence.has(identityKey) && evidence.size >= MAX_RESPONSES) return;
      const body = await response.body();
      let json;
      let parseStatus = 'JSON_PARSED';
      try { json = JSON.parse(body.toString('utf8')); }
      catch { parseStatus = 'JSON_CONTENT_TYPE_NON_JSON_BODY'; }
      evidence.set(identityKey, {
        request: requestIdentity,
        response_status: response.status(),
        content_type: contentType.split(';')[0],
        response_body_sha256: sha256(body),
        response_bytes: body.byteLength,
        parse_status: parseStatus,
        schema: parseStatus === 'JSON_PARSED' ? schemaSummary(json) : null,
        raw_json_body_persisted: false,
        raw_numeric_observation_values_emitted: false,
      });
    })();
    responseTasks.push(task);
  });

  const response = await page.goto(config.source_page, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (!response || response.status() < 200 || response.status() >= 400) throw new Error('EA1F_SOURCE_PAGE_FAILED');
  await page.waitForFunction(
    (label) => (document.body?.innerText || '').toLowerCase().includes(String(label).toLowerCase()),
    config.expected_station_label,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(8_000);
  await Promise.allSettled(responseTasks);
  await context.close();

  const responses = [...evidence.values()].sort((left, right) => {
    const a = `${left.request.host}${left.request.path}${left.request.method}`;
    const b = `${right.request.host}${right.request.path}${right.request.method}`;
    return a.localeCompare(b);
  });
  if (!responses.length) throw new Error('EA1F_NO_OFFICIAL_JSON_API_RESPONSES_OBSERVED');
  const apiHostResponses = responses.filter((entry) => entry.request.host === 'api.enviroweather.msu.edu');
  if (!apiHostResponses.length) throw new Error('EA1F_NO_ENVIROWEATHER_API_HOST_JSON_RESPONSE');

  const capabilities = capabilitySignals(responses);
  const result = {
    schema_version: 'geox_mcft_cap09_ea1f_enviroweather_api_discovery_result_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    source_page: config.source_page,
    station_slug: config.expected_station_slug,
    retrieved_at: new Date().toISOString(),
    official_json_response_count: responses.length,
    api_host_json_response_count: apiHostResponses.length,
    responses,
    capability_signals: capabilities,
    discovery_creates_formal_source_authority: false,
    qualified_formal_site: false,
    query_values_emitted: false,
    raw_numeric_observation_values_emitted: false,
    raw_json_body_persisted: false,
    rendered_dom_persisted: false,
    unfiltered_string_values_emitted: false,
    database_connection_opened: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    formal_window_started: false,
  };
  writeResult(result);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const responses = [...evidence.values()];
  const result = {
    schema_version: 'geox_mcft_cap09_ea1f_enviroweather_api_discovery_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA,
    source_page: config.source_page,
    error: safeError(error),
    retrieved_at: new Date().toISOString(),
    response_count_before_failure: responses.length,
    capability_signals_before_failure: capabilitySignals(responses),
    query_values_emitted: false,
    raw_numeric_observation_values_emitted: false,
    raw_json_body_persisted: false,
    rendered_dom_persisted: false,
    unfiltered_string_values_emitted: false,
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
