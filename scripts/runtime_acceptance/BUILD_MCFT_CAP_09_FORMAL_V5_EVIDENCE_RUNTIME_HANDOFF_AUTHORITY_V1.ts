import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1,
} from "../../apps/server/src/runtime/mcft_cap09_production_runtime_start_authority_v1.js";
import {
  MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_AUTHORITY_ID_V1,
  MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_SCHEMA_V1,
  parseMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1,
} from "../../apps/server/src/runtime/mcft_cap09_formal_v5_evidence_runtime_handoff_authority_v1.js";
import {
  validateMcftCap09FormalV5ArmV1,
  type McftCap09FormalV5ArmV1,
} from "./mcft_cap09_formal_v5_manifest_from_stage_authority_v1.js";

const ROOT = process.cwd();
const DEFAULT_RUNTIME_START = path.join(os.homedir(), ".geox", "mcft-cap09", "runtime", "runtime-start-authority.json");
const DEFAULT_ARM = path.join(os.homedir(), ".geox", "mcft-cap09", "formal-v5", "arm-v1.json");
const DEFAULT_OUT = path.join(os.homedir(), ".geox", "mcft-cap09", "runtime", "formal-v5-evidence-runtime-handoff-authority.json");

function arg(name: string): string | null {
  const row = process.argv.slice(2).find((value) => value.startsWith(name + "="));
  return row ? row.slice(name.length + 1) : null;
}
function has(name: string): boolean {
  return process.argv.slice(2).includes(name);
}
function readJson(file: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, any>;
}
function digestFile(file: string): string {
  return "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}
function exactIso(value: unknown, code: string): string {
  const text = String(value ?? "").trim();
  const parsed = Date.parse(text);
  if (!text || !Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}
function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function write(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}
function scopeFrom(value: Record<string, any>): {
  tenant_id: string; project_id: string; group_id: string; field_id: string; season_id: string; zone_id: string;
} {
  const scope = value.scope as Record<string, unknown> | undefined;
  if (!scope) throw new Error("FORMAL_V5_EVIDENCE_HANDOFF_BASE_SCOPE_REQUIRED");
  const out = {
    tenant_id: String(scope.tenant_id ?? "").trim(),
    project_id: String(scope.project_id ?? "").trim(),
    group_id: String(scope.group_id ?? "").trim(),
    field_id: String(scope.field_id ?? "").trim(),
    season_id: String(scope.season_id ?? "").trim(),
    zone_id: String(scope.zone_id ?? "").trim(),
  };
  if (Object.values(out).some((v) => !v)) throw new Error("FORMAL_V5_EVIDENCE_HANDOFF_BASE_SCOPE_INVALID");
  return out;
}

function build(input: {
  arm: McftCap09FormalV5ArmV1;
  armPath: string;
  base: Record<string, any>;
  basePath: string;
  activationFence: string;
}): Record<string, unknown> {
  const subject = input.arm.subject_sha;
  const scope = scopeFrom(input.base);
  parseMcftCap09ProductionRuntimeStartAuthorityForPlaneV1(
    input.base,
    "EVIDENCE_RUNTIME",
    { deployment_subject_sha: subject, scope },
  );
  if (input.base.runtime_mode !== "OWNER_CUTOVER") {
    throw new Error("FORMAL_V5_EVIDENCE_HANDOFF_BASE_OWNER_MODE_REQUIRED");
  }

  const armTime = exactIso(input.arm.arm_time_database_utc, "FORMAL_V5_EVIDENCE_HANDOFF_ARM_TIME_INVALID");
  const a0 = exactIso(input.arm.a0, "FORMAL_V5_EVIDENCE_HANDOFF_A0_INVALID");
  const activationFence = exactIso(input.activationFence, "FORMAL_V5_EVIDENCE_HANDOFF_FENCE_INVALID");
  if (Date.parse(activationFence) < Date.parse(armTime)) {
    throw new Error("FORMAL_V5_EVIDENCE_HANDOFF_BEFORE_ARM_FORBIDDEN");
  }
  if (Date.parse(activationFence) >= Date.parse(a0)) {
    throw new Error("FORMAL_V5_EVIDENCE_HANDOFF_FENCE_MUST_PRECEDE_A0");
  }

  const hostId = String(input.base.host_id ?? "").trim();
  if (!hostId) throw new Error("FORMAL_V5_EVIDENCE_HANDOFF_HOST_ID_REQUIRED");

  const authority = {
    schema_version: MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_SCHEMA_V1,
    authority_id: MCFT_CAP09_FORMAL_V5_EVIDENCE_RUNTIME_HANDOFF_AUTHORITY_ID_V1,
    status: "AUTHORIZED",
    armed: true,
    authority_ref: `local-operator://${hostId}/mcft-cap09/formal-v5/evidence-runtime-handoff/${subject}/${input.arm.epoch_id}`,
    deployment_subject_sha: subject,
    scope,
    activation_fence_time: activationFence,
    formal_a0_logical_time: input.arm.a0,
    formal_v5_arm_ref: input.arm.manifest_ref,
    formal_v5_arm_artifact_sha256: digestFile(input.armPath),
    formal_v5_arm_identity_hash: input.arm.arm_identity_hash,
    formal_v5_arm_time: input.arm.arm_time_database_utc,
    base_runtime_start_authority_ref: String(input.base.authority_ref ?? ""),
    base_runtime_start_authority_sha256: digestFile(input.basePath),
    lineage_current_crop_authority_ref: String(input.base.current_crop_authority_ref ?? ""),
    lineage_current_crop_authority_sha256: String(input.base.current_crop_authority_sha256 ?? ""),
    evidence_runtime_planning_handoff_authorized: true,
    runtime_process_start_authorized: false,
    twin_runtime_start_authorized: false,
    production_owner_activation_authorized: false,
    formal_v5_arm_authorized: false,
    a0_authorized: false,
    o00_authorized: false,
    stage_authority_required_for_evidence_acquisition: false,
    future_stage_pins_frozen: false,
    current_crop_authority_promoted: false,
    formal_database_mutation_authorized: false,
    formal_raw_write_authorized: false,
    runtime_config_write_authorized: false,
    scheduler_write_authorized: false,
  };

  parseMcftCap09FormalV5EvidenceRuntimeHandoffAuthorityV1(authority, {
    deployment_subject_sha: subject,
    scope,
    base_runtime_start_authority_sha256: authority.base_runtime_start_authority_sha256,
    admission_time_utc: activationFence,
  });
  return authority;
}

function selftest(): void {
  const subject = "a".repeat(40);
  const scope = {
    tenant_id: "tenant", project_id: "project", group_id: "group",
    field_id: "field", season_id: "season", zone_id: "zone",
  };
  const base = {
    schema_version: "geox_mcft_cap09_production_runtime_start_authority_instance_v1",
    authority_id: "GEOX-MCFT-CAP-09-PRODUCTION-RUNTIME-START-AUTHORITY-INSTANCE-V1",
    armed: true,
    status: "AUTHORIZED",
    authority_class: "MCFT_CAP09_SEPARATE_PRODUCTION_RUNTIME_START_AUTHORITY",
    authority_ref: "fixture://base",
    deployment_subject_sha: subject,
    scope,
    activation_fence_time: "2099-09-01T00:00:00.000Z",
    formal_a0_authority_ref: "fixture://preformal-a0",
    formal_a0_authority_sha256: "sha256:" + "1".repeat(64),
    live_activation_authority_ref: "fixture://live",
    live_activation_authority_sha256: "sha256:" + "2".repeat(64),
    current_crop_authority_ref: "fixture://crop",
    current_crop_authority_sha256: "sha256:" + "3".repeat(64),
    biological_stage_architecture_effectiveness_ref: "fixture://stage",
    biological_stage_architecture_effectiveness_sha256: "sha256:" + "4".repeat(64),
    formal_a0_logical_time: "2099-09-01T02:00:00.000Z",
    runtime_process_start_authorized: true,
    evidence_runtime_start_authorized: true,
    twin_runtime_start_authorized: true,
    production_owner_activation_authorized: false,
    formal_v5_arm_authorized: false,
    a0_authorized: false,
    o00_authorized: false,
    runtime_mode: "OWNER_CUTOVER",
    host_id: "fae5f756-ef25-40d5-9777-5b2c3d4837a1",
  };
  const basePath = path.join(os.tmpdir(), "mcft-cap09-handoff-selftest-base.json");
  const armPath = path.join(os.tmpdir(), "mcft-cap09-handoff-selftest-arm.json");
  write(basePath, base);
  const arm = {
    schema_version: "geox_mcft_cap09_formal_v5_arm_v1",
    status: "PASS",
    subject_sha: subject,
    formal_database_name: "geox_mcft_cap09_s6_formal_t4r1_24h_v5",
    formal_v5_arm: true,
    formal_v5_epoch_selected: true,
    formal_database_mutation: false,
    schema_materialization: false,
    a0_bootstrap: false,
    o00_started: false,
    provider_request_count: 0,
    final_actual_24h_still_required: true,
    mcft_cap09_completed: false,
    epoch_id: "fixture-epoch",
    a0: "2099-09-02T05:00:00.000Z",
    o00: "2099-09-02T06:00:00.000Z",
    o23: "2099-09-03T05:00:00.000Z",
    arm_time_database_utc: "2099-09-01T12:00:00.000Z",
    readiness_deadline: "2099-09-01T18:00:00.000Z",
    manifest_ref: "formal-arm://mcft-cap09/formal-v5/fixture-epoch/geox_mcft_cap09_s6_formal_t4r1_24h_v5",
    arm_identity_hash: "sha256:" + "5".repeat(64),
  } as McftCap09FormalV5ArmV1;
  write(armPath, arm);
  validateMcftCap09FormalV5ArmV1(arm, subject);
  const built = build({
    arm, armPath, base, basePath,
    activationFence: "2099-09-01T12:01:00.000Z",
  });
  assert.equal(built.formal_a0_logical_time, arm.a0);
  assert.equal(built.stage_authority_required_for_evidence_acquisition, false);
  assert.equal(built.a0_authorized, false);
  assert.equal(built.o00_authorized, false);
  fs.rmSync(basePath, { force: true });
  fs.rmSync(armPath, { force: true });
  console.log(JSON.stringify({
    schema_version: "geox_mcft_cap09_formal_v5_evidence_runtime_handoff_builder_selftest_v1",
    status: "PASS",
    actual_formal_a0_clock_consumed: true,
    current_crop_validity_not_promoted_to_acquisition_clock: true,
    stage_pins_frozen: false,
    a0_authorized: false,
    o00_authorized: false,
    production_effect: false,
  }, null, 2));
}

function main(): void {
  if (has("--selftest")) {
    selftest();
    return;
  }
  if (process.env.GITHUB_ACTIONS || process.env.CI) {
    throw new Error("FORMAL_V5_EVIDENCE_HANDOFF_REAL_BUILD_LOCAL_ONLY");
  }

  git("fetch", "--no-tags", "origin", "main");
  const head = git("rev-parse", "HEAD");
  const mainSha = git("rev-parse", "origin/main");
  assert.equal(head, mainSha, "FORMAL_V5_EVIDENCE_HANDOFF_HEAD_MUST_EQUAL_CURRENT_MAIN");
  assert.equal(git("status", "--porcelain"), "", "FORMAL_V5_EVIDENCE_HANDOFF_WORKTREE_MUST_BE_CLEAN");

  const armPath = path.resolve(arg("--arm") ?? DEFAULT_ARM);
  const basePath = path.resolve(arg("--runtime-start") ?? DEFAULT_RUNTIME_START);
  const outPath = path.resolve(arg("--out") ?? DEFAULT_OUT);
  if (!fs.existsSync(armPath)) throw new Error("FORMAL_V5_EVIDENCE_HANDOFF_ARM_REQUIRED");
  if (!fs.existsSync(basePath)) throw new Error("FORMAL_V5_EVIDENCE_HANDOFF_BASE_RUNTIME_START_REQUIRED");

  const armRaw = readJson(armPath);
  validateMcftCap09FormalV5ArmV1(armRaw, head);
  const arm = armRaw as unknown as McftCap09FormalV5ArmV1;
  const base = readJson(basePath);
  const activationFence = arg("--activation-fence") ?? new Date().toISOString();
  const authority = build({ arm, armPath, base, basePath, activationFence });
  write(outPath, authority);
  console.log(JSON.stringify({
    status: "PASS",
    output_path: outPath,
    deployment_subject_sha: head,
    activation_fence_time: authority.activation_fence_time,
    formal_a0_logical_time: authority.formal_a0_logical_time,
    formal_v5_arm_ref: authority.formal_v5_arm_ref,
    evidence_runtime_planning_handoff_authorized: true,
    stage_authority_required_for_evidence_acquisition: false,
    runtime_process_start_authorized: false,
    a0_authorized: false,
    o00_authorized: false,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
}
