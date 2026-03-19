import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0";
import { projectOperationStateV1 } from "../projections/operation_state_v1";
import { projectRecommendationStateV1 } from "../projections/recommendation_state_v1";
import { projectDeviceStateV1 } from "../projections/device_state_v1";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

function tenantFromReq(req: any, auth: any): TenantTriple {
  const q = req.query ?? {};
  return {
    tenant_id: String(q.tenant_id ?? auth.tenant_id),
    project_id: String(q.project_id ?? auth.project_id),
    group_id: String(q.group_id ?? auth.group_id)
  };
}

function requireTenantMatchOr404(auth: TenantTriple, tenant: TenantTriple, reply: any): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

export function registerOperationStateV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/operations", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const q: any = (req as any).query ?? {};
    const limit = Math.max(1, Math.min(Number(q.limit ?? 100) || 100, 300));

    let items = await projectOperationStateV1(pool, tenant);
    if (q.field_id) items = items.filter((x) => x.field_id === String(q.field_id));
    if (q.device_id) items = items.filter((x) => x.device_id === String(q.device_id));
    if (q.final_status) items = items.filter((x) => x.final_status === String(q.final_status));
    items = items.slice(0, limit);

    return reply.send({
      ok: true,
      count: items.length,
      items,
      recommendation_states: projectRecommendationStateV1(items),
      device_states: projectDeviceStateV1(items)
    });
  });

  app.get("/api/v1/operations/:operation_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;
    const operation_id = String((req.params as any)?.operation_id ?? "").trim();
    if (!operation_id) return reply.status(400).send({ ok: false, error: "MISSING_OPERATION_ID" });
    const items = await projectOperationStateV1(pool, tenant);
    const item = items.find((x) => x.operation_id === operation_id);
    if (!item) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, item });
  });
}
