import crypto from "node:crypto";
import { Pool } from "pg";
const BASE_URL=String(process.env.BASE_URL??"http://127.0.0.1:3001").replace(/\/$/,"");
const DATABASE_URL=String(process.env.DATABASE_URL??"").trim();
const READ_TOKEN=String(process.env.GEOX_READ_ONLY_TOKEN??"").trim();
const WRITE_TOKEN=String(process.env.GEOX_WRITE_TOKEN??"").trim();
if(!DATABASE_URL||!READ_TOKEN||!WRITE_TOKEN) throw new Error("DATABASE_URL/GEOX_READ_ONLY_TOKEN/GEOX_WRITE_TOKEN required");
const pool=new Pool({connectionString:DATABASE_URL});
async function call(token:string|null,method:string,url:string,payload?:any){
 const headers:any={"content-type":"application/json"}; if(token) headers.authorization=`Bearer ${token}`;
 const res=await fetch(BASE_URL+url,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload)});
 const text=await res.text(); let body:any=null; try{body=text?JSON.parse(text):null;}catch{}
 return {status:res.status,body,text};
}
async function sentinelExists(s:string){const q=await pool.query("SELECT EXISTS(SELECT 1 FROM facts WHERE row_to_json(facts)::text LIKE $1) AS hit",[`%${s}%`]);return Boolean(q.rows?.[0]?.hit);}
async function main(){
 const sentinel=`bsec120_${crypto.randomUUID().replace(/-/g,"")}`;
 const payload={tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",act_task_id:sentinel,template:"ao_act_basic_v1"};
 if(await sentinelExists(sentinel)) throw new Error("sentinel collision");
 const cases=[
   {name:"anonymous",token:null,expected:[401]},
   {name:"arbitrary_bearer",token:"arbitrary",expected:[401]},
   {name:"read_only",token:READ_TOKEN,expected:[403]},
   {name:"operator_without_write",token:"operator_token",expected:[403]},
 ];
 const negatives:any[]=[];
 for(const c of cases){
   const x=await call(c.token,"POST","/api/delivery/evidence_export/v1/jobs",payload);
   if(!c.expected.includes(x.status)) throw new Error(`${c.name} create not denied: ${x.status} ${x.text}`);
   negatives.push({name:c.name,status:x.status,error:x.body?.error});
 }
 if(await sentinelExists(sentinel)) throw new Error("negative request persisted sentinel");
 const allowed=await call(WRITE_TOKEN,"POST","/api/delivery/evidence_export/v1/jobs",payload);
 if(allowed.status!==200||allowed.body?.ok!==true||!allowed.body?.job_id) throw new Error(`write create failed: ${allowed.status} ${allowed.text}`);
 const jobId=encodeURIComponent(allowed.body.job_id);
 const detail=await call(READ_TOKEN,"GET",`/api/delivery/evidence_export/v1/jobs/${jobId}`);
 if(detail.status!==200||detail.body?.job?.state!=="queued") throw new Error(`read status failed: ${detail.status} ${detail.text}`);
 if(detail.body?.job?.acceptance_fact_id!==null||detail.body?.job?.acceptance_result!==null) throw new Error("legacy export regained Acceptance authority");
 const download=await call(READ_TOKEN,"GET",`/api/delivery/evidence_export/v1/jobs/${jobId}/download`);
 if(download.status!==400||download.body?.error!=="ARTIFACT_NOT_READY") throw new Error(`read-only download regression: ${download.status} ${download.text}`);
 await new Promise(r=>setTimeout(r,750));
 if(await sentinelExists(sentinel)) throw new Error("legacy export capability proof persisted sentinel fact");
 console.log(JSON.stringify({ok:true,sentinel,negatives,allowed:{status:allowed.status,job_id:allowed.body.job_id},read_status:{status:detail.status,state:detail.body.job.state,acceptance_fact_id:null,acceptance_result:null},read_download:{status:download.status,error:download.body.error},sentinel_fact_after:false,acceptance_authority:false},null,2));
}
main().finally(()=>pool.end()).catch(e=>{console.error(e);process.exit(1);});
