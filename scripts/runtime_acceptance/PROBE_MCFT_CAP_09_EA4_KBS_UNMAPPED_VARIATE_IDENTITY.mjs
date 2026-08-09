#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const CFG=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-KBS-UNMAPPED-VARIATE-IDENTITY-DISCOVERY-V1.json'),'utf8'));
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_09_EA4_KBS_UNMAPPED_VARIATE_IDENTITY_RESULT.json');
const SUBJECT_SHA=process.env.MCFT_SUBJECT_SHA||'';
const MINUTE=60_000, HOUR=60*MINUTE;
const sha256=(x)=>`sha256:${crypto.createHash('sha256').update(x).digest('hex')}`;
const req=(ok,code)=>{if(!ok)throw new Error(code)};
const write=(v)=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+'\n')};
const decimals=(raw)=>{const m=String(raw).match(/\.([0-9]+)/);return m?m[1].length:0};
const tolerance=(d)=>0.5*(10**(-d))+1e-6;

function endpointId(raw){try{const u=new URL(raw);if(u.hostname!==CFG.official_host)return null;const m=u.pathname.match(/^\/weather\/variates\/(\d+)\/?$/);return m?Number(m[1]):null}catch{return null}}
function points(json){if(!Array.isArray(json))return[];return json.map((x)=>({time:Date.parse(String(x?.time??'')),value:Number(x?.value)})).filter((x)=>Number.isFinite(x.time)&&Number.isFinite(x.value)).sort((a,b)=>a.time-b.time)}
function extractOne(text,pattern,id,optional=false){const ms=[...String(text).matchAll(new RegExp(pattern,'gim'))];if(optional&&ms.length===0)return null;req(ms.length===1,`EA4UV_RENDERED_CARDINALITY:${id}:${ms.length}`);const raw=ms[0][1],value=Number(raw);req(Number.isFinite(value),`EA4UV_RENDERED_NUMERIC:${id}`);return{value,decimals:decimals(raw)}}
function localParts(ms,tz){const p=new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));return Object.fromEntries(p.filter((x)=>x.type!=='literal').map((x)=>[x.type,Number(x.value)]))}
function tzOffset(ms,tz){const p=localParts(ms,tz);return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-ms}
function localMidnightUtc(y,m,d,tz){const nominal=Date.UTC(y,m-1,d,0,0,0);let guess=nominal;for(let i=0;i<3;i++)guess=nominal-tzOffset(guess,tz);return guess}
function dayStartFor(ms,tz,offsetDays=0){const p=localParts(ms,tz);const nominal=new Date(Date.UTC(p.year,p.month-1,p.day+offsetDays));return localMidnightUtc(nominal.getUTCFullYear(),nominal.getUTCMonth()+1,nominal.getUTCDate(),tz)}
function sumRange(ps,start,end){return ps.filter((p)=>p.time>start&&p.time<=end).reduce((a,p)=>a+p.value,0)}
function maxRange(ps,start,end){const vals=ps.filter((p)=>p.time>=start&&p.time<=end).map((p)=>p.value);return vals.length?Math.max(...vals):null}
function match(value,shown){return Number.isFinite(value)&&Math.abs(value-shown.value)<=tolerance(shown.decimals)}
function rainCandidates(ps,shown,now){const tz=CFG.diagnostic_timezone.name,cur=dayStartFor(now,tz,0),prev=dayStartFor(now,tz,-1),prev2=dayStartFor(now,tz,-2),prev6=dayStartFor(now,tz,-6),prev7=dayStartFor(now,tz,-7);const defs=[
 ['RAIN_SUM_LOCAL_CALENDAR_WINDOWS_DIRECT_INCH_V1',[sumRange(ps,cur,now),sumRange(ps,prev,cur),sumRange(ps,prev2,now),sumRange(ps,prev6,now)],1],
 ['RAIN_SUM_LOCAL_CALENDAR_WINDOWS_MM_TO_INCH_V1',[sumRange(ps,cur,now),sumRange(ps,prev,cur),sumRange(ps,prev2,now),sumRange(ps,prev6,now)],1/25.4],
 ['RAIN_SUM_ROLLING_WINDOWS_DIRECT_INCH_V1',[sumRange(ps,cur,now),sumRange(ps,prev,cur),sumRange(ps,now-72*HOUR,now),sumRange(ps,now-168*HOUR,now)],1],
 ['RAIN_SUM_ROLLING_WINDOWS_MM_TO_INCH_V1',[sumRange(ps,cur,now),sumRange(ps,prev,cur),sumRange(ps,now-72*HOUR,now),sumRange(ps,now-168*HOUR,now)],1/25.4]
 ];
 const target=[shown.today,shown.yesterday,shown.days3,shown.days7];return defs.filter(([,vals,f])=>vals.map((v)=>v*f).every((v,i)=>match(v,target[i]))).map(([method])=>({role_id:'PRECIPITATION_AGGREGATES',method_id:method}));}
