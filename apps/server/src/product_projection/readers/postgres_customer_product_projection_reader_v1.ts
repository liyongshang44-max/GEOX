// Read-only PostgreSQL source adapter for the first canonical Customer Product Projection slice.
// Boundary: SELECT-only. It consumes existing indexes and the canonical MCFT read API; it does not
// create tables, mutate projections, choose authority, or infer business meaning.

import type { Pool } from "pg";

import { PostgresMcftFieldTwinReadApiV1 } from "../../services/mcft_field_twin_read_api_v1.js";
import type { FieldTwinScopeV1 } from "../../domain/field_twin_read_model/contracts_v1.js";

export type ProductCustomerReadScopeV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  allowed_field_ids: readonly string[];
};

export type ProductFieldIdentitySourceV1 = {
  field_id: string;
  display_name: string | null;
  area: number | null;
  area_unit: "ha" | "m2" | null;
  updated_at: string | null;
  source_row: Record<string, unknown>;
};

export type ProductFieldSeasonSourceV1 = {
  field_id: string;
  season_id: string;
  display_name: string | null;
  crop: string | null;
  status: string | null;
  updated_at: string | null;
  source_row: Record<string, unknown>;
};

export type ProductRuntimeScopeSourceV1 = FieldTwinScopeV1;

export type ExactCurrentMcftStateV1 = {
  status: "AVAILABLE";
  scope: FieldTwinScopeV1;
  object_ref: string;
  object_type: string;
  object_hash: string;
  source_fact_ref: string;
  logical_time: string;
  canonical_object: Record<string, unknown>;
  payload: Record<string, unknown>;
};

export type UnavailableCurrentMcftStateV1 = {
  status: "UNAVAILABLE";
  reason_code:
    | "MCFT_RUNTIME_READ_UNAVAILABLE"
    | "MCFT_RUNTIME_ROOT_INCOMPLETE"
    | "MCFT_POSTERIOR_STATE_REF_MISSING"
    | "MCFT_POSTERIOR_SOURCE_FACT_MISSING"
    | "MCFT_POSTERIOR_SOURCE_FACT_MISMATCH";
};

export type CurrentMcftStateReadV1 = ExactCurrentMcftStateV1 | UnavailableCurrentMcftStateV1;

export type OptionalRelationRowsV1<T> = {
  relation_status: "AVAILABLE" | "UNAVAILABLE";
  rows: readonly T[];
};

export class ProductProjectionReadErrorV1 extends Error {
  constructor(
    readonly code: "FIELD_INDEX_UNAVAILABLE" | "FIELD_INDEX_READ_FAILED",
  ) {
    super(code);
    this.name = "ProductProjectionReadErrorV1";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function jsonRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return asRecord(value);
}

function textOrNull(value: unknown): string | null {
  const valueText = String(value ?? "").trim();
  return valueText || null;
}

function finiteNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toIsoFromMsOrDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return new Date(numeric).toISOString();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function exactScopeFromRow(row: Record<string, unknown>): FieldTwinScopeV1 | null {
  const scope = {
    tenant_id: textOrNull(row.tenant_id),
    project_id: textOrNull(row.project_id),
    group_id: textOrNull(row.group_id),
    field_id: textOrNull(row.field_id),
    season_id: textOrNull(row.season_id),
    zone_id: textOrNull(row.zone_id),
  };
  if (Object.values(scope).some((value) => value === null)) return null;
  return scope as FieldTwinScopeV1;
}

function sameScope(object: Record<string, unknown>, scope: FieldTwinScopeV1): boolean {
  return (
    object.tenant_id === scope.tenant_id
    && object.project_id === scope.project_id
    && object.group_id === scope.group_id
    && object.field_id === scope.field_id
    && object.season_id === scope.season_id
    && object.zone_id === scope.zone_id
  );
}

export class PostgresCustomerProductProjectionReaderV1 {
  private readonly mcft: PostgresMcftFieldTwinReadApiV1;

  constructor(private readonly pool: Pool) {
    this.mcft = new PostgresMcftFieldTwinReadApiV1(pool);
  }

