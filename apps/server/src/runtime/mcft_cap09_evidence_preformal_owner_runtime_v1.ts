import fs from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

import { createDatabasePool } from "../infra/database.js";
import { assertMcftCap09ServicePrincipalV1 } from "../infra/mcft_cap09_phase5_service_principal_v1.js";
import { S3CompatiblePrivateEvidenceObjectClientV1 } from "../external_evidence/s3_compatible_private_evidence_object_client_v1.js";
import { runMcftCap09ProductionEvidenceRuntimeV1 } from "../external_evidence/mcft_cap09_evidence_runtime_process_v1.js";
import { createMcftCap09ProcessStopV1 } from "./mcft_cap09_production_process_lifecycle_v1.js";
import {
  MCFT_CAP09_NON_OWNER_STANDBY_MODE_V1,
  MCFT_CAP09_OWNER_CUTOVER_MODE_V1,
  parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1,
} from "./mcft_cap09_production_runtime_start_authority_v1.js";
import { readMcftCap09OwnerCutoverAuthorityV1, type McftCap09OwnerCutoverScopeV1 } from "./mcft_cap09_production_owner_cutover_authority_v1.js";
import {
  loadMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1,
  sha256FileV1,
} from "./mcft_cap09_formal_v5_evidence_runtime_handoff_authority_v1.js";

const NON_OWNER_STANDBY_MODE = MCFT_CAP09_NON_OWNER_STANDBY_MODE_V1;
const OWNER_CUTOVER_MODE = MCFT_CAP09_OWNER_CUTOVER_MODE_V1;
const EVIDENCE_LEASE_TABLE = "external_evidence_producer_lease_v1" as const;
const FORMAL_RAW_BUCKET = "geox-mcft-cap09-formal-raw-v1" as const;

function req(name:string):string{const v=String(process.env[name]??"").trim();if(!v)throw new Error("MCFT_CAP09_EVIDENCE_PREFORMAL_ENV_REQUIRED:"+name);return v;}
function scope():McftCap09OwnerCutoverScopeV1{return {
 tenant_id:req("GEOX_MCFT_CAP09_TENANT_ID"),project_id:req("GEOX_MCFT_CAP09_PROJECT_ID"),group_id:req("GEOX_MCFT_CAP09_GROUP_ID"),
 field_id:req("GEOX_MCFT_CAP09_FIELD_ID"),season_id:req("GEOX_MCFT_CAP09_SEASON_ID"),zone_id:req("GEOX_MCFT_CAP09_ZONE_ID")
};}
function mode():typeof NON_OWNER_STANDBY_MODE|typeof OWNER_CUTOVER_MODE{
 const value=String(process.env.GEOX_MCFT_CAP09_PREFORMAL_MODE??OWNER_CUTOVER_MODE).trim();
 if(value!==NON_OWNER_STANDBY_MODE&&value!==OWNER_CUTOVER_MODE)throw new Error("MCFT_CAP09_EVIDENCE_PREFORMAL_MODE_INVALID:"+value);
 return value;
}

