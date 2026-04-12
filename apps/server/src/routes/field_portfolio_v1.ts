import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0";
import { hasFieldAccess } from "../auth/route_role_authz";
import { projectFieldPortfolioListV1, type FieldPortfolioRiskLevel, type FieldPortfolioSortBy } from "../projections/field_portfolio_v1";

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

function parseList(raw: unknown): string[] {
  const asList = Array.isArray(raw) ? raw : [raw];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const chunk of asList) {
    const parts = String(chunk ?? "").split(",");
    for (const part of parts) {
      const s = String(part ?? "").trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function parseBoolean(raw: unknown): boolean | undefined {
  if (typeof raw === "boolean") return raw;
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return undefined;
}

function parseIntWithin(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function parseRiskLevels(raw: unknown): FieldPortfolioRiskLevel[] {
  const out: FieldPortfolioRiskLevel[] = [];
  for (const lv of parseList(raw)) {
    const normalized = lv.trim().toUpperCase();
    if (normalized === "LOW" || normalized === "MEDIUM" || normalized === "HIGH" || normalized === "CRITICAL") {
      if (!out.includes(normalized)) out.push(normalized);
    }
  }
  return out;
}

function parseSortBy(raw: unknown): FieldPortfolioSortBy {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "open_alerts") return "open_alerts";
  if (value === "pending_acceptance") return "pending_acceptance";
  if (value === "last_operation_at") return "last_operation_at";
  if (value === "cost") return "cost";
  if (value === "updated_at") return "updated_at";
  if (value === "field_name") return "field_name";
  return "risk";
}

function parseSortOrder(raw: unknown): "asc" | "desc" {
  return String(raw ?? "").trim().toLowerCase() === "asc" ? "asc" : "desc";
}

function parseProjectionFilters(q: any) {
  return {
    windowMs: Number.isFinite(Number(q.window_ms)) ? Number(q.window_ms) : undefined,
    tags: parseList(q.tags ?? q["tags[]"]),
    risk_levels: parseRiskLevels(q.risk_levels ?? q["risk_levels[]"]),
    has_open_alerts: parseBoolean(q.has_open_alerts),
    has_pending_acceptance: parseBoolean(q.has_pending_acceptance),
    query: String(q.query ?? "").trim(),
    sort_by: parseSortBy(q.sort_by),
    sort_order: parseSortOrder(q.sort_order),
    page: parseIntWithin(q.page, 1, 1, 1_000_000),
    page_size: parseIntWithin(q.page_size, 20, 1, 200),
  };
}

export function registerFieldPortfolioV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/fields/portfolio", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const q: any = (req as any).query ?? {};
    const requestedFieldIds = parseList(q.field_ids ?? q["field_ids[]"] ?? q.field_id);
    const scopedFieldIds = requestedFieldIds.length > 0
      ? requestedFieldIds.filter((x) => hasFieldAccess(auth, x))
      : (Array.isArray(auth.allowed_field_ids)
        ? auth.allowed_field_ids.map((x: any) => String(x ?? "").trim()).filter(Boolean)
        : []);

    const filters = parseProjectionFilters(q);
    const payload = await projectFieldPortfolioListV1({
      pool,
      tenant,
      field_ids: scopedFieldIds,
      nowMs: Date.now(),
      ...filters,
    });

    return reply.send(payload);
  });

  app.get("/api/v1/fields/portfolio/summary", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const tenant = tenantFromReq(req as any, auth);
    if (!requireTenantMatchOr404(auth, tenant, reply)) return;

    const q: any = (req as any).query ?? {};
    const requestedFieldIds = parseList(q.field_ids ?? q["field_ids[]"] ?? q.field_id);
    const scopedFieldIds = requestedFieldIds.length > 0
      ? requestedFieldIds.filter((x) => hasFieldAccess(auth, x))
      : (Array.isArray(auth.allowed_field_ids)
        ? auth.allowed_field_ids.map((x: any) => String(x ?? "").trim()).filter(Boolean)
        : []);

    const filters = parseProjectionFilters(q);
    const payload = await projectFieldPortfolioListV1({
      pool,
      tenant,
      field_ids: scopedFieldIds,
      nowMs: Date.now(),
      windowMs: filters.windowMs,
      tags: filters.tags,
      risk_levels: filters.risk_levels,
      has_open_alerts: filters.has_open_alerts,
      has_pending_acceptance: filters.has_pending_acceptance,
      query: filters.query,
      sort_by: filters.sort_by,
      sort_order: filters.sort_order,
    });

    return reply.send({ ok: true, summary: payload.summary });
  });
}
