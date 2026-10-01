import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SOURCE = path.resolve("scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts");
const GENERATED = path.resolve("scripts/qualification/.generated_RUN_MCFT_CAP_09_AM19_HISTORICAL_LOGICAL_PERSISTENT_V1.ts");
const SOURCE_PATH = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_AMENDMENT_19_PERSISTENT_24T_QUALIFICATION_V1.ts";
const SOURCE_BLOB = "ae3e47593ef35cba08946427304a0d3271bb86e9";
const DESCRIPTOR_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM19-HISTORICAL-LOGICAL-EPOCH-V1.json";
const DESCRIPTOR = path.resolve(DESCRIPTOR_PATH);
const HISTORICAL_PARENT_DB = "geox_mcft_cap09_s6_formal_t3r1_24h_v3";
const T4R1_PARENT_DB = "geox_mcft_cap09_s6_formal_t4r1_24h_v5";
const SOURCE_MAIN_DB = "geox_mcft_cap09_s6_accel24t_am19_v4";
const SOURCE_BLOCKED_DB = "geox_mcft_cap09_s6_accel24t_am19_blocked_v4";
const SOURCE_AUTHORITY_BLOB_SYMBOL = "MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V3";
const TARGET_AUTHORITY_BLOB_SYMBOL = "MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_BLOB_V4";
const SOURCE_AUTHORITY_REF_SYMBOL = "MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V3";
const TARGET_AUTHORITY_REF_SYMBOL = "MCFT_CAP09_AM19_FRESH_STORE_AUTHORITY_REF_V4";
const HISTORICAL_CANDIDATE_GATE = 'if (candidate.producer_subject_sha !== subject || (candidate.subject_sha !== undefined && candidate.subject_sha !== subject)) throw new Error("AM19_P24_CANDIDATE_EXACT_SUBJECT_REQUIRED");';
const CONTROLLED_CANDIDATE_GATE = 'const producerSubject = process.env.MCFT_CAP09_ROLLING_PRODUCER_SUBJECT_SHA?.trim(); if (!producerSubject || !/^[0-9a-f]{40}$/.test(producerSubject)) throw new Error("AM19_P24_SUCCESSOR_PRODUCER_SUBJECT_REQUIRED"); if (candidate.producer_subject_sha !== producerSubject || (candidate.subject_sha !== undefined && candidate.subject_sha !== producerSubject)) throw new Error("AM19_P24_CANDIDATE_PRODUCER_SUBJECT_REQUIRED");';
const SOURCE_EXPIRY_GATE = 'if (Date.now() >= Date.parse(candidate.candidate_expires_at)) throw new Error("AM19_P24_CANDIDATE_EXPIRED");';
const HISTORICAL_EXPIRY_GATE = 'if (process.env.GEOX_AM19_HISTORICAL_LOGICAL_EPOCH_ACK !== "true" || candidate.candidate_expires_at !== process.env.MCFT_CAP09_HISTORICAL_CANDIDATE_EXPIRES_AT) throw new Error("AM19_P24_HISTORICAL_CANDIDATE_EXPIRY_BINDING_REQUIRED");';

