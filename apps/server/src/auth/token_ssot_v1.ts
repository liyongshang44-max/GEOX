// Purpose: provide one shared bearer-token SSOT loader for all GEOX HTTP authorization surfaces.
// Boundary: credential parsing and runtime-profile fail-closed policy only; no route, database, audit write, recommendation, approval, dispatch, or mutation authority.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyRequest } from "fastify";

export type GeoxTokenRecordV1 = {
  token: string;
  token_id: string;
  actor_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  scopes: string[];
  revoked: boolean;
  role?: string;
  allowed_field_ids?: string[];
};

export type GeoxTokenFileV1 = { version: "ao_act_tokens_v0"; tokens: GeoxTokenRecordV1[] };

const STRICT_RUNTIME_PROFILES_V1 = new Set(["pilot", "commercial", "staging", "production"]);

function repoRootV1(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
}

export function geoxRuntimeProfileV1(): string {
  return String(process.env.GEOX_RUNTIME_ENV ?? "development").trim().toLowerCase();
}

export function isStrictRuntimeProfileV1(): boolean {
  return STRICT_RUNTIME_PROFILES_V1.has(geoxRuntimeProfileV1());
}

export function hasStructuredTokenSourceV1(): boolean {
  return Boolean(String(process.env.GEOX_TOKENS_JSON ?? "").trim() || String(process.env.GEOX_TOKENS_FILE ?? process.env.GEOX_TOKEN_SSOT_PATH ?? "").trim());
}

export function defaultGeoxTokenFilePathV1(): string {
  return path.join(repoRootV1(), "config", "auth", "example_tokens.json");
}

function emptyV1(): GeoxTokenFileV1 { return { version: "ao_act_tokens_v0", tokens: [] }; }

function parseTokenFileV1(raw: string): GeoxTokenFileV1 {
  let parsed: unknown;
  try { parsed = JSON.parse(raw.replace(/^\uFEFF/, "")); } catch { return emptyV1(); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return emptyV1();
  const value = parsed as Record<string, unknown>;
  if (value.version !== "ao_act_tokens_v0" || !Array.isArray(value.tokens)) return emptyV1();
  const tokens: GeoxTokenRecordV1[] = [];
  for (const item of value.tokens) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const text = (key: string) => typeof record[key] === "string" ? String(record[key]).trim() : "";
    const token = text("token");
    const tokenId = text("token_id");
    const actorId = text("actor_id");
    const tenantId = text("tenant_id");
    const projectId = text("project_id");
    const groupId = text("group_id");
    if (!token || !tokenId || !actorId || !tenantId || !projectId || !groupId) continue;
    tokens.push({
      token,
      token_id: tokenId,
      actor_id: actorId,
      tenant_id: tenantId,
      project_id: projectId,
      group_id: groupId,
      scopes: Array.isArray(record.scopes) ? record.scopes.map(String).map((v) => v.trim()).filter(Boolean) : [],
      revoked: record.revoked === true,
      role: text("role") || undefined,
      allowed_field_ids: Array.isArray(record.allowed_field_ids) ? record.allowed_field_ids.map(String).map((v) => v.trim()).filter(Boolean) : [],
    });
  }
  return { version: "ao_act_tokens_v0", tokens };
}

function singleDevelopmentTokenV1(): GeoxTokenFileV1 | null {
  const token = String(process.env.GEOX_TOKEN ?? process.env.GEOX_AO_ACT_TOKEN ?? process.env.AO_ACT_TOKEN ?? "").trim();
  if (!token) return null;
  if (isStrictRuntimeProfileV1()) return emptyV1();
  return {
    version: "ao_act_tokens_v0",
    tokens: [{
      token,
      token_id: String(process.env.GEOX_TOKEN_ID ?? "tok_env_default").trim() || "tok_env_default",
      actor_id: String(process.env.GEOX_ACTOR_ID ?? "env_actor").trim() || "env_actor",
      tenant_id: String(process.env.GEOX_TENANT_ID ?? "tenantA").trim() || "tenantA",
      project_id: String(process.env.GEOX_PROJECT_ID ?? "projectA").trim() || "projectA",
      group_id: String(process.env.GEOX_GROUP_ID ?? "groupA").trim() || "groupA",
      scopes: String(process.env.GEOX_SCOPES ?? "").trim()
        ? String(process.env.GEOX_SCOPES).split(",").map((v) => v.trim()).filter(Boolean)
        : ["fields.read"],
      revoked: false,
      role: String(process.env.GEOX_ROLE ?? "admin").trim() || "admin",
      allowed_field_ids: [],
    }],
  };
}

export function readGeoxTokenFileV1(explicitPath?: string): GeoxTokenFileV1 {
  const inline = String(process.env.GEOX_TOKENS_JSON ?? "").trim();
  if (inline) return parseTokenFileV1(inline);
  const secretFile = String(process.env.GEOX_TOKENS_FILE ?? process.env.GEOX_TOKEN_SSOT_PATH ?? "").trim();
  if (secretFile) {
    try { return parseTokenFileV1(fs.readFileSync(secretFile, "utf8")); } catch { return emptyV1(); }
  }
  if (isStrictRuntimeProfileV1()) return emptyV1();
  const single = singleDevelopmentTokenV1();
  if (single) return single;
  const resolved = explicitPath ?? defaultGeoxTokenFilePathV1();
  try { return parseTokenFileV1(fs.readFileSync(resolved, "utf8")); } catch { return emptyV1(); }
}

export function parseBearerTokenV1(request: FastifyRequest): string | null {
  const value = request.headers.authorization;
  if (typeof value !== "string") return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  const token = String(match?.[1] ?? "").trim();
  return token || null;
}
