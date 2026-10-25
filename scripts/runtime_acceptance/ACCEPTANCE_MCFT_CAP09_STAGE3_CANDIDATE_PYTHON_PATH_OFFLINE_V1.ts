// Offline, zero-I/O regression of exact executable propagation on the real
// isolated composition graph; does NOT assert scientific or physical admission.
import assert from "node:assert/strict";
import type {Pool} from "pg";
import {composeIsolatedMcftCap09V13ProducerCoreV1} from "./MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.js";
import {
 MCFT_CAP09_GFS_BUNDLE_PROVIDER_ID_V1,
 MCFT_CAP09_GFS_BUNDLE_SOURCE_FAMILY_V1,
} from "../../apps/server/src/external_evidence/provider/gfs_nomads_bundle_transport_v1.js";
const target="2026-10-26T18:00:00.000Z";
const run="fefed00d1234", subject="a".repeat(40);
let dbCalls=0, publicCalls=0;
const pool=new Proxy({}, {get(){dbCalls++;throw Error("NO_DATABASE_IO");}}) as Pool;
const pinned=process.execPath;
const core=composeIsolatedMcftCap09V13ProducerCoreV1({
 pool,epoch_id:"stage3-interpreter-regression-"+run,subject_sha:subject,
 isolated_run_id:run,python_executable:pinned,
 private_store:{endpoint:"http://127.0.0.1:1",bucket:"mcft-cap09-requal-"+run,
  region:"us-east-1",access_key_id:"isolated-test-only",
  secret_access_key:"synthetic-no-real-credential",allow_insecure_http_for_test:true},
 fetch_impl:async()=>{publicCalls++;throw Error("NO_PROVIDER_IO");},
});
const captureItem=core.work_item_factory.buildGfsBundle({
 target_logical_time:target,requested_at:"2026-10-25T00:00:00.000Z",
 request_id_prefix:"offline-interpreter-regression",
});
assert.equal(Reflect.get(captureItem.decoder,"pythonExecutable"),pinned,
 "CAPTURE_GFS_DECODER_MUST_RECEIVE_PINNED_INTERPRETER");
const replayFactory=Reflect.get(core.capture_promotion,"decoderFactory");
assert(replayFactory&&typeof replayFactory.createDecoder==="function",
 "PRODUCTION_CANDIDATE_FACTORY_REQUIRED");
const replay=replayFactory.createDecoder({
 base_target_t:target,raw:{
  provider_id:MCFT_CAP09_GFS_BUNDLE_PROVIDER_ID_V1,
  source_family:MCFT_CAP09_GFS_BUNDLE_SOURCE_FAMILY_V1,
  dataset_id:"noaa_ncep_gfs_same_cycle_72h_bundle_v1",
  canonical_record_ingested_at:"2026-10-25T01:00:00.000Z",
 },
});
assert.equal(Reflect.get(replay,"pythonExecutable"),pinned,
 "REHYDRATED_GFS_DECODER_MUST_USE_THE_SAME_PINNED_INTERPRETER");
assert.equal(Reflect.get(replay,"restoredIngestedAt"),"2026-10-25T01:00:00.000Z",
 "REHYDRATED_GFS_MUST_RESTORE_CANDIDATE_INGESTED_AT");
assert.equal(Reflect.get(replay,"normalizeEt0"),true);
assert.equal(dbCalls,0);assert.equal(publicCalls,0);
assert.equal(core.production_wrapper_composer_reused,false);
console.log(JSON.stringify({
 status:"PASS_CAPTURE_AND_CANDIDATE_REHYDRATION_PYTHON_PATH_IDENTITY_OFFLINE",
 source:"EXACT_ISOLATED_COMPOSITION_RUNTIME_GRAPH",producer_capture_decoder:"PINNED",
 candidate_replay_decoder:"SAME_PINNED",restored_ingested_at:true,
 db_calls:dbCalls,public_provider_calls:publicCalls,s3_calls:0,permit:false,
 original_stage_executed:false,physical_science_qualified:false,
}));
