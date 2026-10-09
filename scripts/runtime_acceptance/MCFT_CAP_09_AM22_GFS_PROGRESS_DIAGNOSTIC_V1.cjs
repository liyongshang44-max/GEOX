"use strict";
const assert=require("node:assert/strict");
const SCOPE=Object.freeze({tenant_id:"tenant_mcft_external",project_id:"project_mcft_cap09",group_id:"group_public_research",field_id:"field_kbs_mcse_t4r1",season_id:"season_2026_corn",zone_id:"zone_kbs_mcse_t4r1_crop_formal_v1"});
const TYPES=["future_weather_assumption_v1","future_et0_assumption_v1"];
const FIELDS=["status","detail","attempt_kind","failure_class","failure_stage","failure_token","error_name","error_code","member_kind","lead","local_retry_ordinal"];
function safeHealth(line){
 let e;try{e=JSON.parse(line);}catch{return null;}
 if(e?.runtime_role!=="EVIDENCE_RUNTIME")return null;
 const out={};for(const k of FIELDS){const v=e[k];if(typeof v==="string"&&/^[A-Za-z0-9_.-]{1,128}$/.test(v))out[k]=v;else if(["lead","local_retry_ordinal"].includes(k)&&Number.isInteger(v)&&v>=0&&v<=120)out[k]=v;}
 return out;
}
function sameScope(row){return Object.keys(SCOPE).every(k=>row[k]===SCOPE[k]);}
function iso(v){assert.equal(typeof v,"string","DIAGNOSTIC_TIME_REQUIRED");assert.equal(new Date(v).toISOString(),v,"DIAGNOSTIC_TIME_INVALID");return Date.parse(v);}
function analyze(input){
 const now=iso(input.database_utc),target=iso(input.target_logical_time);
 assert.ok(input.target_logical_time.endsWith(":00:00.000Z"),"DIAGNOSTIC_HOUR_REQUIRED");
 assert.ok(Array.isArray(input.leases)&&input.leases.length<=1,"DIAGNOSTIC_OWNER_CARDINALITY");
 assert.ok(Array.isArray(input.facts)&&input.facts.length<=1000,"DIAGNOSTIC_FACT_LIMIT");
 for(const row of [...input.leases,...input.facts])assert.ok(sameScope(row),"DIAGNOSTIC_EXACT_SCOPE_REQUIRED");
 const lease=input.leases[0]??null;
 if(lease?.gfs_poll_attempt_count!=null)assert.ok(Number.isInteger(lease.gfs_poll_attempt_count)&&lease.gfs_poll_attempt_count>=1&&lease.gfs_poll_attempt_count<=3,"DIAGNOSTIC_RETRY_STATE_INVALID");
 const facts=input.facts.filter(f=>f.target_logical_time===input.target_logical_time&&TYPES.includes(f.type));
 const weather=facts.filter(f=>f.type===TYPES[0]),et0=facts.filter(f=>f.type===TYPES[1]);
 assert.ok(weather.length<=1&&et0.length<=1,"DIAGNOSTIC_DUPLICATE_TARGET_FACTS");
 const pair=weather.length===1&&et0.length===1;
 const provenance=pair&&!!weather[0].selected_cycle&&/^sha256:[a-f0-9]{64}$/.test(weather[0].raw_source_sha256??"")&&weather[0].selected_cycle===et0[0].selected_cycle&&weather[0].raw_source_sha256===et0[0].raw_source_sha256;
 const errors=(input.health_events??[]).map(e=>safeHealth(JSON.stringify({...e,runtime_role:"EVIDENCE_RUNTIME"}))).filter(Boolean);
 const fetch=errors.filter(e=>e.failure_stage==="MEMBER_FETCH"&&String(e.member_kind??"").startsWith("GFS_"));
 const missed=errors.filter(e=>e.failure_token==="PRODUCTION_EVIDENCE_HOST_PLANNER_GFS_MISSED_WINDOW");
 const attempts=lease?.gfs_poll_target_logical_time===input.target_logical_time?lease.gfs_poll_attempt_count??0:0;
 return {schema_version:"geox_mcft_cap09_am22_gfs_progress_diagnostic_v1",status:"DIAGNOSTIC_ONLY",database_utc:input.database_utc,target_logical_time:input.target_logical_time,
 owner_observation:lease?(iso(lease.expires_at)>now?"LIVE_AT_ONE_DATABASE_SAMPLE_NOT_H5":"EXPIRED_AT_DATABASE_SAMPLE"):"NO_LEASE_ROW",
 target_is_past:now>=target,claimed_attempt_count:attempts,attempt_budget_exhausted:attempts===3,
 planner_attempt_observation:attempts>0?"DURABLE_ATTEMPT_CLAIM_OBSERVED_NOT_HTTP_SUCCESS":"NO_CLAIM_FOR_REQUESTED_TARGET_OBSERVED",
 fact_observation:!facts.length?"NO_TARGET_FACTS":!pair?"PARTIAL_TARGET_FACTS":provenance?"PAIR_METADATA_OBSERVED_NOT_QUALIFIED":"PAIR_PROVENANCE_MISMATCH",
 member_fetch_failures:fetch.slice(-20),missed_window_failures:missed.slice(-3),
 provider_publication_status:"UNKNOWN_NO_PROVIDER_INVENTORY_PROOF",underlying_transport_cause:"UNKNOWN_NOT_RECORDED_BY_EXISTING_HEALTH_LOG",
 log_read_status:input.log_read_status??"NOT_SUPPLIED",production_start_authorized:false,formal_v5_arm:false,a0_execution:false,o00_started:false,six_phase_success:false,production_writes:0};
}
module.exports={SCOPE,TYPES,FIELDS,safeHealth,analyze};
