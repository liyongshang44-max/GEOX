// apps/server/src/runtime/twin_runtime/forecast_scenario_persistence_ports_v1.ts
// Purpose: define CAP-04 A1/A2/B persistence, canonical readback, pending-Scenario detection, and projection-rebuild ports over the existing Runtime storage family.
// Boundary: interfaces only; no SQL, persistence implementation, projection mutation, route, scheduler, filesystem, network, environment, or wall clock.

import type { CanonicalObjectEnvelopeV1 } from "../../domain/twin_runtime/canonical_object_contracts_v1.js";
import type {
  Cap04ARecordSetV1,
  Cap04ScenarioSetRecordV1,
} from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import type {
  FaultInjectionStageV1,
  RuntimeLeaseClaimV1,
  TwinScopeKeyV1,
} from "./ports.js";

export type Cap04ExpectedPointersV1 = {
  active_lineage_ref: string;
  lineage_id: string;
  revision_id: string;
  previous_checkpoint_ref: string;
  previous_state_ref: string;
  previous_forecast_result_ref: string;
  previous_successful_forecast_ref: string | null;
};

export interface Cap04ForecastScenarioPersistencePortV1 {
  lookupARecordSet(idempotencyKey: string): Promise<Cap04ARecordSetV1 | null>;

  commitARecordSet(input: {
    scope: TwinScopeKeyV1;
    lease: RuntimeLeaseClaimV1;
    expected: Cap04ExpectedPointersV1;
    record_set: Cap04ARecordSetV1;
    fault_injection?: (stage: FaultInjectionStageV1) => void;
  }): Promise<{
    status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
    record_set: Cap04ARecordSetV1;
    fact_ids_by_object_id: Record<string, string>;
  }>;

  readARecordSet(recordSetId: string): Promise<Cap04ARecordSetV1 | null>;

  lookupScenarioSet(idempotencyKey: string): Promise<Cap04ScenarioSetRecordV1 | null>;

  commitScenarioSet(input: {
    scope: TwinScopeKeyV1;
    lease: RuntimeLeaseClaimV1;
    record: Cap04ScenarioSetRecordV1;
    fault_injection?: (stage: FaultInjectionStageV1) => void;
  }): Promise<{
    status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
    record: Cap04ScenarioSetRecordV1;
    fact_id: string;
  }>;

  readScenarioSet(scenarioSetId: string): Promise<Cap04ScenarioSetRecordV1 | null>;

  readScenarioSetBySourceForecast(
    sourceForecastRef: string,
    sourceForecastHash: string,
  ): Promise<Cap04ScenarioSetRecordV1 | null>;

  detectPendingScenario(scope: TwinScopeKeyV1): Promise<CanonicalObjectEnvelopeV1 | null>;

  rebuildForecastProjections(recordSetId: string): Promise<{
    rebuilt_forecast_run_count: 1;
    rebuilt_forecast_point_count: 0 | 72;
  }>;

  rebuildScenarioProjections(scenarioSetId: string): Promise<{
    rebuilt_scenario_set_count: 1;
    rebuilt_scenario_point_count: 216;
    rebuilt_latest_count: 1;
  }>;
}
