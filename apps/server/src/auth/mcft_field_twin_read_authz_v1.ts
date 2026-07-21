// Purpose: authorize canonical MCFT Field Twin GET-only routes from the shared GEOX bearer-token SSOT.
// Boundary: exact read-scope validation only; no database, audit write, recommendation, approval, AO-ACT service, dispatch, activation, or mutation.

import type { FastifyRequest } from "fastify";
import { isScopeAllowedForRoleV1, type AuthRole } from "../domain/auth/roles.js";
import { hasStructuredTokenSourceV1, isStrictRuntimeProfileV1, parseBearerTokenV1, readGeoxTokenFileV1 } from "./token_ssot_v1.js";

export type McftFieldTwinReadAuthContextV1 = {
  actor_id: string;
  token_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  role: string;
  scopes: readonly string[];
  allowed_field_ids: readonly string[];
};

export function authorizeMcftFieldTwinReadV1(request: FastifyRequest): McftFieldTwinReadAuthContextV1 | null {
  const token = parseBearerTokenV1(request);
  if (!token) return null;
  if (isStrictRuntimeProfileV1() && !hasStructuredTokenSourceV1()) return null;
  const record = readGeoxTokenFileV1().tokens.find((candidate) => candidate.token === token) ?? null;
  if (!record || record.revoked) return null;
  const role = String(record.role || "viewer") as AuthRole;
  const scopes = [...record.scopes];
  if (!scopes.includes("fields.read") && !isScopeAllowedForRoleV1(role, "fields.read")) return null;
  return Object.freeze({
    actor_id: record.actor_id,
    token_id: record.token_id,
    tenant_id: record.tenant_id,
    project_id: record.project_id,
    group_id: record.group_id,
    role,
    scopes: Object.freeze(scopes),
    allowed_field_ids: Object.freeze([...(record.allowed_field_ids ?? [])]),
  });
}
