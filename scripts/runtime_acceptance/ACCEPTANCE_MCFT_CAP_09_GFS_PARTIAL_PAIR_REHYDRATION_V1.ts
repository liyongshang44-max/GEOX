import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,
  type EvidenceProducerLeaseClaimV1,
  type EvidenceRuntimeScopeV1,
  type EvidenceSupplyCursorSnapshotV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";
import { EvidenceRuntimeCycleServiceV1 } from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_cycle_service_v1.js";
import type {
  ExternalEvidenceDecoderPortV1,
  RawEvidenceRetentionPortV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  MCFT_CAP09_GFS_BUNDLE_LOCATOR_V1,
  MCFT_CAP09_GFS_BUNDLE_PROVIDER_ID_V1,
  MCFT_CAP09_GFS_BUNDLE_SOURCE_FAMILY_V1,
} from "../../apps/server/src/external_evidence/provider/gfs_nomads_bundle_transport_v1.js";
import {
  MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_ID_V1,
  MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_VERSION_V1,
} from "../../apps/server/src/external_evidence/provider/gfs_raw_bundle_evidence_decoder_v1.js";
import {
  GfsPartialPairRehydrationWorkItemFactoryV1,
  MCFT_CAP09_GFS_PRODUCTION_DATASET_ID_V1,
} from "../../apps/server/src/external_evidence/mcft_cap09_gfs_partial_pair_rehydration_v1.js";
import { MCFT_CAP09_EVIDENCE_POST_COMMIT_VISIBILITY_ID_V1 } from "../../apps/server/src/external_evidence/mcft_cap09_evidence_visibility_supply_cursor_v1.js";

const OUT=path.resolve("acceptance-output/MCFT_CAP_09_GFS_PARTIAL_PAIR_REHYDRATION_V1_RESULT.json");
const SCOPE:EvidenceRuntimeScopeV1={tenant_id:"tenant_mcft_external",project_id:"project_mcft_cap09",group_id:"group_mcft_cap09",field_id:"field_mcft_external",season_id:"season_2026",zone_id:"zone_root"};
const TARGET="2026-09-01T20:00:00.000Z";
const CYCLE="2026-09-01T18:00:00.000Z";
const CYCLE_KEY="20260901t180000z";
const AVAILABLE="2026-09-01T18:29:00.000Z";
const RETRIEVED="2026-09-01T18:30:00.000Z";
const RETAINED="2026-09-01T18:30:30.000Z";
const INGESTED="2026-09-01T18:31:00.000Z";
const CANONICALIZED="2026-09-01T20:01:00.000Z";
const READBACK="2026-09-01T20:01:01.000Z";
const RAW=new TextEncoder().encode("focused-gfs-partial-pair-retained-bundle");
const RAW_SHA="sha256:"+crypto.createHash("sha256").update(RAW).digest("hex");
const FACT_ID="fact_external_evidence_"+"a".repeat(64);
const SEMANTIC="sha256:"+"b".repeat(64);
const SOURCE_RECORD="gfs_future_weather_20260901t180000z_20260901t200000z";
const RETENTION_REF="s3-private://focused/mcft-cap09-formal-raw-v1/sha256/"+RAW_SHA.slice(7);

