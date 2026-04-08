import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import {
  configureSkillBindingsPool,
  listSkillBindings,
  resolveRuleSkillBindings,
  switchSkillBinding,
} from "../domain/agronomy/skills/registry";
import { projectSkillRegistryReadV1, querySkillRegistryReadV1 } from "../projections/skill_registry_read_v1";

export function registerSkillRulesV1Routes(app: FastifyInstance, pool: Pool): void {
  configureSkillBindingsPool(pool);

  app.get("/api/v1/skills/rules", async (req, reply) => {
    const query = (req.query ?? {}) as {
      crop_code?: string;
      tenant_id?: string;
      project_id?: string;
      group_id?: string;
      category?: string;
      status?: string;
      device_type?: string;
      trigger_stage?: string;
      bind_target?: string;
      enabled_only?: string;
      dry_run?: string;
    };

    const crop_code = typeof query.crop_code === "string" ? query.crop_code.trim().toLowerCase() : undefined;
    const tenant_id = typeof query.tenant_id === "string" ? query.tenant_id.trim() : undefined;
    const project_id = typeof query.project_id === "string" ? query.project_id.trim() : undefined;
    const group_id = typeof query.group_id === "string" ? query.group_id.trim() : undefined;
    const enabledOnly = String(query.enabled_only ?? "true").trim().toLowerCase() !== "false";
    const dryRun = String(query.dry_run ?? "false").trim().toLowerCase() === "true";

    if (dryRun) {
      if (!tenant_id || !project_id || !group_id || !crop_code) {
        return reply.code(400).send({
          ok: false,
          error: "INVALID_QUERY",
          message: "dry_run=true requires tenant_id/project_id/group_id/crop_code",
        });
      }

      try {
        const resolved = await resolveRuleSkillBindings({ tenant_id, project_id, group_id, crop_code });
        return reply.send({
          ok: true,
          items: resolved.map((item) => ({
            skill_id: item.skill_id,
            version: item.version,
            enabled: item.enabled,
            priority: item.priority,
            category: item.category,
            scope_type: item.scope_type,
            rollout_mode: item.rollout_mode,
            trigger_stage: item.trigger_stage,
            bind_target: item.bind_target,
            device_type: item.device_type,
            source: item.source,
            scope: {
              tenant_id: item.tenant_id,
              project_id: item.project_id,
              group_id: item.group_id,
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

    if (!tenant_id || !project_id || !group_id) {
      return reply.code(400).send({
        ok: false,
        error: "INVALID_QUERY",
        message: "tenant_id/project_id/group_id are required",
      });
    }

    await projectSkillRegistryReadV1(pool, { tenant_id, project_id, group_id });
    const readRows = await querySkillRegistryReadV1(pool, {
      tenant_id,
      project_id,
      group_id,
      category: query.category,
      status: query.status,
      crop_code,
      device_type: query.device_type,
      trigger_stage: query.trigger_stage,
      bind_target: query.bind_target,
      fact_type: "skill_binding_v1",
    });

    const readItems = readRows
      .map((row) => ({
        id: String(row.fact_id),
        skill_id: String(row.skill_id),
        version: String(row.version),
        enabled: ["ACTIVE", "ENABLED"].includes(String(row.status ?? "").toUpperCase()),
        priority: Number.isFinite(Number(row.payload_json?.priority)) ? Number(row.payload_json?.priority) : 0,
        category: row.category,
        status: row.status,
        scope_type: row.scope_type,
        rollout_mode: row.rollout_mode,
        trigger_stage: row.trigger_stage,
        bind_target: row.bind_target,
        crop_code: row.crop_code,
        device_type: row.device_type,
        scope: {
          tenant_id: row.tenant_id,
          project_id: row.project_id,
          group_id: row.group_id,
        },
        updated_at: row.occurred_at,
      }))
      .filter((item) => !enabledOnly || item.enabled);

    if (readItems.length > 0) {
      return reply.send(readItems);
    }

    const items = await listSkillBindings({
      crop_code,
      tenant_id,
      project_id,
      group_id,
      enabled_only: enabledOnly,
    });

    return reply.send(items.map((item) => ({
      id: item.id,
      skill_id: item.skill_id,
      version: item.version,
      enabled: item.enabled,
      priority: item.priority,
      category: item.category,
      scope_type: item.scope_type,
      rollout_mode: item.rollout_mode,
      trigger_stage: item.trigger_stage,
      bind_target: item.bind_target,
      crop_code: item.crop_code,
      device_type: item.device_type,
      scope: {
        tenant_id: item.tenant_id,
        project_id: item.project_id,
        group_id: item.group_id,
      },
      updated_at: item.updated_at,
    })));
  });

  app.post("/api/v1/skills/rules/switch", async (req, reply) => {
    const body = (req.body ?? {}) as {
      skill_id?: unknown;
      version?: unknown;
      category?: unknown;
      enabled?: unknown;
      priority?: unknown;
      scope?: {
        tenant_id?: unknown;
        project_id?: unknown;
        group_id?: unknown;
        crop_code?: unknown;
        scope_type?: unknown;
        bind_target?: unknown;
        trigger_stage?: unknown;
        rollout_mode?: unknown;
        device_type?: unknown;
      };
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
        category: typeof body.category === "string" ? body.category.trim().toUpperCase() : undefined,
        enabled: body.enabled,
        priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : undefined,
        scope: body.scope
          ? {
            tenant_id: typeof body.scope.tenant_id === "string" ? body.scope.tenant_id.trim() : undefined,
            project_id: typeof body.scope.project_id === "string" ? body.scope.project_id.trim() : undefined,
            group_id: typeof body.scope.group_id === "string" ? body.scope.group_id.trim() : undefined,
            crop_code: typeof body.scope.crop_code === "string" ? body.scope.crop_code.trim().toLowerCase() : undefined,
            scope_type: typeof body.scope.scope_type === "string" ? body.scope.scope_type.trim().toUpperCase() : undefined,
            bind_target: typeof body.scope.bind_target === "string" ? body.scope.bind_target.trim() : undefined,
            trigger_stage: typeof body.scope.trigger_stage === "string" ? body.scope.trigger_stage.trim() : undefined,
            rollout_mode: typeof body.scope.rollout_mode === "string" ? body.scope.rollout_mode.trim().toUpperCase() : undefined,
            device_type: typeof body.scope.device_type === "string" ? body.scope.device_type.trim().toUpperCase() : undefined,
          }
          : undefined,
      });

      return reply.send({ ok: true, item: switched });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      if (message.includes("INVALID_TRIGGER_STAGE")) {
        return reply.code(400).send({
          ok: false,
          error: "INVALID_TRIGGER_STAGE",
          message,
        });
      }
      return reply.code(500).send({
        ok: false,
        error: "SKILL_SWITCH_FAILED",
        message,
      });
    }
  });
}
