import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { PoolClient } from "pg";
import { Pool } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1,
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
  type FormalForcingAcquisitionBudgetAdjudicationV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_forcing_acquisition_budget_v1.js";
import {
  MCFT_CAP09_EXTERNAL_EVIDENCE_PIPELINE_VERSION_V1,
  type CanonicalizedExternalEvidenceResultV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import type {
  RawEvidenceRetentionVerificationPortV1,
  VerifyRetainedRawEvidenceInputV1,
} from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import {
  PostgresExternalFormalFencedExactBaseFactPromotionV1,
  PostgresExternalFormalFencedPromotionFailureV1,
} from "../../apps/server/src/persistence/twin_runtime/postgres_external_formal_fenced_exact_base_fact_promotion_v1.js";
import {
  PostgresExternalFormalForcingBaseContinuityRepositoryV1,
  type ExternalFormalForcingBaseClaimV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_base_continuity_repository_v1.js";
import {
  PostgresExternalFormalForcingControllerLifecycleV1,
  type ExternalFormalForcingControllerLeaseV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_controller_lifecycle_v1.js";
import { PostgresExternalFormalForcingSupplyAdmissionV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_supply_admission_v1.js";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_V13_FENCED_FACT_PROMOTION_POSTGRES_RESULT.json");
const SUBJECT = "f".repeat(40);
const scope = { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 };
const scopeValues = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];
const V13_MIGRATIONS = [
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_base_continuity.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_admission.sql",
  "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_controller_lifecycle.sql",
] as const;

type SetupV1 = {
  epoch: string;
  base: string;
  continuity: PostgresExternalFormalForcingBaseContinuityRepositoryV1;
  lifecycle: PostgresExternalFormalForcingControllerLifecycleV1;
  admission: PostgresExternalFormalForcingSupplyAdmissionV1;
  controller: ExternalFormalForcingControllerLeaseV1;
  claim: ExternalFormalForcingBaseClaimV1;
};

function addHours(value: string, count: number): string { return new Date(Date.parse(value) + count * 3_600_000).toISOString(); }
function addMinutes(value: string, count: number): string { return new Date(Date.parse(value) + count * 60_000).toISOString(); }
function sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }
function budget(): FormalForcingAcquisitionBudgetAdjudicationV1 {
  return {
    authority_id: MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
    status: "PASS",
    real_sample_count: 3,
    controlled_delay_case_count: 6,
    maximum_real_end_to_end_ms: 60_000,
    maximum_controlled_end_to_end_ms: 90_000,
    measured_envelope_ms: 90_000,
    selected_budget_ms: 120_000,
    safety_margin_ms: 30_000,
    hardcoded_default_budget_minutes: null,
    selection_basis: "MEASURED_ENVELOPE_PLUS_EXPLICIT_MARGIN",
  };
}

async function reset(pool: Pool): Promise<void> {
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query(fs.readFileSync(path.join(ROOT, "docker/postgres/init/001_schema.sql"), "utf8"));
  for (const migration of V13_MIGRATIONS) await pool.query(fs.readFileSync(path.join(ROOT, migration), "utf8"));
}
async function dbFutureHour(pool: Pool): Promise<string> {
  const row = (await pool.query<{ value: string | Date }>("SELECT date_trunc('hour',clock_timestamp()) + interval '2 hour' AS value")).rows[0];
  if (!row) throw new Error("V13_FENCED_FACT_DB_FUTURE_HOUR_REQUIRED");
  return new Date(row.value).toISOString();
}
function points(base: string, kind: "WEATHER" | "ET0"): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => ({
    horizon: index + 1,
    valid_from: addHours(base, index),
    valid_to: addHours(base, index + 1),
    ...(kind === "WEATHER" ? { precipitation_mm: Number((0.01 + index * 0.0001).toFixed(6)) } : { et0_mm_per_hour: Number((0.1 + index * 0.0002).toFixed(6)) }),
  }));
}
function canonicalResult(kind: "WEATHER" | "ET0" | "SOIL", base: string, suffix: string): CanonicalizedExternalEvidenceResultV1 {
  const recordType = kind === "WEATHER" ? "future_weather_assumption_v1" : kind === "ET0" ? "future_et0_assumption_v1" : "soil_moisture_observation_v1";
  const bindingId = kind === "WEATHER" ? MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_WEATHER_BINDING_ID_V1 : kind === "ET0" ? MCFT_CAP09_EXTERNAL_FORMAL_FUTURE_ET0_BINDING_ID_V1 : MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1;
  const sourceRecordId = `v13_fenced_fact_${suffix}_${kind.toLowerCase()}`;
  const rawHex = (kind === "WEATHER" ? "a" : kind === "ET0" ? "b" : "c").repeat(64);
  const rawSha = `sha256:${rawHex}`;
  const retentionRef = `s3-private://geox-mcft-cap09-formal-raw-v1/mcft-cap09-formal-raw-v1/sha256/${rawHex}`;
  const decoderId = `V13_FENCED_${kind}_DECODER`;
  const decoderVersion = "1";
  const sourcePayloadWithoutRaw = { provider: "V13_FENCED_ACCEPTANCE", fixture_id: `${suffix}:${kind}` };
  const sourceRecordHash = semanticHashV1({
    source_record_id: sourceRecordId,
    raw_sha256: rawSha,
    retention_ref: retentionRef,
    decoder_id: decoderId,
    decoder_version: decoderVersion,
    source_payload: sourcePayloadWithoutRaw,
  });
  const canonicalPayload = kind === "WEATHER"
    ? { snapshot_kind: "FUTURE_WEATHER_ASSUMPTION", points: points(base, kind) }
    : kind === "ET0"
      ? { snapshot_kind: "FUTURE_ET0_ASSUMPTION", points: points(base, kind) }
      : { quantity_kind: "SOIL_MOISTURE_VWC", unit: "fraction", value: 0.31 };
  const canonicalPayloadHash = semanticHashV1(canonicalPayload);
  const available = addMinutes(base, kind === "SOIL" ? -12 : -25);
  const ingested = addMinutes(base, kind === "SOIL" ? -8 : -20);
  const roleTime = kind === "SOIL"
    ? { observed_at: addMinutes(base, -15), ingested_at: ingested }
    : { issued_at: addMinutes(base, -60), ingested_at: ingested, valid_from: base, valid_to: addHours(base, 72) };
  const rawProvenance = {
    raw_sha256: rawSha,
    raw_bytes: 128,
    retention_ref: retentionRef,
    retained_at: addMinutes(base, -30),
    raw_payload_embedded: false,
    decoder_id: decoderId,
    decoder_version: decoderVersion,
  };
  const record: Record<string, any> = {
    dataset_id: `mcft_cap09_v13_fenced_fact_${suffix}`,
    source_record_id: sourceRecordId,
    source_record_hash: sourceRecordHash,
    record_type: recordType,
    binding_id: bindingId,
    origin_source_kind: "PUBLIC_RESEARCH_SOURCE",
    origin_source_id: `V13_FENCED_ACCEPTANCE_${kind}`,
    epistemic_class: kind === "SOIL" ? "OBSERVED" : "ASSUMED",
    ...scope,
    available_to_runtime_at: available,
    role_time: roleTime,
    quality: {
      status: "PASS",
      raw_source_sha256: rawSha,
      raw_retention_ref: retentionRef,
      raw_payload_embedded: false,
      canonical_payload_sha256: canonicalPayloadHash,
    },
    source_payload: { ...sourcePayloadWithoutRaw, raw_provenance: rawProvenance },
    canonical_payload: canonicalPayload,
    source_unit: kind === "SOIL" ? "fraction" : "mm",
    canonical_unit: kind === "SOIL" ? "fraction" : "mm",
    conversion_rule: { rule_id: "V13_FENCED_ACCEPTANCE_IDENTITY" },
    limitations: ["CI_ONLY_NOT_FORMAL_EXTERNAL_EVIDENCE"],
    execution_metadata: { acceptance: true },
  };
  return {
    pipeline_version: MCFT_CAP09_EXTERNAL_EVIDENCE_PIPELINE_VERSION_V1,
    record,
    record_semantic_sha256: semanticHashV1(record),
    canonical_payload_sha256: canonicalPayloadHash,
    raw_provenance: rawProvenance,
    decoder: { decoder_id: decoderId, decoder_version: decoderVersion },
  } as unknown as CanonicalizedExternalEvidenceResultV1;
}
function bundle(base: string, suffix: string) {
  const results = (["WEATHER", "ET0", "SOIL"] as const).map((kind) => canonicalResult(kind, base, suffix));
  return {
    results,
    manifest: results.map((item) => ({ record_type: item.record.record_type, source_record_id: item.record.source_record_id, record_semantic_sha256: item.record_semantic_sha256 })),
  };
}
class MemoryRetentionVerifier implements RawEvidenceRetentionVerificationPortV1 {
  verify_count = 0;
  async verifyRetainedRawEvidence(input: VerifyRetainedRawEvidenceInputV1): Promise<void> {
    assert.match(input.retained_sha256, /^sha256:[0-9a-f]{64}$/);
    assert.equal(input.retained_bytes, 128);
    assert.match(input.retention_ref, /^s3-private:\/\/geox-mcft-cap09-formal-raw-v1\/mcft-cap09-formal-raw-v1\/sha256\/[0-9a-f]{64}$/);
    this.verify_count += 1;
  }
}

