import assert from "node:assert/strict";
import { createRequire } from "node:module";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "pg";

import {
  ASSIMILATED_CONTINUATION_OBSERVATION_QUANTITY_KIND_V1,
} from "../../apps/server/src/domain/twin_runtime/assimilated_continuation_runtime_config_v1.js";
import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  ExternalFormalBootstrapPersistenceServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_bootstrap_persistence_service_v1.js";
import {
  MCFT_CAP09_AM19_ACCELERATED_SCHEDULER_CLOCK_ACK_V1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.js";
import {
  PostgresNextTickRepositoryV1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import {
  PostgresRuntimeRepositoryV1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  composeMcftCap09FormalV5TwinRuntimeV1,
  initializeMcftCap09FormalV5ActiveCursorV1,
} from "../../apps/server/src/runtime/twin_runtime/mcft_cap09_formal_v5_twin_runtime_composition_v1.js";
import {
  EXTERNAL_FORMAL_V5_AM19_RUNNER_ID_V2,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_v5_amendment19_runner_v2.js";
import {
  buildMcftCap09FormalV5ManifestFromStageAuthorityV1,
} from "./mcft_cap09_formal_v5_manifest_from_stage_authority_v1.js";

const ROOT=fileURLToPath(new URL("../../",import.meta.url));
const DATABASE_URL=process.env.AM22_ISOLATED_DATABASE_URL??"postgres://postgres:postgres@127.0.0.1:55432/am22_o00";
const OUT=path.join(ROOT,"acceptance-output/MCFT_CAP_09_AM22_START_CHAIN_ISOLATED_O00_RESULT.json");
const EVIDENCE_SOURCE="mcft_cap09_external_formal_evidence_v1";
const SUBJECT="1".repeat(40);
// These are controlled contract fixtures, not a real preparation measurement.
const CURRENT_CROP_REF="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T4R1-EFFECTIVE-CURRENT-CROP-AUTHORITY-2026-10-08T04Z-V1.json";
const fixtureCrop=JSON.parse(fs.readFileSync(path.join(ROOT,CURRENT_CROP_REF),"utf8"));
const requireCjs=createRequire(import.meta.url);
const {selectClock}=requireCjs("./MCFT_CAP_09_AM22_EVIDENCE_CLOCK_V2.cjs");
const {buildArm}=requireCjs("./MCFT_CAP_09_AM22_START_CHAIN_V2.cjs");
const {PHASES}=requireCjs("./MCFT_CAP_09_AM22_PREPARATION_ENVELOPE_V1.cjs");
const fixtureBinding={subject_sha:SUBJECT,host_id:"CONTROLLED_ISOLATED_TEST_HOST",image_id:"sha256:"+"b".repeat(64),preparation_profile_sha256:"sha256:"+"c".repeat(64)};
const fixtureEnvelope={...fixtureBinding,schema_version:"geox_mcft_cap09_qualified_complete_pre_a0_envelope_v1",status:"QUALIFIED",synthetic:false,purpose:"COMPLETE_PRE_A0_PREPARATION_NOT_V13_PER_BASE_ACQUISITION",workload_phases:PHASES,measurement_trace_sha256:"sha256:"+"d".repeat(64),independent_qualification_sha256:"sha256:"+"e".repeat(64),observed_max_elapsed_ms:600000,enforced_complete_timeout_ms:600000,safety_margin_ms:120000,selected_budget_ms:720000,qualified_at_database_utc:"2026-10-08T05:30:00.000Z",expires_at_database_utc:"2026-10-08T07:00:00.000Z"};
const clock=selectClock({database_now_utc:"2026-10-08T05:48:00.000Z",binding:fixtureBinding,preparation_envelope:fixtureEnvelope,current_crop_authority:fixtureCrop});
assert.equal(clock.a0,"2026-10-08T06:00:00.000Z");
assert.equal(clock.o00,"2026-10-08T07:00:00.000Z");
assert.equal(clock.fixed_36_hour_lead_used,false);
assert.equal(clock.production_start_authorized,false);
const A0:string=clock.a0, O00:string=clock.o00, O23:string=clock.o23;
const EPOCH="mcft_cap09_am22_controlled_clock_port_isolated";
const LEASE_SECONDS=300;

function addHours(value:string,count:number):string{
  return new Date(Date.parse(value)+count*3_600_000).toISOString();
}
function addMinutes(value:string,count:number):string{
  return new Date(Date.parse(value)+count*60_000).toISOString();
}
function json(rel:string):any{
  return JSON.parse(fs.readFileSync(path.join(ROOT,rel),"utf8"));
}
function weatherPoints(base:string,seed:number){
  return Array.from({length:72},(_,index)=>({
    horizon:index+1,
    valid_from:addHours(base,index),
    valid_to:addHours(base,index+1),
    precipitation_mm:Number((0.15+seed*0.003+(index%4)*0.005).toFixed(6)),
  }));
}
function et0Points(base:string,seed:number){
  return Array.from({length:72},(_,index)=>({
    horizon:index+1,
    valid_from:addHours(base,index),
    valid_to:addHours(base,index+1),
    et0_mm_per_hour:Number((0.12+seed*0.0005+(index%3)*0.002).toFixed(6)),
  }));
}
function assumptionRecord(kind:"weather"|"et0",base:string,seed:number):CanonicalReplayEvidenceRecordV1{
  const issuedAt=addMinutes(base,-30);
  const availableAt=addMinutes(base,-20);
  const recordType=kind==="weather"?"future_weather_assumption_v1":"future_et0_assumption_v1";
  const bindingId=kind==="weather"
    ?MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1
    :MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1;
  const sourceId=`g11_${kind}_${base}_${seed}`;
  const payload={
    snapshot_kind:kind==="weather"?"FUTURE_WEATHER_ASSUMPTION":"FUTURE_ET0_ASSUMPTION",
    points:kind==="weather"?weatherPoints(base,seed):et0Points(base,seed),
  };
  return {
    dataset_id:"mcft_cap09_g11_isolated_o00",
    source_record_id:sourceId,
    source_record_hash:semanticHashV1({sourceId,bindingId,issuedAt,availableAt,payload}),
    record_type:recordType,
    binding_id:bindingId,
    origin_source_kind:"CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id:kind==="weather"?"NOAA_GFS_ENGINEERING_FIXTURE":"ASCE_ET0_FROM_GFS_ENGINEERING_FIXTURE",
    epistemic_class:"ASSUMED",
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    available_to_runtime_at:availableAt,
    role_time:{issued_at:issuedAt,available_to_runtime_at:availableAt,retrieved_at:availableAt,ingested_at:availableAt,valid_from:base,valid_to:addHours(base,72)},
    quality:{status:"PASS"},
    source_payload:structuredClone(payload),
    canonical_payload:payload,
    source_unit:"mm",
    canonical_unit:"mm",
    conversion_rule:{rule_id:kind==="weather"?"PRECIPITATION_MM_IDENTITY_V1":"ET0_MM_PER_HOUR_IDENTITY_V1"},
    limitations:["ENGINEERING_FIXTURE_ONLY","NOT_FORMAL_EXTERNAL_EVIDENCE","CURRENT_72H"],
  };
}
function soilRecord(logicalTime:string,seed:number):CanonicalReplayEvidenceRecordV1{
  const observedAt=addMinutes(logicalTime,-5);
  const availableAt=addMinutes(logicalTime,-4);
  const value=Number((0.30+(seed%5)*0.001).toFixed(6));
  const sourceId=`g11_soil_${logicalTime}_${seed}`;
  const canonicalPayload={
    quantity_kind:ASSIMILATED_CONTINUATION_OBSERVATION_QUANTITY_KIND_V1,
    unit:"fraction",
    value,
  };
  return {
    dataset_id:"mcft_cap09_g11_isolated_o00",
    source_record_id:sourceId,
    source_record_hash:semanticHashV1({sourceId,observedAt,availableAt,canonicalPayload}),
    record_type:"soil_moisture_observation_v1",
    binding_id:MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    origin_source_kind:"CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id:"KBS_SOIL_ENGINEERING_FIXTURE",
    epistemic_class:"OBSERVED",
    ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    available_to_runtime_at:availableAt,
    role_time:{observed_at:observedAt,ingested_at:availableAt},
    quality:{status:"PASS"},
    source_payload:{source_version:"engineering-v1",unit:"fraction",value},
    canonical_payload:canonicalPayload,
    source_unit:"fraction",
    canonical_unit:"fraction",
    conversion_rule:{id:"VWC_FRACTION_IDENTITY_V1",version:"1"},
    limitations:["ENGINEERING_FIXTURE_ONLY","NOT_FORMAL_EXTERNAL_EVIDENCE"],
  };
}
function currentPair(t:string,seed:number):CanonicalReplayEvidenceRecordV1[]{
  return [assumptionRecord("weather",t,seed),assumptionRecord("et0",t,seed)];
}
function eventTime(record:CanonicalReplayEvidenceRecordV1):string{
  if(record.record_type==="soil_moisture_observation_v1")return String(record.role_time?.observed_at);
  return String(record.role_time?.issued_at);
}
async function insertFact(pool:Pool,record:CanonicalReplayEvidenceRecordV1):Promise<void>{
  const factId="g11_"+crypto.createHash("sha256").update(record.source_record_id+"|"+record.source_record_hash).digest("hex");
  await pool.query(
    `INSERT INTO facts(fact_id,occurred_at,source,record_json)
     VALUES($1,$2::timestamptz,$3,$4::jsonb)
     ON CONFLICT(fact_id) DO NOTHING`,
    [factId,eventTime(record),EVIDENCE_SOURCE,JSON.stringify({type:record.record_type,payload:record})],
  );
}
class MemoryEvidenceSource implements ReplayEvidenceSourcePortV1{
  constructor(private readonly rows:readonly CanonicalReplayEvidenceRecordV1[]){}
  async loadCandidateRecords(){return this.rows.map((row)=>structuredClone(row));}
}
async function applySchema(pool:Pool):Promise<void>{
  const files=[
    "docker/postgres/init/001_schema.sql",
    "apps/server/db/migrations/2026_07_09_mcft_cap_01_a0_persistence.sql",
    "apps/server/db/migrations/2026_07_10_mcft_cap_01_closure_remediation.sql",
    "apps/server/db/migrations/2026_07_13_mcft_cap_04_forecast_scenario_persistence.sql",
    "apps/server/db/migrations/2026_07_14_mcft_cap_05_feedback_persistence.sql",
    "apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql",
    "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_base_continuity.sql",
    "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_admission.sql",
    "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_lifecycle.sql",
  ];
  for(const rel of files)await pool.query(fs.readFileSync(path.join(ROOT,rel),"utf8"));
  // Reuse the existing Formal-v5 fenced writer, including its NOLOGIN owner,
  // rather than substituting a test-only direct facts write path.
  await pool.query(`DO $role$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='geox_mcft_cap09_twin_runtime_v1') THEN
      CREATE ROLE geox_mcft_cap09_twin_runtime_v1
        NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    END IF;
  END $role$;`);
  await pool.query(fs.readFileSync(path.join(ROOT,
    "apps/server/db/migrations/2026_08_27_mcft_cap_09_phase5_twin_fact_writer_acl.sql"),"utf8"));
}
async function main(){
  const databaseTarget = new URL(DATABASE_URL);
  assert.ok(
    ["127.0.0.1", "localhost", "[::1]"].includes(databaseTarget.hostname)
      && databaseTarget.pathname === "/am22_o00",
    "AM22_LOCAL_ISOLATED_DATABASE_REQUIRED",
  );
  const pool=new Pool({connectionString:DATABASE_URL,max:8,application_name:"mcft-cap09-g11-isolated-o00"});
  try{
    await applySchema(pool);

    const currentCrop=json(CURRENT_CROP_REF);
    assert.equal(currentCrop.biological_stage.resolved_biological_stage,"R6_OR_LATER_MODEL_ESTIMATE");
    assert.equal(currentCrop.crop_water_use_stage,"LATE");
    assert.ok(Date.parse(currentCrop.biological_stage.authority_valid_until)>=Date.parse(O23));

    // Only the ARM data-construction port is exercised here. H5/handoff/store
    // inputs are explicitly controlled fixtures, not real host qualification.
    const arm=buildArm(
      {subject_sha:SUBJECT,epoch_id:EPOCH,clock,current_crop_authority_sha256:"sha256:"+"a".repeat(64),qualified_envelope_sha256:"sha256:"+"b".repeat(64),retirement_receipt_sha256:"sha256:"+"c".repeat(64)},
      {transaction_read_only:true,formal_database_name:"geox_mcft_cap09_s6_formal_t4r1_24h_v5",all_table_rows_zero:true,public_base_table_count:29,public_routine_count:2},
      {schema_version:"geox_mcft_cap09_formal_v5_evidence_runtime_handoff_authority_v2",deployment_subject_sha:SUBJECT,activation_fence_time:clock.database_now_utc,formal_a0_logical_time:A0,formal_o00_logical_time:O00,formal_o23_logical_time:O23},
      {status:"PASS",deployment_subject_sha:SUBJECT,formal_v5_arm_ready:true,exact_one_live_fenced_owner_per_runtime_role_reverified:true},
      "2026-10-08T05:50:00.000Z",
    );
    assert.equal(arm.arm_issuer,"AM22_V2");
    const built=buildMcftCap09FormalV5ManifestFromStageAuthorityV1({
      arm,
      crop_authority:json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json"),
      configuration_matrix:json("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json"),
      current_crop_authority:currentCrop,
      biological_stage_architecture_effectiveness:json("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json"),
      expected_subject_sha:SUBJECT,
    });

    const runtimeRepo=new PostgresRuntimeRepositoryV1(pool);
    const nextRepo=new PostgresNextTickRepositoryV1(pool);
    // Production promotion persists the raw A0 evidence before bootstrap. O00
    // selects its causal current interval from those same persisted records.
    const a0Evidence=[soilRecord(A0,1),...currentPair(A0,1)];
    for(const row of a0Evidence)await insertFact(pool,row);
    const bootstrap=new ExternalFormalBootstrapPersistenceServiceV1({
      runtime_config_repository:runtimeRepo,
      bootstrap_persistence:runtimeRepo,
      authority_snapshot_repository:nextRepo,
      evidence_source:new MemoryEvidenceSource(a0Evidence),
    });
    const boot=await bootstrap.execute({
      bundle:built.bundle.persistence_bundle,
      created_at:A0,
      lease_owner:"g11-a0-bootstrap",
      lease_duration_seconds:LEASE_SECONDS,
    });
    assert.equal(boot.hourly_runtime_config_count,24);
    assert.equal(boot.scheduler_slot_write_count,0);


    for(const row of [soilRecord(O00,2),...currentPair(O00,2)])await insertFact(pool,row);

    let syntheticNow=O00;
    const composition=composeMcftCap09FormalV5TwinRuntimeV1({
      pool,
      manifest:built.manifest,
      subject_sha:SUBJECT,
      epoch_id:EPOCH,
      crop_authority:built.crop_authority,
      configuration_matrix:built.configuration_matrix,
      current_crop_authority:built.current_crop_authority,
      biological_stage_architecture_effectiveness:built.biological_stage_architecture_effectiveness,
      wait:{async waitAfterAttempt(){}},
      health:{async recordHealth(){}},
      stop:{stopRequested(){return false;}},
      failure_classifier:{classify(){return "FATAL";}},
      scheduler_clock_authority:{
        mode:"ACCELERATED_ENGINEERING_ONLY",
        qualification_ack:MCFT_CAP09_AM19_ACCELERATED_SCHEDULER_CLOCK_ACK_V1,
        now:()=>new Date(syntheticNow),
      },
    });

    assert.equal(composition.contract.one_slot_runner,"ExternalFormalV5Amendment19RunnerV2");
    assert.equal(composition.runner.constructor.name,"ExternalFormalV5Amendment19RunnerV2");

    const bootstrapLease = await composition.scheduler.acquireOrRenewOwnershipLease({
      lease_owner: "g11-a0-bootstrap",
      lease_duration_seconds: LEASE_SECONDS,
    });
    assert.ok(bootstrapLease, "G11_BOOTSTRAP_OWNER_LEASE_REQUIRED");
    assert.equal(
      await composition.scheduler.releaseOwnershipLease({claim: bootstrapLease}),
      "RELEASED",
      "G11_BOOTSTRAP_OWNER_RELEASE_REQUIRED",
    );

    const activeLease = await composition.scheduler.acquireOrRenewOwnershipLease({
      lease_owner: "g11-formal-v5-active", lease_duration_seconds: LEASE_SECONDS,
    });
    assert.ok(activeLease);
    assert.ok(activeLease.fencing_token > bootstrapLease.fencing_token);
    await assert.rejects(
      initializeMcftCap09FormalV5ActiveCursorV1({pool, manifest: built.manifest, claim: {...activeLease, fencing_token: bootstrapLease.fencing_token}}),
      /FORMAL_V5_ACTIVE_CURSOR_CURRENT_FENCING_REQUIRED/,
    );
    assert.equal(await initializeMcftCap09FormalV5ActiveCursorV1({pool, manifest: built.manifest, claim: activeLease}), "CREATED");
    assert.equal(await initializeMcftCap09FormalV5ActiveCursorV1({pool, manifest: built.manifest, claim: activeLease}), "EXISTING");
    await assert.rejects(
      initializeMcftCap09FormalV5ActiveCursorV1({pool, manifest: {...built.manifest, o00_logical_time: addHours(O00, 1)}, claim: activeLease}),
      /FORMAL_V5_ACTIVE_CURSOR_MANIFEST_CONFLICT/,
    );
    const preclaimSlots = await pool.query("SELECT count(*)::int AS count FROM twin_shadow_online_scheduler_slot_v1");
    assert.equal(preclaimSlots.rows[0].count, 0, "G11_CURSOR_INITIALIZATION_MUST_NOT_CLAIM_SLOT");
    await composition.scheduler.releaseOwnershipLease({claim: activeLease});

    const result=await composition.runner.executeOneDueSlot({
      through_logical_time:O00,
      observer_started_at:O00,
      lease_owner:"g11-formal-v5-active",
      lease_duration_seconds:LEASE_SECONDS,
    });
    assert.ok(result.status==="COMPLETED"||result.status==="DEGRADED",`G11_O00_NOT_TERMINAL_SUCCESS:${JSON.stringify(result)}`);
    if(result.status!=="COMPLETED"&&result.status!=="DEGRADED")throw new Error("G11_O00_TERMINAL_SUCCESS_REQUIRED");
    assert.equal(result.slot_id,"O00");
    assert.equal(result.logical_time,O00);
    assert.equal(result.provider_request_count,0);
    assert.equal(result.r2_request_count,0);

    const slot=(await pool.query(
      `SELECT slot_id,logical_time,state,fencing_token FROM twin_shadow_online_scheduler_slot_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      Object.values(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1),
    )).rows;
    assert.equal(slot.length,1);
    assert.equal(slot[0].slot_id,"O00");
    assert.ok(["COMPLETED","DEGRADED"].includes(String(slot[0].state)));
    assert.ok(BigInt(slot[0].fencing_token)>bootstrapLease.fencing_token);

    const proof={
      schema_version:"geox_mcft_cap09_am22_start_chain_isolated_o00_v2",
      status:"PASS",
      run_class:"ISOLATED_CONTROLLED_V2_ARM_DTO_TO_FROZEN_RUNTIME_PORT",
      new_v2_arm_issuer_dto_consumed:true,
      real_host_cutover:false,
      controlled_h5_and_handoff_only:true,
      unit_preparation_envelope_only:true,
      real_preparation_measurement:false,
      production_startup_chain_qualified:false,
      fixed_36_hour_lead_used:false,
      selected_a0:A0,selected_o00:O00,selected_o23:O23,
      isolated_database_writes:true,
      formal_v5_database_writes:false,
      controlled_current_crop_authority:"2026-10-08T04Z",
      controlled_stage:"R6_OR_LATER_MODEL_ESTIMATE",
      v5_runner_id:EXTERNAL_FORMAL_V5_AM19_RUNNER_ID_V2,
      v5_composition_id:composition.composition_id,
      actual_postgres_persistence:true,
      a0_bootstrap_completed:true,
      exact_24_runtime_configs:true,
      o00_entered_v5_execution_path:true,
      o00_terminal_status:result.status,
      o00_scheduler_slot_persisted:true,
      new_fencing_token_after_bootstrap:true,
      active_startup_cursor_initialized_under_fencing:true,
      stale_cursor_initializer_fencing_rejected:true,
      conflicting_cursor_epoch_rejected:true,
      cursor_initialization_does_not_claim_slot:true,
      existing_cursor_preserved:true,
      provider_request_count:0,
      r2_request_count:0,
      scheduler_semantics_rewritten:false,
      persistent_tick_semantics_rewritten:false,
      crop_stage_semantics_rewritten:false,
      database_schema_changed:false,
      production_effect:false,
      formal_neon_write:false,
      mcft_cap09_completed:false,
    };
    fs.mkdirSync(path.dirname(OUT),{recursive:true});
    fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");
    console.log(JSON.stringify(proof,null,2));
  }finally{
    await pool.end();
  }
}
main().catch((error)=>{
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,JSON.stringify({status:"FAIL",error:error instanceof Error?error.message:String(error)},null,2)+"\n");
  console.error(error);
  process.exitCode=1;
});
