'use strict';
const {Pool}=require('pg');
const {createFreshDatabasePortV1}=require('./fresh_database_v1.cjs');
const {createDirectMaterializerV1}=require('./direct_materializer_v1.cjs');
const {createClosureReaderV1}=require('./closure_reader_v1.cjs');
const {createRecoveryPortV1}=require('./recovery_v1.cjs');
const {createCap07ReaderV1}=require('./cap07_reader_v1.cjs');
const {createArtifactWriterV1}=require('./artifact_writer_v1.cjs');
async function createPortsV1({root}){const databaseUrl=String(process.env.DATABASE_URL||'');const adminUrl=String(process.env.MCFT_CAP08_ADMIN_DATABASE_URL||'');if(!databaseUrl||!adminUrl)throw new Error('PORT_BUNDLE_DATABASE_URLS_REQUIRED');const pool=new Pool({connectionString:databaseUrl,max:6}),adminPool=new Pool({connectionString:adminUrl,max:4});const shared={receipts:[],selector:null,recovery:new Map(),readModel:new Map()};return{freshDatabase:createFreshDatabasePortV1({pool,adminPool}),materializer:createDirectMaterializerV1({root,pool,adminPool,shared}),closureReader:createClosureReaderV1({pool}),recovery:createRecoveryPortV1({pool,adminPool,shared}),cap07Reader:await createCap07ReaderV1({root,pool,shared}),artifactWriter:createArtifactWriterV1({root})};}
module.exports={createPortsV1};
