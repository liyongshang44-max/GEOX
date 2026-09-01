import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { S3CompatibleKbsRawHourlyPublicationBaselineStoreV1 } from "../../apps/server/src/external_evidence/kbs_raw_hourly_publication_baseline_store_v1.js";
import { KbsRawHourlyPublicationSnapshotInspectorV1 } from "../../apps/server/src/external_evidence/provider/kbs_raw_hourly_publication_snapshot_v1.js";
import {
  MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1,
  MCFT_CAP09_KBS_RAW_HOURLY_USE_POLICY_REF_V1,
} from "../../apps/server/src/external_evidence/provider/kbs_raw_hourly_live_provider_v1.js";
import { S3CompatiblePrivateRawEvidenceRetentionAdapterV1 } from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";

const OUT=path.resolve("acceptance-output/MCFT_CAP_09_KBS_PUBLICATION_BASELINE_V1_RESULT.json");
const AVAILABLE_AT="2026-09-01T20:00:00.000Z";
const RETAINED_AT="2026-09-01T20:00:01.000Z";
const STORED_AT="2026-09-01T20:00:02.000Z";
const ACTIVATION="2026-09-01T19:00:00.000Z";
const HEADER="datetime_utc,solrad_avg,wind_speed,ah,airtmp_107_avg,rain_mm\n";
const BASE_ROWS=[
  "2026-09-01 16:00:00,120.0,2.0,1.7,23.0,0.1",
  "2026-09-01 17:00:00,150.0,2.5,1.8,24.0,0.2",
  "2026-09-01 18:00:00,180.0,3.0,1.9,25.0,0.3",
];
const RAW=Buffer.from(HEADER+BASE_ROWS.join("\n")+"\n","utf8");

function env(name:string):string{const v=process.env[name]?.trim();if(!v)throw new Error("KBS_PUBLICATION_BASELINE_ACCEPTANCE_ENV_REQUIRED:"+name);return v;}
function sha256(bytes:Uint8Array):string{return "sha256:"+crypto.createHash("sha256").update(bytes).digest("hex");}

