import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  EvidenceRuntimeHostV1,
  type EvidenceRuntimeHostHealthEventV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_host_v1.js";
import type {
  EvidenceRuntimeCycleWorkItemV1,
  ExecuteEvidenceRuntimeCycleResultV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_cycle_service_v1.js";
import {
  MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,
  type EvidenceRuntimeScopeV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_evidence_runtime_persistence_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_PHASE3_EVIDENCE_RUNTIME_HOST_V1_RESULT.json");
const SCOPE: EvidenceRuntimeScopeV1 = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "field_e3r1",
  season_id: "season_2026",
  zone_id: "zone_root",
};

const WORK: EvidenceRuntimeCycleWorkItemV1 = {
  work_item_id: "host-lifecycle-fixture",
  dataset_id: "host_lifecycle_fixture",
  request: {
    request_id: "host-lifecycle-request",
    provider_id: "HOST_LIFECYCLE_FIXTURE",
    source_family: "HOST_LIFECYCLE_FIXTURE",
    locator: "https://example.invalid/host-lifecycle",
    allowed_final_hosts: ["example.invalid"],
    use_policy_ref: "PHASE3_QUALIFICATION_ONLY",
    requested_at: "2026-08-27T02:00:00.000Z",
    expected_content_type_prefixes: ["application/json"],
    limitations: ["QUALIFICATION_FIXTURE_ONLY"],
  },
  transport: {
    async fetchRawEvidence() { throw new Error("HOST_LIFECYCLE_FIXTURE_TRANSPORT_MUST_NOT_EXECUTE"); },
  },
  decoder: {
    decoder_id: "HOST_LIFECYCLE_FIXTURE_DECODER",
    decoder_version: "1",
    async decodeRetainedEvidence() { throw new Error("HOST_LIFECYCLE_FIXTURE_DECODER_MUST_NOT_EXECUTE"); },
  },
};

function completed(): ExecuteEvidenceRuntimeCycleResultV1 {
  return {
    service_id: "MCFT_CAP09_EVIDENCE_RUNTIME_CYCLE_SERVICE_V1",
    status: "COMPLETED",
    lease_claim: {
      lease_contract_id: MCFT_CAP09_EVIDENCE_PRODUCER_LEASE_CONTRACT_ID_V1,
      scope: { ...SCOPE },
      lease_owner: "host-A",
      fencing_token: 3n,
      acquired_at: "2026-08-27T02:00:00.000Z",
      expires_at: "2026-08-27T02:10:00.000Z",
      heartbeat_at: "2026-08-27T02:00:01.000Z",
      database_now: "2026-08-27T02:00:01.000Z",
    },
    work_item_count: 1,
    canonical_record_count: 2,
    visible_ingress_count: 2,
    evidence_supply_cursor_advance_count: 2,
    work_item_results: [{
      work_item_id: WORK.work_item_id,
      canonical_record_count: 2,
      visible_ingress_count: 2,
    }],
    twin_state_mutation: false,
    runtime_tick_cursor_mutation: false,
  };
}

async function expectReject(fn: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  let caught: unknown = null;
  try { await fn(); } catch (error) { caught = error; }
  assert(caught instanceof Error, "PHASE3_HOST_EXPECTED_ERROR");
  assert.match(caught.message, pattern);
}

async function main(): Promise<void> {
  const health: EvidenceRuntimeHostHealthEventV1[] = [];
  const waits: string[] = [];
  let calls = 0;
  const host = new EvidenceRuntimeHostV1({
    cycle_service: {
      async executeCycle() {
        calls += 1;
        if (calls === 1) throw new Error("RETRYABLE:provider-temporary");
        if (calls === 2) {
          return {
            service_id: "MCFT_CAP09_EVIDENCE_RUNTIME_CYCLE_SERVICE_V1",
            status: "LEASE_HELD_BY_OTHER_OWNER",
            lease_claim: null,
            work_item_count: 0,
            canonical_record_count: 0,
            visible_ingress_count: 0,
            evidence_supply_cursor_advance_count: 0,
            twin_state_mutation: false,
            runtime_tick_cursor_mutation: false,
          } satisfies ExecuteEvidenceRuntimeCycleResultV1;
        }
        return completed();
      },
    },
    planner: {
      async nextWorkItems(input) {
        return input.cycle_attempt >= 3 ? null : [WORK];
      },
    },
    wait: {
      async waitAfterAttempt(input) {
        waits.push(input.reason);
      },
    },
    health: {
      async recordHealth(event) {
        health.push(structuredClone(event));
      },
    },
    stop: { stopRequested: () => false },
    failure_classifier: {
      classify(error) {
        return error instanceof Error && error.message.startsWith("RETRYABLE:") ? "RETRYABLE" : "FATAL";
      },
    },
  });

  const result = await host.run({
    scope: SCOPE,
    lease_owner: "host-A",
    lease_duration_seconds: 300,
  });
  assert.equal(result.status, "STOPPED");
  assert.equal(result.stop_reason, "PLANNER_EXHAUSTED");
  assert.equal(result.cycle_attempt_count, 3);
  assert.equal(result.successful_cycle_count, 1);
  assert.equal(result.standby_cycle_count, 1);
  assert.equal(result.retryable_failure_count, 1);
  assert.equal(result.durable_restart_checkpoint, "EVIDENCE_SUPPLY_CURSOR");
  assert.deepEqual(waits, ["RETRY_BACKOFF", "LEASE_STANDBY", "SUCCESS_CADENCE"]);
  assert.deepEqual(
    health.map((event) => [event.status, event.detail]),
    [
      ["STARTING", "HOST_START"],
      ["DEGRADED", "RETRYABLE_CYCLE_FAILURE"],
      ["STANDBY", "LEASE_HELD_BY_OTHER_OWNER"],
      ["HEALTHY", "CYCLE_COMPLETED"],
      ["STOPPING", "PLANNER_EXHAUSTED"],
    ],
  );

  const fatalHealth: EvidenceRuntimeHostHealthEventV1[] = [];
  const fatalWaits: string[] = [];
  const fatalHost = new EvidenceRuntimeHostV1({
    cycle_service: {
      async executeCycle() { throw new Error("FATAL:identity-corruption"); },
    },
    planner: { async nextWorkItems() { return [WORK]; } },
    wait: { async waitAfterAttempt(input) { fatalWaits.push(input.reason); } },
    health: { async recordHealth(event) { fatalHealth.push(structuredClone(event)); } },
    stop: { stopRequested: () => false },
    failure_classifier: { classify: () => "FATAL" },
  });
  await expectReject(
    () => fatalHost.run({ scope: SCOPE, lease_owner: "host-fatal", lease_duration_seconds: 300 }),
    /FATAL:identity-corruption/,
  );
  assert.deepEqual(fatalWaits, []);
  assert.deepEqual(
    fatalHealth.map((event) => [event.status, event.detail]),
    [["STARTING", "HOST_START"], ["DEGRADED", "FATAL_CYCLE_FAILURE"]],
  );

  let plannerCalls = 0;
  const stoppedHost = new EvidenceRuntimeHostV1({
    cycle_service: { async executeCycle() { throw new Error("STOPPED_HOST_CYCLE_MUST_NOT_EXECUTE"); } },
    planner: { async nextWorkItems() { plannerCalls += 1; return [WORK]; } },
    wait: { async waitAfterAttempt() { throw new Error("STOPPED_HOST_WAIT_MUST_NOT_EXECUTE"); } },
    health: { async recordHealth() {} },
    stop: { stopRequested: () => true },
    failure_classifier: { classify: () => "FATAL" },
  });
  const stopped = await stoppedHost.run({ scope: SCOPE, lease_owner: "host-stop", lease_duration_seconds: 300 });
  assert.equal(stopped.stop_reason, "STOP_REQUESTED");
  assert.equal(plannerCalls, 0);

  const source = fs.readFileSync(
    path.resolve("apps/server/src/external_evidence/mcft_cap09_evidence_runtime_host_v1.ts"),
    "utf8",
  );
  for (const forbidden of [
    "process.env",
    "setInterval(",
    "setTimeout(",
    "child_process",
    "fetch(",
    "INSERT INTO",
    "UPDATE ",
    "DELETE FROM",
    "scripts/runtime_acceptance",
  ]) {
    assert.equal(source.includes(forbidden), false, `PHASE3_HOST_FORBIDDEN_DEPENDENCY:${forbidden}`);
  }
  assert.equal(source.includes("EvidenceRuntimeCycleServiceV1"), true);
  assert.equal(source.includes("RuntimeTickCursor"), true, "PHASE3_HOST_EXPLICIT_NON_AUTHORITY_BOUNDARY_MARKER_REQUIRED");

  const proof = {
    schema_version: "geox_mcft_cap09_phase3_evidence_runtime_host_qualification_v1",
    status: "PASS",
    lifecycle_sequence: health.map((event) => [event.status, event.detail]),
    retryable_failure_retried: true,
    lease_standby_waited: true,
    successful_cycle_waited_for_cadence: true,
    fatal_failure_fail_closed: true,
    immediate_stop_skips_planner_and_cycle: true,
    durable_restart_checkpoint: result.durable_restart_checkpoint,
    host_processes_evidence_only_via_cycle_service: true,
    provider_direct_call_from_host: false,
    database_direct_call_from_host: false,
    production_cadence_activation: false,
    runtime_tick_cursor_mutation: false,
    twin_state_mutation: false,
    formal_v5_armed: false,
    graduation_effect: false,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(proof, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(proof)}\n`);
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
