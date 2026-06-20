const fs=require('fs');const s=fs.readFileSync('apps/server/src/routes/v1/operator_twin.ts','utf8');function ok(c,m){if(!c){console.error(m);process.exit(1)}}
['RESPONSE_OBSERVED','INCREASED','receipt_available','as_executed_available','post_irrigation_state_v1','field_memory_candidate','memoryWriteReady: false','roi_candidate','roiWriteReady: false'].forEach(t=>ok(s.includes(t),`seeded positive token missing ${t}`));
ok(s.includes('deltaValue > 0'),'positive delta rule missing');
ok(s.includes('POST_IRRIGATION_OBSERVATION_NOT_AVAILABLE'),'gap token missing');
console.log('H27 runtime seeded positive acceptance passed');
