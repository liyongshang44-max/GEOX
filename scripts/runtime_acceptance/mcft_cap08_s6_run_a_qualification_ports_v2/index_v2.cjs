'use strict';
const {Pool}=require('pg');
const {validateFactoryAuthorityV1}=require('../mcft_cap08_s6_run_a_qualification_ports/index_v1.cjs');
const {createQualificationFreshDatabasePortV1}=require('../mcft_cap08_s6_run_a_qualification_ports/fresh_database_v1.cjs');
const {createDirectQualificationMaterializerV2}=require('./direct_materializer_v2.cjs');
const {createClosureReaderV1}=require('../mcft_cap08_s6_single_run_ports/closure_reader_v1.cjs');
const {createRecoveryPortV1}=require('../mcft_cap08_s6_single_run_ports/recovery_v1.cjs');
const {createCap07ReaderV1}=require('../mcft_cap08_s6_single_run_ports/cap07_reader_v1.cjs');
const {createArtifactWriterV1}=require('../mcft_cap08_s6_single_run_ports/artifact_writer_v1.cjs');

async function createPortsV2({root,authority,exactSubjectSha,runLabel,operationalRunInstanceId}){
  validateFactoryAuthorityV1({authority,exactSubjectSha,runLabel,operationalRunInstanceId});
  const databaseUrl=String(process.env.DATABASE_URL||'');
  const adminUrl=String(process.env.MCFT_CAP08_ADMIN_DATABASE_URL||'');
  if(!databaseUrl||!adminUrl)throw new Error('QUALIFICATION_V2_PORT_BUNDLE_DATABASE_URLS_REQUIRED');
  const pool=new Pool({connectionString:databaseUrl,max:6});
  const adminPool=new Pool({connectionString:adminUrl,max:4});
  const shared={receipts:[],selector:null,recovery:new Map(),readModel:new Map()};
  return{
    freshDatabase:createQualificationFreshDatabasePortV1({pool,adminPool}),
    materializer:createDirectQualificationMaterializerV2({root,pool,adminPool,shared,authority}),
    closureReader:createClosureReaderV1({pool}),
    recovery:createRecoveryPortV1({pool,adminPool,shared}),
    cap07Reader:await createCap07ReaderV1({root,pool,shared}),
    artifactWriter:createArtifactWriterV1({root}),
  };
}

module.exports={createPortsV1:createPortsV2,createPortsV2,validateFactoryAuthorityV1};
