#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const AUTH_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-ENVIROWEATHER-METEOGRAM-SOURCE-QUALIFICATION-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA4_ENVIROWEATHER_METEOGRAM_SOURCE_QUALIFICATION_RESULT.json');
const AUTH = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8'));
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || '';
const PRIVATE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'mcft-cap09-ea4-ew-meteogram-'));
const sha256 = (input) => `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
const write = (value) => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); };
const requireCondition = (ok, code) => { if (!ok) throw new Error(code); };
const normalize = (value) => String(value ?? '').trim();

function directUrl() {
  const now = new Date();
  const date = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}`;
  const url = new URL(AUTH.provider_binding_candidate.source_page);
  url.searchParams.set('duration', String(AUTH.provider_binding_candidate.duration_hours));
  url.searchParams.set('run', '1');
  url.searchParams.set('selectDate', date);
  url.searchParams.set('selectedStation', AUTH.provider_binding_candidate.station_slug);
  url.searchParams.set('units', 'us');
  return url.toString();
}
function finite(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function sourceTimeClass(raw) {
  const value = normalize(raw);
  if (/Z$/i.test(value)) return 'EXPLICIT_Z';
  if (/[+-]\d{2}:?\d{2}$/.test(value)) return 'EXPLICIT_OFFSET';
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(value) || /^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}/.test(value)) return 'NAIVE_DATE_TIME';
  return 'UNKNOWN';
}
function parseExplicitTime(raw) {
  const klass = sourceTimeClass(raw);
  if (!['EXPLICIT_Z','EXPLICIT_OFFSET'].includes(klass)) return null;
  const ms = Date.parse(normalize(raw));
  return Number.isFinite(ms) ? ms : null;
}
function parseNaiveAsUtc(raw) {
  const value = normalize(raw);
  let m = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +(m[6] || 0));
  m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return Date.UTC(+m[3], +m[1]-1, +m[2], +m[4], +m[5], +(m[6] || 0));
  return null;
}
function timezoneOffsetMs(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' }).formatToParts(new Date(utcMs));
  const map = Object.fromEntries(parts.filter((x)=>x.type!=='literal').map((x)=>[x.type,x.value]));
  const asUtc = Date.UTC(+map.year, +map.month-1, +map.day, +map.hour, +map.minute, +map.second);
  return asUtc - utcMs;
}
function parseNaiveDetroit(raw) {
  const naiveUtc = parseNaiveAsUtc(raw);
  if (naiveUtc === null) return null;
  let guess = naiveUtc;
  for (let i=0;i<2;i+=1) guess = naiveUtc - timezoneOffsetMs(guess, 'America/Detroit');
  return guess;
}
function chooseTimeParser(rows) {
  const classes = [...new Set(rows.map((row)=>sourceTimeClass(row.datetime)))];
  if (classes.every((x)=>['EXPLICIT_Z','EXPLICIT_OFFSET'].includes(x))) return { class:'PROVIDER_EXPLICIT_OFFSET', parse:(x)=>parseExplicitTime(x) };
  if (classes.length === 1 && classes[0] === 'NAIVE_DATE_TIME') return { class:'PROVIDER_NAIVE_REQUIRES_AMERICA_DETROIT_BINDING', parse:(x)=>parseNaiveDetroit(x) };
  return { class:`UNRESOLVED_MIXED:${classes.join(',')}`, parse:()=>null };
}
function retainBeforeParse(body, identity) {
  const digest = sha256(body);
  const file = path.join(PRIVATE_ROOT, `${crypto.createHash('sha256').update(identity).digest('hex')}.raw`);
  fs.writeFileSync(file, body);
  const reread = fs.readFileSync(file);
  requireCondition(sha256(reread) === digest, 'EA4EW_RAW_RETENTION_DIGEST_MISMATCH');
  requireCondition(reread.length === body.length, 'EA4EW_RAW_RETENTION_BYTE_MISMATCH');
  return { sha256:digest, bytes:body.length, private_retention_verified:true, raw_body_uploaded:false };
}
function safeHeader(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const allowed = ['name','header','extraText','formatIn','type','displayIn'];
  return Object.fromEntries(allowed.filter((key)=>entry[key] !== undefined).map((key)=>[key, typeof entry[key] === 'string' ? entry[key].slice(0,200) : entry[key]]));
}
function targetInvalidSummary(metadata, family, field) {
  const node = metadata?.InvalidData?.[family]?.[field];
  const list = Array.isArray(node?.list) ? node.list : [];
  return { present:!!node, entry_count:list.length, list_sha256:sha256(JSON.stringify(list)) };
}
function targetEstimatedPresent(metadata, family, field) {
  return Boolean(metadata?.EstimatedData?.[family]?.[field]);
}
function gapStats(times) {
  const sorted = [...new Set(times)].sort((a,b)=>a-b);
  const gaps = [];
  for (let i=1;i<sorted.length;i+=1) gaps.push((sorted[i]-sorted[i-1])/60000);
  return { distinct_count:sorted.length, min_gap_minutes:gaps.length?Math.min(...gaps):null, max_gap_minutes:gaps.length?Math.max(...gaps):null, all_gaps_5m:gaps.length>0&&gaps.every((x)=>Math.abs(x-5)<1e-9), all_gaps_60m:gaps.length>0&&gaps.every((x)=>Math.abs(x-60)<1e-9) };
}
function dateTokens(ms) {
  const d = new Date(ms);
  const y=d.getUTCFullYear(),m=String(d.getUTCMonth()+1).padStart(2,'0'),day=String(d.getUTCDate()).padStart(2,'0');
  return [`${y}-${m}-${day}`,`${m}/${day}/${y}`,`${+m}/${+day}/${y}`];
}
function invalidMentionsWindow(metadata, family, field, startMs, endMs) {
  const list = metadata?.InvalidData?.[family]?.[field]?.list;
  if (!Array.isArray(list)) return 0;
  const tokens = new Set();
  for (let t=startMs;t<=endMs;t+=86400000) for (const token of dateTokens(t)) tokens.add(token);
  return list.filter((entry)=>{const text=String(entry);return [...tokens].some((token)=>text.includes(token));}).length;
}
function semanticTerms(text) {
  const lower = text.toLowerCase();
  const tokens = ['data','use','copyright','permission','commercial','redistribut','warranty','liability','research','education'];
  return Object.fromEntries(tokens.map((token)=>[token,lower.includes(token)]));
}

