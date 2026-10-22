"use strict";
// Candidate DA9 source-time contract. Read-only, no transport, signing, or admission.
// Never manufacture a Provider deadline from GFS cycle, soil observation age, or T1.
const assert = require("node:assert/strict");
const RUN = "da9db7129607";
const STAGES = Object.freeze(["PRODUCER","TIMING_1","TIMING_2","TIMING_3","CONTROLLED_DELAY","AGGREGATE"]);
const MAX_LEAD = 120, BUNDLE_HOURS = 72;
const SOIL_MAX_AGE_MS = 30 * 60_000, SOIL_CLOCK_FUTURE_TOLERANCE_MS = 5 * 60_000;
const EXPECTED_KBS_SOURCE = "https://lter.kbs.msu.edu/weather/variates/25";
const EXPECTED_CSV = "https://lter.kbs.msu.edu/datatables/13.csv";
const HOUR = 3_600_000;
const epoch = (s,name) => {
  assert(typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s), name+"_INVALID");
  const t = Date.parse(s);
  assert(Number.isFinite(t) && new Date(t).toISOString()===s, name+"_INVALID");
  return t;
};
const iso=t=>new Date(t).toISOString();
function stageCaps(plan,margin) {
  assert(plan&&typeof plan==="object"&&!Array.isArray(plan),"V3_STAGE_PLAN_REQUIRED");
  assert.deepEqual(Object.keys(plan).sort(),["schema_version","stages"],"V3_STAGE_PLAN_FIELDS");
  assert.equal(plan.schema_version,"geox_mcft_cap09_retry_stage_plan_v2","V3_PLAN_VERSION");
  assert(Array.isArray(plan.stages)&&plan.stages.length===6,"V3_STAGE_COUNT");
  let sum=0;
  for(let i=0;i<6;i++){
    const row=plan.stages[i];
    assert.deepEqual(Object.keys(row).sort(),["id","timeout_ms"],"V3_STAGE_FIELDS");
    assert.equal(row.id,STAGES[i],"V3_STAGE_ORDER");
    assert(Number.isSafeInteger(row.timeout_ms)&&row.timeout_ms>=1000&&row.timeout_ms<=3_600_000,"V3_STAGE_CAP_RANGE");
    sum+=row.timeout_ms;
  }
  assert(Number.isSafeInteger(margin)&&margin>0,"V3_MARGIN_REQUIRED");
  return {sum,margin,full:sum+margin};
}
function gfsCycleCoverage(firstBase,cycle){
  const t=epoch(firstBase,"V3_BASE"), c=epoch(cycle,"V3_GFS_CYCLE");
  assert(t%HOUR===0&&c%HOUR===0,"V3_NON_HOURLY_TARGET");
  assert([0,6,12,18].includes(new Date(c).getUTCHours()),"V3_NON_GFS_CYCLE");
  assert(c<t,"V3_GFS_CYCLE_NOT_BEFORE_BASE");
  const targets=[t,t+HOUR,t+2*HOUR];
  const bases=targets.map(x=>{
    const targetLead=(x-c)/HOUR;
    assert(Number.isInteger(targetLead)&&targetLead>=0,"V3_GFS_TARGET_LEAD_INVALID");
    const supportLead=targetLead, firstLead=targetLead+1, endLead=firstLead+BUNDLE_HOURS-1;
    assert(endLead<=MAX_LEAD,"V3_GFS_72H_UNSUPPORTED");
    return {base_utc:iso(x),support_lead:supportLead,first_forecast_lead:firstLead,last_forecast_lead:endLead};
  });
  return {cycle_utc:cycle,bases,union_support_lead:bases[0].support_lead,union_end_lead:bases[2].last_forecast_lead,
    required_distinct_lead_count:bases[2].last_forecast_lead-bases[0].support_lead+1,
    proof_status:"FORECAST_COVERAGE_ARITHMETIC_ONLY_NOT_REMOTE_FILE_AVAILABILITY"};
}
function soilObservationWindow(meta){
  assert(meta&&typeof meta==="object"&&!Array.isArray(meta),"V3_SOIL_PROVENANCE_MISSING");
  assert.equal(meta.source_url,EXPECTED_KBS_SOURCE,"V3_SOIL_ACTUAL_SOURCE_REQUIRED");
  const o=epoch(meta.latest_observation_utc,"V3_SOIL_LATEST"),r=epoch(meta.retrieved_at_utc,"V3_SOIL_RETRIEVED");
  assert(r-o>=-SOIL_CLOCK_FUTURE_TOLERANCE_MS,"V3_SOIL_FUTURE_OBSERVATION");
  const age=r-o;
  const fresh=age<=SOIL_MAX_AGE_MS;
  const continuity=Number.isSafeInteger(meta.distinct_hour_buckets)&&meta.distinct_hour_buckets>=24&&
    Number.isFinite(meta.span_minutes)&&meta.span_minutes>=1430&&
    Number.isFinite(meta.maximum_gap_minutes)&&meta.maximum_gap_minutes<=30&&meta.maximum_gap_minutes>=0;
  return {source:"KBS_VARIATE25_VWC",retrieval_fresh:fresh,continuity_structural_candidate:continuity,
    observed_age_ms:age,observation_specific_expiry_utc:iso(o+SOIL_MAX_AGE_MS),
    observation_expiry_is_independent_provider_deadline:false,
    self_reported_metadata_is_authenticated:false,
    requires_real_decoder_again_at_each_capture:true};
}
function assessCandidate({run_id,subject_sha,first_base_utc,now_utc,stage_plan,safety_margin_ms,
  gfs_cycle_utc,soil_metadata,adoption_expires_utc,permit_expires_utc,provider_deadline_utc}) {
  assert.equal(run_id,RUN,"V3_RUN_BOUNDARY");
  assert(typeof subject_sha==="string"&&/^[0-9a-f]{40}$/.test(subject_sha),"V3_SUBJECT_REQUIRED");
  assert(provider_deadline_utc===undefined||provider_deadline_utc===null,"V3_UNAUTHENTICATED_PROVIDER_DEADLINE_FORBIDDEN");
  const now=epoch(now_utc,"V3_NOW"),base=epoch(first_base_utc,"V3_FIRST_BASE");
  const caps=stageCaps(stage_plan,safety_margin_ms),gfs=gfsCycleCoverage(first_base_utc,gfs_cycle_utc);
  const soil=soilObservationWindow(soil_metadata);
  const adoption=adoption_expires_utc==null?null:epoch(adoption_expires_utc,"V3_ADOPTION_END");
  const permit=permit_expires_utc==null?null:epoch(permit_expires_utc,"V3_PERMIT_END");
  const hardDeadline=Math.min(base,adoption??Infinity,permit??Infinity);
  const beforeBase=base>now;
  const firstBaseOnlyCapacity=beforeBase && now+caps.full < base;
  const budgetFits=adoption!==null && permit!==null && beforeBase && now+caps.full < hardDeadline;
  const currentSoil=soil.retrieval_fresh&&soil.continuity_structural_candidate&&
    now>=epoch(soil_metadata.retrieved_at_utc,"V3_SOIL_RETRIEVAL")&&
    now-epoch(soil_metadata.retrieved_at_utc,"V3_SOIL_RETRIEVAL")<=5*60_000;
  const hold=[];
  if(!beforeBase)hold.push("V3_FIRST_BASE_NOT_FUTURE");
  if(!budgetFits)hold.push("V3_HARD_DEADLINE_BUDGET_INSUFFICIENT");
  if(!currentSoil)hold.push("V3_SOIL_NOT_CURRENT_AT_EVALUATION");
  if(adoption===null)hold.push("V3_SIGNED_ADOPTION_NOT_PROVIDED");
  if(permit===null)hold.push("V3_SIGNED_PERMIT_NOT_PROVIDED");
  hold.push("V3_GFS_WHOLE_BUNDLE_LIVE_PROOF_AND_SCIENTIFIC_DECODER_NOT_VERIFIED");
  hold.push("V3_PROVIDER_TRANSPORT_AND_VWC_REAL_DECODER_NOT_AUTHENTICATED");
  hold.push("V3_BUDGET_V3_NOT_ADOPTED_BY_OFFICIAL_SIGNER_HOST");
  return {
    schema_version:"geox_mcft_cap09_da9_source_time_contract_screen_v3",run_id,subject_sha,
    first_base_utc,now_utc,stage_timeout_sum_ms:caps.sum,margin_ms:caps.margin,
    reserved_total_ms:caps.full,strict_budget_start_before_utc:iso(base-caps.full),
    deadline_role:"PERMIT_ADOPTION_FIRST_BASE_ONLY_NO_UNAUTHENTICATED_PROVIDER_DEADLINE",
    gfs,soil,
    reference_firstbase_capacity_only:firstBaseOnlyCapacity,
    budget_arithmetic_pass:budgetFits,soil_metadata_current:currentSoil,
    provider_future_update_guaranteed:false,
    raw_hourly_csv_is_producer_soil_source:false,
    raw_hourly_csv_url_is_auxiliary_budget_witness_only:EXPECTED_CSV,
    source_binding_class:"READONLY_UNVERIFIED_OPERATOR_METADATA_NOT_PROVIDER_ATTESTATION",
    hold_reasons:hold,
    status:"V3_ENGINEERING_CONTRACT_HOLD_NOT_ADMISSION",
    execute_authorized:false,production_authorized:false,permit_signed:false,permit_consumed:false,
  };
}
module.exports={RUN,STAGES,MAX_LEAD,BUNDLE_HOURS,EXPECTED_KBS_SOURCE,EXPECTED_CSV,
  stageCaps,gfsCycleCoverage,soilObservationWindow,assessCandidate};
