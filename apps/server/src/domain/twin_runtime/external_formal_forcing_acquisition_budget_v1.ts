export const MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1 =
  "FORMAL_FORCING_ACQUISITION_BUDGET_V1" as const;

export const MCFT_CAP09_REQUIRED_FORCING_DELAY_CASES_V1 = [
  "WAKE_DELAY",
  "JOB_START_SETUP_DELAY",
  "PROVIDER_SLOW_PATH",
  "PROMOTION_QUEUE_SETUP_DELAY",
  "REHYDRATION_COMMIT_READBACK_DELAY",
  "CROSS_WAKE_CAPTURE_OVERLAP",
] as const;

export type McftCap09RequiredForcingDelayCaseV1 =
  (typeof MCFT_CAP09_REQUIRED_FORCING_DELAY_CASES_V1)[number];

export type FormalForcingSupplyTimingPhasesV1 = {
  wake_delay_ms: number;
  job_start_setup_ms: number;
  provider_capture_ms: number;
  retained_raw_and_candidate_ms: number;
  promotion_queue_and_setup_ms: number;
  rehydration_promotion_commit_readback_ms: number;
};

export type FormalForcingRealTimingSampleV1 = FormalForcingSupplyTimingPhasesV1 & {
  sample_id: string;
};

export type FormalForcingControlledDelayCaseV1 = FormalForcingSupplyTimingPhasesV1 & {
  case_id: McftCap09RequiredForcingDelayCaseV1;
};

export type FormalForcingAcquisitionBudgetQualificationV1 = {
  schema_version: "geox_mcft_cap09_formal_forcing_acquisition_budget_qualification_v1";
  authority_id: typeof MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1;
  real_samples: readonly FormalForcingRealTimingSampleV1[];
  controlled_delay_cases: readonly FormalForcingControlledDelayCaseV1[];
  selected_budget_ms: number;
  declared_safety_margin_ms: number;
};

export type FormalForcingAcquisitionBudgetAdjudicationV1 = {
  authority_id: typeof MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1;
  status: "PASS";
  real_sample_count: number;
  controlled_delay_case_count: number;
  maximum_real_end_to_end_ms: number;
  maximum_controlled_end_to_end_ms: number;
  measured_envelope_ms: number;
  selected_budget_ms: number;
  safety_margin_ms: number;
  hardcoded_default_budget_minutes: null;
  selection_basis: "MEASURED_ENVELOPE_PLUS_EXPLICIT_MARGIN";
};

const PHASE_KEYS = [
  "wake_delay_ms",
  "job_start_setup_ms",
  "provider_capture_ms",
  "retained_raw_and_candidate_ms",
  "promotion_queue_and_setup_ms",
  "rehydration_promotion_commit_readback_ms",
] as const;

function finiteNonnegativeInteger(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code);
  return value;
}

function requiredText(value: string, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

export function totalFormalForcingSupplyTimingMsV1(value: FormalForcingSupplyTimingPhasesV1): number {
  return PHASE_KEYS.reduce((total, key) => total + finiteNonnegativeInteger(value[key], `FORMAL_FORCING_TIMING_PHASE_INVALID:${key}`), 0);
}

export function adjudicateFormalForcingAcquisitionBudgetV1(
  input: FormalForcingAcquisitionBudgetQualificationV1,
): FormalForcingAcquisitionBudgetAdjudicationV1 {
  if (input?.schema_version !== "geox_mcft_cap09_formal_forcing_acquisition_budget_qualification_v1") {
    throw new Error("FORMAL_FORCING_BUDGET_SCHEMA_REQUIRED");
  }
  if (input.authority_id !== MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1) {
    throw new Error("FORMAL_FORCING_BUDGET_AUTHORITY_REQUIRED");
  }
  if (!Array.isArray(input.real_samples) || input.real_samples.length < 3) {
    throw new Error("FORMAL_FORCING_BUDGET_AT_LEAST_THREE_REAL_SAMPLES_REQUIRED");
  }
  if (!Array.isArray(input.controlled_delay_cases)) {
    throw new Error("FORMAL_FORCING_BUDGET_CONTROLLED_DELAY_CASES_REQUIRED");
  }

  const realTotals = input.real_samples.map((sample) => {
    requiredText(sample.sample_id, "FORMAL_FORCING_BUDGET_REAL_SAMPLE_ID_REQUIRED");
    return totalFormalForcingSupplyTimingMsV1(sample);
  });
  const controlled = new Map<McftCap09RequiredForcingDelayCaseV1, number>();
  for (const item of input.controlled_delay_cases) {
    if (!(MCFT_CAP09_REQUIRED_FORCING_DELAY_CASES_V1 as readonly string[]).includes(item.case_id)) {
      throw new Error(`FORMAL_FORCING_BUDGET_CONTROLLED_CASE_NOT_AUTHORIZED:${String(item.case_id)}`);
    }
    if (controlled.has(item.case_id)) throw new Error(`FORMAL_FORCING_BUDGET_DUPLICATE_CONTROLLED_CASE:${item.case_id}`);
    controlled.set(item.case_id, totalFormalForcingSupplyTimingMsV1(item));
  }
  for (const required of MCFT_CAP09_REQUIRED_FORCING_DELAY_CASES_V1) {
    if (!controlled.has(required)) throw new Error(`FORMAL_FORCING_BUDGET_CONTROLLED_CASE_MISSING:${required}`);
  }

  const maximumReal = Math.max(...realTotals);
  const maximumControlled = Math.max(...controlled.values());
  const envelope = Math.max(maximumReal, maximumControlled);
  const selected = finiteNonnegativeInteger(input.selected_budget_ms, "FORMAL_FORCING_BUDGET_SELECTED_INVALID");
  const declaredMargin = finiteNonnegativeInteger(input.declared_safety_margin_ms, "FORMAL_FORCING_BUDGET_MARGIN_INVALID");
  if (selected <= envelope) throw new Error("FORMAL_FORCING_BUDGET_POSITIVE_SAFETY_MARGIN_REQUIRED");
  const actualMargin = selected - envelope;
  if (declaredMargin !== actualMargin || actualMargin <= 0) {
    throw new Error("FORMAL_FORCING_BUDGET_MARGIN_MUST_EQUAL_SELECTED_MINUS_MEASURED_ENVELOPE");
  }

  return {
    authority_id: MCFT_CAP09_FORMAL_FORCING_ACQUISITION_BUDGET_AUTHORITY_ID_V1,
    status: "PASS",
    real_sample_count: input.real_samples.length,
    controlled_delay_case_count: controlled.size,
    maximum_real_end_to_end_ms: maximumReal,
    maximum_controlled_end_to_end_ms: maximumControlled,
    measured_envelope_ms: envelope,
    selected_budget_ms: selected,
    safety_margin_ms: actualMargin,
    hardcoded_default_budget_minutes: null,
    selection_basis: "MEASURED_ENVELOPE_PLUS_EXPLICIT_MARGIN",
  };
}

export function formalForcingAcquisitionStartDeadlineV1(baseTargetT: string, selectedBudgetMs: number): string {
  const parsed = Date.parse(baseTargetT);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== baseTargetT) {
    throw new Error("FORMAL_FORCING_BASE_TARGET_CANONICAL_ISO_REQUIRED");
  }
  finiteNonnegativeInteger(selectedBudgetMs, "FORMAL_FORCING_BUDGET_SELECTED_INVALID");
  return new Date(parsed - selectedBudgetMs).toISOString();
}
