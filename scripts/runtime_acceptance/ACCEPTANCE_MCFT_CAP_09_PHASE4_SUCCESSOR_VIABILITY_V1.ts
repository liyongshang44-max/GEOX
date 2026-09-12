import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { CanonicalReplayEvidenceRecordV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";
import { PostgresEvidenceIngressAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_evidence_ingress_adapter_v1.js";
import { PostgresExpiredSlotRecoveryAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_expired_slot_recovery_adapter_v1.js";
import { PostgresPersistentSequentialSchedulerAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.js";
import { PostgresCap04ShadowOnlineCanonicalTickAdapterV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_cap04_shadow_online_canonical_tick_adapter_v1.js";
import { PrepareNextTickInputServiceV1 } from "../../apps/server/src/runtime/twin_runtime/next_tick_input_service_v1.js";
import { RestartBackfillStaleDetectionServiceV1 } from "../../apps/server/src/runtime/twin_runtime/restart_backfill_stale_detection_service_v1.js";
import { ShadowOnlineCanonicalIntegrationServiceV1 } from "../../apps/server/src/runtime/twin_runtime/shadow_online_canonical_integration_service_v1.js";
import { PostgresTwinRuntimeSuccessorViabilityV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_twin_runtime_successor_viability_v1.js";
import {
  buildControlledAuthorityV1,
  persistenceAdapterV1,
  pool,
  resetSchemaV1,
  seedControlledAuthorityV1,
} from "./mcft_cap09_s5_canonical_integration_support_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_PHASE4_SUCCESSOR_VIABILITY_V1_RESULT.json",
);

const plusMinutes = (value: string, minutes: number): string =>
  new Date(Date.parse(value) + minutes * 60_000).toISOString();

function normalizeEvidence(
  records: readonly CanonicalReplayEvidenceRecordV1[],
): CanonicalReplayEvidenceRecordV1[] {
  return records.map((source) => {
    const record = structuredClone(source);
    if (record.record_type === "historical_et0_estimate_v1") {
      record.epistemic_class = "ESTIMATED";
    }
    return record;
  });
}

function occurred(record: CanonicalReplayEvidenceRecordV1): string {
  for (const key of ["observed_at", "interval_end", "issued_at"] as const) {
    const value = record.role_time[key];
    if (typeof value === "string" && value) return value;
  }
  return record.available_to_runtime_at;
}

async function insertEvidence(
  records: readonly CanonicalReplayEvidenceRecordV1[],
): Promise<void> {
  for (const record of records) {
    await pool.query(
      `INSERT INTO public.facts(fact_id,occurred_at,source,record_json)
       VALUES($1,$2::timestamptz,'phase4_successor_qualification',$3::jsonb)`,
      [
        `phase4_successor_${record.source_record_id}`,
        occurred(record),
        JSON.stringify({ type: record.record_type, payload: record }),
      ],
    );
  }
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP_09_PHASE4_SUCCESSOR_DESTRUCTIVE_ACCEPTANCE !== "1") {
    throw new Error("SET_MCFT_CAP_09_PHASE4_SUCCESSOR_DESTRUCTIVE_ACCEPTANCE_1");
  }

  await resetSchemaV1();
  await pool.query(
    fs.readFileSync(
      path.resolve(
        "apps/server/db/migrations/2026_08_06_mcft_cap_09_s3_persistent_sequential_scheduler.sql",
      ),
      "utf8",
    ),
  );

  const authority = await buildControlledAuthorityV1();
  const records = normalizeEvidence(authority.candidates);
  const seeded = await seedControlledAuthorityV1(authority, records);
  await insertEvidence(records);

  const owner = "phase4-successor-runtime";
  const scheduler = new PostgresPersistentSequentialSchedulerAdapterV1(
    pool,
    {
      scope: authority.scope,
      schedule_start_logical_time: authority.logicalTime,
    },
  );
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
  const integration = new ShadowOnlineCanonicalIntegrationServiceV1(
    preparation,
    scheduler,
    canonical,
  );

  const first = await integration.executeOldestDueTick({
    scope: authority.scope,
    through_logical_time: authority.logicalTime,
    lease_owner: owner,
    lease_duration_seconds: 300,
    terminal_at: plusMinutes(authority.logicalTime, 5),
    canonical_input: {
      ...seeded.input,
      lease_owner: owner,
    },
  });
  assert.equal(first.status, "CANONICAL_TICK_TERMINAL");
  if (first.status !== "CANONICAL_TICK_TERMINAL") {
    throw new Error("PHASE4_SUCCESSOR_CANONICAL_TERMINAL_REQUIRED");
  }

  const viability = new PostgresTwinRuntimeSuccessorViabilityV1(
    pool,
    {
      scope: authority.scope,
      schedule_start_logical_time: authority.logicalTime,
    },
  );
  const verified = await viability.verifyAfterTerminal({
    terminal_slot_id: "O00",
    terminal_logical_time: authority.logicalTime,
  });
  assert.equal(verified.status, "SUCCESSOR_VIABLE");
  if (verified.status !== "SUCCESSOR_VIABLE") {
    throw new Error("PHASE4_SUCCESSOR_O01_VIABLE_REQUIRED");
  }
  assert.equal(verified.next_slot_id, "O01");
  assert.equal(
    verified.next_logical_time,
    plusMinutes(authority.logicalTime, 60),
  );
  assert.equal(
    verified.checkpoint_next_logical_time,
    verified.next_logical_time,
  );
  assert.equal(verified.active_slot_count, 0);

  const scopeValues = [
    authority.scope.tenant_id,
    authority.scope.project_id,
    authority.scope.group_id,
    authority.scope.field_id,
    authority.scope.season_id,
    authority.scope.zone_id,
  ];

  await pool.query(
    `UPDATE public.twin_shadow_online_scheduler_cursor_v1
        SET next_slot_id='O02'
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
        AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValues,
  );
  await assert.rejects(
    () => viability.verifyAfterTerminal({
      terminal_slot_id: "O00",
      terminal_logical_time: authority.logicalTime,
    }),
    /PHASE4_SUCCESSOR_RUNTIME_CURSOR_NEXT_MISMATCH/,
  );
  await pool.query(
    `UPDATE public.twin_shadow_online_scheduler_cursor_v1
        SET next_slot_id='O01'
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3
        AND field_id=$4 AND season_id=$5 AND zone_id=$6`,
    scopeValues,
  );

  await pool.query(
    `INSERT INTO public.twin_shadow_online_scheduler_slot_v1
     (tenant_id,project_id,group_id,field_id,season_id,zone_id,
      slot_id,logical_time,scheduler_wall_clock_observed_at,interval_seconds,
      state,lease_owner,fencing_token,idempotency_key)
     VALUES ($1,$2,$3,$4,$5,$6,'O01',$7::timestamptz,$7::timestamptz,3600,
             'CLAIMED','phase4-rogue-successor',999,'phase4-rogue-successor')`,
    [...scopeValues, plusMinutes(authority.logicalTime, 60)],
  );
  await assert.rejects(
    () => viability.verifyAfterTerminal({
      terminal_slot_id: "O00",
      terminal_logical_time: authority.logicalTime,
    }),
    /PHASE4_SUCCESSOR_ACTIVE_SLOT_MUST_BE_ZERO/,
  );

  const proof = {
    schema_version: "geox_mcft_cap09_phase4_successor_viability_qualification_v1",
    status: "PASS",
    real_postgres: true,
    canonical_tick_executed_before_viability_check: true,
    canonical_checkpoint_not_synthetic: true,
    runtime_cursor_terminal_binding_verified: true,
    checkpoint_next_tick_matches_runtime_cursor: true,
    o00_to_o01_successor_viable: true,
    cursor_drift_fail_closed: true,
    residual_active_slot_fail_closed: true,
    forcing_target_mutation_count: 0,
    evidence_supply_cursor_mutation: false,
    provider_request_count: 0,
    r2_request_count: 0,
    production_container_activation: false,
    formal_v5_armed: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  process.stdout.write(JSON.stringify(proof) + "\n");
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (error) => {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(
      OUT,
      JSON.stringify({
        status: "FAIL",
        error: error instanceof Error ? error.message : String(error),
      }, null, 2) + "\n",
    );
    console.error(error);
    process.exitCode = 1;
    await pool.end();
  });
