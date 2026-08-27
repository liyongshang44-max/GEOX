import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  JsonLineServiceHealthPortV1,
  MCFT_CAP09_PHASE5_SERVICE_LIFECYCLE_ID_V1,
  Phase5ServiceWaitPortV1,
  PostgresTransientFailureClassifierV1,
  ProcessSignalStopPortV1,
} from "../../apps/server/src/hosting/mcft_cap09_phase5_service_lifecycle_v1.js";

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_PHASE5_SERVICE_LIFECYCLE_V1_RESULT.json",
);

async function main(): Promise<void> {
  assert.equal(
    MCFT_CAP09_PHASE5_SERVICE_LIFECYCLE_ID_V1,
    "MCFT_CAP09_PHASE5_SERVICE_LIFECYCLE_V1",
  );

  const stop = new ProcessSignalStopPortV1();
  assert.equal(stop.stopRequested(), false);
  stop.install();
  stop.install();
  stop.requestStopForQualification();
  assert.equal(stop.stopRequested(), true);

  const wait = new Phase5ServiceWaitPortV1({
    success_wait_ms: 0,
    standby_wait_ms: 0,
    retry_wait_ms: 0,
    terminal_wait_ms: 0,
    no_due_wait_ms: 0,
    backpressure_wait_ms: 0,
  });
  for (const reason of [
    "SUCCESS_CADENCE",
    "LEASE_STANDBY",
    "RETRY_BACKOFF",
    "NO_DUE_SLOT",
    "EVIDENCE_OR_CONFIG_NOT_READY",
    "TERMINAL_SLOT",
  ] as const) {
    await wait.waitAfterAttempt({
      reason,
      cycle_attempt: 1,
      consecutive_failure_count: reason === "RETRY_BACKOFF" ? 1 : 0,
    });
  }

  const healthRows: Record<string, unknown>[] = [];
  const evidenceHealth = new JsonLineServiceHealthPortV1(
    "EVIDENCE_RUNTIME",
    (record) => healthRows.push(structuredClone(record)),
  );
  const twinHealth = new JsonLineServiceHealthPortV1(
    "TWIN_RUNTIME",
    (record) => healthRows.push(structuredClone(record)),
  );
  await evidenceHealth.recordHealth({
    host_id: "MCFT_CAP09_EVIDENCE_RUNTIME_HOST_V1",
    status: "STARTING",
    cycle_attempt: 0,
    successful_cycle_count: 0,
    consecutive_failure_count: 0,
    detail: "HOST_START",
  });
  await twinHealth.recordHealth({
    host_id: "MCFT_CAP09_TWIN_RUNTIME_HOST_V1",
    status: "STARTING",
    cycle_attempt: 0,
    terminal_slot_count: 0,
    no_due_slot_count: 0,
    preclaim_backpressure_count: 0,
    retryable_failure_count: 0,
    consecutive_failure_count: 0,
    detail: "HOST_START",
  });
  assert.equal(healthRows.length, 2);
  assert.equal(healthRows[0].service_role, "EVIDENCE_RUNTIME");
  assert.equal(healthRows[1].service_role, "TWIN_RUNTIME");

  const classifier = new PostgresTransientFailureClassifierV1();
  assert.equal(classifier.classify({ code: "08006" }), "RETRYABLE");
  assert.equal(classifier.classify({ code: "40001" }), "RETRYABLE");
  assert.equal(classifier.classify({ code: "40P01" }), "RETRYABLE");
  assert.equal(classifier.classify(new Error("provider semantic failure")), "FATAL");
  assert.equal(classifier.classify({ code: "23505" }), "FATAL");

  await assert.rejects(
    async () => new Phase5ServiceWaitPortV1({
      success_wait_ms: -1,
      standby_wait_ms: 0,
      retry_wait_ms: 0,
      terminal_wait_ms: 0,
      no_due_wait_ms: 0,
      backpressure_wait_ms: 0,
    }),
    /PHASE5_SUCCESS_WAIT_INVALID/,
  );

  const proof = {
    schema_version: "geox_mcft_cap09_phase5_service_lifecycle_qualification_v1",
    status: "PASS",
    signal_stop_idempotent_install: true,
    explicit_qualification_stop: true,
    accelerated_wait_zero_supported: true,
    acceleration_changes_wait_only: true,
    evidence_health_structured: true,
    twin_health_structured: true,
    postgres_connection_failure_retryable: true,
    serialization_and_deadlock_retryable: true,
    semantic_failure_fatal: true,
    constraint_failure_fatal: true,
    production_activation: false,
    phase6_cutover: false,
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
