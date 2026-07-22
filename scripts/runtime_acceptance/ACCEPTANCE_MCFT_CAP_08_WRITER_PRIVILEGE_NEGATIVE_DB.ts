import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { MCFT_CAP08_RELATION_PRIVILEGES_V1 } from "../../apps/server/src/infra/mcft_cap08_database_platform_bootstrap_v1.js";
const { Pool } = pg;
const databaseName = String(process.env.MCFT_CAP08_TARGET_DATABASE_NAME || "geox_mcft_cap08_s0_acceptance");
const rootUrl = String(process.env.MCFT_CAP08_ADMIN_DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/postgres");
const password = String(process.env.MCFT_CAP08_RUNNER_PASSWORD || "cap08-local-runner-password");
const url = new URL(rootUrl); url.pathname=`/${databaseName}`; url.username="geox_mcft_cap08_runner_v1"; url.password=password;
const outPath="acceptance-output/MCFT_CAP_08_WRITER_PRIVILEGE_NEGATIVE_DB_RESULT.json";
function out(value:unknown){fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,`${JSON.stringify(value,null,2)}\n`);}
async function expectDenied(pool:Pool,name:string,sql:string){try{await pool.query("SAVEPOINT cap08_probe");await pool.query(sql);throw new Error(`FORBIDDEN_OPERATION_SUCCEEDED:${name}`);}catch(error){if(error instanceof Error && error.message.startsWith("FORBIDDEN_OPERATION_SUCCEEDED"))throw error;}finally{await pool.query("ROLLBACK TO SAVEPOINT cap08_probe").catch(()=>undefined);}}
async function main(){const pool=new Pool({connectionString:url.toString(),max:1});const checks:string[]=[];try{
 const before=(await pool.query(`SELECT (SELECT count(*)::int FROM public.facts) AS facts,(SELECT count(*)::int FROM public.twin_fact_visibility_index_v1) AS visibility`)).rows[0];
 await pool.query("BEGIN");
 const probeFactId="fact_mcft_cap08_s0_effective_write_probe_v1";
 const probeRecord={type:"mcft_cap08_s0_effective_write_probe_v1",payload:{object_id:"mcft_cap08_s0_effective_write_probe_v1",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",field_id:"field_c8_demo",season_id:"season_2026_c8_corn",zone_id:"zone_mcft_c8_water_001",lineage_id:"lineage-s0-probe",revision_id:"revision-s0-probe",logical_time:"2026-06-01T00:00:00.000Z",payload:{formal_run_id:"MCFT-CAP-08.S0.PRIVILEGE_PROBE",phase_id:"S0",transaction_family:"S0_PRIVILEGE_PROBE",obligation_id:"WRITER_EFFECTIVE_WRITE"}}};
 await pool.query("INSERT INTO public.facts(fact_id,occurred_at,source,record_json) VALUES($1,$2::timestamptz,'mcft-cap08-s0-acceptance',$3::jsonb)",[probeFactId,"2026-06-01T00:00:00.000Z",JSON.stringify(probeRecord)]);
 const factRead=(await pool.query("SELECT count(*)::int AS n FROM public.facts WHERE fact_id=$1",[probeFactId])).rows[0].n;
 const visibilityRead=(await pool.query(`SELECT count(*)::int AS n,min(v.visibility_anchor_kind) AS anchor_kind FROM public.twin_fact_visibility_index_v1 v JOIN public.twin_fact_visibility_epoch_v1 e ON e.visibility_epoch_id=v.visibility_epoch_id AND e.status='ACTIVE' WHERE v.fact_id=$1`,[probeFactId])).rows[0];
 if(factRead!==1||visibilityRead.n!==1||visibilityRead.anchor_kind!=="FACT_INSERT_TRANSACTION")throw new Error("FACT_VISIBILITY_TRIGGER_PROBE_FAILED");
 checks.push("REAL_FACT_INSERT_AND_CAP07_VISIBILITY_TRIGGER");
 for(const [relation,privileges] of Object.entries(MCFT_CAP08_RELATION_PRIVILEGES_V1)){
  const privilegeList: readonly string[] = privileges;
  await pool.query(`SELECT 1 FROM public.${relation} WHERE false`);checks.push(`SELECT:${relation}`);
  if(privilegeList.includes("INSERT")) {await pool.query(`INSERT INTO public.${relation} SELECT * FROM public.${relation} WHERE false`);checks.push(`INSERT_ZERO:${relation}`);}
  if(privilegeList.includes("UPDATE")){const c=(await pool.query(`SELECT attname FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped AND attgenerated='' ORDER BY attnum LIMIT 1`,[`public.${relation}`])).rows[0]?.attname;if(!c)throw new Error(`UPDATE_PROBE_COLUMN_MISSING:${relation}`);await pool.query(`UPDATE public.${relation} SET "${String(c).replaceAll('"','""')}"="${String(c).replaceAll('"','""')}" WHERE false`);checks.push(`UPDATE_ZERO:${relation}`);}
 }
 await expectDenied(pool,"CREATE_TEMP","CREATE TEMP TABLE cap08_forbidden_temp(id int)");
 await expectDenied(pool,"CREATE_TABLE","CREATE TABLE public.cap08_forbidden_table(id int)");
 await expectDenied(pool,"CREATE_FUNCTION","CREATE FUNCTION public.cap08_forbidden_function() RETURNS int LANGUAGE sql AS 'SELECT 1'");
 await expectDenied(pool,"SET_ROLE","SET ROLE postgres");
 await expectDenied(pool,"DELETE",`DELETE FROM public.facts WHERE false`);
 await expectDenied(pool,"TRUNCATE",`TRUNCATE public.facts`);
 await pool.query("ROLLBACK");
 const after=(await pool.query(`SELECT (SELECT count(*)::int FROM public.facts) AS facts,(SELECT count(*)::int FROM public.twin_fact_visibility_index_v1) AS visibility`)).rows[0];
 if(before.facts!==after.facts||before.visibility!==after.visibility)throw new Error("ROLLBACK_DATA_OR_VISIBILITY_DELTA");
 out({status:"PASS",allowed_probe_count:checks.length,allowed_probes:checks,real_fact_inserted:true,cap07_visibility_trigger_observed:true,visibility_anchor_kind:"FACT_INSERT_TRANSACTION",facts_count_before:before.facts,facts_count_after:after.facts,visibility_count_before:before.visibility,visibility_count_after:after.visibility,forbidden_probes:["CREATE_TEMP","CREATE_TABLE","CREATE_FUNCTION","SET_ROLE","DELETE","TRUNCATE"],transaction_rolled_back:true});
 }catch(error){await pool.query("ROLLBACK").catch(()=>undefined);out({status:"FAIL",error:error instanceof Error?error.message:String(error)});throw error;}finally{await pool.end();}}
main();
