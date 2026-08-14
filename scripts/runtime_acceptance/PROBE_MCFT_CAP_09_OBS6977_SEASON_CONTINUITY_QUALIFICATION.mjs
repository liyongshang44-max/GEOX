#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_OBS6977_SEASON_CONTINUITY_QUALIFICATION.json');
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const HOST = 'aglog.kbs.msu.edu';
const KBS_HOST = 'lter.kbs.msu.edu';
const PLANTING_ID = 6931;
const ANCHOR_ID = 6977;
const PLANTING_DATE = '2026-05-11';
const ANCHOR_DATE = '2026-05-27';
const PLANTING_URL = `https://${HOST}/observations/${PLANTING_ID}`;
const ANCHOR_URL = `https://${HOST}/observations/${ANCHOR_ID}`;
const T1R1_URL = `https://${HOST}/areas/1`;
const PRACTICES_URL = `https://${KBS_HOST}/datasets/7`;
const RESET_EVENT = /\b(planting|harvest|termination|terminate|mowing)\b/i;
const CROP_TOKENS = ['corn','maize','soybean','wheat','barley','rye','canola','sorghum'];
const HYBRID_PATTERN = /\bP\d{4}[A-Z0-9-]*\b/g;

function assert(condition, code) { if (!condition) throw new Error(code); }
function normalize(value) { return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
function dateOnly(value) { const m = String(value || '').match(/\b(\d{4}-\d{2}-\d{2})\b/); return m ? m[1] : null; }
function sha256(bytes) { return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`; }
function safeError(error) { return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g,'[URL_REDACTED]'); }
function write(value) { fs.mkdirSync(path.dirname(OUT),{recursive:true}); fs.writeFileSync(OUT,`${JSON.stringify(value,null,2)}\n`,'utf8'); console.log(JSON.stringify(value)); }
function tokenProfile(text) {
  const crops = CROP_TOKENS.filter((token)=>new RegExp(`\\b${token}\\b`,'i').test(text));
  const hybrids = [...new Set((text.match(HYBRID_PATTERN)||[]).map((v)=>v.toUpperCase()))].sort();
  return { crop_tokens:[...new Set(crops)].sort(), hybrid_tokens:hybrids };
}
async function fetchProof(page,url,allowedHost) {
  const requested=new URL(url);
  assert(requested.hostname===allowedHost,'OBS6977_CONTINUITY_UNAPPROVED_HOST');
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:75_000});
  assert(response?.ok(),`OBS6977_CONTINUITY_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  const finalUrl=new URL(response.url());
  assert(finalUrl.hostname===allowedHost,'OBS6977_CONTINUITY_REDIRECT_HOST_FORBIDDEN');
  const bytes=await response.body();
  const text=normalize(await page.locator('body').innerText());
  return { text, proof:{response_sha256:sha256(bytes),response_bytes:bytes.byteLength,retrieved_at:new Date().toISOString(),provider_body_emitted:false} };
}
async function parseAreaRows(page) {
  const tableRows=page.locator('table tr');
  const rows=[];
  for(let i=0;i<await tableRows.count();i+=1){
    const cells=tableRows.nth(i).locator('td');
    if(await cells.count()<5) continue;
    const values=[];
    for(let c=0;c<await cells.count();c+=1) values.push(normalize(await cells.nth(c).innerText()));
    const observationDate=dateOnly(values[0]);
    if(!observationDate) continue;
    let observationId=null;
    const links=tableRows.nth(i).locator('a[href*="/observations/"]');
    for(let l=0;l<await links.count();l+=1){
      const href=await links.nth(l).getAttribute('href');
      const match=String(href||'').match(/\/observations\/(\d+)/);
      if(match){ observationId=Number(match[1]); break; }
    }
    if(!Number.isInteger(observationId)) continue;
    rows.push({provider_observation_id:observationId,observation_date:observationDate,observation_type:values[1]||values[2]||''});
  }
  return [...new Map(rows.map((r)=>[r.provider_observation_id,r])).values()];
}

async function main(){
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA),'OBS6977_CONTINUITY_EXACT_SUBJECT_REQUIRED');
  const browser=await chromium.launch({headless:true});
  try{
    const context=await browser.newContext({userAgent:'GEOX-MCFT-CAP09-Obs6977-Season-Continuity/1.0'});
    const page=await context.newPage();

    const planting=await fetchProof(page,PLANTING_URL,HOST);
    for(const marker of [PLANTING_DATE,'Planting','T1','corn','P0306Q']) assert(planting.text.toLowerCase().includes(marker.toLowerCase()),`OBS6977_CONTINUITY_PLANTING_MARKER_MISSING:${marker}`);
    const plantingTokens=tokenProfile(planting.text);
    assert(plantingTokens.crop_tokens.includes('corn'),'OBS6977_CONTINUITY_PLANTING_CORN_REQUIRED');
    assert(plantingTokens.hybrid_tokens.includes('P0306Q'),'OBS6977_CONTINUITY_PLANTING_P0306Q_REQUIRED');

    const anchor=await fetchProof(page,ANCHOR_URL,HOST);
    for(const marker of [ANCHOR_DATE,'Herbicide Application','T1','Acuron','Roundup']) assert(anchor.text.toLowerCase().includes(marker.toLowerCase()),`OBS6977_CONTINUITY_ANCHOR_MARKER_MISSING:${marker}`);
    assert(/2:35\s*pm\s*to\s*4:40\s*pm/i.test(anchor.text),'OBS6977_CONTINUITY_ANCHOR_OPERATION_WINDOW_REQUIRED');
    assert(/reps?\s*(?:2,\s*3,\s*4,\s*1,\s*5,\s*(?:and\s*)?6|1,\s*2,\s*3,\s*4,\s*5,\s*(?:and\s*)?6)/i.test(anchor.text),'OBS6977_CONTINUITY_ALL_T1_REPLICATES_REQUIRED');
    const anchorTokens=tokenProfile(anchor.text);
    assert(anchorTokens.crop_tokens.length===0,'OBS6977_CONTINUITY_ANCHOR_DIRECT_CROP_TOKEN_UNEXPECTED_REVIEW_REQUIRED');
    assert(anchorTokens.hybrid_tokens.length===0,'OBS6977_CONTINUITY_ANCHOR_DIRECT_HYBRID_TOKEN_UNEXPECTED_REVIEW_REQUIRED');

    const area=await fetchProof(page,T1R1_URL,HOST);
    assert(/\bT1R1\b/i.test(area.text),'OBS6977_CONTINUITY_T1R1_AREA_REQUIRED');
    const areaRows=await parseAreaRows(page);
    assert(areaRows.length>=300,'OBS6977_CONTINUITY_AREA_HISTORY_DEPTH_REQUIRED');
    assert(areaRows.some((r)=>r.provider_observation_id===PLANTING_ID),'OBS6977_CONTINUITY_PLANTING_MISSING_FROM_T1R1_LOG');
    assert(areaRows.some((r)=>r.provider_observation_id===ANCHOR_ID),'OBS6977_CONTINUITY_ANCHOR_MISSING_FROM_T1R1_LOG');
    const dates=areaRows.map((r)=>r.observation_date).sort();
    assert(dates[0]<'2000-01-01','OBS6977_CONTINUITY_AREA_LONG_HISTORY_REQUIRED');
    assert(dates.at(-1)>=ANCHOR_DATE,'OBS6977_CONTINUITY_AREA_COVERAGE_THROUGH_ANCHOR_REQUIRED');
    const paginationLinks=await page.locator('a[href*="?page="]').count();
    assert(paginationLinks===0,'OBS6977_CONTINUITY_AREA_PAGINATION_UNQUALIFIED');

    const boundedRows=areaRows
      .filter((r)=>r.observation_date>=PLANTING_DATE && r.observation_date<=ANCHOR_DATE)
      .sort((a,b)=>a.observation_date.localeCompare(b.observation_date)||a.provider_observation_id-b.provider_observation_id);
    assert(boundedRows.some((r)=>r.provider_observation_id===PLANTING_ID),'OBS6977_CONTINUITY_BOUNDED_PLANTING_REQUIRED');
    assert(boundedRows.some((r)=>r.provider_observation_id===ANCHOR_ID),'OBS6977_CONTINUITY_BOUNDED_ANCHOR_REQUIRED');

    const afterOriginResetCandidates=boundedRows.filter((r)=>r.provider_observation_id!==PLANTING_ID && RESET_EVENT.test(r.observation_type));
    const inspectedResetCandidates=[];
    for(const row of afterOriginResetCandidates){
      const detail=await fetchProof(page,`https://${HOST}/observations/${row.provider_observation_id}`,HOST);
      inspectedResetCandidates.push({...row,...tokenProfile(detail.text),response_sha256:detail.proof.response_sha256,retrieved_at:detail.proof.retrieved_at});
    }
    assert(afterOriginResetCandidates.length===0,'OBS6977_CONTINUITY_INTERVENING_RESET_EVENT_PRESENT');

    const practices=await fetchProof(page,PRACTICES_URL,KBS_HOST);
    for(const marker of ['Agronomic Field Log','agronomic activities or observations made on MCSE Treatments','Herbicide Application Log','all Replicate Blocks (1-6)']) assert(practices.text.toLowerCase().includes(marker.toLowerCase()),`OBS6977_CONTINUITY_PRACTICES_MARKER_MISSING:${marker}`);

    const anchorAvailability=anchor.proof.retrieved_at;
    const identityContinuityQualified=true;
    const positiveAnchorQualified=true;

    write({
      schema_version:'geox_mcft_cap09_obs6977_season_continuity_qualification_v1',
      status:'PASS',
      subject_sha:SUBJECT_SHA,
      qualification_time_utc:new Date().toISOString(),
      layer:'POSITIVE_LIFECYCLE_ANCHOR',
      qualification_only_not_authority:true,
      formal_scope:{site_id:'KBS_MCSE_T1R1',field_id:'field_kbs_mcse_t1r1',season_id:'season_2026_corn',crop:'corn',hybrid_product_code:'P0306Q',provider_area_identity:'T1R1'},
      season_origin:{provider_observation_id:PLANTING_ID,event_date_local:PLANTING_DATE,crop:'corn',hybrid_product_code:'P0306Q',direct_crop_binding:true,direct_hybrid_binding:true,...planting.proof},
      positive_management_anchor:{provider_observation_id:ANCHOR_ID,event_date_local:ANCHOR_DATE,observation_type:'Herbicide Application',provider_area_identity:'T1_ALL_REPLICATES',includes_t1r1:true,event_time_window_local:'2026-05-27T14:35:00/2026-05-27T16:40:00 America/Detroit',event_time_window_utc:{start_inclusive:'2026-05-27T18:35:00.000Z',end_inclusive:'2026-05-27T20:40:00.000Z'},available_to_runtime_at:anchorAvailability,direct_crop_binding:false,direct_hybrid_binding:false,positive_management_fact:true,...anchor.proof},
      bounded_identity_continuity:{
        interval_basis:'PLANTING_6931_THROUGH_POSITIVE_MANAGEMENT_6977',
        start_local_date:PLANTING_DATE,
        end_local_date:ANCHOR_DATE,
        provider_area_identity:'T1R1',
        area_history_row_count:areaRows.length,
        area_history_no_pagination_observed:true,
        area_history_minimum_date:dates[0],
        area_history_maximum_date:dates.at(-1),
        bounded_event_count:boundedRows.length,
        bounded_events:boundedRows,
        intervening_reset_candidate_count:afterOriginResetCandidates.length,
        intervening_reset_candidates:inspectedResetCandidates,
        absence_used_only_to_preserve_identity_between_two_positive_events:true,
        absence_used_to_create_active:false,
        provider_coverage_through_anchor_qualified:true,
        composite_season_identity_continuity_qualified:identityContinuityQualified,
        ...area.proof
      },
      composite_adjudication:{
        planting_supplies_season_origin_and_crop_identity:true,
        management_event_supplies_positive_managed_activity:true,
        bounded_event_log_supplies_only_identity_continuity:true,
        thermal_evidence_used:false,
        absence_of_harvest_used_to_create_active:false,
        composite_binding_6931_to_6977_qualified:true,
        positive_active_lifecycle_anchor_candidate_qualified:positiveAnchorQualified,
        active_anchor_observation_window_utc:{start_inclusive:'2026-05-27T18:35:00.000Z',end_inclusive:'2026-05-27T20:40:00.000Z'},
        authority_available_to_runtime_at:anchorAvailability,
        positive_active_lifecycle_authority_established:false,
        reason:'QUALIFICATION_REQUIRES_SEPARATE_VERSIONED_AUTHORITY_ADOPTION',
        next_frontier:'OBS6977_POSITIVE_ACTIVE_LIFECYCLE_AUTHORITY_VERSIONING'
      },
      phenology_stage_authority:{status:'UNRESOLVED',stage:null},
      crop_model_parameter_authority:{status:'UNRESOLVED',parameter:'Kc',kc:null},
      hard_nonclaims:['NO_ACTIVE_FROM_PROVIDER_SILENCE','NO_ABSENCE_AS_POSITIVE_ANCHOR','NO_THERMAL_ACTIVE_INFERENCE','NO_PHENOLOGY_INFERENCE','NO_KC_INVENTION','NO_CARRY_FORWARD_BEYOND_6977','NO_EA5E2_GO'],
      database_write_count:0,formal_evidence_write_count:0,raw_object_write_count:0,runtime_config_write_count:0,scheduler_write_count:0,formal_window_started:false,formal_execution_count:'0/24'
    });
  }finally{await browser.close();}
}

try{await main();}catch(error){write({schema_version:'geox_mcft_cap09_obs6977_season_continuity_qualification_v1',status:'FAIL',subject_sha:SUBJECT_SHA||null,error:safeError(error),positive_active_lifecycle_authority_established:false,database_write_count:0,formal_window_started:false,formal_execution_count:'0/24'});process.exitCode=1;}
