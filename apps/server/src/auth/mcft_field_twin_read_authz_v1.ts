// Purpose: authorize the canonical MCFT Field Twin GET-only surface from the shared token SSOT without importing AO-ACT or any write-capable service.
// Boundary: bearer-token parsing and exact tenant/project/group/field read-scope validation only; no database, audit write, recommendation, approval, dispatch, activation, or mutation.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyRequest } from "fastify";

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

type TokenRecordV1 = McftFieldTwinReadAuthContextV1 & {
  token: string;
  revoked: boolean;
};

type TokenFileV1 = { tokens: TokenRecordV1[] };

function repoRootV1(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
}

function productionLikeV1(): boolean {
  return ["staging", "production"].includes(String(process.env.GEOX_RUNTIME_ENV ?? "development").trim().toLowerCase());
}

function normalizeRecordV1(value: unknown): TokenRecordV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const text = (key: string) => typeof record[key] === "string" ? String(record[key]).trim() : "";
  const token = text("token");
  const tenantId = text("tenant_id");
  const projectId = text("project_id");
  const groupId = text("group_id");
  if (!token || !tenantId || !projectId || !groupId) return null;
  return {
    token,
    revoked: record.revoked === true,
    actor_id: text("actor_id") || "unknown_actor",
    token_id: text("token_id") || "unknown_token",
    tenant_id: tenantId,
    project_id: projectId,
    group_id: groupId,
    role: text("role") || "viewer",
    scopes: Array.isArray(record.scopes) ? record.scopes.map(String).map((item) => item.trim()).filter(Boolean) : [],
    allowed_field_ids: Array.isArray(record.allowed_field_ids) ? record.allowed_field_ids.map(String).map((item) => item.trim()).filter(Boolean) : [],
  };
}

function parseTokenFileV1(raw: string): TokenFileV1 {
  let value: unknown;
  try { value = JSON.parse(raw.replace(/^\uFEFF/, "")); } catch { return { tokens: [] }; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { tokens: [] };
  const records = (value as { tokens?: unknown }).tokens;
  return { tokens: Array.isArray(records) ? records.map(normalizeRecordV1).filter((record): record is TokenRecordV1 => record !== null) : [] };
}

function tokenFileV1(): TokenFileV1 {
  const inline = String(process.env.GEOX_TOKENS_JSON ?? "").trim();
  if (inline) return parseTokenFileV1(inline);
  const externalFile = String(process.env.GEOX_TOKENS_FILE ?? process.env.GEOX_TOKEN_SSOT_PATH ?? "").trim();
  if (externalFile) {
    try { return parseTokenFileV1(fs.readFileSync(externalFile, "utf8")); } catch { return { tokens: [] }; }
  }
  const singleToken = String(process.env.GEOX_TOKEN ?? process.env.GEOX_AO_ACT_TOKEN ?? process.env.AO_ACT_TOKEN ?? "").trim();
  if (singleToken && !productionLikeV1()) {
    return { tokens: [{
      token: singleToken,
      revoked: false,
      actor_id: String(process.env.GEOX_ACTOR_ID ?? "env_actor").trim() || "env_actor",
      token_id: String(process.env.GEOX_TOKEN_ID ?? "tok_env_default").trim() || "tok_env_default",
      tenant_id: String(process.env.GEOX_TENANT_ID ?? "tenantA").trim() || "tenantA",
      project_id: String(process.env.GEOX_PROJECT_ID ?? "projectA").trim() || "projectA",
      group_id: String(process.env.GEOX_GROUP_ID ?? "groupA").trim() || "groupA",
      role: String(process.env.GEOX_ROLE ?? "admin").trim() || "admin",
      scopes: String(process.env.GEOX_SCOPES ?? "fields.read").split(",").map((item) => item.trim()).filter(Boolean),
      allowed_field_ids: [],
    }] };
  }
  if (productionLikeV1()) return { tokens: [] };
  try { return parseTokenFileV1(fs.readFileSync(path.join(repoRootV1(), "config", "auth", "example_tokens.json"), "utf8")); } catch { return { tokens: [] }; }
}

function bearerTokenV1(request: FastifyRequest): string | null {
  const raw = request.headers.authorization;
  if (typeof raw !== "string") return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  const token = String(match?.[1] ?? "").trim();
  return token || null;
}

export function authorizeMcftFieldTwinReadV1(request: FastifyRequest): McftFieldTwinReadAuthContextV1 | null {
  const token = bearerTokenV1(request);
  if (!token) return null;
  const record = tokenFileV1().tokens.find((candidate) => candidate.token === token) ?? null;
  if (!record || record.revoked) return null;
  if (!record.scopes.includes("fields.read") && record.role !== "admin") return null;
  const { token: _token, revoked: _revoked, ...context } = record;
  return Object.freeze({ ...context, scopes: Object.freeze([...context.scopes]), allowed_field_ids: Object.freeze([...context.allowed_field_ids]) });
}
