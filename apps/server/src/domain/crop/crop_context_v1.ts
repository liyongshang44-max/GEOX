import type { Pool } from "pg";
import { projectFieldProgramStateV1 } from "../../projections/field_program_state_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

export type CropContextStatusV1 = "UNKNOWN" | "FALLOW" | "PRE_PLANT" | "PLANTED_UNCONFIRMED" | "PLANTED_CONFIRMED" | "HARVESTED";
export type CropContextSourceV1 = "USER_DECLARED" | "SENSOR_INFERRED" | "REMOTE_SENSING" | "MACHINERY_RECORD" | "MANUAL_VERIFIED";

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
  allowed_actions: {
    allow_crop_specific_diagnosis: boolean;
    allow_crop_specific_prescription: boolean;
    allow_crop_planning: boolean;
  };
};

function text(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s || null;
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

async function loadDeclaredCropContext(pool: Pool, tenant: TenantTriple, field_id: string, season_id?: string | null): Promise<any | null> {
  const q = await pool.query(
    `SELECT record_json::jsonb AS record_json, occurred_at
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'crop_context_v1'
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $1
        AND (record_json::jsonb#>>'{payload,project_id}') = $2
        AND (record_json::jsonb#>>'{payload,group_id}') = $3
        AND (record_json::jsonb#>>'{payload,field_id}') = $4
        AND ($5::text IS NULL OR (record_json::jsonb#>>'{payload,season_id}') = $5)
      ORDER BY occurred_at DESC
      LIMIT 1`,
    [tenant.tenant_id, tenant.project_id, tenant.group_id, field_id, season_id ?? null],
  ).catch(() => ({ rows: [] as any[] }));
  return q.rows?.[0]?.record_json?.payload ?? null;
}

export async function resolveCropContextV1(pool: Pool, tenant: TenantTriple, field_id: string, season_id?: string | null): Promise<CropContextV1> {
  const declared = await loadDeclaredCropContext(pool, tenant, field_id, season_id);
  if (declared) {
    const crop_code = text(declared.crop_code);
    const crop_stage = text(declared.crop_stage);
    const status = normalizeStatus(declared.status, Boolean(crop_code), Boolean(crop_stage));
    return {
      field_id,
      season_id: text(declared.season_id) ?? season_id ?? null,
      status,
      crop_code,
      variety_code: text(declared.variety_code),
      crop_stage,
      planting_date: text(declared.planting_date),
      confidence: Number.isFinite(Number(declared.confidence)) ? Number(declared.confidence) : (status === "PLANTED_CONFIRMED" ? 0.9 : 0.5),
      source: (text(declared.source) ?? "USER_DECLARED") as CropContextSourceV1,
      allowed_actions: allowed(status),
    };
  }

  const programs = await projectFieldProgramStateV1(pool, tenant).catch(() => []);
  const program = programs
    .filter((p) => p.field_id === field_id && (!season_id || p.season_id === season_id))
    .sort((a, b) => Number(b.last_event_ts ?? 0) - Number(a.last_event_ts ?? 0))[0] ?? null;
  if (program) {
    const crop_code = text(program.crop_code);
    const crop_stage = text(program.crop_stage);
    const status = normalizeStatus(program.status, Boolean(crop_code), Boolean(crop_stage));
    return {
      field_id,
      season_id: program.season_id || season_id || null,
      status,
      crop_code,
      variety_code: text(program.variety_code),
      crop_stage,
      planting_date: null,
      confidence: status === "PLANTED_CONFIRMED" ? 0.75 : status === "PLANTED_UNCONFIRMED" ? 0.55 : 0.25,
      source: "USER_DECLARED",
      allowed_actions: allowed(status),
    };
  }

  return {
    field_id,
    season_id: season_id ?? null,
    status: "UNKNOWN",
    crop_code: null,
    variety_code: null,
    crop_stage: null,
    planting_date: null,
    confidence: 0.1,
    source: "USER_DECLARED",
    allowed_actions: allowed("UNKNOWN"),
  };
}

export function isCropSpecificActionV1(actionType: unknown): boolean {
  const a = String(actionType ?? "").trim().toUpperCase();
  return a.includes("IRRIG") || a.includes("FERT") || a.includes("SPRAY") || a.includes("CROP.HEALTH") || a.includes("HEALTH");
}
