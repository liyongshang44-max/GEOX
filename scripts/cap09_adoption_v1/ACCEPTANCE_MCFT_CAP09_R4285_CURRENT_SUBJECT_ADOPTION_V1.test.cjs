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
const registry=()=>Buffer.from(JSON.stringify({schema_version:'MCFT_CAP09_R4285_AUTHORITY_ROOT_REGISTRY_READBACK_V1',
 host_id:g.HOST,scope:'ALL_REGISTERED_CAP09_FORMAL_PERMIT_AUTHORITIES',enumeration_complete:true,
 unreadable_sources_count:0,unknown_authority_sources_count:0,
 registered_authority_roots:['D:\\gptdown\\MCFT-CAP09-AUTHORITY-LEDGER'],authorized_by_owner:true,
 production_authorized:false})+'\n');
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
 const v=g.examineReadiness({inventoryBytes:rb(),trust:trusted,subjectSha:subject,now});
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
 native_qcp67_result_sha256:'5'.repeat(64),installed_material_digest:'6'.repeat(64),
 release_binding_sha256:'7'.repeat(64)};
 const a=g.verifySignedAdoption({envelope:sign(adoptionPayload(Object.fromEntries(Object.entries(ctx).filter(([k])=>k!=='subject_sha'))),g.DOMAIN_ADOPTION),trust:trusted,context:ctx,now});
 assert.equal(a.execution_authorized,false);assert.equal(a.permit_authorized,false);
});
test('a signature with wrong subject fails closed',()=>{const ctx={subject_sha:'b'.repeat(40)};const payload=adoptionPayload({inventory_sha256:'1'.repeat(64),owner_decision_sha256:'2'.repeat(64),authority_registry_sha256:'3'.repeat(64),lineage_envelope_sha256:'4'.repeat(64),native_qcp67_result_sha256:'5'.repeat(64),installed_material_digest:'6'.repeat(64),release_binding_sha256:'7'.repeat(64)});assert.throws(()=>g.verifySignedAdoption({envelope:sign(payload,g.DOMAIN_ADOPTION),trust:trusted,context:ctx,now}));});
test('read-only exports have no issue, consume, dispatch, sign or execute methods',()=>{for(const k of Object.keys(g))assert(!/issue|consume|execute|dispatch|sign[A-Z]/.test(k),k)});