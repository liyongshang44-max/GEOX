'use strict';
// Proof-consuming context for the existing real host. Never signs or consumes permits.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const c=require('./contract.cjs'),material=require('./installed-material.cjs');
const POLICY=path.join(__dirname,'offline-trust.json');
const DOMAIN='GEOX_CAP09_ADOPTED_EXECUTION_CONTEXT_V1\n';
const ADOPTION_DOMAIN='GEOX_MCFT_CAP09_ADOPTION_QUALIFICATION_V1\n';
const QCP_REL='docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json';
const ENGINEERING_ONLY_CHECK='A44_ADOPTION_QUALIFICATION_LOCAL_EXECUTION_ADMISSION_ENGINEERING_ONLY';
// These are the implementations replacing the four legacy controller-adoption flags.
// They must occur in the signed release inventory, not merely in an installed profile.
const REQUIRED_STAGE_MATERIAL=Object.freeze([
 'MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs',
 'RUN_MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V2.ts',
 'RUN_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_V2.ts',
 'MCFT_CAP09_REAL_CONTROLLED_DELAY_V1.cjs',
 'AGGREGATE_MCFT_CAP_09_V13_EXACT_HEAD_TIMING_MEASUREMENT_V2.ts',
 'MCFT_CAP09_SIX_STAGE_SCHEDULER_V1.cjs',
 'MCFT_CAP09_STAGE_CAPABILITY_V1.cjs',
 'MCFT_CAP09_PARENT_STAGE_DISPATCH_V1.cjs',
 'MCFT_CAP09_REAL_PROVIDER_RESPONSE_DELAY_V1.cjs',
 'MCFT_CAP09_REAL_PIPELINE_DELAY_V1.cjs',
 'MCFT_CAP09_RETRY_PERMIT_V1.cjs',
 'MCFT_CAP09_STAGE_RECEIPTS_V1.cjs',
 'MCFT_CAP09_STAGE_START_CLOCK_V1.cjs'
].map(file=>'scripts/runtime_acceptance/'+file));
const verifiedFormalContexts=new WeakSet();

