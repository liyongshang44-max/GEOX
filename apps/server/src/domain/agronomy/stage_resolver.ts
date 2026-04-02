import { resolveCornStage } from "./crops/corn/stages";
import { resolveTomatoStage } from "./crops/tomato/stages";

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

export function resolveCropStage(input: {
  cropCode: string;
  startDate: string | number | Date;
  now?: number;
}): string {
  const cropCode = String(input.cropCode || "").toLowerCase();
  const days = calcDaysFromStart(input.startDate, input.now);

  if (cropCode === "corn") return resolveCornStage(days);
  if (cropCode === "tomato") return resolveTomatoStage(days);

  return "unknown";
}
