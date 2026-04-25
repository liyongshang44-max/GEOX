import type { FastifyInstance, FastifyReply } from "fastify";
import type { Pool } from "pg";

import {
  createAsExecutedFromReceipt,
  getAsExecutedById,
  listAsExecutedByReceipt,
  listAsExecutedByTask,
  listAsExecutedByPrescription,
} from "../domain/execution/as_executed_v1.js";

type TenantTriple = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

function tenantFromBody(body: any): TenantTriple {
  return {
    tenant_id: String(body?.tenant_id ?? "").trim(),
    project_id: String(body?.project_id ?? "").trim(),
    group_id: String(body?.group_id ?? "").trim(),
  };
}

function tenantFromQuery(query: any): TenantTriple {
  return {
    tenant_id: String(query?.tenant_id ?? "").trim(),
    project_id: String(query?.project_id ?? "").trim(),
    group_id: String(query?.group_id ?? "").trim(),
  };
}

function requireTenantScope(reply: FastifyReply, tenant: TenantTriple): boolean {
  if (!tenant.tenant_id || !tenant.project_id || !tenant.group_id) {
    reply.status(400).send({ ok: false, error: "MISSING_TENANT_SCOPE" });
    return false;
  }
  return true;
}

export function registerAsExecutedV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/as-executed/health", async () => ({
    ok: true,
    module: "as_executed_v1",
  }));

  app.post("/api/v1/as-executed/from-receipt", async (req, reply) => {
    const body: any = req.body ?? {};
    const tenant = tenantFromBody(body);
    if (!requireTenantScope(reply, tenant)) return;

    const task_id = String(body?.task_id ?? "").trim();
    const receipt_id = String(body?.receipt_id ?? "").trim();
    if (!task_id) {
      return reply.status(400).send({ ok: false, error: "MISSING_TASK_ID" });
    }

    try {
      const result = await createAsExecutedFromReceipt(pool, {
        ...tenant,
        task_id,
        receipt_id: receipt_id || null,
      });
      return reply.send({
        ok: true,
        as_executed: result.as_executed,
        as_applied: result.as_applied,
        idempotent: result.idempotent,
      });
    } catch (error) {
      const code = String((error as Error)?.message ?? "");
      if (code === "RECEIPT_NOT_FOUND") {
        return reply.status(404).send({ ok: false, error: code });
      }
      if (code === "INVALID_RECEIPT_TASK_ID") {
        return reply.status(422).send({ ok: false, error: code });
      }
      req.log.error({ err: error }, "create as-executed from receipt failed");
      return reply.status(500).send({ ok: false, error: "INTERNAL_ERROR" });
    }
  });

  app.get("/api/v1/as-executed/:as_executed_id", async (req, reply) => {
    const query: any = req.query ?? {};
    const params: any = req.params ?? {};
    const tenant = tenantFromQuery(query);
    if (!requireTenantScope(reply, tenant)) return;

    const as_executed_id = String(params?.as_executed_id ?? "").trim();
    if (!as_executed_id) {
      return reply.status(400).send({ ok: false, error: "MISSING_AS_EXECUTED_ID" });
    }

    const row = await getAsExecutedById(pool, { ...tenant, as_executed_id });
    if (!row) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return reply.send({ ok: true, as_executed: row });
  });

  app.get("/api/v1/as-executed/by-task/:task_id", async (req, reply) => {
    const query: any = req.query ?? {};
    const params: any = req.params ?? {};
    const tenant = tenantFromQuery(query);
    if (!requireTenantScope(reply, tenant)) return;

    const task_id = String(params?.task_id ?? "").trim();
    if (!task_id) {
      return reply.status(400).send({ ok: false, error: "MISSING_TASK_ID" });
    }

    const rows = await listAsExecutedByTask(pool, { ...tenant, task_id });
    return reply.send({ ok: true, as_executed: rows });
  });

  app.get("/api/v1/as-executed/by-receipt/:receipt_id", async (req, reply) => {
    const query: any = req.query ?? {};
    const params: any = req.params ?? {};
    const tenant = tenantFromQuery(query);
    if (!requireTenantScope(reply, tenant)) return;

    const receipt_id = String(params?.receipt_id ?? "").trim();
    if (!receipt_id) {
      return reply.status(400).send({ ok: false, error: "MISSING_RECEIPT_ID" });
    }

    const rows = await listAsExecutedByReceipt(pool, { ...tenant, receipt_id });
    return reply.send({ ok: true, as_executed: rows });
  });

  app.get("/api/v1/as-executed/by-prescription/:prescription_id", async (req, reply) => {
    const query: any = req.query ?? {};
    const params: any = req.params ?? {};
    const tenant = tenantFromQuery(query);
    if (!requireTenantScope(reply, tenant)) return;

    const prescription_id = String(params?.prescription_id ?? "").trim();
    if (!prescription_id) {
      return reply.status(400).send({ ok: false, error: "MISSING_PRESCRIPTION_ID" });
    }

    const rows = await listAsExecutedByPrescription(pool, { ...tenant, prescription_id });
    return reply.send({ ok: true, records: rows });
  });

}
