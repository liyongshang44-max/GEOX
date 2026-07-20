// apps/server/src/infra/runtime_skill_registry_compatibility_bootstrap_v1.ts
// Purpose: preprovision the legacy skill-registry read projection before Runtime request handling.
// Boundary: external one-shot additive schema compatibility only; no Skill fact, binding, run, route, or projection row is synthesized.

import { Pool, type PoolClient } from "pg";

export const RUNTIME_SKILL_REGISTRY_READ_RELATION_V1 = "public.skill_registry_read_v1" as const;
export const RUNTIME_SKILL_REGISTRY_READ_INDEX_V1 = "public.idx_skill_registry_read_v1_lookup" as const;

export const RUNTIME_SKILL_REGISTRY_READ_COLUMN_CONTRACT_V1 = [
  { name: "tenant_id", data_type: "text", not_null: true },
  { name: "project_id", data_type: "text", not_null: true },
  { name: "group_id", data_type: "text", not_null: true },
  { name: "fact_type", data_type: "text", not_null: true },
  { name: "fact_id", data_type: "text", not_null: true },
  { name: "skill_id", data_type: "text", not_null: true },
  { name: "version", data_type: "text", not_null: true },
  { name: "category", data_type: "text", not_null: false },
  { name: "legacy_category", data_type: "text", not_null: false },
  { name: "status", data_type: "text", not_null: false },
  { name: "scope_type", data_type: "text", not_null: false },
  { name: "rollout_mode", data_type: "text", not_null: false },
  { name: "result_status", data_type: "text", not_null: false },
  { name: "crop_code", data_type: "text", not_null: false },
  { name: "device_type", data_type: "text", not_null: false },
  { name: "trigger_stage", data_type: "text", not_null: false },
  { name: "bind_target", data_type: "text", not_null: false },
  { name: "operation_id", data_type: "text", not_null: false },
  { name: "operation_plan_id", data_type: "text", not_null: false },
  { name: "field_id", data_type: "text", not_null: false },
  { name: "device_id", data_type: "text", not_null: false },
  { name: "input_digest", data_type: "text", not_null: false },
  { name: "output_digest", data_type: "text", not_null: false },
  { name: "lifecycle_version", data_type: "integer", not_null: false },
  { name: "payload_json", data_type: "jsonb", not_null: true },
  { name: "occurred_at", data_type: "timestamp with time zone", not_null: true },
  { name: "updated_at_ts_ms", data_type: "bigint", not_null: true },
] as const;

export const RUNTIME_SKILL_REGISTRY_READ_REQUIRED_COLUMNS_V1 =
  RUNTIME_SKILL_REGISTRY_READ_COLUMN_CONTRACT_V1.map((column) => column.name);

const RUNTIME_SKILL_REGISTRY_READ_INDEX_COLUMNS_V1 = [
  "tenant_id",
  "project_id",
  "group_id",
  "category",
  "status",
  "crop_code",
  "device_type",
  "trigger_stage",
  "bind_target",
  "updated_at_ts_ms",
] as const;

function normalizeCatalogTextV1(value: unknown): string {
  return String(value ?? "").replaceAll('"', "").replace(/\s+/g, " ").trim().toLowerCase();
}

