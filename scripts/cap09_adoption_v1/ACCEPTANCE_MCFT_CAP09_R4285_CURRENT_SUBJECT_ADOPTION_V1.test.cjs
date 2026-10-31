'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const g=require('./MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const now=Date.parse('2026-10-31T07:00:00.000Z');
const start=new Date(now-1000).toISOString(),end=new Date(now+180000).toISOString();
const keys=crypto.generateKeyPairSync('ed25519');
const trusted={schema_version:'geox_mcft_cap09_retry_trust_v1',host_id:g.HOST,operator_id:'owner',issuers:[{
 issuer_id:'owner',key_id:'key1',role:'ACCOUNTABLE_SINGLE_OPERATOR',revoked:false,
 not_before:new Date(now-3600000).toISOString(),not_after:new Date(now+3600000).toISOString(),
 public_key_pem:keys.publicKey.export({type:'spki',format:'pem'}),spki_sha256:sha(keys.publicKey.export({type:'spki',format:'der'}))}]};
const subject='a'.repeat(40);
function fixture(){return {schema_version:'R4285_ALL_ATTEMPTS_SOURCE_REVIEW_V1',run_id:g.RUN,
 authoritative_ledger_coverage:'PASS_BOUNDED',authoritative_scope:{state:'PASS_BOUNDED_TO_VERIFIED_V1_AND_V2_NATIVE_ROOTS',all_other_UNREGISTERED_authorities_excluded:false,failures:[]},
 attempt1_evidence_level:'HISTORICAL_ONLY',historical_source:{old_inventory_sha256:g.OLD_INVENTORY,
 attempt1:{original_failure_sha256:'00a5eb698fcd9ed0d18689fdd6e25df9e4b2e321e412d8565fec12a04b39b9c8',original_bytes_recomputed:false}},
 native_evidence:{attempt2:{receipt_sha256:g.PREV2_CONSUMED},attempt3:{consumption_sha256:g.PREV_CONSUMED,
 producer_failure_sha256:g.PREV_FAILED,status:'FAIL',exit_code:1,successful_stage_count:0}},
 ordinal_analysis:{status:'CANDIDATE_ONLY_NEEDS_ONCE_OWNER_ADJUDICATION',derived_next_ordinal:4,
 owner_adjudicated_ordinal:null,complete_global_authority_claim:false},
 formal_attempts:[{run_id:'72dc0304a21a',ordinal:1},{run_id:'da9db7129607',ordinal:2},{run_id:g.OLD,ordinal:3}],
 excluded_engineering:[{run_id:'df091a71aafc'},{run_id:'802dca8d4f9c'}],collection_errors:[],
 ledger_review:{root:'D:\\gptdown\\MCFT-CAP09-AUTHORITY-LEDGER',scan_truncated:false,read_errors:[],
 verified_consumed_runs:[{run_id:'da9db7129607'},{run_id:g.OLD}]},
 successor:{adjudicated_ordinal:null},owner_review:'HOLD_NO_PURPOSE_SPECIFIC_APPROVAL_SIGNED'};}
