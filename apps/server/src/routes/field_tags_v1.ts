import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { enforceFieldScopeOrDeny } from "../auth/route_role_authz.js";

const TagCreateBodySchema = z.object({
  tag: z.string().min(1).max(64)
});

async function ensureFieldTagsSchemaV1(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS field_tags_v1 (
      tenant_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      field_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT NULL,
      PRIMARY KEY (tenant_id, project_id, group_id, field_id, tag)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS field_tags_v1_lookup_idx
      ON field_tags_v1 (tenant_id, project_id, group_id, field_id, created_at DESC)
  `);
}

async function ensureFieldExists(tenantId: string, fieldId: string, pool: Pool): Promise<boolean> {
  const q = await pool.query(
    `SELECT 1 FROM field_index_v1 WHERE tenant_id = $1 AND field_id = $2 LIMIT 1`,
    [tenantId, fieldId]
  );
  return Number(q.rowCount ?? 0) > 0;
}

export function registerFieldTagsV1Routes(app: FastifyInstance, pool: Pool): void {
  void ensureFieldTagsSchemaV1(pool).catch((err) => {
    app.log.error({ err }, "[field_tags_v1] ensure schema failed");
  });

  app.get("/api/v1/fields/:field_id/tags", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "fields.read");
    if (!auth) return;

    const field_id = String((req.params as any)?.field_id ?? "").trim();
    if (!field_id) return reply.status(400).send({ ok: false, error: "MISSING_FIELD_ID" });
    if (!enforceFieldScopeOrDeny(auth, field_id, reply, { asNotFound: true })) return;

    const exists = await ensureFieldExists(auth.tenant_id, field_id, pool);
    if (!exists) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const q = await pool.query(
      `SELECT tag, created_at, created_by
         FROM field_tags_v1
        WHERE tenant_id = $1
          AND project_id = $2
          AND group_id = $3
          AND field_id = $4
        ORDER BY tag ASC`,
      [auth.tenant_id, auth.project_id, auth.group_id, field_id]
    );

    const items = (q.rows ?? []).map((row: any) => ({
      tag: String(row.tag ?? ""),
      created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
      created_by: row.created_by ? String(row.created_by) : null
    }));

    return reply.send({ ok: true, field_id, count: items.length, items });
  });

  app.post("/api/v1/fields/:field_id/tags", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "fields.write");
    if (!auth) return;

    const field_id = String((req.params as any)?.field_id ?? "").trim();
    if (!field_id) return reply.status(400).send({ ok: false, error: "MISSING_FIELD_ID" });
    if (!enforceFieldScopeOrDeny(auth, field_id, reply, { asNotFound: true })) return;

    const parsedBody = TagCreateBodySchema.safeParse((req as any).body ?? {});
    if (!parsedBody.success) {
      return reply.status(400).send({ ok: false, error: "INVALID_TAG_SCHEMA", details: parsedBody.error.issues });
    }

    const tag = String(parsedBody.data.tag ?? "").trim();
    if (!tag) return reply.status(400).send({ ok: false, error: "MISSING_TAG" });

    const exists = await ensureFieldExists(auth.tenant_id, field_id, pool);
    if (!exists) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    await pool.query(
      `INSERT INTO field_tags_v1 (tenant_id, project_id, group_id, field_id, tag, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, project_id, group_id, field_id, tag)
       DO NOTHING`,
      [auth.tenant_id, auth.project_id, auth.group_id, field_id, tag, auth.actor_id]
    );

    return reply.send({ ok: true, field_id, tag });
  });

  app.delete("/api/v1/fields/:field_id/tags/:tag", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "fields.write");
    if (!auth) return;

    const field_id = String((req.params as any)?.field_id ?? "").trim();
    const tag = String((req.params as any)?.tag ?? "").trim();
    if (!field_id) return reply.status(400).send({ ok: false, error: "MISSING_FIELD_ID" });
    if (!tag) return reply.status(400).send({ ok: false, error: "MISSING_TAG" });
    if (!enforceFieldScopeOrDeny(auth, field_id, reply, { asNotFound: true })) return;

    const exists = await ensureFieldExists(auth.tenant_id, field_id, pool);
    if (!exists) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const q = await pool.query(
      `DELETE FROM field_tags_v1
        WHERE tenant_id = $1
          AND project_id = $2
          AND group_id = $3
          AND field_id = $4
          AND tag = $5`,
      [auth.tenant_id, auth.project_id, auth.group_id, field_id, tag]
    );

    if (!q.rowCount) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, field_id, tag });
  });
}
