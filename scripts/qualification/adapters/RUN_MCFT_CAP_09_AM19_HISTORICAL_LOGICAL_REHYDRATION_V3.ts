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
const EA4_PATH = "scripts/runtime_acceptance/PROBE_MCFT_CAP_09_EA4_LIVE_SOURCE_EXACT_HEAD_QUALIFICATION.py";
const EA4_BLOB = "ff2ad210387402a74731968e14746210fd2440dd";
const BRIDGE_REF = "scripts/qualification/materializers/MATERIALIZE_MCFT_CAP09_WINDOWS_ECCODES_FILE_HANDLE_BRIDGE_V1.cjs";
const BRIDGE_BLOB = "0b27faec66030c14c246867accba79ac4cfc579d";
const BRIDGE_TRANSFORM_ID = "WINDOWS_ECCODES_NAMED_TEMPFILE_REOPEN_FILE_POINTER_BRIDGE_V1";
const BRIDGE_SCOPE = "QUALIFICATION_LOCAL_FILE_HANDLE_IO_ONLY";
const GENERATED_HELPER_REL = "scripts/runtime_acceptance/.generated_MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE_HISTORICAL_V5_WINDOWS_BRIDGE.py";
const DESCRIPTOR_PATH = "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-AM19-HISTORICAL-LOGICAL-EPOCH-V1.json";
const DESCRIPTOR = path.resolve(DESCRIPTOR_PATH);
const REHYDRATION_OUTPUT = path.resolve("acceptance-output/MCFT_CAP_09_ROLLING_PREBOUNDARY_REHYDRATION.json");
const VERIFY_OUTPUT = path.resolve("acceptance-output/MCFT_CAP_09_AM19_HISTORICAL_RETAINED_RAW_VERIFY_V1.json");

const SOURCE_EXPIRY_GATE = 'if (Date.parse(candidate.candidate_expires_at) <= Date.now()) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_CANDIDATE_EXPIRED");';
const HISTORICAL_EXPIRY_GATE = 'if (candidate.candidate_expires_at !== process.env.MCFT_CAP09_HISTORICAL_CANDIDATE_EXPIRES_AT) throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_HISTORICAL_EXPIRY_BINDING_REQUIRED");';
const SOURCE_MAIN_GATE = 'if (!["push", "workflow_dispatch", "schedule", "workflow_run"].includes(process.env.GITHUB_EVENT_NAME ?? "") || process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_SHA !== consumerSha) {\n    throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_EXACT_MAIN_REQUIRED");\n  }';
const CONTROLLED_MAIN_GATE = 'if (String(process.env.GITHUB_ACTIONS ?? "").toLowerCase() === "true" || process.env.GEOX_AM19_HISTORICAL_LOGICAL_EPOCH_ACK !== "true") {\n    throw new Error("MCFT_CAP09_ROLLING_REHYDRATION_CONTROLLED_HISTORICAL_HOST_REQUIRED");\n  }';
const SOURCE_PROVIDER_BINDING = 'const PROVIDER_SCRIPT = path.resolve("scripts/runtime_acceptance/MCFT_CAP_09_EA5E2_LIVE_PROVIDER_TWO_PHASE.py");';
const BRIDGE_PROVIDER_BINDING = `const PROVIDER_SCRIPT = path.resolve("${GENERATED_HELPER_REL}");`;

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
  assert.equal(git(repoRoot, "rev-parse", `${PRODUCER_SHA}:${EA4_PATH}`), EA4_BLOB, "AM19_HISTORICAL_REHYDRATION_PRODUCER_EA4_BLOB_DRIFT");
  assert.equal(git(repoRoot, "rev-parse", `HEAD:${BRIDGE_REF}`), BRIDGE_BLOB, "AM19_HISTORICAL_REHYDRATION_BRIDGE_BLOB_DRIFT");
  return d;
}

type BridgeMaterialization = {
  status: string;
  transform_id: string;
  bridge_scope: string;
  historical_provider_helper_blob_sha: string;
  historical_ea4_dependency_blob_sha: string;
  materialized_historical_provider_helper_blob_sha: string;
  materialized_historical_ea4_dependency_blob_sha: string;
  generated_provider_helper_path: string;
  generated_ea4_path: string;
  windows_file_handle_bridge_applied: boolean;
  provider_fetch_logic_changed: boolean;
  provider_decode_semantic_guards_changed: boolean;
  target_mismatch_guard_relaxed: boolean;
  runtime_semantic_mutation: boolean;
  production_mutation: boolean;
};

