// Purpose: execute one existing normal CAP-04 A1/B tick after exact Candidate/Evaluation persistence and prove that neither governance object is consumed as Runtime authority.
// Boundary: verification orchestration only; no Candidate/Evaluation append, calibration or scenario math, Model Activation, active-config write, Runtime parameter mutation, route, scheduler or external authority.

import type { Cap06GovernanceObjectV1 } from "../../persistence/calibration/postgres_calibration_governance_repository_v1.js";
import type {
  ExecuteCap04SingleTickInputV1,
  ExecuteCap04SingleTickResultV1,
} from "../twin_runtime/forecast_scenario_single_tick_service_v1.js";
import type { TwinScopeKeyV1 } from "../twin_runtime/ports.js";

export const CAP06_S9_NON_CONSUMPTION_SERVICE_ID_V1 =
  "MCFT_CAP_06_S9_POST_EVALUATION_NON_CONSUMPTION_TICK_V1" as const;
export const CAP06_S9_BASE_DRAINAGE_COEFFICIENT_V1 = "0.030000" as const;

export type Cap06S9RuntimeAuthoritySnapshotV1 = {
  scope: TwinScopeKeyV1;
  inspected_runtime_config_ref: string;
  inspected_runtime_config_hash: string;
  effective_drainage_coefficient_per_hour: string | number;
  runtime_config_semantic_payload: Record<string, unknown>;
  active_config_relation: string | null;
  active_config_snapshot_hash: string | null;
  model_activation_count: number;
  candidate_fact_count: number;
  evaluation_fact_count: number;
};

export type Cap06S9ReadPortV1 = {
  readCanonicalObject(objectId: string): Promise<Cap06GovernanceObjectV1 | null>;
  readRuntimeAuthoritySnapshot(input: {
    scope: TwinScopeKeyV1;
    runtime_config_ref: string;
    runtime_config_hash: string;
  }): Promise<Cap06S9RuntimeAuthoritySnapshotV1>;
};

export type Cap06S9TickPortV1 = {
  executeOneTick(input: ExecuteCap04SingleTickInputV1): Promise<ExecuteCap04SingleTickResultV1>;
};

export type ExecuteCap06S9NonConsumptionTickInputV1 = {
  candidate_ref: string;
  candidate_hash: string;
  evaluation_ref: string;
  evaluation_hash: string;
  expected_candidate_parameter_value: string;
  tick_input: ExecuteCap04SingleTickInputV1;
};

export type ExecuteCap06S9NonConsumptionTickResultV1 = {
  schema_version: "geox_mcft_cap_06_s9_non_consumption_tick_result_v1";
  service_id: typeof CAP06_S9_NON_CONSUMPTION_SERVICE_ID_V1;
  status: ExecuteCap04SingleTickResultV1["status"];
  candidate_ref: string;
  candidate_hash: string;
  evaluation_ref: string;
  evaluation_hash: string;
  candidate_parameter_value: string;
  effective_tick_parameter_value: typeof CAP06_S9_BASE_DRAINAGE_COEFFICIENT_V1;
  runtime_config_ref: string;
  runtime_config_hash: string;
  forecast_ref: string;
  forecast_hash: string;
  forecast_point_count: 72;
  scenario_set_ref: string;
  scenario_set_hash: string;
  scenario_option_count: 3;
  scenario_points_per_option: 72;
  candidate_consumed: false;
  evaluation_consumed: false;
  model_activation_count: 0;
  active_config_changed: false;
  candidate_fact_delta: 0;
  evaluation_fact_delta: 0;
  tick_result: ExecuteCap04SingleTickResultV1;
};

function requiredObjectV1(
  value: Cap06GovernanceObjectV1 | null,
  objectType: string,
  objectId: string,
  objectHash: string,
  code: string,
): Cap06GovernanceObjectV1 {
  if (!value || value.object_type !== objectType) throw new Error(`${code}_EXACT_OBJECT_REQUIRED`);
  if (value.object_id !== objectId) throw new Error(`${code}_REF_MISMATCH`);
  if (value.determinism_hash !== objectHash) throw new Error(`${code}_HASH_MISMATCH`);
  return value;
}

function fixed6V1(value: unknown, code: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(6);
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value)) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed.toFixed(6);
  }
  throw new Error(code);
}

function containsExactStringV1(value: unknown, needle: string): boolean {
  if (typeof value === "string") return value === needle;
  if (Array.isArray(value)) return value.some((item) => containsExactStringV1(item, needle));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => containsExactStringV1(item, needle));
  }
  return false;
}

function sameActiveConfigSnapshotV1(
  before: Cap06S9RuntimeAuthoritySnapshotV1,
  after: Cap06S9RuntimeAuthoritySnapshotV1,
): boolean {
  return before.active_config_relation === after.active_config_relation
    && before.active_config_snapshot_hash === after.active_config_snapshot_hash;
}

