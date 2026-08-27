// MCFT-CAP-09 Phase5 qualification prewindow prepare for the two-service 24T lane.
//
// This entrypoint consumes canonical Evidence already committed by the production Evidence
// process, then uses the existing prewindow authority builder and bootstrap persistence service.
// It does not fabricate Evidence, call providers, implement a tick, or activate production.

import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import {
  buildExternalFormalAmendment19WindowManifestV1,
  validateExternalFormalAmendment19WindowManifestV1,
} from "../../../domain/twin_runtime/external_formal_amendment19_window_manifest_v1.js";
import {
  buildExternalFormalPrewindowAuthorityBundleV3,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4,
  MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4,
} from "../../../domain/twin_runtime/external_formal_prewindow_authority_bundle_v3.js";
import {
  PostgresNextTickRepositoryV1,
} from "../../../persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import {
  PostgresRuntimeRepositoryV1,
} from "../../../persistence/twin_runtime/postgres_runtime_repository_v1.js";
import {
  MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V3,
  materializeExternalFormalA18CropContextV3,
} from "../external_formal_a18_crop_context_v3.js";
import {
  ExternalFormalBootstrapPersistenceServiceV1,
} from "../external_formal_bootstrap_persistence_service_v1.js";
import {
  PostgresExternalFormalAmendment19EvidenceSourceV1,
} from "../postgres_external_formal_amendment19_evidence_source_v1.js";
import type {
  ReplayEvidenceSourcePortV1,
} from "../ports.js";
import { semanticHashV1 } from "../../../domain/twin_runtime/canonical_identity_v1.js";

function requiredEnvV1(name:string):string {
  const value=String(process.env[name]??"").trim();
  if(!value) throw new Error("PHASE5_PREPARE_ENV_REQUIRED:"+name);
  return value;
}
function loadObjectV1(file:string):Record<string,unknown> {
  const value=JSON.parse(fs.readFileSync(file,"utf8")) as unknown;
  if(!value || typeof value!=="object" || Array.isArray(value)) throw new Error("PHASE5_PREPARE_JSON_OBJECT_REQUIRED:"+file);
  return value as Record<string,unknown>;
}
function materializationHashV1(
  materialized:ReturnType<typeof materializeExternalFormalA18CropContextV3>,
):string {
  return semanticHashV1({
    materialization_profile:MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V3,
    context_ref:materialized.context_ref,
    context_identity_hash:materialized.context_identity_hash,
    materialized_context:materialized.context,
  });
}

class CanonicalA0EvidenceSourceV1 implements ReplayEvidenceSourcePortV1 {
  constructor(private readonly source:PostgresExternalFormalAmendment19EvidenceSourceV1) {}
  async loadCandidateRecords(input:Parameters<ReplayEvidenceSourcePortV1["loadCandidateRecords"]>[0]) {
    const result=await this.source.loadCandidateRecords({
      scope:input.scope,
      logical_time:input.logical_time,
      evidence_snapshot_time:input.logical_time,
    });
    if(result.database_write_count!==0 || result.provider_request_count!==0) {
      throw new Error("PHASE5_PREPARE_A0_EVIDENCE_READ_ONLY_BOUNDARY_DRIFT");
    }
    return result.records;
  }
}

