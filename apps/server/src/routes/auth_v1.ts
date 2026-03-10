import type { FastifyInstance } from "fastify";
import { requireAoActAuthV0 } from "../auth/ao_act_authz_v0";

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
}
