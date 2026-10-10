import { semanticHashV1 } from "./canonical_identity_v1.js";

export type BiologicalStageEpistemicClassV1 =
  | "DIRECT_OBSERVED_PHENOLOGY"
  | "THERMAL_MODEL_DERIVED"
  | "CALENDAR_MODEL_DERIVED"
  | "REMOTE_SENSING_DERIVED"
  | "FUSED_DERIVED"
  | "UNRESOLVED";

export type BiologicalStageEvidenceRefV1 = {
  ref: string;
  hash: string;
  occurred_at: string | null;
  available_at: string;
};

export type BiologicalStageAuthorityScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  season_id: string;
  zone_id: string;
};

export type ResolveBiologicalStageAuthorityInputV1 = {
  authority_id: string;
  authority_version: string;
  scope: BiologicalStageAuthorityScopeV1;
  crop_code: string;
  cultivar_or_hybrid_id: string | null;
  as_of_logical_time: string;
  valid_from: string;
  valid_until: string;
  epistemic_class: BiologicalStageEpistemicClassV1;
  biological_stage_system: string;
  candidate_biological_stages: readonly string[];
  observed_biological_stage_claimed: boolean;
  evidence: readonly BiologicalStageEvidenceRefV1[];
  method_ref: string;
  method_hash: string;
  uncertainty_contract_ref: string;
  uncertainty_contract_hash: string;
  limitation_codes?: readonly string[];
};

export type BiologicalStageAuthorityV1 = {
  schema_version: "geox_biological_stage_authority_v1";
  authority_id: string;
  authority_version: string;
  scope: BiologicalStageAuthorityScopeV1;
  crop_code: string;
  cultivar_or_hybrid_id: string | null;
  as_of_logical_time: string;
  valid_from: string;
  valid_until: string;
  epistemic_class: BiologicalStageEpistemicClassV1;
  biological_stage_system: string;
  candidate_biological_stages: readonly string[];
  resolved_biological_stage: string | null;
  observed_biological_stage_claimed: boolean;
  evidence_refs: readonly string[];
  evidence_hashes: readonly string[];
  method_ref: string;
  method_hash: string;
  uncertainty_contract_ref: string;
  uncertainty_contract_hash: string;
  limitation_codes: readonly string[];
  determinism_hash: string;
};

export type CornBase50ThermalDayV1 = {
  local_date: string;
  coverage: "COMPLETE" | "PLANTING_DAY_UNCERTAIN" | "MISSING_OR_INVALID";
  max_temp_f: number | null;
  min_temp_f: number | null;
};

export type CornBase50GduBoundsV1 = {
  method_id: "CORN_BASE50_DAILY_EXTREMA_CAP86_FLOOR50_V1";
  lower_gdu: number;
  upper_gdu: number;
  complete_day_count: number;
  planting_uncertain_day_count: number;
  missing_or_invalid_day_count: number;
  day_count: number;
};

export type CornResidualToMaturityStagePolicyV1 = {
  maturity_gdu: number;
  conservative_r5_reference_min_remaining_gdu: number;
};

export type CornResidualToMaturityStageResolutionV1 = {
  lower_accumulated_gdu: number;
  upper_accumulated_gdu: number;
  lower_remaining_gdu: number;
  upper_remaining_gdu: number;
  candidate_biological_stages: readonly string[];
  resolved_biological_stage: string | null;
};

export type CropWaterUseKcScheduleEntryV1 = {
  stage_code: string;
  kc: number;
};

export type CropWaterUseKcResolutionV1 = {
  stage_code: string;
  kc: number;
};

export type BiologicalToWaterUseStageMappingV1 = Readonly<Record<string, readonly string[]>>;

export type WaterUseStageResolutionV1 = {
  candidate_water_use_stages: readonly string[];
  resolved_water_use_stage: string | null;
  biological_stage_authority_hash: string;
};

function requiredText(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function canonicalIso(value: unknown, code: string): string {
  const text = requiredText(value, code);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) throw new Error(code);
  return text;
}

function canonicalDate(value: unknown, code: string): string {
  const text = requiredText(value, code);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(code);
  const parsed = Date.parse(text + "T00:00:00.000Z");
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== text) throw new Error(code);
  return text;
}

function finiteNumber(value: unknown, code: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(code);
  return n;
}

function exactOrderedSet(values: readonly string[], code: string): string[] {
  if (!Array.isArray(values) || values.length === 0) throw new Error(code);
  const out = values.map(function (v) { return requiredText(v, code); });
  if (new Set(out).size !== out.length) throw new Error(code + "_DUPLICATE");
  return out;
}

