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
  req(["CANDIDATE_NOT_PROVISIONED","QUALIFIED_CANDIDATE_PROVISION_ARMED","PROVISIONED_EMPTY_ZERO_STATE"].includes(a.status),"OPERATIONAL_DB_CANDIDATE_STATUS_REQUIRED");
  req(/^[a-z_][a-z0-9_]*$/.test(a.candidate_database_name),"OPERATIONAL_DB_CANDIDATE_NAME_INVALID");
  req(!a.forbidden_database_names.includes(a.candidate_database_name),"OPERATIONAL_DB_CANDIDATE_FORBIDDEN_NAME");
  req(a.topology?.evidence_and_twin_same_database===true,"OPERATIONAL_DB_SHARED_RUNTIME_DB_REQUIRED");
  req(a.topology?.evidence_and_twin_separate_login_urls===true,"OPERATIONAL_DB_SEPARATE_LOGIN_URLS_REQUIRED");
  req(a.topology?.formal_v5_store_separate===true,"OPERATIONAL_DB_FORMAL_V5_SEPARATION_REQUIRED");
  req(a.provisioning_bundle_required_table_count===41,"OPERATIONAL_DB_41_TABLE_BUNDLE_REQUIRED");
  req(bundle.includes("OWNER_PROVISIONING_EXACT_41_TABLE_HOST_SCHEMA_REQUIRED"),"OPERATIONAL_DB_BUNDLE_ACCEPTANCE_REQUIRED");
  if(arm.armed===true){
    req(a.status==="QUALIFIED_CANDIDATE_PROVISION_ARMED","OPERATIONAL_DB_ARM_REQUIRES_QUALIFIED_STATUS");
    req(arm.create_database_authorized===true,"OPERATIONAL_DB_CREATE_AUTHORITY_REQUIRED");
    const q=a.candidate_qualification||{};
    req(q.subject_sha==="f94f875f1d2026f883e1142f31371ad7ea7f805f","OPERATIONAL_DB_QUALIFICATION_SUBJECT_REQUIRED");
    req(q.run_id===33375040615&&q.run_conclusion==="success","OPERATIONAL_DB_QUALIFICATION_RUN_REQUIRED");
    req(q.artifact_id===9751530463&&/^sha256:[0-9a-f]{64}$/.test(String(q.artifact_digest||"")),"OPERATIONAL_DB_QUALIFICATION_ARTIFACT_REQUIRED");
    req(q.candidate_database_present===false&&q.unique_creator_membership==="neon_superuser"&&q.preserved_store_count===6,"OPERATIONAL_DB_QUALIFICATION_FACTS_REQUIRED");
  }else{
    req(arm.create_database_authorized===false,"OPERATIONAL_DB_UNARMED_CREATE_FORBIDDEN");
    if(a.status==="PROVISIONED_EMPTY_ZERO_STATE"){
      const p=a.provisioning||{};
      req(p.subject_sha==="b27f00fa324ba02dbf92e108b43f108dec45ecd5","OPERATIONAL_DB_PROVISION_SUBJECT_REQUIRED");
      req(p.run_id===33375907417&&p.run_conclusion==="success","OPERATIONAL_DB_PROVISION_RUN_REQUIRED");
      req(p.artifact_id===9751846155&&/^sha256:[0-9a-f]{64}$/.test(String(p.artifact_digest||"")),"OPERATIONAL_DB_PROVISION_ARTIFACT_REQUIRED");
      req(p.database_name===a.candidate_database_name&&p.created_by_this_run===true&&p.fresh_zero_state===true&&p.public_relation_count===0&&p.public_routine_count===0&&p.protected_store_count_preserved===6,"OPERATIONAL_DB_PROVISION_FACTS_REQUIRED");
    }
  }
  for(const k of ["apply_production_host_schema_authorized","apply_runtime_acl_authorized","service_login_bootstrap_authorized","runtime_credential_binding_authorized","runtime_process_start_authorized","production_owner_activation_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized"]) req(arm[k]===false,"OPERATIONAL_DB_LATER_AUTHORITY_FALSE:"+k);
  write({
    schema_version:"geox_mcft_cap09_production_operational_database_candidate_preflight_v1",
    status:"PASS",
    candidate_database_name:a.candidate_database_name,
    candidate_is_fact:a.status==="PROVISIONED_EMPTY_ZERO_STATE",
    operational_database_identity_established:a.status==="PROVISIONED_EMPTY_ZERO_STATE",
    database_provisioned_by_bound_run:a.status==="PROVISIONED_EMPTY_ZERO_STATE",
    provisioning_arm:arm.armed===true,
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
