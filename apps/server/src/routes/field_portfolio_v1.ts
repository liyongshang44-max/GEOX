import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0";
import { hasFieldAccess } from "../auth/route_role_authz";
import { projectFieldPortfolioListV1 } from "../projections/field_portfolio_v1";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };

function tenantFromReq(req: any, auth: any): TenantTriple {
  const q = req.query ?? {};
  return {
    tenant_id: String(q.tenant_id ?? auth.tenant_id),
    project_id: String(q.project_id ?? auth.project_id),
    group_id: String(q.group_id ?? auth.group_id),
  };
}

function requireTenantMatchOr404(auth: TenantTriple, tenant: TenantTriple, reply: any): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

function parseFieldIds(raw: unknown): string[] {
  const asList = Array.isArray(raw) ? raw : [raw];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const chunk of asList) {
    const parts = String(chunk ?? "").split(",");
    for (const p of parts) {
      const s = String(p ?? "").trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function parseTags(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : [raw];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const parts = String(value ?? "").split(",");
    for (const part of parts) {
      const normalized = String(part ?? "").trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}

export function registerFieldPortfolioV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/fields/portfolio", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const q: any = (req as any).query ?? {};
    const requestedFieldIds = parseFieldIds(q.field_ids ?? q["field_ids[]"] ?? q.field_id);
    const scopedFieldIds = requestedFieldIds.length > 0
      ? requestedFieldIds.filter((x) => hasFieldAccess(auth, x))
      : (Array.isArray(auth.allowed_field_ids)
        ? auth.allowed_field_ids.map((x: any) => String(x ?? "").trim()).filter(Boolean)
        : []);

    const windowMsRaw = Number(q.window_ms ?? "");
    const windowMs = Number.isFinite(windowMsRaw) ? windowMsRaw : undefined;

    const payload = await projectFieldPortfolioListV1({
      pool,
      tenant,
      field_ids: scopedFieldIds,
      windowMs,
      nowMs: Date.now(),
    });

    const tags = parseTags(q.tags ?? q["tags[]"]);
    if (tags.length === 0) return reply.send(payload);
    const tagSet = new Set(tags);
    const filteredItems = payload.items.filter((item) => item.tags.some((tag) => tagSet.has(tag)));
    return reply.send({
      ...payload,
      count: filteredItems.length,
      items: filteredItems,
      summary: {
        total_fields: filteredItems.length,
        by_risk: {
          low: filteredItems.filter((x) => x.risk.level === "LOW").length,
          medium: filteredItems.filter((x) => x.risk.level === "MEDIUM").length,
          high: filteredItems.filter((x) => x.risk.level === "HIGH").length,
        },
        total_open_alerts: filteredItems.reduce((s, x) => s + x.alert_summary.open_count, 0),
        total_pending_acceptance: filteredItems.reduce((s, x) => s + x.pending_acceptance_summary.pending_acceptance_count, 0),
        total_invalid_execution: filteredItems.reduce((s, x) => s + x.pending_acceptance_summary.invalid_execution_count, 0),
        total_estimated_cost: Number(filteredItems.reduce((s, x) => s + x.cost_summary.estimated_total, 0).toFixed(2)),
        total_actual_cost: Number(filteredItems.reduce((s, x) => s + x.cost_summary.actual_total, 0).toFixed(2)),
        offline_fields: filteredItems.filter((x) => x.telemetry.device_offline).length,
      },
    });
  });

  app.get("/api/v1/fields/portfolio/summary", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const q: any = (req as any).query ?? {};
    const requestedFieldIds = parseFieldIds(q.field_ids ?? q["field_ids[]"] ?? q.field_id);
    const scopedFieldIds = requestedFieldIds.length > 0
      ? requestedFieldIds.filter((x) => hasFieldAccess(auth, x))
      : (Array.isArray(auth.allowed_field_ids)
        ? auth.allowed_field_ids.map((x: any) => String(x ?? "").trim()).filter(Boolean)
        : []);

    const windowMsRaw = Number(q.window_ms ?? "");
    const windowMs = Number.isFinite(windowMsRaw) ? windowMsRaw : undefined;

    const payload = await projectFieldPortfolioListV1({
      pool,
      tenant,
      field_ids: scopedFieldIds,
      windowMs,
      nowMs: Date.now(),
    });

    const tags = parseTags(q.tags ?? q["tags[]"]);
    if (tags.length === 0) return reply.send({ ok: true, summary: payload.summary });
    const tagSet = new Set(tags);
    const filteredItems = payload.items.filter((item) => item.tags.some((tag) => tagSet.has(tag)));
    return reply.send({
      ok: true,
      summary: {
        total_fields: filteredItems.length,
        by_risk: {
          low: filteredItems.filter((x) => x.risk.level === "LOW").length,
          medium: filteredItems.filter((x) => x.risk.level === "MEDIUM").length,
          high: filteredItems.filter((x) => x.risk.level === "HIGH").length,
        },
        total_open_alerts: filteredItems.reduce((s, x) => s + x.alert_summary.open_count, 0),
        total_pending_acceptance: filteredItems.reduce((s, x) => s + x.pending_acceptance_summary.pending_acceptance_count, 0),
        total_invalid_execution: filteredItems.reduce((s, x) => s + x.pending_acceptance_summary.invalid_execution_count, 0),
        total_estimated_cost: Number(filteredItems.reduce((s, x) => s + x.cost_summary.estimated_total, 0).toFixed(2)),
        total_actual_cost: Number(filteredItems.reduce((s, x) => s + x.cost_summary.actual_total, 0).toFixed(2)),
        offline_fields: filteredItems.filter((x) => x.telemetry.device_offline).length,
      },
    });
  });
}
