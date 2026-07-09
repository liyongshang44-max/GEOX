// scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_01_FOUNDATION.cjs
// Purpose: validate S1/S2/S3A identity, dependency metadata, file boundary, domain purity, and explicit nonclaims.
// Boundary: governance/static acceptance only; no Runtime execution or database write.

'use strict';
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const BASE = '94fe516ccbf8831be05c36ede5e2732bf7e19d55';
let pass=0, fail=0; function check(v,m){if(v){pass++;console.log(`PASS ${m}`)}else{fail++;console.error(`FAIL ${m}`)}}
const status = JSON.parse(fs.readFileSync(path.join(ROOT,'docs/digital_twin/mcft/cap_01/GEOX-MCFT-CAP-01-DELIVERY-SLICE-STATUS.json'),'utf8'));
check(status.capability_line_id==='MCFT-CAP-01','capability line identity');
check(status.baseline_main_commit===BASE,'baseline identity');
check(status.slices.length===3,'exact foundation slice count');
check(status.slices[1].depends_on_delivery_slice_ids.includes(status.slices[0].delivery_slice_id),'S2 depends on S1');
check(status.slices[2].depends_on_delivery_slice_ids.includes(status.slices[1].delivery_slice_id),'S3A depends on S2');
const domainFiles=['apps/server/src/domain/twin_runtime/canonical_json_v1.ts','apps/server/src/domain/twin_runtime/canonical_identity_v1.ts','apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.ts','apps/server/src/domain/twin_runtime/runtime_config_v1.ts'];
for(const file of domainFiles){const text=fs.readFileSync(path.join(ROOT,file),'utf8');check(!/Date\.now|new Date|process\.env|randomUUID|nanoid|Fastify|from ["']pg["']/.test(text),`${file} domain purity`)}
try{
  const changed=cp.execFileSync('git',['diff','--name-only',`${BASE}...HEAD`],{cwd:ROOT,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
  const forbidden=changed.filter((file)=>file.startsWith('apps/web/')||file.startsWith('apps/server/src/routes/')||file.includes('GEOX-DT-02-ARCHITECTURE-AMENDMENT-02'));
  check(forbidden.length===0,`no forbidden changed files: ${forbidden.join(',')}`);
}catch(error){check(false,`git boundary check: ${error.message}`)}
check(status.nonclaims.includes('NO_BOOTSTRAP_STATE_COMMITTED'),'no bootstrap State claim');
console.log(`MCFT-CAP-01 foundation: ${pass} PASS, ${fail} FAIL`); if(fail) process.exit(1);
