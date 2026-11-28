// Isolated customer composition. Uses I1 and I2 native functions, not acceptance programs.
// No scheduler, writer, production promotion, or historical canonical record impersonation.
import type { Pool } from "pg";
import { freezeCustomerSoilEvidenceV1,type CustomerSoilMeasurementBindingV1 } from "./customer_soil_evidence_ingress_v1.js";
import type { ShadowOnlineBoundaryV1 } from "./ports.js";
import { validateCustomerScalarRuntimeConfigV1,type CustomerScalarRuntimeConfigV1 } from "../../domain/twin_runtime/customer_scalar_runtime_config_v1.js";
import { buildBootstrapWaterPriorV1 } from "../../domain/soil_water/bootstrap_water_prior_v1.js";
import { executeCustomerHourlyWaterBalanceV1 } from "../../domain/soil_water/hourly_water_balance_v1.js";
import { readCustomerScalarStateV1,assimilateCustomerScalarTestV1,type CustomerScalarStateV1,type CustomerScalarObservationV1,type SyntheticRootZoneOperatorV1 } from "../../domain/soil_water/customer_scalar_assimilation_v1.js";
import { executeCustomerPure72hForecastV1,type CustomerForecastForcingPointV1 } from "../../domain/twin_runtime/pure_72h_forecast_math_v1.js";
import { semanticHashV1 } from "../../domain/twin_runtime/canonical_identity_v1.js";
import { resolveCustomerNativeParameterSourcesV1 } from "./customer_native_parameter_source_resolver_v1.js";
type HistoricalForcingV1={interval_start:string;interval_end:string;available_at:string;
  rainfall_mm:string;et0_mm:string;rainfall_source_ref:string;et0_source_ref:string;irrigation_zero_source_ref:string};
