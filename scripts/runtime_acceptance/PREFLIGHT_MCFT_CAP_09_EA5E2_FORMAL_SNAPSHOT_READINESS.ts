// Read-only pre-dispatch proof for the exact Formal Neon branch, A0 snapshot,
// pointer graph and crop/season authority bundle consumed by EA5E2.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_bootstrap_authority_bundle_v1.js";
import {
  MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import {
  MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_HASH_V1,
  MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_REF_V1,
} from "../../apps/server/src/domain/twin_runtime/external_formal_window_epoch_rebase_bundle_v1.js";
import { PostgresNextTickRepositoryV1 } from "../../apps/server/src/persistence/twin_runtime/postgres_next_tick_repository_v1.js";

const OUTPUT = path.resolve("acceptance-output/MCFT_CAP_09_EA5E2_FORMAL_SNAPSHOT_READINESS.json");
const CROP_PATH = MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1.crop_context.ref;
const EXPECTED_PROJECT = "delicate-glade-62464340";
const EXPECTED_BRANCH = "br-cold-dust-a6j6aymz";
const FORBIDDEN_SIMULATION_BRANCH = "br-falling-cake-a6lfsdak";
const EXPECTED_DATABASE = "geox_mcft_cap09_s6_formal_t3r1_24h";
const EXPECTED_A0_REF = MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_REF_V1;
const EXPECTED_A0_HASH = MCFT_CAP09_EXISTING_EXTERNAL_A0_RUNTIME_CONFIG_HASH_V1;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`EA5E2_FORMAL_READINESS_ENV_REQUIRED:${name}`);
  return value;
}