  private async relationExists(relation: string): Promise<boolean> {
    const result = await this.pool
      .query<{ relation_name: string | null }>(
        "SELECT pg_catalog.to_regclass($1)::text AS relation_name",
        [relation],
      )
      .catch(() => ({ rows: [{ relation_name: null }] }));
    return Boolean(result.rows?.[0]?.relation_name);
  }

  async readFieldIdentities(scope: ProductCustomerReadScopeV1): Promise<readonly ProductFieldIdentitySourceV1[]> {
    if (!(await this.relationExists("public.field_index_v1"))) {
      throw new ProductProjectionReadErrorV1("FIELD_INDEX_UNAVAILABLE");
    }
    if (scope.allowed_field_ids.length === 0) return [];

    const result = await this.pool
      .query<{ row_json: Record<string, unknown> }>(
        `SELECT to_jsonb(f) AS row_json
           FROM public.field_index_v1 AS f
          WHERE f.tenant_id = $1
            AND f.field_id = ANY($2::text[])
          ORDER BY f.field_id ASC`,
        [scope.tenant_id, [...scope.allowed_field_ids]],
      )
      .catch(() => null);

    if (!result) throw new ProductProjectionReadErrorV1("FIELD_INDEX_READ_FAILED");

    return result.rows.flatMap((entry) => {
      const row = jsonRecord(entry.row_json);
      if (!row) return [];
      const fieldId = textOrNull(row.field_id);
      if (!fieldId || !scope.allowed_field_ids.includes(fieldId)) return [];

      const areaHa = finiteNumberOrNull(row.area_ha);
      const areaM2 = finiteNumberOrNull(row.area_m2);
      const area = areaHa ?? areaM2;
      const areaUnit: "ha" | "m2" | null = areaHa !== null ? "ha" : areaM2 !== null ? "m2" : null;

      return [{
        field_id: fieldId,
        display_name: textOrNull(row.field_name) ?? textOrNull(row.name),
        area,
        area_unit: areaUnit,
        updated_at: toIsoFromMsOrDate(row.updated_ts_ms ?? row.updated_at),
        source_row: row,
      }];
    });
  }

  async readActiveSeasons(
    scope: ProductCustomerReadScopeV1,
  ): Promise<OptionalRelationRowsV1<ProductFieldSeasonSourceV1>> {
    if (!(await this.relationExists("public.field_season_index_v1"))) {
      return { relation_status: "UNAVAILABLE", rows: [] };
    }
    if (scope.allowed_field_ids.length === 0) {
      return { relation_status: "AVAILABLE", rows: [] };
    }

    const result = await this.pool
      .query<{ row_json: Record<string, unknown> }>(
        `SELECT to_jsonb(s) AS row_json
           FROM public.field_season_index_v1 AS s
          WHERE s.tenant_id = $1
            AND s.field_id = ANY($2::text[])
            AND UPPER(COALESCE(to_jsonb(s)->>'status', '')) = 'ACTIVE'
          ORDER BY s.field_id ASC, s.season_id ASC`,
        [scope.tenant_id, [...scope.allowed_field_ids]],
      )
      .catch(() => null);

    if (!result) return { relation_status: "UNAVAILABLE", rows: [] };

    const rows: ProductFieldSeasonSourceV1[] = [];
    for (const entry of result.rows) {
      const row = jsonRecord(entry.row_json);
      if (!row) continue;
      const fieldId = textOrNull(row.field_id);
      const seasonId = textOrNull(row.season_id);
      if (!fieldId || !seasonId || !scope.allowed_field_ids.includes(fieldId)) continue;
      rows.push({
        field_id: fieldId,
        season_id: seasonId,
        display_name: textOrNull(row.name),
        crop: textOrNull(row.crop),
        status: textOrNull(row.status),
        updated_at: toIsoFromMsOrDate(row.updated_ts_ms ?? row.updated_at),
        source_row: row,
      });
    }
    return { relation_status: "AVAILABLE", rows };
  }

