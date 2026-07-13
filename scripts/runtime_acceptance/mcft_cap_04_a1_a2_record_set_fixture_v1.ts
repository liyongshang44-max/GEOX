// scripts/runtime_acceptance/mcft_cap_04_a1_a2_record_set_fixture_v1.ts
// Purpose: construct deterministic S5A source-member, Runtime Config, A1 completed-Forecast, and A2 blocked-Forecast builder inputs.
// Boundary: acceptance fixture only; no database, migration, projection, route, scheduler, live data, recommendation, decision, or action.

import {
  computeMemberDeterminismHashV1,
  deriveSemanticObjectIdV1,
} from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import type { Cap04ForecastRunPayloadV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";
import { executeCap04Pure72hForecastMathV1 } from "../../apps/server/src/domain/twin_runtime/pure_72h_forecast_math_v1.js";
import type {
  BuildCap04BlockedForecastRecordSetInputV1,
  BuildCap04CompletedForecastRecordSetInputV1,
  Cap04ARecordSetBuilderSourceMembersV1,
} from "../../apps/server/src/runtime/twin_runtime/forecast_continuation_record_set_builder_v1.js";
import { buildCap04ConfigChainFixtureV1 } from "./mcft_cap_04_contracts_config_fixture_v1.js";
import { buildCap04PureForecastMathInputV1 } from "./mcft_cap_04_forecast_math_fixture_v1.js";

export const CAP04_S5A_SCOPE_V1 = {
  tenant_id: "tenant_mcft",
  project_id: "project_mcft",
  group_id: "group_mcft",
  field_id: "field_mcft",
  season_id: "season_2026",
  zone_id: "zone_root",
} as const;

function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function uniqueSortedV1(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function buildSourceMembersV1(input: {
  logical_time: string;
  created_at: string;
  lineage_id: string;
  revision_id: string;
  runtime_config: CanonicalObjectEnvelopeV1;
}): Cap04ARecordSetBuilderSourceMembersV1 {
  const ids = {
    twin_evidence_window_v1: deriveSemanticObjectIdV1("s5a_source_evidence", { logical_time: input.logical_time }),
    twin_state_transition_v1: deriveSemanticObjectIdV1("s5a_source_transition", { logical_time: input.logical_time }),
    twin_assimilation_update_v1: deriveSemanticObjectIdV1("s5a_source_assimilation", { logical_time: input.logical_time }),
    twin_state_estimate_v1: deriveSemanticObjectIdV1("s5a_source_state", { logical_time: input.logical_time }),
  };
  const build = (type: keyof typeof ids, payload: Record<string, unknown>): CanonicalObjectEnvelopeV1 => {
    const member: CanonicalObjectEnvelopeV1 = {
      object_id: ids[type],
      object_type: type,
      schema_version: "v1",
      ...CAP04_S5A_SCOPE_V1,
      logical_time: input.logical_time,
      as_of: input.logical_time,
      source_refs: ["mcft_rb_bf1da664164a4fedda249bcb"],
      evidence_refs: ["evidence_s5a_controlled_fixture"],
      runtime_config_ref: input.runtime_config.object_id,
      runtime_config_hash: input.runtime_config.determinism_hash,
      idempotency_key: deriveSemanticObjectIdV1("s5a_source_member_key", { type, logical_time: input.logical_time }),
      determinism_hash: "",
      limitations: ["CONTROLLED_SYNTHETIC", "NOT_FIELD_CALIBRATED"],
      created_at: input.created_at,
      lineage_id: input.lineage_id,
      revision_id: input.revision_id,
      payload,
    };
    member.determinism_hash = computeMemberDeterminismHashV1(member as unknown as Record<string, unknown>);
    return member;
  };
  return {
    twin_evidence_window_v1: build("twin_evidence_window_v1", {
      evidence_window_contract_id: "MCFT_CAP_03_ASSIMILATED_EVIDENCE_WINDOW_V2",
      logical_time: input.logical_time,
      frozen: true,
      consumed_evidence_refs: ["evidence_s5a_controlled_fixture"],
      semantic_digest: "sha256:s5a_controlled_evidence_window",
    }),
    twin_state_transition_v1: build("twin_state_transition_v1", {
      transition_kind: "CONTINUATION",
      previous_posterior_ref: "twin_state_estimate_0adec65ed4a2a6f8146b1b2b",
      previous_posterior_hash: "sha256:previous_posterior_s5a",
      process_model_status: "APPLIED",
      process_model_id: "ROOT_ZONE_HOURLY_WATER_BALANCE_V1",
      process_model_version: 1,
      evidence_window_ref: ids.twin_evidence_window_v1,
      assimilation_update_ref: ids.twin_assimilation_update_v1,
      posterior_state_ref: ids.twin_state_estimate_v1,
      current_runtime_config_ref: input.runtime_config.object_id,
      current_runtime_config_hash: input.runtime_config.determinism_hash,
      mass_balance_trace_hash: "sha256:s5a_mass_balance_trace",
    }),
    twin_assimilation_update_v1: build("twin_assimilation_update_v1", {
      status: "APPLIED",
      disposition: "ACCEPTED",
      state_transition_ref: ids.twin_state_transition_v1,
      posterior_state_ref: ids.twin_state_estimate_v1,
      runtime_config_ref: input.runtime_config.object_id,
      runtime_config_hash: input.runtime_config.determinism_hash,
      model_parameter_change_applied: false,
      reason_codes: ["CONTROLLED_SYNTHETIC_ASSIMILATION"],
    }),
    twin_state_estimate_v1: build("twin_state_estimate_v1", {
      state_kind: "POSTERIOR",
      previous_posterior_ref: "twin_state_estimate_0adec65ed4a2a6f8146b1b2b",
      transition_ref: ids.twin_state_transition_v1,
      assimilation_update_ref: ids.twin_assimilation_update_v1,
      evidence_window_ref: ids.twin_evidence_window_v1,
      reality_binding_ref: "mcft_rb_bf1da664164a4fedda249bcb",
      reality_binding_hash: "sha256:reality_binding_s5a",
      root_zone_storage_mm: { mean: 90, variance: 4, stddev: 2 },
      computation_basis: {
        storage_mean_mm_decimal: "90.000000",
        storage_variance_mm2_decimal: "4.000000000000",
      },
      available_water_fraction: 0.5,
      depletion_from_field_capacity_mm: 10,
      confidence: { status: "NOT_ESTABLISHED", reason_code: "NO_CALIBRATED_CONFIDENCE_MODEL" },
      use_eligibility: {
        state_valid: true,
        posterior_chain_eligible: true,
        forecast_source_eligible: true,
        recommendation_input_eligible: false,
        action_input_eligible: false,
      },
    }),
  };
}

export function buildCap04A1A2BuilderInputsV1(index = 0): {
  completed: BuildCap04CompletedForecastRecordSetInputV1;
  blocked: BuildCap04BlockedForecastRecordSetInputV1;
} {
  const { configs } = buildCap04ConfigChainFixtureV1();
  const runtimeConfig = configs[index];
  if (!runtimeConfig) throw new Error("CAP04_S5A_CONFIG_INDEX_OUT_OF_RANGE");
  const logicalTime = String((runtimeConfig.payload as Record<string, unknown>).effective_logical_time);
  const createdAt = addMinutesV1(logicalTime, 10);
  const lineageId = "twin_runtime_lineage_31d5cdda3c87fdf1536f0233";
  const revisionId = "revision_active";
  const sourceMembers = buildSourceMembersV1({
    logical_time: logicalTime,
    created_at: createdAt,
    lineage_id: lineageId,
    revision_id: revisionId,
    runtime_config: runtimeConfig,
  });
  const forecastInput = buildCap04PureForecastMathInputV1(index);
  forecastInput.source_posterior = {
    ref: sourceMembers.twin_state_estimate_v1.object_id,
    hash: sourceMembers.twin_state_estimate_v1.determinism_hash,
    logical_time: logicalTime,
    computation_basis: {
      storage_mean_mm_decimal: "90.000000",
      storage_variance_mm2_decimal: "4.000000000000",
    },
  };
  const forecastMath = executeCap04Pure72hForecastMathV1(forecastInput);
  const common = {
    scope: { ...CAP04_S5A_SCOPE_V1 },
    lineage_id: lineageId,
    revision_id: revisionId,
    logical_time: logicalTime,
    created_at: createdAt,
    active_lineage_ref: "twin_runtime_lineage_31d5cdda3c87fdf1536f0233",
    previous_posterior_ref: "twin_state_estimate_0adec65ed4a2a6f8146b1b2b",
    previous_posterior_hash: "sha256:previous_posterior_s5a",
    previous_checkpoint_ref: "twin_runtime_checkpoint_b88792b2c77677855575a858",
    previous_checkpoint_hash: "sha256:previous_checkpoint_s5a",
    previous_forecast_result_ref: "twin_forecast_run_68997d774c7febc701bbbccf",
    previous_forecast_result_hash: "sha256:previous_forecast_s5a",
    previous_successful_forecast_ref: "twin_forecast_run_68997d774c7febc701bbbccf",
    previous_tick_sequence: 48 + index,
    runtime_config: runtimeConfig,
    source_members: sourceMembers,
  };
  const blockedPayload: Cap04ForecastRunPayloadV1 = {
    ...structuredClone(forecastMath.forecast_payload),
    status: "BLOCKED",
    points: [],
    reason_codes: ["NO_COMPLETE_MATCHING_FORCING_CYCLE"],
    scenario_eligible: false,
    forcing_window_hash: null,
    forcing_cycle_key: null,
    weather_snapshot_ref: null,
    weather_snapshot_hash: null,
    et0_snapshot_ref: null,
    et0_snapshot_hash: null,
    limitations: uniqueSortedV1([
      ...forecastMath.forecast_payload.limitations,
      "NO_COMPLETE_MATCHING_FORCING_CYCLE",
    ]),
  };
  return {
    completed: {
      ...common,
      forecast_payload: structuredClone(forecastMath.forecast_payload),
    },
    blocked: {
      ...common,
      forecast_payload: blockedPayload,
    },
  };
}

export function buildCap04A1A2Builder24TickInputsV1(): Array<{
  completed: BuildCap04CompletedForecastRecordSetInputV1;
  blocked: BuildCap04BlockedForecastRecordSetInputV1;
}> {
  return Array.from({ length: 24 }, (_, index) => buildCap04A1A2BuilderInputsV1(index));
}
