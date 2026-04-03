import { resolveCornStage } from "./crops/corn/stages";
import { resolveTomatoStage } from "./crops/tomato/stages";

const CROP_STAGE_ALLOWLIST: Record<string, Set<string>> = {
  corn: new Set(["seed", "vegetative", "reproductive", "maturity"]),
  tomato: new Set(["seedling", "vegetative", "flowering", "fruiting"]),
};

function toMs(v: string | number | Date): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v instanceof Date) return v.getTime();
  const ms = Date.parse(String(v));
  return Number.isFinite(ms) ? ms : null;
}

function calcDaysFromStart(startDate: string | number | Date, now?: number): number {
  const startMs = toMs(startDate);
  const nowMs = typeof now === "number" && Number.isFinite(now) ? now : Date.now();
  if (!startMs) return 0;
  const diff = Math.max(0, nowMs - startMs);
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

function normalizeStage(value?: string | null): string | null {
  const stage = String(value ?? "").trim().toLowerCase();
  return stage || null;
}

function resolveByDays(cropCode: string, daysAfterPlanting: number): string {
  if (cropCode === "corn") return resolveCornStage(daysAfterPlanting);
  if (cropCode === "tomato") return resolveTomatoStage(daysAfterPlanting);
  return "unknown";
}

export function resolveCropStage(input: {
  cropCode: string;
  explicitStage?: string | null;
  daysAfterPlanting?: number | null;
  startDate?: string | number | Date;
  now?: number;
}): string {
  const cropCode = String(input.cropCode || "").toLowerCase();
  const stageAllowlist = CROP_STAGE_ALLOWLIST[cropCode];

  const explicitStage = normalizeStage(input.explicitStage);
  if (explicitStage && stageAllowlist?.has(explicitStage)) {
    return explicitStage;
  }

  const hasDays = Number.isFinite(input.daysAfterPlanting);
  if (hasDays) {
    return resolveByDays(cropCode, Math.max(0, Number(input.daysAfterPlanting)));
  }

  if (input.startDate !== undefined) {
    const days = calcDaysFromStart(input.startDate, input.now);
    return resolveByDays(cropCode, days);
  }

  return "unknown";
}
