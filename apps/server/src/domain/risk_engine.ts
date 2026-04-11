export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type RiskEngineInput = {
  final_status?: unknown;
  missing_evidence?: unknown;
  pending_acceptance_elapsed_ms?: unknown;
  pending_acceptance_over_30m?: unknown;
};

export type RiskEngineOutput = {
  level: RiskLevel;
  reasons: string[];
};

type RiskRule = {
  reason: string;
  level: RiskLevel;
  matches: (input: RiskEngineInput) => boolean;
};

const RISK_LEVEL_WEIGHT: Record<RiskLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

const RISK_REASON_ORDER: Record<string, number> = {
  INVALID_EXECUTION: 10,
  MISSING_EVIDENCE: 20,
  PENDING_ACCEPTANCE_OVER_30M: 30,
};

function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const RISK_RULES: RiskRule[] = [
  {
    reason: "INVALID_EXECUTION",
    level: "HIGH",
    matches: (input) => toText(input.final_status).toUpperCase() === "INVALID_EXECUTION",
  },
  {
    reason: "MISSING_EVIDENCE",
    level: "HIGH",
    matches: (input) => input.missing_evidence === true,
  },
  {
    reason: "PENDING_ACCEPTANCE_OVER_30M",
    level: "MEDIUM",
    matches: (input) => {
      if (input.pending_acceptance_over_30m === true) return true;
      const finalStatus = toText(input.final_status).toUpperCase();
      const elapsedMs = toNumber(input.pending_acceptance_elapsed_ms);
      return finalStatus === "PENDING_ACCEPTANCE" && elapsedMs != null && elapsedMs > 30 * 60 * 1000;
    },
  },
];

function compareReasonsStable(a: string, b: string): number {
  const oa = RISK_REASON_ORDER[a] ?? Number.MAX_SAFE_INTEGER;
  const ob = RISK_REASON_ORDER[b] ?? Number.MAX_SAFE_INTEGER;
  if (oa !== ob) return oa - ob;
  return a.localeCompare(b);
}

export function evaluateRisk(input: RiskEngineInput): RiskEngineOutput {
  const hits = RISK_RULES.filter((rule) => rule.matches(input));
  const level = hits.reduce<RiskLevel>((current, rule) => {
    if (RISK_LEVEL_WEIGHT[rule.level] > RISK_LEVEL_WEIGHT[current]) return rule.level;
    return current;
  }, "LOW");

  const reasons = Array.from(new Set(hits.map((rule) => rule.reason))).sort(compareReasonsStable);
  return { level, reasons };
}
