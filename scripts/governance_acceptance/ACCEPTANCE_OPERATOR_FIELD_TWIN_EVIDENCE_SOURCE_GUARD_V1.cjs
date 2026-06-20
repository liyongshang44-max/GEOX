#!/usr/bin/env node
const fs = require('fs'); const path = require('path'); const ROOT = path.resolve(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT,p),'utf8'); const assert=(c,m)=>{if(!c) throw new Error(m)};
const server=read('apps/server/src/routes/v1/operator_twin.ts');
for (const t of ['/api/v1/operator/twin/fields/:field_id/evidence','operator_field_twin_evidence_quality_api','operator_field_twin_evidence_quality_v1','writeReady: false','dispatchReady: false','approvalReady: false','taskCreationReady: false']) assert(server.includes(t),'missing '+t);
for (const t of ['INSERT ','UPDATE ','DELETE ','createAoActTask','dispatch(','approve(','submitRecommendation']) assert(!server.includes(t),'forbidden write token '+t);
for (const t of ['OPERATOR_TWIN_SCOPED_INDEX_TABLES','buildSourceIndexInventory','readRows','collectEvidenceRefs','countScopedRows','field_index_v1','water_state_estimate_index_v1','soil_moisture_sensing_window_index_v1','weather_forecast_index_v1','irrigation_scenario_set_index_v1','decision_recommendation_index_v1']) assert(server.includes(t),'missing official source reuse '+t);
for (const t of ['customer_report','debug_payload']) assert(!server.includes(t),'forbidden primary source '+t);
const pkg=JSON.parse(read('package.json')); assert(pkg.scripts['ci:governance:operator-field-twin-evidence-source-guard']==='node scripts/governance_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_EVIDENCE_SOURCE_GUARD_V1.cjs','missing package script');
console.log('[operator-field-twin-evidence-source-guard] PASS');