async function main():Promise<void>{
  const config={endpoint:env("PHASE7_PRIVATE_S3_ENDPOINT"),bucket:env("PHASE7_PRIVATE_S3_BUCKET"),region:env("PHASE7_PRIVATE_S3_REGION"),access_key_id:env("PHASE7_PRIVATE_S3_ACCESS_KEY_ID"),secret_access_key:env("PHASE7_PRIVATE_S3_SECRET_ACCESS_KEY"),allow_insecure_http_for_test:true};
  const rawWriter=new S3CompatiblePrivateRawEvidenceRetentionAdapterV1({...config,clock:()=>new Date(RETAINED_AT)});
  const rawDigest=sha256(RAW);
  const rawReceipt=await rawWriter.retainRawEvidence({
    retention_class:"PRIVATE_RESTRICTED_RAW_EVIDENCE",request_id:"kbs-publication-baseline-fixture",provider_id:"KBS_LTER",source_family:"RAW_HOURLY_WEATHER",
    source_locator:MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1,final_locator:MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1,content_type:"text/csv",
    retrieved_at:AVAILABLE_AT,available_at:AVAILABLE_AT,use_policy_ref:MCFT_CAP09_KBS_RAW_HOURLY_USE_POLICY_REF_V1,
    raw_sha256:rawDigest,raw_bytes:RAW.byteLength,bytes:RAW,
  });
  assert.equal(rawReceipt.retained_sha256,rawDigest);

  const inspector=new KbsRawHourlyPublicationSnapshotInspectorV1();
  const snapshot=await inspector.inspectSnapshot({raw_bytes:RAW,available_at:AVAILABLE_AT});
  assert.equal(snapshot.endpoint_shape,"COMPLETE_ACCUMULATED_TABLE");
  assert.equal(snapshot.latest_event_time,"2026-09-01T18:00:00.000Z");
  assert.equal(snapshot.latest_event_row_count,1);
  assert.equal(snapshot.raw_values_emitted,false);

  const same=await inspector.diffForward({raw_bytes:RAW,available_at:AVAILABLE_AT,after_event_time:snapshot.latest_event_time});
  assert.equal(same.status,"NO_CHANGE"); assert.equal(same.forward_event_count,0);

  const nextRaw=Buffer.from(HEADER+BASE_ROWS.concat([
    "2026-09-01 19:00:00,190.0,3.1,2.0,25.5,0.4",
    "2026-09-01 20:00:00,200.0,3.2,2.1,26.0,0.5",
  ]).join("\n")+"\n","utf8");
  const forward=await inspector.diffForward({raw_bytes:nextRaw,available_at:"2026-09-01T20:05:00.000Z",after_event_time:snapshot.latest_event_time});
  assert.equal(forward.status,"FORWARD_DELTA");
  assert.deepEqual(forward.forward_event_times,["2026-09-01T19:00:00.000Z","2026-09-01T20:00:00.000Z"]);
  assert.equal(forward.revision_or_backfill_auto_promotion_authorized,false);

  const duplicateForwardRaw=Buffer.from(HEADER+BASE_ROWS.concat([
    "2026-09-01 19:00:00,190.0,3.1,2.0,25.5,0.4",
    "2026-09-01 19:00:00,191.0,3.1,2.0,25.5,0.4",
  ]).join("\n")+"\n","utf8");
  const ambiguous=await inspector.diffForward({raw_bytes:duplicateForwardRaw,available_at:"2026-09-01T20:05:00.000Z",after_event_time:snapshot.latest_event_time});
  assert.equal(ambiguous.status,"AMBIGUOUS_FORWARD");
  assert.deepEqual(ambiguous.ambiguous_forward_event_times,["2026-09-01T19:00:00.000Z"]);

  const store=new S3CompatibleKbsRawHourlyPublicationBaselineStoreV1({...config,clock:()=>new Date(STORED_AT)});
  const manifest={
    schema_version:"geox_mcft_cap09_kbs_raw_hourly_publication_baseline_v1" as const,
    scope:{tenant_id:"tenant_mcft_external",project_id:"project_mcft_cap09",group_id:"group_mcft_cap09",field_id:"field_mcft_external",season_id:"season_2026",zone_id:"zone_root"},
    runtime_start_authority_ref:"authority://mcft-cap09/runtime-start/focused-fixture",activation_fence_time:ACTIVATION,baseline_observed_at:AVAILABLE_AT,
    raw_provenance:{request_id:"kbs-publication-baseline-fixture",provider_id:"KBS_LTER",source_family:"RAW_HOURLY_WEATHER",source_locator:MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1,final_locator:MCFT_CAP09_KBS_RAW_HOURLY_ENDPOINT_V1,content_type:"text/csv",retrieved_at:AVAILABLE_AT,available_at:AVAILABLE_AT,raw_sha256:rawReceipt.retained_sha256,raw_bytes:rawReceipt.retained_bytes,retention_ref:rawReceipt.retention_ref,retained_at:rawReceipt.retained_at,use_policy_ref:MCFT_CAP09_KBS_RAW_HOURLY_USE_POLICY_REF_V1},
    snapshot,canonical_emission_count:0 as const,externally_publishable:false as const,
  };
  const first=await store.writeBaselineManifest(manifest);
  assert.equal(first.idempotent_existing_object,false);assert.equal(first.current_pointer_bound,false);assert.equal(first.externally_publishable,false);
  const second=await store.writeBaselineManifest(manifest);
  assert.equal(second.idempotent_existing_object,true);assert.equal(second.baseline_ref,first.baseline_ref);assert.equal(second.baseline_digest,first.baseline_digest);assert.equal(second.stored_at,first.stored_at);
  const read=await store.readBaselineManifest({baseline_ref:first.baseline_ref,baseline_digest:first.baseline_digest,manifest_bytes:first.manifest_bytes});
  assert.deepEqual(read.manifest,manifest);assert.equal(read.current_pointer_bound,false);

  const proof={schema_version:"geox_mcft_cap09_kbs_publication_baseline_result_v1",status:"PASS",complete_accumulated_table_inspected:true,baseline_snapshot_latest_event_time:snapshot.latest_event_time,no_change_discovery:true,forward_delta_discovery:true,ambiguous_forward_duplicate_fails_to_actionable_state:true,content_addressed_private_baseline_manifest_written:true,baseline_manifest_idempotent:true,baseline_manifest_readback_verified:true,canonical_emission_count:0,baseline_current_pointer_bound:false,database_schema_changed:false,database_connection_attempted:false,provider_request_count:0,runtime_tick_cursor_access_count:0,production_target_planner_bound:false,runtime_process_start:false,production_owner_activation:false,formal_v5_arm:false,a0_bootstrap:false,o00_started:false};
  fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");console.log(JSON.stringify(proof,null,2));
}
main().catch((error)=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({schema_version:"geox_mcft_cap09_kbs_publication_baseline_result_v1",status:"FAIL",error:error instanceof Error?error.message:String(error),database_schema_changed:false,database_connection_attempted:false,production_target_planner_bound:false},null,2)+"\n");console.error(error);process.exitCode=1;});
