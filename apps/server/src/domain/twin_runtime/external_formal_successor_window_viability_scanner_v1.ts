// apps/server/src/domain/twin_runtime/external_formal_successor_window_viability_scanner_v1.ts
// Purpose: deterministically scan exact UTC 24-slot successor Formal-window candidates against frozen planting-time uncertainty, all frozen FAO stage-length variants, and the T-6h..T+30h conservative crop-stage guard.
// Boundary: pure calculation only; no wall clock, provider, filesystem, database, Runtime Config persistence, epoch selection, scheduler, or Formal execution authority.

export const EXTERNAL_FORMAL_SUCCESSOR_WINDOW_VIABILITY_SCANNER_ID_V1 =
  "MCFT_CAP09_EXTERNAL_FORMAL_SUCCESSOR_WINDOW_VIABILITY_SCANNER_V1" as const;
export const EXTERNAL_FORMAL_NO_CURRENT_SEASON_SUCCESSOR_EPOCH_V1 =
  "NO_CURRENT_SEASON_SUCCESSOR_EPOCH" as const;

export type ExternalFormalAllowedCropStageV1 = "INITIAL" | "DEVELOPMENT" | "MID" | "LATE";
type InternalCropStageV1 = ExternalFormalAllowedCropStageV1 | "PRE_PLANT" | "POST_MODEL_SEASON";
export type ExternalFormalStageLengthVariantV1 = readonly [number, number, number, number];

export type ExternalFormalSuccessorWindowScannerInputV1 = {
  planting_window_utc: {
    start_inclusive: string;
    end_exclusive: string;
  };
  variant_stage_lengths_days: readonly ExternalFormalStageLengthVariantV1[];
  allowed_stage_codes: readonly ExternalFormalAllowedCropStageV1[];
  backward_stability_hours: number;
  forward_transition_guard_hours: number;
  slot_count: 24;
  slot_interval_hours: 1;
  minimum_lead_hours: number;
  earliest_successor_selection_authority_effective_at: string;
};

export type ExternalFormalViableWindowV1 = {
  o00: string;
  o23: string;
  stage_code: ExternalFormalAllowedCropStageV1;
  slot_count: 24;
  slot_interval_hours: 1;
};

export type ExternalFormalViableWindowRangeV1 = {
  first_o00: string;
  last_o00: string;
  stage_code: ExternalFormalAllowedCropStageV1;
  candidate_count: number;
};

export type ExternalFormalSuccessorWindowScanResultV1 = {
  scanner_id: typeof EXTERNAL_FORMAL_SUCCESSOR_WINDOW_VIABILITY_SCANNER_ID_V1;
  scan_deterministic: true;
  future_observations_used: false;
  variant_count: number;
  allowed_stage_codes: ExternalFormalAllowedCropStageV1[];
  viable_windows: ExternalFormalViableWindowV1[];
  viable_window_ranges: ExternalFormalViableWindowRangeV1[];
  latest_complete_current_season_o00: string | null;
  latest_complete_current_season_o23: string | null;
  latest_complete_current_season_stage: ExternalFormalAllowedCropStageV1 | null;
  latest_successor_selection_authority_effective_at: string | null;
  earliest_successor_selection_authority_effective_at: string;
  earliest_authority_misses_latest_selection_deadline_by_seconds: number | null;
  current_season_successor_epoch_eligible: boolean;
  disposition: "CURRENT_SEASON_SUCCESSOR_EPOCH_POSSIBLE" | typeof EXTERNAL_FORMAL_NO_CURRENT_SEASON_SUCCESSOR_EPOCH_V1;
};

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function canonicalIsoV1(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(code);
  return value;
}

function exactUtcHourV1(value: unknown, code: string): string {
  const text = canonicalIsoV1(value, code);
  if (Date.parse(text) % HOUR_MS !== 0) throw new Error(code);
  return text;
}

function positiveIntegerV1(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) throw new Error(code);
  return Number(value);
}

function stageAtElapsedHoursV1(elapsedHours: number, variant: ExternalFormalStageLengthVariantV1): InternalCropStageV1 {
  const [initialDays, developmentDays, midDays, lateDays] = variant;
  if (elapsedHours < 0) return "PRE_PLANT";
  if (elapsedHours < initialDays * 24) return "INITIAL";
  if (elapsedHours < (initialDays + developmentDays) * 24) return "DEVELOPMENT";
  if (elapsedHours < (initialDays + developmentDays + midDays) * 24) return "MID";
  if (elapsedHours < (initialDays + developmentDays + midDays + lateDays) * 24) return "LATE";
  return "POST_MODEL_SEASON";
}

