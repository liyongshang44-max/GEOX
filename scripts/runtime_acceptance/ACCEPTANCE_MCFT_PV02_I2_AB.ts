import assert from "node:assert/strict";
import { mkdirSync,writeFileSync } from "node:fs";
import { assimilateCustomerScalarTestV1,type CustomerScalarObservationV1,type SyntheticRootZoneOperatorV1 } from "../../apps/server/src/domain/soil_water/customer_scalar_assimilation_v1.js";
import { executeCustomerPure72hForecastV1,type CustomerForecastForcingPointV1 } from "../../apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.js";
import { validateCustomerScalarRuntimeConfigV1,type CustomerScalarRuntimeConfigV1 } from "../../apps/server/src/domain/twin_runtime/customer_scalar_runtime_config_v1.js";
import { executeCustomerHourlyWaterBalanceV1,executeHourlyWaterBalanceV1,type CustomerHourlyWaterBalanceInputV1 } from "../../apps/server/src/domain/soil_water/hourly_water_balance_v1.js";
const start="2026-11-01T00:00:00.000Z",end="2026-11-01T01:00:00.000Z";
const param=(value:string,definition:string)=>({value,definition,source_ref:"test:controlled-fixture-"+definition});
const make=(depth:string,fc:string,pwp:string,sat:string):CustomerScalarRuntimeConfigV1=>({
  schema_version:"mcft_customer_scalar_runtime_config_v1",test_only:true,
  scope:{tenant_id:"test-tenant",project_id:"test-project",group_id:"test-group",field_id:"test-field",season_id:"test-season",zone_id:"test-zone"},
  effective_from:start,effective_until:"2026-11-01T03:00:00.000Z",
  crop_stage_code:"TEST_STAGE",crop_context_ref:"test:crop",kc_decimal:"1.000000",
  support:{kind:"SINGLE_EFFECTIVE_ROOT_ZONE",soil_type:"synthetic-homogeneous",support_ref:"test:root-support"},
  hydraulic:{root_depth_mm:param(depth,"effective-root-depth-mm"),field_capacity_fraction:param(fc,"fc-fraction"),wilting_point_fraction:param(pwp,"pwp-fraction"),saturation_fraction:param(sat,"saturation-fraction")},
  dynamics:{runoff_fraction:"0.100000",drainage_coefficient_per_hour:"0.200000",structural_process_stddev_mm_per_hour:"0.100000",rainfall_relative_stddev:"0.100000",crop_et_relative_stddev:"0.100000",executed_irrigation_relative_stddev:"0.100000"},
  dynamics_source_ref:"test:controlled-process-assumptions",parameter_uncertainty:"UNKNOWN_NOT_PROPAGATED"
});
function input(c:CustomerScalarRuntimeConfigV1,storage:string):CustomerHourlyWaterBalanceInputV1{
  return {customer_config:c,previous:{config_hash:validateCustomerScalarRuntimeConfigV1(c).config_hash,logical_time:start,state_ref:"test:initial-state",storage_mm:storage,storage_variance_mm2:"1.000000000000"},
    interval_start_exclusive:start,interval_end_inclusive:end,gross_rainfall_mm_decimal:"10.000000",historical_et0_mm_decimal:"1.000000",crop_stage_code:c.crop_stage_code,kc_decimal:c.kc_decimal,
    rainfall_source_ref:"test:rain",et0_source_ref:"test:et0",irrigation_zero_source_ref:"test:known-zero-irrigation"};
}
const a=make("400.000000","0.280000","0.100000","0.440000"),b=make("600.000000","0.320000","0.140000","0.460000");
const ia=input(a,"120.000000"),ib=input(b,"180.000000");
const ra=executeCustomerHourlyWaterBalanceV1(ia),rb=executeCustomerHourlyWaterBalanceV1(ib);
assert.equal(ra.published_state.root_zone_storage_mm.mean,"124.800000");
assert.equal(rb.published_state.root_zone_storage_mm.mean,"188.000000");
assert.equal(ra.published_state.root_zone_vwc_fraction.mean,"0.312000");
assert.equal(rb.published_state.root_zone_vwc_fraction.mean,"0.313333");
for(const r of [ra,rb]){assert.equal(r.mass_balance_trace.mass_balance_error_mm,"0.000000");assert.equal(r.formal_eligible,false);assert.equal(r.parameter_uncertainty,"UNKNOWN_NOT_PROPAGATED");assert.ok(Number(r.uncertainty_budget.next_storage_variance_mm2)>1);}
assert.equal(ra.computation_basis.root_zone_depth_mm,"400.000000");assert.equal(rb.computation_basis.root_zone_depth_mm,"600.000000");
assert.deepEqual(ra,executeCustomerHourlyWaterBalanceV1(ia));
assert.notEqual(ra.config_hash,rb.config_hash);
const next=executeCustomerHourlyWaterBalanceV1({...ia,interval_start_exclusive:end,interval_end_inclusive:"2026-11-01T02:00:00.000Z",previous:{config_hash:ra.config_hash,logical_time:end,state_ref:ra.state_ref,storage_mm:ra.published_state.root_zone_storage_mm.mean,storage_variance_mm2:ra.uncertainty_budget.next_storage_variance_mm2}});
assert.equal(next.computation_basis.previous_storage_mean_mm_decimal.value,"124.800000");
assert.throws(()=>validateCustomerScalarRuntimeConfigV1(make("400.000000","0.100000","0.280000","0.440000")),/HYDRAULIC_ORDER/);
assert.throws(()=>validateCustomerScalarRuntimeConfigV1(make("0.000000","0.280000","0.100000","0.440000")),/HYDRAULIC_ORDER/);
assert.throws(()=>executeCustomerHourlyWaterBalanceV1({...ia,previous:{...ia.previous,config_hash:rb.config_hash}}),/PREVIOUS_STATE_CONFIG/);
assert.throws(()=>executeCustomerHourlyWaterBalanceV1({...ia,irrigation_zero_source_ref:""}),/TEST_SOURCE_REF/);
assert.throws(()=>executeCustomerHourlyWaterBalanceV1({...ia,interval_end_inclusive:"2026-11-01T02:00:00.000Z"}),/INTERVAL_INVALID/);
const legacy=make("300.000000","0.300000","0.120000","0.450000"),il=input(legacy,"90.000000");
const old=executeHourlyWaterBalanceV1({config:validateCustomerScalarRuntimeConfigV1(legacy).math_config,interval_start_exclusive:start,interval_end_inclusive:end,previous_storage_mm_decimal:il.previous.storage_mm,previous_variance_basis:{basis_origin:"CARRIED_FROM_PREVIOUS_CONTINUATION_STATE",previous_state_ref:il.previous.state_ref,previous_storage_variance_mm2_decimal:il.previous.storage_variance_mm2},gross_rainfall_mm_decimal:il.gross_rainfall_mm_decimal,historical_et0_mm_decimal:il.historical_et0_mm_decimal,crop_stage_code:il.crop_stage_code,kc_decimal:il.kc_decimal,executed_irrigation_candidates:[]});
const same=executeCustomerHourlyWaterBalanceV1(il);
assert.deepEqual(same.published_state,old.published_state);assert.deepEqual(same.mass_balance_trace,old.mass_balance_trace);assert.deepEqual(same.uncertainty_budget,old.uncertainty_budget);

