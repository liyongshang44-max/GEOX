#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = path.join(ROOT, 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-RAIN-SOLAR-SOURCE-DISCOVERY-V1.json');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_EA4_RAIN_SOLAR_SOURCE_DISCOVERY_RESULT.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const SUBJECT_SHA = process.env.MCFT_SUBJECT_SHA || null;
const MAX_RESPONSES = 120;
const MAX_SCHEMA_PATHS = 220;
const MAX_ARRAY_SHAPES = 100;

const sha256 = (input) => `sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9%/+.-]+/g, ' ').replace(/\s+/g, ' ').trim();
const writeResult = (value) => { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); };
const safeError = (error) => error instanceof Error ? error.message.replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]') : String(error);

function safeRequestIdentity(request, phase) {
  const parsed = new URL(request.url());
  return { phase, host: parsed.hostname, path: parsed.pathname, method: request.method(), query_key_names: [...new Set([...parsed.searchParams.keys()])].sort(), query_values_emitted: false, authorization_header_present: Object.keys(request.headers()).some((key) => key.toLowerCase() === 'authorization'), canonical_request_identity_sha256: sha256(`${request.method()} ${request.url()}`) };
}
function maybeTimestamp(value, parentKey) {
  if (!/(time|date|updated|observed|timestamp|valid|issue)/i.test(parentKey)) return null;
  if (typeof value === 'string') { const parsed = Date.parse(value.trim()); if (Number.isFinite(parsed) && parsed >= Date.UTC(2000,0,1) && parsed <= Date.now() + 10*86_400_000) return parsed; }
  if (typeof value === 'number' && Number.isFinite(value)) for (const parsed of [value,value*1000]) if (parsed >= Date.UTC(2000,0,1) && parsed <= Date.now() + 10*86_400_000) return parsed;
  return null;
}
function schemaSummary(json) {
  const paths = new Set(), shapes = new Set(), tokens = new Set(), timestamps = [];
  const lexicon = config.approved_metadata_lexicon.map(normalize);
  function scan(value, pathParts, parentKey='') {
    const pathText = pathParts.join('.') || '$';
    if (Array.isArray(value)) {
      const first=value[0], kind=Array.isArray(first)?`array:${first.length}`:first===null?'null':typeof first;
      if (shapes.size < MAX_ARRAY_SHAPES) shapes.add(`${pathText}|len=${value.length}|item=${kind}`);
      for (let i=0;i<Math.min(value.length,50);i+=1) scan(value[i],[...pathParts,'[]'],parentKey);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key,child] of Object.entries(value)) {
        const next=[...pathParts,key]; if(paths.size<MAX_SCHEMA_PATHS) paths.add(next.join('.'));
        const nk=normalize(key); for(const token of lexicon) if(nk.includes(token)) tokens.add(token); scan(child,next,key);
      }
      return;
    }
    if (typeof value === 'string') { const nv=normalize(value); for(const token of lexicon) if(nv===token || nv.includes(token)) tokens.add(token); }
    const timestamp=maybeTimestamp(value,parentKey); if(timestamp!==null) timestamps.push(timestamp);
  }
  scan(json,[]);
  const unique=[...new Set(timestamps)].sort((a,b)=>a-b);
  return { root_kind:Array.isArray(json)?'array':json===null?'null':typeof json, schema_key_paths:[...paths].sort(), array_shapes:[...shapes].sort(), approved_metadata_tokens:[...tokens].sort(), timestamp_count_detected:unique.length, earliest_timestamp_detected:unique.length?new Date(unique[0]).toISOString():null, latest_timestamp_detected:unique.length?new Date(unique.at(-1)).toISOString():null, raw_numeric_observation_values_emitted:false, unfiltered_string_values_emitted:false };
}
function csvHeaderSummary(body) {
  const firstLine=body.toString('utf8').replace(/^\uFEFF/,'').split(/\r?\n/,1)[0]||'';
  const delimiter=firstLine.includes('\t')?'\t':firstLine.includes(';')&&!firstLine.includes(',')?';':',';
  const headers=firstLine.split(delimiter).map(normalize).filter(Boolean).slice(0,120), tokens=new Set();
  for(const header of headers) for(const token of config.approved_metadata_lexicon.map(normalize)) if(header.includes(token)) tokens.add(token);
  return { root_kind:'csv', header_name_sha256:sha256(headers.join('|')), header_count:headers.length, approved_metadata_tokens:[...tokens].sort(), raw_header_names_emitted:false, raw_numeric_observation_values_emitted:false };
}
function signalsFor(entry) {
  const corpus=normalize([entry.request.path,...(entry.schema?.schema_key_paths||[]),...(entry.schema?.approved_metadata_tokens||[])].join(' '));
  const detect=(patterns)=>patterns.some((pattern)=>corpus.includes(normalize(pattern)));
  return { rainfall:detect(config.capability_patterns.rainfall), solar_radiation:detect(config.capability_patterns.solar_radiation), station_identity:detect(config.capability_patterns.station_identity), forecast:detect(config.capability_patterns.forecast), observed:detect(config.capability_patterns.observed), hourly:detect(config.capability_patterns.hourly), daily:detect(config.capability_patterns.daily) };
}
async function selectTargetStation(page) {
  const patterns=config.target_station_label_patterns.map(normalize), selects=page.locator('select');
  for(let i=0;i<await selects.count();i+=1){
    const select=selects.nth(i); const options=await select.locator('option').evaluateAll((nodes)=>nodes.map((node)=>({value:node.value,text:node.textContent||''})));
    const match=options.find((option)=>normalize(option.value)===normalize(config.target_station_slug)||patterns.some((pattern)=>normalize(option.text).includes(pattern)));
    if(match){ await select.selectOption(match.value); return {method:'native_select',selected_station_slug:config.target_station_slug,selected_label_pattern_match:true}; }
  }
  const combos=page.getByRole('combobox');
  for(let i=0;i<await combos.count();i+=1){ try{ await combos.nth(i).click(); for(const pattern of config.target_station_label_patterns){ const option=page.getByText(pattern,{exact:false}).last(); if(await option.count()){await option.click();return {method:'aria_combobox',selected_station_slug:config.target_station_slug,selected_label_pattern_match:true};}}}catch{} }
  throw new Error('EA4RS_TARGET_KBS_STATION_OPTION_NOT_FOUND');
}
async function submitModel(page) {
  const candidates=page.locator('button, input[type="submit"], [role="button"]');
  for(let i=0;i<await candidates.count();i+=1){
    const candidate=candidates.nth(i); let label='';
    try{ label=normalize((await candidate.textContent()) || (await candidate.getAttribute('value')) || (await candidate.getAttribute('aria-label')) || ''); }catch{}
    if(label.includes('submit')){ await candidate.click(); return 'explicit_submit_control'; }
  }
  const stationSelect=page.locator('select').filter({has:page.locator(`option[value="${config.target_station_slug}"]`)}).first();
  if(await stationSelect.count()){
    const form=stationSelect.locator('xpath=ancestor::form[1]');
    if(await form.count()){ await form.evaluate((node)=>node.requestSubmit()); return 'station_form_request_submit'; }
    try{ await stationSelect.press('Enter'); return 'station_select_enter_fallback'; }catch{}
  }
  throw new Error('EA4RS_MODEL_SUBMIT_SURFACE_NOT_FOUND');
}
function safeResponseSummary(entry){ return { request:entry.request, response_status:entry.response_status, content_type:entry.content_type, response_body_sha256:entry.response_body_sha256, response_bytes:entry.response_bytes, parse_status:entry.parse_status, schema:entry.schema, capability_signals:entry.capability_signals, raw_body_persisted:false, raw_numeric_observation_values_emitted:false }; }

let browser, phase='initial'; const responseTasks=[], evidence=new Map();
try {
  if(!SUBJECT_SHA || !/^[0-9a-f]{40}$/.test(SUBJECT_SHA)) throw new Error('EA4RS_EXACT_SUBJECT_SHA_REQUIRED');
  browser=await chromium.launch({headless:true}); const context=await browser.newContext({locale:'en-US',timezoneId:'UTC',acceptDownloads:false}); const page=await context.newPage();
  page.on('response',(response)=>{
    const request=response.request(); let parsed; try{parsed=new URL(response.url());}catch{return;} if(!config.allowed_response_hosts.includes(parsed.hostname)) return;
    const contentType=String(response.headers()['content-type']||'').toLowerCase(); if(!(contentType.includes('json')||contentType.includes('csv')||contentType.includes('text/plain'))) return;
    const capturedPhase=phase; const task=(async()=>{
      const requestIdentity=safeRequestIdentity(request,capturedPhase); const identityKey=`${capturedPhase}|${requestIdentity.host}|${requestIdentity.path}|${requestIdentity.method}|${requestIdentity.query_key_names.join(',')}`;
      if(!evidence.has(identityKey)&&evidence.size>=MAX_RESPONSES)return; const body=await response.body(); let parseStatus='UNCLASSIFIED_TEXT', schema=null;
      if(contentType.includes('json')){try{schema=schemaSummary(JSON.parse(body.toString('utf8')));parseStatus='JSON_PARSED';}catch{parseStatus='JSON_CONTENT_TYPE_NON_JSON_BODY';}}
      else if(contentType.includes('csv')||body.subarray(0,1000).toString('utf8').includes(',')){schema=csvHeaderSummary(body);parseStatus='CSV_HEADER_PARSED_VALUES_DISCARDED';}
      const entry={request:requestIdentity,response_status:response.status(),content_type:contentType.split(';')[0],response_body_sha256:sha256(body),response_bytes:body.byteLength,parse_status:parseStatus,schema,raw_body_persisted:false,raw_numeric_observation_values_emitted:false}; entry.capability_signals=signalsFor(entry); evidence.set(identityKey,entry);
    })(); responseTasks.push(task);
  });
  const response=await page.goto(config.source_page,{waitUntil:'domcontentloaded',timeout:60_000}); if(!response||response.status()<200||response.status()>=400)throw new Error('EA4RS_SOURCE_PAGE_FAILED');
  await page.waitForFunction(()=> (document.body?.innerText||'').toLowerCase().includes('daily heat and moisture'),null,{timeout:60_000}); await page.waitForTimeout(4_000);
  const stationSelection=await selectTargetStation(page); phase='submitted'; const submit_method=await submitModel(page); await page.waitForTimeout(15_000); await Promise.allSettled(responseTasks);
  const responses=[...evidence.values()].sort((a,b)=>`${a.request.phase}|${a.request.host}|${a.request.path}`.localeCompare(`${b.request.phase}|${b.request.host}|${b.request.path}`)); const submitted=responses.filter((entry)=>entry.request.phase==='submitted');
  if(!submitted.length)throw new Error('EA4RS_NO_SUBMITTED_MODEL_MACHINE_RESPONSES'); const apiSubmitted=submitted.filter((entry)=>entry.request.host==='api.enviroweather.msu.edu'); if(!apiSubmitted.length)throw new Error('EA4RS_NO_ENVIROWEATHER_API_SUBMITTED_RESPONSE');
  const rainfallCandidates=submitted.filter((entry)=>entry.capability_signals.rainfall), solarCandidates=submitted.filter((entry)=>entry.capability_signals.solar_radiation);
  const result={schema_version:'geox_mcft_cap09_ea4_rain_solar_source_discovery_result_v1',status:'PASS',subject_sha:SUBJECT_SHA,source_page:config.source_page,target_station_slug:config.target_station_slug,station_selection:stationSelection,submit_method,retrieved_at:new Date().toISOString(),total_machine_response_count:responses.length,submitted_machine_response_count:submitted.length,submitted_api_host_response_count:apiSubmitted.length,responses:responses.map(safeResponseSummary),capability_summary:{rainfall_candidate_endpoint_count:rainfallCandidates.length,solar_candidate_endpoint_count:solarCandidates.length,rainfall_signal_present_after_kbs_submit:rainfallCandidates.length>0,solar_signal_present_after_kbs_submit:solarCandidates.length>0,forecast_discrimination_signal_present:submitted.some((entry)=>entry.capability_signals.forecast),observed_discrimination_signal_present:submitted.some((entry)=>entry.capability_signals.observed),hourly_signal_present:submitted.some((entry)=>entry.capability_signals.hourly),daily_signal_present:submitted.some((entry)=>entry.capability_signals.daily)},discovery_creates_formal_source_authority:false,rainfall_qualified:false,solar_radiation_qualified:false,query_values_emitted:false,raw_numeric_observation_values_emitted:false,raw_response_body_persisted:false,rendered_dom_persisted:false,export_csv_clicked:false,database_write_count:0,formal_evidence_write_count:0,formal_window_started:false,ea5_authorized:false};
  writeResult(result); console.log(JSON.stringify({status:result.status,submit_method,submitted_machine_response_count:result.submitted_machine_response_count,capability_summary:result.capability_summary},null,2)); await context.close();
} catch(error){
  const summaries=[...evidence.values()].map(safeResponseSummary); writeResult({schema_version:'geox_mcft_cap09_ea4_rain_solar_source_discovery_result_v1',status:'FAIL',subject_sha:SUBJECT_SHA,source_page:config.source_page,error:safeError(error),retrieved_at:new Date().toISOString(),response_count_before_failure:summaries.length,response_summaries_before_failure:summaries,query_values_emitted:false,raw_numeric_observation_values_emitted:false,raw_response_body_persisted:false,rendered_dom_persisted:false,database_write_count:0,formal_evidence_write_count:0,formal_window_started:false}); console.error(`EA4RS_FAIL:${safeError(error)}`); process.exitCode=1;
} finally { await browser?.close(); }