export async function runMcftCap09EvidenceNonOwnerStandbyV1():Promise<void>{
 function standbyHeartbeat(subject:string,r2HeadStatus:number):void{
  process.stdout.write(JSON.stringify({
   runtime_role:"EVIDENCE_RUNTIME",mode:NON_OWNER_STANDBY_MODE,status:"HEALTHY_NON_OWNER_STANDBY",
   deployment_subject_sha:subject,database_connectivity:true,r2_authenticated_head_status:r2HeadStatus,
   evidence_producer_lease_claimed:false,production_evidence_write:false,r2_write:false,
   production_owner_activation:false,formal_v5_arm:false,a0_execution:false,o00_started:false
  })+"\n");
 }
 const s=scope(); const subject=req("GEOX_DEPLOYMENT_SUBJECT_COMMIT");
 const runtimePath=req("GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_PATH");
 const raw=JSON.parse(fs.readFileSync(runtimePath,"utf8"));
 parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(raw,"EVIDENCE_RUNTIME",{
  deployment_subject_sha:subject,scope:s,runtime_mode:NON_OWNER_STANDBY_MODE
 });

 const databaseUrl=req("GEOX_MCFT_CAP09_EVIDENCE_RUNTIME_DATABASE_URL");
 const bucket=req("GEOX_MCFT_CAP09_EVIDENCE_S3_BUCKET");
 if(bucket===FORMAL_RAW_BUCKET)throw new Error("MCFT_CAP09_EVIDENCE_STANDBY_FORMAL_RAW_BUCKET_REUSE_FORBIDDEN");
 const client=new S3CompatiblePrivateEvidenceObjectClientV1({
  endpoint:req("GEOX_MCFT_CAP09_EVIDENCE_S3_ENDPOINT"),bucket,
  region:req("GEOX_MCFT_CAP09_EVIDENCE_S3_REGION"),
  access_key_id:req("GEOX_MCFT_CAP09_EVIDENCE_S3_ACCESS_KEY_ID"),
  secret_access_key:req("GEOX_MCFT_CAP09_EVIDENCE_S3_SECRET_ACCESS_KEY")
 });
 const pool=createDatabasePool(databaseUrl);
 const stop=createMcftCap09ProcessStopV1();
 try{
  await assertMcftCap09ServicePrincipalV1(pool,"EVIDENCE_RUNTIME");
  const live=await pool.query<{n:number}>(`SELECT count(*)::int AS n FROM ${EVIDENCE_LEASE_TABLE} WHERE expires_at>transaction_timestamp()`);
  if(live.rows[0]?.n!==0)throw new Error("MCFT_CAP09_EVIDENCE_NON_OWNER_STANDBY_LIVE_OWNER_MUST_BE_ZERO");
  const probeKey=`pre-runtime-non-owner-standby/${subject}/authenticated-head-only`;
  const head=await client.headObject(probeKey,[200,404]);
  standbyHeartbeat(subject,head.status);
  while(!stop.stopRequested()){
   await sleep(30_000);
   if(!stop.stopRequested())standbyHeartbeat(subject,head.status);
  }
 } finally {stop.dispose();await pool.end();}
}

export async function runMcftCap09EvidencePreFormalOwnerRuntimeV1():Promise<void>{
 if(mode()===NON_OWNER_STANDBY_MODE){await runMcftCap09EvidenceNonOwnerStandbyV1();return;}
 const s=scope(); const subject=req("GEOX_DEPLOYMENT_SUBJECT_COMMIT");
 const runtimePath=req("GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_PATH");
 const ownerPath=req("GEOX_MCFT_CAP09_PRODUCTION_OWNER_CUTOVER_AUTHORITY_PATH");
 const raw=JSON.parse(fs.readFileSync(runtimePath,"utf8"));
 const handoffPath=req("GEOX_MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_AUTHORITY_PATH");
 const ownerAuthority=readMcftCap09OwnerCutoverAuthorityV1({authority_path:ownerPath,expected_deployment_subject_sha:subject,expected_scope:s});
 // The pre-arm Evidence epoch candidate is mandatory once this successor is deployed.
 // Current-crop validity remains lineage only for this planning seam; the exact base
 // runtime-start authority and owner identity remain digest/host bound.
 parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(raw,"EVIDENCE_RUNTIME",{
  deployment_subject_sha:subject,scope:s
 });
  if(raw?.runtime_mode!==OWNER_CUTOVER_MODE){
   throw new Error("MCFT_CAP09_PREFORMAL_EVIDENCE_HANDOFF_BASE_OWNER_MODE_REQUIRED");
  }
  if(String(raw?.host_id??"").trim()!==ownerAuthority.host_id){
   throw new Error("MCFT_CAP09_PREFORMAL_EVIDENCE_HANDOFF_BASE_HOST_MISMATCH");
  }
  const handoff=loadMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1({
   authority_path:handoffPath,
   expected:{
    deployment_subject_sha:subject,
    scope:s,
    base_runtime_start_authority_sha256:sha256FileV1(runtimePath),
   },
  });
  const handoffRuntimeStart={
   ...raw,
   authority_ref:handoff.authority_ref,
   activation_fence_time:handoff.activation_fence_time,
   formal_a0_authority_ref:handoff.formal_a0_authority_ref,
   formal_a0_authority_sha256:sha256FileV1(handoffPath),
   formal_a0_logical_time:handoff.formal_a0_logical_time,
  };
 await runMcftCap09ProductionEvidenceRuntimeV1({runtime_start_authority:handoffRuntimeStart});
}
