// apps/server/src/domain/twin_runtime/runtime_config_execution_view_v1.ts
// Purpose: define the non-canonical CAP-04 execution-config view consumed by reused State, Forecast and Scenario mathematics while preserving the source canonical Runtime Config as a separate immutable authority.
// Boundary: type definition and direct CAP-04 payload resolution only; no persistence, canonical object construction, object-id derivation, determinism-hash derivation, active binding, model activation, calibration, Runtime orchestration, filesystem, environment or network.
// Identity rule: source_config_ref/source_config_hash identify the untouched canonical source; the resolved view itself has no canonical object identity.

import type { CanonicalObjectEnvelopeV1 } from "./canonical_object_contracts_v1.js";
import {
  CAP04_RUNTIME_CONFIG_PURPOSE_V1,
  validateCap04RuntimeConfigPayloadV1,
  type Cap04RuntimeConfigPayloadV1,
} from "./forecast_scenario_runtime_config_v1.js";
import { CAP05_RUNTIME_CONFIG_PURPOSE_V1 } from "./feedback_runtime_config_v1.js";

export const DIRECT_CAP04_RUNTIME_CONFIG_RESOLUTION_POLICY_ID_V1 =
  "DIRECT_CAP04_RUNTIME_CONFIG_V1" as const;

export const CAP05_INHERITED_CAP04_EXECUTION_VIEW_RESOLUTION_POLICY_ID_V1 =
  "CAP05_INHERITED_CAP04_EXECUTION_VIEW_V1" as const;

export type Cap04ExecutionConfigSourcePurposeV1 =
  | typeof CAP04_RUNTIME_CONFIG_PURPOSE_V1
  | typeof CAP05_RUNTIME_CONFIG_PURPOSE_V1;

export type Cap04ExecutionConfigResolutionPolicyIdV1 =
  | typeof DIRECT_CAP04_RUNTIME_CONFIG_RESOLUTION_POLICY_ID_V1
  | typeof CAP05_INHERITED_CAP04_EXECUTION_VIEW_RESOLUTION_POLICY_ID_V1;

export type ResolvedCap04ExecutionConfigV1 = {
  source_config_ref: string;
  source_config_hash: string;
  source_config_purpose: Cap04ExecutionConfigSourcePurposeV1;
  payload: Cap04RuntimeConfigPayloadV1;
  resolution_policy_id: Cap04ExecutionConfigResolutionPolicyIdV1;
};

export type Cap04ExecutionConfigResolverPortV1 = {
  resolveExecutionConfig(
    canonicalConfig: CanonicalObjectEnvelopeV1,
  ): ResolvedCap04ExecutionConfigV1;
};

export class DirectCap04ExecutionConfigResolverV1
implements Cap04ExecutionConfigResolverPortV1 {
  resolveExecutionConfig(
    canonicalConfig: CanonicalObjectEnvelopeV1,
  ): ResolvedCap04ExecutionConfigV1 {
    validateCap04RuntimeConfigPayloadV1(canonicalConfig.payload);
    const payload = structuredClone(
      canonicalConfig.payload,
    ) as unknown as Cap04RuntimeConfigPayloadV1;
    if (payload.config_purpose !== CAP04_RUNTIME_CONFIG_PURPOSE_V1) {
      throw new Error("CAP04_EXECUTION_CONFIG_SOURCE_PURPOSE_MISMATCH");
    }
    return {
      source_config_ref: canonicalConfig.object_id,
      source_config_hash: canonicalConfig.determinism_hash,
      source_config_purpose: CAP04_RUNTIME_CONFIG_PURPOSE_V1,
      payload,
      resolution_policy_id: DIRECT_CAP04_RUNTIME_CONFIG_RESOLUTION_POLICY_ID_V1,
    };
  }
}
