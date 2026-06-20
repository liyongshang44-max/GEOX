#!/usr/bin/env node
const fs=require('fs');
function read(p){return fs.readFileSync(p,'utf8')} function need(c,m){if(!c)throw new Error(m)}
const page=read('apps/web/src/views/FieldReportPage.tsx');
const card=read('apps/web/src/features/customer/components/CustomerConfirmedTwinSummaryCard.tsx');
const api=read('apps/web/src/api/customer.ts');
need(page.includes('CustomerConfirmedTwinSummaryCard'),'page imports CustomerConfirmedTwinSummaryCard');
need(card.includes('CustomerConfirmedTwinSummaryCard'),'card exists');
need(page.includes('fetchCustomerConfirmedTwinSummary'),'page calls fetchCustomerConfirmedTwinSummary');
for(const t of ['不运行预测','不编辑情景','不提交 recommendation','不审批','不派发任务']) need(card.includes(t),'missing boundary copy '+t);
for(const t of ['customerCard','customerTable','customerList','customerStatusPill','customerBoundaryNotice','customerEvidenceList']) need((page+card).includes(t),'missing customer class '+t);
for(const t of ['operatorWorkbench','adminControlPlanePage','adminPanel','SubmitScenarioToRecommendationPanel','submitOperatorScenarioRecommendation','createAoActTask','createOperationPlan','writeFieldMemory','createRoiLedger']) need(!(page+card+api).includes(t),'forbidden frontend token '+t);
need(!/\bdispatch\b|\bapprove\b/.test(page+card+api),'forbidden action token');
console.log('[customer-confirmed-twin-summary-surface] PASS');
