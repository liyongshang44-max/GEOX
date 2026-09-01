#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"../..");
const AUTH=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-OWNER-PROVISIONING-AUTHORITY-V1.json");
const HOST_AUTH=path.join(ROOT,"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1.json");
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
  const a=j(AUTH), hostAuth=j(HOST_AUTH), arm=j(ARM), principals=t(PRINCIPALS), bootstrap=t(BOOTSTRAP), twinAcl=t(TWIN_ACL), schemaReadiness=t(SCHEMA_READINESS), serviceLoginReadiness=t(SERVICE_LOGIN_READINESS);
  req(a.status==="RUNTIME_CREDENTIAL_BINDING_COMPLETE_NON_GITHUB_HOST_NOT_BOUND","OWNER_PROVISIONING_RUNTIME_CREDENTIAL_COMPLETE_STATUS_REQUIRED");
  req(a.current_stage==="RUNTIME_CREDENTIAL_BINDING_COMPLETE_PRE_HOST_BINDING","OWNER_PROVISIONING_RUNTIME_CREDENTIAL_COMPLETE_STAGE_REQUIRED");
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
  const runtimeUrlReady=a.runtime_credential_url_ready_evidence;
  req(runtimeUrlReady?.status==="IMMUTABLE_SUCCESS_PRE_ARM","OWNER_PROVISIONING_RUNTIME_URL_READY_EVIDENCE_REQUIRED");
  req(runtimeUrlReady?.subject_sha==="a3278aec6c2134356d6a5de39da32760dbd43a71","OWNER_PROVISIONING_RUNTIME_URL_READY_SUBJECT_MISMATCH");
  req(runtimeUrlReady?.runtime_credential_readiness?.run_id===33419987709&&runtimeUrlReady?.runtime_credential_readiness?.job_id===99584523875&&runtimeUrlReady?.runtime_credential_readiness?.artifact_id===9769056212,"OWNER_PROVISIONING_RUNTIME_URL_READY_IDENTITY_MISMATCH");
  req(runtimeUrlReady?.runtime_credential_readiness?.artifact_digest==="sha256:45a7109537ba10011f7dfb9a72bfc6c2b2064ae3ff6e7bf4d62e4e12fea59f69","OWNER_PROVISIONING_RUNTIME_URL_READY_DIGEST_MISMATCH");
  req(runtimeUrlReady?.runtime_credential_readiness?.stage==="RUNTIME_CREDENTIAL_URLS_BOUND_PRE_ARM"&&runtimeUrlReady?.runtime_credential_readiness?.runtime_database_url_secret_count===2&&runtimeUrlReady?.runtime_credential_readiness?.exact_database_name_match===true&&runtimeUrlReady?.runtime_credential_readiness?.exact_login_username_match===true&&runtimeUrlReady?.runtime_credential_readiness?.exact_password_pairing_match===true&&runtimeUrlReady?.runtime_credential_readiness?.exact_seed_host_port_match===true&&runtimeUrlReady?.runtime_credential_readiness?.exact_one_privilege_membership_each===true&&runtimeUrlReady?.runtime_credential_readiness?.evidence_runtime_url_connectivity_proven===true&&runtimeUrlReady?.runtime_credential_readiness?.twin_runtime_url_connectivity_proven===true&&runtimeUrlReady?.runtime_credential_readiness?.runtime_credential_pre_arm_ready===true&&runtimeUrlReady?.runtime_credential_readiness?.runtime_credential_binding===false,"OWNER_PROVISIONING_RUNTIME_URL_READY_SHAPE_MISMATCH");
  req(runtimeUrlReady?.owner_provisioning_readiness?.run_id===33419987686&&runtimeUrlReady?.owner_provisioning_readiness?.job_id===99584540483&&runtimeUrlReady?.owner_provisioning_readiness?.artifact_id===9769057446,"OWNER_PROVISIONING_RUNTIME_URL_READY_OWNER_IDENTITY_MISMATCH");
  req(runtimeUrlReady?.owner_provisioning_readiness?.artifact_digest==="sha256:51a745cb1c36332287f7ffabe8a58a3a89a8c153d3754ff5881afae3b355694b","OWNER_PROVISIONING_RUNTIME_URL_READY_OWNER_DIGEST_MISMATCH");
  req(runtimeUrlReady?.owner_provisioning_readiness?.status==="PASS_RUNTIME_CREDENTIAL_URL_READY_PRE_ARM"&&runtimeUrlReady?.owner_provisioning_readiness?.provisioning_ready===true&&runtimeUrlReady?.owner_provisioning_readiness?.runtime_credential_pre_arm_ready===true&&Array.isArray(runtimeUrlReady?.owner_provisioning_readiness?.remaining_provisioning_blockers)&&runtimeUrlReady.owner_provisioning_readiness.remaining_provisioning_blockers.length===1&&runtimeUrlReady.owner_provisioning_readiness.remaining_provisioning_blockers[0]==="RUNTIME_CREDENTIAL_BINDING_NOT_AUTHORIZED","OWNER_PROVISIONING_RUNTIME_URL_READY_OWNER_SHAPE_MISMATCH");
  const credentialWrite=a.runtime_credential_binding_evidence;
  req(credentialWrite?.status==="IMMUTABLE_SUCCESS","OWNER_PROVISIONING_RUNTIME_CREDENTIAL_BINDING_EVIDENCE_REQUIRED");
  req(credentialWrite?.subject_sha==="939add917b4d97b499d326267e7943c6c1e8e161"&&credentialWrite?.run_id===33422916643&&credentialWrite?.job_id===99589432250&&credentialWrite?.artifact_id===9769604043,"OWNER_PROVISIONING_RUNTIME_CREDENTIAL_BINDING_IDENTITY_MISMATCH");
  req(credentialWrite?.artifact_digest==="sha256:038d593e81b9917299113897a873d24779d5fe638e0f7baea55426bd0dbe3d59","OWNER_PROVISIONING_RUNTIME_CREDENTIAL_BINDING_DIGEST_MISMATCH");
  req(credentialWrite?.stage==="RUNTIME_CREDENTIAL_BINDING_COMPLETE_NON_GITHUB_HOST_NOT_BOUND"&&credentialWrite?.runtime_database_url_secret_count===2&&credentialWrite?.exact_database_name_match===true&&credentialWrite?.exact_login_username_match===true&&credentialWrite?.exact_password_pairing_match===true&&credentialWrite?.exact_seed_host_port_match===true&&credentialWrite?.exact_one_privilege_membership_each===true&&credentialWrite?.evidence_runtime_url_connectivity_proven===true&&credentialWrite?.twin_runtime_url_connectivity_proven===true&&credentialWrite?.runtime_credential_binding===true,"OWNER_PROVISIONING_RUNTIME_CREDENTIAL_BINDING_SHAPE_MISMATCH");
  req(credentialWrite?.runtime_process_start===false&&credentialWrite?.production_owner_activation===false&&credentialWrite?.provider_request_count===0&&credentialWrite?.formal_v5_arm===false&&credentialWrite?.a0_bootstrap===false&&credentialWrite?.o00_started===false&&credentialWrite?.disarmed_after_success===true,"OWNER_PROVISIONING_RUNTIME_CREDENTIAL_BINDING_NON_EFFECT_REQUIRED");

  const credentialRead=a.runtime_credential_post_binding_readiness_evidence;
  req(credentialRead?.status==="IMMUTABLE_SUCCESS","OWNER_PROVISIONING_RUNTIME_CREDENTIAL_POST_READINESS_REQUIRED");
  req(credentialRead?.subject_sha==="d02400b8073bbdeb9c8de2a7add7e897fa3f2613"&&credentialRead?.run_id===33422981303&&credentialRead?.job_id===99589642403&&credentialRead?.artifact_id===9769642560,"OWNER_PROVISIONING_RUNTIME_CREDENTIAL_POST_READINESS_IDENTITY_MISMATCH");
  req(credentialRead?.artifact_digest==="sha256:32ef92e742167d69b4c67d285ab49cb863310cc35b7744759ef0fb5993e31d97","OWNER_PROVISIONING_RUNTIME_CREDENTIAL_POST_READINESS_DIGEST_MISMATCH");
  req(credentialRead?.stage==="RUNTIME_CREDENTIAL_URLS_BOUND_PRE_ARM"&&credentialRead?.runtime_database_url_secret_count===2&&credentialRead?.exact_database_name_match===true&&credentialRead?.exact_login_username_match===true&&credentialRead?.exact_password_pairing_match===true&&credentialRead?.exact_seed_host_port_match===true&&credentialRead?.exact_one_privilege_membership_each===true&&credentialRead?.evidence_runtime_url_connectivity_proven===true&&credentialRead?.twin_runtime_url_connectivity_proven===true&&credentialRead?.credential_arm_observed===false,"OWNER_PROVISIONING_RUNTIME_CREDENTIAL_POST_READINESS_SHAPE_MISMATCH");
  req(credentialRead?.runtime_process_start===false&&credentialRead?.production_owner_activation===false&&credentialRead?.provider_request_count===0&&credentialRead?.formal_v5_arm===false&&credentialRead?.a0_bootstrap===false&&credentialRead?.o00_started===false,"OWNER_PROVISIONING_RUNTIME_CREDENTIAL_POST_READINESS_NON_EFFECT_REQUIRED");

  const credentialSentinel=a.runtime_credential_post_disarm_sentinel_evidence;
  req(credentialSentinel?.status==="IMMUTABLE_SUCCESS","OWNER_PROVISIONING_RUNTIME_CREDENTIAL_POST_DISARM_SENTINEL_REQUIRED");
  req(credentialSentinel?.one_shot?.run_id===33422981304&&credentialSentinel?.one_shot?.job_id===99589643139&&credentialSentinel?.one_shot?.artifact_id===9769694525&&credentialSentinel?.one_shot?.result_status==="SKIPPED_NOT_ARMED","OWNER_PROVISIONING_RUNTIME_CREDENTIAL_POST_DISARM_ONE_SHOT_REQUIRED");
  req(credentialSentinel?.one_shot?.artifact_digest==="sha256:fa48b1476580d0714d186313f6dee9d06d7bc842e8be65480b3f9cd86ce506ca","OWNER_PROVISIONING_RUNTIME_CREDENTIAL_POST_DISARM_ONE_SHOT_DIGEST_MISMATCH");
  req(credentialSentinel?.owner_readiness?.run_id===33422981420&&credentialSentinel?.owner_readiness?.job_id===99589642615&&credentialSentinel?.owner_readiness?.artifact_id===9769700493&&credentialSentinel?.owner_readiness?.status==="PASS_RUNTIME_CREDENTIAL_URL_READY_PRE_ARM"&&credentialSentinel?.owner_readiness?.arm===false,"OWNER_PROVISIONING_RUNTIME_CREDENTIAL_POST_DISARM_OWNER_READY_REQUIRED");
  req(credentialSentinel?.owner_readiness?.artifact_digest==="sha256:e3758ffa64eb7cc7bdabc90bf8f7583406334408bc6b41eafc2bf9e3fc6c9cd7","OWNER_PROVISIONING_RUNTIME_CREDENTIAL_POST_DISARM_OWNER_DIGEST_MISMATCH");
  const endpoint=a.runtime_endpoint_metadata_evidence;
  req(endpoint?.status==="IMMUTABLE_SUCCESS_NON_SECRET","OWNER_PROVISIONING_RUNTIME_ENDPOINT_EVIDENCE_REQUIRED");
  req(endpoint?.subject_sha==="0a457afad141fd55fa0b3cfb2443445cb17890c9"&&endpoint?.run_id===33418849758&&endpoint?.artifact_id===9768092291,"OWNER_PROVISIONING_RUNTIME_ENDPOINT_IDENTITY_MISMATCH");
  req(endpoint?.artifact_digest==="sha256:27a91f5bdd9900fdf0d4556d3575e88391a6afec7a2d2a0b0b19306436872492","OWNER_PROVISIONING_RUNTIME_ENDPOINT_DIGEST_MISMATCH");
  req(endpoint?.neon_project_id==="delicate-glade-62464340"&&endpoint?.neon_branch_id==="br-cold-dust-a6j6aymz"&&endpoint?.neon_branch_name==="main","OWNER_PROVISIONING_RUNTIME_ENDPOINT_NEON_IDENTITY_MISMATCH");
  req(endpoint?.protocol==="postgresql:"&&endpoint?.hostname==="ep-odd-poetry-a6peeo8g.us-west-2.aws.neon.tech"&&endpoint?.port==="5432"&&endpoint?.database_name==="geox_mcft_cap09_production_runtime_v1"&&endpoint?.sslmode==="require"&&endpoint?.channel_binding==="require","OWNER_PROVISIONING_RUNTIME_ENDPOINT_SHAPE_MISMATCH");
  req(endpoint?.contains_username===false&&endpoint?.contains_password===false,"OWNER_PROVISIONING_RUNTIME_ENDPOINT_MUST_BE_NON_SECRET");
  if(a.formal_v5_store_reference) req(a.formal_v5_store_reference.owner_provisioning_target===false,"OWNER_PROVISIONING_FORMAL_V5_TARGET_FORBIDDEN");
  const workspaceBoundPreIdentity=a.next_stage?.status==="WORKSPACE_BOUND_SERVICE_IDENTITIES_NOT_YET_BOUND";
  const platformAuthorizedPreIdentity=a.next_stage?.status==="PLATFORM_AUTHORIZED_SERVICE_IDENTITIES_NOT_YET_BOUND"||workspaceBoundPreIdentity;
  const expectedZeroRuntimeProvisioningStatus=workspaceBoundPreIdentity?"PROVEN_UNAVAILABLE_ON_RENDER_API_V1":"NOT_PROVEN";
  req(a.next_stage?.stage==="NON_GITHUB_HOST_BINDING"&&(a.next_stage?.status==="NOT_STARTED"||platformAuthorizedPreIdentity)&&a.next_stage?.separate_machine_authority_required===true,"OWNER_PROVISIONING_NON_GITHUB_HOST_NEXT_STAGE_REQUIRED");
  req(a.next_stage?.runtime_credential_stage_complete===true&&a.next_stage?.runtime_database_name==="geox_mcft_cap09_production_runtime_v1","OWNER_PROVISIONING_RUNTIME_CREDENTIAL_STAGE_COMPLETE_REQUIRED");
  req(Array.isArray(a.next_stage?.runtime_database_url_secrets_bound)&&a.next_stage.runtime_database_url_secrets_bound.length===2&&a.next_stage?.non_github_host_identity_required===true&&a.next_stage?.non_github_host_identity_status==="NOT_YET_BOUND","OWNER_PROVISIONING_NON_GITHUB_HOST_IDENTITY_REQUIRED");
  req(a.next_stage?.runtime_process_start_forbidden===true&&a.next_stage?.production_owner_activation_forbidden===true&&a.next_stage?.formal_v5_arm_forbidden===true&&a.next_stage?.a0_forbidden===true&&a.next_stage?.o00_forbidden===true,"OWNER_PROVISIONING_NON_GITHUB_HOST_NON_EFFECT_BOUNDARY_REQUIRED");
  req(a.next_stage?.host_binding_authority_ref==="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1.json","OWNER_PROVISIONING_HOST_BINDING_AUTHORITY_REF_REQUIRED");
  const expectedHostStatus=workspaceBoundPreIdentity?"RENDER_WORKSPACE_BOUND_SERVICE_IDENTITIES_UNBOUND":platformAuthorizedPreIdentity?"RENDER_PLATFORM_AUTHORIZED_SERVICE_IDENTITIES_UNBOUND":"HOST_IDENTITY_AUTHORITY_DEFINED_UNBOUND";
  req(a.next_stage?.host_binding_authority_status===expectedHostStatus&&a.next_stage?.host_binding_platform_selected===platformAuthorizedPreIdentity&&a.next_stage?.evidence_host_identity_bound===false&&a.next_stage?.twin_host_identity_bound===false&&a.next_stage?.exact_two_runtime_service_identities_bound===false,"OWNER_PROVISIONING_HOST_BINDING_FRONTIER_REQUIRED");
  req(hostAuth.status===expectedHostStatus&&hostAuth.production_execution_host_class==="NON_GITHUB_LONG_RUNNING_SERVICE","OWNER_PROVISIONING_HOST_AUTHORITY_STATUS_REQUIRED");
  req(hostAuth.github_actions?.production_execution_host_allowed===false,"OWNER_PROVISIONING_GITHUB_EXECUTION_HOST_FORBIDDEN");
  req(hostAuth.host_identity_contract?.evidence_runtime?.runtime_role==="EVIDENCE_RUNTIME"&&hostAuth.host_identity_contract?.twin_runtime?.runtime_role==="TWIN_RUNTIME","OWNER_PROVISIONING_HOST_RUNTIME_ROLES_REQUIRED");
  req(hostAuth.host_identity_contract?.evidence_runtime?.service_identity===null&&hostAuth.host_identity_contract?.twin_runtime?.service_identity===null,"OWNER_PROVISIONING_HOST_IDENTITIES_MUST_REMAIN_UNBOUND");
  req(hostAuth.binding_state?.platform_selected===platformAuthorizedPreIdentity&&hostAuth.binding_state?.evidence_host_identity_bound===false&&hostAuth.binding_state?.twin_host_identity_bound===false&&hostAuth.binding_state?.exact_two_runtime_service_identities_bound===false&&hostAuth.binding_state?.binding_authorized===false,"OWNER_PROVISIONING_HOST_BINDING_STATE_REQUIRED");
  req(hostAuth.next_stage?.stage==="BIND_REAL_NON_GITHUB_PLATFORM_SERVICE_IDENTITIES"&&hostAuth.next_stage?.status===(workspaceBoundPreIdentity?"RENDER_WORKSPACE_BOUND_BLOCKED_ON_RUNTIME_START_BOUNDARY":platformAuthorizedPreIdentity?"RENDER_PLATFORM_AUTHORIZED_AWAITING_SAFE_SERVICE_IDENTITY_PROVISIONING":"BLOCKED_ON_EXTERNAL_PLATFORM_AND_SERVICE_IDENTITIES"),"OWNER_PROVISIONING_HOST_AUTHORITY_NEXT_STAGE_REQUIRED");
  if(platformAuthorizedPreIdentity){
    req(a.next_stage?.platform_selection_authorized===true&&a.next_stage?.service_creation_authorized===true&&a.next_stage?.host_identity_binding_authorized===true,"OWNER_PROVISIONING_RENDER_EXTERNAL_AUTHORITY_REQUIRED");
    req(a.next_stage?.safe_zero_runtime_identity_provisioning_required===true&&a.next_stage?.safe_zero_runtime_identity_provisioning_status===expectedZeroRuntimeProvisioningStatus,"OWNER_PROVISIONING_RENDER_ZERO_RUNTIME_GUARD_REQUIRED");
    req(hostAuth.platform_evaluation?.status==="SELECTED_AUTHORIZED"&&hostAuth.platform_evaluation?.platform_selected===true,"OWNER_PROVISIONING_RENDER_SELECTION_REQUIRED");
    req(
      hostAuth.render_candidate_binding_contract?.status===(workspaceBoundPreIdentity?"WORKSPACE_BOUND_AUTHORIZED_FOR_IDENTITY_PROVISIONING":"AUTHORIZED_FOR_IDENTITY_PROVISIONING_UNBOUND")&&
      hostAuth.render_candidate_binding_contract?.workspace_owner_id===(workspaceBoundPreIdentity?"tea-dab2cfvavr4c73ejavog":null)&&
      hostAuth.render_candidate_binding_contract?.evidence_runtime?.service_id===null&&
      hostAuth.render_candidate_binding_contract?.twin_runtime?.service_id===null,
      "OWNER_PROVISIONING_RENDER_IDENTITIES_MUST_REMAIN_UNBOUND"
    );
    if(workspaceBoundPreIdentity){
      req(a.next_stage?.render_workspace_owner_id_bound===true&&a.next_stage?.render_workspace_owner_id==="tea-dab2cfvavr4c73ejavog","OWNER_PROVISIONING_RENDER_WORKSPACE_BINDING_REQUIRED");
      req(a.next_stage?.service_creation_execution_status==="BLOCKED_BY_RUNTIME_START_BOUNDARY"&&a.next_stage?.new_runtime_start_authority_required_to_create_render_workers===true,"OWNER_PROVISIONING_RENDER_RUNTIME_START_BOUNDARY_REQUIRED");
      req(hostAuth.provider_semantic_evidence?.background_worker_create_contract?.num_instances_minimum===1&&hostAuth.provider_semantic_evidence?.background_worker_create_contract?.zero_instance_create_allowed===false&&hostAuth.provider_semantic_evidence?.suspend_contract?.service_id_required_before_suspend===true&&hostAuth.provider_semantic_evidence?.create_then_suspend_satisfies_zero_runtime_boundary===false,"OWNER_PROVISIONING_RENDER_PROVIDER_SEMANTIC_EVIDENCE_REQUIRED");
    }
    req(hostAuth.render_candidate_binding_contract?.safe_zero_runtime_identity_provisioning_status===expectedZeroRuntimeProvisioningStatus&&hostAuth.render_candidate_binding_contract?.standard_create_service_initial_deploy_allowed===false&&hostAuth.render_candidate_binding_contract?.create_then_suspend_race_allowed===false,"OWNER_PROVISIONING_RENDER_ZERO_RUNTIME_PATH_MUST_REMAIN_FAIL_CLOSED");
  }
  for(const k of ["external_host_provisioning","deployment","runtime_process_start","production_owner_activation","provider_request","formal_v5_arm","a0_bootstrap","o00_started"]) req(hostAuth.non_effects?.[k]===false,"OWNER_PROVISIONING_HOST_AUTHORITY_NON_EFFECT_REQUIRED:"+k);
  req(arm.armed===false&&arm.exact_target_database_name===null,"OWNER_PROVISIONING_MUST_NOT_BE_ARMED");
  for(const k of ["phase4_twin_acl_materialization_authorized","service_login_bootstrap_authorized","runtime_credential_binding_authorized","runtime_process_start_authorized","production_owner_activation_authorized","formal_v5_arm_authorized","a0_authorized","o00_authorized"]) req(arm[k]===false,"OWNER_PROVISIONING_LATER_AUTHORITY_FALSE:"+k);
  for(const marker of ["geox_mcft_cap09_evidence_runtime_login_v1","geox_mcft_cap09_twin_runtime_login_v1","PHASE5_SERVICE_PRIVILEGE_ROLES_REQUIRED","PHASE5_SERVICE_BOOTSTRAP_DATABASE_MISMATCH"]) req(principals.includes(marker),"OWNER_PROVISIONING_PRINCIPAL_CONTRACT_REQUIRED:"+marker);
  for(const marker of ["GEOX_DB_PLATFORM_ADMIN_DATABASE_URL","GEOX_MCFT_CAP09_PHASE5_DATABASE_NAME","GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_PASSWORD","GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_PASSWORD"]) req(bootstrap.includes(marker),"OWNER_PROVISIONING_BOOTSTRAP_BINDING_REQUIRED:"+marker);
  req(twinAcl.includes("CREATE ROLE geox_mcft_cap09_twin_runtime_v1"),"OWNER_PROVISIONING_TWIN_ROLE_MIGRATION_REQUIRED");
  req(twinAcl.includes("NOLOGIN NOINHERIT"),"OWNER_PROVISIONING_TWIN_ROLE_NOINHERIT_REQUIRED");
  req(schemaReadiness.includes("MATERIALIZED_41_TABLE_ZERO_ROW")&&schemaReadiness.includes("SCHEMA_ACL_PRODUCTION_LOGIN_MUST_BE_ABSENT"),"OWNER_PROVISIONING_SCHEMA_READINESS_HISTORICAL_CONTRACT_REQUIRED");
  req(serviceLoginReadiness.includes("SERVICE_LOGIN_COMPLETE_PRE_RUNTIME_CREDENTIAL_BINDING")&&serviceLoginReadiness.includes("SERVICE_LOGIN_READINESS_EXACT_ONE_MEMBERSHIP"),"OWNER_PROVISIONING_SERVICE_LOGIN_READINESS_CONTRACT_REQUIRED");
  req(credentialWrite?.runtime_credential_binding===true&&credentialRead?.credential_arm_observed===false,"OWNER_PROVISIONING_RUNTIME_CREDENTIAL_CLOSURE_REQUIRED");
  req(a.non_effects?.runtime_schema_acl_materialization_performed===true,"OWNER_PROVISIONING_SCHEMA_MATERIALIZATION_EFFECT_REQUIRED");
  req(a.non_effects?.runtime_schema_and_identity_provisioning_performed===true&&a.non_effects?.production_login_creation===true,"OWNER_PROVISIONING_SERVICE_LOGIN_EFFECT_REQUIRED");
  req(a.non_effects?.runtime_credential_binding===true,"OWNER_PROVISIONING_RUNTIME_CREDENTIAL_BINDING_EFFECT_REQUIRED");
  for(const k of ["runtime_process_start","production_owner_activation","provider_request","formal_v5_arm","formal_v5_mutation","a0_bootstrap","o00_started"]) req(a.non_effects?.[k]===false,"OWNER_PROVISIONING_UNAUTHORIZED_EFFECT:"+k);
  write({
    schema_version:"geox_mcft_cap09_production_owner_provisioning_preflight_v1",
    status:"PASS",
    provisioning_status:"RUNTIME_CREDENTIAL_BINDING_COMPLETE_NON_GITHUB_HOST_NOT_BOUND",
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
    runtime_credential_binding_complete:true,
    next_stage:"NON_GITHUB_HOST_BINDING",
    host_binding_authority_defined:true,
    external_platform_selected:platformAuthorizedPreIdentity,
    render_workspace_owner_id_bound:workspaceBoundPreIdentity,
    render_workspace_owner_id:workspaceBoundPreIdentity?"tea-dab2cfvavr4c73ejavog":null,
    evidence_host_identity_bound:false,
    twin_host_identity_bound:false,
    exact_two_runtime_service_identities_bound:false,
    non_github_host_identity_bound:false,
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
