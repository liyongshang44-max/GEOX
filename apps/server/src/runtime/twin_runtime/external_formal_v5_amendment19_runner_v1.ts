import type { RuntimeConfigRepositoryPortV1, SchedulerPortV1 } from "./ports.js";
import type {
  ExternalFormalV3Amendment19DatabaseEvidenceSourcePortV1,
  ExternalFormalV3Amendment19PersistentTickServiceV1,
} from "./external_formal_v3_amendment19_persistent_tick_service_v1.js";
import {
  ExternalFormalV3Amendment19RunnerV1,
  type ExternalFormalV3Am19CropContextMaterializerPortV1,
  type ExecuteExternalFormalV3Am19RunnerResultV1,
  type ExternalFormalV3Am19WindowManifestV1,
  type ExecuteExternalFormalV3Am19RunnerInputV1,
} from "./external_formal_v3_amendment19_runner_v1.js";
import {
  ExternalFormalNextTickNotViablePreclaimErrorV1,
  ExternalFormalV5ViabilityGatedSchedulerV1,
} from "./external_formal_v5_viability_gated_scheduler_v1.js";
import type { ExternalFormalNextTickViabilityPortV1 } from "./postgres_external_formal_next_tick_viability_v1.js";

export const EXTERNAL_FORMAL_V5_AM19_RUNNER_ID_V1 =
  "MCFT_CAP09_EXTERNAL_FORMAL_V5_AM19_RUNNER_V1" as const;

type SchedulerSubsetV1 = Pick<SchedulerPortV1, "listMissedSlots" | "claimDueSlot" | "recordTerminalResult">;
type RuntimeConfigReadPortV1 = Pick<RuntimeConfigRepositoryPortV1, "readRuntimeConfig">;
type TickServicePortV1 = Pick<ExternalFormalV3Amendment19PersistentTickServiceV1, "executeClaimedTick">;

export type ExternalFormalV5Am19ViabilityFailureResultV1 = {
  runner_id: typeof EXTERNAL_FORMAL_V5_AM19_RUNNER_ID_V1;
  status: "NOT_READY_PRECLAIM";
  slot_id: string;
  logical_time: string;
  reason: "NEXT_TICK_FORCING_NOT_VIABLE";
  detail: string;
  required_forcing_base: string | null;
  claim_attempted: false;
  provider_request_count: 0;
  r2_request_count: 0;
};

export type ExternalFormalV5Am19RunnerResultV1 =
  | ExecuteExternalFormalV3Am19RunnerResultV1
  | ExternalFormalV5Am19ViabilityFailureResultV1;

export class ExternalFormalV5Amendment19RunnerV1 {
  private readonly inner: ExternalFormalV3Amendment19RunnerV1;

  constructor(
    manifest: ExternalFormalV3Am19WindowManifestV1,
    scheduler: SchedulerSubsetV1,
    runtimeConfigRepository: RuntimeConfigReadPortV1,
    cropContextMaterializer: ExternalFormalV3Am19CropContextMaterializerPortV1,
    evidenceSource: ExternalFormalV3Amendment19DatabaseEvidenceSourcePortV1,
    tickService: TickServicePortV1,
    viability: ExternalFormalNextTickViabilityPortV1,
  ) {
    const gatedScheduler = new ExternalFormalV5ViabilityGatedSchedulerV1(scheduler, viability);
    this.inner = new ExternalFormalV3Amendment19RunnerV1(
      manifest,
      gatedScheduler,
      runtimeConfigRepository,
      cropContextMaterializer,
      evidenceSource,
      tickService,
    );
  }

  async executeOneDueSlot(input: ExecuteExternalFormalV3Am19RunnerInputV1): Promise<ExternalFormalV5Am19RunnerResultV1> {
    try {
      return await this.inner.executeOneDueSlot(input);
    } catch (error) {
      if (!(error instanceof ExternalFormalNextTickNotViablePreclaimErrorV1)) throw error;
      return {
        runner_id: EXTERNAL_FORMAL_V5_AM19_RUNNER_ID_V1,
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
