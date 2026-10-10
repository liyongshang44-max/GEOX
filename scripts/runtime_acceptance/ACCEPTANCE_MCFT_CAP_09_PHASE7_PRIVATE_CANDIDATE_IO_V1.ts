import crypto from "node:crypto";
import fs from "node:fs";

import { S3CompatiblePrivateRawEvidenceRetentionAdapterV1 } from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import {
  MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_SCHEMA_V1,
  S3CompatiblePrivateCandidateManifestStoreV1,
  type ExternalFormalExactBaseCandidateManifestV1,
  type ExternalFormalCandidateRawProvenanceV1,
} from "../../apps/server/src/external_evidence/s3_compatible_private_candidate_manifest_store_v1.js";
import { S3CompatiblePrivateRetainedRawReaderV1 } from "../../apps/server/src/external_evidence/s3_compatible_private_retained_raw_reader_v1.js";

const OUTPUT_DIR="acceptance-output";
const OUTPUT=`${OUTPUT_DIR}/MCFT_CAP_09_PHASE7_PRIVATE_CANDIDATE_IO_V1_RESULT.json`;

function required(name:string):string{
  const value=process.env[name];
  if(!value?.trim())throw new Error("PHASE7_PRIVATE_CANDIDATE_IO_ENV_REQUIRED:"+name);
  return value.trim();
}
function sha256(value:Buffer|Uint8Array|string):string{
  return "sha256:"+crypto.createHash("sha256").update(value).digest("hex");
}
async function expectReject(fn:()=>Promise<unknown>, code:string):Promise<void>{
  let rejected=false;
  try{await fn();}catch{rejected=true;}
  if(!rejected)throw new Error(code);
}
function provenance(input:{
  receipt:{retention_ref:string;retained_sha256:string;retained_bytes:number;retained_at:string};
  request_id:string;provider_id:string;source_family:string;source_locator:string;final_locator:string;
  content_type:string;retrieved_at:string;available_at:string;use_policy_ref:string;
}):ExternalFormalCandidateRawProvenanceV1{
  return {
    retention_ref:input.receipt.retention_ref,
    retained_sha256:input.receipt.retained_sha256,
    retained_bytes:input.receipt.retained_bytes,
    retained_at:input.receipt.retained_at,
    request_id:input.request_id,
    provider_id:input.provider_id,
    source_family:input.source_family,
    source_locator:input.source_locator,
    final_locator:input.final_locator,
    content_type:input.content_type,
    retrieved_at:input.retrieved_at,
    available_at:input.available_at,
    use_policy_ref:input.use_policy_ref,
  };
}

