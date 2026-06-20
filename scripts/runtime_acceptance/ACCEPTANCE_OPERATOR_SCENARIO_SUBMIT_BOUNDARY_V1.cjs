const fs = require('fs');
function assert(c,m){if(!c)throw new Error(m)}
const route=fs.readFileSync('apps/server/src/routes/v1/operator_twin.ts','utf8');
assert(route.includes('SUBMITTED_TO_RECOMMENDATION'),'status must support submitted');
assert(route.includes('recommendation_id'),'recommendation_id must be returned');
for (const flag of ['approval_created: false','operation_plan_created: false','task_created: false','dispatch_created: false']) assert(route.includes(flag), `missing boundary flag ${flag}`);
assert(route.includes('decision_recommendation_v1') || route.includes('operator_scenario_recommendation_submission_v1'),'must write recommendation or submission fact');
for (const bad of ['approval_request_v1','operation_plan_v1','ao_act_task_v0']) assert(!route.includes(`type: "${bad}"`) && !route.includes(`type = "${bad}"`), `must not create ${bad}`);
console.log('PASS H28 runtime boundary guard');
