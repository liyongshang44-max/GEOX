// apps/server/src/runtime/twin_runtime/external_formal_cap04_amendment11_candidate_execution_service_v1.ts
// Purpose: public Amendment-11 persistence-free External CAP04 execution seam with a mandatory provider-availability snapshot.
// Boundary: no fixed-lag fallback is exposed here; historical T+432 behavior remains confined to frozen historical/compatibility implementations.

import {
  executeExternalFormalCap04CandidateV1 as executeAmendment11CompatibilityCandidateV1,
  type ExecuteExternalFormalCap04CandidateInputV1 as Amendment11CompatibilityInputV1,
  type ExternalFormalCap04CandidateExecutionResultV1 as Amendment11CompatibilityResultV1,
} from "./external_formal_cap04_amendment11_candidate_execution_internal_v1.js";

export const EXTERNAL_FORMAL_CAP04_AMENDMENT11_CANDIDATE_EXECUTION_SERVICE_ID_V1 =
  "MCFT_CAP09_EXTERNAL_FORMAL_CAP04_AMENDMENT11_CANDIDATE_EXECUTION_SERVICE_V1" as const;

export type ExecuteExternalFormalCap04Amendment11CandidateInputV1 =
  Omit<Amendment11CompatibilityInputV1, "evidence_snapshot_time"> & {
    evidence_snapshot_time: string;
  };

export type ExternalFormalCap04Amendment11CandidateExecutionResultV1 =
  Omit<Amendment11CompatibilityResultV1, "service_id" | "evidence_snapshot_source"> & {
    service_id: typeof EXTERNAL_FORMAL_CAP04_AMENDMENT11_CANDIDATE_EXECUTION_SERVICE_ID_V1;
    evidence_snapshot_source: "CALLER_SUPPLIED";
  };

function canonicalIsoV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

export function executeExternalFormalCap04Amendment11CandidateV1(
  input: ExecuteExternalFormalCap04Amendment11CandidateInputV1,
): ExternalFormalCap04Amendment11CandidateExecutionResultV1 {
  const logicalTime = canonicalIsoV1(input.logical_time, "EXTERNAL_CAP04_AMENDMENT11_LOGICAL_TIME_INVALID");
  const createdAt = canonicalIsoV1(input.created_at, "EXTERNAL_CAP04_AMENDMENT11_CREATED_AT_INVALID");
  const snapshot = canonicalIsoV1(input.evidence_snapshot_time, "EXTERNAL_CAP04_AMENDMENT11_EVIDENCE_SNAPSHOT_TIME_REQUIRED");
  if (!logicalTime.endsWith(":00:00.000Z")) throw new Error("EXTERNAL_CAP04_AMENDMENT11_LOGICAL_TIME_EXACT_HOUR_REQUIRED");
  if (Date.parse(snapshot) < Date.parse(logicalTime)) throw new Error("EXTERNAL_CAP04_AMENDMENT11_EVIDENCE_SNAPSHOT_BEFORE_LOGICAL_TIME");
  if (Date.parse(snapshot) > Date.parse(createdAt)) throw new Error("EXTERNAL_CAP04_AMENDMENT11_EVIDENCE_SNAPSHOT_AFTER_CREATED_AT");

  const result = executeAmendment11CompatibilityCandidateV1({ ...input, evidence_snapshot_time: snapshot });
  if (result.evidence_snapshot_time !== snapshot || result.evidence_snapshot_source !== "CALLER_SUPPLIED") {
    throw new Error("EXTERNAL_CAP04_AMENDMENT11_CALLER_SNAPSHOT_NOT_HONORED");
  }
  return {
    ...result,
    service_id: EXTERNAL_FORMAL_CAP04_AMENDMENT11_CANDIDATE_EXECUTION_SERVICE_ID_V1,
    evidence_snapshot_source: "CALLER_SUPPLIED",
  };
}
