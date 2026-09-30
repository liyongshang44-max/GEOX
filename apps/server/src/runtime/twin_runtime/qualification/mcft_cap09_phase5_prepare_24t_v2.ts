// MCFT-CAP-09 Phase5 V2 qualification prepare.
//
// Qualification only. Builds a deterministic V4 stage-authority fixture and the exact
// 24-slot manifest consumed by the Production V2 process/composition. All files are
// written only to the caller-provided isolated qualification control directory.

import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import {
  buildExternalFormalAmendment19WindowManifestV1,
  validateExternalFormalAmendment19WindowManifestV1,
} from "../../../domain/twin_runtime/external_formal_amendment19_window_manifest_v1.js";
import type {
  ExternalFormalPrewindowAuthorityBundleV3,
} from "../../../domain/twin_runtime/external_formal_prewindow_authority_bundle_v3.js";
import {
  buildExternalFormalPrewindowAuthorityBundleV4,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4,
  type ExternalFormalPrewindowAuthorityBundleV4,
} from "../../../domain/twin_runtime/external_formal_prewindow_authority_bundle_v4.js";
import {
  PostgresNextTickRepositoryV1,
} from "../../../persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import {
  PostgresRuntimeRepositoryV1,
} from "../../../persistence/twin_runtime/postgres_runtime_repository_v1.js";
import {
  MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V4,
  materializeExternalFormalA18CropContextV4,
} from "../external_formal_a18_crop_context_v4.js";
import {
  ExternalFormalBootstrapPersistenceServiceV1,
} from "../external_formal_bootstrap_persistence_service_v1.js";
import {
  PostgresExternalFormalAmendment19EvidenceSourceV1,
} from "../postgres_external_formal_amendment19_evidence_source_v1.js";
import {
  seedMcftCap09RealClockRehearsalBaselineV1,
} from "./mcft_cap09_real_clock_rehearsal_baseline_v1.js";
import type {
  ReplayEvidenceSourcePortV1,
} from "../ports.js";
import { semanticHashV1 } from "../../../domain/twin_runtime/canonical_identity_v1.js";

function requiredEnvV2(name:string):string {
  const value=String(process.env[name]??"").trim();
  if(!value) throw new Error("PHASE5_PREPARE_V2_ENV_REQUIRED:"+name);
  return value;
}
function loadObjectV2(file:string):Record<string,unknown> {
  const value=JSON.parse(fs.readFileSync(file,"utf8")) as unknown;
  if(!value || typeof value!=="object" || Array.isArray(value)) {
    throw new Error("PHASE5_PREPARE_V2_JSON_OBJECT_REQUIRED:"+file);
  }
  return value as Record<string,unknown>;
}
function canonicalHourV2(value:string,code:string):string {
  const parsed=Date.parse(value);
  if(!Number.isFinite(parsed) || new Date(parsed).toISOString()!==value || !value.endsWith(":00:00.000Z")) {
    throw new Error(code);
  }
  return value;
}
function addHoursV2(value:string,hours:number):string {
  return new Date(Date.parse(value)+hours*3_600_000).toISOString();
}
function writeJsonV2(file:string,value:unknown):void {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(value,null,2)+"\n");
}
function materializationHashV2(
  materialized:ReturnType<typeof materializeExternalFormalA18CropContextV4>,
):string {
  return semanticHashV1({
    materialization_profile:MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V4,
    context_ref:materialized.context_ref,
    context_identity_hash:materialized.context_identity_hash,
    current_crop_authority_evidence_digest:
      materialized.current_crop_authority_evidence_digest,
    materialized_context:materialized.context,
  });
}

