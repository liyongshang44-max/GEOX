import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SOURCE = path.resolve("scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts");
const GENERATED = path.resolve("scripts/qualification/.generated_RUN_MCFT_CAP_09_AM19_PERSISTENT_24T_CONTROLLED_V1.ts");
const SOURCE_PATH = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts";
const SOURCE_BLOB = "ae3e47593ef35cba08946427304a0d3271bb86e9";
const HISTORICAL_PARENT_DB = "geox_mcft_cap09_s6_formal_t3r1_24h_v3";
const T4R1_PARENT_DB = "geox_mcft_cap09_s6_formal_t4r1_24h";
const SOURCE_MAIN_DB = "geox_mcft_cap09_s6_accel24t_am19_v4";
const SOURCE_BLOCKED_DB = "geox_mcft_cap09_s6_accel24t_am19_blocked_v4";
const SOURCE_AUTHORITY_BLOB_SYMBOL = "MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V3";
const TARGET_AUTHORITY_BLOB_SYMBOL = "MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4";
const SOURCE_AUTHORITY_REF_SYMBOL = "MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V3";
const TARGET_AUTHORITY_REF_SYMBOL = "MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4";
const HISTORICAL_CANDIDATE_GATE = 'if (candidate.producer_subject_sha !== subject || (candidate.subject_sha !== undefined && candidate.subject_sha !== subject)) throw new Error("AM19_P24_CANDIDATE_EXACT_SUBJECT_REQUIRED");';
const CONTROLLED_CANDIDATE_GATE = 'const producerSubject = process.env.MCFT_CAP09_ROLLING_PRODUCER_SUBJECT_SHA?.trim(); if (!producerSubject || !/^[0-9a-f]{40}$/.test(producerSubject)) throw new Error("AM19_P24_SUCCESSOR_PRODUCER_SUBJECT_REQUIRED"); if (candidate.producer_subject_sha !== producerSubject || (candidate.subject_sha !== undefined && candidate.subject_sha !== producerSubject)) throw new Error("AM19_P24_CANDIDATE_PRODUCER_SUBJECT_REQUIRED");';

function executable(name: string): string {
  return process.platform === "win32" && name === "pnpm" ? "pnpm.cmd" : name;
}

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`CONTROLLED_AM19_P24_ENV_REQUIRED:${name}`);
  return value;
}

function exactReplace(source: string, oldValue: string, newValue: string, code: string): string {
  const count = source.split(oldValue).length - 1;
  assert.equal(count, 1, `${code}:${count}`);
  return source.replace(oldValue, newValue);
}

function exactReplaceCount(source: string, oldValue: string, newValue: string, expectedCount: number, code: string): string {
  const count = source.split(oldValue).length - 1;
  assert.equal(count, expectedCount, `${code}:${count}`);
  return source.split(oldValue).join(newValue);
}

function qualificationDatabase(name: string, prefix: string): string {
  assert.match(name, new RegExp(`^${prefix}[0-9a-f]{16}$`), `CONTROLLED_AM19_P24_QUALIFICATION_DATABASE_INVALID:${name}`);
  return name;
}

function build(): string {
  assert.equal(git("rev-parse", `HEAD:${SOURCE_PATH}`), SOURCE_BLOB, "CONTROLLED_AM19_P24_SOURCE_RUNNER_BLOB_DRIFT");
  const mainDb = qualificationDatabase(required("GEOX_AM19_QMIG_MAIN_DB"), "geox_mcft_cap09_am19_q_");
  const blockedDb = qualificationDatabase(required("GEOX_AM19_QMIG_BLOCKED_DB"), "geox_mcft_cap09_am19_b_");
  assert.notEqual(mainDb, blockedDb, "CONTROLLED_AM19_P24_QUALIFICATION_DATABASE_COLLISION");

  let generated = fs.readFileSync(SOURCE, "utf8");
  generated = exactReplace(generated, HISTORICAL_PARENT_DB, T4R1_PARENT_DB, "CONTROLLED_AM19_P24_PARENT_DB_REPLACEMENT_CARDINALITY");
  generated = exactReplace(generated, SOURCE_MAIN_DB, mainDb, "CONTROLLED_AM19_P24_MAIN_DB_REPLACEMENT_CARDINALITY");
  generated = exactReplace(generated, SOURCE_BLOCKED_DB, blockedDb, "CONTROLLED_AM19_P24_BLOCKED_DB_REPLACEMENT_CARDINALITY");
  generated = exactReplace(generated, HISTORICAL_CANDIDATE_GATE, CONTROLLED_CANDIDATE_GATE, "CONTROLLED_AM19_P24_CANDIDATE_GATE_REPLACEMENT_CARDINALITY");
  generated = exactReplaceCount(generated, SOURCE_AUTHORITY_BLOB_SYMBOL, TARGET_AUTHORITY_BLOB_SYMBOL, 2, "CONTROLLED_AM19_P24_AUTHORITY_BLOB_SYMBOL_REPLACEMENT_CARDINALITY");
  generated = exactReplaceCount(generated, SOURCE_AUTHORITY_REF_SYMBOL, TARGET_AUTHORITY_REF_SYMBOL, 2, "CONTROLLED_AM19_P24_AUTHORITY_REF_SYMBOL_REPLACEMENT_CARDINALITY");

  assert(!generated.includes(HISTORICAL_PARENT_DB), "CONTROLLED_AM19_P24_HISTORICAL_PARENT_DB_SURVIVED");
  assert(!generated.includes(SOURCE_MAIN_DB), "CONTROLLED_AM19_P24_V4_MAIN_DB_SURVIVED");
  assert(!generated.includes(SOURCE_BLOCKED_DB), "CONTROLLED_AM19_P24_V4_BLOCKED_DB_SURVIVED");
  assert(!generated.includes(HISTORICAL_CANDIDATE_GATE), "CONTROLLED_AM19_P24_HISTORICAL_CANDIDATE_GATE_SURVIVED");
  assert(!generated.includes(SOURCE_AUTHORITY_BLOB_SYMBOL), "CONTROLLED_AM19_P24_V3_AUTHORITY_BLOB_SYMBOL_SURVIVED");
  assert(!generated.includes(SOURCE_AUTHORITY_REF_SYMBOL), "CONTROLLED_AM19_P24_V3_AUTHORITY_REF_SYMBOL_SURVIVED");
  assert.equal(generated.split(TARGET_AUTHORITY_BLOB_SYMBOL).length - 1, 2, "CONTROLLED_AM19_P24_V4_AUTHORITY_BLOB_SYMBOL_REQUIRED");
  assert.equal(generated.split(TARGET_AUTHORITY_REF_SYMBOL).length - 1, 2, "CONTROLLED_AM19_P24_V4_AUTHORITY_REF_SYMBOL_REQUIRED");
  assert(generated.includes(T4R1_PARENT_DB), "CONTROLLED_AM19_P24_T4R1_PARENT_DB_REQUIRED");
  assert(generated.includes("MCFT_CAP09_ROLLING_PRODUCER_SUBJECT_SHA"), "CONTROLLED_AM19_P24_PRODUCER_SUBJECT_BINDING_REQUIRED");
  assert(generated.includes(mainDb), "CONTROLLED_AM19_P24_MAIN_DB_REQUIRED");
  assert(generated.includes(blockedDb), "CONTROLLED_AM19_P24_BLOCKED_DB_REQUIRED");
  return generated;
}

