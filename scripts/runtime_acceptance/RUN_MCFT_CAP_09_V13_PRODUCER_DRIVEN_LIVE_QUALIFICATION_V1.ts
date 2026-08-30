import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  composeMcftCap09V13ForcingProducerCoreV1,
  MCFT_CAP09_V13_FORCING_PRODUCER_CORE_ID_V1,
} from "../../apps/server/src/external_evidence/mcft_cap09_v13_forcing_production_composition_v1.js";
import { PostgresExternalFormalForcingBaseContinuityRepositoryV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_base_continuity_repository_v1.js";
import { PostgresExternalFormalForcingControllerLifecycleV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_controller_lifecycle_v1.js";

const OUT = path.resolve("acceptance-output/MCFT_CAP_09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_V1_RESULT.json");
const EXPECTED_V13_DB = "geox_mcft_cap09_s6_accel24t_am19_v13";
const EXPECTED_BLOCKED_DB = "geox_mcft_cap09_s6_accel24t_am19_blocked_v13";
const EXPECTED_BUCKET = "geox-mcft-cap09-formal-raw-v1";
const EVIDENCE_ROLE = "geox_mcft_cap09_evidence_runtime_v1";

function required(name: string): string {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error("V13_LIVE_QUALIFICATION_ENV_REQUIRED:" + name);
  return value;
}
function dbName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ""));
}
function canonicalHour(ms: number): string {
  const d = new Date(ms);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}
