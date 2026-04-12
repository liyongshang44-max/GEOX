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

function parseStringList(raw: unknown): string[] {
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

function parseSortBy(raw: unknown): "field_name" | "field_id" | "risk_level" | "open_alerts" | "pending_acceptance" | "latest_operation" | "estimated_total" | "actual_total" {
  const v = String(raw ?? "").trim();
  switch (v) {
    case "field_name":
    case "field_id":
    case "open_alerts":
    case "pending_acceptance":
    case "latest_operation":
    case "estimated_total":
    case "actual_total":
    case "risk_level":
      return v;
    default:
      return "risk_level";
  }
}

function parseSortOrder(raw: unknown): "asc" | "desc" {
  const v = String(raw ?? "").trim().toLowerCase();
  return v === "asc" ? "asc" : "desc";
}

function parseRiskLevels(raw: unknown): Array<"LOW" | "MEDIUM" | "HIGH"> {
  const out: Array<"LOW" | "MEDIUM" | "HIGH"> = [];
  for (const level of parseStringList(raw)) {
    const v = level.toUpperCase();
    if (v === "LOW" || v === "MEDIUM" || v === "HIGH") out.push(v);
  }
  return Array.from(new Set(out));
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
    const tags = parseStringList(q.tags ?? q["tags[]"]);
    const risk_levels = parseRiskLevels(q.risk_levels ?? q["risk_levels[]"]);
    const has_open_alerts = parseBoolean(q.has_open_alerts);
    const has_pending_acceptance = parseBoolean(q.has_pending_acceptance);
    const query = String(q.query ?? "").trim();
    const sort_by = parseSortBy(q.sort_by);
    const sort_order = parseSortOrder(q.sort_order);
    const page = parseIntWithin(q.page, 1, 1, 1_000_000);
    const page_size = parseIntWithin(q.page_size, 20, 1, 200);

    const payload = await projectFieldPortfolioListV1({
      pool,
      tenant,
      field_ids: scopedFieldIds,
      windowMs,
      nowMs: Date.now(),
      tags,
      risk_levels,
      has_open_alerts,
      has_pending_acceptance,
      query,
      sort_by,
      sort_order,
      page,
      page_size,
    });

    return reply.send(payload);
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

    return reply.send({ ok: true, summary: payload.summary });
  });
}
