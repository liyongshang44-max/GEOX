import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";

import { evaluateAcceptanceV1 } from "../domain/acceptance/engine_v1";

const FACT_SOURCE_ACCEPTANCE_V1 = "api/v1/acceptance";
const ACCEPTANCE_RULE_ID_V1 = "acceptance_rule_v1_irrigate_duration_80pct";

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

const EvaluateRequestSchema = z.object({
  tenant_id: z.string().min(1),
  project_id: z.string().min(1),
  group_id: z.string().min(1),
  act_task_id: z.string().min(1)
});

function normalizeRecordJson(v: unknown): any {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return v;
}

async function loadTaskFact(pool: Pool, actTaskId: string, tenant: TenantTriple): Promise<{ fact_id: string; record_json: any } | null> {
  const sql = `
    SELECT fact_id, (record_json::jsonb) AS record_json
    FROM facts
    WHERE (record_json::jsonb)->>'type' = 'ao_act_task_v0'
      AND (record_json::jsonb)#>>'{payload,act_task_id}' = $1
      AND (record_json::jsonb)#>>'{payload,tenant_id}' = $2
      AND (record_json::jsonb)#>>'{payload,project_id}' = $3
      AND (record_json::jsonb)#>>'{payload,group_id}' = $4
    ORDER BY occurred_at DESC, fact_id DESC
    LIMIT 1
  `;
  const r = await pool.query(sql, [actTaskId, tenant.tenant_id, tenant.project_id, tenant.group_id]);
  if (!r.rows?.length) return null;
  return {
    fact_id: String(r.rows[0].fact_id),
    record_json: normalizeRecordJson(r.rows[0].record_json)
  };
}

async function loadReceiptFact(pool: Pool, actTaskId: string, tenant: TenantTriple): Promise<{ fact_id: string; record_json: any } | null> {
  const sql = `
    SELECT fact_id, (record_json::jsonb) AS record_json
    FROM facts
    WHERE (record_json::jsonb)->>'type' = 'ao_act_receipt_v0'
      AND (record_json::jsonb)#>>'{payload,act_task_id}' = $1
      AND (record_json::jsonb)#>>'{payload,tenant_id}' = $2
      AND (record_json::jsonb)#>>'{payload,project_id}' = $3
      AND (record_json::jsonb)#>>'{payload,group_id}' = $4
    ORDER BY occurred_at DESC, fact_id DESC
    LIMIT 1
  `;
  const r = await pool.query(sql, [actTaskId, tenant.tenant_id, tenant.project_id, tenant.group_id]);
  if (!r.rows?.length) return null;
  return {
    fact_id: String(r.rows[0].fact_id),
    record_json: normalizeRecordJson(r.rows[0].record_json)
  };
}

function deriveTelemetryFromReceipt(receipt: any): Record<string, number> {
  const observed = (receipt?.payload?.observed_parameters ?? {}) as Record<string, unknown>;
  const directDuration = Number((observed as any).duration_min);
  if (Number.isFinite(directDuration) && directDuration > 0) {
    return { duration_min: directDuration };
  }

  const startTs = Number(receipt?.payload?.execution_time?.start_ts);
  const endTs = Number(receipt?.payload?.execution_time?.end_ts);
  if (Number.isFinite(startTs) && Number.isFinite(endTs) && endTs > startTs) {
    return { duration_min: (endTs - startTs) / 60000 };
  }

  return {};
}

export function registerAcceptanceV1Routes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/acceptance/evaluate", async (req, reply) => {
    try {
      const body = EvaluateRequestSchema.parse((req as any).body ?? {});
      const tenant: TenantTriple = {
        tenant_id: body.tenant_id,
        project_id: body.project_id,
        group_id: body.group_id
      };

      const taskFact = await loadTaskFact(pool, body.act_task_id, tenant);
      if (!taskFact) return reply.status(404).send({ ok: false, error: "TASK_NOT_FOUND" });

      const receiptFact = await loadReceiptFact(pool, body.act_task_id, tenant);
      if (!receiptFact) return reply.status(404).send({ ok: false, error: "RECEIPT_NOT_FOUND" });

      const taskPayload = taskFact.record_json?.payload ?? {};
      const telemetry = deriveTelemetryFromReceipt(receiptFact.record_json);

      const evaluated = evaluateAcceptanceV1({
        action_type: String(taskPayload.action_type ?? ""),
        parameters: (taskPayload.parameters ?? {}) as Record<string, any>,
        telemetry
      });

      const acceptanceFactId = randomUUID();
      const nowTs = Date.now();
      const acceptanceRecord = {
        type: "acceptance_result_v1",
        payload: {
          tenant_id: tenant.tenant_id,
          project_id: tenant.project_id,
          group_id: tenant.group_id,
          act_task_id: body.act_task_id,
          operation_plan_id: typeof taskPayload.operation_plan_id === "string" ? taskPayload.operation_plan_id : undefined,
          program_id: typeof taskPayload.program_id === "string" ? taskPayload.program_id : undefined,
          result: evaluated.result,
          score: evaluated.score,
          metrics: evaluated.metrics,
          rule_id: ACCEPTANCE_RULE_ID_V1,
          evaluated_at_ts: nowTs,
          evidence_refs: [taskFact.fact_id, receiptFact.fact_id]
        }
      };

      await pool.query(
        "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
        [acceptanceFactId, FACT_SOURCE_ACCEPTANCE_V1, acceptanceRecord]
      );

      return reply.send({
        ok: true,
        result: evaluated.result,
        fact_id: acceptanceFactId
      });
    } catch (error: any) {
      return reply.status(400).send({ ok: false, error: String(error?.message ?? error ?? "INVALID_REQUEST") });
    }
  });
}
