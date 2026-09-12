import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MCFT_CAP09_POSTGRES_TWIN_RUNTIME_DATABASE_CLOCK_ID_V1,
  MCFT_CAP09_TWIN_RUNTIME_HOST_CONTRACT_V1,
  PostgresTwinRuntimeDatabaseClockV1,
  TwinRuntimeHostV1,
  type TwinRuntimeHostHealthEventV1,
} from "../../apps/server/src/runtime/twin_runtime/mcft_cap09_twin_runtime_host_v1.js";
import type {
  ExecuteExternalFormalV3Am19RunnerResultV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_runner_v1.js";
import type {
  TwinRuntimeSchedulerOwnershipLeaseClaimV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_persistent_sequential_scheduler_adapter_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_PHASE4_TWIN_RUNTIME_HOST_V1_RESULT.json",
);

function noDue(): ExecuteExternalFormalV3Am19RunnerResultV1 {
  return {
    runner_id: "MCFT_CAP09_EXTERNAL_FORMAL_V3_AM19_RUNNER_V1",
    status: "NO_DUE_SLOT",
    claim_attempted: false,
    provider_request_count: 0,
    r2_request_count: 0,
  };
}

function notReady(): ExecuteExternalFormalV3Am19RunnerResultV1 {
  return {
    runner_id: "MCFT_CAP09_EXTERNAL_FORMAL_V3_AM19_RUNNER_V1",
    status: "NOT_READY_PRECLAIM",
    slot_id: "O00",
    logical_time: "2026-08-27T00:00:00.000Z",
    reason: "EVIDENCE_PRECHECK_FAILED",
    detail: "QUALIFICATION_BACKPRESSURE",
    claim_attempted: false,
    provider_request_count: 0,
    r2_request_count: 0,
  };
}

const TEST_SCOPE = {
  tenant_id: "tenant-a",
  project_id: "project-a",
  group_id: "group-a",
  field_id: "field-a",
  season_id: "season-a",
  zone_id: "zone-a",
} as const;

function ownershipHarnessV1(input: { standby_first?: boolean } = {}) {
  let acquireCalls = 0;
  let releaseCalls = 0;
  const port = {
    async acquireOrRenewOwnershipLease(request: {
      lease_owner: string;
      lease_duration_seconds: number;
    }): Promise<TwinRuntimeSchedulerOwnershipLeaseClaimV1 | null> {
      acquireCalls += 1;
      assert.equal(request.lease_duration_seconds, 900);
      if (input.standby_first === true && acquireCalls === 1) return null;
      return {
        scope: { ...TEST_SCOPE },
        lease_owner: request.lease_owner,
        fencing_token: 1n,
        acquired_at: "2026-08-27T00:00:00.000Z",
        expires_at: "2026-08-27T00:15:00.000Z",
        heartbeat_at: "2026-08-27T00:00:00.000Z",
        database_now: "2026-08-27T00:00:00.000Z",
      };
    },
    async releaseOwnershipLease(inputRelease: {
      claim: TwinRuntimeSchedulerOwnershipLeaseClaimV1;
    }): Promise<"RELEASED"> {
      releaseCalls += 1;
      assert.equal(inputRelease.claim.fencing_token, 1n);
      return "RELEASED";
    },
  };
  return {
    port,
    acquireCalls: () => acquireCalls,
    releaseCalls: () => releaseCalls,
  };
}

function completed(): ExecuteExternalFormalV3Am19RunnerResultV1 {
  return {
    runner_id: "MCFT_CAP09_EXTERNAL_FORMAL_V3_AM19_RUNNER_V1",
    status: "COMPLETED",
    slot_id: "O00",
    logical_time: "2026-08-27T00:00:00.000Z",
    claim_attempted: true,
    terminal_result_recorded: true,
    tick_result: {} as never,
    provider_request_count: 0,
    r2_request_count: 0,
  };
}

async function main(): Promise<void> {
  assert.equal(
    MCFT_CAP09_TWIN_RUNTIME_HOST_CONTRACT_V1.one_slot_runtime,
    "ExternalFormalV3Amendment19RunnerV1.executeOneDueSlot",
  );
  assert.equal(
    MCFT_CAP09_TWIN_RUNTIME_HOST_CONTRACT_V1.clock_authority,
    "POSTGRES_TRANSACTION_TIMESTAMP",
  );
  assert.equal(
    MCFT_CAP09_TWIN_RUNTIME_HOST_CONTRACT_V1.provider_request_allowed,
    false,
  );
  assert.equal(
    MCFT_CAP09_TWIN_RUNTIME_HOST_CONTRACT_V1.raw_r2_fallback_allowed,
    false,
  );
  assert.equal(
    MCFT_CAP09_TWIN_RUNTIME_HOST_CONTRACT_V1.evidence_supply_cursor_mutation_allowed,
    false,
  );

  let dbClockQuery = "";
  const dbClock = new PostgresTwinRuntimeDatabaseClockV1({
    async query(sql: string) {
      dbClockQuery = sql;
      return {
        rows: [{ database_now: new Date("2026-08-27T00:05:00.000Z") }],
      } as never;
    },
  } as never);
  const clockSnapshot = await dbClock.readDatabaseNow();
  assert.equal(
    clockSnapshot.clock_id,
    MCFT_CAP09_POSTGRES_TWIN_RUNTIME_DATABASE_CLOCK_ID_V1,
  );
  assert.equal(clockSnapshot.observed_at, "2026-08-27T00:05:00.000Z");
  assert.match(dbClockQuery, /transaction_timestamp\(\)/);

  const sequence = [noDue(), notReady(), completed()];
  const calls: Array<Record<string, unknown>> = [];
  let successorCalls = 0;
  const waits: string[] = [];
  const health: TwinRuntimeHostHealthEventV1[] = [];
  let stop = false;

  const ownership = ownershipHarnessV1();
  const host = new TwinRuntimeHostV1({
    database_clock: {
      async readDatabaseNow() {
        return {
          clock_id: MCFT_CAP09_POSTGRES_TWIN_RUNTIME_DATABASE_CLOCK_ID_V1,
          observed_at: "2026-08-27T00:05:00.000Z",
        };
      },
    },
    scheduler_ownership: ownership.port,
    one_due_slot: {
      async executeOneDueSlot(input) {
        calls.push({ ...input });
        const result = sequence.shift();
        if (!result) throw new Error("QUALIFICATION_SEQUENCE_EXHAUSTED");
        return result;
      },
    },
    successor_viability: {
      async verifyAfterTerminal(input) {
        successorCalls += 1;
        assert.equal(input.terminal_slot_id, "O00");
        assert.equal(input.terminal_logical_time, "2026-08-27T00:00:00.000Z");
        return {
          viability_id: "MCFT_CAP09_TWIN_RUNTIME_SUCCESSOR_VIABILITY_V1",
          status: "SUCCESSOR_VIABLE",
          terminal_slot_id: "O00",
          terminal_logical_time: "2026-08-27T00:00:00.000Z",
          next_slot_id: "O01",
          next_logical_time: "2026-08-27T01:00:00.000Z",
          checkpoint_ref: "checkpoint:o00",
          checkpoint_next_logical_time: "2026-08-27T01:00:00.000Z",
          active_slot_count: 0,
        };
      },
    },
    wait: {
      async waitAfterAttempt(input) {
        waits.push(input.reason);
        if (input.reason === "TERMINAL_SLOT") stop = true;
      },
    },
    health: {
      async recordHealth(event) {
        health.push(structuredClone(event));
      },
    },
    stop: {
      stopRequested() {
        return stop;
      },
    },
    failure_classifier: {
      classify() {
        return "FATAL";
      },
    },
  });

  const result = await host.run({
    lease_owner: "phase4-host-A",
    lease_duration_seconds: 900,
  });
  assert.equal(result.status, "STOPPED");
  assert.equal(result.stop_reason, "STOP_REQUESTED");
  assert.equal(result.cycle_attempt_count, 3);
  assert.equal(result.no_due_slot_count, 1);
  assert.equal(result.preclaim_backpressure_count, 1);
  assert.equal(result.terminal_slot_count, 1);
  assert.equal(successorCalls, 1);
  assert.equal(result.retryable_failure_count, 0);
  assert.equal(result.scheduler_lease_standby_count, 0);
  assert.equal(ownership.acquireCalls(), 3);
  assert.equal(ownership.releaseCalls(), 1);
  assert.equal(result.provider_request_count, 0);
  assert.equal(result.r2_request_count, 0);
  assert.equal(result.evidence_supply_cursor_mutation, false);
  assert.equal(
    result.durable_restart_authority,
    "RUNTIME_TICK_CURSOR_AND_CANONICAL_CHECKPOINT",
  );
  assert.deepEqual(waits, [
    "NO_DUE_SLOT",
    "EVIDENCE_OR_CONFIG_NOT_READY",
    "TERMINAL_SLOT",
  ]);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.through_logical_time, "2026-08-27T00:05:00.000Z");
    assert.equal(call.observer_started_at, "2026-08-27T00:05:00.000Z");
    assert.equal(call.lease_owner, "phase4-host-A");
    assert.equal(call.lease_duration_seconds, 900);
  }
  assert.equal(health[0]?.status, "STARTING");
  assert(health.some((event) => event.detail === "NO_DUE_SLOT"));
  assert(health.some((event) => event.detail === "NOT_READY_PRECLAIM"));
  assert(health.some((event) => event.detail === "TERMINAL_SLOT_RECORDED"));
  assert.equal(health.at(-1)?.detail, "STOP_REQUESTED");

  let retryStop = false;
  let retryCalls = 0;
  const retryWaits: string[] = [];
  const retryOwnership = ownershipHarnessV1();
  const retryHost = new TwinRuntimeHostV1({
    database_clock: {
      async readDatabaseNow() {
        return {
          clock_id: MCFT_CAP09_POSTGRES_TWIN_RUNTIME_DATABASE_CLOCK_ID_V1,
          observed_at: "2026-08-27T01:00:00.000Z",
        };
      },
    },
    scheduler_ownership: retryOwnership.port,
    one_due_slot: {
      async executeOneDueSlot() {
        retryCalls += 1;
        if (retryCalls === 1) throw new Error("TRANSIENT_DB_RECONNECT");
        return noDue();
      },
    },
    successor_viability: {
      async verifyAfterTerminal() {
        throw new Error("SUCCESSOR_VIABILITY_MUST_NOT_RUN_WITHOUT_TERMINAL_SLOT");
      },
    },
    wait: {
      async waitAfterAttempt(input) {
        retryWaits.push(input.reason);
        if (input.reason === "NO_DUE_SLOT") retryStop = true;
      },
    },
    health: { async recordHealth() {} },
    stop: { stopRequested: () => retryStop },
    failure_classifier: {
      classify(error) {
        return error instanceof Error && error.message === "TRANSIENT_DB_RECONNECT"
          ? "RETRYABLE"
          : "FATAL";
      },
    },
  });
  const retryResult = await retryHost.run({
    lease_owner: "phase4-host-B",
    lease_duration_seconds: 900,
  });
  assert.equal(retryResult.retryable_failure_count, 1);
  assert.equal(retryResult.cycle_attempt_count, 2);
  assert.equal(retryResult.scheduler_lease_standby_count, 0);
  assert.equal(retryOwnership.acquireCalls(), 2);
  assert.equal(retryOwnership.releaseCalls(), 1);
  assert.deepEqual(retryWaits, ["RETRY_BACKOFF", "NO_DUE_SLOT"]);

  let fallbackRejected = false;
  const fallbackOwnership = ownershipHarnessV1();
  const fallbackHost = new TwinRuntimeHostV1({
    database_clock: {
      async readDatabaseNow() {
        return {
          clock_id: MCFT_CAP09_POSTGRES_TWIN_RUNTIME_DATABASE_CLOCK_ID_V1,
          observed_at: "2026-08-27T02:00:00.000Z",
        };
      },
    },
    scheduler_ownership: fallbackOwnership.port,
    one_due_slot: {
      async executeOneDueSlot() {
        return {
          ...noDue(),
          provider_request_count: 1,
        } as never;
      },
    },
    successor_viability: {
      async verifyAfterTerminal() {
        throw new Error("SUCCESSOR_VIABILITY_MUST_NOT_RUN_AFTER_PROVIDER_FALLBACK");
      },
    },
    wait: { async waitAfterAttempt() {} },
    health: { async recordHealth() {} },
    stop: { stopRequested: () => false },
    failure_classifier: {
      classify(error) {
        if (
          error instanceof Error
          && error.message === "PHASE4_TWIN_RUNTIME_PROVIDER_OR_R2_FALLBACK_FORBIDDEN"
        ) {
          fallbackRejected = true;
        }
        return "FATAL";
      },
    },
  });
  await assert.rejects(
    () => fallbackHost.run({
      lease_owner: "phase4-host-C",
      lease_duration_seconds: 900,
    }),
    /PHASE4_TWIN_RUNTIME_PROVIDER_OR_R2_FALLBACK_FORBIDDEN/,
  );
  assert.equal(fallbackRejected, true);
  assert.equal(fallbackOwnership.acquireCalls(), 1);
  assert.equal(fallbackOwnership.releaseCalls(), 1);

  let standbyStop = false;
  let standbyRunnerCalls = 0;
  const standbyOwnership = ownershipHarnessV1({ standby_first: true });
  const standbyHost = new TwinRuntimeHostV1({
    database_clock: {
      async readDatabaseNow() {
        throw new Error("STANDBY_MUST_NOT_READ_DB_CLOCK");
      },
    },
    scheduler_ownership: standbyOwnership.port,
    one_due_slot: {
      async executeOneDueSlot() {
        standbyRunnerCalls += 1;
        return noDue();
      },
    },
    successor_viability: {
      async verifyAfterTerminal() {
        throw new Error("STANDBY_MUST_NOT_VERIFY_SUCCESSOR");
      },
    },
    wait: {
      async waitAfterAttempt(input) {
        assert.equal(input.reason, "SCHEDULER_LEASE_STANDBY");
        standbyStop = true;
      },
    },
    health: { async recordHealth() {} },
    stop: { stopRequested: () => standbyStop },
    failure_classifier: { classify: () => "FATAL" },
  });
  const standbyResult = await standbyHost.run({
    lease_owner: "phase4-host-standby",
    lease_duration_seconds: 900,
  });
  assert.equal(standbyResult.scheduler_lease_standby_count, 1);
  assert.equal(standbyRunnerCalls, 0);
  assert.equal(standbyOwnership.acquireCalls(), 1);
  assert.equal(standbyOwnership.releaseCalls(), 0);

  const proof = {
    schema_version: "geox_mcft_cap09_phase4_twin_runtime_host_qualification_v1",
    status: "PASS",
    database_clock_authority: "POSTGRES_TRANSACTION_TIMESTAMP",
    existing_canonical_runner_only: true,
    no_second_canonical_tick_path: true,
    no_due_slot_wait: true,
    preclaim_evidence_backpressure: true,
    terminal_slot_progression: true,
    terminal_successor_viability_required: true,
    retryable_failure_backoff: true,
    scheduler_owner_presence_lease_before_runner: true,
    duplicate_scheduler_owner_standby_no_runner_call: true,
    scheduler_owner_lease_released_on_stop_or_fatal: true,
    provider_or_r2_fallback_fail_closed: true,
    durable_restart_authority: "RUNTIME_TICK_CURSOR_AND_CANONICAL_CHECKPOINT",
    evidence_supply_cursor_mutation: false,
    production_container_activation: false,
    formal_v5_armed: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
  process.stdout.write(JSON.stringify(proof) + "\n");
}

main().catch((error) => {
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
});
