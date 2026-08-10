#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const AUTH=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA5E2-KBS-RPET-CONTINGENCY-QUALIFICATION-V1.json'),'utf8'));
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_09_EA5E2_KBS_RPET_CONTINGENCY_QUALIFICATION_RESULT.json');
const SUBJECT_SHA=process.env.MCFT_SUBJECT_SHA||'';
const PRIVATE_ROOT=fs.mkdtempSync(path.join(os.tmpdir(),'mcft-cap09-rpet-'));
const sha256=(input)=>`sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
const requireCondition=(ok,code)=>{if(!ok)throw new Error(code)};
const text=(value)=>String(value??'').trim();
const finite=(value)=>{if(value===null||value===undefined||text(value)==='')return null;const raw=text(value).replace(/,/g,'');if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw))return null;const n=Number(raw);return Number.isFinite(n)?n:null};
const write=(value)=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(value,null,2)}\n`,'utf8')};

function directUrl(){
  const now=new Date();
  const date=`${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-${String(now.getUTCDate()).padStart(2,'0')}`;
  const url=new URL(AUTH.provider_binding_candidate.source_page);
  url.searchParams.set('duration','24');
  url.searchParams.set('run','1');
  url.searchParams.set('selectDate',date);
  url.searchParams.set('selectedStation','kbs');
  url.searchParams.set('units','us');
  return url.toString();
}
function timestampClass(raw){const v=text(raw);if(/Z$/i.test(v))return'EXPLICIT_Z';if(/[+-]\d{2}:?\d{2}$/.test(v))return'EXPLICIT_OFFSET';if(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(v)||/^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}/.test(v))return'NAIVE_DATE_TIME';return'UNKNOWN'}
function naiveUtc(raw){const v=text(raw);let m=v.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);if(m)return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0));m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);if(m)return Date.UTC(+m[3],+m[1]-1,+m[2],+m[4],+m[5],+(m[6]||0));return null}
function tzOffset(utcMs,timeZone){const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(utcMs));const map=Object.fromEntries(parts.filter((x)=>x.type!=='literal').map((x)=>[x.type,x.value]));return Date.UTC(+map.year,+map.month-1,+map.day,+map.hour,+map.minute,+map.second)-utcMs}
function naiveDetroit(raw){const n=naiveUtc(raw);if(n===null)return null;let guess=n;for(let i=0;i<2;i+=1)guess=n-tzOffset(guess,'America/Detroit');return guess}
function chooseParser(rows){const classes=[...new Set(rows.map((row)=>timestampClass(row.datetime)))];if(classes.every((x)=>['EXPLICIT_Z','EXPLICIT_OFFSET'].includes(x)))return{class:'PROVIDER_EXPLICIT_OFFSET',parse:(raw)=>{const ms=Date.parse(text(raw));return Number.isFinite(ms)?ms:null}};if(classes.length===1&&classes[0]==='NAIVE_DATE_TIME')return{class:'PROVIDER_NAIVE_DIAGNOSTIC_AMERICA_DETROIT_ONLY',parse:naiveDetroit};return{class:`UNRESOLVED_MIXED:${classes.join(',')}`,parse:()=>null}}
function retainBeforeParse(body,identity){const digest=sha256(body),file=path.join(PRIVATE_ROOT,`${crypto.createHash('sha256').update(identity).digest('hex')}.raw`);fs.writeFileSync(file,body);const reread=fs.readFileSync(file);requireCondition(sha256(reread)===digest,'RPET_RAW_RETENTION_DIGEST_MISMATCH');requireCondition(reread.length===body.length,'RPET_RAW_RETENTION_BYTE_MISMATCH');return{sha256:digest,bytes:body.length,private_retention_verified:true,raw_body_uploaded:false}}
function safeHeader(entry){if(!entry||typeof entry!=='object')return null;const allowed=['name','header','extraText','formatIn','type','displayIn'];return Object.fromEntries(allowed.filter((key)=>entry[key]!==undefined).map((key)=>[key,typeof entry[key]==='string'?entry[key].slice(0,200):entry[key]]))}
function gapStats(times){const sorted=[...new Set(times)].sort((a,b)=>a-b),gaps=[];for(let i=1;i<sorted.length;i+=1)gaps.push((sorted[i]-sorted[i-1])/60000);return{distinct_count:sorted.length,min_gap_minutes:gaps.length?Math.min(...gaps):null,max_gap_minutes:gaps.length?Math.max(...gaps):null,all_gaps_60m:gaps.length>0&&gaps.every((x)=>Math.abs(x-60)<1e-9)}}
function fieldSummary(rows,field){const raw=rows.map((x)=>x[field]),nonnull=raw.filter((x)=>x!==null&&x!==undefined&&text(x)!==''),numeric=nonnull.map(finite).filter((x)=>x!==null);return{row_count:rows.length,nonnull_count:nonnull.length,numeric_count:numeric.length,null_or_empty_count:rows.length-nonnull.length,non_numeric_nonempty_count:nonnull.length-numeric.length,value_type_set:[...new Set(nonnull.map((x)=>typeof x))].sort()}}
function estimated(metadata){return Boolean(metadata?.EstimatedData?.hourly?.rpet)}
function invalidSummary(metadata){const node=metadata?.InvalidData?.hourly?.rpet,list=Array.isArray(node?.list)?node.list:[];return{present:Boolean(node),entry_count:list.length,list_sha256:sha256(Buffer.from(JSON.stringify(list)))}}
function methodKeyPaths(value,prefix='',out=[]){if(!value||typeof value!=='object')return out;for(const [key,item] of Object.entries(value)){const next=prefix?`${prefix}.${key}`:key;if(/(?:rpet|evapo|method|penman|reference)/i.test(key))out.push(next);if(item&&typeof item==='object')methodKeyPaths(item,next,out)}return [...new Set(out)].sort()}

