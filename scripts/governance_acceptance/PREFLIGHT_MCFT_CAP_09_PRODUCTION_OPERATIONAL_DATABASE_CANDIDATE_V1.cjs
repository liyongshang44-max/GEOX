#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"../..");
const AUTH=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OPERATIONAL-DATABASE-CANDIDATE-V1.json");
const ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OPERATIONAL_DATABASE_PROVISION_ARM_V1.json");
const BUNDLE=path.join(ROOT,"scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_BUNDLE_POSTGRES_V1.ts");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_OPERATIONAL_DATABASE_CANDIDATE_PREFLIGHT_V1_RESULT.json");
function req(ok,code){if(!ok)throw new Error(code);}
function j(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function t(p){return fs.readFileSync(p,"utf8");}
function write(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");console.log(JSON.stringify(v,null,2));}
try{
  const a=j(AUTH), arm=j(ARM), bundle=t(BUNDLE);
  req(a.status==="CANDIDATE_NOT_PROVISIONED","OPERATIONAL_DB_CANDIDATE_STATUS_REQUIRED");
  req(/^[a-z_][a-z0-9_]*$/.test(a.candidate_database_name),"OPERATIONAL_DB_CANDIDATE_NAME_INVALID");
  req(!a.forbidden_database_names.includes(a.candidate_database_name),"OPERATIONAL_DB_CANDIDATE_FORBIDDEN_NAME");
  req(a.topology?.evidence_and_twin_same_database===true,"OPERATIONAL_DB_SHARED_RUNTIME_DB_REQUIRED");
  req(a.topology?.evidence_and_twin_separate_login_urls===true,"OPERATIONAL_DB_SEPARATE_LOGIN_URLS_REQUIRED");
  req(a.topology?.formal_v5_store_separate===true,"OPERATIONAL_DB_FORMAL_V5_SEPARATION_REQUIRED");
  req(a.provisioning_bundle_required_table_count===41,"OPERATIONAL_DB_41_TABLE_BUNDLE_REQUIRED");
  req(bundle.includes("OWNER_PROVISIONING_EXACT_41_TABLE_HOST_SCHEMA_REQUIRED"),"OPERATIONAL_DB_BUNDLE_ACCEPTANCE_REQUIRED");
  req(arm.armed===false,"OPERATIONAL_DB_PROVISION_ARM_MUST_BE_FALSE");
  for(const k of ["create_database_authorized","apply_production_host_schema_authorized","apply_runtime_acl_authorized","service_login_bootstrap_authorized","runtime_credential_binding_authorized","runtime_process_start_authorized","production_owner_activation_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized"]) req(arm[k]===false,"OPERATIONAL_DB_LATER_AUTHORITY_FALSE:"+k);
  write({
    schema_version:"geox_mcft_cap09_production_operational_database_candidate_preflight_v1",
    status:"PASS",
    candidate_database_name:a.candidate_database_name,
    candidate_is_fact:false,
    provisioning_arm:false,
    database_created:false,
    schema_migration_performed:false,
    service_login_created:false,
    runtime_process_start:false,
    production_owner_activation:false,
    provider_request_count:0,
    formal_v5_arm:false,
    a0_bootstrap:false,
    o00_started:false
  });
}catch(e){
  write({status:"FAIL",error:e instanceof Error?e.message:String(e),database_created:false,schema_migration_performed:false,service_login_created:false,runtime_process_start:false,production_owner_activation:false,provider_request_count:0,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});
  process.exitCode=1;
}