function safeRef(root,rel){
 assert(typeof rel==='string'&&rel.length>0&&!path.isAbsolute(rel)&&!rel.includes('\\'),'OFFLINE_EVIDENCE_PATH_INVALID');
 const parts=rel.split('/');assert(parts.every(x=>x&&x!=='.'&&x!=='..'&&/^[A-Za-z0-9_.-]+$/.test(x)),'OFFLINE_EVIDENCE_PATH_INVALID');
 const file=path.join(root,...parts);c.noLinks(file);return file;
}
function validateStaticPolicy(policy,now){
 c.exact(policy,['schema','activation_mode','adopted','subject_sha','host_id','operator_id','valid_until','checks','allowed_not_applicable_ids','issuers']);
 assert.equal(policy.schema,'CAP09_OFFLINE_ADOPTION_TRUST_V1');
 assert.equal(policy.activation_mode,'SIGNED_ADOPTION_REQUIRED');
 // Repository defaults remain visibly disabled; the signed qualification is the activation fact.
 assert.equal(policy.adopted,false,'STATIC_POLICY_MUST_NOT_SELF_ACTIVATE');
 assert.equal(policy.subject_sha,null,'STATIC_POLICY_MUST_NOT_PIN_MUTABLE_SUBJECT');
 assert(c.epoch(policy.valid_until)>now,'OFFLINE_POLICY_EXPIRED');
 assert(Array.isArray(policy.checks)&&policy.checks.length===54,'OFFLINE_CHECK_POLICY_INCOMPLETE');
 assert.equal(new Set(policy.checks.map(x=>x.check_id)).size,54,'OFFLINE_CHECK_POLICY_DUPLICATE');
 for(const x of policy.checks){
  c.exact(x,['check_id','check_revision','allow_not_applicable']);c.id(x.check_id);
  assert.equal(x.check_revision,'LOCAL_QCP_DEFINITION_SHA256');
  assert(typeof x.allow_not_applicable==='boolean','OFFLINE_CHECK_POLICY_INVALID');
 }
 assert(Array.isArray(policy.allowed_not_applicable_ids),'OFFLINE_NA_POLICY_REQUIRED');
 const allowed=new Set(policy.allowed_not_applicable_ids);
 assert.equal(allowed.size,policy.allowed_not_applicable_ids.length,'OFFLINE_NA_POLICY_DUPLICATE');
 for(const id of allowed)assert(policy.checks.some(x=>x.check_id===id&&x.allow_not_applicable===true),'OFFLINE_NA_POLICY_INVALID');
 assert(Array.isArray(policy.issuers)&&policy.issuers.length>0,'OFFLINE_ISSUER_REQUIRED');
}
function verifySignature(envelope,policy,domain){
 const q=envelope.payload;
 const issuers=policy.issuers.filter(x=>x.issuer_id===q.issuer_id&&x.key_id===q.key_id&&x.purpose==='ADOPTION');
 assert.equal(issuers.length,1,'OFFLINE_UNKNOWN_ISSUER');const i=issuers[0];assert.equal(i.revoked,false,'OFFLINE_ISSUER_REVOKED');
 assert(['ACCOUNTABLE_SINGLE_OPERATOR','INDEPENDENT_GOVERNANCE'].includes(i.role),'OFFLINE_ISSUER_ROLE_INVALID');
 if(i.role==='INDEPENDENT_GOVERNANCE')assert.notEqual(i.issuer_id,policy.operator_id,'OFFLINE_INDEPENDENCE_REQUIRED');
 assert(c.epoch(i.not_before)<=c.epoch(q.issued_at)&&c.epoch(q.expires_at)<=c.epoch(i.not_after),'OFFLINE_KEY_LIFETIME_INVALID');
 const key=crypto.createPublicKey(i.public_key_pem);assert.equal(key.asymmetricKeyType,'ed25519');
 assert.equal(c.sha(key.export({type:'spki',format:'der'})),i.spki_sha256,'OFFLINE_KEY_FINGERPRINT_INVALID');
 const sig=Buffer.from(envelope.signature_base64,'base64');assert.equal(sig.length,64);assert.equal(sig.toString('base64'),envelope.signature_base64,'OFFLINE_SIGNATURE_ENCODING_INVALID');
 assert(crypto.verify(null,Buffer.from(domain+c.canonical(q)),key,sig),'OFFLINE_BAD_SIGNATURE');
}
function verifyReleaseSourceBinding(release,profile){
 assert(Array.isArray(release.files)&&release.files.length>=108,'OFFLINE_RELEASE_FILES_INCOMPLETE');
 assert.equal(release.content_inventory_sha256,c.digest(release.files),'OFFLINE_RELEASE_INVENTORY_DIGEST_CHANGED');
 assert(Array.isArray(profile.files)&&profile.files.length>0,'OFFLINE_INSTALLED_FILES_REQUIRED');
 const materialFiles=new Map(profile.files.map(row=>[row.path,row.sha256]));
 const seen=new Set();
 for(const row of release.files){
  assert(row&&typeof row.path==='string'&&!row.path.startsWith('/')&&!row.path.includes('\\')&&!row.path.includes(':')&&
   row.path.split('/').every(part=>part&&part!=='.'&&part!=='..'),'OFFLINE_RELEASE_PATH_INVALID');
  assert(!seen.has(row.path.toLowerCase()),'OFFLINE_RELEASE_PATH_DUPLICATE');seen.add(row.path.toLowerCase());
  c.hash(row.sha256);
  assert.equal(materialFiles.get(row.path),row.sha256,'OFFLINE_RELEASE_SOURCE_DRIFT:'+row.path);
 }
 assert(seen.has(QCP_REL.toLowerCase()),'OFFLINE_RELEASE_QCP_NOT_BOUND');
 for(const file of REQUIRED_STAGE_MATERIAL)assert(release.files.some(row=>row.path===file),'OFFLINE_STAGE_MATERIAL_NOT_BOUND:'+file);
}

