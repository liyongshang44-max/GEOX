import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  semanticHashV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  collectRetainDecodeCanonicalizeExternalEvidenceV1,
  type CanonicalizedExternalEvidenceResultV1,
  type VerifiedRawEvidenceProvenanceV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  GfsRawBundleEvidenceDecoderV1,
  MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_ID_V1,
  MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_VERSION_V1,
} from "../../apps/server/src/external_evidence/provider/gfs_raw_bundle_evidence_decoder_v1.js";
import {
  KbsVariate25SoilEvidenceDecoderV1,
  MCFT_CAP09_KBS_SOIL_DATASET_ID_V1,
  MCFT_CAP09_KBS_SOIL_DECODER_ID_V1,
  MCFT_CAP09_KBS_SOIL_DECODER_VERSION_V1,
} from "../../apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.js";
import {
  S3CompatiblePrivateRetainedRawReaderV1,
} from "../../apps/server/src/external_evidence/s3_compatible_private_retained_raw_reader_v1.js";
import {
  buildVerifiedRetainedRawReplayRequestV1,
  VerifiedRetainedRawReadbackTransportV1,
} from "../../apps/server/src/external_evidence/verified_retained_raw_replay_v1.js";
import {
  createFormalDurableRawEvidenceRetentionAdapterV1,
  MCFT_CAP09_FORMAL_RAW_BUCKET_V1,
} from "../../apps/server/src/external_evidence/formal_durable_raw_store_binding_v1.js";
import {
  MCFT_CAP09_GFS_PRODUCTION_DATASET_ID_V1,
} from "../../apps/server/src/external_evidence/mcft_cap09_gfs_partial_pair_rehydration_v1.js";
import {
  PostgresExternalEvidenceFactReplayProvenanceV1,
  type ExternalEvidenceFactReplayProvenanceV1,
} from "../../apps/server/src/persistence/external_evidence/postgres_external_evidence_fact_replay_provenance_v1.js";
import {
  PostgresGfsCanonicalTargetPairHistoryV1,
} from "../../apps/server/src/persistence/external_evidence/postgres_gfs_target_pair_history_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_FACT_SOURCE_V1,
  PostgresExternalFormalEvidenceIngressV1,
  prepareExternalFormalEvidenceIngressV1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_external_formal_evidence_ingress_v1.js";
