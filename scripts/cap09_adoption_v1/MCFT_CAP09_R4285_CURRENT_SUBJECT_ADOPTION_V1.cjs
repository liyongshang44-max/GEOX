'use strict';
/* R4285 / successor Current Subject Adoption — read-only, non-authorizing
 * eligibility boundary. NO signer, Owner decision, Permit, ledger mutation,
 * stage launch, or production activation is implemented here.
 * This is NOT the Attempt-3 QCP65 Adoption V2 Consumer.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const RUN='4285c3ce342c',HOST='LAPTOP-STN2A2P1';
const OLD='6ff9b41f6f7f';
const PREV_CONSUMED='753c83f4dbc87ee91d8ee01499353940b29009f3671616826dba5da32ddd94fb';
const PREV_FAILED='1698c5e136cbd90daa23130eb08bd052bd8da9a09f87b39283ed3d1f63392d36';
const PREV2_CONSUMED='f8c55961e2b4972e8e2b92ad0d788b6030240f97e2bc274edf206fb5833ea21a';
const OLD_INVENTORY='c93e1c260b029274848bd74c6c22ab54970ac1bee34b8d257ad325b3f4f18e7c';
const FIRST_FAILURE='00a5eb698fcd9ed0d18689fdd6e25df9e4b2e321e412d8565fec12a04b39b9c8';
const SHA=/^[a-f0-9]{64}$/,HEAD=/^[a-f0-9]{40}$/;
const REPORT_SCHEMA='R4285_ALL_ATTEMPTS_SOURCE_REVIEW_V1';
const DOMAIN_OWNER='GEOX_MCFT_CAP09_R4285_OWNER_INVENTORY_AND_ORDINAL_V1\n';
const DOMAIN_ADOPTION='GEOX_MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1\n';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function exact(obj,keys,code){assert(obj&&typeof obj==='object'&&!Array.isArray(obj),code);assert.deepEqual(Object.keys(obj).sort(),[...keys].sort(),code);}
function canonical(o){
 if(o===null||typeof o==='boolean'||typeof o==='string')return JSON.stringify(o);
 if(typeof o==='number'){assert(Number.isSafeInteger(o),'R4285_NONINTEGER');return String(o);}
 if(Array.isArray(o))return '['+o.map(canonical).join(',')+']';
 assert(o&&Object.getPrototypeOf(o)===Object.prototype,'R4285_CANONICAL_OBJECT');
 return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canonical(o[k])).join(',')+'}';
}
function date(s){assert(typeof s==='string'&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s,'R4285_NONCANONICAL_TIME');return Date.parse(s)}
function readBound(file,expected){
 assert(path.isAbsolute(file)&&SHA.test(expected),'R4285_EXACT_FILE_AND_SHA_REQUIRED');
 let p=path.resolve(file);for(;;){const st=fs.lstatSync(p);assert(!st.isSymbolicLink(),'R4285_REPARSE_POINT_FORBIDDEN');if(p===path.resolve(file))assert(st.isFile()&&st.size>0&&st.size<=4*1024*1024,'R4285_BAD_FILE');let parent=path.dirname(p);if(parent===p)break;p=parent}
 const bytes=fs.readFileSync(file);assert.equal(sha(bytes),expected,'R4285_SOURCE_BYTES_CHANGED');return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
}
function checkInventoryReport(report){
 assert.equal(report.schema_version,REPORT_SCHEMA,'R4285_INVENTORY_SCHEMA');
 assert.equal(report.run_id,RUN,'R4285_INVENTORY_RUN');
 assert.equal(report.authoritative_ledger_coverage,'PASS_BOUNDED','R4285_AUTHORITY_ROOTS_NOT_READ');
 assert.equal(report.authoritative_scope?.state,'PASS_BOUNDED_TO_VERIFIED_V1_AND_V2_NATIVE_ROOTS');
 assert.equal(report.authoritative_scope?.all_other_UNREGISTERED_authorities_excluded,false,
  'R4285_INVENTORY_SCOPE_MUST_NOT_CLAIM_GLOBAL_NEGATIVE');
 assert.equal(report.attempt1_evidence_level,'HISTORICAL_ONLY');
 assert.equal(report.historical_source?.old_inventory_sha256,OLD_INVENTORY);
 assert.equal(report.historical_source?.attempt1?.original_failure_sha256,FIRST_FAILURE);
 assert.equal(report.historical_source?.attempt1?.original_bytes_recomputed,false);
 assert.equal(report.native_evidence?.attempt2?.receipt_sha256,PREV2_CONSUMED);
 assert.equal(report.native_evidence?.attempt3?.consumption_sha256,PREV_CONSUMED);
 assert.equal(report.native_evidence?.attempt3?.producer_failure_sha256,PREV_FAILED);
 assert.equal(report.native_evidence?.attempt3?.status,'FAIL');
 assert.equal(report.native_evidence?.attempt3?.exit_code,1);
 assert.equal(report.native_evidence?.attempt3?.successful_stage_count,0);
 assert.equal(report.ordinal_analysis?.status,'CANDIDATE_ONLY_NEEDS_ONCE_OWNER_ADJUDICATION');
 assert.equal(report.ordinal_analysis?.derived_next_ordinal,4);
 assert.equal(report.ordinal_analysis?.owner_adjudicated_ordinal,null);
 assert.equal(report.ordinal_analysis?.complete_global_authority_claim,false);
 assert.deepEqual(report.formal_attempts?.map(a=>[a.run_id,a.ordinal]),[
  ['72dc0304a21a',1],['da9db7129607',2],[OLD,3]]);
 assert.deepEqual(report.excluded_engineering?.map(a=>a.run_id).sort(),
  ['802dca8d4f9c','df091a71aafc'].sort());
 assert.deepEqual(report.collection_errors,[],'R4285_INVENTORY_COLLECTION_ERRORS');
 assert.deepEqual(report.authoritative_scope?.failures,[],'R4285_INVENTORY_ROOT_ERRORS');
 assert.equal(report.ledger_review?.scan_truncated,false);
 assert.deepEqual(report.ledger_review?.read_errors,[]);
 assert.deepEqual(report.ledger_review?.verified_consumed_runs?.map(x=>x.run_id).sort(),
  ['da9db7129607',OLD].sort());
 assert.equal(report.successor?.adjudicated_ordinal,null);
 assert.equal(report.owner_review,'HOLD_NO_PURPOSE_SPECIFIC_APPROVAL_SIGNED');
 return {status:'BOUNDED_NATIVE_INVENTORY_VERIFIED_NOT_GLOBAL_COMPLETENESS',candidate_ordinal:4};
}
const OWNER_FIELDS=Object.freeze(['schema_version','issuer_id','key_id','run_id','subject_sha','host_id',
 'inventory_sha256','authority_registry_sha256','authority_scope','authority_registry_complete',
 'historical_attempt1_evidence_level','old_inventory_sha256','attempt2_consumed_sha256',
 'attempt3_consumed_sha256','attempt3_producer_failure_sha256','excluded_engineering_runs',
 'formal_attempts','adjudicated_ordinal','scope','decision','production_authorized',
 'permit_authorized','issued_at','expires_at']);
function signed(envelope,trust,domain,fields,now){
 exact(envelope,['payload','signature_base64'],'R4285_SIGNED_ENVELOPE_FIELDS');
 const p=envelope.payload;exact(p,fields,'R4285_SIGNED_PAYLOAD_FIELDS');
 assert.equal(trust?.schema_version,'geox_mcft_cap09_retry_trust_v1');
 assert.equal(trust.host_id,HOST);
 const signers=trust.issuers?.filter(k=>k.issuer_id===p.issuer_id&&k.key_id===p.key_id);
 assert.equal(signers?.length,1,'R4285_OWNER_SIGNER_UNIQUE');const signer=signers[0];
 assert.equal(signer.role,'ACCOUNTABLE_SINGLE_OPERATOR');
 assert.equal(signer.issuer_id,trust.operator_id);
 assert.equal(signer.revoked,false);
 const start=date(p.issued_at),end=date(p.expires_at);
 assert(start<=now&&now<end&&end-start<=24*60*60*1000,'R4285_SIGNED_WINDOW');
 assert(date(signer.not_before)<=start&&end<=date(signer.not_after),'R4285_SIGNER_TIME_SCOPE');
 const key=crypto.createPublicKey(signer.public_key_pem);assert.equal(key.asymmetricKeyType,'ed25519');
 assert.equal(sha(key.export({format:'der',type:'spki'})),signer.spki_sha256);
 const sig=Buffer.from(envelope.signature_base64,'base64');
 assert(sig.length===64&&sig.toString('base64')===envelope.signature_base64);
 assert(crypto.verify(null,Buffer.from(domain+canonical(p)),key,sig),'R4285_SIGNATURE_NOT_AUTHENTIC');
 return p;
}
function verifyOwnerInventoryDecision({reportBytes,registryBytes,envelope,trust,subjectSha,now=Date.now()}){
 assert(Buffer.isBuffer(reportBytes)&&Buffer.isBuffer(registryBytes),'R4285_NATIVE_RAW_BYTES_REQUIRED');
 const report=JSON.parse(reportBytes.toString('utf8').replace(/^\uFEFF/,''));
 const registry=JSON.parse(registryBytes.toString('utf8').replace(/^\uFEFF/,''));
 const reportSha=sha(reportBytes),registrySha=sha(registryBytes);
 checkInventoryReport(report);assert(SHA.test(reportSha)&&SHA.test(registrySha));
 assert(HEAD.test(subjectSha),'R4285_EXACT_HEAD_REQUIRED');
 const p=signed(envelope,trust,DOMAIN_OWNER,OWNER_FIELDS,now);
 assert.equal(p.schema_version,'MCFT_CAP09_R4285_OWNER_INVENTORY_AND_ORDINAL_V1');
 assert.equal(p.run_id,RUN);assert.equal(p.subject_sha,subjectSha);assert.equal(p.host_id,HOST);
 assert.equal(p.inventory_sha256,reportSha);assert.equal(p.authority_registry_sha256,registrySha);
 assert.equal(p.authority_scope,'ALL_REGISTERED_CAP09_FORMAL_PERMIT_AUTHORITIES');
 assert.equal(p.authority_registry_complete,true,'R4285_OWNER_EXHAUSTIVENESS_NOT_ADJUDICATED');
 assert.equal(p.historical_attempt1_evidence_level,'HISTORICAL_ONLY');
 assert.equal(p.old_inventory_sha256,OLD_INVENTORY);
 assert.equal(p.attempt2_consumed_sha256,PREV2_CONSUMED);
 assert.equal(p.attempt3_consumed_sha256,PREV_CONSUMED);
 assert.equal(p.attempt3_producer_failure_sha256,PREV_FAILED);
 assert.deepEqual(p.formal_attempts,['72dc0304a21a','da9db7129607',OLD]);
 assert.deepEqual(p.excluded_engineering_runs.slice().sort(),['802dca8d4f9c','df091a71aafc'].sort());
 assert.equal(p.adjudicated_ordinal,4,'R4285_OWNER_ORDINAL_NOT_SUPPORTED');
 assert.equal(p.scope,'ISOLATED_QUALIFICATION_TEST_ONLY');
 assert.equal(p.decision,'APPROVE_BOUNDED_INVENTORY_AS_EXHAUSTIVE_AND_ADJUDICATE_ORDINAL_ONLY');
 assert.equal(p.production_authorized,false);assert.equal(p.permit_authorized,false);
 // The owner declaration is not enough: require an independently bound,
 // explicit authority registry readback, not a fabricated "no other roots" flag.
 assert.equal(registry?.schema_version,'MCFT_CAP09_R4285_AUTHORITY_ROOT_REGISTRY_READBACK_V1');
 assert.equal(registry.host_id,HOST);
 assert.equal(registry.scope,'ALL_REGISTERED_CAP09_FORMAL_PERMIT_AUTHORITIES');
 assert.equal(registry.enumeration_complete,true);
 assert.equal(registry.unreadable_sources_count,0);
 assert.equal(registry.unknown_authority_sources_count,0);
 assert.equal(registry.registered_authority_roots?.length,1);
 assert.equal(registry.registered_authority_roots[0],report.ledger_review.root);
 assert.equal(registry.authorized_by_owner,true);
 assert.equal(registry.production_authorized,false);
 return Object.freeze({status:'OWNER_SIGNED_INVENTORY_AND_ORDINAL_VERIFIED_NOT_ADOPTION',ordinal:4,
  inventory_sha256:reportSha,owner_decision_sha256:sha(Buffer.from(canonical(envelope))),
  no_permit:true,no_execution:true});
}
const ADOPTION_FIELDS=Object.freeze(['schema_version','issuer_id','key_id','run_id','subject_sha','host_id',
 'attempt_ordinal','scope','inventory_sha256','owner_decision_sha256','authority_registry_sha256',
 'lineage_envelope_sha256','native_qcp67_result_sha256','installed_material_digest',
 'release_binding_sha256','issued_at','expires_at','decision','production_authorized','permit_authorized']);
function verifySignedAdoption({envelope,trust,context,now=Date.now()}){
 const p=signed(envelope,trust,DOMAIN_ADOPTION,ADOPTION_FIELDS,now);
 assert.equal(p.schema_version,'MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1');
 assert.equal(p.run_id,RUN);assert.equal(p.host_id,HOST);
 assert.equal(p.subject_sha,context.subject_sha);
 assert(HEAD.test(p.subject_sha));assert.equal(p.attempt_ordinal,4);
 assert.equal(p.scope,'ISOLATED_QUALIFICATION_TEST_ONLY');
 for(const [key,expected] of Object.entries({
  inventory_sha256:context.inventory_sha256,
  owner_decision_sha256:context.owner_decision_sha256,
  authority_registry_sha256:context.authority_registry_sha256,
  lineage_envelope_sha256:context.lineage_envelope_sha256,
  native_qcp67_result_sha256:context.native_qcp67_result_sha256,
  installed_material_digest:context.installed_material_digest,
  release_binding_sha256:context.release_binding_sha256})){
  assert(SHA.test(expected)&&p[key]===expected,'R4285_ADOPTION_DIGEST_MISMATCH:'+key);
 }
 assert.equal(p.decision,'APPROVE_R4285_CURRENT_SUBJECT_ADOPTION_NOT_PERMIT');
 assert.equal(p.production_authorized,false);assert.equal(p.permit_authorized,false);
 return Object.freeze({status:'R4285_SIGNED_ADOPTION_ENVELOPE_CRYPTOGRAPHICALLY_VALID_NOT_LIVE_HOST_ADMITTED',
  subject_sha:p.subject_sha,run_id:RUN,adoption_digest_sha256:sha(Buffer.from(canonical(envelope))),
  execution_authorized:false,permit_authorized:false});
}
function examineReadiness({inventoryBytes,authorityRegistryBytes,ownerEnvelope,
 adoptionEnvelope,trust,subjectSha,sourceQualification,materialQualification,lineageQualification,now=Date.now()}){
 assert(Buffer.isBuffer(inventoryBytes),'R4285_INVENTORY_RAW_REQUIRED');
 const inventory=JSON.parse(inventoryBytes.toString('utf8').replace(/^\uFEFF/,''));
 const inventorySha=sha(inventoryBytes);const authorityRegistrySha=authorityRegistryBytes?sha(authorityRegistryBytes):null;
 const report=checkInventoryReport(inventory);
 if(!ownerEnvelope)return Object.freeze({status:'HOLD_OWNER_PURPOSE_SPECIFIC_INVENTORY_AND_ORDINAL',
  stage:'CURRENT_SUBJECT_ADOPTION',inventory:report.status,attempt1_evidence_level:'HISTORICAL_ONLY',
  permit_issued:false,execution_authorized:false});
 const owner=verifyOwnerInventoryDecision({reportBytes:inventoryBytes,registryBytes:authorityRegistryBytes,
  envelope:ownerEnvelope,trust,subjectSha,now});
 // The native QCP67, installed-release and signed lineage verification must
 // be wired as trusted, non-injectable Host operations first. Caller-provided
 // strings/objects can never assert those authoritative results.
 return Object.freeze({status:'HOLD_NATIVE_CURRENT_SUBJECT_QCP67_MATERIAL_AND_LINEAGE_HOST_BRIDGE_MISSING',
  owner_ordinal:owner.ordinal,adoption_signed_not_claimed:true,
  permit_issued:false,execution_authorized:false});
}
module.exports={RUN,HOST,OLD,PREV_CONSUMED,PREV_FAILED,PREV2_CONSUMED,OLD_INVENTORY,
 DOMAIN_OWNER,DOMAIN_ADOPTION,OWNER_FIELDS,ADOPTION_FIELDS,canonical,readBound,
 checkInventoryReport,verifyOwnerInventoryDecision,verifySignedAdoption,examineReadiness};