#!/usr/bin/env node
// scripts/governance_acceptance/ACCEPTANCE_RECOMMENDATION_APPROVAL_REQUEST_BOUNDARY_V1.cjs
const fs = require('fs');
const path = require('path');
const root = process.cwd();
function read(p){ return fs.readFileSync(path.join(root,p),'utf8'); }
function assert(cond,msg){ if(!cond){ console.error(`FAIL: ${msg}`); process.exit(1); } console.log(`ok - ${msg}`); }
const routePath = 'apps/server/src/routes/control_approval_request_v1.ts';
const builderPath = 'apps/server/src/domain/approval/recommendation_approval_request_builder_v1.ts';
const route = read(routePath);
const h36 = route.slice(route.indexOf('async function latestRecommendationById'), route.indexOf('async function handleApprovalRequest'));
const builder = read(builderPath);
assert(route.includes('/api/v1/operator/recommendations/:recommendation_id/request-approval'), 'operator recommendation request-approval route exists');
assert(route.includes('decision_recommendation_v1'), 'route reads decision_recommendation_v1');
assert(route.includes('approval_request_v1'), 'route writes approval_request_v1 through approval service');
assert(route.includes('operator_recommendation_approval_request_submission_v1'), 'route writes operator recommendation approval request submission fact');
assert(!h36.includes('/api/v1/approvals/approve'), 'H36 route does not call approvals approve endpoint');
for (const forbidden of ['approval_decision_v1','operation_plan_v1','ao_act_task_v0','/api/v1/actions/task','roi_ledger_v1','field_memory_v1']) {
  assert(!h36.includes(`type: \"${forbidden}\"`) && !h36.includes(`type: '${forbidden}'`) && !h36.includes(forbidden + "', payload") && !h36.includes(`fetchJson(\`${forbidden}`), `H36 route does not write/call ${forbidden}`);
}
for (const token of ['from "pg"','require("pg")','Fastify','../routes','/routes/','process.env','Date.now','new Date','randomUUID','INSERT INTO facts']) {
  assert(!builder.includes(token), `builder does not use forbidden token ${token}`);
}
const customerFiles = ['apps/server/src/routes/customer_v1.ts'];
for (const file of customerFiles) {
  const text = read(file);
  assert(!text.includes('operator_recommendation_approval_request_submission_v1'), 'customer files do not expose operator recommendation approval submissions');
  assert(!text.includes('DECISION_RECOMMENDATION_V1') && !text.includes('REQUEST_HUMAN_APPROVAL_ONLY'), 'customer files do not expose unapproved recommendation-derived approval requests');
}
console.log('PASS recommendation approval request boundary acceptance');