  async readRuntimeScopes(
    scope: ProductCustomerReadScopeV1,
  ): Promise<OptionalRelationRowsV1<ProductRuntimeScopeSourceV1>> {
    if (!(await this.relationExists("public.twin_active_lineage_index_v1"))) {
      return { relation_status: "UNAVAILABLE", rows: [] };
    }
    if (scope.allowed_field_ids.length === 0) {
      return { relation_status: "AVAILABLE", rows: [] };
    }

    const result = await this.pool
      .query<Record<string, unknown>>(
        `SELECT tenant_id, project_id, group_id, field_id, season_id, zone_id
           FROM public.twin_active_lineage_index_v1
          WHERE tenant_id = $1
            AND project_id = $2
            AND group_id = $3
            AND field_id = ANY($4::text[])
          ORDER BY field_id ASC, season_id ASC, zone_id ASC`,
        [scope.tenant_id, scope.project_id, scope.group_id, [...scope.allowed_field_ids]],
      )
      .catch(() => null);

    if (!result) return { relation_status: "UNAVAILABLE", rows: [] };

    const rows = result.rows
      .map((row) => exactScopeFromRow(row))
      .filter((value): value is FieldTwinScopeV1 => value !== null)
      .filter((row) => scope.allowed_field_ids.includes(row.field_id));

    return { relation_status: "AVAILABLE", rows };
  }

  async readExactCurrentMcftState(scope: FieldTwinScopeV1): Promise<CurrentMcftStateReadV1> {
    let runtime: Record<string, unknown>;
    try {
      runtime = await this.mcft.readRuntime({ scope });
    } catch {
      return { status: "UNAVAILABLE", reason_code: "MCFT_RUNTIME_READ_UNAVAILABLE" };
    }

    if (runtime.root_graph_status !== "COMPLETE_EXACT_GRAPH") {
      return { status: "UNAVAILABLE", reason_code: "MCFT_RUNTIME_ROOT_INCOMPLETE" };
    }

    const posterior = asRecord(runtime.posterior_state);
    if (!posterior) {
      return { status: "UNAVAILABLE", reason_code: "MCFT_POSTERIOR_STATE_REF_MISSING" };
    }

    const objectRef = textOrNull(posterior.object_ref);
    const objectType = textOrNull(posterior.object_type);
    const objectHash = textOrNull(posterior.object_hash);
    const sourceFactRef = textOrNull(posterior.source_fact_ref);
    if (!objectRef || !objectType || !objectHash || !sourceFactRef) {
      return { status: "UNAVAILABLE", reason_code: "MCFT_POSTERIOR_STATE_REF_MISSING" };
    }

    const factResult = await this.pool
      .query<{ record_json: unknown }>(
        `SELECT record_json
           FROM public.facts
          WHERE fact_id = $1
          LIMIT 2`,
        [sourceFactRef],
      )
      .catch(() => null);

    if (!factResult || factResult.rows.length !== 1) {
      return { status: "UNAVAILABLE", reason_code: "MCFT_POSTERIOR_SOURCE_FACT_MISSING" };
    }

    const factEnvelope = jsonRecord(factResult.rows[0].record_json);
    const canonicalObject = factEnvelope ? jsonRecord(factEnvelope.payload) : null;
    const payload = canonicalObject ? jsonRecord(canonicalObject.payload) : null;
    const logicalTime = canonicalObject ? toIsoFromMsOrDate(canonicalObject.logical_time) : null;

    if (
      !factEnvelope
      || !canonicalObject
      || !payload
      || factEnvelope.type !== objectType
      || canonicalObject.object_id !== objectRef
      || canonicalObject.object_type !== objectType
      || canonicalObject.determinism_hash !== objectHash
      || !logicalTime
      || !sameScope(canonicalObject, scope)
    ) {
      return { status: "UNAVAILABLE", reason_code: "MCFT_POSTERIOR_SOURCE_FACT_MISMATCH" };
    }

    return {
      status: "AVAILABLE",
      scope,
      object_ref: objectRef,
      object_type: objectType,
      object_hash: objectHash,
      source_fact_ref: sourceFactRef,
      logical_time: logicalTime,
      canonical_object: canonicalObject,
      payload,
    };
  }
}