function canonicalScope(scope: BiologicalStageAuthorityScopeV1): BiologicalStageAuthorityScopeV1 {
  return {
    tenant_id: requiredText(scope.tenant_id, "BIO_STAGE_TENANT_REQUIRED"),
    project_id: requiredText(scope.project_id, "BIO_STAGE_PROJECT_REQUIRED"),
    group_id: requiredText(scope.group_id, "BIO_STAGE_GROUP_REQUIRED"),
    field_id: requiredText(scope.field_id, "BIO_STAGE_FIELD_REQUIRED"),
    season_id: requiredText(scope.season_id, "BIO_STAGE_SEASON_REQUIRED"),
    zone_id: requiredText(scope.zone_id, "BIO_STAGE_ZONE_REQUIRED"),
  };
}

export function resolveBiologicalStageAuthorityV1(
  input: ResolveBiologicalStageAuthorityInputV1,
): BiologicalStageAuthorityV1 {
  const authorityId = requiredText(input.authority_id, "BIO_STAGE_AUTHORITY_ID_REQUIRED");
  const authorityVersion = requiredText(input.authority_version, "BIO_STAGE_AUTHORITY_VERSION_REQUIRED");
  const scope = canonicalScope(input.scope);
  const cropCode = requiredText(input.crop_code, "BIO_STAGE_CROP_REQUIRED");
  const cultivar = input.cultivar_or_hybrid_id === null
    ? null
    : requiredText(input.cultivar_or_hybrid_id, "BIO_STAGE_CULTIVAR_INVALID");
  const asOf = canonicalIso(input.as_of_logical_time, "BIO_STAGE_AS_OF_INVALID");
  const validFrom = canonicalIso(input.valid_from, "BIO_STAGE_VALID_FROM_INVALID");
  const validUntil = canonicalIso(input.valid_until, "BIO_STAGE_VALID_UNTIL_INVALID");
  if (Date.parse(validFrom) > Date.parse(asOf) || Date.parse(asOf) > Date.parse(validUntil)) {
    throw new Error("BIO_STAGE_AS_OF_OUTSIDE_VALIDITY");
  }

  const epistemic = input.epistemic_class;
  const allowedEpistemic: BiologicalStageEpistemicClassV1[] = [
    "DIRECT_OBSERVED_PHENOLOGY",
    "THERMAL_MODEL_DERIVED",
    "CALENDAR_MODEL_DERIVED",
    "REMOTE_SENSING_DERIVED",
    "FUSED_DERIVED",
    "UNRESOLVED",
  ];
  if (!allowedEpistemic.includes(epistemic)) throw new Error("BIO_STAGE_EPISTEMIC_CLASS_INVALID");
  if (epistemic !== "DIRECT_OBSERVED_PHENOLOGY" && input.observed_biological_stage_claimed) {
    throw new Error("BIO_STAGE_DERIVED_CANNOT_CLAIM_OBSERVED");
  }

  const stageSystem = requiredText(input.biological_stage_system, "BIO_STAGE_SYSTEM_REQUIRED");
  const candidates = exactOrderedSet(input.candidate_biological_stages, "BIO_STAGE_CANDIDATES_REQUIRED");
  const evidence = input.evidence.map(function (item, index) {
    const ref = requiredText(item.ref, "BIO_STAGE_EVIDENCE_REF_REQUIRED_" + index);
    const hash = requiredText(item.hash, "BIO_STAGE_EVIDENCE_HASH_REQUIRED_" + index);
    const availableAt = canonicalIso(item.available_at, "BIO_STAGE_EVIDENCE_AVAILABLE_AT_INVALID_" + index);
    if (Date.parse(availableAt) > Date.parse(asOf)) throw new Error("BIO_STAGE_FUTURE_EVIDENCE_FORBIDDEN");
    const occurredAt = item.occurred_at === null
      ? null
      : canonicalIso(item.occurred_at, "BIO_STAGE_EVIDENCE_OCCURRED_AT_INVALID_" + index);
    return { ref: ref, hash: hash, occurred_at: occurredAt, available_at: availableAt };
  });

  const methodRef = requiredText(input.method_ref, "BIO_STAGE_METHOD_REF_REQUIRED");
  const methodHash = requiredText(input.method_hash, "BIO_STAGE_METHOD_HASH_REQUIRED");
  const uncertaintyRef = requiredText(input.uncertainty_contract_ref, "BIO_STAGE_UNCERTAINTY_REF_REQUIRED");
  const uncertaintyHash = requiredText(input.uncertainty_contract_hash, "BIO_STAGE_UNCERTAINTY_HASH_REQUIRED");
  const limitations = Array.from(new Set((input.limitation_codes ?? []).map(function (v) {
    return requiredText(v, "BIO_STAGE_LIMITATION_INVALID");
  }))).sort();

  const resolved = epistemic === "UNRESOLVED" || candidates.length !== 1 ? null : candidates[0]!;
  const observedClaim = epistemic === "DIRECT_OBSERVED_PHENOLOGY"
    ? Boolean(input.observed_biological_stage_claimed)
    : false;

  const semanticPayload = {
    schema_version: "geox_biological_stage_authority_v1",
    authority_id: authorityId,
    authority_version: authorityVersion,
    scope: scope,
    crop_code: cropCode,
    cultivar_or_hybrid_id: cultivar,
    as_of_logical_time: asOf,
    valid_from: validFrom,
    valid_until: validUntil,
    epistemic_class: epistemic,
    biological_stage_system: stageSystem,
    candidate_biological_stages: candidates,
    resolved_biological_stage: resolved,
    observed_biological_stage_claimed: observedClaim,
    evidence: evidence,
    method_ref: methodRef,
    method_hash: methodHash,
    uncertainty_contract_ref: uncertaintyRef,
    uncertainty_contract_hash: uncertaintyHash,
    limitation_codes: limitations,
  };

  return {
    schema_version: "geox_biological_stage_authority_v1",
    authority_id: authorityId,
    authority_version: authorityVersion,
    scope: scope,
    crop_code: cropCode,
    cultivar_or_hybrid_id: cultivar,
    as_of_logical_time: asOf,
    valid_from: validFrom,
    valid_until: validUntil,
    epistemic_class: epistemic,
    biological_stage_system: stageSystem,
    candidate_biological_stages: candidates,
    resolved_biological_stage: resolved,
    observed_biological_stage_claimed: observedClaim,
    evidence_refs: evidence.map(function (x) { return x.ref; }),
    evidence_hashes: evidence.map(function (x) { return x.hash; }),
    method_ref: methodRef,
    method_hash: methodHash,
    uncertainty_contract_ref: uncertaintyRef,
    uncertainty_contract_hash: uncertaintyHash,
    limitation_codes: limitations,
    determinism_hash: semanticHashV1(semanticPayload),
  };
}

