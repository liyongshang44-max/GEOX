import Fastify from "fastify";
import { registerDecisionEngineV1Routes } from "../../apps/server/src/routes/decision_engine_v1.js";
import { registerControlApprovalRequestV1Routes } from "../../apps/server/src/routes/control_approval_request_v1.js";
import { registerPrescriptionsV1Routes } from "../../apps/server/src/routes/prescriptions_v1.js";
import { registerControlPlaneV1Routes } from "../../apps/server/src/domain/controlplane/task_service.js";

const saved=new Map<string,string|undefined>();
for(const k of ["GEOX_RUNTIME_ENV","GEOX_TOKENS_JSON","GEOX_TOKENS_FILE","GEOX_TOKEN_SSOT_PATH","GEOX_TOKEN","GEOX_AO_ACT_TOKEN","AO_ACT_TOKEN"])saved.set(k,process.env[k]);
function restore(){for(const [k,v] of saved){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
function expect(c:any,m:string,d?:any){if(!c)throw new Error(m+(d===undefined?"":": "+JSON.stringify(d)));}
const tokenFile:any={version:"ao_act_tokens_v0",tokens:[
 {token:"w3_task_only",token_id:"tok_task",actor_id:"task",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",role:"admin",scopes:["ao_act.task.write"],revoked:false},
 {token:"w3_rec_writer",token_id:"tok_rec_writer",actor_id:"rec_writer",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",role:"agronomist",scopes:["recommendation.write"],revoked:false},
 {token:"w3_rec_request",token_id:"tok_rec_request",actor_id:"operator",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",role:"operator",scopes:["recommendation.approval_request"],revoked:false},
 {token:"w3_approval_request",token_id:"tok_approval_request",actor_id:"requester",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",role:"admin",scopes:["approval.request"],revoked:false},
 {token:"w3_prescription_submit",token_id:"tok_prescription_submit",actor_id:"prescriber",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",role:"admin",scopes:["prescription.submit_approval"],revoked:false},
 {token:"w3_approval_decide",token_id:"tok_approval_decide",actor_id:"approver",tenant_id:"tenantA",project_id:"projectA",group_id:"groupA",role:"admin",scopes:["approval.decide"],revoked:false}
]};
function bearer(t:string){return {authorization:`Bearer ${t}`,"content-type":"application/json"};}
class StubPool{
 queryCalls=0;connectCalls=0;
 async query(_sql:any,_params?:any[]){this.queryCalls++;return {rowCount:0,rows:[]};}
 async connect(){this.connectCalls++;const self=this;return {query:async(_sql:any,_params?:any[])=>{self.queryCalls++;return {rowCount:0,rows:[]};},release:()=>{}};}
}
async function call(app:any,token:string,url:string,payload:any={}){
 const res=await app.inject({method:"POST",url,headers:bearer(token),payload});
 let body:any=null;try{body=res.json();}catch{}
 return {status:res.statusCode,body};
}
async function deniedNoDb(app:any,pool:StubPool,token:string,url:string,payload:any,label:string){
 const q=pool.queryCalls,c=pool.connectCalls;
 const r=await call(app,token,url,payload);
 expect(r.status===403&&r.body?.error==="AUTH_SCOPE_DENIED",label+" not denied",r);
 expect(pool.queryCalls===q&&pool.connectCalls===c,label+" reached DB on denied auth",{before:{q,c},after:{q:pool.queryCalls,c:pool.connectCalls}});
 return r;
}
async function main(){
 process.env.GEOX_RUNTIME_ENV="test";
 process.env.GEOX_TOKENS_JSON=JSON.stringify(tokenFile);
 delete process.env.GEOX_TOKENS_FILE;delete process.env.GEOX_TOKEN_SSOT_PATH;delete process.env.GEOX_TOKEN;delete process.env.GEOX_AO_ACT_TOKEN;delete process.env.AO_ACT_TOKEN;
 const scope={tenant_id:"tenantA",project_id:"projectA",group_id:"groupA"};

 const decisionPool=new StubPool(),decisionApp=Fastify({logger:false});
 registerDecisionEngineV1Routes(decisionApp,decisionPool as any);await decisionApp.ready();
 await deniedNoDb(decisionApp,decisionPool,"w3_rec_writer","/api/v1/recommendations/missing/submit-approval",scope,"BSEC-052 recommendation.write");
 await deniedNoDb(decisionApp,decisionPool,"w3_rec_request","/api/v1/recommendations/missing/submit-approval",scope,"BSEC-052 recommendation.approval_request legacy bridge");
 const decisionAllowed=await call(decisionApp,"w3_approval_request","/api/v1/recommendations/missing/submit-approval",scope);
 expect(decisionAllowed.status===404,"BSEC-052 approval.request did not cross auth boundary",decisionAllowed);
 await decisionApp.close();

 const approvalPool=new StubPool(),approvalApp=Fastify({logger:false});
 registerControlApprovalRequestV1Routes(approvalApp,approvalPool as any);await approvalApp.ready();
 for(const [url,payload,label] of [
  ["/api/v1/approvals/request",{},"BSEC-084"],
  ["/api/control/approval_request/v1/request",{},"BSEC-086"],
  ["/api/v1/approval-requests",{},"BSEC-088"]
 ] as any[])await deniedNoDb(approvalApp,approvalPool,"w3_task_only",url,payload,label);
 const reqOk=await call(approvalApp,"w3_approval_request","/api/v1/approvals/request",{});
 expect(reqOk.status===400,"BSEC-084 approval.request did not cross auth boundary",reqOk);
 const legacyReqOk=await call(approvalApp,"w3_approval_request","/api/control/approval_request/v1/request",{});
 expect(legacyReqOk.status===400,"BSEC-086 approval.request did not cross auth boundary",legacyReqOk);
 const aliasReqOk=await call(approvalApp,"w3_approval_request","/api/v1/approval-requests",{});
 expect(aliasReqOk.status===400,"BSEC-088 approval.request did not cross auth boundary",aliasReqOk);

 for(const [url,payload,label] of [
  ["/api/v1/approvals/approve",{request_id:"missing"},"BSEC-085"],
  ["/api/control/approval_request/v1/approve",{request_id:"missing"},"BSEC-087"],
  ["/api/v1/approval-requests/missing/approve",{},"BSEC-089"]
 ] as any[])await deniedNoDb(approvalApp,approvalPool,"w3_task_only",url,payload,label);
 const decideOk=await call(approvalApp,"w3_approval_decide","/api/v1/approvals/approve",{request_id:"missing"});
 expect(decideOk.status===404,"BSEC-085 approval.decide did not cross auth boundary",decideOk);
 const legacyDecideOk=await call(approvalApp,"w3_approval_decide","/api/control/approval_request/v1/approve",{request_id:"missing"});
 expect(legacyDecideOk.status===404,"BSEC-087 approval.decide did not cross auth boundary",legacyDecideOk);
 const aliasDecideOk=await call(approvalApp,"w3_approval_decide","/api/v1/approval-requests/missing/approve",{});
 expect(aliasDecideOk.status===404,"BSEC-089 approval.decide did not cross auth boundary",aliasDecideOk);
 const canonicalReq=await call(approvalApp,"w3_rec_request","/api/v1/operator/recommendations/missing/request-approval",{...scope,field_id:"field_w3",operator_id:"operator",idempotency_key:"w3",submission_reason:"proof"});
 expect(canonicalReq.status!==401&&canonicalReq.status!==403,"canonical recommendation.approval_request baseline lost authority",canonicalReq);
 await approvalApp.close();

 const presPool=new StubPool(),presApp=Fastify({logger:false});
 registerPrescriptionsV1Routes(presApp,presPool as any);await presApp.ready();
 await deniedNoDb(presApp,presPool,"w3_task_only","/api/v1/prescriptions/missing/submit-approval",scope,"BSEC-129 ao_act.task.write");
 const presOk=await call(presApp,"w3_prescription_submit","/api/v1/prescriptions/missing/submit-approval",scope);
 expect(presOk.status===404,"BSEC-129 prescription.submit_approval did not cross auth boundary",presOk);
 await presApp.close();

 const taskPool=new StubPool(),taskApp=Fastify({logger:false});
 registerControlPlaneV1Routes(taskApp,taskPool as any);await taskApp.ready();
 await deniedNoDb(taskApp,taskPool,"w3_task_only","/api/v1/approvals",{},"BSEC-181 ao_act.task.write");
 const createOk=await call(taskApp,"w3_approval_request","/api/v1/approvals",{});
 expect(createOk.status===400,"BSEC-181 approval.request did not cross auth boundary",createOk);
 await deniedNoDb(taskApp,taskPool,"w3_task_only","/api/v1/approvals/missing/decide",{...scope,decision:"APPROVE"},"BSEC-182 ao_act.task.write");
 const taskDecideOk=await call(taskApp,"w3_approval_decide","/api/v1/approvals/missing/decide",{...scope,decision:"APPROVE"});
 expect(taskDecideOk.status===404,"BSEC-182 approval.decide did not cross auth boundary",taskDecideOk);
 await taskApp.close();

 console.log(JSON.stringify({result:"PASS",workstream:"W3_DECISION_APPROVAL_AUTHORITY",negative:{recommendation_write_denied:true,recommendation_approval_request_denied_on_legacy_bridge:true,generic_task_write_denied_on_approval_request:true,generic_task_write_denied_on_approval_decide:true,prescription_task_write_denied:true},positive:{legacy_recommendation_bridge_approval_request:decisionAllowed.status,prescription_submit_approval:presOk.status,approval_request:reqOk.status,approval_decide:decideOk.status,commercial_wrapper_request:createOk.status,commercial_wrapper_decide:taskDecideOk.status,canonical_recommendation_request:canonicalReq.status},denied_db_delta:0},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(restore);
