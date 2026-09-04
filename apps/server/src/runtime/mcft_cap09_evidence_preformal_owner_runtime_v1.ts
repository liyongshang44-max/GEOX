import fs from "node:fs";

import { runMcftCap09ProductionEvidenceRuntimeV1 } from "../external_evidence/mcft_cap09_evidence_runtime_process_v1.js";
import { parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1 } from "./mcft_cap09_production_runtime_start_authority_v1.js";
import { readMcftCap09OwnerCutoverAuthorityV1, type McftCap09OwnerCutoverScopeV1 } from "./mcft_cap09_production_owner_cutover_authority_v1.js";

function req(name:string):string{const v=String(process.env[name]??"").trim();if(!v)throw new Error("MCFT_CAP09_EVIDENCE_PREFORMAL_ENV_REQUIRED:"+name);return v;}
function scope():McftCap09OwnerCutoverScopeV1{return {
 tenant_id:req("GEOX_MCFT_CAP09_TENANT_ID"),project_id:req("GEOX_MCFT_CAP09_PROJECT_ID"),group_id:req("GEOX_MCFT_CAP09_GROUP_ID"),
 field_id:req("GEOX_MCFT_CAP09_FIELD_ID"),season_id:req("GEOX_MCFT_CAP09_SEASON_ID"),zone_id:req("GEOX_MCFT_CAP09_ZONE_ID")
};}

export async function runMcftCap09EvidencePreFormalOwnerRuntimeV1():Promise<void>{
 const s=scope(); const subject=req("GEOX_DEPLOYMENT_SUBJECT_COMMIT");
 const runtimePath=req("GEOX_MCFT_CAP09_PRODUCTION_RUNTIME_START_AUTHORITY_PATH");
 const ownerPath=req("GEOX_MCFT_CAP09_PRODUCTION_OWNER_CUTOVER_AUTHORITY_PATH");
 const raw=JSON.parse(fs.readFileSync(runtimePath,"utf8"));
 parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(raw,"EVIDENCE_RUNTIME",{deployment_subject_sha:subject,scope:s});
 readMcftCap09OwnerCutoverAuthorityV1({authority_path:ownerPath,expected_deployment_subject_sha:subject,expected_scope:s});
 await runMcftCap09ProductionEvidenceRuntimeV1({runtime_start_authority:raw});
}