function buildQualificationStageAuthoritiesV2(input:{
  subject:string;
  a0:string;
  created_at:string;
}):{
  current_crop_authority:Record<string,unknown>;
  biological_stage_architecture_effectiveness:Record<string,unknown>;
  evidence_digest:string;
} {
  const evidenceDigest=semanticHashV1({
    profile:"MCFT_CAP09_PHASE5_V2_QUALIFICATION_STAGE_AUTHORITY_FIXTURE",
    subject_sha:input.subject,
    a0:input.a0,
    created_at:input.created_at,
    crop:"corn",
    hybrid_product_code:"43-96P",
    stage:"R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
    water_use_stage:"LATE",
  });
  const current={
    schema_version:"geox_mcft_cap09_t4r1_current_crop_authority_composition_result_v1",
    status:"PASS",
    subject_head_sha:input.subject,
    qualification_outcome:"CURRENT_CROP_CONTEXT_AUTHORITY_CANDIDATE_RESOLVED",
    scope:{
      tenant_id:"tenant_mcft_external",
      project_id:"project_mcft_cap09",
      group_id:"group_public_research",
      site_id:"KBS_MCSE_T4R1",
      field_id:"field_kbs_mcse_t4r1",
      season_id:"season_2026_corn",
      zone_id:"zone_kbs_mcse_t4r1_crop_formal_v1",
      crop:"corn",
      hybrid_product_code:"43-96P",
    },
    lifecycle:{
      domain_state:"ACTIVE",
      authority_status:"RESOLVED",
      authority_validity:"VALID",
      authority_mode:"GOVERNED_PERSISTENT_STATE",
      active_consumable_candidate:true,
      evaluated_at:input.created_at,
      known_termination_result:"NONE_FOUND",
      known_contradiction_result:"NONE_FOUND",
      horizon_end_utc:addHoursV2(input.a0,72),
    },
    biological_stage:{
      epistemic_class:"THERMAL_MODEL_DERIVED",
      resolved_biological_stage:"R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE",
      observed_biological_stage_claimed:false,
      authority_as_of:input.a0,
      forward_stability_hours:48,
      authority_valid_until:addHoursV2(input.a0,48),
    },
    crop_water_use_stage:"LATE",
    crop_model_parameter:{
      parameter:"Kc",
      stage_code:"LATE",
      value:0.6,
      configuration_source_id:"mcft_crop_water_use_corn_v1",
      configuration_semantic_hash:
        "sha256:56ac92e34148bd81fe20f2925e1079cb1a3ed647ffefd1471caf1302df70ee4c",
      production_effective:false,
    },
    evidence_digest:evidenceDigest,
    architecture_effective:true,
    runtime_consumption_authorized:true,
    runtime_config_write_authorized:false,
    database_write_authorized:false,
    scheduler_write_authorized:false,
    formal_evidence_write_authorized:false,
    production_runtime_start_authorized:false,
    production_owner_activation_authorized:false,
    formal_v5_authorized:false,
    a0_authorized:false,
    o00_o23_authorized:false,
    mcft_cap09_completed:false,
    qualification_fixture:{
      fixture_class:"PHASE5_V2_ISOLATED_STAGE_AUTHORITY",
      external_field_truth_claimed:false,
      production_authority_claimed:false,
      formal_authority_claimed:false,
    },
  };
  const architecture={
    schema_version:"geox_dt02_biological_stage_authority_effectiveness_v1",
    amendment_id:"DT02-AMENDMENT-03",
    status:"EFFECTIVE",
    effective:true,
    protected_main_sha:input.subject,
    issued_at:input.created_at,
    qualification_fixture:true,
    production_authority_claimed:false,
  };
  return {
    current_crop_authority:current,
    biological_stage_architecture_effectiveness:architecture,
    evidence_digest:evidenceDigest,
  };
}

function projectManifestCompatibleBundleV3(
  input: ExternalFormalPrewindowAuthorityBundleV4,
): ExternalFormalPrewindowAuthorityBundleV3 {
  return {
    epoch_id: input.epoch_id,
    o00_logical_time: input.o00_logical_time,
    o23_logical_time: input.o23_logical_time,
    hourly_crop_pins: input.hourly_crop_pins.map((pin) => ({
      slot_id: pin.slot_id,
      logical_time: pin.logical_time,
      crop_stage_code: pin.crop_stage_code,
      crop_stage_context_hash: pin.crop_stage_context_hash,
    })),
    persistence_bundle: input.persistence_bundle,
  };
}

class CanonicalA0EvidenceSourceV2 implements ReplayEvidenceSourcePortV1 {
  constructor(private readonly source:PostgresExternalFormalAmendment19EvidenceSourceV1) {}
  async loadCandidateRecords(input:Parameters<ReplayEvidenceSourcePortV1["loadCandidateRecords"]>[0]) {
    const result=await this.source.loadCandidateRecords({
      scope:input.scope,
      logical_time:input.logical_time,
      evidence_snapshot_time:input.logical_time,
    });
    if(result.database_write_count!==0 || result.provider_request_count!==0) {
      throw new Error("PHASE5_PREPARE_V2_A0_EVIDENCE_READ_ONLY_BOUNDARY_DRIFT");
    }
    return result.records;
  }
}

