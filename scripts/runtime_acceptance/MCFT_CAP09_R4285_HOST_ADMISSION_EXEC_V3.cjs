// Independently versioned physical TEST_ONLY successor; preflight authority is rejected.
"use strict";
/*
 * R4285 Host Admission V2: final NON-CONSUMING dynamic verification boundary.
 * Not an execute entrypoint. An in-process V2 stable capability must have
 * previously been minted by a genuine Windows Native Adoption; no JSON cache.
 * A subsequent authorized version may wire independent atomic consumption,
 * but this file cannot consume anything.
 */
const assert=require("node:assert/strict"),fs=require("node:fs"),crypto=require("node:crypto");
const v2=require("./MCFT_CAP09_R4285_ADMISSION_EXEC_V3.cjs");
const v1=require("./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs");
const pg=require("./MCFT_CAP09_R4285_PG_READONLY_V3.cjs");
const owner=require("../governance_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_V3.cjs");
const lineage=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const fullParallel=require("./MCFT_CAP09_R4285_MATERIAL_FULL_PARALLEL_V2.cjs");
const verifiedFinal=new WeakMap();
function noUnsafeEnvironment(env){
 assert(!env.CI&&!env.GITHUB_ACTIONS&&!env.NODE_OPTIONS&&!env.NODE_PATH&&!env.PYTHONPATH&&!env.PYTHONHOME,
 "V3_HOST_INJECTED_ENV");
 assert(process.platform==="win32","V3_HOST_REQUIRES_WINDOWS");
 v1.hostOnly(env);
}
async function verifyDynamicReadOnly(s,{now=Date.now()}={}){
 require("./MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs").requireReceiver(s?.preparedState);
 assert(s.preparedState.execution===true,"V3_EXECUTION_FACTORY_REQUIRED");
 // Typed capability objects are in-process only. A forged status string fails
 // before the first live PG/S3 operation.
 assert(s&&s.stable&&s.intent&&s.ctx,"V3_HOST_STABLE_INPUT_REQUIRED");
 v2.requireStable(s.stable,s.intent,s.ctx,{now});
 noUnsafeEnvironment(s.environment);
 assert(s.nativeInput&&s.resourceEnvelope&&s.readback&&s.permitEnvelope&&
  s.permitProof&&s.finalEnvelope&&s.trust&&s.plan&&s.observations&&s.profile&&s.releaseBinding,
  "V3_HOST_ALL_ORIGINAL_BINDINGS_REQUIRED");
 assert.equal(s.nativeInput.release_root,s.releaseRoot,"V3_RELEASE_SPLIT");
 assert.equal(s.nativeInput.source_root,s.sourceRoot,"V3_SOURCE_SPLIT");
 const registeredTrust=JSON.parse(fs.readFileSync(s.nativeInput.trust_file,"utf8"));
 assert.deepEqual(s.trust,registeredTrust,"V3_TRUST_SUBSTITUTION");
 assert.equal(s.nativeInput.release_binding_sha256,s.ctx.release_binding_sha256);
 assert.equal(sha(fs.readFileSync(s.nativeInput.release_binding_file)),s.ctx.release_binding_sha256,
  "V3_RELEASE_BYTES_CHANGED");
 lineage.verifyExactMain(s.sourceRoot,s.ctx.subject_sha);
 v1.verifyBoundHostSources({release_root:s.releaseRoot},s.profile,s.releaseBinding);
 const readbackFile=owner.verifyReadbackFile(s.resourceReadbackFile,s.permitEnvelope.payload.resource_readback_sha256);
 assert.equal(readbackFile.sha256,s.readback.sha256,"V3_READBACK_FILE_SUBSTITUTION");
 owner.verify(s.resourceEnvelope,s.trust,{subject_sha:s.ctx.subject_sha,
  host_id:s.ctx.host_id,readback_sha256:s.readback.sha256,now:Date.now()});
 owner.bindSignedToReadback(s.resourceEnvelope.payload,s.readback);
 v1.checkResourceEnv(s.resourceEnvelope.payload,s.environment);
 v2.checkActualPermit(s.permitProof,s.permitEnvelope,s.resourceEnvelope,
  s.readback,s.observations,{...s.ctx,plan:s.plan},{now:Date.now()});
 await pg.probePreconsumePostgres({
  admission:{resourceEnvelope:s.resourceEnvelope,permitEnvelope:s.permitEnvelope,
   releaseRoot:s.releaseRoot},releaseRoot:s.releaseRoot,environment:s.environment,signal:s.preparedState.controller.signal});
 require("./MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs").requireReceiver(s.preparedState);
 await require("./MCFT_CAP09_R4285_PG_ACCOUNT_BINDING_V3.cjs").verify(s.releaseRoot,s.environment,s.resourceScope,s.preparedState.controller.signal);
 require("./MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs").requireReceiver(s.preparedState);
 const storage=await require("./MCFT_CAP09_R4285_S3_READONLY_V3.cjs").probe(s.releaseRoot,s.resourceEnvelope.payload,s.environment,s.preparedState.controller.signal);
 require("./MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs").requireReceiver(s.preparedState);
 // Full dynamic material/tool revalidation is charged to the Owner's 120s
 // before final CTO live refetch. This cannot be replaced by a WeakSet cache.
 const liveMaterial=await fullParallel.verify(s.profile,s.releaseRoot,s.environment);
 require("./MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs").requireReceiver(s.preparedState);
 assert.equal(liveMaterial.digest,s.ctx.material_digest,"V3_INSTALLED_MATERIAL_OR_TOOLS_DRIFT");
 // Final Ed25519 approval verifier performs another REAL GitHub native
 // CTO-intent refetch (fail closed if deleted/edited/expired).
 require("./MCFT_CAP09_R4285_PREPARE_LIVE_V3.cjs").refreshAuthority(s.preparedState);
 const final=v2.verifyFinal(s.finalEnvelope,s.trust,{
  stable:s.stable,intent:s.intent,permitProof:s.permitProof,
  permitEnv:s.permitEnvelope,ownerEnv:s.resourceEnvelope,
  readback:s.readback,observed:s.observations,ctx:{...s.ctx,plan:s.plan}});
 // Consumable authorization is intentionally NOT returned.
 const usedAt=Date.now();
 v2.checkActualPermit(s.permitProof,s.permitEnvelope,s.resourceEnvelope,s.readback,s.observations,{...s.ctx,plan:s.plan},{now:usedAt});
 v2.assertFinal(final,{
  nonce:s.ctx.nonce,permit_envelope_sha256:s.permitProof.envelope_sha256,
  resource_readback_sha256:s.readback.sha256,intent_sha256:s.intent.sha256},{now:usedAt});
 owner.assertDynamicFreshness(s.resourceEnvelope.payload,s.readback,{now:usedAt});
 const report=Object.freeze({status:"R4285_V3_FINAL_READONLY_BINDING_VERIFIED_NOT_PREFLIGHT_OR_EXECUTION",
  run_id:v2.RUN,subject_sha:s.ctx.subject_sha,s3:storage.status,
  owner_age_ms:usedAt-Date.parse(s.readback.facts.observed_at),
  permit_consumed:false,execute_authorized:false,production_authorized:false,stage_count:0});
 verifiedFinal.set(report,final);
 return report;
}
function requireVerifiedFinal(report){
 assert(verifiedFinal.has(report),"V3_FINAL_READONLY_HOST_CAPABILITY_REQUIRED");
 return verifiedFinal.get(report);
}
module.exports={verifyDynamicReadOnly,noUnsafeEnvironment,requireVerifiedFinal};
