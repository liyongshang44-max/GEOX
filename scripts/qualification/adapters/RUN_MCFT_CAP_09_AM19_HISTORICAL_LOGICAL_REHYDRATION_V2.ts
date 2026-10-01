import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const PRODUCER_SHA = "91d2f518efc5c4c7796c398dabd12801949a9289";
const SOURCE_PATH = "scripts/runtime_acceptance/RUN_MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION_V1.ts";
const SOURCE_BLOB = "19c920e863cc9d802f6476a6892d90d2e768894d";
const PROVIDER_HELPER_PATH = "scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py";
const PROVIDER_HELPER_BLOB = "c9bab62c980273ba3669b2bff002d66244916d1b";
const DESCRIPTOR_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM19-HISTORICAL-LOGICAL-EPOCH-V1.json";
const DESCRIPTOR = path.resolve(DESCRIPTOR_PATH);
const REHYDRATION_OUTPUT = path.resolve("acceptance-output/MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION.json");
const VERIFY_OUTPUT = path.resolve("acceptance-output/MCFT_CAP_09_AM19_HISTORICAL_RETAINED_RAW_VERIFY_V1.json");

const SOURCE_EXPIRY_GATE = 'if (Date.parse(candidate.candidate_expires_at) <= Date.now()) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_CANDIDATE_EXPIRED");';
const HISTORICAL_EXPIRY_GATE = 'if (candidate.candidate_expires_at !== process.env.MCFT_CAP09_HISTORICAL_CANDIDATE_EXPIRES_AT) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_HISTORICAL_EXPIRY_BINDING_REQUIRED");';
const SOURCE_MAIN_GATE = 'if (!["push", "workflow_dispatch", "schedule", "workflow_run"].includes(process.env.GITHUB_EVENT_NAME ?? "") || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_SHA !== consumerSha) {\n    throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_EXACT_MAIN_REQUIRED");\n  }';
const CONTROLLED_MAIN_GATE = 'if (String(process.env.GITHUB_ACTIONS ?? "").toLowerCase() === "true" || process.env.GEOX_AM19_HISTORICAL_LOGICAL_EPOCH_ACK !== "true") {\n    throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_CONTROLLED_HISTORICAL_HOST_REQUIRED");\n  }';

