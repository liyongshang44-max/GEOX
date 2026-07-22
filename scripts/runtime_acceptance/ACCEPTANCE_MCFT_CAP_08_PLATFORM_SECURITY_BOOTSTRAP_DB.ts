import fs from "node:fs"; import pg from "pg"; import crypto from "node:crypto"; const {Pool}=pg;
const admin=process.env.MCFT_CAP08_ADMIN_DATABASE_URL||"postgres://postgres:postgres@127.0.0.1:5432/postgres";
const out=(name:string,v:unknown)=>{fs.mkdirSync("acceptance-output",{recursive:true});fs.writeFileSync(`acceptance-output/${name}`,JSON.stringify(v,null,2)+"\\n")};
const hash=(v:unknown)=>crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");

import {runMcftCap08DatabasePlatformBootstrapV1,MCFT_CAP08_RELATION_PRIVILEGES_V1,MCFT_CAP08_RUNNER_ROLE_V1} from "../../apps/server/src/infra/mcft_cap08_database_platform_bootstrap_v1.js";
const pool=new Pool({connectionString:admin,max:1});
try{
 for(const name of Object.keys(MCFT_CAP08_RELATION_PRIVILEGES_V1)){ await pool.query(`CREATE TABLE IF NOT EXISTS public.${name}(id text PRIMARY KEY,payload jsonb,updated_at timestamptz)`); }
 const structure=async()=> (await pool.query(`SELECT n.nspname,c.relname,a.attname,format_type(a.atttypid,a.atttypmod) typ,a.attnotnull,pg_get_expr(ad.adbin,ad.adrelid) def FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef ad ON ad.adrelid=c.oid AND ad.adnum=a.attnum WHERE n.nspname='public' ORDER BY c.relname,a.attnum`)).rows;
 const before=hash(await structure()); const countsBefore=Object.fromEntries(await Promise.all(Object.keys(MCFT_CAP08_RELATION_PRIVILEGES_V1).map(async n=>[n,(await pool.query(`SELECT count(*)::int n FROM public.${n}`)).rows[0].n])));
 await runMcftCap08DatabasePlatformBootstrapV1({admin_database_url:admin,runner_password:"cap08-runner-test-pass"}); await runMcftCap08DatabasePlatformBootstrapV1({admin_database_url:admin,runner_password:"cap08-runner-test-pass"});
 const after=hash(await structure()); const role=(await pool.query("SELECT rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=$1",[MCFT_CAP08_RUNNER_ROLE_V1])).rows[0];
 const grants=(await pool.query("SELECT table_name,privilege_type FROM information_schema.role_table_grants WHERE grantee=$1 AND table_schema='public' ORDER BY table_name,privilege_type",[MCFT_CAP08_RUNNER_ROLE_V1])).rows;
 const expected=[] as any[]; for(const [table,privs] of Object.entries(MCFT_CAP08_RELATION_PRIVILEGES_V1)) for(const privilege_type of privs) expected.push({table_name:table,privilege_type}); expected.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))); grants.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 if(before!==after) throw new Error("BUSINESS_SCHEMA_STRUCTURE_DELTA"); if(JSON.stringify(grants)!==JSON.stringify(expected)) throw new Error("PRIVILEGE_GRAPH_NOT_EXACT"); if(!role.rolcanlogin||role.rolinherit||role.rolsuper||role.rolcreatedb||role.rolcreaterole||role.rolreplication||role.rolbypassrls) throw new Error("ROLE_FLAGS_INVALID");
 const countsAfter=Object.fromEntries(await Promise.all(Object.keys(MCFT_CAP08_RELATION_PRIVILEGES_V1).map(async n=>[n,(await pool.query(`SELECT count(*)::int n FROM public.${n}`)).rows[0].n]))); if(JSON.stringify(countsBefore)!==JSON.stringify(countsAfter)) throw new Error("CANONICAL_DATA_DELTA");
 out("MCFT_CAP_08_PLATFORM_SECURITY_BOOTSTRAP_DB_RESULT.json",{status:"PASS",business_schema_structure_digest_before:before,business_schema_structure_digest_after:after,privilege_graph_digest_after:hash(grants),expected_privilege_delta_digest:hash(expected),actual_privilege_delta_digest:hash(grants),privilege_delta_match:true,role_flags:role,relation_count:Object.keys(MCFT_CAP08_RELATION_PRIVILEGES_V1).length,zero_canonical_runtime_data_delta:true});
} finally {await pool.end();}
