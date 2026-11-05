"use strict";
// Current control-plane account metadata, on the SAME explicit scoped URLs.
// Null rolvaliduntil means PostgreSQL explicitly has no account expiry; it is
// not an invented future time and never extends the finite signed Scope.
const s=require("./MCFT_CAP09_R4285_SCOPE_V3.cjs"),c=require("../cap09_adoption_v1/contract.cjs");
const pgContract=require("./MCFT_CAP09_R4285_PG_READONLY_V1.cjs");
const CONTROLS=Object.freeze(["twin_external_formal_forcing_base_cursor_v1","twin_external_formal_forcing_base_target_v1","twin_external_formal_forcing_controller_lease_v1"]);
async function verify(releaseRoot,environment,resources){
 const pg=require(require.resolve("pg",{paths:[releaseRoot]})),rows=[];
 for(const [side,key] of [["positive","DATABASE_URL"],["negative","BLOCKED_DATABASE_URL"]]){
  const u=new URL(environment[key]);s.check(decodeURIComponent(u.username)===resources[side+"_role"]&&u.hostname===resources.database_host&&u.port===String(resources.database_port)&&decodeURIComponent(u.pathname.slice(1))===resources[side+"_database"]&&!u.search&&!u.hash,"V3_ACCOUNT_URL_DRIFT");
  const pool=new pg.Pool({connectionString:environment[key],max:1,connectionTimeoutMillis:5000,query_timeout:5000,statement_timeout:5000});let client,transaction=false;
  try{client=await pool.connect();await client.query("BEGIN TRANSACTION READ ONLY");transaction=true;
   const result=await client.query("SELECT session_user::text AS role,current_database()::text AS database, r.rolcanlogin AS can_login,r.rolsuper AS superuser,r.rolcreaterole AS create_role,r.rolcreatedb AS create_db,r.rolreplication AS replication,r.rolbypassrls AS bypass_rls,r.rolvaliduntil AS expires_at,has_database_privilege(session_user,current_database(),'CONNECT') AS connection_allowed FROM pg_catalog.pg_roles r WHERE r.rolname=session_user");
   s.check(result.rows.length===1,"V3_PG_ACCOUNT_METADATA_UNRESOLVED");const a=result.rows[0];
   s.check(a.role===resources[side+"_role"]&&a.database===resources[side+"_database"]&&a.can_login===true&&a.connection_allowed===true&&["superuser","create_role","create_db","replication","bypass_rls"].every(k=>a[k]===false),"V3_PG_ACCOUNT_CAPABILITIES");
   a.expires_at=a.expires_at===null||a.expires_at===Infinity||a.expires_at==="infinity"?null:new Date(a.expires_at).toISOString();s.check(a.expires_at===resources[side+"_expires_at"],"V3_PG_ACCOUNT_EXPIRY_DRIFT");
   a.table_select=[];for(const table of pgContract.REQUIRED_PUBLIC_TABLES){const q=await client.query("SELECT has_table_privilege(session_user,$1::text,'SELECT') AS allowed",["public."+table]);s.check(typeof q.rows[0]?.allowed==="boolean","V3_PG_SELECT_METADATA_UNRESOLVED");a.table_select.push({table,allowed:q.rows[0].allowed});}
   a.controller=[];for(const table of CONTROLS){const q=await client.query("SELECT has_table_privilege(session_user,$1::text,'SELECT') AS can_select,has_table_privilege(session_user,$1::text,'INSERT') AS can_insert,has_table_privilege(session_user,$1::text,'UPDATE') AS can_update",["public."+table]);const grants=q.rows[0];s.check(grants&&Object.values(grants).every(v=>v===true),"V3_PG_CONTROLLER_PERMISSION_DRIFT");a.controller.push({table,select:grants.can_select,insert:grants.can_insert,update:grants.can_update});}
   const q=await client.query("SELECT has_table_privilege(session_user,'public.facts','INSERT') AS direct_insert,has_function_privilege(session_user,$1::text,'EXECUTE') AS fenced_execute",[pgContract.FENCED_WRITER]);
   s.check(q.rows[0]?.direct_insert===false&&q.rows[0]?.fenced_execute===true,"V3_PG_FENCED_PERMISSION_DRIFT");Object.assign(a,q.rows[0]);rows.push(a);
  }finally{if(client){if(transaction)try{await client.query("ROLLBACK");}catch{}client.release();}await pool.end();}
 }
 s.check(c.digest(rows)===resources.pg_permission_sha256,"V3_PG_APPROVED_PERMISSION_DIGEST_DRIFT");return true;
}
module.exports={CONTROLS,verify};
