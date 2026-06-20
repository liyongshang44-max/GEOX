#!/usr/bin/env node
const fs=require('fs'), path=require('path'); const root=path.resolve(__dirname,'../..'); const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')); const ok=(c,m)=>{if(!c)throw new Error(m)};
const required={
'ci:frontend:surface-contract':'scripts/frontend_acceptance/ACCEPTANCE_FRONTEND_SURFACE_CONTRACT_V1.cjs',
'ci:frontend:customer-report-route-contract':'scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_REPORT_ROUTE_CONTRACT_V1.cjs',
'ci:frontend:operator-twin-overview-canonical':'scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_TWIN_OVERVIEW_CANONICAL_V1.cjs',
'ci:frontend:operator-field-twin-workspace-canonical':'scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_WORKSPACE_CANONICAL_V1.cjs',
'ci:frontend:operator-field-twin-forecast-panel-canonical':'scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_FORECAST_PANEL_CANONICAL_V1.cjs',
'ci:frontend:operator-field-twin-scenario-compare-canonical':'scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_SCENARIO_COMPARE_CANONICAL_V1.cjs',
'ci:frontend:operator-twin-presentation-surface':'scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_TWIN_PRESENTATION_SURFACE_V1.cjs',
'ci:frontend:operator-field-twin-evidence-page-canonical':'scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_EVIDENCE_PAGE_CANONICAL_V1.cjs',
'ci:frontend:operator-field-twin-calibration-page-canonical':'scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_CALIBRATION_PAGE_CANONICAL_V1.cjs',
'ci:frontend:operator-field-twin-post-irrigation-page-canonical':'scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_POST_IRRIGATION_PAGE_CANONICAL_V1.cjs',
'ci:frontend:operator-scenario-submit-recommendation':'scripts/frontend_acceptance/ACCEPTANCE_OPERATOR_SCENARIO_SUBMIT_RECOMMENDATION_PAGE_V1.cjs',
'ci:frontend:admin-control-plane-surface':'scripts/frontend_acceptance/ACCEPTANCE_ADMIN_CONTROL_PLANE_SURFACE_V1.cjs',
'ci:frontend:customer-confirmed-twin-summary-surface':'scripts/frontend_acceptance/ACCEPTANCE_CUSTOMER_CONFIRMED_TWIN_SUMMARY_SURFACE_V1.cjs',
'ci:frontend:three-surfaces-e2e':'scripts/frontend_acceptance/ACCEPTANCE_FRONTEND_THREE_SURFACES_E2E_V1.cjs',
'ci:runtime:decision-to-delivery-e2e':'scripts/runtime_acceptance/ACCEPTANCE_DECISION_TO_DELIVERY_E2E_V1.cjs',
'ci:runtime:three-surface-no-cross-write':'scripts/runtime_acceptance/ACCEPTANCE_THREE_SURFACE_NO_CROSS_WRITE_V1.cjs'};
for (const [script,file] of Object.entries(required)){ok(pkg.scripts[script], 'package script missing '+script); ok(fs.existsSync(path.join(root,file)), 'acceptance file missing '+file); ok(pkg.scripts[script].includes(file), 'package script not wired to '+file);}
ok(pkg.scripts['ci:prd-v0-2-final']&&pkg.scripts['ci:prd-v0-2-final'].includes('ci:runtime:three-surface-no-cross-write'),'final suite missing');
console.log('[frontend-prd-v0-2-final-manifest] PASS');
