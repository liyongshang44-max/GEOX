import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerDecisionEngineV1Routes } from "../../routes/decision_engine_v1.js";
import { registerSkillRulesV1Routes } from "../../routes/skills_rules_v1.js";
import { registerSkillsV1Routes } from "../../routes/skills_v1.js";
import { registerSkillRunsV1Routes } from "../../routes/skill_runs_v1.js";
import { registerSkillRuntimeV1Routes } from "../../routes/skill_runtime_v1.js";

export function registerDecisionModule(app: FastifyInstance, pool: Pool): void {
  registerDecisionEngineV1Routes(app, pool);
  registerSkillRulesV1Routes(app, pool);
  registerSkillsV1Routes(app, pool);
  registerSkillRunsV1Routes(app, pool);
  registerSkillRuntimeV1Routes(app, pool);
}