const rb=()=>Buffer.from(JSON.stringify(fixture())+'\n');
function registryObject(){
 const root=g.REGISTRY_LEDGER_ROOT;
 return {schema_version:'MCFT_CAP09_R4285_AUTHORITY_ROOT_REGISTRY_READBACK_V1',
 status:'REGISTERED_SOURCE_LEDGER_READBACK_COMPLETE_TEST_ONLY_NOT_OWNER_APPROVAL',
 host_id:g.HOST,run_id:g.RUN,source_head_sha:g.REGISTRY_ORIGIN_HEAD,
 scope:'ALL_REGISTERED_CAP09_FORMAL_PERMIT_AUTHORITIES',
 scope_limit:'REGISTERED_CAP09_TEST_ONLY_NOT_ALL_WINDOWS_SOURCES',
 source_policy_merge_sha:'96861b78674571adf4414b88c3a2894b61de2eb5',
 source_policy_sha256:'ffb5742647594ec1ac144f1d3831ecbbffe2144bd9a765c1a8d4f3c855c30b62',
 source_trust_sha256:'dce2a16f6a82779873dfe25b30194f0445f23b894f5eb41c41a7274b1eb19cf7',
 registered_source_count:10,registered_sources:[
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
 ],registered_issuer_count:2,historic_nonpermit_source_count:3,
 historic_nonpermit_sources:[
 'scripts/cap09_adoption_v1/da9-minio-closure-v1.cjs',
 'scripts/cap09_adoption_v1/da9-minio-disposition-v1.cjs',
 'scripts/cap09_adoption_v1/da9-minio-exact-delete-v1.cjs'],
 registered_authority_roots:[root],enumeration_complete:true,
 unknown_authority_sources_count:0,unreadable_sources_count:0,scan_truncated:false,
 ledger:{snapshot_before_sha256:'a827a892ff1393cefea6a31ca9da978271f951387ad25a1a6df7f638a6e86a14',
 snapshot_after_sha256:'a827a892ff1393cefea6a31ca9da978271f951387ad25a1a6df7f638a6e86a14',
 indexed_files:21,indexed_directories:9,consumed:[
 {run_id:'da9db7129607',nonce:'c8f4bd197ef422f3694f39adc6fcb8a3b67af06a897fe75c219728e40fb13bc0',
 consumed_sha256:g.PREV2_CONSUMED,schema_version:'geox_mcft_cap09_consumed_permit_v1',pair_bytes_equal:true,production_authorized:false},
 {run_id:g.OLD,nonce:'b3a312063716dce0f59b145c7d89fc1e3fb1aa53dc23d17e59934ba873ff6d93',
 consumed_sha256:g.PREV_CONSUMED,schema_version:'geox_mcft_cap09_consumed_permit_attempt3_v2',pair_bytes_equal:true,production_authorized:false}],
 historic_nonpermit_disposition:{
 namespace:'da9_minio_f023601082cd0367655ae26bbbdd0649',
 classification:'HISTORIC_NONPERMIT_SOURCE_DISPOSITION',source_run_id:'da9db7129607',
 started_receipt_sha256:'354ad465f2a53d8ca80b2c9573239808b7f69647e6448c41f68643492df5fcdd',
 signed_disposition_sha256:'f023601082cd0367655ae26bbbdd06497395fe65431daba5f731e2dd7641907b',
 deletion:[{file:'DELETE_1.json',exit_code:0},{file:'DELETE_2.json',exit_code:0}],
 one_shot_receipt_count:3,permit_issued:false,execution_authorized:false,production_authorized:false}},
 authorized_by_owner:false,owner_ordinal_adjudicated:false,permit_authorized:false,permit_issued:false,
 permit_consumed_by_this_readback:false,execution_authorized:false,production_authorized:false};
}
const registry=()=>Buffer.from(JSON.stringify(registryObject())+'\\n');
function sign(payload,domain){return {payload,signature_base64:crypto.sign(null,Buffer.from(domain+g.canonical(payload)),keys.privateKey).toString('base64')};}
function ownerPayload(reportBytes,registryBytes){return {schema_version:'MCFT_CAP09_R4285_OWNER_INVENTORY_AND_ORDINAL_V1',
 issuer_id:'owner',key_id:'key1',run_id:g.RUN,subject_sha:subject,host_id:g.HOST,
 inventory_sha256:sha(reportBytes),authority_registry_sha256:sha(registryBytes),
 authority_scope:'ALL_REGISTERED_CAP09_FORMAL_PERMIT_AUTHORITIES',authority_registry_complete:true,
 historical_attempt1_evidence_level:'HISTORICAL_ONLY',old_inventory_sha256:g.OLD_INVENTORY,
 attempt2_consumed_sha256:g.PREV2_CONSUMED,attempt3_consumed_sha256:g.PREV_CONSUMED,
 attempt3_producer_failure_sha256:g.PREV_FAILED,
 excluded_engineering_runs:['df091a71aafc','802dca8d4f9c'],
 formal_attempts:['72dc0304a21a','da9db7129607',g.OLD],adjudicated_ordinal:4,
 scope:'ISOLATED_QUALIFICATION_TEST_ONLY',
 decision:'APPROVE_BOUNDED_INVENTORY_AS_EXHAUSTIVE_AND_ADJUDICATE_ORDINAL_ONLY',
 production_authorized:false,permit_authorized:false,issued_at:start,expires_at:end};}
function adoptionPayload(ctx){return {schema_version:'MCFT_CAP09_R4285_CURRENT_SUBJECT_ADOPTION_V1',
 issuer_id:'owner',key_id:'key1',run_id:g.RUN,subject_sha:subject,host_id:g.HOST,attempt_ordinal:4,
 scope:'ISOLATED_QUALIFICATION_TEST_ONLY',
 ...ctx,issued_at:start,expires_at:end,decision:'APPROVE_R4285_CURRENT_SUBJECT_ADOPTION_NOT_PERMIT',
 production_authorized:false,permit_authorized:false};}
function approve(b=rb(),r=registry(),mutate=()=>{}){let p=ownerPayload(b,r);mutate(p);
 return g.verifyOwnerInventoryDecision({reportBytes:b,registryBytes:r,envelope:sign(p,g.DOMAIN_OWNER),trust:trusted,subjectSha:subject,now});}
