// GEOX/apps/server/src/auth/ao_act_authz_v0.ts

import fs from "node:fs"; // Read token SSOT file for per-request authorization (Sprint 19).
import path from "node:path"; // Resolve repo-relative config file paths deterministically.
import { fileURLToPath } from "node:url"; // Resolve ESM module path to filesystem path (stable repo root derivation).
import type { FastifyReply, FastifyRequest } from "fastify"; // Fastify request/reply types.

export type AoActScopeV0 =
  | "ao_act.task.write" // Permission to create ao_act_task_v0 facts.
  | "ao_act.receipt.write" // Permission to create ao_act_receipt_v0 facts.
  | "ao_act.index.read"; // Permission to read AO-ACT index.

type TokenRecordV0 = {
  token: string; // Bearer token secret string used in Authorization header.
  token_id: string; // Stable token identifier for audit logs.
  actor_id: string; // Stable actor identifier for audit logs.
  tenant_id: string; // Tenant isolation SSOT field (Sprint 22 hard isolation).
  project_id: string; // Project isolation field (Sprint 22 hard isolation).
  group_id: string; // Group isolation field (Sprint 22 hard isolation).
  scopes: AoActScopeV0[]; // Allowed scopes for this token.
  revoked: boolean; // Revocation flag (true => deny immediately).
};

type TokenFileV0 = {
  version: "ao_act_tokens_v0"; // File format version identifier.
  tokens: TokenRecordV0[]; // Token allowlist.
};

export type AoActAuthContextV0 = {
  actor_id: string; // Actor id derived from token.
  token_id: string; // Token id derived from token.
  tenant_id: string; // Tenant isolation SSOT field used to hard-isolate requests.
  project_id: string; // Project isolation field used to hard-isolate requests.
  group_id: string; // Group isolation field used to hard-isolate requests.
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
  const raw = fs.readFileSync(fp, "utf8"); // Read without BOM assumptions; JSON parser handles whitespace.
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

  // Sprint 22: enforce that token records carry hard isolation fields; missing fields are treated as invalid tokens.
  if (typeof rec.tenant_id !== "string" || rec.tenant_id.trim().length === 0) {
    reply.status(401).send({ ok: false, error: "AUTH_INVALID" }); // Token record missing tenant_id.
    return null; // Halt.
  }
  if (typeof rec.project_id !== "string" || rec.project_id.trim().length === 0) {
    reply.status(401).send({ ok: false, error: "AUTH_INVALID" }); // Token record missing project_id.
    return null; // Halt.
  }
  if (typeof rec.group_id !== "string" || rec.group_id.trim().length === 0) {
    reply.status(401).send({ ok: false, error: "AUTH_INVALID" }); // Token record missing group_id.
    return null; // Halt.
  }

  return {
    actor_id: rec.actor_id, // Return actor id for audit.
    token_id: rec.token_id, // Return token id for audit.
    tenant_id: rec.tenant_id, // Return tenant id for hard isolation gating.
    project_id: rec.project_id, // Return project id for hard isolation gating.
    group_id: rec.group_id // Return group id for hard isolation gating.
  }; // Return auth context for audit + isolation.
}
