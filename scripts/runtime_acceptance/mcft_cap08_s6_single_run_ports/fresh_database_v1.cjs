'use strict';
const assert=require('node:assert/strict');
const {digest}=require('./shared_v1.cjs');
function createFreshDatabasePortV1({pool,adminPool}){return{async assertFreshDisposable({spec}){const db=(await pool.query('SELECT current_database() AS database_name,current_user AS user_name')).rows[0];assert.match(String(db.database_name),/mcft.*cap08.*s6|cap08.*s6.*(?:run_a|run_b)/i,'FRESH_DISPOSABLE_DATABASE_NAME_REQUIRED');assert.equal(String(db.user_name),'geox_mcft_cap08_runner_v1','CAP08_RUNNER_ROLE_REQUIRED');const required=['facts','twin_active_lineage_index_v1','twin_runtime_checkpoint_latest_index_v1','twin_state_latest_index_v1','twin_forecast_result_latest_index_v1','twin_scenario_latest_index_v1'];for(const relation of required){const row=(await adminPool.query('SELECT to_regclass($1) AS relation',[`public.${relation}`])).rows[0];assert.equal(String(row.relation),relation,`REQUIRED_RELATION:${relation}`);}const counts=await adminPool.query(`SELECT
 (SELECT count(*)::int FROM facts) AS facts,
 (SELECT count(*)::int FROM twin_active_lineage_index_v1) AS lineage,
 (SELECT count(*)::int FROM twin_runtime_checkpoint_latest_index_v1) AS checkpoint`);assert.deepEqual(counts.rows[0],{facts:0,lineage:0,checkpoint:0},'DATABASE_NOT_FRESH');return{status:'PASS',fresh:true,database_name:db.database_name,runner_role:db.user_name,database_instance_seed_digest:digest({database_name:db.database_name,operational_run_instance_id:spec.operational_run_instance_id})};}};}
module.exports={createFreshDatabasePortV1};
