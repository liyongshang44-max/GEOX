export type Stage1PhysicalQcConsumptionModeV1 =
  | "QUALIFIED"
  | "REJECTED_INVALID"
  | "REJECTED_UNKNOWN"
  | "REJECTED_MISSING_QC"
  | "REJECTED_NON_FORMAL"
  | "LEGACY_COMPATIBILITY";

export type Stage1PhysicalQcConsumptionDecisionV1 = {
  eligible: boolean;
  mode: Stage1PhysicalQcConsumptionModeV1;
  reason_code:
    | "STAGE1_PHYSICAL_QC_PASS"
    | "STAGE1_PHYSICAL_QC_INVALID"
    | "STAGE1_PHYSICAL_QC_UNKNOWN"
    | "STAGE1_PHYSICAL_QC_MISSING"
    | "STAGE1_NOT_FORMAL_ELIGIBLE"
    | "STAGE1_LEGACY_UNCLASSIFIED_COMPATIBILITY";
};

/**
 * B-04c bounded Stage-1 consumption guard.
 *
 * Current official ingress paths explicitly set formal_eligible=true.
 * Those observations MUST carry a B-04b ingress physical-QC snapshot and
 * MUST be physically VALID/PASS before they can be consumed as Stage-1
 * physical-state evidence.
 *
 * Historical/unclassified records that predate the explicit formal_eligible
 * contract remain on a compatibility seam in this subphase. They are not
 * silently reclassified as qualified evidence; the decision mode makes that
 * seam explicit for audit and later convergence work.
 */
export function evaluateStage1PhysicalQcConsumptionV1(payload: any): Stage1PhysicalQcConsumptionDecisionV1 {
  if (payload?.formal_eligible === false) {
    return {
      eligible: false,
      mode: "REJECTED_NON_FORMAL",
      reason_code: "STAGE1_NOT_FORMAL_ELIGIBLE",
    };
  }

  if (payload?.formal_eligible !== true) {
    return {
      eligible: true,
      mode: "LEGACY_COMPATIBILITY",
      reason_code: "STAGE1_LEGACY_UNCLASSIFIED_COMPATIBILITY",
    };
  }

  const snapshot = payload?.ingress_physical_qc;
  const qc = snapshot?.physical_qc;
  if (!snapshot || snapshot?.schema_version !== "ingress_physical_qc_snapshot_v1" || !qc) {
    return {
      eligible: false,
      mode: "REJECTED_MISSING_QC",
      reason_code: "STAGE1_PHYSICAL_QC_MISSING",
    };
  }

  const health = String(qc?.measurement_health ?? "").trim().toUpperCase();
  const validity = String(qc?.physical_validity ?? "").trim().toUpperCase();

  if (health === "VALID" && validity === "PASS") {
    return {
      eligible: true,
      mode: "QUALIFIED",
      reason_code: "STAGE1_PHYSICAL_QC_PASS",
    };
  }

  if (health === "INVALID" || validity === "FAIL") {
    return {
      eligible: false,
      mode: "REJECTED_INVALID",
      reason_code: "STAGE1_PHYSICAL_QC_INVALID",
    };
  }

  return {
    eligible: false,
    mode: "REJECTED_UNKNOWN",
    reason_code: "STAGE1_PHYSICAL_QC_UNKNOWN",
  };
}
