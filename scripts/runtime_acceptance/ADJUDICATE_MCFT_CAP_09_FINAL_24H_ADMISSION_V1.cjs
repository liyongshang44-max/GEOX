#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const path=require("node:path");

const OUT=path.resolve("acceptance-output/MCFT_CAP_09_FINAL_24H_ADMISSION_V1_RESULT.json");
const CORPUS=path.resolve("scripts/runtime_acceptance/fixtures/mcft_cap09_failure_corpus_v1.json");
const FAST={
  failure_discovery:path.resolve("acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_GATE_V1_RESULT.json"),
  transport_matrix:path.resolve("acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_TRANSPORT_MATRIX_V1_RESULT.json"),
  retention_clock:path.resolve("acceptance-output/MCFT_CAP_09_RETENTION_CLOCK_REGRESSION_FAST_V1_RESULT.json"),
  kbs_product:path.resolve("acceptance-output/MCFT_CAP_09_KBS_RAW_HOURLY_PRODUCT_ADAPTER_V1_RESULT.json"),
  gfs_member_retry:path.resolve("acceptance-output/MCFT_CAP_09_GFS_MEMBER_RETRY_RESILIENCE_V1_RESULT.json"),
  phase3_host:path.resolve("acceptance-output/MCFT_CAP_09_PHASE3_EVIDENCE_RUNTIME_HOST_V1_RESULT.json"),
  gfs_file_backed:path.resolve("acceptance-output/MCFT_CAP_09_PHASE3_GFS_RAW_BUNDLE_COMPOSER_V1_RESULT.json"),
  resource_sanity:path.resolve("acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_RESOURCE_SANITY_V1_RESULT.json"),
};
const FULL={
  exact_p0h_raw:path.resolve("acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_EXACT_P0H_RAW_V1_RESULT.json"),
  full_resource_envelope:path.resolve("acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_FULL_RESOURCE_ENVELOPE_V1_RESULT.json"),
  live_provider_soak:path.resolve("acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_LIVE_PROVIDER_SOAK_V1_RESULT.json"),
  accelerated_restart_backfill:path.resolve("acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_ACCELERATED_RESTART_BACKFILL_V1_RESULT.json"),
};

function readJson(file){
  return JSON.parse(fs.readFileSync(file,"utf8"));
}
function status(file){
  if(!fs.existsSync(file))return {present:false,pass:false,status:"MISSING",row:null};
  const row=readJson(file);
  return {present:true,pass:row.status==="PASS",status:String(row.status??"UNKNOWN"),row};
}

const corpus=readJson(CORPUS);
const p0h=corpus.entries.find(row=>row.id==="P0_H_KBS_CSV_FIELD_TOO_LARGE");
if(!p0h)throw new Error("FINAL24_ADMISSION_P0H_CORPUS_ENTRY_MISSING");

const fast={};
for(const [key,file] of Object.entries(FAST))fast[key]=status(file);
const full={};
for(const [key,file] of Object.entries(FULL))full[key]=status(file);

const p0hProofValid=
  full.exact_p0h_raw.pass
  && full.exact_p0h_raw.row?.materialization_class==="CONTROLLED_EXTERNAL_FIXTURE"
  && full.exact_p0h_raw.row?.raw_sha256===p0h.raw_sha256
  && Number(full.exact_p0h_raw.row?.raw_bytes)===Number(p0h.raw_bytes)
  && full.exact_p0h_raw.row?.raw_values_emitted===false
  && full.exact_p0h_raw.row?.raw_path_emitted===false
  && full.exact_p0h_raw.row?.normalized_scientific_failure==="MCFT_CAP09_KBS_RAW_HOURLY_CSV_FIELD_TOO_LARGE"
  && full.exact_p0h_raw.row?.runtime_disposition==="ATTEMPT_REJECTED"
  && full.exact_p0h_raw.row?.evidence_promotion_authorized===false;

const fastPass=Object.values(fast).every(row=>row.pass===true);
const noUnclassified=fast.failure_discovery.row?.no_unclassified_error===true;
const resourceSanityOnly=
  fast.resource_sanity.row?.tier==="FAST_SANITY_NOT_FINAL_RESOURCE_ENVELOPE"
  && fast.resource_sanity.row?.full_resource_envelope_complete===false;

// Runtime admission is intentionally limited to the five conditions that can
// still make FINAL R00-R23 fail. Qualification/control-plane convergence is
// adjudicated separately and must not create additional Runtime blockers.
const requirements={
  failure_taxonomy_compatibility_seam:
    fastPass && noUnclassified,
  exact_p0h_raw_materialized_and_hash_verified:p0hProofValid,
  full_resource_envelope:full.full_resource_envelope.pass,
  accelerated_restart_missed_slot_oldest_first_backfill:full.accelerated_restart_backfill.pass,
  live_provider_soak_2_to_4h:
    full.live_provider_soak.pass
    && Number(full.live_provider_soak.row?.duration_hours)>=2
    && Number(full.live_provider_soak.row?.duration_hours)<=4,
};
const finalAdmitted=Object.values(requirements).every(Boolean);
const pending=Object.entries(requirements).filter(([,value])=>!value).map(([key])=>key);

const result={
  schema_version:"geox_mcft_cap09_final_24h_admission_v1",
  status:finalAdmitted?"PASS":"HARDENING_PASS_FINAL_24H_NOT_ADMITTED",
  final_24h_admitted:finalAdmitted,
  requirements,
  pending,
  fast_gate:{
    pass:fastPass,
    no_unclassified_error:noUnclassified,
    resource_sanity_is_not_full_envelope:resourceSanityOnly,
  },
  exact_p0h_raw:{
    proof_present:full.exact_p0h_raw.present,
    proof_status:full.exact_p0h_raw.status,
    materialization_class:full.exact_p0h_raw.row?.materialization_class??null,
    expected_sha256:p0h.raw_sha256,
    proven_sha256:full.exact_p0h_raw.row?.raw_sha256??null,
    expected_bytes:p0h.raw_bytes,
    proven_bytes:full.exact_p0h_raw.row?.raw_bytes??null,
    raw_values_emitted:full.exact_p0h_raw.row?.raw_values_emitted??null,
    raw_path_emitted:full.exact_p0h_raw.row?.raw_path_emitted??null,
    verified:p0hProofValid,
  },
  authority_effect:false,
  production_effect:false,
  formal_v5_arm:false,
  a0_authorized:false,
  o00_o23_authorized:false,
  mcft_cap09_completed:false,
};
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(result,null,2)+"\n");
process.stdout.write(JSON.stringify(result,null,2)+"\n");
