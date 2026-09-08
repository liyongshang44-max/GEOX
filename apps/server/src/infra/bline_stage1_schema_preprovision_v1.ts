// apps/server/src/infra/bline_stage1_schema_preprovision_v1.ts
// Purpose: preprovision the Commercial MVP0 Stage1 sensing overview projection under
// the external database-platform identity before long-running Runtime starts.
// Boundary: one-shot B-Line DDL only; never accepts a Runtime credential fallback and
// never grants Runtime schema CREATE authority.

import { Pool } from "pg";

const RUNTIME_ROLE_V1 = "geox_runtime_v1";
const OVERVIEW_RELATION_V1 = "public.field_sensing_overview_v1";
const OVERVIEW_SCOPE_INDEX_V1 = "idx_field_sensing_overview_v1_scope";

const REQUIRED_COLUMNS_V1 = Object.freeze([
  ["tenant_id", "text", true],
  ["project_id", "text", false],
  ["group_id", "text", false],
  ["field_id", "text", true],
  ["observed_at_ts_ms", "bigint", false],
  ["freshness", "text", true],
  ["confidence", "double precision", false],
  ["soil_indicators_json", "jsonb", true],
  ["irrigation_need_level", "text", false],
  ["sensor_quality_level", "text", false],
  ["canopy_temp_status", "text", false],
  ["evapotranspiration_risk", "text", false],
  ["sensor_quality", "text", false],
  ["irrigation_effectiveness", "text", false],
  ["leak_risk", "text", false],
  ["irrigation_action_hint", "text", false],
  ["computed_at_ts_ms", "bigint", false],
  ["source_observed_at_ts_ms", "bigint", false],
  ["explanation_codes_json", "jsonb", true],
  ["source_observation_ids_json", "jsonb", true],
  ["updated_ts_ms", "bigint", true],
] as const);

export type BlineStage1SchemaPreprovisionResultV1 = {
  status: "PASS";
  relation: typeof OVERVIEW_RELATION_V1;
  scope_index: typeof OVERVIEW_SCOPE_INDEX_V1;
  required_column_count: number;
  runtime_schema_create_authority: "FORBIDDEN";
};

