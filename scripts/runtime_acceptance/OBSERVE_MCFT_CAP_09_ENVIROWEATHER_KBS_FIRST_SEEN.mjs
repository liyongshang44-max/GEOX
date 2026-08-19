#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-ENVIROWEATHER-KBS-FIRST-SEEN-OBSERVER-V1.json');
const OUTPUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_ENVIROWEATHER_KBS_FIRST_SEEN_OBSERVER_RESULT.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const subject = String(process.env.MCFT_SUBJECT_SHA || '').trim();

function requireTrue(value, code) { if (!value) throw new Error(code); }
function sha256(value) { return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`; }
function isoNow() { return new Date().toISOString(); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function normalize(value) { return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function canonicalIso(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    for (const n of [value, value * 1000]) {
      const d = new Date(n);
      if (Number.isFinite(d.getTime()) && d.getUTCFullYear() >= 2000 && d.getTime() <= Date.now() + 86_400_000) return d.toISOString();
    }
    return null;
  }
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value.trim());
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  if (d.getUTCFullYear() < 2000 || ms > Date.now() + 86_400_000) return null;
  return d.toISOString();
}
function safeError(error) {
  return (error instanceof Error ? error.message : String(error))
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]');
}
function write(value) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
}

function walk(value, visit, pathParts = []) {
  visit(value, pathParts);
  if (Array.isArray(value)) {
    value.slice(0, 200).forEach((child, i) => walk(child, visit, [...pathParts, String(i)]));
  } else if (value && typeof value === 'object') {
    Object.entries(value).slice(0, 400).forEach(([key, child]) => walk(child, visit, [...pathParts, key]));
  }
}

function stationScopeFromJson(json) {
  let match = false;
  walk(json, (value) => {
    if (typeof value !== 'string') return;
    const n = normalize(value);
    if (n === normalize(config.station_slug) || n.includes(normalize(config.station_label))) match = true;
  });
  return match;
}

function weatherTokensFromJson(json) {
  const found = new Set();
  const approved = config.weather_metadata_tokens.map(normalize);
  walk(json, (value, parts) => {
    const key = normalize(parts.at(-1) || '');
    for (const token of approved) if (key.includes(token)) found.add(token);
    if (typeof value === 'string') {
      const v = normalize(value);
      for (const token of approved) if (v === token || v.includes(token)) found.add(token);
    }
  });
  return [...found].sort();
}

function timestampsFromJson(json) {
  const out = new Map();
  const tokens = config.event_time_key_tokens.map(normalize);
  walk(json, (value, parts) => {
    const key = normalize(parts.at(-1) || '');
    if (!tokens.some((token) => key.includes(token))) return;
    const timestamp = canonicalIso(value);
    if (!timestamp) return;
    const safePath = parts.map((part) => /^\d+$/.test(part) ? '[]' : part).join('.');
    out.set(`${safePath}|${timestamp}`, { path: safePath, timestamp });
  });
  return [...out.values()]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.path.localeCompare(b.path))
    .slice(-config.watch.maximum_timestamp_values_per_response);
}

function requestIdentity(request) {
  const url = new URL(request.url());
  return {
    host: url.hostname,
    path: url.pathname,
    method: request.method(),
    query_key_names: [...new Set(url.searchParams.keys())].sort(),
    exact_station_slug_match: url.pathname.toLowerCase().includes(`/${config.station_slug.toLowerCase()}`)
      || [...url.searchParams.values()].some((value) => normalize(value) === normalize(config.station_slug)),
    query_values_emitted: false,
    authorization_header_present: Object.keys(request.headers()).some((key) => key.toLowerCase() === 'authorization'),
  };
}

function candidateProfile(request, body, json) {
  const identity = requestIdentity(request);
  const weatherTokens = weatherTokensFromJson(json);
  const timestamps = timestampsFromJson(json);
  const stationScope = identity.exact_station_slug_match || stationScopeFromJson(json);
  const selected = stationScope && weatherTokens.length > 0 && timestamps.length > 0;
  return {
    selected,
    request: identity,
    station_scope_match: stationScope,
    weather_metadata_tokens: weatherTokens,
    timestamps,
    response_sha256: sha256(body),
    response_bytes: body.byteLength,
    raw_numeric_observation_values_emitted: false,
    raw_json_body_persisted: false,
  };
}

function stationSummary(candidate) {
  const allow = /^(id|stationid|station_id|code|stationcode|station_code|name|label|latitude|lat|longitude|lon|lng|elevation|network|startdate|start_date|enddate|end_date)$/i;
  const out = {};
  for (const [key, value] of Object.entries(candidate || {})) {
    if (!allow.test(key)) continue;
    if (['string', 'number', 'boolean'].includes(typeof value) || value === null) out[key] = value;
  }
  return out;
}

function findStationCandidates(json) {
  const found = [];
  walk(json, (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const values = Object.values(value).filter((v) => typeof v === 'string').map(normalize);
    if (values.some((v) => v === normalize(config.station_slug) || v.includes(normalize(config.station_label)))) found.push(value);
  });
  return found;
}

async function officialStationIdentity() {
  const api = new URL(config.official_api.base_url);
  requireTrue(api.protocol === 'https:' && api.hostname === 'api.enviroweather.msu.edu', 'EWX_OBSERVER_API_BASE_REQUIRED');
  const tokenUrl = new URL(config.official_api.site_token_path, `${api.toString().replace(/\/$/, '')}/`);
  const tokenResponse = await fetch(tokenUrl, { headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(30_000) });
  requireTrue(tokenResponse.ok, `EWX_OBSERVER_SITE_TOKEN_HTTP_${tokenResponse.status}`);
  const tokenJson = await tokenResponse.json();
  const token = String(tokenJson?.data?.token || '');
  requireTrue(token.length > 20, 'EWX_OBSERVER_SITE_TOKEN_REQUIRED');

  const stationUrl = new URL(config.official_api.station_list_path, `${api.toString().replace(/\/$/, '')}/`);
  const stationResponse = await fetch(stationUrl, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(30_000),
  });
  requireTrue(stationResponse.ok, `EWX_OBSERVER_STATION_LIST_HTTP_${stationResponse.status}`);
  const stationJson = await stationResponse.json();
  const matches = findStationCandidates(stationJson);
  requireTrue(matches.length >= 1, 'EWX_OBSERVER_KBS_STATION_IDENTITY_NOT_FOUND');
  return {
    status: 'PASS',
    exact_match_count: matches.length,
    selected_station_metadata: stationSummary(matches[0]),
    source_endpoint_path: stationUrl.pathname,
    source_query_keys: [...stationUrl.searchParams.keys()].sort(),
    token_persisted: false,
    token_emitted: false,
    raw_station_list_persisted: false,
  };
}

async function pollStationPage(browser, pollIndex) {
  const context = await browser.newContext({ locale: 'en-US', timezoneId: 'UTC' });
  const page = await context.newPage();
  const tasks = [];
  const profiles = [];
  page.on('response', (response) => {
    let url;
    try { url = new URL(response.url()); } catch { return; }
    if (!config.allowed_response_hosts.includes(url.hostname)) return;
    const contentType = String(response.headers()['content-type'] || '').toLowerCase();
    if (!contentType.includes('json')) return;
    const task = (async () => {
      const body = await response.body();
      let json;
      try { json = JSON.parse(body.toString('utf8')); } catch { return; }
      const profile = candidateProfile(response.request(), body, json);
      if (profile.selected && profiles.length < config.watch.maximum_candidate_responses_per_poll) profiles.push(profile);
    })();
    tasks.push(task);
  });

  const startedAt = isoNow();
  try {
    const response = await page.goto(config.source_page, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    requireTrue(response && response.status() >= 200 && response.status() < 400, 'EWX_OBSERVER_STATION_PAGE_HTTP_REQUIRED');
    await page.waitForFunction(
      (label) => (document.body?.innerText || '').toLowerCase().includes(String(label).toLowerCase()),
      config.station_label,
      { timeout: 60_000 },
    );
    await page.waitForTimeout(config.watch.page_response_settle_seconds * 1000);
    await Promise.allSettled(tasks);
  } finally {
    await context.close();
  }

  const timestampSet = new Set();
  for (const profile of profiles) for (const item of profile.timestamps) timestampSet.add(item.timestamp);
  const eventTimes = [...timestampSet].sort();
  return {
    poll_index: pollIndex,
    polled_at: isoNow(),
    poll_started_at: startedAt,
    candidate_response_count: profiles.length,
    latest_candidate_timestamp: eventTimes.at(-1) || null,
    candidate_timestamps: eventTimes.slice(-120),
    candidates: profiles,
    raw_numeric_observation_values_emitted: false,
  };
}

function classify(transitions, anyCandidate) {
  if (!anyCandidate) return 'NO_STATION_OBSERVATION_SURFACE_DISCOVERED';
  if (transitions.length < 2) return 'INSUFFICIENT_FIRST_SEEN_TRANSITIONS';
  const eventDeltas = [];
  for (let i = 1; i < transitions.length; i += 1) {
    eventDeltas.push((Date.parse(transitions[i].event_time) - Date.parse(transitions[i - 1].event_time)) / 60_000);
  }
  const around30 = eventDeltas.length > 0 && eventDeltas.every((n) => n >= 20 && n <= 40);
  return around30 ? 'OBSERVED_30_MINUTE_CLASS_CANDIDATE_NOT_AUTHORITY' : 'OBSERVED_PUBLICATION_TRANSITIONS_NON_30_MINUTE_OR_MIXED';
}

async function main() {
  requireTrue(/^[0-9a-f]{40}$/.test(subject), 'EWX_OBSERVER_EXACT_SUBJECT_SHA_REQUIRED');
  const stationIdentity = await officialStationIdentity();
  const startedAt = isoNow();
  const deadline = Date.now() + config.watch.maximum_minutes * 60_000;
  const polls = [];
  const transitions = [];
  let previous = null;
  let anyCandidate = false;
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    for (let index = 0; Date.now() < deadline; index += 1) {
      const current = await pollStationPage(browser, index);
      polls.push(current);
      anyCandidate ||= current.candidate_response_count > 0;
      if (previous) {
        const previousTimes = new Set(previous.candidate_timestamps);
        const previousFrontier = previous.latest_candidate_timestamp;
        const forward = current.candidate_timestamps.filter((event) => !previousTimes.has(event) && (!previousFrontier || event > previousFrontier));
        for (const eventTime of forward) {
          transitions.push({
            event_time: eventTime,
            last_not_seen_at: previous.polled_at,
            first_seen_at: current.polled_at,
            first_seen_bracket_seconds: Math.max(0, Math.round((Date.parse(current.polled_at) - Date.parse(previous.polled_at)) / 1000)),
            latency_upper_bound_seconds_relative_to_exposed_timestamp: Math.round((Date.parse(current.polled_at) - Date.parse(eventTime)) / 1000),
            event_time_semantics: 'UNADJUDICATED',
          });
        }
      }
      previous = current;
      if (transitions.length >= config.watch.stop_after_forward_transitions) break;
      if (!anyCandidate && polls.length >= config.watch.discovery_grace_polls) break;
      if (Date.now() + config.watch.poll_seconds * 1000 >= deadline) break;
      await sleep(config.watch.poll_seconds * 1000);
    }
  } finally {
    await browser?.close();
  }

  const result = {
    schema_version: 'geox_mcft_cap09_enviroweather_kbs_first_seen_observer_result_v1',
    status: 'PASS',
    qualification_effect: 'NONE',
    subject_sha: subject,
    source_page: config.source_page,
    station_slug: config.station_slug,
    observer_started_at: startedAt,
    observer_completed_at: isoNow(),
    station_identity: stationIdentity,
    poll_count: polls.length,
    candidate_response_observed: anyCandidate,
    forward_first_seen_transition_count: transitions.length,
    transitions,
    publication_classification: classify(transitions, anyCandidate),
    event_time_semantics: 'UNADJUDICATED',
    commercial_use_authorized: 'UNKNOWN',
    nominal_sampling_interval_used_as_publication_authority: false,
    first_seen_clock_source: 'GITHUB_RUNNER_UTC_WALL_CLOCK',
    raw_numeric_observation_values_emitted: false,
    raw_json_body_persisted: false,
    database_connection_opened: false,
    database_write_count: 0,
    runtime_write_count: 0,
    scheduler_write_count: 0,
    formal_write_count: 0,
    runtime_authority_changed: false,
    formal_window_started: false,
    polls,
  };
  write(result);
  console.log(JSON.stringify({
    status: result.status,
    publication_classification: result.publication_classification,
    poll_count: result.poll_count,
    forward_first_seen_transition_count: result.forward_first_seen_transition_count,
    candidate_response_observed: result.candidate_response_observed,
    raw_numeric_observation_values_emitted: false,
  }));
}

main().catch((error) => {
  const result = {
    schema_version: 'geox_mcft_cap09_enviroweather_kbs_first_seen_observer_result_v1',
    status: 'FAIL',
    subject_sha: subject || null,
    error: safeError(error),
    observed_at: isoNow(),
    qualification_effect: 'NONE',
    raw_numeric_observation_values_emitted: false,
    raw_json_body_persisted: false,
    database_write_count: 0,
    runtime_write_count: 0,
    scheduler_write_count: 0,
    formal_write_count: 0,
    runtime_authority_changed: false,
    formal_window_started: false,
  };
  write(result);
  console.error(JSON.stringify(result));
  process.exitCode = 1;
});
