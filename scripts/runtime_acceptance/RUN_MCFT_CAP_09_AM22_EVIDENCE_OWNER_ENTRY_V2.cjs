"use strict";
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {effectivePolicy,req,ROOT}=require("./MCFT_CAP_09_AM22_START_CHAIN_V2.cjs");
const {loadExecutionQualification}=require("./MCFT_CAP_09_AM22_EXECUTION_QUALIFICATION_V2.cjs");
async function main(){
 const policy=loadExecutionQualification(effectivePolicy(),{execution_qualification_file:process.env.GEOX_MCFT_CAP09_AM22_EXECUTION_QUALIFICATION_PATH},new Date().toISOString());
 req(policy.qualified_subject_sha===process.env.GEOX_DEPLOYMENT_SUBJECT_COMMIT&&policy.qualified_image_id===process.env.GEOX_MCFT_CAP09_AM22_EXECUTION_IMAGE_ID,"PROCESS_EXECUTION_BINDING_MISMATCH");
 const runtime=await import(pathToFileURL(path.join(ROOT,"apps/server/src/runtime/mcft_cap09_evidence_preformal_owner_runtime_v2.ts")).href);
 await runtime.runMcftCap09EvidencePreFormalOwnerRuntimeV2();
}
main().catch(error=>{console.error(/^AM22_|^MCFT_CAP09_/.test(error.message)?error.message:"AM22_OWNER_ADMISSION_REJECTED");process.exitCode=1;});
