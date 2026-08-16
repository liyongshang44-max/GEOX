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

const MANIFEST_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A18C-REPLACEMENT-FORMAL-WINDOW-INPUT-MANIFEST-V3.json");
const A18B_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-A18B-PREWINDOW-A0-AND-REPLACEMENT-RUNTIME-CONFIG-CHAIN-V1.json");
const SELECTION_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-T3R1-SUCCESSOR-EPOCH-SELECTION-V2.json");
const CROP_AUTHORITY_PATH = path.resolve("docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-S6-FORMAL-CROP-CONTEXT-AUTHORITY-V2.json");
const MATRIX_PATH = path.resolve("docs/digital_twin/mcft/GEOX-MCFT-00-CONFIGURATION-BINDING-MATRIX.json");
const OUT = path.resolve("acceptance-output/MCFT_CAP_09_A18C_MANIFEST_RUNNER_QUALIFICATION_RESULT.json");

type SelectedSlot = {
  slot_id: string;
  logical_time: string;
  crop_stage_code: "MID";
  crop_stage_context_hash: string;
};

type ManifestDoc = {
  schema_version: string;
  authority: string;
  exact_base_main_sha: string;
  manifest_ref: string;
  manifest_hash_profile: string;
  manifest_hash: string;
  formal_store: { database_name: string; qualification_mode: string };
  scope: Record<string, string>;
  epoch: { epoch_id: string; prewindow_a0: string; o00: string; o23: string };
  runtime_config_pin_source: Record<string, unknown>;
  prewindow_a0_materialization: {
    crop_stage_context_identity_hash: string;
    crop_stage_context_materialization_hash: string;
  };
  slot_context_materialization_hashes: Array<[string, string]>;
  crop_materialization_contract: Record<string, unknown>;
  runner_binding: Record<string, any>;
  temporal_semantics: Record<string, unknown>;
  nonclaims: Record<string, unknown>;
  next_legal_frontier_after_effectiveness: string;
};

function materializationHash(contextRef: string, identityHash: string, context: unknown): string {
  return semanticHashV1({
    materialization_profile: MCFT_CAP09_A18_CROP_CONTEXT_MATERIALIZATION_PROFILE_V2,
    context_ref: contextRef,
    context_identity_hash: identityHash,
    materialized_context: context,
  });
}

