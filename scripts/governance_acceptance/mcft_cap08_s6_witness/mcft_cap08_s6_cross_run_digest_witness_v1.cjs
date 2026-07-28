#!/usr/bin/env node
'use strict';
const {createProducerV1}=require('./core_v1.cjs');
module.exports=createProducerV1({producerId:"mcft_cap08_s6_cross_run_digest_witness_v1",implementationStatus:"DEFERRED_BY_AUTHORITY",select(contract,source){return null;}});
