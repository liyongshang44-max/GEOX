#!/usr/bin/env node
"use strict";

const fs=require("node:fs");
const {execFileSync}=require("node:child_process");
const BASE="274ce26d4f67049b891e253e148ed9be571c4bce";
const V4="geox_mcft_cap09_s6_formal_t4r1_24h_v4";
const FAILED_V3_ARCHIVE="geox_mcft_cap09_s6_formal_t4r1_24h_v3_failed_o01_32660018684";
const V12="geox_mcft_cap09_s6_accel24t_am19_v12";
const BLOCKED_V12="geox_mcft_cap09_s6_accel24t_am19_blocked_v12";
const V11="geox_mcft_cap09_s6_accel24t_am19_v11";
const BLOCKED_V11="geox_mcft_cap09_s6_accel24t_am19_blocked_v11";
const AUTH_V2="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V2.json";
const RECOVERY_AUTH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-FORMAL-V3-O01-RECOVERY-AUTHORITY-V1.json";
const RECOVERY_BLOB="2a0451b625100f9cdfa398af105629553c7792ea";
const AUTH_V2_BLOB="ea042dfed74a769e92ab2bd03dba5580c01d8d90";
const P={
  prewindow:"apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v3.ts",
  successor:"scripts/runtime_acceptance/EXECUTE_MCFT_CAP_09_T4R1_AMENDMENT_19_PERSISTENT_24T_SUCCESSOR.ts",
  qualification:".github/workflows/mcft-cap-09-t4r1-amendment19-persistent-24t-qualification.yml",
  provision:".github/workflows/mcft-cap-09-t4r1-formal-store-provision.yml",
  manifest:"scripts/runtime_acceptance/mcft_cap09_amendment19_formal_manifest_from_arm_v1.ts",
  armAssembler:"scripts/governance_acceptance/ASSEMBLE_MCFT_CAP_09_AMENDMENT_19_FORMAL_ARM_V1.cjs",
  arm:".github/workflows/mcft-cap-09-amendment19-formal-arm.yml",
  a0:".github/workflows/mcft-cap-09-amendment19-formal-a0-bootstrap.yml",
  hourly:".github/workflows/mcft-cap-09-amendment19-formal-hourly-evidence.yml",
  live:".github/workflows/mcft-cap-09-amendment19-formal-live-runner.yml",
  final:".github/workflows/mcft-cap-09-amendment19-formal-final-readback.yml",
  downstream:"scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_AMENDMENT_19_FORMAL_DOWNSTREAM_ZERO_V1.ts",
  completion:"scripts/governance_acceptance/ASSEMBLE_MCFT_CAP_09_AMENDMENT_19_FORMAL_COMPLETION_V1.cjs",
  finalClosure:"scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_09_FINAL_SEMANTIC_CLOSURE_V1.cjs",
};
function fail(c){throw new Error(c)}
function need(v,c){if(!v)fail(c)}
function text(p){need(fs.existsSync(p),`MCFT_CAP09_V12_V4_PATH_REQUIRED:${p}`);return fs.readFileSync(p,"utf8")}
function has(p,t,c){need(text(p).includes(t),c)}
function no(p,t,c){need(!text(p).includes(t),c)}
function main(){
  const auth=JSON.parse(text(AUTH_V2));
  need(auth.schema_version==="geox_mcft_cap09_t4r1_actual_formal_store_authority_v2"&&auth.status==="CANDIDATE","MCFT_CAP09_V12_V4_AUTHORITY_V2_REQUIRED");
  need(auth.database_identity.database_name===V4,"MCFT_CAP09_V12_V4_FORMAL_DB_REQUIRED");
  need(auth.database_identity.failed_predecessor_archive_database===FAILED_V3_ARCHIVE&&auth.database_identity.recovery_authority_ref===RECOVERY_AUTH&&auth.database_identity.recovery_authority_blob_sha===RECOVERY_BLOB&&auth.database_identity.recovery_archive_required_before_provision===true,"MCFT_CAP09_V12_V4_FAILED_V3_ARCHIVE_CHAIN_REQUIRED");
  need(auth.qualification_generation.qualification_database===V12&&auth.qualification_generation.blocked_database===BLOCKED_V12&&auth.qualification_generation.previous_qualification_database===V11&&auth.qualification_generation.previous_blocked_database===BLOCKED_V11&&auth.qualification_generation.fresh_qualification_required===true&&auth.qualification_generation.previous_generation_reuse_forbidden===true,"MCFT_CAP09_V12_V4_QUALIFICATION_GENERATION_REQUIRED");
  need(auth.qualification_generation.production_canonical_core_must_be_identical===true&&auth.qualification_generation.qualification_clock_substitutes_wait_only===true&&auth.epoch_contract.real_wall_clock_o00_o23_required===true&&auth.epoch_contract.accelerated_clock_authorized_for_formal===false,"MCFT_CAP09_V12_V4_CLOCK_AND_CORE_BOUNDARY_REQUIRED");
  need(execFileSync("git",["rev-parse",`HEAD:${AUTH_V2}`],{encoding:"utf8"}).trim()===AUTH_V2_BLOB,"MCFT_CAP09_V12_V4_AUTHORITY_V2_BLOB_REQUIRED");
  need(execFileSync("git",["rev-parse",`HEAD:${RECOVERY_AUTH}`],{encoding:"utf8"}).trim()===RECOVERY_BLOB,"MCFT_CAP09_V12_V4_RECOVERY_AUTHORITY_BLOB_REQUIRED");

  has(P.prewindow,AUTH_V2,"MCFT_CAP09_V12_V4_PREWINDOW_AUTH_REF_REQUIRED");
  has(P.prewindow,AUTH_V2_BLOB,"MCFT_CAP09_V12_V4_PREWINDOW_AUTH_BLOB_REQUIRED");
  has(P.successor,`MAIN_DB = "${V12}"`,`MCFT_CAP09_V12_V4_SUCCESSOR_V12_REQUIRED`);
  has(P.successor,`BLOCKED_DB = "${BLOCKED_V12}"`,`MCFT_CAP09_V12_V4_SUCCESSOR_BLOCKED_V12_REQUIRED`);
  has(P.successor,`PREVIOUS_MAIN_DB = "${V11}"`,`MCFT_CAP09_V12_V4_SUCCESSOR_V11_PREDECESSOR_REQUIRED`);
  has(P.qualification,V12,"MCFT_CAP09_V12_V4_WORKFLOW_V12_REQUIRED");
  has(P.qualification,BLOCKED_V12,"MCFT_CAP09_V12_V4_WORKFLOW_BLOCKED_V12_REQUIRED");
  has(P.qualification,"Require fresh v12 persistent 13 of 13","MCFT_CAP09_V12_V4_13_OF_13_REQUIRED");
  has(P.provision,V4,"MCFT_CAP09_V12_V4_PROVISION_V4_REQUIRED");
  has(P.provision,V12,"MCFT_CAP09_V12_V4_PROVISION_V12_REQUIRED");
  has(P.provision,FAILED_V3_ARCHIVE,"MCFT_CAP09_V12_V4_PROVISION_FAILED_V3_ARCHIVE_REQUIRED");
  has(P.manifest,`MCFT_CAP09_AM19_FORMAL_DATABASE_V4 = "${V4}"`,`MCFT_CAP09_V12_V4_MANIFEST_V4_REQUIRED`);

  for(const [name,p] of Object.entries({armAssembler:P.armAssembler,arm:P.arm,a0:P.a0,hourly:P.hourly,live:P.live,final:P.final,downstream:P.downstream,completion:P.completion})){
    has(p,V4,`MCFT_CAP09_V12_V4_ACTIVE_V4_REQUIRED:${name}`);
    no(p,'geox_mcft_cap09_s6_formal_t4r1_24h_v3"',`MCFT_CAP09_V12_V4_ACTIVE_V3_ROUTE_FORBIDDEN:${name}`);
  }
  has(P.finalClosure,'qualification_generation: "v12"',"MCFT_CAP09_V12_V4_FINAL_CLOSURE_V12_REQUIRED");
  has(P.finalClosure,'actual_formal_generation: "v4"',"MCFT_CAP09_V12_V4_FINAL_CLOSURE_V4_REQUIRED");

  const changed=execFileSync("git",["diff","--name-only",`${BASE}..HEAD`],{encoding:"utf8"}).trim().split("\n").filter(Boolean);
  for(const historical of [".github/workflows/mcft-cap-09-t4r1-formal-v3-prebootstrap-recovery.yml",".github/workflows/mcft-cap-09-t4r1-formal-v3-o01-recovery.yml","docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-ACTUAL-FORMAL-STORE-AUTHORITY-V1.json",RECOVERY_AUTH]) need(!changed.includes(historical),`MCFT_CAP09_V12_V4_HISTORICAL_FORENSIC_MUTATION_FORBIDDEN:${historical}`);
  console.log(JSON.stringify({schema_version:"geox_mcft_cap09_v12_v4_successor_pending_acceptance_v1",status:"PASS",qualification_generation:"v12",formal_store_generation:"v4",failed_v3_archive_required:true,historical_failed_v3_forensics_unchanged:true,production_canonical_core_reimplementation:false,formal_effect:false}));
}
try{main()}catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1}