function validateVariantV1(value: ExternalFormalStageLengthVariantV1, index: number): void {
  if (!Array.isArray(value) || value.length !== 4) throw new Error(`SUCCESSOR_WINDOW_VARIANT_INVALID:${index}`);
  for (const [stageIndex, days] of value.entries()) {
    if (!Number.isFinite(days) || days <= 0) throw new Error(`SUCCESSOR_WINDOW_VARIANT_STAGE_DAYS_INVALID:${index}:${stageIndex}`);
  }
}

function conservativeSlotStageV1(input: {
  logical_time_ms: number;
  planting_start_ms: number;
  planting_end_ms: number;
  variants: readonly ExternalFormalStageLengthVariantV1[];
  backward_stability_hours: number;
  forward_transition_guard_hours: number;
  allowed_stages: ReadonlySet<ExternalFormalAllowedCropStageV1>;
}): ExternalFormalAllowedCropStageV1 | null {
  const stages = new Set<InternalCropStageV1>();
  for (const variant of input.variants) {
    const elapsedCandidates = [
      (input.logical_time_ms - input.planting_end_ms) / HOUR_MS,
      (input.logical_time_ms - input.planting_start_ms) / HOUR_MS,
      (input.logical_time_ms - input.backward_stability_hours * HOUR_MS - input.planting_end_ms) / HOUR_MS,
      (input.logical_time_ms + input.forward_transition_guard_hours * HOUR_MS - input.planting_start_ms) / HOUR_MS,
    ];
    for (const elapsed of elapsedCandidates) stages.add(stageAtElapsedHoursV1(elapsed, variant));
  }
  if (stages.size !== 1) return null;
  const [stage] = [...stages];
  if (!input.allowed_stages.has(stage as ExternalFormalAllowedCropStageV1)) return null;
  return stage as ExternalFormalAllowedCropStageV1;
}

function groupRangesV1(windows: readonly ExternalFormalViableWindowV1[]): ExternalFormalViableWindowRangeV1[] {
  if (windows.length === 0) return [];
  const ranges: ExternalFormalViableWindowRangeV1[] = [];
  let first = windows[0];
  let previous = windows[0];
  let count = 1;
  for (const current of windows.slice(1)) {
    const contiguous = Date.parse(current.o00) - Date.parse(previous.o00) === HOUR_MS;
    if (contiguous && current.stage_code === previous.stage_code) {
      previous = current;
      count += 1;
      continue;
    }
    ranges.push({ first_o00: first.o00, last_o00: previous.o00, stage_code: first.stage_code, candidate_count: count });
    first = current;
    previous = current;
    count = 1;
  }
  ranges.push({ first_o00: first.o00, last_o00: previous.o00, stage_code: first.stage_code, candidate_count: count });
  return ranges;
}

