import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerAdminImportModule } from "./registerAdminImportModule.js";
import { registerAdminGroupsModule } from "./registerAdminGroupsModule.js";
import { registerSecurityAuditV1Routes } from "../../routes/security_audit_v1.js";
import { registerFailSafeV1Routes } from "../../routes/fail_safe_v1.js";
import { getRuntimeSecurityStatusV1 } from "../../runtime/runtime_security_v1.js";

const REQUIRED_SCHEMA = {
  tables: ["facts", "raw_samples", "markers", "sensor_groups", "sensor_group_members", "prescription_contract_v1", "as_executed_record_v1", "as_applied_map_v1", "roi_ledger_v1", "judge_result_v2", "field_memory_v1"],
  views: ["facts_replay_v1"],
} as const;

export function registerAdminModule(app: FastifyInstance, pool: Pool): void {
  app.get("/health", async () => ({ ok: true }));
  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/admin/healthz", async (_req, reply) => {
    const missing_tables: string[] = [];
    const missing_views: string[] = [];

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

    return reply.send({
      ok: missing_tables.length === 0 && missing_views.length === 0,
      missing_tables,
      missing_views,
      runtime_security: getRuntimeSecurityStatusV1(),
    });
  });

  registerAdminImportModule(app, pool);
  registerAdminGroupsModule(app, pool);
  registerSecurityAuditV1Routes(app, pool);
  registerFailSafeV1Routes(app, pool);
}