function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 3_600_000).toISOString();
}
function elapsed(start: number): number {
  return Math.max(0, Date.now() - start);
}
async function currentRole(pool: Pool): Promise<string> {
  return String((await pool.query<{ current_user: string }>("SELECT current_user::text AS current_user")).rows[0]?.current_user ?? "");
}
async function publicTableCount(pool: Pool): Promise<number> {
  return Number((await pool.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
  )).rows[0]?.n ?? -1);
}
async function functionExists(pool: Pool): Promise<boolean> {
  const row = (await pool.query<{ present: boolean }>(
    "SELECT to_regprocedure('public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb)') IS NOT NULL AS present",
  )).rows[0];
  return row?.present === true;
}
async function runBlockedNegative(input: { url: string; subject: string }): Promise<Record<string, unknown>> {
  const pool = new Pool({ connectionString: input.url, max: 2 });
  const epoch = "epoch_mcft_cap09_v13_blocked_qual_" + input.subject.slice(0, 12);
  const pastBase = canonicalHour(Date.now() - 3_600_000);
  try {
    assert.equal(await currentRole(pool), EVIDENCE_ROLE, "V13_BLOCKED_QUALIFICATION_EVIDENCE_ROLE_REQUIRED");
    assert.equal(await publicTableCount(pool), 29, "V13_BLOCKED_QUALIFICATION_29_TABLES_REQUIRED");
    const lifecycle = new PostgresExternalFormalForcingControllerLifecycleV1(pool, {
      scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
      epoch_id: epoch,
      subject_sha: input.subject,
    });
    const continuity = new PostgresExternalFormalForcingBaseContinuityRepositoryV1(pool, {
      scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
      epoch_id: epoch,
      subject_sha: input.subject,
      first_required_base: pastBase,
      last_required_base: pastBase,
    });
    await continuity.initializeCursor();
    const controller = await lifecycle.acquireOrRenew({
      lease_owner: "mcft-cap09-v13-blocked-qualification-controller:" + input.subject.slice(0, 12),
      lease_duration_seconds: 1800,
    });
    assert.ok(["ACQUIRED", "RENEWED", "TAKEN_OVER"].includes(controller.status), "V13_BLOCKED_CONTROLLER_ACQUIRE_REQUIRED");
    const claim = await continuity.claimNextMissingBase({
      lease_owner: "mcft-cap09-v13-blocked-qualification-producer:" + input.subject.slice(0, 12),
      lease_duration_seconds: 1800,
    });
    assert.equal(claim.status, "DEADLINE_MISSED", "V13_BLOCKED_LATE_BASE_MUST_FAIL_CLOSED");
    const factCount = Number((await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.facts WHERE source='mcft_cap09_external_formal_evidence_v1'",
    )).rows[0]?.n ?? -1);
    assert.equal(factCount, 0, "V13_BLOCKED_NEGATIVE_MUST_NOT_PROMOTE_FACTS");
    return {
      status: "PASS",
      epoch_id: epoch,
      base_target_t: pastBase,
      claim_status: claim.status,
      failure_class: claim.status === "DEADLINE_MISSED" ? claim.failure_class : null,
      provider_request_count: 0,
      formal_evidence_fact_count: factCount,
      fail_closed_before_provider: true,
    };
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION !== "1") {
    throw new Error("SET_MCFT_CAP09_V13_PRODUCER_DRIVEN_LIVE_QUALIFICATION_1");
  }
  const subject = required("MCFT_SUBJECT_SHA");
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("V13_LIVE_QUALIFICATION_SUBJECT_INVALID");
  const url = required("DATABASE_URL");
  const blockedUrl = required("BLOCKED_DATABASE_URL");
  assert.equal(dbName(url), EXPECTED_V13_DB, "V13_LIVE_QUALIFICATION_DATABASE_MISMATCH");
  assert.equal(dbName(blockedUrl), EXPECTED_BLOCKED_DB, "V13_BLOCKED_QUALIFICATION_DATABASE_MISMATCH");

  const bucket = required("MCFT_CAP09_FORMAL_RAW_BUCKET");
  assert.equal(bucket, EXPECTED_BUCKET, "V13_LIVE_QUALIFICATION_FORMAL_RAW_BUCKET_MISMATCH");
  const privateStore = {
    endpoint: required("MCFT_CAP09_FORMAL_RAW_ENDPOINT"),
    bucket,
    region: required("MCFT_CAP09_FORMAL_RAW_REGION"),
    access_key_id: required("MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID"),
    secret_access_key: required("MCFT_CAP09_FORMAL_RAW_SECRET_ACCESS_KEY"),
  };

  const pool = new Pool({ connectionString: url, max: 4 });
  const epoch = "epoch_mcft_cap09_v13_producer_qual_" + subject.slice(0, 12);
  const firstBase = canonicalHour(Date.now() + 18 * 3_600_000);
  const bases = [firstBase, addHours(firstBase, 1), addHours(firstBase, 2)];
  const lastBase = bases[2]!;
  const controllerOwner = "mcft-cap09-v13-qualification-controller:" + subject.slice(0, 12);
  const producerOwner = "mcft-cap09-v13-qualification-producer:" + subject.slice(0, 12);
  const samples: Array<Record<string, unknown>> = [];

  try {
    assert.equal(await currentRole(pool), EVIDENCE_ROLE, "V13_LIVE_QUALIFICATION_EVIDENCE_ROLE_REQUIRED");
    assert.equal(await publicTableCount(pool), 29, "V13_LIVE_QUALIFICATION_29_TABLES_REQUIRED");
    assert.equal(await functionExists(pool), true, "V13_LIVE_QUALIFICATION_FENCED_WRITER_REQUIRED");

    const insertPrivilege = (await pool.query<{ allowed: boolean }>(
      "SELECT has_table_privilege(current_user,'public.facts','INSERT') AS allowed",
    )).rows[0]?.allowed;
    assert.equal(insertPrivilege, false, "V13_LIVE_QUALIFICATION_DIRECT_FACT_INSERT_FORBIDDEN");
    const executePrivilege = (await pool.query<{ allowed: boolean }>(
      "SELECT has_function_privilege(current_user,'public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb)','EXECUTE') AS allowed",
    )).rows[0]?.allowed;
    assert.equal(executePrivilege, true, "V13_LIVE_QUALIFICATION_FENCED_WRITER_EXECUTE_REQUIRED");

    const lifecycle = new PostgresExternalFormalForcingControllerLifecycleV1(pool, {
      scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
      epoch_id: epoch,
      subject_sha: subject,
    });
    const continuity = new PostgresExternalFormalForcingBaseContinuityRepositoryV1(pool, {
      scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
      epoch_id: epoch,
      subject_sha: subject,
      first_required_base: firstBase,
      last_required_base: lastBase,
    });
    const producerCore = composeMcftCap09V13ForcingProducerCoreV1({
      pool,
      scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
      epoch_id: epoch,
      subject_sha: subject,
      private_store: privateStore,
    });

    assert.equal(producerCore.producer_core_id, MCFT_CAP09_V13_FORCING_PRODUCER_CORE_ID_V1);
    await continuity.initializeCursor();
    const controller = await lifecycle.acquireOrRenew({
      lease_owner: controllerOwner,
      lease_duration_seconds: 1800,
    });
    if (!["ACQUIRED", "RENEWED", "TAKEN_OVER"].includes(controller.status)) {
      throw new Error("V13_LIVE_QUALIFICATION_CONTROLLER_NOT_ACQUIRED:" + controller.status);
    }
    let controllerLease = controller.lease;

    for (const expectedBase of bases) {
      const sampleStart = Date.now();
      const claimResult = await continuity.claimNextMissingBase({
        lease_owner: producerOwner,
        lease_duration_seconds: 1800,
      });
      if (claimResult.status !== "CLAIMED" && claimResult.status !== "EXISTING_ACTIVE_CLAIM") {
        throw new Error("V13_LIVE_QUALIFICATION_CLAIM_NOT_ACQUIRED:" + claimResult.status);
      }
      let claim = claimResult.claim;
      assert.equal(claim.base_target_t, expectedBase, "V13_LIVE_QUALIFICATION_NEXT_MISSING_BASE_MISMATCH");
      await continuity.advanceClaimPhaseUnderController({
        controller_lease: controllerLease,
        claim,
        phase: "ACQUIRING",
      });

      const captureStart = Date.now();
      const capture = await producerCore.capture_promotion.captureExactBase({
        base_target_t: expectedBase,
        subject_sha: subject,
        idempotency_key: claim.idempotency_key,
      });
      const captureMs = elapsed(captureStart);

      const renewed = await lifecycle.acquireOrRenew({
        lease_owner: controllerOwner,
        lease_duration_seconds: 1800,
      });
      if (!["RENEWED", "ACQUIRED", "TAKEN_OVER"].includes(renewed.status)) {
        throw new Error("V13_LIVE_QUALIFICATION_CONTROLLER_HEARTBEAT_FAILED:" + renewed.status);
      }
      controllerLease = renewed.lease;
      claim = await continuity.heartbeatClaimUnderController({
        controller_lease: controllerLease,
        claim,
        lease_duration_seconds: 1800,
      });

      await continuity.advanceClaimPhaseUnderController({
        controller_lease: controllerLease,
        claim,
        phase: "READY_TO_FINALIZE",
      });
      await continuity.advanceClaimPhaseUnderController({
        controller_lease: controllerLease,
        claim,
        phase: "PROMOTING",
      });

      const promotionStart = Date.now();
      const promoted = await producerCore.capture_promotion.promoteExactBase({
        base_target_t: expectedBase,
        subject_sha: subject,
        idempotency_key: claim.idempotency_key,
        capture,
        controller_lease: controllerLease,
        producer_claim: claim,
      });
      const promotionMs = elapsed(promotionStart);
      assert.equal(promoted.database_fence_commit_succeeded, true);
      assert.equal(promoted.formal_fact_present_count, 3);
      assert.equal(promoted.facts.length, 3);
      assert.equal(promoted.formal_database_write_count + promoted.idempotent_existing_fact_count, 3);

      const attestationStart = Date.now();
      const attested = await continuity.attestFormalPhysicalVisibilityUnderController({
        controller_lease: controllerLease,
        claim,
        facts: promoted.facts,
        producer_run_id: capture.producer_run_id,
        promotion_run_id: promoted.promotion_run_id,
        candidate_artifact_digest: capture.candidate_artifact_digest,
      });
      const attestationMs = elapsed(attestationStart);
      assert.equal(attested.status, "PASS");
      assert.equal(attested.base_target_t, expectedBase);
      assert.equal(attested.physical_visibility_before_base, true);
      assert.equal(attested.cursor_advanced, true);

      samples.push({
        base_target_t: expectedBase,
        capture_ms: captureMs,
        promotion_ms: promotionMs,
        post_commit_attestation_ms: attestationMs,
        producer_graph_end_to_end_ms: elapsed(sampleStart),
        formal_fact_present_count: promoted.formal_fact_present_count,
        formal_database_write_count: promoted.formal_database_write_count,
        idempotent_existing_fact_count: promoted.idempotent_existing_fact_count,
        candidate_artifact_digest: capture.candidate_artifact_digest,
        provider_refetch_during_promotion: 0,
        cursor_advanced: attested.cursor_advanced,
        next_missing_required_base: attested.next_missing_required_base,
      });
    }

    const finalCursor = await continuity.readCursor();
    assert.equal(finalCursor.completed, true, "V13_LIVE_QUALIFICATION_CURSOR_MUST_COMPLETE");
    assert.equal(finalCursor.next_missing_required_base, null, "V13_LIVE_QUALIFICATION_NEXT_MISSING_MUST_BE_NULL");
    const targetRows = (await pool.query<{ state: string; n: number }>(
      `SELECT state,count(*)::int AS n
         FROM public.twin_external_formal_forcing_base_target_v1
        WHERE epoch_id=$1
        GROUP BY state ORDER BY state`,
      [epoch],
    )).rows;
    assert.deepEqual(targetRows, [{ state: "FORMAL_VISIBLE_ATTESTED", n: 3 }]);

    const blocked = await runBlockedNegative({ url: blockedUrl, subject });
    const proof = {
      schema_version: "geox_mcft_cap09_v13_producer_driven_live_qualification_v1",
      status: "PASS",
      activation_step: "RUN_PRODUCER_DRIVEN_V13_QUALIFICATION",
      subject_sha: subject,
      scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
      qualification_database: EXPECTED_V13_DB,
      blocked_database: EXPECTED_BLOCKED_DB,
      epoch_id: epoch,
      first_required_base: firstBase,
      last_required_base: lastBase,
      processed_base_count: samples.length,
      exact_sequential_bases: bases,
      producer_core_id: MCFT_CAP09_V13_FORCING_PRODUCER_CORE_ID_V1,
      production_canonical_core_identical: true,
      qualification_clock_mode: "ACCELERATED_ENGINEERING_ONLY",
      qualification_clock_substitutes_wait_only: true,
      qualification_only_prebudget_admission_boundary: true,
      production_admission_exercised: false,
      provider_supply_graph_exercised: true,
      private_raw_retention_exercised: true,
      private_candidate_manifest_exercised: true,
      candidate_rehydration_exercised: true,
      fenced_evidence_writer_exercised: true,
      post_commit_physical_readback_exercised: true,
      controller_fencing_exercised: true,
      producer_fencing_exercised: true,
      direct_facts_insert_privilege: false,
      preinsert_all_24_hourly_forcing_pairs: false,
      real_producer_graph_timing_observation_count: samples.length,
      producer_graph_timing_observations: samples,
      timing_budget_qualified: false,
      timing_budget_frozen: false,
      controlled_delay_matrix_executed: false,
      blocked_negative: blocked,
      formal_v5_mutation_count: 0,
      production_owner_activation: false,
      formal_v5_arm: false,
      a0_bootstrap: false,
      o00_started: false,
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
  fs.writeFileSync(OUT, JSON.stringify({
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    timing_budget_qualified: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
    mcft_cap09_completed: false,
  }, null, 2) + "\n");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
