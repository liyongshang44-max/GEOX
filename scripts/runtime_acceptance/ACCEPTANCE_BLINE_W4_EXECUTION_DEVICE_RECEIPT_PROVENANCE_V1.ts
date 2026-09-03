import Fastify from "fastify";
import crypto from "node:crypto";
import { registerControlPlaneV1Routes } from "../../apps/server/src/domain/controlplane/task_service.js";
import { registerControlAoSenseRoutes } from "../../apps/server/src/routes/control_ao_sense.js";
import { registerDeviceHeartbeatV1Routes } from "../../apps/server/src/routes/device_heartbeat_v1.js";
import { registerSensingFactEnvelopeV1Routes } from "../../apps/server/src/routes/sensing_fact_envelope_v1.js";
import { registerAoActV1Routes } from "../../apps/server/src/routes/control_ao_act.js";
import { registerDecisionEngineV1Routes } from "../../apps/server/src/routes/decision_engine_v1.js";

const saved=new Map<string,string|undefined>();
for(const k of ["GEOX_RUNTIME_ENV","GEOX_TOKENS_JSON","GEOX_TOKENS_FILE","GEOX_TOKEN_SSOT_PATH","GEOX_TOKEN","GEOX_AO_ACT_TOKEN","AO_ACT_TOKEN"])saved.set(k,process.env[k]);
function restore(){for(const [k,v] of saved){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
function expect(c:any,m:string,d?:any){if(!c)throw new Error(m+(d===undefined?"":": "+JSON.stringify(d)));}
const tokens:any={version:"ao_act_tokens_v0",tokens:[
 {token:"w4_admin",token_id:"tok_admin",actor_id:"admin_actor",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",role:"admin",scopes:["action.task.dispatch","action.receipt.submit","ao_act.receipt.write","telemetry.write"],revoked:false},
 {token:"w4_operator",token_id:"tok_operator",actor_id:"operator_actor",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",role:"operator",scopes:["action.task.dispatch","action.receipt.submit","ao_act.receipt.write","telemetry.write"],revoked:false},
 {token:"w4_executor",token_id:"tok_executor",actor_id:"executor_actor",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",role:"executor",scopes:["action.task.dispatch","action.receipt.submit","ao_act.receipt.write","telemetry.write"],revoked:false},
 {token:"w4_telemetry",token_id:"tok_telemetry",actor_id:"telemetry_service",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",role:"operator",scopes:["telemetry.write"],revoked:false},
 {token:"w4_read",token_id:"tok_read",actor_id:"reader",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",role:"viewer",scopes:["telemetry.read"],revoked:false}
]};
function bearer(t:string){return {authorization:`Bearer ${t}`,"content-type":"application/json"};}
function sha(v:string){return crypto.createHash("sha256").update(v).digest("hex");}
class StubPool{
 reads=0;mutations=0;connects=0;
 async query(sql:any,params:any[]=[]){
  const q=String(sql??"");if(/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i.test(q))this.mutations++;else this.reads++;
  if(/device_credential_index_v1 c/i.test(q)){
   if(String(params?.[0])==="dev_w4"&&String(params?.[1])===sha("device_secret_w4"))return {rowCount:1,rows:[{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",field_id:"field_w4",device_id:"dev_w4",credential_id:"cred_w4"}]};
   return {rowCount:0,rows:[]};
  }
  if(/information_schema\.columns/i.test(q))return {rowCount:8,rows:["tenant_id","project_id","group_id","field_id","device_id","last_heartbeat_ts_ms","updated_ts_ms","status"].map(column_name=>({column_name}))};
  if(/INSERT INTO device_status_index_v1/i.test(q))return {rowCount:1,rows:[]};
  if(/FROM\s+facts/i.test(q))return {rowCount:0,rows:[]};
  return {rowCount:0,rows:[]};
 }
 async connect(){this.connects++;return {query:this.query.bind(this),release(){}};}
}
async function post(app:any,url:string,token?:string,body:any={}){
 const res=await app.inject({method:"POST",url,headers:token?bearer(token):{"content-type":"application/json"},payload:body});
 let json:any=null;try{json=res.json();}catch{}
 return {status:res.statusCode,json,body:res.body};
}
async function main(){
 process.env.GEOX_RUNTIME_ENV="test";process.env.GEOX_TOKENS_JSON=JSON.stringify(tokens);
 delete process.env.GEOX_TOKENS_FILE;delete process.env.GEOX_TOKEN_SSOT_PATH;delete process.env.GEOX_TOKEN;delete process.env.GEOX_AO_ACT_TOKEN;delete process.env.AO_ACT_TOKEN;
 const pool=new StubPool();

 const cp=Fastify({logger:false});registerControlPlaneV1Routes(cp,pool as any);await cp.ready();
 const adminClaim=await post(cp,"/api/v1/ao-act/dispatches/claim","w4_admin",{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",executor_id:"admin_actor"});
 expect(adminClaim.status===403&&adminClaim.json?.error==="EXECUTOR_PRINCIPAL_REQUIRED","admin gained executor claim authority",adminClaim);
 const operatorClaim=await post(cp,"/api/v1/ao-act/dispatches/claim","w4_operator",{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",executor_id:"operator_actor"});
 expect(operatorClaim.status===403&&operatorClaim.json?.error==="EXECUTOR_PRINCIPAL_REQUIRED","operator gained executor claim authority",operatorClaim);
 const mismatchClaim=await post(cp,"/api/v1/ao-act/dispatches/claim","w4_executor",{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",executor_id:"caller_declared"});
 expect(mismatchClaim.status===403&&mismatchClaim.json?.error==="EXECUTOR_IDENTITY_MISMATCH","caller-declared executor survived claim boundary",mismatchClaim);
 const executorClaim=await post(cp,"/api/v1/ao-act/dispatches/claim","w4_executor",{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",executor_id:"executor_actor",limit:1});
 expect(executorClaim.status!==401&&executorClaim.status!==403,"dedicated executor did not cross claim auth boundary",executorClaim);
 const adminWrapperReceipt=await post(cp,"/api/v1/ao-act/receipts","w4_admin",{});
 expect(adminWrapperReceipt.status===403&&adminWrapperReceipt.json?.error==="EXECUTION_PRINCIPAL_REQUIRED","admin gained Commercial receipt principal",adminWrapperReceipt);
 const executorWrapperReceipt=await post(cp,"/api/v1/ao-act/receipts","w4_executor",{});
 expect(executorWrapperReceipt.status!==401&&executorWrapperReceipt.status!==403,"executor did not cross Commercial receipt auth boundary",executorWrapperReceipt);
 await cp.close();

 const ao=Fastify({logger:false});registerAoActV1Routes(ao,pool as any);await ao.ready();
 const adminDirect=await post(ao,"/api/v1/actions/receipt","w4_admin",{});
 expect(adminDirect.status===403&&adminDirect.json?.error==="ACTION_RECEIPT_SUBMIT_ROLE_DENIED","admin gained direct receipt authority",adminDirect);
 const execMismatch=await post(ao,"/api/v1/actions/receipt","w4_executor",{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",executor_id:{kind:"script",id:"declared",namespace:"x"}});
 expect(execMismatch.status!==200,"malformed/mismatched receipt unexpectedly persisted",execMismatch);
 await ao.close();

 const de=Fastify({logger:false});registerDecisionEngineV1Routes(de,pool as any);await de.ready();
 const adminSim=await post(de,"/api/v1/simulators/irrigation/execute","w4_admin",{});
 expect(adminSim.status===403,"admin gained executor simulator authority",adminSim);
 const execSim=await post(de,"/api/v1/simulators/irrigation/execute","w4_executor",{});
 expect(execSim.status===400&&execSim.json?.error==="MISSING_TASK_ID","dedicated executor did not cross simulator auth boundary",execSim);
 await de.close();

 const sense=Fastify({logger:false});registerControlAoSenseRoutes(sense,pool as any);await sense.ready();
 const anonSense=await post(sense,"/api/v1/sense/task",undefined,{});
 expect(anonSense.status===401,"anonymous AO-SENSE task not denied",anonSense);
 const wrongSense=await post(sense,"/api/v1/sense/task","w4_read",{});
 expect(wrongSense.status===403,"wrong-scope AO-SENSE task not denied",wrongSense);
 const telemetrySense=await post(sense,"/api/v1/sense/task","w4_telemetry",{});
 expect(telemetrySense.status===400,"telemetry writer did not cross AO-SENSE auth boundary",telemetrySense);
 await sense.close();

 const hb=Fastify({logger:false});registerDeviceHeartbeatV1Routes(hb,pool as any);await hb.ready();
 const hbAnon=await post(hb,"/api/v1/devices/dev_w4/heartbeat",undefined,{});
 expect(hbAnon.status===401,"anonymous heartbeat not denied",hbAnon);
 const hbStructured=await post(hb,"/api/v1/devices/dev_w4/heartbeat","w4_admin",{});
 expect(hbStructured.status===401,"structured admin bearer masqueraded as device secret",hbStructured);
 const beforeGoodHeartbeat=pool.mutations;
 const hbGood=await post(hb,"/api/v1/devices/dev_w4/heartbeat","device_secret_w4",{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA"});
 expect(hbGood.status===200&&hbGood.json?.device_id==="dev_w4"&&hbGood.json?.credential_id==="cred_w4","valid device credential heartbeat failed",hbGood);
 expect(pool.mutations===beforeGoodHeartbeat+1,"device heartbeat did not produce exactly one status mutation",{beforeGoodHeartbeat,mutations:pool.mutations});
 const hbCross=await post(hb,"/api/v1/devices/dev_w4/heartbeat","device_secret_w4",{tenant_id:"tenantB"});
 expect(hbCross.status===404,"device heartbeat body overrode credential scope",hbCross);
 await hb.close();

 const raw=Fastify({logger:false});registerSensingFactEnvelopeV1Routes(raw,pool as any);await raw.ready();
 const formalBody={tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",sample_id:"sample_w4",sensor_id:"dev_w4",field_id:"field_w4",ts_ms:Date.now(),metric:"pressure",value:1,unit:"kPa",qc_quality:"ok",source:"device",payload:{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",field_id:"field_w4",device_id:"dev_w4",credential_id:"cred_w4",sample_kind:"raw",interpolated:false,synthetic:false}};
 const rawAdmin=await post(raw,"/api/v1/sensing/raw-samples","w4_admin",formalBody);
 expect(rawAdmin.status===401,"structured bearer masqueraded as device raw-sensing principal",rawAdmin);
 const rawWrongDevice=await post(raw,"/api/v1/sensing/raw-samples","device_secret_w4",{...formalBody,sensor_id:"other",payload:{...formalBody.payload,device_id:"other"}});
 expect([401,404].includes(rawWrongDevice.status),"wrong device identity not denied",rawWrongDevice);
 await raw.close();

 console.log(JSON.stringify({result:"PASS",workstream:"W4_EXECUTION_DEVICE_RECEIPT_PROVENANCE",executor:{admin_claim:adminClaim.status,operator_claim:operatorClaim.status,mismatch_claim:mismatchClaim.status,dedicated_claim:executorClaim.status,admin_receipt:adminWrapperReceipt.status,dedicated_receipt:executorWrapperReceipt.status,admin_simulator:adminSim.status,dedicated_simulator:execSim.status},ao_sense:{anonymous:anonSense.status,wrong_scope:wrongSense.status,telemetry_writer:telemetrySense.status},device:{anonymous:hbAnon.status,structured_bearer:hbStructured.status,valid:hbGood.status,cross_scope:hbCross.status},http_sensing:{structured_bearer:rawAdmin.status,wrong_device:rawWrongDevice.status},mutation_count:pool.mutations},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(restore);
