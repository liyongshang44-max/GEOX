import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { SamplingServiceV1 } from "../../services/sampling/sampling_service_v1.js";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isIntMs(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && Math.floor(v) === v && v > 0;
}

function badRequest(reply: any, error: string) {
  return reply.status(400).send({ ok: false, error });
}

export function registerSamplingV1Routes(app: FastifyInstance, pool: Pool): void {
  const service = new SamplingServiceV1(pool);

  app.post("/api/v1/sampling/plan", async (req, reply) => {
    const body: any = req.body ?? {};
    if (!body.subject_ref || typeof body.subject_ref !== "object") return badRequest(reply, "MISSING_OR_INVALID:subject_ref");
    if (!isNonEmptyString(body.subject_ref.project_id)) return badRequest(reply, "MISSING_OR_INVALID:subject_ref.project_id");
    if (!isNonEmptyString(body.subject_ref.field_id)) return badRequest(reply, "MISSING_OR_INVALID:subject_ref.field_id");
    if (!isNonEmptyString(body.sampling_kind)) return badRequest(reply, "MISSING_OR_INVALID:sampling_kind");
    if (!isNonEmptyString(body.requested_by)) return badRequest(reply, "MISSING_OR_INVALID:requested_by");
    if (!isIntMs(body.requested_at_ts)) return badRequest(reply, "MISSING_OR_INVALID:requested_at_ts");

    const created = await service.createPlan(body);
    return reply.send({ ok: true, ...created });
  });

  app.post("/api/v1/sampling/receipt", async (req, reply) => {
    const body: any = req.body ?? {};
    if (!isNonEmptyString(body.plan_id)) return badRequest(reply, "MISSING_OR_INVALID:plan_id");
    if (!body.sample_ref || typeof body.sample_ref !== "object") return badRequest(reply, "MISSING_OR_INVALID:sample_ref");
    if (!isNonEmptyString(body.sample_ref.sample_id)) return badRequest(reply, "MISSING_OR_INVALID:sample_ref.sample_id");
    if (!isIntMs(body.collected_at_ts)) return badRequest(reply, "MISSING_OR_INVALID:collected_at_ts");
    if (!isNonEmptyString(body.collector_id)) return badRequest(reply, "MISSING_OR_INVALID:collector_id");
    if (!Array.isArray(body.evidence_refs) || body.evidence_refs.length < 1) return badRequest(reply, "MISSING_OR_INVALID:evidence_refs");

    const created = await service.createReceipt(body);
    return reply.send({ ok: true, ...created });
  });

  app.post("/api/v1/sampling/lab-result", async (req, reply) => {
    const body: any = req.body ?? {};
    if (!isNonEmptyString(body.sample_id)) return badRequest(reply, "MISSING_OR_INVALID:sample_id");
    if (!isNonEmptyString(body.report_ref)) return badRequest(reply, "MISSING_OR_INVALID:report_ref");
    if (!isIntMs(body.imported_at_ts)) return badRequest(reply, "MISSING_OR_INVALID:imported_at_ts");
    if (!body.metrics || typeof body.metrics !== "object" || Array.isArray(body.metrics)) return badRequest(reply, "MISSING_OR_INVALID:metrics");

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
