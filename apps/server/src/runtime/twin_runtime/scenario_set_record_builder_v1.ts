// apps/server/src/runtime/twin_runtime/scenario_set_record_builder_v1.ts
// Purpose: construct one deterministic CAP-04 B Scenario Set canonical candidate from a completed Forecast envelope and an already validated pure Scenario-math result.
// Boundary: pure construction and validation only; no database, lease, persistence, projection, route, scheduler, filesystem, network, environment, or wall clock.

import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
} from "../../domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import { canonicalJsonV1 } from "../../domain/twin_runtime/canonical_json_v1.js";
import {
  CAP04_B_TRANSACTION_VARIANT_V1,
  CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1,
  validateCap04ForecastRunPayloadV1,
  validateCap04ScenarioSetPayloadV1,
  type Cap04ForecastRunPayloadV1,
  type Cap04ScenarioSetEnvelopeV1,
} from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import {
  deriveCap04ScenarioSetIdentityV1,
  type Cap04ScenarioSetRecordV1,
} from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import {
  validateCap04PureThreeScenarioMathResultV1,
  type Cap04PureThreeScenarioMathResultV1,
} from "../../domain/twin_runtime/scenario_math_contracts_v1.js";

export type BuildCap04ScenarioSetRecordInputV1 = {
  source_forecast: CanonicalObjectEnvelopeV1;
  scenario_math_result: Cap04PureThreeScenarioMathResultV1;
  created_at: string;
};

function requiredStringV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value;
}

