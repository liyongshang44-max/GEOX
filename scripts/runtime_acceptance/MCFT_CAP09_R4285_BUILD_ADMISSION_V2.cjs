"use strict";
/* V2 exact successor of historical buildAdmission, no V1 Native/Permit call,
 * no signed-material substitution, no signer, no consumption.
 * V1 buildAdmission stays byte-for-byte intact. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const crypto=require("node:crypto");
const v1=require("./MCFT_CAP09_R4285_WINDOWS_HOST_V1.cjs");
const c=require("../cap09_adoption_v1/contract.cjs");
const native=require("../cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V2.cjs");
const lineage=require("../governance_acceptance/MCFT_CAP09_R4285_SIGNED_EVIDENCE_GATE_V1.cjs");
const resource=require("../governance_acceptance/MCFT_CAP09_R4285_RESOURCE_OWNER_V1.cjs");
const scheduler=require("./MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs");
const permit=require("./MCFT_CAP09_R4285_PERMIT_V2.cjs");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const RUN="4285c3ce342c";
function fileBytes(p,max=16*1024*1024){
 assert(typeof p==="string"&&path.isAbsolute(p),"V2_NATIVE_ABSOLUTE_INPUT");
 let cursor=path.resolve(p),level=0;
 for(;;){const st=fs.lstatSync(cursor);assert(!st.isSymbolicLink(),"V2_NATIVE_SYMLINK");
 if(level===0)assert(st.isFile()&&st.size>0&&st.size<=max,"V2_NATIVE_FILE");
 const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;level++;}
 return fs.readFileSync(p);
}
function json(p){return JSON.parse(fileBytes(p).toString("utf8").replace(/^\uFEFF/,""))}
function buildAdmissionV2(input,env=process.env,{verifiedNativeAdoption}={}){
 v1.hostOnly(env);
 const nativeInput=json(input.native_adoption_input_file);
 // A genuine in-process Native WeakSet capability may be carried forward from
 // the SAME Windows Host process, BEFORE physical Owner observation. No
 // serialized PASS, cross-process cache, or caller asserted boolean can skip it.
 const adoption=verifiedNativeAdoption===undefined?
  native.checkNativeAdoption(nativeInput):verifiedNativeAdoption;
 assert(native.isNativeVerified(adoption),"R4285_V2_NATIVE_IN_PROCESS_CAPABILITY_REQUIRED");
 assert.equal(nativeInput.source_root,input.source_root,"R4285_HOST_SOURCE_ROOT_SPLIT");
 assert.equal(path.resolve(nativeInput.release_root),path.resolve(input.release_root),
  "R4285_HOST_RELEASE_ROOT_SPLIT");
 lineage.verifyExactMain(input.source_root,adoption.subject_sha);
 const trust=json(nativeInput.trust_file),resEnv=json(input.resource_envelope_file);
 const resourceBytes=fileBytes(input.resource_readback_file);
 const resourceSha=sha(resourceBytes),readback=resource.verifyReadbackFile(input.resource_readback_file,resourceSha);
 const owner=resource.verify(resEnv,trust,{subject_sha:adoption.subject_sha,
  host_id:lineage.HOST,readback_sha256:resourceSha,now:Date.now()});
 resource.bindSignedToReadback(resEnv.payload,readback);
 resource.assertDynamicFreshness(resEnv.payload,readback);
 assert.equal(owner.run_id,RUN);
 v1.checkResourceEnv(resEnv.payload,env);
 const plan=json(input.plan_file),observed=json(input.observations_file);
 scheduler.validateStagePlan(plan);
 const signedInput=json(nativeInput.signed_evidence_input_file).signed_evidence;
 assert.equal(signedInput.source_root,input.source_root);
 const lineageEnv=json(signedInput.lineage_envelope_file);
 const ownerEnv=json(nativeInput.owner_envelope_file);
 const adoptionEnv=json(nativeInput.adoption_envelope_file);
 const histSha=signedInput.fullchain_attestation_sha256;
 const context={subject_sha:adoption.subject_sha,protected_main_sha:adoption.subject_sha,
  source_clean:true,host_id:lineage.HOST,
  inventory_sha256:sha(fileBytes(nativeInput.inventory_file)),
  authority_registry_sha256:sha(fileBytes(nativeInput.authority_registry_file)),
  owner_envelope_sha256:sha(Buffer.from(lineage.canonical(ownerEnv))),
  lineage_envelope_sha256:sha(Buffer.from(lineage.canonical(lineageEnv))),
  adoption_envelope_sha256:sha(Buffer.from(lineage.canonical(adoptionEnv))),
  qcp72_raw_sha256:sha(fileBytes(nativeInput.qcp_raw_file)),
  installed_material_digest:adoption.material_digest,
  release_binding_sha256:sha(fileBytes(nativeInput.release_binding_file)),
  resource_owner_envelope_sha256:sha(Buffer.from(lineage.canonical(resEnv))),
  resource_readback_sha256:resourceSha,
  historic_fullchain_attestation_sha256:histSha,
  plan_sha256:c.digest(plan),observations_sha256:c.digest(observed),
  adoption_expires_at:adoptionEnv.payload.expires_at,
  resource_owner_expires_at:resEnv.payload.expires_at,
  total_stage_budget_ms:plan.stages.reduce((n,s)=>n+s.timeout_ms,0)};
 const permitEnv=json(input.permit_envelope_file);
 const permitProof=permit.verifyReadOnly(permitEnv,trust,context);
 assert(permit.isVerified(permitProof));
 const profile=json(nativeInput.material_file);
 v1.verifyBoundHostSources(input,profile,json(nativeInput.release_binding_file));
 const steps=v1.resolveStages({input,profile,permitPayload:permitEnv.payload,trust,plan,observed,env});
 return Object.freeze({adoption,permitProof,permitEnv,context,
  trust,resEnv,plan,observed,steps,profile,nativeInput,readback});
}
module.exports={buildAdmissionV2};