type HistoricalWorkspace = {
  tempRoot: string;
  worktree: string;
  generated: string;
  nodeModulesLink: string;
  bridge: BridgeMaterialization;
  fileHandleSmokeExecuted: boolean;
};

function materializeBridge(repoRoot: string, worktree: string): BridgeMaterialization {
  const raw = execFileSync(process.execPath, [BRIDGE_REF, "materialize", "--workspace", worktree], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  const bridge = JSON.parse(raw) as BridgeMaterialization;
  assert.equal(bridge.status, "PASS", "AM19_HISTORICAL_REHYDRATION_BRIDGE_MATERIALIZATION_PASS_REQUIRED");
  assert.equal(bridge.transform_id, BRIDGE_TRANSFORM_ID, "AM19_HISTORICAL_REHYDRATION_BRIDGE_TRANSFORM_ID_REQUIRED");
  assert.equal(bridge.bridge_scope, BRIDGE_SCOPE, "AM19_HISTORICAL_REHYDRATION_BRIDGE_SCOPE_REQUIRED");
  assert.equal(bridge.historical_provider_helper_blob_sha, PROVIDER_HELPER_BLOB, "AM19_HISTORICAL_REHYDRATION_BRIDGE_HELPER_AUTHORITY_DRIFT");
  assert.equal(bridge.historical_ea4_dependency_blob_sha, EA4_BLOB, "AM19_HISTORICAL_REHYDRATION_BRIDGE_EA4_AUTHORITY_DRIFT");
  assert.equal(bridge.materialized_historical_provider_helper_blob_sha, PROVIDER_HELPER_BLOB, "AM19_HISTORICAL_REHYDRATION_BRIDGE_HELPER_MATERIALIZATION_DRIFT");
  assert.equal(bridge.materialized_historical_ea4_dependency_blob_sha, EA4_BLOB, "AM19_HISTORICAL_REHYDRATION_BRIDGE_EA4_MATERIALIZATION_DRIFT");
  assert.equal(bridge.provider_fetch_logic_changed, false, "AM19_HISTORICAL_REHYDRATION_BRIDGE_PROVIDER_FETCH_DRIFT");
  assert.equal(bridge.provider_decode_semantic_guards_changed, false, "AM19_HISTORICAL_REHYDRATION_BRIDGE_DECODER_GUARD_DRIFT");
  assert.equal(bridge.target_mismatch_guard_relaxed, false, "AM19_HISTORICAL_REHYDRATION_BRIDGE_TARGET_GUARD_RELAXED");
  assert.equal(bridge.runtime_semantic_mutation, false, "AM19_HISTORICAL_REHYDRATION_BRIDGE_RUNTIME_MUTATION_FORBIDDEN");
  assert.equal(bridge.production_mutation, false, "AM19_HISTORICAL_REHYDRATION_BRIDGE_PRODUCTION_MUTATION_FORBIDDEN");
  return bridge;
}

function smokeBridge(repoRoot: string, bridge: BridgeMaterialization): boolean {
  const python = String(process.env.PYTHON ?? "").trim();
  if (!python) return false;
  const raw = execFileSync(process.execPath, [BRIDGE_REF, "smoke", "--python", python, "--ea4", bridge.generated_ea4_path], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  const smoke = JSON.parse(raw);
  assert.equal(smoke.status, "PASS", "AM19_HISTORICAL_REHYDRATION_BRIDGE_SMOKE_PASS_REQUIRED");
  assert.equal(smoke.provider_request_count, 0, "AM19_HISTORICAL_REHYDRATION_BRIDGE_SMOKE_PROVIDER_REQUEST_FORBIDDEN");
  assert.equal(smoke.runtime_mutation, false, "AM19_HISTORICAL_REHYDRATION_BRIDGE_SMOKE_RUNTIME_MUTATION_FORBIDDEN");
  assert.equal(smoke.production_mutation, false, "AM19_HISTORICAL_REHYDRATION_BRIDGE_SMOKE_PRODUCTION_MUTATION_FORBIDDEN");
  return true;
}

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

  const bridge = materializeBridge(repoRoot, worktree);
  const fileHandleSmokeExecuted = smokeBridge(repoRoot, bridge);

  const source = fs.readFileSync(path.join(worktree, SOURCE_PATH), "utf8");
  let generatedText = exactReplace(source, SOURCE_EXPIRY_GATE, HISTORICAL_EXPIRY_GATE, "AM19_HISTORICAL_REHYDRATION_EXPIRY_GATE_CARDINALITY");
  generatedText = exactReplace(generatedText, SOURCE_MAIN_GATE, CONTROLLED_MAIN_GATE, "AM19_HISTORICAL_REHYDRATION_MAIN_GATE_CARDINALITY");
  generatedText = exactReplace(generatedText, SOURCE_PROVIDER_BINDING, BRIDGE_PROVIDER_BINDING, "AM19_HISTORICAL_REHYDRATION_PROVIDER_BRIDGE_BINDING_CARDINALITY");
  assert(!generatedText.includes(SOURCE_EXPIRY_GATE), "AM19_HISTORICAL_REHYDRATION_SOURCE_EXPIRY_GATE_SURVIVED");
  assert(!generatedText.includes(SOURCE_MAIN_GATE), "AM19_HISTORICAL_REHYDRATION_SOURCE_MAIN_GATE_SURVIVED");
  assert(!generatedText.includes(SOURCE_PROVIDER_BINDING), "AM19_HISTORICAL_REHYDRATION_SOURCE_PROVIDER_BINDING_SURVIVED");

  const generated = path.join(worktree, "scripts", "runtime_acceptance", ".generated_RUN_MCFT_CAP_09_AM19_HISTORICAL_LOGICAL_REHYDRATION_V3.ts");
  fs.writeFileSync(generated, generatedText, { flag: "wx" });
  return { tempRoot, worktree, generated, nodeModulesLink, bridge, fileHandleSmokeExecuted };
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
    schema_version: "geox_mcft_cap09_am19_historical_retained_raw_verify_v3",
    status: "PASS",
    historical_logical_epoch_id: d.epoch_id,
    producer_subject_sha: d.historical_producer.producer_subject_sha,
    producer_worktree_head_sha: PRODUCER_SHA,
    producer_repository_source_closure: "DETACHED_EXACT_PRODUCER_GIT_WORKTREE_PLUS_DECLARED_QUALIFICATION_LOCAL_FILE_HANDLE_BRIDGE",
    source_gate_replacements: [
      "CURRENT_EXPIRY_TO_HISTORICAL_EXPIRY_PROVENANCE",
      "GITHUB_EXACT_MAIN_TO_CONTROLLED_HISTORICAL_HOST",
      "PROVIDER_HELPER_TO_DECLARED_WINDOWS_FILE_HANDLE_BRIDGE_COMPAT"
    ],
    source_gate_replacement_count: 3,
    producer_rehydration_source_blob_sha: SOURCE_BLOB,
    producer_provider_helper_blob_sha: PROVIDER_HELPER_BLOB,
    producer_ea4_dependency_blob_sha: EA4_BLOB,
    producer_decoder_identity_preserved: true,
    producer_decoder_semantic_guards_preserved: true,
    producer_repository_dependency_closure_preserved: true,
    host_compatibility_bridge_ref: BRIDGE_REF,
    host_compatibility_bridge_blob_sha: BRIDGE_BLOB,
    host_compatibility_transform_id: BRIDGE_TRANSFORM_ID,
    host_compatibility_scope: BRIDGE_SCOPE,
    windows_file_handle_bridge_applied: ws.bridge.windows_file_handle_bridge_applied,
    file_handle_smoke_executed: ws.fileHandleSmokeExecuted,
    provider_fetch_logic_changed: false,
    target_mismatch_guard_relaxed: false,
    runtime_semantic_mutation: false,
    production_mutation: false,
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
      producer_repository_source_closure: "DETACHED_EXACT_PRODUCER_GIT_WORKTREE_PLUS_DECLARED_QUALIFICATION_LOCAL_FILE_HANDLE_BRIDGE",
      producer_rehydration_source_blob: SOURCE_BLOB,
      producer_provider_helper_blob: PROVIDER_HELPER_BLOB,
      producer_ea4_dependency_blob: EA4_BLOB,
      source_gate_replacement_count: 3,
      host_compatibility_bridge_ref: BRIDGE_REF,
      host_compatibility_bridge_blob_sha: BRIDGE_BLOB,
      host_compatibility_transform_id: BRIDGE_TRANSFORM_ID,
      host_compatibility_scope: BRIDGE_SCOPE,
      windows_file_handle_bridge_applied: ws.bridge.windows_file_handle_bridge_applied,
      file_handle_smoke_executed: ws.fileHandleSmokeExecuted,
      provider_fetch_logic_changed: false,
      provider_decode_semantic_guards_changed: false,
      target_mismatch_guard_relaxed: false,
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
    assert.equal(ws.fileHandleSmokeExecuted, true, "AM19_HISTORICAL_REHYDRATION_FILE_HANDLE_SMOKE_REQUIRED_FOR_RUN");
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
