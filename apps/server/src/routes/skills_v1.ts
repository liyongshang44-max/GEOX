import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import {
  appendSkillBindingFact,
  appendSkillDefinitionFact,
  type SkillDefinitionFactPayload,
} from "../domain/skill_registry/facts.js";
import { projectSkillRegistryReadV1, querySkillBindingProjectionV1, querySkillRegistryReadV1 } from "../projections/skill_registry_read_v1.js";

type TenantTriple = { tenant_id: string; project_id: string; group_id: string };
const SKILLS_API_CONTRACT_VERSION = "2026-04-06";
const SKILLS_LEGACY_MUTATION_SUCCESSOR_ENDPOINT = "/api/v1/skills/bindings/override";


type SkillRow = {
  tenant_id: string;
  project_id: string;
  group_id: string;
  fact_type: string;
  fact_id: string;
  skill_id: string;
  version: string;
  category: string | null;
  legacy_category: string | null;
  status: string | null;
  scope_type: string | null;
  rollout_mode: string | null;
  result_status: string | null;
  crop_code: string | null;
  device_type: string | null;
  trigger_stage: string | null;
  bind_target: string | null;
  operation_id: string | null;
  field_id: string | null;
  device_id: string | null;
  lifecycle_version: number | null;
  payload_json: any;
  occurred_at: string;
  updated_at_ts_ms: number;
};

function tenantFromReq(req: any, auth: TenantTriple): TenantTriple {
  const q = req.query ?? {};
  return {
    tenant_id: String(q.tenant_id ?? auth.tenant_id).trim(),
    project_id: String(q.project_id ?? auth.project_id).trim(),
    group_id: String(q.group_id ?? auth.group_id).trim(),
  };
}

function requireTenantMatchOr404(auth: TenantTriple, tenant: TenantTriple, reply: any): boolean {
  if (auth.tenant_id !== tenant.tenant_id || auth.project_id !== tenant.project_id || auth.group_id !== tenant.group_id) {
    reply.status(404).send({ ok: false, error: "NOT_FOUND" });
    return false;
  }
  return true;
}

function toInt(v: unknown, dft: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dft;
  return Math.trunc(n);
}

function asObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function boolLike(v: unknown, dft: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
  }
  return dft;
}

function sendSkillsResponse(reply: any, payload: Record<string, unknown>) {
  return reply.send({
    api_contract_version: SKILLS_API_CONTRACT_VERSION,
    ...payload,
  });
}

function sendSkillsInternalError(reply: any, e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  if (message.includes("INVALID_TRIGGER_STAGE")) {
    return reply.status(400).send({
      ok: false,
      error: "INVALID_TRIGGER_STAGE",
      message,
      api_contract_version: SKILLS_API_CONTRACT_VERSION,
    });
  }
  if (message.includes("Invalid enum value") && message.includes("trigger_stage")) {
    return reply.status(400).send({
      ok: false,
      error: "INVALID_TRIGGER_STAGE",
      message:
        "trigger_stage 校验失败：before_approval 已弃用，请改用 after_recommendation。允许值：before_recommendation | before_dispatch | before_acceptance | after_acceptance | after_recommendation",
      api_contract_version: SKILLS_API_CONTRACT_VERSION,
    });
  }
  console.error(e);
  return reply.status(500).send({
    ok: false,
    error: String(e),
    api_contract_version: SKILLS_API_CONTRACT_VERSION,
  });
}

