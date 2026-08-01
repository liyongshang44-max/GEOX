// Purpose: route only the armed MCFT-CAP-08 S4 corrected-T16 -> T17 A1 commit to the dedicated transition port.
// Boundary: generic CAP-04 service and generic PostgreSQL CAS remain unchanged.

import {
  CAP04_A1_OPERATION_VARIANT_V1,
} from "../../domain/twin_runtime/forecast_scenario_contracts_v1.js";
import { materializeCap04TickRecoveryAuthorityV1 } from "../../domain/twin_runtime/forecast_record_set_recovery_authority_v1.js";
import {
  CAP08_S4_T17_TRANSITION_KIND_V1,
  type Cap08S4T17CorrectedComputationPredecessorV1,
  type Cap08S4T17CorrectionAuthorityBindingV1,
  type Cap08S4T17ExpectedLatestBaseV1,
} from "../../domain/twin_runtime/cap08_t17_transition_contracts_v1.js";
import { deriveCap08S4T17TransitionWitnessV1 } from "../../domain/twin_runtime/cap08_t17_transition_witness_identity_v1.js";
import type { Cap04ARecordSetV1 } from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import type { Cap04SingleTickPersistencePortV1 } from "./forecast_scenario_single_tick_service_v1.js";
import type { Cap08S4T17TransitionPersistencePortV1 } from "./cap08_t17_transition_persistence_port_v1.js";
import type { RuntimeLeaseClaimV1, TwinScopeKeyV1 } from "./ports.js";

export type ArmCap08S4T17TransitionInputV1 = {
  formal_run_id: string;
  scope: TwinScopeKeyV1;
  lineage_id: string;
  revision_id: string;
  t17_logical_time: string;
  expected_latest_base: Cap08S4T17ExpectedLatestBaseV1;
  corrected_computation_predecessor: Cap08S4T17CorrectedComputationPredecessorV1;
  correction_authority: Cap08S4T17CorrectionAuthorityBindingV1;
};

type LeaseClaimInputV1 = Omit<RuntimeLeaseClaimV1, "fencing_token">;

function scopeKeyV1(scope: TwinScopeKeyV1): string {
  return [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id].join("\u001f");
}

function memberBindingV1(recordSet: Cap04ARecordSetV1, objectType: string): { ref: string; hash: string } {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  if (matches.length !== 1) throw new Error(`CAP08_S4_T17_ROUTE_MEMBER_CARDINALITY:${objectType}`);
  return { ref: matches[0].object_id, hash: matches[0].determinism_hash };
}

export class Cap08S4T17RoutingPersistenceV1 implements Cap04SingleTickPersistencePortV1 {
  private armed: ArmCap08S4T17TransitionInputV1 | null = null;
  private readonly deferredClaims = new Map<string, LeaseClaimInputV1>();
  private readonly realLeases = new Map<string, RuntimeLeaseClaimV1>();
  private lastTransitionResult: Awaited<ReturnType<Cap08S4T17TransitionPersistencePortV1["commitAuthorityBoundA1Transition"]>> | null = null;

  constructor(
    private readonly canonical: Cap04SingleTickPersistencePortV1,
    private readonly transition: Cap08S4T17TransitionPersistencePortV1,
  ) {}

  armTransition(input: ArmCap08S4T17TransitionInputV1): void {
    if (this.armed) throw new Error("CAP08_S4_T17_TRANSITION_ALREADY_ARMED");
    this.armed = structuredClone(input);
  }

  readLastTransitionResult(): typeof this.lastTransitionResult {
    return this.lastTransitionResult ? structuredClone(this.lastTransitionResult) : null;
  }

  async captureExpectedLatestBase(scope: TwinScopeKeyV1): Promise<Cap08S4T17ExpectedLatestBaseV1> {
    const provider = this.transition as Cap08S4T17TransitionPersistencePortV1 & {
      captureExpectedLatestBase?: (value: TwinScopeKeyV1) => Promise<Cap08S4T17ExpectedLatestBaseV1>;
    };
    if (typeof provider.captureExpectedLatestBase !== "function") {
      throw new Error("CAP08_S4_T17_EXPECTED_BASE_CAPTURE_PORT_REQUIRED");
    }
    return provider.captureExpectedLatestBase(scope);
  }

  async acquireLease(input: LeaseClaimInputV1): Promise<RuntimeLeaseClaimV1> {
    const key = scopeKeyV1(input);
    this.deferredClaims.set(key, structuredClone(input));
    return { ...structuredClone(input), fencing_token: 0n };
  }

  private async actualLeaseV1(scope: TwinScopeKeyV1): Promise<RuntimeLeaseClaimV1> {
    const key = scopeKeyV1(scope);
    const existing = this.realLeases.get(key);
    if (existing) return existing;
    const claim = this.deferredClaims.get(key);
    if (!claim) throw new Error("CAP08_S4_T17_DEFERRED_LEASE_CLAIM_REQUIRED");
    const lease = await this.canonical.acquireLease(claim);
    this.realLeases.set(key, lease);
    return lease;
  }

