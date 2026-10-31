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
const DOMAIN_ADOPTION_V1='GEOX_MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1\n';
const DOMAIN_ADOPTION='GEOX_MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V2\n';
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

// The exact immutable Registry was read on registered Windows host from
// #3754 protected main. Not an authorization, signature, Permit or new root.
const REGISTRY_ORIGIN_HEAD='e9eeacc292204d519cb5e86d3d3ded93573e1b38';
const REGISTRY_RAW_SHA256='b4febc84121e9ffd4a840a6064800c70e1777d099e5c3d880c5a71c57335d1c4';
const REGISTRY_POLICY_MERGE='96861b78674571adf4414b88c3a2894b61de2eb5';
const REGISTRY_POLICY_SHA='ffb5742647594ec1ac144f1d3831ecbbffe2144bd9a765c1a8d4f3c855c30b62';
const REGISTRY_TRUST_SHA='dce2a16f6a82779873dfe25b30194f0445f23b894f5eb41c41a7274b1eb19cf7';
const REGISTRY_LEDGER_ROOT='D:\\gptdown\\MCFT-CAP09-AUTHORITY-LEDGER';
const REGISTRY_SNAPSHOT='a827a892ff1393cefea6a31ca9da978271f951387ad25a1a6df7f638a6e86a14';
const HISTORIC_DA9='da9_minio_f023601082cd0367655ae26bbbdd0649';
const HISTORIC_DA9_STARTED='354ad465f2a53d8ca80b2c9573239808b7f69647e6448c41f68643492df5fcdd';
const HISTORIC_DA9_SIGNED='f023601082cd0367655ae26bbbdd06497395fe65431daba5f731e2dd7641907b';
const REGISTERED_PERMIT_SOURCES=Object.freeze([
 'scripts/cap09_adoption_v1/MCFT_CAP09_R4285_NATIVE_ADOPTION_CONSUMER_V1.cjs',
 'scripts/cap09_adoption_v1/da9-retry-bundle-v2.cjs',
 'scripts/cap09_adoption_v1/da9-retry-bundle.cjs',
 'scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_HOST_V2.cjs',
 'scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_ATOMIC.cjs',
 'scripts/runtime_acceptance/MCFT_CAP09_ATTEMPT3_PERMIT_V2_READONLY.cjs',
 'scripts/runtime_acceptance/MCFT_CAP09_GOVERNED_RETRY_HOST_V1.cjs',
 'scripts/runtime_acceptance/MCFT_CAP09_R4285_HOST_SIGNED_EVIDENCE_PREFLIGHT_V1.cjs',
 'scripts/runtime_acceptance/MCFT_CAP09_RETRY_PERMIT_V1.cjs',
 'scripts/runtime_acceptance/MCFT_CAP09_WINDOWS_LOCAL_QUALIFICATION_ENTRY_V1.ps1'
].sort());
const REGISTERED_NONPERMIT_SOURCES=Object.freeze([
 'scripts/cap09_adoption_v1/da9-minio-closure-v1.cjs',
 'scripts/cap09_adoption_v1/da9-minio-disposition-v1.cjs',
 'scripts/cap09_adoption_v1/da9-minio-exact-delete-v1.cjs'
].sort());
function checkNativeRegistry(registry,report){
 exact(registry,['schema_version','status','host_id','run_id','source_head_sha','scope','scope_limit',
 'source_policy_merge_sha','source_policy_sha256','source_trust_sha256','registered_source_count',
 'registered_sources','registered_issuer_count','historic_nonpermit_source_count','historic_nonpermit_sources',
 'registered_authority_roots','enumeration_complete','unknown_authority_sources_count',
 'unreadable_sources_count','scan_truncated','ledger','authorized_by_owner',
 'owner_ordinal_adjudicated','permit_authorized','permit_issued','permit_consumed_by_this_readback',
 'execution_authorized','production_authorized'],'R4285_REGISTRY_EXACT_FIELDS');
 assert.equal(registry.schema_version,'MCFT_CAP09_R4285_AUTHORITY_ROOT_REGISTRY_READBACK_V1');
 assert.equal(registry.status,'REGISTERED_SOURCE_LEDGER_READBACK_COMPLETE_TEST_ONLY_NOT_OWNER_APPROVAL');
 assert.equal(registry.host_id,HOST);assert.equal(registry.run_id,RUN);
 assert.equal(registry.source_head_sha,REGISTRY_ORIGIN_HEAD,'R4285_REGISTRY_HISTORIC_SOURCE_VERSION');
 assert.equal(registry.scope,'ALL_REGISTERED_CAP09_FORMAL_PERMIT_AUTHORITIES');
 assert.equal(registry.scope_limit,'REGISTERED_CAP09_TEST_ONLY_NOT_ALL_WINDOWS_SOURCES');
 assert.equal(registry.source_policy_merge_sha,REGISTRY_POLICY_MERGE);
 assert.equal(registry.source_policy_sha256,REGISTRY_POLICY_SHA);
 assert.equal(registry.source_trust_sha256,REGISTRY_TRUST_SHA);
 assert.equal(registry.registered_source_count,10);
 assert.deepEqual(registry.registered_sources,REGISTERED_PERMIT_SOURCES);
 assert.equal(registry.registered_issuer_count,2);
 assert.equal(registry.historic_nonpermit_source_count,3);
 assert.deepEqual(registry.historic_nonpermit_sources,REGISTERED_NONPERMIT_SOURCES);
 assert.deepEqual(registry.registered_authority_roots,[REGISTRY_LEDGER_ROOT]);
 assert.equal(registry.enumeration_complete,true);
 assert.equal(registry.unknown_authority_sources_count,0);
 assert.equal(registry.unreadable_sources_count,0);
 assert.equal(registry.scan_truncated,false);
 for(const field of ['authorized_by_owner','owner_ordinal_adjudicated','permit_authorized',
 'permit_issued','permit_consumed_by_this_readback','execution_authorized','production_authorized'])
  assert.equal(registry[field],false,'R4285_UNAUTHORIZED_REGISTRY_GRANT:'+field);
 const l=registry.ledger;assert(l&&typeof l==='object');
 assert.equal(l.snapshot_before_sha256,REGISTRY_SNAPSHOT);
 assert.equal(l.snapshot_after_sha256,REGISTRY_SNAPSHOT);
 assert.equal(l.indexed_files,21);assert.equal(l.indexed_directories,9);
 assert(Array.isArray(l.consumed)&&l.consumed.length===2);
 for(const [i,expected] of [[0,['da9db7129607',PREV2_CONSUMED,'geox_mcft_cap09_consumed_permit_v1']],
 [1,[OLD,PREV_CONSUMED,'geox_mcft_cap09_consumed_permit_attempt3_v2']]]){
  const c=l.consumed[i];
  assert.equal(c.run_id,expected[0]);assert.equal(c.consumed_sha256,expected[1]);
  assert.equal(c.schema_version,expected[2]);assert.equal(c.pair_bytes_equal,true);
  assert.equal(c.production_authorized,false);
  assert.equal(c.nonce,i===0?
   'c8f4bd197ef422f3694f39adc6fcb8a3b67af06a897fe75c219728e40fb13bc0':
   'b3a312063716dce0f59b145c7d89fc1e3fb1aa53dc23d17e59934ba873ff6d93',
   'R4285_HISTORIC_NONCE_INVALID');
 }
 const d=l.historic_nonpermit_disposition;
 assert.equal(d?.namespace,HISTORIC_DA9);
 assert.equal(d.classification,'HISTORIC_NONPERMIT_SOURCE_DISPOSITION');
 assert.equal(d.source_run_id,'da9db7129607');
 assert.equal(d.started_receipt_sha256,HISTORIC_DA9_STARTED);
 assert.equal(d.signed_disposition_sha256,HISTORIC_DA9_SIGNED);
 assert.equal(d.one_shot_receipt_count,3);
 assert.deepEqual(d.deletion?.map(x=>[x.file,x.exit_code]),[['DELETE_1.json',0],['DELETE_2.json',0]]);
 assert.deepEqual(d.deletion?.map(x=>x.receipt_sha256),[
  '419fe785f5c1a18ae392c337b67211e0b2308bf6345e98ab69a8644427458d43',
  '802b4fa77b4853123081e431353fbdb69c1323c10023ee8702c44ac25aaad9b7'
 ],'R4285_DA9_EXACT_DELETE_RECEIPT_DIGESTS');
 for(const field of ['permit_issued','execution_authorized','production_authorized'])
  assert.equal(d[field],false,'R4285_DA9_NONPERMIT');
 if(report){
  checkInventoryReport(report);
  assert.equal(report.ledger_review.root,registry.registered_authority_roots[0]);
  assert.deepEqual(report.ledger_review.verified_consumed_runs.map(x=>x.run_id).sort(),
   l.consumed.map(x=>x.run_id).sort());
  assert.equal(report.native_evidence.attempt2.receipt_sha256,l.consumed[0].consumed_sha256);
  assert.equal(report.native_evidence.attempt3.consumption_sha256,l.consumed[1].consumed_sha256);
 }
 return {status:'EXACT_WINDOWS_REGISTRY_VERIFIED_NOT_OWNER_APPROVAL',
  registered_source_count:10,history_receipts:2,nonpermit_ledger_count:1,
  raw_source_head:REGISTRY_ORIGIN_HEAD,no_grant:true};
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
 checkNativeRegistry(registry,report);assert(SHA.test(reportSha)&&SHA.test(registrySha));
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
 assert.equal(registry.authorized_by_owner,false,'R4285_PRODUCER_CANNOT_SELF_AUTHORIZE');
 assert.equal(registry.production_authorized,false);
 return Object.freeze({status:'OWNER_SIGNED_INVENTORY_AND_ORDINAL_VERIFIED_NOT_ADOPTION',ordinal:4,
  inventory_sha256:reportSha,owner_decision_sha256:sha(Buffer.from(canonical(envelope))),
  no_permit:true,no_execution:true});
}
const ADOPTION_FIELDS=Object.freeze(['schema_version','issuer_id','key_id','run_id','subject_sha','host_id',
 'attempt_ordinal','scope','inventory_sha256','owner_decision_sha256','authority_registry_sha256',
 'lineage_envelope_sha256','native_qcp70_result_sha256','installed_material_digest',
 'release_binding_sha256','issued_at','expires_at','decision','production_authorized','permit_authorized']);
