#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const PER_RUN_REQUIRED=['exact_subject_sha','run_label','formal_run_id','operational_run_instance_id','tenant_id','project_id','group_id','field_id','season_id','zone_id','lineage_id','revision_id','database_instance_digest','artifact_ref','artifact_digest','object_set_ref','selector_observed_ref','proof_phase','phase_instance','execution_class'];
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map((k)=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v);}
function digest(v){return`sha256:${crypto.createHash('sha256').update(canonical(v)).digest('hex')}`;}
function exactExpected(expected,observed){return canonical(expected)===canonical(observed);}
function validateProvenance(contract,context){
 const common=['exact_subject_sha','artifact_ref','artifact_digest','object_set_ref','selector_observed_ref','proof_phase','phase_instance','execution_class']; const required=contract.phase==='PER_RUN'&&context.proof_phase===contract.phase?PER_RUN_REQUIRED:common;
 for(const k of required)assert.notEqual(context[k],undefined,`WITNESS_PROVENANCE_MISSING:${k}`);
 assert.match(String(context.exact_subject_sha),/^[0-9a-f]{40}$/,'EXACT_SUBJECT_SHA'); assert.match(String(context.artifact_digest),/^sha256:[0-9a-f]{64}$/,'ARTIFACT_DIGEST');
 if(contract.phase==='PER_RUN'&&context.proof_phase===contract.phase){assert.ok(['RUN_A','RUN_B'].includes(context.run_label),'RUN_LABEL'); assert.equal(context.phase_instance,context.run_label,'PHASE_INSTANCE_RUN_LABEL'); assert.notEqual(context.operational_run_instance_id,'','RUN_INSTANCE');}
}

