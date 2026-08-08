#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'acceptance-output/MCFT_CAP_09_EA1G_AWDN_SCQC60_LIVE_PROBE_STATIC_RESULT.json'),BASE=process.env.MCFT_BASE_SHA||'HEAD^';
const EA1F='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1F-ENVIROWEATHER-API-DISCOVERY-V1.json',EA1F_BLOB='2366f581f30bae465d6591d71c81a7ad2a25ace7';
const CONFIG='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-EA1G-AWDN-SCQC60-LIVE-PROBE-V1.json',PROBE='scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA1G_AWDN_SCQC60_LIVE.mjs';
const FILES=['.github/workflows/mcft-cap-09-ea1g-awdn-scqc60-live-probe.yml',CONFIG,'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_EA1G_AWDN_SCQC60_LIVE_PROBE.cjs',PROBE].sort();
const git=(args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim(),read=(p)=>fs.readFileSync(path.join(ROOT,p),'utf8'),json=(p)=>JSON.parse(read(p));
function write(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,`${JSON.stringify(v,null,2)}\n`);}
try{
 const changed=git(['diff','--name-only',`${BASE}...HEAD`]).split(/\r?\n/).filter(Boolean).sort();assert.deepEqual(changed,FILES,'EA1G_EXACT_FOUR_FILE_BOUNDARY_REQUIRED');
 assert(!changed.some(f=>/(^|\/)(apps|packages)\//.test(f)),'EA1G_RUNTIME_PRODUCT_SOURCE_DELTA_FORBIDDEN');assert(!changed.some(f=>/migration/i.test(f)),'EA1G_MIGRATION_DELTA_FORBIDDEN');
 const blob=git(['rev-parse',`${BASE}:${EA1F}`]);assert.equal(blob,EA1F_BLOB,'EA1G_EXACT_EA1F_BASE_AUTHORITY_REQUIRED');
 const c=json(CONFIG),p=read(PROBE),signal=json('docs/digital_twin/mcft/MCFT-DELIVERY-CANDIDATE-SIGNAL-CONTRACT-V1.json');
 assert.equal(c.base_main_sha,'c01b61bcd688632ea4a8bcc355cc2e3efdf98dfb');assert.equal(c.ea1f_authority_blob_sha,EA1F_BLOB);assert.equal(c.network,'enviro');assert.equal(c.product_id,'scqc60');
 assert.equal(c.discovery_request.mode,'list');assert.equal(c.discovery_request.format_parameter_policy,'OMIT_FOR_LIST_INVENTORY_PER_PROVIDER_DOCUMENTATION');
 assert.deepEqual(c.web_service_base_urls,['https://awdn.unl.edu/productdata/get','https://awdn2.unl.edu/productdata/get']);assert.equal(c.transport_policy.official_host_failover_only,true);assert.equal(c.transport_policy.http_403_or_404_may_failover,true);
 assert.deepEqual(c.estimated_value_policy.forbidden_as_observed_flags,['E','R','e']);assert.equal(c.estimated_value_policy.estimated_value_may_be_retained_as_observed,false);
 assert.equal(c.freshness_and_continuity.minimum_recent_unestimated_solar_hours,24);assert.equal(c.freshness_and_continuity.minimum_recent_unestimated_rain_hours,24);
 assert.equal(c.output_policy.raw_numeric_observation_values_allowed,false);assert.equal(c.output_policy.raw_response_body_allowed,false);assert.equal(c.output_policy.request_query_values_allowed,false);
 for(const m of ['list:CONFIG.discovery_request.product_id','productid:CONFIG.product_id','parseFlaggedNumber','companionFlag','recent_unestimated_distinct_hours','EA1G_SCQC60_SOLAR_FIELD_REQUIRED','EA1G_SCQC60_RAIN_FIELD_REQUIRED','raw_numeric_observation_values_emitted:false','database_write_count:0','formal_evidence_write_count:0']) assert(p.includes(m),`EA1G_PROBE_MARKER_REQUIRED:${m}`);
 for(const f of ['DATABASE_URL','INSERT INTO','public.facts','GEOX_MCFT_CAP09_S6_DATABASE_URL']) assert(!p.includes(f),`EA1G_DATABASE_OR_FORMAL_WRITE_FORBIDDEN:${f}`);
 assert(!signal.explicit_candidate_status_values.includes(c.record_status),'EA1G_UNREGISTERED_CANDIDATE_STATUS_FORBIDDEN');
 write({schema_version:'geox_mcft_cap09_ea1g_awdn_scqc60_static_acceptance_v1',status:'PASS',base_sha:BASE,ea1f_blob_sha:blob,changed_files:changed,exact_file_count:changed.length,discovery_mode:'list',official_host_failover_only:true,runtime_product_source_delta:0,migration_delta:0,database_write_delta:0,formal_evidence_write_delta:0,formal_window_started:false});
}catch(e){write({schema_version:'geox_mcft_cap09_ea1g_awdn_scqc60_static_acceptance_v1',status:'FAIL',error:e?.message||String(e)});console.error(e);process.exitCode=1;}