function executable(name: string): string {
  return process.platform === "win32" && name === "pnpm" ? "pnpm.cmd" : name;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 }).trim();
}

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`;
}

function exactReplace(source: string, oldValue: string, newValue: string, code: string): string {
  const count = source.split(oldValue).length - 1;
  assert.equal(count, 1, `${code}:${count}`);
  return source.replace(oldValue, newValue);
}

function descriptor(): any {
  const d = readJson(DESCRIPTOR);
  assert.equal(d.schema_version, "geox_mcft_cap09_am19_historical_logical_epoch_v1", "AM19_HISTORICAL_REHYDRATION_DESCRIPTOR_SCHEMA_REQUIRED");
  assert.equal(d.historical_producer.producer_subject_sha, PRODUCER_SHA, "AM19_HISTORICAL_REHYDRATION_PRODUCER_DRIFT");
  assert.equal(d.logical_epoch.target_t, "2026-08-21T19:00:00.000Z", "AM19_HISTORICAL_REHYDRATION_TARGET_DRIFT");
  assert.equal(d.retained_raw_objects.length, 2, "AM19_HISTORICAL_REHYDRATION_TWO_RAW_OBJECTS_REQUIRED");
  assert.equal(d.expected_records.length, 3, "AM19_HISTORICAL_REHYDRATION_THREE_RECORDS_REQUIRED");
  return d;
}

function assertControlledBoundary(repoRoot: string): any {
  assert.notEqual(String(process.env.GITHUB_ACTIONS ?? "").toLowerCase(), "true", "AM19_HISTORICAL_REHYDRATION_GITHUB_ACTIONS_FORBIDDEN");
  const d = descriptor();
  const consumer = String(process.env.MCFT_CAP09_CONSUMER_SUBJECT_SHA ?? "").trim();
  assert.match(consumer, /^[0-9a-f]{40}$/, "AM19_HISTORICAL_REHYDRATION_CONSUMER_SHA_REQUIRED");
  assert.equal(git(repoRoot, "rev-parse", "HEAD"), consumer, "AM19_HISTORICAL_REHYDRATION_HEAD_MISMATCH");
  assert.equal(String(process.env.MCFT_CAP09_ROLLING_PRODUCER_SUBJECT_SHA ?? ""), d.historical_producer.producer_subject_sha, "AM19_HISTORICAL_REHYDRATION_PRODUCER_ENV_MISMATCH");
  const candidatePath = path.resolve(String(process.env.MCFT_CAP09_ROLLING_CANDIDATE_PATH ?? ""));
  assert(fs.existsSync(candidatePath), "AM19_HISTORICAL_REHYDRATION_CANDIDATE_REQUIRED");
  const candidate = readJson(candidatePath);
  assert.equal(candidate.producer_subject_sha, d.historical_producer.producer_subject_sha, "AM19_HISTORICAL_REHYDRATION_CANDIDATE_PRODUCER_MISMATCH");
  assert.equal(candidate.target_t, d.logical_epoch.target_t, "AM19_HISTORICAL_REHYDRATION_CANDIDATE_TARGET_MISMATCH");
  assert.equal(candidate.candidate_expires_at, d.logical_epoch.original_candidate_expires_at, "AM19_HISTORICAL_REHYDRATION_CANDIDATE_EXPIRY_PROVENANCE_MISMATCH");
  assert.equal(candidate.semantic_manifest_digest, d.logical_epoch.semantic_manifest_digest, "AM19_HISTORICAL_REHYDRATION_SEMANTIC_MANIFEST_MISMATCH");
  assert.equal(git(repoRoot, "rev-parse", `${PRODUCER_SHA}:${SOURCE_PATH}`), SOURCE_BLOB, "AM19_HISTORICAL_REHYDRATION_PRODUCER_SOURCE_BLOB_DRIFT");
  assert.equal(git(repoRoot, "rev-parse", `${PRODUCER_SHA}:${PROVIDER_HELPER_PATH}`), PROVIDER_HELPER_BLOB, "AM19_HISTORICAL_REHYDRATION_PRODUCER_HELPER_BLOB_DRIFT");
  return d;
}

type HistoricalWorkspace = {
  tempRoot: string;
  worktree: string;
  generated: string;
  nodeModulesLink: string;
};

function prepareHistoricalWorkspace(repoRoot: string): HistoricalWorkspace {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "geox-am19-producer-worktree-"));
  const worktree = path.join(tempRoot, "repo");
  execFileSync("git", ["worktree", "add", "--detach", "--force", worktree, PRODUCER_SHA], { cwd: repoRoot, stdio: "ignore", windowsHide: true });
  assert.equal(git(worktree, "rev-parse", "HEAD"), PRODUCER_SHA, "AM19_HISTORICAL_REHYDRATION_WORKTREE_HEAD_REQUIRED");
  assert.equal(git(worktree, "status", "--porcelain"), "", "AM19_HISTORICAL_REHYDRATION_WORKTREE_MUST_START_CLEAN");

  const currentNodeModules = path.join(repoRoot, "node_modules");
  assert(fs.existsSync(currentNodeModules), "AM19_HISTORICAL_REHYDRATION_NODE_MODULES_REQUIRED");
  const nodeModulesLink = path.join(worktree, "node_modules");
  fs.symlinkSync(currentNodeModules, nodeModulesLink, process.platform === "win32" ? "junction" : "dir");

  const source = fs.readFileSync(path.join(worktree, SOURCE_PATH), "utf8");
  let generatedText = exactReplace(source, SOURCE_EXPIRY_GATE, HISTORICAL_EXPIRY_GATE, "AM19_HISTORICAL_REHYDRATION_EXPIRY_GATE_CARDINALITY");
  generatedText = exactReplace(generatedText, SOURCE_MAIN_GATE, CONTROLLED_MAIN_GATE, "AM19_HISTORICAL_REHYDRATION_MAIN_GATE_CARDINALITY");
  assert(!generatedText.includes(SOURCE_EXPIRY_GATE), "AM19_HISTORICAL_REHYDRATION_SOURCE_EXPIRY_GATE_SURVIVED");
  assert(!generatedText.includes(SOURCE_MAIN_GATE), "AM19_HISTORICAL_REHYDRATION_SOURCE_MAIN_GATE_SURVIVED");

  const generated = path.join(worktree, "scripts", "runtime_acceptance", ".generated_RUN_MCFT_CAP_09_AM19_HISTORICAL_LOGICAL_REHYDRATION_V2.ts");
  fs.writeFileSync(generated, generatedText, { flag: "wx" });
  return { tempRoot, worktree, generated, nodeModulesLink };
}

function cleanupHistoricalWorkspace(repoRoot: string, ws: HistoricalWorkspace): void {
  try {
    if (fs.existsSync(ws.nodeModulesLink)) fs.unlinkSync(ws.nodeModulesLink);
  } catch {}
  try {
    execFileSync("git", ["worktree", "remove", "--force", ws.worktree], { cwd: repoRoot, stdio: "ignore", windowsHide: true });
  } catch {
    try { fs.rmSync(ws.worktree, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }); } catch {}
  }
  try { execFileSync("git", ["worktree", "prune"], { cwd: repoRoot, stdio: "ignore", windowsHide: true }); } catch {}
  try { fs.rmSync(ws.tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }); } catch {}
}

function childEnv(d: any): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GEOX_AM19_HISTORICAL_LOGICAL_EPOCH_ACK: "true",
    MCFT_CAP09_HISTORICAL_CANDIDATE_EXPIRES_AT: d.logical_epoch.original_candidate_expires_at,
  };
}

function executeHistoricalSource(ws: HistoricalWorkspace, d: any, mode: "selftest" | "run"): void {
  execFileSync(executable("pnpm"), ["exec", "tsx", ws.generated, mode], {
    cwd: ws.worktree,
    stdio: "inherit",
    env: childEnv(d),
    windowsHide: true,
  });
}

function publishRunEvidence(ws: HistoricalWorkspace, d: any): void {
  const historicalOutput = path.join(ws.worktree, "acceptance-output", "MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION.json");
  assert(fs.existsSync(historicalOutput), "AM19_HISTORICAL_REHYDRATION_WORKTREE_OUTPUT_REQUIRED");
  assert(!fs.existsSync(REHYDRATION_OUTPUT), "AM19_HISTORICAL_REHYDRATION_OUTPUT_PREEXISTING_FORBIDDEN");
  assert(!fs.existsSync(VERIFY_OUTPUT), "AM19_HISTORICAL_RETAINED_RAW_VERIFY_OUTPUT_PREEXISTING_FORBIDDEN");
  fs.mkdirSync(path.dirname(REHYDRATION_OUTPUT), { recursive: true });
  fs.copyFileSync(historicalOutput, REHYDRATION_OUTPUT, fs.constants.COPYFILE_EXCL);

  const r = readJson(REHYDRATION_OUTPUT);
  assert.equal(r.status, "PASS", "AM19_HISTORICAL_RETAINED_RAW_REHYDRATION_PASS_REQUIRED");
  assert.equal(r.producer_subject_sha, d.historical_producer.producer_subject_sha, "AM19_HISTORICAL_RETAINED_RAW_PRODUCER_MISMATCH");
  assert.equal(r.target_t, d.logical_epoch.target_t, "AM19_HISTORICAL_RETAINED_RAW_TARGET_MISMATCH");
  assert.equal(r.semantic_manifest_match, true, "AM19_HISTORICAL_RETAINED_RAW_SEMANTIC_MATCH_REQUIRED");
  assert.equal(r.producer_bound_raw_reverification, true, "AM19_HISTORICAL_RETAINED_RAW_REVERIFICATION_REQUIRED");
  assert.equal(r.producer_dataset_identity_preserved, true, "AM19_HISTORICAL_RETAINED_RAW_DATASET_IDENTITY_REQUIRED");
  assert.equal(r.producer_decoder_identity_preserved, true, "AM19_HISTORICAL_RETAINED_RAW_DECODER_IDENTITY_REQUIRED");
  assert.equal(r.provider_refetch_count, 0, "AM19_HISTORICAL_RETAINED_RAW_PROVIDER_REFETCH_FORBIDDEN");
  assert.equal(r.private_r2_get_count, 2, "AM19_HISTORICAL_RETAINED_RAW_EXACT_TWO_GETS_REQUIRED");
  assert.equal(r.private_r2_put_count, 0, "AM19_HISTORICAL_RETAINED_RAW_PUT_FORBIDDEN");
  assert.equal(r.private_r2_delete_count, 0, "AM19_HISTORICAL_RETAINED_RAW_DELETE_FORBIDDEN");
  assert.equal(r.formal_database_write_count, 0, "AM19_HISTORICAL_RETAINED_RAW_FORMAL_DB_WRITE_FORBIDDEN");
  assert.equal(r.runtime_write_count, 0, "AM19_HISTORICAL_RETAINED_RAW_RUNTIME_WRITE_FORBIDDEN");
  assert.equal(r.scheduler_write_count, 0, "AM19_HISTORICAL_RETAINED_RAW_SCHEDULER_WRITE_FORBIDDEN");

  const out = {
    schema_version: "geox_mcft_cap09_am19_historical_retained_raw_verify_v2",
    status: "PASS",
    historical_logical_epoch_id: d.epoch_id,
    producer_subject_sha: d.historical_producer.producer_subject_sha,
    producer_worktree_head_sha: PRODUCER_SHA,
    producer_repository_source_closure: "DETACHED_EXACT_PRODUCER_GIT_WORKTREE",
    source_gate_replacements: ["CURRENT_EXPIRY_TO_HISTORICAL_EXPIRY_PROVENANCE", "GITHUB_EXACT_MAIN_TO_CONTROLLED_HISTORICAL_HOST"],
    source_gate_replacement_count: 2,
    producer_rehydration_source_blob_sha: SOURCE_BLOB,
    producer_provider_helper_blob_sha: PROVIDER_HELPER_BLOB,
    producer_decoder_identity_preserved: true,
    producer_repository_dependency_closure_preserved: true,
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
  fs.writeFileSync(VERIFY_OUTPUT, `${JSON.stringify(out, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify(out));
}