function write(value: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(value, null, 2)}\n`);
  console.log(JSON.stringify(value));
}

function exactScope(value: Record<string, unknown>, code: string): void {
  for (const [key, expected] of Object.entries(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1)) {
    if (value[key] !== expected) throw new Error(`${code}:${key}`);
  }
}

function safeErrorCode(error: unknown): string {
  if (error instanceof Error && /^EA5E2_[A-Z0-9_:.-]+$/.test(error.message)) return error.message.slice(0, 240);
  const pgCode = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  return `EA5E2_FORMAL_READINESS_QUERY_FAILED${pgCode ? `:${pgCode}` : ""}`;
}

async function main(): Promise<void> {
  const subject = requiredEnv("MCFT_EA5E2_SUBJECT_SHA");
  if (!/^[0-9a-f]{40}$/.test(subject)) throw new Error("EA5E2_FORMAL_READINESS_EXACT_SUBJECT_SHA_REQUIRED");
  if (execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() !== subject) {
    throw new Error("EA5E2_FORMAL_READINESS_EXACT_HEAD_MISMATCH");
  }
  const crop = JSON.parse(fs.readFileSync(CROP_PATH, "utf8")) as Record<string, unknown>;
  const cropScope = crop.scope as Record<string, unknown>;
  if (!cropScope || cropScope.field_id !== MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.field_id
    || cropScope.season_id !== MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1.season_id) {
    throw new Error("EA5E2_FORMAL_READINESS_CROP_SCOPE_MISMATCH");
  }
  const cropBlob = execFileSync("git", ["rev-parse", `HEAD:${CROP_PATH}`], { encoding: "utf8" }).trim();
  if (cropBlob !== MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1.crop_context.hash) {
    throw new Error("EA5E2_FORMAL_READINESS_CROP_AUTHORITY_BLOB_DRIFT");
  }

  const pool = new Pool({
    connectionString: requiredEnv("FORMAL_DATABASE_URL"),
    application_name: `mcft-cap09-ea5e2-formal-readiness-${subject.slice(0, 12)}`,
    max: 2,
  });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN TRANSACTION READ ONLY");
    const identity = (await client.query(`
      SELECT current_database() AS database_name,
             current_setting('neon.project_id', true) AS neon_project_id,
             current_setting('neon.branch_id', true) AS neon_branch_id,
             current_setting('transaction_read_only') AS transaction_read_only
    `)).rows[0];
    if (!identity || identity.database_name !== EXPECTED_DATABASE
      || identity.neon_project_id !== EXPECTED_PROJECT
      || identity.neon_branch_id !== EXPECTED_BRANCH
      || identity.neon_branch_id === FORBIDDEN_SIMULATION_BRANCH
      || identity.transaction_read_only !== "on") {
      throw new Error("EA5E2_FORMAL_READINESS_PRIMARY_NEON_IDENTITY_REQUIRED");
    }
    const scheduler = (await client.query(
      `SELECT
        (SELECT count(*)::int FROM twin_shadow_online_scheduler_slot_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS slots,
        (SELECT count(*)::int FROM twin_shadow_online_scheduler_cursor_v1
          WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND season_id=$5 AND zone_id=$6) AS cursors`,
      Object.values(MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1),
    )).rows[0];
    if (Number(scheduler?.slots) !== 0 || Number(scheduler?.cursors) !== 0) {
      throw new Error("EA5E2_FORMAL_READINESS_SCHEDULER_MUST_REMAIN_UNSTARTED");
    }
    await client.query("COMMIT");
    client.release();
    client = undefined;

    const snapshot = await new PostgresNextTickRepositoryV1(pool).readPersistedNextTickSnapshot({
      ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
    });
    if (!snapshot) throw new Error("EA5E2_FORMAL_READINESS_A0_SNAPSHOT_REQUIRED");
    if (snapshot.runtime_config.object_id !== EXPECTED_A0_REF
      || snapshot.runtime_config.determinism_hash !== EXPECTED_A0_HASH) {
      throw new Error("EA5E2_FORMAL_READINESS_EXACT_A0_REQUIRED");
    }
    exactScope(snapshot.runtime_config as unknown as Record<string, unknown>, "EA5E2_FORMAL_READINESS_RUNTIME_CONFIG_SCOPE_DRIFT");
    const payload = snapshot.runtime_config.payload as Record<string, any>;
    if (payload.config_role !== "A0_BOOTSTRAP" || payload.parent_runtime_config_ref !== null || payload.parent_runtime_config_hash !== null) {
      throw new Error("EA5E2_FORMAL_READINESS_A0_ROLE_OR_PARENT_DRIFT");
    }
    if (payload.formal_authorities?.crop_context?.ref !== MCFT_CAP09_EXTERNAL_FORMAL_AUTHORITY_BLOBS_V1.crop_context.ref
      || payload.formal_authorities?.crop_context?.hash !== cropBlob) {
      throw new Error("EA5E2_FORMAL_READINESS_CROP_A0_AUTHORITY_MISMATCH");
    }
    if (snapshot.previous_posterior.runtime_config_ref !== EXPECTED_A0_REF
      || snapshot.checkpoint.runtime_config_ref !== EXPECTED_A0_REF
      || snapshot.previous_forecast_result?.payload?.status !== "BLOCKED") {
      throw new Error("EA5E2_FORMAL_READINESS_A0_POINTER_GRAPH_MISMATCH");
    }
    for (const item of [snapshot.previous_posterior, snapshot.checkpoint, snapshot.previous_forecast_result, snapshot.last_terminal_tick]) {
      if (!item) throw new Error("EA5E2_FORMAL_READINESS_POINTER_MEMBER_REQUIRED");
      exactScope(item as unknown as Record<string, unknown>, "EA5E2_FORMAL_READINESS_POINTER_SCOPE_DRIFT");
    }

    write({
      schema_version: "geox_mcft_cap09_ea5e2_formal_snapshot_readiness_v1",
      status: "PASS",
      subject_sha: subject,
      database_name: EXPECTED_DATABASE,
      neon_project_id: EXPECTED_PROJECT,
      neon_branch_id: EXPECTED_BRANCH,
      simulation_branch_reused: false,
      formal_scope: MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1,
      crop_authority_path: CROP_PATH,
      crop_authority_blob_sha: cropBlob,
      formal_a0_runtime_config_ref: EXPECTED_A0_REF,
      formal_a0_runtime_config_hash: EXPECTED_A0_HASH,
      crop_a0_formal_scope_consistent: true,
      pointer_graph_validated: true,
      scheduler_slot_count: 0,
      scheduler_cursor_count: 0,
      transaction_mode: "READ_ONLY",
      database_write_count: 0,
      provider_request_count: 0,
      formal_window_started: false,
    });
  } catch (error) {
    try { if (client) await client.query("ROLLBACK"); } catch {}
    write({
      schema_version: "geox_mcft_cap09_ea5e2_formal_snapshot_readiness_v1",
      status: "FAIL",
      subject_sha: process.env.MCFT_EA5E2_SUBJECT_SHA ?? null,
      error_code: safeErrorCode(error),
      transaction_mode: "READ_ONLY",
      database_write_count: 0,
      provider_request_count: 0,
      formal_window_started: false,
    });
    throw error;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

void main().catch(() => { process.exitCode = 1; });
