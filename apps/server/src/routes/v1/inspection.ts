import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { requireAoActAnyScopeV0, type AoActAuthContextV0, type AoActScopeV0 } from "../../auth/ao_act_authz_v0.js";
import {
  createPestDiseaseInspectionAssessmentV1,
  createPestDiseaseInspectionRequestV1,
  createPestDiseaseInspectionReviewV1,
  createPestDiseaseObservationV1,
  createPestDiseaseSignalV1,
  evaluatePestDiseaseInspectionAcceptanceV1,
  getPestDiseaseInspectionV1,
  PestDiseaseInspectionServiceError,
} from "../../services/inspection/pest_disease_inspection_service_v1.js";

const INSPECTION_WRITE_SCOPES: AoActScopeV0[] = ["fields.write", "security.admin"];
const INSPECTION_ACCEPTANCE_SCOPES: AoActScopeV0[] = ["acceptance.evaluate", "security.admin"];
const INSPECTION_READ_SCOPES: AoActScopeV0[] = ["fields.read", "ao_act.index.read", "security.admin"];

function requireAnyScope(req: FastifyRequest, reply: FastifyReply, scopes: AoActScopeV0[]): AoActAuthContextV0 | null {
  return requireAoActAnyScopeV0(req, reply, scopes);
}

function sendServiceError(reply: FastifyReply, err: unknown) {
  if (err instanceof PestDiseaseInspectionServiceError) {
    return reply.status(err.statusCode).send({ ok: false, error: err.code, message: err.message });
  }
  return reply.status(500).send({ ok: false, error: "INSPECTION_INTERNAL_ERROR" });
}

export function registerInspectionV1Routes(app: FastifyInstance, pool: Pool): void {
  app.post("/api/v1/inspection/pest-disease/request", async (req, reply) => {
    const auth = requireAnyScope(req, reply, INSPECTION_WRITE_SCOPES);
    if (!auth) return reply;
    try {
      const result = await createPestDiseaseInspectionRequestV1(pool, req.body, auth);
      return reply.send({ ok: true, ...result });
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.post("/api/v1/inspection/pest-disease/observation", async (req, reply) => {
    const auth = requireAnyScope(req, reply, INSPECTION_WRITE_SCOPES);
    if (!auth) return reply;
    try {
      const result = await createPestDiseaseObservationV1(pool, req.body, auth);
      return reply.send({ ok: true, ...result });
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.post("/api/v1/inspection/pest-disease/signal", async (req, reply) => {
    const auth = requireAnyScope(req, reply, INSPECTION_WRITE_SCOPES);
    if (!auth) return reply;
    try {
      const result = await createPestDiseaseSignalV1(pool, req.body, auth);
      return reply.send({ ok: true, ...result });
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.post("/api/v1/inspection/pest-disease/assessment", async (req, reply) => {
    const auth = requireAnyScope(req, reply, INSPECTION_WRITE_SCOPES);
    if (!auth) return reply;
    try {
      const result = await createPestDiseaseInspectionAssessmentV1(pool, req.body, auth);
      return reply.send({ ok: true, ...result });
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.post("/api/v1/inspection/pest-disease/review", async (req, reply) => {
    const auth = requireAnyScope(req, reply, INSPECTION_WRITE_SCOPES);
    if (!auth) return reply;
    try {
      const result = await createPestDiseaseInspectionReviewV1(pool, req.body, auth);
      return reply.send({ ok: true, ...result });
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.post("/api/v1/inspection/pest-disease/acceptance/evaluate", async (req, reply) => {
    const auth = requireAnyScope(req, reply, INSPECTION_ACCEPTANCE_SCOPES);
    if (!auth) return reply;
    try {
      const result = await evaluatePestDiseaseInspectionAcceptanceV1(pool, req.body, auth);
      return reply.send({ ok: true, ...result });
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });

  app.get("/api/v1/inspection/pest-disease/:inspection_id", async (req, reply) => {
    const auth = requireAnyScope(req, reply, INSPECTION_READ_SCOPES);
    if (!auth) return reply;
    try {
      const inspectionId = String((req.params as any)?.inspection_id ?? "").trim();
      const result = await getPestDiseaseInspectionV1(pool, inspectionId, auth);
      return reply.send({ ok: true, ...result });
    } catch (err) {
      return sendServiceError(reply, err);
    }
  });
}
