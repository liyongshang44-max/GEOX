import type { SkillTraceV1 } from "@geox/contracts";

type SkillTraceLike = Partial<SkillTraceV1> & {
  skill_trace?: Partial<SkillTraceV1> | null;
  skill_trace_ref?: string | null;
};

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeSkillTrace(input: unknown): SkillTraceV1 | null {
  if (!input || typeof input !== "object") return null;
  const source = ((input as SkillTraceLike).skill_trace && typeof (input as SkillTraceLike).skill_trace === "object")
    ? (input as SkillTraceLike).skill_trace as Record<string, unknown>
    : input as Record<string, unknown>;

  const skill_id = asNonEmptyString(source.skill_id);
  if (!skill_id) return null;

  const skill_version = asNonEmptyString(source.skill_version) ?? undefined;
  const trace_id = asNonEmptyString(source.trace_id) ?? undefined;

  const inputs = source.inputs && typeof source.inputs === "object" ? source.inputs as Record<string, any> : undefined;
  const outputs = source.outputs && typeof source.outputs === "object" ? source.outputs as Record<string, any> : undefined;

  const confidenceRaw = source.confidence;
  const confidenceLevel = confidenceRaw && typeof confidenceRaw === "object"
    ? asNonEmptyString((confidenceRaw as any).level) as "HIGH" | "MEDIUM" | "LOW" | undefined
    : undefined;
  const confidenceBasis = confidenceRaw && typeof confidenceRaw === "object"
    ? asNonEmptyString((confidenceRaw as any).basis) as "measured" | "estimated" | "assumed" | undefined
    : undefined;
  const confidenceReasons = confidenceRaw && typeof confidenceRaw === "object" && Array.isArray((confidenceRaw as any).reasons)
    ? (confidenceRaw as any).reasons.map((x: unknown) => asNonEmptyString(x)).filter(Boolean) as string[]
    : undefined;

  const evidence_refs = Array.isArray(source.evidence_refs)
    ? Array.from(new Set(source.evidence_refs.map((x) => asNonEmptyString(x)).filter(Boolean) as string[]))
    : undefined;

  return {
    skill_id,
    ...(skill_version ? { skill_version } : {}),
    ...(trace_id ? { trace_id } : {}),
    ...(inputs ? { inputs } : {}),
    ...(outputs ? { outputs } : {}),
    ...(confidenceLevel && confidenceBasis ? { confidence: { level: confidenceLevel, basis: confidenceBasis, reasons: confidenceReasons ?? [] } } : {}),
    ...(evidence_refs && evidence_refs.length > 0 ? { evidence_refs } : {}),
  };
}

export function buildSkillTraceRef(input: unknown): string | null {
  const normalized = normalizeSkillTrace(input);
  if (!normalized) return null;
  if (normalized.trace_id) return `skill_trace:${normalized.trace_id}`;
  if (normalized.skill_version) return `skill:${normalized.skill_id}@${normalized.skill_version}`;
  return `skill:${normalized.skill_id}`;
}

export function extractSkillTraceRef(input: unknown): string | null {
  const direct = asNonEmptyString(input);
  if (direct && (direct.startsWith("skill_trace:") || direct.startsWith("skill:"))) return direct;

  if (input && typeof input === "object") {
    const obj = input as SkillTraceLike;
    const ref = asNonEmptyString(obj.skill_trace_ref);
    if (ref && (ref.startsWith("skill_trace:") || ref.startsWith("skill:"))) return ref;
    return buildSkillTraceRef(obj);
  }

  return null;
}
