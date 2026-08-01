#!/usr/bin/env node
'use strict';
const {exactSuccessor,runFrozenOriginal}=require('./mcft_cap08_s4_t17_product_transition_successor_v1.cjs');
if(!exactSuccessor({schema_version:'geox_mcft_cap08_s6_run_a_qualification_composite_range_correction_result_v1',output:'acceptance-output/MCFT_CAP_08_S6_RUN_A_QUALIFICATION_COMPOSITE_RANGE_CORRECTION_RESULT.json'})){
  runFrozenOriginal('002425942671a34bdf112cbe94583d26afc8dcc6',__filename);
}
