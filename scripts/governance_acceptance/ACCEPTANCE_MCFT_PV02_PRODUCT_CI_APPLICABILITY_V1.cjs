const assert=require('node:assert/strict');
const {classify,GROUPS,CONTROL_PATHS}=require('./MCFT_PV02_PRODUCT_CI_APPLICABILITY_V1.cjs');
for(const [key,paths] of Object.entries(GROUPS)){
 const r=classify(paths);assert.equal(r.mode,'product-shared-regression');assert.equal(r.unknown.length,0);
 assert(r.required_regressions.includes('MAIN_CI'));assert(r.required_regressions.includes('BLINE_AUTHORITY_UNCHANGED'));
 if(key!=='math')assert(r.required_regressions.includes('S2_REAL_PG_SHARED_INGRESS'));
 if(key==='math'||key==='composer')assert(r.required_regressions.includes('CAP02_03_04_FROZEN_SCIENCE'));
}
for(const [key,obligation] of [["parameter_sources","I2E_PARAMETER_SOURCE_RESOLUTION"],["persistence","I2E_FACT_PERSISTENCE_VISIBILITY"],["read_api","CAP07_S4_CUSTOMER_NATIVE_READ_API"]]){
 const r=classify(GROUPS[key]);assert.equal(r.mode,'product-shared-regression');assert(r.required_regressions.includes("I2E_NATIVE_COMPOSITION"));assert(r.required_regressions.includes(obligation));
}
assert(classify(GROUPS.read_api).required_regressions.includes("EXACT_SCOPE_AUTHORIZATION"));
assert(classify(GROUPS.persistence).required_regressions.includes("STATE_PREDECESSOR_AND_IDEMPOTENCY"));
assert.equal(classify([...GROUPS.ingress,...GROUPS.math,...GROUPS.composer,...GROUPS.parameter_sources,...GROUPS.persistence,...GROUPS.read_api]).mode,'product-shared-regression');
for(const p of ['unknown.ts','apps/server/src/runtime/twin_runtime/unregistered.ts','docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json','docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json','scripts/governance_acceptance/MCFT_PV02_PRODUCT_CI_APPLICABILITY_V1.cjs','.github/workflows/mcft-cap-09-s2-registry-registration.yml']){
 const r=classify([...GROUPS.ingress,p]);assert.equal(r.mode,'historical');assert.deepEqual(r.unknown,[p]);
}
for(const p of ['.github/workflows/mcft-pv02-i1-native-mqtt.yml','.github/workflows/mcft-pv02-i2-customer-scalar.yml',
 '.github/workflows/mcft-pv02-i2e-native-composition.yml','.github/workflows/mcft-pv02-product-ci-applicability.yml',
 'scripts/governance_acceptance/MCFT_PV02_PRODUCT_CI_APPLICABILITY_V1.cjs',
 'docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-QUALIFICATION-CONTROL-PLANE-V1.json',
 'docs/digital_twin/mcft/MCFT-CANDIDATE-AUTHORITY-REGISTRY-V1.json'])assert(CONTROL_PATHS.includes(p),p);
assert.equal(classify([]).mode,'historical');
console.log('PASS: exact I1/I2/I2E/E2/E7/E8 product groups, source resolution, fact visibility, predecessor/idempotency, S4 read auth, unknown/authority/mixed change fail-closed. No historical qualification claimed.');
