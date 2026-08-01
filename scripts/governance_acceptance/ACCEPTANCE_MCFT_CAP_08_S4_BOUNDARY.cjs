#!/usr/bin/env node
'use strict';
const {exactSuccessor,runFrozenOriginal}=require('./mcft_cap08_s4_t17_product_transition_successor_v1.cjs');
if(!exactSuccessor({schema_version:'geox_mcft_cap08_s4_boundary_result_v1',output:'acceptance-output/MCFT_CAP_08_S4_BOUNDARY_RESULT.json'})){
  runFrozenOriginal('101ec82a436821231e1edb55e9d4fbd8e5c9e6c6',__filename);
}