async function ensureBlineStage1OverviewSchemaV1(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.field_sensing_overview_v1 (
      tenant_id text NOT NULL,
      project_id text NULL,
      group_id text NULL,
      field_id text NOT NULL,
      observed_at_ts_ms bigint NULL,
      freshness text NOT NULL,
      confidence double precision NULL,
      soil_indicators_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      irrigation_need_level text NULL,
      sensor_quality_level text NULL,
      canopy_temp_status text NULL,
      evapotranspiration_risk text NULL,
      sensor_quality text NULL,
      irrigation_effectiveness text NULL,
      leak_risk text NULL,
      irrigation_action_hint text NULL,
      computed_at_ts_ms bigint NULL,
      source_observed_at_ts_ms bigint NULL,
      explanation_codes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
      updated_ts_ms bigint NOT NULL,
      PRIMARY KEY (tenant_id, field_id)
    );

    ALTER TABLE public.field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS irrigation_need_level text NULL;
    ALTER TABLE public.field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS sensor_quality_level text NULL;
    ALTER TABLE public.field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS canopy_temp_status text NULL;
    ALTER TABLE public.field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS evapotranspiration_risk text NULL;
    ALTER TABLE public.field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS sensor_quality text NULL;
    ALTER TABLE public.field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS irrigation_effectiveness text NULL;
    ALTER TABLE public.field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS leak_risk text NULL;
    ALTER TABLE public.field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS irrigation_action_hint text NULL;
    ALTER TABLE public.field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS computed_at_ts_ms bigint NULL;
    ALTER TABLE public.field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS source_observed_at_ts_ms bigint NULL;
    ALTER TABLE public.field_sensing_overview_v1 ADD COLUMN IF NOT EXISTS source_observation_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb;

    CREATE INDEX IF NOT EXISTS idx_field_sensing_overview_v1_scope
      ON public.field_sensing_overview_v1 (tenant_id, project_id, group_id, field_id);
  `);
}

async function verifyBlineStage1OverviewSchemaV1(pool: Pool): Promise<void> {
  const relation = await pool.query<{ relation: string | null; scope_index: string | null; runtime_can_create_public: boolean }>(`
    SELECT
      pg_catalog.to_regclass('${OVERVIEW_RELATION_V1}')::text AS relation,
      pg_catalog.to_regclass('public.${OVERVIEW_SCOPE_INDEX_V1}')::text AS scope_index,
      pg_catalog.has_schema_privilege('${RUNTIME_ROLE_V1}', 'public', 'CREATE') AS runtime_can_create_public
  `);
  const relationRow = relation.rows[0];
  if (
    relationRow?.relation !== "field_sensing_overview_v1"
    || relationRow?.scope_index !== OVERVIEW_SCOPE_INDEX_V1
    || relationRow.runtime_can_create_public
  ) {
    throw new Error("BLINE_STAGE1_SCHEMA_PREPROVISION_INVALID:RELATION_OR_RUNTIME_AUTHORITY");
  }

  const columns = await pool.query<{ column_name: string; data_type: string; is_nullable: string }>(`
    SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'field_sensing_overview_v1'
  `);
  const byName = new Map(columns.rows.map((row) => [row.column_name, row]));
  for (const [columnName, dataType, notNull] of REQUIRED_COLUMNS_V1) {
    const row = byName.get(columnName);
    if (!row || row.data_type !== dataType || (notNull && row.is_nullable !== "NO")) {
      throw new Error(`BLINE_STAGE1_SCHEMA_PREPROVISION_INVALID:COLUMN:${columnName}`);
    }
  }

  const primaryKey = await pool.query<{ key_columns: string[] }>(`
    SELECT array_agg(attribute.attname ORDER BY key_column.ordinality)::text[] AS key_columns
      FROM pg_catalog.pg_constraint AS constraint_row
      JOIN LATERAL unnest(constraint_row.conkey) WITH ORDINALITY AS key_column(attnum, ordinality) ON true
      JOIN pg_catalog.pg_attribute AS attribute
        ON attribute.attrelid = constraint_row.conrelid
       AND attribute.attnum = key_column.attnum
     WHERE constraint_row.conrelid = 'public.field_sensing_overview_v1'::regclass
       AND constraint_row.contype = 'p'
     GROUP BY constraint_row.oid
  `);
  const keyColumns = primaryKey.rows[0]?.key_columns ?? [];
  if (keyColumns.join(",") !== "tenant_id,field_id") {
    throw new Error("BLINE_STAGE1_SCHEMA_PREPROVISION_INVALID:PRIMARY_KEY");
  }

  const indexDef = await pool.query<{ indexdef: string }>(`
    SELECT indexdef
      FROM pg_catalog.pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'field_sensing_overview_v1'
       AND indexname = '${OVERVIEW_SCOPE_INDEX_V1}'
  `);
  const normalizedIndexDef = String(indexDef.rows[0]?.indexdef ?? "").replace(/\s+/g, " ");
  if (!normalizedIndexDef.includes("(tenant_id, project_id, group_id, field_id)")) {
    throw new Error("BLINE_STAGE1_SCHEMA_PREPROVISION_INVALID:SCOPE_INDEX");
  }
}

export async function runBlineStage1SchemaPreprovisionV1(config: {
  admin_database_url: string;
}): Promise<BlineStage1SchemaPreprovisionResultV1> {
  const adminDatabaseUrl = String(config.admin_database_url || "").trim();
  if (!adminDatabaseUrl) {
    throw new Error("BLINE_STAGE1_SCHEMA_PREPROVISION_INVALID:ADMIN_DATABASE_URL_REQUIRED");
  }
  const pool = new Pool({ connectionString: adminDatabaseUrl, max: 1 });
  try {
    const authority = await pool.query<{ session_user: string; current_user: string }>(
      "SELECT session_user::text AS session_user, current_user::text AS current_user",
    );
    const row = authority.rows[0];
    if (!row || row.session_user !== row.current_user || row.session_user === RUNTIME_ROLE_V1) {
      throw new Error("BLINE_STAGE1_SCHEMA_PREPROVISION_INVALID:PLATFORM_AUTHORITY_REQUIRED");
    }

    await ensureBlineStage1OverviewSchemaV1(pool);
    await verifyBlineStage1OverviewSchemaV1(pool);
    return {
      status: "PASS",
      relation: OVERVIEW_RELATION_V1,
      scope_index: OVERVIEW_SCOPE_INDEX_V1,
      required_column_count: REQUIRED_COLUMNS_V1.length,
      runtime_schema_create_authority: "FORBIDDEN",
    };
  } finally {
    await pool.end();
  }
}

export async function runBlineStage1SchemaPreprovisionFromEnvironmentV1(): Promise<void> {
  const adminDatabaseUrl = String(process.env.GEOX_DB_PLATFORM_ADMIN_DATABASE_URL || "").trim();
  if (!adminDatabaseUrl) {
    throw new Error("BLINE_STAGE1_SCHEMA_PREPROVISION_INVALID:ADMIN_DATABASE_URL_REQUIRED");
  }
  const result = await runBlineStage1SchemaPreprovisionV1({ admin_database_url: adminDatabaseUrl });
  console.log(JSON.stringify(result));
}
