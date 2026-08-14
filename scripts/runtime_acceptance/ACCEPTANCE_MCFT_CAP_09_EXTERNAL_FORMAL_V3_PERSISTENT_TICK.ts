import assert from "node:assert/strict";

import type { CanonicalObjectEnvelopeV1 } from "../../apps/server/src/domain/twin_runtime/canonical_object_contracts_v1.js";
import { CAP04_A1_OPERATION_VARIANT_V1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_contracts_v1.js";
import type { Cap04ARecordSetV1, Cap04ScenarioSetRecordV1 } from "../../apps/server/src/domain/twin_runtime/forecast_scenario_record_set_identity_v1.js";
import { buildExternalFormalCap04BlockedA2RecordSetV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_cap04_a_record_set_builder_v1.js";
import {
  ExternalFormalV3PersistentTickServiceV1,
  type ExecuteExternalFormalV3PersistentTickInputV1,
  type ExternalFormalV3DatabaseEvidenceSourcePortV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_v3_persistent_tick_service_v1.js";
import type { Cap04ForecastScenarioPersistencePortV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_persistence_ports_v1.js";
import type { PreparedNextTickInputV1, RuntimeConfigRepositoryPortV1, RuntimeLeaseClaimV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import type { ExternalFormalDatabaseEvidenceLoadResultV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_evidence_source_v1.js";
import {
  EA5B5B_CREATED_AT_V1,
  EA5B5B_LOGICAL_TIME_V1,
  buildEa5b5bExternalFixtureV1,
} from "./mcft_cap09_ea5b5b_external_fixture_v1.js";

function addMinutesV1(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

function delayedExactRecordsV1<T extends { record_type: string; available_to_runtime_at: string; role_time: Record<string, unknown> }>(records: readonly T[]): T[] {
  const result = structuredClone(records) as T[];
  for (const record of result) {
    if (record.record_type !== "observed_rainfall_v1" && record.record_type !== "historical_et0_estimate_v1") continue;
    record.available_to_runtime_at = addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 390);
    record.role_time.ingested_at = addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 391);
  }
  return result;
}

function memberV1(recordSet: Cap04ARecordSetV1, objectType: string): CanonicalObjectEnvelopeV1 {
  const matches = recordSet.members.filter((member) => member.object_type === objectType);
  assert.equal(matches.length, 1, `fixture member cardinality ${objectType}`);
  return matches[0];
}

function nextHandoffV1(base: PreparedNextTickInputV1, a: Cap04ARecordSetV1): PreparedNextTickInputV1 {
  const state = memberV1(a, "twin_state_estimate_v1");
  const checkpoint = memberV1(a, "twin_runtime_checkpoint_v1");
  const forecast = memberV1(a, "twin_forecast_run_v1");
  return {
    ...structuredClone(base),
    previous_posterior_ref: state.object_id,
    previous_posterior_hash: state.determinism_hash,
    previous_checkpoint_ref: checkpoint.object_id,
    previous_checkpoint_hash: checkpoint.determinism_hash,
    previous_forecast_result_ref: forecast.object_id,
    previous_forecast_result_hash: forecast.determinism_hash,
    latest_successful_forecast_ref: a.operation_key.operation_variant === CAP04_A1_OPERATION_VARIANT_V1 ? forecast.object_id : base.latest_successful_forecast_ref,
    previous_tick_sequence: base.previous_tick_sequence + 1,
    next_logical_tick_time: addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 60),
    previous_state_runtime_config_ref: state.runtime_config_ref,
    previous_state_runtime_config_hash: state.runtime_config_hash,
  };
}

class FakePersistenceV1 {
  a: Cap04ARecordSetV1 | null = null;
  b: Cap04ScenarioSetRecordV1 | null = null;
  aWrites = 0;
  bWrites = 0;
  aLease: RuntimeLeaseClaimV1 | null = null;
  bLease: RuntimeLeaseClaimV1 | null = null;
  failNextScenarioCommit = false;

  port(): Cap04ForecastScenarioPersistencePortV1 {
    const self = this;
    return {
      async lookupARecordSet(idempotencyKey) {
        return self.a?.idempotency_key === idempotencyKey ? structuredClone(self.a) : null;
      },
      async commitARecordSet(input) {
        self.aLease = structuredClone(input.lease);
        if (self.a) {
          assert.equal(self.a.aggregate_determinism_hash, input.record_set.aggregate_determinism_hash);
          return { status: "EXISTING_IDEMPOTENT_SUCCESS" as const, record_set: structuredClone(self.a), fact_ids_by_object_id: {} };
        }
        self.a = structuredClone(input.record_set);
        self.aWrites += 1;
        return { status: "INSERTED" as const, record_set: structuredClone(self.a), fact_ids_by_object_id: {} };
      },
      async readARecordSet(recordSetId) {
        return self.a?.record_set_id === recordSetId ? structuredClone(self.a) : null;
      },
      async lookupScenarioSet(idempotencyKey) {
        return self.b?.idempotency_key === idempotencyKey ? structuredClone(self.b) : null;
      },
      async commitScenarioSet(input) {
        self.bLease = structuredClone(input.lease);
        if (self.failNextScenarioCommit) {
          self.failNextScenarioCommit = false;
          throw new Error("QUALIFICATION_INJECTED_SCENARIO_COMMIT_FAILURE");
        }
        if (self.b) {
          assert.equal(self.b.aggregate_determinism_hash, input.record.aggregate_determinism_hash);
          return { status: "EXISTING_IDEMPOTENT_SUCCESS" as const, record: structuredClone(self.b), fact_id: `fact_${self.b.scenario_set_id}` };
        }
        self.b = structuredClone(input.record);
        self.bWrites += 1;
        return { status: "INSERTED" as const, record: structuredClone(self.b), fact_id: `fact_${self.b.scenario_set_id}` };
      },
      async readScenarioSet(scenarioSetId) {
        return self.b?.scenario_set_id === scenarioSetId ? structuredClone(self.b) : null;
      },
      async readScenarioSetBySourceForecast(sourceForecastRef, sourceForecastHash) {
        if (!self.b) return null;
        const payload = self.b.scenario_set.payload;
        return payload.source_forecast_ref === sourceForecastRef && payload.source_forecast_hash === sourceForecastHash
          ? structuredClone(self.b)
          : null;
      },
      async detectPendingScenario() { return null; },
      async rebuildForecastProjections() { return { rebuilt_forecast_run_count: 1 as const, rebuilt_forecast_point_count: 72 as const }; },
      async rebuildScenarioProjections() { return { rebuilt_scenario_set_count: 1 as const, rebuilt_scenario_point_count: 216 as const, rebuilt_latest_count: 1 as const }; },
    };
  }
}

async function buildHarnessV1() {
  const fixture = await buildEa5b5bExternalFixtureV1();
  const records = delayedExactRecordsV1(fixture.candidates);
  const persistence = new FakePersistenceV1();
  let evidenceCalls = 0;
  const evidenceSource: ExternalFormalV3DatabaseEvidenceSourcePortV1 = {
    async loadCandidateRecords(input) {
      evidenceCalls += 1;
      assert.deepEqual(input.scope, fixture.scope);
      assert.equal(input.logical_time, EA5B5B_LOGICAL_TIME_V1);
      assert.equal(input.evidence_snapshot_time, addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 432));
      const result: ExternalFormalDatabaseEvidenceLoadResultV1 = {
        source_id: "MCFT_CAP09_EXTERNAL_FORMAL_DATABASE_EVIDENCE_SOURCE_V1",
        scope: structuredClone(fixture.scope),
        logical_time: EA5B5B_LOGICAL_TIME_V1,
        evidence_snapshot_time: input.evidence_snapshot_time,
        records,
        selected_record_count: records.length,
        family_cardinality: { soil: 1, rainfall: 1, historical_et0: 1, future_weather: 1, future_et0: 1 },
        excluded_after_causal_cutoff_count: 0,
        excluded_non_target_exact_interval_count: 0,
        database_read_transaction_count: 1,
        database_write_count: 0,
        provider_request_count: 0,
      };
      return result;
    },
  };
  const configRepo = {
    async readRuntimeConfig(objectId: string) {
      return objectId === fixture.hourly.object_id ? structuredClone(fixture.hourly) : null;
    },
    async commitRuntimeConfig() { throw new Error("QUALIFICATION_RUNTIME_CONFIG_WRITE_FORBIDDEN"); },
  } as RuntimeConfigRepositoryPortV1;
  const handoffPort = {
    async prepareNextTickInput(scope: TwinScopeKeyV1) {
      assert.deepEqual(scope, fixture.scope);
      return persistence.a ? nextHandoffV1(fixture.handoff, persistence.a) : structuredClone(fixture.handoff);
    },
  };
  const service = new ExternalFormalV3PersistentTickServiceV1(handoffPort, evidenceSource, configRepo, persistence.port());
  const cropAuthority = fixture.hourly.payload.crop_stage_context_authority as Record<string, unknown>;
  const input: ExecuteExternalFormalV3PersistentTickInputV1 = {
    claim: {
      boundary: {
        scope: structuredClone(fixture.scope),
        slot_id: "O00",
        logical_time: EA5B5B_LOGICAL_TIME_V1,
        scheduler_wall_clock_observed_at: addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 420),
        interval_seconds: 3600,
      },
      lease_owner: "ea5e2-v3-qualification-owner",
      fencing_token: 7n,
      state: "CLAIMED",
      idempotency_key: "ea5e2-v3-qualification-slot",
    },
    manifest_slot: {
      manifest_ref: "qualification://mcft-cap09/external-formal-v3/window-manifest",
      manifest_hash: "sha256:qualification-external-formal-v3-window-manifest",
      epoch_id: "qualification_epoch_not_formal_authority",
      slot_id: "O00",
      logical_time: EA5B5B_LOGICAL_TIME_V1,
      runtime_config_ref: fixture.hourly.object_id,
      runtime_config_hash: fixture.hourly.determinism_hash,
      crop_stage_context_ref: String(cropAuthority.context_ref),
      crop_stage_context_hash: String(cropAuthority.context_hash),
    },
    crop_stage_context: structuredClone(fixture.crop),
    observer_started_at: addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 437),
    lease_duration_seconds: 900,
  };
  return { fixture, persistence, service, input, evidenceCalls: () => evidenceCalls };
}

async function main(): Promise<void> {
  const positive = await buildHarnessV1();
  const inserted = await positive.service.executeClaimedTick(positive.input);
  assert.equal(inserted.status, "INSERTED_A1_WITH_SCENARIO");
  assert.equal(inserted.a_record_set.operation_key.operation_variant, CAP04_A1_OPERATION_VARIANT_V1);
  assert.equal(inserted.b_record?.scenario_set.payload.options.length, 3);
  assert.equal(inserted.b_record?.scenario_set.payload.options.reduce((sum, option) => sum + option.trajectory_points.length, 0), 216);
  assert.equal(inserted.evidence_snapshot_time, addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 432));
  assert.equal(inserted.observer_start_skew_minutes, 0);
  assert.equal(inserted.next_logical_tick_time, addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 60));
  assert.equal(inserted.scheduler_claim_reused_as_runtime_lease, true);
  assert.equal(inserted.second_runtime_write_lease_acquired, false);
  assert.equal(inserted.runtime_provider_request_count, 0);
  assert.equal(inserted.runtime_r2_head_count, 0);
  assert.deepEqual([
    inserted.recommendation_write_count,
    inserted.approval_write_count,
    inserted.action_write_count,
    inserted.dispatch_write_count,
    inserted.model_activation_write_count,
  ], [0, 0, 0, 0, 0]);
  assert.equal(positive.persistence.aWrites, 1);
  assert.equal(positive.persistence.bWrites, 1);
  assert.equal(positive.evidenceCalls(), 1);
  assert.equal(positive.persistence.aLease?.lease_owner, positive.input.claim.lease_owner);
  assert.equal(positive.persistence.bLease?.lease_owner, positive.input.claim.lease_owner);
  assert.equal(positive.persistence.aLease?.fencing_token, positive.input.claim.fencing_token);
  assert.equal(positive.persistence.bLease?.fencing_token, positive.input.claim.fencing_token);

  const replay = await positive.service.executeClaimedTick(positive.input);
  assert.equal(replay.status, "EXISTING_A1_WITH_SCENARIO");
  assert.equal(replay.a_record_set.aggregate_determinism_hash, inserted.a_record_set.aggregate_determinism_hash);
  assert.equal(replay.b_record?.aggregate_determinism_hash, inserted.b_record?.aggregate_determinism_hash);
  assert.equal(positive.persistence.aWrites, 1);
  assert.equal(positive.persistence.bWrites, 1);
  assert.equal(positive.evidenceCalls(), 1, "existing canonical A must not reload provider/ingress evidence");

  const recovery = await buildHarnessV1();
  recovery.persistence.failNextScenarioCommit = true;
  await assert.rejects(
    () => recovery.service.executeClaimedTick(recovery.input),
    /QUALIFICATION_INJECTED_SCENARIO_COMMIT_FAILURE/,
  );
  assert.equal(recovery.persistence.aWrites, 1);
  assert.equal(recovery.persistence.bWrites, 0);
  assert.equal(recovery.evidenceCalls(), 1);
  const recovered = await recovery.service.executeClaimedTick(recovery.input);
  assert.equal(recovered.status, "RECOVERED_PENDING_SCENARIO");
  assert.equal(recovery.persistence.aWrites, 1);
  assert.equal(recovery.persistence.bWrites, 1);
  assert.equal(recovery.evidenceCalls(), 1, "pending-B recovery must use canonical Forecast without reloading Evidence");

  const early = await buildHarnessV1();
  const earlyInput = structuredClone(early.input);
  earlyInput.observer_started_at = addMinutesV1(EA5B5B_LOGICAL_TIME_V1, 436);
  await assert.rejects(
    () => early.service.executeClaimedTick(earlyInput),
    /EXTERNAL_FORMAL_V3_OBSERVER_START_SKEW_OUT_OF_RANGE/,
  );
  assert.equal(early.persistence.aWrites, 0);
  assert.equal(early.evidenceCalls(), 0);

  const badConfig = await buildHarnessV1();
  const badConfigInput = structuredClone(badConfig.input);
  badConfigInput.manifest_slot.runtime_config_hash = "sha256:wrong-manifest-pin";
  await assert.rejects(
    () => badConfig.service.executeClaimedTick(badConfigInput),
    /EXTERNAL_FORMAL_V3_RUNTIME_CONFIG_HASH_MISMATCH/,
  );
  assert.equal(badConfig.persistence.aWrites, 0);

  const a2 = await buildHarnessV1();
  const h = a2.fixture.handoff;
  const blocked = buildExternalFormalCap04BlockedA2RecordSetV1({
    scope: a2.fixture.scope,
    lineage_id: h.lineage_id,
    revision_id: h.revision_id,
    logical_time: EA5B5B_LOGICAL_TIME_V1,
    created_at: EA5B5B_CREATED_AT_V1,
    active_lineage_ref: h.active_lineage_ref,
    previous_posterior_ref: h.previous_posterior_ref,
    previous_posterior_hash: h.previous_posterior_hash,
    previous_checkpoint_ref: h.previous_checkpoint_ref,
    previous_checkpoint_hash: h.previous_checkpoint_hash,
    previous_forecast_result_ref: h.previous_forecast_result_ref,
    previous_forecast_result_hash: String(h.previous_forecast_result_hash),
    previous_successful_forecast_ref: h.latest_successful_forecast_ref,
    previous_tick_sequence: h.previous_tick_sequence,
    runtime_config: a2.fixture.hourly,
    source_members: a2.fixture.sourceMembers,
    forecast_payload: a2.fixture.externalBlockedForecast.forecast_candidate,
  }).record_set;
  a2.persistence.a = structuredClone(blocked);
  const blockedResult = await a2.service.executeClaimedTick(a2.input);
  assert.equal(blockedResult.status, "EXISTING_A2_BLOCKED");
  assert.equal(blockedResult.b_record, null);
  assert.equal(a2.persistence.bWrites, 0);
  assert.equal(a2.evidenceCalls(), 0);

  console.log(JSON.stringify({
    status: "PASS",
    service_id: inserted.service_id,
    exact_interval_cutoff_minutes: 432,
    runtime_observer_offset_minutes: 437,
    observer_max_start_skew_minutes: 10,
    a1_insert_and_scenario_commit: true,
    idempotent_existing_a_b: true,
    pending_scenario_recovery_without_evidence_reload: true,
    scheduler_claim_reused_as_runtime_lease: true,
    second_runtime_write_lease_acquired: false,
    a2_scenario_forbidden: true,
    runtime_provider_request_count: 0,
    runtime_r2_head_count: 0,
    real_formal_database_write_count: 0,
    successor_epoch_selected: false,
    ea5e3_authorized: false,
    formal_window_started: false,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