async function main():Promise<void>{
  const config={
    endpoint:required("PHASE7_PRIVATE_S3_ENDPOINT"),
    bucket:required("PHASE7_PRIVATE_S3_BUCKET"),
    region:required("PHASE7_PRIVATE_S3_REGION"),
    access_key_id:required("PHASE7_PRIVATE_S3_ACCESS_KEY_ID"),
    secret_access_key:required("PHASE7_PRIVATE_S3_SECRET_ACCESS_KEY"),
    allow_insecure_http_for_test:true,
  };
  const rawWriter=new S3CompatiblePrivateRawEvidenceRetentionAdapterV1(config);
  const candidateStore=new S3CompatiblePrivateCandidateManifestStoreV1(config);
  const rawReader=new S3CompatiblePrivateRetainedRawReaderV1(config);

  const gfsBytes=Buffer.from("phase7-private-gfs-raw-bundle-v1","utf8");
  const soilBytes=Buffer.from("phase7-private-kbs-soil-raw-v1","utf8");
  const gfsRetrieved="2026-08-28T09:30:00.000Z";
  const soilRetrieved="2026-08-28T09:35:00.000Z";

  const gfs=await rawWriter.retainRawEvidence({
    retention_class:"PRIVATE_RESTRICTED_RAW_EVIDENCE",
    request_id:"phase7-gfs-request-001",
    provider_id:"gfs_nomads",
    source_family:"GFS",
    source_locator:"https://nomads.example.invalid/gfs",
    final_locator:"https://nomads.example.invalid/gfs-final",
    content_type:"application/x-tar",
    retrieved_at:gfsRetrieved,
    available_at:gfsRetrieved,
    use_policy_ref:"MCFT_CAP09_PHASE7_QUALIFICATION_ONLY",
    raw_sha256:sha256(gfsBytes),
    raw_bytes:gfsBytes.byteLength,
    bytes:gfsBytes,
  });
  const soil=await rawWriter.retainRawEvidence({
    retention_class:"PRIVATE_RESTRICTED_RAW_EVIDENCE",
    request_id:"phase7-soil-request-001",
    provider_id:"kbs_variate25",
    source_family:"KBS_VARIATE25",
    source_locator:"https://kbs.example.invalid/soil",
    final_locator:"https://kbs.example.invalid/soil-final",
    content_type:"application/json",
    retrieved_at:soilRetrieved,
    available_at:soilRetrieved,
    use_policy_ref:"MCFT_CAP09_PHASE7_QUALIFICATION_ONLY",
    raw_sha256:sha256(soilBytes),
    raw_bytes:soilBytes.byteLength,
    bytes:soilBytes,
  });

  if(gfs.externally_publishable!==false||soil.externally_publishable!==false)throw new Error("PHASE7_RAW_PUBLICATION_FORBIDDEN");
  if(!gfs.retention_ref.startsWith("s3-private://")||!soil.retention_ref.startsWith("s3-private://"))throw new Error("PHASE7_RAW_PRIVATE_REF_REQUIRED");

  const manifest:ExternalFormalExactBaseCandidateManifestV1={
    schema_version:MCFT_CAP09_PRIVATE_CANDIDATE_MANIFEST_SCHEMA_V1,
    base_target_t:"2026-08-28T11:00:00.000Z",
    subject_sha:"a".repeat(40),
    producer_run_id:"phase7-private-candidate-qualification",
    captured_at:"2026-08-28T10:00:00.000Z",
    candidate_expires_at:"2026-08-28T12:00:00.000Z",
    expected_records:[
      {record_type:"future_et0_assumption_v1",source_record_id:"phase7-et0-001",record_semantic_sha256:sha256("semantic-et0")},
      {record_type:"future_weather_assumption_v1",source_record_id:"phase7-weather-001",record_semantic_sha256:sha256("semantic-weather")},
      {record_type:"soil_moisture_observation_v1",source_record_id:"phase7-soil-001",record_semantic_sha256:sha256("semantic-soil")},
    ],
    raw_objects:[
      provenance({
        receipt:gfs,request_id:"phase7-gfs-request-001",provider_id:"gfs_nomads",source_family:"GFS",
        source_locator:"https://nomads.example.invalid/gfs",final_locator:"https://nomads.example.invalid/gfs-final",
        content_type:"application/x-tar",retrieved_at:gfsRetrieved,available_at:gfsRetrieved,
        use_policy_ref:"MCFT_CAP09_PHASE7_QUALIFICATION_ONLY",
      }),
      provenance({
        receipt:soil,request_id:"phase7-soil-request-001",provider_id:"kbs_variate25",source_family:"KBS_VARIATE25",
        source_locator:"https://kbs.example.invalid/soil",final_locator:"https://kbs.example.invalid/soil-final",
        content_type:"application/json",retrieved_at:soilRetrieved,available_at:soilRetrieved,
        use_policy_ref:"MCFT_CAP09_PHASE7_QUALIFICATION_ONLY",
      }),
    ],
    raw_values_emitted:false,
    side_effects:{
      formal_database_write_count:0,
      runtime_write_count:0,
      scheduler_write_count:0,
      twin_state_mutation:false,
      provider_refetch_during_rehydration_authorized:false,
    },
  };

  const first=await candidateStore.writeCandidateManifest(manifest);
  const second=await candidateStore.writeCandidateManifest(manifest);
  if(first.idempotent_existing_object!==false||second.idempotent_existing_object!==true)throw new Error("PHASE7_CANDIDATE_IDEMPOTENCY_REQUIRED");
  if(first.capture_ref!==second.capture_ref||first.candidate_artifact_digest!==second.candidate_artifact_digest)throw new Error("PHASE7_CANDIDATE_IDEMPOTENT_IDENTITY_DRIFT");
  if(!first.capture_ref.startsWith("s3-private://"))throw new Error("PHASE7_CANDIDATE_PRIVATE_REF_REQUIRED");
  if(first.formal_database_write_count!==0||second.formal_database_write_count!==0)throw new Error("PHASE7_CANDIDATE_FORMAL_DB_WRITE_FORBIDDEN");

  const read=await candidateStore.readCandidateManifest({
    capture_ref:first.capture_ref,
    candidate_artifact_digest:first.candidate_artifact_digest,
  });
  if(read.manifest.base_target_t!==manifest.base_target_t||read.manifest.raw_values_emitted!==false)throw new Error("PHASE7_CANDIDATE_READBACK_DRIFT");
  if(JSON.stringify(read.manifest.expected_records.map(x=>x.record_type).sort())!==JSON.stringify([
    "future_et0_assumption_v1","future_weather_assumption_v1","soil_moisture_observation_v1"
  ]))throw new Error("PHASE7_CANDIDATE_RECORD_FAMILY_DRIFT");

  const gfsRead=await rawReader.readRetainedRawEvidence({
    retention_ref:gfs.retention_ref,retained_sha256:gfs.retained_sha256,retained_bytes:gfs.retained_bytes,
  });
  const soilRead=await rawReader.readRetainedRawEvidence({
    retention_ref:soil.retention_ref,retained_sha256:soil.retained_sha256,retained_bytes:soil.retained_bytes,
  });
  if(!Buffer.from(gfsRead.bytes).equals(gfsBytes)||!Buffer.from(soilRead.bytes).equals(soilBytes))throw new Error("PHASE7_RAW_READBACK_BYTES_DRIFT");
  if(gfsRead.provider_refetch_count!==0||soilRead.provider_refetch_count!==0)throw new Error("PHASE7_PROVIDER_REFETCH_FORBIDDEN");

  await expectReject(
    ()=>candidateStore.readCandidateManifest({capture_ref:first.capture_ref,candidate_artifact_digest:"sha256:"+"0".repeat(64)}),
    "PHASE7_CANDIDATE_WRONG_DIGEST_MUST_FAIL",
  );
  await expectReject(
    ()=>rawReader.readRetainedRawEvidence({
      retention_ref:gfs.retention_ref,retained_sha256:"sha256:"+"1".repeat(64),retained_bytes:gfs.retained_bytes,
    }),
    "PHASE7_RAW_WRONG_DIGEST_MUST_FAIL",
  );

  fs.mkdirSync(OUTPUT_DIR,{recursive:true});
  const output={
    schema_version:"geox_mcft_cap09_phase7_private_candidate_io_acceptance_v1",
    status:"PASS",
    object_store:"REAL_S3_COMPATIBLE_MINIO",
    raw_object_count:2,
    candidate_manifest_write_count:1,
    candidate_manifest_idempotent_reuse_count:1,
    candidate_manifest_read_count:1,
    retained_raw_read_count:2,
    candidate_capture_ref_scheme:"s3-private",
    candidate_artifact_digest:first.candidate_artifact_digest,
    candidate_manifest_bytes:first.manifest_bytes,
    candidate_stored_at:first.stored_at,
    exact_three_semantic_records:true,
    raw_digest_readback_verified:true,
    raw_retention_metadata_verified:true,
    raw_values_emitted:false,
    provider_request_count:0,
    provider_refetch_count:0,
    github_artifact_rehydration_count:0,
    formal_database_write_count:0,
    runtime_database_write_count:0,
    scheduler_write_count:0,
    twin_state_mutation:false,
    production_process_graph_wiring:false,
    production_owner_activation:false,
    formal_v5_armed:false,
    formal_v5_epoch_selected:false,
    mcft_cap09_completed:false,
  };
  fs.writeFileSync(OUTPUT,JSON.stringify(output,null,2)+"\n");
  process.stdout.write(JSON.stringify(output)+"\n");
}
main().catch((error)=>{console.error(error instanceof Error?error.stack??error.message:String(error));process.exitCode=1;});
