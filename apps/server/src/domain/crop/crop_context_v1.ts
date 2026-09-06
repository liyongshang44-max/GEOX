import type { Pool } from "pg";
import { projectFieldProgramStateV1, type FieldProgramStateV1 } from "../../projections/field_program_state_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

type CropFactCandidate = {
  fact_id: string;
  occurred_at: string;
  payload: Record<string, any>;
};

export type CropContextStatusV1 = "UNKNOWN" | "FALLOW" | "PRE_PLANT" | "PLANTED_UNCONFIRMED" | "PLANTED_CONFIRMED" | "HARVESTED";
export type CropContextSourceV1 = "USER_DECLARED" | "SENSOR_INFERRED" | "REMOTE_SENSING" | "MACHINERY_RECORD" | "MANUAL_VERIFIED";
export type CropContextResolutionStatusV1 = "EXACT" | "UNKNOWN" | "AMBIGUOUS";

export type CropContextV1 = {
  field_id: string;
  season_id: string | null;
  status: CropContextStatusV1;
  crop_code: string | null;
  variety_code: string | null;
  crop_stage: string | null;
  planting_date: string | null;
  confidence: number;
  source: CropContextSourceV1;
  resolution: {
    status: CropContextResolutionStatusV1;
    basis: "EXPLICIT_SEASON" | "PARENT_PROGRAM" | "UNIQUE_DECLARED_SEASON" | "UNIQUE_PROGRAM_SEASON" | "NONE" | "MULTIPLE_SEASONS" | "CONFLICTING_PROGRAM_CONTEXT";
    reason: string | null;
  };
  allowed_actions: {
    allow_crop_specific_diagnosis: boolean;
    allow_crop_specific_prescription: boolean;
    allow_crop_planning: boolean;
  };
};

export type CropContextParentV1 = {
  program_id?: string | null;
};

function text(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

function toMs(v: unknown): number {
  const ms = Date.parse(String(v ?? ""));
  return Number.isFinite(ms) ? ms : 0;
}

function allowed(status: CropContextStatusV1) {
  if (status === "PLANTED_CONFIRMED") return { allow_crop_specific_diagnosis: true, allow_crop_specific_prescription: true, allow_crop_planning: false };
  if (status === "PLANTED_UNCONFIRMED") return { allow_crop_specific_diagnosis: true, allow_crop_specific_prescription: false, allow_crop_planning: false };
  if (status === "PRE_PLANT" || status === "FALLOW" || status === "UNKNOWN") return { allow_crop_specific_diagnosis: false, allow_crop_specific_prescription: false, allow_crop_planning: true };
  return { allow_crop_specific_diagnosis: false, allow_crop_specific_prescription: false, allow_crop_planning: false };
}

function normalizeStatus(raw: unknown, hasCrop: boolean, hasStage: boolean): CropContextStatusV1 {
  const s = String(raw ?? "").trim().toUpperCase();
  if (["UNKNOWN", "FALLOW", "PRE_PLANT", "PLANTED_UNCONFIRMED", "PLANTED_CONFIRMED", "HARVESTED"].includes(s)) return s as CropContextStatusV1;
  if (hasCrop && hasStage) return "PLANTED_CONFIRMED";
  if (hasCrop) return "PLANTED_UNCONFIRMED";
  return "UNKNOWN";
}

function failClosedContext(
  field_id: string,
  season_id: string | null,
  resolutionStatus: "UNKNOWN" | "AMBIGUOUS",
  basis: CropContextV1["resolution"]["basis"],
  reason: string
): CropContextV1 {
  return {
    field_id,
    season_id,
    status: "UNKNOWN",
    crop_code: null,
    variety_code: null,
    crop_stage: null,
    planting_date: null,
    confidence: 0.1,
    source: "USER_DECLARED",
    resolution: { status: resolutionStatus, basis, reason },
    allowed_actions: allowed("UNKNOWN"),
  };
}

async function loadDeclaredCropContextCandidates(
  pool: Pool,
  tenant: TenantTriple,
  field_id: string,
  season_id?: string | null
): Promise<CropFactCandidate[]> {
  const exactSeason = text(season_id);
  const q = await pool.query(
    `SELECT fact_id, occurred_at, (record_json::jsonb #> '{payload}') AS payload
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'crop_context_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (record_json::jsonb#>>'{payload,field_id}') = $4
        AND ($5::text IS NULL OR (record_json::jsonb#>>'{payload,season_id}') = $5)
      ORDER BY occurred_at ASC, fact_id ASC`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, field_id, exactSeason],
  ).catch(() => ({ rows: [] as any[] }));
  return (q.rows ?? []).map((row: any) => ({
    fact_id: String(row.fact_id ?? ""),
    occurred_at: String(row.occurred_at ?? ""),
    payload: (row.payload ?? {}) as Record<string, any>
  }));
}

