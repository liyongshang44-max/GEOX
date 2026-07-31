'use strict';
const assert=require('node:assert/strict');

const S3_COMPLETION_SCHEMA='geox_mcft_cap08_s3_completion_tuple_v1';
const FACT_SOURCE='mcft_cap08_s4_late_append_forward_v1';
const IDENTITY_KIND='OBJECT';

function recordObjectV1(value,code){
  const record=typeof value==='string'?JSON.parse(value):value;
  assert.ok(record&&typeof record==='object'&&!Array.isArray(record),code);
  const object=record.payload;
  assert.ok(object&&typeof object==='object'&&!Array.isArray(object),`${code}_PAYLOAD`);
  assert.equal(record.type,object.object_type,`${code}_TYPE`);
  return object;
}
function exactScopeV1(object,scope,code){
  for(const field of ['tenant_id','project_id','group_id','field_id','season_id','zone_id']){
    assert.equal(object[field],scope[field],`${code}:${field}`);
  }
}
function requiredRefV1(value,code){
  assert.equal(typeof value,'string',code);
  assert.ok(value.trim(),code);
  return value;
}
function scopeValuesV1(scope){
  return[scope.tenant_id,scope.project_id,scope.group_id,scope.field_id,scope.season_id,scope.zone_id];
}
function jsonObjectV1(value,code){
  const parsed=typeof value==='string'?JSON.parse(value):value;
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error(code);
  return parsed;
}
function factIdV1(objectId){return`fact_${objectId}`;}
function recordJsonV1(object){return JSON.stringify({type:object.object_type,payload:object});}
function correctedObjectsV1(set){return[set.state,set.forecast,set.scenario,set.tick,set.checkpoint];}
function correctedBindingsV1(authority){
  return[
    authority.corrected_objects.state,
    authority.corrected_objects.forecast,
    authority.corrected_objects.scenario,
    authority.corrected_objects.tick,
    authority.corrected_objects.checkpoint,
  ];
}
function correctedHashesV1(authority){
  return Object.fromEntries(correctedBindingsV1(authority).map(binding=>[binding.ref,binding.hash]));
}
async function readAuthorityV1(client,p,authorityRef){
  const result=await client.query(
    `SELECT determinism_hash,semantic_payload FROM twin_runtime_authority_snapshot_v1
      WHERE authority_kind=$1 AND authority_ref=$2`,
    [p.CAP08_S4_AUTHORITY_KIND_V1,authorityRef],
  );
  if(result.rows.length===0)return null;
  if(result.rows.length!==1)throw new Error('S6_S4_AUTHORITY_CARDINALITY');
  return result.rows[0];
}
async function readGuardV1(client,key){
  const result=await client.query(
    `SELECT identity_kind,record_set_id,determinism_hash,identity_basis,
            member_object_ids,member_determinism_hashes
       FROM twin_object_idempotency_index_v1 WHERE idempotency_key=$1`,
    [key],
  );
  if(result.rows.length===0)return null;
  if(result.rows.length!==1)throw new Error('S6_S4_IDEMPOTENCY_GUARD_CARDINALITY');
  return result.rows[0];
}
async function readFactsV1(client,objectIds){
  const ids=[...new Set(objectIds)];
  if(ids.length===0)return new Map();
  const result=await client.query(
    `SELECT record_json FROM facts
      WHERE record_json->'payload'->>'object_id'=ANY($1::text[]) ORDER BY fact_id`,
    [ids],
  );
  const objects=new Map();
  for(const row of result.rows){
    const object=recordObjectV1(row.record_json,'S6_S4_FACT_RECORD');
    if(objects.has(object.object_id))throw new Error('S6_S4_CANONICAL_OBJECT_ID_NOT_UNIQUE');
    objects.set(object.object_id,object);
  }
  return objects;
}
async function verifyBindingsV1(client,bindings,missingCode,mismatchCode){
  const facts=await readFactsV1(client,bindings.map(binding=>binding.ref));
  if(facts.size!==bindings.length)throw new Error(missingCode);
  for(const binding of bindings){
    if(facts.get(binding.ref)?.determinism_hash!==binding.hash)throw new Error(mismatchCode);
  }
}
async function buildS6T00T16BindingsV1({client,p,scope,excluded_tick_ref=null}){
  const from=p.cap08TickLogicalTimeV1(0);
  const to=p.cap08TickLogicalTimeV1(16);
  const rows=await client.query(
    `SELECT record_json FROM facts
      WHERE record_json->>'type'='twin_runtime_tick_v1'
        AND record_json->'payload'->>'tenant_id'=$1
        AND record_json->'payload'->>'project_id'=$2
        AND record_json->'payload'->>'group_id'=$3
        AND record_json->'payload'->>'field_id'=$4
        AND record_json->'payload'->>'season_id'=$5
        AND record_json->'payload'->>'zone_id'=$6
        AND record_json->'payload'->>'logical_time'>=$7
        AND record_json->'payload'->>'logical_time'<=$8
      ORDER BY record_json->'payload'->>'logical_time',fact_id`,
    [...scopeValuesV1(scope),from,to],
  );
  const ticks=rows.rows
    .map((row,index)=>recordObjectV1(row.record_json,`S6_S4_PREFIX_TICK_${index}`))
    .filter(tick=>tick.object_id!==excluded_tick_ref);
  assert.equal(ticks.length,17,'S6_S4_T00_T16_BASE_TICK_CARDINALITY');
  const refs=ticks.flatMap((tick,index)=>{
    assert.equal(tick.object_type,'twin_runtime_tick_v1',`S6_S4_PREFIX_TICK_TYPE:${index}`);
    assert.equal(tick.logical_time,p.cap08TickLogicalTimeV1(index),`S6_S4_PREFIX_TICK_TIME:${index}`);
    exactScopeV1(tick,scope,`S6_S4_PREFIX_TICK_SCOPE:${index}`);
    const payload=tick.payload;
    assert.ok(payload&&typeof payload==='object'&&!Array.isArray(payload),'S6_S4_PREFIX_TICK_PAYLOAD');
    return[
      requiredRefV1(payload.evidence_window_ref,'S6_S4_PREFIX_EVIDENCE_REF'),
      requiredRefV1(payload.assimilation_update_ref,'S6_S4_PREFIX_ASSIMILATION_REF'),
    ];
  });
  const children=await client.query(
    `SELECT record_json FROM facts
      WHERE record_json->'payload'->>'object_id'=ANY($1::text[])
      ORDER BY fact_id`,
    [[...new Set(refs)]],
  );
  const byId=new Map();
  for(const row of children.rows){
    const object=recordObjectV1(row.record_json,'S6_S4_PREFIX_CHILD');
    if(byId.has(object.object_id))throw new Error('S6_S4_PREFIX_CHILD_DUPLICATE');
    byId.set(object.object_id,object);
  }
  assert.equal(byId.size,new Set(refs).size,'S6_S4_PREFIX_CHILD_CARDINALITY');
  return ticks.map((tick,index)=>{
    const evidence=byId.get(tick.payload.evidence_window_ref);
    const assimilation=byId.get(tick.payload.assimilation_update_ref);
    assert.equal(evidence?.object_type,'twin_evidence_window_v1',`S6_S4_PREFIX_EVIDENCE_TYPE:${index}`);
    assert.equal(assimilation?.object_type,'twin_assimilation_update_v1',`S6_S4_PREFIX_ASSIMILATION_TYPE:${index}`);
    exactScopeV1(evidence,scope,`S6_S4_PREFIX_EVIDENCE_SCOPE:${index}`);
    exactScopeV1(assimilation,scope,`S6_S4_PREFIX_ASSIMILATION_SCOPE:${index}`);
    assert.equal(evidence.logical_time,tick.logical_time,`S6_S4_PREFIX_EVIDENCE_TIME:${index}`);
    assert.equal(assimilation.logical_time,tick.logical_time,`S6_S4_PREFIX_ASSIMILATION_TIME:${index}`);
    return{
      tick_id:`T${String(index).padStart(2,'0')}`,
      logical_time:tick.logical_time,
      tick_ref:tick.object_id,
      tick_hash:tick.determinism_hash,
      evidence_window_ref:evidence.object_id,
      evidence_window_hash:evidence.determinism_hash,
      assimilation_update_ref:assimilation.object_id,
      assimilation_update_hash:assimilation.determinism_hash,
    };
  });
}
async function assertS6S4InterleaveNoCompletionTupleV1({client,authority}){
  const result=await client.query(
    `SELECT authority_ref FROM twin_runtime_authority_snapshot_v1
      WHERE semantic_payload->>'schema_version'=$1
        AND semantic_payload->>'formal_run_id'=$2
        AND semantic_payload->'scope'->>'tenant_id'=$3
        AND semantic_payload->'scope'->>'project_id'=$4
        AND semantic_payload->'scope'->>'group_id'=$5
        AND semantic_payload->'scope'->>'field_id'=$6
        AND semantic_payload->'scope'->>'season_id'=$7
        AND semantic_payload->'scope'->>'zone_id'=$8`,
    [S3_COMPLETION_SCHEMA,authority.formal_run_id,...scopeValuesV1(authority.scope)],
  );
  if(result.rows.length!==0)throw new Error('S6_S4_INTERLEAVE_S3_COMPLETION_TUPLE_MUST_BE_ABSENT');
}
async function validateExternalBindingsV1(client,p,authority){
  await assertS6S4InterleaveNoCompletionTupleV1({client,authority});
  const prefix=await buildS6T00T16BindingsV1({
    client,p,scope:authority.scope,excluded_tick_ref:authority.corrected_objects.tick.ref,
  });
  const t16=prefix.filter(binding=>binding.tick_id==='T16');
  if(t16.length!==1
    ||t16[0].tick_ref!==authority.identity_input.base_t16_tick.ref
    ||t16[0].tick_hash!==authority.identity_input.base_t16_tick.hash){
    throw new Error('S6_S4_BASE_T16_PREFIX_BINDING_MISMATCH');
  }
  await verifyBindingsV1(client,[
    authority.identity_input.base_t16_state,
    authority.identity_input.base_t16_forecast,
    authority.identity_input.base_t16_tick,
    authority.identity_input.base_t16_checkpoint,
    authority.identity_input.source_t01_state,
  ],'S6_S4_BASE_BINDING_OBJECT_MISSING','S6_S4_BASE_BINDING_HASH_MISMATCH');
  await verifyBindingsV1(client,[
    ...authority.historical_hash_manifest.state_bindings,
    ...authority.historical_hash_manifest.forecast_bindings,
  ],'S6_S4_HISTORICAL_OBJECT_MISSING','S6_S4_HISTORICAL_HASH_MUTATION_DETECTED');
}
function reconstructSetV1(authority,facts){
  const requireObject=(binding,type,code)=>{
    const object=facts.get(binding.ref);
    if(!object||object.object_type!==type||object.determinism_hash!==binding.hash)throw new Error(code);
    return object;
  };
  return{
    state:requireObject(authority.corrected_objects.state,'twin_state_estimate_v1','S6_S4_CORRECTED_STATE_INVALID'),
    forecast:requireObject(authority.corrected_objects.forecast,'twin_forecast_run_v1','S6_S4_CORRECTED_FORECAST_INVALID'),
    scenario:requireObject(authority.corrected_objects.scenario,'twin_scenario_set_v1','S6_S4_CORRECTED_SCENARIO_INVALID'),
    tick:requireObject(authority.corrected_objects.tick,'twin_runtime_tick_v1','S6_S4_CORRECTED_TICK_INVALID'),
    checkpoint:requireObject(authority.corrected_objects.checkpoint,'twin_runtime_checkpoint_v1','S6_S4_CORRECTED_CHECKPOINT_INVALID'),
  };
}
async function inspectWithClientV1(client,p,requested){
  if(requested.schema_version!==p.CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1){
    throw new Error('S6_S4_REQUESTED_AUTHORITY_SCHEMA_MISMATCH');
  }
  const bindings=correctedBindingsV1(requested);
  const [authorityRow,guard,facts]=await Promise.all([
    readAuthorityV1(client,p,requested.authority_ref),
    readGuardV1(client,requested.idempotency_key),
    readFactsV1(client,bindings.map(binding=>binding.ref)),
  ]);
  const presence=Number(Boolean(authorityRow))+Number(Boolean(guard))+facts.size;
  if(presence===0)return{disposition:'NOT_ESTABLISHED',authority:null,corrected_set:null,write_delta:0};
  if(!authorityRow||!guard||facts.size!==5)throw new Error('S6_S4_APPEND_FORWARD_PARTIAL_SET');
  const authority=structuredClone(jsonObjectV1(authorityRow.semantic_payload,'S6_S4_AUTHORITY_PAYLOAD_INVALID'));
  if(authorityRow.determinism_hash!==authority.determinism_hash
    ||authority.authority_ref!==requested.authority_ref
    ||authority.idempotency_key!==requested.idempotency_key
    ||p.canonicalJsonV1(authority.identity_input)!==p.canonicalJsonV1(requested.identity_input)){
    throw new Error('S6_S4_EXISTING_AUTHORITY_CONFLICT');
  }
  const basis=jsonObjectV1(guard.identity_basis,'S6_S4_GUARD_IDENTITY_BASIS_INVALID');
  const storedIds=Array.isArray(guard.member_object_ids)
    ?[...guard.member_object_ids]
    :Object.values(jsonObjectV1(guard.member_object_ids,'S6_S4_GUARD_MEMBER_IDS_INVALID'));
  if(guard.identity_kind!==IDENTITY_KIND
    ||guard.record_set_id!==authority.authority_ref
    ||guard.determinism_hash!==authority.determinism_hash
    ||basis.schema_version!==authority.schema_version
    ||basis.contract_id!==authority.contract_id
    ||p.canonicalJsonV1(basis.identity_input)!==p.canonicalJsonV1(authority.identity_input)
    ||p.canonicalJsonV1(storedIds.sort())!==p.canonicalJsonV1(bindings.map(binding=>binding.ref).sort())
    ||p.canonicalJsonV1(jsonObjectV1(guard.member_determinism_hashes,'S6_S4_GUARD_MEMBER_HASHES_INVALID'))
      !==p.canonicalJsonV1(correctedHashesV1(authority))){
    throw new Error('S6_S4_IDEMPOTENCY_GUARD_CONFLICT');
  }
  const set=reconstructSetV1(authority,facts);
  p.validateCap08S4AppendForwardAuthorityV1({authority,corrected_set:set});
  await validateExternalBindingsV1(client,p,authority);
  return{disposition:'ALREADY_COMPLETE_EXACT',authority,corrected_set:set,write_delta:0};
}
function createS6S4AtomicPersistenceRepositoryV1({pool,p}){
  for(const key of[
    'canonicalJsonV1',
    'validateCap08S4AppendForwardAuthorityV1',
    'CAP08_S4_AUTHORITY_SCHEMA_VERSION_V1',
    'CAP08_S4_AUTHORITY_KIND_V1',
    'cap08TickLogicalTimeV1',
  ])assert.ok(p[key],`S6_S4_PRODUCT_EXPORT_REQUIRED:${key}`);
  return{
    async inspect(authority){
      const client=await pool.connect();
      try{
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const result=await inspectWithClientV1(client,p,authority);
        await client.query('COMMIT');
        return result;
      }catch(error){
        await client.query('ROLLBACK');
        throw error;
      }finally{
        client.release();
      }
    },
    async establish(input){
      p.validateCap08S4AppendForwardAuthorityV1(input);
      const client=await pool.connect();
      const inject=stage=>input.fault_injection?.(stage);
      try{
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        await client.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
          [p.canonicalJsonV1({
            formal_run_id:input.authority.formal_run_id,
            scope:input.authority.scope,
            correction_logical_time:input.authority.correction_logical_time,
            operation_variant:input.authority.operation_variant,
          })],
        );
        const existing=await inspectWithClientV1(client,p,input.authority);
        if(existing.disposition==='ALREADY_COMPLETE_EXACT'){
          await client.query('COMMIT');
          return{
            disposition:'ALREADY_COMPLETE_EXACT',
            write_status:'EXISTING_IDEMPOTENT_SET',
            authority:existing.authority,
            corrected_set:existing.corrected_set,
            write_delta:0,
          };
        }
        await validateExternalBindingsV1(client,p,input.authority);
        inject('before_facts');
        for(const object of correctedObjectsV1(input.corrected_set)){
          await client.query(
            `INSERT INTO facts (fact_id,occurred_at,source,record_json)
             VALUES ($1,$2::timestamptz,$3,$4::jsonb)`,
            [factIdV1(object.object_id),object.logical_time,FACT_SOURCE,recordJsonV1(object)],
          );
        }
        inject('before_idempotency_guard');
        await client.query(
          `INSERT INTO twin_object_idempotency_index_v1
           (identity_kind,idempotency_key,record_set_id,determinism_hash,
            identity_basis,member_object_ids,member_determinism_hashes)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)`,
          [
            IDENTITY_KIND,
            input.authority.idempotency_key,
            input.authority.authority_ref,
            input.authority.determinism_hash,
            JSON.stringify({
              schema_version:input.authority.schema_version,
              contract_id:input.authority.contract_id,
              identity_input:input.authority.identity_input,
            }),
            JSON.stringify(correctedBindingsV1(input.authority).map(binding=>binding.ref)),
            JSON.stringify(correctedHashesV1(input.authority)),
          ],
        );
        inject('before_authority');
        await client.query(
          `INSERT INTO twin_runtime_authority_snapshot_v1
           (authority_kind,authority_ref,determinism_hash,semantic_payload)
           VALUES ($1,$2,$3,$4::jsonb)`,
          [
            p.CAP08_S4_AUTHORITY_KIND_V1,
            input.authority.authority_ref,
            input.authority.determinism_hash,
            JSON.stringify(input.authority),
          ],
        );
        inject('before_final_readback');
        const exact=await inspectWithClientV1(client,p,input.authority);
        if(exact.disposition!=='ALREADY_COMPLETE_EXACT'){
          throw new Error('S6_S4_APPEND_FORWARD_FINAL_READBACK_FAILED');
        }
        inject('before_commit');
        await client.query('COMMIT');
        return{
          disposition:'ALREADY_COMPLETE_EXACT',
          write_status:'INSERTED_ATOMIC_SET',
          authority:exact.authority,
          corrected_set:exact.corrected_set,
          write_delta:7,
        };
      }catch(error){
        await client.query('ROLLBACK');
        throw error;
      }finally{
        client.release();
      }
    },
  };
}
module.exports={
  buildS6T00T16BindingsV1,
  assertS6S4InterleaveNoCompletionTupleV1,
  createS6S4AtomicPersistenceRepositoryV1,
};
