import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import {
  configureSkillBindingsPool,
  listSkillBindings,
  resolveRuleSkillBindings,
  switchSkillBinding,
} from "../domain/agronomy/skills/registry";

export function registerSkillRulesV1Routes(app: FastifyInstance, pool: Pool): void {
  configureSkillBindingsPool(pool);

  app.get("/api/v1/skills/rules", async (req, reply) => {
    const query = (req.query ?? {}) as {
      crop_code?: string;
      tenant_id?: string;
      enabled_only?: string;
      dry_run?: string;
    };

    const crop_code = typeof query.crop_code === "string" ? query.crop_code.trim().toLowerCase() : undefined;
    const tenant_id = typeof query.tenant_id === "string" ? query.tenant_id.trim() : undefined;
    const enabledOnly = String(query.enabled_only ?? "true").trim().toLowerCase() !== "false";
    const dryRun = String(query.dry_run ?? "false").trim().toLowerCase() === "true";

    if (dryRun) {
      if (!tenant_id || !crop_code) {
        return reply.code(400).send({
          ok: false,
          error: "INVALID_QUERY",
          message: "dry_run=true requires tenant_id and crop_code",
        });
      }

      try {
        const resolved = await resolveRuleSkillBindings({ tenant_id, crop_code });
        return reply.send({
          ok: true,
          items: resolved.map((item) => ({
            skill_id: item.skill_id,
            version: item.version,
            enabled: item.enabled,
            priority: item.priority,
            source: item.source,
            scope: {
              tenant_id: item.tenant_id,
              crop_code: item.crop_code,
            },
          })),
        });
      } catch (error) {
        return reply.code(404).send({
          ok: false,
          error: "NO_SKILL_BINDING_FOUND",
          message: error instanceof Error ? error.message : "resolve failed",
        });
      }
    }

    const items = await listSkillBindings({
      crop_code,
      tenant_id,
      enabled_only: enabledOnly,
    });

    return reply.send(items.map((item) => ({
      id: item.id,
      skill_id: item.skill_id,
      version: item.version,
      enabled: item.enabled,
      priority: item.priority,
      scope: {
        tenant_id: item.tenant_id,
        crop_code: item.crop_code,
      },
      updated_at: item.updated_at,
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

    try {
      const switched = await switchSkillBinding({
        skill_id,
        version,
        enabled: body.enabled,
        priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : undefined,
        scope: body.scope
          ? {
            tenant_id: typeof body.scope.tenant_id === "string" ? body.scope.tenant_id.trim() : undefined,
            crop_code: typeof body.scope.crop_code === "string" ? body.scope.crop_code.trim().toLowerCase() : undefined,
          }
          : undefined,
      });

      return reply.send({ ok: true, item: switched });
    } catch (error) {
      return reply.code(500).send({
        ok: false,
        error: "SKILL_SWITCH_FAILED",
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  });
}
