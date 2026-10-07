// MCFT-CAP-09 Formal-v5 active Twin production process.
//
// Local/non-GitHub production entrypoint after a successful A0 bootstrap.
// It is intentionally separate from frozen production Twin Runtime V2 and from
// PRE_FORMAL_OWNER_STANDBY. It may start only at/after O00, against the exact
// Formal-v5 database, after the A0 bootstrap lease has expired/released.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";

import cropAuthorityJson from "../../../../../docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V3.json" with { type: "json" };
import configurationMatrixJson from "../../../../../docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json" with { type: "json" };
import stageArchitectureJson from "../../../../../docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-BIOLOGICAL-STAGE-ARCHITECTURE-EFFECTIVENESS-V1.json" with { type: "json" };

import { createDatabasePool } from "../../infra/database.js";
import {
  assertMcftCap09ServicePrincipalV1,
} from "../../infra/mcft_cap09_phase5_service_principal_v1.js";
import {
  createMcftCap09ProcessStopV1,
  installMcftCap09RuntimePoolIdleErrorGuardV1,
  McftCap09ConsoleTwinHealthV1,
  McftCap09ProductionTwinFailureClassifierV1,
  McftCap09ProductionTwinWaitV1,
} from "../mcft_cap09_production_process_lifecycle_v1.js";
import {
  buildMcftCap09ProductionLeaseOwnerV1,
} from "../mcft_cap09_production_service_identity_v1.js";
import type {
  ExternalFormalV4Am19WindowManifestV2,
} from "./external_formal_v4_amendment19_runner_v2.js";
import {
  composeMcftCap09FormalV5TwinRuntimeV1,
} from "./mcft_cap09_formal_v5_twin_runtime_composition_v1.js";

export const MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_PROCESS_ID_V1 =
  "MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_PROCESS_V1" as const;
export const MCFT_CAP09_FORMAL_V5_DATABASE_V1 =
  "geox_mcft_cap09_s6_formal_t4r1_24h_v5" as const;

type JsonRecordV1=Record<string,unknown>;
type EnvironmentV1=Readonly<Record<string,string|undefined>>;

