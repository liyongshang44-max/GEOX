const assert=require('node:assert/strict');
const {classify,GROUPS}=require('./MCFT_PV02_PRODUCT_CI_APPLICABILITY_V1.cjs');
for(const [key,paths] of Object.entries(GROUPS)){
 const r=classify(paths);assert.equal(r.mode,'product-shared-regression');assert.equal(r.unknown.length,0);
 assert(r.required_regressions.includes('MAIN_CI'));assert(r.required_regressions.includes('BLINE_AUTHORITY_UNCHANGED'));
 if(key!=='math')assert(r.required_regressions.includes('S2_REAL_PG_SHARED_INGRESS'));
 if(key!=='ingress')assert(r.required_regressions.includes('CAP02_03_04_FROZEN_SCIENCE'));
}
assert.equal(classify([...GROUPS.ingress,...GROUPS.math,...GROUPS.composer]).mode,'product-shared-regression');
for(const p of ['unknown.ts','apps/server/src/runtime/twin_runtime/unregistered.ts','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json','docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json','scripts/governance_acceptance/MCFT_PV02_PRODUCT_CI_APPLICABILITY_V1.cjs','.github/workflows/mcft-cap-09-s2-registry-registration.yml']){
 const r=classify([...GROUPS.ingress,p]);assert.equal(r.mode,'historical');assert.deepEqual(r.unknown,[p]);
}
assert.equal(classify([]).mode,'historical');
console.log('PASS: exact I1/I2/I2E product groups, shared regression obligations, unknown/authority/mixed change fail-closed. No historical qualification claimed.');