function verifySignedAdoption({envelope,trust,context,now=Date.now()}){
 const p=signed(envelope,trust,DOMAIN_ADOPTION,ADOPTION_FIELDS,now);
 assert.equal(p.schema_version,'MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V2');
 assert.equal(p.run_id,RUN);assert.equal(p.host_id,HOST);
 assert.equal(p.subject_sha,context.subject_sha);
 assert(HEAD.test(p.subject_sha));assert.equal(p.attempt_ordinal,4);
 assert.equal(p.scope,'ISOLATED_QUALIFICATION_TEST_ONLY');
 for(const [key,expected] of Object.entries({
  inventory_sha256:context.inventory_sha256,
  owner_decision_sha256:context.owner_decision_sha256,
  authority_registry_sha256:context.authority_registry_sha256,
  lineage_envelope_sha256:context.lineage_envelope_sha256,
  native_qcp70_result_sha256:context.native_qcp70_result_sha256,
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

/*
 * V3 is a separate, versioned current-subject Adoption signature domain:
 * QCP71 and the final R4285 Host must be qualified before any real signing.
 * Historical V1/V2 domains and payload interpretation are not modified.
 */
const DOMAIN_ADOPTION_V3='GEOX_MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V3\n';
const ADOPTION_V3_FIELDS=Object.freeze(ADOPTION_FIELDS.map(k=>
 k==='native_qcp70_result_sha256'?'native_qcp71_result_sha256':k));
function verifySignedAdoptionV3({envelope,trust,context,now=Date.now()}){
 const p=signed(envelope,trust,DOMAIN_ADOPTION_V3,ADOPTION_V3_FIELDS,now);
 assert.equal(p.schema_version,'MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V3');
 assert.equal(p.run_id,RUN);assert.equal(p.host_id,HOST);
 assert.equal(p.subject_sha,context.subject_sha);
 assert(HEAD.test(p.subject_sha));assert.equal(p.attempt_ordinal,4);
 assert.equal(p.scope,'ISOLATED_QUALIFICATION_TEST_ONLY');
 for(const [key,expected] of Object.entries({
  inventory_sha256:context.inventory_sha256,
  owner_decision_sha256:context.owner_decision_sha256,
  authority_registry_sha256:context.authority_registry_sha256,
  lineage_envelope_sha256:context.lineage_envelope_sha256,
  native_qcp71_result_sha256:context.native_qcp71_result_sha256,
  installed_material_digest:context.installed_material_digest,
  release_binding_sha256:context.release_binding_sha256
 })){
  assert(SHA.test(expected)&&p[key]===expected,'R4285_ADOPTION_V3_DIGEST_MISMATCH:'+key);
 }
 assert.equal(p.decision,'APPROVE_R4285_CURRENT_SUBJECT_ADOPTION_NOT_PERMIT');
 assert.equal(p.production_authorized,false);assert.equal(p.permit_authorized,false);
 return Object.freeze({status:'R4285_SIGNED_ADOPTION_V3_VERIFIED_NOT_PERMIT',
  subject_sha:p.subject_sha,run_id:RUN,
  adoption_digest_sha256:sha(Buffer.from(canonical(envelope))),
  execution_authorized:false,permit_authorized:false});
}

function examineReadiness({inventoryBytes,authorityRegistryBytes,ownerEnvelope,
 adoptionEnvelope,trust,subjectSha,sourceQualification,materialQualification,lineageQualification,now=Date.now()}){
 assert(Buffer.isBuffer(inventoryBytes),'R4285_INVENTORY_RAW_REQUIRED');
 const inventory=JSON.parse(inventoryBytes.toString('utf8').replace(/^\uFEFF/,''));
 const inventorySha=sha(inventoryBytes);const authorityRegistrySha=authorityRegistryBytes?sha(authorityRegistryBytes):null;
 const report=checkInventoryReport(inventory);
 if(authorityRegistryBytes){
  assert(Buffer.isBuffer(authorityRegistryBytes),'R4285_REGISTRY_RAW_REQUIRED');
  const reg=JSON.parse(authorityRegistryBytes.toString('utf8').replace(/^\uFEFF/,''));
  checkNativeRegistry(reg,inventory);
 }
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
 DOMAIN_OWNER,DOMAIN_ADOPTION_V1,DOMAIN_ADOPTION,DOMAIN_ADOPTION_V3,OWNER_FIELDS,ADOPTION_FIELDS,ADOPTION_V3_FIELDS,canonical,readBound,
 checkInventoryReport,checkNativeRegistry,verifyOwnerInventoryDecision,verifySignedAdoption,verifySignedAdoptionV3,examineReadiness,
 REGISTRY_ORIGIN_HEAD,REGISTRY_RAW_SHA256,REGISTRY_LEDGER_ROOT};