function req(env:EnvironmentV1,name:string):string{
  const v=String(env[name]??"").trim();
  if(!v)throw new Error("MCFT_CAP09_FORMAL_V5_TWIN_ENV_REQUIRED:"+name);
  return v;
}
function positiveInt(env:EnvironmentV1,name:string,fallback:number):number{
  const raw=String(env[name]??fallback).trim();
  const value=Number(raw);
  if(!Number.isInteger(value)||value<=0)throw new Error("MCFT_CAP09_FORMAL_V5_TWIN_ENV_POSITIVE_INT_REQUIRED:"+name);
  return value;
}
function json(file:string,code:string):JsonRecordV1{
  const value=JSON.parse(fs.readFileSync(file,"utf8"));
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error(code);
  return value as JsonRecordV1;
}
function digest(file:string):string{
  return "sha256:"+crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function exactIso(value:unknown,code:string):string{
  const text=String(value??"").trim();
  const ms=Date.parse(text);
  if(!Number.isFinite(ms)||new Date(ms).toISOString()!==text)throw new Error(code);
  return text;
}
function databaseName(urlText:string):string{
  const u=new URL(urlText);
  return decodeURIComponent(u.pathname.replace(/^\//,""));
}

export async function runMcftCap09FormalV5TwinRuntimeProcessV1(input?:{
  env?:EnvironmentV1;
}):Promise<void>{
  if(process.env.GITHUB_ACTIONS||process.env.CI){
    throw new Error("MCFT_CAP09_FORMAL_V5_TWIN_LOCAL_NON_GITHUB_HOST_ONLY");
  }
  const env=input?.env??process.env;
  const deploymentSubject=req(env,"GEOX_DEPLOYMENT_SUBJECT_COMMIT");
  if(!/^[0-9a-f]{40}$/.test(deploymentSubject)){
    throw new Error("MCFT_CAP09_FORMAL_V5_TWIN_DEPLOYMENT_SUBJECT_INVALID");
  }

  const bootstrapPath=req(env,"GEOX_MCFT_CAP09_FORMAL_V5_A0_BOOTSTRAP_PROOF_PATH");
  const proof=json(bootstrapPath,"MCFT_CAP09_FORMAL_V5_TWIN_A0_BOOTSTRAP_PROOF_INVALID");
  if(
    proof.schema_version!=="geox_mcft_cap09_formal_v5_a0_bootstrap_result_v1"
    || proof.status!=="PASS"
    || proof.formal_a0_bootstrapped!==true
    || proof.formal_o00_started!==false
    || proof.final_actual_24h_still_required!==true
    || proof.store_reuse_authorized_after_success!==true
  )throw new Error("MCFT_CAP09_FORMAL_V5_TWIN_A0_BOOTSTRAP_PASS_REQUIRED");
  if(proof.arm_runtime_semantic_subject_sha!==deploymentSubject){
    throw new Error("MCFT_CAP09_FORMAL_V5_TWIN_SUBJECT_MISMATCH");
  }
  if(proof.formal_database_name!==MCFT_CAP09_FORMAL_V5_DATABASE_V1){
    throw new Error("MCFT_CAP09_FORMAL_V5_TWIN_DATABASE_PROOF_MISMATCH");
  }

  const manifestPath=req(env,"GEOX_MCFT_CAP09_FORMAL_V5_MANIFEST_PATH");
  if(!fs.existsSync(manifestPath)){
    throw new Error("MCFT_CAP09_FORMAL_V5_TWIN_MANIFEST_REQUIRED");
  }
  const manifest=json(
    manifestPath,
    "MCFT_CAP09_FORMAL_V5_TWIN_MANIFEST_INVALID",
  ) as unknown as ExternalFormalV4Am19WindowManifestV2;
  if(
    manifest.database_name!==MCFT_CAP09_FORMAL_V5_DATABASE_V1
    || manifest.manifest_ref!==proof.manifest_ref
    || manifest.manifest_hash!==proof.manifest_hash
    || manifest.epoch_id!==proof.epoch_id
    || manifest.o00_logical_time!==proof.o00
  )throw new Error("MCFT_CAP09_FORMAL_V5_TWIN_MANIFEST_PROOF_MISMATCH");

  const currentCropPath=req(env,"GEOX_MCFT_CAP09_FORMAL_V5_CURRENT_CROP_AUTHORITY_PATH");
  if(digest(currentCropPath)!==proof.current_crop_authority_sha256){
    throw new Error("MCFT_CAP09_FORMAL_V5_TWIN_CURRENT_CROP_DIGEST_MISMATCH");
  }
  const currentCropRef=req(
    env,
    "GEOX_MCFT_CAP09_FORMAL_V5_CURRENT_CROP_AUTHORITY_REF",
  );
  if(String(proof.current_crop_authority_ref??"")!==currentCropRef){
    throw new Error("MCFT_CAP09_FORMAL_V5_TWIN_CURRENT_CROP_REF_MISMATCH");
  }
  const currentCrop=json(
    currentCropPath,
    "MCFT_CAP09_FORMAL_V5_TWIN_CURRENT_CROP_INVALID",
  );

  const databaseUrl=req(env,"GEOX_MCFT_CAP09_FORMAL_V5_TWIN_RUNTIME_DATABASE_URL");
  if(databaseName(databaseUrl)!==MCFT_CAP09_FORMAL_V5_DATABASE_V1){
    throw new Error("MCFT_CAP09_FORMAL_V5_TWIN_DATABASE_URL_MISMATCH");
  }

  const pool=createDatabasePool(databaseUrl);
  const failureClassifier=new McftCap09ProductionTwinFailureClassifierV1();
  const poolGuard=installMcftCap09RuntimePoolIdleErrorGuardV1({
    pool,
    runtime_role:"TWIN_RUNTIME",
    failure_classifier:failureClassifier,
  });
  const stop=createMcftCap09ProcessStopV1();
  try{
    await assertMcftCap09ServicePrincipalV1(pool,"TWIN_RUNTIME");

    const clock=(await pool.query<{database_now:string|Date}>(
      "SELECT transaction_timestamp() AS database_now",
    )).rows[0];
    if(!clock)throw new Error("MCFT_CAP09_FORMAL_V5_TWIN_DATABASE_CLOCK_REQUIRED");
    const databaseNow=exactIso(new Date(clock.database_now).toISOString(),"MCFT_CAP09_FORMAL_V5_TWIN_DATABASE_CLOCK_INVALID");
    const o00=exactIso(proof.o00,"MCFT_CAP09_FORMAL_V5_TWIN_O00_INVALID");
    if(Date.parse(databaseNow)<Date.parse(o00)){
      throw new Error("MCFT_CAP09_FORMAL_V5_TWIN_BEFORE_O00_FORBIDDEN:"+databaseNow+":"+o00);
    }

    const live=(await pool.query<{n:number}>(
      "SELECT count(*)::int AS n FROM twin_runtime_lease_v1 WHERE expires_at>transaction_timestamp()",
    )).rows[0]?.n??-1;
    if(live!==0){
      throw new Error("MCFT_CAP09_FORMAL_V5_TWIN_PREEXISTING_LIVE_OWNER_FORBIDDEN:"+live);
    }

    const serviceId=req(env,"GEOX_MCFT_CAP09_FORMAL_V5_TWIN_SERVICE_ID");
    const leaseOwner=buildMcftCap09ProductionLeaseOwnerV1({
      plane:"TWIN_RUNTIME",
      configured_service_id:serviceId,
      instance_id:String(env.HOSTNAME??os.hostname()).trim(),
    });
    const leaseSeconds=positiveInt(env,"GEOX_MCFT_CAP09_FORMAL_V5_TWIN_LEASE_DURATION_SECONDS",300);

    const composition=composeMcftCap09FormalV5TwinRuntimeV1({
      pool,
      subject_sha:deploymentSubject,
      manifest,
      crop_authority:cropAuthorityJson as JsonRecordV1,
      configuration_matrix:configurationMatrixJson as JsonRecordV1,
      current_crop_authority:currentCrop,
      biological_stage_architecture_effectiveness:stageArchitectureJson as JsonRecordV1,
      wait:new McftCap09ProductionTwinWaitV1({
        idle_poll_ms:positiveInt(env,"GEOX_MCFT_CAP09_FORMAL_V5_TWIN_IDLE_POLL_MS",5_000),
        not_ready_poll_ms:positiveInt(env,"GEOX_MCFT_CAP09_FORMAL_V5_TWIN_NOT_READY_POLL_MS",5_000),
        terminal_poll_ms:positiveInt(env,"GEOX_MCFT_CAP09_FORMAL_V5_TWIN_TERMINAL_POLL_MS",1_000),
        retry_base_ms:positiveInt(env,"GEOX_MCFT_CAP09_FORMAL_V5_TWIN_RETRY_BASE_MS",1_000),
        retry_maximum_ms:positiveInt(env,"GEOX_MCFT_CAP09_FORMAL_V5_TWIN_RETRY_MAXIMUM_MS",30_000),
      }),
      health:new McftCap09ConsoleTwinHealthV1(),
      stop,
      failure_classifier:failureClassifier,
    });

    process.stdout.write(JSON.stringify({
      runtime_role:"TWIN_RUNTIME",
      mode:"FORMAL_V5_ACTIVE",
      status:"STARTING",
      deployment_subject_sha:deploymentSubject,
      epoch_id:manifest.epoch_id,
      o00,
      current_crop_authority_ref:proof.current_crop_authority_ref,
      formal_a0_bootstrapped:true,
      provider_request_count:0,
    })+"\n");

    await composition.host.run({
      lease_owner:leaseOwner,
      lease_duration_seconds:leaseSeconds,
    });
  }finally{
    stop.dispose();
    try{await pool.end();}finally{poolGuard.dispose();}
  }
}