let browser;
const result={schema_version:'geox_mcft_cap09_ea5e2_kbs_rpet_contingency_qualification_result_v1',status:'FAIL',subject_sha:SUBJECT_SHA||null,database_write_count:0,formal_evidence_write_count:0,r2_formal_write_count:0,public_raw_numeric_value_emission_count:0,raw_body_uploaded:false,source_substitution_authorized:false,ea5e2_effectiveness_changed:false,formal_o00_authorized:false};
try{
  requireCondition(/^[0-9a-f]{40}$/.test(SUBJECT_SHA),'RPET_EXACT_SUBJECT_SHA_REQUIRED');
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({locale:'en-US',timezoneId:'UTC',acceptDownloads:false});
  const page=await context.newPage();
  let captured=null;
  const tasks=[];
  page.on('response',(response)=>{const task=(async()=>{const url=new URL(response.url());if(url.hostname!==AUTH.provider_binding_candidate.api_host||url.pathname!==AUTH.provider_binding_candidate.api_path||response.status()!==200)return;if(!AUTH.provider_binding_candidate.required_query_keys.every((key)=>text(url.searchParams.get(key))))return;const body=await response.body(),receipt=retainBeforeParse(body,`${url.hostname}${url.pathname}|${url.search}`),parsed=JSON.parse(body.toString('utf8')),rows=parsed?.data?.Table;if(!Array.isArray(rows)||rows.length<2)return;if(!captured||body.length>captured.body_bytes)captured={url,parsed,receipt,body_bytes:body.length}})();tasks.push(task);task.catch(()=>{})});
  const pageResponse=await page.goto(directUrl(),{waitUntil:'domcontentloaded',timeout:60000});
  requireCondition(pageResponse&&pageResponse.status()>=200&&pageResponse.status()<400,'RPET_SOURCE_PAGE_FAILED');
  await page.waitForTimeout(18000);await Promise.allSettled(tasks);requireCondition(captured,'RPET_NO_COMPLETE_RUN_RESPONSE');
  const{url,parsed,receipt}=captured;
  const query=Object.fromEntries(AUTH.provider_binding_candidate.required_query_keys.map((key)=>[key,url.searchParams.get(key)]));
  requireCondition(query.selectedStation==='kbs'&&query.duration==='24','RPET_QUERY_SCOPE_DRIFT');
  const stationText=JSON.stringify(parsed?.metadata?.Station??parsed?.metadata??'').toLowerCase();
  requireCondition(AUTH.provider_binding_candidate.station_identity_patterns.some((value)=>stationText.includes(value.toLowerCase())),'RPET_STATION_IDENTITY_NOT_PROVEN');
  const rows=parsed.data.Table,headers=Array.isArray(parsed?.data?.TableHeaders)?parsed.data.TableHeaders:[];
  const rpetHeader=headers.find((x)=>x?.name===AUTH.provider_binding_candidate.rpet_field);
  requireCondition(rpetHeader,'RPET_HEADER_METADATA_REQUIRED');
  const parser=chooseParser(rows),parsedRows=rows.map((row)=>({row,time:parser.parse(row.datetime)})),timestampParsedCount=parsedRows.filter((x)=>Number.isFinite(x.time)).length;
  const violations=[];
  if(timestampParsedCount!==rows.length)violations.push(`TIMESTAMP_PARSE_COUNT:${timestampParsedCount}/${rows.length}`);
  if(parser.class==='PROVIDER_NAIVE_DIAGNOSTIC_AMERICA_DETROIT_ONLY')violations.push('TIMESTAMP_TIMEZONE_AUTHORITY_REQUIRES_EXPLICIT_BINDING');
  if(parser.class.startsWith('UNRESOLVED_'))violations.push(parser.class);
  const validRows=parsedRows.filter((x)=>Number.isFinite(x.time));
  const now=Date.now();
  const rpet=validRows.map((x)=>({time:x.time,value:finite(x.row[AUTH.provider_binding_candidate.rpet_field])})).filter((x)=>x.value!==null).sort((a,b)=>a.time-b.time);
  const summary=fieldSummary(rows,AUTH.provider_binding_candidate.rpet_field);
  if(rpet.length===0)violations.push('RPET_NO_NUMERIC_VALUES');
  if(rpet.some((x)=>x.value<0))violations.push('RPET_NEGATIVE_VALUE');
  const latest=rpet.length?rpet[rpet.length-1].time:null;
  const earliestWindow=Number.isFinite(latest)?latest-24*3600000:null;
  const window=Number.isFinite(latest)?rpet.filter((x)=>x.time>=earliestWindow&&x.time<=latest):[];
  const grid=gapStats(window.map((x)=>x.time));
  const latestAge=Number.isFinite(latest)?(now-latest)/3600000:null;
  if(window.length<24||!grid.all_gaps_60m)violations.push(`RPET_24H_HOURLY_GRID:${JSON.stringify(grid)}`);
  if(Number.isFinite(latestAge)&&(latestAge<-.1||latestAge>AUTH.technical_qualification_requirements.latest_observed_max_age_hours))violations.push(`LATEST_RPET_AGE_HOURS:${latestAge.toFixed(3)}`);
  const providerEstimated=estimated(parsed.metadata);if(providerEstimated)violations.push('RPET_PROVIDER_ESTIMATED');
  const invalid=invalidSummary(parsed.metadata);
  const methodKeys=methodKeyPaths(parsed.metadata).filter((x)=>/(rpet|evapo|method|penman|reference)/i.test(x));
  violations.push('ASCE_SHORT_REFERENCE_HOURLY_METHOD_EQUIVALENCE_NOT_ESTABLISHED');
  const technicallyValueBearing=rpet.length>0&&window.length>=24&&grid.all_gaps_60m&&(!Number.isFinite(latestAge)||latestAge<=AUTH.technical_qualification_requirements.latest_observed_max_age_hours)&&!providerEstimated;
  Object.assign(result,{status:'PASS',qualification_status:violations.length===0?'QUALIFIED_FOR_SOURCE_ARCHITECTURE_ADJUDICATION':'REJECTED_OR_INCOMPLETE_FOR_FORMAL_SUBSTITUTION',decision:violations.length===0?AUTH.live_qualification.success_decision:AUTH.live_qualification.failure_decision,probe_observed_at_utc:new Date(now).toISOString(),source_identity:{host:url.hostname,path:url.pathname,method:'GET',duration:query.duration,selectedStation:query.selectedStation,resultModelCode:query.resultModelCode,resultModelId:query.resultModelId,stationCode:query.stationCode,stationId:query.stationId,stationType:query.stationType,units:query.units},raw_retention:receipt,station_identity_proven:true,table:{row_count:rows.length,timestamp_policy:parser.class,timestamp_parsed_count:timestampParsedCount},header_metadata:{rpet:safeHeader(rpetHeader)},field_diagnostics:{rpet:summary},observed_candidate:{numeric_count_total:rpet.length,numeric_count_24h:window.length,hourly_grid:grid,latest_rpet_time_diagnostic_utc:Number.isFinite(latest)?new Date(latest).toISOString():null,latest_rpet_age_hours:Number.isFinite(latestAge)?Number(latestAge.toFixed(3)):null,provider_estimated:providerEstimated,invalid_metadata:invalid,sequence_sha256:window.length?sha256(Buffer.from(JSON.stringify(window.map((x)=>[new Date(x.time).toISOString(),String(x.value)])))):null},method_metadata_key_paths:methodKeys,technical_value_bearing_candidate:technicallyValueBearing,asce_short_reference_hourly_equivalence_established:false,violations,source_architecture_amendment_required:true,source_substitution_authorized:false,ea5e2_effectiveness_changed:false,formal_o00_authorized:false,database_write_count:0,formal_evidence_write_count:0,r2_formal_write_count:0,public_raw_numeric_value_emission_count:0,raw_body_uploaded:false});
  write(result);
  console.log(JSON.stringify({status:result.status,qualification_status:result.qualification_status,decision:result.decision,header_metadata:result.header_metadata,field_diagnostics:result.field_diagnostics,observed_candidate:result.observed_candidate,technical_value_bearing_candidate:result.technical_value_bearing_candidate,asce_short_reference_hourly_equivalence_established:false,violations},null,2));
  await context.close();
}catch(error){result.error=`${error.name||'Error'}:${error.message||String(error)}`;write(result);console.error(result.error);process.exitCode=1}finally{await browser?.close()}