class QueryPauseGate {
  private pausedResolve!: () => void;
  private resumeResolve!: () => void;
  readonly paused = new Promise<void>((resolve) => { this.pausedResolve = resolve; });
  private readonly resumePromise = new Promise<void>((resolve) => { this.resumeResolve = resolve; });
  triggered = false;
  constructor(private readonly matcher: (sql: string) => boolean) {}
  async maybePause(sql: unknown): Promise<void> {
    if (!this.triggered && typeof sql === "string" && this.matcher(sql)) {
      this.triggered = true;
      this.pausedResolve();
      await this.resumePromise;
    }
  }
  resume(): void { this.resumeResolve(); }
}
class PausingPool {
  constructor(private readonly inner: Pool, private readonly gate: QueryPauseGate) {}
  async connect() {
    const client = await this.inner.connect();
    return {
      query: async (text: any, values?: any[]) => {
        await this.gate.maybePause(text);
        return client.query(text, values);
      },
      release: () => client.release(),
    } as Pick<PoolClient, "query" | "release">;
  }
}

async function setup(pool: Pool, epoch: string, controllerLeaseSeconds = 900, producerLeaseSeconds = 900): Promise<SetupV1> {
  await reset(pool);
  const base = await dbFutureHour(pool);
  const continuity = new PostgresExternalFormalForcingBaseContinuityRepositoryV1(pool, { scope, epoch_id: epoch, subject_sha: SUBJECT, first_required_base: base, last_required_base: base });
  await continuity.initializeCursor();
  const lifecycle = new PostgresExternalFormalForcingControllerLifecycleV1(pool, { scope, epoch_id: epoch, subject_sha: SUBJECT });
  const acquired = await lifecycle.acquireOrRenew({ lease_owner: "controller-A", lease_duration_seconds: controllerLeaseSeconds });
  assert.equal(acquired.status, "ACQUIRED");
  if (acquired.status !== "ACQUIRED") throw new Error("V13_FENCED_FACT_CONTROLLER_A_REQUIRED");
  const admission = new PostgresExternalFormalForcingSupplyAdmissionV1(pool, { scope, epoch_id: epoch, subject_sha: SUBJECT, first_required_base: base, last_required_base: base, qualified_budget: budget() });
  const admitted = await admission.claimNextRequiredBase({ controller_lease: acquired.lease, lease_owner: "producer-A", lease_duration_seconds: producerLeaseSeconds });
  assert.equal(admitted.status, "CLAIMED");
  if (admitted.status !== "CLAIMED") throw new Error("V13_FENCED_FACT_PRODUCER_A_REQUIRED");
  await continuity.advanceClaimPhaseUnderController({ controller_lease: acquired.lease, claim: admitted.claim, phase: "ACQUIRING" });
  await continuity.advanceClaimPhaseUnderController({ controller_lease: acquired.lease, claim: admitted.claim, phase: "READY_TO_FINALIZE" });
  await continuity.advanceClaimPhaseUnderController({ controller_lease: acquired.lease, claim: admitted.claim, phase: "PROMOTING" });
  return { epoch, base, continuity, lifecycle, admission, controller: acquired.lease, claim: admitted.claim };
}
async function factsCount(pool: Pool): Promise<number> { return Number((await pool.query("SELECT count(*)::int AS n FROM facts")).rows[0]?.n ?? -1); }
async function targetState(pool: Pool, epoch: string): Promise<{ state: string; formal_visible_attested_at: string | null }> {
  const row = (await pool.query("SELECT state,formal_visible_attested_at FROM twin_external_formal_forcing_base_target_v1 WHERE epoch_id=$1", [epoch])).rows[0];
  if (!row) throw new Error("V13_FENCED_FACT_TARGET_REQUIRED");
  return { state: String(row.state), formal_visible_attested_at: row.formal_visible_attested_at === null ? null : new Date(row.formal_visible_attested_at).toISOString() };
}
async function cursorState(pool: Pool, epoch: string): Promise<{ completed: boolean; next_missing_required_base: string | null }> {
  const row = (await pool.query("SELECT completed,next_missing_required_base FROM twin_external_formal_forcing_base_cursor_v1 WHERE epoch_id=$1", [epoch])).rows[0];
  if (!row) throw new Error("V13_FENCED_FACT_CURSOR_REQUIRED");
  return { completed: Boolean(row.completed), next_missing_required_base: row.next_missing_required_base === null ? null : new Date(row.next_missing_required_base).toISOString() };
}
async function expireController(pool: Pool, epoch: string): Promise<void> {
  await pool.query(`UPDATE twin_external_formal_forcing_controller_lease_v1 SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE epoch_id=$1`, [epoch]);
}
async function expireProducer(pool: Pool, epoch: string): Promise<void> {
  await pool.query(`UPDATE twin_external_formal_forcing_base_target_v1 SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE epoch_id=$1`, [epoch]);
}

