#!/usr/bin/env node
'use strict';
const {exactSuccessor,runFrozenOriginal}=require('./mcft_cap08_s4_t17_product_transition_successor_v1.cjs');
if(!exactSuccessor({schema_version:'geox_mcft_cap08_s6_exact_database_port_bundle_implementation_result_v1',output:'acceptance-output/MCFT_CAP_08_S6_EXACT_DATABASE_PORT_BUNDLE_IMPLEMENTATION_RESULT.json'})){
  runFrozenOriginal('682e0a1e5646da91bf0483ad5862eaf6b4a4955c',__filename);
}