export function computeCornBase50DailyGduFromFahrenheitV1(maxTempF: number, minTempF: number): number {
  const maxF = finiteNumber(maxTempF, "BIO_STAGE_GDU_MAX_TEMP_INVALID");
  const minF = finiteNumber(minTempF, "BIO_STAGE_GDU_MIN_TEMP_INVALID");
  if (maxF < minF) throw new Error("BIO_STAGE_GDU_EXTREMA_INVERTED");
  const cappedMax = Math.min(maxF, 86);
  const flooredMin = Math.max(minF, 50);
  return Math.max(0, ((cappedMax + flooredMin) / 2) - 50);
}

export function accumulateCornBase50GduBoundsV1(
  days: readonly CornBase50ThermalDayV1[],
): CornBase50GduBoundsV1 {
  if (!Array.isArray(days) || days.length === 0) throw new Error("BIO_STAGE_GDU_DAYS_REQUIRED");
  let lower = 0;
  let upper = 0;
  let complete = 0;
  let plantingUncertain = 0;
  let missing = 0;
  let priorDate: string | null = null;

  for (const day of days) {
    const date = canonicalDate(day.local_date, "BIO_STAGE_GDU_LOCAL_DATE_INVALID");
    if (priorDate !== null && date <= priorDate) throw new Error("BIO_STAGE_GDU_DATES_NOT_STRICTLY_INCREASING");
    priorDate = date;

    if (day.coverage === "MISSING_OR_INVALID") {
      lower += 0;
      upper += 36;
      missing += 1;
      continue;
    }

    if (day.max_temp_f === null || day.min_temp_f === null) {
      throw new Error("BIO_STAGE_GDU_EXTREMA_REQUIRED_FOR_COVERED_DAY");
    }
    const gdu = computeCornBase50DailyGduFromFahrenheitV1(day.max_temp_f, day.min_temp_f);

    if (day.coverage === "PLANTING_DAY_UNCERTAIN") {
      lower += 0;
      upper += gdu;
      plantingUncertain += 1;
      continue;
    }
    if (day.coverage !== "COMPLETE") throw new Error("BIO_STAGE_GDU_COVERAGE_INVALID");

    lower += gdu;
    upper += gdu;
    complete += 1;
  }

  return {
    method_id: "CORN_BASE50_DAILY_EXTREMA_CAP86_FLOOR50_V1",
    lower_gdu: Number(lower.toFixed(6)),
    upper_gdu: Number(upper.toFixed(6)),
    complete_day_count: complete,
    planting_uncertain_day_count: plantingUncertain,
    missing_or_invalid_day_count: missing,
    day_count: days.length,
  };
}

