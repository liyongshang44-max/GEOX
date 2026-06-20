#!/usr/bin/env node
const fs = require('fs'); const path = require('path'); const ROOT = path.resolve(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(ROOT,p),'utf8'); const assert=(c,m)=>{if(!c) throw new Error(m)};
const server=read('apps/server/src/routes/v1/operator_twin.ts');
for (const t of ['/api/v1/operator/twin/fields/:field_id/calibration','operator_field_twin_calibration_replay_api','operator_field_twin_calibration_replay_v1','writeReady: false','dispatchReady: false','approvalReady: false','taskCreationReady: false']) assert(server.includes(t),'missing '+t);
for (const t of ['INSERT ','UPDATE ','DELETE ','writeFieldMemory','createRoiLedger','createAoActTask','dispatch(','approve(','submitRecommendation']) assert(!server.includes(t),'forbidden write token '+t);
assert(server.includes('POST_IRRIGATION_VERIFICATION_NOT_AVAILABLE'), 'missing calibration gap');
const pkg=JSON.parse(read('package.json')); assert(pkg.scripts['ci:governance:operator-field-twin-calibration-source-guard']==='node scripts/governance_acceptance/ACCEPTANCE_OPERATOR_FIELD_TWIN_CALIBRATION_SOURCE_GUARD_V1.cjs','missing package script');
console.log('[operator-field-twin-calibration-source-guard] PASS');