function selftest(): void {
  const repoRoot = git(process.cwd(), "rev-parse", "--show-toplevel");
  const d = assertControlledBoundary(repoRoot);
  const ws = prepareHistoricalWorkspace(repoRoot);
  try {
    executeHistoricalSource(ws, d, "selftest");
    console.log(JSON.stringify({
      status: "PASS",
      producer_worktree_head_sha: PRODUCER_SHA,
      producer_repository_source_closure: "DETACHED_EXACT_PRODUCER_GIT_WORKTREE",
      producer_rehydration_source_blob: SOURCE_BLOB,
      producer_provider_helper_blob: PROVIDER_HELPER_BLOB,
      source_gate_replacement_count: 2,
      historical_expiry_is_provenance_not_current_admission: true,
      database_access: false,
      provider_access: false,
    }));
  } finally {
    cleanupHistoricalWorkspace(repoRoot, ws);
  }
}

function run(): void {
  const repoRoot = git(process.cwd(), "rev-parse", "--show-toplevel");
  const d = assertControlledBoundary(repoRoot);
  const ws = prepareHistoricalWorkspace(repoRoot);
  try {
    executeHistoricalSource(ws, d, "selftest");
    executeHistoricalSource(ws, d, "run");
    publishRunEvidence(ws, d);
  } finally {
    cleanupHistoricalWorkspace(repoRoot, ws);
  }
}

const mode = process.argv[2] ?? "";
if (mode === "selftest") selftest();
else if (mode === "run") run();
else throw new Error("AM19_HISTORICAL_REHYDRATION_MODE_REQUIRED");
