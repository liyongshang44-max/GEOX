import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { detectSchedulingConflictsV1 } from "../domain/scheduling/conflict_detector_v1.js";
import { projectSchedulingHintsV1 } from "../domain/scheduling/scheduling_hint_v1.js";

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

export function registerSchedulingConflictV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/scheduling/conflicts", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const q: any = (req as any).query ?? {};
    let items = await detectSchedulingConflictsV1(pool, tenant);
    if (q.field_id) items = items.filter((x) => x.kind !== "DEVICE_CONFLICT" && x.target_ref === String(q.field_id));
    if (q.device_id) items = items.filter((x) => x.kind === "DEVICE_CONFLICT" && x.target_ref === String(q.device_id));

    return reply.send({ ok: true, count: items.length, items });
  });

  app.get("/api/v1/scheduling/hints", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const items = await projectSchedulingHintsV1(pool, tenant);
    return reply.send({ ok: true, count: items.length, items });
  });

  app.get("/api/v1/fields/:field_id/conflicts", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const fieldId = String((req.params as any)?.field_id ?? "").trim();
    if (!fieldId) return reply.status(400).send({ ok: false, error: "MISSING_FIELD_ID" });

    const items = (await detectSchedulingConflictsV1(pool, tenant)).filter((x) => x.kind !== "DEVICE_CONFLICT" && x.target_ref === fieldId);
    return reply.send({ ok: true, field_id: fieldId, count: items.length, items });
  });

  app.get("/api/v1/devices/:device_id/conflicts", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const deviceId = String((req.params as any)?.device_id ?? "").trim();
    if (!deviceId) return reply.status(400).send({ ok: false, error: "MISSING_DEVICE_ID" });

    const items = (await detectSchedulingConflictsV1(pool, tenant)).filter((x) => x.kind === "DEVICE_CONFLICT" && x.target_ref === deviceId);
    return reply.send({ ok: true, device_id: deviceId, count: items.length, items });
  });

  app.get("/api/v1/programs/:program_id/scheduling-hint", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;
    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const programId = String((req.params as any)?.program_id ?? "").trim();
    if (!programId) return reply.status(400).send({ ok: false, error: "MISSING_PROGRAM_ID" });

    const item = (await projectSchedulingHintsV1(pool, tenant)).find((x) => x.program_id === programId);
    if (!item) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, item });
  });
}
