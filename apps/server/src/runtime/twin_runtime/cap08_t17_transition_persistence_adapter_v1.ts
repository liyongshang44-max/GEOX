// Purpose: route exactly one active T17 A-record-set commit to the dedicated authority-bound transition port.
// Boundary: explicit in-process routing only; ordinary CAP-04 operations always delegate unchanged and no implicit fallback is allowed for T17.

import type { Cap04ARecordSetV1 } from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import { materializeCap04TickRecoveryAuthorityV1 } from "../../domain/twin_runtime/forecast_record_set_recovery_authority_v1.js";
import {
  CAP08_S4_T17_TRANSITION_KIND_V1,
  type Cap08S4T17CorrectionAuthorityBindingV1,
  type Cap08S4T17CorrectedComputationPredecessorV1,
  type Cap08S4T17ExpectedLatestBaseV1,
  type Cap08S4T17TransitionUniquenessKeyV1,
} from "../../domain/twin_runtime/cap08_t17_transition_contracts_v1.js";
import { deriveCap08S4T17TransitionWitnessV1 } from "../../domain/twin_runtime/cap08_t17_transition_witness_identity_v1.js";
import type {
  Cap08S4T17TransitionPersistencePortV1,
  CommitCap08S4T17A1TransitionResultV1,
} from "./cap08_t17_transition_persistence_port_v1.js";
import type { Cap04SingleTickPersistencePortV1 } from "./forecast_scenario_single_tick_service_v1.js";
import type { TwinScopeKeyV1 } from "./ports.js";

export type Cap08S4T17ActiveTransitionContextV1 = {
  formal_run_id: string;
  scope: TwinScopeKeyV1;
  lineage_id: string;
  revision_id: string;
  t17_logical_time: string;
  expected_latest_base: Cap08S4T17ExpectedLatestBaseV1;
  corrected_computation_predecessor: Cap08S4T17CorrectedComputationPredecessorV1;
  correction_authority: Cap08S4T17CorrectionAuthorityBindingV1;
};

