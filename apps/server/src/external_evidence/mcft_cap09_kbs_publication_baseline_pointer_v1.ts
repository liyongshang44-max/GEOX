// MCFT-CAP-09 KBS Raw Hourly durable publication baseline pointer contract.
// Boundary: Evidence-owned operational pointer only. No provider fetch, no raw bytes,
// no canonical Evidence write, no RuntimeTickCursor, no Twin state, no process activation.

import type {
  EvidenceProducerLeaseClaimV1,
  EvidenceRuntimeScopeV1,
} from "./mcft_cap09_evidence_runtime_persistence_v1.js";

export const MCFT_CAP09_KBS_PUBLICATION_BASELINE_POINTER_CONTRACT_ID_V1 =
  "MCFT_CAP09_KBS_RAW_HOURLY_PUBLICATION_BASELINE_POINTER_V1" as const;

export type KbsRawHourlyPublicationBaselinePointerSnapshotV1 = {
  pointer_contract_id: typeof MCFT_CAP09_KBS_PUBLICATION_BASELINE_POINTER_CONTRACT_ID_V1;
  scope: EvidenceRuntimeScopeV1;
  baseline_ref: string;
  baseline_digest: string;
  manifest_bytes: number;
  latest_event_time: string;
  stored_at: string;
  writer_lease_owner: string;
  writer_fencing_token: bigint;
  advanced_at: string;
};

export type KbsRawHourlyPublicationBaselinePointerNextV1 = {
  baseline_ref: string;
  baseline_digest: string;
  manifest_bytes: number;
  latest_event_time: string;
  stored_at: string;
};

export type KbsRawHourlyPublicationBaselinePointerAdvanceResultV1 = {
  status: "ADVANCED" | "EXISTING_IDEMPOTENT_SUCCESS";
  pointer: KbsRawHourlyPublicationBaselinePointerSnapshotV1;
};

export interface KbsRawHourlyPublicationBaselinePointerReadPortV1 {
  readCurrentBaselinePointer(input: {
    scope: EvidenceRuntimeScopeV1;
  }): Promise<KbsRawHourlyPublicationBaselinePointerSnapshotV1 | null>;
}

export interface KbsRawHourlyPublicationBaselinePointerPortV1
  extends KbsRawHourlyPublicationBaselinePointerReadPortV1 {
  advanceCurrentBaselinePointer(input: {
    claim: EvidenceProducerLeaseClaimV1;
    expected_previous_digest: string | null;
    next: KbsRawHourlyPublicationBaselinePointerNextV1;
  }): Promise<KbsRawHourlyPublicationBaselinePointerAdvanceResultV1>;
}
