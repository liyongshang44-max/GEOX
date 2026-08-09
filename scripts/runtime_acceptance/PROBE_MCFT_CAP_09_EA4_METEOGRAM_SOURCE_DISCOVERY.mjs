#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-METEOGRAM-SOURCE-DISCOVERY-V1.json'), 'utf8'));
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA4_METEOGRAM_SOURCE_DISCOVERY_RESULT.json');
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || '';
const MAX_RESPONSES = 140;
const MAX_PATHS = 320;
const sha256 = (input) => `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9%/+.-]+/g, ' ').replace(/\s+/g, ' ').trim();
const writeResult = (value) => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); };

function directUrl() {
  const now = new Date();
  const date = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}`;
  const url = new URL(CONFIG.source_page);
  url.searchParams.set('duration', String(CONFIG.duration_hours));
  url.searchParams.set('run', '1');
  url.searchParams.set('selectDate', date);
  url.searchParams.set('selectedStation', CONFIG.target_station_slug);
  url.searchParams.set('units', CONFIG.units_mode);
  return url.toString();
}
function requestIdentity(request) {
  const url = new URL(request.url());
  const keys = [...new Set([...url.searchParams.keys()])].sort();
  return {
    host: url.hostname,
    path: url.pathname,
    method: request.method(),
    query_key_names: keys,
    query_value_presence: Object.fromEntries(keys.map((key) => [key, (url.searchParams.get(key) || '').trim() ? 'NONEMPTY' : 'EMPTY'])),
    query_values_emitted: false,
    authorization_header_present: Object.keys(request.headers()).some((key) => key.toLowerCase() === 'authorization'),
    canonical_request_identity_sha256: sha256(`${request.method()} ${request.url()}`),
  };
}
function maybeTime(value, key) {
  if (!/(time|date|timestamp|valid|issue|observ)/i.test(key)) return null;
  if (typeof value === 'string') {
    const ms = Date.parse(value.trim());
    if (Number.isFinite(ms) && ms >= Date.UTC(2000,0,1) && ms <= Date.now() + 10*86400000) return ms;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    for (const ms of [value, value*1000]) if (ms >= Date.UTC(2000,0,1) && ms <= Date.now() + 10*86400000) return ms;
  }
  return null;
}
function schemaSummary(json) {
  const paths = new Set(), tokens = new Set(), shapes = new Set(), times = [];
  const lexicon = CONFIG.approved_metadata_lexicon.map(normalize);
  const addTokens = (text) => { const n = normalize(text); for (const token of lexicon) if (n.includes(token)) tokens.add(token); };
  function scan(value, parts, parent = '', depth = 0) {
    if (depth > 14) return;
    const p = parts.join('.') || '$';
    if (Array.isArray(value)) {
      const first = value[0];
      const kind = Array.isArray(first) ? `array:${first.length}` : first === null ? 'null' : typeof first;
      shapes.add(`${p}|len=${value.length}|item=${kind}`);
      for (let i=0; i<Math.min(value.length,80); i+=1) scan(value[i], [...parts,'[]'], parent, depth+1);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        const next = [...parts,key];
        if (paths.size < MAX_PATHS) paths.add(next.join('.'));
        addTokens(key);
        scan(child, next, key, depth+1);
      }
      return;
    }
    if (typeof value === 'string') {
      addTokens(value);
      const trimmed = value.trim();
      if (trimmed.length > 1 && trimmed.length < 5_000_000 && /^[\[{]/.test(trimmed)) {
        try { paths.add(`${p}.<embedded_json>`); scan(JSON.parse(trimmed), [...parts,'<embedded_json>'], parent, depth+1); } catch {}
      }
      if (/<(?:table|tr|th|td)\b/i.test(value)) { paths.add(`${p}.<embedded_html_table>`); addTokens(value.replace(/<[^>]+>/g,' ')); }
    }
    const t = maybeTime(value, parent); if (t !== null) times.push(t);
  }
  scan(json, []);
  const unique = [...new Set(times)].sort((a,b)=>a-b);
  return {
    root_kind: Array.isArray(json) ? 'array' : json === null ? 'null' : typeof json,
    schema_key_paths: [...paths].sort(),
    array_shapes: [...shapes].sort(),
    approved_metadata_tokens: [...tokens].sort(),
    timestamp_count_detected: unique.length,
    earliest_timestamp_detected: unique.length ? new Date(unique[0]).toISOString() : null,
    latest_timestamp_detected: unique.length ? new Date(unique.at(-1)).toISOString() : null,
    raw_numeric_observation_values_emitted: false,
    unfiltered_string_values_emitted: false,
  };
}
function signals(entry) {
  const corpus = normalize([entry.request.path, ...(entry.schema?.schema_key_paths || []), ...(entry.schema?.approved_metadata_tokens || [])].join(' '));
  const has = (patterns) => patterns.some((x) => corpus.includes(normalize(x)));
  return {
    rainfall: has(CONFIG.capability_patterns.rainfall),
    solar_radiation: has(CONFIG.capability_patterns.solar_radiation),
    station_identity: has(CONFIG.capability_patterns.station_identity),
    forecast: has(CONFIG.capability_patterns.forecast),
    observed: has(CONFIG.capability_patterns.observed),
    hourly: has(CONFIG.capability_patterns.hourly),
    subhourly: has(CONFIG.capability_patterns.subhourly),
  };
}

let browser;
const tasks = [];
const evidence = new Map();
try {
  if (!/^[0-9a-f]{40}$/.test(SUBJECT_SHA)) throw new Error('EA4MG_EXACT_SUBJECT_SHA_REQUIRED');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'en-US', timezoneId: 'UTC', acceptDownloads: false });
  const page = await context.newPage();
  page.on('response', (response) => {
    let parsed; try { parsed = new URL(response.url()); } catch { return; }
    if (!CONFIG.allowed_response_hosts.includes(parsed.hostname)) return;
    const contentType = String(response.headers()['content-type'] || '').toLowerCase();
    if (!contentType.includes('json')) return;
    const task = (async () => {
      const req = requestIdentity(response.request());
      const key = `${req.host}|${req.path}|${req.method}|${req.query_key_names.join(',')}`;
      if (!evidence.has(key) && evidence.size >= MAX_RESPONSES) return;
      const body = await response.body();
      let schema = null, parse_status = 'JSON_CONTENT_TYPE_NON_JSON_BODY';
      try { schema = schemaSummary(JSON.parse(body.toString('utf8'))); parse_status = 'JSON_PARSED'; } catch {}
      const entry = { request: req, response_status: response.status(), content_type: contentType.split(';')[0], response_body_sha256: sha256(body), response_bytes: body.length, parse_status, schema, raw_body_persisted:false, raw_numeric_observation_values_emitted:false };
      entry.capability_signals = signals(entry);
      evidence.set(key, entry);
    })();
    tasks.push(task);
  });
  const response = await page.goto(directUrl(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (!response || response.status() < 200 || response.status() >= 400) throw new Error('EA4MG_SOURCE_PAGE_FAILED');
  await page.waitForFunction(() => (document.body?.innerText || '').toLowerCase().includes('meteogram'), null, { timeout: 60_000 });
  await page.waitForTimeout(15_000);
  await Promise.allSettled(tasks);
  const responses = [...evidence.values()].sort((a,b)=>`${a.request.host}|${a.request.path}`.localeCompare(`${b.request.host}|${b.request.path}`));
  const api = responses.filter((x)=>x.request.host === 'api.enviroweather.msu.edu');
  if (!api.length) throw new Error('EA4MG_NO_ENVIROWEATHER_API_RESPONSE');
  const rainfall = api.filter((x)=>x.capability_signals.rainfall);
  const solar = api.filter((x)=>x.capability_signals.solar_radiation);
  const result = {
    schema_version:'geox_mcft_cap09_ea4_meteogram_source_discovery_result_v1', status:'PASS', subject_sha:SUBJECT_SHA,
    source_page:CONFIG.source_page, target_station_slug:CONFIG.target_station_slug, duration_hours:CONFIG.duration_hours, retrieved_at:new Date().toISOString(),
    official_json_response_count:responses.length, api_host_json_response_count:api.length, responses,
    capability_summary:{
      rainfall_candidate_endpoint_count:rainfall.length,
      solar_candidate_endpoint_count:solar.length,
      rainfall_signal_present:rainfall.length>0,
      solar_signal_present:solar.length>0,
      observed_signal_present:api.some((x)=>x.capability_signals.observed),
      forecast_signal_present:api.some((x)=>x.capability_signals.forecast),
      hourly_signal_present:api.some((x)=>x.capability_signals.hourly),
      subhourly_signal_present:api.some((x)=>x.capability_signals.subhourly),
    },
    discovery_creates_formal_source_authority:false, rainfall_qualified:false, solar_radiation_qualified:false,
    query_values_emitted:false, raw_numeric_observation_values_emitted:false, raw_json_body_persisted:false, rendered_dom_persisted:false,
    download_clicked:false, database_write_count:0, formal_evidence_write_count:0, formal_window_started:false, ea5_authorized:false,
  };
  writeResult(result);
  console.log(JSON.stringify({status:'PASS',api_host_json_response_count:api.length,capability_summary:result.capability_summary},null,2));
  await context.close();
} catch (error) {
  writeResult({schema_version:'geox_mcft_cap09_ea4_meteogram_source_discovery_result_v1',status:'FAIL',subject_sha:SUBJECT_SHA,error:error instanceof Error?error.message:String(error),query_values_emitted:false,raw_numeric_observation_values_emitted:false,raw_json_body_persisted:false,database_write_count:0,formal_evidence_write_count:0,formal_window_started:false});
  console.error(`EA4MG_FAIL:${error instanceof Error?error.message:String(error)}`);
  process.exitCode=1;
} finally { await browser?.close(); }