// Distinct, fail-closed contract for zero-delta merged QCP evidence.
// Call from both signing and offline verification; do not rewrite source QCP.
const MERGED_FIELDS=Object.freeze(['qualification_method','qcp_execution_subject_sha','merge_derivation_ref','merge_derivation_sha256','qcp_executed_at_subject','raw_reports_rewritten']);
function validateMergedDerivation(subject,proof,checks,evidenceRoot,candidate=null){
 const derived=proof.qualification_method==='ZERO_DELTA_MERGE_DERIVATION';
 if(!derived){
  assert(!Object.keys(proof).some(k=>MERGED_FIELDS.includes(k)),'OFFLINE_UNEXPECTED_MERGE_PROOF_FIELDS');
  if(candidate)assert(!Object.keys(candidate).some(k=>MERGED_FIELDS.includes(k)),'OFFLINE_UNEXPECTED_MERGE_CANDIDATE_FIELDS');
  return false;
 }
 function fields(x){for(const k of MERGED_FIELDS)assert(Object.hasOwn(x,k),'OFFLINE_MERGE_FIELD_MISSING:'+k);}
 fields(proof);if(candidate){fields(candidate);for(const k of MERGED_FIELDS)assert.deepEqual(candidate[k],proof[k],'OFFLINE_MERGE_CANDIDATE_PROOF_MISMATCH:'+k);}
 assert.equal(proof.qcp_executed_at_subject,false,'OFFLINE_MERGE_EXECUTION_MISREPRESENTED');
 assert.equal(proof.raw_reports_rewritten,false,'OFFLINE_MERGE_RAW_REWRITTEN');
 assert(/^[a-f0-9]{40}$/.test(proof.qcp_execution_subject_sha)&&proof.qcp_execution_subject_sha!==subject,'OFFLINE_MERGE_SOURCE_INVALID');
 c.hash(proof.merge_derivation_sha256);
 const mergeFile=safeRef(evidenceRoot,proof.merge_derivation_ref);
 assert.equal(c.sha(fs.readFileSync(mergeFile)),proof.merge_derivation_sha256,'OFFLINE_MERGE_DERIVATION_DRIFT');
 const m=c.read(mergeFile);
 c.exact(m,['schema','subject_sha','source_subject_sha','base_sha','observed_main_sha','source_and_subject_tree','parents','source_artifact_id','source_workflow_run_id','source_artifact_sha256','source_metadata_sha256','generator_sources_sha256','method','qcp_executed_at_subject','raw_reports_rewritten','additional_first_parent_hops','execution_authorized','production_authorized']);
 assert.equal(m.schema,'MCFT_CAP09_ZERO_DELTA_MERGE_QCP_DERIVATION_V1');
 assert.equal(m.subject_sha,subject);assert.equal(m.source_subject_sha,proof.qcp_execution_subject_sha);
 assert.equal(m.method,'EXACT_TWO_PARENT_ZERO_TREE_DELTA_WITH_VALIDATED_SOURCE_QCP');
 assert.deepEqual(m.parents,[m.base_sha,m.source_subject_sha]);assert(/^[a-f0-9]{40}$/.test(m.observed_main_sha),'OFFLINE_MERGE_OBSERVED_MAIN_INVALID');
 assert(/^[a-f0-9]{40}$/.test(m.base_sha));assert(/^[a-f0-9]{40}$/.test(m.source_and_subject_tree));
 assert.equal(m.additional_first_parent_hops,1);assert.equal(m.qcp_executed_at_subject,false);assert.equal(m.raw_reports_rewritten,false);
 assert.equal(m.execution_authorized,false);assert.equal(m.production_authorized,false);
 c.hash(m.source_artifact_sha256);c.hash(m.source_metadata_sha256);
 assert(Number.isSafeInteger(m.source_artifact_id)&&m.source_artifact_id>0);
 assert(Number.isSafeInteger(m.source_workflow_run_id)&&m.source_workflow_run_id>0);
 c.exact(m.generator_sources_sha256,['build_evidence.py','material_binding.py']);
 for(const hash of Object.values(m.generator_sources_sha256))c.hash(hash);
 const metadataFile=safeRef(evidenceRoot,'source-metadata.json'),archiveFile=safeRef(evidenceRoot,'source-qcp-artifact.zip');
 const metadata=fs.readFileSync(metadataFile),archive=fs.readFileSync(archiveFile);
 assert.equal(c.sha(archive),m.source_artifact_sha256,'OFFLINE_MERGE_SOURCE_ARTIFACT_DRIFT');
 const meta=c.read(metadataFile);
 assert.equal(c.digest(meta),m.source_metadata_sha256,'OFFLINE_MERGE_SOURCE_METADATA_DRIFT');
 assert.equal(meta.schema,'MCFT_CAP09_MERGED_QCP_SOURCE_V1');
 assert.equal(meta.repository,'liyongshang44-max/GEOX');
 assert.equal(meta.observed_main_sha,m.observed_main_sha,'OFFLINE_MERGE_OBSERVED_MAIN_MISMATCH');
 assert.equal(meta.pull_request?.merged,true);assert.equal(meta.pull_request?.base_ref,'main');
 assert.equal(meta.pull_request?.merge_commit_sha,subject);assert.equal(meta.pull_request?.head_sha,m.source_subject_sha);
 assert.equal(meta.pull_request?.base_sha,m.base_sha);
 assert.equal(meta.workflow_run?.id,m.source_workflow_run_id);
 assert.equal(meta.workflow_run?.head_sha,m.source_subject_sha);
 assert.equal(meta.workflow_run?.status,'completed');assert.equal(meta.workflow_run?.conclusion,'success');
 assert.equal(meta.workflow_run?.path,'.github/workflows/mcft-cap-09-qualification-control-plane-v1.yml');
 assert.equal(meta.artifact?.id,m.source_artifact_id);
 assert.equal(meta.artifact?.digest,'sha256:'+m.source_artifact_sha256);
 assert.equal(meta.artifact?.expired,false);
 assert.equal(proof.qcp_artifact_sha256,m.source_artifact_sha256,'OFFLINE_MERGE_PROOF_ARTIFACT_MISMATCH');
 assert(Number.isSafeInteger(proof.first_parent_hop_count)&&proof.first_parent_hop_count>=2,'OFFLINE_MERGE_PROOF_HOPS_INVALID');
 for(const x of checks){
  const file=safeRef(evidenceRoot,x.evidence_ref),ev=c.read(file);
  for(const k of MERGED_FIELDS)assert.deepEqual(ev[k],proof[k],'OFFLINE_MERGE_CHECK_NOT_BOUND:'+x.check_id+':'+k);
  assert.equal(ev.qcp_artifact_sha256,m.source_artifact_sha256);
 }
 return true;
}

