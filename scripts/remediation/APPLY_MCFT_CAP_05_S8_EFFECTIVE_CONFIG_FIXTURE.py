# scripts/remediation/APPLY_MCFT_CAP_05_S8_EFFECTIVE_CONFIG_FIXTURE.py
# Purpose: update the historical S8 acceptance fixture to use canonical CAP-05 effective Runtime Configs and the CAP-05 inherited CAP-04 execution resolver.
# Boundary: acceptance-source transformation only; no production Runtime change, validator relaxation, canonical persistence, calibration, Model Activation, or CAP-06 authority.

from pathlib import Path

PATH = Path("scripts/runtime_acceptance/mcft_cap_05_s8_forecast_residual_fixture_v1.ts")


def replace_once(text: str, old: str, new: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"S8_FIXTURE_PATCH_MARKER_COUNT:{count}:{old[:100]}")
    return text.replace(old, new, 1)


text = PATH.read_text()
text = replace_once(
    text,
    '''import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
  semanticHashV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";''',
    '''import {
  computeMemberDeterminismHashV1,
  semanticHashV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";''',
)
text = replace_once(
    text,
    '''import type { ContinuationCropStageConfigurationContextV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";''',
    '''import { Cap05InheritedCap04ExecutionConfigResolverV1 } from "../../apps/server/src/runtime/twin_runtime/cap05_inherited_cap04_execution_config_resolver_v1.js";
import type { ContinuationCropStageConfigurationContextV1 } from "../../apps/server/src/runtime/twin_runtime/continuation_evidence_window_service_v1.js";''',
)
text = replace_once(
    text,
    '''import { buildCap04FutureForcingSnapshotV1 } from "./mcft_cap_04_future_forcing_fixture_v1.js";''',
    '''import { buildCap04FutureForcingSnapshotV1 } from "./mcft_cap_04_future_forcing_fixture_v1.js";
import { buildCap05EffectiveRuntimeConfigFromCap04FixtureV1 } from "./mcft_cap_05_effective_runtime_config_fixture_v1.js";''',
)
old_function = '''export function applyCap05S8RuntimePoliciesV1(
  source: CanonicalObjectEnvelopeV1,
): CanonicalObjectEnvelopeV1 {
  const config = structuredClone(source);
  const sourcePayload = config.payload as unknown as Cap04RuntimeConfigPayloadV1;
  config.payload = {
    ...config.payload,
    action_feedback_state_input_policy_id: CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1,
    action_feedback_quality_mapping_policy_id: CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1,
    evidence_cutoff_policy_id: CAP05_ACTION_FEEDBACK_EVIDENCE_CUTOFF_POLICY_ID_V1,
    late_receipt_policy_id: CAP05_ACTION_FEEDBACK_LATE_POLICY_ID_V1,
    execution_interval_policy_id: CAP05_ACTION_FEEDBACK_INTERVAL_POLICY_ID_V1,
    multiple_execution_event_policy_id: CAP05_ACTION_FEEDBACK_MULTIPLE_EVENT_POLICY_ID_V1,
    spatial_overlap_policy_id: CAP05_ACTION_FEEDBACK_SPATIAL_OVERLAP_POLICY_ID_V1,
    actual_amount_semantics_policy_id: CAP05_ACTION_FEEDBACK_AMOUNT_SEMANTICS_POLICY_ID_V1,
    effective_irrigation_policy_id: CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1,
    volume_to_depth_policy_id: CAP05_ACTION_FEEDBACK_VOLUME_TO_DEPTH_POLICY_ID_V1,
    action_feedback_adapter_policy_id: CAP05_ACTION_FEEDBACK_ADAPTER_POLICY_ID_V1,
    forecast_residual_matching_policy_id: CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_ID_V1,
    forecast_point_member_ref_policy_id: CAP05_FORECAST_POINT_MEMBER_REF_POLICY_ID_V1,
    forecast_observation_projection_method_id: CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1,
    forecast_observation_projection_version: CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_VERSION_V1,
    forecast_residual_normalization_policy_id: CAP05_FORECAST_RESIDUAL_NORMALIZATION_BASIS_V1,
    forecast_assimilation_relation_policy_id: CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1,
  };
  const identityBasis = {
    object_type: "twin_runtime_config_v1",
    logical_time: config.logical_time,
    parent_runtime_config_ref: sourcePayload.parent_runtime_config_ref,
    parent_runtime_config_hash: sourcePayload.parent_runtime_config_hash,
    payload: config.payload,
  };
  config.object_id = deriveSemanticObjectIdV1("cap05_s8_runtime_config", identityBasis);
  config.idempotency_key = deriveSemanticObjectIdV1("cap05_s8_runtime_config_key", identityBasis);
  config.determinism_hash = "";
  config.determinism_hash = computeMemberDeterminismHashV1(config as unknown as Record<string, unknown>);
  return config;
}'''
new_function = '''export function applyCap05S8RuntimePoliciesV1(
  source: CanonicalObjectEnvelopeV1,
): CanonicalObjectEnvelopeV1 {
  const config = buildCap05EffectiveRuntimeConfigFromCap04FixtureV1(source);
  const payload = config.payload as Record<string, unknown>;
  const expectedPolicies = [
    ["action_feedback_state_input_policy_id", CAP05_ACTION_FEEDBACK_ELIGIBILITY_POLICY_V1],
    ["action_feedback_quality_mapping_policy_id", CAP05_ACTION_FEEDBACK_QUALITY_MAPPING_POLICY_V1],
    ["evidence_cutoff_policy_id", CAP05_ACTION_FEEDBACK_EVIDENCE_CUTOFF_POLICY_ID_V1],
    ["late_receipt_policy_id", CAP05_ACTION_FEEDBACK_LATE_POLICY_ID_V1],
    ["execution_interval_policy_id", CAP05_ACTION_FEEDBACK_INTERVAL_POLICY_ID_V1],
    ["multiple_execution_event_policy_id", CAP05_ACTION_FEEDBACK_MULTIPLE_EVENT_POLICY_ID_V1],
    ["spatial_overlap_policy_id", CAP05_ACTION_FEEDBACK_SPATIAL_OVERLAP_POLICY_ID_V1],
    ["actual_amount_semantics_policy_id", CAP05_ACTION_FEEDBACK_AMOUNT_SEMANTICS_POLICY_ID_V1],
    ["effective_irrigation_policy_id", CAP05_TARGET_EQUIVALENT_IRRIGATION_POLICY_V1],
    ["volume_to_depth_policy_id", CAP05_ACTION_FEEDBACK_VOLUME_TO_DEPTH_POLICY_ID_V1],
    ["action_feedback_adapter_policy_id", CAP05_ACTION_FEEDBACK_ADAPTER_POLICY_ID_V1],
    ["forecast_residual_matching_policy_id", CAP05_FORECAST_RESIDUAL_MATCHING_POLICY_ID_V1],
    ["forecast_point_member_ref_policy_id", CAP05_FORECAST_POINT_MEMBER_REF_POLICY_ID_V1],
    ["forecast_observation_projection_method_id", CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_ID_V1],
    ["forecast_observation_projection_version", CAP05_FORECAST_OBSERVATION_PROJECTION_METHOD_VERSION_V1],
    ["forecast_residual_normalization_policy_id", CAP05_FORECAST_RESIDUAL_NORMALIZATION_BASIS_V1],
    ["forecast_assimilation_relation_policy_id", CAP05_FORECAST_ASSIMILATION_RELATION_POLICY_V1],
  ] as const;
  for (const [field, expected] of expectedPolicies) {
    if (payload[field] !== expected) throw new Error(`CAP05_S8_EFFECTIVE_CONFIG_POLICY_MISMATCH:${field}`);
  }
  return config;
}'''
text = replace_once(text, old_function, new_function)
text = replace_once(
    text,
    '''  const outcomeTickService = new Cap04ForecastScenarioSingleTickServiceV1(
    new PrepareNextTickInputServiceV1(base.runtime),
    outcomeEvidenceSource,
    base.runtime,
    base.runtime,
  );''',
    '''  const outcomeTickService = new Cap04ForecastScenarioSingleTickServiceV1(
    new PrepareNextTickInputServiceV1(base.runtime),
    outcomeEvidenceSource,
    base.runtime,
    base.runtime,
    new Cap05InheritedCap04ExecutionConfigResolverV1(),
  );''',
)
PATH.write_text(text)
