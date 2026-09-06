import pg from "pg";
const {Pool}=pg;
const base=String(process.env.BASE_URL??"http://127.0.0.1:3001").replace(/\/$/,"");
const dbUrl=String(process.env.DATABASE_URL??"").trim();
const tokens={
 task:String(process.env.GEOX_W3_TASK_ONLY_TOKEN??"").trim(),
 recWriter:String(process.env.GEOX_W3_RECOMMENDATION_WRITER_TOKEN??"").trim(),
 recRequest:String(process.env.GEOX_W3_RECOMMENDATION_REQUEST_TOKEN??"").trim(),
 approvalRequest:String(process.env.GEOX_W3_APPROVAL_REQUEST_TOKEN??"").trim(),
 prescriptionSubmit:String(process.env.GEOX_W3_PRESCRIPTION_SUBMIT_TOKEN??"").trim(),
 approvalDecide:String(process.env.GEOX_W3_APPROVAL_DECIDE_TOKEN??"").trim()
};
if(!dbUrl||Object.values(tokens).some(x=>!x))throw new Error("W3 commercial proof env missing");
const pool=new Pool({connectionString:dbUrl});
const scope={tenant_id:"tenantA",project_id:"projectA",group_id:"groupA"};
function expect(c:any,m:string,d?:any){if(!c)throw new Error(m+(d===undefined?"":": "+JSON.stringify(d)));}
async function call(path:string,token:string,body:any={}){
 const r=await fetch(base+path,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify(body)});
 const text=await r.text();let json:any=null;try{json=JSON.parse(text)}catch{}
 if(r.status>=500)throw new Error(`W3 commercial 5xx ${path}: ${r.status} ${text.slice(0,500)}`);
 return {path,status:r.status,json,text};
}
async function snapshot(){
 const fact=await pool.query(`SELECT COUNT(*)::bigint::text AS count, md5(COALESCE(string_agg(row_to_json(t)::text,'|' ORDER BY row_to_json(t)::text),'')) AS digest FROM facts t WHERE (record_json::jsonb->>'type') = ANY($1::text[])`,[["approval_request_v1","approval_decision_v1","decision_recommendation_approval_link_v1","operation_plan_v1","operation_plan_transition_v1","ao_act_task_v0"]]);
 const reg=await pool.query("SELECT to_regclass('operation_plan_index_v1') AS reg");
 let plan:{present:boolean,count:number,digest:string|null}={present:false,count:0,digest:null};
 if(reg.rows?.[0]?.reg){
  const q=await pool.query(`SELECT COUNT(*)::bigint::text AS count, md5(COALESCE(string_agg(row_to_json(t)::text,'|' ORDER BY row_to_json(t)::text),'')) AS digest FROM operation_plan_index_v1 t`);
  plan={present:true,count:Number(q.rows[0].count),digest:String(q.rows[0].digest)};
 }
 return {facts:{count:Number(fact.rows[0].count),digest:String(fact.rows[0].digest)},operation_plan_index_v1:plan};
}
async function denied(path:string,token:string,body:any,label:string){
 const r=await call(path,token,body);
 expect(r.status===403&&r.json?.error==="AUTH_SCOPE_DENIED",label+" not denied",r);
 return r;
}
async function main(){
 const before=await snapshot();
 const negatives:any[]=[];
 negatives.push(await denied("/api/v1/recommendations/missing/submit-approval",tokens.recWriter,scope,"BSEC-052 recommendation.write"));
 negatives.push(await denied("/api/v1/recommendations/missing/submit-approval",tokens.recRequest,scope,"BSEC-052 recommendation.approval_request legacy bridge"));
 for(const [path,body,label] of [
  ["/api/v1/approvals/request",{},"BSEC-084"],
  ["/api/v1/approvals/approve",{request_id:"missing"},"BSEC-085"],
  ["/api/control/approval_request/v1/request",{},"BSEC-086"],
  ["/api/control/approval_request/v1/approve",{request_id:"missing"},"BSEC-087"],
  ["/api/v1/approval-requests",{},"BSEC-088"],
  ["/api/v1/approval-requests/missing/approve",{},"BSEC-089"],
  ["/api/v1/prescriptions/missing/submit-approval",scope,"BSEC-129"],
  ["/api/v1/approvals",{},"BSEC-181"],
  ["/api/v1/approvals/missing/decide",{...scope,decision:"APPROVE"},"BSEC-182"]
 ] as any[])negatives.push(await denied(path,tokens.task,body,label));
 await new Promise(r=>setTimeout(r,250));
 const afterDenied=await snapshot();
 expect(JSON.stringify(afterDenied)===JSON.stringify(before),"denied W3 callers changed approval/product state",{before,afterDenied,negatives});

 const positives:any[]=[];
 positives.push(await call("/api/v1/recommendations/missing/submit-approval",tokens.approvalRequest,scope));
 positives.push(await call("/api/v1/approvals/request",tokens.approvalRequest,{}));
 positives.push(await call("/api/v1/approvals/approve",tokens.approvalDecide,{request_id:"missing"}));
 positives.push(await call("/api/control/approval_request/v1/request",tokens.approvalRequest,{}));
 positives.push(await call("/api/control/approval_request/v1/approve",tokens.approvalDecide,{request_id:"missing"}));
 positives.push(await call("/api/v1/approval-requests",tokens.approvalRequest,{}));
 positives.push(await call("/api/v1/approval-requests/missing/approve",tokens.approvalDecide,{}));
 positives.push(await call("/api/v1/prescriptions/missing/submit-approval",tokens.prescriptionSubmit,scope));
 positives.push(await call("/api/v1/approvals",tokens.approvalRequest,{}));
 positives.push(await call("/api/v1/approvals/missing/decide",tokens.approvalDecide,{...scope,decision:"APPROVE"}));
 const canonical=await call("/api/v1/operator/recommendations/missing/request-approval",tokens.recRequest,{...scope,field_id:"field_w3",operator_id:"operator",idempotency_key:"w3-commercial",submission_reason:"proof"});
 expect(canonical.status!==401&&canonical.status!==403,"canonical recommendation.approval_request lost authority",canonical);
 const expected=[404,400,404,400,404,400,404,404,400,404];
 positives.forEach((r,i)=>expect(r.status===expected[i],"approval-specific caller did not cross auth boundary",{index:i,result:r,expected:expected[i]}));
 await new Promise(r=>setTimeout(r,250));
 const after=await snapshot();
 expect(JSON.stringify(after)===JSON.stringify(before),"W3 boundary probes unexpectedly mutated approval/product state",{before,after,positives,canonical});
 console.log(JSON.stringify({result:"PASS",workstream:"W3_DECISION_APPROVAL_AUTHORITY",negative_count:negatives.length,negative_results:negatives.map(x=>({path:x.path,status:x.status,error:x.json?.error})),positive_results:positives.map(x=>({path:x.path,status:x.status,error:x.json?.error})),canonical_recommendation_approval_request:{status:canonical.status,error:canonical.json?.error},state_digest_unchanged:true,before},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>pool.end());
