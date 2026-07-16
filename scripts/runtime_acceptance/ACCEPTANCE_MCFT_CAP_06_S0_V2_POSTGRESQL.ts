// scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_POSTGRESQL.ts
// Purpose: run the unmodified formal CAP-05 checkpoint-72-to-80 proof through a temporary cleanup-only copy, retain its exact isolated database and normalized Replay source long enough for read-only MCFT-CAP-06 S0 v2 qualification, then destroy all temporary resources.
// Boundary: destructive isolated acceptance only; the official CAP-05 runner is never edited, production databases are forbidden, public facts are not mutated by S0 qualification, and no CAP-06 Runtime, migration, canonical-write, Candidate, Evaluation, Model Activation, route, Web, scheduler, active-config, or CAP-07 authority is granted.

import assert from "node:assert/strict";
import cp from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OFFICIAL_RUNNER = path.join(
  ROOT,
  "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_POSTGRESQL_RUNNER.ts",
);
const TEMP_RUNNER = path.join(
  ROOT,
  "scripts/runtime_acceptance/.ACCEPTANCE_MCFT_CAP_05_POST_CLOSURE_POSTGRESQL_RUNNER_CAP06_TEMP.ts",
);
const QUALIFIER = "scripts/runtime_acceptance/ACCEPTANCE_MCFT_CAP_06_S0_V2_QUALIFY_EXISTING_DB_V2.ts";
const ISOLATED_DATABASE = "mcft_cap05_post_closure_acceptance";
const REPLAY_ROOT = path.join(os.tmpdir(), "mcft_cap05_h_authoritative_current_contract_replay_v1");
const RUNNER_INPUT = path.join(os.tmpdir(), "MCFT_CAP_05_POST_CLOSURE_RUNNER_INPUT.json");
const REPLAY_CLEANUP_HOOK = "    fs.rmSync(replayRoot, { recursive: true, force: true });";
const DATABASE_CLEANUP_HOOK = "    await dropIsolatedDatabase(baseUrl);";

let pass = 0;

function ok(message: string): void {
  // Count one independently auditable orchestration boundary.
  pass += 1;
  process.stdout.write(`PASS ${message}\n`);
}

function requiredBaseDatabaseUrl(): string {
  // The base connection must target an administrative/test PostgreSQL database, never the isolated target itself.
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  const parsed = new URL(value);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (databaseName === ISOLATED_DATABASE) throw new Error("CAP06_BASE_DATABASE_MUST_NOT_BE_ISOLATED_TARGET");
  if (!/(postgres|acceptance|test)/i.test(databaseName)) {
    throw new Error(`CAP06_ADMIN_OR_TEST_DATABASE_REQUIRED:${databaseName}`);
  }
  return value;
}

function databaseUrlFor(baseUrl: string, databaseName: string): string {
  // Preserve credentials and host while changing only the database path.
  const parsed = new URL(baseUrl);
  parsed.pathname = `/${databaseName}`;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function pnpmExecutable(): string {
  // Use the platform-specific executable without shell interpolation.
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function run(
  executable: string,
  args: string[],
  env: NodeJS.ProcessEnv = {},
): string {
  // Capture and echo complete proof output while failing closed on any child-process error.
  const result = cp.spawnSync(executable, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: "pipe",
    shell: false,
    maxBuffer: 256 * 1024 * 1024,
  });
  const stdout = String(result.stdout ?? "");
  const stderr = String(result.stderr ?? "");
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`COMMAND_FAILED:${executable} ${args.join(" ")}\n${stdout}\n${stderr}`);
  }
  return stdout;
}

function exactOccurrenceCount(source: string, needle: string): number {
  // Cleanup-only patch authority is valid only when each frozen hook appears exactly once.
  return source.split(needle).length - 1;
}

function prepareTemporaryRunner(): void {
  // Patch only the two final cleanup hooks; every CAP-05 reconstruction assertion and Runtime call remains byte-identical.
  const source = fs.readFileSync(OFFICIAL_RUNNER, "utf8");
  assert.equal(
    exactOccurrenceCount(source, REPLAY_CLEANUP_HOOK),
    1,
    "CAP06_CAP05_REPLAY_CLEANUP_HOOK_CARDINALITY",
  );
  assert.equal(
    exactOccurrenceCount(source, DATABASE_CLEANUP_HOOK),
    1,
    "CAP06_CAP05_DATABASE_CLEANUP_HOOK_CARDINALITY",
  );
  const retained = source
    .replace(
      REPLAY_CLEANUP_HOOK,
      "    // Replay root retained temporarily for read-only CAP-06 S0 source-Evidence qualification.",
    )
    .replace(
      DATABASE_CLEANUP_HOOK,
      "    // Isolated database retained temporarily for read-only CAP-06 S0 graph qualification.",
    );
  assert.ok(!retained.includes(REPLAY_CLEANUP_HOOK), "CAP06_REPLAY_CLEANUP_PATCH_FAILED");
  assert.ok(!retained.includes(DATABASE_CLEANUP_HOOK), "CAP06_DATABASE_CLEANUP_PATCH_FAILED");
  fs.writeFileSync(TEMP_RUNNER, retained, "utf8");
}

async function dropIsolatedDatabase(baseUrl: string): Promise<void> {
  // Cleanup is centralized here so success and failure paths both terminate sessions and remove the dedicated database.
  const admin = new Pool({ connectionString: databaseUrlFor(baseUrl, "postgres") });
  try {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
      [ISOLATED_DATABASE],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${ISOLATED_DATABASE}`);
  } finally {
    await admin.end();
  }
}

async function cleanup(baseUrl: string): Promise<void> {
  // Remove every temporary source, input and database artifact created by this proof.
  fs.rmSync(TEMP_RUNNER, { force: true });
  fs.rmSync(REPLAY_ROOT, { recursive: true, force: true });
  fs.rmSync(RUNNER_INPUT, { force: true });
  await dropIsolatedDatabase(baseUrl);
}

async function main(): Promise<void> {
  const baseUrl = requiredBaseDatabaseUrl();
  const targetUrl = databaseUrlFor(baseUrl, ISOLATED_DATABASE);
  const pnpm = pnpmExecutable();

  await cleanup(baseUrl);
  try {
    prepareTemporaryRunner();
    const reconstruction = run(
      pnpm,
      ["-w", "exec", "tsx", path.relative(ROOT, TEMP_RUNNER).replace(/\\/g, "/")],
      { DATABASE_URL: baseUrl },
    );
    assert.match(reconstruction, /SUMMARY 7 PASS \/ 0 FAIL/);
    assert.ok(fs.existsSync(REPLAY_ROOT), "CAP06_RETAINED_REPLAY_ROOT_REQUIRED");
    ok("official CAP-05 formal runner reconstructs checkpoint 72 to 80 with its exact normalized Replay source retained");

    const qualification = run(
      pnpm,
      ["-w", "exec", "tsx", QUALIFIER],
      {
        DATABASE_URL: targetUrl,
        CAP06_REPLAY_ROOT: REPLAY_ROOT,
      },
    );
    assert.match(qualification, /SUMMARY 6 PASS \/ 0 FAIL/);
    assert.match(qualification, /INSUFFICIENT_MATCHED_PAIRS/);
    ok("S0 v2 resolves the exact Residual canonical plus source-Evidence closure and proves one eligible case");

    assert.equal(pass, 2);
    process.stdout.write(`SUMMARY ${pass} PASS / 0 FAIL\n`);
  } finally {
    await cleanup(baseUrl);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
