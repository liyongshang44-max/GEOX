import type { FastifyInstance } from "fastify";

import { enforceRouteRoleAuth } from "../../auth/route_role_authz.js";

export function registerCoreModule(app: FastifyInstance): void {
  app.addHook("preHandler", async (req, reply) => {
    const pathname = String((req.raw.url ?? "").split("?")[0] ?? "");
    const resource = pathname.startsWith("/api/v1/reports/")
      ? "reports"
      : pathname.startsWith("/api/v1/operations/") || pathname === "/api/v1/operations"
        ? "operations"
        : pathname.startsWith("/api/v1/dashboard/")
          ? "dashboard"
          : null;

    if (!resource) return;

    const auth = enforceRouteRoleAuth(req, reply, resource, { asNotFound: resource !== "dashboard" });
    if (!auth) return reply;
    (req as any).auth = auth;
  });
}
