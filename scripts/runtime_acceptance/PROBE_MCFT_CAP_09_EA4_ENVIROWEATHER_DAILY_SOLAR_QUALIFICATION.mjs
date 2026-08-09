#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const AUTH=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-ENVIROWEATHER-DAILY-SOLAR-QUALIFICATION-V1.json'),'utf8'));
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_09_EA4_ENVIROWEATHER_DAILY_SOLAR_QUALIFICATION_RESULT.json');
const SUBJECT_SHA=process.env.MCFT_SUBJECT_SHA||'';
const PRIVATE_ROOT=fs.mkdtempSync(path.join(os.tmpdir(),'mcft-cap09-ew-daily-solar-'));
const sha256=(x)=>`sha256:${crypto.createHash('sha256').update(x).digest('hex')}`;
const text=(x)=>String(x??'').trim();
const finite=(x)=>{if(x===null||x===undefined||text(x)==='')return null;const n=Number(text(x).replace(/,/g,''));return Number.isFinite(n)?n:null};
const req=(ok,code)=>{if(!ok)throw new Error(code)};
const write=(v)=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+'\n','utf8')};

function tzOffset(utcMs,tz){
  const p=new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(utcMs));
  const m=Object.fromEntries(p.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return Date.UTC(+m.year,+m.month-1,+m.day,+m.hour,+m.minute,+m.second)-utcMs;
}
function localDateToUtc(date,hour=0){
  const m=text(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;
  const naive=Date.UTC(+m[1],+m[2]-1,+m[3],hour,0,0);let guess=naive;
  for(let i=0;i<2;i++)guess=naive-tzOffset(guess,'America/Detroit');
  return guess;
}
function nextDate(date){
  const m=text(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;
  const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3])+86400000);return d.toISOString().slice(0,10);
}
function retain(body,id){
  const digest=sha256(body),file=path.join(PRIVATE_ROOT,crypto.createHash('sha256').update(id).digest('hex')+'.raw');
  fs.writeFileSync(file,body);const reread=fs.readFileSync(file);
  req(sha256(reread)===digest&&reread.length===body.length,'EA4DS_RAW_RETENTION_REPROOF_FAIL');
  return{sha256:digest,bytes:body.length,private_retention_verified:true,raw_body_uploaded:false};
}
function safeHeader(h){if(!h||typeof h!=='object')return null;const keys=['name','header','extraText','formatIn','type','displayIn'];return Object.fromEntries(keys.filter(k=>h[k]!==undefined).map(k=>[k,typeof h[k]==='string'?h[k].slice(0,200):h[k]]))}
function invalidList(metadata){const x=metadata?.InvalidData?.daily?.srad?.list;return Array.isArray(x)?x:[]}
function estimated(metadata){return Boolean(metadata?.EstimatedData?.daily?.srad)}
function hasOverlap(list,dates){return list.filter(entry=>dates.some(d=>String(entry).includes(d)||String(entry).includes(d.slice(5).replace('-','/')))).length}
function termsTokens(body){const low=body.toLowerCase(),keys=['data','use','copyright','permission','commercial','redistribut','warranty','liability','research','education'];return Object.fromEntries(keys.map(k=>[k,low.includes(k)]))}
async function selectKbs(page){
  const selects=page.locator('select');
  for(let i=0;i<await selects.count();i++){
    const s=selects.nth(i),opts=await s.locator('option').evaluateAll(nodes=>nodes.map(n=>({value:n.value,text:n.textContent||''})));
    const match=opts.find(o=>String(o.value).toLowerCase()==='kbs'||/hickory corners|kellogg biological|\bkbs\b/i.test(o.text));
    if(match){await s.selectOption(match.value);await page.waitForTimeout(1500);return true}
  }
  return false;
}
async function submit(page){
  const controls=page.locator('button,input[type="submit"],[role="button"]');
  for(let i=0;i<await controls.count();i++){
    const c=controls.nth(i);let label='';
    try{label=((await c.textContent())||(await c.getAttribute('value'))||(await c.getAttribute('aria-label'))||'').toLowerCase()}catch{}
    if(label.includes('submit')){await c.click();return'explicit_submit_control'}
  }
  const stationSelect=page.locator('select').filter({has:page.locator('option[value="kbs"]')}).first();
  if(await stationSelect.count()){
    const form=stationSelect.locator('xpath=ancestor::form[1]');
    if(await form.count()){await form.evaluate(node=>node.requestSubmit());return'station_form_request_submit'}
    try{await stationSelect.press('Enter');return'station_select_enter_fallback'}catch{}
  }
  throw new Error('EA4DS_SUBMIT_NOT_FOUND');
}
function directRunUrl(){
  const now=new Date(),year=now.getUTCFullYear(),month=String(now.getUTCMonth()+1).padStart(2,'0'),day=String(now.getUTCDate()).padStart(2,'0');
  const url=new URL(AUTH.source_candidate.source_page);
  url.searchParams.set('run','1');
  url.searchParams.set('selectedStation','kbs');
  url.searchParams.set('selectDate',`${year}-${month}-${day}`);
  url.searchParams.set('dateStart',`${year}-03-01`);
  return url.toString();
}

