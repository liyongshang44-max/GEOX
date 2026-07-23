// apps/server/src/runtime/twin_runtime/cap08_s1_base_tick_service_v1.ts
// Purpose: execute one MCFT-CAP-08 S1 Tick through the frozen resolve/E/H/A/B/G/C/barrier order while reusing mature CAP-04 State, Forecast, Scenario math and persistence.
// Boundary: one explicit Replay Tick only; no range loop, B00, restart policy, late correction, Decision, Action Feedback, Residual, Calibration, route, scheduler, or live ingestion.

import {
  CAP08_PHASE_ORDER_V1,
  CAP08_S1_SCENARIO_OPTIONS_V1,
  buildCap08S1DueObligationSetV1,
  buildCap08S1TickBarrierV1,
  buildCap08S1TickPhasePlanV1,
  type Cap08DueObligationSetV1,
  type Cap08PhaseIdV1,
  type Cap08TickBarrierV1,
  type Cap08TickPhasePlanV1,
} from "../../domain/twin_runtime/cap08_phase_engine_contracts_v1.js";
import {
  CAP04_A1_OPERATION_VARIANT_V1,
  CAP04_A2_OPERATION_VARIANT_V1,
} from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import {
  deriveCap04ARecordSetIdentityV1,
  type Cap04ARecordSetV1,
  type Cap04ScenarioSetRecordV1,
} from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import {
  type ExecuteCap04SingleTickInputV1,
  type ExecuteCap04SingleTickResultV1,
  Cap04ForecastScenarioSingleTickServiceV1,
} from "./forecast_scenario_single_tick_service_v1.js";
import type { PreparedNextTickInputV1, TwinScopeKeyV1 } from "./ports.js";
import { Cap08DeferredScenarioPersistenceV1, type Cap08ScenarioFlushResultV1 } from "./cap08_deferred_scenario_persistence_v1.js";
import { Cap08FrozenEvidenceSourceV1 } from "./cap08_frozen_evidence_source_v1.js";

export type Cap08PhaseTraceV1 = {
  phase: Cap08PhaseIdV1;
  status: "COMPLETE";
  canonical_write: "NONE" | "A_STATE_FORECAST" | "B_SCENARIO";
  result: string;
};

export type ExecuteCap08S1BaseTickInputV1 = ExecuteCap04SingleTickInputV1 & {
  formal_run_id: string;
};

export type ExecuteCap08S1BaseTickResultV1 = {
  status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
  phase_plan: Cap08TickPhasePlanV1;
  due_obligations: Cap08DueObligationSetV1;
  phase_trace: readonly Cap08PhaseTraceV1[];
  a_record_set: Cap04ARecordSetV1;
  b_record: Cap04ScenarioSetRecordV1;
  a_provider_result: ExecuteCap04SingleTickResultV1;
  b_flush_result: Cap08ScenarioFlushResultV1;
  barrier: Cap08TickBarrierV1;
  next_handoff: PreparedNextTickInputV1;
  evidence_source_load_count: number;
};

export type PrepareCap08NextTickInputPortV1 = {
  prepareNextTickInput(scope: TwinScopeKeyV1): Promise<PreparedNextTickInputV1>;
};

