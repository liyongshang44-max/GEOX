// scripts/governance_acceptance/ACCEPTANCE_RECOMMENDATION_APPROVAL_DECISION_BOUNDARY_V1.cjs
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..'); const read = (p) => fs.readFileSync(path.join(root,p),'utf8');
const route = read('apps/server/src/routes/control_approval_request_v1.ts');
const builder = read('apps/server/src/domain/approval/recommendation_approval_decision_builder_v1.ts');
const roles = read('apps/server/src/domain/auth/roles.ts');
function ok(c,m){assert.ok(c,m); console.log('ok - '+m)}
ok(route.includes('/api/v1/operator/approval-requests/:request_id/decision'), 'route exists');
ok(route.includes("approval_request_v1") && route.includes('latestScopedApprovalRequestById'), 'route reads approval_request_v1 by scope');
ok(route.includes("type: \"approval_decision_v1\""), 'route writes approval_decision_v1');
ok(route.includes("operator_recommendation_approval_decision_submission_v1"), 'route writes operator_recommendation_approval_decision_submission_v1');
ok(route.includes("type: \"approval_request_v1\"") && route.includes('approval_request_transition_v1'), 'route appends approval_request_v1 transition');
const h = route.slice(route.indexOf('async function handleRecommendationApprovalDecision'), route.indexOf('async function handleRecommendationApprovalRequest'));
for (const bad of ['/api/v1/actions/task','operation_plan_v1','operation_plan_transition_v1','ao_act_task_v0','roi_ledger_v1','field_memory_v1']) ok(!h.includes(bad), `decision route does not create/call ${bad}`);
for (const bad of ['from "pg"','from "fastify"','routes/','process.env','Date.now','new Date','randomUUID']) ok(!builder.includes(bad), `builder excludes ${bad}`);
ok(/approver:\s*\[[^\]]*"approval\.decide"/.test(roles) && /admin:\s*\["\*"\]/.test(roles), 'auth matrix gives approval.decide to approver/admin');
ok(!/operator:\s*\[[^\]]*"approval\.decide"/.test(roles), 'operator role does not get approval.decide');
const files = []; function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){ if(['node_modules','.git','dist','build'].includes(e.name)) continue; const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(/\.(ts|tsx|js|jsx)$/.test(e.name)) files.push(p); }}
for (const d of ['apps/server/src/routes','apps/web/src']) { const full=path.join(root,d); if(fs.existsSync(full)) walk(full); }
for (const f of files.filter(f=>/customer/i.test(f))) { const s=fs.readFileSync(f,'utf8'); ok(!s.includes('operator_recommendation_approval_decision_submission_v1'), `customer file hides operator decision submission ${path.relative(root,f)}`); ok(!s.includes('approval_decision_v1') || s.includes('confirmed'), `customer file hides unconfirmed approval_decision_v1 ${path.relative(root,f)}`); }
console.log('ACCEPTANCE_RECOMMENDATION_APPROVAL_DECISION_BOUNDARY_V1 passed');
