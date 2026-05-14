import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { requireAoActAnyScopeV0 } from "../../auth/ao_act_authz_v0.js";
import { requireTenantMatchOr404V1, tenantFromQueryOrAuthV1 } from "../../auth/tenant_scope_v1.js";
import { buildOperatorLearningValidationV1 } from "../../domain/operator_learning/learning_validation_v1.js";

const OPERATOR_LEARNING_VALIDATION_READ_SCOPES = ["field_memory.read", "roi_ledger.read", "ao_act.index.read"] as const;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

export function registerOperatorLearningValidationRoutes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/operator/learning-validation", async (req: any, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, OPERATOR_LEARNING_VALIDATION_READ_SCOPES);
    if (!auth) return;
    const query = req.query ?? {};
    const tenant = tenantFromQueryOrAuthV1(query, auth);
    if (!requireTenantMatchOr404V1(reply, auth, tenant)) return;
    const operationId = text(query.operation_id ?? query.operationId);
    if (!operationId) return reply.status(400).send({ ok: false, error: "OPERATION_ID_REQUIRED" });
    const validation = await buildOperatorLearningValidationV1(pool, tenant, operationId);
    return reply.send({ ok: true, source: "operator_learning_validation_v1", dataScope: "OFFICIAL_OPERATOR_API", generated_at: new Date().toISOString(), learning_validation: validation });
  });

  app.get("/api/v1/operator/operations/:operation_id/learning-validation", async (req: any, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, OPERATOR_LEARNING_VALIDATION_READ_SCOPES);
    if (!auth) return;
    const tenant = tenantFromQueryOrAuthV1(req.query ?? {}, auth);
    if (!requireTenantMatchOr404V1(reply, auth, tenant)) return;
    const operationId = text(req.params?.operation_id);
    if (!operationId) return reply.status(400).send({ ok: false, error: "OPERATION_ID_REQUIRED" });
    const validation = await buildOperatorLearningValidationV1(pool, tenant, operationId);
    return reply.send({ ok: true, source: "operator_learning_validation_v1", dataScope: "OFFICIAL_OPERATOR_API", generated_at: new Date().toISOString(), learning_validation: validation });
  });
}
