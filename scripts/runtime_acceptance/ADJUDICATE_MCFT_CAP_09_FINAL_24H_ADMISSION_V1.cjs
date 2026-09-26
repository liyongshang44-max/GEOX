#!/usr/bin/env node
"use strict";

const crypto=require("node:crypto");
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
  full_resource_envelope:path.resolve("acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_FULL_RESOURCE_ENVELOPE_V1_RESULT.json"),
  live_provider_soak:path.resolve("acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_LIVE_PROVIDER_SOAK_V1_RESULT.json"),
  accelerated_restart_backfill:path.resolve("acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_ACCELERATED_RESTART_BACKFILL_V1_RESULT.json"),
  production_equivalent_candidate:path.resolve("acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_PRODUCTION_EQUIVALENT_CANDIDATE_V1_RESULT.json"),
};

function readJson(file){
  return JSON.parse(fs.readFileSync(file,"utf8"));
}
function status(file){
  if(!fs.existsSync(file))return {present:false,pass:false,status:"MISSING"};
  const row=readJson(file);
  return {present:true,pass:row.status==="PASS",status:String(row.status??"UNKNOWN"),row};
}
function sha256(file){
  return "sha256:"+crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const corpus=readJson(CORPUS);
const p0h=corpus.entries.find(row=>row.id==="P0_H_KBS_CSV_FIELD_TOO_LARGE");
if(!p0h)throw new Error("FINAL24_ADMISSION_P0H_CORPUS_ENTRY_MISSING");

const fast={};
for(const [key,file] of Object.entries(FAST))fast[key]=status(file);
const full={};
for(const [key,file] of Object.entries(FULL))full[key]=status(file);

const rawPath=path.resolve(String(p0h.repository_fixture_path??""));
const rawPresent=Boolean(p0h.repository_fixture_path)&&fs.existsSync(rawPath);
let rawDigest=null,rawBytes=null,rawValid=false;
if(rawPresent){
  rawDigest=sha256(rawPath);
  rawBytes=fs.statSync(rawPath).size;
  rawValid=rawDigest===p0h.raw_sha256 && rawBytes===p0h.raw_bytes;
}

const fastPass=Object.values(fast).every(row=>row.pass===true);
const noUnclassified=fast.failure_discovery.row?.no_unclassified_error===true;
const resourceSanityOnly=
  fast.resource_sanity.row?.tier==="FAST_SANITY_NOT_FINAL_RESOURCE_ENVELOPE"
  && fast.resource_sanity.row?.full_resource_envelope_complete===false;

const requirements={
  fast_failure_discovery_gate:fastPass,
  no_unclassified_error:noUnclassified,
  exact_p0h_raw_materialized_and_hash_verified:rawValid,
  full_resource_envelope:full.full_resource_envelope.pass,
  live_provider_soak_2_to_4h:
    full.live_provider_soak.pass
    && Number(full.live_provider_soak.row?.duration_hours)>=2
    && Number(full.live_provider_soak.row?.duration_hours)<=4,
  accelerated_restart_missed_slot_oldest_first_backfill:full.accelerated_restart_backfill.pass,
  production_equivalent_final_candidate:full.production_equivalent_candidate.pass,
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
    expected_path:p0h.repository_fixture_path,
    present:rawPresent,
    expected_sha256:p0h.raw_sha256,
    actual_sha256:rawDigest,
    expected_bytes:p0h.raw_bytes,
    actual_bytes:rawBytes,
    verified:rawValid,
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
