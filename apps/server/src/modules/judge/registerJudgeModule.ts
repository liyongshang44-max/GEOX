import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registerJudgeV2Routes } from "../../routes/judge_v2.js";

export function registerJudgeModule(app: FastifyInstance, pool: Pool): void {
  registerJudgeV2Routes(app, pool);
}
