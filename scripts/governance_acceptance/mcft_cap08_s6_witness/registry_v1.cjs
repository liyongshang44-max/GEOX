#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const MODULES=[
 require('./mcft_cap08_s6_cross_run_digest_witness_v1.cjs'),
 require('./mcft_cap08_s6_per_run_contiguous_sequence_witness_v1.cjs'),
 require('./mcft_cap08_s6_per_run_state_chain_witness_v1.cjs'),
 require('./mcft_cap08_s6_per_run_state_transition_witness_v1.cjs'),
 require('./mcft_cap08_s6_per_run_evidence_quality_witness_v1.cjs'),
 require('./mcft_cap08_s6_per_run_forecast_witness_v1.cjs'),
 require('./mcft_cap08_s6_per_run_scenario_witness_v1.cjs'),
 require('./mcft_cap08_s6_per_run_decision_action_witness_v1.cjs'),
 require('./mcft_cap08_s6_per_run_phase_order_witness_v1.cjs'),
 require('./mcft_cap08_s6_per_run_recovery_fault_witness_v1.cjs'),
 require('./mcft_cap08_s6_per_run_late_append_forward_witness_v1.cjs'),
 require('./mcft_cap08_s6_per_run_residual_phase_witness_v1.cjs'),
 require('./mcft_cap08_s6_per_run_residual_set_witness_v1.cjs'),
 require('./mcft_cap08_s6_per_run_calibration_partition_witness_v1.cjs'),
 require('./mcft_cap08_s6_per_run_candidate_nonconsumption_witness_v1.cjs'),
 require('./mcft_cap08_s6_per_run_shadow_nonconsumption_witness_v1.cjs'),
 require('./mcft_cap08_s6_per_run_read_model_witness_v1.cjs'),
 require('./mcft_cap08_s6_merge_tree_witness_v1.cjs'),
 require('./mcft_cap08_s6_r2_retention_witness_v1.cjs'),
];
function loadProducerRegistryV1(catalog){const byId={};for(const p of MODULES){assert.equal(byId[p.producer_id],undefined,`DUPLICATE_PRODUCER:${p.producer_id}`);byId[p.producer_id]=p;}assert.deepEqual(Object.keys(byId).sort(),catalog.producerIds,'PRODUCER_SET_NOT_EXACT');return Object.freeze(byId);}
module.exports={loadProducerRegistryV1};
