// apps/server/src/infra/runtime_field_fertility_compatibility_bootstrap_v1.ts
// Purpose: preprovision the legacy field-fertility projection before Runtime request handling.
// Boundary: external one-shot additive schema compatibility only; no fertility state, sensing fact, recommendation, operation, or action is synthesized.

import { Pool, type PoolClient } from "pg";

export const RUNTIME_FIELD_FERTILITY_RELATION_V1 = "public.field_fertility_state_v1" as const;
export const RUNTIME_FIELD_FERTILITY_INDEX_V1 = "public.idx_field_fertility_state_v1_scope" as const;

export const RUNTIME_FIELD_FERTILITY_COLUMN_CONTRACT_V1 = [
  { name: "tenant_id", data_type: "text", not_null: true },
  { name: "project_id", data_type: "text", not_null: false },
  { name: "group_id", data_type: "text", not_null: false },
  { name: "field_id", data_type: "text", not_null: true },
  { name: "fertility_level", data_type: "text", not_null: false },
  { name: "salinity_risk", data_type: "text", not_null: false },
  { name: "recommendation_bias", data_type: "text", not_null: false },
  { name: "confidence", data_type: "double precision", not_null: false },
  { name: "computed_at_ts_ms", data_type: "bigint", not_null: false },
  { name: "source_observed_at_ts_ms", data_type: "bigint", not_null: false },
  { name: "explanation_codes_json", data_type: "jsonb", not_null: true },
  { name: "source_observation_ids_json", data_type: "jsonb", not_null: true },
  { name: "source_device_ids_json", data_type: "jsonb", not_null: true },
  { name: "updated_ts_ms", data_type: "bigint", not_null: true },
] as const;

const RUNTIME_FIELD_FERTILITY_PRIMARY_KEY_V1 = ["tenant_id", "field_id"] as const;
const RUNTIME_FIELD_FERTILITY_INDEX_COLUMNS_V1 = ["tenant_id", "project_id", "group_id", "field_id"] as const;
const RUNTIME_FIELD_FERTILITY_JSON_DEFAULT_COLUMNS_V1 = [
  "explanation_codes_json",
  "source_observation_ids_json",
  "source_device_ids_json",
] as const;

function normalizeCatalogTextV1(value: unknown): string {
  return String(value ?? "").replaceAll('"', "").replace(/\s+/g, " ").trim().toLowerCase();
}