import {
  buildFrozenEvidenceWindowV1,
} from "../../apps/server/src/runtime/twin_runtime/evidence_window_builder_v1.js";
import type {
  CanonicalReplayEvidenceRecordV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT=process.cwd();
const TARGET_DB="geox_mcft_cap09_s6_formal_t4r1_24h_v5";
const OPERATIONAL_DB="geox_mcft_cap09_production_runtime_v1";
const EVIDENCE_BUCKET="geox-mcft-cap09-evidence-runtime-v1";
const EXPECTED_TYPES=[
  "future_et0_assumption_v1",
  "future_weather_assumption_v1",
  "soil_moisture_observation_v1",
] as const;
const DEFAULT_ARM=path.join(os.homedir(),".geox","mcft-cap09","formal-v5","arm-v1.json");
const DEFAULT_SCHEMA=path.join(os.homedir(),".geox","mcft-cap09","formal-v5","schema-acl-v1.json");
const DEFAULT_OUT=path.join(os.homedir(),".geox","mcft-cap09","formal-v5","a0-production-replay-promotion-v1.json");

type SourceFactV1={
  fact_id:string;
  record:CanonicalReplayEvidenceRecordV1;
  semantic_hash:string;
};

function arg(name:string):string|null{
  const row=process.argv.slice(2).find((value)=>value.startsWith(name+"="));
  return row?row.slice(name.length+1):null;
}
function requiredEnv(name:string):string{
  const value=String(process.env[name]??"").trim();
  if(!value)throw new Error("FORMAL_V5_A0_REPLAY_ENV_REQUIRED:"+name);
  return value;
}
function readJson(file:string):any{
  return JSON.parse(fs.readFileSync(file,"utf8"));
}
function exactIso(value:unknown,code:string):string{
  const text=typeof value==="string"?value.trim():"";
  const t=Date.parse(text);
  if(!text||!Number.isFinite(t)||new Date(t).toISOString()!==text)throw new Error(code);
  return text;
}
function exactHour(value:unknown,code:string):string{
  const text=exactIso(value,code);
  if(!text.endsWith(":00:00.000Z"))throw new Error(code);
  return text;
}
function exactScope(record:CanonicalReplayEvidenceRecordV1):void{
  for(const key of ["tenant_id","project_id","group_id","field_id","season_id","zone_id"] as const){
    assert.equal(record[key],MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1[key],"FORMAL_V5_A0_REPLAY_SCOPE_MISMATCH:"+key);
  }
}
function parseRecordJson(value:unknown):CanonicalReplayEvidenceRecordV1{
  const envelope=typeof value==="string"?JSON.parse(value):value;
  if(!envelope||typeof envelope!=="object"||Array.isArray(envelope))throw new Error("FORMAL_V5_A0_REPLAY_FACT_ENVELOPE_INVALID");
  const e=envelope as Record<string,unknown>;
  if(typeof e.type!=="string")throw new Error("FORMAL_V5_A0_REPLAY_FACT_TYPE_REQUIRED");
  const payload=e.payload;
  if(!payload||typeof payload!=="object"||Array.isArray(payload))throw new Error("FORMAL_V5_A0_REPLAY_FACT_PAYLOAD_REQUIRED");
  const record=payload as CanonicalReplayEvidenceRecordV1;
  if(record.record_type!==e.type)throw new Error("FORMAL_V5_A0_REPLAY_RECORD_TYPE_ENVELOPE_MISMATCH");
  exactScope(record);
  return record;
}
function normalizedSemanticProjection(record:CanonicalReplayEvidenceRecordV1):Record<string,unknown>{
  const sourcePayload=structuredClone(record.source_payload as Record<string,unknown>);
  delete (sourcePayload as any).raw_provenance;
  const quality=structuredClone(record.quality as Record<string,unknown>);
  delete (quality as any).raw_retention_ref;
  return {
    dataset_id:record.dataset_id,
    source_record_id:record.source_record_id,
    record_type:record.record_type,
    binding_id:record.binding_id,
    origin_source_kind:record.origin_source_kind,
    origin_source_id:record.origin_source_id,
    epistemic_class:record.epistemic_class,
    available_to_runtime_at:record.available_to_runtime_at,
    role_time:record.role_time,
    quality,
    source_payload:sourcePayload,
    canonical_payload:record.canonical_payload,
    source_unit:record.source_unit,
    canonical_unit:record.canonical_unit,
    conversion_rule:record.conversion_rule,
    execution_metadata:record.execution_metadata,
  };
}
function dbNameFromUrl(urlText:string,code:string):string{
  let url:URL;
  try{url=new URL(urlText);}catch{throw new Error(code);}
  if(!["postgres:","postgresql:"].includes(url.protocol))throw new Error(code);
  const name=decodeURIComponent(url.pathname.replace(/^\//,""));
  if(!name)throw new Error(code);
  return name;
}
async function loadFact(pool:Pool,factId:string):Promise<SourceFactV1>{
  const rows=(await pool.query<{source:string;record_json:unknown}>(
    "SELECT source,record_json FROM public.facts WHERE fact_id=$1 LIMIT 2",
    [factId],
  )).rows;
  assert.equal(rows.length,1,"FORMAL_V5_A0_REPLAY_EXACT_ONE_SOURCE_FACT_REQUIRED:"+factId);
  assert.equal(rows[0]!.source,MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_FACT_SOURCE_V1,"FORMAL_V5_A0_REPLAY_SOURCE_FACT_AUTHORITY_MISMATCH");
  const record=parseRecordJson(rows[0]!.record_json);
  return {fact_id:factId,record,semantic_hash:semanticHashV1(record)};
}
async function loadSoilCandidates(pool:Pool):Promise<Array<SourceFactV1>>{
  const s=MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1;
  const rows=(await pool.query<{fact_id:string;source:string;record_json:unknown}>(
    `SELECT fact_id,source,record_json
       FROM public.facts
      WHERE source=$1
        AND record_json->>'type'='soil_moisture_observation_v1'
        AND record_json#>>'{payload,tenant_id}'=$2
        AND record_json#>>'{payload,project_id}'=$3
        AND record_json#>>'{payload,group_id}'=$4
        AND record_json#>>'{payload,field_id}'=$5
        AND record_json#>>'{payload,season_id}'=$6
        AND record_json#>>'{payload,zone_id}'=$7
      ORDER BY occurred_at ASC,fact_id ASC`,
    [
      MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_FACT_SOURCE_V1,
      s.tenant_id,s.project_id,s.group_id,s.field_id,s.season_id,s.zone_id,
    ],
  )).rows;
  return rows.map((row)=>{
    assert.equal(row.source,MCFT_CAP09_EXTERNAL_FORMAL_EVIDENCE_FACT_SOURCE_V1);
    const record=parseRecordJson(row.record_json);
    return {fact_id:row.fact_id,record,semantic_hash:semanticHashV1(record)};
  });
}
function assertCausalAtA0(fact:SourceFactV1,a0:string):void{
  const available=exactIso(fact.record.available_to_runtime_at,"FORMAL_V5_A0_REPLAY_SOURCE_AVAILABLE_INVALID");
  const ingested=exactIso(fact.record.role_time?.ingested_at,"FORMAL_V5_A0_REPLAY_SOURCE_INGESTED_INVALID");
  if(Date.parse(available)>Date.parse(a0))throw new Error("FORMAL_V5_A0_REPLAY_SOURCE_AVAILABLE_AFTER_A0:"+fact.record.record_type);
  if(Date.parse(ingested)>Date.parse(a0))throw new Error("FORMAL_V5_A0_REPLAY_SOURCE_INGESTED_AFTER_A0:"+fact.record.record_type);
}
async function replayProof(
  reader:PostgresExternalEvidenceFactReplayProvenanceV1,
  fact:SourceFactV1,
):Promise<ExternalEvidenceFactReplayProvenanceV1>{
  return reader.readReplayProvenance({
    scope:{...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1},
    fact_id:fact.fact_id,
    record_semantic_sha256:fact.semantic_hash,
    record_type:fact.record.record_type,
    binding_id:fact.record.binding_id,
    origin_source_id:fact.record.origin_source_id,
    source_record_id:fact.record.source_record_id,
  });
}
function sameRaw(left:ExternalEvidenceFactReplayProvenanceV1,right:ExternalEvidenceFactReplayProvenanceV1):void{
  const fields=[
    "dataset_id","restored_ingested_at",
  ] as const;
  for(const field of fields)assert.equal(left[field],right[field],"FORMAL_V5_A0_REPLAY_GFS_"+field.toUpperCase()+"_MISMATCH");
  assert.equal(left.decoder.decoder_id,right.decoder.decoder_id,"FORMAL_V5_A0_REPLAY_GFS_DECODER_ID_MISMATCH");
  assert.equal(left.decoder.decoder_version,right.decoder.decoder_version,"FORMAL_V5_A0_REPLAY_GFS_DECODER_VERSION_MISMATCH");
  for(const field of [
    "provider_id","source_family","source_locator","final_locator","content_type",
    "source_issue_time","source_event_time","retrieved_at","available_at",
    "raw_sha256","raw_bytes","retention_ref","retained_at","use_policy_ref",
  ] as const){
    assert.equal(left.raw_provenance[field],right.raw_provenance[field],"FORMAL_V5_A0_REPLAY_GFS_RAW_"+field.toUpperCase()+"_MISMATCH");
  }
}
function assertProductionRaw(raw:VerifiedRawEvidenceProvenanceV1):void{
  let ref:URL;
  try{ref=new URL(raw.retention_ref);}catch{throw new Error("FORMAL_V5_A0_REPLAY_PRODUCTION_RAW_REF_INVALID");}
  assert.equal(ref.protocol,"s3-private:","FORMAL_V5_A0_REPLAY_PRODUCTION_RAW_PRIVATE_REQUIRED");
  assert.equal(ref.hostname,EVIDENCE_BUCKET,"FORMAL_V5_A0_REPLAY_PRODUCTION_RAW_BUCKET_REQUIRED");
  assert.ok(ref.pathname.replace(/^\/+/, "").startsWith("mcft-cap09-formal-raw-v1/sha256/"),"FORMAL_V5_A0_REPLAY_PRODUCTION_RAW_CONTENT_ADDRESS_REQUIRED");
}
function assertFormalResult(result:CanonicalizedExternalEvidenceResultV1):void{
  const ref=new URL(result.raw_provenance.retention_ref);
  assert.equal(ref.protocol,"s3-private:");
  assert.equal(ref.hostname,MCFT_CAP09_FORMAL_RAW_BUCKET_V1,"FORMAL_V5_A0_REPLAY_FORMAL_RAW_BUCKET_REQUIRED");
  assert.ok(ref.pathname.replace(/^\/+/, "").startsWith("mcft-cap09-formal-raw-v1/sha256/"),"FORMAL_V5_A0_REPLAY_FORMAL_RAW_CONTENT_ADDRESS_REQUIRED");
}
function compareNormalized(source:SourceFactV1,result:CanonicalizedExternalEvidenceResultV1):void{
  assert.equal(
    semanticHashV1(normalizedSemanticProjection(result.record)),
    semanticHashV1(normalizedSemanticProjection(source.record)),
    "FORMAL_V5_A0_REPLAY_NORMALIZED_SEMANTIC_DRIFT:"+source.record.record_type,
  );
  assert.equal(result.raw_provenance.raw_sha256,(source.record.source_payload as any)?.raw_provenance?.raw_sha256,"FORMAL_V5_A0_REPLAY_RAW_DIGEST_DRIFT");
  assert.equal(result.decoder.decoder_id,(source.record.source_payload as any)?.raw_provenance?.decoder_id,"FORMAL_V5_A0_REPLAY_DECODER_ID_DRIFT");
  assert.equal(result.decoder.decoder_version,(source.record.source_payload as any)?.raw_provenance?.decoder_version,"FORMAL_V5_A0_REPLAY_DECODER_VERSION_DRIFT");
}
async function assertFormalSchemaState(pool:Pool):Promise<void>{
  const db=String((await pool.query<{name:string}>("SELECT current_database()::text AS name")).rows[0]?.name??"");
  assert.equal(db,TARGET_DB,"FORMAL_V5_A0_REPLAY_FORMAL_DB_IDENTITY_MISMATCH");
  const tableCount=Number((await pool.query<{n:number}>(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
  )).rows[0]?.n??-1);
  const routineCount=Number((await pool.query<{n:number}>(
    "SELECT count(*)::int AS n FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'"
  )).rows[0]?.n??-1);
  assert.equal(tableCount,29,"FORMAL_V5_A0_REPLAY_EXACT_29_TABLES_REQUIRED");
  assert.equal(routineCount,2,"FORMAL_V5_A0_REPLAY_EXACT_2_ROUTINES_REQUIRED");
  const tables=(await pool.query<{table_name:string}>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name<>'facts' ORDER BY table_name"
  )).rows.map((row)=>row.table_name);
  for(const table of tables){
    const q='"'+table.replaceAll('"','""')+'"';
    const count=Number((await pool.query<{n:number}>("SELECT count(*)::int AS n FROM public."+q)).rows[0]?.n??-1);
    assert.equal(count,0,"FORMAL_V5_A0_REPLAY_NON_FACT_TABLE_MUST_REMAIN_ZERO:"+table);
  }
}
async function assertExistingFactsSubset(
  pool:Pool,
  results:readonly CanonicalizedExternalEvidenceResultV1[],
):Promise<void>{
  const expected=new Map(results.map((result)=>{
    const prepared=prepareExternalFormalEvidenceIngressV1(result);
    return [prepared.fact_id,{hash:prepared.requested_semantic_hash,record:result.record}] as const;
  }));
  const rows=(await pool.query<{fact_id:string;record_json:unknown}>(
    "SELECT fact_id,record_json FROM public.facts ORDER BY fact_id"
  )).rows;
  if(rows.length>3)throw new Error("FORMAL_V5_A0_REPLAY_FACT_COUNT_ABOVE_THREE_FORBIDDEN:"+rows.length);
  for(const row of rows){
    const intended=expected.get(row.fact_id);
    if(!intended)throw new Error("FORMAL_V5_A0_REPLAY_UNEXPECTED_EXISTING_FACT:"+row.fact_id);
    const record=parseRecordJson(row.record_json);
    assert.equal(semanticHashV1(record),intended.hash,"FORMAL_V5_A0_REPLAY_EXISTING_FACT_SEMANTIC_CONFLICT:"+row.fact_id);
  }
}
async function formalDatabaseNow(pool:Pool):Promise<string>{
  const row=(await pool.query<{database_now:string|Date}>("SELECT clock_timestamp() AS database_now")).rows[0];
  if(!row)throw new Error("FORMAL_V5_A0_REPLAY_DATABASE_CLOCK_REQUIRED");
  return new Date(row.database_now).toISOString();
}

async function main():Promise<void>{
  if(process.env.GITHUB_ACTIONS||process.env.CI)throw new Error("FORMAL_V5_A0_REPLAY_LOCAL_NON_GITHUB_HOST_ONLY");
  if(!process.argv.includes("--operator-authorized"))throw new Error("FORMAL_V5_A0_REPLAY_OPERATOR_AUTHORIZATION_REQUIRED");

  execFileSync("git",["fetch","--no-tags","origin","main"],{cwd:ROOT,stdio:"ignore"});
  const subject=execFileSync("git",["rev-parse","HEAD"],{cwd:ROOT,encoding:"utf8"}).trim();
  const currentMain=execFileSync("git",["rev-parse","origin/main"],{cwd:ROOT,encoding:"utf8"}).trim();
  assert.equal(subject,currentMain,"FORMAL_V5_A0_REPLAY_HEAD_MUST_EQUAL_CURRENT_MAIN");
  assert.equal(execFileSync("git",["status","--porcelain"],{cwd:ROOT,encoding:"utf8"}).trim(),"","FORMAL_V5_A0_REPLAY_WORKTREE_MUST_BE_CLEAN");

  const armPath=path.resolve(arg("--arm")||DEFAULT_ARM);
  const schemaPath=path.resolve(arg("--schema-proof")||DEFAULT_SCHEMA);
  if(!fs.existsSync(armPath))throw new Error("FORMAL_V5_A0_REPLAY_ARM_REQUIRED");
  if(!fs.existsSync(schemaPath))throw new Error("FORMAL_V5_A0_REPLAY_SCHEMA_PROOF_REQUIRED");
  const arm=readJson(armPath);
  const schema=readJson(schemaPath);
  assert.equal(arm.schema_version,"geox_mcft_cap09_formal_v5_arm_v1");
  assert.equal(arm.status,"PASS");
  assert.equal(arm.subject_sha,subject);
  assert.equal(arm.formal_database_name,TARGET_DB);
  assert.equal(arm.formal_v5_arm,true);
  assert.equal(arm.a0_bootstrap,false);
  assert.equal(arm.o00_started,false);
  assert.equal(schema.schema_version,"geox_mcft_cap09_formal_v5_schema_acl_materialization_v1");
  assert.ok(["PASS","PASS_ALREADY_MATERIALIZED_IDEMPOTENT"].includes(schema.status));
  assert.equal(schema.subject_sha,subject);
  assert.equal(schema.database_name,TARGET_DB);
  assert.equal(schema.public_table_count,29);
  assert.equal(schema.public_routine_count,2);
  assert.equal(schema.a0_bootstrap,false);
  assert.equal(schema.o00_started,false);

  const a0=exactHour(arm.a0,"FORMAL_V5_A0_REPLAY_ARM_A0_INVALID");
  const o00=exactHour(arm.o00,"FORMAL_V5_A0_REPLAY_ARM_O00_INVALID");
  assert.equal(Date.parse(o00)-Date.parse(a0),3_600_000,"FORMAL_V5_A0_REPLAY_A0_O00_OFFSET_REQUIRED");

  const sourceUrl=requiredEnv("GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL");
  const formalUrl=requiredEnv("GEOX_MCFT_CAP09_FORMAL_V5_ADMIN_DATABASE_URL");
  assert.equal(dbNameFromUrl(sourceUrl,"FORMAL_V5_A0_REPLAY_SOURCE_DB_URL_INVALID"),OPERATIONAL_DB,"FORMAL_V5_A0_REPLAY_OPERATIONAL_DB_REQUIRED");
  assert.equal(dbNameFromUrl(formalUrl,"FORMAL_V5_A0_REPLAY_FORMAL_DB_URL_INVALID"),TARGET_DB,"FORMAL_V5_A0_REPLAY_V5_DB_REQUIRED");
  assert.notEqual(sourceUrl,formalUrl,"FORMAL_V5_A0_REPLAY_SOURCE_AND_FORMAL_DB_MUST_DIFFER");

  const evidenceBucket=requiredEnv("GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET");
  assert.equal(evidenceBucket,EVIDENCE_BUCKET,"FORMAL_V5_A0_REPLAY_EVIDENCE_BUCKET_REQUIRED");
  const sourceRawReader=new S3CompatiblePrivateRetainedRawReaderV1({
    endpoint:requiredEnv("GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT"),
    bucket:evidenceBucket,
    region:requiredEnv("GEOX_MCFT_CAP09_EVIDENCE_S3_REGION"),
    access_key_id:requiredEnv("GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID"),
    secret_access_key:requiredEnv("GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY"),
  });
  const formalRaw=createFormalDurableRawEvidenceRetentionAdapterV1(process.env);

  const sourcePool=new Pool({connectionString:sourceUrl,max:1,application_name:"mcft-cap09-h6-v5-a0-source-readonly"});
  const formalPool=new Pool({connectionString:formalUrl,max:2,application_name:"mcft-cap09-h6-v5-a0-promotion"});
  try{
    await sourcePool.query("SET default_transaction_read_only=on");
    const sourceIdentity=(await sourcePool.query<{current_user:string;db:string;read_only:string}>(
      "SELECT current_user::text AS current_user,current_database()::text AS db,current_setting('default_transaction_read_only') AS read_only"
    )).rows[0]!;
    assert.equal(sourceIdentity.db,OPERATIONAL_DB);
    assert.equal(sourceIdentity.current_user,"geox_mcft_cap09_evidence_runtime_login_v1","FORMAL_V5_A0_REPLAY_SOURCE_EVIDENCE_LOGIN_REQUIRED");
    assert.equal(sourceIdentity.read_only,"on","FORMAL_V5_A0_REPLAY_SOURCE_READ_ONLY_REQUIRED");

    await assertFormalSchemaState(formalPool);
    const databaseNow=await formalDatabaseNow(formalPool);
    if(Date.parse(databaseNow)<Date.parse(a0))throw new Error("FORMAL_V5_A0_REPLAY_A0_NOT_REACHED:"+databaseNow+":"+a0);
    if(Date.parse(databaseNow)>=Date.parse(o00))throw new Error("FORMAL_V5_A0_REPLAY_O00_DEADLINE_REACHED:"+databaseNow+":"+o00);

    const history=await new PostgresGfsCanonicalTargetPairHistoryV1(
      sourcePool,{...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1},
    ).readGfsTargetPairHistory({
      scope:{...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1},
      from_target_logical_time:a0,
    });
    if(history.partial_targets.some((row)=>row.target_logical_time===a0)){
      throw new Error("FORMAL_V5_A0_REPLAY_A0_GFS_PARTIAL_PAIR_FORBIDDEN");
    }
    const pair=history.pairs.filter((row)=>row.target_logical_time===a0);
    assert.equal(pair.length,1,"FORMAL_V5_A0_REPLAY_EXACT_ONE_A0_GFS_PAIR_REQUIRED");
    const weather=await loadFact(sourcePool,pair[0]!.weather_fact_id);
    const et0=await loadFact(sourcePool,pair[0]!.future_et0_fact_id);
    assert.equal(weather.record.record_type,"future_weather_assumption_v1");
    assert.equal(et0.record.record_type,"future_et0_assumption_v1");
    assert.equal(exactHour(weather.record.role_time?.valid_from,"FORMAL_V5_A0_REPLAY_WEATHER_VALID_FROM_INVALID"),a0);
    assert.equal(exactHour(et0.record.role_time?.valid_from,"FORMAL_V5_A0_REPLAY_ET0_VALID_FROM_INVALID"),a0);
    assert.equal(exactHour(weather.record.role_time?.issued_at,"FORMAL_V5_A0_REPLAY_WEATHER_ISSUED_INVALID"),pair[0]!.cycle_issued_at);
    assert.equal(exactHour(et0.record.role_time?.issued_at,"FORMAL_V5_A0_REPLAY_ET0_ISSUED_INVALID"),pair[0]!.cycle_issued_at);
    assertCausalAtA0(weather,a0);
    assertCausalAtA0(et0,a0);

    const soils=await loadSoilCandidates(sourcePool);
    const soilWindow=buildFrozenEvidenceWindowV1({
      scope:{...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1},
      logical_time:a0,
      candidate_records:soils.map((row)=>row.record),
      authorized_soil_binding_id:MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    });
    const soilMatches=soils.filter((row)=>
      row.record.source_record_id===soilWindow.assimilation_observation.source_record_id
      && row.record.binding_id===soilWindow.assimilation_observation.binding_id
      && String(row.record.role_time?.observed_at??"")===String(soilWindow.assimilation_observation.role_time?.observed_at??"")
    );
    assert.equal(soilMatches.length,1,"FORMAL_V5_A0_REPLAY_EXACT_ONE_SELECTED_SOIL_FACT_REQUIRED");
    const soil=soilMatches[0]!;
    assert.equal(soil.record.record_type,"soil_moisture_observation_v1");
    assert.equal(soil.record.binding_id,MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1);
    assertCausalAtA0(soil,a0);

    const sourceFacts=[weather,et0,soil];
    assert.deepEqual(
      sourceFacts.map((row)=>row.record.record_type).sort(),
      [...EXPECTED_TYPES],
      "FORMAL_V5_A0_REPLAY_SOURCE_TYPE_SET_REQUIRED",
    );

    const replayReader=new PostgresExternalEvidenceFactReplayProvenanceV1(sourcePool);
    const weatherReplay=await replayProof(replayReader,weather);
    const et0Replay=await replayProof(replayReader,et0);
    const soilReplay=await replayProof(replayReader,soil);
    sameRaw(weatherReplay,et0Replay);
    assert.equal(weatherReplay.dataset_id,MCFT_CAP09_GFS_PRODUCTION_DATASET_ID_V1,"FORMAL_V5_A0_REPLAY_GFS_DATASET_REQUIRED");
    assert.equal(weatherReplay.decoder.decoder_id,MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_ID_V1,"FORMAL_V5_A0_REPLAY_GFS_DECODER_REQUIRED");
    assert.equal(weatherReplay.decoder.decoder_version,MCFT_CAP09_GFS_RAW_BUNDLE_PRODUCT_DECODER_VERSION_V1,"FORMAL_V5_A0_REPLAY_GFS_DECODER_VERSION_REQUIRED");
    assert.equal(soilReplay.dataset_id,MCFT_CAP09_KBS_SOIL_DATASET_ID_V1,"FORMAL_V5_A0_REPLAY_SOIL_DATASET_REQUIRED");
    assert.equal(soilReplay.decoder.decoder_id,MCFT_CAP09_KBS_SOIL_DECODER_ID_V1,"FORMAL_V5_A0_REPLAY_SOIL_DECODER_REQUIRED");
    assert.equal(soilReplay.decoder.decoder_version,MCFT_CAP09_KBS_SOIL_DECODER_VERSION_V1,"FORMAL_V5_A0_REPLAY_SOIL_DECODER_VERSION_REQUIRED");
    assertProductionRaw(weatherReplay.raw_provenance);
    assertProductionRaw(soilReplay.raw_provenance);

    const gfsRead=await sourceRawReader.readRetainedRawEvidence({
      retention_ref:weatherReplay.raw_provenance.retention_ref,
      retained_sha256:weatherReplay.raw_provenance.raw_sha256,
      retained_bytes:weatherReplay.raw_provenance.raw_bytes,
    });
    const soilRead=await sourceRawReader.readRetainedRawEvidence({
      retention_ref:soilReplay.raw_provenance.retention_ref,
      retained_sha256:soilReplay.raw_provenance.raw_sha256,
      retained_bytes:soilReplay.raw_provenance.raw_bytes,
    });
    assert.equal(gfsRead.retained_at,weatherReplay.raw_provenance.retained_at,"FORMAL_V5_A0_REPLAY_GFS_RETAINED_AT_DRIFT");
    assert.equal(soilRead.retained_at,soilReplay.raw_provenance.retained_at,"FORMAL_V5_A0_REPLAY_SOIL_RETAINED_AT_DRIFT");

    const canonicalizedAt=await formalDatabaseNow(formalPool);
    if(Date.parse(canonicalizedAt)>=Date.parse(o00))throw new Error("FORMAL_V5_A0_REPLAY_REPLAY_BUILD_CROSSED_O00");
    const gfsResults=await collectRetainDecodeCanonicalizeExternalEvidenceV1({
      dataset_id:weatherReplay.dataset_id,
      scope:{...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1},
      request:buildVerifiedRetainedRawReplayRequestV1(weatherReplay.raw_provenance,{
        purpose_limitations:["FORMAL_V5_A0_PRODUCTION_REPLAY","PRODUCTION_EVIDENCE_TO_FORMAL_RAW"],
      }),
      canonicalized_at:canonicalizedAt,
    },{
      transport:new VerifiedRetainedRawReadbackTransportV1(weatherReplay.raw_provenance,gfsRead),
      retention:formalRaw.adapter,
      decoder:new GfsRawBundleEvidenceDecoderV1(a0,{
        normalize_et0:true,
        restored_ingested_at:weatherReplay.restored_ingested_at,
      }),
    });
    const soilResults=await collectRetainDecodeCanonicalizeExternalEvidenceV1({
      dataset_id:soilReplay.dataset_id,
      scope:{...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1},
      request:buildVerifiedRetainedRawReplayRequestV1(soilReplay.raw_provenance,{
        purpose_limitations:["FORMAL_V5_A0_PRODUCTION_REPLAY","PRODUCTION_EVIDENCE_TO_FORMAL_RAW"],
      }),
      canonicalized_at:canonicalizedAt,
    },{
      transport:new VerifiedRetainedRawReadbackTransportV1(soilReplay.raw_provenance,soilRead),
      retention:formalRaw.adapter,
      decoder:new KbsVariate25SoilEvidenceDecoderV1(),
    });

    const results=[...gfsResults,...soilResults].sort((a,b)=>a.record.record_type.localeCompare(b.record.record_type));
    assert.equal(results.length,3,"FORMAL_V5_A0_REPLAY_EXACT_THREE_FORMAL_RESULTS_REQUIRED");
    assert.deepEqual(results.map((row)=>row.record.record_type),[...EXPECTED_TYPES],"FORMAL_V5_A0_REPLAY_FORMAL_TYPE_SET_REQUIRED");
    for(const result of results)assertFormalResult(result);
    const sourceByType=new Map(sourceFacts.map((row)=>[row.record.record_type,row] as const));
    for(const result of results){
      const source=sourceByType.get(result.record.record_type);
      if(!source)throw new Error("FORMAL_V5_A0_REPLAY_SOURCE_REFERENCE_MISSING:"+result.record.record_type);
      compareNormalized(source,result);
    }

    await assertExistingFactsSubset(formalPool,results);
    const ingress=new PostgresExternalFormalEvidenceIngressV1(formalPool,formalRaw.adapter);
    let newWrites=0,existingWrites=0;
    const receipts=[];
    for(const result of results){
      const beforeWriteAt=await formalDatabaseNow(formalPool);
      if(Date.parse(beforeWriteAt)>=Date.parse(o00))throw new Error("FORMAL_V5_A0_REPLAY_WRITE_CROSSED_O00");
      const receipt=await ingress.appendCanonicalizedExternalEvidence(result);
      newWrites+=receipt.canonical_fact_write_count;
      if(receipt.status==="EXISTING_IDEMPOTENT_SUCCESS")existingWrites+=1;
      receipts.push(receipt);
    }
    assert.equal(newWrites+existingWrites,3,"FORMAL_V5_A0_REPLAY_EXACT_THREE_PRESENT_REQUIRED");
    await assertFormalSchemaState(formalPool);
    const finalFacts=Number((await formalPool.query<{n:number}>("SELECT count(*)::int AS n FROM public.facts")).rows[0]?.n??-1);
    assert.equal(finalFacts,3,"FORMAL_V5_A0_REPLAY_FORMAL_FACT_COUNT_REQUIRED");
    const completedAt=await formalDatabaseNow(formalPool);
    if(Date.parse(completedAt)>=Date.parse(o00))throw new Error("FORMAL_V5_A0_REPLAY_COMPLETED_AT_OR_AFTER_O00");

    const proof={
      schema_version:"geox_mcft_cap09_formal_v5_a0_production_replay_promotion_v1",
      status:"PASS",
      subject_sha:subject,
      arm_identity_hash:arm.arm_identity_hash,
      epoch_id:arm.epoch_id,
      formal_database_name:TARGET_DB,
      source_operational_database_name:OPERATIONAL_DB,
      a0,o00,
      database_started_at:databaseNow,
      promotion_completed_at:completedAt,
      source_fact_ids:sourceFacts.map((row)=>row.fact_id).sort(),
      source_record_semantic_hashes:sourceFacts.map((row)=>row.semantic_hash).sort(),
      formal_fact_ids:receipts.map((row)=>row.fact_id).sort(),
      formal_fact_count:finalFacts,
      formal_canonical_fact_write_count:newWrites,
      formal_existing_idempotent_fact_count:existingWrites,
      exact_a0_same_cycle_gfs_pair:true,
      a0_gfs_pair_causal_at_a0:true,
      a0_base_supports_o00_warm_start:true,
      soil_selected_by_existing_a0_evidence_window:true,
      source_operational_database_read_only:true,
      production_raw_bucket:EVIDENCE_BUCKET,
      formal_raw_bucket:MCFT_CAP09_FORMAL_RAW_BUCKET_V1,
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
    };
    const out=path.resolve(arg("--out")||DEFAULT_OUT);
    fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,JSON.stringify(proof,null,2)+"\n");
    console.log(JSON.stringify(proof,null,2));
  }finally{
    await sourcePool.end();
    await formalPool.end();
  }
}

main().catch((error)=>{
  console.error(error instanceof Error?error.stack??error.message:String(error));
  process.exitCode=1;
});
