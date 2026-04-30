import type { FastifyReply } from "fastify";

export type TenantTripleV1 = {
  tenant_id: string;
  project_id: string;
  group_id: string;
};

export type TenantScopedResourceV1 = TenantTripleV1 & {
  field_id?: string | null;
};

function normalizeTenant(input: any): TenantTripleV1 {
  return {
    tenant_id: String(input?.tenant_id ?? "").trim(),
    project_id: String(input?.project_id ?? "").trim(),
    group_id: String(input?.group_id ?? "").trim(),
  };
}

export function tenantFromBodyOrAuthV1(body: any, auth: TenantTripleV1): TenantTripleV1 {
  return normalizeTenant({
    tenant_id: body?.tenant_id ?? auth.tenant_id,
    project_id: body?.project_id ?? auth.project_id,
    group_id: body?.group_id ?? auth.group_id,
  });
}

export function tenantFromQueryOrAuthV1(query: any, auth: TenantTripleV1): TenantTripleV1 {
  return normalizeTenant({
    tenant_id: query?.tenant_id ?? auth.tenant_id,
    project_id: query?.project_id ?? auth.project_id,
    group_id: query?.group_id ?? auth.group_id,
  });
}

export function requireTenantScopeV1(reply: FastifyReply, tenant: TenantTripleV1): boolean {
  if (!tenant.tenant_id || !tenant.project_id || !tenant.group_id) {
    reply.status(400).send({ ok: false, error: "MISSING_TENANT_SCOPE" });
    return false;
  }
  return true;
}

export function requireTenantMatchOr404V1(reply: FastifyReply, auth: TenantTripleV1, tenant: TenantTripleV1): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

export function requireFieldAllowedOr404V1(
  reply: FastifyReply,
  auth: { allowed_field_ids?: string[] },
  field_id: string | null | undefined,
): boolean {
  const normalized = String(field_id ?? "").trim();
  const allowlist = Array.isArray(auth.allowed_field_ids)
    ? auth.allowed_field_ids.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  if (allowlist.length === 0) return true;
  if (normalized && allowlist.includes(normalized)) return true;
  reply.status(404).send({ ok: false, error: "NOT_FOUND" });
  return false;
}
