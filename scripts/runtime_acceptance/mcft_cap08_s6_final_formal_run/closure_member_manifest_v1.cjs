#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {sha,canonical}=require('./identity_v1.cjs');
function memberKey(m,required){return canonical(Object.fromEntries(required.map(k=>[k,m[k]])));}
function buildClosureMemberManifestV1({contracts,plan,canonicalMembers,sourceClassification,canonicalReadbackVerified=false}){
 const synthetic=sourceClassification==='SYNTHETIC_ORCHESTRATOR_CONTRACT_FIXTURE'; assert.ok(synthetic||sourceClassification==='FINAL_FORMAL_CLOSURE_SOURCE_V1','SOURCE_CLASSIFICATION'); if(!synthetic)assert.equal(canonicalReadbackVerified,true,'CANONICAL_READBACK_REQUIRED');
 const req=contracts.manifest.canonical_member_identity.required_fields,excluded=contracts.manifest.canonical_member_identity.excluded_fields;const keys=new Set();for(const m of canonicalMembers){for(const k of req)assert.notEqual(m[k],undefined,`MEMBER_FIELD:${k}`);for(const k of excluded)assert.equal(m[k],undefined,`EXCLUDED_MEMBER_FIELD:${k}`);assert.equal(m.formal_run_id,plan.formal_run_id);for(const [k,v] of Object.entries(plan.scope))assert.equal(m[k],v,`MEMBER_SCOPE:${k}`);assert.equal(m.lineage_id,plan.lineage_id);assert.equal(m.revision_id,plan.revision_id);assert.match(m.object_hash,/^sha256:[0-9a-f]{64}$/);const key=memberKey(m,req);assert.equal(keys.has(key),false,'DUPLICATE_MEMBER_IDENTITY');keys.add(key);}
 return{schema_version:'geox_mcft_cap08_s6_closure_member_manifest_v1',classification:synthetic?'SYNTHETIC_CONTRACT_MANIFEST_NOT_CLOSURE_EVIDENCE':'FINAL_FORMAL_CLOSURE_MEMBER_MANIFEST_V1',manifest_generated_by_final_formal_run:!synthetic,canonical_readback_verified:!synthetic,hard_acceptance_source_eligible:!synthetic,formal_run_id:plan.formal_run_id,scope:{...plan.scope},lineage_id:plan.lineage_id,revision_id:plan.revision_id,member_count:canonicalMembers.length,members:canonicalMembers,manifest_digest:`sha256:${sha(canonicalMembers)}`};
}
module.exports={buildClosureMemberManifestV1};
