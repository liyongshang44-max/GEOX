import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { requireAoActAnyScopeV0 } from "../../auth/ao_act_authz_v0.js";
import { getPrescriptionById } from "../../domain/prescription/prescription_contract_v1.js";
import { buildVariableActionTaskPayloadV1 } from "../../domain/prescription/variable_action_task_v1.js";
import { registerAoActV1Routes } from "../control_ao_act.js";

type TenantTripleV1 = { tenant_id: string; project_id: string; group_id: string };

const FACT_SOURCE_AO_ACT_V1 = "api/v1/actions/task/from-variable-prescription";

function requireTenantMatchOr404V1(auth: any, tenant: TenantTripleV1, reply: FastifyReply): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

function requireVariableTaskCreateRoleV1(auth: any, reply: FastifyReply): boolean {
  const role = String(auth?.role ?? "").trim();
  if (role === "admin" || role === "operator") return true;
  reply.status(403).send({ ok: false, error: "ACTION_TASK_CREATE_ROLE_DENIED" });
  return false;
}

async function loadLatestApprovalRequestStatusV1(pool: Pool, requestId: string, tenant: TenantTripleV1): Promise<string | null> {
  const res = await pool.query(
    `SELECT (record_json::jsonb#>>'{payload,status}') AS status
       FROM facts
      WHERE (record_json::jsonb->>'type') = 'approval_request_v1'
        AND (record_json::jsonb#>>'{payload,request_id}') = $1
        AND (record_json::jsonb#>>'{payload,tenant_id}') = $2
        AND (record_json::jsonb#>>'{payload,project_id}') = $3
        AND (record_json::jsonb#>>'{payload,group_id}') = $4
      ORDER BY occurred_at DESC, fact_id DESC
      LIMIT 1`,
    [requestId, tenant.tenant_id, tenant.project_id, tenant.group_id],
  );
  const status = String(res.rows?.[0]?.status ?? "").trim().toUpperCase();
  return status || null;
}

async function writeVariableTaskCandidateV1(pool: Pool, input: {
  tenant: TenantTripleV1;
  operation_plan_id: string;
  approval_request_id: string;
  prescription: any;
  taskPayload: ReturnType<typeof buildVariableActionTaskPayloadV1>;
  actor_id: string;
  token_id: string;
}): Promise<{ act_task_id: string; task_fact_id: string; operation_plan_fact_id: string; transition_fact_id: string }> {
  const nowTs = Date.now();
  const act_task_id = `act_${randomUUID().replace(/-/g, "")}`;
  const task_fact_id = randomUUID();
  const operation_plan_fact_id = randomUUID();
  const transition_fact_id = randomUUID();
  const prescription = input.prescription ?? {};
  const operationAmount = prescription.operation_amount ?? {};
  const operationType = String(prescription.operation_type ?? "IRRIGATION").trim().toUpperCase() || "IRRIGATION";
  const variablePlan = {
    mode: "VARIABLE_BY_ZONE",
    zone_rates: Array.isArray(operationAmount.zone_rates) ? operationAmount.zone_rates : [],
  };

  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [task_fact_id, FACT_SOURCE_AO_ACT_V1, {
      type: "ao_act_task_v0",
      payload: {
        ...input.taskPayload,
        act_task_id,
        created_at_ts: nowTs,
        meta: {
          ...(input.taskPayload.meta ?? {}),
          act_task_id,
          task_lifecycle_status: "READY_TO_DISPATCH",
          dispatch_status: "NOT_DISPATCHED",
          ack_status: "ACK_REQUIRED",
          status_contract: "TASK_CREATED_READY_TO_DISPATCH_NOT_ACKED",
          ao_act_boundary: "task_created_is_not_executor_ack",
        },
      },
    }],
  );

  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [operation_plan_fact_id, FACT_SOURCE_AO_ACT_V1, {
      type: "operation_plan_v1",
      payload: {
        tenant_id: input.tenant.tenant_id,
        project_id: input.tenant.project_id,
        group_id: input.tenant.group_id,
        operation_plan_id: input.operation_plan_id,
        operation_id: input.operation_plan_id,
        command_id: act_task_id,
        approval_request_id: input.approval_request_id,
        prescription_id: String(prescription.prescription_id ?? ""),
        recommendation_id: String(prescription.recommendation_id ?? ""),
        field_id: String(prescription.field_id ?? ""),
        season_id: prescription.season_id ?? null,
        operation_type: operationType,
        action_type: "IRRIGATE",
        status: "READY_TO_DISPATCH",
        dispatch_status: "NOT_DISPATCHED",
        ack_status: "ACK_REQUIRED",
        act_task_id,
        operation_amount: operationAmount,
        variable_plan: variablePlan,
        device_requirements: prescription.device_requirements ?? {},
        acceptance_conditions: prescription.acceptance_conditions ?? {},
        source: "variable_prescription_contract_v1",
        actor_id: input.actor_id,
        token_id: input.token_id,
        created_at_ts: nowTs,
        updated_at_ts: nowTs,
        boundary: {
          task_creation_is_not_ack: true,
          ack_requires_dispatch_claim_or_executor_ack: true,
        },
        meta: {
          command_id: act_task_id,
          variable_prescription: true,
          prescription_id: String(prescription.prescription_id ?? ""),
          recommendation_id: String(prescription.recommendation_id ?? ""),
          task_lifecycle_status: "READY_TO_DISPATCH",
          dispatch_status: "NOT_DISPATCHED",
          ack_status: "ACK_REQUIRED",
        },
      },
    }],
  );

  await pool.query(
    "INSERT INTO facts (fact_id, occurred_at, source, record_json) VALUES ($1, NOW(), $2, $3::jsonb)",
    [transition_fact_id, FACT_SOURCE_AO_ACT_V1, {
      type: "operation_plan_transition_v1",
      payload: {
        tenant_id: input.tenant.tenant_id,
        project_id: input.tenant.project_id,
        group_id: input.tenant.group_id,
        operation_plan_id: input.operation_plan_id,
        from_status: null,
        to_status: "READY_TO_DISPATCH",
        status: "READY_TO_DISPATCH",
        reason: "VARIABLE_ACTION_TASK_CANDIDATE_CREATED_NOT_ACKED",
        actor_id: input.actor_id,
        token_id: input.token_id,
        created_at_ts: nowTs,
      },
    }],
  );

  return { act_task_id, task_fact_id, operation_plan_fact_id, transition_fact_id };
}

