import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { semanticHashV1 } from "../../apps/server/src/domain/twin_runtime/canonical_identity_v1.js";
import { MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 } from "../../apps/server/src/domain/twin_runtime/external_formal_runtime_config_v1.js";
import { ExternalFormalV5Amendment19RunnerV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_v5_amendment19_runner_v1.js";
import type { ExternalFormalV3Am19WindowManifestV1 } from "../../apps/server/src/runtime/twin_runtime/external_formal_v3_amendment19_runner_v1.js";
import type { ExternalFormalTerminalSuccessorViabilityPortV1 } from "../../apps/server/src/runtime/twin_runtime/postgres_external_formal_next_tick_viability_v1.js";
import type { ShadowOnlineBoundaryV1 } from "../../apps/server/src/runtime/twin_runtime/ports.js";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "acceptance-output/MCFT_CAP_09_V13_POST_COMMIT_ADJUDICATION_BOUNDARY_RESULT.json");
const O00 = "2099-03-01T04:00:00.000Z";
const OBSERVED = "2099-03-01T04:05:00.000Z";
const MANIFEST_REF = "v13-post-commit-boundary-manifest";
const MANIFEST_HASH = "v13-post-commit-boundary-manifest-hash";
const EPOCH = "v13-post-commit-adjudication-boundary";

function addHours(value: string, count: number): string {
  return new Date(Date.parse(value) + count * 3_600_000).toISOString();
}

function slotId(index: number): `O${string}` {
  return `O${String(index).padStart(2, "0")}`;
}

function cropMaterialization(logicalTime: string, contextRef: string, contextHash: string): any {
  const context = {
    crop_stage_code: "MID",
    source: "CONTROLLED_POST_COMMIT_BOUNDARY_ACCEPTANCE",
  };
  const materializationProfile = "V13_POST_COMMIT_BOUNDARY_ACCEPTANCE_V1";
  return {
    materialization_profile: materializationProfile,
    context_ref: contextRef,
    context_identity_hash: contextHash,
    logical_time: logicalTime,
    context,
    context_materialization_hash: semanticHashV1({
      materialization_profile: materializationProfile,
      context_ref: contextRef,
      context_identity_hash: contextHash,
      materialized_context: context,
    }),
  };
}