let browser;
const result = {
  schema_version:'geox_mcft_cap09_ea4_enviroweather_meteogram_source_qualification_result_v1',
  status:'FAIL', subject_sha:SUBJECT_SHA || null,
  database_write_count:0, formal_evidence_write_count:0, public_raw_numeric_value_emission_count:0,
  raw_body_uploaded:false, source_substitution_authorized:false, ea5_authorized:false,
};
try {
  requireCondition(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'EA4EW_EXACT_SUBJECT_SHA_REQUIRED');
  browser = await chromium.launch({ headless:true });
  const context = await browser.newContext({ locale:'en-US', timezoneId:'UTC', acceptDownloads:false });
  const page = await context.newPage();
  let captured = null;
  page.on('response', (response) => {
    const task = (async()=>{
      const url = new URL(response.url());
      if (url.hostname !== AUTH.provider_binding_candidate.api_host || url.pathname !== AUTH.provider_binding_candidate.api_path || response.status() !== 200) return;
      const required = AUTH.provider_binding_candidate.required_query_keys;
      if (!required.every((key)=>(url.searchParams.get(key)||'').trim())) return;
      const body = await response.body();
      const receipt = retainBeforeParse(body, `${url.hostname}${url.pathname}|${url.search}`);
      const parsed = JSON.parse(body.toString('utf8'));
      const rows = parsed?.data?.Table;
      if (!Array.isArray(rows) || rows.length < 2) return;
      if (!captured || body.length > captured.body_bytes) captured = { url, parsed, receipt, body_bytes:body.length };
    })();
    task.catch(()=>{});
  });
  const pageResponse = await page.goto(directUrl(), { waitUntil:'domcontentloaded', timeout:60000 });
  requireCondition(pageResponse && pageResponse.status() >= 200 && pageResponse.status() < 400, 'EA4EW_SOURCE_PAGE_FAILED');
  await page.waitForTimeout(18000);
  requireCondition(captured, 'EA4EW_NO_COMPLETE_RUN_RESPONSE');

  const { url, parsed, receipt } = captured;
  const queryIdentity = Object.fromEntries(AUTH.provider_binding_candidate.required_query_keys.map((key)=>[key,url.searchParams.get(key)]));
  requireCondition(queryIdentity.selectedStation === 'kbs' && queryIdentity.duration === '24', 'EA4EW_QUERY_SCOPE_DRIFT');
  const stationText = JSON.stringify(parsed?.metadata?.Station ?? parsed?.metadata ?? '').toLowerCase();
  requireCondition(AUTH.provider_binding_candidate.station_identity_patterns.some((value)=>stationText.includes(value.toLowerCase())), 'EA4EW_STATION_IDENTITY_NOT_PROVEN');

  const rows = parsed.data.Table;
  const headers = Array.isArray(parsed?.data?.TableHeaders) ? parsed.data.TableHeaders : [];
  const rainHeader = headers.find((item)=>item?.name === AUTH.provider_binding_candidate.rain_field);
  const solarHeader = headers.find((item)=>item?.name === AUTH.provider_binding_candidate.solar_field);
  requireCondition(rainHeader && solarHeader, 'EA4EW_TARGET_HEADER_METADATA_REQUIRED');
  const timePolicy = chooseTimeParser(rows);
  const parsedRows = rows.map((row)=>({ row, time:timePolicy.parse(row.datetime) })).filter((item)=>Number.isFinite(item.time));
  requireCondition(parsedRows.length === rows.length, `EA4EW_TIMESTAMP_AUTHORITY_UNRESOLVED:${timePolicy.class}`);
  const now = Date.now();
  const futureBoundaryRaw = parsed?.data?.DD_forecastDate;
  const futureBoundary = futureBoundaryRaw ? timePolicy.parse(futureBoundaryRaw) : null;
  const observedUpper = Number.isFinite(futureBoundary) ? Math.min(now + 5*60000, futureBoundary - 1) : now + 5*60000;
  const observedRows = parsedRows.filter((item)=>item.time <= observedUpper);
  requireCondition(observedRows.length > 0, 'EA4EW_OBSERVED_ROWS_REQUIRED');

  const rain = observedRows.map((item)=>({time:item.time,value:finite(item.row.pcpn_us)})).filter((item)=>item.value !== null);
  const solar = observedRows.map((item)=>({time:item.time,value:finite(item.row.srad_hourly_standard)})).filter((item)=>item.value !== null);
  requireCondition(rain.length > 0 && solar.length > 0, 'EA4EW_TARGET_NUMERIC_VALUES_REQUIRED');
  requireCondition(rain.every((item)=>item.value >= 0), 'EA4EW_NEGATIVE_RAIN_FORBIDDEN');
  requireCondition(solar.every((item)=>item.value >= 0), 'EA4EW_NEGATIVE_SOLAR_FORBIDDEN');
  const latestRain = Math.max(...rain.map((x)=>x.time));
  const latestSolar = Math.max(...solar.map((x)=>x.time));
  const commonEnd = Math.min(latestRain, latestSolar);
  const windowStart = commonEnd - 24*3600000;
  const rainWindow = rain.filter((x)=>x.time >= windowStart && x.time <= commonEnd);
  const solarWindow = solar.filter((x)=>x.time >= windowStart && x.time <= commonEnd);
  const rainGaps = gapStats(rainWindow.map((x)=>x.time));
  const solarGaps = gapStats(solarWindow.map((x)=>x.time));
  const latestTargetAgeHours = (now - commonEnd)/3600000;

  const rainEstimated = targetEstimatedPresent(parsed.metadata,'fivemin','pcpn') || targetEstimatedPresent(parsed.metadata,'hourly','pcpn');
  const solarEstimated = targetEstimatedPresent(parsed.metadata,'hourly','srad');
  const rainInvalid = targetInvalidSummary(parsed.metadata,'fivemin','pcpn');
  const solarInvalid = targetInvalidSummary(parsed.metadata,'hourly','srad');
  const rainInvalidOverlap = invalidMentionsWindow(parsed.metadata,'fivemin','pcpn',windowStart,commonEnd);
  const solarInvalidOverlap = invalidMentionsWindow(parsed.metadata,'hourly','srad',windowStart,commonEnd);

  let termsHref = null;
  const termsLink = page.getByRole('link', { name:/Terms of Agreement/i }).first();
  if (await termsLink.count()) termsHref = await termsLink.getAttribute('href');
  let terms = { link_found:false, url:null, response_status:null, sha256:null, bytes:null, semantic_tokens:{}, public_raw_redistribution_authorized:false, commercial_reuse_rights_established:false, legal_opinion_claimed:false };
  if (termsHref) {
    const termsUrl = new URL(termsHref, AUTH.provider_binding_candidate.source_page).toString();
    const termsResponse = await context.request.get(termsUrl, { timeout:30000 });
    const text = await termsResponse.text();
    terms = { link_found:true, url:new URL(termsResponse.url()).origin + new URL(termsResponse.url()).pathname, response_status:termsResponse.status(), sha256:sha256(Buffer.from(text)), bytes:Buffer.byteLength(text), semantic_tokens:semanticTerms(text), public_raw_redistribution_authorized:false, commercial_reuse_rights_established:false, legal_opinion_claimed:false };
  }

  const violations = [];
  const maxAge = AUTH.technical_qualification_requirements.latest_observed_target_max_age_hours;
  if (latestTargetAgeHours < -0.1 || latestTargetAgeHours > maxAge) violations.push(`LATEST_TARGET_AGE_HOURS:${latestTargetAgeHours.toFixed(3)}`);
  if (rainEstimated) violations.push('RAIN_PROVIDER_ESTIMATED');
  if (solarEstimated) violations.push('SOLAR_PROVIDER_ESTIMATED');
  if (!rainGaps.all_gaps_5m || rainGaps.distinct_count < 289) violations.push(`RAIN_24H_GRID:${JSON.stringify(rainGaps)}`);
  if (!solarGaps.all_gaps_60m || solarGaps.distinct_count < 25) violations.push(`SOLAR_24H_GRID:${JSON.stringify(solarGaps)}`);
  if (rainInvalidOverlap > 0) violations.push(`RAIN_INVALID_METADATA_OVERLAP:${rainInvalidOverlap}`);
  if (solarInvalidOverlap > 0) violations.push(`SOLAR_INVALID_METADATA_OVERLAP:${solarInvalidOverlap}`);
  if (!terms.link_found || terms.response_status !== 200) violations.push('TERMS_PAGE_NOT_REPROVED');
  if (timePolicy.class === 'PROVIDER_NAIVE_REQUIRES_AMERICA_DETROIT_BINDING') violations.push('TIMESTAMP_TIMEZONE_AUTHORITY_REQUIRES_AMENDMENT_BINDING');

  const qualified = violations.length === 0;
  Object.assign(result, {
    status:'PASS', qualification_status:qualified?'QUALIFIED':'REJECTED',
    decision:qualified?AUTH.live_qualification.success_decision:AUTH.live_qualification.failure_decision,
    probe_observed_at_utc:new Date(now).toISOString(),
    source_identity:{
      host:url.hostname,path:url.pathname,method:'GET',duration:queryIdentity.duration,selectedStation:queryIdentity.selectedStation,
      resultModelCode:queryIdentity.resultModelCode,resultModelId:queryIdentity.resultModelId,
      stationCode:queryIdentity.stationCode,stationId:queryIdentity.stationId,stationType:queryIdentity.stationType,units:queryIdentity.units,
      query_key_names:AUTH.provider_binding_candidate.required_query_keys,
    },
    raw_retention:receipt,
    station_identity_proven:true,
    table:{row_count:rows.length,timestamp_policy:timePolicy.class,forecast_boundary_present:Number.isFinite(futureBoundary),forecast_boundary_utc:Number.isFinite(futureBoundary)?new Date(futureBoundary).toISOString():null},
    header_metadata:{rain:safeHeader(rainHeader),solar:safeHeader(solarHeader)},
    observed_candidate:{
      common_end_utc:new Date(commonEnd).toISOString(),window_start_utc:new Date(windowStart).toISOString(),latest_target_age_hours:Number(latestTargetAgeHours.toFixed(3)),
      rain:{numeric_count_24h:rainWindow.length,grid:rainGaps,sequence_sha256:sha256(JSON.stringify(rainWindow.map((x)=>[new Date(x.time).toISOString(),String(x.value)]))),estimated_by_provider:rainEstimated,invalid_metadata:rainInvalid,invalid_window_overlap_count:rainInvalidOverlap},
      solar:{numeric_count_24h:solarWindow.length,grid:solarGaps,sequence_sha256:sha256(JSON.stringify(solarWindow.map((x)=>[new Date(x.time).toISOString(),String(x.value)]))),estimated_by_provider:solarEstimated,invalid_metadata:solarInvalid,invalid_window_overlap_count:solarInvalidOverlap},
    },
    terms,
    violations,
    source_substitution_authorized:false, source_architecture_amendment_required:true, ea5_authorized:false,
    database_write_count:0, formal_evidence_write_count:0, public_raw_numeric_value_emission_count:0, raw_body_uploaded:false,
  });
  write(result);
  console.log(JSON.stringify({status:'PASS',qualification_status:result.qualification_status,decision:result.decision,age_hours:result.observed_candidate.latest_target_age_hours,rain_grid:rainGaps,solar_grid:solarGaps,violations},null,2));
  await context.close();
} catch (error) {
  result.error = `${error.name || 'Error'}:${error.message || String(error)}`;
  write(result);
  console.error(result.error);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
