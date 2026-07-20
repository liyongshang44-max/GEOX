import { Pool } from "pg";

const MCFT_RUNTIME_ROLE_V1 = "geox_runtime_v1";
const RUNTIME_DDL_STATEMENT_V1 = /^(CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COMMENT|DO)\b/i;
const DISPATCH_QUEUE_RELATION_V1 = "public.dispatch_queue_v1";
const DISPATCH_QUEUE_COMMAND_UNIQUE_V1 = "dispatch_queue_v1_command_unique";
const WEATHER_FORECAST_RELATION_V1 = "public.weather_forecast_index_v1";

function databaseUsernameV1(databaseUrl: string): string {
  try {
    return decodeURIComponent(new URL(databaseUrl).username || "");
  } catch {
    return "";
  }
}

function runtimeSchemaGuardRequiredV1(databaseUrl: string): boolean {
  const configuredRole = String(process.env.GEOX_RUNTIME_DATABASE_ROLE ?? "").trim();
  return configuredRole === MCFT_RUNTIME_ROLE_V1 || databaseUsernameV1(databaseUrl) === MCFT_RUNTIME_ROLE_V1;
}

function queryTextV1(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { text?: unknown }).text === "string") {
    return (value as { text: string }).text;
  }
  return null;
}

function normalizeCatalogNameV1(raw: string): string {
  const normalized = raw.replaceAll('"', "").trim();
  return normalized.includes(".") ? normalized : `public.${normalized}`;
}

function normalizeTypeTextV1(raw: string): string {
  return raw.replaceAll('"', "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeSqlV1(raw: string): string {
  return raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\r\n]*/g, " ").replace(/\s+/g, " ").trim();
}

