const fs = require('fs');
function read(p){return fs.readFileSync(p,'utf8')}
function assert(c,m){if(!c)throw new Error(m)}
const route=read('apps/server/src/routes/v1/operator_twin.ts');
const submit = route.match(/async function buildOperatorScenarioRecommendationSubmission[\s\S]*?function tableDisplayLabel/)?.[0] + route.match(/app\.post\([\s\S]*?submit-recommendation[\s\S]*?\n  \);/)?.[0];
assert(route.includes('app.post') && route.includes('/submit-recommendation'),'must register POST /submit-recommendation');
assert(submit.includes('operator_scenario_recommendation_submission_api'),'must use source operator_scenario_recommendation_submission_api');
assert(submit.includes('operator_scenario_recommendation_submission_v1'),'must return/write submission envelope');
for (const type of ['operator_scenario_recommendation_submission_v1','decision_recommendation_v1']) assert(submit.includes(type), `allowed write type missing ${type}`);
for (const bad of ['approval_request_v1','approval_decision_v1','operation_plan_transition_v1','ao_act_task_v0','ao_act_receipt_v1','as_executed_record_v1','acceptance_result_v1','roi_ledger_v1','field_memory_v1','createOperationPlanForApproval','createAoActTask','approval decision service']) assert(!submit.includes(bad), `forbidden backend token ${bad}`);
assert(!/operation_plan_v1/.test(submit),'submit implementation must not write operation_plan_v1');
assert(submit.includes('no_direct_execution') && submit.includes('human_approval_required: true'),'recommendation must require approval and no direct execution');
console.log('PASS H28 backend source guard');
