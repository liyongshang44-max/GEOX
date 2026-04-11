// GEOX/apps/server/src/auth/ao_act_authz_v0.ts

import fs from "node:fs"; // Read token SSOT file for per-request authorization (Sprint 19).
import path from "node:path"; // Resolve repo-relative config file paths deterministically.
import { fileURLToPath } from "node:url"; // Resolve ESM module path to filesystem path (stable repo root derivation).
import type { FastifyReply, FastifyRequest } from "fastify"; // Fastify request/reply types.
import type { AuthRole } from "../domain/auth/roles";

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
  | "evidence_export.write";

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

export function defaultAoActTokenFilePathV0(): string {
  return path.join(repoRootFromModule(), "config", "auth", "ao_act_tokens_v0.json"); // SSOT location for AO-ACT token allowlist.
}

function readTokenFileV0(fp: string): TokenFileV0 {
  if (!fs.existsSync(fp)) return { version: "ao_act_tokens_v0", tokens: [] }; // Missing file => deny-all.
  const raw = fs.readFileSync(fp, "utf8").replace(/^\uFEFF/, ""); // Strip optional UTF-8 BOM before JSON parse.
  const parsed = JSON.parse(raw); // Parse JSON token allowlist.
  if (!parsed || parsed.version !== "ao_act_tokens_v0" || !Array.isArray(parsed.tokens)) {
    return { version: "ao_act_tokens_v0", tokens: [] }; // Any invalid structure => deny-all.
  }
  return parsed as TokenFileV0; // Return parsed token file.
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
  if (rec.role === "operator" || rec.role === "viewer" || rec.role === "client" || rec.role === "executor") return rec.role;
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
    reply.status(403).send({ ok: false, error: "AUTH_SCOPE_DENIED" }); // Insufficient scope.
    return null; // Halt.
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
