// apps/server/src/routes/water_response_verification_v1.ts

import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";

import { requireAoActAnyScopeV0 } from "../auth/ao_act_authz_v0.js";
import { buildWaterResponseVerificationFromAcceptanceV1 } from "../domain/water_response/water_response_verification_from_acceptance_v1.js";

const H45_FACT_TYPES = ["operator_water_response_verification_submission_v1", "water_response_verification_v1"];
void H45_FACT_TYPES;

const VerifyFromAcceptanceRequestSchema = z.object({
  tenant_id: z.string().min(1),
  project_id: z.string().min(1),
  group_id: z.string().min(1),
  field_id: z.string().min(1),
  zone_id: z.string().min(1),
  acceptance_id: z.string().min(1),
  acceptance_result_fact_id: z.string().min(1),
  as_executed_id: z.string().min(1),
  task_id: z.string().min(1),
  receipt_id: z.string().min(1),
  operation_plan_id: z.string().nullable().optional(),
  operator_id: z.string().min(1),
  idempotency_key: z.string().min(1),
  pre_state_id: z.string().min(1),
  post_state_id: z.string().min(1),
  verification_reason: z.string().min(1),
});

function normalizeRecordJson(value: unknown): any {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return null; }
  }
  return value;
}

function responseCodeForStatus(status: string): number {
  if (status === "WATER_RESPONSE_VERIFICATION_RECORDED") return 200;
  if (status === "REJECTED_DUPLICATE") return 409;
  if (status.includes("NOT_FOUND")) return 404;
  if (status === "REJECTED_INVALID_INPUT") return 400;
  return 422;
}