function main(): Promise<void> {
  const slots = Array.from({ length: 24 }, (_, index) => {
    const logicalTime = addHours(O00, index);
    const contextRef = `crop-context-${index}`;
    const contextHash = `crop-context-hash-${index}`;
    const materialized = cropMaterialization(logicalTime, contextRef, contextHash);
    return {
      manifest_ref: MANIFEST_REF,
      manifest_hash: MANIFEST_HASH,
      epoch_id: EPOCH,
      slot_id: slotId(index) as any,
      logical_time: logicalTime,
      runtime_config_ref: `runtime-config-${index}`,
      runtime_config_hash: `runtime-config-hash-${index}`,
      parent_runtime_config_ref: `parent-runtime-config-${index}`,
      parent_runtime_config_hash: `parent-runtime-config-hash-${index}`,
      crop_stage_context_ref: contextRef,
      crop_stage_context_hash: contextHash,
      crop_stage_context_materialization_hash: materialized.context_materialization_hash,
    };
  });

  const manifest: ExternalFormalV3Am19WindowManifestV1 = {
    manifest_ref: MANIFEST_REF,
    manifest_hash: MANIFEST_HASH,
    epoch_id: EPOCH,
    database_name: "v13_post_commit_boundary_acceptance",
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    o00_logical_time: O00,
    o23_logical_time: addHours(O00, 23),
    slots,
  };

  const dueBoundary: ShadowOnlineBoundaryV1 = {
    scope: { ...MCFT_CAP09_EXTERNAL_FORMAL_SCOPE_V1 },
    slot_id: "O00",
    logical_time: O00,
    scheduler_wall_clock_observed_at: OBSERVED,
    interval_seconds: 3600,
  };

  let claimCount = 0;
  let tickCount = 0;
  let terminalWriteCount = 0;
  let adjudicationCount = 0;

  const scheduler: any = {
    async listMissedSlots() {
      return [dueBoundary];
    },
    async claimDueSlot(input: any) {
      claimCount += 1;
      return {
        boundary: input.boundary,
        lease_owner: input.lease_owner,
        lease_token: "controlled-lease-token",
        lease_expires_at: "2099-03-01T04:10:00.000Z",
      };
    },
    async recordTerminalResult() {
      terminalWriteCount += 1;
    },
  };

  const runtimeConfigRepository: any = {
    async readRuntimeConfig(ref: string) {
      const slot = slots.find((candidate) => candidate.runtime_config_ref === ref);
      if (!slot) return null;
      return {
        object_id: slot.runtime_config_ref,
        determinism_hash: slot.runtime_config_hash,
        payload: {
          effective_logical_time: slot.logical_time,
          parent_runtime_config_ref: slot.parent_runtime_config_ref,
          parent_runtime_config_hash: slot.parent_runtime_config_hash,
          crop_stage_context_authority: {
            context_ref: slot.crop_stage_context_ref,
            context_hash: slot.crop_stage_context_hash,
          },
          config_selection_mode: "EXPLICIT_REF_HASH_PIN_ONLY",
        },
      };
    },
  };

  const cropContextMaterializer: any = {
    async materialize(input: { logical_time: string; expected_identity_hash: string }) {
      const slot = slots.find((candidate) => candidate.logical_time === input.logical_time);
      if (!slot) throw new Error("CONTROLLED_SLOT_REQUIRED");
      assert.equal(input.expected_identity_hash, slot.crop_stage_context_hash);
      return cropMaterialization(slot.logical_time, slot.crop_stage_context_ref, slot.crop_stage_context_hash);
    },
  };

  const evidenceSource: any = {
    async loadCandidateRecords() {
      return {};
    },
  };

  const tickService: any = {
    async executeClaimedTick() {
      tickCount += 1;
      return {
        runtime_health: "DEGRADED",
        a_record_set: { record_set_id: "controlled-a-record-set" },
      };
    },
  };

  const viability: ExternalFormalTerminalSuccessorViabilityPortV1 = {
    async checkPreclaimViability(boundary) {
      return {
        viability_id: "NEXT_TICK_FORCING_VIABILITY_V1",
        status: "PASS",
        slot_id: boundary.slot_id,
        logical_time: boundary.logical_time,
        mode: "A0_WARM_START",
        required_forcing_base: null,
        runtime_cursor_verified: true,
        forcing_cursor_verified: false,
        physical_ingress_attestation_verified: false,
      };
    },
    async adjudicateSuccessorAfterTerminal() {
      adjudicationCount += 1;
      throw new Error("CONTROLLED_POST_COMMIT_SUCCESSOR_ADJUDICATION_FAILURE");
    },
  };

  const runner = new ExternalFormalV5Amendment19RunnerV1(
    manifest,
    scheduler,
    runtimeConfigRepository,
    cropContextMaterializer,
    evidenceSource,
    tickService,
    viability,
  );

  return assert.rejects(
    () => runner.executeOneDueSlot({
      through_logical_time: O00,
      observer_started_at: OBSERVED,
      lease_owner: "v13-post-commit-boundary-runner",
      lease_duration_seconds: 300,
    }),
    /CONTROLLED_POST_COMMIT_SUCCESSOR_ADJUDICATION_FAILURE/,
  ).then(() => {
    assert.equal(claimCount, 1);
    assert.equal(tickCount, 1);
    assert.equal(adjudicationCount, 1);
    assert.equal(terminalWriteCount, 1);

    const result = {
      status: "PASS",
      acceptance_mode: "V13_POST_COMMIT_SUCCESSOR_ADJUDICATION_BOUNDARY",
      predecessor_terminal_commit_count: terminalWriteCount,
      successor_adjudication_attempt_count: adjudicationCount,
      post_commit_adjudication_failure_propagated_from_v5: true,
      post_commit_adjudication_failure_does_not_reterminalize_current_slot: terminalWriteCount === 1,
      frozen_v3_runner_modified: false,
      canonical_tick_core_changed: false,
      production_workflow_effect: false,
      mcft_cap09_completed: false,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
  });
}

main().catch((error) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ status: "FAIL", error: error instanceof Error ? error.message : String(error) }, null, 2) + "\n");
  console.error(error);
  process.exitCode = 1;
});
