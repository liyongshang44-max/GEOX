export const DATA_ORIGIN_ENUM = [
  "device_observation",
  "external_background",
  "derived_state",
  "mixed",
] as const;

export type DataOriginValue = typeof DATA_ORIGIN_ENUM[number];

export type SourceMeta = {
  source_kind: DataOriginValue;
  source_type: DataOriginValue;
  data_origin: DataOriginValue;
};

const DATA_ORIGIN_SET = new Set<string>(DATA_ORIGIN_ENUM);

function normalizeEnumValue(value: unknown): DataOriginValue | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (DATA_ORIGIN_SET.has(raw)) return raw as DataOriginValue;
  if (!raw) return null;
  if (raw.includes("mix") || raw.includes("fusion") || raw.includes("blend")) return "mixed";
  if (raw.includes("device") || raw.includes("telemetry") || raw.includes("sensor") || raw.includes("observation") || raw.includes("latest") || raw.includes("series")) return "device_observation";
  if (raw.includes("derive") || raw.includes("rule") || raw.includes("model") || raw.includes("recommend")) return "derived_state";
  return "external_background";
}

export function resolveSourceMeta(input: any, fallback?: Partial<SourceMeta>): SourceMeta {
  const sourceKind = normalizeEnumValue(input?.source_kind ?? input?.sourceKind ?? input?.source ?? input?.meta?.source) ?? fallback?.source_kind ?? "external_background";
  const sourceType = normalizeEnumValue(input?.source_type ?? input?.sourceType ?? input?.source ?? input?.meta?.source_type) ?? fallback?.source_type ?? sourceKind;
  const dataOrigin = normalizeEnumValue(input?.data_origin ?? input?.dataOrigin ?? input?.origin ?? input?.meta?.data_origin) ?? fallback?.data_origin ?? sourceKind;
  return {
    source_kind: sourceKind,
    source_type: sourceType,
    data_origin: dataOrigin,
  };
}

export function formatSourceMeta(meta: { source_kind?: unknown; source_type?: unknown; data_origin?: unknown } | null | undefined): string {
  const sourceKind = normalizeEnumValue(meta?.source_kind);
  const sourceType = normalizeEnumValue(meta?.source_type);
  const dataOrigin = normalizeEnumValue(meta?.data_origin);
  return [sourceKind, sourceType, dataOrigin].filter(Boolean).join(" / ") || "--";
}
