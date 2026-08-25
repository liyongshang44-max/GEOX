import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
  type FormalForcingAcquisitionBudgetAdjudicationV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_forcing_acquisition_budget_v1.js";
import {
  ExternalFormalExactBasePromotionFailureV1,
  ExternalFormalForcingAutonomousControllerServiceV1,
  type ExternalFormalExactBaseCapturePortV1,
  type ExternalFormalExactBaseCaptureReceiptV1,
  type ExternalFormalExactBasePromotionPortV1,
  type ExternalFormalExactBasePromotionReceiptV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_forcing_autonomous_controller_service_v1.js";
import {
  PostgresExternalFormalForcingBaseContinuityRepositoryV1,
  type ExternalFormalPhysicalFactIdentityV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_base_continuity_repository_v1.js";
import { PostgresExternalFormalForcingControllerLifecycleV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_controller_lifecycle_v1.js";
import { PostgresExternalFormalForcingSupplyAdmissionV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_supply_admission_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_V13_AUTONOMOUS_CONTROLLER_SERVICE_POSTGRES_RESULT.json");
const SUBJECT = "f".repeat(40);
const MAIN_EPOCH = "v13-autonomous-controller-service";
const scope: TwinScopeKeyV1 = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: "zoneA",
};

function addHours(value: string, count: number): string {
  return new Date(Date.parse(value) + count * 3_600_000).toISOString();
}
function addMinutes(value: string, count: number): string {
  return new Date(Date.parse(value) + count * 60_000).toISOString();
}
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function budget(): FormalForcingAcquisitionBudgetAdjudicationV1 {
  return {
    authority_id: MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
    status: "PASS",
    real_sample_count: 3,
    controlled_delay_case_count: 6,
    maximum_real_end_to_end_ms: 600_000,
    maximum_controlled_end_to_end_ms: 720_000,
    measured_envelope_ms: 720_000,
    selected_budget_ms: 900_000,
    safety_margin_ms: 180_000,
    hardcoded_default_budget_minutes: null,
    selection_basis: "MEASURED_ENVELOPE_PLUS_EXPLICIT_MARGIN",
  };
}

async function reset(pool: Pool): Promise<void> {
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query(fs.readFileSync(path.join(ROOT, "docker/postgres/init/001_schema.sql"), "utf8"));
  for (const migration of [
    "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_base_continuity.sql",
    "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_admission.sql",
    "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_lifecycle.sql",
  ]) await pool.query(fs.readFileSync(path.join(ROOT, migration), "utf8"));
}

async function futureBase(pool: Pool): Promise<string> {
  const row = (await pool.query<{ value: string | Date }>("SELECT date_trunc('hour',clock_timestamp()) + interval '2 hour' AS value")).rows[0];
  if (!row) throw new Error("V13_AUTONOMOUS_SERVICE_BASE_REQUIRED");
  return new Date(row.value).toISOString();
}

function points(base: string, key: "precipitation_mm" | "et0_mm_per_hour"): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => ({
    horizon: index + 1,
    valid_from: addHours(base, index),
    valid_to: addHours(base, index + 1),
    [key]: Number((0.15 + index * 0.0001).toFixed(6)),
  }));
}

function fact(kind: "WEATHER" | "ET0" | "SOIL", base: string): { fact_id: string; occurred_at: string; record: Record<string, any>; identity: ExternalFormalPhysicalFactIdentityV1 } {
  const recordType = kind === "WEATHER" ? "future_weather_assumption_v1" : kind === "ET0" ? "future_et0_assumption_v1" : "soil_moisture_observation_v1";
  const sourceRecordId = `v13_autonomous_service_${kind.toLowerCase()}`;
  const available = addMinutes(base, kind === "SOIL" ? -10 : -25);
  const ingested = addMinutes(base, kind === "SOIL" ? -5 : -20);
  const roleTime = kind === "SOIL"
    ? { observed_at: addMinutes(base, -12), ingested_at: ingested }
    : { issued_at: addMinutes(base, -60), ingested_at: ingested, valid_from: base, valid_to: addHours(base, 72) };
  const canonicalPayload = kind === "WEATHER"
    ? { snapshot_kind: "FUTURE_WEATHER_ASSUMPTION", points: points(base, "precipitation_mm") }
    : kind === "ET0"
      ? { snapshot_kind: "FUTURE_ET0_ASSUMPTION", points: points(base, "et0_mm_per_hour") }
      : { quantity_kind: "SOIL_MOISTURE_VWC", unit: "fraction", value: 0.32 };
  const sourceRecordHash = semanticHashV1({ sourceRecordId, recordType, available, roleTime, canonicalPayload });
  const record = {
    dataset_id: "mcft_cap09_v13_autonomous_controller_service_acceptance",
    source_record_id: sourceRecordId,
    source_record_hash: sourceRecordHash,
    record_type: recordType,
    binding_id: `V13_AUTONOMOUS_SERVICE_${kind}`,
    origin_source_kind: "CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id: `V13_AUTONOMOUS_SERVICE_${kind}`,
    epistemic_class: kind === "SOIL" ? "OBSERVED" : "ASSUMED",
    ...scope,
    available_to_runtime_at: available,
    role_time: roleTime,
    quality: { status: "PASS" },
    source_payload: { fixture: true },
    canonical_payload: canonicalPayload,
    source_unit: kind === "SOIL" ? "fraction" : "mm",
    canonical_unit: kind === "SOIL" ? "fraction" : "mm",
    conversion_rule: { rule_id: "V13_AUTONOMOUS_SERVICE_IDENTITY" },
    limitations: ["ENGINEERING_FIXTURE_ONLY", "NOT_FORMAL_EXTERNAL_EVIDENCE"],
  };
  const factId = `fact_v13_autonomous_service_${kind.toLowerCase()}`;
  return {
    fact_id: factId,
    occurred_at: kind === "SOIL" ? roleTime.observed_at : roleTime.issued_at,
    record,
    identity: {
      kind,
      fact_id: factId,
      source_record_id: sourceRecordId,
      source_record_hash: sourceRecordHash,
      record_semantic_hash: semanticHashV1(record),
    },
  };
}

class ControlledCapturePort implements ExternalFormalExactBaseCapturePortV1 {
  calls: string[] = [];
  async captureExactBase(input: { base_target_t: string; subject_sha: string; idempotency_key: string }): Promise<ExternalFormalExactBaseCaptureReceiptV1> {
    this.calls.push(input.base_target_t);
    assert.equal(input.subject_sha, SUBJECT);
    assert(input.idempotency_key.startsWith("formal-forcing-base:"));
    await delay(140);
    return {
      base_target_t: input.base_target_t,
      producer_run_id: "controlled-producer-run-1",
      candidate_artifact_digest: `sha256:${"4".repeat(64)}`,
      capture_ref: "controlled://capture/exact-base",
      raw_values_emitted: false,
      formal_database_write_count: 0,
    };
  }
}

class ControlledPromotionPort implements ExternalFormalExactBasePromotionPortV1 {
  calls: string[] = [];
  constructor(private readonly pool: Pool) {}
  async promoteExactBase(input: { base_target_t: string; subject_sha: string; idempotency_key: string; capture: ExternalFormalExactBaseCaptureReceiptV1 }): Promise<ExternalFormalExactBasePromotionReceiptV1> {
    this.calls.push(input.base_target_t);
    assert.equal(input.subject_sha, SUBJECT);
    assert.equal(input.capture.base_target_t, input.base_target_t);
    await delay(140);
    const facts = (["WEATHER", "ET0", "SOIL"] as const).map((kind) => fact(kind, input.base_target_t));
    for (const item of facts) {
      await this.pool.query(
        "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb)",
        [item.fact_id, item.occurred_at, "mcft_cap09_external_formal_evidence_v1", JSON.stringify({ type: item.record.record_type, payload: item.record })],
      );
    }
    return {
      base_target_t: input.base_target_t,
      promotion_run_id: "controlled-promotion-run-1",
      facts: facts.map((item) => item.identity),
      formal_database_write_count: 3,
    };
  }
}

class NoMutationPromotionPort implements ExternalFormalExactBasePromotionPortV1 {
  async promoteExactBase(): Promise<ExternalFormalExactBasePromotionReceiptV1> {
    throw new ExternalFormalExactBasePromotionFailureV1({
      failure_class: "CONTROLLED_PROMOTION_NO_FORMAL_MUTATION",
      mutation_state: "NO_FORMAL_MUTATION",
      formal_database_write_count: 0,
    });
  }
}

class PartialMutationPromotionPort implements ExternalFormalExactBasePromotionPortV1 {
  constructor(private readonly pool: Pool, private readonly epoch: string) {}
  async promoteExactBase(input: { base_target_t: string }): Promise<ExternalFormalExactBasePromotionReceiptV1> {
    await this.pool.query(
      "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb)",
      [`fact_v13_partial_${this.epoch}`, addMinutes(input.base_target_t, -30), "controlled_partial_formal_mutation", JSON.stringify({ type: "controlled_partial", payload: { epoch: this.epoch } })],
    );
    throw new ExternalFormalExactBasePromotionFailureV1({
      failure_class: "CONTROLLED_PROMOTION_PARTIAL_FORMAL_MUTATION",
      mutation_state: "PARTIAL_FORMAL_MUTATION",
      formal_database_write_count: 1,
    });
  }
}

async function createService(input: {
  pool: Pool;
  epoch: string;
  base: string;
  controllerOwner: string;
  producerOwner: string;
  promotion: ExternalFormalExactBasePromotionPortV1;
}): Promise<{
  continuity: PostgresExternalFormalForcingBaseContinuityRepositoryV1;
  lifecycle: PostgresExternalFormalForcingControllerLifecycleV1;
  admission: PostgresExternalFormalForcingSupplyAdmissionV1;
  capture: ControlledCapturePort;
  service: ExternalFormalForcingAutonomousControllerServiceV1;
}> {
  const continuity = new PostgresExternalFormalForcingBaseContinuityRepositoryV1(input.pool, {
    scope, epoch_id: input.epoch, subject_sha: SUBJECT, first_required_base: input.base, last_required_base: input.base,
  });
  await continuity.initializeCursor();
  const lifecycle = new PostgresExternalFormalForcingControllerLifecycleV1(input.pool, { scope, epoch_id: input.epoch, subject_sha: SUBJECT });
  const admission = new PostgresExternalFormalForcingSupplyAdmissionV1(input.pool, {
    scope, epoch_id: input.epoch, subject_sha: SUBJECT, first_required_base: input.base, last_required_base: input.base, qualified_budget: budget(),
  });
  const capture = new ControlledCapturePort();
  const service = new ExternalFormalForcingAutonomousControllerServiceV1(
    lifecycle,
    admission,
    continuity,
    capture,
    input.promotion,
    {
      subject_sha: SUBJECT,
      controller_owner: input.controllerOwner,
      producer_owner: input.producerOwner,
      controller_lease_duration_seconds: 1,
      producer_lease_duration_seconds: 1,
      heartbeat_interval_ms: 30,
    },
  );
  return { continuity, lifecycle, admission, capture, service };
}

async function targetState(pool: Pool, epoch: string): Promise<{ state: string; failure_class: string | null }> {
  const row = (await pool.query<{ state: string; failure_class: string | null }>(
    "SELECT state,failure_class FROM twin_external_formal_forcing_base_target_v1 WHERE epoch_id=$1",
    [epoch],
  )).rows[0];
  if (!row) throw new Error(`V13_AUTONOMOUS_SERVICE_TARGET_REQUIRED:${epoch}`);
  return row;
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP09_V13_AUTONOMOUS_SERVICE_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP09_V13_AUTONOMOUS_SERVICE_DESTRUCTIVE_ACCEPTANCE_1");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_REQUIRED");
  const pool = new Pool({ connectionString: url, max: 12 });
  try {
    await reset(pool);
    const base = await futureBase(pool);

    const mainPromotion = new ControlledPromotionPort(pool);
    const main = await createService({
      pool,
      epoch: MAIN_EPOCH,
      base,
      controllerOwner: "autonomous-controller-A",
      producerOwner: "autonomous-producer-1",
      promotion: mainPromotion,
    });
    const result = await main.service.runOnce();
    assert.equal(result.status, "COMPLETED_BASE");
    if (result.status !== "COMPLETED_BASE") throw new Error("V13_AUTONOMOUS_SERVICE_COMPLETED_BASE_REQUIRED");
    assert.equal(result.base_target_t, base);
    assert.equal(result.wall_clock_target_planner_used, false);
    assert(result.controller_heartbeat_count >= 2);
    assert(result.producer_heartbeat_count >= 2);
    assert.deepEqual(main.capture.calls, [base]);
    assert.deepEqual(mainPromotion.calls, [base]);
    assert.equal((await main.continuity.readCursor()).completed, true);

    const competing = new ExternalFormalForcingAutonomousControllerServiceV1(
      new PostgresExternalFormalForcingControllerLifecycleV1(pool, { scope, epoch_id: MAIN_EPOCH, subject_sha: SUBJECT }),
      main.admission,
      main.continuity,
      new ControlledCapturePort(),
      new ControlledPromotionPort(pool),
      {
        subject_sha: SUBJECT,
        controller_owner: "autonomous-controller-B",
        producer_owner: "autonomous-producer-2",
        controller_lease_duration_seconds: 1,
        producer_lease_duration_seconds: 1,
        heartbeat_interval_ms: 30,
      },
    );
    const competingResult = await competing.runOnce();
    assert.equal(competingResult.status, "CONTROLLER_BUSY");

    const retryEpoch = "v13-autonomous-promotion-zero-write-failure";
    const retry = await createService({
      pool,
      epoch: retryEpoch,
      base,
      controllerOwner: "retry-controller",
      producerOwner: "retry-producer",
      promotion: new NoMutationPromotionPort(),
    });
    await assert.rejects(
      () => retry.service.runOnce(),
      (error: unknown) => error instanceof ExternalFormalExactBasePromotionFailureV1
        && error.mutation_state === "NO_FORMAL_MUTATION"
        && error.formal_database_write_count === 0,
    );
    const retryState = await targetState(pool, retryEpoch);
    assert.equal(retryState.state, "FAILED_RETRYABLE");
    assert.equal(retryState.failure_class, "PROMOTION_FAILED_NO_FORMAL_MUTATION:CONTROLLED_PROMOTION_NO_FORMAL_MUTATION");
    const retryLifecycle = await retry.lifecycle.acquireOrRenew({ lease_owner: "retry-controller", lease_duration_seconds: 1 });
    assert.notEqual(retryLifecycle.status, "TERMINAL");

    const partialEpoch = "v13-autonomous-promotion-partial-write-failure";
    const partial = await createService({
      pool,
      epoch: partialEpoch,
      base,
      controllerOwner: "partial-controller",
      producerOwner: "partial-producer",
      promotion: new PartialMutationPromotionPort(pool, partialEpoch),
    });
    const partialResult = await partial.service.runOnce();
    assert.equal(partialResult.status, "TERMINAL_PROMOTION_MUTATION_UNSAFE");
    if (partialResult.status !== "TERMINAL_PROMOTION_MUTATION_UNSAFE") throw new Error("V13_AUTONOMOUS_PARTIAL_PROMOTION_TERMINAL_REQUIRED");
    assert.equal(partialResult.mutation_state, "PARTIAL_FORMAL_MUTATION");
    assert.equal(partialResult.formal_database_write_count, 1);
    assert.equal(partialResult.forcing_controller_terminal_recorded, true);
    const partialState = await targetState(pool, partialEpoch);
    assert.equal(partialState.state, "PROMOTING");
    assert.equal(partialState.failure_class, null);
    assert.equal((await partial.continuity.readCursor()).completed, false);
    const partialLifecycle = await partial.lifecycle.acquireOrRenew({ lease_owner: "new-controller-after-partial", lease_duration_seconds: 1 });
    assert.equal(partialLifecycle.status, "TERMINAL");
    const partialFactCount = Number((await pool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM facts WHERE source='controlled_partial_formal_mutation'",
    )).rows[0]?.n ?? "-1");
    assert.equal(partialFactCount, 1);

    const proof = {
      status: "PASS",
      acceptance_mode: "REAL_POSTGRES_V13_AUTONOMOUS_CONTROLLER_SERVICE",
      exact_cursor_base_passed_to_capture: main.capture.calls[0] === base,
      exact_cursor_base_passed_to_promotion: mainPromotion.calls[0] === base,
      wall_clock_target_planner_used: false,
      epoch_controller_heartbeat_during_long_capture_and_promotion: result.controller_heartbeat_count >= 2,
      producer_claim_heartbeat_during_long_capture_and_promotion: result.producer_heartbeat_count >= 2,
      same_producer_fence_preserved_through_completion: result.producer_fencing_token === "1",
      physical_attestation_advanced_cursor: (await main.continuity.readCursor()).completed === true,
      competing_controller_denied_while_lease_live: competingResult.status === "CONTROLLER_BUSY",
      zero_formal_write_promotion_failure_is_retryable: retryState.state === "FAILED_RETRYABLE",
      partial_formal_write_promotion_failure_is_not_retryable: partialState.state === "PROMOTING" && partialState.failure_class === null,
      partial_formal_write_promotion_failure_terminalizes_controller: partialLifecycle.status === "TERMINAL",
      partial_formal_write_does_not_advance_forcing_cursor: (await partial.continuity.readCursor()).completed === false,
      unknown_or_partial_promotion_mutation_fails_closed: true,
      capture_port_formal_database_write_count: 0,
      production_workflow_effect: false,
      formal_v4_mutation_performed: false,
      mcft_cap09_completed: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
    console.log(JSON.stringify(proof, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