// Distinct synthetic full-root-zone mean case, NOT the I1 150 mm point.
const fcConfig={...a,effective_until:"2026-11-05T00:00:00.000Z"};
const prior=executeCustomerHourlyWaterBalanceV1(input(fcConfig,"120.000000"));
const obs:CustomerScalarObservationV1={test_only:true,scope:fcConfig.scope,source_record_id:"test:root-mean-001",binding_id:"test:customer-binding-001",
  observed_at:end,available_at:end,value_fraction:0.313,quality_status:"PASS",support:{kind:"SYNTHETIC_ROOT_ZONE_MEAN",root_zone_depth_mm:"400.000000",support_ref:fcConfig.support.support_ref}};
const operator:SyntheticRootZoneOperatorV1={test_only:true,kind:"SYNTHETIC_ROOT_ZONE_MEAN_H1_V1",binding_id:obs.binding_id,support_ref:fcConfig.support.support_ref,
  observation_variance:0.0001,variance_source_ref:"test:controlled-root-mean-variance",effective_from:start,effective_until:fcConfig.effective_until};
const point=assimilateCustomerScalarTestV1({customer_config:fcConfig,prior,observation:{...obs,support:{kind:"POINT_SUPPORT",measurement_depth_mm:150}},operator});
assert.equal(point.reason,"POINT_TO_ROOT_ZONE_MAPPING_NOT_ESTABLISHED");assert.equal(point.applied_state,null);
const invalid=assimilateCustomerScalarTestV1({customer_config:fcConfig,prior,observation:obs,operator:{...operator,binding_id:"test:other"}});
assert.equal(invalid.applied_state,null);
const update=assimilateCustomerScalarTestV1({customer_config:fcConfig,prior,observation:obs,operator});
assert.equal(update.status,"APPLIED_SYNTHETIC_ROOT_ZONE_MEAN");assert.ok(update.applied_state);
assert.ok(update.applied_state.root_zone_vwc_fraction>0.312&&update.applied_state.root_zone_vwc_fraction<0.313);
assert.ok(Number(update.applied_state.storage_variance_mm2)<Number(prior.uncertainty_budget.next_storage_variance_mm2));
const forcing:CustomerForecastForcingPointV1[]=Array.from({length:72},(_,i)=>({
  horizon_hour:i+1,interval_start:new Date(Date.parse(end)+i*3600000).toISOString(),
  interval_end:new Date(Date.parse(end)+(i+1)*3600000).toISOString(),target_time:new Date(Date.parse(end)+(i+1)*3600000).toISOString(),
  precipitation_assumption_mm:i===5?"5.000000":"0.000000",et0_assumption_mm:"0.100000",crop_stage_code:fcConfig.crop_stage_code,kc:fcConfig.kc_decimal,
  weather_source_ref:"test:forecast-rain-"+i,et0_source_ref:"test:forecast-et0-"+i,issued_at:end,available_at:end}));
