import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { projectFieldProgramStateV1 } from "../projections/field_program_state_v1.js";

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

export function registerFieldProgramStateV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/field-programs", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const q: any = (req as any).query ?? {};
    const limit = Math.max(1, Math.min(Number(q.limit ?? 100) || 100, 300));

    let items = await projectFieldProgramStateV1(pool, tenant);
    if (q.program_id) items = items.filter((x) => x.program_id === String(q.program_id));
    if (q.field_id) items = items.filter((x) => x.field_id === String(q.field_id));
    if (q.season_id) items = items.filter((x) => x.season_id === String(q.season_id));
    if (q.status) items = items.filter((x) => x.status === String(q.status));

    return reply.send({ ok: true, count: items.slice(0, limit).length, items: items.slice(0, limit) });
  });

  app.get("/api/v1/field-programs/:program_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const program_id = String((req.params as any)?.program_id ?? "").trim();
    if (!program_id) return reply.status(400).send({ ok: false, error: "MISSING_PROGRAM_ID" });

    const item = (await projectFieldProgramStateV1(pool, tenant)).find((x) => x.program_id === program_id);
    if (!item) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, item });
  });
}