export async function ensureRuntimeFieldFertilityCompatibilityV1(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.field_fertility_state_v1 (
      tenant_id TEXT NOT NULL,
      project_id TEXT,
      group_id TEXT,
      field_id TEXT NOT NULL,
      fertility_level TEXT,
      salinity_risk TEXT,
      recommendation_bias TEXT,
      confidence DOUBLE PRECISION,
      computed_at_ts_ms BIGINT,
      source_observed_at_ts_ms BIGINT,
      explanation_codes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      source_observation_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      source_device_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_ts_ms BIGINT NOT NULL,
      PRIMARY KEY (tenant_id, field_id)
    );
    ALTER TABLE public.field_fertility_state_v1
      ADD COLUMN IF NOT EXISTS source_observed_at_ts_ms BIGINT;
    ALTER TABLE public.field_fertility_state_v1
      ADD COLUMN IF NOT EXISTS source_observation_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb;
    CREATE INDEX IF NOT EXISTS idx_field_fertility_state_v1_scope
      ON public.field_fertility_state_v1 (tenant_id, project_id, group_id, field_id);
  `);
  await assertRuntimeFieldFertilityCompatibilityV1(pool);
}

export async function assertRuntimeFieldFertilityCompatibilityV1(
  client: Pick<PoolClient, "query"> | Pick<Pool, "query">,
): Promise<void> {
  const relationResult = await client.query<{
    relation_exists: boolean;
    relation_kind: string | null;
    index_exists: boolean;
  }>(
    `SELECT pg_catalog.to_regclass($1) IS NOT NULL AS relation_exists,
            (SELECT relation.relkind::text
               FROM pg_catalog.pg_class AS relation
              WHERE relation.oid = pg_catalog.to_regclass($1)) AS relation_kind,
            pg_catalog.to_regclass($2) IS NOT NULL AS index_exists`,
    [RUNTIME_FIELD_FERTILITY_RELATION_V1, RUNTIME_FIELD_FERTILITY_INDEX_V1],
  );
  const relation = relationResult.rows[0];
  if (!relation?.relation_exists || relation.relation_kind !== "r") {
    throw new Error("RUNTIME_FIELD_FERTILITY_COMPATIBILITY_NOT_ESTABLISHED:RELATION");
  }
  if (!relation.index_exists) {
    throw new Error("RUNTIME_FIELD_FERTILITY_COMPATIBILITY_NOT_ESTABLISHED:INDEX");
  }

  const columnResult = await client.query<{
    column_name: string;
    data_type: string;
    not_null: boolean;
    default_expression: string | null;
  }>(
    `SELECT attribute.attname::text AS column_name,
            pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)::text AS data_type,
            attribute.attnotnull AS not_null,
            pg_catalog.pg_get_expr(default_row.adbin, default_row.adrelid)::text AS default_expression
       FROM pg_catalog.pg_attribute AS attribute
       LEFT JOIN pg_catalog.pg_attrdef AS default_row
         ON default_row.adrelid = attribute.attrelid
        AND default_row.adnum = attribute.attnum
      WHERE attribute.attrelid = pg_catalog.to_regclass($1)
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
      ORDER BY attribute.attnum`,
    [RUNTIME_FIELD_FERTILITY_RELATION_V1],
  );
  if (columnResult.rows.length !== RUNTIME_FIELD_FERTILITY_COLUMN_CONTRACT_V1.length) {
    throw new Error("RUNTIME_FIELD_FERTILITY_COMPATIBILITY_NOT_ESTABLISHED:COLUMNS");
  }
  const observedColumns = new Map(columnResult.rows.map((row) => [row.column_name, row]));
  for (const required of RUNTIME_FIELD_FERTILITY_COLUMN_CONTRACT_V1) {
    const observed = observedColumns.get(required.name);
    if (!observed) {
      throw new Error(`RUNTIME_FIELD_FERTILITY_COMPATIBILITY_NOT_ESTABLISHED:COLUMN:${required.name}`);
    }
    if (normalizeCatalogTextV1(observed.data_type) !== normalizeCatalogTextV1(required.data_type)) {
      throw new Error(`RUNTIME_FIELD_FERTILITY_COMPATIBILITY_NOT_ESTABLISHED:TYPE:${required.name}`);
    }
    if (observed.not_null !== required.not_null) {
      throw new Error(`RUNTIME_FIELD_FERTILITY_COMPATIBILITY_NOT_ESTABLISHED:NULLABILITY:${required.name}`);
    }
  }
  for (const columnName of RUNTIME_FIELD_FERTILITY_JSON_DEFAULT_COLUMNS_V1) {
    const observedDefault = normalizeCatalogTextV1(observedColumns.get(columnName)?.default_expression);
    if (!observedDefault.includes("'[]'::jsonb")) {
      throw new Error(`RUNTIME_FIELD_FERTILITY_COMPATIBILITY_NOT_ESTABLISHED:DEFAULT:${columnName}`);
    }
  }

  const primaryKeyResult = await client.query<{ primary_key_columns: string[] }>(
    `SELECT pg_catalog.array_agg(attribute.attname::text ORDER BY key_column.ordinality) AS primary_key_columns
       FROM pg_catalog.pg_constraint AS constraint_row
       CROSS JOIN LATERAL pg_catalog.unnest(constraint_row.conkey)
         WITH ORDINALITY AS key_column(attnum, ordinality)
       JOIN pg_catalog.pg_attribute AS attribute
         ON attribute.attrelid = constraint_row.conrelid
        AND attribute.attnum = key_column.attnum
      WHERE constraint_row.conrelid = pg_catalog.to_regclass($1)
        AND constraint_row.contype = 'p'
      GROUP BY constraint_row.oid`,
    [RUNTIME_FIELD_FERTILITY_RELATION_V1],
  );
  if (
    primaryKeyResult.rows.length !== 1 ||
    primaryKeyResult.rows[0]?.primary_key_columns?.join(",") !== RUNTIME_FIELD_FERTILITY_PRIMARY_KEY_V1.join(",")
  ) {
    throw new Error("RUNTIME_FIELD_FERTILITY_COMPATIBILITY_NOT_ESTABLISHED:PRIMARY_KEY");
  }

  const indexResult = await client.query<{ index_columns: string[] }>(
    `SELECT pg_catalog.array_agg(attribute.attname::text ORDER BY key_column.ordinality) AS index_columns
       FROM pg_catalog.pg_class AS index_relation
       JOIN pg_catalog.pg_namespace AS index_namespace ON index_namespace.oid = index_relation.relnamespace
       JOIN pg_catalog.pg_index AS index_row ON index_row.indexrelid = index_relation.oid
       CROSS JOIN LATERAL pg_catalog.unnest(index_row.indkey)
         WITH ORDINALITY AS key_column(attnum, ordinality)
       JOIN pg_catalog.pg_attribute AS attribute
         ON attribute.attrelid = index_row.indrelid
        AND attribute.attnum = key_column.attnum
      WHERE index_namespace.nspname = 'public'
        AND index_relation.relname = 'idx_field_fertility_state_v1_scope'
      GROUP BY index_row.indexrelid`,
  );
  if (
    indexResult.rows.length !== 1 ||
    indexResult.rows[0]?.index_columns?.join(",") !== RUNTIME_FIELD_FERTILITY_INDEX_COLUMNS_V1.join(",")
  ) {
    throw new Error("RUNTIME_FIELD_FERTILITY_COMPATIBILITY_NOT_ESTABLISHED:INDEX_CONTRACT");
  }
}

export async function runRuntimeFieldFertilityCompatibilityBootstrapFromEnvironmentV1(): Promise<void> {
  const adminDatabaseUrl = String(process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL || "").trim();
  const runtimeDatabaseUrl = String(
    process.env.GEOX_RUNTIME_DATABASE_URL || process.env.DATABASE_URL || "",
  ).trim();
  if (!adminDatabaseUrl) throw new Error("RUNTIME_FIELD_FERTILITY_ADMIN_DATABASE_URL_REQUIRED");
  if (runtimeDatabaseUrl === adminDatabaseUrl) {
    throw new Error("RUNTIME_FIELD_FERTILITY_RUNTIME_CREDENTIAL_FORBIDDEN");
  }
  const pool = new Pool({ connectionString: adminDatabaseUrl, max: 1 });
  try {
    await ensureRuntimeFieldFertilityCompatibilityV1(pool);
    console.log(JSON.stringify({
      status: "PASS",
      relation: RUNTIME_FIELD_FERTILITY_RELATION_V1,
      index: RUNTIME_FIELD_FERTILITY_INDEX_V1,
      required_column_count: RUNTIME_FIELD_FERTILITY_COLUMN_CONTRACT_V1.length,
      projection_row_synthesized: false,
    }));
  } finally {
    await pool.end();
  }
}
