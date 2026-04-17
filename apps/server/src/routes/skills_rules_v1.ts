import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { appendSkillBindingFact } from "../domain/skill_registry/facts.js";
import { projectSkillRegistryReadV1, querySkillRegistryReadV1 } from "../projections/skill_registry_read_v1.js";
import { ensureDeviceSkillBindings } from "../services/device_skill_bindings.js";

export function registerSkillRulesV1Routes(app: FastifyInstance, pool: Pool): void {
  const deprecatedSwitchHint = {
    deprecated: true as const,
    successor: "Use /api/v1/skills/bindings/override instead.",
    successor_endpoint: "/api/v1/skills/bindings/override",
  };

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
      fact_type?: string;
      enabled_only?: string;
    };

    const crop_code = typeof query.crop_code === "string" ? query.crop_code.trim().toLowerCase() : undefined;
    const tenant_id = typeof query.tenant_id === "string" ? query.tenant_id.trim() : undefined;
    const project_id = typeof query.project_id === "string" ? query.project_id.trim() : undefined;
    const group_id = typeof query.group_id === "string" ? query.group_id.trim() : undefined;
    const enabledOnly = String(query.enabled_only ?? "true").trim().toLowerCase() !== "false";

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
      fact_type: query.fact_type === "skill_definition_v1" || query.fact_type === "skill_run_v1"
        ? query.fact_type
        : "skill_binding_v1",
    });

    const items = readRows
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

    return reply.send(items);
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
        ...deprecatedSwitchHint,
      });
    }

    try {
      const tenant_id = typeof body.scope?.tenant_id === "string" ? body.scope.tenant_id.trim() : "";
      const project_id = typeof body.scope?.project_id === "string" ? body.scope.project_id.trim() : "";
      const group_id = typeof body.scope?.group_id === "string" ? body.scope.group_id.trim() : "";
      if (!tenant_id || !project_id || !group_id) {
        return reply.code(400).send({
          ok: false,
          error: "INVALID_SCOPE",
          message: "scope.tenant_id/project_id/group_id are required",
          ...deprecatedSwitchHint,
        });
      }
      const appended = await appendSkillBindingFact(pool, {
        tenant_id,
        project_id,
        group_id,
        skill_id,
        version,
        category: typeof body.category === "string" ? body.category.trim().toUpperCase() as any : "AGRONOMY",
        status: body.enabled ? "ACTIVE" : "DISABLED",
        scope_type: typeof body.scope?.scope_type === "string" ? body.scope.scope_type.trim().toUpperCase() as any : "TENANT",
        rollout_mode: typeof body.scope?.rollout_mode === "string" ? body.scope.rollout_mode.trim().toUpperCase() as any : "DIRECT",
        trigger_stage: typeof body.scope?.trigger_stage === "string" ? body.scope.trigger_stage.trim() as any : "before_recommendation",
        bind_target: typeof body.scope?.bind_target === "string" ? body.scope.bind_target.trim() : tenant_id,
        crop_code: typeof body.scope?.crop_code === "string" ? body.scope.crop_code.trim().toLowerCase() : null,
        device_type: typeof body.scope?.device_type === "string" ? body.scope.device_type.trim().toUpperCase() as any : null,
        priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0,
      });
      await projectSkillRegistryReadV1(pool, { tenant_id, project_id, group_id });
      const rows = await querySkillRegistryReadV1(pool, {
        tenant_id,
        project_id,
        group_id,
        crop_code: appended.payload.crop_code ?? undefined,
        fact_type: "skill_binding_v1",
      });
      const latest = rows.find((row) => String(row.fact_id) === appended.fact_id) ?? rows[0] ?? null;

      const deviceRows = await pool.query<{ device_id: string }>(
        `SELECT device_id FROM device_index_v1 WHERE tenant_id = $1 ORDER BY created_ts_ms DESC LIMIT 500`,
        [tenant_id],
      );
      for (const dev of deviceRows.rows ?? []) {
        await ensureDeviceSkillBindings({
          pool,
          tenant_id,
          project_id,
          group_id,
          device_id: String(dev.device_id ?? ""),
          trigger: "DEVICE_TEMPLATE_SWITCHED",
          allow_write: true,
        });
      }

      return reply.send({
        ok: true,
        ...deprecatedSwitchHint,
        item: latest ? {
          id: String(latest.fact_id),
          skill_id: String(latest.skill_id),
          version: String(latest.version),
          enabled: ["ACTIVE", "ENABLED"].includes(String(latest.status ?? "").toUpperCase()),
          priority: Number.isFinite(Number(latest.payload_json?.priority)) ? Number(latest.payload_json?.priority) : 0,
          category: latest.category,
          scope_type: latest.scope_type,
          rollout_mode: latest.rollout_mode,
          trigger_stage: latest.trigger_stage,
          bind_target: latest.bind_target,
          crop_code: latest.crop_code,
          device_type: latest.device_type,
          scope: { tenant_id: latest.tenant_id, project_id: latest.project_id, group_id: latest.group_id },
          updated_at: latest.occurred_at,
        } : null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      if (message.includes("INVALID_TRIGGER_STAGE")) {
        return reply.code(400).send({
          ok: false,
          error: "INVALID_TRIGGER_STAGE",
          message,
          ...deprecatedSwitchHint,
        });
      }
      return reply.code(500).send({
        ok: false,
        error: "SKILL_SWITCH_FAILED",
        message,
        ...deprecatedSwitchHint,
      });
    }
  });
}
