import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { registerProgramsReadV1Routes } from "./programs_read_v1.js";
import { registerProgramsWriteV1Routes } from "./programs_write_v1.js";

export const SUPPORTED_CROP_MODELS = ["corn", "tomato"] as const;

// Governance boundary:
// - Program 是策略/编排容器域，不是 execution 主链。
// - 不得以 program detail 替代 `/api/v1/operations/:id/detail`。
// - 与 execution 相关的新读取必须优先接入 operation_state 主链 read model。
// Route composition layer only.
export function registerProgramsV1Routes(app: FastifyInstance, pool: Pool): void {
  registerProgramsWriteV1Routes(app, pool);
  registerProgramsReadV1Routes(app, pool);
}
