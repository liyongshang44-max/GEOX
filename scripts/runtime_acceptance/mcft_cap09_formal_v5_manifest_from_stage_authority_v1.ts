import {
  buildExternalFormalAmendment19WindowManifestV1,
  validateExternalFormalAmendment19WindowManifestV1,
  type ExternalFormalAmendment19WindowManifestV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_amendment19_window_manifest_v1.js";
import {
  buildExternalFormalPrewindowAuthorityBundleV5,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V5,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V5,
  type ExternalFormalPrewindowAuthorityBundleV5,
} from "../../apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v5.js";
import {
  MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V4,
  materializeExternalFormalA18CropContextV4,
  type MaterializedExternalFormalA18CropContextV4,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v4.js";
import type {
  ExternalFormalV4Am19WindowManifestV2,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_v4_amendment19_runner_v2.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";

export const MCFT_CAP09_FORMAL_V5_DATABASE_V1 =
  "geox_mcft_cap09_s6_formal_t4r1_24h_v5" as const;

type JsonRecordV1=Record<string,unknown>;

export type McftCap09FormalV5ArmV1={
  schema_version:"geox_mcft_cap09_formal_v5_arm_v1";
  status:"PASS";
  subject_sha:string;
  formal_database_name:typeof MCFT_CAP09_FORMAL_V5_DATABASE_V1;
  arm_time_database_utc:string;
  epoch_id:string;
  manifest_ref:string;
  a0:string;
  o00:string;
  o23:string;
  readiness_deadline:string;
  arm_identity_hash:string;
  formal_v5_arm:true;
  formal_v5_epoch_selected:true;
  formal_database_mutation:false;
  schema_materialization:false;
  a0_bootstrap:false;
  o00_started:false;
  provider_request_count:0;
  final_actual_24h_still_required:true;
  mcft_cap09_completed:false;
};

export type BuiltMcftCap09FormalV5StageAuthorityManifestV1={
  arm:McftCap09FormalV5ArmV1;
  bundle:ExternalFormalPrewindowAuthorityBundleV5;
  manifest:ExternalFormalAmendment19WindowManifestV1 & ExternalFormalV4Am19WindowManifestV2;
  prewindow_a0_materialization:MaterializedExternalFormalA18CropContextV4;
  slot_materializations:readonly MaterializedExternalFormalA18CropContextV4[];
  current_crop_authority:JsonRecordV1;
  crop_authority:JsonRecordV1;
  configuration_matrix:JsonRecordV1;
  biological_stage_architecture_effectiveness:JsonRecordV1;
  current_crop_graduated_at:string;
};

function record(value:unknown,code:string):JsonRecordV1{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error(code);
  return value as JsonRecordV1;
}
function text(value:unknown,code:string):string{
  if(typeof value!=="string"||!value.trim())throw new Error(code);
  return value.trim();
}
function sha256(value:unknown,code:string):string{
  const v=text(value,code);
  if(!/^sha256:[0-9a-f]{64}$/.test(v))throw new Error(code);
  return v;
}
function canonicalIso(value:unknown,code:string):string{
  const v=text(value,code),t=Date.parse(v);
  if(!Number.isFinite(t)||new Date(t).toISOString()!==v)throw new Error(code);
  return v;
}
function canonicalHour(value:unknown,code:string):string{
  const v=canonicalIso(value,code);
  if(!v.endsWith(":00:00.000Z"))throw new Error(code);
  return v;
}
function exactSubject(value:unknown):string{
  const v=text(value,"FORMAL_V5_MANIFEST_SUBJECT_REQUIRED");
  if(!/^[0-9a-f]{40}$/.test(v))throw new Error("FORMAL_V5_MANIFEST_SUBJECT_INVALID");
  return v;
}
function addHours(value:string,hours:number):string{
  return new Date(Date.parse(value)+hours*3_600_000).toISOString();
}

export function validateMcftCap09FormalV5ArmV1(
  value:unknown,
  expectedSubjectSha?:string,
):asserts value is McftCap09FormalV5ArmV1{
  const arm=record(value,"FORMAL_V5_MANIFEST_ARM_REQUIRED");
  if(
    arm.schema_version!=="geox_mcft_cap09_formal_v5_arm_v1"
    || arm.status!=="PASS"
    || arm.formal_database_name!==MCFT_CAP09_FORMAL_V5_DATABASE_V1
    || arm.formal_v5_arm!==true
    || arm.formal_v5_epoch_selected!==true
    || arm.formal_database_mutation!==false
    || arm.schema_materialization!==false
    || arm.a0_bootstrap!==false
    || arm.o00_started!==false
    || arm.provider_request_count!==0
    || arm.final_actual_24h_still_required!==true
    || arm.mcft_cap09_completed!==false
  )throw new Error("FORMAL_V5_MANIFEST_ARM_CONTRACT_INVALID");
  const subject=exactSubject(arm.subject_sha);
  if(expectedSubjectSha!==undefined&&subject!==exactSubject(expectedSubjectSha)){
    throw new Error("FORMAL_V5_MANIFEST_ARM_SUBJECT_MISMATCH");
  }
  const epoch=text(arm.epoch_id,"FORMAL_V5_MANIFEST_EPOCH_REQUIRED");
  const a0=canonicalHour(arm.a0,"FORMAL_V5_MANIFEST_A0_INVALID");
  const o00=canonicalHour(arm.o00,"FORMAL_V5_MANIFEST_O00_INVALID");
  const o23=canonicalHour(arm.o23,"FORMAL_V5_MANIFEST_O23_INVALID");
  canonicalIso(arm.arm_time_database_utc,"FORMAL_V5_MANIFEST_ARM_TIME_INVALID");
  canonicalHour(arm.readiness_deadline,"FORMAL_V5_MANIFEST_READINESS_DEADLINE_INVALID");
  if(Date.parse(o00)-Date.parse(a0)!==3_600_000)throw new Error("FORMAL_V5_MANIFEST_A0_O00_OFFSET_INVALID");
  if(Date.parse(o23)-Date.parse(o00)!==23*3_600_000)throw new Error("FORMAL_V5_MANIFEST_O00_O23_SPAN_INVALID");
  const expectedRef=`formal-arm://mcft-cap09/formal-v5/${epoch}/${MCFT_CAP09_FORMAL_V5_DATABASE_V1}`;
  if(arm.manifest_ref!==expectedRef)throw new Error("FORMAL_V5_MANIFEST_ARM_REF_INVALID");
  sha256(arm.arm_identity_hash,"FORMAL_V5_MANIFEST_ARM_IDENTITY_HASH_INVALID");
}

function currentCropFields(value:JsonRecordV1,arm:McftCap09FormalV5ArmV1):{
  stage:"LATE";
  evidence_digest:string;
  authority_as_of:string;
  authority_valid_until:string;
  forward_stability_hours:number;
  graduated_at:string;
}{
  if(
    value.schema_version!=="geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1"
    || value.status!=="PASS"
    || value.qualification_outcome!=="CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED"
    || value.architecture_effective!==true
    || value.runtime_consumption_authorized!==true
  )throw new Error("FORMAL_V5_MANIFEST_CURRENT_CROP_EFFECTIVE_REQUIRED");
  for(const key of [
    "runtime_config_write_authorized","database_write_authorized","scheduler_write_authorized",
    "formal_evidence_write_authorized","production_runtime_start_authorized",
    "production_owner_activation_authorized","formal_v5_authorized","a0_authorized",
    "o00_o23_authorized","mcft_cap09_completed",
  ]){
    if(value[key]!==false)throw new Error("FORMAL_V5_MANIFEST_CURRENT_CROP_EFFECT_CEILING_DRIFT:"+key);
  }
  const lifecycle=record(value.lifecycle,"FORMAL_V5_MANIFEST_CURRENT_CROP_LIFECYCLE_REQUIRED");
  if(
    lifecycle.domain_state!=="ACTIVE"
    || lifecycle.authority_status!=="RESOLVED"
    || lifecycle.authority_validity!=="VALID"
    || lifecycle.authority_mode!=="GOVERNED_PERSISTENT_STATE"
    || lifecycle.active_consumable_candidate!==true
  )throw new Error("FORMAL_V5_MANIFEST_CURRENT_CROP_LIFECYCLE_INVALID");
  const horizon=canonicalIso(lifecycle.horizon_end_utc,"FORMAL_V5_MANIFEST_LIFECYCLE_HORIZON_INVALID");
  if(Date.parse(horizon)<Date.parse(arm.o23))throw new Error("FORMAL_V5_MANIFEST_LIFECYCLE_HORIZON_BEFORE_O23");

  const biological=record(value.biological_stage,"FORMAL_V5_MANIFEST_BIOLOGICAL_STAGE_REQUIRED");
  if(
    biological.epistemic_class!=="THERMAL_MODEL_DERIVED"
    || biological.resolved_biological_stage!=="R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE"
    || biological.observed_biological_stage_claimed!==false
  )throw new Error("FORMAL_V5_MANIFEST_BIOLOGICAL_STAGE_INVALID");
  const authorityAsOf=canonicalHour(biological.authority_as_of,"FORMAL_V5_MANIFEST_STAGE_AUTHORITY_AS_OF_INVALID");
  const forward=Number(biological.forward_stability_hours);
  if(!Number.isInteger(forward)||forward<=0||forward>48)throw new Error("FORMAL_V5_MANIFEST_FORWARD_STABILITY_INVALID");
  const derivedValidUntil=addHours(authorityAsOf,forward);
  const explicitValidUntil=canonicalHour(
    biological.authority_valid_until??derivedValidUntil,
    "FORMAL_V5_MANIFEST_STAGE_VALID_UNTIL_INVALID",
  );
  if(explicitValidUntil!==derivedValidUntil)throw new Error("FORMAL_V5_MANIFEST_STAGE_VALIDITY_DERIVATION_DRIFT");
  if(Date.parse(authorityAsOf)>Date.parse(arm.a0))throw new Error("FORMAL_V5_MANIFEST_STAGE_AUTHORITY_FROM_FUTURE");
  if(Date.parse(explicitValidUntil)<Date.parse(arm.o23))throw new Error("FORMAL_V5_MANIFEST_STAGE_AUTHORITY_DOES_NOT_COVER_O23");

  const graduation=record(value.graduation,"FORMAL_V5_MANIFEST_CURRENT_CROP_GRADUATION_REQUIRED");
  const graduatedAt=canonicalIso(graduation.graduated_at,"FORMAL_V5_MANIFEST_CURRENT_CROP_GRADUATED_AT_INVALID");
  if(!["EFFECTIVE_FOR_RUNTIME_CONSUMPTION","EFFECTIVE_FOR_RUNTIME_CONSUMPTION_ROLLING_REFRESH"].includes(String(graduation.status??""))){
    throw new Error("FORMAL_V5_MANIFEST_CURRENT_CROP_GRADUATION_STATUS_INVALID");
  }
  if(Date.parse(graduatedAt)>Date.parse(arm.a0))throw new Error("FORMAL_V5_MANIFEST_CURRENT_CROP_GRADUATED_AFTER_A0");

  if(value.crop_water_use_stage!=="LATE")throw new Error("FORMAL_V5_MANIFEST_EXACT_LATE_STAGE_REQUIRED");
  return {
    stage:"LATE",
    evidence_digest:sha256(value.evidence_digest,"FORMAL_V5_MANIFEST_CURRENT_CROP_EVIDENCE_DIGEST_INVALID"),
    authority_as_of:authorityAsOf,
    authority_valid_until:explicitValidUntil,
    forward_stability_hours:forward,
    graduated_at:graduatedAt,
  };
}

function validateArchitecture(value:JsonRecordV1):void{
  if(
    value.schema_version!=="geox_dt02_biological_stage_authority_effectiveness_v1"
    || value.amendment_id!=="DT02-AMENDMENT-03"
    || value.status!=="EFFECTIVE"
    || value.effective!==true
  )throw new Error("FORMAL_V5_MANIFEST_STAGE_ARCHITECTURE_EFFECTIVENESS_REQUIRED");
}

function materializationHash(value:MaterializedExternalFormalA18CropContextV4):string{
  const computed=semanticHashV1({
    materialization_profile:MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V4,
    context_ref:value.context_ref,
    context_identity_hash:value.context_identity_hash,
    current_crop_authority_evidence_digest:value.current_crop_authority_evidence_digest,
    materialized_context:value.context,
  });
  if(computed!==value.context_materialization_hash){
    throw new Error("FORMAL_V5_MANIFEST_CROP_MATERIALIZATION_HASH_DRIFT");
  }
  return computed;
}

export function buildMcftCap09FormalV5ManifestFromStageAuthorityV1(input:{
  arm:unknown;
  crop_authority:JsonRecordV1;
  configuration_matrix:JsonRecordV1;
  current_crop_authority:JsonRecordV1;
  biological_stage_architecture_effectiveness:JsonRecordV1;
  expected_subject_sha?:string;
}):BuiltMcftCap09FormalV5StageAuthorityManifestV1{
  validateMcftCap09FormalV5ArmV1(input.arm,input.expected_subject_sha);
  const arm=input.arm;
  validateArchitecture(input.biological_stage_architecture_effectiveness);
  const current=currentCropFields(input.current_crop_authority,arm);

  const bundle=buildExternalFormalPrewindowAuthorityBundleV5({
    epoch_id:arm.epoch_id,
    bootstrap_logical_time:arm.a0,
    created_at:current.graduated_at,
    bootstrap_crop_stage_code:current.stage,
    hourly_crop_stage_codes:Array.from({length:24},()=>current.stage),
    current_crop_authority_evidence_digest:current.evidence_digest,
    stage_authority_as_of:current.authority_as_of,
    forward_stability_hours:current.forward_stability_hours,
  });
  if(bundle.o00_logical_time!==arm.o00||bundle.o23_logical_time!==arm.o23){
    throw new Error("FORMAL_V5_MANIFEST_COMPILED_WINDOW_DRIFT");
  }

  const bootstrapPayload=bundle.persistence_bundle.bootstrap_runtime_config.payload as Record<string,any>;
  const bootstrapCrop=bootstrapPayload.crop_stage_context_authority as Record<string,unknown>|undefined;
  const bootstrapExpected=text(
    bootstrapCrop?.context_hash,
    "FORMAL_V5_MANIFEST_A0_CROP_CONTEXT_HASH_REQUIRED",
  );
  const a0Materialization=materializeExternalFormalA18CropContextV4({
    logical_time:arm.a0,
    expected_identity_hash:bootstrapExpected,
    crop_authority:input.crop_authority,
    configuration_matrix:input.configuration_matrix,
    current_crop_authority:input.current_crop_authority,
    biological_stage_architecture_effectiveness:input.biological_stage_architecture_effectiveness,
    activation_mode:"PRODUCTION_EFFECTIVE",
  });
  if(a0Materialization.production_effective!==true){
    throw new Error("FORMAL_V5_MANIFEST_A0_PRODUCTION_EFFECTIVE_CONTEXT_REQUIRED");
  }
  materializationHash(a0Materialization);

  const slotMaterializations=bundle.hourly_crop_pins.map((pin)=>{
    const materialized=materializeExternalFormalA18CropContextV4({
      logical_time:pin.logical_time,
      expected_identity_hash:pin.crop_stage_context_hash,
      crop_authority:input.crop_authority,
      configuration_matrix:input.configuration_matrix,
      current_crop_authority:input.current_crop_authority,
      biological_stage_architecture_effectiveness:input.biological_stage_architecture_effectiveness,
      activation_mode:"PRODUCTION_EFFECTIVE",
    });
    if(materialized.production_effective!==true){
      throw new Error("FORMAL_V5_MANIFEST_SLOT_PRODUCTION_EFFECTIVE_CONTEXT_REQUIRED:"+pin.slot_id);
    }
    materializationHash(materialized);
    return materialized;
  });

  const manifest=buildExternalFormalAmendment19WindowManifestV1({
    subject_sha:arm.subject_sha,
    database_name:MCFT_CAP09_FORMAL_V5_DATABASE_V1,
    manifest_ref:arm.manifest_ref,
    bundle,
    crop_context_materialization_pins:bundle.hourly_crop_pins.map((pin,index)=>({
      slot_id:pin.slot_id,
      logical_time:pin.logical_time,
      crop_stage_context_materialization_hash:slotMaterializations[index]!.context_materialization_hash,
    })),
  });
  validateExternalFormalAmendment19WindowManifestV1(manifest,arm.subject_sha);
  if(manifest.database_name!==MCFT_CAP09_FORMAL_V5_DATABASE_V1){
    throw new Error("FORMAL_V5_MANIFEST_DATABASE_BINDING_DRIFT");
  }

  for(const config of [
    bundle.persistence_bundle.bootstrap_runtime_config,
    ...bundle.persistence_bundle.runtime_configs,
  ]){
    const payload=config.payload as Record<string,any>;
    if(
      payload.formal_authorities?.fresh_database?.ref!==MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V5
      || payload.formal_authorities?.fresh_database?.hash!==MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V5
    )throw new Error("FORMAL_V5_MANIFEST_RUNTIME_CONFIG_V5_STORE_PIN_REQUIRED");
  }

  return {
    arm,
    bundle,
    manifest:manifest as ExternalFormalAmendment19WindowManifestV1 & ExternalFormalV4Am19WindowManifestV2,
    prewindow_a0_materialization:a0Materialization,
    slot_materializations:slotMaterializations,
    current_crop_authority:input.current_crop_authority,
    crop_authority:input.crop_authority,
    configuration_matrix:input.configuration_matrix,
    biological_stage_architecture_effectiveness:input.biological_stage_architecture_effectiveness,
    current_crop_graduated_at:current.graduated_at,
  };
}
