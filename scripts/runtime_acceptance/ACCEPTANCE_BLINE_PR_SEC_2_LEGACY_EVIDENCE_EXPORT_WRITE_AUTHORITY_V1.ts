import Fastify from "fastify";
import path from "node:path";
import { registerDeliveryEvidenceExportV1Routes } from "../../apps/server/src/routes/delivery_evidence_export_v1.js";

process.env.GEOX_RUNTIME_ENV = "test";
process.env.GEOX_TOKENS_FILE = path.resolve("config/auth/security_acceptance_tokens.json");

const queries={total:0};
const pool={query:async()=>{queries.total+=1; throw new Error("UNEXPECTED_BSEC120_DB_QUERY");}} as any;
const POST="/api/delivery/evidence_export/v1/jobs";

async function inject(app:any,token:string|null){
  return app.inject({method:"POST",url:POST,headers:token?{authorization:`Bearer ${token}`}:{},payload:{tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",act_task_id:"bsec120_task",template:"ao_act_basic_v1"}});
}
async function main(){
 const app=Fastify({logger:false}); registerDeliveryEvidenceExportV1Routes(app,pool); await app.ready();
 const negatives=[["anonymous",null],["arbitrary","arbitrary"],["read_only","tenant_a_restricted_token"],["operator","operator_token"]] as const;
 const results:any[]=[];
 for(const [name,token] of negatives){
   const before=queries.total; const r=await inject(app,token); const body=r.json();
   if(![401,403].includes(r.statusCode)) throw new Error(`${name} unexpectedly passed: ${r.statusCode} ${r.body}`);
   if(queries.total!==before) throw new Error(`${name} reached DB`);
   results.push({name,status:r.statusCode,error:body?.error,db_delta:0});
 }
 const positive=await inject(app,"tenant_a_admin_token"); const pb=positive.json();
 if(positive.statusCode!==200||pb?.ok!==true||!pb?.job_id) throw new Error(`admin write principal failed: ${positive.statusCode} ${positive.body}`);
 if(queries.total!==0) throw new Error("positive enqueue unexpectedly touched DB");
 const jobId=String(pb.job_id);
 const status=await app.inject({method:"GET",url:`/api/delivery/evidence_export/v1/jobs/${jobId}`,headers:{authorization:"Bearer tenant_a_restricted_token"}});
 const sb=status.json();
 if(status.statusCode!==200||sb?.ok!==true) throw new Error(`read-only status failed: ${status.statusCode} ${status.body}`);
 if(sb?.job?.acceptance_fact_id!==null||sb?.job?.acceptance_result!==null) throw new Error("legacy evidence export minted Acceptance compatibility fields");
 const dl=await app.inject({method:"GET",url:`/api/delivery/evidence_export/v1/jobs/${jobId}/download`,headers:{authorization:"Bearer tenant_a_restricted_token"}});
 const db=dl.json();
 if(dl.statusCode!==400||db?.error!=="ARTIFACT_NOT_READY") throw new Error(`read-only download authority regression: ${dl.statusCode} ${dl.body}`);
 if(queries.total!==0) throw new Error("status/download unexpectedly touched DB");
 await app.close();
 console.log(JSON.stringify({ok:true,route:POST,negative_results:results,positive:{status:positive.statusCode,job_id:jobId},status_read_only:{status:status.statusCode,acceptance_fact_id:null,acceptance_result:null},download_read_only:{status:dl.statusCode,error:db.error},db_query_delta:0},null,2));
}
main().catch(e=>{console.error(e);process.exit(1);});
