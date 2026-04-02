import { resolveCropStage } from "./stage_resolver";

export type AgronomyContext = {
  tenantId: string;
  projectId: string;
  groupId: string;
  fieldId: string;
  seasonId?: string;
  programId?: string;

  cropCode: string;
  cropStage: string;

  currentMetrics: {
    soil_moisture?: number | null;
    temperature?: number | null;
    humidity?: number | null;
  };

  constraints?: Record<string, unknown>;
};

type ProgramSource = {
  tenant_id?: unknown;
  project_id?: unknown;
  group_id?: unknown;
  field_id?: unknown;
  season_id?: unknown;
  program_id?: unknown;
  crop_code?: unknown;
  program_start_date?: unknown;
  season_start_date?: unknown;
};

type MetricsSource = {
  soil_moisture?: unknown;
  soil_moisture_pct?: unknown;
  temperature?: unknown;
  air_temperature?: unknown;
  humidity?: unknown;
  air_humidity?: unknown;
};

function toStringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function toOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pickStartDate(program: ProgramSource): string | number | Date {
  const candidate = program.program_start_date ?? program.season_start_date;
  if (candidate instanceof Date || typeof candidate === "number") return candidate;

  const text = toStringValue(candidate);
  if (text) return text;

  return Date.now();
}

export function buildAgronomyContext(input: {
  program: ProgramSource;
  currentMetrics?: MetricsSource | null;
  now?: number;
  constraints?: Record<string, unknown>;
}): AgronomyContext {
  const program = input.program ?? {};
  const metrics = input.currentMetrics ?? {};

  const cropCode = toStringValue(program.crop_code).toLowerCase();
  const cropStage = resolveCropStage({
    cropCode,
    startDate: pickStartDate(program),
    now: input.now,
  });

  const seasonId = toStringValue(program.season_id);
  const programId = toStringValue(program.program_id);

  return {
    tenantId: toStringValue(program.tenant_id),
    projectId: toStringValue(program.project_id),
    groupId: toStringValue(program.group_id),
    fieldId: toStringValue(program.field_id),
    seasonId: seasonId || undefined,
    programId: programId || undefined,
    cropCode,
    cropStage,
    currentMetrics: {
      soil_moisture: toOptionalNumber(metrics.soil_moisture ?? metrics.soil_moisture_pct),
      temperature: toOptionalNumber(metrics.temperature ?? metrics.air_temperature),
      humidity: toOptionalNumber(metrics.humidity ?? metrics.air_humidity),
    },
    constraints: input.constraints,
  };
}
