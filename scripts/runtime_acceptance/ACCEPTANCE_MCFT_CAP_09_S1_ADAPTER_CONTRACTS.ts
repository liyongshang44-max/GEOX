import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  SHADOW_ONLINE_ADAPTER_CONFIG_V1,
  SHADOW_ONLINE_SLOT_IDS_V1,
} from "../../apps/server/src/runtime/twin_runtime/shadow_online_adapter_config_v1.js";
import type {
  AvailabilityPortV1,
  ClockPortV1,
  EvidenceIngressPortV1,
  ExecutionFeedbackPortV1,
  SchedulerPortV1,
  ShadowOnlineBoundaryV1,
  TwinScopeKeyV1,
} from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_S1_ADAPTER_CONTRACTS_RESULT.json");
const PORTS = path.join(ROOT, "apps/server/src/runtime/twin_runtime/ports.ts");
const CONFIG = path.join(
  ROOT,
  "apps/server/src/runtime/twin_runtime/shadow_online_adapter_config_v1.ts",
);

const scope: TwinScopeKeyV1 = {
  tenant_id: "tenant_contract",
  project_id: "project_contract",
  group_id: "group_contract",
  field_id: "field_contract",
  season_id: "season_contract",
  zone_id: "zone_contract",
};

const boundary: ShadowOnlineBoundaryV1 = {
  scope,
  slot_id: "O00",
  logical_time: "2026-08-05T00:00:00.000Z",
  scheduler_wall_clock_observed_at: "2026-08-05T00:00:00.000Z",
  interval_seconds: 3600,
};

const clock = {
  async resolveBoundary() {
    return boundary;
  },
} satisfies ClockPortV1;

const evidenceIngress = {
  async freezeEligibleEvidence() {
    return {
      boundary,
      selected: [],
      excluded: [],
      coverage_ratio_decimal: "0.000000",
      maximum_gap_seconds: null,
      freshest_observed_at: null,
      freshness_status: "MISSING",
      future_evidence_leakage: false,
    } as const;
  },
} satisfies EvidenceIngressPortV1;

const scheduler = {
  async claimDueSlot() {
    return {
      boundary,
      lease_owner: "contract-only",
      fencing_token: 1n,
      state: "CLAIMED",
      idempotency_key: "contract-only-o00",
    } as const;
  },
  async listMissedSlots() {
    return [];
  },
  async recordTerminalResult() {
    return undefined;
  },
} satisfies SchedulerPortV1;

const executionFeedback = {
  async readExistingExecutionEvidence() {
    return [];
  },
} satisfies ExecutionFeedbackPortV1;

const availability = {
  async inspectAvailability() {
    return {
      scope,
      observed_at: boundary.logical_time,
      checkpoint_ref: null,
      durable_cursor_slot_id: null,
      oldest_missed_slot_id: null,
      scheduler_lag_seconds: 0,
      evidence_freshness_status: "MISSING",
      runtime_health_status: "DEGRADED",
    } as const;
  },
} satisfies AvailabilityPortV1;

async function main(): Promise<void> {
  assert.equal(SHADOW_ONLINE_SLOT_IDS_V1.length, 24);
  assert.deepEqual(
    SHADOW_ONLINE_SLOT_IDS_V1,
    Array.from({ length: 24 }, (_, index) => `O${String(index).padStart(2, "0")}`),
  );
  assert.equal(SHADOW_ONLINE_ADAPTER_CONFIG_V1.runtime_mode, "SHADOW_ONLINE");
  assert.equal(SHADOW_ONLINE_ADAPTER_CONFIG_V1.clock.slot_interval, "PT1H");
  assert.equal(SHADOW_ONLINE_ADAPTER_CONFIG_V1.clock.slot_interval_seconds, 3600);
  assert.equal(SHADOW_ONLINE_ADAPTER_CONFIG_V1.clock.accelerated_clock_allowed, false);
  assert.equal(
    SHADOW_ONLINE_ADAPTER_CONFIG_V1.evidence_ingress.future_evidence_leakage_allowed,
    false,
  );
  assert.equal(
    SHADOW_ONLINE_ADAPTER_CONFIG_V1.scheduler.maximum_running_ticks_per_scope,
    1,
  );
  assert.equal(
    SHADOW_ONLINE_ADAPTER_CONFIG_V1.execution_feedback.mode,
    "READ_ONLY_EXISTING_ACTION_EVIDENCE",
  );
  assert.equal(
    SHADOW_ONLINE_ADAPTER_CONFIG_V1.s1_authority.scheduler_loop_authorized,
    false,
  );
  assert.equal(
    SHADOW_ONLINE_ADAPTER_CONFIG_V1.s1_authority.database_write_authorized,
    false,
  );

  const resolved = await clock.resolveBoundary({ scope, slot_id: "O00" });
  const frozen = await evidenceIngress.freezeEligibleEvidence({ boundary: resolved });
  const claim = await scheduler.claimDueSlot({
    boundary: resolved,
    lease_owner: "contract-only",
    lease_duration_seconds: 60,
  });
  const missed = await scheduler.listMissedSlots({
    scope,
    through_logical_time: resolved.logical_time,
  });
  const feedback = await executionFeedback.readExistingExecutionEvidence({ scope, boundary: resolved });
  const health = await availability.inspectAvailability({ scope, boundary: resolved });

  assert.equal(frozen.future_evidence_leakage, false);
  assert.equal(claim.state, "CLAIMED");
  assert.deepEqual(missed, []);
  assert.deepEqual(feedback, []);
  assert.equal(health.runtime_health_status, "DEGRADED");

  const portsSource = fs.readFileSync(PORTS, "utf8");
  const configSource = fs.readFileSync(CONFIG, "utf8");
  const portNames = [
    "ClockPortV1",
    "EvidenceIngressPortV1",
    "SchedulerPortV1",
    "ExecutionFeedbackPortV1",
    "AvailabilityPortV1",
  ];
  for (const portName of portNames) {
    assert.match(portsSource, new RegExp(`export interface ${portName}\\b`));
  }
  for (const forbidden of [
    "process.env",
    "Date.now(",
    "new Date(",
    "setTimeout(",
    "setInterval(",
    "node:pg",
    "node:fs/promises",
    "fastify",
  ]) {
    assert.equal(configSource.includes(forbidden), false, `FORBIDDEN_CONFIG_TOKEN:${forbidden}`);
  }

  const prior = fs.existsSync(OUTPUT)
    ? JSON.parse(fs.readFileSync(OUTPUT, "utf8")) as Record<string, unknown>
    : {};
  const result = {
    ...prior,
    status: "PASS",
    adapter_port_count: portNames.length,
    adapter_port_names: portNames,
    slot_count: SHADOW_ONLINE_SLOT_IDS_V1.length,
    slot_interval: SHADOW_ONLINE_ADAPTER_CONFIG_V1.clock.slot_interval,
    pure_contract_acceptance: true,
    database_access_performed: false,
    scheduler_loop_executed: false,
    wall_clock_read_performed: false,
    canonical_write_performed: false,
    runtime_executable_delta: 0,
    migration_delta: 0,
  };
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify({ status: "FAIL", error: message }, null, 2)}\n`);
  console.error(message);
  process.exitCode = 1;
});
