/**
 * Mainline Contract:
 * - skills 新流主口径：`bindings/override + /api/v1/skill-runs`，本文件仅承担鉴权/参数校验/响应映射。
 * - 业务逻辑下沉至 services/skills/* 服务层。
 */
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { appendSkillBinding, getSkillBindingProjection, validateSkillBindingInput } from "../services/skills/skill_binding_service.js";
import { getSkillDetail, listSkills, updateSkillStatus } from "../services/skills/skill_registry_service.js";
import { listSkillRunsLegacy } from "../services/skills/skill_runtime_service.js";
import {
  mapSkillsInternalError,
  SKILLS_API_CONTRACT_VERSION,
  SKILLS_DEPRECATION_SUNSET,
  SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT,
  SKILLS_LEGACY_READ_SUCCESSOR_ENDPOINT,
  SKILLS_LEGACY_RUNS_READ_SUCCESSOR_ENDPOINT,
  setSkillsLegacyDeprecationHeaders,
  tenantFromBody,
  tenantFromQuery,
  tenantMatches,
} from "../services/skills/skill_trace_service.js";

function withContract(payload: Record<string, unknown>): Record<string, unknown> {
  return { api_contract_version: SKILLS_API_CONTRACT_VERSION, ...payload };
}

export function registerSkillsV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/skills/registry", async (req, reply) => {
    const query = (req as any).url?.includes("?") ? String((req as any).url).slice(String((req as any).url).indexOf("?")) : "";
    const location = `${SKILLS_LEGACY_READ_SUCCESSOR_ENDPOINT}${query}`;
    setSkillsLegacyDeprecationHeaders(reply, SKILLS_LEGACY_READ_SUCCESSOR_ENDPOINT);
    return reply.code(301).header("Location", location).send(
      withContract({
        ok: true,
        deprecated: true,
        successor_endpoint: SKILLS_LEGACY_READ_SUCCESSOR_ENDPOINT,
        redirect_to: location,
        sunset_at: SKILLS_DEPRECATION_SUNSET,
      }),
    );
  });

  app.get("/api/v1/skills", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
      if (!auth) return;
      const query = (req.query ?? {}) as Record<string, unknown>;
      const tenant = tenantFromQuery(query, auth);
      if (!tenantMatches(auth, tenant)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
      return reply.send(withContract({ ok: true, items: await listSkills(pool, tenant, query) }));
    } catch (error) {
      const mapped = mapSkillsInternalError(error);
      return reply.status(mapped.status).send(withContract({ ...mapped.payload, deprecated: true, successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT }));
    }
  });

  app.get("/api/v1/skills/:skill_id", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
      if (!auth) return;
      const tenant = tenantFromQuery((req.query ?? {}) as Record<string, unknown>, auth);
      if (!tenantMatches(auth, tenant)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

      const skill_id = String((req.params as { skill_id?: string }).skill_id ?? "").trim();
      if (!skill_id) return reply.code(400).send(withContract({ ok: false, error: "INVALID_SKILL_ID" }));

      const detail = await getSkillDetail(pool, tenant, skill_id);
      if (!detail) return reply.code(404).send(withContract({ ok: false, error: "SKILL_NOT_FOUND" }));
      return reply.send(withContract({ ok: true, ...detail }));
    } catch (error) {
      const mapped = mapSkillsInternalError(error);
      return reply.status(mapped.status).send(withContract({ ...mapped.payload, deprecated: true, successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT }));
    }
  });

  app.get("/api/v1/skills/runs", async (req, reply) => {
    setSkillsLegacyDeprecationHeaders(reply, SKILLS_LEGACY_RUNS_READ_SUCCESSOR_ENDPOINT);
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
      if (!auth) return;
      const query = (req.query ?? {}) as Record<string, unknown>;
      const tenant = tenantFromQuery(query, auth);
      if (!tenantMatches(auth, tenant)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

      const result = await listSkillRunsLegacy(pool, tenant, query);
      return reply.send(withContract({ ok: true, deprecated: true, successor_endpoint: SKILLS_LEGACY_RUNS_READ_SUCCESSOR_ENDPOINT, sunset_at: SKILLS_DEPRECATION_SUNSET, ...result }));
    } catch (error) {
      const mapped = mapSkillsInternalError(error);
      return reply.status(mapped.status).send(withContract({ ...mapped.payload, deprecated: true, successor_endpoint: SKILLS_LEGACY_RUNS_READ_SUCCESSOR_ENDPOINT, sunset_at: SKILLS_DEPRECATION_SUNSET }));
    }
  });

  app.post("/api/v1/skills/bindings", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
      if (!auth) return;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const tenant = tenantFromBody(body, auth);
      if (!tenantMatches(auth, tenant)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

      validateSkillBindingInput(body);
      const inserted = await appendSkillBinding(pool, { ...tenant, ...body });
      return reply.code(201).send(withContract({ ok: true, fact_id: inserted.fact_id, occurred_at: inserted.occurred_at, binding: inserted.payload }));
    } catch (error) {
      const mapped = mapSkillsInternalError(error);
      if (String((error as Error)?.message ?? "").startsWith("INVALID_BODY:")) {
        return reply.code(400).send(withContract({ ok: false, error: "INVALID_BODY", message: String((error as Error).message).replace("INVALID_BODY:", "") }));
      }
      return reply.status(mapped.status).send(withContract(mapped.payload));
    }
  });

  app.get("/api/v1/skills/bindings", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
      if (!auth) return;
      const query = (req.query ?? {}) as Record<string, unknown>;
      const tenant = tenantFromQuery(query, auth);
      if (!tenantMatches(auth, tenant)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

      const projection = await getSkillBindingProjection(pool, tenant, query);
      return reply.send(withContract({ ok: true, items_effective: projection.items_effective, items_history: projection.items_history, overrides: projection.overrides }));
    } catch (error) {
      const mapped = mapSkillsInternalError(error);
      return reply.status(mapped.status).send(withContract(mapped.payload));
    }
  });

  app.post("/api/v1/skills/bindings/override", async (req, reply) => {
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
      if (!auth) return;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const tenant = tenantFromBody(body, auth);
      if (!tenantMatches(auth, tenant)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

      validateSkillBindingInput(body);
      const inserted = await appendSkillBinding(pool, { ...tenant, ...body });
      return reply.code(201).send(withContract({ ok: true, fact_id: inserted.fact_id, occurred_at: inserted.occurred_at }));
    } catch (error) {
      const mapped = mapSkillsInternalError(error);
      if (String((error as Error)?.message ?? "").startsWith("INVALID_BODY:")) {
        return reply.code(400).send(withContract({ ok: false, error: "INVALID_BODY", message: String((error as Error).message).replace("INVALID_BODY:", "") }));
      }
      return reply.status(mapped.status).send(withContract(mapped.payload));
    }
  });

  app.post("/api/v1/skills/:skill_id/enable", async (req, reply) => {
    setSkillsLegacyDeprecationHeaders(reply, SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT);
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
      if (!auth) return;
      const tenant = tenantFromQuery((req.query ?? {}) as Record<string, unknown>, auth);
      if (!tenantMatches(auth, tenant)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
      const skill_id = String((req.params as { skill_id?: string }).skill_id ?? "").trim();
      if (!skill_id) return reply.code(400).send(withContract({ ok: false, error: "INVALID_SKILL_ID", deprecated: true, successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT, read_successor_endpoint: SKILLS_LEGACY_READ_SUCCESSOR_ENDPOINT, write_successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT, sunset_at: SKILLS_DEPRECATION_SUNSET }));

      const appended = await updateSkillStatus(pool, tenant, skill_id, "ACTIVE");
      if (!appended) return reply.code(404).send(withContract({ ok: false, error: "SKILL_NOT_FOUND", deprecated: true, successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT, read_successor_endpoint: SKILLS_LEGACY_READ_SUCCESSOR_ENDPOINT, write_successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT, sunset_at: SKILLS_DEPRECATION_SUNSET }));

      return reply.send(withContract({ ok: true, fact_id: appended.fact_id, occurred_at: appended.occurred_at, status: "ACTIVE", deprecated: true, successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT, read_successor_endpoint: SKILLS_LEGACY_READ_SUCCESSOR_ENDPOINT, write_successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT, sunset_at: SKILLS_DEPRECATION_SUNSET }));
    } catch (error) {
      const mapped = mapSkillsInternalError(error);
      return reply.status(mapped.status).send(withContract({ ...mapped.payload, deprecated: true, successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT, read_successor_endpoint: SKILLS_LEGACY_READ_SUCCESSOR_ENDPOINT, write_successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT, sunset_at: SKILLS_DEPRECATION_SUNSET }));
    }
  });

  app.post("/api/v1/skills/:skill_id/disable", async (req, reply) => {
    setSkillsLegacyDeprecationHeaders(reply, SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT);
    try {
      const auth = requireAoActScopeV0(req, reply, "ao_act.task.write");
      if (!auth) return;
      const tenant = tenantFromQuery((req.query ?? {}) as Record<string, unknown>, auth);
      if (!tenantMatches(auth, tenant)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });
      const skill_id = String((req.params as { skill_id?: string }).skill_id ?? "").trim();
      if (!skill_id) return reply.code(400).send(withContract({ ok: false, error: "INVALID_SKILL_ID", deprecated: true, successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT, read_successor_endpoint: SKILLS_LEGACY_READ_SUCCESSOR_ENDPOINT, write_successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT, sunset_at: SKILLS_DEPRECATION_SUNSET }));

      const appended = await updateSkillStatus(pool, tenant, skill_id, "DISABLED");
      if (!appended) return reply.code(404).send(withContract({ ok: false, error: "SKILL_NOT_FOUND", deprecated: true, successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT, read_successor_endpoint: SKILLS_LEGACY_READ_SUCCESSOR_ENDPOINT, write_successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT, sunset_at: SKILLS_DEPRECATION_SUNSET }));

      return reply.send(withContract({ ok: true, fact_id: appended.fact_id, occurred_at: appended.occurred_at, status: "DISABLED", deprecated: true, successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT, read_successor_endpoint: SKILLS_LEGACY_READ_SUCCESSOR_ENDPOINT, write_successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT, sunset_at: SKILLS_DEPRECATION_SUNSET }));
    } catch (error) {
      const mapped = mapSkillsInternalError(error);
      return reply.status(mapped.status).send(withContract({ ...mapped.payload, deprecated: true, successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT, read_successor_endpoint: SKILLS_LEGACY_READ_SUCCESSOR_ENDPOINT, write_successor_endpoint: SKILLS_LEGACY_MUTATION_WRITE_SUCCESSOR_ENDPOINT, sunset_at: SKILLS_DEPRECATION_SUNSET }));
    }
  });
}