let browser;
const result={schema_version:'geox_mcft_cap09_ea4_enviroweather_daily_solar_qualification_result_v1',status:'FAIL',subject_sha:SUBJECT_SHA||null,database_write_count:0,formal_evidence_write_count:0,public_raw_numeric_value_emission_count:0,source_substitution_authorized:false,ea5_authorized:false};
try{
  req(/^[0-9a-f]{40}$/.test(SUBJECT_SHA),'EA4DS_EXACT_SUBJECT_SHA_REQUIRED');
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({locale:'en-US',timezoneId:'UTC',acceptDownloads:false}),page=await context.newPage();
  let captured=null;const tasks=[];
  page.on('response',response=>{
    const task=(async()=>{
      const u=new URL(response.url());
      if(u.hostname!==AUTH.source_candidate.api_host||u.pathname!==AUTH.source_candidate.api_path||response.status()!==200)return;
      const body=await response.body(),receipt=retain(body,`${u.hostname}${u.pathname}|${u.search}`),parsed=JSON.parse(body.toString('utf8')),rows=parsed?.data?.Table;
      if(Array.isArray(rows)&&rows.some(r=>Object.hasOwn(r,'srad'))&&(!captured||body.length>captured.bytes))captured={u,parsed,receipt,bytes:body.length};
    })();tasks.push(task);task.catch(()=>{});
  });
  let resp=await page.goto(AUTH.source_candidate.source_page,{waitUntil:'domcontentloaded',timeout:60000});
  req(resp&&resp.status()>=200&&resp.status()<400,'EA4DS_SOURCE_PAGE_FAILED');
  await page.waitForTimeout(4000);
  req(await selectKbs(page),'EA4DS_KBS_NOT_FOUND');
  let submit_method;
  try{
    submit_method=await submit(page);
    await page.waitForTimeout(12000);
    await Promise.allSettled(tasks);
  }catch(error){
    if(!String(error?.message||error).includes('EA4DS_SUBMIT_NOT_FOUND'))throw error;
    submit_method='direct_query_fallback_from_proven_discovery_surface';
    resp=await page.goto(directRunUrl(),{waitUntil:'domcontentloaded',timeout:60000});
    req(resp&&resp.status()>=200&&resp.status()<400,'EA4DS_DIRECT_QUERY_PAGE_FAILED');
    await page.waitForTimeout(16000);
    await Promise.allSettled(tasks);
  }
  if(!captured){
    submit_method='direct_query_fallback_after_empty_submit';
    resp=await page.goto(directRunUrl(),{waitUntil:'domcontentloaded',timeout:60000});
    req(resp&&resp.status()>=200&&resp.status()<400,'EA4DS_DIRECT_QUERY_PAGE_FAILED');
    await page.waitForTimeout(16000);
    await Promise.allSettled(tasks);
  }
  req(captured,'EA4DS_NO_SOLAR_RUN_RESPONSE');

  const{u,parsed,receipt}=captured,rows=parsed.data.Table,headers=Array.isArray(parsed?.data?.TableHeaders)?parsed.data.TableHeaders:[],header=headers.find(h=>h?.name==='srad');
  req(header,'EA4DS_SOLAR_HEADER_REQUIRED');
  req(u.hostname===AUTH.source_candidate.api_host&&u.pathname===AUTH.source_candidate.api_path,'EA4DS_API_IDENTITY_DRIFT');
  req(u.searchParams.get('selectedStation')==='kbs'||u.searchParams.get('stationCode')==='kbs','EA4DS_KBS_QUERY_BINDING_REQUIRED');
  const stationText=JSON.stringify(parsed?.metadata?.Station??parsed?.metadata??'').toLowerCase();
  req(['hickory corners','kellogg','kbs'].some(x=>stationText.includes(x)),'EA4DS_STATION_IDENTITY_NOT_PROVEN');
  const forecastDate=text(parsed?.data?.DD_forecastDate)||null,observedRows=rows.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(text(r.date))&&(!forecastDate||text(r.date)<forecastDate)),solar=observedRows.map(r=>({date:text(r.date),value:finite(r.srad)})).filter(x=>x.value!==null);
  const violations=[];
  if(solar.length<AUTH.qualification_requirements.minimum_consecutive_observed_days)violations.push(`SOLAR_OBSERVED_DAY_COUNT:${solar.length}`);
  if(solar.some(x=>x.value<0))violations.push('SOLAR_NEGATIVE_VALUE');
  const latest=solar.at(-1),recent=solar.slice(-AUTH.qualification_requirements.minimum_consecutive_observed_days),recentDates=recent.map(x=>x.date);
  for(let i=1;i<recentDates.length;i++)if(recentDates[i]!==nextDate(recentDates[i-1]))violations.push(`SOLAR_DAILY_GAP:${recentDates[i-1]}:${recentDates[i]}`);
  const latestEnd=latest?localDateToUtc(nextDate(latest.date),0):null,age=Number.isFinite(latestEnd)?(Date.now()-latestEnd)/3600000:null;
  if(!Number.isFinite(age)||age<-.1||age>AUTH.qualification_requirements.latest_complete_observed_day_max_age_hours)violations.push(`LATEST_COMPLETE_SOLAR_DAY_AGE_HOURS:${Number.isFinite(age)?age.toFixed(3):'NA'}`);
  const inv=invalidList(parsed.metadata),overlap=hasOverlap(inv,recentDates);
  if(overlap!==0)violations.push(`SOLAR_INVALID_METADATA_OVERLAP:${overlap}`);
  if(estimated(parsed.metadata))violations.push('SOLAR_PROVIDER_ESTIMATED');
  const h=safeHeader(header);if(!h?.extraText&&!h?.formatIn)violations.push('SOLAR_PROVIDER_UNIT_METADATA_MISSING');
  const tr=await context.request.get(AUTH.use_policy_boundary.terms_page,{timeout:30000}),tb=await tr.text();
  const terms={response_status:tr.status(),sha256:sha256(Buffer.from(tb)),bytes:Buffer.byteLength(tb),semantic_tokens:termsTokens(tb),public_raw_redistribution_authorized:false,commercial_reuse_rights_established:false,legal_opinion_claimed:false};
  if(tr.status()!==200)violations.push('TERMS_PAGE_NOT_REPROVED');
  const qualified=violations.length===0;
  Object.assign(result,{status:'PASS',qualification_status:qualified?'TECHNICALLY_QUALIFIED_PENDING_TIMEZONE_AND_TEMPORAL_MODEL_AUTHORITY':'REJECTED',decision:qualified?AUTH.adjudication.pass_decision:AUTH.adjudication.reject_decision,probe_observed_at_utc:new Date().toISOString(),submit_method,source_identity:{host:u.hostname,path:u.pathname,method:'GET',query_key_names:[...u.searchParams.keys()].sort(),selectedStation:u.searchParams.get('selectedStation'),stationCode:u.searchParams.get('stationCode'),stationId:u.searchParams.get('stationId'),resultModelCode:u.searchParams.get('resultModelCode'),resultModelId:u.searchParams.get('resultModelId')},raw_retention:receipt,station_identity_proven:true,header_metadata:h,forecast_boundary_provider_local_date:forecastDate,daily_solar_candidate:{observed_numeric_day_count:solar.length,recent_consecutive_day_count:recent.length,recent_window_start_date:recent.at(0)?.date??null,recent_window_end_date:recent.at(-1)?.date??null,latest_complete_day_age_hours:Number.isFinite(age)?Number(age.toFixed(3)):null,recent_sequence_sha256:recent.length?sha256(Buffer.from(JSON.stringify(recent))):null,provider_estimated:estimated(parsed.metadata),invalid_metadata_entry_count:inv.length,invalid_metadata_sha256:sha256(Buffer.from(JSON.stringify(inv))),invalid_recent_overlap_count:overlap,hourly_observed_truth_claimed:false,temporal_disaggregation_performed:false},timestamp_boundary:{provider_local_calendar_day:true,candidate_timezone:'America/Detroit',candidate_timezone_is_authority:false},terms,violations,hourly_solar_source_authority_created:false,temporal_disaggregation_authority_created:false,source_substitution_authorized:false,ea5_authorized:false,database_write_count:0,formal_evidence_write_count:0,public_raw_numeric_value_emission_count:0});
  write(result);console.log(JSON.stringify({status:'PASS',qualification_status:result.qualification_status,decision:result.decision,submit_method,header:h,age_hours:result.daily_solar_candidate.latest_complete_day_age_hours,violations},null,2));await context.close();
}catch(error){result.error=`${error.name||'Error'}:${error.message||String(error)}`;write(result);console.error(result.error);process.exitCode=1}finally{await browser?.close()}
