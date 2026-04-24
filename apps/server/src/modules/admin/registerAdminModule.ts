import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerAdminImportModule } from "./registerAdminImportModule.js";
import { registerAdminGroupsModule } from "./registerAdminGroupsModule.js";

const REQUIRED_SCHEMA = {
  tables: ["facts", "raw_samples", "markers", "sensor_groups", "sensor_group_members"],
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
    });
  });

  registerAdminImportModule(app, pool);
  registerAdminGroupsModule(app, pool);
}
