const fs=require("node:fs"),cp=require("node:child_process");
const BASE="9ffa7d8ea383f759a5dbe23ab919328193a06dd3";
const PREDECESSOR="docs/architecture/semantic_convergence/GEOX-BLINE-PRODUCTION-CALLER-AUTHORITY-INVENTORY-V1.json";
const W4="docs/architecture/semantic_convergence/GEOX-BLINE-W4-EXECUTION-DEVICE-RECEIPT-PROVENANCE-V1.json";
function sh(args){return cp.execFileSync("git",["-c","core.quotepath=false",...args],{encoding:"utf8"}).trim();}
function read(p){return fs.readFileSync(p,"utf8");}
function json(p){return JSON.parse(read(p));}
function assert(c,m,d){if(!c)throw new Error(m+(d===undefined?"":": "+JSON.stringify(d)));}
function block(src,start,end){const s=src.indexOf(start);assert(s>=0,"source marker missing",start);const e=end?src.indexOf(end,s+start.length):src.length;assert(e>s,"source end marker missing",end);return src.slice(s,e);}
const pred=json(PREDECESSOR),w4=json(W4);
assert(w4.version==="GEOX_BLINE_W4_EXECUTION_DEVICE_RECEIPT_PROVENANCE_V1","W4 version drift");
assert(w4.authority_base===BASE,"W4 authority base drift",w4.authority_base);
assert(w4.discovery_policy==="NO_WHOLE_REPOSITORY_DISCOVERY; EXACT_PREDECESSOR_ROWS_ONLY; DIRECT_CAPABILITY_FANOUT_CORRECTION_ONLY","W4 discovery policy drift");
assert(sh(["diff","--name-only",BASE,"HEAD","--",PREDECESSOR])==="","frozen predecessor inventory modified");
const ids=["BSEC-004","BSEC-018","BSEC-019","BSEC-020","BSEC-021","BSEC-050","BSEC-053","BSEC-076","BSEC-077","BSEC-078","BSEC-080","BSEC-102","BSEC-161","BSEC-162","BSEC-163","BSEC-185","BSEC-186","BSEC-187","BSEC-188","BSEC-192"];
assert(w4.bounded_predecessor_row_count===20&&w4.bounded_predecessor_rows?.length===20,"W4 bounded count drift");
assert(JSON.stringify(w4.bounded_predecessor_rows.map(x=>x.surface_id).sort())===JSON.stringify([...ids].sort()),"W4 bounded row set drift");
const predById=new Map((pred.surfaces||[]).map(x=>[x.surface_id,x]));
for(const row of w4.bounded_predecessor_rows){
 const p=predById.get(row.surface_id);assert(p,"missing predecessor row",row.surface_id);
 assert(row.source_path===p.source_path&&row.entry_symbol===p.entry_symbol&&row.exact_route_or_trigger===p.exact_route_or_trigger,"predecessor identity drift",row.surface_id);
 assert(JSON.stringify(row.predecessor_authz_capability)===JSON.stringify(p.authz_capability),"predecessor capability truth drift",row.surface_id);
 assert(row.predecessor_caller_authority_status===p.caller_authority_status,"predecessor status truth drift",row.surface_id);
}
assert(JSON.stringify(w4.capability_fanout_correction?.added_exact_repair_rows?.slice().sort())===JSON.stringify(["BSEC-077","BSEC-078","BSEC-161","BSEC-162","BSEC-163"].sort()),"W4 direct capability fan-out row set drift");
const baselineIds=["BSEC-067","BSEC-068","BSEC-169","BSEC-170"];
assert(JSON.stringify((w4.governed_regression_baselines||[]).map(x=>x.surface_id).sort())===JSON.stringify([...baselineIds].sort()),"W4 governed regression baseline set drift");
for(const id of baselineIds){
 const p=predById.get(id);assert(p,"missing governed baseline predecessor row",id);
 assert(sh(["diff","--name-only",BASE,"HEAD","--",p.source_path])==="","W4 regression baseline production source changed",id);
}
const roles=read("apps/server/src/domain/auth/roles.ts");
const executorRow=roles.split(/\r?\n/).find(x=>x.includes('executor: ['));
assert(executorRow?.includes('"action.task.dispatch"'),"executor role lacks existing dispatch capability",executorRow);
assert(!executorRow?.includes('"ao_act.task.write"'),"executor role gained generic task-write authority",executorRow);
const fixture=json("config/auth/security_acceptance_tokens.json");
const executorToken=(fixture.tokens||[]).find(x=>x.token==="executor_token");
assert(executorToken?.role==="executor"&&executorToken?.actor_id==="tok_executor_actor"&&executorToken?.revoked===false,"dedicated executor fixture identity drift",executorToken);
for(const scope of ["action.task.dispatch","action.receipt.submit","ao_act.receipt.write"])assert(executorToken.scopes?.includes(scope),"executor fixture missing required capability",scope);
assert(!executorToken.scopes?.includes("security.admin")&&!executorToken.scopes?.includes("ao_act.task.write"),"executor fixture gained admin/generic task-write authority",executorToken.scopes);
const operatorToken=(fixture.tokens||[]).find(x=>x.token==="operator_token");
assert(operatorToken?.role==="operator"&&operatorToken?.scopes?.includes("telemetry.write"),"AO-SENSE lacks existing authenticated telemetry.write operator credential",operatorToken);
const ci=read(".github/workflows/ci.yml");
assert(ci.includes("x.token==='executor_token' && x.role==='executor'"),"CI still masks executor with non-executor credential");
assert(!ci.includes("x.token==='tenant_a_admin_token' && x.scopes.includes('ao_act.task.write') && x.scopes.includes('ao_act.receipt.write')"),"CI retains admin executor masking");
assert(ci.includes("mapfile -t EXECUTOR_IDENTITY")&&ci.includes("[\'token\',\'actor_id\']"),"CI executor token/actor identity extraction missing");
assert(ci.includes("GEOX_EXECUTOR_ID=${EXECUTOR_IDENTITY[1]}")&&ci.includes("GEOX_EXECUTOR_ACTOR_ID=${EXECUTOR_IDENTITY[1]}"),"CI executor actor binding is not derived from authenticated executor fixture");
const compose=read("docker-compose.commercial_v1.yml");
assert(compose.includes("GEOX_AO_ACT_TOKEN:")&&compose.includes("GEOX_EXECUTOR_TOKEN is required"),"Commercial executor token wiring drift");
assert(compose.includes("GEOX_EXECUTOR_ID:"),"Commercial executor identity wiring missing");
const runtime=read("apps/executor/src/runtime_loop.ts");
assert(runtime.includes('throw new Error("GEOX_EXECUTOR_ID_REQUIRED")'),"executor runtime does not fail closed on missing identity");
assert(runtime.includes("safeRecordExecutorHeartbeat"),"executor worker heartbeat removed");
assert(!runtime.includes("heartbeatOnce(")&&!runtime.includes("/api/v1/devices/"),"executor service still masquerades as device heartbeat");
const deviceAuth=read("apps/server/src/auth/device_credential_auth_v1.ts");
for(const marker of ["device_credential_index_v1","device_index_v1","device_binding_index_v1","field_index_v1","c.status='ACTIVE'","c.revoked_ts_ms IS NULL","credential_hash"])assert(deviceAuth.includes(marker),"device credential boundary missing marker",marker);
const heartbeat=read("apps/server/src/routes/device_heartbeat_v1.ts");
assert(heartbeat.includes("requireDeviceCredentialAuthV1"),"heartbeat lacks device credential boundary");
assert(!heartbeat.includes('?? "tenantA"')&&!heartbeat.includes("pickTenantId("),"heartbeat retains caller/default scope authority");
const sensing=read("apps/server/src/routes/sensing_fact_envelope_v1.ts");
assert(sensing.includes("isFormalRawSampleSourceV1(source)")&&sensing.includes("requireDeviceCredentialAuthV1"),"formal HTTP sensing lacks device credential boundary");
assert(sensing.includes('requireAoActScopeV0(req, reply, "telemetry.write")'),"non-device service sensing lost telemetry.write boundary");
assert(sensing.includes("DEVICE_CREDENTIAL_ID_MISMATCH"),"HTTP sensing credential identity check missing");
assert(sensing.includes("await ensureDeviceObservationProjectionV1(pool as any);"),"BSEC-102 declared observation writer is not routed through guarded Pool preprovision check");
assert(!sensing.includes("ensureDeviceObservationProjectionV1(client)"),"BSEC-102 observation projection DDL bypasses runtime Pool guard via PoolClient");
assert(!/CREATE\s+(TABLE|INDEX)|ALTER\s+TABLE/i.test(sensing),"active HTTP sensing route contains inline runtime DDL");
const dbInfra=read("apps/server/src/infra/database.ts");
for(const marker of ["assertRuntimeCompatibilityDdlPreprovisionedV1","CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS","CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+IF\\s+NOT\\s+EXISTS","RUNTIME_SCHEMA_PREFLIGHT"])assert(dbInfra.includes(marker),"existing runtime schema preprovision guard drift",marker);
const aoSense=read("apps/server/src/routes/control_ao_sense.ts");
assert((aoSense.match(/requireAoActScopeV0\(req, reply, "telemetry\.write"\)/g)||[]).length===4,"AO-SENSE predecessor POST auth count drift");
for(const marker of ["authority: { tenant_id: auth.tenant_id","SENSE_TASK_NOT_FOUND","does_not_imply_ao_act_execution_success","does_not_imply_acceptance_pass"])assert(aoSense.includes(marker),"AO-SENSE authority/semantic boundary drift",marker);
const task=read("apps/server/src/domain/controlplane/task_service.ts");
for(const spec of [
 ['app.post("/api/v1/ao-act/dispatches/claim"','app.post("/api/v1/ao-act/dispatches/state"'],
 ['app.post("/api/v1/ao-act/dispatches/state"','app.get("/api/v1/ao-act/dispatches"'],
 ['app.post("/api/v1/ao-act/downlinks/published"','app.get("/api/v1/ao-act/downlinks"']
]){
 const b=block(task,spec[0],spec[1]);
 assert(b.includes('requireAoActScopeV0(req, reply, "action.task.dispatch")'),"executor dispatch route lacks existing dispatch capability",spec[0]);
 assert(b.includes("requireExecutorServicePrincipalV1"),"executor dispatch route lacks exact executor role",spec[0]);
 assert(!b.includes('"ao_act.task.write"'),"executor dispatch route retains generic task-write",spec[0]);
}
const uplink=block(task,'app.post("/api/v1/ao-act/receipts/uplink"','app.get("/api/v1/operations/plans"');
assert(uplink.includes("requireReceiptPrincipalV1(auth, reply, true)")&&uplink.includes("executor_id: executionPrincipal")&&uplink.includes("source_receipt_fact_id"),"uplink receipt provenance incomplete");
const wrapper=block(task,'app.post("/api/v1/ao-act/receipts"','app.get("/api/v1/ao-act/receipts"');
assert(wrapper.includes("requireReceiptPrincipalV1(auth, reply)")&&wrapper.includes("executor_id: executionPrincipal")&&wrapper.includes("source_receipt_fact_id"),"Commercial receipt wrapper provenance incomplete");
assert(wrapper.includes("createAcceptance")&&wrapper.includes("transitionOperationPlanStateV1"),"W4 changed receipt/Acceptance semantic chain");
assert(wrapper.includes("if (!requireTenantFieldsPresentOr400(tenant, reply)) return reply;"),"BSEC-192 missing tenant-fields reply ownership");
assert(wrapper.includes("if (!requireTenantMatchOr404(auth, tenant, reply)) return reply;"),"BSEC-192 missing tenant-match reply ownership");
const aoAct=read("apps/server/src/routes/control_ao_act.ts");
const dispatchHumanGate=block(aoAct,"function requireActionDispatchHumanRoleV1","function requireActionReceiptSubmitRoleV1");
assert(dispatchHumanGate.includes('role === "admin" || role === "operator"')&&dispatchHumanGate.includes("ACTION_DISPATCH_HUMAN_ROLE_DENIED"),"W4 BSEC-077/078 human dispatch principal gate drift");
for(const spec of [
 ['app.post("/api/v1/actions/execute"','// POST /api/v1/operations/manual'],
 ['app.post("/api/v1/operations/manual"','// 兼容层仅用于存量迁移']
]){
 const b=block(aoAct,spec[0],spec[1]);
 assert(b.includes("requireActionDispatchHumanRoleV1(reply, auth)"),"W4 fan-out route lacks admin/operator-only gate",spec[0]);
}
const failSafe=read("apps/server/src/routes/fail_safe_v1.ts");
assert(failSafe.includes("requireManualInterventionHumanRoleV1")&&failSafe.includes("MANUAL_INTERVENTION_ROLE_DENIED"),"W4 fail-safe human principal gate missing");
for(const route of ["/api/v1/manual-takeovers/:takeover_id/ack","/api/v1/manual-takeovers/:takeover_id/complete","/api/v1/fail-safe/events/:fail_safe_event_id/resolve"]){
 const marker="app.post('"+route+"'";
 const start=failSafe.indexOf(marker);assert(start>=0,"fail-safe fan-out route missing",route);
 const slice=failSafe.slice(start,start+900);
 assert(slice.includes("requireManualInterventionHumanRoleV1(reply,auth)"),"fail-safe fan-out route lacks executor deny",route);
}
const operatorDispatch=read("apps/server/src/routes/v1/operator_dispatch_actions.ts");
const roleAllows=block(operatorDispatch,"function roleAllowsDispatch","function normalizeStatus");
assert(roleAllows.includes('normalized === "admin" || normalized === "operator"')&&!roleAllows.includes("executor"),"BSEC-067/068 Operator Dispatch baseline leaked executor authority");
const roleGate=block(aoAct,"function requireActionReceiptSubmitRoleV1","function canonicalActionReceiptExecutorV1");
assert(roleGate.includes('role === "operator" || role === "executor"')&&!roleGate.includes('role === "admin"'),"direct receipt retains admin execution authority");
const receiptHandler=block(aoAct,"async function handleAoActReceiptV1","async function handleAoActIndexV1");
assert(receiptHandler.includes("if (!auth) return reply;"),"BSEC-076/080 missing auth reply ownership");
assert(receiptHandler.includes("if (!requireActionReceiptSubmitRoleV1(reply, auth)) return reply;"),"BSEC-076/080 role-deny reply ownership drift");
assert(aoAct.includes("EXECUTOR_IDENTITY_MISMATCH")&&aoAct.includes("executor_id: executorIdentity"),"direct receipt caller-declared executor still authoritative");
const decision=read("apps/server/src/routes/decision_engine_v1.ts");
const receiptFromTask=block(decision,'app.post("/api/v1/actions/receipt/from-task"','app.post("/api/v1/recommendations/generate"');
assert(receiptFromTask.includes('["executor", "operator"]')&&!receiptFromTask.includes('"admin"'),"receipt-from-task retains admin authority");
assert(receiptFromTask.includes("executionPrincipal")&&receiptFromTask.includes("EXECUTOR_IDENTITY_MISMATCH"),"receipt-from-task caller executor remains authoritative");
const simulator=block(decision,'app.post("/api/v1/simulators/irrigation/execute"','async function applyFieldMemoryAdjustmentsToRecommendations');
assert(simulator.includes("hasExecutorRuntimeScopes(auth)")&&simulator.includes("isExecutorToken(auth)")&&simulator.includes("canonicalDecisionReceiptExecutorV1(auth)"),"simulator executor authority drift");
const allowed=new Set([
 ".github/workflows/bline-w4-execution-device-receipt-provenance.yml",".github/workflows/ci.yml",
 "docker-compose.commercial_v1.yml","config/auth/security_acceptance_tokens.json","apps/executor/src/runtime_loop.ts",
 "apps/server/src/domain/auth/roles.ts","apps/server/src/auth/device_credential_auth_v1.ts","apps/server/src/routes/device_heartbeat_v1.ts","apps/server/src/routes/sensing_fact_envelope_v1.ts","apps/server/src/routes/control_ao_sense.ts","apps/server/src/domain/controlplane/task_service.ts","apps/server/src/routes/control_ao_act.ts","apps/server/src/routes/decision_engine_v1.ts","apps/server/src/routes/fail_safe_v1.ts",
 W4,"scripts/governance_acceptance/ACCEPTANCE_BLINE_W4_EXECUTION_DEVICE_RECEIPT_PROVENANCE_V1.cjs","scripts/runtime_acceptance/ACCEPTANCE_BLINE_W4_EXECUTION_DEVICE_RECEIPT_PROVENANCE_V1.ts","scripts/runtime_acceptance/ACCEPTANCE_BLINE_W4_COMMERCIAL_EXECUTION_DEVICE_RECEIPT_PROVENANCE_V1.ts",
 "scripts/governance_acceptance/ACCEPTANCE_BLINE_W1_IDENTITY_FOUNDATION_V1.cjs","scripts/governance_acceptance/ACCEPTANCE_BLINE_W2_CALLER_READ_WRITE_BOUNDARY_V1.cjs","scripts/governance_acceptance/ACCEPTANCE_BLINE_W3_DECISION_APPROVAL_AUTHORITY_V1.cjs",
 "scripts/agronomy_acceptance/ACCEPTANCE_FORMAL_IRRIGATION_E2E_V1.ts","scripts/agronomy_acceptance/ACCEPTANCE_FORMAL_VARIABLE_OPERATION_E2E_V1.cjs","scripts/agronomy_acceptance/ACCEPTANCE_FORMAL_FERTILIZATION_E2E_V1.cjs","scripts/agronomy_acceptance/ACCEPTANCE_DEVICE_ANOMALY_E2E_V1.cjs","scripts/agronomy_acceptance/ACCEPTANCE_SKILL_CONTRACT_GAP_CLOSURE_V1.cjs","scripts/agronomy_acceptance/ACCEPTANCE_PILOT_CLOSURE_V1.cjs","apps/server/scripts/p1_smoke_device_ready.mjs","scripts/governance_acceptance/ACCEPTANCE_P1_SMOKE_PREFLIGHT_IDEMPOTENT_V1.cjs"
]);
const commercialProof=read("scripts/runtime_acceptance/ACCEPTANCE_BLINE_W4_COMMERCIAL_EXECUTION_DEVICE_RECEIPT_PROVENANCE_V1.ts");
for(const marker of ["GEOX_W4_OPERATOR_RECEIPT_TOKEN","w4_operator_receipt_token","dedicated executor failed BSEC-192 receipt authority boundary","acceptance-only operator receipt principal failed BSEC-192 authority boundary","GEOX_W4_READ_ONLY_TOKEN"])assert(commercialProof.includes(marker),"W4 BSEC-192 Commercial caller-migration proof drift",marker);
const fertProof=read("scripts/agronomy_acceptance/ACCEPTANCE_FORMAL_FERTILIZATION_E2E_V1.cjs");
for(const marker of ["GEOX_EXECUTOR_ACTOR_ID","executorActorId","EXECUTOR_IDENTITY_MISMATCH","caller-declared mismatched executor identity must be denied","canonical AO-ACT receipt"])assert(fertProof.includes(marker),"Formal Fertilization executor-principal migration drift",marker);
assert(!/executor_id:\s*\{\s*kind:\s*\'script\',\s*id:\s*\'formal_fertilization_e2e\'/.test(fertProof),"Formal Fertilization retains stale caller-declared executor identity");
const p1Smoke=read("apps/server/scripts/p1_smoke_device_ready.mjs");
for(const marker of ["GEOX_DEVICE_CREDENTIAL_SECRET_REQUIRED","GEOX_DEVICE_CREDENTIAL_SECRET"])assert(p1Smoke.includes(marker),"P1 smoke device-secret caller migration drift",marker);
const p1Preflight=read("scripts/governance_acceptance/ACCEPTANCE_P1_SMOKE_PREFLIGHT_IDEMPOTENT_V1.cjs");
for(const marker of ["provisionDeviceIdentityFixture","field_index_v1","device_index_v1","device_binding_index_v1","device_credential_index_v1","GEOX_DEVICE_CREDENTIAL_SECRET"])assert(p1Preflight.includes(marker),"P1 preflight exact device identity fixture drift",marker);
const mainCi=read(".github/workflows/ci.yml");
assert(mainCi.includes("Run P1 smoke preflight idempotency gate")&&mainCi.includes("export DATABASE_URL=")&&mainCi.includes("postgres://"),"P1 preflight database fixture wiring missing");
const changed=sh(["diff","--name-only",BASE,"HEAD"]).split(/\r?\n/).filter(Boolean);
for(const p of changed)assert(allowed.has(p),"W4 scope expansion",p);
for(const p of changed)assert(!/mcft/i.test(p),"W4 touched MCFT",p);
for(const p of changed)assert(!/(planner|crop.*latest|monitoring|action_qualification)/i.test(p),"W4 forbidden workstream path changed",p);
for(const p of ["apps/server/src/routes/control_approval_request_v1.ts","apps/server/src/routes/prescriptions_v1.ts","apps/server/src/routes/v1/operator_approval_actions.ts"])assert(!changed.includes(p),"W4 reopened W3 Approval authority",p);
console.log(JSON.stringify({result:"PASS",workstream:"W4_EXECUTION_DEVICE_RECEIPT_PROVENANCE",authority_base:BASE,bounded_predecessor_row_count:20,capability_fanout_rows:["BSEC-077","BSEC-078","BSEC-161","BSEC-162","BSEC-163"],governed_regression_baselines:["BSEC-067","BSEC-068","BSEC-169","BSEC-170"],repairs:{dedicated_executor_principal:true,caller_declared_executor_removed:true,device_heartbeat_credential_bound:true,http_device_sensing_credential_bound:true,ao_sense_runtime_authority_bound:true,receipt_provenance_auth_derived:true,executor_dispatch_capability_fanout_closed:true,acceptance_semantics_unchanged:true},changed_files:changed,mcft_delta:0},null,2));
