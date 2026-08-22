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
const SOURCE_MAIN_DB = "geox_mcft_cap09_s6_accel24t_am19_v4";
const SOURCE_BLOCKED_DB = "geox_mcft_cap09_s6_accel24t_am19_blocked_v4";
const PREVIOUS_MAIN_DB = "geox_mcft_cap09_s6_accel24t_am19_v6";
const PREVIOUS_BLOCKED_DB = "geox_mcft_cap09_s6_accel24t_am19_blocked_v6";
const MAIN_DB = "geox_mcft_cap09_s6_accel24t_am19_v7";
const BLOCKED_DB = "geox_mcft_cap09_s6_accel24t_am19_blocked_v7";
const HISTORICAL_CANDIDATE_GATE = 'if (candidate.producer_subject_sha !== subject || (candidate.subject_sha !== undefined && candidate.subject_sha !== subject)) throw new Error("AM19_P24_CANDIDATE_EXACT_SUBJECT_REQUIRED");';
const SUCCESSOR_CANDIDATE_GATE = 'const producerSubject = process.env.MCFT_CAP09_ROLLING_PRODUCER_SUBJECT_SHA?.trim(); if (!producerSubject || !/^[0-9a-f]{40}$/.test(producerSubject)) throw new Error("AM19_P24_SUCCESSOR_PRODUCER_SUBJECT_REQUIRED"); if (candidate.producer_subject_sha !== producerSubject || (candidate.subject_sha !== undefined && candidate.subject_sha !== producerSubject)) throw new Error("AM19_P24_CANDIDATE_PRODUCER_SUBJECT_REQUIRED");';

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`T4R1_AM19_P24_SUCCESSOR_ENV_REQUIRED:${name}`);
  return value;
}

function exactReplace(source: string, oldValue: string, newValue: string, code: string): string {
  const count = source.split(oldValue).length - 1;
  assert.equal(count, 1, `${code}:${count}`);
  return source.replace(oldValue, newValue);
}

function build(): string {
  assert.equal(git("rev-parse", `HEAD:${SOURCE_PATH}`), SOURCE_BLOB, "T4R1_AM19_P24_SOURCE_RUNNER_BLOB_DRIFT");
  let generated = fs.readFileSync(SOURCE, "utf8");
  generated = exactReplace(generated, HISTORICAL_PARENT_DB, T4R1_PARENT_DB, "T4R1_AM19_P24_PARENT_DB_REPLACEMENT_CARDINALITY");
  generated = exactReplace(generated, SOURCE_MAIN_DB, MAIN_DB, "T4R1_AM19_P24_MAIN_DB_REPLACEMENT_CARDINALITY");
  generated = exactReplace(generated, SOURCE_BLOCKED_DB, BLOCKED_DB, "T4R1_AM19_P24_BLOCKED_DB_REPLACEMENT_CARDINALITY");
  generated = exactReplace(generated, HISTORICAL_CANDIDATE_GATE, SUCCESSOR_CANDIDATE_GATE, "T4R1_AM19_P24_CANDIDATE_GATE_REPLACEMENT_CARDINALITY");
  assert(!generated.includes(HISTORICAL_PARENT_DB), "T4R1_AM19_P24_HISTORICAL_PARENT_DB_SURVIVED");
  assert(!generated.includes(SOURCE_MAIN_DB), "T4R1_AM19_P24_V4_MAIN_DB_SURVIVED");
  assert(!generated.includes(SOURCE_BLOCKED_DB), "T4R1_AM19_P24_V4_BLOCKED_DB_SURVIVED");
  assert(!generated.includes(HISTORICAL_CANDIDATE_GATE), "T4R1_AM19_P24_HISTORICAL_CANDIDATE_GATE_SURVIVED");
  assert(generated.includes(T4R1_PARENT_DB), "T4R1_AM19_P24_T4_PARENT_DB_REQUIRED");
  assert(generated.includes("MCFT_CAP09_ROLLING_PRODUCER_SUBJECT_SHA"), "T4R1_AM19_P24_PRODUCER_SUBJECT_BINDING_REQUIRED");
  assert(generated.includes(MAIN_DB), "T4R1_AM19_P24_V7_MAIN_DB_REQUIRED");
  assert(generated.includes(BLOCKED_DB), "T4R1_AM19_P24_V7_BLOCKED_DB_REQUIRED");
  assert(!generated.includes(PREVIOUS_MAIN_DB), "T4R1_AM19_P24_V6_MAIN_DB_REUSE_FORBIDDEN");
  assert(!generated.includes(PREVIOUS_BLOCKED_DB), "T4R1_AM19_P24_V6_BLOCKED_DB_REUSE_FORBIDDEN");
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
      replacement_count: 4,
      parent_database: T4R1_PARENT_DB,
      producer_subject_binding: "AUTHENTICATED_ROLLING_ARTIFACT",
      qualification_subject_binding: "CURRENT_EXACT_PROTECTED_MAIN",
      source_generation_main_database: SOURCE_MAIN_DB,
      source_generation_blocked_database: SOURCE_BLOCKED_DB,
      previous_generation_main_database: PREVIOUS_MAIN_DB,
      previous_generation_blocked_database: PREVIOUS_BLOCKED_DB,
      main_database: MAIN_DB,
      blocked_database: BLOCKED_DB,
      previous_generation_reused: false,
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
  assert.match(required("MCFT_CAP09_ROLLING_PRODUCER_SUBJECT_SHA"), /^[0-9a-f]{40}$/, "T4R1_AM19_P24_PRODUCER_SHA_INVALID");
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