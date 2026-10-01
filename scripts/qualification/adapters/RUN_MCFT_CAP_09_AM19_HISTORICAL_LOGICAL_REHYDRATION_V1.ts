import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SOURCE_PATH = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts";
const SOURCE = path.resolve(SOURCE_PATH);
const SOURCE_BLOB = "04006c5e94967aa387e3e766f205c5bdca783784";
const GENERATED = path.resolve("scripts/qualification/.generated_RUN_MCFT_CAP_09_AM19_HISTORICAL_LOGICAL_REHYDRATION_V1.ts");
const DESCRIPTOR_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM19-HISTORICAL-LOGICAL-EPOCH-V1.json";
const DESCRIPTOR = path.resolve(DESCRIPTOR_PATH);
const REHYDRATION_OUTPUT = path.resolve("acceptance-output/MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION.json");
const VERIFY_OUTPUT = path.resolve("acceptance-output/MCFT_CAP_09_AM19_HISTORICAL_RETAINED_RAW_VERIFY_V1.json");

const SOURCE_EXPIRY_GATE = 'if (Date.parse(candidate.candidate_expires_at) <= Date.now()) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_CANDIDATE_EXPIRED");';
const HISTORICAL_EXPIRY_GATE = 'if (candidate.candidate_expires_at !== process.env.MCFT_CAP09_HISTORICAL_CANDIDATE_EXPIRES_AT) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_HISTORICAL_EXPIRY_BINDING_REQUIRED");';
const SOURCE_MAIN_GATE = 'if (!["push", "workflow_dispatch", "schedule", "workflow_run"].includes(process.env.GITHUB_EVENT_NAME ?? "") || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_SHA !== consumerSha) {\n    throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_EXACT_MAIN_REQUIRED");\n  }';
const CONTROLLED_MAIN_GATE = 'if (String(process.env.GITHUB_ACTIONS ?? "").toLowerCase() === "true" || process.env.GEOX_AM19_HISTORICAL_LOGICAL_EPOCH_ACK !== "true") {\n    throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_CONTROLLED_HISTORICAL_HOST_REQUIRED");\n  }';