function validateFormal(request,policy,root,{now=Date.now(),host=os.hostname(),environment=process.env}={}){
 validateStaticPolicy(policy,now);
 c.exact(request,['qualification','material','evidence_root']);
 const envelope=request.qualification;c.exact(envelope,['payload','signature_base64']);const q=envelope.payload;
 c.exact(q,['qualification_id','schema','subject_sha','scope','issued_at','expires_at','issuer_id','key_id','policy_digest','material_digest','checks','frozen_paths','first_parent_proven','host_id','operator_id','qcp_proof_ref','qcp_proof_sha256','release_binding_ref','release_binding_sha256']);
 assert.equal(q.schema,'MCFT_CAP09_ADOPTION_QUALIFICATION_V1');c.id(q.qualification_id);
 assert.equal(q.scope,'TEST_ONLY');assert(/^[a-f0-9]{40}$/.test(q.subject_sha),'OFFLINE_SUBJECT_INVALID');
 assert.equal(q.policy_digest,c.digest(policy),'OFFLINE_POLICY_DRIFT');
 assert.equal(q.host_id,host,'OFFLINE_WRONG_HOST');assert.equal(q.host_id,policy.host_id,'OFFLINE_POLICY_HOST_MISMATCH');
 assert.equal(q.operator_id,policy.operator_id,'OFFLINE_OPERATOR_MISMATCH');
 c.window(q,now,86400000);assert(c.epoch(q.expires_at)<=c.epoch(policy.valid_until),'OFFLINE_QUALIFICATION_OUTLIVES_POLICY');
 assert.equal(q.frozen_paths,108,'OFFLINE_FROZEN_SCOPE_INVALID');assert.equal(q.first_parent_proven,true,'OFFLINE_FIRST_PARENT_REQUIRED');
 c.hash(q.qcp_proof_sha256);c.hash(q.release_binding_sha256);c.hash(q.material_digest);

 const qcp=c.read(path.join(root,...QCP_REL.split('/')));
 assert(Array.isArray(qcp.checks)&&qcp.checks.length===55,'OFFLINE_LOCAL_QCP_SET_CHANGED');
 const definitions=new Map(qcp.checks.map(x=>[x.check_id,x]));
 const policyIds=policy.checks.map(x=>x.check_id),extras=qcp.checks.map(x=>x.check_id).filter(x=>!policyIds.includes(x));
 assert.deepEqual(extras,[ENGINEERING_ONLY_CHECK],'OFFLINE_LOCAL_QCP_EXTRA_SET_CHANGED');
 assert(policyIds.every(id=>definitions.has(id)),'OFFLINE_LOCAL_QCP_CHECK_MISSING');
 assert(Array.isArray(q.checks)&&q.checks.length===54,'OFFLINE_CHECKS_INCOMPLETE');
 const seen=new Set(),allowedNA=new Set(policy.allowed_not_applicable_ids);
 for(const x of q.checks){
  c.exact(x,['check_id','revision','result','reason','evidence_ref','sha256']);
  const declared=policy.checks.find(p=>p.check_id===x.check_id),definition=definitions.get(x.check_id);
  assert(declared&&definition&&!seen.has(x.check_id),'OFFLINE_CHECK_MISSING_OR_DUPLICATE');seen.add(x.check_id);
  c.hash(x.revision);assert.equal(x.revision,c.digest(definition),'OFFLINE_CHECK_REVISION_CHANGED');
  const accepted=x.result==='PASS'||(x.result==='NOT_APPLICABLE'&&declared.allow_not_applicable===true&&allowedNA.has(x.check_id)&&typeof x.reason==='string'&&x.reason.trim());
  assert(accepted,'OFFLINE_CHECK_BLOCKED');assert(typeof x.reason==='string','OFFLINE_CHECK_REASON_REQUIRED');c.hash(x.sha256);
  const file=safeRef(request.evidence_root,x.evidence_ref);assert.equal(c.sha(fs.readFileSync(file)),x.sha256,'OFFLINE_EVIDENCE_DRIFT');
  const evidence=c.read(file);
  assert.equal(evidence.schema,'MCFT_CAP09_ADOPTION_CHECK_EVIDENCE_V1');assert.equal(evidence.subject_sha,q.subject_sha);
  assert.equal(evidence.check_id,x.check_id);assert.equal(evidence.revision,x.revision);assert.equal(evidence.result,x.result);
 }
 assert.equal(seen.size,54,'OFFLINE_CHECKS_INCOMPLETE');

 const qcpProofFile=safeRef(request.evidence_root,q.qcp_proof_ref);
 assert.equal(c.sha(fs.readFileSync(qcpProofFile)),q.qcp_proof_sha256,'OFFLINE_QCP_PROOF_DRIFT');
 const proof=c.read(qcpProofFile);
 assert.equal(proof.schema,'MCFT_CAP09_FINAL_QCP_ADOPTION_PROOF_V1');assert.equal(proof.subject_sha,q.subject_sha);
 assert.equal(proof.status,'PASS');assert.equal(proof.total_checks,55);assert.equal(proof.adoption_checks,54);assert.equal(proof.blocker_count,0);
 validateMergedDerivation(q.subject_sha,proof,q.checks,request.evidence_root);
 const releaseFile=safeRef(request.evidence_root,q.release_binding_ref);
 assert.equal(c.sha(fs.readFileSync(releaseFile)),q.release_binding_sha256,'OFFLINE_RELEASE_BINDING_DRIFT');
 const release=c.read(releaseFile);assert.equal(release.schema_version,'MCFT_CAP09_RELEASE_MATERIAL_BINDING_V1');assert.equal(release.subject_commit_sha,q.subject_sha);

 assert.equal(q.material_digest,c.digest(request.material),'OFFLINE_MATERIAL_BINDING_CHANGED');
 const checked=material.verify(request.material,root,environment);
 verifyReleaseSourceBinding(release,request.material);
 return {q,checked};
}
// Shared signer/verifier rule. Operator eligibility requires an explicit, digest-bound
// registration scope; merely registering an operator key never enables formal Adoption.
function assertFormalIssuer(issuer,policy,q){
 assert.equal(issuer.purpose,'ADOPTION','OFFLINE_ADOPTION_PURPOSE_REQUIRED');
 assert.equal(issuer.revoked,false,'OFFLINE_ISSUER_REVOKED');
 if(issuer.role==='INDEPENDENT_GOVERNANCE'){
  assert.notEqual(issuer.issuer_id,policy.operator_id,'OFFLINE_INDEPENDENCE_REQUIRED');return;
 }
 assert(issuer.role==='ACCOUNTABLE_SINGLE_OPERATOR'&&issuer.issuer_id===policy.operator_id&&issuer.formal_adoption_scope,'OFFLINE_INDEPENDENT_ADOPTION_ISSUER_REQUIRED');
 const scope=issuer.formal_adoption_scope;
 c.exact(scope,['subject_sha','material_digest','host_id','operator_id','scope']);
 assert.equal(scope.scope,'TEST_ONLY','OFFLINE_OPERATOR_SCOPE_INVALID');
 for(const key of ['subject_sha','material_digest','host_id','operator_id','scope'])assert.equal(q[key],scope[key],'OFFLINE_OPERATOR_SCOPE_MISMATCH');
 assert.equal(scope.host_id,policy.host_id,'OFFLINE_OPERATOR_HOST_MISMATCH');
 assert.equal(scope.operator_id,policy.operator_id,'OFFLINE_OPERATOR_ID_MISMATCH');
}
function verifyFormal(request,policy,root,options={}){
 const {q,checked}=validateFormal(request,policy,root,options);
 const issuers=policy.issuers.filter(x=>x.issuer_id===q.issuer_id&&x.key_id===q.key_id&&x.purpose==='ADOPTION');
 assert.equal(issuers.length,1,'OFFLINE_INDEPENDENT_ADOPTION_ISSUER_REQUIRED');
 assertFormalIssuer(issuers[0],policy,q);
 verifySignature(request.qualification,policy,ADOPTION_DOMAIN);
 const now=options.now??Date.now(),host=options.host??os.hostname(),environment=options.environment??process.env;
 const result=Object.freeze({head:q.subject_sha,main:q.subject_sha,clean:true,base_ancestor:true,frozen_runtime_identical:true,
  host_id:host,now:new Date(now).toISOString(),platform:process.platform,ci:Boolean(environment.CI||environment.GITHUB_ACTIONS),
  source:'SIGNED_ADOPTION_NOT_LIVE_REMOTE_MAIN',scope:'TEST_ONLY',adoption_digest:c.digest(request.qualification),material_digest:checked.digest,
  qualification_id:q.qualification_id,qualification_expires_at:q.expires_at,execution_authorized:true,production_authorized:false});
 verifiedFormalContexts.add(result);return result;
}