export async function ensureRuntimeSkillRegistryCompatibilityV1(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.skill_registry_read_v1 (
      tenant_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      fact_type TEXT NOT NULL,
      fact_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      version TEXT NOT NULL,
      category TEXT,
      legacy_category TEXT,
      status TEXT,
      scope_type TEXT,
      rollout_mode TEXT,
      result_status TEXT,
      crop_code TEXT,
      device_type TEXT,
      trigger_stage TEXT,
      bind_target TEXT,
      operation_id TEXT,
      operation_plan_id TEXT,
      field_id TEXT,
      device_id TEXT,
      input_digest TEXT,
      output_digest TEXT,
      lifecycle_version INTEGER,
      payload_json JSONB NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL,
      updated_at_ts_ms BIGINT NOT NULL,
      PRIMARY KEY (fact_id)
    );
    ALTER TABLE public.skill_registry_read_v1
      ADD COLUMN IF NOT EXISTS lifecycle_version INTEGER;
    ALTER TABLE public.skill_registry_read_v1
      ADD COLUMN IF NOT EXISTS legacy_category TEXT;
    CREATE INDEX IF NOT EXISTS idx_skill_registry_read_v1_lookup
      ON public.skill_registry_read_v1 (
        tenant_id,
        project_id,
        group_id,
        category,
        status,
        crop_code,
        device_type,
        trigger_stage,
        bind_target,
        updated_at_ts_ms DESC
      );
  `);
  await assertRuntimeSkillRegistryCompatibilityV1(pool);
}

export async function assertRuntimeSkillRegistryCompatibilityV1(
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
    [RUNTIME_SKILL_REGISTRY_READ_RELATION_V1, RUNTIME_SKILL_REGISTRY_READ_INDEX_V1],
  );
  const relation = relationResult.rows[0];
  if (!relation?.relation_exists || relation.relation_kind !== "r") {
    throw new Error("RUNTIME_SKILL_REGISTRY_COMPATIBILITY_NOT_ESTABLISHED:RELATION");
  }
  if (!relation.index_exists) {
    throw new Error("RUNTIME_SKILL_REGISTRY_COMPATIBILITY_NOT_ESTABLISHED:INDEX");
  }

  const columnResult = await client.query<{
    column_name: string;
    data_type: string;
    not_null: boolean;
  }>(
    `SELECT attribute.attname::text AS column_name,
            pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)::text AS data_type,
            attribute.attnotnull AS not_null
       FROM pg_catalog.pg_attribute AS attribute
      WHERE attribute.attrelid = pg_catalog.to_regclass($1)
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
      ORDER BY attribute.attnum`,
    [RUNTIME_SKILL_REGISTRY_READ_RELATION_V1],
  );
  if (columnResult.rows.length !== RUNTIME_SKILL_REGISTRY_READ_COLUMN_CONTRACT_V1.length) {
    throw new Error("RUNTIME_SKILL_REGISTRY_COMPATIBILITY_NOT_ESTABLISHED:COLUMNS");
  }
  const observedColumns = new Map(columnResult.rows.map((row) => [row.column_name, row]));
  for (const required of RUNTIME_SKILL_REGISTRY_READ_COLUMN_CONTRACT_V1) {
    const observed = observedColumns.get(required.name);
    if (!observed) {
      throw new Error(`RUNTIME_SKILL_REGISTRY_COMPATIBILITY_NOT_ESTABLISHED:COLUMN:${required.name}`);
    }
    if (normalizeCatalogTextV1(observed.data_type) !== normalizeCatalogTextV1(required.data_type)) {
      throw new Error(`RUNTIME_SKILL_REGISTRY_COMPATIBILITY_NOT_ESTABLISHED:TYPE:${required.name}`);
    }
    if (observed.not_null !== required.not_null) {
      throw new Error(`RUNTIME_SKILL_REGISTRY_COMPATIBILITY_NOT_ESTABLISHED:NULLABILITY:${required.name}`);
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
    [RUNTIME_SKILL_REGISTRY_READ_RELATION_V1],
  );
  if (
    primaryKeyResult.rows.length !== 1 ||
    primaryKeyResult.rows[0]?.primary_key_columns?.join(",") !== "fact_id"
  ) {
    throw new Error("RUNTIME_SKILL_REGISTRY_COMPATIBILITY_NOT_ESTABLISHED:PRIMARY_KEY");
  }

  const indexResult = await client.query<{ index_columns: string[]; last_column_desc: boolean }>(
    `SELECT pg_catalog.array_agg(attribute.attname::text ORDER BY key_column.ordinality) AS index_columns,
            pg_catalog.bool_and(
              CASE WHEN key_column.ordinality = index_row.indnkeyatts
                   THEN (index_row.indoption[key_column.ordinality - 1] & 1) = 1
                   ELSE true
              END
            ) AS last_column_desc
       FROM pg_catalog.pg_class AS index_relation
       JOIN pg_catalog.pg_namespace AS index_namespace ON index_namespace.oid = index_relation.relnamespace
       JOIN pg_catalog.pg_index AS index_row ON index_row.indexrelid = index_relation.oid
       CROSS JOIN LATERAL pg_catalog.unnest(index_row.indkey)
         WITH ORDINALITY AS key_column(attnum, ordinality)
       JOIN pg_catalog.pg_attribute AS attribute
         ON attribute.attrelid = index_row.indrelid
        AND attribute.attnum = key_column.attnum
      WHERE index_namespace.nspname = 'public'
        AND index_relation.relname = 'idx_skill_registry_read_v1_lookup'
      GROUP BY index_row.indexrelid, index_row.indnkeyatts`,
  );
  if (
    indexResult.rows.length !== 1 ||
    indexResult.rows[0]?.index_columns?.join(",") !== RUNTIME_SKILL_REGISTRY_READ_INDEX_COLUMNS_V1.join(",") ||
    indexResult.rows[0]?.last_column_desc !== true
  ) {
    throw new Error("RUNTIME_SKILL_REGISTRY_COMPATIBILITY_NOT_ESTABLISHED:INDEX_CONTRACT");
  }
}

export async function runRuntimeSkillRegistryCompatibilityBootstrapFromEnvironmentV1(): Promise<void> {
  const adminDatabaseUrl = String(process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL || "").trim();
  const runtimeDatabaseUrl = String(
    process.env.GEOX_RUNTIME_DATABASE_URL || process.env.DATABASE_URL || "",
  ).trim();
  if (!adminDatabaseUrl) throw new Error("RUNTIME_SKILL_REGISTRY_ADMIN_DATABASE_URL_REQUIRED");
  if (runtimeDatabaseUrl === adminDatabaseUrl) {
    throw new Error("RUNTIME_SKILL_REGISTRY_RUNTIME_CREDENTIAL_FORBIDDEN");
  }
  const pool = new Pool({ connectionString: adminDatabaseUrl, max: 1 });
  try {
    await ensureRuntimeSkillRegistryCompatibilityV1(pool);
    console.log(JSON.stringify({
      status: "PASS",
      relation: RUNTIME_SKILL_REGISTRY_READ_RELATION_V1,
      index: RUNTIME_SKILL_REGISTRY_READ_INDEX_V1,
      required_column_count: RUNTIME_SKILL_REGISTRY_READ_REQUIRED_COLUMNS_V1.length,
      projection_row_synthesized: false,
    }));
  } finally {
    await pool.end();
  }
}
