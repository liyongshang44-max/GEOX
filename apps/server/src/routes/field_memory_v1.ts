import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";

import { requireAoActAnyScopeV0 } from "../auth/ao_act_authz_v0.js";
import { requireFieldAllowedOr404V1, requireTenantMatchOr404V1, tenantFromQueryOrAuthV1 } from "../auth/tenant_scope_v1.js";

const QuerySchema = z.object({
  tenant_id: z.string().optional(),
  field_id: z.string().optional(),
  season_id: z.string().optional(),
  operation_id: z.string().optional(),
  memory_type: z.string().optional(),
  skill_id: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export function registerFieldMemoryV1Routes(app: FastifyInstance, pool: Pool): void {
  const handler = async (req: any, reply: any, extra: { field_id?: string; operation_id?: string } = {}) => {
    const auth = requireAoActAnyScopeV0(req, reply, ["field_memory.read", "ao_act.index.read"]); if (!auth) return;
    const query = QuerySchema.parse({ ...(req.query ?? {}), ...extra });
    const tenant = tenantFromQueryOrAuthV1(query, auth);
    if (!requireTenantMatchOr404V1(reply, auth, tenant)) return;
    if (query.field_id && !requireFieldAllowedOr404V1(reply, auth, query.field_id)) return;
    const limit = query.limit ?? 50;
    const where: string[] = ["tenant_id = $1"]; const vals: unknown[] = [tenant.tenant_id];
    const push = (sql: string, v: unknown) => { vals.push(v); where.push(`${sql} = $${vals.length}`); };
    if (query.field_id) push("field_id", query.field_id);
    if (query.season_id) push("season_id", query.season_id);
    if (query.operation_id) push("operation_id", query.operation_id);
    if (query.memory_type) push("memory_type", query.memory_type);
    if (query.skill_id) push("skill_id", query.skill_id);
    vals.push(limit);
    const sql = `SELECT memory_id,tenant_id,field_id,operation_id,memory_type,metric_key,metric_value,before_value,after_value,delta_value,confidence,summary_text,evidence_refs,source_id,source_type,skill_id,skill_trace_ref,occurred_at
      FROM field_memory_v1 WHERE ${where.join(" AND ")} ORDER BY occurred_at DESC LIMIT $${vals.length}`;
    const q = await pool.query(sql, vals);
    return reply.send({ ok: true, items: q.rows ?? [] });
  };


  app.get("/api/v1/field-memory/health", async (_req, reply) => {
    const q = await pool.query(`SELECT to_regclass('public.field_memory_v1')::text AS tbl`);
    const table_ready = Boolean(q.rows?.[0]?.tbl);
    return reply.send({ ok: table_ready, table_ready, module: "field_memory_v1" });
  });

  app.get("/api/v1/field-memory/summary", async (req: any, reply) => {
    const out = await handler(req, { send: (v:any)=>v, status: (_:any)=>({send:(v:any)=>v}) } as any);
    if (!out?.ok) return reply.send(out);
    const items = out.items ?? [];
    return reply.send({ ok: true, total: items.length, recent: items, summary: { total: items.length } });
  });

  app.get("/api/v1/field-memory", (req, reply) => handler(req, reply));
  app.get("/api/v1/fields/:field_id/memory", (req: any, reply) => handler(req, reply, { field_id: req.params?.field_id }));
  app.get("/api/v1/operations/:operation_id/field-memory", (req: any, reply) => handler(req, reply, { operation_id: req.params?.operation_id }));
}
