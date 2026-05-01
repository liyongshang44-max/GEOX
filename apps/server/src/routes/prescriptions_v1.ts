import type { FastifyInstance, FastifyReply } from "fastify";
import type { Pool } from "pg";
import { requireAoActAdminV0, requireAoActAnyScopeV0, requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { requireFieldAllowedOr404V1, tenantFromBodyOrAuthV1, tenantFromQueryOrAuthV1 } from "../auth/tenant_scope_v1.js";
import { createApprovalRequestV1, requireTenantMatchOr404 } from "../domain/approval/approval_request_service_v1.js";
import {
  createVariablePrescriptionFromRecommendation,
  createPrescriptionFromRecommendation,
  getPrescriptionById,
  getPrescriptionByRecommendationId,
  loadRecommendationFact,
} from "../domain/prescription/prescription_contract_v1.js";
import { normalizeVariablePrescriptionPlanV1 } from "../domain/prescription/variable_prescription_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

function badRequest(reply: FastifyReply, error: string) {
  return reply.status(400).send({ ok: false, error });
}

function deriveApprovalActionType(operationType: string): string {
  if (operationType === "IRRIGATION") return "IRRIGATE";
  if (operationType === "FERTILIZATION") return "FERTILIZE";
  if (operationType === "SPRAYING") return "SPRAY";
  if (operationType === "INSPECTION") return "INSPECT";
  return "EXECUTE";
}

export function registerPrescriptionsV1Routes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/prescriptions/from-recommendation", async (req, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, ["prescription.write", "ao_act.task.write"]);
    if (!auth) return;

    const body: any = req.body ?? {};
    const recommendation_id = String(body.recommendation_id ?? "").trim();
    const tenant: TenantTriple = tenantFromBodyOrAuthV1(body, auth);
    if (!recommendation_id) return badRequest(reply, "MISSING_RECOMMENDATION_ID");
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const recFact = await loadRecommendationFact(pool, tenant, recommendation_id);
    if (!recFact) return reply.status(404).send({ ok: false, error: "RECOMMENDATION_NOT_FOUND" });
    const recFieldId = String(recFact.payload?.field_id ?? "").trim();
    if (!recFieldId) return badRequest(reply, "RECOMMENDATION_FIELD_MISSING");
    if (!requireFieldAllowedOr404V1(reply, auth, recFieldId)) return;
    if (body.field_id !== undefined && String(body.field_id ?? "").trim() !== recFieldId) {
      return badRequest(reply, "PRESCRIPTION_FIELD_MISMATCH");
    }

    const result = await createPrescriptionFromRecommendation(pool, {
      recommendation_id,
      tenant_id: String(recFact.payload?.tenant_id ?? tenant.tenant_id),
      project_id: String(recFact.payload?.project_id ?? tenant.project_id),
      group_id: String(recFact.payload?.group_id ?? tenant.group_id),
      field_id: recFieldId,
      season_id: recFact.payload?.season_id ?? null,
      crop_id: recFact.payload?.crop_code ?? null,
      zone_id: body.zone_id ?? null,
      created_by: auth.actor_id,
    }, recFact.payload);

    return reply.send({ ok: true, idempotent: result.idempotent, prescription: result.prescription });
  });

  app.post("/api/v1/prescriptions/variable/from-recommendation", async (req, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, ["prescription.write", "ao_act.task.write"]);
    if (!auth) return;

    const body: any = req.body ?? {};
    const recommendation_id = String(body.recommendation_id ?? "").trim();
    const tenant: TenantTriple = tenantFromBodyOrAuthV1(body, auth);
    if (!recommendation_id) return badRequest(reply, "MISSING_RECOMMENDATION_ID");
    if (!body.variable_plan) return badRequest(reply, "MISSING_VARIABLE_PLAN");
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    let variable_plan;
    try {
      variable_plan = normalizeVariablePrescriptionPlanV1(body.variable_plan);
    } catch (error: any) {
      return badRequest(reply, String(error?.message ?? "VARIABLE_PLAN_INVALID"));
    }

    const recFact = await loadRecommendationFact(pool, tenant, recommendation_id);
    if (!recFact) return reply.status(404).send({ ok: false, error: "RECOMMENDATION_NOT_FOUND" });
    const recFieldId = String(recFact.payload?.field_id ?? "").trim();
    if (!recFieldId) return badRequest(reply, "RECOMMENDATION_FIELD_MISSING");
    if (!requireFieldAllowedOr404V1(reply, auth, recFieldId)) return;
    if (body.field_id !== undefined && String(body.field_id ?? "").trim() !== recFieldId) {
      return badRequest(reply, "PRESCRIPTION_FIELD_MISMATCH");
    }

    try {
      const result = await createVariablePrescriptionFromRecommendation(pool, {
        recommendation_id,
        tenant_id: String(recFact.payload?.tenant_id ?? tenant.tenant_id),
        project_id: String(recFact.payload?.project_id ?? tenant.project_id),
        group_id: String(recFact.payload?.group_id ?? tenant.group_id),
        field_id: recFieldId,
        season_id: recFact.payload?.season_id ?? null,
        crop_id: recFact.payload?.crop_code ?? null,
        created_by: auth.actor_id,
        variable_plan,
      }, recFact.payload);

      return reply.send({ ok: true, idempotent: result.idempotent, prescription: result.prescription });
    } catch (error: any) {
      const code = String(error?.message ?? "");
      if (
        code === "VARIABLE_PRESCRIPTION_REQUIRES_SKILL_TRACE" ||
        code === "VARIABLE_OPERATION_TYPE_MIXED_NOT_SUPPORTED" ||
        code === "MANAGEMENT_ZONE_FIELD_MISMATCH" ||
        code.startsWith("VARIABLE_")
      ) {
        return badRequest(reply, code);
      }
      if (code === "MANAGEMENT_ZONE_NOT_FOUND") {
        return reply.status(404).send({ ok: false, error: code });
      }
      req.log.error({ err: error }, "create variable prescription from recommendation failed");
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR" });
    }
  });

  app.get("/api/v1/prescriptions/:prescription_id", async (req, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, ["prescription.read", "ao_act.index.read"]);
    if (!auth) return;
    const query: any = (req as any).query ?? {};
    const tenant: TenantTriple = tenantFromQueryOrAuthV1(query, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const params: any = (req as any).params ?? {};
    const prescription_id = String(params.prescription_id ?? "").trim();
    if (!prescription_id) return badRequest(reply, "MISSING_PRESCRIPTION_ID");

    const prescription = await getPrescriptionById(pool, prescription_id, tenant);
    if (!prescription) return reply.status(404).send({ ok: false, error: "PRESCRIPTION_NOT_FOUND" });
    if (!requireFieldAllowedOr404V1(reply, auth, String((prescription as any)?.field_id ?? ""))) return;
    return reply.send({ ok: true, prescription });
  });

  app.get("/api/v1/prescriptions/by-recommendation/:recommendation_id", async (req, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, ["prescription.read", "ao_act.index.read"]);
    if (!auth) return;
    const query: any = (req as any).query ?? {};
    const tenant: TenantTriple = tenantFromQueryOrAuthV1(query, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const params: any = (req as any).params ?? {};
    const recommendation_id = String(params.recommendation_id ?? "").trim();
    if (!recommendation_id) return badRequest(reply, "MISSING_RECOMMENDATION_ID");

    const prescription = await getPrescriptionByRecommendationId(pool, recommendation_id, tenant);
    if (!prescription) return reply.status(404).send({ ok: false, error: "PRESCRIPTION_NOT_FOUND" });
    if (!requireFieldAllowedOr404V1(reply, auth, String((prescription as any)?.field_id ?? ""))) return;
    return reply.send({ ok: true, prescription });
  });

  app.post("/api/v1/prescriptions/:prescription_id/submit-approval", async (req, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, ["prescription.submit_approval", "approval.request", "ao_act.task.write"]);
    if (!auth) return;
    if (!requireAoActAdminV0(req, reply, { deniedError: "ROLE_APPROVAL_ADMIN_REQUIRED" })) return;

    const params: any = (req as any).params ?? {};
    const body: any = req.body ?? {};
    const prescription_id = String(params.prescription_id ?? "").trim();
    if (!prescription_id) return badRequest(reply, "MISSING_PRESCRIPTION_ID");
    if (body?.decision !== undefined || body?.approve !== undefined || body?.status !== undefined || body?.approved_by !== undefined) {
      return badRequest(reply, "APPROVAL_DECISION_NOT_ALLOWED_ON_SUBMIT");
    }

    const tenant: TenantTriple = {
      tenant_id: auth.tenant_id,
      project_id: String(body.project_id ?? auth.project_id),
      group_id: String(body.group_id ?? auth.group_id),
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        `SELECT * FROM prescription_contract_v1
         WHERE prescription_id = $1
           AND tenant_id = $2
           AND project_id = $3
           AND group_id = $4
         FOR UPDATE`,
        [prescription_id, tenant.tenant_id, tenant.project_id, tenant.group_id]
      );
      if (!locked.rows.length) {
        await client.query("ROLLBACK");
        return reply.status(404).send({ ok: false, error: "PRESCRIPTION_NOT_FOUND" });
      }
      const prescription: any = locked.rows[0];
      if (String(prescription.status) !== "READY_FOR_APPROVAL") {
        await client.query("ROLLBACK");
        return badRequest(reply, "PRESCRIPTION_NOT_READY_FOR_APPROVAL");
      }

      const operationAmount = prescription.operation_amount ?? {};
      const isVariableByZone = String(operationAmount.mode ?? "").toUpperCase() === "VARIABLE_BY_ZONE";
      const primitiveParameters = {
        prescription_id: String(prescription.prescription_id ?? ""),
        recommendation_id: String(prescription.recommendation_id ?? ""),
        operation_type: String(prescription.operation_type ?? ""),
        amount: Number(prescription.operation_amount?.amount ?? 0),
        unit: String(prescription.operation_amount?.unit ?? "unit"),
        ...(isVariableByZone ? {
          variable_mode: "VARIABLE_BY_ZONE",
          zone_count: Array.isArray(prescription.operation_amount?.zone_rates) ? prescription.operation_amount.zone_rates.length : 0,
        } : {}),
      };

      const delegated = await createApprovalRequestV1(client, auth, {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        program_id: body.program_id ?? null,
        field_id: String(prescription.field_id ?? ""),
        season_id: prescription.season_id ?? null,
        issuer: { kind: "human", id: auth.actor_id, namespace: "prescription_contract_v1" },
        action_type: deriveApprovalActionType(String(prescription.operation_type ?? "")),
        target: { kind: "field", ref: String(prescription.field_id ?? "") },
        time_window: {
          start_ts: Date.now(),
          end_ts: Date.now() + 30 * 60 * 1000,
        },
        parameter_schema: {
          keys: [
            { name: "prescription_id", type: "enum", enum: [String(prescription.prescription_id ?? "")] },
            { name: "recommendation_id", type: "enum", enum: [String(prescription.recommendation_id ?? "")] },
            { name: "operation_type", type: "enum", enum: [String(prescription.operation_type ?? "")] },
            { name: "amount", type: "number" },
            { name: "unit", type: "enum", enum: [String(prescription.operation_amount?.unit ?? "unit")] },
            ...(isVariableByZone ? [
              { name: "variable_mode", type: "enum", enum: ["VARIABLE_BY_ZONE"] },
              { name: "zone_count", type: "number" },
            ] : []),
          ],
        },
        parameters: primitiveParameters,
        constraints: { approval_required: Boolean(prescription.approval_requirement?.required) },
        meta: {
          prescription_id: prescription.prescription_id,
          recommendation_id: prescription.recommendation_id,
          operation_type: prescription.operation_type,
          field_id: prescription.field_id,
          season_id: prescription.season_id,
          approval_requirement: prescription.approval_requirement,
          acceptance_conditions: prescription.acceptance_conditions,
          ...(isVariableByZone ? {
            skip_auto_task_issue: true,
            variable_prescription: true,
            variable_plan: {
              mode: "VARIABLE_BY_ZONE",
              zone_rates: prescription.operation_amount?.zone_rates ?? [],
            },
            spatial_scope: prescription.spatial_scope,
            device_requirements: prescription.device_requirements,
          } : {}),
        },
      });

      await client.query(
        "UPDATE prescription_contract_v1 SET status = $2, updated_at = NOW() WHERE prescription_id = $1",
        [prescription_id, "APPROVAL_REQUESTED"]
      );
      await client.query("COMMIT");
      const updated = await getPrescriptionById(pool, prescription_id, tenant);
      return reply.send({ ok: true, prescription_id, approval_request_id: delegated.request_id, prescription: updated });
    } catch (e: any) {
      try { await client.query("ROLLBACK"); } catch {}
      return badRequest(reply, String(e?.message ?? "APPROVAL_REQUEST_CREATE_FAILED"));
    } finally {
      client.release();
    }
  });
}
