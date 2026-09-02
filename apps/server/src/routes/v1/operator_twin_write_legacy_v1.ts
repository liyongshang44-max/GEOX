// Purpose: preserve the two legacy scenario-to-recommendation POST routes through an independent physical registration module.
// Boundary: only POST handlers are registered on the real Fastify instance; no Proxy, no GET registration, and no canonical MCFT `/runtime` route.
// PR-SEC-2 containment: production registration is authenticated and scope-bound before the frozen legacy handler executes.

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0, type AoActAuthContextV0 } from "../../auth/ao_act_authz_v0.js";
import { hasFieldAccess } from "../../auth/route_role_authz.js";
import { registerOperatorTwinReadRoutes as collectLegacyOperatorTwinHandlersV1 } from "./operator_twin.js";

const LEGACY_POST_PATHS_V1 = [
  "/api/v1/operator/twin/fields/:field_id/root-zone-scenarios/:scenario_set_id/options/:option_id/submit-recommendation",
  "/api/v1/operator/twin/fields/:field_id/scenarios/:scenario_set_id/options/:option_id/submit-recommendation",
] as const;

function textV1(value: unknown): string {
  return String(value ?? "").trim();
}

function denyV1(reply: FastifyReply, status: number, error: string): null {
  reply.status(status).send({ ok: false, error });
  return null;
}

function bindRecommendationWriterPrincipalV1(
  req: FastifyRequest,
  reply: FastifyReply,
): AoActAuthContextV0 | null {
  const auth = requireAoActScopeV0(req, reply, "recommendation.write");
  if (!auth) return null;

  const params = ((req as any).params ?? {}) as Record<string, unknown>;
  const body = ((req as any).body ?? {}) as Record<string, unknown>;
  const fieldId = textV1(params.field_id);

  if (!fieldId || !hasFieldAccess(auth, fieldId)) {
    return denyV1(reply, 403, "AUTH_FIELD_SCOPE_DENIED");
  }

  const declaredScope = {
    tenant_id: textV1(body.tenant_id),
    project_id: textV1(body.project_id),
    group_id: textV1(body.group_id),
  };
  if (
    declaredScope.tenant_id !== auth.tenant_id ||
    declaredScope.project_id !== auth.project_id ||
    declaredScope.group_id !== auth.group_id
  ) {
    return denyV1(reply, 403, "AUTH_TENANT_SCOPE_MISMATCH");
  }

  const declaredActor = textV1(body.operator_id);
  if (declaredActor && declaredActor !== auth.actor_id) {
    return denyV1(reply, 403, "AUTH_DECLARED_ACTOR_MISMATCH");
  }

  // The downstream legacy handler keeps its frozen route/persistence semantics,
  // but the persisted operator_id is sourced from the authenticated principal.
  (req as any).body = { ...body, operator_id: auth.actor_id };
  return auth;
}

function capturePostHandlersV1(pool: Pool): ReadonlyMap<string, unknown> {
  const handlers = new Map<string, unknown>();
  const collector = {
    get() { return collector; },
    post(path: string, handler: unknown) { handlers.set(path, handler); return collector; },
  } as unknown as FastifyInstance;
  collectLegacyOperatorTwinHandlersV1(collector, pool);
  return handlers;
}

export function registerOperatorTwinWriteLegacyRoutesV1(app: FastifyInstance, pool: Pool): void {
  const handlers = capturePostHandlersV1(pool);
  for (const path of LEGACY_POST_PATHS_V1) {
    const handler = handlers.get(path);
    if (!handler) throw new Error(`LEGACY_OPERATOR_TWIN_POST_HANDLER_MISSING:${path}`);
    const downstream = handler as (req: FastifyRequest, reply: FastifyReply) => unknown;
    app.post(path, async (req: FastifyRequest, reply: FastifyReply) => {
      const auth = bindRecommendationWriterPrincipalV1(req, reply);
      if (!auth) return;
      return downstream(req, reply);
    });
  }
  if (handlers.size !== LEGACY_POST_PATHS_V1.length) throw new Error("LEGACY_OPERATOR_TWIN_POST_INVENTORY_DIVERGENCE");
}
