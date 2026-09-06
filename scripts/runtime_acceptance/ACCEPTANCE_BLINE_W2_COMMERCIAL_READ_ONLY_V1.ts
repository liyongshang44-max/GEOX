import pg from "pg";
const { Pool } = pg;

const base=String(process.env.BASE_URL??"http://127.0.0.1:3001").replace(/\/$/,"");
const dbUrl=String(process.env.DATABASE_URL??"").trim();
const admin=String(process.env.GEOX_W2_ADMIN_TOKEN??"").trim();
const reader=String(process.env.GEOX_W2_RECOMMENDATION_READER_TOKEN??"").trim();
const writer=String(process.env.GEOX_W2_RECOMMENDATION_WRITER_TOKEN??"").trim();
if(!dbUrl||!admin||!reader||!writer) throw new Error("W2 commercial proof env missing");
const pool=new Pool({connectionString:dbUrl});
const scope={tenant_id:"tenantA",project_id:"projectA",group_id:"groupA"};
const qp=new URLSearchParams(scope).toString();

const tables=[
 "manual_execution_quality_projection_v1",
 "field_sensing_overview_v1",
 "field_sensing_summary_stage1_v1",
 "field_fertility_state_v1",
 "skill_registry_read_v1",
 "dispatch_queue_v1",
 "weather_forecast_index_v1",
];
const factTypes=["manual_execution_quality_snapshot_v1","ao_act_authz_audit_v0","security_audit_event_v1"];

