// GEOX/apps/server/src/auth/ao_act_authz_v0.ts

import fs from "node:fs"; // Read token SSOT file for per-request authorization (Sprint 19).
import path from "node:path"; // Resolve repo-relative config file paths deterministically.
import { fileURLToPath } from "node:url"; // Resolve ESM module path to filesystem path (stable repo root derivation).
import type { FastifyReply, FastifyRequest } from "fastify"; // Fastify request/reply types.
import { isScopeAllowedForRoleV1, type AuthRole } from "../domain/auth/roles.js";

export type AoActScopeV0 =
  | "ao_act.task.write"
  | "ao_act.receipt.write"
  | "ao_act.index.read"
  | "telemetry.read"
  | "devices.write"
  | "devices.read"
  | "devices.credentials.write"
  | "devices.credentials.revoke"
  | "devices.bind"
  | "devices.status.read"
  | "fields.read"
  | "fields.write"
  | "alerts.read"
  | "alerts.write"
  | "evidence_export.read"
  | "evidence_export.write"
  | "recommendation.write"
  | "recommendation.read"
  | "prescription.write"
  | "prescription.read"
  | "prescription.submit_approval"
  | "approval.request"
  | "approval.decide"
  | "approval.read"
  | "action.task.create"
  | "action.task.dispatch"
  | "action.receipt.submit"
  | "action.read"
  | "judge.execution.write"
  | "judge.read"
  | "acceptance.evaluate"
  | "acceptance.read"
  | "field_memory.read"
  | "field_memory.write"
  | "roi_ledger.write"
  | "roi_ledger.read"
  | "field.zone.write"
  | "field.zone.read"
  | "security.audit.read"
  | "security.admin"
  | "skill.read"
  | "skill.binding.write"
  | "skill.definition.write"
  | "skill.run.write"
  | "skill.trace.write"
  | "skill.admin"
;

export type AoActRoleV0 = AuthRole | "executor";

type TokenRecordV0 = {
  token: string; // Bearer token secret string used in Authorization header.
  token_id: string; // Stable token identifier for audit logs.
  actor_id: string; // Stable actor identifier for audit logs.
  tenant_id: string; // Tenant isolation SSOT field (Sprint 22 hard isolation).
  project_id: string; // Project isolation field (Sprint 22 hard isolation).
  group_id: string; // Group isolation field (Sprint 22 hard isolation).
  scopes: AoActScopeV0[]; // Allowed scopes for this token.
  revoked: boolean; // Revocation flag (true => deny immediately).
  role?: AoActRoleV0; // Optional role field for minimal Commercial v1 UI/authz.
  allowed_field_ids?: string[]; // Optional field scope allowlist (client/read isolation).
};

type TokenFileV0 = {
  version: "ao_act_tokens_v0"; // File format version identifier.
  tokens: TokenRecordV0[]; // Token allowlist.
};

export type AoActAuthContextV0 = {
  actor_id: string;
  token_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  role: AoActRoleV0;
  scopes: AoActScopeV0[];
  allowed_field_ids: string[];
};

function repoRootFromModule(): string {
  const modulePath = fileURLToPath(import.meta.url); // Convert module URL to filesystem path.
  const moduleDir = path.dirname(modulePath); // Directory containing this module.
  return path.resolve(moduleDir, "../../../../"); // apps/server/src/auth/ -> repo root (4 levels up).
} // End block.


function isProductionLikeRuntimeV0(): boolean {
  const env = String(process.env.GEOX_RUNTIME_ENV ?? "development").trim().toLowerCase();
  return env === "staging" || env === "production";
}

function hasStructuredTokenSourceV0(): boolean {
  return Boolean(String(process.env.GEOX_TOKENS_JSON ?? "").trim() || String(process.env.GEOX_TOKENS_FILE ?? process.env.GEOX_TOKEN_SSOT_PATH ?? "").trim());
}

export function defaultAoActTokenFilePathV0(): string {
  return path.join(repoRootFromModule(), "config", "auth", "example_tokens.json"); // Example-only fallback path; real credentials must come from env or an external file.
}

function defaultScopesFromEnv(): AoActScopeV0[] {
  return [
    "alerts.read",
    "alerts.write",
    "ao_act.index.read",
    "ao_act.receipt.write",
    "ao_act.task.write",
    "devices.bind",
    "devices.credentials.revoke",
    "devices.credentials.write",
    "devices.read",
    "devices.status.read",
    "devices.write",
    "evidence_export.read",
    "evidence_export.write",
    "fields.read",
    "fields.write",
    "telemetry.read",
  ];
}

function parseTokenFileV0(raw: string): TokenFileV0 {
  const parsed = JSON.parse(raw);
  if (!parsed || parsed.version !== "ao_act_tokens_v0" || !Array.isArray(parsed.tokens)) {
    return { version: "ao_act_tokens_v0", tokens: [] };
  }
  return parsed as TokenFileV0;
}

