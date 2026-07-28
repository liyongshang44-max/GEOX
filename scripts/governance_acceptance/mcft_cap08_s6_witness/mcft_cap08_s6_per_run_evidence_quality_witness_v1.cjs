#!/usr/bin/env node
'use strict';
const {createProducerV1}=require('./core_v1.cjs');
module.exports=createProducerV1({producerId:"mcft_cap08_s6_per_run_evidence_quality_witness_v1",implementationStatus:"IMPLEMENTED",select(contract,source){const e=source.evidence_quality;return{limited_quality_downweight_applied:e.limited_quality_downweight_applied,limited_quality_gain_less_than_full_quality:e.limited_gain<e.full_gain,t04_selected_observation_ref:e.t04_selected_observation_ref,competing_invalid_candidates_selected_count:e.competing_invalid_candidates_selected_count,invalid_candidate_write_delta:e.invalid_candidate_write_delta};}});
