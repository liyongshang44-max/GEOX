#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1G-AWDN-SCQC60-LIVE-PROBE-V1.json'), 'utf8'));
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA1G_AWDN_SCQC60_LIVE_PROBE_RESULT.json');
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null;
const HOUR_MS = 3_600_000;

function sha256(input) { return `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`; }
function write(value) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`); }
function safeError(error) { return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]'); }
function normalize(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function ymd(ms) { const d = new Date(ms); return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`; }
function ymdh(ms) { const d = new Date(ms); return `${ymd(ms)}${String(d.getUTCHours()).padStart(2,'0')}`; }
function parseTime(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    for (const candidate of [value, value * 1000]) if (candidate > Date.UTC(2000,0,1) && candidate < Date.now()+86_400_000) return candidate;
  }
  if (typeof value === 'string') { const parsed = Date.parse(value); if (Number.isFinite(parsed)) return parsed; }
  return null;
}
function requestEvidence(url) {
  const parsed = new URL(url);
  return { host: parsed.hostname, path: parsed.pathname, query_key_names: [...new Set(parsed.searchParams.keys())].sort(), query_values_emitted: false, request_identity_sha256: sha256(url) };
}
async function fetchJson(params, label) {
  const url = new URL(CONFIG.web_service_base_url);
  for (const [key,value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, { signal: AbortSignal.timeout(45_000), headers: { accept: 'application/json,text/plain;q=0.8,*/*;q=0.5', 'user-agent': 'GEOX-MCFT-CAP09-EA1G-READ-ONLY/1.0' } });
  if (!response.ok) throw new Error(`${label}_HTTP_${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let json;
  try { json = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error(`${label}_JSON_REQUIRED`); }
  return { json, evidence: { request: requestEvidence(url.toString()), response_status: response.status, content_type: String(response.headers.get('content-type')||'').split(';')[0], response_body_sha256: sha256(bytes), response_bytes: bytes.byteLength } };
}
function discoverStationCandidates(value) {
  const candidates = [];
  const tokens = CONFIG.target_station.identity_search_tokens.map(normalize);
  function walk(current, p='') {
    if (Array.isArray(current)) { current.forEach((item,i)=>walk(item,`${p}[${i}]`)); return; }
    if (!current || typeof current !== 'object') return;
    const strings = Object.entries(current).filter(([,v])=>typeof v === 'string');
    const corpus = strings.map(([,v])=>normalize(v)).join(' ');
    if (tokens.some((token)=>corpus.includes(token))) {
      const identity = {};
      for (const [key,v] of strings) if (/(name|station|code|id|uid|state|network)/i.test(key)) identity[key] = v;
      candidates.push({ object_path: p || '$', identity });
    }
    for (const [key,v] of Object.entries(current)) if (v && typeof v === 'object') walk(v,p?`${p}.${key}`:key);
  }
  walk(value);
  return candidates;
}
function observationQueryCandidates(discoveryCandidates) {
  const values = [CONFIG.target_station.canonical_label];
  for (const candidate of discoveryCandidates) for (const [key,value] of Object.entries(candidate.identity)) if (/(name|station|code|id|uid)/i.test(key) && typeof value === 'string') values.push(value);
  return [...new Set(values.map((v)=>v.trim()).filter(Boolean))].slice(0,12);
}
function findRecordArray(json) {
  const arrays = [];
  function walk(value,p='$') {
    if (Array.isArray(value)) {
      const objects = value.filter((x)=>x && typeof x === 'object' && !Array.isArray(x));
      if (objects.length >= 2) {
        const keys = new Set(objects.flatMap((x)=>Object.keys(x)));
        const timeKeys = [...keys].filter((key)=>/(date|time|datetime|valid|timestamp)/i.test(key));
        if (timeKeys.length) arrays.push({ path:p, records:objects, keys:[...keys].sort(), timeKeys });
      }
      value.slice(0,8).forEach((x,i)=>{ if (x && typeof x==='object') walk(x,`${p}[${i}]`); });
      return;
    }
    if (value && typeof value === 'object') for (const [key,v] of Object.entries(value)) if (v && typeof v==='object') walk(v,`${p}.${key}`);
  }
  walk(json);
  arrays.sort((a,b)=>b.records.length-a.records.length);
  return arrays[0] || null;
}
function recordTime(record,timeKeys) {
  for (const key of timeKeys) { const parsed=parseTime(record[key]); if (parsed!==null) return parsed; }
  return null;
}
function parseFlaggedNumber(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return { valid:true, flag:null };
  if (typeof raw !== 'string') return { valid:false, flag:null };
  const match = raw.trim().match(/^[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?\s*([ER]|e)?$/);
  return match ? { valid:true, flag:match[1] || null } : { valid:false, flag:null };
}
function companionFlag(record,field) {
  const normalizedField = field.toLowerCase();
  for (const [key,value] of Object.entries(record)) {
    const nk=key.toLowerCase();
    if (!nk.includes('flag')) continue;
    if (!(nk.includes(normalizedField) || nk.replace(/flag|qc|quality/g,'').includes(normalizedField))) continue;
    const text=String(value||'').trim();
    if (['E','R','e'].includes(text)) return text;
  }
  return null;
}
function roleFieldCandidates(keys,role) {
  return keys.filter((key)=>!/(flag|qc|quality)/i.test(key) && role.field_name_patterns.some((pattern)=>normalize(key).includes(normalize(pattern))));
}
function analyzeRole(records,timeKeys,fields,latestRecordTime) {
  const floor = latestRecordTime - CONFIG.freshness_and_continuity.recent_window_hours*HOUR_MS;
  return fields.map((field)=>{
    const distinctAll=new Set(), distinctUnestimated=new Set();
    const flagCounts={E:0,R:0,e:0,unflagged:0,missing_or_non_numeric:0};
    for (const record of records) {
      const time=recordTime(record,timeKeys); if (time===null || time<floor || time>latestRecordTime) continue;
      const parsed=parseFlaggedNumber(record[field]);
      if (!parsed.valid) { flagCounts.missing_or_non_numeric++; continue; }
      const flag=parsed.flag || companionFlag(record,field);
      distinctAll.add(Math.floor(time/HOUR_MS));
      if (flag && Object.hasOwn(flagCounts,flag)) flagCounts[flag]++;
      else { flagCounts.unflagged++; distinctUnestimated.add(Math.floor(time/HOUR_MS)); }
    }
    return { field_name:field, recent_distinct_hours:distinctAll.size, recent_unestimated_distinct_hours:distinctUnestimated.size, flag_counts:flagCounts, raw_values_emitted:false };
  });
}

let discoveryEvidence=null, observationEvidence=null, stationCandidates=[];
try {
  if (!SUBJECT_SHA || !/^[0-9a-f]{40}$/.test(SUBJECT_SHA)) throw new Error('EA1G_EXACT_SUBJECT_SHA_REQUIRED');
  const discovery = await fetchJson({ active:CONFIG.discovery_request.product_id, network:CONFIG.discovery_request.network, format:CONFIG.discovery_request.format }, 'EA1G_ACTIVE');
  discoveryEvidence=discovery.evidence;
  stationCandidates=discoverStationCandidates(discovery.json);
  if (!stationCandidates.length) throw new Error('EA1G_HICKORY_CORNERS_NOT_FOUND_IN_ACTIVE_ENVIRONET_SCQC60');

  const now=Date.now();
  const begin=ymd(now-CONFIG.observation_request.lookback_hours*HOUR_MS);
  const end=ymdh(now);
  const queryCandidates=observationQueryCandidates(stationCandidates);
  let chosen=null, recordArray=null;
  const failures=[];
  for (const name of queryCandidates) {
    try {
      const fetched=await fetchJson({ name, productid:CONFIG.product_id, begin, end, units:CONFIG.observation_request.units, format:CONFIG.observation_request.format, tz:CONFIG.observation_request.timezone, network:CONFIG.network }, 'EA1G_SCQC60');
      const found=findRecordArray(fetched.json);
      if (!found) { failures.push('NO_RECORD_ARRAY'); continue; }
      chosen={name,fetched}; recordArray=found; break;
    } catch (error) { failures.push(safeError(error)); }
  }
  if (!chosen || !recordArray) throw new Error(`EA1G_SCQC60_STATION_QUERY_FAILED:${failures.slice(0,5).join('|')}`);
  observationEvidence=chosen.fetched.evidence;

  const times=recordArray.records.map((record)=>recordTime(record,recordArray.timeKeys)).filter((v)=>v!==null).sort((a,b)=>a-b);
  if (!times.length) throw new Error('EA1G_SCQC60_TIMESTAMP_REQUIRED');
  const latest=times.at(-1), earliest=times[0];
  const ageHours=(Date.now()-latest)/HOUR_MS;
  if (latest > Date.now()+CONFIG.freshness_and_continuity.future_timestamp_tolerance_minutes*60_000) throw new Error('EA1G_SCQC60_FUTURE_TIMESTAMP_FORBIDDEN');
  if (ageHours > CONFIG.freshness_and_continuity.latest_record_max_age_hours) throw new Error(`EA1G_SCQC60_SOURCE_TOO_OLD:${ageHours.toFixed(2)}`);

  const solarFields=roleFieldCandidates(recordArray.keys,CONFIG.required_observation_roles.solar_radiation);
  const rainFields=roleFieldCandidates(recordArray.keys,CONFIG.required_observation_roles.rainfall);
  if (!solarFields.length) throw new Error('EA1G_SCQC60_SOLAR_FIELD_REQUIRED');
  if (!rainFields.length) throw new Error('EA1G_SCQC60_RAIN_FIELD_REQUIRED');
  const solar=analyzeRole(recordArray.records,recordArray.timeKeys,solarFields,latest);
  const rainfall=analyzeRole(recordArray.records,recordArray.timeKeys,rainFields,latest);
  const solarQualified=solar.filter((x)=>x.recent_unestimated_distinct_hours>=CONFIG.freshness_and_continuity.minimum_recent_unestimated_solar_hours);
  const rainQualified=rainfall.filter((x)=>x.recent_unestimated_distinct_hours>=CONFIG.freshness_and_continuity.minimum_recent_unestimated_rain_hours);
  if (!solarQualified.length) throw new Error('EA1G_SCQC60_NO_SOLAR_FIELD_WITH_24_UNESTIMATED_RECENT_HOURS');
  if (!rainQualified.length) throw new Error('EA1G_SCQC60_NO_RAIN_FIELD_WITH_24_UNESTIMATED_RECENT_HOURS');

  const result={
    schema_version:'geox_mcft_cap09_ea1g_awdn_scqc60_live_probe_result_v1', status:'PASS', subject_sha:SUBJECT_SHA, provider:CONFIG.provider, network:CONFIG.network, product_id:CONFIG.product_id,
    discovery:{...discoveryEvidence, matched_station_candidate_count:stationCandidates.length, station_candidates:stationCandidates},
    observation:{...observationEvidence, selected_station_public_identifier:chosen.name, record_array_path:recordArray.path, record_field_names:recordArray.keys, time_field_names:recordArray.timeKeys, record_count:recordArray.records.length, earliest_timestamp:new Date(earliest).toISOString(), latest_timestamp:new Date(latest).toISOString(), source_age_hours:Number(ageHours.toFixed(3)), raw_values_emitted:false},
    role_evidence:{ solar_radiation:{matched_fields:solar, qualified_unestimated_fields:solarQualified.map((x)=>x.field_name)}, rainfall:{matched_fields:rainfall, qualified_unestimated_fields:rainQualified.map((x)=>x.field_name)} },
    estimated_value_policy_enforced:true, forbidden_observed_flags:CONFIG.estimated_value_policy.forbidden_as_observed_flags,
    formal_source_authority_created:false, qualified_formal_site:false, raw_numeric_observation_values_emitted:false, raw_response_body_persisted:false, database_write_count:0, formal_evidence_write_count:0, formal_window_started:false
  };
  write(result); console.log(JSON.stringify(result,null,2));
} catch (error) {
  const result={schema_version:'geox_mcft_cap09_ea1g_awdn_scqc60_live_probe_result_v1',status:'FAIL',subject_sha:SUBJECT_SHA,error:safeError(error),discovery_evidence:discoveryEvidence,observation_evidence:observationEvidence,matched_station_candidate_count:stationCandidates.length,raw_numeric_observation_values_emitted:false,raw_response_body_persisted:false,database_write_count:0,formal_evidence_write_count:0,qualified_formal_site:false,formal_window_started:false};
  write(result); console.error(JSON.stringify(result,null,2)); process.exitCode=1;
}