function tokenFileFromEnv(): TokenFileV0 | null {
  const inline = String(process.env.GEOX_TOKENS_JSON ?? "").trim();
  if (inline) {
    try { return parseTokenFileV0(inline); } catch { return { version: "ao_act_tokens_v0", tokens: [] }; }
  }

  const secretFile = String(process.env.GEOX_TOKENS_FILE ?? process.env.GEOX_TOKEN_SSOT_PATH ?? "").trim();
  if (secretFile) {
    if (!fs.existsSync(secretFile)) return { version: "ao_act_tokens_v0", tokens: [] };
    try {
      const raw = fs.readFileSync(secretFile, "utf8").replace(/^﻿/, "");
      return parseTokenFileV0(raw);
    } catch {
      return { version: "ao_act_tokens_v0", tokens: [] };
    }
  }

  const singleToken = String(process.env.GEOX_TOKEN ?? process.env.GEOX_AO_ACT_TOKEN ?? process.env.AO_ACT_TOKEN ?? "").trim();
  if (!singleToken) return null;
  if (isProductionLikeRuntimeV0()) return { version: "ao_act_tokens_v0", tokens: [] };

  const tenant_id = String(process.env.GEOX_TENANT_ID ?? "tenantA").trim() || "tenantA";
  const project_id = String(process.env.GEOX_PROJECT_ID ?? "projectA").trim() || "projectA";
  const group_id = String(process.env.GEOX_GROUP_ID ?? "groupA").trim() || "groupA";
  const actor_id = String(process.env.GEOX_ACTOR_ID ?? "env_actor").trim() || "env_actor";
  const token_id = String(process.env.GEOX_TOKEN_ID ?? "tok_env_default").trim() || "tok_env_default";
  const role = (String(process.env.GEOX_ROLE ?? "admin").trim() || "admin") as AoActRoleV0;
  const scopes = String(process.env.GEOX_SCOPES ?? "").trim()
    ? String(process.env.GEOX_SCOPES).split(",").map((x) => x.trim()).filter(Boolean) as AoActScopeV0[]
    : defaultScopesFromEnv();

  return {
    version: "ao_act_tokens_v0",
    tokens: [{ token: singleToken, token_id, actor_id, tenant_id, project_id, group_id, scopes, revoked: false, role }]
  };
}

export function readTokenFileV0(fp?: string): TokenFileV0 {
  const envBacked = tokenFileFromEnv();
  if (envBacked) return envBacked;
  if (isProductionLikeRuntimeV0() && !hasStructuredTokenSourceV0()) return { version: "ao_act_tokens_v0", tokens: [] };
  const resolved = fp ?? defaultAoActTokenFilePathV0();
  if (isProductionLikeRuntimeV0() && resolved.includes("example_tokens.json")) return { version: "ao_act_tokens_v0", tokens: [] };
  if (!fs.existsSync(resolved)) return { version: "ao_act_tokens_v0", tokens: [] };
  const raw = fs.readFileSync(resolved, "utf8").replace(/^﻿/, "");
  return parseTokenFileV0(raw);
}

function parseBearerToken(req: FastifyRequest): string | null {
  const h = req.headers["authorization"]; // Fastify normalizes header keys to lower-case.
  if (typeof h !== "string" || h.trim().length === 0) return null; // No auth header.
  const m = h.match(/^Bearer\s+(.+)$/i); // Strict Bearer scheme parsing.
  if (!m) return null; // Not a bearer token.
  const tok = String(m[1] ?? "").trim(); // Trim any surrounding whitespace.
  return tok.length ? tok : null; // Require non-empty token.
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
    role: roleFromRecord(rec),
    scopes: Array.isArray(rec.scopes) ? rec.scopes.slice() : [],
    allowed_field_ids: Array.isArray(rec.allowed_field_ids)
      ? rec.allowed_field_ids.map((x) => String(x ?? "").trim()).filter(Boolean)
      : []
  };
}

export function requireAoActAuthV0(
  req: FastifyRequest,
  reply: FastifyReply,
  opts: { tokenFilePath?: string } = {}
): AoActAuthContextV0 | null {
  const tok = parseBearerToken(req);
  if (!tok) {
    reply.status(401).send({ ok: false, error: "AUTH_MISSING" });
    return null;
  }
  if (isProductionLikeRuntimeV0() && !hasStructuredTokenSourceV0()) {
    reply.status(401).send({ ok: false, error: "AUTH_PRODUCTION_TOKEN_SOURCE_INVALID" });
    return null;
  }
  const fp = opts.tokenFilePath ?? defaultAoActTokenFilePathV0();
  const tf = readTokenFileV0(fp);
  const rec = tf.tokens.find((t) => t.token === tok) ?? null;
  if (!rec) {
    reply.status(401).send({ ok: false, error: "AUTH_INVALID" });
    return null;
  }
  if (rec.revoked) {
    reply.status(403).send({ ok: false, error: "AUTH_REVOKED" });
    return null;
  }
  if (typeof rec.tenant_id !== "string" || rec.tenant_id.trim().length === 0 ||
      typeof rec.project_id !== "string" || rec.project_id.trim().length === 0 ||
      typeof rec.group_id !== "string" || rec.group_id.trim().length === 0) {
    reply.status(401).send({ ok: false, error: "AUTH_INVALID" });
    return null;
  }
  return authContextFromRecord(rec);
}

