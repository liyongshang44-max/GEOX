#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"../..");
const AUTH=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OWNER-PROVISIONING-AUTHORITY-V1.json");
const HOST_AUTH=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1.json");
const ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_ARM_V1.json");
const HOST_ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_ARM_V1.json");
const PRINCIPALS=path.join(ROOT,"apps/server/src/infra/mcft_cap09_phase5_service_principal_v1.ts");
const TWIN_ACL=path.join(ROOT,"apps/server/db/migrations/2026_08_27_mcft_cap_09_phase4_twin_runtime_acl.sql");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_PREFLIGHT_V1_RESULT.json");
const j=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const req=(v,c)=>{if(!v)throw new Error(c)};
const write=v=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");console.log(JSON.stringify(v,null,2));};
try{
  const a=j(AUTH),host=j(HOST_AUTH),arm=j(ARM),hostArm=j(HOST_ARM);
  const principals=fs.readFileSync(PRINCIPALS,"utf8"),twinAcl=fs.readFileSync(TWIN_ACL,"utf8");
  req(a.status==="RUNTIME_CREDENTIAL_BINDING_COMPLETE_NON_GITHUB_HOST_NOT_BOUND"&&a.current_stage==="RUNTIME_CREDENTIAL_BINDING_COMPLETE_PRE_HOST_BINDING","OWNER_PROVISIONING_RUNTIME_CREDENTIAL_COMPLETE_REQUIRED");
  req(a.target_database?.status==="BOUND"&&a.target_database?.database_name==="geox_mcft_cap09_production_runtime_v1","OWNER_PROVISIONING_TARGET_REQUIRED");
  const schema=a.schema_acl_materialization_evidence,login=a.service_login_materialization_evidence,runtime=a.runtime_credential_binding_evidence,post=a.runtime_credential_post_binding_readiness_evidence;
  req(schema?.status==="IMMUTABLE_SUCCESS"&&schema?.run_id===33403255312&&schema?.production_host_table_count===41&&schema?.runtime_routine_count===3&&schema?.all_table_rows_zero===true,"OWNER_PROVISIONING_SCHEMA_EVIDENCE_REQUIRED");
  req(login?.status==="IMMUTABLE_SUCCESS"&&login?.run_id===33416708461&&login?.exact_one_privilege_membership_each===true&&login?.evidence_login_connectivity_proven===true&&login?.twin_login_connectivity_proven===true,"OWNER_PROVISIONING_LOGIN_EVIDENCE_REQUIRED");
  req(runtime?.status==="IMMUTABLE_SUCCESS"&&runtime?.run_id===33422916643&&runtime?.runtime_database_url_secret_count===2&&runtime?.exact_database_name_match===true&&runtime?.exact_login_username_match===true&&runtime?.exact_password_pairing_match===true,"OWNER_PROVISIONING_RUNTIME_CREDENTIAL_EVIDENCE_REQUIRED");
  req(post?.status==="IMMUTABLE_SUCCESS"&&post?.run_id===33422981303&&post?.credential_arm_observed===false&&post?.runtime_process_start===false,"OWNER_PROVISIONING_RUNTIME_POST_READINESS_REQUIRED");
  req(principals.includes("geox_mcft_cap09_evidence_runtime_login_v1")&&principals.includes("geox_mcft_cap09_twin_runtime_login_v1"),"OWNER_PROVISIONING_DUAL_LOGIN_SOURCE_REQUIRED");
  req(twinAcl.includes("geox_mcft_cap09_twin_runtime_v1"),"OWNER_PROVISIONING_TWIN_ACL_REQUIRED");
  req(arm.armed===false&&arm.runtime_process_start_authorized===false&&arm.production_owner_activation_authorized===false&&arm.formal_v5_arm_authorized===false&&arm.a0_authorized===false&&arm.o00_authorized===false,"OWNER_PROVISIONING_ARM_MUST_REMAIN_FALSE");
  req(host.production_execution_host_class==="NON_GITHUB_LONG_RUNNING_SERVICE"&&host.github_actions?.production_execution_host_allowed===false,"OWNER_PROVISIONING_HOST_CLASS_REQUIRED");
  req(host.platform_evaluation?.selected_candidate?.platform_provider==="LOCAL_OPERATOR_MANAGED_DOCKER","OWNER_PROVISIONING_LOCAL_HOST_SELECTION_REQUIRED");
  const unbound=host.status==="LOCAL_OPERATOR_MANAGED_DOCKER_HOST_AUTHORIZED_IDENTITIES_UNBOUND";
  const bound=host.status==="LOCAL_OPERATOR_MANAGED_DOCKER_HOST_IDENTITIES_BOUND";
  req(unbound||bound,"OWNER_PROVISIONING_LOCAL_HOST_STATUS_REQUIRED");
  req(a.next_stage?.stage==="NON_GITHUB_HOST_BINDING"&&a.next_stage?.host_binding_authority_status===host.status,"OWNER_PROVISIONING_HOST_STATUS_PROJECTION_REQUIRED");
  req(a.next_stage?.host_binding_platform_provider==="LOCAL_OPERATOR_MANAGED_DOCKER"&&a.next_stage?.host_binding_location==="OPERATOR_LOCAL_MACHINE","OWNER_PROVISIONING_LOCAL_HOST_PROJECTION_REQUIRED");
  req(host.render_candidate_binding_contract?.status==="RETIRED_HTTP_402_PAYMENT_REQUIRED_NO_SERVICE_CREATED"&&host.render_candidate_binding_contract?.external_resource_count===0,"OWNER_PROVISIONING_RENDER_RETIREMENT_REQUIRED");
  req(hostArm.platform_provider==="LOCAL_OPERATOR_MANAGED_DOCKER"&&hostArm.region_or_location==="OPERATOR_LOCAL_MACHINE"&&hostArm.runtime_process_start_authorized===false&&hostArm.production_owner_activation_authorized===false,"OWNER_PROVISIONING_LOCAL_HOST_ARM_REQUIRED");
  const local=host.local_operator_managed_host_contract;
  if(unbound){
    req(a.next_stage?.non_github_host_identity_status==="NOT_YET_BOUND"&&a.next_stage?.local_host_id_bound===false,"OWNER_PROVISIONING_LOCAL_UNBOUND_PROJECTION_REQUIRED");
    req(local?.status==="AUTHORIZED_HOST_IDENTITY_UNBOUND"&&local.host_id===null&&local.evidence_runtime?.service_id===null&&local.twin_runtime?.service_id===null,"OWNER_PROVISIONING_LOCAL_IDENTITIES_UNBOUND_REQUIRED");
  }else{
    req(a.next_stage?.non_github_host_identity_status==="BOUND"&&a.next_stage?.local_host_id_bound===true,"OWNER_PROVISIONING_LOCAL_BOUND_PROJECTION_REQUIRED");
    req(local?.status==="HOST_AND_SERVICE_IDENTITIES_BOUND","OWNER_PROVISIONING_LOCAL_IDENTITIES_BOUND_REQUIRED");
  }
  write({
    schema_version:"geox_mcft_cap09_production_owner_provisioning_preflight_v1",
    status:"PASS",
    stage:"RUNTIME_CREDENTIAL_BINDING_COMPLETE_NON_GITHUB_HOST_NOT_BOUND",
    exact_target_database_bound:true,
    target_database_name:a.target_database.database_name,
    schema_acl_materialization_evidence_bound:true,
    service_login_materialization_evidence_bound:true,
    runtime_credential_binding_evidence_bound:true,
    runtime_credential_post_readiness_evidence_bound:true,
    production_host_table_count:41,
    runtime_routine_count:3,
    all_table_rows_zero:true,
    runtime_credential_binding_complete:true,
    next_stage:"NON_GITHUB_HOST_BINDING",
    host_binding_authority_defined:true,
    external_platform_selected:true,
    platform_provider:"LOCAL_OPERATOR_MANAGED_DOCKER",
    local_host_id_bound:!unbound,
    evidence_host_identity_bound:!unbound,
    twin_host_identity_bound:!unbound,
    exact_two_runtime_service_identities_bound:!unbound,
    non_github_host_identity_bound:!unbound,
    provisioning_arm:false,
    runtime_process_start:false,production_owner_activation:false,provider_request_count:0,formal_v5_arm:false,a0_bootstrap:false,o00_started:false
  });
}catch(e){
  write({status:"FAIL",error:e instanceof Error?e.message:String(e),provisioning_performed:false,runtime_process_start:false,production_owner_activation:false,provider_request_count:0,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});
  process.exitCode=1;
}