export function registerSkillsV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/skills/registry", async (req, reply) => {
    const query = (req as any).url?.includes("?") ? String((req as any).url).slice(String((req as any).url).indexOf("?")) : "";
    const location = `/api/v1/skills${query}`;
    return reply
      .code(301)
      .header("Location", location)
      .send({
        ok: true,
        deprecated: true,
        redirect_to: location,
        api_contract_version: SKILLS_API_CONTRACT_VERSION,
      });
  });

  app.get("/api/v1/skills", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
      if (!auth) return;

      const tenant = tenantFromReq(req as any, auth);
      if (!requireTenantMatchOr404(auth, tenant, reply)) return;

      const q = (req.query ?? {}) as any;
      await projectSkillRegistryReadV1(pool, tenant);
      let rows = await querySkillRegistryReadV1(pool, {
        ...tenant,
        category: typeof q.category === "string" ? q.category : undefined,
        status: typeof q.status === "string" ? q.status : undefined,
        crop_code: typeof q.crop_code === "string" ? q.crop_code : undefined,
        device_type: typeof q.device_type === "string" ? q.device_type : undefined,
        trigger_stage: typeof q.trigger_stage === "string" ? q.trigger_stage : undefined,
        bind_target: typeof q.bind_target === "string" ? q.bind_target : undefined,
        fact_type: "skill_definition_v1",
      });
      const bindingRows = await querySkillRegistryReadV1(pool, {
        ...tenant,
        crop_code: typeof q.crop_code === "string" ? q.crop_code : undefined,
        bind_target: typeof q.bind_target === "string" ? q.bind_target : undefined,
        fact_type: "skill_binding_v1",
      });
      const bindingMap = new Map<string, string>();
      for (const row of bindingRows) {
        const key = `${row.skill_id}::${row.version}`;
        if (!bindingMap.has(key)) bindingMap.set(key, String(row.status ?? "DISABLED").toUpperCase());
      }

      const items = (rows ?? []).map((row) => {
        return {
          skill_id: row.skill_id,
          version: row.version,
          display_name: String(row.payload_json?.display_name ?? row.skill_id),
          category: row.category ?? "unknown",
          legacy_category: row.legacy_category,
          skill_type: row.category ?? "unknown",
          status: row.status,
          trigger_stage: row.trigger_stage,
          scope_type: row.scope_type,
          rollout_mode: row.rollout_mode,
          crop_code: row.crop_code,
          device_type: row.device_type,
          binding_status: bindingMap.get(`${row.skill_id}::${row.version}`) ?? "UNBOUND",
          updated_at: row.occurred_at,
        };
      });

      return sendSkillsResponse(reply, { ok: true, items });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return reply.status(500).send({
        ok: false,
        error: message,
        deprecated: true,
        successor_endpoint: SKILLS_LEGACY_MUTATION_SUCCESSOR_ENDPOINT,
        api_contract_version: SKILLS_API_CONTRACT_VERSION,
      });
    }
  });

  app.get("/api/v1/skills/:skill_id", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
      if (!auth) return;

      const tenant = tenantFromReq(req as any, auth);
      if (!requireTenantMatchOr404(auth, tenant, reply)) return;

      const params = req.params as { skill_id?: string };
      const skill_id = String(params.skill_id ?? "").trim();
      if (!skill_id) return reply.code(400).send({ ok: false, error: "INVALID_SKILL_ID", api_contract_version: SKILLS_API_CONTRACT_VERSION });

      await projectSkillRegistryReadV1(pool, tenant);
      const readRows = await pool.query<SkillRow>(
        `SELECT *
           FROM skill_registry_read_v1
          WHERE tenant_id = $1
            AND project_id = $2
            AND group_id = $3
            AND skill_id = $4
          ORDER BY updated_at_ts_ms DESC
          LIMIT 500`,
        [tenant.tenant_id, tenant.project_id, tenant.group_id, skill_id],
      );

      const rows = readRows.rows ?? [];
      if (!rows.length) return reply.code(404).send({ ok: false, error: "SKILL_NOT_FOUND", api_contract_version: SKILLS_API_CONTRACT_VERSION });

      const defs = rows.filter((r) => r.fact_type === "skill_definition_v1");
      const bindings = rows.filter((r) => r.fact_type === "skill_binding_v1");
      const runs = rows.filter((r) => r.fact_type === "skill_run_v1");

      const latestDef = defs[0] ?? rows[0];
      const activeVersion = defs.find((d) => String(d.status ?? "").toUpperCase() === "ACTIVE")?.version ?? latestDef.version;
      const latestRuns = runs.slice(0, 20);

      const summary = {
        total: latestRuns.length,
        success: latestRuns.filter((r) => String(r.result_status ?? "").toUpperCase() === "SUCCESS").length,
        failed: latestRuns.filter((r) => String(r.result_status ?? "").toUpperCase() === "FAILED").length,
        timeout: latestRuns.filter((r) => String(r.result_status ?? "").toUpperCase() === "TIMEOUT").length,
        latest_at: latestRuns[0]?.occurred_at ?? null,
      };

      const compatibility = {
        crop_code: latestDef.crop_code,
        device_type: latestDef.device_type,
        trigger_stage: latestDef.trigger_stage,
        scope_type: latestDef.scope_type,
        bind_targets: Array.from(new Set(bindings.map((x) => x.bind_target).filter(Boolean))),
      };

      return sendSkillsResponse(reply, {
        ok: true,
        skill_id,
        definition: latestDef.payload_json,
        current_enabled_version: activeVersion,
        compatibility,
        default_config: latestDef.payload_json?.default_config ?? {},
        recent_run_summary: summary,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return reply.status(500).send({
        ok: false,
        error: message,
        deprecated: true,
        successor_endpoint: SKILLS_LEGACY_MUTATION_SUCCESSOR_ENDPOINT,
        api_contract_version: SKILLS_API_CONTRACT_VERSION,
      });
    }
  });

  app.get("/api/v1/skills/runs", async (req, reply) => {
    reply.header("Deprecation", "true");
    reply.header("Link", "</api/v1/skill-runs>; rel=\"successor-version\"");
    reply.header("Sunset", "Wed, 30 Sep 2026 00:00:00 GMT");
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
      if (!auth) return;

      const q = (req.query ?? {}) as any;
      const tenant: TenantTriple = {
        tenant_id: String(q.tenant_id ?? auth.tenant_id).trim(),
        project_id: String(q.project_id ?? auth.project_id).trim(),
        group_id: String(q.group_id ?? auth.group_id).trim(),
      };
      if (!requireTenantMatchOr404(auth, tenant, reply)) return;

      await projectSkillRegistryReadV1(pool, tenant);

      const page = Math.max(1, toInt(q.page, 1));
      const page_size = Math.min(200, Math.max(1, toInt(q.page_size, 20)));
      const offset = (page - 1) * page_size;

      const where = ["tenant_id = $1", "project_id = $2", "group_id = $3", "fact_type = 'skill_run_v1'"];
      const params: unknown[] = [tenant.tenant_id, tenant.project_id, tenant.group_id];
      const pushEq = (field: string, value?: unknown) => {
        if (typeof value !== "string" || !value.trim()) return;
        params.push(value.trim());
        where.push(`${field} = $${params.length}`);
      };

      pushEq("operation_id", q.operation_id ?? q.operation);
      pushEq("field_id", q.field_id);
      pushEq("device_id", q.device_id);

      const countQ = await pool.query<{ total: string }>(
        `SELECT COUNT(*)::text AS total FROM skill_registry_read_v1 WHERE ${where.join(" AND ")}`,
        params,
      );
      params.push(page_size, offset);
      const rowsQ = await pool.query<SkillRow>(
        `SELECT * FROM skill_registry_read_v1 WHERE ${where.join(" AND ")} ORDER BY updated_at_ts_ms DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );

      const total = Number(countQ.rows?.[0]?.total ?? 0);
      return sendSkillsResponse(reply, {
        ok: true,
        page,
        page_size,
        total,
        items: (rowsQ.rows ?? []).map((row) => ({
          run_id: row.payload_json?.run_id ?? row.fact_id,
          skill_id: row.skill_id,
          version: row.version,
          result_status: row.result_status,
          operation_id: row.operation_id,
          field_id: row.field_id,
          device_id: row.device_id,
          bind_target: row.bind_target,
          duration_ms: row.payload_json?.duration_ms ?? null,
          lifecycle_version: row.lifecycle_version ?? row.payload_json?.lifecycle_version ?? null,
          error_code: row.payload_json?.error_code ?? null,
          occurred_at: row.occurred_at,
        })),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return reply.status(500).send({
        ok: false,
        error: message,
        deprecated: true,
        successor_endpoint: SKILLS_LEGACY_MUTATION_SUCCESSOR_ENDPOINT,
        api_contract_version: SKILLS_API_CONTRACT_VERSION,
      });
    }
  });

  app.post("/api/v1/skills/bindings", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
      if (!auth) return;

      const body = (req.body ?? {}) as any;
      const tenant: TenantTriple = {
        tenant_id: String(body.tenant_id ?? auth.tenant_id).trim(),
        project_id: String(body.project_id ?? auth.project_id).trim(),
        group_id: String(body.group_id ?? auth.group_id).trim(),
      };
      if (!requireTenantMatchOr404(auth, tenant, reply)) return;

      const skill_id = String(body.skill_id ?? "").trim();
      const version = String(body.version ?? "").trim();
      const category = String(body.category ?? "").trim().toUpperCase();
      const scope_type = String(body.scope_type ?? "TENANT").trim().toUpperCase();
      const trigger_stage = String(body.trigger_stage ?? "before_dispatch").trim();
      const bind_target = String(body.bind_target ?? "default").trim();
      const rollout_mode = String(body.rollout_mode ?? "DIRECT").trim().toUpperCase();

      if (!skill_id || !version || !category || !bind_target) {
        return reply.code(400).send({
          ok: false,
          error: "INVALID_BODY",
          message: "skill_id/version/category/bind_target are required",
          api_contract_version: SKILLS_API_CONTRACT_VERSION,
        });
      }

      const inserted = await appendSkillBindingFact(pool, {
        ...tenant,
        binding_id: typeof body.binding_id === "string" ? body.binding_id : undefined,
        skill_id,
        version,
        category: category as any,
        status: boolLike(body.enabled, true) ? "ACTIVE" : "DISABLED",
        scope_type: scope_type as any,
        rollout_mode: rollout_mode as any,
        trigger_stage: trigger_stage as any,
        bind_target,
        crop_code: typeof body.crop_code === "string" ? body.crop_code : null,
        device_type: typeof body.device_type === "string" ? body.device_type.trim().toUpperCase() : null,
        priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0,
        config_patch: asObject(body.config_patch) ?? undefined,
      } as any);

      return reply.code(201).send({
        ok: true,
        fact_id: inserted.fact_id,
        occurred_at: inserted.occurred_at,
        binding: inserted.payload,
        api_contract_version: SKILLS_API_CONTRACT_VERSION,
      });
    } catch (e) {
      return sendSkillsInternalError(reply, e);
    }
  });

  app.get("/api/v1/skills/bindings", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
      if (!auth) return;

      const tenant = tenantFromReq(req as any, auth);
      if (!requireTenantMatchOr404(auth, tenant, reply)) return;

      const q = (req.query ?? {}) as any;
      await projectSkillRegistryReadV1(pool, tenant);
      const projection = await querySkillBindingProjectionV1(pool, {
        ...tenant,
        category: typeof q.category === "string" ? q.category : undefined,
        status: typeof q.status === "string" ? q.status : undefined,
        crop_code: typeof q.crop_code === "string" ? q.crop_code : undefined,
        device_type: typeof q.device_type === "string" ? q.device_type : undefined,
        trigger_stage: typeof q.trigger_stage === "string" ? q.trigger_stage : undefined,
        bind_target: typeof q.bind_target === "string" ? q.bind_target : undefined,
      });

      return sendSkillsResponse(reply, {
        ok: true,
        items_effective: projection.items_effective,
        items_history: projection.items_history,
        overrides: projection.overrides,
      });
    } catch (e) {
      return sendSkillsInternalError(reply, e);
    }
  });

  app.post("/api/v1/skills/bindings/override", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
      if (!auth) return;

      const body = (req.body ?? {}) as any;
      const tenant: TenantTriple = {
        tenant_id: String(body.tenant_id ?? auth.tenant_id).trim(),
        project_id: String(body.project_id ?? auth.project_id).trim(),
        group_id: String(body.group_id ?? auth.group_id).trim(),
      };
      if (!requireTenantMatchOr404(auth, tenant, reply)) return;

      const skill_id = String(body.skill_id ?? "").trim();
      const version = String(body.version ?? "").trim();
      const category = String(body.category ?? "").trim().toUpperCase();
      const scope_type = String(body.scope_type ?? "TENANT").trim().toUpperCase();
      const trigger_stage = String(body.trigger_stage ?? "before_dispatch").trim();
      const bind_target = String(body.bind_target ?? "default").trim();
      const rollout_mode = String(body.rollout_mode ?? "DIRECT").trim().toUpperCase();
      if (!skill_id || !version || !category || !bind_target) {
        return reply.code(400).send({
          ok: false,
          error: "INVALID_BODY",
          message: "skill_id/version/category/bind_target are required",
          api_contract_version: SKILLS_API_CONTRACT_VERSION,
        });
      }

      const inserted = await appendSkillBindingFact(pool, {
        ...tenant,
        binding_id: typeof body.binding_id === "string" ? body.binding_id : undefined,
        skill_id,
        version,
        category: category as any,
        status: boolLike(body.enabled, true) ? "ACTIVE" : "DISABLED",
        scope_type: scope_type as any,
        rollout_mode: rollout_mode as any,
        trigger_stage: trigger_stage as any,
        bind_target,
        crop_code: typeof body.crop_code === "string" ? body.crop_code : null,
        device_type: typeof body.device_type === "string" ? body.device_type.trim().toUpperCase() : null,
        priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0,
        config_patch: asObject(body.config_patch) ?? undefined,
      } as any);

      return reply.code(201).send({
        ok: true,
        fact_id: inserted.fact_id,
        occurred_at: inserted.occurred_at,
        api_contract_version: SKILLS_API_CONTRACT_VERSION,
      });
    } catch (e) {
      return sendSkillsInternalError(reply, e);
    }
  });

  app.post("/api/v1/skills/:skill_id/enable", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
      if (!auth) return;
      const tenant = tenantFromReq(req as any, auth);
      if (!requireTenantMatchOr404(auth, tenant, reply)) return;

      const skill_id = String((req.params as any)?.skill_id ?? "").trim();
      if (!skill_id) {
        return reply.code(400).send({
          ok: false,
          error: "INVALID_SKILL_ID",
          deprecated: true,
          successor_endpoint: SKILLS_LEGACY_MUTATION_SUCCESSOR_ENDPOINT,
          api_contract_version: SKILLS_API_CONTRACT_VERSION,
        });
      }

      await projectSkillRegistryReadV1(pool, tenant);
      const latestQ = await pool.query<SkillRow>(
        `SELECT * FROM skill_registry_read_v1
         WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3
           AND fact_type = 'skill_definition_v1'
           AND skill_id = $4
         ORDER BY updated_at_ts_ms DESC LIMIT 1`,
        [tenant.tenant_id, tenant.project_id, tenant.group_id, skill_id],
      );
      const latest = latestQ.rows?.[0];
      if (!latest) {
        return reply.code(404).send({
          ok: false,
          error: "SKILL_NOT_FOUND",
          deprecated: true,
          successor_endpoint: SKILLS_LEGACY_MUTATION_SUCCESSOR_ENDPOINT,
          api_contract_version: SKILLS_API_CONTRACT_VERSION,
        });
      }

      const payload = latest.payload_json as SkillDefinitionFactPayload;
      const appended = await appendSkillDefinitionFact(pool, {
        ...payload,
        status: "ACTIVE",
      });
      return sendSkillsResponse(reply, {
        ok: true,
        fact_id: appended.fact_id,
        occurred_at: appended.occurred_at,
        status: "ACTIVE",
        deprecated: true,
        successor_endpoint: SKILLS_LEGACY_MUTATION_SUCCESSOR_ENDPOINT,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return reply.status(500).send({
        ok: false,
        error: message,
        deprecated: true,
        successor_endpoint: SKILLS_LEGACY_MUTATION_SUCCESSOR_ENDPOINT,
        api_contract_version: SKILLS_API_CONTRACT_VERSION,
      });
    }
  });

  app.post("/api/v1/skills/:skill_id/disable", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
      if (!auth) return;
      const tenant = tenantFromReq(req as any, auth);
      if (!requireTenantMatchOr404(auth, tenant, reply)) return;

      const skill_id = String((req.params as any)?.skill_id ?? "").trim();
      if (!skill_id) {
        return reply.code(400).send({
          ok: false,
          error: "INVALID_SKILL_ID",
          deprecated: true,
          successor_endpoint: SKILLS_LEGACY_MUTATION_SUCCESSOR_ENDPOINT,
          api_contract_version: SKILLS_API_CONTRACT_VERSION,
        });
      }

      await projectSkillRegistryReadV1(pool, tenant);
      const latestQ = await pool.query<SkillRow>(
        `SELECT * FROM skill_registry_read_v1
         WHERE tenant_id = $1 AND project_id = $2 AND group_id = $3
           AND fact_type = 'skill_definition_v1'
           AND skill_id = $4
         ORDER BY updated_at_ts_ms DESC LIMIT 1`,
        [tenant.tenant_id, tenant.project_id, tenant.group_id, skill_id],
      );
      const latest = latestQ.rows?.[0];
      if (!latest) {
        return reply.code(404).send({
          ok: false,
          error: "SKILL_NOT_FOUND",
          deprecated: true,
          successor_endpoint: SKILLS_LEGACY_MUTATION_SUCCESSOR_ENDPOINT,
          api_contract_version: SKILLS_API_CONTRACT_VERSION,
        });
      }

      const payload = latest.payload_json as SkillDefinitionFactPayload;
      const appended = await appendSkillDefinitionFact(pool, {
        ...payload,
        status: "DISABLED",
      });
      return sendSkillsResponse(reply, {
        ok: true,
        fact_id: appended.fact_id,
        occurred_at: appended.occurred_at,
        status: "DISABLED",
        deprecated: true,
        successor_endpoint: SKILLS_LEGACY_MUTATION_SUCCESSOR_ENDPOINT,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return reply.status(500).send({
        ok: false,
        error: message,
        deprecated: true,
        successor_endpoint: SKILLS_LEGACY_MUTATION_SUCCESSOR_ENDPOINT,
        api_contract_version: SKILLS_API_CONTRACT_VERSION,
      });
    }
  });
}
