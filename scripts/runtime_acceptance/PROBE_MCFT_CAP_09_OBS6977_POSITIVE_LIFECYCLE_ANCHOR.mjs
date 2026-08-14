#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'acceptance-output/MCFT_CAP_09_OBS6977_POSITIVE_LIFECYCLE_ANCHOR.json');
const SUBJECT_SHA = String(process.env.MCFT_SUBJECT_SHA || '').trim();
const HOST = 'aglog.kbs.msu.edu';
const KBS_HOST = 'lter.kbs.msu.edu';
const PLANTING_URL = `https://${HOST}/observations/6931`;
const ANCHOR_URL = `https://${HOST}/observations/6977`;
const AREA_T1_URL = `https://${HOST}/areas/623`;
const AREA_T1R1_URL = `https://${HOST}/areas/1`;
const PRACTICES_URL = `https://${KBS_HOST}/datasets/7`;
const TREATMENT_URL = `https://${KBS_HOST}/datatables/20`;
const PLANTING_DATE = '2026-05-11';
const ANCHOR_DATE = '2026-05-27';

function assert(condition, code) { if (!condition) throw new Error(code); }
function normalize(value) { return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }
function sha256(bytes) { return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`; }
function safeError(error) { return (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/[^\s]+/g, '[URL_REDACTED]'); }
function write(value) { fs.mkdirSync(path.dirname(OUT), { recursive:true }); fs.writeFileSync(OUT, `${JSON.stringify(value,null,2)}\n`, 'utf8'); console.log(JSON.stringify(value)); }
function has(text, pattern) { return typeof pattern === 'string' ? text.toLowerCase().includes(pattern.toLowerCase()) : pattern.test(text); }
function localWindowToUtc(date, startHour, startMinute, endHour, endMinute) {
  // America/Detroit is UTC-04 on 2026-05-27. This conversion is used only after the provider-local date/time text is reproduced.
  return {
    event_time_window_local: `${date}T${String(startHour).padStart(2,'0')}:${String(startMinute).padStart(2,'0')}:00/${date}T${String(endHour).padStart(2,'0')}:${String(endMinute).padStart(2,'0')}:00 America/Detroit`,
    event_time_window_utc: {
      start_inclusive: `${date}T${String(startHour + 4).padStart(2,'0')}:${String(startMinute).padStart(2,'0')}:00.000Z`,
      end_inclusive: `${date}T${String(endHour + 4).padStart(2,'0')}:${String(endMinute).padStart(2,'0')}:00.000Z`
    }
  };
}
async function fetchProof(page, url, allowedHost) {
  const requested = new URL(url);
  assert(requested.hostname === allowedHost, 'OBS6977_UNAPPROVED_HOST');
  const response = await page.goto(url, { waitUntil:'domcontentloaded', timeout:75_000 });
  assert(response?.ok(), `OBS6977_HTTP_${response?.status() ?? 'NO_RESPONSE'}`);
  const finalUrl = new URL(response.url());
  assert(finalUrl.hostname === allowedHost, 'OBS6977_REDIRECT_HOST_FORBIDDEN');
  const bytes = await response.body();
  const retrievedAt = new Date().toISOString();
  const text = normalize(await page.locator('body').innerText());
  return { text, proof:{ response_sha256:sha256(bytes), response_bytes:bytes.byteLength, retrieved_at:retrievedAt, provider_body_emitted:false } };
}

async function main() {
  assert(/^[0-9a-f]{40}$/.test(SUBJECT_SHA), 'OBS6977_EXACT_SUBJECT_REQUIRED');
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext({userAgent:'GEOX-MCFT-CAP09-Obs6977-Lifecycle-Anchor/1.0'});
    const page = await context.newPage();

    const planting = await fetchProof(page, PLANTING_URL, HOST);
    for (const marker of [PLANTING_DATE, 'Planting', 'T1', 'corn', 'P0306Q']) assert(has(planting.text, marker), `OBS6977_PLANTING_MARKER_MISSING:${marker}`);

    const anchor = await fetchProof(page, ANCHOR_URL, HOST);
    for (const marker of [ANCHOR_DATE, 'Herbicide Application', 'T1', 'Acuron', 'Roundup']) assert(has(anchor.text, marker), `OBS6977_ANCHOR_MARKER_MISSING:${marker}`);
    assert(/reps?\s*(?:2,\s*3,\s*4,\s*1,\s*5,\s*(?:and\s*)?6|1,\s*2,\s*3,\s*4,\s*5,\s*(?:and\s*)?6)/i.test(anchor.text), 'OBS6977_ALL_T1_REPLICATES_NOT_REPRODUCED');
    assert(/2:35\s*pm\s*to\s*4:40\s*pm/i.test(anchor.text), 'OBS6977_LOCAL_OPERATION_WINDOW_NOT_REPRODUCED');
    const anchorHasCorn = /\b(corn|maize)\b/i.test(anchor.text);
    const anchorHasP0306Q = /\bP0306Q\b/i.test(anchor.text);
    assert(anchorHasCorn === false, 'OBS6977_DIRECT_CROP_BINDING_UNEXPECTEDLY_PRESENT_REVIEW_REQUIRED');
    assert(anchorHasP0306Q === false, 'OBS6977_DIRECT_HYBRID_BINDING_UNEXPECTEDLY_PRESENT_REVIEW_REQUIRED');

    const areaT1 = await fetchProof(page, AREA_T1_URL, HOST);
    assert(/\bT1\b/i.test(areaT1.text), 'OBS6977_T1_AREA_IDENTITY_NOT_REPRODUCED');
    const areaT1R1 = await fetchProof(page, AREA_T1R1_URL, HOST);
    assert(/\bT1R1\b/i.test(areaT1R1.text), 'OBS6977_T1R1_AREA_IDENTITY_NOT_REPRODUCED');

    const practices = await fetchProof(page, PRACTICES_URL, KBS_HOST);
    for (const marker of ['Agronomic Field Log', 'agronomic activities or observations made on MCSE Treatments', 'Herbicide Application Log', 'all Replicate Blocks (1-6)']) assert(has(practices.text, marker), `OBS6977_PRACTICES_MARKER_MISSING:${marker}`);

    const treatment = await fetchProof(page, TREATMENT_URL, KBS_HOST);
    for (const marker of ['T1', 'corn/soybean/wheat rotation', 'standard chemical input', 'conventionally tilled']) assert(has(treatment.text, marker), `OBS6977_TREATMENT_MARKER_MISSING:${marker}`);

    const eventWindow = localWindowToUtc(ANCHOR_DATE,14,35,16,40);
    const conservativeAvailability = anchor.proof.retrieved_at;
    const positiveManagementFact = true;
    const spatialT1IncludesT1R1 = true;
    const directSeasonBinding = false;
    const compositeSeasonBindingCandidate = true;

    write({
      schema_version:'geox_mcft_cap09_obs6977_positive_lifecycle_anchor_probe_v1',
      status:'PASS',
      subject_sha:SUBJECT_SHA,
      probed_at_utc:new Date().toISOString(),
      layer:'POSITIVE_LIFECYCLE_ANCHOR',
      discovery_only_not_authority:true,
      formal_scope:{ site_id:'KBS_MCSE_T1R1', field_id:'field_kbs_mcse_t1r1', season_id:'season_2026_corn', crop:'corn', hybrid_product_code:'P0306Q', provider_area_identity:'T1R1' },
      planting_origin:{ provider_observation_id:6931, event_date_local:PLANTING_DATE, provider_area_identity:'T1', crop:'corn', hybrid_product_code:'P0306Q', season_origin_established_by_existing_authority:true, ...planting.proof },
      candidate_anchor:{
        provider_observation_id:6977,
        event_date_local:ANCHOR_DATE,
        observation_type:'Herbicide Application',
        provider_area_identity:'T1_ALL_REPLICATES',
        includes_formal_scope_t1r1:spatialT1IncludesT1R1,
        positive_management_activity:positiveManagementFact,
        explicit_crop_token_in_anchor_detail:anchorHasCorn,
        explicit_hybrid_token_in_anchor_detail:anchorHasP0306Q,
        ...eventWindow,
        available_to_runtime_at_conservative:conservativeAvailability,
        availability_backdating_used:false,
        direct_season_2026_corn_binding_established:directSeasonBinding,
        composite_binding_to_planting_6931_candidate:compositeSeasonBindingCandidate,
        composite_binding_requires_separate_continuity_qualification:true,
        phenology_semantic_established:false,
        kc_established:false,
        candidate_only_not_authority:true,
        ...anchor.proof
      },
      source_semantics:{
        kbs_agronomic_field_log_is_mcse_treatment_activity_log:true,
        kbs_herbicide_log_covers_mcse_treatment_replicates:true,
        t1_is_standard_chemical_input_corn_soybean_wheat_rotation:true,
        provider_area_hierarchy_t1_contains_t1r1:true,
        ...practices.proof,
        treatment_response_sha256:treatment.proof.response_sha256,
        t1_area_response_sha256:areaT1.proof.response_sha256,
        t1r1_area_response_sha256:areaT1R1.proof.response_sha256
      },
      layer1_adjudication:{
        positive_management_fact_established:true,
        spatial_binding_to_t1r1_established:true,
        event_time_chronology_established:true,
        current_runtime_availability_established:true,
        direct_crop_or_hybrid_binding_on_6977_established:false,
        positive_active_lifecycle_authority_established:false,
        reason:'OBS6977_REQUIRES_SEPARATE_COMPOSITE_SEASON_CONTINUITY_BINDING_TO_PLANTING_6931',
        next_frontier:'OBS6977_TO_PLANTING6931_COMPOSITE_SEASON_CONTINUITY_QUALIFICATION'
      },
      hard_nonclaims:[
        'NO_ACTIVE_FROM_ABSENCE_OF_HARVEST',
        'NO_DIRECT_CROP_TOKEN_ON_6977',
        'NO_DIRECT_P0306Q_TOKEN_ON_6977',
        'NO_PHENOLOGY_AUTHORITY',
        'NO_KC_AUTHORITY',
        'NO_THERMAL_ACTIVE_INFERENCE',
        'NO_EA5E2_GO'
      ],
      database_write_count:0,
      formal_evidence_write_count:0,
      raw_object_write_count:0,
      runtime_config_write_count:0,
      scheduler_write_count:0,
      formal_window_started:false,
      formal_execution_count:'0/24'
    });
  } finally { await browser.close(); }
}

try { await main(); }
catch(error) {
  write({schema_version:'geox_mcft_cap09_obs6977_positive_lifecycle_anchor_probe_v1',status:'FAIL',subject_sha:SUBJECT_SHA||null,error:safeError(error),positive_active_lifecycle_authority_established:false,database_write_count:0,formal_window_started:false,formal_execution_count:'0/24'});
  process.exitCode=1;
}
