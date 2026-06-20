#!/usr/bin/env node
const fs = require('fs'); const path = require('path'); const ROOT = path.resolve(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT,p),'utf8'); const assert=(c,m)=>{if(!c) throw new Error(m)};
const server=read('apps/server/src/routes/v1/operator_twin.ts');
for (const t of ['/api/v1/operator/twin/fields/:field_id/calibration','operator_field_twin_calibration_replay_api','operator_field_twin_calibration_replay_v1','writeReady: false','dispatchReady: false','approvalReady: false','taskCreationReady: false']) assert(server.includes(t),'missing '+t);
for (const t of ['INSERT ','UPDATE ','DELETE ','writeFieldMemory','createRoiLedger','createAoActTask','dispatch(','approve(','submitRecommendation']) assert(!server.includes(t),'forbidden write token '+t);
assert(server.includes('POST_IRRIGATION_VERIFICATION_NOT_AVAILABLE'), 'missing calibration gap');
for (const t of ['latestOptionalFactByType','latestOptionalProjectionOrFactRow','record_json::jsonb->>\'type\'','FROM facts','factScopeClause']) assert(server.includes(t), 'missing facts fallback helper token '+t);
for (const t of ['operation_plan_v1','ao_act_receipt_v1','ao_act_receipt_v0','acceptance_result_v1','as_executed_record_v1']) assert(server.includes(`latestOptionalProjectionOrFactRow(pool, "${t}"`), 'execution-chain source must use projection-or-facts fallback for '+t);
assert(server.includes('latestOptionalProjectionOrFactRow(pool, "ao_act_" + "task_v0"'), 'task source must use projection-or-facts fallback');
for (const key of ['tenant_id','project_id','group_id','field_id']) assert(server.includes(key), 'facts fallback must scope by '+key);
const directReadPattern = /latestOptionalRow\(pool,\s*"(operation_plan_v1|ao_act_receipt_v1|ao_act_receipt_v0|acceptance_result_v1|as_executed_record_v1)"/;
assert(!directReadPattern.test(server), 'execution-chain must not directly use latestOptionalRow without facts fallback');
const pkg=JSON.parse(read('package.json')); assert(pkg.scripts['ci:governance:operator-field-twin-calibration-source-guard']==='node scripts/governance_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_CALIBRATION_SOURCE_GUARD_V1.cjs','missing package script');
console.log('[operator-field-twin-calibration-source-guard] PASS');