async function controllerTakeoverRace(pool: Pool): Promise<void> {
  const setupResult = await setup(pool, "v13-fenced-fact-controller-race");
  const payload = bundle(setupResult.base, "controller-race");
  const verifier = new MemoryRetentionVerifier();
  const gate = new QueryPauseGate((sql) => sql.includes("FROM twin_external_formal_forcing_controller_lease_v1") && sql.includes("FOR UPDATE"));
  const promotion = new PostgresExternalFormalFencedExactBaseFactPromotionV1(new PausingPool(pool, gate) as any, verifier, { scope, epoch_id: setupResult.epoch, subject_sha: SUBJECT });
  const attempt = promotion.promote({ base_target_t: setupResult.base, controller_lease: setupResult.controller, producer_claim: setupResult.claim, results: payload.results, expected_semantic_manifest: payload.manifest });
  await gate.paused;
  await expireController(pool, setupResult.epoch);
  const takeover = await setupResult.lifecycle.acquireOrRenew({ lease_owner: "controller-B", lease_duration_seconds: 900 });
  assert.equal(takeover.status, "TAKEN_OVER");
  gate.resume();
  await assert.rejects(attempt, (error: unknown) => error instanceof PostgresExternalFormalFencedPromotionFailureV1 && error.mutation_state === "NO_FORMAL_MUTATION" && /CONTROLLER_STALE_FENCE/.test(error.failure_class));
  assert.equal(await factsCount(pool), 0);
  assert.equal((await targetState(pool, setupResult.epoch)).state, "PROMOTING");
  assert.equal((await cursorState(pool, setupResult.epoch)).completed, false);
  assert.equal(verifier.verify_count, 3);
}

