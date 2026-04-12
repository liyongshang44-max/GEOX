export const DEFAULT_ALERT_SLA_MS_BY_SEVERITY = {
  CRITICAL: 4 * 60 * 60 * 1000,
  HIGH: 12 * 60 * 60 * 1000,
  MEDIUM: 24 * 60 * 60 * 1000,
  LOW: 72 * 60 * 60 * 1000,
} as const;

export type AlertSlaSeverity = keyof typeof DEFAULT_ALERT_SLA_MS_BY_SEVERITY;

function toEpochMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (value instanceof Date) {
    const ts = value.getTime();
    return Number.isFinite(ts) ? Math.trunc(ts) : null;
  }
  if (typeof value === "string") {
    const ts = Date.parse(value);
    return Number.isFinite(ts) ? Math.trunc(ts) : null;
  }
  return null;
}

function normalizeSeverity(value: unknown): AlertSlaSeverity {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "CRITICAL" || normalized === "HIGH" || normalized === "MEDIUM") return normalized;
  return "LOW";
}

export function deriveDefaultSlaDueAt(input: { severity: unknown; triggeredAt: unknown }): number | null {
  const triggeredAtMs = toEpochMs(input.triggeredAt);
  if (triggeredAtMs == null) return null;
  const severity = normalizeSeverity(input.severity);
  return triggeredAtMs + DEFAULT_ALERT_SLA_MS_BY_SEVERITY[severity];
}

export function isSlaBreached(input: { slaDueAt: unknown; now: unknown }): boolean {
  const slaDueAtMs = toEpochMs(input.slaDueAt);
  if (slaDueAtMs == null) return false;
  const nowMs = toEpochMs(input.now);
  if (nowMs == null) return false;
  return nowMs > slaDueAtMs;
}
