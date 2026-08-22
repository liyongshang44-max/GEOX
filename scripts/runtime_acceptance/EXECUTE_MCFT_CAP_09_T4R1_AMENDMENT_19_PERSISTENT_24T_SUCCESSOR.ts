import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SOURCE = path.resolve("scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts");
const GENERATED = path.resolve("scripts/runtime_acceptance/.generated_RUN_MCFT_CAP_09_T4R1_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts");
const SOURCE_PATH = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts";
const SOURCE_BLOB = "ae3e47593ef35cba08946427304a0d3271bb86e9";
const HISTORICAL_PARENT_DB = "geox_mcft_cap09_s6_formal_t3r1_24h_v3";
const T4R1_PARENT_DB = "geox_mcft_cap09_s6_formal_t4r1_24h";
const MAIN_DB = "geox_mcft_cap09_s6_accel24t_am19_v4";
const BLOCKED_DB = "geox_mcft_cap09_s6_accel24t_am19_blocked_v4";

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`T4R1_AM19_P24_SUCCESSOR_ENV_REQUIRED:${name}`);
  return value;
}

function build(): string {
  assert.equal(git("rev-parse", `HEAD:${SOURCE_PATH}`), SOURCE_BLOB, "T4R1_AM19_P24_SOURCE_RUNNER_BLOB_DRIFT");
  const source = fs.readFileSync(SOURCE, "utf8");
  const count = source.split(HISTORICAL_PARENT_DB).length - 1;
  assert.equal(count, 1, `T4R1_AM19_P24_PARENT_DB_REPLACEMENT_CARDINALITY:${count}`);
  const generated = source.replace(HISTORICAL_PARENT_DB, T4R1_PARENT_DB);
  assert(!generated.includes(HISTORICAL_PARENT_DB), "T4R1_AM19_P24_HISTORICAL_PARENT_DB_SURVIVED");
  assert(generated.includes(T4R1_PARENT_DB), "T4R1_AM19_P24_T4_PARENT_DB_REQUIRED");
  assert(generated.includes(MAIN_DB), "T4R1_AM19_P24_V4_MAIN_DB_REQUIRED");
  assert(generated.includes(BLOCKED_DB), "T4R1_AM19_P24_V4_BLOCKED_DB_REQUIRED");
  return generated;
}

function writeGenerated(): void {
  fs.writeFileSync(GENERATED, build());
}

function cleanup(): void {
  try { fs.unlinkSync(GENERATED); } catch {}
}

function proveStatic(): void {
  writeGenerated();
  try {
    execFileSync("pnpm", [
      "exec", "tsc", "--noEmit", "--pretty", "false", "--skipLibCheck",
      "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext",
      "--esModuleInterop", "--types", "node", GENERATED,
    ], { stdio: "inherit", env: process.env });
    execFileSync("pnpm", ["exec", "tsx", GENERATED, "selftest"], { stdio: "inherit", env: process.env });
    console.log(JSON.stringify({
      status: "PASS",
      source_runner_blob: SOURCE_BLOB,
      replacement_count: 1,
      parent_database: T4R1_PARENT_DB,
      main_database: MAIN_DB,
      blocked_database: BLOCKED_DB,
      canonical_runner_reimplemented: false,
      generated_file_committed: false,
      database_access: false,
      provider_access: false,
    }));
  } finally {
    cleanup();
  }
}

function assertLiveBoundary(): void {
  const subject = required("GITHUB_SHA");
  assert.match(subject, /^[0-9a-f]{40}$/, "T4R1_AM19_P24_EXACT_SHA_REQUIRED");
  assert.equal(process.env.GITHUB_REF, "refs/heads/main", "T4R1_AM19_P24_PROTECTED_MAIN_ONLY");
  assert.equal(git("rev-parse", "HEAD"), subject, "T4R1_AM19_P24_HEAD_SHA_MISMATCH");
  assert.equal(git("rev-parse", "origin/main"), subject, "T4R1_AM19_P24_PROTECTED_MAIN_DRIFT");
  assert.equal(required("MCFT_CAP09_SUBJECT_SHA"), subject, "T4R1_AM19_P24_SUBJECT_BINDING_DRIFT");
  assert.equal(required("MCFT_CAP09_CONSUMER_SUBJECT_SHA"), subject, "T4R1_AM19_P24_CONSUMER_BINDING_DRIFT");
  const parent = new URL(required("MCFT_CAP09_PARENT_DATABASE_URL"));
  assert(["postgres:", "postgresql:"].includes(parent.protocol), "T4R1_AM19_P24_POSTGRES_PARENT_REQUIRED");
  assert.equal(decodeURIComponent(parent.pathname.replace(/^\//, "")), T4R1_PARENT_DB, "T4R1_AM19_P24_PARENT_DB_IDENTITY_REQUIRED");
}

function run(): void {
  assertLiveBoundary();
  writeGenerated();
  try {
    execFileSync("pnpm", ["exec", "tsx", GENERATED, "run"], { stdio: "inherit", env: process.env });
  } finally {
    cleanup();
  }
}

const mode = process.argv[2] ?? "";
if (mode === "selftest") proveStatic();
else if (mode === "run") run();
else throw new Error("T4R1_AM19_P24_SUCCESSOR_MODE_REQUIRED");
