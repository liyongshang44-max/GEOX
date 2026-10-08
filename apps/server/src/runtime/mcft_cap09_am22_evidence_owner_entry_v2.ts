import { requireEffectiveAm22StartPolicyV2 } from "./mcft_cap09_am22_effective_start_guard_v2.js";
import { runMcftCap09EvidencePreFormalOwnerRuntimeV2 } from "./mcft_cap09_evidence_preformal_owner_runtime_v2.js";
requireEffectiveAm22StartPolicyV2();
runMcftCap09EvidencePreFormalOwnerRuntimeV2().catch((error)=>{
 console.error(error instanceof Error ? error.message : String(error)); process.exitCode=1;
});
