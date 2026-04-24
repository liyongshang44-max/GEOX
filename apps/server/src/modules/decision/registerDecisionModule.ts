import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerDecisionEngineV1Routes } from "../../routes/decision_engine_v1.js";
import { registerSkillRulesV1Routes } from "../../routes/skills_rules_v1.js";
import { registerSkillsV1Routes } from "../../routes/skills_v1.js";
import { registerSkillRunsV1Routes } from "../../routes/skill_runs_v1.js";
import { registerAgronomyInterpretationV1Routes } from "../../routes/agronomy_interpretation_v1.js";
import { registerAgronomyInferenceV1Routes } from "../../routes/agronomy_inference_v1.js";

export function registerDecisionModule(app: FastifyInstance, pool: Pool): void {
  registerDecisionEngineV1Routes(app, pool);
  registerSkillRulesV1Routes(app, pool);
  registerSkillsV1Routes(app, pool);
  registerSkillRunsV1Routes(app, pool);
  registerAgronomyInterpretationV1Routes(app);
  registerAgronomyInferenceV1Routes(app, pool);
}
