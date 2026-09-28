#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const OUT = path.resolve(
  "acceptance-output/MCFT_CAP_09_FAILURE_DISCOVERY_ACCELERATED_RESTART_BACKFILL_V1_RESULT.json",
);
const PHASE4 = path.resolve(
  "acceptance-output/MCFT_CAP_09_PHASE4_TWIN_RUNTIME_POSTGRES_V1_RESULT.json",
);
const S4 = path.resolve(
  "acceptance-output/MCFT_CAP_09_S4_POSTGRESQL_ACCEPTANCE_RESULT.json",
);

function readJson(file, code) {
  if (!fs.existsSync(file)) throw new Error(`${code}_MISSING:${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function requireTrue(value, code) {
  if (value !== true) throw new Error(code);
}

function requireEqual(actual, expected, code) {
  if (actual !== expected) {
    throw new Error(`${code}:${JSON.stringify({ actual, expected })}`);
  }
}

function main() {
  const phase4 = readJson(PHASE4, "RESTART_BACKFILL_PHASE4_PROOF");
  const s4 = readJson(S4, "RESTART_BACKFILL_S4_PROOF");

  requireEqual(phase4.status, "PASS", "RESTART_BACKFILL_PHASE4_NOT_PASS");
  requireTrue(phase4.real_postgres, "RESTART_BACKFILL_REAL_POSTGRES_REQUIRED");
  requireTrue(
    phase4.runtime_tick_cursor_durable,
    "RESTART_BACKFILL_DURABLE_RUNTIME_CURSOR_REQUIRED",
  );
  requireTrue(phase4.oldest_due_first, "RESTART_BACKFILL_OLDEST_DUE_FIRST_REQUIRED");
  requireTrue(
    phase4.expired_active_slot_recovered,
    "RESTART_BACKFILL_EXPIRED_ACTIVE_SLOT_RECOVERY_REQUIRED",
  );
  requireTrue(
    phase4.recovery_preserved_idempotency_key,
    "RESTART_BACKFILL_IDEMPOTENCY_PRESERVATION_REQUIRED",
  );
  requireTrue(
    phase4.recovery_advanced_fence,
    "RESTART_BACKFILL_FENCE_ADVANCE_REQUIRED",
  );
  requireTrue(phase4.stale_fence_rejected, "RESTART_BACKFILL_STALE_FENCE_REJECTION_REQUIRED");
  requireTrue(
    phase4.process_restart_cursor_readback,
    "RESTART_BACKFILL_PROCESS_RESTART_CURSOR_READBACK_REQUIRED",
  );
  requireEqual(
    phase4.maximum_active_slot_count,
    0,
    "RESTART_BACKFILL_ACTIVE_SLOT_LEAK_FORBIDDEN",
  );
  requireEqual(
    phase4.canonical_fact_delta,
    0,
    "RESTART_BACKFILL_SCHEDULER_CANONICAL_FACT_MUTATION_FORBIDDEN",
  );

  requireEqual(s4.status, "PASS", "RESTART_BACKFILL_S4_NOT_PASS");
  requireEqual(
    s4.acceptance_mode,
    "REAL_POSTGRESQL_RESTART_BACKFILL_STALE_DETECTION",
    "RESTART_BACKFILL_S4_MODE_REQUIRED",
  );
  requireTrue(
    s4.persisted_checkpoint_read_verified,
    "RESTART_BACKFILL_PERSISTED_CHECKPOINT_REQUIRED",
  );
  requireTrue(
    s4.expired_active_slot_recovered,
    "RESTART_BACKFILL_S4_EXPIRED_SLOT_RECOVERY_REQUIRED",
  );
  requireTrue(s4.fencing_token_advanced, "RESTART_BACKFILL_S4_FENCE_ADVANCE_REQUIRED");
  requireTrue(s4.old_claim_rejected, "RESTART_BACKFILL_OLD_CLAIM_REJECTION_REQUIRED");
  requireTrue(
    s4.oldest_missed_slot_first_verified,
    "RESTART_BACKFILL_OLDEST_MISSED_SLOT_REQUIRED",
  );
  requireTrue(
    s4.restart_cursor_readback_verified,
    "RESTART_BACKFILL_RESTART_CURSOR_REQUIRED",
  );
  requireTrue(
    s4.stale_database_evidence_degraded,
    "RESTART_BACKFILL_STALE_EVIDENCE_DEGRADATION_REQUIRED",
  );
  requireEqual(s4.duplicate_slot_rows, 0, "RESTART_BACKFILL_DUPLICATE_SLOT_FORBIDDEN");
  requireEqual(s4.active_slot_count, 0, "RESTART_BACKFILL_ACTIVE_SLOT_FORBIDDEN");
  requireEqual(s4.canonical_fact_delta, 0, "RESTART_BACKFILL_CANONICAL_FACT_DELTA_FORBIDDEN");
  requireEqual(s4.canonical_write_performed, false, "RESTART_BACKFILL_CANONICAL_WRITE_FORBIDDEN");

  const subject = String(process.env.GEOX_DEPLOYMENT_SUBJECT_COMMIT || "").trim();
  if (subject && !/^[0-9a-f]{40}$/.test(subject)) {
    throw new Error("RESTART_BACKFILL_SUBJECT_SHA_INVALID");
  }

  const result = {
    schema_version: "geox_mcft_cap09_failure_discovery_accelerated_restart_backfill_v1",
    status: "PASS",
    subject_sha: subject || null,
    matrix_class: "RUNTIME_ONLY_REAL_POSTGRESQL_ACCELERATED_RESTART_BACKFILL",
    real_postgres: true,
    real_clock_24h: false,
    persisted_checkpoint_read_verified: true,
    durable_cursor_restart_readback_verified: true,
    expired_active_slot_recovered: true,
    oldest_due_first_verified: true,
    intentionally_missed_slot_oldest_first_verified: true,
    idempotency_key_preserved: true,
    fencing_token_advanced: true,
    stale_fence_rejected: true,
    old_claim_rejected: true,
    duplicate_slot_rows: 0,
    active_slot_count_after_matrix: 0,
    canonical_fact_delta: 0,
    stale_database_evidence_degraded: true,
    production_container_activation: false,
    production_database_mutation: false,
    formal_v5_armed: false,
    final_r00_r23_substituted: false,
    qualification_effect: false,
    source_proofs: [
      "MCFT_CAP_09_PHASE4_TWIN_RUNTIME_POSTGRES_V1_RESULT.json",
      "MCFT_CAP_09_S4_POSTGRESQL_ACCEPTANCE_RESULT.json",
    ],
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

try {
  main();
} catch (error) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const result = {
    schema_version: "geox_mcft_cap09_failure_discovery_accelerated_restart_backfill_v1",
    status: "FAIL",
    error: error instanceof Error ? error.message : String(error),
    qualification_effect: false,
    production_effect: false,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
}
