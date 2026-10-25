import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {createRequire} from "node:module";
import { Pool } from "pg";

import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
  type FormalForcingAcquisitionBudgetAdjudicationV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_forcing_acquisition_budget_v1.js";
import type {
  ExternalEvidenceDecoderInputV1,
  ExternalEvidenceDecoderPortV1,
  ExternalEvidenceFetchRequestV1,
  ExternalEvidenceFetchResponseV1,
  ExternalEvidenceTransportPortV1,
  GovernedDecodedEvidenceDraftV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import type { EvidenceRuntimeCycleWorkItemV1 } from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_cycle_service_v1.js";
import {
  ExternalFormalPrivateCandidateCapturePromotionV1,
  type ExternalFormalCandidateRehydrationDecoderFactoryV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_phase7_private_candidate_capture_promotion_v1.js";
import {
  MCFT_CAP09_GFS_BUNDLE_PROVIDER_ID_V1,
  MCFT_CAP09_GFS_BUNDLE_SOURCE_FAMILY_V1,
} from "../../apps/server/src/external_evidence/provider/gfs_nomads_bundle_transport_v1.js";
import { MCFT_CAP09_KBS_SOIL_DATASET_ID_V1 } from "../../apps/server/src/external_evidence/provider/kbs_variate25_soil_provider_v1.js";

import {composeIsolatedMcftCap09V13ProducerCoreV1} from "./MCFT_CAP_09_V13_ISOLATED_PRODUCER_COMPOSITION_V1.js";
import {
  ExternalFormalExactBasePromotionFailureV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_forcing_autonomous_controller_service_v1.js";
import {
  PostgresExternalFormalForcingBaseContinuityRepositoryV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_base_continuity_repository_v1.js";
import {
  PostgresExternalFormalForcingControllerLifecycleV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_controller_lifecycle_v1.js";
import {
  PostgresExternalFormalForcingSupplyAdmissionV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_supply_admission_v1.js";

const ROOT=process.cwd();
const SAMPLE=(process.env.MCFT_CAP09_STAGE3_REAL_TIMING_SAMPLE_ID??"").trim();
const OUTPUT="acceptance-output/MCFT_CAP09_STAGE3_REAL_TIMING_"+SAMPLE.toUpperCase()+"_SAMPLE_V1_RESULT.json";
const SUBJECT=(process.env.CAP09_E2E_SUBJECT_SHA??"").trim();
const TEST_RUN_ID=(process.env.CAP09_NONAUTHORIZED_E2E_RUN_ID??"").trim();
const EPOCH="cap09-stage3-real-timing-"+SAMPLE+"-"+TEST_RUN_ID;
// Never write an execution permit or consume the DA9 signed authority.
const V13_MIGRATIONS=[
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_base_continuity.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_admission.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_lifecycle.sql",
  "apps/server/db/migrations/2026_08_28_mcft_cap_09_v13_evidence_runtime_fenced_promotion_acl.sql",
] as const;

function required(name:string):string{
  const value=process.env[name];
  if(!value?.trim())throw new Error("PHASE7_COMPOSITION_ENV_REQUIRED:"+name);
  return value.trim();
}
function iso(value:number|Date|string):string{return new Date(value).toISOString();}
function addMinutes(value:string,count:number):string{return iso(Date.parse(value)+count*60_000);}
function addHours(value:string,count:number):string{return iso(Date.parse(value)+count*3_600_000);}
function budget():FormalForcingAcquisitionBudgetAdjudicationV1{
  return {
    authority_id:MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
    status:"PASS",
    real_sample_count:3,
    controlled_delay_case_count:6,
    maximum_real_end_to_end_ms:60_000,
    maximum_controlled_end_to_end_ms:90_000,
    measured_envelope_ms:90_000,
    selected_budget_ms:120_000,
    safety_margin_ms:30_000,
    hardcoded_default_budget_minutes:null,
    selection_basis:"MEASURED_ENVELOPE_PLUS_EXPLICIT_MARGIN",
  };
}
async function reset(pool:Pool):Promise<void>{
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query(fs.readFileSync(ROOT+"/docker/postgres/init/001_schema.sql","utf8"));
  for(const path of V13_MIGRATIONS) {
    if(path.endsWith("2026_08_28_mcft_cap_09_v13_evidence_runtime_fenced_promotion_acl.sql")) {
      // This disposable PG instance does not inherit production service roles.
      // Provision only the same NOLOGIN privilege role before the real writer ACL.
      await pool.query("DO $evidence$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='geox_mcft_cap09_evidence_runtime_v1') THEN CREATE ROLE geox_mcft_cap09_evidence_runtime_v1 NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; END IF; END $evidence$");
    }
    await pool.query(fs.readFileSync(ROOT+"/"+path,"utf8"));
  }
}
async function dbFutureHour(pool:Pool):Promise<string>{
  const row=(await pool.query<{value:string|Date}>(
    "SELECT date_trunc('hour',clock_timestamp()) + interval '2 hour' AS value"
  )).rows[0];
  if(!row)throw new Error("PHASE7_COMPOSITION_DB_FUTURE_HOUR_REQUIRED");
  return iso(row.value);
}

class FixtureTransport implements ExternalEvidenceTransportPortV1{
  request_count=0;
  constructor(
    private readonly finalLocator:string,
    private readonly contentType:string,
    private readonly availableAt:string,
    private readonly bytes:Uint8Array,
  ){}
  async fetchRawEvidence(_request:ExternalEvidenceFetchRequestV1):Promise<ExternalEvidenceFetchResponseV1>{
    this.request_count+=1;
    return {
      status:200,
      final_locator:this.finalLocator,
      content_type:this.contentType,
      retrieved_at:this.availableAt,
      available_at:this.availableAt,
      bytes:this.bytes,
    };
  }
}

type FixtureKind="SOIL"|"GFS";
class FixtureDecoder implements ExternalEvidenceDecoderPortV1{
  readonly decoder_id:string;
  readonly decoder_version="1";
  constructor(
    private readonly kind:FixtureKind,
    private readonly base:string,
    private readonly ingestedAt:string,
  ){
    this.decoder_id=kind==="SOIL"
      ?"PHASE7_COMPOSITION_SOIL_FIXTURE_DECODER_V1"
      :"PHASE7_COMPOSITION_GFS_FIXTURE_DECODER_V1";
  }
  async decodeRetainedEvidence(input:ExternalEvidenceDecoderInputV1):Promise<readonly GovernedDecodedEvidenceDraftV1[]>{
    const common={
      available_to_runtime_at:input.provenance.available_at,
      quality:{status:"PASS" as const,qualification_fixture:true,raw_value_publication_authorized:false},
      source_payload:{provider:"PHASE7_COMPOSITION_QUALIFICATION_FIXTURE",raw_values_embedded:false},
      source_unit:"fixture_unit",
      canonical_unit:"fixture_unit",
      conversion_rule:{
        conversion_rule_id:"PHASE7_COMPOSITION_FIXTURE_IDENTITY_V1",
        conversion_rule_version:"1",
        authority_ref:"scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_09_PHASE7_CANDIDATE_PROMOTION_COMPOSITION_V1.ts",
      },
      source_binding_version:1,
      limitations:[
        "CONTROLLED_ENGINEERING_FIXTURE_ONLY",
        "NOT_FORMAL_EXTERNAL_EVIDENCE",
        "NO_PUBLIC_RAW_VALUE_EMISSION",
      ],
    };
    if(this.kind==="SOIL"){
      return [{
        role:"SOIL_MOISTURE_OBSERVATION",
        source_record_id:"phase7-composition-soil-001",
        binding_id:MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
        origin_source_kind:"CONTROLLED_ENGINEERING_FIXTURE",
        origin_source_id:"phase7-composition-soil",
        epistemic_class:"OBSERVED",
        ...common,
        role_time:{observed_at:addHours(this.base,-3),ingested_at:this.ingestedAt},
        canonical_payload:{quantity_kind:"VOLUMETRIC_WATER_CONTENT",value:0.25,unit:"fraction"},
      }];
    }
    return [
      {
        role:"FUTURE_WEATHER_ASSUMPTION",
        source_record_id:"phase7-composition-weather-001",
        binding_id:MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
        origin_source_kind:"CONTROLLED_ENGINEERING_FIXTURE",
        origin_source_id:"phase7-composition-weather",
        epistemic_class:"ASSUMED",
        ...common,
        role_time:{
          issued_at:addHours(this.base,-6),
          ingested_at:this.ingestedAt,
          valid_from:this.base,
          valid_to:addHours(this.base,72),
        },
        canonical_payload:{
          snapshot_kind:"FUTURE_WEATHER_ASSUMPTION",
          points:Array.from({length:72},(_,index)=>({
            horizon:index+1,
            valid_from:addHours(this.base,index),
            valid_to:addHours(this.base,index+1),
            precipitation_mm:0,
          })),
        },
      },
      {
        role:"FUTURE_ET0_ASSUMPTION",
        source_record_id:"phase7-composition-et0-001",
        binding_id:MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
        origin_source_kind:"CONTROLLED_ENGINEERING_FIXTURE",
        origin_source_id:"phase7-composition-et0",
        epistemic_class:"ASSUMED",
        ...common,
        role_time:{
          issued_at:addHours(this.base,-6),
          ingested_at:this.ingestedAt,
          valid_from:this.base,
          valid_to:addHours(this.base,72),
        },
        canonical_payload:{
          snapshot_kind:"FUTURE_ET0_ASSUMPTION",
          points:Array.from({length:72},(_,index)=>({
            horizon:index+1,
            valid_from:addHours(this.base,index),
            valid_to:addHours(this.base,index+1),
            et0_mm_per_hour:0.1,
          })),
        },
      },
    ];
  }
}

async function main():Promise<void>{
  if(process.env.MCFT_CAP09_STAGE3_REAL_TIMING_SAMPLE!=="1"
      || !/^sample[123]$/.test(SAMPLE))throw Error("STAGE3_REAL_TIMING_EXPLICIT_SAMPLE_REQUIRED");
  if (process.env.CAP09_NONAUTHORIZED_E2E_EXCLUSIVE_DESTRUCTIVE_TEST !== "1") {
    throw new Error("CAP09_NONAUTHORIZED_E2E_EXPLICIT_TEST_ONLY_CONSENT_REQUIRED");
  }
  if (process.env.MCFT_GOVERNED_RETRY_STAGE || process.env.MCFT_GOVERNED_RETRY_TICKET
      || process.env.MCFT_CAP09_ADOPTION_REQUEST || process.env.MCFT_CAP09_FORMAL_V5_ARM
      ) {
    throw new Error("CAP09_NONAUTHORIZED_E2E_EXECUTION_OR_CI_CONTEXT_FORBIDDEN");
  }
  if (!/^[a-f0-9]{12}$/.test(TEST_RUN_ID)
      || ["da9db7129607","72dc0304a21a"].includes(TEST_RUN_ID)) {
    throw new Error("CAP09_NONAUTHORIZED_E2E_FRESH_TEST_RUN_REQUIRED");
  }
  if(!/^[0-9a-f]{40}$/.test(SUBJECT))throw new Error("PHASE7_COMPOSITION_EXACT_SUBJECT_REQUIRED");
  const databaseUrl=required("DATABASE_URL");
  const dbUrl=new URL(databaseUrl);
  if (!["127.0.0.1","localhost","[::1]"].includes(dbUrl.hostname)
      || decodeURIComponent(dbUrl.pathname.slice(1)) !== "mcft_cap09_requal_"+TEST_RUN_ID+"_positive"
      || dbUrl.search || dbUrl.hash) {
    throw new Error("CAP09_NONAUTHORIZED_E2E_DEDICATED_TEST_PG_REQUIRED");
  }
  const adminPool=new Pool({connectionString:databaseUrl,max:2});
  const serviceRole="cap09_non_auth_e2e_"+TEST_RUN_ID;
  const servicePassword=required("CAP09_E2E_PG_ROLE_PASSWORD");
  if(servicePassword.length<16)throw new Error("CAP09_E2E_DISPOSABLE_PG_PASSWORD_TOO_SHORT");
  const serviceUrl=new URL(databaseUrl);
  serviceUrl.username=serviceRole;
  serviceUrl.password=servicePassword;
  const pool=new Pool({connectionString:serviceUrl.toString(),max:8});
  try {
    const actualDb = String((await adminPool.query("SELECT current_database() AS db")).rows[0]?.db ?? "");
    if (actualDb !== "mcft_cap09_requal_"+TEST_RUN_ID+"_positive") {
      throw new Error("CAP09_NONAUTHORIZED_E2E_PG_CONNECTION_REBIND_FORBIDDEN");
    }
    await reset(adminPool);
    // All actual controller, candidate, fenced writer and readback operations
    // below run as the restricted Evidence login, never as provisioning admin.
    const quotedPassword=servicePassword.replace(/'/g,"''");
    await adminPool.query(`CREATE ROLE ${serviceRole} LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${quotedPassword}'`);
    await adminPool.query(`GRANT geox_mcft_cap09_evidence_runtime_v1 TO ${serviceRole}`);
    const acl=(await pool.query(`SELECT current_user::text AS role,
      has_table_privilege(current_user,'public.facts','INSERT') AS direct_insert,
      has_function_privilege(current_user,'public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb)','EXECUTE') AS can_execute`)).rows[0];
    if(acl?.role!==serviceRole||acl.direct_insert!==false||acl.can_execute!==true)
      throw new Error("CAP09_E2E_REAL_EVIDENCE_LOGIN_ACL_REQUIRED");
    const launched=Number(required("MCFT_CAP09_STAGE3_TIMING_LAUNCHED_MS"));
    if(!Number.isSafeInteger(launched)||launched<=0||launched>Date.now()||Date.now()-launched>600000)
      throw Error("STAGE3_REAL_TIMING_LAUNCH_CLOCK_INVALID");
    const jobStartSetupMs=Date.now()-launched;
    const base=await dbFutureHour(pool);
    const now=Date.now();
    const availableAt=iso(now-60_000);
    const soilIngested=iso(now-30_000);
    const gfsIngested=iso(now-20_000);

    const continuity=new PostgresExternalFormalForcingBaseContinuityRepositoryV1(pool,{
      scope:{...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1},
      epoch_id:EPOCH,
      subject_sha:SUBJECT,
      first_required_base:base,
      last_required_base:base,
    });
    const providerPhaseStart=Date.now();
    await continuity.initializeCursor();
    const lifecycle=new PostgresExternalFormalForcingControllerLifecycleV1(pool,{
      scope:{...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1},
      epoch_id:EPOCH,
      subject_sha:SUBJECT,
    });
    const controllerResult=await lifecycle.acquireOrRenew({
      lease_owner:"phase7-composition-controller",
      lease_duration_seconds:900,
    });
    if(controllerResult.status!=="ACQUIRED")throw new Error("PHASE7_COMPOSITION_CONTROLLER_ACQUIRE_REQUIRED");
    const controller=controllerResult.lease;
    const admission=new PostgresExternalFormalForcingSupplyAdmissionV1(pool,{
      scope:{...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1},
      epoch_id:EPOCH,
      subject_sha:SUBJECT,
      first_required_base:base,
      last_required_base:base,
      qualified_budget:budget(),
    });
    const admitted=await admission.claimNextRequiredBase({
      controller_lease:controller,
      lease_owner:"phase7-composition-producer",
      lease_duration_seconds:900,
    });
    if(admitted.status!=="CLAIMED")throw new Error("PHASE7_COMPOSITION_PRODUCER_CLAIM_REQUIRED");
    const claim=admitted.claim;
    await continuity.advanceClaimPhaseUnderController({
      controller_lease:controller,claim,phase:"ACQUIRING",
    });

    const s3={
      endpoint:required("PHASE7_PRIVATE_S3_ENDPOINT"),
      bucket:required("PHASE7_PRIVATE_S3_BUCKET"),
      region:required("PHASE7_PRIVATE_S3_REGION"),
      access_key_id:required("PHASE7_PRIVATE_S3_ACCESS_KEY_ID"),
      secret_access_key:required("PHASE7_PRIVATE_S3_SECRET_ACCESS_KEY"),
      allow_insecure_http_for_test:true,
    };
    const s3Endpoint = new URL(s3.endpoint);
    if (!["127.0.0.1","localhost","[::1]"].includes(s3Endpoint.hostname)
        || !["http:","https:"].includes(s3Endpoint.protocol)
        || s3Endpoint.username || s3Endpoint.password || s3Endpoint.search || s3Endpoint.hash
        || s3.bucket !== "mcft-cap09-requal-"+TEST_RUN_ID) {
      throw new Error("CAP09_NONAUTHORIZED_E2E_EXACT_ISOLATED_S3_REQUIRED");
    }
    // Instantiate the actual isolated production-primitive Composer, not a
    // hand-wired copy of its retention/fenced-promotion configuration.
    // Only the external transport/decoders are replaced by controlled fixtures.
    const isolated=composeIsolatedMcftCap09V13ProducerCoreV1({
      pool,epoch_id:EPOCH,subject_sha:SUBJECT,isolated_run_id:TEST_RUN_ID,
      private_store:s3,
    });
    if(isolated.isolated_composition_id!=="MCFT_CAP09_V13_ISOLATED_QUALIFICATION_COMPOSITION_V1"
        ||isolated.production_wrapper_composer_reused!==false
        ||isolated.production_canonical_primitive_implementations_reused!==true) {
      throw new Error("CAP09_NONAUTHORIZED_E2E_ACTUAL_ISOLATED_COMPOSER_REQUIRED");
    }
    // Use actual production-primitive S3 adapters with Timing V2's real
    // per-operation elapsed-time measurement formula. Do not alter the
    // frozen original Timing V2 entrypoint or official Host/Permit gate.
    const retentionDelegate=isolated.retention;
    const candidateDelegate=isolated.candidate_store;
    let rawRetentionMs=0,rawRetentionCallCount=0,candidateWriteMs=0,candidateWriteCount=0;
    const retention={
      retainRawEvidence:async (input:Parameters<typeof retentionDelegate.retainRawEvidence>[0])=>{
        const start=Date.now();
        try{return await retentionDelegate.retainRawEvidence(input);}
        finally{rawRetentionMs+=Date.now()-start;rawRetentionCallCount++;}
      },
    };
    const candidateStore={
      writeCandidateManifest:async (input:Parameters<typeof candidateDelegate.writeCandidateManifest>[0])=>{
        const start=Date.now();
        try{return await candidateDelegate.writeCandidateManifest(input);}
        finally{candidateWriteMs+=Date.now()-start;candidateWriteCount++;}
      },
      readCandidateManifest:candidateDelegate.readCandidateManifest.bind(candidateDelegate),
    };
    const rawReader=isolated.raw_reader,fenced=isolated.fenced_promotion;

    const soilTransport=new FixtureTransport(
      "https://kbs.example.invalid/soil",
      "application/json",
      availableAt,
      Buffer.from("phase7-composition-soil-raw-v1","utf8"),
    );
    const gfsTransport=new FixtureTransport(
      "https://nomads.example.invalid/gfs",
      "application/x-tar",
      availableAt,
      Buffer.from("phase7-composition-gfs-raw-v1","utf8"),
    );
    const workFactory={
      buildForTarget(input:{
        target_logical_time:string;
        requested_at:string;
        request_id_prefix:string;
        source_families?:readonly string[];
      }):readonly EvidenceRuntimeCycleWorkItemV1[]{
        if(input.target_logical_time!==base)throw new Error("PHASE7_COMPOSITION_FIXTURE_TARGET_DRIFT");
        return [
          {
            work_item_id:input.request_id_prefix+":soil",
            dataset_id:MCFT_CAP09_KBS_SOIL_DATASET_ID_V1,
            request:{
              request_id:input.request_id_prefix+":soil",
              provider_id:"KBS_LTER",
              source_family:"CURRENT_WEATHER_VARIATE_JSON",
              locator:"https://kbs.example.invalid/soil",
              allowed_final_hosts:["kbs.example.invalid"],
              use_policy_ref:"PHASE7_COMPOSITION_QUALIFICATION_ONLY",
              requested_at:input.requested_at,
              expected_content_type_prefixes:["application/json"],
              limitations:["PRIVATE_RESTRICTED_RAW_EVIDENCE","CONTROLLED_ENGINEERING_FIXTURE_ONLY"],
            },
            transport:soilTransport,
            decoder:new FixtureDecoder("SOIL",base,soilIngested),
          },
          {
            work_item_id:input.request_id_prefix+":gfs",
            dataset_id:"noaa_ncep_gfs_same_cycle_72h_bundle_v1",
            request:{
              request_id:input.request_id_prefix+":gfs",
              provider_id:MCFT_CAP09_GFS_BUNDLE_PROVIDER_ID_V1,
              source_family:MCFT_CAP09_GFS_BUNDLE_SOURCE_FAMILY_V1,
              locator:"https://nomads.example.invalid/gfs",
              allowed_final_hosts:["nomads.example.invalid"],
              use_policy_ref:"PHASE7_COMPOSITION_QUALIFICATION_ONLY",
              requested_at:input.requested_at,
              source_event_time:base,
              expected_content_type_prefixes:["application/x-tar"],
              limitations:["PRIVATE_RESTRICTED_RAW_EVIDENCE","CONTROLLED_ENGINEERING_FIXTURE_ONLY"],
            },
            transport:gfsTransport,
            decoder:new FixtureDecoder("GFS",base,gfsIngested),
          },
        ];
      },
    };

    let decoderFactoryCount=0;
    const decoderFactory:ExternalFormalCandidateRehydrationDecoderFactoryV1={
      createDecoder({base_target_t,raw}){
        decoderFactoryCount+=1;
        if(!raw.canonical_record_ingested_at)throw new Error("PHASE7_COMPOSITION_REHYDRATION_INGESTED_AT_REQUIRED");
        if(raw.source_family==="CURRENT_WEATHER_VARIATE_JSON"){
          return new FixtureDecoder("SOIL",base_target_t,raw.canonical_record_ingested_at);
        }
        if(raw.source_family===MCFT_CAP09_GFS_BUNDLE_SOURCE_FAMILY_V1){
          return new FixtureDecoder("GFS",base_target_t,raw.canonical_record_ingested_at);
        }
        throw new Error("PHASE7_COMPOSITION_REHYDRATION_SOURCE_FAMILY_UNSUPPORTED");
      },
    };

    const composition=new ExternalFormalPrivateCandidateCapturePromotionV1({
      subject_sha:SUBJECT,
      work_item_factory:workFactory,
      retention,
      candidate_store:candidateStore,
      raw_reader:rawReader,
      fenced_promotion:fenced,
      rehydration_decoder_factory:decoderFactory,
    });

    const capture=await composition.captureExactBase({
      base_target_t:base,
      subject_sha:SUBJECT,
      idempotency_key:claim.idempotency_key,
    });
    const providerAndCaptureTotalMs=Date.now()-providerPhaseStart;
    const retainedRawAndCandidateMs=rawRetentionMs+candidateWriteMs;
    const providerCaptureMs=providerAndCaptureTotalMs-retainedRawAndCandidateMs;
    if(providerCaptureMs<0)throw Error("STAGE3_REAL_TIMING_CAPTURE_SPLIT_INVALID");
    if(capture.formal_database_write_count!==0||capture.raw_values_emitted!==false){
      throw new Error("PHASE7_COMPOSITION_CAPTURE_BOUNDARY_FAILED");
    }
    if(Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0]?.n??-1)!==0){
      throw new Error("PHASE7_COMPOSITION_CAPTURE_FORMAL_FACT_WRITE_FORBIDDEN");
    }
    const manifestRead=await candidateStore.readCandidateManifest({
      capture_ref:capture.capture_ref,
      candidate_artifact_digest:capture.candidate_artifact_digest,
    });
    if(manifestRead.manifest.raw_objects.length!==2||manifestRead.manifest.expected_records.length!==3){
      throw new Error("PHASE7_COMPOSITION_CANDIDATE_CARDINALITY_INVALID");
    }
    for(const raw of manifestRead.manifest.raw_objects){
      if(!raw.dataset_id||!raw.decoder_id||!raw.decoder_version||!raw.canonical_record_ingested_at){
        throw new Error("PHASE7_COMPOSITION_REPLAY_AUTHORITY_REQUIRED");
      }
    }

    const promotionQueueStart=Date.now();
    await continuity.advanceClaimPhaseUnderController({
      controller_lease:controller,claim,phase:"READY_TO_FINALIZE",
    });
    await continuity.advanceClaimPhaseUnderController({
      controller_lease:controller,claim,phase:"PROMOTING",
    });

    const promotionQueueAndSetupMs=Date.now()-promotionQueueStart;
    const promotionStart=Date.now();
    const promoted=await composition.promoteExactBase({
      base_target_t:base,
      subject_sha:SUBJECT,
      idempotency_key:claim.idempotency_key,
      capture,
      controller_lease:controller,
      producer_claim:claim,
    });
    if(
      promoted.database_fence_commit_succeeded!==true
      || promoted.formal_fact_present_count!==3
      || promoted.formal_database_write_count!==3
      || promoted.idempotent_existing_fact_count!==0
    )throw new Error("PHASE7_COMPOSITION_FENCED_PROMOTION_RECEIPT_INVALID");
    if(soilTransport.request_count!==1||gfsTransport.request_count!==1){
      throw new Error("PHASE7_COMPOSITION_PROVIDER_REFETCH_DETECTED");
    }
    if(decoderFactoryCount!==2)throw new Error("PHASE7_COMPOSITION_REHYDRATION_DECODER_COUNT_INVALID");
    const factCount=Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0]?.n??-1);
    if(factCount!==3)throw new Error("PHASE7_COMPOSITION_EXACT_THREE_FORMAL_FACTS_REQUIRED");
    const targetBeforeAttestation=(await pool.query<{state:string}>(
      "SELECT state FROM twin_external_formal_forcing_base_target_v1 WHERE epoch_id=$1",
      [EPOCH],
    )).rows[0];
    if(targetBeforeAttestation?.state!=="PROMOTING")throw new Error("PHASE7_COMPOSITION_PROMOTION_MUST_NOT_ADVANCE_CURSOR");

    const attested=await continuity.attestFormalPhysicalVisibilityUnderController({
      controller_lease:controller,
      claim,
      facts:promoted.facts,
      producer_run_id:capture.producer_run_id,
      promotion_run_id:promoted.promotion_run_id,
      candidate_artifact_digest:capture.candidate_artifact_digest,
    });
    const rehydrationPromotionCommitReadbackMs=Date.now()-promotionStart;
    if(attested.status!=="PASS"||attested.cursor_advanced!==true){
      throw new Error("PHASE7_COMPOSITION_POST_PROMOTION_ATTESTATION_FAILED");
    }

    let failClosed=false;
    try{
      await composition.promoteExactBase({
        base_target_t:base,
        subject_sha:SUBJECT,
        idempotency_key:"wrong-idempotency",
        capture,
        controller_lease:controller,
        producer_claim:claim,
      });
    }catch(error){
      failClosed=
        error instanceof ExternalFormalExactBasePromotionFailureV1
        && error.mutation_state==="NO_FORMAL_MUTATION"
        && error.formal_database_write_count===0;
    }
    if(!failClosed)throw new Error("PHASE7_COMPOSITION_PREMUTATION_FAILURE_MUST_FAIL_CLOSED");

    const sourcePaths=(createRequire(path.join(ROOT,"package.json"))(
      "./scripts/governance_acceptance/MCFT_CAP09_NONAUTHORIZED_FULL_CHAIN_PROOF_GATE_V1.cjs"
    ) as {SOURCE_PATHS:readonly string[]}).SOURCE_PATHS;
    const sourceHashes=Object.fromEntries(sourcePaths.map(file=>[
      file,crypto.createHash("sha256").update(fs.readFileSync(ROOT+"/"+file)).digest("hex"),
    ]));
    const phases={
      wake_delay_ms:0,
      job_start_setup_ms:jobStartSetupMs,
      provider_capture_ms:providerCaptureMs,
      retained_raw_and_candidate_ms:retainedRawAndCandidateMs,
      promotion_queue_and_setup_ms:promotionQueueAndSetupMs,
      rehydration_promotion_commit_readback_ms:rehydrationPromotionCommitReadbackMs,
    };
    const measuredEndToEndMs=Object.values(phases).reduce((total,value)=>total+value,0);
    if(rawRetentionCallCount!==2||candidateWriteCount!==1)
      throw Error("STAGE3_REAL_TIMING_ACTUAL_S3_WRITE_COUNT_INVALID");
    if(factCount!==3||attested.status!=="PASS"||!attested.cursor_advanced)
      throw Error("STAGE3_REAL_TIMING_FENCED_PG_NOT_VISIBLE");
    const proof={
      schema_version:"geox_mcft_cap09_stage3_isolated_real_physical_timing_sample_v1",
      status:"PASS",sample_id:SAMPLE,subject_sha:SUBJECT,test_run_id:TEST_RUN_ID,
      local_execution_environment:"EPHEMERAL_REAL_PG16_MINIO_TEST_ONLY",
      original_v13_timing_sample_v2_entry_executed:false,
      source_physical_entry:"scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP09_DA9_ISOLATED_FULL_CHAIN_NONAUTHORIZED_V1.ts",
      original_v13_timing_calibration_qualified:false,
      live_provider_latency_measured:false,
      provider_capture_mode:"CONTROLLED_IN_PROCESS_FIXTURE_NOT_LIVE_GFS_KBS",
      timing_formulas_reused_from_original_timing_v2:true,
      real_physical_s3_pg_composer_controller_executed:true,
      phase_observation_mode:"REAL_PER_PROCESS_ELAPSED_WITH_FIXTURE_PROVIDER",
      expected_sample_count:3,
      timing_phases:phases,
      measured_end_to_end_ms:measuredEndToEndMs,
      raw_retention_call_count:rawRetentionCallCount,
      raw_retention_elapsed_ms:rawRetentionMs,
      candidate_manifest_write_count:candidateWriteCount,
      candidate_manifest_write_elapsed_ms:candidateWriteMs,
      formal_fact_present_count:factCount,
      promotion_provider_refetch_count:0,
      cursor_advanced:attested.cursor_advanced,
      stage_count:0,permit_signed:false,permit_consumed:false,
      production_authorized:false,formal_v5_armed:false,o00_started:false,
      qualified:false,source_files_sha256:sourceHashes,
    };
    fs.mkdirSync("acceptance-output",{recursive:true});
    fs.writeFileSync(OUTPUT,JSON.stringify(proof,null,2)+"\n");
    process.stdout.write(JSON.stringify(proof)+"\n");
  }finally{
    await pool.end();
    await adminPool.end();
  }
}
main().catch((error)=>{
  fs.mkdirSync("acceptance-output",{recursive:true});
  fs.writeFileSync(OUTPUT,JSON.stringify({status:"FAIL",error:error instanceof Error?error.message:String(error)},null,2)+"\n");
  console.error(error instanceof Error?error.stack??error.message:String(error));
  process.exitCode=1;
});