async function interceptVariablePrescriptionTaskV1(pool: Pool, req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (req.method !== "POST" || req.url.split("?")[0] !== "/api/v1/actions/task/from-variable-prescription") return;

  const auth = requireAoActAnyScopeV0(req, reply, ["action.task.create", "ao_act.task.write"]);
  if (!auth) return;
  if (!requireVariableTaskCreateRoleV1(auth, reply)) return;

  const body = z.object({
    tenant_id: z.string().min(1),
    project_id: z.string().min(1),
    group_id: z.string().min(1),
    prescription_id: z.string().min(1),
    approval_request_id: z.string().min(1),
    operation_plan_id: z.string().min(1),
    device_id: z.string().min(1),
  }).parse(req.body ?? {});

  const tenant: TenantTripleV1 = { tenant_id: body.tenant_id, project_id: body.project_id, group_id: body.group_id };
  if (!requireTenantMatchOr404V1(auth, tenant, reply)) return;

  const prescription = await getPrescriptionById(pool, body.prescription_id, tenant);
  if (!prescription) { reply.status(404).send({ ok: false, error: "PRESCRIPTION_NOT_FOUND" }); return; }
  if (String((prescription as any)?.operation_amount?.mode ?? "").trim().toUpperCase() !== "VARIABLE_BY_ZONE") {
    reply.status(400).send({ ok: false, error: "VARIABLE_PRESCRIPTION_MODE_REQUIRED" });
    return;
  }

  const approvalStatus = await loadLatestApprovalRequestStatusV1(pool, body.approval_request_id, tenant);
  if (approvalStatus !== "APPROVED") {
    reply.status(403).send({ ok: false, error: "APPROVAL_REQUEST_NOT_APPROVED" });
    return;
  }

  const taskPayload = buildVariableActionTaskPayloadV1({
    tenant_id: tenant.tenant_id,
    project_id: tenant.project_id,
    group_id: tenant.group_id,
    prescription,
    approval_request_id: body.approval_request_id,
    operation_plan_id: body.operation_plan_id,
    actor_id: auth.actor_id,
    device_id: body.device_id,
    now_ts_ms: Date.now(),
  });

  const created = await writeVariableTaskCandidateV1(pool, {
    tenant,
    operation_plan_id: body.operation_plan_id,
    approval_request_id: body.approval_request_id,
    prescription,
    taskPayload,
    actor_id: auth.actor_id,
    token_id: auth.token_id,
  });

  reply.send({
    ok: true,
    act_task_id: created.act_task_id,
    task_fact_id: created.task_fact_id,
    operation_plan_id: body.operation_plan_id,
    operation_plan_fact_id: created.operation_plan_fact_id,
    operation_plan_transition_fact_id: created.transition_fact_id,
    task_status: "TASK_CREATED",
    operation_plan_status: "READY_TO_DISPATCH",
    dispatch_status: "NOT_DISPATCHED",
    ack_status: "ACK_REQUIRED",
    task_meta: taskPayload.meta,
  });
}

// AO-ACT v1 primary routes.
// New business endpoints must be registered here, not under legacy prefixes.
export function registerAoActV1PrimaryRoutes(app: FastifyInstance, pool: Pool): void {
  app.addHook("preHandler", async (req, reply) => interceptVariablePrescriptionTaskV1(pool, req, reply));
  registerAoActV1Routes(app, pool);
}