function validateSourceBinding(contract,context,source){
 assert.ok(source&&typeof source==='object','WITNESS_SOURCE_REQUIRED'); const p=source.provenance; assert.ok(p&&typeof p==='object','WITNESS_SOURCE_PROVENANCE_REQUIRED');
 const exact=['exact_subject_sha','formal_run_id','run_label','operational_run_instance_id','tenant_id','project_id','group_id','field_id','season_id','zone_id','lineage_id','revision_id','artifact_digest','object_set_ref'];
 for(const k of exact)assert.equal(p[k],context[k],`WITNESS_SOURCE_BINDING:${k}`);
 assert.equal(p.global_table_count_used,false,'GLOBAL_TABLE_COUNT_FORBIDDEN'); assert.equal(p.global_type_count_used,false,'GLOBAL_TYPE_COUNT_FORBIDDEN'); assert.equal(p.unscoped_projection_count_used,false,'UNSCOPED_PROJECTION_COUNT_FORBIDDEN');
 assert.equal(p.slice_acceptance_object_reuse_count,0,'SLICE_ACCEPTANCE_REUSE_FORBIDDEN'); assert.equal(p.cross_run_stitching_count,0,'CROSS_RUN_STITCHING_FORBIDDEN'); assert.ok(p.closure_member_manifest_ref,'CLOSURE_MANIFEST_REF_REQUIRED');
 if(context.execution_class==='SYNTHETIC_PRODUCER_CONTRACT_TEST'){assert.equal(p.source_classification,'SYNTHETIC_CONTRACT_FIXTURE');assert.equal(p.hard_acceptance_source_eligible,false);}
 else if(contract.phase==='PER_RUN'){assert.equal(p.source_classification,'FINAL_FORMAL_CLOSURE_SOURCE_V1');assert.equal(p.closure_manifest_generated_by_final_formal_run,true);assert.equal(p.canonical_readback_verified,true);assert.equal(p.hard_acceptance_source_eligible,true);}
 return digest(p);
}
function eligibility(contract,context,implementationStatus){
 if(implementationStatus!=='IMPLEMENTED')return{eligible:false,reason:'DEFERRED_BY_AUTHORITY'};
 if(context.proof_phase!==contract.phase)return{eligible:false,reason:'PROOF_PHASE_MISMATCH'};
 if(context.execution_class==='SYNTHETIC_PRODUCER_CONTRACT_TEST')return{eligible:true,synthetic:true};
 if(contract.phase==='PER_RUN'&&context.execution_class!=='FINAL_FORMAL_CLOSURE_RUN')return{eligible:false,reason:'FINAL_FORMAL_CLOSURE_RUN_REQUIRED'};
 if(contract.phase==='CROSS_RUN'&&context.execution_class!=='CROSS_RUN_COMPARISON')return{eligible:false,reason:'CROSS_RUN_COMPARISON_REQUIRED'};
 if(contract.phase==='MERGE_SHA'&&context.execution_class!=='MERGE_SHA_ATTESTATION')return{eligible:false,reason:'MERGE_SHA_ATTESTATION_REQUIRED'};
 if(contract.phase==='RETENTION_ATTESTATION'&&context.execution_class!=='R2_RETENTION_ATTESTATION')return{eligible:false,reason:'R2_RETENTION_ATTESTATION_REQUIRED'};
 return{eligible:true,synthetic:false};
}
function buildWitnessV1({catalog,contract,context,source,observed,producerId,implementationStatus}){
 validateProvenance(contract,context); assert.equal(contract.producer_id,producerId,'PRODUCER_CONTRACT_MISMATCH');
 const sourceBindingDigest=implementationStatus==='IMPLEMENTED'?validateSourceBinding(contract,context,source):null;
 const e=eligibility(contract,context,implementationStatus); const expected=structuredClone(contract.expected_contract);
 const base={schema_version:'geox_mcft_cap08_s6_ha_witness_v1',witness_classification:context.execution_class,hard_acceptance_eligible:false,item_id:contract.item_id,requirement:contract.requirement,proof_contract_id:contract.proof_contract_id,proof_phase:contract.phase,phase_instance:context.phase_instance,producer_id:producerId,witness_ref:null,artifact_ref:context.artifact_ref,artifact_digest:context.artifact_digest,object_set_ref:context.object_set_ref,counting_domain:contract.counting_domain,selector:contract.selector_id,selector_observed_ref:context.selector_observed_ref,expected,observed:observed===undefined?null:structuredClone(observed),exact_subject_sha:context.exact_subject_sha,run_label:context.run_label??null,formal_run_id:context.formal_run_id??null,operational_run_instance_id:context.operational_run_instance_id??null,status:'NOT_YET_ELIGIBLE',eligibility_reason:e.reason??null,source_binding_digest:sourceBindingDigest};
 if(!e.eligible){base.witness_ref=digest(base);return base;}
 const pass=exactExpected(expected,observed); base.status=e.synthetic?(pass?'CONTRACT_TEST_PASS':'CONTRACT_TEST_FAIL'):(pass?'PASS':'FAIL'); base.hard_acceptance_eligible=!e.synthetic&&pass; base.eligibility_reason=null; base.witness_ref=digest(base); return base;
}
function createProducerV1({producerId,implementationStatus='IMPLEMENTED',select}){
 assert.match(producerId,/^mcft_cap08_s6_[a-z0-9_]+_v1$/); assert.ok(['IMPLEMENTED','DEFERRED_BY_AUTHORITY'].includes(implementationStatus));
 return Object.freeze({producer_id:producerId,implementation_status:implementationStatus,produce({catalog,proof_contract_id,context,source}){const contract=catalog.byContract[proof_contract_id];assert.ok(contract,`UNKNOWN_PROOF_CONTRACT:${proof_contract_id}`);assert.equal(contract.producer_id,producerId,`WRONG_PRODUCER:${proof_contract_id}`);const observed=implementationStatus==='IMPLEMENTED'?select(contract,source):undefined;return buildWitnessV1({catalog,contract,context,source,observed,producerId,implementationStatus});}});
}
module.exports={canonical,digest,exactExpected,validateProvenance,validateSourceBinding,eligibility,buildWitnessV1,createProducerV1};
