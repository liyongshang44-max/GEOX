'use strict';
const assert=require('node:assert/strict');
const {invokePerRunWitnessesV1}=require('../mcft_cap08_s6_final_formal_run/witness_invocation_v1.cjs');
function producePerRunWitnessBundleV1({spec,source,artifactRef,artifactDigest,synthetic=false}){const bundle=invokePerRunWitnessesV1({plan:spec,source,artifactRef,artifactDigest,synthetic});assert.equal(bundle.witness_count,22);assert.equal(bundle.object_set_count,22);if(synthetic){assert.equal(bundle.hard_acceptance_eligible,false);assert.ok(bundle.witnesses.every(w=>w.status==='CONTRACT_TEST_PASS'&&w.hard_acceptance_eligible===false));}return bundle;}
module.exports={producePerRunWitnessBundleV1};
