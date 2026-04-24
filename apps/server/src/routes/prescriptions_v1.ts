import type { FastifyInstance, FastifyReply } from "fastify";
import type { Pool } from "pg";
import { requireAoActAdminV0, requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { createApprovalRequestV1, requireTenantMatchOr404 } from "../domain/approval/approval_request_service_v1.js";
import {
  createPrescriptionFromRecommendation,
  getPrescriptionById,
  getPrescriptionByRecommendationId,
  loadRecommendationFact,
  markPrescriptionStatus,
} from "../domain/prescription/prescription_contract_v1.js";

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
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;

    const body: any = req.body ?? {};
    const recommendation_id = String(body.recommendation_id ?? "").trim();
    const tenant: TenantTriple = {
      tenant_id: String(body.tenant_id ?? auth.tenant_id),
      project_id: String(body.project_id ?? auth.project_id),
      group_id: String(body.group_id ?? auth.group_id),
    };
    const field_id = String(body.field_id ?? "").trim();
    if (!recommendation_id) return badRequest(reply, "MISSING_RECOMMENDATION_ID");
    if (!field_id) return badRequest(reply, "MISSING_FIELD_ID");
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const recFact = await loadRecommendationFact(pool, tenant, recommendation_id);
    if (!recFact) return reply.status(404).send({ ok: false, error: "RECOMMENDATION_NOT_FOUND" });

    const result = await createPrescriptionFromRecommendation(pool, {
      recommendation_id,
      tenant_id: tenant.tenant_id,
      field_id,
      season_id: body.season_id ?? recFact.payload?.season_id ?? null,
      crop_id: body.crop_id ?? recFact.payload?.crop_code ?? null,
      zone_id: body.zone_id ?? null,
      created_by: auth.actor_id,
    }, recFact.payload);

    return reply.send({ ok: true, idempotent: result.idempotent, prescription: result.prescription });
  });

  app.get("/api/v1/prescriptions/:prescription_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const params: any = (req as any).params ?? {};
    const prescription_id = String(params.prescription_id ?? "").trim();
    if (!prescription_id) return badRequest(reply, "MISSING_PRESCRIPTION_ID");

    const prescription = await getPrescriptionById(pool, prescription_id);
    if (!prescription) return reply.status(404).send({ ok: false, error: "PRESCRIPTION_NOT_FOUND" });
    if (prescription.tenant_id !== auth.tenant_id) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, prescription });
  });

  app.get("/api/v1/prescriptions/by-recommendation/:recommendation_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const params: any = (req as any).params ?? {};
    const recommendation_id = String(params.recommendation_id ?? "").trim();
    if (!recommendation_id) return badRequest(reply, "MISSING_RECOMMENDATION_ID");

    const prescription = await getPrescriptionByRecommendationId(pool, recommendation_id);
    if (!prescription) return reply.status(404).send({ ok: false, error: "PRESCRIPTION_NOT_FOUND" });
    if (prescription.tenant_id !== auth.tenant_id) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, prescription });
  });

  app.post("/api/v1/prescriptions/:prescription_id/submit-approval", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;
    if (!requireAoActAdminV0(req, reply, { deniedError: "ROLE_APPROVAL_ADMIN_REQUIRED" })) return;

    const params: any = (req as any).params ?? {};
    const body: any = req.body ?? {};
    const prescription_id = String(params.prescription_id ?? "").trim();
    if (!prescription_id) return badRequest(reply, "MISSING_PRESCRIPTION_ID");

    const prescription = await getPrescriptionById(pool, prescription_id);
    if (!prescription) return reply.status(404).send({ ok: false, error: "PRESCRIPTION_NOT_FOUND" });
    if (prescription.tenant_id !== auth.tenant_id) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    if (String(prescription.status) !== "READY_FOR_APPROVAL") {
      return badRequest(reply, "PRESCRIPTION_NOT_READY_FOR_APPROVAL");
    }

    const tenant: TenantTriple = {
      tenant_id: prescription.tenant_id,
      project_id: String(body.project_id ?? auth.project_id),
      group_id: String(body.group_id ?? auth.group_id),
    };
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    let delegated: { ok: true; fact_id: string; request_id: string };
    try {
      delegated = await createApprovalRequestV1(pool, auth, {
        tenant_id: tenant.tenant_id,
        project_id: tenant.project_id,
        group_id: tenant.group_id,
        program_id: body.program_id ?? null,
        field_id: prescription.field_id,
        season_id: prescription.season_id ?? null,
        issuer: { kind: "human", id: auth.actor_id, namespace: "prescription_contract_v1" },
        action_type: deriveApprovalActionType(prescription.operation_type),
        target: { kind: "field", ref: prescription.field_id },
        time_window: {
          start_ts: Date.now(),
          end_ts: Date.now() + 30 * 60 * 1000,
        },
        parameter_schema: {
          keys: [
            { name: "prescription_id", type: "enum", enum: [prescription.prescription_id] },
            { name: "recommendation_id", type: "enum", enum: [prescription.recommendation_id] },
            { name: "amount", type: "number" },
            { name: "unit", type: "enum", enum: [prescription.operation_amount.unit] },
          ],
        },
        parameters: {
          prescription_id: prescription.prescription_id,
          recommendation_id: prescription.recommendation_id,
          operation_type: prescription.operation_type,
          amount: prescription.operation_amount.amount,
          unit: prescription.operation_amount.unit,
          acceptance_conditions: prescription.acceptance_conditions,
        },
        constraints: { approval_required: Boolean(prescription.approval_requirement.required) },
        meta: {
          prescription_id: prescription.prescription_id,
          recommendation_id: prescription.recommendation_id,
          operation_type: prescription.operation_type,
          field_id: prescription.field_id,
          season_id: prescription.season_id,
          approval_requirement: prescription.approval_requirement,
        },
      });
    } catch (e: any) {
      return badRequest(reply, String(e?.message ?? "APPROVAL_REQUEST_CREATE_FAILED"));
    }

    const updated = await markPrescriptionStatus(pool, prescription_id, "APPROVAL_REQUESTED");
    return reply.send({ ok: true, prescription_id, approval_request_id: delegated.request_id, prescription: updated });
  });
}
