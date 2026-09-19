// MCFT-CAP-09 H6 Formal-v5 stage-aware runner.
// Composes the already-qualified V5 forcing-viability gate with the already-qualified
// V4 stage-aware Amendment-19 runner. No scheduler, tick, persistence, evidence,
// crop-stage, provider, or clock semantics are reimplemented here.

import type {
  RuntimeConfigRepositoryPortV1,
  SchedulerPortV1,
  ShadowOnlineSlotIdV1,
} from "./ports.js";
import type {
  ExternalFormalV3Amendment19DatabaseEvidenceSourcePortV1,
  ExternalFormalV3Amendment19PersistentTickServiceV1,
} from "./external_formal_v3_amendment19_persistent_tick_service_v1.js";
import {
  ExternalFormalV4Amendment19RunnerV2,
  type ExecuteExternalFormalV3Am19RunnerInputV1,
  type ExecuteExternalFormalV3Am19RunnerResultV1,
  type ExternalFormalV4Am19CropContextMaterializerPortV2,
  type ExternalFormalV4Am19WindowManifestV2,
} from "./external_formal_v4_amendment19_runner_v2.js";
import {
  ExternalFormalNextTickNotViablePreclaimErrorV1,
  ExternalFormalV5ViabilityGatedSchedulerV1,
} from "./external_formal_v5_viability_gated_scheduler_v1.js";
import type {
  ExternalFormalTerminalSuccessorViabilityPortV1,
} from "./postgres_external_formal_next_tick_viability_v1.js";

export const EXTERNAL_FORMAL_V5_AM19_RUNNER_ID_V2 =
  "MCFT_CAP09_EXTERNAL_FORMAL_V5_AM19_RUNNER_V2" as const;

type SchedulerSubsetV2 = Pick<SchedulerPortV1, "listMissedSlots" | "claimDueSlot" | "recordTerminalResult">;
type RuntimeConfigReadPortV2 = Pick<RuntimeConfigRepositoryPortV1, "readRuntimeConfig">;
type TickServicePortV2 = Pick<ExternalFormalV3Amendment19PersistentTickServiceV1, "executeClaimedTick">;

export type ExternalFormalV5Am19ViabilityFailureResultV2 = {
  runner_id: typeof EXTERNAL_FORMAL_V5_AM19_RUNNER_ID_V2;
  status: "NOT_READY_PRECLAIM";
  slot_id: ShadowOnlineSlotIdV1;
  logical_time: string;
  reason: "NEXT_TICK_FORCING_NOT_VIABLE";
  detail: string;
  required_forcing_base: string | null;
  claim_attempted: false;
  provider_request_count: 0;
  r2_request_count: 0;
};

export type ExternalFormalV5Am19StageAwareRunnerResultV2 =
  | ExecuteExternalFormalV3Am19RunnerResultV1
  | ExternalFormalV5Am19ViabilityFailureResultV2;

export class ExternalFormalV5Amendment19RunnerV2 {
  private readonly inner: ExternalFormalV4Amendment19RunnerV2;
  private readonly gatedScheduler: ExternalFormalV5ViabilityGatedSchedulerV1;

  constructor(
    manifest: ExternalFormalV4Am19WindowManifestV2,
    scheduler: SchedulerSubsetV2,
    runtimeConfigRepository: RuntimeConfigReadPortV2,
    cropContextMaterializer: ExternalFormalV4Am19CropContextMaterializerPortV2,
    evidenceSource: ExternalFormalV3Amendment19DatabaseEvidenceSourcePortV1,
    tickService: TickServicePortV2,
    viability: ExternalFormalTerminalSuccessorViabilityPortV1,
  ) {
    this.gatedScheduler = new ExternalFormalV5ViabilityGatedSchedulerV1(
      scheduler,
      viability,
    );
    this.inner = new ExternalFormalV4Amendment19RunnerV2(
      manifest,
      this.gatedScheduler,
      runtimeConfigRepository,
      cropContextMaterializer,
      evidenceSource,
      tickService,
    );
  }

  async executeOneDueSlot(
    input: ExecuteExternalFormalV3Am19RunnerInputV1,
  ): Promise<ExternalFormalV5Am19StageAwareRunnerResultV2> {
    try {
      const result = await this.inner.executeOneDueSlot(input);
      if (
        "terminal_result_recorded" in result
        && result.terminal_result_recorded === true
      ) {
        this.gatedScheduler.requireLastTerminalSuccessorAdjudication();
      }
      return result;
    } catch (error) {
      if (!(error instanceof ExternalFormalNextTickNotViablePreclaimErrorV1)) {
        throw error;
      }
      return {
        runner_id: EXTERNAL_FORMAL_V5_AM19_RUNNER_ID_V2,
        status: "NOT_READY_PRECLAIM",
        slot_id: error.boundary.slot_id,
        logical_time: error.boundary.logical_time,
        reason: "NEXT_TICK_FORCING_NOT_VIABLE",
        detail: error.message,
        required_forcing_base: error.viability.required_forcing_base,
        claim_attempted: false,
        provider_request_count: 0,
        r2_request_count: 0,
      };
    }
  }
}
