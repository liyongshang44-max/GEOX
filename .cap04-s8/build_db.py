from pathlib import Path

root = Path(__file__).resolve().parents[1]
source_path = root / "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE_DB.ts"
target_path = root / "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_RESTART_BACKFILL_DB.ts"
text = source_path.read_text(encoding="utf-8")

text = text.replace(
    "// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_TWENTY_FOUR_TICK_RANGE_DB.ts\n"
    "// Purpose: prove the S7 standard closure fixture commits exactly 24 contiguous A1+B ticks, 24 immutable Configs, frozen canonical fact counts, projection counts, and checkpoint sequence 72 in isolated PostgreSQL.\n"
    "// Boundary: destructive isolated-database acceptance only; no A2 closure fixture, restart/backfill mode, route, web, scheduler, recommendation, decision, AO-ACT, live data, or field claim.",
    "// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_04_RESTART_BACKFILL_DB.ts\n"
    "// Purpose: prove real PostgreSQL resumes CAP-04 after 12 ticks through a fresh service composition, executes the remaining 12 ticks, preserves canonical cardinalities, and makes completed-target retry zero-write.\n"
    "// Boundary: destructive isolated-database acceptance only; fencing/CAS, cross-variant uniqueness and projection rebuild are exercised by the companion persistence regression suites.",
)
text = text.replace(
    'import { Cap04ForecastScenarioRangeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_range_service_v1.js";',
    'import { Cap04ForecastScenarioRangeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_range_service_v1.js";\n'
    'import { Cap04ForecastScenarioRestartResumeServiceV1 } from "../../apps/server/src/runtime/twin_runtime/forecast_scenario_restart_resume_service_v1.js";',
)
text = text.replace("MCFT_CAP_04_RANGE_DESTRUCTIVE_ACCEPTANCE", "MCFT_CAP_04_S8_DESTRUCTIVE_ACCEPTANCE")
text = text.replace("SET_MCFT_CAP_04_RANGE_DESTRUCTIVE_ACCEPTANCE_1", "SET_MCFT_CAP_04_S8_DESTRUCTIVE_ACCEPTANCE_1")
text = text.replace("/(mcft|cap04|s7|range|acceptance|test)/", "/(mcft|cap04|s8|restart|backfill|acceptance|test)/")
text = text.replace(
    'const TARGET_LOGICAL_TIME = "2026-06-04T01:00:00.000Z";',
    'const PROCESS_1_TARGET_LOGICAL_TIME = "2026-06-03T13:00:00.000Z";\nconst TARGET_LOGICAL_TIME = "2026-06-04T01:00:00.000Z";',
)
text = text.replace("cap04_s7", "cap04_s8").replace("cap04-s7", "cap04-s8")

