import fs from "node:fs";
import os from "node:os";

import { createDatabasePool } from "../infra/database.js";
import { assertMcftCap09ServicePrincipalV1 } from "../infra/mcft_cap09_phase5_service_principal_v1.js";
import { createMcftCap09ProcessStopV1 } from "./mcft_cap09_production_process_lifecycle_v1.js";
import { buildMcftCap09ProductionLeaseOwnerV1 } from "./mcft_cap09_production_service_identity_v1.js";
import { parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1 } from "./mcft_cap09_production_runtime_start_authority_v1.js";
import { readMcftCap09OwnerCutoverAuthorityV1, type McftCap09OwnerCutoverScopeV1 } from "./mcft_cap09_production_owner_cutover_authority_v1.js";
import { loadMcftCap09ProductionStageAuthorityMountsV1 } from "./twin_runtime/mcft_cap09_twin_runtime_process_v1.js";
import { runMcftCap09TwinPreFormalOwnerStandbyV1 } from "./twin_runtime/mcft_cap09_twin_preformal_owner_standby_v1.js";

function req(name:string):string{const v=String(process.env[name]??"").trim();if(!v)throw new Error("MCFT_CAP09_TWIN_PREFORMAL_ENV_REQUIRED:"+name);return v;}
function scope():McftCap09OwnerCutoverScopeV1{return {
 tenant_id:req("GEOX_MCFT_CAP09_TENANT_ID"),project_id:req("GEOX_MCFT_CAP09_PROJECT_ID"),group_id:req("GEOX_MCFT_CAP09_GROUP_ID"),
 field_id:req("GEOX_MCFT_CAP09_FIELD_ID"),season_id:req("GEOX_MCFT_CAP09_SEASON_ID"),zone_id:req("GEOX_MCFT_CAP09_ZONE_ID")
};}

export async function runMcftCap09TwinPreFormalOwnerRuntimeV1():Promise<void>{
 const s=scope(); const subject=req("GEOX_DEPLOYMENT_SUBJECT_COMMIT");
 const runtimePath=req("GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_PATH");
 const ownerPath=req("GEOX_MCFT_CAP09_PRODUCTION_OWNER_CUTOVER_AUTHORITY_PATH");
 const raw=JSON.parse(fs.readFileSync(runtimePath,"utf8"));
 const runtime=parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(raw,"TWIN_RUNTIME",{deployment_subject_sha:subject,scope:s});
 readMcftCap09OwnerCutoverAuthorityV1({authority_path:ownerPath,expected_deployment_subject_sha:subject,expected_scope:s});
 loadMcftCap09ProductionStageAuthorityMountsV1({
   runtime_start_authority:runtime,
   current_crop_authority_path:req("GEOX_MCFT_CAP09_TWIN_RUNTIME_CURRENT_CROP_AUTHORITY_PATH"),
   biological_stage_architecture_effectiveness_path:req("GEOX_MCFT_CAP09_TWIN_RUNTIME_BIOLOGICAL_STAGE_ARCHITECTURE_EFFECTIVENESS_PATH"),
 });
 const serviceId=req("GEOX_MCFT_CAP09_TWIN_RUNTIME_SERVICE_ID");
 const leaseOwner=buildMcftCap09ProductionLeaseOwnerV1({plane:"TWIN_RUNTIME",configured_service_id:serviceId,instance_id:String(process.env.HOSTNAME??os.hostname()).trim()});
 const leaseSeconds=Number(String(process.env.GEOX_MCFT_CAP09_TWIN_RUNTIME_LEASE_DURATION_SECONDS??"300"));
 const pool=createDatabasePool(req("GEOX_MCFT_CAP09_TWIN_RUNTIME_DATABASE_URL"));
 const stop=createMcftCap09ProcessStopV1();
 try{
   await assertMcftCap09ServicePrincipalV1(pool,"TWIN_RUNTIME");
   await runMcftCap09TwinPreFormalOwnerStandbyV1({pool,scope:s,lease_owner:leaseOwner,lease_duration_seconds:leaseSeconds,stop_requested:()=>stop.stopRequested()});
 } finally {stop.dispose();await pool.end();}
}
