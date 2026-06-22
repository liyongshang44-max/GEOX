#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
function read(p){ return fs.readFileSync(p,'utf8'); }
const routeFile = read('apps/server/src/routes/decision_engine_v1.ts');
const start = routeFile.indexOf('app.post("/api/v1/actions/receipt/from-task"');
const next = routeFile.indexOf('app.post(', start + 10);
const route = routeFile.slice(start, next > start ? next : undefined);
const builder = read('apps/server/src/domain/controlplane/ao_act_receipt_from_task_builder_v1.ts');
const roles = read('apps/server/src/domain/auth/roles.ts');
const overlay = read('apps/server/src/routes/openapi_sales_critical_governance_defaults_v1.ts');
const openapi = read('apps/server/src/routes/openapi_v1.ts');
const inventory = read('apps/server/src/routes/api_route_inventory_v1.ts');
function ok(cond,msg){ assert(cond,msg); console.log('ok - '+msg); }
ok(route.includes('app.post("/api/v1/actions/receipt/from-task"'), 'POST /api/v1/actions/receipt/from-task route exists');
ok(!route.includes('app.post("/api/control/ao_act/receipt/from-task"'), 'route is not under /api/control/ao_act/*');
ok(route.includes('requireAoActScopeV0(req, reply, "action.receipt.submit")'), 'route requires action.receipt.submit');
ok(route.includes('ao_act_task_v0'), 'route reads ao_act_task_v0');
ok(route.includes('operation_plan_index_v1'), 'route reads operation_plan_index_v1');
ok(route.includes('ao_act_receipt_v1'), 'route writes ao_act_receipt_v1');
ok(route.includes('executor_ao_act_receipt_submission_v1'), 'route writes executor_ao_act_receipt_submission_v1');
ok(route.includes('receipt_fact_id=$1') && route.includes('source_fact_id=$1'), 'route updates operation_plan_index_v1 receipt_fact_id');
for (const t of ['operation_plan_transition_v1','as_executed_record_v1','acceptance_result_v1','roi_ledger_v1','field_memory_v1']) ok(!route.match(new RegExp(`type:\\s*["']${t}`)), `route does not write ${t}`);
ok(!route.match(/type:\s*["']operation_plan_v1/) || route.indexOf('/api/v1/actions/receipt/from-task') > route.lastIndexOf('type: "operation_plan_v1"'), 'route does not write terminal operation_plan_v1');
ok(!builder.match(/from\s+["']pg["']|from\s+["']fastify["']|routes\//), 'builder does not import pg/Fastify/routes');
ok(!builder.includes('process.env'), 'builder does not read process.env');
ok(!builder.match(/Date\.now|new Date|randomUUID/), 'builder does not use time/random APIs');
ok(/executor:[^\n]*action\.receipt\.submit/.test(roles) && /operator:[^\n]*action\.receipt\.submit/.test(roles) && /admin:\s*\["\*"\]/.test(roles), 'auth matrix allows executor/operator/admin');
ok(!/approver:[^\n]*action\.receipt\.submit/.test(roles), 'approver role lacks action.receipt.submit');
const customerFiles = fs.readdirSync('apps/server/src/routes').filter(f=>/customer|delivery|reports|dashboard/.test(f)).map(f=>'apps/server/src/routes/'+f);
for (const p of customerFiles) { const c = read(p); ok(!c.includes('executor_ao_act_receipt_submission_v1'), `${p} does not expose executor submission`); ok(!/ao_act_receipt_v1[\s\S]{0,120}(accepted|completed|delivery)/i.test(c), `${p} does not expose receipt as accepted/completed delivery`); }
ok(overlay.includes('/api/v1/actions/receipt/from-task') && openapi.includes('/api/v1/actions/receipt/from-task'), 'OpenAPI overlay includes receipt-from-task');
ok(inventory.includes('/api/v1/actions/receipt/from-task'), 'API inventory includes receipt-from-task');
console.log('ACCEPTANCE_AO_ACT_RECEIPT_V1_BOUNDARY passed');
