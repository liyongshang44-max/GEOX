import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerAdminImportModule } from "./registerAdminImportModule.js";
import { registerAdminGroupsModule } from "./registerAdminGroupsModule.js";
import { registerSecurityAuditV1Routes } from "../../routes/security_audit_v1.js";
import { registerFailSafeV1Routes } from "../../routes/fail_safe_v1.js";
import { getRuntimeSecurityStatusV1 } from "../../runtime/runtime_security_v1.js";

const REQUIRED_SCHEMA = {
  tables: ["facts", "raw_samples", "markers", "sensor_groups", "sensor_group_members", "prescription_contract_v1", "as_executed_record_v1", "as_applied_map_v1", "roi_ledger_v1", "judge_result_v2", "field_memory_v1", "device_observation_index_v1"],
  views: ["facts_replay_v1"],
} as const;

const REQUIRED_TABLE_COLUMNS: Record<string, string[]> = {
  field_memory_v1: [
    "project_id", "group_id", "metric_key", "confidence", "source_type", "source_id",
    "task_id", "acceptance_id", "roi_id", "skill_id", "skill_trace_ref", "summary_text", "occurred_at",
  ],
  device_observation_index_v1: [
    "tenant_id", "project_id", "group_id", "field_id", "device_id", "metric",
    "observed_at_ts_ms", "value_num", "confidence", "fact_id",
  ],
};
const REQUIRED_COLUMN_TYPES: Record<string, Record<string, string>> = {
  field_memory_v1: {
    created_at: "timestamp with time zone",
    occurred_at: "timestamp with time zone",
    confidence: "numeric",
  },
  device_observation_index_v1: {
    observed_at_ts_ms: "bigint",
  },
};

export function registerAdminModule(app: FastifyInstance, pool: Pool): void {
  app.get("/health", async () => ({ ok: true }));
  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/admin/healthz", async (_req, reply) => {
    const missing_tables: string[] = [];
    const missing_views: string[] = [];
    const missing_table_columns: Record<string, string[]> = {};
    const invalid_column_types: Record<string, Record<string, { expected: string; actual: string }>> = {};

    try {
      await pool.query("select now() as now, version() as version");
    } catch {
      return reply.code(200).send({
        ok: false,
        missing_tables: [...REQUIRED_SCHEMA.tables],
        missing_views: [...REQUIRED_SCHEMA.views],
      });
    }

    for (const t of REQUIRED_SCHEMA.tables) {
      const r = await pool.query("select to_regclass($1) as reg", [`public.${t}`]);
      if (!r.rows?.[0]?.reg) missing_tables.push(t);
    }

    for (const v of REQUIRED_SCHEMA.views) {
      const r = await pool.query("select to_regclass($1) as reg", [`public.${v}`]);
      if (!r.rows?.[0]?.reg) missing_views.push(v);
    }

    for (const [tableName, columns] of Object.entries(REQUIRED_TABLE_COLUMNS)) {
      const tableExists = await pool.query("select to_regclass($1) as reg", [`public.${tableName}`]);
      if (!tableExists.rows?.[0]?.reg) continue;
      const missingColumns: string[] = [];
      for (const columnName of columns) {
        const col = await pool.query(
          `SELECT 1
             FROM information_schema.columns
            WHERE table_schema='public' AND table_name=$1 AND column_name=$2
            LIMIT 1`,
          [tableName, columnName]
        );
        if ((col.rowCount ?? 0) < 1) missingColumns.push(columnName);
      }
      if (missingColumns.length > 0) missing_table_columns[tableName] = missingColumns;
    }
    for (const [tableName, typeMap] of Object.entries(REQUIRED_COLUMN_TYPES)) {
      const tableExists = await pool.query("select to_regclass($1) as reg", [`public.${tableName}`]);
      if (!tableExists.rows?.[0]?.reg) continue;
      for (const [columnName, expectedType] of Object.entries(typeMap)) {
        const colType = await pool.query(
          `SELECT data_type
             FROM information_schema.columns
            WHERE table_schema='public' AND table_name=$1 AND column_name=$2
            LIMIT 1`,
          [tableName, columnName]
        );
        const actualType = String(colType.rows?.[0]?.data_type ?? "").trim().toLowerCase();
        if (!actualType) continue;
        if (actualType !== expectedType) {
          if (!invalid_column_types[tableName]) invalid_column_types[tableName] = {};
          invalid_column_types[tableName][columnName] = { expected: expectedType, actual: actualType };
        }
      }
    }

    return reply.send({
      ok: missing_tables.length === 0
        && missing_views.length === 0
        && Object.keys(missing_table_columns).length === 0
        && Object.keys(invalid_column_types).length === 0,
      missing_tables,
      missing_views,
      missing_table_columns,
      invalid_column_types,
      runtime_security: getRuntimeSecurityStatusV1(),
    });
  });

  registerAdminImportModule(app, pool);
  registerAdminGroupsModule(app, pool);
  registerSecurityAuditV1Routes(app, pool);
  registerFailSafeV1Routes(app, pool);
}
