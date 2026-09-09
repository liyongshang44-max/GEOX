const fs=require("node:fs"),cp=require("node:child_process");
const BASE="89e7ea6e5b322ae7745c04db3ad4ab584aecb6c2";
const W3_ACCEPTED_HEAD="9ffa7d8ea383f759a5dbe23ab919328193a06dd3";
const PREDECESSOR="docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json";
const W3="docs/architecture/semantic_convergence/GEOX-BLINE-W3-DECISION-APPROVAL-AUTHORITY-V1.json";
function sh(args){return cp.execFileSync("git",["-c","core.quotepath=false",...args],{encoding:"utf8"}).trim();}
function read(p){return fs.readFileSync(p,"utf8");}
function json(p){return JSON.parse(read(p));}
function assert(c,m,d){if(!c)throw new Error(m+(d===undefined?"":": "+JSON.stringify(d)));}
function extract(src,startNeedle,endNeedle){const s=src.indexOf(startNeedle);assert(s>=0,"source marker missing",startNeedle);const e=endNeedle?src.indexOf(endNeedle,s+startNeedle.length):src.length;assert(e>s,"source end marker missing",endNeedle);return src.slice(s,e);}
const pred=json(PREDECESSOR),w3=json(W3);
assert(w3.version==="GEOX_BLINE_W3_DECISION_APPROVAL_AUTHORITY_V1","W3 version drift");
assert(w3.authority_base===BASE,"W3 authority base drift",w3.authority_base);
assert(w3.discovery_policy==="NO_WHOLE_REPOSITORY_DISCOVERY; EXACT_PREDECESSOR_ROWS_ONLY","W3 discovery policy drift");
assert(sh(["diff","--name-only",BASE,"HEAD","--",PREDECESSOR])==="","frozen predecessor inventory modified");
const head=sh(["rev-parse","HEAD"]);
if(head===W3_ACCEPTED_HEAD){
  for(const p of ["apps/server/src/domain/auth/roles.ts","config/auth/security_acceptance_tokens.json","config/auth/ao_act_tokens_v0.json","apps/server/src/routes/v1/operator_approval_actions.ts"]){
    assert(sh(["diff","--name-only",BASE,"HEAD","--",p])==="","W3 protected authority source drift",p);
  }
} else {
  assert(sh(["diff","--name-only",W3_ACCEPTED_HEAD,"HEAD","--",W3])==="","closed W3 bounded inventory drift in successor workstream",W3);
  assert(sh(["diff","--name-only",W3_ACCEPTED_HEAD,"HEAD","--","apps/server/src/routes/v1/operator_approval_actions.ts"])==="","closed W3 canonical approval action route drift");
}
const targetIds=["BSEC-052","BSEC-084","BSEC-085","BSEC-086","BSEC-087","BSEC-088","BSEC-089","BSEC-129","BSEC-181","BSEC-182"];
assert(w3.bounded_predecessor_row_count===10&&Array.isArray(w3.bounded_predecessor_rows)&&w3.bounded_predecessor_rows.length===10,"W3 bounded row count drift");
assert(JSON.stringify(w3.bounded_predecessor_rows.map(x=>x.surface_id).sort())===JSON.stringify([...targetIds].sort()),"W3 bounded predecessor set drift");
const predById=new Map((pred.surfaces||[]).map(x=>[x.surface_id,x]));
for(const row of w3.bounded_predecessor_rows){
  const p=predById.get(row.surface_id);assert(p,"W3 predecessor row missing",row.surface_id);
  assert(row.source_path===p.source_path&&row.entry_symbol===p.entry_symbol&&row.exact_route_or_trigger===p.exact_route_or_trigger,"W3 predecessor identity drift",row.surface_id);
  assert(JSON.stringify(row.predecessor_authz_capability)===JSON.stringify(p.authz_capability),"W3 predecessor capability truth drift",row.surface_id);
}
assert(w3.commercial_sku_01?.disposition==="IN_SCOPE_AND_REQUIRED; NARROW_AUTHORITY_DO_NOT_DISABLE","prescription approval SKU disposition drift");
const decision=read("apps/server/src/routes/decision_engine_v1.ts");
const legacyRecommendation=extract(decision,'app.post("/api/v1/recommendations/:recommendation_id/submit-approval"','app.post("/api/v1/simulators/irrigation/execute"');
assert(legacyRecommendation.includes('requireAoActScopeV0(req, reply, "approval.request")'),"BSEC-052 lacks approval.request authority");
assert(legacyRecommendation.includes("if (!auth) return reply;"),"BSEC-052 denied auth reply ownership drift");
assert(!legacyRecommendation.includes('"recommendation.write"')&&!legacyRecommendation.includes('"ao_act.task.write"'),"BSEC-052 retains non-approval authority");
const approval=read("apps/server/src/routes/control_approval_request_v1.ts");
const requestHandler=extract(approval,"async function handleApprovalRequest","async function handleApprovalRequestsList");
assert(requestHandler.includes('["approval.request", "prescription.submit_approval"]'),"shared approval request handler authority drift");
assert(!requestHandler.includes('"ao_act.task.write"'),"shared approval request retains generic task-write fallback");
const decideHandler=extract(approval,"async function handleApprovalApprove","async function handleCreateOperationPlanFromApprovalDecision");
assert(decideHandler.includes('requireAoActScopeV0(req, reply, "approval.decide")'),"shared approval decision handler lacks approval.decide");
assert(!decideHandler.includes('"ao_act.task.write"'),"shared approval decision retains generic task-write fallback");
const canonicalRequest=extract(approval,"async function handleRecommendationApprovalRequest","async function handleApprovalRequest");
assert(canonicalRequest.includes('["approval.request", "recommendation.approval_request"]'),"canonical recommendation approval request authority drift");
const canonicalDecision=extract(approval,"async function handleRecommendationApprovalDecision","async function handleRecommendationApprovalRequest");
assert(canonicalDecision.includes('requireAoActScopeV0(req, reply, "approval.decide")'),"canonical operator approval decision authority drift");
const pres=read("apps/server/src/routes/prescriptions_v1.ts");
const presSubmit=extract(pres,'app.post("/api/v1/prescriptions/:prescription_id/submit-approval"',null);
assert(presSubmit.includes('["prescription.submit_approval", "approval.request"]'),"BSEC-129 approval-specific authority drift");
assert(!presSubmit.includes('"ao_act.task.write"'),"BSEC-129 retains generic task-write fallback");
assert(presSubmit.includes("APPROVAL_DECISION_NOT_ALLOWED_ON_SUBMIT"),"prescription request/decision separation drift");
const task=read("apps/server/src/domain/controlplane/task_service.ts");
const approvalCreate=extract(task,'app.post("/api/v1/approvals",','app.get("/api/v1/approvals",');
assert(approvalCreate.includes('requireAoActScopeV0(req, reply, "approval.request")'),"BSEC-181 lacks approval.request");
assert(!approvalCreate.includes('"ao_act.task.write"'),"BSEC-181 retains generic task-write authority");
for(const marker of [
 'if (!requireAoActAdminV0(req, reply, { deniedError: "ROLE_APPROVAL_ADMIN_REQUIRED" })) return reply;',
 'if (!requireTenantFieldsPresentOr400(tenant, reply)) return reply;',
 'if (!requireTenantMatchOr404(auth, tenant, reply)) return reply;'
]) assert(approvalCreate.includes(marker),"BSEC-181 reply ownership drift",marker);
const approvalDecide=extract(task,'app.post("/api/v1/approvals/:request_id/decide"','app.post("/api/v1/ao-act/tasks"');
assert(approvalDecide.includes('requireAoActScopeV0(req, reply, "approval.decide")'),"BSEC-182 lacks approval.decide");
assert(!approvalDecide.slice(0,600).includes('"ao_act.task.write"'),"BSEC-182 auth retains generic task-write authority");
for(const marker of [
 'if (!requireAoActAdminV0(req, reply, { deniedError: "ROLE_APPROVAL_ADMIN_REQUIRED" })) return reply;',
 'if (!requireTenantFieldsPresentOr400(tenant, reply)) return reply;',
 'if (!requireTenantMatchOr404(auth, tenant, reply)) return reply;'
]) assert(approvalDecide.includes(marker),"BSEC-182 reply ownership drift",marker);
const allowed=new Set([
 ".github/workflows/bline-w3-decision-approval-authority.yml",".github/workflows/ci.yml",W3,
 "apps/server/src/routes/decision_engine_v1.ts","apps/server/src/routes/control_approval_request_v1.ts","apps/server/src/routes/prescriptions_v1.ts","apps/server/src/domain/controlplane/task_service.ts",
 "scripts/governance_acceptance/ACCEPTANCE_BLINE_W3_DECISION_APPROVAL_AUTHORITY_V1.cjs",
 "scripts/runtime_acceptance/ACCEPTANCE_BLINE_W3_DECISION_APPROVAL_AUTHORITY_V1.ts",
 "scripts/runtime_acceptance/ACCEPTANCE_BLINE_W3_COMMERCIAL_DECISION_APPROVAL_AUTHORITY_V1.ts",
 "scripts/governance_acceptance/ACCEPTANCE_BLINE_W2_CALLER_READ_WRITE_BOUNDARY_V1.cjs"
]);
const changed=sh(["diff","--name-only",BASE,"HEAD"]).split(/\r?\n/).filter(Boolean);
if(head===W3_ACCEPTED_HEAD){
  for(const p of changed)assert(allowed.has(p),"W3 scope expansion",p);
  for(const p of changed)assert(!/mcft/i.test(p),"W3 touched MCFT",p);
  for(const p of changed)assert(!/(executor|device_status|planner|crop.*latest|action_qualification|monitoring)/i.test(p),"W3 forbidden workstream path changed",p);
}
console.log(JSON.stringify({result:"PASS",workstream:"W3_DECISION_APPROVAL_AUTHORITY",authority_base:BASE,accepted_head:W3_ACCEPTED_HEAD,qualification_mode:head===W3_ACCEPTED_HEAD?"EXACT_W3_SCOPE":"SUCCESSOR_PRESERVATION",bounded_predecessor_row_count:10,repairs:{recommendation_legacy_bridge:"approval.request",approval_request_fallback_removed:true,approval_decide_fallback_removed:true,prescription_submit_approval_kept_for_commercial_sku_01:true,decision_approval_separation:true},changed_files:changed,mcft_delta:head===W3_ACCEPTED_HEAD?0:null},null,2));
