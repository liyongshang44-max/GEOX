import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { SamplingServiceV1 } from "../../services/sampling/sampling_service_v1.js";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isIntMs(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && Math.floor(v) === v && v > 0;
}

function isObjectRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function badRequest(reply: any, error: string) {
  return reply.status(400).send({ ok: false, error });
}

export function registerSamplingV1Routes(app: FastifyInstance, pool: Pool): void {
  const service = new SamplingServiceV1(pool);

  app.post("/api/v1/sampling/plan", async (req, reply) => {
    const body: any = req.body ?? {};
    if (!isNonEmptyString(body.tenant_id)) return badRequest(reply, "MISSING_OR_INVALID:tenant_id");
    if (!isNonEmptyString(body.project_id)) return badRequest(reply, "MISSING_OR_INVALID:project_id");
    if (!isNonEmptyString(body.group_id)) return badRequest(reply, "MISSING_OR_INVALID:group_id");
    if (!isNonEmptyString(body.field_id)) return badRequest(reply, "MISSING_OR_INVALID:field_id");
    if (body.zone_id != null && !isNonEmptyString(body.zone_id)) return badRequest(reply, "MISSING_OR_INVALID:zone_id");
    if (!isNonEmptyString(body.reason)) return badRequest(reply, "MISSING_OR_INVALID:reason");
    if (!isNonEmptyString(body.sample_type)) return badRequest(reply, "MISSING_OR_INVALID:sample_type");
    if (body.required_depth_cm != null && (typeof body.required_depth_cm !== "number" || !Number.isFinite(body.required_depth_cm))) return badRequest(reply, "MISSING_OR_INVALID:required_depth_cm");
    if (typeof body.required_points !== "number" || !Number.isInteger(body.required_points) || body.required_points <= 0) return badRequest(reply, "MISSING_OR_INVALID:required_points");
    if (!Array.isArray(body.evidence_refs)) return badRequest(reply, "MISSING_OR_INVALID:evidence_refs");

    const created = await service.createPlan(body);
    return reply.send({ ok: true, ...created });
  });

  app.post("/api/v1/sampling/receipt", async (req, reply) => {
    const body: any = req.body ?? {};
    if (!isNonEmptyString(body.plan_id)) return badRequest(reply, "MISSING_OR_INVALID:plan_id");
    if (!isNonEmptyString(body.sample_id)) return badRequest(reply, "MISSING_OR_INVALID:sample_id");
    if (!isNonEmptyString(body.tenant_id)) return badRequest(reply, "MISSING_OR_INVALID:tenant_id");
    if (!isNonEmptyString(body.project_id)) return badRequest(reply, "MISSING_OR_INVALID:project_id");
    if (!isNonEmptyString(body.group_id)) return badRequest(reply, "MISSING_OR_INVALID:group_id");
    if (!isNonEmptyString(body.field_id)) return badRequest(reply, "MISSING_OR_INVALID:field_id");
    if (!isIntMs(body.collected_at_ts)) return badRequest(reply, "MISSING_OR_INVALID:collected_at_ts");
    if (!isNonEmptyString(body.collector_actor_id)) return badRequest(reply, "MISSING_OR_INVALID:collector_actor_id");
    if (!isNonEmptyString(body.sample_type)) return badRequest(reply, "MISSING_OR_INVALID:sample_type");
    if (!Array.isArray(body.evidence_refs) || body.evidence_refs.length < 1) return badRequest(reply, "MISSING_OR_INVALID:evidence_refs");
    if (!isNonEmptyString(body.chain_of_custody_status)) return badRequest(reply, "MISSING_OR_INVALID:chain_of_custody_status");

    const created = await service.createReceipt(body);
    return reply.send({ ok: true, ...created });
  });

  app.post("/api/v1/sampling/lab-result", async (req, reply) => {
    const body: any = req.body ?? {};
    if (!isNonEmptyString(body.sample_id)) return badRequest(reply, "MISSING_OR_INVALID:sample_id");
    if (!isIntMs(body.imported_at_ts)) return badRequest(reply, "MISSING_OR_INVALID:imported_at_ts");
    if (!isObjectRecord(body.metrics)) return badRequest(reply, "MISSING_OR_INVALID:metrics");
    if (!isObjectRecord(body.units)) return badRequest(reply, "MISSING_OR_INVALID:units");
    if (!Array.isArray(body.evidence_refs)) return badRequest(reply, "MISSING_OR_INVALID:evidence_refs");
    if (!isNonEmptyString(body.quality_status)) return badRequest(reply, "MISSING_OR_INVALID:quality_status");

    const created = await service.createLabResult(body);
    return reply.send({ ok: true, ...created });
  });

  app.get("/api/v1/sampling/plan/:plan_id", async (req, reply) => {
    const plan_id = (req.params as any)?.plan_id;
    if (!isNonEmptyString(plan_id)) return badRequest(reply, "MISSING_OR_INVALID:plan_id");

    const found = await service.getPlan(plan_id);
    if (!found) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, fact: found });
  });

  app.get("/api/v1/sampling/sample/:sample_id", async (req, reply) => {
    const sample_id = (req.params as any)?.sample_id;
    if (!isNonEmptyString(sample_id)) return badRequest(reply, "MISSING_OR_INVALID:sample_id");

    const found = await service.getSample(sample_id);
    if (!found) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, fact: found });
  });
}
