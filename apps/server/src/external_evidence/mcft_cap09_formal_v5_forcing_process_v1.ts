// MCFT-CAP-09 Formal-v5 subordinate forcing process.
//
// Starts only after a successful Formal-v5 A0 bootstrap. It keeps the operational
// Evidence owner unchanged and uses the existing Formal-store Evidence runtime
// principal solely for v13 forcing coordination/fenced exact-base promotion.
//
// The governed caller derives subject/epoch/base window from the A0 proof.
// Environment variables provide credentials only; they cannot redefine authority.

import fs from "node:fs";

import forcingBudgetAuthorityJson from "../../../../docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-FORMAL-FORCING-ACQUISITION-BUDGET-AUTHORITY-V1.json" with { type: "json" };
import hostBindingJson from "../../../../docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-NON-GITHUB-HOST-BINDING-AUTHORITY-V1.json" with { type: "json" };

import { createDatabasePool } from "../infra/database.js";
import {
  formalForcingAcquisitionStartDeadlineV1,
  type FormalForcingAcquisitionBudgetAdjudicationV1,
} from "../domain/twin_runtime/external_formal_forcing_acquisition_budget_v1.js";
import {
  createMcftCap09V13ForcingProductionProcessV1,
} from "./mcft_cap09_v13_forcing_production_process_v1.js";

export const MCFT_CAP09_FORMAL_V5_FORCING_PROCESS_ID_V1 =
  "MCFT_CAP09_FORMAL_V5_FORCING_PROCESS_V1" as const;
export const MCFT_CAP09_FORMAL_V5_DATABASE_V1 =
  "geox_mcft_cap09_s6_formal_t4r1_24h_v5" as const;

type EnvironmentV1=Readonly<Record<string,string|undefined>>;
type JsonRecordV1=Record<string,unknown>;