function exactScopeV1(actual: TwinScopeKeyV1, expected: TwinScopeKeyV1, code: string): void {
  for (const key of ["tenant_id", "project_id", "group_id", "field_id", "season_id", "zone_id"] as const) {
    if (actual[key] !== expected[key]) throw new Error(`${code}:${key}`);
  }
}

function governanceScopeV1(object: Cap06GovernanceObjectV1, code: string): TwinScopeKeyV1 {
  const scope = object.scope;
  if (!scope || typeof scope !== "object") throw new Error(`${code}:SCOPE_REQUIRED`);
  return {
    tenant_id: scope.tenant_id,
    project_id: scope.project_id,
    group_id: scope.group_id,
    field_id: scope.field_id,
    season_id: scope.season_id,
    zone_id: scope.zone_id,
  };
}

function memberV1(result: ExecuteCap04SingleTickResultV1, objectType: string) {
  const matches = result.a_record_set.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP06_S9_A_MEMBER_CARDINALITY:${objectType}:${matches.length}`);
  return matches[0];
}

export class Cap06PostEvaluationNonConsumptionTickServiceV1 {
  constructor(
    private readonly readPort: Cap06S9ReadPortV1,
    private readonly tickPort: Cap06S9TickPortV1,
  ) {}

  async execute(input: ExecuteCap06S9NonConsumptionTickInputV1): Promise<ExecuteCap06S9NonConsumptionTickResultV1> {
    const candidate = requiredObjectV1(
      await this.readPort.readCanonicalObject(input.candidate_ref),
      "twin_calibration_candidate_v1",
      input.candidate_ref,
      input.candidate_hash,
      "CAP06_S9_CANDIDATE",
    );
    const evaluation = requiredObjectV1(
      await this.readPort.readCanonicalObject(input.evaluation_ref),
      "twin_shadow_evaluation_v1",
      input.evaluation_ref,
      input.evaluation_hash,
      "CAP06_S9_EVALUATION",
    );
    if (evaluation.payload.candidate_ref !== candidate.object_id
      || evaluation.payload.candidate_hash !== candidate.determinism_hash) {
      throw new Error("CAP06_S9_EVALUATION_CANDIDATE_BINDING_MISMATCH");
    }
    exactScopeV1(
      governanceScopeV1(candidate, "CAP06_S9_CANDIDATE_SCOPE_INVALID"),
      input.tick_input.scope,
      "CAP06_S9_CANDIDATE_SCOPE_MISMATCH",
    );
    exactScopeV1(
      governanceScopeV1(evaluation, "CAP06_S9_EVALUATION_SCOPE_INVALID"),
      input.tick_input.scope,
      "CAP06_S9_EVALUATION_SCOPE_MISMATCH",
    );
    const candidateValue = fixed6V1(candidate.payload.candidate_parameter_value, "CAP06_S9_CANDIDATE_PARAMETER_INVALID");
    if (candidateValue !== input.expected_candidate_parameter_value) {
      throw new Error("CAP06_S9_CANDIDATE_PARAMETER_UNEXPECTED");
    }

    const snapshotInput = {
      scope: input.tick_input.scope,
      runtime_config_ref: input.tick_input.runtime_config_ref,
      runtime_config_hash: input.tick_input.runtime_config_hash,
    };
    const before = await this.readPort.readRuntimeAuthoritySnapshot(snapshotInput);
    exactScopeV1(before.scope, input.tick_input.scope, "CAP06_S9_BEFORE_SCOPE_MISMATCH");
    if (before.inspected_runtime_config_ref !== input.tick_input.runtime_config_ref
      || before.inspected_runtime_config_hash !== input.tick_input.runtime_config_hash) {
      throw new Error("CAP06_S9_TICK_CONFIG_EXACT_READBACK_MISMATCH");
    }
    const beforeCoefficient = fixed6V1(
      before.effective_drainage_coefficient_per_hour,
      "CAP06_S9_BEFORE_DRAINAGE_INVALID",
    );
    if (beforeCoefficient !== CAP06_S9_BASE_DRAINAGE_COEFFICIENT_V1) {
      throw new Error("CAP06_S9_BASE_EQUIVALENT_CONFIG_REQUIRED");
    }
    if (beforeCoefficient === candidateValue) throw new Error("CAP06_S9_CANDIDATE_PARAMETER_CONFIG_FORBIDDEN");
    if (containsExactStringV1(before.runtime_config_semantic_payload, input.candidate_ref)) {
      throw new Error("CAP06_S9_CANDIDATE_REF_IN_RUNTIME_CONFIG_AUTHORITY");
    }
    if (containsExactStringV1(before.runtime_config_semantic_payload, input.evaluation_ref)) {
      throw new Error("CAP06_S9_EVALUATION_REF_IN_RUNTIME_CONFIG_AUTHORITY");
    }
    if (before.model_activation_count !== 0) throw new Error("CAP06_S9_PREEXISTING_MODEL_ACTIVATION_FORBIDDEN");

    const tickResult = await this.tickPort.executeOneTick(input.tick_input);
    const forecast = memberV1(tickResult, "twin_forecast_run_v1");
    if (forecast.runtime_config_ref !== input.tick_input.runtime_config_ref
      || forecast.runtime_config_hash !== input.tick_input.runtime_config_hash) {
      throw new Error("CAP06_S9_FORECAST_CONFIG_BINDING_MISMATCH");
    }
    if (forecast.payload.status !== "COMPLETED"
      || !Array.isArray(forecast.payload.points)
      || forecast.payload.points.length !== 72) {
      throw new Error("CAP06_S9_COMPLETED_72_POINT_FORECAST_REQUIRED");
    }
    if (!tickResult.b_record) throw new Error("CAP06_S9_SCENARIO_SET_REQUIRED");
    const options = tickResult.b_record.scenario_set.payload.options;
    if (!Array.isArray(options) || options.length !== 3
      || options.some((option) => !Array.isArray(option.trajectory_points) || option.trajectory_points.length !== 72)) {
      throw new Error("CAP06_S9_THREE_72_POINT_SCENARIOS_REQUIRED");
    }

    const after = await this.readPort.readRuntimeAuthoritySnapshot(snapshotInput);
    exactScopeV1(after.scope, input.tick_input.scope, "CAP06_S9_AFTER_SCOPE_MISMATCH");
    if (after.inspected_runtime_config_ref !== input.tick_input.runtime_config_ref
      || after.inspected_runtime_config_hash !== input.tick_input.runtime_config_hash) {
      throw new Error("CAP06_S9_POST_TICK_CONFIG_EXACT_READBACK_MISMATCH");
    }
    const afterCoefficient = fixed6V1(after.effective_drainage_coefficient_per_hour, "CAP06_S9_AFTER_DRAINAGE_INVALID");
    if (afterCoefficient !== CAP06_S9_BASE_DRAINAGE_COEFFICIENT_V1) {
      throw new Error("CAP06_S9_POST_TICK_BASE_PARAMETER_CHANGED");
    }
    if (containsExactStringV1(after.runtime_config_semantic_payload, input.candidate_ref)) {
      throw new Error("CAP06_S9_POST_TICK_CANDIDATE_REF_CONSUMED");
    }
    if (containsExactStringV1(after.runtime_config_semantic_payload, input.evaluation_ref)) {
      throw new Error("CAP06_S9_POST_TICK_EVALUATION_REF_CONSUMED");
    }
    if (after.model_activation_count !== 0) throw new Error("CAP06_S9_MODEL_ACTIVATION_CREATED");
    if (!sameActiveConfigSnapshotV1(before, after)) throw new Error("CAP06_S9_ACTIVE_CONFIG_SNAPSHOT_CHANGED");
    if (after.candidate_fact_count !== before.candidate_fact_count) throw new Error("CAP06_S9_CANDIDATE_FACT_COUNT_CHANGED");
    if (after.evaluation_fact_count !== before.evaluation_fact_count) throw new Error("CAP06_S9_EVALUATION_FACT_COUNT_CHANGED");

    return {
      schema_version: "geox_mcft_cap_06_s9_non_consumption_tick_result_v1",
      service_id: CAP06_S9_NON_CONSUMPTION_SERVICE_ID_V1,
      status: tickResult.status,
      candidate_ref: candidate.object_id,
      candidate_hash: candidate.determinism_hash,
      evaluation_ref: evaluation.object_id,
      evaluation_hash: evaluation.determinism_hash,
      candidate_parameter_value: candidateValue,
      effective_tick_parameter_value: CAP06_S9_BASE_DRAINAGE_COEFFICIENT_V1,
      runtime_config_ref: input.tick_input.runtime_config_ref,
      runtime_config_hash: input.tick_input.runtime_config_hash,
      forecast_ref: forecast.object_id,
      forecast_hash: forecast.determinism_hash,
      forecast_point_count: 72,
      scenario_set_ref: tickResult.b_record.scenario_set.object_id,
      scenario_set_hash: tickResult.b_record.scenario_set.determinism_hash,
      scenario_option_count: 3,
      scenario_points_per_option: 72,
      candidate_consumed: false,
      evaluation_consumed: false,
      model_activation_count: 0,
      active_config_changed: false,
      candidate_fact_delta: 0,
      evaluation_fact_delta: 0,
      tick_result: tickResult,
    };
  }
}
