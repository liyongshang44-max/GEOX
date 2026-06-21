// apps/server/src/routes/control_operation_plan_v1.ts

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { buildOperationPlanTransitionV1 } from "../domain/operations/operation_plan_transition_builder_v1.js";
import { ensureOperationPlanIndexV1, mapOperationPlanIndexRowV1, upsertOperationPlanIndexV1 } from "../projections/operation_plan_index_v1.js";
import { assertTenantTriple, requireTenantMatchOr404 } from "../domain/approval/approval_request_service_v1.js";

function parseRecordJsonMaybe(v: any): any {
  if (v && typeof v === "object") return v;
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return null; } }
  return null;
}

async function latestTransitionSubmissionByIdempotency(pool: Pool, tenantId: string, key: string): Promise<any | null> {
  if (!tenantId || !key) return null;
  const res = await pool.query(`SELECT record_json::jsonb AS record_json FROM facts WHERE (record_json::jsonb->>'type') = 'operator_operation_plan_transition_submission_v1' AND (record_json::jsonb#>>'{payload,tenant_id}') = $1 AND (record_json::jsonb#>>'{payload,idempotency_key}') = $2 ORDER BY occurred_at DESC, fact_id DESC LIMIT 1`, [tenantId, key]);
  const record = parseRecordJsonMaybe(res.rows?.[0]?.record_json) ?? res.rows?.[0]?.record_json;
  return record?.payload ?? null;
}

async function latestScopedOperationPlanFact(pool: Pool, scope: { tenantId: string; projectId: string; groupId: string }, operationPlanId: string): Promise<{ fact_id: string; payload: any } | null> {
  const res = await pool.query(`SELECT fact_id, record_json::jsonb AS record_json FROM facts WHERE (record_json::jsonb->>'type') = 'operation_plan_v1' AND (record_json::jsonb#>>'{payload,tenant_id}') = $1 AND (record_json::jsonb#>>'{payload,project_id}') = $2 AND (record_json::jsonb#>>'{payload,group_id}') = $3 AND (record_json::jsonb#>>'{payload,operation_plan_id}') = $4 ORDER BY occurred_at DESC, fact_id DESC LIMIT 1`, [scope.tenantId, scope.projectId, scope.groupId, operationPlanId]);
  const row = res.rows?.[0];
  return row ? { fact_id: String(row.fact_id ?? ""), payload: (parseRecordJsonMaybe(row.record_json) ?? row.record_json)?.payload ?? null } : null;
}

async function loadScopedOperationPlanIndex(pool: Pool, body: any, operationPlanId: string): Promise<Record<string, unknown> | null> {
  await ensureOperationPlanIndexV1(pool);
  const res = await pool.query(`SELECT * FROM public.operation_plan_index_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND field_id = $4 AND COALESCE(zone_id, '') = COALESCE($5, '') AND operation_plan_id = $6 LIMIT 1`, [body.tenant_id, body.project_id, body.group_id, body.field_id, body.zone_id ?? null, operationPlanId]);
  if (res.rows?.[0]) return mapOperationPlanIndexRowV1(res.rows[0]) as unknown as Record<string, unknown>;
  const mismatchProbe = await pool.query(`SELECT * FROM public.operation_plan_index_v1 WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3 AND operation_plan_id = $4 LIMIT 1`, [body.tenant_id, body.project_id, body.group_id, operationPlanId]);
  return mismatchProbe.rows?.[0] ? mapOperationPlanIndexRowV1(mismatchProbe.rows[0]) as unknown as Record<string, unknown> : null;
}

export function registerOperationPlanV1Routes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/operator/operation-plans/:operation_plan_id/transition", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "operation.plan.transition");
    if (!auth) return;
    if (!(auth.role === "operator" || auth.role === "admin")) return reply.status(403).send({ ok: false, error: "ROLE_OPERATOR_OR_ADMIN_REQUIRED" });
    const body: any = req.body ?? {};
    let tenant: any;
    try { tenant = assertTenantTriple(body); } catch { return reply.status(400).send({ surface: "OPERATOR", status: "REJECTED_INVALID_INPUT", operation_plan_transition_created: false, task_created: false, dispatch_created: false, receipt_created: false, roi_created: false, field_memory_created: false, no_direct_execution: true }); }
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const operationPlanId = String((req.params as any)?.operation_plan_id ?? "").trim();
    const idempotencyKey = String(body.idempotency_key ?? "").trim();
    const prior = await latestTransitionSubmissionByIdempotency(pool, tenant.tenant_id, idempotencyKey);
    if (prior) return reply.send({ ...prior, status: "REJECTED_DUPLICATE", duplicate: true });

    const fieldId = String(body.field_id ?? "").trim();
    const zoneId = body.zone_id === undefined || body.zone_id === null ? null : String(body.zone_id).trim();
    const createdTs = Date.now();
    const createdAt = new Date(createdTs).toISOString();
    const indexRecord = operationPlanId ? await loadScopedOperationPlanIndex(pool, { ...tenant, field_id: fieldId, zone_id: zoneId }, operationPlanId) : null;
    const planFact = operationPlanId ? await latestScopedOperationPlanFact(pool, { tenantId: tenant.tenant_id, projectId: tenant.project_id, groupId: tenant.group_id }, operationPlanId) : null;
    const submission = buildOperationPlanTransitionV1({
      tenant_id: tenant.tenant_id,
      project_id: tenant.project_id,
      group_id: tenant.group_id,
      field_id: fieldId,
      zone_id: zoneId,
      operator_id: String(body.operator_id ?? auth.actor_id).trim(),
      idempotency_key: idempotencyKey,
      transition_reason: String(body.transition_reason ?? "").trim(),
      operationPlanIndexRecord: indexRecord,
      operationPlanFact: planFact?.payload ? { type: "operation_plan_v1", payload: planFact.payload } : null,
      operationPlanFactId: planFact?.fact_id ?? null,
      source_status: String(body.source_status ?? "") as any,
      target_status: String(body.target_status ?? "") as any,
      submission_id: "sub_" + randomUUID().replace(/-/g, ""),
      operation_plan_transition_id: "opt_" + randomUUID().replace(/-/g, ""),
      created_ts: createdTs,
      created_at: createdAt,
    });
    if (submission.status !== "OPERATION_PLAN_TRANSITION_RECORDED") return reply.status(400).send(submission);

    const transitionFactId = "fact_" + randomUUID();
    const submissionFactId = "fact_" + randomUUID();
    const payload: any = { ...submission, operation_plan_transition_fact_id: transitionFactId };
    const transitionPayload = { ...((submission as any).operation_plan_transition_v1 ?? {}) };
    payload.operation_plan_transition_v1 = transitionPayload;
    const existing = indexRecord as any;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)", [submissionFactId, "operator_operation_plan_transition_api", JSON.stringify({ type: "operator_operation_plan_transition_submission_v1", payload })]);
      await client.query("INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)", [transitionFactId, "operator_operation_plan_transition_api", JSON.stringify({ type: "operation_plan_transition_v1", payload: transitionPayload })]);
      await upsertOperationPlanIndexV1(client, { ...existing, status: String(transitionPayload.status), source_fact_id: transitionFactId, updated_ts: Number(transitionPayload.created_ts), act_task_id: null, receipt_fact_id: null });
      await client.query("COMMIT");
      return reply.send(payload);
    } catch (e: any) {
      await client.query("ROLLBACK").catch(() => undefined);
      return reply.status(500).send({ ok: false, error: e?.message ?? "INTERNAL_ERROR" });
    } finally {
      client.release();
    }
  });
}
