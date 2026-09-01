"use strict";

const fs=require("node:fs");
const path=require("node:path");
const ROOT=process.cwd();
const AUTH=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1.json");
const OWNER=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OWNER-PROVISIONING-AUTHORITY-V1.json");
const ROUTE=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-HOSTING-ARCHITECTURE-AND-DEVELOPMENT-ROUTE-V1.md");
const OWNER_ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_OWNER_PROVISIONING_ARM_V1.json");
const HOST_ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_ARM_V1.json");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_PREFLIGHT_V1_RESULT.json");
const j=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const req=(v,c)=>{if(!v)throw new Error(c)};
const write=v=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");console.log(JSON.stringify(v,null,2));};
try{
  const subject=String(process.env.SUBJECT_SHA||"");
  req(/^[0-9a-f]{40}$/.test(subject),"HOST_BINDING_SUBJECT_SHA_REQUIRED");
  const a=j(AUTH),owner=j(OWNER),ownerArm=j(OWNER_ARM),hostArm=j(HOST_ARM),route=fs.readFileSync(ROUTE,"utf8");
  req(a.schema_version==="geox_mcft_cap09_production_non_github_host_binding_authority_v1","HOST_BINDING_SCHEMA_REQUIRED");
  req(a.authority_id==="GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1","HOST_BINDING_AUTHORITY_ID_REQUIRED");
  req(owner.status==="RUNTIME_CREDENTIAL_BINDING_COMPLETE_NON_GITHUB_HOST_NOT_BOUND"&&owner.current_stage==="RUNTIME_CREDENTIAL_BINDING_COMPLETE_PRE_HOST_BINDING","HOST_BINDING_RUNTIME_CREDENTIAL_CLOSURE_REQUIRED");
  req(owner.runtime_credential_binding_evidence?.status==="IMMUTABLE_SUCCESS"&&owner.runtime_credential_post_binding_readiness_evidence?.status==="IMMUTABLE_SUCCESS","HOST_BINDING_RUNTIME_CREDENTIAL_EVIDENCE_REQUIRED");
  req(owner.target_database?.database_name==="geox_mcft_cap09_production_runtime_v1"&&owner.target_database?.status==="BOUND","HOST_BINDING_PRODUCTION_DATABASE_REQUIRED");
  req(a.production_execution_host_class==="NON_GITHUB_LONG_RUNNING_SERVICE","HOST_BINDING_HOST_CLASS_REQUIRED");
  req(a.github_actions?.production_execution_host_allowed===false,"HOST_BINDING_GITHUB_EXECUTION_HOST_FORBIDDEN");
  for(const m of ["GitHub Actions is not a production execution host","GEOX Evidence Runtime","GEOX Twin Runtime"])req(route.includes(m),"HOST_BINDING_FROZEN_ROUTE_MARKER_REQUIRED:"+m);
  const cp=a.pre_platform_checkpoint_evidence;
  req(cp?.status==="IMMUTABLE_SUCCESS_UNBOUND"&&cp?.host_binding_readiness?.run_id===33424840577&&cp?.owner_provisioning_readiness?.run_id===33424840821,"HOST_BINDING_PRE_PLATFORM_CHECKPOINT_REQUIRED");
  const local=a.local_operator_managed_host_contract;
  req(local?.platform_provider==="LOCAL_OPERATOR_MANAGED_DOCKER"&&local?.region_or_location==="OPERATOR_LOCAL_MACHINE","LOCAL_HOST_CONTRACT_REQUIRED");
  req(local?.host_id_scheme==="GEOX_LOCAL_HOST_UUID_V1"&&local?.host_id_state_file==="~/.geox/mcft-cap09/local-host-id-v1","LOCAL_HOST_ID_SCHEME_REQUIRED");
  req(local?.container_id_is_authority===false&&local?.compose_project_name==="geox-mcft-cap09-production-v1","LOCAL_HOST_STABLE_IDENTITY_CONTRACT_REQUIRED");
  req(local?.evidence_runtime?.service_name==="geox-mcft-cap09-evidence-runtime-v1"&&local?.evidence_runtime?.runtime_role==="EVIDENCE_RUNTIME"&&local?.evidence_runtime?.execution_class==="LONG_RUNNING_SERVICE","LOCAL_EVIDENCE_SERVICE_CONTRACT_REQUIRED");
  req(local?.evidence_runtime?.compiled_entrypoint==="apps/server/dist/runtime/mcft_cap09_evidence_runtime.js"&&local?.evidence_runtime?.compiled_entrypoint_status==="PACKAGED_FAIL_CLOSED_TARGET_PLANNER_UNBOUND"&&local?.evidence_runtime?.compiled_entrypoint_fail_closed_code==="MCFT_CAP09_EVIDENCE_PRODUCTION_TARGET_PLANNER_NOT_BOUND"&&local?.evidence_runtime?.target_planner_status==="NOT_BOUND","LOCAL_EVIDENCE_PACKAGING_BOUNDARY_REQUIRED");
  req(local?.twin_runtime?.service_name==="geox-mcft-cap09-twin-runtime-v1"&&local?.twin_runtime?.runtime_role==="TWIN_RUNTIME"&&local?.twin_runtime?.execution_class==="LONG_RUNNING_SERVICE","LOCAL_TWIN_SERVICE_CONTRACT_REQUIRED");
  req(local?.lifecycle_contract?.continuous_operator_window_hours===24&&local?.lifecycle_contract?.host_sleep_forbidden===true&&local?.lifecycle_contract?.docker_engine_must_remain_running===true&&local?.lifecycle_contract?.restart_policy_required==="unless-stopped","LOCAL_24H_LIFECYCLE_CONTRACT_REQUIRED");
  const render=a.render_candidate_binding_contract;
  req(render?.status==="RETIRED_HTTP_402_PAYMENT_REQUIRED_NO_SERVICE_CREATED"&&render?.external_resource_count===0&&render?.retirement_evidence?.http_status===402&&render?.retirement_evidence?.exact_service_id_count===0,"RENDER_RETIREMENT_EVIDENCE_REQUIRED");
  req(a.platform_evaluation?.selected_candidate?.platform_provider==="LOCAL_OPERATOR_MANAGED_DOCKER"&&a.platform_evaluation?.platform_selected===true,"LOCAL_HOST_SELECTION_REQUIRED");
  req(a.external_platform_authorization?.platform_provider==="LOCAL_OPERATOR_MANAGED_DOCKER"&&a.external_platform_authorization?.runtime_process_start_authorized===false,"LOCAL_HOST_AUTHORIZATION_BOUNDARY_REQUIRED");
  req(hostArm.platform_provider==="LOCAL_OPERATOR_MANAGED_DOCKER"&&hostArm.platform_account_or_project_id===null&&hostArm.region_or_location==="OPERATOR_LOCAL_MACHINE","LOCAL_HOST_ARM_SELECTION_REQUIRED");
  req(hostArm.armed===false&&hostArm.runtime_secret_injection_authorized===false&&hostArm.deployment_authorized===false&&hostArm.runtime_process_start_authorized===false&&hostArm.production_owner_activation_authorized===false&&hostArm.formal_v5_arm_authorized===false&&hostArm.a0_authorized===false&&hostArm.o00_authorized===false,"LOCAL_HOST_ARM_NON_EFFECT_REQUIRED");
  req(ownerArm.armed===false&&ownerArm.runtime_process_start_authorized===false&&ownerArm.production_owner_activation_authorized===false&&ownerArm.formal_v5_arm_authorized===false&&ownerArm.a0_authorized===false&&ownerArm.o00_authorized===false,"OWNER_ARM_MUST_REMAIN_FALSE");
  const unbound=a.status==="LOCAL_OPERATOR_MANAGED_DOCKER_HOST_AUTHORIZED_IDENTITIES_UNBOUND";
  const bound=a.status==="LOCAL_OPERATOR_MANAGED_DOCKER_HOST_IDENTITIES_BOUND";
  req(unbound||bound,"LOCAL_HOST_AUTHORITY_STATUS_REQUIRED");
  if(unbound){
    req(a.binding_state?.platform_selected===true&&a.binding_state?.local_host_id_bound===false&&a.binding_state?.evidence_host_identity_bound===false&&a.binding_state?.twin_host_identity_bound===false&&a.binding_state?.exact_two_runtime_service_identities_bound===false&&a.binding_state?.binding_authorized===false,"LOCAL_HOST_UNBOUND_STATE_REQUIRED");
    req(local.status==="AUTHORIZED_HOST_IDENTITY_UNBOUND"&&local.host_id===null&&local.evidence_runtime.service_id===null&&local.twin_runtime.service_id===null,"LOCAL_HOST_IDENTITIES_MUST_REMAIN_UNBOUND");
  }else{
    req(a.binding_state?.local_host_id_bound===true&&a.binding_state?.evidence_host_identity_bound===true&&a.binding_state?.twin_host_identity_bound===true&&a.binding_state?.exact_two_runtime_service_identities_bound===true&&a.binding_state?.binding_authorized===true,"LOCAL_HOST_BOUND_STATE_REQUIRED");
    req(local.status==="HOST_AND_SERVICE_IDENTITIES_BOUND","LOCAL_HOST_BOUND_CONTRACT_REQUIRED");
  }
  write({
    schema_version:"geox_mcft_cap09_production_non_github_host_binding_preflight_v1",
    status:"PASS",
    stage:unbound?"LOCAL_OPERATOR_MANAGED_HOST_AUTHORIZED_IDENTITIES_UNBOUND":"LOCAL_OPERATOR_MANAGED_HOST_IDENTITIES_BOUND_PRE_RUNTIME_START",
    subject_sha:subject,
    production_execution_host_class:a.production_execution_host_class,
    platform_selected:true,
    platform_provider:"LOCAL_OPERATOR_MANAGED_DOCKER",
    local_host_id_bound:!unbound,
    evidence_host_identity_bound:!unbound,
    twin_host_identity_bound:!unbound,
    exact_two_runtime_service_identities_bound:!unbound,
    binding_authorized:!unbound,
    remaining_blockers:unbound?[
      "LOCAL_OPERATOR_HOST_ID_NOT_BOUND",
      "LOCAL_EVIDENCE_LONG_RUNNING_SERVICE_IDENTITY_NOT_BOUND",
      "LOCAL_TWIN_LONG_RUNNING_SERVICE_IDENTITY_NOT_BOUND",
      "LOCAL_24H_HOST_PREFLIGHT_NOT_PROVEN",
      "NON_GITHUB_HOST_BINDING_NOT_COMPLETE"
    ]:[
      "EVIDENCE_PRODUCTION_TARGET_PLANNER_NOT_BOUND",
      "LOCAL_24H_HOST_PREFLIGHT_NOT_PROVEN"
    ],
    external_host_provisioning:false,
    deployment:false,
    runtime_process_start:false,
    production_owner_activation:false,
    provider_request_count:0,
    formal_v5_arm:false,
    a0_bootstrap:false,
    o00_started:false
  });
}catch(e){
  write({status:"FAIL",error:e instanceof Error?e.message:String(e),external_host_provisioning:false,deployment:false,runtime_process_start:false,production_owner_activation:false,provider_request_count:0,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});
  process.exitCode=1;
}
