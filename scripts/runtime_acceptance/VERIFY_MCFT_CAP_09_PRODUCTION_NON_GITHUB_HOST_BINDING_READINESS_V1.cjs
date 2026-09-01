"use strict";

const fs=require("node:fs");
const path=require("node:path");
const ROOT=process.cwd();
const AUTH=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1.json");
const OWNER=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OWNER-PROVISIONING-AUTHORITY-V1.json");
const HOST_ARM=path.join(ROOT,"scripts/runtime_acceptance/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_ARM_V1.json");
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_PRODUCTION_NON_GITHUB_HOST_BINDING_READINESS_V1_RESULT.json");
const j=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const req=(v,c)=>{if(!v)throw new Error(c)};
const write=v=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(v,null,2)+"\n");console.log(JSON.stringify(v,null,2));};
const nonEmpty=(v,c)=>{req(typeof v==="string"&&v.trim(),c);return v.trim();};
try{
  const subject=String(process.env.SUBJECT_SHA||"");
  req(/^[0-9a-f]{40}$/.test(subject),"HOST_BINDING_READINESS_SUBJECT_SHA_REQUIRED");
  const a=j(AUTH),owner=j(OWNER),arm=j(HOST_ARM),local=a.local_operator_managed_host_contract;
  req(owner.runtime_credential_binding_evidence?.status==="IMMUTABLE_SUCCESS"&&owner.runtime_credential_post_binding_readiness_evidence?.status==="IMMUTABLE_SUCCESS","HOST_BINDING_READINESS_RUNTIME_CREDENTIAL_CLOSURE_REQUIRED");
  req(a.production_execution_host_class==="NON_GITHUB_LONG_RUNNING_SERVICE"&&a.github_actions?.production_execution_host_allowed===false,"HOST_BINDING_READINESS_HOST_CLASS_REQUIRED");
  req(a.platform_evaluation?.selected_candidate?.platform_provider==="LOCAL_OPERATOR_MANAGED_DOCKER","HOST_BINDING_READINESS_LOCAL_SELECTION_REQUIRED");
  req(arm.runtime_process_start_authorized===false&&arm.production_owner_activation_authorized===false&&arm.formal_v5_arm_authorized===false&&arm.a0_authorized===false&&arm.o00_authorized===false,"HOST_BINDING_READINESS_NON_EFFECT_REQUIRED");
  if(a.status==="LOCAL_OPERATOR_MANAGED_DOCKER_HOST_AUTHORIZED_IDENTITIES_UNBOUND"){
    req(local?.status==="AUTHORIZED_HOST_IDENTITY_UNBOUND"&&local.host_id===null&&local.evidence_runtime?.service_id===null&&local.twin_runtime?.service_id===null,"HOST_BINDING_READINESS_LOCAL_UNBOUND_REQUIRED");
    write({
      schema_version:"geox_mcft_cap09_production_non_github_host_binding_readiness_v1",
      status:"PASS",
      stage:"LOCAL_OPERATOR_MANAGED_HOST_AUTHORIZED_IDENTITIES_UNBOUND",
      subject_sha:subject,
      production_execution_host_class:a.production_execution_host_class,
      platform_selected:true,
      platform_provider:"LOCAL_OPERATOR_MANAGED_DOCKER",
      local_host_id_bound:false,
      evidence_host_identity_bound:false,
      twin_host_identity_bound:false,
      exact_two_runtime_service_identities_bound:false,
      binding_authorized:false,
      remaining_blockers:[
        "LOCAL_OPERATOR_HOST_ID_NOT_BOUND",
        "LOCAL_EVIDENCE_LONG_RUNNING_SERVICE_IDENTITY_NOT_BOUND",
        "LOCAL_TWIN_LONG_RUNNING_SERVICE_IDENTITY_NOT_BOUND",
        "LOCAL_24H_HOST_PREFLIGHT_NOT_PROVEN",
        "NON_GITHUB_HOST_BINDING_NOT_COMPLETE"
      ],
      runtime_process_start:false,production_owner_activation:false,provider_request_count:0,formal_v5_arm:false,a0_bootstrap:false,o00_started:false
    });
    process.exit(0);
  }
  req(a.status==="LOCAL_OPERATOR_MANAGED_DOCKER_HOST_IDENTITIES_BOUND","HOST_BINDING_READINESS_LOCAL_BOUND_STATUS_REQUIRED");
  const hostId=nonEmpty(local?.host_id,"LOCAL_HOST_ID_REQUIRED");
  req(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(hostId),"LOCAL_HOST_UUID_V4_REQUIRED");
  const evidence=local.evidence_runtime,twin=local.twin_runtime;
  const expectedEvidence="local-docker://"+hostId+"/geox-mcft-cap09-evidence-runtime-v1";
  const expectedTwin="local-docker://"+hostId+"/geox-mcft-cap09-twin-runtime-v1";
  req(evidence?.service_id===expectedEvidence&&twin?.service_id===expectedTwin&&expectedEvidence!==expectedTwin,"LOCAL_SERVICE_IDENTITIES_REQUIRED");
  req(evidence.execution_class==="LONG_RUNNING_SERVICE"&&evidence.runtime_role==="EVIDENCE_RUNTIME"&&twin.execution_class==="LONG_RUNNING_SERVICE"&&twin.runtime_role==="TWIN_RUNTIME","LOCAL_SERVICE_RUNTIME_ROLES_REQUIRED");
  req(a.binding_state?.local_host_id_bound===true&&a.binding_state?.evidence_host_identity_bound===true&&a.binding_state?.twin_host_identity_bound===true&&a.binding_state?.exact_two_runtime_service_identities_bound===true&&a.binding_state?.binding_authorized===true,"LOCAL_BOUND_STATE_REQUIRED");
  write({
    schema_version:"geox_mcft_cap09_production_non_github_host_binding_readiness_v1",
    status:"PASS",
    stage:"EXACT_TWO_LOCAL_OPERATOR_MANAGED_SERVICE_IDENTITIES_BOUND_PRE_RUNTIME_START",
    subject_sha:subject,
    production_execution_host_class:a.production_execution_host_class,
    platform_selected:true,
    platform_provider:"LOCAL_OPERATOR_MANAGED_DOCKER",
    local_host_id_bound:true,
    local_host_id:hostId,
    evidence_host_identity_bound:true,
    twin_host_identity_bound:true,
    exact_two_runtime_service_identities_bound:true,
    binding_authorized:true,
    evidence_host:{service_id:expectedEvidence,service_name:evidence.service_name,runtime_role:"EVIDENCE_RUNTIME"},
    twin_host:{service_id:expectedTwin,service_name:twin.service_name,runtime_role:"TWIN_RUNTIME"},
    service_ids_distinct:true,
    remaining_blockers:[
      "EVIDENCE_PRODUCTION_COMPILED_ENTRYPOINT_NOT_PACKAGED",
      "EVIDENCE_PRODUCTION_TARGET_PLANNER_NOT_BOUND",
      "LOCAL_24H_HOST_PREFLIGHT_NOT_PROVEN"
    ],
    github_actions_execution_host:false,runtime_process_start:false,production_owner_activation:false,provider_request_count:0,formal_v5_arm:false,a0_bootstrap:false,o00_started:false
  });
}catch(e){
  write({schema_version:"geox_mcft_cap09_production_non_github_host_binding_readiness_v1",status:"FAIL",subject_sha:String(process.env.SUBJECT_SHA||""),error:e instanceof Error?e.message:String(e),runtime_process_start:false,production_owner_activation:false,provider_request_count:0,formal_v5_arm:false,a0_bootstrap:false,o00_started:false});
  process.exitCode=1;
}
