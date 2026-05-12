import type { FastifyInstance } from "fastify";
import { enforceRouteRoleAuth } from "../auth/route_role_authz.js";
import { resolveCustomerScope } from "../services/customer/customer_scope_v1.js";

function pathOnly(url: string | undefined): string {
  return String(url ?? "").split("?")[0];
}

function isCustomerFieldsPath(url: string | undefined): boolean {
  return pathOnly(url) === "/api/v1/customer/fields";
}

function parsePayload(payload: unknown): any | null {
  if (Buffer.isBuffer(payload)) {
    try { return JSON.parse(payload.toString("utf8")); } catch { return null; }
  }
  if (typeof payload === "string") {
    try { return JSON.parse(payload); } catch { return null; }
  }
  if (payload && typeof payload === "object") return payload;
  return null;
}

export function registerCustomerScopeResponseHookV1(app: FastifyInstance): void {
  app.addHook("onSend", async (req, reply, payload) => {
    if (reply.statusCode >= 400 || !isCustomerFieldsPath(req.url)) return payload;
    const parsed = parsePayload(payload);
    if (!parsed || typeof parsed !== "object" || parsed.scope) return payload;
    const auth = enforceRouteRoleAuth(req, reply, "summary");
    if (!auth) return payload;
    const scope = resolveCustomerScope(auth);
    return JSON.stringify({ ...parsed, scope });
  });
}
