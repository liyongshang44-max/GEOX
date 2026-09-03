import Fastify from "fastify";
import { registerDeliveryEvidenceExportV1Routes } from "../../apps/server/src/routes/delivery_evidence_export_v1.js";

const oldTokens = process.env.GEOX_TOKENS_JSON;
process.env.GEOX_TOKENS_JSON = JSON.stringify({
  version: "ao_act_tokens_v0",
  tokens: [
    { token:"read_only", token_id:"tok_read", actor_id:"read", tenant_id:"tenantA", project_id:"projectA", group_id:"groupA", role:"admin", scopes:["ao_act.index.read"], revoked:false },
    { token:"operator", token_id:"tok_operator", actor_id:"operator", tenant_id:"tenantA", project_id:"projectA", group_id:"groupA", role:"operator", scopes:["ao_act.index.read"], revoked:false },
    { token:"writer", token_id:"tok_writer", actor_id:"writer", tenant_id:"tenantA", project_id:"projectA", group_id:"groupA", role:"admin", scopes:["ao_act.index.read","evidence_export.write"], revoked:false }
  ]
});
let dbQueries=0;
const pool={query:async()=>{dbQueries+=1;throw new Error("UNEXPECTED_DB_QUERY");}} as any;

async function req(app:any,token:string|null,method:string,url:string,payload?:any){
  const headers:any={"content-type":"application/json"};
  if(token) headers.authorization=`Bearer ${token}`;
  const res=await app.inject({method,url,headers,payload});
  let body:any=null; try{body=res.json();}catch{}
  return {status:res.statusCode,body,text:res.body};
}
async function main(){
  const app=Fastify({logger:false});
  registerDeliveryEvidenceExportV1Routes(app,pool);
  await app.ready();
  const payload={tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",act_task_id:"batch008_task",template:"ao_act_basic_v1"};
  const negativeCases=[
    {name:"anonymous",token:null,expected:[401]},
    {name:"arbitrary_bearer",token:"arbitrary",expected:[401]},
    {name:"read_only",token:"read_only",expected:[403]},
    {name:"operator_without_write",token:"operator",expected:[403]},
  ];
  const negatives:any[]=[];
  for(const c of negativeCases){
    const before=dbQueries;
    const x=await req(app,c.token,"POST","/api/delivery/evidence_export/v1/jobs",payload);
    if(!c.expected.includes(x.status)) throw new Error(`${c.name} unexpectedly passed: ${x.status} ${x.text}`);
    if(dbQueries!==before) throw new Error(`${c.name} reached DB`);
    negatives.push({name:c.name,status:x.status,error:x.body?.error,db_query_delta:0});
  }
  const allowed=await req(app,"writer","POST","/api/delivery/evidence_export/v1/jobs",payload);
  if(allowed.status!==200||allowed.body?.ok!==true||!allowed.body?.job_id) throw new Error(`writer token not allowed: ${JSON.stringify(allowed)}`);
  const jobId=encodeURIComponent(allowed.body.job_id);
  const detail=await req(app,"read_only","GET",`/api/delivery/evidence_export/v1/jobs/${jobId}`);
  if(detail.status!==200||detail.body?.job?.state!=="queued") throw new Error(`read status regression: ${JSON.stringify(detail)}`);
  if(detail.body?.job?.acceptance_fact_id!==null||detail.body?.job?.acceptance_result!==null) throw new Error("legacy export regained Acceptance authority");
  const download=await req(app,"read_only","GET",`/api/delivery/evidence_export/v1/jobs/${jobId}/download`);
  if(download.status!==400||download.body?.error!=="ARTIFACT_NOT_READY") throw new Error(`read-only download regression: ${JSON.stringify(download)}`);
  if(dbQueries!==0) throw new Error(`unexpected DB query count ${dbQueries}`);
  await app.close();
  console.log(JSON.stringify({ok:true,negatives,allowed:{status:allowed.status,job_id:allowed.body.job_id},detail:{status:detail.status,state:detail.body.job.state,acceptance_fact_id:null,acceptance_result:null},download:{status:download.status,error:download.body.error},db_query_delta:0},null,2));
}
main().finally(()=>{ if(oldTokens===undefined) delete process.env.GEOX_TOKENS_JSON; else process.env.GEOX_TOKENS_JSON=oldTokens; }).catch(e=>{console.error(e);process.exit(1);});
