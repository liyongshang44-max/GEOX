// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_08_S2_COMPLETION_AUTHORITY_NEGATIVE_DB.ts
// Purpose: prove persisted CAP-08 completion authority, exact completed-run readback, and N1-N14 fail-closed PostgreSQL behavior.
// Boundary: destructive fresh-database pre-candidate gate only; no formal S2 providers, candidate transition, S2 effectiveness, S3, route, scheduler, or production claim.

import {
  assert,
  CAP08_PHASE_ORDER_V1,
  CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
  CAP08_S1_RUN_CONTRACT_ID_V1,
  CAP08_S1_RUNTIME_START_V1,
  CAP08_S1_TICK_COUNT_V1,
  cap08TickLogicalTimeV1,
  CAP08_COMPLETION_AUTHORITY_KIND_V1,
  PostgresCompletionAuthorityRepositoryV1,
  PostgresForecastScenarioRecoveryRepositoryV1,
  PostgresNextTickRepositoryV1,
  PostgresRuntimeRepositoryV1,
  A0BootstrapRuntimeServiceV1,
  Cap04ForecastScenarioSingleTickServiceV1,
  Cap08CompletionAuthorityServiceV1,
  Cap08DeferredScenarioPersistenceV1,
  Cap08FrozenEvidenceSourceV1,
  Cap08S1BaseRangeServiceV1,
  Cap08S1BaseRuntimeServiceV1,
  Cap08S1BaseTickServiceV1,
  PrepareNextTickInputServiceV1,
  buildCap08S1FixtureV1,
  CAP08_S1_CREATED_AT_V1,
  databaseName,
  runner,
  admin,
  sourceDigestV1,
  persistenceAdapterV1,
  invariantSnapshotV1,
  cloneV1,
  authorityRowV1,
  scopeValuesV1,
  writeResultV1,
  cap08CompletionAuthorityStorageRefV1,
  type InspectCap08CompletionAuthorityInputV1,
} from "./mcft_cap08_s2_g3_acceptance_support_v1.js";
import { runNegativeCasesV1 } from "./mcft_cap08_s2_g3_negative_cases_v1.js";

