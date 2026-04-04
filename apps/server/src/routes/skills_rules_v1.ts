import type { FastifyInstance } from "fastify";
import { listSkillSwitches, switchSkill } from "../domain/agronomy/skills/runtime_config";

export function registerSkillRulesV1Routes(app: FastifyInstance): void {
  app.get("/api/v1/skills/rules", async (req, reply) => {
    const query = (req.query ?? {}) as {
      crop_code?: string;
      tenant_id?: string;
      enabled_only?: string;
    };

    const enabledOnly = String(query.enabled_only ?? "true").trim().toLowerCase() !== "false";

    const items = listSkillSwitches({
      crop_code: typeof query.crop_code === "string" ? query.crop_code.trim() : undefined,
      tenant_id: typeof query.tenant_id === "string" ? query.tenant_id.trim() : undefined,
      enabled_only: enabledOnly,
    });

    return reply.send(items.map((item) => ({
      skill_id: item.skill_id,
      version: item.version,
      enabled: item.enabled,
      priority: item.priority,
      scope: item.scope,
    })));
  });

  app.post("/api/v1/skills/rules/switch", async (req, reply) => {
    const body = (req.body ?? {}) as {
      skill_id?: unknown;
      version?: unknown;
      enabled?: unknown;
      priority?: unknown;
      scope?: { tenant_id?: unknown; crop_code?: unknown };
    };

    const skill_id = String(body.skill_id ?? "").trim();
    const version = String(body.version ?? "").trim();
    if (!skill_id || !version || typeof body.enabled !== "boolean") {
      return reply.code(400).send({
        ok: false,
        error: "INVALID_BODY",
        message: "skill_id/version/enabled are required",
      });
    }

    const switched = switchSkill({
      skill_id,
      version,
      enabled: body.enabled,
      priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : undefined,
      scope: body.scope
        ? {
          tenant_id: typeof body.scope.tenant_id === "string" ? body.scope.tenant_id.trim() : undefined,
          crop_code: typeof body.scope.crop_code === "string" ? body.scope.crop_code.trim() : undefined,
        }
        : undefined,
    });

    return reply.send({ ok: true, item: switched });
  });
}
