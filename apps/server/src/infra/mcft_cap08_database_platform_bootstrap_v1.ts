// Purpose: provision the bounded MCFT-CAP-08 runner role from an external administrative credential.
// Boundary: role/ACL only; no business DDL, canonical facts, projections, Runtime execution, or credential fallback.
import { Pool } from "pg";
export const MCFT_CAP08_RUNNER_ROLE_V1 = "geox_mcft_cap08_runner_v1" as const;
export const MCFT_CAP08_RELATION_PRIVILEGES_V1 = {"facts": ["SELECT", "INSERT"], "twin_object_idempotency_index_v1": ["SELECT", "INSERT"], "twin_runtime_lease_v1": ["SELECT", "INSERT", "UPDATE"], "twin_active_lineage_index_v1": ["SELECT", "INSERT", "UPDATE"], "twin_runtime_checkpoint_latest_index_v1": ["SELECT", "INSERT", "UPDATE"], "twin_state_history_projection_v1": ["SELECT", "INSERT", "UPDATE"], "twin_state_latest_index_v1": ["SELECT", "INSERT", "UPDATE"], "twin_forecast_run_projection_v1": ["SELECT", "INSERT", "UPDATE"], "twin_forecast_result_latest_index_v1": ["SELECT", "INSERT", "UPDATE"], "twin_forecast_success_latest_index_v1": ["SELECT", "INSERT", "UPDATE"], "twin_scenario_set_projection_v1": ["SELECT", "INSERT", "UPDATE"], "twin_scenario_latest_index_v1": ["SELECT", "INSERT", "UPDATE"], "twin_decision_record_projection_v1": ["SELECT", "INSERT", "UPDATE"], "twin_approved_plan_binding_projection_v1": ["SELECT", "INSERT", "UPDATE"], "twin_action_feedback_projection_v1": ["SELECT", "INSERT", "UPDATE"], "twin_action_feedback_evidence_index_v1": ["SELECT", "INSERT"], "twin_forecast_residual_projection_v1": ["SELECT", "INSERT", "UPDATE"], "twin_calibration_candidate_projection_v1": ["SELECT", "INSERT", "UPDATE"], "twin_shadow_evaluation_projection_v1": ["SELECT", "INSERT", "UPDATE"]} as const;
export type McftCap08BootstrapConfigV1 = { admin_database_url: string; runner_password: string };
function secret(v:string,c:string){ if(!String(v||"")) throw new Error(c); return v; }
async function assertAdmin(pool:Pool){ const r=await pool.query(`SELECT session_user::text session_user,current_user::text current_user,rolsuper,rolcreaterole FROM pg_roles WHERE rolname=current_user`); const x=r.rows[0]; if(!x||x.session_user!==x.current_user||(!x.rolsuper&&!x.rolcreaterole)||x.session_user===MCFT_CAP08_RUNNER_ROLE_V1) throw new Error("MCFT_CAP08_BOOTSTRAP_ADMIN_REQUIRED"); }
async function relationExists(pool:Pool,name:string){ const r=await pool.query("SELECT to_regclass($1) IS NOT NULL AS ok",[`public.${name}`]); return r.rows[0]?.ok===true; }
export async function runMcftCap08DatabasePlatformBootstrapV1(config:McftCap08BootstrapConfigV1){
 const pool=new Pool({connectionString:secret(config.admin_database_url,"MCFT_CAP08_ADMIN_URL_REQUIRED"),max:1});
 try{
  await assertAdmin(pool);
  const missing=[] as string[]; for(const name of Object.keys(MCFT_CAP08_RELATION_PRIVILEGES_V1)){ if(!await relationExists(pool,name)) missing.push(name); }
  if(missing.length) throw new Error(`MCFT_CAP08_REQUIRED_RELATION_MISSING:${missing.sort().join(",")}`);
  await pool.query(`DO $b$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='${MCFT_CAP08_RUNNER_ROLE_V1}') THEN CREATE ROLE ${MCFT_CAP08_RUNNER_ROLE_V1}; END IF; END $b$; ALTER ROLE ${MCFT_CAP08_RUNNER_ROLE_V1} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;`);
  const pw=await pool.query("SELECT format('ALTER ROLE %I PASSWORD %L',$1::text,$2::text) sql",[MCFT_CAP08_RUNNER_ROLE_V1,secret(config.runner_password,"MCFT_CAP08_RUNNER_PASSWORD_REQUIRED")]); await pool.query(pw.rows[0].sql);
  const db=await pool.query(`SELECT format('GRANT CONNECT ON DATABASE %I TO ${MCFT_CAP08_RUNNER_ROLE_V1}',current_database()) sql`); await pool.query(db.rows[0].sql);
  const revokeTemp=await pool.query(`SELECT format('REVOKE TEMP ON DATABASE %I FROM ${MCFT_CAP08_RUNNER_ROLE_V1}',current_database()) sql`); await pool.query(revokeTemp.rows[0].sql);
  await pool.query(`REVOKE ALL ON SCHEMA public FROM ${MCFT_CAP08_RUNNER_ROLE_V1}; GRANT USAGE ON SCHEMA public TO ${MCFT_CAP08_RUNNER_ROLE_V1}; REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${MCFT_CAP08_RUNNER_ROLE_V1}; REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${MCFT_CAP08_RUNNER_ROLE_V1}; REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM ${MCFT_CAP08_RUNNER_ROLE_V1};`);
  for(const [name,privs] of Object.entries(MCFT_CAP08_RELATION_PRIVILEGES_V1)){ await pool.query(`GRANT ${privs.join(",")} ON TABLE public.${name} TO ${MCFT_CAP08_RUNNER_ROLE_V1}`); }
  await pool.query(`REVOKE ${MCFT_CAP08_RUNNER_ROLE_V1} FROM PUBLIC;`);
  return {status:"PASS" as const,role:MCFT_CAP08_RUNNER_ROLE_V1,relation_count:Object.keys(MCFT_CAP08_RELATION_PRIVILEGES_V1).length,business_schema_ddl_performed:false,canonical_runtime_write_performed:false};
 } finally { await pool.end(); }
}
