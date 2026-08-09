#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-OBSERVED-MET-MODEL-API-DISCOVERY-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_OBSERVED_MET_MODEL_API_DISCOVERY_RESULT.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null;
const MAX_RESPONSES = 160;
const MAX_SCHEMA_PATHS = 240;
const MAX_ARRAY_SHAPES = 100;

function sha256(input) {
  return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
}
function writeResult(value) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9%/+.-]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function safeError(error) {
  return error instanceof Error ? error.message.replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]') : String(error);
}
function safeRequestIdentity(request) {
  const parsed = new URL(request.url());
  return {
    host: parsed.hostname,
    path: parsed.pathname,
    method: request.method(),
    query_key_names: [...new Set([...parsed.searchParams.keys()])].sort(),
    query_values_emitted: false,
    authorization_header_present: Object.keys(request.headers()).some((key) => key.toLowerCase() === 'authorization'),
    canonical_request_identity_sha256: sha256(`${request.method()} ${request.url()}`),
  };
}
function maybeTimestamp(value, parentKey) {
  if (!/(time|date|updated|observed|timestamp|issued|valid)/i.test(parentKey)) return null;
  if (typeof value === 'string') {
    const parsed = Date.parse(value.trim());
    if (Number.isFinite(parsed) && parsed >= Date.UTC(2000, 0, 1) && parsed <= Date.now() + 8 * 86_400_000) return parsed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    for (const parsed of [value, value * 1000]) {
      if (parsed >= Date.UTC(2000, 0, 1) && parsed <= Date.now() + 8 * 86_400_000) return parsed;
    }
  }
  return null;
}
function schemaSummary(json) {
  const paths = new Set();
  const shapes = new Set();
  const tokens = new Set();
  const timestamps = [];
  let numericLeafCount = 0;
  const lexicon = config.approved_metadata_lexicon.map(normalize);

  function scan(value, pathParts, parentKey = '') {
    const pathText = pathParts.join('.') || '$';
    if (Array.isArray(value)) {
      const first = value[0];
      const kind = Array.isArray(first) ? `array:${first.length}` : first === null ? 'null' : typeof first;
      if (shapes.size < MAX_ARRAY_SHAPES) shapes.add(`${pathText}|len=${value.length}|item=${kind}`);
      for (let index = 0; index < Math.min(value.length, 60); index += 1) scan(value[index], [...pathParts, '[]'], parentKey);
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
    if (typeof value === 'number' && Number.isFinite(value)) numericLeafCount += 1;
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
    numeric_leaf_count_detected: numericLeafCount,
    raw_numeric_observation_values_emitted: false,
    unfiltered_string_values_emitted: false,
  };
}
function capabilitySignals(responses) {
  const corpus = responses.flatMap((entry) => [entry.request.path, ...(entry.schema?.schema_key_paths || []), ...(entry.schema?.approved_metadata_tokens || [])]).map(normalize).join(' ');
  const detect = (patterns) => patterns.some((pattern) => corpus.includes(normalize(pattern)));
  return {
    solar_radiation_signal_present: detect(config.capability_patterns.solar_radiation),
    rainfall_signal_present: detect(config.capability_patterns.rainfall),
    station_identity_signal_present: detect(config.capability_patterns.station_identity),
    observation_time_signal_present: detect(config.capability_patterns.observation_time),
  };
}

function observationCandidate(entry) {
  if (!entry.schema || entry.response_status < 200 || entry.response_status >= 300) return false;
  if (config.metadata_only_paths.includes(entry.request.path)) return false;
  const tokens = new Set(entry.schema.approved_metadata_tokens || []);
  const weatherSignal = config.capability_patterns.solar_radiation.some((token) => tokens.has(normalize(token)))
    || config.capability_patterns.rainfall.some((token) => tokens.has(normalize(token)))
    || config.capability_patterns.temperature.some((token) => tokens.has(normalize(token)))
    || config.capability_patterns.humidity.some((token) => tokens.has(normalize(token)))
    || config.capability_patterns.wind.some((token) => tokens.has(normalize(token)));
  return weatherSignal && entry.schema.numeric_leaf_count_detected > 0;
}

async function selectKbsAndSubmit(page, pageConfig) {
  await page.waitForTimeout(1500);
  const selects = page.locator('select');
  const count = await selects.count();
  let stationSelected = false;
  for (let index = 0; index < count; index += 1) {
    const select = selects.nth(index);
    const options = await select.locator('option').evaluateAll((nodes) => nodes.map((node) => ({ value: node.value, text: node.textContent || '' })));
    const option = options.find((item) => item.value === pageConfig.station_slug)
      || options.find((item) => item.text.toLowerCase().includes(pageConfig.station_label.toLowerCase()));
    if (!option) continue;
    await select.selectOption(option.value);
    stationSelected = true;
    break;
  }
  if (!stationSelected) throw new Error(`OBSERVED_MET_STATION_OPTION_NOT_FOUND:${pageConfig.id}`);
  await page.waitForTimeout(1800);
  const submit = page.getByRole('button', { name: /submit/i }).first();
  if (await submit.count()) {
    await submit.click();
    await page.waitForTimeout(6500);
  }
  return { station_selected: true, submit_attempted: (await submit.count()) > 0 };
}

let browser;
try {
  if (!SUBJECT_SHA || !/^[0-9a-f]{40}$/.test(SUBJECT_SHA)) throw new Error('OBSERVED_MET_EXACT_SUBJECT_SHA_REQUIRED');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'en-US', timezoneId: 'UTC' });
  const pageResults = [];
  const allResponses = [];

  for (const pageConfig of config.discovery_pages) {
    const page = await context.newPage();
    const evidence = new Map();
    const responseTasks = [];
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
        let parsedJson;
        let parseStatus = 'JSON_PARSED';
        try { parsedJson = JSON.parse(body.toString('utf8')); }
        catch { parseStatus = 'JSON_CONTENT_TYPE_NON_JSON_BODY'; }
        evidence.set(identityKey, {
          request: requestIdentity,
          response_status: response.status(),
          content_type: contentType.split(';')[0],
          response_body_sha256: sha256(body),
          response_bytes: body.byteLength,
          parse_status: parseStatus,
          schema: parseStatus === 'JSON_PARSED' ? schemaSummary(parsedJson) : null,
          raw_json_body_persisted: false,
          raw_numeric_observation_values_emitted: false,
        });
      })();
      responseTasks.push(task);
    });

    const response = await page.goto(pageConfig.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    if (!response || response.status() < 200 || response.status() >= 400) throw new Error(`OBSERVED_MET_SOURCE_PAGE_FAILED:${pageConfig.id}`);
    await page.waitForFunction((text) => (document.body?.innerText || '').toLowerCase().includes(String(text).toLowerCase()), pageConfig.expected_text, { timeout: 60_000 });
    const interaction = await selectKbsAndSubmit(page, pageConfig);
    await Promise.allSettled(responseTasks);
    const responses = [...evidence.values()].sort((left, right) => `${left.request.host}${left.request.path}`.localeCompare(`${right.request.host}${right.request.path}`));
    const candidates = responses.filter(observationCandidate).map((entry) => ({
      host: entry.request.host,
      path: entry.request.path,
      method: entry.request.method,
      query_key_names: entry.request.query_key_names,
      authorization_header_present: entry.request.authorization_header_present,
      response_status: entry.response_status,
      response_body_sha256: entry.response_body_sha256,
      response_bytes: entry.response_bytes,
      schema: entry.schema,
    }));
    pageResults.push({
      id: pageConfig.id,
      source_page: pageConfig.url,
      interaction,
      official_json_response_count: responses.length,
      capability_signals: capabilitySignals(responses),
      observation_candidate_count: candidates.length,
      observation_candidates: candidates,
    });
    allResponses.push(...responses);
    await page.close();
  }

  const result = {
    schema_version: 'geox_mcft_cap09_observed_met_model_api_discovery_result_v1',
    status: 'PASS',
    subject_sha: SUBJECT_SHA,
    retrieved_at: new Date().toISOString(),
    page_results: pageResults,
    aggregate_capability_signals: capabilitySignals(allResponses),
    total_observation_candidate_count: pageResults.reduce((sum, item) => sum + item.observation_candidate_count, 0),
    discovery_creates_source_authority: false,
    observed_solar_authority_created: false,
    observed_rain_authority_created: false,
    query_values_emitted: false,
    raw_numeric_observation_values_emitted: false,
    raw_json_body_persisted: false,
    rendered_dom_persisted: false,
    database_write_count: 0,
    formal_evidence_write_count: 0,
    formal_window_started: false,
    mcft_cap09_completed: false,
  };
  writeResult(result);
  console.log(JSON.stringify({ status: result.status, pages: pageResults.map((p) => ({ id: p.id, responses: p.official_json_response_count, candidates: p.observation_candidate_count, signals: p.capability_signals })), aggregate: result.aggregate_capability_signals }, null, 2));
} catch (error) {
  const result = {
    schema_version: 'geox_mcft_cap09_observed_met_model_api_discovery_result_v1',
    status: 'FAIL',
    subject_sha: SUBJECT_SHA,
    retrieved_at: new Date().toISOString(),
    error: safeError(error),
    discovery_creates_source_authority: false,
    raw_numeric_observation_values_emitted: false,
    raw_json_body_persisted: false,
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
