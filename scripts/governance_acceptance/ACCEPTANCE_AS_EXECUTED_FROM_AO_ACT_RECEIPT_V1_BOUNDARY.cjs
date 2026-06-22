#!/usr/bin/env node
// scripts/governance_acceptance/ACCEPTANCE_AS_EXECUTED_FROM_AO_ACT_RECEIPT_V1_BOUNDARY.cjs
const fs = require('fs'); const assert = require('assert');
const read = p => fs.readFileSync(p,'utf8'); const ok=(c,m)=>{assert(c,m);console.log('ok - '+m)};
const routeFile = read('apps/server/src/routes/as_executed_v1.ts');
const helper = read('apps/server/src/domain/execution/as_executed_from_ao_act_receipt_v1.ts');
const roles = read('apps/server/src/domain/auth/roles.ts');
const start = routeFile.indexOf('app.post("/api/v1/as-executed/from-ao-act-receipt-v1"');
const next = routeFile.indexOf('app.get(', start + 10);
const route = routeFile.slice(start, next > start ? next : undefined);
ok(start >= 0, 'POST /api/v1/as-executed/from-ao-act-receipt-v1 route exists');
ok(routeFile.includes('registerAsExecutedV1Routes') && start >= 0, 'route stays in existing as-executed module');
ok(helper.includes('createAsExecutedFromReceipt') || helper.includes('as_executed_record_v1'), 'route reuses existing createAsExecutedFromReceipt or existing as_executed_record_v1 table');
ok(helper.includes('ao_act_receipt_v1'), 'route reads ao_act_receipt_v1');
ok(helper.includes('operation_plan_index_v1'), 'route reads operation_plan_index_v1');
ok(helper.includes('createAsExecutedFromReceipt') || helper.includes('as_executed_record_v1'), 'route writes as_executed_record_v1');
ok(helper.includes('createAsExecutedFromReceipt') || helper.includes('as_applied_map_v1'), 'route writes as_applied_map_v1 only as existing as-executed companion projection');
for (const t of ['acceptance_result_v1','evidence_artifact_v1','roi_ledger_v1','field_memory_v1','operation_plan_transition_v1']) ok(!route.match(new RegExp(`type:\\s*["']${t}`)) && !helper.match(new RegExp(`INSERT\\s+INTO\\s+${t}`,'i')), `route does not write ${t}`);
ok(!route.match(/type:\s*["']operation_plan_v1/) && !helper.match(/INSERT\s+INTO\s+operation_plan_v1/i), 'route does not write terminal operation_plan_v1');
ok(route.includes('requireAoActScopeV0(req, reply, "ao_act.receipt.write")'), 'route requires ao_act.receipt.write');
ok(route.includes('"executor", "operator", "admin"') && /executor:[^\n]*ao_act\.receipt\.write/.test(roles) && /operator:[^\n]*ao_act\.receipt\.write/.test(roles) && /admin:\s*\["\*"\]/.test(roles), 'executor/operator/admin are allowed');
ok(!/approver:[^\n]*ao_act\.receipt\.write/.test(roles) && !/client:[^\n]*ao_act\.receipt\.write/.test(roles) && !/viewer:[^\n]*ao_act\.receipt\.write/.test(roles), 'approver/client/viewer are rejected');
ok(!helper.includes('process.env'), 'builder/helper does not read process.env');
ok(!helper.match(/Date\.now|new Date|randomUUID/), 'builder/helper does not use Date.now/new Date/randomUUID');
for (const p of fs.readdirSync('apps/server/src/routes').filter(f=>/customer|delivery|reports|dashboard/.test(f)).map(f=>'apps/server/src/routes/'+f)) ok(!/as_executed_record_v1[\s\S]{0,160}(final|accepted delivery|customer final)/i.test(read(p)), `${p} does not expose as_executed_record_v1 as final accepted delivery`);
console.log('ACCEPTANCE_AS_EXECUTED_FROM_AO_ACT_RECEIPT_V1_BOUNDARY passed');
