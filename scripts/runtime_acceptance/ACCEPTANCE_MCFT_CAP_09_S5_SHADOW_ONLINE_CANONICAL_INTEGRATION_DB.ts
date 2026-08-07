import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildCap05ActionFeedbackV1 } from "../../apps/server/src/domain/twin_runtime/feedback_canonical_contracts_v1.js";
import type { CanonicalReplayEvidenceRecordV1, TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { PostgresFeedbackPersistenceRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_feedback_persistence_repository_v1.js";
import { PostgresEvidenceIngressAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.js";
import { PostgresExpiredSlotRecoveryAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_expired_slot_recovery_adapter_v1.js";
import { PostgresPersistentSequentialSchedulerAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.js";
import { PostgresCap04ShadowOnlineCanonicalTickAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_cap04_shadow_online_canonical_tick_adapter_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import { RestartBackfillStaleDetectionServiceV1 } from "../../apps/server/src/runtime/twin_runtime/restart_backfill_stale_detection_service_v1.js";
import { ShadowOnlineCanonicalIntegrationServiceV1 } from "../../apps/server/src/runtime/twin_runtime/shadow_online_canonical_integration_service_v1.js";
import { buildCap05S8ForecastResidualFixtureV1, InMemoryForecastResidualPersistenceV1, InMemoryHistoricalForecastSourceV1 } from "./mcft_cap_05_s8_forecast_residual_fixture_v1.js";
import { buildControlledAuthorityV1, persistenceAdapterV1, pool, resetSchemaV1, seedControlledAuthorityV1 } from "./mcft_cap09_s5_canonical_integration_support_v1.js";

if (process.env.MCFT_CAP_09_S5_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP_09_S5_DESTRUCTIVE_ACCEPTANCE_1");
const ROOT = process.cwd();
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_S5_SHADOW_ONLINE_CANONICAL_INTEGRATION_DB_RESULT.json");
const FORBIDDEN = ["twin_decision_record_v1", "twin_recommendation_v1", "decision_recommendation_v1", "approval_request_v1", "ao_act_task_v1", "ao_act_receipt_v1", "dispatch_request_v1", "model_activation_v1"];
const plus = (value: string, minutes: number) => new Date(Date.parse(value) + minutes * 60_000).toISOString();
const migration = (relativePath: string) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");

async function reset(): Promise<void> {
  await resetSchemaV1();
  await pool.query(migration("apps/server/db/migrations/2026_07_14_mcft_cap_05_feedback_persistence.sql"));
  await pool.query(migration("apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql"));
}
function occurred(record: CanonicalReplayEvidenceRecordV1): string {
  for (const key of ["observed_at", "interval_end", "issued_at", "executed_at"] as const) {
    const value = record.role_time[key];
    if (typeof value === "string" && value) return value;
  }
  return record.available_to_runtime_at;
}
function normalizeLegacyHistoricalEt0EpistemicForAcceptanceV1(records: readonly CanonicalReplayEvidenceRecordV1[]): CanonicalReplayEvidenceRecordV1[] {
  return records.map((source) => {
    const record = structuredClone(source);
    if (record.record_type === "historical_et0_estimate_v1") {
      assert.equal(source.epistemic_class, "OBSERVED", "LEGACY_ACCEPTANCE_ET0_DRIFT_EXPECTED");
      record.epistemic_class = "ESTIMATED";
    }
    return record;
  });
}
function assertCanonicalEpistemicClassesV1(records: readonly CanonicalReplayEvidenceRecordV1[]): void {
  for (const record of records) {
    if (record.record_type === "historical_et0_estimate_v1") assert.equal(record.epistemic_class, "ESTIMATED", "CANONICAL_HISTORICAL_ET0_EPISTEMIC_REQUIRED");
    if (record.record_type === "future_weather_assumption_v1" || record.record_type === "future_et0_assumption_v1") assert.equal(record.epistemic_class, "ASSUMED", "CANONICAL_FUTURE_FORCING_EPISTEMIC_REQUIRED");
  }
}
async function insert(records: readonly CanonicalReplayEvidenceRecordV1[]): Promise<void> {
  assertCanonicalEpistemicClassesV1(records);
  for (const record of records) {
    await pool.query(
      "INSERT INTO facts(fact_id,occurred_at,source,record_json) VALUES($1,$2::timestamptz,'system',$3::jsonb)",
      [`fact_s5_${record.source_record_id}`, occurred(record), JSON.stringify({ type: record.record_type, payload: record })],
    );
  }
}
async function forbiddenCount(): Promise<number> {
  return Number((await pool.query("SELECT count(*)::int n FROM facts WHERE record_json->>'type'=ANY($1::text[])", [FORBIDDEN])).rows[0].n);
}
async function schedulerSlot(scope: TwinScopeKeyV1, logicalTime: string) {
  const result = await pool.query(
    "SELECT state,fencing_token::text,tick_ref,health_ref FROM twin_shadow_online_scheduler_slot_v1 WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND logical_time=$7::timestamptz",
    [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id, logicalTime],
  );
  assert.equal(result.rows.length, 1);
  return result.rows[0];
}
const refs = (values: readonly string[]) => [...new Set(values)].sort();

async function runCap04DatabaseScenarioV1(kind: "completed" | "blocked") {
  await reset();
  const authority = await buildControlledAuthorityV1();
  const raw = kind === "blocked"
    ? authority.candidates.filter((record) => !["future_weather_assumption_v1", "future_et0_assumption_v1"].includes(record.record_type))
    : authority.candidates;
  const records = normalizeLegacyHistoricalEt0EpistemicForAcceptanceV1(raw);
  const seeded = await seedControlledAuthorityV1(authority, records);
  await insert(records);
  const owner = `s5-${kind}`;
  const canonicalInput = { ...seeded.input, lease_owner: owner };
  const scheduler = new PostgresPersistentSequentialSchedulerAdapterV1(pool, { scope: authority.scope, schedule_start_logical_time: authority.logicalTime });
  const preparation = new RestartBackfillStaleDetectionServiceV1(
    scheduler,
    new PostgresExpiredSlotRecoveryAdapterV1(pool, authority.scope),
    new PostgresEvidenceIngressAdapterV1(pool),
    seeded.nextTickRepository,
  );
  const canonical = new PostgresCap04ShadowOnlineCanonicalTickAdapterV1(
    pool,
    new PrepareNextTickInputServiceV1(seeded.nextTickRepository),
    seeded.runtimeRepository,
    persistenceAdapterV1(seeded.runtimeRepository, seeded.repository),
  );
  const integration = new ShadowOnlineCanonicalIntegrationServiceV1(preparation, scheduler, canonical);
  const first = await integration.executeOldestDueTick({
    scope: authority.scope,
    through_logical_time: authority.logicalTime,
    lease_owner: owner,
    lease_duration_seconds: 300,
    terminal_at: plus(authority.logicalTime, 5),
    canonical_input: canonicalInput,
  });
  assert.equal(first.status, "CANONICAL_TICK_TERMINAL");
  if (first.status !== "CANONICAL_TICK_TERMINAL") throw new Error("S5_TERMINAL_REQUIRED");
  const result = first.canonical;
  const slot = await schedulerSlot(authority.scope, authority.logicalTime);
  assert.equal(slot.fencing_token, first.preparation.claim.fencing_token.toString());
  assert.equal(result.scheduler_fencing_token, first.preparation.claim.fencing_token.toString());
  assert.deepEqual(refs(result.frozen_evidence_refs), refs(first.preparation.evidence.selected.map((item) => item.evidence_ref)));
  if (kind === "completed") {
    assert.equal(result.forecast_status, "COMPLETED");
    assert.equal(result.forecast_point_count, 72);
    assert.equal(result.scenario_option_count, 3);
    assert.deepEqual(result.canonical_transaction_families, ["A", "B", "F"]);
    assert.equal(first.terminal_state, "COMPLETED");
  } else {
    assert.equal(result.forecast_status, "BLOCKED");
    assert.equal(result.scenario_ref, null);
    assert.equal(result.c_residual_attempted, false);
    assert.equal(first.terminal_state, "DEGRADED");
  }
  const second = await integration.executeOldestDueTick({
    scope: authority.scope,
    through_logical_time: authority.logicalTime,
    lease_owner: owner,
    lease_duration_seconds: 300,
    terminal_at: plus(authority.logicalTime, 6),
    canonical_input: canonicalInput,
  });
  assert.equal(second.status, "NO_CANONICAL_TICK");
  assert.equal(await forbiddenCount(), 0);
  assert.equal(result.g_write_count, 0);
  return {
    status: "PASS", path: kind, terminal_state: first.terminal_state, forecast_status: result.forecast_status,
    canonical_transaction_families: result.canonical_transaction_families, exact_frozen_evidence_reused: true,
    shared_scheduler_canonical_fence: true, canonical_epistemic_classes_proven: true,
    legacy_acceptance_historical_et0_epistemic_normalized: true, forbidden_fact_count: 0, g_write_count: 0,
    action_creation_count: 0, h_read_only_consumed: result.h_read_only_consumed,
    c_residual_attempted: result.c_residual_attempted, c_residual_count: result.c_residual_count,
    c_residual_disposition: result.c_residual_disposition,
  };
}

async function runCap05NoResidualIntegrationV1() {
  await reset();
  const fixture = await buildCap05S8ForecastResidualFixtureV1();
  const records = normalizeLegacyHistoricalEt0EpistemicForAcceptanceV1(
    await fixture.outcome_evidence_source.loadCandidateRecords({ scope: fixture.scope, logical_time: fixture.input.logical_time }),
  );
  await insert(records);
  const historicalProjectionCountBeforeTick = Number((await pool.query("SELECT count(*)::int n FROM twin_forecast_run_projection_v1")).rows[0].n);
  assert.equal(historicalProjectionCountBeforeTick, 0, "CAP05_NO_MATCH_MUST_START_WITH_ZERO_POSTGRES_FORECAST_PROJECTIONS");
  const owner = "s5-cap05-no-residual";
  const scheduler = new PostgresPersistentSequentialSchedulerAdapterV1(pool, { scope: fixture.scope, schedule_start_logical_time: fixture.input.logical_time });
  const preparation = new RestartBackfillStaleDetectionServiceV1(
    scheduler,
    new PostgresExpiredSlotRecoveryAdapterV1(pool, fixture.scope),
    new PostgresEvidenceIngressAdapterV1(pool),
    fixture.runtime,
  );
  const canonical = new PostgresCap04ShadowOnlineCanonicalTickAdapterV1(
    pool,
    new PrepareNextTickInputServiceV1(fixture.runtime),
    fixture.runtime,
    fixture.runtime,
  );
  const integration = new ShadowOnlineCanonicalIntegrationServiceV1(preparation, scheduler, canonical);
  const first = await integration.executeOldestDueTick({
    scope: fixture.scope,
    through_logical_time: fixture.input.logical_time,
    lease_owner: owner,
    lease_duration_seconds: 300,
    terminal_at: plus(fixture.input.logical_time, 5),
    canonical_input: { ...fixture.input, lease_owner: owner },
  });
  assert.equal(first.status, "CANONICAL_TICK_TERMINAL");
  if (first.status !== "CANONICAL_TICK_TERMINAL") throw new Error("S5_CAP05_NO_RESIDUAL_TERMINAL_REQUIRED");
  const result = first.canonical;
  const slot = await schedulerSlot(fixture.scope, fixture.input.logical_time);
  assert.equal(first.terminal_state, "COMPLETED");
  assert.equal(result.forecast_status, "COMPLETED");
  assert.equal(result.c_residual_attempted, true);
  assert.equal(result.c_residual_count, 0);
  assert.equal(result.c_residual_disposition, "NO_ELIGIBLE_HISTORICAL_FORECAST");
  assert.equal(result.h_read_only_consumed, false);
  assert.deepEqual(result.canonical_transaction_families, ["A", "B", "F"]);
  assert.equal(slot.fencing_token, result.scheduler_fencing_token);
  assert.deepEqual(refs(result.frozen_evidence_refs), refs(first.preparation.evidence.selected.map((item) => item.evidence_ref)));
  const selectedObservation = records.find((record) => record.record_type === "soil_moisture_observation_v1");
  assert(selectedObservation);
  assert.equal(selectedObservation.role_time.observed_at, fixture.input.logical_time, "CAP05_NO_MATCH_CURRENT_OBSERVATION_TARGET_TIME_REQUIRED");
  const second = await integration.executeOldestDueTick({
    scope: fixture.scope,
    through_logical_time: fixture.input.logical_time,
    lease_owner: owner,
    lease_duration_seconds: 300,
    terminal_at: plus(fixture.input.logical_time, 6),
    canonical_input: { ...fixture.input, lease_owner: owner },
  });
  assert.equal(second.status, "NO_CANONICAL_TICK");
  assert.equal(await forbiddenCount(), 0);
  return {
    status: "PASS", path: "cap05_no_residual", terminal_state: first.terminal_state,
    forecast_status: result.forecast_status, canonical_transaction_families: result.canonical_transaction_families,
    exact_frozen_evidence_reused: true, shared_scheduler_canonical_fence: true,
    canonical_epistemic_classes_proven: true, legacy_acceptance_historical_et0_epistemic_normalized: true,
    current_observation_exact_target_time: true, postgres_forecast_projection_count_before_tick: historicalProjectionCountBeforeTick,
    forbidden_fact_count: 0, g_write_count: 0, action_creation_count: 0, h_read_only_consumed: false,
    c_residual_attempted: true, c_residual_count: 0, c_residual_disposition: result.c_residual_disposition,
  };
}

async function runPositiveResidualCompositionV1() {
  await reset();
  const fixture = await buildCap05S8ForecastResidualFixtureV1();
  const outcome = normalizeLegacyHistoricalEt0EpistemicForAcceptanceV1(
    await fixture.outcome_evidence_source.loadCandidateRecords({ scope: fixture.scope, logical_time: fixture.input.logical_time }),
  );
  await insert(outcome);
  const source = fixture.action_feedback;
  const payload = source.payload;
  const feedback = buildCap05ActionFeedbackV1({
    ...payload,
    scope: fixture.scope,
    event_id: `${payload.event_id}_validated_s5`,
    source_record_id: `${payload.source_record_id}_validated_s5`,
    validation_status: "VALIDATED",
    eligible_for_state_input: true,
    runtime_config_ref: source.runtime_config_ref,
    runtime_config_hash: source.runtime_config_hash,
    context_lineage_ref: source.context_lineage_ref,
    context_revision_ref: source.context_revision_ref,
    created_at: source.created_at,
  });
  const feedbackRepo = new PostgresFeedbackPersistenceRepositoryV1(pool);
  await feedbackRepo.commitCanonicalObject({ object: feedback });
  const before = Number((await pool.query("SELECT count(*)::int n FROM twin_action_feedback_projection_v1")).rows[0].n);
  assert.equal(before, 1);
  const owner = "s5-positive-c";
  const scheduler = new PostgresPersistentSequentialSchedulerAdapterV1(pool, { scope: fixture.scope, schedule_start_logical_time: fixture.input.logical_time });
  const boundary = { scope: structuredClone(fixture.scope), slot_id: "O00" as const, logical_time: fixture.input.logical_time, scheduler_wall_clock_observed_at: fixture.input.logical_time, interval_seconds: 3600 as const };
  const claim = await scheduler.claimDueSlot({ boundary, lease_owner: owner, lease_duration_seconds: 300 });
  const frozen = await new PostgresEvidenceIngressAdapterV1(pool).freezeEligibleEvidence({ boundary: claim.boundary });
  const historical = new InMemoryHistoricalForecastSourceV1([{ forecast: structuredClone(fixture.historical_forecast), source_posterior_action_feedback_refs: [feedback.object_id] }]);
  const residualPersistence = new InMemoryForecastResidualPersistenceV1();
  const canonical = new PostgresCap04ShadowOnlineCanonicalTickAdapterV1(
    pool,
    new PrepareNextTickInputServiceV1(fixture.runtime),
    fixture.runtime,
    fixture.runtime,
    historical,
    residualPersistence,
  );
  const result = await canonical.executeOneTick({ claim, evidence: frozen, canonical_input: { ...fixture.input, lease_owner: owner } });
  assert.equal(result.c_residual_count, 1);
  assert.equal(result.c_residual_disposition, "COMMITTED");
  assert.equal(result.h_read_only_consumed, true);
  assert.deepEqual(result.h_read_only_refs, [feedback.object_id]);
  assert.deepEqual(result.canonical_transaction_families, ["A", "B", "C", "F"]);
  await scheduler.recordTerminalResult({ claim, result: { boundary: structuredClone(claim.boundary), state: "COMPLETED", tick_ref: result.tick_ref, health_ref: result.health_ref, terminal_at: plus(fixture.input.logical_time, 5) } });
  assert.equal((await schedulerSlot(fixture.scope, fixture.input.logical_time)).fencing_token, result.scheduler_fencing_token);
  const after = Number((await pool.query("SELECT count(*)::int n FROM twin_action_feedback_projection_v1")).rows[0].n);
  assert.equal(after, before);
  assert.equal(await forbiddenCount(), 0);
  assert.throws(
    () => new PostgresCap04ShadowOnlineCanonicalTickAdapterV1(pool, new PrepareNextTickInputServiceV1(fixture.runtime), fixture.runtime, fixture.runtime, historical),
    /S5_RESIDUAL_PORT_OVERRIDE_PAIR_REQUIRED/,
  );
  return {
    status: "PASS", path: "cap05_positive_residual", terminal_state: "COMPLETED", forecast_status: result.forecast_status,
    canonical_transaction_families: result.canonical_transaction_families, exact_frozen_evidence_reused: true,
    shared_scheduler_canonical_fence: true, canonical_epistemic_classes_proven: true,
    legacy_acceptance_historical_et0_epistemic_normalized: true, h_read_only_consumed: true,
    h_read_only_refs: result.h_read_only_refs, execution_feedback_port_read_only_proven: after === before,
    preexisting_h_fixture_count: before, s5_h_write_count: after - before, c_residual_attempted: true,
    c_residual_count: result.c_residual_count, c_residual_disposition: result.c_residual_disposition,
    s5_adapter_positive_c_composition: true, residual_port_override_pair_guard: true,
    forbidden_fact_count: 0, g_write_count: result.g_write_count, action_creation_count: 0,
  };
}

async function main(): Promise<void> {
  try {
    const completed = await runCap04DatabaseScenarioV1("completed");
    const blocked = await runCap04DatabaseScenarioV1("blocked");
    const cap05_no_residual = await runCap05NoResidualIntegrationV1();
    const cap05_positive_residual = await runPositiveResidualCompositionV1();
    const output = {
      schema_version: "geox_mcft_cap09_s5_shadow_online_canonical_integration_db_result_v4",
      status: "PASS", completed, blocked, cap05_no_residual, cap05_positive_residual,
      canonical_families_proven: ["A", "B", "C", "F"], canonical_epistemic_classes_proven: true,
      legacy_acceptance_historical_et0_epistemic_normalized: true, cap05_no_match_exact_target_observation_proven: true,
      cap05_no_match_zero_historical_forecast_projection_before_tick: true,
      h_mode: "READ_ONLY_EXISTING_TRUSTWORTHY_EVIDENCE", g_write_count: 0, action_creation_count: 0,
      migration_delta: 0, external_effectiveness: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + "\n");
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    const failure = { schema_version: "geox_mcft_cap09_s5_shadow_online_canonical_integration_db_result_v4", status: "FAIL", error: String(error instanceof Error ? error.message : error), stack: error instanceof Error ? error.stack : null };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(failure, null, 2) + "\n");
    throw error;
  }
}
main().then(() => pool.end()).catch(async (error) => { console.error(error); process.exitCode = 1; await pool.end(); });
