import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { requireAoActAnyScopeV0 } from "../auth/ao_act_authz_v0.js";
import {
  requireFieldAllowedOr404V1,
  requireTenantMatchOr404V1,
  requireTenantScopeV1,
  tenantFromBodyOrAuthV1,
  tenantFromQueryOrAuthV1,
} from "../auth/tenant_scope_v1.js";
import {
  createRoiLedgersFromAsExecuted,
  listRoiLedgerByAsExecuted,
  listRoiLedgerByField,
  listRoiLedgerByPrescription,
  listRoiLedgerByTask,
} from "../domain/roi/roi_ledger_v1.js";

export function registerRoiLedgerV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/roi-ledger/health", async () => ({
    ok: true,
    module: "roi_ledger_v1",
  }));

  app.post("/api/v1/roi-ledger/from-as-executed", async (req, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, ["roi_ledger.write", "ao_act.task.write"]);
    if (!auth) return;

    const body: any = req.body ?? {};
    const tenant = tenantFromBodyOrAuthV1(body, auth);
    if (!requireTenantScopeV1(reply, tenant)) return;
    if (!requireTenantMatchOr404V1(reply, auth, tenant)) return;

    const as_executed_id = String(body?.as_executed_id ?? "").trim();
    const skill_trace_id = String(body?.skill_trace_id ?? "").trim() || null;
    const skill_refs = Array.isArray(body?.skill_refs) ? body.skill_refs : [];
    if (!as_executed_id) {
      return reply.status(400).send({ ok: false, error: "MISSING_AS_EXECUTED_ID" });
    }

    try {
      const result = await createRoiLedgersFromAsExecuted(pool, { ...tenant, as_executed_id, skill_trace_id, skill_refs });
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
    const auth = requireAoActAnyScopeV0(req, reply, ["roi_ledger.read", "ao_act.index.read"]);
    if (!auth) return;

    const query: any = req.query ?? {};
    const params: any = req.params ?? {};
    const tenant = tenantFromQueryOrAuthV1(query, auth);
    if (!requireTenantScopeV1(reply, tenant)) return;
    if (!requireTenantMatchOr404V1(reply, auth, tenant)) return;

    const as_executed_id = String(params?.as_executed_id ?? "").trim();
    if (!as_executed_id) return reply.status(400).send({ ok: false, error: "MISSING_AS_EXECUTED_ID" });

    const rows = await listRoiLedgerByAsExecuted(pool, { ...tenant, as_executed_id });
    return reply.send({ ok: true, roi_ledgers: rows });
  });

  app.get("/api/v1/roi-ledger/by-task/:task_id", async (req, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, ["roi_ledger.read", "ao_act.index.read"]);
    if (!auth) return;

    const query: any = req.query ?? {};
    const params: any = req.params ?? {};
    const tenant = tenantFromQueryOrAuthV1(query, auth);
    if (!requireTenantScopeV1(reply, tenant)) return;
    if (!requireTenantMatchOr404V1(reply, auth, tenant)) return;

    const task_id = String(params?.task_id ?? "").trim();
    if (!task_id) return reply.status(400).send({ ok: false, error: "MISSING_TASK_ID" });

    const rows = await listRoiLedgerByTask(pool, { ...tenant, task_id });
    return reply.send({ ok: true, roi_ledgers: rows });
  });

  app.get("/api/v1/roi-ledger/by-prescription/:prescription_id", async (req, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, ["roi_ledger.read", "ao_act.index.read"]);
    if (!auth) return;

    const query: any = req.query ?? {};
    const params: any = req.params ?? {};
    const tenant = tenantFromQueryOrAuthV1(query, auth);
    if (!requireTenantScopeV1(reply, tenant)) return;
    if (!requireTenantMatchOr404V1(reply, auth, tenant)) return;

    const prescription_id = String(params?.prescription_id ?? "").trim();
    if (!prescription_id) return reply.status(400).send({ ok: false, error: "MISSING_PRESCRIPTION_ID" });

    const rows = await listRoiLedgerByPrescription(pool, { ...tenant, prescription_id });
    return reply.send({ ok: true, roi_ledgers: rows });
  });

  app.get("/api/v1/roi-ledger/by-field/:field_id", async (req, reply) => {
    const auth = requireAoActAnyScopeV0(req, reply, ["roi_ledger.read", "ao_act.index.read"]);
    if (!auth) return;

    const query: any = req.query ?? {};
    const params: any = req.params ?? {};
    const tenant = tenantFromQueryOrAuthV1(query, auth);
    if (!requireTenantScopeV1(reply, tenant)) return;
    if (!requireTenantMatchOr404V1(reply, auth, tenant)) return;

    const field_id = String(params?.field_id ?? "").trim();
    if (!field_id) return reply.status(400).send({ ok: false, error: "MISSING_FIELD_ID" });
    if (!requireFieldAllowedOr404V1(reply, auth, field_id)) return;

    const rows = await listRoiLedgerByField(pool, { ...tenant, field_id });
    return reply.send({ ok: true, roi_ledgers: rows });
  });
}
