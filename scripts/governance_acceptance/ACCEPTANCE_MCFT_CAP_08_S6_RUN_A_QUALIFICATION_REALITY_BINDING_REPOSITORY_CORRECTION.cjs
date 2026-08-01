#!/usr/bin/env node
'use strict';
const {exactSuccessor,runFrozenOriginal}=require('./mcft_cap08_s4_t17_product_transition_successor_v1.cjs');
if(!exactSuccessor({schema_version:'geox_mcft_cap08_s6_run_a_qualification_reality_binding_repository_correction_result_v1',output:'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_REALITY_BINDING_REPOSITORY_CORRECTION_RESULT.json'})){
  runFrozenOriginal('adb545b88ef8e14769d8e8a3ad845d66f009b21a',__filename);
}
