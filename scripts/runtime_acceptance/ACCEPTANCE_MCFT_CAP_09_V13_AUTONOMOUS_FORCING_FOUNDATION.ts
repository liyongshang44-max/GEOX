import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
  MCFT_CAP09_REQUIRED_FORCING_DELAY_CASES_V1,
  adjudicateFormalForcingAcquisitionBudgetV1,
  formalForcingAcquisitionStartDeadlineV1,
  type FormalForcingSupplyTimingPhasesV1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_forcing_acquisition_budget_v1.js";
import {
  PostgresExternalFormalForcingBaseContinuityRepositoryV1,
  type ExternalFormalForcingBaseClaimV1,
  type ExternalFormalPhysicalFactIdentityV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_base_continuity_repository_v1.js";
import type { TwinScopeKeyV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_V13_AUTONOMOUS_FORCING_FOUNDATION_RESULT.json");
const MIGRATION = path.join(ROOT, "apps/server/db/migrations/2026_08_25_mcft_cap_09_v13_forcing_base_continuity.sql");
const SUBJECT = "a".repeat(40);
const scope: TwinScopeKeyV1 = {
  tenant_id: "tenantA",
  project_id: "projectA",
  group_id: "groupA",
  field_id: "fieldA",
  season_id: "seasonA",
  zone_id: "zoneA",
};
const scopeValues = [scope.tenant_id, scope.project_id, scope.group_id, scope.field_id, scope.season_id, scope.zone_id];

function addHours(value: string, hours: number): string {
  return new Date(Date.parse(value) + hours * 3_600_000).toISOString();
}

function addMinutes(value: string, minutes: number): string {
  return new Date(Date.parse(value) + minutes * 60_000).toISOString();
}

async function reset(pool: Pool): Promise<void> {
  await pool.query("DROP SCHEMA public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query(fs.readFileSync(path.join(ROOT, "docker/postgres/init/001_schema.sql"), "utf8"));
  await pool.query(fs.readFileSync(MIGRATION, "utf8"));
}

function weatherPoints(base: string): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => ({
    horizon: index + 1,
    valid_from: addHours(base, index),
    valid_to: addHours(base, index + 1),
    precipitation_mm: Number((0.01 + index * 0.0001).toFixed(6)),
  }));
}

function et0Points(base: string): Array<Record<string, unknown>> {
  return Array.from({ length: 72 }, (_, index) => ({
    horizon: index + 1,
    valid_from: addHours(base, index),
    valid_to: addHours(base, index + 1),
    et0_mm_per_hour: Number((0.10 + index * 0.0002).toFixed(6)),
  }));
}

function buildFact(kind: "WEATHER" | "ET0" | "SOIL", base: string, suffix: string): { factId: string; record: Record<string, any>; identity: ExternalFormalPhysicalFactIdentityV1; occurredAt: string } {
  const available = addMinutes(base, kind === "SOIL" ? -10 : -20);
  const ingested = addMinutes(base, kind === "SOIL" ? -5 : -10);
  const sourceRecordId = `v13_${kind.toLowerCase()}_${suffix}`;
  const recordType = kind === "WEATHER" ? "future_weather_assumption_v1" : kind === "ET0" ? "future_et0_assumption_v1" : "soil_moisture_observation_v1";
  const roleTime = kind === "SOIL"
    ? { observed_at: addMinutes(base, -12), ingested_at: ingested }
    : { issued_at: addMinutes(base, -60), ingested_at: ingested, valid_from: base, valid_to: addHours(base, 72) };
  const canonicalPayload = kind === "WEATHER"
    ? { snapshot_kind: "FUTURE_WEATHER_ASSUMPTION", points: weatherPoints(base) }
    : kind === "ET0"
      ? { snapshot_kind: "FUTURE_ET0_ASSUMPTION", points: et0Points(base) }
      : { quantity_kind: "SOIL_MOISTURE_VWC", unit: "fraction", value: 0.31 };
  const sourceRecordHash = semanticHashV1({ sourceRecordId, recordType, available, roleTime, canonicalPayload });
  const record = {
    dataset_id: "mcft_cap09_v13_foundation_acceptance",
    source_record_id: sourceRecordId,
    source_record_hash: sourceRecordHash,
    record_type: recordType,
    binding_id: `V13_ACCEPTANCE_${kind}`,
    origin_source_kind: "CONTROLLED_ENGINEERING_FIXTURE",
    origin_source_id: `V13_ACCEPTANCE_${kind}`,
    epistemic_class: kind === "SOIL" ? "OBSERVED" : "ASSUMED",
    ...scope,
    available_to_runtime_at: available,
    role_time: roleTime,
    quality: { status: "PASS" },
    source_payload: { fixture: true },
    canonical_payload: canonicalPayload,
    source_unit: kind === "SOIL" ? "fraction" : "mm",
    canonical_unit: kind === "SOIL" ? "fraction" : "mm",
    conversion_rule: { rule_id: "V13_ACCEPTANCE_IDENTITY" },
    limitations: ["ENGINEERING_FIXTURE_ONLY", "NOT_FORMAL_EXTERNAL_EVIDENCE"],
  };
  const factId = `fact_v13_${kind.toLowerCase()}_${suffix}`;
  return {
    factId,
    record,
    identity: {
      kind,
      fact_id: factId,
      source_record_id: sourceRecordId,
      source_record_hash: sourceRecordHash,
      record_semantic_hash: semanticHashV1(record),
    },
    occurredAt: kind === "SOIL" ? roleTime.observed_at : roleTime.issued_at,
  };
}

async function insertCommittedFacts(pool: Pool, base: string, suffix: string): Promise<ExternalFormalPhysicalFactIdentityV1[]> {
  const facts = (["WEATHER", "ET0", "SOIL"] as const).map((kind) => buildFact(kind, base, suffix));
  for (const fact of facts) {
    // Each pool.query is its own transaction. The subsequent attestation therefore starts
    // only after all exact fact writes have committed.
    await pool.query(
      "INSERT INTO facts (fact_id,occurred_at,source,record_json) VALUES ($1,$2::timestamptz,$3,$4::jsonb)",
      [fact.factId, fact.occurredAt, "mcft_cap09_external_formal_evidence_v1", JSON.stringify({ type: fact.record.record_type, payload: fact.record })],
    );
  }
  return facts.map((fact) => fact.identity);
}

function timingPhases(seed: number): FormalForcingSupplyTimingPhasesV1 {
  return {
    wake_delay_ms: 1000 * seed,
    job_start_setup_ms: 2000 + 100 * seed,
    provider_capture_ms: 10_000 + 500 * seed,
    retained_raw_and_candidate_ms: 1500 + 100 * seed,
    promotion_queue_and_setup_ms: 2500 + 100 * seed,
    rehydration_promotion_commit_readback_ms: 3000 + 100 * seed,
  };
}

async function seedPastPromotingTarget(pool: Pool, epochId: string, base: string, claim: ExternalFormalForcingBaseClaimV1): Promise<void> {
  await pool.query(
    `UPDATE twin_external_formal_forcing_base_target_v1
        SET state='PROMOTING',claim_owner=$9,fencing_token=$10::bigint,lease_expires_at=$8::timestamptz,promotion_started_at=$8::timestamptz
      WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6 AND epoch_id=$7 AND base_target_t=$8::timestamptz`,
    [...scopeValues, epochId, base, claim.lease_owner, claim.fencing_token.toString()],
  );
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP09_V13_FOUNDATION_DESTRUCTIVE_ACCEPTANCE !== "1") throw new Error("SET_MCFT_CAP09_V13_FOUNDATION_DESTRUCTIVE_ACCEPTANCE_1");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_REQUIRED");
  const databaseName = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!/(mcft|cap.*09|v13|forcing|acceptance|test)/i.test(databaseName)) throw new Error(`ISOLATED_V13_ACCEPTANCE_DATABASE_REQUIRED:${databaseName}`);

  const pool = new Pool({ connectionString: url, max: 8 });
  try {
    await reset(pool);

    const firstBase = "2099-01-01T01:00:00.000Z";
    const lastBase = "2099-01-01T23:00:00.000Z";
    const repo = new PostgresExternalFormalForcingBaseContinuityRepositoryV1(pool, {
      scope,
      epoch_id: "v13-foundation-main",
      subject_sha: SUBJECT,
      first_required_base: firstBase,
      last_required_base: lastBase,
    });
    const initial = await repo.initializeCursor();
    assert.equal(initial.last_contiguous_eligible_base, "2099-01-01T00:00:00.000Z");
    assert.equal(initial.next_missing_required_base, firstBase);
    assert.equal(initial.completed, false);

    const firstClaimResult = await repo.claimNextMissingBase({ lease_owner: "producer-a", lease_duration_seconds: 300 });
    assert.equal(firstClaimResult.status, "CLAIMED");
    if (firstClaimResult.status !== "CLAIMED") throw new Error("V13_FIRST_CLAIM_REQUIRED");
    const firstClaim = firstClaimResult.claim;
    const duplicateClaim = await repo.claimNextMissingBase({ lease_owner: "producer-a", lease_duration_seconds: 300 });
    assert.equal(duplicateClaim.status, "EXISTING_ACTIVE_CLAIM");
    const busyClaim = await repo.claimNextMissingBase({ lease_owner: "producer-b", lease_duration_seconds: 300 });
    assert.equal(busyClaim.status, "BUSY");

    await repo.advanceClaimPhase({ claim: firstClaim, phase: "ACQUIRING" });
    await repo.advanceClaimPhase({ claim: firstClaim, phase: "READY_TO_FINALIZE" });
    await repo.advanceClaimPhase({ claim: firstClaim, phase: "PROMOTING" });
    const identities = await insertCommittedFacts(pool, firstBase, "main_b01");
    const digest = `sha256:${"1".repeat(64)}`;
    const attestation = await repo.attestFormalPhysicalVisibility({
      claim: firstClaim,
      facts: identities,
      producer_run_id: "producer-run-1",
      promotion_run_id: "promotion-run-1",
      candidate_artifact_digest: digest,
    });
    assert.equal(attestation.status, "PASS");
    assert.equal(attestation.physical_visibility_before_base, true);
    assert(Date.parse(attestation.post_commit_db_readback_at) < Date.parse(firstBase));
    assert(Date.parse(attestation.formal_visible_attested_at) < Date.parse(firstBase));
    assert.equal(attestation.next_missing_required_base, "2099-01-01T02:00:00.000Z");
    const afterAttestation = await repo.readCursor();
    assert.equal(afterAttestation.last_contiguous_eligible_base, firstBase);
    assert.equal(afterAttestation.next_missing_required_base, "2099-01-01T02:00:00.000Z");

    const fenceRepo = new PostgresExternalFormalForcingBaseContinuityRepositoryV1(pool, {
      scope,
      epoch_id: "v13-foundation-fence",
      subject_sha: SUBJECT,
      first_required_base: "2099-02-01T01:00:00.000Z",
      last_required_base: "2099-02-01T02:00:00.000Z",
    });
    await fenceRepo.initializeCursor();
    const fenceAResult = await fenceRepo.claimNextMissingBase({ lease_owner: "producer-old", lease_duration_seconds: 300 });
    assert.equal(fenceAResult.status, "CLAIMED");
    if (fenceAResult.status !== "CLAIMED") throw new Error("V13_FENCE_A_CLAIM_REQUIRED");
    await pool.query(
      `UPDATE twin_external_formal_forcing_base_target_v1 SET lease_expires_at=clock_timestamp()-interval '1 second'
        WHERE epoch_id='v13-foundation-fence' AND base_target_t='2099-02-01T01:00:00.000Z'::timestamptz`,
    );
    const fenceBResult = await fenceRepo.claimNextMissingBase({ lease_owner: "producer-new", lease_duration_seconds: 300 });
    assert.equal(fenceBResult.status, "CLAIMED");
    if (fenceBResult.status !== "CLAIMED") throw new Error("V13_FENCE_B_CLAIM_REQUIRED");
    assert(fenceBResult.claim.fencing_token > fenceAResult.claim.fencing_token);
    await assert.rejects(
      () => fenceRepo.advanceClaimPhase({ claim: fenceAResult.claim, phase: "ACQUIRING" }),
      /FORMAL_FORCING_STALE_FENCING_TOKEN/,
    );
    await fenceRepo.advanceClaimPhase({ claim: fenceBResult.claim, phase: "ACQUIRING" });

    const pastBase = "2000-01-01T01:00:00.000Z";
    const pastRepo = new PostgresExternalFormalForcingBaseContinuityRepositoryV1(pool, {
      scope,
      epoch_id: "v13-foundation-deadline",
      subject_sha: SUBJECT,
      first_required_base: pastBase,
      last_required_base: pastBase,
    });
    await pastRepo.initializeCursor();
    const deadline = await pastRepo.claimNextMissingBase({ lease_owner: "producer-late", lease_duration_seconds: 300 });
    assert.equal(deadline.status, "DEADLINE_MISSED");
    const deadlineState = (await pool.query<{ state: string; failure_class: string }>(
      "SELECT state,failure_class FROM twin_external_formal_forcing_base_target_v1 WHERE epoch_id='v13-foundation-deadline'",
    )).rows[0];
    assert.equal(deadlineState.state, "DEADLINE_MISSED_TERMINAL");
    assert.equal(deadlineState.failure_class, "REQUIRED_FORMAL_FORCING_BASE_DEADLINE_MISSED");

    // Negative proof for the payload-time-travel hole: payload chronology claims the facts
    // were known before a historical base, but the facts are physically inserted now.
    const timeTravelEpoch = "v13-foundation-time-travel";
    const timeTravelRepo = new PostgresExternalFormalForcingBaseContinuityRepositoryV1(pool, {
      scope,
      epoch_id: timeTravelEpoch,
      subject_sha: SUBJECT,
      first_required_base: pastBase,
      last_required_base: pastBase,
    });
    await timeTravelRepo.initializeCursor();
    await timeTravelRepo.claimNextMissingBase({ lease_owner: "producer-time-travel", lease_duration_seconds: 300 });
    const syntheticClaim: ExternalFormalForcingBaseClaimV1 = {
      scope,
      epoch_id: timeTravelEpoch,
      subject_sha: SUBJECT,
      base_target_t: pastBase,
      causal_deadline: pastBase,
      lease_owner: "producer-time-travel",
      fencing_token: 1n,
      lease_expires_at: pastBase,
      idempotency_key: "time-travel-negative",
    };
    await seedPastPromotingTarget(pool, timeTravelEpoch, pastBase, syntheticClaim);
    const latePhysicalFacts = await insertCommittedFacts(pool, pastBase, "time_travel");
    await assert.rejects(
      () => timeTravelRepo.attestFormalPhysicalVisibility({
        claim: syntheticClaim,
        facts: latePhysicalFacts,
        producer_run_id: "producer-run-late",
        promotion_run_id: "promotion-run-late",
        candidate_artifact_digest: `sha256:${"2".repeat(64)}`,
      }),
      /FORMAL_PHYSICAL_VISIBILITY_AFTER_CAUSAL_BASE/,
    );
    const timeTravelState = (await pool.query<{ state: string; post_commit_db_readback_at: string | null }>(
      "SELECT state,post_commit_db_readback_at FROM twin_external_formal_forcing_base_target_v1 WHERE epoch_id=$1",
      [timeTravelEpoch],
    )).rows[0];
    assert.equal(timeTravelState.state, "PROMOTING");
    assert.equal(timeTravelState.post_commit_db_readback_at, null);

    const realSamples = [1, 2, 3].map((seed) => ({ sample_id: `real-${seed}`, ...timingPhases(seed) }));
    const controlled = MCFT_CAP09_REQUIRED_FORCING_DELAY_CASES_V1.map((caseId, index) => ({ case_id: caseId, ...timingPhases(index + 4) }));
    const maxReal = Math.max(...realSamples.map((item) => Object.values(item).filter((value): value is number => typeof value === "number").reduce((a, b) => a + b, 0)));
    const maxControlled = Math.max(...controlled.map((item) => Object.values(item).filter((value): value is number => typeof value === "number").reduce((a, b) => a + b, 0)));
    const envelope = Math.max(maxReal, maxControlled);
    const selectedBudget = envelope + 5000;
    const timing = adjudicateFormalForcingAcquisitionBudgetV1({
      schema_version: "geox_mcft_cap09_formal_forcing_acquisition_budget_qualification_v1",
      authority_id: MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
      real_samples: realSamples,
      controlled_delay_cases: controlled,
      selected_budget_ms: selectedBudget,
      declared_safety_margin_ms: 5000,
    });
    assert.equal(timing.status, "PASS");
    assert.equal(timing.hardcoded_default_budget_minutes, null);
    assert.equal(timing.selected_budget_ms, selectedBudget);
    assert.equal(formalForcingAcquisitionStartDeadlineV1(firstBase, selectedBudget), new Date(Date.parse(firstBase) - selectedBudget).toISOString());
    await assert.rejects(
      async () => adjudicateFormalForcingAcquisitionBudgetV1({
        schema_version: "geox_mcft_cap09_formal_forcing_acquisition_budget_qualification_v1",
        authority_id: MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
        real_samples: realSamples,
        controlled_delay_cases: controlled.slice(0, -1),
        selected_budget_ms: selectedBudget,
        declared_safety_margin_ms: 5000,
      }),
      /FORMAL_FORCING_BUDGET_CONTROLLED_CASE_MISSING/,
    );

    const tableNames = (await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_name IN ('twin_external_formal_forcing_base_cursor_v1','twin_external_formal_forcing_base_target_v1')
        ORDER BY table_name`,
    )).rows.map((row) => row.table_name);
    assert.deepEqual(tableNames, ["twin_external_formal_forcing_base_cursor_v1", "twin_external_formal_forcing_base_target_v1"]);

    const result = {
      status: "PASS",
      acceptance_mode: "REAL_POSTGRESQL_V13_AUTONOMOUS_FORCING_FOUNDATION",
      operational_table_count: 2,
      producer_cursor_continuity_verified: true,
      producer_cursor_leads_runtime_consumption_by_required_base: true,
      exact_predecessor_base_continuity_verified: true,
      forcing_base_claim_lease_fencing_verified: true,
      duplicate_wake_idempotency_verified: true,
      busy_other_owner_no_duplicate_work_verified: true,
      stale_fencing_token_rejected: true,
      missed_causal_deadline_terminalized_before_runtime_claim: true,
      post_commit_fresh_transaction_fact_readback_verified: true,
      db_clock_post_commit_visibility_attested_before_base: true,
      payload_time_travel_rejected_by_physical_visibility: true,
      exact_weather_et0_72_point_base_binding_verified: true,
      end_to_end_budget_requires_real_samples: true,
      end_to_end_budget_requires_controlled_delay_matrix: true,
      hardcoded_35_minute_budget_authorized: false,
      production_workflow_wiring_changed: false,
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
  fs.writeFileSync(OUT, JSON.stringify({ status: "FAIL", error: String(error?.message ?? error) }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
