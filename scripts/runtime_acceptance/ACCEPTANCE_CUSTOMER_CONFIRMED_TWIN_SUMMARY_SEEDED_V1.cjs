#!/usr/bin/env node
const fs=require('fs');
const s=fs.readFileSync('apps/server/src/routes/customer_v1.ts','utf8');
for(const t of ['operator_scenario_recommendation_submission_v1','decision_recommendation_v1','evidence_refs','summary_status: "AVAILABLE"','amount_mm','human_approval_required','approval_status','operation_plan_status','task_status','summary_status: "NOT_AVAILABLE"','NO_CONFIRMED_OPERATOR_RECOMMENDATION']) if(!s.includes(t)) throw new Error('missing seeded contract token '+t);
if(/scenario options|forecast raw timeline/i.test(s)) throw new Error('forbidden raw projection token');
console.log('[customer-confirmed-twin-summary-seeded] PASS');
