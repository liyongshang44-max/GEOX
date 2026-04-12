import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0";
import { hasFieldAccess } from "../auth/route_role_authz";
import type { FieldPortfolioRiskLevel } from "../projections/field_portfolio_v1";
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

function parseList(raw: unknown): string[] {
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

function parseBoolean(raw: unknown): boolean | undefined {
  if (typeof raw === "boolean") return raw;
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return undefined;
}

function parseIntWithin(raw: unknown, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function parseRiskLevels(raw: unknown): FieldPortfolioRiskLevel[] {
  const levels = parseList(raw).map((v) => v.toUpperCase());
  const out: FieldPortfolioRiskLevel[] = [];
  const seen = new Set<FieldPortfolioRiskLevel>();
  for (const level of levels) {
    if (level !== "LOW" && level !== "MEDIUM" && level !== "HIGH" && level !== "CRITICAL") continue;
    if (seen.has(level)) continue;
    seen.add(level);
    out.push(level);
  }
  return out;
}

function parseSortBy(raw: unknown): "field_name" | "field_id" | "risk_level" | "open_alerts" | "pending_acceptance" | "latest_operation" | "estimated_total" | "actual_total" | undefined {
  const value = String(raw ?? "").trim();
  if (!value) return undefined;
  if (["field_name", "field_id", "risk_level", "open_alerts", "pending_acceptance", "latest_operation", "estimated_total", "actual_total"].includes(value)) {
    return value as any;
  }
  return undefined;
}

function parseSortOrder(raw: unknown): "asc" | "desc" | undefined {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "asc" || value === "desc") return value;
  return undefined;
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

    const windowMsRaw = Number(q.window_ms ?? "");
    const windowMs = Number.isFinite(windowMsRaw) ? windowMsRaw : undefined;

    const payload = await projectFieldPortfolioListV1({
      pool,
      tenant,
      field_ids: scopedFieldIds,
      windowMs,
      nowMs: Date.now(),
      tags: parseList(q.tags ?? q["tags[]"]),
      risk_levels: parseRiskLevels(q.risk_levels ?? q["risk_levels[]"]),
      has_open_alerts: parseBoolean(q.has_open_alerts),
      has_pending_acceptance: parseBoolean(q.has_pending_acceptance),
      query: String(q.query ?? "").trim(),
      sort_by: parseSortBy(q.sort_by),
      sort_order: parseSortOrder(q.sort_order),
      page: parseIntWithin(q.page, 1, 1, 1_000_000),
      page_size: parseIntWithin(q.page_size, 20, 1, 200),
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

    const windowMsRaw = Number(q.window_ms ?? "");
    const windowMs = Number.isFinite(windowMsRaw) ? windowMsRaw : undefined;

    const payload = await projectFieldPortfolioListV1({
      pool,
      tenant,
      field_ids: scopedFieldIds,
      windowMs,
      nowMs: Date.now(),
      tags: parseList(q.tags ?? q["tags[]"]),
      risk_levels: parseRiskLevels(q.risk_levels ?? q["risk_levels[]"]),
      has_open_alerts: parseBoolean(q.has_open_alerts),
      has_pending_acceptance: parseBoolean(q.has_pending_acceptance),
      query: String(q.query ?? "").trim(),
    });

    return reply.send({ ok: true, summary: payload.summary });
  });
}
