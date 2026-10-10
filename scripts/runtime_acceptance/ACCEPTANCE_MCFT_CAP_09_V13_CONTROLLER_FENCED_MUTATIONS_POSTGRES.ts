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
  PostgresExternalFormalForcingBaseContinuityRepositoryV1,
  type ExternalFormalPhysicalFactIdentityV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_base_continuity_repository_v1.js";
import { PostgresExternalFormalForcingControllerLifecycleV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_controller_lifecycle_v1.js";
import { PostgresExternalFormalForcingSupplyAdmissionV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_supply_admission_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_V13_CONTROLLER_FENCED_MUTATIONS_POSTGRES_RESULT.json");
const SUBJECT = "e".repeat(40);
const EPOCH = "v13-controller-fenced-mutations";
const scope: TwinScopeKeyV1 = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: "zoneA",
};
const scopeValues = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];

function addHours(value: string, count: number): string {
  return new Date(Date.parse(value) + count * 3_600_000).toISOString();
}
function addMinutes(value: string, count: number): string {
  return new Date(Date.parse(value) + count * 60_000).toISOString();
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

async function dbFutureHour(pool: Pool): Promise<string> {
  const row = (await pool.query<{ value: string | Date }>("SELECT date_trunc('hour',clock_timestamp()) + interval '2 hour' AS value")).rows[0];
  if (!row) throw new Error("V13_FENCED_MUTATION_DB_HOUR_REQUIRED");
  return new Date(row.value).toISOString();
}

function points(base: string, key: "precipitation_mm" | "et0_mm_per_hour"): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => ({
    horizon: index + 1,
    valid_from: addHours(base, index),
    valid_to: addHours(base, index + 1),
    [key]: Number((0.1 + index * 0.0001).toFixed(6)),
  }));
}

