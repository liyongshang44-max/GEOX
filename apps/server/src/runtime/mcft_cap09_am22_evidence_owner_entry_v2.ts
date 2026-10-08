import fs from "node:fs";
import path from "node:path";
import { runMcftCap09EvidencePreFormalOwnerRuntimeV2 } from "./mcft_cap09_evidence_preformal_owner_runtime_v2.js";
const policyPath=path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM22-EFFECTIVE-START-AUTHORITY-V2.json");
const policy=JSON.parse(fs.readFileSync(policyPath,"utf8"));
if(policy.status!=="EFFECTIVE_ON_PROTECTED_MAIN" || policy.production_start_authorized!==true) {
  throw new Error("AM22_EFFECTIVE_PRODUCTION_QUALIFICATION_REQUIRED");
}
runMcftCap09EvidencePreFormalOwnerRuntimeV2().catch((error)=>{
 console.error(error instanceof Error ? error.message : String(error)); process.exitCode=1;
});