function splitSqlStatementsV1(sql: string): string[] {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function assertRelationExistsV1(rawQuery: (...args: any[]) => Promise<any>, relationName: string): Promise<void> {
  const catalogName = normalizeCatalogNameV1(relationName);
  const result = await rawQuery(
    "SELECT pg_catalog.to_regclass($1) IS NOT NULL AS relation_exists",
    [catalogName],
  );
  if (result.rows?.[0]?.relation_exists !== true) {
    throw new Error(`RUNTIME_SCHEMA_PREPROVISION_REQUIRED:${catalogName}`);
  }
}

async function assertColumnExistsV1(
  rawQuery: (...args: any[]) => Promise<any>,
  relationName: string,
  columnName: string,
): Promise<void> {
  const catalogName = normalizeCatalogNameV1(relationName);
  const normalizedColumnName = columnName.replaceAll('"', "");
  const result = await rawQuery(
    `SELECT pg_catalog.count(*)::int AS column_count
       FROM pg_catalog.pg_attribute
      WHERE attrelid = pg_catalog.to_regclass($1)
        AND attname = $2
        AND attnum > 0
        AND NOT attisdropped`,
    [catalogName, normalizedColumnName],
  );
  if (Number(result.rows?.[0]?.column_count ?? 0) !== 1) {
    throw new Error(`RUNTIME_SCHEMA_COLUMN_PREPROVISION_REQUIRED:${catalogName}.${normalizedColumnName}`);
  }
}

async function assertColumnNotNullV1(
  rawQuery: (...args: any[]) => Promise<any>,
  relationName: string,
  columnName: string,
): Promise<void> {
  const catalogName = normalizeCatalogNameV1(relationName);
  const normalizedColumnName = columnName.replaceAll('"', "");
  const result = await rawQuery(
    `SELECT attribute.attnotnull AS is_not_null
       FROM pg_catalog.pg_attribute AS attribute
      WHERE attribute.attrelid = pg_catalog.to_regclass($1)
        AND attribute.attname = $2
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped`,
    [catalogName, normalizedColumnName],
  );
  if (result.rows?.[0]?.is_not_null !== true) {
    throw new Error(`RUNTIME_SCHEMA_COLUMN_NOT_NULL_PREPROVISION_REQUIRED:${catalogName}.${normalizedColumnName}`);
  }
}

async function assertColumnTypeV1(
  rawQuery: (...args: any[]) => Promise<any>,
  relationName: string,
  columnName: string,
  expectedType: string,
): Promise<void> {
  const catalogName = normalizeCatalogNameV1(relationName);
  const normalizedColumnName = columnName.replaceAll('"', "");
  const result = await rawQuery(
    `SELECT pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) AS data_type
       FROM pg_catalog.pg_attribute AS attribute
      WHERE attribute.attrelid = pg_catalog.to_regclass($1)
        AND attribute.attname = $2
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped`,
    [catalogName, normalizedColumnName],
  );
  const observedType = normalizeTypeTextV1(String(result.rows?.[0]?.data_type ?? ""));
  const requiredType = normalizeTypeTextV1(expectedType);
  if (!observedType || observedType !== requiredType) {
    throw new Error(
      `RUNTIME_SCHEMA_COLUMN_TYPE_PREPROVISION_REQUIRED:${catalogName}.${normalizedColumnName}:${requiredType}:${observedType || "MISSING"}`,
    );
  }
}

async function assertConstraintExistsV1(
  rawQuery: (...args: any[]) => Promise<any>,
  relationName: string,
  constraintName: string,
): Promise<void> {
  const catalogName = normalizeCatalogNameV1(relationName);
  const result = await rawQuery(
    `SELECT pg_catalog.count(*)::int AS constraint_count
       FROM pg_catalog.pg_constraint
      WHERE conrelid = pg_catalog.to_regclass($1)
        AND conname = $2`,
    [catalogName, constraintName],
  );
  if (Number(result.rows?.[0]?.constraint_count ?? 0) !== 1) {
    throw new Error(`RUNTIME_SCHEMA_CONSTRAINT_PREPROVISION_REQUIRED:${catalogName}.${constraintName}`);
  }
}

async function assertDispatchQueueLegacyMutationPreprovisionedV1(
  rawQuery: (...args: any[]) => Promise<any>,
  sql: string,
): Promise<boolean> {
  const normalized = normalizeSqlV1(sql);
  if (/^UPDATE\s+(?:public\.)?dispatch_queue_v1\s+SET\s+command_id\s*=\s*act_task_id\s+WHERE\s+command_id\s+IS\s+NULL\s+OR\s+command_id\s*=\s*'';?$/i.test(normalized)) {
    const result = await rawQuery(
      `SELECT pg_catalog.count(*)::int AS pending_count
         FROM public.dispatch_queue_v1
        WHERE command_id IS NULL OR command_id = ''`,
    );
    if (Number(result.rows?.[0]?.pending_count ?? 0) !== 0) {
      throw new Error("RUNTIME_DISPATCH_QUEUE_BACKFILL_PENDING");
    }
    return true;
  }
  if (/^DO\s+\$\$\s*BEGIN\s+IF\s+NOT\s+EXISTS[\s\S]*dispatch_queue_v1_command_unique[\s\S]*END\s+IF[\s\S]*END\s+\$\$;?$/i.test(normalized)) {
    await assertConstraintExistsV1(rawQuery, DISPATCH_QUEUE_RELATION_V1, DISPATCH_QUEUE_COMMAND_UNIQUE_V1);
    return true;
  }
  return false;
}

async function assertWeatherForecastLegacyMutationPreprovisionedV1(
  rawQuery: (...args: any[]) => Promise<any>,
  sql: string,
): Promise<boolean> {
  const normalized = normalizeSqlV1(sql);
  const isExactWeatherBackfill =
    /^UPDATE\s+(?:public\.)?weather_forecast_index_v1\s+SET\s+/i.test(normalized)
    && normalized.includes("issue_time = COALESCE(issue_time, generated_at)")
    && normalized.includes("forecast_version = COALESCE(forecast_version, forecast_id)")
    && normalized.includes("jsonb_build_object(")
    && normalized.includes("WHERE issue_time IS NULL")
    && normalized.includes("OR forecast_version IS NULL")
    && normalized.includes("OR version_json IS NULL")
    && normalized.includes("OR version_json = '{}'::jsonb");
  if (!isExactWeatherBackfill) return false;
  await assertRelationExistsV1(rawQuery, WEATHER_FORECAST_RELATION_V1);
  const result = await rawQuery(
    `SELECT pg_catalog.count(*)::int AS pending_count
       FROM public.weather_forecast_index_v1
      WHERE issue_time IS NULL
         OR forecast_version IS NULL
         OR version_json IS NULL
         OR version_json = '{}'::jsonb`,
  );
  if (Number(result.rows?.[0]?.pending_count ?? 0) !== 0) {
    throw new Error("RUNTIME_WEATHER_FORECAST_BACKFILL_PENDING");
  }
  return true;
}

async function assertRuntimeCompatibilityDdlPreprovisionedV1(
  rawQuery: (...args: any[]) => Promise<any>,
  sql: string,
): Promise<void> {
  const statements = splitSqlStatementsV1(sql);
  const ddlStatements = statements.filter((statement) => RUNTIME_DDL_STATEMENT_V1.test(statement));
  if (!ddlStatements.length) return;

  for (const statement of ddlStatements) {
    const createTable = statement.match(/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([^\s(]+)/i);
    if (createTable) {
      await assertRelationExistsV1(rawQuery, createTable[1]);
      continue;
    }

    const createIndex = statement.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+([^\s(]+)/i);
    if (createIndex) {
      await assertRelationExistsV1(rawQuery, createIndex[1]);
      continue;
    }

    const alterTable = statement.match(/^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([^\s]+)/i);
    if (alterTable) {
      await assertRelationExistsV1(rawQuery, alterTable[1]);
      const columns = [...statement.matchAll(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+([^\s,]+)/gi)]
        .map((match) => match[1]);
      if (columns.length) {
        for (const column of columns) await assertColumnExistsV1(rawQuery, alterTable[1], column);
        continue;
      }
      const alterColumnType = statement.match(
        /^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([^\s]+)\s+ALTER\s+COLUMN\s+([^\s]+)\s+TYPE\s+(.+)$/i,
      );
      if (alterColumnType) {
        await assertColumnTypeV1(rawQuery, alterColumnType[1], alterColumnType[2], alterColumnType[3]);
        continue;
      }
      const notNullColumns = [...statement.matchAll(/ALTER\s+COLUMN\s+([^\s,]+)\s+SET\s+NOT\s+NULL/gi)]
        .map((match) => match[1]);
      if (notNullColumns.length) {
        for (const column of notNullColumns) await assertColumnNotNullV1(rawQuery, alterTable[1], column);
        continue;
      }
      throw new Error(`RUNTIME_DDL_FORBIDDEN:${statement.slice(0, 80)}`);
    }

    throw new Error(`RUNTIME_DDL_FORBIDDEN:${statement.slice(0, 80)}`);
  }
}

function installRuntimeSchemaGuardV1(pool: Pool): void {
  const rawQuery = pool.query.bind(pool) as (...args: any[]) => Promise<any>;
  (pool as any).query = (...incomingArgs: any[]) => {
    const args = [...incomingArgs];
    const callback = typeof args[args.length - 1] === "function" ? args.pop() : null;
    const sql = queryTextV1(args[0]);
    const operation = !sql
      ? rawQuery(...args)
      : (async () => {
          const skipDispatchMutation = await assertDispatchQueueLegacyMutationPreprovisionedV1(rawQuery, sql);
          const skipWeatherMutation = skipDispatchMutation
            ? false
            : await assertWeatherForecastLegacyMutationPreprovisionedV1(rawQuery, sql);
          if (!skipDispatchMutation && !skipWeatherMutation) {
            await assertRuntimeCompatibilityDdlPreprovisionedV1(rawQuery, sql);
          }
          const hasDdl = splitSqlStatementsV1(sql).some((statement) => RUNTIME_DDL_STATEMENT_V1.test(statement));
          if (skipDispatchMutation || skipWeatherMutation || hasDdl) {
            return { command: "RUNTIME_SCHEMA_PREFLIGHT", rowCount: 0, oid: 0, rows: [], fields: [] };
          }
          return rawQuery(...args);
        })();

    if (callback) {
      operation.then((result) => callback(null, result), (error) => callback(error));
      return undefined;
    }
    return operation;
  };
}

export function createDatabasePool(databaseUrl?: string): Pool {
  const resolvedDatabaseUrl = databaseUrl ?? process.env.DATABASE_URL ?? "";
  if (!resolvedDatabaseUrl) {
    throw new Error("Missing DATABASE_URL (expected postgres://user:pass@host:5432/db)");
  }
  const pool = new Pool({ connectionString: resolvedDatabaseUrl });
  if (runtimeSchemaGuardRequiredV1(resolvedDatabaseUrl)) installRuntimeSchemaGuardV1(pool);
  return pool;
}