test('historical evidence is differentiated and exact on accepted bounded report',()=>assert.equal(g.checkInventoryReport(fixture()).candidate_ordinal,4));
test('Owner signature can adjudicate only owner-scoped ordinal, not Permit',()=>{
 const a=approve();assert.equal(a.ordinal,4);assert.equal(a.no_permit,true);assert.equal(a.no_execution,true);
});
test('unapproved inventory always HOLD before any adoption',()=>{
 const v=g.examineReadiness({inventoryBytes:rb(),authorityRegistryBytes:registry(),trust:trusted,subjectSha:subject,now});
 assert.equal(v.status,'HOLD_OWNER_PURPOSE_SPECIFIC_INVENTORY_AND_ORDINAL');
});
test('wrong Attempt-1 evidence level fails closed',()=>{let a=fixture();a.attempt1_evidence_level='ORIGINAL_VERIFIED';assert.throws(()=>g.checkInventoryReport(a));});
test('extra formal consumption in report fails closed',()=>{let a=fixture();a.ledger_review.verified_consumed_runs.push({run_id:'123456789012'});assert.throws(()=>g.checkInventoryReport(a));});
test('enumeration truncation or unreadable slots is rejected',()=>{let a=fixture();a.ledger_review.scan_truncated=true;assert.throws(()=>g.checkInventoryReport(a));a=fixture();a.ledger_review.read_errors=['UNREADABLE'];assert.throws(()=>g.checkInventoryReport(a));});
test('ordinal remains a candidate in raw report',()=>{let a=fixture();a.ordinal_analysis.owner_adjudicated_ordinal=4;assert.throws(()=>g.checkInventoryReport(a));});
test('tampered raw inventory bytes are rejected against signed digest',()=>{
 const b=rb(),r=registry(),p=ownerPayload(b,r),bad=Buffer.concat([b,Buffer.from(' ')]);
 assert.throws(()=>g.verifyOwnerInventoryDecision({reportBytes:bad,registryBytes:r,envelope:sign(p,g.DOMAIN_OWNER),trust:trusted,subjectSha:subject,now}));
});
test('tampered authority registry bytes are rejected',()=>{
 const b=rb(),r=registry(),p=ownerPayload(b,r),bad=Buffer.concat([r,Buffer.from(' ')]);
 assert.throws(()=>g.verifyOwnerInventoryDecision({reportBytes:b,registryBytes:bad,envelope:sign(p,g.DOMAIN_OWNER),trust:trusted,subjectSha:subject,now}));
});
test('unsigned authority registry completeness is rejected',()=>{let b=rb(),r=registry();let raw=JSON.parse(r);raw.enumeration_complete=false;r=Buffer.from(JSON.stringify(raw));assert.throws(()=>approve(b,r));});
test('owner cannot approve ordinal 5 without evidence',()=>assert.throws(()=>approve(rb(),registry(),p=>p.adjudicated_ordinal=5)));
test('owner cannot sign permit authority through inventory decision',()=>assert.throws(()=>approve(rb(),registry(),p=>p.permit_authorized=true)));
test('wrong signature domain is rejected',()=>{let b=rb(),r=registry(),p=ownerPayload(b,r);assert.throws(()=>g.verifyOwnerInventoryDecision({reportBytes:b,registryBytes:r,envelope:sign(p,g.DOMAIN_ADOPTION),trust:trusted,subjectSha:subject,now}));});
test('revoked signer rejected',()=>{let b=rb(),r=registry(),p=ownerPayload(b,r);const trust=structuredClone(trusted);trust.issuers[0].revoked=true;assert.throws(()=>g.verifyOwnerInventoryDecision({reportBytes:b,registryBytes:r,envelope:sign(p,g.DOMAIN_OWNER),trust,subjectSha:subject,now}));});
test('missing native source verification remains HOLD after real Owner-signed review',()=>{
 let b=rb(),r=registry(),p=ownerPayload(b,r);const v=g.examineReadiness({inventoryBytes:b,authorityRegistryBytes:r,
 ownerEnvelope:sign(p,g.DOMAIN_OWNER),trust:trusted,subjectSha:subject,now});
 assert.equal(v.status,'HOLD_NATIVE_CURRENT_SUBJECT_QCP67_MATERIAL_AND_LINEAGE_HOST_BRIDGE_MISSING');
 assert.equal(v.execution_authorized,false);
});
test('caller-supplied fake qualification markers cannot admit Current Subject',()=>{
 const b=rb(),r=registry(),p=ownerPayload(b,r);
 const v=g.examineReadiness({inventoryBytes:b,authorityRegistryBytes:r,ownerEnvelope:sign(p,g.DOMAIN_OWNER),
  trust:trusted,subjectSha:subject,now,
  sourceQualification:{status:'NATIVE_EXACT_HEAD_QCP67_VERIFIED',subject_sha:subject},
  materialQualification:{status:'INSTALLED_MATERIAL_BYTES_VERIFIED'},
  lineageQualification:{status:'SIGNED_R4285_LINEAGE_VERIFIED'}});
 assert.equal(v.status,'HOLD_NATIVE_CURRENT_SUBJECT_QCP67_MATERIAL_AND_LINEAGE_HOST_BRIDGE_MISSING');
 assert.equal(v.execution_authorized,false);
});
test('signed Adoption envelope is cryptographically bound yet never permits execution',()=>{
 const ctx={subject_sha:subject,inventory_sha256:'1'.repeat(64),owner_decision_sha256:'2'.repeat(64),
 authority_registry_sha256:'3'.repeat(64),lineage_envelope_sha256:'4'.repeat(64),
 native_qcp70_result_sha256:'5'.repeat(64),installed_material_digest:'6'.repeat(64),
 release_binding_sha256:'7'.repeat(64)};
 const a=g.verifySignedAdoption({envelope:sign(adoptionPayload(Object.fromEntries(Object.entries(ctx).filter(([k])=>k!=='subject_sha'))),g.DOMAIN_ADOPTION),trust:trusted,context:ctx,now});
 assert.equal(a.execution_authorized,false);assert.equal(a.permit_authorized,false);
});
test('a signature with wrong subject fails closed',()=>{const ctx={subject_sha:'b'.repeat(40)};const payload=adoptionPayload({inventory_sha256:'1'.repeat(64),owner_decision_sha256:'2'.repeat(64),authority_registry_sha256:'3'.repeat(64),lineage_envelope_sha256:'4'.repeat(64),native_qcp70_result_sha256:'5'.repeat(64),installed_material_digest:'6'.repeat(64),release_binding_sha256:'7'.repeat(64)});assert.throws(()=>g.verifySignedAdoption({envelope:sign(payload,g.DOMAIN_ADOPTION),trust:trusted,context:ctx,now}));});
test('read-only exports have no issue, consume, dispatch, sign or execute methods',()=>{for(const k of Object.keys(g))assert(!/issue|consume|execute|dispatch|sign[A-Z]/.test(k),k)});
test('native registry producer cannot set Owner-authorized true',()=>{
 let r=registryObject();r.authorized_by_owner=true;
 assert.throws(()=>g.checkNativeRegistry(r,fixture()),/UNAUTHORIZED_REGISTRY_GRANT/);
});
test('real Windows Registry provenance fields must be exact',()=>{
 for(const patch of [
  x=>x.source_head_sha='f'.repeat(40),
  x=>x.registered_source_count=11,
  x=>x.registered_sources.push('scripts/foreign.cjs'),
  x=>x.registered_authority_roots=['C:\\\\untrusted'],
  x=>x.ledger.snapshot_after_sha256='f'.repeat(64),
  x=>x.ledger.consumed[1].consumed_sha256='0'.repeat(64),
  x=>x.ledger.historic_nonpermit_disposition.namespace='unregistered',
  x=>x.ledger.historic_nonpermit_disposition.deletion[0].exit_code=1,
  x=>x.unknown_authority_sources_count=1,
  x=>x.permit_authorized=true,
  x=>delete x.ledger.historic_nonpermit_disposition
 ]){
  const r=registryObject();patch(r);
  assert.throws(()=>g.checkNativeRegistry(r,fixture()));
 }
});
test('Registry and independently collected inventory must match double-ledger history',()=>{
 let report=fixture(),r=registryObject();
 assert.equal(g.checkNativeRegistry(r,report).no_grant,true);
 report.native_evidence.attempt2.receipt_sha256='f'.repeat(64);
 assert.throws(()=>g.checkNativeRegistry(r,report));
});
test('unsigned native Registry + independent inventory retains Owner HOLD',()=>{
 const out=g.examineReadiness({inventoryBytes:rb(),authorityRegistryBytes:registry(),trust:trusted,subjectSha:subject,now});
 assert.equal(out.status,'HOLD_OWNER_PURPOSE_SPECIFIC_INVENTORY_AND_ORDINAL');
 assert.equal(out.permit_issued,false);
});
test('Owner envelope cannot reclassify Registry as granted or change its raw bytes',()=>{
 const b=rb(),r=registry(),p=ownerPayload(b,r);
 const env=sign(p,g.DOMAIN_OWNER);
 const altered=JSON.parse(r.toString('utf8'));altered.authorized_by_owner=true;
 assert.throws(()=>g.verifyOwnerInventoryDecision({reportBytes:b,registryBytes:Buffer.from(JSON.stringify(altered)),envelope:env,trust:trusted,subjectSha:subject,now}));
});
test('independent Owner decision still requires signature and exact domain',()=>{
 const b=rb(),r=registry();
 assert.throws(()=>g.verifyOwnerInventoryDecision({reportBytes:b,registryBytes:r,
  envelope:{payload:ownerPayload(b,r),signature_base64:Buffer.alloc(64).toString('base64')},
  trust:trusted,subjectSha:subject,now}),/SIGNATURE_NOT_AUTHENTIC/);
});
