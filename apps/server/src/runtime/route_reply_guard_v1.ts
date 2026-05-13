import type { FastifyInstance } from "fastify";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";

export function registerRouteReplyGuardV1(app: FastifyInstance): void {
  app.addHook("onRequest", async (req, reply) => {
    const pathname = String(req.url ?? "").split("?")[0];
    if (req.method !== "GET" || pathname !== "/api/v1/fields") return;

    const auth = requireAoActScopeV0(req, reply, "fields.read");
    if (!auth) return reply;
  });
}
