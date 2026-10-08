import type {
  FieldTwinCanonicalObjectRefV1,
  FieldTwinScopeV1,
} from "../../domain/field_twin_read_model/index.js";

export const CUSTOMER_PRODUCT_CURRENT_RUNTIME_SOURCE_PROFILES_V1 = [
  "MCFT_CAP07_S4",
  "MCFT_FORMAL_V5_EXACT",
] as const;

export type CustomerProductCurrentRuntimeSourceProfileV1 =
  (typeof CUSTOMER_PRODUCT_CURRENT_RUNTIME_SOURCE_PROFILES_V1)[number];

export type CustomerProductCurrentRuntimeRefsV1 = {
  source_profile: CustomerProductCurrentRuntimeSourceProfileV1;
  active_lineage: FieldTwinCanonicalObjectRefV1;
  posterior_state: FieldTwinCanonicalObjectRefV1;
};

export interface CustomerProductCurrentRuntimeResolverV1 {
  resolveCurrentRuntimeV1(
    scope: FieldTwinScopeV1,
  ): Promise<CustomerProductCurrentRuntimeRefsV1>;
}
