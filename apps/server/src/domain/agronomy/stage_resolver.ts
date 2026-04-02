import { resolveCornStage } from "./crops/corn/stages";
import { resolveTomatoStage } from "./crops/tomato/stages";

const DAY_MS = 24 * 60 * 60 * 1000;

function toMillis(value: string | number | Date): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}

export function resolveCropStage(input: {
  cropCode: string;
  startDate: string | number | Date;
  now?: number;
}): string {
  const cropCode = String(input.cropCode ?? "").trim().toLowerCase();
  const startMs = toMillis(input.startDate);
  const nowMs = Number.isFinite(input.now) ? Number(input.now) : Date.now();

  if (!Number.isFinite(startMs) || !Number.isFinite(nowMs)) return "unknown";

  const daysFromStart = Math.max(0, Math.floor((nowMs - startMs) / DAY_MS));

  switch (cropCode) {
    case "corn":
      return resolveCornStage(daysFromStart);
    case "tomato":
      return resolveTomatoStage(daysFromStart);
    default:
      return "unknown";
  }
}