function exactMaterializer(cropAuthority: Record<string, unknown>, matrix: Record<string, unknown>, events?: string[]) {
  return {
    materialize(input: { logical_time: string; expected_identity_hash: string }) {
      events?.push("materialize_context");
      return materializeExternalFormalA18CropContextV2({
        logical_time: input.logical_time,
        expected_identity_hash: input.expected_identity_hash,
        crop_authority: cropAuthority,
        configuration_matrix: matrix,
      });
    },
  };
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as ManifestDoc;
  const a18b = JSON.parse(fs.readFileSync(A18B_PATH, "utf8"));
  const selection = JSON.parse(fs.readFileSync(SELECTION_PATH, "utf8"));
  const cropAuthority = JSON.parse(fs.readFileSync(CROP_AUTHORITY_PATH, "utf8"));
  const matrix = JSON.parse(fs.readFileSync(MATRIX_PATH, "utf8"));
  const selectedSlots = selection.slot_contexts as SelectedSlot[];

  assert.equal(manifest.schema_version, "geox_mcft_cap09_a18c_replacement_formal_window_input_manifest_v3");
  assert.equal(manifest.authority, "A18C_REPLACEMENT_IMMUTABLE_FORMAL_WINDOW_INPUT_MANIFEST_AND_RUNNER_EXACT_BINDING");
  assert.equal(manifest.exact_base_main_sha, "185479edf0c8dfab58632cddfff81c6e9aec6b06");
  assert.equal(manifest.manifest_hash_profile, "SEMANTIC_HASH_V1_WITH_MANIFEST_HASH_BLANK");
  const hashSeed = structuredClone(manifest) as ManifestDoc;
  hashSeed.manifest_hash = "";
  assert.equal(semanticHashV1(hashSeed), manifest.manifest_hash, "A18C_MANIFEST_SEMANTIC_HASH_DRIFT");
  assert.equal(manifest.formal_store.database_name, "geox_mcft_cap09_s6_formal_t3r1_24h_v2");
  assert.equal(manifest.formal_store.qualification_mode, "READ_ONLY");
  assert.equal(manifest.epoch.prewindow_a0, "2026-08-17T19:00:00.000Z");
  assert.equal(manifest.epoch.o00, "2026-08-17T20:00:00.000Z");
  assert.equal(manifest.epoch.o23, "2026-08-18T19:00:00.000Z");
  assert.equal(selectedSlots.length, 24);
  assert.equal(manifest.slot_context_materialization_hashes.length, 24);
  assert.equal(a18b.authority, "A18B_PREWINDOW_A0_AND_REPLACEMENT_RUNTIME_CONFIG_CHAIN");

  const bundle = buildExternalFormalPrewindowAuthorityBundleV2({
    bootstrap_logical_time: MCFT_CAP09_A18_PREWINDOW_A0_LOGICAL_TIME_V2,
    created_at: MCFT_CAP09_A18_CONFIG_AUTHORITY_CREATED_AT_V2,
    bootstrap_crop_stage_code: "MID",
    hourly_crop_pins: selectedSlots,
  });
  assert.equal(bundle.bootstrap_runtime_config.object_id, a18b.prewindow_a0.runtime_config_ref);
  assert.equal(bundle.bootstrap_runtime_config.determinism_hash, a18b.prewindow_a0.runtime_config_hash);
  assert.equal(bundle.runtime_configs.length, 24);

  const a0Context = exactMaterializer(cropAuthority, matrix).materialize({
    logical_time: manifest.epoch.prewindow_a0,
    expected_identity_hash: manifest.prewindow_a0_materialization.crop_stage_context_identity_hash,
  });
  assert.equal(a0Context.context_identity_hash, manifest.prewindow_a0_materialization.crop_stage_context_identity_hash);
  assert.equal(a0Context.context_materialization_hash, manifest.prewindow_a0_materialization.crop_stage_context_materialization_hash);
  assert.equal(materializationHash(a0Context.context_ref, a0Context.context_identity_hash, a0Context.context), a0Context.context_materialization_hash);

  const manifestMaterializationBySlot = new Map(manifest.slot_context_materialization_hashes);
  assert.equal(manifestMaterializationBySlot.size, 24);
  const runtimeSlots = bundle.runtime_configs.map((config, index) => {
    const source = selectedSlots[index]!;
    const a18bPin = a18b.hourly_runtime_config_pins[index] as [string, string, string, string];
    assert.deepEqual(a18bPin, [source.slot_id, source.logical_time, config.object_id, config.determinism_hash], `A18C_A18B_CONFIG_PIN_DRIFT:${source.slot_id}`);
    const payload = config.payload as Record<string, any>;
    const context = exactMaterializer(cropAuthority, matrix).materialize({
      logical_time: source.logical_time,
      expected_identity_hash: source.crop_stage_context_hash,
    });
    assert.equal(context.context_identity_hash, source.crop_stage_context_hash, `A18C_CONTEXT_IDENTITY_DRIFT:${source.slot_id}`);
    assert.equal(context.context_materialization_hash, manifestMaterializationBySlot.get(source.slot_id), `A18C_CONTEXT_MATERIALIZATION_DRIFT:${source.slot_id}`);
    assert.equal(materializationHash(context.context_ref, context.context_identity_hash, context.context), context.context_materialization_hash, `A18C_CONTEXT_INDEPENDENT_HASH_DRIFT:${source.slot_id}`);
    return {
      manifest_ref: manifest.manifest_ref,
      manifest_hash: manifest.manifest_hash,
      epoch_id: manifest.epoch.epoch_id,
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

  assert.equal(runtimeSlots[0]!.parent_runtime_config_ref, a18b.prewindow_a0.runtime_config_ref);
  assert.equal(runtimeSlots[0]!.parent_runtime_config_hash, a18b.prewindow_a0.runtime_config_hash);
  for (let i = 1; i < runtimeSlots.length; i += 1) {
    assert.equal(runtimeSlots[i]!.parent_runtime_config_ref, runtimeSlots[i - 1]!.runtime_config_ref, `A18C_PARENT_REF_DRIFT:${runtimeSlots[i]!.slot_id}`);
    assert.equal(runtimeSlots[i]!.parent_runtime_config_hash, runtimeSlots[i - 1]!.runtime_config_hash, `A18C_PARENT_HASH_DRIFT:${runtimeSlots[i]!.slot_id}`);
  }

  const boundManifest: ExternalFormalV3A18WindowManifestV1 = {
    manifest_ref: manifest.manifest_ref,
    manifest_hash: manifest.manifest_hash,
    epoch_id: manifest.epoch.epoch_id,
    database_name: manifest.formal_store.database_name,
    scope: bundle.scope,
    o00_logical_time: manifest.epoch.o00,
    o23_logical_time: manifest.epoch.o23,
    slots: runtimeSlots,
  };

  const boundary: ShadowOnlineBoundaryV1 = {
    scope: bundle.scope,
    slot_id: "O00",
    logical_time: manifest.epoch.o00,
    scheduler_wall_clock_observed_at: "2026-08-18T04:10:00.000Z",
    interval_seconds: 3600,
  };
  const claim: ShadowOnlineSlotClaimV1 = {
    boundary,
    lease_owner: "a18c-final-qualification",
    fencing_token: 1n,
    state: "CLAIMED",
    idempotency_key: "a18c-final-o00",
  };
  const runInput = {
    through_logical_time: "2026-08-18T04:10:00.000Z",
    evidence_snapshot_time: "2026-08-18T04:20:00.000Z",
    observer_started_at: "2026-08-18T04:21:00.000Z",
    lease_owner: claim.lease_owner,
    lease_duration_seconds: 900,
  };
  const exactConfigO00 = () => bundle.runtime_configs[0]!;
  const schedulerFor = (events: string[]) => ({
    async listMissedSlots() { events.push("list_missed_slots"); return [boundary]; },
    async claimDueSlot() { events.push("claim_due_slot"); return claim; },
    async recordTerminalResult(input: any) { events.push(`terminal_${input.result.state}`); },
  });

  const missingConfigEvents: string[] = [];
  {
    const runner = new ExternalFormalV3Amendment11RunnerV1(
      boundManifest,
      schedulerFor(missingConfigEvents),
      { async readRuntimeConfig() { missingConfigEvents.push("read_config"); return null; } },
      exactMaterializer(cropAuthority, matrix, missingConfigEvents),
      { async loadCandidateRecords() { missingConfigEvents.push("evidence_precheck"); return {} as any; } },
      { async executeClaimedTick() { missingConfigEvents.push("execute_tick"); return {} as any; } },
    );
    const result = await runner.executeOneDueSlot(runInput);
    assert.equal(result.status, "NOT_READY_PRECLAIM");
    if (result.status !== "NOT_READY_PRECLAIM") throw new Error("A18C_FINAL_MISSING_CONFIG_NARROWING_FAILED");
    assert.equal(result.reason, "RUNTIME_CONFIG_MISSING");
    assert.deepEqual(missingConfigEvents, ["list_missed_slots", "read_config"]);
  }

  const missingEvidenceEvents: string[] = [];
  {
    const runner = new ExternalFormalV3Amendment11RunnerV1(
      boundManifest,
      schedulerFor(missingEvidenceEvents),
      { async readRuntimeConfig() { missingEvidenceEvents.push("read_config"); return exactConfigO00(); } },
      exactMaterializer(cropAuthority, matrix, missingEvidenceEvents),
      { async loadCandidateRecords() { missingEvidenceEvents.push("evidence_precheck"); throw new Error("EXACT_T_EVIDENCE_NOT_YET_AVAILABLE"); } },
      { async executeClaimedTick() { missingEvidenceEvents.push("execute_tick"); return {} as any; } },
    );
    const result = await runner.executeOneDueSlot(runInput);
    assert.equal(result.status, "NOT_READY_PRECLAIM");
    if (result.status !== "NOT_READY_PRECLAIM") throw new Error("A18C_FINAL_MISSING_EVIDENCE_NARROWING_FAILED");
    assert.equal(result.reason, "EVIDENCE_PRECHECK_FAILED");
    assert.deepEqual(missingEvidenceEvents, ["list_missed_slots", "read_config", "materialize_context", "evidence_precheck"]);
  }

  const tamperEvents: string[] = [];
  {
    const original = exactMaterializer(cropAuthority, matrix).materialize({
      logical_time: runtimeSlots[0]!.logical_time,
      expected_identity_hash: runtimeSlots[0]!.crop_stage_context_hash,
    });
    const tampered = structuredClone(original);
    tampered.context.crop_stage_schedule[0]!.kc = 1.14;
    tampered.context.determinism_hash = original.context_identity_hash;
    tampered.context_materialization_hash = original.context_materialization_hash;
    assert.notEqual(materializationHash(tampered.context_ref, tampered.context_identity_hash, tampered.context), runtimeSlots[0]!.crop_stage_context_materialization_hash);
    const runner = new ExternalFormalV3Amendment11RunnerV1(
      boundManifest,
      schedulerFor(tamperEvents),
      { async readRuntimeConfig() { tamperEvents.push("read_config"); return exactConfigO00(); } },
      { async materialize() { tamperEvents.push("materialize_context"); return tampered; } },
      { async loadCandidateRecords() { tamperEvents.push("evidence_precheck"); return {} as any; } },
      { async executeClaimedTick() { tamperEvents.push("execute_tick"); return {} as any; } },
    );
    const result = await runner.executeOneDueSlot(runInput);
    assert.equal(result.status, "NOT_READY_PRECLAIM");
    if (result.status !== "NOT_READY_PRECLAIM") throw new Error("A18C_FINAL_TAMPER_NARROWING_FAILED");
    assert.equal(result.reason, "CROP_CONTEXT_BINDING_FAILED");
    assert.deepEqual(tamperEvents, ["list_missed_slots", "read_config", "materialize_context"]);
  }

  const positiveOrder: string[] = [];
  {
    const runner = new ExternalFormalV3Amendment11RunnerV1(
      boundManifest,
      schedulerFor(positiveOrder),
      { async readRuntimeConfig() { positiveOrder.push("read_config"); return exactConfigO00(); } },
      exactMaterializer(cropAuthority, matrix, positiveOrder),
      { async loadCandidateRecords() { positiveOrder.push("evidence_precheck"); return {} as any; } },
      { async executeClaimedTick(input: any) { positiveOrder.push("execute_tick"); assert.equal(input.claim, claim); return { service_id: "MCFT_CAP09_EXTERNAL_FORMAL_V3_AMENDMENT11_PERSISTENT_TICK_SERVICE_V1", status: "INSERTED_A1_WITH_SCENARIO" } as any; } },
    );
    const result = await runner.executeOneDueSlot(runInput);
    assert.equal(result.status, "COMPLETED");
    assert.deepEqual(positiveOrder, ["list_missed_slots", "read_config", "materialize_context", "evidence_precheck", "claim_due_slot", "execute_tick", "terminal_COMPLETED"]);
  }

  const failedOrder: string[] = [];
  {
    const runner = new ExternalFormalV3Amendment11RunnerV1(
      boundManifest,
      schedulerFor(failedOrder),
      { async readRuntimeConfig() { failedOrder.push("read_config"); return exactConfigO00(); } },
      exactMaterializer(cropAuthority, matrix, failedOrder),
      { async loadCandidateRecords() { failedOrder.push("evidence_precheck"); return {} as any; } },
      { async executeClaimedTick() { failedOrder.push("execute_tick"); throw new Error("POST_CLAIM_FAIL_CLOSED"); } },
    );
    const result = await runner.executeOneDueSlot(runInput);
    assert.equal(result.status, "FAILED_TERMINAL_RECORDED");
    assert.deepEqual(failedOrder, ["list_missed_slots", "read_config", "materialize_context", "evidence_precheck", "claim_due_slot", "execute_tick", "terminal_FAILED"]);
  }

  assert.equal(manifest.temporal_semantics.provider_availability_watermark, "PROVIDER_AVAILABILITY_WATERMARK_V1");
  assert.equal(manifest.temporal_semantics.freshness_is_late_authoritative_admission_gate, false);
  assert.equal(manifest.temporal_semantics.fixed_lag_authority_used, false);
  assert.equal(manifest.runner_binding.runner[0], EXTERNAL_FORMAL_V3_A18_RUNNER_ID_V1);
  assert.deepEqual(manifest.runner_binding.required_order, [
    "list_missed_slots",
    "read_exact_runtime_config",
    "materialize_and_verify_full_crop_context",
    "db_only_evidence_precheck_at_actual_snapshot",
    "claim_due_slot",
    "execute_amendment11_tick_with_same_claim_fence",
    "record_terminal_result",
  ]);
  assert.equal(manifest.nonclaims.runtime_configs_persisted, false);
  assert.equal(manifest.nonclaims.prewindow_a0_persisted, false);
  assert.equal(manifest.nonclaims.scheduler_live_claim_executed, false);
  assert.equal(manifest.nonclaims.ea5e3_authorized, false);
  assert.equal(manifest.nonclaims.formal_o00_started, false);
  assert.equal(manifest.nonclaims.formal_execution_count, "0/24");
  assert.equal(manifest.next_legal_frontier_after_effectiveness, "EA5E3_READINESS_PREAUTHORIZATION_BEFORE_O00_MINUS_12H");

  const result = {
    schema_version: "geox_mcft_cap09_a18c_manifest_runner_qualification_result_v1",
    status: "PASS",
    subject_sha: String(process.env.MCFT_SUBJECT_SHA ?? ""),
    exact_base_main_sha: manifest.exact_base_main_sha,
    manifest_ref: manifest.manifest_ref,
    manifest_hash: manifest.manifest_hash,
    manifest_hash_recomputed_equal: true,
    exact_a18b_runtime_config_chain_recomputed_equal: true,
    exact_slot_count: runtimeSlots.length,
    exact_context_identity_hashes_equal: true,
    exact_full_materialization_hashes_equal: true,
    crop_materialization_parameters: { stage_code: "MID", kc: 1.15, crop_root_depth_mm: 600, effective_model_root_depth_mm: 300 },
    identity_hash_is_not_full_payload_hash: true,
    missing_runtime_config_claim_count: 0,
    missing_evidence_claim_count: 0,
    tampered_full_context_claim_count: 0,
    positive_order: positiveOrder,
    postclaim_failure_order: failedOrder,
    provider_availability_watermark: "PROVIDER_AVAILABILITY_WATERMARK_V1",
    fixed_lag_authority_used: false,
    provider_request_count: 0,
    r2_request_count: 0,
    database_write_count: 0,
    runtime_config_write_count: 0,
    scheduler_live_write_count: 0,
    canonical_runtime_write_count: 0,
    prewindow_a0_persisted: false,
    ea5e3_authorized: false,
    formal_o00_started: false,
    formal_execution_count: "0/24",
    next_legal_frontier_after_effectiveness: manifest.next_legal_frontier_after_effectiveness,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