// Retained candidate verifier for synthetic tests only. It is unreachable from the fixed production policy.
function verifyLegacy(request,policy,root,{now=Date.now(),host=os.hostname(),environment=process.env}={}){
 assert.equal(policy.adopted,true,'OFFLINE_ADOPTION_NOT_ADOPTED');
 assert.equal(policy.schema,'CAP09_OFFLINE_ADOPTION_TRUST_V1');assert(c.epoch(policy.valid_until)>now,'OFFLINE_POLICY_EXPIRED');
 c.exact(request,['qualification','material','evidence_root']);
 const envelope=request.qualification;c.exact(envelope,['payload','signature_base64']);const q=envelope.payload;
 c.exact(q,['schema','subject_sha','scope','issued_at','expires_at','issuer_id','key_id','policy_digest','material_digest','checks','frozen_paths','first_parent_proven','host_id','operator_id']);
 assert.equal(q.schema,'CAP09_ADOPTED_EXECUTION_CONTEXT_V1');assert.equal(q.scope,'TEST_ONLY');
 assert.equal(q.subject_sha,policy.subject_sha);assert(/^[a-f0-9]{40}$/.test(q.subject_sha));
 assert.equal(q.policy_digest,c.digest(policy),'OFFLINE_POLICY_DRIFT');assert.equal(q.host_id,host,'OFFLINE_WRONG_HOST');assert.equal(q.host_id,policy.host_id);
 assert.equal(q.operator_id,policy.operator_id);c.window(q,now,86400000);assert(c.epoch(q.expires_at)<=c.epoch(policy.valid_until));
 verifySignature(envelope,{...policy,issuers:policy.issuers.map(x=>({...x,purpose:'ADOPTION'}))},DOMAIN);
 assert.equal(q.frozen_paths,108);assert.equal(q.first_parent_proven,true);
 assert(Array.isArray(policy.checks)&&policy.checks.length===54,'OFFLINE_CHECK_POLICY_INCOMPLETE');assert.equal(new Set(policy.checks.map(x=>x.check_id)).size,54);
 assert(Array.isArray(q.checks)&&q.checks.length===54,'OFFLINE_CHECKS_INCOMPLETE');
 const seen=new Set();for(const x of q.checks){
  c.exact(x,['check_id','revision','result','reason','evidence_ref','sha256']);const expected=policy.checks.find(p=>p.check_id===x.check_id);
  assert(expected&&!seen.has(x.check_id));seen.add(x.check_id);assert.equal(x.revision,expected.revision);
  assert(x.result==='PASS'||(x.result==='NOT_APPLICABLE'&&expected.allow_not_applicable===true&&typeof x.reason==='string'&&x.reason.trim()),'OFFLINE_CHECK_BLOCKED');
  assert(/^[A-Za-z0-9_.-]+\.json$/.test(x.evidence_ref));c.hash(x.sha256);
  const file=path.join(request.evidence_root,x.evidence_ref);c.noLinks(file);assert.equal(c.sha(fs.readFileSync(file)),x.sha256,'OFFLINE_EVIDENCE_DRIFT');
 }
 assert.equal(q.material_digest,c.digest(request.material),'OFFLINE_MATERIAL_BINDING_CHANGED');
 const checked=material.verify(request.material,root,environment);
 return Object.freeze({head:q.subject_sha,main:q.subject_sha,clean:true,base_ancestor:true,frozen_runtime_identical:true,
  host_id:host,now:new Date(now).toISOString(),platform:process.platform,ci:Boolean(environment.CI||environment.GITHUB_ACTIONS),
  source:'SIGNED_ADOPTION_NOT_LIVE_REMOTE_MAIN',adoption_digest:c.digest(envelope),material_digest:checked.digest,qualification_expires_at:q.expires_at,
  execution_authorized:false,production_authorized:false});
}
function verify(request,policy,root,options={}){
 return policy.activation_mode==='SIGNED_ADOPTION_REQUIRED'?verifyFormal(request,policy,root,options):verifyLegacy(request,policy,root,options);
}
function load(file,root){const policy=c.read(POLICY);return verify(c.read(file),policy,root);}
function isFormalVerified(context){return verifiedFormalContexts.has(context);}
function bindObserved(context,bundle){
 c.exact(bundle.observed.adoption_binding,['qualification_digest','material_digest']);
 assert.equal(bundle.observed.adoption_binding.qualification_digest,context.adoption_digest,'OFFLINE_PERMIT_PROOF_MISMATCH');
 assert.equal(bundle.observed.adoption_binding.material_digest,context.material_digest,'OFFLINE_PERMIT_MATERIAL_MISMATCH');
 assert(c.epoch(bundle.permit.payload.expires_at)<=c.epoch(context.qualification_expires_at),'PERMIT_OUTLIVES_ADOPTION');
}
module.exports={assertFormalIssuer,validateMergedDerivation,MERGED_FIELDS,REQUIRED_STAGE_MATERIAL,DOMAIN,ADOPTION_DOMAIN,POLICY,QCP_REL,verify,verifyFormal,validateFormal,verifyReleaseSourceBinding,load,isFormalVerified,bindObserved};