function buildFact(kind: "WEATHER" | "ET0" | "SOIL", base: string): { fact_id: string; occurred_at: string; record: Record<string, any>; identity: ExternalFormalPhysicalFactIdentityV1 } {
  const recordType = kind === "WEATHER" ? "future_weather_assumption_v1" : kind === "ET0" ? "future_et0_assumption_v1" : "soil_moisture_observation_v1";
  const sourceRecordId = `v13_controller_fence_${kind.toLowerCase()}`;
  const available = addMinutes(base, kind === "SOIL" ? -12 : -25);
  const ingested = addMinutes(base, kind === "SOIL" ? -8 : -20);
  const roleTime = kind === "SOIL"
    ? { observed_at: addMinutes(base, -15), ingested_at: ingested }
    : { issued_at: addMinutes(base, -60), ingested_at: ingested, valid_from: base, valid_to: addHours(base, 72) };
  const canonicalPayload = kind === "WEATHER"
    ? { snapshot_kind: "FUTURE_WEATHER_ASSUMPTION", points: points(base, "precipitation_mm") }
    : kind === "ET0"
      ? { snapshot_kind: "FUTURE_ET0_ASSUMPTION", points: points(base, "et0_mm_per_hour") }
      : { quantity_kind: "SOIL_MOISTURE_VWC", unit: "fraction", value: 0.30 };
  const sourceRecordHash = semanticHashV1({ sourceRecordId, recordType, available, roleTime, canonicalPayload });
  const record = {
    dataset_id: "mcft_cap09_v13_controller_fenced_mutation_acceptance",
    source_record_id: sourceRecordId,
    source_record_hash: sourceRecordHash,
    record_type: recordType,
    binding_id: `V13_CONTROLLER_FENCE_${kind}`,
    origin_source_kind: "CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id: `V13_CONTROLLER_FENCE_${kind}`,
    epistemic_class: kind === "SOIL" ? "OBSERVED" : "ASSUMED",
    ...scope,
    available_to_runtime_at: available,
    role_time: roleTime,
    quality: { status: "PASS" },
    source_payload: { fixture: true },
    canonical_payload: canonicalPayload,
    source_unit: kind === "SOIL" ? "fraction" : "mm",
    canonical_unit: kind === "SOIL" ? "fraction" : "mm",
    conversion_rule: { rule_id: "V13_CONTROLLER_FENCE_IDENTITY" },
    limitations: ["ENGINEERING_FIXTURE_ONLY", "NOT_FORMAL_EXTERNAL_EVIDENCE"],
  };
  const factId = `fact_v13_controller_fence_${kind.toLowerCase()}`;
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

async function insertFacts(pool: Pool, base: string): Promise<ExternalFormalPhysicalFactIdentityV1[]> {
  const facts = (["WEATHER", "ET0", "SOIL"] as const).map((kind) => buildFact(kind, base));
  for (const fact of facts) {
    await pool.query(
      "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb)",
      [fact.fact_id, fact.occurred_at, "mcft_cap09_external_formal_evidence_v1", JSON.stringify({ type: fact.record.record_type, payload: fact.record })],
    );
  }
  return facts.map((fact) => fact.identity);
}

async function targetSnapshot(pool: Pool): Promise<{ state: string; lease_expires_at: string | Date | null; failure_class: string | null; formal_visible_attested_at: string | Date | null }> {
  const row = (await pool.query<{
    state: string;
    lease_expires_at: string | Date | null;
    failure_class: string | null;
    formal_visible_attested_at: string | Date | null;
  }>("SELECT state,lease_expires_at,failure_class,formal_visible_attested_at FROM twin_external_formal_forcing_base_target_v1 WHERE epoch_id=$1", [EPOCH])).rows[0];
  if (!row) throw new Error("V13_FENCED_MUTATION_TARGET_REQUIRED");
  return row;
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP09_V13_FENCED_MUTATION_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP09_V13_FENCED_MUTATION_DESTRUCTIVE_ACCEPTANCE_1");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_REQUIRED");
  const pool = new Pool({ connectionString: url, max: 8 });
  try {
    await reset(pool);
    const base = await dbFutureHour(pool);
    const continuity = new PostgresExternalFormalForcingBaseContinuityRepositoryV1(pool, {
      scope, epoch_id: EPOCH, subject_sha: SUBJECT, first_required_base: base, last_required_base: base,
    });
    await continuity.initializeCursor();

    const lifecycle = new PostgresExternalFormalForcingControllerLifecycleV1(pool, { scope, epoch_id: EPOCH, subject_sha: SUBJECT });
    const controllerA = await lifecycle.acquireOrRenew({ lease_owner: "controller-A", lease_duration_seconds: 900 });
    assert.equal(controllerA.status, "ACQUIRED");
    if (controllerA.status !== "ACQUIRED") throw new Error("V13_FENCED_MUTATION_CONTROLLER_A_REQUIRED");

    const admission = new PostgresExternalFormalForcingSupplyAdmissionV1(pool, {
      scope, epoch_id: EPOCH, subject_sha: SUBJECT, first_required_base: base, last_required_base: base, qualified_budget: budget(),
    });
    const admitted = await admission.claimNextRequiredBase({ controller_lease: controllerA.lease, lease_owner: "producer-1", lease_duration_seconds: 900 });
    assert.equal(admitted.status, "CLAIMED");
    if (admitted.status !== "CLAIMED") throw new Error("V13_FENCED_MUTATION_PRODUCER_CLAIM_REQUIRED");
    const producerClaim = admitted.claim;

    await continuity.advanceClaimPhaseUnderController({ controller_lease: controllerA.lease, claim: producerClaim, phase: "ACQUIRING" });
    const beforeTakeover = await targetSnapshot(pool);
    assert.equal(beforeTakeover.state, "ACQUIRING");

    await pool.query(
      `UPDATE twin_external_formal_forcing_controller_lease_v1 SET lease_expires_at=clock_timestamp()-interval '1 second'
        WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7`,
      [...scopeValues, EPOCH],
    );
    const controllerB = await lifecycle.acquireOrRenew({ lease_owner: "controller-B", lease_duration_seconds: 900 });
    assert.equal(controllerB.status, "TAKEN_OVER");
    if (controllerB.status !== "TAKEN_OVER") throw new Error("V13_FENCED_MUTATION_CONTROLLER_B_TAKEOVER_REQUIRED");
    assert.equal(controllerB.lease.fencing_token, 2n);

    const beforeStaleHeartbeat = await targetSnapshot(pool);
    await assert.rejects(
      () => continuity.heartbeatClaimUnderController({ controller_lease: controllerA.lease, claim: producerClaim, lease_duration_seconds: 900 }),
      /FORMAL_FORCING_CONTROLLER_STALE_FENCE/,
    );
    const afterStaleHeartbeat = await targetSnapshot(pool);
    assert.equal(String(afterStaleHeartbeat.lease_expires_at), String(beforeStaleHeartbeat.lease_expires_at));

    await assert.rejects(
      () => continuity.advanceClaimPhaseUnderController({ controller_lease: controllerA.lease, claim: producerClaim, phase: "READY_TO_FINALIZE" }),
      /FORMAL_FORCING_CONTROLLER_STALE_FENCE/,
    );
    assert.equal((await targetSnapshot(pool)).state, "ACQUIRING");

    await assert.rejects(
      () => continuity.markRetryableFailureUnderController({ controller_lease: controllerA.lease, claim: producerClaim, failure_class: "STALE_CONTROLLER_MUST_NOT_WRITE" }),
      /FORMAL_FORCING_CONTROLLER_STALE_FENCE/,
    );
    const afterStaleRetryable = await targetSnapshot(pool);
    assert.equal(afterStaleRetryable.state, "ACQUIRING");
    assert.equal(afterStaleRetryable.failure_class, null);

    // Current controller can supervise the still-live producer claim without changing its per-base fence.
    const heartbeatUnderB = await continuity.heartbeatClaimUnderController({ controller_lease: controllerB.lease, claim: producerClaim, lease_duration_seconds: 900 });
    assert.equal(heartbeatUnderB.fencing_token, producerClaim.fencing_token);
    assert.equal(heartbeatUnderB.lease_owner, producerClaim.lease_owner);
    await continuity.advanceClaimPhaseUnderController({ controller_lease: controllerB.lease, claim: producerClaim, phase: "READY_TO_FINALIZE" });
    await continuity.advanceClaimPhaseUnderController({ controller_lease: controllerB.lease, claim: producerClaim, phase: "PROMOTING" });

    const identities = await insertFacts(pool, base);
    await assert.rejects(
      () => continuity.attestFormalPhysicalVisibilityUnderController({
        controller_lease: controllerA.lease,
        claim: producerClaim,
        facts: identities,
        producer_run_id: "producer-run-1",
        promotion_run_id: "promotion-run-1",
        candidate_artifact_digest: `sha256:${"3".repeat(64)}`,
      }),
      /FORMAL_FORCING_CONTROLLER_STALE_FENCE/,
    );
    const afterStaleAttestation = await targetSnapshot(pool);
    assert.equal(afterStaleAttestation.state, "PROMOTING");
    assert.equal(afterStaleAttestation.formal_visible_attested_at, null);
    const cursorBeforeCurrentAttestation = await continuity.readCursor();
    assert.equal(cursorBeforeCurrentAttestation.completed, false);
    assert.equal(cursorBeforeCurrentAttestation.next_missing_required_base, base);

    const attested = await continuity.attestFormalPhysicalVisibilityUnderController({
      controller_lease: controllerB.lease,
      claim: producerClaim,
      facts: identities,
      producer_run_id: "producer-run-1",
      promotion_run_id: "promotion-run-1",
      candidate_artifact_digest: `sha256:${"3".repeat(64)}`,
    });
    assert.equal(attested.status, "PASS");
    assert.equal(attested.cursor_advanced, true);
    assert.equal(attested.next_missing_required_base, null);
    assert.equal((await continuity.readCursor()).completed, true);

    const result = {
      status: "PASS",
      acceptance_mode: "REAL_POSTGRES_V13_CONTROLLER_FENCED_DOWNSTREAM_MUTATIONS",
      controller_takeover_token_incremented: true,
      stale_controller_heartbeat_rejected_without_mutation: true,
      stale_controller_phase_advance_rejected_without_mutation: true,
      stale_controller_retryable_failure_rejected_without_mutation: true,
      stale_controller_attestation_rejected_in_writer_transaction: true,
      stale_controller_cannot_advance_forcing_cursor: true,
      current_controller_can_supervise_existing_live_producer_claim: true,
      producer_fencing_token_preserved_across_controller_takeover: true,
      current_controller_can_complete_physical_attestation: true,
      production_workflow_effect: false,
      formal_v4_mutation_performed: false,
      mcft_cap09_completed: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
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
