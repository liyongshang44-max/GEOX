import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerDecisionEngineV1Routes } from "../../routes/decision_engine_v1.js";
import { registerSkillRulesV1Routes } from "../../routes/skills_rules_v1.js";
import { registerSkillsV1Routes } from "../../routes/skills_v1.js";
import { registerSkillRunsV1Routes } from "../../routes/skill_runs_v1.js";
import { registerSkillRuntimeV1Routes } from "../../routes/skill_runtime_v1.js";

/**
 * Skills Architecture Layer (Horizontal Capability Layer)
 *
 * Service Boundary:
 * - 该层位于 Evidence Judge 与 Agronomy Judge 之间，提供横向技能目录、绑定治理与运行态查询能力。
 * - 向上暴露 routes 契约（skills_v1 / skill_runs_v1 / skills_rules_v1），向下依赖 skills 服务层与 read model 投影。
 *
 * Call Direction:
 * - Evidence Judge -> Skill Architecture Layer -> Agronomy Judge。
 * - 禁止反向跨层调用（Agronomy Judge 不直接回调 Evidence Judge）。
 */
export function registerSkillArchitectureLayer(app: FastifyInstance, pool: Pool): void {
  registerSkillRulesV1Routes(app, pool);
  registerSkillsV1Routes(app, pool);
  registerSkillRunsV1Routes(app, pool);
  registerSkillRuntimeV1Routes(app, pool);
}

export function registerDecisionModule(app: FastifyInstance, pool: Pool): void {
  registerDecisionEngineV1Routes(app, pool);
  registerSkillArchitectureLayer(app, pool);
}
