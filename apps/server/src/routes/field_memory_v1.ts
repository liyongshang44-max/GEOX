import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";

import { requireAoActAnyScopeV0 } from "../auth/ao_act_authz_v0.js";
import {
  requireFieldAllowedOr404V1,
  requireTenantMatchOr404V1,
  requireTenantScopeV1,
  tenantFromBodyOrAuthV1,
  tenantFromQueryOrAuthV1,
} from "../auth/tenant_scope_v1.js";
import { createFormalFieldMemoryFromAcceptanceV1 } from "../services/field_memory_service.js";

const QuerySchema = z.object({
  tenant_id: z.string().optional(),
  project_id: z.string().optional(),
  group_id: z.string().optional(),
  field_id: z.string().optional(),
  season_id: z.string().optional(),
  operation_id: z.string().optional(),
  task_id: z.string().optional(),
  recommendation_id: z.string().optional(),
  prescription_id: z.string().optional(),
  acceptance_id: z.string().optional(),
  memory_type: z.string().optional(),
  memory_lane: z.string().optional(),
  trust_level: z.string().optional(),
  customer_visible_memory: z.coerce.boolean().optional(),
  learning_eligible: z.coerce.boolean().optional(),
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
    const where: string[] = ["tenant_id = $1", "project_id = $2", "group_id = $3"]; const vals: unknown[] = [tenant.tenant_id, tenant.project_id, tenant.group_id];
    const push = (sql: string, v: unknown) => { vals.push(v); where.push(`${sql} = $${vals.length}`); };
    if (query.field_id) push("field_id", query.field_id);
    if (query.season_id) push("season_id", query.season_id);
    if (query.operation_id) push("operation_id", query.operation_id);
    if (query.task_id) push("task_id", query.task_id);
    if (query.recommendation_id) push("recommendation_id", query.recommendation_id);
    if (query.prescription_id) push("prescription_id", query.prescription_id);
    if (query.acceptance_id) push("acceptance_id", query.acceptance_id);
    if (query.memory_type) push("memory_type", query.memory_type);
    if (query.memory_lane) push("memory_lane", query.memory_lane);
    if (query.trust_level) push("trust_level", query.trust_level);
    if (typeof query.customer_visible_memory === "boolean") push("customer_visible_memory", query.customer_visible_memory);
    if (typeof query.learning_eligible === "boolean") push("learning_eligible", query.learning_eligible);
    if (query.skill_id) push("skill_id", query.skill_id);
    vals.push(limit);
    const sql = `SELECT memory_id,tenant_id,project_id,group_id,field_id,operation_id,memory_type,metric_key,metric_value,before_value,after_value,delta_value,confidence,summary_text,evidence_refs,source_id,source_type,skill_id,skill_trace_ref,weather_interference_detected,learning_excluded_reason,memory_lane,trust_level,formal_acceptance_id,source_lane,customer_visible_memory,learning_eligible,trust_reasons,occurred_at
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
    const formal_count = items.filter((item: any) => item.memory_lane === "FORMAL_FIELD_MEMORY" && item.customer_visible_memory === true).length;
    const technical_count = items.length - formal_count;
    return reply.send({ ok: true, total: items.length, formal_count, technical_count, recent: items, summary: { total: items.length, formal_count, technical_count } });
  });

  app.post("/api/v1/field-memory/from-acceptance", async (req: any, reply: any) => {
    const auth = requireAoActAnyScopeV0(req, reply, ["field_memory.write"]);
    if (!auth) return;

    const body: any = req.body ?? {};
    const tenant = tenantFromBodyOrAuthV1(body, auth);
    if (!requireTenantScopeV1(reply, tenant)) return;
    if (!requireTenantMatchOr404V1(reply, auth, tenant)) return;

    const operation_plan_id = String(body?.operation_plan_id ?? "").trim();
    const acceptance_id = String(body?.acceptance_id ?? "").trim();
    if (!operation_plan_id) return reply.status(400).send({ ok: false, error: "MISSING_OPERATION_PLAN_ID" });
    if (!acceptance_id) return reply.status(400).send({ ok: false, error: "MISSING_ACCEPTANCE_ID" });

    try {
      const result = await createFormalFieldMemoryFromAcceptanceV1(pool, tenant, { operation_plan_id, acceptance_id });
      return reply.send({
        ok: true,
        idempotent: result.idempotent,
        acceptance: result.acceptance,
        trust_layer: {
          memory_lane: "FORMAL_FIELD_MEMORY",
          trust_level: "FORMAL_ACCEPTED",
          formal_acceptance_id: result.acceptance.acceptance_id,
          source_lane: "FORMAL_OPERATION",
          customer_visible_memory: true,
          learning_eligible: true,
        },
        field_memory: result.field_memory,
      });
    } catch (error) {
      const code = String((error as Error)?.message ?? "");
      if (code === "ACCEPTANCE_NOT_FOUND") return reply.status(404).send({ ok: false, error: code });
      if (["ACCEPTANCE_VERDICT_NOT_PASS", "ACCEPTANCE_NOT_FORMAL", "FORMAL_EVIDENCE_NOT_PASSED", "ACCEPTANCE_FIELD_ID_MISSING", "OBSERVATION_PAIR_NOT_FOUND"].includes(code)) {
        return reply.status(422).send({ ok: false, error: code });
      }
      req.log.error({ err: error }, "create formal field memory from acceptance failed");
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR" });
    }
  });

  app.get("/api/v1/field-memory", (req, reply) => handler(req, reply));
  app.get("/api/v1/fields/:field_id/memory", (req: any, reply) => handler(req, reply, { field_id: req.params?.field_id }));
  app.get("/api/v1/operations/:operation_id/field-memory", (req: any, reply) => handler(req, reply, { operation_id: req.params?.operation_id }));
}
