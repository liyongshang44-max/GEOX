import crypto from "node:crypto";
import { Pool } from "pg";
const BASE=String(process.env.BASE_URL??"http://127.0.0.1:3001").replace(/\/$/,"");
const DB=String(process.env.DATABASE_URL??"").trim();
if(!DB) throw new Error("DATABASE_URL required");
const pool=new Pool({connectionString:DB});
const POST="/api/delivery/evidence_export/v1/jobs";
async function sentinel(s:string){const p=await pool.query("SELECT to_regclass('public.facts') IS NOT NULL AS present"); if(!p.rows[0]?.present)return false; const q=await pool.query("SELECT EXISTS(SELECT 1 FROM facts WHERE row_to_json(facts)::text LIKE $1) AS hit",[`%${s}%`]); return Boolean(q.rows[0]?.hit);}
async function post(token:string|null,s:string){const r=await fetch(BASE+POST,{method:"POST",headers:{"content-type":"application/json",...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify({tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",act_task_id:s,template:"ao_act_basic_v1"})}); const t=await r.text(); let j:any=null;try{j=t?JSON.parse(t):null}catch{};return {r,j,t};}
async function get(path:string,token:string){const r=await fetch(BASE+path,{headers:{authorization:`Bearer ${token}`}});const t=await r.text();let j:any=null;try{j=t?JSON.parse(t):null}catch{};return {r,j,t};}
async function main(){
 const s=`bsec120_${crypto.randomUUID().replace(/-/g,"")}`;
 if(await sentinel(s)) throw new Error("sentinel collision");
 const neg=[["anonymous",null],["arbitrary","arbitrary"],["read_only","tenant_a_restricted_token"],["operator","operator_token"]] as const;
 const results:any[]=[];
 for(const [name,tok] of neg){const x=await post(tok,s); if(![401,403].includes(x.r.status))throw new Error(`${name} unexpectedly passed ${x.r.status} ${x.t}`);results.push({name,status:x.r.status,error:x.j?.error});}
 if(await sentinel(s)) throw new Error("negative request persisted sentinel");
 const pos=await post("tenant_a_admin_token",s); if(pos.r.status!==200||pos.j?.ok!==true||!pos.j?.job_id)throw new Error(`admin failed ${pos.r.status} ${pos.t}`);
 const id=String(pos.j.job_id);
 const st=await get(`/api/delivery/evidence_export/v1/jobs/${id}`,"tenant_a_restricted_token");
 if(st.r.status!==200||st.j?.job?.acceptance_fact_id!==null||st.j?.job?.acceptance_result!==null)throw new Error(`status regression ${st.r.status} ${st.t}`);
 const dl=await get(`/api/delivery/evidence_export/v1/jobs/${id}/download`,"tenant_a_restricted_token");
 if(dl.r.status!==400||dl.j?.error!=="ARTIFACT_NOT_READY")throw new Error(`download regression ${dl.r.status} ${dl.t}`);
 await new Promise(r=>setTimeout(r,500));
 if(await sentinel(s)) throw new Error("Batch008 persisted sentinel fact");
 console.log(JSON.stringify({ok:true,route:POST,sentinel:s,negative_results:results,positive:{status:pos.r.status,job_id:id},status_read_only:{status:st.r.status,acceptance_fact_id:null,acceptance_result:null},download_read_only:{status:dl.r.status,error:dl.j.error},sentinel_fact_after:false},null,2));
}
main().finally(()=>pool.end()).catch(e=>{console.error(e);process.exit(1);});