function cursor():EvidenceSupplyCursorSnapshotV1{
  return {scope:{...SCOPE},binding_id:MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,origin_source_id:"gfs_"+CYCLE_KEY+"_pgrb2_0p25_kbs",fact_id:FACT_ID,record_semantic_sha256:SEMANTIC,available_to_runtime_at:RETRIEVED,publication_available_through:AVAILABLE,latest_event_time:CYCLE,latest_source_record_id:SOURCE_RECORD,event_time_contiguous_from:CYCLE,event_time_contiguous_through:CYCLE,event_time_max_seen:CYCLE,event_gap_count:0,revision_count:0,publication_event_count:1,cadence_profile_id:"GFS_SIX_HOUR_CYCLE_V1",role_time:{issued_at:CYCLE,valid_from:TARGET,valid_to:"2026-09-04T20:00:00.000Z",ingested_at:INGESTED},post_commit_db_readback_at:"2026-09-01T18:31:01.000Z",lease_owner:"evidence-runtime",fencing_token:9n,advanced_at:"2026-09-01T18:31:02.000Z"};
}
function claim():EvidenceProducerLeaseClaimV1{
  return {lease_contract_id:MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,scope:{...SCOPE},lease_owner:"evidence-host",fencing_token:11n,acquired_at:"2026-09-01T20:00:00.000Z",expires_at:"2026-09-01T20:10:00.000Z",heartbeat_at:"2026-09-01T20:00:00.000Z",database_now:"2026-09-01T20:00:00.000Z"};
}
function pairDecoder(restoredAt:string):ExternalEvidenceDecoderPortV1{
  return {
    decoder_id:MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_ID_V1,
    decoder_version:MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_VERSION_V1,
    async decodeRetainedEvidence(input){
      assert.equal(input.provenance.request_id,"mcft-cap09-retained-replay:"+FACT_ID);
      assert.equal(input.provenance.source_event_time,TARGET);
      assert.equal(input.raw_bytes.byteLength,RAW.byteLength);
      const common={origin_source_kind:"NOAA_NCEP_NOMADS_GFS",epistemic_class:"ASSUMED" as const,available_to_runtime_at:RETRIEVED,role_time:{issued_at:CYCLE,ingested_at:restoredAt,valid_from:TARGET,valid_to:"2026-09-04T20:00:00.000Z"},quality:{status:"PASS" as const},source_unit:"governed_multi_variable_bundle",canonical_unit:"governed_multi_variable_bundle",conversion_rule:{conversion_rule_id:"FOCUSED_GFS_PARTIAL_REHYDRATION_RULE_V1",conversion_rule_version:"1",authority_ref:"GEOX-MCFT-CAP-09-AMENDMENT-01"},source_binding_version:1,limitations:["FOCUSED_GFS_PARTIAL_PAIR_QUALIFICATION_ONLY"]};
      return [
        {role:"FUTURE_WEATHER_ASSUMPTION" as const,source_record_id:SOURCE_RECORD,binding_id:MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,origin_source_id:"gfs_"+CYCLE_KEY+"_pgrb2_0p25_kbs",...common,source_payload:{cycle_key:CYCLE_KEY,role:"WEATHER"},canonical_payload:{role:"WEATHER",point_count:72}},
        {role:"FUTURE_ET0_ASSUMPTION" as const,source_record_id:"gfs_future_et0_"+CYCLE_KEY+"_20260901t200000z",binding_id:MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,origin_source_id:"gfs_"+CYCLE_KEY+"_asce_short_reference_et0_kbs",...common,source_payload:{cycle_key:CYCLE_KEY,role:"FUTURE_ET0"},canonical_payload:{role:"FUTURE_ET0",point_count:72}},
      ];
    }
  };
}

