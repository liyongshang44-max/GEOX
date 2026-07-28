#!/usr/bin/env node
'use strict';
const {createProducerV1}=require('./core_v1.cjs');
module.exports=createProducerV1({producerId:"mcft_cap08_s6_r2_retention_witness_v1",implementationStatus:"DEFERRED_BY_AUTHORITY",select(contract,source){return null;}});