function memberV1(recordSet: Cap04ARecordSetV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP08_S1_A_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

function scenarioPointCountV1(record: Cap04ScenarioSetRecordV1): number {
  return record.scenario_set.payload.options.reduce((sum, option) => sum + option.trajectory_points.length, 0);
}

export class Cap08S1BaseTickServiceV1 {
  constructor(
    private readonly handoffService: PrepareCap08NextTickInputPortV1,
    private readonly evidence: Cap08FrozenEvidenceSourceV1,
    private readonly deferredScenario: Cap08DeferredScenarioPersistenceV1,
    private readonly cap04Tick: Cap04ForecastScenarioSingleTickServiceV1,
  ) {}

  private async lookupExistingA(
    scope: TwinScopeKeyV1,
    handoff: PreparedNextTickInputV1,
    logicalTime: string,
  ): Promise<Cap04ARecordSetV1 | null> {
    const common = {
      scope: structuredClone(scope),
      lineage_id: handoff.lineage_id,
      revision_id: handoff.revision_id,
      logical_time: logicalTime,
    };
    const a1 = deriveCap04ARecordSetIdentityV1({ ...common, operation_variant: CAP04_A1_OPERATION_VARIANT_V1 });
    const a2 = deriveCap04ARecordSetIdentityV1({ ...common, operation_variant: CAP04_A2_OPERATION_VARIANT_V1 });
    return (await this.deferredScenario.lookupARecordSet(a1.idempotency_key))
      ?? (await this.deferredScenario.lookupARecordSet(a2.idempotency_key));
  }

  async executeOneTick(input: ExecuteCap08S1BaseTickInputV1): Promise<ExecuteCap08S1BaseTickResultV1> {
    const plan = buildCap08S1TickPhasePlanV1({
      formal_run_id: input.formal_run_id,
      scope: input.scope,
      logical_time: input.logical_time,
    });
    const due = buildCap08S1DueObligationSetV1(plan);
    const phases: Cap08PhaseTraceV1[] = [];

    const initialHandoff = await this.handoffService.prepareNextTickInput(input.scope);
    if (initialHandoff.next_logical_tick_time !== plan.logical_time) throw new Error("CAP08_RESOLVE_NEXT_TICK_MISMATCH");
    phases.push({ phase: "resolve", status: "COMPLETE", canonical_write: "NONE", result: "PERSISTED_HANDOFF_RESOLVED" });

    const existingA = await this.lookupExistingA(input.scope, initialHandoff, plan.logical_time);
    if (!existingA) await this.evidence.freeze({ scope: input.scope, logical_time: plan.logical_time });
    phases.push({
      phase: "E",
      status: "COMPLETE",
      canonical_write: "NONE",
      result: existingA ? "CANONICAL_A_EVIDENCE_ALREADY_FROZEN" : "CALLER_OWNED_EVIDENCE_SNAPSHOT_FROZEN",
    });

    phases.push({ phase: "H", status: "COMPLETE", canonical_write: "NONE", result: "S1_EMPTY_PROVIDER" });

    const aProvider = await this.cap04Tick.executeOneTick(input);
    if (aProvider.status === "BLOCKED_INSERTED" || aProvider.status === "EXISTING_BLOCKED_IDEMPOTENT_SUCCESS") {
      throw new Error("CAP08_S1_SUCCESSFUL_FORECAST_REQUIRED");
    }
    if (!aProvider.b_record) throw new Error("CAP08_S1_DEFERRED_B_CANDIDATE_REQUIRED");
    const forecast = memberV1(aProvider.a_record_set, "twin_forecast_run_v1");
    const state = memberV1(aProvider.a_record_set, "twin_state_estimate_v1");
    if (forecast.payload.status !== "COMPLETED" || !Array.isArray(forecast.payload.points) || forecast.payload.points.length !== 72) {
      throw new Error("CAP08_S1_A_SUCCESSFUL_72_POINT_FORECAST_REQUIRED");
    }
    phases.push({
      phase: "A",
      status: "COMPLETE",
      canonical_write: "A_STATE_FORECAST",
      result: aProvider.status,
    });

    const bFlush = await this.deferredScenario.flushScenarioSet(aProvider.b_record);
    const options = bFlush.record.scenario_set.payload.options;
    if (options.length !== 3
      || options.some((option, index) => option.option_id !== CAP08_S1_SCENARIO_OPTIONS_V1[index])
      || options.some((option) => option.trajectory_points.length !== 72)) {
      throw new Error("CAP08_S1_B_THREE_OPTION_72_POINT_SCENARIO_REQUIRED");
    }
    phases.push({ phase: "B", status: "COMPLETE", canonical_write: "B_SCENARIO", result: bFlush.status });

    phases.push({ phase: "G", status: "COMPLETE", canonical_write: "NONE", result: "S1_EMPTY_PROVIDER" });
    phases.push({ phase: "C", status: "COMPLETE", canonical_write: "NONE", result: "S1_EMPTY_PROVIDER" });
    phases.push({ phase: "barrier", status: "COMPLETE", canonical_write: "NONE", result: "S1_A_B_COMPLETE" });

    const barrier = buildCap08S1TickBarrierV1({
      plan,
      completed_phases: phases.map((phase) => phase.phase),
      a_record_set_count: 1,
      posterior_state_count: state.object_type === "twin_state_estimate_v1" ? 1 : 0,
      successful_forecast_count: 1,
      forecast_point_count: forecast.payload.points.length,
      scenario_set_count: 1,
      scenario_option_count: options.length,
      scenario_point_count: scenarioPointCountV1(bFlush.record),
      action_feedback_count: 0,
      decision_count: 0,
      residual_count: 0,
    });
    if (JSON.stringify(phases.map((phase) => phase.phase)) !== JSON.stringify(CAP08_PHASE_ORDER_V1)) {
      throw new Error("CAP08_S1_PHASE_TRACE_ORDER_MISMATCH");
    }

    const nextHandoff = await this.handoffService.prepareNextTickInput(input.scope);
    if (nextHandoff.next_logical_tick_time !== new Date(Date.parse(plan.logical_time) + 3_600_000).toISOString()) {
      throw new Error("CAP08_S1_NEXT_HANDOFF_TIME_MISMATCH");
    }
    const inserted = aProvider.status === "INSERTED" || aProvider.status === "RECOVERED_PENDING_SCENARIO" || bFlush.status === "INSERTED";
    return {
      status: inserted ? "INSERTED" : "EXISTING_IDEMPOTENT_SUCCESS",
      phase_plan: plan,
      due_obligations: due,
      phase_trace: phases,
      a_record_set: aProvider.a_record_set,
      b_record: bFlush.record,
      a_provider_result: aProvider,
      b_flush_result: bFlush,
      barrier,
      next_handoff: nextHandoff,
      evidence_source_load_count: this.evidence.getSourceLoadCount(),
    };
  }
}
