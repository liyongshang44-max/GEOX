#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {Pool}=require('pg');
function env(name){const value=String(process.env[name]??'').trim();if(!value)throw new Error(`CAP08_T17_RESTART_ENV_REQUIRED:${name}`);return value;}
async function main(){
  const context=JSON.parse(fs.readFileSync(path.resolve(env('MCFT_CAP08_DEV_CONTINUITY_CONTEXT_PATH')),'utf8'));
  const pool=new Pool({connectionString:env('MCFT_CAP08_ADMIN_DATABASE_URL'),max:2});
  try{
    const before=Number((await pool.query('SELECT count(*)::int AS n FROM facts')).rows[0].n);
    const guard=await pool.query('SELECT * FROM twin_cap08_s4_t17_transition_guard_v1 WHERE transition_id=$1',[context.transition_id]);
    assert.equal(guard.rows.length,1,'CAP08_T17_RESTART_GUARD_CARDINALITY');
    assert.equal(guard.rows[0].witness_fact_id,context.witness_fact_id);
    assert.equal(guard.rows[0].witness_determinism_hash,context.witness_hash);
    const witness=await pool.query('SELECT record_json FROM facts WHERE fact_id=$1',[context.witness_fact_id]);
    assert.equal(witness.rows.length,1,'CAP08_T17_RESTART_WITNESS_CARDINALITY');
    const record=typeof witness.rows[0].record_json==='string'?JSON.parse(witness.rows[0].record_json):witness.rows[0].record_json;
    assert.equal(record.payload.determinism_hash,context.witness_hash);
    const scope=context.spec.scope;
    const latest=await pool.query(`SELECT
      (SELECT state_object_id FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS state_ref,
      (SELECT determinism_hash FROM twin_state_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS state_hash,
      (SELECT checkpoint_object_id FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS checkpoint_ref,
      (SELECT determinism_hash FROM twin_runtime_checkpoint_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS checkpoint_hash,
      (SELECT forecast_object_id FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS forecast_ref,
      (SELECT determinism_hash FROM twin_forecast_result_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS forecast_hash,
      (SELECT forecast_object_id FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS success_ref,
      (SELECT determinism_hash FROM twin_forecast_success_latest_index_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS success_hash`,
      [scope.tenant_id,scope.project_id,scope.group_id,scope.field_id,scope.season_id,scope.zone_id]);
    assert.deepEqual(latest.rows[0],context.final_latest,'CAP08_T17_RESTART_FINAL_LATEST');
    const after=Number((await pool.query('SELECT count(*)::int AS n FROM facts')).rows[0].n);
    assert.equal(after,before,'CAP08_T17_RESTART_WRITE_DELTA');
    const result={schema_version:'geox_mcft_cap08_s4_t17_product_transition_restart_result_v1',status:'PASS',fresh_process:true,transition_id:context.transition_id,transition_witness_retained:true,final_latest_projection_state:'EXACT_T23',canonical_write_delta:0,formal_evidence_eligible:false};
    const resultPath=path.resolve(env('MCFT_CAP08_DEV_RESTART_RESULT_PATH'));fs.writeFileSync(resultPath,`${JSON.stringify(result,null,2)}\n`);console.log(JSON.stringify(result,null,2));
  }finally{await pool.end();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
