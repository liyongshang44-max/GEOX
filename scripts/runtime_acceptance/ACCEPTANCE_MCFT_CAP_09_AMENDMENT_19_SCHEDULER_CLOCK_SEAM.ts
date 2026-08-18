import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_AM19_ACCELERATED_SCHEDULER_CLOCK_ACK_V1,
  PERSISTENT_SEQUENTIAL_SCHEDULER_CONFIG_V1,
  PostgresPersistentSequentialSchedulerAdapterV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.js";
import type { ShadowOnlineBoundaryV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_AMENDMENT_19_SCHEDULER_CLOCK_SEAM_RESULT.json");
const O00 = "2030-01-01T01:00:00.000Z";

function boundary(observedAt = O00): ShadowOnlineBoundaryV1 {
  return {
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    slot_id: "O00",
    logical_time: O00,
    scheduler_wall_clock_observed_at: observedAt,
    interval_seconds: 3600,
  };
}

async function main(): Promise<void> {
  let databaseClockQueries = 0;
  const client = {
    query: async (sql: string) => {
      if (!String(sql).includes("transaction_timestamp() AS database_now")) throw new Error(`UNEXPECTED_SQL:${sql}`);
      databaseClockQueries += 1;
      return { rows: [{ database_now: "2029-12-31T23:59:59.000Z" }] };
    },
    release: () => undefined,
  };
  const inertPool = {
    connect: async () => client,
    query: async () => ({ rows: [] }),
  };
  const config = {
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    schedule_start_logical_time: O00,
  };

  const production = new PostgresPersistentSequentialSchedulerAdapterV1(inertPool as never, config);
  await assert.rejects(
    () => (production as any).assertDatabaseClockBoundary(client, boundary()),
    /FUTURE_BOUNDARY_CLAIM_REJECTED/,
  );
  assert.equal(databaseClockQueries, 1);

  const accelerated = new PostgresPersistentSequentialSchedulerAdapterV1(
    inertPool as never,
    config,
    {
      mode: "ACCELERATED_ENGINEERING_ONLY",
      qualification_ack: MCFT_CAP09_AM19_ACCELERATED_SCHEDULER_CLOCK_ACK_V1,
      now: () => new Date(O00),
    },
  );
  await (accelerated as any).assertDatabaseClockBoundary(client, boundary());
  assert.equal(databaseClockQueries, 1, "accelerated qualification must not query DB wall clock for boundary waiting authority");

  const oneHourLater = "2030-01-01T02:00:00.000Z";
  await assert.rejects(
    () => (accelerated as any).assertDatabaseClockBoundary(client, {
      ...boundary(oneHourLater),
      logical_time: oneHourLater,
      slot_id: "O01",
    }),
    /FUTURE_BOUNDARY_CLAIM_REJECTED/,
  );

  assert.throws(
    () => new PostgresPersistentSequentialSchedulerAdapterV1(inertPool as never, config, {
      mode: "ACCELERATED_ENGINEERING_ONLY",
      qualification_ack: "INVALID" as never,
      now: () => new Date(O00),
    }),
    /ACCELERATED_SCHEDULER_CLOCK_ACK_REQUIRED/,
  );

  const invalidClock = new PostgresPersistentSequentialSchedulerAdapterV1(
    inertPool as never,
    config,
    {
      mode: "ACCELERATED_ENGINEERING_ONLY",
      qualification_ack: MCFT_CAP09_AM19_ACCELERATED_SCHEDULER_CLOCK_ACK_V1,
      now: () => new Date(Number.NaN),
    },
  );
  await assert.rejects(
    () => (invalidClock as any).assertDatabaseClockBoundary(client, boundary()),
    /ACCELERATED_SCHEDULER_CLOCK_INVALID/,
  );

  assert.equal(PERSISTENT_SEQUENTIAL_SCHEDULER_CONFIG_V1.accelerated_formal_clock_allowed, false);
  assert.equal(PERSISTENT_SEQUENTIAL_SCHEDULER_CONFIG_V1.future_boundary_claim_allowed, false);

  const result = {
    schema_version: "geox_mcft_cap09_amendment19_scheduler_clock_seam_result_v1",
    status: "PASS",
    exact_scheduler_class_reused: true,
    default_production_clock_authority: "SYSTEM_DATABASE_UTC",
    production_future_boundary_fail_closed: true,
    accelerated_qualification_clock_authority: "ACCELERATED_ENGINEERING_ONLY",
    accelerated_wait_clock_substitution_only: true,
    database_clock_query_count_after_accelerated_probe: databaseClockQueries,
    malformed_accelerated_authority_fail_closed: true,
    future_of_accelerated_authority_fail_closed: true,
    lease_and_fencing_clock_substitution: false,
    scheduler_cursor_replacement: false,
    scheduler_slot_ledger_replacement: false,
    alternate_scheduler_implementation_created: false,
    formal_accelerated_clock_authorized: false,
    future_formal_epoch_selected: false,
    formal_o00_started: false,
    formal_effect: false,
  } as const;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
