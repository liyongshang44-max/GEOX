#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const CONFIG=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA4-HADS-BDLM4-SOLAR-DISCOVERY-V1.json'),'utf8'));
const OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_09_EA4_HADS_BDLM4_SOLAR_DISCOVERY_RESULT.json');
const SUBJECT_SHA=process.env.MCFT_SUBJECT_SHA||'';
const PRIVATE_ROOT=fs.mkdtempSync(path.join(os.tmpdir(),'mcft-cap09-hads-bdlm4-'));
const sha256=(input)=>`sha256:${crypto.createHash('sha256').update(input).digest('hex')}`;
const write=(value)=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(value,null,2)}\n`,'utf8')};
const requireCondition=(ok,code)=>{if(!ok)throw new Error(code)};
const decodeEntities=(value)=>String(value||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&deg;/gi,'°').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
const stripTags=(value)=>decodeEntities(String(value||'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();

async function fetchRaw(url,code,maxBytes=8_000_000){
  const response=await fetch(url,{headers:{'User-Agent':'GEOX-MCFT-CAP09-HADS-SOLAR-DISCOVERY/1.0','Accept':'text/html,text/plain;q=0.9,*/*;q=0.5','Cache-Control':'no-cache'},redirect:'follow'});
  requireCondition(response.ok,`${code}_HTTP_${response.status}`);
  const final=new URL(response.url);requireCondition(final.protocol==='https:'&&final.hostname==='hads.ncep.noaa.gov',`${code}_FINAL_IDENTITY_DRIFT`);
  const buffer=Buffer.from(await response.arrayBuffer());requireCondition(buffer.length>0&&buffer.length<=maxBytes,`${code}_BODY_SIZE_INVALID:${buffer.length}`);
  return{body:buffer,status:response.status,final_url:`${final.origin}${final.pathname}`,content_type:String(response.headers.get('content-type')||'')};
}
function retain(body,identity){
  const digest=sha256(body),file=path.join(PRIVATE_ROOT,`${crypto.createHash('sha256').update(identity).digest('hex')}.raw`);fs.writeFileSync(file,body);const reread=fs.readFileSync(file);requireCondition(sha256(reread)===digest,'EA4HADS_RAW_RETENTION_DIGEST_MISMATCH');requireCondition(reread.length===body.length,'EA4HADS_RAW_RETENTION_BYTE_MISMATCH');return{sha256:digest,bytes:body.length,private_retention_verified:true,raw_body_uploaded:false};
}
function htmlRows(html){
  const rows=[];for(const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const cells=[];for(const cell of match[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi))cells.push(stripTags(cell[1]));if(cells.length)rows.push(cells);}return rows;
}
function normalize(value){return String(value||'').toUpperCase().replace(/[^A-Z0-9.+:/-]+/g,' ').replace(/\s+/g,' ').trim();}
function numeric(value){const raw=String(value||'').replace(/,/g,'').trim();const match=raw.match(/^[<>]?\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/);if(!match)return null;const n=Number(match[1]);return Number.isFinite(n)?n:null;}
function parseTime(value,allowImplicitUtc){
  const raw=String(value||'').trim();let ms=Date.parse(raw);if(Number.isFinite(ms)&&/[zZ]|[+-]\d{2}:?\d{2}/.test(raw))return{ms,class:'EXPLICIT_OFFSET'};
  const formats=[/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/, /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/];
  let m=raw.match(formats[0]);if(m&&allowImplicitUtc)return{ms:Date.UTC(+m[3],+m[1]-1,+m[2],+m[4],+m[5],+(m[6]||0)),class:'NAIVE_WITH_PAGE_GMT_UTC_LABEL'};
  m=raw.match(formats[1]);if(m&&allowImplicitUtc)return{ms:Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0)),class:'NAIVE_WITH_PAGE_GMT_UTC_LABEL'};
  return{ms:null,class:raw?'NAIVE_OR_UNPARSED_NO_TIMEZONE_AUTHORITY':'MISSING'};
}
function haversineKm(lat1,lon1,lat2,lon2){const r=6371.0088,toRad=(v)=>v*Math.PI/180,p1=toRad(lat1),p2=toRad(lat2),dp=toRad(lat2-lat1),dl=toRad(lon2-lon1),a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*r*Math.asin(Math.sqrt(a));}

const result={schema_version:'geox_mcft_cap09_ea4_hads_bdlm4_solar_discovery_result_v1',status:'FAIL',subject_sha:SUBJECT_SHA||null,database_write_count:0,formal_evidence_write_count:0,public_raw_numeric_value_emission_count:0,raw_body_uploaded:false,solar_qualified:false,source_authority_created:false,ea5_authorized:false};
try{
  requireCondition(/^[0-9a-f]{40}$/.test(SUBJECT_SHA),'EA4HADS_EXACT_SUBJECT_SHA_REQUIRED');
  const metaRaw=await fetchRaw(CONFIG.metadata_page,'EA4HADS_METADATA');const metaReceipt=retain(metaRaw.body,CONFIG.metadata_page);const metaHtml=metaRaw.body.toString('utf8');const metaRows=htmlRows(metaHtml);const stationRows=metaRows.filter((cells)=>cells.some((cell)=>normalize(cell).includes('BDLM4')));requireCondition(stationRows.length>=1,'EA4HADS_BDLM4_METADATA_ROW_REQUIRED');const stationText=normalize(stationRows.map((row)=>row.join(' | ')).join(' '));for(const token of ['PLAINWELL RAWS','BDLM4','080010B4','RW','60'])requireCondition(stationText.includes(token),`EA4HADS_METADATA_TOKEN_MISSING:${token}`);

  const decodedRaw=await fetchRaw(CONFIG.decoded_data_url,'EA4HADS_DECODED',12_000_000);const decodedReceipt=retain(decodedRaw.body,CONFIG.decoded_data_url);const decodedHtml=decodedRaw.body.toString('utf8');const decodedText=stripTags(decodedHtml);const provisional=/DATA VALUES ARE PROVISIONAL/i.test(decodedText);requireCondition(provisional,'EA4HADS_PROVISIONAL_LABEL_REQUIRED');const pageTimeZoneLabel=/\b(?:GMT|UTC)\b/i.test(decodedText);
  const rows=htmlRows(decodedHtml);let headerIndex=-1,rwIndex=-1,timeIndex=-1,header=[];
  for(let i=0;i<rows.length;i++){const cells=rows[i].map(normalize);const candidateRw=cells.findIndex((cell)=>/^RW\b/.test(cell)||cell.includes(' RW '));const candidateTime=cells.findIndex((cell)=>cell.includes('OBSERVATION TIME')||cell==='TIME'||cell.includes('DATE TIME'));if(candidateRw>=0){headerIndex=i;rwIndex=candidateRw;timeIndex=candidateTime>=0?candidateTime:0;header=rows[i];break;}}
  requireCondition(headerIndex>=0&&rwIndex>=0,'EA4HADS_RW_COLUMN_REQUIRED');
  const observations=[];const timeClasses=new Set();
  for(let i=headerIndex+1;i<rows.length;i++){const row=rows[i];if(row.length<=Math.max(rwIndex,timeIndex))continue;const value=numeric(row[rwIndex]);if(value===null)continue;const parsed=parseTime(row[timeIndex],pageTimeZoneLabel);timeClasses.add(parsed.class);observations.push({raw_time_sha256:sha256(Buffer.from(String(row[timeIndex]))),time_ms:parsed.ms,value});}
  requireCondition(observations.length>0,'EA4HADS_RW_NUMERIC_VALUES_REQUIRED');const parsed=observations.filter((x)=>Number.isFinite(x.time_ms)).sort((a,b)=>a.time_ms-b.time_ms);const latest=parsed.length?parsed.at(-1).time_ms:null;const now=Date.now();const ageHours=Number.isFinite(latest)?(now-latest)/3600000:null;const gaps=[];for(let i=1;i<parsed.length;i++)gaps.push((parsed[i].time_ms-parsed[i-1].time_ms)/60000);const recent=Number.isFinite(latest)?parsed.filter((x)=>x.time_ms>=latest-24*3600000&&x.time_ms<=latest):[];
  const sequenceHash=sha256(Buffer.from(JSON.stringify(observations.map((x)=>[x.raw_time_sha256,String(x.value)]))));
  const distanceKm=haversineKm(CONFIG.kbs_reference.latitude,CONFIG.kbs_reference.longitude,CONFIG.station_candidate.latitude_decimal,CONFIG.station_candidate.longitude_decimal);
  Object.assign(result,{status:'PASS',probe_observed_at_utc:new Date(now).toISOString(),metadata:{response_status:metaRaw.status,sha256:metaReceipt.sha256,bytes:metaReceipt.bytes,station_identity_match:true,rw_60min_declared:true,provider_owner:CONFIG.station_candidate.owner},decoded:{response_status:decodedRaw.status,sha256:decodedReceipt.sha256,bytes:decodedReceipt.bytes,provisional_label_present:provisional,page_gmt_or_utc_label_present:pageTimeZoneLabel,header_sha256:sha256(Buffer.from(JSON.stringify(header))),header_cell_count:header.length,rw_column_index:rwIndex,time_column_index:timeIndex,numeric_rw_count:observations.length,parsed_timestamp_count:parsed.length,timestamp_class_set:[...timeClasses].sort(),latest_observation_utc:Number.isFinite(latest)&&pageTimeZoneLabel?new Date(latest).toISOString():null,latest_age_hours:Number.isFinite(ageHours)&&pageTimeZoneLabel?Number(ageHours.toFixed(3)):null,recent_24h_numeric_count:recent.length,min_gap_minutes:gaps.length?Math.min(...gaps):null,max_gap_minutes:gaps.length?Math.max(...gaps):null,rw_sequence_sha256:sequenceHash,raw_numeric_values_emitted:false},spatial_diagnostic:{kbs_latitude:CONFIG.kbs_reference.latitude,kbs_longitude:CONFIG.kbs_reference.longitude,bdlm4_latitude:CONFIG.station_candidate.latitude_decimal,bdlm4_longitude:CONFIG.station_candidate.longitude_decimal,haversine_distance_km:Number(distanceKm.toFixed(3)),distance_authority_created:false,field_or_kbs_equivalence_claimed:false},quality_boundary:{provider_values_provisional:true,provider_quality_checked_claimed:false,source_authority_created:false,spatial_representativeness_authority_created:false},solar_candidate_present:true,solar_qualified:false,source_authority_created:false,ea5_authorized:false,database_write_count:0,formal_evidence_write_count:0,public_raw_numeric_value_emission_count:0,raw_body_uploaded:false});
  write(result);console.log(JSON.stringify({status:'PASS',rw_numeric_count:result.decoded.numeric_rw_count,parsed_timestamp_count:result.decoded.parsed_timestamp_count,page_time_zone_label:result.decoded.page_gmt_or_utc_label_present,latest_age_hours:result.decoded.latest_age_hours,distance_km:result.spatial_diagnostic.haversine_distance_km,provisional:true,solar_qualified:false},null,2));
}catch(error){result.error=`${error.name||'Error'}:${error.message||String(error)}`;write(result);console.error(result.error);process.exitCode=1;}
