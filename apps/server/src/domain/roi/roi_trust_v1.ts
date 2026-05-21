export type RoiTrustLevelV1 =
  | "FORMAL_ACCEPTED"
  | "INTERIM_SUPPORTED"
  | "HYPOTHESIS_ONLY"
  | "SIMULATED_DEV_ONLY"
  | "INSUFFICIENT_FORMAL_EVIDENCE";

export type RoiSourceLaneV1 =
  | "FORMAL_ACCEPTANCE"
  | "AS_EXECUTED_SIGNAL"
  | "FLIGHT_TABLE_DEV"
  | "SKILL_TECHNICAL"
  | "MANUAL_IMPORT";

export type RoiTrustProjectionV1 = {
  trust_level: RoiTrustLevelV1;
  source_lane: RoiSourceLaneV1;
  formal_acceptance_id: string | null;
  formal_evidence_passed: boolean;
  chain_validation_passed: boolean;
  customer_visible_value: boolean;
  trust_reasons: string[];
};

function text(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  return raw || null;
}

function bool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function upper(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function containsDevMarker(row: any): boolean {
  const raw = JSON.stringify(row ?? "").toLowerCase();
  return raw.includes("flight-table")
    || raw.includes("flight_table")
    || raw.includes("simulated_dev_only")
    || raw.includes("irrigation_simulator")
    || raw.includes("sim_trace")
    || raw.includes("flight_table_dev");
}

function inferSourceLane(row: any, fallback: RoiSourceLaneV1): RoiSourceLaneV1 {
  const explicit = upper(row?.source_lane ?? row?.trust_source_lane);
  if (explicit === "FORMAL_ACCEPTANCE") return "FORMAL_ACCEPTANCE";
  if (explicit === "AS_EXECUTED_SIGNAL") return "AS_EXECUTED_SIGNAL";
  if (explicit === "FLIGHT_TABLE_DEV") return "FLIGHT_TABLE_DEV";
  if (explicit === "SKILL_TECHNICAL") return "SKILL_TECHNICAL";
  if (explicit === "MANUAL_IMPORT") return "MANUAL_IMPORT";
  if (containsDevMarker(row)) return "FLIGHT_TABLE_DEV";
  return fallback;
}

function existingTrust(row: any): RoiTrustLevelV1 | null {
  const raw = upper(row?.trust_level);
  if (raw === "FORMAL_ACCEPTED") return "FORMAL_ACCEPTED";
  if (raw === "INTERIM_SUPPORTED") return "INTERIM_SUPPORTED";
  if (raw === "HYPOTHESIS_ONLY") return "HYPOTHESIS_ONLY";
  if (raw === "SIMULATED_DEV_ONLY") return "SIMULATED_DEV_ONLY";
  if (raw === "INSUFFICIENT_FORMAL_EVIDENCE") return "INSUFFICIENT_FORMAL_EVIDENCE";
  return null;
}

function isFormalSourceLane(sourceLane: RoiSourceLaneV1): boolean {
  return sourceLane === "FORMAL_ACCEPTANCE";
}

export function projectRoiTrustV1(row: any, options?: { default_source_lane?: RoiSourceLaneV1 }): RoiTrustProjectionV1 {
  const sourceLane = inferSourceLane(row, options?.default_source_lane ?? "AS_EXECUTED_SIGNAL");
  const formalAcceptanceId = text(row?.formal_acceptance_id);
  const legacyAcceptanceId = text(row?.acceptance_id);
  const formalEvidencePassed = bool(row?.formal_evidence_passed);
  const chainValidationPassed = bool(row?.chain_validation_passed);
  const customerVisibleExplicit = typeof row?.customer_visible_value === "boolean" ? row.customer_visible_value : null;
  const confidenceLevel = upper(row?.confidence?.level ?? row?.confidence_level);
  const valueKind = upper(row?.value_kind);
  const baselineType = upper(row?.baseline_type);
  const reasons: string[] = [];

  if (sourceLane === "FLIGHT_TABLE_DEV") reasons.push("FLIGHT_TABLE_OR_SIMULATED_SOURCE");
  if (sourceLane === "AS_EXECUTED_SIGNAL") reasons.push("AS_EXECUTED_SIGNAL_IS_INTERIM_NOT_FORMAL_VALUE");
  if (sourceLane === "SKILL_TECHNICAL") reasons.push("SKILL_TECHNICAL_IS_NOT_FORMAL_VALUE");
  if (!formalAcceptanceId) reasons.push("FORMAL_ACCEPTANCE_ID_MISSING");
  if (legacyAcceptanceId && !formalAcceptanceId) reasons.push("LEGACY_ACCEPTANCE_ID_NOT_FORMAL_ACCEPTANCE_ID");
  if (!formalEvidencePassed) reasons.push("FORMAL_EVIDENCE_NOT_PASSED");
  if (!chainValidationPassed) reasons.push("CHAIN_VALIDATION_NOT_PASSED");
  if (valueKind === "ASSUMPTION_BASED" || baselineType === "DEFAULT_ASSUMPTION") reasons.push("ASSUMPTION_OR_DEFAULT_BASELINE");
  if (confidenceLevel === "LOW") reasons.push("LOW_CONFIDENCE");

  let trustLevel: RoiTrustLevelV1 = existingTrust(row) ?? "INTERIM_SUPPORTED";
  if (sourceLane === "FLIGHT_TABLE_DEV" || containsDevMarker(row)) trustLevel = "SIMULATED_DEV_ONLY";
  else if (valueKind === "ASSUMPTION_BASED" || baselineType === "DEFAULT_ASSUMPTION") trustLevel = "HYPOTHESIS_ONLY";
  else if (isFormalSourceLane(sourceLane) && formalAcceptanceId && formalEvidencePassed && chainValidationPassed) trustLevel = "FORMAL_ACCEPTED";
  else if (!formalEvidencePassed || !chainValidationPassed || !formalAcceptanceId) trustLevel = "INTERIM_SUPPORTED";

  if (existingTrust(row) === "FORMAL_ACCEPTED" && !isFormalSourceLane(sourceLane)) {
    trustLevel = sourceLane === "FLIGHT_TABLE_DEV" ? "SIMULATED_DEV_ONLY" : "INTERIM_SUPPORTED";
    reasons.push("FORMAL_ACCEPTED_REQUIRES_FORMAL_ACCEPTANCE_SOURCE_LANE");
  }

  const customerVisibleValue = customerVisibleExplicit === true
    ? trustLevel === "FORMAL_ACCEPTED" && isFormalSourceLane(sourceLane)
    : trustLevel === "FORMAL_ACCEPTED" && isFormalSourceLane(sourceLane);

  if (!customerVisibleValue) reasons.push("CUSTOMER_VALUE_NOT_FORMAL");

  return {
    trust_level: trustLevel,
    source_lane: sourceLane,
    formal_acceptance_id: formalAcceptanceId,
    formal_evidence_passed: formalEvidencePassed,
    chain_validation_passed: chainValidationPassed,
    customer_visible_value: customerVisibleValue,
    trust_reasons: Array.from(new Set(reasons)),
  };
}

export function attachRoiTrustV1<T extends Record<string, any>>(row: T, options?: { default_source_lane?: RoiSourceLaneV1 }): T & RoiTrustProjectionV1 {
  const trust = projectRoiTrustV1(row, options);
  return { ...row, ...trust };
}

export function attachRoiTrustListV1<T extends Record<string, any>>(rows: T[], options?: { default_source_lane?: RoiSourceLaneV1 }): Array<T & RoiTrustProjectionV1> {
  return rows.map((row) => attachRoiTrustV1(row, options));
}
