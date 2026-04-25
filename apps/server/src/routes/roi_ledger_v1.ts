import type { FastifyInstance, FastifyReply } from "fastify";
import type { Pool } from "pg";

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import {
  createRoiLedgersFromAsExecuted,
  listRoiLedgerByAsExecuted,
  listRoiLedgerByField,
  listRoiLedgerByPrescription,
  listRoiLedgerByTask,
} from "../domain/roi/roi_ledger_v1.js";

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

function tenantFromBodyWithAuth(body: any, auth: TenantTriple): TenantTriple {
  return {
    tenant_id: String(body?.tenant_id ?? auth.tenant_id).trim(),
    project_id: String(body?.project_id ?? auth.project_id).trim(),
    group_id: String(body?.group_id ?? auth.group_id).trim(),
  };
}

function tenantFromQueryWithAuth(query: any, auth: TenantTriple): TenantTriple {
  return {
    tenant_id: String(query?.tenant_id ?? auth.tenant_id).trim(),
    project_id: String(query?.project_id ?? auth.project_id).trim(),
    group_id: String(query?.group_id ?? auth.group_id).trim(),
  };
}

function requireTenantScope(reply: FastifyReply, tenant: TenantTriple): boolean {
  if (!tenant.tenant_id || !tenant.project_id || !tenant.group_id) {
    reply.status(400).send({ ok: false, error: "MISSING_TENANT_SCOPE" });
    return false;
  }
  return true;
}

function requireTenantMatchOr404(reply: FastifyReply, auth: TenantTriple, tenant: TenantTriple): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

export function registerRoiLedgerV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/roi-ledger/health", async () => ({
    ok: true,
    module: "roi_ledger_v1",
  }));

  app.post("/api/v1/roi-ledger/from-as-executed", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
    if (!auth) return;

    const body: any = req.body ?? {};
    const tenant = tenantFromBodyWithAuth(body, auth);
    if (!requireTenantScope(reply, tenant)) return;
    if (!requireTenantMatchOr404(reply, auth, tenant)) return;

    const as_executed_id = String(body?.as_executed_id ?? "").trim();
    if (!as_executed_id) {
      return reply.status(400).send({ ok: false, error: "MISSING_AS_EXECUTED_ID" });
    }

    try {
      const result = await createRoiLedgersFromAsExecuted(pool, { ...tenant, as_executed_id });
      return reply.send({ ok: true, idempotent: result.idempotent, roi_ledgers: result.roi_ledgers });
    } catch (error) {
      const code = String((error as Error)?.message ?? "");
      if (code === "AS_EXECUTED_NOT_FOUND") {
        return reply.status(404).send({ ok: false, error: code });
      }
      req.log.error({ err: error }, "create roi ledger from as-executed failed");
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR" });
    }
  });

  app.get("/api/v1/roi-ledger/by-as-executed/:as_executed_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const query: any = req.query ?? {};
    const params: any = req.params ?? {};
    const tenant = tenantFromQueryWithAuth(query, auth);
    if (!requireTenantScope(reply, tenant)) return;
    if (!requireTenantMatchOr404(reply, auth, tenant)) return;

    const as_executed_id = String(params?.as_executed_id ?? "").trim();
    if (!as_executed_id) return reply.status(400).send({ ok: false, error: "MISSING_AS_EXECUTED_ID" });

    const rows = await listRoiLedgerByAsExecuted(pool, { ...tenant, as_executed_id });
    return reply.send({ ok: true, roi_ledgers: rows });
  });

  app.get("/api/v1/roi-ledger/by-task/:task_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const query: any = req.query ?? {};
    const params: any = req.params ?? {};
    const tenant = tenantFromQueryWithAuth(query, auth);
    if (!requireTenantScope(reply, tenant)) return;
    if (!requireTenantMatchOr404(reply, auth, tenant)) return;

    const task_id = String(params?.task_id ?? "").trim();
    if (!task_id) return reply.status(400).send({ ok: false, error: "MISSING_TASK_ID" });

    const rows = await listRoiLedgerByTask(pool, { ...tenant, task_id });
    return reply.send({ ok: true, roi_ledgers: rows });
  });

  app.get("/api/v1/roi-ledger/by-prescription/:prescription_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const query: any = req.query ?? {};
    const params: any = req.params ?? {};
    const tenant = tenantFromQueryWithAuth(query, auth);
    if (!requireTenantScope(reply, tenant)) return;
    if (!requireTenantMatchOr404(reply, auth, tenant)) return;

    const prescription_id = String(params?.prescription_id ?? "").trim();
    if (!prescription_id) return reply.status(400).send({ ok: false, error: "MISSING_PRESCRIPTION_ID" });

    const rows = await listRoiLedgerByPrescription(pool, { ...tenant, prescription_id });
    return reply.send({ ok: true, roi_ledgers: rows });
  });

  app.get("/api/v1/roi-ledger/by-field/:field_id", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const query: any = req.query ?? {};
    const params: any = req.params ?? {};
    const tenant = tenantFromQueryWithAuth(query, auth);
    if (!requireTenantScope(reply, tenant)) return;
    if (!requireTenantMatchOr404(reply, auth, tenant)) return;

    const field_id = String(params?.field_id ?? "").trim();
    if (!field_id) return reply.status(400).send({ ok: false, error: "MISSING_FIELD_ID" });

    const rows = await listRoiLedgerByField(pool, { ...tenant, field_id });
    return reply.send({ ok: true, roi_ledgers: rows });
  });
}
