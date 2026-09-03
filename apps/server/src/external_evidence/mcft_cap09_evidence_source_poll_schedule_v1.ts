// MCFT-CAP-09 Evidence-plane durable source poll schedule contract.
// Operational acquisition coordination only. This state is not canonical Evidence,
// provider/source cadence truth, RuntimeTickCursor, Twin state, or Formal authority.

import type {
  EvidenceProducerLeaseClaimV1,
  EvidenceRuntimeScopeV1,
} from "./mcft_cap09_evidence_runtime_persistence_v1.js";

export const MCFT_CAP09_EVIDENCE_SOURCE_POLL_SCHEDULE_CONTRACT_ID_V1 =
  "MCFT_CAP09_EVIDENCE_SOURCE_POLL_SCHEDULE_V1" as const;

export type EvidenceSourcePollFamilyV1 = "KBS_RAW_HOURLY" | "KBS_SOIL";

export type EvidenceSourcePollScheduleSnapshotV1 = {
  schedule_contract_id: typeof MCFT_CAP09_EVIDENCE_SOURCE_POLL_SCHEDULE_CONTRACT_ID_V1;
  scope: EvidenceRuntimeScopeV1;
  source_family: EvidenceSourcePollFamilyV1;
  last_poll_started_at: string;
  next_poll_eligible_at: string;
  writer_lease_owner: string;
  writer_fencing_token: bigint;
};

export type EvidenceSourcePollClaimResultV1 =
  | {
      status: "CLAIMED";
      schedule: EvidenceSourcePollScheduleSnapshotV1;
      provider_request_authorized: true;
      database_write_count: 1;
    }
  | {
      status: "NOT_DUE";
      schedule: EvidenceSourcePollScheduleSnapshotV1;
      provider_request_authorized: false;
      database_write_count: 0;
    };

export interface EvidenceSourcePollScheduleReadPortV1 {
  readSourcePollSchedule(input: {
    scope: EvidenceRuntimeScopeV1;
    source_family: EvidenceSourcePollFamilyV1;
  }): Promise<EvidenceSourcePollScheduleSnapshotV1 | null>;
}

export interface EvidenceSourcePollScheduleClaimPortV1
  extends EvidenceSourcePollScheduleReadPortV1 {
  claimPollBeforeProviderFetch(input: {
    claim: EvidenceProducerLeaseClaimV1;
    source_family: EvidenceSourcePollFamilyV1;
    activation_fence_time: string;
    requested_at: string;
  }): Promise<EvidenceSourcePollClaimResultV1>;
}
