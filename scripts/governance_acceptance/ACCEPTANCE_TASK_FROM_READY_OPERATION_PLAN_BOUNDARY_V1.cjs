// scripts/governance_acceptance/ACCEPTANCE_TASK_FROM_READY_OPERATION_PLAN_BOUNDARY_V1.cjs
const fs = require('fs');
function assert(x,m){ if(!x){ console.error('[task-from-ready-operation-plan-boundary] FAIL',m); process.exit(1);} }
const route = fs.readFileSync('apps/server/src/routes/control_ao_act.ts','utf8');
const gate = fs.readFileSync('apps/server/src/routes/v1/ao_act.ts','utf8');
const builder = fs.readFileSync('apps/server/src/domain/controlplane/ao_act_task_from_operation_plan_builder_v1.ts','utf8');
const opRoute = route.slice(route.indexOf('app.post(\"/api/v1/actions/task/from-operation-plan\"'), route.indexOf('app.post(\"/api/v1/actions/task/from-variable-prescription\"'));
const roles = fs.readFileSync('apps/server/src/domain/auth/roles.ts','utf8');
assert(route.includes('app.post("/api/v1/actions/task/from-operation-plan"'), 'route exists under /api/v1/actions');
assert(!route.includes('app.post("/api/control/ao_act/task/from-operation-plan"'), 'no legacy route');
assert(route.includes('requireAoActAnyScopeV0(req, reply, ["action.task.create"]'), 'requires action.task.create');
for (const t of ['operation_plan_index_v1','operation_plan_v1','approval_request_v1']) assert(route.includes(t), 'reads '+t);
assert(route.includes('createAoActTaskCoreV1({') && route.includes('const source = "api/v1/actions/task/from-operation-plan"'), 'uses shared task core');
assert(route.includes('operator_operation_plan_task_projection_submission_v1'), 'writes projection submission');
assert(route.includes('act_task_id=$1') && route.includes('receipt_fact_id=NULL') && route.includes('status: \"AO_ACT_TASK_PROJECTED\"'), 'updates index act_task_id only');
assert(opRoute.includes('BEGIN') && opRoute.includes('COMMIT') && opRoute.includes('ROLLBACK'), 'success writes are transaction guarded');
for (const t of ['{payload,field_id}', '{payload,zone_id}', "{payload,status}')='APPROVED"]) assert(opRoute.includes(t), 'approval request query is fully scoped: '+t);
assert(opRoute.includes('if (!built.aoActTaskRequest) return { ok: false, ...built.submission }'), 'builder rejections are response-only');
for (const t of ['operation_plan_transition_v1','ao_act_receipt_v1','acceptance_result_v1','roi_ledger_v1','field_memory_v1']) assert(!route.slice(route.indexOf('app.post("/api/v1/actions/task/from-operation-plan"'), route.indexOf('app.post("/api/v1/actions/task/from-variable-prescription"')).includes(t), 'route does not write '+t);
for (const t of ['dispatch_created','receipt_created','acceptance_created','roi_created','field_memory_created']) { const re = new RegExp('\\b'+t+'\\s*:\\s*true'); assert(!re.test(opRoute) && !re.test(builder), 'no '+t+': true'); }
for (const t of ['from "pg"','require("pg")','Fastify','routes/','process.env','Date.now','new Date','randomUUID']) assert(!builder.includes(t), 'builder purity forbids '+t);
assert(gate.includes('/api/v1/actions/task/from-operation-plan'), 'field-binding gate covers route');
assert(/operator:\s*\[[^\]]*"action\.task\.create"/.test(roles), 'operator allowed action.task.create');
assert(/admin:\s*\["\*"\]/.test(roles), 'admin wildcard allowed');
assert(!/approver:\s*\[[^\]]*"action\.task\.create"/.test(roles), 'approver lacks action.task.create');
const customerFiles = [...fs.readdirSync('apps/server/src/routes').filter(f=>f.includes('customer')).map(f=>'apps/server/src/routes/'+f)];
for (const f of customerFiles) { const s=fs.readFileSync(f,'utf8'); assert(!s.includes('operator_operation_plan_task_projection_submission_v1'), 'customer does not expose projection '+f); }
console.log('[task-from-ready-operation-plan-boundary] PASS');