function writeGenerated(): void {
  fs.writeFileSync(GENERATED, build(), { flag: "wx" });
}

function cleanup(): void {
  try { fs.unlinkSync(GENERATED); } catch {}
}

function assertControlledBoundary(): void {
  if (String(process.env.GITHUB_ACTIONS ?? "").toLowerCase() === "true") throw new Error("CONTROLLED_AM19_P24_GITHUB_ACTIONS_FORBIDDEN");
  const subject = required("MCFT_CAP09_SUBJECT_SHA");
  assert.match(subject, /^[0-9a-f]{40}$/, "CONTROLLED_AM19_P24_EXACT_SHA_REQUIRED");
  assert.equal(required("MCFT_CAP09_CONSUMER_SUBJECT_SHA"), subject, "CONTROLLED_AM19_P24_CONSUMER_BINDING_DRIFT");
  assert.equal(required("GEOX_QUALIFICATION_SUBJECT_SHA"), subject, "CONTROLLED_AM19_P24_QUALIFICATION_SUBJECT_DRIFT");
  assert.equal(git("rev-parse", "HEAD"), subject, "CONTROLLED_AM19_P24_HEAD_SHA_MISMATCH");
  assert.match(required("MCFT_CAP09_ROLLING_PRODUCER_SUBJECT_SHA"), /^[0-9a-f]{40}$/, "CONTROLLED_AM19_P24_PRODUCER_SHA_INVALID");
  const parent = new URL(required("MCFT_CAP09_PARENT_DATABASE_URL"));
  assert(["postgres:", "postgresql:"].includes(parent.protocol), "CONTROLLED_AM19_P24_POSTGRES_PARENT_REQUIRED");
  assert(!["localhost", "127.0.0.1", "::1"].includes(parent.hostname), "CONTROLLED_AM19_P24_REMOTE_PARENT_REQUIRED");
  assert.equal(decodeURIComponent(parent.pathname.replace(/^\//, "")), T4R1_PARENT_DB, "CONTROLLED_AM19_P24_T4R1_PARENT_DB_IDENTITY_REQUIRED");
  qualificationDatabase(required("GEOX_AM19_QMIG_MAIN_DB"), "geox_mcft_cap09_am19_q_");
  qualificationDatabase(required("GEOX_AM19_QMIG_BLOCKED_DB"), "geox_mcft_cap09_am19_b_");
}

function proveStatic(): void {
  assertControlledBoundary();
  writeGenerated();
  try {
    execFileSync(executable("pnpm"), [
      "exec", "tsc", "--noEmit", "--pretty", "false", "--skipLibCheck",
      "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext",
      "--esModuleInterop", "--types", "node", GENERATED,
    ], { stdio: "inherit", env: process.env });
    execFileSync(executable("pnpm"), ["exec", "tsx", GENERATED, "selftest"], { stdio: "inherit", env: process.env });
    console.log(JSON.stringify({
      status: "PASS",
      execution_plane: "GEOX_CONTROLLED_QUALIFICATION_HOST_V1",
      source_runner_blob: SOURCE_BLOB,
      source_runner_reimplemented: false,
      generated_file_committed: false,
      parent_database: T4R1_PARENT_DB,
      producer_subject_binding: "EXPLICIT_BOUND_CANDIDATE_INPUT",
      qualification_subject_binding: "EXACT_CONTROLLED_HOST_CHECKOUT",
      authority_generation: "V4",
      database_access: false,
      provider_access: false,
    }));
  } finally {
    cleanup();
  }
}

function run(): void {
  assertControlledBoundary();
  writeGenerated();
  try {
    execFileSync(executable("pnpm"), ["exec", "tsx", GENERATED, "run"], { stdio: "inherit", env: process.env });
  } finally {
    cleanup();
  }
}

const mode = process.argv[2] ?? "";
if (mode === "selftest") proveStatic();
else if (mode === "run") run();
else throw new Error("CONTROLLED_AM19_P24_MODE_REQUIRED");
