// scripts/governance_acceptance/ACCEPTANCE_OPERATION_PLAN_FROM_APPROVED_DECISION_BOUNDARY_V1.cjs
const fs = require('fs');
function read(p){return fs.readFileSync(p,'utf8')}
function ok(c,m){if(!c){console.error('FAIL:',m);process.exit(1)} console.log('PASS:',m)}
const route=read('apps/server/src/routes/control_approval_request_v1.ts');
const builder=read('apps/server/src/domain/operations/operation_plan_from_approval_decision_builder_v1.ts');
const auth=read('apps/server/src/domain/auth/roles.ts')+read('apps/server/src/auth/ao_act_authz_v0.ts');
ok(route.includes('/api/v1/operator/approval-decisions/:decision_id/create-operation-plan'),'route exists');
ok(route.includes("'approval_decision_v1'")||route.includes('approval_decision_v1'),'reads approval_decision_v1');
ok(route.includes("'approval_request_v1'")||route.includes('approval_request_v1'),'reads approval_request_v1 transition');
ok(route.includes('operation_plan_v1'),'writes operation_plan_v1');
ok(route.includes('operator_approval_decision_operation_plan_submission_v1'),'writes submission fact');
for (const banned of ['operation_plan_transition_v1','/api/v1/actions/task','ao_act_task_v0','roi_ledger_v1','field_memory_v1']) ok(!route.match(new RegExp(`operator_approval_decision_operation_plan_api[\\s\\S]{0,2000}${banned}`)),`route does not create/call ${banned}`);
ok(!/from ['"]pg['"]|fastify|routes|process\.env|Date\.now|new Date|randomUUID/.test(builder),'builder purity boundary');
ok(auth.includes('operation.plan.create'),'operation.plan.create scope exists');
ok(/admin:\s*\["\*"\]/.test(auth),'admin gets operation.plan.create by wildcard');
ok(/operator:\s*\[[^\]]*operation\.plan\.create/.test(auth),'operator gets operation.plan.create');
ok(!/approver:\s*\[[^\]]*operation\.plan\.create/.test(auth),'approver does not get operation.plan.create');
const customerFiles = [...fs.readdirSync('apps/server/src/routes').map(f=>'apps/server/src/routes/'+f).filter(f=>fs.statSync(f).isFile()), ...(fs.existsSync('apps/web/src')?fs.readdirSync('apps/web/src',{recursive:true}).map(f=>'apps/web/src/'+f).filter(f=>fs.existsSync(f)&&fs.statSync(f).isFile()):[])];
const customerText = customerFiles.filter(f=>/customer|report|dashboard|operations/.test(f)).map(f=>read(f)).join('\n');
ok(!customerText.includes('operator_approval_decision_operation_plan_submission_v1'),'customer files do not expose submission fact');
ok(!customerText.includes('confirmed delivery') || !customerText.includes('operation_plan_v1'),'customer files do not expose unexecuted plan as confirmed delivery');