async function main():Promise<void> {
  const subject=requiredEnvV1("GEOX_DEPLOYMENT_SUBJECT_COMMIT");
  if(!/^[0-9a-f]{40}$/.test(subject)) throw new Error("PHASE5_PREPARE_SUBJECT_INVALID");
  const a0=requiredEnvV1("GEOX_MCFT_CAP09_PHASE5_A0");
  if(new Date(a0).toISOString()!==a0 || !a0.endsWith(":00:00.000Z")) throw new Error("PHASE5_PREPARE_A0_INVALID");
  const createdAt=requiredEnvV1("GEOX_MCFT_CAP09_PHASE5_CREATED_AT");
  if(new Date(createdAt).toISOString()!==createdAt || Date.parse(createdAt)>Date.parse(a0)) {
    throw new Error("PHASE5_PREPARE_CREATED_AT_INVALID");
  }
  const outputPath=path.resolve(requiredEnvV1("GEOX_MCFT_CAP09_PHASE5_MANIFEST_OUTPUT"));
  const proofPath=path.resolve(requiredEnvV1("GEOX_MCFT_CAP09_PHASE5_PREPARE_PROOF_OUTPUT"));
  const cropPath=path.resolve(requiredEnvV1("GEOX_MCFT_CAP09_TWIN_RUNTIME_CROP_AUTHORITY_PATH"));
  const matrixPath=path.resolve(requiredEnvV1("GEOX_MCFT_CAP09_TWIN_RUNTIME_CONFIGURATION_MATRIX_PATH"));
  const leaseOwner=requiredEnvV1("GEOX_MCFT_CAP09_TWIN_RUNTIME_LEASE_OWNER");
  const pool=new Pool({connectionString:requiredEnvV1("DATABASE_URL"),max:4});
  try {
    const databaseName=String((await pool.query("SELECT current_database() AS n")).rows[0]?.n??"");
    if(!databaseName) throw new Error("PHASE5_PREPARE_DATABASE_NAME_REQUIRED");
    const epoch="mcft_cap09_phase5_two_service_"+a0.replace(/[^0-9]/g,"")+"_"+subject.slice(0,12);
    const bundle=buildExternalFormalPrewindowAuthorityBundleV3({
      epoch_id:epoch,
      bootstrap_logical_time:a0,
      created_at:createdAt,
      bootstrap_crop_stage_code:"MID",
      hourly_crop_stage_codes:Array.from({length:24},()=> "MID" as const),
      fresh_database_authority_ref:MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4,
      fresh_database_authority_blob_sha:MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4,
    });
    const crop=loadObjectV1(cropPath);
    const matrix=loadObjectV1(matrixPath);
    const pins=bundle.hourly_crop_pins.map(pin=>{
      const materialized=materializeExternalFormalA18CropContextV3({
        logical_time:pin.logical_time,
        expected_identity_hash:pin.crop_stage_context_hash,
        crop_authority:crop,
        configuration_matrix:matrix,
      });
      return {
        slot_id:pin.slot_id,
        logical_time:pin.logical_time,
        crop_stage_context_materialization_hash:materializationHashV1(materialized),
      };
    });
    const manifest=buildExternalFormalAmendment19WindowManifestV1({
      subject_sha:subject,
      database_name:databaseName,
      manifest_ref:"qualification://mcft-cap09/phase5/two-service/"+epoch,
      bundle,
      crop_context_materialization_pins:pins,
    });
    validateExternalFormalAmendment19WindowManifestV1(manifest,subject);

    const runtimeRepository=new PostgresRuntimeRepositoryV1(pool);
    const evidenceSource=new CanonicalA0EvidenceSourceV1(
      new PostgresExternalFormalAmendment19EvidenceSourceV1(pool),
    );
    const bootstrap=new ExternalFormalBootstrapPersistenceServiceV1({
      runtime_config_repository:runtimeRepository,
      bootstrap_persistence:runtimeRepository,
      authority_snapshot_repository:new PostgresNextTickRepositoryV1(pool),
      evidence_source:evidenceSource,
    });
    const result=await bootstrap.execute({
      bundle:bundle.persistence_bundle,
      created_at:a0,
      lease_owner:leaseOwner,
      lease_duration_seconds:300,
    });
    if(result.hourly_runtime_config_count!==24 || result.provider_request_count!==0
      || result.scheduler_slot_write_count!==0 || result.formal_window_started!==false) {
      throw new Error("PHASE5_PREPARE_BOOTSTRAP_BOUNDARY_DRIFT");
    }
    fs.mkdirSync(path.dirname(outputPath),{recursive:true});
    fs.writeFileSync(outputPath,JSON.stringify(manifest,null,2)+"\n");
    const proof={
      schema_version:"geox_mcft_cap09_phase5_two_service_prepare_24t_v3",
      status:"PASS",
      subject_sha:subject,
      database_name:databaseName,
      epoch_id:epoch,
      a0,
      o00:bundle.o00_logical_time,
      o23:bundle.o23_logical_time,
      a0_evidence_source:"CANONICAL_EVIDENCE_DB_ONLY",
      engineering_bootstrap_fixture_count:0,
      hourly_runtime_config_count:result.hourly_runtime_config_count,
      scheduler_slot_write_count:result.scheduler_slot_write_count,
      provider_request_count:result.provider_request_count,
      formal_window_started:result.formal_window_started,
      production_activation:false,
    };
    fs.mkdirSync(path.dirname(proofPath),{recursive:true});
    fs.writeFileSync(proofPath,JSON.stringify(proof,null,2)+"\n");
    process.stdout.write(JSON.stringify(proof)+"\n");
  } finally {
    await pool.end();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
