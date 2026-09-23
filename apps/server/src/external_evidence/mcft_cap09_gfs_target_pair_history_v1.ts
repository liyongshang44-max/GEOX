// MCFT-CAP-09 canonical GFS hourly target-pair history.
// Hourly target completion is read from append-only canonical External Evidence facts.
// EvidenceSupplyCursor remains provider-cycle progress / partial-repair authority only.

import type { EvidenceRuntimeScopeV1 } from "./mcft_cap09_evidence_runtime_persistence_v1.js";

export const MCFT_CAP09_GFS_TARGET_PAIR_HISTORY_READER_ID_V1 =
  "MCFT_CAP09_GFS_TARGET_PAIR_HISTORY_READER_V1" as const;

export type GfsCanonicalTargetPairV1 = {
  target_logical_time: string;
  cycle_issued_at: string;
  weather_fact_id: string;
  future_et0_fact_id: string;
};

export type GfsCanonicalPartialTargetV1 = {
  target_logical_time: string;
  present_role: "WEATHER" | "FUTURE_ET0";
  cycle_issued_at: string;
  fact_id: string;
};

export type GfsCanonicalTargetPairHistoryV1 = {
  reader_id: typeof MCFT_CAP09_GFS_TARGET_PAIR_HISTORY_READER_ID_V1;
  pairs: readonly GfsCanonicalTargetPairV1[];
  partial_targets: readonly GfsCanonicalPartialTargetV1[];
  canonical_fact_read_count: number;
};

export interface GfsCanonicalTargetPairHistoryReadPortV1 {
  readGfsTargetPairHistory(input: {
    scope: EvidenceRuntimeScopeV1;
    from_target_logical_time: string;
  }): Promise<GfsCanonicalTargetPairHistoryV1>;
}
