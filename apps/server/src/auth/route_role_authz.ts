import type { FastifyReply, FastifyRequest } from "fastify";
import { requireAoActAuthV0, type AoActAuthContextV0 } from "./ao_act_authz_v0";
import { isRoleAllowed, methodToAction, type AuthResource } from "../domain/auth/roles";

function deny(reply: FastifyReply, asNotFound: boolean, code = "AUTH_ROLE_DENIED"): null {
  if (asNotFound) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return null;
  }
  reply.status(403).send({ ok: false, error: code });
  return null;
}

function normalizeFieldIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (typeof raw === "string") return raw.split(",").map((x) => x.trim()).filter(Boolean);
  const one = String(raw ?? "").trim();
  return one ? [one] : [];
}

export function hasFieldAccess(auth: AoActAuthContextV0, fieldId: string): boolean {
  const allowed = Array.isArray(auth.allowed_field_ids) ? auth.allowed_field_ids : [];
  if (!allowed.length) return auth.role !== "client";
  return allowed.includes(fieldId);
}

export function enforceFieldScopeOrDeny(
  auth: AoActAuthContextV0,
  fieldId: string | null | undefined,
  reply: FastifyReply,
  opts: { asNotFound?: boolean } = {}
): boolean {
  const fid = String(fieldId ?? "").trim();
  if (!fid) return true;
  if (hasFieldAccess(auth, fid)) return true;
  deny(reply, Boolean(opts.asNotFound), "AUTH_FIELD_SCOPE_DENIED");
  return false;
}

export async function enforceOperationFieldScope(
  auth: AoActAuthContextV0,
  operationId: string | null | undefined,
  reply: FastifyReply,
  resolveFieldId: (operationId: string) => Promise<string | null> | string | null,
  opts: { asNotFound?: boolean } = {}
): Promise<string | null> {
  const opId = String(operationId ?? "").trim();
  if (!opId) return null;
  const fieldId = await resolveFieldId(opId);
  const normalizedFieldId = String(fieldId ?? "").trim();
  if (!normalizedFieldId) return null;
  if (!enforceFieldScopeOrDeny(auth, normalizedFieldId, reply, opts)) return null;
  return normalizedFieldId;
}

function collectRequestedFieldIds(req: FastifyRequest): string[] {
  const params: any = (req as any).params ?? {};
  const query: any = (req as any).query ?? {};
  const body: any = (req as any).body ?? {};
  return Array.from(new Set([
    ...normalizeFieldIds(params.field_id),
    ...normalizeFieldIds(params.fieldId),
    ...normalizeFieldIds(query.field_id),
    ...normalizeFieldIds(query.field_ids),
    ...normalizeFieldIds(body.field_id),
    ...normalizeFieldIds(body.field_ids),
  ]));
}

export function enforceRouteRoleAuth(
  req: FastifyRequest,
  reply: FastifyReply,
  resource: AuthResource,
  opts: { asNotFound?: boolean } = {}
): AoActAuthContextV0 | null {
  const auth = requireAoActAuthV0(req, reply);
  if (!auth) return null;
  const action = methodToAction(req.method);
  if (!isRoleAllowed(auth.role, resource, action)) return deny(reply, Boolean(opts.asNotFound));

  const requestedFields = collectRequestedFieldIds(req);
  if (requestedFields.length > 0) {
    const allAllowed = requestedFields.every((fid) => hasFieldAccess(auth, fid));
    if (!allAllowed) return deny(reply, Boolean(opts.asNotFound), "AUTH_FIELD_SCOPE_DENIED");
  }
  if (auth.role === "client" && action !== "read") {
    return deny(reply, Boolean(opts.asNotFound));
  }
  return auth;
}
