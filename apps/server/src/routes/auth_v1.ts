import fs from "node:fs";
import type { FastifyInstance } from "fastify";
import { defaultAoActTokenFilePathV0, requireAoActAuthV0 } from "../auth/ao_act_authz_v0";

type TokenRecord = {
  token: string;
  token_id: string;
  actor_id: string;
  tenant_id: string;
  project_id: string;
  group_id: string;
  role?: string;
  scopes?: string[];
  revoked?: boolean;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function readTokenRecords(): TokenRecord[] {
  const fp = defaultAoActTokenFilePathV0();
  if (!fs.existsSync(fp)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(fp, "utf8"));
    if (!Array.isArray(parsed?.tokens)) return [];
    return parsed.tokens as TokenRecord[];
  } catch {
    return [];
  }
}

function hostBase(req: any): string {
  const host = String(req?.headers?.host ?? "127.0.0.1:3001");
  const proto = String(req?.headers?.["x-forwarded-proto"] ?? "http");
  return `${proto}://${host}`;
}

export function registerAuthV1Routes(app: FastifyInstance): void {
  app.get("/api/v1/auth/me", async (req, reply) => {
    const auth = requireAoActAuthV0(req, reply);
    if (!auth) return;
    return reply.send({
      ok: true,
      actor_id: auth.actor_id,
      token_id: auth.token_id,
      tenant_id: auth.tenant_id,
      project_id: auth.project_id,
      group_id: auth.group_id,
      role: auth.role,
      scopes: auth.scopes
    });
  });

  app.post("/api/v1/auth/login", async (req, reply) => {
    const body: any = (req as any).body ?? {};

    const idpLoginUrl = process.env.AUTH_IDP_LOGIN_URL;
    if (isNonEmptyString(idpLoginUrl)) {
      const resp = await fetch(String(idpLoginUrl), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const text = await resp.text();
      if (!resp.ok) return reply.status(401).send({ ok: false, error: "AUTH_INVALID", detail: text.slice(0, 300) });
      let parsed: any = {};
      try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
      return reply.send({ ok: true, provider: "external_idp", ...parsed });
    }

    const token = isNonEmptyString(body?.token) ? String(body.token).trim() : "";
    if (!token) return reply.status(400).send({ ok: false, error: "MISSING_OR_INVALID:token" });

    const rec = readTokenRecords().find((x) => String(x.token) === token && !x.revoked);
    if (!rec) return reply.status(401).send({ ok: false, error: "AUTH_INVALID" });

    return reply.send({
      ok: true,
      token,
      provider: "local_allowlist",
      actor_id: rec.actor_id,
      token_id: rec.token_id,
      tenant_id: rec.tenant_id,
      project_id: rec.project_id,
      group_id: rec.group_id,
      role: rec.role ?? "admin",
      scopes: Array.isArray(rec.scopes) ? rec.scopes : []
    });
  });

  app.post("/api/v1/auth/logout", async (req, reply) => {
    const idpLogoutUrl = process.env.AUTH_IDP_LOGOUT_URL;
    if (isNonEmptyString(idpLogoutUrl)) {
      const authz = String((req.headers as any)?.authorization ?? "");
      const resp = await fetch(String(idpLogoutUrl), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: authz },
        body: JSON.stringify({ ok: true })
      });
      if (!resp.ok) return reply.status(200).send({ ok: true, provider: "external_idp", note: "logout_forward_failed_but_local_session_stateless" });
      return reply.send({ ok: true, provider: "external_idp" });
    }

    return reply.send({ ok: true, provider: "local_allowlist", stateless: true });
  });

  app.get("/api/v1/auth/providers", async (req, reply) => {
    return reply.send({
      ok: true,
      mode: isNonEmptyString(process.env.AUTH_IDP_LOGIN_URL) ? "external_idp" : "local_allowlist",
      idp_login_url: process.env.AUTH_IDP_LOGIN_URL ?? null,
      idp_logout_url: process.env.AUTH_IDP_LOGOUT_URL ?? null,
      login_path: `${hostBase(req)}/api/v1/auth/login`,
      logout_path: `${hostBase(req)}/api/v1/auth/logout`
    });
  });
}
