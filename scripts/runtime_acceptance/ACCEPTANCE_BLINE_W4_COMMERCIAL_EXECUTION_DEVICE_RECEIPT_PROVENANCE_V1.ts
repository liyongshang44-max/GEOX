import pg from "pg";
import crypto from "node:crypto";
const {Pool}=pg;
const base=String(process.env.BASE_URL??"http://127.0.0.1:3001").replace(/\/$/,"");
const dbUrl=String(process.env.DATABASE_URL??"").trim();
const admin=String(process.env.GEOX_W4_ADMIN_TOKEN??"tenant_a_admin_token").trim();
const operator=String(process.env.GEOX_W4_OPERATOR_TOKEN??"operator_token").trim();
const operatorReceipt=String(process.env.GEOX_W4_OPERATOR_RECEIPT_TOKEN??"w4_operator_receipt_token").trim();
const readOnly=String(process.env.GEOX_W4_READ_ONLY_TOKEN??"client_token").trim();
const executor=String(process.env.GEOX_W4_EXECUTOR_TOKEN??"executor_token").trim();
if(!dbUrl)throw new Error("W4 DATABASE_URL missing");
const pool=new Pool({connectionString:dbUrl});
const run=Date.now().toString(36);
const scope={tenant_id:"tenantA",project_id:"projectA",group_id:"groupA"};
const field_id=`field_w4_${run}`,device_id=`dev_w4_${run}`,credential_id=`cred_w4_${run}`,deviceSecret=`w4_device_secret_${run}`;
function sha(v:string){return crypto.createHash("sha256").update(v).digest("hex");}
function expect(c:any,m:string,d?:any){if(!c)throw new Error(m+(d===undefined?"":": "+JSON.stringify(d)));}
async function call(path:string,token:string|null,body:any={}){
 const r=await fetch(base+path,{method:"POST",headers:{...(token?{authorization:`Bearer ${token}`}:{}),"content-type":"application/json"},body:JSON.stringify(body)});
 const text=await r.text();let json:any=null;try{json=JSON.parse(text)}catch{}
 if(r.status>=500)throw new Error(`W4 5xx ${path}: ${r.status} ${text.slice(0,500)}`);
 return {path,status:r.status,json,text};
}
async function tableDigest(table:string,whereSql="",args:any[]=[]){
 const reg=await pool.query("SELECT to_regclass($1) AS reg",[table]);
 if(!reg.rows?.[0]?.reg)return {present:false,count:0,digest:null};
 const q=await pool.query(`SELECT COUNT(*)::bigint::text count,md5(COALESCE(string_agg(row_to_json(t)::text,'|' ORDER BY row_to_json(t)::text),'')) digest FROM ${table} t ${whereSql}`,args);
 return {present:true,count:Number(q.rows[0].count),digest:String(q.rows[0].digest)};
}
async function snapshot(){
 const facts=await pool.query(`SELECT COUNT(*)::bigint::text count,md5(COALESCE(string_agg(row_to_json(t)::text,'|' ORDER BY row_to_json(t)::text),'')) digest FROM facts t WHERE (record_json::jsonb->>'type')=ANY($1::text[])`,[["ao_sense_task_v1","ao_sense_receipt_v1","ao_act_receipt_v1","ao_act_receipt_recorded_v1","device_observation_v1","raw_sample_fact_v1"]]);
 return {
  facts:{count:Number(facts.rows[0].count),digest:String(facts.rows[0].digest)},
  device_status:await tableDigest("device_status_index_v1","WHERE tenant_id=$1 AND device_id=$2",[scope.tenant_id,device_id]),
  dispatch:await tableDigest("dispatch_queue_v1","WHERE tenant_id=$1",[scope.tenant_id])
 };
}
async function seed(){
 const ts=Date.now();
 await pool.query(`INSERT INTO field_index_v1(tenant_id,field_id,name,area_ha,status,project_id,group_id,created_ts_ms,updated_ts_ms)
 VALUES($1,$2,$3,1,'ACTIVE',$4,$5,$6,$6)
 ON CONFLICT(tenant_id,field_id) DO UPDATE SET project_id=EXCLUDED.project_id,group_id=EXCLUDED.group_id,updated_ts_ms=EXCLUDED.updated_ts_ms`,
 [scope.tenant_id,field_id,"W4 field",scope.project_id,scope.group_id,ts]);
 await pool.query(`INSERT INTO device_index_v1(tenant_id,device_id,display_name,created_ts_ms,last_credential_id,last_credential_status)
 VALUES($1,$2,$3,$4,$5,'ACTIVE')
 ON CONFLICT(tenant_id,device_id) DO UPDATE SET last_credential_id=EXCLUDED.last_credential_id,last_credential_status='ACTIVE'`,
 [scope.tenant_id,device_id,"W4 device",ts,credential_id]);
 await pool.query(`INSERT INTO device_binding_index_v1(tenant_id,device_id,field_id,bound_ts_ms) VALUES($1,$2,$3,$4)
 ON CONFLICT(tenant_id,device_id,field_id) DO UPDATE SET bound_ts_ms=EXCLUDED.bound_ts_ms`,[scope.tenant_id,device_id,field_id,ts]);
 await pool.query(`INSERT INTO device_credential_index_v1(tenant_id,device_id,credential_id,credential_hash,status,issued_ts_ms,revoked_ts_ms,created_ts_ms,updated_ts_ms)
 VALUES($1,$2,$3,$4,'ACTIVE',$5,NULL,$5,$5)
 ON CONFLICT(tenant_id,device_id,credential_id) DO UPDATE SET credential_hash=EXCLUDED.credential_hash,status='ACTIVE',revoked_ts_ms=NULL,updated_ts_ms=EXCLUDED.updated_ts_ms`,
 [scope.tenant_id,device_id,credential_id,sha(deviceSecret),ts]);
 await pool.query(`INSERT INTO device_capability(tenant_id,device_id,capabilities,updated_ts_ms) VALUES($1,$2,$3::jsonb,$4)
 ON CONFLICT(tenant_id,device_id) DO UPDATE SET capabilities=EXCLUDED.capabilities,updated_ts_ms=EXCLUDED.updated_ts_ms`,
 [scope.tenant_id,device_id,JSON.stringify(["telemetry.water_pressure","telemetry.soil_moisture"]),ts]);
 await pool.query(`INSERT INTO device_status_index_v1(tenant_id,project_id,group_id,field_id,device_id,status,last_telemetry_ts_ms,last_heartbeat_ts_ms,battery_percent,rssi_dbm,fw_ver,updated_ts_ms)
 VALUES($1,$2,$3,$4,$5,'ONLINE',$6,$6,90,-50,'w4',$6)
 ON CONFLICT(tenant_id,device_id) DO UPDATE SET project_id=EXCLUDED.project_id,group_id=EXCLUDED.group_id,field_id=EXCLUDED.field_id,status='ONLINE',updated_ts_ms=EXCLUDED.updated_ts_ms`,
 [scope.tenant_id,scope.project_id,scope.group_id,field_id,device_id,ts-60000]);
 await pool.query(`INSERT INTO facts(fact_id,occurred_at,source,record_json) VALUES($1,NOW(),'w4_qualification',$2::jsonb)`,
 [`w4_obs_${run}`,JSON.stringify({type:"device_observation_v1",payload:{...scope,field_id,device_id}})]);
}
async function main(){
 await seed();
 const before=await snapshot();
 const denied:any[]=[];
 denied.push(await call(`/api/v1/devices/${device_id}/heartbeat`,null,{...scope}));
 denied.push(await call(`/api/v1/devices/${device_id}/heartbeat`,admin,{...scope}));
 denied.push(await call(`/api/v1/devices/${device_id}/heartbeat`,"wrong_secret",{...scope}));
 denied.push(await call(`/api/v1/devices/${device_id}/heartbeat`,deviceSecret,{...scope,tenant_id:"tenantB"}));
 const formalBody={...scope,sample_id:`sample_${run}`,sensor_id:device_id,field_id,ts_ms:Date.now()-1000,metric:"pressure",value:42,unit:"kPa",qc_quality:"ok",source:"device",payload:{...scope,field_id,device_id,credential_id,sample_kind:"raw",interpolated:false,synthetic:false}};
 denied.push(await call("/api/v1/sensing/raw-samples",admin,formalBody));
 denied.push(await call("/api/v1/sensing/raw-samples","wrong_secret",formalBody));
 denied.push(await call("/api/v1/sense/task",null,{}));
 denied.push(await call("/api/v1/sense/task",admin,{}));
 denied.push(await call("/api/v1/sense/task",operator,{subjectRef:{projectId:"projectB",groupId:scope.group_id},window:{startTs:Date.now(),endTs:Date.now()+1000},sense_kind:"telemetry",sense_focus:"soil",priority:"normal",supporting_problem_state_id:"p",supporting_determinism_hash:"d",supporting_effective_config_hash:"c"}));
 denied.push(await call("/api/v1/ao-act/dispatches/claim",admin,{...scope,executor_id:"actor_tenant_a_admin"}));
 denied.push(await call("/api/v1/ao-act/dispatches/claim",operator,{...scope,executor_id:"tok_operator_actor"}));
 denied.push(await call("/api/v1/ao-act/dispatches/claim",executor,{...scope,executor_id:"caller_declared"}));
 denied.push(await call("/api/v1/actions/execute",executor,{}));
 denied.push(await call("/api/v1/operations/manual",executor,{}));
 denied.push(await call("/api/v1/manual-takeovers/takeover_w4/ack",executor,{...scope}));
 denied.push(await call("/api/v1/manual-takeovers/takeover_w4/complete",executor,{...scope}));
 denied.push(await call("/api/v1/fail-safe/events/fail_w4/resolve",executor,{...scope}));
 denied.push(await call("/api/v1/actions/receipt",admin,{}));
 denied.push(await call("/api/v1/ao-act/receipts",admin,{}));
 denied.push(await call("/api/v1/ao-act/receipts",operator,{}));
 denied.push(await call("/api/v1/ao-act/receipts",readOnly,{executor_id:{kind:"script",id:"tok_executor_actor",namespace:"caller_declared"}}));
 denied.push(await call("/api/v1/simulators/irrigation/execute",admin,{}));
 for(const x of denied)expect([401,403,404].includes(x.status),"W4 denied probe unexpectedly passed",{path:x.path,status:x.status,body:x.json});
 await new Promise(r=>setTimeout(r,250));
 const afterDenied=await snapshot();
 expect(JSON.stringify(afterDenied)===JSON.stringify(before),"W4 denied identity probes mutated product state",{before,afterDenied,denied:denied.map(x=>({path:x.path,status:x.status,error:x.json?.error}))});

 const heartbeat=await call(`/api/v1/devices/${device_id}/heartbeat`,deviceSecret,{...scope,status:"ONLINE"});
 expect(heartbeat.status===200&&heartbeat.json?.device_id===device_id&&heartbeat.json?.credential_id===credential_id,"valid device heartbeat failed",heartbeat);
 const raw=await call("/api/v1/sensing/raw-samples",deviceSecret,formalBody);
 expect(![401,403,404].includes(raw.status),"valid device raw-sensing identity rejected before product validation",raw);
 const senseTaskBody={subjectRef:{projectId:scope.project_id,groupId:scope.group_id},window:{startTs:Date.now(),endTs:Date.now()+60000},sense_kind:"telemetry",sense_focus:"soil",priority:"normal",supporting_problem_state_id:"w4_problem",supporting_determinism_hash:"w4_det",supporting_effective_config_hash:"w4_cfg"};
 const senseTask=await call("/api/v1/sense/task",operator,senseTaskBody);
 expect(senseTask.status===200&&senseTask.json?.task_id,"authorized AO-SENSE task failed",senseTask);
 const senseReceipt=await call("/api/v1/sense/receipt",operator,{task_id:senseTask.json.task_id,executed_at_ts:Date.now(),result:"success",evidence_refs:[{kind:"fact_id",ref_id:`w4_obs_${run}`}]});
 expect(senseReceipt.status===200&&senseReceipt.json?.receipt_id,"authorized AO-SENSE receipt failed",senseReceipt);
 const execClaim=await call("/api/v1/ao-act/dispatches/claim",executor,{...scope,executor_id:"tok_executor_actor",limit:1});
 expect(![401,403].includes(execClaim.status),"dedicated executor failed claim authority",execClaim);
 const execSimulator=await call("/api/v1/simulators/irrigation/execute",executor,{});
 expect(execSimulator.status===400&&execSimulator.json?.error==="MISSING_TASK_ID","dedicated executor failed simulator authority boundary",execSimulator);
 const execReceipt=await call("/api/v1/ao-act/receipts",executor,{});
 expect(![401,403].includes(execReceipt.status),"dedicated executor failed BSEC-192 receipt authority boundary",execReceipt);
 const opReceipt=await call("/api/v1/ao-act/receipts",operatorReceipt,{});
 expect(![401,403].includes(opReceipt.status),"acceptance-only operator receipt principal failed BSEC-192 authority boundary",opReceipt);
 const after=await snapshot();
 console.log(JSON.stringify({result:"PASS",workstream:"W4_EXECUTION_DEVICE_RECEIPT_PROVENANCE",denied_count:denied.length,denied_state_unchanged:true,denied:denied.map(x=>({path:x.path,status:x.status,error:x.json?.error})),authorized:{heartbeat:{status:heartbeat.status,credential_id:heartbeat.json?.credential_id},raw_sensing:{status:raw.status,error:raw.json?.error},ao_sense_task:{status:senseTask.status,task_id:senseTask.json?.task_id},ao_sense_receipt:{status:senseReceipt.status,receipt_id:senseReceipt.json?.receipt_id},executor_claim:{status:execClaim.status},executor_simulator:{status:execSimulator.status,error:execSimulator.json?.error},executor_receipt:{status:execReceipt.status,error:execReceipt.json?.error},operator_receipt:{status:opReceipt.status,error:opReceipt.json?.error}},after},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>pool.end());
