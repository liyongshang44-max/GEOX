import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";

import { requireAoActAnyScopeV0 } from "../auth/ao_act_authz_v0.js";

const FieldMemoryQuerySchema = z.object({
  field_id: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

type FieldMemoryRow = {
  memory_id: string;
  tenant_id: string;
  field_id: string;
  operation_id: string | null;
  prescription_id: string | null;
  recommendation_id: string | null;
  memory_type: "operation_outcome" | "execution_reliability" | "skill_performance";
  summary: string | null;
  metrics: Record<string, unknown> | null;
  skill_refs: Array<Record<string, unknown>> | null;
  evidence_refs: string[] | null;
  created_at: number;
};

function toNumberOrNull(v: unknown): number | null {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : null;
}

export function registerFieldMemoryV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/field-memory/health", async (_req, reply) => {
    try {
      const q = await pool.query(`SELECT to_regclass('public.field_memory_v1')::text AS tbl`);
      const table_ready = Boolean(q.rows?.[0]?.tbl);
      return reply.send({ ok: table_ready, table_ready, module: "field_memory_v1" });
    } catch {
      return reply.send({ ok: false, table_ready: false, module: "field_memory_v1" });
    }
  });

  app.get("/api/v1/field-memory", async (req, reply) => {
    try {
      const auth = requireAoActAnyScopeV0(req, reply, ["field_memory.read", "ao_act.index.read"]);
      if (!auth) return;

      const query = FieldMemoryQuerySchema.parse((req as any).query ?? {});
      const limit = query.limit ?? 50;

      const q = await pool.query<FieldMemoryRow>(
        `SELECT memory_id, tenant_id, field_id, operation_id, prescription_id, recommendation_id,
                memory_type, summary, metrics, skill_refs, evidence_refs, created_at
           FROM field_memory_v1
          WHERE tenant_id = $1
            AND field_id = $2
          ORDER BY created_at DESC
          LIMIT $3`,
        [auth.tenant_id, query.field_id, limit],
      );

      return reply.send({
        ok: true,
        field_id: query.field_id,
        items: q.rows ?? [],
      });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });

  app.get("/api/v1/field-memory/summary", async (req, reply) => {
    try {
      const auth = requireAoActAnyScopeV0(req, reply, ["field_memory.read", "ao_act.index.read"]);
      if (!auth) return;

      const query = FieldMemoryQuerySchema.parse((req as any).query ?? {});
      const limit = query.limit ?? 100;

      const q = await pool.query<FieldMemoryRow>(
        `SELECT memory_id, tenant_id, field_id, operation_id, prescription_id, recommendation_id,
                memory_type, summary, metrics, skill_refs, evidence_refs, created_at
           FROM field_memory_v1
          WHERE tenant_id = $1
            AND field_id = $2
          ORDER BY created_at DESC
          LIMIT $3`,
        [auth.tenant_id, query.field_id, limit],
      );

      const rows = q.rows ?? [];
      const successFlags = rows
        .map((row) => row.metrics?.success)
        .filter((v): v is boolean => typeof v === "boolean");
      const executionDeviationValues = rows
        .map((row) => toNumberOrNull(row.metrics?.execution_deviation))
        .filter((v): v is number => v != null);
      const skillSuccessFlags = rows
        .filter((row) => row.memory_type === "skill_performance")
        .map((row) => row.metrics?.success)
        .filter((v): v is boolean => typeof v === "boolean");

      const success_rate = successFlags.length > 0
        ? successFlags.filter(Boolean).length / successFlags.length
        : null;
      const execution_deviation_avg = executionDeviationValues.length > 0
        ? executionDeviationValues.reduce((acc, v) => acc + v, 0) / executionDeviationValues.length
        : null;
      const skill_success_rate = skillSuccessFlags.length > 0
        ? skillSuccessFlags.filter(Boolean).length / skillSuccessFlags.length
        : null;

      return reply.send({
        ok: true,
        field_id: query.field_id,
        limit,
        recent: rows,
        summary: {
          total: rows.length,
          success_rate,
          execution_deviation_avg,
          skill_success_rate,
        },
      });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });
}
