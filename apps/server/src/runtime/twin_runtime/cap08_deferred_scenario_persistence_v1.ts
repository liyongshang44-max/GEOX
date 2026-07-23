// apps/server/src/runtime/twin_runtime/cap08_deferred_scenario_persistence_v1.ts
// Purpose: preserve mature CAP-04 A/Forecast/Scenario construction while deferring the actual B Scenario canonical write to the explicit CAP-08 B phase.
// Boundary: persistence delegation and one in-process staged B candidate only; no Scenario math, A mutation, route, scheduler, filesystem, or wall-clock reads.

import type { Cap04ScenarioSetRecordV1 } from "../../domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import type { Cap04SingleTickPersistencePortV1 } from "./forecast_scenario_single_tick_service_v1.js";

export type Cap08ScenarioFlushResultV1 = {
  status: "INSERTED" | "EXISTING_IDEMPOTENT_SUCCESS";
  record: Cap04ScenarioSetRecordV1;
  fact_id: string;
};

type CommitScenarioInputV1 = Parameters<Cap04SingleTickPersistencePortV1["commitScenarioSet"]>[0];

function sameScenarioV1(left: Cap04ScenarioSetRecordV1, right: Cap04ScenarioSetRecordV1): boolean {
  return left.scenario_set_id === right.scenario_set_id
    && left.idempotency_key === right.idempotency_key
    && left.aggregate_determinism_hash === right.aggregate_determinism_hash;
}

export class Cap08DeferredScenarioPersistenceV1 implements Cap04SingleTickPersistencePortV1 {
  private staged: CommitScenarioInputV1 | null = null;

  constructor(private readonly canonical: Cap04SingleTickPersistencePortV1) {}

  acquireLease: Cap04SingleTickPersistencePortV1["acquireLease"] = (input) => this.canonical.acquireLease(input);
  lookupARecordSet: Cap04SingleTickPersistencePortV1["lookupARecordSet"] = (idempotencyKey) => this.canonical.lookupARecordSet(idempotencyKey);
  commitARecordSet: Cap04SingleTickPersistencePortV1["commitARecordSet"] = (input) => this.canonical.commitARecordSet(input);
  readARecordSet: Cap04SingleTickPersistencePortV1["readARecordSet"] = (recordSetId) => this.canonical.readARecordSet(recordSetId);
  detectPendingScenario: Cap04SingleTickPersistencePortV1["detectPendingScenario"] = (scope) => this.canonical.detectPendingScenario(scope);
  rebuildForecastProjections: Cap04SingleTickPersistencePortV1["rebuildForecastProjections"] = (recordSetId) => this.canonical.rebuildForecastProjections(recordSetId);
  rebuildScenarioProjections: Cap04SingleTickPersistencePortV1["rebuildScenarioProjections"] = (scenarioSetId) => this.canonical.rebuildScenarioProjections(scenarioSetId);

  async lookupScenarioSet(idempotencyKey: string): Promise<Cap04ScenarioSetRecordV1 | null> {
    const existing = await this.canonical.lookupScenarioSet(idempotencyKey);
    if (existing) {
      if (this.staged && this.staged.record.idempotency_key === idempotencyKey && !sameScenarioV1(existing, this.staged.record)) {
        throw new Error("CAP08_DEFERRED_B_IDEMPOTENCY_CONFLICT");
      }
      return existing;
    }
    return this.staged?.record.idempotency_key === idempotencyKey ? structuredClone(this.staged.record) : null;
  }

  async commitScenarioSet(input: CommitScenarioInputV1): Promise<Cap08ScenarioFlushResultV1> {
    const existing = await this.canonical.lookupScenarioSet(input.record.idempotency_key);
    if (existing) {
      if (!sameScenarioV1(existing, input.record)) throw new Error("CAP08_DEFERRED_B_IDEMPOTENCY_CONFLICT");
      return { status: "EXISTING_IDEMPOTENT_SUCCESS", record: existing, fact_id: `fact_${existing.scenario_set.object_id}` };
    }
    if (this.staged && !sameScenarioV1(this.staged.record, input.record)) throw new Error("CAP08_DEFERRED_B_MULTIPLE_CANDIDATES_FOR_ONE_TICK");
    this.staged = structuredClone(input);
    return {
      status: "INSERTED",
      record: structuredClone(input.record),
      fact_id: `fact_${input.record.scenario_set.object_id}`,
    };
  }

  async readScenarioSet(scenarioSetId: string): Promise<Cap04ScenarioSetRecordV1 | null> {
    const existing = await this.canonical.readScenarioSet(scenarioSetId);
    if (existing) return existing;
    return this.staged?.record.scenario_set_id === scenarioSetId ? structuredClone(this.staged.record) : null;
  }

  async readScenarioSetBySourceForecast(
    sourceForecastRef: string,
    sourceForecastHash: string,
  ): Promise<Cap04ScenarioSetRecordV1 | null> {
    const existing = await this.canonical.readScenarioSetBySourceForecast(sourceForecastRef, sourceForecastHash);
    if (existing) return existing;
    const staged = this.staged?.record;
    if (staged
      && staged.scenario_set_uniqueness_key.source_forecast_ref === sourceForecastRef
      && staged.scenario_set_uniqueness_key.source_forecast_hash === sourceForecastHash) {
      return structuredClone(staged);
    }
    return null;
  }

  hasStagedScenario(): boolean {
    return this.staged !== null;
  }

  async flushScenarioSet(expected: Cap04ScenarioSetRecordV1): Promise<Cap08ScenarioFlushResultV1> {
    const existing = await this.canonical.lookupScenarioSet(expected.idempotency_key);
    if (existing) {
      if (!sameScenarioV1(existing, expected)) throw new Error("CAP08_B_PHASE_EXISTING_SCENARIO_HASH_CONFLICT");
      this.staged = null;
      return { status: "EXISTING_IDEMPOTENT_SUCCESS", record: existing, fact_id: `fact_${existing.scenario_set.object_id}` };
    }
    if (!this.staged) throw new Error("CAP08_B_PHASE_STAGED_SCENARIO_REQUIRED");
    if (!sameScenarioV1(this.staged.record, expected)) throw new Error("CAP08_B_PHASE_STAGED_SCENARIO_MISMATCH");
    const committed = await this.canonical.commitScenarioSet(this.staged);
    const readback = await this.canonical.readScenarioSet(committed.record.scenario_set_id);
    if (!readback || !sameScenarioV1(readback, expected)) throw new Error("CAP08_B_PHASE_CANONICAL_READBACK_MISMATCH");
    this.staged = null;
    return { status: committed.status, record: readback, fact_id: committed.fact_id };
  }
}
