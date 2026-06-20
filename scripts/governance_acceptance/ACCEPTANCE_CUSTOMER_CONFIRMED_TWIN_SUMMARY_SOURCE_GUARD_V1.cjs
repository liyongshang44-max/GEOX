#!/usr/bin/env node
const fs=require('fs'); const s=fs.readFileSync('apps/server/src/routes/customer_v1.ts','utf8'); function need(c,m){if(!c)throw new Error(m)}
for(const t of ['GET /api/v1/customer/fields/:field_id/confirmed-twin-summary','customer_confirmed_twin_summary_api','OFFICIAL_CUSTOMER_DELIVERY_PORTAL','surface: "CUSTOMER"','customer_confirmed_twin_summary_v1','writeReady: false','operatorTwinReady: false','adminControlPlaneReady: false','forecastRunReady: false','scenarioEditReady: false','recommendationSubmitReady: false','approvalReady: false','taskCreationReady: false','dispatchReady: false']) need(s.includes(t)||s.includes('app.get("/api/v1/customer/fields/:field_id/confirmed-twin-summary"'),'missing '+t);
const block=s.slice(s.indexOf('app.get("/api/v1/customer/fields/:field_id/confirmed-twin-summary"'), s.indexOf('app.get("/api/v1/customer/fields/:fieldId/memory"'));
for(const t of ['INSERT','UPDATE','DELETE','writeFacts','appendFact','submitOperatorScenarioRecommendation','adminControlPlaneRouteHelper']) need(!block.includes(t),'forbidden backend token '+t);
need(!s.includes("replace(/'/g"), 'recommendation linked lookups must be parameterized');
need(s.includes('type FactLink') && s.includes('linkSql.push') && s.includes('approvalIds') && s.includes('planIds'), 'linked chain helper required');
console.log('[customer-confirmed-twin-summary-source-guard] PASS');