export function registerWaterResponseVerificationV1Routes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/water-response/verify-from-acceptance", async (req, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, ["water_response.verify"]);
    if (!auth) return reply;
    if (!["operator", "agronomist", "admin"].includes(String(auth.role))) {
      return reply.status(403).send({ ok: false, error: "AUTH_ROLE_SCOPE_DENIED" });
    }

    let body: z.infer<typeof VerifyFromAcceptanceRequestSchema>;
    try {
      body = VerifyFromAcceptanceRequestSchema.parse((req as any).body ?? {});
    } catch {
      return reply.status(400).send({
        ok: false,
        status: "REJECTED_INVALID_INPUT",
        water_response_verification_created: false,
        roi_created: false,
        field_memory_created: false,
        operation_state_created: false,
        customer_delivery_created: false,
      });
    }

    if (auth.tenant_id !== body.tenant_id || auth.project_id !== body.project_id || auth.group_id !== body.group_id) {
      return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    }

    const duplicate = await pool.query(
      `SELECT fact_id, record_json::jsonb AS record_json
       FROM facts
       WHERE (record_json::jsonb->>'type')='operator_water_response_verification_submission_v1'
         AND (record_json::jsonb#>>'{payload,tenant_id}')=$1
         AND (record_json::jsonb#>>'{payload,idempotency_key}')=$2
       ORDER BY occurred_at DESC, fact_id DESC
       LIMIT 1`,
      [body.tenant_id, body.idempotency_key],
    );

    if (duplicate.rows?.length) {
      const payload = normalizeRecordJson(duplicate.rows[0].record_json)?.payload ?? {};
      return reply.status(409).send({
        ok: false,
        ...payload,
        status: "REJECTED_DUPLICATE",
        duplicate: true,
        water_response_verification_created: false,
        roi_created: false,
        field_memory_created: false,
        operation_state_created: false,
        customer_delivery_created: false,
      });
    }

    const acceptanceResult = await pool.query(
      `SELECT fact_id, record_json::jsonb AS record_json
       FROM facts
       WHERE (record_json::jsonb->>'type')='acceptance_result_v1'
         AND fact_id=$1
         AND (record_json::jsonb#>>'{payload,tenant_id}')=$2
         AND (record_json::jsonb#>>'{payload,project_id}')=$3
         AND (record_json::jsonb#>>'{payload,group_id}')=$4
       LIMIT 1`,
      [body.acceptance_result_fact_id, body.tenant_id, body.project_id, body.group_id],
    );

    const asExecutedRecord = await pool.query(
      `SELECT *
       FROM as_executed_record_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4
         AND as_executed_id=$5 AND task_id=$6 AND receipt_id=$7
       LIMIT 1`,
      [body.tenant_id, body.project_id, body.group_id, body.field_id, body.as_executed_id, body.task_id, body.receipt_id],
    );

    const preState = await pool.query(
      `SELECT *
       FROM root_zone_soil_water_state_index_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND zone_id=$5 AND state_id=$6
       LIMIT 1`,
      [body.tenant_id, body.project_id, body.group_id, body.field_id, body.zone_id, body.pre_state_id],
    );

    const postState = await pool.query(
      `SELECT *
       FROM root_zone_soil_water_state_index_v1
       WHERE tenant_id=$1 AND project_id=$2 AND group_id=$3 AND field_id=$4 AND zone_id=$5 AND state_id=$6
       LIMIT 1`,
      [body.tenant_id, body.project_id, body.group_id, body.field_id, body.zone_id, body.post_state_id],
    );

    const verificationId = `wrv_${randomUUID()}`;
    const submissionId = `wrvs_${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const built = buildWaterResponseVerificationFromAcceptanceV1({
      ...body,
      operation_plan_id: body.operation_plan_id ?? null,
      acceptanceResult: acceptanceResult.rows?.[0]
        ? { fact_id: acceptanceResult.rows[0].fact_id, ...normalizeRecordJson(acceptanceResult.rows[0].record_json) }
        : null,
      asExecutedRecord: asExecutedRecord.rows?.[0] ?? null,
      preState: preState.rows?.[0] ?? null,
      postState: postState.rows?.[0] ?? null,
      submission_id: submissionId,
      verification_id: verificationId,
      created_at: createdAt,
    });

    if (!built.verification) {
      return reply.status(responseCodeForStatus(built.submission.status)).send({ ok: false, ...built.submission });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
        [
          submissionId,
          "operator_water_response_verification_api",
          JSON.stringify({
            type: "operator_water_response_verification_submission_v1",
            payload: { ...built.submission, water_response_verification_fact_id: verificationId },
          }),
        ],
      );
      await client.query(
        "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
        [verificationId, "operator_water_response_verification_api", JSON.stringify(built.verification)],
      );

      const verificationPayload: any = built.verification.payload;
      await client.query(
        `INSERT INTO water_response_verification_index_v1 (
          verification_id, tenant_id, project_id, group_id, field_id, zone_id,
          acceptance_id, acceptance_result_fact_id, as_executed_id, task_id, receipt_id, operation_plan_id,
          pre_state_id, post_state_id, response_verdict,
          available_water_fraction_delta, weighted_matric_potential_kpa_delta, class_transition,
          blocking_reasons_json, evidence_refs_json, source_fact_id, created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20::jsonb,$21,$22::timestamptz,NOW()
        ) ON CONFLICT (verification_id) DO UPDATE SET updated_at=NOW()`,
        [
          verificationPayload.verification_id,
          verificationPayload.tenant_id,
          verificationPayload.project_id,
          verificationPayload.group_id,
          verificationPayload.field_id,
          verificationPayload.zone_id,
          verificationPayload.acceptance_id,
          verificationPayload.acceptance_result_fact_id,
          verificationPayload.as_executed_id,
          verificationPayload.task_id,
          verificationPayload.receipt_id,
          verificationPayload.operation_plan_id,
          verificationPayload.pre_state_id,
          verificationPayload.post_state_id,
          verificationPayload.response_verdict,
          verificationPayload.deltas.available_water_fraction_delta,
          verificationPayload.deltas.weighted_matric_potential_kpa_delta,
          verificationPayload.deltas.class_transition,
          JSON.stringify(verificationPayload.confidence.blocking_reasons),
          JSON.stringify(verificationPayload.evidence_refs),
          verificationId,
          verificationPayload.created_at,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return reply.send({ ok: true, ...built.submission, water_response_verification_fact_id: verificationId });
  });
}