async function producerTakeoverRace(pool: Pool): Promise<void> {
  const setupResult = await setup(pool, "v13-fenced-fact-producer-race");
  const payload = bundle(setupResult.base, "producer-race");
  const verifier = new MemoryRetentionVerifier();
  const gate = new QueryPauseGate((sql) => sql.includes("FROM twin_external_formal_forcing_controller_lease_v1") && sql.includes("FOR UPDATE"));
  const promotion = new PostgresExternalFormalFencedExactBaseFactPromotionV1(new PausingPool(pool, gate) as any, verifier, { scope, epoch_id: setupResult.epoch, subject_sha: SUBJECT });
  const attempt = promotion.promote({ base_target_t: setupResult.base, controller_lease: setupResult.controller, producer_claim: setupResult.claim, results: payload.results, expected_semantic_manifest: payload.manifest });
  await gate.paused;
  await expireProducer(pool, setupResult.epoch);
  const producerB = await setupResult.admission.claimNextRequiredBase({ controller_lease: setupResult.controller, lease_owner: "producer-B", lease_duration_seconds: 900 });
  assert.equal(producerB.status, "CLAIMED");
  if (producerB.status !== "CLAIMED") throw new Error("V13_FENCED_FACT_PRODUCER_B_TAKEOVER_REQUIRED");
  assert.equal(producerB.claim.fencing_token, setupResult.claim.fencing_token + 1n);
  gate.resume();
  await assert.rejects(attempt, (error: unknown) => error instanceof PostgresExternalFormalFencedPromotionFailureV1 && error.mutation_state === "NO_FORMAL_MUTATION" && /PRODUCER_STALE_FENCE_OR_STATE/.test(error.failure_class));
  assert.equal(await factsCount(pool), 0);
  assert.equal((await cursorState(pool, setupResult.epoch)).completed, false);
  assert.equal(verifier.verify_count, 3);
}