type Inputs={
  pool:Pool; boundary:ShadowOnlineBoundaryV1;
  bindings:readonly CustomerSoilMeasurementBindingV1[];
  customer_config:CustomerScalarRuntimeConfigV1;
  initialization:{kind:"WEAK_BOOTSTRAP"}|{kind:"CONTINUATION";previous:CustomerScalarStateV1};
  historical:HistoricalForcingV1;
  future:readonly CustomerForecastForcingPointV1[];
  synthetic_root_mean?:{observation:CustomerScalarObservationV1;operator:SyntheticRootZoneOperatorV1};
};
function iso(t:string){return typeof t==="string"&&Number.isFinite(Date.parse(t))&&new Date(t).toISOString()===t;}
function sameScope(a:Record<string,unknown>,b:Record<string,unknown>){
  return ["tenant_id","project_id","group_id","field_id","season_id","zone_id"].every(k=>typeof a[k]==="string"&&a[k]===b[k]);
}
export async function composeCustomerNativeRuntimeV1(input:Inputs){
  const {config,config_hash,math_config}=validateCustomerScalarRuntimeConfigV1(input.customer_config);
  const end=input.boundary.logical_time;
  if(!iso(end)||!end.endsWith(":00:00.000Z")||input.boundary.interval_seconds!==3600||
      !sameScope(config.scope,input.boundary.scope))throw Error("CUSTOMER_COMPOSER_SCOPE_OR_BOUNDARY_INVALID");
  const start=new Date(Date.parse(end)-3600000).toISOString();
  const h=input.historical;
  if(h.interval_start!==start||h.interval_end!==end||!iso(h.available_at)||h.available_at<end||h.available_at>end)
    throw Error("CUSTOMER_COMPOSER_HISTORICAL_FORCING_TIME_INVALID");
  for(const v of [h.rainfall_mm,h.et0_mm])if(typeof v!=="string"||!/^(0|[1-9][0-9]*)\.[0-9]{6}$/.test(v))
    throw Error("CUSTOMER_COMPOSER_HISTORICAL_FORCING_MISSING");
  const parameter_source_resolution=await resolveCustomerNativeParameterSourcesV1({pool:input.pool,scope:config.scope,logical_time:end,bindings:input.bindings});
  const evidence=await freezeCustomerSoilEvidenceV1({pool:input.pool,boundary:input.boundary,bindings:input.bindings,test_only:true});
  const retained=evidence.records.map(r=>{
    if(!r||r.is_simulated!==true||r.formal_eligible!==false||!sameScope(config.scope,r))throw Error("CUSTOMER_COMPOSER_EVIDENCE_SCOPE_INVALID");
    const p=r.canonical_payload as Record<string,unknown>;
    if(p.spatial_support!=="POINT_SUPPORT"||p.direct_root_zone_equivalence!==false)throw Error("CUSTOMER_COMPOSER_POINT_CONTRACT_INVALID");
    return {source_record_id:r.source_record_id,source_record_hash:r.source_record_hash,binding_id:r.binding_id,
      value_fraction:p.value,measurement_depth_mm:p.measurement_depth_mm,quality:r.quality,role_time:r.role_time,
      source_payload:r.source_payload,disposition:"RETAINED_NOT_ROOT_ZONE_ASSIMILATED" as const,
      reason:"POINT_TO_ROOT_ZONE_MAPPING_NOT_ESTABLISHED"};
  });
  let previous:{config_hash:string;logical_time:string;state_ref:string;storage_mm:string;storage_variance_mm2:string};
  let initialization;
  if(input.initialization.kind==="CONTINUATION"){
    const p=input.initialization.previous;
    if(!sameScope(config.scope,p.scope))throw Error("CUSTOMER_COMPOSER_PREVIOUS_SCOPE_INVALID");
    const s=readCustomerScalarStateV1(p,config_hash);
    if(s.logical_time!==start)throw Error("CUSTOMER_COMPOSER_PREVIOUS_TIME_MISMATCH");
    previous={config_hash,logical_time:start,state_ref:s.state_ref,storage_mm:s.storage_mm,storage_variance_mm2:s.storage_variance_mm2};
    initialization={kind:"EXACT_PREVIOUS_COMPUTED_STATE",previous_ref:s.state_ref};
  }else{
    const depth=Number(math_config.root_zone_depth_mm);
    const prior=buildBootstrapWaterPriorV1({root_zone_depth_mm:depth,
      field_capacity_fraction:Number(config.hydraulic.field_capacity_fraction.value),
      wilting_point_fraction:Number(config.hydraulic.wilting_point_fraction.value),
      saturation_fraction:Number(config.hydraulic.saturation_fraction.value)});
    initialization={kind:"WEAK_BOOTSTRAP_NOT_OBSERVED",scope:config.scope,config_hash,logical_time:start,prior};
    previous={config_hash,logical_time:start,state_ref:"test:"+semanticHashV1(initialization),
      storage_mm:(prior.mean*depth).toFixed(6),storage_variance_mm2:(prior.variance*depth**2).toFixed(12)};
  }
  const propagated=executeCustomerHourlyWaterBalanceV1({customer_config:config,previous,
    interval_start_exclusive:start,interval_end_inclusive:end,gross_rainfall_mm_decimal:h.rainfall_mm,
    historical_et0_mm_decimal:h.et0_mm,crop_stage_code:config.crop_stage_code,kc_decimal:config.kc_decimal,
    rainfall_source_ref:h.rainfall_source_ref,et0_source_ref:h.et0_source_ref,irrigation_zero_source_ref:h.irrigation_zero_source_ref});
  const update=input.synthetic_root_mean?assimilateCustomerScalarTestV1({customer_config:config,prior:propagated,...input.synthetic_root_mean}):null;
  if(input.synthetic_root_mean&&!update?.applied_state)throw Error("CUSTOMER_COMPOSER_SYNTHETIC_UPDATE_NOT_APPLIED");
  const selected:CustomerScalarStateV1=update?.applied_state??propagated;
  const forecast=executeCustomerPure72hForecastV1({customer_config:config,source:selected,forcing:input.future});
  const result={schema_version:"mcft_customer_native_runtime_composition_v1" as const,test_only:true as const,
    production:false as const,formal_eligible:false as const,scope:config.scope,config_hash,logical_time:end,
    initialization,previous,parameter_source_resolution,retained_observations:retained,excluded_observations:evidence.rejected,
    selected_evidence_refs:evidence.frozen.selected.map(r=>r.evidence_ref),
    propagated,assimilation:update,state:selected,forecast,
    persistence_status:"NOT_PERSISTED_BY_COMPOSER" as const,
    product_read_status:"NOT_READ_BY_COMPOSER" as const,
    limitations:["TEST_PARAMETER_SOURCES_ONLY","CUSTOMER_PARAMETER_SOURCES_INCOMPLETE","POINT_SUPPORT_NOT_ROOT_ZONE","PARAMETER_UNCERTAINTY_NOT_PROPAGATED","LEGACY_ET_STORAGE_LIMIT_ONLY","NO_PRODUCTION_OR_ACTION_AUTHORITY"]};
  return {...result,composition_hash:semanticHashV1(result)};
}