export function scanExternalFormalSuccessorWindowViabilityV1(
  input: ExternalFormalSuccessorWindowScannerInputV1,
): ExternalFormalSuccessorWindowScanResultV1 {
  const plantingStart = exactUtcHourV1(input.planting_window_utc.start_inclusive, "SUCCESSOR_WINDOW_PLANTING_START_INVALID");
  const plantingEnd = exactUtcHourV1(input.planting_window_utc.end_exclusive, "SUCCESSOR_WINDOW_PLANTING_END_INVALID");
  const plantingStartMs = Date.parse(plantingStart);
  const plantingEndMs = Date.parse(plantingEnd);
  if (plantingEndMs <= plantingStartMs) throw new Error("SUCCESSOR_WINDOW_PLANTING_WINDOW_INVALID");
  if (input.variant_stage_lengths_days.length < 1) throw new Error("SUCCESSOR_WINDOW_VARIANTS_REQUIRED");
  input.variant_stage_lengths_days.forEach(validateVariantV1);
  const allowedStages = new Set(input.allowed_stage_codes);
  if (allowedStages.size !== input.allowed_stage_codes.length || allowedStages.size < 1) throw new Error("SUCCESSOR_WINDOW_ALLOWED_STAGES_INVALID");
  for (const stage of allowedStages) {
    if (!(["INITIAL", "DEVELOPMENT", "MID", "LATE"] as const).includes(stage)) throw new Error(`SUCCESSOR_WINDOW_ALLOWED_STAGE_INVALID:${stage}`);
  }
  const backwardHours = positiveIntegerV1(input.backward_stability_hours, "SUCCESSOR_WINDOW_BACKWARD_GUARD_INVALID");
  const forwardHours = positiveIntegerV1(input.forward_transition_guard_hours, "SUCCESSOR_WINDOW_FORWARD_GUARD_INVALID");
  const minimumLeadHours = positiveIntegerV1(input.minimum_lead_hours, "SUCCESSOR_WINDOW_MINIMUM_LEAD_INVALID");
  if (input.slot_count !== 24 || input.slot_interval_hours !== 1) throw new Error("SUCCESSOR_WINDOW_EXACT_24_PT1H_REQUIRED");
  const earliestSelection = canonicalIsoV1(
    input.earliest_successor_selection_authority_effective_at,
    "SUCCESSOR_WINDOW_EARLIEST_SELECTION_AUTHORITY_TIME_INVALID",
  );

  const maxTotalStageDays = Math.max(...input.variant_stage_lengths_days.map((variant) => variant.reduce((sum, value) => sum + value, 0)));
  const scanStartMs = plantingStartMs;
  const scanEndMs = plantingEndMs + maxTotalStageDays * DAY_MS;
  const viable: ExternalFormalViableWindowV1[] = [];

  for (let o00Ms = scanStartMs; o00Ms <= scanEndMs; o00Ms += HOUR_MS) {
    let windowStage: ExternalFormalAllowedCropStageV1 | null = null;
    let passed = true;
    for (let slotIndex = 0; slotIndex < 24; slotIndex += 1) {
      const logicalMs = o00Ms + slotIndex * HOUR_MS;
      const stage = conservativeSlotStageV1({
        logical_time_ms: logicalMs,
        planting_start_ms: plantingStartMs,
        planting_end_ms: plantingEndMs,
        variants: input.variant_stage_lengths_days,
        backward_stability_hours: backwardHours,
        forward_transition_guard_hours: forwardHours,
        allowed_stages: allowedStages,
      });
      if (stage === null || (windowStage !== null && windowStage !== stage)) {
        passed = false;
        break;
      }
      windowStage ??= stage;
    }
    if (!passed || windowStage === null) continue;
    viable.push({
      o00: new Date(o00Ms).toISOString(),
      o23: new Date(o00Ms + 23 * HOUR_MS).toISOString(),
      stage_code: windowStage,
      slot_count: 24,
      slot_interval_hours: 1,
    });
  }

  const latest = viable.at(-1) ?? null;
  const latestSelectionMs = latest === null ? null : Date.parse(latest.o00) - minimumLeadHours * HOUR_MS;
  const earliestSelectionMs = Date.parse(earliestSelection);
  const missesBySeconds = latestSelectionMs === null ? null : Math.max(0, Math.trunc((earliestSelectionMs - latestSelectionMs) / 1000));
  const eligible = latestSelectionMs !== null && earliestSelectionMs <= latestSelectionMs;

  return {
    scanner_id: EXTERNAL_FORMAL_SUCCESSOR_WINDOW_VIABILITY_SCANNER_ID_V1,
    scan_deterministic: true,
    future_observations_used: false,
    variant_count: input.variant_stage_lengths_days.length,
    allowed_stage_codes: [...input.allowed_stage_codes],
    viable_windows: viable,
    viable_window_ranges: groupRangesV1(viable),
    latest_complete_current_season_o00: latest?.o00 ?? null,
    latest_complete_current_season_o23: latest?.o23 ?? null,
    latest_complete_current_season_stage: latest?.stage_code ?? null,
    latest_successor_selection_authority_effective_at: latestSelectionMs === null ? null : new Date(latestSelectionMs).toISOString(),
    earliest_successor_selection_authority_effective_at: earliestSelection,
    earliest_authority_misses_latest_selection_deadline_by_seconds: missesBySeconds,
    current_season_successor_epoch_eligible: eligible,
    disposition: eligible ? "CURRENT_SEASON_SUCCESSOR_EPOCH_POSSIBLE" : EXTERNAL_FORMAL_NO_CURRENT_SEASON_SUCCESSOR_EPOCH_V1,
  };
}
