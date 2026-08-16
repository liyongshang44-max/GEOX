import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import {
  buildExternalFormalPrewindowAuthorityBundleV2,
  MCFT_CAP09_A18_CONFIG_AUTHORITY_CREATED_AT_V2,
  MCFT_CAP09_A18_PREWINDOW_A0_LOGICAL_TIME_V2,
} from "../../apps/server/src/domain/twin_runtime/external_formal_prewindow_authority_bundle_v2.js";
import {
  MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V2,
  materializeExternalFormalA18CropContextV2,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_a18_crop_context_v2.js";
import {
  EXTERNAL_FORMAL_V3_A18_RUNNER_ID_V1,
  ExternalFormalV3Amendment11RunnerV1,
  type ExternalFormalV3A18WindowManifestV1,
} from "../../apps/server/src/runtime/twin_runtime/external_formal_v3_amendment11_runner_v1.js";
import type { ShadowOnlineBoundaryV1, ShadowOnlineSlotClaimV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const A18B_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A18B-PREWINDOW-A0-AND-REPLACEMENT-RUNTIME-CONFIG-CHAIN-V1.json");
const SELECTION_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json");
const CROP_AUTHORITY_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json");
const MATRIX_PATH = path.resolve("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json");
const OUT = path.resolve("acceptance-output/MCFT_CAP_09_A18C_MANIFEST_RUNNER_CALIBRATION_RESULT.json");

const a18b = JSON.parse(fs.readFileSync(A18B_PATH, "utf8"));
const selection = JSON.parse(fs.readFileSync(SELECTION_PATH, "utf8"));
const cropAuthority = JSON.parse(fs.readFileSync(CROP_AUTHORITY_PATH, "utf8"));
const matrix = JSON.parse(fs.readFileSync(MATRIX_PATH, "utf8"));
const selectedSlots = selection.slot_contexts as Array<{
  slot_id: string;
  logical_time: string;
  crop_stage_code: "MID";
  crop_stage_context_hash: string;
}>;
assert.equal(a18b.authority, "A18B_PREWINDOW_A0_AND_REPLACEMENT_RUNTIME_CONFIG_CHAIN");
assert.equal(selectedSlots.length, 24);

const bundle = buildExternalFormalPrewindowAuthorityBundleV2({
  bootstrap_logical_time: MCFT_CAP09_A18_PREWINDOW_A0_LOGICAL_TIME_V2,
  created_at: MCFT_CAP09_A18_CONFIG_AUTHORITY_CREATED_AT_V2,
  bootstrap_crop_stage_code: "MID",
  hourly_crop_pins: selectedSlots,
});
assert.equal(bundle.bootstrap_runtime_config.object_id, a18b.prewindow_a0.runtime_config_ref);
assert.equal(bundle.bootstrap_runtime_config.determinism_hash, a18b.prewindow_a0.runtime_config_hash);
assert.equal(bundle.runtime_configs.length, 24);

function materialize(logicalTime: string, identityHash: string) {
  return materializeExternalFormalA18CropContextV2({
    logical_time: logicalTime,
    expected_identity_hash: identityHash,
    crop_authority: cropAuthority,
    configuration_matrix: matrix,
  });
}

const prewindowMaterialized = materialize(a18b.prewindow_a0.logical_time, a18b.prewindow_a0.crop_stage_context_hash);
assert.equal(prewindowMaterialized.context.crop_stage_schedule[0]?.kc, 1.15);
assert.equal(prewindowMaterialized.context.crop_stage_schedule[0]?.crop_root_depth_mm, 600);
assert.equal(prewindowMaterialized.context.crop_stage_schedule[0]?.effective_model_root_depth_mm, 300);

const calibrationManifestRef = "CALIBRATION_ONLY_A18C_REPLACEMENT_MANIFEST_V1";
const calibrationManifestHash = `sha256:${"a".repeat(64)}`;
const slots = bundle.runtime_configs.map((config, index) => {
  const source = selectedSlots[index]!;
  const expectedPin = a18b.hourly_runtime_config_pins[index] as [string, string, string, string];
  assert.deepEqual(expectedPin, [source.slot_id, source.logical_time, config.object_id, config.determinism_hash]);
  const payload = config.payload as Record<string, any>;
  const context = materialize(source.logical_time, source.crop_stage_context_hash);
  assert.equal(context.context_identity_hash, source.crop_stage_context_hash);
  assert.equal(context.context.crop_stage_schedule[0]?.kc, 1.15);
  assert.equal(context.context.crop_stage_schedule[0]?.crop_root_depth_mm, 600);
  assert.equal(context.context.crop_stage_schedule[0]?.effective_model_root_depth_mm, 300);
  return {
    manifest_ref: calibrationManifestRef,
    manifest_hash: calibrationManifestHash,
    epoch_id: a18b.selected_epoch_id,
    slot_id: source.slot_id,
    logical_time: source.logical_time,
    runtime_config_ref: config.object_id,
    runtime_config_hash: config.determinism_hash,
    parent_runtime_config_ref: payload.parent_runtime_config_ref as string,
    parent_runtime_config_hash: payload.parent_runtime_config_hash as string,
    crop_stage_context_ref: payload.crop_stage_context_authority.context_ref as string,
    crop_stage_context_hash: source.crop_stage_context_hash,
    crop_stage_context_materialization_hash: context.context_materialization_hash,
  };
});

const manifest: ExternalFormalV3A18WindowManifestV1 = {
  manifest_ref: calibrationManifestRef,
  manifest_hash: calibrationManifestHash,
  epoch_id: a18b.selected_epoch_id,
  database_name: "geox_mcft_cap09_s6_formal_t3r1_24h_v2",
  scope: bundle.scope,
  o00_logical_time: selectedSlots[0]!.logical_time,
  o23_logical_time: selectedSlots[23]!.logical_time,
  slots: slots as ExternalFormalV3A18WindowManifestV1["slots"],
};

const boundary: ShadowOnlineBoundaryV1 = {
  scope: bundle.scope,
  slot_id: "O00",
  logical_time: selectedSlots[0]!.logical_time,
  scheduler_wall_clock_observed_at: "2026-08-18T04:10:00.000Z",
  interval_seconds: 3600,
};
const claim: ShadowOnlineSlotClaimV1 = {
  boundary,
  lease_owner: "a18c-calibration-runner",
  fencing_token: 1n,
  state: "CLAIMED",
  idempotency_key: "a18c-calibration-o00",
};
const runInput = {
  through_logical_time: "2026-08-18T04:10:00.000Z",
  evidence_snapshot_time: "2026-08-18T04:20:00.000Z",
  observer_started_at: "2026-08-18T04:21:00.000Z",
  lease_owner: claim.lease_owner,
  lease_duration_seconds: 900,
};

function exactConfigO00() {
  return bundle.runtime_configs[0]!;
}
function exactMaterializer(events: string[]) {
  return {
    materialize(input: { logical_time: string; expected_identity_hash: string }) {
      events.push("materialize_context");
      return materialize(input.logical_time, input.expected_identity_hash);
    },
  };
}
function schedulerFor(events: string[]) {
  return {
    async listMissedSlots() {
      events.push("list_missed_slots");
      return [boundary];
    },
    async claimDueSlot() {
      events.push("claim_due_slot");
      return claim;
    },
    async recordTerminalResult(input: any) {
      events.push(`terminal_${input.result.state}`);
    },
  };
}

// A18D has not persisted replacement configs yet: missing exact config must stop before Evidence and before claim.
{
  const events: string[] = [];
  const runner = new ExternalFormalV3Amendment11RunnerV1(
    manifest,
    schedulerFor(events),
    { async readRuntimeConfig() { events.push("read_config"); return null; } },
    exactMaterializer(events),
    { async loadCandidateRecords() { events.push("evidence_precheck"); return {} as any; } },
    { async executeClaimedTick() { events.push("execute_tick"); return {} as any; } },
  );
  const result = await runner.executeOneDueSlot(runInput);
  assert.equal(result.status, "NOT_READY_PRECLAIM");
  if (result.status !== "NOT_READY_PRECLAIM") throw new Error("A18C_MISSING_CONFIG_RESULT_NARROWING_FAILED");
  assert.equal(result.reason, "RUNTIME_CONFIG_MISSING");
  assert.deepEqual(events, ["list_missed_slots", "read_config"]);
}

// Exact config/context but missing delayed exact-T evidence must not create a scheduler claim.
{
  const events: string[] = [];
  const runner = new ExternalFormalV3Amendment11RunnerV1(
    manifest,
    schedulerFor(events),
    { async readRuntimeConfig() { events.push("read_config"); return exactConfigO00(); } },
    exactMaterializer(events),
    { async loadCandidateRecords() { events.push("evidence_precheck"); throw new Error("EXACT_T_EVIDENCE_NOT_YET_AVAILABLE"); } },
    { async executeClaimedTick() { events.push("execute_tick"); return {} as any; } },
  );
  const result = await runner.executeOneDueSlot(runInput);
  assert.equal(result.status, "NOT_READY_PRECLAIM");
  if (result.status !== "NOT_READY_PRECLAIM") throw new Error("A18C_EVIDENCE_RESULT_NARROWING_FAILED");
  assert.equal(result.reason, "EVIDENCE_PRECHECK_FAILED");
  assert.deepEqual(events, ["list_missed_slots", "read_config", "materialize_context", "evidence_precheck"]);
}

// Identity hash alone is insufficient: a full-context mutation with the old identity/materialization claim must stop before Evidence/claim.
{
  const events: string[] = [];
  const original = materialize(slots[0]!.logical_time, slots[0]!.crop_stage_context_hash);
  const tampered = structuredClone(original);
  tampered.context.crop_stage_schedule[0]!.kc = 1.14;
  tampered.context.determinism_hash = original.context_identity_hash;
  tampered.context_materialization_hash = original.context_materialization_hash;
  const recomputedTamperedHash = semanticHashV1({
    materialization_profile: MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V2,
    context_ref: tampered.context_ref,
    context_identity_hash: tampered.context_identity_hash,
    materialized_context: tampered.context,
  });
  assert.notEqual(recomputedTamperedHash, slots[0]!.crop_stage_context_materialization_hash);
  const runner = new ExternalFormalV3Amendment11RunnerV1(
    manifest,
    schedulerFor(events),
    { async readRuntimeConfig() { events.push("read_config"); return exactConfigO00(); } },
    { async materialize() { events.push("materialize_context"); return tampered; } },
    { async loadCandidateRecords() { events.push("evidence_precheck"); return {} as any; } },
    { async executeClaimedTick() { events.push("execute_tick"); return {} as any; } },
  );
  const result = await runner.executeOneDueSlot(runInput);
  assert.equal(result.status, "NOT_READY_PRECLAIM");
  if (result.status !== "NOT_READY_PRECLAIM") throw new Error("A18C_TAMPER_RESULT_NARROWING_FAILED");
  assert.equal(result.reason, "CROP_CONTEXT_BINDING_FAILED");
  assert.deepEqual(events, ["list_missed_slots", "read_config", "materialize_context"]);
}

// Positive orchestration must establish read-only readiness before claim, then reuse that claim in the tick service and terminalize.
let positiveOrder: string[] = [];
{
  const runner = new ExternalFormalV3Amendment11RunnerV1(
    manifest,
    schedulerFor(positiveOrder),
    { async readRuntimeConfig() { positiveOrder.push("read_config"); return exactConfigO00(); } },
    exactMaterializer(positiveOrder),
    { async loadCandidateRecords() { positiveOrder.push("evidence_precheck"); return {} as any; } },
    {
      async executeClaimedTick(input: any) {
        positiveOrder.push("execute_tick");
        assert.equal(input.claim, claim);
        assert.equal(input.manifest_slot.runtime_config_ref, slots[0]!.runtime_config_ref);
        assert.equal(input.manifest_slot.crop_stage_context_hash, slots[0]!.crop_stage_context_hash);
        assert.equal(input.crop_stage_context.determinism_hash, slots[0]!.crop_stage_context_hash);
        assert.equal(input.evidence_snapshot_time, runInput.evidence_snapshot_time);
        return { service_id: "MCFT_CAP09_EXTERNAL_FORMAL_V3_AMENDMENT11_PERSISTENT_TICK_SERVICE_V1", status: "INSERTED_A1_WITH_SCENARIO" } as any;
      },
    },
  );
  const result = await runner.executeOneDueSlot(runInput);
  assert.equal(result.status, "COMPLETED");
  assert.deepEqual(positiveOrder, [
    "list_missed_slots",
    "read_config",
    "materialize_context",
    "evidence_precheck",
    "claim_due_slot",
    "execute_tick",
    "terminal_COMPLETED",
  ]);
}

// A post-claim execution failure must terminalize FAILED instead of leaving an active claim/lease stuck.
let failureOrder: string[] = [];
{
  const runner = new ExternalFormalV3Amendment11RunnerV1(
    manifest,
    schedulerFor(failureOrder),
    { async readRuntimeConfig() { failureOrder.push("read_config"); return exactConfigO00(); } },
    exactMaterializer(failureOrder),
    { async loadCandidateRecords() { failureOrder.push("evidence_precheck"); return {} as any; } },
    { async executeClaimedTick() { failureOrder.push("execute_tick"); throw new Error("POST_CLAIM_FAIL_CLOSED"); } },
  );
  const result = await runner.executeOneDueSlot(runInput);
  assert.equal(result.status, "FAILED_TERMINAL_RECORDED");
  assert.deepEqual(failureOrder, [
    "list_missed_slots",
    "read_config",
    "materialize_context",
    "evidence_precheck",
    "claim_due_slot",
    "execute_tick",
    "terminal_FAILED",
  ]);
}

const output = {
  schema_version: "geox_mcft_cap09_a18c_manifest_runner_calibration_result_v1",
  status: "PASS",
  subject_sha: String(process.env.MCFT_SUBJECT_SHA ?? ""),
  calibration_only_not_authority: true,
  exact_base_main_sha: "185479edf0c8dfab58632cddfff81c6e9aec6b06",
  runner_id: EXTERNAL_FORMAL_V3_A18_RUNNER_ID_V1,
  database_name: manifest.database_name,
  selected_epoch_id: manifest.epoch_id,
  prewindow_a0: {
    logical_time: a18b.prewindow_a0.logical_time,
    runtime_config_ref: a18b.prewindow_a0.runtime_config_ref,
    runtime_config_hash: a18b.prewindow_a0.runtime_config_hash,
    crop_stage_context_identity_hash: prewindowMaterialized.context_identity_hash,
    crop_stage_context_materialization_hash: prewindowMaterialized.context_materialization_hash,
  },
  slots: slots.map((slot) => ({
    slot_id: slot.slot_id,
    logical_time: slot.logical_time,
    runtime_config_ref: slot.runtime_config_ref,
    runtime_config_hash: slot.runtime_config_hash,
    parent_runtime_config_ref: slot.parent_runtime_config_ref,
    parent_runtime_config_hash: slot.parent_runtime_config_hash,
    crop_stage_context_ref: slot.crop_stage_context_ref,
    crop_stage_context_identity_hash: slot.crop_stage_context_hash,
    crop_stage_context_materialization_hash: slot.crop_stage_context_materialization_hash,
  })),
  crop_materialization_parameters: {
    stage_code: "MID",
    kc: 1.15,
    crop_root_depth_mm: 600,
    effective_model_root_depth_mm: 300,
  },
  identity_hash_is_not_full_payload_hash: true,
  full_materialization_hash_required: true,
  missing_runtime_config_claim_count: 0,
  missing_evidence_claim_count: 0,
  tampered_full_context_claim_count: 0,
  positive_preclaim_order: positiveOrder,
  postclaim_failure_order: failureOrder,
  evidence_precheck_before_claim: positiveOrder.indexOf("evidence_precheck") < positiveOrder.indexOf("claim_due_slot"),
  failed_tick_terminalizes_claim: failureOrder.at(-1) === "terminal_FAILED",
  fixed_lag_authority_used: false,
  provider_availability_watermark: "PROVIDER_AVAILABILITY_WATERMARK_V1",
  provider_request_count: 0,
  r2_request_count: 0,
  database_write_count: 0,
  runtime_config_write_count: 0,
  scheduler_write_count: 0,
  canonical_runtime_write_count: 0,
  ea5e3_authorized: false,
  prewindow_a0_persisted: false,
  formal_o00_started: false,
  formal_execution_count: "0/24",
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
