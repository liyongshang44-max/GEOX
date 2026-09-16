// MCFT-CAP-09 durable GFS retry schedule contract.
// Evidence-plane operational attempt coordination only. It is not provider cadence,
// canonical Evidence, RuntimeTickCursor, Twin state, Formal authority, or target authority.

import type {
  EvidenceProducerLeaseClaimV1,
  EvidenceRuntimeScopeV1,
} from "./mcft_cap09_evidence_runtime_persistence_v1.js";

export const MCFT_CAP09_GFS_RETRY_SCHEDULE_CONTRACT_ID_V1 =
  "MCFT_CAP09_GFS_RETRY_SCHEDULE_V1" as const;

export type GfsRetryScheduleSnapshotV1 = {
  schedule_contract_id: typeof MCFT_CAP09_GFS_RETRY_SCHEDULE_CONTRACT_ID_V1;
  scope: EvidenceRuntimeScopeV1;
  target_logical_time: string;
  attempt_count: number;
  last_attempt_started_at: string;
  next_attempt_eligible_at: string;
  writer_lease_owner: string;
  writer_fencing_token: bigint;
};

export type GfsRetryAttemptClaimResultV1 =
  | { status: "CLAIMED"; schedule: GfsRetryScheduleSnapshotV1; provider_request_authorized: true; database_write_count: 1 }
  | { status: "NOT_DUE" | "ATTEMPT_BUDGET_EXHAUSTED" | "MISSED_WINDOW"; schedule: GfsRetryScheduleSnapshotV1 | null; provider_request_authorized: false; database_write_count: 0 };

export interface GfsRetrySchedulePortV1 {
  readGfsRetrySchedule(input: { scope: EvidenceRuntimeScopeV1 }): Promise<GfsRetryScheduleSnapshotV1 | null>;
  claimGfsAttemptBeforeProviderFetch(input: {
    claim: EvidenceProducerLeaseClaimV1;
    target_logical_time: string;
    requested_at: string;
    due_window_start: string;
    due_window_end_exclusive: string;
  }): Promise<GfsRetryAttemptClaimResultV1>;
}
