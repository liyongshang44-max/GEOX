// apps/server/src/runtime/twin_runtime/cap04_or_cap05_execution_config_resolver_v1.ts
// Purpose: deterministically dispatch an exact canonical Runtime Config to either the direct CAP-04 execution resolver or the positive CAP-05-inherited CAP-04 execution projection based solely on the frozen config_purpose discriminator.
// Boundary: pure read-only resolution only; no fallback-by-exception, canonical mutation, persistence, calibration math, activation, active binding, route, scheduler, filesystem, environment, or network.

import {
  validateCanonicalObjectV1,
  type CanonicalObjectEnvelopeV1,
} from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { CAP04_RUNTIME_CONFIG_PURPOSE_V1 } from "../../domain/twin_runtime/forecast_scenario_runtime_config_v1.js";
import { CAP05_RUNTIME_CONFIG_PURPOSE_V1 } from "../../domain/twin_runtime/feedback_runtime_config_v1.js";
import {
  DirectCap04ExecutionConfigResolverV1,
  type Cap04ExecutionConfigResolverPortV1,
  type ResolvedCap04ExecutionConfigV1,
} from "../../domain/twin_runtime/runtime_config_execution_view_v1.js";
import { Cap05InheritedCap04ExecutionConfigResolverV1 } from "./cap05_inherited_cap04_execution_config_resolver_v1.js";

export class Cap04OrCap05ExecutionConfigResolverV1
implements Cap04ExecutionConfigResolverPortV1 {
  private readonly directCap04 = new DirectCap04ExecutionConfigResolverV1();
  private readonly inheritedCap05 = new Cap05InheritedCap04ExecutionConfigResolverV1();

  resolveExecutionConfig(
    canonicalConfig: CanonicalObjectEnvelopeV1,
  ): ResolvedCap04ExecutionConfigV1 {
    validateCanonicalObjectV1(canonicalConfig);
    if (canonicalConfig.object_type !== "twin_runtime_config_v1") {
      throw new Error("CAP06_EXECUTION_CONFIG_RUNTIME_CONFIG_OBJECT_TYPE_REQUIRED");
    }
    const purpose = canonicalConfig.payload.config_purpose;
    if (purpose === CAP04_RUNTIME_CONFIG_PURPOSE_V1) {
      return this.directCap04.resolveExecutionConfig(canonicalConfig);
    }
    if (purpose === CAP05_RUNTIME_CONFIG_PURPOSE_V1) {
      return this.inheritedCap05.resolveExecutionConfig(canonicalConfig);
    }
    throw new Error(`CAP06_EXECUTION_CONFIG_PURPOSE_UNSUPPORTED:${String(purpose)}`);
  }
}
