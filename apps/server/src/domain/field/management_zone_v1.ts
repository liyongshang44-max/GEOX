import type { Pool } from "pg";

export type ManagementZoneTypeV1 =
  | "IRRIGATION_ZONE"
  | "INSPECTION_ZONE"
  | "SAMPLING_ZONE"
  | "MANAGEMENT_ZONE";

export type ManagementZoneV1 = {
  zone_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_name?: string | null;
  zone_type: ManagementZoneTypeV1;
  geometry: Record<string, unknown>;
  area_ha?: number | null;
  risk_tags: string[];
  agronomy_tags: string[];
  source_refs: string[];
  created_at: number;
  updated_at: number;
};

type UpsertManagementZoneInputV1 = {
  zone_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
  zone_name?: string | null;
  zone_type: string;
  geometry: unknown;
  area_ha?: number | null;
  risk_tags?: unknown;
  agronomy_tags?: unknown;
  source_refs?: unknown;
};

type ZoneScopeInputV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  field_id: string;
};

function assertNonEmpty(name: string, value: unknown): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`INVALID_${name.toUpperCase()}`);
  return normalized;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
}

function normalizeGeometry(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_GEOMETRY");
  }
  return value as Record<string, unknown>;
}

function normalizeAreaHa(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("INVALID_AREA_HA");
  return parsed;
}

function mapRowToZone(row: any): ManagementZoneV1 {
  return {
    zone_id: String(row.zone_id),
    tenant_id: String(row.tenant_id),
    project_id: String(row.project_id),
    group_id: String(row.group_id),
    field_id: String(row.field_id),
    zone_name: row.zone_name == null ? null : String(row.zone_name),
    zone_type: assertManagementZoneTypeV1(String(row.zone_type)),
    geometry: (row.geometry && typeof row.geometry === "object") ? row.geometry : {},
    area_ha: row.area_ha == null ? null : Number(row.area_ha),
    risk_tags: normalizeStringArray(row.risk_tags),
    agronomy_tags: normalizeStringArray(row.agronomy_tags),
    source_refs: normalizeStringArray(row.source_refs),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

export function assertManagementZoneTypeV1(value: string): ManagementZoneTypeV1 {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (
    normalized === "IRRIGATION_ZONE" ||
    normalized === "INSPECTION_ZONE" ||
    normalized === "SAMPLING_ZONE" ||
    normalized === "MANAGEMENT_ZONE"
  ) {
    return normalized;
  }
  throw new Error("INVALID_ZONE_TYPE");
}

export async function upsertManagementZoneV1(pool: Pool, input: UpsertManagementZoneInputV1): Promise<ManagementZoneV1> {
  const zone_id = assertNonEmpty("zone_id", input.zone_id);
  const tenant_id = assertNonEmpty("tenant_id", input.tenant_id);
  const project_id = assertNonEmpty("project_id", input.project_id);
  const group_id = assertNonEmpty("group_id", input.group_id);
  const field_id = assertNonEmpty("field_id", input.field_id);
  const zone_name = input.zone_name == null ? null : String(input.zone_name).trim() || null;
  const zone_type = assertManagementZoneTypeV1(input.zone_type);
  const geometry = normalizeGeometry(input.geometry);
  const area_ha = normalizeAreaHa(input.area_ha);
  const risk_tags = normalizeStringArray(input.risk_tags);
  const agronomy_tags = normalizeStringArray(input.agronomy_tags);
  const source_refs = normalizeStringArray(input.source_refs);
  const now = Date.now();

  const result = await pool.query(
    `INSERT INTO management_zone_v1
      (zone_id, tenant_id, project_id, group_id, field_id, zone_name, zone_type, geometry, area_ha, risk_tags, agronomy_tags, source_refs, created_at, updated_at)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14)
     ON CONFLICT (zone_id)
     DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      project_id = EXCLUDED.project_id,
      group_id = EXCLUDED.group_id,
      field_id = EXCLUDED.field_id,
      zone_name = EXCLUDED.zone_name,
      zone_type = EXCLUDED.zone_type,
      geometry = EXCLUDED.geometry,
      area_ha = EXCLUDED.area_ha,
      risk_tags = EXCLUDED.risk_tags,
      agronomy_tags = EXCLUDED.agronomy_tags,
      source_refs = EXCLUDED.source_refs,
      updated_at = EXCLUDED.updated_at
     RETURNING zone_id, tenant_id, project_id, group_id, field_id, zone_name, zone_type, geometry, area_ha, risk_tags, agronomy_tags, source_refs, created_at, updated_at`,
    [
      zone_id,
      tenant_id,
      project_id,
      group_id,
      field_id,
      zone_name,
      zone_type,
      JSON.stringify(geometry),
      area_ha,
      JSON.stringify(risk_tags),
      JSON.stringify(agronomy_tags),
      JSON.stringify(source_refs),
      now,
      now,
    ],
  );

  return mapRowToZone(result.rows[0]);
}

export async function listManagementZonesByFieldV1(pool: Pool, input: ZoneScopeInputV1): Promise<ManagementZoneV1[]> {
  const tenant_id = assertNonEmpty("tenant_id", input.tenant_id);
  const project_id = assertNonEmpty("project_id", input.project_id);
  const group_id = assertNonEmpty("group_id", input.group_id);
  const field_id = assertNonEmpty("field_id", input.field_id);

  const result = await pool.query(
    `SELECT zone_id, tenant_id, project_id, group_id, field_id, zone_name, zone_type, geometry, area_ha, risk_tags, agronomy_tags, source_refs, created_at, updated_at
       FROM management_zone_v1
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4
      ORDER BY zone_id ASC`,
    [tenant_id, project_id, group_id, field_id],
  );

  return (result.rows ?? []).map(mapRowToZone);
}

export async function getManagementZoneByIdV1(
  pool: Pool,
  input: ZoneScopeInputV1 & { zone_id: string },
): Promise<ManagementZoneV1 | null> {
  const tenant_id = assertNonEmpty("tenant_id", input.tenant_id);
  const project_id = assertNonEmpty("project_id", input.project_id);
  const group_id = assertNonEmpty("group_id", input.group_id);
  const field_id = assertNonEmpty("field_id", input.field_id);
  const zone_id = assertNonEmpty("zone_id", input.zone_id);

  const result = await pool.query(
    `SELECT zone_id, tenant_id, project_id, group_id, field_id, zone_name, zone_type, geometry, area_ha, risk_tags, agronomy_tags, source_refs, created_at, updated_at
       FROM management_zone_v1
      WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4 AND zone_id = $5
      LIMIT 1`,
    [tenant_id, project_id, group_id, field_id, zone_id],
  );

  if (!result.rows?.length) return null;
  return mapRowToZone(result.rows[0]);
}