function gustCandidates(ps,shown,now){if(!shown)return[];const raw=maxRange(ps,now-HOUR,now);return [
 ['GUST_MAX_LAST_60M_DIRECT_MPH_V1',raw],['GUST_MAX_LAST_60M_MPS_TO_MPH_V1',raw===null?null:raw*2.2369362920544]
 ].filter(([,v])=>match(v,shown)).map(([method])=>({role_id:'MAX_GUST_10M_LAST_HOUR',method_id:method}));}
function directionCandidates(ps,shown){if(!shown||!ps.length)return[];const v=ps.at(-1).value;return match(v,shown)?[{role_id:'WIND_DIRECTION_NUMERIC_IF_RENDERED',method_id:'WIND_DIRECTION_LATEST_DIRECT_DEG_V1'}]:[]}

let browser;
const result={schema_version:'geox_mcft_cap09_ea4_kbs_unmapped_variate_identity_result_v1',status:'FAIL',subject_sha:SUBJECT_SHA||null,source_authority_created:false,solar_source_authority_created:false,timezone_authority_created:false,source_substitution_authorized:false,database_write_count:0,formal_evidence_write_count:0,formal_window_started:false,ea5_authorized:false};
try{
 req(/^[0-9a-f]{40}$/.test(SUBJECT_SHA),'EA4UV_EXACT_SUBJECT_SHA_REQUIRED');browser=await chromium.launch({headless:true});const context=await browser.newContext({locale:'en-US',timezoneId:'UTC'}),page=await context.newPage(),mem=new Map(),tasks=[];
 page.on('response',(response)=>{const id=endpointId(response.url());if(id===null||!CFG.unmapped_high_frequency_endpoint_ids.includes(id))return;const task=(async()=>{req(response.status()>=200&&response.status()<300,`EA4UV_ENDPOINT_HTTP:${id}:${response.status()}`);const body=await response.body();let json;try{json=JSON.parse(body.toString('utf8'))}catch{throw new Error(`EA4UV_ENDPOINT_JSON:${id}`)}const ps=points(json);req(ps.length>1,`EA4UV_ENDPOINT_POINTS:${id}`);mem.set(id,{id,ps,sha256:sha256(body),bytes:body.length})})();tasks.push(task);task.catch(()=>{})});
 const r=await page.goto(CFG.source_page,{waitUntil:'domcontentloaded',timeout:45_000});req(r&&r.status()>=200&&r.status()<400,'EA4UV_SOURCE_PAGE_FAILED');await page.waitForFunction(()=>/Soil\s+Moisture\s*\(10\s*cm\s*\/\s*3\.9\s*in\)\s*:\s*[+-]?\d+(?:\.\d+)?\s*%/i.test(document.body?.innerText??''),undefined,{timeout:45_000});await page.waitForTimeout(2500);await Promise.all(tasks);for(const id of CFG.unmapped_high_frequency_endpoint_ids)req(mem.has(id),`EA4UV_ENDPOINT_MISSING:${id}`);
 const allText=await page.locator('body').innerText(),mainText=allText.split(/BCSE Weather data/i)[0];await context.close();const shown={today:extractOne(mainText,'Precipitation \\(today\\):\\s*([+-]?\\d+(?:\\.\\d+)?)\\s*in','RAIN_TODAY'),yesterday:extractOne(mainText,'Precipitation \\(yesterday\\):\\s*([+-]?\\d+(?:\\.\\d+)?)\\s*in','RAIN_YESTERDAY'),days3:extractOne(mainText,'Precipitation \\(3 days\\):\\s*([+-]?\\d+(?:\\.\\d+)?)\\s*in','RAIN_3D'),days7:extractOne(mainText,'Precipitation \\(7 days\\):\\s*([+-]?\\d+(?:\\.\\d+)?)\\s*in','RAIN_7D'),gust:extractOne(mainText,'Maximum Gust 10m \\(33 ft\\) last hour\\s*:\\s*([+-]?\\d+(?:\\.\\d+)?)\\s*mph','GUST',true),direction:extractOne(mainText,'Wind Direction\\s*:\\s*([+-]?\\d+(?:\\.\\d+)?)','DIRECTION',true)};
 const now=Date.now(),endpoint_results=[];for(const id of CFG.unmapped_high_frequency_endpoint_ids){const e=mem.get(id),latest=e.ps.at(-1),age=(now-latest.time)/MINUTE;req(latest.time<=now+CFG.matching_policy.future_timestamp_tolerance_minutes*MINUTE,`EA4UV_FUTURE:${id}`);req(age<=CFG.matching_policy.require_endpoint_freshness_minutes_max,`EA4UV_STALE:${id}:${age.toFixed(2)}`);const candidates=[...rainCandidates(e.ps,shown,now),...gustCandidates(e.ps,shown.gust,now),...directionCandidates(e.ps,shown.direction)];const roles=[...new Set(candidates.map((x)=>x.role_id))],resolved_role=roles.length===1?roles[0]:null,resolved_method=candidates.length===1?candidates[0].method_id:null;endpoint_results.push({endpoint_id:id,response_sha256:e.sha256,response_bytes:e.bytes,point_count:e.ps.length,latest_timestamp:new Date(latest.time).toISOString(),age_minutes:Number(age.toFixed(3)),candidate_method_ids:candidates.map((x)=>x.method_id),candidate_role_ids:roles,resolved_role_id:resolved_role,resolved_method_id:resolved_method,raw_numeric_sensor_values_emitted:false});}
 const allResolved=endpoint_results.every((x)=>x.resolved_role_id&&x.resolved_role_id!=='SOLAR_RADIATION'),solarExcluded=allResolved;Object.assign(result,{status:'PASS',retrieved_at:new Date(now).toISOString(),endpoint_results,rendered_numeric_values_emitted:false,raw_numeric_sensor_values_emitted:false,raw_json_body_persisted:false,rendered_dom_persisted:false,diagnostic_timezone:CFG.diagnostic_timezone.name,diagnostic_timezone_is_authority:false,all_unmapped_endpoints_resolved_to_non_solar_roles:allResolved,solar_excluded_from_current_high_frequency_endpoint_set:solarExcluded,solar_exclusion_is_source_authority:false,decision:solarExcluded?'EXCLUDED_SOLAR_FROM_KBS_CURRENT_PAGE_HIGH_FREQUENCY_ENDPOINT_SET':'UNRESOLVED_KBS_UNMAPPED_ENDPOINT_IDENTITY',source_authority_created:false,solar_source_authority_created:false,timezone_authority_created:false,source_substitution_authorized:false,ea5_authorized:false});write(result);console.log(JSON.stringify({status:result.status,decision:result.decision,endpoints:endpoint_results.map((x)=>({endpoint_id:x.endpoint_id,candidate_role_ids:x.candidate_role_ids,resolved_role_id:x.resolved_role_id,resolved_method_id:x.resolved_method_id})),solar_excluded:solarExcluded},null,2));
}catch(error){result.error=`${error.name||'Error'}:${error.message||String(error)}`;write(result);console.error(result.error);process.exitCode=1}finally{await browser?.close()}
