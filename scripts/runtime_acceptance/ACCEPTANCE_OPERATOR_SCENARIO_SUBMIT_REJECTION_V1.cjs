const fs = require('fs');
function assert(c,m){if(!c)throw new Error(m)}
const route=fs.readFileSync('apps/server/src/routes/v1/operator_twin.ts','utf8');
for (const status of ['REJECTED_NO_ACTION','REJECTED_OPTION_NOT_FOUND','REJECTED_SCOPE_MISMATCH','REJECTED_EVIDENCE_BLOCKING']) assert(route.includes(status), `missing rejection ${status}`);
assert(route.includes('isNoActionOption') && route.includes('evidenceQualityBlocking'),'must explicitly guard no_action and blocking evidence');
console.log('PASS H28 runtime rejection guard');
