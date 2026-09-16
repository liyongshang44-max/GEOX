import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  type RawEvidenceRetentionInputV1,
  type RawEvidenceRetentionReceiptV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_external_collector_canonicalizer_v1.js";
import {
  ExternalFormalPrivateCandidateCapturePromotionV1,
  ProductionExternalFormalCandidateRehydrationDecoderFactoryV1,
} from "../../apps/server/src/external_evidence/mcft_cap09_phase7_private_candidate_capture_promotion_v1.js";
import { ProductionEvidenceWorkItemFactoryV1 } from "../../apps/server/src/external_evidence/mcft_cap09_production_evidence_work_items_v1.js";
import {
  S3CompatiblePrivateRawEvidenceRetentionAdapterV1,
} from "../../apps/server/src/external_evidence/s3_compatible_raw_evidence_retention_adapter_v1.js";
import {
  S3CompatiblePrivateCandidateManifestStoreV1,
  type ExternalFormalExactBaseCandidateManifestV1,
  type PrivateCandidateManifestWriteReceiptV1,
} from "../../apps/server/src/external_evidence/s3_compatible_private_candidate_manifest_store_v1.js";
import {
  S3CompatiblePrivateRetainedRawReaderV1,
} from "../../apps/server/src/external_evidence/s3_compatible_private_retained_raw_reader_v1.js";
import {
  PostgresEvidenceRuntimeFencedExactBaseFactPromotionV1,
} from "../../apps/server/src/persistence/external_evidence/postgres_evidence_runtime_fenced_exact_base_fact_promotion_v1.js";
import {
  PostgresExternalFormalForcingBaseContinuityRepositoryV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_base_continuity_repository_v1.js";
import {
  PostgresExternalFormalForcingControllerLifecycleV1,
} from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_forcing_controller_lifecycle_v1.js";

const EXPECTED_V13_DB = "geox_mcft_cap09_s6_accel24t_am19_v13";
const EXPECTED_BUCKET = "geox-mcft-cap09-formal-raw-v1";
const EVIDENCE_ROLE = "geox_mcft_cap09_evidence_runtime_v1";

function required(name: string): string {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error("V13_TIMING_SAMPLE_ENV_REQUIRED:" + name);
  return value;
}
function nonnegativeInteger(name: string): number {
  const value = Number(required(name));
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("V13_TIMING_SAMPLE_NONNEGATIVE_INTEGER_REQUIRED:" + name);
  return value;
}
function dbName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ""));
}
function canonicalHour(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value || !value.endsWith(":00:00.000Z")) {
    throw new Error("V13_TIMING_SAMPLE_CANONICAL_HOUR_REQUIRED");
  }
  return value;
}
function elapsed(start: number): number {
  return Math.max(0, Date.now() - start);
}
async function currentRole(pool: Pool): Promise<string> {
  return String((await pool.query<{ current_user: string }>("SELECT current_user::text AS current_user")).rows[0]?.current_user ?? "");
}
async function publicTableCount(pool: Pool): Promise<number> {
  return Number((await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM pg_catalog.pg_class relation
       JOIN pg_catalog.pg_namespace namespace ON namespace.oid=relation.relnamespace
      WHERE namespace.nspname='public' AND relation.relkind IN ('r','p')`,
  )).rows[0]?.n ?? -1);
}
async function functionExists(pool: Pool): Promise<boolean> {
  const row = (await pool.query<{ present: boolean }>(
    "SELECT to_regprocedure('public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb)') IS NOT NULL AS present",
  )).rows[0];
  return row?.present === true;
}

async function main(): Promise<void> {
  if (process.env.MCFT_CAP09_V13_EXACT_HEAD_TIMING_SAMPLE !== "1") {
    throw new Error("SET_MCFT_CAP09_V13_EXACT_HEAD_TIMING_SAMPLE_1");
  }
  const subject = required("MCFT_SUBJECT_SHA");
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("V13_TIMING_SAMPLE_SUBJECT_INVALID");
  const sampleId = required("MCFT_TIMING_SAMPLE_ID");
  if (!/^sample[123]$/.test(sampleId)) throw new Error("V13_TIMING_SAMPLE_ID_INVALID");
  const runId = required("MCFT_TIMING_RUN_ID");
  const runAttempt = required("MCFT_TIMING_RUN_ATTEMPT");
  if (!/^\d+$/.test(runId) || !/^\d+$/.test(runAttempt)) throw new Error("V13_TIMING_SAMPLE_RUN_ID_INVALID");
  const base = canonicalHour(required("MCFT_TIMING_BASE_TARGET"));
  if (Date.parse(base) <= Date.now()) throw new Error("V13_TIMING_SAMPLE_BASE_MUST_BE_FUTURE");

  const wakeDelayMs = nonnegativeInteger("MCFT_TIMING_WAKE_DELAY_MS");
  const jobStartSetupMs = nonnegativeInteger("MCFT_TIMING_JOB_START_SETUP_MS");
  const url = required("DATABASE_URL");
  assert.equal(dbName(url), EXPECTED_V13_DB, "V13_TIMING_SAMPLE_DATABASE_MISMATCH");

  const bucket = required("MCFT_CAP09_FORMAL_RAW_BUCKET");
  assert.equal(bucket, EXPECTED_BUCKET, "V13_TIMING_SAMPLE_FORMAL_RAW_BUCKET_MISMATCH");
  const privateStore = {
    endpoint: required("MCFT_CAP09_FORMAL_RAW_ENDPOINT"),
    bucket,
    region: required("MCFT_CAP09_FORMAL_RAW_REGION"),
    access_key_id: required("MCFT_CAP09_FORMAL_RAW_ACCESS_KEY_ID"),
    secret_access_key: required("MCFT_CAP09_FORMAL_RAW_SECRET_ACCESS_KEY"),
  };

  const pool = new Pool({ connectionString: url, max: 4 });
  const epoch = `epoch_mcft_cap09_v13_timing_${subject.slice(0,8)}_${runId}_${runAttempt}_${sampleId}`;
  const controllerOwner = `mcft-cap09-v13-timing-controller:${runId}:${sampleId}`;
  const producerOwner = `mcft-cap09-v13-timing-producer:${runId}:${sampleId}`;

  let rawRetentionMs = 0;
  let rawRetentionCallCount = 0;
  let candidateWriteMs = 0;
  let candidateWriteCount = 0;

  try {
    assert.equal(await currentRole(pool), EVIDENCE_ROLE, "V13_TIMING_SAMPLE_EVIDENCE_ROLE_REQUIRED");
    assert.equal(await publicTableCount(pool), 29, "V13_TIMING_SAMPLE_29_TABLES_REQUIRED");
    assert.equal(await functionExists(pool), true, "V13_TIMING_SAMPLE_FENCED_WRITER_REQUIRED");

    const insertPrivilege = (await pool.query<{ allowed: boolean }>(
      "SELECT has_table_privilege(current_user,'public.facts','INSERT') AS allowed",
    )).rows[0]?.allowed;
    assert.equal(insertPrivilege, false, "V13_TIMING_SAMPLE_DIRECT_FACT_INSERT_FORBIDDEN");
    const executePrivilege = (await pool.query<{ allowed: boolean }>(
      "SELECT has_function_privilege(current_user,'public.mcft_cap09_v13_evidence_runtime_append_exact_base_facts_v1(text,text,text,text,text,text,text,text,timestamptz,text,bigint,text,bigint,text,jsonb)','EXECUTE') AS allowed",
    )).rows[0]?.allowed;
    assert.equal(executePrivilege, true, "V13_TIMING_SAMPLE_FENCED_WRITER_EXECUTE_REQUIRED");

    const retentionDelegate = new S3CompatiblePrivateRawEvidenceRetentionAdapterV1(privateStore);
    const timedRetention = {
      retainRawEvidence: async (input: RawEvidenceRetentionInputV1): Promise<RawEvidenceRetentionReceiptV1> => {
        const started = Date.now();
        try {
          return await retentionDelegate.retainRawEvidence(input);
        } finally {
          rawRetentionMs += elapsed(started);
          rawRetentionCallCount += 1;
        }
      },
    };

    const candidateDelegate = new S3CompatiblePrivateCandidateManifestStoreV1(privateStore);
    const timedCandidateStore = {
      writeCandidateManifest: async (
        manifest: ExternalFormalExactBaseCandidateManifestV1,
      ): Promise<PrivateCandidateManifestWriteReceiptV1> => {
        const started = Date.now();
        try {
          return await candidateDelegate.writeCandidateManifest(manifest);
        } finally {
          candidateWriteMs += elapsed(started);
          candidateWriteCount += 1;
        }
      },
      readCandidateManifest: candidateDelegate.readCandidateManifest.bind(candidateDelegate),
    };

    const rawReader = new S3CompatiblePrivateRetainedRawReaderV1(privateStore);
    const workItemFactory = new ProductionEvidenceWorkItemFactoryV1({
      retention: timedRetention,
    });
    const fencedPromotion = new PostgresEvidenceRuntimeFencedExactBaseFactPromotionV1(
      pool,
      retentionDelegate,
      { scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1, epoch_id: epoch, subject_sha: subject },
    );
    const capturePromotion = new ExternalFormalPrivateCandidateCapturePromotionV1({
      subject_sha: subject,
      work_item_factory: workItemFactory,
      retention: timedRetention,
      candidate_store: timedCandidateStore,
      raw_reader: rawReader,
      fenced_promotion: fencedPromotion,
      rehydration_decoder_factory: new ProductionExternalFormalCandidateRehydrationDecoderFactoryV1(),
    });
    const lifecycle = new PostgresExternalFormalForcingControllerLifecycleV1(pool, {
      scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
      epoch_id: epoch,
      subject_sha: subject,
    });
    const continuity = new PostgresExternalFormalForcingBaseContinuityRepositoryV1(pool, {
      scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
      epoch_id: epoch,
      subject_sha: subject,
      first_required_base: base,
      last_required_base: base,
    });

    const providerPhaseStart = Date.now();
    await continuity.initializeCursor();
    const controller = await lifecycle.acquireOrRenew({
      lease_owner: controllerOwner,
      lease_duration_seconds: 1800,
    });
    if (controller.status === "BUSY" || controller.status === "TERMINAL") {
      throw new Error("V13_TIMING_SAMPLE_CONTROLLER_NOT_ACQUIRED:" + controller.status);
    }
    let controllerLease = controller.lease;
    const claimResult = await continuity.claimNextMissingBase({
      lease_owner: producerOwner,
      lease_duration_seconds: 1800,
    });
    if (claimResult.status !== "CLAIMED" && claimResult.status !== "EXISTING_ACTIVE_CLAIM") {
      throw new Error("V13_TIMING_SAMPLE_CLAIM_NOT_ACQUIRED:" + claimResult.status);
    }
    let claim = claimResult.claim;
    assert.equal(claim.base_target_t, base, "V13_TIMING_SAMPLE_BASE_CLAIM_MISMATCH");
    await continuity.advanceClaimPhaseUnderController({
      controller_lease: controllerLease,
      claim,
      phase: "ACQUIRING",
    });

    const capture = await capturePromotion.captureExactBase({
      base_target_t: base,
      subject_sha: subject,
      idempotency_key: claim.idempotency_key,
    });
    const providerAndCaptureTotalMs = elapsed(providerPhaseStart);
    const retainedRawAndCandidateMs = rawRetentionMs + candidateWriteMs;
    const providerCaptureMs = providerAndCaptureTotalMs - retainedRawAndCandidateMs;
    if (!Number.isSafeInteger(providerCaptureMs) || providerCaptureMs < 0) {
      throw new Error("V13_TIMING_SAMPLE_PROVIDER_CAPTURE_SPLIT_INVALID");
    }

    const promotionQueueStart = Date.now();
    const renewed = await lifecycle.acquireOrRenew({
      lease_owner: controllerOwner,
      lease_duration_seconds: 1800,
    });
    if (renewed.status === "BUSY" || renewed.status === "TERMINAL") {
      throw new Error("V13_TIMING_SAMPLE_CONTROLLER_HEARTBEAT_FAILED:" + renewed.status);
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
    const promotionQueueAndSetupMs = elapsed(promotionQueueStart);

    const promotionStart = Date.now();
    const promoted = await capturePromotion.promoteExactBase({
      base_target_t: base,
      subject_sha: subject,
      idempotency_key: claim.idempotency_key,
      capture,
      controller_lease: controllerLease,
      producer_claim: claim,
    });
    assert.equal(promoted.database_fence_commit_succeeded, true);
    assert.equal(promoted.formal_fact_present_count, 3);
    assert.equal(promoted.facts.length, 3);

    const attested = await continuity.attestFormalPhysicalVisibilityUnderController({
      controller_lease: controllerLease,
      claim,
      facts: promoted.facts,
      producer_run_id: capture.producer_run_id,
      promotion_run_id: promoted.promotion_run_id,
      candidate_artifact_digest: capture.candidate_artifact_digest,
    });
    const rehydrationPromotionCommitReadbackMs = elapsed(promotionStart);
    assert.equal(attested.status, "PASS");
    assert.equal(attested.base_target_t, base);
    assert.equal(attested.physical_visibility_before_base, true);
    assert.equal(attested.cursor_advanced, true);
    assert.equal(attested.next_missing_required_base, null);

    const phases = {
      wake_delay_ms: wakeDelayMs,
      job_start_setup_ms: jobStartSetupMs,
      provider_capture_ms: providerCaptureMs,
      retained_raw_and_candidate_ms: retainedRawAndCandidateMs,
      promotion_queue_and_setup_ms: promotionQueueAndSetupMs,
      rehydration_promotion_commit_readback_ms: rehydrationPromotionCommitReadbackMs,
    };
    const totalMs = Object.values(phases).reduce((sum, value) => sum + value, 0);

    const proof = {
      schema_version: "geox_mcft_cap09_v13_exact_head_timing_sample_v1",
      status: "PASS",
      measurement_only: true,
      timing_budget_qualified: false,
      timing_budget_frozen: false,
      sample_id: sampleId,
      subject_sha: subject,
      workflow_run_id: runId,
      workflow_run_attempt: runAttempt,
      epoch_id: epoch,
      base_target_t: base,
      qualification_database: EXPECTED_V13_DB,
      timing_phases: phases,
      measured_end_to_end_ms: totalMs,
      measurement_formula: {
        provider_capture_ms: "CONTROLLER_CURSOR_CLAIM_PLUS_PROVIDER_ACQUISITION_DECODE_CANONICALIZE_MINUS_MEASURED_RAW_AND_CANDIDATE_PERSISTENCE",
        retained_raw_and_candidate_ms: "SUM_RAW_RETENTION_CALL_ELAPSED_PLUS_CANDIDATE_MANIFEST_WRITE_ELAPSED",
        promotion_queue_and_setup_ms: "POST_CAPTURE_CONTROLLER_RENEW_HEARTBEAT_AND_PHASE_TRANSITIONS",
        rehydration_promotion_commit_readback_ms: "CANDIDATE_REHYDRATION_PLUS_FENCED_NEON_COMMIT_PLUS_POST_COMMIT_PHYSICAL_ATTESTATION",
      },
      raw_retention_call_count: rawRetentionCallCount,
      raw_retention_elapsed_ms: rawRetentionMs,
      candidate_manifest_write_count: candidateWriteCount,
      candidate_manifest_write_elapsed_ms: candidateWriteMs,
      formal_fact_present_count: promoted.formal_fact_present_count,
      formal_database_write_count: promoted.formal_database_write_count,
      idempotent_existing_fact_count: promoted.idempotent_existing_fact_count,
      candidate_artifact_digest: capture.candidate_artifact_digest,
      provider_refetch_during_promotion: 0,
      cursor_advanced: attested.cursor_advanced,
      production_canonical_modules_reused: true,
      direct_facts_insert_privilege: false,
      production_owner_activation: false,
      formal_v5_arm: false,
      a0_bootstrap: false,
      o00_started: false,
      mcft_cap09_completed: false,
    };
    const out = path.resolve(`acceptance-output/MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_${sampleId.toUpperCase()}_V1_RESULT.json`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(proof, null, 2) + "\n");
    console.log(JSON.stringify(proof, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const sampleId = String(process.env.MCFT_TIMING_SAMPLE_ID ?? "unknown").replace(/[^A-Za-z0-9_-]/g, "_");
  const out = path.resolve(`acceptance-output/MCFT_CAP_09_V13_EXACT_HEAD_TIMING_SAMPLE_${sampleId.toUpperCase()}_V1_RESULT.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    timing_budget_qualified: false,
    timing_budget_frozen: false,
    production_owner_activation: false,
    formal_v5_arm: false,
    a0_bootstrap: false,
    o00_started: false,
    mcft_cap09_completed: false,
  }, null, 2) + "\n");
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
