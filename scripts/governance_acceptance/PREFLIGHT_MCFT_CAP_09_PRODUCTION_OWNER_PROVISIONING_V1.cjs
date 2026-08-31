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
const SCHEMA_READINESS=path.join(ROOT,"scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_PRODUCTION_OPERATIONAL_SCHEMA_ACL_READINESS_V2.cjs");
const SERVICE_LOGIN_READINESS=path.join(ROOT,"scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_PRODUCTION_SERVICE_LOGIN_READINESS_V1.cjs");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_PREFLIGHT_V1_RESULT.json");
function req(ok,code){if(!ok)throw new Error(code);}
function j(p){return JSON.parse(fs.readFileSync(p,"utf8"));}
function t(p){return fs.readFileSync(p,"utf8");}
function write(v){fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");console.log(JSON.stringify(v,null,2));}
try{
  const a=j(AUTH), arm=j(ARM), principals=t(PRINCIPALS), bootstrap=t(BOOTSTRAP), twinAcl=t(TWIN_ACL), schemaReadiness=t(SCHEMA_READINESS), serviceLoginReadiness=t(SERVICE_LOGIN_READINESS);
  req(a.status==="SERVICE_LOGIN_MATERIALIZED_RUNTIME_CREDENTIAL_BINDING_NOT_ARMED","OWNER_PROVISIONING_SERVICE_LOGIN_MATERIALIZED_STATUS_REQUIRED");
  req(a.current_stage==="SERVICE_LOGIN_COMPLETE_PRE_RUNTIME_CREDENTIAL_BINDING","OWNER_PROVISIONING_SERVICE_LOGIN_COMPLETE_STAGE_REQUIRED");
  req(a.target_database?.status==="BOUND"&&a.target_database?.database_name==="geox_mcft_cap09_production_runtime_v1","OWNER_PROVISIONING_TARGET_BINDING_INVALID");
  req(a.target_database?.current_schema_state==="MATERIALIZED_41_TABLE_ZERO_ROW"&&a.target_database?.schema_acl_materialization_complete===true,"OWNER_PROVISIONING_SCHEMA_STATE_REQUIRED");
  const m=a.schema_acl_materialization_evidence;
  req(m?.status==="IMMUTABLE_SUCCESS","OWNER_PROVISIONING_SCHEMA_EVIDENCE_REQUIRED");
  req(m?.subject_sha==="577e9a9793937c9dec3d0c4e37764ecb31f3c77d","OWNER_PROVISIONING_SCHEMA_EVIDENCE_SUBJECT_MISMATCH");
  req(m?.run_id===33403255312&&m?.artifact_id===9762088357,"OWNER_PROVISIONING_SCHEMA_EVIDENCE_IDENTITY_MISMATCH");
  req(m?.artifact_digest==="sha256:d860c68bfc1cdb6de94edb30ec3b4e24a681f9f6ba9eb07bffabe0ee2ebaf928","OWNER_PROVISIONING_SCHEMA_EVIDENCE_DIGEST_MISMATCH");
  req(m?.production_host_table_count===41&&m?.all_table_rows_zero===true&&m?.runtime_routine_count===3,"OWNER_PROVISIONING_SCHEMA_EVIDENCE_SHAPE_MISMATCH");
  req(m?.evidence_direct_facts_insert===false&&m?.twin_direct_facts_insert===false,"OWNER_PROVISIONING_DIRECT_FACTS_INSERT_FORBIDDEN");
  req(m?.evidence_writer_cross_plane_matrix_pass===true&&m?.twin_writer_cross_plane_matrix_pass===true&&m?.v13_fenced_promotion_cross_plane_matrix_pass===true,"OWNER_PROVISIONING_CROSS_PLANE_EVIDENCE_REQUIRED");
  req(m?.provisioning_admin_writer_owner_set_membership_residual_count===0&&m?.provisioning_admin_writer_owner_self_grant_residual_count===0,"OWNER_PROVISIONING_TEMP_ROLE_AUTHORITY_RESIDUAL");
  req(m?.service_login_created===false&&m?.schema_acl_disarmed_after_success===true,"OWNER_PROVISIONING_SCHEMA_NON_EFFECT_REQUIRED");
  const r=a.post_materialization_readiness_evidence;
  req(r?.status==="IMMUTABLE_SUCCESS"&&r?.stage==="MATERIALIZED_41_TABLE_ZERO_ROW","OWNER_PROVISIONING_POST_READINESS_REQUIRED");
  req(r?.subject_sha==="eb32accff83e45a348d1f02d3d2be1929ebd5510","OWNER_PROVISIONING_POST_READINESS_SUBJECT_MISMATCH");
  req(r?.run_id===33403727446&&r?.artifact_id===9762290065,"OWNER_PROVISIONING_POST_READINESS_IDENTITY_MISMATCH");
  req(r?.artifact_digest==="sha256:cd2cf28f9b6b6d56b6dd76ef4ab6602122599f62ec15354a0df36a286a8a23c7","OWNER_PROVISIONING_POST_READINESS_DIGEST_MISMATCH");
  req(r?.production_host_table_count===41&&r?.all_table_rows_zero===true&&r?.runtime_routine_count===3,"OWNER_PROVISIONING_POST_READINESS_SHAPE_MISMATCH");
  req(r?.service_login_role_count===0&&r?.provisioning_admin_writer_owner_effective_set_role_count===0&&r?.provisioning_admin_writer_owner_self_grant_residual_count===0&&r?.writer_owner_schema_create_residual_count===0,"OWNER_PROVISIONING_POST_READINESS_RESIDUAL_AUTHORITY");
  req(r?.schema_acl_arm===false,"OWNER_PROVISIONING_SCHEMA_ARM_MUST_BE_FALSE");
  const service=a.service_login_pre_arm_evidence;
  req(service?.status==="IMMUTABLE_READY_UNARMED","OWNER_PROVISIONING_SERVICE_LOGIN_PRE_ARM_EVIDENCE_REQUIRED");
  req(service?.subject_sha==="7fc1b2bffd9316c5def6dfdb6ccb88d675abff32","OWNER_PROVISIONING_SERVICE_LOGIN_PRE_ARM_SUBJECT_MISMATCH");
  req(service?.one_shot?.run_id===33412229773&&service?.one_shot?.artifact_id===9765577185,"OWNER_PROVISIONING_SERVICE_LOGIN_ONE_SHOT_IDENTITY_MISMATCH");
  req(service?.one_shot?.artifact_digest==="sha256:b47fd25c56a357826f16bba47885d98d4fce0c22f35a1ac0c95002ed5b39c0bf","OWNER_PROVISIONING_SERVICE_LOGIN_ONE_SHOT_DIGEST_MISMATCH");
  req(service?.one_shot?.result_status==="SKIPPED_NOT_ARMED"&&service?.one_shot?.database_io===false&&service?.one_shot?.service_login_created===false,"OWNER_PROVISIONING_SERVICE_LOGIN_ONE_SHOT_NON_EFFECT_REQUIRED");
  req(service?.read_only_readiness?.run_id===33412230037&&service?.read_only_readiness?.artifact_id===9765598508,"OWNER_PROVISIONING_SERVICE_LOGIN_READINESS_IDENTITY_MISMATCH");
  req(service?.read_only_readiness?.artifact_digest==="sha256:52fcbcd4dc7ef2c3c3f5f7a7c4bd797817ec0a3d66beda3b9f6de608e023849d","OWNER_PROVISIONING_SERVICE_LOGIN_READINESS_DIGEST_MISMATCH");
  req(service?.read_only_readiness?.stage==="PRE_LOGIN_ZERO_STATE"&&service?.read_only_readiness?.production_host_table_count===41&&service?.read_only_readiness?.runtime_routine_count===3&&service?.read_only_readiness?.all_table_rows_zero===true&&service?.read_only_readiness?.service_login_role_count===0&&service?.read_only_readiness?.credential_secrets_present===0,"OWNER_PROVISIONING_SERVICE_LOGIN_READINESS_SHAPE_MISMATCH");
  const passwordReady=a.service_login_password_ready_evidence;
  req(passwordReady?.status==="IMMUTABLE_SUCCESS","OWNER_PROVISIONING_PASSWORD_READY_EVIDENCE_REQUIRED");
  req(passwordReady?.owner_provisioning_readiness?.bootstrap_password_secret_count===2&&passwordReady?.owner_provisioning_readiness?.runtime_database_url_secrets_present===0,"OWNER_PROVISIONING_PASSWORD_READY_EVIDENCE_SHAPE_REQUIRED");
  const loginWrite=a.service_login_materialization_evidence;
  req(loginWrite?.status==="IMMUTABLE_SUCCESS","OWNER_PROVISIONING_SERVICE_LOGIN_MATERIALIZATION_EVIDENCE_REQUIRED");
  req(loginWrite?.subject_sha==="5979f15749b0aa7e40a27daf14b957661345d8cd"&&loginWrite?.run_id===33416708461&&loginWrite?.artifact_id===9767296933,"OWNER_PROVISIONING_SERVICE_LOGIN_MATERIALIZATION_IDENTITY_MISMATCH");
  req(loginWrite?.artifact_digest==="sha256:f77622ffd4e60556b5437b52f72e95704be45b5e9bc50ef2b0cf78db82ef0ac7","OWNER_PROVISIONING_SERVICE_LOGIN_MATERIALIZATION_DIGEST_MISMATCH");
  req(loginWrite?.production_host_table_count===41&&loginWrite?.runtime_routine_count===3&&loginWrite?.all_table_rows_zero===true&&loginWrite?.exact_one_privilege_membership_each===true&&loginWrite?.login_roles_have_no_direct_public_acl===true&&loginWrite?.login_roles_own_zero_database_objects===true&&loginWrite?.evidence_login_connectivity_proven===true&&loginWrite?.twin_login_connectivity_proven===true,"OWNER_PROVISIONING_SERVICE_LOGIN_MATERIALIZATION_SHAPE_MISMATCH");
  req(loginWrite?.runtime_database_url_binding===false&&loginWrite?.runtime_credential_binding===false&&loginWrite?.runtime_process_start===false&&loginWrite?.production_owner_activation===false&&loginWrite?.disarmed_after_success===true,"OWNER_PROVISIONING_SERVICE_LOGIN_MATERIALIZATION_NON_EFFECT_REQUIRED");
  const loginRead=a.service_login_post_materialization_readiness_evidence;
  req(loginRead?.status==="IMMUTABLE_SUCCESS"&&loginRead?.stage==="SERVICE_LOGIN_COMPLETE_PRE_RUNTIME_CREDENTIAL_BINDING","OWNER_PROVISIONING_SERVICE_LOGIN_POST_READINESS_REQUIRED");
  req(loginRead?.subject_sha==="8621c82d72f836cce74efa0a7c1614ba304df714"&&loginRead?.run_id===33416853051&&loginRead?.artifact_id===9767373040,"OWNER_PROVISIONING_SERVICE_LOGIN_POST_READINESS_IDENTITY_MISMATCH");
  req(loginRead?.artifact_digest==="sha256:182cd68ceeda358e340697e4c8a5a88b8a734b411f721f1eccceaaa134dbfffd","OWNER_PROVISIONING_SERVICE_LOGIN_POST_READINESS_DIGEST_MISMATCH");
  req(loginRead?.production_host_table_count===41&&loginRead?.runtime_routine_count===3&&loginRead?.all_table_rows_zero===true&&loginRead?.service_login_role_count===2&&loginRead?.exact_one_privilege_membership_each===true&&loginRead?.evidence_login_connectivity_proven===true&&loginRead?.twin_login_connectivity_proven===true,"OWNER_PROVISIONING_SERVICE_LOGIN_POST_READINESS_SHAPE_MISMATCH");
  req(loginRead?.credential_secret_state?.evidence_runtime_password===true&&loginRead?.credential_secret_state?.twin_runtime_password===true&&loginRead?.credential_secret_state?.evidence_runtime_database_url===false&&loginRead?.credential_secret_state?.twin_runtime_database_url===false,"OWNER_PROVISIONING_SERVICE_LOGIN_POST_READINESS_SECRET_BOUNDARY_REQUIRED");
  const runtimePreUrl=a.runtime_credential_pre_url_evidence;
  req(runtimePreUrl?.status==="IMMUTABLE_READY_UNARMED","OWNER_PROVISIONING_RUNTIME_PRE_URL_EVIDENCE_REQUIRED");
  req(runtimePreUrl?.subject_sha==="e29e31937a3af3b528535478973bb0cda49b7ce4","OWNER_PROVISIONING_RUNTIME_PRE_URL_SUBJECT_MISMATCH");
  req(runtimePreUrl?.owner_provisioning_readiness?.run_id===33417815916&&runtimePreUrl?.owner_provisioning_readiness?.artifact_id===9767765459,"OWNER_PROVISIONING_RUNTIME_PRE_URL_OWNER_READINESS_IDENTITY_MISMATCH");
  req(runtimePreUrl?.owner_provisioning_readiness?.artifact_digest==="sha256:eca64850d29830357c62b2b0d29d1760f46b7cb9e5bf89ff966eac03fa6f0ad3","OWNER_PROVISIONING_RUNTIME_PRE_URL_OWNER_READINESS_DIGEST_MISMATCH");
  req(runtimePreUrl?.runtime_credential_readiness?.run_id===33417815882&&runtimePreUrl?.runtime_credential_readiness?.artifact_id===9767784698,"OWNER_PROVISIONING_RUNTIME_PRE_URL_READINESS_IDENTITY_MISMATCH");
  req(runtimePreUrl?.runtime_credential_readiness?.artifact_digest==="sha256:c3dda4860b407e71b3cf4a73c5610cb6de8c091010b2324d983a234f8f2f72dc","OWNER_PROVISIONING_RUNTIME_PRE_URL_READINESS_DIGEST_MISMATCH");
  req(runtimePreUrl?.runtime_credential_readiness?.stage==="SERVICE_LOGIN_COMPLETE_RUNTIME_URLS_ABSENT"&&runtimePreUrl?.runtime_credential_readiness?.service_login_role_count===2&&runtimePreUrl?.runtime_credential_readiness?.bootstrap_password_secret_count===2&&runtimePreUrl?.runtime_credential_readiness?.runtime_database_url_secret_count===0&&runtimePreUrl?.runtime_credential_readiness?.exact_one_privilege_membership_each===true,"OWNER_PROVISIONING_RUNTIME_PRE_URL_READINESS_SHAPE_MISMATCH");
  req(runtimePreUrl?.one_shot?.run_id===33417815784&&runtimePreUrl?.one_shot?.artifact_id===9767769787&&runtimePreUrl?.one_shot?.result_status==="SKIPPED_NOT_ARMED"&&runtimePreUrl?.one_shot?.runtime_credential_binding===false,"OWNER_PROVISIONING_RUNTIME_PRE_URL_ONE_SHOT_REQUIRED");
  req(runtimePreUrl?.one_shot?.artifact_digest==="sha256:685a29cd950ce2a7a8d913323f247e1852f68cd601a7aea916efd63078aaf353","OWNER_PROVISIONING_RUNTIME_PRE_URL_ONE_SHOT_DIGEST_MISMATCH");
  if(a.formal_v5_store_reference) req(a.formal_v5_store_reference.owner_provisioning_target===false,"OWNER_PROVISIONING_FORMAL_V5_TARGET_FORBIDDEN");
  req(a.next_stage?.stage==="RUNTIME_CREDENTIAL_BINDING"&&a.next_stage?.status==="NOT_ARMED"&&a.next_stage?.separate_machine_authority_required===true,"OWNER_PROVISIONING_RUNTIME_CREDENTIAL_NEXT_STAGE_REQUIRED");
  req(Array.isArray(a.next_stage?.required_runtime_url_secrets)&&a.next_stage.required_runtime_url_secrets.length===2&&Array.isArray(a.next_stage?.required_password_secrets_already_bound)&&a.next_stage.required_password_secrets_already_bound.length===2,"OWNER_PROVISIONING_RUNTIME_CREDENTIAL_SECRET_SET_REQUIRED");
  req(a.next_stage?.runtime_url_secret_readiness_semantics==="ZERO_OR_EXACT_TWO_ONLY"&&a.next_stage?.partial_runtime_url_secret_state_forbidden===true&&a.next_stage?.service_login_stage_complete===true,"OWNER_PROVISIONING_RUNTIME_URL_READINESS_SEMANTICS_REQUIRED");
  req(arm.armed===false&&arm.exact_target_database_name===null,"OWNER_PROVISIONING_MUST_NOT_BE_ARMED");
  for(const k of ["phase4_twin_acl_materialization_authorized","service_login_bootstrap_authorized","runtime_credential_binding_authorized","runtime_process_start_authorized","production_owner_activation_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized"]) req(arm[k]===false,"OWNER_PROVISIONING_LATER_AUTHORITY_FALSE:"+k);
  for(const marker of ["geox_mcft_cap09_evidence_runtime_login_v1","geox_mcft_cap09_twin_runtime_login_v1","PHASE5_SERVICE_PRIVILEGE_ROLES_REQUIRED","PHASE5_SERVICE_BOOTSTRAP_DATABASE_MISMATCH"]) req(principals.includes(marker),"OWNER_PROVISIONING_PRINCIPAL_CONTRACT_REQUIRED:"+marker);
  for(const marker of ["GEOX_DB_PLATFORM_ADMIN_DATABASE_URL","GEOX_MCFT_CAP09_PHASE5_DATABASE_NAME","GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_PASSWORD","GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_PASSWORD"]) req(bootstrap.includes(marker),"OWNER_PROVISIONING_BOOTSTRAP_BINDING_REQUIRED:"+marker);
  req(twinAcl.includes("CREATE ROLE geox_mcft_cap09_twin_runtime_v1"),"OWNER_PROVISIONING_TWIN_ROLE_MIGRATION_REQUIRED");
  req(twinAcl.includes("NOLOGIN NOINHERIT"),"OWNER_PROVISIONING_TWIN_ROLE_NOINHERIT_REQUIRED");
  req(schemaReadiness.includes("MATERIALIZED_41_TABLE_ZERO_ROW")&&schemaReadiness.includes("SCHEMA_ACL_PRODUCTION_LOGIN_MUST_BE_ABSENT"),"OWNER_PROVISIONING_SCHEMA_READINESS_HISTORICAL_CONTRACT_REQUIRED");
  req(serviceLoginReadiness.includes("SERVICE_LOGIN_COMPLETE_PRE_RUNTIME_CREDENTIAL_BINDING")&&serviceLoginReadiness.includes("SERVICE_LOGIN_READINESS_EXACT_ONE_MEMBERSHIP"),"OWNER_PROVISIONING_SERVICE_LOGIN_READINESS_CONTRACT_REQUIRED");
  req(a.next_stage?.runtime_credential_readiness_capability==="IMPLEMENTED_DUAL_STATE_READ_ONLY"&&a.next_stage?.runtime_credential_one_shot_capability==="IMPLEMENTED_UNARMED"&&a.next_stage?.pre_url_zero_state_evidence_bound===true,"OWNER_PROVISIONING_RUNTIME_CREDENTIAL_CAPABILITY_REQUIRED");
  req(a.non_effects?.runtime_schema_acl_materialization_performed===true,"OWNER_PROVISIONING_SCHEMA_MATERIALIZATION_EFFECT_REQUIRED");
  req(a.non_effects?.runtime_schema_and_identity_provisioning_performed===true&&a.non_effects?.production_login_creation===true,"OWNER_PROVISIONING_SERVICE_LOGIN_EFFECT_REQUIRED");
  for(const k of ["runtime_credential_binding","runtime_process_start","production_owner_activation","provider_request","formal_v5_arm","formal_v5_mutation","a0_bootstrap","o00_started"]) req(a.non_effects?.[k]===false,"OWNER_PROVISIONING_UNAUTHORIZED_EFFECT:"+k);
  write({
    schema_version:"geox_mcft_cap09_production_owner_provisioning_preflight_v1",
    status:"PASS",
    provisioning_status:"SERVICE_LOGIN_MATERIALIZED_RUNTIME_CREDENTIAL_BINDING_NOT_ARMED",
    exact_target_database_bound:true,
    target_database_name:a.target_database.database_name,
    materialization_run_id:m.run_id,
    materialization_artifact_id:m.artifact_id,
    post_materialization_readiness_run_id:r.run_id,
    post_materialization_readiness_artifact_id:r.artifact_id,
    schema_acl_materialized:true,
    schema_acl_readback_proven:true,
    service_login_one_shot_unarmed_proven:true,
    service_login_pre_arm_readiness_proven:true,
    service_login_materialized:true,
    service_login_post_materialization_readback_proven:true,
    dual_login_bootstrap_path_present:true,
    runtime_credential_bindings_required:4,
    provisioning_arm:false,
    service_login_bootstrap_authorized:false,
    runtime_credential_binding_authorized:false,
    provisioning_performed:true,
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