  lookupARecordSet: Cap04SingleTickPersistencePortV1["lookupARecordSet"] = (key) => this.canonical.lookupARecordSet(key);
  readARecordSet: Cap04SingleTickPersistencePortV1["readARecordSet"] = (id) => this.canonical.readARecordSet(id);
  lookupScenarioSet: Cap04SingleTickPersistencePortV1["lookupScenarioSet"] = (key) => this.canonical.lookupScenarioSet(key);
  readScenarioSet: Cap04SingleTickPersistencePortV1["readScenarioSet"] = (id) => this.canonical.readScenarioSet(id);
  readScenarioSetBySourceForecast: Cap04SingleTickPersistencePortV1["readScenarioSetBySourceForecast"] = (ref, hash) => this.canonical.readScenarioSetBySourceForecast(ref, hash);
  detectPendingScenario: Cap04SingleTickPersistencePortV1["detectPendingScenario"] = (scope) => this.canonical.detectPendingScenario(scope);
  rebuildForecastProjections: Cap04SingleTickPersistencePortV1["rebuildForecastProjections"] = (id) => this.canonical.rebuildForecastProjections(id);
  rebuildScenarioProjections: Cap04SingleTickPersistencePortV1["rebuildScenarioProjections"] = (id) => this.canonical.rebuildScenarioProjections(id);

  async commitARecordSet(
    input: Parameters<Cap04SingleTickPersistencePortV1["commitARecordSet"]>[0],
  ): Promise<Awaited<ReturnType<Cap04SingleTickPersistencePortV1["commitARecordSet"]>>> {
    const armed = this.armed;
    const isT17 = Boolean(armed && input.record_set.operation_key.logical_time === armed.t17_logical_time);
    if (isT17 && input.record_set.operation_key.operation_variant !== CAP04_A1_OPERATION_VARIANT_V1) {
      throw new Error("FORMAL_DATASET_INVARIANT_VIOLATION");
    }
    if (!isT17 || !armed) {
      const lease = await this.actualLeaseV1(input.scope);
      return this.canonical.commitARecordSet({ ...input, lease });
    }

    const recordSet = materializeCap04TickRecoveryAuthorityV1(input.record_set);
    const lease = await this.actualLeaseV1(input.scope);
    const witness = deriveCap08S4T17TransitionWitnessV1({
      uniqueness_key: {
        transition_kind: CAP08_S4_T17_TRANSITION_KIND_V1,
        formal_run_id: armed.formal_run_id,
        scope: structuredClone(armed.scope),
        lineage_id: armed.lineage_id,
        revision_id: armed.revision_id,
        t17_logical_time: armed.t17_logical_time,
      },
      correction_authority: structuredClone(armed.correction_authority),
      expected_latest_base: structuredClone(armed.expected_latest_base),
      corrected_computation_predecessor: structuredClone(armed.corrected_computation_predecessor),
      committed_t17: {
        record_set_id: recordSet.record_set_id,
        aggregate_determinism_hash: recordSet.aggregate_determinism_hash,
        state: memberBindingV1(recordSet, "twin_state_estimate_v1"),
        checkpoint: memberBindingV1(recordSet, "twin_runtime_checkpoint_v1"),
        forecast_result: memberBindingV1(recordSet, "twin_forecast_run_v1"),
        successful_forecast: memberBindingV1(recordSet, "twin_forecast_run_v1"),
      },
    });
    const result = await this.transition.commitAuthorityBoundA1Transition({
      scope: input.scope,
      lease,
      formal_run_id: armed.formal_run_id,
      expected_latest_base: armed.expected_latest_base,
      corrected_computation_predecessor: armed.corrected_computation_predecessor,
      correction_authority: armed.correction_authority,
      record_set: recordSet,
      transition_witness: witness,
      fault_injection: input.fault_injection,
    });
    this.lastTransitionResult = result;
    this.armed = null;
    return {
      status: result.status === "INSERTED_ATOMIC_TRANSITION" ? "INSERTED" : "EXISTING_IDEMPOTENT_SUCCESS",
      record_set: result.record_set,
      fact_ids_by_object_id: Object.fromEntries(result.record_set.members.map((member) => [member.object_id, `fact_${member.object_id}`])),
    };
  }

  async commitScenarioSet(
    input: Parameters<Cap04SingleTickPersistencePortV1["commitScenarioSet"]>[0],
  ): Promise<Awaited<ReturnType<Cap04SingleTickPersistencePortV1["commitScenarioSet"]>>> {
    const lease = await this.actualLeaseV1(input.scope);
    return this.canonical.commitScenarioSet({ ...input, lease });
  }
}