old = '''    const handoff = new PrepareNextTickInputServiceV1(nextTickRepository);
    const persistence = persistenceAdapterV1(runtimeRepository, repository);
    const inner = new Cap04ForecastScenarioSingleTickServiceV1(handoff, source, runtimeRepository, persistence);
    const barrier = new Cap04PendingScenarioBarrierSingleTickServiceV1(handoff, runtimeRepository, persistence, inner);
    const rangeService = new Cap04ForecastScenarioRangeServiceV1(handoff, barrier);
    const configRefs: Record<string, string> = {};
    const configHashes: Record<string, string> = {};
    for (const config of configs) {
      const payload = config.payload as unknown as Cap04RuntimeConfigPayloadV1;
      configRefs[payload.effective_logical_time] = config.object_id;
      configHashes[payload.effective_logical_time] = config.determinism_hash;
    }
    const result = await rangeService.runContiguousRange({
      scope,
      to_logical_time: TARGET_LOGICAL_TIME,
      created_at: CREATED_AT,
      runtime_config_refs_by_logical_time: configRefs,
      runtime_config_hashes_by_logical_time: configHashes,
      authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
      crop_stage_context: cropStageContext,
      lease_owner: "mcft-cap04-s8-db-acceptance",
      lease_duration_seconds: 300,
    });

    assert.equal(result.status, "COMPLETED");
    assert.equal(result.executed_tick_count, 24);
    assert.equal(result.successful_a1_tick_count, 24);
    assert.equal(result.blocked_a2_tick_count, 0);
    assert.equal(result.posterior_state_count, 24);
    assert.equal(result.successful_forecast_run_count, 24);
    assert.equal(result.scenario_set_count, 24);
    assert.equal(result.forecast_point_count, 1728);
    assert.equal(result.scenario_point_count, 5184);
    assert.equal(result.final_handoff.previous_tick_sequence, 72);
    assert.equal(result.final_handoff.next_logical_tick_time, FINAL_NEXT_LOGICAL_TIME);
    assert.equal(evidenceLoads, 24);
    ok("real PostgreSQL executes exactly 24 contiguous A1+B ticks from CAP-03 sequence 48");
'''
new = '''    const persistence = persistenceAdapterV1(runtimeRepository, repository);
    const configRefs: Record<string, string> = {};
    const configHashes: Record<string, string> = {};
    for (const config of configs) {
      const payload = config.payload as unknown as Cap04RuntimeConfigPayloadV1;
      configRefs[payload.effective_logical_time] = config.object_id;
      configHashes[payload.effective_logical_time] = config.determinism_hash;
    }
    const commonInput = {
      scope,
      created_at: CREATED_AT,
      runtime_config_refs_by_logical_time: configRefs,
      runtime_config_hashes_by_logical_time: configHashes,
      authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
      crop_stage_context: cropStageContext,
      lease_duration_seconds: 300,
    };

    const handoff1 = new PrepareNextTickInputServiceV1(nextTickRepository);
    const inner1 = new Cap04ForecastScenarioSingleTickServiceV1(handoff1, source, runtimeRepository, persistence);
    const barrier1 = new Cap04PendingScenarioBarrierSingleTickServiceV1(handoff1, runtimeRepository, persistence, inner1);
    const rangeService1 = new Cap04ForecastScenarioRangeServiceV1(handoff1, barrier1);
    const process1 = await rangeService1.runContiguousRange({
      ...commonInput,
      to_logical_time: PROCESS_1_TARGET_LOGICAL_TIME,
      lease_owner: "mcft-cap04-s8-db-process-1",
    });
    assert.equal(process1.status, "COMPLETED");
    assert.equal(process1.executed_tick_count, 12);
    assert.equal(process1.final_handoff.previous_tick_sequence, 60);
    assert.equal(process1.final_handoff.next_logical_tick_time, "2026-06-03T14:00:00.000Z");
    ok("real PostgreSQL process 1 executes ticks 1 through 12 and persists sequence 60");

    const handoff = new PrepareNextTickInputServiceV1(nextTickRepository);
    const inner2 = new Cap04ForecastScenarioSingleTickServiceV1(handoff, source, runtimeRepository, persistence);
    const barrier2 = new Cap04PendingScenarioBarrierSingleTickServiceV1(handoff, runtimeRepository, persistence, inner2);
    const rangeService = new Cap04ForecastScenarioRangeServiceV1(handoff, barrier2);
    const restartService = new Cap04ForecastScenarioRestartResumeServiceV1(handoff, rangeService);
    const process2 = await restartService.resumeFromCheckpoint({
      ...commonInput,
      to_logical_time: TARGET_LOGICAL_TIME,
      lease_owner: "mcft-cap04-s8-db-fresh-process-2",
    });
    assert.equal(process2.operator_intent, "RESUME");
    assert.equal(process2.persisted_start_logical_time, "2026-06-03T14:00:00.000Z");
    const result = process2.range_result;
    assert.equal(result.status, "COMPLETED");
    assert.equal(result.executed_tick_count, 12);
    assert.equal(result.successful_a1_tick_count, 12);
    assert.equal(result.blocked_a2_tick_count, 0);
    assert.equal(result.posterior_state_count, 12);
    assert.equal(result.successful_forecast_run_count, 12);
    assert.equal(result.scenario_set_count, 12);
    assert.equal(result.forecast_point_count, 864);
    assert.equal(result.scenario_point_count, 2592);
    assert.equal(result.final_handoff.previous_tick_sequence, 72);
    assert.equal(result.final_handoff.next_logical_tick_time, FINAL_NEXT_LOGICAL_TIME);
    assert.equal(evidenceLoads, 24);
    ok("fresh PostgreSQL service composition resumes at tick 13 and executes ticks 13 through 24");
'''
if old not in text:
    raise SystemExit("S8_DB_MAIN_BLOCK_NOT_FOUND")
text = text.replace(old, new)

old_replay = '''    const replay = await rangeService.runContiguousRange({
      scope,
      to_logical_time: TARGET_LOGICAL_TIME,
      created_at: CREATED_AT,
      runtime_config_refs_by_logical_time: configRefs,
      runtime_config_hashes_by_logical_time: configHashes,
      authorized_future_forcing_binding_ids: ["binding_weather", "binding_et0"],
      crop_stage_context: cropStageContext,
      lease_owner: "mcft-cap04-s8-db-acceptance",
      lease_duration_seconds: 300,
    });
    assert.equal(replay.status, "ALREADY_COMPLETE");
    assert.equal(replay.executed_tick_count, 0);
'''
new_replay = '''    const replayEnvelope = await restartService.resumeFromCheckpoint({
      ...commonInput,
      to_logical_time: TARGET_LOGICAL_TIME,
      lease_owner: "mcft-cap04-s8-db-completed-retry",
    });
    const replay = replayEnvelope.range_result;
    assert.equal(replay.status, "ALREADY_COMPLETE");
    assert.equal(replay.executed_tick_count, 0);
'''
if old_replay not in text:
    raise SystemExit("S8_DB_REPLAY_BLOCK_NOT_FOUND")
text = text.replace(old_replay, new_replay)
text = text.replace("completed PostgreSQL target replay", "completed PostgreSQL restart retry")
text = text.replace("MCFT-CAP-04 24-tick range DB", "MCFT-CAP-04 S8 restart/backfill DB")

target_path.write_text(text, encoding="utf-8")
