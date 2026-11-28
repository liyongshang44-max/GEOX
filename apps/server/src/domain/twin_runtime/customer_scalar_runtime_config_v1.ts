// Customer scalar parameter successor. Pure test-only contract; no production authority.
import { semanticHashV1 } from "./canonical_identity_v1.js";
import { formatFixedDecimalV1, parseFixedDecimalV1, multiplyFixedUnitsV1 } from "../soil_water/fixed_point_water_decimal_v1.js";
import type { HourlyWaterBalanceConfigV1 } from "../soil_water/hourly_water_balance_v1.js";
const scopeKeys = ["tenant_id","project_id","group_id","field_id","season_id","zone_id"] as const;
type TestParameter = { value: string; source_ref: string; definition: string };
export type CustomerScalarRuntimeConfigV1 = {
  schema_version: "mcft_customer_scalar_runtime_config_v1";
  test_only: true;
  scope: Record<typeof scopeKeys[number],string>;
  effective_from: string; effective_until: string;
  crop_stage_code: string; crop_context_ref: string; kc_decimal: string;
  support: { kind: "SINGLE_EFFECTIVE_ROOT_ZONE"; soil_type: string; support_ref: string };
  hydraulic: { root_depth_mm: TestParameter; field_capacity_fraction: TestParameter;
    wilting_point_fraction: TestParameter; saturation_fraction: TestParameter };
  dynamics: Omit<HourlyWaterBalanceConfigV1,"root_zone_depth_mm"|"wilting_point_storage_mm"|
    "field_capacity_storage_mm"|"saturation_storage_mm"|"saturation_fraction">;
  dynamics_source_ref: string;
  parameter_uncertainty: "UNKNOWN_NOT_PROPAGATED";
};
function testRef(v: unknown): asserts v is string {
  if (typeof v !== "string" || !v.startsWith("test:") || v.length <= 5) throw new Error("CUSTOMER_TEST_SOURCE_REF_REQUIRED");
}
function nonempty(v: unknown): asserts v is string {
  if (typeof v !== "string" || !v.trim()) throw new Error("CUSTOMER_CONFIG_METADATA_REQUIRED");
}
function canonicalTime(v: string) {
  if (typeof v !== "string" || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString() !== v)
    throw new Error("CUSTOMER_CONFIG_TIME_INVALID");
}
function decimal(v: unknown): bigint {
  if (typeof v !== "string" || !/^(0|[1-9][0-9]*)\.[0-9]{6}$/.test(v)) throw new Error("CUSTOMER_CONFIG_FIXED_DECIMAL_REQUIRED");
  return parseFixedDecimalV1(v,6);
}
function param(p: TestParameter): bigint {
  testRef(p?.source_ref); nonempty(p?.definition); return decimal(p.value);
}
export function validateCustomerScalarRuntimeConfigV1(input: CustomerScalarRuntimeConfigV1) {
  const c = structuredClone(input);
  if (c.schema_version !== "mcft_customer_scalar_runtime_config_v1" || c.test_only !== true ||
      c.parameter_uncertainty !== "UNKNOWN_NOT_PROPAGATED") throw new Error("CUSTOMER_CONFIG_TEST_ONLY_REQUIRED");
  if (Object.keys(c.scope).length !== scopeKeys.length) throw new Error("CUSTOMER_CONFIG_SCOPE_INVALID");
  for (const k of scopeKeys) nonempty(c.scope[k]);
  canonicalTime(c.effective_from); canonicalTime(c.effective_until);
  if (c.effective_from >= c.effective_until) throw new Error("CUSTOMER_CONFIG_TIME_INVALID");
  nonempty(c.crop_stage_code); testRef(c.crop_context_ref); decimal(c.kc_decimal);
  if (c.support.kind !== "SINGLE_EFFECTIVE_ROOT_ZONE") throw new Error("CUSTOMER_CONFIG_SUPPORT_UNPROVEN");
  nonempty(c.support.soil_type); testRef(c.support.support_ref); testRef(c.dynamics_source_ref);
  const depth=param(c.hydraulic.root_depth_mm), fc=param(c.hydraulic.field_capacity_fraction),
    pwp=param(c.hydraulic.wilting_point_fraction), sat=param(c.hydraulic.saturation_fraction);
  if (!(depth>0n && pwp<fc && fc<sat && sat<=1000000n)) throw new Error("CUSTOMER_CONFIG_HYDRAULIC_ORDER_INVALID");
  const storage=(theta:bigint)=>multiplyFixedUnitsV1(theta,6,depth,6,6);
  const w=storage(pwp), f=storage(fc), s=storage(sat);
  if (!(w<f && f<s)) throw new Error("CUSTOMER_CONFIG_STORAGE_PRECISION_INVALID");
  const dyn=c.dynamics;
  for(const k of ["runoff_fraction","drainage_coefficient_per_hour"] as const)
    if(decimal(dyn[k])>1000000n)throw new Error("CUSTOMER_CONFIG_DYNAMICS_RANGE_INVALID");
  for(const k of ["rainfall_relative_stddev","crop_et_relative_stddev","executed_irrigation_relative_stddev","structural_process_stddev_mm_per_hour"] as const)
    if(decimal(dyn[k])<=0n)throw new Error("CUSTOMER_CONFIG_UNCERTAINTY_MUST_BE_POSITIVE");
  const math_config:HourlyWaterBalanceConfigV1={
    runoff_fraction:dyn.runoff_fraction, drainage_coefficient_per_hour:dyn.drainage_coefficient_per_hour,
    rainfall_relative_stddev:dyn.rainfall_relative_stddev, crop_et_relative_stddev:dyn.crop_et_relative_stddev,
    executed_irrigation_relative_stddev:dyn.executed_irrigation_relative_stddev,
    structural_process_stddev_mm_per_hour:dyn.structural_process_stddev_mm_per_hour,
    root_zone_depth_mm:c.hydraulic.root_depth_mm.value, wilting_point_storage_mm:formatFixedDecimalV1(w,6),
    field_capacity_storage_mm:formatFixedDecimalV1(f,6), saturation_storage_mm:formatFixedDecimalV1(s,6),
    saturation_fraction:c.hydraulic.saturation_fraction.value,
  };
  return {config:c, math_config, config_hash:semanticHashV1(c)};
}
