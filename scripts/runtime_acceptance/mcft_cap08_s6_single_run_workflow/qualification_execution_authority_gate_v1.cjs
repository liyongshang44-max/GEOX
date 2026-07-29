'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {validateRepoRelativeModulePathV1}=require('./workflow_port_bundle_contract_v1.cjs');
function canonical(v){if(Array.isArray(v))return`[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;return JSON.stringify(v);}
function digest(v){return`sha256:${crypto.createHash('sha256').update(canonical(v)).digest('hex')}`;}
function validateQualificationAuthorityV1(authority,input){
 assert.ok(authority&&typeof authority==='object'&&!Array.isArray(authority),'QUALIFICATION_AUTHORITY_OBJECT_REQUIRED');
 assert.equal(authority.record_status,'SINGLE_DEVELOPMENT_QUALIFICATION_RUN_DATABASE_EXECUTION_AUTHORIZED');
 assert.equal(authority.authority_class,'DEVELOPMENT_QUALIFICATION_ONLY');
 assert.equal(authority.evidence_class,'DEVELOPMENT_QUALIFICATION_ONLY');
 assert.equal(authority.single_run_database_execution_authorized,true);
 assert.equal(authority.database_execution_workflow_authorized,true);
 assert.equal(authority.workflow_dispatch_execution_authorized,true);
 assert.equal(authority.final_formal_run_execution_authorized,false);
 assert.equal(authority.final_closure_eligible,false);
 assert.equal(authority.hard_acceptance_eligible,false);
 assert.equal(authority.s6_candidate_evidence_eligible,false);
 assert.equal(authority.cross_run_comparison_eligible,false);
 assert.equal(authority.ledger_settlement_eligible,false);
 assert.equal(authority.dual_run_ci_authorized,false);
 assert.equal(authority.cross_run_comparator_authorized,false);
 assert.equal(authority.final_ledger_settlement_authorized,false);
 assert.equal(authority.exact_subject_sha,input.exactSubjectSha,'QUALIFICATION_AUTHORITY_SUBJECT');
 assert.match(input.exactSubjectSha,/^[0-9a-f]{40}$/);
 assert.equal(input.runLabel,'RUN_A','QUALIFICATION_RUN_LABEL_INPUT');
 assert.equal(authority.authorized_run_label,'RUN_A','QUALIFICATION_AUTHORITY_RUN_LABEL');
 assert.equal(authority.operational_run_instance_id,input.operationalRunInstanceId,'QUALIFICATION_AUTHORITY_INSTANCE');
 assert.match(input.operationalRunInstanceId,/^[A-Za-z0-9._:-]{8,128}$/);
 const modulePath=validateRepoRelativeModulePathV1(authority.port_bundle_path);
 assert.match(authority.port_bundle_blob_sha,/^[0-9a-f]{40}$/,'PORT_BUNDLE_BLOB_SHA');
 assert.match(authority.qualification_workflow_blob_sha,/^[0-9a-f]{40}$/,'QUALIFICATION_WORKFLOW_BLOB_SHA');
 assert.match(authority.qualification_gate_blob_sha,/^[0-9a-f]{40}$/,'QUALIFICATION_GATE_BLOB_SHA');
 const db=authority.database_identity;
 assert.ok(db&&typeof db==='object'&&!Array.isArray(db),'QUALIFICATION_DATABASE_IDENTITY_REQUIRED');
 assert.match(db.database_name,/^[a-z][a-z0-9_]{7,62}$/,'QUALIFICATION_DATABASE_NAME');
 assert.equal(db.fresh_disposable_required,true);
 assert.equal(db.drop_after_run_required,true);
 assert.equal(db.identity_frozen,true);
 assert.match(authority.expires_at,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,'AUTHORITY_EXPIRY');
 assert.ok(Date.parse(authority.expires_at)>Date.now(),'QUALIFICATION_AUTHORITY_EXPIRED');
 return{authority,module_path:modulePath,database_name:db.database_name,authority_digest:digest(authority)};
}
function gateFromEnvironmentV1({root=path.resolve(__dirname,'../../..'),writeOutput=true}={}){
 const authorityPath=String(process.env.MCFT_CAP08_EXECUTION_AUTHORITY_PATH||'').trim();
 const exactSubjectSha=String(process.env.MCFT_CAP08_EXACT_SUBJECT_SHA||'').trim();
 const operationalRunInstanceId=String(process.env.MCFT_CAP08_OPERATIONAL_RUN_INSTANCE_ID||'').trim();
 const runLabel='RUN_A';
 assert.match(authorityPath,/^docs\/digital_twin\/mcft\/cap_08\/[A-Za-z0-9_.-]+\.json$/,'QUALIFICATION_AUTHORITY_PATH');
 const authority=JSON.parse(fs.readFileSync(path.join(root,authorityPath),'utf8'));
 const result=validateQualificationAuthorityV1(authority,{exactSubjectSha,runLabel,operationalRunInstanceId});
 const normalizedPath=path.join(root,'acceptance-output/MCFT_CAP_08_S6_NORMALIZED_RUN_A_QUALIFICATION_AUTHORITY.json');
 fs.mkdirSync(path.dirname(normalizedPath),{recursive:true});
 fs.writeFileSync(normalizedPath,JSON.stringify(result.authority,null,2)+'\n');
 if(writeOutput&&process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,[
  'authorized=true',`exact_subject_sha=${exactSubjectSha}`,'run_label=RUN_A',
  `operational_run_instance_id=${operationalRunInstanceId}`,`authority_path=${authorityPath}`,
  `authority_digest=${result.authority_digest}`,`port_bundle_path=${result.module_path}`,
  `port_bundle_blob_sha=${authority.port_bundle_blob_sha}`,
  `qualification_workflow_blob_sha=${authority.qualification_workflow_blob_sha}`,
  `qualification_gate_blob_sha=${authority.qualification_gate_blob_sha}`,
  `database_name=${result.database_name}`
 ].join('\n')+'\n');
 return{...result,normalized_path:normalizedPath};
}
if(require.main===module){try{const r=gateFromEnvironmentV1();console.log(JSON.stringify({status:'AUTHORIZED_FOR_DEVELOPMENT_QUALIFICATION_ONLY',authority_digest:r.authority_digest,module_path:r.module_path,database_name:r.database_name},null,2));}catch(e){console.error(e);process.exitCode=1;}}
module.exports={canonical,digest,validateQualificationAuthorityV1,gateFromEnvironmentV1};