function req(env:EnvironmentV1,name:string):string{
  const value=String(env[name]??"").trim();
  if(!value)throw new Error("MCFT_CAP09_FORMAL_V5_FORCING_ENV_REQUIRED:"+name);
  return value;
}
function json(file:string,code:string):JsonRecordV1{
  if(!fs.existsSync(file))throw new Error(code+":"+file);
  const value=JSON.parse(fs.readFileSync(file,"utf8"));
  if(!value||typeof value!=="object"||Array.isArray(value))throw new Error(code);
  return value as JsonRecordV1;
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
function addHours(value:string,hours:number):string{
  return new Date(Date.parse(value)+hours*3_600_000).toISOString();
}
function positiveInteger(
  env:EnvironmentV1,
  name:string,
  fallback:number,
  minimum:number,
  maximum:number,
):number{
  const raw=String(env[name]??fallback).trim();
  if(!/^\d+$/.test(raw))throw new Error("MCFT_CAP09_FORMAL_V5_FORCING_INTEGER_ENV_INVALID:"+name);
  const value=Number(raw);
  if(!Number.isSafeInteger(value)||value<minimum||value>maximum){
    throw new Error("MCFT_CAP09_FORMAL_V5_FORCING_INTEGER_ENV_INVALID:"+name);
  }
  return value;
}
async function sleep(ms:number):Promise<void>{
  await new Promise<void>((resolve)=>setTimeout(resolve,ms));
}

export async function runMcftCap09FormalV5ForcingProcessV1(input?:{
  env?:EnvironmentV1;
}):Promise<void>{
  if(process.env.GITHUB_ACTIONS||process.env.CI){
    throw new Error("MCFT_CAP09_FORMAL_V5_FORCING_LOCAL_NON_GITHUB_HOST_ONLY");
  }
  const env=input?.env??process.env;
  const bootstrapPath=req(env,"GEOX_MCFT_CAP09_FORMAL_V5_A0_BOOTSTRAP_PROOF_PATH");
  const proof=json(
    bootstrapPath,
    "MCFT_CAP09_FORMAL_V5_FORCING_A0_BOOTSTRAP_PROOF_REQUIRED",
  );
  if(
    proof.schema_version!=="geox_mcft_cap09_formal_v5_a0_bootstrap_result_v1"
    || proof.status!=="PASS"
    || proof.formal_a0_bootstrapped!==true
    || proof.formal_o00_started!==false
    || proof.final_actual_24h_still_required!==true
    || proof.store_reuse_authorized_after_success!==true
  ){
    throw new Error("MCFT_CAP09_FORMAL_V5_FORCING_A0_BOOTSTRAP_PASS_REQUIRED");
  }

  const subject=String(proof.arm_runtime_semantic_subject_sha??"").trim();
  if(!/^[0-9a-f]{40}$/.test(subject)){
    throw new Error("MCFT_CAP09_FORMAL_V5_FORCING_SUBJECT_INVALID");
  }
  const epoch=String(proof.epoch_id??"").trim();
  if(!epoch)throw new Error("MCFT_CAP09_FORMAL_V5_FORCING_EPOCH_REQUIRED");

  const manifestPath=req(env,"GEOX_MCFT_CAP09_FORMAL_V5_MANIFEST_PATH");
  const manifest=json(
    manifestPath,
    "MCFT_CAP09_FORMAL_V5_FORCING_MANIFEST_REQUIRED",
  );
  if(
    manifest.manifest_ref!==proof.manifest_ref
    || manifest.manifest_hash!==proof.manifest_hash
    || manifest.epoch_id!==epoch
    || manifest.database_name!==MCFT_CAP09_FORMAL_V5_DATABASE_V1
  ){
    throw new Error("MCFT_CAP09_FORMAL_V5_FORCING_MANIFEST_PROOF_MISMATCH");
  }

  const o00=exactIso(proof.o00,"MCFT_CAP09_FORMAL_V5_FORCING_O00_INVALID");
  const o23=exactIso(proof.o23,"MCFT_CAP09_FORMAL_V5_FORCING_O23_INVALID");
  if(Date.parse(o23)-Date.parse(o00)!==23*3_600_000){
    throw new Error("MCFT_CAP09_FORMAL_V5_FORCING_WINDOW_INVALID");
  }
  const firstRequiredBase=o00;
  const lastRequiredBase=addHours(o23,-1);

  const formalDbUrl=req(
    env,
    "GEOX_MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_DATABASE_URL",
  );
  if(databaseName(formalDbUrl)!==MCFT_CAP09_FORMAL_V5_DATABASE_V1){
    throw new Error("MCFT_CAP09_FORMAL_V5_FORCING_DATABASE_URL_MISMATCH");
  }

  const budgetAuthority=forcingBudgetAuthorityJson as unknown as {
    qualified_budget:FormalForcingAcquisitionBudgetAdjudicationV1;
    timing_budget_qualified:boolean;
    timing_budget_frozen:boolean;
  };
  if(
    budgetAuthority.timing_budget_qualified!==true
    || budgetAuthority.timing_budget_frozen!==true
    || budgetAuthority.qualified_budget?.status!=="PASS"
    || budgetAuthority.qualified_budget.selected_budget_ms!==2_081_804
  ){
    throw new Error("MCFT_CAP09_FORMAL_V5_FORCING_FROZEN_BUDGET_REQUIRED");
  }

  const evidenceServiceId=String(
    (hostBindingJson as any)?.host_identity_contract?.evidence_runtime
      ?.service_identity?.service_id??"",
  ).trim();
  if(!evidenceServiceId){
    throw new Error("MCFT_CAP09_FORMAL_V5_FORCING_EVIDENCE_SERVICE_ID_REQUIRED");
  }

  const mappedEnv:Record<string,string|undefined>={
    ...env,
    GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL:formalDbUrl,
    GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT:req(
      env,
      "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ENDPOINT",
    ),
    GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET:req(
      env,
      "GEOX_MCFT_CAP09_FORMAL_RAW_S3_BUCKET",
    ),
    GEOX_MCFT_CAP09_EVIDENCE_S3_REGION:req(
      env,
      "GEOX_MCFT_CAP09_FORMAL_RAW_S3_REGION",
    ),
    GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID:req(
      env,
      "GEOX_MCFT_CAP09_FORMAL_RAW_S3_ACCESS_KEY_ID",
    ),
    GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY:req(
      env,
      "GEOX_MCFT_CAP09_FORMAL_RAW_S3_SECRET_ACCESS_KEY",
    ),
    GEOX_MCFT_CAP09_EVIDENCE_S3_ALLOW_INSECURE_HTTP_FOR_TEST:
      String(env.GEOX_MCFT_CAP09_FORMAL_RAW_S3_ALLOW_INSECURE_HTTP_FOR_TEST??"0"),
    GEOX_MCFT_CAP09_V13_CONTROLLER_OWNER:
      evidenceServiceId+"#formal-v5-forcing-controller:"+epoch,
    GEOX_MCFT_CAP09_V13_PRODUCER_OWNER:
      evidenceServiceId+"#formal-v5-forcing-producer:"+epoch,
    GEOX_MCFT_CAP09_V13_CONTROLLER_LEASE_SECONDS:String(
      positiveInteger(
        env,
        "GEOX_MCFT_CAP09_FORMAL_V5_FORCING_CONTROLLER_LEASE_SECONDS",
        300,
        1,
        1800,
      ),
    ),
    GEOX_MCFT_CAP09_V13_PRODUCER_LEASE_SECONDS:String(
      positiveInteger(
        env,
        "GEOX_MCFT_CAP09_FORMAL_V5_FORCING_PRODUCER_LEASE_SECONDS",
        300,
        1,
        1800,
      ),
    ),
    GEOX_MCFT_CAP09_V13_HEARTBEAT_INTERVAL_MS:String(
      positiveInteger(
        env,
        "GEOX_MCFT_CAP09_FORMAL_V5_FORCING_HEARTBEAT_INTERVAL_MS",
        30_000,
        100,
        1_799_999,
      ),
    ),
  };

  const processContext=await createMcftCap09V13ForcingProductionProcessV1({
    authority:{
      scope:manifest.scope as any,
      subject_sha:subject,
      epoch_id:epoch,
      first_required_base:firstRequiredBase,
      last_required_base:lastRequiredBase,
      qualified_budget:budgetAuthority.qualified_budget,
    },
    env:mappedEnv,
  });

  const clockPool=createDatabasePool(formalDbUrl);
  try{
    const cursor=await processContext.composition.forcing_continuity.initializeCursor();
    if(
      cursor.epoch_id!==epoch
      || cursor.subject_sha!==subject
      || cursor.first_required_base!==firstRequiredBase
      || cursor.last_required_base!==lastRequiredBase
    ){
      throw new Error("MCFT_CAP09_FORMAL_V5_FORCING_CURSOR_IDENTITY_MISMATCH");
    }

    process.stdout.write(JSON.stringify({
      runtime_role:"EVIDENCE_RUNTIME_SUBORDINATE_FORCING",
      mode:"FORMAL_V5_ACTIVE",
      status:"STARTED",
      subject_sha:subject,
      epoch_id:epoch,
      first_required_base:firstRequiredBase,
      last_required_base:lastRequiredBase,
      selected_budget_ms:budgetAuthority.qualified_budget.selected_budget_ms,
      production_evidence_owner_replaced:false,
      provider_request_count_before_controller_run:0,
    })+"\n");

    while(true){
      const snapshot=await processContext.composition.forcing_continuity.readCursor();
      if(snapshot.completed||snapshot.next_missing_required_base===null){
        process.stdout.write(JSON.stringify({
          runtime_role:"EVIDENCE_RUNTIME_SUBORDINATE_FORCING",
          mode:"FORMAL_V5_ACTIVE",
          status:"FORCING_BASE_WINDOW_COMPLETE",
          epoch_id:epoch,
          subject_sha:subject,
        })+"\n");
        return;
      }

      const nextBase=exactIso(
        snapshot.next_missing_required_base,
        "MCFT_CAP09_FORMAL_V5_FORCING_NEXT_BASE_INVALID",
      );
      const startDeadline=formalForcingAcquisitionStartDeadlineV1(
        nextBase,
        budgetAuthority.qualified_budget.selected_budget_ms,
      );
      const nowRow=(await clockPool.query<{database_now:string|Date}>(
        "SELECT clock_timestamp() AS database_now",
      )).rows[0];
      if(!nowRow)throw new Error("MCFT_CAP09_FORMAL_V5_FORCING_DATABASE_CLOCK_REQUIRED");
      const now=new Date(nowRow.database_now).toISOString();

      if(Date.parse(now)<Date.parse(startDeadline)){
        const waitMs=Math.min(
          Date.parse(startDeadline)-Date.parse(now),
          30_000,
        );
        await sleep(Math.max(waitMs,1));
        continue;
      }

      const result=await processContext.runOnce();
      process.stdout.write(JSON.stringify({
        runtime_role:"EVIDENCE_RUNTIME_SUBORDINATE_FORCING",
        mode:"FORMAL_V5_ACTIVE",
        epoch_id:epoch,
        subject_sha:subject,
        ...result,
      })+"\n");

      if(
        result.status==="CONTROLLER_TERMINAL"
        || result.status==="TERMINAL_LATE_WAKE"
        || result.status==="TERMINAL_PROMOTION_MUTATION_UNSAFE"
      ){
        throw new Error(
          "MCFT_CAP09_FORMAL_V5_FORCING_TERMINAL:"+result.status,
        );
      }

      if(
        result.status==="CONTROLLER_BUSY"
        || result.status==="PRODUCER_BUSY"
        || result.status==="PROMOTION_COMMITTED_ATTESTATION_PENDING_RECOVERY"
      ){
        await sleep(1_000);
      }
    }
  }finally{
    await clockPool.end();
    await processContext.close();
  }
}
