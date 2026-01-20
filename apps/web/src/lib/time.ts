// GEOX/apps/web/src/lib/time.ts
export function fmtTs(ts: number): string {
  const d = new Date(ts);
  // ISO-like but compact, local time.
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export type RangePreset = "24h" | "7d" | "season";

export function presetToRange(
  p: RangePreset,
  endTs: number = Date.now()
): { startTs: number; endTs: number } {
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;

  const startTs =
    p === "24h" ? endTs - oneDay :
    p === "7d"  ? endTs - 7 * oneDay :
                 endTs - 120 * oneDay; // season window placeholder

  return { startTs, endTs };
}