export function classifyCornResidualToMaturityStageV1(
  bounds: Pick<CornBase50GduBoundsV1, "lower_gdu" | "upper_gdu">,
  policy: CornResidualToMaturityStagePolicyV1,
): CornResidualToMaturityStageResolutionV1 {
  const lowerAccumulated = finiteNumber(bounds.lower_gdu, "BIO_STAGE_RESIDUAL_LOWER_GDU_INVALID");
  const upperAccumulated = finiteNumber(bounds.upper_gdu, "BIO_STAGE_RESIDUAL_UPPER_GDU_INVALID");
  const maturity = finiteNumber(policy.maturity_gdu, "BIO_STAGE_RESIDUAL_MATURITY_GDU_INVALID");
  const r5Remaining = finiteNumber(
    policy.conservative_r5_reference_min_remaining_gdu,
    "BIO_STAGE_RESIDUAL_R5_REFERENCE_INVALID",
  );
  if (lowerAccumulated < 0 || upperAccumulated < 0 || maturity <= 0 || r5Remaining <= 0) {
    throw new Error("BIO_STAGE_RESIDUAL_POLICY_NON_POSITIVE");
  }
  if (lowerAccumulated > upperAccumulated) throw new Error("BIO_STAGE_RESIDUAL_ACCUMULATION_BOUNDS_INVERTED");
  if (r5Remaining >= maturity) throw new Error("BIO_STAGE_RESIDUAL_R5_REFERENCE_OUT_OF_RANGE");

  const lowerRemaining = Math.max(0, maturity - upperAccumulated);
  const upperRemaining = Math.max(0, maturity - lowerAccumulated);

  let candidates: string[];
  if (lowerAccumulated >= maturity) {
    candidates = ["R6_OR_LATER_MODEL_ESTIMATE"];
  } else if (upperAccumulated >= maturity) {
    candidates = ["R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE", "R6_OR_LATER_MODEL_ESTIMATE"];
  } else if (upperRemaining < r5Remaining) {
    candidates = ["R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE"];
  } else {
    candidates = ["PRE_R5_MODEL_ESTIMATE", "R5_DENT_OR_LATER_PRE_R6_MODEL_ESTIMATE"];
  }

  return {
    lower_accumulated_gdu: Number(lowerAccumulated.toFixed(6)),
    upper_accumulated_gdu: Number(upperAccumulated.toFixed(6)),
    lower_remaining_gdu: Number(lowerRemaining.toFixed(6)),
    upper_remaining_gdu: Number(upperRemaining.toFixed(6)),
    candidate_biological_stages: candidates,
    resolved_biological_stage: candidates.length === 1 ? candidates[0]! : null,
  };
}

export function resolveCropWaterUseKcFromFrozenScheduleV1(
  resolvedWaterUseStage: string | null,
  schedule: readonly CropWaterUseKcScheduleEntryV1[],
): CropWaterUseKcResolutionV1 {
  const stage = requiredText(resolvedWaterUseStage, "BIO_STAGE_KC_RESOLVED_STAGE_REQUIRED");
  if (!Array.isArray(schedule) || schedule.length === 0) throw new Error("BIO_STAGE_KC_SCHEDULE_REQUIRED");

  const normalized = schedule.map(function (row, index) {
    const stageCode = requiredText(row.stage_code, "BIO_STAGE_KC_STAGE_CODE_INVALID_" + index);
    const kc = finiteNumber(row.kc, "BIO_STAGE_KC_VALUE_INVALID_" + index);
    if (kc < 0) throw new Error("BIO_STAGE_KC_VALUE_NEGATIVE_" + index);
    return { stage_code: stageCode, kc: kc };
  });

  const duplicateStages = normalized.filter(function (row, index, all) {
    return all.findIndex(function (candidate) { return candidate.stage_code === row.stage_code; }) !== index;
  });
  if (duplicateStages.length > 0) throw new Error("BIO_STAGE_KC_STAGE_DUPLICATE");

  const matches = normalized.filter(function (row) { return row.stage_code === stage; });
  if (matches.length !== 1) throw new Error("BIO_STAGE_KC_EXACT_SINGLETON_LOOKUP_REQUIRED:" + stage);
  return { stage_code: matches[0]!.stage_code, kc: matches[0]!.kc };
}

export function mapBiologicalAuthorityToWaterUseStageV1(
  authority: BiologicalStageAuthorityV1,
  mapping: BiologicalToWaterUseStageMappingV1,
): WaterUseStageResolutionV1 {
  const candidates = new Set<string>();
  for (const biological of authority.candidate_biological_stages) {
    const mapped = mapping[biological];
    if (!mapped || mapped.length === 0) throw new Error("BIO_STAGE_WATER_USE_MAPPING_MISSING:" + biological);
    for (const stage of mapped) candidates.add(requiredText(stage, "BIO_STAGE_WATER_USE_STAGE_INVALID"));
  }
  const ordered = Array.from(candidates).sort();
  return {
    candidate_water_use_stages: ordered,
    resolved_water_use_stage: ordered.length === 1 ? ordered[0]! : null,
    biological_stage_authority_hash: authority.determinism_hash,
  };
}