async function main():Promise<void>{
  let factReads=0,rawReads=0,decoderBuilds=0,restoredSeen="";
  const factory=new GfsPartialPairRehydrationWorkItemFactoryV1({
    fact_replay:{async readReplayProvenance(expected){
      factReads++;
      assert.equal(expected.fact_id,FACT_ID);
      assert.equal(expected.record_type,"future_weather_assumption_v1");
      assert.equal(expected.binding_id,MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1);
      assert.equal(expected.origin_source_id,"gfs_"+CYCLE_KEY+"_pgrb2_0p25_kbs");
      assert.equal(expected.source_record_id,SOURCE_RECORD);
      return {reader_id:"MCFT_CAP09_EXTERNAL_EVIDENCE_FACT_REPLAY_PROVENANCE_READER_V1",fact_id:FACT_ID,dataset_id:MCFT_CAP09_GFS_PRODUCTION_DATASET_ID_V1,record_type:"future_weather_assumption_v1",binding_id:expected.binding_id,origin_source_id:expected.origin_source_id,source_record_id:SOURCE_RECORD,record_semantic_sha256:SEMANTIC,replay_request_id_derivation:"FACT_ID_V1",replay_source_locator_derivation:"FINAL_LOCATOR_V1",restored_ingested_at:INGESTED,decoder:{decoder_id:MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_ID_V1,decoder_version:MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_VERSION_V1},raw_provenance:{request_id:"mcft-cap09-retained-replay:"+FACT_ID,provider_id:MCFT_CAP09_GFS_BUNDLE_PROVIDER_ID_V1,source_family:MCFT_CAP09_GFS_BUNDLE_SOURCE_FAMILY_V1,source_locator:MCFT_CAP09_GFS_BUNDLE_LOCATOR_V1,final_locator:MCFT_CAP09_GFS_BUNDLE_LOCATOR_V1,content_type:"application/x-tar",source_event_time:TARGET,retrieved_at:RETRIEVED,available_at:AVAILABLE,raw_sha256:RAW_SHA,raw_bytes:RAW.byteLength,retention_ref:RETENTION_REF,retained_at:RETAINED,use_policy_ref:"docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-SOURCE-BINDING-MATRIX-V1.json"},database_write_count:0,provider_request_count:0,cursor_mutation_count:0};
    }},
    raw_reader:{async readRetainedRawEvidence(input){
      rawReads++;
      assert.deepEqual(input,{retention_ref:RETENTION_REF,retained_sha256:RAW_SHA,retained_bytes:RAW.byteLength});
      return {reader_id:"MCFT_CAP09_PRIVATE_RETAINED_RAW_READER_V1",retention_ref:RETENTION_REF,retained_sha256:RAW_SHA,retained_bytes:RAW.byteLength,retained_at:RETAINED,bytes:RAW,provider_refetch_count:0,raw_store_write_count:0,formal_database_write_count:0};
    }},
    decoder_factory(input){
      decoderBuilds++;
      restoredSeen=input.restored_ingested_at;
      assert.equal(input.target_logical_time,TARGET);
      return pairDecoder(input.restored_ingested_at);
    }
  });

  const built=await factory.buildWorkItem({scope:SCOPE,partial:{cycle_key:CYCLE_KEY,cycle_issued_at:CYCLE,state:"PARTIAL",weather:cursor(),future_et0:null,paired_valid_from:null},target_logical_time:TARGET,work_item_id_prefix:"focused-gfs-repair"});
  assert.equal(built.available_role,"WEATHER");
  assert.equal(built.missing_role,"FUTURE_ET0");
  assert.equal(factReads,1); assert.equal(rawReads,1); assert.equal(decoderBuilds,1);
  assert.equal(restoredSeen,INGESTED);
  assert.equal(built.work_item.request.request_id,"mcft-cap09-retained-replay:"+FACT_ID);
  assert.equal(built.work_item.request.locator,MCFT_CAP09_GFS_BUNDLE_LOCATOR_V1);
  assert.ok(built.work_item.retention);

  let defaultRetentionCalls=0,weatherIdempotent=0,et0Inserted=0,cursorAdvances=0;
  const defaultRetention:RawEvidenceRetentionPortV1={async retainRawEvidence(){defaultRetentionCalls++;throw new Error("DEFAULT_RETENTION_MUST_NOT_RUN");}};
  const service=new EvidenceRuntimeCycleServiceV1({
    lease:{async acquireLease(){return claim();},async renewLease(input){return input.claim;},async releaseLease(){}},
    retention:defaultRetention,
    committed_ingress_factory:{createForProducerClaim(){return {async appendCanonicalizedExternalEvidence(result){
      const weather=result.record.record_type==="future_weather_assumption_v1";
      if(weather) weatherIdempotent++; else et0Inserted++;
      return {status:weather?"EXISTING_IDEMPOTENT_SUCCESS":"INSERTED",fact_id:"fact_"+result.record.record_type,record_type:result.record.record_type,source_record_id:result.record.source_record_id,source_record_hash:result.record.source_record_hash,retention_ref:result.raw_provenance.retention_ref,raw_sha256:result.raw_provenance.raw_sha256,raw_bytes:result.raw_provenance.raw_bytes,canonical_fact_write_count:weather?0:1};
    }}}},
    visibility:{async verifyCommittedEvidenceVisible(expected){return {...expected,visibility_id:MCFT_CAP09_EVIDENCE_POST_COMMIT_VISIBILITY_ID_V1,post_commit_db_readback_at:READBACK};}},
    cursor_factory:{createForProducerClaim(){return {async advanceAfterVisibleEvidence(input){cursorAdvances++;return {status:input.visible_evidence.record_type==="future_weather_assumption_v1"?"EXISTING_IDEMPOTENT_SUCCESS":"ADVANCED",fact_id:input.visible_evidence.fact_id,record_semantic_sha256:input.visible_evidence.record_semantic_sha256};}};}},
    completion_clock:()=>CANONICALIZED,
  });
  const result=await service.executeCycle({scope:SCOPE,lease_owner:"evidence-host",lease_duration_seconds:300,work_items:[built.work_item]});
  assert.equal(result.status,"COMPLETED");
  if(result.status!=="COMPLETED") throw new Error("GFS_PARTIAL_REHYDRATION_CYCLE_COMPLETION_REQUIRED");
  assert.equal(result.canonical_record_count,2);
  assert.equal(result.visible_ingress_count,2);
  assert.equal(defaultRetentionCalls,0);
  assert.equal(weatherIdempotent,1);
  assert.equal(et0Inserted,1);
  assert.equal(cursorAdvances,2);
  assert.equal((built.work_item.transport as {provider_refetch_count?:number}).provider_refetch_count,0);
  assert.equal((built.work_item.retention as {raw_store_write_count?:number}).raw_store_write_count,0);

  const bad=cursor(); bad.origin_source_id="gfs_wrong_pgrb2_0p25_kbs";
  await assert.rejects(()=>factory.buildWorkItem({scope:SCOPE,partial:{cycle_key:CYCLE_KEY,cycle_issued_at:CYCLE,state:"PARTIAL",weather:bad,future_et0:null,paired_valid_from:null},target_logical_time:TARGET,work_item_id_prefix:"bad"}),/GFS_PARTIAL_REHYDRATION_ORIGIN_MISMATCH/);

  const proof={schema_version:"geox_mcft_cap09_gfs_partial_pair_rehydration_acceptance_v1",status:"PASS",exact_fact_read_count:built.exact_fact_read_count,private_retained_raw_read_count:built.private_retained_raw_read_count,provider_refetch_count:0,raw_store_rewrite_count:0,service_default_retention_call_count:defaultRetentionCalls,restored_ingested_at_exact:restoredSeen===INGESTED,existing_weather_side_idempotent_count:weatherIdempotent,missing_et0_side_insert_count:et0Inserted,visible_cursor_advance_count:cursorAdvances,canonical_pair_record_count:result.canonical_record_count,same_evidence_runtime_cycle_service:true,new_runtime_kernel_created:false,runtime_tick_cursor_access_count:0,twin_state_mutation:false,production_host_binding_authorized:false,production_runtime_started:false,formal_v5_armed:false};
  fs.mkdirSync(path.dirname(OUT),{recursive:true}); fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n"); console.log(JSON.stringify(proof,null,2));
}
main().catch(error=>{fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:error instanceof Error?error.message:String(error),production_runtime_started:false},null,2)+"\n");console.error(error);process.exitCode=1;});
