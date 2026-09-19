import Fastify from "fastify";
import { registerDeliveryEvidenceExportV1Routes } from "../../apps/server/src/routes/delivery_evidence_export_v1.js";

const oldTokens = process.env.GEOX_TOKENS_JSON;
process.env.GEOX_TOKENS_JSON = JSON.stringify({
  version: "ao_act_tokens_v0",
  tokens: [
    { token:"read_only", token_id:"tok_read", actor_id:"read", tenant_id:"tenantA", project_id:"projectA", group_id:"groupA", role:"admin", scopes:["ao_act.index.read"], revoked:false },
    { token:"writer", token_id:"tok_writer", actor_id:"writer", tenant_id:"tenantA", project_id:"projectA", group_id:"groupA", role:"admin", scopes:["ao_act.index.read","evidence_export.write"], revoked:false }
  ]
});
let dbQueries=0;
const pool={query:async()=>{dbQueries+=1;throw new Error("UNEXPECTED_DB_QUERY");}} as any;

async function req(app:any,token:string,method:string,url:string,payload?:any){
  const res=await app.inject({method,url,headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},payload});
  let body:any=null; try{body=res.json();}catch{}
  return {status:res.statusCode,body};
}
async function main(){
  const app=Fastify({logger:false});
  registerDeliveryEvidenceExportV1Routes(app,pool);
  await app.ready();
  const payload={tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",act_task_id:"batch008_task",template:"ao_act_basic_v1"};
  const denied=await req(app,"read_only","POST","/api/delivery/evidence_export/v1/jobs",payload);
  if(denied.status!==403||denied.body?.error!=="AUTH_SCOPE_DENIED") throw new Error(`read-only token not denied: ${JSON.stringify(denied)}`);
  const allowed=await req(app,"writer","POST","/api/delivery/evidence_export/v1/jobs",payload);
  if(allowed.status!==200||allowed.body?.ok!==true||!allowed.body?.job_id) throw new Error(`writer token not allowed: ${JSON.stringify(allowed)}`);
  const detail=await req(app,"read_only","GET",`/api/delivery/evidence_export/v1/jobs/${encodeURIComponent(allowed.body.job_id)}`);
  if(detail.status!==200||detail.body?.job?.state!=="queued") throw new Error(`read status regression: ${JSON.stringify(detail)}`);
  if(detail.body?.job?.acceptance_fact_id!==null||detail.body?.job?.acceptance_result!==null) throw new Error("legacy export regained Acceptance authority");
  if(dbQueries!==0) throw new Error(`unexpected DB query count ${dbQueries}`);
  await app.close();
  console.log(JSON.stringify({ok:true,denied,allowed:{status:allowed.status,job_id:allowed.body.job_id},detail:{status:detail.status,state:detail.body.job.state,acceptance_fact_id:null,acceptance_result:null},db_query_delta:0},null,2));
}
main().finally(()=>{ if(oldTokens===undefined) delete process.env.GEOX_TOKENS_JSON; else process.env.GEOX_TOKENS_JSON=oldTokens; }).catch(e=>{console.error(e);process.exit(1);});