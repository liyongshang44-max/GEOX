#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const CFG=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-KBS-VARIATE-HOURLY-ROLE-ALIGNMENT-V1.json'),'utf8'));
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_09_EA4_KBS_VARIATE_HOURLY_ROLE_ALIGNMENT_RESULT.json');
const SUBJECT_SHA=process.env.MCFT_SUBJECT_SHA||'';
const PRIVATE_ROOT=fs.mkdtempSync(path.join(os.tmpdir(),'mcft-cap09-kbs-role-align-'));
const HOUR=3_600_000;
const sha256=(x)=>`sha256:${crypto.createHash('sha256').update(x).digest('hex')}`;
const req=(ok,code)=>{if(!ok)throw new Error(code)};
const write=(v)=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+'\n','utf8')};
const norm=(x)=>String(x??'').replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
const finite=(x)=>{const s=String(x??'').trim();if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null};

function retain(kind,id,body){
  const digest=sha256(body),file=path.join(PRIVATE_ROOT,crypto.createHash('sha256').update(`${kind}|${id}`).digest('hex')+'.raw');
  fs.writeFileSync(file,body);const reread=fs.readFileSync(file);
  req(sha256(reread)===digest,`EA4RA_RETENTION_DIGEST:${kind}`);req(reread.length===body.length,`EA4RA_RETENTION_BYTES:${kind}`);
  return{kind,identity:id,sha256:digest,bytes:body.length,private_retention_verified:true,raw_body_uploaded:false};
}
function parseCsvLine(line,delimiter){const out=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++}else quoted=!quoted}else if(c===delimiter&&!quoted){out.push(value);value=''}else value+=c}out.push(value);return out}
function parseProviderUtc(value){const raw=String(value??'').trim();if(!raw)return null;const cleaned=raw.replace(/\s+(?:UTC|GMT|\+0000|\+00:00|\+00)$/i,'').replace(/Z$/i,'').trim();let m=cleaned.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);if(m)return Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0));m=cleaned.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);if(m)return Date.UTC(+m[3],+m[1]-1,+m[2],+m[4],+m[5],+(m[6]||0));return null}
function parseCsv(body){
  const lines=body.toString('utf8').split(/\r?\n/),required=[CFG.reference_timestamp_column,...Object.values(CFG.reference_roles).map(x=>x.column)];let headers=null,delimiter=null,start=-1;
  for(let i=0;i<Math.min(lines.length,80);i++){if(!lines[i].trim())continue;for(const d of [',','\t',';','|']){const h=parseCsvLine(lines[i],d).map(norm);if(required.every(k=>h.includes(k))){headers=h;delimiter=d;start=i+1;break}}if(headers)break}
  req(headers,'EA4RA_CSV_REQUIRED_HEADER_NOT_FOUND');const rows=[];
  for(const line of lines.slice(start)){if(!line.trim())continue;const cells=parseCsvLine(line,delimiter);if(cells.length<headers.length)continue;const row={};headers.forEach((h,i)=>row[h]=cells[i]??'');const time=parseProviderUtc(row[CFG.reference_timestamp_column]);if(!Number.isFinite(time))continue;const values={};for(const[role,spec]of Object.entries(CFG.reference_roles))values[role]=finite(row[spec.column]);rows.push({time,values})}
  req(rows.length>0,'EA4RA_CSV_ROWS_REQUIRED');return{rows,headers};
}
function parseEndpoint(body,id){
  const json=JSON.parse(body.toString('utf8'));req(Array.isArray(json),`EA4RA_ENDPOINT_ARRAY:${id}`);const ps=json.map(x=>({time:Date.parse(String(x?.time??'')),value:Number(x?.value)})).filter(x=>Number.isFinite(x.time)&&Number.isFinite(x.value)).sort((a,b)=>a.time-b.time);req(ps.length>1,`EA4RA_ENDPOINT_POINTS:${id}`);return ps;
}
function aggregate(ps,method){
  const buckets=new Map();for(const p of ps){const h=Math.floor(p.time/HOUR)*HOUR;if(!buckets.has(h))buckets.set(h,[]);buckets.get(h).push(p)}const out=new Map();for(const[h,arr]of buckets){let value;if(method==='MEAN')value=arr.reduce((a,x)=>a+x.value,0)/arr.length;else if(method==='SUM')value=arr.reduce((a,x)=>a+x.value,0);else if(method==='LATEST')value=arr.reduce((a,x)=>x.time>a.time?x:a).value;else throw new Error(`EA4RA_UNKNOWN_AGG:${method}`);if(Number.isFinite(value))out.set(h,value)}return out;
}
function fit(xs,ys){
  const n=xs.length;req(n===ys.length&&n>1,'EA4RA_FIT_INPUT');const mx=xs.reduce((a,b)=>a+b,0)/n,my=ys.reduce((a,b)=>a+b,0)/n;let sxx=0,syy=0,sxy=0;for(let i=0;i<n;i++){const dx=xs[i]-mx,dy=ys[i]-my;sxx+=dx*dx;syy+=dy*dy;sxy+=dx*dy}if(sxx<=0||syy<=0)return{r_squared:0,affine_nrmse:null};const slope=sxy/sxx,intercept=my-slope*mx;let sse=0;for(let i=0;i<n;i++){const e=ys[i]-(slope*xs[i]+intercept);sse+=e*e}const r2=Math.max(0,Math.min(1,(sxy*sxy)/(sxx*syy))),rmse=Math.sqrt(sse/n),std=Math.sqrt(syy/n);return{r_squared:r2,affine_nrmse:std>0?rmse/std:null};
}
function candidateMetrics(endpoint,refMap,role,method,offsetHours){
  const agg=aggregate(endpoint,method),xs=[],ys=[];let refNonzero=0;for(const[h,x]of agg){const y=refMap.get(h+offsetHours*HOUR)?.[role];if(!Number.isFinite(y))continue;xs.push(x);ys.push(y);if(Math.abs(y)>1e-12)refNonzero++}if(xs.length<2)return{role,method,offset_hours:offsetHours,pair_count:xs.length,reference_nonzero_count:refNonzero,r_squared:0,affine_nrmse:null};const f=fit(xs,ys);return{role,method,offset_hours:offsetHours,pair_count:xs.length,reference_nonzero_count:refNonzero,r_squared:Number(f.r_squared.toFixed(8)),affine_nrmse:Number.isFinite(f.affine_nrmse)?Number(f.affine_nrmse.toFixed(8)):null};
}
function qualifies(m){const t=CFG.identity_thresholds;if(m.pair_count<t.minimum_pair_count||m.r_squared<t.minimum_r_squared||!Number.isFinite(m.affine_nrmse)||m.affine_nrmse>t.maximum_affine_nrmse)return false;if(m.role==='RAINFALL'&&m.reference_nonzero_count<t.rainfall_minimum_reference_nonzero_pairs)return false;return true}