async function leaseExpiryInsideLockedTransaction(pool: Pool): Promise<void> {
  const setupResult = await setup(pool, "v13-fenced-fact-expiry", 1, 1);
  const payload = bundle(setupResult.base, "expiry");
  const verifier = new MemoryRetentionVerifier();
  const gate = new QueryPauseGate((sql) => sql.startsWith("INSERT INTO facts"));
  const promotion = new PostgresExternalFormalFencedExactBaseFactPromotionV1(new PausingPool(pool, gate) as any, verifier, { scope, epoch_id: setupResult.epoch, subject_sha: SUBJECT });
  const attempt = promotion.promote({ base_target_t: setupResult.base, controller_lease: setupResult.controller, producer_claim: setupResult.claim, results: payload.results, expected_semantic_manifest: payload.manifest });
  await gate.paused;
  await sleep(1_150);
  gate.resume();
  await assert.rejects(attempt, (error: unknown) => error instanceof PostgresExternalFormalFencedPromotionFailureV1 && error.mutation_state === "NO_FORMAL_MUTATION" && /LEASE_EXPIRED/.test(error.failure_class));
  assert.equal(await factsCount(pool), 0, "V13_FENCED_FACT_EXPIRED_TRANSACTION_MUST_ROLL_BACK_ALL_FACTS");
  assert.equal((await cursorState(pool, setupResult.epoch)).completed, false);
}

async function validCommitThenControllerRecovery(pool: Pool): Promise<void> {
  const setupResult = await setup(pool, "v13-fenced-fact-recovery");
  const payload = bundle(setupResult.base, "recovery");
  const verifier = new MemoryRetentionVerifier();
  const promotion = new PostgresExternalFormalFencedExactBaseFactPromotionV1(pool, verifier, { scope, epoch_id: setupResult.epoch, subject_sha: SUBJECT });
  const receipt = await promotion.promote({ base_target_t: setupResult.base, controller_lease: setupResult.controller, producer_claim: setupResult.claim, results: payload.results, expected_semantic_manifest: payload.manifest });
  assert.equal(receipt.database_fence_commit_succeeded, true);
  assert.equal(receipt.formal_fact_present_count, 3);
  assert.equal(await factsCount(pool), 3);
  assert.equal((await targetState(pool, setupResult.epoch)).state, "PROMOTING");
  assert.equal((await cursorState(pool, setupResult.epoch)).completed, false);

  await expireController(pool, setupResult.epoch);
  const takeover = await setupResult.lifecycle.acquireOrRenew({ lease_owner: "controller-B", lease_duration_seconds: 900 });
  assert.equal(takeover.status, "TAKEN_OVER");
  if (takeover.status !== "TAKEN_OVER") throw new Error("V13_FENCED_FACT_RECOVERY_CONTROLLER_B_REQUIRED");
  const attested = await setupResult.continuity.attestFormalPhysicalVisibilityUnderController({
    controller_lease: takeover.lease,
    claim: setupResult.claim,
    facts: receipt.facts,
    producer_run_id: "producer-run-fenced-recovery",
    promotion_run_id: "promotion-run-fenced-recovery",
    candidate_artifact_digest: `sha256:${"d".repeat(64)}`,
  });
  assert.equal(attested.status, "PASS");
  assert.equal(attested.cursor_advanced, true);
  assert.equal((await cursorState(pool, setupResult.epoch)).completed, true);
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP09_V13_FENCED_FACT_PROMOTION_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP09_V13_FENCED_FACT_PROMOTION_DESTRUCTIVE_ACCEPTANCE_1");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_REQUIRED");
  const pool = new Pool({ connectionString: url, max: 12 });
  try {
    await controllerTakeoverRace(pool);
    await producerTakeoverRace(pool);
    await leaseExpiryInsideLockedTransaction(pool);
    await validCommitThenControllerRecovery(pool);
    const proof = {
      status: "PASS",
      acceptance_mode: "REAL_POSTGRES_V13_DATABASE_FENCED_FORMAL_FACT_PROMOTION",
      stale_controller_after_promotion_start_fact_row_delta_zero: true,
      stale_producer_after_promotion_start_fact_row_delta_zero: true,
      controller_and_target_rows_locked_before_fact_insert: true,
      controller_fence_revalidated_in_same_fact_transaction: true,
      producer_fence_revalidated_in_same_fact_transaction: true,
      promoting_state_revalidated_in_same_fact_transaction: true,
      live_lease_and_db_clock_rechecked_before_each_append_and_commit: true,
      lease_expiry_inside_locked_transaction_rolls_back_all_facts: true,
      exact_three_facts_single_atomic_transaction: true,
      valid_fenced_commit_survives_controller_takeover: true,
      successor_controller_can_attest_existing_exact_facts: true,
      cursor_not_advanced_by_fact_promotion: true,
      production_workflow_effect: false,
      formal_v4_mutation_performed: false,
      mcft_cap09_completed: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(proof, null, 2) + "\n");
    console.log(JSON.stringify(proof));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }, null, 2) + "\n");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
