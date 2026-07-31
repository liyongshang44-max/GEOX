'use strict';
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const {createFreshDatabasePortV1}=require('../mcft_cap08_s6_single_run_ports/fresh_database_v1.cjs');
const {createDirectQualificationMaterializerV1}=require('./direct_materializer_v1.cjs');
const {createClosureReaderV1}=require('../mcft_cap08_s6_single_run_ports/closure_reader_v1.cjs');
const {createRecoveryPortV1}=require('../mcft_cap08_s6_single_run_ports/recovery_v1.cjs');
const {createCap07ReaderV1}=require('../mcft_cap08_s6_single_run_ports/cap07_reader_v1.cjs');
const {createArtifactWriterV1}=require('../mcft_cap08_s6_single_run_ports/artifact_writer_v1.cjs');
function validateFactoryAuthorityV1({authority,exactSubjectSha,runLabel,operationalRunInstanceId}){
 assert.equal(authority?.record_status,'SINGLE_DEVELOPMENT_QUALIFICATION_RUN_DATABASE_EXECUTION_AUTHORIZED','QUALIFICATION_AUTHORITY_REQUIRED');
 assert.equal(authority.authority_class,'DEVELOPMENT_QUALIFICATION_ONLY');
 assert.equal(authority.evidence_class,'DEVELOPMENT_QUALIFICATION_ONLY');
 assert.equal(authority.exact_subject_sha,exactSubjectSha,'QUALIFICATION_AUTHORITY_SUBJECT');
 assert.equal(authority.authorized_run_label,runLabel,'QUALIFICATION_AUTHORITY_RUN_LABEL');
 assert.equal(authority.operational_run_instance_id,operationalRunInstanceId,'QUALIFICATION_AUTHORITY_INSTANCE');
 assert.equal(authority.final_formal_run_execution_authorized,false);
}
async function createPortsV1({root,authority,exactSubjectSha,runLabel,operationalRunInstanceId}){
 validateFactoryAuthorityV1({authority,exactSubjectSha,runLabel,operationalRunInstanceId});
 const databaseUrl=String(process.env.DATABASE_URL||'');
 const adminUrl=String(process.env.MCFT_CAP08_ADMIN_DATABASE_URL||'');
 if(!databaseUrl||!adminUrl)throw new Error('QUALIFICATION_PORT_BUNDLE_DATABASE_URLS_REQUIRED');
 const pool=new Pool({connectionString:databaseUrl,max:6});
 const adminPool=new Pool({connectionString:adminUrl,max:4});
 const shared={receipts:[],selector:null,recovery:new Map(),readModel:new Map()};
 return{
  freshDatabase:createFreshDatabasePortV1({pool,adminPool}),
  materializer:createDirectQualificationMaterializerV1({root,pool,adminPool,shared}),
  closureReader:createClosureReaderV1({pool}),
  recovery:createRecoveryPortV1({pool,adminPool,shared}),
  cap07Reader:await createCap07ReaderV1({root,pool,shared}),
  artifactWriter:createArtifactWriterV1({root})
 };
}
module.exports={createPortsV1,validateFactoryAuthorityV1};