function selectLatestWithinExactSeason(candidates: CropFactCandidate[], season_id: string): CropFactCandidate | null {
  const exact = candidates.filter((row) => text(row.payload.season_id) === season_id);
  if (!exact.length) return null;
  return [...exact].sort((a, b) => {
    const am = toMs(a.occurred_at);
    const bm = toMs(b.occurred_at);
    if (am !== bm) return bm - am;
    return b.fact_id.localeCompare(a.fact_id);
  })[0];
}

function contextFromDeclared(field_id: string, season_id: string, row: CropFactCandidate, basis: CropContextV1["resolution"]["basis"]): CropContextV1 {
  const declared = row.payload;
  const crop_code = text(declared.crop_code);
  const crop_stage = text(declared.crop_stage);
  const status = normalizeStatus(declared.status, Boolean(crop_code), Boolean(crop_stage));
  return {
    field_id,
    season_id,
    status,
    crop_code,
    variety_code: text(declared.variety_code),
    crop_stage,
    planting_date: text(declared.planting_date),
    confidence: Number.isFinite(Number(declared.confidence)) ? Number(declared.confidence) : (status === "PLANTED_CONFIRMED" ? 0.9 : 0.5),
    source: (text(declared.source) ?? "USER_DECLARED") as CropContextSourceV1,
    resolution: { status: "EXACT", basis, reason: null },
    allowed_actions: allowed(status),
  };
}

function programCropSignature(program: FieldProgramStateV1): string {
  return JSON.stringify({
    crop_code: text(program.crop_code),
    variety_code: text(program.variety_code),
    crop_stage: text(program.crop_stage)
  });
}

function contextFromProgram(field_id: string, season_id: string, program: FieldProgramStateV1, basis: CropContextV1["resolution"]["basis"]): CropContextV1 {
  const crop_code = text(program.crop_code);
  const crop_stage = text(program.crop_stage);
  const status = normalizeStatus(program.status, Boolean(crop_code), Boolean(crop_stage));
  return {
    field_id,
    season_id,
    status,
    crop_code,
    variety_code: text(program.variety_code),
    crop_stage,
    planting_date: null,
    confidence: status === "PLANTED_CONFIRMED" ? 0.75 : status === "PLANTED_UNCONFIRMED" ? 0.55 : 0.25,
    source: "USER_DECLARED",
    resolution: { status: "EXACT", basis, reason: null },
    allowed_actions: allowed(status),
  };
}

