import type { FastifyInstance, FastifyReply } from "fastify";
import type { Pool } from "pg";
import { requireAoActAnyScopeV0 } from "../../auth/ao_act_authz_v0.js";
import { requireFieldAllowedOr404V1, tenantFromBodyOrAuthV1, tenantFromQueryOrAuthV1 } from "../../auth/tenant_scope_v1.js";
import { FertilizationBridgeErrorV1, FertilizationVariableBridgeV1 } from "../../services/fertilization/fertilization_bridge_v1.js";
import { FertilizationServiceErrorV1, FertilizationServiceV1 } from "../../services/fertilization/fertilization_service_v1.js";

type TenantTripleV1 = { tenant_id: string; project_id: string; group_id: string };

function badRequest(reply: FastifyReply, error: string) {
  return reply.status(400).send({ ok: false, error });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function tenantMatchesAuth(tenant: TenantTripleV1, auth: TenantTripleV1): boolean {
  return tenant.tenant_id === auth.tenant_id
    && tenant.project_id === auth.project_id
    && tenant.group_id === auth.group_id;
}

function requireTenantMatchOr404(reply: FastifyReply, tenant: TenantTripleV1, auth: TenantTripleV1): boolean {
  if (tenantMatchesAuth(tenant, auth)) return true;
  reply.status(404).send({ ok: false, error: "NOT_FOUND" });
  return false;
}

function requireFertilizationWriteAuth(req: any, reply: FastifyReply) {
  return requireAoActAnyScopeV0(req, reply, [
    "fields.write",
    "prescription.write",
    "acceptance.evaluate",
    "security.admin",
  ]);
}

function requireFertilizationReadAuth(req: any, reply: FastifyReply) {
  return requireAoActAnyScopeV0(req, reply, [
    "fields.read",
    "prescription.read",
    "acceptance.read",
    "ao_act.index.read",
    "security.admin",
  ]);
}

function handleServiceError(reply: FastifyReply, error: unknown) {
  if (error instanceof FertilizationServiceErrorV1 || error instanceof FertilizationBridgeErrorV1) {
    return reply.status(error.statusCode).send({ ok: false, error: error.message });
  }
  throw error;
}

export function registerFertilizationV1Routes(app: FastifyInstance, pool: Pool): void {
  const service = new FertilizationServiceV1(pool);
  const bridge = new FertilizationVariableBridgeV1(pool);

  app.post("/api/v1/fertilization/nitrogen-assessment", async (req, reply) => {
    const auth = requireFertilizationWriteAuth(req, reply);
    if (!auth) return reply;
    const body: any = req.body ?? {};
    const tenant = tenantFromBodyOrAuthV1(body, auth);
    if (!requireTenantMatchOr404(reply, tenant, auth)) return;
    if (!isNonEmptyString(body.field_id)) return badRequest(reply, "MISSING_OR_INVALID:field_id");
    if (!requireFieldAllowedOr404V1(reply, auth, body.field_id)) return;

    try {
      const result = await service.createNitrogenAssessment({ ...body, ...tenant, field_id: String(body.field_id) });
      return reply.send({ ok: true, fact_id: result.fact_id, assessment: result.assessment });
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  app.post("/api/v1/fertilization/recommendation", async (req, reply) => {
    const auth = requireFertilizationWriteAuth(req, reply);
    if (!auth) return reply;
    const body: any = req.body ?? {};
    const tenant = tenantFromBodyOrAuthV1(body, auth);
    if (!requireTenantMatchOr404(reply, tenant, auth)) return;
    if (!isNonEmptyString(body.field_id)) return badRequest(reply, "MISSING_OR_INVALID:field_id");
    if (!requireFieldAllowedOr404V1(reply, auth, body.field_id)) return;

    try {
      const result = await service.createRecommendation({ ...body, ...tenant, field_id: String(body.field_id) });
      return reply.send({ ok: true, fact_id: result.fact_id, recommendation: result.recommendation });
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  app.post("/api/v1/fertilization/prescription", async (req, reply) => {
    const auth = requireFertilizationWriteAuth(req, reply);
    if (!auth) return reply;
    const body: any = req.body ?? {};
    const tenant = tenantFromBodyOrAuthV1(body, auth);
    if (!requireTenantMatchOr404(reply, tenant, auth)) return;
    if (!isNonEmptyString(body.field_id)) return badRequest(reply, "MISSING_OR_INVALID:field_id");
    if (!requireFieldAllowedOr404V1(reply, auth, body.field_id)) return;

    try {
      const result = await service.createPrescription({ ...body, ...tenant, field_id: String(body.field_id) });
      return reply.send({ ok: true, fact_id: result.fact_id, prescription: result.prescription });
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  app.post("/api/v1/fertilization/prescription/:fertilization_prescription_id/to-variable-prescription", async (req, reply) => {
    const auth = requireFertilizationWriteAuth(req, reply);
    if (!auth) return reply;
    const params: any = (req as any).params ?? {};
    const body: any = req.body ?? {};
    const fertilization_prescription_id = String(params.fertilization_prescription_id ?? "").trim();
    if (!fertilization_prescription_id) return badRequest(reply, "MISSING_OR_INVALID:fertilization_prescription_id");
    const tenant = tenantFromBodyOrAuthV1(body, auth);
    if (!requireTenantMatchOr404(reply, tenant, auth)) return;

    try {
      const result = await bridge.createVariablePrescription({ ...tenant, fertilization_prescription_id, created_by: auth.actor_id });
      const fieldId = String(result.fertilization_prescription?.field_id ?? "");
      if (!requireFieldAllowedOr404V1(reply, auth, fieldId)) return;
      return reply.send({
        ok: true,
        idempotent: result.idempotent,
        variable_plan: result.variable_plan,
        variable_prescription: result.variable_prescription,
        fertilization_prescription: result.fertilization_prescription,
      });
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  app.post("/api/v1/fertilization/acceptance/evaluate", async (req, reply) => {
    const auth = requireFertilizationWriteAuth(req, reply);
    if (!auth) return reply;
    const body: any = req.body ?? {};
    const tenant = tenantFromBodyOrAuthV1(body, auth);
    if (!requireTenantMatchOr404(reply, tenant, auth)) return;

    try {
      const result = await service.evaluateAcceptance({ ...body, ...tenant });
      const fieldId = String(result.acceptance?.field_id ?? "");
      if (!requireFieldAllowedOr404V1(reply, auth, fieldId)) return;
      return reply.send({ ok: true, fact_id: result.fact_id, acceptance: result.acceptance });
    } catch (error) {
      return handleServiceError(reply, error);
    }
  });

  app.get("/api/v1/fertilization/assessment/:assessment_id", async (req, reply) => {
    const auth = requireFertilizationReadAuth(req, reply);
    if (!auth) return reply;
    const params: any = (req as any).params ?? {};
    const query: any = (req as any).query ?? {};
    const assessment_id = String(params.assessment_id ?? "").trim();
    if (!assessment_id) return badRequest(reply, "MISSING_OR_INVALID:assessment_id");
    const tenant = tenantFromQueryOrAuthV1(query, auth);
    if (!requireTenantMatchOr404(reply, tenant, auth)) return;

    const found = await service.getAssessment(tenant, assessment_id);
    if (!found) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    if (!requireFieldAllowedOr404V1(reply, auth, found.record_json.field_id)) return;
    return reply.send({ ok: true, fact: found });
  });

  app.get("/api/v1/fertilization/prescription/:fertilization_prescription_id", async (req, reply) => {
    const auth = requireFertilizationReadAuth(req, reply);
    if (!auth) return reply;
    const params: any = (req as any).params ?? {};
    const query: any = (req as any).query ?? {};
    const fertilization_prescription_id = String(params.fertilization_prescription_id ?? "").trim();
    if (!fertilization_prescription_id) return badRequest(reply, "MISSING_OR_INVALID:fertilization_prescription_id");
    const tenant = tenantFromQueryOrAuthV1(query, auth);
    if (!requireTenantMatchOr404(reply, tenant, auth)) return;

    const found = await service.getPrescription(tenant, fertilization_prescription_id);
    if (!found) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    if (!requireFieldAllowedOr404V1(reply, auth, found.record_json.field_id)) return;
    return reply.send({ ok: true, fact: found });
  });
}
