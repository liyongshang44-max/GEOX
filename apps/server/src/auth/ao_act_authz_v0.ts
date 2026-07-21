import type { FastifyReply, FastifyRequest } from "fastify"; // Fastify request/reply types used by route handlers.
import { isScopeAllowedForRoleV1, type AuthRole } from "../domain/auth/roles.js";
import { defaultGeoxTokenFilePathV1, hasStructuredTokenSourceV1, isStrictRuntimeProfileV1, parseBearerTokenV1, readGeoxTokenFileV1 } from "./token_ssot_v1.js";

export type AoActScopeV0 =
  | "alerts.read"
  | "alerts.write"
  | "ao_act.index.read"
  | "ao_act.receipt.write"
  | "ao_act.task.write"
  | "devices.bind"
  | "devices.credentials.revoke"
  | "devices.credentials.write"
  | "devices.read"
  | "devices.status.read"
  | "devices.write"
  | "evidence_export.read"
  | "evidence_export.write"
  | "evidence.artifact.write"
  | "fields.read"
  | "fields.write"
  | "inspection.read"
  | "inspection.write"
  | "operation.plan.create"
  | "operation.plan.transition"
  | "telemetry.read"
  | "telemetry.write";

export type AoActRoleV0 = "admin" | "operator" | "viewer" | "client" | "executor" | "agronomist" | "approver" | "auditor" | "support";

type TokenRecordV0 = {
  token: string;
  token_id: string;
  actor_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  scopes: AoActScopeV0[];
  revoked: boolean;
  role?: AoActRoleV0;
  allowed_field_ids?: string[];
};

type TokenFileV0 = { version: "ao_act_tokens_v0"; tokens: TokenRecordV0[] };

export type AoActAuthContextV0 = {
  actor_id: string;
  token_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  scopes: AoActScopeV0[];
  role: AoActRoleV0;
  allowed_field_ids: string[];
};

export function defaultAoActTokenFilePathV0(): string {
  return defaultGeoxTokenFilePathV1();
}

export function readTokenFileV0(fp?: string): TokenFileV0 {
  return readGeoxTokenFileV1(fp) as TokenFileV0;
}

function parseBearerToken(req: FastifyRequest): string | null {
  return parseBearerTokenV1(req);
}

function roleFromRecord(rec: TokenRecordV0): AoActRoleV0 {
  if (["operator","viewer","client","executor","agronomist","approver","auditor","support"].includes(String(rec.role))) return rec.role as AoActRoleV0;
  return "admin";
}

function authContextFromRecord(rec: TokenRecordV0): AoActAuthContextV0 {
  return {
    actor_id: rec.actor_id,
    token_id: rec.token_id,
    tenant_id: rec.tenant_id,
    project_id: rec.project_id,
    group_id: rec.group_id,
    scopes: [...rec.scopes],
    role: roleFromRecord(rec),
    allowed_field_ids: Array.isArray(rec.allowed_field_ids) ? [...rec.allowed_field_ids] : [],
  };
}

export function authenticateAoActV0(req: FastifyRequest, reply: FastifyReply, fp?: string): AoActAuthContextV0 | null {
  if (isStrictRuntimeProfileV1() && !hasStructuredTokenSourceV1()) {
    reply.status(503).send({ error: "TOKEN_SSOT_REQUIRED" });
    return null;
  }
  const token = parseBearerToken(req);
  if (!token) {
    reply.status(401).send({ error: "UNAUTHORIZED" });
    return null;
  }
  const file = readTokenFileV0(fp);
  const rec = file.tokens.find((candidate) => candidate.token === token) ?? null;
  if (!rec || rec.revoked) {
    reply.status(401).send({ error: "UNAUTHORIZED" });
    return null;
  }
  return authContextFromRecord(rec);
}

function roleAllowsScopeV0(role: AoActRoleV0, scope: AoActScopeV0): boolean {
  return isScopeAllowedForRoleV1(role as AuthRole, scope);
}

export function requireAoActScopeV0(req: FastifyRequest, reply: FastifyReply, scope: AoActScopeV0, fp?: string): AoActAuthContextV0 | null {
  const auth = authenticateAoActV0(req, reply, fp);
  if (!auth) return null;
  if (!auth.scopes.includes(scope) && !roleAllowsScopeV0(auth.role, scope)) {
    reply.status(403).send({ error: "FORBIDDEN" });
    return null;
  }
  return auth;
}

export function requireAoActAnyScopeV0(req: FastifyRequest, reply: FastifyReply, scopes: readonly AoActScopeV0[], fp?: string): AoActAuthContextV0 | null {
  const auth = authenticateAoActV0(req, reply, fp);
  if (!auth) return null;
  if (!scopes.some((scope) => auth.scopes.includes(scope) || roleAllowsScopeV0(auth.role, scope))) {
    reply.status(403).send({ error: "FORBIDDEN" });
    return null;
  }
  return auth;
}

export function requireAoActTenantProjectV0(req: FastifyRequest, reply: FastifyReply, auth: AoActAuthContextV0, tenantId: string, projectId: string): boolean {
  if (auth.tenant_id !== tenantId || auth.project_id !== projectId) {
    reply.status(403).send({ error: "FORBIDDEN" });
    return false;
  }
  return true;
}

export function requireAoActTenantProjectGroupV0(req: FastifyRequest, reply: FastifyReply, auth: AoActAuthContextV0, tenantId: string, projectId: string, groupId: string): boolean {
  if (!requireAoActTenantProjectV0(req, reply, auth, tenantId, projectId)) return false;
  if (auth.group_id !== groupId) {
    reply.status(403).send({ error: "FORBIDDEN" });
    return false;
  }
  return true;
}

export function isAoActFieldAllowedV0(auth: AoActAuthContextV0, fieldId: string): boolean {
  return auth.allowed_field_ids.length === 0 || auth.allowed_field_ids.includes(fieldId);
}

export function requireAoActFieldV0(reply: FastifyReply, auth: AoActAuthContextV0, fieldId: string): boolean {
  if (!isAoActFieldAllowedV0(auth, fieldId)) {
    reply.status(403).send({ error: "FORBIDDEN" });
    return false;
  }
  return true;
}