function executable(name: string): string { return process.platform === "win32" && name === "pnpm" ? "pnpm.cmd" : name; }
function git(...args: string[]): string { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function required(name: string): string { const value = process.env[name]?.trim(); if (!value) throw new Error(`CONTROLLED_AM19_HISTORICAL_ENV_REQUIRED:${name}`); return value; }
function readJson(file: string): any { return JSON.parse(fs.readFileSync(file, "utf8")); }
function exactReplace(source: string, oldValue: string, newValue: string, code: string): string { const count = source.split(oldValue).length - 1; assert.equal(count, 1, `${code}:${count}`); return source.replace(oldValue, newValue); }
function exactReplaceCount(source: string, oldValue: string, newValue: string, expectedCount: number, code: string): string { const count = source.split(oldValue).length - 1; assert.equal(count, expectedCount, `${code}:${count}`); return source.split(oldValue).join(newValue); }
function qualificationDatabase(name: string, prefix: string): string { assert.match(name, new RegExp(`^${prefix}[0-9a-f]{16}$`), `CONTROLLED_AM19_HISTORICAL_QUALIFICATION_DATABASE_INVALID:${name}`); return name; }
function descriptor(): any {
  const d = readJson(DESCRIPTOR);
  assert.equal(d.schema_version, "geox_mcft_cap09_am19_historical_logical_epoch_v1", "CONTROLLED_AM19_HISTORICAL_DESCRIPTOR_SCHEMA_REQUIRED");
  assert.equal(d.current_2026_crop_window_status, "CLOSED_NO_RETRY_NO_RECAPTURE_NO_BYPASS", "CONTROLLED_AM19_HISTORICAL_CURRENT_WINDOW_MUST_REMAIN_CLOSED");
  return d;
}

function build(): string {
  assert.equal(git("rev-parse", `HEAD:${SOURCE_PATH}`), SOURCE_BLOB, "CONTROLLED_AM19_HISTORICAL_SOURCE_RUNNER_BLOB_DRIFT");
  const mainDb = qualificationDatabase(required("GEOX_AM19_QMIG_MAIN_DB"), "geox_mcft_cap09_am19_q_");
  const blockedDb = qualificationDatabase(required("GEOX_AM19_QMIG_BLOCKED_DB"), "geox_mcft_cap09_am19_b_");
  assert.notEqual(mainDb, blockedDb, "CONTROLLED_AM19_HISTORICAL_QUALIFICATION_DATABASE_COLLISION");
  let generated = fs.readFileSync(SOURCE, "utf8");
  generated = exactReplace(generated, HISTORICAL_PARENT_DB, T4R1_PARENT_DB, "CONTROLLED_AM19_HISTORICAL_PARENT_DB_REPLACEMENT_CARDINALITY");
  generated = exactReplace(generated, SOURCE_MAIN_DB, mainDb, "CONTROLLED_AM19_HISTORICAL_MAIN_DB_REPLACEMENT_CARDINALITY");
  generated = exactReplace(generated, SOURCE_BLOCKED_DB, blockedDb, "CONTROLLED_AM19_HISTORICAL_BLOCKED_DB_REPLACEMENT_CARDINALITY");
  generated = exactReplace(generated, HISTORICAL_CANDIDATE_GATE, CONTROLLED_CANDIDATE_GATE, "CONTROLLED_AM19_HISTORICAL_CANDIDATE_GATE_REPLACEMENT_CARDINALITY");
  generated = exactReplace(generated, SOURCE_EXPIRY_GATE, HISTORICAL_EXPIRY_GATE, "CONTROLLED_AM19_HISTORICAL_EXPIRY_GATE_REPLACEMENT_CARDINALITY");
  generated = exactReplaceCount(generated, SOURCE_AUTHORITY_BLOB_SYMBOL, TARGET_AUTHORITY_BLOB_SYMBOL, 2, "CONTROLLED_AM19_HISTORICAL_AUTHORITY_BLOB_SYMBOL_REPLACEMENT_CARDINALITY");
  generated = exactReplaceCount(generated, SOURCE_AUTHORITY_REF_SYMBOL, TARGET_AUTHORITY_REF_SYMBOL, 2, "CONTROLLED_AM19_HISTORICAL_AUTHORITY_REF_SYMBOL_REPLACEMENT_CARDINALITY");
  assert(!generated.includes(HISTORICAL_PARENT_DB), "CONTROLLED_AM19_HISTORICAL_PARENT_DB_SURVIVED");
  assert(!generated.includes(SOURCE_MAIN_DB), "CONTROLLED_AM19_HISTORICAL_V4_MAIN_DB_SURVIVED");
  assert(!generated.includes(SOURCE_BLOCKED_DB), "CONTROLLED_AM19_HISTORICAL_V4_BLOCKED_DB_SURVIVED");
  assert(!generated.includes(HISTORICAL_CANDIDATE_GATE), "CONTROLLED_AM19_HISTORICAL_CANDIDATE_GATE_SURVIVED");
  assert(!generated.includes(SOURCE_EXPIRY_GATE), "CONTROLLED_AM19_HISTORICAL_CURRENT_EXPIRY_GATE_SURVIVED");
  assert.equal(generated.split(TARGET_AUTHORITY_BLOB_SYMBOL).length - 1, 2, "CONTROLLED_AM19_HISTORICAL_V4_AUTHORITY_BLOB_SYMBOL_REQUIRED");
  assert.equal(generated.split(TARGET_AUTHORITY_REF_SYMBOL).length - 1, 2, "CONTROLLED_AM19_HISTORICAL_V4_AUTHORITY_REF_SYMBOL_REQUIRED");
  return generated;
}

function writeGenerated(): void { fs.writeFileSync(GENERATED, build(), { flag: "wx" }); }
function cleanup(): void { try { fs.unlinkSync(GENERATED); } catch {} }

function assertControlledBoundary(): any {
  assert.notEqual(String(process.env.GITHUB_ACTIONS ?? "").toLowerCase(), "true", "CONTROLLED_AM19_HISTORICAL_GITHUB_ACTIONS_FORBIDDEN");
  const d = descriptor();
  const subject = required("MCFT_CAP09_SUBJECT_SHA");
  assert.match(subject, /^[0-9a-f]{40}$/, "CONTROLLED_AM19_HISTORICAL_EXACT_SHA_REQUIRED");
  assert.equal(required("MCFT_CAP09_CONSUMER_SUBJECT_SHA"), subject, "CONTROLLED_AM19_HISTORICAL_CONSUMER_BINDING_DRIFT");
  assert.equal(required("GEOX_QUALIFICATION_SUBJECT_SHA"), subject, "CONTROLLED_AM19_HISTORICAL_QUALIFICATION_SUBJECT_DRIFT");
  assert.equal(git("rev-parse", "HEAD"), subject, "CONTROLLED_AM19_HISTORICAL_HEAD_SHA_MISMATCH");
  assert.equal(required("MCFT_CAP09_ROLLING_PRODUCER_SUBJECT_SHA"), d.historical_producer.producer_subject_sha, "CONTROLLED_AM19_HISTORICAL_PRODUCER_SHA_MISMATCH");
  const candidatePath = path.resolve(required("MCFT_CAP09_ROLLING_CANDIDATE_PATH"));
  const candidate = readJson(candidatePath);
  assert.equal(candidate.target_t, d.logical_epoch.target_t, "CONTROLLED_AM19_HISTORICAL_TARGET_MISMATCH");
  assert.equal(candidate.candidate_expires_at, d.logical_epoch.original_candidate_expires_at, "CONTROLLED_AM19_HISTORICAL_EXPIRY_PROVENANCE_MISMATCH");
  const parent = new URL(required("MCFT_CAP09_PARENT_DATABASE_URL"));
  assert(["postgres:", "postgresql:"].includes(parent.protocol), "CONTROLLED_AM19_HISTORICAL_POSTGRES_PARENT_REQUIRED");
  assert(!["localhost", "127.0.0.1", "::1"].includes(parent.hostname), "CONTROLLED_AM19_HISTORICAL_REMOTE_PARENT_REQUIRED");
  assert.equal(decodeURIComponent(parent.pathname.replace(/^\//, "")), T4R1_PARENT_DB, "CONTROLLED_AM19_HISTORICAL_T4R1_PARENT_DB_IDENTITY_REQUIRED");
  qualificationDatabase(required("GEOX_AM19_QMIG_MAIN_DB"), "geox_mcft_cap09_am19_q_");
  qualificationDatabase(required("GEOX_AM19_QMIG_BLOCKED_DB"), "geox_mcft_cap09_am19_b_");
  return d;
}

function childEnv(d: any): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GEOX_AM19_HISTORICAL_LOGICAL_EPOCH_ACK: "true",
    MCFT_CAP09_HISTORICAL_CANDIDATE_EXPIRES_AT: d.logical_epoch.original_candidate_expires_at,
  };
}

function selftest(): void {
  const d = assertControlledBoundary();
  writeGenerated();
  try {
    execFileSync(executable("pnpm"), ["exec", "tsc", "--noEmit", "--pretty", "false", "--skipLibCheck", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--esModuleInterop", "--types", "node", GENERATED], { stdio: "inherit", env: childEnv(d) });
    execFileSync(executable("pnpm"), ["exec", "tsx", GENERATED, "selftest"], { stdio: "inherit", env: childEnv(d) });
    console.log(JSON.stringify({status:"PASS",execution_plane:"GEOX_CONTROLLED_QUALIFICATION_HOST_V1",source_runner_blob:SOURCE_BLOB,source_runner_reimplemented:false,historical_logical_epoch_id:d.epoch_id,current_candidate_expiry_gate_substituted:false,historical_expiry_bound_as_provenance:true,parent_database:T4R1_PARENT_DB,producer_subject_binding:"EXACT_HISTORICAL_DESCRIPTOR",qualification_subject_binding:"EXACT_CONTROLLED_HOST_CHECKOUT",authority_generation:"V4",database_access:false,provider_access:false}));
  } finally { cleanup(); }
}

function run(): void {
  const d = assertControlledBoundary();
  writeGenerated();
  try {
    execFileSync(executable("pnpm"), ["exec", "tsx", GENERATED, "run"], { stdio: "inherit", env: childEnv(d) });
  } finally { cleanup(); }
}

const mode = process.argv[2] ?? "";
if (mode === "selftest") selftest();
else if (mode === "run") run();
else throw new Error("CONTROLLED_AM19_HISTORICAL_MODE_REQUIRED");