function canonicalIsoV1(value: unknown, code: string): string {
  const text = requiredStringV1(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function exactEnvelopeIdentityV1(
  envelope: CanonicalObjectEnvelopeV1,
  math: Cap04PureThreeScenarioMathResultV1,
): void {
  if (envelope.object_type !== "twin_forecast_run_v1") throw new Error("CAP04_B_SOURCE_FORECAST_OBJECT_TYPE_REQUIRED");
  validateCap04ForecastRunPayloadV1(envelope.payload as unknown as Cap04ForecastRunPayloadV1);
  const payload = envelope.payload as unknown as Cap04ForecastRunPayloadV1;
  if (payload.status !== "COMPLETED" || payload.scenario_eligible !== true || payload.points.length !== 72) {
    throw new Error("CAP04_B_COMPLETED_FORECAST_REQUIRED");
  }
  if (math.source_forecast_ref !== envelope.object_id || math.source_forecast_hash !== envelope.determinism_hash) {
    throw new Error("CAP04_B_SCENARIO_MATH_SOURCE_FORECAST_MISMATCH");
  }
  if (canonicalJsonV1(math.source_forecast_payload) !== canonicalJsonV1(payload)) {
    throw new Error("CAP04_B_SCENARIO_MATH_FORECAST_PAYLOAD_MISMATCH");
  }
  if (math.scenario_set_payload.source_forecast_ref !== envelope.object_id
    || math.scenario_set_payload.source_forecast_hash !== envelope.determinism_hash) {
    throw new Error("CAP04_B_SCENARIO_PAYLOAD_SOURCE_FORECAST_MISMATCH");
  }
  if (math.scenario_set_payload.source_posterior_ref !== payload.source_posterior_ref
    || math.scenario_set_payload.source_posterior_hash !== payload.source_posterior_hash) {
    throw new Error("CAP04_B_SCENARIO_PAYLOAD_SOURCE_POSTERIOR_MISMATCH");
  }
  if (math.scenario_set_payload.runtime_config_ref !== payload.runtime_config_ref
    || math.scenario_set_payload.runtime_config_hash !== payload.runtime_config_hash) {
    throw new Error("CAP04_B_SCENARIO_PAYLOAD_RUNTIME_CONFIG_MISMATCH");
  }
}

export function buildCap04ScenarioSetRecordV1(
  input: BuildCap04ScenarioSetRecordInputV1,
): Cap04ScenarioSetRecordV1 {
  const createdAt = canonicalIsoV1(input.created_at, "CAP04_B_CREATED_AT_INVALID");
  validateCap04PureThreeScenarioMathResultV1(input.scenario_math_result);
  exactEnvelopeIdentityV1(input.source_forecast, input.scenario_math_result);
  const sourcePayload = input.source_forecast.payload as unknown as Cap04ForecastRunPayloadV1;
  validateCap04ScenarioSetPayloadV1(input.scenario_math_result.scenario_set_payload, sourcePayload);

  const uniquenessKey = {
    source_forecast_ref: input.source_forecast.object_id,
    source_forecast_hash: input.source_forecast.determinism_hash,
    lineage_id: requiredStringV1(input.source_forecast.lineage_id, "CAP04_B_LINEAGE_ID_REQUIRED"),
    revision_id: requiredStringV1(input.source_forecast.revision_id, "CAP04_B_REVISION_ID_REQUIRED"),
  };
  const provisional = deriveCap04ScenarioSetIdentityV1({
    uniqueness_key: uniquenessKey,
    scenario_policy_id: input.scenario_math_result.scenario_policy_id,
    runtime_config_ref: sourcePayload.runtime_config_ref,
    runtime_config_hash: sourcePayload.runtime_config_hash,
    scenario_set_determinism_hash: "sha256:pending",
  });
  const payload: Cap04ScenarioSetEnvelopeV1["payload"] = {
    ...structuredClone(input.scenario_math_result.scenario_set_payload),
    record_set_contract_id: CAP04_THREE_SCENARIO_SET_CONTRACT_ID_V1,
    transaction_variant: CAP04_B_TRANSACTION_VARIANT_V1,
    source_forecast_ref: input.source_forecast.object_id,
    source_forecast_hash: input.source_forecast.determinism_hash,
    source_posterior_ref: sourcePayload.source_posterior_ref,
    source_posterior_hash: sourcePayload.source_posterior_hash,
    runtime_config_ref: sourcePayload.runtime_config_ref,
    runtime_config_hash: sourcePayload.runtime_config_hash,
  };
  validateCap04ScenarioSetPayloadV1(payload, sourcePayload);

  const scenarioSet: Cap04ScenarioSetEnvelopeV1 = {
    object_id: provisional.scenario_set_id,
    object_type: "twin_scenario_set_v1",
    schema_version: "v1",
    tenant_id: input.source_forecast.tenant_id,
    project_id: input.source_forecast.project_id,
    group_id: input.source_forecast.group_id,
    field_id: input.source_forecast.field_id,
    season_id: input.source_forecast.season_id,
    zone_id: input.source_forecast.zone_id,
    logical_time: input.source_forecast.logical_time,
    as_of: input.source_forecast.as_of,
    source_refs: [...new Set([
      input.source_forecast.object_id,
      sourcePayload.source_posterior_ref,
      sourcePayload.runtime_config_ref,
    ])].sort(),
    evidence_refs: [...new Set(input.source_forecast.evidence_refs)].sort(),
    runtime_config_ref: sourcePayload.runtime_config_ref,
    runtime_config_hash: sourcePayload.runtime_config_hash,
    idempotency_key: provisional.idempotency_key,
    determinism_hash: "",
    limitations: [...new Set([
      ...input.source_forecast.limitations,
      ...input.scenario_math_result.limitations,
      ...payload.limitations,
      "SCENARIO_SET_CANONICAL_CANDIDATE_ONLY",
    ])].sort(),
    created_at: createdAt,
    lineage_id: uniquenessKey.lineage_id,
    revision_id: uniquenessKey.revision_id,
    payload,
  };
  scenarioSet.determinism_hash = computeMemberDeterminismHashV1(
    scenarioSet as unknown as Record<string, unknown>,
  );
  const identity = deriveCap04ScenarioSetIdentityV1({
    uniqueness_key: uniquenessKey,
    scenario_policy_id: payload.scenario_policy_id,
    runtime_config_ref: payload.runtime_config_ref,
    runtime_config_hash: payload.runtime_config_hash,
    scenario_set_determinism_hash: scenarioSet.determinism_hash,
  });
  if (identity.scenario_set_id !== scenarioSet.object_id || identity.idempotency_key !== scenarioSet.idempotency_key) {
    throw new Error("CAP04_B_IDENTITY_REDERIVATION_MISMATCH");
  }
  if (deriveSemanticObjectIdV1("twin_scenario_set", {
    scenario_set_uniqueness_key_hash: identity.scenario_set_uniqueness_key_hash,
  }) !== scenarioSet.object_id) {
    throw new Error("CAP04_B_SCENARIO_SET_OBJECT_ID_MISMATCH");
  }
  return {
    ...identity,
    scenario_set: scenarioSet,
  };
}