async function main(): Promise<void> {
  const checks: Array<{ name: string; status: "PASS" }> = [];
  const ok = (name: string): void => { checks.push({ name, status: "PASS" }); console.log(`PASS ${name}`); };
  try {
    const identity = await runner.query("SELECT current_user AS current_user,current_database() AS current_database");
    assert.equal(identity.rows[0].current_user, "geox_mcft_cap08_runner_v1");
    assert.equal(identity.rows[0].current_database, databaseName);
    ok("bounded CAP-08 runner identity connected to fresh G3 target database");

    const fixture = buildCap08S1FixtureV1();
    const runtimeRepository = new PostgresRuntimeRepositoryV1(runner);
    const nextTickRepository = new PostgresNextTickRepositoryV1(runner);
    const forecastRepository = new PostgresForecastScenarioRecoveryRepositoryV1(runner);
    const completionRepository = new PostgresCompletionAuthorityRepositoryV1(runner);
    const completionService = new Cap08CompletionAuthorityServiceV1(completionRepository);
    await nextTickRepository.commitRealityBindingSnapshot(fixture.reality_binding_snapshot);
    for (const config of fixture.runtime_configs) await runtimeRepository.commitRuntimeConfig(config);
    const callOrder: string[] = [];
    const canonicalPersistence = persistenceAdapterV1(runtimeRepository, forecastRepository, callOrder);
    const deferred = new Cap08DeferredScenarioPersistenceV1(canonicalPersistence);
    const frozenEvidence = new Cap08FrozenEvidenceSourceV1(fixture.evidence_source);
    const handoff = new PrepareNextTickInputServiceV1(nextTickRepository);
    const cap04Tick = new Cap04ForecastScenarioSingleTickServiceV1(
      handoff,
      frozenEvidence,
      runtimeRepository,
      deferred,
    );
    const cap08Tick = new Cap08S1BaseTickServiceV1(handoff, frozenEvidence, deferred, cap04Tick);
    const phaseSourceDigest = sourceDigestV1();
    const range = new Cap08S1BaseRangeServiceV1(handoff, cap08Tick, phaseSourceDigest, completionService);
    const bootstrap = new A0BootstrapRuntimeServiceV1(runtimeRepository, runtimeRepository, fixture.evidence_source);
    const runtime = new Cap08S1BaseRuntimeServiceV1(bootstrap, range);
    const runtimeInput = {
      formal_run_id: fixture.formal_run_id,
      scope: fixture.scope,
      created_at: CAP08_S1_CREATED_AT_V1,
      bootstrap_runtime_config: fixture.bootstrap_runtime_config,
      bootstrap_hydraulic: fixture.hydraulic,
      soil_hydraulic_config_ref: "soil_hydraulic_config_c8_v1",
      runtime_config_refs_by_logical_time: fixture.runtime_config_refs_by_logical_time,
      runtime_config_hashes_by_logical_time: fixture.runtime_config_hashes_by_logical_time,
      authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
      crop_stage_context: fixture.crop_stage_context,
      lease_owner: "mcft-cap08-s2-g3",
      lease_duration_seconds: 300,
    } as const;
    const first = await runtime.execute(runtimeInput);
    assert.equal(first.status, "COMPLETED");
    assert.equal(first.range.completion_authority_write_status, "INSERTED");
    assert.equal(first.range.completion_authority_disposition, "ALREADY_COMPLETE_EXACT");
    assert.equal(first.range.executed_tick_count, 24);
    assert.equal(first.range.tick_results.length, 24);
    assert.ok(first.range.tick_results.every((tick) =>
      JSON.stringify(tick.phase_trace.map((phase) => phase.phase)) === JSON.stringify([...CAP08_PHASE_ORDER_V1])));
    assert.equal(callOrder.length, 48);
    ok("positive B00 plus T00-T23 run commits one exact completion authority");

    const terminalLogicalTime = cap08TickLogicalTimeV1(CAP08_S1_TICK_COUNT_V1 - 1);
    const expectedNextLogicalTime = new Date(Date.parse(terminalLogicalTime) + 3_600_000).toISOString();
    const inspectInput: InspectCap08CompletionAuthorityInputV1 = {
      run_contract_id: CAP08_S1_RUN_CONTRACT_ID_V1,
      formal_run_id: fixture.formal_run_id,
      scope: fixture.scope,
      initial_logical_time: CAP08_S1_RUNTIME_START_V1,
      terminal_logical_time: terminalLogicalTime,
      expected_next_logical_time: expectedNextLogicalTime,
      phase_engine_contract_digest: CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
      phase_engine_source_digest: phaseSourceDigest,
      expected_tick_count: 24,
      expected_state_count: 25,
      expected_forecast_count: 24,
      expected_scenario_set_count: 24,
    };
    const exact = await completionService.inspect(inspectInput);
    assert.equal(exact.disposition, "ALREADY_COMPLETE_EXACT");
    assert.equal(exact.graph?.terminal_tick_sequence, 24);
    assert.equal(exact.graph?.scenario_set_count, 24);
    ok("exact authority tuple, terminal graph and cardinality read back from PostgreSQL");

    const beforeReplay = await invariantSnapshotV1();
    const replay = await runtime.execute({ ...runtimeInput, lease_owner: "mcft-cap08-s2-g3-replay" });
    const afterReplay = await invariantSnapshotV1();
    assert.equal(replay.status, "ALREADY_COMPLETE");
    assert.equal(replay.range.executed_tick_count, 0);
    assert.equal(replay.range.completion_authority_write_status, null);
    assert.deepEqual(afterReplay, beforeReplay);
    assert.equal(callOrder.length, 48);
    ok("ALREADY_COMPLETE_EXACT rerun performs zero canonical, pointer or lease mutation");

    const authorityRef = cap08CompletionAuthorityStorageRefV1({ run_contract_id: inspectInput.run_contract_id, scope: inspectInput.scope });
    const originalAuthority = await authorityRowV1(authorityRef);
    const terminalCheckpointFact = (await admin.query(
      "SELECT fact_id,record_json FROM facts WHERE record_json->>'type'='twin_runtime_checkpoint_v1' AND record_json->'payload'->>'object_id'=$1",
      [originalAuthority.semantic_payload.terminal_checkpoint_ref],
    )).rows[0];
    assert.ok(terminalCheckpointFact);
    const terminalCheckpointObject = cloneV1(terminalCheckpointFact.record_json.payload as Record<string, any>);
    const previousCheckpointRef = String(terminalCheckpointObject.payload.previous_checkpoint_ref || "");
    assert.ok(previousCheckpointRef);
    const previousCheckpointFact = (await admin.query(
      "SELECT fact_id,record_json FROM facts WHERE record_json->>'type'='twin_runtime_checkpoint_v1' AND record_json->'payload'->>'object_id'=$1",
      [previousCheckpointRef],
    )).rows[0];
    assert.ok(previousCheckpointFact);
    const previousTickRef = String(previousCheckpointFact.record_json.payload.payload.last_completed_tick_ref || "");
    assert.ok(previousTickRef);
    const originalCheckpointPointer = cloneV1((await admin.query(
      `SELECT to_jsonb(t) AS row FROM twin_runtime_checkpoint_latest_index_v1 t
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
      scopeValuesV1(fixture.scope),
    )).rows[0].row as Record<string, unknown>);
    const terminalForecastFact = (await admin.query(
      "SELECT fact_id,record_json FROM facts WHERE record_json->>'type'='twin_forecast_run_v1' AND record_json->'payload'->>'object_id'=$1",
      [String(terminalCheckpointObject.payload.forecast_result_ref)],
    )).rows[0];
    assert.ok(terminalForecastFact);
    const earlyScenarioFact = (await admin.query(
      `SELECT fact_id,record_json FROM facts
       WHERE record_json->>'type'='twin_scenario_set_v1'
       ORDER BY (record_json->'payload'->>'logical_time')::timestamptz ASC LIMIT 1`,
    )).rows[0];
    assert.ok(earlyScenarioFact);
    const lineageFact = (await admin.query(
      "SELECT fact_id,record_json FROM facts WHERE record_json->>'type'='twin_runtime_lineage_v1' LIMIT 1",
    )).rows[0];
    assert.ok(lineageFact);

    const cases = await runNegativeCasesV1({
      completionService,
      inspectInput,
      authorityRef,
      originalAuthority,
      terminalCheckpointFact,
      previousCheckpointRef,
      previousCheckpointFact,
      previousTickRef,
      originalCheckpointPointer,
      terminalForecastFact,
      earlyScenarioFact,
      lineageFact,
      fixture,
    });
    ok("PostgreSQL N1-N14 completion authority matrix rejects with stable codes and zero restored deltas");

    const result = {
      schema_version: "geox_mcft_cap08_s2_completion_authority_negative_db_result_v1",
      status: "PASS",
      database_class: "FRESH_DISPOSABLE_POSTGRESQL_DATABASE",
      current_user: "geox_mcft_cap08_runner_v1",
      formal_run_id: fixture.formal_run_id,
      run_contract_id: CAP08_S1_RUN_CONTRACT_ID_V1,
      completion_authority_kind: CAP08_COMPLETION_AUTHORITY_KIND_V1,
      completion_authority_storage_ref: authorityRef,
      completion_authority_disposition: "ALREADY_COMPLETE_EXACT",
      terminal_logical_time: terminalLogicalTime,
      expected_next_logical_time: expectedNextLogicalTime,
      phase_engine_contract_digest: CAP08_S1_PHASE_ENGINE_CONTRACT_DIGEST_V1,
      phase_engine_source_digest: phaseSourceDigest,
      positive_tick_count: 24,
      positive_state_count: 25,
      positive_forecast_count: 24,
      positive_scenario_set_count: 24,
      negative_case_count: cases.length,
      negative_cases: cases,
      negative_case_invariants: {
        canonical_fact_delta_after_restore: 0,
        latest_pointer_delta_after_restore: 0,
        lease_mutation_after_restore: 0,
        foreign_object_consumed: false,
        stable_machine_error_code_required: true,
      },
      g1_state: "PASS_PRESENT_ON_MAIN",
      g2_state: "PASS_PRESENT_ON_MAIN",
      g3_implementation_state: "IMPLEMENTED",
      g3_database_acceptance_state: "PASS",
      formal_candidate_creation_authorized: true,
      s2_candidate_implemented: false,
      s2_effective: false,
      s3_authorized: false,
      independent_review_satisfied: false,
      independent_review_deferred: true,
      independent_review_required_before_formal_s2_candidate: true,
      checks,
    };
    writeResultV1(result);
    console.log(JSON.stringify(result));
  } catch (error) {
    const result = {
      schema_version: "geox_mcft_cap08_s2_completion_authority_negative_db_result_v1",
      status: "FAIL",
      error: error instanceof Error ? error.message : String(error),
      checks,
    };
    writeResultV1(result);
    throw error;
  } finally {
    await Promise.all([runner.end(), admin.end()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
