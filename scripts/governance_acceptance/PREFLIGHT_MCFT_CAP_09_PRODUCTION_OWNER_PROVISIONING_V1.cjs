#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"../..");
const AUTH=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OWNER-PROVISIONING-AUTHORITY-V1.json");
const ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_ARM_V1.json");
const PRINCIPALS=path.join(ROOT,"apps/server/src/infra/mcft_cap09_phase5_service_principal_v1.ts");
const BOOTSTRAP=path.join(ROOT,"apps/server/src/infra/mcft_cap09_phase5_service_principal_bootstrap_v1.ts");
const TWIN_ACL=path.join(ROOT,"apps/server/db/migrations/2026_08_27_mcft_cap_09_phase4_twin_runtime_acl.sql");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_PREFLIGHT_V1_RESULT.json");
function req(ok,code){if(!ok)throw new Error(code);}
function j(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function t(p){return fs.readFileSync(p,"utf8");}
function write(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");console.log(JSON.stringify(v,null,2));}
try{
  const a=j(AUTH), arm=j(ARM), principals=t(PRINCIPALS), bootstrap=t(BOOTSTRAP), twinAcl=t(TWIN_ACL);
  req([
    "READINESS_ONLY_PROVISIONING_NOT_ARMED",
    "TARGET_BOUND_READINESS_ONLY_PROVISIONING_NOT_ARMED",
    "READINESS_ONLY_PRODUCTION_OPERATIONAL_DATABASE_UNRESOLVED"
  ].includes(a.status),"OWNER_PROVISIONING_AUTHORITY_STATUS_REQUIRED");
  req(
    (a.target_database?.status==="NOT_BOUND"&&a.target_database?.database_name===null)
    || (a.target_database?.status==="PRODUCTION_OPERATIONAL_DATABASE_IDENTITY_NOT_ESTABLISHED"&&a.target_database?.database_name===null)
    || (a.target_database?.status==="BOUND"&&typeof a.target_database?.database_name==="string"&&a.target_database.database_name.length>0),
    "OWNER_PROVISIONING_TARGET_BINDING_INVALID"
  );
  if(a.formal_v5_store_reference){
    req(a.formal_v5_store_reference.owner_provisioning_target===false,"OWNER_PROVISIONING_FORMAL_V5_TARGET_FORBIDDEN");
  }
  req(arm.armed===false,"OWNER_PROVISIONING_MUST_NOT_BE_ARMED");
  for(const k of ["phase4_twin_acl_materialization_authorized","service_login_bootstrap_authorized","runtime_credential_binding_authorized","runtime_process_start_authorized","production_owner_activation_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized"]) req(arm[k]===false,"OWNER_PROVISIONING_LATER_AUTHORITY_FALSE:"+k);
  for(const marker of ["geox_mcft_cap09_evidence_runtime_login_v1","geox_mcft_cap09_twin_runtime_login_v1","PHASE5_SERVICE_PRIVILEGE_ROLES_REQUIRED","PHASE5_SERVICE_BOOTSTRAP_DATABASE_MISMATCH"]) req(principals.includes(marker),"OWNER_PROVISIONING_PRINCIPAL_CONTRACT_REQUIRED:"+marker);
  for(const marker of ["GEOX_DB_PLATFORM_ADMIN_DATABASE_URL","GEOX_MCFT_CAP09_PHASE5_DATABASE_NAME","GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_PASSWORD","GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_PASSWORD"]) req(bootstrap.includes(marker),"OWNER_PROVISIONING_BOOTSTRAP_BINDING_REQUIRED:"+marker);
  req(twinAcl.includes("CREATE ROLE geox_mcft_cap09_twin_runtime_v1"),"OWNER_PROVISIONING_TWIN_ROLE_MIGRATION_REQUIRED");
  req(twinAcl.includes("NOLOGIN NOINHERIT"),"OWNER_PROVISIONING_TWIN_ROLE_NOINHERIT_REQUIRED");
  write({
    schema_version:"geox_mcft_cap09_production_owner_provisioning_preflight_v1",
    status:"PASS",
    provisioning_status:"READINESS_PASS_NOT_ARMED",
    exact_target_database_bound:false,
    twin_privilege_role_materialization_path_present:true,
    dual_login_bootstrap_path_present:true,
    runtime_credential_bindings_required:4,
    provisioning_arm:false,
    provisioning_performed:false,
    runtime_process_start:false,
    production_owner_activation:false,
    provider_request_count:0,
    formal_v5_arm:false,
    a0_bootstrap:false,
    o00_started:false
  });
}catch(e){
  write({status:"FAIL",error:e instanceof Error?e.message:String(e),provisioning_performed:false,runtime_process_start:false,production_owner_activation:false,provider_request_count:0,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});
  process.exitCode=1;
}