export async function resolveCropContextV1(
  pool: Pool,
  tenant: TenantTriple,
  field_id: string,
  season_id?: string | null,
  parent: CropContextParentV1 = {}
): Promise<CropContextV1> {
  const explicitSeason = text(season_id);
  const parentProgramId = text(parent.program_id);
  const programs = await projectFieldProgramStateV1(pool, tenant).catch(() => [] as FieldProgramStateV1[]);

  let exactSeason = explicitSeason;
  let resolutionBasis: CropContextV1["resolution"]["basis"] = explicitSeason ? "EXPLICIT_SEASON" : "NONE";

  if (!exactSeason && parentProgramId) {
    const exactProgram = programs.find((program) => program.program_id === parentProgramId) ?? null;
    if (!exactProgram) {
      return failClosedContext(field_id, null, "UNKNOWN", "PARENT_PROGRAM", `parent program_id ${parentProgramId} was not found`);
    }
    if (exactProgram.field_id !== field_id) {
      return failClosedContext(field_id, null, "AMBIGUOUS", "PARENT_PROGRAM", `parent program_id ${parentProgramId} belongs to field ${exactProgram.field_id}`);
    }
    exactSeason = text(exactProgram.season_id);
    if (!exactSeason) {
      return failClosedContext(field_id, null, "UNKNOWN", "PARENT_PROGRAM", `parent program_id ${parentProgramId} has no season_id`);
    }
    resolutionBasis = "PARENT_PROGRAM";
  }

  let declaredCandidates: CropFactCandidate[] = [];
  if (exactSeason) {
    declaredCandidates = await loadDeclaredCropContextCandidates(pool, tenant, field_id, exactSeason);
  } else {
    declaredCandidates = await loadDeclaredCropContextCandidates(pool, tenant, field_id, null);
    const declaredSeasons = Array.from(new Set(declaredCandidates.map((row) => text(row.payload.season_id)).filter((value): value is string => Boolean(value))));
    if (declaredSeasons.length > 1) {
      return failClosedContext(field_id, null, "AMBIGUOUS", "MULTIPLE_SEASONS", `declared crop context contains multiple seasons: ${declaredSeasons.join(",")}`);
    }
    if (declaredSeasons.length === 1) {
      exactSeason = declaredSeasons[0];
      resolutionBasis = "UNIQUE_DECLARED_SEASON";
    }
  }

  if (!exactSeason) {
    const fieldPrograms = programs.filter((program) => program.field_id === field_id);
    const programSeasons = Array.from(new Set(fieldPrograms.map((program) => text(program.season_id)).filter((value): value is string => Boolean(value))));
    if (programSeasons.length > 1) {
      return failClosedContext(field_id, null, "AMBIGUOUS", "MULTIPLE_SEASONS", `field program context contains multiple seasons: ${programSeasons.join(",")}`);
    }
    if (programSeasons.length === 1) {
      exactSeason = programSeasons[0];
      resolutionBasis = "UNIQUE_PROGRAM_SEASON";
    }
  }

  if (!exactSeason) {
    return failClosedContext(field_id, null, "UNKNOWN", "NONE", "no authoritative season identity is available for the field");
  }

  if (!declaredCandidates.length || !declaredCandidates.some((row) => text(row.payload.season_id) === exactSeason)) {
    declaredCandidates = await loadDeclaredCropContextCandidates(pool, tenant, field_id, exactSeason);
  }
  const declared = selectLatestWithinExactSeason(declaredCandidates, exactSeason);
  if (declared) return contextFromDeclared(field_id, exactSeason, declared, resolutionBasis);

  let exactPrograms = programs.filter((program) => program.field_id === field_id && program.season_id === exactSeason);
  if (parentProgramId) exactPrograms = exactPrograms.filter((program) => program.program_id === parentProgramId);
  if (!exactPrograms.length) {
    return failClosedContext(field_id, exactSeason, "UNKNOWN", resolutionBasis, `season ${exactSeason} is exact but no crop context or field program context exists for it`);
  }
  if (exactPrograms.length > 1) {
    const signatures = new Set(exactPrograms.map(programCropSignature));
    if (signatures.size > 1) {
      return failClosedContext(field_id, exactSeason, "AMBIGUOUS", "CONFLICTING_PROGRAM_CONTEXT", `multiple programs in season ${exactSeason} disagree on crop identity/stage`);
    }
  }
  return contextFromProgram(field_id, exactSeason, exactPrograms[0], resolutionBasis);
}

export function isCropSpecificActionV1(actionType: unknown): boolean {
  const a = String(actionType ?? "").trim().toUpperCase();
  return a.includes("IRRIG") || a.includes("FERT") || a.includes("SPRAY") || a.includes("CROP.HEALTH") || a.includes("HEALTH");
}