function executable(name: string): string { return process.platform === "win32" && name === "pnpm" ? "pnpm.cmd" : name; }
function git(...args: string[]): string { return execFileSync("git", args, { encoding: "utf8" }).trim(); }
function readJson(file: string): any { return JSON.parse(fs.readFileSync(file, "utf8")); }
function sha256File(file: string): string { return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`; }
function exactReplace(source: string, oldValue: string, newValue: string, code: string): string {
  const count = source.split(oldValue).length - 1;
  assert.equal(count, 1, `${code}:${count}`);
  return source.replace(oldValue, newValue);
}
function cleanup(): void { try { fs.unlinkSync(GENERATED); } catch {} }

function descriptor(): any {
  const d = readJson(DESCRIPTOR);
  assert.equal(d.schema_version, "geox_mcft_cap09_am19_historical_logical_epoch_v1", "AM19_HISTORICAL_REHYDRATION_DESCRIPTOR_SCHEMA_REQUIRED");
  assert.equal(d.historical_producer.producer_subject_sha, "91d2f518efc5c4c7796c398dabd12801949a9289", "AM19_HISTORICAL_REHYDRATION_PRODUCER_DRIFT");
  assert.equal(d.logical_epoch.target_t, "2026-08-21T19:00:00.000Z", "AM19_HISTORICAL_REHYDRATION_TARGET_DRIFT");
  assert.equal(d.retained_raw_objects.length, 2, "AM19_HISTORICAL_REHYDRATION_TWO_RAW_OBJECTS_REQUIRED");
  assert.equal(d.expected_records.length, 3, "AM19_HISTORICAL_REHYDRATION_THREE_RECORDS_REQUIRED");
  return d;
}

function assertControlledBoundary(): any {
  assert.notEqual(String(process.env.GITHUB_ACTIONS ?? "").toLowerCase(), "true", "AM19_HISTORICAL_REHYDRATION_GITHUB_ACTIONS_FORBIDDEN");
  const d = descriptor();
  const consumer = String(process.env.MCFT_CAP09_CONSUMER_SUBJECT_SHA ?? "").trim();
  assert.match(consumer, /^[0-9a-f]{40}$/, "AM19_HISTORICAL_REHYDRATION_CONSUMER_SHA_REQUIRED");
  assert.equal(git("rev-parse", "HEAD"), consumer, "AM19_HISTORICAL_REHYDRATION_HEAD_MISMATCH");
  assert.equal(String(process.env.MCFT_CAP09_ROLLING_PRODUCER_SUBJECT_SHA ?? ""), d.historical_producer.producer_subject_sha, "AM19_HISTORICAL_REHYDRATION_PRODUCER_ENV_MISMATCH");
  const candidatePath = path.resolve(String(process.env.MCFT_CAP09_ROLLING_CANDIDATE_PATH ?? ""));
  assert(fs.existsSync(candidatePath), "AM19_HISTORICAL_REHYDRATION_CANDIDATE_REQUIRED");
  const candidate = readJson(candidatePath);
  assert.equal(candidate.producer_subject_sha, d.historical_producer.producer_subject_sha, "AM19_HISTORICAL_REHYDRATION_CANDIDATE_PRODUCER_MISMATCH");
  assert.equal(candidate.target_t, d.logical_epoch.target_t, "AM19_HISTORICAL_REHYDRATION_CANDIDATE_TARGET_MISMATCH");
  assert.equal(candidate.candidate_expires_at, d.logical_epoch.original_candidate_expires_at, "AM19_HISTORICAL_REHYDRATION_CANDIDATE_EXPIRY_PROVENANCE_MISMATCH");
  assert.equal(candidate.semantic_manifest_digest, d.logical_epoch.semantic_manifest_digest, "AM19_HISTORICAL_REHYDRATION_SEMANTIC_MANIFEST_MISMATCH");
  return d;
}

function build(): string {
  assert.equal(git("rev-parse", `HEAD:${SOURCE_PATH}`), SOURCE_BLOB, "AM19_HISTORICAL_REHYDRATION_SOURCE_BLOB_DRIFT");
  let generated = fs.readFileSync(SOURCE, "utf8");
  generated = exactReplace(generated, SOURCE_EXPIRY_GATE, HISTORICAL_EXPIRY_GATE, "AM19_HISTORICAL_REHYDRATION_EXPIRY_GATE_CARDINALITY");
  generated = exactReplace(generated, SOURCE_MAIN_GATE, CONTROLLED_MAIN_GATE, "AM19_HISTORICAL_REHYDRATION_MAIN_GATE_CARDINALITY");
  assert(!generated.includes(SOURCE_EXPIRY_GATE), "AM19_HISTORICAL_REHYDRATION_SOURCE_EXPIRY_GATE_SURVIVED");
  assert(!generated.includes(SOURCE_MAIN_GATE), "AM19_HISTORICAL_REHYDRATION_SOURCE_MAIN_GATE_SURVIVED");
  return generated;
}

function writeGenerated(): void { fs.writeFileSync(GENERATED, build(), { flag: "wx" }); }

function writeRetainedRawProof(d: any): void {
  const r = readJson(REHYDRATION_OUTPUT);
  assert.equal(r.status, "PASS", "AM19_HISTORICAL_RETAINED_RAW_REHYDRATION_PASS_REQUIRED");
  assert.equal(r.producer_subject_sha, d.historical_producer.producer_subject_sha, "AM19_HISTORICAL_RETAINED_RAW_PRODUCER_MISMATCH");
  assert.equal(r.target_t, d.logical_epoch.target_t, "AM19_HISTORICAL_RETAINED_RAW_TARGET_MISMATCH");
  assert.equal(r.semantic_manifest_match, true, "AM19_HISTORICAL_RETAINED_RAW_SEMANTIC_MATCH_REQUIRED");
  assert.equal(r.producer_bound_raw_reverification, true, "AM19_HISTORICAL_RETAINED_RAW_REVERIFICATION_REQUIRED");
  assert.equal(r.provider_refetch_count, 0, "AM19_HISTORICAL_RETAINED_RAW_PROVIDER_REFETCH_FORBIDDEN");
  assert.equal(r.private_r2_get_count, 2, "AM19_HISTORICAL_RETAINED_RAW_EXACT_TWO_GETS_REQUIRED");
  assert.equal(r.private_r2_put_count, 0, "AM19_HISTORICAL_RETAINED_RAW_PUT_FORBIDDEN");
  assert.equal(r.private_r2_delete_count, 0, "AM19_HISTORICAL_RETAINED_RAW_DELETE_FORBIDDEN");
  assert.equal(r.formal_database_write_count, 0, "AM19_HISTORICAL_RETAINED_RAW_FORMAL_DB_WRITE_FORBIDDEN");
  assert.equal(r.runtime_write_count, 0, "AM19_HISTORICAL_RETAINED_RAW_RUNTIME_WRITE_FORBIDDEN");
  assert.equal(r.scheduler_write_count, 0, "AM19_HISTORICAL_RETAINED_RAW_SCHEDULER_WRITE_FORBIDDEN");
  const out = {
    schema_version: "geox_mcft_cap09_am19_historical_retained_raw_verify_v1",
    status: "PASS",
    historical_logical_epoch_id: d.epoch_id,
    producer_subject_sha: d.historical_producer.producer_subject_sha,
    target_t: d.logical_epoch.target_t,
    retained_raw_object_count: 2,
    objects: d.retained_raw_objects.map((x: any) => ({
      record_role: x.record_role,
      retention_ref: x.retention_ref,
      raw_sha256: x.raw_sha256,
      raw_bytes: x.raw_bytes,
      retained_at: x.retained_at,
      exact_head_get_reverified: true,
      raw_values_emitted: false,
    })),
    expected_semantic_manifest_digest: d.logical_epoch.semantic_manifest_digest,
    semantic_manifest_match: true,
    exact_byte_and_digest_reverification: true,
    provider_refetch_count: 0,
    private_r2_get_count: 2,
    private_r2_put_count: 0,
    private_r2_delete_count: 0,
    formal_database_write_count: 0,
    runtime_write_count: 0,
    scheduler_write_count: 0,
    current_season_formal_admission: "NOT_EVALUATED",
    formal_effect: false,
    rehydration_proof_digest: sha256File(REHYDRATION_OUTPUT),
  };
  fs.writeFileSync(VERIFY_OUTPUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(JSON.stringify(out));
}

function selftest(): void {
  const d = assertControlledBoundary();
  writeGenerated();
  try {
    execFileSync(executable("pnpm"), ["exec", "tsx", GENERATED, "selftest"], {
      stdio: "inherit",
      env: {
        ...process.env,
        GEOX_AM19_HISTORICAL_LOGICAL_EPOCH_ACK: "true",
        MCFT_CAP09_HISTORICAL_CANDIDATE_EXPIRES_AT: d.logical_epoch.original_candidate_expires_at,
      },
    });
    console.log(JSON.stringify({status:"PASS",source_blob:SOURCE_BLOB,historical_expiry_is_provenance_not_current_admission:true,database_access:false,provider_access:false}));
  } finally { cleanup(); }
}

function run(): void {
  const d = assertControlledBoundary();
  writeGenerated();
  try {
    execFileSync(executable("pnpm"), ["exec", "tsx", GENERATED, "run"], {
      stdio: "inherit",
      env: {
        ...process.env,
        GEOX_AM19_HISTORICAL_LOGICAL_EPOCH_ACK: "true",
        MCFT_CAP09_HISTORICAL_CANDIDATE_EXPIRES_AT: d.logical_epoch.original_candidate_expires_at,
      },
    });
    writeRetainedRawProof(d);
  } finally { cleanup(); }
}

const mode = process.argv[2] ?? "";
if (mode === "selftest") selftest();
else if (mode === "run") run();
else throw new Error("AM19_HISTORICAL_REHYDRATION_MODE_REQUIRED");
