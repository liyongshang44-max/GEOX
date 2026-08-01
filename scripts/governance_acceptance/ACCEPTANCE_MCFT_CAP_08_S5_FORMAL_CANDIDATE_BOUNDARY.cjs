#!/usr/bin/env node
'use strict';
const {exactSuccessor,runFrozenOriginal}=require('./mcft_cap08_s4_t17_product_transition_successor_v1.cjs');
if(!exactSuccessor({schema_version:'geox_mcft_cap08_s5_formal_candidate_boundary_result_v1',output:'acceptance-output/MCFT_CAP_08_S5_FORMAL_CANDIDATE_BOUNDARY_RESULT.json'})){
  runFrozenOriginal('ac2551b5bba65f1be6939ce9fc63c43149bb995c',__filename);
}