async function main():Promise<void> {
  const subject=requiredEnvV2("GEOX_DEPLOYMENT_SUBJECT_COMMIT");
  if(!/^[0-9a-f]{40}$/.test(subject)) throw new Error("PHASE5_PREPARE_V2_SUBJECT_INVALID");
  const runClass=String(process.env.GEOX_MCFT_CAP09_PHASE5_RUN_CLASS??"ACCELERATED_24T").trim();
  if(runClass!=="ACCELERATED_24T"&&runClass!=="REAL_CLOCK_REHEARSAL") {
    throw new Error("PHASE5_PREPARE_V2_RUN_CLASS_INVALID:"+runClass);
  }
  const realClockRehearsal=runClass==="REAL_CLOCK_REHEARSAL";
  const a0=canonicalHourV2(
    requiredEnvV2("GEOX_MCFT_CAP09_PHASE5_A0"),
    "PHASE5_PREPARE_V2_A0_INVALID",
  );
  const createdAt=requiredEnvV2("GEOX_MCFT_CAP09_PHASE5_CREATED_AT");
  if(new Date(createdAt).toISOString()!==createdAt || Date.parse(createdAt)>Date.parse(a0)) {
    throw new Error("PHASE5_PREPARE_V2_CREATED_AT_INVALID");
  }

  const outputPath=path.resolve(requiredEnvV2("GEOX_MCFT_CAP09_PHASE5_MANIFEST_OUTPUT"));
  const proofPath=path.resolve(requiredEnvV2("GEOX_MCFT_CAP09_PHASE5_PREPARE_PROOF_OUTPUT"));
  const currentCropOutput=path.resolve(
    requiredEnvV2("GEOX_MCFT_CAP09_PHASE5_CURRENT_CROP_AUTHORITY_OUTPUT"),
  );
  const stageArchitectureOutput=path.resolve(
    requiredEnvV2("GEOX_MCFT_CAP09_PHASE5_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_OUTPUT"),
  );
  const cropPath=path.resolve(requiredEnvV2("GEOX_MCFT_CAP09_TWIN_RUNTIME_CROP_AUTHORITY_PATH"));
  const matrixPath=path.resolve(requiredEnvV2("GEOX_MCFT_CAP09_TWIN_RUNTIME_CONFIGURATION_MATRIX_PATH"));
  const bootstrapLeaseOwner="phase5-v2-qualification-bootstrap:"+subject.slice(0,12);
  const pool=new Pool({connectionString:requiredEnvV2("DATABASE_URL"),max:4});

  try {
    const rehearsalBaselineChronology=realClockRehearsal
      ?new Date(Date.parse(a0)-30*60_000).toISOString()
      :null;
    if(
      realClockRehearsal
      && !(
        Date.parse(rehearsalBaselineChronology!)>Date.parse(a0)-3_600_000
        && Date.parse(rehearsalBaselineChronology!)<Date.parse(a0)
      )
    ) {
      throw new Error("PHASE5_PREPARE_V2_REHEARSAL_BASELINE_CHRONOLOGY_INVALID");
    }
    const baseline=realClockRehearsal
      ?await seedMcftCap09RealClockRehearsalBaselineV1({
          pool,
          a0,
          seeded_at:rehearsalBaselineChronology!,
        })
      :null;
    const databaseName=String((await pool.query("SELECT current_database() AS n")).rows[0]?.n??"");
    if(!databaseName) throw new Error("PHASE5_PREPARE_V2_DATABASE_NAME_REQUIRED");

    const stages=buildQualificationStageAuthoritiesV2({subject,a0,created_at:createdAt});
    writeJsonV2(currentCropOutput,stages.current_crop_authority);
    writeJsonV2(stageArchitectureOutput,stages.biological_stage_architecture_effectiveness);

    const epoch="mcft_cap09_phase5_v2_"+a0.replace(/[^0-9]/g,"")+"_"+subject.slice(0,12);
    const bundle=buildExternalFormalPrewindowAuthorityBundleV4({
      epoch_id:epoch,
      bootstrap_logical_time:a0,
      created_at:createdAt,
      bootstrap_crop_stage_code:"LATE",
      hourly_crop_stage_codes:Array.from({length:24},()=> "LATE" as const),
      current_crop_authority_evidence_digest:stages.evidence_digest,
      stage_authority_as_of:a0,
      forward_stability_hours:48,
      fresh_database_authority_ref:MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4,
      fresh_database_authority_blob_sha:MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4,
    });
    const crop=loadObjectV2(cropPath);
    const matrix=loadObjectV2(matrixPath);
    const pins=bundle.hourly_crop_pins.map((pin)=>{
      const materialized=materializeExternalFormalA18CropContextV4({
        logical_time:pin.logical_time,
        expected_identity_hash:pin.crop_stage_context_hash,
        crop_authority:crop,
        configuration_matrix:matrix,
        current_crop_authority:stages.current_crop_authority,
        biological_stage_architecture_effectiveness:
          stages.biological_stage_architecture_effectiveness,
        activation_mode:"PRODUCTION_EFFECTIVE",
      });
      if(materialized.production_effective!==true) {
        throw new Error("PHASE5_PREPARE_V2_PRODUCTION_PATH_MATERIALIZATION_REQUIRED");
      }
      return {
        slot_id:pin.slot_id,
        logical_time:pin.logical_time,
        crop_stage_context_materialization_hash:materializationHashV2(materialized),
      };
    });
    const manifest=buildExternalFormalAmendment19WindowManifestV1({
      subject_sha:subject,
      database_name:databaseName,
      manifest_ref:"qualification://mcft-cap09/phase5/v2/"+epoch,
      bundle: projectManifestCompatibleBundleV3(bundle),
      crop_context_materialization_pins:pins,
    });
    validateExternalFormalAmendment19WindowManifestV1(manifest,subject);

    const runtimeRepository=new PostgresRuntimeRepositoryV1(pool);
    const bootstrap=new ExternalFormalBootstrapPersistenceServiceV1({
      runtime_config_repository:runtimeRepository,
      bootstrap_persistence:runtimeRepository,
      authority_snapshot_repository:new PostgresNextTickRepositoryV1(pool),
      evidence_source:new CanonicalA0EvidenceSourceV2(
        new PostgresExternalFormalAmendment19EvidenceSourceV1(pool),
      ),
    });
    const result=await bootstrap.execute({
      bundle:bundle.persistence_bundle,
      created_at:a0,
      lease_owner:bootstrapLeaseOwner,
      lease_duration_seconds:1,
    });
    if(result.hourly_runtime_config_count!==24 || result.provider_request_count!==0
      || result.scheduler_slot_write_count!==0 || result.formal_window_started!==false) {
      throw new Error("PHASE5_PREPARE_V2_BOOTSTRAP_BOUNDARY_DRIFT");
    }

    writeJsonV2(outputPath,manifest);
    const proof={
      schema_version:realClockRehearsal
        ?"geox_mcft_cap09_real_clock_rehearsal_prepare_v2"
        :"geox_mcft_cap09_phase5_two_service_prepare_24t_v4",
      status:"PASS",
      run_class:realClockRehearsal?"QUALIFICATION_REHEARSAL":"ACCELERATED_24T",
      subject_sha:subject,
      database_name:databaseName,
      epoch_id:epoch,
      a0,
      ...(realClockRehearsal
        ?{r00:bundle.o00_logical_time,r23:bundle.o23_logical_time}
        :{o00:bundle.o00_logical_time,o23:bundle.o23_logical_time}),
      production_process_version:"V2",
      production_composition_version:"V2",
      crop_context_materializer:"materializeExternalFormalA18CropContextV4",
      stage_authority_fixture:"PHASE5_V2_ISOLATED_STAGE_AUTHORITY",
      stage_authority_as_of:a0,
      stage_authority_forward_stability_hours:48,
      current_crop_authority_output:currentCropOutput,
      biological_stage_architecture_effectiveness_output:stageArchitectureOutput,
      a0_evidence_source:realClockRehearsal
        ?"CONTROLLED_ISOLATED_REHEARSAL_BASELINE"
        :"CANONICAL_EVIDENCE_DB_ONLY",
      engineering_bootstrap_fixture_count:baseline?.fact_count??0,
      rehearsal_baseline_chronology:rehearsalBaselineChronology,
      rehearsal_baseline_chronology_is_distinct_from_physical_activation_fence:
        realClockRehearsal,
      rehearsal_baseline:baseline,
      hourly_runtime_config_count:result.hourly_runtime_config_count,
      scheduler_slot_write_count:result.scheduler_slot_write_count,
      provider_request_count:result.provider_request_count,
      formal_window_started:result.formal_window_started,
      bootstrap_lease_duration_seconds:1,
      production_activation:false,
      rehearsal_is_non_authority_bearing:realClockRehearsal,
      formal_evidence_claim:false,
      formal_v5_arm:false,
      stage_1b_closure_claim:false,
    };
    writeJsonV2(proofPath,proof);
    process.stdout.write(JSON.stringify(proof)+"\n");
  } finally {
    await pool.end();
  }
}
main().catch((error)=>{console.error(error);process.exitCode=1;});
