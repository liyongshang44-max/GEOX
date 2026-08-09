// apps/server/src/runtime/twin_runtime/external_formal_a0_evidence_window_service_v1.ts
// Purpose: prepare the External Formal A0 Evidence Window under the exact Amendment-05 KBS soil binding authority without mutating the CAP08-frozen historical A0 bootstrap service.
// Boundary: read candidate Evidence and build one frozen Evidence Window only; no Runtime Config commit, A0 canonical record construction, persistence, lease, network, database implementation, scheduler, wall clock, or Formal write.

import {
  MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
} from "../../domain/twin_runtime/external_formal_evidence_binding_profile_v1.js";
import {
  buildFrozenEvidenceWindowV1,
  type FrozenEvidenceWindowV1,
} from "./evidence_window_builder_v1.js";
import type {
  ReplayEvidenceSourcePortV1,
  TwinScopeKeyV1,
} from "./ports.js";

export type PrepareExternalFormalA0EvidenceWindowInputV1 = {
  scope: TwinScopeKeyV1;
  logical_time: string;
};

export type PrepareExternalFormalA0EvidenceWindowResultV1 = {
  authorized_soil_binding_id:
    typeof MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1;
  evidence_window: FrozenEvidenceWindowV1;
};

export class ExternalFormalA0EvidenceWindowServiceV1 {
  constructor(
    private readonly evidenceSource: ReplayEvidenceSourcePortV1,
  ) {}

  async prepare(
    input: PrepareExternalFormalA0EvidenceWindowInputV1,
  ): Promise<PrepareExternalFormalA0EvidenceWindowResultV1> {
    const candidateRecords = await this.evidenceSource.loadCandidateRecords({
      scope: input.scope,
      logical_time: input.logical_time,
    });
    const evidenceWindow = buildFrozenEvidenceWindowV1({
      scope: input.scope,
      logical_time: input.logical_time,
      candidate_records: candidateRecords,
      authorized_soil_binding_id:
        MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
    });
    return {
      authorized_soil_binding_id:
        MCFT_CAP09_EXTERNAL_FORMAL_SOIL_BINDING_ID_V1,
      evidence_window: evidenceWindow,
    };
  }
}
