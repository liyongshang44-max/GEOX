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
  failure:`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-V7-S4-PERSISTENCE-INTERLEAVE-FAILURE-V1.json`,
  correction:`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-S4-PERSISTENCE-INTERLEAVE-CORRECTION-V1.json`,
  boundary:`${D}/GEOX-MCFT-CAP-08-S6-RUN-A-QUALIFICATION-S4-PERSISTENCE-INTERLEAVE-CORRECTION-BOUNDARY-V1.json`,
  adapter:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/s6_s4_atomic_persistence_repository_v1.cjs',
  loader:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_loader_v1.cjs',
  chain:'scripts/runtime_acceptance/mcft_cap08_s6_single_run_ports/product_chain_v1.cjs',
  historical:'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_EXACT_DATABASE_PORT_BUNDLE_IMPLEMENTATION.cjs',
  reality:'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_QUALIFICATION_REALITY_BINDING_REPOSITORY_CORRECTION.cjs',
  composite:'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_QUALIFICATION_COMPOSITE_RANGE_CORRECTION.cjs',
  validator:'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_08_S6_RUN_A_QUALIFICATION_S4_PERSISTENCE_INTERLEAVE_CORRECTION.cjs',
  workflow:'.github/workflows/mcft-cap-08-s6-run-a-qualification-s4-persistence-interleave-correction.yml',
};
const OUT=X.join(R,'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_S4_PERSISTENCE_INTERLEAVE_CORRECTION_RESULT.json');
const read=p=>JSON.parse(F.readFileSync(X.join(R,p),'utf8'));
const text=p=>F.readFileSync(X.join(R,p),'utf8');
const git=(...args)=>P.execFileSync('git',args,{cwd:R,encoding:'utf8'}).trim();
function canonical(value){
  if(Array.isArray(value))return`[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
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
  return{
    type,
    payload:{
      ...scope,
      object_type:type,
      object_id:id,
      determinism_hash:`sha256:${String(index+1).padStart(64,'0')}`,
      logical_time:logicalTime,
      payload:{},
    },
  };
}
function buildMockClient(count,completionTupleCount=0){
  const scope={tenant_id:'tenantA',project_id:'projectA',group_id:'groupA',field_id:'fieldA',season_id:'seasonA',zone_id:'zoneA'};
  const records=[];
  for(let index=0;index<count;index+=1){
    const tick=record(scope,'twin_runtime_tick_v1',`tick_${index}`,index);
    tick.payload.payload={evidence_window_ref:`evidence_${index}`,assimilation_update_ref:`assimilation_${index}`};
    records.push(tick,record(scope,'twin_evidence_window_v1',`evidence_${index}`,index),record(scope,'twin_assimilation_update_v1',`assimilation_${index}`,index));
  }
  const client={
    async query(sql,args){
      if(sql.includes("semantic_payload->>'schema_version'")){
        return{rows:Array.from({length:completionTupleCount},(_,index)=>({authority_ref:`tuple_${index}`}))};
      }
      if(sql.includes("record_json->>'type'='twin_runtime_tick_v1'")){
        return{rows:records.filter(item=>item.type==='twin_runtime_tick_v1').map(record_json=>({record_json}))};
      }
      if(sql.includes("record_json->'payload'->>'object_id'=ANY")){
        const ids=new Set(args[0]);
        return{rows:records.filter(item=>ids.has(item.payload.object_id)).map(record_json=>({record_json}))};
      }
      throw new Error(`UNEXPECTED_MOCK_SQL:${sql}`);
    },
  };
  const p={cap08TickLogicalTimeV1:index=>new Date(Date.parse('2026-01-01T00:00:00.000Z')+index*3600000).toISOString()};
  return{scope,client,p};
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
    A.equal(changed.length,10);
    A.equal(changed.some(file=>/^(apps|packages|db|migrations)\//.test(file)),false);
    for(const value of[failure,correction,boundary])A.equal(value.semantic_digest,semanticDigest(value),'SEMANTIC_DIGEST');

    A.equal(failure.workflow_run_id,30656419611);
    A.equal(failure.authority_job.status,'PASS');
    A.equal(failure.execution_job.status,'FAIL');
    A.equal(failure.database_bootstrap_status,'PASS');
    A.equal(failure.database_drop_status,'PASS');
    A.equal(failure.qualification_artifact.artifact_id,8803425316);
    A.equal(failure.qualification_artifact.digest,'sha256:4f0a3b248095e84b7f040ac3be07fa2ada2b74f527d2a0d81ce6c2ee3dc6197d');
    A.equal(failure.qualification_artifact.result_present,false);
    A.equal(failure.first_failure.message,'CAP08_S4_S3_COMPLETION_TUPLE_CARDINALITY');
    A.equal(failure.operational_instance_reusable,false);
    A.equal(failure.database_identity_reusable,false);
    A.equal(failure.v7_authority_reusable,false);

    A.equal(git('rev-parse',`${base}:${PATHS.loader}`),correction.correction.old_product_loader_blob_sha);
    A.equal(git('rev-parse',`HEAD:${PATHS.loader}`),correction.correction.corrected_product_loader_blob_sha);
    A.equal(git('rev-parse',`HEAD:${PATHS.adapter}`),correction.correction.s6_s4_atomic_persistence_adapter_blob_sha);
    A.equal(git('rev-parse',`${base}:${PATHS.chain}`),correction.correction.unchanged_product_chain_blob_sha);
    A.equal(git('rev-parse',`HEAD:${PATHS.chain}`),correction.correction.unchanged_product_chain_blob_sha);
    A.equal(git('rev-parse',`HEAD:${PATHS.historical}`),correction.correction.historical_validator_blob_sha);
    A.equal(git('rev-parse',`HEAD:${PATHS.reality}`),correction.correction.reality_validator_blob_sha);
    A.equal(git('rev-parse',`HEAD:${PATHS.composite}`),correction.correction.composite_validator_blob_sha);

    const adapter=text(PATHS.adapter);
    const loader=text(PATHS.loader);
    for(const token of[
      'BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE',
      'pg_advisory_xact_lock',
      'S6_S4_INTERLEAVE_S3_COMPLETION_TUPLE_MUST_BE_ABSENT',
      'S6_S4_T00_T16_BASE_TICK_CARDINALITY',
      'S6_S4_BASE_T16_PREFIX_BINDING_MISMATCH',
      'INSERT INTO facts',
      'INSERT INTO twin_object_idempotency_index_v1',
      'INSERT INTO twin_runtime_authority_snapshot_v1',
      'S6_S4_APPEND_FORWARD_FINAL_READBACK_FAILED',
      'write_delta:7',
    ])A.ok(adapter.includes(token),`ADAPTER_TOKEN:${token}`);
    A.equal(adapter.includes('CAP08_S4_S3_COMPLETION_TUPLE_CARDINALITY'),false);
    for(const token of[
      "canonical_json_v1.ts",
      "cap08_s3_completion_tuple_v1.ts",
      "cap08_s4_append_forward_contracts_v1.ts",
      'S6_S4_PERSISTENCE_REPOSITORY_SEAM_REQUIRED',
      'createS6S4AtomicPersistenceRepositoryV1',
    ])A.ok(loader.includes(token),`LOADER_TOKEN:${token}`);

    for(const file of changed.filter(file=>file.endsWith('.cjs')))P.execFileSync(process.execPath,['--check',file],{cwd:R,stdio:'pipe'});
    const workflow=text(PATHS.workflow);
    A.match(workflow,/pull_request:/);
    A.doesNotMatch(workflow,/workflow_dispatch:/);
    A.doesNotMatch(workflow,/services:\s*\n\s*postgres:/);
    A.doesNotMatch(workflow,/DATABASE_URL/);

    const {buildS6T00T16BindingsV1,assertS6S4InterleaveNoCompletionTupleV1}=require(X.join(R,PATHS.adapter));
    const positive=buildMockClient(17,0);
    const bindings=await buildS6T00T16BindingsV1(positive);
    A.equal(bindings.length,17);
    A.equal(bindings[0].tick_id,'T00');
    A.equal(bindings[16].tick_id,'T16');
    const negative=buildMockClient(16,0);
    await A.rejects(()=>buildS6T00T16BindingsV1(negative),/S6_S4_T00_T16_BASE_TICK_CARDINALITY/);
    const authority={formal_run_id:'formal_run',scope:positive.scope};
    await assertS6S4InterleaveNoCompletionTupleV1({client:positive.client,authority});
    const fabricated=buildMockClient(17,1);
    await A.rejects(
      ()=>assertS6S4InterleaveNoCompletionTupleV1({client:fabricated.client,authority:{formal_run_id:'formal_run',scope:fabricated.scope}}),
      /S6_S4_INTERLEAVE_S3_COMPLETION_TUPLE_MUST_BE_ABSENT/,
    );

    A.equal(boundary.database_execution_performed,false);
    A.equal(boundary.workflow_dispatch_performed,false);
    A.equal(boundary.new_execution_authority_issued,false);
    A.equal(correction.effectiveness_required_before_replacement_authority,true);
    const result={
      schema_version:'geox_mcft_cap08_s6_run_a_qualification_s4_persistence_interleave_correction_result_v1',
      status:'PASS',
      subject_sha:git('rev-parse','HEAD'),
      base_sha:base,
      changed_file_count:changed.length,
      failed_workflow_run_id:failure.workflow_run_id,
      retired_operational_instance:failure.operational_run_instance_id,
      retired_database_name:failure.database_name,
      old_product_loader_blob_sha:correction.correction.old_product_loader_blob_sha,
      corrected_product_loader_blob_sha:correction.correction.corrected_product_loader_blob_sha,
      s6_s4_atomic_persistence_adapter_blob_sha:correction.correction.s6_s4_atomic_persistence_adapter_blob_sha,
      prefix_positive_vector_count:1,
      prefix_negative_vector_count:1,
      completion_tuple_absence_positive_vector_count:1,
      completion_tuple_fabrication_negative_vector_count:1,
      atomic_write_member_count:7,
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
      schema_version:'geox_mcft_cap08_s6_run_a_qualification_s4_persistence_interleave_correction_result_v1',
      status:'FAIL',
      error:error instanceof Error?error.stack||error.message:String(error),
    });
    console.error(error);
    process.exitCode=1;
  }
})();