function expect(c:any,m:string,d?:any){if(!c)throw new Error(m+(d===undefined?"":": "+JSON.stringify(d)));}
async function tableDigest(table:string){
 const reg=await pool.query("SELECT to_regclass($1) AS reg",[table]);
 if(!reg.rows?.[0]?.reg) return {present:false,count:0,digest:null};
 const q=await pool.query(`SELECT COUNT(*)::bigint::text AS count, md5(COALESCE(string_agg(row_to_json(t)::text,'|' ORDER BY row_to_json(t)::text),'')) AS digest FROM ${table} t`);
 return {present:true,count:Number(q.rows[0].count),digest:String(q.rows[0].digest)};
}
async function factsDigest(){
 const q=await pool.query(`SELECT COUNT(*)::bigint::text AS count, md5(COALESCE(string_agg(row_to_json(t)::text,'|' ORDER BY row_to_json(t)::text),'')) AS digest
 FROM facts t
 WHERE (record_json::jsonb->>'type') = ANY($1::text[])`,[factTypes]);
 return {count:Number(q.rows[0].count),digest:String(q.rows[0].digest)};
}
async function snapshot(){
 const out:any={tables:{},facts:await factsDigest()};
 for(const t of tables) out.tables[t]=await tableDigest(t);
 return out;
}
async function call(path:string,token=admin,method="GET",body?:any){
 const r=await fetch(base+path,{method,headers:{authorization:`Bearer ${token}`,...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
 const text=await r.text(); let json:any=null;try{json=JSON.parse(text)}catch{}
 if(r.status>=500) throw new Error(`W2 GET/BOUNDARY 5xx ${method} ${path}: ${r.status} ${text.slice(0,500)}`);
 return {path,method,status:r.status,json,text};
}

async function prepareManualQualityReadFixture(){
 // Qualification-only fixture in the isolated ephemeral Commercial DB.
 // It supplies only the empty predecessor source tables/columns read by the
 // manual-execution-quality pure-read calculation. No production schema owner,
 // route, executor identity, or W2 measured GET is used to create them.
 await pool.query(`
   CREATE TABLE IF NOT EXISTS human_executor_index_v1 (
     tenant_id TEXT NOT NULL,
     executor_id TEXT NOT NULL,
     display_name TEXT NOT NULL DEFAULT '',
     team_id TEXT NULL,
     PRIMARY KEY (tenant_id, executor_id)
   )
 `);
 await pool.query(`
   CREATE TABLE IF NOT EXISTS work_assignment_index_v1 (
     tenant_id TEXT NOT NULL,
     assignment_id TEXT NOT NULL,
     act_task_id TEXT NOT NULL,
     executor_id TEXT NOT NULL,
     status TEXT NOT NULL,
     assigned_at TIMESTAMPTZ NOT NULL,
     arrive_deadline_ts TIMESTAMPTZ NULL,
     PRIMARY KEY (tenant_id, assignment_id)
   )
 `);
 await pool.query(`
   CREATE TABLE IF NOT EXISTS work_assignment_audit_v1 (
     tenant_id TEXT NOT NULL,
     audit_id TEXT NOT NULL,
     assignment_id TEXT NOT NULL,
     status TEXT NOT NULL,
     occurred_at TIMESTAMPTZ NOT NULL,
     PRIMARY KEY (tenant_id, audit_id)
   )
 `);
}
async function main(){
 await prepareManualQualityReadFixture();
 const before=await snapshot();
 const calls:any[]=[];
 const getPaths=[
  "/api/v1/dashboard/manual-execution-quality",
  "/api/v1/dashboard/fields/field_w2/sensing-summary",
  "/api/v1/dashboard/internal/fields/field_w2/sensing-overview",
  "/api/v1/fields/field_w2",
  "/api/v1/fields/field_w2/sensing-summary",
  "/api/v1/fields/field_w2/sensing-read-models",
  `/api/v1/skills/rules?${qp}`,
  `/api/v1/actions/index?${qp}`,
  `/api/v1/ao-act/dispatches?${qp}`,
  `/api/v1/operations/console?${qp}`,
  "/api/v1/dashboard/manual-execution-quality/tasks",
  "/api/v1/reports/customer-dashboard/field-portfolio-summary?time_range=7d",
  `/api/v1/reports/operation/operation_w2?${qp}`,
  `/api/v1/reports/field/field_w2?${qp}`,
  "/api/v1/weather/forecast/latest?field_id=field_w2",
  "/api/v1/skill/status/skill_run_w2",
  "/api/v1/skill/results/skill_run_w2",
  "/api/v1/skill/runs/skill_run_w2",
  "/api/v1/skill-runs",
  "/api/v1/skills",
  "/api/v1/skills/skill_w2",
  "/api/v1/skills/runs",
  "/api/v1/skills/bindings",
 ];
 expect(getPaths.length===23,"W2 Commercial bounded GET matrix drift",getPaths.length);
 for(const p of getPaths) calls.push(await call(p));
 await new Promise(r=>setTimeout(r,750));
 const after=await snapshot();
 expect(JSON.stringify(after)===JSON.stringify(before),"bounded GET matrix changed product state",{before,after,calls});

 const readDenied=await call("/api/v1/recommendations/generate",reader,"POST",{});
 expect(readDenied.status===403 && readDenied.json?.error==="AUTH_SCOPE_DENIED","recommendation read-only token crossed writer boundary",readDenied);
 const writerPassedAuth=await call("/api/v1/recommendations/generate",writer,"POST",{});
 expect(writerPassedAuth.status===400 && writerPassedAuth.json?.error==="MISSING_DEVICE_ID","recommendation writer did not pass auth boundary to business validation",writerPassedAuth);

 console.log(JSON.stringify({result:"PASS",workstream:"W2_CALLER_CAPABILITY_READ_WRITE_BOUNDARY",predecessor_source_schema_setup:{mode:"test_fixture_ddl",measured:false},bounded_get_count:getPaths.length,get_results:calls.map(x=>({path:x.path,status:x.status})),state_digest_unchanged:true,targets:before,recommendation:{read_only:{status:readDenied.status,error:readDenied.json?.error},writer:{status:writerPassedAuth.status,error:writerPassedAuth.json?.error}}},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>pool.end());