let browser;
const result={schema_version:'geox_mcft_cap09_ea4_kbs_variate_hourly_role_alignment_result_v1',status:'FAIL',subject_sha:SUBJECT_SHA||null,endpoint_role_authority_created:false,solar_source_authority_created:false,rainfall_source_authority_created:false,timezone_authority_created:false,source_substitution_authorized:false,ea5_authorized:false,database_write_count:0,formal_evidence_write_count:0,raw_numeric_values_emitted:false,raw_payload_uploaded:false};
try{
  req(/^[0-9a-f]{40}$/.test(SUBJECT_SHA),'EA4RA_EXACT_SUBJECT_SHA_REQUIRED');browser=await chromium.launch({headless:true});const context=await browser.newContext({locale:'en-US',timezoneId:'UTC'});const receipts=[],endpointSeries=new Map(),endpointReceipts=new Map();
  for(const id of CFG.unmapped_endpoint_ids){const url=CFG.endpoint_template.replace('{id}',String(id)),r=await context.request.get(url,{timeout:60_000,headers:{accept:'application/json,*/*;q=0.5'}});req(r.ok(),`EA4RA_ENDPOINT_HTTP:${id}:${r.status()}`);const body=await r.body(),receipt=retain('KBS_VARIATE',String(id),body);receipts.push(receipt);endpointReceipts.set(id,receipt);endpointSeries.set(id,parseEndpoint(body,id))}
  const csvResponse=await context.request.get(CFG.raw_hourly_csv,{timeout:120_000,headers:{accept:'text/csv,text/plain;q=0.9,*/*;q=0.5'}});req(csvResponse.ok(),`EA4RA_CSV_HTTP:${csvResponse.status()}`);const csvBody=await csvResponse.body(),csvReceipt=retain('KBS_RAW_HOURLY','13',csvBody);receipts.push(csvReceipt);const parsed=parseCsv(csvBody),refMap=new Map(parsed.rows.map(r=>[r.time,r.values]));const refTimes=parsed.rows.map(r=>r.time).sort((a,b)=>a-b),referenceStart=refTimes[0],referenceEnd=refTimes.at(-1);
  const endpoint_results=[];
  for(const id of CFG.unmapped_endpoint_ids){
    const ps=endpointSeries.get(id),overlap=ps.filter(p=>p.time>=referenceStart-2*HOUR&&p.time<=referenceEnd+2*HOUR),metrics=[];
    for(const[role,spec]of Object.entries(CFG.reference_roles))for(const method of spec.aggregation_methods)for(const offset of CFG.allowed_hour_alignment_offsets)metrics.push(candidateMetrics(overlap,refMap,role,method,offset));
    metrics.sort((a,b)=>b.r_squared-a.r_squared||((a.affine_nrmse??999)-(b.affine_nrmse??999))||b.pair_count-a.pair_count);
    const top=metrics[0],bestOtherRole=metrics.find(m=>m.role!==top.role),roleGap=bestOtherRole?top.r_squared-bestOtherRole.r_squared:1;
    const uniqueRole=qualifies(top)&&roleGap>=CFG.identity_thresholds.minimum_runner_up_r_squared_gap;
    const receipt=endpointReceipts.get(id);
    endpoint_results.push({endpoint_id:id,response_sha256:receipt.sha256,response_bytes:receipt.bytes,point_count:ps.length,overlap_point_count:overlap.length,overlap_start_utc:overlap.length?new Date(overlap[0].time).toISOString():null,overlap_end_utc:overlap.length?new Date(overlap.at(-1).time).toISOString():null,top_candidates:metrics.slice(0,8),best_other_role_candidate:bestOtherRole??null,role_r_squared_gap:Number(roleGap.toFixed(8)),resolved_role_id:uniqueRole?top.role:null,resolved_method_id:uniqueRole?top.method:null,resolved_offset_hours:uniqueRole?top.offset_hours:null,unique_physical_role_threshold_passed:uniqueRole});
  }
  const solarIds=endpoint_results.filter(x=>x.resolved_role_id==='SOLAR_RADIATION').map(x=>x.endpoint_id),rainIds=endpoint_results.filter(x=>x.resolved_role_id==='RAINFALL').map(x=>x.endpoint_id);
  Object.assign(result,{status:'PASS',retrieved_at:new Date().toISOString(),raw_retention:{receipt_count:receipts.length,receipts:receipts.map(x=>({kind:x.kind,identity:x.identity,sha256:x.sha256,bytes:x.bytes,private_retention_verified:x.private_retention_verified,raw_body_uploaded:false})),all_retained_before_parse:true},raw_hourly_reference:{response_sha256:csvReceipt.sha256,response_bytes:csvReceipt.bytes,reference_start_utc:new Date(referenceStart).toISOString(),reference_end_utc:new Date(referenceEnd).toISOString(),stale_reference_used_only_for_role_identity:true,live_source_claimed:false},endpoint_results,solar_candidate_endpoint_ids:solarIds,rainfall_candidate_endpoint_ids:rainIds,decision:solarIds.length===1?'UNIQUE_KBS_HIGH_FREQUENCY_SOLAR_ROLE_DIAGNOSTIC_MATCH':rainIds.length===1?'UNIQUE_KBS_HIGH_FREQUENCY_RAIN_ROLE_DIAGNOSTIC_MATCH':'NO_UNIQUE_HIGH_FREQUENCY_SOLAR_OR_RAIN_ROLE_MATCH',endpoint_role_authority_created:false,solar_source_authority_created:false,rainfall_source_authority_created:false,timezone_authority_created:false,source_substitution_authorized:false,ea5_authorized:false,database_write_count:0,formal_evidence_write_count:0,raw_numeric_values_emitted:false,raw_payload_uploaded:false});
  write(result);console.log(JSON.stringify({status:'PASS',decision:result.decision,endpoints:endpoint_results.map(x=>({endpoint_id:x.endpoint_id,resolved_role_id:x.resolved_role_id,resolved_method_id:x.resolved_method_id,resolved_offset_hours:x.resolved_offset_hours,role_r_squared_gap:x.role_r_squared_gap,top_candidate:x.top_candidates[0],best_other_role_candidate:x.best_other_role_candidate})),solar_candidate_endpoint_ids:solarIds,rainfall_candidate_endpoint_ids:rainIds},null,2));await context.close();
}catch(error){result.error=`${error.name||'Error'}:${error.message||String(error)}`;write(result);console.error(result.error);process.exitCode=1}finally{await browser?.close()}