const predicted=executeCustomerPure72hForecastV1({customer_config:fcConfig,source:update.applied_state,forcing});
const openLoop=executeCustomerPure72hForecastV1({customer_config:fcConfig,source:prior,forcing});
assert.equal(predicted.points.length,72);assert.equal(openLoop.points.length,72);
assert.equal(predicted.source_state_kind,"SYNTHETIC_ROOT_ZONE_MEAN_ASSIMILATED");assert.equal(openLoop.source_state_kind,"PRIOR_DRIVEN_NO_ASSIMILATION");
for(const r of [predicted,openLoop]){assert.ok(r.points.every(p=>p.mass_balance_error_mm==="0.000000"));assert.equal(r.formal_eligible,false);}
assert.deepEqual(predicted,executeCustomerPure72hForecastV1({customer_config:fcConfig,source:update.applied_state,forcing}));
assert.throws(()=>executeCustomerPure72hForecastV1({customer_config:fcConfig,source:prior,forcing:forcing.slice(1)}),/EXACT_72_POINTS/);
assert.throws(()=>executeCustomerPure72hForecastV1({customer_config:fcConfig,source:prior,forcing:forcing.map((p,i)=>i===0?{...p,available_at:"2026-11-01T01:01:00.000Z"}:p)}),/FUTURE_KNOWLEDGE/);
assert.throws(()=>executeCustomerPure72hForecastV1({customer_config:fcConfig,source:prior,forcing:forcing.map((p,i)=>i===0?{...p,target_time:p.interval_start}:p)}),/FORCING_TIME_MISMATCH/);

mkdirSync("acceptance-output",{recursive:true});
const receipt={status:"PASS",test_only:true,production:false,model:"CUSTOMER_SCALAR_V1",results:[ra,rb],continuation:next,legacy_numerical_equivalence:true,negative_cases:5,customer_assimilation:{point,invalid,update},customer_forecast:{predicted,open_loop:openLoop},forecast_negative_cases:3};
writeFileSync("acceptance-output/MCFT_PV02_I2_AB.json",JSON.stringify(receipt,null,2)+"\n");
console.log(JSON.stringify({status:receipt.status,test_only:true,results:receipt.results,continuation:receipt.continuation,legacy_numerical_equivalence:true,negative_cases:5,customer_assimilation:receipt.customer_assimilation,
forecast_summary:{predicted:{count:predicted.points.length,first:predicted.points[0],last:predicted.points[71],aggregates:predicted.aggregates,hash:predicted.forecast_hash},open_loop:{count:openLoop.points.length,first:openLoop.points[0],last:openLoop.points[71],aggregates:openLoop.aggregates,hash:openLoop.forecast_hash}},forecast_negative_cases:3}));