export function requireAoActAdminV0(
  req: FastifyRequest,
  reply: FastifyReply,
  opts: { tokenFilePath?: string; deniedError?: string } = {}
): AoActAuthContextV0 | null {
  const auth = requireAoActAuthV0(req, reply, opts);
  if (!auth) return null;
  if (auth.role !== "admin") {
    reply.status(403).send({ ok: false, error: opts.deniedError ?? "AUTH_ROLE_DENIED" });
    return null;
  }
  return auth;
}

export function requireAoActScopeV0(
  req: FastifyRequest,
  reply: FastifyReply,
  scope: AoActScopeV0,
  opts: { tokenFilePath?: string } = {}
): AoActAuthContextV0 | null {
  const tok = parseBearerToken(req); // Parse bearer token.
  if (!tok) {
    reply.status(401).send({ ok: false, error: "AUTH_MISSING" }); // Missing Authorization.
    return null; // Halt request handler.
  }

  if (isProductionLikeRuntimeV0() && !hasStructuredTokenSourceV0()) {
    reply.status(401).send({ ok: false, error: "AUTH_PRODUCTION_TOKEN_SOURCE_INVALID" });
    return null;
  }
  const fp = opts.tokenFilePath ?? defaultAoActTokenFilePathV0(); // Resolve token file path.
  const tf = readTokenFileV0(fp); // Read allowlist (per-request; ensures revocation is immediate).
  const rec = tf.tokens.find((t) => t.token === tok) ?? null; // Exact match only.
  if (!rec) {
    reply.status(401).send({ ok: false, error: "AUTH_INVALID" }); // Unknown token.
    return null; // Halt.
  }
  if (rec.revoked) {
    reply.status(403).send({ ok: false, error: "AUTH_REVOKED" }); // Revoked token.
    return null; // Halt.
  }
  if (!rec.scopes.includes(scope)) {
    reply.status(403).send({ ok: false, error: "AUTH_SCOPE_DENIED" });
    return null;
  }
  if (!isScopeAllowedForRoleV1(roleFromRecord(rec) as AuthRole, scope)) {
    reply.status(403).send({ ok: false, error: "AUTH_ROLE_SCOPE_DENIED" });
    return null;
  }

  if (typeof rec.tenant_id !== "string" || rec.tenant_id.trim().length === 0) {
    reply.status(401).send({ ok: false, error: "AUTH_INVALID" });
    return null;
  }
  if (typeof rec.project_id !== "string" || rec.project_id.trim().length === 0) {
    reply.status(401).send({ ok: false, error: "AUTH_INVALID" });
    return null;
  }
  if (typeof rec.group_id !== "string" || rec.group_id.trim().length === 0) {
    reply.status(401).send({ ok: false, error: "AUTH_INVALID" });
    return null;
  }

  return authContextFromRecord(rec);
}


export function requireAoActAnyScopeV0(req: FastifyRequest, reply: FastifyReply, scopes: AoActScopeV0[], opts: { tokenFilePath?: string } = {}): AoActAuthContextV0 | null {
  const tok = parseBearerToken(req);
  if (!tok) { reply.status(401).send({ ok: false, error: "AUTH_MISSING" }); return null; }
  if (isProductionLikeRuntimeV0() && !hasStructuredTokenSourceV0()) { reply.status(401).send({ ok: false, error: "AUTH_PRODUCTION_TOKEN_SOURCE_INVALID" }); return null; }
  const tf = readTokenFileV0(opts.tokenFilePath ?? defaultAoActTokenFilePathV0());
  const rec = tf.tokens.find((t) => t.token === tok) ?? null;
  if (!rec) { reply.status(401).send({ ok: false, error: "AUTH_INVALID" }); return null; }
  if (rec.revoked) { reply.status(403).send({ ok: false, error: "AUTH_REVOKED" }); return null; }
  if (!rec.tenant_id || !rec.project_id || !rec.group_id) { reply.status(401).send({ ok: false, error: "AUTH_INVALID" }); return null; }
  const role = roleFromRecord(rec) as AuthRole;
  const anyToken = scopes.some((s) => rec.scopes.includes(s));
  if (!anyToken) { reply.status(403).send({ ok: false, error: "AUTH_SCOPE_DENIED" }); return null; }
  const anyRole = scopes.some((s) => rec.scopes.includes(s) && isScopeAllowedForRoleV1(role, s));
  if (!anyRole) { reply.status(403).send({ ok: false, error: "AUTH_ROLE_SCOPE_DENIED" }); return null; }
  return authContextFromRecord(rec);
}
