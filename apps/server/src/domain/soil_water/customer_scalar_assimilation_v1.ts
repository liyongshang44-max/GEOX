// Test-only scalar successor. No point sensor is treated as root-zone mean.
import { semanticHashV1 } from "../twin_runtime/canonical_identity_v1.js";
import { validateCustomerScalarRuntimeConfigV1,type CustomerScalarRuntimeConfigV1 } from "../twin_runtime/customer_scalar_runtime_config_v1.js";
import { assimilateScalarGaussianV1 } from "./scalar_gaussian_assimilation_v1.js";
import type { executeCustomerHourlyWaterBalanceV1 } from "./hourly_water_balance_v1.js";
type Prior=ReturnType<typeof executeCustomerHourlyWaterBalanceV1>;
type Scope=CustomerScalarRuntimeConfigV1["scope"];
type AppliedStateV1={
  schema_version:"mcft_customer_assimilated_scalar_state_v1";test_only:true;formal_eligible:false;is_simulated:true;
  config_hash:string;scope:Scope;logical_time:string;prior_state_ref:string;observation_ref:string;binding_id:string;
  operator_id:"SYNTHETIC_ROOT_ZONE_MEAN_H1_V1";operator_source_ref:string;
  storage_mm:string;storage_variance_mm2:string;root_zone_vwc_fraction:number;
  assimilation:ReturnType<typeof assimilateScalarGaussianV1>;
  parameter_uncertainty:"UNKNOWN_NOT_PROPAGATED";state_ref:string;
};
export type CustomerScalarStateV1=Prior|AppliedStateV1;
function testRef(v:unknown):v is string{return typeof v==="string"&&v.startsWith("test:")&&v.length>5;}
function iso(v:string){return Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;}
export function readCustomerScalarStateV1(source:CustomerScalarStateV1,configHash:string){
  const {state_ref,...payload}=source;
  if(source.test_only!==true||source.formal_eligible!==false||source.is_simulated!==true||
      source.config_hash!==configHash||state_ref!=="test:"+semanticHashV1(payload)||!iso(source.logical_time))
    throw new Error("CUSTOMER_SCALAR_STATE_IDENTITY_MISMATCH");
  if(source.schema_version==="mcft_customer_hourly_water_balance_result_v1")
    return {state_ref,logical_time:source.logical_time,state_kind:"PRIOR_DRIVEN_NO_ASSIMILATION" as const,
      storage_mm:source.published_state.root_zone_storage_mm.mean,storage_variance_mm2:source.uncertainty_budget.next_storage_variance_mm2};
  if(source.schema_version!=="mcft_customer_assimilated_scalar_state_v1")throw new Error("CUSTOMER_SCALAR_STATE_KIND_INVALID");
  return {state_ref,logical_time:source.logical_time,state_kind:"SYNTHETIC_ROOT_ZONE_MEAN_ASSIMILATED" as const,storage_mm:source.storage_mm,storage_variance_mm2:source.storage_variance_mm2};
}
export type CustomerScalarObservationV1={
  test_only:true; scope:Scope; source_record_id:string; binding_id:string; observed_at:string; available_at:string;
  value_fraction:number; quality_status:"PASS"|"LIMITED"|"FAIL";
  support:{kind:"POINT_SUPPORT";measurement_depth_mm:number}|{kind:"SYNTHETIC_ROOT_ZONE_MEAN";root_zone_depth_mm:string;support_ref:string};
};
export type SyntheticRootZoneOperatorV1={
  test_only:true;kind:"SYNTHETIC_ROOT_ZONE_MEAN_H1_V1";binding_id:string;support_ref:string;
  observation_variance:number;variance_source_ref:string;effective_from:string;effective_until:string;
};
export function assimilateCustomerScalarTestV1(input:{customer_config:CustomerScalarRuntimeConfigV1;prior:Prior;observation:CustomerScalarObservationV1;operator?:SyntheticRootZoneOperatorV1}){
  const {config,math_config,config_hash}=validateCustomerScalarRuntimeConfigV1(input.customer_config);
  const prior=readCustomerScalarStateV1(input.prior,config_hash),o=input.observation,op=input.operator;
  const no=(reason:string)=>({status:"NO_USABLE_OBSERVATION" as const,reason,observation_ref:o.source_record_id,prior_state_ref:prior.state_ref,applied_state:null});
  if(o.test_only!==true||!testRef(o.source_record_id)||!testRef(o.binding_id)||
      Object.keys(config.scope).some(k=>o.scope[k as keyof Scope]!==config.scope[k as keyof Scope]))return no("CUSTOMER_OBSERVATION_SCOPE_OR_SOURCE_INVALID");
  if(!iso(o.observed_at)||!iso(o.available_at)||o.available_at<o.observed_at||o.available_at>prior.logical_time||
      o.observed_at>prior.logical_time||Date.parse(prior.logical_time)-Date.parse(o.observed_at)>900000)
    return no("CUSTOMER_OBSERVATION_TIME_INVALID");
  if(o.quality_status!=="PASS"||!Number.isFinite(o.value_fraction)||o.value_fraction<0||
      o.value_fraction>Number(math_config.saturation_fraction))return no("CUSTOMER_OBSERVATION_QUALITY_OR_VALUE_LIMITED");
  // Only a deliberately generated full-root-zone mean may use H=1 in this test lane.
  if(o.support.kind!=="SYNTHETIC_ROOT_ZONE_MEAN")return no("POINT_TO_ROOT_ZONE_MAPPING_NOT_ESTABLISHED");
  if(!op||op.test_only!==true||op.kind!=="SYNTHETIC_ROOT_ZONE_MEAN_H1_V1"||op.binding_id!==o.binding_id||
      !testRef(op.support_ref)||op.support_ref!==o.support.support_ref||op.support_ref!==config.support.support_ref||
      o.support.root_zone_depth_mm!==math_config.root_zone_depth_mm||!testRef(op.variance_source_ref)||
      !Number.isFinite(op.observation_variance)||op.observation_variance<=0||!iso(op.effective_from)||!iso(op.effective_until)||
      op.effective_from>o.observed_at||op.effective_until<=prior.logical_time)
    return no("CUSTOMER_SYNTHETIC_OPERATOR_NOT_AUTHORIZED");
  const depth=Number(math_config.root_zone_depth_mm),mean=Number(prior.storage_mm)/depth,variance=Number(prior.storage_variance_mm2)/depth**2;
  const update=assimilateScalarGaussianV1({prior_mean:mean,prior_variance:variance,observation:o.value_fraction,observation_variance:op.observation_variance,observation_operator_h:1});
  // Same innovation rule as historical CAP03, test-only number evaluation; no calibrated threshold claim.
  if(update.innovation**2>16*(variance+op.observation_variance))return no("CUSTOMER_TEST_INNOVATION_OUTLIER");
  if(update.posterior_mean<0||update.posterior_mean>Number(math_config.saturation_fraction)||update.posterior_variance<=0)
    return no("CUSTOMER_TEST_POSTERIOR_OUT_OF_BOUNDS");
  const storage= (update.posterior_mean*depth).toFixed(6),storageVariance=(update.posterior_variance*depth**2).toFixed(12);
  if(Number(storageVariance)<=0)return no("CUSTOMER_TEST_POSTERIOR_VARIANCE_PRECISION");
  const state:Omit<AppliedStateV1,"state_ref">={
    schema_version:"mcft_customer_assimilated_scalar_state_v1",test_only:true,formal_eligible:false,is_simulated:true,
    config_hash,scope:config.scope,logical_time:prior.logical_time,prior_state_ref:prior.state_ref,
    observation_ref:o.source_record_id,binding_id:o.binding_id,operator_id:op.kind,operator_source_ref:op.variance_source_ref,
    storage_mm:storage,storage_variance_mm2:storageVariance,root_zone_vwc_fraction:update.posterior_mean,
    assimilation:update,parameter_uncertainty:config.parameter_uncertainty};
  const applied_state:AppliedStateV1={...state,state_ref:"test:"+semanticHashV1(state)};
  return {status:"APPLIED_SYNTHETIC_ROOT_ZONE_MEAN" as const,reason:null,observation_ref:o.source_record_id,prior_state_ref:prior.state_ref,applied_state};
}
