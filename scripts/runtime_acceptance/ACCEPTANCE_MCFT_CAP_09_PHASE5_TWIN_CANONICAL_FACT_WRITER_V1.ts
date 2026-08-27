import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";

const OUT=path.resolve("acceptance-output/MCFT_CAP_09_PHASE5_TWIN_CANONICAL_FACT_WRITER_V1_RESULT.json");
const DB=String(process.env.DATABASE_URL??"").trim();
const TWIN="geox_mcft_cap09_twin_runtime_v1";
const EVIDENCE="geox_mcft_cap09_evidence_runtime_v1";
const TF="public.mcft_cap09_twin_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb)";
const EF="public.mcft_cap09_evidence_runtime_append_fact_v1(text,text,text,text,text,text,text,bigint,text,timestamptz,jsonb)";
const s={tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",field_id:"field_e3r1",season_id:"season_2026",zone_id:"zone_root"};
const vals=()=>[s.tenant_id,s.project_id,s.group_id,s.field_id,s.season_id,s.zone_id];

async function fail(client:PoolClient,label:string,fn:()=>Promise<unknown>,pattern:RegExp){
  const sp="sp_"+label.replace(/[^a-z0-9_]/gi,"_").toLowerCase();
  await client.query(`SAVEPOINT ${sp}`); let caught:unknown=null;
  try{await fn();}catch(e){caught=e;}
  await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
  assert(caught instanceof Error,"PHASE5_DB_FAILURE_REQUIRED:"+label); assert.match(caught.message,pattern);
}
async function main(){
  assert(DB,"PHASE5_TWIN_WRITER_DATABASE_URL_REQUIRED");
  const pool=new Pool({connectionString:DB,max:2});
  try{
    const p=await pool.query(`SELECT
      pg_catalog.has_table_privilege($1,'public.facts','INSERT') twin_insert,
      pg_catalog.has_function_privilege($1,$3,'EXECUTE') twin_execute,
      pg_catalog.has_function_privilege($2,$3,'EXECUTE') evidence_execute_twin,
      pg_catalog.has_function_privilege($1,$4,'EXECUTE') twin_execute_evidence`,
      [TWIN,EVIDENCE,TF,EF]);
    assert.deepEqual(p.rows[0],{twin_insert:false,twin_execute:true,evidence_execute_twin:false,twin_execute_evidence:false});
    const c=await pool.connect();
    try{
      await c.query("BEGIN"); await c.query(`SET LOCAL ROLE ${TWIN}`);
      await c.query(`INSERT INTO public.twin_runtime_lease_v1
       (tenant_id,project_id,group_id,field_id,season_id,zone_id,lease_owner,fencing_token,acquired_at,expires_at,heartbeat_at)
       VALUES ($1,$2,$3,$4,$5,$6,'phase5-twin-writer',1,transaction_timestamp(),
       transaction_timestamp()+interval '5 minutes',transaction_timestamp())
       ON CONFLICT (tenant_id,project_id,group_id,field_id,season_id,zone_id) DO UPDATE SET
       lease_owner=EXCLUDED.lease_owner,fencing_token=1,expires_at=transaction_timestamp()+interval '5 minutes',heartbeat_at=transaction_timestamp()`,vals());
      await fail(c,"direct",()=>c.query("INSERT INTO public.facts(fact_id,occurred_at,source,record_json) VALUES ('forbidden',transaction_timestamp(),'x','{}')"),/permission denied/i);
      const t="2026-08-27T12:00:00.000Z",id="phase5_twin_health_writer_probe";
      const rec={type:"twin_runtime_health_v1",payload:{object_id:id,object_type:"twin_runtime_health_v1",...s,logical_time:t}};
      const args=[...vals(),"phase5-twin-writer","1","fact_"+id,t,JSON.stringify(rec)];
      const q=`SELECT status,canonical_fact_write_count FROM public.mcft_cap09_twin_runtime_append_fact_v1(
       $1,$2,$3,$4,$5,$6,$7,$8::bigint,$9,$10::timestamptz,$11::jsonb)`;
      assert.deepEqual((await c.query(q,args)).rows[0],{status:"INSERTED",canonical_fact_write_count:1});
      assert.deepEqual((await c.query(q,args)).rows[0],{status:"EXISTING_IDEMPOTENT_SUCCESS",canonical_fact_write_count:0});
      const er={type:"soil_moisture_observation_v1",payload:{object_id:"e",object_type:"soil_moisture_observation_v1",...s,logical_time:t}};
      await fail(c,"evidence",()=>c.query(q,[...vals(),"phase5-twin-writer","1","fact_e",t,JSON.stringify(er)]),/OBJECT_TYPE_NOT_AUTHORIZED/);
      await c.query(`UPDATE public.twin_runtime_lease_v1
       SET lease_owner='phase5-twin-writer-takeover',fencing_token=2,
           heartbeat_at=transaction_timestamp(),expires_at=transaction_timestamp()+interval '5 minutes'
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,vals());
      await fail(c,"stale",()=>c.query(q,args),/PHASE5_TWIN_DB_WRITER_STALE_FENCE/);
      await c.query("ROLLBACK");
    }finally{c.release();}
    const proof={status:"PASS",acceptance_id:"MCFT_CAP09_PHASE5_TWIN_CANONICAL_FACT_WRITER_V1",
      twin_runtime_direct_facts_insert:false,twin_runtime_fenced_writer_execute:true,
      evidence_runtime_twin_writer_execute:false,twin_runtime_evidence_writer_execute:false,
      exact_retry_idempotent:true,evidence_fact_family_rejected:true,stale_owner_rejected_before_existing_retry:true,
      db_layer_bidirectional_evidence_twin_isolation:true,production_owner_cutover:false,formal_v5_armed:false};
    fs.mkdirSync(path.dirname(OUT),{recursive:true});fs.writeFileSync(OUT,JSON.stringify(proof,null,2)+"\n");console.log(JSON.stringify(proof));
  }finally{await pool.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
