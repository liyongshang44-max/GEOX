const fs=require('fs');const p='apps/server/src/routes/v1/operator_twin.ts';const s=fs.readFileSync(p,'utf8');function ok(c,m){if(!c){console.error(m);process.exit(1)}}
ok(s.includes('/api/v1/operator/twin/fields/:field_id/post-irrigation'),'route missing');
ok(s.includes('operator_field_twin_post_irrigation_verification_api'),'source missing');
ok(s.includes('operator_field_twin_post_irrigation_verification_v1'),'object missing');
['writeReady','dispatchReady','approvalReady','taskCreationReady','memoryWriteReady','roiWriteReady'].forEach(k=>ok(new RegExp(k+'\\s*:\\s*false').test(s),`${k} false missing`));
ok(!/\b(INSERT|UPDATE|DELETE)\b/.test(s),'route file contains write SQL');
['writeFieldMemory','createRoiLedger','createAoActTask','submitRecommendation'].forEach(t=>ok(!s.includes(t),`forbidden ${t}`));
ok(!/\bdispatch\s*\(/.test(s),'forbidden dispatch mutation');
ok(!/\bapprove\s*\(/.test(s),'forbidden approve mutation');
ok(s.includes('latestOptionalProjectionOrFactRow')&&s.includes('latestOptionalFactByType')&&s.includes('facts'),'facts fallback missing');
ok(s.includes('POST_IRRIGATION_OBSERVATION_NOT_AVAILABLE'),'post observation gap missing');
console.log('H27 backend source guard acceptance passed');
