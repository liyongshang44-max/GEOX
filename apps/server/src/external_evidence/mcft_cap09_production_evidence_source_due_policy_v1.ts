// MCFT-CAP-09 production Evidence source due policy.
// Intervals are GEOX operational request throttles, not provider cadence,
// freshness, scientific, agronomic, RuntimeTickCursor, or Formal authority.
// Pure evaluation only: no DB/provider/network/wall-clock/environment access.

import type {
  EvidenceSourcePollFamilyV1,
  EvidenceSourcePollScheduleSnapshotV1,
} from "./mcft_cap09_evidence_source_poll_schedule_v1.js";
import type {
  ProductionEvidenceDueStateV1,
  ProductionEvidenceNotDueStateV1,
} from "./mcft_cap09_production_evidence_source_planner_v1.js";

export const MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_ID_V1 =
  "MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_V1" as const;
export const MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_AUTHORITY_REF_V1 =
  "docs/digital_twin/mcft/cap_09/GEOX-MCFT-CAP-09-PRODUCTION-EVIDENCE-SOURCE-DUE-POLICY-AUTHORITY-V1.json" as const;

export type ProductionEvidenceSourcePollPolicyV1 = {
  policy_id: typeof MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_ID_V1;
  authority_ref: typeof MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_AUTHORITY_REF_V1;
  source_family: EvidenceSourcePollFamilyV1;
  minimum_poll_interval_seconds: number;
  interval_semantics: "GEOX_OPERATIONAL_THROTTLE_NOT_PROVIDER_CADENCE";
};

const POLICY: Record<EvidenceSourcePollFamilyV1, ProductionEvidenceSourcePollPolicyV1> = {
  KBS_RAW_HOURLY: {
    policy_id: MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_ID_V1,
    authority_ref: MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_AUTHORITY_REF_V1,
    source_family: "KBS_RAW_HOURLY",
    minimum_poll_interval_seconds: 900,
    interval_semantics: "GEOX_OPERATIONAL_THROTTLE_NOT_PROVIDER_CADENCE",
  },
  KBS_SOIL: {
    policy_id: MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_ID_V1,
    authority_ref: MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_AUTHORITY_REF_V1,
    source_family: "KBS_SOIL",
    minimum_poll_interval_seconds: 300,
    interval_semantics: "GEOX_OPERATIONAL_THROTTLE_NOT_PROVIDER_CADENCE",
  },
};

function isoV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

export function productionEvidenceSourcePollPolicyV1(
  sourceFamily: EvidenceSourcePollFamilyV1,
): ProductionEvidenceSourcePollPolicyV1 {
  const policy = POLICY[sourceFamily];
  if (!policy) throw new Error("PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_SOURCE_UNREGISTERED");
  return { ...policy };
}

export function nextProductionEvidenceSourcePollEligibleAtV1(input: {
  source_family: EvidenceSourcePollFamilyV1;
  poll_started_at: string;
}): string {
  const started = isoV1(
    input.poll_started_at,
    "PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_POLL_STARTED_AT_INVALID",
  );
  const seconds = productionEvidenceSourcePollPolicyV1(
    input.source_family,
  ).minimum_poll_interval_seconds;
  return new Date(Date.parse(started) + seconds * 1000).toISOString();
}

export function evaluateProductionEvidenceSourceDueV1(input: {
  source_family: EvidenceSourcePollFamilyV1;
  planning_time: string;
  activation_fence_time: string;
  schedule: EvidenceSourcePollScheduleSnapshotV1 | null;
}): ProductionEvidenceNotDueStateV1 | ProductionEvidenceDueStateV1 {
  const planning = isoV1(
    input.planning_time,
    "PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_PLANNING_TIME_INVALID",
  );
  const fence = isoV1(
    input.activation_fence_time,
    "PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_ACTIVATION_FENCE_INVALID",
  );
  if (Date.parse(planning) < Date.parse(fence)) {
    throw new Error("PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_BEFORE_ACTIVATION_FENCE");
  }
  if (input.schedule && input.schedule.source_family !== input.source_family) {
    throw new Error("PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_SCHEDULE_SOURCE_MISMATCH");
  }
  const eligible = input.schedule
    ? isoV1(
        input.schedule.next_poll_eligible_at,
        "PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_NEXT_ELIGIBLE_INVALID",
      )
    : fence;

  if (Date.parse(planning) < Date.parse(eligible)) {
    return {
      status: "NOT_DUE",
      authority_ref: MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_AUTHORITY_REF_V1,
      evaluated_at: planning,
    };
  }
  return {
    status: "DUE",
    authority_ref: MCFT_CAP09_PRODUCTION_EVIDENCE_SOURCE_DUE_POLICY_AUTHORITY_REF_V1,
    evaluated_at: planning,
    requested_at: planning,
  };
}
