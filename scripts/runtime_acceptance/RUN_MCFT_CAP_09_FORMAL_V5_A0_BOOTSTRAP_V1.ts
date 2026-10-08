import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  PostgresNextTickRepositoryV1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";
import {
  PostgresRuntimeRepositoryV1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_runtime_repository_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_FACT_SOURCE_V1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.js";
import {
  ExternalFormalBootstrapPersistenceServiceV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_bootstrap_persistence_service_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";
import {
  buildMcftCap09FormalV5ManifestFromStageAuthorityV1,
  MCFT_CAP09_FORMAL_V5_DATABASE_V1,
  validateMcftCap09FormalV5ArmV1,
  type McftCap09FormalV5ArmV1,
} from "./mcft_cap09_formal_v5_manifest_from_stage_authority_v1.js";

const ROOT=process.cwd();
const HOUR=3_600_000;
const LEASE_SECONDS=900;
const EXPECTED_TABLE_COUNT=29;
const EXPECTED_ROUTINE_COUNT=2;
const A0_TYPES=[
  "future_et0_assumption_v1",
  "future_weather_assumption_v1",
  "soil_moisture_observation_v1",
] as const;

const CROP_AUTHORITY_PATH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json";
const MATRIX_PATH="docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json";
const STAGE_ARCHITECTURE_PATH="docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json";
const CONTINUITY_VERIFIER="scripts/runtime_acceptance/VERIFY_MCFT_CAP_09_FORMAL_V5_POST_ARM_AUTHORITY_CONTINUITY_V1.cjs";

const BASE_DIR=path.join(os.homedir(),".geox","mcft-cap09","formal-v5");
const DEFAULT_ARM=path.join(BASE_DIR,"arm-v1.json");
const DEFAULT_SCHEMA=path.join(BASE_DIR,"schema-acl-v1.json");
const DEFAULT_PROMOTION=path.join(BASE_DIR,"a0-production-replay-promotion-v1.json");
const DEFAULT_CONTINUITY=path.join(BASE_DIR,"post-arm-authority-continuity-bootstrap-v1.json");
const DEFAULT_MANIFEST=path.join(BASE_DIR,"formal-window-manifest-v1.json");
const DEFAULT_OUT=path.join(BASE_DIR,"a0-bootstrap-v1.json");

type JsonRecord=Record<string,unknown>;

function arg(name:string):string|null{
  const row=process.argv.slice(2).find((value)=>value.startsWith(name+"="));
  return row?row.slice(name.length+1):null;
}
function has(name:string):boolean{return process.argv.includes(name);}
function requiredEnv(name:string):string{
  const value=String(process.env[name]??"").trim();
  if(!value)throw new Error("FORMAL_V5_A0_BOOTSTRAP_ENV_REQUIRED:"+name);
  return value;
}
function readJson(file:string):any{return JSON.parse(fs.readFileSync(file,"utf8"));}
function readRepoJson(rel:string):JsonRecord{return JSON.parse(fs.readFileSync(path.join(ROOT,rel),"utf8")) as JsonRecord;}
function sha256File(file:string):string{
  return "sha256:"+crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function writeJson(file:string,value:unknown):void{
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(value,null,2)+"\n");
}
function writeImmutableOrMatch(file:string,value:unknown,identity:(existing:any)=>string,expected:string):void{
  fs.mkdirSync(path.dirname(file),{recursive:true});
  if(fs.existsSync(file)){
    const existing=readJson(file);
    assert.equal(identity(existing),expected,"FORMAL_V5_A0_BOOTSTRAP_EXISTING_ARTIFACT_IDENTITY_CONFLICT:"+file);
    return;
  }
  fs.writeFileSync(file,JSON.stringify(value,null,2)+"\n",{flag:"wx"});
}
function git(...args:string[]):string{
  return execFileSync("git",args,{cwd:ROOT,encoding:"utf8"}).trim();
}
function exactIso(value:unknown,code:string):string{
  const text=typeof value==="string"?value.trim():"";
  const parsed=Date.parse(text);
  if(!text||!Number.isFinite(parsed)||new Date(parsed).toISOString()!==text)throw new Error(code);
  return text;
}
function exactHour(value:unknown,code:string):string{
  const text=exactIso(value,code);
  if(!text.endsWith(":00:00.000Z"))throw new Error(code);
  return text;
}
function exactScope(actual:TwinScopeKeyV1,expected:TwinScopeKeyV1,code:string):void{
  for(const key of ["tenant_id","project_id","group_id","field_id","season_id","zone_id"] as const){
    assert.equal(actual[key],expected[key],code+":"+key);
  }
}
function databaseName(urlText:string):string{
  const url=new URL(urlText);
  if(!["postgres:","postgresql:"].includes(url.protocol))throw new Error("FORMAL_V5_A0_BOOTSTRAP_POSTGRES_URL_REQUIRED");
  const name=decodeURIComponent(url.pathname.replace(/^\//,""));
  if(!name)throw new Error("FORMAL_V5_A0_BOOTSTRAP_DATABASE_NAME_REQUIRED");
  return name;
}
function validatePromotion(promotion:any,arm:McftCap09FormalV5ArmV1):void{
  assert.equal(promotion.schema_version,"geox_mcft_cap09_formal_v5_a0_production_replay_promotion_v1","FORMAL_V5_A0_BOOTSTRAP_PROMOTION_SCHEMA_REQUIRED");
  assert.equal(promotion.status,"PASS","FORMAL_V5_A0_BOOTSTRAP_PROMOTION_PASS_REQUIRED");
  assert.equal(promotion.subject_sha,arm.subject_sha,"FORMAL_V5_A0_BOOTSTRAP_PROMOTION_SUBJECT_MISMATCH");
  assert.equal(promotion.arm_identity_hash,arm.arm_identity_hash,"FORMAL_V5_A0_BOOTSTRAP_PROMOTION_ARM_MISMATCH");
  assert.equal(promotion.epoch_id,arm.epoch_id,"FORMAL_V5_A0_BOOTSTRAP_PROMOTION_EPOCH_MISMATCH");
  assert.equal(promotion.formal_database_name,MCFT_CAP09_FORMAL_V5_DATABASE_V1,"FORMAL_V5_A0_BOOTSTRAP_PROMOTION_DATABASE_MISMATCH");
  assert.equal(promotion.a0,arm.a0,"FORMAL_V5_A0_BOOTSTRAP_PROMOTION_A0_MISMATCH");
  assert.equal(promotion.o00,arm.o00,"FORMAL_V5_A0_BOOTSTRAP_PROMOTION_O00_MISMATCH");
  assert.equal(promotion.formal_fact_count,3,"FORMAL_V5_A0_BOOTSTRAP_PROMOTION_EXACT_THREE_FACTS_REQUIRED");
  assert.equal(
    Number(promotion.formal_canonical_fact_write_count??0)+Number(promotion.formal_existing_idempotent_fact_count??0),
    3,
    "FORMAL_V5_A0_BOOTSTRAP_PROMOTION_EXACT_THREE_PRESENT_REQUIRED",
  );
  for(const [key,expected] of Object.entries({
    exact_a0_same_cycle_gfs_pair:true,
    a0_gfs_pair_causal_at_a0:true,
    a0_base_supports_o00_warm_start:true,
    soil_selected_by_existing_a0_evidence_window:true,
    source_operational_database_read_only:true,
    raw_bucket_identity_separation_preserved:true,
    production_raw_verified_before_formal_retention:true,
    formal_raw_retained_before_decoder:true,
    decoder_identity_reused:true,
    normalized_semantic_equivalence_verified:true,
    exact_cross_bucket_fact_identity_preserved:false,
    exact_cross_bucket_fact_identity_preservation_forbidden:true,
    provider_request_count:0,
    source_operational_database_write_count:0,
    scheduler_slot_write_count:0,
    runtime_tick_cursor_write_count:0,
    twin_state_mutation:false,
    a0_evidence_promoted:true,
    a0_bootstrap:false,
    formal_o00_started:false,
    mcft_cap09_completed:false,
  })){
    assert.equal(promotion[key],expected,"FORMAL_V5_A0_BOOTSTRAP_PROMOTION_BOUNDARY_DRIFT:"+key);
  }
}
class FrozenFormalV5A0EvidenceSource implements ReplayEvidenceSourcePortV1{
  private frozen:CanonicalReplayEvidenceRecordV1[]|null=null;
  constructor(private readonly pool:Pool,private readonly a0:string){}
  async loadCandidateRecords(input:{scope:TwinScopeKeyV1;logical_time:string}):Promise<readonly CanonicalReplayEvidenceRecordV1[]>{
    assert.equal(input.logical_time,this.a0,"FORMAL_V5_A0_BOOTSTRAP_SOURCE_ONLY_EXACT_A0");
    exactScope(input.scope,{...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1},"FORMAL_V5_A0_BOOTSTRAP_SCOPE_MISMATCH");
    if(this.frozen)return structuredClone(this.frozen);
    const s=MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1;
    const rows=(await this.pool.query<{payload:CanonicalReplayEvidenceRecordV1}>(
      `SELECT record_json->'payload' AS payload
         FROM public.facts
        WHERE source=$1
          AND record_json#>>'{payload,tenant_id}'=$2
          AND record_json#>>'{payload,project_id}'=$3
          AND record_json#>>'{payload,group_id}'=$4
          AND record_json#>>'{payload,field_id}'=$5
          AND record_json#>>'{payload,season_id}'=$6
          AND record_json#>>'{payload,zone_id}'=$7
          AND record_json->>'type'=ANY($8::text[])
          AND (record_json#>>'{payload,role_time,ingested_at}')::timestamptz <= $9::timestamptz
          AND (record_json#>>'{payload,available_to_runtime_at}')::timestamptz <= $9::timestamptz
        ORDER BY occurred_at ASC,fact_id ASC`,
      [
        MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_FACT_SOURCE_V1,
        s.tenant_id,s.project_id,s.group_id,s.field_id,s.season_id,s.zone_id,
        [...A0_TYPES],this.a0,
      ],
    )).rows;
    assert.equal(rows.length,3,"FORMAL_V5_A0_BOOTSTRAP_EXACT_THREE_CAUSAL_FACTS_REQUIRED");
    const records=rows.map((row)=>structuredClone(row.payload));
    assert.deepEqual(
      records.map((record)=>record.record_type).sort(),
      [...A0_TYPES],
      "FORMAL_V5_A0_BOOTSTRAP_EXACT_TYPE_SET_REQUIRED",
    );
    this.frozen=records;
    return structuredClone(records);
  }
}
async function prebootstrapState(pool:Pool,url:string):Promise<{database_now:string;current_user:string}>{
  assert.equal(databaseName(url),MCFT_CAP09_FORMAL_V5_DATABASE_V1,"FORMAL_V5_A0_BOOTSTRAP_EXACT_V5_DATABASE_REQUIRED");
  const identity=(await pool.query<{db:string;current_user:string;database_now:Date}>(
    "SELECT current_database()::text AS db,current_user::text AS current_user,transaction_timestamp() AS database_now"
  )).rows[0];
  if(!identity)throw new Error("FORMAL_V5_A0_BOOTSTRAP_DATABASE_IDENTITY_REQUIRED");
  assert.equal(identity.db,MCFT_CAP09_FORMAL_V5_DATABASE_V1,"FORMAL_V5_A0_BOOTSTRAP_SESSION_DATABASE_MISMATCH");
  assert.notEqual(identity.current_user,"geox_mcft_cap09_evidence_runtime_login_v1","FORMAL_V5_A0_BOOTSTRAP_OPERATOR_MUST_NOT_USE_EVIDENCE_LOGIN");
  assert.notEqual(identity.current_user,"geox_mcft_cap09_twin_runtime_login_v1","FORMAL_V5_A0_BOOTSTRAP_OPERATOR_MUST_NOT_USE_TWIN_LOGIN");

  const tableCount=Number((await pool.query<{n:number}>(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
  )).rows[0]?.n??-1);
  const routineCount=Number((await pool.query<{n:number}>(
    "SELECT count(*)::int AS n FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'"
  )).rows[0]?.n??-1);
  assert.equal(tableCount,EXPECTED_TABLE_COUNT,"FORMAL_V5_A0_BOOTSTRAP_EXACT_29_TABLES_REQUIRED");
  assert.equal(routineCount,EXPECTED_ROUTINE_COUNT,"FORMAL_V5_A0_BOOTSTRAP_EXACT_2_ROUTINES_REQUIRED");

  const facts=Number((await pool.query<{n:number}>("SELECT count(*)::int AS n FROM public.facts")).rows[0]?.n??-1);
  assert.equal(facts,3,"FORMAL_V5_A0_BOOTSTRAP_EXACT_THREE_PROMOTED_FACTS_REQUIRED");

  const tables=(await pool.query<{table_name:string}>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name<>'facts' ORDER BY table_name"
  )).rows.map((row)=>row.table_name);
  for(const table of tables){
    const q='"'+table.replaceAll('"','""')+'"';
    const count=Number((await pool.query<{n:number}>("SELECT count(*)::int AS n FROM public."+q)).rows[0]?.n??-1);
    assert.equal(count,0,"FORMAL_V5_A0_BOOTSTRAP_PREBOOTSTRAP_ZERO_REQUIRED:"+table);
  }
  return {
    database_now:new Date(identity.database_now).toISOString(),
    current_user:identity.current_user,
  };
}
async function footprint(pool:Pool):Promise<Record<string,number>>{
  const names=[
    "facts",
    "twin_runtime_lease_v1",
    "twin_runtime_checkpoint_latest_index_v1",
    "twin_state_latest_index_v1",
    "twin_shadow_online_scheduler_slot_v1",
    "twin_runtime_authority_snapshot_v1",
  ];
  const result:Record<string,number>={};
  for(const name of names){
    const q='"'+name.replaceAll('"','""')+'"';
    result[name]=Number((await pool.query<{n:number}>("SELECT count(*)::int AS n FROM public."+q)).rows[0]?.n??-1);
  }
  return result;
}
function selftest():void{
  const a0="2099-09-01T03:00:00.000Z";
  const o00="2099-09-01T04:00:00.000Z";
  assert.equal(Date.parse(o00)-Date.parse(a0),HOUR);
  assert.ok(Date.parse(a0)+LEASE_SECONDS*1000<Date.parse(o00));
  assert.equal(A0_TYPES.length,3);
  console.log(JSON.stringify({
    schema_version:"geox_mcft_cap09_formal_v5_a0_bootstrap_selftest_v1",
    status:"PASS",
    local_operator_only:true,
    exact_three_promoted_facts_required:true,
    exact_24_hourly_runtime_configs_required:true,
    exact_a0_member_count:9,
    lease_duration_seconds:LEASE_SECONDS,
    lease_expiry_must_be_lte_o00:true,
    scheduler_slot_write_count:0,
    provider_request_count:0,
    formal_o00_started:false,
    production_effect:false,
  },null,2));
}

async function main():Promise<void>{
  if(has("--selftest")){selftest();return;}
  if(process.env.GITHUB_ACTIONS||process.env.CI)throw new Error("FORMAL_V5_A0_BOOTSTRAP_LOCAL_NON_GITHUB_HOST_ONLY");
  if(!has("--operator-authorized"))throw new Error("FORMAL_V5_A0_BOOTSTRAP_OPERATOR_AUTHORIZATION_REQUIRED");

  git("fetch","--no-tags","origin","main");
  const currentHead=git("rev-parse","HEAD");
  const originMain=git("rev-parse","origin/main");
  assert.equal(currentHead,originMain,"FORMAL_V5_A0_BOOTSTRAP_HEAD_MUST_EQUAL_CURRENT_MAIN");
  assert.equal(git("status","--porcelain"),"","FORMAL_V5_A0_BOOTSTRAP_WORKTREE_MUST_BE_CLEAN");

  const armPath=path.resolve(arg("--arm")||DEFAULT_ARM);
  const schemaPath=path.resolve(arg("--schema-proof")||DEFAULT_SCHEMA);
  const promotionPath=path.resolve(arg("--promotion-proof")||DEFAULT_PROMOTION);
  const continuityPath=path.resolve(arg("--continuity-proof")||DEFAULT_CONTINUITY);
  const manifestPath=path.resolve(arg("--manifest-out")||DEFAULT_MANIFEST);
  const outputPath=path.resolve(arg("--out")||DEFAULT_OUT);
  for(const [file,code] of [
    [armPath,"FORMAL_V5_A0_BOOTSTRAP_ARM_REQUIRED"],
    [schemaPath,"FORMAL_V5_A0_BOOTSTRAP_SCHEMA_PROOF_REQUIRED"],
    [promotionPath,"FORMAL_V5_A0_BOOTSTRAP_PROMOTION_PROOF_REQUIRED"],
  ] as const){
    if(!fs.existsSync(file))throw new Error(code);
  }

  const armRaw=readJson(armPath);
  validateMcftCap09FormalV5ArmV1(armRaw);
  const arm=armRaw as McftCap09FormalV5ArmV1;
  const schema=readJson(schemaPath);
  const promotion=readJson(promotionPath);
  validatePromotion(promotion,arm);

  assert.equal(schema.schema_version,"geox_mcft_cap09_formal_v5_schema_acl_materialization_v1","FORMAL_V5_A0_BOOTSTRAP_SCHEMA_PROOF_SCHEMA_REQUIRED");
  assert.ok(["PASS","PASS_ALREADY_MATERIALIZED_IDEMPOTENT"].includes(schema.status),"FORMAL_V5_A0_BOOTSTRAP_SCHEMA_PROOF_PASS_REQUIRED");
  assert.equal(schema.subject_sha,arm.subject_sha,"FORMAL_V5_A0_BOOTSTRAP_SCHEMA_PROOF_SUBJECT_MISMATCH");
  assert.equal(schema.database_name,MCFT_CAP09_FORMAL_V5_DATABASE_V1,"FORMAL_V5_A0_BOOTSTRAP_SCHEMA_PROOF_DATABASE_MISMATCH");
  assert.equal(schema.public_table_count,EXPECTED_TABLE_COUNT,"FORMAL_V5_A0_BOOTSTRAP_SCHEMA_PROOF_TABLE_COUNT");
  assert.equal(schema.public_routine_count,EXPECTED_ROUTINE_COUNT,"FORMAL_V5_A0_BOOTSTRAP_SCHEMA_PROOF_ROUTINE_COUNT");
  assert.equal(schema.a0_bootstrap,false,"FORMAL_V5_A0_BOOTSTRAP_SCHEMA_PROOF_PREMATURE_A0");
  assert.equal(schema.o00_started,false,"FORMAL_V5_A0_BOOTSTRAP_SCHEMA_PROOF_PREMATURE_O00");

  const a0=exactHour(arm.a0,"FORMAL_V5_A0_BOOTSTRAP_ARM_A0_INVALID");
  const o00=exactHour(arm.o00,"FORMAL_V5_A0_BOOTSTRAP_ARM_O00_INVALID");
  assert.equal(Date.parse(o00)-Date.parse(a0),HOUR,"FORMAL_V5_A0_BOOTSTRAP_A0_O00_OFFSET_REQUIRED");

  execFileSync(process.execPath,[
    path.join(ROOT,CONTINUITY_VERIFIER),
    "--arm-subject="+arm.subject_sha,
    "--logical-time="+a0,
    "--out="+continuityPath,
  ],{cwd:ROOT,stdio:"inherit",env:process.env});
  const continuity=readJson(continuityPath);
  assert.equal(continuity.schema_version,"geox_mcft_cap09_formal_v5_post_arm_authority_continuity_v1","FORMAL_V5_A0_BOOTSTRAP_CONTINUITY_SCHEMA_REQUIRED");
  assert.equal(continuity.status,"PASS","FORMAL_V5_A0_BOOTSTRAP_CONTINUITY_PASS_REQUIRED");
  assert.equal(continuity.arm_runtime_semantic_subject_sha,arm.subject_sha,"FORMAL_V5_A0_BOOTSTRAP_CONTINUITY_ARM_SUBJECT_MISMATCH");
  assert.equal(continuity.authority_continuity_head_sha,currentHead,"FORMAL_V5_A0_BOOTSTRAP_CONTINUITY_HEAD_MISMATCH");
  assert.equal(continuity.selected_logical_time,a0,"FORMAL_V5_A0_BOOTSTRAP_CONTINUITY_LOGICAL_TIME_MISMATCH");
  assert.equal(continuity.runtime_code_change_count,0,"FORMAL_V5_A0_BOOTSTRAP_RUNTIME_CODE_DRIFT");
  assert.equal(continuity.qcp_change_count,0,"FORMAL_V5_A0_BOOTSTRAP_QCP_DRIFT");
  assert.equal(continuity.workflow_change_count,0,"FORMAL_V5_A0_BOOTSTRAP_WORKFLOW_DRIFT");

  const currentCropRef=String(continuity.selected_current_crop_authority_ref||"");
  const currentCropSha=String(continuity.selected_current_crop_authority_sha256||"");
  if(!currentCropRef.startsWith("docs/digital_twin/mcft/cap_09/"))throw new Error("FORMAL_V5_A0_BOOTSTRAP_CURRENT_CROP_REF_INVALID");
  if(!/^sha256:[0-9a-f]{64}$/.test(currentCropSha))throw new Error("FORMAL_V5_A0_BOOTSTRAP_CURRENT_CROP_SHA_INVALID");
  const currentCropPath=path.join(ROOT,currentCropRef);
  assert.equal(sha256File(currentCropPath),currentCropSha,"FORMAL_V5_A0_BOOTSTRAP_CURRENT_CROP_DIGEST_MISMATCH");

  const currentCrop=readRepoJson(currentCropRef);
  const cropAuthority=readRepoJson(CROP_AUTHORITY_PATH);
  const matrix=readRepoJson(MATRIX_PATH);
  const stageArchitecture=readRepoJson(STAGE_ARCHITECTURE_PATH);
  const built=buildMcftCap09FormalV5ManifestFromStageAuthorityV1({
    arm,
    crop_authority:cropAuthority,
    configuration_matrix:matrix,
    current_crop_authority:currentCrop,
    biological_stage_architecture_effectiveness:stageArchitecture,
    expected_subject_sha:arm.subject_sha,
  });

  assert.equal(built.manifest.database_name,MCFT_CAP09_FORMAL_V5_DATABASE_V1,"FORMAL_V5_A0_BOOTSTRAP_MANIFEST_DATABASE_MISMATCH");
  assert.equal(built.manifest.manifest_ref,arm.manifest_ref,"FORMAL_V5_A0_BOOTSTRAP_MANIFEST_REF_MISMATCH");
  assert.equal(built.bundle.persistence_bundle.runtime_configs.length,24,"FORMAL_V5_A0_BOOTSTRAP_EXACT_24_CONFIGS_REQUIRED");
  assert.equal(built.bundle.o00_logical_time,o00,"FORMAL_V5_A0_BOOTSTRAP_BUNDLE_O00_MISMATCH");
  assert.equal(built.bundle.persistence_bundle.bootstrap_logical_time,a0,"FORMAL_V5_A0_BOOTSTRAP_BUNDLE_A0_MISMATCH");

  // Manifest is a deterministic input artifact, not activation authority by itself.
  // Future Twin cutover MUST also require this executor's PASS result.
  writeImmutableOrMatch(
    manifestPath,
    built.manifest,
    (existing)=>String(existing?.manifest_hash||""),
    String(built.manifest.manifest_hash),
  );

  const databaseUrl=requiredEnv("GEOX_MCFT_CAP09_FORMAL_V5_ADMIN_DATABASE_URL");
  const pool=new Pool({
    connectionString:databaseUrl,
    max:2,
    application_name:"mcft-cap09-h6-formal-v5-a0-bootstrap",
  });
  let mutationStarted=false;
  try{
    const pre=await prebootstrapState(pool,databaseUrl);
    const databaseNow=exactIso(pre.database_now,"FORMAL_V5_A0_BOOTSTRAP_DATABASE_NOW_INVALID");
    if(Date.parse(databaseNow)<Date.parse(a0)){
      throw new Error("FORMAL_V5_A0_BOOTSTRAP_BEFORE_A0_FORBIDDEN:"+databaseNow+":"+a0);
    }
    if(Date.parse(databaseNow)+LEASE_SECONDS*1000>Date.parse(o00)){
      throw new Error("FORMAL_V5_A0_BOOTSTRAP_TOO_LATE_FOR_LEASE_EXPIRY:"+databaseNow+":"+o00);
    }

    const runtimeRepo=new PostgresRuntimeRepositoryV1(pool);
    const nextRepo=new PostgresNextTickRepositoryV1(pool);
    const service=new ExternalFormalBootstrapPersistenceServiceV1({
      runtime_config_repository:runtimeRepo,
      bootstrap_persistence:runtimeRepo,
      authority_snapshot_repository:nextRepo,
      evidence_source:new FrozenFormalV5A0EvidenceSource(pool,a0),
    });
    const leaseOwner="mcft-cap09-formal-v5-a0-bootstrap-"+process.pid;

    mutationStarted=true;
    const result=await service.execute({
      bundle:built.bundle.persistence_bundle,
      created_at:a0,
      lease_owner:leaseOwner,
      lease_duration_seconds:LEASE_SECONDS,
    });
    assert.equal(result.a0_member_count,9,"FORMAL_V5_A0_BOOTSTRAP_A0_MEMBER_COUNT_DRIFT");
    assert.equal(result.hourly_runtime_config_count,24,"FORMAL_V5_A0_BOOTSTRAP_HOURLY_CONFIG_COUNT_DRIFT");
    assert.equal(result.provider_request_count,0,"FORMAL_V5_A0_BOOTSTRAP_PROVIDER_REQUEST_FORBIDDEN");
    assert.equal(result.scheduler_slot_write_count,0,"FORMAL_V5_A0_BOOTSTRAP_SCHEDULER_SLOT_WRITE_FORBIDDEN");
    assert.equal(result.formal_window_started,false,"FORMAL_V5_A0_BOOTSTRAP_FORMAL_WINDOW_PREMATURE");

    const snapshot=await nextRepo.readPersistedNextTickSnapshot({...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1});
    if(!snapshot)throw new Error("FORMAL_V5_A0_BOOTSTRAP_NEXT_TICK_SNAPSHOT_REQUIRED");
    assert.equal(snapshot.checkpoint.logical_time,a0,"FORMAL_V5_A0_BOOTSTRAP_CHECKPOINT_TIME_DRIFT");
    assert.equal(snapshot.checkpoint.payload.next_tick_logical_time,o00,"FORMAL_V5_A0_BOOTSTRAP_NEXT_TICK_MUST_EQUAL_O00");
    assert.equal(snapshot.previous_posterior.logical_time,a0,"FORMAL_V5_A0_BOOTSTRAP_PREVIOUS_POSTERIOR_MUST_EQUAL_A0");
    assert.equal(
      snapshot.runtime_config.object_id,
      built.bundle.persistence_bundle.bootstrap_runtime_config.object_id,
      "FORMAL_V5_A0_BOOTSTRAP_RUNTIME_CONFIG_DRIFT",
    );

    const slotCount=Number((await pool.query<{n:number}>(
      "SELECT count(*)::int AS n FROM public.twin_shadow_online_scheduler_slot_v1"
    )).rows[0]?.n??-1);
    assert.equal(slotCount,0,"FORMAL_V5_A0_BOOTSTRAP_SCHEDULER_SLOT_FORBIDDEN");

    const s=MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1;
    const lease=(await pool.query<{
      lease_owner:string;fencing_token:string|number|bigint;acquired_at:Date;expires_at:Date;heartbeat_at:Date;
    }>(
      `SELECT lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at
         FROM public.twin_runtime_lease_v1
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      [s.tenant_id,s.project_id,s.group_id,s.field_id,s.season_id,s.zone_id],
    )).rows[0];
    if(!lease)throw new Error("FORMAL_V5_A0_BOOTSTRAP_LEASE_REQUIRED");
    assert.equal(lease.lease_owner,leaseOwner,"FORMAL_V5_A0_BOOTSTRAP_LEASE_OWNER_DRIFT");
    assert.equal(BigInt(lease.fencing_token),1n,"FORMAL_V5_A0_BOOTSTRAP_FIRST_FENCE_REQUIRED");
    const leaseExpiresAt=new Date(lease.expires_at).toISOString();
    if(Date.parse(leaseExpiresAt)>Date.parse(o00))throw new Error("FORMAL_V5_A0_BOOTSTRAP_LEASE_EXPIRES_AFTER_O00");

    const proof={
      schema_version:"geox_mcft_cap09_formal_v5_a0_bootstrap_result_v1",
      status:"PASS",
      arm_runtime_semantic_subject_sha:arm.subject_sha,
      authority_continuity_head_sha:currentHead,
      arm_identity_hash:arm.arm_identity_hash,
      epoch_id:arm.epoch_id,
      manifest_ref:built.manifest.manifest_ref,
      manifest_hash:built.manifest.manifest_hash,
      manifest_path:manifestPath,
      manifest_file_is_not_activation_authority_by_itself:true,
      formal_database_name:MCFT_CAP09_FORMAL_V5_DATABASE_V1,
      current_crop_authority_ref:currentCropRef,
      current_crop_authority_sha256:currentCropSha,
      current_crop_graduated_at:built.current_crop_graduated_at,
      a0,
      o00,
      o23:arm.o23,
      promotion_result_sha256:sha256File(promotionPath),
      a0_member_count:result.a0_member_count,
      hourly_runtime_config_count:result.hourly_runtime_config_count,
      scheduler_slot_count:slotCount,
      checkpoint_logical_time:snapshot.checkpoint.logical_time,
      next_tick_logical_time:snapshot.checkpoint.payload.next_tick_logical_time,
      previous_posterior_logical_time:snapshot.previous_posterior.logical_time,
      lease_owner:leaseOwner,
      lease_fencing_token:String(lease.fencing_token),
      lease_acquired_at:new Date(lease.acquired_at).toISOString(),
      lease_expires_at:leaseExpiresAt,
      lease_expiry_lte_o00:true,
      bootstrap_database_now:databaseNow,
      operator_database_principal:pre.current_user,
      provider_request_count:0,
      scheduler_slot_write_count:0,
      formal_v5_arm:true,
      formal_a0_bootstrapped:true,
      formal_o00_started:false,
      final_actual_24h_still_required:true,
      store_reuse_authorized_after_success:true,
      human_override_used:false,
      mcft_cap09_completed:false,
    };
    writeImmutableOrMatch(
      outputPath,
      proof,
      (existing)=>String(existing?.manifest_hash||""),
      String(built.manifest.manifest_hash),
    );
    console.log(JSON.stringify(proof,null,2));
  }catch(error){
    if(mutationStarted){
      let observed:Record<string,number>|null=null;
      try{observed=await footprint(pool);}catch{}
      const failure={
        schema_version:"geox_mcft_cap09_formal_v5_a0_bootstrap_result_v1",
        status:"FAIL",
        arm_runtime_semantic_subject_sha:arm.subject_sha,
        authority_continuity_head_sha:currentHead,
        arm_identity_hash:arm.arm_identity_hash,
        epoch_id:arm.epoch_id,
        formal_database_name:MCFT_CAP09_FORMAL_V5_DATABASE_V1,
        manifest_ref:built.manifest.manifest_ref,
        manifest_hash:built.manifest.manifest_hash,
        failure_class:"FORMAL_V5_STORE_BOOTSTRAP_PARTIAL_MUTATION_NON_REUSABLE",
        footprint:observed,
        store_reuse_authorized:false,
        truncate_and_retry_authorized:false,
        formal_epoch_no_go:true,
        formal_o00_started:false,
        mcft_cap09_completed:false,
        error:error instanceof Error?error.message:String(error),
      };
      writeJson(outputPath,failure);
    }
    throw error;
  }finally{
    await pool.end();
  }
}

main().catch((error)=>{
  console.error(error instanceof Error?error.stack??error.message:String(error));
  process.exitCode=1;
});
