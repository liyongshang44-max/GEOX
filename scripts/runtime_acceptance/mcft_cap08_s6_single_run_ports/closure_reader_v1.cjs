'use strict';
const assert=require('node:assert/strict');
function normalizePayload(recordJson){
  const payload=recordJson?.payload;
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return null;
  const scope=payload.scope&&typeof payload.scope==='object'&&!Array.isArray(payload.scope)?payload.scope:{};
  if(payload.object_id){return{...scope,...payload};}
  if(!payload.source_record_id)return null;
  return{
    ...scope,
    ...payload,
    object_id:payload.source_record_id,
    object_type:recordJson.type,
    determinism_hash:payload.source_record_hash,
    logical_time:payload.available_to_runtime_at??payload.logical_time,
    as_of:payload.available_to_runtime_at??payload.logical_time,
  };
}
function createClosureReaderV1({pool}){
  return{
    async query(_sql,params){
      const refs=params?.[0];
      assert.ok(Array.isArray(refs),'EXACT_REF_ARRAY_REQUIRED');
      const result=await pool.query(
        `SELECT fact_id,record_json FROM facts
          WHERE (record_json->'payload'->>'object_id'=ANY($1::text[])
             OR record_json->'payload'->>'source_record_id'=ANY($1::text[]))
          ORDER BY fact_id`,
        [refs],
      );
      const byRef=new Map();
      for(const row of result.rows){
        const object=normalizePayload(row.record_json);
        if(!object||!refs.includes(object.object_id))continue;
        if(byRef.has(object.object_id))throw new Error(`CLOSURE_REF_DUPLICATE:${object.object_id}`);
        byRef.set(object.object_id,{fact_id:row.fact_id,object});
      }
      return{rows:refs.map(ref=>byRef.get(ref)).filter(Boolean)};
    },
  };
}
module.exports={createClosureReaderV1};
