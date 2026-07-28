'use strict';
const assert=require('node:assert/strict');
const {member}=require('./shared_v1.cjs');
function exactMembers(result,s4){
  return result.range.tick_results.map((tick,index)=>{
    const corrected=index===16;
    return{
      tick,
      index,
      tickObject:corrected?s4.corrected_set.tick:member(tick.a_record_set,'twin_runtime_tick_v1'),
      state:corrected?s4.corrected_set.state:member(tick.a_record_set,'twin_state_estimate_v1'),
      forecast:corrected?s4.corrected_set.forecast:member(tick.a_record_set,'twin_forecast_run_v1'),
      scenario:corrected?s4.corrected_set.scenario:tick.b_record.scenario_set,
    };
  });
}

function decimalText(value,code){
  const raw=value&&typeof value==='object'&&!Array.isArray(value)?value.value:value;
  if(typeof raw!=='string'||!raw.trim())throw new Error(code);
  return raw;
}

function correctedT17Handoff(base,s4){
  const state=s4.corrected_set.state;
  const payload=state.payload;
  const vwc=payload.root_zone_vwc_fraction;
  const computation=payload.computation_basis;
  assert.ok(vwc&&typeof vwc==='object'&&!Array.isArray(vwc),'S4_CORRECTED_VWC_REQUIRED');
  assert.ok(computation&&typeof computation==='object'&&!Array.isArray(computation),'S4_CORRECTED_COMPUTATION_REQUIRED');
  return{
    ...base,
    ...s4.t17_predecessor,
    active_lineage_ref:base.active_lineage_ref,
    lineage_id:state.lineage_id,
    revision_id:state.revision_id,
    prior_mean:Number(vwc.mean),
    prior_variance:Number(vwc.variance),
    previous_storage_mm_decimal:decimalText(computation.storage_mean_mm_decimal,'S4_CORRECTED_STORAGE_REQUIRED'),
    previous_variance_basis:{
      basis_origin:'CARRIED_FROM_PREVIOUS_CONTINUATION_STATE',
      previous_state_ref:state.object_id,
      previous_storage_variance_mm2_decimal:decimalText(
        computation.storage_variance_mm2_decimal,
        'S4_CORRECTED_STORAGE_VARIANCE_REQUIRED',
      ),
    },
    previous_state_runtime_config_ref:state.runtime_config_ref,
    previous_state_runtime_config_hash:state.runtime_config_hash,
    reality_binding_ref:base.reality_binding_ref,
    reality_binding_hash:base.reality_binding_hash,
  };
}

module.exports={exactMembers,correctedT17Handoff};
