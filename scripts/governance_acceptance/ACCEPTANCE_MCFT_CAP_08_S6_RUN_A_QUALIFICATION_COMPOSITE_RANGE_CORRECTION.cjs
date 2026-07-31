#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict');
const C=require('node:crypto');
const P=require('node:child_process');
const F=require('node:fs');
const X=require('node:path');

const R=X.resolve(__dirname,'../..');
const D='docs/digital_twin/mcft/cap_08';
const PATHS={
  failure:`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-V6-COMPOSITE-RANGE-FAILURE-V1.json`,
  correction:`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-COMPOSITE-RANGE-CORRECTION-V1.json`,
  boundary:`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-COMPOSITE-RANGE-CORRECTION-BOUNDARY-V1.json`,
  chain:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_chain_v1.cjs',
  loader:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_loader_v1.cjs',
  historical:'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_EXACT_DATABASE_PORT_BUNDLE_IMPLEMENTATION.cjs',
  realityValidator:'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_QUALIFICATION_REALITY_BINDING_REPOSITORY_CORRECTION.cjs',
  validator:'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_QUALIFICATION_COMPOSITE_RANGE_CORRECTION.cjs',
  workflow:'.github/workflows/mcft-cap-08-s6-run-a-qualification-composite-range-correction.yml',
};
const OUT=X.join(R,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_COMPOSITE_RANGE_CORRECTION_RESULT.json');
const read=p=>JSON.parse(F.readFileSync(X.join(R,p),'utf8'));
const text=p=>F.readFileSync(X.join(R,p),'utf8');
const git=(...args)=>P.execFileSync('git',args,{cwd:R,encoding:'utf8'}).trim();
function canonical(value){
  if(Array.isArray(value))return`[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object'){
    return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
function semanticDigest(value){
  const copy=structuredClone(value);
  delete copy.semantic_digest;
  return`sha256:${C.createHash('sha256').update(canonical(copy)).digest('hex')}`;
}
function write(value){
  F.mkdirSync(X.dirname(OUT),{recursive:true});
  F.writeFileSync(OUT,JSON.stringify(value,null,2)+'\n');
}
function record(scope,type,id,index){
  const logicalTime=new Date(Date.parse('2026-01-01T00:00:00.000Z')+index*3600000).toISOString();
  const payload={
    ...scope,
    object_type:type,
    object_id:id,
    determinism_hash:`sha256:${String(index+1).padStart(64,'0')}`,
    logical_time:logicalTime,
    payload:{},
  };
  return{type,payload};
}
function buildMockRows(count){
  const scope={tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',field_id:'fieldA',season_id:'seasonA',zone_id:'zoneA'};
  const records=[];
  for(let index=0;index<count;index+=1){
    const tick=record(scope,'twin_runtime_tick_v1',`tick_${index}`,index);
    tick.payload.payload={
      evidence_window_ref:`evidence_${index}`,
      assimilation_update_ref:`assimilation_${index}`,
    };
    records.push(tick);
    records.push(record(scope,'twin_evidence_window_v1',`evidence_${index}`,index));
    records.push(record(scope,'twin_assimilation_update_v1',`assimilation_${index}`,index));
  }
  const p={cap08TickLogicalTimeV1:index=>new Date(Date.parse('2026-01-01T00:00:00.000Z')+index*3600000).toISOString()};
  const pool={
    async query(sql,args){
      if(sql.includes("record_json->>'type'='twin_runtime_tick_v1'")){
        return{rows:records.filter(item=>item.type==='twin_runtime_tick_v1').map(record_json=>({record_json}))};
      }
      const ids=new Set(args[0]);
      return{rows:records.filter(item=>ids.has(item.payload.object_id)).map(record_json=>({record_json}))};
    },
  };
  return{scope,p,pool};
}
(async()=>{
  try{
    const failure=read(PATHS.failure);
    const correction=read(PATHS.correction);
    const boundary=read(PATHS.boundary);
    const base=String(process.env.MCFT_BASE_SHA||boundary.base_main_sha).trim();
    A.equal(base,boundary.base_main_sha);
    A.equal(git('merge-base',base,'HEAD'),base);
    A.equal(git('diff','--check',`${base}...HEAD`),'');
    const changed=git('diff','--name-only',`${base}...HEAD`).split(/\r?\n/).filter(Boolean).sort();
    A.deepEqual(changed,[...boundary.changed_files].sort());
    A.equal(changed.length,9);
    A.equal(changed.some(file=>/^(apps|packages|db|migrations)\//.test(file)),false);
    for(const value of[failure,correction,boundary]){
      A.equal(value.semantic_digest,semanticDigest(value),'SEMANTIC_DIGEST');
    }

    A.equal(failure.workflow_run_id,30644371587);
    A.equal(failure.authority_job.status,'PASS');
    A.equal(failure.execution_job.status,'FAIL');
    A.equal(failure.database_bootstrap_status,'PASS');
    A.equal(failure.database_drop_status,'PASS');
    A.equal(failure.first_failure.message,'CAP08_S4_S3_COMPLETION_TUPLE_CARDINALITY');
    A.equal(failure.operational_instance_reusable,false);
    A.equal(failure.database_identity_reusable,false);

    A.equal(git('rev-parse',`${base}:${PATHS.chain}`),correction.correction.old_product_chain_blob_sha);
    A.equal(git('rev-parse',`HEAD:${PATHS.chain}`),correction.correction.corrected_product_chain_blob_sha);
    A.equal(git('rev-parse',`${base}:${PATHS.loader}`),correction.correction.old_product_loader_blob_sha);
    A.equal(git('rev-parse',`HEAD:${PATHS.loader}`),correction.correction.corrected_product_loader_blob_sha);
    A.equal(git('rev-parse',`HEAD:${PATHS.realityValidator}`),correction.correction.reality_binding_validator_blob_sha);

    const chain=text(PATHS.chain);
    const loader=text(PATHS.loader);
    const realityValidator=text(PATHS.realityValidator);
    A.ok(realityValidator.includes('SUCCESSOR_RUN_A_QUALIFICATION_COMPOSITE_RANGE_CORRECTION'));
    for(const token of[
      'S6_FINAL_FORMAL_COMPOSITE_RANGE',
      'buildS6T00T16BindingsV1',
      'createS6PrefixTransportReaderV1',
      'S6_T00_T16_TICK_CARDINALITY',
      'S4_MUST_EXECUTE_BETWEEN_T16_AND_T17',
      'T17_MUST_CONSUME_CORRECTED_T16_POSTERIOR',
      "slice_acceptance_only:false",
      'final_formal_run_id:spec.formal_run_id',
    ])A.ok(chain.includes(token),`COMPOSITE_TOKEN:${token}`);
    for(const forbidden of[
      'new p.Cap08S3FormalRangeServiceV1',
      'new p.Cap08S3FormalRuntimeServiceV1',
      'new p.PostgresCap08S3CompletionAuthorityPairRepositoryV1',
    ])A.equal(chain.includes(forbidden),false,`S3_SLICE_ORCHESTRATOR_FORBIDDEN:${forbidden}`);
    A.ok(loader.includes('cap08_s4_persisted_chain_reader_v1.ts'));
    for(const forbidden of[
      'cap08_s3_formal_range_service_v1.ts',
      'cap08_s3_formal_runtime_service_v1.ts',
      'postgres_cap08_s3_completion_authority_pair_repository_v1.ts',
    ])A.equal(loader.includes(forbidden),false,`S3_SLICE_LOADER_FORBIDDEN:${forbidden}`);

    for(const file of changed.filter(file=>file.endsWith('.cjs'))){
      P.execFileSync(process.execPath,['--check',file],{cwd:R,stdio:'pipe'});
    }
    const workflow=text(PATHS.workflow);
    A.match(workflow,/pull_request:/);
    A.doesNotMatch(workflow,/workflow_dispatch:/);
    A.doesNotMatch(workflow,/services:\s*\n\s*postgres:/);
    A.doesNotMatch(workflow,/DATABASE_URL/);

    const {buildS6T00T16BindingsV1}=require(X.join(R,PATHS.chain));
    const positive=buildMockRows(17);
    const bindings=await buildS6T00T16BindingsV1(positive);
    A.equal(bindings.length,17);
    A.equal(bindings[0].tick_id,'T00');
    A.equal(bindings[16].tick_id,'T16');
    const negative=buildMockRows(16);
    await A.rejects(
      ()=>buildS6T00T16BindingsV1(negative),
      /S6_T00_T16_TICK_CARDINALITY/,
    );

    A.equal(boundary.database_execution_performed,false);
    A.equal(boundary.workflow_dispatch_performed,false);
    A.equal(boundary.new_execution_authority_issued,false);
    A.equal(correction.effectiveness_required_before_replacement_authority,true);
    const result={
      schema_version:'geox_mcft_cap08_s6_run_a_qualification_composite_range_correction_result_v1',
      status:'PASS',
      subject_sha:git('rev-parse','HEAD'),
      base_sha:base,
      changed_file_count:changed.length,
      failed_workflow_run_id:failure.workflow_run_id,
      retired_operational_instance:failure.operational_run_instance_id,
      old_product_chain_blob_sha:correction.correction.old_product_chain_blob_sha,
      corrected_product_chain_blob_sha:correction.correction.corrected_product_chain_blob_sha,
      old_product_loader_blob_sha:correction.correction.old_product_loader_blob_sha,
      corrected_product_loader_blob_sha:correction.correction.corrected_product_loader_blob_sha,
      composite_range_positive_vector_count:1,
      composite_range_negative_vector_count:1,
      t00_t16_binding_count:bindings.length,
      s3_slice_orchestrator_reuse_count:0,
      product_runtime_source_file_count:0,
      database_migration_file_count:0,
      database_execution_performed:false,
      workflow_dispatch_performed:false,
      new_execution_authority_issued:false,
      run_a_qualification_completed:false,
      s6_candidate_implemented:false,
      mcft_cap_08_complete:false,
      mcft_cap_09_authorized:false,
    };
    write(result);
    console.log(JSON.stringify(result,null,2));
  }catch(error){
    write({
      schema_version:'geox_mcft_cap08_s6_run_a_qualification_composite_range_correction_result_v1',
      status:'FAIL',
      error:error instanceof Error?error.stack||error.message:String(error),
    });
    console.error(error);
    process.exitCode=1;
  }
})();
