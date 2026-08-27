export type RawSampleStage1PhysicalQcModeV1 =
  | "QUALIFIED"
  | "INELIGIBLE_INVALID"
  | "INELIGIBLE_UNKNOWN"
  | "LEGACY_UNCLASSIFIED";

export type RawSampleStage1PhysicalQcDecisionV1 = {
  eligible: boolean;
  mode: RawSampleStage1PhysicalQcModeV1;
  reason_code:
    | "RAW_SAMPLE_PHYSICAL_QC_PASS"
    | "RAW_SAMPLE_PHYSICAL_QC_INVALID"
    | "RAW_SAMPLE_PHYSICAL_QC_UNKNOWN"
    | "RAW_SAMPLE_PHYSICAL_QC_LEGACY_UNCLASSIFIED";
};

/**
 * B-04d1 consumer-side interpretation of the B-04b ingress physical-QC snapshot.
 *
 * It does not recalculate physical truth. It only consumes the shared snapshot.
 *
 * Historical raw_samples rows can predate the snapshot. Those rows remain on
 * an explicit compatibility seam in this bounded migration and are not
 * reclassified as canonically qualified evidence.
 */
export function evaluateRawSampleStage1PhysicalQcV1(payload: unknown): RawSampleStage1PhysicalQcDecisionV1 {
  const record = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, any>
    : {};
  const snapshot = record.ingress_physical_qc;
  const qc = snapshot?.physical_qc;

  if (!snapshot || snapshot?.schema_version !== "ingress_physical_qc_snapshot_v1" || !qc) {
    return {
      eligible: true,
      mode: "LEGACY_UNCLASSIFIED",
      reason_code: "RAW_SAMPLE_PHYSICAL_QC_LEGACY_UNCLASSIFIED",
    };
  }

  const health = String(qc?.measurement_health ?? "").trim().toUpperCase();
  const validity = String(qc?.physical_validity ?? "").trim().toUpperCase();

  if (health === "VALID" && validity === "PASS") {
    return {
      eligible: true,
      mode: "QUALIFIED",
      reason_code: "RAW_SAMPLE_PHYSICAL_QC_PASS",
    };
  }

  if (health === "INVALID" || validity === "FAIL") {
    return {
      eligible: false,
      mode: "INELIGIBLE_INVALID",
      reason_code: "RAW_SAMPLE_PHYSICAL_QC_INVALID",
    };
  }

  return {
    eligible: false,
    mode: "INELIGIBLE_UNKNOWN",
    reason_code: "RAW_SAMPLE_PHYSICAL_QC_UNKNOWN",
  };
}
