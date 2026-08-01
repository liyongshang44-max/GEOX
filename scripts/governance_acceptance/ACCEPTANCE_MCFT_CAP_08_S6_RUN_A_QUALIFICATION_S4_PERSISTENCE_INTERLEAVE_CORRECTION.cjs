#!/usr/bin/env node
'use strict';
const {exactSuccessor,runFrozenOriginal}=require('./mcft_cap08_s4_t17_product_transition_successor_v1.cjs');
if(!exactSuccessor({schema_version:'geox_mcft_cap08_s6_run_a_qualification_s4_persistence_interleave_correction_result_v1',output:'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_S4_PERSISTENCE_INTERLEAVE_CORRECTION_RESULT.json'})){
  runFrozenOriginal('bfa1ce48b7a7b6b561b990b5e70d39367207d5bb',__filename);
}
