/**
 * Mainline Contract:
 * - skills 执行结果新流主口径：`bindings/override + /api/v1/skill-runs`。
 * - 新增技能运行态查询/统计时，必须优先走本文件路由契约。
 */
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { requireAoActScopeV0 } from "../auth/ao_act_authz_v0.js";
import { listSkillRuns } from "../services/skills/skill_runtime_service.js";
import { tenantFromQuery, tenantMatches } from "../services/skills/skill_trace_service.js";

export function registerSkillRunsV1Routes(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/skill-runs", async (req, reply) => {
    const auth = requireAoActScopeV0(req, reply, "ao_act.index.read");
    if (!auth) return;

    const query = (req.query ?? {}) as Record<string, unknown>;
    const tenant = tenantFromQuery(query, auth);
    if (!tenantMatches(auth, tenant)) return reply.status(404).send({ ok: false, error: "NOT_FOUND" });

    const result = await listSkillRuns(pool, tenant, query);
    return reply.send({ ok: true, ...result });
  });
}