function memberV1(recordSet: Cap04ARecordSetV1, objectType: string) {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP08_S4_T17_ADAPTER_MEMBER_CARDINALITY:${objectType}`);
  return matches[0];
}

function committedV1(recordSet: Cap04ARecordSetV1) {
  const state = memberV1(recordSet, "twin_state_estimate_v1");
  const checkpoint = memberV1(recordSet, "twin_runtime_checkpoint_v1");
  const forecast = memberV1(recordSet, "twin_forecast_run_v1");
  return {
    record_set_id: recordSet.record_set_id,
    aggregate_determinism_hash: recordSet.aggregate_determinism_hash,
    state: { ref: state.object_id, hash: state.determinism_hash },
    checkpoint: { ref: checkpoint.object_id, hash: checkpoint.determinism_hash },
    forecast_result: { ref: forecast.object_id, hash: forecast.determinism_hash },
    successful_forecast: { ref: forecast.object_id, hash: forecast.determinism_hash },
  };
}

export class Cap08S4T17TransitionPersistenceAdapterV1
implements Cap04SingleTickPersistencePortV1 {
  private active: Cap08S4T17ActiveTransitionContextV1 | null = null;
  private lastResult: CommitCap08S4T17A1TransitionResultV1 | null = null;

  constructor(
    private readonly ordinary: Cap04SingleTickPersistencePortV1,
    private readonly transition: Cap08S4T17TransitionPersistencePortV1,
  ) {}

  activate(context: Cap08S4T17ActiveTransitionContextV1): void {
    if (this.active) throw new Error("CAP08_S4_T17_TRANSITION_CONTEXT_ALREADY_ACTIVE");
    this.active = structuredClone(context);
    this.lastResult = null;
  }

  deactivate(): void {
    this.active = null;
  }

  consumeLastTransitionResult(recordSetId: string): CommitCap08S4T17A1TransitionResultV1 {
    const result = this.lastResult;
    if (!result || result.record_set.record_set_id !== recordSetId) {
      throw new Error("CAP08_S4_T17_TRANSITION_RESULT_REQUIRED");
    }
    this.lastResult = null;
    return result;
  }

  acquireLease: Cap04SingleTickPersistencePortV1["acquireLease"] =
    (input) => this.ordinary.acquireLease(input);

  lookupARecordSet: Cap04SingleTickPersistencePortV1["lookupARecordSet"] =
    (idempotencyKey) => this.ordinary.lookupARecordSet(idempotencyKey);

  readARecordSet: Cap04SingleTickPersistencePortV1["readARecordSet"] =
    (recordSetId) => this.ordinary.readARecordSet(recordSetId);

  lookupScenarioSet: Cap04SingleTickPersistencePortV1["lookupScenarioSet"] =
    (idempotencyKey) => this.ordinary.lookupScenarioSet(idempotencyKey);

  commitScenarioSet: Cap04SingleTickPersistencePortV1["commitScenarioSet"] =
    (input) => this.ordinary.commitScenarioSet(input);

  readScenarioSet: Cap04SingleTickPersistencePortV1["readScenarioSet"] =
    (scenarioSetId) => this.ordinary.readScenarioSet(scenarioSetId);

  readScenarioSetBySourceForecast: Cap04SingleTickPersistencePortV1["readScenarioSetBySourceForecast"] =
    (sourceForecastRef, sourceForecastHash) =>
      this.ordinary.readScenarioSetBySourceForecast(sourceForecastRef, sourceForecastHash);

  detectPendingScenario: Cap04SingleTickPersistencePortV1["detectPendingScenario"] =
    (scope) => this.ordinary.detectPendingScenario(scope);

  rebuildForecastProjections: Cap04SingleTickPersistencePortV1["rebuildForecastProjections"] =
    (recordSetId) => this.ordinary.rebuildForecastProjections(recordSetId);

  rebuildScenarioProjections: Cap04SingleTickPersistencePortV1["rebuildScenarioProjections"] =
    (scenarioSetId) => this.ordinary.rebuildScenarioProjections(scenarioSetId);

  async commitARecordSet(
    input: Parameters<Cap04SingleTickPersistencePortV1["commitARecordSet"]>[0],
  ): Promise<Awaited<ReturnType<Cap04SingleTickPersistencePortV1["commitARecordSet"]>>> {
    const context = this.active;
    if (!context) return this.ordinary.commitARecordSet(input);

    if (input.record_set.operation_key.logical_time !== context.t17_logical_time
      || input.record_set.operation_key.lineage_id !== context.lineage_id
      || input.record_set.operation_key.revision_id !== context.revision_id) {
      throw new Error("CAP08_S4_T17_ACTIVE_CONTEXT_IDENTITY_MISMATCH");
    }
    const expected = input.expected;
    const corrected = context.corrected_computation_predecessor;
    if (expected.previous_state_ref !== corrected.state.ref
      || expected.previous_checkpoint_ref !== corrected.checkpoint.ref
      || expected.previous_forecast_result_ref !== corrected.forecast_result.ref
      || expected.previous_successful_forecast_ref !== corrected.successful_forecast.ref) {
      throw new Error("CAP08_S4_T17_GENERIC_HANDOFF_NOT_CORRECTED_PREDECESSOR");
    }

    const materializedRecordSet = materializeCap04TickRecoveryAuthorityV1(input.record_set);
    const uniquenessKey: Cap08S4T17TransitionUniquenessKeyV1 = {
      transition_kind: CAP08_S4_T17_TRANSITION_KIND_V1,
      formal_run_id: context.formal_run_id,
      scope: structuredClone(context.scope),
      lineage_id: context.lineage_id,
      revision_id: context.revision_id,
      t17_logical_time: context.t17_logical_time,
    };
    const witness = deriveCap08S4T17TransitionWitnessV1({
      uniqueness_key: uniquenessKey,
      correction_authority: context.correction_authority,
      expected_latest_base: context.expected_latest_base,
      corrected_computation_predecessor: context.corrected_computation_predecessor,
      committed_t17: committedV1(materializedRecordSet),
    });
    const result = await this.transition.commitAuthorityBoundA1Transition({
      scope: input.scope,
      lease: input.lease,
      formal_run_id: context.formal_run_id,
      expected_latest_base: context.expected_latest_base,
      corrected_computation_predecessor: context.corrected_computation_predecessor,
      correction_authority: context.correction_authority,
      record_set: materializedRecordSet,
      transition_witness: witness,
      fault_injection: input.fault_injection,
    });
    this.lastResult = result;
    return {
      status: result.status === "INSERTED_ATOMIC_TRANSITION"
        ? "INSERTED"
        : "EXISTING_IDEMPOTENT_SUCCESS",
      record_set: result.record_set,
      fact_ids_by_object_id: Object.fromEntries(
        result.record_set.members.map((member) => [member.object_id, `fact_${member.object_id}`]),
      ),
    };
  }
}
